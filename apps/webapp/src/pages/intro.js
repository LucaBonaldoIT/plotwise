import { shell, onReady } from '../scripts/shell.js';
import '../styles/intro.css';
import { initVoid } from '../scripts/void.js';
import { chart, axes, d3, colors, showTip, hideTip } from '../lib/chart.js';
import { slider, segmented, button, readout, el } from '../lib/ui.js';
import { loadCsv, BANK_ATTRS } from '../lib/data.js';
import { fmt, rng, normalSampler } from '../lib/stats.js';
import { onThemeChange } from '@lucabonaldo/design';

shell();

onReady(function () {
  initVoid();
  dataTypes();
  structured();
  ladder();
  thermo();
  game();
  countable();
  bits();
  documents();
  transactions();
  orderVsTime();
  spatio();
  inventory();
  bank();
});

/* ---- 0.2 types of data ------------------------------------------------- */

function dataTypes() {
  var host = document.getElementById('dtypes');
  var types = [
    {
      name: 'Tabular (structured)',
      desc: 'Objects in rows, attributes in columns. The focus of this course.',
      svg: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="10" y="6" width="100" height="48" rx="2"/><path d="M10 18h100M10 30h100M10 42h100M40 6v48M70 6v48"/><rect class="acc" x="70" y="18" width="40" height="12" fill="currentColor" opacity=".35" stroke="none"/></svg>',
    },
    {
      name: 'Hierarchical',
      desc: 'Records nested in records: JSON, XML, organisation charts.',
      svg: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="60" cy="10" r="5"/><circle cx="32" cy="30" r="5"/><circle cx="88" cy="30" r="5" class="acc"/><circle cx="18" cy="51" r="4"/><circle cx="46" cy="51" r="4"/><circle cx="76" cy="51" r="4"/><circle cx="100" cy="51" r="4"/><path d="M56 13 36 27M64 13 84 27M29 34 20 47M35 34 44 47M85 34 78 47M91 34 98 47"/></svg>',
    },
    {
      name: 'Graphs',
      desc: 'Entities and the links between them: social networks, roads, molecules.',
      svg: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 40 45 14 70 34 98 12M45 14l7 36 18-16M20 40l32 10M70 34l28 18"/><circle cx="20" cy="40" r="4" fill="currentColor"/><circle cx="45" cy="14" r="4" fill="currentColor"/><circle cx="70" cy="34" r="5" class="acc" fill="currentColor"/><circle cx="98" cy="12" r="4" fill="currentColor"/><circle cx="52" cy="50" r="4" fill="currentColor"/><circle cx="98" cy="52" r="4" fill="currentColor"/></svg>',
    },
    {
      name: 'Text (NLP)',
      desc: 'Sequences of words: documents, reviews, chats.',
      svg: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M14 12h60M14 24h86M14 36h40M60 36h34M14 48h70"/><path class="acc" d="M80 12h22"/></svg>',
    },
    {
      name: 'Images',
      desc: 'Grids of pixels: photos, scans, satellite imagery.',
      svg: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="22" y="6" width="76" height="48" rx="2"/><path d="M22 46 48 24l18 16 12-10 20 16"/><circle class="acc" cx="80" cy="18" r="5" fill="currentColor" stroke="none"/></svg>',
    },
    {
      name: 'Audio',
      desc: 'Signals sampled over time: speech, music, sensors.',
      svg: '<svg viewBox="0 0 120 60" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 30h6M22 22v16M30 12v36M38 20v20M46 26v8M54 8v44M62 18v24M70 24v12M78 14v32M86 22v16M94 28v4M102 30h8"/><path class="acc" d="M54 8v44"/></svg>',
    },
  ];
  host.innerHTML = types
    .map(function (t) {
      return (
        '<li><div class="dtype" tabindex="0">' +
        t.svg +
        '<h4>' +
        t.name +
        '</h4><p>' +
        t.desc +
        '</p></div></li>'
      );
    })
    .join('');
}

/* ---- 0.3 structured data table ---------------------------------------- */

function structured() {
  var table = document.getElementById('struct-table');
  var status = document.getElementById('struct-status');
  var head = ['Tid', 'Refund', 'Marital Status', 'Taxable Income', 'Cheat'];
  var rows = [
    [1, 'Yes', 'Single', '125K', 'No'],
    [2, 'No', 'Married', '100K', 'No'],
    [3, 'No', 'Single', '70K', 'No'],
    [4, 'Yes', 'Married', '120K', 'No'],
    [5, 'No', 'Divorced', '95K', 'Yes'],
    [6, 'No', 'Married', '60K', 'No'],
    [7, 'Yes', 'Divorced', '220K', 'No'],
    [8, 'No', 'Single', '85K', 'Yes'],
    [9, 'No', 'Married', '75K', 'No'],
    [10, 'No', 'Single', '90K', 'Yes'],
  ];
  table.innerHTML =
    '<thead><tr>' +
    head
      .map(function (h, j) {
        return '<th data-col="' + j + '">' + h + '</th>';
      })
      .join('') +
    '</tr></thead><tbody>' +
    rows
      .map(function (r, i) {
        return (
          '<tr data-row="' +
          i +
          '">' +
          r
            .map(function (v, j) {
              return '<td data-col="' + j + '"' + (j === 0 ? '' : '') + '>' + v + '</td>';
            })
            .join('') +
          '</tr>'
        );
      })
      .join('') +
    '</tbody>';

  function clear() {
    table.querySelectorAll('.is-row,.is-col').forEach(function (c) {
      c.classList.remove('is-row', 'is-col');
    });
  }
  function onCell(e) {
    var cell = e.target.closest('td,th');
    if (!cell) return;
    clear();
    var col = Number(cell.dataset.col);
    var tr = cell.closest('tr');
    var row = tr.dataset.row;
    table.querySelectorAll('[data-col="' + col + '"]').forEach(function (c) {
      if (col > 0) c.classList.add('is-col');
    });
    if (row !== undefined) {
      tr.querySelectorAll('td').forEach(function (c) {
        c.classList.add('is-row');
      });
    }
    var parts = [];
    if (row !== undefined) parts.push('Object #' + rows[row][0]);
    if (col > 0) parts.push('Attribute “' + head[col] + '”');
    if (row !== undefined && col > 0) parts.push('value ' + rows[row][col]);
    status.textContent = parts.join(' · ') || 'Tid is the identifier';
  }
  table.addEventListener('pointerover', onCell);
  table.addEventListener('click', onCell);
  table.addEventListener('pointerleave', function () {
    clear();
    status.textContent = 'Hover a row or a column';
  });
}

