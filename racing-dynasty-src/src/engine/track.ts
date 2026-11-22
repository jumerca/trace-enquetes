// Géométrie de circuit : spline fermée échantillonnée, courbure, trajectoire idéale, zones de dépassement.

export interface TrackDef {
  id: string;
  name: string; // nom du circuit
  gp: string; // nom du Grand Prix
  place: string;
  theme: 'port' | 'foret' | 'desert' | 'lac' | 'montagne';
  width: number; // largeur de piste (m)
  points: [number, number][]; // points de contrôle (m), sens de course, le premier est sur la ligne droite principale
  pitSide: 1 | -1; // côté de la voie des stands (+1 = gauche dans le sens de course)
  wear: number; // usure de base en % par tour (médium, pilote moyen)
  suspOpt: number; // raideur idéale 0..100 (bosses, vibreurs)
  overtaking: number; // facilité de dépassement 0..1
  rainChance: number;
  description: string;
  night?: boolean; // course de nuit sous projecteurs
  fog?: boolean; // nappes de brouillard
  sunset?: boolean; // lumière de fin de journée
}

export interface Track {
  def: TrackDef;
  ds: number;
  n: number;
  length: number;
  x: Float32Array;
  y: Float32Array;
  nx: Float32Array; // normale gauche
  ny: Float32Array;
  heading: Float32Array;
  curv: Float32Array; // courbure lissée signée (1/m), > 0 = virage à gauche
  line: Float32Array; // décalage latéral de la trajectoire idéale (m)
  zone: Uint8Array; // 1 = zone propice au dépassement (ligne droite devant)
  corner: Float32Array; // 0..1 intensité de virage
  half: number; // demi-largeur
  pitEntry: number; // abscisse (m, dans [0, L)) d'entrée des stands
  pitExit: number; // abscisse de sortie (après la ligne)
  pitLat: number; // décalage latéral de la voie rapide des stands
  boxLat: number; // décalage latéral des emplacements
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function smooth(src: Float32Array, radius: number): Float32Array {
  const n = src.length;
  const out = new Float32Array(n);
  let acc = 0;
  for (let i = -radius; i <= radius; i++) acc += src[(i + n) % n];
  const w = 2 * radius + 1;
  for (let i = 0; i < n; i++) {
    out[i] = acc / w;
    acc += src[(i + radius + 1) % n] - src[(i - radius + n) % n];
  }
  return out;
}

export function buildTrack(def: TrackDef, ds = 2): Track {
  const P = def.points;
  const m = P.length;
  // 1) Échantillonnage dense de la spline.
  const dense: [number, number][] = [];
  const sub = 40;
  for (let i = 0; i < m; i++) {
    const a = P[(i - 1 + m) % m], b = P[i], c = P[(i + 1) % m], d = P[(i + 2) % m];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      dense.push([catmull(a[0], b[0], c[0], d[0], t), catmull(a[1], b[1], c[1], d[1], t)]);
    }
  }
  // 2) Rééchantillonnage à pas constant.
  const cum: number[] = [0];
  for (let i = 1; i <= dense.length; i++) {
    const p = dense[i - 1], q = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(q[0] - p[0], q[1] - p[1]));
  }
  const total = cum[cum.length - 1];
  const n = Math.round(total / ds);
  const step = total / n;
  const x = new Float32Array(n), y = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const s = i * step;
    while (cum[j + 1] < s) j++;
    const f = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    const p = dense[j], q = dense[(j + 1) % dense.length];
    x[i] = p[0] + (q[0] - p[0]) * f;
    y[i] = p[1] + (q[1] - p[1]) * f;
  }
  // 3) Tangentes, normales, cap, courbure.
  const nx = new Float32Array(n), ny = new Float32Array(n), heading = new Float32Array(n), raw = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    const tx = x[b] - x[a], ty = y[b] - y[a];
    const l = Math.hypot(tx, ty) || 1;
    heading[i] = Math.atan2(ty, tx);
    // Repère écran (y vers le bas) : la gauche du pilote est (ty, -tx).
    nx[i] = ty / l;
    ny[i] = -tx / l;
  }
  for (let i = 0; i < n; i++) {
    let dh = heading[(i + 1) % n] - heading[(i - 1 + n) % n];
    while (dh > Math.PI) dh -= 2 * Math.PI;
    while (dh < -Math.PI) dh += 2 * Math.PI;
    raw[i] = -dh / (2 * step); // y écran vers le bas → signe inversé : > 0 = virage à gauche
  }
  const curv = smooth(smooth(raw, 4), 3);
  const half = def.width / 2;
  // 4) Trajectoire idéale : extérieur – corde – extérieur.
  const wide = smooth(curv, Math.round(70 / step));
  const lineRaw = new Float32Array(n);
  const look = Math.round(55 / step);
  for (let i = 0; i < n; i++) {
    const here = smooth3(curv, i, n);
    const around = 0.5 * (wide[(i - look + n) % n] + wide[(i + look) % n]);
    lineRaw[i] = 900 * (here - 0.85 * around) + 260 * here;
  }
  const line = smooth(lineRaw, Math.round(14 / step));
  const lim = half - 1.6;
  for (let i = 0; i < n; i++) line[i] = Math.max(-lim, Math.min(lim, line[i]));
  // 5) Intensité de virage et zones de dépassement (ligne droite sur ~160 m).
  const corner = new Float32Array(n);
  for (let i = 0; i < n; i++) corner[i] = Math.min(1, Math.abs(curv[i]) * 60);
  const zone = new Uint8Array(n);
  const ahead = Math.round(140 / step);
  for (let i = 0; i < n; i++) {
    let mx = 0;
    for (let k = 0; k < ahead; k += 3) mx = Math.max(mx, corner[(i + k) % n]);
    zone[i] = mx < 0.22 ? 1 : 0;
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, x[i]); maxX = Math.max(maxX, x[i]);
    minY = Math.min(minY, y[i]); maxY = Math.max(maxY, y[i]);
  }
  const length = n * step;
  return {
    def, ds: step, n, length, x, y, nx, ny, heading, curv, line, zone, corner, half,
    pitEntry: length - 240,
    pitExit: 230,
    pitLat: def.pitSide * (half + 8),
    boxLat: def.pitSide * (half + 12),
    bounds: { minX, minY, maxX, maxY },
  };
}

