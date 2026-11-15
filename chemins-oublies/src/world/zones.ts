// Cartes du prologue : Clairval, le Bois des Murmures, le Moulin des Trois-Eaux et quatre intérieurs.
// Les collisions viennent des empreintes déclarées ici, indépendamment des dessins.
import type { ZoneDef, PropDef, PathDef, Pt, Rect } from './types';
import type { ZoneId } from '../core/state';
import { HOUSES } from './textures';
import { Rng } from '../core/rng';
import { distToPolyline, pointInPoly, ellipsePoly } from './geom';
import { OBJECTS } from '../data/objects';

const GRASS_VILLAGE = ['#6f9f48', '#7cab50', '#8fbb5c', '#5f9040', '#a2c56a'];
const GRASS_FOREST = ['#3f6b3a', '#4a7a40', '#5a8a48', '#355e33', '#6b9450'];

function H(name: string, x: number, y: number, extra: Partial<PropDef> = {}): PropDef {
  const o = HOUSES[name];
  const ch = o.chimney !== undefined ? ([o.chimney, -o.h - (o.d * 0.95 + 20) * 0.7 - 26] as Pt) : undefined;
  return { tex: 'house:' + name, x, y, foot: { w: o.w + 8, h: 70 }, occlude: true, smoke: ch, ...extra };
}
const T = (kind: string, seed: number, x: number, y: number, extra: Partial<PropDef> = {}): PropDef => ({ tex: `tree:${kind}:${seed}`, x, y, foot: { r: 13 }, occlude: true, sway: true, ...extra });

interface ScatterOpts {
  rect: Rect; step: number; seed: number; kinds: string[]; avoidPaths: PathDef[]; pathPad: number;
  avoidCircles: [number, number, number][]; avoidRects: Rect[]; water?: { pts: Pt[]; w: number }[]; bushChance?: number; rockChance?: number; bushPal?: string;
}
function scatter(o: ScatterOpts): PropDef[] {
  const r = new Rng(o.seed);
  const out: PropDef[] = [];
  for (let y = o.rect.y; y < o.rect.y + o.rect.h; y += o.step) {
    for (let x = o.rect.x; x < o.rect.x + o.rect.w; x += o.step) {
      const px = Math.round(x + r.range(-o.step * 0.4, o.step * 0.4)), py = Math.round(y + r.range(-o.step * 0.4, o.step * 0.4));
      const roll = r.next();
      if (o.avoidPaths.some((p) => distToPolyline(px, py, p.pts) < p.w / 2 + o.pathPad)) continue;
      if (o.avoidCircles.some(([cx, cy, cr]) => Math.hypot(px - cx, py - cy) < cr)) continue;
      if (OBJECTS.some((ob) => Math.hypot(px - ob.x, (py - ob.y) * 1.2) < 150 && px > 0)) continue;
      if (o.avoidRects.some((q) => px > q.x && px < q.x + q.w && py > q.y && py < q.y + q.h)) continue;
      if (o.water?.some((wd) => distToPolyline(px, py, wd.pts) < wd.w / 2 + 40)) continue;
      const seed = Math.floor(r.next() * 9) + 1; // variantes limitées : textures partagées
      if (roll < (o.bushChance ?? 0)) out.push({ tex: `bush:${seed}:${o.bushPal ?? 'oak'}`, x: px, y: py, foot: { r: 18 }, occlude: true });
      else if (roll < (o.bushChance ?? 0) + (o.rockChance ?? 0)) out.push({ tex: `rock:${seed}:${r.range(0.7, 1.4).toFixed(2)}:m`, x: px, y: py, foot: { r: 20 } });
      else out.push(T(r.pick(o.kinds), seed, px, py));
    }
  }
  return out;
}

function decor(seed: number, rect: Rect, n: number, avoid: (x: number, y: number) => boolean, keys: string[]): PropDef[] {
  const r = new Rng(seed);
  const out: PropDef[] = [];
  for (let i = 0; i < n * 3 && out.length < n; i++) {
    const x = Math.round(rect.x + r.next() * rect.w), y = Math.round(rect.y + r.next() * rect.h);
    if (avoid(x, y)) continue;
    const k = r.pick(keys).replace('#', String(Math.floor(r.next() * 6) + 1));
    out.push({ tex: k, x, y });
  }
  return out;
}