/* ---- 0.4 operator ladder ------------------------------------------------ */

function ladder() {
  var host = document.getElementById('ladder');
  var ops = [
    ['=', 'equal'],
    ['≠', 'differ'],
    ['<', 'less'],
    ['>', 'greater'],
    ['+', 'add'],
    ['−', 'subtract'],
    ['×', 'multiply'],
    ['÷', 'divide'],
  ];
  var types = [
    {
      name: 'Nominal',
      level: 2,
      sub: 'Diversity',
      info: '<strong>Nominal</strong>: we can only tell values apart. Eye color, zip code, ID. Statistics: <strong>mode</strong>, correlation.',
    },
    {
      name: 'Ordinal',
      level: 4,
      sub: '+ ordering',
      info: '<strong>Ordinal</strong>: values can be sorted, but gaps are not measurable. Grade, hardness of a mineral. Statistics: <strong>median</strong>, percentile.',
    },
    {
      name: 'Interval',
      level: 6,
      sub: '+ additivity',
      info: '<strong>Interval</strong>: differences have a unit. Dates, temperature in °C or °F. Statistics: <strong>mean</strong>, variance.',
    },
    {
      name: 'Ratio',
      level: 8,
      sub: '+ multiplicativeness',
      info: '<strong>Ratio</strong>: a true zero, ratios mean something. Age, mass, length, money, Kelvin. Statistics: <strong>geometric</strong> and <strong>harmonic mean</strong>.',
    },
  ];
  var typeWrap = el('div', 'ladder__types');
  var opWrap = el('div', 'ladder__ops');
  var info = el('p', 'ladder__info');
  var opEls = ops.map(function (o) {
    var e = el('div', 'op', o[0] + '<small>' + o[1] + '</small>');
    opWrap.append(e);
    return e;
  });
  var btns = types.map(function (t, i) {
    var b = el('button', 'ladder__type', '<b>' + t.name + '</b><small>' + t.sub + '</small>');
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      pick(i);
    });
    typeWrap.append(b);
    return b;
  });
  function pick(i) {
    btns.forEach(function (b, j) {
      b.classList.toggle('is-on', i === j);
      b.setAttribute('aria-pressed', String(i === j));
    });
    opEls.forEach(function (o, k) {
      setTimeout(function () {
        o.classList.toggle('is-on', k < types[i].level);
      }, k * 40);
    });
    info.innerHTML = types[i].info;
  }
  host.append(typeWrap, opWrap, info);
  pick(0);
}

/* ---- 0.4 Celsius vs Kelvin ---------------------------------------------- */

