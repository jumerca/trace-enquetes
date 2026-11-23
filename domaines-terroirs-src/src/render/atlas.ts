// Regroupe les peintures en pages d'atlas (peu de textures GPU → peu de draw calls).
import { CanvasSource, ImageSource, Rectangle, Texture, TextureSource } from 'pixi.js';
import { BUILDINGS, RESOURCES } from '../data/content';
import {
  paintBuilding, paintHouse, paintCarry, paintFence, paintFlowers, paintGoat, paintHen, paintLavender, paintPerson, paintProp, paintRock, paintTile, paintTree,
  RES, ROLE_LOOKS, VISITOR_LOOKS, crate, canvas, type Painted, type Season,
} from './paint';
import { paintAnimal, paintBale, paintBoat, paintBoulder, paintBuilding2, paintCrop, paintGround, paintSea, paintTree2, paintVine, type CropLook } from './paint2';

export interface Tex {
  tex: Texture;
  ax: number; // ancre normalisée
  ay: number;
}

const PAGE = 2048;

type Paintable = Painted | HTMLCanvasElement;

interface Item {
  key: string;
  paint: () => Paintable;
  c?: HTMLCanvasElement;
  ax: number;
  ay: number;
}

/** Préparation progressive d'un atlas (peinture puis assemblage, par tranches de temps). */
export interface AtlasJob {
  items: Item[];
  maxPages: number;
  i: number; // prochain élément à peindre
  placed: { key: string; page: number; x: number; y: number; w: number; h: number; ax: number; ay: number }[] | null;
  pages: HTMLCanvasElement[];
  d: number; // prochain élément à recopier dans les pages
  heights: number[];
  sources: TextureSource[] | null; // textures prêtes (avant l'échange)
  map: Map<string, Tex> | null;
  uv: Map<string, [number, number, number, number]> | null;
  avg: Map<string, [number, number, number]>;
  done: boolean;
}

export class Atlas {
  map = new Map<string, Tex>();
  pages: TextureSource[] = [];
  /** coordonnées UV des cadres (sol en maillage) */
  uv = new Map<string, [number, number, number, number]>();
  private items: Item[] = [];
  /** couleur moyenne de chaque élément (sol : fondu des cases voisines) */
  avg = new Map<string, [number, number, number]>();
  measure = false;

  /** Ajoute un élément ; la peinture peut être différée (fonction) pour une préparation progressive. */
  add(key: string, p: Paintable | (() => Paintable)) {
    this.items.push({ key, paint: typeof p === 'function' ? p : () => p, ax: 0.5, ay: 0 });
  }

  start(maxPages = 99): AtlasJob {
    const job: AtlasJob = { items: this.items, maxPages, i: 0, placed: null, pages: [], d: 0, heights: [], sources: null, map: null, uv: null, avg: new Map(), done: false, measure: this.measure } as AtlasJob & { measure: boolean };
    this.items = [];
    return job;
  }

