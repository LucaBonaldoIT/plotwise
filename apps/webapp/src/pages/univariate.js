import { shell, onReady } from '../scripts/shell.js';
import { initArt } from '../scripts/art.js';
import { chart, axes, d3, showTip, hideTip, legend, seriesVar, dragNearest } from '../lib/chart.js';
import { slider, segmented, select, toggle, button, readout, el } from '../lib/ui.js';
import { loadCsv, BANK_ATTRS, TITANIC_ATTRS } from '../lib/data.js';
import { histogram, density, vline, boxplot, maxBinCount, bins } from '../lib/plots.js';
import {
  mean,
  median,
  quantile,
  sorted,
  summary,
  skewness,
  kurtosis,
  std,
  variance,
  mad,
  aad,
  iqr,
  rng,
  normalSampler,
  rescale,
  fmt,
} from '../lib/stats.js';

shell();

onReady(function () {
  initArt(document.getElementById('art'), 'galton');
  Promise.all([loadCsv('bank-data.csv'), loadCsv('titanic.csv')]).then(function (d) {
    var data = { bank: d[0], titanic: d[1] };
    categorical(data);
    percentiles(data);
    granularity(data.bank);
    missing(data.titanic);
    explorer(data.bank);
  });
  tug();
  dispersion();
  powers();
  skewLab();
  magnifier();
  kurtLab();
});

/* ---- helpers ------------------------------------------------------------ */

var NUMERIC = {
  bank: ['age', 'income', 'children'],
  titanic: ['Age', 'Fare', 'SibSp', 'Parch'],
};

function isMissing(v) {
  return v === null || v === undefined || v === '' || (typeof v === 'number' && isNaN(v));
}

function counts(rows, key) {
  var m = new Map();
  var miss = 0;
  rows.forEach(function (r) {
    var v = r[key];
    if (isMissing(v)) {
      miss++;
      return;
    }
    m.set(String(v), (m.get(String(v)) || 0) + 1);
  });
  return { map: m, missing: miss };
}

/** Skew-normal sample: δ|u0| + √(1−δ²) u1 */
function skewNormal(n, alpha, seed) {
  var g = normalSampler(rng(seed));
  var d = alpha / Math.sqrt(1 + alpha * alpha);
  var out = [];
  for (var i = 0; i < n; i++) {
    var u0 = g();
    var u1 = g();
    out.push(d * Math.abs(u0) + Math.sqrt(1 - d * d) * u1);
  }
  return out;
}

/* Marsaglia–Tsang gamma(k, 1) */
function gammaSampler(rand, gauss) {
  return function sample(k) {
    if (k < 1) return sample(k + 1) * Math.pow(rand(), 1 / k);
    var d = k - 1 / 3;
    var c = 1 / Math.sqrt(9 * d);
    for (;;) {
      var x = gauss();
      var v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      var u = rand();
      if (u < 1 - 0.0331 * x * x * x * x) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
}

/**
 * Generalized normal with shape β (2 = normal, 1 = Laplace, → ∞ = uniform), symmetrized by
 * mirroring so skewness is exactly 0, then rescaled to mean 10, σ 2.
 */
function genNormal(n, beta, seed) {
  var rand = rng(seed);
  var gauss = normalSampler(rand);
  var gam = gammaSampler(rand, gauss);
  var half = [];
  for (var i = 0; i < n / 2; i++) {
    var gv = gam(1 / beta);
    half.push(Math.pow(gv, 1 / beta) * (rand() < 0.5 ? -1 : 1));
  }
  var all = half.concat(
    half.map(function (x) {
      return -x;
    }),
  );
  return rescale(all, 10, 2);
}

/* ---- 1.2 categorical ---------------------------------------------------- */

function categorical(data) {
  var host = document.getElementById('cat-chart');
  var ctl = document.getElementById('cat-controls');
  var set = readout(document.getElementById('cat-readout'));
  var CATS = {
    bank: BANK_ATTRS.filter(function (a) {
      return a.type === 'nominal' || a.type === 'binary';
    }).map(function (a) {
      return { value: a.key, label: a.label };
    }),
    titanic: [
      { value: 'Sex', label: 'Sex' },
      { value: 'Pclass', label: 'Class (ordinal)' },
      { value: 'Embarked', label: 'Embarked' },
      { value: 'Survived', label: 'Survived' },
      { value: 'Cabin', label: 'Cabin (high cardinality)' },
    ],
  };
  var ds = 'bank';
  var attr = 'region';
  var rel = false;
  var attrSel = select({
    label: 'Attribute',
    options: CATS.bank,
    value: attr,
    onChange: function (v) {
      attr = v;
      c.redraw();
    },
  });
  var dsSeg = segmented({
    label: 'Dataset',
    value: ds,
    options: [
      { value: 'bank', label: 'Bank' },
      { value: 'titanic', label: 'Titanic' },
    ],
    onChange: function (v) {
      ds = v;
      var sel = attrSel.el.querySelector('select');
      sel.innerHTML = '';
      CATS[v].forEach(function (o) {
        var op = document.createElement('option');
        op.value = o.value;
        op.textContent = o.label;
        sel.append(op);
      });
      attr = v === 'bank' ? 'region' : 'Embarked';
      sel.value = attr;
      c.redraw();
    },
  });
  var relSeg = segmented({
    label: 'Show',
    value: 'abs',
    options: [
      { value: 'abs', label: 'Counts' },
      { value: 'rel', label: 'Proportions' },
    ],
    onChange: function (v) {
      rel = v === 'rel';
      c.redraw();
    },
  });
  ctl.append(
    dsSeg.el,
    attrSel.el,
    relSeg.el,
    el(
      'p',
      'ctl-note',
      'Try Titanic → Cabin: 147 distinct values and 687 missing. That is what high cardinality and poor quality look like.',
    ),
  );

  var c = chart(host, {
    aspect: 0.55,
    margin: { top: 22, right: 12, bottom: 48, left: 46 },
    draw: function (ctx) {
      var rows = data[ds];
      var cnt = counts(rows, attr);
      var entries = Array.from(cnt.map.entries()).sort(function (a, b) {
        return b[1] - a[1];
      });
      var card = entries.length;
      var maxBars = 12;
      var shown = entries.slice(0, maxBars);
      if (entries.length > maxBars) {
        var rest = d3.sum(entries.slice(maxBars), function (e) {
          return e[1];
        });
        shown.push(['other (' + (entries.length - maxBars) + ')', rest, 'other']);
      }
      if (cnt.missing) shown.push(['missing', cnt.missing, 'missing']);
      var n = rows.length;
      var val = function (d) {
        return rel ? d[1] / n : d[1];
      };
      var x = d3
        .scaleBand()
        .domain(
          shown.map(function (d) {
            return d[0];
          }),
        )
        .range([0, ctx.innerW])
        .padding(0.18);
      var y = d3
        .scaleLinear()
        .domain([0, d3.max(shown, val) * 1.12])
        .nice()
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xAxis: d3.axisBottom(x).tickFormat(function (t) {
          return t.length > 10 ? t.slice(0, 9) + '…' : t;
        }),
        yAxis: d3.axisLeft(y).tickFormat(rel ? d3.format('.0%') : d3.format('~s')),
      });
      ctx.g
        .select('.axis')
        .selectAll('text')
        .attr('transform', shown.length > 6 ? 'rotate(-30)' : null)
        .attr('text-anchor', shown.length > 6 ? 'end' : 'middle');
      ctx.g
        .selectAll('rect.bar')
        .data(shown)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', function (d) {
          return x(d[0]);
        })
        .attr('width', x.bandwidth())
        .attr('y', function (d) {
          return y(val(d));
        })
        .attr('height', function (d) {
          return ctx.innerH - y(val(d));
        })
        .attr('rx', 3)
        .attr('fill', function (d, i) {
          return d[2] === 'missing' ? 'none' : i === 0 ? ctx.c.accent : ctx.c.text;
        })
        .attr('stroke', function (d) {
          return d[2] === 'missing' ? ctx.c.accent : 'none';
        })
        .attr('stroke-dasharray', '4 3')
        .attr('opacity', function (d, i) {
          return i === 0 || d[2] === 'missing' ? 1 : d[2] === 'other' ? 0.3 : 0.55;
        })
        .on('pointerenter', function (e, d) {
          showTip(
            e,
            '<b>' + d[0] + '</b><br>' + d[1] + ' · ' + fmt((d[1] / n) * 100, 1) + '% of ' + n,
          );
        })
        .on('pointerleave', hideTip);
      ctx.g
        .append('text')
        .attr('class', 'label label--accent')
        .attr('x', x(shown[0][0]) + x.bandwidth() / 2)
        .attr('y', y(val(shown[0])) - 6)
        .attr('text-anchor', 'middle')
        .text('mode');
      set([
        { k: 'Instances', v: n },
        { k: 'Cardinality', v: card, hot: card > 20 },
        { k: 'Mode', v: entries[0][0], hot: true },
        { k: 'Mode freq.', v: fmt((entries[0][1] / n) * 100, 1) + '%' },
        {
          k: 'Missing',
          v: cnt.missing + ' (' + fmt((cnt.missing / n) * 100, 1) + '%)',
          hot: cnt.missing > 0,
        },
      ]);
    },
  });
}

