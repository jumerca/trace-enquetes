// Modèles 3D (three.js) des monoplaces et de la voiture de sécurité, « cuits » en images sous tous les angles.
// Ombrage façon cel-shading (3 tons) + contour encré BD. Les images sont calculées une fois au chargement de la
// course puis affichées comme de simples sprites : aucun coût 3D pendant la course.
import {
  AmbientLight, BoxGeometry, ConeGeometry, DodecahedronGeometry, IcosahedronGeometry, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, CylinderGeometry, DataTexture,
  DirectionalLight, DoubleSide, EdgesGeometry, ExtrudeGeometry, Group, LineBasicMaterial, LineSegments, Mesh,
  MeshBasicMaterial, MeshToonMaterial, NearestFilter, Object3D, OrthographicCamera, PerspectiveCamera, PlaneGeometry,
  RedFormat, Scene, Shape, SphereGeometry, SRGBColorSpace, TubeGeometry, Vector3, WebGLRenderer,
} from 'three';

export interface Livery3D {
  color: string;
  color2: string;
  sponsor?: string;
  sponsorColor?: string;
  short?: string;
}

/** Planche d'images : `frames` vues réparties sur 360° (index k ↔ lacet φ = k·2π/frames). */
export interface Atlas {
  canvas: HTMLCanvasElement;
  frames: number;
  cols: number;
  fw: number; // largeur d'une vue (px)
  fh: number;
  /** mètres couverts par la largeur d'une vue */
  spanW: number;
  spanH: number;
  /** position verticale (0..1 depuis le haut) du point au sol sous le centre de la voiture */
  originY: number;
}

// ------------------------------------------------------------------ matériaux

