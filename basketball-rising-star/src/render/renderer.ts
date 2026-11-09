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

export type CameraMode = 'full' | 'follow';

export interface RenderOptions {
  camera: CameraMode;
  quality: 'low' | 'high';
  showOpen: boolean;
  colorblind: boolean;
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

  resize(w: number, h: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, this.opts.quality === 'high' ? 2 : 1.25);
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
      const focus = this.e.holder() ? b.x : b.x;
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
    for (const p of e.players) {
      if (p.onCourt) list.push({ y: p.pos.y, draw: () => this.drawPlayer(p) });
      else list.push({ y: p.pos.y, draw: () => this.drawPlayer(p, true) });
    }
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
    const fx = this.px(p.pos.x);
    const fy = this.py(p.pos.y, p.z);
    const anim = bench ? 'bench' : p.anim;
    const t = p.animT;
    const sp = Math.hypot(p.vel.x, p.vel.y);
    const fwd = { x: Math.cos(p.facing), y: Math.sin(p.facing) };
    // Vecteur écran de l'orientation
    const fsx = fwd.x;
    const fsy = fwd.y * TILT;
    const side = fsx >= 0 ? 1 : -1;
    const run = Math.min(1, sp / 6.5);
    const phase = p.stride;
    const crouch = anim === 'stance' ? 0.12 : anim === 'screen' ? 0.05 : anim === 'dribble' ? 0.06 : bench ? 0.4 : 0;
    const hipH = H * (0.5 - crouch) * S * ZK;
    const shoulderH = H * (0.8 - crouch * 0.9) * S * ZK;
    const headH = H * (0.9 - crouch * 0.9) * S * ZK;
    const scale = S;
    const [jersey, trim] = this.kit(p.team);
    const skin = SKIN[p.data.appearance.skin] ?? SKIN[2];
    const dark = shade(jersey, -0.35);

