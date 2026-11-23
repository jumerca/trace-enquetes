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
  const sets = process.argv.slice(2).length ? process.argv.slice(2) : ['vehicules', 'vivants'];
  const list = sets.flatMap((s) => (s === 'batiments' ? ['limousin', 'nord', 'beauce', 'est', 'sudouest', 'montagne', 'mer', 'provence'].map((r) => 'batiments:' + r) : [s]));
  for (const item of list) {
    const [kind, region] = item.split(':');
    const set = region ? `${kind}-${region}` : kind;
    await p.goto(`http://localhost:${PORT}/bake.html?set=${kind}${region ? '&region=' + region : ''}`, { waitUntil: 'commit' });
    await p.waitForFunction('window.baked', null, { timeout: 900000 });
    const { pngs, json, ext } = await p.evaluate('window.baked');
    const out = path.join(__dirname, '../public/sprites');
    fs.mkdirSync(out, { recursive: true });
    for (const f of fs.readdirSync(out)) if (f.startsWith(set + '-') || f === set + '.json') fs.unlinkSync(path.join(out, f));
    pngs.forEach((png, i) => fs.writeFileSync(path.join(out, `${set}-${i}.${ext}`), Buffer.from(png.split(',')[1], 'base64')));
    fs.writeFileSync(path.join(out, `${set}.json`), JSON.stringify(json));
    console.log(`${set} : ${pngs.length} planche(s), ${Object.keys(json.frames).length} images`);
  }
  await b.close();
  srv.kill();
})();
