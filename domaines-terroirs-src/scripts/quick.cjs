// Capture rapide : node scripts/quick.cjs <url> <out.png> <région> [attente ms] [zoom] [tx ty]
const { chromium } = require('playwright');
(async () => {
  const [url, out, region = 'limousin', wait = 2500, zoom, tx, ty] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 400)); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
  await p.goto(url);
  await p.click('[data-testid=nouvelle-partie]');
  await p.click(`[data-testid=region-${region}]`);
  await p.screenshot({ path: out.replace('.png', '-choix.png') });
  const t0 = Date.now();
  await p.click('[data-testid=commencer]');
  await p.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 120000 });
  console.log('chargement', Date.now() - t0, 'ms');
  if (zoom) await p.evaluate(([z, x, y]) => { const s = window.__dt.scene; if (x) s.centerOn(+x, +y, +z); else s.cam.z = +z; }, [zoom, tx, ty]);
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out });
  console.log(await p.evaluate(() => JSON.stringify({ fps: window.__dt.measuredFps(), cpu: window.__dt.cpuMs().toFixed(2), objs: window.__dt.scene.visibleObjects })));
  await b.close();
})();
