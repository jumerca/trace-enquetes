const { chromium } = require('playwright');
(async () => {
  const [out, spots] = [process.argv[2], JSON.parse(process.argv[3])];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.addInitScript((q) => localStorage.setItem('chemins-oublies.settings', JSON.stringify({ textSpeed: 'instantanee', quality: q })), process.env.Q || 'moyenne');
  await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
  await p.click('[data-h=new]'); await p.waitForTimeout(300); await p.click('[data-a=new]'); await p.waitForTimeout(1500);
  for (let i = 0; i < 8; i++) { if (await p.isVisible('#dialog .db')) await p.click('#dialog .db'); await p.waitForTimeout(80); }
  let k = 0;
  for (const [z, x, y, zoom] of spots) {
    await p.evaluate(([z, x, y, zoom]) => { const g = __co.scene(); __co.S.clock = 11 * 60; g.loadZone(z, x, y, 'down'); if (zoom) { g.userZoom = zoom; g.applyZoom(); } }, [z, x, y, zoom]);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}-${k++}.png` });
  }
  await b.close();
})();
