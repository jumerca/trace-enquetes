// Scène isométrique PixiJS : sol en chunks, objets triés en profondeur, caméra tactile, culling,
// interpolation des déplacements, ambiance (saisons, jour/nuit, météo). Ne modifie jamais la simulation.
import { Application, Container, Graphics, Sprite, Texture, CanvasSource } from 'pixi.js';
import { BUILDINGS, LOT_SIZE, ORCHARD_CAP } from '../data/content';
import { hash2 } from '../core/rng';
import { D, HAMLET_PATHS, PATHS, ROAD_EAST, ROAD_NORTH, ROAD_WEST, T, isOwned, isPathLike, lotOf, rasterLine, type World } from '../world/terrain';
import { defOf, doorOf, footprint } from '../sim/geom';
import { minuteOfDay, seasonOf, type Sim } from '../sim/sim';
import type { Building } from '../sim/state';
import { Atlas, MIRROR_PAINTED, TREE_KEYS, buildAtlas, buildStaticAtlas, type Tex } from './atlas';
import { RES, TH, TW, setPaintRes, type Season } from './paint';
import { agentDepth, buildingDepth, tileDepth } from './depth';

const CHUNK = 16;
const isoX = (x: number, y: number) => (x - y) * (TW / 2);
const isoY = (x: number, y: number) => (x + y) * (TH / 2);

interface Obj {
  sp: Sprite;
  key: string;
  depth: number;
  // boîte englobante monde pour le culling
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface Ghost {
  type: string | 'chemin';
  x: number;
  y: number;
  rot: 0 | 1;
  ok: boolean;
}

export interface SceneCallbacks {
  onTap(tx: number, ty: number, pointerType: string): void;
  onHover(tx: number, ty: number): void;
}

export interface SceneOptions {
  quality: 'haute' | 'basse';
}

export class Scene {
  app = new Application();
  world = new Container();
  ground = new Container();
  marks = new Graphics(); // surlignages au sol
  objects = new Container();
  fx = new Container();
  night = new Graphics();
  rain = new Graphics();
  seasonAtlas = new Atlas();
  staticAtlas = new Atlas();
  season: Season = 1;
  private groundSprites: Sprite[] = [];
  private roads = new Graphics();
  /** cases dont la route/le chemin d'origine est dessiné en courbe lissée (et non en tuile) */
  private smooth = new Set<number>();
  private chunks: Container[] = [];
  private decor = new Map<number, Obj>(); // par index de case
  private bObjs = new Map<number, Obj[]>(); // par bâtiment
  private agents = new Map<string, Obj & { carry?: Sprite }>();
  private smoke: { sp: Sprite; vx: number; life: number }[] = [];
  private smokeTex!: Texture;
  private smokeAcc = 0;
  private lastRev = -1;
  private fieldSig = new Map<number, string>();
  private orchardSig = new Map<number, number>();
  private viewDirty = true;
  cam = { x: 0, y: 0, z: 1 };
  ghost: Ghost | null = null;
  ghostSprite: Sprite | null = null;
  selected: number | null = null;
  showLots = false;
  fps = 0;
  private time = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; type: string }>();
  private pinch: { d: number; mx: number; my: number } | null = null;
  private moved = false;

  constructor(private host: HTMLElement, public sim: Sim, private cb: SceneCallbacks, private opts: SceneOptions) {}

