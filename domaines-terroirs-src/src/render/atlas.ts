// Regroupe les peintures en pages d'atlas (peu de textures GPU → peu de draw calls).
import { CanvasSource, Rectangle, Texture } from 'pixi.js';
import {
  paintBuilding, paintCar, paintLavender, paintProp, paintCarry, paintFence, paintFlowers, paintGoat, paintHen, paintPerson, paintRock, paintTile, paintTractor, paintTree, paintVan,
  RES, ROLE_LOOKS, VISITOR_LOOKS, type Painted, type Season, type TileKind,
} from './paint';

export interface Tex {
  tex: Texture;
  ax: number; // ancre normalisée
  ay: number;
}

const PAGE = 2048;

export class Atlas {
  map = new Map<string, Tex>();
  pages: CanvasSource[] = [];
  private items: { key: string; c: HTMLCanvasElement; ax: number; ay: number }[] = [];

  add(key: string, p: Painted | HTMLCanvasElement) {
    if (p instanceof HTMLCanvasElement) this.items.push({ key, c: p, ax: 0.5, ay: 0 });
    else this.items.push({ key, c: p.canvas, ax: (p.ax * RES) / p.canvas.width, ay: (p.ay * RES) / p.canvas.height });
  }

  /** Empaquetage par étagères, du plus haut au plus bas. */
  pack() {
    const items = [...this.items].sort((a, b) => b.c.height - a.c.height);
    let page: HTMLCanvasElement | null = null;
    let ctx: CanvasRenderingContext2D | null = null;
    let x = 0, y = 0, rowH = 0;
    const placed: { key: string; page: number; x: number; y: number; w: number; h: number; ax: number; ay: number }[] = [];
    const pages: HTMLCanvasElement[] = [];
    const newPage = () => {
      page = document.createElement('canvas');
      page.width = PAGE;
      page.height = PAGE;
      ctx = page.getContext('2d')!;
      pages.push(page);
      x = 0;
      y = 0;
      rowH = 0;
    };
    newPage();
    for (const it of items) {
      const w = it.c.width + 2, h = it.c.height + 2;
      if (x + w > PAGE) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      if (y + h > PAGE) newPage();
      ctx!.drawImage(it.c, x + 1, y + 1);
      placed.push({ key: it.key, page: pages.length - 1, x: x + 1, y: y + 1, w: it.c.width, h: it.c.height, ax: it.ax, ay: it.ay });
      x += w;
      rowH = Math.max(rowH, h);
    }
    // recadre la dernière page pour économiser la mémoire
    const last = pages[pages.length - 1];
    const usedH = Math.min(PAGE, Math.pow(2, Math.ceil(Math.log2(y + rowH + 2))));
    if (usedH < PAGE) {
      const c = document.createElement('canvas');
      c.width = PAGE;
      c.height = usedH;
      c.getContext('2d')!.drawImage(last, 0, 0);
      pages[pages.length - 1] = c;
    }
    for (const s of this.pages) s.destroy();
    this.pages = pages.map((p) => new CanvasSource({ resource: p, resolution: RES, scaleMode: 'linear' }));
    for (const p of this.pages) p.autoGenerateMipmaps = false;
    const next = new Map<string, Tex>();
    for (const p of placed) {
      const tex = new Texture({ source: this.pages[p.page], frame: new Rectangle(p.x / RES, p.y / RES, p.w / RES, p.h / RES) });
      next.set(p.key, { tex, ax: p.ax, ay: p.ay });
    }
    this.map = next;
    this.items = [];
  }

  get(key: string): Tex {
    const t = this.map.get(key);
    if (!t) throw new Error('texture manquante : ' + key);
    return t;
  }
}

export const TREE_KEYS: Record<number, [string, number]> = {
  1: ['chene', 3],
  2: ['chataignier', 3],
  3: ['noyer', 2],
  4: ['pin', 2],
  5: ['bouleau', 2],
  6: ['buisson', 3],
  10: ['cypres', 1],
};

export const MIRROR_PAINTED = new Set(['pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil']);

export const PERSON_KEYS = [...Object.keys(ROLE_LOOKS), ...VISITOR_LOOKS.map((_, i) => 'v' + i)];

