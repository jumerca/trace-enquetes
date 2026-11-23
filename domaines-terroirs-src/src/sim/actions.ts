// Actions du joueur : toutes validées ici (l'interface ne fait que les appeler).
import { BRIDGE_COST, BUILDINGS, LEVEL_COST, LOT_PRICE, LOT_SIZE, PATH_COST, ROAD_COST, RESOURCES, TREE_CLEAR_COST, type Res } from '../data/content';
import { regionBuildings } from '../data/regions';
import { DECOR_IS_TREE, D, HSCALE, T, flattenRect, inside, isBuildableGround, isOwned, isPathLike, lotOf, lotsPerRow, slopeOf } from '../world/terrain';
import { defOf, doorOf, footprint, isParcel } from './geom';
import { dayOf, round2, type Sim } from './sim';
import type { Building } from './state';

export interface BuildCheck {
  ok: boolean;
  reason: string;
  cost: number; // coût total (bâtiment + défrichage + terrassement)
  clear: number; // arbres à défricher
  level: number; // volume de terre à déplacer
}

/** Volume de terrassement nécessaire pour aplanir une emprise (unités de hauteur). */
function levelVolume(sim: Sim, x: number, y: number, s: number) {
  const W = sim.s.world;
  let sum = 0, n = 0;
  for (let yy = y; yy <= y + s; yy++) for (let xx = x; xx <= x + s; xx++) (sum += W.height[yy * (W.w + 1) + xx]), n++;
  const avg = sum / n;
  let v = 0;
  for (let yy = y; yy <= y + s; yy++) for (let xx = x; xx <= x + s; xx++) v += Math.abs(W.height[yy * (W.w + 1) + xx] - avg);
  return Math.round(v);
}

export function checkBuild(sim: Sim, type: string, x: number, y: number, rot: 0 | 1): BuildCheck {
  const def = BUILDINGS[type];
  const W = sim.s.world;
  const res = (ok: boolean, reason: string, clear = 0, level = 0): BuildCheck => ({ ok, reason, cost: def ? def.cout + clear * TREE_CLEAR_COST + level * LEVEL_COST : 0, clear, level });
  if (!def || !def.constructible) return res(false, 'Bâtiment inconnu');
  if (!regionBuildings(sim.region).has(type)) return res(false, 'Non adapté à cette région');
  if (def.unique && sim.s.buildings.some((b) => b.type === type)) return res(false, 'Déjà construit');
  let clear = 0, steep = 0;
  for (const [fx, fy] of footprint({ x, y, type })) {
    if (!inside(W, fx, fy)) return res(false, 'Hors de la carte');
    if (!isOwned(W, fx, fy)) return res(false, 'Terrain non acquis (menu Territoire)');
    const i = fy * W.w + fx;
    if (sim.occ[i] >= 0) return res(false, 'Emplacement occupé');
    const t = W.terrain[i];
    if (!isBuildableGround(t)) return res(false, t === T.eau || t === T.mer ? 'Impossible sur l\'eau' : isPathLike(t) ? 'Impossible sur un chemin' : t === T.roche ? 'Terrain rocheux' : t === T.sable ? 'Impossible sur la plage' : 'Sol incompatible (bois)');
    const d = W.decor[i];
    if (d === D.rocher || d === D.rocherGros || d === D.maison || d === D.eglise) return res(false, 'Rocher ou construction existante');
    if (DECOR_IS_TREE(d)) clear++;
    steep = Math.max(steep, slopeOf(W, fx, fy));
  }
  const level = isParcel(type) && BUILDINGS[type].kind !== 'enclos' ? 0 : levelVolume(sim, x, y, def.size);
  if (isParcel(type) && steep > 30) return res(false, 'Pente trop forte pour une parcelle', clear);
  if (level * HSCALE > 160 * def.size) return res(false, 'Pente trop forte (terrassement impossible)', clear, level);
  if (isParcel(type)) {
    const s = def.size;
    let access = false;
    for (let k = 0; k < s && !access; k++)
      for (const [ax, ay] of [[x + k, y + s], [x + s, y + k], [x + k, y - 1], [x - 1, y + k]])
        if (inside(W, ax, ay) && isPathLike(W.terrain[ay * W.w + ax])) access = true;
    if (!access) return res(false, 'Doit longer un chemin (accès)', clear, level);
  } else {
    const [dx, dy] = doorOf({ x, y, type, rot });
    if (!inside(W, dx, dy) || !isPathLike(W.terrain[dy * W.w + dx]) || sim.occ[dy * W.w + dx] >= 0) return res(false, 'La porte doit donner sur un chemin', clear, level);
  }
  const c = res(true, '', clear, level);
  if (sim.s.money < c.cost) return { ...c, ok: false, reason: 'Fonds insuffisants' };
  const extra = [clear ? `défrichage de ${clear} arbre(s)` : '', level ? `terrassement ${level * LEVEL_COST} €` : ''].filter(Boolean).join(', ');
  return { ...c, reason: extra ? `Valide — ${extra} inclus` : 'Emplacement valide' };
}

