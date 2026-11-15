// Capture : node scripts/look.cjs <url> <out.png> <w> <h> [script js à exécuter après chargement] [attente ms]
const { chromium } = require('playwright');
(async () => {
  const [url, out, w = 1280, h = 720, js = '', wait = 2500] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.type(), m.text().slice(0, 300)); });
  p.on('pageerror', (e) => console.log('pageerror:', e.message, e.stack?.split('\n').slice(0, 4).join(' | ')));
  await p.goto(url);
  await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 60000 }).catch(() => console.log('boot timeout'));
  if (js) { try { const r = await p.evaluate(js); if (r !== undefined) console.log('eval:', JSON.stringify(r).slice(0, 2000)); } catch (e) { console.log('eval error', e.message); } }
  await p.waitForTimeout(+wait);
  await p.screenshot({ path: out });
  await b.close();
})();
