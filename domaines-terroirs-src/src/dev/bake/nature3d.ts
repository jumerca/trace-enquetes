// Arbres, haies, arbres fruitiers et vignes en 3D (rendu « toon » encré) — OUTIL DE PRODUCTION D'ASSETS.
// Chaque essence est modélisée pour les quatre saisons (débourrement et floraison au printemps,
// feuillage plein l'été, couleurs d'automne, branches nues ou neige l'hiver) et, pour les vergers,
// avec quatre stades de fruits. Le tronc est à l'origine (ancre = pied de l'arbre, centre de la case).
import * as THREE from 'three';
import { add, toon } from './vehicles3d';

type Season = 0 | 1 | 2 | 3;

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const shade = (c: number, k: number) => {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};

/** Boule de feuillage irrégulière (icosaèdre bosselé). */
function blob(p: THREE.Object3D, r: number, color: number, x: number, y: number, z: number, seed: number, sy = 1, ink = true) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const rr = rand(seed);
  const cache = new Map<string, number>();
  for (let i = 0; i < pos.count; i++) {
    const k = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    let f = cache.get(k);
    if (f == null) cache.set(k, (f = 0.84 + rr() * 0.3));
    pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f * sy, pos.getZ(i) * f);
  }
  g.computeVertexNormals();
  return add(p, g, toon(color), x, y, z, ink);
}

function trunk(p: THREE.Object3D, h: number, r: number, color = 0x6a4a2e, lean = 0, x = 0, z = 0) {
  const g = new THREE.CylinderGeometry(r * 0.7, r, h, 8);
  const m = add(p, g, toon(color), x, h / 2, z);
  m.rotation.z = lean;
  return m;
}

function branch(p: THREE.Object3D, x0: number, y0: number, z0: number, len: number, ang: number, tilt: number, r: number, color: number) {
  const g = new THREE.CylinderGeometry(r * 0.55, r, len, 6);
  g.translate(0, len / 2, 0);
  const m = add(p, g, toon(color), x0, y0, z0, false);
  m.rotation.set(0, ang, tilt);
  return [x0 + Math.cos(ang) * Math.sin(tilt) * len * -1, y0 + Math.cos(tilt) * len, z0 + Math.sin(ang) * Math.sin(tilt) * len] as const;
}

/** Ramure nue (hiver) : branches qui partent du sommet du tronc. */
function bare(p: THREE.Object3D, h: number, spread: number, n: number, seed: number, color = 0x5a4232) {
  const r = rand(seed);
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + r() * 0.6;
    const [x, y, z] = branch(p, 0, h * 0.75, 0, spread * (0.7 + r() * 0.5), a, 0.6 + r() * 0.5, 0.035, color);
    for (let j = 0; j < 2; j++) branch(p, x, y, z, spread * 0.45, a + (j ? 0.6 : -0.6), 0.4 + r() * 0.4, 0.018, color);
  }
}

interface Leaf {
  c: number[]; // couleurs de feuillage
  bare: boolean;
  blossom?: number; // fleurs (printemps)
}
function leaves(kind: 'feuillu' | 'fruitier' | 'persistant' | 'olivier', season: Season, seed: number): Leaf {
  const r = rand(seed);
  if (kind === 'persistant') return { c: season === 3 ? [0x2f5a3a, 0x3a6a42] : [0x2f6a3a, 0x3f7a44, 0x4a8a4a], bare: false };
  if (kind === 'olivier') return { c: [0x8a9a70, 0x9aaa80, 0x7a8a62], bare: false };
  if (season === 3) return { c: [], bare: true };
  if (season === 0) return { c: [0x7ab84a, 0x8ac858, 0x6aa840], bare: false, blossom: kind === 'fruitier' ? (r() < 0.5 ? 0xfaf0f4 : 0xf4c8d8) : undefined };
  if (season === 1) return { c: [0x4a8a3a, 0x5a9a42, 0x3f7a34], bare: false };
  const autumn = [[0xd8902a, 0xc8602a, 0xe8b040], [0xb8502a, 0xd87a2a, 0xa84a2a], [0xd8b040, 0xc89a30, 0xe8c858]];
  return { c: autumn[Math.floor(r() * 3)], bare: false };
}

