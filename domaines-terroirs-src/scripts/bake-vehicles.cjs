// Cuisson des véhicules 3D en planche de sprites : npm run bake:vehicules (serveur de dev lancé automatiquement)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
(async () => {
  const PORT = 5191;
  const srv = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  for (let i = 0; i < 80; i++) { try { if ((await fetch(`http://localhost:${PORT}/bake.html`)).ok) break; } catch {} await new Promise((r) => setTimeout(r, 250)); }
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('pageerror:', e.message));
  await p.goto(`http://localhost:${PORT}/bake.html`);
  await p.waitForFunction('window.baked', null, { timeout: 600000 });
  const { png, json } = await p.evaluate('window.baked');
  const out = path.join(__dirname, '../public/sprites');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'vehicules.png'), Buffer.from(png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(out, 'vehicules.json'), JSON.stringify(json));
  console.log(`vehicules.png ${json.width}×${json.height}, ${Object.keys(json.frames).length} images`);
  await b.close();
  srv.kill();
})();