/** Peint l'ensemble des assets pour une saison donnée. */
export function buildAtlas(atlas: Atlas, season: Season) {
  const tiles: [TileKind, number][] = [['herbe', 4], ['pre', 4], ['bois', 4], ['cour', 4], ['verger', 2], ['enclos', 2]];
  for (let m = 1; m < 16; m++) for (let v = 0; v < 2; v++) atlas.add(`t:cour:${v}:${m}`, paintTile('cour', v, season, m));
  for (const [k, n] of tiles) for (let v = 0; v < n; v++) atlas.add(`t:${k}:${v}`, paintTile(k, v, season));
  for (let m = 0; m < 16; m++) {
    atlas.add(`t:chemin:${m}`, paintTile('chemin', m, season, m));
    atlas.add(`t:route:${m}`, paintTile('route', m, season, m));
    atlas.add(`t:eau:${m}`, paintTile('eau', m, season, m));
  }
  atlas.add('t:pont:x', paintTile('pont', 0, season, 5));
  atlas.add('t:pont:y', paintTile('pont', 0, season, 10));
  for (let st = 0; st < 6; st++) for (let v = 0; v < 2; v++) atlas.add(`t:champ:${st}:${v}`, paintTile('champ', v, season, 0, st));
  for (const [, [sp, n]] of Object.entries(TREE_KEYS)) for (let v = 0; v < n; v++) atlas.add(`tree:${sp}:${v}`, paintTree(sp as never, v, season));
  for (let f = 0; f < 4; f++) for (let v = 0; v < 2; v++) atlas.add(`pommier:${f}:${v}`, paintTree('pommier', v, season, season === 1 || season === 2 ? f : 0));
  for (let v = 0; v < 2; v++) atlas.add(`rock:${v}`, paintRock(v, season));
  for (let v = 0; v < 3; v++) atlas.add(`flowers:${v}`, paintFlowers(v, season));
  for (let m = 1; m < 16; m++) atlas.add(`fence:${m}`, paintFence(m, season));
  for (let v = 0; v < 2; v++) atlas.add(`lavande:${v}`, paintLavender(v, season));
}

/** Assets indépendants de la saison (bâtiments, personnages, véhicules). */
export function buildStaticAtlas(atlas: Atlas) {
  for (const b of ['maison', 'grange', 'hangar', 'pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil', 'hameau0', 'hameau1', 'abri']) {
    atlas.add(`b:${b}`, paintBuilding(b));
    // variante en miroir peinte à part : les enseignes restent lisibles
    if (MIRROR_PAINTED.has(b)) atlas.add(`b:${b}:m`, paintBuilding(b, true));
  }
  const looks = [...Object.entries(ROLE_LOOKS), ...VISITOR_LOOKS.map((l, i) => ['v' + i, l] as const)];
  for (const [k, look] of looks) for (const f of [0, 1] as const) for (let fr = 0; fr < 5; fr++) atlas.add(`p:${k}:${f}:${fr}`, paintPerson(look, f, fr));
  for (let l = 0; l < 3; l++) for (const f of [0, 1] as const) for (let fr = 0; fr < 2; fr++) atlas.add(`goat:${l}:${f}:${fr}`, paintGoat(l, f, fr));
  for (let l = 0; l < 3; l++) for (let fr = 0; fr < 2; fr++) atlas.add(`hen:${l}:${fr}`, paintHen(l, fr));
  for (const f of [0, 1] as const) {
    atlas.add(`tracteur:${f}:0`, paintTractor(f, false));
    atlas.add(`tracteur:${f}:1`, paintTractor(f, true));
    atlas.add(`camionnette:${f}`, paintVan(f));
  }
  for (let v = 0; v < 3; v++) atlas.add(`car:${v}`, paintCar(v));
  for (const k of ['puits', 'foin', 'charrette'] as const) atlas.add(`prop:${k}`, paintProp(k));
  for (const r of ['pommes', 'jus', 'lait', 'fromage', 'ble', 'farine', 'pain']) atlas.add(`carry:${r}`, paintCarry(r));
}
