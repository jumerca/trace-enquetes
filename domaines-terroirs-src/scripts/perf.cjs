// Mesure du coût JS par image avec processeur bridé (approximation d'un téléphone modeste).
// node scripts/perf.cjs <url> [taux de bridage=4]
const { chromium } = require('playwright');
(async () => {
  const [url, rate = 4] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  const rows = [];
  for (const region of ['est', 'montagne', 'limousin']) {
    await p.goto(url);
    await p.click('[data-testid=nouvelle-partie]');
    await p.click(`[data-testid=region-${region}]`);
    await p.click('[data-testid=commencer]');
    await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: +rate });
    for (const z of [1, 0.6, 0.35]) {
      await p.evaluate((z) => { const g = window.__dt; g.setSpeed(4); const [x, y] = g.sim.s.world.farm; g.scene.centerOn(x + 30, y - 20, z); g.cpuTimes.length = 0; }, z);
      await p.waitForTimeout(4000);
      const r = await p.evaluate(() => ({ cpu: +window.__dt.cpuMs().toFixed(2), max: +Math.max(...window.__dt.cpuTimes).toFixed(1), objs: window.__dt.scene.visibleObjects, children: window.__dt.scene.objects.children.length }));
      rows.push({ region, z, ...r });
      console.log(JSON.stringify({ region, z, ...r }));
    }
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  }
  await b.close();
})();
