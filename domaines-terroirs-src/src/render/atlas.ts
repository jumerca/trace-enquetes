// Regroupe les peintures en pages d'atlas (peu de textures GPU → peu de draw calls).
import { CanvasSource, ImageSource, Rectangle, Texture, TextureSource } from 'pixi.js';
import { RESOURCES } from '../data/content';
import {
  paintBuilding, paintCarry, paintFence, paintFlowers, paintGoat, paintHen, paintLavender, paintPerson, paintProp, paintRock, paintTile, paintTree,
  RES, ROLE_LOOKS, VISITOR_LOOKS, crate, canvas, type Painted, type Season,
} from './paint';
import { paintAnimal, paintBale, paintBoat, paintBoulder, paintBuilding2, paintCrop, paintGround, paintSea, paintTree2, paintVine, type CropLook } from './paint2';

export interface Tex {
  tex: Texture;
  ax: number; // ancre normalisée
  ay: number;
}

const PAGE = 2048;

export class Atlas {
  map = new Map<string, Tex>();
  pages: TextureSource[] = [];
  /** coordonnées UV des cadres (sol en maillage) */
  uv = new Map<string, [number, number, number, number]>();
  private items: { key: string; c: HTMLCanvasElement; ax: number; ay: number }[] = [];

  add(key: string, p: Painted | HTMLCanvasElement) {
    if (p instanceof HTMLCanvasElement) this.items.push({ key, c: p, ax: 0.5, ay: 0 });
    else this.items.push({ key, c: p.canvas, ax: (p.ax * RES) / p.canvas.width, ay: (p.ay * RES) / p.canvas.height });
  }

  /** Empaquetage par étagères, du plus haut au plus bas. maxPages : refuse de déborder (sol). */
  pack(maxPages = 99) {
    const items = [...this.items].sort((a, b) => b.c.height - a.c.height);
    let ctx: CanvasRenderingContext2D | null = null;
    let x = 0, y = 0, rowH = 0;
    const placed: { key: string; page: number; x: number; y: number; w: number; h: number; ax: number; ay: number }[] = [];
    const pages: HTMLCanvasElement[] = [];
    const newPage = () => {
      const page = document.createElement('canvas');
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
      if (y + h > PAGE) {
        if (pages.length >= maxPages) throw new Error('atlas plein');
        newPage();
      }
      ctx!.drawImage(it.c, x + 1, y + 1);
      placed.push({ key: it.key, page: pages.length - 1, x: x + 1, y: y + 1, w: it.c.width, h: it.c.height, ax: it.ax, ay: it.ay });
      x += w;
      rowH = Math.max(rowH, h);
    }
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
    const next = new Map<string, Tex>();
    this.uv.clear();
    for (const p of placed) {
      const tex = new Texture({ source: this.pages[p.page], frame: new Rectangle(p.x / RES, p.y / RES, p.w / RES, p.h / RES) });
      next.set(p.key, { tex, ax: p.ax, ay: p.ay });
      const pw = pages[p.page].width, ph = pages[p.page].height;
      this.uv.set(p.key, [p.x / pw, p.y / ph, p.w / pw, p.h / ph]);
    }
    this.map = next;
    this.items = [];
  }

  /** Planches pré-cuites (PNG + JSON) : les véhicules 3D. */
  async load(dir: string, name = 'vehicules') {
    const meta = await (await fetch(`${dir}/${name}.json`)).json();
    const srcs: TextureSource[] = [];
    for (let i = 0; i < meta.pages; i++) {
      const img = new Image();
      img.src = `${dir}/${name}-${i}.png`;
      await img.decode();
      const src = new ImageSource({ resource: img, resolution: meta.res, scaleMode: 'linear' });
      this.pages.push(src);
      srcs.push(src);
    }
    for (const [key, f] of Object.entries(meta.frames as Record<string, { p: number; x: number; y: number; w: number; h: number; ax: number; ay: number }>)) {
      const tex = new Texture({ source: srcs[f.p], frame: new Rectangle(f.x / meta.res, f.y / meta.res, f.w / meta.res, f.h / meta.res) });
      this.map.set(key, { tex, ax: (f.ax * meta.res) / f.w, ay: (f.ay * meta.res) / f.h });
    }
  }
}

export const CROP_LOOKS: CropLook[] = ['cereale', 'mais', 'tournesol', 'colza', 'betterave', 'patate', 'lavande', 'legumes', 'vigne', 'pre'];

/** Sol (une seule page, exigée par le maillage) — selon la saison. */
export function buildGroundAtlas(atlas: Atlas, season: Season) {
  for (const [k, n] of [['herbe', 4], ['pre', 4], ['bois', 4], ['cour', 4], ['verger', 2], ['enclos', 2]] as const) for (let v = 0; v < n; v++) atlas.add(`t:${k}:${v}`, paintTile(k, v, season));
  for (const k of ['sable', 'roche', 'garrigue', 'neige'] as const) for (let v = 0; v < 2; v++) atlas.add(`t:${k}:${v}`, paintGround(k, v, season));
  for (let m = 1; m < 16; m++) for (let v = 0; v < 2; v++) atlas.add(`t:cour:${v}:${m}`, paintTile('cour', v, season, m));
  for (let m = 0; m < 16; m++) {
    atlas.add(`t:chemin:${m}`, paintTile('chemin', m, season, m));
    atlas.add(`t:route:${m}`, paintTile('route', m, season, m));
    atlas.add(`t:eau:${m}`, paintTile('eau', m, season, m));
    atlas.add(`t:mer:${m}`, paintSea(m, m));
  }
  for (const look of CROP_LOOKS) for (let st = 0; st < 6; st++) for (let v = 0; v < 2; v++) atlas.add(`c:${look}:${st}:${v}`, paintCrop(look, st, v, season));
  atlas.pack(1);
}

