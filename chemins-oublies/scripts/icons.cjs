// Génère les icônes PNG de l'application (atlas + boussole sur fond de vallée) : node scripts/icons.cjs
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const out = await p.evaluate(() => {
    const draw = (size, maskable) => {
      const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d');
      const k = size / 512; x.scale(k, k);
      const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#f2c27a'); g.addColorStop(0.55, '#e59a5a'); g.addColorStop(0.56, '#6f9f48'); g.addColorStop(1, '#3f6b3a');
      x.fillStyle = g; if (maskable) x.fillRect(0, 0, 512, 512); else { x.beginPath(); x.roundRect(16, 16, 480, 480, 100); x.fill(); }
      // collines et chemin
      x.fillStyle = '#5a8a40'; x.beginPath(); x.moveTo(0, 300); x.quadraticCurveTo(140, 230, 260, 290); x.quadraticCurveTo(380, 240, 512, 300); x.lineTo(512, 512); x.lineTo(0, 512); x.fill();
      x.strokeStyle = '#e7cf9a'; x.lineWidth = 40; x.lineCap = 'round'; x.setLineDash([2, 0]); x.beginPath(); x.moveTo(140, 520); x.quadraticCurveTo(250, 400, 330, 330); x.stroke();
      x.setLineDash([16, 22]); x.strokeStyle = '#ffe6a0'; x.lineWidth = 10; x.beginPath(); x.moveTo(330, 330); x.quadraticCurveTo(380, 280, 420, 250); x.stroke(); x.setLineDash([]);
      // atlas
      x.save(); x.translate(256, 250); x.rotate(-0.12);
      x.fillStyle = '#7a3f2a'; x.strokeStyle = '#2b1e16'; x.lineWidth = 12; x.beginPath(); x.roundRect(-120, -140, 240, 290, 22); x.fill(); x.stroke();
      x.fillStyle = '#9a5a3a'; x.fillRect(-114, -134, 228, 34);
      x.beginPath(); x.arc(0, 10, 70, 0, Math.PI * 2); x.fillStyle = '#e0b85c'; x.fill(); x.stroke();
      x.beginPath(); x.arc(0, 10, 50, 0, Math.PI * 2); x.fillStyle = '#f7ecd0'; x.fill(); x.lineWidth = 6; x.stroke();
      x.fillStyle = '#c0523a'; x.beginPath(); x.moveTo(0, -36); x.lineTo(14, 10); x.lineTo(0, 56); x.lineTo(-14, 10); x.closePath(); x.fill(); x.lineWidth = 4; x.stroke();
      x.restore();
      if (!maskable) { x.strokeStyle = '#2b1e16'; x.lineWidth = 14; x.beginPath(); x.roundRect(16, 16, 480, 480, 100); x.stroke(); }
      return c.toDataURL('image/png');
    };
    return { i512: draw(512, false), i192: draw(192, false), m512: draw(512, true), m192: draw(192, true), a180: draw(180, true), f32: draw(32, false) };
  });
  const w = (f, d) => fs.writeFileSync('public/icons/' + f, Buffer.from(d.split(',')[1], 'base64'));
  w('icon-512.png', out.i512); w('icon-192.png', out.i192); w('icon-maskable-512.png', out.m512); w('icon-maskable-192.png', out.m192); w('apple-touch-icon.png', out.a180); w('favicon-32.png', out.f32);
  await b.close();
})();
