// Vue cockpit : perspective pseudo-3D (Canvas 2D) depuis le baquet de la voiture suivie.
// Lecture seule de l'état du moteur, comme le rendu 2,5D : la piste réelle (tracé, largeur, stands) est projetée
// devant le pilote, les autres monoplaces sont dessinées de dos à leur vraie position.
import type { RaceSim, SimCar } from '../engine/race';
import { locate, worldPos, type Track } from '../engine/track';

const CAM_H = 0.95; // hauteur de l'œil (m)
const NEAR = 1.2;
const FAR = 320;

interface Sky { top: string; bottom: string; hills: string; hills2: string; grass: string; grass2: string; haze: string }

const SKIES: Record<string, Sky> = {
  port: { top: '#4f9bd9', bottom: '#cfe8f7', hills: '#7f93a8', hills2: '#5c728a', grass: '#c8c0ad', grass2: '#b9b09b', haze: '#d8e6ee' },
  foret: { top: '#5d9fd0', bottom: '#d9ecf2', hills: '#4f7a4a', hills2: '#2f5a34', grass: '#5c9a3c', grass2: '#4f8a33', haze: '#d4e4dc' },
  desert: { top: '#e9a15a', bottom: '#f8dcae', hills: '#c98a55', hills2: '#a9683c', grass: '#e2c48d', grass2: '#d4b47c', haze: '#f3dcb5' },
  lac: { top: '#4f94cf', bottom: '#d3e9f5', hills: '#6e8fa6', hills2: '#4d6e86', grass: '#69a646', grass2: '#5a963b', haze: '#dbe9ee' },
  montagne: { top: '#3f84c6', bottom: '#d5e8f4', hills: '#e9eef3', hills2: '#7d8a99', grass: '#7aa84e', grass2: '#6a9843', haze: '#e0ebf1' },
};

