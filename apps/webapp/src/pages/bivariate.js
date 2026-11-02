import { shell, onReady } from '../scripts/shell.js';
import { initArt } from '../scripts/art.js';
import {
  chart,
  axes,
  d3,
  showTip,
  hideTip,
  legend,
  colors,
  seriesVar,
  dragNearest,
} from '../lib/chart.js';
import { slider, segmented, select, toggle, button, readout, el } from '../lib/ui.js';
import { loadCsv } from '../lib/data.js';
import { density, boxplot } from '../lib/plots.js';
import {
  mean,
  std,
  pearson,
  spearman,
  ranks,
  covariance,
  partialCorrelation,
  residuals,
  mutualInformation,
  binIndex,
  normalQuantile,
  rng,
  normalSampler,
  gaussianKde,
  silverman,
  fmt,
} from '../lib/stats.js';

shell();

onReady(function () {
  initArt(document.getElementById('art'), 'pairs');
  Promise.all([loadCsv('bank-data.csv'), loadCsv('iris.csv'), loadCsv('titanic.csv')]).then(
    function (d) {
      contCont(d[0]);
      pairPlot(d[0]);
      catNum(d[0]);
      stacked(d[0]);
      slicing(d[0]);
      irisMatrix(d[1]);
      titanic(d[2]);
    },
  );
  sandbox();
  rhoGrid();
  guessGame();
  rankViz();
  worked();
  versus();
  chance();
  dag();
  iceCream();
  trend();
  rain();
  shapes();
});

/* ---- helpers ------------------------------------------------------------ */

var PEP_KEYS = ['YES', 'NO'];

function pepColor(c, v) {
  return v === 'YES' ? c.series[0] : c.series[1];
}

/** Correlated standard normal pairs with population correlation ρ */
function corrPairs(n, rho, seed) {
  var g = normalSampler(rng(seed));
  var out = [];
  for (var i = 0; i < n; i++) {
    var a = g();
    var b = g();
    out.push([a, rho * a + Math.sqrt(1 - rho * rho) * b]);
  }
  return out;
}

function pad(ext, f) {
  var d = (ext[1] - ext[0]) * (f || 0.06) || 1;
  return [ext[0] - d, ext[1] + d];
}

function rText(r) {
  return fmt(r, 2);
}

/* ---- 2.2 continuous vs continuous --------------------------------------- */

function contCont(rows) {
  var host = document.getElementById('cc-chart');
  var ctl = document.getElementById('cc-controls');
  var view = 'scatter';
  var mult = 1;
  var seg = segmented({
    label: 'View',
    value: view,
    options: [
      { value: 'scatter', label: 'Scatter' },
      { value: 'heat', label: 'Heatmap' },
      { value: 'density', label: 'Density' },
    ],
    onChange: function (v) {
      view = v;
      c.redraw();
    },
  });
  var sm = slider({
    label: 'Pretend we had more customers',
    min: 1,
    max: 40,
    value: mult,
    format: function (v) {
      return (v * rows.length).toLocaleString('en-US') + ' pts';
    },
    onInput: function (v) {
      mult = v;
      c.redraw();
    },
  });
  ctl.append(
    seg.el,
    sm.el,
    el(
      'p',
      'ctl-note',
      'Push the slider up in scatter view: points pile into an unreadable blob. The heatmap aggregates and keeps working at any size.',
    ),
  );
  var g = normalSampler(rng(8));
  var big = [];
  for (var k = 0; k < 40; k++) {
    rows.forEach(function (r) {
      big.push({
        age: k ? r.age + g() * 2.5 : r.age,
        income: k ? r.income + g() * 1800 : r.income,
        pep: r.pep,
      });
    });
  }
  var c = chart(host, {
    aspect: 0.62,
    margin: { top: 24, right: 14, bottom: 34, left: 52 },
    draw: function (ctx) {
      var data = big.slice(0, rows.length * mult);
      var x = d3.scaleLinear().domain([15, 70]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([0, 70000]).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        yAxis: d3.axisLeft(y).tickFormat(d3.format('~s')),
        xLabel: 'age',
        yLabel: 'income',
      });
      if (view === 'scatter') {
        var r = mult > 10 ? 1.6 : mult > 3 ? 2.2 : 3.2;
        ctx.g
          .append('g')
          .selectAll('circle')
          .data(data)
          .join('circle')
          .attr('cx', (d) => x(d.age))
          .attr('cy', (d) => y(d.income))
          .attr('r', r)
          .attr('fill', (d) => pepColor(ctx.c, d.pep))
          .attr('opacity', mult > 10 ? 0.5 : 0.75);
      } else if (view === 'heat') {
        var nx = 22;
        var ny = 16;
        var grid = new Array(nx * ny).fill(0);
        data.forEach(function (d) {
          var i = Math.floor(((d.age - 15) / 55) * nx);
          var j = Math.floor((d.income / 70000) * ny);
          if (i >= 0 && i < nx && j >= 0 && j < ny) grid[j * nx + i]++;
        });
        var mx = d3.max(grid);
        var cw = ctx.innerW / nx;
        var ch = ctx.innerH / ny;
        ctx.g
          .append('g')
          .selectAll('rect')
          .data(grid)
          .join('rect')
          .attr('x', (d, k2) => (k2 % nx) * cw + 1)
          .attr('y', (d, k2) => ctx.innerH - (Math.floor(k2 / nx) + 1) * ch + 1)
          .attr('width', cw - 2)
          .attr('height', ch - 2)
          .attr('rx', 2)
          .attr('fill', (d) => (d ? ctx.c.sequential(Math.sqrt(d / mx)) : 'transparent'))
          .on('pointerenter', function (e, d) {
            showTip(e, '<b>' + d + '</b> customers in this cell');
          })
          .on('pointerleave', hideTip);
      } else {
        PEP_KEYS.forEach(function (key) {
          var sub = data.filter((d) => d.pep === key);
          var cont = d3
            .contourDensity()
            .x((d) => x(d.age))
            .y((d) => y(d.income))
            .size([ctx.innerW, ctx.innerH])
            .bandwidth(18)
            .thresholds(8)(sub);
          ctx.g
            .append('g')
            .selectAll('path')
            .data(cont)
            .join('path')
            .attr('d', d3.geoPath())
            .attr('fill', pepColor(ctx.c, key))
            .attr('fill-opacity', 0.07)
            .attr('stroke', pepColor(ctx.c, key))
            .attr('stroke-opacity', 0.6);
        });
      }
      if (view !== 'heat')
        legend(ctx, [
          { label: 'PEP yes', color: ctx.c.series[0] },
          { label: 'PEP no', color: ctx.c.series[1] },
        ]);
    },
  });
}

/* ---- 2.2 pair plot ------------------------------------------------------- */

function pairPlot(rows) {
  var host = document.getElementById('pairplot');
  var attrs = ['age', 'income', 'children'];
  chart(host, {
    height: function (w) {
      return Math.min(w, 640);
    },
    margin: { top: 24, right: 8, bottom: 30, left: 48 },
    draw: function (ctx) {
      var n = attrs.length;
      var gap = 10;
      var size = (Math.min(ctx.innerW, ctx.innerH) - gap * (n - 1)) / n;
      var offX = (ctx.innerW - (size * n + gap * (n - 1))) / 2;
      var scales = attrs.map(function (a) {
        return d3
          .scaleLinear()
          .domain(
            pad(
              d3.extent(rows, (r) => r[a]),
              0.08,
            ),
          )
          .range([0, size]);
      });
      var jitter = rng(2);
      var jit = rows.map(function () {
        return [(jitter() - 0.5) * 0.3, (jitter() - 0.5) * 0.3];
      });
      attrs.forEach(function (ay, i) {
        attrs.forEach(function (ax, j) {
          var g = ctx.g
            .append('g')
            .attr(
              'transform',
              'translate(' + (offX + j * (size + gap)) + ',' + i * (size + gap) + ')',
            );
          g.append('rect')
            .attr('width', size)
            .attr('height', size)
            .attr('fill', 'none')
            .attr('stroke', ctx.c.line);
          var sx = scales[j];
          if (i === j) {
            PEP_KEYS.forEach(function (key) {
              var xs = rows.filter((r) => r.pep === key).map((r) => r[ax]);
              var dom = sx.domain();
              var grid = d3.range(0, 61).map((k) => dom[0] + ((dom[1] - dom[0]) * k) / 60);
              var bw = ax === 'children' ? 0.25 : silverman(xs);
              var pts = gaussianKde(xs, bw, grid);
              var yd = d3
                .scaleLinear()
                .domain([0, d3.max(pts, (p) => p[1]) * 1.15])
                .range([size, 0]);
              g.append('path')
                .datum(pts)
                .attr(
                  'd',
                  d3
                    .area()
                    .x((p) => sx(p[0]))
                    .y0(size)
                    .y1((p) => yd(p[1]))
                    .curve(d3.curveBasis),
                )
                .attr('fill', pepColor(ctx.c, key))
                .attr('fill-opacity', 0.25)
                .attr('stroke', pepColor(ctx.c, key))
                .attr('stroke-width', 1.5);
            });
            g.append('text').attr('class', 'label').attr('x', 6).attr('y', 14).text(ax);
          } else {
            var sy = scales[i].copy().range([size, 0]);
            g.append('g')
              .selectAll('circle')
              .data(rows)
              .join('circle')
              .attr('cx', (r, k) => sx(r[ax] + (ax === 'children' ? jit[k][0] : 0)))
              .attr('cy', (r, k) => sy(r[ay] + (ay === 'children' ? jit[k][1] : 0)))
              .attr('r', size > 150 ? 2 : 1.4)
              .attr('fill', (r) => pepColor(ctx.c, r.pep))
              .attr('opacity', 0.6);
            var rr = pearson(
              rows.map((r) => r[ax]),
              rows.map((r) => r[ay]),
            );
            g.append('rect')
              .attr('class', 'hit')
              .attr('width', size)
              .attr('height', size)
              .on('pointerenter', function (e) {
                showTip(e, '<b>' + ay + ' vs ' + ax + '</b><br>Pearson r = ' + fmt(rr, 3));
              })
              .on('pointerleave', hideTip);
          }
          if (i === n - 1)
            g.append('g')
              .attr('class', 'axis')
              .attr('transform', 'translate(0,' + size + ')')
              .call(d3.axisBottom(sx).ticks(3).tickFormat(d3.format('~s')));
          if (j === 0 && i !== 0)
            g.append('g')
              .attr('class', 'axis')
              .call(
                d3
                  .axisLeft(scales[i].copy().range([size, 0]))
                  .ticks(3)
                  .tickFormat(d3.format('~s')),
              );
        });
      });
      legend(
        ctx,
        [
          { label: 'PEP yes', color: ctx.c.series[0] },
          { label: 'PEP no', color: ctx.c.series[1] },
        ],
        { y: -12 },
      );
    },
  });
}

