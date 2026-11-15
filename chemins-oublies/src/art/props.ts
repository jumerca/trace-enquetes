// Décors dessinés : végétation, rochers, mobilier de village, mécanismes, bâtiments en vue trois quarts.
// Chaque dessin est fait en unités « monde », origine au pied de l'objet (y = 0 au sol), à l'échelle S.
import { Ctx, canvas, ink, ellipse, rrect, blob, shade, softShadow, INK, capsule, line } from './draw';
import { Rng } from '../core/rng';

export interface PropTex { canvas: HTMLCanvasElement; ax: number; ay: number; w: number; h: number }

export function makeTex(w: number, h: number, ay: number, S: number, fn: (ctx: Ctx) => void): PropTex {
  const [cv, ctx] = canvas(w * S, h * S);
  ctx.scale(S, S);
  ctx.translate(w / 2, ay);
  fn(ctx);
  return { canvas: cv, ax: 0.5, ay: ay / h, w, h };
}

const TAU = Math.PI * 2;

// ---------------------------------------------------------------- végétation
export const LEAF = {
  oak: ['#2f7a35', '#4a9a3e', '#6dbb4c', '#a6dc6a'],
  autumn: ['#9a5a2a', '#c27a32', '#dba04a', '#efc770'],
  pine: ['#1d5a40', '#287450', '#3c9461', '#68b878'],
  birch: ['#4f9a36', '#72b846', '#9bd25e', '#cdea8a'],
  dark: ['#1f4a30', '#2c623c', '#3e7f48', '#62a45a'],
  willow: ['#567f3a', '#73984a', '#94b65c', '#b8d27a'],
};

function canopy(ctx: Ctx, rnd: () => number, cx: number, cy: number, rx: number, ry: number, pal: string[], lw = 2.4) {
  // silhouette en gros lobes ronds (contour d'encre continu), éclairée en haut à gauche
  const lobes: [number, number, number][] = [[cx, cy, Math.min(rx, ry) * 0.62]];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.35 - Math.PI / 2;
    const rr = Math.min(rx, ry) * (0.42 + rnd() * 0.12);
    lobes.push([cx + Math.cos(a) * (rx - rr) * 0.95, cy + Math.sin(a) * (ry - rr) * 0.95, rr]);
  }
  // 1. contour : traits épais puis remplissage par-dessus → un seul contour extérieur
  ctx.lineWidth = lw * 2; ctx.strokeStyle = INK;
  for (const [x, y, r] of lobes) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); }
  ctx.fillStyle = pal[0];
  for (const [x, y, r] of lobes) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
  // 2. chaque lobe : ton moyen décalé vers la lumière, puis croissant clair
  ctx.save();
  ctx.beginPath(); for (const [x, y, r] of lobes) { ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, TAU); } ctx.clip();
  const order = [...lobes].sort((p, q) => p[1] - q[1]);
  for (const [x, y, r] of order) {
    ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.arc(x - r * 0.12, y - r * 0.16, r * 0.86, 0, TAU); ctx.fill();
    ctx.strokeStyle = shade(pal[0], -0.15); ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.arc(x, y, r * 0.98, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
  for (const [x, y, r] of order) {
    ctx.fillStyle = pal[2]; ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.36, r * 0.5, 0, TAU); ctx.fill();
  }
  // motifs de feuilles (petits « u ») dans les zones sombres et moyennes
  ctx.strokeStyle = shade(pal[0], -0.2); ctx.lineWidth = lw * 0.55; ctx.lineCap = 'round';
  for (let i = 0; i < 22; i++) {
    const [x, y, r] = lobes[Math.floor(rnd() * lobes.length)];
    const a = rnd() * Math.PI * 2, d = rnd() * r * 0.8;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d + r * 0.15;
    ctx.beginPath(); ctx.arc(px, py, 2.4, 0.2, Math.PI - 0.2); ctx.stroke();
  }
  ctx.fillStyle = pal[3];
  for (let i = 0; i < 12; i++) {
    const [x, y, r] = order[Math.floor(rnd() * Math.min(4, order.length))];
    ctx.beginPath(); ellipse(ctx, x - r * 0.35 + (rnd() - 0.5) * r * 0.5, y - r * 0.45 + (rnd() - 0.5) * r * 0.3, 2.2 + rnd() * 1.6, 1.4, -0.5); ctx.fill();
  }
  ctx.restore();
}

export function tree(kind: 'oak' | 'pine' | 'birch' | 'willow' | 'dead' | 'oakDark' | 'autumn', seed: number, S: number, scale = 1): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  const k = scale * (0.85 + rnd() * 0.3);
  if (kind === 'pine') {
    const H = 150 * k;
    return makeTex(110 * k, H + 20, H + 6, S, (ctx) => {
      softShadow(ctx, 10, 0, 40 * k, 12 * k, 0.3);
      ctx.beginPath(); rrect(ctx, -6 * k, -26 * k, 12 * k, 28 * k, 3); ink(ctx, '#7a5236', 2.2, { light: () => ctx.rect(-6 * k, -26 * k, 3 * k, 28 * k), lightCol: '#a3734a' });
      const pal = LEAF.pine;
      for (let t = 0; t < 4; t++) {
        const y = -22 * k - t * 27 * k, w = (50 - t * 10) * k, top = y - 44 * k;
        const tier = () => {
          ctx.moveTo(0, top);
          ctx.quadraticCurveTo(w * 0.45, y - 24 * k, w, y - 2 * k);
          const bumps = 4;
          for (let i = 0; i < bumps; i++) { const x0 = w - (i / bumps) * 2 * w, x1 = w - ((i + 1) / bumps) * 2 * w; ctx.quadraticCurveTo((x0 + x1) / 2, y + 9 * k, x1, y - 2 * k); }
          ctx.quadraticCurveTo(-w * 0.45, y - 24 * k, 0, top); ctx.closePath();
        };
        ctx.beginPath(); tier();
        ink(ctx, pal[1], 2.3, { shadeFn: () => { ctx.moveTo(3 * k, top); ctx.lineTo(w + 4, y + 10 * k); ctx.lineTo(4 * k, y + 10 * k); ctx.closePath(); }, shadeCol: pal[0], light: () => { ctx.moveTo(-3, top + 8 * k); ctx.quadraticCurveTo(-w * 0.4, y - 18 * k, -w * 0.7, y); ctx.lineTo(-w * 0.35, y + 2); ctx.quadraticCurveTo(-w * 0.15, y - 18 * k, -3, top + 8 * k); ctx.closePath(); }, lightCol: pal[2] });
        ctx.strokeStyle = shade(pal[0], -0.15); ctx.lineWidth = 1.4;
        for (let i = 0; i < 3; i++) { const xx = -w * 0.5 + i * w * 0.5; ctx.beginPath(); ctx.arc(xx, y - 6 * k, 3, 0.2, Math.PI - 0.2); ctx.stroke(); }
      }
    });
  }
  if (kind === 'birch') {
    const H = 140 * k;
    return makeTex(110 * k, H + 16, H + 4, S, (ctx) => {
      softShadow(ctx, 10, 0, 36 * k, 11 * k, 0.28);
      ctx.beginPath(); ctx.moveTo(-4 * k, 0); ctx.quadraticCurveTo(-2 * k, -50 * k, -3 * k, -90 * k); ctx.lineTo(3 * k, -90 * k); ctx.quadraticCurveTo(2 * k, -50 * k, 4 * k, 0); ctx.closePath();
      ink(ctx, '#efeae0', 1.4, { shadeFn: () => ctx.rect(1, -100, 10, 100) });
      ctx.fillStyle = '#3a3330'; for (let i = 0; i < 7; i++) ctx.fillRect(-3 * k + rnd() * 3, -10 * k - i * 11 * k, 3 + rnd() * 3, 1.4);
      canopy(ctx, rnd, 0, -100 * k, 40 * k, 34 * k, LEAF.birch);
    });
  }
  if (kind === 'willow') {
    const H = 150 * k;
    return makeTex(170 * k, H + 18, H + 6, S, (ctx) => {
      softShadow(ctx, 12, 0, 60 * k, 16 * k, 0.28);
      ctx.beginPath(); ctx.moveTo(-8 * k, 0); ctx.quadraticCurveTo(-4 * k, -40 * k, -10 * k, -70 * k); ctx.lineTo(8 * k, -70 * k); ctx.quadraticCurveTo(4 * k, -40 * k, 8 * k, 0); ctx.closePath(); ink(ctx, '#6a5038', 1.4);
      canopy(ctx, rnd, 0, -95 * k, 62 * k, 42 * k, LEAF.willow);
      // rideaux de branches
      for (let i = 0; i < 26; i++) {
        const x = -58 * k + i * 4.6 * k + rnd() * 2, y0 = -90 * k + Math.abs(x) * 0.3, len = 40 * k + rnd() * 30 * k;
        ctx.strokeStyle = i % 3 ? LEAF.willow[1] : LEAF.willow[2]; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 2, y0 + len * 0.5, x + 1, y0 + len); ctx.stroke();
      }
    });
  }
  if (kind === 'dead') {
    return makeTex(100 * k, 120 * k, 112 * k, S, (ctx) => {
      softShadow(ctx, 8, 0, 30 * k, 9 * k, 0.25);
      const br = (x: number, y: number, a: number, l: number, w: number, d: number) => {
        const x2 = x + Math.cos(a) * l, y2 = y + Math.sin(a) * l;
        ctx.beginPath(); capsule(ctx, x, y, x2, y2, w, w * 0.6); ink(ctx, '#5a4838', 1.2);
        if (d > 0) { br(x2, y2, a - 0.5 - rnd() * 0.3, l * 0.65, w * 0.6, d - 1); br(x2, y2, a + 0.4 + rnd() * 0.3, l * 0.6, w * 0.6, d - 1); }
      };
      br(0, 0, -Math.PI / 2, 45 * k, 11 * k, 3);
    });
  }
  // chêne / feuillu
  const pal = kind === 'oakDark' ? LEAF.dark : kind === 'autumn' ? LEAF.autumn : LEAF.oak;
  const H = 150 * k;
  const rx = (52 + rnd() * 12) * k, ry = (44 + rnd() * 8) * k;
  return makeTex(rx * 2 + 30, H + 20, H + 6, S, (ctx) => {
    softShadow(ctx, 14 * k, 2, rx * 0.95, 16 * k, 0.32);
    // racines + tronc
    ctx.beginPath(); ctx.moveTo(-14 * k, 2); ctx.quadraticCurveTo(-6 * k, -6 * k, -7 * k, -40 * k); ctx.lineTo(-16 * k, -62 * k); ctx.lineTo(-6 * k, -58 * k); ctx.lineTo(0, -70 * k); ctx.lineTo(7 * k, -58 * k); ctx.lineTo(17 * k, -64 * k); ctx.lineTo(8 * k, -40 * k); ctx.quadraticCurveTo(7 * k, -6 * k, 15 * k, 2); ctx.quadraticCurveTo(0, -2, -14 * k, 2); ctx.closePath();
    ink(ctx, '#7a5236', 2.3, { shadeFn: () => ctx.rect(1, -80 * k, 30 * k, 90 * k), light: () => ctx.rect(-12 * k, -60 * k, 4 * k, 60 * k), lightCol: '#a3734a' });
    ctx.strokeStyle = '#4e3322'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-3 * k, -8 * k); ctx.quadraticCurveTo(-1 * k, -25 * k, -3 * k, -38 * k); ctx.moveTo(3 * k, -14 * k); ctx.lineTo(4 * k, -28 * k); ctx.stroke();
    canopy(ctx, rnd, 0, -H + ry + 4, rx, ry, pal);
  });
}

