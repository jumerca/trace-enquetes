// Rendu 2,5D de la course avec PixiJS : lecture seule de l'état du moteur.
// Caméra inclinée (écrasement vertical), ombres portées, volumes extrudés, encrage façon bande dessinée.
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import { CAR_LEN, type RaceSim, type SimCar } from '../engine/race';
import { locate, worldPos, type Track } from '../engine/track';
import { Rng } from '../engine/rng';

export const TILT = 0.64; // écrasement vertical de la caméra
const INK = 0x16130f;
const CAR_PX = 10; // résolution des textures de voiture (px par mètre)

export interface RenderOptions {
  quality: 'haute' | 'economie';
  fpsCap: 30 | 60;
  names: boolean;
  focusTeamId: string;
}

interface CarView {
  root: Container;
  shadow: Graphics;
  body: Sprite;
  ring: Graphics;
  label: Text;
  dot: Sprite;
  marker: Sprite;
}

const THEMES = {
  port: { ground: 0xcdbf9f, ground2: 0xbfae8a, runoff: 0xd9d2c2, accent: 0x2a6f97, bg: '#2a6f97' },
  foret: { ground: 0x6a9a45, ground2: 0x5b8a3a, runoff: 0xd8cfa8, accent: 0x2f5d2a, bg: '#40692e' },
  desert: { ground: 0xe2b56a, ground2: 0xd6a659, runoff: 0xefd7a6, accent: 0xb9783f, bg: '#c9934d' },
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
  private puffs: { g: Sprite; life: number }[] = [];
  private puffTex: Texture | null = null;
  private dotTex: Texture | null = null;
  private tmp = { x: 0, y: 0 };
  private ready = false;
  follow: string | null = null; // id de la voiture suivie, null = vue d'ensemble
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
      background: theme.bg,
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
    this.world.addChild(this.carsLayer, this.fxLayer);
    this.buildCars();
    this.buildMinimap();
    if (this.sim.cfg.weather === 'pluie') {
      this.rain = new Graphics();
      this.overlay.addChild(this.rain);
      const r = new Rng(3);
      for (let i = 0; i < (eco ? 40 : 110); i++) this.rainDrops.push({ x: r.next(), y: r.next(), v: 0.6 + r.next() * 0.6 });
    }
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
    const w = this.app.screen.width;
    return Math.max(2.2, Math.min(6, w / 210));
  }

  zoomBy(f: number): void {
    this.cam.z = Math.max(0.05, Math.min(9, this.cam.z * f));
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

  /** Bande de largeur constante centrée sur l'axe (trait épais : robuste, rayon mini > demi-largeur). */
  private band(g: Graphics, halfWidth: number, color: number): void {
    g.poly(this.edge(0, 0, this.track.n, 2), true).stroke({ width: halfWidth * 2, color, join: 'round' });
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
    if (def.theme === 'desert') {
      for (let i = 0; i < 40; i++) {
        const x = rng.range(b.minX - 400, b.maxX + 400), y = rng.range(b.minY - 400, b.maxY + 400);
        if (this.distToTrack(x, y) < 60) continue;
        const w = rng.range(40, 110);
        ground.moveTo(x - w, y).quadraticCurveTo(x, y - w * 0.35, x + w, y).stroke({ width: 2.2, color: 0xb9783f, alpha: 0.6 });
      }
    }
    this.world.addChild(ground);

    const g = new Graphics();
    // Dégagements, encre extérieure, asphalte.
    this.band(g, t.half + 9, theme.runoff);
    this.band(g, t.half + 1.2, INK);
    this.band(g, t.half, 0x55575c);
    // Voie des stands.
    const pit = this.pitPolys();
    g.poly(pit.lane, true).fill(0x5d5f64);
    g.poly(pit.lane, true).stroke({ width: 0.8, color: INK });
    g.poly(pit.wall, true).fill(0xe9e4d8).stroke({ width: 0.6, color: INK });
    // Lignes blanches de bord.
    g.poly(this.edge(t.half - 0.35, 0, t.n, 2), true).stroke({ width: 0.3, color: 0xf4f1ea });
    g.poly(this.edge(-(t.half - 0.35), 0, t.n, 2), true).stroke({ width: 0.3, color: 0xf4f1ea });
    // Vibreurs rouges et blancs dans les virages.
    const kerbStep = Math.max(1, Math.round(3 / t.ds));
    let stripe = 0;
    for (let i = 0; i < t.n; i += kerbStep) {
      if (t.corner[i] < 0.28) continue;
      const j = (i + kerbStep) % t.n;
      const col = stripe++ % 2 ? 0xf4f1ea : 0xd62828;
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

    // Volumes 2,5D : stands, tribunes, arbres / immeubles.
    const vol = new Graphics();
    this.drawGarages(vol);
    this.drawGrandstand(vol);
    this.world.addChild(vol);
    this.drawProps(rng, eco);
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
      const d = this.distToTrack(x, y);
      if (d < t.half + 22) continue;
      // garder dégagées les zones des stands / tribunes
      if (y > -110 && y < 75 && x > -300 && x < 320) continue;
      props.push({ x, y, kind: rng.int(0, 2), s: rng.range(0.8, 1.35) });
    }
    props.sort((a, b2) => a.y - b2.y); // ordre de profondeur
    const g = new Graphics();
    for (const p of props) {
      if (theme === 'foret') this.tree(g, p.x, p.y, p.s, p.kind);
      else if (theme === 'port') (p.kind === 0 ? this.palm(g, p.x, p.y, p.s) : this.building(g, p.x, p.y, p.s, rng));
      else (p.kind === 0 ? this.palm(g, p.x, p.y, p.s) : this.rock(g, p.x, p.y, p.s));
    }
    this.world.addChild(g);
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

  private rock(g: Graphics, x: number, y: number, s: number): void {
    const r = 5 * s;
    g.ellipse(x + 2, y + 1, r * 1.3, r * 0.5).fill({ color: 0x000000, alpha: 0.18 });
    g.poly([x - r, y, x - r * 0.6, y - r * 1.2 / TILT * 0.6, x + r * 0.3, y - r * 1.4 / TILT * 0.6, x + r, y - r * 0.4, x + r * 0.9, y])
      .fill(0xa9643a).stroke({ width: 0.6, color: INK });
  }

  // ------------------------------------------------------------ voitures

  private carTexture(e: SimCar['e']): Texture {
    const c1 = hex(e.color), c2 = hex(e.color2);
    const g = new Graphics();
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
    const tex = this.app.renderer.generateTexture({ target: g, resolution: 1, antialias: true });
    g.destroy();
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
    for (const c of this.sim.cars) {
      let tex = texCache.get(c.e.teamId);
      if (!tex) {
        tex = this.carTexture(c.e);
        texCache.set(c.e.teamId, tex);
      }
      const root = new Container();
      const shadow = new Graphics().roundRect(-CAR_LEN / 2, -1.0, CAR_LEN, 2.0, 0.8).fill({ color: 0x000000, alpha: 0.32 });
      const ring = new Graphics().ellipse(0, 0, 4.2, 2.8).stroke({ width: 0.45, color: 0xffd400, alpha: 0.95 });
      ring.visible = c.e.teamId === this.opts.focusTeamId;
      const body = new Sprite(tex);
      body.anchor.set(0.5);
      body.scale.set(1 / CAR_PX);
      root.addChild(ring, shadow, body);
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
      this.views.set(c.id, { root, shadow, body, ring, label, dot, marker });
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
    const a = this.alpha;
    const s = c.prevS + (c.s - c.prevS) * a;
    const lat = c.prevLat + (c.lat - c.prevLat) * a;
    worldPos(this.track, s, lat, out);
  }

  // ------------------------------------------------------------ image par image

  render(dtMs: number): void {
    if (!this.ready) return;
    const t = this.track;
    const sw = this.app.screen.width, sh = this.app.screen.height;
    this.fps = this.fps * 0.9 + (1000 / Math.max(1, dtMs)) * 0.1;
    // Caméra
    let tz = this.cam.z;
    if (this.follow) {
      const fc = this.sim.car(this.follow);
      if (fc) {
        this.carPos(fc, this.tmp);
        const k = Math.min(1, dtMs / 180);
        this.cam.x += (this.tmp.x - this.cam.x) * k;
        this.cam.y += (this.tmp.y - this.cam.y) * k;
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
      const ds = c.s - c.prevS;
      const dl = c.lat - c.prevLat;
      const { i } = locate(t, c.prevS + ds * this.alpha);
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
      if (detailed && !eco && c.errKind > 0 && c.errTimer > 0 && Math.random() < 0.5) this.puff(p.x, p.y, Math.abs(c.lat) > t.half ? 0xd8b98a : 0xdddddd);
    });
    this.carsLayer.sortableChildren = true;
    this.updatePuffs(dtMs);

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
      r.rect(0, 0, sw, sh).fill({ color: 0x1d3557, alpha: 0.16 });
      for (const d of this.rainDrops) {
        d.y += (dtMs / 1000) * d.v * 1.6;
        if (d.y > 1) d.y -= 1;
        const x = d.x * sw, y = d.y * sh;
        r.moveTo(x, y).lineTo(x - 4, y + 14);
      }
      r.stroke({ width: 1.2, color: 0xcfe3f5, alpha: 0.55 });
    }
  }

  private puff(x: number, y: number, color: number): void {
    if (!this.puffTex || this.puffs.length > 40) return;
    const g = new Sprite(this.puffTex);
    g.anchor.set(0.5);
    g.tint = color;
    g.position.set(x + (Math.random() - 0.5) * 2, y + (Math.random() - 0.5) * 2);
    g.scale.set(0.08);
    g.alpha = 0.7;
    this.fxLayer.addChild(g);
    this.puffs.push({ g, life: 1 });
  }

  private updatePuffs(dtMs: number): void {
    for (let k = this.puffs.length - 1; k >= 0; k--) {
      const p = this.puffs[k];
      p.life -= dtMs / 900;
      p.g.alpha = Math.max(0, p.life * 0.6);
      p.g.scale.set(0.08 + (1 - p.life) * 0.2);
      if (p.life <= 0) {
        p.g.destroy();
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
