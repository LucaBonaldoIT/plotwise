import { shell, onReady } from '../scripts/shell.js';
import { initArt } from '../scripts/art.js';
import { createPca3d } from '../scripts/pca3d.js';
import { chart, axes, d3, showTip, hideTip, legend, colors, seriesVar } from '../lib/chart.js';
import { slider, segmented, select, toggle, button, readout, el } from '../lib/ui.js';
import { tex } from '../lib/math.js';
import { loadCsv, UK_FOOD, PARTIES, POLITICS_USER, citizens, blobs } from '../lib/data.js';
import { createTsne } from '../lib/tsne.js';
import { pca, dist, mean, pearson, rng, normalSampler, standardize, fmt } from '../lib/stats.js';

shell();

onReady(function () {
  initArt(document.getElementById('art'), 'cloud');
  curse();
  pca3dLab();
  eigenLab();
  blobsLab();
  shapes1d();
  tsneLab();
  ukLab();
  politics();
  loadCsv('iris.csv').then(function (rows) {
    scree(rows);
    recon(rows);
    weights(rows);
    biplot(rows);
  });
});

var SPECIES = ['setosa', 'versicolor', 'virginica'];
var IRIS_DIMS = ['sepal_length', 'sepal_width', 'petal_length', 'petal_width'];

function irisMatrix(rows) {
  return rows.map((r) => IRIS_DIMS.map((d) => r[d]));
}

function pad(ext, f) {
  var d = (ext[1] - ext[0]) * (f || 0.08) || 1;
  return [ext[0] - d, ext[1] + d];
}

/** Square-ish scatter domain so distances are not distorted */
function equalDomains(xs, ys, w, h) {
  var ex = pad(d3.extent(xs));
  var ey = pad(d3.extent(ys));
  var sx = (ex[1] - ex[0]) / w;
  var sy = (ey[1] - ey[0]) / h;
  var s = Math.max(sx, sy);
  var cx = (ex[0] + ex[1]) / 2;
  var cy = (ey[0] + ey[1]) / 2;
  return {
    x: [cx - (s * w) / 2, cx + (s * w) / 2],
    y: [cy - (s * h) / 2, cy + (s * h) / 2],
  };
}

/* ---- 3.2 curse of dimensionality ------------------------------------------ */

function curse() {
  var host = document.getElementById('curse-chart');
  var ctl = document.getElementById('curse-controls');
  var set = readout(document.getElementById('curse-readout'));
  var DIMS = [1, 2, 3, 5, 10, 20, 50, 100, 200, 500, 1000];
  var di = 2;
  var s = slider({
    label: 'Dimensions d',
    min: 0,
    max: DIMS.length - 1,
    value: di,
    format: (v) => String(DIMS[v]),
    onInput: function (v) {
      di = v;
      c.redraw();
    },
  });
  ctl.append(
    s.el,
    el(
      'p',
      'ctl-note',
      '150 random points in the unit hypercube. The histogram shows all pairwise distances divided by their mean. As d grows, every distance is about the same: “nearest” stops meaning anything.',
    ),
  );
  var cache = {};
  function distances(d) {
    if (cache[d]) return cache[d];
    var r = rng(d * 13 + 1);
    var pts = d3.range(150).map(() => d3.range(d).map(() => r()));
    var ds = [];
    for (var i = 0; i < pts.length; i++)
      for (var j = i + 1; j < pts.length; j++) ds.push(dist(pts[i], pts[j]));
    var m = mean(ds);
    cache[d] = { rel: ds.map((v) => v / m), min: d3.min(ds), max: d3.max(ds) };
    return cache[d];
  }
  var c = chart(host, {
    aspect: 0.48,
    margin: { top: 16, right: 14, bottom: 34, left: 44 },
    draw: function (ctx) {
      var d = DIMS[di];
      var r = distances(d);
      var x = d3.scaleLinear().domain([0, 2.6]).range([0, ctx.innerW]);
      var b = d3.bin().domain(x.domain()).thresholds(52)(r.rel);
      var y = d3
        .scaleLinear()
        .domain([0, d3.max(b, (q) => q.length / r.rel.length) * 1.1])
        .range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xLabel: 'distance / mean distance',
        yAxis: d3.axisLeft(y).ticks(4).tickFormat(d3.format('.0%')),
      });
      ctx.g
        .append('g')
        .selectAll('rect')
        .data(b)
        .join('rect')
        .attr('x', (q) => x(q.x0) + 0.5)
        .attr('width', (q) => Math.max(0, x(q.x1) - x(q.x0) - 1))
        .attr('y', (q) => y(q.length / r.rel.length))
        .attr('height', (q) => ctx.innerH - y(q.length / r.rel.length))
        .attr('rx', 1.5)
        .attr('fill', ctx.c.accent)
        .attr('opacity', 0.8);
      set([
        { k: 'd', v: d },
        { k: 'Nearest pair', v: fmt(r.min, 3) },
        { k: 'Farthest pair', v: fmt(r.max, 3) },
        { k: '(max − min) / min', v: fmt((r.max - r.min) / r.min, 2), hot: true },
      ]);
    },
  });
}

/* ---- 3.3 the 3D lab ------------------------------------------------------- */

