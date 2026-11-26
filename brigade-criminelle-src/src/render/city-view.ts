// Carte isométrique vivante de la ville : sol continu, routes avec trottoirs, marquages et
// passages piétons, voie ferrée, rivière animée, bâtiments détaillés selon le quartier, éclairage
// public, circulation sur voies (conduite à droite, distances de sécurité, virages), piétons qui
// marchent sur les trottoirs et traversent aux passages, véhicules de police en mission.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { hash2, valueNoise } from '../core/rng';
import { calendar, daylight } from '../sim/calendar';
import { districtActivity, placeOpen, roadPath, T } from '../sim/city';
import type { DistrictId, GameState, Place } from '../sim/types';
import type { CharSpec, Dir } from './art';
import { economyMode, type View } from './engine';
import { charTexture, iso, mix, poly, shadeN, TH, TW, vehTexture } from './iso';

export interface CityCallbacks { onCase(id: string): void; onPlace(id: string): void }

interface Pt { x: number; y: number }
interface Car {
  s: Sprite; pts: Pt[]; seg: number; t: number; speed: number; body: string; vk: string; police: boolean;
  key?: string; parked?: boolean; leaving?: boolean; blocked: number; x: number; y: number; hx: number; hy: number; dir: Dir; texKey?: string; era: number;
  tiles: number[];
}
interface Ped { s: Sprite; pts: Pt[]; seg: number; t: number; speed: number; spec: CharSpec; x: number; y: number; fade: number; tiles: number[] }
/** Feu tricolore à un carrefour : deux phases (axe x / axe y), décalées pour une « onde verte ». */
interface Signal { i: number; x: number; y: number; g: Graphics; off: number; key: string }
type Light = 'v' | 'o' | 'r';
/** Personne liée à une affaire, suivie individuellement sur la carte (domicile, travail, sorties). */
interface Actor { pid: string; caseId: string; s: Sprite; tag: Text; spec: CharSpec; pts: Pt[]; seg: number; t: number; x: number; y: number; goal: string; tk?: number; hidden: boolean }
const CYCLE = 16;

const INK = 0x1d1a17;

/** Garde-robe limitée de passants : les textures sont partagées (mémoire maîtrisée). */
const PED_POOL: CharSpec[] = Array.from({ length: 24 }, (_, i) => {
  const sexe = i % 2 ? 'F' : 'M';
  return { a: { skin: (i * 5) % 6, hair: i % 5 === 4 ? 6 : (i * 3) % 6, hairStyle: sexe === 'F' ? 3 + (i % 4) : i % 3, outfit: (i * 7) % 10, build: i % 3, glasses: i % 4 === 1, beard: sexe === 'M' && i % 6 === 2 }, sexe, look: i % 11 === 5 ? 'costume' : 'civil' } as CharSpec;
});
const CAR_COLORS = ['#8a2e2e', '#2f5d50', '#d9c27a', '#ebe7dc', '#3d4a5c', '#8a8a8a', '#355070', '#b56576'];
/** Teintes de carrosserie à la mode selon la décennie du modèle. */
function carColors(era: number): string[] {
  if (era < 1985) return ['#c8a060', '#8a6a3a', '#6a7a3a', '#c86a2a', '#e8e0c8', '#7a2e2e', '#3a5a7a', '#d8c040'];
  if (era < 1995) return ['#b8332a', '#e8e4da', '#2f4f6f', '#4a4f57', '#8a8a8a', '#6a3a5a', '#2f5d50', '#c8a060'];
  if (era < 2015) return CAR_COLORS;
  return ['#e9e9e6', '#2a2a2e', '#8a8f96', '#4a4f57', '#1c3f6a', '#8a2e2e', '#cfd3d6', '#3a5a4a'];
}
const ROOF = { tuile: 0xb35a3c, ardoise: 0x56606c, zinc: 0x8c959b, plat: 0x8a877e, bac: 0x9ea4a8 };
const ASPHALT = 0x4b4e53, CURB = 0xd9d3c4, WALK = 0xc8c0ac;

export class CityView implements View {
  root = new Container();
  lights = new Container();
  private ground = new Graphics();
  private water = new Graphics();
  private extra = new Container();
  private objects = new Container();
  private markers = new Container();
  private labels = new Container();
  private cars: Car[] = [];
  private peds: Ped[] = [];
  private sig = '';
  private road = new Set<number>();
  private walk = new Set<number>();
  private placeAt = new Map<number, Place>();
  private waterTiles: number[] = [];
  private lastSpawn = 0;
  private lastMarkers = 0;
  private markerSig = '';
  private rings: { g: Graphics; x: number; y: number; col: number }[] = [];
  private view = { x: -1e9, y: -1e9, w: 2e9, h: 2e9 };
  private statics: { o: Container; x0: number; y0: number; x1: number; y1: number }[] = [];
  private signals: Signal[] = [];
  private sigAt = new Map<number, Signal>();
  private clock = 0;
  private actors = new Map<string, Actor>();
  private lastActors = 0;
  speed = 1;

  constructor(private get: () => GameState, private cb: CityCallbacks) {
    this.objects.sortableChildren = true;
    this.root.addChild(this.ground, this.extra, this.water, this.objects, this.markers, this.labels);
  }

  bounds() {
    const st = this.get();
    const [l] = iso(0, st.city.h), [r] = iso(st.city.w, 0);
    const [, b] = iso(st.city.w, st.city.h);
    return { x: l, y: -80, w: r - l, h: b + 80 };
  }
  night() { const st = this.get(); return (1 - daylight(st.startYear, st.minute)) * 0.78; }
  outdoor() { return 1; }

  private tileOf(i: number): Pt { const w = this.get().city.w; return { x: i % w, y: Math.floor(i / w) }; }