// ============================================================ CLAIRVAL
const vPaths: PathDef[] = [
  { kind: 'dirt', w: 70, pts: [[1330, 2260], [1330, 1950], [1310, 1650], [1300, 1400]] },
  { kind: 'dirt', w: 64, pts: [[1300, 990], [1300, 700], [1300, 400], [1300, -20]] },
  { kind: 'dirt', w: 58, pts: [[1580, 1180], [1900, 1172], [2250, 1150], [2460, 1150], [2650, 1162], [2780, 1300], [2790, 1490]] },
  { kind: 'dirt', w: 50, pts: [[1010, 1190], [760, 1165], [560, 1150], [260, 1110]] },
  { kind: 'dirt', w: 34, pts: [[580, 1150], [620, 960], [630, 790]] },
  { kind: 'dirt', w: 34, pts: [[1300, 760], [1100, 745], [960, 705]] },
  { kind: 'dirt', w: 34, pts: [[1540, 1010], [1780, 915]] },
  { kind: 'dirt', w: 30, pts: [[1780, 915], [1950, 800], [2050, 725]] },
  { kind: 'dirt', w: 34, pts: [[1560, 1330], [1740, 1475]] },
  { kind: 'dirt', w: 32, pts: [[560, 1150], [600, 1350], [635, 1525]] },
  { kind: 'dirt', w: 34, pts: [[1310, 1650], [1100, 1720], [955, 1765]] },
  { kind: 'dirt', w: 34, pts: [[1320, 1800], [1600, 1850], [1760, 1865]] },
  { kind: 'dirt', w: 32, pts: [[1900, 1172], [2000, 1350], [2070, 1485]] },
  { kind: 'dirt', w: 26, pts: [[2780, 1300], [2900, 1220], [2960, 1100]] },
  { kind: 'route', w: 56, pts: [[2650, 1162], [2600, 1000], [2600, 830], [2780, 680], [2900, 560], [3010, 470]] },
];
const vRiver = { pts: [[2380, -30], [2360, 300], [2300, 600], [2330, 900], [2350, 1150], [2330, 1450], [2400, 1800], [2470, 2270]] as Pt[], w: 112 };
const placePoly = ellipsePoly(1300, 1200, 300, 225, 22, 0.04);

const vHouses: PropDef[] = [
  H('auberge', 1300, 900), H('atelier', 860, 1090), H('archives', 1780, 900), H('poste', 1780, 1470),
  H('maisonA', 600, 780), H('maisonB', 930, 700), H('maisonC', 2050, 720), H('maisonD', 600, 1520),
  H('maisonE', 1000, 1760), H('maisonF', 1720, 1860), H('maisonG', 2090, 1480), H('mara', 2800, 1470), H('grange', 400, 1880),
];

const vReserved: Rect[] = vHouses.map((h) => ({ x: h.x - 130, y: h.y - 260, w: 260, h: 300 }));
const villageEdgeTrees = scatter({
  rect: { x: 40, y: 20, w: 2940, h: 2220 }, step: 92, seed: 31, kinds: ['oak', 'oak', 'birch', 'pine', 'oak'],
  avoidPaths: vPaths.filter((p) => p.kind !== 'route'), pathPad: 46,
  avoidCircles: [[1300, 1200, 520], [700, 1300, 300], [1000, 1500, 380], [1700, 1300, 420], [2700, 1300, 260], [2620, 950, 150], [2860, 600, 110], [1300, 500, 250], [2100, 1050, 320], [1100, 1950, 330], [1650, 650, 280], [800, 950, 250], [2780, 1600, 200], [2200, 1700, 220]],
  avoidRects: [...vReserved, { x: 80, y: 1660, w: 560, h: 520 }, { x: 2520, y: 380, w: 520, h: 300 }],
  water: [vRiver], bushChance: 0.18, rockChance: 0.05,
}).filter((p) => {
  // forêt dense sur les bords, clairsemée au centre
  const edge = p.x < 300 || p.x > 2700 || p.y < 260 || p.y > 2020;
  return edge || (p.x * 7 + p.y * 3) % 5 === 0;
});