function pca3dLab() {
  var host = document.getElementById('pca3d');
  var ctl = document.getElementById('pca3d-controls');
  var status = document.getElementById('pca3d-status');
  var set = readout(document.getElementById('pca3d-readout'));
  var pmat = document.getElementById('pmatrix');
  var latest = null;
  var c2;
  var cs;

  var api = createPca3d(host, function (st) {
    latest = st;
    var share = st.projVar / st.total;
    var best = st.pcaVar / st.total;
    status.textContent =
      api && api.state.mode === 'user'
        ? 'your plane keeps ' + d3.format('.1%')(share)
        : 'PCA plane keeps ' + d3.format('.1%')(best);
    set([
      { k: 'λ₁', v: fmt(st.eig[0].value, 2), color: seriesVar(0), hot: true },
      { k: 'λ₂', v: fmt(st.eig[1].value, 2), color: seriesVar(1), hot: true },
      { k: 'λ₃', v: fmt(st.eig[2].value, 2), color: seriesVar(2), hot: true },
      { k: 'Plane keeps', v: d3.format('.1%')(share), hot: true },
      { k: 'PCA best', v: d3.format('.1%')(best) },
      {
        k: 'Score',
        v: Math.round((st.projVar / st.pcaVar) * 100) + ' / 100',
      },
    ]);
    if (pmat) {
      var P = [st.P1, st.P2];
      tex(
        pmat,
        'P = \\begin{bmatrix} ' +
          [0, 1, 2].map((r) => fmt(P[0][r], 3) + ' & ' + fmt(P[1][r], 3)).join(' \\\\ ') +
          ' \\end{bmatrix} \\quad \\text{keeps } ' +
          (share * 100).toFixed(1) +
          '\\% \\text{ of the variance}',
        true,
      );
    }
    if (c2) c2.redraw();
    if (cs) cs.redraw();
  });
  if (!api) return;

  var shape = el('div', 'ctl');
  shape.style.gap = '0.9rem';
  var sl = [
    ['s1', 'Spread along axis a', 0.2, 3, 0.05],
    ['s2', 'Spread along axis b', 0.2, 3, 0.05],
    ['s3', 'Spread along axis c', 0.05, 3, 0.05],
    ['yaw', 'Rotate (yaw)', -180, 180, 1],
    ['pitch', 'Rotate (pitch)', -90, 90, 1],
  ].map(function (d) {
    var s = slider({
      label: d[1],
      min: d[2],
      max: d[3],
      step: d[4],
      value: api.state[d[0]],
      format: (v) => (d[4] === 1 ? v + '°' : v.toFixed(2)),
      onInput: function (v) {
        var p = {};
        p[d[0]] = v;
        api.set(p);
      },
    });
    shape.append(s.el);
    return s;
  });
  var presets = el('div', 'ctl-actions');
  [
    ['Cigar', [3, 0.4, 0.3]],
    ['Pancake', [2.4, 2.1, 0.15]],
    ['Ball', [1.2, 1.15, 1.1]],
  ].forEach(function (p) {
    presets.append(
      button(p[0], function () {
        sl[0].value = p[1][0];
        sl[1].value = p[1][1];
        sl[2].value = p[1][2];
        api.set({ s1: p[1][0], s2: p[1][1], s3: p[1][2] });
      }),
    );
  });

  var userCtl = el('div', 'ctl');
  userCtl.style.gap = '0.9rem';
  var sTheta = slider({
    label: 'Plane normal: azimuth',
    min: 0,
    max: 360,
    value: 0,
    format: (v) => v + '°',
    onInput: (v) => api.set({ theta: v }),
  });
  var sPhi = slider({
    label: 'Plane normal: elevation',
    min: 0,
    max: 180,
    value: 90,
    format: (v) => v + '°',
    onInput: (v) => api.set({ phi: v }),
  });
  userCtl.append(sTheta.el, sPhi.el);
  userCtl.hidden = true;
  var mode = segmented({
    label: 'Projection plane',
    value: 'pca',
    options: [
      { value: 'pca', label: 'PCA (PC1, PC2)' },
      { value: 'user', label: 'Your plane' },
    ],
    onChange: function (v) {
      userCtl.hidden = v !== 'user';
      api.set({ mode: v });
    },
  });
  var sT = slider({
    label: 'Project onto the plane',
    min: 0,
    max: 1,
    step: 0.01,
    value: 0,
    format: (v) => Math.round(v * 100) + '%',
    onInput: (v) => api.set({ t: v }),
  });
  var playing = 0;
  var play = button(
    '▶ Animate projection',
    function () {
      cancelAnimationFrame(playing);
      var from = api.state.t > 0.5 ? 1 : 0;
      var to = 1 - from;
      var start = performance.now();
      (function step(now) {
        var k = Math.min(1, (now - start) / 1400);
        var v = from + (to - from) * k;
        sT.value = v;
        api.set({ t: v });
        if (k < 1) playing = requestAnimationFrame(step);
      })(start);
    },
    'ds-button--primary',
  );
  var tDrops = toggle({
    label: 'Drop lines x → x̃',
    checked: false,
    onChange: (v) => api.set({ drops: v }),
  });
  var tPcs = toggle({
    label: 'Principal axes',
    checked: true,
    onChange: (v) => api.set({ showPcs: v }),
  });
  var tPlane = toggle({
    label: 'Plane',
    checked: true,
    onChange: (v) => api.set({ showPlane: v }),
  });
  var cam = el('div', 'ctl-actions');
  cam.append(
    button('Look at the plane', () => api.lookAlongNormal()),
    button('Reset view', () => api.resetCamera()),
  );

  function group(title, nodes) {
    var d = el('div', 'ctl');
    d.style.gap = '0.9rem';
    d.append(el('span', 'caps muted', title));
    nodes.forEach((n) => d.append(n));
    return d;
  }
  ctl.append(
    group('Shape the cloud', [presets, shape]),
    group('Project', [mode.el, userCtl, sT.el, play, tDrops.el, tPcs.el, tPlane.el, cam]),
  );

  c2 = chart(document.getElementById('pca3d-2d'), {
    aspect: 0.85,
    margin: { top: 10, right: 10, bottom: 28, left: 32 },
    draw: function (ctx) {
      if (!latest) return;
      var ys = latest.data.map(function (d) {
        var c0 = [d[0] - latest.mu[0], d[1] - latest.mu[1], d[2] - latest.mu[2]];
        return [
          latest.P1[0] * c0[0] + latest.P1[1] * c0[1] + latest.P1[2] * c0[2],
          latest.P2[0] * c0[0] + latest.P2[1] * c0[1] + latest.P2[2] * c0[2],
        ];
      });
      var x = d3.scaleLinear().domain([-7, 7]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([-7, 7]).range([ctx.innerH, 0]);
      axes(ctx, x, y, { xTicks: 5, yTicks: 5, xLabel: 'y₁', yLabel: 'y₂' });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(ys)
        .join('circle')
        .attr('cx', (p) => x(p[0]))
        .attr('cy', (p) => y(p[1]))
        .attr('r', 2.2)
        .attr('fill', ctx.c.accent)
        .attr('opacity', 0.7);
    },
  });
  cs = chart(document.getElementById('pca3d-strips'), {
    aspect: 0.85,
    margin: { top: 10, right: 10, bottom: 28, left: 36 },
    draw: function (ctx) {
      if (!latest) return;
      var rowsDef = [
        ['x₁', [1, 0, 0], ctx.c.text],
        ['x₂', [0, 1, 0], ctx.c.text],
        ['x₃', [0, 0, 1], ctx.c.text],
        ['pc1', latest.eig[0].vector, ctx.c.series[0]],
        ['pc2', latest.eig[1].vector, ctx.c.series[1]],
        ['pc3', latest.eig[2].vector, ctx.c.series[2]],
      ];
      var x = d3.scaleLinear().domain([-7, 7]).range([0, ctx.innerW]);
      var yb = d3
        .scaleBand()
        .domain(rowsDef.map((r) => r[0]))
        .range([0, ctx.innerH])
        .padding(0.3);
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(d3.axisBottom(x).ticks(5));
      ctx.g.append('g').attr('class', 'axis').call(d3.axisLeft(yb).tickSize(0));
      var jit = rng(3);
      rowsDef.forEach(function (r) {
        var vals = latest.data.map(
          (d) =>
            r[1][0] * (d[0] - latest.mu[0]) +
            r[1][1] * (d[1] - latest.mu[1]) +
            r[1][2] * (d[2] - latest.mu[2]),
        );
        ctx.g
          .append('g')
          .selectAll('circle')
          .data(vals)
          .join('circle')
          .attr('cx', (v) => x(v))
          .attr('cy', () => yb(r[0]) + yb.bandwidth() * (0.2 + 0.6 * jit()))
          .attr('r', 1.6)
          .attr('fill', r[2])
          .attr('opacity', 0.45);
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', ctx.innerW)
          .attr('y', yb(r[0]) - 1)
          .attr('text-anchor', 'end')
          .text('var ' + fmt((d3.variance(vals) * (vals.length - 1)) / vals.length, 2));
      });
    },
  });
}

/* ---- 3.5 eigenvector lab --------------------------------------------------- */

function eigenLab() {
  var host = document.getElementById('eig-chart');
  var ctl = document.getElementById('eig-controls');
  var a = 3;
  var b = 1;
  var cxy = 1.2;
  var ang = 20;
  var out = el('div');
  var sa = slider({
    label: 'Var(x₁)',
    min: 0.2,
    max: 4,
    step: 0.1,
    value: a,
    onInput: (v) => ((a = v), c.redraw()),
  });
  var sb = slider({
    label: 'Var(x₂)',
    min: 0.2,
    max: 4,
    step: 0.1,
    value: b,
    onInput: (v) => ((b = v), c.redraw()),
  });
  var sc = slider({
    label: 'Cov(x₁, x₂)',
    min: -1.8,
    max: 1.8,
    step: 0.05,
    value: cxy,
    onInput: (v) => ((cxy = v), c.redraw()),
  });
  var sv = slider({
    label: 'Direction of v',
    min: 0,
    max: 180,
    value: ang,
    format: (v) => v + '°',
    onInput: (v) => ((ang = v), c.redraw()),
  });
  var snap = el('div', 'ctl-actions');
  snap.append(
    button('Snap v to V₁', function () {
      ang = Math.round(eigs().a1);
      sv.value = ang;
      c.redraw();
    }),
  );
  ctl.append(
    sa.el,
    sb.el,
    sc.el,
    sv.el,
    snap,
    out,
    el(
      'p',
      'ctl-note',
      'Σ turns most vectors (grey → black). Rotate v until Σv lies on the same line: that is an eigenvector, and the stretch factor is its eigenvalue λ.',
    ),
  );
  var set = readout(out);
  function eigs() {
    var tr = a + b;
    var det = a * b - cxy * cxy;
    var disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    var l1 = tr / 2 + disc;
    var l2 = tr / 2 - disc;
    var a1 = Math.abs(cxy) < 1e-9 ? (a >= b ? 0 : 90) : (Math.atan2(l1 - a, cxy) * 180) / Math.PI;
    if (a1 < 0) a1 += 180;
    return { l1: l1, l2: l2, a1: a1 };
  }
  var c = chart(host, {
    height: function (w) {
      return Math.min(w, 420);
    },
    fill: true,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    draw: function (ctx) {
      var e = eigs();
      var size = Math.min(ctx.innerW, ctx.innerH);
      var s = d3.scaleLinear().domain([-5, 5]).range([0, size]);
      var g = ctx.g
        .append('g')
        .attr(
          'transform',
          'translate(' + (ctx.innerW - size) / 2 + ',' + (ctx.innerH - size) / 2 + ')',
        );
      var X = (v) => s(v);
      var Y = (v) => size - s(v);
      g.append('line')
        .attr('x1', X(-5))
        .attr('x2', X(5))
        .attr('y1', Y(0))
        .attr('y2', Y(0))
        .attr('stroke', ctx.c.line);
      g.append('line')
        .attr('x1', X(0))
        .attr('x2', X(0))
        .attr('y1', Y(-5))
        .attr('y2', Y(5))
        .attr('stroke', ctx.c.line);
      // unit circle and its image (an ellipse)
      var circ = d3
        .range(0, 361, 4)
        .map((t) => [Math.cos((t * Math.PI) / 180), Math.sin((t * Math.PI) / 180)]);
      var line = d3
        .line()
        .x((p) => X(p[0]))
        .y((p) => Y(p[1]));
      g.append('path')
        .attr('d', line(circ))
        .attr('fill', 'none')
        .attr('stroke', ctx.c.strong)
        .attr('stroke-dasharray', '3 3');
      g.append('path')
        .attr('d', line(circ.map((p) => [a * p[0] + cxy * p[1], cxy * p[0] + b * p[1]])))
        .attr('fill', ctx.c.accent)
        .attr('fill-opacity', 0.06)
        .attr('stroke', ctx.c.accent)
        .attr('stroke-opacity', 0.5);
      // eigen lines
      [
        [e.a1, ctx.c.series[0], 'V₁'],
        [e.a1 + 90, ctx.c.series[1], 'V₂'],
      ].forEach(function (q) {
        var r = (q[0] * Math.PI) / 180;
        g.append('line')
          .attr('x1', X(-5 * Math.cos(r)))
          .attr('y1', Y(-5 * Math.sin(r)))
          .attr('x2', X(5 * Math.cos(r)))
          .attr('y2', Y(5 * Math.sin(r)))
          .attr('stroke', q[1])
          .attr('stroke-opacity', 0.35)
          .attr('stroke-width', 6);
        g.append('text')
          .attr('class', 'label')
          .style('fill', q[1])
          .attr('x', X(4.4 * Math.cos(r)))
          .attr('y', Y(4.4 * Math.sin(r)))
          .text(q[2]);
      });
      // v and Σv
      var rv = (ang * Math.PI) / 180;
      var v = [Math.cos(rv), Math.sin(rv)];
      var Sv = [a * v[0] + cxy * v[1], cxy * v[0] + b * v[1]];
      function arrow(p, color, w) {
        g.append('line')
          .attr('x1', X(0))
          .attr('y1', Y(0))
          .attr('x2', X(p[0]))
          .attr('y2', Y(p[1]))
          .attr('stroke', color)
          .attr('stroke-width', w)
          .attr('stroke-linecap', 'round');
        g.append('circle')
          .attr('cx', X(p[0]))
          .attr('cy', Y(p[1]))
          .attr('r', w + 1.5)
          .attr('fill', color);
      }
      arrow(Sv, ctx.c.text, 3);
      arrow(v, ctx.c.soft, 3);
      g.append('text')
        .attr('class', 'label')
        .attr('x', X(v[0]) + 6)
        .attr('y', Y(v[1]) - 6)
        .text('v');
      g.append('text')
        .attr('class', 'label')
        .attr('x', X(Sv[0]) + 6)
        .attr('y', Y(Sv[1]) - 6)
        .text('Σv');
      var cosang = (v[0] * Sv[0] + v[1] * Sv[1]) / Math.hypot(Sv[0], Sv[1]);
      var aligned = Math.abs(Math.abs(cosang) - 1) < 0.0015;
      set([
        { k: 'λ₁', v: fmt(e.l1, 3), color: seriesVar(0), hot: true },
        { k: 'λ₂', v: fmt(e.l2, 3), color: seriesVar(1), hot: true },
        { k: '‖Σv‖ / ‖v‖', v: fmt(Math.hypot(Sv[0], Sv[1]), 3) },
        { k: 'v ∥ Σv?', v: aligned ? 'yes: eigenvector!' : 'no', hot: aligned },
      ]);
    },
  });
}

/* ---- 3.5 scree + covariance ------------------------------------------------ */

function scree(irisRows) {
  var host = document.getElementById('scree');
  var covHost = document.getElementById('covmat');
  var ctl = document.getElementById('scree-controls');
  var set = readout(document.getElementById('scree-readout'));
  var ds = 'iris';
  var std0 = true;
  var t = 0.95;
  var DATA = {
    iris: { rows: irisMatrix(irisRows), names: IRIS_DIMS.map((d) => d.replace('_', ' ')) },
    uk: {
      rows: UK_FOOD.countries.map((c, j) => UK_FOOD.foods.map((f) => f[j + 1])),
      names: UK_FOOD.foods.map((f) => f[0]),
    },
    blobs: { rows: blobs(false).rows, names: ['d1', 'd2', 'd3', 'd4', 'd5'] },
    blobsNoise: {
      rows: blobs(true).rows,
      names: ['d1', 'd2', 'd3', 'd4', 'd5', 'noise1', 'noise2'],
    },
  };
  var sd = select({
    label: 'Dataset',
    value: ds,
    options: [
      { value: 'iris', label: 'Iris (4D)' },
      { value: 'uk', label: 'Eating in the UK (17D)' },
      { value: 'blobs', label: '4 blobs (5D)' },
      { value: 'blobsNoise', label: '4 blobs + 2 noisy features (7D)' },
    ],
    onChange: function (v) {
      ds = v;
      both();
    },
  });
  var ss = toggle({
    label: 'Standardize first',
    checked: std0,
    onChange: function (v) {
      std0 = v;
      both();
    },
  });
  var st = slider({
    label: 'Information to keep t',
    min: 0.5,
    max: 0.99,
    step: 0.01,
    value: t,
    format: (v) => Math.round(v * 100) + '%',
    onInput: function (v) {
      t = v;
      c.redraw();
    },
  });
  ctl.append(sd.el, ss.el, st.el);
  function result() {
    return pca(DATA[ds].rows, { standardize: std0, k: 2 });
  }
  function both() {
    c.redraw();
    cc.redraw();
  }
  var c = chart(host, {
    aspect: 0.8,
    margin: { top: 16, right: 14, bottom: 30, left: 40 },
    draw: function (ctx) {
      var r = result();
      var lam = r.eig.map((e) => e.value).filter((v, i) => i < 10);
      var cum = [];
      r.explained.reduce((s, v, i) => ((cum[i] = s + v), s + v), 0);
      var kSel = cum.findIndex((v) => v >= t - 1e-12) + 1;
      var x = d3
        .scaleBand()
        .domain(lam.map((_, i) => i + 1))
        .range([0, ctx.innerW])
        .padding(0.25);
      var y = d3.scaleLinear().domain([0, 1]).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        yAxis: d3.axisLeft(y).ticks(5).tickFormat(d3.format('.0%')),
        xLabel: 'component i',
      });
      ctx.g
        .append('g')
        .selectAll('rect')
        .data(r.explained.slice(0, lam.length))
        .join('rect')
        .attr('x', (v, i) => x(i + 1))
        .attr('width', x.bandwidth())
        .attr('y', (v) => y(v))
        .attr('height', (v) => ctx.innerH - y(v))
        .attr('rx', 3)
        .attr('fill', (v, i) => (i < kSel ? ctx.c.accent : ctx.c.text))
        .attr('opacity', (v, i) => (i < kSel ? 0.9 : 0.35))
        .on('pointerenter', function (e, v) {
          var i = r.explained.indexOf(v);
          showTip(
            e,
            '<b>λ' +
              (i + 1) +
              ' = ' +
              fmt(r.eig[i].value, 3) +
              '</b><br>' +
              d3.format('.1%')(v) +
              ' of the variance',
          );
        })
        .on('pointerleave', hideTip);
      ctx.g
        .append('path')
        .datum(cum.slice(0, lam.length))
        .attr(
          'd',
          d3
            .line()
            .x((v, i) => x(i + 1) + x.bandwidth() / 2)
            .y((v) => y(v)),
        )
        .attr('fill', 'none')
        .attr('stroke', ctx.c.series[1])
        .attr('stroke-width', 2);
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(cum.slice(0, lam.length))
        .join('circle')
        .attr('cx', (v, i) => x(i + 1) + x.bandwidth() / 2)
        .attr('cy', (v) => y(v))
        .attr('r', 4)
        .attr('fill', ctx.c.series[1]);
      ctx.g
        .append('line')
        .attr('x1', 0)
        .attr('x2', ctx.innerW)
        .attr('y1', y(t))
        .attr('y2', y(t))
        .attr('stroke', ctx.c.accent)
        .attr('stroke-dasharray', '4 3');
      ctx.g
        .append('text')
        .attr('class', 'label label--accent')
        .attr('x', ctx.innerW)
        .attr('y', y(t) - 5)
        .attr('text-anchor', 'end')
        .text('t = ' + Math.round(t * 100) + '%');
      set([
        { k: 'Dimensions n', v: DATA[ds].names.length },
        { k: 'k selected', v: kSel, hot: true },
        { k: 'Variance kept', v: d3.format('.1%')(cum[kSel - 1]), hot: true },
        { k: 'PC1 + PC2', v: d3.format('.1%')(cum[1]) },
      ]);
    },
  });
  var cc = chart(covHost, {
    aspect: 0.8,
    margin: { top: 8, right: 8, bottom: 8, left: 8 },
    draw: function (ctx) {
      var r = result();
      var cov = r.cov;
      var n = cov.length;
      var size = Math.min(ctx.innerW, ctx.innerH);
      var cell = size / n;
      var mx = d3.max(cov.flat(), Math.abs) || 1;
      var g = ctx.g.append('g').attr('transform', 'translate(' + (ctx.innerW - size) / 2 + ',0)');
      cov.forEach(function (row, i) {
        row.forEach(function (v, j) {
          g.append('rect')
            .attr('x', j * cell + 0.5)
            .attr('y', i * cell + 0.5)
            .attr('width', cell - 1)
            .attr('height', cell - 1)
            .attr('rx', Math.min(3, cell / 6))
            .attr('fill', ctx.c.diverging(v / mx))
            .on('pointerenter', function (e) {
              showTip(
                e,
                '<b>' + DATA[ds].names[i] + ' × ' + DATA[ds].names[j] + '</b><br>' + fmt(v, 3),
              );
            })
            .on('pointerleave', hideTip);
          if (n <= 7)
            g.append('text')
              .attr('x', j * cell + cell / 2)
              .attr('y', i * cell + cell / 2 + 4)
              .attr('text-anchor', 'middle')
              .style('fill', Math.abs(v / mx) > 0.6 ? '#fff' : ctx.c.text)
              .style('pointer-events', 'none')
              .text(fmt(v, 2));
        });
      });
    },
  });
}

