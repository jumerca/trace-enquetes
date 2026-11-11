const { chromium } = require('playwright');
(async () => {
  const OUT = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:4173/');
  await p.click('text=Match rapide');
  // attendre un panier de l'équipe recevante
  for (let i = 0; i < 40; i++) {
    await p.waitForTimeout(500);
    const ok = await p.evaluate(() => { const r = window.__brs.renderer; return r.homeCheer > 1.5; });
    if (ok) break;
  }
  await p.screenshot({ path: OUT + '/crowd.png' });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: OUT + '/tactics.png' });
  await p.click('[aria-label="Vue 2D ou 2,5D"]');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: OUT + '/view2d.png' });
  console.log('errors', errors);
  await b.close();
})();
