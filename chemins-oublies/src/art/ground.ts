// Peinture des sols d'une zone (herbe, chemins, pavés, champs, eau) en morceaux de 1024 px.
import type { ZoneDef, Pt } from '../world/types';
import { Rng } from '../core/rng';
import { shade, rgba, ellipse } from './draw';

export const CHUNK = 1024;

type C = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

function polyPath(ctx: C, pts: Pt[]) { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); }

function smoothLine(ctx: C, pts: Pt[]) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 2) { ctx.lineTo(pts[1][0], pts[1][1]); return; }
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1]; ctx.lineTo(l[0], l[1]);
}

function bboxOf(pts: Pt[], pad: number) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0: x0 - pad, y0: y0 - pad, x1: x1 + pad, y1: y1 + pad };
}

/** Échantillonne une polyligne lissée en points réguliers (pour les détails le long des chemins). */
export function samplePolyline(pts: Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
    const d = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.ceil(d / step));
    for (let k = 0; k < n; k++) out.push([x1 + (x2 - x1) * k / n, y1 + (y2 - y1) * k / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function paintChunk(z: ZoneDef, cx: number, cy: number, scale: number, flags: (f: string) => boolean, size = CHUNK, detail = true): HTMLCanvasElement {
  const w = Math.min(size, z.w - cx), h = Math.min(size, z.h - cy);
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * scale); c.height = Math.ceil(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const vis = (b: { x0: number; y0: number; x1: number; y1: number }) => b.x1 >= cx && b.x0 <= cx + w && b.y1 >= cy && b.y0 <= cy + h;
  const G = z.grass;

  // 1. fond
  ctx.fillStyle = z.interior ? '#2a1e18' : G[1];
  ctx.fillRect(cx, cy, w, h);
  if (!z.interior) {
    for (const d of decals(z).blots) {
      if (!detail && d.r < 50) continue;
      if (d.x + d.r < cx || d.x - d.r > cx + w || d.y + d.r < cy || d.y - d.r > cy + h) continue;
      ctx.fillStyle = d.c; ctx.beginPath(); ellipse(ctx, d.x, d.y, d.r, d.r * 0.6, d.a); ctx.fill();
    }
  }

  // 2. zones
  z.areas.forEach((a, ai) => {
    const b = bboxOf(a.poly, 40);
    if (!vis(b)) return;
    const r2 = new Rng(z.seed * 31 + ai * 977);
    paintArea(ctx, a.kind, a.poly, () => r2.next(), b);
  });

  // 3. eau (berges puis eau)
  for (const [wi, wd] of z.water.entries()) {
    const b = bboxOf(wd.pts, wd.w);
    if (!vis(b)) continue;
    const rw = new Rng(z.seed * 17 + wi * 613); const rnd = () => rw.next();
    const isCh = !!wd.channel;
    smoothLine(ctx, wd.pts);
    ctx.strokeStyle = isCh ? '#6b6258' : '#5d7a3e'; ctx.lineWidth = wd.w + (isCh ? 18 : 34); ctx.stroke();
    ctx.strokeStyle = isCh ? '#9a9286' : '#c9b78a'; ctx.lineWidth = wd.w + (isCh ? 10 : 16); ctx.stroke();
    ctx.strokeStyle = '#2b1e16'; ctx.lineWidth = wd.w + 3; ctx.stroke();
    ctx.strokeStyle = isCh ? '#5a4a3a' : '#3f6f8f'; ctx.lineWidth = wd.w; ctx.stroke();
    if (!isCh) {
      ctx.strokeStyle = '#4f86a6'; ctx.lineWidth = wd.w * 0.7; ctx.stroke();
      ctx.strokeStyle = '#64a0bf'; ctx.lineWidth = wd.w * 0.35; ctx.stroke();
      // reflets
      const sp = samplePolyline(wd.pts, 26);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
      for (const [x, y] of sp) { if (rnd() < 0.5) continue; const o = (rnd() - 0.5) * wd.w * 0.6; ctx.beginPath(); ctx.moveTo(x + o - 6, y + o * 0.2); ctx.lineTo(x + o + 6, y + o * 0.2); ctx.stroke(); }
      // roseaux
      for (const [x, y] of samplePolyline(wd.pts, 40)) {
        if (rnd() < 0.55) continue;
        const side = rnd() < 0.5 ? -1 : 1;
        const rx = x + side * (wd.w / 2 + 8 + rnd() * 6), ry = y;
        ctx.strokeStyle = '#4f7a35'; ctx.lineWidth = 1.6;
        for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.moveTo(rx + k * 2, ry); ctx.lineTo(rx + k * 2 + (rnd() - 0.5) * 6, ry - 10 - rnd() * 8); ctx.stroke(); }
      }
    }
  }

  // 4. chemins
  for (const [pi, p] of z.paths.entries()) {
    if (p.kind === 'route' && !flags('route_revealed')) continue;
    const b = bboxOf(p.pts, p.w);
    if (!vis(b)) continue;
    const rp = new Rng(z.seed * 13 + pi * 389);
    paintPath(ctx, p.pts, p.w, p.kind, () => rp.next());
  }

  // 5. détails d'herbe
  if (!z.interior && detail) {
    // brins et fleurettes : positions tirées par case globale (pas de raccord visible entre morceaux)
    const cols = ['#f6f1e0', '#f6d77a', '#e58aa0', '#a9b8f0'];
    const dark = rgba(shade(G[0], -0.1), 0.55), light = rgba(G[2], 0.55);
    ctx.lineWidth = 1.2;
    for (let gy = Math.floor(cy / 64); gy * 64 < cy + h; gy++) for (let gx = Math.floor(cx / 64); gx * 64 < cx + w; gx++) {
      const rc = new Rng(z.seed * 7 + gx * 73856093 + gy * 19349663);
      for (let i = 0; i < 8; i++) {
        const x = gx * 64 + rc.next() * 64, y = gy * 64 + rc.next() * 64;
        ctx.strokeStyle = rc.next() < 0.5 ? dark : light;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 2, y - 5); ctx.moveTo(x + 2, y); ctx.lineTo(x + 3, y - 6); ctx.stroke();
      }
      if (rc.next() < 0.68) { ctx.fillStyle = cols[Math.floor(rc.next() * cols.length)]; ctx.beginPath(); ctx.arc(gx * 64 + rc.next() * 64, gy * 64 + rc.next() * 64, 1.6, 0, TAU); ctx.fill(); }
    }
  }
  return c;
}

