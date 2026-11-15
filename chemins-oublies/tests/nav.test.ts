import { NavGrid } from '../src/systems/Navigation';
import { ZONES } from '../src/world/zones';
import type { Pt } from '../src/world/types';

const flags = (set: string[]) => (f: string) => set.includes(f);

function reach(zone: keyof typeof ZONES, fl: string[], from: Pt, pts: Record<string, Pt>) {
  const g = new NavGrid(ZONES[zone], flags(fl));
  const bad: string[] = [];
  for (const [k, p] of Object.entries(pts)) {
    const t = g.freeAt(p[0], p[1]) ? p : g.nearestFree(p[0], p[1], 3);
    const path = t && g.findPath(from, t, false);
    if (!path) bad.push(k);
  }
  return bad;
}

describe('navigation', () => {
  it('Clairval : lieux clés atteignables depuis l’arrivée', () => {
    expect(reach('clairval', ['theo_ok'], [1330, 2140], {
      place: [1300, 1330], auberge: [1300, 935], atelier: [820, 1125], archives: [1780, 940], poste: [1740, 1510],
      borneA: [1640, 1150], borneB: [2640, 1160], borneC: [2640, 850], mara: [2770, 1510], porte_nord: [1300, 40], ninon: [1420, 1290],
      pecheur: [2290, 1640], fermiere: [760, 1720], pont: [2240, 1215],
    })).toEqual([]);
  });
  it('Clairval : la porte nord est fermée sans l’accord de Théodore', () => {
    expect(reach('clairval', [], [1330, 2140], { nord: [1300, 40] })).toEqual(['nord']);
  });
  it('Bois : itinéraire jusqu’aux pierres, au camp, au coffre gardé', () => {
    expect(reach('bois', [], [1300, 2440], { cercle: [1100, 800], camp: [1760, 1480] })).toEqual(['cercle', 'camp']);
    expect(reach('bois', ['enc1_done'], [1300, 2440], {
      clairiere: [1200, 2040], combat1: [950, 1480], cercle: [1100, 800], camp: [1760, 1480], pont: [2110, 1350], sauge: [2060, 1760], coffre: [1880, 2270], arbre: [620, 1365],
    })).toEqual([]);
    expect(reach('bois', ['enc1_done'], [1300, 2440], { cache: [280, 960], sortie: [1150, 60] })).toEqual(['cache', 'sortie']);
    expect(reach('bois', ['passage_open', 'stones_solved', 'enc1_done'], [1300, 2440], { cache: [280, 960], sortie: [1150, 60] })).toEqual([]);
  });
  it('Moulin : leviers, porte et route', () => {
    expect(reach('moulin', [], [400, 1690], { porte: [1190, 950], l1: [1640, 365], l2: [1395, 620], l3: [1395, 760] })).toEqual([]);
    expect(reach('moulin', ['route_revealed'], [400, 1690], { pont: [2000, 1110], ouest: [40, 1500] })).toEqual([]);
  });
  it('Intérieurs : porte → pièce', () => {
    for (const z of ['auberge', 'atelier', 'archives', 'moulin_int'] as const) expect(reach(z, [], [360, 455], { fond: [360, 230], porte: [360, 520] })).toEqual([]);
  });
  it('un chemin ne traverse jamais une case bloquée', () => {
    const g = new NavGrid(ZONES.clairval, flags(['theo_ok']));
    const p = g.findPath([1330, 2140], [1300, 935], false)!;
    let a: Pt = [1330, 2140];
    for (const b of p) { expect(g.los(a, b, false)).toBe(true); a = b; }
  });
});
