// Monde : grande grille logique avec relief, générée de façon déterministe selon la région.
import { Rng, hash2, valueNoise } from '../core/rng';
import { LOT_SIZE } from '../data/content';
import { REGION_BY_ID, type RegionDef } from '../data/regions';

export const T = { herbe: 0, pre: 1, bois: 2, eau: 3, chemin: 4, route: 5, pont: 6, cour: 7, mer: 8, sable: 9, roche: 10, champVoisin: 11, garrigue: 12 } as const;
export type TerrainId = (typeof T)[keyof typeof T];
export const TERRAIN_NAMES = ['Herbe', 'Pré', 'Sous-bois', 'Eau', 'Chemin', 'Route', 'Pont', 'Cour', 'Mer', 'Plage', 'Rochers', 'Champ voisin', 'Garrigue'];

// Décor posé sur une case (0 = aucun).
export const D = {
  none: 0, chene: 1, chataignier: 2, noyer: 3, pin: 4, bouleau: 5, buisson: 6, rocher: 7, fleurs: 8, maison: 9, cypres: 10, voiture: 11, foin: 12, puits: 13, charrette: 14, lavande: 15,
  sapin: 16, epicea: 17, hetre: 18, peuplier: 19, olivier: 20, haie: 21, eglise: 22, bateau: 23, phare: 24, meule: 25, rocherGros: 26,
} as const;
const NON_BLOCKING = new Set<number>([D.none, D.fleurs, D.lavande]);
export const DECOR_BLOCKS = (d: number) => !NON_BLOCKING.has(d);
const TREES = new Set<number>([D.chene, D.chataignier, D.noyer, D.pin, D.bouleau, D.buisson, D.cypres, D.sapin, D.epicea, D.hetre, D.peuplier, D.olivier, D.haie]);
export const DECOR_IS_TREE = (d: number) => TREES.has(d);
export const SPECIES: Record<string, number> = { chene: D.chene, chataignier: D.chataignier, noyer: D.noyer, pin: D.pin, bouleau: D.bouleau, cypres: D.cypres, sapin: D.sapin, epicea: D.epicea, hetre: D.hetre, peuplier: D.peuplier, olivierSauvage: D.olivier };

/** Cultures décoratives des fermes voisines (index stocké dans World.field). */
export const NEIGHBOR_CROPS = ['ble', 'orge', 'mais', 'tournesol', 'colza', 'betterave', 'patate', 'lavande', 'legumes', 'vigne', 'pre'];

export interface Road {
  pts: [number, number][];
  road: boolean; // route (sinon chemin)
}

export interface World {
  w: number;
  h: number;
  seed: number;
  region: string;
  terrain: Uint8Array;
  decor: Uint8Array;
  /** hauteur des sommets ((w+1)×(h+1)), en unités de 2 px */
  height: Uint8Array;
  /** culture des champs voisins (index NEIGHBOR_CROPS) ; 255 = aucune */
  field: Uint8Array;
  owned: boolean[];
  farm: [number, number];
  entry: [number, number]; // arrivée de la route principale au bord de la carte
  parking: [number, number][]; // places de stationnement des visiteurs
  parkingLot?: [number, number, number, number]; // emprise du parking goudronné (x0, y0, x1, y1)
  roads: Road[];
}

export const MAP_SIZE = 256;
export const HSCALE = 2; // px par unité de hauteur

export const idx = (w: World, x: number, y: number) => y * w.w + x;
export const inside = (w: World, x: number, y: number) => x >= 0 && y >= 0 && x < w.w && y < w.h;
export const terrainAt = (w: World, x: number, y: number) => (inside(w, x, y) ? w.terrain[y * w.w + x] : T.bois);
export const lotsPerRow = (w: World) => Math.ceil(w.w / LOT_SIZE);
export const lotOf = (w: World, x: number, y: number) => Math.floor(y / LOT_SIZE) * lotsPerRow(w) + Math.floor(x / LOT_SIZE);
export const isOwned = (w: World, x: number, y: number) => inside(w, x, y) && w.owned[lotOf(w, x, y)];
export const isPathLike = (t: number) => t === T.chemin || t === T.route || t === T.pont || t === T.cour;
export const isBuildableGround = (t: number) => t === T.herbe || t === T.pre || t === T.garrigue;
export const isWater = (t: number) => t === T.eau || t === T.mer;

