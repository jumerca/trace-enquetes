// Peintures de la V0.2 : sols régionaux (plage, mer, roche, garrigue), cultures, nouvelles essences,
// arbres fruitiers, vigne, animaux d'élevage, ateliers, village (église), littoral (phare, bateaux).
import {
  DIAMOND, EDGE_SEG, SEASON_GRASS, TH, TW, barrel, blob, branches, canvas, crate, grassTexture, groundShadow, iso, mix, paintHouse, poly, pot, rnd, shade, sign,
  setBuildingHook, type Painted, type Season,
} from './paint';

type Ctx = CanvasRenderingContext2D;

function tileCanvas(): [HTMLCanvasElement, Ctx] {
  const [c, ctx] = canvas(TW + 2, TH + 2);
  ctx.translate(1, 1);
  DIAMOND(ctx, 0, 0, 2);
  ctx.save();
  ctx.clip();
  return [c, ctx];
}

// ————— sols —————
export function paintGround(kind: 'sable' | 'roche' | 'garrigue' | 'neige', variant: number, season: Season): HTMLCanvasElement {
  const [c, ctx] = tileCanvas();
  const r = rnd(variant * 17 + kind.length * 31 + season);
  if (kind === 'sable') {
    ctx.fillStyle = '#e8d6a8';
    ctx.fillRect(-4, -4, TW + 8, TH + 8);
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = r() < 0.5 ? '#d6c08e' : '#f4e8c8';
      ctx.fillRect(r() * TW, r() * TH, 1, 1);
    }
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = 'rgba(160,130,80,0.25)';
      ctx.lineWidth = 0.8;
      const y = r() * TH;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.quadraticCurveTo(TW / 2, y + 3, TW, y);
      ctx.stroke();
    }
  } else if (kind === 'roche') {
    ctx.fillStyle = season === 3 ? '#a8a69e' : '#8e8a7e';
    ctx.fillRect(-4, -4, TW + 8, TH + 8);
    for (let i = 0; i < 9; i++) {
      const x = r() * TW, y = r() * TH;
      ctx.fillStyle = shade('#9a958a', (r() - 0.5) * 0.3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 6 + r() * 6, y + 1);
      ctx.lineTo(x + 4, y + 4 + r() * 3);
      ctx.lineTo(x - 3, y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(50,45,40,0.35)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = season === 3 ? 'rgba(255,255,255,0.5)' : 'rgba(110,140,70,0.5)';
      ctx.beginPath();
      ctx.ellipse(r() * TW, r() * TH, 2.5, 1.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (kind === 'garrigue') {
    grassTexture(ctx, variant * 7 + 3, season, 'pre');
    ctx.fillStyle = 'rgba(200,180,120,0.42)';
    ctx.fillRect(-4, -4, TW + 8, TH + 8);
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = r() < 0.5 ? '#c8b88a' : '#a89a6a';
      ctx.beginPath();
      ctx.ellipse(r() * TW, r() * TH, 2, 1, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#f2f4f6';
    ctx.fillRect(-4, -4, TW + 8, TH + 8);
    for (let i = 0; i < 20; i++) {
      ctx.fillStyle = r() < 0.5 ? '#dde4ea' : '#ffffff';
      ctx.beginPath();
      ctx.ellipse(r() * TW, r() * TH, 4, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  return c;
}

/** Mer : vagues, écume le long des bords qui touchent la terre (mask = voisins marins). */
export function paintSea(mask: number, variant: number): HTMLCanvasElement {
  const [c, ctx] = tileCanvas();
  const r = rnd(variant * 13 + mask * 7 + 1);
  const g = ctx.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, '#2f7fa8');
  g.addColorStop(1, '#2a6f98');
  ctx.fillStyle = g;
  ctx.fillRect(-4, -4, TW + 8, TH + 8);
  for (let i = 0; i < 7; i++) {
    const x = r() * TW, y = r() * TH;
    ctx.strokeStyle = 'rgba(220,240,255,0.5)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.quadraticCurveTo(x, y - 1.5, x + 5, y);
    ctx.stroke();
  }
  for (let i = 0; i < 4; i++) {
    if (mask & (1 << i)) continue;
    const [a, b] = EDGE_SEG[i];
    const cx = TW / 2, cy = TH / 2;
    const inset = (p: [number, number], k: number): [number, number] => [p[0] + (cx - p[0]) * k, p[1] + (cy - p[1]) * k];
    ctx.fillStyle = '#5aa8c8';
    poly(ctx, [a, b, inset(b, 0.45), inset(a, 0.45)]);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    poly(ctx, [a, b, inset(b, 0.18), inset(a, 0.18)]);
    ctx.fill();
  }
  ctx.restore();
  return c;
}

export type CropLook = 'cereale' | 'mais' | 'tournesol' | 'colza' | 'betterave' | 'patate' | 'lavande' | 'legumes' | 'vigne' | 'pre';

/** Culture : stade 0 labour, 1 levée, 2 croissance, 3 floraison/épiaison, 4 mûr, 5 chaume/récolté. */
export function paintCrop(look: CropLook, stage: number, variant: number, season: Season): HTMLCanvasElement {
  const [c, ctx] = tileCanvas();
  const r = rnd(variant * 101 + stage * 13 + look.length * 7);
  if (look === 'pre') {
    grassTexture(ctx, variant, season, 'pre');
    ctx.restore();
    return c;
  }
  const soil = stage === 5 ? '#b89a58' : look === 'vigne' ? '#a08058' : '#8a6a44';
  ctx.fillStyle = soil;
  ctx.fillRect(-4, -4, TW + 8, TH + 8);
  const rowsAlongX = look !== 'vigne';
  const nRows = look === 'legumes' || look === 'lavande' || look === 'vigne' ? 5 : look === 'mais' || look === 'tournesol' ? 6 : 9;
  for (let k = -nRows; k < nRows * 2; k++) {
    const off = (k * TH * 1.6) / nRows;
    const P = (t: number): [number, number] => (rowsAlongX ? [t * TW, off + t * (TH / 2)] : [TW - t * TW, off + t * (TH / 2)]);
    const [x0, y0] = P(0), [x1, y1] = P(1);
    ctx.strokeStyle = stage === 5 ? '#a88a48' : shade(soil, -0.18);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    if (stage === 0) continue;
    const n = look === 'mais' || look === 'tournesol' ? 7 : look === 'legumes' || look === 'betterave' || look === 'patate' ? 6 : look === 'vigne' ? 4 : 16;
    for (let s = 0; s < n; s++) {
      const t = (s + 0.3 + r() * 0.4) / n;
      const [x, y] = P(t);
      if (stage === 5) {
        ctx.strokeStyle = '#d9c27a';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y - 1.5);
        ctx.stroke();
        continue;
      }
      const grow = [0, 0.35, 0.7, 0.95, 1][stage];
      switch (look) {
        case 'cereale': {
          const col = stage <= 2 ? '#7fae45' : stage === 3 ? '#b6b84c' : '#e2b84a';
          ctx.strokeStyle = shade(col, (r() - 0.5) * 0.2);
          ctx.lineWidth = 1.1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + (r() - 0.5), y - 7 * grow);
          ctx.stroke();
          if (stage >= 3) {
            ctx.fillStyle = stage === 4 ? '#f2d36d' : '#c4c25c';
            ctx.beginPath();
            ctx.ellipse(x, y - 7 * grow, 0.9, 1.8, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'mais': {
          const h = 13 * grow;
          ctx.strokeStyle = stage === 4 ? '#c8b060' : '#5f9a3a';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - h);
          ctx.stroke();
          ctx.strokeStyle = stage === 4 ? '#d8c070' : '#7fb44a';
          ctx.beginPath();
          ctx.moveTo(x, y - h * 0.5);
          ctx.quadraticCurveTo(x + 4, y - h * 0.7, x + 5, y - h * 0.4);
          ctx.moveTo(x, y - h * 0.7);
          ctx.quadraticCurveTo(x - 4, y - h * 0.9, x - 5, y - h * 0.6);
          ctx.stroke();
          if (stage >= 3) {
            ctx.fillStyle = '#f0c430';
            ctx.fillRect(x + 0.5, y - h * 0.6, 1.6, 3);
          }
          break;
        }
        case 'tournesol': {
          const h = 12 * grow;
          ctx.strokeStyle = '#5f8a34';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - h);
          ctx.stroke();
          ctx.fillStyle = '#6fa040';
          ctx.beginPath();
          ctx.ellipse(x - 2, y - h * 0.5, 2.2, 1.2, 0.4, 0, Math.PI * 2);
          ctx.fill();
          if (stage === 3) {
            ctx.fillStyle = '#f4c81a';
            ctx.beginPath();
            ctx.arc(x, y - h, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#5a3a1a';
            ctx.beginPath();
            ctx.arc(x, y - h, 1.3, 0, Math.PI * 2);
            ctx.fill();
          } else if (stage === 4) {
            ctx.fillStyle = '#4a3a20';
            ctx.beginPath();
            ctx.arc(x, y - h + 1, 2.4, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'colza': {
          ctx.strokeStyle = '#6a9a3a';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 7 * grow);
          ctx.stroke();
          ctx.fillStyle = stage === 3 ? '#f4e02a' : stage === 4 ? '#8a8a4a' : '#7aaa4a';
          ctx.beginPath();
          ctx.arc(x, y - 7 * grow, stage === 3 ? 2 : 1.4, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'betterave':
        case 'patate':
        case 'legumes': {
          const col = look === 'legumes' ? (s % 3 === 0 ? '#6a9a4a' : s % 3 === 1 ? '#8ab05a' : '#5a8a6a') : look === 'betterave' ? '#5f9a3a' : '#6a9a42';
          const rad = 1.5 + 2.6 * grow;
          ctx.fillStyle = stage === 4 && look === 'patate' ? '#a8a05a' : col;
          ctx.beginPath();
          ctx.ellipse(x, y - rad * 0.5, rad, rad * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.25)';
          ctx.beginPath();
          ctx.ellipse(x - rad * 0.3, y - rad * 0.8, rad * 0.4, rad * 0.25, 0, 0, Math.PI * 2);
          ctx.fill();
          if (look === 'legumes' && stage >= 3 && s % 3 === 2) {
            ctx.fillStyle = '#f4f0e0';
            ctx.beginPath();
            ctx.arc(x, y - rad * 0.6, rad * 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'lavande': {
          const rad = 1.5 + 3 * grow;
          ctx.fillStyle = '#7a9a6a';
          ctx.beginPath();
          ctx.ellipse(x, y - rad * 0.4, rad, rad * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          if (stage >= 3) {
            for (let i = 0; i < 6; i++) {
              ctx.strokeStyle = r() < 0.5 ? '#8a66c8' : '#a888e0';
              ctx.lineWidth = 1.2;
              const px = x + (r() - 0.5) * rad * 1.6;
              ctx.beginPath();
              ctx.moveTo(px, y - rad * 0.5);
              ctx.lineTo(px, y - rad * 0.5 - 3 - r() * 2);
              ctx.stroke();
            }
          }
          break;
        }
        case 'vigne': {
          ctx.strokeStyle = '#5a4030';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y - 8);
          ctx.stroke();
          const leaf = season === 2 ? '#c8902a' : season === 3 ? null : '#5f9a3a';
          if (leaf) {
            ctx.fillStyle = leaf;
            ctx.beginPath();
            ctx.ellipse(x, y - 7, 4, 2.4, 0, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }
    }
  }
  ctx.restore();
  return c;
}

// ————— arbres —————
const CONIFER = { sapin: ['#3f6a44', '#2a4f34', '#173524'], epicea: ['#4a6a3a', '#30502c', '#1d3a20'] };

function conifer(ctx: Ctx, bx: number, by: number, sz: number, cols: string[], season: Season, tall: number) {
  ctx.fillStyle = '#4a3428';
  ctx.fillRect(bx - 2, by - 14 * sz, 4, 14 * sz);
  const layers = 7;
  for (let i = 0; i < layers; i++) {
    const t = i / layers;
    const y = by - 12 * sz - t * tall * sz;
    const w = (24 - t * 19) * sz;
    for (const [col, dx, k] of [[cols[2], 2, 1], [cols[1], 0, 0.92], [cols[0], -w * 0.25, 0.5]] as [string, number, number][]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(bx + dx - w * k, y + 4);
      ctx.quadraticCurveTo(bx + dx, y + 8, bx + dx + w * k, y + 4);
      ctx.lineTo(bx + dx + w * 0.05, y - 16 * sz);
      ctx.closePath();
      ctx.fill();
    }
    if (season === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath();
      ctx.ellipse(bx - 2, y - 2, w * 0.5, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const DECIDUOUS: Record<string, (string[] | null)[]> = {
  hetre: [['#a2d06a', '#76a845', '#4a7a30'], ['#6a9a3a', '#4c7a2c', '#2f5222'], ['#d8843a', '#b0602a', '#7a3a1c'], null],
  peuplier: [['#a8d070', '#7aa848', '#4f7a30'], ['#7aa846', '#58862f', '#365a24'], ['#f0d04a', '#d4aa34', '#9a7424'], null],
  olivier: [['#a8b88a', '#7f9468', '#56684a'], ['#a8b88a', '#7f9468', '#56684a'], ['#a0b080', '#788c60', '#526444'], ['#9aa88a', '#748462', '#4e5c44']],
  haie: [['#86b84e', '#5e9236', '#3d6626'], ['#6e9e3e', '#4f7c2e', '#325424'], ['#9a8a3a', '#7a6a2c', '#4f4a22'], ['#5f6a4a', '#4a543a', '#323a28']],
  prunier: [['#9ccb62', '#70a443', '#4a7630'], ['#6fa13f', '#4f812f', '#335a24'], ['#b9b04a', '#93883a', '#62602c'], null],
  mirabellier: [['#9ccb62', '#70a443', '#4a7630'], ['#7aa846', '#58862f', '#365a24'], ['#c8b84a', '#a0903a', '#6a602c'], null],
  noyerV: [['#a5cf6c', '#79a84a', '#4d7432'], ['#86b056', '#5f8a3c', '#3c5e2a'], ['#e6c45a', '#c8962e', '#8a6426'], null],
};

/** Nouvelles essences et arbres de verger. fruit : 0..3 */
export function paintTree2(species: string, variant: number, season: Season, fruit = 0): Painted {
  const r = rnd(variant * 131 + season * 7 + species.length * 13 + fruit * 1009);
  const tall = species === 'peuplier' ? 1.5 : 1;
  const big = species === 'haie' ? 0.62 : species === 'olivier' || species === 'prunier' || species === 'mirabellier' ? 0.78 : species === 'noyerV' ? 1 : 1.05;
  const W = 100 * big + 10, H = (species === 'sapin' || species === 'epicea' ? 140 : 118 * tall) * Math.max(big, 0.8) + 10;
  const [c, ctx] = canvas(W, H);
  const bx = W / 2, by = H - 10;
  const sz = (0.88 + r() * 0.24) * big;
  groundShadow(ctx, bx + 6, by, 26 * sz, 11 * sz);
  if (species === 'sapin' || species === 'epicea') {
    conifer(ctx, bx, by, sz, CONIFER[species], season, species === 'sapin' ? 96 : 84);
    return { canvas: c, ax: bx, ay: by };
  }
  const leaves = DECIDUOUS[species][season];
  if (species === 'haie') {
    const cols = leaves ?? DECIDUOUS.haie[3]!;
    for (let k = -1; k <= 1; k++) blob(ctx, bx + k * 12 * sz, by - 9 * sz + k * 2, 14 * sz, 10 * sz, cols, r, 8);
    return { canvas: c, ax: bx, ay: by };
  }
  if (species === 'peuplier') {
    ctx.fillStyle = '#6b5a48';
    ctx.fillRect(bx - 2, by - 26 * sz, 4, 26 * sz);
    if (!leaves) branches(ctx, bx, by - 20, 70 * sz, 2.4 * sz, r, '#6b5a48');
    else
      for (const [col, dx, k] of [[leaves[2], 1.5, 1], [leaves[1], 0, 0.9], [leaves[0], -3, 0.55]] as [string, number, number][]) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(bx + dx, by - 62 * sz, 12 * sz * k, 44 * sz * k, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    return { canvas: c, ax: bx, ay: by };
  }
  // tronc
  const trunkH = species === 'olivier' ? 18 * sz : species === 'noyerV' || species === 'hetre' ? 32 * sz : 20 * sz;
  ctx.strokeStyle = species === 'olivier' ? '#7a6a58' : '#6b5238';
  ctx.lineWidth = species === 'olivier' ? 6 * sz : 5 * sz;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  if (species === 'olivier') ctx.bezierCurveTo(bx - 6, by - trunkH * 0.4, bx + 7, by - trunkH * 0.7, bx, by - trunkH);
  else ctx.lineTo(bx, by - trunkH);
  ctx.stroke();
  const crownR = (species === 'noyerV' || species === 'hetre' ? 30 : 22) * sz;
  const cy = by - trunkH - crownR * 0.5;
  if (!leaves) {
    branches(ctx, bx, by - trunkH + 4, crownR * 2, 3 * sz, r);
    if (season === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 10; i++) ctx.fillRect(bx + (r() - 0.5) * crownR * 1.6, cy + (r() - 0.5) * crownR, 2.5, 1);
    }
    return { canvas: c, ax: bx, ay: by };
  }
  blob(ctx, bx, cy, crownR * (species === 'olivier' ? 1.1 : 1), crownR * (species === 'olivier' ? 0.7 : 0.85), leaves, r, 16);
  if ((species === 'prunier' || species === 'mirabellier') && season === 0) {
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = r() < 0.7 ? '#fbf6f0' : '#f0d8e0';
      ctx.beginPath();
      ctx.arc(bx + (r() - 0.5) * crownR * 1.7, cy + (r() - 0.5) * crownR * 1.4, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const fruitCol = species === 'prunier' ? ['#5a2a6a', '#7a3a8a'] : species === 'mirabellier' ? ['#f0c83a', '#e8a82a'] : species === 'olivier' ? ['#2a2a20', '#4a5a2a'] : species === 'noyerV' ? ['#7a8a3a', '#6a7a30'] : null;
  if (fruitCol) {
    const n = [0, 6, 14, 24][fruit];
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = fruitCol[i % 2];
      ctx.beginPath();
      ctx.arc(bx + (r() - 0.5) * crownR * 1.6, cy + (r() - 0.35) * crownR * 1.1, species === 'olivier' ? 1.2 : 1.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return { canvas: c, ax: bx, ay: by };
}

/** Rang de vigne (une case de parcelle). fruit : 0..3 */
export function paintVine(season: Season, fruit: number, variant: number): Painted {
  const r = rnd(variant * 7 + season * 3 + fruit);
  const [c, ctx] = canvas(TW + 8, 50);
  const ox = TW / 2 + 4, oy = 22;
  for (const row of [0.3, 0.75]) {
    const a = iso(ox, oy, 0.05, row), b = iso(ox, oy, 0.95, row);
    ctx.strokeStyle = '#8a7a60';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1] - 12);
    ctx.lineTo(b[0], b[1] - 12);
    ctx.stroke();
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      ctx.fillStyle = '#5a4030';
      ctx.fillRect(x - 0.8, y - 13, 1.6, 13);
      const leaf = season === 2 ? (r() < 0.5 ? '#c8902a' : '#b8601a') : season === 3 ? null : season === 0 ? '#9ccb60' : '#5f9a3a';
      if (leaf) {
        ctx.fillStyle = leaf;
        ctx.beginPath();
        ctx.ellipse(x, y - 12, 6, 4.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = shade(leaf, 0.2);
        ctx.beginPath();
        ctx.ellipse(x - 2, y - 14, 3, 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let g = 0; g < fruit; g++) {
        ctx.fillStyle = '#4a2060';
        ctx.beginPath();
        ctx.ellipse(x - 2 + g * 2, y - 8, 1.6, 2.4, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return { canvas: c, ax: ox, ay: oy + TH / 2 };
}

// ————— animaux —————
export function paintAnimal(kind: string, look: number, facing: 0 | 1, frame: number): Painted {
  const [c, ctx] = canvas(44, 34);
  const bx = 22, by = 30;
  const dir = facing === 0 ? 1 : -1;
  const leg = frame ? 1.6 : -1.6;
  const legs = (xs: number[], top: number, col: string, w = 2) => {
    ctx.strokeStyle = col;
    ctx.lineWidth = w;
    ctx.beginPath();
    xs.forEach((x, i) => {
      ctx.moveTo(bx + x, by - top);
      ctx.lineTo(bx + x + (i % 2 ? -leg : leg) * 0.6, by - 0.5);
    });
    ctx.stroke();
  };
  if (kind === 'vache') {
    groundShadow(ctx, bx, by, 15, 4, 0.3);
    const coat = ['#f4f0e6', '#a8643a', '#2a2422'][look % 3];
    legs([-9, -6, 6, 9], 9, shade(coat, -0.3), 2.6);
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.roundRect(bx - 13, by - 19, 26, 11, 5);
    ctx.fill();
    if (look % 3 !== 1) {
      ctx.fillStyle = look % 3 === 0 ? '#2a2422' : '#f4f0e6';
      for (const [x, y, rr] of [[-6, -15, 4], [4, -13, 3.4], [9, -17, 2.4]]) {
        ctx.beginPath();
        ctx.ellipse(bx + x, by + y, rr, rr * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#e8a8a0';
    ctx.beginPath();
    ctx.ellipse(bx - 4, by - 8.5, 3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    const hx = bx + dir * 15;
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.roundRect(hx - 4, by - 22, 8, 9, 3);
    ctx.fill();
    ctx.fillStyle = '#e8b0a0';
    ctx.fillRect(hx - 3.5, by - 15, 7, 3);
    ctx.strokeStyle = '#e8e0c8';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(hx - 4, by - 21);
    ctx.lineTo(hx - 7, by - 24);
    ctx.moveTo(hx + 4, by - 21);
    ctx.lineTo(hx + 7, by - 24);
    ctx.stroke();
    if (facing === 0) {
      ctx.fillStyle = '#1a1210';
      ctx.fillRect(hx - 2.5, by - 19, 1.2, 1.2);
      ctx.fillRect(hx + 1.3, by - 19, 1.2, 1.2);
    }
  } else if (kind === 'brebis') {
    groundShadow(ctx, bx, by, 10, 3, 0.3);
    legs([-5, -2, 3, 6], 6, '#3a3430', 1.6);
    ctx.fillStyle = look % 3 === 2 ? '#d8d0c0' : '#f2ede2';
    for (const [x, y] of [[-5, -11], [0, -12], [5, -11], [-2, -9], [3, -9]]) {
      ctx.beginPath();
      ctx.arc(bx + x, by + y, 4.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2a2420';
    ctx.beginPath();
    ctx.ellipse(bx + dir * 10, by - 12, 3, 2.4, dir * 0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'cochon') {
    groundShadow(ctx, bx, by, 12, 3.5, 0.3);
    legs([-6, -3, 4, 7], 6, '#d88a80', 2.2);
    ctx.fillStyle = look % 3 === 2 ? '#6a4a3a' : '#f0b0a6';
    ctx.beginPath();
    ctx.ellipse(bx, by - 10, 11, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look % 3 === 2 ? '#5a3a2a' : '#e8968a';
    ctx.beginPath();
    ctx.ellipse(bx + dir * 11, by - 10, 2.4, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(80,50,30,0.4)';
    ctx.beginPath();
    ctx.ellipse(bx - 3, by - 6, 6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'canard') {
    groundShadow(ctx, bx, by, 6, 2, 0.3);
    ctx.fillStyle = '#e8a030';
    ctx.fillRect(bx - 2 + leg * 0.4, by - 3, 1.4, 3);
    ctx.fillRect(bx + 1 - leg * 0.4, by - 3, 1.4, 3);
    ctx.fillStyle = look % 3 === 0 ? '#f4f0e6' : '#8a7a5a';
    ctx.beginPath();
    ctx.ellipse(bx, by - 7, 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = look % 3 === 1 ? '#2a6a3a' : look % 3 === 0 ? '#f4f0e6' : '#6a5a3a';
    ctx.beginPath();
    ctx.arc(bx + dir * 5, by - 12, 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0a020';
    ctx.beginPath();
    ctx.moveTo(bx + dir * 7, by - 12.4);
    ctx.lineTo(bx + dir * 10, by - 11.6);
    ctx.lineTo(bx + dir * 7, by - 11);
    ctx.fill();
  } else if (kind === 'ruche') {
    groundShadow(ctx, bx, by, 9, 3, 0.3);
    ctx.fillStyle = '#6b4a2c';
    ctx.fillRect(bx - 7, by - 4, 14, 3);
    for (let k = 0; k < 3; k++) {
      ctx.fillStyle = ['#f0e6c8', '#e8c86a', '#9ac0d8'][(look + k) % 3];
      ctx.fillRect(bx - 6, by - 8 - k * 4, 12, 4);
      ctx.strokeStyle = 'rgba(60,40,20,0.4)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(bx - 6, by - 8 - k * 4, 12, 4);
    }
    ctx.fillStyle = '#7a6a58';
    ctx.beginPath();
    ctx.moveTo(bx - 8, by - 16);
    ctx.lineTo(bx, by - 20);
    ctx.lineTo(bx + 8, by - 16);
    ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.fillRect(bx - 2, by - 6, 4, 1);
    if (frame) {
      ctx.fillStyle = '#e8b020';
      for (let i = 0; i < 4; i++) ctx.fillRect(bx - 10 + i * 6, by - 22 + (i % 2) * 4, 1.4, 1.4);
    }
  }
  return { canvas: c, ax: bx, ay: by };
}

// ————— bâtiments de la V0.2 —————
const WALL = '#d9c39a';
const ROOF = '#b8553a';
const BLUE = '#6f93b4';

function copperStill(ctx: Ctx, x: number, y: number) {
  ctx.fillStyle = '#b8682a';
  ctx.beginPath();
  ctx.ellipse(x, y - 9, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e8a060';
  ctx.beginPath();
  ctx.ellipse(x - 2, y - 12, 2.4, 3.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a4a1a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x, y - 17);
  ctx.quadraticCurveTo(x + 10, y - 22, x + 13, y - 8);
  ctx.stroke();
  ctx.fillStyle = '#5a5652';
  ctx.fillRect(x - 6, y - 2, 12, 2);
}

function jars(ctx: Ctx, x: number, y: number, col: string) {
  for (let k = 0; k < 4; k++) {
    ctx.fillStyle = 'rgba(220,235,240,0.85)';
    ctx.fillRect(x - 7 + k * 4, y - 6, 3, 5);
    ctx.fillStyle = col;
    ctx.fillRect(x - 7 + k * 4, y - 4, 3, 3);
    ctx.fillStyle = '#c8a040';
    ctx.fillRect(x - 7 + k * 4, y - 7, 3, 1);
  }
}

export function paintBuilding2(type: string): Painted | null {
  switch (type) {
    case 'brasserie':
      return paintHouse({ size: 2, inset: 0.18, wallH: 36, roofH: 18, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: false, door: 'grange', seed: 121, chimneys: 1 }, (ctx, _ox, _oy, P) => {
        barrel(ctx, ...P(1.95, 0.6));
        barrel(ctx, ...P(1.95, 1.05));
        copperStill(ctx, ...P(0.35, 2.05));
        sign(ctx, ...P(1.45, 2.05), 'BIÈRE');
      });
    case 'chai':
      return paintHouse({ size: 2, inset: 0.16, wallH: 32, roofH: 18, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: false, door: 'grange', seed: 131, vine: true }, (ctx, _ox, _oy, P) => {
        for (const g of [0.5, 0.95, 1.4]) barrel(ctx, ...P(1.98, g));
        sign(ctx, ...P(0.2, 2.02), 'CHAI');
      });
    case 'huilerie':
      return paintHouse({ size: 2, inset: 0.2, wallH: 30, roofH: 18, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: true, door: 'arche', seed: 141 }, (ctx, _ox, _oy, P) => {
        const [x, y] = P(1.98, 0.9);
        ctx.fillStyle = '#c8b898';
        ctx.beginPath();
        ctx.ellipse(x + 3, y - 3, 7, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9a8a72';
        ctx.fillRect(x, y - 11, 6, 8);
        jars(ctx, ...P(0.5, 2.04), '#a8a02a');
        sign(ctx, ...P(1.5, 2.04), 'HUILERIE');
      });
    case 'distillerie':
      return paintHouse({ size: 2, inset: 0.2, wallH: 28, roofH: 16, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: false, door: 'simple', seed: 151, chimneys: 1 }, (ctx, _ox, _oy, P) => {
        copperStill(ctx, ...P(1.98, 1.2));
        jars(ctx, ...P(0.45, 2.04), '#a888e0');
        sign(ctx, ...P(1.4, 2.04), 'LAVANDE');
      });
    case 'conserverie':
      return paintHouse({ size: 2, inset: 0.18, wallH: 30, roofH: 18, wall: WALL, roof: ROOF, shutters: BLUE, stories: 1, hip: true, door: 'vitrine', seed: 161 }, (ctx, _ox, _oy, P) => {
        jars(ctx, ...P(0.5, 2.04), '#c8402a');
        crate(ctx, ...P(1.98, 0.6), '#e8c03a');
        sign(ctx, ...P(1.45, 2.04), 'CONSERVES');
        pot(ctx, ...P(1.95, 1.4), '#e9506a');
      });
    case 'charcuterie':
      return paintHouse({ size: 2, inset: 0.18, wallH: 32, roofH: 18, wall: WALL, roof: ROOF, shutters: '#a8553a', stories: 1, hip: false, door: 'vitrine', seed: 171, chimneys: 1 }, (ctx, _ox, _oy, P) => {
        const [x, y] = P(1.98, 0.8, 18);
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = '#b85a4a';
          ctx.beginPath();
          ctx.ellipse(x + 2 + k * 3, y + k * 1.5, 1.6, 3.4, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        sign(ctx, ...P(1.4, 2.04), 'CHARCUTERIE');
      });
    case 'etable':
      return paintHouse({ size: 2, inset: 0.08, wallH: 22, roofH: 16, wall: '#c8b088', roof: '#9a4a32', shutters: '#7a5a3a', stories: 0, hip: false, door: 'grange', seed: 181 });
    case 'bergerie':
      return paintHouse({ size: 2, inset: 0.1, wallH: 16, roofH: 14, wall: '#c8b898', roof: '#8a4a32', shutters: '#7a5a3a', stories: 0, hip: false, door: 'simple', seed: 191 });
    case 'poulailler':
      return paintHouse({ size: 1, inset: 0.12, wallH: 14, roofH: 10, wall: '#b89a6a', roof: '#a94e34', shutters: BLUE, stories: 0, hip: false, door: 'simple', seed: 201, styled: false });
    case 'porcherie':
      return paintHouse({ size: 1, inset: 0.06, wallH: 12, roofH: 9, wall: '#a8987a', roof: '#7d7a74', shutters: BLUE, stories: 0, hip: false, door: 'simple', seed: 211, roofKind: 'tole', styled: false });
    case 'eglise':
      return paintChurch();
    case 'phare':
      return paintLighthouse();
  }
  return null;
}

function paintChurch(): Painted {
  return paintHouse({ size: 2, inset: 0.15, wallH: 40, roofH: 26, wall: '#cdbf9f', roof: ROOF, shutters: '#5a4a3a', stories: 1, hip: false, door: 'arche', seed: 221 }, (ctx, _ox, _oy, P) => {
    // clocher
    const [x, y] = P(0.55, 0.55, 40);
    ctx.fillStyle = shade('#cdbf9f', -0.05);
    ctx.fillRect(x - 8, y - 46, 16, 48);
    ctx.fillStyle = shade('#cdbf9f', -0.22);
    ctx.fillRect(x, y - 46, 8, 48);
    ctx.fillStyle = '#3a3430';
    ctx.beginPath();
    ctx.arc(x - 3, y - 32, 2.6, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(x - 5.6, y - 32, 5.2, 4);
    ctx.fillStyle = '#5a6068';
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 46);
    ctx.lineTo(x, y - 78);
    ctx.lineTo(x + 10, y - 46);
    ctx.fill();
    ctx.fillStyle = '#3a4048';
    ctx.beginPath();
    ctx.moveTo(x, y - 78);
    ctx.lineTo(x + 10, y - 46);
    ctx.lineTo(x, y - 46);
    ctx.fill();
    ctx.strokeStyle = '#d9a441';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y - 78);
    ctx.lineTo(x, y - 86);
    ctx.moveTo(x - 3, y - 83);
    ctx.lineTo(x + 3, y - 83);
    ctx.stroke();
  });
}

function paintLighthouse(): Painted {
  const [c, ctx] = canvas(60, 150);
  const bx = 30, by = 140;
  groundShadow(ctx, bx + 6, by, 18, 6, 0.3);
  for (let k = 0; k < 6; k++) {
    const y0 = by - 4 - k * 18;
    const w0 = 11 - k * 0.8;
    ctx.fillStyle = k % 2 ? '#c8443a' : '#f4f0e6';
    ctx.beginPath();
    ctx.moveTo(bx - w0, y0);
    ctx.lineTo(bx - w0 + 0.8, y0 - 18);
    ctx.lineTo(bx + w0 - 0.8, y0 - 18);
    ctx.lineTo(bx + w0, y0);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(bx + 2, y0 - 18, w0 - 2, 18);
  }
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(bx - 8, by - 116, 16, 4);
  ctx.fillStyle = '#fff4b0';
  ctx.fillRect(bx - 5, by - 128, 10, 12);
  ctx.fillStyle = '#c8443a';
  ctx.beginPath();
  ctx.moveTo(bx - 7, by - 128);
  ctx.lineTo(bx, by - 138);
  ctx.lineTo(bx + 7, by - 128);
  ctx.fill();
  return { canvas: c, ax: bx, ay: by };
}

export function paintBoat(variant: number): Painted {
  const [c, ctx] = canvas(64, 60);
  const bx = 32, by = 46;
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.ellipse(bx, by + 2, 22, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = ['#c8443a', '#3f6a8a', '#f4f0e6'][variant % 3];
  ctx.beginPath();
  ctx.moveTo(bx - 18, by - 6);
  ctx.lineTo(bx + 20, by - 9);
  ctx.lineTo(bx + 12, by + 1);
  ctx.lineTo(bx - 14, by + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(bx - 1, by - 40, 2, 34);
  ctx.fillStyle = '#f4eee0';
  ctx.beginPath();
  ctx.moveTo(bx + 1, by - 40);
  ctx.lineTo(bx + 16, by - 12);
  ctx.lineTo(bx + 1, by - 10);
  ctx.fill();
  ctx.fillStyle = '#e8d8b8';
  ctx.beginPath();
  ctx.moveTo(bx - 1, by - 34);
  ctx.lineTo(bx - 12, by - 12);
  ctx.lineTo(bx - 1, by - 11);
  ctx.fill();
  return { canvas: c, ax: bx, ay: by };
}

export function paintBale(variant: number, season: Season): Painted {
  const [c, ctx] = canvas(40, 30);
  const bx = 20, by = 24;
  groundShadow(ctx, bx + 3, by, 12, 4, 0.3);
  ctx.fillStyle = season === 3 ? '#b8a878' : '#d8b860';
  ctx.beginPath();
  ctx.ellipse(bx, by - 7, 9, 7.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade('#d8b860', 0.15);
  ctx.beginPath();
  ctx.ellipse(bx - 3, by - 8, 5, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#a8883a';
  ctx.lineWidth = 0.7;
  for (let k = 1; k < 4; k++) {
    ctx.beginPath();
    ctx.ellipse(bx - 3, by - 8, k * 1.4, k * 1.6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  void variant;
  return { canvas: c, ax: bx, ay: by };
}

export function paintBoulder(variant: number, season: Season): Painted {
  const r = rnd(variant * 23 + 9);
  const [c, ctx] = canvas(80, 64);
  const bx = 40, by = 54;
  groundShadow(ctx, bx + 5, by, 30, 9, 0.3);
  for (let i = 0; i < 4; i++) {
    const x = bx + (i - 1.5) * 10 + r() * 4, y = by - 10 - (i % 2) * 8;
    const rx = 12 + r() * 9, ry = 10 + r() * 9;
    ctx.fillStyle = '#857f74';
    ctx.beginPath();
    ctx.moveTo(x - rx, y + ry * 0.6);
    ctx.lineTo(x - rx * 0.6, y - ry);
    ctx.lineTo(x + rx * 0.5, y - ry * 0.8);
    ctx.lineTo(x + rx, y + ry * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#aaa498';
    ctx.beginPath();
    ctx.moveTo(x - rx * 0.6, y - ry);
    ctx.lineTo(x + rx * 0.5, y - ry * 0.8);
    ctx.lineTo(x + rx * 0.1, y - ry * 0.1);
    ctx.lineTo(x - rx * 0.7, y);
    ctx.closePath();
    ctx.fill();
    if (season === 3) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(x - rx * 0.1, y - ry * 0.85, rx * 0.5, 2.4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  return { canvas: c, ax: bx, ay: by };
}

setBuildingHook(paintBuilding2);

export { mix, SEASON_GRASS };
