// Personnages et animaux 3D (rendu « toon » encré, même caméra que le jeu) — OUTIL DE PRODUCTION D'ASSETS.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { toon } from './vehicles3d';

const INK = new THREE.MeshBasicMaterial({ color: 0x2a1e14, side: THREE.BackSide });
const OUT = 0.012;

function mesh(parent: THREE.Object3D, geo: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0, ink = true) {
  const m = new THREE.Mesh(geo, toon(color));
  m.position.set(x, y, z);
  parent.add(m);
  if (ink) {
    geo.computeBoundingBox();
    const s = new THREE.Vector3();
    geo.boundingBox!.getSize(s);
    const o = new THREE.Mesh(geo, INK);
    o.scale.set(1 + (2 * OUT) / Math.max(s.x, 0.01), 1 + (2 * OUT) / Math.max(s.y, 0.01), 1 + (2 * OUT) / Math.max(s.z, 0.01));
    m.add(o);
  }
  return m;
}
const rbox = (w: number, h: number, d: number, r = 0.02) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2.2, h / 2.2, d / 2.2));
const shadeC = (c: number, k: number) => {
  const f = (v: number) => Math.min(255, Math.round(v * k));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};
const sphere = (r: number, sx = 1, sy = 1, sz = 1) => {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.scale(sx, sy, sz);
  return g;
};
/** membre articulé : pivot en haut, la géométrie pend vers le bas */
function limb(parent: THREE.Object3D, len: number, rad: number, color: number, x: number, y: number, z: number, angle: number, axis: 'z' | 'x' = 'z') {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  pivot.rotation[axis] = angle;
  parent.add(pivot);
  const g = new THREE.CapsuleGeometry(rad, len - rad * 2, 4, 8);
  mesh(pivot, g, color, 0, -len / 2, 0);
  return pivot;
}

export interface PersonLook {
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  hat?: 'paille' | 'beret' | 'casquette' | null;
  apron?: number;
  pack?: number;
  child?: boolean;
  dress?: boolean;
  longHair?: boolean;
  beard?: boolean;
  glasses?: boolean;
  sunhat?: number;
  vest?: number; // gilet sans manches
  stick?: boolean; // bâton de marche
  boots?: number;
}

export const PEOPLE: Record<string, PersonLook> = {
  cultivateur: { shirt: 0x4f7fb0, pants: 0x5a4a3a, skin: 0xe2b48c, hair: 0x5a3a24, hat: 'paille', boots: 0x3a4a2a, beard: true },
  eleveur: { shirt: 0x6f8f4a, pants: 0x3f4a5a, skin: 0xc9946a, hair: 0x2a2420, hat: 'beret', boots: 0x2a3a2a, vest: 0x2f4a6a },
  artisan: { shirt: 0xc8b89a, pants: 0x4a4038, skin: 0xe8bc96, hair: 0x8a5a34, hat: 'casquette', apron: 0xf3efe6, glasses: true },
  vendeur: { shirt: 0xb2563a, pants: 0x3a3a44, skin: 0xf0c8a4, hair: 0x3a2a1e, apron: 0x3f5f7a, longHair: true },
  saisonnier: { shirt: 0xe8e2d0, pants: 0x4a5a6a, skin: 0xb8845a, hair: 0x1e1a18, hat: 'casquette', pack: 0x6a8a3a },
  guide: { shirt: 0x2a7a4a, pants: 0xc8b89a, skin: 0xf0c8a4, hair: 0xc8a060, longHair: true, sunhat: 0xe8d8a8 },
  v0: { shirt: 0xe2a23a, pants: 0x3f5f8a, skin: 0xf0c8a4, hair: 0x6a4a2a, pack: 0x4a6a8a },
  v1: { shirt: 0xf4eee0, pants: 0x8a6a4a, skin: 0xc9946a, hair: 0x1e1a18, hat: 'paille', dress: true, longHair: true },
  v2: { shirt: 0x7aa8c8, pants: 0xe8e2d0, skin: 0xe8bc96, hair: 0xc8a060, glasses: true },
  v3: { shirt: 0xc85a6a, pants: 0x3a3a44, skin: 0xa8724a, hair: 0x1e1a18, dress: true, longHair: true },
  v4: { shirt: 0x5f8f6a, pants: 0x5a4a3a, skin: 0xf0c8a4, hair: 0x8a5a34, child: true },
  v5: { shirt: 0xe9d24a, pants: 0x4a6a8a, skin: 0xe2b48c, hair: 0x3a2a1e, child: true, pack: 0xc8443a },
  v6: { shirt: 0xe878a8, pants: 0x6a5aa8, skin: 0xe8bc96, hair: 0xa86a34, child: true, dress: true, longHair: true },
  v7: { shirt: 0x3a8ad8, pants: 0x3a3a44, skin: 0x8a5a3a, hair: 0x1e1a18, child: true, hat: 'casquette' },
  v8: { shirt: 0xd84a3a, pants: 0x5a5a48, skin: 0xe2b48c, hair: 0x8a8a88, pack: 0x2a5a3a, stick: true, boots: 0x5a3a22, beard: true, hat: 'casquette' },
  v9: { shirt: 0x8ac8b8, pants: 0xf0ece0, skin: 0xf0c8a4, hair: 0x5a3a24, dress: true, longHair: true, sunhat: 0xf4ead0, glasses: true },
};

