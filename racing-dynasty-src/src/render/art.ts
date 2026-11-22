// Atelier de peinture procédurale (Canvas 2D) : voitures, arbres, bâtiments, tribunes, stands, sols.
// Tout est dessiné une fois au chargement puis utilisé comme texture : rendu riche, coût GPU minimal.
// Style « BD premium » : aplats, dégradés doux, encrage épais, petites touches de lumière.

export const INK_CSS = '#16130f';

export function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return [c, c.getContext('2d')!];
}

/** Petit générateur pseudo-aléatoire local (les dessins sont identiques d'un chargement à l'autre). */
function prng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ================================================================ Monoplace (vue de dessus)

export interface Livery {
  color: string;
  color2: string;
  number: number | string;
  sponsor?: string;
  sponsorColor?: string;
  short?: string;
}

/**
 * Monoplace originale vue de dessus, x vers l'avant. `S` = pixels par mètre.
 * Le canevas fait 5,6 m × 2,2 m (marges comprises) ; le centre du canevas = centre de la voiture.
 */
export function paintCar(l: Livery, S = 24): HTMLCanvasElement {
  const W = 5.6 * S, H = 2.2 * S;
  const [c, g] = canvas(W, H);
  g.translate(W / 2, H / 2);
  g.scale(S, S); // unités : mètres
  g.lineJoin = 'round';
  const ink = (w = 0.07) => {
    g.lineWidth = w;
    g.strokeStyle = INK_CSS;
    g.stroke();
  };
  // --- pneus
  const tyre = (x: number, y: number, len: number, wid: number) => {
    rr(g, x - len / 2, y - wid / 2, len, wid, 0.12);
    const gr = g.createLinearGradient(0, y - wid / 2, 0, y + wid / 2);
    gr.addColorStop(0, '#3a3a3a');
    gr.addColorStop(0.5, '#151515');
    gr.addColorStop(1, '#2a2a2a');
    g.fillStyle = gr;
    g.fill();
    ink(0.05);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    for (let k = -2; k <= 2; k++) g.fillRect(x + k * len * 0.18 - 0.015, y - wid / 2 + 0.04, 0.03, wid - 0.08);
  };
  // bras de suspension
  g.strokeStyle = '#2b2b2b';
  g.lineWidth = 0.06;
  for (const [x, y] of [[1.55, 0.78], [1.55, -0.78], [-1.75, 0.8], [-1.75, -0.8]]) {
    g.beginPath();
    g.moveTo(x - 0.25, 0);
    g.lineTo(x, y);
    g.moveTo(x + 0.25, Math.sign(y) * 0.15);
    g.lineTo(x, y);
    g.stroke();
  }
  tyre(1.55, 0.83, 0.68, 0.34);
  tyre(1.55, -0.83, 0.68, 0.34);
  tyre(-1.75, 0.84, 0.78, 0.42);
  tyre(-1.75, -0.84, 0.78, 0.42);
  // --- fond plat
  g.beginPath();
  g.moveTo(-2.05, -0.62);
  g.lineTo(0.9, -0.66);
  g.lineTo(1.25, -0.25);
  g.lineTo(1.25, 0.25);
  g.lineTo(0.9, 0.66);
  g.lineTo(-2.05, 0.62);
  g.closePath();
  g.fillStyle = '#1e1e1e';
  g.fill();
  // --- aileron arrière
  rr(g, -2.62, -0.8, 0.42, 1.6, 0.06);
  g.fillStyle = l.color2;
  g.fill();
  ink();
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(-2.45, -0.78, 0.05, 1.56); // fente
  g.fillStyle = INK_CSS;
  g.fillRect(-2.66, -0.86, 0.5, 0.1);
  g.fillRect(-2.66, 0.76, 0.5, 0.1);
  // --- carrosserie (pontons sculptés)
  const body = () => {
    g.beginPath();
    g.moveTo(-2.15, -0.22);
    g.bezierCurveTo(-1.9, -0.3, -1.3, -0.58, -0.75, -0.6);
    g.bezierCurveTo(-0.2, -0.62, 0.35, -0.55, 0.6, -0.3);
    g.bezierCurveTo(0.95, -0.16, 1.6, -0.14, 2.42, -0.07);
    g.lineTo(2.42, 0.07);
    g.bezierCurveTo(1.6, 0.14, 0.95, 0.16, 0.6, 0.3);
    g.bezierCurveTo(0.35, 0.55, -0.2, 0.62, -0.75, 0.6);
    g.bezierCurveTo(-1.3, 0.58, -1.9, 0.3, -2.15, 0.22);
    g.closePath();
  };
  body();
  const grd = g.createLinearGradient(0, -0.62, 0, 0.62);
  grd.addColorStop(0, shadeHex(l.color, 0.62));
  grd.addColorStop(0.32, shadeHex(l.color, 1.08));
  grd.addColorStop(0.5, shadeHex(l.color, 1.22));
  grd.addColorStop(0.68, shadeHex(l.color, 1.0));
  grd.addColorStop(1, shadeHex(l.color, 0.55));
  g.fillStyle = grd;
  g.fill();
  ink(0.08);
  // liseré secondaire le long des pontons
  g.save();
  body();
  g.clip();
  g.fillStyle = l.color2;
  g.fillRect(-2.2, -0.62, 2.9, 0.09);
  g.fillRect(-2.2, 0.53, 2.9, 0.09);
  g.restore();
  // sponsor sur les pontons
  if (l.sponsor) {
    for (const side of [-1, 1]) {
      g.save();
      g.translate(-0.75, side * 0.38);
      rr(g, -0.48, -0.1, 0.96, 0.2, 0.04);
      g.fillStyle = l.sponsorColor ?? '#ffffff';
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = 'bold 0.15px "Barlow Condensed", Arial Narrow, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(l.sponsor.toUpperCase().slice(0, 9), 0, 0.01, 0.9);
      g.restore();
    }
  }
  // capot moteur / épine dorsale
  g.beginPath();
  g.moveTo(-2.1, -0.12);
  g.quadraticCurveTo(-0.9, -0.2, -0.25, -0.2);
  g.lineTo(-0.25, 0.2);
  g.quadraticCurveTo(-0.9, 0.2, -2.1, 0.12);
  g.closePath();
  const sp = g.createLinearGradient(0, -0.2, 0, 0.2);
  sp.addColorStop(0, shadeHex(l.color, 0.85));
  sp.addColorStop(0.5, shadeHex(l.color, 1.35));
  sp.addColorStop(1, shadeHex(l.color, 0.8));
  g.fillStyle = sp;
  g.fill();
  ink(0.04);
  // numéro de course
  g.beginPath();
  g.arc(-1.2, 0, 0.17, 0, Math.PI * 2);
  g.fillStyle = '#f4f1ea';
  g.fill();
  ink(0.03);
  g.save();
  g.translate(-1.2, 0);
  g.rotate(Math.PI / 2);
  g.fillStyle = INK_CSS;
  g.font = 'bold 0.24px Bangers, Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(l.number), 0, 0.01);
  g.restore();
  // prise d'air (airbox) + caméra
  rr(g, -0.42, -0.13, 0.32, 0.26, 0.08);
  g.fillStyle = INK_CSS;
  g.fill();
  g.fillStyle = l.color2;
  g.fillRect(-0.36, -0.03, 0.2, 0.06);
  // cockpit, casque, halo
  g.beginPath();
  g.ellipse(0.15, 0, 0.42, 0.21, 0, 0, Math.PI * 2);
  g.fillStyle = '#0d0d0d';
  g.fill();
  g.beginPath();
  g.arc(0.1, 0, 0.14, 0, Math.PI * 2);
  const hg = g.createRadialGradient(0.06, -0.05, 0.02, 0.1, 0, 0.15);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(1, l.color2);
  g.fillStyle = hg;
  g.fill();
  ink(0.03);
  g.fillStyle = 'rgba(30,40,60,0.85)';
  g.fillRect(0.16, -0.08, 0.06, 0.16); // visière
  g.strokeStyle = '#3c3c3c';
  g.lineWidth = 0.07;
  g.beginPath();
  g.ellipse(0.17, 0, 0.36, 0.17, 0, 0, Math.PI * 2);
  g.moveTo(0.53, 0);
  g.lineTo(0.75, 0);
  g.stroke();
  // rétroviseurs
  for (const side of [-1, 1]) {
    g.beginPath();
    g.ellipse(0.55, side * 0.36, 0.07, 0.045, 0, 0, Math.PI * 2);
    g.fillStyle = shadeHex(l.color, 0.6);
    g.fill();
    ink(0.025);
  }
  // nez
  g.beginPath();
  g.moveTo(0.9, -0.16);
  g.quadraticCurveTo(2.0, -0.12, 2.5, -0.06);
  g.lineTo(2.5, 0.06);
  g.quadraticCurveTo(2.0, 0.12, 0.9, 0.16);
  g.closePath();
  const ng = g.createLinearGradient(0, -0.16, 0, 0.16);
  ng.addColorStop(0, shadeHex(l.color, 0.8));
  ng.addColorStop(0.5, shadeHex(l.color, 1.3));
  ng.addColorStop(1, shadeHex(l.color, 0.75));
  g.fillStyle = ng;
  g.fill();
  ink(0.05);
  g.fillStyle = l.color2;
  g.fillRect(1.2, -0.03, 1.1, 0.06);
  // aileron avant (deux éléments + dérives)
  for (const [x, w, col] of [[2.3, 0.16, l.color2], [2.47, 0.12, shadeHex(l.color2, 0.75)]] as const) {
    g.beginPath();
    g.moveTo(x, -0.98);
    g.quadraticCurveTo(x - 0.1, 0, x, 0.98);
    g.lineTo(x + w, 0.98);
    g.quadraticCurveTo(x + w - 0.1, 0, x + w, -0.98);
    g.closePath();
    g.fillStyle = col;
    g.fill();
    ink(0.04);
  }
  g.fillStyle = INK_CSS;
  g.fillRect(2.25, -1.02, 0.42, 0.08);
  g.fillRect(2.25, 0.94, 0.42, 0.08);
  // reflet principal (cel-shading)
  g.globalAlpha = 0.45;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-1.6, -0.34);
  g.quadraticCurveTo(-0.6, -0.5, 0.4, -0.38);
  g.lineTo(0.35, -0.31);
  g.quadraticCurveTo(-0.6, -0.42, -1.6, -0.27);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  return c;
}