/* ---- 1.4 tug of war ------------------------------------------------------ */

function tug() {
  var host = document.getElementById('tug');
  var ctl = document.getElementById('tug-controls');
  var set = readout(document.getElementById('tug-readout'));
  var START = [8, 9.5, 10, 11, 12, 12.5, 13.5, 15, 16];
  var pts = START.slice();
  var add = button('+ Add a value', function () {
    pts.push(Math.round((10 + Math.random() * 8) * 2) / 2);
    c.redraw();
  });
  var rem = button('− Remove one', function () {
    if (pts.length > 2) pts.pop();
    c.redraw();
  });
  var out = button(
    'Throw an outlier',
    function () {
      pts[pts.length - 1] = 48;
      c.redraw();
    },
    'ds-button--primary',
  );
  var reset = button('Reset', function () {
    pts = START.slice();
    c.redraw();
  });
  var actions = el('div', 'ctl-actions');
  actions.append(add, rem, out, reset);
  ctl.append(
    actions,
    el(
      'p',
      'ctl-note',
      'Drag one value far to the right. The mean is pulled along; the median does not care how far the outlier goes, only on which side it sits.',
    ),
  );

  var c = chart(host, {
    height: function (w) {
      return w < 500 ? 220 : 200;
    },
    margin: { top: 34, right: 18, bottom: 34, left: 18 },
    draw: function (ctx) {
      var x = d3.scaleLinear().domain([0, 50]).range([0, ctx.innerW]);
      var cy = ctx.innerH * 0.55;
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(d3.axisBottom(x).ticks(Math.floor(ctx.innerW / 60)));
      ctx.g
        .append('line')
        .attr('x1', 0)
        .attr('x2', ctx.innerW)
        .attr('y1', cy)
        .attr('y2', cy)
        .attr('stroke', ctx.c.line);
      var markers = ctx.g.append('g');
      var dots = ctx.g.append('g');

      function paint() {
        var m = mean(pts);
        var md = median(pts);
        var s = pts.slice().sort(function (a, b) {
          return a - b;
        });
        var n = s.length;
        var half = Math.floor(n / 2);
        var central = n % 2 ? [s[half]] : [s[half - 1], s[half]];
        markers.selectAll('*').remove();
        [
          [m, 'mean', ctx.c.series[1], -1],
          [md, 'median', ctx.c.accent, 1],
        ].forEach(function (mk) {
          var px = x(mk[0]);
          var y0 = mk[3] < 0 ? -22 : ctx.innerH - 4;
          markers
            .append('line')
            .attr('x1', px)
            .attr('x2', px)
            .attr('y1', mk[3] < 0 ? -10 : cy)
            .attr('y2', mk[3] < 0 ? cy : ctx.innerH - 14)
            .attr('stroke', mk[2])
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', mk[3] < 0 ? '4 3' : null);
          markers
            .append('text')
            .attr('class', 'label')
            .style('fill', mk[2])
            .attr('x', px)
            .attr('y', mk[3] < 0 ? y0 + 6 : y0 - 14)
            .attr('text-anchor', 'middle')
            .text(mk[1] + ' ' + fmt(mk[0], 2));
        });
        var used = new Set();
        dots
          .selectAll('circle')
          .data(
            pts.map(function (v, i) {
              return { v: v, i: i };
            }),
          )
          .join('circle')
          .attr('class', 'handle')
          .attr('cx', function (d) {
            return x(d.v);
          })
          .attr('cy', cy)
          .attr('r', 9)
          .attr('fill', function (d) {
            var k = central.indexOf(d.v);
            if (k >= 0 && !used.has(k + ':' + d.v)) {
              used.add(k + ':' + d.v);
              return ctx.c.accent;
            }
            return ctx.c.text;
          })
          .attr('fill-opacity', 0.85)
          .attr('stroke', ctx.c.surface)
          .attr('stroke-width', 2);
        var rule =
          n % 2
            ? 'n = ' + n + ' odd → x<sub>m+1</sub> with m = ' + half
            : 'n = ' + n + ' even → (x<sub>m</sub> + x<sub>m+1</sub>)/2, m = ' + half;
        set([
          { k: 'Mean', v: fmt(m, 2), color: seriesVar(1), hot: true },
          { k: 'Median', v: fmt(md, 2), hot: true },
          { k: 'Gap', v: fmt(m - md, 2) },
          { k: 'Rule', v: '<span style="font-size:0.8rem">' + rule + '</span>' },
        ]);
      }
      dragNearest(
        ctx,
        function () {
          return pts.map(function (v, i) {
            return { x: x(v), y: cy, d: i };
          });
        },
        function (i, px) {
          pts[i] = Math.max(0, Math.min(50, Math.round(x.invert(px) * 2) / 2));
          paint();
        },
      );
      paint();
    },
  });
}

