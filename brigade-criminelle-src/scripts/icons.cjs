// Génère les icônes PNG de la PWA à partir de public/icons/icon.svg (navigateur sans interface).
const { chromium } = require('playwright');
const fs = require('fs');
const svg = fs.readFileSync('public/icons/icon.svg', 'utf8');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const [name, size, pad] of [['icon-192.png', 192, 0], ['icon-512.png', 512, 0], ['icon-maskable-512.png', 512, 0.12], ['apple-touch-icon.png', 180, 0], ['favicon-32.png', 32, 0]]) {
    await p.setViewportSize({ width: size, height: size });
    const inner = Math.round(size * (1 - pad * 2));
    await p.setContent(`<html><body style="margin:0;background:#161d2b;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
    await p.screenshot({ path: `public/icons/${name}`, omitBackground: false });
  }
  await b.close();
})();