/**
 * Personnage. frame : 0 repos, 1 pas gauche, 2 pas droit, 3 travail (bras levés), 4 travail (bras baissés).
 * Le personnage regarde vers +x (direction de marche).
 */
export function person(look: PersonLook, frame: number) {
  const root = new THREE.Group();
  const g = new THREE.Group();
  root.add(g);
  const k = look.child ? 0.72 : 1;
  g.scale.setScalar(k * 1.15);
  const step = frame === 1 ? 0.5 : frame === 2 ? -0.5 : 0;
  const work = frame >= 3;
  const hip = 0.27;
  // jambes (rotation autour de l'axe z : avant/arrière dans le sens de la marche)
  limb(g, hip, 0.045, look.pants, 0, hip, 0.06, step);
  limb(g, hip, 0.045, look.pants, 0, hip, -0.06, -step);
  for (const [z, a] of [[0.06, step], [-0.06, -step]] as [number, number][]) {
    mesh(g, rbox(0.12, look.boots ? 0.08 : 0.045, 0.075, 0.018), look.boots ?? 0x3a2a1e, Math.sin(a) * hip + 0.02, (look.boots ? 0.04 : 0.022) + (1 - Math.cos(a)) * hip * 0.5, z);
  }
  // ceinture
  if (!look.dress) mesh(g, rbox(0.155, 0.03, 0.225, 0.01), 0x3a2a1e, 0, hip + 0.02, 0, false);
  // buste
  if (look.dress) {
    const skirt = new THREE.CylinderGeometry(0.1, 0.17, 0.2, 12);
    mesh(g, skirt, look.shirt, 0, hip + 0.04, 0);
  }
  mesh(g, rbox(0.15, 0.24, 0.22, 0.05), look.shirt, 0, hip + 0.13 + (work && frame === 4 ? -0.01 : 0), 0);
  if (look.apron) mesh(g, rbox(0.02, 0.24, 0.16, 0.01), look.apron, 0.08, hip + 0.08, 0);
  if (look.vest) mesh(g, rbox(0.165, 0.2, 0.23, 0.04), look.vest, 0, hip + 0.15, 0);
  // col de chemise
  mesh(g, rbox(0.08, 0.03, 0.12, 0.012), shadeC(look.shirt, 1.15), 0.03, hip + 0.255, 0, false);
  if (look.pack) {
    mesh(g, rbox(0.09, 0.17, 0.16, 0.03), look.pack, -0.115, hip + 0.16, 0);
    mesh(g, rbox(0.02, 0.18, 0.025, 0.008), shadeC(look.pack, 0.7), 0.075, hip + 0.16, 0.07, false);
    mesh(g, rbox(0.02, 0.18, 0.025, 0.008), shadeC(look.pack, 0.7), 0.075, hip + 0.16, -0.07, false);
  }
  if (look.stick) {
    const st = new THREE.CylinderGeometry(0.008, 0.008, 0.55, 5);
    const m = mesh(g, st, 0x8a6a42, 0.12, 0.27, 0.17, false);
    m.rotation.z = -0.2 + step * 0.3;
  }
  // bras
  // bras opposés aux jambes à la marche ; tendus vers l'avant au travail
  const arm = work ? (frame === 3 ? 1.5 : 0.8) : -step * 0.9;
  // bras (manche + main couleur peau)
  for (const [z, a] of [[0.14, arm], [-0.14, work ? arm : -arm]] as [number, number][]) {
    const pv = limb(g, 0.2, 0.036, look.shirt, 0, hip + 0.23, z, a);
    mesh(pv, sphere(0.03), look.skin, 0, -0.215, 0, false);
  }
  // tête
  const hy = hip + 0.36;
  mesh(g, sphere(0.085), look.skin, 0.01, hy, 0);
  const hairG = new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = mesh(g, hairG, look.hair, -0.005, hy + 0.005, 0, false);
  hair.rotation.z = 0.35;
  // cou, oreilles, visage (vers +x)
  mesh(g, new THREE.CylinderGeometry(0.03, 0.035, 0.05, 8), look.skin, 0.01, hy - 0.08, 0, false);
  for (const z of [0.085, -0.085]) mesh(g, sphere(0.018, 0.6, 1, 0.6), shadeC(look.skin, 0.92), 0.0, hy, z, false);
  for (const z of [0.032, -0.032]) {
    mesh(g, sphere(0.014, 0.5, 1, 1), 0xffffff, 0.08, hy + 0.012, z, false);
    mesh(g, sphere(0.008), 0x1a1210, 0.087, hy + 0.012, z, false);
    mesh(g, rbox(0.006, 0.006, 0.028, 0.002), look.hair, 0.083, hy + 0.035, z, false); // sourcils
  }
  mesh(g, sphere(0.016, 1.2, 1, 0.9), shadeC(look.skin, 0.9), 0.092, hy - 0.008, 0, false); // nez
  mesh(g, rbox(0.006, 0.008, 0.035, 0.003), 0x9a4a3a, 0.083, hy - 0.04, 0, false); // bouche
  for (const z of [0.05, -0.05]) mesh(g, sphere(0.014, 0.4, 0.7, 1), 0xe89a8a, 0.075, hy - 0.02, z, false); // joues
  if (look.beard) mesh(g, sphere(0.07, 0.7, 0.55, 1.05), look.hair, 0.035, hy - 0.05, 0, false);
  if (look.glasses) for (const z of [0.032, -0.032]) {
    const ring = new THREE.TorusGeometry(0.018, 0.004, 4, 10);
    ring.rotateY(Math.PI / 2);
    mesh(g, ring, 0x2a2a2a, 0.092, hy + 0.012, z, false);
  }
  if (look.longHair) mesh(g, rbox(0.06, 0.15, 0.16, 0.04), look.hair, -0.06, hy - 0.05, 0, false);
  if (look.hat === 'paille') {
    const brim = new THREE.CylinderGeometry(0.17, 0.17, 0.015, 18);
    mesh(g, brim, 0xe8cd78, 0, hy + 0.07, 0);
    mesh(g, new THREE.CylinderGeometry(0.08, 0.09, 0.07, 14), 0xe8cd78, 0, hy + 0.11, 0);
    mesh(g, new THREE.CylinderGeometry(0.091, 0.091, 0.018, 14), 0xb2563a, 0, hy + 0.085, 0, false);
  } else if (look.hat === 'beret') {
    mesh(g, sphere(0.1, 1, 0.35, 1), 0x2a2a34, -0.01, hy + 0.075, 0);
  } else if (look.sunhat != null) {
    mesh(g, new THREE.CylinderGeometry(0.16, 0.16, 0.012, 18), look.sunhat, 0, hy + 0.065, 0);
    mesh(g, new THREE.SphereGeometry(0.088, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), look.sunhat, 0, hy + 0.04, 0);
    mesh(g, new THREE.CylinderGeometry(0.09, 0.09, 0.02, 14), 0x5a8a9a, 0, hy + 0.075, 0, false);
  } else if (look.hat === 'casquette') {
    mesh(g, new THREE.SphereGeometry(0.092, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), 0x5a6a4a, 0, hy + 0.02, 0);
    mesh(g, rbox(0.09, 0.012, 0.12, 0.005), 0x5a6a4a, 0.08, hy + 0.03, 0);
  }
  return root;
}

