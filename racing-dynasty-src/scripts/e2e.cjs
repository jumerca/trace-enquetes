// Parcours complet dans un vrai navigateur (Chromium headless) sur le build de production.
// Lancer d'abord : npm run build && npx vite preview --port 4173   puis : node scripts/e2e.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE || 'http://localhost:4173/';
const OUT = process.env.OUT || path.join(__dirname, '..', 'e2e-shots');
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('•', ...a);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  async function run(name, viewport, opts = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
    await ctx.addInitScript(() => { try { localStorage.setItem('racing-dynasty/settings', JSON.stringify({ quality: 'haute', fpsCap: 60, showFps: true, names: true, sound: false })); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`[${name}] ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`); });
    const shot = (n) => p.screenshot({ path: path.join(OUT, `${name}-${n}.png`) });
    await p.goto(BASE);
    await p.getByText('Nouvelle carrière').click();
    await p.getByPlaceholder('ex. Dynastie Racing').fill('Écurie Horizon');
    await p.getByPlaceholder('DYN', { exact: true }).fill('HZN');
    await p.getByPlaceholder('Votre nom').fill('J. Mercier');
    await shot('01-creation');
    await p.getByText('Continuer →').click();
    await p.getByText('Difficile').click();
    await p.getByText('Courte · 6 tours').click();
    await p.getByText('Continuer →').click();
    await p.getByText('Fonder l’écurie').click();
    await p.waitForSelector('.hubhead');
    await shot('02-qg');
    // Recrutement de deux pilotes
    await p.locator('.tabs button', { hasText: 'Pilotes' }).click();
    for (let k = 0; k < 2; k++) {
      await p.locator('.driver-card button', { hasText: 'Négocier' }).nth(k === 0 ? 1 : 2).click();
      await p.getByText('Proposer le contrat').click();
      await p.waitForTimeout(150);
      if (await p.locator('.modal').count()) { log('refus :', await p.locator('.modal .warn').textContent()); await p.locator('.modal input[type=range]').evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, el.max); el.dispatchEvent(new Event('input', { bubbles: true })); }); await p.getByText('Proposer le contrat').click(); }
    }
    await shot('03-pilotes');
    // Sponsor
    await p.locator('.tabs button', { hasText: 'Sponsors' }).click();
    await p.locator('.sponsor button', { hasText: 'Négocier' }).first().click();
    await p.locator('.modal input[type=range]').evaluate((el) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, '1.05'); el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.locator('.modal .chip', { hasText: '2 saisons' }).click();
    await shot('04a-negociation');
    await p.getByText('Faire l’offre').click();
    if (await p.locator('.modal').count()) { log('sponsor refuse :', await p.locator('.modal .warn').textContent()); await p.locator('.modal button[aria-label=Fermer]').click(); await p.locator('.sponsor button', { hasText: 'Négocier' }).first().click(); await p.getByText('Faire l’offre').click(); }
    await shot('04-sponsors');
    // Académie : signer un espoir
    await p.locator('.tabs button', { hasText: 'Pilotes' }).click();
    await p.locator('.seg button', { hasText: 'Espoirs' }).click();
    await p.locator('.driver-card button', { hasText: 'Signer' }).first().click();
    await shot('04b-academie');
    // Usine : lancer un projet de R&D
    await p.locator('.tabs button', { hasText: 'Usine' }).click();
    await p.locator('.rnd button', { hasText: 'Lancer' }).first().click();
    // Installations : agrandir le simulateur (confirmation)
    p.once('dialog', (d) => d.accept());
    await p.locator('.facility', { hasText: 'Simulateur' }).locator('button').click();
    await p.waitForSelector('.building');
    log(name, 'chantier d’installation lancé :', (await p.locator('.building').textContent()).trim());
    await shot('04c-usine');
    await p.locator('.tabs button', { hasText: 'QG' }).click();
    const budget = await p.locator('.budget b').textContent();
    log(name, 'budget après recrutement', budget);
    await p.getByText('Aller au week-end de course').click();
    // Essais
    await p.locator('.setup input[type=range]').first().fill('70');
    await p.locator('button', { hasText: 'Lancer un relais' }).first().click();
    await p.locator('button', { hasText: 'Lancer un relais' }).nth(1).click();
    await shot('05-essais');
    await p.getByText('Passer aux qualifications').click();
    await p.getByText('Lancer les qualifications').click();
    await p.waitForTimeout(4000);
    await shot('05b-qualifs-direct');
    await p.getByRole('button', { name: 'Fin ⏭' }).click();
    await shot('05c-qualifs-fin');
    await p.getByText('Voir la grille et la stratégie').click();
    await p.waitForTimeout(2500);
    await shot('06-grille-strategie');
    await p.getByText('Départ du Grand Prix').click();
    await p.waitForSelector('.race-canvas canvas', { timeout: 15000 });
    await p.waitForTimeout(2500);
    await shot('07a-formation');
    await p.getByRole('button', { name: 'Passer ⏭' }).click();
    await p.waitForTimeout(2500);
    await shot('07-depart');
    await p.locator('.sim-controls button', { hasText: '×4' }).click();
    await p.waitForTimeout(6000);
    await shot('08-course-x4');
    const rb = p.locator('.replay-btn');
    if (await rb.count()) {
      await rb.first().click({ force: true });
      await p.waitForTimeout(2500);
      await shot('08d-ralenti');
      log(name, 'ralenti lancé :', (await p.locator('.sc-banner.replay').count()) > 0);
      await p.getByRole('button', { name: 'Direct' }).click().catch(() => {});
    } else log(name, 'pas d’action à revoir à cet instant');
    // consigne joueur
    await p.locator('.dc .seg button', { hasText: 'Attaque' }).first().click();
    await p.locator('.sim-controls button', { hasText: 'TV' }).click();
    await p.waitForTimeout(2500);
    await shot('08b-camera-tv');
    await p.locator('.sim-controls button', { hasText: 'Cockpit' }).click();
    await p.waitForTimeout(2500);
    await shot('08b2-cockpit');
    if (!(await p.locator('.cockpit-canvas').isVisible())) errors.push('vue cockpit non affichée');
    await p.locator('.sim-controls button', { hasText: 'Bord' }).click();
    await p.waitForTimeout(2500);
    await shot('08b3-bord-de-piste');
    await p.locator('.sim-controls button', { hasText: 'Hélico' }).click();
    await p.waitForTimeout(2000);
    await shot('08b4-helico');
    if (await p.locator('.cockpit-canvas').isVisible()) errors.push('vue pseudo-3D restée affichée en vue hélico');
    // Voiture de sécurité + averse forcées (accès de test) pour contrôler le rendu et l'interface.
    await p.evaluate(() => {
      const sim = window.__raceSim;
      const leader = sim.cars.reduce((a, b) => (b.s > a.s ? b : a));
      sim.deploySafetyCar(leader, 'test');
      sim.raining = true;
    });
    await p.locator('.sim-controls button', { hasText: 'Suivre' }).click();
    await p.waitForTimeout(9000);
    await shot('08c-securite-pluie');
    const scBanner = await p.locator('.sc-banner').count();
    log(name, 'bandeau voiture de sécurité affiché :', scBanner > 0);
    if (!scBanner) errors.push('bandeau voiture de sécurité absent');
    await p.locator('.sim-controls button', { hasText: 'Circuit' }).click();
    await p.waitForTimeout(1500);
    await shot('09-vue-circuit');
    const fpsTxt = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res((n / 2).toFixed(0)); }; requestAnimationFrame(f); }));
    log(name, 'images/s mesurées (Chromium headless, logiciel) :', fpsTxt);
    // Quitter vers le QG pendant la course puis reprendre (sauvegarde en course)
    await p.locator('.race-top button', { hasText: 'QG' }).click();
    await p.waitForSelector('.hubhead');
    await p.reload();
    await p.getByText('Continuer').first().click();
    await p.waitForSelector('.race-canvas canvas', { timeout: 15000 });
    log(name, 'reprise de course après rechargement : OK');
    p.on('dialog', (d) => d.accept());
    await p.getByRole('button', { name: 'Fin directe' }).click();
    await p.waitForSelector('.podium-overlay', { timeout: 60000 });
    await p.waitForTimeout(1500);
    await shot('10-arrivee');
    await p.getByText('Voir les résultats').click();
    await p.waitForSelector('text=Bilan de');
    await shot('11-resultats');
    if (!(await p.locator('.conference').count())) errors.push('conférence de presse absente');
    else {
      await p.locator('.conference .answers button').first().click();
      log(name, 'conférence de presse : réponse donnée —', (await p.locator('.conference .answers button.primary small').textContent()).trim());
    }
    if (!(await p.locator('.gazette').count())) errors.push('article de presse absent des résultats');
    else log(name, 'article de presse :', (await p.locator('.gazette h3').first().textContent()).trim());
    const myRows = await p.locator('.table tr.me').allTextContents();
    log(name, 'résultats joueur :', myRows.join(' | '));
    await p.getByText('Retour au QG').click();
    await shot('11b-qg-directeur');
    await p.locator('.tabs button', { hasText: 'Presse' }).click();
    await shot('11c-presse');
    await p.locator('.tabs button', { hasText: 'Classements' }).click();
    await shot('12-classements');
    const leader = await p.locator('.table tbody tr').first().textContent();
    // Rechargement : la saison doit être conservée
    await p.reload();
    await p.getByText('Continuer').first().click();
    await p.locator('.tabs button', { hasText: 'Classements' }).click();
    const leader2 = await p.locator('.table tbody tr').first().textContent();
    log(name, 'classement conservé après rechargement :', leader === leader2, '—', leader2);
    if (leader !== leader2) errors.push('classement perdu après rechargement');
    if (name === 'pc') {
      // Fin de saison : Grands Prix 2 et 3 (Valbrune, Kharam)
      for (const gp of ['lac-argent', 'brumevent', 'valbrune', 'montclair', 'rocheval', 'lumen', 'kharam']) {
        await p.locator('.tabs button', { hasText: 'QG' }).click();
        await p.getByText('Aller au week-end de course').click();
        await p.getByText('Passer aux qualifications').click();
        await p.getByText('Lancer les qualifications').click(); await p.getByRole('button', { name: 'Fin ⏭' }).click(); await p.getByText('Voir la grille et la stratégie').click();
        await p.getByText('Départ du Grand Prix').click();
        await p.waitForSelector('.race-canvas canvas', { timeout: 15000 });
        await p.waitForTimeout(1500);
        await p.getByRole('button', { name: 'Passer ⏭' }).click();
        await p.waitForTimeout(2500);
        await shot('13-depart-' + gp);
        await p.locator('.sim-controls button', { hasText: '×4' }).click();
        await p.waitForTimeout(5000);
        await shot('14-course-' + gp);
        await p.locator('.sim-controls button', { hasText: 'TV' }).click();
        await p.waitForTimeout(3000);
        await shot('14b-tv-' + gp);
        await p.getByRole('button', { name: 'Fin directe' }).click();
        await p.waitForSelector('.podium-overlay', { timeout: 60000 });
        await p.getByText('Voir les résultats').click();
        await p.getByText('Retour au QG').click();
      }
      await p.waitForSelector('text=Saison 1 terminée');
      await shot('15-fin-saison');
      await p.locator('.tabs button', { hasText: 'Palmarès' }).click();
      await shot('16-palmares');
      await p.locator('.tabs button', { hasText: 'QG' }).click();
      await p.getByText('Lancer la saison 2').click();
      await p.locator('.tabs button', { hasText: 'Pilotes' }).click();
      await shot('17-saison2-pilotes');
      log(name, 'saison complète (8 GP) jouée, saison 2 lancée');
    }
    await ctx.close();
  }
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const want = (n) => !only || only.includes(n);
  if (want('pc')) await run('pc', { width: 1366, height: 768 });
  if (want('android-paysage')) await run('android-paysage', { width: 800, height: 360 }, { isMobile: true, hasTouch: true });
  if (want('android-portrait')) await run('android-portrait', { width: 360, height: 740 }, { isMobile: true, hasTouch: true });
  if (want('tablette')) await run('tablette', { width: 1024, height: 768 }, { isMobile: true, hasTouch: true });
  await browser.close();
  if (errors.length) { console.log('ERREURS :\n' + errors.join('\n')); process.exit(1); }
  console.log('E2E OK — captures dans', OUT);
})();
