const { chromium } = require('playwright');
(async () => {
  const OUT = process.argv[2];
  const b = await chromium.launch();
  for (const [w, h, name] of [[1280, 720, 'desk'], [844, 390, 'land'], [390, 844, 'port']]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, hasTouch: w < 900 });
    await p.goto('http://localhost:4173/');
    await p.click('text=Match rapide');
    await p.waitForTimeout(9000);
    await p.screenshot({ path: `${OUT}/hud-${name}.png` });
    // chevauchements entre boutons et tableau de score
    const ov = await p.evaluate(() => {
      const sb = document.querySelector('.scorebug').getBoundingClientRect();
      return [...document.querySelectorAll('.mtop-btns .icon-btn')].some((b) => { const r = b.getBoundingClientRect(); return !(r.right <= sb.left || r.left >= sb.right || r.bottom <= sb.top || r.top >= sb.bottom); });
    });
    console.log(name, 'chevauchement:', ov);
  }
  await b.close();
})();