export function bush(seed: number, S: number, pal = LEAF.oak, flowers?: string): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  const w = 34 + rnd() * 18;
  return makeTex(w * 2 + 10, w * 1.5 + 10, w * 1.25, S, (ctx) => {
    softShadow(ctx, 4, 0, w * 0.95, w * 0.3, 0.3);
    canopy(ctx, rnd, 0, -w * 0.5, w, w * 0.62, pal, 1.3);
    if (flowers) {
      for (let i = 0; i < 9; i++) {
        const x = (rnd() - 0.5) * w * 1.4, y = -w * 0.5 + (rnd() - 0.6) * w * 0.8;
        ctx.fillStyle = flowers; ctx.beginPath(); ctx.arc(x, y, 2.4, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke();
        ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, TAU); ctx.fill();
      }
    }
  });
}

export function rock(seed: number, S: number, size = 1, mossy = false): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  const w = 26 * size + rnd() * 10 * size;
  return makeTex(w * 2.4, w * 2, w * 1.5, S, (ctx) => {
    softShadow(ctx, 6, -2, w * 1.05, w * 0.35, 0.32);
    ctx.beginPath(); blob(ctx, 0, -w * 0.45, w, w * 0.62, 9, 0.35, rnd, rnd());
    ink(ctx, '#9a948a', 1.5, { shadeFn: () => ellipse(ctx, w * 0.35, -w * 0.1, w * 0.9, w * 0.55), shadeCol: '#77716a', light: () => ellipse(ctx, -w * 0.3, -w * 0.8, w * 0.55, w * 0.25), lightCol: '#c2bdb2' });
    ctx.strokeStyle = '#5f5a54'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-w * 0.2, -w * 0.75); ctx.lineTo(-w * 0.05, -w * 0.45); ctx.lineTo(w * 0.15, -w * 0.5); ctx.stroke();
    if (mossy) { ctx.fillStyle = '#6f9a45'; ctx.beginPath(); blob(ctx, -w * 0.15, -w * 0.88, w * 0.5, w * 0.16, 8, 0.4, rnd); ctx.fill(); }
  });
}

/** Le rocher fendu « qui bâille » (repère des bornes). */
export function splitRock(S: number): PropTex {
  const r = new Rng(77); const rnd = () => r.next();
  return makeTex(150, 120, 100, S, (ctx) => {
    softShadow(ctx, 8, -2, 70, 18, 0.34);
    for (const s of [-1, 1]) {
      ctx.beginPath(); blob(ctx, s * 28, -40, 34, 40, 9, 0.2, rnd, s);
      ink(ctx, '#a39d92', 1.6, { shadeFn: () => ctx.rect(s * 28 + 6, -90, 50, 100), shadeCol: '#7c766e', light: () => ellipse(ctx, s * 28 - 10, -62, 14, 8), lightCol: '#c9c3b8' });
    }
    ctx.fillStyle = '#3a3530'; ctx.beginPath(); ctx.moveTo(-6, -78); ctx.lineTo(4, -70); ctx.lineTo(-2, -40); ctx.lineTo(6, -6); ctx.lineTo(-8, -6); ctx.lineTo(-3, -40); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#6f9a45'; ctx.beginPath(); blob(ctx, -36, -76, 16, 5, 7, 0.4, rnd); ctx.fill();
  });
}

export function flowerPatch(seed: number, S: number, cols: string[]): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  return makeTex(60, 30, 22, S, (ctx) => {
    for (let i = 0; i < 14; i++) {
      const x = (rnd() - 0.5) * 50, y = (rnd() - 0.6) * 18;
      ctx.strokeStyle = '#3f6b32'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y + 6); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = cols[i % cols.length];
      for (let p = 0; p < 5; p++) { const a = p / 5 * TAU; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 1.8, y + Math.sin(a) * 1.8, 1.4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = '#f7e27a'; ctx.beginPath(); ctx.arc(x, y, 1, 0, TAU); ctx.fill();
    }
  });
}

export function grassTuft(seed: number, S: number, col = '#5e9446'): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  return makeTex(30, 26, 22, S, (ctx) => {
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * 18, h = 8 + rnd() * 10, b = (rnd() - 0.5) * 8;
      ctx.strokeStyle = i % 2 ? col : shade(col, 0.2); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + b * 0.3, -h * 0.6, x + b, -h); ctx.stroke();
    }
  });
}

// ---------------------------------------------------------------- mobilier
export function fence(len: number, S: number, vertical = false): PropTex {
  if (vertical) {
    return makeTex(16, len + 30, len + 4, S, (ctx) => {
      for (let y = 0; y >= -len; y -= 22) { ctx.beginPath(); rrect(ctx, -2.5, y - 20, 5, 22, 1.5); ink(ctx, '#9a6d45', 1.1); }
      for (const h of [-14, -7]) { ctx.beginPath(); rrect(ctx, -1.8, -len + h, 3.6, len, 1); ink(ctx, '#b2835a', 0.9); }
    });
  }
  return makeTex(len + 10, 34, 28, S, (ctx) => {
    softShadow(ctx, 4, 0, len * 0.5, 4, 0.18);
    for (const h of [-16, -9]) { ctx.beginPath(); rrect(ctx, -len / 2, h, len, 3.6, 1.2); ink(ctx, '#b2835a', 1); }
    for (let x = -len / 2; x <= len / 2 + 0.1; x += len / Math.max(1, Math.round(len / 26))) { ctx.beginPath(); ctx.moveTo(x - 2.6, 2); ctx.lineTo(x - 2.6, -19); ctx.lineTo(x, -22); ctx.lineTo(x + 2.6, -19); ctx.lineTo(x + 2.6, 2); ctx.closePath(); ink(ctx, '#9a6d45', 1.1, { shadeFn: () => ctx.rect(x, -25, 5, 30) }); }
  });
}

export function barrel(S: number): PropTex {
  return makeTex(34, 44, 40, S, (ctx) => {
    softShadow(ctx, 3, -1, 15, 5);
    ctx.beginPath(); ctx.moveTo(-11, -2); ctx.quadraticCurveTo(-14, -15, -11, -29); ctx.lineTo(11, -29); ctx.quadraticCurveTo(14, -15, 11, -2); ctx.quadraticCurveTo(0, 2, -11, -2); ctx.closePath();
    ink(ctx, '#9a6234', 1.3, { shadeFn: () => ctx.rect(3, -35, 20, 40), light: () => ctx.rect(-9, -30, 3, 30) });
    for (const y of [-8, -22]) { ctx.strokeStyle = '#4a4440'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-12.5, y); ctx.quadraticCurveTo(0, y + 3, 12.5, y); ctx.stroke(); }
    ctx.beginPath(); ellipse(ctx, 0, -29, 11, 4); ink(ctx, '#b07a48', 1.2);
  });
}