export function build(sim: Sim, type: string, x: number, y: number, rot: 0 | 1): Building | null {
  const c = checkBuild(sim, type, x, y, rot);
  if (!c.ok) return null;
  const W = sim.s.world;
  const def = BUILDINGS[type];
  for (const [fx, fy] of footprint({ x, y, type })) W.decor[fy * W.w + fx] = D.none;
  if (c.level) flattenRect(W, x, y, x + def.size - 1, y + def.size - 1);
  const b: Building = { id: sim.s.nextId++, type, x, y, rot, inv: {}, ready: 0, growth: 0, phase: 'labour', done: [], busyBy: null, priority: false, batches: 0, builtDay: dayOf(sim.s.minute) };
  sim.s.buildings.push(b);
  sim.touch(x - 2, y - 2, x + def.size + 2, y + def.size + 2);
  sim.book(def.activite, -def.cout, `Construction — ${def.nom}`, true);
  if (c.clear) sim.book('general', -c.clear * TREE_CLEAR_COST, 'Défrichage', true);
  if (c.level) sim.book('general', -c.level * LEVEL_COST, 'Terrassement', true);
  sim.refresh(true);
  sim.onBuilt(b);
  sim.s.stats.built++;
  sim.event(`${def.nom} construit (${c.cost} €).`, 'succes');
  return b;
}

export function demolish(sim: Sim, id: number): boolean {
  const b = sim.byId.get(id);
  if (!b || b.type === 'maison') return false;
  const def = defOf(b);
  if (def.kind === 'stock') {
    const others = sim.storages().filter((x) => x !== b);
    const room = others.reduce((a, x) => a + sim.space(x), 0);
    if (sim.used(b) > room) {
      sim.event('Démolition impossible : le contenu de la grange ne tient pas ailleurs.', 'alerte');
      return false;
    }
    for (const [r, q] of Object.entries(b.inv) as [Res, number][]) {
      let left = q;
      for (const o of others) {
        const m = Math.min(left, sim.space(o));
        if (m > 0) sim.add(o, r, m);
        left -= m;
      }
    }
  }
  if ((def.kind === 'hangar' || def.kind === 'remise') && sim.s.vehicles.some((v) => v.home === b.id && v.driver != null)) {
    sim.event('L\'engin est en service : démolition reportée.', 'alerte');
    return false;
  }
  for (const w of sim.s.workers) if (w.steps.some((st) => 'b' in st && st.b === id)) sim.abort(w);
  sim.s.buildings = sim.s.buildings.filter((x) => x !== b);
  sim.s.animals = sim.s.animals.filter((a) => a.pen !== id);
  sim.s.vehicles = sim.s.vehicles.filter((v) => v.home !== id);
  const refund = Math.round(def.cout * 0.3);
  sim.book(def.activite, refund, `Récupération — ${def.nom}`, true);
  sim.touch(b.x - 2, b.y - 2, b.x + def.size + 2, b.y + def.size + 2);
  sim.refresh(true);
  sim.event(`${def.nom} démoli (${refund} € récupérés).`, 'info');
  return true;
}

export type Voie = 'chemin' | 'route' | 'pont';
export const VOIES: Record<Voie, { nom: string; cout: number; desc: string }> = {
  chemin: { nom: 'Chemin de terre', cout: PATH_COST, desc: 'Piétons et engins agricoles (au pas)' },
  route: { nom: 'Route empierrée', cout: ROAD_COST, desc: 'Plus rapide pour les engins et les voitures' },
  pont: { nom: 'Pont de bois', cout: BRIDGE_COST, desc: 'Franchit une rivière ou un étang' },
};

