// Modèles 3D des véhicules (three.js, rendu « toon » encré) — OUTIL DE PRODUCTION D'ASSETS.
// Ils sont photographiés sous la caméra isométrique exacte du jeu (2:1, élévation 30°, azimut 45°)
// en 8 directions, puis enregistrés en planche PNG (public/sprites/). Le jeu n'embarque pas three.js.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export const PX_PER_UNIT = 64 / Math.SQRT2; // 1 unité = 1 case : la diagonale fait 64 px à l'écran

// ————— matériaux —————
const grad = (() => {
  const d = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 235, 235, 235, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();
const matCache = new Map<string, THREE.Material>();
export function toon(color: number, opts: { glass?: boolean; emissive?: number } = {}) {
  const k = `${color}:${opts.glass}:${opts.emissive}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: grad, transparent: !!opts.glass, opacity: opts.glass ? 0.55 : 1, emissive: opts.emissive ?? 0 });
    matCache.set(k, m);
  }
  return m;
}
const INK = new THREE.MeshBasicMaterial({ color: 0x2a1e14, side: THREE.BackSide });
const OUTLINE = 0.018;

/** Ajoute un maillage + sa coque d'encrage (contour). */
function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, ink = true) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  parent.add(m);
  if (ink && !(mat as THREE.MeshToonMaterial).transparent) {
    geo.computeBoundingBox();
    const s = new THREE.Vector3();
    geo.boundingBox!.getSize(s);
    const o = new THREE.Mesh(geo, INK);
    o.scale.set(1 + (2 * OUTLINE) / Math.max(s.x, 0.01), 1 + (2 * OUTLINE) / Math.max(s.y, 0.01), 1 + (2 * OUTLINE) / Math.max(s.z, 0.01));
    m.add(o);
  }
  return m;
}
const box = (p: THREE.Object3D, w: number, h: number, d: number, c: number | THREE.Material, x: number, y: number, z: number, r = 0.02) =>
  add(p, r > 0 ? new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2)) : new THREE.BoxGeometry(w, h, d), typeof c === 'number' ? toon(c) : c, x, y, z);

/** Roue : pneu à crampons, jante, moyeu ; axe selon z. phase = rotation (animation). */
function wheel(p: THREE.Object3D, r: number, w: number, rim: number, x: number, y: number, z: number, phase: number, lugs = true) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  p.add(g);
  const tyre = new THREE.CylinderGeometry(r, r, w, 28);
  tyre.rotateX(Math.PI / 2);
  add(g, tyre, toon(0x2c2a28));
  const rimG = new THREE.CylinderGeometry(r * 0.62, r * 0.62, w * 1.04, 20);
  rimG.rotateX(Math.PI / 2);
  add(g, rimG, toon(rim), 0, 0, 0, false);
  const hub = new THREE.CylinderGeometry(r * 0.2, r * 0.2, w * 1.12, 10);
  hub.rotateX(Math.PI / 2);
  add(g, hub, toon(0x3a3632), 0, 0, 0, false);
  // rayons/boulons visibles : donnent l'impression de rotation
  for (let k = 0; k < 6; k++) {
    const a = phase + (k / 6) * Math.PI * 2;
    const b = new THREE.BoxGeometry(r * 0.08, r * 0.08, w * 1.08);
    add(g, b, toon(0xe8e0c8), Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42, 0, false);
  }
  if (lugs) {
    const n = Math.round(r * 70);
    for (let k = 0; k < n; k++) {
      const a = phase + (k / n) * Math.PI * 2;
      for (const side of [-1, 1]) {
        const lug = new THREE.BoxGeometry(r * 0.16, r * 0.1, w * 0.46);
        const m = add(g, lug, toon(0x232120), Math.cos(a) * r * 1.01, Math.sin(a) * r * 1.01, (side * w) / 4, false);
        m.rotation.z = a + side * 0.5;
      }
    }
  }
  return g;
}

export interface Livery {
  body: number;
  rim: number;
  roof: number;
  stripe: number;
}
export const LIVERIES: Record<string, Livery> = {
  rouge: { body: 0xc4332b, rim: 0xd8d2c4, roof: 0xf0ece2, stripe: 0x2c2a28 },
  vert: { body: 0x2f7d3a, rim: 0xe6c84a, roof: 0x2f7d3a, stripe: 0xe6c84a },
  bleu: { body: 0x2a5ea8, rim: 0xf0ece2, roof: 0xf0ece2, stripe: 0x8a96a6 },
};

// ————— tracteur —————
export function tractor(lv: Livery, phase: number) {
  const t = new THREE.Group();
  wheel(t, 0.27, 0.17, lv.rim, -0.3, 0.27, 0.31, phase);
  wheel(t, 0.27, 0.17, lv.rim, -0.3, 0.27, -0.31, phase);
  wheel(t, 0.165, 0.11, lv.rim, 0.36, 0.165, 0.27, phase * 1.6);
  wheel(t, 0.165, 0.11, lv.rim, 0.36, 0.165, -0.27, phase * 1.6);
  box(t, 0.86, 0.1, 0.26, 0x3a3632, 0.02, 0.22, 0, 0.01); // châssis
  box(t, 0.5, 0.24, 0.3, lv.body, 0.3, 0.38, 0, 0.05); // capot
  box(t, 0.04, 0.17, 0.24, 0x2c2a28, 0.56, 0.37, 0, 0.01); // calandre
  for (let k = 0; k < 4; k++) box(t, 0.01, 0.012, 0.2, 0x8a8680, 0.585, 0.31 + k * 0.035, 0, 0);
  for (const z of [-0.1, 0.1]) box(t, 0.02, 0.04, 0.06, toon(0xfff4c8, { emissive: 0x605020 }), 0.58, 0.46, z, 0.005);
  box(t, 0.5, 0.025, 0.31, lv.stripe, 0.3, 0.44, 0, 0.005); // filet décoratif
  // garde-boue arrière
  for (const z of [-0.31, 0.31]) {
    box(t, 0.52, 0.04, 0.22, lv.body, -0.3, 0.57, z, 0.015);
    box(t, 0.04, 0.2, 0.22, lv.body, -0.05, 0.47, z, 0.01);
  }
  // cabine
  box(t, 0.44, 0.12, 0.44, lv.body, -0.25, 0.42, 0, 0.02);
  for (const [x, z] of [[-0.45, -0.21], [-0.45, 0.21], [-0.05, -0.21], [-0.05, 0.21]]) box(t, 0.035, 0.36, 0.035, 0x2c2a28, x, 0.66, z, 0.008);
  box(t, 0.4, 0.33, 0.42, toon(0x9cc8e0, { glass: true }), -0.25, 0.66, 0, 0.01);
  box(t, 0.12, 0.16, 0.14, 0x3a3632, -0.33, 0.58, 0, 0.02); // siège
  box(t, 0.52, 0.05, 0.5, lv.roof, -0.25, 0.86, 0, 0.02); // toit
  box(t, 0.04, 0.03, 0.1, toon(0xf0a020, { emissive: 0x804000 }), -0.25, 0.9, 0, 0.01); // gyrophare
  // échappement
  const ex = new THREE.CylinderGeometry(0.022, 0.022, 0.36, 10);
  add(t, ex, toon(0x2c2a28), 0.44, 0.62, -0.11);
  // attelage arrière
  box(t, 0.12, 0.05, 0.08, 0x2c2a28, -0.5, 0.25, 0, 0.01);
  return t;
}

export type Load = 'vide' | 'ble' | 'pommes' | 'foin' | 'raisin' | 'mais';

export function trailer(load: Load, phase: number) {
  const t = new THREE.Group();
  const L = 0.92, W = 0.6, H = 0.2, y0 = 0.3;
  box(t, 0.42, 0.04, 0.05, 0x2c2a28, 0.62, 0.24, 0, 0.01); // timon
  box(t, L, 0.05, W, 0x6b4a2c, 0, y0, 0, 0.01); // plancher
  const side = 0xb8453a;
  box(t, L, H, 0.035, side, 0, y0 + H / 2, W / 2, 0.01);
  box(t, L, H, 0.035, side, 0, y0 + H / 2, -W / 2, 0.01);
  box(t, 0.035, H, W, side, L / 2, y0 + H / 2, 0, 0.01);
  box(t, 0.035, H, W, side, -L / 2, y0 + H / 2, 0, 0.01);
  for (const x of [-0.25, 0, 0.25]) for (const z of [W / 2 + 0.02, -W / 2 - 0.02]) box(t, 0.02, H, 0.012, 0x7a2a22, x, y0 + H / 2, z, 0);
  for (const x of [-0.13, 0.13]) for (const z of [0.33, -0.33]) wheel(t, 0.15, 0.09, 0xd8d2c4, x, 0.15, z, phase, false);
  if (load === 'ble' || load === 'mais') {
    const g = new THREE.SphereGeometry(0.5, 20, 12);
    g.scale(0.85, 0.22, 0.56);
    add(t, g, toon(load === 'ble' ? 0xe0b84a : 0xf0c430), 0, y0 + H - 0.02, 0);
  } else if (load === 'pommes' || load === 'raisin') {
    const col = load === 'pommes' ? [0xc8302a, 0xd8502a, 0xe0a02a] : [0x5a2a6a, 0x6a3a7a];
    for (let i = 0; i < 70; i++) {
      const g = new THREE.SphereGeometry(0.035, 8, 6);
      const x = ((i % 10) / 9 - 0.5) * (L - 0.1), z = ((Math.floor(i / 10) % 7) / 6 - 0.5) * (W - 0.08);
      add(t, g, toon(col[i % col.length]), x, y0 + H - 0.01 + 0.03 * Math.sin(i * 7.1), z, false);
    }
  } else if (load === 'foin') {
    for (const x of [-0.22, 0.22]) {
      const g = new THREE.CylinderGeometry(0.19, 0.19, 0.5, 18);
      g.rotateX(Math.PI / 2);
      add(t, g, toon(0xd8b860), x, y0 + 0.21, 0);
    }
  }
  return t;
}

export function plough() {
  const t = new THREE.Group();
  box(t, 0.9, 0.06, 0.06, 0x2a5ea8, -0.1, 0.32, 0, 0.01);
  box(t, 0.14, 0.22, 0.32, 0x2a5ea8, 0.3, 0.3, 0, 0.02);
  for (let k = 0; k < 4; k++) {
    const x = 0.15 - k * 0.2, z = -0.12 + k * 0.08;
    box(t, 0.05, 0.2, 0.05, 0x2a5ea8, x, 0.2, z, 0.01);
    const s = box(t, 0.2, 0.12, 0.02, 0xc8ccd0, x - 0.04, 0.1, z + 0.04, 0.005);
    s.rotation.y = 0.6;
    s.rotation.z = -0.3;
  }
  wheel(t, 0.1, 0.06, 0xd8d2c4, -0.55, 0.1, 0.18, 0, false);
  return t;
}

export function seeder(phase: number) {
  const t = new THREE.Group();
  box(t, 0.4, 0.26, 0.86, 0x2f7d3a, -0.05, 0.42, 0, 0.03); // trémie
  box(t, 0.42, 0.04, 0.88, 0xe6c84a, -0.05, 0.56, 0, 0.01);
  box(t, 0.16, 0.06, 0.9, 0x3a3632, 0.15, 0.26, 0, 0.01);
  const roll = new THREE.CylinderGeometry(0.11, 0.11, 0.9, 16);
  roll.rotateX(Math.PI / 2);
  add(t, roll, toon(0x5a5652), -0.2, 0.11, 0);
  for (let k = 0; k < 6; k++) {
    const d = new THREE.CylinderGeometry(0.07, 0.07, 0.01, 12);
    d.rotateX(Math.PI / 2);
    const m = add(t, d, toon(0xc8ccd0), 0.12, 0.08, -0.4 + k * 0.16, false);
    m.rotation.z = phase;
  }
  return t;
}

/** Épandeur à fumier : caisse, hérissons rotatifs à l'arrière. */
export function spreader(phase: number) {
  const t = new THREE.Group();
  box(t, 0.42, 0.04, 0.05, 0x2c2a28, 0.62, 0.24, 0, 0.01);
  box(t, 0.9, 0.05, 0.58, 0x6b4a2c, 0, 0.3, 0, 0.01);
  for (const z of [0.29, -0.29]) box(t, 0.9, 0.22, 0.03, 0x2f7d3a, 0, 0.42, z, 0.01);
  box(t, 0.03, 0.22, 0.58, 0x2f7d3a, 0.45, 0.42, 0, 0.01);
  const g = new THREE.SphereGeometry(0.5, 16, 10);
  g.scale(0.82, 0.2, 0.52);
  add(t, g, toon(0x5a3f26), 0, 0.5, 0);
  for (const y of [0.32, 0.52]) {
    const rot = new THREE.CylinderGeometry(0.08, 0.08, 0.6, 10);
    rot.rotateX(Math.PI / 2);
    const m = add(t, rot, toon(0x8a8680), -0.5, y, 0);
    m.rotation.z = phase * 3;
  }
  for (const z of [0.33, -0.33]) wheel(t, 0.17, 0.1, 0xd8d2c4, 0, 0.17, z, phase, false);
  return t;
}

/** Pulvérisateur traîné : cuve et rampe de traitement dépliée. */
export function sprayer(phase: number) {
  const t = new THREE.Group();
  box(t, 0.42, 0.04, 0.05, 0x2c2a28, 0.6, 0.24, 0, 0.01);
  box(t, 0.8, 0.06, 0.5, 0x3a3632, 0, 0.3, 0, 0.01);
  const tank = new THREE.CylinderGeometry(0.22, 0.22, 0.7, 18);
  tank.rotateZ(Math.PI / 2);
  add(t, tank, toon(0xf0eee8), 0.02, 0.55, 0);
  box(t, 0.12, 0.06, 0.12, 0xe6c84a, 0.2, 0.79, 0, 0.02);
  // rampe
  box(t, 0.05, 0.05, 2.2, 0xe6c84a, -0.42, 0.42, 0, 0.01);
  for (let k = 0; k < 12; k++) box(t, 0.02, 0.08, 0.02, 0x3a3632, -0.42, 0.36, -1.05 + k * 0.19, 0);
  for (const z of [0.3, -0.3]) wheel(t, 0.2, 0.1, 0xd8d2c4, 0, 0.2, z, phase, false);
  return t;
}

/** Machine à vendanger enjambeuse. */
export function grapeHarvester(phase: number) {
  const t = new THREE.Group();
  const body = 0x7a2a5a, light = 0xf0ece2;
  for (const [x, z] of [[0.45, 0.42], [0.45, -0.42], [-0.45, 0.42], [-0.45, -0.42]]) wheel(t, 0.2, 0.14, light, x, 0.2, z, phase);
  // portique enjambant le rang
  for (const z of [0.42, -0.42]) box(t, 1.0, 0.75, 0.16, body, 0, 0.75, z, 0.04);
  box(t, 1.0, 0.2, 1.0, body, 0, 1.2, 0, 0.04);
  box(t, 0.5, 0.18, 0.6, light, -0.2, 1.38, 0, 0.04); // bennes
  box(t, 0.34, 0.06, 0.4, body, 0.32, 1.33, 0, 0.02);
  box(t, 0.3, 0.3, 0.38, toon(0x9cc8e0, { glass: true }), 0.32, 1.52, 0, 0.02);
  box(t, 0.38, 0.05, 0.46, light, 0.32, 1.7, 0, 0.02);
  for (const [x, z] of [[0.18, -0.17], [0.18, 0.17], [0.46, -0.17], [0.46, 0.17]]) box(t, 0.03, 0.3, 0.03, 0x2c2a28, x, 1.52, z, 0.005);
  box(t, 0.06, 0.05, 0.14, toon(0xf0a020, { emissive: 0x804000 }), 0.32, 1.75, 0, 0.01);
  return t;
}

/** Bétaillère : porteur avec caisse ajourée. */
export function livestockTruck(phase: number) {
  const t = new THREE.Group();
  for (const [x, z] of [[0.62, 0.3], [0.62, -0.3], [-0.35, 0.3], [-0.35, -0.3], [-0.6, 0.3], [-0.6, -0.3]]) wheel(t, 0.14, 0.1, 0xb8b8b8, x, 0.14, z, phase, false);
  box(t, 1.7, 0.08, 0.6, 0x3a3632, -0.05, 0.27, 0, 0.01);
  box(t, 0.38, 0.42, 0.62, 0x2a5ea8, 0.65, 0.5, 0, 0.06);
  box(t, 0.04, 0.2, 0.54, toon(0x9cc8e0, { glass: true }), 0.84, 0.6, 0, 0.02);
  box(t, 1.15, 0.5, 0.64, 0xd8c8a8, -0.3, 0.58, 0, 0.03);
  for (let k = 0; k < 6; k++) for (const z of [0.325, -0.325]) box(t, 1.13, 0.03, 0.012, 0x6b4a2c, -0.3, 0.42 + k * 0.07, z, 0);
  box(t, 1.17, 0.04, 0.66, 0x8a8680, -0.3, 0.85, 0, 0.01);
  return t;
}

export function combine(phase: number) {
  const t = new THREE.Group();
  const body = 0xc4332b, light = 0xf0ece2;
  wheel(t, 0.3, 0.2, light, 0.35, 0.3, 0.38, phase);
  wheel(t, 0.3, 0.2, light, 0.35, 0.3, -0.38, phase);
  wheel(t, 0.19, 0.14, light, -0.65, 0.19, 0.34, phase * 1.5);
  wheel(t, 0.19, 0.14, light, -0.65, 0.19, -0.34, phase * 1.5);
  box(t, 1.25, 0.55, 0.6, body, -0.12, 0.62, 0, 0.06); // caisse
  box(t, 0.9, 0.22, 0.62, light, -0.2, 1.0, 0, 0.04); // trémie à grain
  box(t, 0.5, 0.06, 0.64, body, -0.2, 1.14, 0, 0.02);
  box(t, 0.04, 0.3, 0.6, 0x2c2a28, -0.76, 0.6, 0, 0.01);
  // cabine avant
  box(t, 0.34, 0.08, 0.42, body, 0.48, 0.92, 0, 0.02);
  box(t, 0.3, 0.32, 0.4, toon(0x9cc8e0, { glass: true }), 0.48, 1.12, 0, 0.02);
  for (const [x, z] of [[0.33, -0.19], [0.33, 0.19], [0.63, -0.19], [0.63, 0.19]]) box(t, 0.03, 0.32, 0.03, 0x2c2a28, x, 1.12, z, 0.005);
  box(t, 0.4, 0.05, 0.48, light, 0.48, 1.3, 0, 0.02);
  // goulotte de vidange
  const aug = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 10);
  aug.rotateZ(Math.PI / 2);
  const a = add(t, aug, toon(body), -0.25, 1.15, -0.5);
  a.rotation.y = -0.9;
  // coupe (barre de coupe) et rabatteur
  box(t, 0.36, 0.14, 1.9, light, 0.92, 0.18, 0, 0.03);
  box(t, 0.3, 0.03, 1.92, body, 0.9, 0.27, 0, 0.01);
  box(t, 0.4, 0.2, 0.3, body, 0.72, 0.32, 0, 0.03); // convoyeur
  const reel = new THREE.Group();
  reel.position.set(1.02, 0.36, 0);
  t.add(reel);
  for (let k = 0; k < 5; k++) {
    const ang = phase * 2 + (k / 5) * Math.PI * 2;
    const bar = new THREE.BoxGeometry(0.02, 0.02, 1.8);
    add(reel, bar, toon(0xe6c84a), Math.cos(ang) * 0.13, Math.sin(ang) * 0.13, 0, false);
  }
  const axle = new THREE.CylinderGeometry(0.02, 0.02, 1.84, 8);
  axle.rotateX(Math.PI / 2);
  add(reel, axle, toon(0x3a3632), 0, 0, 0, false);
  for (let k = 0; k < 12; k++) box(t, 0.08, 0.02, 0.015, 0x8a8680, 1.12, 0.12, -0.9 + k * 0.164, 0); // doigts
  return t;
}

export function van(phase: number) {
  const t = new THREE.Group();
  for (const [x, z] of [[0.42, 0.29], [0.42, -0.29], [-0.4, 0.29], [-0.4, -0.29]]) wheel(t, 0.12, 0.09, 0xb8b8b8, x, 0.12, z, phase, false);
  box(t, 1.2, 0.5, 0.6, 0xf0eee8, -0.05, 0.42, 0, 0.06);
  box(t, 0.36, 0.28, 0.58, 0xf0eee8, 0.5, 0.3, 0, 0.06); // nez
  box(t, 0.04, 0.2, 0.52, toon(0x9cc8e0, { glass: true }), 0.4, 0.55, 0, 0.02); // pare-brise
  for (const z of [0.301, -0.301]) {
    box(t, 0.2, 0.16, 0.01, toon(0x9cc8e0, { glass: true }), 0.3, 0.55, z, 0);
    box(t, 0.7, 0.07, 0.012, 0x3f6a8a, -0.2, 0.42, z, 0);
    box(t, 0.7, 0.025, 0.012, 0xd9a441, -0.2, 0.36, z, 0);
  }
  for (const z of [-0.2, 0.2]) box(t, 0.02, 0.04, 0.08, toon(0xfff4c8, { emissive: 0x605020 }), 0.69, 0.3, z, 0.005);
  return t;
}

export function car(color: number, phase: number) {
  const t = new THREE.Group();
  for (const [x, z] of [[0.3, 0.24], [0.3, -0.24], [-0.3, 0.24], [-0.3, -0.24]]) wheel(t, 0.1, 0.07, 0xc8c8c8, x, 0.1, z, phase, false);
  box(t, 0.95, 0.2, 0.5, color, 0, 0.22, 0, 0.06);
  box(t, 0.52, 0.18, 0.46, color, -0.08, 0.4, 0, 0.06);
  box(t, 0.54, 0.14, 0.47, toon(0x9cc8e0, { glass: true }), -0.08, 0.4, 0, 0.04);
  for (const z of [-0.17, 0.17]) box(t, 0.015, 0.04, 0.08, toon(0xfff4c8, { emissive: 0x605020 }), 0.475, 0.25, z, 0.005);
  return t;
}

// ————— prise de vue —————
export interface Shot {
  key: string;
  canvas: HTMLCanvasElement;
  ax: number; // ancre (px à résolution 1, depuis le coin haut-gauche) = point au sol sous le centre
  ay: number;
}

let renderer: THREE.WebGLRenderer | null = null;
export function shoot(key: string, obj: THREE.Object3D, dir: number, res: number): Shot {
  const W = 300, H = 230, OY = 150; // cadre de prise de vue (px à résolution 1)
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
  }
  renderer.setPixelRatio(1);
  renderer.setSize(W * res, H * res, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xfff4e0, 1.25));
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(-2.2, 5, 1.2); // lumière du haut-gauche de l'écran, comme les assets peints
  scene.add(sun);
  const holder = new THREE.Group();
  holder.add(obj);
  // dir 0..7 : angle de k·45° dans le plan de la grille (0 = +x, vers le bas-droite de l'écran)
  const a = (dir * Math.PI) / 4;
  holder.rotation.y = -a;
  scene.add(holder);
  const S = PX_PER_UNIT;
  const cam = new THREE.OrthographicCamera(-W / 2 / S, W / 2 / S, OY / S, -(H - OY) / S, -40, 40);
  const el = (30 * Math.PI) / 180;
  cam.position.set(Math.cos(el) * Math.SQRT1_2, Math.sin(el), Math.cos(el) * Math.SQRT1_2).multiplyScalar(10);
  cam.lookAt(0, 0, 0);
  renderer.render(scene, cam);
  // recadrage sur les pixels visibles
  const full = document.createElement('canvas');
  full.width = W * res;
  full.height = H * res;
  const fctx = full.getContext('2d')!;
  fctx.drawImage(renderer.domElement, 0, 0);
  const img = fctx.getImageData(0, 0, full.width, full.height).data;
  let x0 = full.width, y0 = full.height, x1 = 0, y1 = 0;
  for (let y = 0; y < full.height; y++)
    for (let x = 0; x < full.width; x++)
      if (img[(y * full.width + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  // ombre portée douce, ajoutée sous le véhicule
  const pad = 14 * res;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - 2);
  x1 = Math.min(full.width - 1, x1 + pad);
  y1 = Math.min(full.height - 1, y1 + pad);
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1;
  c.height = y1 - y0 + 1;
  const ctx = c.getContext('2d')!;
  const bb = new THREE.Box3().setFromObject(obj);
  const cx = (W / 2) * res - x0, cy = OY * res - y0;
  // empreinte au sol projetée (losange du rectangle englobant)
  const proj = (gx: number, gz: number): [number, number] => [cx + (gx - gz) * 32 * res, cy + (gx + gz) * 16 * res];
  const corners: [number, number][] = [];
  for (const [lx, lz] of [[bb.min.x, bb.min.z], [bb.max.x, bb.min.z], [bb.max.x, bb.max.z], [bb.min.x, bb.max.z]]) corners.push(proj(lx + 0.06, lz + 0.06));
  ctx.filter = `blur(${3 * res}px)`;
  ctx.fillStyle = 'rgba(30,30,15,0.38)';
  ctx.beginPath();
  ctx.moveTo(...corners[0]);
  for (const p of corners.slice(1)) ctx.lineTo(...p);
  ctx.closePath();
  ctx.fill();
  ctx.filter = 'none';
  ctx.drawImage(full, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return { key, canvas: c, ax: cx / res, ay: cy / res };
}

