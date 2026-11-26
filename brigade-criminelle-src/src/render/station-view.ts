// Vue isométrique du commissariat : pièces, murs en coupe, mobilier animé, personnages
// pilotés par leurs tâches dans la simulation (navigation A*), véhicules et visiteurs.
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { calendar, daylight } from '../sim/calendar';
import { navPath, roomAt, ROOM_DEFS, SH, SW, walkable } from '../sim/station';
import type { GameState, Person, Room, RoomType, Staff } from '../sim/types';
import type { CharSpec, Look, Pose } from './art';
import type { View } from './engine';
import { animate, drawFurniture, type Animated } from './furniture';
import { CHAR_H, charTexture, iso, mix, poly, shadeN, TH, TW, vehTexture } from './iso';

export interface StationCallbacks {
  onStaff(id: string): void;
  onRoom(id: string): void;
  onBuildRect?(floor: number, x: number, y: number, w: number, h: number): void;
  onPlaceFurniture?(roomId: string, x: number, y: number): void;
}

export type BuildMode = { kind: 'room'; type: RoomType } | { kind: 'furniture'; fkind: string } | null;

interface Agent {
  id: string;
  spec: CharSpec;
  sprite: Sprite;
  bubble: Graphics;
  f: number; x: number; y: number;
  path: { f: number; x: number; y: number }[];
  goal: string;
  pose: Pose;
  back: boolean;
  anim: number;
  visible: boolean;
  gone: boolean; // hors du bâtiment
  visitor?: { until: number; stage: number };
  sitBack?: boolean;
}

const FLOOR_COL: Record<string, number> = { parquet: 0xb58a5c, carrelage: 0xd6d0c2, lino: 0xb9b8ad, beton: 0x9a9890, moquette: 0x8a8f9a };
const WALL_IN = 0xe6dcc4, WALL_OUT = 0xcdb894, WALL_H = 74, LOW_H = 10;

export function lookOf(s: Staff): Look {
  return s.role === 'agent' ? 'uniforme' : s.role === 'technicien' ? 'blouse' : s.role === 'commandant' || s.role === 'officier' ? 'costume' : 'civil';
}

export class StationView implements View {
  root = new Container();
  lights = new Container();
  private ground = new Graphics();
  private floorG = new Graphics();
  private objects = new Container();
  private overlay = new Graphics();
  private labels = new Container();
  private anims: Animated[] = [];
  private agents = new Map<string, Agent>();
  private vehicles = new Map<string, { s: Sprite; out: boolean; t: number; x: number; y: number; home: { x: number; y: number } }>();
  private sig = '';
  floor = 0;
  mode: BuildMode = null;
  private hoverT: { x: number; y: number } | null = null;
  private dragA: { x: number; y: number } | null = null;
  private dragB: { x: number; y: number } | null = null;
  private lastThink = 0;
  private visitorSeq = 0;
  private placed = new Set<string>();
  private firstThink = true;
  speed = 1;
  showLabels = true;

  constructor(private get: () => GameState, private cb: StationCallbacks) {
    this.objects.sortableChildren = true;
    this.root.addChild(this.ground, this.floorG, this.objects, this.labels, this.overlay);
  }

  bounds() {
    const [l] = iso(-2, SH + 4), [r] = iso(SW + 4, -2);
    const [, t] = iso(-2, -2, WALL_H), [, b] = iso(SW + 4, SH + 4);
    return { x: l, y: t, w: r - l, h: b - t };
  }

  night() {
    const st = this.get();
    const d = daylight(st.startYear, st.minute);
    return (1 - d) * 0.55;
  }
  outdoor() { return 0.35; }

  setFloor(f: number) {
    this.floor = f;
    this.sig = '';
  }