  /** Avance la préparation pendant au plus budgetMs ; renvoie vrai quand tout est prêt. */
  step(job: AtlasJob, budgetMs: number): boolean {
    const t0 = performance.now();
    while (job.i < job.items.length) {
      const it = job.items[job.i++];
      const p = it.paint();
      if (p instanceof HTMLCanvasElement) it.c = p;
      else {
        it.c = p.canvas;
        it.ax = (p.ax * RES) / p.canvas.width;
        it.ay = (p.ay * RES) / p.canvas.height;
      }
      if ((job as AtlasJob & { measure?: boolean }).measure) {
        const d = it.c.getContext('2d')!.getImageData(0, 0, it.c.width, it.c.height).data;
        let R = 0, G = 0, B = 0, n = 0;
        for (let o = 0; o < d.length; o += 8)
          if (d[o + 3] > 200) {
            R += d[o];
            G += d[o + 1];
            B += d[o + 2];
            n++;
          }
        if (n) job.avg.set(it.key, [R / n, G / n, B / n]);
      }
      if (performance.now() - t0 > budgetMs) return false;
    }
    if (!job.placed) {
      // disposition (rapide) : étagères, du plus haut au plus bas
      const items = [...job.items].sort((a, b) => b.c!.height - a.c!.height || (a.key < b.key ? -1 : 1));
      job.placed = [];
      let x = 0, y = 0, rowH = 0, page = 0;
      const heights: number[] = [];
      for (const it of items) {
        const w = it.c!.width + 2, h = it.c!.height + 2;
        if (x + w > PAGE) {
          x = 0;
          y += rowH;
          rowH = 0;
        }
        if (y + h > PAGE) {
          if (page + 1 >= job.maxPages) throw new Error('atlas plein');
          heights[page] = PAGE;
          page++;
          x = 0;
          y = 0;
          rowH = 0;
        }
        job.placed.push({ key: it.key, page, x: x + 1, y: y + 1, w: it.c!.width, h: it.c!.height, ax: it.ax, ay: it.ay });
        x += w;
        rowH = Math.max(rowH, h);
      }
      heights[page] = Math.min(PAGE, Math.pow(2, Math.ceil(Math.log2(y + rowH + 2))));
      job.heights = heights;
      if (performance.now() - t0 > budgetMs) return false;
    }
    // pages créées une par tranche (allocations lourdes)
    while (job.pages.length < job.heights.length) {
      const c = document.createElement('canvas');
      c.width = PAGE;
      c.height = job.heights[job.pages.length];
      job.pages.push(c);
      if (performance.now() - t0 > budgetMs) return false;
    }
    const byKey = new Map(job.items.map((it) => [it.key, it]));
    while (job.d < job.placed.length) {
      const p = job.placed[job.d++];
      const it = byKey.get(p.key)!;
      job.pages[p.page].getContext('2d')!.drawImage(it.c!, p.x, p.y);
      it.c = undefined; // la toile intermédiaire peut être libérée
      if (performance.now() - t0 > budgetMs && job.d < job.placed.length) return false;
    }
    if (!job.sources) {
      // sources prêtes avant l'échange (dans une tranche à part)
      if (job.d >= job.placed.length && performance.now() - t0 > 0.5) return false;
      job.sources = job.pages.map((p) => new CanvasSource({ resource: p, resolution: RES, scaleMode: 'linear' }));
      job.map = new Map();
      job.uv = new Map();
      return false;
    }
    // textures (cadres) créées par lots
    let k = job.map!.size;
    while (k < job.placed.length) {
      const p = job.placed[k++];
      job.map!.set(p.key, { tex: new Texture({ source: job.sources[p.page], frame: new Rectangle(p.x / RES, p.y / RES, p.w / RES, p.h / RES) }), ax: p.ax, ay: p.ay });
      const pc = job.pages[p.page];
      job.uv!.set(p.key, [p.x / pc.width, p.y / pc.height, p.w / pc.width, p.h / pc.height]);
      if (performance.now() - t0 > budgetMs && k < job.placed.length) return false;
    }
    job.done = true;
    return true;
  }

  /** Installe le résultat d'une préparation : simple échange de références. */
  commit(job: AtlasJob) {
    while (!job.done) this.step(job, Infinity);
    const old = this.pages;
    this.pages = job.sources!;
    this.map = job.map!;
    this.uv = job.uv!;
    this.avg = job.avg;
    return old; // anciennes pages : à détruire quand plus aucun sprite ne les utilise
  }

  /** Préparation immédiate (chargement initial). */
  pack(maxPages = 99) {
    for (const s of this.commit(this.start(maxPages))) s.destroy();
  }