export function crate(S: number, seed = 1): PropTex {
  const r = new Rng(seed);
  return makeTex(40, 44, 38, S, (ctx) => {
    softShadow(ctx, 3, 0, 17, 5);
    ctx.beginPath(); rrect(ctx, -14, -24, 28, 24, 1.5); ink(ctx, '#b88a55', 1.3, { shadeFn: () => ctx.rect(4, -30, 20, 40) });
    ctx.beginPath(); ctx.moveTo(-14, -24); ctx.lineTo(-10, -32); ctx.lineTo(18, -32); ctx.lineTo(14, -24); ctx.closePath(); ink(ctx, '#d0a370', 1.2);
    ctx.strokeStyle = '#7a5532'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-14, -24); ctx.lineTo(14, 0); ctx.moveTo(-14, -12); ctx.lineTo(14, -12); ctx.stroke();
    if (r.chance(0.5)) { ctx.fillStyle = '#d0503a'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-8 + i * 5, -31, 3, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke(); } }
  });
}

export function lamp(S: number): PropTex {
  return makeTex(34, 100, 94, S, (ctx) => {
    softShadow(ctx, 3, 0, 12, 4);
    ctx.beginPath(); rrect(ctx, -5, -10, 10, 10, 2); ink(ctx, '#4a4744', 1.4);
    ctx.beginPath(); rrect(ctx, -2.2, -72, 4.4, 64, 1.5); ink(ctx, '#3d3a3a', 1.2, { light: () => ctx.rect(-2.2, -72, 1.5, 64), lightCol: '#6a6662' });
    // lanterne
    ctx.beginPath(); ctx.moveTo(-8, -72); ctx.lineTo(8, -72); ctx.lineTo(6, -86); ctx.lineTo(-6, -86); ctx.closePath(); ink(ctx, '#ffd773', 1.4, { light: () => ctx.rect(-6, -86, 5, 14), lightCol: '#fff4c4' });
    line(ctx, 0, -86, 0, -72, '#3d3a3a', 1.2);
    ctx.beginPath(); ctx.moveTo(-10, -86); ctx.lineTo(0, -95); ctx.lineTo(10, -86); ctx.closePath(); ink(ctx, '#3d3a3a', 1.2);
    ctx.beginPath(); rrect(ctx, -9, -73, 18, 3, 1); ink(ctx, '#3d3a3a', 1);
  });
}

export function bench(S: number): PropTex {
  return makeTex(60, 36, 30, S, (ctx) => {
    softShadow(ctx, 3, 0, 26, 5, 0.22);
    for (const x of [-20, 20]) { ctx.beginPath(); rrect(ctx, x - 2, -10, 4, 11, 1); ink(ctx, '#6b4a30', 1); }
    ctx.beginPath(); rrect(ctx, -26, -14, 52, 6, 2); ink(ctx, '#a8784a', 1.1);
    ctx.beginPath(); rrect(ctx, -26, -26, 52, 7, 2); ink(ctx, '#b88a55', 1.1);
  });
}

export function well(S: number): PropTex {
  return makeTex(80, 110, 96, S, (ctx) => {
    softShadow(ctx, 5, -2, 34, 10);
    ctx.beginPath(); ctx.moveTo(-26, -6); ctx.lineTo(-26, -28); ctx.quadraticCurveTo(0, -36, 26, -28); ctx.lineTo(26, -6); ctx.quadraticCurveTo(0, 4, -26, -6); ctx.closePath();
    ink(ctx, '#a39d92', 1.4, { shadeFn: () => ctx.rect(8, -40, 30, 50) });
    ctx.strokeStyle = '#6f6a62'; ctx.lineWidth = 0.8; for (let y = -24; y < -6; y += 7) { ctx.beginPath(); ctx.moveTo(-25, y); ctx.quadraticCurveTo(0, y + 6, 25, y); ctx.stroke(); }
    ctx.beginPath(); ellipse(ctx, 0, -29, 24, 6); ink(ctx, '#2a3a4a', 1.2);
    for (const x of [-22, 22]) { ctx.beginPath(); rrect(ctx, x - 2.5, -78, 5, 50, 1); ink(ctx, '#7a5236', 1.1); }
    ctx.beginPath(); ctx.moveTo(-34, -72); ctx.lineTo(0, -92); ctx.lineTo(34, -72); ctx.lineTo(30, -68); ctx.lineTo(0, -86); ctx.lineTo(-30, -68); ctx.closePath(); ink(ctx, '#a0503a', 1.2);
    line(ctx, 0, -78, 0, -48, '#5a4030', 1); ctx.beginPath(); rrect(ctx, -5, -50, 10, 9, 1.5); ink(ctx, '#8a5a35', 1);
  });
}

export function fountain(S: number): PropTex {
  return makeTex(200, 170, 120, S, (ctx) => {
    softShadow(ctx, 6, -4, 96, 30, 0.32);
    // margelle de pierres taillées
    ctx.beginPath(); ellipse(ctx, 0, -18, 88, 32); ink(ctx, '#b8b0a2', 1.8, { shadeFn: () => ellipse(ctx, 18, -4, 92, 30), shadeCol: '#958d80' });
    ctx.strokeStyle = '#7d756a'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 76, -22 + Math.sin(a) * 25); ctx.lineTo(Math.cos(a) * 88, -18 + Math.sin(a) * 32); ctx.stroke(); }
    ctx.beginPath(); ellipse(ctx, 0, -26, 76, 24); ink(ctx, '#3f7fa6', 1.6, { light: () => ellipse(ctx, -16, -32, 44, 11), lightCol: '#6fb0d4' });
    // rides et reflets
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.6;
    for (const [x, y, w] of [[-30, -22, 14], [24, -30, 10], [10, -16, 12], [-48, -30, 9]] as [number, number, number][]) { ctx.beginPath(); ctx.moveTo(x - w / 2, y); ctx.quadraticCurveTo(x, y - 3, x + w / 2, y); ctx.stroke(); }
    // fût et vasque
    ctx.beginPath(); rrect(ctx, -10, -80, 20, 56, 4); ink(ctx, '#c2baac', 1.8, { shadeFn: () => ctx.rect(3, -82, 20, 60), shadeCol: '#9a9284', light: () => ctx.rect(-10, -80, 4, 56), lightCol: '#dcd5c8' });
    ctx.beginPath(); ellipse(ctx, 0, -80, 30, 10); ink(ctx, '#cfc7b9', 1.8, { shadeFn: () => ellipse(ctx, 8, -75, 30, 8), shadeCol: '#a8a092' });
    ctx.beginPath(); ellipse(ctx, 0, -82, 23, 6.5); ink(ctx, '#5f9fc6', 1.2);
    ctx.beginPath(); ctx.arc(0, -96, 8.5, 0, TAU); ink(ctx, '#cfc7b9', 1.6, { light: () => ctx.arc(-3, -99, 3, 0, TAU), lightCol: '#ece6da' });
    // jets d'eau
    ctx.strokeStyle = '#bfe4f4'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 4, -102); ctx.quadraticCurveTo(sd * 22, -122, sd * 30, -84); ctx.stroke(); ctx.beginPath(); ctx.moveTo(sd * 23, -80); ctx.quadraticCurveTo(sd * 40, -66, sd * 46, -36); ctx.stroke(); }
    ctx.fillStyle = '#e8f6fc'; for (const [x, y] of [[-30, -84], [30, -84], [-46, -36], [46, -36], [0, -110]] as [number, number][]) { ctx.beginPath(); ctx.arc(x, y, 2.2, 0, TAU); ctx.fill(); }
  });
}

export function stall(S: number, col: string, goods: string[]): PropTex {
  return makeTex(120, 120, 100, S, (ctx) => {
    softShadow(ctx, 4, 0, 54, 10, 0.26);
    for (const x of [-46, 46]) { ctx.beginPath(); rrect(ctx, x - 2.5, -74, 5, 74, 1); ink(ctx, '#6b4a30', 1); }
    ctx.beginPath(); rrect(ctx, -52, -34, 104, 30, 2); ink(ctx, '#a8784a', 1.3, { shadeFn: () => ctx.rect(-60, -14, 120, 20) });
    for (let i = 0; i < goods.length * 3; i++) { ctx.fillStyle = goods[i % goods.length]; ctx.beginPath(); ctx.arc(-40 + i * 8.5, -37 - (i % 2) * 3, 4.2, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke(); }
    // auvent rayé
    ctx.beginPath(); ctx.moveTo(-58, -64); ctx.lineTo(-50, -90); ctx.lineTo(50, -90); ctx.lineTo(58, -64); ctx.closePath(); ink(ctx, '#f4ecd8', 1.4);
    ctx.save(); ctx.clip(); ctx.fillStyle = col; for (let x = -60; x < 60; x += 16) { ctx.beginPath(); ctx.moveTo(x, -64); ctx.lineTo(x + 2, -90); ctx.lineTo(x + 10, -90); ctx.lineTo(x + 8, -64); ctx.closePath(); ctx.fill(); } ctx.restore();
    ctx.beginPath(); for (let x = -58; x < 58; x += 11.6) { ctx.moveTo(x, -64); ctx.quadraticCurveTo(x + 5.8, -56, x + 11.6, -64); } ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.stroke();
  });
}

export function signpost(S: number, labels: string[]): PropTex {
  return makeTex(90, 100, 94, S, (ctx) => {
    softShadow(ctx, 3, 0, 12, 4);
    ctx.beginPath(); rrect(ctx, -2.5, -80, 5, 80, 1); ink(ctx, '#7a5236', 1.1);
    labels.forEach((_, i) => {
      const y = -74 + i * 16, d = i % 2 ? -1 : 1;
      ctx.beginPath(); ctx.moveTo(-26 * d, y); ctx.lineTo(28 * d, y); ctx.lineTo(36 * d, y + 6); ctx.lineTo(28 * d, y + 12); ctx.lineTo(-26 * d, y + 12); ctx.closePath(); ink(ctx, '#c49a62', 1.1);
      ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-18 * d, y + 6); ctx.lineTo(20 * d, y + 6); ctx.stroke();
    });
  });
}