/* ---- 3.6 reconstruction ---------------------------------------------------- */

function recon(rows) {
  var host = document.getElementById('recon-chart');
  var ctl = document.getElementById('recon-controls');
  var set = readout(document.getElementById('recon-readout'));
  var k = 1;
  var dx = 2;
  var dy = 1;
  var sk = slider({
    label: 'Components kept k',
    min: 1,
    max: 4,
    value: k,
    onInput: (v) => ((k = v), c.redraw()),
  });
  var opts = IRIS_DIMS.map((d, i) => ({ value: String(i), label: d.replace('_', ' ') }));
  var sx = select({
    label: 'Horizontal axis',
    value: String(dx),
    options: opts,
    onChange: (v) => ((dx = +v), c.redraw()),
  });
  var sy = select({
    label: 'Vertical axis',
    value: String(dy),
    options: opts,
    onChange: (v) => ((dy = +v), c.redraw()),
  });
  ctl.append(
    sk.el,
    sx.el,
    sy.el,
    el(
      'p',
      'ctl-note',
      'Hollow: the original standardized flowers. Filled: x̃ = Vₖ zₖ, rebuilt from k numbers each. At k = 1 every flower is squeezed onto one line: many distinct flowers collapse onto the same x̃. At k = 4 nothing is lost.',
    ),
  );
  var X = standardize(irisMatrix(rows));
  var res = pca(X, { k: 4 });
  var c = chart(host, {
    aspect: 0.62,
    margin: { top: 16, right: 14, bottom: 34, left: 40 },
    draw: function (ctx) {
      var V = res.eig.slice(0, k).map((e) => e.vector);
      var rec = X.map(function (x) {
        var z = V.map((v) => v.reduce((s, vi, i) => s + vi * x[i], 0));
        return x.map((_, i) => V.reduce((s, v, j) => s + v[i] * z[j], 0));
      });
      var dom = equalDomains(
        X.map((r) => r[dx]),
        X.map((r) => r[dy]),
        ctx.innerW,
        ctx.innerH,
      );
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xLabel: IRIS_DIMS[dx].replace('_', ' ') + ' (std)',
        yLabel: IRIS_DIMS[dy].replace('_', ' ') + ' (std)',
      });
      var g = ctx.g.append('g');
      X.forEach(function (p, i) {
        var col = ctx.c.series[SPECIES.indexOf(rows[i].species)];
        g.append('line')
          .attr('x1', x(p[dx]))
          .attr('y1', y(p[dy]))
          .attr('x2', x(rec[i][dx]))
          .attr('y2', y(rec[i][dy]))
          .attr('stroke', col)
          .attr('stroke-opacity', 0.3);
        g.append('circle')
          .attr('cx', x(p[dx]))
          .attr('cy', y(p[dy]))
          .attr('r', 3.5)
          .attr('fill', 'none')
          .attr('stroke', col)
          .attr('stroke-opacity', 0.6);
        g.append('circle')
          .attr('cx', x(rec[i][dx]))
          .attr('cy', y(rec[i][dy]))
          .attr('r', 3)
          .attr('fill', col);
      });
      legend(
        ctx,
        SPECIES.map((s, i) => ({ label: s, color: ctx.c.series[i] })),
        { y: 4 },
      );
      var mse = mean(
        X.map((p, i) => p.reduce((s, v, j) => s + (v - rec[i][j]) * (v - rec[i][j]), 0)),
      );
      var kept = res.explained.slice(0, k).reduce((s, v) => s + v, 0);
      set([
        { k: 'k', v: k },
        { k: 'Variance kept', v: d3.format('.1%')(kept), hot: true },
        { k: 'Mean ‖x − x̃‖²', v: fmt(mse, 3), hot: true },
      ]);
    },
  });
}

