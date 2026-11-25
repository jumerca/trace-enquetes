// Moteur urbain : génération de Saint-Clair (ou d'une autre ville) à partir d'une graine.
// La carte est une grille de cases isométriques. La population est agrégée par quartier ;
// seuls les lieux et les personnes utiles aux affaires sont individualisés.
import { valueNoise, type Rng } from '../core/rng';
import type { City, CitySize, District, DistrictId, Place, PlaceKind } from './types';

export const T = { herbe: 0, route: 1, trottoir: 2, place: 3, eau: 4, foret: 5, champ: 6, rail: 7, parking: 8, pave: 9 } as const;

export const SIZE_POP: Record<CitySize, number> = { commune: 5000, petite: 20000, moyenne: 80000, grande: 250000, metropole: 700000 };
export const SIZE_LABEL: Record<CitySize, string> = {
  commune: 'Commune de 5 000 habitants', petite: 'Petite ville de 20 000 habitants', moyenne: 'Ville moyenne de 80 000 habitants',
  grande: 'Grande ville de 250 000 habitants', metropole: 'Métropole de 700 000 habitants',
};

const DISTRICTS: { id: DistrictId; name: string; share: number; activity: number; rect: [number, number, number, number] }[] = [
  { id: 'centre', name: 'Centre-ville', share: 0.14, activity: 0.9, rect: [20, 20, 10, 9] },
  { id: 'vieille', name: 'Vieille ville', share: 0.08, activity: 0.7, rect: [12, 20, 8, 9] },
  { id: 'commercial', name: 'Quartier commercial', share: 0.05, activity: 0.85, rect: [30, 20, 8, 9] },
  { id: 'residentiel', name: 'Quartier résidentiel', share: 0.2, activity: 0.5, rect: [20, 29, 10, 8] },
  { id: 'pavillons', name: 'Zone pavillonnaire', share: 0.18, activity: 0.35, rect: [30, 29, 10, 8] },
  { id: 'gare', name: 'Quartier de la gare', share: 0.06, activity: 0.8, rect: [20, 12, 10, 8] },
  { id: 'industrie', name: 'Zone industrielle', share: 0.03, activity: 0.55, rect: [30, 10, 12, 10] },
  { id: 'campus', name: 'Campus universitaire', share: 0.07, activity: 0.7, rect: [8, 29, 12, 8] },
  { id: 'hopital', name: 'Pôle hospitalier', share: 0.03, activity: 0.6, rect: [12, 12, 8, 8] },
  { id: 'tourisme', name: 'Bords de rivière et château', share: 0.02, activity: 0.6, rect: [4, 18, 8, 11] },
  { id: 'rural', name: 'Campagne', share: 0.05, activity: 0.15, rect: [40, 8, 8, 30] },
  { id: 'foret', name: 'Forêt domaniale', share: 0.0, activity: 0.08, rect: [0, 0, 20, 12] },
  { id: 'villages', name: 'Villages périphériques', share: 0.08, activity: 0.25, rect: [0, 37, 48, 11] },
  { id: 'axes', name: 'Axes routiers', share: 0.01, activity: 0.4, rect: [20, 0, 20, 10] },
];

