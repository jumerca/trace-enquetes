// Recette automatisée : joue le prologue complet avec de vrais clics souris (ou toucher) dans Chromium.
// Usage : node scripts/e2e.cjs [url] [--touch] [--w=1280 --h=720] [--shots=dossier]
// Le script ne téléporte jamais le héros : il clique sur le sol, les personnages et les objets visibles à l'écran.
const { chromium, devices } = require('playwright');
const fs = require('fs');

const args = process.argv.slice(2);
const URL = args.find((a) => a.startsWith('http')) || 'http://localhost:4173/';
const TOUCH = args.includes('--touch');
const W = +(args.find((a) => a.startsWith('--w='))?.slice(4) || 1280);
const H = +(args.find((a) => a.startsWith('--h='))?.slice(4) || 720);
const SHOTS = args.find((a) => a.startsWith('--shots='))?.slice(8);
const ORDER = args.includes('--unusual');

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const dbg = (...a) => { if (process.env.DEBUG) log('·', ...a); };
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); log(ok ? '✔' : '✘', name, detail); };
let page, errors = [];

const HELPERS = `window.__t = {
  g() { return __co.scene(); },
  info() { const g = this.g(); const dl = document.querySelector('#dialog'); return { zone: g.zone.id, x: g.hero.x, y: g.hero.y, path: g.path.length, tgt: !!g.target, busy: g.busy, tr: g.transitioning, dlg: !dl.classList.contains('hidden'), panel: !document.querySelector('#panel').classList.contains('hidden'), text: dl.querySelector('.dt').textContent, choices: [...dl.querySelectorAll('.dc button')].map((b) => b.textContent), hp: __co.S.hp, clock: __co.S.clock }; },
  toScreen(x, y) { const g = this.g(); const cam = g.cameras.main; const rs = g.registry.get('renderScale'); return [(x - cam.worldView.x) * cam.zoom / rs, (y - cam.worldView.y) * cam.zoom / rs]; },
  toWorld(sx, sy) { const g = this.g(); const cam = g.cameras.main; const rs = g.registry.get('renderScale'); return [cam.worldView.x + sx * rs / cam.zoom, cam.worldView.y + sy * rs / cam.zoom]; },
  path(x, y) { const g = this.g(); const n = g.nav; const d = n.freeAt(x, y) ? [x, y] : n.nearestFree(x, y, 6, [g.hero.x, g.hero.y]); if (!d) return null; return n.findPath([g.hero.x, g.hero.y], d, false); },
  hits(sx, sy) { const g = this.g(); const [wx, wy] = this.toWorld(sx, sy); const pad = 16 / g.cameras.main.zoom * g.registry.get('renderScale'); return !!(g.combat.pick(wx, wy, pad) || g.npcs.pick(wx, wy, pad + 6) || g.pickObj(wx, wy, pad + 6)); },
  npc(id) { const n = this.g().npcs.npcs.get(id); return n ? [n.x, n.y] : null; },
  where(id) { const p = __co.routines[id](); return p ? { zone: p.zone, pt: p.pts[0] } : null; },
  enemies() { return this.g().combat.enemies.filter((e) => e.alive).map((e) => ({ x: e.x, y: e.y, st: e.st, k: e.kind, from: e.dashFrom, to: e.dashTo, reach: e.def.reach, enc: e.enc.id })); },
  exits() { const out = {}; for (const [k, z] of Object.entries(__co.zones)) out[k] = z.exits.map((e) => ({ to: e.to, r: e.rect, door: !!e.door })); return out; },
};`;

const ev = (js) => page.evaluate(js);
const info = () => ev('__t.info()');
const sleep = (ms) => page.waitForTimeout(ms);
async function tap(x, y) { if (TOUCH) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y); }

async function settle(max = 12000) {
  const t0 = Date.now();
  while (Date.now() - t0 < max) {
    const i = await info();
    if (i.dlg) return i;
    if (!i.path && !i.tgt && !i.tr && !i.busy) return i;
    await sleep(120);
  }
  return info();
}

