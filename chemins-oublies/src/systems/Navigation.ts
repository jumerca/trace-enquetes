// NavigationSystem : grille de collisions (indépendante des dessins), A* 8 directions sans couper les coins,
// lissage par ligne de vue, obstacles temporaires (personnages), recherche de la case libre la plus proche.
import type { ZoneDef, Pt } from '../world/types';
import { evalCond } from '../world/types';
import { distToPolyline, pointInPoly } from '../world/geom';

export const CELL = 16;
const HERO_R = 9; // rayon du héros : les obstacles sont gonflés d'autant

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  readonly blocked: Uint8Array;
  readonly dyn: Uint8Array;
  private comp: Int32Array;

  constructor(readonly zone: ZoneDef, flag: (f: string) => boolean) {
    this.cols = Math.ceil(zone.w / CELL);
    this.rows = Math.ceil(zone.h / CELL);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.dyn = new Uint8Array(this.cols * this.rows);
    this.comp = new Int32Array(this.cols * this.rows);
    this.build(flag);
  }

  private build(flag: (f: string) => boolean) {
    const z = this.zone;
    const B = this.blocked;
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
      const x = c * CELL + CELL / 2, y = r * CELL + CELL / 2;
      let b = 0;
      if (z.walkPoly && !pointInPoly(x, y, z.walkPoly)) b = 1;
      if (!b && z.corridor) {
        const k = z.corridor;
        const ok = z.paths.some((p) => distToPolyline(x, y, p.pts) < p.w / 2 + k.pad) || k.clearings.some(([cx, cy, cr]) => Math.hypot((x - cx) / cr, (y - cy) / (cr * 0.8)) < 1);
        if (!ok) b = 1;
      }
      if (!b) for (const w of z.water) {
        if (distToPolyline(x, y, w.pts) < w.w / 2 + 4) {
          const onBridge = z.bridges.some((q) => x > q.x && x < q.x + q.w && y > q.y + 8 && y < q.y + q.h - 8);
          const bridgeOk = onBridge && (z.id !== 'moulin' || flag('route_revealed'));
          if (!bridgeOk) { b = 1; break; }
        }
      }
      B[r * this.cols + c] = b;
    }
    // bords de carte
    for (let c = 0; c < this.cols; c++) { B[c] = 1; B[(this.rows - 1) * this.cols + c] = 1; }
    for (let r = 0; r < this.rows; r++) { B[r * this.cols] = 1; B[r * this.cols + this.cols - 1] = 1; }
    // empreintes des décors
    for (const p of z.props) {
      if (!p.foot || !evalCond(p.cond, flag)) continue;
      if ('r' in p.foot) this.blockCircle(p.x, p.y - p.foot.r * 0.35, p.foot.r + HERO_R);
      else this.blockRect(p.x - p.foot.w / 2 - HERO_R, p.y - p.foot.h - (p.foot.dy ?? 0) - HERO_R * 0.6, p.foot.w + HERO_R * 2, p.foot.h + HERO_R * 1.2);
    }
    for (const q of z.blockers) if (evalCond(q.cond, flag)) this.blockRect(q.x, q.y, q.w, q.h);
    // les sorties restent franchissables (portes)
    for (const e of z.exits) {
      if (!e.door) continue;
      for (let y = e.rect.y - 8; y < e.rect.y + e.rect.h + 24; y += 8) for (let x = e.rect.x + 6; x < e.rect.x + e.rect.w - 6; x += 8) {
        const c = Math.floor(x / CELL), r = Math.floor(y / CELL);
        if (c > 0 && r > 0 && c < this.cols - 1 && r < this.rows - 1 && !(z.walkPoly && z.interior && y > 530)) this.blocked[r * this.cols + c] = 0;
      }
    }
    this.labelComponents();
  }

  blockCircle(x: number, y: number, r: number) {
    const c0 = Math.max(0, Math.floor((x - r) / CELL)), c1 = Math.min(this.cols - 1, Math.floor((x + r) / CELL));
    const r0 = Math.max(0, Math.floor((y - r * 0.6) / CELL)), r1 = Math.min(this.rows - 1, Math.floor((y + r * 0.6) / CELL));
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      const cx = cc * CELL + CELL / 2, cy = rr * CELL + CELL / 2;
      const dx = (cx - x) / r, dy = (cy - y) / (r * 0.6);
      if (dx * dx + dy * dy <= 1) this.blocked[rr * this.cols + cc] = 1;
    }
  }

  blockRect(x: number, y: number, w: number, h: number) {
    const c0 = Math.max(0, Math.floor(x / CELL)), c1 = Math.min(this.cols - 1, Math.floor((x + w - 1) / CELL));
    const r0 = Math.max(0, Math.floor(y / CELL)), r1 = Math.min(this.rows - 1, Math.floor((y + h - 1) / CELL));
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) this.blocked[rr * this.cols + cc] = 1;
  }

  private labelComponents() {
    this.comp.fill(-1);
    let id = 0;
    const stack: number[] = [];
    for (let i = 0; i < this.blocked.length; i++) {
      if (this.blocked[i] || this.comp[i] >= 0) continue;
      this.comp[i] = id; stack.push(i);
      while (stack.length) {
        const k = stack.pop()!;
        const c = k % this.cols, r = (k / this.cols) | 0;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc, nr = r + dr;
          if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
          const n = nr * this.cols + nc;
          if (!this.blocked[n] && this.comp[n] < 0) { this.comp[n] = id; stack.push(n); }
        }
      }
      id++;
    }
  }

  cellOf(x: number, y: number): [number, number] { return [Math.floor(x / CELL), Math.floor(y / CELL)]; }
  inside(c: number, r: number) { return c >= 0 && r >= 0 && c < this.cols && r < this.rows; }
  free(c: number, r: number, useDyn = true): boolean {
    if (!this.inside(c, r)) return false;
    const i = r * this.cols + c;
    return !this.blocked[i] && !(useDyn && this.dyn[i]);
  }
  freeAt(x: number, y: number, useDyn = false): boolean { const [c, r] = this.cellOf(x, y); return this.free(c, r, useDyn); }
  component(x: number, y: number): number { const [c, r] = this.cellOf(x, y); return this.inside(c, r) ? this.comp[r * this.cols + c] : -1; }

  /** Case libre la plus proche (spirale), dans le même composant que `from` si donné. */
  nearestFree(x: number, y: number, maxR = 12, sameAs?: [number, number]): Pt | null {
    const [c0, r0] = this.cellOf(x, y);
    const comp = sameAs ? this.component(sameAs[0], sameAs[1]) : -2;
    let best: Pt | null = null, bd = Infinity;
    for (let rad = 0; rad <= maxR; rad++) {
      for (let dr = -rad; dr <= rad; dr++) for (let dc = -rad; dc <= rad; dc++) {
        if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
        const c = c0 + dc, r = r0 + dr;
        if (!this.free(c, r, false)) continue;
        if (comp !== -2 && this.comp[r * this.cols + c] !== comp) continue;
        const px = c * CELL + CELL / 2, py = r * CELL + CELL / 2;
        const d = Math.hypot(px - x, py - y);
        if (d < bd) { bd = d; best = [px, py]; }
      }
      if (best && rad >= 1) return best;
    }
    return best;
  }

  /** Ligne de vue sur la grille (échantillonnée), en tenant compte des obstacles temporaires si demandé. */
  los(a: Pt, b: Pt, useDyn = true): boolean {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.ceil(d / 5);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t;
      // tolérance latérale : le héros a une largeur
      for (const [ox, oy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) {
        const [c, r] = this.cellOf(x + ox, y + oy);
        if (!this.free(c, r, useDyn)) return false;
      }
    }
    return true;
  }

  findPath(from: Pt, to: Pt, useDyn = true): Pt[] | null {
    const [sc, sr] = this.cellOf(from[0], from[1]);
    let [tc, tr] = this.cellOf(to[0], to[1]);
    const C = this.cols;
    let start = sr * C + sc;
    if (!this.free(sc, sr, false)) {
      const nf = this.nearestFree(from[0], from[1], 4);
      if (!nf) return null;
      const [c, r] = this.cellOf(nf[0], nf[1]); start = r * C + c;
    }
    if (!this.free(tc, tr, useDyn)) return null;
    const goal = tr * C + tc;
    if (this.comp[start] !== this.comp[goal]) return null;
    if (start === goal) return [to];
    if (this.los(from, to, useDyn)) return [to];

    const N = this.blocked.length;
    const g = new Float32Array(N).fill(Infinity);
    const came = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new Heap();
    const h = (i: number) => { const dx = Math.abs((i % C) - tc), dy = Math.abs(((i / C) | 0) - tr); return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy); };
    g[start] = 0; heap.push(start, h(start));
    let found = false, iter = 0;
    while (heap.size) {
      const cur = heap.pop();
      if (cur === goal) { found = true; break; }
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (++iter > 60000) break;
      const cc = cur % C, cr = (cur / C) | 0;
      for (let k = 0; k < 8; k++) {
        const dc = DIRS[k][0], dr = DIRS[k][1];
        const nc = cc + dc, nr = cr + dr;
        if (!this.free(nc, nr, useDyn)) continue;
        if (dc && dr && (!this.free(cc + dc, cr, useDyn) || !this.free(cc, cr + dr, useDyn))) continue;
        const n = nr * C + nc;
        if (closed[n]) continue;
        const ng = g[cur] + (dc && dr ? Math.SQRT2 : 1);
        if (ng < g[n]) { g[n] = ng; came[n] = cur; heap.push(n, ng + h(n) * 1.001); }
      }
    }
    if (!found) return null;
    const cells: Pt[] = [];
    for (let i = goal; i !== -1 && i !== start; i = came[i]) cells.push([(i % C) * CELL + CELL / 2, ((i / C) | 0) * CELL + CELL / 2]);
    cells.reverse();
    cells[cells.length - 1] = to;
    // lissage : on garde le point le plus lointain visible
    const out: Pt[] = [];
    let a: Pt = from;
    let i = 0;
    while (i < cells.length) {
      let j = cells.length - 1;
      while (j > i && !this.los(a, cells[j], useDyn)) j--;
      out.push(cells[j]);
      a = cells[j];
      i = j + 1;
    }
    return out;
  }

  clearDyn() { this.dyn.fill(0); }
  markDyn(x: number, y: number, r: number) {
    const c0 = Math.floor((x - r) / CELL), c1 = Math.floor((x + r) / CELL), r0 = Math.floor((y - r * 0.6) / CELL), r1 = Math.floor((y + r * 0.6) / CELL);
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) if (this.inside(cc, rr)) this.dyn[rr * this.cols + cc] = 1;
  }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

class Heap {
  private ids: number[] = [];
  private pr: number[] = [];
  get size() { return this.ids.length; }
  push(id: number, p: number) {
    const ids = this.ids, pr = this.pr;
    let i = ids.length; ids.push(id); pr.push(p);
    while (i > 0) { const pa = (i - 1) >> 1; if (pr[pa] <= p) break; ids[i] = ids[pa]; pr[i] = pr[pa]; i = pa; }
    ids[i] = id; pr[i] = p;
  }
  pop(): number {
    const ids = this.ids, pr = this.pr;
    const top = ids[0];
    const lid = ids.pop()!, lp = pr.pop()!;
    if (ids.length) {
      let i = 0; const n = ids.length;
      while (true) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && pr[c + 1] < pr[c]) c++;
        if (pr[c] >= lp) break;
        ids[i] = ids[c]; pr[i] = pr[c]; i = c;
      }
      ids[i] = lid; pr[i] = lp;
    }
    return top;
  }
}