export function noticeBoard(S: number): PropTex {
  return makeTex(70, 90, 84, S, (ctx) => {
    softShadow(ctx, 3, 0, 26, 5);
    for (const x of [-24, 24]) { ctx.beginPath(); rrect(ctx, x - 2.5, -70, 5, 70, 1); ink(ctx, '#6b4a30', 1); }
    ctx.beginPath(); rrect(ctx, -30, -70, 60, 40, 2); ink(ctx, '#9a6d45', 1.3);
    const papers = ['#f4ecd8', '#efe0b8', '#f7f1e2'];
    papers.forEach((c, i) => { ctx.beginPath(); rrect(ctx, -24 + i * 17, -64 + (i % 2) * 4, 14, 20, 0.5); ink(ctx, c, 0.8); ctx.fillStyle = '#b44'; ctx.beginPath(); ctx.arc(-17 + i * 17, -62 + (i % 2) * 4, 1, 0, TAU); ctx.fill(); });
    ctx.beginPath(); ctx.moveTo(-36, -70); ctx.lineTo(0, -82); ctx.lineTo(36, -70); ctx.closePath(); ink(ctx, '#7a3a2a', 1.2);
  });
}

export function laundry(S: number): PropTex {
  return makeTex(130, 80, 74, S, (ctx) => {
    for (const x of [-56, 56]) { ctx.beginPath(); rrect(ctx, x - 2, -60, 4, 60, 1); ink(ctx, '#6b4a30', 1); }
    ctx.strokeStyle = '#5a4a3a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(-56, -56); ctx.quadraticCurveTo(0, -48, 56, -56); ctx.stroke();
    const cl = ['#f4ecd8', '#c0523a', '#5a7aa8', '#e9c33e'];
    cl.forEach((c, i) => { const x = -40 + i * 24; ctx.beginPath(); ctx.moveTo(x - 9, -53 + Math.abs(i - 1.5)); ctx.lineTo(x + 9, -53 + Math.abs(i - 1.5)); ctx.lineTo(x + 8, -32); ctx.lineTo(x - 8, -33); ctx.closePath(); ink(ctx, c, 1); });
  });
}

export function woodpile(S: number): PropTex {
  return makeTex(70, 46, 40, S, (ctx) => {
    softShadow(ctx, 3, 0, 30, 6);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 5 - row; i++) {
      const x = -24 + row * 6 + i * 12, y = -8 - row * 10;
      ctx.beginPath(); ctx.arc(x, y, 5.6, 0, TAU); ink(ctx, '#c49a62', 1); ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.stroke();
    }
  });
}

export function haystack(S: number): PropTex {
  const r = new Rng(9); const rnd = () => r.next();
  return makeTex(80, 70, 60, S, (ctx) => {
    softShadow(ctx, 4, 0, 34, 9);
    ctx.beginPath(); blob(ctx, 0, -24, 32, 26, 10, 0.12, rnd); ink(ctx, '#e0c069', 1.4, { shadeFn: () => ellipse(ctx, 14, -10, 30, 24), shadeCol: '#c4a14e' });
    ctx.strokeStyle = '#b08a3a'; ctx.lineWidth = 0.8; for (let i = 0; i < 16; i++) { const x = (rnd() - 0.5) * 50, y = -40 + rnd() * 34; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 5, y + 3); ctx.stroke(); }
  });
}

export function cart(S: number): PropTex {
  return makeTex(110, 70, 58, S, (ctx) => {
    softShadow(ctx, 4, 0, 46, 8);
    ctx.beginPath(); rrect(ctx, -40, -40, 70, 22, 2); ink(ctx, '#a8784a', 1.3, { shadeFn: () => ctx.rect(-50, -26, 100, 10) });
    ctx.strokeStyle = '#7a5236'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(30, -26); ctx.lineTo(54, -16); ctx.stroke();
    ctx.beginPath(); ctx.arc(-14, -14, 13, 0, TAU); ink(ctx, '#8a5a35', 1.3);
    ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 1.2; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; ctx.beginPath(); ctx.moveTo(-14, -14); ctx.lineTo(-14 + Math.cos(a) * 12, -14 + Math.sin(a) * 12); ctx.stroke(); }
    ctx.fillStyle = '#d6a53a'; for (let i = 0; i < 5; i++) { ctx.beginPath(); ellipse(ctx, -30 + i * 12, -43, 7, 4); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke(); }
  });
}

export function beehive(S: number): PropTex {
  return makeTex(40, 50, 46, S, (ctx) => {
    softShadow(ctx, 3, 0, 15, 4);
    ctx.beginPath(); rrect(ctx, -3, -14, 6, 14, 1); ink(ctx, '#6b4a30', 1);
    ctx.beginPath(); ctx.moveTo(-14, -14); ctx.quadraticCurveTo(-16, -42, 0, -44); ctx.quadraticCurveTo(16, -42, 14, -14); ctx.closePath(); ink(ctx, '#d9b25b', 1.3, { shadeFn: () => ctx.rect(3, -50, 20, 40) });
    ctx.strokeStyle = '#a07a32'; ctx.lineWidth = 0.9; for (const y of [-22, -30, -37]) { ctx.beginPath(); ctx.moveTo(-14, y); ctx.lineTo(14, y); ctx.stroke(); }
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(0, -18, 2.4, 0, TAU); ctx.fill();
  });
}

export function chest(S: number, open = false): PropTex {
  return makeTex(44, 44, 38, S, (ctx) => {
    softShadow(ctx, 3, 0, 18, 5);
    ctx.beginPath(); rrect(ctx, -15, -20, 30, 20, 2); ink(ctx, '#8a5a35', 1.3, { shadeFn: () => ctx.rect(5, -25, 20, 30) });
    if (open) {
      ctx.beginPath(); ctx.moveTo(-15, -20); ctx.lineTo(-13, -34); ctx.lineTo(13, -34); ctx.lineTo(15, -20); ctx.closePath(); ink(ctx, '#6b4428', 1.2);
      ctx.fillStyle = '#2a1d16'; ctx.fillRect(-13, -21, 26, 3);
    } else {
      ctx.beginPath(); ctx.moveTo(-15, -20); ctx.quadraticCurveTo(0, -33, 15, -20); ctx.closePath(); ink(ctx, '#9a6a3f', 1.3);
      ctx.fillStyle = '#d9b25b'; ctx.fillRect(-2.5, -22, 5, 6); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.strokeRect(-2.5, -22, 5, 6);
    }
    ctx.strokeStyle = '#c9a24a'; ctx.lineWidth = 1.5; for (const x of [-10, 10]) { ctx.beginPath(); ctx.moveTo(x, -20); ctx.lineTo(x, 0); ctx.stroke(); }
  });
}

/** Borne ancienne (socle) ; la flèche gravée est un sprite séparé qui tourne. */
export function borne(S: number, mossy = true): PropTex {
  const r = new Rng(41); const rnd = () => r.next();
  return makeTex(50, 70, 62, S, (ctx) => {
    softShadow(ctx, 4, -1, 20, 6, 0.3);
    ctx.beginPath(); ctx.moveTo(-13, 0); ctx.lineTo(-12, -34); ctx.quadraticCurveTo(-12, -46, 0, -47); ctx.quadraticCurveTo(12, -46, 12, -34); ctx.lineTo(13, 0); ctx.closePath();
    ink(ctx, '#bdb4a2', 1.4, { shadeFn: () => ctx.rect(4, -50, 20, 55), shadeCol: '#9b9282', light: () => ctx.rect(-12, -46, 4, 46), lightCol: '#d6cebd' });
    ctx.strokeStyle = '#6f685c'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(0, -30, 7, 0, TAU); ctx.stroke();
    ctx.font = 'bold 7px serif'; ctx.fillStyle = '#6f685c'; ctx.textAlign = 'center'; ctx.fillText('C', 0, -27.5);
    if (mossy) { ctx.fillStyle = '#6f9a45'; ctx.beginPath(); blob(ctx, -5, -4, 9, 3, 7, 0.4, rnd); ctx.fill(); }
  });
}

