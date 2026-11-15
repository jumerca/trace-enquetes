// Captures de l'interface sur téléphone (paysage/portrait), tablette, ordinateur : node scripts/ui-check.cjs <url> <dossier>
const { chromium, devices } = require('playwright');
(async () => {
  const [url = 'http://localhost:4173/', dir = '/tmp/ui'] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const confs = [
    ['phone-land', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['phone-port', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['tablet', { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ['desktop', { viewport: { width: 1440, height: 900 } }],
  ];
  for (const [name, opt] of confs) {
    const ctx = await b.newContext(opt);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push(e.message));
    await p.addInitScript(() => localStorage.setItem('chemins-oublies.settings', JSON.stringify({ textSpeed: 'instantanee', quality: 'moyenne' })));
    await p.goto(url);
    await p.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${dir}/${name}-home.png` });
    if (name === 'phone-port') {
      // le jeu en portrait : avertissement + accès aux menus
      await p.setViewportSize({ width: 844, height: 390 });
    }
    await p.click('[data-h=new]'); await p.waitForTimeout(300); await p.click('[data-a=new]'); await p.waitForTimeout(1500);
    if (name === 'phone-port') await p.setViewportSize({ width: 390, height: 844 });
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${dir}/${name}-dialog.png` });
    if (name !== 'phone-port') {
      for (let i = 0; i < 6; i++) { if (await p.isVisible('#dialog .db')) await p.click('#dialog .db'); await p.waitForTimeout(100); }
      await p.evaluate(() => { const S = __co.S; S.clues.push('salome', 'ninon', 'basile'); S.inventory.push('lettre', 'aimant'); S.flags.met_agathe = true; S.flags.t_ninon = true; });
      for (const pn of ['atlas', 'inventaire', 'journal', 'menu']) { await p.click(`.ib[data-p=${pn}]`); await p.waitForTimeout(500); await p.screenshot({ path: `${dir}/${name}-${pn}.png` }); await p.click('#panel .close'); await p.waitForTimeout(200); }
      await p.click('.ib[data-p=journal]'); await p.click('.tab[data-t=habitants]'); await p.waitForTimeout(400); await p.screenshot({ path: `${dir}/${name}-habitants.png` }); await p.click('#panel .close');
      // chevauchements : les boutons du HUD restent dans l'écran
      const out = await p.evaluate(() => [...document.querySelectorAll('.ib, .clock')].filter((e) => { const r = e.getBoundingClientRect(); return r.right > innerWidth || r.left < 0 || r.top < 0; }).length);
      console.log(name, 'éléments hors écran :', out);
    }
    console.log(name, 'erreurs :', errs.length ? errs : 'aucune');
    await ctx.close();
  }
  await b.close();
})();
