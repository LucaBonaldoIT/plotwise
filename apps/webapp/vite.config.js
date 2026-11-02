import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import { designSystem } from '@lucabonaldo/design/vite';

var pages = ['index', 'univariate', 'bivariate', 'multivariate', 'about'];

export default defineConfig({
  base: './',
  plugins: [designSystem()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      input: Object.fromEntries(
        pages.map(function (p) {
          return [p, resolve(import.meta.dirname, p + '.html')];
        }),
      ),
    },
  },
});