async function dialog(plan = [], opts = {}) {
  const want = [...plan];
  let idle = 0;
  for (let n = 0; n < 400; n++) {
    const i = await info();
    if (!i.dlg) { if (i.busy || i.tr) { idle = 0; await sleep(100); continue; } idle++; if (idle > 6) return; await sleep(100); continue; }
    idle = 0;
    if (i.choices.length) {
      let k = -1;
      if (opts.onChoice) k = await opts.onChoice(i);
      if (k < 0) {
        const wi = want.findIndex((w) => i.choices.some((c) => c.includes(w)));
        if (wi >= 0) { k = i.choices.findIndex((c) => c.includes(want[wi])); want.splice(wi, 1); }
        else k = i.choices.findIndex((c) => c.includes('Au revoir'));
        if (k < 0) k = i.choices.length - 1;
      }
      await page.locator('#dialog .dc button').nth(k).click();
    } else {
      const box = await page.locator('#dialog .db').boundingBox();
      await tap(box.x + box.width / 2, box.y + box.height / 2);
    }
    await sleep(90);
  }
}

/** Marche jusqu'à (x, y) en cliquant sur des points visibles du chemin. */
async function walkTo(x, y, tol = 36) {
  const z0 = (await info()).zone;
  for (let k = 0; k < 60; k++) {
    let i = await info();
    if (i.zone !== z0) return true; // entré par une porte en chemin
    if (i.dlg) await dialog();
    i = await info();
    if (Math.hypot(i.x - x, i.y - y) < tol) return true;
    const path = await ev(`__t.path(${x}, ${y})`);
    if (!path) throw new Error(`pas de chemin vers ${x},${y} (${i.zone} depuis ${Math.round(i.x)},${Math.round(i.y)})`);
    let pick = null;
    const pts = [[i.x, i.y], ...path];
    // échantillonne le chemin et garde le point le plus lointain visible et cliquable
    for (let s = 1; s < pts.length; s++) {
      const [ax, ay] = pts[s - 1], [bx, by] = pts[s];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 30));
      for (let q = 1; q <= n; q++) {
        const wx = ax + (bx - ax) * q / n, wy = ay + (by - ay) * q / n;
        const [sx, sy] = await ev(`__t.toScreen(${wx}, ${wy})`);
        const ok = sx > 70 && sx < W - 70 && sy > 100 && sy < H - (sx < 500 ? 170 : 90);
        if (!ok) { if (pick) break; continue; }
        if (await ev(`__t.hits(${sx}, ${sy})`)) continue;
        pick = [sx, sy];
      }
    }
    if (!pick) {
      // repli : le point visible le plus proche de la cible, dans l'écran
      const [sx, sy] = await ev(`__t.toScreen(${path[path.length - 1][0]}, ${path[path.length - 1][1]})`);
      pick = [Math.min(W - 40, Math.max(40, sx)), Math.min(H - 30, Math.max(90, sy))];
      if (await ev(`__t.hits(${pick[0]}, ${pick[1]})`)) throw new Error(`aucun point cliquable vers ${x},${y}`);
    }
    dbg('walk', Math.round(i.x), Math.round(i.y), '→', x, y, 'tap', pick.map(Math.round));
    await tap(pick[0], pick[1]);
    await sleep(150);
    await settle();
  }
  throw new Error(`n'arrive pas à ${x},${y}`);
}

async function clickWorld(x, y, dy = -28) {
  const [sx, sy] = await ev(`__t.toScreen(${x}, ${y + dy})`);
  await tap(sx, sy);
  await sleep(120);
}

let EXITS;
async function travel(zone) {
  for (let hop = 0; hop < 6; hop++) {
    for (let w = 0; w < 30 && (await info()).tr; w++) await sleep(150);
    const i = await info();
    if (i.zone === zone) return;
    // BFS
    const prev = { [i.zone]: null }; const q = [i.zone];
    while (q.length) { const z = q.shift(); for (const e of EXITS[z]) if (!(e.to in prev)) { prev[e.to] = { z, e }; q.push(e.to); } }
    let cur = zone, step = prev[cur];
    while (step && step.z !== i.zone) { cur = step.z; step = prev[cur]; }
    if (!step) throw new Error('aucune route vers ' + zone);
    const r = step.e.r;
    const interior = ['auberge', 'atelier', 'archives', 'moulin_int'].includes(i.zone);
    const tx = Math.max(20, r.x + r.w / 2), ty = Math.max(14, Math.min(r.y + r.h / 2, 99999));
    try {
      if (step.e.door) await walkTo(tx, interior ? r.y - 18 : r.y + r.h + 22, 34);
      else await walkTo(tx, ty, 30).catch(() => {});
    } catch (err) { await sleep(600); if ((await info()).zone !== i.zone) continue; throw err; }
    // franchit la sortie
    for (let t = 0; t < 4; t++) { const j = await info(); if (j.zone !== i.zone) break; const [sx, sy] = await ev(`__t.toScreen(${tx}, ${interior ? r.y + r.h - 4 : ty})`); await tap(sx, sy); await sleep(900); }
    for (let t = 0; t < 40; t++) { const j = await info(); if (j.zone !== i.zone && !j.tr) break; await sleep(150); }
    await sleep(400);
    await dialog();
  }
}

