const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1280, h = 800, wait = 2500] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.screenshot({ path: out.replace('.png', '-menu.png') });
  await p.click('[data-testid=nouvelle-partie]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 60000 });
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out });
  console.log('fps', await p.evaluate('window.__dt.measuredFps()'));
  await b.close();
})();