/* ---- 1.5 dispersion ------------------------------------------------------ */

function dispersion() {
  var hist = document.getElementById('disp-hist');
  var bars = document.getElementById('disp-bars');
  var ctl = document.getElementById('disp-controls');
  var table = document.getElementById('disp-table');
  var N = 400;
  var g = normalSampler(rng(23));
  var base = [];
  var noise = [];
  for (var i = 0; i < N; i++) {
    base.push(20 + g() * 5);
    noise.push(g());
  }
  var frac = 0.08;
  var dist = 12;
  var sF = slider({
    label: 'Contamination',
    min: 0,
    max: 30,
    value: frac * 100,
    format: function (v) {
      return v + '%';
    },
    onInput: function (v) {
      frac = v / 100;
      update();
    },
  });
  var sD = slider({
    label: 'How far the outliers sit',
    min: 2,
    max: 40,
    value: dist,
    format: function (v) {
      return '−' + v;
    },
    onInput: function (v) {
      dist = v;
      update();
    },
  });
  ctl.append(
    sF.el,
    sD.el,
    el(
      'p',
      'ctl-note',
      'A share of values is pushed into a left tail. Variance reacts quadratically; MAD and the IQR barely notice.',
    ),
  );

  var contaminated = [];
  function build() {
    var k = Math.round(N * frac);
    contaminated = base.map(function (v, i) {
      return i < k ? 20 - dist + noise[i] * 3 : v;
    });
  }
  var MEAS = [
    ['Range', d3.extent],
    ['Variance', variance],
    ['StandDev', std],
    ['RI (IQR)', iqr],
    ['AAD', aad],
    ['MAD', mad],
  ];
  function val(f, xs) {
    if (f === d3.extent) {
      var e = d3.extent(xs);
      return e[1] - e[0];
    }
    return f(xs);
  }

  var hc = chart(hist, {
    aspect: 0.75,
    margin: { top: 14, right: 10, bottom: 30, left: 36 },
    draw: function (ctx) {
      var x = d3.scaleLinear().domain([-25, 40]).range([0, ctx.innerW]);
      var y = d3
        .scaleLinear()
        .domain([0, Math.max(maxBinCount(base, x.domain(), 30), 10) * 1.1])
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, { xLabel: 'value', yLabel: 'frequency' });
      histogram(ctx, contaminated, { x: x, y: y, bins: 30, color: ctx.c.accent, opacity: 0.75 });
      var b = bins(base, x.domain(), 30);
      ctx.g
        .append('path')
        .datum(b)
        .attr(
          'd',
          d3
            .line()
            .x(function (d) {
              return x((d.x0 + d.x1) / 2);
            })
            .y(function (d) {
              return y(d.length);
            })
            .curve(d3.curveStepAfter),
        )
        .attr('fill', 'none')
        .attr('stroke', ctx.c.text)
        .attr('stroke-width', 1.5);
      legend(ctx, [
        { label: 'clean', color: ctx.c.text },
        { label: 'contaminated', color: ctx.c.accent },
      ]);
    },
  });
  var bc = chart(bars, {
    aspect: 0.75,
    margin: { top: 14, right: 40, bottom: 30, left: 66 },
    draw: function (ctx) {
      var rows = MEAS.map(function (m) {
        var a = val(m[1], base);
        var b = val(m[1], contaminated);
        return { name: m[0], change: (b - a) / a };
      });
      var x = d3
        .scaleLinear()
        .domain([
          0,
          Math.max(
            0.5,
            d3.max(rows, (r) => r.change),
          ),
        ])
        .nice()
        .range([0, ctx.innerW]);
      var y = d3
        .scaleBand()
        .domain(rows.map((r) => r.name))
        .range([0, ctx.innerH])
        .padding(0.25);
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format('+.0%')));
      ctx.g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0));
      ctx.g
        .selectAll('rect.b')
        .data(rows)
        .join('rect')
        .attr('x', 0)
        .attr('y', (d) => y(d.name))
        .attr('height', y.bandwidth())
        .attr('width', (d) => Math.max(1, x(Math.max(0, d.change))))
        .attr('rx', 3)
        .attr('fill', function (d) {
          return d.name === 'Variance' || d.name === 'Range' ? ctx.c.accent : ctx.c.text;
        })
        .attr('opacity', function (d) {
          return d.name === 'MAD' || d.name === 'RI (IQR)' ? 0.45 : 0.85;
        });
      ctx.g
        .selectAll('text.v')
        .data(rows)
        .join('text')
        .attr('class', 'label')
        .attr('x', (d) => x(Math.max(0, d.change)) + 4)
        .attr('y', (d) => y(d.name) + y.bandwidth() / 2 + 4)
        .text((d) => d3.format('+.0%')(d.change));
    },
  });

  function update() {
    build();
    hc.redraw();
    bc.redraw();
    var rows = [
      ['Mean', mean],
      ['Median', median],
      [
        '25% quartile',
        function (xs) {
          return quantile(xs, 0.25);
        },
      ],
      [
        '75% quartile',
        function (xs) {
          return quantile(xs, 0.75);
        },
      ],
    ].concat(MEAS.slice(1));
    table.innerHTML =
      '<thead><tr><th>Statistic</th><th class="num">Clean</th><th class="num">Contaminated</th></tr></thead><tbody>' +
      rows
        .map(function (r) {
          return (
            '<tr><td>' +
            r[0] +
            '</td><td class="num">' +
            fmt(val(r[1], base), 3) +
            '</td><td class="num">' +
            fmt(val(r[1], contaminated), 3) +
            '</td></tr>'
          );
        })
        .join('') +
      '</tbody>';
  }
  update();
}

