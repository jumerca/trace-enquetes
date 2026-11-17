// Registre des textures de décor : une clé texte → un dessin procédural (mis en cache par échelle).
import * as P from '../art/props';
import * as I from '../art/interior';
import type { PropTex } from '../art/props';
import { LW } from '../art/draw';

export const HOUSES: Record<string, P.HouseOpts> = {
  auberge: { w: 280, h: 160, d: 120, wall: '#efe0bf', roof: '#b0533c', timber: true, floors: 2, door: 0, windows: [-100, -50, 50, 100], sign: { text: 'Auberge', col: '#7a3a2a' }, chimney: -90, shutters: '#2f6a6f', flowers: true, dormer: true, lantern: true, seed: 11 },
  atelier: { w: 200, h: 115, d: 90, wall: '#d8c3a0', roof: '#7a6458', stone: true, door: -40, windows: [30, 70], sign: { text: 'Atelier', col: '#5a4030' }, chimney: 60, shutters: '#8a5a35', roofStyle: 'slate', seed: 12 },
  archives: { w: 210, h: 145, d: 100, wall: '#c9bfae', roof: '#4f5a6a', stone: true, door: 0, windows: [-70, 70], floors: 2, sign: { text: 'Archives', col: '#3a4a6a' }, shutters: '#3a4a6a', roofStyle: 'slate', dormer: true, ivy: true, seed: 13 },
  poste: { w: 175, h: 112, d: 88, wall: '#f1d98a', roof: '#a8503a', door: -40, windows: [40], sign: { text: 'Poste', col: '#3d5d8f' }, shutters: '#3d5d8f', awning: '#3d5d8f', seed: 14 },
  maisonA: { w: 180, h: 112, d: 92, wall: '#f2e6cc', roof: '#b0533c', timber: true, door: 30, windows: [-50], chimney: -40, shutters: '#4f7a5a', flowers: true, seed: 21 },
  maisonB: { w: 160, h: 104, d: 84, wall: '#e8d0b0', roof: '#8a4a35', door: -30, windows: [40], chimney: 40, shutters: '#a0503a', gable: true, timber: true, seed: 22 },
  maisonC: { w: 190, h: 130, d: 96, wall: '#efe0bf', roof: '#9a5040', timber: true, floors: 2, door: 0, windows: [-60, 60], chimney: 55, shutters: '#5a7aa8', flowers: true, seed: 23 },
  maisonD: { w: 170, h: 108, d: 90, wall: '#d9c7a8', roof: '#7a6458', stone: true, door: 35, windows: [-40], chimney: -50, shutters: '#6a8a4a', roofStyle: 'slate', ivy: true, seed: 24 },
  maisonE: { w: 195, h: 112, d: 92, wall: '#f4e2c4', roof: '#b0533c', door: -45, windows: [20, 70], chimney: 60, shutters: '#c08a3a', flowers: true, seed: 25 },
  maisonF: { w: 170, h: 104, d: 88, wall: '#e4d4b8', roof: '#a85a42', timber: true, door: 40, windows: [-40], chimney: -30, shutters: '#4f7a5a', gable: true, seed: 26 },
  maisonG: { w: 150, h: 100, d: 80, wall: '#efe3c8', roof: '#8a4a35', door: -20, windows: [35], shutters: '#7a3a6a', flowers: true, gable: true, ivy: true, seed: 27 },
  mara: { w: 175, h: 100, d: 92, wall: '#e2d2ae', roof: '#b9a05a', door: -35, windows: [40], chimney: 50, shutters: '#5f7d3c', roofStyle: 'thatch', flowers: true, seed: 28 },
  grange: { w: 210, h: 120, d: 100, wall: '#9a6a45', roof: '#7a6458', door: 0, windows: [], roofStyle: 'slate', shutters: '#5a3a26', seed: 29 },
};

