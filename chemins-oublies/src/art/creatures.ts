// Créatures (ronceux, murmures) et animaux d'ambiance, dessinés image par image.
import { canvas, ink, ellipse, blob, capsule, shade, INK, softShadow, rgba } from './draw';
import { Rng } from '../core/rng';
import type { Sheet, SheetFrame } from './characters';

type F = (ctx: CanvasRenderingContext2D, i: number, n: number) => void;
const TAU = Math.PI * 2;

function sheet(id: string, fw: number, fh: number, S: number, anims: { name: string; n: number; rate: number; loop: boolean; draw: F }[]): Sheet {
  const total = anims.reduce((a, b) => a + b.n, 0);
  const W = Math.ceil(fw * S), Hh = Math.ceil(fh * S);
  const cols = Math.max(1, Math.floor(2048 / W));
  const [cv, ctx] = canvas(cols * W, Math.ceil(total / cols) * Hh);
  const frames: SheetFrame[] = [];
  const out: Sheet['anims'] = [];
  let k = 0;
  for (const a of anims) {
    const names: string[] = [];
    for (let i = 0; i < a.n; i++) {
      const x = (k % cols) * W, y = Math.floor(k / cols) * Hh;
      ctx.save(); ctx.translate(x, y); ctx.scale(S, S); ctx.beginPath(); ctx.rect(0, 0, fw, fh); ctx.clip();
      ctx.translate(fw / 2, fh - 6);
      a.draw(ctx, i, a.n);
      ctx.restore();
      const name = `${a.name}_${i}`;
      frames.push({ name, x, y, w: W, h: Hh });
      names.push(name);
      k++;
    }
    out.push({ key: `${id}_${a.name}`, frames: names, rate: a.rate, loop: a.loop });
  }
  return { canvas: cv, frames, anims: out };
}