export function borneArrow(S: number): PropTex {
  // disque de pierre posé sur la borne, flèche vers la droite (0 rad), tourné en jeu
  return makeTex(40, 40, 20, S, (ctx) => {
    ctx.beginPath(); ellipse(ctx, 0, 0, 15, 15); ink(ctx, '#cfc6b3', 1.3, { light: () => ellipse(ctx, -4, -5, 8, 5), lightCol: '#e2dac9' });
    ctx.beginPath(); ctx.moveTo(-9, -2.2); ctx.lineTo(4, -2.2); ctx.lineTo(4, -6); ctx.lineTo(12, 0); ctx.lineTo(4, 6); ctx.lineTo(4, 2.2); ctx.lineTo(-9, 2.2); ctx.closePath();
    ink(ctx, '#7a3f2a', 1);
  });
}

export const SYMBOLS = ['eau', 'oiseau', 'cle', 'lune'] as const;
export type Symbol = typeof SYMBOLS[number];

export function drawSymbol(ctx: Ctx, s: Symbol, col: string, lw = 2) {
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath();
  if (s === 'eau') { for (const y of [-5, 0, 5]) { ctx.moveTo(-8, y); ctx.quadraticCurveTo(-4, y - 4, 0, y); ctx.quadraticCurveTo(4, y + 4, 8, y); } }
  if (s === 'oiseau') { ctx.moveTo(-9, -1); ctx.quadraticCurveTo(-4, -7, 0, 1); ctx.quadraticCurveTo(4, -7, 9, -1); ctx.moveTo(0, 1); ctx.lineTo(0, 6); }
  if (s === 'cle') { ctx.arc(-4, 0, 4, 0, TAU); ctx.moveTo(0, 0); ctx.lineTo(9, 0); ctx.moveTo(6, 0); ctx.lineTo(6, 4); ctx.moveTo(9, 0); ctx.lineTo(9, 4); }
  if (s === 'lune') { ctx.arc(0, 0, 8, -1.9, 1.9); ctx.quadraticCurveTo(-6, 0, Math.cos(-1.9) * 8, Math.sin(-1.9) * 8); }
  ctx.stroke();
}

export function standingStone(S: number, sym: Symbol, lit: boolean): PropTex {
  const r = new Rng(sym.length * 13); const rnd = () => r.next();
  return makeTex(60, 100, 92, S, (ctx) => {
    softShadow(ctx, 5, -1, 24, 7, 0.32);
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-18, -50); ctx.quadraticCurveTo(-14, -82, 2, -84); ctx.quadraticCurveTo(17, -80, 16, -48); ctx.lineTo(17, 0); ctx.closePath();
    ink(ctx, '#8f8a82', 1.6, { shadeFn: () => ctx.rect(5, -90, 20, 95), shadeCol: '#6c675f', light: () => ctx.rect(-18, -84, 5, 84), lightCol: '#aca69b' });
    ctx.fillStyle = '#5f8a42'; ctx.beginPath(); blob(ctx, -6, -6, 12, 4, 7, 0.5, rnd); ctx.fill();
    ctx.save(); ctx.translate(0, -48);
    if (lit) { ctx.shadowColor = '#ffd36a'; ctx.shadowBlur = 10; drawSymbol(ctx, sym, '#ffe08a', 2.4); }
    else drawSymbol(ctx, sym, '#4a4640', 2.2);
    ctx.restore();
  });
}

export function stele(S: number): PropTex {
  return makeTex(50, 70, 64, S, (ctx) => {
    softShadow(ctx, 3, 0, 20, 5);
    ctx.save(); ctx.translate(0, -4); ctx.rotate(0.18);
    ctx.beginPath(); rrect(ctx, -12, -46, 24, 46, 4); ink(ctx, '#a39d92', 1.4, { shadeFn: () => ctx.rect(4, -50, 20, 55), shadeCol: '#837d72' });
    ctx.strokeStyle = '#5f5a54'; ctx.lineWidth = 0.8; for (let y = -38; y < -8; y += 5) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(8 - (y % 3), y); ctx.stroke(); }
    ctx.restore();
  });
}

export function tent(S: number): PropTex {
  return makeTex(120, 90, 80, S, (ctx) => {
    softShadow(ctx, 4, 0, 52, 10);
    ctx.beginPath(); ctx.moveTo(-50, 0); ctx.lineTo(-6, -64); ctx.lineTo(44, 0); ctx.closePath(); ink(ctx, '#c9b48a', 1.5, { shadeFn: () => { ctx.moveTo(-6, -64); ctx.lineTo(44, 0); ctx.lineTo(10, 0); ctx.closePath(); }, shadeCol: '#a8936a' });
    ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-6, -40); ctx.lineTo(4, 0); ctx.closePath(); ink(ctx, '#3a2e24', 1);
    line(ctx, -6, -64, -6, -72, '#6b4a30', 2);
  });
}

export function campfire(S: number, lit: boolean): PropTex {
  return makeTex(50, 50, 38, S, (ctx) => {
    for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; ctx.beginPath(); ellipse(ctx, Math.cos(a) * 13, Math.sin(a) * 5 - 3, 4.5, 3); ink(ctx, '#8f8a82', 1); }
    ctx.beginPath(); capsule(ctx, -9, -2, 9, -6, 4, 4); ink(ctx, '#6b4a30', 1);
    ctx.beginPath(); capsule(ctx, -8, -7, 9, -1, 4, 4); ink(ctx, '#7a5236', 1);
    if (lit) { ctx.beginPath(); ctx.moveTo(-6, -4); ctx.quadraticCurveTo(-8, -16, 0, -26); ctx.quadraticCurveTo(7, -16, 6, -4); ctx.closePath(); ink(ctx, '#f39a2e', 1, { light: () => ellipse(ctx, 0, -8, 3, 7), lightCol: '#ffe38a' }); }
  });
}

export function brambleWall(S: number, w: number, seed: number): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  return makeTex(w + 20, 80, 66, S, (ctx) => {
    softShadow(ctx, 4, 0, w * 0.5, 9, 0.3);
    for (let i = 0; i < w / 14; i++) {
      const x = -w / 2 + i * 14 + rnd() * 6;
      ctx.beginPath(); blob(ctx, x, -24 - rnd() * 14, 16, 18, 8, 0.5, rnd); ink(ctx, i % 2 ? '#3f5a2e' : '#4d6a36', 1.2);
    }
    ctx.strokeStyle = '#5a3a2a'; ctx.lineWidth = 1.6;
    for (let i = 0; i < w / 8; i++) { const x = -w / 2 + rnd() * w, y = -10 - rnd() * 40; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 10, x + 18 * (rnd() - 0.5) * 2, y - 2); ctx.stroke(); }
    ctx.fillStyle = '#c94a3a'; for (let i = 0; i < w / 18; i++) { ctx.beginPath(); ctx.arc(-w / 2 + rnd() * w, -15 - rnd() * 35, 2, 0, TAU); ctx.fill(); }
  });
}

export function carvedTree(S: number): PropTex {
  const t = tree('oakDark', 991, S, 1.15);
  const ctx = t.canvas.getContext('2d')!;
  ctx.save(); ctx.scale(S, S); ctx.translate(t.w / 2, t.ay * t.h);
  ctx.strokeStyle = '#e8d6a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(0, -30, 5, 0, TAU); ctx.moveTo(-3, -30); ctx.lineTo(3, -30); ctx.moveTo(0, -38); ctx.lineTo(0, -22); ctx.stroke();
  ctx.restore();
  return t;
}

export function plant(S: number, kind: 'sauge' | 'pied' | 'lanterne'): PropTex {
  return makeTex(30, 34, 28, S, (ctx) => {
    if (kind === 'sauge') { for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.32; ctx.beginPath(); ellipse(ctx, Math.cos(a) * 9, -4 + Math.sin(a) * 11, 3, 7, a + Math.PI / 2); ink(ctx, '#9fb8b0', 0.9); } }
    if (kind === 'pied') { for (let i = 0; i < 5; i++) { const x = -8 + i * 4; ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x - 3, -10, x + 1, -18); ctx.stroke(); for (let k = 0; k < 4; k++) { ctx.fillStyle = '#5c9a45'; ctx.beginPath(); ellipse(ctx, x - 1.5 + (k % 2) * 3, -5 - k * 3.5, 2.4, 1.2, 0.5); ctx.fill(); } } }
    if (kind === 'lanterne') { ctx.strokeStyle = '#3f7a3a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-4, -10, 2, -18); ctx.stroke(); ctx.beginPath(); ellipse(ctx, 2, -20, 5, 6); ink(ctx, '#f2a03a', 1, { light: () => ellipse(ctx, 1, -22, 2, 3), lightCol: '#ffe08a' }); }
    ctx.fillStyle = 'rgba(255,240,170,0.35)'; ctx.beginPath(); ctx.arc(0, -10, 13, 0, TAU); ctx.fill();
  });
}

export function lever(S: number, on: boolean, col = '#7a3f2a'): PropTex {
  return makeTex(40, 60, 52, S, (ctx) => {
    softShadow(ctx, 3, 0, 14, 4);
    ctx.beginPath(); rrect(ctx, -12, -14, 24, 14, 2); ink(ctx, '#6b6a68', 1.3, { shadeFn: () => ctx.rect(4, -20, 20, 30) });
    const a = on ? -0.6 : -2.5;
    const x2 = Math.cos(a) * 30, y2 = -10 + Math.sin(a) * 30;
    ctx.beginPath(); capsule(ctx, 0, -10, x2, y2, 4, 3); ink(ctx, '#4a4440', 1.1);
    ctx.beginPath(); ctx.arc(x2, y2, 4.4, 0, TAU); ink(ctx, col, 1.1, { light: () => ctx.arc(x2 - 1.5, y2 - 1.5, 1.6, 0, TAU) });
  });
}