/** Houppier arrondi fait de plusieurs boules (feuillus). */
function crown(p: THREE.Object3D, cy: number, rx: number, ry: number, n: number, L: Leaf, seed: number) {
  const r = rand(seed);
  for (let k = 0; k < n; k++) {
    const a = r() * Math.PI * 2, d = r() * 0.55;
    const y = cy + (r() - 0.35) * ry * 0.9;
    blob(p, rx * (0.5 + r() * 0.3), L.c[k % L.c.length], Math.cos(a) * rx * d, y, Math.sin(a) * rx * d, seed + k * 7);
  }
  // coiffe éclairée
  blob(p, rx * 0.55, shade(L.c[0], 1.12), -rx * 0.12, cy + ry * 0.45, rx * 0.1, seed + 99);
  if (L.blossom != null)
    for (let k = 0; k < 26; k++) {
      const a = r() * Math.PI * 2, e = r() * Math.PI * 0.6;
      add(p, new THREE.SphereGeometry(0.03, 5, 4), toon(L.blossom), Math.cos(a) * Math.sin(e + 0.5) * rx * 0.95, cy + Math.cos(e) * ry * 0.75, Math.sin(a) * Math.sin(e + 0.5) * rx * 0.95, false);
    }
}

function snowCap(p: THREE.Object3D, y: number, r: number) {
  const g = new THREE.SphereGeometry(r, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.35);
  add(p, g, toon(0xf4f8ff), 0, y, 0, false);
}