/* ---- 2.2 categorical vs numeric ----------------------------------------- */

function catNum(rows) {
  var host = document.getElementById('catnum-chart');
  var ctl = document.getElementById('catnum-controls');
  var cat = 'region';
  var num = 'income';
  var view = 'box';
  var CATS = ['region', 'sex', 'married', 'car', 'save_act', 'current_act', 'mortgage', 'pep'];
  var sc = select({
    label: 'Category',
    value: cat,
    options: CATS.map((k) => ({ value: k, label: k })),
    onChange: function (v) {
      cat = v;
      c.redraw();
    },
  });
  var sn = select({
    label: 'Number',
    value: num,
    options: ['income', 'age', 'children'].map((k) => ({ value: k, label: k })),
    onChange: function (v) {
      num = v;
      c.redraw();
    },
  });
  var seg = segmented({
    label: 'View',
    value: view,
    options: [
      { value: 'box', label: 'Box plots' },
      { value: 'density', label: 'Density' },
    ],
    onChange: function (v) {
      view = v;
      c.redraw();
    },
  });
  ctl.append(sc.el, sn.el, seg.el);
  var c = chart(host, {
    aspect: 0.6,
    margin: { top: 26, right: 14, bottom: 34, left: 88 },
    draw: function (ctx) {
      var groups = Array.from(new Set(rows.map((r) => r[cat]))).sort();
      var x = d3
        .scaleLinear()
        .domain(
          pad(
            d3.extent(rows, (r) => r[num]),
            0.04,
          ),
        )
        .range([0, ctx.innerW]);
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(d3.axisBottom(x).tickFormat(d3.format('~s')));
      ctx.g
        .append('text')
        .attr('class', 'axis-label')
        .attr('x', ctx.innerW)
        .attr('y', ctx.innerH + 32)
        .attr('text-anchor', 'end')
        .text(num);
      if (view === 'box') {
        var y = d3.scaleBand().domain(groups).range([0, ctx.innerH]).padding(0.3);
        ctx.g
          .append('g')
          .attr('class', 'axis')
          .call(
            d3
              .axisLeft(y)
              .tickSize(0)
              .tickFormat((t) => String(t).toLowerCase().replace('_', ' ')),
          );
        groups.forEach(function (gk, i) {
          boxplot(
            ctx,
            rows.filter((r) => r[cat] === gk).map((r) => r[num]),
            {
              x: x,
              cy: y(gk) + y.bandwidth() / 2,
              h: Math.min(32, y.bandwidth()),
              color: ctx.c.series[i % 5],
              label: String(gk),
            },
          );
        });
      } else {
        var yd = d3.scaleLinear().range([ctx.innerH, 0]);
        var curves = groups.map(function (gk) {
          var xs = rows.filter((r) => r[cat] === gk).map((r) => r[num]);
          var dom = x.domain();
          var grid = d3.range(0, 101).map((k) => dom[0] + ((dom[1] - dom[0]) * k) / 100);
          return gaussianKde(xs, num === 'children' ? 0.3 : silverman(xs), grid);
        });
        yd.domain([0, d3.max(curves, (cv) => d3.max(cv, (p) => p[1])) * 1.1]);
        ctx.g
          .append('g')
          .attr('class', 'axis')
          .call(d3.axisLeft(yd).ticks(4).tickFormat(d3.format('.1e')));
        curves.forEach(function (pts, i) {
          var col = ctx.c.series[i % 5];
          ctx.g
            .append('path')
            .datum(pts)
            .attr(
              'd',
              d3
                .area()
                .x((p) => x(p[0]))
                .y0(ctx.innerH)
                .y1((p) => yd(p[1]))
                .curve(d3.curveBasis),
            )
            .attr('fill', col)
            .attr('fill-opacity', 0.15)
            .attr('stroke', col)
            .attr('stroke-width', 2);
        });
        legend(
          ctx,
          groups.map((gk, i) => ({
            label: String(gk).toLowerCase().replace('_', ' '),
            color: ctx.c.series[i % 5],
          })),
          { y: -12 },
        );
      }
    },
  });
}

/* ---- 2.2 stacked bars ------------------------------------------------------ */

function stacked(rows) {
  var host = document.getElementById('stack-chart');
  var ctl = document.getElementById('stack-controls');
  var CATS = ['sex', 'region', 'married', 'car', 'save_act', 'current_act', 'mortgage'];
  var prop = false;
  var colorBy = 'pep';
  var seg = segmented({
    label: 'Height',
    value: 'abs',
    options: [
      { value: 'abs', label: 'Counts' },
      { value: 'rel', label: 'Proportions' },
    ],
    onChange: function (v) {
      prop = v === 'rel';
      c.redraw();
    },
  });
  var sc = select({
    label: 'Color (v₂)',
    value: colorBy,
    options: ['pep', 'sex', 'married', 'car', 'mortgage'].map((k) => ({ value: k, label: k })),
    onChange: function (v) {
      colorBy = v;
      c.redraw();
    },
  });
  ctl.append(
    seg.el,
    sc.el,
    el(
      'p',
      'ctl-note',
      'Switch to proportions: differences in PEP share between groups (married, save_act, children) pop out once group sizes are factored out.',
    ),
  );
  var c = chart(host, {
    height: function (w) {
      return w < 560 ? 980 : 560;
    },
    margin: { top: 28, right: 8, bottom: 8, left: 8 },
    draw: function (ctx) {
      var cats = CATS.filter((k) => k !== colorBy);
      var cols = ctx.innerW < 520 ? 2 : 4;
      var rowsN = Math.ceil(cats.length / cols);
      var cw = ctx.innerW / cols;
      var chH = ctx.innerH / rowsN;
      var keys = Array.from(new Set(rows.map((r) => r[colorBy])))
        .sort()
        .reverse();
      cats.forEach(function (cat, k) {
        var gx = (k % cols) * cw;
        var gy = Math.floor(k / cols) * chH;
        var m = { l: 38, r: 8, t: 22, b: 30 };
        var g = ctx.g
          .append('g')
          .attr('transform', 'translate(' + (gx + m.l) + ',' + (gy + m.t) + ')');
        var w = cw - m.l - m.r;
        var h = chH - m.t - m.b;
        var groups = Array.from(new Set(rows.map((r) => r[cat]))).sort();
        var data = groups.map(function (gk) {
          var sub = rows.filter((r) => r[cat] === gk);
          var o = { key: gk, total: sub.length };
          keys.forEach(function (kk) {
            o[kk] = sub.filter((r) => r[colorBy] === kk).length / (prop ? sub.length : 1);
          });
          return o;
        });
        var series = d3.stack().keys(keys)(data);
        var x = d3.scaleBand().domain(groups).range([0, w]).padding(0.25);
        var y = d3
          .scaleLinear()
          .domain([0, prop ? 1 : d3.max(data, (d) => d3.sum(keys, (kk) => d[kk]))])
          .nice()
          .range([h, 0]);
        g.append('text').attr('class', 'label').attr('x', 0).attr('y', -8).text(cat);
        g.append('g')
          .attr('class', 'axis')
          .call(
            d3
              .axisLeft(y)
              .ticks(3)
              .tickFormat(prop ? d3.format('.0%') : d3.format('~s')),
          );
        g.append('g')
          .attr('class', 'axis')
          .attr('transform', 'translate(0,' + h + ')')
          .call(
            d3
              .axisBottom(x)
              .tickSize(0)
              .tickFormat((t) => {
                var s = String(t).toLowerCase().replace('_', ' ');
                return s.length > 7 ? s.slice(0, 6) + '.' : s;
              }),
          );
        series.forEach(function (s, si) {
          g.append('g')
            .selectAll('rect')
            .data(s)
            .join('rect')
            .attr('x', (d) => x(d.data.key))
            .attr('width', x.bandwidth())
            .attr('y', (d) => y(d[1]))
            .attr('height', (d) => Math.max(0, y(d[0]) - y(d[1]) - 1))
            .attr('rx', 2)
            .attr('fill', ctx.c.series[si === 0 ? 0 : 1])
            .on('pointerenter', function (e, d) {
              var v = d[1] - d[0];
              showTip(
                e,
                '<b>' +
                  cat +
                  ' = ' +
                  d.data.key +
                  '</b><br>' +
                  colorBy +
                  ' = ' +
                  s.key +
                  ': ' +
                  (prop ? d3.format('.1%')(v) : v) +
                  ' of ' +
                  d.data.total,
              );
            })
            .on('pointerleave', hideTip);
        });
      });
      legend(
        ctx,
        keys.map((kk, i) => ({
          label: colorBy + ' ' + String(kk).toLowerCase(),
          color: ctx.c.series[i === 0 ? 0 : 1],
        })),
        { y: -16 },
      );
    },
  });
}

/* ---- 2.3 slicing ------------------------------------------------------------ */

