// Rendu 2,5D de la course avec PixiJS : lecture seule de l'état du moteur.
// Caméra inclinée (écrasement vertical), ombres portées, volumes extrudés, encrage façon bande dessinée.
import { Application, Container, Culler, Graphics, Rectangle, Sprite, Text, Texture } from 'pixi.js';
import { CAR_LEN, LIGHTS_ON, type RaceSim, type SimCar } from '../engine/race';
import { locate, worldPos, type Track } from '../engine/track';
import { Rng } from '../engine/rng';

export const TILT = 0.64; // écrasement vertical de la caméra
const INK = 0x16130f;
const CAR_PX = 16; // résolution des textures de voiture (px par mètre)

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

export type CameraMode = 'suivre' | 'tv' | 'circuit';

interface CarView {
  root: Container;
  shadow: Graphics;
  body: Sprite;
  ring: Graphics;
  label: Text;
  dot: Sprite;
  marker: Sprite;
  rearLight: Graphics;
}

const THEMES = {
  port: { ground: 0xcdbf9f, ground2: 0xbfae8a, runoff: 0xd9d2c2, accent: 0x2a6f97, bg: '#2a6f97' },
  foret: { ground: 0x6a9a45, ground2: 0x5b8a3a, runoff: 0xd8cfa8, accent: 0x2f5d2a, bg: '#40692e' },
  desert: { ground: 0xe2b56a, ground2: 0xd6a659, runoff: 0xefd7a6, accent: 0xb9783f, bg: '#c9934d' },
  lac: { ground: 0x7aa651, ground2: 0x6b9645, runoff: 0xdcd3ae, accent: 0x3f88c5, bg: '#557f3a' },
  montagne: { ground: 0x9aa47f, ground2: 0xb9bfa6, runoff: 0xd7d2c4, accent: 0x6c7a89, bg: '#7d8768' },
};

function hex(c: string): number {
  return parseInt(c.replace('#', ''), 16);
}