function thermo() {
  var host = document.getElementById('thermo');
  var ctl = document.getElementById('thermo-controls');
  var a = 10;
  var b = 20;
  var s1 = slider({
    label: 'Temperature A',
    min: -40,
    max: 60,
    value: a,
    format: function (v) {
      return v + ' °C';
    },
    onInput: function (v) {
      a = v;
      update();
    },
  });
  var s2 = slider({
    label: 'Temperature B',
    min: -40,
    max: 60,
    value: b,
    format: function (v) {
      return v + ' °C';
    },
    onInput: function (v) {
      b = v;
      update();
    },
  });
  var preset = el('div', 'ctl-actions');
  preset.append(
    button('−10 vs 20', function () {
      a = -10;
      b = 20;
      s1.value = a;
      s2.value = b;
      update();
    }),
    button('10 vs 20', function () {
      a = 10;
      b = 20;
      s1.value = a;
      s2.value = b;
      update();
    }),
  );
  var out = el('div');
  ctl.append(s1.el, s2.el, preset, out);
  var set = readout(out);

  var c = chart(host, {
    // beside the controls (wide), grow toward their height instead of leaving a gap below
    height: function (w) {
      return w < 500 ? 230 : 300;
    },
    margin: { top: 20, right: 20, bottom: 30, left: 76 },
    draw: function (ctx) {
      var x = d3.scaleLinear().domain([-280, 70]).range([0, ctx.innerW]);
      var rows = [
        { name: 'Celsius', zero: 0, label: '0 °C' },
        { name: 'Kelvin', zero: -273.15, label: '0 K' },
      ];
      var bandH = ctx.innerH / 2;
      ctx.g
        .append('g')
        .attr('class', 'axis')
        .attr('transform', 'translate(0,' + ctx.innerH + ')')
        .call(
          d3
            .axisBottom(x)
            .ticks(Math.max(4, Math.floor(ctx.innerW / 70)))
            .tickFormat(function (d) {
              return d + '°';
            }),
        );
      rows.forEach(function (r, i) {
        var y0 = i * bandH + 8;
        var h = bandH - 22;
        var g = ctx.g.append('g');
        g.append('text')
          .attr('class', 'label')
          .attr('x', -10)
          .attr('y', y0 + h / 2 + 4)
          .attr('text-anchor', 'end')
          .text(r.name);
        g.append('line')
          .attr('x1', x(r.zero))
          .attr('x2', x(r.zero))
          .attr('y1', y0 - 6)
          .attr('y2', y0 + h + 6)
          .attr('stroke', ctx.c.text)
          .attr('stroke-width', 2);
        // 0 °C sits near the right edge: put its caption on the left of the line so it never
        // runs out of the chart on narrow screens
        var right = x(r.zero) > ctx.innerW / 2;
        g.append('text')
          .attr('x', x(r.zero) + (right ? -4 : 4))
          .attr('y', y0 - 8)
          .attr('text-anchor', right ? 'end' : 'start')
          .attr('font-size', 10)
          .text(r.label + (i === 0 ? ' (not “no heat”)' : ' (absence of heat)'));
        [a, b].forEach(function (v, k) {
          var lo = Math.min(x(r.zero), x(v));
          var w = Math.abs(x(v) - x(r.zero));
          g.append('rect')
            .attr('x', lo)
            .attr('y', y0 + k * (h / 2) + 2)
            .attr('width', Math.max(1, w))
            .attr('height', h / 2 - 4)
            .attr('rx', 3)
            .attr('fill', ctx.c.series[k === 0 ? 1 : 0])
            .attr('opacity', 0.85);
          g.append('text')
            .attr('class', 'label')
            .attr('x', x(v) + (v >= r.zero ? 4 : -4))
            .attr('text-anchor', v >= r.zero ? 'start' : 'end')
            .attr('y', y0 + k * (h / 2) + h / 4 + 4)
            .text(k === 0 ? 'A' : 'B');
        });
      });
    },
  });

  function update() {
    var rc = a === 0 ? '∞ / undefined' : fmt(b / a, 2) + '×';
    var rk = fmt((b + 273.15) / (a + 273.15), 3) + '×';
    set([
      { k: 'B − A', v: b - a + ' °C', hot: true },
      { k: 'B / A in °C', v: rc },
      { k: 'B / A in K', v: rk, hot: true },
    ]);
    c.redraw();
  }
  update();
}

/* ---- 0.5 sorting game --------------------------------------------------- */

function game() {
  var host = document.getElementById('game');
  var TYPES = ['Nominal', 'Ordinal', 'Interval', 'Ratio'];
  var BANK = [
    ['Eye color', 0, 'Labels you can only tell apart.'],
    ['Zip code', 0, 'Digits, but only names: the “average zip code” means nothing.'],
    ['Employee ID', 0, 'Remember the average employee ID? Only = and ≠ make sense.'],
    ['Gender', 0, 'Categories with no order.'],
    ['Exam grade (A–F)', 1, 'Ordered, but the gap between A and B is not measurable.'],
    ['Hardness of a mineral', 1, 'The Mohs scale sorts minerals, but steps are not equal.'],
    ['Clothing size (S, M, L, XL)', 1, 'An order without a unit of measure.'],
    ['Satisfaction (1–5 stars)', 1, 'Ordered data: 4 stars is not “twice” 2 stars.'],
    ['Calendar date', 2, 'Differences (days between dates) make sense, there is no true zero.'],
    ['Temperature in °C', 2, '0 °C is not absence of heat: differences yes, ratios no.'],
    ['Temperature in °F', 2, 'Same as Celsius: an arbitrary zero.'],
    ['Temperature in Kelvin', 3, '0 K is absence of heat: ratios have meaning.'],
    ['Age', 3, 'A true zero: 40 years is twice 20 years.'],
    ['Mass', 3, '0 kg means no mass: ratios have meaning.'],
    ['Amount of money', 3, '€0 is no money; €100 is twice €50.'],
    ['Length', 3, 'A true zero and a unit: ratio.'],
    ['Number of children', 3, 'A count: discrete, with a true zero.'],
  ];
  var ROUNDS = 10;
  var deck;
  var round;
  var score;
  var lives;
  var streak;
  var best = 0;
  try {
    best = Number(localStorage.getItem('vd-sort-best')) || 0;
  } catch (err) {
    best = 0;
  }

  host.innerHTML =
    '<div class="game__bar"><span class="game__lives" aria-label="Lives"></span><span class="game__round"></span><span class="game__score"></span></div>' +
    '<div class="game__meter"><i></i></div>' +
    '<div class="game__card" aria-live="polite"><span class="caps">What type is…</span><div class="game__item"></div><div class="game__hint"></div></div>' +
    '<div class="game__choices"></div>' +
    '<div class="game__feedback" aria-live="polite"></div>';
  var livesEl = host.querySelector('.game__lives');
  var roundEl = host.querySelector('.game__round');
  var scoreEl = host.querySelector('.game__score');
  var meter = host.querySelector('.game__meter i');
  var item = host.querySelector('.game__item');
  var hint = host.querySelector('.game__hint');
  var choices = host.querySelector('.game__choices');
  var feedback = host.querySelector('.game__feedback');

  var btns = TYPES.map(function (t, i) {
    var b = el('button', 'game__choice', t);
    b.type = 'button';
    b.addEventListener('click', function () {
      answer(i);
    });
    choices.append(b);
    return b;
  });

  function hud() {
    livesEl.textContent = '♥'.repeat(lives) + '♡'.repeat(3 - lives);
    roundEl.textContent = 'Round ' + Math.min(round + 1, ROUNDS) + ' / ' + ROUNDS;
    scoreEl.innerHTML = 'Score <b>' + score + '</b>' + (streak > 1 ? ' · streak ×' + streak : '');
    meter.style.width = (round / ROUNDS) * 100 + '%';
  }

  function start() {
    var r = Math.random;
    deck = BANK.slice().sort(function () {
      return r() - 0.5;
    });
    round = 0;
    score = 0;
    lives = 3;
    streak = 0;
    show();
  }

  function show() {
    hud();
    feedback.innerHTML = '';
    var q = deck[round];
    item.textContent = q[0];
    item.classList.remove('pop');
    void item.offsetWidth;
    item.classList.add('pop');
    hint.textContent = '';
    btns.forEach(function (b) {
      b.disabled = false;
      b.classList.remove('is-right', 'is-wrong');
    });
  }

  function answer(i) {
    var q = deck[round];
    var right = i === q[1];
    btns.forEach(function (b, k) {
      b.disabled = true;
      if (k === q[1]) b.classList.add('is-right');
      if (k === i && !right) b.classList.add('is-wrong');
    });
    if (right) {
      streak += 1;
      score += streak > 2 ? 2 : 1;
    } else {
      streak = 0;
      lives -= 1;
    }
    round += 1;
    hud();
    var over = lives === 0 || round >= ROUNDS;
    feedback.innerHTML =
      '<span><span class="' +
      (right ? 'ok">Correct.' : 'ko">' + TYPES[q[1]] + '.') +
      '</span> ' +
      q[2] +
      '</span>';
    var next = button(
      over ? 'See result' : 'Next →',
      function () {
        if (over) end();
        else show();
      },
      'ds-button--primary',
    );
    feedback.append(next);
    next.focus({ preventScroll: true });
  }

  function end() {
    best = Math.max(best, score);
    try {
      localStorage.setItem('vd-sort-best', String(best));
    } catch (err) {
      /* best score just won't persist */
    }
    item.textContent = lives === 0 ? 'Game over' : 'Level cleared';
    hint.textContent = 'Score ' + score + ' · best ' + best;
    btns.forEach(function (b) {
      b.disabled = true;
      b.classList.remove('is-right', 'is-wrong');
    });
    feedback.innerHTML = '<span>Nominal → ordinal → interval → ratio: each adds operators.</span>';
    feedback.append(button('Play again', start, 'ds-button--primary'));
    meter.style.width = '100%';
  }

  start();
}