/* ---- 3.7 weights ------------------------------------------------------------ */

function weights(rows) {
  var host = document.getElementById('weights-chart');
  var ctl = document.getElementById('weights-controls');
  var stdz = true;
  var t = toggle({
    label: 'Standardize first',
    checked: true,
    onChange: (v) => ((stdz = v), c.redraw()),
  });
  var note = el('p', 'ctl-note');
  ctl.append(t.el, note);
  var c = chart(host, {
    aspect: 0.62,
    margin: { top: 20, right: 46, bottom: 30, left: 92 },
    draw: function (ctx) {
      var r = pca(irisMatrix(rows), { standardize: stdz, k: 2 });
      var h = (ctx.innerH - 30) / 2;
      var x = d3.scaleLinear().domain([-1, 1]).range([0, ctx.innerW]);
      [0, 1].forEach(function (j) {
        var g = ctx.g.append('g').attr('transform', 'translate(0,' + j * (h + 30) + ')');
        var y = d3.scaleBand().domain(IRIS_DIMS).range([0, h]).padding(0.2);
        g.append('text')
          .attr('class', 'label')
          .attr('x', 0)
          .attr('y', -6)
          .text(
            'V' +
              (j + 1) +
              ' (PC' +
              (j + 1) +
              '): ' +
              d3.format('.1%')(r.explained[j]) +
              ' of the variance',
          );
        g.append('g')
          .attr('class', 'axis')
          .call(
            d3
              .axisLeft(y)
              .tickSize(0)
              .tickFormat((d) => d.replace('_', ' ')),
          );
        g.append('line')
          .attr('x1', x(0))
          .attr('x2', x(0))
          .attr('y1', 0)
          .attr('y2', h)
          .attr('stroke', ctx.c.strong);
        if (j === 1)
          g.append('g')
            .attr('class', 'axis')
            .attr('transform', 'translate(0,' + h + ')')
            .call(d3.axisBottom(x).ticks(5));
        r.eig[j].vector.forEach(function (v, i) {
          g.append('rect')
            .attr('x', x(Math.min(0, v)))
            .attr('width', Math.abs(x(v) - x(0)))
            .attr('y', y(IRIS_DIMS[i]))
            .attr('height', y.bandwidth())
            .attr('rx', 3)
            .attr('fill', ctx.c.series[[0, 1, 3, 4][i]]);
          g.append('text')
            .attr('class', 'label')
            .attr('x', x(v) + (v >= 0 ? 4 : -4))
            .attr('text-anchor', v >= 0 ? 'start' : 'end')
            .attr('y', y(IRIS_DIMS[i]) + y.bandwidth() / 2 + 4)
            .text((v >= 0 ? '+' : '') + fmt(v, 2));
        });
      });
      note.innerHTML = stdz
        ? 'PC1 ≈ flower size, PC2 ≈ sepal width (weight 0.92). Each v²ᵢⱼ is the share of zⱼ due to xᵢ: the squares of each bar set add up to 1.'
        : 'Without standardization, petal length (the attribute with the largest variance, in cm²) dominates PC1 just because of its units.';
    },
  });
}

