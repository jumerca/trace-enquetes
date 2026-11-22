// Rendu 2,5D de la course avec PixiJS : lecture seule de l'état du moteur.
// Caméra inclinée (écrasement vertical), ombres portées, volumes extrudés, encrage façon bande dessinée.
import { Application, Container, Culler, Graphics, Rectangle, Sprite, Text, Texture, TilingSprite } from 'pixi.js';
import {
  paintAsphalt, paintBoat, paintBuilding, paintCar, paintCloudShadow, paintGarage, paintGrandstand, paintGravel, paintGround,
  paintRock, paintSilhouette, paintSoftShadow, paintTree, paintVignette, paintWater, paintCrowd, paintMarshal, paintFog, paintSunset, type GroundKind,
} from './art';
import { CAR_LEN, LIGHTS_ON, type RaceSim, type SimCar } from '../engine/race';
import { locate, worldPos, type Track } from '../engine/track';
import { Rng } from '../engine/rng';

export const TILT = 0.64; // écrasement vertical de la caméra
const INK = 0x16130f;
const CAR_PX = 24; // résolution des textures de voiture (px par mètre)

export interface RenderOptions {
  quality: 'haute' | 'economie';
  fpsCap: 30 | 60;
  names: boolean;
  focusTeamId: string;
  banners: { name: string; color: string }[];
  /** Sponsor principal affiché sur les pontons (par écurie). */
  liveries?: Record<string, { sponsor: string; color: string }>;
}

/** Image enregistrée pour le ralenti (positions de toutes les voitures à un pas de simulation). */
interface ReplayFrame {
  t: number;
  s: Float32Array;
  lat: Float32Array;
  out: Uint8Array;
}

export type CameraMode = 'suivre' | 'embarquee' | 'tv' | 'circuit' | 'cockpit';

interface CarView {
  root: Container;
  shadow: Sprite;
  side: Sprite;
  body: Sprite;
  ring: Graphics;
  label: Text;
  dot: Sprite;
  marker: Sprite;
  rearLight: Graphics;
  refl: Sprite;
}

interface Theme {
  groundKind: GroundKind;
  groundCss: string;
  ground2: number;
  runoff: number;
  bg: string;
  leaves: [string, string, string];
}

const THEMES: Record<string, Theme> = {
  port: { groundKind: 'paves', groundCss: '#cdbf9f', ground2: 0x9c8f73, runoff: 0xb8b6ae, bg: '#2a6f97', leaves: ['#2f6b2c', '#4b8f3c', '#8cc35a'] },
  foret: { groundKind: 'herbe', groundCss: '#6a9a45', ground2: 0x3f6f2a, runoff: 0xb5b4ab, bg: '#40692e', leaves: ['#24572a', '#3d7f35', '#7cb64e'] },
  desert: { groundKind: 'sable', groundCss: '#e2b56a', ground2: 0xc48a45, runoff: 0xd9c9a0, bg: '#c9934d', leaves: ['#4d6b2a', '#6f8f3a', '#a8c25a'] },
  lac: { groundKind: 'herbe', groundCss: '#7aa651', ground2: 0x4f8040, runoff: 0xb8b7ae, bg: '#557f3a', leaves: ['#2a6030', '#45883a', '#8fc85e'] },
  montagne: { groundKind: 'alpage', groundCss: '#9aa47f', ground2: 0x6f7a5a, runoff: 0xb9b8b0, bg: '#7d8768', leaves: ['#2f5a33', '#4a7d44', '#8bb070'] },
};

const COMPOUND_HEX: Record<string, number> = { T: 0xe5383b, M: 0xf2c14e, D: 0xf4f1ea, P: 0x3a86ff };

function hex(c: string): number {
  return parseInt(c.replace('#', ''), 16);
}

export class RaceRenderer {
  readonly app = new Application();
  private sim: RaceSim;
  private track: Track;
  private opts: RenderOptions;
  private world = new Container();
  private carsLayer = new Container();
  private fxLayer = new Container();
  private overlay = new Container();
  private mini = new Container();
  private miniScale = 1;
  private miniOff = { x: 0, y: 0 };
  private views = new Map<string, CarView>();
  private cam = { x: 0, y: 0, z: 3 };
  private rain: Graphics | null = null;
  private rainDrops: { x: number; y: number; v: number }[] = [];
  private puffs: { g: Sprite; life: number; size: number }[] = [];
  private puffTex: Texture | null = null;
  private dotTex: Texture | null = null;
  private tmp = { x: 0, y: 0 };
  private ready = false;
  follow: string | null = null; // id de la voiture suivie, null = vue d'ensemble
  mode: CameraMode = 'suivre';
  private tvTimer = 0;
  private userZoom = 1;
  private lights: Graphics | null = null;
  private gantry: Graphics | null = null;
  private crews = new Map<number, Graphics[]>();
  private puffPool: Sprite[] = [];
  private screenRect = new Rectangle(0, 0, 1, 1);
  private marksLayer = new Container();
  private marks: Sprite[] = [];
  private markIdx = 0;
  private lastMark = new Map<string, number>();
  private markTex: Texture | null = null;
  private seenEvents = 0;
  // ralenti
  private frames: ReplayFrame[] = [];
  private replay: { i: number; end: number; speed: number } | null = null;
  /** Fin du ralenti (pour l'interface). */
  onReplayEnd: (() => void) | null = null;
  /** Fraction (0..1) du pas de simulation écoulée, pour interpoler les positions. */
  alpha = 0;
  fps = 0;

  constructor(sim: RaceSim, opts: RenderOptions) {
    this.sim = sim;
    this.track = sim.track;
    this.opts = opts;
  }

  async init(host: HTMLElement): Promise<void> {
    const eco = this.opts.quality === 'economie';
    const theme = THEMES[this.track.def.theme];
    await this.app.init({
      resizeTo: host,
      background: this.track.def.night ? '#0b1026' : theme.bg,
      antialias: !eco,
      resolution: eco ? 1 : Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
      powerPreference: 'low-power',
    });
    host.appendChild(this.app.canvas);
    this.app.canvas.style.display = 'block';
    this.app.canvas.style.touchAction = 'none';
    this.app.ticker.maxFPS = this.opts.fpsCap;
    this.app.stage.addChild(this.world, this.overlay, this.mini);
    this.buildScenery();
    this.world.addChild(this.marksLayer);
    if (this.track.def.night) this.buildNight();
    this.world.addChild(this.carsLayer, this.fxLayer);
    this.buildCars();
    this.buildMinimap();
    // La météo peut changer en course : la pluie est toujours prête, son intensité suit l'humidité.
    this.rain = new Graphics();
    this.overlay.addChild(this.rain);
    const r = new Rng(3);
    for (let i = 0; i < (eco ? 40 : 110); i++) this.rainDrops.push({ x: r.next(), y: r.next(), v: 0.6 + r.next() * 0.6 });
    this.buildSafetyCar();
    this.buildAmbience(eco);
    const focus = this.sim.cars.find((c) => c.e.teamId === this.opts.focusTeamId);
    this.follow = focus?.id ?? null;
    const c0 = focus ?? this.sim.cars[0];
    this.carPos(c0, this.tmp);
    this.cam.x = this.tmp.x;
    this.cam.y = this.tmp.y;
    this.cam.z = this.defaultZoom();
    this.ready = true;
  }

  setOptions(o: Partial<RenderOptions>): void {
    Object.assign(this.opts, o);
    this.app.ticker.maxFPS = this.opts.fpsCap;
  }

  defaultZoom(): number {
    const w = this.app.screen.width, h = this.app.screen.height;
    // en portrait, on se base aussi sur la hauteur pour garder des voitures lisibles
    return Math.max(3, Math.min(8.5, Math.max(w, h * 0.8) / 150));
  }

  zoomBy(f: number): void {
    this.userZoom = Math.max(0.35, Math.min(3, this.userZoom * f));
  }

  setMode(m: CameraMode, carId?: string): void {
    this.mode = m;
    // en vue cockpit, la scène 2,5D n'est plus dessinée (la vue pseudo-3D la recouvre) : économie de GPU
    if (this.ready) this.app.stage.visible = m !== 'cockpit';
    if (m === 'circuit') this.follow = null;
    else if (carId) this.follow = carId;
    else if (!this.follow) this.follow = this.sim.cars.find((c) => c.e.teamId === this.opts.focusTeamId)?.id ?? this.sim.cars[0].id;
    this.tvTimer = 0;
  }

  overviewZoom(): number {
    const b = this.track.bounds;
    const w = this.app.screen.width, h = this.app.screen.height;
    return Math.min(w / (b.maxX - b.minX + 160), h / ((b.maxY - b.minY + 160) * TILT));
  }

  // ------------------------------------------------------------ décor statique

  private edge(lat: number, from = 0, to = this.track.n, step = 1): number[] {
    const t = this.track;
    const pts: number[] = [];
    for (let i = from; i < to; i += step) {
      const k = ((i % t.n) + t.n) % t.n;
      pts.push(t.x[k] + t.nx[k] * lat, t.y[k] + t.ny[k] * lat);
    }
    return pts;
  }

  /**
   * Découpe un dessin le long du circuit en tronçons de ~300 m (« cullables ») :
   * en vue rapprochée, seuls les tronçons visibles sont dessinés.
   */
  private segments(draw: (g: Graphics, i0: number, i1: number) => void): Container {
    const layer = new Container();
    const n = this.track.n, seg = Math.max(40, Math.round(300 / this.track.ds));
    for (let i0 = 0; i0 < n; i0 += seg) {
      const g = new Graphics();
      draw(g, i0, Math.min(n, i0 + seg));
      g.cullable = true;
      layer.addChild(g);
    }
    this.world.addChild(layer);
    return layer;
  }

  /** Bande de largeur constante centrée sur l'axe (trait épais : robuste, rayon mini > demi-largeur). */
  private band(halfWidth: number, color: number): void {
    this.segments((g, i0, i1) => {
      g.poly(this.edge(0, i0, i1 + 2, 2), false).stroke({ width: halfWidth * 2, color, join: 'round', cap: 'round' });
    });
  }