const village: ZoneDef = {
  id: 'clairval', name: 'Clairval', w: 3008, h: 2240, grass: GRASS_VILLAGE, music: 'village', seed: 101,
  paths: vPaths,
  areas: [
    { kind: 'cobble', poly: placePoly },
    { kind: 'field', poly: [[90, 1700], [620, 1690], [640, 2140], [100, 2160]] },
    { kind: 'garden', poly: [[690, 1570], [880, 1570], [880, 1670], [690, 1670]] },
    { kind: 'garden', poly: [[440, 830], [540, 830], [540, 930], [440, 930]] },
    { kind: 'garden', poly: [[2660, 1530], [2920, 1530], [2920, 1640], [2660, 1640]] },
    { kind: 'garden', poly: [[2180, 1550], [2280, 1550], [2280, 1640], [2180, 1640]] },
    { kind: 'sand', poly: [[2250, 1600], [2300, 1600], [2320, 1700], [2240, 1700]] },
  ],
  water: [vRiver],
  bridges: [{ x: 2240, y: 1118, w: 220, h: 64 }],
  props: [
    ...vHouses,
    { tex: 'bridge:220:70', x: 2350, y: 1150, ground: true, depth: -100 },
    { tex: 'fountain', x: 1300, y: 1230, foot: { w: 176, h: 52 } },
    { tex: 'stall:c0523a:veg', x: 1080, y: 1365, foot: { w: 104, h: 26 } },
    { tex: 'stall:d9b25b:bread', x: 1210, y: 1405, foot: { w: 104, h: 26 } },
    { tex: 'stall:5f7d3c:herbs', x: 1500, y: 1395, foot: { w: 104, h: 26 } },
    { tex: 'notice', x: 1530, y: 1012, foot: { w: 60, h: 14 }, id: 'notice' },
    { tex: 'bench', x: 1110, y: 1050, foot: { w: 52, h: 14 } },
    { tex: 'bench', x: 1470, y: 1070, foot: { w: 52, h: 14 } },
    { tex: 'lamp', x: 1040, y: 1200, foot: { r: 7 } }, { tex: 'lamp', x: 1570, y: 1215, foot: { r: 7 } }, { tex: 'lamp', x: 1350, y: 1450, foot: { r: 7 } }, { tex: 'lamp', x: 1250, y: 960, foot: { r: 7 } },
    { tex: 'lamp', x: 2210, y: 1100, foot: { r: 7 } }, { tex: 'lamp', x: 1360, y: 1900, foot: { r: 7 } },
    { tex: 'well', x: 700, y: 1300, foot: { r: 30 } },
    { tex: 'barrel', x: 1460, y: 910, foot: { r: 12 } }, { tex: 'barrel', x: 1488, y: 930, foot: { r: 12 } }, { tex: 'crate:3', x: 1140, y: 915, foot: { w: 30, h: 16 } },
    { tex: 'crate:5', x: 1880, y: 1480, foot: { w: 30, h: 16 } }, { tex: 'crate:6', x: 1900, y: 1505, foot: { w: 30, h: 16 } },
    { tex: 'woodpile', x: 990, y: 1100, foot: { w: 60, h: 16 } }, { tex: 'woodpile', x: 2900, y: 1490, foot: { w: 60, h: 16 } },
    { tex: 'laundry', x: 2190, y: 1530, foot: { w: 8, h: 8 } },
    { tex: 'haystack', x: 260, y: 1830, foot: { r: 30 } }, { tex: 'haystack', x: 520, y: 2060, foot: { r: 30 } }, { tex: 'cart', x: 640, y: 2060, foot: { w: 90, h: 22 } },
    { tex: 'beehive', x: 2960, y: 1600, foot: { r: 13 } }, { tex: 'beehive', x: 2990, y: 1650, foot: { r: 13 } },
    { tex: 'fence:200', x: 780, y: 1690, foot: { w: 200, h: 10 } }, { tex: 'fence:240', x: 2790, y: 1660, foot: { w: 240, h: 10 } },
    { tex: 'fence:120', x: 1880, y: 1000 }, { tex: 'fence:140', x: 1100, y: 1880 },
    { tex: 'signpost', x: 1390, y: 1720, foot: { r: 8 }, id: 'panneau' },
    { tex: 'borne', x: 1395, y: 2050, foot: { r: 14 }, id: 'borne_arrivee' },
    { tex: 'borne', x: 1640, y: 1115, foot: { r: 14 }, id: 'borneA' },
    { tex: 'borne', x: 2640, y: 1115, foot: { r: 14 }, id: 'borneB' },
    { tex: 'borne', x: 2640, y: 815, foot: { r: 14 }, id: 'borneC' },
    { tex: 'splitrock', x: 2860, y: 595, foot: { w: 120, h: 40 }, occlude: true },
    // portail nord
    { tex: 'fence:200', x: 1140, y: 220, foot: { w: 200, h: 10 } }, { tex: 'fence:200', x: 1460, y: 220, foot: { w: 200, h: 10 } },
    { tex: 'lamp', x: 1250, y: 226, foot: { r: 8 } }, { tex: 'lamp', x: 1350, y: 226, foot: { r: 8 } },
    // ronces qui ferment la route effacée tant qu'elle n'est pas révélée
    { tex: 'bramble:180:1', x: 2930, y: 520, foot: { w: 180, h: 40 }, cond: '!route_revealed' },
    { tex: 'bramble:150:2', x: 2950, y: 430, foot: { w: 150, h: 40 }, cond: '!route_revealed' },
    { tex: 'bramble:120:3', x: 2700, y: 720, cond: '!route_revealed' },
    // fleurs et herbes
    ...decor(5, { x: 100, y: 300, w: 2800, h: 1850 }, 120, (x, y) => vPaths.some((p) => distToPolyline(x, y, p.pts) < p.w / 2 + 14) || pointInPoly(x, y, placePoly) || distToPolyline(x, y, vRiver.pts) < 80 || vReserved.some((q) => x > q.x && x < q.x + q.w && y > q.y + 200 && y < q.y + q.h), ['flowers:#', 'flowers:#:b', 'flowers:#:y', 'tuft:#', 'tuft:#']),
    { tex: 'bush:41:oak:#e58aa0', x: 1150, y: 990, foot: { r: 16 } }, { tex: 'bush:42:oak:#f6d77a', x: 1440, y: 990, foot: { r: 16 } },
    { tex: 'tree:oak:777:1.25', x: 1640, y: 1300, foot: { r: 14 }, occlude: true, sway: true },
    { tex: 'tree:willow:31', x: 2240, y: 1760, foot: { r: 15 }, occlude: true, sway: true },
    { tex: 'tree:willow:32', x: 2470, y: 860, foot: { r: 15 }, occlude: true, sway: true },
    { tex: 'tree:oak:12', x: 980, y: 1350, foot: { r: 13 }, occlude: true, sway: true },
    ...villageEdgeTrees,
  ],
  blockers: [
    { x: 0, y: 2200, w: 3008, h: 40 },
    { x: 1240, y: 196, w: 120, h: 40, cond: '!theo_ok' },
    { x: 0, y: 200, w: 1242, h: 30 }, { x: 1358, y: 200, w: 1650, h: 30 },
    { x: 2990, y: 0, w: 18, h: 2240, cond: '!route_revealed' },
  ],
  exits: [
    { rect: { x: 1230, y: 0, w: 140, h: 50 }, to: 'bois', at: [1300, 2440], facing: 'up' },
    { rect: { x: 2980, y: 380, w: 28, h: 200 }, to: 'moulin', at: [120, 1490], facing: 'right', cond: 'route_revealed' },
    { rect: { x: 1280, y: 890, w: 40, h: 26 }, to: 'auberge', at: [360, 455], facing: 'up', door: true },
    { rect: { x: 800, y: 1080, w: 40, h: 26 }, to: 'atelier', at: [360, 455], facing: 'up', door: true },
    { rect: { x: 1760, y: 890, w: 40, h: 26 }, to: 'archives', at: [360, 455], facing: 'up', door: true },
  ],
};