export const TREE_SPECIES: Record<string, { n: number; v2?: boolean }> = {
  chene: { n: 3 }, chataignier: { n: 3 }, noyer: { n: 2 }, pin: { n: 2 }, bouleau: { n: 2 }, buisson: { n: 3 }, cypres: { n: 1 },
  sapin: { n: 2, v2: true }, epicea: { n: 2, v2: true }, hetre: { n: 2, v2: true }, peuplier: { n: 2, v2: true }, olivier: { n: 2, v2: true }, haie: { n: 2, v2: true },
};

/** Décor végétal et arbres de verger — selon la saison. */
export function buildObjectAtlas(atlas: Atlas, season: Season) {
  for (const [sp, d] of Object.entries(TREE_SPECIES)) for (let v = 0; v < d.n; v++) atlas.add(`tree:${sp}:${v}`, d.v2 ? paintTree2(sp, v, season) : paintTree(sp as never, v, season));
  const fruitSeason = season === 1 || season === 2;
  for (let f = 0; f < 4; f++)
    for (let v = 0; v < 2; v++) {
      atlas.add(`fruit:pommier:${f}:${v}`, paintTree('pommier', v, season, fruitSeason ? f : 0));
      for (const sp of ['prunier', 'mirabellier', 'olivier'] as const) atlas.add(`fruit:${sp}:${f}:${v}`, paintTree2(sp, v, season, sp === 'olivier' || fruitSeason ? f : 0));
      atlas.add(`fruit:noyer:${f}:${v}`, paintTree2('noyerV', v, season, season === 2 ? f : 0));
      atlas.add(`fruit:vigne:${f}:${v}`, paintVine(season, season === 2 || season === 1 ? f : 0, v));
    }
  for (let v = 0; v < 2; v++) {
    atlas.add(`rock:${v}`, paintRock(v, season));
    atlas.add(`boulder:${v}`, paintBoulder(v, season));
    atlas.add(`lavande:${v}`, paintLavender(v, season));
  }
  for (let v = 0; v < 3; v++) atlas.add(`flowers:${v}`, paintFlowers(v, season));
  atlas.add('bale:0', paintBale(0, season));
  for (let m = 1; m < 16; m++) atlas.add(`fence:${m}`, paintFence(m, season));
  atlas.pack();
}

export const MIRROR_PAINTED = new Set(['pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil', 'brasserie', 'chai', 'huilerie', 'distillerie', 'conserverie', 'charcuterie']);
const BUILDING_TYPES = ['maison', 'grange', 'hangar', 'remise', 'pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil', 'brasserie', 'chai', 'huilerie', 'distillerie', 'conserverie', 'charcuterie'];
const SHELTERS = ['abri', 'etable', 'bergerie', 'poulailler', 'porcherie'];

function paintAny(type: string): Painted {
  return paintBuilding2(type) ?? paintBuilding(type);
}

/** Bâtiments au style de la région, personnages, animaux. */
export function buildStaticAtlas(atlas: Atlas) {
  for (const b of [...BUILDING_TYPES, ...SHELTERS, 'eglise', 'phare']) {
    atlas.add(`b:${b}`, paintAny(b));
    if (MIRROR_PAINTED.has(b)) atlas.add(`b:${b}:m`, paintBuilding2Mirrored(b));
  }
  for (let v = 0; v < 4; v++) atlas.add(`b:hameau${v}`, paintBuilding(`hameau${v % 2}`, v >= 2));
  for (let v = 0; v < 3; v++) atlas.add(`boat:${v}`, paintBoat(v));
  for (const k of ['puits', 'foin', 'charrette'] as const) atlas.add(`prop:${k}`, paintProp(k));
  const looks = [...Object.entries(ROLE_LOOKS), ...VISITOR_LOOKS.map((l, i) => ['v' + i, l] as const)];
  for (const [k, look] of looks) for (const f of [0, 1] as const) for (let fr = 0; fr < 5; fr++) atlas.add(`p:${k}:${f}:${fr}`, paintPerson(look, f, fr));
  for (let l = 0; l < 3; l++)
    for (const f of [0, 1] as const)
      for (let fr = 0; fr < 2; fr++) {
        atlas.add(`animal:chevre:${l}:${f}:${fr}`, paintGoat(l, f, fr));
        for (const k of ['vache', 'brebis', 'cochon', 'canard', 'ruche']) atlas.add(`animal:${k}:${l}:${f}:${fr}`, paintAnimal(k, l, f, fr));
      }
  for (let l = 0; l < 3; l++) for (let fr = 0; fr < 2; fr++) atlas.add(`animal:poule:${l}:${fr}`, paintHen(l, fr));
  for (const r of Object.keys(RESOURCES)) atlas.add(`carry:${r}`, carryFor(r));
  atlas.pack();
}

function carryFor(r: string): Painted {
  if (['pommes', 'jus', 'lait', 'fromage', 'ble', 'farine', 'pain'].includes(r)) return paintCarry(r);
  if (r === 'lait_chevre') return paintCarry('lait');
  if (r === 'orge' || r === 'mais' || r === 'tournesol' || r === 'colza') return paintCarry('ble');
  const [c, ctx] = canvas(16, 14);
  crate(ctx, 8, 13, RESOURCES[r].couleur);
  return { canvas: c, ax: 8, ay: 13 };
}

/** Variante en miroir (orientation 1) : enseignes lisibles. */
function paintBuilding2Mirrored(type: string): Painted {
  return paintBuilding(type, true);
}