// ————— arbres et arbustes du paysage —————
export function tree(sp: string, v: number, season: Season): THREE.Group {
  const p = new THREE.Group();
  const seed = sp.length * 131 + v * 17 + 7;
  const r = rand(seed);
  const s = 0.85 + v * 0.12 + r() * 0.1;
  switch (sp) {
    case 'chene':
    case 'chataignier':
    case 'noyer':
    case 'hetre': {
      const h = (sp === 'hetre' ? 0.62 : 0.5) * s;
      trunk(p, h + 0.25, 0.07 * s, sp === 'hetre' ? 0x8a8a80 : 0x6a4a2e);
      const L = leaves('feuillu', season, seed);
      if (L.bare) bare(p, h + 0.3, 0.35 * s, 6, seed, sp === 'hetre' ? 0x7a7a70 : 0x5a4232);
      else crown(p, h + 0.38 * s, 0.5 * s, 0.42 * s, sp === 'chene' ? 7 : 6, sp === 'chataignier' && season !== 2 ? { ...L, c: L.c.map((c) => shade(c, 0.92)) } : L, seed);
      break;
    }
    case 'bouleau': {
      const g = new THREE.CylinderGeometry(0.035, 0.05, 0.95 * s, 8);
      add(p, g, toon(0xf0ece4), 0, 0.47 * s, 0);
      for (let k = 0; k < 5; k++) add(p, new THREE.BoxGeometry(0.06, 0.015, 0.06), toon(0x2a2a2a), 0, 0.15 + k * 0.15 * s, 0, false);
      const L = leaves('feuillu', season, seed);
      if (L.bare) bare(p, 0.95 * s, 0.22 * s, 5, seed, 0x8a7a6a);
      else for (let k = 0; k < 4; k++) blob(p, 0.2 * s, L.c[k % L.c.length], (r() - 0.5) * 0.2, 0.75 * s + k * 0.12 * s, (r() - 0.5) * 0.2, seed + k, 1.3);
      break;
    }
    case 'peuplier': {
      const L = leaves('feuillu', season, seed);
      trunk(p, L.bare ? 1.2 * s : 0.5 * s, 0.045 * s);
      if (L.bare) for (let k = 0; k < 7; k++) branch(p, 0, 0.45 * s + k * 0.1 * s, 0, 0.22 * s, k * 2.4, 0.35, 0.015, 0x5a4232);
      else for (let k = 0; k < 5; k++) blob(p, 0.2 * s, L.c[k % L.c.length], (r() - 0.5) * 0.06, 0.55 * s + k * 0.22 * s, (r() - 0.5) * 0.06, seed + k, 1.5);
      break;
    }
    case 'cypres': {
      trunk(p, 0.2, 0.04);
      const g = new THREE.SphereGeometry(0.17, 10, 10);
      g.scale(1, 3.6, 1);
      add(p, g, toon(season === 3 ? 0x2a4a32 : 0x2f5a34), 0, 0.75, 0);
      blob(p, 0.12, 0x3a6a3a, -0.04, 0.95, 0.03, seed, 2.4, false);
      break;
    }
    case 'pin': {
      // pin parasol / pin maritime : tronc fin, houppier aplati
      const t = trunk(p, 0.85 * s, 0.05 * s, 0x7a4a2e, 0.1);
      t.position.x = 0.03;
      const L = leaves('persistant', season, seed);
      for (const [dx, dz] of [[0.18, 0], [-0.1, 0.12], [-0.06, -0.15], [0.05, 0.05]]) branch(p, 0.03, 0.75 * s, 0, 0.22 * s, Math.atan2(dz, dx), 0.9, 0.02, 0x7a4a2e);
      for (let k = 0; k < 7; k++) blob(p, 0.2 * s, L.c[k % L.c.length], (r() - 0.5) * 0.55 + 0.04, 0.9 * s + r() * 0.08, (r() - 0.5) * 0.55, seed + k, 0.42);
      if (season === 3) snowCap(p, 1.0 * s, 0.3 * s);
      break;
    }
    case 'sapin':
    case 'epicea': {
      trunk(p, 0.25, 0.05);
      const c = sp === 'sapin' ? 0x2f6a3e : 0x2a5a3a;
      for (let k = 0; k < 4; k++) {
        const rr = (0.42 - k * 0.09) * s;
        add(p, new THREE.ConeGeometry(rr, 0.42 * s, 9), toon(shade(c, 1 + k * 0.05)), 0, 0.3 + k * 0.24 * s + 0.21 * s, 0);
        if (season === 3) add(p, new THREE.ConeGeometry(rr * 0.75, 0.16 * s, 9), toon(0xf4f8ff), 0, 0.3 + k * 0.24 * s + 0.36 * s, 0, false);
      }
      break;
    }
    case 'olivier':
      olive(p, seed, s, 0, season);
      break;
    case 'buisson': {
      const L = leaves(v === 2 ? 'persistant' : 'feuillu', season, seed);
      const c = L.bare ? [0x6a5a4a, 0x7a6a58] : L.c;
      for (let k = 0; k < 4; k++) blob(p, 0.16 * s, c[k % c.length], (r() - 0.5) * 0.3, 0.12 + r() * 0.08, (r() - 0.5) * 0.3, seed + k, 0.8);
      if (!L.bare && season !== 2 && v === 1) for (let k = 0; k < 6; k++) add(p, new THREE.SphereGeometry(0.025, 5, 4), toon(season === 0 ? 0xf4f0e4 : 0xc83a3a), (r() - 0.5) * 0.36, 0.2 + r() * 0.1, (r() - 0.5) * 0.36, false);
      break;
    }
    case 'haie': {
      // haie bocagère : alignement de buissons et quelques arbres têtards
      const L = leaves('feuillu', season, seed);
      const c = L.bare ? [0x6a5a48, 0x7a6a52] : L.c;
      for (let k = 0; k < 6; k++) blob(p, 0.15, c[k % c.length], -0.42 + k * 0.17, 0.15 + r() * 0.05, (r() - 0.5) * 0.12, seed + k, 1.1);
      if (v === 1) {
        trunk(p, 0.45, 0.05);
        if (!L.bare) blob(p, 0.24, c[0], 0, 0.58, 0, seed + 50);
      }
      break;
    }
    default:
      trunk(p, 0.5, 0.06);
      crown(p, 0.75, 0.4, 0.36, 5, leaves('feuillu', season, seed), seed);
  }
  return p;
}