  // ————————————————————— décor statique —————————————————————
  private rebuild(st: GameState) {
    const city = st.city;
    const w = city.w;
    const cal = calendar(st.startYear, st.minute);
    const season = cal.season;
    this.road = new Set(city.roads);
    this.placeAt = new Map(city.places.map((p) => [p.y * w + p.x, p]));
    this.walk = new Set(city.tiles.map((t, i) => ((t === T.trottoir || t === T.place || t === T.pave) && !this.placeAt.has(i) ? i : -1)).filter((i) => i >= 0));
    this.waterTiles = city.tiles.map((t, i) => (t === T.eau ? i : -1)).filter((i) => i >= 0);
    for (const c of this.cars) c.s.destroy();
    for (const p of this.peds) p.s.destroy();
    this.cars = []; this.peds = [];
    for (const a of this.actors.values()) { a.s.destroy(); a.tag.destroy(); }
    this.actors.clear();
    this.objects.removeChildren().forEach((c) => c.destroy({ children: true }));
    this.statics = [];
    this.markerSig = '';
    this.lights.removeChildren().forEach((c) => c.destroy());
    this.labels.removeChildren().forEach((c) => c.destroy());
    this.extra.removeChildren().forEach((c) => c.destroy());
    const g = this.ground;
    g.clear();
    const snow = st.weather.kind === 'neige' || (season === 'hiver' && st.weather.temp < 1);
    const grass = snow ? 0xe9edf0 : season === 'hiver' ? 0x93a080 : season === 'automne' ? 0x9ea05e : season === 'ete' ? 0x8fa755 : 0x80ab5a;
    const fieldCols = snow ? [0xe6e8e4, 0xdfe2de] : season === 'ete' ? [0xdcc574, 0xc9b25e, 0xa8b860] : season === 'automne' ? [0x9c7b4c, 0x8a6c42, 0xa88f5a] : season === 'hiver' ? [0x8c7d5c, 0x7f7556] : [0x9cbc5c, 0x8aae52, 0xb4c86a];
    const tq = (x: number, y: number, x1 = x + 1, y1 = y + 1): [number, number][] => [iso(x, y), iso(x1, y), iso(x1, y1), iso(x, y1)];
    const fill = (pts: [number, number][], col: number, a = 1) => g.poly(pts.flat()).fill({ color: col, alpha: a });
    // 1) sol de base, sans variation case par case (aucun effet « damier »)
    for (let y = 0; y < city.h; y++)
      for (let x = 0; x < w; x++) {
        const i = y * w + x, t = city.tiles[i];
        let col = grass;
        if (t === T.route) col = ASPHALT;
        else if (t === T.trottoir) col = snow ? 0xdfe2e3 : WALK;
        else if (t === T.place || t === T.pave) col = snow ? 0xe2e2dc : 0xcbbd99;
        else if (t === T.eau) col = 0x3f6f8f;
        else if (t === T.foret) col = snow ? 0xdde5e2 : mix(grass, 0x3d5e30, 0.55);
        if (t === T.herbe || t === T.foret) {
          // variations douces et continues (bruit lissé à grande échelle), fondues dans la couleur
          const nz = valueNoise(x, y, 6, 3);
          if (nz > 0.55) col = mix(col, snow ? 0xffffff : 0x5e7f3c, (nz - 0.55) * 0.5);
          else if (nz < 0.35) col = mix(col, snow ? 0xc8d2d8 : 0xb8b060, (0.35 - nz) * 0.45);
        }
        else if (t === T.champ) {
          const k = Math.floor(hash2(Math.floor(x / 3), Math.floor(y / 3), 9) * fieldCols.length);
          col = fieldCols[k];
        } else if (t === T.rail) col = 0x8a8072;
        fill(tq(x, y), col);
      }
    // 3) détails : touffes d'herbe, sillons, fleurs
    const det = new Graphics();
    for (let y = 0; y < city.h; y++)
      for (let x = 0; x < w; x++) {
        const t = city.tiles[y * w + x];
        if (t === T.herbe && !snow) {
          for (let k = 0; k < 2; k++) {
            const u = hash2(x * 7 + k, y * 3, 21), v = hash2(x * 5, y * 11 + k, 22);
            const [a, b] = iso(x + u, y + v);
            det.moveTo(a - 2, b).lineTo(a - 1, b - 3).moveTo(a, b).lineTo(a, b - 4).moveTo(a + 2, b).lineTo(a + 1, b - 3);
            if (season === 'printemps' && hash2(x, y, k) > 0.8) det.circle(a + 3, b - 2, 1.2);
          }
        }
        if (t === T.champ) {
          for (let k = 1; k < 5; k++) {
            const [a, b] = iso(x + k / 5, y + 0.04), [c, d] = iso(x + k / 5, y + 0.96);
            det.moveTo(a, b).lineTo(c, d);
          }
        }
      }
    det.stroke({ width: 1, color: snow ? 0xc8ced2 : 0x4f6a32, alpha: 0.45 });
    if (season === 'printemps') {
      for (let y = 0; y < city.h; y++) for (let x = 0; x < w; x++) if (city.tiles[y * w + x] === T.herbe && hash2(x, y, 1) > 0.8) { const [a, b] = iso(x + 0.7, y + 0.3); det.circle(a, b, 1.5).fill(hash2(x, y, 2) > 0.5 ? 0xf0e070 : 0xf0b0c8); }
    }
    this.extra.addChild(det);
    // 4) berges, eau, ponts
    for (const i of this.waterTiles) {
      const { x, y } = this.tileOf(i);
      for (const [nx, ny, edge] of [[x - 1, y, 'w'], [x + 1, y, 'e'], [x, y - 1, 'n'], [x, y + 1, 's']] as const) {
        const t = city.tiles[ny * w + nx];
        if (t === undefined || t === T.eau || t === T.route) continue;
        const e = 0.14;
        const pts = edge === 'w' ? tq(x, y, x + e, y + 1) : edge === 'e' ? tq(x + 1 - e, y, x + 1, y + 1) : edge === 'n' ? tq(x, y, x + 1, y + e) : tq(x, y + 1 - e, x + 1, y + 1);
        fill(pts, snow ? 0xd8dcd8 : 0xb9a77a);
      }
    }
    // 5) routes : bordures, trottoirs, marquages, passages piétons, ponts
    const isR = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < city.h && this.road.has(y * w + x);
    const lines = new Graphics();
    const zebra = new Graphics();
    for (const r of city.roads) {
      const { x, y } = this.tileOf(r);
      const L = isR(x - 1, y), R = isR(x + 1, y), U = isR(x, y - 1), D = isR(x, y + 1);
      const horiz = (L || R) && !U && !D, vert = (U || D) && !L && !R;
      const cross = (L || R) && (U || D);
      const c = 0.07;
      // bordures de trottoir sur les côtés sans route
      if (!U) fill(tq(x, y, x + 1, y + c), CURB);
      if (!D) fill(tq(x, y + 1 - c, x + 1, y + 1), CURB);
      if (!L) fill(tq(x, y, x + c, y + 1), CURB);
      if (!R) fill(tq(x + 1 - c, y, x + 1, y + 1), CURB);
      const over = city.tiles[r] === T.route && (city.tiles[r - 1] === T.eau || city.tiles[r + 1] === T.eau);
      if (over) {
        // tablier de pont et garde-corps
        const rail = new Graphics();
        for (const yy of [y + 0.04, y + 0.96]) { const [a, b] = iso(x, yy, 6), [cc, d] = iso(x + 1, yy, 6); rail.moveTo(a, b).lineTo(cc, d); for (let k = 0; k <= 4; k++) { const [p, q] = iso(x + k / 4, yy, 0), [p2, q2] = iso(x + k / 4, yy, 6); rail.moveTo(p, q).lineTo(p2, q2); } }
        rail.stroke({ width: 1.4, color: 0x6a645a });
        rail.zIndex = (x + y + 1) * 10;
        this.objects.addChild(rail);
      }
      if (horiz) {
        for (const k of [0.15, 0.6]) { const [a, b] = iso(x + k, y + 0.5), [cc, d] = iso(x + k + 0.25, y + 0.5); lines.moveTo(a, b).lineTo(cc, d); }
        // passage piéton à l'approche d'un carrefour
        const nearX = (isR(x + 1, y) && (isR(x + 1, y - 1) || isR(x + 1, y + 1))) ? x + 0.82 : (isR(x - 1, y) && (isR(x - 1, y - 1) || isR(x - 1, y + 1))) ? x + 0.05 : -1;
        if (nearX >= 0) for (let k = 0; k < 5; k++) fill([iso(nearX, y + 0.12 + k * 0.16), iso(nearX + 0.13, y + 0.12 + k * 0.16), iso(nearX + 0.13, y + 0.2 + k * 0.16), iso(nearX, y + 0.2 + k * 0.16)].map(([a, b]) => [a, b]) as [number, number][], 0xeeeae0);
      } else if (vert) {
        for (const k of [0.15, 0.6]) { const [a, b] = iso(x + 0.5, y + k), [cc, d] = iso(x + 0.5, y + k + 0.25); lines.moveTo(a, b).lineTo(cc, d); }
        const nearY = (isR(x, y + 1) && (isR(x - 1, y + 1) || isR(x + 1, y + 1))) ? y + 0.82 : (isR(x, y - 1) && (isR(x - 1, y - 1) || isR(x + 1, y - 1))) ? y + 0.05 : -1;
        if (nearY >= 0) for (let k = 0; k < 5; k++) fill([iso(x + 0.12 + k * 0.16, nearY), iso(x + 0.2 + k * 0.16, nearY), iso(x + 0.2 + k * 0.16, nearY + 0.13), iso(x + 0.12 + k * 0.16, nearY + 0.13)], 0xeeeae0);
      } else if (cross) {
        // carrefour : légère usure centrale
        const [a, b] = iso(x + 0.5, y + 0.5);
        g.ellipse(a, b, 14, 7).fill({ color: 0x3f4247, alpha: 0.22 });
      }
    }
    lines.stroke({ width: 1.6, color: 0xf2eedc, alpha: 0.85 });
    void zebra;
    // feux tricolores aux carrefours urbains (pas en campagne)
    this.signals = []; this.sigAt = new Map();
    const rural = new Set<DistrictId>(['rural', 'foret', 'villages']);
    const distAt = (x: number, y: number) => city.districts.find((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h)?.id;
    for (const r of city.roads) {
      const { x, y } = this.tileOf(r);
      const n = [isR(x - 1, y), isR(x + 1, y), isR(x, y - 1), isR(x, y + 1)];
      if (n.filter(Boolean).length < 3 || !((n[0] || n[1]) && (n[2] || n[3]))) continue;
      const d = distAt(x, y);
      if (d && rural.has(d)) continue;
      if (city.tiles[r] !== T.route) continue;
      const sg: Signal = { i: r, x, y, g: new Graphics(), off: (x * 1.7 + y * 0.9) % CYCLE, key: '' };
      sg.g.zIndex = (x + y + 1) * 10 + 4;
      this.objects.addChild(sg.g);
      this.signals.push(sg);
      this.sigAt.set(r, sg);
    }
    this.drawSignals();
    this.extra.addChild(lines);
    // 6) voie ferrée : ballast, traverses, rails
    const rails = new Graphics();
    for (let i = 0; i < city.tiles.length; i++) {
      if (city.tiles[i] !== T.rail) continue;
      const { x, y } = this.tileOf(i);
      for (let k = 0; k < 4; k++) { const [a, b] = iso(x + k / 4 + 0.06, y + 0.28), [c, d] = iso(x + k / 4 + 0.06, y + 0.72); rails.moveTo(a, b).lineTo(c, d); }
      rails.stroke({ width: 2.2, color: 0x5a4632 });
      for (const v of [0.38, 0.62]) { const [a, b] = iso(x, y + v), [c, d] = iso(x + 1, y + v); rails.moveTo(a, b).lineTo(c, d); }
      rails.stroke({ width: 1.5, color: 0x9aa0a6 });
    }
    this.extra.addChild(rails);
    // 7) bâtiments : lieux nommés et bâti des quartiers
    const year = cal.year;
    for (const p of city.places) this.building(p.x, p.y, p.kind, p.floors, p.district, season, snow, p);
    for (const d of city.districts) {
      for (let y = d.y; y < d.y + d.h; y++)
        for (let x = d.x; x < d.x + d.w; x++) {
          if (x < 0 || y < 0 || x >= w || y >= city.h) continue;
          const i = y * w + x;
          const t = city.tiles[i];
          if (this.placeAt.has(i)) continue;
          const n = hash2(x, y, 31);
          if (t === T.foret) {
            const m = 1 + Math.floor(hash2(x, y, 41) * 3);
            for (let k = 0; k < m; k++) this.tree(x + 0.2 + hash2(x + k, y, 5) * 0.6, y + 0.2 + hash2(x, y + k, 6) * 0.6, season, snow, true);
            continue;
          }
          if (t !== T.herbe && t !== T.trottoir) continue;
          if (t === T.trottoir && !['centre', 'vieille', 'residentiel', 'commercial', 'gare', 'campus', 'pavillons', 'hopital', 'industrie'].includes(d.id)) continue;
          const dens = { centre: 0.92, vieille: 0.95, commercial: 0.65, residentiel: 0.75, pavillons: 0.62, gare: 0.65, industrie: 0.6, campus: 0.5, hopital: 0.45, tourisme: 0.22, rural: 0.06, foret: 0, villages: 0.16, axes: 0.05 }[d.id];
          if (n < dens) this.building(x, y, null, 0, d.id, season, snow);
          else if (t === T.herbe && n > 0.8) this.tree(x + 0.5, y + 0.5, season, snow, false);
          else if (t === T.herbe && (d.id === 'pavillons' || d.id === 'villages')) this.hedge(x, y, season, snow);
        }
    }
    void year;
    // 8) éclairage public sur les trottoirs
    for (const i of this.walk) {
      const { x, y } = this.tileOf(i);
      if ((x * 3 + y * 5) % 7 !== 0) continue;
      if (!(isR(x - 1, y) || isR(x + 1, y) || isR(x, y - 1) || isR(x, y + 1))) continue;
      const lamp = new Graphics();
      const [a, b] = iso(x + 0.5, y + 0.5);
      lamp.ellipse(a, b, 4, 2).fill({ color: 0, alpha: 0.25 });
      lamp.rect(a - 1, b - 34, 2, 34).fill(0x2f3236);
      lamp.moveTo(a, b - 34).lineTo(a + 6, b - 37).stroke({ width: 1.5, color: 0x2f3236 });
      lamp.ellipse(a + 7, b - 36.5, 3, 1.6).fill(0xf6e8b0).stroke({ width: 0.6, color: INK });
      lamp.zIndex = (x + y + 1) * 10 + 2;
      this.objects.addChild(lamp);
      const l = new Graphics();
      for (let k = 4; k >= 1; k--) l.ellipse(a + 4, b + 2, 10 * k, 5 * k).fill({ color: 0x8a6a30, alpha: 0.11 });
      l.circle(a + 7, b - 36, 5).fill({ color: 0xffe6a8, alpha: 0.9 });
      this.lights.addChild(l);
    }
    // 9) noms des quartiers (cartouches)
    for (const d of city.districts) {
      if (d.id === 'axes') continue;
      const [cx, cy] = iso(d.x + d.w / 2, d.y + d.h / 2);
      const c = new Container();
      const t = new Text({ text: d.name.toUpperCase(), style: { fontSize: 13, fill: 0xfaf4e6, fontWeight: '700', letterSpacing: 1.5, fontFamily: 'Georgia, serif' }, resolution: 3 });
      t.anchor.set(0.5);
      const bg = new Graphics();
      bg.roundRect(-t.width / 2 - 8, -11, t.width + 16, 22, 11).fill({ color: 0x161d2b, alpha: 0.72 }).stroke({ width: 1, color: 0xd89a3a, alpha: 0.8 });
      c.addChild(bg, t);
      c.position.set(cx, cy - 60);
      this.labels.addChild(c);
    }
  }

  /** Retraits de l'emprise bâtie : 0,3 case du côté des rues (le trottoir). */
  private insets(x: number, y: number) {
    const w = this.get().city.w;
    const r = (xx: number, yy: number) => this.road.has(yy * w + xx);
    const S = 0.3;
    return { l: r(x - 1, y) ? S : 0, r: r(x + 1, y) ? S : 0, u: r(x, y - 1) ? S : 0, d: r(x, y + 1) ? S : 0 };
  }

  /** Point de marche sur une case de trottoir : le long de la chaussée voisine. */
  private walkPoint(i: number, lat: number): Pt {
    const w = this.get().city.w;
    const x = i % w, y = Math.floor(i / w);
    let ox = 0, oy = 0;
    if (this.road.has(i - 1)) ox -= 1;
    if (this.road.has(i + 1)) ox += 1;
    if (this.road.has(i - w)) oy -= 1;
    if (this.road.has(i + w)) oy += 1;
    const k = 0.34 + lat;
    return { x: x + 0.5 + ox * k, y: y + 0.5 + oy * k };
  }

  private hedge(x: number, y: number, season: string, snow: boolean) {
    const g = new Graphics();
    const col = snow ? 0xe6ece9 : season === 'automne' ? 0x8a7a3a : 0x4e7a38;
    const [a, b] = iso(x + 0.1, y + 0.9, 0), [c, d] = iso(x + 0.9, y + 0.9, 0);
    g.moveTo(a, b).lineTo(c, d).stroke({ width: 4, color: col });
    g.zIndex = (x + y + 1.8) * 10;
    this.objects.addChild(g);
  }

  private building(x: number, y: number, kind: Place['kind'] | null, floors: number, d: DistrictId, season: string, snow: boolean, place?: Place) {
    const ins = this.insets(x, y);
    const g = new Graphics();
    const n = hash2(x, y, 11);
    let h = 30, roof: number = ROOF.tuile, wall = 0xd8c8a8, w = 0.86, dd = 0.86, style: 'gable' | 'hip' | 'flat' | 'shed' = 'gable';
    let shop = false;
    switch (d) {
      case 'vieille': h = 30 + Math.floor(n * 3) * 11; roof = ROOF.ardoise; wall = mix(0xe0cfa8, 0xc9ae82, n); w = dd = 0.94; style = n > 0.5 ? 'hip' : 'gable'; shop = n > 0.6; break;
      case 'centre': h = 40 + Math.floor(n * 3) * 13; roof = n > 0.5 ? ROOF.zinc : ROOF.ardoise; wall = mix(0xeae0c9, 0xd2c3a2, n); w = dd = 0.94; style = 'hip'; shop = n > 0.35; break;
      case 'residentiel': h = 48 + Math.floor(n * 4) * 14; roof = ROOF.plat; wall = mix(0xe6e1d6, 0xcfc8b8, n); style = 'flat'; break;
      case 'commercial': h = 20; roof = ROOF.bac; wall = [0xe4dccb, 0xd5cfc4, 0xe8e0cf][Math.floor(n * 3)]; style = 'flat'; shop = true; w = 0.9; dd = 0.9; break;
      case 'industrie': h = 24 + Math.floor(n * 2) * 6; roof = ROOF.bac; wall = mix(0xa4aaae, 0x868d92, n); style = n > 0.5 ? 'shed' : 'flat'; w = dd = 0.92; break;
      case 'campus': h = 34 + Math.floor(n * 2) * 11; roof = ROOF.ardoise; wall = mix(0xbf6f4d, 0xa95a3c, n); style = 'gable'; break;
      case 'hopital': h = 48; roof = ROOF.plat; wall = 0xeef0ee; style = 'flat'; break;
      case 'gare': h = 28; roof = ROOF.zinc; wall = 0xdacdb2; style = 'gable'; shop = n > 0.5; break;
      default: h = 18 + Math.floor(n * 2) * 8; roof = n > 0.55 ? ROOF.ardoise : ROOF.tuile; wall = mix(0xf0e4ca, 0xdccba4, n); w = dd = 0.66; style = 'gable';
    }
    if (kind) {
      h = Math.max(h, 18 + floors * 13);
      w = dd = 0.94;
      if (kind === 'commissariat') { wall = 0xe6dcc6; roof = ROOF.ardoise; h = 46; style = 'hip'; }
      if (kind === 'mairie' || kind === 'tribunal') { wall = 0xefe5cc; roof = ROOF.ardoise; h = 54; style = 'hip'; }
      if (kind === 'eglise') { wall = 0xcfbf9c; roof = ROOF.ardoise; h = 44; style = 'gable'; }
      if (kind === 'hopital') { wall = 0xf2f4f2; h = 66; style = 'flat'; roof = ROOF.plat; }
      if (kind === 'usine' || kind === 'entrepot') { wall = 0xa0aab0; roof = ROOF.bac; h = 30; style = 'shed'; }
      if (kind === 'ferme') { wall = 0xdccca4; roof = ROOF.tuile; h = 22; style = 'gable'; }
      if (kind === 'commerce' || kind === 'bar' || kind === 'restaurant' || kind === 'bijouterie' || kind === 'antiquaire' || kind === 'banque' || kind === 'supermarche') shop = true;
      if (kind === 'parc') { this.tree(x + 0.3, y + 0.35, season, snow, false); this.tree(x + 0.7, y + 0.7, season, snow, false); this.bench(x + 0.5, y + 0.2); return; }
      if (kind === 'camping') {
        for (let k = 0; k < 3; k++) { const [a, b] = iso(x + 0.2 + k * 0.28, y + 0.3 + (k % 2) * 0.35); g.poly([a - 7, b, a, b - 9, a + 7, b, a + 2, b + 3]).fill([0xd8823a, 0x3a7ab8, 0x5a9a4a][k]).stroke({ width: 0.8, color: INK }); }
        g.zIndex = (x + y + 1) * 10; this.objects.addChild(g); return;
      }
    }
    // emprise : retrait côté rue pour laisser le trottoir libre
    let x0 = x + (1 - w) / 2, y0 = y + (1 - dd) / 2, x1 = x0 + w, y1 = y0 + dd;
    x0 = Math.max(x0, x + ins.l); x1 = Math.min(x1, x + 1 - ins.r); y0 = Math.max(y0, y + ins.u); y1 = Math.min(y1, y + 1 - ins.d);
    w = x1 - x0; dd = y1 - y0;
    // ombre portée au sol (soleil à l'ouest-sud-ouest)
    g.poly([...iso(x1, y0), ...iso(x1 + h / 90, y0 + h / 160), ...iso(x1 + h / 90, y1 + h / 160), ...iso(x0 + h / 160, y1 + h / 160), ...iso(x0, y1)]).fill({ color: 0x000000, alpha: 0.18 });
    const right = shadeN(wall, 0.8), left = shadeN(wall, 0.94);
    // façades
    poly(g, [iso(x1, y0), iso(x1, y1), iso(x1, y1, h), iso(x1, y0, h)], right, 1, true, 0.8);
    poly(g, [iso(x0, y1), iso(x1, y1), iso(x1, y1, h), iso(x0, y1, h)], left, 1, true, 0.8);
    // soubassement et corniche
    poly(g, [iso(x0, y1), iso(x1, y1), iso(x1, y1, 4), iso(x0, y1, 4)], shadeN(wall, 0.7), 1, false);
    poly(g, [iso(x1, y0), iso(x1, y1), iso(x1, y1, 4), iso(x1, y0, 4)], shadeN(wall, 0.6), 1, false);
    // fenêtres sur les deux façades visibles
    const levels = Math.max(1, Math.floor((h - 6) / 13));
    const cols = Math.max(2, Math.round(w * 4));
    const lit: [number, number][] = [];
    const glassDay = 0x7f98ad, frame = 0xf3eee2;
    for (let k = 0; k < levels; k++) {
      const z = 7 + k * 13;
      if (z + 8 > h) break;
      const ground = k === 0 && shop;
      for (let j = 0; j < cols; j++) {
        const u0 = x0 + (j + 0.22) * (w / cols), u1 = x0 + (j + 0.78) * (w / cols);
        if (ground) {
          poly(g, [iso(u0 - 0.04, y1, 2), iso(u1 + 0.04, y1, 2), iso(u1 + 0.04, y1, 10), iso(u0 - 0.04, y1, 10)], 0x9cc0d0, 1, true, 0.6);
        } else {
          poly(g, [iso(u0, y1, z), iso(u1, y1, z), iso(u1, y1, z + 7), iso(u0, y1, z + 7)], glassDay, 1, false);
          g.poly([...iso(u0, y1, z), ...iso(u1, y1, z), ...iso(u1, y1, z + 7), ...iso(u0, y1, z + 7)]).stroke({ width: 0.8, color: frame });
          if (d === 'vieille' || d === 'centre') poly(g, [iso(u0 - 0.03, y1, z - 1), iso(u1 + 0.03, y1, z - 1), iso(u1 + 0.03, y1, z), iso(u0 - 0.03, y1, z)], 0x6b4c3b, 1, false);
        }
        if (hash2(x * 13 + j, y * 7 + k, 3) < (kind === 'hopital' ? 0.85 : 0.45)) lit.push([(u0 + u1) / 2, z]);
        const v0 = y0 + (j + 0.22) * (dd / cols), v1 = y0 + (j + 0.78) * (dd / cols);
        if (!ground) {
          poly(g, [iso(x1, v0, z), iso(x1, v1, z), iso(x1, v1, z + 7), iso(x1, v0, z + 7)], shadeN(glassDay, 0.85), 1, false);
          g.poly([...iso(x1, v0, z), ...iso(x1, v1, z), ...iso(x1, v1, z + 7), ...iso(x1, v0, z + 7)]).stroke({ width: 0.8, color: shadeN(frame, 0.85) });
        }
      }
    }
    // vitrine : auvent coloré et enseigne
    if (shop) {
      const aw = [0xc83a2a, 0x2f6d4a, 0x1f3a6e, 0xd89a3a, 0x7a2e5a][Math.floor(n * 5)];
      poly(g, [iso(x0, y1, 13), iso(x1, y1, 13), iso(x1, y1 + 0.16, 9), iso(x0, y1 + 0.16, 9)], aw, 1, true, 0.6);
      for (let k = 0; k < 6; k++) { const u = x0 + (k + 0.5) * (w / 6); g.poly([...iso(u - 0.04, y1 + 0.16, 9), ...iso(u + 0.04, y1 + 0.16, 9), ...iso(u + 0.04, y1 + 0.12, 10.5)]).fill({ color: 0xffffff, alpha: 0.5 }); }
    } else if (kind !== null || d === 'pavillons' || d === 'villages' || d === 'rural') {
      // porte d'entrée
      const um = x0 + w * 0.5;
      poly(g, [iso(um - 0.07, y1, 0), iso(um + 0.07, y1, 0), iso(um + 0.07, y1, 10), iso(um - 0.07, y1, 10)], 0x6b4c3b, 1, true, 0.6);
    }
    // toiture
    const R = snow ? 0xf2f4f5 : roof;
    if (style === 'flat') {
      poly(g, [iso(x0, y0, h), iso(x1, y0, h), iso(x1, y1, h), iso(x0, y1, h)], shadeN(R, 1.08), 1, true, 0.8);
      // acrotère et édicules techniques
      poly(g, [iso(x0, y1, h), iso(x1, y1, h), iso(x1, y1, h + 3), iso(x0, y1, h + 3)], shadeN(wall, 0.88), 1, false);
      poly(g, [iso(x1, y0, h), iso(x1, y1, h), iso(x1, y1, h + 3), iso(x1, y0, h + 3)], shadeN(wall, 0.75), 1, false);
      const bx = x0 + w * 0.3, by = y0 + dd * 0.3;
      poly(g, [iso(bx + 0.2, by, h), iso(bx + 0.2, by + 0.2, h), iso(bx + 0.2, by + 0.2, h + 6), iso(bx + 0.2, by, h + 6)], 0x8a8e92, 1, true, 0.5);
      poly(g, [iso(bx, by + 0.2, h), iso(bx + 0.2, by + 0.2, h), iso(bx + 0.2, by + 0.2, h + 6), iso(bx, by + 0.2, h + 6)], 0x9ea2a6, 1, true, 0.5);
      poly(g, [iso(bx, by, h + 6), iso(bx + 0.2, by, h + 6), iso(bx + 0.2, by + 0.2, h + 6), iso(bx, by + 0.2, h + 6)], 0xb6babd, 1, true, 0.5);
      if (kind === 'hopital') { const [a, b] = iso(x0 + w * 0.6, y0 + dd * 0.6, h); g.rect(a - 6, b - 2, 12, 4).fill(0xc83a2a); g.rect(a - 2, b - 6, 4, 12).fill(0xc83a2a); }
    } else if (style === 'shed') {
      // toiture en sheds (usines)
      const n2 = 3;
      for (let k = 0; k < n2; k++) {
        const a0 = x0 + (k / n2) * w, a1 = x0 + ((k + 1) / n2) * w;
        poly(g, [iso(a0, y1, h), iso(a1, y1, h), iso(a1, y1, h + 10), iso(a0, y1, h)], shadeN(R, 0.95), 1, true, 0.6);
        poly(g, [iso(a0, y0, h), iso(a1, y0, h + 10), iso(a1, y1, h + 10), iso(a0, y1, h)], shadeN(R, 1.1), 1, true, 0.6);
        poly(g, [iso(a1, y0, h), iso(a1, y1, h), iso(a1, y1, h + 10), iso(a1, y0, h + 10)], 0x6f8fa8, 1, true, 0.6);
      }
      if (kind === 'usine') { const [a, b] = iso(x0 + w * 0.2, y0 + dd * 0.2, h); g.rect(a - 3, b - 30, 6, 30).fill(0x8a5a4a).stroke({ width: 0.8, color: INK }); }
    } else {
      const ridge = h + (style === 'hip' ? 14 : 16) * Math.min(1, w + 0.2);
      if (style === 'hip') {
        // toit à quatre pans
        const inset = Math.min(w, dd) * 0.3;
        const ra = iso(x0 + inset, y0 + dd / 2, ridge), rb = iso(x1 - inset, y0 + dd / 2, ridge);
        poly(g, [iso(x0, y0, h), iso(x1, y0, h), rb, ra], shadeN(R, 0.95), 1, true, 0.7);
        poly(g, [iso(x1, y0, h), iso(x1, y1, h), rb], shadeN(R, 0.78), 1, true, 0.7);
        poly(g, [iso(x0, y1, h), iso(x1, y1, h), rb, ra], shadeN(R, 1.05), 1, true, 0.7);
        if (!snow) for (let k = 1; k < 4; k++) { const t = k / 4; const [a, b] = iso(x0 + inset * t, y1 - (dd / 2) * t, h + (ridge - h) * t), [c, e] = iso(x1 - inset * t, y1 - (dd / 2) * t, h + (ridge - h) * t); g.moveTo(a, b).lineTo(c, e).stroke({ width: 0.6, color: shadeN(R, 0.8), alpha: 0.7 }); }
        // lucarne
        if (h > 34 && !snow) { const u = x0 + w * 0.5; poly(g, [iso(u - 0.08, y1 - 0.12, h + 3), iso(u + 0.08, y1 - 0.12, h + 3), iso(u + 0.08, y1 - 0.12, h + 9), iso(u - 0.08, y1 - 0.12, h + 9)], 0xf3eee2, 1, true, 0.6); }
      } else {
        // toit à deux pans, faîtage selon x
        const ra = iso(x0, y0 + dd / 2, ridge), rb = iso(x1, y0 + dd / 2, ridge);
        poly(g, [iso(x0, y1, h), iso(x1, y1, h), rb, ra], shadeN(R, 1.04), 1, true, 0.7);
        poly(g, [iso(x1, y0, h), iso(x1, y1, h), rb], shadeN(wall, 0.72), 1, true, 0.7);
        if (!snow) for (let k = 1; k < 4; k++) { const t = k / 4; const [a, b] = iso(x0, y1 - (dd / 2) * t, h + (ridge - h) * t), [c, e] = iso(x1, y1 - (dd / 2) * t, h + (ridge - h) * t); g.moveTo(a, b).lineTo(c, e).stroke({ width: 0.6, color: shadeN(R, 0.78), alpha: 0.75 }); }
      }
      // cheminée
      if (n > 0.3 && kind !== 'eglise') {
        const cx = x0 + w * 0.72, cy = y0 + dd * 0.35;
        poly(g, [iso(cx + 0.1, cy, ridge - 8), iso(cx + 0.1, cy + 0.1, ridge - 8), iso(cx + 0.1, cy + 0.1, ridge + 2), iso(cx + 0.1, cy, ridge + 2)], 0x8a5a44, 1, true, 0.5);
        poly(g, [iso(cx, cy + 0.1, ridge - 8), iso(cx + 0.1, cy + 0.1, ridge - 8), iso(cx + 0.1, cy + 0.1, ridge + 2), iso(cx, cy + 0.1, ridge + 2)], 0x9e6a52, 1, true, 0.5);
      }
      if (kind === 'eglise') {
        // clocher
        const cx = x0 + w * 0.35, cy = y0 + dd * 0.35, s2 = 0.3;
        poly(g, [iso(cx + s2, cy, h), iso(cx + s2, cy + s2, h), iso(cx + s2, cy + s2, h + 36), iso(cx + s2, cy, h + 36)], shadeN(wall, 0.8), 1, true, 0.7);
        poly(g, [iso(cx, cy + s2, h), iso(cx + s2, cy + s2, h), iso(cx + s2, cy + s2, h + 36), iso(cx, cy + s2, h + 36)], shadeN(wall, 0.94), 1, true, 0.7);
        const top = iso(cx + s2 / 2, cy + s2 / 2, h + 64);
        poly(g, [iso(cx, cy + s2, h + 36), iso(cx + s2, cy + s2, h + 36), top], shadeN(ROOF.ardoise, 1.05), 1, true, 0.7);
        poly(g, [iso(cx + s2, cy, h + 36), iso(cx + s2, cy + s2, h + 36), top], shadeN(ROOF.ardoise, 0.8), 1, true, 0.7);
      }
    }
    // enseignes particulières
    if (kind === 'commissariat') {
      const [a, b] = iso(x0 + w / 2, y1, h - 6);
      g.roundRect(a - 18, b - 6, 36, 9, 2).fill(0x1f3a6e).stroke({ width: 1, color: INK });
      const t = new Text({ text: 'POLICE', style: { fontSize: 7, fill: 0xffffff, fontWeight: 'bold' }, resolution: 4 });
      t.anchor.set(0.5); t.position.set(a, b - 1.5); t.zIndex = (x + y + 1) * 10 + 1;
      this.objects.addChild(t);
      // drapeau
      const [fx, fy] = iso(x1 - 0.1, y1, h);
      g.moveTo(fx, fy).lineTo(fx, fy - 16).stroke({ width: 1, color: 0x2a2a2a });
      g.rect(fx, fy - 16, 4, 6).fill(0x1f3a6e); g.rect(fx + 4, fy - 16, 4, 6).fill(0xffffff); g.rect(fx + 8, fy - 16, 4, 6).fill(0xc83a2a);
    }
    if (kind === 'gare') { const [a, b] = iso(x0 + w / 2, y1, h - 4); g.circle(a, b - 4, 4).fill(0xffffff).stroke({ width: 0.8, color: INK }); }
    g.zIndex = (x + y + 1) * 10;
    if (place) (g as Graphics & { placeId?: string }).placeId = place.id;
    this.objects.addChild(g);
    // fenêtres éclairées la nuit
    if (lit.length) {
      const l = new Graphics();
      for (const [u, z] of lit) { const [lx, ly] = iso(u, y1, z + 3.5); l.rect(lx - 2.5, ly - 3, 5, 6).fill({ color: 0xe0b050, alpha: 0.95 }); }
      this.lights.addChild(l);
    }
  }

  private bench(x: number, y: number) {
    const g = new Graphics();
    poly(g, [iso(x - 0.15, y, 3), iso(x + 0.15, y, 3), iso(x + 0.15, y + 0.06, 3), iso(x - 0.15, y + 0.06, 3)], 0x7a5a3a, 1, true, 0.5);
    g.zIndex = (x + y) * 10;
    this.objects.addChild(g);
  }

  private tree(x: number, y: number, season: string, snow: boolean, forest: boolean) {
    const t = new Graphics();
    const [a, b] = iso(x, y);
    const n = hash2(Math.floor(x * 13), Math.floor(y * 17), 2);
    const r = forest ? 8 + n * 4 : 10 + n * 4;
    t.ellipse(a + 3, b + 1, r * 0.9, r * 0.38).fill({ color: 0, alpha: 0.2 });
    const conifer = forest && n > 0.45;
    if (conifer) {
      t.rect(a - 1.2, b - 6, 2.4, 6).fill(0x5a4030);
      const col = snow ? 0xe2ebe7 : 0x2f5a3c;
      for (let k = 0; k < 3; k++) {
        const yy = b - 6 - k * r * 0.6, rr = r * (1 - k * 0.25);
        t.poly([a - rr, yy, a + rr, yy, a, yy - r * 1.05]).fill(shadeN(col, 1 + k * 0.08)).stroke({ width: 0.7, color: INK, alpha: 0.45 });
        t.poly([a, yy, a + rr, yy, a, yy - r * 1.05]).fill({ color: 0x000000, alpha: 0.12 });
      }
    } else {
      t.moveTo(a, b).lineTo(a, b - r * 1.3).stroke({ width: 2.4, color: 0x5a4030 });
      if (season === 'hiver') {
        for (let i = -2; i <= 2; i++) t.moveTo(a, b - r * 0.9).lineTo(a + i * r * 0.35, b - r * 2.1 + Math.abs(i) * 3).stroke({ width: 1.2, color: 0x5a4030 });
        if (snow) t.ellipse(a, b - r * 1.9, r * 0.6, r * 0.25).fill({ color: 0xffffff, alpha: 0.8 });
      } else {
        const pal = season === 'automne' ? [0xc4742a, 0xd99a3a, 0xa8562a] : season === 'printemps' ? [0x76a84a, 0x92c05c, 0xeac2d4] : [0x467a38, 0x5a9244, 0x356a2c];
        const cy = b - r * 1.6;
        t.circle(a - r * 0.4, cy + r * 0.25, r * 0.7).fill(pal[2]).stroke({ width: 0.7, color: INK, alpha: 0.4 });
        t.circle(a + r * 0.45, cy + r * 0.2, r * 0.68).fill(pal[0]).stroke({ width: 0.7, color: INK, alpha: 0.4 });
        t.circle(a, cy - r * 0.2, r * 0.8).fill(pal[0]).stroke({ width: 0.7, color: INK, alpha: 0.4 });
        t.circle(a - r * 0.25, cy - r * 0.4, r * 0.38).fill({ color: pal[1], alpha: 0.9 });
        t.circle(a + r * 0.3, cy + r * 0.35, r * 0.45).fill({ color: 0x000000, alpha: 0.12 });
      }
    }
    t.zIndex = (x + y) * 10 + 1;
    this.objects.addChild(t);
  }

  // ————————————————————— circulation —————————————————————
  /** Trajectoire sur la voie de droite : points aux franchissements de cases, décalés à droite. */
  private lanePath(path: number[], off = 0.22): Pt[] {
    const P = path.map((i) => this.tileOf(i));
    const out: Pt[] = [];
    const right = (a: Pt, b: Pt) => { const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y); return { x: -dy, y: dx }; };
    if (P.length < 2) return out;
    const r0 = right(P[0], P[1]);
    out.push({ x: P[0].x + 0.5 + r0.x * off, y: P[0].y + 0.5 + r0.y * off });
    for (let k = 0; k < P.length - 1; k++) {
      const r = right(P[k], P[k + 1]);
      out.push({ x: (P[k].x + P[k + 1].x) / 2 + 0.5 + r.x * off, y: (P[k].y + P[k + 1].y) / 2 + 0.5 + r.y * off });
    }
    const rl = right(P[P.length - 2], P[P.length - 1]);
    out.push({ x: P[P.length - 1].x + 0.5 + rl.x * off, y: P[P.length - 1].y + 0.5 + rl.y * off });
    return out;
  }