/** Silhouette de la voiture (pour l'épaisseur 2,5D et l'ombre). */
export function paintSilhouette(S = 24): HTMLCanvasElement {
  const W = 5.6 * S, H = 2.2 * S;
  const [c, g] = canvas(W, H);
  g.translate(W / 2, H / 2);
  g.scale(S, S);
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(-2.2, -0.62);
  g.lineTo(0.9, -0.66);
  g.lineTo(2.5, -0.1);
  g.lineTo(2.5, 0.1);
  g.lineTo(0.9, 0.66);
  g.lineTo(-2.2, 0.62);
  g.closePath();
  g.fill();
  for (const [x, y, len, wid] of [[1.55, 0.83, 0.68, 0.34], [1.55, -0.83, 0.68, 0.34], [-1.75, 0.84, 0.78, 0.42], [-1.75, -0.84, 0.78, 0.42]]) {
    rr(g, x - len / 2, y - wid / 2, len, wid, 0.1);
    g.fill();
  }
  return c;
}

/** Ombre douce (dégradé radial) — étirée à la taille voulue. */
export function paintSoftShadow(size = 64): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const r = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  r.addColorStop(0, 'rgba(0,0,0,0.55)');
  r.addColorStop(0.55, 'rgba(0,0,0,0.35)');
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return c;
}

