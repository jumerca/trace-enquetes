import type { MatchEngine } from '../sim/engine';
import type { MPlayer } from '../sim/types';

/**
 * Rendu 2,5D sur Canvas 2D. La simulation est indépendante : le rendu lit l'état et l'illustre.
 * Projection oblique : x → horizontal, y → profondeur (raccourcie), z → hauteur.
 */
export const TILT = 0.56;
export const ZK = 0.92;

export const SKIN = ['#f3d2b3', '#e6b48f', '#c98e66', '#a06a45', '#7a4b2e', '#4f2f1d'];
export const HAIR = ['#1b1410', '#3b2617', '#6b4423', '#c49a55'];

export type CameraMode = 'full' | 'follow' | 'player';

export interface RenderOptions {
  camera: CameraMode;
  quality: 'low' | 'high';
  showOpen: boolean;
  colorblind: boolean;
  showNames?: boolean;
}

interface Popup {
  x: number;
  y: number;
  z: number;
  text: string;
  t: number;
  color: string;
}

export class MatchRenderer {
  ctx: CanvasRenderingContext2D;
  W = 0;
  H = 0;
  dpr = 1;
  s = 20; // pixels par mètre
  camX = 14;
  camY = 7.5;
  courtCache: HTMLCanvasElement | null = null;
  cacheKey = '';
  popups: Popup[] = [];
  lastEventCount = 0;
  opts: RenderOptions = { camera: 'full', quality: 'high', showOpen: true, colorblind: false };
  shake = 0;