  /** État du feu pour un axe de circulation. */
  private light(sg: Signal, axis: 'x' | 'y'): Light {
    const t = (this.clock + sg.off) % CYCLE;
    if (axis === 'x') return t < 6.5 ? 'v' : t < 8 ? 'o' : 'r';
    return t >= 8 && t < 14.5 ? 'v' : t >= 14.5 ? 'o' : 'r';
  }

  private drawSignals() {
    const col: Record<Light, number> = { v: 0x3cd46a, o: 0xf2a33a, r: 0xe8443a };
    for (const sg of this.signals) {
      const lx = this.light(sg, 'x'), ly = this.light(sg, 'y');
      const key = lx + ly;
      if (key === sg.key) continue;
      sg.key = key;
      const g = sg.g;
      g.clear();
      // deux mâts aux angles opposés : l'un pour l'axe x, l'autre pour l'axe y
      for (const [u, v, st] of [[-0.12, 1.12, lx], [1.12, -0.12, ly]] as [number, number, Light][]) {
        const [a, b] = iso(sg.x + u, sg.y + v);
        g.moveTo(a, b).lineTo(a, b - 24).stroke({ width: 1.6, color: 0x2a2d33 });
        g.roundRect(a - 3, b - 36, 6, 14, 1.5).fill(0x1d1f24).stroke({ width: 0.8, color: 0x000000 });
        (['r', 'o', 'v'] as Light[]).forEach((k, i) => g.circle(a, b - 33 + i * 4, 1.5).fill({ color: st === k ? col[k] : 0x3a3a3a, alpha: st === k ? 1 : 0.8 }));
        if (st) g.circle(a, b - 33 + ['r', 'o', 'v'].indexOf(st) * 4, 3.2).fill({ color: col[st], alpha: 0.25 });
      }
    }
  }

