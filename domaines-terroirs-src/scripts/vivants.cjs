// Capture des personnages et animaux 3D : node scripts/vivants.cjs <url> <out.png> <région>
const { chromium } = require('playwright');
(async () => {
  const [url, out, region = 'nord'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click(`[data-testid=region-${region}]`);
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  await p.evaluate(() => {
    const g = window.__dt;
    for (let i = 0; i < 200; i++) g.sim.tick();
    const pen = g.sim.s.buildings.find((b) => b.type.startsWith('elevage') || b.type.startsWith('verger')) ?? g.sim.s.buildings[0];
    g.scene.centerOn(pen.x + 3, pen.y - 1, 1.7);
  });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out });
  await b.close();
})();
