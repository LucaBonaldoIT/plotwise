/**
 * Reusable marks drawn into a chart() context: histograms, box plots, density curves and
 * labelled reference lines.
 */
import { d3, showTip, hideTip } from './chart.js';
import { quantile, sorted, gaussianKde, silverman, fmt } from './stats.js';

/** Histogram bins over a fixed domain */
export function bins(xs, domain, count) {
  return d3
    .bin()
    .domain(domain)
    .thresholds(d3.ticks(domain[0], domain[1], count))(xs);
}

/**
 * histogram(ctx, xs, { x, y, color, bins, density, opacity, label, gap })
 * Returns the bins so callers can set a y domain beforehand if they want.
 */
export function histogram(ctx, xs, o) {
  var b = (o.binsData || bins(xs, o.x.domain(), o.bins || 20)).filter(function (d) {
    return d.x1 > d.x0;
  });
  var n = xs.length;
  var g = ctx.g.append('g');
  g.selectAll('rect')
    .data(b)
    .join('rect')
    .attr('x', function (d) {
      return o.x(d.x0) + 1;
    })
    .attr('width', function (d) {
      return Math.max(0, o.x(d.x1) - o.x(d.x0) - 2);
    })
    .attr('y', function (d) {
      return o.y(o.density ? d.length / n / (d.x1 - d.x0) : d.length);
    })
    .attr('height', function (d) {
      return ctx.innerH - o.y(o.density ? d.length / n / (d.x1 - d.x0) : d.length);
    })
    .attr('rx', 2)
    .attr('fill', o.color)
    .attr('opacity', o.opacity === undefined ? 0.85 : o.opacity)
    .on('pointerenter', function (e, d) {
      showTip(
        e,
        (o.label ? '<b>' + o.label + '</b><br>' : '') +
          '[' +
          fmt(d.x0) +
          ', ' +
          fmt(d.x1) +
          ')<br><span class="tip__k">count</span> ' +
          d.length +
          ' · ' +
          fmt((d.length / n) * 100, 1) +
          '%',
      );
    })
    .on('pointerleave', hideTip);
  return b;
}

export function maxBinCount(xs, domain, count, density) {
  var b = bins(xs, domain, count).filter(function (d) {
    return d.x1 > d.x0;
  });
  var n = xs.length;
  return d3.max(b, function (d) {
    return density ? d.length / n / (d.x1 - d.x0) : d.length;
  });
}

/** Density curve via Gaussian KDE */
export function density(ctx, xs, o) {
  var dom = o.x.domain();
  var grid = d3.range(0, 121).map(function (i) {
    return dom[0] + ((dom[1] - dom[0]) * i) / 120;
  });
  var pts = gaussianKde(xs, o.bandwidth || silverman(xs), grid);
  var line = d3
    .line()
    .x(function (d) {
      return o.x(d[0]);
    })
    .y(function (d) {
      return o.y(d[1] * (o.scale || 1));
    })
    .curve(d3.curveBasis);
  if (o.fill) {
    ctx.g
      .append('path')
      .datum(pts)
      .attr(
        'd',
        d3
          .area()
          .x(function (d) {
            return o.x(d[0]);
          })
          .y0(ctx.innerH)
          .y1(function (d) {
            return o.y(d[1] * (o.scale || 1));
          })
          .curve(d3.curveBasis),
      )
      .attr('fill', o.color)
      .attr('opacity', o.fillOpacity || 0.18);
  }
  ctx.g
    .append('path')
    .datum(pts)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', o.color)
    .attr('stroke-width', 2);
  return pts;
}