function make(key: string, S: number): PropTex {
  const [k, a, b, c] = key.split(':');
  switch (k) {
    case 'tree': return P.tree(a as any, +b, S, c ? +c : 1);
    case 'bush': return P.bush(+a, S, b === 'dark' ? P.LEAF.dark : b === 'birch' ? P.LEAF.birch : P.LEAF.oak, c);
    case 'rock': return P.rock(+a, S, b ? +b : 1, c === 'm');
    case 'splitrock': return P.splitRock(S);
    case 'flowers': return P.flowerPatch(+a, S, b === 'b' ? ['#a9b8f0', '#f6f1e0'] : b === 'y' ? ['#f6d77a', '#f6f1e0'] : ['#e58aa0', '#f6d77a', '#f6f1e0']);
    case 'tuft': return P.grassTuft(+a, S, b ? '#' + b : undefined);
    case 'fence': return P.fence(+a, S, b === 'v');
    case 'barrel': return P.barrel(S);
    case 'crate': return P.crate(S, a ? +a : 1);
    case 'lamp': return P.lamp(S);
    case 'bench': return P.bench(S);
    case 'well': return P.well(S);
    case 'fountain': return P.fountain(S);
    case 'stall': return P.stall(S, '#' + a, b === 'herbs' ? ['#5c9a45', '#9fb8b0', '#c9a24a'] : b === 'bread' ? ['#d6a53a', '#c48a3a', '#e0c069'] : ['#d0503a', '#e07a3a', '#7fb956']);
    case 'signpost': return P.signpost(S, ['a', 'b']);
    case 'notice': return P.noticeBoard(S);
    case 'laundry': return P.laundry(S);
    case 'bunting': return P.bunting(+a, S);
    case 'feast': return P.feastTable(S);
    case 'woodpile': return P.woodpile(S);
    case 'haystack': return P.haystack(S);
    case 'cart': return P.cart(S);
    case 'beehive': return P.beehive(S);
    case 'chest': return P.chest(S, false);
    case 'chestOpen': return P.chest(S, true);
    case 'borne': return P.borne(S, a !== 'clean');
    case 'arrow': return P.borneArrow(S);
    case 'stone': return P.standingStone(S, a as P.Symbol, b === 'lit');
    case 'stele': return P.stele(S);
    case 'tent': return P.tent(S);
    case 'fire': return P.campfire(S, a !== 'off');
    case 'bramble': return P.brambleWall(S, +a, +b);
    case 'carvedtree': return P.carvedTree(S);
    case 'plant': return P.plant(S, a as any);
    case 'lever': return P.lever(S, a === 'on', b ? '#' + b : undefined);
    case 'sluice': return P.sluice(S, a === 'open');
    case 'ruinbridge': return P.ruinedBridge(S);
    case 'bridge': return P.woodBridge(S, +a, +b);
    case 'house': return P.house(HOUSES[a], S);
    case 'mill': return P.mill(S, a === 'ok');
    case 'wheel': return P.waterWheel(S);
    case 'mist': return P.mistWall(S, +a);
    case 'mat': return P.doormat(S);
    case 'stairs2': return P.stoneStairs(S, +a, +b);
    case 'tall': return P.tallGrass(+a, S, b ? '#' + b : undefined);
    case 'fern': return P.fern(+a, S);
    case 'fbed': return P.flowerbed(S, +a, +b);
    case 'steps': return P.steppingStones(S, +a, +b);
    // intérieurs
    case 'wall': return I.backWall(S, +a, b as any, c ? c.split(',').filter(Boolean).map(Number) : [], key.split(':')[4] ?? '');
    case 'counter': return I.counter(S, a ? +a : 220);
    case 'table': return I.table(S, a ? +a : 1);
    case 'chair': return I.chair(S);
    case 'fireplace': return I.fireplace(S, a !== 'off');
    case 'shelf': return I.shelf(S, a === 'books', b ? +b : 3);
    case 'workbench': return I.workbench(S);
    case 'anvil': return I.anvil(S);
    case 'maptable': return I.mapTable(S);
    case 'desk': return I.desk(S);
    case 'millstone': return I.millstone(S);
    case 'sacks': return I.sacks(S);
    case 'brake': return I.brake(S, a === 'on');
    case 'stairs': return I.stairs(S);
    case 'barrelrack': return I.barrelRack(S);
    case 'rug': return I.rugTex(S, +a, +b);
    case 'pot': return I.plantPot(S);
    case 'bed': return I.bed(S, '#' + (a ?? 'a6463a'));
    case 'herbs': return I.hangingHerbs(S);
    default: throw new Error('Texture inconnue : ' + key);
  }
}

const cache = new Map<string, PropTex>();
// maisons, arbres et buissons ont déjà leurs épaisseurs ; le reste du décor est épaissi
const THICK_SKIP = new Set(['house', 'mill', 'tree', 'bush', 'carvedtree', 'wall', 'flowers', 'tuft', 'mist', 'arrow', 'rug', 'tall', 'fern', 'fbed', 'steps', 'mat', 'stairs2']);
export function propTex(key: string, S: number): PropTex {
  const id = key + '@' + S;
  let t = cache.get(id);
  if (!t) {
    LW.mul = THICK_SKIP.has(key.split(':')[0]) ? 1 : 1.55;
    try { t = make(key, S); } finally { LW.mul = 1; }
    cache.set(id, t);
  }
  return t;
}
export function clearTexCache(): void { cache.clear(); }
