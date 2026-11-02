/**
 * Chart scaffolding on top of d3: a responsive SVG that redraws on resize and on theme change,
 * theme-aware colors read from the design system's role tokens, and one shared tooltip.
 */
import * as d3 from 'd3';
import { onThemeChange, isDark } from '@lucabonaldo/design';

/* Categorical order, validated for CVD separation on both surfaces (light / dark steps). */
var SERIES_LIGHT = ['#c2410c', '#2563a8', '#13866a', '#b07d00', '#7b4fa0'];
var SERIES_DARK = ['#e8673f', '#5b95da', '#2fab84', '#ad8222', '#a679d6'];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function isDarkTheme() {
  return isDark();
}

export function colors() {
  var dark = isDarkTheme();
  return {
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    text: cssVar('--ds-text'),
    soft: cssVar('--ds-text-soft'),
    line: cssVar('--ds-line'),
    strong: cssVar('--ds-line-strong'),
    accent: cssVar('--ds-accent'),
    bg: cssVar('--ds-bg'),
    surface: cssVar('--ds-surface'),
    // diverging: blue ↔ neutral ↔ vermilion
    diverging: d3
      .scaleLinear()
      .domain([-1, 0, 1])
      .range(dark ? ['#5b95da', '#3a352e', '#e8673f'] : ['#2563a8', '#ece8de', '#c2410c'])
      .clamp(true),
    sequential: d3
      .scaleLinear()
      .domain([0, 1])
      .range(dark ? ['#29241e', '#e8673f'] : ['#f6efe6', '#9a2f08'])
      .clamp(true),
  };
}

/**
 * A series color as a CSS reference, for HTML that is built once (legend swatches, readouts):
 * unlike colors().series[i] it follows the theme without a re-render.
 */
export function seriesVar(i) {
  return 'var(--series-' + i + ')';
}

/* ---- tooltip ----------------------------------------------------------- */

var tip = null;

function ensureTip() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'tip';
    tip.setAttribute('role', 'status');
    document.body.appendChild(tip);
  }
  return tip;
}

export function showTip(event, html) {
  var t = ensureTip();
  t.innerHTML = html;
  t.classList.add('is-on');
  var pad = 14;
  var r = t.getBoundingClientRect();
  var x = event.clientX + pad;
  var y = event.clientY + pad;
  if (x + r.width > window.innerWidth - 8) x = event.clientX - r.width - pad;
  if (y + r.height > window.innerHeight - 8) y = event.clientY - r.height - pad;
  t.style.transform = 'translate(' + Math.max(8, x) + 'px,' + Math.max(8, y) + 'px)';
}

export function hideTip() {
  if (tip) tip.classList.remove('is-on');
}

/* ---- chart ------------------------------------------------------------- */

/* labs put the plot beside the controls from this width (.lab__body--side in app.css) */
var sideLayout = window.matchMedia('(min-width: 900px)');

/** Height of an element's content, ignoring the stretch a grid row gives it. */
function contentHeight(el) {
  var last = el.lastElementChild;
  if (!last) return 0;
  var top = el.getBoundingClientRect().top;
  return last.getBoundingClientRect().bottom - top + parseFloat(getComputedStyle(el).paddingBottom);
}

/**
 * chart(host, { height, aspect, margin, fill, draw(ctx) }) → { redraw }
 * ctx: { svg, g, width, height, innerW, innerH, c (colors) }
 * fill: beside the controls of a side lab, grow taller (never shorter) so the plot column ends
 * where the controls do instead of leaving empty space below the chart.
 */
export function chart(host, opts) {
  var margin = Object.assign({ top: 16, right: 16, bottom: 36, left: 48 }, opts.margin || {});
  var svg = d3.select(host).append('svg').attr('class', 'chart-svg');
  var lastW = 0;
  var visible = false;
  var dirty = true;

  function size() {
    var w = host.clientWidth || 320;
    var h = opts.height
      ? typeof opts.height === 'function'
        ? opts.height(w)
        : opts.height
      : Math.round(w * (opts.aspect || 0.62));
    if (opts.fill) h = Math.max(h, fillHeight());
    return { w: w, h: h };
  }

  var lastCtl = 0;
  function fillHeight() {
    var body = host.closest('.lab__body--side');
    if (!body || !sideLayout.matches) return 0;
    var plot = host.closest('.lab__plot');
    var ctl = body.querySelector(':scope > .lab__controls');
    if (!plot || !ctl) return 0;
    lastCtl = contentHeight(ctl);
    var mine = svg.node().getBoundingClientRect().height;
    // with charts side by side (.lab__plots), this one's cell may already be taller than the chart
    // because a neighbour grew first: count that spare room too, so both end up the same height
    var cell = host.closest('.lab__plots > *');
    var spare = cell ? cell.getBoundingClientRect().height - contentHeight(cell) : 0;
    return Math.round(mine + spare + (lastCtl - contentHeight(plot)));
  }

  function redraw() {
    if (!visible) {
      dirty = true;
      return;
    }
    dirty = false;
    var s = size();
    svg
      .attr('viewBox', '0 0 ' + s.w + ' ' + s.h)
      .attr('width', s.w)
      .attr('height', s.h);
    svg.selectAll('*').remove();
    var g = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
    opts.draw({
      svg: svg,
      g: g,
      width: s.w,
      height: s.h,
      innerW: Math.max(10, s.w - margin.left - margin.right),
      innerH: Math.max(10, s.h - margin.top - margin.bottom),
      margin: margin,
      c: colors(),
    });
  }

  var io = new IntersectionObserver(
    function (entries) {
      visible = entries[0].isIntersecting;
      if (visible && dirty) redraw();
    },
    { rootMargin: '200px' },
  );
  io.observe(host);

  var timer = 0;
  new ResizeObserver(function () {
    var w = host.clientWidth;
    if (w === lastW) return;
    lastW = w;
    clearTimeout(timer);
    timer = setTimeout(redraw, 60);
  }).observe(host);

  onThemeChange(redraw);

  if (opts.fill) {
    // follow the controls when their content grows or shrinks (a readout wraps, a section opens)
    var body = host.closest('.lab__body--side');
    var ctl = body && body.querySelector(':scope > .lab__controls');
    if (ctl) {
      new ResizeObserver(function () {
        if (Math.abs(contentHeight(ctl) - lastCtl) > 4) {
          clearTimeout(timer);
          timer = setTimeout(redraw, 60);
        }
      }).observe(ctl);
    }
    sideLayout.addEventListener('change', redraw);
  }

  return {
    redraw: redraw,
    svg: svg,
  };
}

