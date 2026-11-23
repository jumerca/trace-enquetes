// Actions du joueur : toutes validées ici (l'interface ne fait que les appeler).
import { BUILDINGS, LOT_PRICE, LOT_SIZE, PATH_COST, RESOURCES, TREE_CLEAR_COST, WHOLESALE_FACTOR, GOATS_PER_PEN, type Res } from '../data/content';
import { DECOR_IS_TREE, D, T, inside, isBuildableGround, isOwned, isPathLike, lotOf } from '../world/terrain';
import { defOf, doorOf, footprint, isParcel } from './geom';
import { dayOf, round2, type Sim } from './sim';
import type { Building } from './state';

export interface BuildCheck {
  ok: boolean;
  reason: string;
  cost: number; // coût total (bâtiment + défrichage)
  clear: number; // arbres à défricher
}

export function checkBuild(sim: Sim, type: string, x: number, y: number, rot: 0 | 1): BuildCheck {
  const def = BUILDINGS[type];
  const W = sim.s.world;
  const res = (ok: boolean, reason: string, clear = 0): BuildCheck => ({ ok, reason, cost: def ? def.cout + clear * TREE_CLEAR_COST : 0, clear });
  if (!def || !def.constructible) return res(false, 'Bâtiment inconnu');
  if (def.unique && sim.s.buildings.some((b) => b.type === type)) return res(false, 'Déjà construit');
  let clear = 0;
  for (const [fx, fy] of footprint({ x, y, type })) {
    if (!inside(W, fx, fy)) return res(false, 'Hors de la carte');
    if (!isOwned(W, fx, fy)) return res(false, 'Terrain non acquis (menu Territoire)');
    const i = fy * W.w + fx;
    if (sim.occ[i] >= 0) return res(false, 'Emplacement occupé');
    const t = W.terrain[i];
    if (!isBuildableGround(t)) return res(false, t === T.eau ? 'Impossible sur l\'eau' : isPathLike(t) ? 'Impossible sur un chemin' : 'Sol incompatible (bois)');
    const d = W.decor[i];
    if (d === D.rocher || d === D.maisonHameau) return res(false, 'Rocher ou construction existante');
    if (DECOR_IS_TREE(d)) clear++;
  }
  // accès : la porte (ou une barrière de parcelle) doit donner sur un chemin, une route ou la cour
  if (isParcel(type)) {
    const s = def.size;
    let access = false;
    for (let k = 0; k < s && !access; k++)
      for (const [ax, ay] of [[x + k, y + s], [x + s, y + k], [x + k, y - 1], [x - 1, y + k]])
        if (inside(W, ax, ay) && isPathLike(W.terrain[ay * W.w + ax])) access = true;
    if (!access) return res(false, 'Doit longer un chemin (accès)', clear);
  } else {
    const [dx, dy] = doorOf({ x, y, type, rot });
    if (!inside(W, dx, dy) || !isPathLike(W.terrain[dy * W.w + dx]) || sim.occ[dy * W.w + dx] >= 0) return res(false, 'La porte doit donner sur un chemin', clear);
  }
  const cost = def.cout + clear * TREE_CLEAR_COST;
  if (sim.s.money < cost) return { ok: false, reason: 'Fonds insuffisants', cost, clear };
  return { ok: true, reason: clear ? `Défrichage de ${clear} arbre(s) inclus` : 'Emplacement valide', cost, clear };
}

export function build(sim: Sim, type: string, x: number, y: number, rot: 0 | 1): Building | null {
  const c = checkBuild(sim, type, x, y, rot);
  if (!c.ok) return null;
  const W = sim.s.world;
  for (const [fx, fy] of footprint({ x, y, type })) W.decor[fy * W.w + fx] = D.none;
  const def = BUILDINGS[type];
  const b: Building = { id: sim.s.nextId++, type, x, y, rot, inv: {}, ready: 0, growth: 0, reaped: [], busyBy: null, priority: false, batches: 0, builtDay: dayOf(sim.s.minute) };
  sim.s.buildings.push(b);
  sim.book(def.activite, -def.cout, `Construction — ${def.nom}`, true);
  if (c.clear) sim.book('general', -c.clear * TREE_CLEAR_COST, 'Défrichage', true);
  sim.refresh();
  if (def.kind === 'enclos') for (let i = 0; i < GOATS_PER_PEN; i++) sim.addAnimal('chevre', b.id);
  if (def.kind === 'hangar') {
    const [dx, dy] = doorOf(b);
    sim.s.vehicles.push({ id: sim.s.nextId++, x: dx, y: dy, px: dx, py: dy, path: [], dir: 1, moving: false, timer: 0, steps: [], label: 'Tracteur', hidden: false, kind: 'tracteur', home: b.id, load: null, cap: 400, driver: null, order: null });
  }
  sim.s.stats.built++;
  sim.event(`${def.nom} construit (${def.cout + c.clear * TREE_CLEAR_COST} €).`, 'succes');
  return b;
}

