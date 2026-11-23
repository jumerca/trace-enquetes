// Peinture procédurale des assets isolés (Canvas 2D) : tuiles raccordables, végétation, bâtiments,
// personnages, animaux et véhicules. Tous les éléments partagent la même caméra isométrique (2:1),
// la même lumière (haut-gauche) et la même palette, puis sont regroupés en atlas par atlas.ts.
// Ce sont des assets ORIGINAUX générés par code — provisoires en attendant des illustrations peintes.
import { hash2 } from '../core/rng';

export const TW = 64; // largeur d'une case (px monde)
export const TH = 32;
export let RES = 2; // sur-échantillonnage des peintures (netteté au zoom)
export function setPaintRes(r: number) {
  RES = r;
}
/** Peinture en miroir (orientation 1) : tout est inversé sauf les textes des enseignes. */
let MIRROR = false;

export type Season = 0 | 1 | 2 | 3;
type Ctx = CanvasRenderingContext2D;

export interface Painted {
  canvas: HTMLCanvasElement;
  ax: number; // ancre (px monde, depuis le coin haut-gauche) = point posé au sol
  ay: number;
}

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * RES);
  c.height = Math.ceil(h * RES);
  const ctx = c.getContext('2d')!;
  ctx.scale(RES, RES);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

// ————— couleurs —————
export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a), y = p(b);
  const c = x.map((v, i) => Math.round(v + (y[i] - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Petit générateur local, stable pour un identifiant d'asset donné. */
function rnd(seed: number) {
  let i = 0;
  return () => hash2(seed, i++, 9173);
}

const SEASON_GRASS = [
  { base: '#7fae4a', dark: '#5f8f34', light: '#a3c862', flower: ['#f7f1e3', '#f4d24a', '#e98fb8'] },
  { base: '#8fae45', dark: '#6c8c30', light: '#b6c95e', flower: ['#f4d24a', '#f7f1e3', '#c9a0e8'] },
  { base: '#9a9f4c', dark: '#77783a', light: '#c0b467', flower: ['#d88b3c', '#c9662f'] },
  { base: '#8f9a7c', dark: '#6f7a62', light: '#c8cfc0', flower: [] },
];

// ————— géométrie isométrique —————
const DIAMOND = (ctx: Ctx, ox: number, oy: number, grow = 0.6) => {
  ctx.beginPath();
  ctx.moveTo(ox + TW / 2, oy - grow);
  ctx.lineTo(ox + TW + grow * 2, oy + TH / 2);
  ctx.lineTo(ox + TW / 2, oy + TH + grow);
  ctx.lineTo(ox - grow * 2, oy + TH / 2);
  ctx.closePath();
};

/** Points d'une face : iso(gx, gy, z) relatif à une origine écran. */
export const iso = (ox: number, oy: number, gx: number, gy: number, z = 0): [number, number] => [ox + (gx - gy) * (TW / 2), oy + (gx + gy) * (TH / 2) - z];

function poly(ctx: Ctx, pts: [number, number][]) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

// ————— tuiles de sol —————
function grassTexture(ctx: Ctx, seed: number, season: Season, kind: 'herbe' | 'pre' | 'bois' | 'verger' | 'enclos') {
  const P = SEASON_GRASS[season];
  const r = rnd(seed);
  const base = kind === 'pre' ? mix(P.base, '#c7b55a', 0.22) : kind === 'bois' ? mix(P.dark, '#5b4a2e', 0.35) : kind === 'verger' ? mix(P.base, P.light, 0.18) : kind === 'enclos' ? mix(P.base, '#a08a5a', 0.35) : P.base;
  const g = ctx.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, shade(base, 0.06));
  g.addColorStop(1, shade(base, -0.05));
  ctx.fillStyle = g;
  ctx.fillRect(-4, -4, TW + 8, TH + 8);
  // taches douces
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = r() < 0.5 ? shade(base, -0.08) : shade(base, 0.07);
    ctx.globalAlpha = 0.35;
    ctx.beginPath();
    ctx.ellipse(r() * TW, r() * TH, 6 + r() * 10, 3 + r() * 5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // brins d'herbe
  const n = kind === 'pre' ? 70 : kind === 'bois' ? 30 : kind === 'enclos' ? 25 : 55;
  for (let i = 0; i < n; i++) {
    const x = r() * TW, y = r() * TH;
    const h = (kind === 'pre' ? 3.5 : 2.2) + r() * 2;
    ctx.strokeStyle = r() < 0.55 ? P.dark : P.light;
    ctx.globalAlpha = 0.55 + r() * 0.4;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 1.6, y - h);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  if (kind === 'bois') {
    // feuilles mortes et aiguilles
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = ['#8a5a2b', '#a8763a', '#6b4a26', '#7c8a3a'][Math.floor(r() * 4)];
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.ellipse(r() * TW, r() * TH, 1.4, 0.8, r() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (kind === 'enclos') {
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = '#9b7b4c';
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.ellipse(r() * TW, r() * TH, 5 + r() * 6, 2 + r() * 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#e2c46c';
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 14; i++) {
      const x = r() * TW, y = r() * TH;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3 * (r() - 0.5), y + 1.5 * (r() - 0.5));
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  if (season === 3 && kind !== 'bois') {
    // givre
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 24; i++) {
      ctx.globalAlpha = 0.35 + r() * 0.3;
      ctx.fillRect(r() * TW, r() * TH, 1.2, 1.2);
    }
    ctx.globalAlpha = 1;
  }
  // fleurs
  const fl = P.flower;
  const nf = kind === 'pre' ? 9 : kind === 'herbe' ? 3 : 0;
  for (let i = 0; i < nf && fl.length; i++) {
    if (r() < 0.4) continue;
    ctx.fillStyle = fl[Math.floor(r() * fl.length)];
    const x = r() * TW, y = r() * TH;
    ctx.beginPath();
    ctx.arc(x, y, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

export type TileKind = 'herbe' | 'pre' | 'bois' | 'cour' | 'chemin' | 'route' | 'eau' | 'pont' | 'champ' | 'verger' | 'enclos';

// voisins : bit 1 = +x (bas-droite), 2 = +y (bas-gauche), 4 = −x (haut-gauche), 8 = −y (haut-droite)
const EDGE_MID: [number, number][] = [
  [TW * 0.75, TH * 0.75],
  [TW * 0.25, TH * 0.75],
  [TW * 0.25, TH * 0.25],
  [TW * 0.75, TH * 0.25],
];
const EDGE_SEG: [[number, number], [number, number]][] = [
  [[TW, TH / 2], [TW / 2, TH]],
  [[TW / 2, TH], [0, TH / 2]],
  [[0, TH / 2], [TW / 2, 0]],
  [[TW / 2, 0], [TW, TH / 2]],
];

function track(ctx: Ctx, mask: number, width: number, color: string, edge: string, seed: number) {
  const cx = TW / 2, cy = TH / 2;
  const legs = [0, 1, 2, 3].filter((i) => mask & (1 << i));
  const draw = (w: number, col: string) => {
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = w;
    for (const i of legs) {
      const [mx, my] = EDGE_MID[i];
      // prolonge au-delà du bord pour un raccord parfait avec la case voisine
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx + (mx - cx) * 0.6, my + (my - cy) * 0.6);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.ellipse(cx, cy, w * 0.62, w * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  ctx.save();
  ctx.transform(1, 0, 0, 1, 0, 0);
  draw(width + 3, edge);
  draw(width, color);
  // gravillons
  const r = rnd(seed);
  for (let i = 0; i < 26; i++) {
    const x = r() * TW, y = r() * TH;
    ctx.fillStyle = r() < 0.5 ? shade(color, 0.18) : shade(color, -0.15);
    ctx.globalAlpha = 0.65;
    ctx.fillRect(x, y, 1.1, 0.9);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function waterTile(ctx: Ctx, mask: number, seed: number, season: Season) {
  const r = rnd(seed);
  const g = ctx.createLinearGradient(0, 0, 0, TH);
  const deep = season === 3 ? '#5d8fa8' : '#3f8fb5';
  g.addColorStop(0, shade(deep, 0.12));
  g.addColorStop(1, shade(deep, -0.06));
  ctx.fillStyle = g;
  ctx.fillRect(-4, -4, TW + 8, TH + 8);
  for (let i = 0; i < 6; i++) {
    const x = r() * TW, y = r() * TH;
    ctx.strokeStyle = '#d8f1ff';
    ctx.globalAlpha = 0.35 + r() * 0.35;
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.quadraticCurveTo(x, y - 1.2, x + 4, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // berges sur les bords sans eau
  const P = SEASON_GRASS[season];
  for (let i = 0; i < 4; i++) {
    if (mask & (1 << i)) continue;
    const [a, b] = EDGE_SEG[i];
    const cx = TW / 2, cy = TH / 2;
    const inset = (p: [number, number], k: number): [number, number] => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k];
    ctx.fillStyle = '#c9b27c';
    poly(ctx, [a, b, inset(b, 0.42), inset(a, 0.42)]);
    ctx.fill();
    ctx.fillStyle = P.base;
    poly(ctx, [a, b, inset(b, 0.3), inset(a, 0.3)]);
    ctx.fill();
    // roseaux
    for (let k = 0; k < 5; k++) {
      const t = r();
      const p = inset([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], 0.3);
      ctx.strokeStyle = r() < 0.5 ? '#5f7f34' : '#7c8f3e';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(p[0] + (r() - 0.5) * 2, p[1] - 4 - r() * 3);
      ctx.stroke();
    }
    // reflet sombre le long de la berge
    ctx.strokeStyle = 'rgba(20,50,70,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const p1 = inset(a, 0.44), p2 = inset(b, 0.44);
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.stroke();
  }
}

function fieldTile(ctx: Ctx, stage: number, seed: number) {
  // stage : 0 labour, 1 levée, 2 vert, 3 épiaison, 4 mûr, 5 chaume
  const r = rnd(seed);
  ctx.fillStyle = stage === 5 ? '#b89a58' : '#8a6a44';
  ctx.fillRect(-4, -4, TW + 8, TH + 8);
  // sillons parallèles à l'axe x (pente 1/2)
  for (let k = -6; k < 10; k++) {
    const oy = k * 4.2;
    ctx.strokeStyle = stage === 5 ? '#a88a48' : '#6f5436';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(0, oy);
    ctx.lineTo(TW, oy + TH / 2);
    ctx.stroke();
    if (stage === 0) continue;
    const col = stage === 1 ? '#8dbb4f' : stage === 2 ? '#6fa23a' : stage === 3 ? '#a9b64a' : stage === 4 ? '#e0b64a' : '#d9c27a';
    const h = stage === 1 ? 2 : stage === 2 ? 5 : stage === 3 ? 6.5 : stage === 4 ? 7 : 1.5;
    for (let s = 0; s < 16; s++) {
      const t = (s + r() * 0.6) / 16;
      const x = t * TW, y = oy + t * (TH / 2) - 1;
      ctx.strokeStyle = shade(col, (r() - 0.5) * 0.25);
      ctx.lineWidth = stage >= 3 && stage < 5 ? 1.3 : 1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (r() - 0.5) * 1.5, y - h);
      ctx.stroke();
      if (stage === 4 || stage === 3) {
        ctx.fillStyle = stage === 4 ? '#f2d36d' : '#c4c25c';
        ctx.beginPath();
        ctx.ellipse(x, y - h, 0.9, 1.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

export function paintTile(kind: TileKind, variant: number, season: Season, mask = 0, stage = 0): HTMLCanvasElement {
  const pad = 1;
  const [c, ctx] = canvas(TW + pad * 2, TH + pad * 2);
  ctx.translate(pad, pad);
  DIAMOND(ctx, 0, 0);
  ctx.save();
  ctx.clip();
  const seed = variant * 31 + mask * 7 + season * 1000 + kind.length * 97;
  if (kind === 'herbe' || kind === 'pre' || kind === 'bois' || kind === 'verger' || kind === 'enclos') grassTexture(ctx, seed, season, kind);
  else if (kind === 'cour') {
    grassTexture(ctx, seed, season, 'herbe');
    ctx.save();
    ctx.fillStyle = '#cdb88e';
    ctx.fillRect(-4, -4, TW + 8, TH + 8);
    const r = rnd(seed);
    for (let i = 0; i < 9; i++) {
      // pavés et dalles calcaires
      const x = r() * TW, y = r() * TH;
      ctx.fillStyle = shade('#d9c9a2', (r() - 0.5) * 0.2);
      ctx.beginPath();
      ctx.ellipse(x, y, 4 + r() * 3, 2 + r() * 1.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(110,90,60,0.35)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() < 0.5 ? '#b49d72' : '#e6d8b6';
      ctx.fillRect(r() * TW, r() * TH, 1, 1);
    }
    ctx.restore();
    // bordure enherbée le long des bords donnant sur le jardin (bande perpendiculaire : raccord rectiligne)
    for (let i = 0; i < 4; i++) {
      if (!(mask & (1 << i))) continue;
      const [a, b] = EDGE_SEG[i];
      const ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
      let nx = -ey / L, ny = ex / L;
      if ((TW / 2 - a[0]) * nx + (TH / 2 - a[1]) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const d = 4.5;
      ctx.save();
      poly(ctx, [a, b, [b[0] + nx * d, b[1] + ny * d], [a[0] + nx * d, a[1] + ny * d]]);
      ctx.clip();
      grassTexture(ctx, seed + i, season, 'herbe');
      ctx.restore();
      ctx.strokeStyle = 'rgba(120,100,60,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(a[0] + nx * d, a[1] + ny * d);
      ctx.lineTo(b[0] + nx * d, b[1] + ny * d);
      ctx.stroke();
    }
  } else if (kind === 'chemin') {
    grassTexture(ctx, seed, season, 'herbe');
    track(ctx, mask, 11, season === 3 ? '#a8977c' : '#b8956a', SEASON_GRASS[season].dark, seed);
  } else if (kind === 'route') {
    grassTexture(ctx, seed, season, 'herbe');
    track(ctx, mask, 17, '#c8bca0', '#8f8a74', seed);
  } else if (kind === 'eau') waterTile(ctx, mask, seed, season);
  else if (kind === 'pont') {
    waterTile(ctx, 15, seed, season);
    // tablier de bois dans l'axe de la route
    const alongX = mask & 5;
    ctx.save();
    ctx.translate(TW / 2, TH / 2);
    ctx.transform(1, alongX ? 0.5 : -0.5, alongX ? -1 : 1, alongX ? 0.5 : 0.5, 0, 0);
    ctx.fillStyle = '#8a6440';
    ctx.fillRect(-26, -9, 52, 18);
    for (let k = -24; k < 26; k += 4) {
      ctx.fillStyle = k % 8 ? '#a07a50' : '#93704a';
      ctx.fillRect(k, -9, 3.4, 18);
    }
    ctx.fillStyle = '#5c4026';
    ctx.fillRect(-26, -10, 52, 2);
    ctx.fillRect(-26, 8, 52, 2);
    ctx.restore();
  } else if (kind === 'champ') fieldTile(ctx, stage, seed);
  ctx.restore();
  return c;
}

// ————— végétation —————
export interface TreeStyle {
  species: 'chene' | 'chataignier' | 'noyer' | 'pin' | 'bouleau' | 'cypres' | 'buisson' | 'pommier';
}

const LEAF = {
  chene: [['#8cc25a', '#5f9a3a', '#3f6e2a'], ['#6a9a3a', '#4c7a2c', '#2f5222'], ['#d49a3a', '#b86a28', '#7f4a22'], null],
  chataignier: [['#9ccb60', '#6ea03e', '#46702c'], ['#79a845', '#56842f', '#355a24'], ['#e0b04a', '#c27c2c', '#8a5224'], null],
  noyer: [['#a5cf6c', '#79a84a', '#4d7432'], ['#86b056', '#5f8a3c', '#3c5e2a'], ['#e6c45a', '#c8962e', '#8a6426'], null],
  bouleau: [['#b5d870', '#8bbb4c', '#5f8f36'], ['#9cc85a', '#73a240', '#4d752e'], ['#f0d25a', '#d4aa34', '#9a7424'], null],
  buisson: [['#86b84e', '#5e9236', '#3d6626'], ['#6e9e3e', '#4f7c2e', '#325424'], ['#b9883a', '#8f6a2c', '#5f4a22'], ['#6f7c55', '#566246', '#3c4632']],
  pommier: [['#9ccb62', '#70a443', '#4a7630'], ['#6fa13f', '#4f812f', '#335a24'], ['#b9b04a', '#93883a', '#62602c'], null],
  pin: [['#4f7a44', '#365c34', '#1f3d26']],
  cypres: [['#4c7a3e', '#33592d', '#1d3a20']],
};

function blob(ctx: Ctx, x: number, y: number, rx: number, ry: number, cols: string[], r: () => number, n = 14) {
  // feuillage en grappes : ombre, masse, lumière (haut-gauche)
  const layers = [
    { c: cols[2], dx: 1.5, dy: 2, k: 1 },
    { c: cols[1], dx: 0, dy: 0, k: 0.92 },
    { c: cols[0], dx: -rx * 0.22, dy: -ry * 0.25, k: 0.55 },
  ];
  for (const L of layers) {
    ctx.fillStyle = L.c;
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * L.k;
      const px = x + L.dx + Math.cos(a) * rx * d * 0.75, py = y + L.dy + Math.sin(a) * ry * d * 0.75;
      ctx.beginPath();
      ctx.arc(px, py, (rx * 0.32 + r() * rx * 0.18) * (0.7 + L.k * 0.3), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function groundShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, alpha = 0.28) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(30,40,20,${alpha})`);
  g.addColorStop(1, 'rgba(30,40,20,0)');
  ctx.fillStyle = g;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function branches(ctx: Ctx, x: number, y: number, h: number, spread: number, r: () => number, col = '#6b5238') {
  ctx.strokeStyle = col;
  const rec = (sx: number, sy: number, ang: number, len: number, w: number, depth: number) => {
    const ex = sx + Math.cos(ang) * len, ey = sy + Math.sin(ang) * len;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    if (depth <= 0) return;
    rec(ex, ey, ang - 0.45 - r() * 0.3, len * 0.72, w * 0.65, depth - 1);
    rec(ex, ey, ang + 0.45 + r() * 0.3, len * 0.72, w * 0.65, depth - 1);
  };
  rec(x, y, -Math.PI / 2, h * 0.45, spread, 4);
}

/** fruit : 0..3 (quantité de pommes visibles) */
export function paintTree(species: TreeStyle['species'], variant: number, season: Season, fruit = 0): Painted {
  const r = rnd(variant * 131 + season * 7 + species.length * 13 + fruit * 1009);
  const big = species === 'chataignier' || species === 'chene' ? 1.15 : species === 'pommier' ? 0.72 : species === 'buisson' ? 0.5 : 1;
  const W = 96 * big + 10, H = (species === 'pin' || species === 'cypres' ? 130 : 112) * big + 10;
  const [c, ctx] = canvas(W, H);
  const bx = W / 2, by = H - 10;
  const sz = (0.85 + r() * 0.3) * big;
  groundShadow(ctx, bx + 6, by, 26 * sz, 11 * sz);
  if (species === 'pin' || species === 'cypres') {
    const cols = LEAF[species][0];
    ctx.fillStyle = '#5a4030';
    ctx.fillRect(bx - 2, by - 22 * sz, 4, 22 * sz);
    if (species === 'cypres') {
      const h = 92 * sz, w = 13 * sz;
      for (const [col, dx, k] of [[cols[2], 1.5, 1], [cols[1], 0, 0.9], [cols[0], -3, 0.5]] as [string, number, number][]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(bx + dx, by - h);
        ctx.bezierCurveTo(bx + dx + w * k * 1.3, by - h * 0.6, bx + dx + w * k, by - 10, bx + dx, by - 4);
        ctx.bezierCurveTo(bx + dx - w * k, by - 10, bx + dx - w * k * 1.3, by - h * 0.6, bx + dx, by - h);
        ctx.fill();
      }
      // texture
      for (let i = 0; i < 40; i++) {
        ctx.fillStyle = r() < 0.5 ? cols[2] : cols[0];
        ctx.globalAlpha = 0.5;
        const t = r();
        ctx.beginPath();
        ctx.arc(bx + (r() - 0.5) * w * 1.6 * Math.sin(t * Math.PI), by - 8 - t * (h - 12), 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const y = by - 22 * sz - t * 70 * sz;
        const w = (30 - t * 22) * sz;
        for (const [col, dx, dy] of [[cols[2], 2, 3], [cols[1], 0, 0], [cols[0], -w * 0.25, -2]] as [string, number, number][]) {
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(bx + dx - w, y + dy + 4);
          ctx.quadraticCurveTo(bx + dx, y + dy + 9, bx + dx + w, y + dy + 4);
          ctx.lineTo(bx + dx + w * 0.1, y + dy - 22 * sz);
          ctx.closePath();
          if (col === cols[0]) {
            ctx.globalAlpha = 0.55;
            ctx.fill();
            ctx.globalAlpha = 1;
          } else ctx.fill();
        }
      }
      if (season === 3) {
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        for (let i = 0; i < layers; i++) {
          const y = by - 26 * sz - (i / layers) * 70 * sz;
          ctx.beginPath();
          ctx.ellipse(bx - 3, y, 8 * sz * (1 - i / layers), 2, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    return { canvas: c, ax: bx, ay: by };
  }
  const leaves = (LEAF[species] as (string[] | null)[])[season];
  const trunkH = species === 'buisson' ? 0 : species === 'pommier' ? 22 * sz : 34 * sz;
  const crownR = species === 'buisson' ? 20 * sz : species === 'bouleau' ? 22 * sz : species === 'pommier' ? 24 * sz : 30 * sz;
  const trunkCol = species === 'bouleau' ? '#e9e4d6' : '#6b5238';
  if (trunkH) {
    ctx.fillStyle = trunkCol;
    ctx.beginPath();
    ctx.moveTo(bx - 4 * sz, by);
    ctx.lineTo(bx - 2.2 * sz, by - trunkH);
    ctx.lineTo(bx + 2.2 * sz, by - trunkH);
    ctx.lineTo(bx + 4 * sz, by);
    ctx.fill();
    ctx.fillStyle = species === 'bouleau' ? '#3a3a3a' : 'rgba(0,0,0,0.18)';
    if (species === 'bouleau') for (let i = 0; i < 5; i++) ctx.fillRect(bx - 2, by - r() * trunkH, 3, 1);
    else ctx.fillRect(bx + 0.8 * sz, by - trunkH, 2.4 * sz, trunkH);
  }
  const cy = by - trunkH - crownR * 0.55;
  if (!leaves) {
    branches(ctx, bx, by - trunkH + 4, crownR * 2, 3 * sz, r, species === 'bouleau' ? '#d8d2c2' : '#5e4834');
    if (season === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 12; i++) ctx.fillRect(bx + (r() - 0.5) * crownR * 1.6, cy + (r() - 0.5) * crownR, 2.5, 1);
    }
  } else {
    blob(ctx, bx, cy, crownR, crownR * 0.85, leaves, r, species === 'buisson' ? 9 : 16);
    if (species === 'pommier') {
      if (season === 0) {
        // floraison
        for (let i = 0; i < 40; i++) {
          ctx.fillStyle = r() < 0.6 ? '#fbeff3' : '#f2b6c8';
          ctx.beginPath();
          ctx.arc(bx + (r() - 0.5) * crownR * 1.7, cy + (r() - 0.5) * crownR * 1.4, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const nApples = [0, 6, 14, 24][fruit];
      for (let i = 0; i < nApples; i++) {
        const ax = bx + (r() - 0.5) * crownR * 1.6, ay = cy + (r() - 0.35) * crownR * 1.2;
        ctx.fillStyle = r() < 0.75 ? '#d2322a' : '#e8a32a';
        ctx.beginPath();
        ctx.arc(ax, ay, 2.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(ax - 1, ay - 1.2, 0.9, 0.9);
      }
    }
  }
  return { canvas: c, ax: bx, ay: by };
}

export function paintRock(variant: number, season: Season): Painted {
  const r = rnd(variant * 17 + 5);
  const [c, ctx] = canvas(56, 40);
  const bx = 28, by = 32;
  groundShadow(ctx, bx + 4, by, 22, 8);
  for (let i = 0; i < 3; i++) {
    const x = bx + (i - 1) * 9 + r() * 4, y = by - 6 + r() * 4;
    const rx = 9 + r() * 7, ry = 7 + r() * 5;
    ctx.fillStyle = '#8f8a80';
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b6b0a3';
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.25, y - ry * 0.35, rx * 0.6, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = season === 3 ? '#f4f6f8' : '#7b9a4a';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.ellipse(x - 2, y - ry * 0.7, rx * 0.4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
  return { canvas: c, ax: bx, ay: by };
}

export function paintFlowers(variant: number, season: Season): Painted {
  const r = rnd(variant * 41 + season);
  const [c, ctx] = canvas(56, 32);
  const cols = season === 0 ? ['#f2b6c8', '#fbeff3', '#f4d24a', '#b48de0'] : season === 1 ? ['#9a6fd0', '#b48de0', '#f4d24a', '#e9506a'] : season === 2 ? ['#d88b3c', '#c9662f', '#e8c04a'] : [];
  for (let i = 0; i < 26 && cols.length; i++) {
    const x = 8 + r() * 40, y = 8 + r() * 18;
    ctx.strokeStyle = '#5f8f34';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = cols[Math.floor(r() * cols.length)];
    ctx.beginPath();
    ctx.arc(x, y, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas: c, ax: 28, ay: 22 };
}

export function paintLavender(variant: number, season: Season): Painted {
  const r = rnd(variant * 59 + 3);
  const [c, ctx] = canvas(60, 40);
  const bx = 30, by = 30;
  groundShadow(ctx, bx + 3, by, 24, 8, 0.2);
  for (let row = 0; row < 3; row++)
    for (let k = 0; k < 4; k++) {
      const x = bx - 16 + k * 10 + row * 4 - 4, y = by - 8 + row * 5 - k * 2;
      ctx.fillStyle = season === 3 ? '#8a8f78' : '#6f8a5a';
      ctx.beginPath();
      ctx.ellipse(x, y, 5, 3.4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (season === 1 || season === 0) {
        for (let i = 0; i < 9; i++) {
          ctx.strokeStyle = r() < 0.5 ? '#8a66c8' : '#a888e0';
          ctx.lineWidth = 1.4;
          const px = x + (r() - 0.5) * 8;
          ctx.beginPath();
          ctx.moveTo(px, y - 1);
          ctx.lineTo(px + (r() - 0.5) * 2, y - 6 - r() * 3);
          ctx.stroke();
        }
      }
    }
  return { canvas: c, ax: bx, ay: by };
}

export function paintProp(kind: 'puits' | 'foin' | 'charrette'): Painted {
  const [c, ctx] = canvas(64, 70);
  const bx = 32, by = 58;
  groundShadow(ctx, bx + 4, by, 22, 8, 0.28);
  if (kind === 'puits') {
    ctx.fillStyle = '#b8a582';
    ctx.beginPath();
    ctx.ellipse(bx, by - 4, 13, 6, 0, 0, Math.PI);
    ctx.lineTo(bx - 13, by - 16);
    ctx.ellipse(bx, by - 16, 13, 6, 0, Math.PI, 0, true);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(90,70,50,0.35)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.ellipse(bx, by - 7 - i * 4, 13, 6, 0, 0.15, Math.PI - 0.15);
      ctx.stroke();
    }
    ctx.fillStyle = '#d6c6a0';
    ctx.beginPath();
    ctx.ellipse(bx, by - 16, 13, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#223844';
    ctx.beginPath();
    ctx.ellipse(bx, by - 16, 9.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(bx - 12, by - 42, 2.4, 26);
    ctx.fillRect(bx + 10, by - 42, 2.4, 26);
    ctx.fillStyle = '#a94e34';
    ctx.beginPath();
    ctx.moveTo(bx - 17, by - 38);
    ctx.lineTo(bx, by - 50);
    ctx.lineTo(bx + 17, by - 38);
    ctx.lineTo(bx + 14, by - 36);
    ctx.lineTo(bx, by - 46);
    ctx.lineTo(bx - 14, by - 36);
    ctx.fill();
    ctx.strokeStyle = '#5a3c22';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by - 32);
    ctx.lineTo(bx + 10, by - 32);
    ctx.stroke();
    ctx.fillStyle = '#8a6440';
    ctx.fillRect(bx - 3, by - 31, 6, 6);
  } else if (kind === 'foin') {
    hayBale(ctx, bx - 8, by);
    hayBale(ctx, bx + 7, by + 2);
    hayBale(ctx, bx, by - 8);
  } else {
    // charrette de pommes
    ctx.fillStyle = '#8a6440';
    ctx.beginPath();
    ctx.moveTo(bx - 20, by - 18);
    ctx.lineTo(bx + 14, by - 26);
    ctx.lineTo(bx + 20, by - 16);
    ctx.lineTo(bx - 14, by - 8);
    ctx.fill();
    ctx.fillStyle = '#a07a50';
    ctx.beginPath();
    ctx.moveTo(bx - 14, by - 8);
    ctx.lineTo(bx + 20, by - 16);
    ctx.lineTo(bx + 20, by - 11);
    ctx.lineTo(bx - 14, by - 3);
    ctx.fill();
    ctx.fillStyle = '#d2322a';
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.arc(bx - 14 + (i % 8) * 4 + Math.floor(i / 8) * 3, by - 15 - (i % 8) * 1 - Math.floor(i / 8) * 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#4a3020';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(bx + 2, by - 6, 4.5, 7, -0.4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bx - 20, by - 14);
    ctx.lineTo(bx - 30, by - 8);
    ctx.stroke();
  }
  return { canvas: c, ax: bx, ay: by };
}

// ————— bâtiments —————
export interface HouseOpts {
  size: number; // emprise (cases)
  inset: number; // retrait des murs (cases)
  wallH: number;
  roofH: number;
  wall: string; // pierre
  roof: string; // tuiles
  shutters: string;
  stories: number;
  hip: boolean;
  door: 'arche' | 'grange' | 'simple' | 'vitrine';
  seed: number;
  chimneys?: number;
  vine?: boolean;
  open?: boolean; // hangar ouvert
  roofKind?: 'tuiles' | 'tole' | 'ardoise';
}

function stoneWall(ctx: Ctx, w: number, h: number, base: string, r: () => number, light: number) {
  ctx.fillStyle = shade(base, light);
  ctx.fillRect(0, 0, w, h);
  // moellons calcaires
  for (let y = 0; y < h; y += 4.2) {
    let x = -r() * 6;
    while (x < w) {
      const sw = 4 + r() * 6;
      ctx.fillStyle = shade(base, light + (r() - 0.5) * 0.22);
      ctx.beginPath();
      ctx.roundRect(x + 0.4, y + 0.4, sw - 0.8, 3.4, 1.2);
      ctx.fill();
      x += sw;
    }
  }
  ctx.fillStyle = 'rgba(80,60,40,0.10)';
  ctx.fillRect(0, h - 5, w, 5);
}

function windowAt(ctx: Ctx, x: number, y: number, w: number, h: number, shutters: string, lit = false) {
  ctx.fillStyle = '#e8dcc0';
  ctx.fillRect(x - 1.2, y - 1.2, w + 2.4, h + 2.4);
  ctx.fillStyle = lit ? '#ffd889' : '#3b4a55';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x + 0.6, y + 0.6, w * 0.4, h * 0.35);
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h * 0.45);
  ctx.lineTo(x + w, y + h * 0.45);
  ctx.stroke();
  // volets
  ctx.fillStyle = shutters;
  ctx.fillRect(x - w * 0.5 - 1.2, y - 0.5, w * 0.5, h + 1);
  ctx.fillRect(x + w + 1.2, y - 0.5, w * 0.5, h + 1);
  ctx.strokeStyle = shade(shutters, -0.3);
  ctx.lineWidth = 0.4;
  for (let k = 1; k < 4; k++) {
    const yy = y + (h * k) / 4;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.5 - 1.2, yy);
    ctx.lineTo(x - 1.2, yy);
    ctx.moveTo(x + w + 1.2, yy);
    ctx.lineTo(x + w * 1.5 + 1.2, yy);
    ctx.stroke();
  }
  // appui fleuri
  ctx.fillStyle = '#b07848';
  ctx.fillRect(x - 0.5, y - 2.5, w + 1, 1.6);
}

function doorAt(ctx: Ctx, kind: HouseOpts['door'], x: number, w: number, h: number) {
  if (kind === 'grange') {
    ctx.fillStyle = '#6e4a2c';
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h - w * 0.35);
    ctx.quadraticCurveTo(x + w / 2, h + w * 0.1, x + w, h - w * 0.35);
    ctx.lineTo(x + w, 0);
    ctx.fill();
    ctx.strokeStyle = '#4e3420';
    ctx.lineWidth = 0.8;
    for (let k = 1; k < 6; k++) {
      ctx.beginPath();
      ctx.moveTo(x + (w * k) / 6, 0);
      ctx.lineTo(x + (w * k) / 6, h * 0.85);
      ctx.stroke();
    }
    ctx.strokeStyle = '#c8b48c';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x - 1, h - w * 0.35);
    ctx.quadraticCurveTo(x + w / 2, h + w * 0.12, x + w + 1, h - w * 0.35);
    ctx.stroke();
    return;
  }
  ctx.fillStyle = kind === 'vitrine' ? '#3b4a55' : '#7a4f2e';
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, h - (kind === 'arche' ? w / 2 : 0));
  if (kind === 'arche') ctx.arc(x + w / 2, h - w / 2, w / 2, Math.PI, 0, true);
  else ctx.lineTo(x + w, h);
  ctx.lineTo(x + w, 0);
  ctx.fill();
  if (kind === 'vitrine') {
    ctx.fillStyle = 'rgba(255,230,170,0.55)';
    ctx.fillRect(x + 1, 2, w - 2, h - 4);
  }
  ctx.strokeStyle = '#d9c9a2';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

/**
 * Bâtiment générique en pierre. Origine = sommet haut de l'emprise.
 * La porte est sur la face avant-gauche (+y) ; l'orientation 1 est obtenue par symétrie du sprite.
 */
export function paintHouse(o: HouseOpts, extras?: (ctx: Ctx, ox: number, oy: number, P: (gx: number, gy: number, z?: number) => [number, number]) => void): Painted {
  const r = rnd(o.seed);
  const s = o.size, m = o.inset;
  const W = s * TW + 44;
  const top = o.wallH + o.roofH + 26;
  const H = s * TH + top + 6;
  const [c, ctx] = canvas(W, H);
  if (MIRROR) {
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
  }
  const ox = W / 2, oy = top;
  const P = (gx: number, gy: number, z = 0) => iso(ox, oy, gx, gy, z);
  const a = m, b = s - m, hw = o.wallH;
  // ombre portée au sol (lumière haut-gauche)
  ctx.fillStyle = 'rgba(40,40,20,0.22)';
  poly(ctx, [P(b, a), P(b + 0.55, a + 0.35), P(b + 0.55, b + 0.35), P(a + 0.3, b + 0.35), P(a, b)]);
  ctx.fill();
  if (o.open) {
    // hangar ouvert : poteaux et charpente
    const posts: [number, number][] = [[a, a], [b, a], [a, b], [b, b], [(a + b) / 2, b], [b, (a + b) / 2]];
    ctx.fillStyle = 'rgba(60,40,20,0.25)';
    poly(ctx, [P(a, a), P(b, a), P(b, b), P(a, b)]);
    ctx.fill();
    for (const [gx, gy] of posts) {
      const [x, y] = P(gx, gy);
      ctx.fillStyle = '#6b4a2c';
      ctx.fillRect(x - 2, y - hw, 4, hw);
      ctx.fillStyle = '#8a6440';
      ctx.fillRect(x - 2, y - hw, 1.5, hw);
    }
    // balles de foin au fond
    for (let i = 0; i < 4; i++) {
      const [x, y] = P(a + 0.4 + (i % 2) * 0.7, a + 0.4 + Math.floor(i / 2) * 0.5);
      hayBale(ctx, x, y);
    }
  } else {
    const face = (side: 'L' | 'R', draw: (w: number, h: number) => void) => {
      ctx.save();
      const len = b - a;
      const mx = MIRROR ? -1 : 1, W0 = MIRROR ? W * RES : 0;
      if (side === 'L') {
        const [x0, y0] = P(a, b);
        ctx.setTransform(RES * mx, RES * 0.5, 0, RES, W0 + x0 * RES * mx, y0 * RES);
      } else {
        const [x0, y0] = P(b, b);
        ctx.setTransform(RES * mx, -RES * 0.5, 0, RES, W0 + x0 * RES * mx, y0 * RES);
      }
      // repère : x vers la droite (px écran), y vers le bas ; le mur va de y=-hw à 0
      ctx.translate(0, -hw);
      draw(len * (TW / 2), hw);
      ctx.restore();
    };
    face('L', (w, h) => {
      stoneWall(ctx, w, h, o.wall, r, 0.02);
      const n = Math.max(1, Math.round(w / 26));
      for (let st = 0; st < o.stories; st++) {
        const wy = st === 0 ? h - 24 : h - 24 - st * 26;
        for (let i = 0; i < n + 1; i++) {
          const wx = ((i + 0.5) * w) / (n + 1) - 4;
          if (st === 0 && Math.abs(wx + 4 - w / 2) < (o.door === 'grange' ? 20 : 12)) continue;
          if (wy < 4) continue;
          windowAt(ctx, wx, wy, 8, 11, o.shutters);
        }
      }
    });
    face('R', (w, h) => {
      stoneWall(ctx, w, h, o.wall, r, -0.14);
      const n = Math.max(1, Math.round(w / 30));
      for (let st = 0; st < o.stories; st++) {
        const wy = st === 0 ? h - 24 : h - 24 - st * 26;
        if (wy < 4) continue;
        for (let i = 0; i < n; i++) windowAt(ctx, ((i + 0.5) * w) / n - 4, wy, 8, 11, shade(o.shutters, -0.12));
      }
    });
  }
  // portes : redessinées au pied du mur (repère correct)
  if (!o.open) {
    ctx.save();
    const [x0, y0] = P(a, b);
    const mx = MIRROR ? -1 : 1, W0 = MIRROR ? W * RES : 0;
    ctx.setTransform(RES * mx, RES * 0.5, 0, -RES, W0 + x0 * RES * mx, y0 * RES);
    const w = (b - a) * (TW / 2);
    if (o.door === 'grange') doorAt(ctx, 'grange', w / 2 - 13, 26, hw * 0.78);
    else doorAt(ctx, o.door, w / 2 - 7, 14, 22);
    ctx.restore();
  }
  // toit
  const ov = 0.18; // débord
  const A = a - ov, B = b + ov;
  const zr = hw, zt = hw + o.roofH;
  const roofCol = o.roofKind === 'tole' ? '#7d7a74' : o.roofKind === 'ardoise' ? '#5a6068' : o.roof;
  const tiles = (pts: [number, number][], shadeAmt: number, rows: number) => {
    // pts : bas-gauche, bas-droite, haut-droite, haut-gauche
    poly(ctx, pts);
    ctx.fillStyle = shade(roofCol, shadeAmt);
    ctx.fill();
    ctx.save();
    poly(ctx, pts);
    ctx.clip();
    const lerp = (p: [number, number], q: [number, number], t: number): [number, number] => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    ctx.lineWidth = 0.8;
    for (let k = 1; k < rows; k++) {
      const t = k / rows;
      const p = lerp(pts[0], pts[3], t), q = lerp(pts[1], pts[2], t);
      ctx.strokeStyle = shade(roofCol, shadeAmt - 0.22);
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
    const cols = Math.round(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]) / 3.6);
    for (let k = 0; k <= cols; k++) {
      const t = k / cols;
      const p = lerp(pts[0], pts[1], t), q = lerp(pts[3], pts[2], t);
      ctx.strokeStyle = o.roofKind === 'tole' ? shade(roofCol, shadeAmt + 0.12) : shade(roofCol, shadeAmt + (k % 2 ? 0.1 : -0.12));
      ctx.lineWidth = o.roofKind === 'tole' ? 0.6 : 1.4;
      ctx.beginPath();
      ctx.moveTo(p[0], p[1]);
      ctx.lineTo(q[0], q[1]);
      ctx.stroke();
    }
    // tuiles dépareillées
    if (o.roofKind !== 'tole')
      for (let i = 0; i < 18; i++) {
        const u = r(), v = r();
        const p = lerp(lerp(pts[0], pts[1], u), lerp(pts[3], pts[2], u), v);
        ctx.fillStyle = shade(roofCol, shadeAmt + (r() - 0.5) * 0.35);
        ctx.fillRect(p[0] - 1.6, p[1] - 0.8, 3.2, 1.8);
      }
    ctx.restore();
    ctx.strokeStyle = shade(roofCol, -0.45);
    ctx.lineWidth = 0.9;
    poly(ctx, pts);
    ctx.stroke();
  };
  const mid = (a + b) / 2;
  const rows = Math.max(4, Math.round(o.roofH / 4));
  if (o.hip) {
    const inset = Math.min(0.9, (b - a) * 0.3);
    const R1 = P(mid - (b - a) / 2 + inset, mid, zt), R2 = P(mid + (b - a) / 2 - inset, mid, zt);
    // pan arrière (visible en partie) puis pans avant
    tiles([P(A, A, zr), P(B, A, zr), R2, R1], -0.2, rows);
    tiles([P(A, B, zr), P(A, A, zr), R1, R1], -0.08, rows); // croupe gauche
    tiles([P(A, B, zr), P(B, B, zr), R2, R1], 0.04, rows); // pan avant
    tiles([P(B, B, zr), P(B, A, zr), R2, R2], -0.16, rows); // croupe droite
  } else {
    // pignon : faîtage le long de x
    const R1 = P(A, mid, zt), R2 = P(B, mid, zt);
    tiles([P(A, A, zr), P(B, A, zr), R2, R1], -0.22, rows);
    // pignon droit (mur)
    if (!o.open) {
      ctx.fillStyle = shade(o.wall, -0.18);
      poly(ctx, [P(b, b, zr), P(b, a, zr), P(b, mid, zt - 2)]);
      ctx.fill();
    }
    tiles([P(A, B, zr), P(B, B, zr), R2, R1], 0.05, rows);
    // rive du pignon
    ctx.strokeStyle = shade(roofCol, -0.4);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(...P(B, B, zr));
    ctx.lineTo(...R2);
    ctx.lineTo(...P(B, A, zr));
    ctx.stroke();
  }
  // faîtage
  ctx.strokeStyle = shade(roofCol, -0.25);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  if (o.hip) {
    const inset = Math.min(0.9, (b - a) * 0.3);
    ctx.moveTo(...P(mid - (b - a) / 2 + inset, mid, zt));
    ctx.lineTo(...P(mid + (b - a) / 2 - inset, mid, zt));
  } else {
    ctx.moveTo(...P(A, mid, zt));
    ctx.lineTo(...P(B, mid, zt));
  }
  ctx.stroke();
  // cheminées
  for (let i = 0; i < (o.chimneys ?? 0); i++) {
    const gx = a + (b - a) * (i === 0 ? 0.25 : 0.78), gy = mid - 0.15;
    const [x, y] = P(gx, gy, zt - 4);
    ctx.fillStyle = shade(o.wall, -0.05);
    ctx.fillRect(x - 4, y - 14, 8, 16);
    ctx.fillStyle = shade(o.wall, -0.25);
    ctx.fillRect(x + 1, y - 14, 3, 16);
    ctx.fillStyle = shade(roofCol, -0.1);
    ctx.fillRect(x - 5, y - 16, 10, 3);
  }
  // glycine / vigne grimpante
  if (o.vine) {
    for (let i = 0; i < 30; i++) {
      const t = r();
      const [x, y] = P(a + t * (b - a), b, hw - 4 - r() * 10);
      ctx.fillStyle = r() < 0.55 ? '#5f8f34' : '#86b84e';
      ctx.beginPath();
      ctx.arc(x, y, 2 + r() * 1.5, 0, Math.PI * 2);
      ctx.fill();
      if (r() < 0.45) {
        ctx.fillStyle = r() < 0.5 ? '#9a7ad0' : '#b79ae6';
        ctx.beginPath();
        ctx.ellipse(x, y + 3, 1.6, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  extras?.(ctx, ox, oy, P);
  return { canvas: c, ax: ox, ay: oy };
}

export function hayBale(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#d8b75a';
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 7, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8cd78';
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 6, 4, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#b08f3c';
  ctx.lineWidth = 0.7;
  ctx.beginPath();
  ctx.ellipse(x, y - 5, 7, 5, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function barrel(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#8a5a32';
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 5, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a7703f';
  ctx.fillRect(x - 4, y - 12, 3, 12);
  ctx.strokeStyle = '#3d3a36';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 9);
  ctx.lineTo(x + 5, y - 9);
  ctx.moveTo(x - 5, y - 3);
  ctx.lineTo(x + 5, y - 3);
  ctx.stroke();
}

export function crate(ctx: Ctx, x: number, y: number, fruit: string | null) {
  ctx.fillStyle = '#b08850';
  ctx.fillRect(x - 6, y - 7, 12, 7);
  ctx.fillStyle = '#9a7442';
  ctx.fillRect(x - 6, y - 4, 12, 1);
  if (fruit) {
    ctx.fillStyle = fruit;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(x - 4 + i * 2, y - 8, 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function pot(ctx: Ctx, x: number, y: number, col: string) {
  ctx.fillStyle = '#b8643c';
  ctx.beginPath();
  ctx.moveTo(x - 3.5, y - 6);
  ctx.lineTo(x + 3.5, y - 6);
  ctx.lineTo(x + 2.5, y);
  ctx.lineTo(x - 2.5, y);
  ctx.fill();
  ctx.fillStyle = '#5f8f34';
  ctx.beginPath();
  ctx.arc(x, y - 8, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x - 3 + i * 1.5, y - 9 - (i % 2) * 2, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function sign(ctx: Ctx, x: number, y: number, text: string) {
  ctx.fillStyle = '#5a3c22';
  ctx.fillRect(x - 0.8, y - 16, 1.6, 16);
  ctx.fillStyle = '#7a5230';
  ctx.beginPath();
  ctx.roundRect(x - 16, y - 24, 32, 10, 2);
  ctx.fill();
  ctx.fillStyle = '#f3e6c4';
  ctx.font = 'bold 6.5px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.save();
  if (MIRROR) {
    ctx.translate(x, 0);
    ctx.scale(-1, 1);
    ctx.translate(-x, 0);
  }
  ctx.fillText(text, x, y - 16.8);
  ctx.restore();
}

function parasol(ctx: Ctx, x: number, y: number, col: string) {
  ctx.fillStyle = '#6b5238';
  ctx.fillRect(x - 0.6, y - 20, 1.2, 20);
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 17);
  ctx.quadraticCurveTo(x, y - 27, x + 13, y - 17);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(x - 13, y - 17);
  ctx.quadraticCurveTo(x - 6, y - 24, x, y - 24.5);
  ctx.lineTo(x, y - 17);
  ctx.fill();
  // table
  ctx.fillStyle = '#e9e2d0';
  ctx.beginPath();
  ctx.ellipse(x, y - 6, 6, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a7a60';
  ctx.fillRect(x - 0.6, y - 6, 1.2, 6);
}

const WALL = '#d9c39a';
const WALL_WARM = '#d6b98a';
const ROOF = '#b8553a';
const BLUE = '#6f93b4';

export function paintBuilding(type: string, mirrored = false): Painted {
  MIRROR = mirrored;
  try {
    return paintBuildingInner(type);
  } finally {
    MIRROR = false;
  }
}

function paintBuildingInner(type: string): Painted {
  switch (type) {
    case 'maison':
      return paintHouse({ size: 3, inset: 0.28, wallH: 52, roofH: 26, wall: WALL, roof: ROOF, shutters: BLUE, stories: 2, hip: true, door: 'arche', seed: 11, chimneys: 2, vine: true }, (ctx, _ox, _oy, P) => {
        pot(ctx, ...P(0.6, 2.95), '#e9506a');
        pot(ctx, ...P(2.6, 2.95), '#b48de0');
        pot(ctx, ...P(2.95, 2.5), '#f4d24a');
      });
    case 'grange':
      return paintHouse({ size: 3, inset: 0.22, wallH: 40, roofH: 30, wall: WALL_WARM, roof: '#a94e34', shutters: '#7a5a3a', stories: 1, hip: false, door: 'grange', seed: 23 }, (ctx, _ox, _oy, P) => {
        hayBale(ctx, ...P(2.95, 1.0));
        hayBale(ctx, ...P(2.95, 1.6));
        crate(ctx, ...P(0.5, 2.98), '#d2322a');
      });
    case 'hangar':
      return paintHouse({ size: 3, inset: 0.15, wallH: 36, roofH: 16, wall: WALL, roof: ROOF, shutters: BLUE, stories: 0, hip: false, door: 'simple', seed: 31, open: true, roofKind: 'tole' });
    case 'pressoir':
      return paintHouse({ size: 2, inset: 0.18, wallH: 30, roofH: 20, wall: WALL, roof: ROOF, shutters: '#7d9a5a', stories: 1, hip: false, door: 'grange', seed: 41 }, (ctx, _ox, _oy, P) => {
        barrel(ctx, ...P(1.95, 0.7));
        barrel(ctx, ...P(1.95, 1.2));
        crate(ctx, ...P(0.3, 1.95), '#d2322a');
        crate(ctx, ...P(1.55, 1.98), '#e8a32a');
        sign(ctx, ...P(0.15, 1.98), 'PRESSOIR');
      });
    case 'fromagerie':
      return paintHouse({ size: 2, inset: 0.18, wallH: 32, roofH: 18, wall: '#e6dcc4', roof: '#9c5a3c', shutters: '#5f8aa8', stories: 1, hip: true, door: 'arche', seed: 53 }, (ctx, _ox, _oy, P) => {
        for (const [gx, gy] of [[1.95, 0.6], [1.95, 0.95]] as [number, number][]) {
          const [x, y] = P(gx, gy);
          ctx.fillStyle = '#c9ccd0';
          ctx.fillRect(x - 3, y - 10, 6, 10);
          ctx.fillStyle = '#a7aab0';
          ctx.fillRect(x - 3.5, y - 11, 7, 2);
        }
        sign(ctx, ...P(0.2, 1.98), 'FROMAGES');
      });
    case 'moulin':
      return paintHouse({ size: 2, inset: 0.18, wallH: 46, roofH: 18, wall: '#cdb890', roof: '#8a4a32', shutters: '#7a5a3a', stories: 2, hip: false, door: 'simple', seed: 61 }, (ctx, _ox, _oy, P) => {
        // roue à aubes sur la face droite
        const [x, y] = P(1.85, 1.0, 16);
        ctx.save();
        ctx.translate(x + 4, y);
        ctx.scale(0.55, 1);
        ctx.strokeStyle = '#5c4026';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.stroke();
        for (let k = 0; k < 12; k++) {
          const ang = (k / 12) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * 17, Math.sin(ang) * 17);
          ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#efe7d8';
        ctx.beginPath();
        ctx.ellipse(...P(0.4, 2.1), 6, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        sign(ctx, ...P(1.4, 2.05), 'MOULIN');
      });
    case 'boulangerie':
      return paintHouse({ size: 2, inset: 0.2, wallH: 30, roofH: 18, wall: WALL_WARM, roof: ROOF, shutters: '#b2563a', stories: 1, hip: false, door: 'vitrine', seed: 71, chimneys: 1 }, (ctx, _ox, _oy, P) => {
        // four à pain en dôme
        const [x, y] = P(1.98, 1.3);
        ctx.fillStyle = '#c9a77a';
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 7, 10, 9, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#2a1a10';
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 4, 4, 3.5, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ff9a3a';
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.ellipse(x + 4, y - 3, 2.6, 2, 0, Math.PI, 0);
        ctx.fill();
        ctx.globalAlpha = 1;
        crate(ctx, ...P(0.4, 1.98), '#d39a52');
        sign(ctx, ...P(1.5, 2.02), 'PAIN');
      });
    case 'boutique':
      return paintHouse({ size: 2, inset: 0.2, wallH: 30, roofH: 18, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: true, door: 'vitrine', seed: 83 }, (ctx, _ox, _oy, P) => {
        // auvent rayé sur la face avant
        const a = 0.25, b = 1.75;
        const p1 = P(a, 1.8, 24), p2 = P(b, 1.8, 24), p3 = P(b, 2.35, 16), p4 = P(a, 2.35, 16);
        ctx.save();
        poly(ctx, [p1, p2, p3, p4]);
        ctx.clip();
        for (let k = 0; k < 10; k++) {
          const t0 = k / 10, t1 = (k + 1) / 10;
          ctx.fillStyle = k % 2 ? '#f4eee0' : '#c8443a';
          poly(ctx, [P(a + (b - a) * t0, 1.8, 24), P(a + (b - a) * t1, 1.8, 24), P(a + (b - a) * t1, 2.35, 16), P(a + (b - a) * t0, 2.35, 16)]);
          ctx.fill();
        }
        ctx.restore();
        // étal
        const [sx, sy] = P(1.0, 2.25);
        ctx.fillStyle = '#8a6440';
        ctx.fillRect(sx - 14, sy - 8, 28, 3);
        crate(ctx, sx - 8, sy - 7, '#d2322a');
        crate(ctx, sx + 6, sy - 7, '#e8c04a');
        sign(ctx, ...P(1.98, 0.4), 'BOUTIQUE');
        pot(ctx, ...P(0.2, 2.1), '#e9506a');
      });
    case 'accueil':
      return paintHouse({ size: 2, inset: 0.32, wallH: 26, roofH: 16, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: true, door: 'arche', seed: 97, vine: true }, (ctx, _ox, _oy, P) => {
        parasol(ctx, ...P(1.95, 1.5), '#e9e2d0');
        parasol(ctx, ...P(1.4, 2.0), '#c8443a');
        sign(ctx, ...P(0.25, 1.95), 'ACCUEIL');
        pot(ctx, ...P(1.95, 0.4), '#b48de0');
      });
    case 'hameau0':
      return paintHouse({ size: 2, inset: 0.25, wallH: 30, roofH: 20, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: false, door: 'simple', seed: 101, chimneys: 1 });
    case 'hameau1':
      return paintHouse({ size: 2, inset: 0.25, wallH: 38, roofH: 18, wall: WALL_WARM, roof: '#a94e34', shutters: '#8aa06a', stories: 2, hip: true, door: 'arche', seed: 103, vine: true });
    case 'abri':
      return paintHouse({ size: 1, inset: 0.08, wallH: 16, roofH: 10, wall: '#b08a5a', roof: '#a94e34', shutters: BLUE, stories: 0, hip: false, door: 'simple', seed: 107, open: true });
  }
  throw new Error('bâtiment inconnu ' + type);
}

// ————— clôtures —————
/** sides : bits 1 +x, 2 +y, 4 −x, 8 −y (bords de la case où poser la clôture) */
export function paintFence(sides: number, season: Season): Painted {
  const [c, ctx] = canvas(TW + 4, TH + 24);
  const ox = TW / 2 + 2, oy = 20;
  const P = (gx: number, gy: number, z = 0) => iso(ox, oy, gx, gy, z);
  const edges: [number, number, number, number][] = [];
  if (sides & 8) edges.push([0, 0, 1, 0]);
  if (sides & 4) edges.push([0, 0, 0, 1]);
  if (sides & 1) edges.push([1, 0, 1, 1]);
  if (sides & 2) edges.push([0, 1, 1, 1]);
  const wood = season === 3 ? '#7a6a58' : '#8a6440';
  for (const [x0, y0, x1, y1] of edges) {
    for (const z of [5, 10]) {
      ctx.strokeStyle = shade(wood, z === 10 ? 0.1 : -0.05);
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(...P(x0, y0, z));
      ctx.lineTo(...P(x1, y1, z));
      ctx.stroke();
    }
    for (let k = 0; k <= 2; k++) {
      const t = k / 2;
      const [x, y] = P(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
      ctx.fillStyle = shade(wood, -0.2);
      ctx.fillRect(x - 1.2, y - 12, 2.4, 12);
    }
  }
  return { canvas: c, ax: ox, ay: oy + TH / 2 };
}

// ————— personnages —————
export interface Look {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  hat?: 'paille' | 'beret' | 'casquette' | 'toque' | null;
  apron?: string;
  pack?: string;
  child?: boolean;
  dress?: boolean;
}

export const ROLE_LOOKS: Record<string, Look> = {
  cultivateur: { shirt: '#4f7fb0', pants: '#5a4a3a', skin: '#e2b48c', hair: '#5a3a24', hat: 'paille' },
  eleveur: { shirt: '#6f8f4a', pants: '#3f4a5a', skin: '#c9946a', hair: '#2a2420', hat: 'beret' },
  artisan: { shirt: '#c8b89a', pants: '#4a4038', skin: '#e8bc96', hair: '#8a5a34', hat: 'casquette', apron: '#f3efe6' },
  vendeur: { shirt: '#b2563a', pants: '#3a3a44', skin: '#f0c8a4', hair: '#3a2a1e', apron: '#3f5f7a' },
};
export const VISITOR_LOOKS: Look[] = [
  { shirt: '#e2a23a', pants: '#3f5f8a', skin: '#f0c8a4', hair: '#6a4a2a', pack: '#4a6a8a' },
  { shirt: '#f4eee0', pants: '#8a6a4a', skin: '#c9946a', hair: '#1e1a18', hat: 'paille', dress: true },
  { shirt: '#7aa8c8', pants: '#e8e2d0', skin: '#e8bc96', hair: '#c8a060' },
  { shirt: '#c85a6a', pants: '#3a3a44', skin: '#a8724a', hair: '#1e1a18', dress: true },
  { shirt: '#5f8f6a', pants: '#5a4a3a', skin: '#f0c8a4', hair: '#8a5a34', child: true },
  { shirt: '#e9d24a', pants: '#4a6a8a', skin: '#e2b48c', hair: '#3a2a1e', child: true, pack: '#c8443a' },
];

/**
 * Personnage. facing 0 = de face (vers le bas de l'écran), 1 = de dos.
 * frame : 0 repos, 1 pas gauche, 2 pas droit, 3 travail A, 4 travail B
 */
export function paintPerson(look: Look, facing: 0 | 1, frame: number): Painted {
  const [c, ctx] = canvas(28, 44);
  const k = look.child ? 0.74 : 1;
  const bx = 14, by = 40;
  groundShadow(ctx, bx + 1, by, 8 * k, 3 * k, 0.35);
  ctx.save();
  ctx.translate(bx, by);
  ctx.scale(k, k);
  const step = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  const work = frame >= 3;
  // jambes
  ctx.strokeStyle = look.pants;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(-2, -12);
  ctx.lineTo(-2 + step * 2.4, -1);
  ctx.moveTo(2, -12);
  ctx.lineTo(2 - step * 2.4, -1);
  ctx.stroke();
  ctx.fillStyle = '#3a2a1e';
  ctx.fillRect(-3.6 + step * 2.4, -2, 3.4, 2);
  ctx.fillRect(0.4 - step * 2.4, -2, 3.4, 2);
  // corps
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  if (look.dress) {
    ctx.moveTo(-5, -24);
    ctx.lineTo(5, -24);
    ctx.lineTo(7, -9);
    ctx.lineTo(-7, -9);
  } else {
    ctx.moveTo(-5, -24);
    ctx.lineTo(5, -24);
    ctx.lineTo(5.4, -11);
    ctx.lineTo(-5.4, -11);
  }
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(1.5, -24, 3.5, 13);
  if (look.apron && facing === 0) {
    ctx.fillStyle = look.apron;
    ctx.fillRect(-4, -20, 8, 11);
  }
  if (look.pack && facing === 1) {
    ctx.fillStyle = look.pack;
    ctx.beginPath();
    ctx.roundRect(-4.5, -23, 9, 10, 2);
    ctx.fill();
  }
  // bras
  ctx.strokeStyle = look.shirt;
  ctx.lineWidth = 2.6;
  const swing = step * 2.2;
  ctx.beginPath();
  if (work) {
    const lift = frame === 3 ? -6 : -2;
    ctx.moveTo(-5, -22);
    ctx.lineTo(-6, -16 + lift);
    ctx.moveTo(5, -22);
    ctx.lineTo(6, -18 + lift);
  } else {
    ctx.moveTo(-5.2, -22);
    ctx.lineTo(-6 - swing * 0.3, -13 + swing);
    ctx.moveTo(5.2, -22);
    ctx.lineTo(6 + swing * 0.3, -13 - swing);
  }
  ctx.stroke();
  ctx.fillStyle = look.skin;
  if (work) {
    ctx.beginPath();
    ctx.arc(-6, frame === 3 ? -22 : -18, 1.5, 0, Math.PI * 2);
    ctx.arc(6, frame === 3 ? -24 : -20, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // tête
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(0, -28.5, 4.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = look.hair;
  ctx.beginPath();
  if (facing === 0) ctx.arc(0, -30, 4.8, Math.PI * 1.05, Math.PI * 1.95);
  else ctx.arc(0, -28.5, 4.9, 0, Math.PI * 2);
  ctx.fill();
  if (facing === 0) {
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(-2, -29, 1.1, 1.3);
    ctx.fillRect(1, -29, 1.1, 1.3);
  }
  if (look.hat === 'paille') {
    ctx.fillStyle = '#e8cd78';
    ctx.beginPath();
    ctx.ellipse(0, -32, 8, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -34, 4.2, 3, 0, Math.PI, 0);
    ctx.fill();
    ctx.fillStyle = '#b2563a';
    ctx.fillRect(-4.2, -33.5, 8.4, 1.1);
  } else if (look.hat === 'beret') {
    ctx.fillStyle = '#2a2a34';
    ctx.beginPath();
    ctx.ellipse(0.6, -32.6, 5.4, 2.6, -0.15, 0, Math.PI * 2);
    ctx.fill();
  } else if (look.hat === 'casquette') {
    ctx.fillStyle = '#5a6a4a';
    ctx.beginPath();
    ctx.ellipse(0, -32.4, 4.8, 2.6, 0, Math.PI, 0);
    ctx.fill();
    if (facing === 0) ctx.fillRect(-4, -32.6, 8, 1.4);
  }
  ctx.restore();
  return { canvas: c, ax: bx, ay: by };
}

/** Charge portée (panier, caisse, bidon…) */
export function paintCarry(kind: string): Painted {
  const [c, ctx] = canvas(16, 14);
  if (kind === 'lait') {
    ctx.fillStyle = '#c9ccd0';
    ctx.fillRect(4, 3, 8, 10);
    ctx.fillStyle = '#a7aab0';
    ctx.fillRect(3.5, 2, 9, 2);
  } else if (kind === 'ble' || kind === 'farine') {
    ctx.fillStyle = kind === 'ble' ? '#d8b75a' : '#efe7d8';
    ctx.beginPath();
    ctx.roundRect(3, 2, 10, 11, 3);
    ctx.fill();
    ctx.strokeStyle = '#9a8a6a';
    ctx.lineWidth = 0.6;
    ctx.stroke();
  } else {
    const fruit = kind === 'pommes' ? '#d2322a' : kind === 'jus' ? '#e8a32a' : kind === 'pain' ? '#c88a4a' : kind === 'fromage' ? '#f0e0a8' : null;
    crate(ctx, 8, 13, null);
    if (fruit) {
      ctx.fillStyle = fruit;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        if (kind === 'jus') ctx.rect(3.5 + i * 2.6, 1.5, 1.8, 5);
        else ctx.arc(4 + i * 2.6, 5.5, 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return { canvas: c, ax: 8, ay: 13 };
}

// ————— animaux —————
export function paintGoat(look: number, facing: 0 | 1, frame: number): Painted {
  const [c, ctx] = canvas(30, 26);
  const coat = ['#f2ede2', '#c9a27a', '#6a5040'][look % 3];
  const bx = 15, by = 22;
  groundShadow(ctx, bx, by, 9, 3, 0.3);
  const leg = frame ? 1.6 : -1.6;
  ctx.strokeStyle = shade(coat, -0.3);
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  for (const [x, d] of [[-6, leg], [-3, -leg], [4, leg], [7, -leg]]) {
    ctx.moveTo(bx + x, by - 7);
    ctx.lineTo(bx + x + d * 0.6, by - 0.5);
  }
  ctx.stroke();
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(bx, by - 10, 9, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(coat, -0.12);
  ctx.beginPath();
  ctx.ellipse(bx + 1, by - 8.5, 8, 3, 0, 0, Math.PI);
  ctx.fill();
  // tête (à droite : de face vers le spectateur si facing 0)
  const hx = facing === 0 ? bx + 9 : bx - 9;
  ctx.fillStyle = coat;
  ctx.beginPath();
  ctx.ellipse(hx, by - 15, 3.6, 3, facing === 0 ? 0.5 : -0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a7a60';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(hx - 1, by - 17);
  ctx.quadraticCurveTo(hx - 3, by - 22, hx - 5, by - 20);
  ctx.stroke();
  ctx.fillStyle = '#2a1a10';
  if (facing === 0) ctx.fillRect(hx + 0.8, by - 16, 1, 1);
  ctx.fillStyle = shade(coat, -0.2);
  ctx.beginPath();
  ctx.moveTo(hx, by - 12.5);
  ctx.lineTo(hx + 0.6, by - 9.5);
  ctx.lineTo(hx - 0.6, by - 12);
  ctx.fill();
  return { canvas: c, ax: bx, ay: by };
}

export function paintHen(look: number, frame: number): Painted {
  const [c, ctx] = canvas(16, 16);
  const col = ['#f2ede2', '#b8643c', '#3a3030'][look % 3];
  groundShadow(ctx, 8, 14, 5, 2, 0.3);
  ctx.strokeStyle = '#d8a030';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(7, 11);
  ctx.lineTo(7 + (frame ? 0.8 : -0.8), 14);
  ctx.moveTo(9, 11);
  ctx.lineTo(9 - (frame ? 0.8 : -0.8), 14);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(8, 9, 4.5, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(11.5, 6, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8322a';
  ctx.fillRect(11, 3, 1.6, 1.6);
  ctx.fillStyle = '#e8a030';
  ctx.beginPath();
  ctx.moveTo(13.4, 6);
  ctx.lineTo(15, 6.6);
  ctx.lineTo(13.4, 7.2);
  ctx.fill();
  return { canvas: c, ax: 8, ay: 14 };
}

// ————— véhicules —————
/** facing 0 = roule vers le bas-droite (+x), 1 = vers le haut-droite (−y). Symétrie pour les deux autres. */
export function paintTractor(facing: 0 | 1, loaded: boolean): Painted {
  const [c, ctx] = canvas(80, 62);
  const ox = 40, oy = 44;
  // repère du véhicule : u = vers l'avant, v = latéral ; converti en cases (gx, gy)
  const G = (u: number, v: number): [number, number] => (facing === 0 ? [u, v] : [v, -u]);
  const P = (u: number, v: number, z = 0) => {
    const [gx, gy] = G(u, v);
    return iso(ox, oy, gx * 0.42, gy * 0.42, z);
  };
  groundShadow(ctx, ox + 3, oy + 2, 30, 11, 0.32);
  const box = (u0: number, u1: number, v0: number, v1: number, z0: number, z1: number, col: string) => {
    const [ax, ay] = G(u0, v0), [bx, by] = G(u1, v1);
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
    const Q = (gx: number, gy: number, z: number) => iso(ox, oy, gx * 0.42, gy * 0.42, z);
    ctx.fillStyle = shade(col, -0.2);
    poly(ctx, [Q(x1, y0, z0), Q(x1, y1, z0), Q(x1, y1, z1), Q(x1, y0, z1)]);
    ctx.fill();
    ctx.fillStyle = col;
    poly(ctx, [Q(x0, y1, z0), Q(x1, y1, z0), Q(x1, y1, z1), Q(x0, y1, z1)]);
    ctx.fill();
    ctx.fillStyle = shade(col, 0.16);
    poly(ctx, [Q(x0, y0, z1), Q(x1, y0, z1), Q(x1, y1, z1), Q(x0, y1, z1)]);
    ctx.fill();
  };
  const wheel = (u: number, v: number, rad: number) => {
    const [x, y] = P(u, v, rad);
    // la roue est vue de profil sur le flanc visible
    const rot = facing === 0 ? 0.46 : -0.46;
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.ellipse(x, y, rad * 0.62, rad, rot, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8b030';
    ctx.beginPath();
    ctx.ellipse(x, y, rad * 0.3, rad * 0.5, rot, 0, Math.PI * 2);
    ctx.fill();
  };
  const near = facing === 0 ? 1 : -1; // côté latéral visible (vers +y ou +x écran)
  const trailer = () => {
    box(-3.3, -1.0, -0.95, 0.95, 5, 12, '#a8452e');
    if (loaded) {
      ctx.fillStyle = '#e0b64a';
      ctx.beginPath();
      ctx.ellipse(...P(-2.15, 0, 14), 11, 5, facing === 0 ? 0.45 : -0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    wheel(-2.1, near * 1.0, 5);
  };
  wheel(-0.1, -near * 0.85, 9);
  wheel(1.5, -near * 0.85, 5.5);
  if (facing === 0) trailer();
  box(-0.5, 1.9, -0.75, 0.75, 6, 15, '#3f8a3a'); // capot et châssis
  box(-0.45, 0.65, -0.7, 0.7, 15, 31, '#3f8a3a'); // cabine
  ctx.fillStyle = 'rgba(200,230,255,0.7)';
  if (facing === 0) poly(ctx, [P(0.65, -0.55, 17), P(0.65, 0.55, 17), P(0.65, 0.55, 29), P(0.65, -0.55, 29)]);
  else poly(ctx, [P(-0.35, near * 0.7, 17), P(0.55, near * 0.7, 17), P(0.55, near * 0.7, 29), P(-0.35, near * 0.7, 29)]);
  ctx.fill();
  ctx.fillStyle = '#2a2622';
  const [ex, ey] = P(1.4, -0.3, 24);
  ctx.fillRect(ex - 1, ey, 2, 8);
  wheel(-0.1, near * 0.85, 9);
  wheel(1.5, near * 0.85, 5.5);
  if (facing === 1) trailer();
  return { canvas: c, ax: ox, ay: oy };
}

export function paintVan(facing: 0 | 1): Painted {
  const [c, ctx] = canvas(60, 46);
  const ox = 30, oy = 34;
  const P = (gx: number, gy: number, z = 0) => iso(ox, oy, gx * 0.42, gy * 0.42, z);
  groundShadow(ctx, ox + 2, oy + 2, 24, 9, 0.32);
  const col = '#ecebe4';
  const x0 = -1.8, x1 = 1.8, y0 = -0.8, y1 = 0.8;
  ctx.fillStyle = shade(col, -0.2);
  poly(ctx, [P(x1, y0, 3), P(x1, y1, 3), P(x1, y1, 20), P(x1, y0, 20)]);
  ctx.fill();
  ctx.fillStyle = col;
  poly(ctx, [P(x0, y1, 3), P(x1, y1, 3), P(x1, y1, 20), P(x0, y1, 20)]);
  ctx.fill();
  ctx.fillStyle = shade(col, 0.1);
  poly(ctx, [P(x0, y0, 20), P(x1, y0, 20), P(x1, y1, 20), P(x0, y1, 20)]);
  ctx.fill();
  ctx.fillStyle = 'rgba(80,110,140,0.85)';
  if (facing === 0) poly(ctx, [P(x1, y0 + 0.1, 11), P(x1, y1 - 0.1, 11), P(x1, y1 - 0.1, 18), P(x1, y0 + 0.1, 18)]);
  else poly(ctx, [P(x0, y1, 11), P(x0 + 0.8, y1, 11), P(x0 + 0.8, y1, 18), P(x0, y1, 18)]);
  ctx.fill();
  ctx.fillStyle = '#3f6a8a';
  poly(ctx, [P(x0 + 0.9, y1, 8), P(x1 - 0.9, y1, 8), P(x1 - 0.9, y1, 12), P(x0 + 0.9, y1, 12)]);
  ctx.fill();
  for (const gx of [x0 + 0.7, x1 - 0.7]) {
    const [x, y] = P(gx, y1, 3);
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.6, 3.6, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas: c, ax: ox, ay: oy };
}

export function paintCar(variant: number): Painted {
  const [c, ctx] = canvas(56, 40);
  const ox = 28, oy = 28;
  const P = (gx: number, gy: number, z = 0) => iso(ox, oy, gx * 0.4, gy * 0.4, z);
  groundShadow(ctx, ox + 2, oy + 2, 22, 8, 0.3);
  const col = ['#b8443a', '#3f6a8a', '#e8e2d0'][variant % 3];
  const x0 = -1.6, x1 = 1.6, y0 = -0.75, y1 = 0.75;
  ctx.fillStyle = shade(col, -0.2);
  poly(ctx, [P(x1, y0, 3), P(x1, y1, 3), P(x1, y1, 10), P(x1, y0, 10)]);
  ctx.fill();
  ctx.fillStyle = col;
  poly(ctx, [P(x0, y1, 3), P(x1, y1, 3), P(x1, y1, 10), P(x0, y1, 10)]);
  ctx.fill();
  ctx.fillStyle = shade(col, 0.12);
  poly(ctx, [P(x0, y0, 10), P(x1, y0, 10), P(x1, y1, 10), P(x0, y1, 10)]);
  ctx.fill();
  ctx.fillStyle = 'rgba(70,100,130,0.85)';
  poly(ctx, [P(-0.7, y1 - 0.1, 10), P(0.8, y1 - 0.1, 10), P(0.6, y1 - 0.25, 16), P(-0.5, y1 - 0.25, 16)]);
  ctx.fill();
  ctx.fillStyle = shade(col, 0.2);
  poly(ctx, [P(-0.5, y0 + 0.2, 16), P(0.6, y0 + 0.2, 16), P(0.6, y1 - 0.25, 16), P(-0.5, y1 - 0.25, 16)]);
  ctx.fill();
  for (const gx of [x0 + 0.6, x1 - 0.6]) {
    const [x, y] = P(gx, y1, 3);
    ctx.fillStyle = '#2a2622';
    ctx.beginPath();
    ctx.ellipse(x, y, 2.2, 3, -0.5, 0, Math.PI * 2);
    ctx.fill();
  }
  return { canvas: c, ax: ox, ay: oy };
}