  // ————— construction de la scène statique —————
  private rebuild(st: GameState) {
    const year = calendar(st.startYear, st.minute).year;
    const season = calendar(st.startYear, st.minute).season;
    for (const c of [...this.objects.children]) if (!(c as Sprite & { agent?: boolean }).agent) { this.objects.removeChild(c); c.destroy({ children: true }); }
    this.labels.removeChildren().forEach((c) => c.destroy());
    this.lights.removeChildren().forEach((c) => c.destroy());
    this.anims = [];
    const g = this.ground;
    g.clear();
    // abords : rue, trottoirs, végétation (au rez-de-chaussée et vus depuis l'étage)
    const grass = season === 'hiver' ? 0x9aa08a : season === 'automne' ? 0x8f8f52 : 0x7a9a52;
    for (let y = -4; y < SH + 5; y++)
      for (let x = -4; x < SW + 5; x++) {
        if (x >= 0 && y >= 0 && x < SW && y < SH) continue;
        let col = grass;
        if (y >= SH + 1 && y <= SH + 3) col = 0x4f5256; // rue
        else if (x >= -3 && x <= -2) col = 0x55585c; // rue latérale
        else if (y === SH || x === -1 || (y >= SH + 4)) col = 0xb9b2a2; // trottoir
        poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], col, 1, false);
        if (col === 0x4f5256 && y === SH + 2 && x % 2 === 0) { const [a, b] = iso(x + 0.2, y + 0.5), [c, d] = iso(x + 0.8, y + 0.5); g.moveTo(a, b).lineTo(c, d).stroke({ width: 2, color: 0xe8e4d0, alpha: 0.8 }); }
      }
    // arbres d'alignement
    for (let x = 1; x < SW + 3; x += 4) this.tree(x, SH + 4.4, season);
    for (let y = 1; y < SH; y += 4) this.tree(-0.6, y + 0.5, season, true);
    // dalle du bâtiment à cet étage
    const f = this.floor;
    const fg = this.floorG;
    fg.clear();
    if (f > 0) {
      // l'étage repose sur le bâtiment : on montre l'emprise du rez-de-chaussée en dessous
      poly(fg, [iso(0, 0), iso(SW, 0), iso(SW, SH), iso(0, SH)], 0x6a655c, 1, true);
    }
    const rooms = st.station.rooms.filter((r) => r.floor === f);
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const r = roomAt(st.station, f, x, y);
        if (!r) { if (f === 0) poly(fg, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], 0x8a877d, 1, false); continue; }
        const def = ROOM_DEFS[r.type];
        const tex = def.floorTex;
        let col = tex === 'moquette' ? mix(FLOOR_COL.moquette, def.color, 0.35) : FLOOR_COL[tex];
        if (tex === 'carrelage' && (x + y) % 2) col = shadeN(col, 0.9);
        if (tex === 'beton') col = shadeN(col, 0.96 + ((x * 7 + y * 3) % 5) * 0.01);
        if (r.built > st.minute) col = 0xa89a7a;
        poly(fg, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], col, 1, false);
        if (tex === 'parquet') for (let k = 1; k < 4; k++) { const [a, b] = iso(x + k / 4, y), [c, d] = iso(x + k / 4, y + 1); fg.moveTo(a, b).lineTo(c, d).stroke({ width: 0.6, color: 0x7a5a3a, alpha: 0.5 }); }
        if (r.type === 'garage' && (x + y) % 3 === 0) { const [a, b] = iso(x + 0.5, y + 0.5); fg.ellipse(a, b, 6, 2.5).fill({ color: 0x4a4844, alpha: 0.35 }); }
      }
    // murs : arrière en pleine hauteur, avant et cloisons intérieures en coupe basse
    const doorAt = (ax: number, ay: number, bx: number, by: number) => {
      const ra = roomAt(st.station, f, ax, ay), rb = roomAt(st.station, f, bx, by);
      return !!(ra?.doors.some((d) => d.x === ax && d.y === ay) || rb?.doors.some((d) => d.x === bx && d.y === by));
    };
    const outsideDoor = (r: Room | undefined, x: number, y: number) => !!r?.doors.some((d) => d.x === x && d.y === y);
    for (let k = 0; k <= SH; k++)
      for (let x = 0; x < SW; x++) {
        const ra = roomAt(st.station, f, x, k - 1), rb = roomAt(st.station, f, x, k);
        if (ra === rb) continue;
        const full = !ra;
        const door = (ra && rb && doorAt(x, k - 1, x, k)) || (!ra && outsideDoor(rb, x, k)) || (!rb && outsideDoor(ra, x, k - 1));
        this.wallSeg('x', x, k, full ? WALL_H : LOW_H, full, !!door, (rb ?? ra)!, st);
      }
    for (let k = 0; k <= SW; k++)
      for (let y = 0; y < SH; y++) {
        const ra = roomAt(st.station, f, k - 1, y), rb = roomAt(st.station, f, k, y);
        if (ra === rb) continue;
        const full = !ra;
        const door = (ra && rb && doorAt(k - 1, y, k, y)) || (!ra && outsideDoor(rb, k, y)) || (!rb && outsideDoor(ra, k - 1, y));
        this.wallSeg('y', k, y, full ? WALL_H : LOW_H, full, !!door, (rb ?? ra)!, st);
      }
    // mobilier et éclairage
    let seed = 1;
    for (const r of rooms) {
      if (r.built > st.minute) {
        const [cx, cy] = iso(r.x + r.w / 2, r.y + r.h / 2);
        const t = new Text({ text: '🚧 Travaux', style: { fontSize: 13, fill: 0x3a2a10, fontWeight: 'bold' } });
        t.anchor.set(0.5);
        t.position.set(cx, cy);
        this.labels.addChild(t);
        continue;
      }
      if (r.type === 'escalier') {
        const sg = new Graphics();
        for (let i = 0; i < r.h - 1; i++) {
          const yy = r.y + r.h - 1 - i;
          poly(sg, [iso(r.x + 0.3, yy, i * 9), iso(r.x + r.w - 0.3, yy, i * 9), iso(r.x + r.w - 0.3, yy + 1, i * 9), iso(r.x + 0.3, yy + 1, i * 9)], shadeN(0xb0a898, 1 - i * 0.03), 1, true, 0.6);
          poly(sg, [iso(r.x + 0.3, yy + 1, i * 9 - 9 < 0 ? 0 : i * 9 - 9), iso(r.x + r.w - 0.3, yy + 1, i * 9 - 9 < 0 ? 0 : i * 9 - 9), iso(r.x + r.w - 0.3, yy + 1, i * 9), iso(r.x + 0.3, yy + 1, i * 9)], 0x8a8478, 1, true, 0.6);
        }
        sg.zIndex = (r.x + r.y) * 10 + 1;
        this.objects.addChild(sg);
      }
      for (const fu of r.furniture) {
        const d = drawFurniture(fu.kind, fu.x, fu.y, year, seed++);
        d.c.zIndex = (fu.x + fu.y + 1) * 10;
        this.objects.addChild(d.c);
        this.anims.push(...d.anim);
        if (d.glow) { const [gx, gy] = iso(d.glow[0], d.glow[1], 20); const l = new Graphics(); l.ellipse(gx, gy, 18, 10).fill({ color: d.glow[2], alpha: 0.5 }); this.lights.addChild(l); }
      }
      // plafonniers : halo chaud au sol
      for (let yy = r.y + 1; yy < r.y + r.h; yy += 3)
        for (let xx = r.x + 1; xx < r.x + r.w; xx += 3) {
          const [lx, ly] = iso(xx + 0.5, yy + 0.5);
          const l = new Graphics();
          l.ellipse(lx, ly, 46, 23).fill({ color: r.type === 'garage' ? 0x6a6a50 : 0x8a6a3a, alpha: 0.55 });
          l.ellipse(lx, ly, 22, 11).fill({ color: 0xa08048, alpha: 0.5 });
          this.lights.addChild(l);
        }
      if (this.showLabels && r.type !== 'couloir') {
        const [cx, cy] = iso(r.x + r.w / 2, r.y + r.h / 2);
        const t = new Text({ text: ROOM_DEFS[r.type].label, style: { fontSize: 11, fill: 0xfaf4e6, fontWeight: '600', stroke: { color: 0x1d1a17, width: 3 } } });
        t.anchor.set(0.5);
        t.position.set(cx, cy + 4);
        t.alpha = 0.85;
        this.labels.addChild(t);
      }
    }
    // réverbères de la rue
    for (let x = 2; x < SW + 3; x += 5) {
      const lamp = new Graphics();
      const [a, b] = iso(x, SH + 0.6);
      lamp.rect(a - 1.5, b - 60, 3, 60).fill(0x2a2a2a);
      lamp.circle(a, b - 62, 4).fill(0xf0e0a0);
      lamp.zIndex = (x + SH + 0.6) * 10;
      this.objects.addChild(lamp);
      const l = new Graphics();
      l.ellipse(a, b, 60, 28).fill({ color: 0x8a7038, alpha: 0.7 });
      l.circle(a, b - 62, 10).fill({ color: 0xffe0a0, alpha: 0.9 });
      this.lights.addChild(l);
    }
    // véhicules garés
    for (const v of this.vehicles.values()) { this.objects.removeChild(v.s); v.s.destroy(); }
    this.vehicles.clear();
    if (f === 0) {
      const places = st.station.rooms.filter((r) => r.type === 'garage' && r.floor === 0 && r.built <= st.minute).flatMap((r) => r.furniture.filter((x) => x.kind === 'place'));
      st.vehicles.forEach((v, i) => {
        const p = places[i % Math.max(1, places.length)];
        const home = p ? { x: p.x + 0.5, y: p.y + 0.6 } : { x: 2 + i * 3, y: SH + 2 };
        const s = new Sprite(vehTexture({ body: '#' + v.color.toString(16).padStart(6, '0'), kind: v.kind === 'fourgon' ? 'fourgon' : v.kind === 'technique' ? 'technique' : 'banalisee', police: true, era: year }, 'ny'));
        s.anchor.set(0.5, 60 / 96);
        s.scale.set(1.25);
        this.objects.addChild(s);
        this.vehicles.set(v.id, { s, out: false, t: 0, x: home.x, y: home.y, home });
      });
    }
  }

  private tree(x: number, y: number, season: string, small = false) {
    const t = new Graphics();
    const [a, b] = iso(x, y);
    t.ellipse(a, b, 12, 5).fill({ color: 0x000000, alpha: 0.2 });
    t.rect(a - 2, b - 26, 4, 26).fill(0x5a4030).stroke({ width: 0.8, color: 0x1d1a17 });
    const leaf = season === 'automne' ? [0xc8782a, 0xd89a3a, 0xa8582a] : season === 'hiver' ? null : season === 'printemps' ? [0x7aaa4a, 0x8ab85a, 0xe8c0d0] : [0x4a7a3a, 0x5a8a42, 0x3e6a30];
    const r = small ? 11 : 15;
    if (leaf) {
      t.circle(a, b - 34, r).fill(leaf[0]).stroke({ width: 1, color: 0x1d1a17, alpha: 0.6 });
      t.circle(a - 7, b - 28, r * 0.7).fill(leaf[1]);
      t.circle(a + 7, b - 38, r * 0.6).fill(leaf[2]);
    } else {
      for (let i = -2; i <= 2; i++) t.moveTo(a, b - 18).lineTo(a + i * 7, b - 40 + Math.abs(i) * 3).stroke({ width: 1.4, color: 0x5a4030 });
      for (let i = -1; i <= 1; i += 2) t.moveTo(a + i * 7, b - 37).lineTo(a + i * 11, b - 44).stroke({ width: 1, color: 0x5a4030 });
    }
    t.zIndex = (x + y) * 10;
    this.objects.addChild(t);
  }

  private wallSeg(axis: 'x' | 'y', a: number, b: number, h: number, exterior: boolean, door: boolean, room: Room, st: GameState) {
    const g = new Graphics();
    const col = exterior ? WALL_OUT : WALL_IN;
    const th = 0.1;
    const d = daylight(st.startYear, st.minute);
    if (axis === 'x') {
      const x = a, y = b;
      if (door) {
        if (exterior) {
          // linteau et montants
          poly(g, [iso(x, y, h - 16), iso(x + 1, y, h - 16), iso(x + 1, y, h), iso(x, y, h)], col);
          poly(g, [iso(x, y), iso(x + 0.08, y), iso(x + 0.08, y, h - 16), iso(x, y, h - 16)], 0x6b4c3b);
          poly(g, [iso(x + 0.92, y), iso(x + 1, y), iso(x + 1, y, h - 16), iso(x + 0.92, y, h - 16)], 0x6b4c3b);
          if (room.type === 'garage') poly(g, [iso(x + 0.08, y, h - 22), iso(x + 0.92, y, h - 22), iso(x + 0.92, y, h - 16), iso(x + 0.08, y, h - 16)], 0x8a8f94);
        }
      } else {
        poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y, h), iso(x, y, h)], shadeN(col, 0.92));
        poly(g, [iso(x, y, h), iso(x + 1, y, h), iso(x + 1, y - th, h), iso(x, y - th, h)], shadeN(col, 1.1));
        if (exterior && h === WALL_H) {
          if (x % 2 === 1 && !['garage', 'preuves', 'escalier'].includes(room.type)) this.windowOn(g, 'x', x, y, d, st);
          // soubassement
          poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y, 8), iso(x, y, 8)], shadeN(col, 0.75), 1, false);
        }
      }
      g.zIndex = exterior && h === WALL_H ? (x + y - 0.5) * 10 - 2 : (x + 0.5 + y) * 10 - 1;
    } else {
      const x = a, y = b;
      if (door) {
        if (exterior) {
          poly(g, [iso(x, y, h - 16), iso(x, y + 1, h - 16), iso(x, y + 1, h), iso(x, y, h)], shadeN(col, 0.85));
          poly(g, [iso(x, y), iso(x, y + 0.08), iso(x, y + 0.08, h - 16), iso(x, y, h - 16)], 0x6b4c3b);
          poly(g, [iso(x, y + 0.92), iso(x, y + 1), iso(x, y + 1, h - 16), iso(x, y + 0.92, h - 16)], 0x6b4c3b);
          // porte vitrée d'entrée
          poly(g, [iso(x, y + 0.08), iso(x, y + 0.92), iso(x, y + 0.92, h - 16), iso(x, y + 0.08, h - 16)], 0x9ec4de, 0.35, true, 0.5);
        }
      } else {
        poly(g, [iso(x, y), iso(x, y + 1), iso(x, y + 1, h), iso(x, y, h)], shadeN(col, 0.82));
        poly(g, [iso(x, y, h), iso(x, y + 1, h), iso(x - th, y + 1, h), iso(x - th, y, h)], shadeN(col, 1.1));
        if (exterior && h === WALL_H) {
          if (y % 2 === 1 && !['garage', 'preuves', 'escalier'].includes(room.type)) this.windowOn(g, 'y', x, y, d, st);
          poly(g, [iso(x, y), iso(x, y + 1), iso(x, y + 1, 8), iso(x, y, 8)], shadeN(col, 0.68), 1, false);
        }
      }
      g.zIndex = exterior && h === WALL_H ? (x + y - 0.5) * 10 - 2 : (x + y + 0.5) * 10 - 1;
    }
    this.objects.addChild(g);
  }

  private windowOn(g: Graphics, axis: 'x' | 'y', x: number, y: number, day: number, st: GameState) {
    const sky = st.weather.kind === 'clair' ? 0x9ec4de : 0xaab4bc;
    const glass = mix(0x1e2a40, sky, day);
    const P = (u: number, z: number) => (axis === 'x' ? iso(x + u, y, z) : iso(x, y + u, z));
    poly(g, [P(0.18, 26), P(0.82, 26), P(0.82, 60), P(0.18, 60)], 0xf0ece0, 1, true, 1);
    poly(g, [P(0.24, 29), P(0.76, 29), P(0.76, 57), P(0.24, 57)], glass, 1, false);
    const [a1, b1] = P(0.5, 29), [a2, b2] = P(0.5, 57);
    g.moveTo(a1, b1).lineTo(a2, b2).stroke({ width: 1.2, color: 0xf0ece0 });
    // reflet
    const [r1, s1] = P(0.3, 52), [r2, s2] = P(0.42, 38);
    g.moveTo(r1, s1).lineTo(r2, s2).stroke({ width: 1.5, color: 0xffffff, alpha: 0.35 * day });
    // lumière intérieure la nuit
    const l = new Graphics();
    poly(l, [P(0.24, 29), P(0.76, 29), P(0.76, 57), P(0.24, 57)], 0xb08a40, 0.9, false);
    this.lights.addChild(l);
  }

  // ————— personnages —————
  private specFor(s: Staff): CharSpec {
    return { a: s.appearance, sexe: s.sexe, look: lookOf(s) };
  }

  private ensureAgent(id: string, spec: CharSpec, start: { f: number; x: number; y: number }): Agent {
    let a = this.agents.get(id);
    if (a) return a;
    const sprite = new Sprite(charTexture(spec, 'idle', 0, false));
    sprite.anchor.set(0.5, 66 / CHAR_H);
    sprite.scale.set(0.92);
    (sprite as Sprite & { agent?: boolean }).agent = true;
    sprite.eventMode = 'none';
    const bubble = new Graphics();
    (bubble as Graphics & { agent?: boolean }).agent = true;
    a = { id, spec, sprite, bubble, f: start.f, x: start.x, y: start.y, path: [], goal: '', pose: 'idle', back: false, anim: Math.random() * 1000, visible: true, gone: false };
    this.objects.addChild(sprite, bubble);
    this.agents.set(id, a);
    return a;
  }

  private removeAgent(id: string) {
    const a = this.agents.get(id);
    if (!a) return;
    this.objects.removeChild(a.sprite, a.bubble);
    a.sprite.destroy();
    a.bubble.destroy();
    this.agents.delete(id);
  }

  /** Où doit se trouver chaque membre du personnel, d'après sa tâche dans la simulation. */
  private think(st: GameState) {
    const rooms = st.station.rooms.filter((r) => r.built <= st.minute);
    const byType = (t: RoomType) => rooms.filter((r) => r.type === t);
    const desks: { r: Room; x: number; y: number }[] = [];
    for (const r of rooms) if (['bureaux', 'commandant', 'administratif', 'financiere', 'numerique', 'ancien', 'liaison'].includes(r.type)) for (const f of r.furniture) if (f.kind === 'bureau') desks.push({ r, x: f.x, y: f.y });
    const usedDesk = new Set<number>();
    const seat = (x: number, y: number, f: number) => (walkable(st.station, f, x, y - 1) ? { f, x, y: y - 1 } : walkable(st.station, f, x - 1, y) ? { f, x: x - 1, y } : walkable(st.station, f, x, y + 1) ? { f, x, y: y + 1 } : { f, x: x + 1, y });
    const deskFor = (s: Staff, pref: RoomType[]) => {
      for (const t of pref) {
        const i = desks.findIndex((d, k) => !usedDesk.has(k) && d.r.type === t);
        if (i >= 0) { usedDesk.add(i); return seat(desks[i].x, desks[i].y, desks[i].r.floor); }
      }
      void s;
      return null;
    };
    const spotNear = (t: RoomType, k: number, near?: string) => {
      const rs = byType(t);
      if (!rs.length) return null;
      const r = rs[k % rs.length];
      const cells: { x: number; y: number }[] = [];
      const targets = near ? r.furniture.filter((f) => f.kind === near) : [];
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (walkable(st.station, r.floor, x, y) && (!targets.length || targets.some((tt) => Math.abs(tt.x - x) + Math.abs(tt.y - y) === 1))) cells.push({ x, y });
      if (!cells.length) return { f: r.floor, x: r.doors[0].x, y: r.doors[0].y };
      const c = cells[(k * 7) % cells.length];
      return { f: r.floor, x: c.x, y: c.y };
    };
    const entrance = { f: 0, x: 0, y: 6 };
    const garageSpot = spotNear('garage', 0) ?? entrance;
    let ki = 0;
    // bureaux attribués de façon stable (ordre du personnel)
    const deskOf = new Map<string, { f: number; x: number; y: number } | null>();
    for (const s of st.staff) {
      const pref: RoomType[] = s.role === 'commandant' ? ['commandant'] : s.role === 'secretaire' ? ['administratif', 'bureaux'] : s.role === 'technicien' ? [] : s.role === 'agent' ? [] : ['bureaux', 'ancien', 'financiere', 'numerique', 'liaison'];
      deskOf.set(s.id, deskFor(s, pref));
    }
    const interviewRooms = byType('interrogatoire');
    let interviewIdx = 0;
    const activeVisitors = new Set<string>();
    for (const s of st.staff) {
      ki++;
      const t = s.task;
      let target: { f: number; x: number; y: number } | null = null;
      let pose: Pose = 'idle';
      let goal = '';
      if (!t) { goal = 'exit'; target = entrance; }
      else if (t.outside) { goal = 'car'; target = garageSpot; }
      else {
        switch (t.action) {
          case 'entretien': case 'audition': {
            const r = interviewRooms[interviewIdx % Math.max(1, interviewRooms.length)];
            interviewIdx++;
            const table = r?.furniture.find((f) => f.kind === 'table_interro');
            if (r && table) {
              target = { f: r.floor, x: table.x, y: table.y - 1 };
              pose = 'talk';
              goal = `int-${r.id}`;
              // la personne entendue, assise en face
              const c = st.cases.find((x) => x.id === t.caseId);
              const act = c?.actions.find((a) => (a.kind === 'entretien' || a.kind === 'audition') && a.by.includes(s.id));
              if (act?.target && st.people[act.target]) {
                const p = st.people[act.target];
                const vid = `V-${p.id}`;
                activeVisitors.add(vid);
                const v = this.ensureAgent(vid, { a: p.appearance, sexe: p.sexe, look: 'civil' }, entrance);
                v.visitor = { until: Infinity, stage: 1 };
                this.route(st, v, { f: r.floor, x: table.x, y: table.y + 1 }, `int-${r.id}`, 'sit');
                v.sitBack = true;
              }
            } else { target = deskOf.get(s.id) ?? spotNear('bureaux', ki); pose = 'type'; goal = 'desk'; }
            break;
          }
          case 'recherche': target = spotNear(byType('archives').length ? 'archives' : 'bureaux', ki, 'etagere'); pose = 'read'; goal = 'archives'; break;
          case 'recoupement': target = spotNear(byType('briefing').length ? 'briefing' : 'bureaux', ki, 'table'); pose = 'talk'; goal = 'briefing'; break;
          case 'labo': target = s.role === 'technicien' ? spotNear('labo', ki, 'paillasse') : spotNear(byType('preuves').length ? 'preuves' : 'labo', ki); pose = s.role === 'technicien' ? (ki % 2 ? 'read' : 'idle') : 'carry'; goal = 'labo'; break;
          case 'pause': target = spotNear(t.room, ki, t.room === 'cafeteria' ? 'table' : t.room === 'repos' ? 'canape' : undefined) ?? spotNear('vestiaires', ki); pose = ki % 3 ? 'talk' : 'idle'; goal = 'pause'; break;
          case 'accueil': target = spotNear('accueil', ki, 'comptoir'); pose = (Math.floor(st.minute / 30) + ki) % 3 === 0 ? 'phone' : 'idle'; goal = 'accueil'; break;
          case 'requisition': target = deskOf.get(s.id) ?? spotNear('bureaux', ki); pose = (Math.floor(st.minute / 20) + ki) % 2 ? 'phone' : 'type'; goal = 'desk'; break;
          default: target = deskOf.get(s.id) ?? spotNear(t.room, ki) ?? spotNear('bureaux', ki); pose = (Math.floor(st.minute / 40) + ki) % 5 === 0 ? 'phone' : (Math.floor(st.minute / 40) + ki) % 7 === 0 ? 'read' : 'type'; goal = 'desk';
        }
      }
      if (!target) continue;
      let a = this.agents.get(s.id);
      if (!a) {
        if (goal === 'exit' || goal === 'car') continue; // absent : rien à afficher
        a = this.ensureAgent(s.id, this.specFor(s), entrance);
        if (!this.firstThink) this.placed.add(s.id); // arrivée en cours de partie : entre par l'accueil
      }
      a.spec = this.specFor(s);
      if (!this.placed.has(s.id)) {
        // première apparition à l'ouverture de la vue : chacun est déjà à son poste
        this.placed.add(s.id);
        a.f = target.f; a.x = target.x + 0.5; a.y = target.y + 0.5;
      }
      this.route(st, a, target, goal + `@${target.f},${target.x},${target.y}`, pose);
    }
    this.firstThink = false;
    // visiteurs entendus partis
    for (const [id, a] of this.agents) if (id.startsWith('V-') && !activeVisitors.has(id) && a.visitor?.stage === 1) { a.visitor = { until: 0, stage: 9 }; this.route(st, a, entrance, 'exit', 'idle'); }
    // visiteurs à l'accueil (public, presse, magistrats, médecins)
    const cal = calendar(st.startYear, st.minute);
    const open = cal.hour >= 8 && cal.hour < 19;
    const nVis = [...this.agents.keys()].filter((k) => k.startsWith('W-')).length;
    if (open && nVis < 3 && byType('accueil').length && Math.random() < 0.12 * Math.min(4, this.speed)) {
      const kind: Look = st.mediaRequests.some((m) => !m.answered) && Math.random() < 0.3 ? 'presse' : Math.random() < 0.06 ? 'costume' : Math.random() < 0.05 ? 'medecin' : 'civil';
      const sexe = Math.random() < 0.5 ? 'F' : 'M';
      const a = this.ensureAgent(`W-${++this.visitorSeq}`, { a: { skin: Math.floor(Math.random() * 6), hair: Math.floor(Math.random() * 7), hairStyle: sexe === 'F' ? 3 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 3), outfit: Math.floor(Math.random() * 10), build: Math.floor(Math.random() * 3), glasses: Math.random() < 0.3, beard: sexe === 'M' && Math.random() < 0.2 }, sexe, look: kind }, entrance);
      a.visitor = { until: performance.now() + 9000 + Math.random() * 12000, stage: 0 };
      const bench = spotNear('accueil', this.visitorSeq, 'banc');
      if (bench) this.route(st, a, bench, 'bench', 'idle');
    }
    for (const [id, a] of this.agents) {
      if (!id.startsWith('W-') || !a.visitor) continue;
      if (a.visitor.stage === 0 && performance.now() > a.visitor.until) {
        a.visitor.stage = 1;
        const desk = spotNear('accueil', 1, 'comptoir');
        if (desk) this.route(st, a, { ...desk, y: desk.y + 1 }, 'desk', 'talk');
        a.visitor.until = performance.now() + 6000;
      } else if (a.visitor.stage === 1 && performance.now() > a.visitor.until) {
        a.visitor.stage = 9;
        this.route(st, a, entrance, 'exit', 'idle');
      }
    }
  }

  private route(st: GameState, a: Agent, target: { f: number; x: number; y: number }, goal: string, pose: Pose) {
    if (a.goal === goal) { if (!a.path.length) a.pose = pose; return; }
    a.goal = goal;
    a.gone = false;
    const from = { f: a.f, x: Math.round(a.x - 0.5), y: Math.round(a.y - 0.5) };
    const p = navPath(st.station, from, target);
    a.path = p.length ? p.slice(1).map((n) => ({ f: n.f, x: n.x + 0.5, y: n.y + 0.5 })) : [];
    if (!p.length) { a.f = target.f; a.x = target.x + 0.5; a.y = target.y + 0.5; }
    (a as Agent & { endPose?: Pose }).endPose = pose;
    a.sitBack = false;
  }

  // ————— boucle d'affichage —————
  update(dtMs: number, time: number) {
    const st = this.get();
    const sig = `${this.floor}|${st.station.rooms.map((r) => `${r.id}${r.x}${r.y}${r.w}${r.h}${r.built > st.minute}${r.furniture.length}`).join()}|${calendar(st.startYear, st.minute).season}|${st.vehicles.length}|${Math.round(daylight(st.startYear, st.minute) * 4)}|${this.showLabels}`;
    if (sig !== this.sig) { this.sig = sig; this.rebuild(st); }
    if (time - this.lastThink > 400) { this.lastThink = time; this.think(st); }
    const dt = dtMs / 1000;
    const speed = 2.4 * Math.min(3, Math.max(1, Math.sqrt(this.speed || 1)));
    for (const [id, a] of this.agents) {
      a.anim += dtMs;
      if (a.path.length) {
        const n = a.path[0];
        if (n.f !== a.f) { a.f = n.f; a.x = n.x; a.y = n.y; a.path.shift(); continue; }
        const dx = n.x - a.x, dy = n.y - a.y;
        const d = Math.hypot(dx, dy);
        const run = a.goal.startsWith('car') && a.path.length > 3;
        const step = speed * dt * (run ? 1.5 : 1);
        if (d <= step) { a.x = n.x; a.y = n.y; a.path.shift(); }
        else { a.x += (dx / d) * step; a.y += (dy / d) * step; }
        a.back = dx < -0.01 || dy < -0.01;
        a.pose = run ? 'run' : a.goal === 'labo' ? 'carry' : 'walk';
        if (!a.path.length) {
          a.pose = (a as Agent & { endPose?: Pose }).endPose ?? 'idle';
          if (a.goal.startsWith('exit')) { a.gone = true; }
          if (a.goal.startsWith('car')) { a.gone = true; }
          if (a.goal.startsWith('int-') && id.startsWith('V-')) a.back = true;
          else if (a.pose === 'type' || a.pose === 'talk' || a.pose === 'idle' || a.pose === 'phone' || a.pose === 'read') a.back = false;
        }
      }
      if (a.gone && (id.startsWith('W-') || id.startsWith('V-'))) { this.removeAgent(id); continue; }
      const vis = !a.gone && a.f === this.floor;
      a.sprite.visible = vis;
      a.bubble.visible = vis;
      if (!vis) continue;
      const pose: Pose = a.pose === 'type' ? 'type' : a.pose === 'talk' && a.goal.startsWith('int-') ? 'talk' : a.pose;
      const seated = pose === 'type' || (a.goal.startsWith('int-') && !a.path.length) || (a.goal === 'pause' && !a.path.length && (a.anim / 3000) % 2 > 1);
      const frames = pose === 'walk' || pose === 'run' || pose === 'carry' ? 4 : pose === 'type' || pose === 'talk' || pose === 'read' ? 2 : 4;
      const fps = pose === 'run' ? 10 : pose === 'walk' || pose === 'carry' ? 7 : pose === 'idle' ? 0.8 : 3;
      const frame = Math.floor((a.anim / 1000) * fps) % frames;
      const usePose: Pose = seated && pose !== 'type' && pose !== 'talk' ? 'sit' : pose;
      a.sprite.texture = charTexture(a.spec, usePose, frame, a.back);
      const [sx, sy] = iso(a.x, a.y);
      a.sprite.position.set(sx, sy);
      a.sprite.zIndex = (a.x + a.y) * 10 + 0.5;
      // bulles : conversation et téléphone
      a.bubble.clear();
      if (!a.path.length && (pose === 'talk' || pose === 'phone') && Math.floor(a.anim / 1500) % 3 !== 2) {
        const bx = sx + 10, by = sy - 70;
        a.bubble.roundRect(bx - 9, by - 7, 18, 12, 4).fill(0xffffff).stroke({ width: 1, color: 0x1d1a17 });
        a.bubble.poly([bx - 4, by + 5, bx - 1, by + 5, bx - 6, by + 9]).fill(0xffffff);
        for (let i = 0; i < 3; i++) a.bubble.circle(bx - 4 + i * 4, by - 1, 1.2).fill(pose === 'phone' ? 0x3a7ad8 : 0x1d1a17);
      }
      a.bubble.zIndex = a.sprite.zIndex + 0.1;
    }
    // véhicules : sortie et retour au garage
    for (const v of st.vehicles) {
      const vs = this.vehicles.get(v.id);
      if (!vs) continue;
      const out = v.busyUntil > st.minute;
      if (out !== vs.out) { vs.out = out; vs.t = 0; }
      vs.t += dt;
      let x = vs.home.x, y = vs.home.y, dir: 'px' | 'nx' | 'py' | 'ny' = 'ny', visible = true;
      if (out) {
        // sortie : descend vers la rue puis file vers l'est
        const k = vs.t * 1.6;
        if (k < SH + 2 - vs.home.y) { y = vs.home.y + k; dir = 'py'; }
        else { y = SH + 2; x = vs.home.x + (k - (SH + 2 - vs.home.y)); dir = 'px'; visible = x < SW + 4; }
      } else if (vs.t < 6) {
        const k = 6 - vs.t;
        const dy = SH + 2 - vs.home.y;
        if (k * 1.6 > dy) { y = SH + 2; x = vs.home.x + (k * 1.6 - dy); dir = 'nx'; visible = x < SW + 4; }
        else { y = vs.home.y + k * 1.6; }
      }
      const year = calendar(st.startYear, st.minute).year;
      vs.s.texture = vehTexture({ body: '#' + v.color.toString(16).padStart(6, '0'), kind: v.kind === 'fourgon' ? 'fourgon' : 'banalisee', police: true, era: year, lights: out && v.caseId !== null && Math.floor(time / 250) % 2 === 0 }, dir, 0);
      const [px, py] = iso(x, y);
      vs.s.position.set(px, py);
      vs.s.visible = this.floor === 0 && visible;
      vs.s.zIndex = (x + y) * 10 + 3;
    }
    const on = daylight(st.startYear, st.minute) >= 0 && st.staff.some((s) => s.task);
    for (const an of this.anims) animate(an, time, on);
    this.drawOverlay(st);
  }

  private drawOverlay(st: GameState) {
    const g = this.overlay;
    g.clear();
    if (!this.mode) return;
    // grille de construction
    for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (!roomAt(st.station, this.floor, x, y)) poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], 0xffffff, 0.08, false);
    if (this.mode.kind === 'room' && this.dragA && this.dragB) {
      const x0 = Math.min(this.dragA.x, this.dragB.x), y0 = Math.min(this.dragA.y, this.dragB.y);
      const x1 = Math.max(this.dragA.x, this.dragB.x), y1 = Math.max(this.dragA.y, this.dragB.y);
      let ok = x0 >= 0 && y0 >= 0 && x1 < SW && y1 < SH && x1 - x0 >= 1 && y1 - y0 >= 1;
      for (let y = y0; y <= y1 && ok; y++) for (let x = x0; x <= x1; x++) if (roomAt(st.station, this.floor, x, y)) ok = false;
      poly(g, [iso(x0, y0), iso(x1 + 1, y0), iso(x1 + 1, y1 + 1), iso(x0, y1 + 1)], ok ? 0x5ad87a : 0xd85a5a, 0.45, true, 2);
    } else if (this.hoverT) {
      const { x, y } = this.hoverT;
      poly(g, [iso(x, y), iso(x + 1, y), iso(x + 1, y + 1), iso(x, y + 1)], 0xffe08a, 0.5, true, 1.5);
    }
  }

  private toTile(wx: number, wy: number) {
    const a = wx / (TW / 2), b = wy / (TH / 2);
    return { x: Math.floor((a + b) / 2), y: Math.floor((b - a) / 2) };
  }

  hover(wx: number, wy: number) {
    this.hoverT = this.mode ? this.toTile(wx, wy) : null;
  }

  drag(phase: 'start' | 'move' | 'end', wx: number, wy: number): boolean {
    if (this.mode?.kind !== 'room') return false;
    const t = this.toTile(wx, wy);
    if (phase === 'start') { this.dragA = t; this.dragB = t; return true; }
    if (phase === 'move') { this.dragB = t; return true; }
    if (this.dragA && this.dragB) {
      const x0 = Math.min(this.dragA.x, this.dragB.x), y0 = Math.min(this.dragA.y, this.dragB.y);
      const w = Math.abs(this.dragA.x - this.dragB.x) + 1, h = Math.abs(this.dragA.y - this.dragB.y) + 1;
      this.cb.onBuildRect?.(this.floor, x0, y0, w, h);
    }
    this.dragA = this.dragB = null;
    return true;
  }

  tap(wx: number, wy: number) {
    const st = this.get();
    const t = this.toTile(wx, wy);
    if (this.mode?.kind === 'furniture') {
      const r = roomAt(st.station, this.floor, t.x, t.y);
      if (r) this.cb.onPlaceFurniture?.(r.id, t.x, t.y);
      return;
    }
    // personnage le plus proche du point touché
    let best: Agent | null = null, bd = 30;
    for (const a of this.agents.values()) {
      if (!a.sprite.visible || a.id.startsWith('W-') || a.id.startsWith('V-')) continue;
      const [sx, sy] = iso(a.x, a.y);
      const d = Math.hypot(sx - wx, sy - 30 - wy);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) { this.cb.onStaff(best.id); return; }
    const r = roomAt(st.station, this.floor, t.x, t.y);
    if (r) this.cb.onRoom(r.id);
  }

  /** Position écran (monde) d'un membre du personnel, pour centrer la caméra. */
  agentPos(id: string): { x: number; y: number; f: number } | null {
    const a = this.agents.get(id);
    if (!a) return null;
    const [x, y] = iso(a.x, a.y);
    return { x, y: y - 30, f: a.f };
  }

  destroy() {
    this.root.destroy({ children: true });
    this.lights.destroy({ children: true });
    this.agents.clear();
  }
}

export type { Person };