/* ---- 3.7 biplot ----------------------------------------------------------- */

function biplot(rows) {
  var host = document.getElementById('biplot');
  var ctl = document.getElementById('biplot-controls');
  var picked = [];
  var out = el('div');
  ctl.append(
    out,
    button('Clear selection', function () {
      picked = [];
      c.redraw();
    }),
    el(
      'p',
      'ctl-note',
      'Arrows are loadings vᵢⱼ·√λⱼ: correlations between each attribute and the components. The dashed circle is |corr| = 1; an arrow touching it is fully represented in this plane.',
    ),
  );
  var set = readout(out);
  var X = standardize(irisMatrix(rows));
  var r = pca(X, { k: 2 });
  var c = chart(host, {
    aspect: 0.78,
    margin: { top: 14, right: 14, bottom: 34, left: 40 },
    draw: function (ctx) {
      var dom = equalDomains(
        r.scores.map((s) => s[0]),
        r.scores.map((s) => s[1]),
        ctx.innerW,
        ctx.innerH,
      );
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xLabel: 'z₁ (PC1, ' + d3.format('.1%')(r.explained[0]) + ')',
        yLabel: 'z₂ (PC2, ' + d3.format('.1%')(r.explained[1]) + ')',
      });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(r.scores)
        .join('circle')
        .attr('cx', (s) => x(s[0]))
        .attr('cy', (s) => y(s[1]))
        .attr('r', 3.2)
        .attr('fill', (s, i) => ctx.c.series[SPECIES.indexOf(rows[i].species)])
        .attr('opacity', 0.55);
      var scale = 3; // arrow unit in score units (|corr| = 1 ↔ 3)
      ctx.g
        .append('circle')
        .attr('cx', x(0))
        .attr('cy', y(0))
        .attr('r', x(scale) - x(0))
        .attr('fill', 'none')
        .attr('stroke', ctx.c.strong)
        .attr('stroke-dasharray', '4 4');
      var load = IRIS_DIMS.map((d, i) => [
        r.eig[0].vector[i] * Math.sqrt(r.eig[0].value),
        r.eig[1].vector[i] * Math.sqrt(r.eig[1].value),
      ]);
      load.forEach(function (l, i) {
        var on = picked.indexOf(i) >= 0;
        var col = on ? ctx.c.accent : ctx.c.text;
        var g = ctx.g.append('g').style('cursor', 'pointer');
        g.append('line')
          .attr('x1', x(0))
          .attr('y1', y(0))
          .attr('x2', x(l[0] * scale))
          .attr('y2', y(l[1] * scale))
          .attr('stroke', col)
          .attr('stroke-width', on ? 3 : 2);
        g.append('circle')
          .attr('cx', x(l[0] * scale))
          .attr('cy', y(l[1] * scale))
          .attr('r', 4)
          .attr('fill', col);
        g.append('text')
          .attr('class', 'label' + (on ? ' label--accent' : ''))
          .attr('x', x(l[0] * scale * 1.08))
          .attr('y', y(l[1] * scale * 1.08) + 4)
          .attr('text-anchor', l[0] >= 0 ? 'start' : 'end')
          .text(IRIS_DIMS[i].replace('_', ' '));
        g.append('line')
          .attr('x1', x(0))
          .attr('y1', y(0))
          .attr('x2', x(l[0] * scale))
          .attr('y2', y(l[1] * scale))
          .attr('stroke', 'transparent')
          .attr('stroke-width', 18)
          .on('click', function () {
            if (on) picked = picked.filter((p) => p !== i);
            else picked = picked.concat([i]).slice(-2);
            c.redraw();
          });
      });
      legend(
        ctx,
        SPECIES.map((s, i) => ({ label: s, color: ctx.c.series[i] })),
        { y: 4, left: true },
      );
      var items = load.map((l, i) => ({
        k: IRIS_DIMS[i].replace('_', ' ') + ' length²',
        v: fmt(l[0] * l[0] + l[1] * l[1], 2),
      }));
      if (picked.length === 2) {
        var a = load[picked[0]];
        var b = load[picked[1]];
        var cosv = (a[0] * b[0] + a[1] * b[1]) / (Math.hypot(a[0], a[1]) * Math.hypot(b[0], b[1]));
        var corr = pearson(
          rows.map((rr) => rr[IRIS_DIMS[picked[0]]]),
          rows.map((rr) => rr[IRIS_DIMS[picked[1]]]),
        );
        items = [
          {
            k: 'Angle',
            v: fmt((Math.acos(Math.max(-1, Math.min(1, cosv))) * 180) / Math.PI, 1) + '°',
            hot: true,
          },
          { k: 'cos(angle)', v: fmt(cosv, 2), hot: true },
          { k: 'True correlation', v: fmt(corr, 2), color: seriesVar(1), hot: true },
        ];
      } else
        items.unshift({
          k: 'Pick',
          v: 2 - picked.length + ' arrow' + (picked.length === 1 ? '' : 's'),
        });
      set(items);
    },
  });
}

/* ---- 3.8 blobs --------------------------------------------------------------- */

function blobsLab() {
  var host = document.getElementById('blobs-chart');
  var ctl = document.getElementById('blobs-controls');
  var set = readout(document.getElementById('blobs-readout'));
  var noise = false;
  var t = toggle({
    label: 'Add 2 high-variance random features',
    checked: false,
    onChange: (v) => ((noise = v), c.redraw()),
  });
  ctl.append(
    t.el,
    el(
      'p',
      'ctl-note',
      'Without noise, PC1 separates the far blobs and PC2 the near ones (blobs 1 and 2 overlap a bit: they are close in 5D too). With two noise features of σ = 30, PCA picks the noise directions and the blobs dissolve.',
    ),
  );
  var c = chart(host, {
    aspect: 0.62,
    margin: { top: 18, right: 14, bottom: 34, left: 44 },
    draw: function (ctx) {
      var b = blobs(noise);
      var r = pca(b.rows, { k: 2 });
      var dom = equalDomains(
        r.scores.map((s) => s[0]),
        r.scores.map((s) => s[1]),
        ctx.innerW,
        ctx.innerH,
      );
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      axes(ctx, x, y, { xLabel: 'Principal component 1', yLabel: 'Principal component 2' });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(r.scores)
        .join('circle')
        .attr('cx', (s) => x(s[0]))
        .attr('cy', (s) => y(s[1]))
        .attr('r', 3)
        .attr('fill', (s, i) => ctx.c.series[b.labels[i]])
        .attr('opacity', 0.75);
      legend(
        ctx,
        [0, 1, 2, 3].map((k) => ({ label: 'blob ' + (k + 1), color: ctx.c.series[k] })),
        { y: -6 },
      );
      set([
        { k: 'Explained PC1', v: d3.format('.1%')(r.explained[0]), hot: true },
        { k: 'Explained PC2', v: d3.format('.1%')(r.explained[1]), hot: true },
        { k: 'Dimensions', v: b.rows[0].length },
      ]);
    },
  });
}

/* ---- 3.8 shapes → 1D ---------------------------------------------------------- */

