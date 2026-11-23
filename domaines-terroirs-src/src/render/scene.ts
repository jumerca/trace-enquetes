// Scène isométrique PixiJS : sol en maillages par chunk (relief, ombrage, neige), objets instanciés
// seulement autour de la caméra, tri en profondeur, interpolation des déplacements, ambiance.
// Ne modifie jamais la simulation.
import { Application, Container, Geometry, Graphics, Mesh, Shader, Sprite, Texture, CanvasSource, UniformGroup, Buffer, BufferUsage } from 'pixi.js';
import { BUILDINGS, CROPS, LIVESTOCK, LOT_SIZE, ORCHARDS } from '../data/content';
import { REGION_BY_ID } from '../data/regions';
import { hash2 } from '../core/rng';
import { D, NEIGHBOR_CROPS, T, heightAt, isOwned, isPathLike, lotsPerRow, rasterLine, vh, type World } from '../world/terrain';
import { defOf, doorOf, footprint } from '../sim/geom';
import { LIVERIES, minuteOfDay, seasonOf, type Sim } from '../sim/sim';
import type { Building, Vehicle } from '../sim/state';
import { Atlas, MIRROR_PAINTED, TREE_SPECIES, buildGroundAtlas, buildObjectAtlas, buildStaticAtlas, type Tex } from './atlas';
import { RES, TH, TW, setPaintRes, setPaintStyle, type Season } from './paint';
import { agentDepth, buildingDepth, tileDepth } from './depth';

const CHUNK = 16;
const isoX = (x: number, y: number) => (x - y) * (TW / 2);
const isoY = (x: number, y: number) => (x + y) * (TH / 2);

interface Obj {
  sp: Sprite;
  key: string;
  depth: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Desc {
  key: string;
  gx: number; // position au sol (coordonnées de sommet)
  gy: number;
  depth: number;
  mirror: boolean;
  tint: number;
  /** 0 essentiel ; 1 petit décor (masqué au dézoom) ; 2 remplissage forestier (masqué au fort dézoom) */
  detail: number;
}

interface Chunk {
  mesh: Mesh<Geometry, Shader>;
  pos: Buffer;
  uv: Buffer;
  shade: Buffer;
  height: Buffer;
  objs: Sprite[] | null; // sprites instanciés (null = non visible)
  objLevel: number; // niveau de détail utilisé à l'instanciation
  descs: Desc[] | null;
  x0: number;
  y0: number;
  minY: number; // bornes écran (px monde)
  maxY: number;
  minX: number;
  maxX: number;
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

const VERT = `
in vec2 aPosition;
in vec2 aUV;
in float aShade;
in float aHeight;
out vec2 vUV;
out float vShade;
out float vSnow;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uSnowAlt;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vShade = aShade;
  vSnow = clamp((aHeight - uSnowAlt) / 70.0, 0.0, 1.0);
}`;
const FRAG = `
in vec2 vUV;
in float vShade;
in float vSnow;
uniform sampler2D uTexture;
out vec4 finalColor;
void main() {
  vec4 c = texture(uTexture, vUV);
  vec3 lit = c.rgb * vShade;
  vec3 snow = vec3(0.93, 0.95, 0.98) * c.a * min(vShade * 1.05, 1.1);
  finalColor = vec4(mix(lit, snow, vSnow * 0.9), c.a);
}`;

export class Scene {
  app = new Application();
  world = new Container();
  ground = new Container();
  roads = new Graphics();
  marks = new Graphics();
  objects = new Container();
  fx = new Container();
  night = new Graphics();
  rain = new Graphics();
  groundAtlas = new Atlas();
  objectAtlas = new Atlas();
  staticAtlas = new Atlas();
  vehicleAtlas = new Atlas();
  livingAtlas = new Atlas();
  season: Season = 1;
  private shader!: Shader;
  private uniforms = new UniformGroup({ uSnowAlt: { value: 99999, type: 'f32' } });
  private chunks: Chunk[] = [];
  private per = 0;
  private pool: Sprite[] = [];
  private bObjs = new Map<number, Obj[]>();
  private agents = new Map<string, Obj & { carry?: Sprite; heading?: number }>();
  private smoke: { sp: Sprite; vx: number; life: number }[] = [];
  private smokeTex!: Texture;
  private smokeAcc = 0;
  private lastRev = -1;
  private fieldSig = new Map<number, string>();
  private orchardSig = new Map<number, number>();
  private viewDirty = true;
  private snowSig = '';
  cam = { x: 0, y: 0, z: 1 };
  ghost: Ghost | null = null;
  ghostSprite: Sprite | null = null;
  selected: number | null = null;
  showLots = false;
  fps = 0;
  visibleObjects = 0;
  private time = 0;
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number; type: string }>();
  private pinch: { d: number; mx: number; my: number } | null = null;
  private moved = false;
  lastTap = { sx: 0, sy: 0 };

  constructor(private host: HTMLElement, public sim: Sim, private cb: SceneCallbacks, private opts: SceneOptions) {}