const decalCache = new Map<string, { blots: { x: number; y: number; r: number; a: number; c: string }[] }>();
function decals(z: ZoneDef) {
  let d = decalCache.get(z.id);
  if (d) return d;
  const r = new Rng(z.seed * 7919);
  const blots = [];
  const n = (z.w * z.h) / 900;
  for (let i = 0; i < n; i++) {
    const rr = 20 + r.next() * 70;
    blots.push({ x: r.next() * z.w, y: r.next() * z.h, r: rr, a: r.next(), c: rgba(z.grass[Math.floor(r.next() * z.grass.length)], 0.18 + r.next() * 0.2) });
  }
  d = { blots };
  decalCache.set(z.id, d);
  return d;
}

function paintPath(ctx: C, pts: Pt[], w: number, kind: string, rnd: () => number) {
  if (kind === 'cobble') {
    smoothLine(ctx, pts); ctx.strokeStyle = '#6f6658'; ctx.lineWidth = w + 6; ctx.stroke();
    ctx.strokeStyle = '#b5ab98'; ctx.lineWidth = w; ctx.stroke();
    for (const [x, y] of samplePolyline(pts, 9)) for (let k = 0; k < 3; k++) {
      ctx.fillStyle = rnd() < 0.5 ? '#c7bda9' : '#a69c88';
      ctx.beginPath(); ellipse(ctx, x + (rnd() - 0.5) * w * 0.85, y + (rnd() - 0.5) * w * 0.85, 4 + rnd() * 2, 3); ctx.fill();
    }
    return;
  }
  const base = kind === 'forest' ? '#8a7350' : kind === 'route' ? '#c9ad78' : '#c2a473';
  const edge = kind === 'forest' ? '#5c4a32' : '#8f7550';
  smoothLine(ctx, pts);
  ctx.strokeStyle = rgba(edge, 0.55); ctx.lineWidth = w + 12; ctx.stroke();
  ctx.strokeStyle = base; ctx.lineWidth = w; ctx.stroke();
  ctx.strokeStyle = rgba(shade(base, 0.18), 0.8); ctx.lineWidth = w * 0.45; ctx.stroke();
  if (kind === 'route') { ctx.setLineDash([2, 14]); ctx.strokeStyle = 'rgba(255,220,140,0.6)'; ctx.lineWidth = 3; ctx.stroke(); ctx.setLineDash([]); }
  for (const [x, y] of samplePolyline(pts, 14)) {
    if (rnd() < 0.4) continue;
    ctx.fillStyle = rnd() < 0.5 ? '#9b8e7c' : '#d8c8a2';
    ctx.beginPath(); ellipse(ctx, x + (rnd() - 0.5) * w * 0.8, y + (rnd() - 0.5) * w * 0.8, 1.5 + rnd() * 2.2, 1.2 + rnd()); ctx.fill();
    if (rnd() < 0.15) { ctx.strokeStyle = rgba(edge, 0.4); ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x - 8, y + (rnd() - 0.5) * w * 0.6); ctx.lineTo(x + 8, y + (rnd() - 0.5) * w * 0.6); ctx.stroke(); }
  }
}

