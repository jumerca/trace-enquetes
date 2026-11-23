// Diagnostic des saccades : glissement continu de la caméra, processeur bridé.
// node scripts/saccades.cjs <url> [bridage=4] [région=montagne]
const { chromium } = require('playwright');
(async () => {
  const [url, rate = 4, region = 'montagne'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 412, height: 915 } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click(`[data-testid=region-${region}]`);
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  await p.waitForTimeout(1500);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: +rate });
  for (const z of [1, 0.6, 0.4]) {
    await p.evaluate((z) => { const g = window.__dt; g.setSpeed(2); const [x, y] = g.sim.s.world.farm; g.scene.centerOn(x, y, z); g.scene.prof = {}; g.cpuTimes.length = 0; }, z);
    await p.waitForTimeout(500);
    await p.evaluate(() => { window.__dt.scene.prof = {}; window.__dt.cpuTimes.length = 0; window.__frames = []; let last = performance.now(); const f = (t) => { window.__frames.push(t - last); last = t; if (window.__frames.length < 100000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
    // glissements au doigt : grands déplacements dans plusieurs directions
    await p.mouse.move(206, 450);
    for (const [dx, dy] of [[-1, -0.5], [1, -0.4], [0.6, 1], [-0.8, 0.7]]) {
      await p.mouse.down();
      for (let i = 0; i < 25; i++) await p.mouse.move(206 + dx * i * 12, 450 + dy * i * 12);
      await p.mouse.up();
      await p.mouse.move(206, 450);
    }
    await p.waitForTimeout(800);
    const r = await p.evaluate(() => {
      const prof = window.__dt.scene.prof;
      const out = {};
      for (const [k, a] of Object.entries(prof)) out[k] = { max: +Math.max(...a).toFixed(1), moy: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) };
      // coût JS total par image = mise à jour (cpuTimes) ; le rendu est mesuré à part
      const cpu = [...window.__dt.cpuTimes].sort((a, b) => b - a);
      const rendu = [...(prof.rendu ?? [])].sort((a, b) => b - a);
      const q = (a, p) => +a[Math.floor(a.length * p)].toFixed(1);
      return { prof: out, 'maj p50/p95/p99/max': [q(cpu, 0.5), q(cpu, 0.05), q(cpu, 0.01), +cpu[0].toFixed(1)], 'rendu p50/p95/p99/max': [q(rendu, 0.5), q(rendu, 0.05), q(rendu, 0.01), +rendu[0].toFixed(1)], 'images > 33 ms (maj + rendu)': cpu.filter((x, i) => x + (rendu[rendu.length - 1 - i] ?? 0) > 33).length, images: cpu.length };
    });
    console.log(`zoom ${z}`, JSON.stringify(r));
  }
  await b.close();
})();