let gradient: DataTexture | null = null;
function toonGradient(): DataTexture {
  if (gradient) return gradient;
  const data = new Uint8Array([90, 170, 255]); // trois tons francs : ombre, mi-teinte, lumière
  gradient = new DataTexture(data, 3, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.needsUpdate = true;
  return gradient;
}

const matCache = new Map<string, MeshToonMaterial>();
function toon(color: string): MeshToonMaterial {
  let m = matCache.get(color);
  if (!m) {
    m = new MeshToonMaterial({ color: new Color(color), gradientMap: toonGradient() });
    matCache.set(color, m);
  }
  return m;
}
const inkMat = new LineBasicMaterial({ color: 0x16130f });

/** Ajoute un maillage avec ses arêtes vives encrées. */
function part(g: Group, geo: BufferGeometry, color: string, x = 0, y = 0, z = 0, ink = true): Mesh {
  const m = new Mesh(geo, toon(color));
  m.position.set(x, y, z);
  if (ink) m.add(new LineSegments(new EdgesGeometry(geo, 35), inkMat));
  g.add(m);
  return m;
}

/** Profil latéral (plan XY) extrudé en largeur (axe Z), centré. */
function extrude(pts: [number, number][], width: number, bevel = 0.04): ExtrudeGeometry {
  const s = new Shape();
  s.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  const geo = new ExtrudeGeometry(s, { depth: Math.max(0.001, width - 2 * bevel), bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -(width - 2 * bevel) / 2);
  return geo;
}

function textPlane(text: string, bg: string, fg: string, w: number, h: number): Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = Math.round((256 * h) / w);
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = fg;
  g.font = `bold ${Math.round(c.height * 0.72)}px Bangers, Impact, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text.toUpperCase().slice(0, 12), c.width / 2, c.height / 2 + 2, c.width * 0.92);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ map: tex, side: DoubleSide }));
}

function wheel(g: Group, x: number, z: number, r: number, wdt: number): void {
  const tyre = new CylinderGeometry(r, r, wdt, 22);
  tyre.rotateX(Math.PI / 2);
  part(g, tyre, '#1d1d22', x, r, z);
  const rim = new CylinderGeometry(r * 0.62, r * 0.62, wdt + 0.012, 18);
  rim.rotateX(Math.PI / 2);
  part(g, rim, '#8d929b', x, r, z, false);
  const hub = new CylinderGeometry(r * 0.2, r * 0.2, wdt + 0.03, 8);
  hub.rotateX(Math.PI / 2);
  part(g, hub, '#2a2c33', x, r, z, false);
  // flanc de pneu marqué (liseré jaune)
  const band = new CylinderGeometry(r * 0.84, r * 0.84, wdt + 0.006, 22, 1, true);
  band.rotateX(Math.PI / 2);
  part(g, band, '#ffd400', x, r, z, false);
}

function rod(g: Group, a: [number, number, number], b: [number, number, number], r = 0.022, color = '#26272e'): void {
  const va = new Vector3(...a), vb = new Vector3(...b);
  const len = va.distanceTo(vb);
  const geo = new CylinderGeometry(r, r, len, 6);
  const m = new Mesh(geo, toon(color));
  m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), vb.clone().sub(va).normalize());
  g.add(m);
}

// ------------------------------------------------------------------ monoplace

/** Monoplace (origine au sol, centre de l'empattement ; avant vers +X, haut +Y). Longueur ≈ 5,4 m. */
export function buildF1(l: Livery3D, opts: { driver?: boolean } = {}): Group {
  const g = new Group();
  const C = l.color, C2 = l.color2, K = '#1f2026';
  // fond plat et diffuseur
  part(g, new BoxGeometry(3.7, 0.05, 1.45), K, 0.05, 0.07, 0);
  part(g, extrude([[-2.25, 0.05], [-1.75, 0.05], [-1.75, 0.3], [-2.25, 0.42]], 1.0, 0.01), K);
  // nez : cône aplati
  const nose = new CylinderGeometry(0.09, 0.23, 1.35, 14);
  nose.rotateZ(-Math.PI / 2);
  nose.scale(1, 0.75, 1.25);
  part(g, nose, C, 2.0, 0.34, 0);
  // museau et pointe aux couleurs secondaires
  const tip = new SphereGeometry(0.1, 10, 8);
  tip.scale(1.3, 0.7, 1.1);
  part(g, tip, C2, 2.68, 0.3, 0, false);
  // baquet / monocoque
  part(g, extrude([[0.25, 0.1], [1.4, 0.18], [1.45, 0.48], [0.95, 0.62], [0.3, 0.66]], 0.78, 0.07), C);
  // pontons sculptés
  for (const zz of [-1, 1]) {
    const pod = extrude([[-1.05, 0.12], [0.75, 0.12], [0.8, 0.48], [0.55, 0.56], [-0.35, 0.42], [-1.05, 0.26]], 0.46, 0.08);
    const m = part(g, pod, C, 0, 0, zz * 0.56);
    m.scale.z = 1;
    // entrée d'air noire
    part(g, new BoxGeometry(0.05, 0.26, 0.36), K, 0.78, 0.36, zz * 0.56, false);
    // sponsor sur le flanc
    if (l.sponsor) {
      const tp = textPlane(l.sponsor, l.sponsorColor ?? C2, '#ffffff', 0.95, 0.2);
      tp.position.set(-0.05, 0.32, zz * 0.8);
      if (zz < 0) tp.rotateY(Math.PI);
      g.add(tp);
    }
  }
  // capot moteur et prise d'air au-dessus du pilote
  part(g, extrude([[-1.95, 0.42], [-1.3, 0.48], [0.05, 0.86], [0.32, 0.98], [0.5, 0.98], [0.45, 0.62], [-1.9, 0.3]], 0.52, 0.09), C);
  part(g, new BoxGeometry(0.16, 0.16, 0.24), K, 0.42, 0.9, 0, false);
  // aileron de requin + bande de livrée
  part(g, extrude([[-2.1, 0.55], [-1.2, 0.6], [-0.2, 0.92], [-0.2, 0.98], [-2.1, 0.92]], 0.03, 0), C2);
  part(g, new BoxGeometry(1.8, 0.02, 0.2), C2, -0.6, 0.66, 0, false).rotation.z = 0.26;
  // pilote : casque + visière
  if (opts.driver !== false) {
    part(g, new SphereGeometry(0.15, 16, 12), C2, 0.72, 0.78, 0);
    const visor = new SphereGeometry(0.152, 12, 6, -0.9, 1.8, 1.15, 0.45);
    const vm = new Mesh(visor, toon('#14161c'));
    vm.position.set(0.72, 0.78, 0);
    vm.rotation.y = Math.PI / 2;
    g.add(vm);
  }
  // halo
  const halo = new CatmullRomCurve3([
    new Vector3(0.28, 0.66, -0.34), new Vector3(0.55, 0.88, -0.3), new Vector3(0.95, 0.9, 0), new Vector3(0.55, 0.88, 0.3), new Vector3(0.28, 0.66, 0.34),
  ]);
  part(g, new TubeGeometry(halo, 24, 0.035, 6, false), '#1b1c22', 0, 0, 0, false);
  part(g, new TubeGeometry(new CatmullRomCurve3([new Vector3(0.95, 0.9, 0), new Vector3(1.12, 0.62, 0)]), 4, 0.03, 6, false), '#1b1c22', 0, 0, 0, false);
  // rétroviseurs
  for (const zz of [-1, 1]) {
    rod(g, [1.0, 0.6, zz * 0.32], [1.02, 0.72, zz * 0.48], 0.015, C);
    part(g, new BoxGeometry(0.06, 0.07, 0.16), C, 1.02, 0.74, zz * 0.5);
  }
  // aileron avant (3 éléments + dérives)
  part(g, new BoxGeometry(0.42, 0.03, 1.95), K, 2.55, 0.1, 0);
  part(g, new BoxGeometry(0.22, 0.025, 1.85), C2, 2.42, 0.16, 0).rotation.z = 0.25;
  part(g, new BoxGeometry(0.16, 0.022, 1.75), C, 2.34, 0.22, 0).rotation.z = 0.4;
  for (const zz of [-1, 1]) part(g, new BoxGeometry(0.5, 0.24, 0.03), C, 2.5, 0.18, zz * 0.98);
  rod(g, [2.25, 0.3, 0], [2.45, 0.12, 0], 0.03, K);
  // aileron arrière (plan principal + volet DRS + dérives + mât)
  part(g, new BoxGeometry(0.34, 0.04, 1.02), C2, -2.25, 0.82, 0);
  part(g, new BoxGeometry(0.22, 0.03, 1.02), C2, -2.18, 0.95, 0).rotation.z = 0.35;
  for (const zz of [-1, 1]) part(g, extrude([[-2.5, 0.45], [-1.95, 0.45], [-1.95, 1.0], [-2.5, 1.05]], 0.03, 0), C, 0, 0, zz * 0.52);
  rod(g, [-2.0, 0.42, 0], [-2.2, 0.82, 0], 0.03, K);
  // roues + suspensions
  wheel(g, 1.72, -0.8, 0.33, 0.3);
  wheel(g, 1.72, 0.8, 0.33, 0.3);
  wheel(g, -1.62, -0.8, 0.36, 0.4);
  wheel(g, -1.62, 0.8, 0.36, 0.4);
  for (const zz of [-1, 1]) {
    rod(g, [1.3, 0.42, zz * 0.3], [1.72, 0.36, zz * 0.66]);
    rod(g, [1.25, 0.22, zz * 0.3], [1.72, 0.26, zz * 0.66]);
    rod(g, [-1.15, 0.4, zz * 0.35], [-1.62, 0.4, zz * 0.62]);
    rod(g, [-1.2, 0.2, zz * 0.35], [-1.62, 0.26, zz * 0.62]);
  }
  // trigramme sur le capot
  if (l.short) {
    const tp = textPlane(l.short, C, C2, 0.6, 0.18);
    tp.rotation.x = -Math.PI / 2;
    tp.rotation.z = Math.PI / 2;
    tp.position.set(1.8, 0.47, 0);
    g.add(tp);
  }
  return g;
}

/** Voiture de sécurité : coupé blanc à bandes orange, rampe lumineuse. */
export function buildSafetyCar(): Group {
  const g = new Group();
  const W = '#f4f1ea', O = '#ff7a00', K = '#1f2026';
  part(g, extrude([[-2.3, 0.22], [2.3, 0.22], [2.35, 0.5], [2.0, 0.66], [0.9, 0.72], [0.25, 1.15], [-0.9, 1.18], [-1.8, 0.86], [-2.35, 0.8]], 1.9, 0.12), W);
  part(g, extrude([[0.85, 0.74], [0.3, 1.12], [-0.85, 1.14], [-1.6, 0.86]], 1.75, 0.02), '#2b3446', 0, 0.01, 0, false);
  part(g, new BoxGeometry(4.6, 0.06, 0.32), O, 0, 0.62, 0.86, false);
  part(g, new BoxGeometry(4.6, 0.06, 0.32), O, 0, 0.62, -0.86, false);
  part(g, new BoxGeometry(0.3, 0.1, 1.2), K, -0.3, 1.24, 0);
  part(g, new BoxGeometry(0.22, 0.08, 0.5), '#ffb000', -0.3, 1.32, -0.3, false);
  part(g, new BoxGeometry(0.22, 0.08, 0.5), '#3a86ff', -0.3, 1.32, 0.3, false);
  for (const [x, z] of [[1.45, -0.86], [1.45, 0.86], [-1.45, -0.86], [-1.45, 0.86]]) wheel(g, x, z, 0.36, 0.3);
  return g;
}

// ------------------------------------------------------------------ cuisson

let renderer: WebGLRenderer | null = null;
let rendererCanvas: HTMLCanvasElement | null = null;

function getRenderer(w: number, h: number): WebGLRenderer {
  if (!renderer) {
    rendererCanvas = document.createElement('canvas');
    renderer = new WebGLRenderer({ canvas: rendererCanvas, alpha: true, antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = SRGBColorSpace;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  return renderer;
}

/** Libère le contexte WebGL de cuisson (on n'en garde pas deux en parallèle de PixiJS). */
export function releaseBaker(): void {
  if (renderer) {
    renderer.dispose();
    renderer.forceContextLoss();
    renderer = null;
    rendererCanvas = null;
  }
}

function lights(scene: Scene): void {
  scene.add(new AmbientLight(0xffffff, 1.35));
  const sun = new DirectionalLight(0xffffff, 2.4);
  sun.position.set(-3, 6, 4); // haut, à gauche, vers le spectateur (comme les ombres portées du rendu 2,5D)
  scene.add(sun);
}

/** Contour encré : silhouette noire dilatée sous l'image. */
function inkOutline(dst: CanvasRenderingContext2D, src: HTMLCanvasElement, x: number, y: number, w: number, h: number, px: number): void {
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const t = tmp.getContext('2d')!;
  t.drawImage(src, 0, 0, w, h);
  t.globalCompositeOperation = 'source-in';
  t.fillStyle = '#16130f';
  t.fillRect(0, 0, w, h);
  for (let a = 0; a < 8; a++) {
    const ang = (a / 8) * Math.PI * 2;
    dst.drawImage(tmp, x + Math.cos(ang) * px, y + Math.sin(ang) * px);
  }
  dst.drawImage(src, 0, 0, w, h, x, y, w, h);
}

export interface BakeOptions {
  frames: number;
  fw: number;
  fh: number;
  /** élévation de la caméra au-dessus de l'horizon (degrés) */
  elevation: number;
  spanW: number;
  spanH: number;
  originY: number;
}

/** Les vues 2,5D : caméra orthographique inclinée comme la caméra du jeu (sin θ = TILT). */
export const VIEW_25D = (frames: number, px: number): BakeOptions => ({ frames, fw: px, fh: px, elevation: (Math.asin(0.64) * 180) / Math.PI, spanW: 6.6, spanH: 6.6, originY: 0.5 });
/** Les vues rasantes (caméra de bord de piste, vue cockpit). */
export const VIEW_LOW = (frames: number, px: number): BakeOptions => ({ frames, fw: px, fh: Math.round(px * 0.5), elevation: 7, spanW: 6.2, spanH: 3.1, originY: 0.78 });

const atlasCache = new Map<string, Atlas>();

/**
 * Rend un modèle sous `frames` angles dans une planche, en un seul passage : la caméra étant orthographique, des
 * copies du modèle décalées dans le plan de l'image se dessinent côte à côte sans déformation.
 * `cacheKey` : planche réutilisée d'une course à l'autre.
 */
export async function bakeAtlas(model: Object3D, o: BakeOptions, cacheKey?: string): Promise<Atlas> {
  const key = cacheKey ? `${cacheKey}|${o.frames}|${o.fw}|${o.fh}|${o.elevation}` : '';
  const hit = key ? atlasCache.get(key) : undefined;
  if (hit) return hit;
  const cols = Math.min(8, o.frames);
  const rows = Math.ceil(o.frames / cols);
  const W = cols * o.fw, H = rows * o.fh;
  const r = getRenderer(W, H);
  const scene = new Scene();
  lights(scene);
  const el = (o.elevation * Math.PI) / 180;
  const up = new Vector3(0, Math.cos(el), -Math.sin(el)); // axe vertical de l'image
  for (let k = 0; k < o.frames; k++) {
    const m = k === 0 ? model : model.clone();
    const holder = new Group();
    holder.add(m);
    holder.rotation.y = (k / o.frames) * Math.PI * 2;
    const col = k % cols, row = Math.floor(k / cols);
    const off = new Vector3(col * o.spanW, 0, 0).addScaledVector(up, -row * o.spanH);
    holder.position.copy(off);
    scene.add(holder);
  }
  const top = o.spanH * o.originY;
  const cam = new OrthographicCamera(-o.spanW / 2, -o.spanW / 2 + cols * o.spanW, top, top - rows * o.spanH, 0.1, 200);
  cam.position.set(0, Math.sin(el) * 60, Math.cos(el) * 60);
  cam.up.copy(up);
  cam.lookAt(0, 0, 0);
  r.render(scene, cam);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  inkOutline(canvas.getContext('2d')!, rendererCanvas!, 0, 0, W, H, Math.max(1, o.fw / 110));
  await new Promise((res) => setTimeout(res, 0));
  const atlas: Atlas = { canvas, frames: o.frames, cols, fw: o.fw, fh: o.fh, spanW: o.spanW, spanH: o.spanH, originY: o.originY };
  if (key) atlasCache.set(key, atlas);
  return atlas;
}

/** Index de vue pour un lacet φ (rad). */
export function frameFor(a: Atlas, phi: number): number {
  const n = a.frames;
  return ((Math.round((phi / (Math.PI * 2)) * n) % n) + n) % n;
}

/**
 * Le nez, les roues avant, le halo et les rétroviseurs vus du baquet, rendus en perspective pour correspondre à la
 * projection de la vue cockpit (focale `F` px, horizon à `horizonY`).
 */
export function bakeCockpit(l: Livery3D, w: number, h: number, F: number, horizonY: number, eyeH: number): HTMLCanvasElement {
  const r = getRenderer(w, h);
  const scene = new Scene();
  lights(scene);
  const car = buildF1(l, { driver: false });
  scene.add(car);
  const fov = (2 * Math.atan(h / 2 / F) * 180) / Math.PI;
  const cam = new PerspectiveCamera(fov, w / h, 0.05, 50);
  cam.position.set(0.7, eyeH, 0);
  cam.lookAt(10.7, eyeH, 0);
  // décale le centre optique pour placer l'horizon à horizonY
  cam.setViewOffset(w, h, 0, h / 2 - horizonY, w, h);
  r.render(scene, cam);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  inkOutline(out.getContext('2d')!, rendererCanvas!, 0, 0, w, h, Math.max(1.5, w / 500));
  return out;
}

// ------------------------------------------------------------------ décor

function rnd(seed: number): () => number {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function blob(r: number, seed: number): BufferGeometry {
  const geo = new IcosahedronGeometry(r, 1);
  const p = geo.attributes.position;
  const rr = rnd(seed);
  for (let i = 0; i < p.count; i++) {
    const k = 0.85 + rr() * 0.3;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

export type PropKind = 'feuillu' | 'sapin' | 'palmier' | 'buisson' | 'cactus' | 'rocher';

/** Végétation et rochers low-poly (origine au pied). */
export function buildPlant(kind: PropKind, pal: [string, string, string], seed: number): Group {
  const g = new Group();
  const r = rnd(seed);
  const [dark, mid, light] = pal;
  const trunk = (h: number, rad: number) => part(g, new CylinderGeometry(rad * 0.7, rad, h, 7), '#6b4a2b', 0, h / 2, 0);
  if (kind === 'feuillu') {
    const h = 3 + r() * 1.5;
    trunk(h, 0.28);
    const cols = [dark, mid, light];
    for (let k = 0; k < 4; k++) {
      const rad = 1.6 + r() * 0.9;
      part(g, blob(rad, seed * 7 + k), cols[k % 3], (r() - 0.5) * 2, h + 0.8 + r() * 1.6, (r() - 0.5) * 2);
    }
  } else if (kind === 'sapin') {
    trunk(1.4, 0.3);
    let y = 1.2;
    for (let k = 0; k < 3; k++) {
      const rad = 2.4 - k * 0.6, hh = 3 - k * 0.5;
      part(g, new ConeGeometry(rad, hh, 8), k % 2 ? mid : dark, 0, y + hh / 2, 0);
      y += hh * 0.55;
    }
  } else if (kind === 'palmier') {
    const pts = [new Vector3(0, 0, 0), new Vector3(0.4, 3, 0), new Vector3(1.2, 6, 0.2), new Vector3(1.6, 8, 0.3)];
    part(g, new TubeGeometry(new CatmullRomCurve3(pts), 10, 0.24, 6, false), '#8a6a43', 0, 0, 0, false);
    for (let k = 0; k < 7; k++) {
      const leaf = new ConeGeometry(0.45, 3.4, 4);
      leaf.scale(1, 1, 0.25);
      leaf.translate(0, 1.7, 0);
      const m = part(g, leaf, k % 2 ? mid : dark, 1.6, 8, 0.3);
      m.rotation.set(0, (k / 7) * Math.PI * 2, 1.9 + r() * 0.3, 'YZX');
    }
  } else if (kind === 'buisson') {
    for (let k = 0; k < 3; k++) part(g, blob(0.9 + r() * 0.5, seed + k), [dark, mid, light][k], (r() - 0.5) * 1.6, 0.6, (r() - 0.5) * 1.2);
  } else if (kind === 'cactus') {
    part(g, new CylinderGeometry(0.32, 0.36, 3.2, 8), mid, 0, 1.6, 0);
    part(g, new SphereGeometry(0.32, 8, 6), mid, 0, 3.2, 0);
    for (const sgn of [-1, 1]) {
      part(g, new CylinderGeometry(0.2, 0.2, 0.7, 7), mid, sgn * 0.55, 1.5 + sgn * 0.2, 0).rotation.z = Math.PI / 2;
      part(g, new CylinderGeometry(0.2, 0.2, 1.1, 7), light, sgn * 0.85, 2.0 + sgn * 0.2, 0);
    }
  } else {
    const geo = new DodecahedronGeometry(1.6, 0);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + r() * 0.3), Math.max(0, p.getY(i)) * 0.75, p.getZ(i) * (0.8 + r() * 0.3));
    geo.computeVertexNormals();
    part(g, geo, pal[1], 0, 0, 0);
  }
  return g;
}

/** Immeuble : façades fenêtrées (allumées la nuit), toit et équipements. */
export function buildBuilding(w: number, h: number, d: number, color: string, roof: string, night: boolean, seed: number): Group {
  const g = new Group();
  const r = rnd(seed);
  const facade = (fw: number) => {
    const c = document.createElement('canvas');
    c.width = 128;
    c.height = Math.round((128 * h) / fw);
    const x = c.getContext('2d')!;
    x.fillStyle = color;
    x.fillRect(0, 0, c.width, c.height);
    const cols = Math.max(2, Math.round(fw / 3)), rows = Math.max(2, Math.round(h / 3));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const lit = night ? r() < 0.55 : false;
      x.fillStyle = lit ? '#ffd27a' : night ? '#1b2340' : r() < 0.2 ? '#9fb6cc' : '#5d7890';
      x.fillRect((i + 0.22) * (c.width / cols), (j + 0.25) * (c.height / rows), (c.width / cols) * 0.56, (c.height / rows) * 0.5);
    }
    x.strokeStyle = '#16130f';
    x.lineWidth = 3;
    x.strokeRect(0, 0, c.width, c.height);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return new MeshToonMaterial({ map: t, gradientMap: toonGradient() });
  };
  const geo = new BoxGeometry(w, h, d);
  const roofMat = toon(roof);
  const mats = [facade(d), facade(d), roofMat, roofMat, facade(w), facade(w)];
  const m = new Mesh(geo, mats);
  m.position.y = h / 2;
  m.add(new LineSegments(new EdgesGeometry(geo), inkMat));
  g.add(m);
  part(g, new BoxGeometry(w + 0.4, 0.4, d + 0.4), roof, 0, h + 0.2, 0);
  part(g, new BoxGeometry(2, 1.2, 1.6), '#9aa0a8', (r() - 0.5) * (w - 3), h + 1, (r() - 0.5) * (d - 3));
  if (r() < 0.6) part(g, new CylinderGeometry(0.9, 0.9, 1.6, 10), '#6d7480', (r() - 0.5) * (w - 3), h + 1.2, (r() - 0.5) * (d - 3));
  return g;
}

/** Image unique d'un objet de décor vu par la caméra 2,5D. w, h : taille affichée en mètres (h écrasée par TILT). */
export function bakeProp(model: Object3D, spanW: number, spanH: number, pxPerM: number, yaw = 0.5, foot = 2): { cv: HTMLCanvasElement; w: number; h: number } {
  const fw = Math.round(spanW * pxPerM), fh = Math.round(spanH * pxPerM);
  const r = getRenderer(fw, fh);
  const scene = new Scene();
  lights(scene);
  model.rotation.y = yaw;
  scene.add(model);
  const el = Math.asin(0.64);
  // l'emprise au sol (rayon `foot`) doit rester dans l'image ; le jeu ancre les sprites à 97 % de leur hauteur
  const below = foot * 0.64 + spanH * 0.03;
  const cam = new OrthographicCamera(-spanW / 2, spanW / 2, spanH - below, -below, 0.1, 200);
  cam.position.set(0, Math.sin(el) * 80, Math.cos(el) * 80);
  cam.lookAt(0, 0, 0);
  r.render(scene, cam);
  const cv = document.createElement('canvas');
  cv.width = fw;
  cv.height = fh;
  inkOutline(cv.getContext('2d')!, rendererCanvas!, 0, 0, fw, fh, Math.max(1, pxPerM / 7));
  return { cv, w: spanW, h: spanH };
}
