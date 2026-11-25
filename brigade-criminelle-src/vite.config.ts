import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import pkg from './package.json';

const BUILD = process.env.BUILD ?? new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// Génère sw.js (liste de précache) et version.json après le build.
function pwa(): Plugin {
  let outDir = 'dist';
  return {
    name: 'bct-pwa',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const files = walk(outDir)
        .map((p) => relative(outDir, p).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && f !== 'version.json' && !f.endsWith('.map') && f !== 'vercel.json');
      const sw = readFileSync('src/sw.tpl.js', 'utf8')
        .replace('__BUILD__', `${pkg.version}-${BUILD}`)
        .replace('__ASSETS__', JSON.stringify(['./', ...files.filter((f) => f !== 'index.html'), 'index.html']));
      writeFileSync(join(outDir, 'sw.js'), sw);
      writeFileSync(join(outDir, 'version.json'), JSON.stringify({ version: pkg.version, build: BUILD }, null, 1));
    },
  };
}

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __APP_BUILD__: JSON.stringify(BUILD) },
  plugins: [react(), pwa()],
  build: {
    outDir: 'dist', target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 1500, assetsInlineLimit: 0,
    rollupOptions: { output: { manualChunks: (id) => (id.includes('node_modules/react') || id.includes('node_modules/scheduler') ? 'react' : undefined) } },
  },
  test: { environment: 'node', globals: true, setupFiles: ['tests/setup.ts'], include: ['tests/**/*.test.ts'] },
});