/* ---- dragging -------------------------------------------------------- */

/**
 * Drag the point nearest to where a pointer goes down, within `radius` px, instead of requiring a
 * hit on the small dot itself: a fingertip is much wider than a dot. Listens on the whole chart, so
 * a press away from every point is left alone (page scroll, or a click handler underneath).
 * items() → [{ x, y, d }] in plot coordinates; onDrag(d, x, y) gets the dragged point's new spot.
 */
export function dragNearest(ctx, items, onDrag, opts) {
  opts = opts || {};
  var radius = opts.radius || 28;
  ctx.svg.call(
    d3
      .drag()
      .container(ctx.g.node())
      .subject(function (e) {
        var best = null;
        var bestD = radius * radius;
        items().forEach(function (it) {
          var dx = it.x - e.x;
          var dy = it.y - e.y;
          var d2 = dx * dx + dy * dy;
          if (d2 <= bestD) {
            bestD = d2;
            best = it;
          }
        });
        return best;
      })
      .on('drag', function (e) {
        onDrag(e.subject.d, e.x, e.y);
      })
      .on('end', function (e) {
        if (opts.onEnd) opts.onEnd(e.subject.d);
      }),
  );
  // d3.drag sets touch-action: none on what it is attached to, which would block page scrolling
  // over the whole chart; restore the stylesheet's pan-y. A drag that does grab a point still stops
  // the scroll, because d3 cancels its touchmove events.
  ctx.svg.style('touch-action', null);
}

/* ---- axis helpers ------------------------------------------------------ */

export function axes(ctx, x, y, opts) {
  opts = opts || {};
  var c = ctx.c;
  var xa = ctx.g
    .append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(0,' + ctx.innerH + ')')
    .call(
      (opts.xAxis || d3.axisBottom(x))
        .ticks(opts.xTicks || Math.max(3, Math.floor(ctx.innerW / 80)))
        .tickSizeOuter(0),
    );
  var ya = ctx.g
    .append('g')
    .attr('class', 'axis')
    .call(
      (opts.yAxis || d3.axisLeft(y))
        .ticks(opts.yTicks || Math.max(3, Math.floor(ctx.innerH / 50)))
        .tickSizeOuter(0),
    );
  if (opts.grid !== false && y.ticks) {
    ctx.g
      .insert('g', ':first-child')
      .attr('class', 'grid')
      .selectAll('line')
      .data(y.ticks(opts.yTicks || Math.max(3, Math.floor(ctx.innerH / 50))))
      .join('line')
      .attr('x1', 0)
      .attr('x2', ctx.innerW)
      .attr('y1', y)
      .attr('y2', y)
      .attr('stroke', c.line)
      .attr('stroke-dasharray', '2 4');
  }
  if (opts.xLabel) {
    ctx.g
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', ctx.innerW)
      .attr('y', ctx.innerH + 32)
      .attr('text-anchor', 'end')
      .text(opts.xLabel);
  }
  if (opts.yLabel) {
    ctx.g
      .append('text')
      .attr('class', 'axis-label')
      .attr('x', 0)
      .attr('y', -6)
      .attr('text-anchor', 'start')
      .text(opts.yLabel);
  }
  return { xa: xa, ya: ya };
}

/** Compact legend in the top-right corner of the plot area */
export function legend(ctx, items, opts) {
  opts = opts || {};
  var g = ctx.g.append('g').attr('class', 'legend');
  var x = 0;
  items.forEach(function (it) {
    var item = g.append('g').attr('transform', 'translate(' + x + ',0)');
    item
      .append('circle')
      .attr('r', 4.5)
      .attr('cx', 5)
      .attr('cy', 0)
      .attr('fill', it.color)
      .attr('opacity', it.muted ? 0.3 : 1);
    var t = item.append('text').attr('x', 14).attr('y', 4).text(it.label);
    x += 14 + t.node().getComputedTextLength() + 14;
  });
  var w = x - 14;
  var tx = opts.left ? 0 : Math.max(0, ctx.innerW - w);
  g.attr('transform', 'translate(' + tx + ',' + (opts.y === undefined ? -4 : opts.y) + ')');
  return g;
}

export { d3 };