async function talkTo(id, plan = [], opts = {}) {
  const w = await ev(`__t.where('${id}')`);
  if (!w) throw new Error(id + ' introuvable à cette heure');
  await travel(w.zone);
  await sleep(1300); await dialog(); // pensée d'Éloi à la première visite d'un lieu
  for (let k = 0; k < 8; k++) {
    let p = await ev(`__t.npc('${id}')`);
    if (!p) { await sleep(500); continue; }
    const i = await info();
    if (Math.hypot(p[0] - i.x, p[1] - i.y) > 260) { await walkTo(p[0], p[1] + 70, 90).catch(() => {}); p = await ev(`__t.npc('${id}')`); }
    dbg('talk', id, p.map(Math.round));
    await clickWorld(p[0], p[1], -30);
    await settle();
    const j = await info();
    if (j.dlg) {
      const who = await ev(`document.querySelector('#dialog .dn').textContent`);
      const want = await ev(`(${JSON.stringify(id)} in __co.scene().npcs.npcs) || true, (window.__names ||= {}), ''`);
      void want;
      const name = { agathe: 'Agathe', basile: 'Basile', ninon: 'Ninon', mara: 'Mara', anton: 'Anton', coline: 'Coline', theodore: 'Théodore', salome: 'Salomé' }[id];
      if (name && who && who !== name && who !== 'Éloi') { dbg('mauvais interlocuteur', who); await dialog(); continue; }
      await dialog(plan, opts); return;
    }
  }
  throw new Error('impossible de parler à ' + id);
}

async function use(x, y, dy = -26, plan = [], opts = {}) {
  const i = await info();
  if (Math.hypot(x - i.x, y - i.y) > 240) await walkTo(x, y + 60, 80).catch(() => walkTo(x, y + 40, 80)).catch(() => {});
  await clickWorld(x, y, dy);
  await settle();
  await dialog(plan, opts);
  await settle();
}

const flags = () => ev('__co.S.flags');
const S = () => ev('({...__co.S})');

async function fight(label) {
  const t0 = Date.now();
  const g0 = await ev('__co.S.playTime');
  while (Date.now() - t0 < 900000) {
    await dialog();
    const es = await ev('__t.enemies()');
    if (!es.length) { const g = Math.round((await ev('__co.S.playTime')) - g0); check(`combat ${label} gagné`, true, `${g} s de jeu (${Math.round((Date.now() - t0) / 1000)} s réelles), PV ${(await info()).hp}`); return; }
    const i = await info();
    // danger annoncé ?
    const d = es.find((e) => e.st === 'windup' && Math.hypot(e.x - i.x, e.y - i.y) < e.reach + 70);
    // à portée de bâton : un coup interrompt sa préparation (comme un joueur le ferait)
    if (d && d.k !== 'murmure' && Math.hypot(d.x - i.x, (d.y - i.y) * 1.3) < 62) { await clickWorld(d.x, d.y, -26); await sleep(300); continue; }
    if (d) {
      let ax = i.x - d.x, ay = i.y - d.y;
      if (d.k === 'murmure' && d.from && d.to) { const lx = d.to[0] - d.from[0], ly = d.to[1] - d.from[1]; ax = -ly; ay = lx; if ((i.x - d.from[0]) * ax + (i.y - d.from[1]) * ay < 0) { ax = -ax; ay = -ay; } }
      const n = Math.hypot(ax, ay) || 1;
      let sx, sy;
      for (const dist of [140, 100, 70]) { [sx, sy] = await ev(`__t.toScreen(${i.x + ax / n * dist}, ${i.y + ay / n * dist})`); const free = await ev(`__t.g().nav.freeAt(${i.x + ax / n * dist}, ${i.y + ay / n * dist})`); if (free) break; }
      await tap(sx, sy);
      await sleep(450);
      continue;
    }
    es.sort((a, b) => Math.hypot(a.x - i.x, a.y - i.y) - Math.hypot(b.x - i.x, b.y - i.y));
    await clickWorld(es[0].x, es[0].y, -26);
    await sleep(380);
  }
  check(`combat ${label} gagné`, false, 'délai dépassé');
}

async function screenshot(name) { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); }