function shapes1d() {
  var orig = document.getElementById('shape-orig');
  var host = document.getElementById('shape-1d');
  var ctl = document.getElementById('shape-controls');
  var kind = 'banana';
  var tsneY = null;
  var running = 0;
  var sk = segmented({
    label: 'Dataset',
    value: kind,
    options: [
      { value: 'banana', label: 'Banana' },
      { value: 'circles', label: 'Circles' },
      { value: 'spiral', label: 'Spiral' },
    ],
    onChange: function (v) {
      kind = v;
      start();
    },
  });
  var status = el('p', 'ctl-note');
  ctl.append(
    sk.el,
    status,
    el(
      'p',
      'ctl-note',
      'Both methods squeeze the 2D shape onto a line. PCA projects along the direction of maximum variance and mixes the classes; t-SNE keeps neighbours together and largely keeps them apart.',
    ),
  );
  function data() {
    var r = rng(7);
    var g = normalSampler(r);
    var pts = [];
    var lab = [];
    for (var i = 0; i < 240; i++) {
      var k = i % 2;
      var t = r();
      var p;
      if (kind === 'banana') {
        var a = Math.PI * t;
        p = k ? [1 - Math.cos(a), 0.5 - Math.sin(a)] : [Math.cos(a), Math.sin(a)];
        p = [p[0] + g() * 0.08, p[1] + g() * 0.08];
      } else if (kind === 'circles') {
        var a2 = 2 * Math.PI * t;
        var rad = k ? 1 : 0.45;
        p = [rad * Math.cos(a2) + g() * 0.05, rad * Math.sin(a2) + g() * 0.05];
      } else {
        var a3 = 0.5 + t * 3 * Math.PI;
        var rr = a3 / (3 * Math.PI);
        p = [
          rr * Math.cos(a3 + k * Math.PI) + g() * 0.03,
          rr * Math.sin(a3 + k * Math.PI) + g() * 0.03,
        ];
      }
      pts.push(p);
      lab.push(k);
    }
    return { pts: pts, lab: lab };
  }
  var D = data();
  function start() {
    D = data();
    tsneY = null;
    co.redraw();
    c1.redraw();
    cancelAnimationFrame(running);
    var ts = createTsne(D.pts, { dim: 1, perplexity: 20, seed: 3 });
    (function step() {
      for (var i = 0; i < 8; i++) ts.step();
      tsneY = ts.Y.map((y) => y[0]);
      status.textContent = 't-SNE iteration ' + ts.iteration + ' / 500';
      c1.redraw();
      if (ts.iteration < 500) running = requestAnimationFrame(step);
    })();
  }
  var co = chart(orig, {
    aspect: 0.9,
    margin: { top: 10, right: 10, bottom: 26, left: 30 },
    draw: function (ctx) {
      var dom = equalDomains(
        D.pts.map((p) => p[0]),
        D.pts.map((p) => p[1]),
        ctx.innerW,
        ctx.innerH,
      );
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      axes(ctx, x, y, { xTicks: 4, yTicks: 4 });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(D.pts)
        .join('circle')
        .attr('cx', (p) => x(p[0]))
        .attr('cy', (p) => y(p[1]))
        .attr('r', 3)
        .attr('fill', (p, i) => ctx.c.series[D.lab[i] ? 1 : 0]);
      var r = pca(D.pts, { k: 1 });
      var v = r.eig[0].vector;
      var mx = mean(D.pts.map((p) => p[0]));
      var my = mean(D.pts.map((p) => p[1]));
      ctx.g
        .append('line')
        .attr('x1', x(mx - v[0] * 3))
        .attr('y1', y(my - v[1] * 3))
        .attr('x2', x(mx + v[0] * 3))
        .attr('y2', y(my + v[1] * 3))
        .attr('stroke', ctx.c.text)
        .attr('stroke-dasharray', '5 4');
      ctx.g
        .append('text')
        .attr('class', 'label')
        .attr('x', 6)
        .attr('y', 12)
        .text('- - PC1 direction');
    },
  });
  var c1 = chart(host, {
    aspect: 0.9,
    margin: { top: 14, right: 10, bottom: 10, left: 48 },
    draw: function (ctx) {
      var jit = rng(9);
      var r = pca(D.pts, { k: 1 });
      var rowsDef = [['PCA', r.scores.map((s) => s[0])]];
      if (tsneY) rowsDef.push(['t-SNE', tsneY]);
      var yb = d3.scaleBand().domain(['PCA', 't-SNE']).range([0, ctx.innerH]).padding(0.25);
      ctx.g.append('g').attr('class', 'axis').call(d3.axisLeft(yb).tickSize(0));
      rowsDef.forEach(function (row) {
        var x = d3
          .scaleLinear()
          .domain(pad(d3.extent(row[1])))
          .range([0, ctx.innerW]);
        ctx.g
          .append('g')
          .selectAll('circle')
          .data(row[1])
          .join('circle')
          .attr('cx', (v) => x(v))
          .attr(
            'cy',
            (v, i) =>
              yb(row[0]) + yb.bandwidth() * (D.lab[i] ? 0.55 : 0.1) + jit() * yb.bandwidth() * 0.35,
          )
          .attr('r', 2.6)
          .attr('fill', (v, i) => ctx.c.series[D.lab[i] ? 1 : 0])
          .attr('opacity', 0.75);
        ctx.g
          .append('line')
          .attr('x1', 0)
          .attr('x2', ctx.innerW)
          .attr('y1', yb(row[0]) + yb.bandwidth() + 4)
          .attr('y2', yb(row[0]) + yb.bandwidth() + 4)
          .attr('stroke', ctx.c.line);
      });
    },
  });
  // start once visible (t-SNE is not free)
  var io = new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) {
      io.disconnect();
      start();
    }
  });
  io.observe(host);
}

/* ---- 3.9 live t-SNE --------------------------------------------------------- */

function tsneLab() {
  var host = document.getElementById('tsne-chart');
  var pcaHost = document.getElementById('tsne-pca');
  var ctl = document.getElementById('tsne-controls');
  var status = document.getElementById('tsne-status');
  var iterEl = document.getElementById('tsne-iter');
  var perplexity = 30;
  var noise = false;
  var seed = 7;
  var ts = null;
  var raf = 0;
  var paused = false;
  var MAX = 700;
  var sp = slider({
    label: 'Perplexity',
    min: 2,
    max: 100,
    value: perplexity,
    onInput: function (v) {
      perplexity = v;
    },
  });
  sp.input.addEventListener('change', restart);
  var tn = toggle({
    label: 'Add 2 high-variance random features',
    checked: false,
    onChange: function (v) {
      noise = v;
      pc.redraw();
      restart();
    },
  });
  var acts = el('div', 'ctl-actions');
  var pauseBtn = button('❚❚ Pause', function () {
    paused = !paused;
    pauseBtn.textContent = paused ? '▶ Resume' : '❚❚ Pause';
    if (!paused) loop();
  });
  acts.append(
    button('↻ Restart', restart, 'ds-button--primary'),
    button('New seed', function () {
      seed += 1;
      restart();
    }),
    pauseBtn,
  );
  var out = el('div');
  ctl.append(sp.el, tn.el, acts, out);
  var set = readout(out);
  var Y = null;
  var dots = null;
  var dotScales = null;
  var data = blobs(false);

  function restart() {
    cancelAnimationFrame(raf);
    data = blobs(noise);
    ts = createTsne(data.rows, { perplexity: perplexity, seed: seed });
    paused = false;
    pauseBtn.textContent = '❚❚ Pause';
    c.redraw();
    loop();
  }
  function loop() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function tick() {
      if (paused || !ts) return;
      var t0 = performance.now();
      while (performance.now() - t0 < 12 && ts.iteration < MAX) ts.step();
      Y = ts.Y;
      paint();
      if (ts.iteration < MAX) raf = requestAnimationFrame(tick);
    });
  }
  function paint() {
    if (!dots || !Y) return;
    var xs = Y.map((p) => p[0]);
    var ys = Y.map((p) => p[1]);
    var dom = equalDomains(xs, ys, dotScales.w, dotScales.h);
    var x = d3.scaleLinear().domain(dom.x).range([0, dotScales.w]);
    var y = d3.scaleLinear().domain(dom.y).range([dotScales.h, 0]);
    dots.attr('cx', (d, i) => x(Y[i][0])).attr('cy', (d, i) => y(Y[i][1]));
    iterEl.textContent = 'iteration ' + ts.iteration;
    status.textContent = ts.iteration < MAX ? 'running' : 'converged';
    set([
      { k: 'Iteration', v: ts.iteration + ' / ' + MAX },
      { k: 'KL(P‖Q)', v: fmt(ts.kl, 3), hot: true },
      {
        k: 'Phase',
        v:
          '<span style="font-size:.95rem">' +
          (ts.iteration < 100 ? 'exaggeration' : 'refinement') +
          '</span>',
      },
    ]);
  }
  var c = chart(host, {
    aspect: 0.9,
    fill: true,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    draw: function (ctx) {
      ctx.g
        .append('rect')
        .attr('width', ctx.innerW)
        .attr('height', ctx.innerH)
        .attr('fill', 'none')
        .attr('stroke', ctx.c.line);
      dotScales = { w: ctx.innerW, h: ctx.innerH };
      dots = ctx.g
        .append('g')
        .selectAll('circle')
        .data(data.labels)
        .join('circle')
        .attr('r', 3)
        .attr('cx', ctx.innerW / 2)
        .attr('cy', ctx.innerH / 2)
        .attr('fill', (l) => ctx.c.series[l])
        .attr('opacity', 0.8);
      paint();
    },
  });
  var pc = chart(pcaHost, {
    aspect: 0.9,
    fill: true,
    margin: { top: 10, right: 10, bottom: 10, left: 10 },
    draw: function (ctx) {
      var b = blobs(noise);
      var r = pca(b.rows, { k: 2 });
      ctx.g
        .append('rect')
        .attr('width', ctx.innerW)
        .attr('height', ctx.innerH)
        .attr('fill', 'none')
        .attr('stroke', ctx.c.line);
      var dom = equalDomains(
        r.scores.map((s) => s[0]),
        r.scores.map((s) => s[1]),
        ctx.innerW,
        ctx.innerH,
      );
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(r.scores)
        .join('circle')
        .attr('cx', (s) => x(s[0]))
        .attr('cy', (s) => y(s[1]))
        .attr('r', 3)
        .attr('fill', (s, i) => ctx.c.series[b.labels[i]])
        .attr('opacity', 0.8);
    },
  });
  var io = new IntersectionObserver(function (e) {
    if (e[0].isIntersecting) {
      io.disconnect();
      restart();
    }
  });
  io.observe(host);
}

