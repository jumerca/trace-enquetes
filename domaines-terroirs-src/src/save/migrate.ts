// Reprise d'une sauvegarde V0.1 (carte 96×96, Limousin) dans le monde de la V0.2.
// La carte ayant changé, on recrée un domaine en Limousin avec la même graine puis on y transfère
// l'essentiel : date, argent, stocks, personnel, statistiques ; les bâtiments supplémentaires sont
// replacés près de la ferme quand c'est possible, sinon remboursés.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BUILDINGS, LOT_PRICE, RESOURCES, ROLES, type Res, type Role } from '../data/content';
import { Sim, newGame, round2 } from '../sim/sim';
import { checkBuild, build } from '../sim/actions';
import { doorOf } from '../sim/geom';
import type { GameState } from '../sim/state';

const RES_MAP: Record<string, Res> = { pommes: 'pommes', jus: 'jus', lait: 'lait_chevre', fromage: 'fromage_chevre', ble: 'ble', farine: 'farine', pain: 'pain' };
const TYPE_MAP: Record<string, string> = { verger: 'verger_pommier', champ: 'champ_ble', enclos: 'elevage_chevres' };
const V1_INITIAL = ['maison', 'grange', 'pressoir', 'boutique', 'verger'];

const mapRes = (o: Record<string, number> | undefined) => {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(o ?? {})) if (RES_MAP[k] && typeof v === 'number') out[RES_MAP[k]] = round2((out[RES_MAP[k]] ?? 0) + v);
  return out;
};

export function migrateV1(old: any): GameState {
  const s = newGame(old.seed ?? 1789, 'limousin');
  const sim = new Sim(s);
  s.minute = Math.max(s.minute, old.minute ?? 0);
  s.money = round2(old.money ?? s.money);
  s.reputation = old.reputation ?? s.reputation;
  s.satisfaction = old.satisfaction ?? s.satisfaction;
  if (['soleil', 'nuageux', 'pluie', 'orage', 'neige'].includes(old.weather)) s.weather = old.weather;
  s.visitFee = old.visitFee ?? s.visitFee;
  for (const [k, v] of Object.entries(old.prices ?? {})) if (RES_MAP[k] && typeof v === 'number') s.prices[RES_MAP[k]] = v;
  s.tutorial = old.tutorial ?? 0;
  s.stats = {
    harvested: mapRes(old.stats?.harvested),
    produced: mapRes(old.stats?.produced),
    sold: mapRes(old.stats?.sold),
    batches: old.stats?.batches ?? 0,
    built: old.stats?.built ?? 0,
    visitors: old.stats?.visitors ?? 0,
  };
  // stocks : la grange reçoit tout ce qui était stocké ou en rayon (la boutique est réassortie ensuite)
  const grange = s.buildings.find((b) => b.type === 'grange')!;
  const shop = s.buildings.find((b) => b.type === 'boutique')!;
  grange.inv = {};
  shop.inv = {};
  const bTypes: string[] = [];
  for (const b of old.buildings ?? []) {
    bTypes.push(b.type);
    const inv = mapRes(b.inv);
    for (const [r, q] of Object.entries(inv)) sim.add(b.type === 'boutique' ? shop : grange, r, q);
  }
  // personnel : mêmes personnes et mêmes rôles
  const home = s.buildings.find((b) => b.type === 'maison')!;
  const [hx, hy] = doorOf(home);
  if (Array.isArray(old.workers) && old.workers.length) {
    s.workers = [];
    for (const w of old.workers) {
      const role: Role = (ROLES as Record<string, unknown>)[w.role] ? w.role : 'cultivateur';
      const nw = sim.hire(role, w.nom, true)!;
      nw.x = hx;
      nw.y = hy;
    }
  }
  // bâtiments construits en V0.1 au-delà de la ferme de départ : replacés ou remboursés
  const extra = [...bTypes];
  for (const t of V1_INITIAL) {
    const i = extra.indexOf(t);
    if (i >= 0) extra.splice(i, 1);
  }
  const refund: string[] = [];
  const [cx, cy] = s.world.farm;
  for (const oldType of extra) {
    const type = TYPE_MAP[oldType] ?? oldType;
    const def = BUILDINGS[type];
    if (!def || !def.constructible) continue;
    let placed = false;
    const keep = s.money;
    s.money = 1e9; // déjà payé en V0.1
    search: for (let r = 4; r < 24; r++)
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const rot of [0, 1] as const)
            if (checkBuild(sim, type, cx + dx, cy + dy, rot).ok && build(sim, type, cx + dx, cy + dy, rot)) {
              placed = true;
              break search;
            }
        }
    s.money = keep;
    if (!placed) {
      s.money = round2(s.money + def.cout);
      refund.push(def.nom);
    }
  }
  // les écritures de construction de la reprise ne comptent pas : on repart d'un journal propre
  s.ledger = [{ day: Math.floor(s.minute / 1440), rev: {}, cost: {}, invest: 0, lines: [] }];
  // terrains achetés en V0.1 (au-delà des 4 lots d'origine) : remboursés
  const lots = Array.isArray(old.world?.owned) ? old.world.owned.filter(Boolean).length - 4 : 0;
  if (lots > 0) s.money = round2(s.money + lots * LOT_PRICE);
  s.events = [];
  sim.event('Partie reprise depuis la V0.1 : le domaine a été réinstallé en Limousin sur la nouvelle carte (argent, stocks, personnel et statistiques conservés).', 'succes');
  if (refund.length) sim.event(`Remboursés faute de place : ${refund.join(', ')}.`, 'info');
  if (lots > 0) sim.event(`${lots} terrain(s) acheté(s) en V0.1 remboursé(s) (${lots * LOT_PRICE} €).`, 'info');
  s.rng = sim.rng.state;
  void RESOURCES;
  return s;
}
