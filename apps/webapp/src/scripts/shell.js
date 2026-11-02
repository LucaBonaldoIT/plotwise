/**
 * Shared page shell: design system, theme, entrance reveals, formulas, the reading-progress
 * rule under the header and the "you are here" marker in the in-page table of contents.
 */
import '@lucabonaldo/design/fonts.css';
import '@lucabonaldo/design/index.css';
import '../styles/app.css';
import '../styles/controls.css';
import { initTheme, initReveal } from '@lucabonaldo/design';
import { renderMath } from '../lib/math.js';

function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

function progress() {
  var bar = document.querySelector('.progress__bar');
  if (!bar) return;
  var ticking = false;
  function update() {
    ticking = false;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
  }
  window.addEventListener(
    'scroll',
    function () {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

function toc() {
  var links = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  if (!links.length) return;
  var map = new Map();
  links.forEach(function (a) {
    var s = document.getElementById(a.getAttribute('href').slice(1));
    if (s) map.set(s, a);
  });
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (l) {
            l.removeAttribute('aria-current');
          });
          var a = map.get(e.target);
          a.setAttribute('aria-current', 'true');
          // keep the active chip visible in the horizontal mobile strip
          var strip = a.closest('.toc__list');
          if (strip && strip.scrollWidth > strip.clientWidth) {
            strip.scrollTo({
              left: a.offsetLeft - strip.clientWidth / 2 + a.clientWidth / 2,
              behavior: 'smooth',
            });
          }
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  map.forEach(function (_, s) {
    io.observe(s);
  });
}

/**
 * The quest log in a chapter opener: one objective per table-of-contents entry, ticked once the
 * section has been on screen. Progress is remembered per chapter in this browser only.
 */
function quest() {
  var box = document.querySelector('.quest');
  if (!box) return;
  var list = box.querySelector('ol');
  var count = box.querySelector('.quest__count');
  var key = 'vd-quest-' + (document.body.dataset.chapter || location.pathname);
  var done = new Set();
  try {
    JSON.parse(localStorage.getItem(key) || '[]').forEach(function (id) {
      done.add(id);
    });
  } catch (err) {
    done = new Set();
  }
  var links = Array.from(document.querySelectorAll('.toc a[href^="#"]'));
  var items = links.map(function (a) {
    var li = document.createElement('li');
    var link = document.createElement('a');
    link.href = a.getAttribute('href');
    link.textContent = a.textContent.replace(/^[\d.→]+\s*/, '');
    li.append(link);
    list.append(li);
    return { id: a.getAttribute('href').slice(1), li: li };
  });
  function paint() {
    items.forEach(function (it) {
      it.li.classList.toggle('is-done', done.has(it.id));
    });
    count.textContent = done.size + ' / ' + items.length;
  }
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          done.add(e.target.id);
          io.unobserve(e.target);
        }
      });
      paint();
      try {
        localStorage.setItem(key, JSON.stringify(Array.from(done)));
      } catch (err) {
        /* progress just won't persist */
      }
    },
    { rootMargin: '0px 0px -60% 0px' },
  );
  items.forEach(function (it) {
    var s = document.getElementById(it.id);
    if (s && !done.has(it.id)) io.observe(s);
  });
  paint();
}

export function shell() {
  onReady(function () {
    initTheme();
    renderMath();
    initReveal();
    progress();
    toc();
    quest();
  });
}

export { onReady };