  async init() {
    setPaintRes(this.opts.quality === 'basse' ? 1 : Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1))));
    await this.app.init({
      resizeTo: this.host,
      background: '#3d5a2a',
      antialias: false,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, this.opts.quality === 'basse' ? 1 : 2),
      powerPreference: 'high-performance',
      preference: 'webgl',
    });
    this.host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.canvas.setAttribute('aria-label', 'Carte du domaine');
    this.app.stage.addChild(this.world, this.fx);
    this.world.addChild(this.ground, this.marks, this.objects);
    this.objects.sortableChildren = true;
    this.fx.addChild(this.rain, this.night);
    this.season = seasonOf(this.sim.s.minute);
    buildStaticAtlas(this.staticAtlas);
    this.staticAtlas.pack();
    buildAtlas(this.seasonAtlas, this.season);
    this.seasonAtlas.pack();
    this.smokeTex = softTexture();
    this.buildGround();
    this.syncWorld();
    this.centerOn(47, 46, window.innerWidth < 700 ? 0.8 : 1);
    this.bindInput();
  }

  tex(key: string): Tex {
    return this.seasonAtlas.map.get(key) ?? this.staticAtlas.get(key);
  }

  private setTex(sp: Sprite, key: string) {
    const t = this.tex(key);
    sp.texture = t.tex;
    sp.anchor.set(t.ax, t.ay);
  }

  // ————— sol —————
  private buildGround() {
    const W = this.sim.s.world;
    const per = Math.ceil(W.w / CHUNK);
    for (let cy = 0; cy < per; cy++)
      for (let cx = 0; cx < per; cx++) {
        const c = new Container();
        c.cullable = false;
        this.chunks.push(c);
        this.ground.addChild(c);
      }
    for (let y = 0; y < W.h; y++)
      for (let x = 0; x < W.w; x++) {
        const sp = new Sprite();
        sp.position.set(isoX(x, y), isoY(x, y));
        this.groundSprites.push(sp);
        this.chunks[Math.floor(y / CHUNK) * per + Math.floor(x / CHUNK)].addChild(sp);
      }
    this.ground.addChild(this.roads);
    this.buildRoads();
    this.refreshAllTiles();
  }

  /** Routes et chemins d'origine : courbe lissée (Chaikin) passant par les centres des cases. */
  private buildRoads() {
    const W = this.sim.s.world;
    const g = this.roads;
    g.clear();
    this.smooth.clear();
    const chains: { pts: [number, number][]; road: boolean }[] = [
      ...[ROAD_EAST, ROAD_WEST, ROAD_NORTH].map((p) => ({ pts: p, road: true })),
      ...[...PATHS, ...HAMLET_PATHS].map((p) => ({ pts: p, road: false })),
    ];
    const winter = this.season === 3;
    for (const ch of chains) {
      let tiles = rasterLine(ch.pts).filter(([x, y]) => x >= 0 && y >= 0 && x < W.w && y < W.h);
      // on s'arrête dans la cour (la courbe s'y fond)
      const isCour = (t: [number, number]) => W.terrain[t[1] * W.w + t[0]] === T.cour;
      const first = tiles.findIndex(isCour);
      if (first > 0) tiles = tiles.slice(0, first + 1);
      else if (first === 0) {
        let k = 0;
        while (k < tiles.length - 1 && isCour(tiles[k + 1])) k++;
        tiles = tiles.slice(k);
      }
      for (const [x, y] of tiles) {
        const t = W.terrain[y * W.w + x];
        if (t === T.route || t === T.chemin || t === T.pont) this.smooth.add(y * W.w + x);
      }
      let pts = tiles.map(([x, y]) => [isoX(x + 0.5, y + 0.5), isoY(x + 0.5, y + 0.5)] as [number, number]);
      for (let it = 0; it < 3; it++) {
        const out: [number, number][] = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
        }
        out.push(pts[pts.length - 1]);
        pts = out;
      }
      const stroke = (width: number, color: number, alpha = 1) => {
        g.moveTo(pts[0][0], pts[0][1]);
        for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
        g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
      };
      if (ch.road) {
        stroke(30, 0x7f8a5a, 0.55);
        stroke(25, winter ? 0xb9b2a0 : 0xc8bca0);
        stroke(9, 0xd8cfb6, 0.7);
      } else {
        stroke(19, 0x6c8c30, 0.5);
        stroke(15, winter ? 0xa8977c : 0xb8956a);
        stroke(4, 0xcaa97c, 0.6);
      }
      // ponts : tablier de bois au-dessus de l'eau
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length) {
          const a = run[0], b = run[run.length - 1];
          const [ax, ay] = [isoX(a[0] + 0.5, a[1] + 0.5), isoY(a[0] + 0.5, a[1] + 0.5)];
          const [bx, by] = [isoX(b[0] + 0.5, b[1] + 0.5), isoY(b[0] + 0.5, b[1] + 0.5)];
          const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
          const ex = (dx / L) * 22, ey = (dy / L) * 22;
          g.moveTo(ax - ex, ay - ey).lineTo(bx + ex, by + ey).stroke({ width: 30, color: 0x5c4026 });
          g.moveTo(ax - ex, ay - ey).lineTo(bx + ex, by + ey).stroke({ width: 24, color: 0x9a7248 });
          const n = Math.floor((L + 44) / 5);
          for (let k = 0; k <= n; k++) {
            const t = k / n;
            const cx = ax - ex + (dx + 2 * ex) * t, cy = ay - ey + (dy + 2 * ey) * t;
            g.moveTo(cx - (dy / L) * 11, cy + (dx / L) * 11).lineTo(cx + (dy / L) * 11, cy - (dx / L) * 11);
          }
          g.stroke({ width: 1, color: 0x6b4a2c, alpha: 0.8 });
        }
        run = [];
      };
      for (const t of tiles) {
        if (W.terrain[t[1] * W.w + t[0]] === T.pont) run.push(t);
        else flush();
      }
      flush();
    }
  }

  private refreshAllTiles() {
    const W = this.sim.s.world;
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) this.refreshTile(x, y);
  }

  private tileKey(x: number, y: number): string {
    const W = this.sim.s.world;
    const i = y * W.w + x;
    const t = W.terrain[i];
    const v = Math.floor(hash2(x, y, W.seed) * 4);
    const o = this.sim.occ[i];
    if (o >= 0) {
      const b = this.sim.byId.get(o)!;
      const k = defOf(b).kind;
      if (k === 'verger') return `t:verger:${v & 1}`;
      if (k === 'enclos') return `t:enclos:${v & 1}`;
      if (k === 'champ') return `t:champ:${fieldStage(b, x, y)}:${v & 1}`;
      return `t:cour:${v}`;
    }
    const at = (dx: number, dy: number) => {
      const xx = x + dx, yy = y + dy;
      return xx < 0 || yy < 0 || xx >= W.w || yy >= W.h ? -1 : W.terrain[yy * W.w + xx];
    };
    const mask = (f: (t: number) => boolean) => (f(at(1, 0)) ? 1 : 0) | (f(at(0, 1)) ? 2 : 0) | (f(at(-1, 0)) ? 4 : 0) | (f(at(0, -1)) ? 8 : 0);
    if (this.smooth.has(i)) {
      if (t === T.pont) return `t:eau:15`;
      // amorce vers un chemin tracé par le joueur ou la cour (la courbe recouvre le centre)
      const m = mask((n) => n === T.chemin || n === T.cour) & ~this.smoothMask(x, y);
      return m ? `t:chemin:${m}` : `t:herbe:${v}`;
    }
    switch (t) {
      case T.herbe:
        return `t:herbe:${v}`;
      case T.pre:
        return `t:pre:${v}`;
      case T.bois:
        return `t:bois:${v}`;
      case T.cour: {
        const m = mask((n) => n !== T.cour && n !== -1 && !isPathLike(n) && n !== T.eau);
        return m ? `t:cour:${v & 1}:${m}` : `t:cour:${v}`;
      }
      case T.eau:
        return `t:eau:${mask((n) => n === T.eau || n === T.pont || n === -1)}`;
      case T.pont:
        return at(1, 0) === T.route || at(-1, 0) === T.route ? 't:pont:x' : 't:pont:y';
      case T.chemin:
        return `t:chemin:${mask((n) => isPathLike(n))}`;
      case T.route:
        return `t:route:${mask((n) => n === T.route || n === T.pont || n === T.cour || n === T.chemin)}`;
    }
    return 't:herbe:0';
  }

  private smoothMask(x: number, y: number) {
    const W = this.sim.s.world;
    const h = (dx: number, dy: number) => this.smooth.has((y + dy) * W.w + x + dx);
    return (h(1, 0) ? 1 : 0) | (h(0, 1) ? 2 : 0) | (h(-1, 0) ? 4 : 0) | (h(0, -1) ? 8 : 0);
  }

  private refreshTile(x: number, y: number) {
    const W = this.sim.s.world;
    if (x < 0 || y < 0 || x >= W.w || y >= W.h) return;
    const sp = this.groundSprites[y * W.w + x];
    const t = this.tex(this.tileKey(x, y));
    sp.texture = t.tex;
    sp.anchor.set(0.5, 0);
    sp.tint = isOwned(W, x, y) ? 0xffffff : 0xc9c4b4;
  }

  // ————— objets statiques —————
  private place(sp: Sprite, gx: number, gy: number) {
    sp.position.set(isoX(gx, gy), isoY(gx, gy));
  }

  private makeObj(key: string, gx: number, gy: number, depth: number, mirror = false): Obj {
    const sp = new Sprite();
    this.setTex(sp, key);
    this.place(sp, gx, gy);
    if (mirror) sp.scale.x = -1;
    sp.zIndex = depth;
    this.objects.addChild(sp);
    const b = sp.getLocalBounds();
    const sx = sp.x, sy = sp.y;
    return { sp, key, depth, x0: sx + Math.min(b.minX * sp.scale.x, b.maxX * sp.scale.x), y0: sy + b.minY, x1: sx + Math.max(b.minX * sp.scale.x, b.maxX * sp.scale.x), y1: sy + b.maxY };
  }

  /** Synchronise décor et bâtiments avec la simulation (après construction, démolition, chemin…). */
  syncWorld() {
    const W = this.sim.s.world;
    // décor
    for (let y = 0; y < W.h; y++)
      for (let x = 0; x < W.w; x++) {
        const i = y * W.w + x;
        const d = W.decor[i];
        const key = this.decorKey(d, x, y);
        const cur = this.decor.get(i);
        if (cur && cur.key === key) continue;
        if (cur) {
          cur.sp.destroy();
          this.decor.delete(i);
        }
        if (key) {
          const o = this.makeObj(key, x + 0.5, y + 0.5, tileDepth(x, y) + (d === D.fleurs || d === D.lavande ? -0.5 : 0), hash2(x, y, 77) < 0.5 && d !== D.maisonHameau);
          if (!isOwned(W, x, y)) o.sp.tint = 0xd8d4c8;
          this.decor.set(i, o);
        }
      }
    // bâtiments
    const seen = new Set<number>();
    for (const b of this.sim.s.buildings) {
      seen.add(b.id);
      if (!this.bObjs.has(b.id)) this.bObjs.set(b.id, this.buildingObjs(b));
    }
    for (const [id, objs] of this.bObjs)
      if (!seen.has(id)) {
        for (const o of objs) o.sp.destroy();
        this.bObjs.delete(id);
        this.fieldSig.delete(id);
        this.orchardSig.delete(id);
      }
    this.refreshAllTiles();
    this.lastRev = this.sim.worldRev;
    this.viewDirty = true;
  }

  private decorKey(d: number, x: number, y: number): string | null {
    const h = hash2(x, y, 5);
    if (TREE_KEYS[d]) {
      const [sp, n] = TREE_KEYS[d];
      return `tree:${sp}:${Math.floor(h * n)}`;
    }
    if (d === D.rocher) return `rock:${Math.floor(h * 2)}`;
    if (d === D.fleurs) return `flowers:${Math.floor(h * 3)}`;
    if (d === D.maisonHameau) return `b:hameau${Math.floor(h * 2)}`;
    if (d === D.voiture) return `car:${Math.floor(h * 3)}`;
    if (d === D.lavande) return `lavande:${Math.floor(h * 2)}`;
    if (d === D.puits) return 'prop:puits';
    if (d === D.foin) return 'prop:foin';
    if (d === D.charrette) return 'prop:charrette';
    return null;
  }

  private buildingObjs(b: Building): Obj[] {
    const def = defOf(b);
    const s = def.size;
    const out: Obj[] = [];
    if (def.kind === 'verger') {
      for (const [x, y] of footprint(b)) out.push(this.makeObj(`pommier:0:${(x + y) & 1}`, x + 0.5, y + 0.5, tileDepth(x, y), (x * 7 + y) % 3 === 0));
    } else if (def.kind === 'champ') {
      // pas de volume : sol uniquement
    } else {
      // ancrage des sprites de bâtiment = sommet haut de l'emprise
      if (def.kind === 'enclos') out.push(this.makeObj('b:abri', b.x, b.y, tileDepth(b.x, b.y)));
      else if (b.rot === 1 && MIRROR_PAINTED.has(b.type)) out.push(this.makeObj(`b:${b.type}:m`, b.x, b.y, buildingDepth(b.x, b.y, s)));
      else out.push(this.makeObj(`b:${b.type}`, b.x, b.y, buildingDepth(b.x, b.y, s), b.rot === 1));
    }
    if (def.kind === 'enclos' || def.kind === 'verger') {
      const gate = this.sim.gateOf(b);
      for (const [x, y] of footprint(b)) {
        let back = 0, front = 0;
        if (x === b.x && !(gate[0] === x - 1 && gate[1] === y)) back |= 4;
        if (y === b.y && !(gate[1] === y - 1 && gate[0] === x)) back |= 8;
        if (x === b.x + s - 1 && !(gate[0] === x + 1 && gate[1] === y)) front |= 1;
        if (y === b.y + s - 1 && !(gate[1] === y + 1 && gate[0] === x)) front |= 2;
        if (back) out.push(this.makeObj(`fence:${back}`, x + 0.5, y + 0.5, x + y + 0.6));
        if (front) out.push(this.makeObj(`fence:${front}`, x + 0.5, y + 0.5, x + y + 1.6));
      }
    }
    return out;
  }

  // ————— saisons —————
  private setSeason(s: Season) {
    this.season = s;
    this.buildRoads();
    buildAtlas(this.seasonAtlas, s);
    this.seasonAtlas.pack();
    this.refreshAllTiles();
    for (const o of this.decor.values()) this.setTex(o.sp, o.key);
    for (const objs of this.bObjs.values()) for (const o of objs) this.setTex(o.sp, o.key);
    this.orchardSig.clear();
  }

  // ————— boucle de rendu —————
  /** alpha : fraction du pas de simulation écoulée (interpolation). */
  update(dtMs: number, alpha: number) {
    const s = this.sim.s;
    this.time += dtMs;
    this.fps = this.app.ticker.FPS;
    if (this.sim.worldRev !== this.lastRev) this.syncWorld();
    const season = seasonOf(s.minute);
    if (season !== this.season) this.setSeason(season);
    this.updateCrops();
    this.updateAgents(alpha);
    this.updateGhost();
    this.updateMarks();
    this.applyCamera();
    this.cull();
    this.updateFx(dtMs);
  }

  private updateCrops() {
    for (const b of this.sim.s.buildings) {
      const k = defOf(b).kind;
      if (k === 'champ') {
        const sig = `${fieldStage(b, -1, -1)}:${b.reaped.length}`;
        if (this.fieldSig.get(b.id) !== sig) {
          this.fieldSig.set(b.id, sig);
          for (const [x, y] of footprint(b)) this.refreshTile(x, y);
        }
      } else if (k === 'verger') {
        const lvl = b.ready < 8 ? 0 : b.ready < ORCHARD_CAP * 0.35 ? 1 : b.ready < ORCHARD_CAP * 0.7 ? 2 : 3;
        if (this.orchardSig.get(b.id) !== lvl) {
          this.orchardSig.set(b.id, lvl);
          for (const o of this.bObjs.get(b.id) ?? []) if (o.key.startsWith('pommier')) {
            o.key = `pommier:${lvl}:${o.key.slice(-1)}`;
            this.setTex(o.sp, o.key);
          }
        }
      }
    }
  }

  private agentSprite(id: string, key: string): Obj & { carry?: Sprite } {
    let a = this.agents.get(id);
    if (!a) {
      const sp = new Sprite();
      this.objects.addChild(sp);
      a = { sp, key: '', depth: 0, x0: 0, y0: 0, x1: 0, y1: 0 };
      this.agents.set(id, a);
    }
    if (a.key !== key) {
      this.setTex(a.sp, key);
      a.key = key;
    }
    return a;
  }

  private updateAgents(alpha: number) {
    const s = this.sim.s;
    const seen = new Set<string>();
    const walkFrame = (id: number) => [1, 0, 2, 0][Math.floor((this.time / 150 + id) % 4)];
    const put = (o: Obj, x: number, y: number, depthBias = 0.02) => {
      o.sp.position.set(isoX(x + 0.5, y + 0.5), isoY(x + 0.5, y + 0.5));
      o.sp.zIndex = agentDepth(x, y, depthBias);
    };
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const face = (dir: number): [0 | 1, number] => (dir === 0 ? [0, 1] : dir === 1 ? [0, -1] : dir === 2 ? [1, -1] : [1, 1]);
    for (const w of s.workers) {
      const id = 'w' + w.id;
      if (w.hidden) continue;
      seen.add(id);
      const moving = w.x !== w.px || w.y !== w.py;
      const working = !moving && w.timer > 0 && ['pick', 'process', 'reapTile', 'take', 'put'].includes(w.steps[0]?.k ?? '');
      const [f, sx] = face(w.dir);
      const fr = moving ? walkFrame(w.id) : working ? 3 + (Math.floor(this.time / 300) % 2) : 0;
      const o = this.agentSprite(id, `p:${w.role}:${f}:${fr}`);
      o.sp.scale.x = sx;
      put(o, lerp(w.px, w.x), lerp(w.py, w.y));
      // charge portée
      if (w.carry) {
        if (!o.carry) {
          o.carry = new Sprite();
          o.sp.addChild(o.carry);
        }
        const t = this.tex(`carry:${w.carry.res}`);
        o.carry.texture = t.tex;
        o.carry.anchor.set(t.ax, t.ay);
        o.carry.position.set(f === 0 ? 0 : 0, -12);
        o.carry.visible = f === 0;
      } else if (o.carry) o.carry.visible = false;
    }
    for (const v of s.visitors) {
      const id = 'v' + v.id;
      seen.add(id);
      const moving = v.x !== v.px || v.y !== v.py;
      const [f, sx] = face(v.dir);
      const o = this.agentSprite(id, `p:v${v.look}:${f}:${moving ? walkFrame(v.id) : 0}`);
      o.sp.scale.x = sx;
      // léger décalage pour éviter que les visiteurs d'un même point se superposent
      const j = (hash2(v.id, 3, 1) - 0.5) * 0.5;
      put(o, lerp(v.px, v.x) + j, lerp(v.py, v.y) - j);
    }
    for (const v of s.vehicles) {
      const id = 'veh' + v.id;
      seen.add(id);
      const [f, sx] = face(v.dir);
      const key = v.kind === 'tracteur' ? `tracteur:${f}:${v.load ? 1 : 0}` : `camionnette:${f}`;
      const o = this.agentSprite(id, key);
      o.sp.scale.x = sx;
      put(o, lerp(v.px, v.x), lerp(v.py, v.y), 0.1);
    }
    for (const a of s.animals) {
      const id = 'a' + a.id;
      seen.add(id);
      const moving = a.x !== a.px || a.y !== a.py;
      const fr = moving ? Math.floor(this.time / 220 + a.id) % 2 : 0;
      const [f, sx] = face(a.dir);
      const o = this.agentSprite(id, a.kind === 'chevre' ? `goat:${a.look}:${f}:${fr}` : `hen:${a.look}:${fr}`);
      o.sp.scale.x = a.kind === 'poule' ? (a.dir === 1 || a.dir === 2 ? -1 : 1) : sx;
      put(o, lerp(a.px, a.x) - 0.5, lerp(a.py, a.y) - 0.5, 0.01);
    }
    for (const [id, o] of this.agents)
      if (!seen.has(id)) {
        o.sp.destroy({ children: true });
        this.agents.delete(id);
      }
  }

  // ————— fantôme de construction et surlignages —————
  private updateGhost() {
    const g = this.ghost;
    if (!g || g.type === 'chemin') {
      if (this.ghostSprite) {
        this.ghostSprite.destroy();
        this.ghostSprite = null;
      }
      return;
    }
    const def = BUILDINGS[g.type];
    const kind = def.kind;
    const mir = g.rot === 1 && MIRROR_PAINTED.has(g.type);
    const key = kind === 'verger' ? 'pommier:2:0' : kind === 'enclos' ? 'b:abri' : kind === 'champ' ? null : mir ? `b:${g.type}:m` : `b:${g.type}`;
    if (!key) {
      if (this.ghostSprite) this.ghostSprite.visible = false;
      return;
    }
    if (!this.ghostSprite) {
      this.ghostSprite = new Sprite();
      this.objects.addChild(this.ghostSprite);
    }
    const sp = this.ghostSprite;
    sp.visible = true;
    this.setTex(sp, key);
    const s = def.size;
    if (kind === 'verger') this.place(sp, g.x + s / 2, g.y + s / 2);
    else sp.position.set(isoX(g.x, g.y), isoY(g.x, g.y));
    sp.scale.x = g.rot === 1 && kind !== 'verger' && !mir ? -1 : 1;
    sp.alpha = 0.72;
    sp.tint = g.ok ? 0xffffff : 0xff9a8a;
    sp.zIndex = 100000;
  }

  private updateMarks() {
    const m = this.marks;
    m.clear();
    const dia = (x: number, y: number, w: number, h: number) => {
      m.poly([isoX(x, y), isoY(x, y), isoX(x + w, y), isoY(x + w, y), isoX(x + w, y + h), isoY(x + w, y + h), isoX(x, y + h), isoY(x, y + h)]);
    };
    const W = this.sim.s.world;
    if (this.showLots || this.ghost) {
      // limites des lots de terrain
      const per = Math.ceil(W.w / LOT_SIZE);
      for (let ly = 0; ly < per; ly++)
        for (let lx = 0; lx < per; lx++) {
          const owned = W.owned[ly * per + lx];
          if (owned && !this.showLots) continue;
          dia(lx * LOT_SIZE + 0.15, ly * LOT_SIZE + 0.15, LOT_SIZE - 0.3, LOT_SIZE - 0.3);
          m.stroke({ width: 3, color: owned ? 0xf3e6c4 : 0x5a3c22, alpha: owned ? 0.8 : 0.45 });
        }
    }
    if (this.selected != null) {
      const b = this.sim.byId.get(this.selected);
      if (b) {
        const s = defOf(b).size;
        dia(b.x, b.y, s, s);
        m.stroke({ width: 3, color: 0xffe08a, alpha: 0.95 });
        m.fill({ color: 0xffe08a, alpha: 0.12 });
      }
    }
    const g = this.ghost;
    if (g) {
      const s = g.type === 'chemin' ? 1 : BUILDINGS[g.type].size;
      dia(g.x, g.y, s, s);
      m.fill({ color: g.ok ? 0x5fbf4a : 0xd8443a, alpha: 0.38 });
      m.stroke({ width: 2, color: g.ok ? 0xc8f0a0 : 0xffb0a0, alpha: 0.9 });
      if (g.type !== 'chemin' && !['verger', 'champ', 'enclos'].includes(BUILDINGS[g.type].kind)) {
        const [dx, dy] = doorOf({ x: g.x, y: g.y, type: g.type, rot: g.rot });
        dia(dx + 0.25, dy + 0.25, 0.5, 0.5);
        m.fill({ color: 0xffe08a, alpha: 0.9 });
      }
    }
  }

  // ————— ambiance —————
  private updateFx(dtMs: number) {
    const s = this.sim.s;
    const w = this.app.screen.width, h = this.app.screen.height;
    const mod = minuteOfDay(s.minute);
    const hour = mod / 60;
    // lumière : nuit bleutée, aube/crépuscule dorés
    let a = 0, col = 0x0b1840;
    if (hour < 5 || hour >= 21.5) a = 0.5;
    else if (hour < 7) {
      a = 0.5 * (1 - (hour - 5) / 2);
      col = 0x402a50;
    } else if (hour >= 19) {
      a = 0.5 * ((hour - 19) / 2.5);
      col = hour < 20.3 ? 0x6a3a20 : 0x1a1a48;
    }
    const weatherDim = s.weather === 'orage' ? 0.22 : s.weather === 'pluie' ? 0.12 : s.weather === 'nuageux' ? 0.05 : 0;
    this.night.clear();
    if (a + weatherDim > 0.01) {
      this.night.rect(0, 0, w, h);
      this.night.fill({ color: a > 0.02 ? col : 0x30384a, alpha: Math.min(0.62, a + weatherDim) });
    }
    // pluie / neige
    this.rain.clear();
    if (s.weather === 'pluie' || s.weather === 'orage' || s.weather === 'neige') {
      const n = s.weather === 'orage' ? 220 : s.weather === 'neige' ? 140 : 140;
      const t = this.time / 1000;
      for (let i = 0; i < n; i++) {
        const sx = (hash2(i, 1, 3) * w + t * (s.weather === 'neige' ? 20 : 120)) % w;
        const sy = (hash2(i, 2, 3) * h + t * (s.weather === 'neige' ? 40 : 520) * (0.8 + hash2(i, 4, 3) * 0.4)) % h;
        if (s.weather === 'neige') this.rain.circle(sx, sy, 1.6);
        else this.rain.moveTo(sx, sy).lineTo(sx - 3, sy + 12);
      }
      if (s.weather === 'neige') this.rain.fill({ color: 0xffffff, alpha: 0.85 });
      else this.rain.stroke({ width: 1, color: 0xcfe4f4, alpha: 0.45 });
    }
    // fumées de cheminée (maison, boulangerie)
    this.smokeAcc += dtMs;
    if (this.smokeAcc > 450) {
      this.smokeAcc = 0;
      for (const b of s.buildings) {
        if (b.type !== 'maison' && b.type !== 'boulangerie') continue;
        if (b.type === 'boulangerie' && b.busyBy == null) continue;
        const sz = defOf(b).size;
        const cx = b.x + sz * (b.rot ? 0.5 : 0.35), cy = b.y + sz * (b.rot ? 0.35 : 0.5);
        const sp = new Sprite(this.smokeTex);
        sp.anchor.set(0.5);
        sp.position.set(isoX(cx, cy), isoY(cx, cy) - (b.type === 'maison' ? 96 : 66));
        sp.alpha = 0.5;
        sp.scale.set(0.4);
        sp.zIndex = 200000;
        this.objects.addChild(sp);
        this.smoke.push({ sp, vx: 4 + Math.random() * 4, life: 1 });
      }
    }
    for (const p of this.smoke) {
      p.life -= dtMs / 4000;
      p.sp.y -= dtMs * 0.012;
      p.sp.x += (dtMs / 1000) * p.vx;
      p.sp.scale.set(0.4 + (1 - p.life) * 0.9);
      p.sp.alpha = Math.max(0, p.life * 0.45);
    }
    this.smoke = this.smoke.filter((p) => {
      if (p.life > 0) return true;
      p.sp.destroy();
      return false;
    });
  }

  // ————— caméra —————
  applyCamera() {
    const { width, height } = this.app.screen;
    const z = this.cam.z;
    this.world.scale.set(z);
    this.world.position.set(Math.round(width / 2 - this.cam.x * z), Math.round(height / 2 - this.cam.y * z));
  }

  private clampCam() {
    const W = this.sim.s.world;
    const minX = isoX(0, W.h), maxX = isoX(W.w, 0), maxY = isoY(W.w, W.h);
    this.cam.x = Math.max(minX * 0.85, Math.min(maxX * 0.85, this.cam.x));
    this.cam.y = Math.max(maxY * 0.08, Math.min(maxY * 0.92, this.cam.y));
    this.cam.z = Math.max(0.3, Math.min(2.2, this.cam.z));
    this.viewDirty = true;
  }

  centerOn(tx: number, ty: number, zoom?: number) {
    this.cam.x = isoX(tx + 0.5, ty + 0.5);
    this.cam.y = isoY(tx + 0.5, ty + 0.5);
    if (zoom) this.cam.z = zoom;
    this.clampCam();
  }

  zoomBy(f: number, sx?: number, sy?: number) {
    const { width, height } = this.app.screen;
    const px = sx ?? width / 2, py = sy ?? height / 2;
    const before = this.screenToWorld(px, py);
    this.cam.z = Math.max(0.3, Math.min(2.2, this.cam.z * f));
    // garde le point sous le curseur immobile
    this.cam.x = before.x - (px - width / 2) / this.cam.z;
    this.cam.y = before.y - (py - height / 2) / this.cam.z;
    this.clampCam();
  }

  panBy(dx: number, dy: number) {
    this.cam.x -= dx / this.cam.z;
    this.cam.y -= dy / this.cam.z;
    this.clampCam();
  }

  screenToWorld(sx: number, sy: number) {
    const { width, height } = this.app.screen;
    return { x: (sx - width / 2) / this.cam.z + this.cam.x, y: (sy - height / 2) / this.cam.z + this.cam.y };
  }

  /** Centre d'une case en coordonnées écran (tests et aides). */
  tileToScreen(tx: number, ty: number): [number, number] {
    const { width, height } = this.app.screen;
    return [(isoX(tx + 0.5, ty + 0.5) - this.cam.x) * this.cam.z + width / 2, (isoY(tx + 0.5, ty + 0.5) - this.cam.y) * this.cam.z + height / 2];
  }

  screenToTile(sx: number, sy: number): [number, number] {
    const p = this.screenToWorld(sx, sy);
    const a = p.x / (TW / 2), b = p.y / (TH / 2);
    return [Math.floor((a + b) / 2), Math.floor((b - a) / 2)];
  }

  /** Bâtiment sous le pointeur : emprise d'abord, puis silhouette (toits). */
  pickBuilding(sx: number, sy: number): number | null {
    const [tx, ty] = this.screenToTile(sx, sy);
    const W = this.sim.s.world;
    if (tx >= 0 && ty >= 0 && tx < W.w && ty < W.h) {
      const o = this.sim.occ[ty * W.w + tx];
      if (o >= 0) return o;
    }
    const p = this.screenToWorld(sx, sy);
    let best: number | null = null, bd = -Infinity;
    for (const [id, objs] of this.bObjs) {
      const o = objs[0];
      if (!o || !o.key.startsWith('b:')) continue;
      if (p.x >= o.x0 && p.x <= o.x1 && p.y >= o.y0 && p.y <= o.y1 && o.depth > bd) {
        bd = o.depth;
        best = id;
      }
    }
    return best;
  }

  private cull() {
    const { width, height } = this.app.screen;
    const m = 140;
    const tl = this.screenToWorld(-m, -m), br = this.screenToWorld(width + m, height + m + 120);
    if (this.viewDirty) {
      const per = Math.ceil(this.sim.s.world.w / CHUNK);
      this.chunks.forEach((c, i) => {
        const cx = (i % per) * CHUNK, cy = Math.floor(i / per) * CHUNK;
        const xs = [isoX(cx, cy), isoX(cx + CHUNK, cy), isoX(cx, cy + CHUNK)];
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = isoY(cx, cy), y1 = isoY(cx + CHUNK, cy + CHUNK) + TH;
        c.visible = x1 >= tl.x && x0 <= br.x && y1 >= tl.y && y0 <= br.y;
      });
      const vis = (o: Obj) => {
        o.sp.visible = o.x1 >= tl.x && o.x0 <= br.x && o.y1 >= tl.y && o.y0 <= br.y;
      };
      for (const o of this.decor.values()) vis(o);
      for (const objs of this.bObjs.values()) for (const o of objs) vis(o);
      this.viewDirty = false;
    }
    for (const o of this.agents.values()) {
      const x = o.sp.x, y = o.sp.y;
      o.sp.visible = x >= tl.x - 60 && x <= br.x + 60 && y >= tl.y && y <= br.y + 80;
    }
  }

  // ————— entrées —————
  private bindInput() {
    const el = this.app.canvas;
    const rect = () => el.getBoundingClientRect();
    el.addEventListener('pointerdown', (e) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* capture indisponible (pointeur synthétique, vieux navigateur) : sans conséquence */
      }
      const r = rect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now(), type: e.pointerType });
      if (this.pointers.size === 1) this.moved = false;
      if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        this.moved = true;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const r = rect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const p = this.pointers.get(e.pointerId);
      if (!p) {
        if (e.pointerType === 'mouse') {
          const [tx, ty] = this.screenToTile(x, y);
          this.cb.onHover(tx, ty);
        }
        return;
      }
      const dx = x - p.x, dy = y - p.y;
      p.x = x;
      p.y = y;
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.panBy(mx - this.pinch.mx, my - this.pinch.my);
        if (this.pinch.d > 10) this.zoomBy(d / this.pinch.d, mx, my);
        this.pinch = { d, mx, my };
        return;
      }
      if (!this.moved && Math.hypot(x - p.sx, y - p.sy) > 7) this.moved = true;
      if (this.moved) this.panBy(dx, dy);
      if (e.pointerType === 'mouse') {
        const [tx, ty] = this.screenToTile(x, y);
        this.cb.onHover(tx, ty);
      }
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!p || e.type === 'pointercancel') return;
      if (!this.moved && this.pointers.size === 0 && performance.now() - p.t < 600) {
        const [tx, ty] = this.screenToTile(p.x, p.y);
        this.lastTap = { sx: p.x, sy: p.y };
        this.cb.onTap(tx, ty, p.type);
      }
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const r = rect();
        this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
      },
      { passive: false },
    );
  }
  lastTap = { sx: 0, sy: 0 };

  destroy() {
    this.app.destroy(true, { children: true, texture: true });
    for (const p of this.seasonAtlas.pages) p.destroy();
    for (const p of this.staticAtlas.pages) p.destroy();
  }
}

export function fieldStage(b: Building, x: number, y: number): number {
  if (x >= 0 && b.reaped.includes(y * 1000 + x)) return 5;
  if (b.ready > 0) return 4;
  return b.growth < 0.12 ? 0 : b.growth < 0.4 ? 1 : b.growth < 0.72 ? 2 : 3;
}

function softTexture(): Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(240,236,228,0.9)');
  g.addColorStop(1, 'rgba(240,236,228,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new Texture({ source: new CanvasSource({ resource: c }) });
}

export { lotOf, RES };
export type { World };
