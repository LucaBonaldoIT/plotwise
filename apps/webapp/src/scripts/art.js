/**
 * Chapter opener art, drawn on a 2D canvas behind the title:
 *   'galton'  — balls fall through pegs and pile into a bell, then it stops (univariate)
 *   'pairs'   — a point cloud breathing between correlation −1 and +1 (bivariate)
 *   'cloud'   — a 3D point cloud rotating with its principal axes (multivariate)
 * Pauses off-screen; reduced motion gets a single settled frame.
 */
import { isDark, onThemeChange } from '@lucabonaldo/design';
import { rng, normalSampler } from '../lib/stats.js';

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function palette() {
  return isDark()
    ? { ink: 'rgba(240,236,223,', accent: 'rgba(236,106,69,' }
    : { ink: 'rgba(26,23,18,', accent: 'rgba(176,46,12,' };
}

export function initArt(host, kind) {
  if (!host) return;
  var canvas = document.createElement('canvas');
  host.append(canvas);
  var ctx = canvas.getContext('2d');
  var w = 0;
  var h = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  var visible = true;
  var raf = 0;
  var t = 0;
  var rand = rng(11);
  var gauss = normalSampler(rand);
  var state = null;
  var settled = false;

  function resize() {
    w = host.clientWidth;
    h = host.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    settled = settled || finished();
    state = null;
  }

  /* ---- galton board ---------------------------------------------------- */
  function galton() {
    var left = w < 960 ? w * 0.05 : w * 0.4;
    var width = w < 960 ? w * 0.9 : w * 0.24;
    var rows = 12;
    var binsN = rows + 1;
    var top = h * 0.12;
    var pegH = h * 0.42;
    var step = width / binsN;
    var bottom = h * 0.97;
    var ballR = Math.max(2, step * 0.18);
    // how many balls fit in a column above the floor (same limit the pile drawing uses)
    var cap = Math.max(1, Math.floor((bottom - top - pegH - 10) / (ballR * 1.6) - 0.5) + 1);
    if (!state) {
      // reserved: balls landed or still falling into each bin; each ball's path is chosen when it
      // is dropped, so dropping stops as soon as the tallest bin is spoken for, and the board
      // finishes exactly when that last ball lands
      state = {
        balls: [],
        piles: new Array(binsN).fill(0),
        reserved: new Array(binsN).fill(0),
        spawn: 0,
        full: false,
        done: false,
      };
      // reduced motion, or a resize after the board finished: show the finished bell at once
      if (reduced || settled) {
        for (;;) {
          var b = 0;
          for (var r = 0; r < rows; r++) b += rand() < 0.5 ? 0 : 1;
          if (state.piles[b] >= cap) break;
          state.piles[b]++;
        }
        state.full = true;
        state.done = true;
      }
    }
    var p = palette();
    ctx.clearRect(0, 0, w, h);
    // pegs
    ctx.fillStyle = p.ink + '0.22)';
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c = 0; c <= r2; c++) {
        var px = left + width / 2 + (c - r2 / 2) * step;
        var py = top + (r2 / rows) * pegH;
        ctx.beginPath();
        ctx.arc(px, py, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // piles
    for (var i = 0; i < binsN; i++) {
      var cx = left + (i + 0.5) * step;
      for (var j = 0; j < state.piles[i]; j++) {
        var yy = bottom - (j + 0.5) * ballR * 1.6;
        if (yy < top + pegH + 10) break;
        ctx.fillStyle = (i === Math.floor(binsN / 2) ? p.accent : p.ink) + '0.55)';
        ctx.beginPath();
        ctx.arc(cx + ((j % 2) - 0.5) * ballR * 0.9, yy, ballR * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (reduced || state.done) return;
    // spawn
    state.spawn += 1;
    if (!state.full && state.spawn % 4 === 0) {
      var path = [];
      var bin = 0;
      for (var r3 = 0; r3 < rows; r3++) {
        path.push(rand() < 0.5 ? 0 : 1);
        bin += path[r3];
      }
      if (state.reserved[bin] >= cap) {
        state.full = true;
      } else {
        state.reserved[bin]++;
        state.balls.push({ row: 0, pos: 0, f: 0, path: path });
      }
    }
    var still = [];
    state.balls.forEach(function (b2) {
      b2.f += 0.12;
      if (b2.f >= 1) {
        b2.f = 0;
        b2.pos += b2.path[b2.row];
        b2.row += 1;
      }
      if (b2.row >= rows) {
        state.piles[b2.pos]++;
        return;
      }
      still.push(b2);
      var x1 = left + width / 2 + (b2.pos - b2.row / 2) * step;
      var y0 = top + (b2.row / rows) * pegH;
      var y1 = top + ((b2.row + 1) / rows) * pegH;
      var bx = x1 + Math.sin(b2.f * Math.PI) * step * 0.12;
      var by = y0 + (y1 - y0) * b2.f;
      ctx.fillStyle = p.accent + '0.9)';
      ctx.beginPath();
      ctx.arc(bx, by, ballR * 0.7, 0, Math.PI * 2);
      ctx.fill();
    });
    state.balls = still;
    if (state.full && !still.length) state.done = true;
  }

  /* ---- breathing correlation ------------------------------------------- */
  function pairs() {
    if (!state) {
      state = [];
      for (var i = 0; i < 260; i++) state.push([gauss(), gauss()]);
    }
    var p = palette();
    var rho = reduced ? 0.8 : Math.sin(t * 0.35) * 0.95;
    var cx = w < 900 ? w * 0.5 : w * 0.74;
    var cy = h * 0.5;
    var s = Math.min(w < 900 ? w * 0.3 : w * 0.16, h * 0.3);
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = p.ink + '0.15)';
    ctx.beginPath();
    ctx.moveTo(cx - s * 2.6, cy);
    ctx.lineTo(cx + s * 2.6, cy);
    ctx.moveTo(cx, cy - s * 2.6);
    ctx.lineTo(cx, cy + s * 2.6);
    ctx.stroke();
    var k = Math.sqrt(1 - rho * rho);
    state.forEach(function (pt) {
      var x = pt[0];
      var y = rho * pt[0] + k * pt[1];
      ctx.fillStyle = (Math.abs(y - rho * x) < 0.25 ? p.accent : p.ink) + '0.55)';
      ctx.beginPath();
      ctx.arc(cx + x * s * 0.8, cy - y * s * 0.8, 2.6, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.strokeStyle = p.accent + '0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - s * 2.4, cy + rho * s * 2.4 * 0.8 * 1.25);
    ctx.lineTo(cx + s * 2.4, cy - rho * s * 2.4 * 0.8 * 1.25);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.fillStyle = p.ink + '0.6)';
    ctx.font = '500 12px ' + getComputedStyle(document.body).fontFamily;
    ctx.fillText('ρ = ' + rho.toFixed(2), cx + s * 1.6, cy + s * 2.2);
  }

  /* ---- rotating 3D cloud ------------------------------------------------ */
  function cloud() {
    if (!state) {
      state = [];
      for (var i = 0; i < 420; i++) {
        var a = gauss() * 1.8;
        var b = gauss() * 0.7;
        var c = gauss() * 0.3;
        state.push([a * 0.8 + b * 0.2, a * 0.5 - b * 0.6 + c, a * 0.3 + b * 0.5 - c * 0.8]);
      }
    }
    var p = palette();
    var ang = reduced ? 0.7 : t * 0.25;
    var cx = w < 900 ? w * 0.5 : w * 0.74;
    var cy = h * 0.5;
    var s = Math.min(w < 900 ? w * 0.18 : w * 0.09, h * 0.18);
    var ca = Math.cos(ang);
    var sa = Math.sin(ang);
    var tilt = 0.35;
    ctx.clearRect(0, 0, w, h);
    function proj(v) {
      var x = v[0] * ca + v[2] * sa;
      var z = -v[0] * sa + v[2] * ca;
      var y = v[1] * Math.cos(tilt) - z * Math.sin(tilt);
      var zz = v[1] * Math.sin(tilt) + z * Math.cos(tilt);
      var f = 4 / (4 + zz);
      return [cx + x * s * f, cy - y * s * f, f];
    }
    state.forEach(function (v) {
      var q = proj(v);
      ctx.fillStyle = p.ink + (0.25 + 0.35 * (q[2] - 0.6)) + ')';
      ctx.beginPath();
      ctx.arc(q[0], q[1], 2.2 * q[2], 0, Math.PI * 2);
      ctx.fill();
    });
    [
      [[0.82, 0.5, 0.3], 3.2, p.accent],
      [[0.2, -0.6, 0.5], 1.6, p.ink],
    ].forEach(function (ax) {
      var o = proj([0, 0, 0]);
      var e = proj(
        ax[0].map(function (u) {
          return u * ax[1];
        }),
      );
      var e2 = proj(
        ax[0].map(function (u) {
          return -u * ax[1];
        }),
      );
      ctx.strokeStyle = ax[2] + '0.9)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(e2[0], e2[1]);
      ctx.lineTo(e[0], e[1]);
      ctx.stroke();
      void o;
    });
    ctx.lineWidth = 1;
  }

  var draw = kind === 'galton' ? galton : kind === 'pairs' ? pairs : cloud;

  function frame() {
    raf = 0;
    t += 1 / 60;
    draw();
    if (!reduced && !finished() && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  // only the galton board has an end; the other two loop
  function finished() {
    return kind === 'galton' && state && state.done;
  }
  function kick() {
    if (!raf && !finished() && visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  new IntersectionObserver(function (e) {
    visible = e[0].isIntersecting;
    kick();
  }).observe(host);
  new ResizeObserver(function () {
    resize();
    if (reduced || settled) draw();
    kick();
  }).observe(host);
  document.addEventListener('visibilitychange', kick);
  onThemeChange(function () {
    if (reduced || finished()) draw();
  });
}