/** Vertical reference line with a label on top */
export function vline(ctx, x, value, label, color, o) {
  o = o || {};
  var g = ctx.g.append('g').attr('class', 'vline');
  var px = x(value);
  g.append('line')
    .attr('x1', px)
    .attr('x2', px)
    .attr('y1', o.top === undefined ? 0 : o.top)
    .attr('y2', ctx.innerH)
    .attr('stroke', color)
    .attr('stroke-width', o.width || 2)
    .attr('stroke-dasharray', o.dash || null);
  if (label) {
    var anchor = px > ctx.innerW * 0.8 ? 'end' : px < ctx.innerW * 0.2 ? 'start' : 'middle';
    g.append('text')
      .attr('class', 'label')
      .attr('x', px + (anchor === 'end' ? -4 : anchor === 'start' ? 4 : 0))
      .attr('y', (o.top === undefined ? 0 : o.top) + (o.dy || 10))
      .attr('text-anchor', anchor)
      .attr('fill', color)
      .style('fill', color)
      .text(label);
  }
  return g;
}

/** Five-number summary + Tukey fences */
export function boxStats(xs) {
  var s = sorted(xs);
  var q1 = quantile(s, 0.25, true);
  var q2 = quantile(s, 0.5, true);
  var q3 = quantile(s, 0.75, true);
  var iqr = q3 - q1;
  var lo = q1 - 1.5 * iqr;
  var hi = q3 + 1.5 * iqr;
  var inside = Array.from(s).filter(function (v) {
    return v >= lo && v <= hi;
  });
  return {
    q1: q1,
    q2: q2,
    q3: q3,
    iqr: iqr,
    whiskerLo: inside[0],
    whiskerHi: inside[inside.length - 1],
    outliers: Array.from(s).filter(function (v) {
      return v < lo || v > hi;
    }),
  };
}

/** Horizontal box plot centred on cy with height h */
export function boxplot(ctx, xs, o) {
  var b = boxStats(xs);
  var x = o.x;
  var cy = o.cy;
  var h = o.h || 22;
  var g = ctx.g.append('g');
  g.append('line')
    .attr('x1', x(b.whiskerLo))
    .attr('x2', x(b.whiskerHi))
    .attr('y1', cy)
    .attr('y2', cy)
    .attr('stroke', o.stroke || ctx.c.text)
    .attr('stroke-width', 1.5);
  [b.whiskerLo, b.whiskerHi].forEach(function (v) {
    g.append('line')
      .attr('x1', x(v))
      .attr('x2', x(v))
      .attr('y1', cy - h / 4)
      .attr('y2', cy + h / 4)
      .attr('stroke', o.stroke || ctx.c.text)
      .attr('stroke-width', 1.5);
  });
  g.append('rect')
    .attr('x', x(b.q1))
    .attr('width', Math.max(1, x(b.q3) - x(b.q1)))
    .attr('y', cy - h / 2)
    .attr('height', h)
    .attr('rx', 3)
    .attr('fill', o.color)
    .attr('fill-opacity', 0.25)
    .attr('stroke', o.color)
    .attr('stroke-width', 1.5);
  g.append('line')
    .attr('x1', x(b.q2))
    .attr('x2', x(b.q2))
    .attr('y1', cy - h / 2)
    .attr('y2', cy + h / 2)
    .attr('stroke', o.color)
    .attr('stroke-width', 2.5);
  g.selectAll('circle')
    .data(b.outliers)
    .join('circle')
    .attr('cx', function (d) {
      return x(d);
    })
    .attr('cy', cy)
    .attr('r', 3)
    .attr('fill', 'none')
    .attr('stroke', o.color)
    .attr('stroke-width', 1.25);
  g.append('rect')
    .attr('class', 'hit')
    .attr('x', x(b.whiskerLo) - 4)
    .attr('width', x(b.whiskerHi) - x(b.whiskerLo) + 8)
    .attr('y', cy - h / 2 - 4)
    .attr('height', h + 8)
    .on('pointerenter', function (e) {
      showTip(
        e,
        (o.label ? '<b>' + o.label + '</b><br>' : '') +
          'Q1 ' +
          fmt(b.q1) +
          ' · median ' +
          fmt(b.q2) +
          ' · Q3 ' +
          fmt(b.q3) +
          '<br>IQR ' +
          fmt(b.iqr) +
          ' · outliers ' +
          b.outliers.length,
      );
    })
    .on('pointerleave', hideTip);
  return b;
}
