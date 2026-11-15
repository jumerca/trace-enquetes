// Primitives de dessin « BD franco-belge » : aplats, contour d'encre, ombrage en cellule.
export const INK = '#2b1e16';

/** Multiplicateur d'épaisseur des contours (mobilier, intérieurs : même famille de trait que les maisons). */
export const LW = { mul: 1 };

export type Ctx = CanvasRenderingContext2D;

// Chaque tracé est aussi enregistré dans un Path2D : ink() peut ombrer (clip + nouveaux tracés) puis
// encrer le contour d'origine.
if (typeof CanvasRenderingContext2D !== 'undefined' && typeof Path2D !== 'undefined') {
  const P = CanvasRenderingContext2D.prototype as any;
  if (!P.__recPatched) {
    P.__recPatched = true;
    for (const m of ['moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'arc', 'arcTo', 'ellipse', 'rect', 'closePath']) {
      const orig = P[m];
      P[m] = function (this: any, ...a: any[]) { orig.apply(this, a); if (this.__p) this.__p[m](...a); };
    }
    const bp = P.beginPath;
    P.beginPath = function (this: any) { bp.call(this); this.__p = new Path2D(); };
  }
}

export function canvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

/** Assombrit (k<0) ou éclaircit (k>0) une couleur hexadécimale. */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (k < 0) { r *= 1 + k; g *= 1 + k; b *= 1 + k; } else { r += (255 - r) * k; g += (255 - g) * k; b += (255 - b) * k; }
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

export function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const [r1, g1, b1] = ch(pa), [r2, g2, b2] = ch(pb);
  const h = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return '#' + h(r1 + (r2 - r1) * t) + h(g1 + (g2 - g1) * t) + h(b1 + (b2 - b1) * t);
}

export function rgba(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Remplit le chemin courant, ajoute une ombre propre (clip) puis le contour d'encre. */
export function ink(ctx: Ctx, fill: string, lw: number, opts: { shadeFn?: () => void; shadeCol?: string; light?: () => void; lightCol?: string; stroke?: string | null } = {}): void {
  const path: Path2D | undefined = (ctx as any).__p;
  ctx.fillStyle = fill;
  ctx.fill();
  if ((opts.shadeFn || opts.light) && path) {
    ctx.save();
    ctx.clip(path);
    if (opts.shadeFn) { ctx.fillStyle = opts.shadeCol ?? shade(fill, -0.22); ctx.beginPath(); opts.shadeFn(); ctx.fill(); }
    if (opts.light) { ctx.fillStyle = opts.lightCol ?? shade(fill, 0.22); ctx.beginPath(); opts.light(); ctx.fill(); }
    ctx.restore();
  }
  if (opts.stroke !== null) {
    ctx.strokeStyle = opts.stroke ?? INK;
    ctx.lineWidth = lw * LW.mul;
    if (path) ctx.stroke(path); else ctx.stroke();
  }
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, rot = 0): void {
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Capsule (membre) entre deux points, largeurs w1 → w2. */
export function capsule(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w1: number, w2: number): void {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const px = Math.cos(a + Math.PI / 2), py = Math.sin(a + Math.PI / 2);
  ctx.moveTo(x1 + px * w1 / 2, y1 + py * w1 / 2);
  ctx.lineTo(x2 + px * w2 / 2, y2 + py * w2 / 2);
  ctx.arc(x2, y2, w2 / 2, a + Math.PI / 2, a - Math.PI / 2, true);
  ctx.lineTo(x1 - px * w1 / 2, y1 - py * w1 / 2);
  ctx.arc(x1, y1, w1 / 2, a - Math.PI / 2, a + Math.PI / 2, true);
  ctx.closePath();
}

/** Contour « blob » irrégulier (feuillages, buissons, rochers). */
export function blob(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, jitter: number, rnd: () => number, phase = 0): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const k = 1 - jitter / 2 + rnd() * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  smoothClosed(ctx, pts);
}

export function smoothClosed(ctx: Ctx, pts: [number, number][]): void {
  const n = pts.length;
  const mid = (i: number) => { const a = pts[i % n], b = pts[(i + 1) % n]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const m0 = mid(0);
  ctx.moveTo(m0[0], m0[1]);
  for (let i = 1; i <= n; i++) {
    const p = pts[i % n], m = mid(i);
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/** Contour festonné (nuage) : petits arcs le long d'une ellipse. */
export function scallop(ctx: Ctx, cx: number, cy: number, rx: number, ry: number, n: number, bump: number, rnd: () => number): void {
  const pts: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ang = Math.atan2(my - cy, mx - cx);
    const k = bump * (0.7 + rnd() * 0.6);
    ctx.quadraticCurveTo(mx + Math.cos(ang) * k * 2, my + Math.sin(ang) * k * 2, b[0], b[1]);
  }
  ctx.closePath();
}

export function softShadow(ctx: Ctx, x: number, y: number, rx: number, ry: number, a = 0.28): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, rx);
  g.addColorStop(0, `rgba(30,22,40,${a})`);
  g.addColorStop(0.6, `rgba(30,22,40,${a * 0.7})`);
  g.addColorStop(1, 'rgba(30,22,40,0)');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1, ry / rx);
  ctx.translate(-x, -y);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function line(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, col: string, w: number): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
