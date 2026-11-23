// Terrain du monde : grille logique, génération déterministe du paysage Corrèze/Périgord.
import { hash2, valueNoise } from '../core/rng';
import { LOT_SIZE } from '../data/content';

export const T = { herbe: 0, pre: 1, bois: 2, eau: 3, chemin: 4, route: 5, pont: 6, cour: 7 } as const;
export type TerrainId = (typeof T)[keyof typeof T];
export const TERRAIN_NAMES = ['Herbe', 'Pré', 'Sous-bois', 'Eau', 'Chemin', 'Route', 'Pont', 'Cour'];

// Éléments de décor posés sur une case (0 = aucun).
export const D = { none: 0, chene: 1, chataignier: 2, noyer: 3, pin: 4, bouleau: 5, buisson: 6, rocher: 7, fleurs: 8, maisonHameau: 9, cypres: 10, voiture: 11, foin: 12, puits: 13, charrette: 14, lavande: 15 } as const;
export const DECOR_BLOCKS = (d: number) => d !== D.none && d !== D.fleurs && d !== D.lavande;
export const DECOR_IS_TREE = (d: number) => d >= 1 && d <= 6 || d === D.cypres;

export interface World {
  w: number;
  h: number;
  seed: number;
  terrain: Uint8Array;
  decor: Uint8Array;
  owned: boolean[]; // lots de LOT_SIZE × LOT_SIZE
}

export const idx = (w: World, x: number, y: number) => y * w.w + x;
export const inside = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.w && y < w.h;
export const terrainAt = (w: World, x: number, y: number) => (inside(w, x, y) ? w.terrain[y * w.w + x] : T.bois);
export const lotOf = (w: World, x: number, y: number) => Math.floor(y / LOT_SIZE) * Math.ceil(w.w / LOT_SIZE) + Math.floor(x / LOT_SIZE);
export const isOwned = (w: World, x: number, y: number) => inside(w, x, y) && w.owned[lotOf(w, x, y)];
export const isPathLike = (t: number) => t === T.chemin || t === T.route || t === T.pont || t === T.cour;
export const isBuildableGround = (t: number) => t === T.herbe || t === T.pre;

// Trace une polyligne en cases 4-connexes (indispensable pour le raccord des tuiles de chemin).
export function rasterLine(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<number>();
  const push = (x: number, y: number) => {
    const k = y * 10000 + x;
    if (!seen.has(k)) {
      seen.add(k);
      out.push([x, y]);
    }
  };
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i + 1];
    let x = x0, y = y0;
    push(x, y);
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    // écart à la droite idéale (produit vectoriel) : on choisit le pas qui s'en écarte le moins
    const dist = (px: number, py: number) => Math.abs((x1 - x0) * (py - y0) - (y1 - y0) * (px - x0));
    while (x !== x1 || y !== y1) {
      if (x === x1) y += sy;
      else if (y === y1) x += sx;
      else if (dist(x + sx, y) <= dist(x, y + sy)) x += sx;
      else y += sy;
      push(x, y);
    }
  }
  return out;
}

export const MAP_SIZE = 96;
export const FARM_CENTER: [number, number] = [47, 46];
export const ENTRY_EAST: [number, number] = [95, 62];
export const ENTRY_WEST: [number, number] = [0, 49];
/** Parking des visiteurs : ils arrivent en voiture et repartent de là. */
export const PARKING: [number, number] = [63, 51];

export const ROAD_EAST: [number, number][] = [[95, 62], [84, 61], [74, 59], [66, 56], [60, 52], [57, 48]];
export const ROAD_WEST: [number, number][] = [[41, 46], [36, 47], [28, 48], [18, 48], [8, 49], [0, 49]];
export const ROAD_NORTH: [number, number][] = [[66, 56], [69, 46], [71, 34], [72, 24], [71, 16]];
export const HAMLET_PATHS: [number, number][][] = [
  [[71, 16], [66, 12], [70, 9]],
  [[71, 16], [75, 13]],
];
export const PATHS: [number, number][][] = [
  [[47, 48], [47, 58], [44, 60], [40, 60]],
  [[56, 45], [60, 45], [60, 36]],
];

