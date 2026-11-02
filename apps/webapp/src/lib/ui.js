/**
 * Tiny control builders: sliders, segmented toggles, selects and switches that share one look
 * (styles in styles/controls.css). Each returns its element and exposes .value.
 */

var uid = 0;
function nextId(prefix) {
  uid += 1;
  return prefix + '-' + uid;
}

function el(tag, cls, html) {
  var e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

export { el };

/**
 * iOS Safari only moves a range input when the thumb itself is dragged. For touch, tapping or
 * dragging anywhere on the track sets the value; a mostly vertical swipe is left to page scrolling
 * (touch-action: pan-y, which cancels the pointer). Chrome jumps the thumb on touch-down even when
 * the gesture turns into a scroll, so a cancelled touch restores the value it started from.
 */
function touchDrag(input) {
  var start = null;
  var dragging = false;

  function setFromX(clientX) {
    var r = input.getBoundingClientRect();
    var thumb = parseFloat(getComputedStyle(input).fontSize) * 1.15;
    var p = (clientX - r.left - thumb / 2) / Math.max(1, r.width - thumb);
    var min = Number(input.min);
    var max = Number(input.max);
    var step = Number(input.step) || 1;
    var v = min + Math.min(1, Math.max(0, p)) * (max - min);
    v = Math.round((v - min) / step) * step + min;
    v = Number(v.toFixed(6));
    if (Number(input.value) !== v) {
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  input.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'touch') return;
    start = { x: e.clientX, y: e.clientY, value: input.value };
    dragging = false;
  });
  input.addEventListener('pointermove', function (e) {
    if (!start || e.pointerType !== 'touch') return;
    if (!dragging) {
      var dx = Math.abs(e.clientX - start.x);
      var dy = Math.abs(e.clientY - start.y);
      if (dx < 4 || dx < dy) return;
      dragging = true;
    }
    setFromX(e.clientX);
  });
  input.addEventListener('pointerup', function (e) {
    if (!start || e.pointerType !== 'touch') return;
    setFromX(e.clientX);
    start = null;
  });
  input.addEventListener('pointercancel', function () {
    if (start && input.value !== start.value) {
      input.value = start.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    start = null;
  });
}

/** slider({ label, min, max, step, value, format, onInput }) */
export function slider(opts) {
  var id = nextId('s');
  var wrap = el('div', 'ctl ctl--slider');
  var head = el('div', 'ctl__head');
  var label = el('label', 'ctl__label', opts.label);
  label.htmlFor = id;
  var out = el('output', 'ctl__value');
  out.htmlFor = id;
  head.append(label, out);
  var input = document.createElement('input');
  input.type = 'range';
  input.id = id;
  input.min = opts.min;
  input.max = opts.max;
  input.step = opts.step || 1;
  input.value = opts.value;
  var fmt =
    opts.format ||
    function (v) {
      return String(v);
    };
  function paint() {
    var p = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty('--p', p + '%');
    out.textContent = fmt(Number(input.value));
  }
  input.addEventListener('input', function () {
    paint();
    if (opts.onInput) opts.onInput(Number(input.value));
  });
  touchDrag(input);
  paint();
  wrap.append(head, input);
  return {
    el: wrap,
    input: input,
    get value() {
      return Number(input.value);
    },
    set value(v) {
      input.value = v;
      paint();
    },
  };
}

/** segmented({ label, options: [{value, label}], value, onChange }) */
export function segmented(opts) {
  var wrap = el('div', 'ctl ctl--seg');
  if (opts.label) wrap.append(el('span', 'ctl__label', opts.label));
  var group = el('div', 'seg');
  group.setAttribute('role', 'radiogroup');
  if (opts.label) group.setAttribute('aria-label', opts.label.replace(/<[^>]+>/g, ''));
  var current = opts.value;
  var buttons = opts.options.map(function (o) {
    var b = el('button', 'seg__btn', o.label);
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.value = o.value;
    b.addEventListener('click', function () {
      set(o.value, true);
    });
    group.append(b);
    return b;
  });
  function set(v, fire) {
    current = v;
    buttons.forEach(function (b) {
      var on = b.dataset.value === String(v);
      b.setAttribute('aria-checked', String(on));
      b.classList.toggle('is-on', on);
    });
    if (fire && opts.onChange) opts.onChange(v);
  }
  set(current, false);
  wrap.append(group);
  return {
    el: wrap,
    get value() {
      return current;
    },
    set value(v) {
      set(v, false);
    },
  };
}

/** select({ label, options: [{value, label}], value, onChange }) */
export function select(opts) {
  var id = nextId('sel');
  var wrap = el('div', 'ctl ctl--select');
  var label = el('label', 'ctl__label', opts.label);
  label.htmlFor = id;
  var s = document.createElement('select');
  s.className = 'ds-input';
  s.id = id;
  opts.options.forEach(function (o) {
    var op = document.createElement('option');
    op.value = o.value;
    op.textContent = o.label;
    s.append(op);
  });
  s.value = opts.value;
  s.addEventListener('change', function () {
    if (opts.onChange) opts.onChange(s.value);
  });
  wrap.append(label, s);
  return {
    el: wrap,
    get value() {
      return s.value;
    },
    set value(v) {
      s.value = v;
    },
  };
}

/** toggle({ label, checked, onChange }) */
export function toggle(opts) {
  var wrap = el('label', 'ctl ctl--toggle');
  var input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('role', 'switch');
  input.checked = !!opts.checked;
  var track = el('span', 'switch');
  track.setAttribute('aria-hidden', 'true');
  wrap.append(input, track, el('span', 'ctl__label', opts.label));
  input.addEventListener('change', function () {
    if (opts.onChange) opts.onChange(input.checked);
  });
  return {
    el: wrap,
    get value() {
      return input.checked;
    },
    set value(v) {
      input.checked = v;
    },
  };
}

export function button(label, onClick, cls) {
  var b = el('button', 'ds-button ' + (cls || ''), label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Key/value readout grid: readout(host) → set([{k, v, hint, hot}]) */
export function readout(host) {
  var dl = el('dl', 'readout');
  host.append(dl);
  return function set(items) {
    dl.innerHTML = items
      .map(function (it) {
        return (
          '<div class="readout__item' +
          (it.hot ? ' is-hot' : '') +
          '"' +
          (it.color ? ' style="--c:' + it.color + '"' : '') +
          '><dt>' +
          it.k +
          '</dt><dd>' +
          it.v +
          '</dd></div>'
        );
      })
      .join('');
  };
}
