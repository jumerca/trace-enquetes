// Vitrine : partie dans une région, nombreux bâtiments construits, captures (node scripts/vitrine.cjs <url> <région> <sortie> [hiver])
const { chromium } = require('playwright');
(async () => {
  const [url, region = 'limousin', out = 'vitrine.png', hiver] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click(`[data-testid=region-${region}]`);
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  const built = await p.evaluate(async ([hiver]) => {
    const g = window.__dt, sim = g.sim, A = window.__dtActions;
    sim.s.money = 1e7;
    sim.s.reputation = 90;
    const [cx, cy] = sim.s.world.farm;
    const done = [];
    for (const t of ['gite', 'auberge', 'accueil', 'silo', 'chambre_froide', 'garage_quad', 'garage_utilitaire', 'garage_bus', 'telescopique', 'solaire', 'irrigation', 'camping', 'pedagogique', 'elevage_chevaux', 'cidrerie', 'fromagerie', 'champ_tomates', 'elevage_lapins', 'elevage_truites']) {
      let ok = false;
      for (let r = 3; r < 26 && !ok; r++)
        for (let dy = -r; dy <= r && !ok; dy++)
          for (let dx = -r; dx <= r && !ok; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            for (const rot of [0, 1]) if (!ok && A.checkBuild(sim, t, cx + dx, cy + dy, rot).ok) { A.build(sim, t, cx + dx, cy + dy, rot); ok = true; }
          }
      if (ok) done.push(t);
    }
    if (hiver) { sim.s.minute += 14 * 1440; sim.s.weather = 'neige'; }
    sim.s.minute = Math.floor(sim.s.minute / 1440) * 1440 + 11 * 60;
    for (let i = 0; i < 240; i++) sim.tick();
    g.scene.syncWorld();
    g.scene.centerOn(cx + 3, cy + 2, 1.1);
    g.setSpeed(1);
    return done;
  }, [hiver]);
  console.log('construits :', built.join(', '));
  await p.waitForTimeout(4000);
  await p.screenshot({ path: out });
  await b.close();
})();