/** Hauteur (px) d'un sommet de grille. */
export const vh = (w: World, x: number, y: number) => w.height[Math.max(0, Math.min(w.h, y)) * (w.w + 1) + Math.max(0, Math.min(w.w, x))] * HSCALE;

/** Hauteur (px) en un point continu (coordonnées de sommet), interpolation bilinéaire. */
export function heightAt(w: World, fx: number, fy: number): number {
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = fx - x0, ty = fy - y0;
  const a = vh(w, x0, y0), b = vh(w, x0 + 1, y0), c = vh(w, x0, y0 + 1), d = vh(w, x0 + 1, y0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}

/** Dénivelé d'une case (px). */
export function slopeOf(w: World, x: number, y: number): number {
  const a = vh(w, x, y), b = vh(w, x + 1, y), c = vh(w, x, y + 1), d = vh(w, x + 1, y + 1);
  return Math.max(a, b, c, d) - Math.min(a, b, c, d);
}

// Trace une polyligne en cases 4-connexes (raccord des chemins).
export function rasterLine(pts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  const seen = new Set<number>();
  const push = (x: number, y: number) => {
    const k = y * 100000 + x;
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

const smooth = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function fbm(x: number, y: number, scale: number, seed: number, oct = 4) {
  let v = 0, a = 0.5, s = scale, n = 0;
  for (let i = 0; i < oct; i++) {
    v += valueNoise(x, y, s, seed + i * 101) * a;
    n += a;
    a *= 0.5;
    s /= 2;
  }
  return v / n;
}

/** Disposition fixe de la cour de ferme, relative au centre du domaine (utilisée aussi par la simulation). */
export const FARM = {
  cour: { x0: -6, y0: -3, x1: 9, y1: 2 },
  maison: [-4, -6] as [number, number],
  grange: [1, -6] as [number, number],
  boutique: [7, -5] as [number, number],
  parcelle: [-3, 4] as [number, number],
  atelier: [-8, -2] as [number, number], // orientation 1 (porte côté +x)
  hangar: [11, -8] as [number, number], // orientation 1
  remise: [11, -12] as [number, number], // orientation 1
  second: [-8, 0] as [number, number], // second atelier, orientation 1
  parcelles: [[2, 4], [-3, 9]] as [number, number][], // parcelles supplémentaires
};

export function generateWorld(seed: number, regionId = 'limousin', size = MAP_SIZE): World {
  const region: RegionDef = REGION_BY_ID[regionId] ?? REGION_BY_ID.limousin;
  const w = size, h = size;
  const rng = new Rng(seed * 7919 + regionId.length);
  const N = w * h;
  const cx = Math.floor(w / 2), cy = Math.floor(h / 2);
  const world: World = {
    w, h, seed, region: region.id, terrain: new Uint8Array(N), decor: new Uint8Array(N), height: new Uint8Array((w + 1) * (h + 1)), field: new Uint8Array(N).fill(255),
    owned: [], farm: [cx, cy], entry: [w - 1, cy + 18], parking: [], roads: [],
  };
  const per = lotsPerRow(world);
  for (let i = 0; i < per * per; i++) world.owned.push(false);
  const fl = Math.floor(cx / LOT_SIZE);
  for (let ly = fl - 1; ly <= fl + 1; ly++) for (let lx = fl - 1; lx <= fl + 1; lx++) world.owned[ly * per + lx] = true;
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) world.terrain[y * w + x] = t;
  };
  const tAt = (x: number, y: number) => world.terrain[y * w + x];

  // ——— relief (hauteurs de sommets, en px) ———
  const H = new Float32Array((w + 1) * (h + 1));
  const R = region.relief;
  const mcx = w * 0.82, mcy = h * 0.2; // massif au nord-est
  const coast = (y: number) => 92 + (fbm(0, y, 30, seed + 9, 3) - 0.5) * 26;
  for (let y = 0; y <= h; y++)
    for (let x = 0; x <= w; x++) {
      let v = (fbm(x, y, R.echelle * 2.2, seed + 1) - 0.35) * R.amplitude * 1.6;
      v += (fbm(x, y, R.echelle * 0.6, seed + 2, 2) - 0.5) * R.amplitude * 0.25;
      if (R.montagne > 0) {
        const d = Math.hypot((x - mcx) / (w * 0.45), (y - mcy) / (h * 0.45));
        const ridge = 1 - Math.abs(fbm(x, y, 26, seed + 3, 3) * 2 - 1);
        v += smooth(1 - d) * R.montagne * (380 + ridge * 220);
      }
      if (region.mer) {
        const c = coast(y);
        v = Math.min(v, Math.max(0, (x - c) * 7));
        v = Math.max(v, Math.min((x - c) * 1.5, 40));
      }
      // la ferme est sur un replat
      const df = Math.hypot(x - cx, y - cy);
      const base = (fbm(cx, cy, R.echelle * 2.2, seed + 1) - 0.35) * R.amplitude * 1.6;
      const k = smooth((df - 13) / 14);
      v = base * (1 - k) + v * k;
      H[y * (w + 1) + x] = v;
    }
  // ——— eau : mer, rivières, étang ———
  if (region.mer) {
    for (let y = 0; y < h; y++) {
      const c = coast(y);
      for (let x = 0; x < w; x++) {
        if (x < c - 1) set(x, y, T.mer);
        else if (x < c + 2.5) set(x, y, hash2(Math.floor(y / 9), 1, seed) < 0.3 && H[y * (w + 1) + x + 3] > 20 ? T.roche : T.sable);
      }
    }
  }
  const rivers: [number, number][][] = [];
  for (let r = 0; r < region.rivieres; r++) {
    const pts: [number, number][] = [];
    const vertical = r % 2 === 0;
    const off = vertical ? (r === 0 ? cx - 44 : cx + 58) : cy + 50;
    for (let t = 0; t <= (vertical ? h : w); t++) {
      const o = off + Math.sin(t / 19 + seed) * 9 + Math.sin(t / 7.3 + r) * 3;
      pts.push(vertical ? [o, t] : [t, o]);
    }
    rivers.push(pts.map(([a, b]) => [Math.round(a), Math.round(b)]));
    for (let t = 0; t < pts.length; t++) {
      const [px, py] = pts[t];
      const wd = 1.4 + valueNoise(t, r, 9, seed + 5) * 1.3;
      for (let dy = -4; dy <= 4; dy++)
        for (let dx = -4; dx <= 4; dx++) {
          const x = Math.round(px + dx), y = Math.round(py + dy);
          if (x < 0 || y < 0 || x >= w || y >= h) continue;
          const d = vertical ? Math.abs(x - px) : Math.abs(y - py);
          if (d <= wd && tAt(x, y) !== T.mer) set(x, y, T.eau);
        }
    }
  }
  // étang près de la ferme
  if (!region.mer && region.id !== 'beauce') {
    const ex = cx - 15, ey = cy + 13;
    for (let y = ey - 6; y < ey + 6; y++)
      for (let x = ex - 6; x < ex + 6; x++) {
        const d = Math.hypot((x - ex) / 3.8, (y - ey) / 2.9) + (valueNoise(x, y, 2, seed) - 0.5) * 0.3;
        if (d < 1) set(x, y, T.eau);
      }
  }
  // surface de l'eau : niveau calculé sur le relief d'origine (pas de creusement en cascade)
  const H0 = Float32Array.from(H);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = tAt(x, y);
      if (t !== T.eau && t !== T.mer) continue;
      const corners = [y * (w + 1) + x, y * (w + 1) + x + 1, (y + 1) * (w + 1) + x, (y + 1) * (w + 1) + x + 1];
      const lvl = t === T.mer ? 0 : Math.max(2, Math.min(...corners.map((i) => H0[i])) - 6);
      for (const i of corners) H[i] = Math.min(H[i], lvl);
    }
  // adoucit les berges
  for (let pass = 0; pass < 2; pass++)
    for (let y = 1; y < h; y++)
      for (let x = 1; x < w; x++) {
        const i = y * (w + 1) + x;
        const m = Math.min(H[i - 1], H[i + 1], H[i - w - 1], H[i + w + 1]);
        if (H[i] - m > 40) H[i] = m + 40;
      }
  let minH = 0;
  for (const v of H) minH = Math.min(minH, v);
  for (let i = 0; i < H.length; i++) world.height[i] = Math.max(0, Math.min(255, Math.round((H[i] - minH) / HSCALE)));

  // ——— sols ———
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (tAt(x, y) !== T.herbe) continue;
      const n = valueNoise(x, y, 9, seed + 11);
      const sl = slopeOf(world, x, y);
      const top = vh(world, x, y);
      if (sl > 52 || (R.montagne > 0 && top > 470 && n > 0.45)) set(x, y, T.roche);
      else if (R.montagne > 0 && top > 330) set(x, y, n > 0.4 ? T.pre : T.herbe);
      else if (region.id === 'provence' && n < 0.42) set(x, y, T.garrigue);
      else if (n > 0.58) set(x, y, T.pre);
    }
  const farmClear = (x: number, y: number, r: number) => Math.hypot(x - cx, y - cy) < r;
  // forêts
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const t = tAt(x, y);
      if (t !== T.herbe && t !== T.pre && t !== T.garrigue) continue;
      if (farmClear(x, y, 22)) continue;
      const edge = Math.min(x, y, w - 1 - x, h - 1 - y);
      const f = fbm(x, y, 18, seed + 23, 3);
      // montagne : forêt sur les versants moyens, estives au-dessus
      const top = vh(world, x, y);
      const alt = R.montagne > 0 ? (top > 380 ? -0.3 : top > 160 ? 0.12 : 0) : 0;
      if (f > 0.62 - region.forets * 0.35 - alt || edge < 3) set(x, y, T.bois);
    }
  // cour de ferme
  const C = FARM.cour;
  for (let y = cy + C.y0; y <= cy + C.y1; y++) for (let x = cx + C.x0; x <= cx + C.x1; x++) set(x, y, T.cour);

  // ——— routes ———
  const lay = (pts: [number, number][], t: number) => {
    for (const [x, y] of rasterLine(pts)) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const cur = tAt(x, y);
      if (cur === T.cour) continue;
      set(x, y, cur === T.eau ? T.pont : cur === T.mer ? T.mer : t);
      world.decor[y * w + x] = D.none;
    }
  };
  const wander = (a: [number, number], b: [number, number], steps: number, amp: number): [number, number][] => {
    const pts: [number, number][] = [a];
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const nx = -(b[1] - a[1]), ny = b[0] - a[0];
      const L = Math.hypot(nx, ny) || 1;
      const o = (fbm(i * 7, steps, 3, seed + a[0], 2) - 0.5) * amp;
      pts.push([Math.round(a[0] + (b[0] - a[0]) * t + (nx / L) * o), Math.round(a[1] + (b[1] - a[1]) * t + (ny / L) * o)]);
    }
    pts.push(b);
    return pts;
  };
  const gate: [number, number] = [cx + C.x1 + 1, cy];
  const main = wander(world.entry, gate, 14, 26);
  world.roads.push({ pts: main, road: true });
  // villages
  const villages: [number, number][] = [];
  const vTargets: [number, number][] = [[cx + 70, cy - 62], [cx - 60, cy - 70], [cx - 40, cy + 75], [cx + 62, cy + 70]];
  for (const [vx, vy] of vTargets) {
    const x = Math.max(12, Math.min(w - 12, vx + rng.int(-10, 10))), y = Math.max(12, Math.min(h - 12, vy + rng.int(-10, 10)));
    if (isWater(tAt(x, y))) continue;
    villages.push([x, y]);
  }
  for (const v of villages) world.roads.push({ pts: wander(main[Math.floor(main.length / 2)], v, 10, 18), road: true });
  if (villages.length > 1) world.roads.push({ pts: wander(villages[0], villages[1], 12, 24), road: true });
  world.roads.push({ pts: wander([cx + C.x0 - 1, cy], [Math.max(2, cx - 110), cy + rng.int(-20, 20)], 16, 30), road: true });
  // chemins agricoles depuis la cour
  world.roads.push({ pts: [[cx + 1, cy + C.y1 + 1], [cx + 1, cy + 14], [cx - 6, cy + 18]], road: false });
  world.roads.push({ pts: [[cx + C.x1, cy - 1], [cx + 14, cy - 1], [cx + 14, cy - 12]], road: false });
  // les routes s'arrêtent au rivage
  for (const r of world.roads) {
    const tiles = rasterLine(r.pts);
    const k = tiles.findIndex(([x, y]) => inside(world, x, y) && tAt(x, y) === T.mer);
    if (k >= 0) {
      const cut = tiles.slice(0, Math.max(2, k - 2));
      r.pts = [cut[0], ...cut.filter((_, i) => i % 3 === 0 && i > 0), cut[cut.length - 1]];
    }
    lay(r.pts, r.road ? T.route : T.chemin);
  }

  // ——— villages et hameaux ———
  for (const [vx, vy] of villages) {
    const n = rng.int(7, 13);
    for (let k = 0; k < n; k++) {
      const a = rng.next() * Math.PI * 2, d = 3 + rng.next() * 7;
      const x = Math.round(vx + Math.cos(a) * d), y = Math.round(vy + Math.sin(a) * d);
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const t = tAt(x, y);
      if (isWater(t) || isPathLike(t)) continue;
      set(x, y, T.herbe);
      world.decor[y * w + x] = D.maison;
    }
    if (tAt(vx, vy) !== T.route && !isWater(tAt(vx, vy))) {
      set(vx, vy, T.cour);
      world.decor[vy * w + vx] = D.eglise;
    }
    for (let y = vy - 2; y <= vy + 2; y++) for (let x = vx - 2; x <= vx + 2; x++) if (inside(world, x, y) && tAt(x, y) === T.herbe && !world.decor[y * w + x] && hash2(x, y, seed) < 0.25) set(x, y, T.cour);
  }

  // ——— fermes voisines, reliées par des chemins de terre ———
  const roadTiles: [number, number][] = [];
  for (const r of world.roads) if (r.road) for (const t of rasterLine(r.pts)) if (inside(world, t[0], t[1]) && tAt(t[0], t[1]) === T.route) roadTiles.push(t);
  const farmsteads: [number, number][] = [];
  for (let k = 0; k < 80 && farmsteads.length < 11; k++) {
    const x = rng.int(14, w - 14), y = rng.int(14, h - 14);
    if (Math.hypot(x - cx, y - cy) < 30 || isOwned(world, x, y)) continue;
    if (farmsteads.some(([a, b]) => Math.hypot(a - x, b - y) < 32) || villages.some(([a, b]) => Math.hypot(a - x, b - y) < 22)) continue;
    let ok = true;
    for (let dy = -3; dy <= 3 && ok; dy++) for (let dx = -3; dx <= 3 && ok; dx++) {
      const t = tAt(x + dx, y + dy);
      if (isWater(t) || isPathLike(t) || t === T.roche || slopeOf(world, x + dx, y + dy) > 14) ok = false;
    }
    if (!ok) continue;
    farmsteads.push([x, y]);
    // cour en terre battue, corps de ferme, grange et meules
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 3; dx++) {
      set(x + dx, y + dy, T.cour);
      world.decor[(y + dy) * w + x + dx] = D.none;
    }
    for (const [dx, dy] of [[-3, -3], [1, -3], [-3, 1]] as [number, number][]) {
      if (isWater(tAt(x + dx, y + dy))) continue;
      set(x + dx, y + dy, T.herbe);
      world.decor[(y + dy) * w + x + dx] = D.maison;
    }
    world.decor[(y + 1) * w + x + 2] = D.meule;
    world.decor[(y + 2) * w + x + 3] = D.meule;
  }
  // chemin de terre de chaque ferme vers la route la plus proche
  const firstTrack = world.roads.length;
  for (const [fx, fy] of farmsteads) {
    let best: [number, number] | null = null, bd = 1e9;
    for (const t of roadTiles) {
      const d = Math.hypot(t[0] - fx, t[1] - fy);
      if (d < bd) (bd = d), (best = t);
    }
    if (best && bd < 90) world.roads.push({ pts: wander([fx + 3, fy], best, Math.max(4, Math.round(bd / 7)), Math.min(10, bd / 4)), road: false });
  }
  // chemins d'exploitation de propriété en propriété (domaine ↔ voisins, voisins entre eux)
  const near = (p: [number, number], list: [number, number][]) => list.filter((q) => q !== p).sort((a, b) => Math.hypot(a[0] - p[0], a[1] - p[1]) - Math.hypot(b[0] - p[0], b[1] - p[1]));
  const linked = new Set<string>();
  for (const f of farmsteads) {
    const q = near(f, farmsteads)[0];
    if (!q || Math.hypot(q[0] - f[0], q[1] - f[1]) > 75) continue;
    const key = [f, q].map((p) => p.join(',')).sort().join('|');
    if (linked.has(key)) continue;
    linked.add(key);
    world.roads.push({ pts: wander([f[0] - 2, f[1] + 2], [q[0] - 2, q[1] + 2], 8, 14), road: false });
  }
  for (const q of near([cx, cy], farmsteads).slice(0, 2)) world.roads.push({ pts: wander([cx - 6, cy + 18], [q[0], q[1] + 2], 9, 16), road: false });
  for (const r of world.roads.slice(firstTrack)) {
    const tiles = rasterLine(r.pts);
    const k = tiles.findIndex(([x, y]) => inside(world, x, y) && tAt(x, y) === T.mer);
    if (k >= 0) r.pts = r.pts.slice(0, 2);
    lay(r.pts, T.chemin);
  }

  // ——— champs des fermes voisines (hors domaine) ———
  const crops = region.champsVoisins.map((c) => NEIGHBOR_CROPS.indexOf(c)).filter((i) => i >= 0);
  for (let k = 0; k < 220; k++) {
    const fw = rng.int(6, region.id === 'beauce' || region.id === 'nord' ? 20 : 12), fh = rng.int(5, region.id === 'beauce' || region.id === 'nord' ? 18 : 10);
    const x0 = rng.int(2, w - fw - 2), y0 = rng.int(2, h - fh - 2);
    if (isOwned(world, x0, y0) || isOwned(world, x0 + fw, y0 + fh) || isOwned(world, x0 + fw, y0) || isOwned(world, x0, y0 + fh)) continue;
    let ok = true;
    for (let y = y0; y <= y0 + fh && ok; y++)
      for (let x = x0; x <= x0 + fw && ok; x++) {
        const t = tAt(x, y);
        if (!(t === T.herbe || t === T.pre || t === T.garrigue || (t === T.bois && region.forets < 0.3)) || world.decor[y * w + x] === D.maison || slopeOf(world, x, y) > 18) ok = false;
      }
    if (!ok) continue;
    const crop = crops[rng.int(0, crops.length - 1)];
    for (let y = y0; y <= y0 + fh; y++)
      for (let x = x0; x <= x0 + fw; x++) {
        const border = x === x0 || y === y0 || x === x0 + fw || y === y0 + fh;
        if (border && region.bocage) {
          set(x, y, T.herbe);
          world.decor[y * w + x] = hash2(x, y, seed + 3) < 0.8 ? D.haie : SPECIES[region.essences[0]] ?? D.chene;
        } else if (border) set(x, y, T.herbe);
        else if (NEIGHBOR_CROPS[crop] === 'pre') set(x, y, T.pre);
        else {
          set(x, y, T.champVoisin);
          world.field[y * w + x] = crop;
          world.decor[y * w + x] = D.none;
        }
      }
  }

  // ——— végétation ———
  const species = region.essences.map((s) => SPECIES[s] ?? D.chene);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (world.decor[i]) continue;
      const t = world.terrain[i];
      const r = hash2(x, y, seed + 7), r2 = hash2(x, y, seed + 13);
      // densité de forêt alentour (5×5) : lisières irrégulières plutôt qu'en escalier
      let nb = 0;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (tAt(Math.min(w - 1, Math.max(0, x + dx)), Math.min(h - 1, Math.max(0, y + dy))) === T.bois) nb++;
      const dens = nb / 25, edgeN = valueNoise(x, y, 3, seed + 21);
      if (t === T.bois) {
        const alt = vh(world, x, y);
        if (dens < 0.7 && edgeN < 0.45 - dens * 0.3) {
          if (r < 0.18) world.decor[i] = D.buisson; // trouée en lisière
        } else if (r < 0.72) {
          let sp = species[Math.floor(r2 * species.length)];
          if (alt > 300 && region.essences.includes('sapin')) sp = r2 < 0.5 ? D.sapin : D.epicea;
          world.decor[i] = sp;
        } else if (r < 0.8) world.decor[i] = D.buisson;
      } else if (t === T.herbe || t === T.pre || t === T.garrigue) {
        if (farmClear(x, y, 11)) continue;
        // arbres avancés et buissons de lisière
        if (dens > 0 && r < dens * (0.35 + edgeN * 0.5)) {
          world.decor[i] = r2 < 0.6 ? species[Math.floor(r2 * species.length)] : D.buisson;
          continue;
        }
        const n = valueNoise(x, y, 5, seed + 3);
        if (r < 0.02 + n * 0.035) world.decor[i] = r2 < 0.7 ? species[Math.floor(r2 * species.length)] : D.buisson;
        else if (r < 0.08 && t === T.pre) world.decor[i] = D.fleurs;
        else if (t === T.garrigue && r < 0.14) world.decor[i] = r2 < 0.5 ? D.buisson : D.lavande;
        else if (r > 0.994) world.decor[i] = D.rocher;
      } else if (t === T.roche) {
        if (r < 0.25) world.decor[i] = r2 < 0.5 ? D.rocherGros : D.rocher;
        else if (r < 0.32 && R.montagne > 0) world.decor[i] = D.sapin;
      } else if (t === T.champVoisin && world.field[i] !== 255 && NEIGHBOR_CROPS[world.field[i]] === 'ble' && r < 0.012) world.decor[i] = D.meule;
    }
  // peupliers le long des routes (plaines) et des rivières
  for (const rd of world.roads)
    for (const [x, y] of rasterLine(rd.pts))
      for (const [dx, dy] of [[1, 1], [-1, -1]]) {
        const xx = x + dx, yy = y + dy;
        if (!inside(world, xx, yy) || farmClear(xx, yy, 14)) continue;
        const t = tAt(xx, yy);
        if ((t === T.herbe || t === T.pre) && !world.decor[yy * w + xx] && hash2(xx, yy, seed + 31) < (region.id === 'nord' || region.id === 'beauce' ? 0.12 : 0.05)) world.decor[yy * w + xx] = region.id === 'provence' ? D.cypres : D.peuplier;
      }
  for (const rv of rivers)
    for (const [x, y] of rv)
      for (const dx of [-3, -2, 2, 3]) {
        const xx = x + dx;
        if (!inside(world, xx, y)) continue;
        const t = tAt(xx, y);
        if ((t === T.herbe || t === T.pre) && !world.decor[y * w + xx] && hash2(xx, y, seed + 99) < 0.2) world.decor[y * w + xx] = D.bouleau;
      }
  if (region.mer) {
    for (let k = 0; k < 6; k++) {
      const y = rng.int(20, h - 20);
      const x = Math.round(coast(y)) - rng.int(6, 30);
      if (inside(world, x, y) && tAt(x, y) === T.mer) world.decor[y * w + x] = D.bateau;
    }
    const py = cy - 40, px = Math.round(coast(py)) + 1;
    if (inside(world, px, py)) {
      set(px, py, T.roche);
      world.decor[py * w + px] = D.phare;
    }
  }
  // ——— cour : vie de la ferme, parking des visiteurs ———
  for (let y = cy - 7; y <= cy + 4; y++) for (let x = cx - 9; x <= cx + 12; x++) if (inside(world, x, y) && tAt(x, y) !== T.cour && !isPathLike(tAt(x, y))) world.decor[y * w + x] = D.none;
  world.decor[(cy + 0) * w + cx + 3] = D.puits;
  world.decor[(cy - 3) * w + cx + 4] = D.foin;
  world.decor[(cy - 4) * w + cx + 4] = D.foin;
  world.decor[(cy + 1) * w + cx + 7] = D.charrette;
  for (const [dx, dy] of [[-5, -6], [-5, -5], [-5, -4], [-1, -7], [0, -7]] as [number, number][]) world.decor[(cy + dy) * w + cx + dx] = D.lavande;
  // parking goudronné le long de la route principale, à l'entrée du domaine (deux rangées de places)
  const pk = main.map(([x, y]) => [x, y] as [number, number]).find(([x, y]) => Math.hypot(x - cx, y - cy) < 24 && Math.hypot(x - cx, y - cy) > 15) ?? [cx + 16, cy + 3];
  world.parkingLot = [pk[0] - 3, pk[1] - 2, pk[0] + 3, pk[1] + 2];
  for (let y = pk[1] - 2; y <= pk[1] + 2; y++)
    for (let x = pk[0] - 3; x <= pk[0] + 3; x++)
      if (inside(world, x, y) && !isWater(tAt(x, y)) && tAt(x, y) !== T.route) {
        set(x, y, T.cour);
        world.decor[y * w + x] = D.none;
      }
  // abords dégagés (pas d'arbre qui mange les places)
  for (let y = pk[1] - 4; y <= pk[1] + 3; y++) for (let x = pk[0] - 5; x <= pk[0] + 4; x++) if (inside(world, x, y) && DECOR_IS_TREE(world.decor[y * w + x])) world.decor[y * w + x] = D.none;
  for (const y of [pk[1] - 2, pk[1] + 2]) for (let x = pk[0] - 3; x <= pk[0] + 3; x++) if (inside(world, x, y) && tAt(x, y) === T.cour) world.parking.push([x, y]);
  flattenRect(world, pk[0] - 3, pk[1] - 2, pk[0] + 3, pk[1] + 2);
  // terrain plat sous la cour
  flattenRect(world, cx + C.x0 - 1, cy - 8, cx + C.x1 + 6, cy + 9);
  return world;
}

/** Aplanit un rectangle de cases (sommets compris) à leur hauteur moyenne. Retourne le volume déplacé. */
export function flattenRect(w: World, x0: number, y0: number, x1: number, y1: number): number {
  let s = 0, n = 0;
  for (let y = y0; y <= y1 + 1; y++)
    for (let x = x0; x <= x1 + 1; x++) {
      if (x < 0 || y < 0 || x > w.w || y > w.h) continue;
      s += w.height[y * (w.w + 1) + x];
      n++;
    }
  const avg = Math.round(s / Math.max(1, n));
  let moved = 0;
  for (let y = y0; y <= y1 + 1; y++)
    for (let x = x0; x <= x1 + 1; x++) {
      if (x < 0 || y < 0 || x > w.w || y > w.h) continue;
      const i = y * (w.w + 1) + x;
      moved += Math.abs(w.height[i] - avg);
      w.height[i] = avg;
    }
  return moved;
}

export function cloneWorld(w: World): World {
  return { ...w, terrain: new Uint8Array(w.terrain), decor: new Uint8Array(w.decor), height: new Uint8Array(w.height), field: new Uint8Array(w.field), owned: [...w.owned] };
}