/* ---- 3.10 UK -------------------------------------------------------------- */

function ukLab() {
  var table = document.getElementById('uk-table');
  var ctl = document.getElementById('uk-controls');
  var set = readout(document.getElementById('uk-readout'));
  var scaled = true;
  var C = UK_FOOD.countries;
  var mx = d3.max(UK_FOOD.foods, (f) => d3.max(f.slice(1)));
  table.innerHTML =
    '<thead><tr><th>Food</th>' +
    C.map((c) => '<th class="num">' + c + '</th>').join('') +
    '</tr></thead><tbody>' +
    UK_FOOD.foods
      .map(function (f) {
        return (
          '<tr><td>' +
          f[0] +
          '</td>' +
          f
            .slice(1)
            .map(function (v) {
              return (
                '<td class="num" style="background:linear-gradient(to right, color-mix(in srgb, var(--ds-warn) 30%, transparent) ' +
                Math.round((v / mx) * 100) +
                '%, transparent 0)">' +
                v +
                '</td>'
              );
            })
            .join('') +
          '</tr>'
        );
      })
      .join('') +
    '</tbody>';
  var ts = segmented({
    label: 'Variables',
    value: 'scaled',
    options: [
      { value: 'scaled', label: 'Scaling variables' },
      { value: 'raw', label: 'Not scaling' },
    ],
    onChange: function (v) {
      scaled = v === 'scaled';
      bp.redraw();
      ld.redraw();
    },
  });
  var arrows = toggle({ label: 'Food arrows', checked: true, onChange: () => bp.redraw() });
  ctl.append(
    ts.el,
    arrows.el,
    el(
      'p',
      'ctl-note',
      'Not scaling: foods eaten in large quantities (cereals, soft drinks, fresh fruit, potatoes) dominate just because of their grams. Scaling gives each food the same weight.',
    ),
  );
  var rows = C.map((c, j) => UK_FOOD.foods.map((f) => f[j + 1]));
  var names = UK_FOOD.foods.map((f) => f[0]);
  function fit() {
    return pca(rows, { standardize: scaled, k: 2 });
  }
  var bp = chart(document.getElementById('uk-biplot'), {
    aspect: 0.9,
    margin: { top: 14, right: 14, bottom: 32, left: 40 },
    draw: function (ctx) {
      var r = fit();
      var s = r.scores;
      var load = names.map((n, i) => [r.eig[0].vector[i], r.eig[1].vector[i]]);
      var lim = d3.max(s.flat(), Math.abs) * 1.35;
      var x = d3.scaleLinear().domain([-lim, lim]).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain([-lim, lim]).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xTicks: 4,
        yTicks: 4,
        xLabel: 'PC1 (' + d3.format('.1%')(r.explained[0]) + ')',
        yLabel: 'PC2 (' + d3.format('.1%')(r.explained[1]) + ')',
      });
      if (arrows.value) {
        var sc = lim * 0.9;
        var ranked = load
          .map((l, i) => ({ l: l, i: i, len: Math.hypot(l[0], l[1]) }))
          .sort((a, b) => b.len - a.len);
        ranked.forEach(function (o, k) {
          var l = o.l;
          ctx.g
            .append('line')
            .attr('x1', x(0))
            .attr('y1', y(0))
            .attr('x2', x(l[0] * sc))
            .attr('y2', y(l[1] * sc))
            .attr('stroke', ctx.c.accent)
            .attr('stroke-opacity', 0.55)
            .attr('stroke-width', 1.4);
          if (k < 6)
            ctx.g
              .append('text')
              .attr('class', 'label label--accent')
              .attr('x', x(l[0] * sc))
              .attr('y', y(l[1] * sc) - 3)
              .attr('text-anchor', l[0] >= 0 ? 'start' : 'end')
              .style('font-size', '10px')
              .text(names[o.i]);
        });
      }
      s.forEach(function (p, j) {
        ctx.g
          .append('circle')
          .attr('cx', x(p[0]))
          .attr('cy', y(p[1]))
          .attr('r', 7)
          .attr('fill', ctx.c.series[[1, 0, 2, 3][j]])
          .attr('stroke', ctx.c.surface)
          .attr('stroke-width', 2);
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', x(p[0]) + 10)
          .attr('y', y(p[1]) + 4)
          .style('font-size', '12px')
          .text(C[j]);
      });
      set([
        { k: 'Explained PC1', v: fmt(r.explained[0], 4), hot: true },
        { k: 'Explained PC2', v: fmt(r.explained[1], 4), hot: true },
        { k: 'Total', v: fmt(r.explained[0] + r.explained[1], 2) },
      ]);
    },
  });
  // wide: foods along the bottom, PC1 and PC2 as two strips of up/down bars; narrow (phones): the
  // 17 columns would not fit, so foods go down the side with PC1 and PC2 next to each other
  var LD_WIDE = 560;
  var ld = chart(document.getElementById('uk-loadings'), {
    height: function (w) {
      return w >= LD_WIDE ? 360 : Math.min(500, Math.max(380, w * 1.1));
    },
    margin: { top: 18, right: 8, bottom: 26, left: 104 },
    draw: function (ctx) {
      var r = fit();
      if (ctx.width >= LD_WIDE) {
        drawWide(ctx, r);
        return;
      }
      var y = d3.scaleBand().domain(names).range([0, ctx.innerH]).padding(0.2);
      ctx.g.append('g').attr('class', 'axis').call(d3.axisLeft(y).tickSize(0));
      var w = (ctx.innerW - 12) / 2;
      [0, 1].forEach(function (j) {
        var g = ctx.g.append('g').attr('transform', 'translate(' + j * (w + 12) + ',0)');
        var x = d3.scaleLinear().domain([-0.7, 0.7]).range([0, w]);
        g.append('text')
          .attr('class', 'label')
          .attr('x', w / 2)
          .attr('y', -6)
          .attr('text-anchor', 'middle')
          .text('PC' + (j + 1));
        g.append('line')
          .attr('x1', x(0))
          .attr('x2', x(0))
          .attr('y1', 0)
          .attr('y2', ctx.innerH)
          .attr('stroke', ctx.c.strong);
        g.append('g')
          .attr('class', 'axis')
          .attr('transform', 'translate(0,' + ctx.innerH + ')')
          .call(d3.axisBottom(x).ticks(3));
        r.eig[j].vector.forEach(function (v, i) {
          g.append('rect')
            .attr('x', x(Math.min(0, v)))
            .attr('width', Math.abs(x(v) - x(0)))
            .attr('y', y(names[i]))
            .attr('height', y.bandwidth())
            .attr('rx', 2)
            .attr('fill', v >= 0 ? ctx.c.accent : ctx.c.series[1])
            .on('pointerenter', function (e) {
              showTip(e, '<b>' + names[i] + '</b><br>weight on PC' + (j + 1) + ': ' + fmt(v, 3));
            })
            .on('pointerleave', hideTip);
        });
      });
    },
  });

  function drawWide(ctx, r) {
    var m = { top: 18, right: 8, bottom: 100, left: 44 };
    var iw = ctx.width - m.left - m.right;
    var ih = ctx.height - m.top - m.bottom;
    var gap = 24;
    var ph = (ih - gap) / 2;
    var root = ctx.svg.append('g').attr('transform', 'translate(' + m.left + ',' + m.top + ')');
    var x = d3.scaleBand().domain(names).range([0, iw]).padding(0.2);
    [0, 1].forEach(function (j) {
      var g = root.append('g').attr('transform', 'translate(0,' + j * (ph + gap) + ')');
      var y = d3.scaleLinear().domain([-0.7, 0.7]).range([ph, 0]);
      g.append('text')
        .attr('class', 'label')
        .attr('x', 0)
        .attr('y', -6)
        .text('PC' + (j + 1));
      g.append('g').attr('class', 'axis').call(d3.axisLeft(y).ticks(3));
      g.append('line')
        .attr('x1', 0)
        .attr('x2', iw)
        .attr('y1', y(0))
        .attr('y2', y(0))
        .attr('stroke', ctx.c.strong);
      r.eig[j].vector.forEach(function (v, i) {
        g.append('rect')
          .attr('x', x(names[i]))
          .attr('width', x.bandwidth())
          .attr('y', y(Math.max(0, v)))
          .attr('height', Math.abs(y(v) - y(0)))
          .attr('rx', 2)
          .attr('fill', v >= 0 ? ctx.c.accent : ctx.c.series[1])
          .on('pointerenter', function (e) {
            showTip(e, '<b>' + names[i] + '</b><br>weight on PC' + (j + 1) + ': ' + fmt(v, 3));
          })
          .on('pointerleave', hideTip);
      });
    });
    root
      .append('g')
      .attr('class', 'axis')
      .attr('transform', 'translate(0,' + ih + ')')
      .call(d3.axisBottom(x).tickSize(0))
      .call((a) => a.select('.domain').remove())
      .selectAll('text')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.4em')
      .attr('dy', '0.6em')
      .attr('transform', 'rotate(-40)');
  }
}