export function generateWorld(seed: number): World {
  const w = MAP_SIZE, h = MAP_SIZE;
  const world: World = { w, h, seed, terrain: new Uint8Array(w * h), decor: new Uint8Array(w * h), owned: [] };
  const lots = Math.ceil(w / LOT_SIZE) * Math.ceil(h / LOT_SIZE);
  for (let i = 0; i < lots; i++) world.owned.push(false);
  for (const lx of [2, 3]) for (const ly of [2, 3]) world.owned[ly * Math.ceil(w / LOT_SIZE) + lx] = true;

  const set = (x: number, y: number, t: number) => {
    if (inside(world, x, y)) world.terrain[y * w + x] = t;
  };
  // Prés et herbe
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = valueNoise(x, y, 9, seed + 11);
      world.terrain[y * w + x] = n > 0.58 ? T.pre : T.herbe;
    }
  // Rivière sinueuse (ouest) : du nord au sud
  for (let y = 0; y < h; y++) {
    const cx = 21 + Math.sin(y / 11) * 4 + Math.sin(y / 5.3 + 1) * 1.4;
    const width = 1.6 + valueNoise(0, y, 7, seed + 5) * 1.1;
    for (let x = Math.floor(cx - width); x <= Math.ceil(cx + width); x++) if (Math.abs(x - cx) <= width) set(x, y, T.eau);
  }
  // Étang
  for (let y = 54; y < 64; y++)
    for (let x = 30; x < 40; x++) {
      const d = Math.hypot((x - 34.5) / 3.6, (y - 58.5) / 2.9) + (valueNoise(x, y, 2, seed) - 0.5) * 0.3;
      if (d < 1) set(x, y, T.eau);
    }
  // Lisières boisées (bordure de carte) et bosquets
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const n = valueNoise(x, y, 6, seed + 23);
      const inHamlet = x >= 62 && x <= 80 && y >= 6 && y <= 20;
      const t = world.terrain[y * w + x];
      if (t === T.eau || inHamlet) continue;
      if (edge < 4 + n * 5) world.terrain[y * w + x] = T.bois;
      else if (valueNoise(x, y, 7, seed + 41) > 0.72 && Math.hypot(x - FARM_CENTER[0], y - FARM_CENTER[1]) > 14) world.terrain[y * w + x] = T.bois;
    }
  // Cour de ferme
  for (let y = 43; y <= 48; y++) for (let x = 41; x <= 56; x++) set(x, y, T.cour);
  // Routes et chemins
  const lay = (pts: [number, number][], t: number) => {
    for (const [x, y] of rasterLine(pts)) {
      if (!inside(world, x, y)) continue;
      const cur = world.terrain[y * w + x];
      if (cur === T.cour) continue;
      set(x, y, cur === T.eau ? T.pont : t);
    }
  };
  // Parking des visiteurs, le long de la route
  for (let y = 49; y <= 51; y++) for (let x = 61; x <= 65; x++) set(x, y, T.cour);
  lay(ROAD_EAST, T.route);
  lay(ROAD_WEST, T.route);
  lay(ROAD_NORTH, T.route);
  for (const p of PATHS) lay(p, T.chemin);
  // Hameau (décor, hors domaine)
  const hamlet: [number, number][] = [[66, 10], [70, 9], [74, 11], [67, 14], [75, 15], [71, 18]];
  for (let y = 8; y <= 19; y++) for (let x = 64; x <= 78; x++) if (world.terrain[y * w + x] !== T.route && hash2(x, y, seed) < 0.02) world.decor[y * w + x] = D.fleurs;
  for (const [x, y] of hamlet) world.decor[y * w + x] = D.maisonHameau;
  for (const p of HAMLET_PATHS) lay(p, T.chemin);

  // Décor végétal
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (world.decor[i]) continue;
      const t = world.terrain[i];
      const r = hash2(x, y, seed + 7);
      const r2 = hash2(x, y, seed + 13);
      const nearFarm = Math.hypot(x - FARM_CENTER[0], y - FARM_CENTER[1]);
      if (t === T.bois) {
        if (r < 0.72) world.decor[i] = r2 < 0.42 ? D.chataignier : r2 < 0.7 ? D.chene : r2 < 0.86 ? D.pin : D.bouleau;
        else if (r < 0.8) world.decor[i] = D.buisson;
      } else if (t === T.herbe || t === T.pre) {
        if (nearFarm < 9) continue;
        const n = valueNoise(x, y, 5, seed + 3);
        if (r < 0.035 + n * 0.05) world.decor[i] = r2 < 0.45 ? D.chene : r2 < 0.65 ? D.noyer : r2 < 0.8 ? D.buisson : D.chataignier;
        else if (r < 0.1 && t === T.pre) world.decor[i] = D.fleurs;
        else if (r > 0.993) world.decor[i] = D.rocher;
      }
    }
  for (const [x, y] of [[62, 49], [64, 49], [65, 51]] as [number, number][]) world.decor[y * w + x] = D.voiture;
  // vie de la cour : puits, foin, charrette ; lavande devant le logis
  world.decor[46 * w + 49] = D.puits;
  world.decor[42 * w + 51] = D.foin;
  world.decor[41 * w + 51] = D.foin;
  world.decor[47 * w + 54] = D.charrette;
  for (const [x, y] of [[42, 40], [42, 41], [42, 42], [46, 39], [47, 39]] as [number, number][]) world.decor[y * w + x] = D.lavande;
  // Haies de cyprès et arbres d'ornement autour de la maison, rives arborées
  for (const [x, y] of [[41, 39], [41, 41], [57, 40], [57, 42], [38, 50], [52, 40]] as [number, number][]) world.decor[y * w + x] = D.cypres;
  for (let y = 0; y < h; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      if (world.terrain[i] !== T.herbe && world.terrain[i] !== T.pre) continue;
      if (world.decor[i]) continue;
      const nearWater = world.terrain[i - 1] === T.eau || world.terrain[i + 1] === T.eau;
      if (nearWater && hash2(x, y, seed + 99) < 0.22) world.decor[i] = D.bouleau;
    }
  return world;
}

export function cloneWorld(w: World): World {
  return { ...w, terrain: new Uint8Array(w.terrain), decor: new Uint8Array(w.decor), owned: [...w.owned] };
}
