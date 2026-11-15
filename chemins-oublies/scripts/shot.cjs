// Capture d'écran d'une page du serveur de dev : node scripts/shot.cjs <url> <sortie.png> [largeur] [hauteur]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1400, h = 900] = process.argv.slice(2);
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(url);
  await p.waitForFunction(() => document.title === 'ready', null, { timeout: 30000 }).catch(() => console.log('timeout'));
  await p.screenshot({ path: out, fullPage: true });
  await b.close();
})();
