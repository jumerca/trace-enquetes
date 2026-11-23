// Génère les icônes PNG à partir de public/icons/icon.svg (Chromium/Playwright).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icons/icon.svg'), 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = (n) => path.join(__dirname, '../public/icons', n);
  const shots = [['favicon-32.png', 32, 0], ['apple-touch-icon.png', 180, 0], ['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12]];
  for (const [name, size, pad] of shots) {
    const radius = name.includes('maskable') || name.includes('apple') ? 0 : size * 0.18;
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${radius}px;overflow:hidden;background:#f0c98a;display:grid;place-items:center"><div style="width:${size * (1 - pad * 2)}px;height:${size * (1 - pad * 2)}px">${svg.replace('<svg ', '<svg width="100%" height="100%" ')}</div></div></body></html>`);
    await p.screenshot({ path: out(name), omitBackground: true });
  }
  await b.close();
  console.log('icônes générées');
})();
