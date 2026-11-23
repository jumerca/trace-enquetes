// Recherche de chemin A* sur la grille (8 directions, pas de coupe de coin à travers un obstacle).
// Les tampons sont réutilisés d'un appel à l'autre (grande carte : pas d'allocation à chaque recherche).
export type CostFn = (x: number, y: number) => number; // Infinity = infranchissable

class Heap {
  items: number[] = [];
  prio: number[] = [];
  clear() {
    this.items.length = 0;
    this.prio.length = 0;
  }
  get size() {
    return this.items.length;
  }
  push(item: number, p: number) {
    const a = this.items, q = this.prio;
    a.push(item);
    q.push(p);
    let i = a.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (q[parent] <= q[i]) break;
      [a[parent], a[i]] = [a[i], a[parent]];
      [q[parent], q[i]] = [q[i], q[parent]];
      i = parent;
    }
  }
  pop(): number {
    const a = this.items, q = this.prio;
    const top = a[0];
    const lastA = a.pop()!, lastQ = q.pop()!;
    if (a.length) {
      a[0] = lastA;
      q[0] = lastQ;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && q[l] < q[m]) m = l;
        if (r < a.length && q[r] < q[m]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        [q[m], q[i]] = [q[i], q[m]];
        i = m;
      }
    }
    return top;
  }
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
];

let bufN = 0;
let g = new Float32Array(0);
let from = new Int32Array(0);
let stamp = new Uint32Array(0); // case visitée lors de la recherche n° stamp
let closedStamp = new Uint32Array(0);
let gen = 0;
const open = new Heap();

/** Retourne la liste des cases de départ (exclu) à arrivée (inclus), ou null si inaccessible. */
export function findPath(w: number, h: number, sx: number, sy: number, tx: number, ty: number, cost: CostFn, maxNodes = 40000): [number, number][] | null {
  if (sx === tx && sy === ty) return [];
  if (!isFinite(cost(tx, ty))) return null;
  const N = w * h;
  if (bufN !== N) {
    bufN = N;
    g = new Float32Array(N);
    from = new Int32Array(N);
    stamp = new Uint32Array(N);
    closedStamp = new Uint32Array(N);
    gen = 0;
  }
  gen++;
  const start = sy * w + sx, goal = ty * w + tx;
  const heur = (x: number, y: number) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return (dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy)) * 0.95;
  };
  open.clear();
  stamp[start] = gen;
  g[start] = 0;
  from[start] = -1;
  open.push(start, heur(sx, sy));
  let visited = 0, found = false;
  while (open.size) {
    const cur = open.pop();
    if (closedStamp[cur] === gen) continue;
    if (cur === goal) {
      found = true;
      break;
    }
    closedStamp[cur] = gen;
    if (++visited > maxNodes) return null;
    const cx = cur % w, cy = (cur - cx) / w;
    for (const [dx, dy, mul] of DIRS) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (closedStamp[ni] === gen) continue;
      const c = cost(nx, ny);
      if (!isFinite(c)) continue;
      if (dx && dy && (!isFinite(cost(cx + dx, cy)) || !isFinite(cost(cx, cy + dy)))) continue; // pas de coupe de coin
      const ng = g[cur] + c * mul;
      if (stamp[ni] !== gen || ng < g[ni]) {
        stamp[ni] = gen;
        g[ni] = ng;
        from[ni] = cur;
        open.push(ni, ng + heur(nx, ny));
      }
    }
  }
  if (!found) return null;
  const path: [number, number][] = [];
  for (let c = goal; c !== start; c = from[c]) path.push([c % w, Math.floor(c / w)]);
  return path.reverse();
}
