// Génère les icônes PNG à partir de l'emblème SVG (Chromium headless).
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const svg = fs.readFileSync(path.join(__dirname, '../public/icons/emblem.svg'), 'utf8');
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = [
    ['icon-192.png', 192, 0],
    ['icon-512.png', 512, 0],
    ['apple-touch-icon.png', 180, 0],
    ['favicon-32.png', 32, 0],
    ['icon-maskable-512.png', 512, 0.12],
  ];
  for (const [name, size, pad] of out) {
    const inner = Math.round(size * (1 - pad * 2));
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:${pad ? '#101827' : 'transparent'};display:grid;place-items:center;width:${size}px;height:${size}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</body></html>`);
    await p.screenshot({ path: path.join(__dirname, '../public/icons', name), omitBackground: !pad });
  }
  await b.close();
  console.log('icônes générées');
})();
