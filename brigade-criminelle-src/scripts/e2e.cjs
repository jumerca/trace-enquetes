// Parcours de bout en bout dans un vrai navigateur : création de carrière, vues, panneaux,
// attribution d'une affaire, entretien supervisé, tableau d'enquête, sauvegarde.
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:5199/';
const out = process.argv[3] || 'test-results';
const fs = require('fs');
fs.mkdirSync(out, { recursive: true });
(async () => {
  const b = await chromium.launch();
  const errors = [];
  const overflow = [];
  const run = async (vp, tag) => {
    const p = await b.newPage({ viewport: vp, deviceScaleFactor: 1, hasTouch: vp.width < 700 });
    // ouvre un menu : directement, ou via la grille « Menu » sur mobile
    const go = async (label) => {
      const btn = p.locator('nav.nav button', { hasText: label }).first();
      if (await btn.isVisible()) await btn.click();
      else { await p.locator('nav.nav .menu-btn').click(); await p.locator('.menu-grid button', { hasText: label }).first().click(); }
    };
    const tab = async (re) => {
      const t = p.getByRole('tab', { name: re });
      if (await t.isVisible()) return t.click();
      const sel = p.locator('select.tabs-select');
      const label = await sel.locator('option').evaluateAll((os, src) => os.map((o) => o.textContent).find((x) => new RegExp(src).test(x)), re.source);
      await sel.selectOption({ label });
    };
    // contrôle ergonomique : aucun défilement horizontal, ni dans le HUD, ni dans le panneau, ni dans la page
    const check = async (name) => {
      const r = await p.evaluate(() => {
        const bad = [];
        const chk = (el, n) => { if (el && el.scrollWidth > el.clientWidth + 2) bad.push(`${n} ${el.scrollWidth}>${el.clientWidth}`); };
        chk(document.querySelector('.hud'), 'hud'); chk(document.querySelector('.panel-body'), 'panel'); chk(document.scrollingElement, 'page');
        chk(document.querySelector('nav.nav'), 'nav');
        document.querySelectorAll('.tbl-wrap').forEach((t, i) => chk(t, 'tableau' + i));
        const nav = document.querySelector('nav.nav'); if (nav && nav.scrollHeight > nav.clientHeight + 2) bad.push('nav vertical');
        if (window.scrollY || window.scrollX) bad.push('page scrollée');
        return bad;
      });
      if (r.length) overflow.push(`${tag}/${name}: ${r.join(', ')}`);
    };
    p.on('pageerror', (e) => errors.push(`${tag}: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error') errors.push(`${tag} console: ${m.text()}`); });
    await p.goto(url);
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${out}/${tag}-01-titre.png` });
    await p.getByText('Nouvelle carrière').click();
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${tag}-02-creation.png`, fullPage: true });
    await p.getByText('Prendre ses fonctions').click();
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/${tag}-03-commissariat.png` });
    // avancer d'un jour pour voir arriver les affaires
    await p.getByTitle('Simuler la journée (jusqu\'au lendemain 8 h)').click();
    await p.waitForTimeout(1500);
    await check('commissariat');
    await go('Affaires');
    await check('affaires');
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${tag}-04-affaires.png` });
    await p.locator('table.t tbody tr.click').first().click();
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${tag}-05-dossier.png` });
    await check('dossier');
    // attribution suggérée
    const reprendre = p.getByRole('button', { name: 'Reprendre' });
    if (await reprendre.count()) { await reprendre.first().click(); await p.getByRole('button', { name: 'Valider l\'attribution' }).click(); }
    await tab(/Investigations/);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}/${tag}-06-investigations.png` });
    const mener = p.getByRole('button', { name: 'Mener l\'entretien' });
    if (await mener.count()) {
      await mener.first().click();
      await p.waitForTimeout(300);
      for (const a of ['Question ouverte', 'Écoute', 'Vérification chronologique', 'Demande de clarification']) { const bt = p.getByRole('button', { name: a }); if (await bt.count()) await bt.first().click(); await p.waitForTimeout(150); }
      await p.screenshot({ path: `${out}/${tag}-07-entretien.png` });
      await p.getByRole('button', { name: /Terminer|Clore/ }).first().click();
    }
    await tab(/Tableau d'enquête/);
    await p.waitForTimeout(400);
    await p.screenshot({ path: `${out}/${tag}-08-tableau.png` });
    await check('tableau');
    // accélérer quelques jours
    await p.getByRole('button', { name: '✕' }).first().click();
    for (let i = 0; i < 6; i++) { await p.getByTitle('Simuler la journée (jusqu\'au lendemain 8 h)').click(); await p.waitForTimeout(250); }
    await p.getByRole('button', { name: '×10' }).click();
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/${tag}-09-commissariat-actif.png` });
    for (const [nav, file] of [['Carte', '10-carte'], ['Enquêteurs', '11-personnel'], ['Planning', '12-planning'], ['Laboratoire', '13-labo'], ['Budget', '14-budget'], ['Statistiques', '15-stats'], ['Justice', '16-justice'], ['Recrutement', '17-recrutement'], ['Unités', '18-unites'], ['Médias', '19-medias'], ['Archives', '20-archives'], ['Carrière', '20b-carriere']]) {
      await go(nav);
      await p.waitForTimeout(nav === 'Carte' ? 2500 : 400);
      await p.screenshot({ path: `${out}/${tag}-${file}.png` });
      await check(nav);
    }
    await go('Commissariat');
    await go('Construction');
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/${tag}-21-construction.png` });
    await check('construction');
    await go('Options');
    await p.getByRole('button', { name: /Enregistrer : Emplacement 1/ }).click();
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}/${tag}-22-options.png` });
    await p.close();
  };
  await run({ width: 1366, height: 800 }, 'desktop');
  await run({ width: 412, height: 860 }, 'mobile');
  await run({ width: 360, height: 740 }, 'petit');
  await run({ width: 1024, height: 700 }, 'tablette');
  await b.close();
  console.log(errors.length ? 'ERREURS:\n' + errors.join('\n') : 'Aucune erreur JavaScript.');
  console.log(overflow.length ? 'DÉBORDEMENTS:\n' + overflow.join('\n') : 'Aucun défilement horizontal ni débordement de menu.');
  process.exit(errors.length || overflow.length ? 1 : 0);
})();