/* ---- 1.6 percentiles ----------------------------------------------------- */

function percentiles(data) {
  var host = document.getElementById('perc-chart');
  var ctl = document.getElementById('perc-controls');
  var set = readout(document.getElementById('perc-readout'));
  var p = 50;
  var src = 'bank:income';
  var sel = select({
    label: 'Variable',
    value: src,
    options: [
      { value: 'bank:income', label: 'Bank · income' },
      { value: 'bank:age', label: 'Bank · age' },
      { value: 'titanic:Fare', label: 'Titanic · fare' },
      { value: 'titanic:Age', label: 'Titanic · age (177 missing, dropped)' },
    ],
    onChange: function (v) {
      src = v;
      c.redraw();
    },
  });
  var sp = slider({
    label: 'Percentile p',
    min: 0,
    max: 100,
    value: p,
    format: function (v) {
      return v + 'th';
    },
    onInput: function (v) {
      p = v;
      c.redraw();
    },
  });
  var quick = el('div', 'ctl-actions');
  [
    ['Q1', 25],
    ['Q2', 50],
    ['Q3', 75],
    ['P95', 95],
    ['P99', 99],
  ].forEach(function (q) {
    quick.append(
      button(q[0], function () {
        p = q[1];
        sp.value = p;
        c.redraw();
      }),
    );
  });
  ctl.append(sel.el, sp.el, quick);

  var c = chart(host, {
    height: function (w) {
      return Math.round(Math.max(340, w * 0.68));
    },
    margin: { top: 14, right: 16, bottom: 30, left: 46 },
    draw: function (ctx) {
      var parts = src.split(':');
      var xs = data[parts[0]]
        .map(function (r) {
          return r[parts[1]];
        })
        .filter(function (v) {
          return !isMissing(v);
        });
      var s = sorted(xs);
      var xp = quantile(s, p / 100, true);
      var x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([0, ctx.innerW]);
      var h1 = ctx.innerH * 0.42;
      var h2 = ctx.innerH * 0.36;
      var gap = 14;
      // histogram panel
      var y1 = d3
        .scaleLinear()
        .domain([0, maxBinCount(xs, x.domain(), 30) * 1.1])
        .range([h1, 0]);
      var sub = { g: ctx.g.append('g'), innerH: h1, innerW: ctx.innerW, c: ctx.c };
      var b = bins(xs, x.domain(), 30);
      sub.g
        .selectAll('rect')
        .data(b)
        .join('rect')
        .attr('x', (d) => x(d.x0) + 1)
        .attr('width', (d) => Math.max(0, x(d.x1) - x(d.x0) - 2))
        .attr('y', (d) => y1(d.length))
        .attr('height', (d) => h1 - y1(d.length))
        .attr('rx', 2)
        .attr('fill', (d) => (d.x1 <= xp ? ctx.c.accent : ctx.c.text))
        .attr('opacity', (d) => (d.x1 <= xp ? 0.85 : 0.3));
      sub.g.append('g').attr('class', 'axis').call(d3.axisLeft(y1).ticks(3).tickSizeOuter(0));
      sub.g.append('text').attr('class', 'axis-label').attr('y', -2).text('frequency');
      // ECDF panel
      var top2 = h1 + gap;
      var y2 = d3
        .scaleLinear()
        .domain([0, 1])
        .range([top2 + h2, top2]);
      var g2 = ctx.g.append('g');
      g2.append('g')
        .attr('class', 'axis')
        .call(d3.axisLeft(y2).ticks(4).tickFormat(d3.format('.0%')).tickSizeOuter(0));
      var ecdf = Array.from(s).map(function (v, i) {
        return [v, (i + 1) / s.length];
      });
      g2.append('path')
        .datum(ecdf)
        .attr(
          'd',
          d3
            .line()
            .x((d) => x(d[0]))
            .y((d) => y2(d[1]))
            .curve(d3.curveStepAfter),
        )
        .attr('fill', 'none')
        .attr('stroke', ctx.c.text)
        .attr('stroke-width', 2);
      g2.append('line')
        .attr('x1', 0)
        .attr('x2', x(xp))
        .attr('y1', y2(p / 100))
        .attr('y2', y2(p / 100))
        .attr('stroke', ctx.c.accent)
        .attr('stroke-dasharray', '4 3');
      g2.append('circle')
        .attr('cx', x(xp))
        .attr('cy', y2(p / 100))
        .attr('r', 5)
        .attr('fill', ctx.c.accent);
      g2.append('text')
        .attr('class', 'axis-label')
        .attr('y', top2 - 2)
        .text('share of values ≤ x');
      // box panel
      var cy = top2 + h2 + (ctx.innerH - top2 - h2) / 2 + 2;
      var bs = boxplot(ctx, xs, { x: x, cy: cy, h: 18, color: ctx.c.series[1] });
      // x axis + xp line through all panels
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(
          d3
            .axisBottom(x)
            .ticks(Math.floor(ctx.innerW / 80))
            .tickFormat(d3.format('~s')),
        );
      vline(ctx, x, xp, 'x' + '₍' + p + '₎ = ' + fmt(xp, 1), ctx.c.accent, { dash: '2 3', dy: -2 });
      var below = Array.from(s).filter(function (v) {
        return v < xp;
      }).length;
      set([
        { k: 'x_p', v: fmt(xp, 1), hot: true },
        { k: 'Below x_p', v: fmt((below / s.length) * 100, 1) + '%' },
        { k: 'Q1', v: fmt(bs.q1, 1), color: seriesVar(1) },
        { k: 'Q2 (median)', v: fmt(bs.q2, 1), color: seriesVar(1) },
        { k: 'Q3', v: fmt(bs.q3, 1), color: seriesVar(1) },
        { k: 'IQR', v: fmt(bs.iqr, 1) },
        { k: 'Outliers', v: bs.outliers.length, hot: bs.outliers.length > 0 },
      ]);
    },
  });
}

/* ---- 1.7 powers of deviations ------------------------------------------- */

