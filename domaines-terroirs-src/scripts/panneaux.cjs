// Captures des panneaux de gestion (node scripts/panneaux.cjs <url> <dossier>)
const { chromium } = require('playwright');
(async () => {
  const [url, dir = '.'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click('[data-testid=region-provence]');
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  await p.evaluate(() => { const g = window.__dt; for (let i = 0; i < 3 * 1440; i++) g.sim.tick(); g.notify(); });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${dir}/carte.png` });
  await p.click('[data-testid=onglet-commerce]');
  await p.click('[data-testid=sous-onglet-com]');
  await p.click('[data-testid=campagne-journal]');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${dir}/com.png` });
  await p.click('[data-testid=sous-onglet-marche]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}/marche.png` });
  await p.click('[data-testid=onglet-gestion]');
  await p.click('[data-testid=sous-onglet-calculs]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${dir}/calculs.png` });
  await b.close();
})();