/* ---- 0.6 countable sets -------------------------------------------------- */

function countable() {
  var host = document.getElementById('countable');
  var ctl = document.getElementById('countable-controls');
  var mode = 'z';
  var n = 9;
  var seg = segmented({
    label: 'Set',
    value: mode,
    options: [
      { value: 'z', label: 'Integers ℤ' },
      { value: 'even', label: 'Even' },
      { value: 'q', label: 'Rationals ℚ⁺' },
    ],
    onChange: function (v) {
      mode = v;
      c.redraw();
    },
  });
  var s = slider({
    label: 'Enumerate up to n',
    min: 1,
    max: 30,
    value: n,
    onInput: function (v) {
      n = v;
      c.redraw();
    },
  });
  var note = el('p', 'ctl-note');
  ctl.append(seg.el, s.el, note);

  function gcd(a, b) {
    return b ? gcd(b, a % b) : a;
  }
  function rationals(k) {
    // Cantor's diagonal walk over p/q, skipping duplicates
    var out = [];
    for (var d = 2; out.length < k; d++) {
      for (var p = 1; p < d && out.length < k; p++) {
        var q = d - p;
        if (gcd(p, q) === 1) out.push([p, q]);
      }
    }
    return out;
  }

  var c = chart(host, {
    height: function (w) {
      return w < 500 ? 260 : 240;
    },
    margin: { top: 16, right: 16, bottom: 30, left: 28 },
    draw: function (ctx) {
      var g = ctx.g;
      if (mode === 'q') {
        var list = rationals(n);
        var size = 6;
        var x = d3
          .scaleLinear()
          .domain([0.5, size + 0.5])
          .range([0, ctx.innerW]);
        var y = d3
          .scaleLinear()
          .domain([0.5, size + 0.5])
          .range([0, ctx.innerH]);
        for (var p = 1; p <= size; p++) {
          for (var q = 1; q <= size; q++) {
            g.append('text')
              .attr('x', x(q))
              .attr('y', y(p) + 4)
              .attr('text-anchor', 'middle')
              .attr('opacity', gcd(p, q) === 1 ? 0.55 : 0.2)
              .text(p + '/' + q);
          }
        }
        var vis = list.filter(function (r) {
          return r[0] <= size && r[1] <= size;
        });
        g.append('path')
          .attr(
            'd',
            d3.line()(
              vis.map(function (r) {
                return [x(r[1]), y(r[0])];
              }),
            ),
          )
          .attr('fill', 'none')
          .attr('stroke', ctx.c.accent)
          .attr('stroke-width', 2)
          .attr('opacity', 0.6);
        vis.forEach(function (r, i) {
          g.append('circle')
            .attr('cx', x(r[1]))
            .attr('cy', y(r[0]))
            .attr('r', 11)
            .attr('fill', ctx.c.accent)
            .attr('opacity', 0.15);
          g.append('text')
            .attr('class', 'label label--accent')
            .attr('x', x(r[1]) + 12)
            .attr('y', y(r[0]) - 8)
            .text(i + 1);
        });
        note.innerHTML =
          'Walking the diagonals of the p/q grid (skipping duplicates like 2/2) assigns every positive rational a natural number: n = ' +
          n +
          ' → ' +
          list[n - 1][0] +
          '/' +
          list[n - 1][1] +
          '.';
        return;
      }
      var f =
        mode === 'z'
          ? function (k) {
              return k % 2 ? (k + 1) / 2 : -k / 2;
            }
          : function (k) {
              return k % 2 ? k + 1 : -k;
            };
      var vals = d3.range(0, n).map(f);
      var ext = Math.max(4, d3.max(vals, Math.abs) + 1);
      var x2 = d3.scaleLinear().domain([-ext, ext]).range([0, ctx.innerW]);
      var yN = ctx.innerH * 0.18;
      var yZ = ctx.innerH * 0.85;
      g.append('text')
        .attr('x', -18)
        .attr('y', yN + 4)
        .attr('class', 'label')
        .text('ℕ');
      g.append('text')
        .attr('x', -18)
        .attr('y', yZ + 4)
        .attr('class', 'label')
        .text(mode === 'z' ? 'ℤ' : '2ℤ');
      g.append('line')
        .attr('x1', 0)
        .attr('x2', ctx.innerW)
        .attr('y1', yZ)
        .attr('y2', yZ)
        .attr('stroke', ctx.c.strong);
      var nx = d3
        .scaleLinear()
        .domain([0, Math.max(n - 1, 1)])
        .range([ctx.innerW * 0.08, ctx.innerW * 0.92]);
      vals.forEach(function (v, k) {
        g.append('path')
          .attr(
            'd',
            'M' +
              nx(k) +
              ',' +
              (yN + 8) +
              ' C' +
              nx(k) +
              ',' +
              (yN + yZ) / 2 +
              ' ' +
              x2(v) +
              ',' +
              (yN + yZ) / 2 +
              ' ' +
              x2(v) +
              ',' +
              (yZ - 6),
          )
          .attr('fill', 'none')
          .attr('stroke', k === n - 1 ? ctx.c.accent : ctx.c.strong)
          .attr('stroke-width', k === n - 1 ? 2 : 1);
        g.append('circle')
          .attr('cx', nx(k))
          .attr('cy', yN)
          .attr('r', 4)
          .attr('fill', k === n - 1 ? ctx.c.accent : ctx.c.text);
        if (n <= 16 || k === n - 1)
          g.append('text')
            .attr('x', nx(k))
            .attr('y', yN - 9)
            .attr('text-anchor', 'middle')
            .text(k);
        g.append('circle')
          .attr('cx', x2(v))
          .attr('cy', yZ)
          .attr('r', 4.5)
          .attr('fill', k === n - 1 ? ctx.c.accent : ctx.c.text);
        if (n <= 16 || k === n - 1)
          g.append('text')
            .attr('x', x2(v))
            .attr('y', yZ + 18)
            .attr('text-anchor', 'middle')
            .text(v);
      });
      note.innerHTML =
        mode === 'z'
          ? 'Zig-zag 0, 1, −1, 2, −2, …: every integer gets exactly one natural number. A bijection with ℕ.'
          : 'Even numbers 0, 2, −2, 4, −4, …: a “smaller” set, yet just as countable.';
    },
  });
}

