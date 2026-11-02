/**
 * KaTeX rendering. Formulas are written in the HTML as
 *   <span class="tex">x_i</span>            inline
 *   <div class="tex tex--block">…</div>      display
 * and rendered once on load; tex(el, src) renders into an element later (live values).
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';

var macros = {
  '\\xb': '\\bar{x}',
  '\\yb': '\\bar{y}',
  '\\bx': '\\mathbf{x}',
  '\\by': '\\mathbf{y}',
  '\\bz': '\\mathbf{z}',
};

export function tex(el, src, display) {
  try {
    katex.render(src, el, {
      displayMode: !!display,
      throwOnError: false,
      macros: macros,
      output: 'htmlAndMathml',
    });
  } catch (err) {
    el.textContent = src;
  }
}

export function renderMath(root) {
  (root || document).querySelectorAll('.tex').forEach(function (el) {
    if (el.dataset.rendered) return;
    el.dataset.rendered = '1';
    tex(el, el.textContent, el.classList.contains('tex--block'));
  });
}