type PlaceDef = { kind: PlaceKind; name: string; d: DistrictId; open: number; close: number; closed?: number[]; floors?: number };
const PLACES: PlaceDef[] = [
  { kind: 'commissariat', name: 'Hôtel de police', d: 'centre', open: 0, close: 0, floors: 2 },
  { kind: 'mairie', name: 'Hôtel de ville', d: 'centre', open: 8, close: 17, closed: [0, 6], floors: 3 },
  { kind: 'tribunal', name: 'Tribunal judiciaire', d: 'centre', open: 8, close: 18, closed: [0, 6], floors: 3 },
  { kind: 'banque', name: 'Banque du Val', d: 'centre', open: 9, close: 17, closed: [0, 1], floors: 3 },
  { kind: 'journal', name: 'Le Courrier de Saint-Clair', d: 'centre', open: 7, close: 22, floors: 2 },
  { kind: 'bijouterie', name: 'Bijouterie Morand', d: 'centre', open: 10, close: 19, closed: [0, 1] },
  { kind: 'notaire', name: 'Étude notariale Lemaire', d: 'centre', open: 9, close: 18, closed: [0, 6], floors: 2 },
  { kind: 'restaurant', name: 'Brasserie du Beffroi', d: 'centre', open: 11, close: 23 },
  { kind: 'bar', name: 'Café des Halles', d: 'centre', open: 7, close: 1 },
  { kind: 'immeuble', name: 'Résidence du Mail', d: 'centre', open: 0, close: 0, floors: 5 },
  { kind: 'eglise', name: 'Collégiale Saint-Clair', d: 'vieille', open: 8, close: 19 },
  { kind: 'antiquaire', name: 'Antiquités Ferrand', d: 'vieille', open: 10, close: 19, closed: [0, 1] },
  { kind: 'musee', name: 'Musée des Beaux-Arts', d: 'vieille', open: 10, close: 18, closed: [2] , floors: 2 },
  { kind: 'archives', name: 'Archives municipales', d: 'vieille', open: 9, close: 17, closed: [0, 6], floors: 2 },
  { kind: 'hotel', name: 'Hôtel de la Poste', d: 'vieille', open: 0, close: 0, floors: 3 },
  { kind: 'restaurant', name: 'Auberge des Remparts', d: 'vieille', open: 12, close: 22, closed: [1] },
  { kind: 'immeuble', name: 'Immeuble rue des Tanneurs', d: 'vieille', open: 0, close: 0, floors: 4 },
  { kind: 'supermarche', name: 'Hypermarché du Val', d: 'commercial', open: 8, close: 21, closed: [0] },
  { kind: 'commerce', name: 'Galerie marchande des Tilleuls', d: 'commercial', open: 9, close: 20, closed: [0] },
  { kind: 'commerce', name: 'Électroménager Vidal', d: 'commercial', open: 9, close: 19, closed: [0] },
  { kind: 'garage', name: 'Garage du Rond-Point', d: 'commercial', open: 8, close: 19, closed: [0] },
  { kind: 'bar', name: 'Le Bowling', d: 'commercial', open: 14, close: 2 },
  { kind: 'immeuble', name: 'Cité des Peupliers', d: 'residentiel', open: 0, close: 0, floors: 6 },
  { kind: 'immeuble', name: 'Résidence Les Charmes', d: 'residentiel', open: 0, close: 0, floors: 4 },
  { kind: 'ecole', name: 'Collège Jules-Ferry', d: 'residentiel', open: 8, close: 17, closed: [0, 3, 6] },
  { kind: 'parc', name: 'Parc de la Source', d: 'residentiel', open: 7, close: 21 },
  { kind: 'commerce', name: 'Boulangerie Fournier', d: 'residentiel', open: 6, close: 20, closed: [1] },
  { kind: 'maison', name: 'Lotissement des Acacias', d: 'pavillons', open: 0, close: 0 },
  { kind: 'maison', name: 'Allée des Chênes', d: 'pavillons', open: 0, close: 0 },
  { kind: 'maison', name: 'Chemin des Vignes', d: 'pavillons', open: 0, close: 0 },
  { kind: 'commerce', name: 'Pharmacie des Acacias', d: 'pavillons', open: 9, close: 19, closed: [0] },
  { kind: 'gare', name: 'Gare SNCF', d: 'gare', open: 5, close: 1, floors: 2 },
  { kind: 'hotel', name: 'Hôtel Terminus', d: 'gare', open: 0, close: 0, floors: 4 },
  { kind: 'bar', name: 'Brasserie de la Gare', d: 'gare', open: 6, close: 0 },
  { kind: 'usine', name: 'Papeteries du Val', d: 'industrie', open: 6, close: 22, closed: [0] },
  { kind: 'usine', name: 'Mécanique Clairvalloise', d: 'industrie', open: 7, close: 19, closed: [0, 6] },
  { kind: 'entrepot', name: 'Entrepôts Logival', d: 'industrie', open: 5, close: 23 },
  { kind: 'entrepot', name: 'Déménagements Roussel', d: 'industrie', open: 7, close: 19, closed: [0] },
  { kind: 'universite', name: 'Université du Val-de-Clair', d: 'campus', open: 7, close: 22, closed: [0], floors: 3 },
  { kind: 'immeuble', name: 'Résidence universitaire', d: 'campus', open: 0, close: 0, floors: 5 },
  { kind: 'bar', name: 'Le Quartier latin', d: 'campus', open: 11, close: 2 },
  { kind: 'hopital', name: 'Centre hospitalier', d: 'hopital', open: 0, close: 0, floors: 5 },
  { kind: 'commerce', name: 'Laboratoire d\'analyses', d: 'hopital', open: 7, close: 19, closed: [0] },
  { kind: 'musee', name: 'Château de Saint-Clair', d: 'tourisme', open: 10, close: 18, floors: 3 },
  { kind: 'camping', name: 'Camping de la Rivière', d: 'tourisme', open: 0, close: 0 },
  { kind: 'restaurant', name: 'Guinguette du Moulin', d: 'tourisme', open: 11, close: 23, closed: [1] },
  { kind: 'ferme', name: 'Ferme des Grands Prés', d: 'rural', open: 0, close: 0 },
  { kind: 'ferme', name: 'Domaine de Courcelles', d: 'rural', open: 0, close: 0 },
  { kind: 'maison', name: 'Maison forestière', d: 'foret', open: 0, close: 0 },
  { kind: 'parc', name: 'Étang des Moines', d: 'foret', open: 0, close: 0 },
  { kind: 'maison', name: 'Village de Brévannes', d: 'villages', open: 0, close: 0 },
  { kind: 'maison', name: 'Village de Saint-Aubin', d: 'villages', open: 0, close: 0 },
  { kind: 'commerce', name: 'Épicerie de Brévannes', d: 'villages', open: 8, close: 19, closed: [0, 1] },
  { kind: 'garage', name: 'Station-service de la N12', d: 'axes', open: 6, close: 22 },
  { kind: 'hotel', name: 'Motel de l\'Échangeur', d: 'axes', open: 0, close: 0 },
];

