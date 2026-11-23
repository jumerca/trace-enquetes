// Captures des engins au travail : node scripts/engins.cjs <url> <dossier>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [url, dir] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click('[data-testid=region-beauce]');
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  const shot = async (name, until, zoom) => {
    const st = await p.evaluate(([until, zoom]) => {
      const g = window.__dt, sim = g.sim;
      g.setSpeed(0);
      for (let i = 0; i < 3000; i++) {
        sim.tick();
        const v = sim.s.vehicles.find((x) => x.kind === until && x.driver != null && x.path.length > 0);
        if (v && i > 20) break;
      }
      const v = sim.s.vehicles.find((x) => x.kind === until) ;
      g.scene.centerOn(Math.round(v.x), Math.round(v.y), zoom);
      g.setSpeed(1);
      return { v: v && { x: v.x, y: v.y, tool: v.tool, load: v.load }, labels: sim.s.workers.map((w) => w.label) };
    }, [until, zoom]);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(dir, name) });
    console.log(name, JSON.stringify(st));
  };
  await shot('engin-moissonneuse.png', 'moissonneuse', 1.6);
  await p.evaluate(() => { for (let i = 0; i < 200; i++) window.__dt.sim.tick(); });
  await shot('engin-tracteur.png', 'tracteur', 1.6);
  await b.close();
})();