// ============================================================ BOIS DES MURMURES
const fPaths: PathDef[] = [
  { kind: 'forest', w: 64, pts: [[1300, 2580], [1260, 2300], [1200, 2060]] },
  { kind: 'forest', w: 56, pts: [[1200, 2060], [1180, 1880], [1100, 1700], [960, 1500]] },
  { kind: 'forest', w: 52, pts: [[960, 1500], [930, 1320], [1000, 1100], [1090, 900], [1100, 760]] },
  { kind: 'forest', w: 56, pts: [[1100, 760], [1100, 540], [1150, 300], [1150, -20]] },
  { kind: 'forest', w: 46, pts: [[1080, 1480], [1400, 1460], [1700, 1450], [1800, 1440]] },
  { kind: 'forest', w: 40, pts: [[1800, 1440], [1950, 1390], [2110, 1330]] },
  { kind: 'forest', w: 38, pts: [[1820, 1520], [1900, 1900], [1880, 2160]] },
  { kind: 'forest', w: 34, pts: [[1880, 1500], [2000, 1620], [2070, 1740]] },
  { kind: 'forest', w: 36, pts: [[900, 1470], [700, 1400], [560, 1370]] },
  { kind: 'forest', w: 34, pts: [[560, 1370], [480, 1300], [400, 1180], [300, 1000]] },
];
const fStream = { pts: [[2180, -30], [2260, 600], [2200, 1320], [2290, 1900], [2240, 2600]] as Pt[], w: 92 };
const fClearings: [number, number, number][] = [[1200, 2040, 200], [950, 1480, 185], [1100, 760, 240], [1800, 1440, 160], [1880, 2170, 150], [290, 960, 140], [2060, 1740, 90], [1150, 160, 120]];
const forestTrees = scatter({
  rect: { x: 20, y: 0, w: 3180, h: 2560 }, step: 78, seed: 57, kinds: ['pine', 'oakDark', 'pine', 'oak', 'birch', 'oakDark'],
  avoidPaths: fPaths, pathPad: 38, avoidCircles: fClearings.map(([x, y, r]) => [x, y, r + 30] as [number, number, number]),
  avoidRects: [{ x: 560, y: 1260, w: 110, h: 90 }], water: [fStream], bushChance: 0.22, rockChance: 0.07, bushPal: 'dark',
});