  /** Les personnes liées aux affaires en cours, suivies une à une : domicile la nuit, travail en
   * journée, sorties le soir ; absentes si elles sont en garde à vue ou disparues. */
  private updateActors(st: GameState) {
    const cal = calendar(st.startYear, st.minute);
    const w = st.city.w;
    const want = new Map<string, string>();
    for (const c of st.cases) {
      if (c.status !== 'ouverte') continue;
      for (const cp of c.persons) {
        if (!cp.known || cp.inCustody || cp.role === 'disparu' || want.has(cp.pid)) continue;
        want.set(cp.pid, c.id);
        if (want.size >= 18) break;
      }
      if (want.size >= 18) break;
    }
    for (const [pid, a] of this.actors) if (!want.has(pid)) { this.objects.removeChild(a.s); this.labels.removeChild(a.tag); a.s.destroy(); a.tag.destroy(); this.actors.delete(pid); }
    const places = st.city.places;
    const pickIn = (pid: string, kinds: Place['kind'][], salt: number, district?: DistrictId) => {
      const list = places.filter((p) => kinds.includes(p.kind) && (!district || p.district === district));
      const all = list.length ? list : places.filter((p) => kinds.includes(p.kind));
      if (!all.length) return places[0];
      return all[Math.floor(hash2(Number(pid.slice(1)) || 1, salt, 5) * all.length) % all.length];
    };
    for (const [pid, caseId] of want) {
      const person = st.people[pid];
      if (!person) continue;
      const home = (person.homePlace && places.find((p) => p.id === person.homePlace)) || pickIn(pid, ['maison', 'immeuble'], 1, person.district);
      const work = pickIn(pid, ['commerce', 'usine', 'entrepot', 'banque', 'mairie', 'hopital', 'ecole', 'universite', 'restaurant', 'garage', 'supermarche', 'hotel'], 2);
      const leisure = pickIn(pid, ['bar', 'restaurant', 'parc', 'commerce'], 3);
      const retired = person.age >= 64 || /retrait|sans emploi/.test(person.profession);
      const h = cal.hour;
      const goalPlace = h < 7 || h >= 22 ? home : h < 18 ? (retired ? (h >= 10 && h < 12 ? leisure : home) : (cal.weekday === 0 ? leisure : work)) : h < 20 ? leisure : home;
      const hidden = goalPlace === home && (h < 6 || h >= 22.5);
      let a = this.actors.get(pid);
      if (!a) {
        const spec: CharSpec = { a: person.appearance, sexe: person.sexe, look: 'civil' };
        const s = new Sprite(charTexture(spec, 'idle', 0, false));
        s.anchor.set(0.5, 66 / 72);
        s.scale.set(0.36);
        const tag = new Text({ text: `${person.prenom} ${person.nom[0]}.`, style: { fontSize: 11, fill: 0xffffff, fontWeight: 'bold', stroke: { color: 0x1f2738, width: 3 } }, resolution: 3 });
        tag.anchor.set(0.5, 1);
        this.objects.addChild(s);
        this.labels.addChild(tag);
        const start = this.nearWalk(goalPlace) ?? st.city.roads[0];
        const p0 = this.walkPoint(start, 0);
        a = { pid, caseId, s, tag, spec, pts: [p0], seg: 0, t: 0, x: p0.x, y: p0.y, goal: goalPlace.id, hidden };
        this.actors.set(pid, a);
      }
      a.caseId = caseId;
      a.hidden = hidden;
      if (a.goal !== goalPlace.id && a.seg >= a.pts.length - 1) {
        const from = Math.round(a.y - 0.5) * w + Math.round(a.x - 0.5);
        const startT = this.walk.has(from) ? from : this.nearWalkTile(from) ?? from;
        const to = this.nearWalk(goalPlace);
        const path = to !== undefined ? this.walkPath(startT, to) : [];
        if (path.length >= 2) { a.pts = path.map((i) => this.walkPoint(i, 0.06)); a.seg = 0; a.t = 0; }
        a.goal = goalPlace.id;
      }
    }
  }
  private nearWalk(p: Place): number | undefined {
    const w = this.get().city.w;
    return [p.y * w + p.x - 1, p.y * w + p.x + 1, (p.y - 1) * w + p.x, (p.y + 1) * w + p.x].find((i) => this.walk.has(i));
  }
  private nearWalkTile(i: number): number | undefined {
    const w = this.get().city.w;
    for (let r = 1; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const j = i + dy * w + dx; if (this.walk.has(j)) return j; }
    return undefined;
  }

