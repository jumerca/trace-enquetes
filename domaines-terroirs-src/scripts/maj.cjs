// Vérifie qu'une nouvelle publication remplace bien la version installée (service worker) : node scripts/maj.cjs
const { chromium } = require('playwright');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
(async () => {
  const PORT = 4180;
  const srv = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 2500));
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  const url = `http://localhost:${PORT}/`;
  await p.goto(url);
  await p.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  await p.waitForTimeout(1000);
  const first = await p.evaluate(() => performance.getEntriesByType('navigation').length);
  const v1 = await p.textContent('.version');
  // nouvelle publication : autre numéro de build
  const vj = path.join(root, 'dist/version.json');
  const sw = path.join(root, 'dist/sw.js');
  const meta = JSON.parse(fs.readFileSync(vj, 'utf8'));
  fs.writeFileSync(vj, JSON.stringify({ ...meta, build: 'nouvelle' }));
  fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(/domaines-terroirs-' \+ BUILD/, "domaines-terroirs-' + BUILD + '-n'").replace(/const BUILD = '([^']*)'/, "const BUILD = '$1-n'"));
  // l'utilisateur revient sur l'application : contrôle de version, nouveau service worker, rechargement
  let reloaded = false;
  p.on('load', () => (reloaded = true));
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await p.waitForTimeout(6000);
  const sw2 = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration()).active.scriptURL && (await (await fetch('./sw.js', { cache: 'no-store' })).text()).includes('-n'));
  console.log(JSON.stringify({ premiereVisiteSansRechargement: first === 1, avant: v1, nouveauServiceWorkerActif: sw2, pageRechargee: reloaded }));
  fs.writeFileSync(vj, JSON.stringify(meta));
  execSync('true');
  await b.close();
  srv.kill();
})();
