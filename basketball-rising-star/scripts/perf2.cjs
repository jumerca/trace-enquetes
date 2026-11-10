const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3 });
  await p.goto('http://localhost:4173/');
  await p.click('text=Match rapide');
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => {
    const { engine, renderer: r } = window.__brs;
    const time = (f, n = 60) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(); return ((performance.now() - t0) / n).toFixed(3); };
    r.ctx.setTransform(r.dpr, 0, 0, r.dpr, 0, 0);
    return {
      dpr: r.dpr,
      crowd: time(() => r.drawCrowd()),
      court: time(() => { const c = r.buildCourt(); r.ctx.drawImage(c, r.px(-3), r.py(-3), c.width / r.dpr, c.height / r.dpr); }),
      players: time(() => { for (const pl of engine.players) if (pl.onCourt) r.drawPlayer(pl); }),
      bench: time(() => r.drawBenchPlayers()),
      hoops: time(() => { r.drawHoop(1, 'back'); r.drawHoop(1, 'front'); r.drawHoop(-1, 'back'); r.drawHoop(-1, 'front'); }),
      markers: time(() => r.drawMarkers()),
      total: time(() => r.render(1 / 60)),
    };
  });
  console.log(r);
  await b.close();
})();