function smooth3(a: Float32Array, i: number, n: number): number {
  return (a[(i - 1 + n) % n] + a[i] + a[(i + 1) % n]) / 3;
}

/** Index d'échantillon et fraction pour une abscisse quelconque (peut être négative ou > L). */
export function locate(t: Track, s: number): { i: number; f: number } {
  let u = s % t.length;
  if (u < 0) u += t.length;
  const p = u / t.ds;
  const i = Math.floor(p) % t.n;
  return { i, f: p - Math.floor(p) };
}

export function sampleLerp(t: Track, arr: Float32Array, s: number): number {
  const { i, f } = locate(t, s);
  return arr[i] + (arr[(i + 1) % t.n] - arr[i]) * f;
}

/** Position monde d'un point (abscisse s, décalage latéral lat). */
export function worldPos(t: Track, s: number, lat: number, out: { x: number; y: number }): void {
  const { i, f } = locate(t, s);
  const k = (i + 1) % t.n;
  const x = t.x[i] + (t.x[k] - t.x[i]) * f;
  const y = t.y[i] + (t.y[k] - t.y[i]) * f;
  const nx = t.nx[i] + (t.nx[k] - t.nx[i]) * f;
  const ny = t.ny[i] + (t.ny[k] - t.ny[i]) * f;
  out.x = x + nx * lat;
  out.y = y + ny * lat;
}

/** Distance (m) le long du tracé de a vers b dans [0, L). */
export function forwardDist(t: Track, a: number, b: number): number {
  let d = (b - a) % t.length;
  if (d < 0) d += t.length;
  return d;
}
