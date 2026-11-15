import { defineConfig, type Plugin } from 'vite';
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

// Génère sw.js (liste de précache datée) et version.json après le build.
function pwa(): Plugin {
  let outDir = 'dist';
  return {
    name: 'co-pwa',
    apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = walk(outDir)
        .map((p) => relative(outDir, p).split('\\').join('/'))
        .filter((f) => f !== 'sw.js' && f !== 'version.json' && !f.endsWith('.map'));
      const tpl = readFileSync('src/sw.tpl.js', 'utf8');
      const sw = tpl
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
  plugins: [pwa()],
  build: { outDir: 'dist', target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 2000, assetsInlineLimit: 0 },
  test: { environment: 'node', globals: true, include: ['tests/**/*.test.ts'] },
});
