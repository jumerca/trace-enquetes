// Vérifie la PWA : manifeste, service worker, fonctionnement hors ligne, détection d'une nouvelle version, sauvegardes conservées.
// Usage : node scripts/pwa.cjs [url]   (le serveur doit servir le build : npm run preview)
const { chromium } = require('playwright');
const fs = require('fs');
(async () => {
  const url = process.argv[2] || 'http://localhost:4173/';
  const res = [];
  const ok = (n, v, d = '') => { res.push({ n, v }); console.log(v ? '✔' : '✘', n, d); };
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ viewport: { width: 1024, height: 600 } });
  const p = await ctx.newPage();
  await p.goto(url);
  await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
  const man = await p.evaluate(async () => { const l = document.querySelector('link[rel=manifest]'); const r = await fetch(l.href); return r.json(); });
  ok('manifeste valide (nom, icônes 192/512, paysage)', man.name && man.icons.some((i) => i.sizes === '512x512') && man.orientation === 'landscape');
  await p.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 60000 });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
  ok('service worker actif', await p.evaluate(() => !!navigator.serviceWorker.controller));
  const cached = await p.evaluate(async () => { const keys = await caches.keys(); const c = await caches.open(keys.find((k) => k.startsWith('chemins-oublies-'))); return (await c.keys()).length; });
  ok('ressources en cache', cached > 5, `${cached} fichiers`);
  // une partie sauvegardée
  await p.click('[data-h=new]'); await p.waitForTimeout(300); await p.click('[data-a=new]'); await p.waitForTimeout(1500);
  await p.evaluate(() => { __co.S.flags.test_marque = true; __co.scene().save(); });
  // hors ligne
  await ctx.setOffline(true);
  await p.reload();
  await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 }).catch(() => {});
  ok('le jeu démarre hors ligne', await p.isVisible('[data-h=continue]'));
  await p.click('[data-h=continue]'); await p.waitForTimeout(1500);
  ok('partie reprise hors ligne', await p.evaluate(() => __co.S.flags.test_marque === true));
  await ctx.setOffline(false);
  // nouvelle version publiée : on modifie version.json et sw.js servis (simulation d'un déploiement)
  const dist = process.argv[3] || 'dist';
  const vj = JSON.parse(fs.readFileSync(`${dist}/version.json`, 'utf8'));
  const swTxt = fs.readFileSync(`${dist}/sw.js`, 'utf8');
  fs.writeFileSync(`${dist}/version.json`, JSON.stringify({ ...vj, build: 'TESTNEXT' }));
  fs.writeFileSync(`${dist}/sw.js`, swTxt.replace(/const BUILD = '[^']+'/, "const BUILD = '0.1.0-TESTNEXT'"));
  try {
    await p.click('.ib[data-p=menu]'); await p.click('.tab[data-t=options]'); await p.click('#upd');
    await p.waitForFunction(() => /Nouvelle version/.test(document.querySelector('#updmsg').textContent), null, { timeout: 30000 }).catch(() => {});
    const msg = await p.textContent('#updmsg');
    ok('« Rechercher les mises à jour » détecte la nouvelle version', /Nouvelle version/.test(msg), msg.slice(0, 80));
    await p.waitForFunction(() => __co.ui.swReg && __co.ui.swReg.waiting, null, { timeout: 30000 }).catch(() => {});
    ok('nouveau service worker prêt à être activé', await p.evaluate(() => !!(__co.ui.swReg && __co.ui.swReg.waiting)));
    await Promise.all([p.waitForNavigation({ timeout: 30000 }).catch(() => {}), p.click('#updmsg .btn')]);
    await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
    const swBuild = await p.evaluate(() => new Promise((r) => { navigator.serviceWorker.addEventListener('message', (e) => r(e.data.build)); navigator.serviceWorker.controller.postMessage('build'); setTimeout(() => r(null), 5000); }));
    ok('nouvelle version activée', swBuild === '0.1.0-TESTNEXT', String(swBuild));
    await p.click('[data-h=continue]'); await p.waitForTimeout(1500);
    ok('sauvegarde conservée après la mise à jour', await p.evaluate(() => __co.S.flags.test_marque === true));
  } finally {
    fs.writeFileSync(`${dist}/version.json`, JSON.stringify(vj, null, 1));
    fs.writeFileSync(`${dist}/sw.js`, swTxt);
  }
  await b.close();
  console.log(`${res.filter((r) => r.v).length}/${res.length}`);
})();
