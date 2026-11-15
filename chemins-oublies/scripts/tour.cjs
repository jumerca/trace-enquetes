// Visite rapide de plusieurs lieux (captures) : node scripts/tour.cjs <w> <h> <prefix> [quality]
const { chromium } = require('playwright');
(async () => {
  const [w = 1280, h = 720, prefix = '/tmp/claude-0/tour', q = 'haute'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('pageerror', (e) => console.log('pageerror:', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
  p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
  await p.addInitScript((q) => localStorage.setItem('chemins-oublies.settings', JSON.stringify({ quality: q, textSpeed: 'instantanee' })), q);
  await p.goto('http://localhost:5173/');
  await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 90000 });
  await p.click('[data-h=new]'); await p.waitForTimeout(300); await p.click('[data-a=new]');
  await p.waitForTimeout(1500);
  const skip = async () => { for (let i = 0; i < 12; i++) { const vis = await p.evaluate(() => !document.querySelector('#dialog').classList.contains('hidden')); if (!vis) break; await p.evaluate(() => document.querySelector('#dialog').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))); await p.waitForTimeout(80); } };
  await skip();
  const spots = [
    ['clairval', 1300, 1150, 13 * 60, 'place'], ['clairval', 2450, 1150, 10 * 60, 'pont'], ['clairval', 1300, 1000, 20.5 * 60, 'soir'],
    ['bois', 1200, 2100, 11 * 60, 'bois1'], ['bois', 1100, 800, 15 * 60, 'cercle'], ['bois', 1780, 1460, 15 * 60, 'camp'],
    ['moulin', 1250, 1000, 11 * 60, 'moulin'], ['auberge', 360, 420, 14 * 60, 'auberge'], ['atelier', 360, 420, 14 * 60, 'atelier'], ['archives', 360, 420, 14 * 60, 'archives'], ['moulin_int', 360, 420, 14 * 60, 'moulinint'],
  ];
  for (const [z, x, y, t, name] of spots) {
    await p.evaluate(([z, x, y, t]) => { const S = __co.S; S.clock = t; S.flags.theo_ok = true; __co.scene().loadZone(z, x, y, 'down'); }, [z, x, y, t]);
    await p.waitForTimeout(1600);
    await p.screenshot({ path: `${prefix}-${name}.png` });
  }
  const fps = await p.evaluate(() => __co.game.loop.actualFps);
  console.log('fps (swiftshader, indicatif):', fps.toFixed(1));
  await b.close();
})();