function powers() {
  var host = document.getElementById('power-chart');
  var ctl = document.getElementById('power-controls');
  var set = readout(document.getElementById('power-readout'));
  var BASE = [2, 3, 3.5, 4, 4.5, 5, 5, 5.5, 6, 7, 8];
  var tail = 13;
  var k = 3;
  var seg = segmented({
    label: 'Power',
    value: String(k),
    options: [
      { value: '1', label: '1st' },
      { value: '2', label: '2nd' },
      { value: '3', label: '3rd' },
      { value: '4', label: '4th' },
    ],
    onChange: function (v) {
      k = Number(v);
      c.redraw();
    },
  });
  var st = slider({
    label: 'Right-tail value',
    min: 5,
    max: 25,
    step: 0.5,
    value: tail,
    onInput: function (v) {
      tail = v;
      c.redraw();
    },
  });
  ctl.append(
    seg.el,
    st.el,
    el(
      'p',
      'ctl-note',
      'Power 1 always sums to 0. Power 2 loses the sign. Power 3 keeps it: the long right tail wins and the sum turns positive.',
    ),
  );
  var c = chart(host, {
    aspect: 0.5,
    margin: { top: 16, right: 12, bottom: 30, left: 50 },
    draw: function (ctx) {
      var xs = BASE.concat([tail]).sort(function (a, b) {
        return a - b;
      });
      var m = mean(xs);
      var dev = xs.map(function (v) {
        return Math.pow(v - m, k);
      });
      var x = d3.scaleBand().domain(d3.range(xs.length)).range([0, ctx.innerW]).padding(0.2);
      var ext = d3.extent(dev.concat([0]));
      var y = d3.scaleLinear().domain(ext).nice().range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xAxis: d3.axisBottom(x).tickFormat(function (i) {
          return fmt(xs[i], 1);
        }),
        yAxis: d3.axisLeft(y).ticks(5).tickFormat(d3.format('~s')),
        xLabel: 'x_i (sorted)',
        yLabel: '(x_i − x̄)^' + k,
      });
      ctx.g
        .append('line')
        .attr('x1', 0)
        .attr('x2', ctx.innerW)
        .attr('y1', y(0))
        .attr('y2', y(0))
        .attr('stroke', ctx.c.strong);
      ctx.g
        .selectAll('rect.d')
        .data(dev)
        .join('rect')
        .attr('x', (d, i) => x(i))
        .attr('width', x.bandwidth())
        .attr('y', (d) => y(Math.max(0, d)))
        .attr('height', (d) => Math.max(1, Math.abs(y(d) - y(0))))
        .attr('rx', 2)
        .attr('fill', (d) => (d >= 0 ? ctx.c.accent : ctx.c.series[1]))
        .on('pointerenter', function (e, d) {
          showTip(e, '(x − x̄)^' + k + ' = <b>' + fmt(d, 3) + '</b>');
        })
        .on('pointerleave', hideTip);
      var sumv = d3.sum(dev);
      set([
        { k: 'x̄', v: fmt(m, 2) },
        { k: 'Σ (x−x̄)^' + k, v: fmt(sumv, 2), hot: true },
        { k: 'Skewness γ', v: fmt(skewness(xs), 3) },
        { k: 'Kurtosis κ', v: fmt(kurtosis(xs), 3) },
      ]);
    },
  });
}

/* ---- 1.7 skewness -------------------------------------------------------- */

