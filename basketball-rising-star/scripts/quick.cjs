const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:4173/');
  await p.click('text=Match rapide');
  await p.waitForTimeout(2500);
  const st = () => p.evaluate(() => { const e = window.__brs.engine; const u = e.players[e.userIdx]; return { t: e.time.toFixed(1), q: e.quarter, clock: e.clock.toFixed(0), score: e.teams[0].score + '-' + e.teams[1].score, poss: e.possession, phase: e.phase, holder: e.ball.holder, user: e.userIdx, onCourt: u.onCourt, upos: [u.pos.x.toFixed(1), u.pos.y.toFixed(1)], uanim: u.anim, box: u.box }; });
  console.log(await st());
  // Déplacement clavier
  await p.keyboard.down('KeyD'); await p.waitForTimeout(700); await p.keyboard.up('KeyD');
  console.log('after move right', await st());
  await p.keyboard.down('KeyS'); await p.waitForTimeout(500); await p.keyboard.up('KeyS');
  console.log('after move down', await st());
  await p.screenshot({ path: OUT + '/10-quick.png' });
  // Attendre d'avoir le ballon puis tirer
  for (let i = 0; i < 40; i++) {
    const s = await st();
    if (s.holder === s.user && s.phase === 'live') { console.log('user has ball at', s.t);
      await p.keyboard.down('Space'); await p.waitForTimeout(450); await p.screenshot({ path: OUT + '/11-shoot.png' }); await p.keyboard.up('Space'); await p.waitForTimeout(1500); console.log('after shot', await st()); break; }
    await p.waitForTimeout(500);
  }
  await p.screenshot({ path: OUT + '/12-quick.png' });
  // Mobile paysage
  const m = await b.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  await m.goto('http://localhost:4173/');
  await m.screenshot({ path: OUT + '/13-mobile-home-land.png' });
  await m.click('text=Match rapide');
  await m.waitForTimeout(3000);
  await m.screenshot({ path: OUT + '/14-mobile-match.png' });
  const m2 = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await m2.goto('http://localhost:4173/');
  await m2.screenshot({ path: OUT + '/15-mobile-home.png' });
  console.log('errors', errors);
  await b.close();
})();