  private spawnCar(st: GameState, police?: { key: string; from: number; to: number; body: string; vk: string; era: number }) {
    const roads = st.city.roads;
    const a = police ? police.from : roads[Math.floor(Math.random() * roads.length)];
    const b = police ? police.to : roads[Math.floor(Math.random() * roads.length)];
    const path = roadPath(st.city, a, b);
    if (path.length < (police ? 2 : 7)) return;
    const pts = this.lanePath(path);
    const big = Math.random();
    const year = calendar(st.startYear, st.minute).year;
    // style par tranche d'époque (limite le nombre de textures) ; le parc mêle modèles récents et anciens
    const raw = police?.era ?? year - Math.floor(Math.random() * Math.random() * 18);
    const era = raw < 1985 ? 1980 : raw < 1995 ? 1990 : raw < 2005 ? 2000 : raw < 2015 ? 2010 : raw < 2022 ? 2018 : 2024;
    const pal = carColors(era);
    const body = police?.body ?? pal[Math.floor(Math.random() * pal.length)];
    const vk = police?.vk ?? (big < 0.05 ? 'bus' : big < 0.12 ? 'camion' : big < 0.2 ? 'fourgon' : 'civil');
    const s = new Sprite();
    s.anchor.set(0.5, 60 / 96);
    s.alpha = 0;
    this.objects.addChild(s);
    this.cars.push({ s, pts, seg: 0, t: 0, speed: police ? 1.9 : 1.2 + Math.random() * 0.5, body, vk, police: !!police, key: police?.key, era, blocked: 0, x: pts[0].x, y: pts[0].y, hx: 1, hy: 0, dir: 'px', tiles: path });
  }