    // Jambes
    const legLen = hipH;
    const stepAmp = (0.22 + run * 0.28) * scale;
    const legs: [number, number][] = [];
    for (const k of [0, 1]) {
      const ph = phase + k * Math.PI;
      let ox = Math.sin(ph) * stepAmp * (sp > 0.25 ? 1 : 0);
      let lift = Math.max(0, Math.cos(ph)) * run * 0.18 * scale;
      if (anim === 'stance' || anim === 'screen') {
        ox = (k ? -1 : 1) * 0.22 * scale;
        lift = 0;
      }
      if (p.z > 0.05) {
        ox = (k ? -0.08 : 0.12) * scale;
        lift = (k ? 0.18 : 0.08) * scale;
      }
      if (bench) {
        ox = (k ? -0.05 : 0.12) * scale;
      }
      legs.push([ox * fsx + (k ? -0.07 : 0.07) * scale * -fsy, lift + ox * fsy * 0.6]);
    }
    const hipX = fx;
    const hipY = fy - hipH;
    ctx.lineCap = 'round';
    for (const [k, [ox, lift]] of legs.map((l, i) => [i, l] as [number, [number, number]])) {
      const footX = fx + ox;
      const footY = fy - lift;
      const kneeX = (hipX + footX) / 2 + side * 0.08 * scale * (p.z > 0.05 ? 1.5 : 0.6 + run);
      const kneeY = (hipY + footY) / 2 - 0.02 * scale;
      ctx.strokeStyle = skin;
      ctx.lineWidth = 0.13 * scale;
      ctx.beginPath();
      ctx.moveTo(hipX + (k ? -1 : 1) * 0.06 * scale, hipY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(footX, footY - 0.05 * scale);
      ctx.stroke();
      // Chaussures
      ctx.fillStyle = k ? '#f6f4ef' : '#e9e6df';
      ctx.beginPath();
      ctx.ellipse(footX + side * 0.05 * scale, footY - 0.03 * scale, 0.12 * scale, 0.05 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      // Chaussettes
      ctx.strokeStyle = '#f6f4ef';
      ctx.lineWidth = 0.12 * scale;
      ctx.beginPath();
      ctx.moveTo(footX, footY - 0.06 * scale);
      ctx.lineTo(footX + (kneeX - footX) * 0.25, footY - 0.06 * scale + (kneeY - footY) * 0.25);
      ctx.stroke();
    }
    void legLen;
    // Short
    const torsoW = (0.36 + (p.data.weightKg - 90) / 400) * scale;
    ctx.fillStyle = dark;
    roundRect(ctx, hipX - torsoW * 0.55, hipY - 0.06 * scale, torsoW * 1.1, 0.3 * scale, 0.05 * scale);
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.fillRect(hipX - torsoW * 0.55, hipY + 0.2 * scale, torsoW * 1.1, 0.03 * scale);
    // Torse (maillot), léger balancement
    const lean = (anim === 'run' ? run * 0.12 : 0) * side * scale + (anim === 'shoot' ? -side * 0.02 * scale : 0);
    const shX = hipX + lean;
    const shY = fy - shoulderH;
    ctx.fillStyle = jersey;
    ctx.beginPath();
    ctx.moveTo(hipX - torsoW * 0.5, hipY);
    ctx.lineTo(shX - torsoW * 0.62, shY + 0.04 * scale);
    ctx.quadraticCurveTo(shX, shY - 0.06 * scale, shX + torsoW * 0.62, shY + 0.04 * scale);
    ctx.lineTo(hipX + torsoW * 0.5, hipY);
    ctx.closePath();
    ctx.fill();
    // Liseré
    ctx.strokeStyle = trim;
    ctx.lineWidth = Math.max(1, 0.03 * scale);
    ctx.stroke();
    // Numéro
    if (scale > 14) {
      ctx.fillStyle = trim;
      ctx.font = `800 ${Math.round(0.22 * scale)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(p.data.number), (hipX + shX) / 2, (hipY + shY) / 2 + 0.02 * scale);
    }
    // Bras
    const hand = (dx: number, dz: number): [number, number] => [shX + dx * scale, shY - dz * scale * ZK];
    let hands: [[number, number], [number, number]];
    const swing = Math.sin(phase) * 0.22 * run;
    switch (anim) {
      case 'dribble': {
        const bz = Math.max(0.2, e.ball.z - (p.z > 0 ? p.z : 0));
        const ballSx = this.px(e.ball.x);
        const ballSy = this.py(e.ball.y, e.ball.z);
        const near = Math.hypot(ballSx - shX, ballSy - shY) < 1.6 * scale;
        hands = [near ? [ballSx, Math.min(ballSy, shY + shoulderH * 0.7)] : hand(side * 0.3, -0.5 + bz * 0.1), hand(-side * 0.25, -0.35)];
        break;
      }
      case 'shoot':
      case 'jumpball':
        hands = [hand(side * 0.08, 0.6 + Math.min(1, t * 2) * 0.25), hand(side * 0.18, 0.5 + Math.min(1, t * 2) * 0.2)];
        break;
      case 'layup':
        hands = [hand(side * 0.2, 0.55 + Math.min(1, t * 2) * 0.3), hand(-side * 0.15, 0.1)];
        break;
      case 'dunk':
        hands = [hand(side * 0.25, 0.75 - Math.max(0, t - 0.35) * 2), hand(side * 0.15, 0.7 - Math.max(0, t - 0.35) * 2)];
        break;
      case 'block':
      case 'rebound':
        hands = [hand(side * 0.12, 0.75), hand(-side * 0.08, 0.72)];
        break;
      case 'pass':
        hands = [hand(side * 0.42, 0.05), hand(side * 0.38, 0.0)];
        break;
      case 'catch':
        hands = [hand(side * 0.3, 0.05), hand(side * 0.24, 0.0)];
        break;
      case 'stance':
        hands = [hand(0.42, -0.1 + Math.sin(e.time * 6 + p.idx) * 0.04), hand(-0.42, -0.1)];
        break;
      case 'screen':
        hands = [hand(0.12, -0.18), hand(-0.12, -0.2)];
        break;
      case 'celebrate':
        hands = [hand(side * 0.15, 0.7 + Math.sin(t * 14) * 0.05), hand(-side * 0.3, -0.2)];
        break;
      case 'stumble':
        hands = [hand(side * 0.35, 0.2), hand(-side * 0.4, 0.1)];
        break;
      case 'bench':
        hands = [hand(0.2, -0.3), hand(-0.2, -0.3)];
        break;
      default:
        hands = [hand(side * swing + 0.16, -0.48), hand(-side * swing - 0.16, -0.48)];
    }
    for (const [i, hd] of hands.entries()) {
      const sx = shX + (i === 0 ? 1 : -1) * torsoW * 0.5;
      const elbowX = (sx + hd[0]) / 2 + (i === 0 ? 0.06 : -0.06) * scale;
      const elbowY = (shY + hd[1]) / 2 + 0.04 * scale;
      ctx.strokeStyle = p.data.appearance.sleeve && i === 0 ? trim : skin;
      ctx.lineWidth = 0.1 * scale;
      ctx.beginPath();
      ctx.moveTo(sx, shY + 0.05 * scale);
      ctx.lineTo(elbowX, elbowY);
      ctx.strokeStyle = skin;
      ctx.lineTo(hd[0], hd[1]);
      ctx.stroke();
    }
    // Tête
    const hx = shX + side * 0.02 * scale;
    const hy = fy - headH - 0.02 * scale;
    const hr = 0.115 * scale;
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    ctx.fill();
    drawHair(ctx, hx, hy, hr, p, side);
    if (p.data.appearance.headband) {
      ctx.fillStyle = trim;
      ctx.fillRect(hx - hr, hy - hr * 0.35, hr * 2, hr * 0.3);
    }
    // Œil indiquant la direction du regard
    if (scale > 18) {
      ctx.fillStyle = '#101827';
      ctx.beginPath();
      ctx.arc(hx + fsx * hr * 0.55, hy - hr * 0.1 + fsy * hr * 0.3, Math.max(0.8, hr * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
    // Nom du joueur contrôlé
    if (p.isUser && !bench) {
      ctx.fillStyle = '#DDB65A';
      ctx.font = `700 ${Math.max(10, 0.26 * scale)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('▼', hx, hy - hr - 0.18 * scale);
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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
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

export function shade(hex: string, k: number): string {
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
