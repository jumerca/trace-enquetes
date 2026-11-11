// Parcours essentiels dans un vrai navigateur (Chromium headless).
const { chromium } = require('playwright');
const assert = (c, m) => { if (!c) { throw new Error('ÉCHEC : ' + m); } else console.log('✓ ' + m); };
const URL = process.env.URL || 'http://localhost:4173/';
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(URL);
  assert(await p.isVisible('text=Nouvelle carrière'), 'accueil affiché');
  await p.click('text=Nouvelle carrière');
  await p.click('text=Continuer →');
  assert(await p.isVisible('text=Indiquez un prénom'), 'validation : nom obligatoire');
  await p.fill('#fn', 'Hugo'); await p.fill('#ln', 'Essai');
  for (let i = 0; i < 3; i++) await p.click('text=Continuer →');
  await p.click('text=Commencer la carrière');
  await p.waitForSelector('text=Prochaine échéance');
  assert(true, 'carrière créée, hub affiché');
  // Match en direct puis fin simulée
  await p.click('text=Préparer et jouer le match');
  await p.click('text=Lancer le match');
  await p.waitForTimeout(3000);
  const live = await p.evaluate(() => { const e = window.__brs.engine; return { on: e.onCourt.length, t: e.time }; });
  assert(live.on === 10 && live.t > 1, 'match en direct : 10 joueurs, le temps avance');
  if (OUT) await p.screenshot({ path: OUT + '/e2e-live.png' });
  await p.click('[aria-label="Pause"]');
  await p.click('text=Simuler la fin du match');
  await p.waitForSelector('text=FEUILLE DE MATCH', { timeout: 60000 });
  if (OUT) await p.screenshot({ path: OUT + '/e2e-boxscore.png', fullPage: true });
  assert(await p.isVisible('text=Homme du match'), 'feuille de match avec homme du match');
  await p.click('text=/Continuer \\(/');
  await p.waitForSelector('text=Semaine 2/22');
  assert(true, 'semaine suivante');
  await p.click('.sidebar >> text=Vie');
  await p.click('text=Dîner avec les coéquipiers');
  assert(await p.isVisible('text=Finances'), 'onglet Vie : finances et activités');
  await p.click('.sidebar >> text=Accueil');
  // Simulation d'un match
  await p.click('text=Simuler le match');
  await p.waitForSelector('text=FEUILLE DE MATCH', { timeout: 60000 });
  await p.click('text=/Continuer \\(/');
  await p.waitForSelector('text=Semaine 3/22');
  assert(true, 'match simulé par le moteur complet');
  // Onglets
  for (const t of ['Entraînement', 'Vie', 'Club', 'Calendrier', 'Carrière']) { await p.click(`.sidebar >> text=${t}`); await p.waitForTimeout(150); }
  assert(await p.isVisible('text=Palmarès') || await p.isVisible('text=Profil'), 'onglets navigables');
  // Sauver et quitter, puis continuer
  await p.click('text=Sauver et quitter');
  await p.waitForSelector('text=Nouvelle carrière');
  await p.reload();
  await p.click('text=Continuer');
  await p.waitForSelector('text=Semaine 3/22');
  assert(true, 'rechargement après fermeture : la carrière est intacte');
  // Mobile portrait : navigation inférieure
  const m = p;
  await m.setViewportSize({ width: 390, height: 844 });
  await m.waitForSelector('.bottom-nav');
  const overflow = await m.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow, 'mobile : pas de défilement horizontal');
  if (OUT) await m.screenshot({ path: OUT + '/e2e-mobile-hub.png' });
  assert(errors.length === 0, 'aucune erreur JavaScript (' + errors.join(' | ') + ')');
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