function olive(p: THREE.Object3D, seed: number, s: number, fruit: number, season: Season) {
  const r = rand(seed);
  // tronc tortueux en deux brins
  for (const [a, l] of [[0.25, 0.45], [-0.3, 0.4]]) {
    const g = new THREE.CylinderGeometry(0.035, 0.06, l * s, 7);
    const m = add(p, g, toon(0x7a6a5a), Math.sin(a) * 0.08, l * s * 0.45, 0);
    m.rotation.z = a;
  }
  const L = leaves('olivier', season, seed);
  for (let k = 0; k < 6; k++) blob(p, 0.2 * s, L.c[k % 3], (r() - 0.5) * 0.45 * s, 0.5 * s + r() * 0.15, (r() - 0.5) * 0.45 * s, seed + k, 0.7);
  if (fruit > 0)
    for (let k = 0; k < fruit * 10; k++) add(p, new THREE.SphereGeometry(0.022, 5, 4), toon(fruit > 2 ? 0x2a2030 : 0x6a7a3a), (r() - 0.5) * 0.6 * s, 0.42 * s + r() * 0.3, (r() - 0.5) * 0.6 * s, false);
}

// ————— arbres fruitiers (vergers) —————
const FRUIT: Record<string, { c: number; size: number; season: Season[] }> = {
  pommier: { c: 0xd8302a, size: 0.045, season: [1, 2] },
  poirier: { c: 0xd8c040, size: 0.045, season: [1, 2] },
  prunier: { c: 0x6a2a6a, size: 0.035, season: [1, 2] },
  mirabellier: { c: 0xf0c030, size: 0.03, season: [1, 2] },
  cerisier: { c: 0xc8102a, size: 0.025, season: [0, 1] },
  abricotier: { c: 0xf0902a, size: 0.035, season: [1] },
  noyer: { c: 0x6a8a3a, size: 0.035, season: [2] },
  chataignier: { c: 0xa8b040, size: 0.045, season: [2] },
  truffier: { c: 0x3a3028, size: 0.0, season: [] },
  noisetier: { c: 0x9a7a3a, size: 0.03, season: [2] },
  pecher: { c: 0xf0884a, size: 0.045, season: [1] },
  figuier: { c: 0x6a3a5a, size: 0.04, season: [1, 2] },
  amandier: { c: 0x8aa860, size: 0.035, season: [1, 2] },
  citronnier: { c: 0xf0d830, size: 0.045, season: [0, 1, 2, 3] },
};

/** Rangs d'arbustes à petits fruits (framboisiers palissés, myrtilliers en touffes). */
function berries(look: string, f: number, v: number, season: Season): THREE.Group {
  const p = new THREE.Group();
  const r = rand(71 + v * 7 + look.length);
  const rasp = look === 'framboisier';
  const L = leaves('feuillu', season, 5 + v);
  const c = L.bare ? [0x7a5a48, 0x8a6a52] : rasp ? L.c : season === 2 ? [0xc8402a, 0xa83a2a] : [0x3a7a4a, 0x4a8a52];
  for (const z of [-0.24, 0.22]) {
    if (rasp) for (const x of [-0.42, 0.42]) add(p, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), toon(0x8a6a42), x, 0.25, z, false);
    for (let k = 0; k < 4; k++) {
      const x = -0.33 + k * 0.22;
      blob(p, rasp ? 0.13 : 0.15, c[k % c.length], x, rasp ? 0.28 : 0.13, z, 90 + k + v * 3 + (z > 0 ? 5 : 0), rasp ? 1.4 : 0.8);
      const ripe = (season === 1 || (rasp && season === 2)) && f > 0;
      if (ripe) for (let j = 0; j < f * 3; j++) add(p, new THREE.SphereGeometry(0.022, 5, 4), toon(rasp ? 0xd82a5a : 0x3a3a8a), x + (r() - 0.5) * 0.22, (rasp ? 0.22 : 0.1) + r() * 0.15, z + (z > 0 ? 0.1 : -0.1), false);
    }
  }
  return p;
}