const bois: ZoneDef = {
  id: 'bois', name: 'Bois des Murmures', w: 3200, h: 2560, grass: GRASS_FOREST, music: 'foret', seed: 202, dark: 0.12, corridor: { pad: 34, clearings: fClearings },
  paths: fPaths,
  areas: fClearings.map(([x, y, r]) => ({ kind: 'moss' as const, poly: ellipsePoly(x, y, r * 0.9, r * 0.7, 16, 0.06) })),
  water: [fStream],
  bridges: [],
  props: [
    { tex: 'ruinbridge', x: 2200, y: 1360, foot: { w: 60, h: 20 }, id: 'pont_ruine' },
    { tex: 'borne', x: 1300, y: 1990, foot: { r: 14 }, id: 'borne_bois' },
    { tex: 'tent', x: 1860, y: 1400, foot: { w: 90, h: 34 } },
    { tex: 'fire', x: 1790, y: 1480, foot: { r: 16 }, id: 'feu_anton' },
    { tex: 'crate:9', x: 1920, y: 1460, foot: { w: 30, h: 16 } },
    { tex: 'stele', x: 1700, y: 1380, foot: { r: 12 }, id: 'stele' },
    { tex: 'carvedtree', x: 620, y: 1318, foot: { r: 15 }, occlude: true, id: 'arbre_grave' },
    { tex: 'bramble:150:7', x: 440, y: 1260, foot: { w: 150, h: 46 }, cond: '!passage_open', id: 'ronces_passage' },
    { tex: 'mist:260', x: 1150, y: 360, foot: { w: 260, h: 40 }, cond: '!stones_solved', depth: 200 },
    { tex: 'bramble:130:21', x: 935, y: 1345, foot: { w: 130, h: 40 }, cond: '!enc1_done' },
    { tex: 'bramble:90:22', x: 1140, y: 1505, foot: { w: 40, h: 150, dy: -40 }, cond: '!enc1_done' },
    { tex: 'plant:sauge', x: 2060, y: 1760, cond: '!pick_sauge' }, { tex: 'plant:pied', x: 1060, y: 2110, cond: '!pick_pied_de_loup' }, { tex: 'plant:lanterne', x: 1290, y: 640, cond: '!pick_fleur_lanterne' },
    { tex: 'stone:eau', x: 1240, y: 855, foot: { r: 18 }, id: 'pierre_eau' }, { tex: 'stone:oiseau', x: 975, y: 690, foot: { r: 18 }, id: 'pierre_oiseau' },
    { tex: 'stone:cle', x: 965, y: 860, foot: { r: 18 }, id: 'pierre_cle' }, { tex: 'stone:lune', x: 1230, y: 685, foot: { r: 18 }, id: 'pierre_lune' },
    { tex: 'rock:301:1.6:m', x: 1030, y: 610, foot: { r: 28 } }, { tex: 'rock:302:1.2:m', x: 1270, y: 900, foot: { r: 22 } },
    { tex: 'tree:dead:5', x: 1420, y: 1530, foot: { r: 10 } }, { tex: 'tree:dead:6', x: 700, y: 1560, foot: { r: 10 } },
    { tex: 'rock:303:1:m', x: 1960, y: 2240, foot: { r: 20 } }, { tex: 'chest', x: 1880, y: 2235, foot: { w: 30, h: 14 }, id: 'coffre_garde', cond: '!coffre_garde_ouvert' },
    { tex: 'chestOpen', x: 1880, y: 2235, foot: { w: 30, h: 14 }, cond: 'coffre_garde_ouvert' },
    { tex: 'chest', x: 250, y: 920, foot: { w: 30, h: 14 }, id: 'coffre_cache', cond: '!coffre_cache_ouvert' },
    { tex: 'chestOpen', x: 250, y: 920, foot: { w: 30, h: 14 }, cond: 'coffre_cache_ouvert' },
    { tex: 'signpost', x: 1240, y: 2200, foot: { r: 8 } },
    ...decor(9, { x: 100, y: 100, w: 3000, h: 2400 }, 160, (x, y) => fPaths.some((p) => distToPolyline(x, y, p.pts) < p.w / 2 + 10) || distToPolyline(x, y, fStream.pts) < 70, ['tuft:#:3f7a3a', 'tuft:#:4f8a3a', 'flowers:#:b', 'flowers:#:y']),
    ...forestTrees,
  ],
  blockers: [
    { x: 0, y: 2540, w: 1250, h: 20 }, { x: 1350, y: 2540, w: 1850, h: 20 },
    { x: 0, y: 0, w: 1080, h: 20 }, { x: 1220, y: 0, w: 1980, h: 20 },
  ],
  exits: [
    { rect: { x: 1240, y: 2520, w: 120, h: 40 }, to: 'clairval', at: [1300, 110], facing: 'down' },
    { rect: { x: 1080, y: 0, w: 140, h: 40 }, to: 'moulin', at: [400, 1690], facing: 'up', cond: 'stones_solved' },
  ],
};