function slicing(rows) {
  var host = document.getElementById('slice-chart');
  var ctl = document.getElementById('slice-controls');
  var set = readout(document.getElementById('slice-readout'));
  var f = { region: 'all', sex: 'all', married: 'all' };
  function sel(key, label, opts) {
    return select({
      label: label,
      value: 'all',
      options: [{ value: 'all', label: 'All' }].concat(
        opts.map((o) => ({ value: o, label: o.toLowerCase().replace('_', ' ') })),
      ),
      onChange: function (v) {
        f[key] = v;
        c.redraw();
      },
    });
  }
  ctl.append(
    sel('region', 'Geographic region', ['INNER_CITY', 'TOWN', 'RURAL', 'SUBURBAN']).el,
    sel('sex', 'Demographic: sex', ['FEMALE', 'MALE']).el,
    sel('married', 'Demographic: married', ['YES', 'NO']).el,
    el('p', 'ctl-note', 'Compare the slice (colored) with the whole dataset (grey).'),
  );
  var c = chart(host, {
    aspect: 0.6,
    margin: { top: 16, right: 14, bottom: 34, left: 52 },
    draw: function (ctx) {
      var slice = rows.filter(function (r) {
        return Object.keys(f).every((k) => f[k] === 'all' || r[k] === f[k]);
      });
      var x = d3.scaleLinear().domain([15, 70]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([0, 70000]).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        yAxis: d3.axisLeft(y).tickFormat(d3.format('~s')),
        xLabel: 'age',
        yLabel: 'income',
      });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(rows)
        .join('circle')
        .attr('cx', (d) => x(d.age))
        .attr('cy', (d) => y(d.income))
        .attr('r', 2.5)
        .attr('fill', ctx.c.text)
        .attr('opacity', 0.12);
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(slice)
        .join('circle')
        .attr('cx', (d) => x(d.age))
        .attr('cy', (d) => y(d.income))
        .attr('r', 3.2)
        .attr('fill', (d) => pepColor(ctx.c, d.pep))
        .attr('opacity', 0.85);
      legend(
        ctx,
        [
          { label: 'PEP yes', color: ctx.c.series[0] },
          { label: 'PEP no', color: ctx.c.series[1] },
        ],
        { left: true, y: 4 },
      );
      function stats(rs) {
        return {
          n: rs.length,
          r: pearson(
            rs.map((d) => d.age),
            rs.map((d) => d.income),
          ),
          pep: rs.filter((d) => d.pep === 'YES').length / rs.length,
          inc: mean(rs.map((d) => d.income)),
        };
      }
      var a = stats(rows);
      var s = slice.length > 2 ? stats(slice) : { n: slice.length, r: NaN, pep: NaN, inc: NaN };
      set([
        { k: 'Slice size', v: s.n + ' / ' + a.n },
        {
          k: 'r(age, income)',
          v: rText(s.r) + ' <small class="muted">vs ' + rText(a.r) + '</small>',
          hot: true,
        },
        {
          k: 'PEP rate',
          v:
            d3.format('.0%')(s.pep) +
            ' <small class="muted">vs ' +
            d3.format('.0%')(a.pep) +
            '</small>',
          hot: true,
        },
        { k: 'Mean income', v: d3.format('.3s')(s.inc) },
      ]);
    },
  });
}

/* ---- 2.4 sandbox ---------------------------------------------------------- */

function sandbox() {
  var host = document.getElementById('sandbox');
  var ctl = document.getElementById('sandbox-controls');
  var set = readout(document.getElementById('sandbox-readout'));
  var PRESETS = {
    neg: [
      [-3, 1],
      [6, -2],
      [0, 0],
      [3, -1],
      [-6, 2],
    ],
    pos: [
      [3, 1],
      [6, 2],
      [0, 0],
      [3, 1],
      [6, 2],
    ],
    sq: [
      [-3, 9],
      [-2, 4],
      [-1, 1],
      [0, 0],
      [1, 1],
      [2, 4],
      [3, 9],
    ],
  };
  var pts = PRESETS.sq.map((p) => p.slice());
  var dom = { x: [-8, 8], y: [-4, 10] };
  var actions = el('div', 'ctl-actions');
  [
    ['x = (−3, 6, 0, 3, −6)', 'neg'],
    ['x = (3, 6, 0, 3, 6)', 'pos'],
    ['y = x²', 'sq'],
  ].forEach(function (p) {
    actions.append(
      button(p[0], function () {
        pts = PRESETS[p[1]].map((q) => q.slice());
        c.redraw();
      }),
    );
  });
  var actions2 = el('div', 'ctl-actions');
  actions2.append(
    button('Random cloud', function () {
      var g = normalSampler(rng(Math.floor(Math.random() * 1e6)));
      pts = d3.range(14).map(() => [g() * 3, 3 + g() * 2.5]);
      c.redraw();
    }),
    button('Undo last', function () {
      pts.pop();
      c.redraw();
    }),
    button('Clear', function () {
      pts = [];
      c.redraw();
    }),
  );
  var fit = toggle({ label: 'Least-squares line', checked: true, onChange: () => c.redraw() });
  ctl.append(
    el('span', 'ctl__label', 'Course examples'),
    actions,
    actions2,
    fit.el,
    el(
      'p',
      'ctl-note',
      'Start from y = x²: a perfect relationship, Pearson 0. Now drag the left points down: the correlation appears.',
    ),
  );
  var c = chart(host, {
    aspect: 0.72,
    margin: { top: 14, right: 14, bottom: 30, left: 34 },
    draw: function (ctx) {
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      axes(ctx, x, y, {});
      var bg = ctx.g
        .append('rect')
        .attr('width', ctx.innerW)
        .attr('height', ctx.innerH)
        .attr('fill', 'transparent')
        .style('cursor', 'crosshair');
      var lineG = ctx.g.append('g');
      var dotG = ctx.g.append('g');
      bg.on('click', function (e) {
        var p = d3.pointer(e);
        pts.push([Math.round(x.invert(p[0]) * 10) / 10, Math.round(y.invert(p[1]) * 10) / 10]);
        paint();
      });
      dragNearest(
        ctx,
        () => pts.map((p) => ({ x: x(p[0]), y: y(p[1]), d: p })),
        function (p, px, py) {
          p[0] = Math.max(dom.x[0], Math.min(dom.x[1], Math.round(x.invert(px) * 10) / 10));
          p[1] = Math.max(dom.y[0], Math.min(dom.y[1], Math.round(y.invert(py) * 10) / 10));
          paint();
        },
      );
      function paint() {
        lineG.selectAll('*').remove();
        var xs = pts.map((p) => p[0]);
        var ys = pts.map((p) => p[1]);
        var ok = pts.length >= 2 && std(xs) > 0 && std(ys) > 0;
        var r = ok ? pearson(xs, ys) : NaN;
        var rs = ok ? spearman(xs, ys) : NaN;
        if (ok && fit.value) {
          var b = covariance(xs, ys) / (std(xs) * std(xs));
          var a = mean(ys) - b * mean(xs);
          lineG
            .append('line')
            .attr('x1', x(dom.x[0]))
            .attr('x2', x(dom.x[1]))
            .attr('y1', y(a + b * dom.x[0]))
            .attr('y2', y(a + b * dom.x[1]))
            .attr('stroke', ctx.c.accent)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '6 4');
        }
        dotG
          .selectAll('circle')
          .data(pts)
          .join('circle')
          .attr('class', 'handle')
          .attr('cx', (p) => x(p[0]))
          .attr('cy', (p) => y(p[1]))
          .attr('r', 8)
          .attr('fill', ctx.c.text)
          .attr('fill-opacity', 0.85)
          .attr('stroke', ctx.c.surface)
          .attr('stroke-width', 2);
        set([
          { k: 'n', v: pts.length },
          { k: 'Cov(x, y)', v: ok ? fmt(covariance(xs, ys), 2) : '—' },
          { k: 'Pearson', v: ok ? fmt(r, 3) : '—', hot: true },
          { k: 'Spearman', v: ok ? fmt(rs, 3) : '—', hot: true, color: seriesVar(1) },
        ]);
      }
      paint();
    },
  });
}

/* ---- 2.4 iris matrix ------------------------------------------------------ */

function irisMatrix(rows) {
  var host = document.getElementById('iris-matrix');
  var ctl = document.getElementById('iris-controls');
  var attrs = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];
  var species = ['setosa', 'versicolor', 'virginica'];
  var on = { setosa: true, versicolor: true, virginica: true };
  species.forEach(function (s, i) {
    var t = toggle({
      label: '<span class="swatch" style="--c:' + seriesVar(i) + '"></span>Iris ' + s,
      checked: true,
      onChange: function (v) {
        on[s] = v;
        c.redraw();
      },
    });
    ctl.append(t.el);
  });
  ctl.append(
    el(
      'p',
      'ctl-note',
      'Petal length vs petal width separates the three species almost perfectly; sepal width vs sepal length mixes versicolor and virginica.',
    ),
  );
  var c = chart(host, {
    height: function (w) {
      return Math.min(w, 620);
    },
    margin: { top: 8, right: 8, bottom: 30, left: 34 },
    draw: function (ctx) {
      var n = 4;
      var gap = 6;
      var size = (Math.min(ctx.innerW, ctx.innerH) - gap * (n - 1)) / n;
      var sc = attrs.map((a) =>
        d3
          .scaleLinear()
          .domain(
            pad(
              d3.extent(rows, (r) => r[a]),
              0.06,
            ),
          )
          .range([0, size]),
      );
      var data = rows.filter((r) => on[r.species]);
      attrs.forEach(function (ay, i) {
        attrs.forEach(function (ax, j) {
          var g = ctx.g
            .append('g')
            .attr('transform', 'translate(' + j * (size + gap) + ',' + i * (size + gap) + ')');
          g.append('rect')
            .attr('width', size)
            .attr('height', size)
            .attr('fill', 'none')
            .attr('stroke', ctx.c.line);
          if (i === j) {
            g.append('text')
              .attr('class', 'label')
              .attr('x', size / 2)
              .attr('y', size / 2 + 4)
              .attr('text-anchor', 'middle')
              .text(ax.replace('_', ' '));
            return;
          }
          var sy = sc[i].copy().range([size, 0]);
          g.append('g')
            .selectAll('circle')
            .data(data)
            .join('circle')
            .attr('cx', (r) => sc[j](r[ax]))
            .attr('cy', (r) => sy(r[ay]))
            .attr('r', size > 120 ? 2.6 : 1.8)
            .attr('fill', (r) => ctx.c.series[species.indexOf(r.species)])
            .attr('opacity', 0.75);
          g.append('rect')
            .attr('class', 'hit')
            .attr('width', size)
            .attr('height', size)
            .on('pointerenter', function (e) {
              showTip(
                e,
                '<b>' +
                  ay.replace('_', ' ') +
                  ' vs ' +
                  ax.replace('_', ' ') +
                  '</b><br>r = ' +
                  fmt(
                    pearson(
                      data.map((r) => r[ax]),
                      data.map((r) => r[ay]),
                    ),
                    2,
                  ),
              );
            })
            .on('pointerleave', hideTip);
          if (i === n - 1)
            g.append('g')
              .attr('class', 'axis')
              .attr('transform', 'translate(0,' + size + ')')
              .call(d3.axisBottom(sc[j]).ticks(3));
          if (j === 0) g.append('g').attr('class', 'axis').call(d3.axisLeft(sy).ticks(3));
        });
      });
    },
  });
}