function shade(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
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
    return Math.max(2.2, Math.min(6, Math.max(w, h * 0.8) / 210));
  }

  zoomBy(f: number): void {
    this.userZoom = Math.max(0.35, Math.min(3, this.userZoom * f));
  }

  setMode(m: CameraMode, carId?: string): void {
    this.mode = m;
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

  private buildScenery(): void {
    const t = this.track, def = t.def, theme = THEMES[def.theme], eco = this.opts.quality === 'economie';
    const b = t.bounds;
    const rng = new Rng(def.id.length * 7919);
    const ground = new Graphics();
    const pad = 900;
    ground.rect(b.minX - pad, b.minY - pad, b.maxX - b.minX + 2 * pad, b.maxY - b.minY + 2 * pad).fill(theme.ground);
    // Taches de texture (herbe, sable, pavés) façon trame BD.
    for (let i = 0; i < (eco ? 90 : 260); i++) {
      const x = rng.range(b.minX - 400, b.maxX + 400), y = rng.range(b.minY - 400, b.maxY + 400);
      ground.ellipse(x, y, rng.range(20, 90), rng.range(10, 40)).fill({ color: theme.ground2, alpha: 0.55 });
    }
    if (def.theme === 'port') {
      // La mer au sud, avec un quai encré.
      const seaY = b.maxY + 70;
      ground.rect(b.minX - pad, seaY, b.maxX - b.minX + 2 * pad, pad).fill(0x2a6f97);
      ground.rect(b.minX - pad, seaY - 6, b.maxX - b.minX + 2 * pad, 6).fill(0x8d8778);
      ground.moveTo(b.minX - pad, seaY).lineTo(b.maxX + pad, seaY).stroke({ width: 2, color: INK });
      for (let i = 0; i < 26; i++) {
        const x = rng.range(b.minX - 300, b.maxX + 300), y = seaY + rng.range(30, 400);
        ground.moveTo(x, y).lineTo(x + rng.range(20, 60), y).stroke({ width: 1.6, color: 0xbfe1f0, alpha: 0.7 });
      }
    }
    if (def.theme === 'lac') {
      // Lac au cœur du circuit (rayon limité par la distance à la piste).
      const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
      const r = Math.max(30, this.distToTrack(cx, cy) - t.half - 40);
      const pts: number[] = [];
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2, rr = r * (0.82 + 0.18 * Math.sin(a * 3 + 1));
        pts.push(cx + Math.cos(a) * rr * 1.25, cy + Math.sin(a) * rr * 0.8);
      }
      ground.poly(pts, true).fill(0x3f88c5).stroke({ width: 2.5, color: INK });
      for (let k = 0; k < 14; k++) {
        const x = cx + rng.range(-r * 0.8, r * 0.8), y = cy + rng.range(-r * 0.45, r * 0.45);
        ground.moveTo(x, y).lineTo(x + rng.range(12, 30), y).stroke({ width: 1.4, color: 0xcfe8f7, alpha: 0.75 });
      }
    }
    if (def.theme === 'montagne') {
      // Sommets enneigés à l'horizon (au nord), plaques de neige.
      for (let k = 0; k < 9; k++) {
        const x = b.minX - 300 + k * ((b.maxX - b.minX + 600) / 8), w = rng.range(200, 320), h = rng.range(260, 420);
        const y = b.minY - 160;
        ground.poly([x - w, y, x, y - h, x + w, y]).fill(0x6c7a89).stroke({ width: 2.5, color: INK });
        ground.poly([x - w * 0.32, y - h * 0.68, x, y - h, x + w * 0.32, y - h * 0.68, x + w * 0.1, y - h * 0.6, x - w * 0.05, y - h * 0.7]).fill(0xf4f7fb);
      }
      for (let i = 0; i < 30; i++) {
        const x = rng.range(b.minX - 300, b.maxX + 300), y = rng.range(b.minY - 150, b.maxY + 300);
        if (this.distToTrack(x, y) < 40) continue;
        ground.ellipse(x, y, rng.range(15, 45), rng.range(6, 16)).fill({ color: 0xf4f7fb, alpha: 0.8 });
      }
    }
    if (def.theme === 'desert') {
      for (let i = 0; i < 40; i++) {
        const x = rng.range(b.minX - 400, b.maxX + 400), y = rng.range(b.minY - 400, b.maxY + 400);
        if (this.distToTrack(x, y) < 60) continue;
        const w = rng.range(40, 110);
        ground.moveTo(x - w, y).quadraticCurveTo(x, y - w * 0.35, x + w, y).stroke({ width: 2.2, color: 0xb9783f, alpha: 0.6 });
      }
    }
    this.world.addChild(ground);

    // Dégagements, encre extérieure, asphalte.
    this.band(t.half + 9, theme.runoff);
    this.band(t.half + 1.2, INK);
    this.band(t.half, 0x55575c);
    // Lignes blanches de bord et vibreurs rouges et blancs dans les virages.
    const kerbStep = Math.max(1, Math.round(3 / t.ds));
    this.segments((g, i0, i1) => {
      g.poly(this.edge(t.half - 0.35, i0, i1 + 2, 2), false).stroke({ width: 0.3, color: 0xf4f1ea });
      g.poly(this.edge(-(t.half - 0.35), i0, i1 + 2, 2), false).stroke({ width: 0.3, color: 0xf4f1ea });
      for (let i = i0 - (i0 % kerbStep); i < i1; i += kerbStep) {
        if (t.corner[i] < 0.28) continue;
        const j = (i + kerbStep) % t.n;
        const col = (i / kerbStep) % 2 ? 0xf4f1ea : 0xd62828;
        for (const side of [1, -1]) {
          const a = t.half - 0.9, c = t.half + 0.5;
          g.poly([
            t.x[i] + t.nx[i] * a * side, t.y[i] + t.ny[i] * a * side,
            t.x[j] + t.nx[j] * a * side, t.y[j] + t.ny[j] * a * side,
            t.x[j] + t.nx[j] * c * side, t.y[j] + t.ny[j] * c * side,
            t.x[i] + t.nx[i] * c * side, t.y[i] + t.ny[i] * c * side,
          ]).fill(col);
        }
      }
    });
    const g = new Graphics();
    // Voie des stands.
    const pit = this.pitPolys();
    g.poly(pit.lane, true).fill(0x5d5f64);
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
      const a = { x: 0, y: 0 }, c = { x: 0, y: 0 };
      worldPos(t, s, lat - 1.3, a);
      worldPos(t, s, lat + 1.3, c);
      g.moveTo(a.x, a.y).lineTo(c.x, c.y).stroke({ width: 0.35, color: 0xffffff, alpha: 0.85 });
    }
    this.world.addChild(g);
    this.drawBarriers(eco);

    // Volumes 2,5D : stands, tribunes, arbres / immeubles.
    const vol = new Graphics();
    this.drawGarages(vol);
    this.drawGrandstand(vol);
    this.world.addChild(vol);
    this.drawProps(rng, eco);
    this.drawBanners();
    this.drawGantry();
    this.buildCrews();
  }

  /** Rails de sécurité le long des dégagements et murs de pneus à l'extérieur des virages. */
  private drawBarriers(eco: boolean): void {
    const t = this.track;
    const lat = t.half + 9.6;
    const pitS0 = t.pitEntry - t.length - 30, pitS1 = t.pitExit + 30;
    this.segments((g, i0, i1) => {
    for (const side of [1, -1]) {
      // rail interrompu le long de la voie des stands
      let pts: number[] = [];
      const flush = () => {
        if (pts.length > 4) {
          g.poly(pts, false).stroke({ width: 0.9, color: INK });
          g.poly(pts.map((v, k) => (k % 2 ? v - 0.7 / TILT : v)), false).stroke({ width: 0.5, color: 0xc9ccd1 });
        }
        pts = [];
      };
      for (let i = i0 - (i0 % 3); i <= i1 + 3; i += 3) {
        const s = (i % t.n) * t.ds;
        const inPit = side === t.def.pitSide && (s > t.pitEntry - 30 || s < pitS1);
        void pitS0;
        if (inPit) { flush(); continue; }
        const k = i % t.n;
        pts.push(t.x[k] + t.nx[k] * lat * side, t.y[k] + t.ny[k] * lat * side);
      }
      flush();
    }
    // murs de pneus
    const step = Math.max(1, Math.round(2.4 / t.ds));
    for (let i = i0 - (i0 % step); i < i1; i += step) {
      if (t.corner[i] < 0.38) continue;
      const out = -Math.sign(t.curv[i]);
      const s = i * t.ds;
      if (out === t.def.pitSide && (s > t.pitEntry - 30 || s < t.pitExit + 30)) continue;
      const x = t.x[i] + t.nx[i] * (lat + 0.6) * out, y = t.y[i] + t.ny[i] * (lat + 0.6) * out;
      const rows = eco ? 1 : 2;
      for (let r = 0; r < rows; r++) {
        g.circle(x, y - (r * 0.55) / TILT, 0.62).fill(0x1d1d1d).stroke({ width: 0.18, color: INK });
        if (r === rows - 1 && (i / step) % 4 < 1) g.circle(x, y - (r * 0.55) / TILT, 0.62).fill({ color: 0xd62828, alpha: 0.8 });
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
      g.poly([a.x, a.y, b.x, b.y, b.x, b.y - h, a.x, a.y - h]).fill(hex(sp.color)).stroke({ width: 0.35, color: INK });
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
    g.rect(a.x - 0.4, a.y - h, 0.8, h).fill(0x5d5f64).stroke({ width: 0.3, color: INK });
    g.rect(b.x - 0.4, b.y - h, 0.8, h).fill(0x5d5f64).stroke({ width: 0.3, color: INK });
    const top = Math.min(a.y, b.y) - h;
    g.rect(a.x - 1, top - 1.2 / TILT, 2, Math.abs(a.y - b.y) + 1.2 / TILT).fill(0x2b2b2b).stroke({ width: 0.35, color: INK });
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
        m.ellipse(0, 0.35, 0.45, 0.25).fill({ color: 0x000000, alpha: 0.25 });
        m.roundRect(-0.32, -1.5 / TILT, 0.64, 1.3 / TILT, 0.2).fill(col).stroke({ width: 0.12, color: INK });
        m.circle(0, -1.75 / TILT, 0.26).fill(0xf4f1ea).stroke({ width: 0.1, color: INK });
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

  private drawGarages(g: Graphics): void {
    const t = this.track, side = t.def.pitSide;
    const teams: { id: string; color: string; color2: string }[] = [];
    for (const c of this.sim.cars) if (!teams.some((x) => x.id === c.e.teamId)) teams.push({ id: c.e.teamId, color: c.e.color, color2: c.e.color2 });
    const h = 7 / TILT;
    // Garages tracés de l'arrière vers l'avant pour respecter l'ordre de profondeur.
    const items = teams.map((tm, k) => {
      const s = t.length - 150 + k * 30;
      const p = (ds: number, lat: number) => { worldPos(t, s + ds, side * lat, this.tmp); return { x: this.tmp.x, y: this.tmp.y }; };
      const a = p(-13, t.half + 17), b2 = p(13, t.half + 17), c = p(13, t.half + 27), d = p(-13, t.half + 27);
      return { tm, a, b: b2, c, d };
    });
    for (const it of items) {
      const { a, b, c, d, tm } = it;
      const col = hex(tm.color);
      const front = side > 0 ? [a, b] : [d, c];
      // façade (vers la piste) + toit
      g.poly([a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y]).fill(0x3d3a36);
      const fy = Math.max(a.y, d.y);
      void fy;
      g.poly([front[0].x, front[0].y, front[1].x, front[1].y, front[1].x, front[1].y - h, front[0].x, front[0].y - h])
        .fill(shade(col, 0.75)).stroke({ width: 0.5, color: INK });
      g.poly([a.x, a.y - h, b.x, b.y - h, c.x, c.y - h, d.x, d.y - h]).fill(col).stroke({ width: 0.6, color: INK });
      g.poly([a.x + (b.x - a.x) * 0.15, a.y - h + (b.y - a.y) * 0.15 - 0.01, a.x + (b.x - a.x) * 0.85, a.y - h + (b.y - a.y) * 0.85,
        d.x + (c.x - d.x) * 0.85, d.y - h + (c.y - d.y) * 0.85, d.x + (c.x - d.x) * 0.15, d.y - h + (c.y - d.y) * 0.15]).fill({ color: hex(tm.color2), alpha: 0.85 });
    }
  }

  private drawGrandstand(g: Graphics): void {
    // Tribune toujours au nord de la ligne droite (derrière la piste vu de la caméra) pour ne jamais masquer les voitures.
    const t = this.track, side = 1;
    const base = t.def.pitSide > 0 ? t.half + 32 : t.half + 12;
    const s0 = -180, s1 = 140;
    const rows = 5;
    for (let r = rows - 1; r >= 0; r--) {
      const lat = base + r * 3.2;
      const hgt = (2 + r * 2.2) / TILT;
      const pts: number[] = [], top: number[] = [];
      for (let s = s0; s <= s1; s += 20) {
        worldPos(t, s, side * lat, this.tmp);
        pts.push(this.tmp.x, this.tmp.y);
        top.push(this.tmp.x, this.tmp.y - hgt);
      }
      const n = pts.length / 2;
      const front: number[] = [...pts];
      for (let k = n - 1; k >= 0; k--) front.push(top[k * 2], top[k * 2 + 1]);
      g.poly(front, true).fill(r % 2 ? 0x8a8f99 : 0x9aa0aa).stroke({ width: 0.5, color: INK });
      // public : petites taches colorées
      const rng = new Rng(r * 31 + 5);
      for (let k = 0; k < (this.opts.quality === 'economie' ? 25 : 70); k++) {
        const s = rng.range(s0 + 4, s1 - 4);
        worldPos(t, s, side * lat, this.tmp);
        g.circle(this.tmp.x, this.tmp.y - hgt - 0.4 / TILT, 0.7).fill(rng.pick([0xd62828, 0xf2c14e, 0x3a86ff, 0xf4f1ea, 0x06d6a0, 0xff7a00]));
      }
    }
    // toit de la tribune
    const pr: number[] = [];
    for (let s = s0; s <= s1; s += 20) { worldPos(t, s, side * (base + 9), this.tmp); pr.push(this.tmp.x, this.tmp.y - 16 / TILT); }
    for (let s = s1; s >= s0; s -= 20) { worldPos(t, s, side * (base + 17), this.tmp); pr.push(this.tmp.x, this.tmp.y - 16 / TILT); }
    g.poly(pr, true).fill({ color: 0xf4f1ea, alpha: 0.92 }).stroke({ width: 0.8, color: INK });
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

  private drawProps(rng: Rng, eco: boolean): void {
    const t = this.track, theme = t.def.theme, b = t.bounds;
    const props: { x: number; y: number; kind: number; s: number }[] = [];
    const count = eco ? 70 : 190;
    let guard = 0;
    while (props.length < count && guard++ < count * 8) {
      const x = rng.range(b.minX - 260, b.maxX + 260), y = rng.range(b.minY - 260, b.maxY + 260);
      if (theme === 'port' && y > b.maxY + 60) continue;
      if (theme === 'montagne' && y < b.minY - 150) continue;
      if (theme === 'lac') {
        const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
        const rr = Math.max(30, this.distToTrack(cx, cy) - t.half - 40);
        if (((x - cx) / (rr * 1.3)) ** 2 + ((y - cy) / (rr * 0.85)) ** 2 < 1.1) continue;
      }
      const d = this.distToTrack(x, y);
      if (d < t.half + 22) continue;
      // garder dégagées les zones des stands / tribunes
      if (y > -110 && y < 75 && x > -300 && x < 320) continue;
      props.push({ x, y, kind: rng.int(0, 2), s: rng.range(0.8, 1.35) });
    }
    props.sort((a, b2) => a.y - b2.y); // ordre de profondeur
    // Regroupement par bandes horizontales de 200 m (respecte l'ordre de profondeur, permet le culling).
    const layer = new Container();
    const bands = new Map<number, Graphics>();
    for (const p of props) {
      const key = Math.floor(p.y / 200);
      let g = bands.get(key);
      if (!g) {
        g = new Graphics();
        g.cullable = true;
        bands.set(key, g);
        layer.addChild(g);
      }
      if (theme === 'foret' || theme === 'lac') this.tree(g, p.x, p.y, p.s, theme === 'lac' && p.kind === 2 ? 0 : p.kind);
      else if (theme === 'montagne') (p.kind === 0 ? this.rock(g, p.x, p.y, p.s, 0x7d7f86) : this.tree(g, p.x, p.y, p.s * 0.9, 2));
      else if (theme === 'port') (p.kind === 0 ? this.palm(g, p.x, p.y, p.s) : this.building(g, p.x, p.y, p.s, rng));
      else (p.kind === 0 ? this.palm(g, p.x, p.y, p.s) : this.rock(g, p.x, p.y, p.s));
    }
    this.world.addChild(layer);
  }

  private tree(g: Graphics, x: number, y: number, s: number, kind: number): void {
    const h = 14 * s / TILT;
    g.ellipse(x + 4 * s, y + 2 * s, 7 * s, 3.5 * s).fill({ color: 0x000000, alpha: 0.22 });
    g.rect(x - 0.7 * s, y - h * 0.35, 1.4 * s, h * 0.35).fill(0x5b3a1e);
    const cols = kind === 1 ? [0x1f4d2b, 0x2e6b3a] : [0x2d5e2a, 0x3f7f35];
    if (kind === 2) {
      g.poly([x, y - h * 1.25, x - 6 * s, y - h * 0.3, x + 6 * s, y - h * 0.3]).fill(cols[0]).stroke({ width: 0.7, color: INK });
      g.poly([x, y - h * 1.05, x - 3 * s, y - h * 0.5, x + 1.5 * s, y - h * 0.5]).fill({ color: cols[1], alpha: 0.9 });
    } else {
      g.circle(x, y - h * 0.75, 6 * s).fill(cols[0]).stroke({ width: 0.7, color: INK });
      g.circle(x - 1.8 * s, y - h * 0.85, 3 * s).fill({ color: cols[1], alpha: 0.9 });
    }
  }

  private palm(g: Graphics, x: number, y: number, s: number): void {
    const h = 12 * s / TILT;
    g.ellipse(x + 4 * s, y + 1.5 * s, 6 * s, 2.5 * s).fill({ color: 0x000000, alpha: 0.2 });
    g.moveTo(x, y).quadraticCurveTo(x + 2 * s, y - h * 0.5, x + 1 * s, y - h).stroke({ width: 1.1 * s, color: 0x7a5230 });
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      g.moveTo(x + s, y - h).quadraticCurveTo(x + s + Math.cos(a) * 4 * s, y - h - 2 * s, x + s + Math.cos(a) * 7 * s, y - h + Math.abs(Math.sin(a)) * 3 * s)
        .stroke({ width: 1.3 * s, color: 0x3f8f3a });
    }
  }

  private building(g: Graphics, x: number, y: number, s: number, rng: Rng): void {
    const w = 16 * s, d = 12 * s, h = rng.range(10, 26) * s / TILT;
    const col = rng.pick([0xe8c9a0, 0xf0e1c6, 0xd99a6c, 0xc8d6c4, 0xf2d98c]);
    g.rect(x - w / 2 + 3, y - d / 2 + 3, w, d).fill({ color: 0x000000, alpha: 0.2 });
    g.rect(x - w / 2, y + d / 2 - h, w, h).fill(shade(col, 0.82)).stroke({ width: 0.6, color: INK });
    g.rect(x - w / 2, y - d / 2 - h, w, d).fill(col).stroke({ width: 0.6, color: INK });
    for (let k = 0; k < 3; k++) g.rect(x - w / 2 + 2 + k * (w / 3), y + d / 2 - h * 0.7, w / 3 - 4, h * 0.18).fill(0x2a3d4f);
    g.rect(x - w / 2, y - d / 2 - h, w, d * 0.25).fill(0xb5452f);
  }

  private rock(g: Graphics, x: number, y: number, s: number, color = 0xa9643a): void {
    const r = 5 * s;
    g.ellipse(x + 2, y + 1, r * 1.3, r * 0.5).fill({ color: 0x000000, alpha: 0.18 });
    g.poly([x - r, y, x - r * 0.6, y - r * 1.2 / TILT * 0.6, x + r * 0.3, y - r * 1.4 / TILT * 0.6, x + r, y - r * 0.4, x + r * 0.9, y])
      .fill(color).stroke({ width: 0.6, color: INK });
  }

  // ------------------------------------------------------------ voitures

  private scView: { root: Container; body: Sprite; bar: Graphics; label: Text; dot: Sprite } | null = null;

  /** Voiture de sécurité : berline blanche à bandes orange, rampe lumineuse clignotante. */
  private buildSafetyCar(): void {
    const S = CAR_PX;
    const g = new Graphics();
    g.roundRect(-2.4 * S, -0.95 * S, 4.8 * S, 1.9 * S, 0.5 * S).fill(0xf4f1ea).stroke({ width: 0.14 * S, color: INK });
    g.rect(-2.3 * S, -0.25 * S, 4.6 * S, 0.5 * S).fill(0xff7a00);
    g.roundRect(-0.9 * S, -0.75 * S, 1.9 * S, 1.5 * S, 0.3 * S).fill(0x2b3a4a);
    const tex = this.app.renderer.generateTexture({ target: g, resolution: 1, antialias: true });
    g.destroy();
    const root = new Container();
    const shadow = new Graphics().roundRect(-2.5, -1.05, 5, 2.1, 0.8).fill({ color: 0x000000, alpha: 0.32 });
    shadow.position.set(0.5, 0.7 / TILT);
    const body = new Sprite(tex);
    body.anchor.set(0.5);
    body.scale.set(1 / CAR_PX);
    body.position.set(0, -0.35 / TILT);
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

  private carTexture(e: SimCar['e']): Texture {
    const c1 = hex(e.color), c2 = hex(e.color2);
    const holder = new Container();
    const g = new Graphics();
    holder.addChild(g);
    const S = CAR_PX;
    const L = CAR_LEN * S, W = 1.9 * S;
    // repère : x vers l'avant, centré en (0,0)
    const r = (x: number, y: number, w: number, h: number) => g.roundRect(x * S, y * S, w * S, h * S, 0.12 * S);
    // pneus
    for (const [px, py] of [[-2.15, -0.98], [-2.15, 0.6], [1.25, -0.93], [1.25, 0.6]] as const) r(px, py, 0.75, 0.38).fill(0x1b1b1b).stroke({ width: 0.12 * S, color: INK });
    // aileron arrière
    r(-2.6, -0.85, 0.5, 1.7).fill(c2).stroke({ width: 0.12 * S, color: INK });
    // coque
    g.poly([
      -2.15 * S, -0.42 * S, -0.6 * S, -0.62 * S, 0.8 * S, -0.34 * S, 2.35 * S, -0.14 * S,
      2.35 * S, 0.14 * S, 0.8 * S, 0.34 * S, -0.6 * S, 0.62 * S, -2.15 * S, 0.42 * S,
    ]).fill(c1).stroke({ width: 0.12 * S, color: INK });
    // liseré et reflet cel-shading
    g.poly([-1.9 * S, -0.08 * S, 2.2 * S, -0.05 * S, 2.2 * S, 0.05 * S, -1.9 * S, 0.08 * S]).fill(c2);
    g.poly([-1.4 * S, -0.5 * S, 0.6 * S, -0.3 * S, 0.6 * S, -0.22 * S, -1.4 * S, -0.38 * S]).fill({ color: 0xffffff, alpha: 0.35 });
    // aileron avant
    r(2.25, -0.95, 0.38, 1.9).fill(c2).stroke({ width: 0.12 * S, color: INK });
    // cockpit + casque
    g.ellipse(-0.1 * S, 0, 0.55 * S, 0.27 * S).fill(INK);
    g.circle(0.0, 0, 0.2 * S).fill(0xf4f1ea);
    g.circle(0.04 * S, 0, 0.12 * S).fill(c2);
    // numéro de course sur le capot moteur (pastille blanche)
    g.circle(-1.25 * S, 0, 0.36 * S).fill(0xf4f1ea).stroke({ width: 0.06 * S, color: INK });
    const num = new Text({ text: String(e.number), style: { fontFamily: 'Bangers, Impact, sans-serif', fontSize: 0.5 * S, fill: INK } });
    num.anchor.set(0.5);
    num.rotation = Math.PI / 2;
    num.position.set(-1.25 * S, 0);
    holder.addChild(num);
    // sponsor principal sur les pontons
    const liv = this.opts.liveries?.[e.teamId];
    if (liv) {
      for (const side of [-1, 1]) {
        g.rect(-1.05 * S, side * 0.42 * S - 0.12 * S, 1.2 * S, 0.24 * S).fill(hex(liv.color));
        const t = new Text({ text: liv.sponsor.split(' ')[0].toUpperCase().slice(0, 7), style: { fontFamily: 'Barlow Condensed, Arial Narrow, sans-serif', fontWeight: '700', fontSize: 0.2 * S, fill: 0xffffff } });
        t.anchor.set(0.5);
        t.position.set(-0.45 * S, side * 0.42 * S);
        holder.addChild(t);
      }
    }
    const tex = this.app.renderer.generateTexture({ target: holder, resolution: 1, antialias: true });
    holder.destroy({ children: true });
    void L; void W;
    return tex;
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
      const shadow = new Graphics().roundRect(-CAR_LEN / 2, -1.0, CAR_LEN, 2.0, 0.8).fill({ color: 0x000000, alpha: 0.32 });
      const ring = new Graphics().ellipse(0, 0, 4.2, 2.8).stroke({ width: 0.45, color: 0xffd400, alpha: 0.95 });
      ring.visible = c.e.teamId === this.opts.focusTeamId;
      const body = new Sprite(tex);
      body.anchor.set(0.5);
      body.scale.set(1 / CAR_PX);
      const rearLight = new Graphics().circle(0, 0, 0.28).fill(0xff2a2a);
      rearLight.visible = false;
      root.addChild(ring, shadow, body, rearLight);
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
      this.views.set(c.id, { root, shadow, body, ring, label, dot, marker, rearLight });
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
        const k = Math.min(1, dtMs / (this.mode === 'tv' ? 420 : 180));
        this.cam.x += (this.tmp.x - this.cam.x) * k;
        this.cam.y += (this.tmp.y - this.cam.y) * k;
        // zoom dynamique : on recule un peu à haute vitesse
        const base = this.defaultZoom() * (this.mode === 'tv' ? 1.15 : 1) * this.userZoom;
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
      v.shadow.position.set(0.5, 0.7 / TILT);
      v.body.position.set(0, -0.35 / TILT);
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
    this.contactSparks();
    this.updateSafetyCar(sw, sh, z, detailed);
    this.updatePuffs(dtMs);
    this.updateCrews();
    this.updateLights(sw);

    // Minicarte
    this.mini.visible = this.follow !== null || sw < 700;
    this.mini.position.set(sw - (t.bounds.maxX - t.bounds.minX) * this.miniScale - 14, sh - (t.bounds.maxY - t.bounds.minY) * this.miniScale - 14);
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
      list.forEach((m, k) => {
        let s: number, lat: number;
        if (busy) {
          // autour des 4 roues + avant/arrière
          const spots = [[-2, -1.6], [-2, 1.6], [2, -1.6], [2, 1.6], [3.6, 0], [-3.6, 0]];
          s = boxS + spots[k][0];
          lat = t.boxLat + spots[k][1] * side;
        } else {
          s = boxS - 5 + k * 2;
          lat = side * (t.half + 15.5);
        }
        worldPos(t, s, lat, this.tmp);
        m.position.set(this.tmp.x, this.tmp.y);
        m.zIndex = 1000 + this.tmp.y;
      });
    }
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