// ————— animaux (regardent vers +x) —————
export function animal(kind: string, look: number, frame: number) {
  const g = new THREE.Group();
  const step = frame === 1 ? 0.4 : frame === 2 ? -0.4 : 0;
  const graze = frame === 3;
  const legs = (xs: number[], z: number, len: number, rad: number, col: number) => {
    xs.forEach((x, i) => {
      limb(g, len, rad, col, x, len, z, i % 2 ? step : -step);
      limb(g, len, rad, col, x, len, -z, i % 2 ? -step : step);
    });
  };
  if (kind === 'vache' || kind === 'limousine') {
    const lim = kind === 'limousine';
    const coat = lim ? [0xb8642e, 0xc87a3e, 0xa85a2a][look % 3] : [0xf4f0e6, 0xa8643a, 0x2a2422][look % 3];
    const spot = lim ? null : look % 3 === 0 ? 0x2a2422 : look % 3 === 2 ? 0xf4f0e6 : null;
    if (lim) for (const z of [0.15, -0.15]) mesh(g, sphere(0.05, 1, 1, 0.3), 0xe8c088, 0.3, 0.38, z * 0.4, false); // auréoles claires
    legs([0.22, -0.2], 0.1, 0.24, 0.035, coat);
    mesh(g, rbox(0.62, 0.26, 0.3, 0.1), coat, 0, 0.36, 0);
    if (spot) for (const [x, y, z, r] of [[-0.1, 0.42, 0.15, 0.08], [0.12, 0.38, -0.15, 0.07], [-0.2, 0.36, -0.15, 0.06]]) mesh(g, sphere(r, 1.2, 0.8, 0.3), spot, x, y, z, false);
    mesh(g, sphere(0.06, 1, 0.6, 1), 0xe8a8a0, -0.05, 0.22, 0, false);
    const head = new THREE.Group();
    head.position.set(0.33, graze ? 0.22 : 0.44, 0);
    head.rotation.z = graze ? -0.9 : 0;
    g.add(head);
    mesh(head, rbox(0.18, 0.13, 0.13, 0.04), coat, 0.06, 0, 0);
    mesh(head, rbox(0.06, 0.08, 0.12, 0.03), 0xe8b0a0, 0.15, -0.03, 0);
    for (const z of [0.07, -0.07]) {
      const horn = new THREE.ConeGeometry(0.015, 0.07, 6);
      const h = mesh(head, horn, 0xe8e0c8, 0.02, 0.08, z);
      h.rotation.x = z > 0 ? 0.6 : -0.6;
    }
    limb(g, 0.18, 0.012, coat, -0.31, 0.44, 0, 0.3);
  } else if (kind === 'cheval' || kind === 'ane') {
    const horse = kind === 'cheval';
    const coat = horse ? [0x7a4a2a, 0x2a2420, 0xd8d0c0][look % 3] : [0x8a8078, 0x6a5a4a, 0x9a9088][look % 3];
    const mane = horse ? (look % 3 === 2 ? 0xa8a090 : 0x1e1a18) : 0x3a3430;
    const L = horse ? 0.32 : 0.22;
    legs([horse ? 0.22 : 0.15, horse ? -0.2 : -0.14], horse ? 0.08 : 0.065, L, horse ? 0.03 : 0.026, coat);
    for (const x of [horse ? 0.22 : 0.15, horse ? -0.2 : -0.14]) for (const z of [0.08, -0.08]) mesh(g, rbox(0.05, 0.03, 0.05, 0.01), 0x2a2420, x, 0.015, z * (horse ? 1 : 0.8), false);
    mesh(g, rbox(horse ? 0.6 : 0.42, horse ? 0.24 : 0.2, horse ? 0.24 : 0.2, 0.09), coat, 0, L + (horse ? 0.12 : 0.1), 0);
    const neck = new THREE.Group();
    neck.position.set(horse ? 0.26 : 0.18, L + (horse ? 0.2 : 0.16), 0);
    neck.rotation.z = graze ? -1.4 : -0.5;
    g.add(neck);
    mesh(neck, rbox(0.1, horse ? 0.3 : 0.22, 0.1, 0.04), coat, 0, horse ? 0.14 : 0.1, 0);
    mesh(neck, rbox(0.04, horse ? 0.3 : 0.2, 0.03, 0.01), mane, -0.05, horse ? 0.15 : 0.1, 0, false);
    const head = new THREE.Group();
    head.position.set(0.02, horse ? 0.3 : 0.22, 0);
    head.rotation.z = 1.2;
    neck.add(head);
    mesh(head, rbox(0.1, horse ? 0.22 : 0.18, 0.1, 0.04), coat, 0, -0.08, 0);
    mesh(head, rbox(0.09, 0.06, 0.09, 0.03), horse ? 0x3a3028 : 0xe8e0d0, 0, -0.18, 0, false);
    for (const z of [0.035, -0.035]) mesh(head, new THREE.ConeGeometry(0.018, horse ? 0.06 : 0.13, 5), coat, -0.03, 0.04 + (horse ? 0 : 0.03), z);
    limb(g, horse ? 0.26 : 0.2, 0.025, mane, horse ? -0.3 : -0.21, L + 0.18, 0, 0.35);
  } else if (kind === 'oie') {
    const body = look % 3 === 2 ? 0x9a9488 : 0xf4f2ea;
    for (const z of [0.035, -0.035]) mesh(g, rbox(0.02, 0.07, 0.02, 0.008), 0xe8902a, (z > 0 ? step : -step) * 0.06, 0.035, z, false);
    mesh(g, sphere(0.1, 1.55, 0.95, 1.05), body, 0, 0.14, 0);
    const neck = new THREE.CapsuleGeometry(0.03, 0.14, 4, 8);
    const n = mesh(g, neck, body, graze ? 0.17 : 0.13, graze ? 0.12 : 0.26, 0, false);
    n.rotation.z = graze ? -1.2 : -0.25;
    mesh(g, sphere(0.045), body, graze ? 0.24 : 0.16, graze ? 0.06 : 0.35, 0);
    mesh(g, new THREE.ConeGeometry(0.02, 0.07, 6).rotateZ(-Math.PI / 2), 0xe8902a, graze ? 0.29 : 0.21, graze ? 0.05 : 0.34, 0, false);
  } else if (kind === 'lapin') {
    const fur = [0xe8e0d4, 0x8a6a4a, 0x5a5048][look % 3];
    const hop = frame === 1 || frame === 2 ? 0.03 : 0;
    mesh(g, sphere(0.07, 1.4, 1, 1), fur, 0, 0.08 + hop, 0);
    mesh(g, sphere(0.045), fur, 0.09, 0.13 + hop, 0);
    for (const z of [0.018, -0.018]) {
      const e = mesh(g, sphere(0.016, 0.6, 2.6, 1), fur, 0.075, 0.2 + hop, z, false);
      e.rotation.z = 0.25;
    }
    mesh(g, sphere(0.022), 0xf4f0ea, -0.1, 0.1 + hop, 0, false);
  } else if (kind === 'chevre') {
    const coat = [0xf2ede2, 0xc9a27a, 0x6a5040][look % 3];
    legs([0.13, -0.12], 0.06, 0.18, 0.022, coat);
    mesh(g, rbox(0.36, 0.16, 0.18, 0.06), coat, 0, 0.26, 0);
    const head = new THREE.Group();
    head.position.set(0.2, graze ? 0.16 : 0.36, 0);
    head.rotation.z = graze ? -0.9 : 0.2;
    g.add(head);
    mesh(head, rbox(0.12, 0.08, 0.08, 0.03), coat, 0.04, 0, 0);
    mesh(head, new THREE.ConeGeometry(0.015, 0.06, 6), 0xd8d0c0, 0.07, -0.06, 0);
    for (const z of [0.025, -0.025]) {
      const h = mesh(head, new THREE.ConeGeometry(0.012, 0.09, 6), 0x8a7a60, -0.01, 0.07, z);
      h.rotation.z = 0.6;
    }
  } else if (kind === 'brebis') {
    const wool = look % 3 === 2 ? 0xd8d0c0 : 0xf2ede2;
    legs([0.12, -0.11], 0.06, 0.14, 0.02, 0x3a3430);
    for (const [x, y, z] of [[-0.1, 0.24, 0.05], [0.04, 0.26, -0.05], [0.1, 0.24, 0.05], [-0.04, 0.22, -0.06], [0, 0.28, 0.04]]) mesh(g, sphere(0.1), wool, x, y, z);
    const head = new THREE.Group();
    head.position.set(0.2, graze ? 0.12 : 0.27, 0);
    head.rotation.z = graze ? -0.8 : 0;
    g.add(head);
    mesh(head, sphere(0.055, 1.4, 1, 1), 0x2a2420, 0.03, 0, 0);
  } else if (kind === 'cochon') {
    const skin = look % 3 === 2 ? 0x6a4a3a : 0xf0b0a6;
    legs([0.12, -0.12], 0.07, 0.12, 0.025, skin);
    mesh(g, sphere(0.14, 1.75, 1, 1.05), skin, 0, 0.22, 0);
    mesh(g, new THREE.CylinderGeometry(0.04, 0.045, 0.05, 10).rotateZ(Math.PI / 2), look % 3 === 2 ? 0x5a3a2a : 0xe8968a, 0.27, graze ? 0.14 : 0.22, 0);
    for (const z of [0.06, -0.06]) mesh(g, new THREE.ConeGeometry(0.03, 0.05, 4), skin, 0.18, 0.33, z);
  } else if (kind === 'canard') {
    const body = look % 3 === 0 ? 0xf4f0e6 : 0x8a7a5a;
    for (const z of [0.03, -0.03]) mesh(g, rbox(0.02, 0.06, 0.02, 0.008), 0xe8a030, 0.0 + (z > 0 ? step : -step) * 0.05, 0.03, z, false);
    mesh(g, sphere(0.08, 1.5, 1, 1.1), body, 0, 0.11, 0);
    mesh(g, sphere(0.045), look % 3 === 1 ? 0x2a6a3a : body, graze ? 0.14 : 0.1, graze ? 0.08 : 0.21, 0);
    mesh(g, rbox(0.06, 0.015, 0.035, 0.006), 0xf0a020, graze ? 0.19 : 0.15, graze ? 0.07 : 0.2, 0, false);
  } else if (kind === 'poule') {
    const body = [0xf2ede2, 0xb8643c, 0x3a3030][look % 3];
    for (const z of [0.02, -0.02]) mesh(g, rbox(0.012, 0.05, 0.012, 0.004), 0xd8a030, (z > 0 ? step : -step) * 0.04, 0.025, z, false);
    mesh(g, sphere(0.06, 1.3, 1, 1), body, 0, 0.09, 0);
    mesh(g, sphere(0.035), body, graze ? 0.09 : 0.06, graze ? 0.06 : 0.15, 0);
    mesh(g, rbox(0.03, 0.025, 0.008, 0.004), 0xd8322a, graze ? 0.09 : 0.06, graze ? 0.09 : 0.18, 0, false);
    mesh(g, new THREE.ConeGeometry(0.01, 0.025, 4).rotateZ(-Math.PI / 2), 0xe8a030, graze ? 0.13 : 0.1, graze ? 0.05 : 0.15, 0, false);
  }
  return g;
}