export function sluice(S: number, open: boolean): PropTex {
  return makeTex(70, 80, 50, S, (ctx) => {
    for (const x of [-26, 26]) { ctx.beginPath(); rrect(ctx, x - 5, -52, 10, 56, 2); ink(ctx, '#7a5236', 1.2); }
    ctx.beginPath(); rrect(ctx, -30, -56, 60, 8, 2); ink(ctx, '#8a5a35', 1.2);
    const y = open ? -46 : -24;
    ctx.beginPath(); rrect(ctx, -21, y, 42, 24, 1.5); ink(ctx, '#a8784a', 1.2, { shadeFn: () => ctx.rect(-30, y + 16, 60, 10) });
    ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 0.8; for (let x = -14; x <= 14; x += 7) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 24); ctx.stroke(); }
    line(ctx, 0, -56, 0, y, '#3d3a3a', 2.4);
  });
}

export function ruinedBridge(S: number): PropTex {
  return makeTex(220, 140, 70, S, (ctx) => {
    for (const s of [-1, 1]) {
      ctx.beginPath(); rrect(ctx, s * 80 - 18, -40, 36, 70, 3); ink(ctx, '#a39d92', 1.5, { shadeFn: () => ctx.rect(s * 80 + 4, -50, 30, 90), shadeCol: '#837d72' });
    }
    // planches restantes, brisées au milieu
    for (let i = 0; i < 6; i++) { ctx.save(); ctx.translate(-62 + i * 9, -28); ctx.rotate(0.05 * i); ctx.beginPath(); rrect(ctx, -4, -6, 8, 30, 1); ink(ctx, '#8a6a48', 1); ctx.restore(); }
    for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(62 - i * 9, -28); ctx.rotate(-0.12 * i); ctx.beginPath(); rrect(ctx, -4, -6, 8, 30, 1); ink(ctx, '#8a6a48', 1); ctx.restore(); }
    ctx.strokeStyle = '#5a4030'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-98, -44); ctx.quadraticCurveTo(-60, -30, -20, -50); ctx.moveTo(98, -44); ctx.quadraticCurveTo(70, -36, 40, -46); ctx.stroke();
  });
}

export function woodBridge(S: number, len: number, wid: number): PropTex {
  // pont vu de dessus (traverse est-ouest)
  return makeTex(len + 20, wid + 50, wid / 2 + 30, S, (ctx) => {
    softShadow(ctx, 0, wid / 2 + 6, len * 0.55, 8, 0.3);
    ctx.beginPath(); rrect(ctx, -len / 2, -wid / 2, len, wid, 3); ink(ctx, '#a8784a', 1.4);
    ctx.strokeStyle = '#7a5236'; ctx.lineWidth = 1; for (let x = -len / 2 + 9; x < len / 2; x += 9) { ctx.beginPath(); ctx.moveTo(x, -wid / 2 + 1); ctx.lineTo(x, wid / 2 - 1); ctx.stroke(); }
    for (const s of [-1, 1]) {
      const y = s * wid / 2;
      for (let x = -len / 2; x <= len / 2; x += len / 4) { ctx.beginPath(); rrect(ctx, x - 3, y - 16, 6, 18, 1); ink(ctx, '#7a5236', 1); }
      ctx.beginPath(); rrect(ctx, -len / 2, y - 16, len, 4.5, 1.5); ink(ctx, '#9a6d45', 1);
    }
  });
}

// ---------------------------------------------------------------- bâtiments
export interface HouseOpts {
  w: number; h: number; d: number; // largeur, hauteur de mur, profondeur (toit visible)
  wall: string; roof: string; trim?: string;
  timber?: boolean; stone?: boolean;
  door?: number; // position x de la porte (relative au centre)
  windows?: number[]; floors?: number;
  sign?: { text: string; col: string };
  chimney?: number; shutters?: string; flowers?: boolean;
  roofStyle?: 'tile' | 'slate' | 'thatch';
  dormer?: boolean; awning?: string; lantern?: boolean;
  seed: number;
}

/** Dimensions d'une maison : mur court, grand toit dont on voit les deux versants. */
export function houseGeom(o: HouseOpts) {
  const fl = o.floors ?? 1;
  const wallH = Math.round(o.h * (fl > 1 ? 0.84 : 0.74));
  const eaveY = -wallH + 8;
  const fH = Math.round(o.d * 0.62 + 20);
  const ridgeY = eaveY - fH;
  const bH = Math.round(o.d * 0.28 + 8);
  const topY = ridgeY - bH;
  return { fl, wallH, eaveY, fH, ridgeY, bH, topY, ov: 16 };
}
export function houseChimney(o: HouseOpts): [number, number] | undefined {
  if (o.chimney === undefined) return undefined;
  const g = houseGeom(o);
  return [o.chimney, g.ridgeY - g.bH * 0.5 - 30];
}