/* ---- 2.5 ρ grid ------------------------------------------------------------- */

function rhoGrid() {
  var host = document.getElementById('rho-grid');
  var rhos = d3.range(-10, 11).map((k) => k / 10);
  var cache = rhos.map((r, i) => corrPairs(90, r, 100 + i));
  chart(host, {
    height: function (w) {
      var cols = w < 560 ? 4 : 7;
      var rowsN = Math.ceil(21 / cols);
      return Math.round((w / cols) * rowsN + 10);
    },
    margin: { top: 4, right: 4, bottom: 4, left: 4 },
    draw: function (ctx) {
      var cols = ctx.innerW < 560 ? 4 : 7;
      var size = ctx.innerW / cols;
      rhos.forEach(function (r, k) {
        var g = ctx.g
          .append('g')
          .attr(
            'transform',
            'translate(' + (k % cols) * size + ',' + Math.floor(k / cols) * size + ')',
          );
        var s = d3.scaleLinear().domain([-3.2, 3.2]);
        var pad2 = 10;
        var x = s.copy().range([pad2, size - pad2]);
        var y = s.copy().range([size - pad2, pad2 + 12]);
        g.append('text')
          .attr('class', 'label' + (r === 0 ? ' label--accent' : ''))
          .attr('x', size / 2)
          .attr('y', 12)
          .attr('text-anchor', 'middle')
          .text(r.toFixed(2));
        g.append('g')
          .selectAll('circle')
          .data(cache[k])
          .join('circle')
          .attr('cx', (p) => x(p[0]))
          .attr('cy', (p) => y(p[1]))
          .attr('r', 1.6)
          .attr('fill', 'none')
          .attr('stroke', r < 0 ? ctx.c.series[1] : r > 0 ? ctx.c.accent : ctx.c.text)
          .attr('stroke-width', 1);
      });
    },
  });
}

/* ---- 2.5 guess game ------------------------------------------------------ */

function guessGame() {
  var host = document.getElementById('guess-chart');
  var ctl = document.getElementById('guess-controls');
  var scoreEl = document.getElementById('guess-score');
  var round = 0;
  var total = 0;
  var best = 0;
  try {
    best = Number(localStorage.getItem('vd-guess-best')) || 0;
  } catch (err) {
    best = 0;
  }
  var ROUNDS = 5;
  var pts;
  var truth;
  var revealed = false;
  var guess = 0;
  var sg = slider({
    label: 'Your guess',
    min: -1,
    max: 1,
    step: 0.05,
    value: 0,
    format: (v) => v.toFixed(2),
    onInput: function (v) {
      guess = v;
    },
  });
  var feedback = el('p', 'ctl-note', '');
  var go = button(
    'Lock in',
    function () {
      if (revealed) next();
      else reveal();
    },
    'ds-button--primary',
  );
  ctl.append(sg.el, go, feedback);
  function next() {
    if (round >= ROUNDS) {
      round = 0;
      total = 0;
    }
    revealed = false;
    var rr = Math.random;
    var target = Math.round((rr() * 2 - 1) * 100) / 100;
    pts = corrPairs(Math.round(40 + rr() * 80), target, Math.floor(rr() * 1e9));
    truth = pearson(
      pts.map((p) => p[0]),
      pts.map((p) => p[1]),
    );
    go.textContent = 'Lock in';
    feedback.innerHTML =
      'Round ' + (round + 1) + ' of ' + ROUNDS + '. Drag the slider, then lock in.';
    paintScore();
    c.redraw();
  }
  function reveal() {
    revealed = true;
    var err = Math.abs(guess - truth);
    var pts2 = Math.max(0, Math.round(100 - err * 200));
    total += pts2;
    round += 1;
    var verdict =
      err < 0.05 ? 'Bullseye!' : err < 0.15 ? 'Close.' : err < 0.3 ? 'Not bad.' : 'Way off.';
    feedback.innerHTML =
      '<strong>' +
      verdict +
      '</strong> True r = ' +
      truth.toFixed(3) +
      ', you said ' +
      guess.toFixed(2) +
      ' → +' +
      pts2 +
      ' pts.';
    if (round >= ROUNDS) {
      best = Math.max(best, total);
      try {
        localStorage.setItem('vd-guess-best', String(best));
      } catch (e) {
        /* best score just won't persist */
      }
      feedback.innerHTML += ' <br>Final score ' + total + ' / ' + ROUNDS * 100 + '.';
      go.textContent = 'Play again';
    } else go.textContent = 'Next round →';
    paintScore();
    c.redraw();
  }
  function paintScore() {
    scoreEl.textContent = 'score ' + total + ' · best ' + best;
  }
  var c = chart(host, {
    aspect: 0.7,
    margin: { top: 14, right: 14, bottom: 26, left: 30 },
    draw: function (ctx) {
      var x = d3.scaleLinear().domain([-3.4, 3.4]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([-3.4, 3.4]).range([ctx.innerH, 0]);
      axes(ctx, x, y, { xTicks: 0, yTicks: 0, grid: false });
      ctx.g.selectAll('.axis .tick').remove();
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(pts)
        .join('circle')
        .attr('cx', (p) => x(p[0]))
        .attr('cy', (p) => y(p[1]))
        .attr('r', 4)
        .attr('fill', ctx.c.text)
        .attr('opacity', 0.7);
      if (revealed) {
        var xs = pts.map((p) => p[0]);
        var ys = pts.map((p) => p[1]);
        var b = covariance(xs, ys) / variance2(xs);
        var a = mean(ys) - b * mean(xs);
        ctx.g
          .append('line')
          .attr('x1', 0)
          .attr('x2', ctx.innerW)
          .attr('y1', y(a + b * -3.4))
          .attr('y2', y(a + b * 3.4))
          .attr('stroke', ctx.c.accent)
          .attr('stroke-width', 2.5);
        ctx.g
          .append('text')
          .attr('class', 'label label--accent')
          .attr('x', 8)
          .attr('y', 16)
          .style('font-size', '16px')
          .text('r = ' + truth.toFixed(2));
      }
    },
  });
  function variance2(xs) {
    var s = std(xs);
    return s * s;
  }
  next();
}

/* ---- 2.6 ranks ------------------------------------------------------------ */

function rankViz() {
  var host = document.getElementById('rank-viz');
  var ctl = document.getElementById('rank-controls');
  var wrap = el('div', 'ctl');
  var id = 'rank-input';
  wrap.innerHTML =
    '<label class="ctl__label" for="' +
    id +
    '">Values (comma-separated)</label><input class="ds-input" id="' +
    id +
    '" value="10, 30, 20, 20, 50" inputmode="decimal" />';
  var input = wrap.querySelector('input');
  input.addEventListener('input', () => c.redraw());
  var ex = el('div', 'ctl-actions');
  [
    ['Course example', '10, 30, 20, 20, 50'],
    ['Many ties', '3, 1, 3, 3, 2, 5, 1'],
    ['Outlier', '2, 4, 5, 7, 8, 1000'],
  ].forEach(function (e) {
    ex.append(
      button(e[0], function () {
        input.value = e[1];
        c.redraw();
      }),
    );
  });
  ctl.append(
    wrap,
    ex,
    el('p', 'ctl-note', 'Ranks replace magnitudes with positions: 1000 becomes just “6th”.'),
  );
  var c = chart(host, {
    height: function (w) {
      return w < 500 ? 240 : 210;
    },
    margin: { top: 30, right: 20, bottom: 30, left: 56 },
    draw: function (ctx) {
      var vals = input.value
        .split(/[,;\s]+/)
        .map(Number)
        .filter((v) => Number.isFinite(v))
        .slice(0, 14);
      if (!vals.length) return;
      var rk = ranks(vals);
      var x = d3
        .scaleLinear()
        .domain(pad(d3.extent(vals), 0.08))
        .range([0, ctx.innerW]);
      var xr = d3
        .scaleLinear()
        .domain([0.5, vals.length + 0.5])
        .range([0, ctx.innerW]);
      var yV = 0;
      var yR = ctx.innerH;
      ctx.g
        .append('text')
        .attr('class', 'label')
        .attr('x', -10)
        .attr('y', yV + 4)
        .attr('text-anchor', 'end')
        .text('value');
      ctx.g
        .append('text')
        .attr('class', 'label')
        .attr('x', -10)
        .attr('y', yR + 4)
        .attr('text-anchor', 'end')
        .text('rank');
      [
        [yV, x],
        [yR, xr],
      ].forEach(function (p) {
        ctx.g
          .append('line')
          .attr('x1', 0)
          .attr('x2', ctx.innerW)
          .attr('y1', p[0])
          .attr('y2', p[0])
          .attr('stroke', ctx.c.line);
      });
      vals.forEach(function (v, i) {
        var tie = rk[i] % 1 !== 0;
        var col = tie ? ctx.c.accent : ctx.c.text;
        ctx.g
          .append('path')
          .attr(
            'd',
            'M' +
              x(v) +
              ',' +
              (yV + 6) +
              ' C' +
              x(v) +
              ',' +
              yR / 2 +
              ' ' +
              xr(rk[i]) +
              ',' +
              yR / 2 +
              ' ' +
              xr(rk[i]) +
              ',' +
              (yR - 6),
          )
          .attr('fill', 'none')
          .attr('stroke', col)
          .attr('stroke-opacity', 0.5);
        ctx.g.append('circle').attr('cx', x(v)).attr('cy', yV).attr('r', 5).attr('fill', col);
        ctx.g
          .append('text')
          .attr('x', x(v))
          .attr('y', yV - 10)
          .attr('text-anchor', 'middle')
          .text(fmt(v, 2));
        ctx.g.append('circle').attr('cx', xr(rk[i])).attr('cy', yR).attr('r', 5).attr('fill', col);
        ctx.g
          .append('text')
          .attr('class', 'label' + (tie ? ' label--accent' : ''))
          .attr('x', xr(rk[i]))
          .attr('y', yR + 20)
          .attr('text-anchor', 'middle')
          .text(rk[i]);
      });
    },
  });
}

/* ---- 2.6 worked example ---------------------------------------------------- */

function worked() {
  var table = document.getElementById('worked');
  var host = document.getElementById('worked-chart');
  var ctl = document.getElementById('worked-controls');
  var DATA = [
    [2, 18],
    [4, 20],
    [5, 26],
    [7, 24],
    [8, 28],
    [10, 30],
  ];
  var data = DATA.map((d) => d.slice());
  var out = el('div');
  ctl.append(
    out,
    button('Reset to the course data', function () {
      data = DATA.map((d) => d.slice());
      build();
    }),
    el(
      'p',
      'ctl-note',
      'Both coefficients are high and close: the relationship is almost linear and there are no outliers. Try giving S6 a grade of 18.',
    ),
  );
  var set = readout(out);
  function build() {
    table.innerHTML =
      '<thead><tr><th>Student</th><th class="num">Hours x</th><th class="num">Grade y</th><th class="num">y = bx</th><th class="num">rank(x)</th><th class="num">rank(y)</th><th class="num">d</th><th class="num">d²</th></tr></thead><tbody></tbody>';
    var tb = table.querySelector('tbody');
    data.forEach(function (d, i) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>S' +
        (i + 1) +
        '</td><td class="num"><input type="number" step="0.5" value="' +
        d[0] +
        '" aria-label="Hours of S' +
        (i + 1) +
        '"></td><td class="num"><input type="number" value="' +
        d[1] +
        '" aria-label="Grade of S' +
        (i + 1) +
        '"></td><td class="num b"></td><td class="num rx"></td><td class="num ry"></td><td class="num d"></td><td class="num d2"></td>';
      tr.querySelectorAll('input').forEach(function (inp, k) {
        inp.addEventListener('input', function () {
          var v = Number(inp.value);
          if (Number.isFinite(v)) {
            data[i][k] = v;
            update();
          }
        });
      });
      tb.append(tr);
    });
    update();
  }
  function update() {
    var xs = data.map((d) => d[0]);
    var ys = data.map((d) => d[1]);
    var rx = ranks(xs);
    var ry = ranks(ys);
    var n = data.length;
    var sd2 = 0;
    var ties = new Set(rx).size < n || new Set(ry).size < n;
    table.querySelectorAll('tbody tr').forEach(function (tr, i) {
      var d = rx[i] - ry[i];
      sd2 += d * d;
      tr.querySelector('.b').textContent = 'b=' + fmt(ys[i] / xs[i], 1);
      tr.querySelector('.rx').textContent = rx[i];
      tr.querySelector('.ry').textContent = ry[i];
      tr.querySelector('.d').textContent = fmt(d, 1);
      tr.querySelector('.d2').textContent = fmt(d * d, 2);
      tr.classList.toggle('is-hl', d !== 0);
    });
    var rsFormula = 1 - (6 * sd2) / (n * (n * n - 1));
    set([
      { k: 'Σ d²', v: fmt(sd2, 2) },
      { k: 'n', v: n },
      {
        k: 'ρs = 1 − 6Σd²/n(n²−1)',
        v: fmt(rsFormula, 3) + (ties ? ' <small class="muted">(ties!)</small>' : ''),
        hot: true,
      },
      { k: 'ρs on ranks', v: fmt(spearman(xs, ys), 3), hot: true },
      { k: 'Pearson', v: fmt(pearson(xs, ys), 3), color: seriesVar(1), hot: true },
    ]);
    c.redraw();
  }
  var c = chart(host, {
    aspect: 0.45,
    margin: { top: 14, right: 16, bottom: 30, left: 36 },
    draw: function (ctx) {
      var x = d3
        .scaleLinear()
        .domain(
          pad(
            d3.extent(data, (d) => d[0]),
            0.15,
          ),
        )
        .range([0, ctx.innerW]);
      var y = d3
        .scaleLinear()
        .domain(
          pad(
            d3.extent(data, (d) => d[1]),
            0.15,
          ),
        )
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, { xLabel: 'hours', yLabel: 'grade' });
      ctx.g
        .append('path')
        .datum(data.slice().sort((a, b) => a[0] - b[0]))
        .attr(
          'd',
          d3
            .line()
            .x((d) => x(d[0]))
            .y((d) => y(d[1])),
        )
        .attr('fill', 'none')
        .attr('stroke', ctx.c.line)
        .attr('stroke-width', 1.5);
      data.forEach(function (d, i) {
        ctx.g
          .append('circle')
          .attr('cx', x(d[0]))
          .attr('cy', y(d[1]))
          .attr('r', 6)
          .attr('fill', i === 2 || i === 3 ? ctx.c.accent : ctx.c.text);
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', x(d[0]) + 9)
          .attr('y', y(d[1]) + 4)
          .text('S' + (i + 1));
      });
    },
  });
  build();
}