// ================================================================ Sols (motifs répétés)

export type GroundKind = 'herbe' | 'sable' | 'paves' | 'alpage';

export function paintGround(kind: GroundKind, base: string, size = 256): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rnd = prng(kind.length * 977 + size);
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  if (kind === 'herbe' || kind === 'alpage') {
    // bandes de tonte
    for (let k = 0; k < 8; k++) {
      g.fillStyle = k % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
      g.fillRect(0, (k * size) / 8, size, size / 8);
    }
    // brins et taches
    for (let i = 0; i < size * 3; i++) {
      const x = rnd() * size, y = rnd() * size;
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,40,0,0.12)' : 'rgba(255,255,200,0.08)';
      g.fillRect(x, y, 1.5, 3);
    }
    if (kind === 'alpage') {
      for (let i = 0; i < 6; i++) {
        g.fillStyle = 'rgba(120,120,110,0.25)';
        g.beginPath();
        g.ellipse(rnd() * size, rnd() * size, 6 + rnd() * 10, 3 + rnd() * 5, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (kind === 'sable') {
    g.strokeStyle = 'rgba(140,80,30,0.18)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 26; i++) {
      const x = rnd() * size, y = rnd() * size, w = 20 + rnd() * 40;
      g.beginPath();
      g.moveTo(x - w / 2, y);
      g.quadraticCurveTo(x, y - 6, x + w / 2, y);
      g.stroke();
    }
    for (let i = 0; i < size * 2; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(120,70,20,0.12)' : 'rgba(255,240,200,0.15)';
      g.fillRect(rnd() * size, rnd() * size, 1.5, 1.5);
    }
  } else {
    // pavés
    // dalles de pierre claires, joints discrets, quelques taches d'usure
    const n = 8, s = size / n;
    g.fillStyle = 'rgba(0,0,0,0.07)';
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < n; y++) {
      for (let x = -1; x < n; x++) {
        const off = y % 2 ? s / 2 : 0;
        g.fillStyle = shadeHex(base, 0.97 + rnd() * 0.07);
        g.fillRect(x * s + off + 1, y * s + 1, s - 2, s - 2);
      }
    }
    for (let i = 0; i < size; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)';
      g.fillRect(rnd() * size, rnd() * size, 2, 2);
    }
  }
  return c;
}

/** Grain d'asphalte (superposé à la piste). */
export function paintAsphalt(size = 128): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rnd = prng(4242);
  g.clearRect(0, 0, size, size);
  for (let i = 0; i < size * size * 0.12; i++) {
    const v = rnd();
    g.fillStyle = v < 0.5 ? `rgba(0,0,0,${0.08 + rnd() * 0.1})` : `rgba(255,255,255,${0.04 + rnd() * 0.07})`;
    g.fillRect(rnd() * size, rnd() * size, 1, 1);
  }
  // fissures et raccords
  g.strokeStyle = 'rgba(0,0,0,0.18)';
  g.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    let x = rnd() * size, y = rnd() * size;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rnd() - 0.5) * 18;
      y += (rnd() - 0.5) * 18;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  return c;
}

