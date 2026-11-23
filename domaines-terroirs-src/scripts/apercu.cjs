// Aperçu : capture centrée sur un point (node scripts/apercu.cjs <url> <région> <sortie> <dx> <dy> <zoom>)
const { chromium } = require('playwright');
(async () => {
  const [url, region = 'limousin', out = 'apercu.png', dx = '0', dy = '0', z = '1'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click(`[data-testid=region-${region}]`);
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  const info = await p.evaluate(([dx, dy, z]) => {
    const g = window.__dt, sim = g.sim, W = sim.s.world;
    const [cx, cy] = W.farm;
    const lot = W.parkingLot;
    for (let i = 0; i < 600; i++) sim.tick();
    const tx = dx === 'parking' ? lot[0] + 3 : cx + +dx, ty = dx === 'parking' ? lot[1] + 2 : cy + +dy;
    g.scene.centerOn(tx, ty, +z);
    return { lot, chemins: W.roads.filter((r) => !r.road).length, routes: W.roads.filter((r) => r.road).length };
  }, [dx, dy, z]);
  console.log(JSON.stringify(info));
  await p.waitForTimeout(3000);
  await p.screenshot({ path: out });
  await b.close();
})();
