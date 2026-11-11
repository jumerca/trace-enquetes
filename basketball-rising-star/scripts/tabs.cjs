const { chromium } = require('playwright');
const OUT = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1360, height: 900 } });
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto('http://localhost:4173/');
  await p.click('text=Nouvelle carrière');
  await p.fill('#fn', 'Lucas'); await p.fill('#ln', 'Moreau');
  await p.click('text=Continuer →'); await p.click('text=Afro'); await p.click('text=Fournie');
  for (let i = 0; i < 2; i++) await p.click('text=Continuer →');
  await p.click('text=Commencer la carrière');
  await p.waitForSelector('text=Prochaine échéance');
  for (let w = 0; w < 3; w++) { await p.click('text=Simuler le match'); await p.waitForSelector('text=FEUILLE DE MATCH', { timeout: 60000 }); await p.click('text=/Continuer \\(/'); await p.waitForTimeout(500); if (await p.isVisible('text=Simuler le match') === false) break; }
  for (const [t, f] of [['Joueur', 'player'], ['Entraînement', 'training'], ['Club', 'club'], ['Calendrier', 'calendar']]) {
    await p.click(`.sidebar >> text=${t}`); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}/tab-${f}.png`, fullPage: true });
  }
  console.log('errors', errors);
  await b.close();
})();