export function generateCity(rng: Rng, size: CitySize, name = 'Saint-Clair'): City {
  const w = 48, h = 48;
  const tiles = new Array(w * h).fill(T.herbe);
  const pop = SIZE_POP[size];
  const districts: District[] = DISTRICTS.map((d) => ({
    id: d.id, name: d.name, population: Math.round(pop * d.share), activity: d.activity,
    x: d.rect[0], y: d.rect[1], w: d.rect[2], h: d.rect[3],
  }));
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = t;
  };
  // forêt au nord-ouest, rivière à l'ouest, champs à l'est
  // forêt et champs en masses continues (bruit lissé), pas en semis de cases isolées
  const seed = rng.int(1, 1e6);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const n = valueNoise(x, y, 5, seed);
      if (x < 20 && y < 12 && n + (12 - y) / 30 + (20 - x) / 60 > 0.62) set(x, y, T.foret);
      if (x >= 41 && n > 0.25) set(x, y, T.champ);
      if (y >= 39 && x > 6 && valueNoise(x, y, 4, seed + 1) > 0.5) set(x, y, T.champ);
    }
  for (let y = 0; y < h; y++) {
    const rx = 3 + Math.round(Math.sin(y / 6) * 1.5);
    set(rx, y, T.eau);
    set(rx + 1, y, T.eau);
  }
  // voies ferrées
  for (let x = 6; x < w; x++) set(x, 11, T.rail);
  // grille de rues : avenues tous les 4 à 5 blocs dans la ville
  const roads = new Set<number>();
  const road = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    if (tiles[y * w + x] === T.eau) tiles[y * w + x] = T.route; // ponts
    set(x, y, T.route);
    roads.add(y * w + x);
  };
  const vx = [7, 12, 16, 20, 25, 30, 35, 40, 44];
  const hy = [6, 13, 17, 20, 24, 29, 33, 37, 42];
  for (const x of vx) for (let y = x === 44 || x === 7 ? 4 : 6; y < (x === 7 || x === 44 ? 45 : 41); y++) road(x, y);
  for (const y of hy) for (let x = y === 6 || y === 42 ? 4 : 7; x < (y === 6 || y === 42 ? 46 : 45); x++) road(x, y);
  // nationale vers le nord
  for (let y = 0; y < 13; y++) road(28, y);
  for (let x = 44; x < w; x++) road(x, 24);
  // places pavées et trottoirs en ville
  for (let y = 12; y < 38; y++)
    for (let x = 8; x < 41; x++) {
      const i = y * w + x;
      if (tiles[i] === T.herbe && (roads.has(i - 1) || roads.has(i + 1) || roads.has(i - w) || roads.has(i + w))) tiles[i] = T.trottoir;
    }
  for (let y = 21; y < 24; y++) for (let x = 21; x < 25; x++) set(x, y, T.place);
  for (let y = 21; y < 24; y++) for (let x = 13; x < 16; x++) set(x, y, T.pave);
  // lieux : placés sur des cases libres de leur quartier, au bord d'une rue
  const used = new Set<number>();
  const places: Place[] = [];
  let n = 0;
  for (const p of PLACES) {
    const d = districts.find((x) => x.id === p.d)!;
    let best: [number, number] | null = null;
    for (let k = 0; k < 400 && !best; k++) {
      const x = d.x + rng.int(0, d.w - 1), y = d.y + rng.int(0, d.h - 1);
      if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue;
      const i = y * w + x;
      if (roads.has(i) || tiles[i] === T.eau || tiles[i] === T.rail || used.has(i) || tiles[i] === T.place) continue;
      const nearRoad = roads.has(i - 1) || roads.has(i + 1) || roads.has(i - w) || roads.has(i + w);
      if (!nearRoad && k < 300) continue;
      best = [x, y];
    }
    if (!best) continue;
    used.add(best[1] * w + best[0]);
    tiles[best[1] * w + best[0]] = T.trottoir;
    places.push({
      id: `P${++n}`, name: p.name, kind: p.kind, district: p.d, x: best[0], y: best[1], open: p.open, close: p.close,
      closedDays: p.closed ?? [], floors: p.floors ?? 1,
    });
  }
  return { name, population: pop, size, w, h, tiles, districts, places, roads: [...roads] };
}