function skewLab() {
  var host = document.getElementById('skew-chart');
  var ctl = document.getElementById('skew-controls');
  var set = readout(document.getElementById('skew-readout'));
  var N = 1500;
  var alpha = 4;
  var cache = new Map();
  function sample(a) {
    var key = a.toFixed(2);
    if (!cache.has(key)) cache.set(key, rescale(skewNormal(N, a, 29), 50, 10));
    return cache.get(key);
  }
  var sa = slider({
    label: 'Shape α',
    min: -10,
    max: 10,
    step: 0.25,
    value: alpha,
    onInput: function (v) {
      alpha = v;
      c.redraw();
    },
  });
  // presets that reproduce the slide's three examples
  function solve(target) {
    var lo = target < 0 ? -20 : 0;
    var hi = target < 0 ? 0 : 20;
    for (var i = 0; i < 30; i++) {
      var mid = (lo + hi) / 2;
      var gm = skewness(skewNormal(N, mid, 29));
      if (gm < target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  var presets = el('div', 'ctl-actions');
  [-0.8226, -0.2071, 0.9127].forEach(function (tg) {
    presets.append(
      button('γ ≈ ' + tg, function () {
        alpha = Math.round(solve(tg) * 100) / 100;
        sa.value = alpha;
        c.redraw();
      }),
    );
  });
  ctl.append(
    sa.el,
    el('span', 'ctl__label', 'The slide examples'),
    presets,
    el(
      'p',
      'ctl-note',
      'Watch the mean chase the long tail while the median stays with the bulk of the data.',
    ),
  );
  var c = chart(host, {
    aspect: 0.55,
    margin: { top: 22, right: 14, bottom: 30, left: 40 },
    draw: function (ctx) {
      var xs = sample(alpha);
      var x = d3.scaleLinear().domain([10, 90]).range([0, ctx.innerW]);
      var y = d3
        .scaleLinear()
        .domain([0, maxBinCount(xs, x.domain(), 40) * 1.15])
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, { yLabel: 'frequency' });
      histogram(ctx, xs, { x: x, y: y, bins: 40, color: ctx.c.text, opacity: 0.35 });
      var bw = (x.domain()[1] - x.domain()[0]) / 40;
      density(ctx, xs, { x: x, y: y, color: ctx.c.text, scale: xs.length * bw * 0.97 });
      var m = mean(xs);
      var md = median(xs);
      vline(ctx, x, m, 'mean', ctx.c.series[1], { dash: '4 3', dy: -6 });
      vline(ctx, x, md, 'median', ctx.c.accent, { dy: 8 });
      var gm = skewness(xs);
      set([
        { k: 'γ', v: fmt(gm, 4), hot: true },
        {
          k: 'Reading',
          v:
            '<span style="font-size:0.95rem">' +
            (Math.abs(gm) < 0.1 ? 'symmetric' : gm > 0 ? 'longer right tail' : 'longer left tail') +
            '</span>',
        },
        { k: 'Mean', v: fmt(m, 2), color: seriesVar(1) },
        { k: 'Median', v: fmt(md, 2) },
      ]);
    },
  });
}

/* ---- 1.8 4th-power magnifier --------------------------------------------- */

function magnifier() {
  var host = document.getElementById('mag-chart');
  var ctl = document.getElementById('mag-controls');
  var z = 2;
  var sz = slider({
    label: 'Distance from the mean',
    min: 0,
    max: 3.5,
    step: 0.1,
    value: z,
    format: function (v) {
      return v.toFixed(1) + 'σ';
    },
    onInput: function (v) {
      z = v;
      c.redraw();
    },
  });
  var out = el('div');
  ctl.append(sz.el, out);
  var set = readout(out);
  var c = chart(host, {
    aspect: 0.5,
    margin: { top: 18, right: 22, bottom: 34, left: 44 },
    draw: function (ctx) {
      var x = d3.scaleLinear().domain([0, 3.5]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([0, 100]).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xAxis: d3
          .axisBottom(x)
          .ticks(7)
          .tickFormat((d) => d + 'σ'),
        xLabel: '|x − x̄| / σ',
        yLabel: 'contribution',
      });
      var grid = d3.range(0, 3.51, 0.05);
      [
        [2, ctx.c.series[1], 'squared (variance)'],
        [4, ctx.c.accent, '4th power (kurtosis)'],
      ].forEach(function (p) {
        ctx.g
          .append('path')
          .datum(grid)
          .attr(
            'd',
            d3
              .line()
              .x((d) => x(d))
              .y((d) => y(Math.min(100, Math.pow(d, p[0])))),
          )
          .attr('fill', 'none')
          .attr('stroke', p[1])
          .attr('stroke-width', 2.5);
        var v = Math.pow(z, p[0]);
        ctx.g
          .append('circle')
          .attr('cx', x(z))
          .attr('cy', y(Math.min(100, v)))
          .attr('r', 6)
          .attr('fill', p[1])
          .attr('stroke', ctx.c.surface)
          .attr('stroke-width', 2);
      });
      legend(
        ctx,
        [
          { label: 'x²', color: ctx.c.series[1] },
          { label: 'x⁴', color: ctx.c.accent },
        ],
        { left: true, y: 16 },
      );
      [1, 2, 3].forEach(function (k) {
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', x(k))
          .attr('y', y(Math.min(100, Math.pow(k, 4))) - 10)
          .attr('text-anchor', 'middle')
          .text(Math.pow(k, 4));
      });
      set([
        { k: 'z²', v: fmt(z * z, 2), color: seriesVar(1), hot: true },
        { k: 'z⁴', v: fmt(Math.pow(z, 4), 2), hot: true },
        { k: 'z⁴ / z²', v: fmt(z * z, 2) + '×' },
      ]);
    },
  });
}

/* ---- 1.8 kurtosis -------------------------------------------------------- */

function kurtLab() {
  var host = document.getElementById('kurt-chart');
  var ctl = document.getElementById('kurt-controls');
  var set = readout(document.getElementById('kurt-readout'));
  var N = 2000;
  var beta = 2;
  var cache = new Map();
  function sample(b) {
    var key = b.toFixed(2);
    if (!cache.has(key)) cache.set(key, genNormal(N, b, 33));
    return cache.get(key);
  }
  function solve(target) {
    // kurtosis decreases with β
    var lo = 0.6;
    var hi = 12;
    for (var i = 0; i < 28; i++) {
      var mid = (lo + hi) / 2;
      if (kurtosis(genNormal(N, mid, 33)) > target) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  }
  var sb = slider({
    label: 'Shape β (tail lightness)',
    min: 0.7,
    max: 12,
    step: 0.05,
    value: beta,
    onInput: function (v) {
      beta = v;
      c.redraw();
    },
  });
  var presets = el('div', 'ctl-actions');
  [
    ['Dataset 1', 1.8631],
    ['Dataset 2', 2.991],
    ['Dataset 3', 5.8157],
  ].forEach(function (p) {
    presets.append(
      button(p[0] + ' · κ ' + p[1], function () {
        beta = Math.round(solve(p[1]) * 100) / 100;
        sb.value = beta;
        c.redraw();
      }),
    );
  });
  var showNormal = toggle({
    label: 'Normal reference curve',
    checked: true,
    onChange: function () {
      c.redraw();
    },
  });
  ctl.append(
    sb.el,
    el('span', 'ctl__label', 'The slide examples'),
    presets,
    showNormal.el,
    el(
      'p',
      'ctl-note',
      'All samples have mean 10, σ 2 and skewness 0. Only kurtosis tells them apart: Dataset 3 has more values close to the mean and more beyond ±2.5σ.',
    ),
  );
  var c = chart(host, {
    aspect: 0.55,
    margin: { top: 18, right: 14, bottom: 30, left: 44 },
    draw: function (ctx) {
      var xs = sample(beta);
      var x = d3.scaleLinear().domain([0, 20]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([0, 0.42]).range([ctx.innerH, 0]);
      axes(ctx, x, y, { yLabel: 'density' });
      [10 - 5, 10 + 5].forEach(function (v) {
        ctx.g
          .append('rect')
          .attr('x', v < 10 ? 0 : x(v))
          .attr('width', v < 10 ? x(v) : ctx.innerW - x(v))
          .attr('y', 0)
          .attr('height', ctx.innerH)
          .attr('fill', ctx.c.accent)
          .attr('opacity', 0.06);
      });
      histogram(ctx, xs, {
        x: x,
        y: y,
        bins: 50,
        density: true,
        color: ctx.c.text,
        opacity: 0.4,
      });
      if (showNormal.value) {
        var grid = d3.range(0, 20.01, 0.1);
        ctx.g
          .append('path')
          .datum(grid)
          .attr(
            'd',
            d3
              .line()
              .x((d) => x(d))
              .y((d) => y(Math.exp(-((d - 10) * (d - 10)) / 8) / (2 * Math.sqrt(2 * Math.PI)))),
          )
          .attr('fill', 'none')
          .attr('stroke', ctx.c.series[1])
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '5 4');
      }
      ctx.g
        .append('text')
        .attr('class', 'label label--accent')
        .attr('x', x(15) + 4)
        .attr('y', 14)
        .text('beyond +2.5σ');
      var k = kurtosis(xs);
      var beyond =
        xs.filter(function (v) {
          return Math.abs(v - 10) > 5;
        }).length / xs.length;
      set([
        { k: 'Mean', v: fmt(mean(xs), 2) },
        { k: 'σ', v: fmt(std(xs), 2) },
        { k: 'Skewness', v: fmt(skewness(xs), 3) },
        { k: 'Kurtosis κ', v: fmt(k, 4), hot: true },
        { k: 'Excess κ − 3', v: fmt(k - 3, 3) },
        { k: 'Beyond ±2.5σ', v: fmt(beyond * 100, 1) + '%', hot: true },
        {
          k: 'Type',
          v:
            '<span style="font-size:0.95rem">' +
            (Math.abs(k - 3) < 0.15 ? 'mesokurtic' : k > 3 ? 'leptokurtic' : 'platykurtic') +
            '</span>',
        },
      ]);
    },
  });
}

/* ---- 1.9 granularity ----------------------------------------------------- */

function granularity(rows) {
  var host = document.getElementById('gran-chart');
  var ctl = document.getElementById('gran-controls');
  var level = 'region';
  var seg = segmented({
    label: 'Level of detail',
    value: level,
    options: [
      { value: 'all', label: 'Overall' },
      { value: 'region', label: 'Region' },
      { value: 'region-sex', label: 'Region × sex' },
      { value: 'raw', label: 'Customer' },
    ],
    onChange: function (v) {
      level = v;
      c.redraw();
      note.innerHTML = NOTES[v];
    },
  });
  var NOTES = {
    all: 'One number: the average income. Every pattern is hidden.',
    region: 'Averages per region: comparable, but the spread within each region is gone.',
    'region-sex': 'Finer groups: more detail, fewer customers behind each bar.',
    raw: 'Raw data: every customer. Patterns and noise are both visible.',
  };
  var note = el('p', 'ctl-note', NOTES[level]);
  ctl.append(seg.el, note);
  var regions = ['INNER_CITY', 'TOWN', 'RURAL', 'SUBURBAN'];
  var c = chart(host, {
    aspect: 0.5,
    margin: { top: 22, right: 14, bottom: 34, left: 56 },
    draw: function (ctx) {
      var y = d3.scaleLinear().domain([0, 65000]).range([ctx.innerH, 0]);
      var groups;
      if (level === 'all') groups = [{ key: 'all customers', rows: rows }];
      else if (level === 'region' || level === 'raw')
        groups = regions.map(function (r) {
          return {
            key: r,
            rows: rows.filter(function (d) {
              return d.region === r;
            }),
          };
        });
      else groups = [];
      if (level === 'region-sex') {
        regions.forEach(function (r) {
          ['FEMALE', 'MALE'].forEach(function (s) {
            groups.push({
              key: r.replace('_', ' ').toLowerCase().slice(0, 5) + ' ' + s[0],
              sex: s,
              rows: rows.filter(function (d) {
                return d.region === r && d.sex === s;
              }),
            });
          });
        });
      }
      var x = d3
        .scaleBand()
        .domain(groups.map((g) => g.key))
        .range([0, ctx.innerW])
        .padding(0.25);
      axes(ctx, x, y, {
        yAxis: d3.axisLeft(y).tickFormat(d3.format('~s')),
        yLabel: 'income',
        xAxis: d3.axisBottom(x).tickFormat((t) => t.replace('_', ' ').toLowerCase()),
      });
      var r = rng(4);
      groups.forEach(function (g, i) {
        var m = mean(
          g.rows.map(function (d) {
            return d.income;
          }),
        );
        var col = g.sex === 'MALE' ? ctx.c.series[1] : ctx.c.text;
        if (level === 'raw') {
          ctx.g
            .append('g')
            .selectAll('circle')
            .data(g.rows)
            .join('circle')
            .attr('cx', () => x(g.key) + x.bandwidth() * (0.1 + 0.8 * r()))
            .attr('cy', (d) => y(d.income))
            .attr('r', 2.5)
            .attr('fill', ctx.c.text)
            .attr('opacity', 0.4);
        } else {
          ctx.g
            .append('rect')
            .attr('x', x(g.key))
            .attr('width', x.bandwidth())
            .attr('y', y(m))
            .attr('height', ctx.innerH - y(m))
            .attr('rx', 3)
            .attr('fill', level === 'all' ? ctx.c.accent : col)
            .attr('opacity', 0.75)
            .on('pointerenter', function (e) {
              showTip(e, '<b>' + g.key + '</b><br>mean ' + fmt(m, 0) + ' · n = ' + g.rows.length);
            })
            .on('pointerleave', hideTip);
          ctx.g
            .append('text')
            .attr('class', 'label')
            .attr('x', x(g.key) + x.bandwidth() / 2)
            .attr('y', y(m) - 5)
            .attr('text-anchor', 'middle')
            .text(d3.format('.3s')(m));
        }
        void i;
      });
      if (level === 'region-sex')
        legend(ctx, [
          { label: 'female', color: ctx.c.text },
          { label: 'male', color: ctx.c.series[1] },
        ]);
    },
  });
}

/* ---- 1.9 missing values -------------------------------------------------- */

function missing(rows) {
  var host = document.getElementById('missing-chart');
  var foot = document.getElementById('missing-foot');
  var cols = rows.columns.filter(function (c) {
    return c !== 'PassengerId';
  });
  var data = cols.map(function (c) {
    var m = rows.filter(function (r) {
      return isMissing(r[c]);
    }).length;
    return { col: c, m: m, p: m / rows.length };
  });
  foot.innerHTML =
    'Of 891 passengers, <strong>Cabin</strong> is missing for 77%, <strong>Age</strong> for 20%, <strong>Embarked</strong> for 2 people. Every other attribute is complete.';
  chart(host, {
    aspect: 0.38,
    height: function (w) {
      return w < 500 ? 300 : Math.round(w * 0.34);
    },
    margin: { top: 10, right: 50, bottom: 28, left: 78 },
    draw: function (ctx) {
      var y = d3
        .scaleBand()
        .domain(data.map((d) => d.col))
        .range([0, ctx.innerH])
        .padding(0.25);
      var x = d3.scaleLinear().domain([0, 1]).range([0, ctx.innerW]);
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('.0%')));
      ctx.g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0));
      ctx.g
        .selectAll('rect.bg')
        .data(data)
        .join('rect')
        .attr('x', 0)
        .attr('width', ctx.innerW)
        .attr('y', (d) => y(d.col))
        .attr('height', y.bandwidth())
        .attr('rx', 3)
        .attr('fill', ctx.c.line)
        .attr('opacity', 0.5);
      ctx.g
        .selectAll('rect.v')
        .data(data)
        .join('rect')
        .attr('x', 0)
        .attr('width', (d) => (d.m ? Math.max(3, x(d.p)) : 0))
        .attr('y', (d) => y(d.col))
        .attr('height', y.bandwidth())
        .attr('rx', 3)
        .attr('fill', ctx.c.accent);
      ctx.g
        .selectAll('text.v')
        .data(data)
        .join('text')
        .attr('class', 'label')
        .attr('x', (d) => (d.m ? Math.max(3, x(d.p)) + 6 : 6))
        .attr('y', (d) => y(d.col) + y.bandwidth() / 2 + 4)
        .text((d) => (d.m ? d.m + ' · ' + d3.format('.1%')(d.p) : 'complete'));
    },
  });
}