/* ---- 0.7 SMC vs Jaccard ------------------------------------------------- */

function bits() {
  var host = document.getElementById('bits');
  var ctl = document.getElementById('bits-controls');
  var out = document.getElementById('bits-readout');
  var m = 1000;
  var k = 20;
  var common = 2;
  var sm = slider({
    label: 'Exams offered (m)',
    min: 100,
    max: 1000,
    step: 50,
    value: m,
    onInput: function (v) {
      m = v;
      update();
    },
  });
  var sk = slider({
    label: 'Exams chosen by each',
    min: 4,
    max: 50,
    value: k,
    onInput: function (v) {
      k = v;
      sc.input.max = k;
      if (common > k) {
        common = k;
        sc.value = k;
      }
      update();
    },
  });
  var sc = slider({
    label: 'Exams in common',
    min: 0,
    max: k,
    value: common,
    onInput: function (v) {
      common = v;
      update();
    },
  });
  ctl.append(
    sm.el,
    sk.el,
    sc.el,
    el(
      'p',
      'ctl-note',
      'Drag “exams in common” to 0: SMC barely moves, Jaccard drops to zero. Shared absences are not similarity.',
    ),
  );
  var set = readout(out);

  var rowA = el('div', 'bits-row', '<span class="bits-row__name">Anna</span>');
  var rowM = el('div', 'bits-row', '<span class="bits-row__name">Marco</span>');
  var gA = el('div', 'bits-grid');
  var gM = el('div', 'bits-grid');
  rowA.append(gA);
  rowM.append(gM);
  var legendEl = el(
    'div',
    'bits-legend',
    '<span><i style="--c:var(--ds-accent-fill)"></i>chosen by both (f₁₁)</span><span><i style="--c:var(--ds-text)"></i>chosen by one (f₁₀, f₀₁)</span><span><i style="--c:var(--ds-line)"></i>chosen by neither (f₀₀)</span>',
  );
  host.append(rowA, rowM, legendEl);

  function update() {
    var cols = m >= 500 ? 50 : 25;
    var r = rng(12);
    // spread the chosen exams across the plan
    var slots = d3.shuffler(r)(d3.range(m));
    var shared = new Set(slots.slice(0, common));
    var onlyA = new Set(slots.slice(common, k));
    var onlyM = new Set(slots.slice(k, 2 * k - common));
    [gA, gM].forEach(function (grid, who) {
      grid.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
      var html = '';
      for (var i = 0; i < m; i++) {
        var cls = shared.has(i) ? 'both' : (who === 0 ? onlyA : onlyM).has(i) ? 'on' : '';
        html += '<i class="' + cls + '"></i>';
      }
      grid.innerHTML = html;
    });
    var f11 = common;
    var f10 = k - common;
    var f01 = k - common;
    var f00 = m - 2 * k + common;
    var smc = (f11 + f00) / m;
    var j = f11 / (f11 + f10 + f01);
    set([
      { k: 'f₁₁', v: f11 },
      { k: 'f₁₀ = f₀₁', v: f10 },
      { k: 'f₀₀', v: f00 },
      { k: 'SMC', v: fmt(smc, 3), hot: true, color: 'var(--ds-text)' },
      { k: 'Jaccard', v: fmt(j, 3), hot: true },
    ]);
  }
  update();
}