async function solveBorne(id, x, y, target) {
  const DIR = ['est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest', 'nord', 'nord-est'];
  await use(x, y, -30, [], {
    onChoice: async (i) => {
      const m = i.text.match(/indique : ([a-z-]+)/);
      const cur = m ? DIR.indexOf(m[1]) : -1;
      if (cur === target) return i.choices.findIndex((c) => c.includes('Laisser'));
      const cw = (target - cur + 8) % 8;
      return cw <= 4 ? 0 : 1;
    },
  });
}

(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext(TOUCH ? { viewport: { width: W, height: H }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : { viewport: { width: W, height: H } });
  page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(e.message); log('pageerror', e.message); });
  page.on('console', (m) => { if (m.type() === 'error') { errors.push(m.text()); log('console.error', m.text().slice(0, 200)); } });
  await page.addInitScript(() => { if (!localStorage.getItem('chemins-oublies.settings')) localStorage.setItem('chemins-oublies.settings', JSON.stringify({ textSpeed: 'instantanee', quality: 'moyenne' })); });
  const T0 = Date.now();
  await page.goto(URL);
  await page.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
  check('chargement et écran d\'accueil', await page.isVisible('[data-h=new]'), `${Date.now() - T0} ms`);
  await page.evaluate(HELPERS);
  EXITS = await ev('__t.exits()');
  await page.click('[data-h=new]'); await sleep(300); await page.click('[data-a=new]');
  await sleep(1500); await page.evaluate(HELPERS);
  await dialog();
  await screenshot('01-arrivee');

  if (process.env.FROM === 'moulin') {
    // départ direct au moulin : toute la progression précédente est acquise
    await ev(`(() => { const S = __co.S; Object.assign(S.flags, { borne_vue: true, agathe_moulin: true, t_ninon: true, t_salome: true, t_basile: true, bornes_solved: true, boussole_ok: true, theo_ok: true, anton_found: true, stones_solved: true, enc1_done: true, enc2_done: true, lettre_recue: true, jardin_accepte: true, pick_sauge: true, pick_pied_de_loup: true, pick_fleur_lanterne: true }); S.defeated.push('enc1', 'enc2'); S.inventory.push('boussole', 'cle_moulin', 'sauge', 'pied_de_loup', 'fleur_lanterne'); S.bornes = [0, 6, 7]; S.traces.push('route_bornes', 'route_bois'); __co.scene().loadZone('moulin', 400, 1690, 'up'); })()`);
    await sleep(1000);
  } else {
  // Séquence 1
  await use(1395, 2050, -30);
  check('borne d\'arrivée examinée', (await flags()).borne_vue);
  if (ORDER) {
    await talkTo('theodore'); check('ordre inhabituel : Théodore refuse le passage', !(await flags()).theo_ok);
    await talkTo('coline'); check('ordre inhabituel : Coline avant l\'enquête', (await flags()).coline_besoin);
  }
  await talkTo('agathe');
  check('Agathe : le moulin existait', (await flags()).agathe_moulin);
  await screenshot('02-agathe');

  // Séquence 2
  await talkTo('ninon', ['rocher']);
  await talkTo('salome');
  await talkTo('basile', ['tournée']);
  const f2 = await flags();
  check('trois témoignages', f2.t_ninon && f2.t_salome && f2.t_basile);
  check('Basile confie la lettre', (await S()).inventory.includes('lettre'));
  await talkTo('salome', ['Saules']);
  check('registre : la lettre est pour Verdier', (await flags()).lettre_registre);
  await travel('clairval');
  await solveBorne('A', 1640, 1115, 0);
  await solveBorne('B', 2640, 1115, 6);
  await solveBorne('C', 2640, 815, 7);
  check('énigme 1 : bornes réorientées', (await flags()).bornes_solved, JSON.stringify((await S()).bornes));
  check('première trace dans l\'atlas', (await S()).traces.includes('route_bornes'));
  await screenshot('03-bornes');
  // secret sous le pont
  await use(2262, 1206, -16);
  check('secret : boîte sous le pont', (await S()).secrets.includes('pont'));

  // Boussole
  await talkTo('coline');
  await talkTo('mara', ['aimant', 'Bois', 'jardin']);
  check('Mara donne la pierre d\'aimant', (await S()).inventory.includes('aimant'));
  check('mission : le Jardin de Mara', (await flags()).jardin_accepte);
  await talkTo('coline', ["pierre d'aimant"]);
  check('Coline répare la boussole', (await flags()).boussole_ok);
  await talkTo('theodore');
  check('Théodore ouvre la porte du Bois', (await flags()).theo_ok);

  // Sauvegarde / rechargement en cours de quête
  const before = await S();
  await page.reload();
  await page.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
  await page.click('[data-h=continue]'); await sleep(1500); await page.evaluate(HELPERS);
  const after = await S();
  check('rechargement : progression restaurée', ['bornes_solved', 'boussole_ok', 'theo_ok', 'lettre_registre'].every((f) => after.flags[f]) && JSON.stringify(after.bornes) === JSON.stringify(before.bornes) && after.zone === before.zone, `zone ${after.zone}, bornes ${after.bornes}`);
  check('rechargement : énigme des bornes reste résolue', after.flags.bornes_solved && after.traces.includes('route_bornes'));

  // Séquence 3 : le Bois
  await travel('bois');
  await screenshot('04-bois');
  await use(1300, 1990, -30);
  await use(1060, 2110, -14);
  check('cueillette : pied-de-loup', (await S()).inventory.includes('pied_de_loup'));
  await walkTo(1180, 1840);
  await walkTo(1010, 1580, 60);
  await screenshot('05-combat1');
  await fight('1 (ronceux)');
  check('rencontre 1 terminée', (await flags()).enc1_done);
  await sleep(900);
  await talkTo('anton', ['roue', 'pierres', 'lettre']);
  const f3 = await flags();
  check('Anton retrouvé (clé + frottis)', f3.anton_found && (await S()).inventory.includes('cle_moulin'));
  check('mission : la lettre livrée à Anton', f3.lettre_livree);
  await use(1700, 1380, -30);
  await use(2120, 1352, -30);
  check('inscriptions du pont et de la stèle', (await S()).clues.includes('frag_pont') && (await S()).clues.includes('anton_lune'));
  await use(2060, 1760, -14);
  check('cueillette : sauge', (await S()).inventory.includes('sauge'));
  // coffre gardé (rencontre facultative)
  await walkTo(1890, 1900);
  await walkTo(1880, 2060, 60);
  await fight('facultatif (ronceux ancien)');
  await use(1880, 2235, -20);
  check('secret : coffre des ronces (+1 cœur)', (await S()).secrets.includes('coffre') && (await S()).maxHp >= 6);
  // sentier caché grâce à l'atlas
  await use(620, 1318, -40);
  check('arbre gravé examiné', (await flags()).arbre_vu);
  await page.click('.ib[data-p=atlas]'); await sleep(500); await screenshot('06-atlas');
  await page.click('#consult'); await sleep(400); await settle(); await dialog(); await settle(15000);
  check('secret : sentier caché révélé par l\'atlas', (await flags()).passage_open && (await S()).secrets.includes('passage'));
  await use(250, 920, -20);
  check('coffre caché : moitié de page', (await S()).inventory.includes('page_gauche'));
  // combinaison
  await page.click('.ib[data-p=inventaire]'); await sleep(300);
  await page.click('.tile[data-i=page_gauche]'); await page.click('[data-a=comb]'); await page.click('.tile[data-i=page_droite]'); await sleep(300);
  await page.click('#panel .close');
  check('combinaison : page de Maëlys', (await S()).inventory.includes('page_maelys'));
  // cercle de pierres
  await walkTo(1000, 1120, 60);
  await walkTo(1100, 900, 80);
  await fight('2 (murmures)');
  check('rencontre 2 terminée', (await flags()).enc2_done);
  await use(1290, 640, -14);
  check('cueillette : fleur-lanterne', (await S()).inventory.includes('fleur_lanterne'));
  // essai erroné puis bonne séquence
  await use(1230, 685, -40);
  check('énigme 2 : erreur (lune) réinitialise', (await S()).stones.length === 0);
  for (const [x, y] of [[1240, 855], [975, 690], [965, 860]]) await use(x, y, -40);
  check('énigme 2 : pierres (eau, oiseau, clé)', (await flags()).stones_solved);
  await screenshot('07-pierres');

  }
  // Séquence 4 : le moulin
  await travel('moulin');
  await screenshot('08-moulin');
  // le Gardien des Ronces
  await walkTo(700, 1250, 80).catch(() => {});
  await walkTo(1120, 1330, 60).catch(() => {});
  for (let i = 0; i < 60 && !(await ev('__t.g().bossActive && !__t.g().busy')); i++) { await dialog(); await sleep(250); }
  check('boss : le Gardien des Ronces se réveille', await ev('__t.g().bossActive'));
  await screenshot('08b-boss');
  {
    const t0 = Date.now();
    while (Date.now() - t0 < 900000 && !(await flags()).boss_done) {
      await dialog();
      const b = await ev('(() => { const bo = __t.g().boss; return bo ? { st: bo.st, x: bo.x, y: bo.y } : null; })()');
      if (!b) break;
      if (b.st === 'windup' || b.st === 'cwindup') { if (await page.isVisible('#dodge')) { const bb = await page.locator('#dodge').boundingBox(); await tap(bb.x + bb.width / 2, bb.y + bb.height / 2); } await sleep(300); continue; }
      if (b.st === 'exposed' || b.st === 'stunned') { await clickWorld(b.x, b.y, -60); await sleep(250); continue; }
      await sleep(150);
    }
    await dialog();
    check('boss vaincu (cœur de chêne)', (await flags()).boss_done && (await S()).inventory.includes('coeur_chene'), `${Math.round((Date.now() - t0) / 1000)} s`);
  }
  await walkTo(1190, 990, 40);
  await travel('moulin_int');
  check('porte du moulin ouverte avec la clé', (await info()).zone === 'moulin_int');
  await use(140, 380, -30);
  await use(560, 340, -40);
  check('journal lu et frein desserré', (await flags()).journal_lu && (await flags()).brake_released);
  await travel('moulin');
  // essai trop tôt : la roue frémit
  await use(1395, 760, -30);
  check('énigme 3 : vanne motrice trop tôt → la roue retombe', !(await flags()).mill_running);
  await use(1395, 760, -30); // referme
  await use(1395, 600, -30); // ferme la décharge
  await use(1640, 335, -30); // ouvre la prise
  for (let t = 0; t < 60 && (await ev('__co.S.mill.level')) < 0.95; t++) await sleep(300);
  check('le bief se remplit', (await ev('__co.S.mill.level')) >= 0.92, String(await ev('__co.S.mill.level')));
  await use(1395, 760, -30);
  check('énigme 3 : la roue tourne', (await flags()).mill_running);
  await screenshot('09-roue');
  // Séquence 5 : révélation
  await page.click('.ib[data-p=atlas]'); await sleep(400); await page.click('#consult');
  for (let t = 0; t < 200; t++) { await dialog(); if (await page.isVisible('.chapter-end')) break; await sleep(250); }
  await screenshot('10-fin');
  check('écran de fin de chapitre', await page.isVisible('.chapter-end'));
  await page.click('.chapter-end button');
  const f5 = await flags();
  check('route révélée et prologue terminé', f5.route_revealed && f5.chapter_done && (await S()).notes.includes('note_finale'));

  // Exploration libre après la fin : retour par la route retrouvée
  await travel('clairval');
  check('retour à Clairval par la route retrouvée', (await info()).zone === 'clairval');
  await talkTo('mara', ['plantes']);
  check('mission accomplie : Jardin de Mara (baume)', (await flags()).jardin_fini && (await S()).counters.baume === 3);
  await screenshot('11-retour');

  // Rechargement final
  const fin = await S();
  await page.reload();
  await page.waitForFunction(() => document.getElementById('boot') === null, null, { timeout: 120000 });
  await page.click('[data-h=continue]'); await sleep(1500); await page.evaluate(HELPERS);
  const fin2 = await S();
  check('rechargement final : tout est conservé', fin2.flags.chapter_done && fin2.mill.solved && fin2.secrets.length === fin.secrets.length && fin2.zone === fin.zone);
  const sc = await ev('__t.g().zone.id');
  check('la roue tourne toujours après rechargement', fin2.mill.solved && sc === fin2.zone);

  const total = Math.round((await ev('__co.S.playTime')) / 60);
  log(`temps de jeu simulé : ${total} min (horloge du jeu)`);
  check('aucune erreur JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '));
  const ok = results.filter((r) => r.ok).length;
  log(`${ok}/${results.length} vérifications réussies`);
  fs.writeFileSync(SHOTS ? `${SHOTS}/e2e-results.json` : '/tmp/e2e-results.json', JSON.stringify({ touch: TOUCH, viewport: [W, H], results, errors }, null, 1));
  await b.close();
  process.exit(ok === results.length ? 0 : 1);
})().catch(async (e) => {
  log('ÉCHEC', e.message);
  try { await page.screenshot({ path: (SHOTS || '/tmp') + '/e2e-fail.png' }); log(JSON.stringify(await info())); } catch { /* */ }
  process.exit(2);
});
