// Exporte les icônes de l'application depuis lab/logo.html (serveur de dev lancé) : node scripts/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('http://localhost:5173/lab/logo.html');
  await p.waitForFunction(() => document.title === 'ready');
  const out = await p.evaluate(() => {
    const d = (s, m) => window.__icons.draw(s, m).toDataURL('image/png');
    return { 'icon-512.png': d(512, false), 'icon-192.png': d(192, false), 'icon-maskable-512.png': d(512, true), 'icon-maskable-192.png': d(192, true), 'apple-touch-icon.png': d(180, true), 'favicon-32.png': d(32, false) };
  });
  for (const [f, data] of Object.entries(out)) fs.writeFileSync('public/icons/' + f, Buffer.from(data.split(',')[1], 'base64'));
  await b.close();
})();