// ============================================================ MOULIN DES TROIS-EAUX
const mPaths: PathDef[] = [
  { kind: 'dirt', w: 58, pts: [[400, 1820], [420, 1500], [700, 1200], [1050, 990], [1190, 935]] },
  { kind: 'dirt', w: 40, pts: [[1050, 990], [1000, 760], [1150, 560], [1350, 340], [1640, 335]] },
  { kind: 'dirt', w: 36, pts: [[1150, 560], [1390, 600], [1395, 760]] },
  { kind: 'route', w: 56, pts: [[1190, 960], [800, 1180], [420, 1400], [0, 1500]] },
  { kind: 'route', w: 56, pts: [[1190, 960], [1500, 1110], [1650, 1130]] },
  { kind: 'route', w: 56, pts: [[1850, 1130], [2050, 1100], [2400, 1060]] },
];
const mRiver = { pts: [[1950, -30], [1800, 330], [1760, 450], [1700, 900], [1790, 1350], [1950, 1830]] as Pt[], w: 150 };
const moulinTrees = scatter({
  rect: { x: 20, y: 20, w: 2360, h: 1760 }, step: 96, seed: 77, kinds: ['oak', 'birch', 'pine', 'willow', 'oak'],
  avoidPaths: mPaths, pathPad: 40,
  avoidCircles: [[1250, 800, 300], [1500, 600, 260], [1600, 380, 160], [400, 1700, 140], [700, 1000, 160], [2250, 1000, 160]],
  avoidRects: [{ x: 1380, y: 300, w: 400, h: 700 }, { x: 950, y: 820, w: 600, h: 420 }], water: [mRiver], bushChance: 0.15, rockChance: 0.07,
});