export function paintGravel(size = 128): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rnd = prng(31337);
  g.fillStyle = '#d9c9a0';
  g.fillRect(0, 0, size, size);
  for (let i = 0; i < size * 6; i++) {
    const r = 0.6 + rnd() * 1.4;
    g.fillStyle = rnd() < 0.5 ? 'rgba(110,90,60,0.45)' : 'rgba(255,250,235,0.6)';
    g.beginPath();
    g.arc(rnd() * size, rnd() * size, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

export function paintWater(size = 256, deep = '#1f5f8b', light = '#bfe1f0'): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rnd = prng(777);
  const gr = g.createLinearGradient(0, 0, 0, size);
  gr.addColorStop(0, shadeHex(deep, 1.1));
  gr.addColorStop(1, shadeHex(deep, 0.92));
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = light;
  g.lineCap = 'round';
  for (let i = 0; i < 40; i++) {
    const x = rnd() * size, y = rnd() * size, w = 8 + rnd() * 18;
    g.globalAlpha = 0.25 + rnd() * 0.45;
    g.lineWidth = 1.2 + rnd();
    g.beginPath();
    g.moveTo(x - w / 2, y);
    g.quadraticCurveTo(x, y - 3, x + w / 2, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  return c;
}

// ================================================================ Végétation et rochers

export type TreeKind = 'feuillu' | 'sapin' | 'palmier' | 'buisson' | 'cactus';

/** Arbre vu en 2,5D, ancré au pied du tronc (bas-centre). Hauteur réelle ≈ h mètres. */
export function paintTree(kind: TreeKind, palette: [string, string, string], seed: number, S = 8): { cv: HTMLCanvasElement; w: number; h: number } {
  const rnd = prng(seed * 131 + kind.length);
  const [dark, mid, light] = palette;
  if (kind === 'palmier') {
    const w = 12, h = 14;
    const [c, g] = canvas(w * S, h * S);
    g.scale(S, S);
    g.strokeStyle = '#6b4423';
    g.lineWidth = 0.6;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(6, 14);
    g.quadraticCurveTo(7.2, 8, 6.4, 3.5);
    g.stroke();
    g.strokeStyle = '#4a2e15';
    g.lineWidth = 0.15;
    for (let y = 13; y > 4; y -= 1) {
      g.beginPath();
      g.moveTo(6.1 + (14 - y) * 0.06 - 0.3, y);
      g.lineTo(6.1 + (14 - y) * 0.06 + 0.3, y - 0.2);
      g.stroke();
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + rnd() * 0.3;
      const ex = 6.4 + Math.cos(a) * 5, ey = 4 + Math.sin(a) * 2.4 + 1.2;
      g.strokeStyle = INK_CSS;
      g.lineWidth = 0.75;
      g.beginPath();
      g.moveTo(6.4, 3.5);
      g.quadraticCurveTo(6.4 + Math.cos(a) * 2.5, 2.2, ex, ey);
      g.stroke();
      g.strokeStyle = k % 2 ? mid : light;
      g.lineWidth = 0.5;
      g.stroke();
    }
    return { cv: c, w, h };
  }
  if (kind === 'cactus') {
    const w = 5, h = 6;
    const [c, g] = canvas(w * S, h * S);
    g.scale(S, S);
    const arm = (x: number, y: number, ww: number, hh: number) => {
      rr(g, x, y, ww, hh, ww / 2);
      g.fillStyle = mid;
      g.fill();
      g.lineWidth = 0.12;
      g.strokeStyle = INK_CSS;
      g.stroke();
    };
    arm(2.1, 0.6, 0.9, 5.4);
    arm(0.8, 2.2, 0.7, 2);
    arm(0.8, 3.6, 1.6, 0.6);
    arm(3.4, 1.6, 0.7, 2.2);
    arm(2.6, 3.2, 1.4, 0.6);
    g.fillStyle = light;
    g.fillRect(2.3, 1, 0.15, 4.6);
    return { cv: c, w, h };
  }
  if (kind === 'sapin') {
    const w = 8, h = 14;
    const [c, g] = canvas(w * S, h * S);
    g.scale(S, S);
    g.fillStyle = '#5a3a1e';
    g.fillRect(3.7, 11.5, 0.6, 2.5);
    for (let k = 0; k < 4; k++) {
      const top = 1 + k * 2.4, base = top + 4, half = 1.6 + k * 0.7;
      g.beginPath();
      g.moveTo(4, top);
      g.lineTo(4 + half, base);
      g.lineTo(4 - half, base);
      g.closePath();
      g.fillStyle = k % 2 ? mid : dark;
      g.fill();
      g.lineWidth = 0.14;
      g.strokeStyle = INK_CSS;
      g.stroke();
      g.beginPath();
      g.moveTo(4, top + 0.2);
      g.lineTo(4 - half * 0.7, base - 0.3);
      g.lineTo(4 - half * 0.2, base - 0.3);
      g.closePath();
      g.fillStyle = light;
      g.globalAlpha = 0.5;
      g.fill();
      g.globalAlpha = 1;
    }
    return { cv: c, w, h };
  }
  // feuillu / buisson : grappe de boules ombrées
  const big = kind === 'feuillu';
  const w = big ? 12 : 7, h = big ? 14 : 6;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  if (big) {
    g.fillStyle = '#5b3a1e';
    g.beginPath();
    g.moveTo(5.5, 14);
    g.lineTo(5.7, 8);
    g.lineTo(6.3, 8);
    g.lineTo(6.5, 14);
    g.closePath();
    g.fill();
  }
  const blobs: [number, number, number][] = [];
  const n = big ? 7 : 4;
  for (let k = 0; k < n; k++) {
    const r = big ? 2 + rnd() * 1.6 : 1.4 + rnd() * 0.8;
    blobs.push([w / 2 + (rnd() - 0.5) * w * 0.55, (big ? 5.5 : 3.6) + (rnd() - 0.5) * (big ? 5 : 2), r]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  // contour encré d'un seul tenant
  g.fillStyle = INK_CSS;
  for (const [x, y, r] of blobs) {
    g.beginPath();
    g.arc(x, y, r + 0.18, 0, Math.PI * 2);
    g.fill();
  }
  for (const [x, y, r] of blobs) {
    const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    gr.addColorStop(0, light);
    gr.addColorStop(0.55, mid);
    gr.addColorStop(1, dark);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  if (big && rnd() < 0.5) {
    // fruits / fleurs
    g.fillStyle = rnd() < 0.5 ? '#e5383b' : '#f6d55c';
    for (let k = 0; k < 6; k++) {
      g.beginPath();
      g.arc(w / 2 + (rnd() - 0.5) * 6, 4 + rnd() * 4, 0.18, 0, Math.PI * 2);
      g.fill();
    }
  }
  return { cv: c, w, h };
}

export function paintRock(color: string, seed: number, S = 8): { cv: HTMLCanvasElement; w: number; h: number } {
  const rnd = prng(seed);
  const w = 7, h = 4.5;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  const pts: [number, number][] = [];
  const n = 7;
  for (let k = 0; k < n; k++) {
    const a = Math.PI + (k / (n - 1)) * Math.PI;
    pts.push([3.5 + Math.cos(a) * (2.8 + rnd() * 0.6), 4.2 + Math.sin(a) * (3.4 + rnd() * 0.8)]);
  }
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts) g.lineTo(p[0], p[1]);
  g.closePath();
  const gr = g.createLinearGradient(0, 0, w, h);
  gr.addColorStop(0, shadeHex(color, 1.25));
  gr.addColorStop(1, shadeHex(color, 0.7));
  g.fillStyle = gr;
  g.fill();
  g.lineWidth = 0.15;
  g.strokeStyle = INK_CSS;
  g.stroke();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 0.08;
  g.beginPath();
  g.moveTo(2.5, 1.6);
  g.lineTo(3.4, 3.5);
  g.moveTo(4.6, 2);
  g.lineTo(4.2, 3.4);
  g.stroke();
  return { cv: c, w, h };
}

// ================================================================ Bâtiments

/** Immeuble 2,5D (façade + toit), ancré bas-centre. Dimensions en mètres. */
export function paintBuilding(wm: number, hm: number, depthM: number, color: string, roof: string, night: boolean, seed: number, tilt = 0.64, S = 6): { cv: HTMLCanvasElement; w: number; h: number } {
  const rnd = prng(seed);
  const depth = depthM * tilt; // profondeur au sol vue par la caméra inclinée
  const w = wm, h = hm + depth;
  const [c, g] = canvas(w * S + 4, h * S + 4);
  g.translate(2, 2);
  g.scale(S, S);
  // toit
  g.fillStyle = roof;
  g.fillRect(0, 0, wm, depth);
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(wm * 0.15, depth * 0.25, wm * 0.25, depth * 0.4); // édicule
  g.fillRect(wm * 0.6, depth * 0.3, wm * 0.15, depth * 0.3);
  g.lineWidth = 0.25;
  g.strokeStyle = INK_CSS;
  g.strokeRect(0, 0, wm, depth);
  // façade avec dégradé vertical
  const gr = g.createLinearGradient(0, depth, 0, h);
  gr.addColorStop(0, shadeHex(color, 1.05));
  gr.addColorStop(1, shadeHex(color, 0.82));
  g.fillStyle = gr;
  g.fillRect(0, depth, wm, hm);
  g.strokeRect(0, depth, wm, hm);
  // fenêtres
  const cols = Math.max(2, Math.floor(wm / 3)), rows = Math.max(2, Math.floor(hm / 3.2));
  const cw = wm / cols, rh = (hm - 3) / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const lit = night ? rnd() < 0.55 : rnd() < 0.15;
      g.fillStyle = night ? (lit ? '#ffd774' : '#1b2433') : lit ? '#9fd3ff' : '#2a3d4f';
      g.fillRect(x * cw + cw * 0.22, depth + 0.8 + y * rh + rh * 0.2, cw * 0.56, rh * 0.55);
    }
  }
  // porte et auvent
  g.fillStyle = '#3a2a20';
  g.fillRect(wm / 2 - 0.9, h - 2.4, 1.8, 2.4);
  g.fillStyle = rnd() < 0.5 ? '#d62828' : '#1f9e89';
  g.fillRect(wm / 2 - 1.6, h - 2.9, 3.2, 0.55);
  return { cv: c, w: wm + 4 / S, h: h + 4 / S };
}

/** Yacht vu de dessus (amarré au port). */
export function paintBoat(color: string, seed: number, S = 8): { cv: HTMLCanvasElement; w: number; h: number } {
  const rnd = prng(seed);
  const w = 14, h = 5;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  g.beginPath();
  g.moveTo(0.5, 2.5);
  g.quadraticCurveTo(2, 0.4, 9, 0.6);
  g.quadraticCurveTo(13.5, 1.2, 13.6, 2.5);
  g.quadraticCurveTo(13.5, 3.8, 9, 4.4);
  g.quadraticCurveTo(2, 4.6, 0.5, 2.5);
  g.closePath();
  g.fillStyle = '#f7f5ef';
  g.fill();
  g.lineWidth = 0.18;
  g.strokeStyle = INK_CSS;
  g.stroke();
  rr(g, 4, 1.4, 5 + rnd() * 2, 2.2, 0.6);
  g.fillStyle = color;
  g.fill();
  g.stroke();
  g.fillStyle = '#2a3d4f';
  g.fillRect(5, 1.8, 2.5, 1.4);
  return { cv: c, w, h };
}

// ================================================================ Tribune et stands (alignés sur la ligne droite)

/** Tribune couverte (façade vue de face), largeur en mètres. */
export function paintGrandstand(widthM: number, night: boolean, seed: number, tilt = 0.64, S = 5): { cv: HTMLCanvasElement; w: number; h: number } {
  const rnd = prng(seed);
  // gradins : 18 m de profondeur montant de 12 m → hauteur écran ≈ 18·tilt + 12 ; toit 9 m de profondeur
  const rows = 7, depth = 18 * tilt + 12, roofH = 9 * tilt;
  const w = widthM, h = depth + roofH + 1;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  const crowd = ['#d62828', '#f2c14e', '#3a86ff', '#f4f1ea', '#06d6a0', '#ff7a00', '#7b2cbf', '#e5383b', '#ffffff'];
  // gradins
  for (let r = 0; r < rows; r++) {
    const y = roofH + 1 + r * (depth / rows);
    g.fillStyle = r % 2 ? '#8a909a' : '#a2a8b2';
    g.fillRect(0, y, w, depth / rows);
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, y + depth / rows - 0.35, w, 0.35);
    for (let x = 0.6; x < w - 0.6; x += 0.75) {
      if (rnd() < 0.12) continue;
      g.fillStyle = crowd[Math.floor(rnd() * crowd.length)];
      g.beginPath();
      g.arc(x + rnd() * 0.2, y + 0.9, 0.32, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rnd() < 0.5 ? '#f1c27d' : '#8d5524';
      g.beginPath();
      g.arc(x + 0.05, y + 0.4, 0.22, 0, Math.PI * 2);
      g.fill();
    }
  }
  // escaliers
  g.fillStyle = '#6d727b';
  for (let x = w / 6; x < w; x += w / 3) g.fillRect(x - 0.6, roofH + 1, 1.2, depth);
  // toit en porte-à-faux
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, roofH, w, 3);
  const rg = g.createLinearGradient(0, 0, 0, roofH);
  rg.addColorStop(0, '#f4f1ea');
  rg.addColorStop(1, '#c9ccd1');
  g.fillStyle = rg;
  g.fillRect(0, 0, w, roofH);
  g.lineWidth = 0.3;
  g.strokeStyle = INK_CSS;
  g.strokeRect(0, 0, w, roofH);
  g.strokeRect(0, roofH + 1, w, depth);
  // poutres
  g.fillStyle = '#5d636d';
  for (let x = 0; x <= w; x += w / 8) g.fillRect(x - 0.25, roofH, 0.5, depth * 0.5);
  if (night) {
    g.fillStyle = 'rgba(255,240,190,0.9)';
    for (let x = 2; x < w; x += 6) g.fillRect(x, roofH - 0.6, 2.5, 0.4);
  }
  return { cv: c, w, h };
}

/** Garage d'écurie (façade face à la piste, rideau ouvert, enseigne aux couleurs). */
export function paintGarage(color: string, color2: string, label: string, facing: boolean, tilt = 0.64, S = 8): { cv: HTMLCanvasElement; w: number; h: number } {
  const w = 24, roofD = 10 * tilt, wallH = 6;
  const h = facing ? roofD + wallH : roofD + 1.5;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  // toit
  const rg = g.createLinearGradient(0, 0, 0, roofD);
  rg.addColorStop(0, shadeHex(color, 0.9));
  rg.addColorStop(1, shadeHex(color, 1.15));
  g.fillStyle = rg;
  g.fillRect(0, 0, w, roofD);
  g.fillStyle = color2;
  g.fillRect(0, roofD * 0.4, w, roofD * 0.2);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  for (let x = 2; x < w; x += 4) g.fillRect(x, 1, 2, roofD - 2);
  g.lineWidth = 0.25;
  g.strokeStyle = INK_CSS;
  g.strokeRect(0, 0, w, roofD);
  if (facing) {
    g.fillStyle = shadeHex(color, 0.7);
    g.fillRect(0, roofD, w, wallH);
    // rideau ouvert : intérieur sombre éclairé
    const ig = g.createLinearGradient(0, roofD + 1, 0, roofD + wallH);
    ig.addColorStop(0, '#2c2c34');
    ig.addColorStop(1, '#55555f');
    g.fillStyle = ig;
    g.fillRect(3, roofD + 1.4, w - 6, wallH - 1.4);
    g.fillStyle = 'rgba(255,250,220,0.5)';
    g.fillRect(3, roofD + 1.4, w - 6, 0.3);
    // enseigne
    g.fillStyle = INK_CSS;
    g.fillRect(w / 2 - 4, roofD + 0.2, 8, 1.1);
    g.fillStyle = '#ffffff';
    g.font = 'bold 1px "Barlow Condensed", Arial Narrow, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, w / 2, roofD + 0.78, 7.5);
    g.strokeRect(0, roofD, w, wallH);
  } else {
    g.fillStyle = shadeHex(color, 0.55);
    g.fillRect(0, roofD, w, 1.5);
  }
  return { cv: c, w, h };
}

/** Halo de vignettage (assombrit doucement les bords de l'écran). */
export function paintVignette(size = 256, strength = 0.35): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const r = g.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.72);
  r.addColorStop(0, 'rgba(0,0,0,0)');
  r.addColorStop(1, `rgba(10,8,20,${strength})`);
  g.fillStyle = r;
  g.fillRect(0, 0, size, size);
  return c;
}