/* ---- 1.10 explorer ------------------------------------------------------- */

function explorer(rows) {
  var host = document.getElementById('exp-chart');
  var ctl = document.getElementById('exp-controls');
  var typeEl = document.getElementById('exp-type');
  var titleEl = document.getElementById('exp-title-lab');
  var set = readout(document.getElementById('exp-readout'));
  var attr = 'income';
  var nbins = 24;
  var attrs = BANK_ATTRS.filter(function (a) {
    return a.key !== 'id';
  });
  var sel = select({
    label: 'Attribute',
    value: attr,
    options: attrs.map(function (a) {
      return { value: a.key, label: a.label };
    }),
    onChange: function (v) {
      attr = v;
      sync();
      c.redraw();
    },
  });
  var sb = slider({
    label: 'Histogram bins',
    min: 4,
    max: 60,
    value: nbins,
    onInput: function (v) {
      nbins = v;
      c.redraw();
    },
  });
  var tk = toggle({ label: 'Density (KDE)', checked: true, onChange: () => c.redraw() });
  var tm = toggle({ label: 'Mean & median', checked: true, onChange: () => c.redraw() });
  var tb = toggle({ label: 'Box plot', checked: true, onChange: () => c.redraw() });
  var numCtl = el('div', 'ctl');
  numCtl.style.gap = '1rem';
  numCtl.append(sb.el, tk.el, tm.el, tb.el);
  ctl.append(sel.el, numCtl);

  function isNum() {
    return NUMERIC.bank.indexOf(attr) >= 0;
  }
  function sync() {
    numCtl.hidden = !isNum();
    var a = BANK_ATTRS.find((d) => d.key === attr);
    typeEl.textContent = a.type + (isNum() ? ' · numerical' : ' · categorical');
    titleEl.textContent = a.label + ': ' + a.desc;
  }
  sync();

  var c = chart(host, {
    aspect: 0.6,
    margin: { top: 22, right: 16, bottom: 30, left: 46 },
    draw: function (ctx) {
      if (!isNum()) {
        var cnt = counts(rows, attr);
        var entries = Array.from(cnt.map.entries()).sort((a, b) => b[1] - a[1]);
        var x = d3
          .scaleBand()
          .domain(entries.map((e) => e[0]))
          .range([0, ctx.innerW])
          .padding(0.25);
        var y = d3
          .scaleLinear()
          .domain([0, d3.max(entries, (e) => e[1]) * 1.1])
          .range([ctx.innerH, 0]);
        axes(ctx, x, y, { yLabel: 'count' });
        ctx.g
          .selectAll('rect')
          .data(entries)
          .join('rect')
          .attr('x', (d) => x(d[0]))
          .attr('width', x.bandwidth())
          .attr('y', (d) => y(d[1]))
          .attr('height', (d) => ctx.innerH - y(d[1]))
          .attr('rx', 3)
          .attr('fill', (d, i) => (i === 0 ? ctx.c.accent : ctx.c.text))
          .attr('opacity', (d, i) => (i === 0 ? 1 : 0.55));
        ctx.g
          .selectAll('text.v')
          .data(entries)
          .join('text')
          .attr('class', 'label')
          .attr('x', (d) => x(d[0]) + x.bandwidth() / 2)
          .attr('y', (d) => y(d[1]) - 5)
          .attr('text-anchor', 'middle')
          .text((d) => d[1] + ' · ' + d3.format('.0%')(d[1] / rows.length));
        set([
          { k: 'Instances', v: rows.length },
          { k: 'Cardinality', v: entries.length },
          { k: 'Mode', v: entries[0][0], hot: true },
          { k: 'Mode freq.', v: d3.format('.1%')(entries[0][1] / rows.length) },
          { k: 'Missing', v: cnt.missing },
        ]);
        return;
      }
      var xs = rows.map((r) => r[attr]);
      var s = summary(xs);
      var discrete = attr === 'children';
      var dom = discrete ? [-0.5, 3.5] : d3.extent(xs);
      var x2 = d3.scaleLinear().domain(dom).nice().range([0, ctx.innerW]);
      var boxH = tb.value ? 46 : 0;
      var histH = ctx.innerH - boxH;
      var b = discrete
        ? d3.bin().domain([-0.5, 3.5]).thresholds([0.5, 1.5, 2.5])(xs)
        : bins(xs, x2.domain(), nbins);
      var y2 = d3
        .scaleLinear()
        .domain([0, d3.max(b, (d) => d.length) * 1.15])
        .range([histH, 0]);
      var sub = Object.assign({}, ctx, { innerH: histH });
      axes(sub, x2, y2, {
        xAxis: d3.axisBottom(x2).tickFormat(d3.format('~s')),
        yLabel: 'count',
      });
      ctx.g.select('.axis').attr('transform', 'translate(0,' + ctx.innerH + ')');
      histogram(sub, xs, {
        x: x2,
        y: y2,
        binsData: b,
        color: ctx.c.text,
        opacity: 0.4,
        label: attr,
      });
      if (tk.value && !discrete) {
        var bw = (x2.domain()[1] - x2.domain()[0]) / nbins;
        density(sub, xs, { x: x2, y: y2, color: ctx.c.text, scale: xs.length * bw });
      }
      if (tm.value) {
        vline(sub, x2, s.mean, 'mean', ctx.c.series[1], { dash: '4 3', dy: -6 });
        vline(sub, x2, s.median, 'median', ctx.c.accent, { dy: 8 });
      }
      if (tb.value) {
        boxplot(ctx, xs, { x: x2, cy: histH + boxH / 2 + 2, h: 20, color: ctx.c.series[1] });
      }
      set([
        { k: 'Count', v: s.n },
        { k: 'Mean', v: fmt(s.mean, 2), color: seriesVar(1), hot: true },
        { k: 'Median', v: fmt(s.median, 2), hot: true },
        { k: 'Mode', v: fmt(s.mode, 2) },
        { k: 'Min', v: fmt(s.min, 2) },
        { k: 'Max', v: fmt(s.max, 2) },
        { k: 'Q1', v: fmt(s.q1, 2) },
        { k: 'Q3', v: fmt(s.q3, 2) },
        { k: 'P5', v: fmt(s.p5, 2) },
        { k: 'P95', v: fmt(s.p95, 2) },
        { k: 'Range', v: fmt(s.range, 2) },
        { k: 'Variance', v: fmt(s.variance, 2) },
        { k: 'Std dev', v: fmt(s.std, 2) },
        { k: 'IQR', v: fmt(s.iqr, 2) },
        { k: 'MAD', v: fmt(s.mad, 2) },
        { k: 'AAD', v: fmt(s.aad, 2) },
        { k: 'Skewness', v: fmt(s.skew, 3) },
        { k: 'Kurtosis', v: fmt(s.kurt, 3) },
        { k: 'Missing', v: 0 },
      ]);
    },
  });
}
