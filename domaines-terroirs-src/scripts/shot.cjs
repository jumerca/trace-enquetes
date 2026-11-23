// Capture d'une page du serveur de dev : node scripts/shot.cjs <url> <sortie.png> [largeur] [hauteur]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1400, h = 1000] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.waitForFunction('window.ready === true', null, { timeout: 30000 }).catch(() => console.log('timeout ready'));
  await p.waitForTimeout(500);
  await p.screenshot({ path: out });
  await b.close();
})();