  private walkPath(start: number, goal: number): number[] {
    // BFS sur les trottoirs ; traversée d'une chaussée autorisée en ligne droite (passage piéton)
    const w = this.get().city.w;
    const prev = new Map<number, number>([[start, -1]]);
    const q = [start];
    while (q.length) {
      const c = q.shift()!;
      if (c === goal) break;
      for (const d of [1, -1, w, -w]) {
        let n = c + d;
        if (Math.abs((n % w) - (c % w)) > 1) continue;
        if (this.road.has(n) && (this.walk.has(n + d) || n + d === goal)) n = n + d; // traverse
        else if (!this.walk.has(n) && n !== goal) continue;
        if (prev.has(n)) continue;
        prev.set(n, c);
        q.push(n);
      }
      if (prev.size > 900) break;
    }
    if (!prev.has(goal)) return [];
    const out: number[] = [];
    for (let c = goal; c !== -1; c = prev.get(c)!) out.push(c);
    return out.reverse();
  }

  private spawnPed(st: GameState) {
    const w = st.city.w;
    const places = st.city.places.filter((p) => p.kind !== 'parc' && p.kind !== 'ferme');
    const nearWalk = (p: Place) => [p.y * w + p.x - 1, p.y * w + p.x + 1, (p.y - 1) * w + p.x, (p.y + 1) * w + p.x].find((i) => this.walk.has(i));
    const walks = [...this.walk];
    const a = Math.random() < 0.5 ? nearWalk(places[Math.floor(Math.random() * places.length)]) : walks[Math.floor(Math.random() * walks.length)];
    const b = Math.random() < 0.6 ? nearWalk(places[Math.floor(Math.random() * places.length)]) : walks[Math.floor(Math.random() * walks.length)];
    if (a === undefined || b === undefined || a === b) return;
    const pa = this.tileOf(a), pb = this.tileOf(b);
    if (Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y) > 22) return;
    const path = this.walkPath(a, b);
    if (path.length < 4) return;
    const lat = (Math.random() - 0.5) * 0.12;
    const pts: Pt[] = [];
    for (let k = 0; k < path.length; k++) {
      const p = this.walkPoint(path[k], lat);
      // traversée : on reste aligné avec le passage
      pts.push(p);
    }
    const spec = PED_POOL[Math.floor(Math.random() * PED_POOL.length)];
    const s = new Sprite(charTexture(spec, 'walk', 0, false));
    s.anchor.set(0.5, 66 / 72);
    s.scale.set(0.3);
    s.alpha = 0;
    this.objects.addChild(s);
    this.peds.push({ s, pts, seg: 0, t: 0, speed: 0.38 + Math.random() * 0.18, spec, x: pts[0].x, y: pts[0].y, fade: 0, tiles: path });
  }

  private spawn(st: GameState) {
    const cal = calendar(st.startYear, st.minute);
    const act = st.city.districts.reduce((s, d) => s + districtActivity(d, cal.weekday, cal.hour, cal.season), 0) / st.city.districts.length;
    const night = cal.hour < 6 || cal.hour >= 22;
    const eco = economyMode() ? 0.5 : 1;
    const wantCars = eco * Math.round((night ? 5 : 14 + act * 22) * Math.min(1.6, Math.sqrt(st.city.population / 80000)));
    const wantPeds = eco * Math.round(night ? 4 : 20 + act * 40) * (st.weather.kind === 'pluie' || st.weather.kind === 'orage' ? 0.5 : 1);
    if (this.cars.filter((c) => !c.police).length < wantCars) this.spawnCar(st);
    for (let k = 0; k < 3 && this.peds.length < wantPeds; k++) this.spawnPed(st);
    // véhicules de police en mission : du commissariat vers le lieu de l'affaire
    const hq = st.city.places.find((p) => p.kind === 'commissariat');
    for (const v of st.vehicles) {
      if (!v.caseId || v.busyUntil <= st.minute || !hq) continue;
      const key = `${v.id}|${v.caseId}`;
      if (this.cars.some((c) => c.key === key)) continue;
      const c = st.cases.find((x) => x.id === v.caseId);
      const pl = c && st.city.places.find((p) => p.id === c.placeId);
      if (!pl) continue;
      this.spawnCar(st, { key, from: hq.y * st.city.w + hq.x, to: pl.y * st.city.w + pl.x, body: '#' + v.color.toString(16).padStart(6, '0'), vk: v.kind === 'fourgon' ? 'fourgon' : 'banalisee', era: v.year });
    }
    for (const c of this.cars) if (c.police && c.key) {
      const v = st.vehicles.find((x) => x.id === c.key!.split('|')[0]);
      if (!v || v.busyUntil <= st.minute) c.leaving = true;
    }
  }

  private drawMarkers(st: GameState, time: number) {
    const byPlace = new Map<string, { n: number; prio: number }>();
    for (const c of st.cases) {
      if (c.status !== 'ouverte') continue;
      const e = byPlace.get(c.placeId);
      if (!e) byPlace.set(c.placeId, { n: 1, prio: c.priority });
      else { e.n++; e.prio = Math.min(e.prio, c.priority); }
    }
    const sig = [...byPlace].map(([k, v]) => `${k}:${v.n}:${v.prio}`).join('|');
    if (sig !== this.markerSig) {
      this.markerSig = sig;
      this.markers.removeChildren().forEach((c) => c.destroy({ children: true }));
      this.rings = [];
      for (const [pid, e] of byPlace) {
        const p = st.city.places.find((x) => x.id === pid);
        if (!p) continue;
        const [a, b] = iso(p.x + 0.5, p.y + 0.5, 78);
        const [ga, gb] = iso(p.x + 0.5, p.y + 0.5);
        const col = e.prio === 1 ? 0xd83a2a : e.prio === 2 ? 0xe0a030 : 0x3a8ad8;
        const c = new Container();
        const ring = new Graphics();
        const g = new Graphics();
        g.moveTo(a, b + 16).lineTo(ga, gb).stroke({ width: 1.5, color: INK, alpha: 0.5 });
        g.circle(a, b, 14).fill(col).stroke({ width: 2, color: 0xffffff });
        g.poly([a - 6, b + 11, a + 6, b + 11, a, b + 19]).fill(col);
        const t = new Text({ text: e.n > 1 ? String(e.n) : '!', style: { fontSize: 14, fill: 0xffffff, fontWeight: 'bold' }, resolution: 3 });
        t.anchor.set(0.5); t.position.set(a, b);
        c.addChild(ring, g, t);
        this.markers.addChild(c);
        this.rings.push({ g: ring, x: ga, y: gb, col });
      }
    }
    const pulse = (Math.sin(time / 300) + 1) / 2;
    for (const r of this.rings) { r.g.clear(); r.g.ellipse(r.x, r.y, 22 + pulse * 10, 11 + pulse * 5).stroke({ width: 2.5, color: r.col, alpha: 0.85 - pulse * 0.55 }); }
  }

  viewport(x: number, y: number, w: number, h: number) {
    this.view = { x: x - 120, y: y - 160, w: w + 240, h: h + 320 };
  }

  /** Masque les objets fixes hors de l'écran (gain important quand on est zoomé). */
  private cull() {
    if (!this.statics.length) {
      for (const o of [...this.objects.children, ...this.lights.children]) {
        const b = o.getLocalBounds();
        this.statics.push({ o: o as Container, x0: b.minX, y0: b.minY, x1: b.maxX, y1: b.maxY });
      }
    }
    const v = this.view;
    for (const s of this.statics) s.o.visible = s.x1 >= v.x && s.x0 <= v.x + v.w && s.y1 >= v.y && s.y0 <= v.y + v.h;
  }

  update(dtMs: number, time: number) {
    const st = this.get();
    const cal = calendar(st.startYear, st.minute);
    const sig = `${cal.season}|${st.weather.kind === 'neige' || (cal.season === 'hiver' && st.weather.temp < 1)}|${st.city.places.length}`;
    if (sig !== this.sig) {
      this.sig = sig;
      this.rebuild(st);
      this.cull();
      // démarrage « à chaud » : la ville est déjà animée à l'ouverture de la carte
      for (let k = 0; k < 40; k++) this.spawn(st);
      for (const c of this.cars) { c.seg = Math.floor(Math.random() * Math.max(1, c.pts.length - 3)); c.s.alpha = 1; }
      for (const p of this.peds) { p.seg = Math.floor(Math.random() * Math.max(1, p.pts.length - 2)); p.fade = 1; }
    }
    if (time - this.lastSpawn > 250) { this.lastSpawn = time; this.spawn(st); }
    if (time - this.lastMarkers > 50) { this.lastMarkers = time; this.drawMarkers(st, time); this.cull(); }
    const dt = Math.min(0.1, dtMs / 1000);
    const k = Math.min(3, Math.max(1, Math.sqrt(this.speed || 1)));
    if (Math.floor(time / 80) !== Math.floor((time - dtMs) / 80)) this.animateWater(time);
    const lightsOn = daylight(st.startYear, st.minute) < 0.45;
    this.clock += dt * k;
    this.drawSignals();
    if (time - this.lastActors > 400) { this.lastActors = time; this.updateActors(st); }
    // voitures : avance le long de la trajectoire, distance de sécurité
    for (const c of this.cars) {
      if (c.parked) {
        if (c.leaving) { c.s.alpha -= dt * 1.5; }
        else { const lt = Math.floor(time / 280) % 2 === 0; const tk = `${c.dir}${lt}`; if (tk !== c.texKey) { c.texKey = tk; c.s.texture = vehTexture({ body: c.body, kind: c.vk as 'banalisee', police: true, era: c.era, lights: lt }, c.dir); } }
        continue;
      }
      let ahead = false;
      for (const o of this.cars) {
        if (o === c || o.s.alpha < 0.3) continue;
        const vx = o.x - c.x, vy = o.y - c.y;
        const dist = Math.hypot(vx, vy);
        if (dist > 0.75) continue;
        const along = (vx * c.hx + vy * c.hy) / (dist || 1);
        if (along > 0.55 && o.hx * c.hx + o.hy * c.hy > -0.2) { ahead = true; break; }
      }
      if (ahead && c.blocked < 2.5) { c.blocked += dt; }
      else {
        c.blocked = Math.max(0, c.blocked - dt);
        let move = c.speed * k * dt;
        // feu rouge (ou orange, s'il reste la place de s'arrêter) à l'entrée du carrefour
        const j = c.seg + 1;
        if (!c.police && j >= 1 && j < c.tiles.length) {
          const sg = this.sigAt.get(c.tiles[j]);
          if (sg) {
            const a = c.pts[c.seg], b = c.pts[j];
            const rem = (1 - c.t) * (Math.hypot(b.x - a.x, b.y - a.y) || 1e-6);
            const axis = (c.tiles[j] % st.city.w) !== (c.tiles[j - 1] % st.city.w) ? 'x' : 'y';
            const l = this.light(sg, axis);
            if ((l === 'r' || (l === 'o' && rem > 0.25)) && rem < 0.6) move = Math.max(0, Math.min(move, rem - 0.14));
          }
        }
        while (move > 0 && c.seg < c.pts.length - 1) {
          const a = c.pts[c.seg], b = c.pts[c.seg + 1];
          const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
          const rem = (1 - c.t) * len;
          if (move < rem) { c.t += move / len; move = 0; }
          else { move -= rem; c.seg++; c.t = 0; }
        }
      }
      if (c.seg >= c.pts.length - 1) {
        if (c.police && !c.leaving) { c.parked = true; continue; }
        c.s.alpha -= dt * 2.5;
        continue;
      }
      const a = c.pts[c.seg], b = c.pts[c.seg + 1];
      c.x = a.x + (b.x - a.x) * c.t; c.y = a.y + (b.y - a.y) * c.t;
      const hx = b.x - a.x, hy = b.y - a.y;
      const hl = Math.hypot(hx, hy) || 1;
      c.hx = hx / hl; c.hy = hy / hl;
      // orientation : axe dominant du segment (dans un virage, bascule à mi-parcours)
      c.dir = Math.abs(hx) >= Math.abs(hy) ? (hx > 0 ? 'px' : 'nx') : (hy > 0 ? 'py' : 'ny');
      const remaining = c.pts.length - 1 - c.seg - c.t;
      c.s.alpha = Math.min(1, c.s.alpha + dt * 3, remaining * 2);
      const lt = c.police ? Math.floor(time / 250) % 2 === 0 : lightsOn;
      const tk = `${c.dir}${lt}`;
      if (tk !== c.texKey) { c.texKey = tk; c.s.texture = vehTexture({ body: c.body, kind: c.vk as 'civil', police: c.police, era: c.era, lights: lt }, c.dir); }
      const [sx, sy] = iso(c.x, c.y);
      c.s.position.set(sx, sy);
      c.s.zIndex = (c.x + c.y) * 10 + 0.6;
    }
    // piétons
    for (const p of this.peds) {
      let move = p.speed * k * dt;
      // traversée réglée par les feux : on attend que la circulation transversale soit arrêtée
      const j = p.seg + 1;
      if (j >= 1 && j < p.tiles.length && this.road.has(p.tiles[j]) && !this.road.has(p.tiles[j - 1])) {
        const w = st.city.w, ti = p.tiles[j];
        const sg = this.sigAt.get(ti) ?? this.sigAt.get(ti + 1) ?? this.sigAt.get(ti - 1) ?? this.sigAt.get(ti + w) ?? this.sigAt.get(ti - w);
        if (sg) {
          const crossX = (ti % w) !== (p.tiles[j - 1] % w);
          const ok = this.light(sg, crossX ? 'y' : 'x') === 'r';
          const a = p.pts[p.seg], b = p.pts[j];
          const rem = (1 - p.t) * (Math.hypot(b.x - a.x, b.y - a.y) || 1e-6);
          if (!ok && rem < 0.35) move = Math.max(0, Math.min(move, rem - 0.1));
        }
      }
      while (move > 0 && p.seg < p.pts.length - 1) {
        const a = p.pts[p.seg], b = p.pts[p.seg + 1];
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
        const rem = (1 - p.t) * len;
        if (move < rem) { p.t += move / len; move = 0; } else { move -= rem; p.seg++; p.t = 0; }
      }
      const done = p.seg >= p.pts.length - 1;
      p.fade = done ? p.fade - dt * 2 : Math.min(1, p.fade + dt * 2);
      p.s.alpha = Math.max(0, p.fade);
      if (done) continue;
      const a = p.pts[p.seg], b = p.pts[p.seg + 1];
      p.x = a.x + (b.x - a.x) * p.t; p.y = a.y + (b.y - a.y) * p.t;
      const dx = b.x - a.x, dy = b.y - a.y;
      const frame = Math.floor(time / (170 / k)) % 4;
      const back = dx < -0.01 || dy < -0.01;
      const pk = frame * 2 + (back ? 1 : 0);
      if ((p as Ped & { tk?: number }).tk !== pk) { (p as Ped & { tk?: number }).tk = pk; p.s.texture = charTexture(p.spec, 'walk', frame, back); }
      // tourné vers la gauche de l'écran : miroir
      p.s.scale.x = (dx - dy) < 0 ? -0.3 : 0.3;
      const [sx, sy] = iso(p.x, p.y);
      p.s.position.set(sx, sy);
      p.s.zIndex = (p.x + p.y) * 10 + 0.5;
    }
    // personnes suivies
    for (const a of this.actors.values()) {
      let move = 0.42 * k * dt;
      while (move > 0 && a.seg < a.pts.length - 1) {
        const p0 = a.pts[a.seg], p1 = a.pts[a.seg + 1];
        const len = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1e-6;
        const rem = (1 - a.t) * len;
        if (move < rem) { a.t += move / len; move = 0; } else { move -= rem; a.seg++; a.t = 0; }
      }
      const walking = a.seg < a.pts.length - 1;
      const p0 = a.pts[Math.min(a.seg, a.pts.length - 1)], p1 = a.pts[Math.min(a.seg + 1, a.pts.length - 1)];
      a.x = p0.x + (p1.x - p0.x) * a.t; a.y = p0.y + (p1.y - p0.y) * a.t;
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const frame = walking ? Math.floor(time / (170 / k)) % 4 : Math.floor(time / 700) % 4;
      const back = walking && (dx < -0.01 || dy < -0.01);
      const tk = frame * 2 + (back ? 1 : 0) + (walking ? 0 : 100);
      if (a.tk !== tk) { a.tk = tk; a.s.texture = charTexture(a.spec, walking ? 'walk' : 'idle', frame, back); }
      a.s.scale.x = walking && (dx - dy) < 0 ? -0.36 : 0.36;
      const vis = !a.hidden || walking;
      a.s.visible = vis; a.tag.visible = vis;
      const [sx, sy] = iso(a.x, a.y);
      a.s.position.set(sx, sy);
      a.s.zIndex = (a.x + a.y) * 10 + 0.55;
      a.tag.position.set(sx, sy - 27);
    }
    for (const c of this.cars.filter((x) => x.s.alpha <= 0 && (x.seg >= x.pts.length - 1 || x.leaving))) { this.objects.removeChild(c.s); c.s.destroy(); }
    this.cars = this.cars.filter((x) => !x.s.destroyed);
    for (const p of this.peds.filter((x) => x.fade <= 0 && x.seg >= x.pts.length - 1)) { this.objects.removeChild(p.s); p.s.destroy(); }
    this.peds = this.peds.filter((x) => !x.s.destroyed);
  }

  private animateWater(time: number) {
    const g = this.water;
    g.clear();
    const st = this.get();
    const w = st.city.w;
    for (const i of this.waterTiles) {
      if (this.road.has(i)) continue;
      const x = i % w, y = Math.floor(i / w);
      for (let k = 0; k < 2; k++) {
        const ph = ((time / 2600 + hash2(x, y, k + 7)) % 1);
        const u = 0.15 + hash2(x, y, k) * 0.6, v = ph;
        const [a, b] = iso(x + u, y + v), [c, d] = iso(x + u + 0.18, y + v);
        g.moveTo(a, b).lineTo(c, d);
      }
    }
    g.stroke({ width: 1.2, color: 0xcfe4f0, alpha: 0.45 });
  }

  tap(wx: number, wy: number) {
    const st = this.get();
    for (const a of this.actors.values()) {
      if (!a.s.visible) continue;
      const [sx, sy] = iso(a.x, a.y);
      if (Math.hypot(sx - wx, sy - 12 - wy) < 16) { this.cb.onCase(a.caseId); return; }
    }
    for (const pl of st.city.places) {
      if (!st.cases.some((c) => c.status === 'ouverte' && c.placeId === pl.id)) continue;
      const [a, b] = iso(pl.x + 0.5, pl.y + 0.5, 78);
      if (Math.hypot(a - wx, b - wy) < 22) {
        const best = st.cases.filter((x) => x.status === 'ouverte' && x.placeId === pl.id).sort((u, v) => u.priority - v.priority)[0];
        this.cb.onCase(best.id);
        return;
      }
    }
    const ax = wx / (TW / 2), by = wy / (TH / 2);
    for (const dz of [0, 1, 2]) {
      const tx = Math.floor((ax + by) / 2) + dz, ty = Math.floor((by - ax) / 2) + dz;
      const p = this.placeAt.get(ty * st.city.w + tx);
      if (p) { this.cb.onPlace(p.id); return; }
    }
  }

  placeScreen(placeId: string): { x: number; y: number } | null {
    const p = this.get().city.places.find((x) => x.id === placeId);
    if (!p) return null;
    const [x, y] = iso(p.x + 0.5, p.y + 0.5);
    return { x, y };
  }

  destroy() {
    this.root.destroy({ children: true });
    this.lights.destroy({ children: true });
  }
}

export function placeStatus(st: GameState, p: Place): string {
  const c = calendar(st.startYear, st.minute);
  if (p.open === p.close) return 'Accès permanent';
  return `${placeOpen(p, c.weekday, c.hour) ? 'Ouvert' : 'Fermé'} — ${p.open} h à ${p.close} h${p.closedDays.length ? ` (fermé ${p.closedDays.map((d) => ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d]).join(', ')})` : ''}`;
}
