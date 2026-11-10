const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto('http://localhost:4173/');
  await p.click('text=Nouvelle carrière');
  await p.fill('#fn', 'Hugo'); await p.fill('#ln', 'Essai');
  for (let i = 0; i < 3; i++) await p.click('text=Continuer →');
  await p.click('text=Commencer la carrière');
  await p.waitForSelector('text=Prochaine échéance');
  await p.click('text=Simuler le match'); await p.waitForSelector('text=FEUILLE DE MATCH', { timeout: 60000 }); await p.click('text=/Continuer \\(/');
  await p.waitForTimeout(500);
  await p.setViewportSize({ width: 390, height: 844 });
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => { const W = window.innerWidth; const out = []; document.querySelectorAll('body *').forEach((el) => { const rc = el.getBoundingClientRect(); if (rc.right > W + 1 && rc.width > 0) out.push(`${el.tagName}.${el.className} ${Math.round(rc.right)}`); }); return out.slice(0, 12); });
  console.log(r);
  await b.close();
})();