/* ---- 2.7 versus ------------------------------------------------------------ */

function versus() {
  var wrap = document.getElementById('versus-plots');
  var ctl = document.getElementById('versus-controls');
  var g = normalSampler(rng(50));
  var base = d3.range(30).map(() => [Math.random(), g()]);
  var noise = 2.5;
  var expo = 0.6;
  var outlier = [40, 40];
  var sn = slider({
    label: 'Noise (linear)',
    min: 0,
    max: 8,
    step: 0.1,
    value: noise,
    onInput: function (v) {
      noise = v;
      charts.forEach((c) => c.redraw());
    },
  });
  var se = slider({
    label: 'Curvature (exponential)',
    min: 0.05,
    max: 1,
    step: 0.05,
    value: expo,
    onInput: function (v) {
      expo = v;
      charts.forEach((c) => c.redraw());
    },
  });
  ctl.append(
    sn.el,
    se.el,
    el(
      'p',
      'ctl-note',
      'Drag the red outlier in the third plot toward the cloud and back: Pearson swings, Spearman barely moves.',
    ),
  );
  var g2 = normalSampler(rng(51));
  var cloud = d3.range(30).map(() => [5 + g2() * 2.5, 5 + g2() * 2.5]);
  var specs = [
    {
      name: 'Linear + noise',
      data: () => base.map((b, i) => [i / 3, (i / 3) * 2 + b[1] * noise]),
    },
    {
      name: 'Monotonic, non-linear',
      data: () => base.map((b, i) => [i / 3, Math.exp((i / 3) * expo)]),
    },
    {
      name: 'Uncorrelated + 1 outlier',
      data: () => cloud.concat([outlier]),
      drag: true,
    },
  ];
  var charts = specs.map(function (sp) {
    var div = el('div');
    var title = el('p', 'plot-title');
    var host = el('div');
    div.append(title, host);
    wrap.append(div);
    return chart(host, {
      aspect: 0.9,
      margin: { top: 10, right: 10, bottom: 26, left: 36 },
      draw: function (ctx) {
        var d = sp.data();
        var x = d3
          .scaleLinear()
          .domain(sp.drag ? [0, 45] : pad(d3.extent(d, (p) => p[0])))
          .range([0, ctx.innerW]);
        var y = d3
          .scaleLinear()
          .domain(sp.drag ? [0, 45] : pad(d3.extent(d, (p) => p[1])))
          .range([ctx.innerH, 0]);
        axes(ctx, x, y, { xTicks: 4, yTicks: 4 });
        var dots = ctx.g.append('g');
        function paint() {
          var dd = sp.data();
          var xs = dd.map((p) => p[0]);
          var ys = dd.map((p) => p[1]);
          title.innerHTML =
            sp.name +
            '<br><small>Pearson ' +
            fmt(pearson(xs, ys), 2) +
            ' · Spearman ' +
            fmt(spearman(xs, ys), 2) +
            '</small>';
          dots
            .selectAll('circle')
            .data(dd)
            .join('circle')
            .attr('cx', (p) => x(p[0]))
            .attr('cy', (p) => y(p[1]))
            .attr('r', (p) => (sp.drag && p === outlier ? 8 : 3.5))
            .attr('class', (p) => (sp.drag && p === outlier ? 'handle' : null))
            .attr('fill', (p) => (sp.drag && p === outlier ? ctx.c.accent : ctx.c.series[1]));
        }
        paint();
        if (sp.drag) {
          dragNearest(
            ctx,
            () => [{ x: x(outlier[0]), y: y(outlier[1]), d: outlier }],
            function (p, px, py) {
              outlier[0] = Math.max(0, Math.min(45, x.invert(px)));
              outlier[1] = Math.max(0, Math.min(45, y.invert(py)));
              paint();
            },
          );
        }
      },
    });
  });
}

/* ---- 2.8 chance ----------------------------------------------------------- */

