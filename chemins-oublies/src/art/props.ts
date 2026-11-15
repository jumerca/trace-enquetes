// Décors dessinés : végétation, rochers, mobilier de village, mécanismes, bâtiments en vue trois quarts.
// Chaque dessin est fait en unités « monde », origine au pied de l'objet (y = 0 au sol), à l'échelle S.
import { Ctx, canvas, ink, ellipse, rrect, blob, scallop, shade, softShadow, INK, capsule, line, rgba } from './draw';
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
  oak: ['#3f7a3a', '#5c9a45', '#7fb956', '#a9d46a'],
  autumn: ['#9a5a2a', '#c27a32', '#dba04a', '#efc770'],
  pine: ['#24543e', '#2f6b4a', '#46875a', '#6aa36c'],
  birch: ['#5f9a3e', '#7fb54e', '#a2cc63', '#c9e28a'],
  dark: ['#22402f', '#2f5a3c', '#3f7146', '#5a8c50'],
  willow: ['#567f3a', '#73984a', '#94b65c', '#b8d27a'],
};

function canopy(ctx: Ctx, rnd: () => number, cx: number, cy: number, rx: number, ry: number, pal: string[], lw = 1.5) {
  // masse sombre, puis touffes de plus en plus claires vers le haut-gauche (lumière)
  ctx.beginPath(); scallop(ctx, cx, cy, rx, ry, 14, rx * 0.12, rnd); ink(ctx, pal[0], lw);
  const clumps = 9;
  for (let i = 0; i < clumps; i++) {
    const a = rnd() * TAU, d = rnd() * 0.55;
    const x = cx + Math.cos(a) * rx * d - rx * 0.08, y = cy + Math.sin(a) * ry * d - ry * 0.12;
    const r = rx * (0.3 + rnd() * 0.18);
    ctx.beginPath(); scallop(ctx, x, y, r, r * 0.85, 9, r * 0.14, rnd);
    ink(ctx, pal[1], lw * 0.55, { stroke: rgba(pal[0], 0.9) });
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (1.0 + rnd() * 0.8), d = 0.25 + rnd() * 0.45;
    const x = cx + Math.cos(a) * rx * d, y = cy + Math.sin(a) * ry * d;
    const r = rx * (0.17 + rnd() * 0.12);
    ctx.beginPath(); scallop(ctx, x, y, r, r * 0.8, 7, r * 0.15, rnd); ctx.fillStyle = pal[2]; ctx.fill();
  }
  ctx.fillStyle = pal[3];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI * (1.05 + rnd() * 0.7), d = 0.35 + rnd() * 0.5;
    ctx.beginPath(); ellipse(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, 2 + rnd() * 3, 1.2 + rnd() * 1.6, -0.4); ctx.fill();
  }
  // ombre propre en bas à droite
  ctx.save(); ctx.beginPath(); scallop(ctx, cx, cy, rx, ry, 14, rx * 0.12, () => 0.5); ctx.clip();
  ctx.fillStyle = 'rgba(20,40,30,0.22)'; ctx.beginPath(); ellipse(ctx, cx + rx * 0.45, cy + ry * 0.55, rx * 0.95, ry * 0.7); ctx.fill();
  ctx.restore();
}

