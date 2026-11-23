// Capture d'un domaine développé (diagnostic visuel) : node scripts/showcase.cjs <url> <dossier>
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const [url, dir] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 60000 });
  console.log(await p.evaluate(() => {
    const g = window.__dt, A = window.__dtActions, sim = g.sim;
    sim.s.money = 90000;
    const r = [A.build(sim, 'enclos', 48, 50, 0), A.build(sim, 'champ', 48, 55, 0), A.build(sim, 'hangar', 57, 37, 1), A.build(sim, 'fromagerie', 58, 42, 1), A.build(sim, 'boulangerie', 51, 38, 0), A.build(sim, 'accueil', 58, 46, 0)];
    const champ = sim.s.buildings.find((b) => b.type === 'champ');
    champ.growth = 1; champ.ready = 130;
    sim.hire('eleveur'); sim.hire('vendeur');
    for (let i = 0; i < 240; i++) sim.tick();
    g.setSpeed(1);
    return r.map((x) => !!x).join(',');
  }));
  await p.evaluate('window.__dt.scene.centerOn(50, 47, 1)');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(dir, 'vitrine-ete.jpg'), quality: 85 });
  await p.evaluate('window.__dt.scene.centerOn(51, 52, 1.6)');
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(dir, 'vitrine-zoom.jpg'), quality: 85 });
  // automne puis hiver (avance de 7 puis 14 jours)
  await p.evaluate('window.__dt.setSpeed(0); for (let i = 0; i < 7 * 1440; i++) window.__dt.sim.tick(); window.__dt.sim.s.minute += (11*60 - window.__dt.sim.s.minute % 1440 + 1440) % 1440; window.__dt.scene.centerOn(50, 47, 1)');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(dir, 'vitrine-automne.jpg'), quality: 85 });
  await p.evaluate('for (let i = 0; i < 7 * 1440; i++) window.__dt.sim.tick(); window.__dt.sim.s.minute += (11*60 - window.__dt.sim.s.minute % 1440 + 1440) % 1440');
  await p.waitForTimeout(2500);
  await p.screenshot({ path: path.join(dir, 'vitrine-hiver.jpg'), quality: 85 });
  console.log(await p.evaluate('JSON.stringify(window.__dt.sim.s.stats)'), await p.evaluate('window.__dt.sim.s.money'));
  await b.close();
})();