function chance() {
  var host = document.getElementById('chance-chart');
  var ctl = document.getElementById('chance-controls');
  var set = readout(document.getElementById('chance-readout'));
  var m = 100;
  var n = 50;
  var seed = 1;
  var sm = slider({
    label: 'Attributes',
    min: 5,
    max: 150,
    value: m,
    onInput: function (v) {
      m = v;
      run();
    },
  });
  var sn = slider({
    label: 'Instances',
    min: 20,
    max: 300,
    step: 10,
    value: n,
    onInput: function (v) {
      n = v;
      run();
    },
  });
  ctl.append(
    sm.el,
    sn.el,
    button('Draw new random data', function () {
      seed += 1;
      run();
    }),
    el(
      'p',
      'ctl-note',
      'Every attribute is pure independent noise. With 100 attributes there are 4,950 pairs; at α = 0.05 about 250 of them look “significant” anyway. Bonferroni divides α by the number of pairs.',
    ),
  );
  var rs = [];
  function run() {
    var g = normalSampler(rng(seed * 1000 + m * 7 + n));
    var cols = [];
    for (var j = 0; j < m; j++) {
      var col = new Float64Array(n);
      var s = 0;
      for (var i = 0; i < n; i++) {
        col[i] = g();
        s += col[i];
      }
      var mu = s / n;
      var ss = 0;
      for (var i2 = 0; i2 < n; i2++) {
        col[i2] -= mu;
        ss += col[i2] * col[i2];
      }
      var norm = Math.sqrt(ss);
      for (var i3 = 0; i3 < n; i3++) col[i3] /= norm;
      cols.push(col);
    }
    rs = [];
    for (var a = 0; a < m; a++) {
      for (var b = a + 1; b < m; b++) {
        var dot = 0;
        for (var k = 0; k < n; k++) dot += cols[a][k] * cols[b][k];
        rs.push(dot);
      }
    }
    c.redraw();
  }
  var c = chart(host, {
    aspect: 0.5,
    margin: { top: 18, right: 14, bottom: 30, left: 44 },
    draw: function (ctx) {
      // |r| thresholds via Fisher's z: r* = tanh(z_{1−α/2} / √(n − 3))
      var pairs = rs.length;
      var crit = Math.tanh(1.96 / Math.sqrt(n - 3));
      var zB = -normalQuantile(0.05 / pairs / 2);
      var critB = Math.tanh(zB / Math.sqrt(n - 3));
      var x = d3.scaleLinear().domain([-0.8, 0.8]).range([0, ctx.innerW]);
      var b = d3.bin().domain(x.domain()).thresholds(60)(rs);
      var y = d3
        .scaleLinear()
        .domain([0, d3.max(b, (d) => d.length) * 1.1])
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, { xLabel: 'Pearson r of a pair', yLabel: 'pairs' });
      ctx.g
        .append('g')
        .selectAll('rect')
        .data(b)
        .join('rect')
        .attr('x', (d) => x(d.x0) + 0.5)
        .attr('width', (d) => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr('y', (d) => y(d.length))
        .attr('height', (d) => ctx.innerH - y(d.length))
        .attr('fill', (d) => (Math.abs((d.x0 + d.x1) / 2) > crit ? ctx.c.accent : ctx.c.text))
        .attr('opacity', (d) => (Math.abs((d.x0 + d.x1) / 2) > crit ? 0.9 : 0.35));
      [-crit, crit].forEach(function (v) {
        ctx.g
          .append('line')
          .attr('x1', x(v))
          .attr('x2', x(v))
          .attr('y1', 0)
          .attr('y2', ctx.innerH)
          .attr('stroke', ctx.c.accent)
          .attr('stroke-dasharray', '4 3');
      });
      var hits = rs.filter((r) => Math.abs(r) > crit).length;
      var hitsB = rs.filter((r) => Math.abs(r) > critB).length;
      var maxR = d3.max(rs, Math.abs);
      set([
        { k: 'Pairs m(m−1)/2', v: pairs.toLocaleString('en-US') },
        { k: 'Expected at α=.05', v: Math.round(pairs * 0.05).toLocaleString('en-US') },
        { k: '“Significant”', v: hits.toLocaleString('en-US'), hot: true },
        { k: 'Max |r|', v: fmt(maxR, 2) },
        { k: 'After Bonferroni', v: hitsB, color: seriesVar(2), hot: true },
      ]);
    },
  });
  run();
}

/* ---- 2.8 DAG ---------------------------------------------------------------- */

function dag() {
  var host = document.getElementById('dag');
  host.innerHTML =
    '<svg viewBox="0 0 320 170" role="img" aria-label="z causes x and z causes y; x and y show an observed correlation with no causal link">' +
    '<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--ds-accent)"/></marker></defs>' +
    '<ellipse cx="160" cy="30" rx="70" ry="22" fill="var(--ds-accent-soft)" stroke="var(--ds-accent)"/>' +
    '<text x="160" y="35" text-anchor="middle" font-size="14" fill="var(--ds-text)" font-family="var(--ds-font-display)">z confounder</text>' +
    '<ellipse cx="60" cy="135" rx="48" ry="20" fill="var(--ds-surface)" stroke="var(--ds-line-strong)"/>' +
    '<text x="60" y="140" text-anchor="middle" font-size="15" fill="var(--ds-text)" font-family="var(--ds-font-display)">x</text>' +
    '<ellipse cx="260" cy="135" rx="48" ry="20" fill="var(--ds-surface)" stroke="var(--ds-line-strong)"/>' +
    '<text x="260" y="140" text-anchor="middle" font-size="15" fill="var(--ds-text)" font-family="var(--ds-font-display)">y</text>' +
    '<path d="M128 48 L76 113" stroke="var(--ds-accent)" stroke-width="2" marker-end="url(#arr)" fill="none"/>' +
    '<path d="M192 48 L244 113" stroke="var(--ds-accent)" stroke-width="2" marker-end="url(#arr)" fill="none"/>' +
    '<text x="88" y="78" font-size="11" fill="var(--ds-accent)" font-style="italic">causes</text>' +
    '<text x="232" y="78" font-size="11" fill="var(--ds-accent)" font-style="italic" text-anchor="end">causes</text>' +
    '<path d="M110 135 L210 135" stroke="var(--ds-text-soft)" stroke-width="2" stroke-dasharray="6 5"/>' +
    '<text x="160" y="160" text-anchor="middle" font-size="11" fill="var(--ds-text-soft)" font-style="italic">observed correlation, no causal link</text>' +
    '</svg>';
}

/* ---- 2.8 ice cream ---------------------------------------------------------- */

function iceCream() {
  var wrap = document.getElementById('ice-plots');
  var ctl = document.getElementById('ice-controls');
  var set = readout(document.getElementById('ice-readout'));
  var conf = 1;
  var direct = 0;
  var g = normalSampler(rng(53));
  var weeks = 156;
  var eps = d3.range(weeks).map(() => [g(), g(), g()]);
  var data;
  function build() {
    data = d3.range(weeks).map(function (w) {
      var season = Math.sin(((w % 52) / 52) * 2 * Math.PI - Math.PI / 2);
      var temp = 16 + 10 * season + eps[w][0] * 3;
      var ice = 1300 + 55 * conf * (temp - 16) + eps[w][1] * 120;
      var drown = 9 + 0.42 * conf * (temp - 16) + direct * ((ice - 1300) / 200) + eps[w][2] * 1.9;
      return { w: w, z: temp, x: Math.max(50, ice), y: Math.max(0, drown) };
    });
  }
  var sc = slider({
    label: 'Confounder strength',
    min: 0,
    max: 1.5,
    step: 0.05,
    value: conf,
    onInput: function (v) {
      conf = v;
      update();
    },
  });
  var sd = slider({
    label: 'Real effect of ice cream on drownings',
    min: 0,
    max: 3,
    step: 0.1,
    value: direct,
    onInput: function (v) {
      direct = v;
      update();
    },
  });
  ctl.append(
    sc.el,
    sd.el,
    el(
      'p',
      'ctl-note',
      'With no real effect, slicing and residuals make the correlation vanish. Add a real effect and it survives both checks.',
    ),
  );
  var panels = [
    'Ice-cream sales vs drownings',
    'Within temperature bands (slicing)',
    'After removing temperature (residuals)',
  ];
  var titles = [];
  var charts = panels.map(function (name, k) {
    var div = el('div');
    var t = el('p', 'plot-title', name);
    titles.push(t);
    var host = el('div');
    div.append(t, host);
    wrap.append(div);
    return chart(host, {
      aspect: 0.9,
      margin: { top: 10, right: 10, bottom: 30, left: 36 },
      draw: function (ctx) {
        var tempScale = d3
          .scaleLinear()
          .domain([0, 16, 32])
          .range([ctx.c.series[1], ctx.c.line, ctx.c.series[0]])
          .clamp(true);
        if (k < 2) {
          var x = d3
            .scaleLinear()
            .domain(pad(d3.extent(data, (d) => d.x)))
            .range([0, ctx.innerW]);
          var y = d3
            .scaleLinear()
            .domain(pad(d3.extent(data, (d) => d.y)))
            .range([ctx.innerH, 0]);
          axes(ctx, x, y, {
            xTicks: 3,
            yTicks: 4,
            xLabel: 'ice creams',
            yLabel: 'drownings',
            xAxis: d3.axisBottom(x).tickFormat(d3.format('~s')),
          });
          var bands = [
            [-99, 8],
            [8, 14],
            [14, 20],
            [20, 26],
            [26, 99],
          ];
          ctx.g
            .append('g')
            .selectAll('circle')
            .data(data)
            .join('circle')
            .attr('cx', (d) => x(d.x))
            .attr('cy', (d) => y(d.y))
            .attr('r', 3)
            .attr('fill', (d) => tempScale(d.z))
            .attr('opacity', 0.85);
          if (k === 1) {
            bands.forEach(function (bd) {
              var sub = data.filter((d) => d.z >= bd[0] && d.z < bd[1]);
              if (sub.length < 5) return;
              var xs = sub.map((d) => d.x);
              var ys = sub.map((d) => d.y);
              var bb = covariance(xs, ys) / (std(xs) * std(xs));
              var aa = mean(ys) - bb * mean(xs);
              var ex = d3.extent(xs);
              ctx.g
                .append('line')
                .attr('x1', x(ex[0]))
                .attr('x2', x(ex[1]))
                .attr('y1', y(aa + bb * ex[0]))
                .attr('y2', y(aa + bb * ex[1]))
                .attr('stroke', tempScale((Math.max(bd[0], 2) + Math.min(bd[1], 30)) / 2))
                .attr('stroke-width', 2.5);
            });
          }
        } else {
          var rx = residuals(
            data.map((d) => d.x),
            data.map((d) => d.z),
          );
          var ry = residuals(
            data.map((d) => d.y),
            data.map((d) => d.z),
          );
          var x2 = d3
            .scaleLinear()
            .domain(pad(d3.extent(rx)))
            .range([0, ctx.innerW]);
          var y2 = d3
            .scaleLinear()
            .domain(pad(d3.extent(ry)))
            .range([ctx.innerH, 0]);
          axes(ctx, x2, y2, {
            xTicks: 3,
            yTicks: 4,
            xLabel: 'ice residual',
            yLabel: 'drown residual',
          });
          ctx.g
            .append('g')
            .selectAll('circle')
            .data(rx)
            .join('circle')
            .attr('cx', (d) => x2(d))
            .attr('cy', (d, i) => y2(ry[i]))
            .attr('r', 3)
            .attr('fill', ctx.c.series[1])
            .attr('opacity', 0.7);
        }
      },
    });
  });
  function update() {
    build();
    var xs = data.map((d) => d.x);
    var ys = data.map((d) => d.y);
    var zs = data.map((d) => d.z);
    var rxy = pearson(xs, ys);
    var rxz = pearson(xs, zs);
    var ryz = pearson(ys, zs);
    var part = partialCorrelation(rxy, rxz, ryz);
    var bandsR = [
      [-99, 8],
      [8, 14],
      [14, 20],
      [20, 26],
      [26, 99],
    ]
      .map(function (bd) {
        var sub = data.filter((d) => d.z >= bd[0] && d.z < bd[1]);
        return sub.length > 4
          ? pearson(
              sub.map((d) => d.x),
              sub.map((d) => d.y),
            )
          : null;
      })
      .filter((v) => v !== null);
    titles[0].innerHTML =
      panels[0] + '<br><small>Pearson ' + fmt(rxy, 2) + ' · color = temperature</small>';
    titles[1].innerHTML =
      panels[1] +
      '<br><small>r within bands ' +
      fmt(d3.min(bandsR), 2) +
      ' … ' +
      fmt(d3.max(bandsR), 2) +
      '</small>';
    titles[2].innerHTML = panels[2] + '<br><small>Partial correlation ' + fmt(part, 2) + '</small>';
    set([
      { k: 'ρxy', v: fmt(rxy, 2), hot: true },
      { k: 'ρxz', v: fmt(rxz, 2) },
      { k: 'ρyz', v: fmt(ryz, 2) },
      { k: 'ρ(x, y | z)', v: fmt(part, 2), hot: true, color: seriesVar(1) },
      {
        k: 'Verdict',
        v:
          '<span style="font-size:0.95rem">' +
          (Math.abs(part) < 0.15 && Math.abs(rxy) > 0.3
            ? 'spurious'
            : Math.abs(part) >= 0.15
              ? 'survives z'
              : 'weak') +
          '</span>',
      },
    ]);
    charts.forEach((c) => c.redraw());
  }
  update();
}