/** Ombre de nuage (grande tache douce). */
export function paintCloudShadow(size = 256): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rnd = prng(99);
  for (let k = 0; k < 6; k++) {
    const x = size * (0.3 + rnd() * 0.4), y = size * (0.3 + rnd() * 0.4), r = size * (0.15 + rnd() * 0.15);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(0,0,20,0.5)');
    gr.addColorStop(1, 'rgba(0,0,20,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/** Bande de spectateurs debout derrière un grillage (vue de face), longueur en mètres. */
export function paintCrowd(lengthM: number, seed: number, S = 6): { cv: HTMLCanvasElement; w: number; h: number } {
  const rnd = prng(seed);
  const w = lengthM, h = 2.6;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  const shirts = ['#d62828', '#f2c14e', '#3a86ff', '#f4f1ea', '#06d6a0', '#ff7a00', '#7b2cbf', '#1d3557', '#e5383b'];
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  for (let row = 0; row < 2; row++) {
    for (let x = 0.3 + row * 0.25; x < w - 0.3; x += 0.55 + rnd() * 0.15) {
      const y = 0.9 + row * 0.75;
      g.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
      rr(g, x - 0.22, y, 0.44, 0.9, 0.15);
      g.fill();
      g.fillStyle = skins[Math.floor(rnd() * skins.length)];
      g.beginPath();
      g.arc(x, y - 0.12, 0.19, 0, Math.PI * 2);
      g.fill();
      if (rnd() < 0.12) {
        // drapeau ou bras levé
        g.fillStyle = shirts[Math.floor(rnd() * shirts.length)];
        g.fillRect(x + 0.15, y - 0.9, 0.5, 0.32);
        g.fillStyle = INK_CSS;
        g.fillRect(x + 0.12, y - 0.9, 0.04, 0.9);
      }
    }
  }
  return { cv: c, w, h };
}

/** Poste de commissaires (cabine orange + drapeau). */
export function paintMarshal(S = 10): { cv: HTMLCanvasElement; w: number; h: number } {
  const w = 3.2, h = 4;
  const [c, g] = canvas(w * S, h * S);
  g.scale(S, S);
  g.fillStyle = '#ff7a00';
  rr(g, 0.3, 1.6, 2.6, 2.3, 0.2);
  g.fill();
  g.lineWidth = 0.1;
  g.strokeStyle = INK_CSS;
  g.stroke();
  g.fillStyle = '#2a3d4f';
  g.fillRect(0.6, 2, 2, 0.8);
  g.fillStyle = '#f4f1ea';
  g.fillRect(0.3, 1.4, 2.6, 0.3);
  g.fillStyle = INK_CSS;
  g.fillRect(2.6, 0.1, 0.08, 1.6);
  g.fillStyle = '#ffd400';
  g.fillRect(2.68, 0.1, 0.5, 0.35);
  return { cv: c, w, h };
}

// ================================================================ Portraits de pilotes

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Portrait BD d'un pilote (buste en combinaison aux couleurs de l'écurie), unique et stable pour un identifiant.
 * `size` = côté du canevas en pixels.
 */
export function paintPortrait(id: string, color: string, color2: string, size = 128): HTMLCanvasElement {
  const rnd = prng(hashStr(id));
  const [c, g] = canvas(size, size);
  const k = size / 100;
  g.scale(k, k);
  const skins = ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#a0663c', '#8d5524', '#5c3a21'];
  const hairs = ['#16130f', '#3b2a1e', '#6b4423', '#a56b2f', '#d9a441', '#e8d3a3', '#8a3324', '#5a5a5a'];
  const skin = skins[Math.floor(rnd() * skins.length)];
  const hair = hairs[Math.floor(rnd() * hairs.length)];
  const style = Math.floor(rnd() * 5);
  // fond : disque aux couleurs de l'écurie avec trame de points
  const bg = g.createRadialGradient(50, 40, 10, 50, 50, 60);
  bg.addColorStop(0, shadeHex(color2, 1.1));
  bg.addColorStop(1, shadeHex(color2, 0.75));
  g.fillStyle = bg;
  g.fillRect(0, 0, 100, 100);
  g.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 4; y < 100; y += 6) for (let x = (y % 12) / 2; x < 100; x += 6) {
    g.beginPath();
    g.arc(x, y, 1.1, 0, Math.PI * 2);
    g.fill();
  }
  g.lineJoin = 'round';
  g.lineWidth = 2.2;
  g.strokeStyle = INK_CSS;
  // épaules : combinaison
  g.beginPath();
  g.moveTo(8, 100);
  g.quadraticCurveTo(12, 74, 34, 70);
  g.lineTo(66, 70);
  g.quadraticCurveTo(88, 74, 92, 100);
  g.closePath();
  const suit = g.createLinearGradient(0, 70, 0, 100);
  suit.addColorStop(0, shadeHex(color, 1.15));
  suit.addColorStop(1, shadeHex(color, 0.8));
  g.fillStyle = suit;
  g.fill();
  g.stroke();
  // col et bande
  g.fillStyle = color2;
  g.fillRect(40, 70, 20, 7);
  g.strokeRect(40, 70, 20, 7);
  g.fillStyle = shadeHex(color2, 0.9);
  g.fillRect(18, 84, 64, 4);
  // cou
  g.fillStyle = shadeHex(skin, 0.88);
  g.fillRect(43, 60, 14, 11);
  g.strokeRect(43, 60, 14, 11);
  // visage
  const faceW = 20 + rnd() * 3, faceH = 24 + rnd() * 3;
  g.beginPath();
  g.ellipse(50, 42, faceW, faceH, 0, 0, Math.PI * 2);
  const fg = g.createRadialGradient(44, 36, 4, 50, 42, faceH);
  fg.addColorStop(0, shadeHex(skin, 1.08));
  fg.addColorStop(1, shadeHex(skin, 0.88));
  g.fillStyle = fg;
  g.fill();
  g.stroke();
  // oreilles
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.ellipse(50 + sx * faceW, 44, 3.5, 6, 0, 0, Math.PI * 2);
    g.fillStyle = shadeHex(skin, 0.92);
    g.fill();
    g.stroke();
  }
  // cheveux
  g.fillStyle = hair;
  g.beginPath();
  if (style === 0) {
    // court
    g.ellipse(50, 26, faceW + 1, 12, 0, Math.PI, Math.PI * 2);
  } else if (style === 1) {
    // mèche
    g.moveTo(28, 34);
    g.quadraticCurveTo(30, 12, 52, 14);
    g.quadraticCurveTo(74, 14, 72, 34);
    g.quadraticCurveTo(58, 22, 40, 30);
  } else if (style === 2) {
    // long
    g.moveTo(27, 60);
    g.quadraticCurveTo(22, 14, 50, 14);
    g.quadraticCurveTo(78, 14, 73, 60);
    g.lineTo(68, 60);
    g.quadraticCurveTo(70, 30, 50, 26);
    g.quadraticCurveTo(30, 30, 32, 60);
  } else if (style === 3) {
    // boucles
    for (let a = Math.PI; a <= Math.PI * 2.01; a += Math.PI / 6) {
      g.moveTo(50 + Math.cos(a) * 21 + 5, 30 + Math.sin(a) * 15);
      g.arc(50 + Math.cos(a) * 21, 30 + Math.sin(a) * 15, 5, 0, Math.PI * 2);
    }
  } else {
    // rasé sur les côtés
    g.ellipse(50, 22, 14, 9, 0, Math.PI, Math.PI * 2);
  }
  g.fill();
  g.lineWidth = 1.6;
  g.stroke();
  // sourcils, yeux, nez, bouche
  const eyeY = 42;
  g.strokeStyle = INK_CSS;
  g.lineWidth = 2;
  const brow = rnd() < 0.5 ? -1 : 1;
  for (const sx of [-1, 1]) {
    g.beginPath();
    g.moveTo(50 + sx * 6, eyeY - 7 + (brow > 0 ? 0 : 1));
    g.lineTo(50 + sx * 14, eyeY - 8 - (brow > 0 ? 1 : 0));
    g.stroke();
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(50 + sx * 9, eyeY, 3.6, 2.6, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = rnd() < 0.5 ? '#3b2a1e' : '#2f5d8a';
    g.beginPath();
    g.arc(50 + sx * 9 + 0.6, eyeY + 0.3, 1.7, 0, Math.PI * 2);
    g.fill();
  }
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(50, eyeY + 2);
  g.lineTo(48, eyeY + 10);
  g.lineTo(51.5, eyeY + 10.5);
  g.stroke();
  const smile = rnd();
  g.beginPath();
  if (smile < 0.6) {
    g.moveTo(43, eyeY + 16);
    g.quadraticCurveTo(50, eyeY + 21, 57, eyeY + 16);
  } else {
    g.moveTo(44, eyeY + 17);
    g.lineTo(56, eyeY + 16);
  }
  g.stroke();
  // barbe ou lunettes à l'occasion
  const extra = rnd();
  if (extra < 0.18) {
    g.fillStyle = hair;
    g.globalAlpha = 0.7;
    g.beginPath();
    g.moveTo(32, 48);
    g.quadraticCurveTo(50, 78, 68, 48);
    g.quadraticCurveTo(50, 66, 32, 48);
    g.fill();
    g.globalAlpha = 1;
  } else if (extra < 0.3) {
    g.lineWidth = 1.6;
    for (const sx of [-1, 1]) {
      g.beginPath();
      g.arc(50 + sx * 9, eyeY, 5.5, 0, Math.PI * 2);
      g.stroke();
    }
    g.beginPath();
    g.moveTo(46, eyeY);
    g.lineTo(54, eyeY);
    g.stroke();
  }
  // reflet BD
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.beginPath();
  g.ellipse(40, 30, 5, 3, -0.5, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Nappes de brouillard (blanches, douces). */
export function paintFog(size = 256): HTMLCanvasElement {
  const [c, g] = canvas(size, size);
  const rnd = prng(2024);
  for (let k = 0; k < 7; k++) {
    const x = size * (0.2 + rnd() * 0.6), y = size * (0.3 + rnd() * 0.4), r = size * (0.18 + rnd() * 0.18);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(235,240,245,0.75)');
    gr.addColorStop(1, 'rgba(235,240,245,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, size, size);
  }
  return c;
}

/** Lumière de fin de journée : ciel chaud en haut de l'écran, voile doré. */
export function paintSunset(w = 64, h = 256): HTMLCanvasElement {
  const [c, g] = canvas(w, h);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, 'rgba(255,120,40,0.42)');
  gr.addColorStop(0.35, 'rgba(255,150,70,0.18)');
  gr.addColorStop(1, 'rgba(120,40,120,0.12)');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  return c;
}