function paintArea(ctx: C, kind: string, poly: Pt[], rnd: () => number, b: { x0: number; y0: number; x1: number; y1: number }) {
  ctx.save();
  polyPath(ctx, poly); ctx.closePath();
  const fills: Record<string, string> = { cobble: '#b5ab98', field: '#c9a85a', garden: '#7a5a3a', sand: '#d8c49a', wood: '#a8784a', stone: '#9e978b', moss: '#4f7a3a', dark: '#2f4a32', mud: '#6b5a44', rug: '#8a3a32' };
  ctx.fillStyle = fills[kind] ?? '#888';
  if (kind === 'cobble' || kind === 'garden' || kind === 'field') { ctx.strokeStyle = 'rgba(60,45,30,0.55)'; ctx.lineWidth = 10; ctx.stroke(); }
  ctx.fill();
  ctx.clip();
  if (kind === 'cobble') {
    for (let y = b.y0; y < b.y1; y += 11) for (let x = b.x0 + ((y / 11) % 2) * 7; x < b.x1; x += 14) {
      ctx.fillStyle = rnd() < 0.5 ? '#c7bda9' : rnd() < 0.5 ? '#a69c88' : '#bab09c';
      ctx.beginPath(); ellipse(ctx, x, y, 6, 4.4); ctx.fill();
      ctx.strokeStyle = 'rgba(90,80,65,0.35)'; ctx.lineWidth = 0.8; ctx.stroke();
    }
  } else if (kind === 'field') {
    for (let y = b.y0; y < b.y1; y += 12) { ctx.strokeStyle = y % 24 ? '#b4913f' : '#d9bb6a'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y + 6); ctx.stroke(); }
    for (let i = 0; i < (b.x1 - b.x0) * (b.y1 - b.y0) / 120; i++) { const x = b.x0 + rnd() * (b.x1 - b.x0), y = b.y0 + rnd() * (b.y1 - b.y0); ctx.strokeStyle = '#e4c879'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 1, y - 7); ctx.stroke(); }
  } else if (kind === 'garden') {
    for (let y = b.y0 + 8; y < b.y1; y += 22) {
      ctx.fillStyle = '#5e4229'; ctx.fillRect(b.x0, y, b.x1 - b.x0, 10);
      for (let x = b.x0 + 8; x < b.x1; x += 16) {
        const kindv = Math.floor((y / 22) % 3);
        ctx.fillStyle = kindv === 0 ? '#5c9a45' : kindv === 1 ? '#7fb956' : '#4f8a3a';
        ctx.beginPath(); ellipse(ctx, x, y + 2, 6, 4.5); ctx.fill();
        if (kindv === 1) { ctx.fillStyle = '#e07a3a'; ctx.beginPath(); ctx.arc(x + 2, y + 5, 2, 0, TAU); ctx.fill(); }
        if (kindv === 2) { ctx.fillStyle = '#c94a3a'; ctx.beginPath(); ctx.arc(x - 2, y + 4, 2, 0, TAU); ctx.fill(); }
      }
    }
  } else if (kind === 'wood' || kind === 'rug') {
    if (kind === 'wood') for (let y = b.y0; y < b.y1; y += 16) {
      ctx.fillStyle = Math.floor(y / 16) % 2 ? '#9e6f44' : '#ad7d4f'; ctx.fillRect(b.x0, y, b.x1 - b.x0, 16);
      ctx.strokeStyle = '#6b4a30'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(b.x0, y); ctx.lineTo(b.x1, y); ctx.stroke();
      for (let x = b.x0 + ((y / 16) % 3) * 40; x < b.x1; x += 120) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + 16); ctx.stroke(); }
    } else {
      ctx.strokeStyle = '#d9b25b'; ctx.lineWidth = 3; const inset = 8; ctx.strokeRect(b.x0 + 40 + inset, b.y0 + 40 + inset, b.x1 - b.x0 - 80 - inset * 2, b.y1 - b.y0 - 80 - inset * 2);
      ctx.fillStyle = 'rgba(217,178,91,0.35)'; for (let x = b.x0 + 60; x < b.x1 - 50; x += 24) for (let y = b.y0 + 60; y < b.y1 - 50; y += 24) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
    }
  } else if (kind === 'stone') {
    for (let y = b.y0; y < b.y1; y += 30) for (let x = b.x0 + ((y / 30) % 2) * 20; x < b.x1; x += 40) { ctx.fillStyle = rnd() < 0.5 ? '#aaa397' : '#948d81'; ctx.fillRect(x + 1, y + 1, 38, 28); }
  } else {
    for (let i = 0; i < (b.x1 - b.x0) * (b.y1 - b.y0) / 400; i++) {
      const x = b.x0 + rnd() * (b.x1 - b.x0), y = b.y0 + rnd() * (b.y1 - b.y0);
      ctx.fillStyle = rgba(shade(fills[kind] ?? '#888', rnd() < 0.5 ? -0.15 : 0.15), 0.6);
      ctx.beginPath(); ellipse(ctx, x, y, 4 + rnd() * 10, 2 + rnd() * 4); ctx.fill();
    }
  }
  ctx.restore();
}

/** Calque de la route révélée (apparition progressive à la fin du prologue). */
export function paintRouteLayer(z: ZoneDef, scale: number): { canvas: HTMLCanvasElement; x: number; y: number } | null {
  const routes = z.paths.filter((p) => p.kind === 'route');
  if (!routes.length) return null;
  const all = routes.flatMap((r) => r.pts);
  const b = bboxOf(all, 60);
  const c = document.createElement('canvas');
  c.width = Math.ceil((b.x1 - b.x0) * scale); c.height = Math.ceil((b.y1 - b.y0) * scale);
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale); ctx.translate(-b.x0, -b.y0);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const rng = new Rng(z.seed + 3);
  for (const r of routes) paintPath(ctx, r.pts, r.w, 'route', () => rng.next());
  return { canvas: c, x: b.x0, y: b.y0 };
}
