// AtlasSystem : brouillard des zones explorées, rendu des cartes de l'atlas (style parchemin), traces révélées.
import { S, ZoneId } from '../core/state';
import { ZONES } from '../world/zones';
import { paintChunk } from '../art/ground';
import { evalCond } from '../world/types';
import { INK } from '../art/draw';

const FOG = 64;
const OUTDOOR: ZoneId[] = ['clairval', 'bois', 'moulin'];
const bits = new Map<ZoneId, Uint8Array>();

function grid(z: ZoneId): Uint8Array {
  let g = bits.get(z);
  if (g) return g;
  const Z = ZONES[z];
  g = new Uint8Array(Math.ceil(Z.w / FOG) * Math.ceil(Z.h / FOG));
  const enc = S.discovered[z];
  if (enc) { const raw = atob(enc); for (let i = 0; i < g.length && i < raw.length * 8; i++) g[i] = (raw.charCodeAt(i >> 3) >> (i & 7)) & 1; }
  bits.set(z, g);
  return g;
}
export function resetFog() { bits.clear(); }

export function revealAround(z: ZoneId, x: number, y: number, r = 300): boolean {
  if (!OUTDOOR.includes(z)) return false;
  const Z = ZONES[z]; const g = grid(z); const cols = Math.ceil(Z.w / FOG);
  let changed = false;
  const c0 = Math.max(0, Math.floor((x - r) / FOG)), c1 = Math.min(cols - 1, Math.floor((x + r) / FOG));
  const r0 = Math.max(0, Math.floor((y - r) / FOG)), r1 = Math.min(Math.ceil(Z.h / FOG) - 1, Math.floor((y + r) / FOG));
  for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
    const i = rr * cols + cc;
    if (!g[i] && Math.hypot(cc * FOG + 32 - x, rr * FOG + 32 - y) < r) { g[i] = 1; changed = true; }
  }
  if (changed) {
    let s = ''; for (let i = 0; i < g.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) b |= (g[i + k] ?? 0) << k; s += String.fromCharCode(b); }
    S.discovered[z] = btoa(s);
  }
  return changed;
}

export function explored(z: ZoneId): number { const g = grid(z); let n = 0; for (const v of g) n += v; return n / g.length; }

const baseCache = new Map<string, HTMLCanvasElement>();

/** Carte d'une zone pour l'atlas : sol peint en petit, bâtiments et arbres en symboles, brouillard parchemin. */
export function renderMap(z: ZoneId, maxW: number, opts: { hero?: [number, number]; marks?: { x: number; y: number; label: string; col?: string }[] } = {}): HTMLCanvasElement {
  const Z = ZONES[z];
  const sc = Math.min(maxW / Z.w, 0.5);
  const W = Math.round(Z.w * sc), H = Math.round(Z.h * sc);
  const flag = (f: string) => !!S.flags[f];
  const key = `${z}:${W}:${flag('route_revealed')}:${flag('stones_solved')}:${flag('passage_open')}`;
  let base = baseCache.get(key);
  if (!base) {
    base = paintChunk(Z, 0, 0, sc, flag, Math.max(Z.w, Z.h), false);
    const ctx = base.getContext('2d')!;
    ctx.save(); ctx.scale(sc, sc);
    for (const p of Z.props) {
      if (!evalCond(p.cond, flag)) continue;
      if (p.tex.startsWith('house') || p.tex.startsWith('mill')) { ctx.fillStyle = '#a0503a'; ctx.strokeStyle = INK; ctx.lineWidth = 3 / sc / 4; ctx.fillRect(p.x - 100, p.y - 90, 200, 90); ctx.strokeRect(p.x - 100, p.y - 90, 200, 90); }
      else if (p.tex.startsWith('tree')) { ctx.fillStyle = 'rgba(40,80,40,0.55)'; ctx.beginPath(); ctx.arc(p.x, p.y - 20, 34, 0, Math.PI * 2); ctx.fill(); }
      else if (p.tex.startsWith('mist')) { ctx.fillStyle = 'rgba(230,230,240,0.7)'; ctx.fillRect(p.x - 140, p.y - 70, 280, 80); }
    }
    ctx.restore();
    // virage parchemin
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = 'rgba(190,150,90,0.55)'; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';
    baseCache.set(key, base);
  }
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(base, 0, 0);
  // brouillard
  if (OUTDOOR.includes(z)) {
    const g = grid(z); const cols = Math.ceil(Z.w / FOG);
    ctx.fillStyle = '#efe2c0';
    for (let i = 0; i < g.length; i++) if (!g[i]) { const c = i % cols, r = (i / cols) | 0; ctx.fillRect(Math.floor(c * FOG * sc), Math.floor(r * FOG * sc), Math.ceil(FOG * sc) + 1, Math.ceil(FOG * sc) + 1); }
  }
  // traces révélées
  ctx.save(); ctx.scale(sc, sc);
  ctx.setLineDash([18, 14]); ctx.lineCap = 'round';
  const trace = (pts: [number, number][]) => { ctx.strokeStyle = 'rgba(217,138,43,0.95)'; ctx.lineWidth = 10; ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  if (z === 'clairval' && S.traces.includes('route_bornes')) trace([[1640, 1150], [2640, 1150], [2640, 830], [2860, 600], ...(flag('route_revealed') ? [[3008, 470] as [number, number]] : [])]);
  if (z === 'bois' && S.traces.includes('route_bois')) trace([[1100, 760], [1100, 540], [1150, 300], [1150, 0]]);
  if (z === 'bois' && flag('passage_open')) trace([[560, 1370], [480, 1300], [400, 1180], [300, 1000]]);
  if (z === 'moulin' && flag('route_revealed')) { trace([[1190, 960], [800, 1180], [420, 1400], [0, 1500]]); trace([[1190, 960], [1500, 1110], [2400, 1060]]); }
  ctx.setLineDash([]);
  for (const m of opts.marks ?? []) { ctx.fillStyle = m.col ?? '#c0523a'; ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(m.x, m.y, 26, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  if (opts.hero) { const [x, y] = opts.hero; ctx.fillStyle = '#2f7f86'; ctx.strokeStyle = '#fff6dc'; ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(x, y, 34, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(1, 1, W - 2, H - 2);
  return out;
}