export function house(o: HouseOpts, S: number): PropTex {
  const r = new Rng(o.seed); const rnd = () => r.next();
  const G = houseGeom(o);
  const { fl, wallH, eaveY, ridgeY, topY, ov } = G;
  const W = o.w + ov * 2 + 30, H = -topY + 70;
  return makeTex(W, H, H - 16, S, (ctx) => {
    const hw = o.w / 2;
    softShadow(ctx, 20, 4, hw + 34, 20, 0.36);
    // ---- murs
    ctx.beginPath(); ctx.rect(-hw, -wallH, o.w, wallH);
    ink(ctx, o.wall, 2.4, { light: () => ctx.rect(-hw, -wallH, 6, wallH), lightCol: shade(o.wall, 0.16) });
    ctx.save(); ctx.beginPath(); ctx.rect(-hw, -wallH, o.w, wallH); ctx.clip();
    if (o.stone) {
      // pierres irrégulières, chacune avec son petit contour
      for (let y = -wallH; y < 0; y += 11) for (let x = -hw - 8 + ((Math.round(y / 11)) % 2 ? 9 : 0); x < hw + 8; x += 17 + rnd() * 4) {
        ctx.beginPath(); rrect(ctx, x + 1, y + 1, 15 + rnd() * 3, 9.5, 4);
        ctx.fillStyle = shade(o.wall, (rnd() - 0.5) * 0.16); ctx.fill();
        ctx.strokeStyle = shade(o.wall, -0.32); ctx.lineWidth = 0.9; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(x + 3, y + 2.2, 8, 1.4);
      }
    } else {
      ctx.fillStyle = shade(o.wall, -0.06);
      for (let i = 0; i < 26; i++) { ctx.beginPath(); ellipse(ctx, -hw + rnd() * o.w, -wallH + rnd() * wallH, 3 + rnd() * 7, 1.5 + rnd() * 2); ctx.fill(); }
    }
    if (o.timber) {
      ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 4;
      for (let f = 1; f < fl; f++) { const y = -wallH + (wallH / fl) * f; ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke(); }
      const n = Math.max(2, Math.round(o.w / 46));
      for (let i = 0; i <= n; i++) { const x = -hw + (o.w / n) * i; ctx.beginPath(); ctx.moveTo(x, -wallH); ctx.lineTo(x, 0); ctx.stroke(); }
      ctx.lineWidth = 3;
      for (let i = 0; i < n; i++) { const x0 = -hw + (o.w / n) * i; if (i % 2) continue; ctx.beginPath(); ctx.moveTo(x0 + 4, -wallH / fl + 4); ctx.lineTo(x0 + o.w / n - 4, -6 - (fl > 1 ? 0 : 0)); ctx.stroke(); }
    }
    // ombre portée de l'avant-toit sur le haut du mur
    const sh = ctx.createLinearGradient(0, -wallH, 0, -wallH + 26);
    sh.addColorStop(0, 'rgba(40,25,20,0.55)'); sh.addColorStop(1, 'rgba(40,25,20,0)');
    ctx.fillStyle = sh; ctx.fillRect(-hw, -wallH, o.w, 26);
    ctx.restore();
    // poteaux d'angle
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.rect(sd > 0 ? hw - 7 : -hw, -wallH, 7, wallH); ink(ctx, o.timber || !o.stone ? '#6b4428' : shade(o.wall, -0.18), 1.6); }
    // soubassement de grosses pierres arrondies
    for (let x = -hw - 4; x < hw + 2; x += 13 + rnd() * 4) {
      ctx.beginPath(); ellipse(ctx, x + 7, -5, 8 + rnd() * 2, 6.5);
      ink(ctx, shade('#a8a090', (rnd() - 0.5) * 0.25), 1.3, { light: () => ellipse(ctx, x + 5, -8, 4, 2), lightCol: '#cfc8b8' });
    }
    // ---- fenêtres (cintrées)
    const wins = o.windows ?? [-hw * 0.55, hw * 0.55];
    for (let f = 0; f < fl; f++) {
      const wy = -wallH + (wallH / fl) * f + (wallH / fl) * 0.5 - 2;
      for (const wx of wins) {
        if (f === fl - 1 && o.door !== undefined && Math.abs(wx - o.door) < 30) continue;
        window_(ctx, wx, wy, o.shutters ?? '#4f7a5a', !!o.flowers && f === fl - 1 ? rnd : null);
      }
    }
    // ---- porte en arc
    if (o.door !== undefined) {
      const dx = o.door, dh = Math.min(40, wallH / fl - 6);
      ctx.beginPath(); ctx.moveTo(dx - 17, 0); ctx.lineTo(dx - 17, -dh + 12); ctx.arc(dx, -dh + 12, 17, Math.PI, 0); ctx.lineTo(dx + 17, 0); ctx.closePath();
      ink(ctx, shade('#a39d92', -0.05), 2);
      ctx.beginPath(); ctx.moveTo(dx - 13, 0); ctx.lineTo(dx - 13, -dh + 12); ctx.arc(dx, -dh + 12, 13, Math.PI, 0); ctx.lineTo(dx + 13, 0); ctx.closePath();
      ink(ctx, '#7a4a2a', 1.6, { shadeFn: () => ctx.rect(dx + 3, -dh - 4, 20, dh + 6), shadeCol: '#5e3820', light: () => ctx.rect(dx - 13, -dh, 3, dh), lightCol: '#9a6237' });
      ctx.strokeStyle = '#4a2a1a'; ctx.lineWidth = 0.9; for (const x of [-6.5, 0, 6.5]) { ctx.beginPath(); ctx.moveTo(dx + x, -dh + 3); ctx.lineTo(dx + x, -1); ctx.stroke(); }
      ctx.strokeStyle = '#3d3a3a'; ctx.lineWidth = 2; for (const y of [-dh * 0.62, -dh * 0.22]) { ctx.beginPath(); ctx.moveTo(dx - 13, y); ctx.lineTo(dx + 7, y); ctx.stroke(); }
      ctx.fillStyle = '#e6c25a'; ctx.beginPath(); ctx.arc(dx + 8, -dh * 0.42, 2, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
      ctx.beginPath(); rrect(ctx, dx - 21, -3, 42, 7, 2.5); ink(ctx, '#b5ad9e', 1.3, { light: () => ctx.rect(dx - 21, -3, 42, 2), lightCol: '#d6d0c2' });
      if (o.lantern) {
        line(ctx, dx + 20, -dh - 2, dx + 28, -dh - 2, '#3d3a3a', 2);
        ctx.beginPath(); rrect(ctx, dx + 24, -dh + 1, 9, 12, 2); ink(ctx, '#ffd773', 1.3, { light: () => ctx.rect(dx + 26, -dh + 3, 3, 8), lightCol: '#fff3c0' });
      }
    }
    if (o.awning) {
      const ay2 = -wallH * 0.62;
      ctx.beginPath(); ctx.moveTo(-hw + 4, ay2 - 4); ctx.lineTo(hw - 4, ay2 - 4); ctx.lineTo(hw + 4, ay2 + 14); ctx.lineTo(-hw - 4, ay2 + 14); ctx.closePath(); ink(ctx, '#f4ecd8', 1.6);
      ctx.save(); ctx.clip(); ctx.fillStyle = o.awning; for (let x = -hw - 8; x < hw + 8; x += 18) { ctx.beginPath(); ctx.moveTo(x, ay2 - 6); ctx.lineTo(x + 9, ay2 - 6); ctx.lineTo(x + 11, ay2 + 16); ctx.lineTo(x + 2, ay2 + 16); ctx.closePath(); ctx.fill(); } ctx.restore();
      ctx.beginPath(); for (let x = -hw - 4; x < hw + 4; x += 12) { ctx.moveTo(x, ay2 + 14); ctx.quadraticCurveTo(x + 6, ay2 + 21, x + 12, ay2 + 14); } ctx.fillStyle = o.awning; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.stroke();
    }
    if (o.sign) {
      const sx = hw - 4, sy = -wallH * 0.55;
      ctx.beginPath(); rrect(ctx, sx - 2, sy - 14, 30, 4, 1.5); ink(ctx, '#3d3a3a', 1);
      line(ctx, sx + 8, sy - 10, sx + 8, sy - 6, '#3d3a3a', 1.2); line(ctx, sx + 22, sy - 10, sx + 22, sy - 6, '#3d3a3a', 1.2);
      ctx.beginPath(); rrect(ctx, sx + 1, sy - 6, 30, 20, 3); ink(ctx, o.sign.col, 1.6, { light: () => ctx.rect(sx + 1, sy - 6, 30, 3), lightCol: shade(o.sign.col, 0.25) });
      ctx.fillStyle = '#fff3d6'; ctx.font = 'bold 7.5px serif'; ctx.textAlign = 'center'; ctx.fillText(o.sign.text, sx + 16, sy + 7);
    }
    // ---- toit
    const style = o.roofStyle ?? 'tile';
    const R = o.roof, Rd = shade(R, -0.24), Rl = shade(R, 0.18);
    const L = -hw - ov, Rr = hw + ov;
    const back = () => { ctx.moveTo(L + 5, ridgeY); ctx.lineTo(Rr - 5, ridgeY); ctx.lineTo(Rr - 18, topY); ctx.lineTo(L + 18, topY); ctx.closePath(); };
    const front = () => { ctx.moveTo(L, eaveY + 4); ctx.lineTo(Rr, eaveY + 4); ctx.lineTo(Rr - 5, ridgeY); ctx.lineTo(L + 5, ridgeY); ctx.closePath(); };
    // versant arrière (plus sombre), rangées suggérées
    ctx.beginPath(); back(); ink(ctx, Rd, 2.4);
    ctx.save(); ctx.beginPath(); back(); ctx.clip(); ctx.strokeStyle = shade(R, -0.4); ctx.lineWidth = 1;
    for (let y = topY + 7; y < ridgeY; y += 8) { ctx.beginPath(); ctx.moveTo(L, y); ctx.lineTo(Rr, y); ctx.stroke(); }
    ctx.restore();
    // épaisseur de rive (bord du toit) sous le versant avant
    ctx.beginPath(); ctx.moveTo(L - 1, eaveY + 4); ctx.lineTo(Rr + 1, eaveY + 4); ctx.lineTo(Rr + 1, eaveY + 11); ctx.lineTo(L - 1, eaveY + 11); ctx.closePath(); ink(ctx, shade(R, -0.4), 2);
    // versant avant
    ctx.beginPath(); front(); ink(ctx, R, 2.4);
    ctx.save(); ctx.beginPath(); front(); ctx.clip();
    if (style === 'tile') {
      // tuiles rondes, rangée par rangée, avec reflets
      let row = 0;
      for (let y = ridgeY + 6; y < eaveY + 12; y += 9, row++) {
        for (let x = L - 6 + (row % 2 ? 6 : 0); x < Rr + 6; x += 12) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y + 10, x + 12, y); ctx.lineTo(x + 12, y - 4); ctx.lineTo(x, y - 4); ctx.closePath();
          ctx.fillStyle = (row + Math.floor(x / 12)) % 5 === 0 ? shade(R, 0.08) : R; ctx.fill();
          ctx.strokeStyle = shade(R, -0.38); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 6, y + 10, x + 12, y); ctx.stroke();
          ctx.strokeStyle = Rl; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x + 3, y + 1.5); ctx.quadraticCurveTo(x + 5, y + 4, x + 7, y + 4.5); ctx.stroke();
        }
      }
    } else if (style === 'slate') {
      let row = 0;
      for (let y = ridgeY + 4; y < eaveY + 12; y += 8, row++) {
        for (let x = L - 6 + (row % 2 ? 7 : 0); x < Rr + 6; x += 14) {
          ctx.beginPath(); rrect(ctx, x + 0.5, y, 13, 8.5, 2);
          ctx.fillStyle = shade(R, (rnd() - 0.5) * 0.14); ctx.fill(); ctx.strokeStyle = shade(R, -0.35); ctx.lineWidth = 0.9; ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillRect(x + 2, y + 1, 8, 1.3);
        }
      }
    } else {
      // chaume : mèches de paille en écailles
      for (let y = ridgeY + 2; y < eaveY + 12; y += 7) for (let x = L - 6; x < Rr + 6; x += 5) {
        const yy = y + rnd() * 3;
        ctx.strokeStyle = rnd() < 0.5 ? shade(R, -0.22) : shade(R, 0.15); ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(x, yy); ctx.quadraticCurveTo(x + 1, yy + 5, x + 0.5, yy + 9); ctx.stroke();
      }
    }
    // lumière en haut du versant, ombre en bas
    const lg = ctx.createLinearGradient(0, ridgeY, 0, eaveY + 10);
    lg.addColorStop(0, 'rgba(255,245,215,0.28)'); lg.addColorStop(0.5, 'rgba(255,245,215,0)'); lg.addColorStop(1, 'rgba(40,20,10,0.22)');
    ctx.fillStyle = lg; ctx.fillRect(L - 10, ridgeY - 4, Rr - L + 20, eaveY - ridgeY + 20);
    ctx.restore();
    if (style === 'thatch') {
      // bord de chaume bombé
      ctx.beginPath(); for (let x = L; x < Rr; x += 14) { ctx.moveTo(x, eaveY + 4); ctx.quadraticCurveTo(x + 7, eaveY + 16, x + 14, eaveY + 4); }
      ctx.fillStyle = shade(R, -0.08); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    }
    // rives : épaisseur du toit sur les côtés
    for (const sd of [-1, 1]) {
      const xe = sd < 0 ? L : Rr, xr = sd < 0 ? L + 5 : Rr - 5;
      ctx.beginPath(); ctx.moveTo(xe, eaveY + 4); ctx.lineTo(xr, ridgeY); ctx.lineTo(xr - sd * 7, ridgeY + 2); ctx.lineTo(xe - sd * 7, eaveY + 4); ctx.closePath();
      ink(ctx, shade(R, sd < 0 ? 0.05 : -0.3), 1.8);
    }
    // faîtage arrondi
    ctx.beginPath(); rrect(ctx, L + 1, ridgeY - 5, Rr - L - 2, 10, 5);
    ink(ctx, style === 'thatch' ? shade(R, -0.12) : shade(R, -0.12), 2, { light: () => ctx.rect(L, ridgeY - 5, Rr - L, 3.5), lightCol: Rl });
    if (style !== 'thatch') { ctx.strokeStyle = shade(R, -0.4); ctx.lineWidth = 0.9; for (let x = L + 12; x < Rr - 6; x += 14) { ctx.beginPath(); ctx.moveTo(x, ridgeY - 4); ctx.lineTo(x, ridgeY + 4); ctx.stroke(); } }
    // lucarne
    if (o.dormer) {
      const dx = 0, dy = (ridgeY + eaveY) / 2 + 2;
      ctx.beginPath(); ctx.rect(dx - 15, dy - 6, 30, 22); ink(ctx, o.wall, 1.8);
      window_(ctx, dx, dy + 5, o.shutters ?? '#4f7a5a', null, 0.7);
      ctx.beginPath(); ctx.moveTo(dx - 21, dy - 3); ctx.lineTo(dx, dy - 20); ctx.lineTo(dx + 21, dy - 3); ctx.lineTo(dx + 17, dy - 1); ctx.lineTo(dx, dy - 14); ctx.lineTo(dx - 17, dy - 1); ctx.closePath(); ink(ctx, Rd, 1.8);
    }
    // cheminée de pierre
    if (o.chimney !== undefined) {
      const cx = o.chimney, cy = ridgeY - G.bH * 0.35;
      ctx.beginPath(); ctx.rect(cx - 10, cy - 26, 20, 30); ink(ctx, '#a39484', 2, { shadeFn: () => ctx.rect(cx + 3, cy - 30, 10, 40), shadeCol: '#837466' });
      ctx.strokeStyle = '#6f6458'; ctx.lineWidth = 0.9; for (let y = cy - 20; y < cy + 2; y += 7) { ctx.beginPath(); ctx.moveTo(cx - 10, y); ctx.lineTo(cx + 10, y); ctx.stroke(); }
      ctx.beginPath(); rrect(ctx, cx - 13, cy - 31, 26, 7, 2); ink(ctx, '#8a7e70', 1.8, { light: () => ctx.rect(cx - 13, cy - 31, 26, 2), lightCol: '#b5a898' });
      ctx.fillStyle = '#2b2018'; ctx.fillRect(cx - 7, cy - 30, 14, 3);
    }
  });
}