  // ------------------------------------------------------------ textures peintes (art.ts)

  private texCache = new Map<string, Texture>();

  /** Texture issue d'un canevas peint, mise en cache ; `repeat` pour les motifs de sol. */
  private tex(key: string, paint: () => HTMLCanvasElement, repeat = false): Texture {
    let t = this.texCache.get(key);
    if (!t) {
      t = Texture.from(paint());
      if (repeat) t.source.style.addressMode = 'repeat';
      t.source.style.update?.();
      this.texCache.set(key, t);
    }
    return t;
  }

  /** Grand motif répété couvrant une zone du monde (sol, eau, gravier). `tileM` = mètres par tuile. */
  private tiling(texture: Texture, x: number, y: number, w: number, h: number, tileM: number): TilingSprite {
    const ts = new TilingSprite({ texture, width: w, height: h });
    ts.position.set(x, y);
    const k = tileM / texture.width;
    ts.tileScale.set(k, k);
    return ts;
  }

  private buildScenery(): void {
    const t = this.track, def = t.def, theme = THEMES[def.theme], eco = this.opts.quality === 'economie';
    const b = t.bounds;
    const rng = new Rng(def.id.length * 7919);
    const pad = 900;
    const gx = b.minX - pad, gy = b.minY - pad, gw = b.maxX - b.minX + 2 * pad, gh = b.maxY - b.minY + 2 * pad;
    // --- sol peint (herbe tondue, sable ridé, pavés)
    const kind = theme.groundKind;
    const groundTex = this.tex('sol-' + def.theme, () => paintGround(kind, theme.groundCss, eco ? 128 : 256), true);
    this.world.addChild(this.tiling(groundTex, gx, gy, gw, gh, kind === 'paves' ? 12 : 48));
    // grandes nappes de couleur (variations naturelles)
    const patches = new Graphics();
    for (let i = 0; i < (eco ? 25 : 60); i++) {
      const x = rng.range(b.minX - 400, b.maxX + 400), y = rng.range(b.minY - 400, b.maxY + 400);
      patches.ellipse(x, y, rng.range(60, 180), rng.range(30, 90)).fill({ color: theme.ground2, alpha: 0.18 });
    }
    this.world.addChild(patches);
    if (def.theme === 'port') {
      // la mer au sud : eau animée, quai encré
      const seaY = b.maxY + 70;
      this.water = this.tiling(this.tex('eau', () => paintWater(eco ? 128 : 256)), gx, seaY, gw, pad, 60);
      this.water.texture.source.style.addressMode = 'repeat';
      this.world.addChild(this.water);
      const quay = new Graphics();
      quay.rect(gx, seaY - 7, gw, 7).fill(0x9a9384);
      quay.rect(gx, seaY - 1.5, gw, 1.5).fill(0x6f6a60);
      quay.moveTo(gx, seaY).lineTo(gx + gw, seaY).stroke({ width: 1.2, color: INK });
      for (let x = gx; x < gx + gw; x += 18) quay.circle(x, seaY - 3.5, 0.9).fill(0x3a3a3a);
      this.world.addChild(quay);
    }
    if (def.theme === 'lac') {
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      const r = Math.max(30, this.distToTrack(cx, cy) - t.half - 40);
      const pts: number[] = [];
      for (let k = 0; k < 48; k++) {
        const a = (k / 48) * Math.PI * 2, rr = r * (0.82 + 0.18 * Math.sin(a * 3 + 1));
        pts.push(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.8);
      }
      const shore = new Graphics().poly(pts, true).fill(0xd9cfa4).stroke({ width: 6, color: 0xd9cfa4 });
      this.world.addChild(shore);
      const mask = new Graphics().poly(pts, true).fill(0xffffff);
      this.water = this.tiling(this.tex('eau-lac', () => paintWater(eco ? 128 : 256, '#2f78b5', '#d8f0fb')), cx - r * 1.4, cy - r, r * 2.8, r * 2, 50);
      this.water.texture.source.style.addressMode = 'repeat';
      this.water.mask = mask;
      this.world.addChild(this.water, mask);
      this.world.addChild(new Graphics().poly(pts, true).stroke({ width: 2.2, color: INK }));
    }
    if (def.theme === 'montagne') {
      // massif à l'horizon : faces éclairées / à l'ombre, neiges éternelles
      const m = new Graphics();
      for (let k = 0; k < 10; k++) {
        const x = b.minX - 350 + k * ((b.maxX - b.minX + 700) / 9) + rng.range(-40, 40), w = rng.range(200, 330), h = rng.range(280, 460);
        const y = b.minY - 160;
        m.poly([x - w, y, x, y - h, x, y]).fill(0x7d8a99);
        m.poly([x, y - h, x + w, y, x, y]).fill(0x5d6878);
        m.poly([x - w * 0.3, y - h * 0.7, x, y - h, x + w * 0.3, y - h * 0.7, x + w * 0.12, y - h * 0.62, x - w * 0.04, y - h * 0.72, x - w * 0.16, y - h * 0.62]).fill(0xf4f7fb);
        m.poly([x - w, y, x, y - h, x + w, y]).stroke({ width: 2.2, color: INK });
      }
      for (let i = 0; i < 30; i++) {
        const x = rng.range(b.minX - 300, b.maxX + 300), y = rng.range(b.minY - 150, b.maxY + 300);
        if (this.distToTrack(x, y) < 40) continue;
        m.ellipse(x, y, rng.range(15, 45), rng.range(6, 16)).fill({ color: 0xf4f7fb, alpha: 0.85 });
      }
      this.world.addChild(m);
    }
    if (def.theme === 'desert') {
      const d = new Graphics();
      for (let i = 0; i < 40; i++) {
        const x = rng.range(b.minX - 400, b.maxX + 400), y = rng.range(b.minY - 400, b.maxY + 400);
        if (this.distToTrack(x, y) < 60) continue;
        const w = rng.range(40, 110);
        d.moveTo(x - w, y).quadraticCurveTo(x, y - w * 0.35, x + w, y).lineTo(x - w, y).fill({ color: 0xf0c98a, alpha: 0.5 });
        d.moveTo(x - w, y).quadraticCurveTo(x, y - w * 0.35, x + w, y).stroke({ width: 1.8, color: 0xb9783f, alpha: 0.55 });
      }
      this.world.addChild(d);
    }

    // --- dégagements : bitume clair sur les lignes droites, gravier à l'extérieur des virages
    this.band(t.half + 9, theme.runoff);
    if (!eco) {
      const gMask = new Graphics();
      let run: number[] = [];
      const flush = () => {
        if (run.length > 6) gMask.poly(run, false).stroke({ width: 8, color: 0xffffff, cap: 'round', join: 'round' });
        run = [];
      };
      let side = 0;
      for (let i = 0; i <= t.n; i += 2) {
        const k = i % t.n;
        const out = t.corner[k] > 0.32 ? -Math.sign(t.curv[k]) : 0;
        if (out === 0 || (side !== 0 && out !== side)) { flush(); side = out; if (!out) continue; }
        side = out;
        run.push(t.x[k] + t.nx[k] * (t.half + 5.2) * out, t.y[k] + t.ny[k] * (t.half + 5.2) * out);
      }
      flush();
      const gravel = this.tiling(this.tex('gravier', () => paintGravel(128)), gx, gy, gw, gh, 10);
      gravel.texture.source.style.addressMode = 'repeat';
      gravel.mask = gMask;
      this.world.addChild(gravel, gMask);
    }
    // --- encre, asphalte, grain, gomme, ombrage des bords
    this.band(t.half + 1.2, INK);
    this.band(t.half, 0x56585e);
    if (!eco) {
      const aMask = new Graphics().poly(this.edge(0, 0, t.n, 2), true).stroke({ width: (t.half + 9) * 2, color: 0xffffff, join: 'round' });
      const grain = this.tiling(this.tex('asphalte', () => paintAsphalt(128)), gx, gy, gw, gh, 14);
      grain.texture.source.style.addressMode = 'repeat';
      grain.mask = aMask;
      this.world.addChild(grain, aMask);
    }
    this.segments((g, i0, i1) => {
      // gomme déposée sur la trajectoire idéale
      const line: number[] = [];
      for (let i = i0; i < i1 + 2; i += 2) {
        const k = i % t.n;
        line.push(t.x[k] + t.nx[k] * t.line[k], t.y[k] + t.ny[k] * t.line[k]);
      }
      g.poly(line, false).stroke({ width: 2.6, color: 0x1b1b1f, alpha: 0.22, join: 'round' });
      // assombrissement le long des bords (occlusion)
      g.poly(this.edge(t.half - 0.7, i0, i1 + 2, 2), false).stroke({ width: 1.4, color: 0x000000, alpha: 0.14 });
      g.poly(this.edge(-(t.half - 0.7), i0, i1 + 2, 2), false).stroke({ width: 1.4, color: 0x000000, alpha: 0.14 });
    });
    // --- lignes blanches de bord et vibreurs en relief
    const kerbStep = Math.max(1, Math.round(3 / t.ds));
    this.segments((g, i0, i1) => {
      g.poly(this.edge(t.half - 0.35, i0, i1 + 2, 2), false).stroke({ width: 0.3, color: 0xf4f1ea });
      g.poly(this.edge(-(t.half - 0.35), i0, i1 + 2, 2), false).stroke({ width: 0.3, color: 0xf4f1ea });
      for (let i = i0 - (i0 % kerbStep); i < i1; i += kerbStep) {
        if (t.corner[i] < 0.28) continue;
        const j = (i + kerbStep) % t.n;
        const col = (i / kerbStep) % 2 ? 0xf4f1ea : 0xd62828;
        for (const side of [1, -1]) {
          const a = t.half - 0.9, c = t.half + 0.5, m = t.half - 0.2;
          const P = (k: number, l: number) => [t.x[k] + t.nx[k] * l * side, t.y[k] + t.ny[k] * l * side];
          g.poly([...P(i, a), ...P(j, a), ...P(j, c), ...P(i, c)]).fill(col);
          g.poly([...P(i, a), ...P(j, a), ...P(j, m), ...P(i, m)]).fill({ color: 0xffffff, alpha: 0.18 });
          g.poly([...P(i, c), ...P(j, c)], false).stroke({ width: 0.12, color: INK, alpha: 0.7 });
        }
      }
    });
    const g = new Graphics();
    // Voie des stands.
    const pit = this.pitPolys();
    g.poly(pit.lane, true).fill(0x5f6168);
    g.poly(pit.lane, true).stroke({ width: 0.8, color: INK });
    g.poly(pit.wall, true).fill(0xe9e4d8).stroke({ width: 0.6, color: INK });
    // Ligne de départ en damier + emplacements de grille.
    const sq = t.def.width / 8;
    for (let r = 0; r < 2; r++)
      for (let k = 0; k < 8; k++) {
        const lat0 = -t.half + k * sq;
        const s0 = r * sq;
        const p = (s: number, l: number) => { worldPos(t, s, l, this.tmp); return [this.tmp.x, this.tmp.y]; };
        g.poly([...p(s0, lat0), ...p(s0 + sq, lat0), ...p(s0 + sq, lat0 + sq), ...p(s0, lat0 + sq)]).fill((r + k) % 2 ? INK : 0xffffff);
      }
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const s = -(8 + i * 8) + CAR_LEN / 2 + 0.8;
      const lat = side * Math.min(2.6, t.half - 1.6);
      const a = { x: 0, y: 0 }, c = { x: 0, y: 0 }, d = { x: 0, y: 0 };
      worldPos(t, s, lat - 1.3, a);
      worldPos(t, s, lat + 1.3, c);
      g.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width: 0.35, color: 0xffffff, alpha: 0.85 });
      worldPos(t, s - 1.6, lat - 1.3, d);
      g.moveTo(a.x, a.y).lineTo(d.x, d.y).stroke({ width: 0.3, color: 0xffffff, alpha: 0.7 });
    }
    this.world.addChild(g);
    this.drawBarriers(eco);
    // piste mouillée : voile sombre brillant + flaques (opacité réglée selon l'humidité)
    const rngW = new Rng(t.n);
    this.wetLayer = this.segments((gw, i0, i1) => {
      gw.poly(this.edge(0, i0, i1 + 2, 2), false).stroke({ width: t.half * 2, color: 0x1a2433, alpha: 0.28, join: 'round' });
      for (let i = i0; i < i1; i += Math.round(14 / t.ds)) {
        if (rngW.next() < 0.45) continue;
        const lat = rngW.range(-t.half + 1.5, t.half - 1.5);
        const x = t.x[i] + t.nx[i] * lat, y = t.y[i] + t.ny[i] * lat;
        const w = rngW.range(2, 5);
        gw.ellipse(x, y, w, w * 0.45).fill({ color: 0x9fb6cc, alpha: 0.55 });
        gw.moveTo(x - w * 0.5, y - w * 0.1).lineTo(x + w * 0.3, y - w * 0.18).stroke({ width: 0.25, color: 0xffffff, alpha: 0.8 });
      }
    });
    this.wetLayer.alpha = 0;

    // Volumes 2,5D peints : stands, tribune, décor.
    this.drawGarages();
    this.drawGrandstand();
    this.drawTrackside(eco);
    this.drawProps(rng, eco);
    this.drawBanners();
    this.drawGantry();
    this.buildCrews();
  }

  /** Rails de sécurité, grillages anti-débris et murs de pneus à l'extérieur des virages. */
  private drawBarriers(eco: boolean): void {
    const t = this.track;
    const lat = t.half + 9.6;
    const pitS1 = t.pitExit + 30;
    this.segments((g, i0, i1) => {
      for (const side of [1, -1]) {
        let pts: number[] = [];
        const flush = () => {
          if (pts.length > 4) {
            g.poly(pts, false).stroke({ width: 0.9, color: INK });
            g.poly(pts.map((v, k) => (k % 2 ? v - 0.7 / TILT : v)), false).stroke({ width: 0.5, color: 0xd5d8dd });
            if (!eco) {
              // grillage : poteaux + filin
              g.poly(pts.map((v, k) => (k % 2 ? v - 3.2 / TILT : v)), false).stroke({ width: 0.12, color: 0x555a62, alpha: 0.8 });
              for (let k = 0; k < pts.length; k += 10) g.moveTo(pts[k], pts[k + 1]).lineTo(pts[k], pts[k + 1] - 3.2 / TILT).stroke({ width: 0.18, color: 0x3a3f47 });
            }
          }
          pts = [];
        };
        for (let i = i0 - (i0 % 3); i <= i1 + 3; i += 3) {
          const s = (i % t.n) * t.ds;
          const inPit = side === t.def.pitSide && (s > t.pitEntry - 30 || s < pitS1);
          if (inPit) { flush(); continue; }
          const k = i % t.n;
          pts.push(t.x[k] + t.nx[k] * lat * side, t.y[k] + t.ny[k] * lat * side);
        }
        flush();
      }
      // murs de pneus (piles colorées)
      const step = Math.max(1, Math.round(2.4 / t.ds));
      for (let i = i0 - (i0 % step); i < i1; i += step) {
        if (t.corner[i] < 0.38) continue;
        const out = -Math.sign(t.curv[i]);
        const s = i * t.ds;
        if (out === t.def.pitSide && (s > t.pitEntry - 30 || s < t.pitExit + 30)) continue;
        const x = t.x[i] + t.nx[i] * (lat + 0.6) * out, y = t.y[i] + t.ny[i] * (lat + 0.6) * out;
        const rows = eco ? 1 : 3;
        const band = (i / step) % 6 < 3 ? 0xd62828 : 0xf4f1ea;
        for (let r = 0; r < rows; r++) {
          g.circle(x, y - (r * 0.5) / TILT, 0.62).fill(0x1d1d1d).stroke({ width: 0.16, color: INK });
          if (r === rows - 1) g.circle(x, y - (r * 0.5) / TILT, 0.36).fill({ color: band, alpha: 0.9 });
        }
      }
    });
  }

  /** Panneaux publicitaires 2,5D le long de la ligne droite et dans les grands virages. */
  private drawBanners(): void {
    const t = this.track;
    if (!this.opts.banners.length) return;
    const layer = new Container();
    const g = new Graphics();
    layer.addChild(g);
    const side = -t.def.pitSide;
    const lat = t.half + 9.9;
    const h = 1.3 / TILT;
    const spots: number[] = [];
    for (let s = -220; s <= 220; s += 36) spots.push(s);
    for (let i = 0; i < t.n; i += Math.round(250 / t.ds)) if (t.corner[i] < 0.1 && t.zone[i]) spots.push(i * t.ds);
    spots.forEach((s, k) => {
      const sp = this.opts.banners[k % this.opts.banners.length];
      const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
      worldPos(t, s - 12, side * lat, a);
      worldPos(t, s + 12, side * lat, b);
      g.poly([a.x + 0.8, a.y + 0.6, b.x + 0.8, b.y + 0.6, b.x + 0.8, b.y + 0.6 - h * 0.25, a.x + 0.8, a.y + 0.6 - h * 0.25]).fill({ color: 0x000000, alpha: 0.18 });
      g.poly([a.x, a.y, b.x, b.y, b.x, b.y - h, a.x, a.y - h]).fill(hex(sp.color)).stroke({ width: 0.35, color: INK });
      g.poly([a.x, a.y - h, b.x, b.y - h, b.x, b.y - h * 0.85, a.x, a.y - h * 0.85]).fill({ color: 0xffffff, alpha: 0.25 });
      const txt = new Text({ text: sp.name.toUpperCase(), style: { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 40, fill: 0xffffff, stroke: { color: INK, width: 6 }, letterSpacing: 2 } });
      txt.anchor.set(0.5);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const sc = Math.min(1.1 / 40, 21 / Math.max(1, txt.width));
      txt.scale.set(sc, sc / TILT);
      txt.rotation = ang;
      txt.position.set((a.x + b.x) / 2, (a.y + b.y) / 2 - h / 2);
      txt.cullable = true;
      layer.addChild(txt);
    });
    this.world.addChild(layer);
  }

  /** Portique des feux de départ au-dessus de la ligne. */
  private drawGantry(): void {
    const t = this.track;
    const g = new Graphics();
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    worldPos(t, 6, t.half + 2, a);
    worldPos(t, 6, -(t.half + 2), b);
    const h = 7 / TILT;
    for (const p of [a, b]) {
      g.rect(p.x - 0.45, p.y - h, 0.9, h).fill(0x6a6f78).stroke({ width: 0.3, color: INK });
      g.rect(p.x - 0.45, p.y - h, 0.3, h).fill({ color: 0xffffff, alpha: 0.25 });
    }
    const top = Math.min(a.y, b.y) - h;
    g.rect(a.x - 1.1, top - 1.4 / TILT, 2.2, Math.abs(a.y - b.y) + 1.4 / TILT).fill(0x26272b).stroke({ width: 0.35, color: INK });
    g.rect(a.x - 1.1, top - 1.4 / TILT, 2.2, 0.8).fill(0xd62828);
    this.world.addChild(g);
    this.gantry = new Graphics();
    this.gantry.position.set(a.x, top);
    this.world.addChild(this.gantry);
    this.lights = new Graphics();
    this.overlay.addChild(this.lights);
  }

  /** Mécaniciens : 6 silhouettes par écurie, au garage ou autour de la voiture lors d'un arrêt. */
  private buildCrews(): void {
    const teams: number[] = [];
    for (const c of this.sim.cars) {
      if (teams.includes(c.teamIdx)) continue;
      teams.push(c.teamIdx);
      const col = hex(c.e.color);
      const list: Graphics[] = [];
      for (let k = 0; k < 6; k++) {
        const m = new Graphics();
        m.ellipse(0.25, 0.35, 0.5, 0.25).fill({ color: 0x000000, alpha: 0.28 });
        m.roundRect(-0.32, -1.5 / TILT, 0.64, 1.3 / TILT, 0.2).fill(col).stroke({ width: 0.12, color: INK });
        m.rect(-0.32, -1.0 / TILT, 0.64, 0.12 / TILT).fill(0xf4f1ea);
        m.circle(0, -1.75 / TILT, 0.28).fill(0xf4f1ea).stroke({ width: 0.1, color: INK });
        this.carsLayer.addChild(m);
        list.push(m);
      }
      this.crews.set(c.teamIdx, list);
    }
  }

  private pitPolys(): { lane: number[]; wall: number[] } {
    const t = this.track, side = t.def.pitSide;
    const sA = t.pitEntry - t.length - 20, sB = t.pitExit + 20;
    const lane: number[] = [], back: number[] = [];
    const wall: number[] = [], wallBack: number[] = [];
    for (let s = sA; s <= sB; s += 6) {
      const ramp = Math.min(1, (s - sA) / 60, (sB - s) / 60);
      const inner = t.half + 1 + (1 - ramp) * 0.5;
      const outer = t.half + 1 + ramp * 15;
      worldPos(t, s, side * inner, this.tmp); lane.push(this.tmp.x, this.tmp.y);
      worldPos(t, s, side * outer, this.tmp); back.unshift(this.tmp.y); back.unshift(this.tmp.x);
      if (ramp >= 1) {
        worldPos(t, s, side * (t.half + 3.4), this.tmp); wall.push(this.tmp.x, this.tmp.y);
        worldPos(t, s, side * (t.half + 4.2), this.tmp); wallBack.unshift(this.tmp.y); wallBack.unshift(this.tmp.x);
      }
    }
    return { lane: lane.concat(back), wall: wall.concat(wallBack) };
  }

  /** Garages peints (la ligne droite principale est horizontale sur tous les circuits). */
  private drawGarages(): void {
    const t = this.track, side = t.def.pitSide;
    const teams: { id: string; color: string; color2: string; name: string }[] = [];
    for (const c of this.sim.cars) if (!teams.some((x) => x.id === c.e.teamId)) teams.push({ id: c.e.teamId, color: c.e.color, color2: c.e.color2, name: c.e.teamName });
    const facing = side > 0; // au nord : on voit la façade ; au sud : le toit
    const layer = new Container();
    teams.forEach((tm, k) => {
      const s = t.length - 150 + k * 30;
      const art = paintGarage(tm.color, tm.color2, tm.name.toUpperCase(), facing, TILT, 8);
      const sp = new Sprite(this.tex('garage-' + tm.id + facing, () => art.cv));
      worldPos(t, s, side * (t.half + 17), this.tmp);
      if (!facing) worldPos(t, s, side * (t.half + 27), this.tmp); // au sud : ancré au mur arrière
      sp.anchor.set(0.5, 1);
      sp.width = 26;
      sp.height = art.h / TILT;
      sp.position.set(this.tmp.x, this.tmp.y);
      sp.cullable = true;
      layer.addChild(sp);
    });
    this.world.addChild(layer);
  }

  /** Tribune couverte peinte, au nord de la ligne droite (derrière la piste vu de la caméra). */
  private drawGrandstand(): void {
    const t = this.track;
    const base = t.def.pitSide > 0 ? t.half + 32 : t.half + 12;
    const s0 = -180, s1 = 140;
    const art = paintGrandstand(s1 - s0, !!t.def.night, 5, TILT, 5);
    const sp = new Sprite(this.tex('tribune', () => art.cv));
    worldPos(t, (s0 + s1) / 2, base, this.tmp);
    sp.anchor.set(0.5, 1);
    sp.width = s1 - s0;
    sp.height = art.h / TILT;
    sp.position.set(this.tmp.x, this.tmp.y);
    sp.cullable = true;
    // ombre portée vers la piste
    const sh = new Graphics().rect(this.tmp.x - (s1 - s0) / 2 + 3, this.tmp.y - 1, s1 - s0, 6).fill({ color: 0x000000, alpha: 0.18 });
    this.world.addChild(sh, sp);
  }

  private distToTrack(x: number, y: number): number {
    const t = this.track;
    let m = Infinity;
    for (let i = 0; i < t.n; i += 5) {
      const d = (t.x[i] - x) ** 2 + (t.y[i] - y) ** 2;
      if (d < m) m = d;
    }
    return Math.sqrt(m);
  }

  /** Vie de bord de piste : spectateurs derrière les grillages des virages, postes de commissaires. */
  private drawTrackside(eco: boolean): void {
    const t = this.track;
    const layer = new Container();
    const marshal = paintMarshal();
    const mTex = this.tex('commissaire', () => marshal.cv);
    const step = Math.round(260 / t.ds);
    let k = 0;
    for (let i = Math.round(60 / t.ds); i < t.n; i += step, k++) {
      const s = i * t.ds;
      const side = k % 2 ? 1 : -1;
      if (side === t.def.pitSide && (s > t.pitEntry - 40 || s < t.pitExit + 40)) continue;
      worldPos(t, s, side * (t.half + 11.5), this.tmp);
      const sp = new Sprite(mTex);
      sp.anchor.set(0.5, 1);
      sp.width = marshal.w;
      sp.height = marshal.h / TILT;
      sp.position.set(this.tmp.x, this.tmp.y);
      sp.cullable = true;
      layer.addChild(sp);
    }
    if (!eco) {
      // spectateurs : à l'extérieur des virages lents, derrière le grillage
      let seed = 1;
      for (let i = 0; i < t.n; i += Math.round(40 / t.ds)) {
        if (t.corner[i] < 0.45) continue;
        const out = -Math.sign(t.curv[i]);
        const s = i * t.ds;
        if (out === t.def.pitSide && (s > t.pitEntry - 40 || s < t.pitExit + 40)) continue;
        if ((i * 7) % 3 === 0) continue;
        const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
        worldPos(t, s - 14, out * (t.half + 13), a);
        worldPos(t, s + 14, out * (t.half + 13), b);
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const crowd = paintCrowd(28, seed++);
        const sp = new Sprite(this.tex('foule-' + (seed % 4), () => crowd.cv));
        sp.anchor.set(0.5, 1);
        sp.width = len;
        sp.height = crowd.h / TILT;
        sp.rotation = Math.atan2(b.y - a.y, b.x - a.x);
        // les spectateurs regardent la piste : on garde l'image à l'endroit
        if (Math.abs(sp.rotation) > Math.PI / 2) sp.rotation += Math.PI;
        sp.position.set((a.x + b.x) / 2, (a.y + b.y) / 2);
        sp.cullable = true;
        layer.addChild(sp);
      }
    }
    const items = [...layer.children];
    items.sort((p, q) => p.y - q.y);
    items.forEach((ch, idx) => layer.setChildIndex(ch, idx));
    this.world.addChild(layer);
  }

  /** Décor peint (arbres, palmiers, immeubles, rochers, bateaux) en sprites triés par profondeur. */
  private drawProps(rng: Rng, eco: boolean): void {
    const t = this.track, theme = t.def.theme, b = t.bounds, night = !!t.def.night;
    const pal = THEMES[theme];
    type P = { x: number; y: number; key: string; w: number; h: number; s: number; shadow: number };
    const list: P[] = [];
    const variants = (prefix: string, count: number, make: (i: number) => { cv: HTMLCanvasElement; w: number; h: number }) =>
      Array.from({ length: count }, (_, i) => {
        const key = `${prefix}-${i}`;
        let dims = this.propDims.get(key);
        if (!dims) {
          const art = make(i);
          this.tex(key, () => art.cv);
          dims = { w: art.w, h: art.h };
          this.propDims.set(key, dims);
        }
        return { key, ...dims };
      });
    const trees = variants('feuillu-' + theme, 3, (i) => paintTree('feuillu', pal.leaves, i + 1));
    const bushes = variants('buisson-' + theme, 2, (i) => paintTree('buisson', pal.leaves, i + 7));
    const pines = variants('sapin-' + theme, 2, (i) => paintTree('sapin', ['#1f4a2b', '#2d6a3b', '#5c9a5a'], i + 3));
    const palms = variants('palmier', 2, (i) => paintTree('palmier', ['#2e6b2a', '#3f8f3a', '#77b84a'], i + 11));
    const cactus = variants('cactus', 1, (i) => paintTree('cactus', ['#2e6b2a', '#4d8f3a', '#86c25a'], i + 5));
    const rocks = variants('rocher-' + theme, 2, (i) => paintRock(theme === 'desert' ? '#b0703f' : '#8a8c92', i + 2));
    const buildings = variants('immeuble-' + (night ? 'nuit' : 'jour'), 6, (i) => {
      const cols = ['#e8c9a0', '#f0e1c6', '#d99a6c', '#c8d6c4', '#f2d98c', '#cfd8e3'];
      const roofs = ['#b5452f', '#8c4b2f', '#6d7480', '#a65a3a', '#7a8a6a', '#556070'];
      return paintBuilding(14 + (i % 3) * 5, 12 + ((i * 7) % 4) * 6, 10, cols[i], roofs[i], night, i + 1, TILT);
    });
    const pick = <T,>(arr: T[]) => arr[rng.int(0, arr.length - 1)];
    const count = eco ? 90 : 320;
    let guard = 0;
    while (list.length < count && guard++ < count * 8) {
      const x = rng.range(b.minX - 260, b.maxX + 260), y = rng.range(b.minY - 260, b.maxY + 260);
      if (theme === 'port' && y > b.maxY + 60) continue;
      if (theme === 'montagne' && y < b.minY - 150) continue;
      if (theme === 'lac') {
        const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
        const rr = Math.max(30, this.distToTrack(cx, cy) - t.half - 40);
        if (((x - cx) / (rr * 1.3)) ** 2 + ((y - cy) / (rr * 0.85)) ** 2 < 1.15) continue;
      }
      const d = this.distToTrack(x, y);
      if (d < t.half + 15) continue;
      if (y > -110 && y < 75 && x > -300 && x < 320) continue; // stands et tribune
      const r = rng.next();
      let v: { key: string; w: number; h: number };
      if (theme === 'foret' || theme === 'lac') v = r < 0.6 ? pick(trees) : r < 0.85 ? pick(pines) : pick(bushes);
      else if (theme === 'montagne') v = r < 0.65 ? pick(pines) : r < 0.85 ? pick(rocks) : pick(bushes);
      else if (theme === 'desert') v = r < 0.4 ? pick(palms) : r < 0.75 ? pick(rocks) : pick(cactus);
      else v = r < 0.55 ? pick(buildings) : r < 0.85 ? pick(palms) : pick(bushes);
      const big = v.key.startsWith('immeuble');
      if (big && d < t.half + 40) continue;
      if (!big && d < t.half + 22 && !v.key.startsWith('buisson') && !v.key.startsWith('rocher')) continue;
      list.push({ x, y, key: v.key, w: v.w, h: v.h, s: big ? 1 : rng.range(0.8, 1.3), shadow: big ? 0.9 : 0.6 });
    }
    // bateaux amarrés le long du quai
    if (theme === 'port' && !eco) {
      const seaY = b.maxY + 70;
      for (let x = b.minX - 200; x < b.maxX + 200; x += rng.range(30, 60)) {
        const key = 'bateau-' + (rng.int(0, 2));
        if (!this.propDims.has(key)) {
          const art = paintBoat(['#1f4e79', '#d62828', '#2a9d8f'][Number(key.slice(-1))], Number(key.slice(-1)) + 1);
          this.tex(key, () => art.cv);
          this.propDims.set(key, { w: art.w, h: art.h });
        }
        const dims = this.propDims.get(key)!;
        const sp = new Sprite(this.tex(key, () => document.createElement('canvas')));
        sp.anchor.set(0.5);
        sp.rotation = Math.PI / 2;
        sp.width = dims.w;
        sp.height = dims.h;
        sp.position.set(x, seaY + 12 + rng.range(0, 6));
        sp.cullable = true;
        this.boats.push(sp);
        this.world.addChild(sp);
      }
    }
    list.sort((a, b2) => a.y - b2.y);
    const shadowTex = this.tex('ombre-douce', () => paintSoftShadow(64));
    const shadows = new Container();
    const props = new Container();
    for (const p of list) {
      const w = p.w * p.s, h = p.h * p.s;
      const sh = new Sprite(shadowTex);
      sh.anchor.set(0.5);
      sh.width = w * 1.1;
      sh.height = w * 0.55;
      sh.alpha = p.shadow;
      sh.position.set(p.x + w * 0.3, p.y + w * 0.12);
      sh.cullable = true;
      shadows.addChild(sh);
      const sp = new Sprite(this.texCache.get(p.key)!);
      sp.anchor.set(0.5, 0.97);
      sp.width = w;
      sp.height = h / TILT;
      sp.position.set(p.x, p.y);
      sp.cullable = true;
      props.addChild(sp);
    }
    this.world.addChild(shadows, props);
  }

  /** Ombres de nuages qui dérivent, vignettage, traits de vitesse façon BD. */
  private buildAmbience(eco: boolean): void {
    const b = this.track.bounds;
    if (!eco && !this.track.def.night) {
      const tex = this.tex('nuage', () => paintCloudShadow(256));
      const r = new Rng(17);
      for (let k = 0; k < 6; k++) {
        const c = new Sprite(tex);
        c.anchor.set(0.5);
        const size = r.range(260, 480);
        c.width = size;
        c.height = size * 0.7;
        c.alpha = 0.22;
        c.position.set(r.range(b.minX - 300, b.maxX + 300), r.range(b.minY - 300, b.maxY + 300));
        this.world.addChild(c);
        this.clouds.push(c);
      }
    }
    this.vignette = new Sprite(this.tex('vignette', () => paintVignette(256, this.track.def.night ? 0.55 : 0.32)));
    this.overlay.addChildAt(this.vignette, 0);
    if (this.track.def.sunset) {
      this.sunsetSprite = new Sprite(this.tex('crepuscule', () => paintSunset()));
      this.overlay.addChildAt(this.sunsetSprite, 0);
    }
    if (this.track.def.fog) {
      const ft = this.tex('brouillard', () => paintFog(256));
      const r = new Rng(5);
      for (let k = 0; k < (eco ? 3 : 6); k++) {
        const f = new Sprite(ft);
        f.anchor.set(0.5);
        f.alpha = 0.5;
        f.position.set(r.next(), r.next()); // coordonnées relatives à l'écran
        this.overlay.addChildAt(f, 0);
        this.fogs.push(f);
      }
    }
    this.speedLines = new Graphics();
    this.overlay.addChildAt(this.speedLines, 1);
  }

  private updateAmbience(dtMs: number, sw: number, sh: number): void {
    const b = this.track.bounds, dt = dtMs / 1000;
    for (const c of this.clouds) {
      c.x += dt * 6;
      c.y += dt * 2;
      if (c.x > b.maxX + 500) c.x = b.minX - 500;
      if (c.y > b.maxY + 500) c.y = b.minY - 500;
    }
    if (this.water) {
      this.water.tilePosition.x += dt * 3;
      this.water.tilePosition.y += dt * 1.2;
    }
    const tt = performance.now() / 1000;
    this.boats.forEach((bt, i) => (bt.rotation = Math.PI / 2 + Math.sin(tt * 0.8 + i) * 0.04));
    if (this.vignette) {
      this.vignette.width = sw;
      this.vignette.height = sh;
    }
    if (this.sunsetSprite) {
      this.sunsetSprite.width = sw;
      this.sunsetSprite.height = sh;
    }
    this.fogs.forEach((f, i) => {
      // nappes qui dérivent lentement, en coordonnées d'écran (0..1 stockées dans x/y de base)
      const bx = (f.position.x / Math.max(1, sw)) || 0;
      void bx;
      const phase = tt * (0.012 + i * 0.003) + i * 0.37;
      f.position.set(((phase % 1.4) - 0.2) * sw, (0.15 + ((i * 0.23) % 0.8)) * sh);
      f.width = sw * 0.9;
      f.height = sh * 0.7;
    });
    if (this.wetLayer) this.wetLayer.alpha = Math.max(0, Math.min(1, (this.sim.wet - 0.25) / 0.5));
    // traits de vitesse autour de la voiture suivie (au-delà de ~225 km/h)
    const g = this.speedLines!;
    g.clear();
    const fc = this.follow && this.mode !== 'circuit' && this.opts.quality !== 'economie' ? this.sim.car(this.follow) : null;
    if (!fc || this.replay) return;
    const k = Math.max(0, Math.min(1, (fc.v - 62) / 22));
    if (k <= 0) return;
    const { i } = locate(this.track, fc.s);
    const hd = this.track.heading[i];
    const dx = Math.cos(hd), dy = Math.sin(hd) * TILT;
    const n = Math.hypot(dx, dy) || 1;
    const ux = dx / n, uy = dy / n;
    const seed = Math.floor(tt * 12);
    const r = new Rng(seed);
    for (let q = 0; q < 14; q++) {
      // traits sur les bords de l'écran, alignés sur la direction de la voiture
      const edge = r.next() < 0.5;
      const px = edge ? (r.next() < 0.5 ? r.range(0, sw * 0.18) : r.range(sw * 0.82, sw)) : r.range(0, sw);
      const py = edge ? r.range(0, sh) : r.next() < 0.5 ? r.range(0, sh * 0.15) : r.range(sh * 0.85, sh);
      const len = r.range(40, 120) * k;
      g.moveTo(px, py).lineTo(px - ux * len, py - uy * len);
    }
    g.stroke({ width: 2, color: 0xffffff, alpha: 0.35 * k });
  }

  private wetLayer: Container | null = null;
  private fogs: Sprite[] = [];
  private sunsetSprite: Sprite | null = null;
  private pitStart = new Map<string, number>();
  private wheels = new Map<number, Graphics[]>();

  private propDims = new Map<string, { w: number; h: number }>();
  private boats: Sprite[] = [];
  private water: TilingSprite | null = null;
  private clouds: Sprite[] = [];
  private vignette: Sprite | null = null;
  private speedLines: Graphics | null = null;

  // ------------------------------------------------------------ voitures

  private scView: { root: Container; body: Sprite; bar: Graphics; label: Text; dot: Sprite } | null = null;

  /** Voiture de sécurité : berline blanche à bandes orange, rampe lumineuse clignotante. */
  private buildSafetyCar(): void {
    const tex = Texture.from(paintCar({ color: '#f4f1ea', color2: '#ff7a00', number: 'SC', sponsor: 'SAFETY', sponsorColor: '#1d3557' }, CAR_PX));
    const root = new Container();
    const shadow = new Sprite(this.tex('ombre-douce', () => paintSoftShadow(64)));
    shadow.anchor.set(0.5);
    shadow.width = 6.2;
    shadow.height = 2.9;
    shadow.position.set(0.9, 0.9);
    const body = new Sprite(tex);
    body.anchor.set(0.5);
    body.scale.set(1 / CAR_PX);
    body.position.set(0, -0.42 / TILT);
    const bar = new Graphics();
    root.addChild(shadow, body, bar);
    root.visible = false;
    this.carsLayer.addChild(root);
    const label = new Text({ text: 'SC', style: { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 15, fill: 0xffd400, stroke: { color: INK, width: 4 } } });
    label.anchor.set(0.5, 1);
    label.visible = false;
    this.overlay.addChild(label);
    const dot = new Sprite(this.dotTex!);
    dot.anchor.set(0.5);
    dot.tint = 0xffd400;
    dot.visible = false;
    this.overlay.addChild(dot);
    this.scView = { root, body, bar, label, dot };
  }

  private updateSafetyCar(sw: number, sh: number, z: number, detailed: boolean): void {
    const v = this.scView, sc = this.sim.sc;
    if (!v) return;
    if (!sc) {
      v.root.visible = v.label.visible = v.dot.visible = false;
      return;
    }
    const t = this.track;
    const s = sc.prevS + (sc.s - sc.prevS) * this.alpha;
    const lat = sc.prevLat + (sc.lat - sc.prevLat) * this.alpha;
    worldPos(t, s, lat, this.tmp);
    const { i } = locate(t, s);
    const ds = sc.s - sc.prevS;
    let head = t.heading[i];
    if (ds > 0.05) head -= Math.atan2(sc.lat - sc.prevLat, ds);
    v.root.visible = detailed;
    v.root.position.set(this.tmp.x, this.tmp.y);
    v.root.zIndex = 999;
    v.body.rotation = head;
    (v.root.children[0] as Sprite).rotation = head;
    const on = Math.floor(performance.now() / 250) % 2 === 0;
    v.bar.clear();
    v.bar.circle(Math.cos(head + 1.57) * 0.45, Math.sin(head + 1.57) * 0.45 - 0.9 / TILT, 0.35).fill(on ? 0xffb000 : 0x6a4a00);
    v.bar.circle(Math.cos(head - 1.57) * 0.45, Math.sin(head - 1.57) * 0.45 - 0.9 / TILT, 0.35).fill(on ? 0x6a4a00 : 0xffb000);
    const sx = (this.tmp.x - this.cam.x) * z + sw / 2, sy = (this.tmp.y - this.cam.y) * z * TILT + sh / 2;
    v.label.visible = sx > -40 && sx < sw + 40 && sy > -40 && sy < sh + 40;
    v.label.position.set(sx, sy - (detailed ? 2.2 * z + 4 : 9));
    v.dot.visible = !detailed;
    v.dot.position.set(sx, sy);
  }

  /** Livrée peinte (art.ts) : dégradés, encrage, numéro, sponsor principal. */
  private carTexture(e: SimCar['e']): Texture {
    const liv = this.opts.liveries?.[e.teamId];
    return Texture.from(paintCar({ color: e.color, color2: e.color2, number: e.number, sponsor: liv?.sponsor, sponsorColor: liv?.color }, CAR_PX));
  }

  private buildCars(): void {
    const texCache = new Map<string, Texture>();
    const dotG = new Graphics().circle(0, 0, 8).fill(0xffffff).stroke({ width: 2.5, color: INK });
    this.dotTex = this.app.renderer.generateTexture({ target: dotG, resolution: 2 });
    const puffG = new Graphics().circle(0, 0, 10).fill({ color: 0xffffff, alpha: 0.9 });
    this.puffTex = this.app.renderer.generateTexture({ target: puffG, resolution: 1 });
    const markG = new Graphics().poly([0, 0, -7, -10, 7, -10]).fill(0xffd400).stroke({ width: 2, color: INK });
    const markTex = this.app.renderer.generateTexture({ target: markG, resolution: 2 });
    for (let k = 0; k < 90; k++) {
      const sp = new Sprite(this.puffTex);
      sp.anchor.set(0.5);
      sp.visible = false;
      this.fxLayer.addChild(sp);
      this.puffPool.push(sp);
    }
    for (const c of this.sim.cars) {
      // une texture par voiture : chacune porte son numéro
      let tex = texCache.get(c.id);
      if (!tex) {
        tex = this.carTexture(c.e);
        texCache.set(c.id, tex);
      }
      const root = new Container();
      const shadow = new Sprite(this.tex('ombre-douce', () => paintSoftShadow(64)));
      shadow.anchor.set(0.5);
      shadow.width = 6.2;
      shadow.height = 2.9;
      // flanc de la voiture : silhouette sombre sous la carrosserie (épaisseur 2,5D)
      const side = new Sprite(this.tex('silhouette', () => paintSilhouette(CAR_PX)));
      side.anchor.set(0.5);
      side.scale.set(1 / CAR_PX);
      side.tint = 0x24211c;
      const ring = new Graphics().ellipse(0, 0, 4.2, 2.8).stroke({ width: 0.45, color: 0xffd400, alpha: 0.95 });
      ring.visible = c.e.teamId === this.opts.focusTeamId;
      const body = new Sprite(tex);
      body.anchor.set(0.5);
      body.scale.set(1 / CAR_PX);
      const rearLight = new Graphics().circle(0, 0, 0.28).fill(0xff2a2a);
      rearLight.visible = false;
      // reflet sur piste mouillée
      const refl = new Sprite(tex);
      refl.anchor.set(0.5);
      refl.scale.set(1 / CAR_PX);
      refl.tint = 0x8fa3b8;
      refl.alpha = 0;
      root.addChild(refl, ring, shadow, side, body, rearLight);
      this.carsLayer.addChild(root);
      const label = new Text({
        text: c.e.short,
        style: { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontWeight: '700', fontSize: 13, fill: 0xffffff, stroke: { color: INK, width: 3 } },
      });
      label.anchor.set(0.5, 1);
      this.overlay.addChild(label);
      const dot = new Sprite(this.dotTex);
      dot.anchor.set(0.5);
      dot.tint = hex(c.e.color);
      this.overlay.addChild(dot);
      const marker = new Sprite(markTex);
      marker.anchor.set(0.5, 1);
      marker.visible = false;
      this.overlay.addChild(marker);
      this.views.set(c.id, { root, shadow, side, body, ring, label, dot, marker, rearLight, refl });
    }
  }

  private buildMinimap(): void {
    const t = this.track, b = t.bounds;
    const size = 120;
    this.miniScale = size / Math.max(b.maxX - b.minX, b.maxY - b.minY);
    this.miniOff = { x: -b.minX, y: -b.minY };
    const g = new Graphics();
    const pts: number[] = [];
    for (let i = 0; i < t.n; i += 8) pts.push((t.x[i] + this.miniOff.x) * this.miniScale, (t.y[i] + this.miniOff.y) * this.miniScale);
    const w = (b.maxX - b.minX) * this.miniScale, h = (b.maxY - b.minY) * this.miniScale;
    g.roundRect(-8, -8, w + 16, h + 16, 8).fill({ color: 0xf4f1ea, alpha: 0.88 }).stroke({ width: 2, color: INK });
    g.poly(pts, true).stroke({ width: 4, color: INK });
    g.poly(pts, true).stroke({ width: 2, color: 0x8a8f99 });
    this.mini.addChild(g);
    for (const c of this.sim.cars) {
      const s = new Sprite(this.dotTex!);
      s.anchor.set(0.5);
      s.scale.set(0.32);
      s.tint = hex(c.e.color);
      s.label = c.id;
      this.mini.addChild(s);
    }
  }

  private carPos(c: SimCar, out: { x: number; y: number }): void {
    const r = this.replayState(c);
    if (r) {
      worldPos(this.track, r.s, r.lat, out);
      return;
    }
    const a = this.alpha;
    const s = c.prevS + (c.s - c.prevS) * a;
    const lat = c.prevLat + (c.lat - c.prevLat) * a;
    worldPos(this.track, s, lat, out);
  }

  /** Position (et déplacement) d'une voiture dans le ralenti en cours, sinon null. */
  private replayState(c: SimCar): { s: number; lat: number; ds: number; dl: number; out: boolean } | null {
    const rp = this.replay;
    if (!rp) return null;
    const k = Math.min(this.frames.length - 2, Math.floor(rp.i));
    const f = rp.i - k;
    const a = this.frames[k], b = this.frames[k + 1];
    const j = c.idx;
    return {
      s: a.s[j] + (b.s[j] - a.s[j]) * f,
      lat: a.lat[j] + (b.lat[j] - a.lat[j]) * f,
      ds: b.s[j] - a.s[j],
      dl: b.lat[j] - a.lat[j],
      out: !!b.out[j],
    };
  }

  /** Enregistre l'état courant (à appeler après chaque pas de simulation). 20 s gardées. */
  recordFrame(): void {
    if (this.replay) return;
    const n = this.sim.cars.length;
    const f: ReplayFrame = { t: this.sim.t, s: new Float32Array(n), lat: new Float32Array(n), out: new Uint8Array(n) };
    this.sim.cars.forEach((c, i) => {
      f.s[i] = c.s;
      f.lat[i] = c.lat;
      f.out[i] = c.status === 'dnf' ? 1 : 0;
    });
    this.frames.push(f);
    if (this.frames.length > 200) this.frames.shift();
  }

  /** Vrai si l'instant t est encore dans la mémoire du ralenti. */
  canReplay(t: number): boolean {
    return this.frames.length > 20 && t - 4 >= this.frames[0].t - 0.05 && t <= this.frames[this.frames.length - 1].t;
  }

  /** Ralenti de t-4 s à t+2 s, au tiers de la vitesse, centré sur une voiture. */
  startReplay(t: number, carId?: string): boolean {
    if (!this.canReplay(t)) return false;
    const from = this.frames.findIndex((f) => f.t >= t - 4);
    let to = this.frames.findIndex((f) => f.t >= t + 2);
    if (to < 0) to = this.frames.length - 1;
    this.replay = { i: Math.max(0, from), end: to, speed: 0.33 };
    if (carId) this.setMode('suivre', carId);
    return true;
  }

  stopReplay(): void {
    if (!this.replay) return;
    this.replay = null;
    this.frames = [];
    this.onReplayEnd?.();
  }

  get replaying(): boolean {
    return !!this.replay;
  }

  // ------------------------------------------------------------ image par image

  render(dtMs: number): void {
    if (!this.ready) return;
    const t = this.track;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.fps = this.fps * 0.9 + (1000 / Math.max(1, dtMs)) * 0.1;
    if (this.replay) {
      this.replay.i += (dtMs / 100) * this.replay.speed;
      if (this.replay.i >= this.replay.end) this.stopReplay();
    }
    // Caméra
    let tz = this.cam.z;
    if (this.mode === 'tv') this.tvDirector(dtMs);
    if (this.follow && this.mode !== 'circuit') {
      const fc = this.sim.car(this.follow);
      if (fc) {
        this.carPos(fc, this.tmp);
        const k = Math.min(1, dtMs / (this.mode === 'tv' ? 420 : this.mode === 'embarquee' ? 90 : 180));
        let tx = this.tmp.x, ty = this.tmp.y;
        if (this.mode === 'embarquee') {
          // caméra serrée qui regarde devant la voiture, légères vibrations à haute vitesse
          const { i } = locate(t, fc.s);
          const ahead = 6 + fc.v * 0.12;
          tx += Math.cos(t.heading[i]) * ahead;
          ty += Math.sin(t.heading[i]) * ahead;
          const shake = Math.max(0, fc.v - 60) * 0.004;
          tx += Math.sin(performance.now() / 37) * shake;
          ty += Math.cos(performance.now() / 41) * shake;
        }
        this.cam.x += (tx - this.cam.x) * k;
        this.cam.y += (ty - this.cam.y) * k;
        // zoom dynamique : on recule un peu à haute vitesse
        const base = this.defaultZoom() * (this.mode === 'tv' ? 1.15 : this.mode === 'embarquee' ? 2.1 : 1) * this.userZoom;
        tz = base * (1.12 - 0.22 * Math.min(1, fc.v / 85));
        this.cam.z += (tz - this.cam.z) * Math.min(1, dtMs / 600);
      }
    } else {
      const b = t.bounds;
      tz = this.overviewZoom();
      const k = Math.min(1, dtMs / 300);
      this.cam.x += ((b.minX + b.maxX) / 2 - this.cam.x) * k;
      this.cam.y += ((b.minY + b.maxY) / 2 - this.cam.y) * k;
      this.cam.z += (tz - this.cam.z) * k;
    }
    const z = this.cam.z;
    this.world.scale.set(z, z * TILT);
    this.world.position.set(sw / 2 - this.cam.x * z, sh / 2 - this.cam.y * z * TILT);
    this.screenRect.width = sw;
    this.screenRect.height = sh;
    Culler.shared.cull(this.world, this.screenRect, false);
    const detailed = z >= 1.6; // assez proche pour afficher les voitures à l'échelle réelle
    const eco = this.opts.quality === 'economie';

    // Voitures : tri de profondeur (y croissant) pour un rendu 2,5D correct.
    const order = this.sim.cars.slice();
    const ys = new Map<string, { x: number; y: number }>();
    for (const c of order) {
      const p = { x: 0, y: 0 };
      this.carPos(c, p);
      ys.set(c.id, p);
    }
    order.sort((a, b2) => ys.get(a.id)!.y - ys.get(b2.id)!.y);
    order.forEach((c, k) => {
      const v = this.views.get(c.id)!;
      const p = ys.get(c.id)!;
      v.root.zIndex = k;
      v.root.visible = detailed;
      v.root.position.set(p.x, p.y);
      // cap : direction du tracé + composante latérale
      const rs = this.replayState(c);
      const ds = rs ? rs.ds : c.s - c.prevS;
      const dl = rs ? rs.dl : c.lat - c.prevLat;
      const { i } = locate(t, rs ? rs.s : c.prevS + ds * this.alpha);
      let head = t.heading[i];
      if (ds > 0.05) head -= Math.atan2(dl, ds);
      if (c.errKind === 3 && c.errTimer > 0) head += (5 - c.errTimer) * 2.6; // tête-à-queue
      v.body.rotation = head;
      v.shadow.rotation = head;
      const sun = this.track.def.sunset ? 2.4 : 0.9;
      v.shadow.position.set(sun, 0.9);
      v.shadow.width = this.track.def.sunset ? 7.4 : 6.2;
      const wk = Math.max(0, Math.min(1, (this.sim.wet - 0.3) / 0.5));
      v.refl.visible = wk > 0.02 && detailed;
      if (v.refl.visible) {
        v.refl.rotation = head;
        v.refl.position.set(0, 0.5 / TILT);
        v.refl.alpha = 0.28 * wk;
      }
      v.side.rotation = head;
      v.side.position.set(0, -0.14 / TILT);
      v.body.position.set(0, -0.42 / TILT);
      v.body.alpha = c.status === 'dnf' ? 0.6 : 1;
      // écran
      const sx = (p.x - this.cam.x) * z + sw / 2;
      const sy = (p.y - this.cam.y) * z * TILT + sh / 2;
      const focusTeam = c.e.teamId === this.opts.focusTeamId;
      v.dot.visible = !detailed && c.status !== 'dnf';
      v.dot.position.set(sx, sy);
      v.dot.scale.set(focusTeam ? 1 : 0.72);
      const showLabel = c.status !== 'dnf' && (focusTeam || (this.opts.names && (!eco || !detailed)));
      v.label.visible = showLabel && sx > -40 && sx < sw + 40 && sy > -40 && sy < sh + 40;
      v.label.position.set(sx, sy - (detailed ? 2.2 * z + 4 : 9));
      v.label.style.fill = focusTeam ? 0xffd400 : 0xffffff;
      v.marker.visible = this.follow === c.id;
      v.marker.position.set(sx, sy - (detailed ? 2.2 * z + 20 : 24));
      // fumée / poussière lors des erreurs et des freinages bloqués
      const onScreen = sx > -60 && sx < sw + 60 && sy > -60 && sy < sh + 60;
      if (detailed && onScreen && c.errKind > 0 && c.errTimer > 0 && Math.random() < (eco ? 0.2 : 0.5)) this.puff(p.x, p.y, Math.abs(c.lat) > t.half ? 0xd8b98a : 0xdddddd, 0.9);
      const wet = this.sim.wet > 0.3;
      if (detailed && onScreen && c.damage && Math.random() < (c.damage === 2 ? 0.5 : 0.15)) {
        this.puff(p.x - Math.cos(head) * 2, p.y - Math.sin(head) * 2, c.damage === 2 ? 0xffb000 : 0x555555, 0.5);
      }
      // traces de pneus : blocages, sorties, envol au départ
      const launching = this.sim.t > this.sim.lightsOut && this.sim.t < this.sim.lightsOut + 1.6;
      if (!rs && detailed && (launching || (c.errKind > 0 && c.errTimer > 0 && c.v > 4))) this.tyreMark(c, p.x, p.y, head);
      // étincelles : fond plat à haute vitesse, crevaison
      if (!rs && detailed && onScreen && !eco && ((c.v > 72 && Math.random() < 0.025) || (c.damage === 2 && Math.random() < 0.4))) {
        for (let k = 0; k < 3; k++) this.puff(p.x - Math.cos(head) * 2.6, p.y - Math.sin(head) * 2.6, 0xffc23d, 0.22);
      }
      const night = !!this.track.def.night;
      v.rearLight.visible = detailed && c.status !== 'dnf' && (night || (wet && Math.floor(this.sim.t * 4) % 2 === 0));
      if (v.rearLight.visible) v.rearLight.position.set(-Math.cos(head) * 2.7, -Math.sin(head) * 2.7 - 0.5 / TILT);
      if (wet && detailed && onScreen && !eco && c.v > 25 && Math.random() < 0.35) {
        this.puff(p.x - Math.cos(head) * 3.5, p.y - Math.sin(head) * 3.5, 0xe3ebf2, 0.6 + c.v / 160);
      }
    });
    this.carsLayer.sortableChildren = true;
    this.updateAmbience(dtMs, sw, sh);
    this.contactSparks();
    this.updateSafetyCar(sw, sh, z, detailed);
    this.updatePuffs(dtMs);
    this.updateCrews();
    this.updateLights(sw);

    // Minicarte
    this.mini.visible = this.follow !== null || sw < 700;
    this.mini.position.set(sw - (t.bounds.maxX - t.bounds.minX) * this.miniScale - 14, sh - (t.bounds.maxY - t.bounds.minY) * this.miniScale - (sw <= 520 ? 190 : sh < 520 ? 96 : 104));
    for (const ch of this.mini.children) {
      if (!(ch instanceof Sprite)) continue;
      const c = this.sim.car(ch.label);
      if (!c) continue;
      worldPos(t, c.s, 0, this.tmp);
      ch.position.set((this.tmp.x + this.miniOff.x) * this.miniScale, (this.tmp.y + this.miniOff.y) * this.miniScale);
      ch.visible = c.status !== 'dnf';
      ch.scale.set(c.e.teamId === this.opts.focusTeamId ? 0.5 : 0.32);
    }

    // Pluie
    if (this.rain) {
      const r = this.rain;
      r.clear();
      const wetv = this.sim.wet;
      const drops = this.sim.raining ? Math.ceil(this.rainDrops.length * Math.min(1, 0.3 + wetv)) : 0;
      if (wetv > 0.03) r.rect(0, 0, sw, sh).fill({ color: 0x1d3557, alpha: 0.18 * wetv });
      for (let k = 0; k < drops; k++) {
        const d = this.rainDrops[k];
        d.y += (dtMs / 1000) * d.v * 1.6;
        if (d.y > 1) d.y -= 1;
        const x = d.x * sw, y = d.y * sh;
        r.moveTo(x, y).lineTo(x - 4, y + 14);
      }
      if (drops) r.stroke({ width: 1.2, color: 0xcfe3f5, alpha: 0.55 });
    }
  }

  private tyreMark(c: SimCar, x: number, y: number, head: number): void {
    const last = this.lastMark.get(c.id) ?? -99;
    if (Math.abs(c.s - last) < 2.5) return;
    this.lastMark.set(c.id, c.s);
    if (!this.markTex) {
      const g = new Graphics().rect(0, 0, 10, 3).fill(0x111111);
      this.markTex = this.app.renderer.generateTexture({ target: g, resolution: 1 });
    }
    const cap = this.opts.quality === 'economie' ? 80 : 240;
    let m = this.marks[this.markIdx];
    if (!m) {
      m = new Sprite(this.markTex);
      m.anchor.set(0.5);
      m.scale.set(0.32, 0.25);
      this.marksLayer.addChild(m);
      this.marks.push(m);
    }
    this.markIdx = (this.markIdx + 1) % cap;
    m.position.set(x - Math.cos(head) * 1.6, y - Math.sin(head) * 1.6);
    m.rotation = head;
    m.alpha = 0.35;
  }

  /** Gerbe d'étincelles à chaque nouveau contact annoncé par le moteur. */
  private contactSparks(): void {
    const ev = this.sim.events;
    for (; this.seenEvents < ev.length; this.seenEvents++) {
      const e = ev[this.seenEvents];
      if (e.kind !== 'contact' || !e.carId) continue;
      const c = this.sim.car(e.carId);
      if (!c) continue;
      this.carPos(c, this.tmp);
      for (let k = 0; k < 10; k++) this.puff(this.tmp.x + (Math.random() - 0.5) * 3, this.tmp.y + (Math.random() - 0.5) * 3, 0xffb000, 0.25);
    }
  }

  /** Course de nuit : décor assombri, projecteurs le long de la piste, halos lumineux. */
  private buildNight(): void {
    const t = this.track, b = t.bounds;
    const dark = new Graphics().rect(b.minX - 1200, b.minY - 1200, b.maxX - b.minX + 2400, b.maxY - b.minY + 2400).fill({ color: 0x070b24, alpha: 0.7 });
    this.world.addChild(dark);
    // halos des projecteurs sur la piste (additifs)
    // piste éclairée : bande lumineuse chaude continue (plus intense au centre)
    const pools = this.segments((g, i0, i1) => {
      const pts = this.edge(0, i0, i1 + 2, 2);
      g.poly(pts, false).stroke({ width: (t.half + 10) * 2, color: 0xffd98a, alpha: 0.1, join: 'round', cap: 'butt' });
      g.poly(pts, false).stroke({ width: t.half * 2, color: 0xfff1c4, alpha: 0.12, join: 'round', cap: 'butt' });
    });
    pools.blendMode = 'add';
    // mâts d'éclairage
    this.segments((g, i0, i1) => {
      const step = Math.max(1, Math.round(90 / t.ds));
      for (let i = i0 - (i0 % step); i < i1; i += step) {
        const side = (i / step) % 2 ? 1 : -1;
        const x = t.x[i] + t.nx[i] * (t.half + 11) * side, y = t.y[i] + t.ny[i] * (t.half + 11) * side;
        g.rect(x - 0.25, y - 14 / TILT, 0.5, 14 / TILT).fill(0x3a3f4a);
        g.circle(x, y - 14 / TILT, 1.1).fill(0xfff6d8);
        g.circle(x, y - 14 / TILT, 3).fill({ color: 0xfff1c4, alpha: 0.25 });
      }
    });
  }

  private puff(x: number, y: number, color: number, size = 1): void {
    const g = this.puffPool.pop();
    if (!g) return;
    g.visible = true;
    g.tint = color;
    g.position.set(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2);
    g.scale.set(0.08 * size);
    g.alpha = 0.7;
    this.puffs.push({ g, life: 1, size });
  }

  /** Réalisateur TV : suit la bagarre la plus serrée, change de plan toutes les ~7 s. */
  private tvDirector(dtMs: number): void {
    this.tvTimer -= dtMs / 1000;
    const cur = this.follow ? this.sim.car(this.follow) : null;
    if (this.tvTimer > 0 && cur && cur.status === 'run') return;
    const st = this.sim.standings().filter((c) => c.status === 'run' && c.pit === 0);
    let best = st[0], bestGap = Infinity;
    for (let k = 1; k < st.length; k++) {
      const gap = st[k].interval;
      const weight = gap + k * 0.04; // à écart égal, on préfère l'avant de la course
      if (gap > 0 && weight < bestGap) { bestGap = weight; best = st[k]; }
    }
    if (bestGap > 2.5 && Math.random() < 0.3) best = st[Math.floor(Math.random() * Math.min(st.length, 6))] ?? best;
    if (best) this.follow = best.id;
    this.tvTimer = 7;
  }

  private updateCrews(): void {
    const t = this.track, side = t.def.pitSide;
    for (const [teamIdx, list] of this.crews) {
      const boxS = t.length - 150 + teamIdx * 30;
      const car = this.sim.cars.find((c) => c.teamIdx === teamIdx && c.pit === 2);
      const busy = !!car;
      // progression de l'arrêt (0 → 1) : roues déposées, nouvelles roues montées, départ
      let prog = 0;
      if (car) {
        if (!this.pitStart.has(car.id)) this.pitStart.set(car.id, car.pitTimer);
        prog = 1 - car.pitTimer / Math.max(0.1, this.pitStart.get(car.id)!);
      }
      for (const c of this.sim.cars) if (c.teamIdx === teamIdx && c.pit !== 2) this.pitStart.delete(c.id);
      this.animateWheels(teamIdx, car ?? null, prog, boxS, side);
      const tt = performance.now() / 1000;
      list.forEach((m, k) => {
        let s: number, lat: number;
        if (busy) {
          // autour des 4 roues + cric avant/arrière ; les mécaniciens s'agitent
          const spots = [[-2, -1.6], [-2, 1.6], [2, -1.6], [2, 1.6], [3.6, 0], [-3.6, 0]];
          const jig = k < 4 && prog > 0.05 && prog < 0.9 ? Math.sin(tt * 18 + k) * 0.18 : 0;
          s = boxS + spots[k][0] + jig;
          lat = t.boxLat + spots[k][1] * side + (k < 4 ? Math.sign(spots[k][1]) * side * (prog < 0.35 ? prog * 1.2 : prog < 0.65 ? 0.42 - (prog - 0.35) * 1.4 : 0) : 0);
          m.scale.y = k >= 4 && prog < 0.95 ? 0.9 : 1; // cric : accroupis
        } else {
          m.scale.y = 1;
          s = boxS - 5 + k * 2;
          lat = side * (t.half + 15.5);
        }
        worldPos(t, s, lat, this.tmp);
        m.position.set(this.tmp.x, this.tmp.y);
        m.zIndex = 1000 + this.tmp.y;
      });
    }
  }

  /** Quatre roues par écurie : on dépose les usées, on monte les neuves (couleur de la gomme). */
  private animateWheels(teamIdx: number, car: SimCar | null, prog: number, boxS: number, side: number): void {
    const t = this.track;
    let w = this.wheels.get(teamIdx);
    if (!w) {
      w = [];
      for (let k = 0; k < 4; k++) {
        const g = new Graphics();
        this.carsLayer.addChild(g);
        w.push(g);
      }
      this.wheels.set(teamIdx, w);
    }
    const spots = [[-1.75, -0.85], [-1.75, 0.85], [1.55, -0.85], [1.55, 0.85]];
    w.forEach((g, k) => {
      if (!car || prog <= 0.02 || prog >= 0.7) {
        g.visible = false;
        return;
      }
      g.visible = true;
      g.clear();
      const fresh = prog > 0.38;
      const out = prog < 0.38 ? prog / 0.38 : 1 - (prog - 0.38) / 0.32;
      const col = fresh ? COMPOUND_HEX[car.pitReq ?? car.compound] : 0x666666;
      g.circle(0, 0, 0.42).fill(0x151515).stroke({ width: 0.12, color: INK });
      g.circle(0, 0, 0.3).stroke({ width: 0.1, color: col });
      g.circle(0, 0, 0.12).fill(0xbfc4cc);
      worldPos(t, boxS + spots[k][0], t.boxLat + (spots[k][1] + Math.sign(spots[k][1]) * out * 1.6) * side, this.tmp);
      g.position.set(this.tmp.x, this.tmp.y - 0.4 / TILT);
      g.zIndex = 1001 + this.tmp.y;
    });
  }

  private updateLights(sw: number): void {
    const t = this.sim.t, out = this.sim.lightsOut;
    const ls = this.sim.lightsStart;
    const lit = t >= out || t < ls || this.sim.formation ? 0 : Math.min(5, Math.floor((t - ls) / LIGHTS_ON) + 1);
    if (this.gantry) {
      const g = this.gantry;
      g.clear();
      const w = this.track.def.width + 4;
      for (let k = 0; k < 5; k++) {
        const y = (-w / 2 + 2 + k * ((w - 4) / 4)) * (this.track.nx[0] === 0 ? 1 : 1);
        g.circle(0, y + w / 2 - 0.5, 0.55).fill(k < lit ? 0xff2020 : 0x3a1010);
      }
    }
    if (!this.lights) return;
    const L = this.lights;
    L.clear();
    if (t > out + 1.5 || this.sim.formation || t < this.sim.lightsStart - 0.5) {
      L.visible = false;
      return;
    }
    L.visible = true;
    const r = Math.min(22, sw / 22), gap = r * 2.6, x0 = sw / 2 - gap * 2, y0 = 70;
    L.roundRect(x0 - r * 1.6, y0 - r * 1.6, gap * 4 + r * 3.2, r * 3.2, 10).fill({ color: 0x16130f, alpha: 0.9 }).stroke({ width: 3, color: 0xf4f1ea });
    for (let k = 0; k < 5; k++) L.circle(x0 + k * gap, y0, r).fill(k < lit ? 0xff2020 : 0x3a1010).stroke({ width: 2, color: 0x000000 });
  }

  private updatePuffs(dtMs: number): void {
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k];
      p.life -= dtMs / 900;
      p.g.alpha = Math.max(0, p.life * 0.6);
      p.g.scale.set((0.08 + (1 - p.life) * 0.2) * p.size);
      if (p.life <= 0) {
        p.g.visible = false;
        this.puffPool.push(p.g);
        this.puffs.splice(k, 1);
      }
    }
  }

  /** Voiture la plus proche d'un point écran (pour le toucher). */
  pick(sx: number, sy: number): string | null {
    const sw = this.app.screen.width, sh = this.app.screen.height, z = this.cam.z;
    let best: string | null = null, bd = 28 * 28;
    for (const c of this.sim.cars) {
      if (c.status === 'dnf') continue;
      this.carPos(c, this.tmp);
      const x = (this.tmp.x - this.cam.x) * z + sw / 2, y = (this.tmp.y - this.cam.y) * z * TILT + sh / 2;
      const d = (x - sx) ** 2 + (y - sy) ** 2;
      if (d < bd) {
        bd = d;
        best = c.id;
      }
    }
    return best;
  }

  destroy(): void {
    this.ready = false;
    try {
      this.app.destroy({ removeView: true }, { children: true, texture: true, textureSource: true });
    } catch {
      /* déjà détruit */
    }
  }
}
