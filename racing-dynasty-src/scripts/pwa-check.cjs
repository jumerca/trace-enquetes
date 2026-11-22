// Vérifie manifeste, service worker, fonctionnement hors ligne et conservation des sauvegardes (build servi sur localhost).
const { chromium } = require('playwright');
const BASE = process.env.BASE || 'http://localhost:4173/';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const p = await ctx.newPage();
  await p.goto(BASE);
  const manifest = await p.evaluate(async () => (await fetch(document.querySelector('link[rel=manifest]').href)).json());
  console.log('manifeste :', manifest.name, '·', manifest.icons.length, 'icônes ·', manifest.icons.filter((i) => i.purpose === 'maskable').length, 'masquables');
  await p.waitForFunction(() => navigator.serviceWorker.controller !== null || navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 });
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload();
  const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  console.log('service worker actif et contrôlant la page :', controlled);
  await p.evaluate(() => localStorage.setItem('racing-dynasty/save/0', JSON.stringify({ app: 'racing-dynasty', schema: 1, gameVersion: 'test', savedAt: new Date().toISOString(), career: { teams: [{ id: 'x', name: 'Test Hors Ligne' }], playerTeamId: 'x', season: 1, round: 0 } })));
  await ctx.setOffline(true);
  await p.reload();
  const title = await p.locator('.home-menu').count();
  const slot = await p.evaluate(() => !!localStorage.getItem('racing-dynasty/save/0'));
  console.log('hors ligne : écran d’accueil affiché =', title === 1, '· sauvegarde présente =', slot);
  await b.close();
  if (!controlled || title !== 1 || !slot) process.exit(1);
})();
