// Mesure des pics : bascule de saison préparée en tâche de fond, construction, pas de simulation.
// node scripts/pics.cjs <url>
const { chromium } = require('playwright');
(async () => {
  const [url] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click('[data-testid=region-limousin]');
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  await p.waitForTimeout(1000);
  console.log(await p.evaluate(() => {
    const g = window.__dt, sc = g.scene, sim = g.sim;
    g.setSpeed(0);
    // dernier jour de la saison : préparation par tranches, comme en jeu (une tranche par image)
    sim.s.minute = 6 * 1440 + 600;
    let tranches = 0, pire = 0;
    while (!(sc.nextSeason && sc.nextSeason.uploaded)) {
      const t1 = performance.now();
      sc.update(16, 1);
      pire = Math.max(pire, performance.now() - t1);
      if (++tranches > 2000) break;
    }
    // passage à la saison suivante
    sim.s.minute = 7 * 1440 + 600;
    let t = performance.now();
    sc.update(16, 1);
    const bascule = performance.now() - t;
    t = performance.now();
    sc.update(16, 1);
    const apres = performance.now() - t;
    const saison = { 'image de bascule': Math.round(bascule), 'image suivante': Math.round(apres), tranches, 'pire image pendant la préparation': +pire.toFixed(1) };
    sim.s.money = 1e6;
    const [cx, cy] = sim.s.world.farm;
    let spot = null;
    for (let r = 4; r < 20 && !spot; r++) for (let dx = -r; dx <= r && !spot; dx++) if (window.__dtActions.checkBuild(sim, 'champ_ble', cx + dx, cy + r, 0).ok) spot = [cx + dx, cy + r];
    window.__dtActions.build(sim, 'champ_ble', spot[0], spot[1], 0);
    t = performance.now();
    sc.syncWorld();
    const construction = performance.now() - t;
    t = performance.now();
    for (let i = 0; i < 200; i++) sim.tick();
    return JSON.stringify({ saison, construction: Math.round(construction), '200 pas': Math.round(performance.now() - t) });
  }));
  await b.close();
})();