// ---------------------------------------------------------------- Ronceux : boule de ronces sur pattes de racines
function ronceux(ctx: CanvasRenderingContext2D, o: { squash: number; swell: number; step: number; hurt?: boolean; dead?: number; big?: boolean; eyes?: 'open' | 'angry' | 'closed' }) {
  const k = o.big ? 1.45 : 1;
  const r = new Rng(o.big ? 9 : 5); const rnd = () => r.next();
  const dead = o.dead ?? 0;
  ctx.globalAlpha = 1 - dead * 0.9;
  softShadow(ctx, 0, 0, 26 * k, 7 * k, 0.32);
  // pattes
  for (const s of [-1, 1]) {
    const lift = Math.max(0, Math.sin(o.step * TAU + (s > 0 ? Math.PI : 0))) * 5;
    ctx.beginPath(); capsule(ctx, s * 10 * k, -16 * k, s * 15 * k, -lift, 5 * k, 3.5 * k); ink(ctx, '#5a3a24', 1.3);
  }
  const R = (22 + o.swell * 7) * k;
  const cy = -26 * k - o.swell * 4 + o.squash * 4 + dead * 10;
  ctx.save(); ctx.translate(0, cy); ctx.scale(1 + o.squash * 0.12 + o.swell * 0.05, 1 - o.squash * 0.12);
  ctx.beginPath(); blob(ctx, 0, 0, R, R * 0.88, 13, 0.25, rnd);
  ink(ctx, o.hurt ? '#c96a4a' : '#3f5a2e', 1.6, { shadeFn: () => ellipse(ctx, R * 0.3, R * 0.35, R, R * 0.8), shadeCol: o.hurt ? '#a0503a' : '#2f4a24', light: () => ellipse(ctx, -R * 0.35, -R * 0.4, R * 0.5, R * 0.3), lightCol: o.hurt ? '#e08a6a' : '#5f7d3c' });
  // épines
  ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 1.6;
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU + rnd() * 0.3; const x = Math.cos(a) * R * 0.95, y = Math.sin(a) * R * 0.85; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * (6 + o.swell * 6), y + Math.sin(a) * (6 + o.swell * 6)); ctx.stroke(); }
  ctx.fillStyle = '#c94a3a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc((rnd() - 0.5) * R, (rnd() - 0.6) * R * 0.8, 2.2, 0, TAU); ctx.fill(); }
  // yeux
  const ey = -R * 0.1;
  for (const s of [-1, 1]) {
    if (o.eyes === 'closed' || dead) { ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(s * 7 * k - 3, ey); ctx.lineTo(s * 7 * k + 3, ey); ctx.stroke(); continue; }
    ctx.beginPath(); ellipse(ctx, s * 7 * k, ey, 4 * k, 5 * k); ctx.fillStyle = '#fff3c0'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(s * 7 * k + 0.5, ey + 1, 2 * k, 0, TAU); ctx.fill();
    if (o.eyes === 'angry') { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(s * 12 * k, ey - 7 * k); ctx.lineTo(s * 3 * k, ey - 4 * k); ctx.stroke(); }
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function murmure(ctx: CanvasRenderingContext2D, o: { t: number; stretch: number; hurt?: boolean; dead?: number; glow: number }) {
  const dead = o.dead ?? 0;
  ctx.globalAlpha = 1 - dead * 0.95;
  softShadow(ctx, 0, 0, 16, 5, 0.25);
  const y = -34 + Math.sin(o.t * TAU) * 3;
  ctx.save(); ctx.translate(0, y); ctx.scale(1 - o.stretch * 0.2 + dead * 0.4, 1 + o.stretch * 0.35 - dead * 0.3);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
  g.addColorStop(0, rgba('#8a6fd0', 0.55 + o.glow * 0.3)); g.addColorStop(1, 'rgba(60,40,110,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(0, -24);
  ctx.bezierCurveTo(14, -16, 16, 6, 8, 14);
  for (let i = 0; i < 4; i++) { const x = 8 - i * 5.3, w = Math.sin(o.t * TAU * 2 + i) * 3; ctx.quadraticCurveTo(x - 1, 22 + w, x - 2.6, 14 + (i % 2) * 3); }
  ctx.bezierCurveTo(-16, 6, -14, -16, 0, -24);
  ctx.closePath();
  ink(ctx, o.hurt ? '#b07ad0' : '#3a2e5a', 1.5, { light: () => ellipse(ctx, -4, -10, 5, 8), lightCol: o.hurt ? '#d0a0f0' : '#5a4a8a' });
  for (const s of [-1, 1]) { ctx.fillStyle = o.glow > 0.5 ? '#ffd36a' : '#e8e0ff'; ctx.beginPath(); ellipse(ctx, s * 5, -6, 2.4, 3.4 - o.stretch); ctx.fill(); }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function ronceuxSheet(S: number, big = false): Sheet {
  const k = big ? 1.45 : 1;
  return sheet(big ? 'ronceux_ancien' : 'ronceux', 80 * k, 80 * k, S, [
    { name: 'idle', n: 4, rate: 5, loop: true, draw: (c, i) => ronceux(c, { squash: Math.sin(i / 4 * TAU) * 0.3, swell: 0, step: 0, big, eyes: i === 3 ? 'closed' : 'open' }) },
    { name: 'walk', n: 4, rate: 8, loop: true, draw: (c, i) => ronceux(c, { squash: Math.abs(Math.sin(i / 4 * TAU)) * 0.4, swell: 0, step: i / 4, big, eyes: 'open' }) },
    { name: 'windup', n: 3, rate: 4, loop: false, draw: (c, i) => ronceux(c, { squash: -0.2 * i, swell: (i + 1) / 3, step: 0, big, eyes: 'angry' }) },
    { name: 'slam', n: 2, rate: 8, loop: false, draw: (c, i) => ronceux(c, { squash: i === 0 ? 1 : 0.4, swell: 0.4, step: 0, big, eyes: 'angry' }) },
    { name: 'hurt', n: 2, rate: 8, loop: false, draw: (c, i) => ronceux(c, { squash: 0.5 - i * 0.3, swell: 0, step: 0, hurt: i === 0, big, eyes: 'closed' }) },
    { name: 'die', n: 4, rate: 7, loop: false, draw: (c, i) => ronceux(c, { squash: 0.6, swell: 0, step: 0, dead: i / 3, big, eyes: 'closed' }) },
  ]);
}

/** Le Gardien des Ronces : masse de ronces vivantes, couronne d'épines, cœur d'ambre protégé par des pétales d'écorce. */
function gardien(ctx: CanvasRenderingContext2D, o: { breathe: number; open: number; lean: number; hurt?: boolean; dead?: number; rage?: boolean; lash?: number }) {
  const r = new Rng(31); const rnd = () => r.next();
  const dead = o.dead ?? 0;
  ctx.globalAlpha = 1 - dead * 0.9;
  softShadow(ctx, 0, 0, 92, 24, 0.4);
  const cy = -72 + o.breathe * 3 + dead * 30;
  ctx.save(); ctx.translate(o.lean * 10, 0);
  // racines-pattes
  for (let i = 0; i < 6; i++) {
    const a = Math.PI * (0.15 + (i / 5) * 0.7), x2 = Math.cos(a) * 90, y2 = -6 + Math.sin(a) * 6;
    ctx.beginPath(); capsule(ctx, Math.cos(a) * 30, cy + 30, x2, y2, 14, 6); ink(ctx, '#5a3a24', 2.4, { light: () => ctx.rect(-100, cy, 200, 20), lightCol: '#7a5236' });
  }
  // bras-fouets
  const lash = o.lash ?? 0;
  for (const sd of [-1, 1]) {
    const ex = sd * (70 + lash * 40), ey = cy - 30 - lash * 30;
    ctx.beginPath(); capsule(ctx, sd * 40, cy - 10, ex, ey, 18, 9); ink(ctx, o.hurt ? '#c96a4a' : '#3f5a2e', 2.6);
    ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 2; for (let k = 0; k < 5; k++) { const t = k / 5, px = sd * 40 + (ex - sd * 40) * t, py = cy - 10 + (ey - cy + 10) * t; ctx.beginPath(); ctx.moveTo(px, py - 6); ctx.lineTo(px + sd * 6, py - 14); ctx.stroke(); }
  }
  // corps : pelote de ronces
  const R = 66 + o.breathe * 4;
  ctx.beginPath(); blob(ctx, 0, cy, R, R * 0.82, 16, 0.18, rnd);
  ink(ctx, o.hurt ? '#c96a4a' : o.rage ? '#4a3a2e' : '#36502a', 3, { shadeFn: () => ellipse(ctx, 20, cy + 26, R, R * 0.7), shadeCol: o.hurt ? '#a0503a' : '#26381e', light: () => ellipse(ctx, -24, cy - 28, R * 0.5, R * 0.3), lightCol: o.hurt ? '#e08a6a' : '#557a3a' });
  // épines
  ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 2.6;
  for (let i = 0; i < 26; i++) { const a = (i / 26) * TAU; const x = Math.cos(a) * R * 0.95, y = cy + Math.sin(a) * R * 0.78; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.stroke(); }
  // couronne d'épines
  for (let i = 0; i < 7; i++) { const x = -48 + i * 16, h = 18 + (i % 2) * 10; ctx.beginPath(); ctx.moveTo(x - 6, cy - R * 0.7); ctx.lineTo(x, cy - R * 0.7 - h); ctx.lineTo(x + 6, cy - R * 0.7); ctx.closePath(); ink(ctx, '#5a3a24', 2); }
  // baies
  ctx.fillStyle = '#c94a3a'; for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc((rnd() - 0.5) * R * 1.4, cy + (rnd() - 0.5) * R, 4, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke(); }
  // yeux
  for (const sd of [-1, 1]) {
    const ex = sd * 26, ey = cy - 26;
    if (dead) { ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ex - 8, ey); ctx.lineTo(ex + 8, ey); ctx.stroke(); continue; }
    ctx.beginPath(); ellipse(ctx, ex, ey, 11, 9); ctx.fillStyle = o.rage ? '#ffb04a' : '#fff3c0'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ellipse(ctx, ex + sd * 2, ey + 1, 4, 5); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - sd * 14, ey - 16); ctx.lineTo(ex + sd * 8, ey - 8); ctx.stroke();
  }
  // cœur d'ambre (protégé par des pétales d'écorce qui s'ouvrent)
  const coreY = cy + 14;
  const glow = ctx.createRadialGradient(0, coreY, 2, 0, coreY, 34 + o.open * 20);
  glow.addColorStop(0, `rgba(255,200,90,${0.35 + o.open * 0.5})`); glow.addColorStop(1, 'rgba(255,160,60,0)');
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(0, coreY, 34 + o.open * 20, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(0, coreY, 15, 0, TAU); ink(ctx, '#ffb84a', 2.4, { light: () => ctx.arc(-5, coreY - 5, 6, 0, TAU), lightCol: '#fff0b0' });
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i / 5) * TAU, op = o.open;
    const px = Math.cos(a) * (6 + op * 18), py = coreY + Math.sin(a) * (6 + op * 18);
    ctx.save(); ctx.translate(px, py); ctx.rotate(a + Math.PI / 2);
    ctx.beginPath(); ellipse(ctx, 0, 0, 9 - op * 2, 16 - op * 6); ink(ctx, '#6b4428', 2, { light: () => ellipse(ctx, -2, -4, 3, 6), lightCol: '#9a6a40' });
    ctx.restore();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

export function gardienSheet(S: number): Sheet {
  return sheet('gardien', 230, 200, S, [
    { name: 'idle', n: 4, rate: 4, loop: true, draw: (c, i) => gardien(c, { breathe: Math.sin(i / 4 * TAU), open: 0, lean: 0 }) },
    { name: 'windup', n: 3, rate: 5, loop: false, draw: (c, i) => gardien(c, { breathe: 1, open: 0, lean: -0.3 * i, lash: -0.4 * i / 2, rage: true }) },
    { name: 'lash', n: 2, rate: 8, loop: false, draw: (c, i) => gardien(c, { breathe: -1, open: 0, lean: 0.6, lash: 1 - i * 0.3, rage: true }) },
    { name: 'exposed', n: 4, rate: 6, loop: true, draw: (c, i) => gardien(c, { breathe: -1 + Math.sin(i / 4 * TAU) * 0.3, open: 0.8 + Math.sin(i / 4 * TAU) * 0.2, lean: 0.4, lash: 1.1 }) },
    { name: 'charge', n: 2, rate: 10, loop: true, draw: (c, i) => gardien(c, { breathe: i, open: 0, lean: 0.8, rage: true, lash: 0.3 }) },
    { name: 'hurt', n: 2, rate: 10, loop: false, draw: (c, i) => gardien(c, { breathe: 0, open: 0.9, lean: -0.5, hurt: i === 0, lash: 1 }) },
    { name: 'die', n: 5, rate: 5, loop: false, draw: (c, i) => gardien(c, { breathe: 0, open: 1, lean: 0, dead: i / 4, lash: 1 }) },
  ]);
}

export function murmureSheet(S: number): Sheet {
  return sheet('murmure', 70, 80, S, [
    { name: 'idle', n: 6, rate: 8, loop: true, draw: (c, i) => murmure(c, { t: i / 6, stretch: 0, glow: 0.2 }) },
    { name: 'windup', n: 3, rate: 5, loop: false, draw: (c, i) => murmure(c, { t: 0, stretch: -0.3 * (i + 1) / 3, glow: (i + 1) / 3 }) },
    { name: 'dash', n: 2, rate: 10, loop: true, draw: (c, i) => murmure(c, { t: i / 2, stretch: 0.8, glow: 1 }) },
    { name: 'hurt', n: 2, rate: 8, loop: false, draw: (c, i) => murmure(c, { t: 0, stretch: 0, hurt: i === 0, glow: 0 }) },
    { name: 'die', n: 4, rate: 7, loop: false, draw: (c, i) => murmure(c, { t: 0, stretch: 0, dead: i / 3, glow: 0 }) },
  ]);
}

export function animalsSheet(S: number): Sheet {
  const deer = (c: CanvasRenderingContext2D, head: number, step: number) => {
    softShadow(c, 0, 0, 22, 6, 0.28);
    for (const [x, s] of [[-12, 0], [-7, 1], [9, 0], [14, 1]] as [number, number][]) { const l = Math.sin(step * TAU + s * Math.PI) * 3; c.beginPath(); capsule(c, x, -20, x + l, -1, 3.4, 2.6); ink(c, s ? '#8a5a35' : '#a8784a', 1.1); }
    c.beginPath(); ellipse(c, 0, -24, 19, 9); ink(c, '#b8844f', 1.3, { light: () => ellipse(c, -4, -29, 10, 3), lightCol: '#d4a26a', shadeFn: () => c.rect(-20, -22, 40, 10) });
    c.fillStyle = '#f4ecd8'; for (const [x, y] of [[-6, -26], [0, -27], [5, -25]]) { c.beginPath(); c.arc(x, y, 1.2, 0, TAU); c.fill(); }
    const hy = head ? -10 : -40, hx = head ? 20 : 18;
    c.beginPath(); capsule(c, 14, -28, hx, hy + 4, 7, 5); ink(c, '#b8844f', 1.2);
    c.beginPath(); ellipse(c, hx + 3, hy, 7, 5, head ? 0.6 : -0.2); ink(c, '#b8844f', 1.2);
    c.fillStyle = INK; c.beginPath(); c.arc(hx + 4, hy - 1, 1.3, 0, TAU); c.fill();
    if (!head) { c.strokeStyle = '#6b4a30'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(hx, hy - 4); c.lineTo(hx - 3, hy - 14); c.lineTo(hx - 7, hy - 17); c.moveTo(hx - 3, hy - 14); c.lineTo(hx + 1, hy - 18); c.stroke(); }
    c.beginPath(); ellipse(c, -19, -27, 3, 2); ink(c, '#f4ecd8', 1);
  };
  const rabbit = (c: CanvasRenderingContext2D, hop: number) => {
    softShadow(c, 0, 0, 9, 3, 0.25);
    const y = -hop * 6;
    c.beginPath(); ellipse(c, 0, y - 7, 8, 6); ink(c, '#a89a88', 1.1);
    c.beginPath(); ellipse(c, 6, y - 11, 4.5, 4); ink(c, '#a89a88', 1.1);
    for (const dx of [4, 7]) { c.beginPath(); ellipse(c, dx, y - 18, 1.6, 5, 0.2); ink(c, '#a89a88', 1); }
    c.beginPath(); c.arc(-8, y - 8, 2.2, 0, TAU); ink(c, '#f4ecd8', 0.8);
    c.fillStyle = INK; c.beginPath(); c.arc(8, y - 12, 0.9, 0, TAU); c.fill();
  };
  const duck = (c: CanvasRenderingContext2D, t: number) => {
    c.beginPath(); ellipse(c, 0, -4 + t, 11, 5); ink(c, '#8a7a5a', 1.1, { light: () => ellipse(c, -2, -7, 6, 2) });
    c.beginPath(); ellipse(c, 8, -10 + t, 4.5, 4); ink(c, '#2f6a4a', 1.1);
    c.beginPath(); ellipse(c, 13, -9 + t, 3, 1.4); ink(c, '#e0a030', 0.9);
    c.strokeStyle = 'rgba(255,255,255,0.5)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, 13, 0.2, Math.PI - 0.2); c.stroke();
  };
  const bird = (c: CanvasRenderingContext2D, up: number) => {
    c.translate(0, -30);
    c.strokeStyle = INK; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-9, up ? -5 : 3); c.quadraticCurveTo(-4, up ? -6 : 0, 0, 0); c.quadraticCurveTo(4, up ? -6 : 0, 9, up ? -5 : 3); c.stroke();
    c.fillStyle = '#3a3a44'; c.beginPath(); ellipse(c, 0, 0, 3, 1.8); c.fill();
  };
  const butterfly = (c: CanvasRenderingContext2D, open: number, col: string) => {
    c.translate(0, -30);
    for (const s of [-1, 1]) { c.beginPath(); ellipse(c, s * 4 * open, -2, 4 * open + 0.6, 4); ink(c, col, 0.8); c.beginPath(); ellipse(c, s * 3 * open, 3, 3 * open + 0.5, 2.6); ink(c, shade(col, -0.2), 0.8); }
    c.fillStyle = INK; c.fillRect(-0.6, -4, 1.2, 9);
  };
  return sheet('animals', 60, 60, S, [
    { name: 'deer_graze', n: 4, rate: 2, loop: true, draw: (c, i) => deer(c, i < 3 ? 1 : 0, 0) },
    { name: 'deer_walk', n: 4, rate: 6, loop: true, draw: (c, i) => deer(c, 0, i / 4) },
    { name: 'rabbit', n: 3, rate: 6, loop: true, draw: (c, i) => rabbit(c, [0, 1, 0.4][i]) },
    { name: 'duck', n: 2, rate: 2, loop: true, draw: (c, i) => duck(c, i * 0.8) },
    { name: 'bird', n: 2, rate: 7, loop: true, draw: (c, i) => bird(c, i) },
    { name: 'bfly_a', n: 2, rate: 9, loop: true, draw: (c, i) => butterfly(c, i ? 0.25 : 1, '#f2c94c') },
    { name: 'bfly_b', n: 2, rate: 9, loop: true, draw: (c, i) => butterfly(c, i ? 0.25 : 1, '#e58aa0') },
  ]);
}

/** Petites textures d'effets : particule douce, feuille, marqueur de destination, croix, cœur, étincelle. */
export function fxTextures(S: number): Record<string, HTMLCanvasElement> {
  const out: Record<string, HTMLCanvasElement> = {};
  {
    const [c, x] = canvas(32, 32); const g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); out.soft = c;
  }
  {
    const [c, x] = canvas(14 * S, 10 * S); x.scale(S, S); x.beginPath(); ellipse(x, 7, 5, 6, 3, 0.4); ink(x, '#6f9a45', 0.8); out.leaf = c;
  }
  {
    const [c, x] = canvas(14 * S, 10 * S); x.scale(S, S); x.beginPath(); ellipse(x, 7, 5, 6, 3, 0.4); ink(x, '#d4893a', 0.8); out.leaf2 = c;
  }
  {
    const [c, x] = canvas(64 * S, 32 * S); x.scale(S, S); x.strokeStyle = '#fff4c8'; x.lineWidth = 3; x.beginPath(); ellipse(x, 32, 16, 26, 12); x.stroke(); x.strokeStyle = 'rgba(80,50,20,0.6)'; x.lineWidth = 1.2; x.stroke(); out.marker = c;
  }
  {
    const [c, x] = canvas(32 * S, 32 * S); x.scale(S, S); x.lineCap = 'round'; x.strokeStyle = INK; x.lineWidth = 7; x.beginPath(); x.moveTo(8, 8); x.lineTo(24, 24); x.moveTo(24, 8); x.lineTo(8, 24); x.stroke(); x.strokeStyle = '#d04a3a'; x.lineWidth = 4; x.stroke(); out.cross = c;
  }
  {
    const [c, x] = canvas(20 * S, 20 * S); x.scale(S, S); x.fillStyle = '#ffe9a0'; x.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 3 : 9; x.lineTo(10 + Math.cos(a) * r, 10 + Math.sin(a) * r); } x.closePath(); x.fill(); out.spark = c;
  }
  {
    const [c, x] = canvas(48 * S, 30 * S); x.scale(S, S); x.strokeStyle = 'rgba(255,255,255,0.75)'; x.lineWidth = 1.6; x.beginPath(); ellipse(x, 24, 15, 18, 7); x.stroke(); out.ripple = c;
  }
  {
    const [c, x] = canvas(10, 10); x.fillStyle = '#fff'; x.fillRect(0, 0, 10, 10); out.white = c;
  }
  {
    // cœur à ramasser
    const [c, x] = canvas(24 * S, 22 * S); x.scale(S, S); x.beginPath(); x.moveTo(12, 20); x.bezierCurveTo(-2, 11, 2, 1, 8, 2); x.bezierCurveTo(10, 2.5, 11.5, 4, 12, 6); x.bezierCurveTo(12.5, 4, 14, 2.5, 16, 2); x.bezierCurveTo(22, 1, 26, 11, 12, 20); x.closePath();
    ink(x, '#e0443a', 1.8, { light: () => ellipse(x, 7.5, 6.5, 2.6, 1.8, -0.5), lightCol: '#ff9a8a' }); out.heart = c;
  }
  {
    // arc de coup de bâton
    const [c, x] = canvas(80 * S, 80 * S); x.scale(S, S); x.lineCap = 'round';
    for (const [w, a] of [[12, 0.18], [7, 0.45], [3, 0.95]] as [number, number][]) { x.strokeStyle = `rgba(255,250,225,${a})`; x.lineWidth = w; x.beginPath(); x.arc(40, 40, 30, -1.3, 1.3); x.stroke(); }
    out.slash = c;
  }
  {
    // brin d'herbe coupé
    const [c, x] = canvas(10 * S, 6 * S); x.scale(S, S); x.fillStyle = '#5fa83e'; x.beginPath(); x.ellipse(5, 3, 4.5, 1.6, 0.3, 0, Math.PI * 2); x.fill(); out.blade = c;
  }
  {
    // indicateur d'interaction (petite bulle)
    const [c, x] = canvas(26 * S, 30 * S); x.scale(S, S); x.beginPath(); x.moveTo(13, 28); x.lineTo(8, 20); x.arc(13, 12, 10, Math.PI * 0.75, Math.PI * 0.25); x.closePath(); ink(x, '#fff6dc', 1.6); x.fillStyle = INK; x.font = 'bold 13px serif'; x.textAlign = 'center'; x.fillText('…', 13, 15); out.bubble = c;
  }
  {
    const [c, x] = canvas(26 * S, 30 * S); x.scale(S, S); x.beginPath(); x.moveTo(13, 28); x.lineTo(8, 20); x.arc(13, 12, 10, Math.PI * 0.75, Math.PI * 0.25); x.closePath(); ink(x, '#ffd36a', 1.6); x.fillStyle = INK; x.font = 'bold 15px serif'; x.textAlign = 'center'; x.fillText('!', 13, 17); out.bubble_q = c;
  }
  return out;
}