export function demolish(sim: Sim, id: number): boolean {
  const b = sim.byId.get(id);
  if (!b || b.type === 'maison') return false;
  const def = defOf(b);
  if (def.kind === 'stock') {
    const others = sim.storages().filter((x) => x !== b);
    const content = sim.used(b);
    const room = others.reduce((a, x) => a + sim.space(x), 0);
    if (content > room) {
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
  if (def.kind === 'hangar' && sim.s.vehicles.some((v) => v.home === b.id && v.driver != null)) {
    sim.event('Le tracteur est en service : démolition reportée.', 'alerte');
    return false;
  }
  for (const w of sim.s.workers) if (w.steps.some((st) => 'b' in st && st.b === id)) sim.abort(w);
  sim.s.buildings = sim.s.buildings.filter((x) => x !== b);
  sim.s.animals = sim.s.animals.filter((a) => a.pen !== id);
  sim.s.vehicles = sim.s.vehicles.filter((v) => v.home !== id);
  const refund = Math.round(def.cout * 0.3);
  sim.book(def.activite, refund, `Récupération — ${def.nom}`, true);
  sim.refresh();
  sim.event(`${def.nom} démoli (${refund} € récupérés).`, 'info');
  return true;
}

export function checkPath(sim: Sim, x: number, y: number): { ok: boolean; reason: string; cost: number } {
  const W = sim.s.world;
  if (!inside(W, x, y)) return { ok: false, reason: 'Hors de la carte', cost: 0 };
  if (!isOwned(W, x, y)) return { ok: false, reason: 'Terrain non acquis', cost: 0 };
  const i = y * W.w + x;
  const t = W.terrain[i];
  if (sim.occ[i] >= 0) return { ok: false, reason: 'Occupé par un bâtiment', cost: 0 };
  if (isPathLike(t)) return { ok: false, reason: 'Déjà praticable', cost: 0 };
  if (t === T.eau) return { ok: false, reason: 'Pas de pont en V0.1', cost: 0 };
  const d = W.decor[i];
  if (d === D.rocher || d === D.maisonHameau) return { ok: false, reason: 'Rocher', cost: 0 };
  const cost = PATH_COST + (DECOR_IS_TREE(d) ? TREE_CLEAR_COST : 0);
  if (sim.s.money < cost) return { ok: false, reason: 'Fonds insuffisants', cost };
  return { ok: true, reason: 'Chemin de terre', cost };
}

export function buildPath(sim: Sim, x: number, y: number): boolean {
  const c = checkPath(sim, x, y);
  if (!c.ok) return false;
  const W = sim.s.world;
  const i = y * W.w + x;
  W.terrain[i] = T.chemin;
  W.decor[i] = D.none;
  sim.book('general', -c.cost, 'Chemins', true);
  sim.refresh();
  return true;
}

export function lotPrice(sim: Sim) {
  const owned = sim.s.world.owned.filter(Boolean).length;
  return LOT_PRICE + Math.max(0, owned - 4) * 1500;
}

export function canBuyLot(sim: Sim, lot: number): { ok: boolean; reason: string; cost: number } {
  const W = sim.s.world;
  const per = Math.ceil(W.w / LOT_SIZE);
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
  sim.refresh();
  sim.event(`Nouvelle parcelle acquise (${c.cost} €).`, 'succes');
  return true;
}

export { lotOf };

export function setPrice(sim: Sim, res: Res, price: number) {
  const base = RESOURCES[res].prix;
  sim.s.prices[res] = round2(Math.max(base * 0.5, Math.min(base * 2, price)));
}

export function wholesalePrice(res: Res) {
  return round2(RESOURCES[res].prix * WHOLESALE_FACTOR);
}

/** Vente au négociant : la marchandise est réservée tout de suite, payée à l'enlèvement par la camionnette. */
export function createOrder(sim: Sim, res: Res, qty: number): boolean {
  qty = Math.floor(qty);
  if (qty <= 0 || sim.stockOf(res) < qty) return false;
  let left = qty;
  for (const b of sim.storages()) left -= sim.remove(b, res, left);
  const delay = 40 + Math.floor(sim.rng.next() * 50);
  sim.s.orders.push({ id: sim.s.nextId++, res, qty, price: wholesalePrice(res), status: 'attente', createdMin: sim.s.minute, dueMin: sim.s.minute + delay });
  sim.event(`Commande négociant : ${qty} ${RESOURCES[res].unite} de ${RESOURCES[res].nom.toLowerCase()}, enlèvement d'ici ${delay} min.`, 'info');
  return true;
}

export function togglePriority(sim: Sim, id: number) {
  const b = sim.byId.get(id);
  if (b) b.priority = !b.priority;
}