function window_(ctx: Ctx, x: number, y: number, shutter: string, flowers: (() => number) | null, k = 1) {
  const w = 18 * k, h = 22 * k;
  if (k === 1) for (const s of [-1, 1]) {
    const sx = x + s * (w / 2 + 5);
    ctx.beginPath(); rrect(ctx, sx - 5, y - h / 2, 10, h, 1.5); ink(ctx, shutter, 1.4, { light: () => ctx.rect(sx - 5, y - h / 2, 2.5, h), lightCol: shade(shutter, 0.2) });
    ctx.strokeStyle = shade(shutter, -0.35); ctx.lineWidth = 0.8; for (let yy = y - h / 2 + 4; yy < y + h / 2 - 1; yy += 3.6) { ctx.beginPath(); ctx.moveTo(sx - 3.5, yy); ctx.lineTo(sx + 3.5, yy); ctx.stroke(); }
  }
  // encadrement cintré
  const arch = () => { ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y - h / 2 + w / 2); ctx.arc(x, y - h / 2 + w / 2, w / 2, Math.PI, 0); ctx.lineTo(x + w / 2, y + h / 2); ctx.closePath(); };
  ctx.beginPath(); arch(); ink(ctx, '#2f4c5c', 1.6, { light: () => { ctx.moveTo(x - w / 2, y + h / 2 - 3); ctx.lineTo(x + w / 2, y - h / 2 + 3); ctx.lineTo(x + w / 2, y - h / 2 + 9); ctx.lineTo(x - w / 2, y + h / 2 + 3); ctx.closePath(); }, lightCol: '#6f9cb4' });
  ctx.strokeStyle = '#f2ead6'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.moveTo(x - w / 2, y + 1); ctx.lineTo(x + w / 2, y + 1); ctx.stroke();
  ctx.beginPath(); arch(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
  ctx.beginPath(); rrect(ctx, x - w / 2 - 4, y + h / 2 - 1, w + 8, 4.5, 1.5); ink(ctx, '#d6cdb8', 1.2);
  if (flowers) {
    ctx.beginPath(); rrect(ctx, x - w / 2 - 3, y + h / 2 + 3, w + 6, 7, 2); ink(ctx, '#8a5a35', 1.3);
    const cols = ['#e04a3a', '#f2a0b8', '#ffd84a', '#ffffff', '#b07ad8'];
    for (let i = 0; i < 7; i++) { ctx.fillStyle = '#4f8a3a'; ctx.beginPath(); ctx.arc(x - w / 2 + i * (w / 6), y + h / 2 + 3, 2.6, 0, TAU); ctx.fill(); }
    for (let i = 0; i < 5; i++) { const fx = x - w / 2 + 1 + i * (w / 4.2), fy = y + h / 2 + 1 - flowers() * 2.5; ctx.fillStyle = cols[Math.floor(flowers() * cols.length)]; ctx.beginPath(); ctx.arc(fx, fy, 2.4, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(fx, fy, 0.8, 0, TAU); ctx.fill(); }
  }
}

/** Le moulin des Trois-Eaux : corps de pierre, étage à colombages. La roue est un sprite séparé. */
export function mill(S: number, restored: boolean): PropTex {
  const base = house({ w: 230, h: 150, d: 120, wall: '#b8ad98', roof: restored ? '#9a4a35' : '#6e5a50', stone: true, door: -50, windows: [-80, 30, 80], floors: 2, chimney: -60, shutters: restored ? '#4f7a5a' : '#5a5650', roofStyle: 'tile', dormer: true, seed: 404 }, S);
  if (!restored) {
    const ctx = base.canvas.getContext('2d')!;
    ctx.save(); ctx.scale(S, S); ctx.translate(base.w / 2, base.ay * base.h);
    ctx.strokeStyle = '#3a4a2a'; ctx.lineWidth = 2; // lierre
    for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.moveTo(100 - i * 5, 0); ctx.quadraticCurveTo(110 - i * 8, -60, 95 - i * 3, -120 + i * 8); ctx.stroke(); }
    ctx.fillStyle = '#4d6a36'; for (let i = 0; i < 40; i++) { ctx.beginPath(); ctx.arc(80 + (i * 13) % 34, -10 - (i * 29) % 120, 3, 0, TAU); ctx.fill(); }
    ctx.fillStyle = 'rgba(40,30,30,0.5)'; ctx.fillRect(60, -205, 20, 8); ctx.fillRect(-40, -215, 14, 10);
    ctx.restore();
  }
  return base;
}

export function waterWheel(S: number): PropTex {
  const R = 64;
  const [cv, ctx] = canvas((R * 2 + 12) * S, (R * 2 + 12) * S);
  ctx.scale(S, S); ctx.translate(R + 6, R + 6);
  ctx.beginPath(); ctx.arc(0, 0, R, 0, TAU); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 5; ctx.strokeStyle = '#7a5236'; ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R - 18, 0, TAU); ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 3; ctx.strokeStyle = '#8a6040'; ctx.stroke();
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * TAU;
    ctx.save(); ctx.rotate(a);
    if (i % 2 === 0) { ctx.beginPath(); rrect(ctx, -2.5, -R + 18, 5, R - 26, 1.5); ink(ctx, '#7a5236', 1.1); }
    ctx.beginPath(); rrect(ctx, -6, -R - 3, 12, 22, 1.5); ink(ctx, '#9a6d45', 1.1);
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ink(ctx, '#4a4440', 1.4);
  return { canvas: cv, ax: 0.5, ay: 0.5, w: R * 2 + 12, h: R * 2 + 12 };
}

export function mistWall(S: number, w: number): PropTex {
  const r = new Rng(5); const rnd = () => r.next();
  return makeTex(w + 60, 140, 110, S, (ctx) => {
    for (let i = 0; i < 40; i++) {
      const x = (rnd() - 0.5) * w, y = -20 - rnd() * 80, rr = 20 + rnd() * 30;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, 'rgba(225,230,240,0.55)'); g.addColorStop(1, 'rgba(225,230,240,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.fill();
    }
  });
}
