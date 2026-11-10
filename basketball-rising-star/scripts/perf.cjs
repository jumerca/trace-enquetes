const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  for (const vp of [{ width: 1280, height: 720, deviceScaleFactor: 1 }, { width: 844, height: 390, deviceScaleFactor: 3 }]) {
    const p = await b.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
    await p.goto('http://localhost:4173/');
    await p.click('text=Match rapide');
    await p.waitForTimeout(2500);
    const r = await p.evaluate(async () => {
      const { engine, renderer } = window.__brs;
      // coût simulation
      let t0 = performance.now(); for (let i = 0; i < 600; i++) engine.step(); const sim = (performance.now() - t0) / 600;
      t0 = performance.now(); for (let i = 0; i < 60; i++) renderer.render(1 / 60); const ren = (performance.now() - t0) / 60;
      // fréquence réelle
      const frames = []; let last = performance.now();
      await new Promise((res) => { let n = 0; const f = (t) => { frames.push(t - last); last = t; if (++n < 120) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
      frames.sort((a, b) => a - b);
      return { simMsPerTick: sim.toFixed(3), renderMs: ren.toFixed(2), medianFrame: frames[60].toFixed(1), p95Frame: frames[114].toFixed(1) };
    });
    console.log(vp.width, r);
  }
  await b.close();
})();