export function fruitTree(look: string, f: number, v: number, season: Season): THREE.Group {
  const p = new THREE.Group();
  const seed = look.length * 97 + v * 31 + 3;
  const r = rand(seed);
  if (look === 'vigne') return vine(f, v, season);
  if (look === 'framboisier' || look === 'myrtillier') return berries(look, f, v, season);
  if (look === 'olivier') {
    olive(p, seed, 0.85 + v * 0.1, f, season);
    return p;
  }
  const big = look === 'noyer' || look === 'chataignier' || look === 'truffier' || look === 'figuier';
  const s = (big ? 0.85 : 0.7) + v * 0.08;
  const fr = FRUIT[look] ?? FRUIT.pommier;
  const kind = look === 'truffier' || look === 'noisetier' || look === 'figuier' ? 'feuillu' : look === 'citronnier' ? 'persistant' : 'fruitier';
  trunk(p, 0.42 * s, 0.05 * s, look === 'cerisier' ? 0x7a4a3a : 0x6a4a2e);
  // tuteur et paillage au pied
  if (!big) add(p, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 5), toon(0xb89a6a), 0.07, 0.25, 0.02, false);
  add(p, new THREE.CylinderGeometry(0.16, 0.18, 0.02, 10), toon(0x6a5a3a), 0, 0.01, 0, false);
  const L = leaves(kind, season, seed);
  if (L.bare) bare(p, 0.42 * s + 0.12, 0.28 * s, 5, seed);
  else {
    // les fruitiers ne fleurissent pas tous de la même couleur
    if (L.blossom != null) L.blossom = look === 'pommier' || look === 'cerisier' || look === 'abricotier' || look === 'pecher' ? 0xf8c0d8 : 0xfaf4f0;
    crown(p, 0.55 * s, 0.4 * s, 0.32 * s, 5, look === 'poirier' ? { ...L, c: L.c.map((c) => shade(c, 0.95)) } : L, seed);
    const ripe = fr.season.includes(season) ? f : 0;
    for (let k = 0; k < ripe * 9; k++) {
      const a = r() * Math.PI * 2, e = 0.3 + r() * 1.1;
      add(p, new THREE.SphereGeometry(fr.size, 7, 5), toon(fr.c), Math.cos(a) * Math.sin(e) * 0.4 * s, 0.55 * s + Math.cos(e) * 0.26 * s, Math.sin(a) * Math.sin(e) * 0.4 * s, false);
    }
    // fruits tombés au pied (fin de saison)
    if (ripe >= 3) for (let k = 0; k < 4; k++) add(p, new THREE.SphereGeometry(fr.size * 0.9, 6, 4), toon(shade(fr.c, 0.85)), (r() - 0.5) * 0.5, 0.02, (r() - 0.5) * 0.5, false);
  }
  return p;
}

/** Rang de vigne palissée sur une case : piquets, fils, ceps, feuillage et grappes. */
function vine(f: number, v: number, season: Season): THREE.Group {
  const p = new THREE.Group();
  const r = rand(17 + v * 13);
  const leafC = season === 0 ? [0x8ac858, 0x7ab84a] : season === 1 ? [0x4a8a3a, 0x5a9a42] : season === 2 ? [0xd8a030, 0xb8502a, 0xc87a2a] : [];
  for (const z of [-0.22, 0.22]) {
    for (const x of [-0.45, 0.45]) add(p, new THREE.CylinderGeometry(0.014, 0.014, 0.42, 5), toon(0x8a6a42), x, 0.21, z, false);
    add(p, new THREE.BoxGeometry(0.92, 0.006, 0.006), toon(0x9a9a9a), 0, 0.34, z, false);
    for (let k = 0; k < 4; k++) {
      const x = -0.33 + k * 0.22;
      const g = new THREE.CylinderGeometry(0.014, 0.022, 0.2, 5);
      const m = add(p, g, toon(0x5a3a2a), x, 0.1, z, false);
      m.rotation.z = (r() - 0.5) * 0.3;
      if (season === 3) continue;
      blob(p, 0.11, leafC[k % leafC.length], x, 0.3, z, 30 + k + v * 5 + (z > 0 ? 9 : 0), 0.8, true);
      blob(p, 0.08, leafC[(k + 1) % leafC.length], x + 0.1, 0.33, z + (r() - 0.5) * 0.06, 50 + k, 0.8, false);
      if ((season === 1 || season === 2) && f > 0)
        for (let g2 = 0; g2 < Math.min(3, f); g2++) {
          const gx = x + (r() - 0.5) * 0.12;
          const bunch = new THREE.SphereGeometry(0.035, 7, 6);
          bunch.scale(1, 1.4, 1);
          add(p, bunch, toon(season === 2 ? 0x4a2a5a : 0x6a8a4a), gx, 0.2, z + (z > 0 ? 0.06 : -0.06), false);
        }
    }
  }
  return p;
}
