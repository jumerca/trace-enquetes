// Lance une partie, accélère, puis capture : node scripts/run.cjs <url> <out.png> <secondes à ×4> [zoom] [tx ty]
const { chromium } = require('playwright');
(async () => {
  const [url, out, secs = 10, zoom = 1, tx, ty] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 60000 });
  // simulation accélérée hors rendu pour atteindre l'état voulu
  await p.evaluate((n) => { for (let i = 0; i < n; i++) window.__dt.sim.tick(); }, Math.round(+secs * 60));
  await p.evaluate(([z, x, y]) => { const s = window.__dt.scene; if (x) s.centerOn(+x, +y, +z); else s.cam.z = +z; }, [zoom, tx, ty]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out });
  console.log(await p.evaluate(() => { const s = window.__dt.sim.s; return JSON.stringify({ t: s.minute, money: s.money, workers: s.workers.map((w) => w.label), vis: s.visitors.length, stats: s.stats }); }));
  await b.close();
})();
