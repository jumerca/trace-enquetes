// Tests de bout en bout sur le build de production (vite preview).
// Usage : npm run build && npm run test:e2e   (captures dans docs/captures/)
const { chromium, devices } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const PORT = 4174;
const URL = `http://localhost:${PORT}/`;
const OUT = path.join(__dirname, '../docs/captures');
fs.mkdirSync(OUT, { recursive: true });
const results = [];
const ok = (name, cond, info = '') => {
  results.push({ name, ok: !!cond, info });
  console.log(`${cond ? '✔' : '✘'} ${name}${info ? ' — ' + info : ''}`);
};

async function waitServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(URL);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('serveur de prévisualisation indisponible');
}

const GL = ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

async function startGame(page, region = 'limousin') {
  await page.goto(URL);
  await page.click('[data-testid=nouvelle-partie]');
  await page.click(`[data-testid=region-${region}]`);
  await page.click('[data-testid=commencer]');
  await page.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 60000 });
  await page.waitForTimeout(800);
}
const tileScreen = (page, x, y) => page.evaluate(([x, y]) => window.__dt.scene.tileToScreen(x, y), [x, y]);
/** Emplacement valide (coin haut de l'emprise) pour un type, près de la ferme ; renvoie la case à toucher (centre). */
const findSpot = (page, type) =>
  page.evaluate((type) => {
    const sim = window.__dt.sim, A = window.__dtActions;
    const [cx, cy] = sim.s.world.farm;
    const size = { champ_ble: 4, champ_legumes: 4 }[type] ?? 4;
    for (let r = 4; r < 22; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (A.checkBuild(sim, type, cx + dx, cy + dy, 0).ok) return [cx + dx + (size >> 1), cy + dy + (size >> 1)];
        }
    return null;
  }, type);
const findWater = (page) =>
  page.evaluate(() => {
    const W = window.__dt.sim.s.world;
    const [cx, cy] = W.farm;
    for (let r = 2; r < 40; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const t = W.terrain[(cy + dy) * W.w + cx + dx];
      if ((t === 3 || t === 8) && W.owned[Math.floor((cy + dy) / 16) * 16 + Math.floor((cx + dx) / 16)]) return [cx + dx, cy + dy];
    }
    return null;
  });

