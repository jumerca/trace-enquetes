// Mesure indicative des performances (images/s, mémoire JS, coût d'un pas de simulation)
// dans Chromium sans interface (rendu logiciel : les chiffres réels sur GPU sont meilleurs).
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4175/';
(async () => {
  const b = await chromium.launch({ args: ['--enable-precise-memory-info'] });
  const p = await b.newPage({ viewport: { width: Number(process.argv[3] || 1280), height: Number(process.argv[4] || 720) } });
  await p.goto(url);
  await p.getByText('Nouvelle carrière').click();
  await p.getByText('Prendre ses fonctions').click();
  await p.waitForTimeout(2000);
  for (let i = 0; i < 5; i++) { await p.getByTitle("Simuler la journée (jusqu'au lendemain 8 h)").click(); await p.waitForTimeout(100); }
  await p.getByRole('button', { name: '×10' }).click();
  const measure = () => p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 5000) requestAnimationFrame(f); else res({ fps: Math.round(n / 5), heapMB: Math.round(((performance).memory?.usedJSHeapSize ?? 0) / 1048576) }); }; requestAnimationFrame(f); }));
  console.log('Commissariat ×10 :', JSON.stringify(await measure()));
  await p.locator('nav.nav button', { hasText: 'Carte' }).click();
  await p.waitForTimeout(1500);
  console.log('Carte ×10 :', JSON.stringify(await measure()));
  await b.close();
})();
