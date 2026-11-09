const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto('http://localhost:4173/');
  await p.click('text=Match rapide');
  await p.waitForTimeout(7000);
  await p.screenshot({ path: process.argv[2] + '/look-full.png' });
  await p.click('[aria-label="Caméra"]');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: process.argv[2] + '/look-follow.png' });
  await b.close();
})();