(async () => {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  const errors = [];
  try {
    await waitServer();
    const browser = await chromium.launch({ args: GL });

    // ——— Ordinateur ———
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(URL);
    await page.screenshot({ path: path.join(OUT, '01-accueil.jpg'), quality: 85 });
    for (const label of ['Nouvelle partie', 'Continuer', 'Charger', 'Réglages', 'Crédits', 'Installer']) ok(`menu : bouton « ${label} »`, await page.getByRole('button', { name: label }).count());
    for (const label of ['Charger', 'Réglages', 'Crédits', 'Installer']) {
      await page.getByRole('button', { name: label, exact: true }).click();
      const shown = await page.locator('.modal h2').isVisible();
      ok(`menu : « ${label} » ouvre sa fenêtre`, shown);
      await page.click('.modal .close');
    }
    await startGame(page);
    ok('partie : la scène est rendue', await page.locator('canvas').count());
    ok('partie : argent affiché', /18\s?000/.test(await page.textContent('[data-testid=argent]')));
    ok('carte immense (256×256) et région choisie', (await page.evaluate('window.__dt.sim.s.world.w')) === 256 && (await page.evaluate('window.__dt.sim.s.region')) === 'limousin');
    await page.screenshot({ path: path.join(OUT, '02-domaine-zoom-normal.jpg'), quality: 85 });

    // vitesses
    await page.click('[data-testid=vitesse-4]');
    ok('vitesse ×4', (await page.evaluate('window.__dt.speed')) === 4);
    const m0 = await page.evaluate('window.__dt.sim.s.minute');
    await page.waitForTimeout(1500);
    const m1 = await page.evaluate('window.__dt.sim.s.minute');
    ok('le temps avance à ×4', m1 > m0, `${m1 - m0} min de jeu en 1,5 s`);
    await page.click('[data-testid=vitesse-0]');
    const p0 = await page.evaluate('window.__dt.sim.s.minute');
    await page.waitForTimeout(700);
    ok('pause : le temps est figé', (await page.evaluate('window.__dt.sim.s.minute')) === p0);

    // caméra : déplacement et zoom sans saut
    const cam0 = await page.evaluate('({...window.__dt.scene.cam})');
    await page.mouse.move(640, 420);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(640 - i * 15, 420 - i * 8);
    await page.mouse.up();
    const cam1 = await page.evaluate('({...window.__dt.scene.cam})');
    ok('glisser : la carte se déplace', Math.abs(cam1.x - cam0.x) > 50 && Math.abs(cam1.y - cam0.y) > 20, `Δx=${Math.round(cam1.x - cam0.x)} Δy=${Math.round(cam1.y - cam0.y)}`);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(100);
    const cam2 = await page.evaluate('({...window.__dt.scene.cam})');
    ok('molette : zoom avant', cam2.z > cam1.z, `z ${cam1.z.toFixed(2)} → ${cam2.z.toFixed(2)}`);
    // la caméra ne bouge pas toute seule pendant la simulation
    await page.click('[data-testid=vitesse-4]');
    await page.waitForTimeout(1200);
    const cam3 = await page.evaluate('({...window.__dt.scene.cam})');
    ok('la caméra reste immobile pendant la simulation', cam3.x === cam2.x && cam3.y === cam2.y && cam3.z === cam2.z);
    await page.click('[data-testid=vitesse-0]');
    await page.evaluate('window.__dt.scene.centerOn(window.__dt.sim.s.world.farm[0], window.__dt.sim.s.world.farm[1], 1)');
    await page.waitForTimeout(150);

    // fiche bâtiment
    const home = await page.evaluate('[window.__dt.sim.s.buildings[0].x + 1, window.__dt.sim.s.buildings[0].y + 1]');
    const [hx, hy] = await tileScreen(page, home[0], home[1]);
    await page.mouse.click(hx, hy);
    await page.waitForTimeout(250);
    ok('toucher la maison ouvre sa fiche', (await page.textContent('[data-testid=fiche-batiment]').catch(() => '')).includes('Maison du domaine'));
    await page.click('[data-testid=fiche-batiment] .icon-btn');

    // construction invalide (eau) puis valide (champ de blé)
    await page.click('[data-testid=onglet-construire]');
    await page.click('[data-testid=categorie-cultures]');
    await page.click('[data-testid=construire-champ_ble]');
    const nb0 = await page.evaluate('window.__dt.sim.s.buildings.length');
    const water = await findWater(page);
    if (water) {
      await page.evaluate(([x, y]) => window.__dt.scene.centerOn(x, y, 1), water);
      await page.waitForTimeout(100);
      const [wx, wy] = await tileScreen(page, water[0], water[1]);
      await page.mouse.move(wx, wy);
      await page.mouse.click(wx, wy);
      await page.waitForTimeout(200);
    }
    ok('construction refusée sur l\'eau', water && (await page.evaluate('window.__dt.sim.s.buildings.length')) === nb0);
    const spot = await findSpot(page, 'champ_ble');
    await page.evaluate(([x, y]) => window.__dt.scene.centerOn(x, y, 1), spot);
    await page.waitForTimeout(150);
    const [fx, fy] = await tileScreen(page, spot[0], spot[1]);
    await page.mouse.move(fx, fy);
    await page.waitForTimeout(100);
    await page.screenshot({ path: path.join(OUT, '03-placement-fantome.jpg'), quality: 85 });
    await page.mouse.click(fx, fy);
    await page.waitForTimeout(200);
    ok('champ de blé construit', (await page.evaluate('window.__dt.sim.s.buildings.length')) === nb0 + 1);
    const money = await page.evaluate('window.__dt.sim.s.money');
    ok('coût débité', money <= 18000 - 900, `trésorerie ${money} €`);

    // panneaux
    for (const p of ['gestion', 'production', 'personnel', 'commerce', 'territoire', 'construire']) {
      await page.click(`[data-testid=onglet-${p}]`);
      ok(`panneau « ${p} » s'ouvre`, await page.locator(`[data-testid=panneau-${p}]`).isVisible());
    }
    await page.click('[data-testid=onglet-production]');
    await page.screenshot({ path: path.join(OUT, '04-panneau-production.jpg'), quality: 85 });
    await page.click('[data-testid=onglet-personnel]');
    const w0 = await page.evaluate('window.__dt.sim.s.workers.length');
    await page.click('[data-testid=embaucher-vendeur]');
    ok('embauche d\'un vendeur', (await page.evaluate('window.__dt.sim.s.workers.length')) === w0 + 1);
    await page.click('[data-testid=onglet-commerce]');
    await page.selectOption('.wholesale select', 'jus');
    await page.fill('.wholesale input', '5');
    const st0 = await page.evaluate('window.__dt.sim.stockOf("jus")');
    await page.click('[data-testid=commander-negociant]');
    ok('commande au négociant : stock réservé', (await page.evaluate('window.__dt.sim.stockOf("jus")')) === st0 - 5);
    // communication : une campagne lancée depuis le panneau
    await page.click('[data-testid=sous-onglet-com]');
    const argent0 = await page.evaluate('window.__dt.sim.s.money');
    await page.click('[data-testid=campagne-affiches]');
    ok('communication : campagne d\'affichage lancée et payée', (await page.evaluate('window.__dt.sim.s.campaigns.some((c) => c.id === "affiches")')) && (await page.evaluate('window.__dt.sim.s.money')) < argent0);
    await page.click('[data-testid=sous-onglet-marche]');
    ok('cours du marché affichés', (await page.locator('.panel table tbody tr').count()) > 0);
    await page.click('[data-testid=onglet-commerce]');
    await page.click('[data-testid=onglet-gestion]');
    await page.click('[data-testid=sous-onglet-calculs]');
    ok('calculs de rentabilité des ateliers', (await page.locator('.panel table tbody tr').count()) > 0);
    await page.click('[data-testid=onglet-gestion]');

    // route empierrée tracée par le joueur
    await page.click('[data-testid=onglet-construire]');
    await page.click('[data-testid=outil-route]');
    const routeSpot = await page.evaluate(() => {
      const sim = window.__dt.sim, W = sim.s.world;
      const [cx, cy] = W.farm;
      for (let r = 3; r < 15; r++) for (let dx = -r; dx <= r; dx++) {
        const x = cx + dx, y = cy + r;
        const t = W.terrain[y * W.w + x];
        if ((t === 0 || t === 1) && sim.occ[y * W.w + x] < 0 && !W.decor[y * W.w + x]) return [x, y];
      }
      return null;
    });
    await page.evaluate(([x, y]) => window.__dt.scene.centerOn(x, y, 1), routeSpot);
    await page.waitForTimeout(150);
    const [rx, ry] = await tileScreen(page, routeSpot[0], routeSpot[1]);
    await page.mouse.click(rx, ry);
    ok('route empierrée tracée', (await page.evaluate(([x, y]) => window.__dt.sim.s.world.terrain[y * 256 + x], routeSpot)) === 5);
    await page.getByRole('button', { name: 'Terminer' }).click();

    // simulation d'une journée complète puis capture
    await page.evaluate('for (let i = 0; i < 900; i++) window.__dt.sim.tick()');
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '05-apres-une-journee.jpg'), quality: 85 });

    // mesure de performance (rendu logiciel SwiftShader : NON représentatif d'un téléphone)
    await page.click('[data-testid=vitesse-1]');
    await page.waitForTimeout(3000);
    const fps = await page.evaluate('window.__dt.measuredFps()');
    const cpu = await page.evaluate('window.__dt.cpuMs()');
    ok('mesure FPS (rendu logiciel, indicatif)', fps > 0, `${fps} i/s ; coût JS moyen ${cpu.toFixed(2)} ms/image`);

    // sauvegarde / chargement
    await page.click('[data-testid=menu-jeu]');
    await page.getByRole('button', { name: 'Enregistrer' }).click();
    await page.click('[data-testid=emplacement-emplacement-1]');
    await page.waitForTimeout(300);
    const saved = await page.evaluate('JSON.stringify({m: window.__dt.sim.s.money, t: window.__dt.sim.s.minute, b: window.__dt.sim.s.buildings.length, w: window.__dt.sim.s.workers.length})');
    await page.click('[data-testid=menu-jeu]');
    const dl = page.waitForEvent('download');
    await page.getByRole('button', { name: /Exporter/ }).click();
    const file = await dl;
    ok('export JSON téléchargé', /domaines-terroirs-jour\d+\.json/.test(file.suggestedFilename()), file.suggestedFilename());
    await page.reload();
    await page.getByRole('button', { name: 'Charger', exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Emplacement 1/ }).click();
    await page.waitForFunction('window.__dt && window.__dt.scene', null, { timeout: 60000 });
    const loaded = await page.evaluate('JSON.stringify({m: window.__dt.sim.s.money, t: window.__dt.sim.s.minute, b: window.__dt.sim.s.buildings.length, w: window.__dt.sim.s.workers.length})');
    ok('partie rechargée à l\'identique', saved === loaded, loaded);

    // ——— Toutes les régions démarrent, avec leurs engins et voitures dessinés ———
    for (const region of ['nord', 'beauce', 'est', 'sudouest', 'montagne', 'mer', 'provence']) {
      const rp = await ctx.newPage();
      rp.on('pageerror', (e) => errors.push(region + ': ' + e.message));
      await startGame(rp, region);
      const info = await rp.evaluate(() => ({ region: window.__dt.sim.s.region, b: window.__dt.sim.s.buildings.length, veh: window.__dt.scene.vehicleAtlas.map.size, vivants: window.__dt.scene.livingAtlas.map.size, batiments: window.__dt.scene.buildingAtlas.map.size, nature: window.__dt.scene.natureAtlas.map.size }));
      ok(`région « ${region} » : partie lancée (engins, personnages, bâtiments et arbres 3D chargés)`, info.region === region && info.b >= 5 && info.veh > 400 && info.vivants > 1500 && info.batiments > 150 && info.nature > 400, JSON.stringify(info));
      if (region === 'montagne' || region === 'mer' || region === 'beauce') {
        await rp.evaluate('window.__dt.scene.zoomBy(0.5)');
        await rp.waitForTimeout(800);
        await rp.screenshot({ path: path.join(OUT, `08-region-${region}.jpg`), quality: 85 });
      }
      await rp.close();
    }
    await ctx.close();

    // ——— Téléphone (émulation Pixel 5, tactile) ———
    const mctx = await browser.newContext({ ...devices['Pixel 5'] });
    const m = await mctx.newPage();
    m.on('pageerror', (e) => errors.push(e.message));
    await startGame(m);
    await m.screenshot({ path: path.join(OUT, '06-mobile-domaine.jpg'), quality: 85 });
    const cz = await m.evaluate('window.__dt.scene.cam.z');
    // pincement à deux doigts (événements pointeur synthétiques)
    await m.evaluate(() => {
      const c = document.querySelector('canvas');
      const r = c.getBoundingClientRect();
      const ev = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: r.left + x, clientY: r.top + y, pointerType: 'touch', bubbles: true, isPrimary: id === 1 }));
      ev('pointerdown', 1, 150, 300);
      ev('pointerdown', 2, 250, 300);
      for (let i = 1; i <= 8; i++) {
        ev('pointermove', 1, 150 - i * 8, 300);
        ev('pointermove', 2, 250 + i * 8, 300);
      }
      ev('pointerup', 1, 86, 300);
      ev('pointerup', 2, 314, 300);
    });
    const cz2 = await m.evaluate('window.__dt.scene.cam.z');
    ok('mobile : pincement = zoom', cz2 > cz * 1.3, `z ${cz.toFixed(2)} → ${cz2.toFixed(2)}`);
    await m.tap('[data-testid=onglet-construire]');
    await m.screenshot({ path: path.join(OUT, '07-mobile-construire.jpg'), quality: 85 });
    await m.tap('[data-testid=categorie-cultures]');
    await m.tap('[data-testid=construire-champ_ble]');
    const mb0 = await m.evaluate('window.__dt.sim.s.buildings.length');
    const mspot = await findSpot(m, 'champ_ble');
    await m.evaluate(([x, y]) => window.__dt.scene.centerOn(x, y, 0.8), mspot);
    await m.waitForTimeout(150);
    const [tx, ty] = await tileScreen(m, mspot[0], mspot[1]);
    await m.touchscreen.tap(tx, ty);
    await m.waitForTimeout(200);
    ok('mobile : un toucher place le fantôme sans construire', (await m.evaluate('window.__dt.sim.s.buildings.length')) === mb0);
    await m.tap('[data-testid=valider-construction]');
    ok('mobile : « Valider » construit', (await m.evaluate('window.__dt.sim.s.buildings.length')) === mb0 + 1);
    await mctx.close();
    await browser.close();
  } catch (e) {
    ok('exécution sans exception', false, e.message);
  } finally {
    server.kill();
  }
  ok('aucune erreur JavaScript dans la page', errors.length === 0, errors.slice(0, 3).join(' | '));
  const failed = results.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, 'resultats-e2e.json'), JSON.stringify(results, null, 1));
  console.log(`\n${results.length - failed}/${results.length} vérifications réussies`);
  process.exit(failed ? 1 : 0);
})();
