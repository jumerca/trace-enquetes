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
}

export const PEOPLE: Record<string, PersonLook> = {
  cultivateur: { shirt: 0x4f7fb0, pants: 0x5a4a3a, skin: 0xe2b48c, hair: 0x5a3a24, hat: 'paille' },
  eleveur: { shirt: 0x6f8f4a, pants: 0x3f4a5a, skin: 0xc9946a, hair: 0x2a2420, hat: 'beret' },
  artisan: { shirt: 0xc8b89a, pants: 0x4a4038, skin: 0xe8bc96, hair: 0x8a5a34, hat: 'casquette', apron: 0xf3efe6 },
  vendeur: { shirt: 0xb2563a, pants: 0x3a3a44, skin: 0xf0c8a4, hair: 0x3a2a1e, apron: 0x3f5f7a },
  v0: { shirt: 0xe2a23a, pants: 0x3f5f8a, skin: 0xf0c8a4, hair: 0x6a4a2a, pack: 0x4a6a8a },
  v1: { shirt: 0xf4eee0, pants: 0x8a6a4a, skin: 0xc9946a, hair: 0x1e1a18, hat: 'paille', dress: true },
  v2: { shirt: 0x7aa8c8, pants: 0xe8e2d0, skin: 0xe8bc96, hair: 0xc8a060 },
  v3: { shirt: 0xc85a6a, pants: 0x3a3a44, skin: 0xa8724a, hair: 0x1e1a18, dress: true },
  v4: { shirt: 0x5f8f6a, pants: 0x5a4a3a, skin: 0xf0c8a4, hair: 0x8a5a34, child: true },
  v5: { shirt: 0xe9d24a, pants: 0x4a6a8a, skin: 0xe2b48c, hair: 0x3a2a1e, child: true, pack: 0xc8443a },
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
  for (const [z, a] of [[0.06, step], [-0.06, -step]] as [number, number][]) mesh(g, rbox(0.11, 0.04, 0.07, 0.015), 0x3a2a1e, Math.sin(a) * hip + 0.02, 0.02 + (1 - Math.cos(a)) * hip * 0.5, z);
  // buste
  if (look.dress) {
    const skirt = new THREE.CylinderGeometry(0.1, 0.17, 0.2, 12);
    mesh(g, skirt, look.shirt, 0, hip + 0.04, 0);
  }
  mesh(g, rbox(0.15, 0.24, 0.22, 0.05), look.shirt, 0, hip + 0.13 + (work && frame === 4 ? -0.01 : 0), 0);
  if (look.apron) mesh(g, rbox(0.02, 0.24, 0.16, 0.01), look.apron, 0.08, hip + 0.08, 0);
  if (look.pack) mesh(g, rbox(0.08, 0.16, 0.16, 0.03), look.pack, -0.11, hip + 0.16, 0);
  // bras
  // bras opposés aux jambes à la marche ; tendus vers l'avant au travail
  const arm = work ? (frame === 3 ? 1.5 : 0.8) : -step * 0.9;
  limb(g, 0.24, 0.035, look.shirt, 0, hip + 0.23, 0.14, arm);
  limb(g, 0.24, 0.035, look.shirt, 0, hip + 0.23, -0.14, work ? arm : -arm);
  // tête
  const hy = hip + 0.36;
  mesh(g, sphere(0.085), look.skin, 0.01, hy, 0);
  const hairG = new THREE.SphereGeometry(0.09, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55);
  const hair = mesh(g, hairG, look.hair, -0.005, hy + 0.005, 0, false);
  hair.rotation.z = 0.35;
  // yeux (vers +x)
  for (const z of [0.03, -0.03]) mesh(g, sphere(0.011), 0x1a1210, 0.083, hy + 0.01, z, false);
  if (look.hat === 'paille') {
    const brim = new THREE.CylinderGeometry(0.17, 0.17, 0.015, 18);
    mesh(g, brim, 0xe8cd78, 0, hy + 0.07, 0);
    mesh(g, new THREE.CylinderGeometry(0.08, 0.09, 0.07, 14), 0xe8cd78, 0, hy + 0.11, 0);
    mesh(g, new THREE.CylinderGeometry(0.091, 0.091, 0.018, 14), 0xb2563a, 0, hy + 0.085, 0, false);
  } else if (look.hat === 'beret') {
    mesh(g, sphere(0.1, 1, 0.35, 1), 0x2a2a34, -0.01, hy + 0.075, 0);
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
  if (kind === 'vache') {
    const coat = [0xf4f0e6, 0xa8643a, 0x2a2422][look % 3];
    const spot = look % 3 === 0 ? 0x2a2422 : look % 3 === 2 ? 0xf4f0e6 : null;
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