/* ---- 2.8 common trend ------------------------------------------------------- */

function trend() {
  var host = document.getElementById('trend-chart');
  var ctl = document.getElementById('trend-controls');
  var years = d3.range(2007, 2026);
  var g = normalSampler(rng(77));
  var phones = years.map((y, i) => 120 + 1300 / (1 + Math.exp(-(i - 6) / 2)) + g() * 40);
  var life = years.map((y, i) => 79 + i * 0.17 + g() * 0.18);
  var mode = 'levels';
  var seg = segmented({
    label: 'Series',
    value: mode,
    options: [
      { value: 'levels', label: 'Raw levels' },
      { value: 'diff', label: 'Differenced' },
    ],
    onChange: function (v) {
      mode = v;
      c.redraw();
    },
  });
  var out = el('div');
  ctl.append(
    seg.el,
    out,
    el(
      'p',
      'ctl-note',
      'Both series grow with time, so they correlate strongly. Differencing (year-over-year change) removes the trend, and the correlation collapses. Numbers are illustrative.',
    ),
  );
  var set = readout(out);
  function diff(a) {
    return a.slice(1).map((v, i) => v - a[i]);
  }
  var c = chart(host, {
    aspect: 0.62,
    margin: { top: 18, right: 14, bottom: 30, left: 46 },
    draw: function (ctx) {
      var A = mode === 'levels' ? phones : diff(phones);
      var B = mode === 'levels' ? life : diff(life);
      var yrs = mode === 'levels' ? years : years.slice(1);
      var h = (ctx.innerH - 30) / 2;
      var x = d3.scaleLinear().domain(d3.extent(yrs)).range([0, ctx.innerW]);
      [
        [A, 'smartphones sold (M)', ctx.c.series[0], 0],
        [B, 'life expectancy (y)', ctx.c.series[1], h + 30],
      ].forEach(function (s) {
        var g2 = ctx.g.append('g').attr('transform', 'translate(0,' + s[3] + ')');
        var y = d3
          .scaleLinear()
          .domain(pad(d3.extent(s[0]), 0.1))
          .range([h, 0]);
        g2.append('g')
          .attr('class', 'axis')
          .call(d3.axisLeft(y).ticks(3).tickFormat(d3.format('~r')));
        g2.append('g')
          .attr('class', 'axis')
          .attr('transform', 'translate(0,' + h + ')')
          .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format('d')));
        g2.append('text').attr('class', 'axis-label').attr('x', 4).attr('y', 4).text(s[1]);
        g2.append('path')
          .datum(s[0])
          .attr(
            'd',
            d3
              .line()
              .x((v, i) => x(yrs[i]))
              .y((v) => y(v)),
          )
          .attr('fill', 'none')
          .attr('stroke', s[2])
          .attr('stroke-width', 2);
      });
      set([
        { k: 'r (levels)', v: fmt(pearson(phones, life), 2), hot: mode === 'levels' },
        {
          k: 'r (differenced)',
          v: fmt(pearson(diff(phones), diff(life)), 2),
          hot: mode === 'diff',
        },
      ]);
    },
  });
}

/* ---- 2.9 rain & umbrellas ----------------------------------------------------- */

function rain() {
  var host = document.getElementById('rain-chart');
  var ctl = document.getElementById('rain-controls');
  var set = readout(document.getElementById('rain-readout'));
  var px = 0.3;
  var py = 0.2;
  var pxy = 0.15;
  function clampJoint() {
    var lo = Math.max(0, px + py - 1);
    var hi = Math.min(px, py);
    pxy = Math.max(lo, Math.min(hi, pxy));
    sj.input.min = lo;
    sj.input.max = hi;
    sj.value = pxy;
  }
  var sx = slider({
    label: 'p(rain = Yes)',
    min: 0.05,
    max: 0.95,
    step: 0.01,
    value: px,
    format: (v) => v.toFixed(2),
    onInput: function (v) {
      px = v;
      clampJoint();
      c.redraw();
    },
  });
  var sy = slider({
    label: 'p(umbrella = Yes)',
    min: 0.05,
    max: 0.95,
    step: 0.01,
    value: py,
    format: (v) => v.toFixed(2),
    onInput: function (v) {
      py = v;
      clampJoint();
      c.redraw();
    },
  });
  var sj = slider({
    label: 'p(rain = Yes, umbrella = Yes)',
    min: 0,
    max: 0.2,
    step: 0.005,
    value: pxy,
    format: (v) => v.toFixed(3),
    onInput: function (v) {
      pxy = v;
      c.redraw();
    },
  });
  var indep = button('Make them independent', function () {
    pxy = Math.round(px * py * 1000) / 1000;
    sj.value = pxy;
    c.redraw();
  });
  var reset = button('Course values', function () {
    px = 0.3;
    py = 0.2;
    pxy = 0.15;
    sx.value = px;
    sy.value = py;
    clampJoint();
    c.redraw();
  });
  var act = el('div', 'ctl-actions');
  act.append(indep, reset);
  ctl.append(sx.el, sy.el, sj.el, act);
  clampJoint();
  var c = chart(host, {
    height: function (w) {
      return w < 520 ? Math.round(w * 1.05) : Math.round(w * 0.62);
    },
    margin: { top: 30, right: 6, bottom: 10, left: 62 },
    draw: function (ctx) {
      var narrow = ctx.innerW < 420;
      var cells = [
        { x: 'Yes', y: 'Yes', p: pxy, q: px * py },
        { x: 'Yes', y: 'No', p: px - pxy, q: px * (1 - py) },
        { x: 'No', y: 'Yes', p: py - pxy, q: (1 - px) * py },
        { x: 'No', y: 'No', p: 1 - px - py + pxy, q: (1 - px) * (1 - py) },
      ];
      cells.forEach((cl) => {
        cl.contrib = cl.p > 0 ? cl.p * Math.log2(cl.p / cl.q) : 0;
      });
      var mi = d3.sum(cells, (cl) => cl.contrib);
      var X = d3.scaleBand().domain(['Yes', 'No']).range([0, ctx.innerW]).padding(0.06);
      var Y = d3.scaleBand().domain(['Yes', 'No']).range([0, ctx.innerH]).padding(0.08);
      ctx.g
        .append('text')
        .attr('class', 'label')
        .attr('x', ctx.innerW / 2)
        .attr('y', -14)
        .attr('text-anchor', 'middle')
        .text('umbrella');
      ['Yes', 'No'].forEach(function (v) {
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', X(v) + X.bandwidth() / 2)
          .attr('y', -2)
          .attr('text-anchor', 'middle')
          .text(v);
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', -12)
          .attr('y', Y(v) + Y.bandwidth() / 2 + 4)
          .attr('text-anchor', 'end')
          .text('rain ' + v);
      });
      var maxC = d3.max(cells, (cl) => Math.abs(cl.contrib)) || 1;
      cells.forEach(function (cl) {
        var gx = X(cl.y);
        var gy = Y(cl.x);
        var w = X.bandwidth();
        var h = Y.bandwidth();
        var cg = ctx.g.append('g').attr('transform', 'translate(' + gx + ',' + gy + ')');
        cg.append('rect')
          .attr('width', w)
          .attr('height', h)
          .attr('rx', 6)
          .attr('fill', ctx.c.diverging(cl.contrib / maxC))
          .attr('fill-opacity', 0.32)
          .attr('stroke', ctx.c.diverging(cl.contrib / maxC))
          .attr('stroke-width', 1.5);
        var bw = Math.min(28, w * 0.14);
        var sc = d3
          .scaleLinear()
          .domain([0, 1])
          .range([0, h - 80]);
        [
          [cl.p, ctx.c.text, 'p(x,y)'],
          [cl.q, ctx.c.soft, 'p(x)p(y)'],
        ].forEach(function (b, k) {
          var bx = w - 16 - (2 - k) * (bw + 6);
          cg.append('rect')
            .attr('x', bx)
            .attr('width', bw)
            .attr('y', h - 30 - sc(b[0]))
            .attr('height', Math.max(1, sc(b[0])))
            .attr('rx', 3)
            .attr('fill', b[1])
            .attr('opacity', k ? 0.5 : 0.9);
        });
        cg.append('text')
          .attr('class', 'label')
          .attr('x', 10)
          .attr('y', 20)
          .text('p(x,y) = ' + fmt(cl.p, 3));
        cg.append('text')
          .attr('x', 10)
          .attr('y', 36)
          .text('p(x)p(y) = ' + fmt(cl.q, 3));
        if (!narrow)
          cg.append('text')
            .attr('x', 10)
            .attr('y', 52)
            .text(
              'ratio ' +
                (cl.q ? fmt(cl.p / cl.q, 2) : '—') +
                ' → log₂ ' +
                (cl.p ? fmt(Math.log2(cl.p / cl.q), 2) : '—'),
            );
        cg.append('text')
          .attr('class', 'label')
          .attr('x', 10)
          .attr('y', h - 12)
          .style('font-size', '13px')
          .text((cl.contrib >= 0 ? '+' : '') + fmt(cl.contrib, 4) + ' bits');
      });
      set([
        { k: 'MI(x, y)', v: fmt(mi, 4) + ' bits', hot: true },
        { k: 'Independent?', v: Math.abs(pxy - px * py) < 1e-3 ? 'yes, MI = 0' : 'no' },
      ]);
    },
  });
}