  async init() {
    setPaintRes(this.opts.quality === 'basse' ? 1 : Math.min(2, Math.max(1, Math.round(window.devicePixelRatio || 1))));
    const region = REGION_BY_ID[this.sim.s.region];
    setPaintStyle(region.architecture);
    await this.app.init({
      resizeTo: this.host,
      background: '#4a6a34',
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
    this.world.addChild(this.ground, this.roads, this.marks, this.objects);
    this.objects.sortableChildren = true;
    this.fx.addChild(this.rain, this.night);
    this.season = seasonOf(this.sim.s.minute);
    buildStaticAtlas(this.staticAtlas);
    buildObjectAtlas(this.objectAtlas, this.season);
    buildGroundAtlas(this.groundAtlas, this.season);
    await this.vehicleAtlas.load('./sprites').catch(() => undefined);
    await this.livingAtlas.load('./sprites', 'vivants').catch(() => undefined);
    this.smokeTex = softTexture();
    this.shader = Shader.from({ gl: { vertex: VERT, fragment: FRAG, name: 'sol-domaine' }, resources: { uTexture: this.groundAtlas.pages[0], solUniforms: this.uniforms } });
    this.buildChunks();
    this.buildRoads();
    this.syncWorld();
    const [fx, fy] = this.sim.s.world.farm;
    this.centerOn(fx + 2, fy, window.innerWidth < 700 ? 0.8 : 1);
    this.bindInput();
  }

  tex(key: string): Tex {
    return this.groundAtlas.map.get(key) ?? this.objectAtlas.map.get(key) ?? this.staticAtlas.map.get(key) ?? this.vehicleAtlas.map.get(key) ?? this.livingAtlas.map.get(key) ?? this.objectAtlas.map.get('rock:0')!;
  }

  private setTex(sp: Sprite, key: string) {
    const t = this.tex(key);
    sp.texture = t.tex;
    sp.anchor.set(t.ax, t.ay);
  }

  private get W(): World {
    return this.sim.s.world;
  }

  /** Position écran (px monde) d'un point au sol, relief compris. */
  groundPos(gx: number, gy: number): [number, number] {
    return [isoX(gx, gy), isoY(gx, gy) - heightAt(this.W, gx, gy)];
  }

  // ————— sol en maillages —————
  private buildChunks() {
    const W = this.W;
    this.per = Math.ceil(W.w / CHUNK);
    const n = CHUNK * CHUNK;
    const idx = new Uint32Array(n * 6);
    for (let i = 0; i < n; i++) idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    for (let cy = 0; cy < this.per; cy++)
      for (let cx = 0; cx < this.per; cx++) {
        const pos = new Buffer({ data: new Float32Array(n * 8), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
        const uv = new Buffer({ data: new Float32Array(n * 8), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
        const shade = new Buffer({ data: new Float32Array(n * 4), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
        const height = new Buffer({ data: new Float32Array(n * 4), usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
        const geometry = new Geometry({
          attributes: { aPosition: { buffer: pos, format: 'float32x2' }, aUV: { buffer: uv, format: 'float32x2' }, aShade: { buffer: shade, format: 'float32' }, aHeight: { buffer: height, format: 'float32' } },
          indexBuffer: idx,
        });
        const mesh = new Mesh({ geometry, shader: this.shader });
        this.ground.addChild(mesh);
        const ch: Chunk = { mesh, pos, uv, shade, height, objs: null, objLevel: 0, descs: null, x0: cx * CHUNK, y0: cy * CHUNK, minX: 0, maxX: 0, minY: 0, maxY: 0 };
        this.chunks.push(ch);
        this.fillChunk(ch, true);
      }
  }

  /** Recalcule les sommets d'un chunk (forme, UV de chaque case, ombrage). */
  private fillChunk(ch: Chunk, geometryToo: boolean) {
    const W = this.W;
    const P = ch.pos.data as Float32Array, U = ch.uv.data as Float32Array, S = ch.shade.data as Float32Array, Hh = ch.height.data as Float32Array;
    const atlas = this.groundAtlas;
    const pageW = 66, pageH = 34; // cadre d'une tuile (unités monde, marge comprise)
    const corners: [number, number, number, number][] = [
      [0, 0, 1 + 32, 1],
      [1, 0, 1 + 64, 1 + 16],
      [1, 1, 1 + 32, 1 + 32],
      [0, 1, 1, 1 + 16],
    ];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let i = 0;
    for (let ty = ch.y0; ty < ch.y0 + CHUNK; ty++)
      for (let tx = ch.x0; tx < ch.x0 + CHUNK; tx++, i++) {
        const inMap = tx < W.w && ty < W.h;
        const key = inMap ? this.tileKey(tx, ty) : 't:herbe:0';
        const [u0, v0, uw, vh0] = atlas.uv.get(key) ?? atlas.uv.get('t:herbe:0')!;
        const owned = inMap && isOwned(W, tx, ty);
        for (let k = 0; k < 4; k++) {
          const [dx, dy, px, py] = corners[k];
          const gx = tx + dx, gy = ty + dy;
          const h = vh(W, gx, gy);
          if (geometryToo) {
            const sx = isoX(gx, gy), sy = isoY(gx, gy) - h;
            P[(i * 4 + k) * 2] = sx;
            P[(i * 4 + k) * 2 + 1] = sy;
            minX = Math.min(minX, sx);
            maxX = Math.max(maxX, sx);
            minY = Math.min(minY, sy);
            maxY = Math.max(maxY, sy);
            Hh[i * 4 + k] = h;
          }
          U[(i * 4 + k) * 2] = u0 + (px / pageW) * uw;
          U[(i * 4 + k) * 2 + 1] = v0 + (py / pageH) * vh0;
          // ombrage : pentes tournées vers la lumière (haut-gauche de l'écran) éclairées
          const dhx = vh(W, gx + 1, gy) - vh(W, gx - 1, gy), dhy = vh(W, gx, gy + 1) - vh(W, gx, gy - 1);
          let sh = 1 + (dhx * 0.75 + dhy * 0.35) * 0.0095;
          sh = Math.max(0.55, Math.min(1.3, sh));
          S[i * 4 + k] = owned || !inMap ? sh : sh * 0.86;
        }
      }
    if (geometryToo) {
      ch.minX = minX;
      ch.maxX = maxX;
      ch.minY = minY - 260; // objets hauts (arbres, clochers)
      ch.maxY = maxY + TH;
      ch.pos.update();
      ch.height.update();
    }
    ch.uv.update();
    ch.shade.update();
  }

  private chunkOf(tx: number, ty: number) {
    return this.chunks[Math.floor(ty / CHUNK) * this.per + Math.floor(tx / CHUNK)];
  }

  private tileKey(x: number, y: number): string {
    const W = this.W;
    const i = y * W.w + x;
    const t = W.terrain[i];
    const v = Math.floor(hash2(x, y, W.seed) * 4);
    const o = this.sim.occ[i];
    if (o >= 0) {
      const b = this.sim.byId.get(o)!;
      const d = defOf(b);
      if (d.kind === 'verger') return d.orchard === 'vigne' ? `c:vigne:2:${v & 1}` : `t:verger:${v & 1}`;
      if (d.kind === 'enclos') return d.livestock === 'ruches' ? `t:verger:${v & 1}` : `t:enclos:${v & 1}`;
      if (d.kind === 'champ') return `c:${CROPS[d.crop!].look}:${fieldStage(b, x, y)}:${v & 1}`;
      return `t:cour:${v}`;
    }
    const at = (dx: number, dy: number) => {
      const xx = x + dx, yy = y + dy;
      return xx < 0 || yy < 0 || xx >= W.w || yy >= W.h ? -1 : W.terrain[yy * W.w + xx];
    };
    const mask = (f: (t: number) => boolean) => (f(at(1, 0)) ? 1 : 0) | (f(at(0, 1)) ? 2 : 0) | (f(at(-1, 0)) ? 4 : 0) | (f(at(0, -1)) ? 8 : 0);
    if (this.smooth.has(i)) {
      if (t === T.pont) return 't:eau:15';
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
      case T.garrigue:
        return `t:garrigue:${v & 1}`;
      case T.sable:
        return `t:sable:${v & 1}`;
      case T.roche:
        return `t:roche:${v & 1}`;
      case T.cour: {
        const m = mask((n) => n !== T.cour && n !== -1 && !isPathLike(n) && n !== T.eau);
        return m ? `t:cour:${v & 1}:${m}` : `t:cour:${v}`;
      }
      case T.eau:
        return `t:eau:${mask((n) => n === T.eau || n === T.pont || n === T.mer || n === -1)}`;
      case T.mer:
        return `t:mer:${mask((n) => n === T.mer || n === -1)}`;
      case T.pont:
        return isPathLike(at(1, 0)) || isPathLike(at(-1, 0)) ? 't:pont:x' : 't:pont:y';
      case T.chemin:
        return `t:chemin:${mask((n) => isPathLike(n))}`;
      case T.route:
        return `t:route:${mask((n) => n === T.route || n === T.pont || n === T.cour || n === T.chemin)}`;
      case T.champVoisin: {
        const look = NEIGHBOR_CROPS[W.field[i]] ?? 'ble';
        const l = look === 'ble' || look === 'orge' ? 'cereale' : look;
        // les champs voisins suivent le calendrier : levée au printemps, mûrs l'été, labourés à l'automne
        const st = [2, 4, 5, 1][this.season] - (look === 'mais' || look === 'tournesol' ? (this.season === 1 ? 1 : this.season === 2 ? -4 : 0) : 0);
        return `c:${l}:${Math.max(0, Math.min(5, look === 'vigne' ? 2 : st))}:${v & 1}`;
      }
    }
    return `t:herbe:${v}`;
  }

  // ————— routes lissées —————
  private smooth = new Set<number>();
  private smoothMask(x: number, y: number) {
    const W = this.W;
    const h = (dx: number, dy: number) => this.smooth.has((y + dy) * W.w + x + dx);
    return (h(1, 0) ? 1 : 0) | (h(0, 1) ? 2 : 0) | (h(-1, 0) ? 4 : 0) | (h(0, -1) ? 8 : 0);
  }

  private buildRoads() {
    const W = this.W;
    const g = this.roads;
    g.clear();
    this.smooth.clear();
    const winter = this.season === 3;
    for (const ch of W.roads) {
      let tiles = rasterLine(ch.pts).filter(([x, y]) => x >= 0 && y >= 0 && x < W.w && y < W.h);
      const isCour = (t: [number, number]) => W.terrain[t[1] * W.w + t[0]] === T.cour;
      const first = tiles.findIndex(isCour);
      if (first > 0) tiles = tiles.slice(0, first + 1);
      else if (first === 0) {
        let k = 0;
        while (k < tiles.length - 1 && isCour(tiles[k + 1])) k++;
        tiles = tiles.slice(k);
      }
      if (tiles.length < 2) continue;
      for (const [x, y] of tiles) {
        const t = W.terrain[y * W.w + x];
        if (t === T.route || t === T.chemin || t === T.pont) this.smooth.add(y * W.w + x);
      }
      let pts = tiles.map(([x, y]) => [x + 0.5, y + 0.5] as [number, number]);
      for (let it = 0; it < 3; it++) {
        const out: [number, number][] = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
        }
        out.push(pts[pts.length - 1]);
        pts = out;
      }
      const scr = pts.map(([x, y]) => this.groundPos(x, y));
      const stroke = (width: number, color: number, alpha = 1) => {
        g.moveTo(scr[0][0], scr[0][1]);
        for (const p of scr.slice(1)) g.lineTo(p[0], p[1]);
        g.stroke({ width, color, alpha, cap: 'round', join: 'round' });
      };
      if (ch.road) {
        stroke(30, 0x6f7a4a, 0.5);
        stroke(25, winter ? 0xb9b2a0 : 0xc8bca0);
        stroke(9, 0xd8cfb6, 0.7);
      } else {
        stroke(19, 0x6c8c30, 0.5);
        stroke(15, winter ? 0xa8977c : 0xb8956a);
        stroke(4, 0xcaa97c, 0.6);
      }
      // ponts
      let run: [number, number][] = [];
      const flush = () => {
        if (run.length) {
          const a = run[0], b = run[run.length - 1];
          const [ax, ay] = this.groundPos(a[0] + 0.5, a[1] + 0.5);
          const [bx, by] = this.groundPos(b[0] + 0.5, b[1] + 0.5);
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

  // ————— objets du décor, instanciés par chunk visible —————
  private decorKey(d: number, x: number, y: number): string | null {
    const h = hash2(x, y, 5);
    const sp = TREE_SPECIES_BY_DECOR[d];
    if (sp) return `tree:${sp}:${Math.floor(h * TREE_SPECIES[sp].n)}`;
    switch (d) {
      case D.rocher:
        return `rock:${Math.floor(h * 2)}`;
      case D.rocherGros:
        return `boulder:${Math.floor(h * 2)}`;
      case D.fleurs:
        return `flowers:${Math.floor(h * 3)}`;
      case D.maison:
        return `b:hameau${Math.floor(h * 4)}`;
      case D.eglise:
        return 'b:eglise';
      case D.phare:
        return 'b:phare';
      case D.bateau:
        return `boat:${Math.floor(h * 3)}`;
      case D.meule:
        return 'bale:0';
      case D.lavande:
        return `lavande:${Math.floor(h * 2)}`;
      case D.puits:
        return 'prop:puits';
      case D.foin:
        return 'prop:foin';
      case D.charrette:
        return 'prop:charrette';
    }
    return null;
  }

  private chunkDescs(ch: Chunk): Desc[] {
    if (ch.descs) return ch.descs;
    const W = this.W;
    const out: Desc[] = [];
    for (let y = ch.y0; y < Math.min(W.h, ch.y0 + CHUNK); y++)
      for (let x = ch.x0; x < Math.min(W.w, ch.x0 + CHUNK); x++) {
        const d = W.decor[y * W.w + x];
        if (!d || this.sim.occ[y * W.w + x] >= 0) continue;
        const key = this.decorKey(d, x, y);
        if (!key) continue;
        const big = d === D.maison || d === D.eglise;
        const small = d === D.fleurs || d === D.lavande || d === D.rocher || d === D.buisson || d === D.meule || d === D.haie;
        const filler = W.terrain[y * W.w + x] === T.bois && hash2(x, y, 41) > 0.45;
        out.push({
          detail: small ? 1 : filler ? 2 : 0,
          key,
          gx: big ? x : x + 0.5,
          gy: big ? y : y + 0.5,
          depth: big ? buildingDepth(x, y, 1) : tileDepth(x, y) + (d === D.fleurs || d === D.lavande ? -0.5 : 0),
          mirror: hash2(x, y, 77) < 0.5 && !big && d !== D.phare,
          tint: isOwned(W, x, y) ? 0xffffff : 0xe2ddd0,
        });
      }
    ch.descs = out;
    return out;
  }

  /** niveau de détail : 0 complet, 1 sans petit décor, 2 forêts éclaircies */
  lodBias = 0;
  get lodLevel() {
    return Math.min(2, (this.cam.z < 0.62 ? 1 : 0) + (this.cam.z < 0.42 ? 1 : 0) + this.lodBias);
  }

  private showChunkObjects(ch: Chunk) {
    if (ch.objs) return;
    ch.objs = [];
    const level = this.lodLevel;
    ch.objLevel = level;
    for (const d of this.chunkDescs(ch)) {
      if (d.detail !== 0 && d.detail <= level) continue;
      const sp = this.pool.pop() ?? new Sprite();
      this.setTex(sp, d.key);
      const [px, py] = d.key.startsWith('b:hameau') || d.key === 'b:eglise' ? [isoX(d.gx, d.gy), isoY(d.gx, d.gy) - heightAt(this.W, d.gx + 0.5, d.gy + 0.5)] : this.groundPos(d.gx, d.gy);
      sp.position.set(px, py);
      sp.scale.set(d.mirror ? -1 : 1, 1);
      sp.zIndex = d.depth;
      sp.tint = d.tint;
      sp.visible = true;
      this.objects.addChild(sp);
      ch.objs.push(sp);
    }
  }

  private hideChunkObjects(ch: Chunk) {
    if (!ch.objs) return;
    for (const sp of ch.objs) {
      this.objects.removeChild(sp);
      this.pool.push(sp);
    }
    ch.objs = null;
  }

  // ————— bâtiments —————
  private makeObj(key: string, gx: number, gy: number, depth: number, mirror = false, corner = false): Obj {
    const sp = new Sprite();
    this.setTex(sp, key);
    const [px, py] = corner ? [isoX(gx, gy), isoY(gx, gy) - heightAt(this.W, gx + 0.5, gy + 0.5)] : this.groundPos(gx, gy);
    sp.position.set(px, py);
    if (mirror) sp.scale.x = -1;
    sp.zIndex = depth;
    this.objects.addChild(sp);
    const b = sp.getLocalBounds();
    return { sp, key, depth, x0: px + Math.min(b.minX * sp.scale.x, b.maxX * sp.scale.x), y0: py + b.minY, x1: px + Math.max(b.minX * sp.scale.x, b.maxX * sp.scale.x), y1: py + b.maxY };
  }

  /** Synchronise décor, sol et bâtiments avec la simulation (après construction, démolition, chemin…). */
  syncWorld() {
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
    // sol et décor : relief éventuellement terrassé, chemins, défrichages
    for (const ch of this.chunks) {
      this.fillChunk(ch, true);
      this.hideChunkObjects(ch);
      ch.descs = null;
    }
    this.lastRev = this.sim.worldRev;
    this.viewDirty = true;
  }

  private buildingObjs(b: Building): Obj[] {
    const def = defOf(b);
    const s = def.size;
    const out: Obj[] = [];
    if (def.kind === 'verger') {
      const look = ORCHARDS[def.orchard!].look;
      for (const [x, y] of footprint(b)) out.push(this.makeObj(`fruit:${look}:0:${(x + y) & 1}`, x + 0.5, y + 0.5, tileDepth(x, y), look !== 'vigne' && (x * 7 + y) % 3 === 0));
    } else if (def.kind === 'champ') {
      // sol uniquement
    } else if (def.kind === 'enclos') {
      const abri = LIVESTOCK[def.livestock!].abri;
      if (abri !== 'rucher') out.push(this.makeObj(`b:${abri}`, b.x, b.y, abri === 'etable' || abri === 'bergerie' ? buildingDepth(b.x, b.y, 2) : tileDepth(b.x, b.y), false, true));
    } else if (b.rot === 1 && MIRROR_PAINTED.has(b.type)) out.push(this.makeObj(`b:${b.type}:m`, b.x, b.y, buildingDepth(b.x, b.y, s), false, true));
    else out.push(this.makeObj(`b:${b.type}`, b.x, b.y, buildingDepth(b.x, b.y, s), b.rot === 1, true));
    if (def.kind === 'enclos' || (def.kind === 'verger' && ORCHARDS[def.orchard!].look !== 'vigne')) {
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
    buildObjectAtlas(this.objectAtlas, s);
    buildGroundAtlas(this.groundAtlas, s);
    this.shader.resources.uTexture = this.groundAtlas.pages[0];
    this.buildRoads();
    for (const ch of this.chunks) {
      this.fillChunk(ch, false);
      this.hideChunkObjects(ch);
    }
    for (const objs of this.bObjs.values()) for (const o of objs) this.setTex(o.sp, o.key);
    this.orchardSig.clear();
    this.viewDirty = true;
  }

  // ————— boucle de rendu —————
  update(dtMs: number, alpha: number) {
    const s = this.sim.s;
    this.time += dtMs;
    this.fps = this.app.ticker.FPS;
    if (this.sim.worldRev !== this.lastRev) this.syncWorld();
    const season = seasonOf(s.minute);
    if (season !== this.season) this.setSeason(season);
    this.updateSnow();
    this.updateCrops();
    this.updateAgents(alpha);
    this.updateGhost();
    this.updateMarks();
    this.applyCamera();
    this.cull();
    this.updateFx(dtMs);
  }

  /** Neige : en hiver sur les sommets ; les jours de neige, jusque dans les vallées. */
  private updateSnow() {
    const s = this.sim.s;
    const region = REGION_BY_ID[s.region];
    const sig = `${this.season}:${s.weather}`;
    if (sig === this.snowSig) return;
    this.snowSig = sig;
    let alt = 99999;
    if (this.season === 3) alt = s.weather === 'neige' ? -100 : region.relief.montagne > 0 ? 300 : 99999;
    else if (this.season === 0 && region.relief.montagne > 0.3) alt = 460;
    this.uniforms.uniforms.uSnowAlt = alt;
  }

  private updateCrops() {
    for (const b of this.sim.s.buildings) {
      const d = defOf(b);
      if (d.kind === 'champ') {
        const sig = `${b.phase}:${fieldStage(b, -1, -1)}:${b.done.length}`;
        if (this.fieldSig.get(b.id) !== sig) {
          this.fieldSig.set(b.id, sig);
          const seen = new Set<Chunk>();
          for (const [x, y] of footprint(b)) seen.add(this.chunkOf(x, y));
          for (const ch of seen) this.fillChunk(ch, false);
        }
      } else if (d.kind === 'verger') {
        const o = ORCHARDS[d.orchard!];
        const lvl = b.ready < 8 ? 0 : b.ready < o.cap * 0.35 ? 1 : b.ready < o.cap * 0.7 ? 2 : 3;
        if (this.orchardSig.get(b.id) !== lvl) {
          this.orchardSig.set(b.id, lvl);
          for (const ob of this.bObjs.get(b.id) ?? [])
            if (ob.key.startsWith('fruit:')) {
              ob.key = `fruit:${o.look}:${lvl}:${ob.key.slice(-1)}`;
              this.setTex(ob.sp, ob.key);
            }
        }
      }
    }
  }

  private agentSprite(id: string, key: string): Obj & { carry?: Sprite; heading?: number } {
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

  private vehicleKey(v: Vehicle, d: number, f: number): string {
    if (v.kind === 'moissonneuse' || v.kind === 'vendangeuse' || v.kind === 'camionnette' || v.kind === 'betaillere') return `${v.kind}:${d}:${f}`;
    if (v.kind === 'voiture') return `voiture:${v.look % 3}:${d}:${f}`;
    const livery = LIVERIES[v.look % 3];
    let tool = v.tool;
    if (tool === 'remorque') {
      const r = v.load?.res;
      tool = !r ? 'remorque-vide' : ['pommes', 'prunes', 'mirabelles', 'raisin', 'olives', 'betterave', 'pommes_de_terre', 'legumes'].includes(r) ? 'remorque-pommes' : 'remorque-ble';
    }
    if (livery !== 'rouge' && (tool === 'remorque-pommes' || tool === 'remorque-foin')) tool = 'remorque-ble';
    if (!['seul', 'charrue', 'semoir', 'epandeur', 'pulverisateur', 'remorque-vide', 'remorque-ble', 'remorque-pommes', 'remorque-foin'].includes(tool)) tool = 'seul';
    return `tracteur:${livery}:${tool}:${d}:${f}`;
  }

  private updateAgents(alpha: number) {
    const s = this.sim.s;
    const seen = new Set<string>();
    const walkFrame = (id: number) => [1, 0, 2, 0][Math.floor((this.time / 150 + id) % 4)];
    const put = (o: Obj, x: number, y: number, depthBias = 0.02) => {
      const [px, py] = this.groundPos(x + 0.5, y + 0.5);
      o.sp.position.set(px, py);
      o.sp.zIndex = agentDepth(x, y, depthBias);
    };
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const face = (dir: number): [0 | 1, number] => (dir === 0 ? [0, 1] : dir === 1 ? [0, -1] : dir === 2 ? [1, -1] : [1, 1]);
    // personnages 3D pré-cuits en 8 directions (repli : dessins 2D en 2 directions)
    const has3d = this.livingAtlas.map.size > 0;
    const headingOf = (id: string, dx: number, dy: number, dir: number) => {
      const prev = this.agents.get(id)?.heading;
      if (Math.abs(dx) + Math.abs(dy) > 1e-4) return ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      return prev ?? (dir === 0 ? 0 : dir === 1 ? 2 : dir === 2 ? 4 : 6);
    };
    const personSprite = (id: string, look: string, dir: number, dx: number, dy: number, fr: number) => {
      if (!has3d) {
        const [f, sx] = face(dir);
        const o = this.agentSprite(id, `p:${look}:${f}:${fr}`);
        o.sp.scale.x = sx;
        return { o, front: f === 0, heading: dir * 2 };
      }
      const h = headingOf(id, dx, dy, dir);
      const o = this.agentSprite(id, `pp:${look}:${h}:${fr}`);
      o.heading = h;
      o.sp.scale.x = 1;
      return { o, front: h <= 3 || h === 7, heading: h };
    };
    for (const w of s.workers) {
      const id = 'w' + w.id;
      if (w.hidden) continue;
      seen.add(id);
      const moving = w.x !== w.px || w.y !== w.py;
      const working = !moving && w.timer > 0 && ['pick', 'process', 'field', 'take', 'put'].includes(w.steps[0]?.k ?? '');
      const fr = moving ? walkFrame(w.id) : working ? 3 + (Math.floor(this.time / 300) % 2) : 0;
      const { o, front, heading } = personSprite(id, w.role, w.dir, w.x - w.px, w.y - w.py, fr);
      put(o, lerp(w.px, w.x), lerp(w.py, w.y));
      if (w.carry) {
        if (!o.carry) {
          o.carry = new Sprite();
          o.sp.addChild(o.carry);
        }
        const t = this.tex(`carry:${w.carry.res}`);
        o.carry.texture = t.tex;
        o.carry.anchor.set(t.ax, t.ay);
        // la charge est portée devant le corps, dans le sens de la marche
        const a = (heading * Math.PI) / 4;
        o.carry.position.set(has3d ? (Math.cos(a) - Math.sin(a)) * 5 : 0, has3d ? -14 + (Math.cos(a) + Math.sin(a)) * 2.5 : -12);
        o.carry.visible = front;
      } else if (o.carry) o.carry.visible = false;
    }
    for (const v of s.visitors) {
      const id = 'v' + v.id;
      seen.add(id);
      const moving = v.x !== v.px || v.y !== v.py;
      const { o } = personSprite(id, `v${v.look}`, v.dir, v.x - v.px, v.y - v.py, moving ? walkFrame(v.id) : 0);
      const j = (hash2(v.id, 3, 1) - 0.5) * 0.5;
      put(o, lerp(v.px, v.x) + j, lerp(v.py, v.y) - j);
    }
    for (const v of s.vehicles) {
      const id = 'veh' + v.id;
      seen.add(id);
      const prev = this.agents.get(id);
      const dx = v.x - v.px, dy = v.y - v.py;
      const moving = Math.abs(dx) + Math.abs(dy) > 1e-4;
      // cap en 8 directions, à partir du déplacement réel (garde le dernier cap à l'arrêt)
      let heading = prev?.heading ?? (v.dir === 0 ? 0 : v.dir === 1 ? 2 : v.dir === 2 ? 4 : 6);
      if (moving) heading = ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
      const frame = moving ? Math.floor(this.time / 110) % 2 : 0;
      const o = this.agentSprite(id, this.vehicleKey(v, heading, frame));
      o.heading = heading;
      put(o, lerp(v.px, v.x), lerp(v.py, v.y), 0.1);
    }
    for (const a of s.animals) {
      const id = 'a' + a.id;
      seen.add(id);
      const moving = a.x !== a.px || a.y !== a.py;
      if (has3d && a.kind !== 'ruche') {
        const h = headingOf(id, a.x - a.px, a.y - a.py, a.dir);
        // à l'arrêt, les herbivores broutent la moitié du temps
        const graze = !moving && hash2(a.id, Math.floor(this.time / 2600), 7) < 0.55;
        const fr = moving ? 1 + (Math.floor(this.time / 200 + a.id) % 2) : graze ? 3 : 0;
        const o = this.agentSprite(id, `aa:${a.kind}:${a.look}:${h}:${fr}`);
        o.heading = h;
        o.sp.scale.x = 1;
        put(o, lerp(a.px, a.x) - 0.5, lerp(a.py, a.y) - 0.5, 0.01);
        continue;
      }
      const fr = a.kind === 'ruche' ? Math.floor(this.time / 400 + a.id) % 2 : moving ? Math.floor(this.time / 220 + a.id) % 2 : 0;
      const [f, sx] = face(a.dir);
      const o = this.agentSprite(id, a.kind === 'poule' ? `animal:poule:${a.look}:${fr}` : `animal:${a.kind}:${a.look}:${a.kind === 'ruche' ? 0 : f}:${fr}`);
      o.sp.scale.x = a.kind === 'ruche' ? 1 : a.kind === 'poule' ? (a.dir === 1 || a.dir === 2 ? -1 : 1) : sx;
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
    const key = kind === 'verger' ? `fruit:${ORCHARDS[def.orchard!].look}:2:0` : kind === 'enclos' ? `b:${LIVESTOCK[def.livestock!].abri === 'rucher' ? 'poulailler' : LIVESTOCK[def.livestock!].abri}` : kind === 'champ' ? null : mir ? `b:${g.type}:m` : `b:${g.type}`;
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
    if (kind === 'verger') sp.position.set(...this.groundPos(g.x + s / 2, g.y + s / 2));
    else sp.position.set(isoX(g.x, g.y), isoY(g.x, g.y) - heightAt(this.W, g.x + s / 2, g.y + s / 2));
    sp.scale.x = g.rot === 1 && kind !== 'verger' && !mir ? -1 : 1;
    sp.alpha = 0.72;
    sp.tint = g.ok ? 0xffffff : 0xff9a8a;
    sp.zIndex = 1e7;
  }

  /** Polygone au sol suivant le relief (contour d'un rectangle de cases). */
  private groundRect(x: number, y: number, w: number, h: number): number[] {
    const pts: number[] = [];
    const push = (gx: number, gy: number) => {
      const [px, py] = this.groundPos(gx, gy);
      pts.push(px, py);
    };
    for (let i = 0; i < w; i++) push(x + i, y);
    for (let i = 0; i < h; i++) push(x + w, y + i);
    for (let i = w; i > 0; i--) push(x + i, y + h);
    for (let i = h; i > 0; i--) push(x, y + i);
    return pts;
  }

  private updateMarks() {
    const m = this.marks;
    m.clear();
    const W = this.W;
    if (this.showLots || this.ghost) {
      const per = lotsPerRow(W);
      for (let ly = 0; ly < per; ly++)
        for (let lx = 0; lx < per; lx++) {
          const owned = W.owned[ly * per + lx];
          if (owned && !this.showLots) continue;
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => W.owned[(ly + b) * per + lx + a]);
          if (!owned && !near) continue;
          m.poly(this.groundRect(lx * LOT_SIZE + 0.15, ly * LOT_SIZE + 0.15, LOT_SIZE - 0.3, LOT_SIZE - 0.3));
          m.stroke({ width: 3, color: owned ? 0xf3e6c4 : 0x5a3c22, alpha: owned ? 0.8 : 0.45 });
        }
    }
    if (this.selected != null) {
      const b = this.sim.byId.get(this.selected);
      if (b) {
        const s = defOf(b).size;
        m.poly(this.groundRect(b.x, b.y, s, s));
        m.stroke({ width: 3, color: 0xffe08a, alpha: 0.95 });
        m.fill({ color: 0xffe08a, alpha: 0.12 });
      }
    }
    const g = this.ghost;
    if (g) {
      const s = g.type === 'chemin' ? 1 : BUILDINGS[g.type].size;
      m.poly(this.groundRect(g.x, g.y, s, s));
      m.fill({ color: g.ok ? 0x5fbf4a : 0xd8443a, alpha: 0.38 });
      m.stroke({ width: 2, color: g.ok ? 0xc8f0a0 : 0xffb0a0, alpha: 0.9 });
      if (g.type !== 'chemin' && !['verger', 'champ', 'enclos'].includes(BUILDINGS[g.type].kind)) {
        const [dx, dy] = doorOf({ x: g.x, y: g.y, type: g.type, rot: g.rot });
        m.poly(this.groundRect(dx + 0.25, dy + 0.25, 0.5, 0.5));
        m.fill({ color: 0xffe08a, alpha: 0.9 });
      }
    }
  }

  // ————— ambiance —————
  private updateFx(dtMs: number) {
    const s = this.sim.s;
    const w = this.app.screen.width, h = this.app.screen.height;
    const hour = minuteOfDay(s.minute) / 60;
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
    this.rain.clear();
    if (s.weather === 'pluie' || s.weather === 'orage' || s.weather === 'neige') {
      const n = s.weather === 'orage' ? 220 : 140;
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
    this.smokeAcc += dtMs;
    if (this.smokeAcc > 450) {
      this.smokeAcc = 0;
      for (const b of s.buildings) {
        const chimney = b.type === 'maison' || ((b.type === 'boulangerie' || b.type === 'distillerie' || b.type === 'brasserie') && b.busyBy != null);
        if (!chimney) continue;
        const sz = defOf(b).size;
        const cx = b.x + sz * (b.rot ? 0.5 : 0.35), cy = b.y + sz * (b.rot ? 0.35 : 0.5);
        const [px, py] = this.groundPos(cx, cy);
        const sp = new Sprite(this.smokeTex);
        sp.anchor.set(0.5);
        sp.position.set(px, py - (b.type === 'maison' ? 96 : 66));
        sp.alpha = 0.5;
        sp.scale.set(0.4);
        sp.zIndex = 1e7;
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
    const W = this.W;
    const minX = isoX(0, W.h), maxX = isoX(W.w, 0), maxY = isoY(W.w, W.h);
    this.cam.x = Math.max(minX * 0.9, Math.min(maxX * 0.9, this.cam.x));
    this.cam.y = Math.max(maxY * 0.04, Math.min(maxY * 0.96, this.cam.y));
    this.cam.z = Math.max(0.3, Math.min(2.2, this.cam.z));
    this.viewDirty = true;
  }

  centerOn(tx: number, ty: number, zoom?: number) {
    const [px, py] = this.groundPos(tx + 0.5, ty + 0.5);
    this.cam.x = px;
    this.cam.y = py;
    if (zoom) this.cam.z = zoom;
    this.clampCam();
  }

  zoomBy(f: number, sx?: number, sy?: number) {
    const { width, height } = this.app.screen;
    const px = sx ?? width / 2, py = sy ?? height / 2;
    const before = this.screenToWorld(px, py);
    this.cam.z = Math.max(0.3, Math.min(2.2, this.cam.z * f));
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

  tileToScreen(tx: number, ty: number): [number, number] {
    const { width, height } = this.app.screen;
    const [px, py] = this.groundPos(tx + 0.5, ty + 0.5);
    return [(px - this.cam.x) * this.cam.z + width / 2, (py - this.cam.y) * this.cam.z + height / 2];
  }

  /** Case sous le pointeur, relief compris (quelques itérations). */
  screenToTile(sx: number, sy: number): [number, number] {
    const p = this.screenToWorld(sx, sy);
    let h = 0, tx = 0, ty = 0;
    for (let it = 0; it < 4; it++) {
      const a = p.x / (TW / 2), b = (p.y + h) / (TH / 2);
      const fx = (a + b) / 2, fy = (b - a) / 2;
      tx = Math.floor(fx);
      ty = Math.floor(fy);
      h = heightAt(this.W, Math.max(0, Math.min(this.W.w, fx)), Math.max(0, Math.min(this.W.h, fy)));
    }
    return [tx, ty];
  }

  pickBuilding(sx: number, sy: number): number | null {
    const [tx, ty] = this.screenToTile(sx, sy);
    const W = this.W;
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

  private lastCam = '';
  private cull() {
    const { width, height } = this.app.screen;
    const camSig = `${this.cam.x}|${this.cam.y}|${this.cam.z}|${width}|${height}`;
    if (camSig !== this.lastCam) {
      this.lastCam = camSig;
      this.viewDirty = true;
    }
    const m = 120;
    const tl = this.screenToWorld(-m, -m), br = this.screenToWorld(width + m, height + m + 120);
    if (this.viewDirty) {
      // niveau de détail selon le zoom ; création des objets étalée sur plusieurs images (pas de saccade)
      const level = this.lodLevel;
      let budget = 2, pending = false;
      let count = 0;
      for (const ch of this.chunks) {
        const vis = ch.maxX >= tl.x && ch.minX <= br.x && ch.maxY >= tl.y && ch.minY <= br.y;
        ch.mesh.visible = vis;
        // marge supplémentaire pour les objets : on ne recrée pas au moindre déplacement
        const near = ch.maxX >= tl.x - 400 && ch.minX <= br.x + 400 && ch.maxY >= tl.y - 300 && ch.minY <= br.y + 300;
        if (vis && ch.objs && ch.objLevel !== level) {
          if (budget > 0) {
            this.hideChunkObjects(ch);
          } else pending = true;
        }
        if (vis && !ch.objs) {
          if (budget > 0) {
            this.showChunkObjects(ch);
            budget--;
          } else pending = true;
        } else if (!vis && !near) this.hideChunkObjects(ch);
        if (ch.objs) {
          for (const sp of ch.objs) {
            sp.visible = vis && sp.x >= tl.x - 60 && sp.x <= br.x + 60 && sp.y >= tl.y && sp.y <= br.y + 200;
            if (sp.visible) count++;
          }
        }
      }
      const vis = (o: Obj) => {
        o.sp.visible = o.x1 >= tl.x && o.x0 <= br.x && o.y1 >= tl.y && o.y0 <= br.y;
      };
      for (const objs of this.bObjs.values()) for (const o of objs) vis(o);
      this.visibleObjects = count;
      this.viewDirty = pending;
    }
    for (const o of this.agents.values()) {
      const x = o.sp.x, y = o.sp.y;
      o.sp.visible = x >= tl.x - 80 && x <= br.x + 80 && y >= tl.y && y <= br.y + 80;
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
        /* capture indisponible : sans conséquence */
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
        if (e.pointerType === 'mouse') this.cb.onHover(...this.screenToTile(x, y));
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
      if (e.pointerType === 'mouse') this.cb.onHover(...this.screenToTile(x, y));
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

  destroy() {
    this.app.destroy(true, { children: true, texture: true });
    for (const a of [this.groundAtlas, this.objectAtlas, this.staticAtlas, this.vehicleAtlas, this.livingAtlas]) for (const p of a.pages) p.destroy();
  }
}

const TREE_SPECIES_BY_DECOR: Record<number, string> = {
  [D.chene]: 'chene', [D.chataignier]: 'chataignier', [D.noyer]: 'noyer', [D.pin]: 'pin', [D.bouleau]: 'bouleau', [D.buisson]: 'buisson', [D.cypres]: 'cypres',
  [D.sapin]: 'sapin', [D.epicea]: 'epicea', [D.hetre]: 'hetre', [D.peuplier]: 'peuplier', [D.olivier]: 'olivier', [D.haie]: 'haie',
};

export function fieldStage(b: Building, x: number, y: number): number {
  const done = x >= 0 && b.done.includes(y * 10000 + x);
  if (b.phase === 'mur') return done ? 5 : 4;
  if (b.phase === 'labour') return done ? 0 : 5;
  if (b.phase === 'epandage') return 0;
  if (b.phase === 'semis') return done ? 1 : 0;
  return b.growth < 0.15 ? 1 : b.growth < 0.5 ? 2 : 3;
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

export { RES };