export function checkPath(sim: Sim, x: number, y: number, voie: Voie = 'chemin'): { ok: boolean; reason: string; cost: number } {
  const W = sim.s.world;
  if (!inside(W, x, y)) return { ok: false, reason: 'Hors de la carte', cost: 0 };
  if (!isOwned(W, x, y)) return { ok: false, reason: 'Terrain non acquis', cost: 0 };
  const i = y * W.w + x;
  const t = W.terrain[i];
  if (sim.occ[i] >= 0) return { ok: false, reason: 'Occupé par un bâtiment', cost: 0 };
  if (voie === 'pont') {
    if (t === T.mer) return { ok: false, reason: 'Pas de pont sur la mer', cost: 0 };
    if (t !== T.eau) return { ok: false, reason: 'Un pont se pose sur l\'eau', cost: 0 };
    // il doit prolonger une voie existante (chemin, route, cour ou pont)
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(W, x + dx, y + dy) && isPathLike(W.terrain[(y + dy) * W.w + x + dx]));
    if (!nb) return { ok: false, reason: 'Le pont doit prolonger un chemin ou une route', cost: 0 };
    if (sim.s.money < VOIES.pont.cout) return { ok: false, reason: 'Fonds insuffisants', cost: VOIES.pont.cout };
    return { ok: true, reason: VOIES.pont.nom, cost: VOIES.pont.cout };
  }
  if (t === T.eau || t === T.mer) return { ok: false, reason: 'Sur l\'eau : utilisez un pont', cost: 0 };
  if (t === T.route || t === T.pont || t === T.cour || (voie === 'chemin' && t === T.chemin)) return { ok: false, reason: 'Déjà praticable', cost: 0 };
  if (slopeOf(W, x, y) > 40) return { ok: false, reason: 'Pente trop forte', cost: 0 };
  const d = W.decor[i];
  if (d === D.rocher || d === D.rocherGros || d === D.maison || d === D.eglise) return { ok: false, reason: 'Obstacle', cost: 0 };
  // un chemin existant s'empierre à moindre coût
  const base = voie === 'route' && t === T.chemin ? ROAD_COST - PATH_COST : VOIES[voie].cout;
  const cost = base + (DECOR_IS_TREE(d) ? TREE_CLEAR_COST : 0);
  if (sim.s.money < cost) return { ok: false, reason: 'Fonds insuffisants', cost };
  return { ok: true, reason: VOIES[voie].nom, cost };
}

export function buildPath(sim: Sim, x: number, y: number, voie: Voie = 'chemin'): boolean {
  const c = checkPath(sim, x, y, voie);
  if (!c.ok) return false;
  const W = sim.s.world;
  const i = y * W.w + x;
  W.terrain[i] = voie === 'pont' ? T.pont : voie === 'route' ? T.route : T.chemin;
  W.decor[i] = D.none;
  sim.book('general', -c.cost, voie === 'pont' ? 'Ponts' : voie === 'route' ? 'Routes' : 'Chemins', true);
  sim.touch(x - 1, y - 1, x + 1, y + 1);
  sim.refresh(true);
  return true;
}

export function lotPrice(sim: Sim) {
  const owned = sim.s.world.owned.filter(Boolean).length;
  return LOT_PRICE + Math.max(0, owned - 9) * 1500;
}

export function canBuyLot(sim: Sim, lot: number): { ok: boolean; reason: string; cost: number } {
  const W = sim.s.world;
  const per = lotsPerRow(W);
  const cost = lotPrice(sim);
  if (W.owned[lot]) return { ok: false, reason: 'Déjà acquis', cost };
  const lx = lot % per, ly = Math.floor(lot / per);
  const adj = [[lx + 1, ly], [lx - 1, ly], [lx, ly + 1], [lx, ly - 1]].some(([a, b]) => a >= 0 && b >= 0 && a < per && b < per && W.owned[b * per + a]);
  if (!adj) return { ok: false, reason: 'Doit toucher le domaine', cost };
  if (sim.s.money < cost) return { ok: false, reason: 'Fonds insuffisants', cost };
  return { ok: true, reason: 'Disponible', cost };
}

export function buyLot(sim: Sim, lot: number): boolean {
  const c = canBuyLot(sim, lot);
  if (!c.ok) return false;
  sim.s.world.owned[lot] = true;
  sim.book('general', -c.cost, 'Achat de terrain', true);
  const per = lotsPerRow(sim.s.world);
  const lx = (lot % per) * LOT_SIZE, ly = Math.floor(lot / per) * LOT_SIZE;
  sim.touch(lx, ly, lx + LOT_SIZE, ly + LOT_SIZE);
  sim.refresh(true);
  sim.event(`Nouvelle parcelle acquise (${c.cost} €).`, 'succes');
  return true;
}

export { lotOf };

export function setPrice(sim: Sim, res: Res, price: number) {
  const base = RESOURCES[res].prix;
  // prix libre : de 20 % à 5 fois le prix de référence
  sim.s.prices[res] = round2(Math.max(base * 0.2, Math.min(base * 5, price)));
}


/** Vente au négociant : la marchandise est réservée tout de suite, payée à l'enlèvement par la camionnette. */
export function createOrder(sim: Sim, res: Res, qty: number): boolean {
  return sim.order(res, qty);
}

export function togglePriority(sim: Sim, id: number) {
  const b = sim.byId.get(id);
  if (b) b.priority = !b.priority;
}