/* ---- 3.11 politics ---------------------------------------------------------- */

function politics() {
  var host = document.getElementById('pol-map');
  var ctl = document.getElementById('pol-controls');
  var set = readout(document.getElementById('pol-readout'));
  var dt = document.getElementById('pol-dist');
  var user = POLITICS_USER.slice();
  var mode = 'parties';
  var names = Object.keys(PARTIES);
  var crowd = citizens(220);
  var seg = segmented({
    label: 'Fit PCA on',
    value: mode,
    options: [
      { value: 'parties', label: 'Parties vs user' },
      { value: 'citizens', label: 'Parties vs citizens' },
    ],
    onChange: function (v) {
      mode = v;
      update();
    },
  });
  var sliders = el('div', 'ctl');
  sliders.style.gap = '0.6rem';
  user.forEach(function (v, i) {
    var s = slider({
      label: 'Q' + (i + 1),
      min: 1,
      max: 10,
      value: v,
      onInput: function (val) {
        user[i] = val;
        update();
      },
    });
    sliders.append(s.el);
  });
  ctl.append(seg.el, el('span', 'caps muted', 'Your answers (1 = disagree, 10 = agree)'), sliders);
  var fitCit = null;
  function update() {
    c.redraw();
    var all = names.map((n) => PARTIES[n]).concat([user]);
    var labels = names.concat(['User']);
    dt.innerHTML =
      '<thead><tr><th>10D euclid. distance</th>' +
      labels.map((l) => '<th class="num">' + l + '</th>').join('') +
      '</tr></thead><tbody>' +
      all
        .map(function (a, i) {
          return (
            '<tr><td><strong>' +
            labels[i] +
            '</strong></td>' +
            all
              .map(function (b, j) {
                var d = dist(a, b);
                var hot = (i === 4 || j === 4) && i !== j;
                return '<td class="num' + (hot ? ' col-hl' : '') + '">' + d.toFixed(2) + '</td>';
              })
              .join('') +
            '</tr>'
          );
        })
        .join('') +
      '</tbody>';
  }
  var c = chart(host, {
    aspect: 0.75,
    margin: { top: 16, right: 16, bottom: 34, left: 40 },
    draw: function (ctx) {
      var partyRows = names.map((n) => PARTIES[n]);
      var r;
      var userZ;
      var crowdZ = [];
      if (mode === 'parties') {
        r = pca(partyRows.concat([user]), { k: 2 });
        userZ = r.scores[4];
      } else {
        if (!fitCit) fitCit = pca(crowd.concat(partyRows), { k: 2 });
        r = fitCit;
        var all = crowd.concat(partyRows);
        var mu = all[0].map((_, j) => mean(all.map((row) => row[j])));
        var proj = (x) =>
          [0, 1].map((k) => r.eig[k].vector.reduce((s, v, i) => s + v * (x[i] - mu[i]), 0));
        crowdZ = crowd.map(proj);
        userZ = proj(user);
      }
      var partyZ = mode === 'parties' ? r.scores.slice(0, 4) : r.scores.slice(crowd.length);
      var allZ = partyZ.concat([userZ]).concat(crowdZ);
      var dom = equalDomains(
        allZ.map((p) => p[0]),
        allZ.map((p) => p[1]),
        ctx.innerW,
        ctx.innerH,
      );
      var x = d3.scaleLinear().domain(dom.x).range([0, ctx.innerW]);
      var y = d3.scaleLinear().domain(dom.y).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xLabel: 'PC1 (' + d3.format('.1%')(r.explained[0]) + ')',
        yLabel: 'PC2 (' + d3.format('.1%')(r.explained[1]) + ')',
      });
      ctx.g
        .append('g')
        .selectAll('circle')
        .data(crowdZ)
        .join('circle')
        .attr('cx', (p) => x(p[0]))
        .attr('cy', (p) => y(p[1]))
        .attr('r', 2.6)
        .attr('fill', ctx.c.text)
        .attr('opacity', 0.25);
      partyZ.forEach(function (p, i) {
        ctx.g
          .append('rect')
          .attr('x', x(p[0]) - 8)
          .attr('y', y(p[1]) - 8)
          .attr('width', 16)
          .attr('height', 16)
          .attr('rx', 3)
          .attr('transform', 'rotate(45 ' + x(p[0]) + ' ' + y(p[1]) + ')')
          .attr('fill', ctx.c.series[i + 1 > 4 ? 4 : [1, 0, 3, 4][i]]);
      });
      ctx.g
        .append('circle')
        .attr('cx', x(userZ[0]))
        .attr('cy', y(userZ[1]))
        .attr('r', 9)
        .attr('fill', ctx.c.series[2])
        .attr('stroke', ctx.c.surface)
        .attr('stroke-width', 3);
      ctx.g
        .append('text')
        .attr('class', 'label')
        .attr('x', x(userZ[0]))
        .attr('y', y(userZ[1]) + 24)
        .attr('text-anchor', 'middle')
        .style('font-size', '13px')
        .style('font-weight', '700')
        .text('You');
      // party names go on top of the markers, with a halo so the You dot cannot hide them, and on
      // the left of parties in the right half so they stay inside the chart
      partyZ.forEach(function (p, i) {
        var right = x(p[0]) > ctx.innerW / 2;
        ctx.g
          .append('text')
          .attr('class', 'label')
          .attr('x', x(p[0]) + (right ? -13 : 13))
          .attr('y', y(p[1]) + 4)
          .attr('text-anchor', right ? 'end' : 'start')
          .attr('stroke', ctx.c.surface)
          .attr('stroke-width', 3)
          .attr('stroke-linejoin', 'round')
          .style('paint-order', 'stroke')
          .style('font-size', '12px')
          .text(names[i]);
      });
      var dists = names.map((n) => dist(PARTIES[n], user));
      var best = d3.minIndex(dists);
      set([
        { k: 'Explained PC1', v: fmt(r.explained[0], 4), hot: true },
        { k: 'Explained PC2', v: fmt(r.explained[1], 4), hot: true },
        { k: 'Closest party (10D)', v: names[best], hot: true, color: seriesVar(2) },
        { k: 'Distance', v: fmt(dists[best], 2) },
      ]);
    },
  });
  update();
}