/* ---- 2.9 shapes ---------------------------------------------------------------- */

function shapes() {
  var host = document.getElementById('shape-chart');
  var ctl = document.getElementById('shape-controls');
  var set = readout(document.getElementById('shape-readout'));
  var kind = 'parabola';
  var noise = 0.1;
  var n = 400;
  var KINDS = {
    linear: (t) => t,
    exponential: (t) => Math.exp(3 * t) / 10,
    parabola: (t) => t * t,
    circle: null,
    sine: (t) => Math.sin(t * 3 * Math.PI),
    independent: null,
  };
  var sk = select({
    label: 'Relationship',
    value: kind,
    options: Object.keys(KINDS).map((k) => ({ value: k, label: k })),
    onChange: function (v) {
      kind = v;
      c.redraw();
    },
  });
  var sn = slider({
    label: 'Noise',
    min: 0,
    max: 1,
    step: 0.02,
    value: noise,
    onInput: function (v) {
      noise = v;
      c.redraw();
    },
  });
  ctl.append(
    sk.el,
    sn.el,
    el(
      'p',
      'ctl-note',
      'MI is estimated by binning both variables into 10 equal-width bins. It stays high for the parabola, the circle and the sine, where both correlation coefficients are blind.',
    ),
  );
  var c = chart(host, {
    aspect: 0.62,
    margin: { top: 14, right: 14, bottom: 30, left: 36 },
    draw: function (ctx) {
      var r = rng(31);
      var g = normalSampler(r);
      var pts = d3.range(n).map(function () {
        var t = r() * 2 - 1;
        if (kind === 'circle') {
          var a = r() * Math.PI * 2;
          return [Math.cos(a) + g() * noise * 0.6, Math.sin(a) + g() * noise * 0.6];
        }
        if (kind === 'independent') return [t, r() * 2 - 1];
        return [t, KINDS[kind](t) + g() * noise];
      });
      var xs = pts.map((p) => p[0]);
      var ys = pts.map((p) => p[1]);
      var x = d3
        .scaleLinear()
        .domain(pad(d3.extent(xs)))
        .range([0, ctx.innerW]);
      var y = d3
        .scaleLinear()
        .domain(pad(d3.extent(ys)))
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, { xTicks: 5, yTicks: 5 });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(pts)
        .join('circle')
        .attr('cx', (p) => x(p[0]))
        .attr('cy', (p) => y(p[1]))
        .attr('r', 2.6)
        .attr('fill', ctx.c.text)
        .attr('opacity', 0.55);
      var mi = mutualInformation(binIndex(xs, 10), binIndex(ys, 10));
      set([
        { k: 'Pearson', v: fmt(pearson(xs, ys), 2), hot: true, color: seriesVar(1) },
        { k: 'Spearman', v: fmt(spearman(xs, ys), 2), hot: true, color: seriesVar(2) },
        { k: 'MI (bits)', v: fmt(mi, 2), hot: true },
      ]);
    },
  });
}

/* ---- 2.10 Titanic ------------------------------------------------------------- */

function titanic(rows) {
  var rateHost = document.getElementById('tit-rate');
  var miHost = document.getElementById('tit-mi');
  var ctl = document.getElementById('tit-controls');
  function ageBand(a) {
    if (a === null || a === undefined) return 'unknown';
    if (a < 12) return '0–11';
    if (a < 18) return '12–17';
    if (a < 30) return '18–29';
    if (a < 45) return '30–44';
    if (a < 60) return '45–59';
    return '60+';
  }
  var fareQ = d3.quantile(rows.map((r) => r.Fare).sort(d3.ascending), 0.25);
  var fareM = d3.quantile(rows.map((r) => r.Fare).sort(d3.ascending), 0.5);
  var fareT = d3.quantile(rows.map((r) => r.Fare).sort(d3.ascending), 0.75);
  var ATTRS = {
    Sex: (r) => r.Sex,
    Pclass: (r) => 'class ' + r.Pclass,
    Embarked: (r) => r.Embarked || 'unknown',
    'Age band': (r) => ageBand(r.Age),
    'Fare quartile': (r) =>
      r.Fare <= fareQ ? 'Q1' : r.Fare <= fareM ? 'Q2' : r.Fare <= fareT ? 'Q3' : 'Q4',
    SibSp: (r) => String(Math.min(r.SibSp, 3)) + (r.SibSp >= 3 ? '+' : ''),
    Parch: (r) => String(Math.min(r.Parch, 3)) + (r.Parch >= 3 ? '+' : ''),
    'Has cabin': (r) => (r.Cabin ? 'yes' : 'no'),
  };
  var attr = 'Sex';
  var by = 'none';
  var sa = select({
    label: 'Group by',
    value: attr,
    options: Object.keys(ATTRS).map((k) => ({ value: k, label: k })),
    onChange: function (v) {
      attr = v;
      rc.redraw();
      mc.redraw();
    },
  });
  var sb = select({
    label: 'Split by',
    value: by,
    options: [{ value: 'none', label: 'Nothing' }].concat(
      ['Sex', 'Pclass'].map((k) => ({ value: k, label: k })),
    ),
    onChange: function (v) {
      by = v;
      rc.redraw();
    },
  });
  ctl.append(
    sa.el,
    sb.el,
    el(
      'p',
      'ctl-note',
      '“Women and children first”: Sex carries the most information about survival, then class and fare. Split by Sex to see class matter within each group.',
    ),
  );
  var surv = rows.map((r) => r.Survived);
  var rc = chart(rateHost, {
    aspect: 0.85,
    margin: { top: 24, right: 10, bottom: 34, left: 40 },
    draw: function (ctx) {
      var f = ATTRS[attr];
      var groups = Array.from(new Set(rows.map(f))).sort();
      var splits =
        by === 'none' ? ['all'] : Array.from(new Set(rows.map(ATTRS[by] || ((r) => r[by])))).sort();
      var sf = by === 'none' ? () => 'all' : ATTRS[by] || ((r) => r[by]);
      var x0 = d3.scaleBand().domain(groups).range([0, ctx.innerW]).padding(0.2);
      var x1 = d3.scaleBand().domain(splits).range([0, x0.bandwidth()]).padding(0.08);
      var y = d3.scaleLinear().domain([0, 1]).range([ctx.innerH, 0]);
      axes(ctx, x0, y, { yAxis: d3.axisLeft(y).tickFormat(d3.format('.0%')).ticks(5) });
      var overall = mean(surv);
      ctx.g
        .append('line')
        .attr('x1', 0)
        .attr('x2', ctx.innerW)
        .attr('y1', y(overall))
        .attr('y2', y(overall))
        .attr('stroke', ctx.c.accent)
        .attr('stroke-dasharray', '4 3');
      ctx.g
        .append('text')
        .attr('class', 'label label--accent')
        .attr('x', ctx.innerW)
        .attr('y', y(overall) - 5)
        .attr('text-anchor', 'end')
        .text('overall ' + d3.format('.0%')(overall));
      groups.forEach(function (gk) {
        splits.forEach(function (sk, si) {
          var sub = rows.filter((r) => f(r) === gk && sf(r) === sk);
          if (!sub.length) return;
          var rate = mean(sub.map((r) => r.Survived));
          ctx.g
            .append('rect')
            .attr('x', x0(gk) + x1(sk))
            .attr('width', x1.bandwidth())
            .attr('y', y(rate))
            .attr('height', ctx.innerH - y(rate))
            .attr('rx', 3)
            .attr('fill', by === 'none' ? ctx.c.text : ctx.c.series[si % 5])
            .attr('opacity', 0.8)
            .on('pointerenter', function (e) {
              showTip(
                e,
                '<b>' +
                  gk +
                  (by === 'none' ? '' : ' · ' + sk) +
                  '</b><br>survived ' +
                  d3.format('.1%')(rate) +
                  ' of ' +
                  sub.length,
              );
            })
            .on('pointerleave', hideTip);
        });
      });
      if (by !== 'none')
        legend(
          ctx,
          splits.map((s, i) => ({ label: String(s), color: ctx.c.series[i % 5] })),
          { y: -12, left: true },
        );
    },
  });
  var mc = chart(miHost, {
    aspect: 0.85,
    margin: { top: 10, right: 40, bottom: 30, left: 84 },
    draw: function (ctx) {
      var data = Object.keys(ATTRS)
        .map(function (k) {
          return { k: k, mi: mutualInformation(rows.map(ATTRS[k]), surv) };
        })
        .sort((a, b) => b.mi - a.mi);
      var y = d3
        .scaleBand()
        .domain(data.map((d) => d.k))
        .range([0, ctx.innerH])
        .padding(0.25);
      var x = d3
        .scaleLinear()
        .domain([0, d3.max(data, (d) => d.mi) * 1.1])
        .range([0, ctx.innerW]);
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(d3.axisBottom(x).ticks(4));
      ctx.g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0));
      ctx.g
        .selectAll('rect.v')
        .data(data)
        .join('rect')
        .attr('x', 0)
        .attr('y', (d) => y(d.k))
        .attr('height', y.bandwidth())
        .attr('width', (d) => x(d.mi))
        .attr('rx', 3)
        .attr('fill', (d) => (d.k === attr ? ctx.c.accent : ctx.c.text))
        .attr('opacity', (d) => (d.k === attr ? 1 : 0.5));
      ctx.g
        .selectAll('text.v')
        .data(data)
        .join('text')
        .attr('class', 'label')
        .attr('x', (d) => x(d.mi) + 4)
        .attr('y', (d) => y(d.k) + y.bandwidth() / 2 + 4)
        .text((d) => fmt(d.mi, 3));
    },
  });
}