  /** Planches pré-cuites (PNG + JSON) : les véhicules 3D. */
  async load(dir: string, name = 'vehicules') {
    const meta = await (await fetch(`${dir}/${name}.json`)).json();
    const srcs: TextureSource[] = [];
    for (let i = 0; i < meta.pages; i++) {
      const img = new Image();
      img.src = `${dir}/${name}-${i}.${meta.ext ?? 'png'}`;
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
  for (const [k, n] of [['herbe', 4], ['pre', 4], ['bois', 4], ['cour', 4], ['verger', 2], ['enclos', 2]] as const) for (let v = 0; v < n; v++) atlas.add(`t:${k}:${v}`, () => paintTile(k, v, season));
  for (const k of ['sable', 'roche', 'garrigue', 'neige'] as const) for (let v = 0; v < 2; v++) atlas.add(`t:${k}:${v}`, () => paintGround(k, v, season));
  for (let m = 1; m < 16; m++) for (let v = 0; v < 2; v++) atlas.add(`t:cour:${v}:${m}`, () => paintTile('cour', v, season, m));
  for (let m = 0; m < 16; m++) {
    atlas.add(`t:chemin:${m}`, () => paintTile('chemin', m, season, m));
    atlas.add(`t:route:${m}`, () => paintTile('route', m, season, m));
    atlas.add(`t:eau:${m}`, () => paintTile('eau', m, season, m));
    atlas.add(`t:mer:${m}`, () => paintSea(m, m));
  }
  for (const look of CROP_LOOKS) for (let st = 0; st < 6; st++) for (let v = 0; v < 2; v++) atlas.add(`c:${look}:${st}:${v}`, () => paintCrop(look, st, v, season));
}

export const TREE_SPECIES: Record<string, { n: number; v2?: boolean }> = {
  chene: { n: 3 }, chataignier: { n: 3 }, noyer: { n: 2 }, pin: { n: 2 }, bouleau: { n: 2 }, buisson: { n: 3 }, cypres: { n: 1 },
  sapin: { n: 2, v2: true }, epicea: { n: 2, v2: true }, hetre: { n: 2, v2: true }, peuplier: { n: 2, v2: true }, olivier: { n: 2, v2: true }, haie: { n: 2, v2: true },
};

/** Décor végétal et arbres de verger — selon la saison. */
export function buildObjectAtlas(atlas: Atlas, season: Season, treesBaked = false) {
  // arbres et vergers : planche 3D pré-cuite si disponible, sinon dessinés
  if (!treesBaked) for (const [sp, d] of Object.entries(TREE_SPECIES)) for (let v = 0; v < d.n; v++) atlas.add(`tree:${sp}:${v}`, () => d.v2 ? paintTree2(sp, v, season) : paintTree(sp as never, v, season));
  const fruitSeason = season === 1 || season === 2;
  for (let f = 0; f < 4 && !treesBaked; f++)
    for (let v = 0; v < 2; v++) {
      atlas.add(`fruit:pommier:${f}:${v}`, () => paintTree('pommier', v, season, fruitSeason ? f : 0));
      for (const sp of ['prunier', 'mirabellier', 'olivier'] as const) atlas.add(`fruit:${sp}:${f}:${v}`, () => paintTree2(sp, v, season, sp === 'olivier' || fruitSeason ? f : 0));
      atlas.add(`fruit:noyer:${f}:${v}`, () => paintTree2('noyerV', v, season, season === 2 ? f : 0));
      atlas.add(`fruit:vigne:${f}:${v}`, () => paintVine(season, season === 2 || season === 1 ? f : 0, v));
    }
  for (let v = 0; v < 2; v++) {
    atlas.add(`rock:${v}`, () => paintRock(v, season));
    atlas.add(`boulder:${v}`, () => paintBoulder(v, season));
    atlas.add(`lavande:${v}`, () => paintLavender(v, season));
  }
  for (let v = 0; v < 3; v++) atlas.add(`flowers:${v}`, () => paintFlowers(v, season));
  atlas.add('bale:0', () => paintBale(0, season));
  for (let m = 1; m < 16; m++) atlas.add(`fence:${m}`, () => paintFence(m, season));
}

export const MIRROR_PAINTED = new Set(['pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil', 'brasserie', 'chai', 'huilerie', 'distillerie', 'conserverie', 'charcuterie']);
const BUILDING_TYPES = ['maison', 'grange', 'hangar', 'remise', 'pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil', 'brasserie', 'chai', 'huilerie', 'distillerie', 'conserverie', 'charcuterie'];
const SHELTERS = ['abri', 'etable', 'bergerie', 'poulailler', 'porcherie'];

function paintAny(type: string): Painted {
  try {
    return paintBuilding2(type) ?? paintBuilding(type);
  } catch {
    // bâtiment sans dessin 2D (repli si la planche 3D de la région ne se charge pas)
    const size = BUILDINGS[type]?.size ?? 1;
    return paintHouse({ size, inset: size > 1 ? 0.2 : 0.08, wallH: 22 + size * 6, roofH: 16, wall: '#d9c39a', roof: '#a8553a', shutters: '#6f93b4', stories: 1, hip: false, door: 'simple', seed: type.length * 13 });
  }
}

/** Bâtiments au style de la région, personnages, animaux. */
export function buildStaticAtlas(atlas: Atlas, baked: (key: string) => boolean = () => false) {
  const extra = Object.values(BUILDINGS).filter((b) => !['verger', 'champ', 'enclos'].includes(b.kind) && !BUILDING_TYPES.includes(b.id)).map((b) => b.id);
  for (const b of [...BUILDING_TYPES, ...extra, ...SHELTERS, 'ecurie', 'clapier', 'etang', 'eglise', 'phare']) {
    if (baked(`b:${b}`)) continue; // bâtiment 3D pré-cuit pour la région
    atlas.add(`b:${b}`, paintAny(b === 'ecurie' ? 'etable' : b === 'clapier' || b === 'etang' ? 'abri' : b));
    if (MIRROR_PAINTED.has(b)) atlas.add(`b:${b}:m`, paintBuilding2Mirrored(b));
  }
  for (let v = 0; v < 4; v++) if (!baked(`b:hameau${v}`)) atlas.add(`b:hameau${v}`, paintBuilding(`hameau${v % 2}`, v >= 2));
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