const moulin: ZoneDef = {
  id: 'moulin', name: 'Moulin des Trois-Eaux', w: 2400, h: 1800, grass: ['#6f9a48', '#77a24c', '#86b058', '#5d8a40', '#98bc62'], music: 'moulin', seed: 303,
  paths: mPaths,
  areas: [],
  water: [
    mRiver,
    { pts: [[1752, 400], [1450, 400], [1450, 775]], w: 44, channel: 'bief' },
    { pts: [[1450, 590], [1705, 615]], w: 32, channel: 'decharge' },
    { pts: [[1450, 905], [1735, 960]], w: 44, channel: 'fuite' },
  ],
  bridges: [{ x: 1610, y: 1100, w: 260, h: 60 }],
  props: [
    { tex: 'mill', x: 1250, y: 920, foot: { w: 236, h: 76 }, occlude: true, id: 'moulin_bat', cond: '!mill_running', smoke: undefined },
    { tex: 'mill:ok', x: 1250, y: 920, foot: { w: 236, h: 76 }, occlude: true, cond: 'mill_running', smoke: [-60, -300] },
    { tex: 'sluice:closed', x: 1745, y: 418, id: 'vanne1_s', depth: 10 },
    { tex: 'sluice:open', x: 1470, y: 606, id: 'vanne2_s', depth: 10 },
    { tex: 'sluice:closed', x: 1450, y: 800, id: 'vanne3_s', depth: -40 },
    { tex: 'bridge:260:60', x: 1740, y: 1130, ground: true, depth: -100, cond: 'route_revealed' },
    { tex: 'signpost', x: 2200, y: 980, foot: { r: 8 }, id: 'panneau_brume' },
    { tex: 'mist:300', x: 2330, y: 1110, depth: 300 },
    { tex: 'sacks', x: 1060, y: 940, foot: { w: 60, h: 18 } },
    { tex: 'cart', x: 960, y: 880, foot: { w: 90, h: 22 } },
    { tex: 'barrel', x: 1380, y: 950, foot: { r: 12 } },
    { tex: 'bramble:120:9', x: 820, y: 1170, cond: '!route_revealed' },
    { tex: 'bramble:140:10', x: 300, y: 1440, cond: '!route_revealed' },
    ...decor(13, { x: 100, y: 100, w: 2200, h: 1600 }, 90, (x, y) => mPaths.some((p) => distToPolyline(x, y, p.pts) < p.w / 2 + 12) || distToPolyline(x, y, mRiver.pts) < 100 || (x > 1100 && x < 1800 && y > 300 && y < 1000), ['flowers:#', 'flowers:#:y', 'tuft:#', 'tuft:#']),
    ...moulinTrees,
  ],
  blockers: [
    { x: 0, y: 0, w: 18, h: 1800, cond: '!route_revealed' },
    { x: 0, y: 0, w: 18, h: 1420, cond: 'route_revealed' }, { x: 0, y: 1580, w: 18, h: 220, cond: 'route_revealed' },
    { x: 0, y: 1782, w: 300, h: 18 }, { x: 500, y: 1782, w: 1900, h: 18 },
    { x: 2280, y: 900, w: 120, h: 300 },
    { x: 1405, y: 820, w: 70, h: 110 }, // la roue
  ],
  exits: [
    { rect: { x: 300, y: 1760, w: 200, h: 40 }, to: 'bois', at: [1150, 110], facing: 'down' },
    { rect: { x: 0, y: 1420, w: 30, h: 160 }, to: 'clairval', at: [2900, 520], facing: 'left', cond: 'route_revealed' },
    { rect: { x: 1170, y: 905, w: 44, h: 26 }, to: 'moulin_int', at: [360, 455], facing: 'up', door: true, cond: 'mill_unlocked', blockedMsg: 'La porte du moulin est fermée à clé. Le meunier doit avoir la clé.' },
  ],
};

// ============================================================ INTÉRIEURS
function room(id: ZoneId, name: string, wallStyle: 'plaster' | 'stone' | 'wood', windows: number[], deco: string, floor: 'wood' | 'stone', props: PropDef[], back: { to: ZoneId; at: Pt }): ZoneDef {
  return {
    id, name, w: 720, h: 540, interior: true, grass: ['#2a1e18'], music: 'interieur', seed: id.length * 31,
    paths: [], water: [], bridges: [],
    areas: [{ kind: floor, poly: [[30, 175], [690, 175], [690, 505], [30, 505]] }, { kind: 'rug', poly: [[300, 470], [420, 470], [420, 540], [300, 540]] }],
    walkPoly: [[46, 196], [674, 196], [674, 492], [400, 492], [400, 530], [320, 530], [320, 492], [46, 492]],
    props: [{ tex: `wall:660:${wallStyle}:${windows.join(',')}:${deco}`, x: 360, y: 178, depth: -400 }, ...props],
    blockers: [],
    exits: [{ rect: { x: 316, y: 505, w: 88, h: 35 }, to: back.to, at: back.at, facing: 'down', door: true }],
  };
}