function hash(n: number): number {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

interface Pt { x: number; y: number; z: number }

export class CockpitView {
  private ctx: CanvasRenderingContext2D;
  private track: Track;
  private sky: Sky;
  private rearCache = new Map<string, HTMLCanvasElement>();
  private overlay: HTMLCanvasElement | null = null;
  private overlayKey = '';
  private w = 0;
  private h = 0;
  private dpr = 1;
  private tmp = { x: 0, y: 0 };
  private heading = NaN;
  private wheelAngle = 0;
  private drops: { x: number; y: number; r: number; life: number }[] = [];
  private tread = 0;

  constructor(private canvas: HTMLCanvasElement, private sim: RaceSim, private low: boolean) {
    this.ctx = canvas.getContext('2d')!;
    this.track = sim.track;
    const def = this.track.def;
    const base = SKIES[def.theme] ?? SKIES.foret;
    this.sky = def.night
      ? { ...base, top: '#05070f', bottom: '#1b2340', hills: '#0c1020', hills2: '#080b16', grass: '#1f2a1c', grass2: '#1a2418', haze: '#1b2340' }
      : def.sunset
        ? { ...base, top: '#3b2a5c', bottom: '#f39a4a', hills: '#7a4a3a', hills2: '#4e2d2a' }
        : base;
  }

  private resize(): void {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(this.low ? 1 : 1.5, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.w = w;
    this.h = h;
    this.dpr = dpr;
  }

  /** Dessine une image de la vue cockpit pour la voiture `carId`. `alpha` : interpolation entre deux pas. */
  draw(carId: string | null, alpha: number, dtMs: number): void {
    this.resize();
    const { ctx, w, h, track: t, sim } = this;
    const car = (carId && sim.car(carId)) || sim.cars.find((c) => c.e.isPlayer) || sim.cars[0];
    const s = car.prevS + (car.s - car.prevS) * alpha;
    const lat = car.prevLat + (car.lat - car.prevLat) * alpha;
    worldPos(t, s, lat, this.tmp);
    const px = this.tmp.x, py = this.tmp.y;
    // cap de la caméra : tangente lissée un peu devant (le pilote regarde vers la sortie du virage)
    const { i } = locate(t, s);
    const look = (i + 3) % t.n;
    let hd = Math.atan2(t.y[look] - py, t.x[look] - px);
    if (car.errKind === 3) hd += Math.sin(sim.t * 9) * 0.8; // tête-à-queue
    if (!Number.isFinite(this.heading)) this.heading = hd;
    let dh = hd - this.heading;
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    this.heading += dh * Math.min(1, dtMs / 70);
    const fx = Math.cos(this.heading), fy = Math.sin(this.heading);
    const rx = -fy, ry = fx; // vecteur droit (repère y vers le bas)
    const F = Math.max(w * 0.62, h * 0.5); // en portrait, champ de vision resserré pour garder une piste lisible
    const v = car.v;
    const shake = (this.low ? 0 : 1) * (Math.sin(sim.t * 47) * 0.6 + Math.sin(sim.t * 31) * 0.4) * Math.min(1, v / 60) * this.dpr * 1.6;
    const horizon = h * (h > w ? 0.36 : 0.4) + shake;
    const cx = w / 2;
    const proj = (wx: number, wy: number, height = 0): Pt => {
      const dx = wx - px, dy = wy - py;
      const z = dx * fx + dy * fy;
      const x = dx * rx + dy * ry;
      return { x: cx + (x * F) / Math.max(z, 0.01), y: horizon + ((CAM_H - height) * F) / Math.max(z, 0.01), z };
    };

    // ---- ciel et horizon
    const g = ctx.createLinearGradient(0, 0, 0, horizon);
    g.addColorStop(0, this.sky.top);
    g.addColorStop(1, this.sky.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, horizon + 2);
    if (t.def.night) {
      ctx.fillStyle = '#fff';
      for (let k = 0; k < 40; k++) {
        const sx = ((hash(k) * 6.283 - this.heading) / 6.283 % 1 + 1) % 1 * w * 3 - w;
        if (sx > 0 && sx < w) ctx.fillRect(sx, hash(k + 99) * horizon * 0.8, 1.5 * this.dpr, 1.5 * this.dpr);
      }
    } else if (!t.def.fog) {
      // nuages BD
      for (let k = 0; k < 6; k++) {
        const sx = ((((hash(k * 7) * 6.283 - this.heading * 0.6) / 6.283) % 1) + 1) % 1 * w * 2 - w * 0.5;
        const sy = horizon * (0.15 + hash(k * 13) * 0.45);
        const r = w * (0.05 + hash(k * 3) * 0.05);
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeStyle = 'rgba(22,19,15,0.35)';
        ctx.lineWidth = 2 * this.dpr;
        ctx.beginPath();
        ctx.ellipse(sx, sy, r * 1.6, r * 0.55, 0, 0, Math.PI * 2);
        ctx.ellipse(sx + r * 0.6, sy - r * 0.3, r * 0.8, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    if (t.def.sunset) {
      const sunX = ((((1.2 - this.heading) / 6.283) % 1) + 1) % 1 * w * 3 - w;
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(sunX, horizon - h * 0.04, h * 0.06, 0, Math.PI * 2);
      ctx.fill();
    }
    this.hills(horizon, this.heading, 0.35, this.sky.hills2, h * 0.13, 3);
    this.hills(horizon, this.heading, 0.6, this.sky.hills, h * 0.07, 11);

    // ---- sol
    ctx.fillStyle = this.sky.grass;
    ctx.fillRect(0, horizon, w, h - horizon);

    // ---- échantillons de piste devant la voiture
    const pts: { k: number; d: number }[] = [];
    let d = 0;
    let k = i;
    while (d < FAR) {
      pts.push({ k, d });
      const step = d < 50 ? 1 : d < 140 ? 2 : 4;
      k = (k + step) % t.n;
      d += step * t.ds;
    }
    const pitSide = t.def.pitSide;
    const pitLane = (kk: number) => {
      const ss = kk * t.ds;
      return ss >= t.pitEntry || ss <= t.pitExit;
    };
    const edge = (kk: number, l: number, height = 0) => proj(t.x[kk] + t.nx[kk] * l, t.y[kk] + t.ny[kk] * l, height);
    const quad = (a: Pt, b: Pt, c2: Pt, d2: Pt) => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(d2.x, d2.y);
      ctx.closePath();
      ctx.fill();
    };
    const half = t.half;
    // visible = jusqu'au premier point qui repasse derrière la caméra (épingle)
    let last = pts.length - 1;
    for (let n = 1; n < pts.length; n++) {
      const kk = pts[n].k;
      const zc = (t.x[kk] - px) * fx + (t.y[kk] - py) * fy;
      if (zc < NEAR && pts[n].d > 8) { last = n - 1; break; }
    }
    // du plus loin au plus proche
    for (let n = last; n > 0; n--) {
      const k0 = pts[n - 1].k, k1 = pts[n].k;
      const a0 = edge(k0, half + 14), a1 = edge(k1, half + 14);
      const b0 = edge(k0, -half - 14), b1 = edge(k1, -half - 14);
      if (a0.z < NEAR * 0.5 && b0.z < NEAR * 0.5) continue;
      const band = Math.floor((k1 * t.ds) / 12) % 2 === 0;
      // bandes d'herbe tondue (sensation de vitesse)
      ctx.fillStyle = band ? this.sky.grass : this.sky.grass2;
      quad(a0, a1, b1, b0);
      // vibreurs dans les virages, ligne blanche ailleurs
      const corner = t.corner[k1] > 0.25;
      const kerbW = corner ? 1.1 : 0.3;
      const kerbCol = corner ? (Math.floor((k1 * t.ds) / 4) % 2 ? '#d62828' : '#f4f1ea') : '#f4f1ea';
      ctx.fillStyle = kerbCol;
      quad(edge(k0, half + kerbW), edge(k1, half + kerbW), edge(k1, half - 0.15), edge(k0, half - 0.15));
      quad(edge(k0, -half - kerbW), edge(k1, -half - kerbW), edge(k1, -half + 0.15), edge(k0, -half + 0.15));
      // asphalte
      const shade = Math.floor((k1 * t.ds) / 8) % 2 === 0;
      const wet = sim.wet;
      ctx.fillStyle = t.def.night ? (shade ? '#2a2c33' : '#26282e') : wet > 0.3 ? (shade ? '#4b525c' : '#465058') : shade ? '#5d5f66' : '#585a61';
      quad(edge(k0, half - 0.15), edge(k1, half - 0.15), edge(k1, -half + 0.15), edge(k0, -half + 0.15));
      if (pitLane(k1) && pitLane(k0)) {
        const l1 = pitSide * (half + 1.2), l2 = t.pitLat + pitSide * 3.5;
        ctx.fillStyle = '#6a6c72';
        quad(edge(k0, l1), edge(k1, l1), edge(k1, l2), edge(k0, l2));
        ctx.fillStyle = '#f4f1ea';
        quad(edge(k0, l1), edge(k1, l1), edge(k1, l1 + pitSide * 0.25), edge(k0, l1 + pitSide * 0.25));
      }
      // ligne de départ / damier
      const sLine = k1 * t.ds;
      if (sLine < 3 && k1 > 0) {
        ctx.fillStyle = '#f4f1ea';
        quad(edge(k0, half), edge(k1, half), edge(k1, -half), edge(k0, -half));
      }
      // trajectoire gommée
      if (!t.def.night && wet < 0.3) {
        const lo = t.line[k1];
        ctx.fillStyle = 'rgba(20,20,24,0.16)';
        quad(edge(k0, lo + 1.1), edge(k1, lo + 1.1), edge(k1, lo - 1.1), edge(k0, lo - 1.1));
      }
      // encrage BD des bords de piste
      if (pts[n].d < 160) {
        ctx.strokeStyle = 'rgba(22,19,15,0.75)';
        ctx.lineWidth = Math.max(1, (1.6 * this.dpr * 30) / Math.max(30, pts[n].d));
        const e0 = edge(k0, half + kerbW), e1 = edge(k1, half + kerbW);
        const f0 = edge(k0, -half - kerbW), f1 = edge(k1, -half - kerbW);
        ctx.beginPath();
        ctx.moveTo(e0.x, e0.y);
        ctx.lineTo(e1.x, e1.y);
        ctx.moveTo(f0.x, f0.y);
        ctx.lineTo(f1.x, f1.y);
        ctx.stroke();
      }
    }

    // ---- décor : arbres / panneaux / tribunes et voitures, triés du plus loin au plus proche
    type Bill = { z: number; draw: () => void };
    const bills: Bill[] = [];
    for (let n = last; n > 0; n -= this.low ? 4 : 2) {
      const kk = pts[n].k;
      if (pts[n].d > 220) continue;
      const hsh = hash(kk);
      if (hsh > 0.5) continue;
      const side = hash(kk + 7) > 0.5 ? 1 : -1;
      if (pitLane(kk) && side === pitSide) {
        // garages et panneaux sur le muret des stands
        const p = edge(kk, t.pitLat + pitSide * 7, 0);
        if (p.z > NEAR) bills.push({ z: p.z, draw: () => this.box(p, F, 6, 4.5, '#e9e4d8', '#16130f') });
        continue;
      }
      const l = side * (half + 6 + hash(kk + 3) * 16);
      const p = edge(kk, l);
      if (p.z < NEAR) continue;
      const kind = hash(kk + 11);
      if (kind < 0.18) bills.push({ z: p.z, draw: () => this.banner(p, F, kk) });
      else bills.push({ z: p.z, draw: () => this.tree(p, F, kk) });
    }
    const drawCar = (c: SimCar | { s: number; prevS: number; lat: number; prevLat: number }, color: string, color2: string, num: string, key: string, isSc = false) => {
      const cs = c.prevS + (c.s - c.prevS) * alpha;
      const cl = c.prevLat + (c.lat - c.prevLat) * alpha;
      worldPos(t, cs, cl, this.tmp);
      const p = proj(this.tmp.x, this.tmp.y);
      if (p.z < 2.2 || p.z > 240) return;
      if (p.x < -w * 0.5 || p.x > w * 1.5) return;
      bills.push({ z: p.z, draw: () => this.carRear(p, F, color, color2, num, key, isSc, sim.wet) });
    };
    for (const c of sim.cars) {
      if (c === car || c.status === 'dnf') continue;
      drawCar(c, c.e.color, c.e.color2, String(c.e.number), c.e.teamId);
    }
    if (sim.sc) drawCar(sim.sc, '#f2c14e', '#16130f', 'SC', 'sc', true);
    bills.sort((a, b) => b.z - a.z);
    for (const b of bills) b.draw();

    // ---- brume (brouillard, lointain)
    const hz = ctx.createLinearGradient(0, horizon - h * 0.05, 0, horizon + h * 0.12);
    const fogA = t.def.fog ? 0.85 : t.def.night ? 0.3 : 0.45;
    hz.addColorStop(0, 'rgba(0,0,0,0)');
    hz.addColorStop(0.35, hexA(this.sky.haze, fogA));
    hz.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon - h * 0.05, w, h * 0.17);
    if (t.def.night) {
      // faisceau des phares / projecteurs sur la piste
      const lg = ctx.createRadialGradient(cx, h, h * 0.1, cx, h * 0.7, h * 0.7);
      lg.addColorStop(0, 'rgba(255,240,200,0.22)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(0, horizon, w, h - horizon);
    }

    // ---- traits de vitesse BD
    if (!this.low && v > 55) {
      const a = Math.min(0.35, (v - 55) / 60);
      ctx.strokeStyle = `rgba(255,255,255,${a})`;
      ctx.lineWidth = 2 * this.dpr;
      ctx.beginPath();
      for (let q = 0; q < 10; q++) {
        const ang = hash(q + Math.floor(sim.t * 8) * 13) * Math.PI * 2;
        const r0 = h * (0.35 + hash(q * 5) * 0.2);
        ctx.moveTo(cx + Math.cos(ang) * r0, horizon + Math.sin(ang) * r0 * 0.7);
        ctx.lineTo(cx + Math.cos(ang) * r0 * 1.5, horizon + Math.sin(ang) * r0 * 1.05);
      }
      ctx.stroke();
    }

    // ---- cockpit (nez, roues, halo, volant)
    const curv = t.curv[(i + 8) % t.n];
    this.wheelAngle += (Math.max(-1.2, Math.min(1.2, -curv * 55)) - this.wheelAngle) * Math.min(1, dtMs / 120);
    this.tread = (this.tread + (v * dtMs) / 1000) % 1.2;
    this.drawCockpit(car, shake);
    // ---- gouttes sur la visière
    if (sim.wet > 0.15 && sim.raining) {
      const n = this.low ? 1 : 3;
      for (let q = 0; q < n; q++) if (Math.random() < 0.5) this.drops.push({ x: Math.random() * w, y: Math.random() * h * 0.7, r: (2 + Math.random() * 5) * this.dpr, life: 1 });
    }
    if (this.drops.length) {
      ctx.fillStyle = 'rgba(220,235,255,0.35)';
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = this.dpr;
      for (const dr of this.drops) {
        dr.life -= dtMs / (v > 30 ? 500 : 1500);
        dr.x += ((dr.x - cx) / w) * v * 0.08 * this.dpr;
        dr.y -= v * 0.02 * this.dpr;
        ctx.beginPath();
        ctx.ellipse(dr.x, dr.y, dr.r, dr.r * (1 + v / 40), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      this.drops = this.drops.filter((dr) => dr.life > 0 && dr.y > -20).slice(-60);
    }
  }

  private hills(horizon: number, heading: number, par: number, color: string, amp: number, seed: number): void {
    const { ctx, w } = this;
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(22,19,15,0.45)';
    ctx.lineWidth = 2 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(0, horizon + 2);
    const N = 48;
    for (let q = 0; q <= N; q++) {
      const x = (q / N) * w;
      const ang = heading * par + (q / N - 0.5) * 1.6;
      const u = ang * 3;
      const hgt = amp * (0.55 + 0.3 * Math.sin(u + seed) + 0.15 * Math.sin(u * 2.7 + seed * 2) + (this.track.def.theme === 'montagne' ? 0.4 * Math.abs(Math.sin(u * 1.3 + seed)) : 0));
      ctx.lineTo(x, horizon - hgt);
    }
    ctx.lineTo(w, horizon + 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (this.track.def.theme === 'montagne' && seed === 3 && !this.track.def.night) {
      // neige sur les sommets lointains
      ctx.save();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(0, horizon - amp * 1.6, w, amp * 0.55);
      ctx.restore();
    }
  }

  private tree(p: Pt, F: number, k: number): void {
    const { ctx } = this;
    const theme = this.track.def.theme;
    const hgt = ((theme === 'desert' ? 3 : 7 + hash(k + 5) * 6) * F) / p.z;
    const wid = hgt * (theme === 'foret' || theme === 'montagne' ? 0.42 : 0.6);
    ctx.lineWidth = Math.max(1, (2 * F) / p.z / 6);
    ctx.strokeStyle = '#16130f';
    if (theme === 'desert') {
      // cactus
      ctx.fillStyle = '#4f8a4a';
      ctx.beginPath();
      ctx.roundRect(p.x - wid * 0.12, p.y - hgt, wid * 0.24, hgt, wid * 0.12);
      ctx.roundRect(p.x - wid * 0.45, p.y - hgt * 0.7, wid * 0.18, hgt * 0.35, wid * 0.09);
      ctx.fill();
      ctx.stroke();
      return;
    }
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(p.x - wid * 0.06, p.y - hgt * 0.35, wid * 0.12, hgt * 0.35);
    if (theme === 'port') {
      // palmier
      ctx.strokeStyle = '#5a8f3a';
      ctx.lineWidth = Math.max(1, wid * 0.12);
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - hgt);
      ctx.stroke();
      ctx.fillStyle = '#3f8a3a';
      for (let q = 0; q < 5; q++) {
        const a = -Math.PI / 2 + (q - 2) * 0.6;
        ctx.beginPath();
        ctx.ellipse(p.x + Math.cos(a) * wid * 0.45, p.y - hgt + Math.sin(a) * wid * 0.2 + wid * 0.1, wid * 0.45, wid * 0.12, a, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    }
    const night = this.track.def.night;
    ctx.fillStyle = night ? '#16301c' : hash(k + 9) > 0.5 ? '#2f7a3a' : '#3d8f45';
    ctx.strokeStyle = '#16130f';
    ctx.beginPath();
    if (theme === 'foret' || theme === 'montagne') {
      ctx.moveTo(p.x, p.y - hgt);
      ctx.lineTo(p.x + wid / 2, p.y - hgt * 0.22);
      ctx.lineTo(p.x - wid / 2, p.y - hgt * 0.22);
      ctx.closePath();
    } else {
      ctx.ellipse(p.x, p.y - hgt * 0.65, wid / 2, hgt * 0.38, 0, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  }

  private banner(p: Pt, F: number, k: number): void {
    const { ctx } = this;
    const wd = (8 * F) / p.z, hg = (1.6 * F) / p.z;
    const cols = ['#d62828', '#ffd400', '#3a86ff', '#2aa876', '#ff9f1c', '#16130f'];
    ctx.fillStyle = cols[Math.floor(hash(k + 21) * cols.length)];
    ctx.strokeStyle = '#16130f';
    ctx.lineWidth = Math.max(1, wd / 60);
    ctx.fillRect(p.x - wd / 2, p.y - hg * 1.4, wd, hg);
    ctx.strokeRect(p.x - wd / 2, p.y - hg * 1.4, wd, hg);
    if (wd > 40) {
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.round(hg * 0.7)}px Bangers, Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(['JLG', 'DYNASTY', 'HELIX', 'CORVANE', 'TURBO'][k % 5], p.x, p.y - hg * 0.9);
    }
  }

  private box(p: Pt, F: number, wM: number, hM: number, color: string, ink: string): void {
    const { ctx } = this;
    const wd = (wM * F) / p.z, hg = (hM * F) / p.z;
    ctx.fillStyle = color;
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(1, wd / 50);
    ctx.fillRect(p.x - wd / 2, p.y - hg, wd, hg);
    ctx.strokeRect(p.x - wd / 2, p.y - hg, wd, hg);
    ctx.fillStyle = '#2b2f38';
    ctx.fillRect(p.x - wd * 0.35, p.y - hg * 0.7, wd * 0.7, hg * 0.7);
  }

  /** Monoplace vue de dos, peinte une fois par couleur puis mise à l'échelle. */
  private rearSprite(color: string, color2: string, num: string, key: string): HTMLCanvasElement {
    const id = key + color + num;
    const hit = this.rearCache.get(id);
    if (hit) return hit;
    const W = 220, H = 120;
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    const g = cv.getContext('2d')!;
    g.lineJoin = 'round';
    g.strokeStyle = '#16130f';
    g.lineWidth = 5;
    // pneus arrière
    g.fillStyle = '#1d1d22';
    g.beginPath();
    g.roundRect(6, 46, 46, 70, 10);
    g.roundRect(W - 52, 46, 46, 70, 10);
    g.fill();
    g.stroke();
    g.fillStyle = '#3a3a42';
    g.fillRect(14, 52, 30, 6);
    g.fillRect(W - 44, 52, 30, 6);
    // carrosserie (moteur, diffuseur)
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(56, 108);
    g.lineTo(70, 46);
    g.lineTo(96, 30);
    g.lineTo(124, 30);
    g.lineTo(150, 46);
    g.lineTo(164, 108);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#26262c';
    g.fillRect(66, 92, 88, 18);
    g.strokeRect(66, 92, 88, 18);
    // aileron arrière
    g.fillStyle = color2;
    g.fillRect(30, 8, W - 60, 22);
    g.strokeRect(30, 8, W - 60, 22);
    g.fillStyle = color;
    g.fillRect(30, 4, 14, 44);
    g.fillRect(W - 44, 4, 14, 44);
    g.strokeRect(30, 4, 14, 44);
    g.strokeRect(W - 44, 4, 14, 44);
    // numéro
    g.fillStyle = '#fff';
    g.font = 'bold 26px Bangers, Impact, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.strokeStyle = '#16130f';
    g.lineWidth = 4;
    g.strokeText(num, W / 2, 62);
    g.fillText(num, W / 2, 62);
    this.rearCache.set(id, cv);
    return cv;
  }

  private carRear(p: Pt, F: number, color: string, color2: string, num: string, key: string, isSc: boolean, wet: number): void {
    const { ctx } = this;
    const wd = (2.0 * F) / p.z;
    const hg = wd * (isSc ? 0.75 : 0.55);
    // gerbe d'eau
    if (wet > 0.3) {
      ctx.fillStyle = `rgba(210,220,230,${Math.min(0.55, wet * 0.5)})`;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y - hg * 0.4, wd * 0.9, hg * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, wd * 0.55, wd * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
    if (isSc) {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#16130f';
      ctx.lineWidth = Math.max(1, wd / 40);
      ctx.beginPath();
      ctx.roundRect(p.x - wd / 2, p.y - hg, wd, hg, wd * 0.12);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(p.x - wd * 0.35, p.y - hg * 0.9, wd * 0.7, hg * 0.3);
      ctx.fillStyle = Math.floor(this.sim.t * 4) % 2 ? '#ff9f1c' : '#3a86ff';
      ctx.fillRect(p.x - wd * 0.3, p.y - hg * 1.08, wd * 0.6, hg * 0.12);
      return;
    }
    const sp = this.rearSprite(color, color2, num, key);
    ctx.drawImage(sp, p.x - wd / 2, p.y - hg, wd, hg);
    if (wet > 0.3 || this.track.def.night) {
      const on = Math.floor(this.sim.t * 4) % 2 === 0;
      if (on) {
        ctx.fillStyle = '#ff2a2a';
        ctx.fillRect(p.x - wd * 0.05, p.y - hg * 0.32, wd * 0.1, hg * 0.08);
      }
    }
  }

  private drawCockpit(car: SimCar, shake: number): void {
    const { ctx, w, h } = this;
    const key = `${w}x${h}|${car.e.color}|${car.e.color2}`;
    if (key !== this.overlayKey || !this.overlay) {
      this.overlay = this.paintOverlay(car.e.color, car.e.color2);
      this.overlayKey = key;
    }
    // roues avant (bande de roulement qui défile)
    const tw = w * 0.13, th = h * 0.3;
    for (const sx of [w * 0.08, w * 0.92 - tw]) {
      ctx.fillStyle = '#1d1d22';
      ctx.strokeStyle = '#16130f';
      ctx.lineWidth = 3 * this.dpr;
      ctx.beginPath();
      ctx.roundRect(sx, h - th * 0.75 + shake, tw, th, tw * 0.2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#3a3a42';
      ctx.lineWidth = 4 * this.dpr;
      ctx.beginPath();
      for (let q = 0; q < 4; q++) {
        const y = h - th * 0.75 + shake + ((q * 0.3 + this.tread) % 1.2) / 1.2 * th;
        ctx.moveTo(sx + tw * 0.1, y);
        ctx.lineTo(sx + tw * 0.9, y);
      }
      ctx.stroke();
    }
    ctx.drawImage(this.overlay, 0, shake * 0.4);
    // volant + écran
    const R = Math.min(w * 0.14, h * 0.24);
    const wx = w / 2, wy = h * 0.74 + R * 0.6 + shake * 0.3;
    ctx.save();
    ctx.translate(wx, wy);
    ctx.rotate(this.wheelAngle);
    ctx.fillStyle = '#22232a';
    ctx.strokeStyle = '#16130f';
    ctx.lineWidth = 4 * this.dpr;
    ctx.beginPath();
    ctx.moveTo(-R, -R * 0.2);
    ctx.lineTo(-R * 0.85, -R * 0.75);
    ctx.lineTo(-R * 0.35, -R * 0.95);
    ctx.lineTo(R * 0.35, -R * 0.95);
    ctx.lineTo(R * 0.85, -R * 0.75);
    ctx.lineTo(R, -R * 0.2);
    ctx.lineTo(R * 0.6, R * 0.1);
    ctx.lineTo(-R * 0.6, R * 0.1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // poignées
    ctx.fillStyle = '#3a3b44';
    ctx.fillRect(-R * 1.02, -R * 0.75, R * 0.22, R * 0.6);
    ctx.fillRect(R * 0.8, -R * 0.75, R * 0.22, R * 0.6);
    // écran
    ctx.fillStyle = '#0b1a12';
    ctx.fillRect(-R * 0.42, -R * 0.82, R * 0.84, R * 0.42);
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2 * this.dpr;
    ctx.strokeRect(-R * 0.42, -R * 0.82, R * 0.84, R * 0.42);
    const kmh = Math.round(car.v * 3.6);
    const gear = car.pit === 2 ? 'N' : String(Math.max(1, Math.min(8, Math.ceil(kmh / 42))));
    ctx.fillStyle = '#7dff9a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(R * 0.2)}px Bangers, Impact, sans-serif`;
    ctx.fillText(`${kmh}`, -R * 0.18, -R * 0.6);
    ctx.fillStyle = '#ffd400';
    ctx.font = `${Math.round(R * 0.28)}px Bangers, Impact, sans-serif`;
    ctx.fillText(gear, R * 0.24, -R * 0.6);
    ctx.font = `${Math.round(R * 0.09)}px sans-serif`;
    ctx.fillStyle = '#9fb';
    ctx.fillText('KM/H', -R * 0.18, -R * 0.45);
    // diodes de régime
    const rpm = (kmh % 42) / 42;
    for (let q = 0; q < 10; q++) {
      ctx.fillStyle = q / 10 < rpm ? (q < 4 ? '#2aa876' : q < 8 ? '#d62828' : '#3a86ff') : '#222';
      ctx.beginPath();
      ctx.arc(-R * 0.36 + q * R * 0.08, -R * 0.9, R * 0.025, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // feu arrière de la voiture suivie (non visible) → rien ; position et tour affichés par le HUD
  }

  private paintOverlay(color: string, color2: string): HTMLCanvasElement {
    const { w, h, dpr } = this;
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d')!;
    g.lineJoin = 'round';
    g.strokeStyle = '#16130f';
    // capot / nez qui file vers l'horizon
    g.fillStyle = color;
    g.lineWidth = 4 * dpr;
    g.beginPath();
    g.moveTo(w * 0.18, h);
    g.quadraticCurveTo(w * 0.4, h * 0.74, w * 0.475, h * 0.6);
    g.lineTo(w * 0.525, h * 0.6);
    g.quadraticCurveTo(w * 0.6, h * 0.74, w * 0.82, h);
    g.closePath();
    g.fill();
    g.stroke();
    // bande de livrée
    g.fillStyle = color2;
    g.beginPath();
    g.moveTo(w * 0.477, h * 0.61);
    g.lineTo(w * 0.523, h * 0.61);
    g.lineTo(w * 0.56, h);
    g.lineTo(w * 0.44, h);
    g.closePath();
    g.fill();
    // reflet
    g.fillStyle = 'rgba(255,255,255,0.22)';
    g.beginPath();
    g.moveTo(w * 0.3, h);
    g.quadraticCurveTo(w * 0.42, h * 0.82, w * 0.47, h * 0.7);
    g.lineTo(w * 0.465, h * 0.76);
    g.quadraticCurveTo(w * 0.42, h * 0.88, w * 0.36, h);
    g.closePath();
    g.fill();
    // bords du cockpit (baquet) en bas à gauche / droite
    g.fillStyle = '#1b1c22';
    g.beginPath();
    g.moveTo(0, h * 0.72);
    g.quadraticCurveTo(w * 0.12, h * 0.8, w * 0.22, h);
    g.lineTo(0, h);
    g.closePath();
    g.moveTo(w, h * 0.72);
    g.quadraticCurveTo(w * 0.88, h * 0.8, w * 0.78, h);
    g.lineTo(w, h);
    g.closePath();
    g.fill();
    g.stroke();
    // rétroviseurs
    for (const sx of [0.08, 0.92]) {
      const mw = Math.min(w * 0.07, h * 0.12), mh = mw * 0.45;
      g.fillStyle = color;
      g.beginPath();
      g.roundRect(w * sx - mw, h * 0.5 - mh, mw * 2, mh * 2, mh * 0.6);
      g.fill();
      g.stroke();
      const mg = g.createLinearGradient(0, h * 0.5 - mh, 0, h * 0.5 + mh);
      mg.addColorStop(0, '#8fb3d6');
      mg.addColorStop(0.55, '#c9d6e2');
      mg.addColorStop(0.56, '#6d6f75');
      mg.addColorStop(1, '#55575d');
      g.fillStyle = mg;
      g.beginPath();
      g.roundRect(w * sx - mw * 0.8, h * 0.5 - mh * 0.65, mw * 1.6, mh * 1.3, mh * 0.4);
      g.fill();
    }
    // halo : arceau supérieur + montant central
    g.fillStyle = '#1b1c22';
    g.lineWidth = 3 * dpr;
    g.beginPath();
    g.moveTo(w * 0.15, 0);
    g.quadraticCurveTo(w * 0.5, h * 0.2, w * 0.85, 0);
    g.lineTo(w * 0.85, -2);
    g.lineTo(w * 0.15, -2);
    g.closePath();
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(w * 0.488, h * 0.1);
    g.lineTo(w * 0.512, h * 0.1);
    g.lineTo(w * 0.52, h * 0.6);
    g.lineTo(w * 0.48, h * 0.6);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(w * 0.492, h * 0.12, w * 0.006, h * 0.5);
    // vignettage casque
    const vg = g.createRadialGradient(w / 2, h * 0.5, Math.min(w, h) * 0.45, w / 2, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    return cv;
  }
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