export function placeOpen(p: Place, weekday: number, hour: number): boolean {
  if (p.open === p.close) return true;
  if (p.closedDays.includes(weekday)) return false;
  return p.open < p.close ? hour >= p.open && hour < p.close : hour >= p.open || hour < p.close;
}

/** Activité d'un quartier à une heure donnée (pour la répartition des incidents et l'animation). */
export function districtActivity(d: District, weekday: number, hour: number, season: string): number {
  let a = d.activity;
  const night = hour < 6 || hour >= 22;
  if (d.id === 'campus' && (weekday === 0 || season === 'ete')) a *= 0.4;
  if (d.id === 'tourisme' && season === 'ete') a *= 2.2;
  if ((d.id === 'centre' || d.id === 'commercial') && night) a *= 0.35;
  if (d.id === 'pavillons' && hour >= 9 && hour < 17 && weekday > 0 && weekday < 6) a *= 1.6; // logements vides en journée
  if (d.id === 'industrie' && (weekday === 0 || night)) a *= 0.6;
  if (d.id === 'gare') a *= hour >= 6 && hour < 9 ? 1.5 : 1;
  return a;
}

export function placesOf(city: City, kinds: PlaceKind[], district?: DistrictId): Place[] {
  return city.places.filter((p) => kinds.includes(p.kind) && (!district || p.district === district));
}

export function districtName(city: City, id: DistrictId) {
  return city.districts.find((d) => d.id === id)?.name ?? id;
}

/** Recherche de chemin sur le réseau routier (A* 4-connexe), pour les véhicules. */
export function roadPath(city: City, from: number, to: number): number[] {
  const roads = new Set(city.roads);
  const w = city.w;
  const nearest = (i: number) => {
    if (roads.has(i)) return i;
    let best = -1, bd = 1e9;
    for (const r of city.roads) {
      const d = Math.abs((r % w) - (i % w)) + Math.abs(Math.floor(r / w) - Math.floor(i / w));
      if (d < bd) { bd = d; best = r; }
    }
    return best;
  };
  const a = nearest(from), b = nearest(to);
  return astar(a, b, (i) => [i - 1, i + 1, i - w, i + w].filter((j) => roads.has(j) && Math.abs((j % w) - (i % w)) <= 1), (i) => Math.abs((i % w) - (b % w)) + Math.abs(Math.floor(i / w) - Math.floor(b / w)));
}

/** A* générique sur des nœuds entiers. */
export function astar(start: number, goal: number, neighbors: (i: number) => number[], h: (i: number) => number, cost: (a: number, b: number) => number = () => 1): number[] {
  if (start === goal) return [start];
  const open = new MinHeap();
  const g = new Map<number, number>([[start, 0]]);
  const came = new Map<number, number>();
  open.push(start, h(start));
  const closed = new Set<number>();
  let guard = 0;
  while (open.size && guard++ < 20000) {
    const cur = open.pop()!;
    if (cur === goal) {
      const path = [cur];
      let c = cur;
      while (came.has(c)) { c = came.get(c)!; path.push(c); }
      return path.reverse();
    }
    if (closed.has(cur)) continue;
    closed.add(cur);
    for (const nb of neighbors(cur)) {
      const ng = g.get(cur)! + cost(cur, nb);
      if (ng < (g.get(nb) ?? Infinity)) {
        g.set(nb, ng);
        came.set(nb, cur);
        open.push(nb, ng + h(nb));
      }
    }
  }
  return [];
}

class MinHeap {
  private a: [number, number][] = [];
  get size() { return this.a.length; }
  push(v: number, p: number) {
    const a = this.a;
    a.push([v, p]);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1;
      if (a[j][1] <= a[i][1]) break;
      [a[i], a[j]] = [a[j], a[i]];
      i = j;
    }
  }
  pop(): number | undefined {
    const a = this.a;
    if (!a.length) return undefined;
    const top = a[0][0];
    const last = a.pop()!;
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][1] < a[m][1]) m = l;
        if (r < a.length && a[r][1] < a[m][1]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]];
        i = m;
      }
    }
    return top;
  }
}
