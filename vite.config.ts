import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import pkg from './package.json' with { type: 'json' };

// Un seul build pour deux usages :
//  - GitHub Pages (https://mvtax.github.io/caisse/)
//  - servi tel quel par la passerelle de la caisse (http://192.168.1.122:8080/)
// La passerelle télécharge le index.html publié sur Pages : il doit donc être autonome
// (JS + CSS inline via vite-plugin-singlefile) et ne dépendre d'aucun chemin absolu.
// D'où base './' plutôt que '/caisse/' (voir docs/ARCHITECTURE.md).
export default defineConfig({
  base: './',
  plugins: [preact(), viteSingleFile()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
  },
  build: { target: 'safari15' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
