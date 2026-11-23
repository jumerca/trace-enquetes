// Géométrie des bâtiments et coûts de navigation par type d'agent.
import { BUILDINGS, type BuildingDef } from '../data/content';
import { DECOR_BLOCKS, T, type World } from '../world/terrain';
import type { Building } from './state';

export const defOf = (b: Building): BuildingDef => BUILDINGS[b.type];

export function footprint(b: { x: number; y: number; type: string }): [number, number][] {
  const s = BUILDINGS[b.type].size;
  const out: [number, number][] = [];
  for (let y = b.y; y < b.y + s; y++) for (let x = b.x; x < b.x + s; x++) out.push([x, y]);
  return out;
}

/** Case d'accès devant la porte (hors emprise). Les parcelles ont une barrière choisie à la pose. */
export function doorOf(b: { x: number; y: number; type: string; rot: 0 | 1 }): [number, number] {
  const s = BUILDINGS[b.type].size;
  return b.rot === 0 ? [b.x + (s >> 1), b.y + s] : [b.x + s, b.y + (s >> 1)];
}

export const isParcel = (type: string) => {
  const k = BUILDINGS[type].kind;
  return k === 'verger' || k === 'champ' || k === 'enclos';
};

export function buildOccupancy(world: World, buildings: Building[]): Int32Array {
  const occ = new Int32Array(world.w * world.h).fill(-1);
  for (const b of buildings) for (const [x, y] of footprint(b)) occ[y * world.w + x] = b.id;
  return occ;
}

const BASE_COST = [2.2, 2.4, 3.6, Infinity, 1, 1, 1, 1]; // par terrain (T.*)

export type NavKind = 'worker' | 'visitor' | 'vehicle';

export function makeCost(world: World, occ: Int32Array, byId: Map<number, Building>, kind: NavKind, fieldAllowed = -1) {
  const w = world.w;
  return (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= world.h) return Infinity;
    const i = y * w + x;
    const t = world.terrain[i];
    const o = occ[i];
    if (o >= 0) {
      const b = byId.get(o)!;
      const k = BUILDINGS[b.type].kind;
      if (kind === 'worker' && (k === 'verger' || k === 'champ')) return 2.5;
      if (kind === 'vehicle' && k === 'champ' && (fieldAllowed === -1 || fieldAllowed === o)) return 1.6;
      return Infinity;
    }
    if (DECOR_BLOCKS(world.decor[i])) return Infinity;
    if (kind === 'vehicle') return t === T.route || t === T.pont || t === T.cour ? 1 : t === T.chemin ? 1.3 : Infinity;
    return BASE_COST[t];
  };
}