/* ---- 0.8 documents ------------------------------------------------------ */

function documents() {
  var t = document.getElementById('doc-table');
  var terms = [
    'team',
    'coach',
    'play',
    'ball',
    'score',
    'game',
    'win',
    'lost',
    'timeout',
    'season',
  ];
  var docs = [
    [3, 0, 5, 0, 2, 6, 0, 2, 0, 2],
    [0, 7, 0, 2, 1, 0, 0, 3, 0, 0],
    [0, 1, 0, 0, 1, 2, 2, 0, 3, 0],
  ];
  var max = 7;
  t.innerHTML =
    '<thead><tr><th></th>' +
    terms
      .map(function (x) {
        return '<th class="num">' + x + '</th>';
      })
      .join('') +
    '</tr></thead><tbody>' +
    docs
      .map(function (r, i) {
        return (
          '<tr><td><strong>Document ' +
          (i + 1) +
          '</strong></td>' +
          r
            .map(function (v) {
              return (
                '<td class="num" style="background:color-mix(in srgb, var(--ds-accent-fill) ' +
                Math.round((v / max) * 55) +
                '%, transparent)">' +
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
}

/* ---- 0.8 transactions --------------------------------------------------- */

function transactions() {
  var host = document.getElementById('tx');
  var tx = [
    ['Bread', 'Coke', 'Milk'],
    ['Beer', 'Bread'],
    ['Beer', 'Coke', 'Diaper', 'Milk'],
    ['Beer', 'Bread', 'Diaper', 'Milk'],
    ['Coke', 'Diaper', 'Milk'],
  ];
  var items = ['Beer', 'Bread', 'Coke', 'Diaper', 'Milk'];
  var picked = new Set();
  var wrap = el('div', 'tx');
  var chips = el('div', 'tx__items');
  var baskets = el('div', 'tx__baskets');
  var note = el('p', 'ctl-note');
  wrap.append(chips, baskets, note);
  host.append(wrap);
  items.forEach(function (it) {
    var b = el('button', 'chip', it);
    b.type = 'button';
    b.setAttribute('aria-pressed', 'false');
    b.addEventListener('click', function () {
      if (picked.has(it)) picked.delete(it);
      else picked.add(it);
      b.classList.toggle('is-on', picked.has(it));
      b.setAttribute('aria-pressed', String(picked.has(it)));
      update();
    });
    chips.append(b);
  });
  function update() {
    var count = 0;
    baskets.innerHTML = '';
    tx.forEach(function (t, i) {
      var match =
        picked.size > 0 &&
        Array.from(picked).every(function (p) {
          return t.indexOf(p) >= 0;
        });
      if (match) count++;
      var row = el(
        'div',
        'basket' + (picked.size ? (match ? ' is-match' : ' is-out') : ''),
        '<span class="basket__tid">TID ' +
          (i + 1) +
          '</span><span class="basket__items">' +
          t
            .map(function (x) {
              return '<span class="' + (picked.has(x) ? 'hit' : '') + '">' + x + '</span>';
            })
            .join('') +
          '</span>',
      );
      baskets.append(row);
    });
    note.innerHTML = picked.size
      ? '{' +
        Array.from(picked).join(', ') +
        '} appears in <strong>' +
        count +
        ' of 5</strong> transactions (support ' +
        count / 5 +
        '). Records have different lengths, and every item comes from a finite set of 5.'
      : 'Select one or more items.';
  }
  update();
}

/* ---- 0.8 ordered vs time series ----------------------------------------- */

function orderVsTime() {
  var host = document.getElementById('order-ts');
  var ctl = document.getElementById('order-ts-controls');
  var r = rng(5);
  var g = normalSampler(r);
  var days = d3.range(21).map(function (i) {
    return {
      day: new Date(2026, 5, 1 + i),
      temp: 21 + i * 0.35 + Math.sin(i / 2.2) * 2.2 + g() * 0.9,
    };
  });
  var mode = 'time';
  var seg = segmented({
    label: 'Read the values as',
    value: mode,
    options: [
      { value: 'time', label: 'Time series' },
      { value: 'rank', label: 'Ranking' },
    ],
    onChange: function (v) {
      mode = v;
      c.redraw();
      note.innerHTML = notes[v];
    },
  });
  var notes = {
    time: 'Daily temperature in June: each value has a timestamp. The trend and the oscillation exist only because of the temporal sequence.',
    rank: 'The same 21 values ranked 1st…21st: positions can be compared, but the time interval is gone and so is the trend.',
  };
  var note = el('p', 'ctl-note', notes[mode]);
  ctl.append(seg.el, note);

  var c = chart(host, {
    aspect: 0.55,
    margin: { top: 18, right: 14, bottom: 36, left: 40 },
    draw: function (ctx) {
      var data = days.map(function (d, i) {
        return Object.assign({ i: i }, d);
      });
      var ranked = data.slice().sort(function (a, b) {
        return b.temp - a.temp;
      });
      ranked.forEach(function (d, k) {
        d.rank = k;
      });
      var x = d3
        .scaleLinear()
        .domain([0, 20])
        .range([8, ctx.innerW - 8]);
      var y = d3.scaleLinear().domain([16, 31]).range([ctx.innerH, 0]);
      axes(ctx, x, y, {
        xAxis: d3
          .axisBottom(x)
          .tickFormat(function (v) {
            return mode === 'time' ? d3.timeFormat('%b %d')(days[v].day) : v + 1 + 'º';
          })
          .tickValues(mode === 'time' ? [0, 5, 10, 15, 20] : [0, 4, 9, 14, 20]),
        yLabel: '°C',
        xLabel: mode === 'time' ? 'day' : 'rank',
      });
      var pos = function (d) {
        return x(mode === 'time' ? d.i : d.rank);
      };
      if (mode === 'time') {
        ctx.g
          .append('path')
          .datum(data)
          .attr(
            'd',
            d3
              .line()
              .x(pos)
              .y(function (d) {
                return y(d.temp);
              }),
          )
          .attr('fill', 'none')
          .attr('stroke', ctx.c.series[1])
          .attr('stroke-width', 2);
      }
      ctx.g
        .selectAll('rect.bar')
        .data(data)
        .join('rect')
        .attr('x', function (d) {
          return pos(d) - 3;
        })
        .attr('width', mode === 'rank' ? 6 : 0)
        .attr('y', function (d) {
          return y(d.temp);
        })
        .attr('height', function (d) {
          return ctx.innerH - y(d.temp);
        })
        .attr('rx', 2)
        .attr('fill', ctx.c.series[0])
        .attr('opacity', 0.35);
      ctx.g
        .selectAll('circle')
        .data(data)
        .join('circle')
        .attr('cx', pos)
        .attr('cy', function (d) {
          return y(d.temp);
        })
        .attr('r', 4.5)
        .attr('fill', mode === 'time' ? ctx.c.series[1] : ctx.c.series[0])
        .attr('stroke', ctx.c.surface)
        .attr('stroke-width', 2)
        .on('pointerenter', function (e, d) {
          showTip(
            e,
            '<b>' +
              d3.timeFormat('%b %d')(d.day) +
              '</b><br>' +
              d.temp.toFixed(1) +
              ' °C · rank ' +
              (d.rank + 1),
          );
        })
        .on('pointerleave', hideTip);
    },
  });
}

/* ---- 0.8 spatio-temporal ------------------------------------------------ */

function spatio() {
  var host = document.getElementById('spatio');
  var ctl = document.getElementById('spatio-controls');
  var W = 72;
  var H = 36;
  var month = 0;
  var playing = false;
  var timer = 0;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // blobby continents: a sum of gaussians thresholded
  var r = rng(3);
  var blobs = [
    [0.2, 0.3, 0.09],
    [0.27, 0.62, 0.07],
    [0.5, 0.28, 0.08],
    [0.53, 0.55, 0.08],
    [0.68, 0.3, 0.12],
    [0.82, 0.68, 0.06],
    [0.75, 0.42, 0.06],
    [0.5, 0.95, 0.12],
  ];
  var land = new Float32Array(W * H);
  for (var j = 0; j < H; j++) {
    for (var i = 0; i < W; i++) {
      var s = 0;
      blobs.forEach(function (b) {
        var dx = i / W - b[0];
        var dy = j / H - b[1];
        s += Math.exp(-(dx * dx + dy * dy) / (2 * b[2] * b[2]));
      });
      s += (r() - 0.5) * 0.25;
      land[j * W + i] = s > 0.55 ? 1 : 0;
    }
  }
  function temp(i, j, m) {
    var lat = 90 - (j + 0.5) * (180 / H); // +90 … −90
    var season = Math.cos(((m - 6.5) / 12) * 2 * Math.PI); // −1 in Jul … +1 in Jan
    var base = 28 - 0.55 * Math.abs(lat) - (Math.abs(lat) > 60 ? (Math.abs(lat) - 60) * 0.6 : 0);
    var amp = (Math.abs(lat) / 90) * 14 * (land[j * W + i] ? 1.8 : 0.7);
    var hemi = lat >= 0 ? -1 : 1;
    return base + hemi * season * amp + Math.sin(i / 5 + j / 3) * 1.2;
  }

  var wrap = el('div', 'spatio-wrap');
  var canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Synthetic world map of surface temperature for one month');
  wrap.append(canvas);
  host.append(wrap);
  var ctx2 = canvas.getContext('2d');

  var sm = slider({
    label: 'Month',
    min: 0,
    max: 11,
    value: month,
    format: function (v) {
      return MONTHS[v];
    },
    onInput: function (v) {
      month = v;
      draw();
    },
  });
  var play = button('▶ Play the year', function () {
    playing = !playing;
    play.textContent = playing ? '❚❚ Pause' : '▶ Play the year';
    clearInterval(timer);
    if (playing) {
      timer = setInterval(function () {
        month = (month + 1) % 12;
        sm.value = month;
        draw();
      }, 650);
    }
  });
  var info = el(
    'p',
    'ctl-note',
    'Hover a cell: its value is close to its neighbours in space and to itself in the previous month.',
  );
  ctl.append(sm.el, play, info);

  function draw() {
    var c = colors();
    var img = ctx2.createImageData(W, H);
    var scale = d3
      .scaleLinear()
      .domain([-30, 0, 15, 35])
      .range(['#2a4f9e', '#9cc3e6', '#f3e3b5', '#c2410c'])
      .clamp(true);
    for (var j = 0; j < H; j++) {
      for (var i = 0; i < W; i++) {
        var col = d3.rgb(scale(temp(i, j, month)));
        var k = (j * W + i) * 4;
        var shade = land[j * W + i] ? 1 : 0.86;
        img.data[k] = col.r * shade;
        img.data[k + 1] = col.g * shade;
        img.data[k + 2] = col.b * shade;
        img.data[k + 3] = 255;
      }
    }
    ctx2.putImageData(img, 0, 0);
    void c;
  }
  canvas.addEventListener('pointermove', function (e) {
    var rect = canvas.getBoundingClientRect();
    var i = Math.floor(((e.clientX - rect.left) / rect.width) * W);
    var j = Math.floor(((e.clientY - rect.top) / rect.height) * H);
    if (i < 0 || j < 0 || i >= W || j >= H) return;
    var t = temp(i, j, month);
    var nb = [
      [i - 1, j],
      [i + 1, j],
      [i, j - 1],
      [i, j + 1],
    ]
      .filter(function (p) {
        return p[0] >= 0 && p[1] >= 0 && p[0] < W && p[1] < H;
      })
      .map(function (p) {
        return temp(p[0], p[1], month);
      });
    var prev = temp(i, j, (month + 11) % 12);
    showTip(
      e,
      '<b>' +
        t.toFixed(1) +
        ' °C</b> · ' +
        (land[j * W + i] ? 'land' : 'sea') +
        '<br><span class="tip__k">neighbours</span> ' +
        d3.mean(nb).toFixed(1) +
        ' °C<br><span class="tip__k">' +
        MONTHS[(month + 11) % 12] +
        '</span> ' +
        prev.toFixed(1) +
        ' °C',
    );
  });
  canvas.addEventListener('pointerleave', hideTip);
  draw();
  onThemeChange(draw);
}

/* ---- 0.9 inventory & bank ---------------------------------------------- */

function inventory() {
  var host = document.getElementById('inventory');
  var items = [
    ['Bank data', 'Real', '600 × 12', 'Customers, demographics and whether they bought a PEP.'],
    ['Titanic', 'Real', '891 × 12', 'Passengers of the RMS Titanic and who survived.'],
    ['Iris', 'Real', '150 × 5', 'Sepal and petal measures of three iris species.'],
    [
      'Eating in the UK',
      'Real',
      '4 × 17',
      'Grams per person per week of 17 foods, per UK country.',
    ],
    [
      'Political compass',
      'Mixed',
      '10 dims',
      'Party profiles and citizens answering a 10-question survey.',
    ],
    [
      'Synthetic labs',
      'Generated',
      'seeded',
      'Skewed and heavy-tailed samples, ice-cream vs drownings, 5-D blobs.',
    ],
  ];
  host.innerHTML = items
    .map(function (it) {
      return (
        '<li><div class="inv"><div class="inv__top"><span class="inv__kind">' +
        it[1] +
        '</span><span class="inv__size">' +
        it[2] +
        '</span></div><h4>' +
        it[0] +
        '</h4><p>' +
        it[3] +
        '</p></div></li>'
      );
    })
    .join('');
}

function bank() {
  var t = document.getElementById('bank-attrs');
  t.innerHTML =
    '<thead><tr><th>Attribute</th><th>Description</th><th>Type</th></tr></thead><tbody>' +
    BANK_ATTRS.map(function (a) {
      var type = a.type === 'binary' ? 'nominal' : a.type === 'id' ? 'nominal' : a.type;
      return (
        '<tr><td><code>' +
        a.key +
        '</code></td><td class="wrap">' +
        a.desc +
        '</td><td><span class="type-chip type-chip--' +
        type +
        '">' +
        (a.type === 'binary' ? 'binary' : a.type === 'id' ? 'id' : a.type) +
        '</span></td></tr>'
      );
    }).join('') +
    '</tbody>';

  var peek = document.getElementById('bank-peek');
  var status = document.getElementById('bank-peek-status');
  loadCsv('bank-data.csv').then(function (rows) {
    var cols = rows.columns;
    status.textContent = rows.length + ' rows · ' + cols.length + ' columns';
    var r = rows.slice(0, 8);
    peek.innerHTML =
      '<thead><tr>' +
      cols
        .map(function (c) {
          return '<th>' + c + '</th>';
        })
        .join('') +
      '</tr></thead><tbody>' +
      r
        .map(function (row) {
          return (
            '<tr>' +
            cols
              .map(function (c) {
                var v = row[c];
                return (
                  '<td class="' +
                  (typeof v === 'number' ? 'num' : '') +
                  '">' +
                  (typeof v === 'number' ? fmt(v, 1) : v) +
                  '</td>'
                );
              })
              .join('') +
            '</tr>'
          );
        })
        .join('') +
      '</tbody>';
  });
}