  constructor(public canvas: HTMLCanvasElement, public e: MatchEngine) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D indisponible');
    this.ctx = ctx;
    this.camX = e.court.g.length / 2;
    this.camY = e.court.cy;
  }

  /** Qualité adaptative : réduit la résolution si les images prennent trop de temps. */
  frameAvg = 16;
  dprCap = 2;
  adapt(frameMs: number): void {
    this.frameAvg = this.frameAvg * 0.95 + frameMs * 0.05;
    if (this.frameAvg > 22 && this.dprCap > 1) {
      this.dprCap = Math.max(1, this.dprCap - 0.5);
      this.frameAvg = 16;
      this.resize(this.W, this.H);
    }
  }
  resize(w: number, h: number): void {
    const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.quality === 'high' ? (coarse ? Math.min(1.75, this.dprCap) : this.dprCap) : 1.25);
    this.W = w;
    this.H = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.cacheKey = '';
  }

  // Projection monde → écran (pixels CSS)
  px(x: number): number {
    return (x - this.camX) * this.s + this.W / 2;
  }
  py(y: number, z = 0): number {
    return (y - this.camY) * this.s * TILT + this.H * 0.54 - z * this.s * ZK;
  }

  updateCamera(dt: number): void {
    const g = this.e.court.g;
    const full = this.opts.camera === 'full';
    const sFull = Math.min(this.W / (g.length + 2.2), (this.H * 0.92) / (g.width * TILT + 4.6 * ZK));
    const target = full ? sFull : Math.max(sFull * 1.55, Math.min(this.W / 15, this.H / 7.5));
    this.s += (target - this.s) * Math.min(1, dt * 4);
    const b = this.e.ball;
    let tx = g.length / 2;
    if (!full) {
      const half = this.W / 2 / this.s;
      const me = this.e.userIdx >= 0 ? this.e.players[this.e.userIdx] : null;
      const focus = this.opts.camera === 'player' && me && me.onCourt ? me.pos.x * 0.7 + b.x * 0.3 : b.x;
      tx = Math.min(g.length + 1.2 - half, Math.max(-1.2 + half, focus));
      if (half * 2 > g.length + 2.4) tx = g.length / 2;
    }
    this.camX += (tx - this.camX) * Math.min(1, dt * 3.2);
    this.camY = g.width / 2 + (full ? 1.2 : 1.0);
  }

  // ------------------------------------------------------------------ Terrain
  buildCourt(): HTMLCanvasElement {
    const g = this.e.court.g;
    const key = `${this.s.toFixed(2)}|${this.W}|${this.H}|${this.dpr}`;
    if (this.courtCache && this.cacheKey === key) return this.courtCache;
    const pad = 3;
    const cw = Math.ceil((g.length + pad * 2) * this.s * this.dpr);
    const ch = Math.ceil((g.width + pad * 2) * this.s * TILT * this.dpr);
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    const x = c.getContext('2d')!;
    x.scale(this.dpr, this.dpr);
    const S = this.s;
    const X = (wx: number) => (wx + pad) * S;
    const Y = (wy: number) => (wy + pad) * S * TILT;
    // Abords
    x.fillStyle = '#0d1422';
    x.fillRect(0, 0, cw, ch);
    // Parquet
    const grd = x.createLinearGradient(0, Y(0), 0, Y(g.width));
    grd.addColorStop(0, '#c98d55');
    grd.addColorStop(1, '#dba46a');
    x.fillStyle = grd;
    x.fillRect(X(-1.2), Y(-1.2), (g.length + 2.4) * S, (g.width + 2.4) * S * TILT);
    // Lames
    x.globalAlpha = 0.09;
    for (let i = 0, yy = -1.2; yy < g.width + 1.2; yy += 0.18, i++) {
      x.fillStyle = i % 3 === 0 ? '#5a3418' : i % 2 ? '#fff3dd' : '#8a5a33';
      x.fillRect(X(-1.2), Y(yy), (g.length + 2.4) * S, Math.max(1, 0.06 * S * TILT));
    }
    x.globalAlpha = 1;
    // Raquettes et rond central peints
    const paint = '#1d3d6e';
    x.fillStyle = paint;
    for (const side of [1, -1] as const) {
      const bx = side === 1 ? g.length : 0;
      const x0 = side === 1 ? bx - g.ftLineFromBaseline : bx;
      x.fillRect(X(x0), Y(g.width / 2 - g.keyHalfWidth), g.ftLineFromBaseline * S, g.keyHalfWidth * 2 * S * TILT);
    }
    x.beginPath();
    x.ellipse(X(g.length / 2), Y(g.width / 2), g.centerRadius * S, g.centerRadius * S * TILT, 0, 0, Math.PI * 2);
    x.fill();
    // Logo central
    x.save();
    x.globalAlpha = 0.85;
    x.fillStyle = '#F36B32';
    x.beginPath();
    x.ellipse(X(g.length / 2), Y(g.width / 2), g.centerRadius * 0.55 * S, g.centerRadius * 0.55 * S * TILT, 0, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = '#101827';
    x.font = `800 ${Math.max(7, S * 0.42)}px Inter, system-ui, sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('BRS', X(g.length / 2), Y(g.width / 2));
    x.restore();
    // Lignes
    x.strokeStyle = 'rgba(255,255,255,0.92)';
    x.lineWidth = Math.max(1.2, 0.05 * S);
    x.strokeRect(X(0), Y(0), g.length * S, g.width * S * TILT);
    x.beginPath();
    x.moveTo(X(g.length / 2), Y(0));
    x.lineTo(X(g.length / 2), Y(g.width));
    x.stroke();
    x.beginPath();
    x.ellipse(X(g.length / 2), Y(g.width / 2), g.centerRadius * S, g.centerRadius * S * TILT, 0, 0, Math.PI * 2);
    x.stroke();
    for (const side of [1, -1] as const) {
      const bx = side === 1 ? g.length : 0;
      const hx = side === 1 ? g.length - g.hoopFromBaseline : g.hoopFromBaseline;
      const x0 = side === 1 ? bx - g.ftLineFromBaseline : bx;
      x.strokeRect(X(x0), Y(g.width / 2 - g.keyHalfWidth), g.ftLineFromBaseline * S, g.keyHalfWidth * 2 * S * TILT);
      // Cercle de lancer franc
      const fx = bx - side * g.ftLineFromBaseline;
      x.beginPath();
      x.ellipse(X(fx), Y(g.width / 2), g.ftRadius * S, g.ftRadius * S * TILT, 0, side === 1 ? Math.PI / 2 : -Math.PI / 2, side === 1 ? (Math.PI * 3) / 2 : Math.PI / 2);
      x.stroke();
      // Zone restrictive
      x.beginPath();
      x.ellipse(X(hx), Y(g.width / 2), g.restrictedRadius * S, g.restrictedRadius * S * TILT, 0, side === 1 ? Math.PI / 2 : -Math.PI / 2, side === 1 ? (Math.PI * 3) / 2 : Math.PI / 2);
      x.stroke();
      // Ligne à 3 points
      const corner = g.width / 2 - g.cornerThreeFromSideline;
      const depth = Math.sqrt(g.threeRadius ** 2 - corner ** 2);
      const a = Math.asin(corner / g.threeRadius);
      x.beginPath();
      x.moveTo(X(bx), Y(g.cornerThreeFromSideline));
      x.lineTo(X(hx - side * depth), Y(g.cornerThreeFromSideline));
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const t = -a + (2 * a * i) / steps;
        const px = hx - side * Math.cos(t) * g.threeRadius;
        const py = g.width / 2 + Math.sin(t) * g.threeRadius;
        x.lineTo(X(px), Y(py));
      }
      x.lineTo(X(bx), Y(g.width - g.cornerThreeFromSideline));
      x.stroke();
      // Marques de remise en jeu (ligne de remise FIBA à 8,325 m)
      const tl = bx - side * 8.325;
      x.beginPath();
      x.moveTo(X(tl), Y(g.width));
      x.lineTo(X(tl), Y(g.width + 0.3));
      x.stroke();
    }
    // Inscriptions publicitaires fictives sur les abords
    x.fillStyle = 'rgba(246,244,239,0.08)';
    x.font = `700 ${Math.max(8, S * 0.55)}px Inter, system-ui, sans-serif`;
    x.textAlign = 'center';
    x.fillText('BASKETBALL RISING STAR  ·  JLG CREATIVE', X(g.length / 2), Y(-1.9));
    this.courtCache = c;
    this.cacheKey = key;
    return c;
  }

  // ------------------------------------------------------------------ Image
  render(dt: number): void {
    const ctx = this.ctx;
    this.updateCamera(dt);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // Fond (gradins stylisés)
    const bg = ctx.createLinearGradient(0, 0, 0, this.H);
    bg.addColorStop(0, '#0a101c');
    bg.addColorStop(1, '#141f33');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.W, this.H);
    this.drawCrowd();
    const court = this.buildCourt();
    const pad = 3;
    ctx.drawImage(court, this.px(-pad), this.py(-pad), court.width / this.dpr, court.height / this.dpr);
    this.drawBenches();

    // Collecte des éléments à trier en profondeur
    type D = { y: number; draw: () => void };
    const list: D[] = [];
    const e = this.e;
    for (const p of e.players) if (p.onCourt) list.push({ y: p.pos.y, draw: () => this.drawPlayer(p) });
    list.push({ y: e.court.g.width + 1.3, draw: () => this.drawBenchPlayers() });
    for (const side of [1, -1] as const) {
      const h = e.court.hoop(side);
      list.push({ y: h.y - 0.3, draw: () => this.drawHoop(side, 'back') });
      list.push({ y: h.y + 0.25, draw: () => this.drawHoop(side, 'front') });
    }
    if (e.ball.state !== 'held' || true) list.push({ y: e.ball.y + 0.05, draw: () => this.drawBall() });
    // Ombres d'abord
    for (const p of e.players) this.drawShadow(p.pos.x, p.pos.y, 0.42 * (1 - Math.min(0.5, p.z / 2)), p.onCourt ? 0.28 : 0.12);
    this.drawShadow(e.ball.x, e.ball.y, 0.14, 0.35 * Math.max(0.2, 1 - e.ball.z / 6));
    if (this.opts.showOpen) this.drawMarkers();
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();
    this.drawPopups(dt);
  }

  drawCrowd(): void {
    const ctx = this.ctx;
    const top = this.py(-2.6);
    if (top <= 0) return;
    ctx.save();
    ctx.globalAlpha = 0.5;
    const rows = Math.min(8, Math.floor(top / 9));
    for (let r = 0; r < rows; r++) {
      const yy = top - r * 9 - 6;
      for (let i = 0; i < this.W / 8; i++) {
        const seed = (i * 73 + r * 131) % 97;
        ctx.fillStyle = seed % 7 === 0 ? '#F36B32' : seed % 5 === 0 ? '#3988F5' : seed % 3 === 0 ? '#2a3550' : '#1c263b';
        const bob = Math.sin(this.e.time * 3 + i + r) * (this.e.time - this.e.lastScoreT < 2 ? 1.6 : 0.3);
        ctx.fillRect(i * 8 + (r % 2) * 4, yy + bob, 5, 6);
      }
    }
    ctx.restore();
  }

  benchCache: { key: string; c: HTMLCanvasElement; x0: number; y0: number } | null = null;
  /** Joueurs sur le banc : immobiles, rendus une fois dans une image en cache. */
  drawBenchPlayers(): void {
    const e = this.e;
    const bench = e.players.filter((p) => !p.onCourt);
    if (!bench.length) return;
    const g = e.court.g;
    const key = `${this.s.toFixed(1)}|${this.dpr}|${bench.map((p) => p.idx).join(',')}`;
    const x0 = g.length / 2 - 12;
    const wM = 24;
    const S = this.s;
    const topM = 3.2; // mètres au-dessus du sol du banc (têtes)
    if (!this.benchCache || this.benchCache.key !== key) {
      const c = document.createElement('canvas');
      const wPx = Math.ceil(wM * S);
      const hPx = Math.ceil(topM * S * ZK + 1.2 * S);
      c.width = wPx * this.dpr;
      c.height = hPx * this.dpr;
      const saved = { ctx: this.ctx, camX: this.camX, camY: this.camY, W: this.W, H: this.H };
      const cx = c.getContext('2d')!;
      cx.scale(this.dpr, this.dpr);
      this.ctx = cx;
      this.W = wPx;
      this.H = hPx;
      this.camX = x0 + wPx / 2 / S;
      const yB = g.width + 1.3;
      // py(yB) = (yB - camY)*S*TILT + H*0.54 = hPx - 0.6*S
      this.camY = yB - (hPx - 0.6 * S - hPx * 0.54) / (S * TILT);
      for (const p of bench.sort((a, b) => a.pos.y - b.pos.y)) this.drawPlayer(p, true);
      this.benchCache = { key, c, x0, y0: this.camY };
      Object.assign(this, saved);
      this.benchCache.y0 = yB;
    }
    const bc = this.benchCache;
    const wPx = bc.c.width / this.dpr;
    const hPx = bc.c.height / this.dpr;
    this.ctx.drawImage(bc.c, this.px(bc.x0), this.py(bc.y0) - (hPx - 0.6 * S), wPx, hPx);
  }

  drawBenches(): void {
    const ctx = this.ctx;
    const g = this.e.court.g;
    const y = g.width + 1.0;
    for (const t of [0, 1] as const) {
      const x0 = t === 0 ? g.length / 2 - 8.5 : g.length / 2 + 1.5;
      ctx.fillStyle = 'rgba(16,24,39,0.85)';
      ctx.fillRect(this.px(x0), this.py(y + 0.3) - 6, 7 * this.s, Math.max(4, 0.5 * this.s * TILT));
      ctx.fillStyle = this.e.teams[t].colors[0];
      ctx.fillRect(this.px(x0), this.py(y + 0.3) - 7, 7 * this.s, 2);
    }
  }

  drawShadow(x: number, y: number, r: number, a: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.beginPath();
    ctx.ellipse(this.px(x), this.py(y), r * this.s, r * this.s * TILT * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  drawMarkers(): void {
    const e = this.e;
    const ctx = this.ctx;
    const u = e.userIdx >= 0 ? e.players[e.userIdx] : null;
    const h = e.holder();
    // Anneau du joueur contrôlé
    if (u && u.onCourt) {
      ctx.strokeStyle = '#DDB65A';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(this.px(u.pos.x), this.py(u.pos.y), 0.55 * this.s, 0.55 * this.s * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Direction vers le panier attaqué
    }
    if (h) {
      ctx.strokeStyle = 'rgba(243,107,50,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(this.px(h.pos.x), this.py(h.pos.y), 0.45 * this.s, 0.45 * this.s * TILT, 0, 0, Math.PI * 2);
      ctx.stroke();
      // Partenaires démarqués (aide à la lecture, désactivable)
      if (u && u.team === h.team) {
        for (const m of e.teamOnCourt(h.team)) {
          if (m === h) continue;
          const open = e.nearestDefender(m).d;
          if (open > 2.2) {
            ctx.fillStyle = this.opts.colorblind ? 'rgba(57,136,245,0.6)' : 'rgba(40,183,139,0.55)';
            ctx.beginPath();
            ctx.ellipse(this.px(m.pos.x), this.py(m.pos.y), 0.38 * this.s, 0.38 * this.s * TILT, 0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }

  // ------------------------------------------------------------------ Joueurs
  drawPlayer(p: MPlayer, bench = false): void {
    const ctx = this.ctx;
    const e = this.e;
    const S = this.s;
    const H = p.heightM;
    const K = S * ZK; // pixels par mètre (vertical)
    const fx = this.px(p.pos.x);
    const fy = this.py(p.pos.y, p.z);
    const anim = bench ? 'bench' : p.anim;
    const t = p.animT;
    const sp = Math.hypot(p.vel.x, p.vel.y);
    const fsx = Math.cos(p.facing);
    const fsy = Math.sin(p.facing) * TILT;
    const side = fsx >= 0 ? 1 : -1;
    const front = Math.sin(p.facing) > -0.25; // on voit la face avant
    const run = Math.min(1, sp / 6.5);
    const phase = p.stride;
    const [jersey, trim] = this.kit(p.team);
    const skin = SKIN[p.data.appearance.skin] ?? SKIN[2];
    const skinD = shade(skin, -0.22);
    const skinL = shade(skin, 0.12);
    const shortsC = shade(jersey, jersey === '#F2F0EA' ? -0.08 : -0.12);
    const line = 'rgba(10,14,24,0.55)';
    const lw = Math.max(0.8, 0.014 * S);
    const bulk = Math.max(0.85, Math.min(1.25, p.data.weightKg / (H * H * 23.5)));
    const crouch = anim === 'stance' ? 0.1 : anim === 'screen' ? 0.04 : anim === 'dribble' ? 0.06 : anim === 'rebound' && p.z === 0 ? 0.08 : bench ? 0.36 : 0;
    const hipY = fy - H * (0.52 - crouch) * K;
    const shY = fy - H * (0.8 - crouch * 0.85) * K;
    const lean = (anim === 'run' ? run * 0.1 : 0) * side * S + (anim === 'dribble' ? side * 0.04 * S : 0);
    const hipX = fx;
    const shX = fx + lean;
    const shW = (0.25 + (bulk - 1) * 0.09) * S; // demi-largeur d'épaules
    const hipW = (0.16 + (bulk - 1) * 0.05) * S;
    const thigh = H * 0.255 * K;
    const shin = H * 0.255 * K;

    // ---- Jambes (cinématique inverse à deux segments, genoux vers l'avant)
    const legs: { hx: number; hy: number; fx: number; fy: number; back: boolean }[] = [];
    for (const k of [0, 1]) {
      const ph = phase + k * Math.PI;
      let ox = sp > 0.25 ? Math.sin(ph) * (0.2 + run * 0.32) * S : 0;
      let lift = sp > 0.25 ? Math.max(0, Math.cos(ph)) * run * 0.2 * K : 0;
      if (anim === 'stance' || anim === 'screen') {
        ox = (k ? -1 : 1) * 0.2 * S;
        lift = 0;
      }
      if (p.z > 0.05) {
        ox = (k ? -0.06 : 0.14) * S;
        lift = (k ? 0.22 : 0.1) * K;
      }
      if (bench) ox = (k ? 0.18 : 0.26) * S;
      const spread = (k ? -1 : 1) * hipW * 0.45;
      legs.push({ hx: hipX + spread * (front ? 1 : -1) * 0.6, hy: hipY, fx: fx + ox * fsx + spread * 0.5 - ox * 0.0, fy: fy - lift + ox * fsy * 0.5, back: k === 1 });
    }
    /** Articulation intermédiaire : des deux solutions, celle dont le coude/genou part dans la direction voulue (prefX). */
    const knee = (hx: number, hy: number, tx: number, ty: number, l1: number, l2: number, prefX: number) => {
      const dx = tx - hx;
      const dy = ty - hy;
      const d = Math.max(1e-3, Math.min(Math.hypot(dx, dy), l1 + l2 - 0.01));
      const a = Math.atan2(dy, dx);
      const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
      const off = Math.acos(Math.max(-1, Math.min(1, cosA)));
      const c1 = { x: hx + Math.cos(a - off) * l1, y: hy + Math.sin(a - off) * l1 };
      const c2 = { x: hx + Math.cos(a + off) * l1, y: hy + Math.sin(a + off) * l1 };
      return (c1.x - hx) * prefX >= (c2.x - hx) * prefX ? c1 : c2;
    };
    const drawLeg = (L: (typeof legs)[number]) => {
      const kn = knee(L.hx, L.hy, L.fx, L.fy - 0.05 * K, thigh, shin, side);
      const dim = L.back ? -0.12 : 0;
      limb(ctx, L.hx, L.hy, kn.x, kn.y, 0.1 * S * bulk, 0.068 * S * bulk, shade(skin, dim), line, lw, shade(skinL, dim));
      limb(ctx, kn.x, kn.y, L.fx, L.fy - 0.07 * K, 0.07 * S * bulk, 0.045 * S, shade(skin, dim), line, lw, shade(skinL, dim));
      // Chaussette
      limb(ctx, L.fx + (kn.x - L.fx) * 0.28, L.fy - 0.07 * K + (kn.y - L.fy) * 0.28, L.fx, L.fy - 0.06 * K, 0.044 * S, 0.042 * S, shade('#F6F4EF', dim), line, lw * 0.6);
      // Chaussure (semelle blanche, empeigne aux couleurs de l'équipe)
      const len = 0.17 * S * Math.max(0.35, Math.abs(fsx));
      ctx.fillStyle = shade(trim === '#F6F4EF' ? '#1b2333' : trim, dim);
      ctx.strokeStyle = line;
      ctx.lineWidth = lw;
      ctx.beginPath();
      ctx.ellipse(L.fx + side * len * 0.35, L.fy - 0.045 * K, len, 0.055 * S, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#F6F4EF';
      ctx.fillRect(L.fx + side * len * 0.35 - len, L.fy - 0.03 * K, len * 2, Math.max(1.2, 0.022 * S));
    };

    // ---- Bras (positions des mains selon l'action)
    const hand = (dx: number, dz: number): [number, number] => [shX + dx * S, shY - dz * K];
    const swing = Math.sin(phase) * 0.24 * run;
    let hands: [[number, number], [number, number]];
    switch (anim) {
      case 'dribble': {
        const bsx = this.px(e.ball.x);
        const bsy = this.py(e.ball.y, e.ball.z);
        const near = Math.hypot(bsx - shX, bsy - shY) < 1.6 * S;
        hands = [near ? [bsx, Math.min(bsy - 0.08 * S, shY + H * 0.3 * K)] : hand(side * 0.3, -0.5), hand(-side * 0.28, -0.3)];
        break;
      }
      case 'shoot':
      case 'jumpball':
        hands = [hand(side * 0.06, 0.62 + Math.min(1, t * 2) * 0.22), hand(side * 0.16, 0.5 + Math.min(1, t * 2) * 0.18)];
        break;
      case 'layup':
        hands = [hand(side * 0.18, 0.6 + Math.min(1, t * 2) * 0.28), hand(-side * 0.18, 0.05)];
        break;
      case 'dunk':
        hands = [hand(side * 0.22, 0.78 - Math.max(0, t - 0.35) * 2), hand(side * 0.12, 0.72 - Math.max(0, t - 0.35) * 2)];
        break;
      case 'block':
      case 'rebound':
        hands = [hand(side * 0.14, 0.76), hand(-side * 0.06, 0.74)];
        break;
      case 'pass':
        hands = [hand(side * 0.44, 0.04), hand(side * 0.4, -0.02)];
        break;
      case 'catch':
        hands = [hand(side * 0.32, 0.04), hand(side * 0.26, -0.02)];
        break;
      case 'stance':
        hands = [hand(0.44, -0.12 + Math.sin(e.time * 6 + p.idx) * 0.04), hand(-0.44, -0.12)];
        break;
      case 'screen':
        hands = [hand(0.1, -0.2), hand(-0.1, -0.22)];
        break;
      case 'celebrate':
        hands = [hand(side * 0.16, 0.72 + Math.sin(t * 14) * 0.05), hand(-side * 0.32, -0.22)];
        break;
      case 'stumble':
        hands = [hand(side * 0.36, 0.2), hand(-side * 0.42, 0.1)];
        break;
      case 'bench':
        hands = [hand(0.16, -0.36), hand(-0.12, -0.38)];
        break;
      default:
        hands = [hand(0.27 + side * swing, -0.5), hand(-0.27 + side * swing, -0.5)];
    }
    const upper = H * 0.17 * K;
    const fore = H * 0.16 * K;
    const drawArm = (i: number) => {
      const sx = shX + (i === 0 ? 1 : -1) * shW * 0.82;
      const sy = shY + 0.05 * S;
      const [hx2, hy2] = hands[i];
      const el = knee(sx, sy, hx2, hy2, upper, fore, (i === 0 ? 1 : -1) * (anim === 'dribble' && i === 0 ? side : 1));
      const dim = i === 1 ? -0.1 : 0;
      const armC = p.data.appearance.sleeve && i === 0 ? trim : shade(skin, dim);
      limb(ctx, sx, sy, el.x, el.y, 0.068 * S * bulk, 0.05 * S * bulk, armC, line, lw, p.data.appearance.sleeve && i === 0 ? undefined : shade(skinL, dim));
      limb(ctx, el.x, el.y, hx2, hy2, 0.05 * S * bulk, 0.038 * S, shade(skin, dim), line, lw, shade(skinL, dim));
      ctx.fillStyle = shade(skin, dim - 0.04);
      ctx.beginPath();
      ctx.arc(hx2, hy2, 0.045 * S, 0, Math.PI * 2);
      ctx.fill();
    };

    // Ordre : membres arrière, tronc, membres avant
    const backLeg = legs.find((l) => l.back)!;
    const frontLeg = legs.find((l) => !l.back)!;
    drawLeg(backLeg);
    drawArm(1);
    drawLeg(frontLeg);

    // ---- Short (large, avec bande latérale)
    const shortTop = hipY - 0.07 * K;
    const shortBot = hipY + H * 0.14 * K;
    ctx.fillStyle = shortsC;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(hipX - hipW * 1.05, shortTop);
    ctx.lineTo(hipX + hipW * 1.05, shortTop);
    ctx.lineTo(hipX + hipW * 1.25 + side * 0.03 * S, shortBot);
    ctx.lineTo(hipX + 0.02 * S, shortBot - 0.02 * K);
    ctx.lineTo(hipX - 0.02 * S, shortBot - 0.02 * K);
    ctx.lineTo(hipX - hipW * 1.25 + side * 0.03 * S, shortBot);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = trim;
    ctx.fillRect(hipX + side * hipW * 1.0 - 0.015 * S, shortTop, 0.03 * S, shortBot - shortTop);

    // ---- Cou et maillot (débardeur)
    ctx.fillStyle = skinD;
    ctx.fillRect(shX - 0.045 * S, shY - 0.1 * K, 0.09 * S, 0.12 * K);
    ctx.fillStyle = jersey;
    ctx.beginPath();
    ctx.moveTo(hipX - hipW * 1.0, hipY);
    ctx.quadraticCurveTo(shX - shW * 0.95, (hipY + shY) / 2, shX - shW * 0.72, shY + 0.13 * K); // emmanchure
    ctx.quadraticCurveTo(shX - shW * 0.55, shY + 0.02 * K, shX - shW * 0.38, shY - 0.02 * K);
    ctx.quadraticCurveTo(shX, shY + (front ? 0.1 : 0.03) * K, shX + shW * 0.38, shY - 0.02 * K); // encolure
    ctx.quadraticCurveTo(shX + shW * 0.55, shY + 0.02 * K, shX + shW * 0.72, shY + 0.13 * K);
    ctx.quadraticCurveTo(shX + shW * 0.95, (hipY + shY) / 2, hipX + hipW * 1.0, hipY);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = line;
    ctx.stroke();
    // Liserés d'encolure et d'emmanchures
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, 0.022 * S);
    ctx.beginPath();
    ctx.moveTo(shX - shW * 0.38, shY - 0.01 * K);
    ctx.quadraticCurveTo(shX, shY + (front ? 0.1 : 0.03) * K, shX + shW * 0.38, shY - 0.01 * K);
    ctx.stroke();
    // Numéro
    if (S > 12) {
      const ny = shY + (hipY - shY) * (front ? 0.52 : 0.42);
      const spr = textSprite(String(p.data.number), 0.2 * S, 800, "'Barlow Condensed', Inter, sans-serif", trim, shade(jersey, -0.35), null, this.dpr);
      ctx.drawImage(spr, shX - spr.width / this.dpr / 2, ny - spr.height / this.dpr / 2, spr.width / this.dpr, spr.height / this.dpr);
      // Ombre portée du côté opposé à la lumière
      ctx.fillStyle = 'rgba(10,14,24,0.16)';
      ctx.fillRect(side > 0 ? shX - shW * 0.85 : shX + shW * 0.35, shY + 0.14 * K, shW * 0.5, hipY - shY - 0.14 * K);
    }
    drawArm(0);

    // ---- Tête
    const hr = 0.105 * S;
    const hx = shX + side * 0.015 * S;
    const hy = shY - 0.1 * K - hr * 1.05;
    ctx.fillStyle = skin;
    ctx.strokeStyle = line;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr * 0.9, hr * 1.08, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Modelé du visage : reflet côté lumière, ombre côté opposé
    ctx.fillStyle = skinD;
    ctx.beginPath();
    ctx.ellipse(hx + side * hr * 0.32, hy + hr * 0.15, hr * 0.5, hr * 0.85, 0, 0, Math.PI * 2);
    ctx.globalAlpha = 0.45;
    ctx.fill();
    ctx.fillStyle = skinL;
    ctx.beginPath();
    ctx.ellipse(hx - side * hr * 0.3, hy - hr * 0.35, hr * 0.32, hr * 0.38, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // Oreille
    if (Math.abs(fsx) > 0.3) {
      ctx.fillStyle = skinD;
      ctx.beginPath();
      ctx.ellipse(hx - side * hr * 0.55, hy + hr * 0.05, hr * 0.17, hr * 0.26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    drawHair(ctx, hx, hy, hr, p, side);
    if (front && S > 16) {
      // Yeux et sourcils orientés vers le regard
      const ex = hx + fsx * hr * 0.35;
      ctx.fillStyle = '#101827';
      for (const s2 of [-1, 1]) {
        if (Math.abs(fsx) > 0.75 && s2 === -side) continue;
        ctx.beginPath();
        ctx.ellipse(ex + s2 * hr * 0.3, hy - hr * 0.05, hr * 0.09, hr * 0.12, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = shade(skin, -0.45);
      ctx.lineWidth = Math.max(0.8, hr * 0.1);
      ctx.beginPath();
      ctx.moveTo(ex - hr * 0.15, hy + hr * 0.45);
      ctx.quadraticCurveTo(ex, hy + hr * (anim === 'celebrate' ? 0.62 : 0.52), ex + hr * 0.15, hy + hr * 0.45);
      ctx.stroke();
    }
    if (p.data.appearance.headband) {
      ctx.fillStyle = trim;
      ctx.fillRect(hx - hr * 0.92, hy - hr * 0.45, hr * 1.84, hr * 0.28);
    }
    // Nom sous les pieds (lisibilité), en caméra rapprochée
    if (this.opts.showNames && !bench && S > 24) {
      const spr = textSprite(`${p.data.number} ${p.data.lastName}`, Math.max(9, 0.15 * S), 700, 'Inter, system-ui, sans-serif', p.isUser ? '#DDB65A' : '#F6F4EF', null, 'rgba(16,24,39,0.62)', this.dpr);
      ctx.drawImage(spr, fx - spr.width / this.dpr / 2, this.py(p.pos.y) + 0.12 * S, spr.width / this.dpr, spr.height / this.dpr);
    }
    // Repère du joueur incarné
    if (p.isUser && !bench) {
      ctx.fillStyle = '#DDB65A';
      ctx.font = `800 ${Math.max(11, 0.24 * S)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('▼', hx, hy - hr * 1.5);
    }
  }

  /** Tenues : domicile en clair, extérieur en couleur (contraste garanti). */
  kit(team: 0 | 1): [string, string] {
    const c = this.e.teams[team].colors;
    const light = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114 > 170;
    };
    if (team === 0) return light(c[0]) ? [c[0], c[1]] : ['#F2F0EA', c[0]];
    return light(c[0]) ? [light(c[1]) ? '#1B2333' : c[1], c[0]] : [c[0], c[1]];
  }

  // ------------------------------------------------------------------ Panier
  drawHoop(side: 1 | -1, part: 'back' | 'front'): void {
    const ctx = this.ctx;
    const g = this.e.court.g;
    const h = this.e.court.hoop(side);
    const S = this.s;
    const bx = this.e.court.boardX(side);
    if (part === 'back') {
      // Poteau et bras
      const baseX = side === 1 ? g.length + 1.0 : -1.0;
      ctx.strokeStyle = '#2b3446';
      ctx.lineWidth = Math.max(3, 0.16 * S);
      ctx.beginPath();
      ctx.moveTo(this.px(baseX), this.py(h.y, 0));
      ctx.lineTo(this.px(baseX), this.py(h.y, 3.4));
      ctx.lineTo(this.px(bx + side * 0.1), this.py(h.y, 3.4));
      ctx.stroke();
      ctx.fillStyle = '#1b2333';
      ctx.fillRect(this.px(baseX) - 0.35 * S, this.py(h.y, 0) - 0.3 * S, 0.7 * S, 0.3 * S);
      // Planche (vue de biais : épaisseur + face)
      const top = this.py(h.y - g.boardHalfWidth, g.boardTop);
      const bot = this.py(h.y + g.boardHalfWidth, g.boardBottom);
      const w = Math.max(3, 0.14 * S);
      ctx.fillStyle = 'rgba(220,235,255,0.55)';
      ctx.fillRect(this.px(bx) - w / 2, top, w, bot - top);
      ctx.strokeStyle = '#f6f4ef';
      ctx.lineWidth = Math.max(1.5, 0.04 * S);
      ctx.strokeRect(this.px(bx) - w / 2, top, w, bot - top);
      // Carré de visée
      ctx.strokeStyle = '#F36B32';
      ctx.strokeRect(this.px(bx) - w / 2, this.py(h.y - 0.3, 3.5), w, this.py(h.y + 0.3, 3.05) - this.py(h.y - 0.3, 3.5));
      // Arrière de l'anneau
      ctx.strokeStyle = '#e8572a';
      ctx.lineWidth = Math.max(2, 0.05 * S);
      ctx.beginPath();
      ctx.ellipse(this.px(h.x), this.py(h.y, g.rimHeight), g.rimRadius * S, g.rimRadius * S * TILT, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      return;
    }
    // Filet animé
    const swish = this.e.netSwish[side === 1 ? 1 : 0];
    const rx = g.rimRadius * S;
    const cx = this.px(h.x);
    const cy = this.py(h.y, g.rimHeight);
    const depth = 0.42 * S * ZK * (1 + swish * 0.4);
    ctx.strokeStyle = 'rgba(246,244,239,0.85)';
    ctx.lineWidth = Math.max(1, 0.018 * S);
    const n = 8;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI * (i / n);
      const topX = cx + Math.cos(a) * rx;
      const topY = cy + Math.sin(a) * rx * TILT;
      const wob = Math.sin(this.e.time * 30 + i) * swish * 0.05 * S;
      const botX = cx + Math.cos(a) * rx * 0.55 + wob;
      const botY = cy + depth + Math.sin(a) * rx * TILT * 0.5;
      ctx.beginPath();
      ctx.moveTo(topX, topY);
      ctx.lineTo(botX, botY);
      ctx.stroke();
    }
    for (let r = 1; r <= 2; r++) {
      const k = r / 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy + depth * k, rx * (1 - k * 0.45), rx * TILT * (1 - k * 0.45), 0, 0, Math.PI);
      ctx.stroke();
    }
    // Avant de l'anneau
    ctx.strokeStyle = '#F36B32';
    ctx.lineWidth = Math.max(2, 0.055 * S);
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, rx * TILT, 0, 0, Math.PI);
    ctx.stroke();
  }

  drawBall(): void {
    const e = this.e;
    const b = e.ball;
    if (b.state === 'dead' && e.phase === 'quarterEnd') return;
    const ctx = this.ctx;
    const r = Math.max(4, 0.15 * this.s);
    const x = this.px(b.x);
    const y = this.py(b.y, b.z);
    // Traînée pour les tirs
    if (b.state === 'air' && b.flight && (b.flight.kind === 'shot' || b.flight.kind === 'ft')) {
      ctx.strokeStyle = 'rgba(243,107,50,0.25)';
      ctx.lineWidth = r * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - b.vx * this.s * 0.05, y - (b.vy * TILT - b.vz * ZK) * this.s * 0.05);
      ctx.stroke();
    }
    const grd = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.2, x, y, r);
    grd.addColorStop(0, '#ff9a5c');
    grd.addColorStop(1, '#c84b16');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,15,5,0.75)';
    ctx.lineWidth = Math.max(0.8, r * 0.12);
    const rot = b.spin;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(rot) * r, y + Math.sin(rot) * r);
    ctx.lineTo(x - Math.cos(rot) * r, y - Math.sin(rot) * r);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.45, r, rot, 0, Math.PI * 2);
    ctx.stroke();
  }

  // ------------------------------------------------------------------ Effets
  pushPopup(text: string, x: number, y: number, z: number, color: string): void {
    this.popups.push({ text, x, y, z, t: 0, color });
  }

  drawPopups(dt: number): void {
    const e = this.e;
    for (let i = this.lastEventCount; i < e.events.length; i++) {
      const ev = e.events[i];
      if (ev.type === 'made' && ev.player >= 0) {
        const p = e.players[ev.player];
        this.pushPopup(`+${ev.points}`, p.pos.x, p.pos.y, p.heightM + 0.6, ev.points === 3 ? '#DDB65A' : '#F6F4EF');
      } else if (ev.type === 'block') this.pushPopup('CONTRE !', e.ball.x, e.ball.y, 3.6, '#3988F5');
      else if (ev.type === 'steal' && ev.player >= 0) {
        const p = e.players[ev.player];
        this.pushPopup('INTERCEPTION', p.pos.x, p.pos.y, p.heightM + 0.6, '#28B78B');
      }
    }
    this.lastEventCount = e.events.length;
    const ctx = this.ctx;
    this.popups = this.popups.filter((p) => p.t < 1.4);
    for (const p of this.popups) {
      p.t += dt;
      const a = Math.min(1, 1.6 - p.t);
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.font = `900 ${Math.max(14, 0.42 * this.s)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(16,24,39,0.8)';
      ctx.lineWidth = 3;
      const sy = this.py(p.y, p.z + p.t * 0.8);
      ctx.strokeText(p.text, this.px(p.x), sy);
      ctx.fillText(p.text, this.px(p.x), sy);
      ctx.globalAlpha = 1;
    }
  }

  /** Convertit un point écran (CSS px) en position au sol. */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: (sx - this.W / 2) / this.s + this.camX, y: (sy - this.H * 0.54) / (this.s * TILT) + this.camY };
  }
}

/** Textes pré-rendus (le rendu de texte sur Canvas est coûteux). */
const textCache = new Map<string, HTMLCanvasElement>();
function textSprite(text: string, px: number, weight: number, family: string, fill: string, stroke: string | null, bg: string | null, dpr: number): HTMLCanvasElement {
  const size = Math.max(6, Math.round(px));
  const key = `${text}|${size}|${weight}|${family}|${fill}|${stroke}|${bg}|${dpr}`;
  const hit = textCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  const x = c.getContext('2d')!;
  const font = `${weight} ${size}px ${family}`;
  x.font = font;
  const w = Math.ceil(x.measureText(text).width) + (bg ? 8 : 4);
  const h = Math.ceil(size * 1.3) + 2;
  c.width = w * dpr;
  c.height = h * dpr;
  x.scale(dpr, dpr);
  if (bg) {
    x.fillStyle = bg;
    x.fillRect(0, 0, w, h);
  }
  x.font = font;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (stroke) {
    x.strokeStyle = stroke;
    x.lineWidth = Math.max(1, size * 0.1);
    x.strokeText(text, w / 2, h / 2);
  }
  x.fillStyle = fill;
  x.fillText(text, w / 2, h / 2);
  if (textCache.size > 600) textCache.clear();
  textCache.set(key, c);
  return c;
}

/** Membre effilé (capsule) avec liseré et reflet de lumière. */
function limb(ctx: CanvasRenderingContext2D, ax: number, ay: number, bx: number, by: number, wa: number, wb: number, color: string, outline: string, lw: number, light?: string): void {
  const dx = bx - ax;
  const dy = by - ay;
  const l = Math.hypot(dx, dy) || 1;
  const nx = -dy / l;
  const ny = dx / l;
  ctx.fillStyle = color;
  ctx.strokeStyle = outline;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.moveTo(ax + nx * wa, ay + ny * wa);
  ctx.lineTo(bx + nx * wb, by + ny * wb);
  ctx.arc(bx, by, wb, Math.atan2(ny, nx), Math.atan2(-ny, -nx));
  ctx.lineTo(ax - nx * wa, ay - ny * wa);
  ctx.arc(ax, ay, wa, Math.atan2(-ny, -nx), Math.atan2(ny, nx));
  ctx.closePath();
  ctx.fill();
  if (!light) ctx.stroke();
  if (light) {
    ctx.strokeStyle = light;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = Math.max(0.8, wa * 0.45);
    ctx.beginPath();
    ctx.moveTo(ax - nx * wa * 0.45, ay - ny * wa * 0.45);
    ctx.lineTo(bx - nx * wb * 0.45, by - ny * wb * 0.45);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawHair(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: MPlayer, side: number): void {
  const a = p.data.appearance;
  ctx.fillStyle = HAIR[a.hairColor] ?? HAIR[0];
  switch (a.hair) {
    case 0: // ras
      ctx.beginPath();
      ctx.arc(x, y - r * 0.15, r * 0.98, Math.PI * 1.05, Math.PI * 1.95);
      ctx.fill();
      break;
    case 1: // court
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 1.04, Math.PI * 0.95, Math.PI * 2.05);
      ctx.fill();
      break;
    case 2: // afro
      ctx.beginPath();
      ctx.arc(x - side * r * 0.1, y - r * 0.35, r * 1.25, Math.PI * 0.85, Math.PI * 2.15);
      ctx.fill();
      break;
    case 3: // tresses
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 1.05, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - side * r * 1.0, y - r * 0.2, r * 0.35, r * 1.2);
      break;
    case 4: // chignon
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2, r * 1.02, Math.PI, Math.PI * 2);
      ctx.arc(x - side * r * 0.6, y - r * 0.9, r * 0.42, 0, Math.PI * 2);
      ctx.fill();
      break;
    default: // crâne rasé
      break;
  }
  if (a.beard) {
    ctx.fillStyle = HAIR[a.hairColor] ?? HAIR[0];
    ctx.globalAlpha = a.beard === 2 ? 0.9 : 0.5;
    ctx.beginPath();
    ctx.arc(x + side * r * 0.1, y + r * 0.25, r * 0.72, Math.PI * 0.1, Math.PI * 0.9);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

const shadeCache = new Map<string, string>();
export function shade(hex: string, k: number): string {
  const key = hex + k;
  const hit = shadeCache.get(key);
  if (hit) return hit;
  const res = shadeRaw(hex, k);
  if (shadeCache.size > 4000) shadeCache.clear();
  shadeCache.set(key, res);
  return res;
}
function shadeRaw(hex: string, k: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  const f = (c: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  r = f(r);
  g = f(g);
  b = f(b);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