const auberge = room('auberge', "Auberge du Pot d'Étain", 'plaster', [180, 540], 'inn', 'wood', [
  { tex: 'counter:260', x: 520, y: 300, foot: { w: 260, h: 40 } },
  { tex: 'barrelrack', x: 560, y: 210, foot: { w: 120, h: 30 } },
  { tex: 'fireplace', x: 120, y: 230, foot: { w: 120, h: 40 }, id: 'cheminee' },
  { tex: 'table:1', x: 200, y: 360, foot: { w: 90, h: 26 } }, { tex: 'table:2', x: 210, y: 460, foot: { w: 90, h: 26 } }, { tex: 'table:3', x: 450, y: 440, foot: { w: 90, h: 26 } },
  { tex: 'chair', x: 145, y: 365, foot: { r: 9 } }, { tex: 'chair', x: 258, y: 368, foot: { r: 9 } }, { tex: 'chair', x: 155, y: 465, foot: { r: 9 } }, { tex: 'chair', x: 510, y: 445, foot: { r: 9 } },
  { tex: 'pot', x: 660, y: 470, foot: { r: 10 } },
], { to: 'clairval', at: [1300, 940] });

const atelier = room('atelier', "L'atelier de Coline", 'stone', [500], 'tools', 'stone', [
  { tex: 'workbench', x: 380, y: 290, foot: { w: 150, h: 30 }, id: 'etabli' },
  { tex: 'anvil', x: 170, y: 330, foot: { r: 20 } },
  { tex: 'fireplace', x: 110, y: 230, foot: { w: 110, h: 40 } },
  { tex: 'shelf:jars:8', x: 610, y: 260, foot: { w: 96, h: 30 } },
  { tex: 'crate:4', x: 600, y: 440, foot: { w: 30, h: 16 } }, { tex: 'barrel', x: 640, y: 470, foot: { r: 12 } },
  { tex: 'woodpile', x: 130, y: 470, foot: { w: 60, h: 16 } },
], { to: 'clairval', at: [820, 1130] });

const archives = room('archives', 'Les Archives de Clairval', 'wood', [], 'maps', 'wood', [
  { tex: 'shelf:books:1', x: 90, y: 250, foot: { w: 96, h: 30 } }, { tex: 'shelf:books:2', x: 200, y: 250, foot: { w: 96, h: 30 } },
  { tex: 'shelf:books:3', x: 560, y: 250, foot: { w: 96, h: 30 }, id: 'registre' }, { tex: 'shelf:books:4', x: 660, y: 250, foot: { w: 96, h: 30 } },
  { tex: 'maptable', x: 360, y: 360, foot: { w: 140, h: 30 }, id: 'table_cartes' },
  { tex: 'desk', x: 560, y: 430, foot: { w: 110, h: 26 } }, { tex: 'chair', x: 560, y: 470, foot: { r: 9 } },
  { tex: 'pot', x: 60, y: 470, foot: { r: 10 } },
], { to: 'clairval', at: [1780, 945] });

const moulinInt = room('moulin_int', 'Intérieur du moulin', 'stone', [560], 'gears', 'wood', [
  { tex: 'millstone', x: 360, y: 300, foot: { w: 112, h: 34 }, id: 'meule' },
  { tex: 'brake:on', x: 560, y: 340, foot: { r: 16 }, id: 'frein', cond: '!brake_released' },
  { tex: 'brake:off', x: 560, y: 340, foot: { r: 16 }, cond: 'brake_released' },
  { tex: 'desk', x: 140, y: 380, foot: { w: 110, h: 26 }, id: 'bureau_meunier' },
  { tex: 'sacks', x: 600, y: 470, foot: { w: 60, h: 18 } }, { tex: 'sacks', x: 110, y: 470, foot: { w: 60, h: 18 } },
  { tex: 'stairs', x: 640, y: 230, foot: { w: 76, h: 40 } },
], { to: 'moulin', at: [1190, 960] });

export const ZONES: Record<ZoneId, ZoneDef> = { clairval: village, bois, moulin, auberge, atelier, archives, moulin_int: moulinInt };

export const ZONE_LABEL: Record<ZoneId, string> = {
  clairval: 'Clairval', bois: 'Bois des Murmures', moulin: 'Moulin des Trois-Eaux', auberge: "Auberge du Pot d'Étain", atelier: "Atelier de Coline", archives: 'Archives de Clairval', moulin_int: 'Intérieur du moulin',
};