export function tree(kind: 'oak' | 'pine' | 'birch' | 'willow' | 'dead' | 'oakDark' | 'autumn', seed: number, S: number, scale = 1): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  const k = scale * (0.85 + rnd() * 0.3);
  if (kind === 'pine') {
    const H = 150 * k;
    return makeTex(110 * k, H + 20, H + 6, S, (ctx) => {
      softShadow(ctx, 10, 0, 40 * k, 12 * k, 0.3);
      ctx.beginPath(); rrect(ctx, -5 * k, -26 * k, 10 * k, 28 * k, 3); ink(ctx, '#6b4630', 1.4);
      const pal = LEAF.pine;
      for (let t = 0; t < 4; t++) {
        const y = -24 * k - t * 28 * k, w = (48 - t * 9) * k;
        ctx.beginPath(); ctx.moveTo(0, y - 46 * k);
        ctx.quadraticCurveTo(w * 0.3, y - 22 * k, w, y + 2 * k);
        for (let i = 0; i <= 6; i++) ctx.lineTo(w - (i / 6) * 2 * w, y + (i % 2 ? 8 : 2) * k);
        ctx.quadraticCurveTo(-w * 0.3, y - 22 * k, 0, y - 46 * k); ctx.closePath();
        ink(ctx, pal[1], 1.5, { shadeFn: () => ctx.rect(2 * k, y - 60 * k, 80 * k, 80 * k), shadeCol: pal[0], light: () => { ctx.moveTo(-2, y - 40 * k); ctx.lineTo(-w * 0.75, y); ctx.lineTo(-w * 0.35, y); ctx.closePath(); }, lightCol: pal[2] });
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
    ink(ctx, '#7a5236', 1.5, { shadeFn: () => ctx.rect(1, -80 * k, 30 * k, 90 * k), light: () => ctx.rect(-12 * k, -60 * k, 4 * k, 60 * k) });
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
  return makeTex(26, 90, 86, S, (ctx) => {
    softShadow(ctx, 3, 0, 10, 4);
    ctx.beginPath(); rrect(ctx, -2, -68, 4, 68, 1.5); ink(ctx, '#3d3a3a', 1);
    ctx.beginPath(); ctx.moveTo(-2, -66); ctx.quadraticCurveTo(-2, -76, 8, -76); ctx.lineTo(8, -73); ctx.quadraticCurveTo(1, -73, 2, -66); ctx.closePath(); ink(ctx, '#3d3a3a', 0.8);
    ctx.beginPath(); ctx.moveTo(4, -72); ctx.lineTo(12, -72); ctx.lineTo(11, -60); ctx.lineTo(5, -60); ctx.closePath(); ink(ctx, '#f6d77a', 1);
    ctx.beginPath(); ctx.moveTo(3, -72); ctx.lineTo(8, -78); ctx.lineTo(13, -72); ctx.closePath(); ink(ctx, '#3d3a3a', 0.8);
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
  return makeTex(190, 150, 110, S, (ctx) => {
    softShadow(ctx, 6, -4, 92, 28, 0.3);
    ctx.beginPath(); ellipse(ctx, 0, -18, 86, 30); ink(ctx, '#b3ab9e', 1.8, { shadeFn: () => ellipse(ctx, 20, -6, 90, 30), shadeCol: '#958d80' });
    ctx.beginPath(); ellipse(ctx, 0, -26, 74, 23); ink(ctx, '#4f86a6', 1.4, { light: () => ellipse(ctx, -18, -32, 40, 10), lightCol: '#79aeca' });
    ctx.beginPath(); rrect(ctx, -9, -78, 18, 54, 3); ink(ctx, '#b3ab9e', 1.4, { shadeFn: () => ctx.rect(2, -80, 20, 60) });
    ctx.beginPath(); ellipse(ctx, 0, -78, 26, 8); ink(ctx, '#c4bcae', 1.4);
    ctx.beginPath(); ellipse(ctx, 0, -80, 20, 5.5); ink(ctx, '#5f97b6', 1);
    ctx.beginPath(); ctx.arc(0, -92, 8, 0, TAU); ink(ctx, '#c4bcae', 1.2);
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

export function house(o: HouseOpts, S: number): PropTex {
  const r = new Rng(o.seed); const rnd = () => r.next();
  const roofH = o.d * 0.95 + 20;
  const W = o.w + 40, H = o.h + roofH + 40;
  return makeTex(W, H, H - 14, S, (ctx) => {
    const hw = o.w / 2;
    softShadow(ctx, 18, 2, hw + 26, 18, 0.32);
    // mur de face
    ctx.beginPath(); ctx.rect(-hw, -o.h, o.w, o.h);
    ink(ctx, o.wall, 1.8, { shadeFn: () => ctx.rect(-hw, -o.h, o.w, 12), shadeCol: shade(o.wall, -0.3), light: () => ctx.rect(-hw, -o.h + 12, 5, o.h), lightCol: shade(o.wall, 0.15) });
    // texture du mur
    ctx.save(); ctx.beginPath(); ctx.rect(-hw, -o.h, o.w, o.h); ctx.clip();
    if (o.stone) {
      ctx.strokeStyle = shade(o.wall, -0.25); ctx.lineWidth = 0.8;
      for (let y = -o.h + 14; y < 0; y += 10) for (let x = -hw + ((y / 10) % 2 ? 0 : 9); x < hw; x += 18) { ctx.beginPath(); rrect(ctx, x + rnd(), y, 16 + rnd() * 2, 9, 2.5); ctx.stroke(); }
    } else {
      ctx.fillStyle = shade(o.wall, -0.08); for (let i = 0; i < 30; i++) { ctx.beginPath(); ellipse(ctx, -hw + rnd() * o.w, -o.h + rnd() * o.h, 3 + rnd() * 6, 1.5 + rnd() * 2); ctx.fill(); }
    }
    if (o.timber) {
      ctx.strokeStyle = '#5a3a26'; ctx.lineWidth = 3.4;
      const fl = o.floors ?? 1;
      for (let f = 1; f <= fl; f++) { const y = -o.h + (o.h / (fl + 0.3)) * f * 0.98; ctx.beginPath(); ctx.moveTo(-hw, y); ctx.lineTo(hw, y); ctx.stroke(); }
      for (let x = -hw + 2; x <= hw; x += o.w / Math.round(o.w / 38)) { ctx.beginPath(); ctx.moveTo(x, -o.h); ctx.lineTo(x, 0); ctx.stroke(); }
      ctx.lineWidth = 2.6;
      for (let x = -hw; x < hw - 20; x += o.w / Math.round(o.w / 38)) { ctx.beginPath(); ctx.moveTo(x + 3, -o.h + 14); ctx.lineTo(x + o.w / Math.round(o.w / 38) - 3, -o.h * 0.55); ctx.stroke(); }
    }
    // soubassement
    ctx.fillStyle = shade(o.stone ? o.wall : '#a39d92', -0.1); ctx.fillRect(-hw, -9, o.w, 9);
    ctx.strokeStyle = shade('#a39d92', -0.4); ctx.lineWidth = 0.7; for (let x = -hw; x < hw; x += 14) { ctx.strokeRect(x, -9, 14, 9); }
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.strokeRect(-hw, -o.h, o.w, o.h);
    // fenêtres
    const fl = o.floors ?? 1;
    const wins = o.windows ?? [-hw * 0.55, hw * 0.55];
    for (let f = 0; f < fl; f++) {
      const wy = -o.h + 22 + f * (o.h / (fl + 0.3));
      for (const wx of wins) {
        if (f === fl - 1 && o.door !== undefined && Math.abs(wx - o.door) < 26) continue;
        window_(ctx, wx, wy + (fl === 1 ? 6 : 0), o.shutters ?? '#4f7a5a', !!o.flowers && f === fl - 1 ? rnd : null);
      }
    }
    if (o.door !== undefined) {
      const dx = o.door;
      ctx.beginPath(); ctx.moveTo(dx - 13, 0); ctx.lineTo(dx - 13, -30); ctx.quadraticCurveTo(dx, -42, dx + 13, -30); ctx.lineTo(dx + 13, 0); ctx.closePath();
      ink(ctx, '#6b3f26', 1.6, { shadeFn: () => ctx.rect(dx + 2, -45, 20, 50), light: () => ctx.rect(dx - 13, -40, 3, 40) });
      ctx.strokeStyle = '#4a2a1a'; ctx.lineWidth = 0.8; for (const x of [-6, 0, 6]) { ctx.beginPath(); ctx.moveTo(dx + x, -33); ctx.lineTo(dx + x, -2); ctx.stroke(); }
      ctx.fillStyle = '#d9b25b'; ctx.beginPath(); ctx.arc(dx + 8, -15, 1.6, 0, TAU); ctx.fill();
      ctx.beginPath(); rrect(ctx, dx - 17, -2, 34, 5, 1.5); ink(ctx, '#a39d92', 1);
      if (o.lantern) { ctx.beginPath(); rrect(ctx, dx + 17, -40, 7, 10, 1.5); ink(ctx, '#f6d77a', 1); }
    }
    if (o.awning) {
      ctx.beginPath(); ctx.moveTo(-hw + 6, -o.h * 0.48); ctx.lineTo(hw - 6, -o.h * 0.48); ctx.lineTo(hw + 2, -o.h * 0.48 + 16); ctx.lineTo(-hw - 2, -o.h * 0.48 + 16); ctx.closePath(); ink(ctx, '#f4ecd8', 1.3);
      ctx.save(); ctx.clip(); ctx.fillStyle = o.awning; for (let x = -hw - 4; x < hw + 4; x += 18) ctx.fillRect(x, -o.h, 9, o.h); ctx.restore();
    }
    if (o.sign) {
      const sx = hw - 10, sy = -o.h * 0.62;
      line(ctx, sx, sy - 10, sx + 26, sy - 10, '#3d3a3a', 2);
      ctx.beginPath(); rrect(ctx, sx + 6, sy - 8, 26, 18, 2); ink(ctx, o.sign.col, 1.2);
      ctx.fillStyle = '#f4ecd8'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.fillText(o.sign.text, sx + 19, sy + 4);
    }
    // toit (versant de face vu de dessus, débord)
    const ov = 12;
    const ry = -o.h - roofH;
    ctx.beginPath();
    ctx.moveTo(-hw - ov, -o.h + 6); ctx.lineTo(hw + ov, -o.h + 6); ctx.lineTo(hw + ov * 0.4, ry + 4); ctx.lineTo(-hw - ov * 0.4, ry + 4); ctx.closePath();
    const style = o.roofStyle ?? 'tile';
    ink(ctx, o.roof, 2, { shadeFn: () => ctx.rect(-hw - ov - 2, -o.h - 4, o.w + ov * 2 + 4, 12), shadeCol: shade(o.roof, -0.28), light: () => ctx.rect(-hw - ov, ry, o.w + 2 * ov, 10), lightCol: shade(o.roof, 0.18) });
    ctx.save(); ctx.beginPath(); ctx.moveTo(-hw - ov, -o.h + 6); ctx.lineTo(hw + ov, -o.h + 6); ctx.lineTo(hw + ov * 0.4, ry + 4); ctx.lineTo(-hw - ov * 0.4, ry + 4); ctx.closePath(); ctx.clip();
    if (style === 'tile') {
      ctx.strokeStyle = shade(o.roof, -0.3); ctx.lineWidth = 0.9;
      for (let y = ry + 12; y < -o.h + 6; y += 9) { ctx.beginPath(); for (let x = -hw - ov; x < hw + ov; x += 10) { const off = ((y - ry) / 9) % 2 ? 5 : 0; ctx.moveTo(x + off, y); ctx.quadraticCurveTo(x + off + 5, y + 5, x + off + 10, y); } ctx.stroke(); }
    } else if (style === 'slate') {
      ctx.strokeStyle = shade(o.roof, -0.3); ctx.lineWidth = 0.8;
      for (let y = ry + 10; y < -o.h + 6; y += 8) { ctx.beginPath(); ctx.moveTo(-hw - ov, y); ctx.lineTo(hw + ov, y); ctx.stroke(); for (let x = -hw - ov + ((y / 8) % 2 ? 6 : 0); x < hw + ov; x += 12) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 8); ctx.stroke(); } }
    } else {
      ctx.strokeStyle = shade(o.roof, -0.25); ctx.lineWidth = 1;
      for (let i = 0; i < o.w * 1.2; i++) { const x = -hw - ov + rnd() * (o.w + ov * 2), y = ry + rnd() * roofH; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y + 7); ctx.stroke(); }
    }
    ctx.restore();
    // faîtage
    ctx.beginPath(); rrect(ctx, -hw - ov * 0.4 - 2, ry, o.w + ov * 0.8 + 4, 7, 3); ink(ctx, shade(o.roof, -0.15), 1.6);
    if (o.dormer) {
      const dx = 0, dy = ry + roofH * 0.45;
      ctx.beginPath(); ctx.rect(dx - 14, dy - 4, 28, 20); ink(ctx, o.wall, 1.4);
      window_(ctx, dx, dy + 6, o.shutters ?? '#4f7a5a', null, 0.7);
      ctx.beginPath(); ctx.moveTo(dx - 19, dy - 2); ctx.lineTo(dx, dy - 16); ctx.lineTo(dx + 19, dy - 2); ctx.closePath(); ink(ctx, shade(o.roof, -0.05), 1.4);
    }
    if (o.chimney !== undefined) {
      const cx = o.chimney, cy = ry + roofH * 0.3;
      ctx.beginPath(); ctx.rect(cx - 8, cy - 22, 16, 26); ink(ctx, '#a0574a', 1.4, { shadeFn: () => ctx.rect(cx + 2, cy - 30, 10, 40) });
      ctx.beginPath(); ctx.rect(cx - 10, cy - 26, 20, 5); ink(ctx, '#8a8278', 1.2);
    }
  });
}

function window_(ctx: Ctx, x: number, y: number, shutter: string, flowers: (() => number) | null, k = 1) {
  const w = 16 * k, h = 20 * k;
  if (k === 1) for (const s of [-1, 1]) { ctx.beginPath(); ctx.rect(x + s * (w / 2 + 4.5) - 4.5, y - h / 2, 9, h); ink(ctx, shutter, 1.1); ctx.strokeStyle = shade(shutter, -0.3); ctx.lineWidth = 0.6; for (let yy = y - h / 2 + 4; yy < y + h / 2; yy += 4) { ctx.beginPath(); ctx.moveTo(x + s * (w / 2 + 4.5) - 3.5, yy); ctx.lineTo(x + s * (w / 2 + 4.5) + 3.5, yy); ctx.stroke(); } }
  ctx.beginPath(); ctx.rect(x - w / 2, y - h / 2, w, h); ink(ctx, '#3d5a6e', 1.3, { light: () => { ctx.moveTo(x - w / 2, y + h / 2); ctx.lineTo(x - w / 2, y); ctx.lineTo(x, y - h / 2); ctx.lineTo(x + w / 4, y - h / 2); ctx.lineTo(x - w / 2 + w / 4, y + h / 2); ctx.closePath(); }, lightCol: '#7fa6bd' });
  ctx.strokeStyle = '#f2ead6'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2); ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y); ctx.stroke();
  ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.strokeRect(x - w / 2, y - h / 2, w, h);
  ctx.beginPath(); rrect(ctx, x - w / 2 - 3, y + h / 2, w + 6, 3.5, 1); ink(ctx, '#c9c0ae', 1);
  if (flowers) {
    ctx.beginPath(); rrect(ctx, x - w / 2 - 2, y + h / 2 + 3, w + 4, 6, 1.5); ink(ctx, '#8a5a35', 1);
    const cols = ['#d4473d', '#f2a0b8', '#f6d77a', '#ffffff'];
    for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#4f8a3a' : cols[Math.floor(flowers() * 4)]; ctx.beginPath(); ctx.arc(x - w / 2 + 1 + i * (w / 5.5), y + h / 2 + 2.5 - flowers() * 2, 2.6, 0, TAU); ctx.fill(); }
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
