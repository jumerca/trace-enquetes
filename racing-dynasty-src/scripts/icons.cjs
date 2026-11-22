// Génère les icônes PWA : node scripts/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto('file://' + path.join(__dirname, 'icon.html'));
  await p.waitForFunction(() => document.title === 'ready');
  const out = await p.evaluate(() => {
    const d = (s, m) => window.drawIcon(s, m).toDataURL('image/png');
    return { 'icon-512.png': d(512, false), 'icon-192.png': d(192, false), 'icon-maskable-512.png': d(512, true), 'icon-maskable-192.png': d(192, true), 'apple-touch-icon.png': d(180, true), 'favicon-32.png': d(32, false) };
  });
  const dir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(dir, { recursive: true });
  for (const [f, data] of Object.entries(out)) fs.writeFileSync(path.join(dir, f), Buffer.from(data.split(',')[1], 'base64'));
  await b.close();
  console.log('icônes écrites dans public/icons');
})();
