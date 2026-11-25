// Cultures en 3D (une case de parcelle, rangs de plantes) — OUTIL DE PRODUCTION D'ASSETS.
// Trois stades : levée (2), croissance (3), maturité (4). Origine au centre de la case.
import * as THREE from 'three';
import { add, toon } from './vehicles3d';

function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const geoCache = new Map<string, THREE.BufferGeometry>();
const G = (k: string, f: () => THREE.BufferGeometry) => {
  let g = geoCache.get(k);
  if (!g) geoCache.set(k, (g = f()));
  return g;
};

/** Positions des plants : rangs parallèles à x, en quinconce léger. */
function plants(rows: number, per: number, seed: number, cb: (x: number, z: number, i: number, r: () => number) => void) {
  const r = rand(seed);
  let i = 0;
  for (let a = 0; a < rows; a++)
    for (let b = 0; b < per; b++) {
      const z = -0.42 + (a + 0.5) * (0.84 / rows);
      const x = -0.44 + (b + 0.5) * (0.88 / per) + (a % 2 ? 0.03 : -0.03) + (r() - 0.5) * 0.03;
      cb(x, z + (r() - 0.5) * 0.02, i++, r);
    }
}

function blade(p: THREE.Object3D, x: number, z: number, h: number, c: number, lean: number) {
  const m = add(p, G(`blade${h.toFixed(2)}`, () => new THREE.ConeGeometry(0.012, h, 3).translate(0, h / 2, 0)), toon(c), x, 0, z, false);
  m.rotation.z = lean;
  m.rotation.x = lean * 0.6;
  return m;
}
function ball(p: THREE.Object3D, r: number, c: number, x: number, y: number, z: number, sy = 1, ink = false) {
  return add(p, G(`ball${r.toFixed(3)}:${sy}`, () => new THREE.IcosahedronGeometry(r, 1).scale(1, sy, 1)), toon(c), x, y, z, ink);
}

export const CROP3D = ['cereale', 'mais', 'tournesol', 'colza', 'betterave', 'patate', 'lavande', 'legumes', 'lin', 'houblon', 'fraises', 'melons', 'fleurs', 'riz', 'chanvre'];

export function cropTile(look: string, stage: number, v: number): THREE.Group {
  const p = new THREE.Group();
  const seed = look.length * 53 + stage * 7 + v * 131;
  const g = stage === 2 ? 0.35 : stage === 3 ? 0.75 : 1; // hauteur relative
  const green = stage === 2 ? 0x7ab84a : 0x4a8a3a;
  switch (look) {
    case 'cereale':
    case 'riz':
      plants(7, 9, seed, (x, z, i, r) => {
        const ripe = stage === 4;
        const c = ripe ? (look === 'riz' ? 0xd8c070 : [0xe0b84a, 0xd8a83a, 0xe8c45a][i % 3]) : [green, 0x5a9a42][i % 2];
        for (let k = 0; k < 2; k++) blade(p, x + (r() - 0.5) * 0.04, z + (r() - 0.5) * 0.03, 0.3 * g + r() * 0.04, c, (r() - 0.5) * 0.25);
        if (ripe) ball(p, 0.016, look === 'riz' ? 0xe8d898 : 0xc8963a, x, 0.3, z, 2.2);
      });
      break;
    case 'mais':
    case 'chanvre':
      plants(4, 5, seed, (x, z, _i, r) => {
        const h = (look === 'chanvre' ? 0.6 : 0.65) * g;
        const c = stage === 4 && look === 'mais' ? 0xc8b060 : green;
        add(p, G(`stalk${h.toFixed(2)}`, () => new THREE.CylinderGeometry(0.012, 0.016, h, 5).translate(0, h / 2, 0)), toon(c), x, 0, z, false);
        for (let k = 0; k < (stage === 2 ? 2 : 5); k++) {
          const leaf = add(p, G('leaf', () => new THREE.BoxGeometry(0.2, 0.008, 0.04).translate(0.09, 0, 0)), toon(k % 2 ? c : 0x3a7a32), x, h * (0.2 + k * 0.15), z, false);
          leaf.rotation.y = k * 2.2 + r();
          leaf.rotation.z = -0.5;
        }
        if (look === 'chanvre' && stage >= 3) ball(p, 0.05, 0x5a8a3a, x, h, z, 1.6);
        if (look === 'mais' && stage === 4) ball(p, 0.03, 0xe8c040, x + 0.03, h * 0.55, z + 0.02, 2);
        if (look === 'mais' && stage >= 3) blade(p, x, z, 0.09, 0xd8c070, 0).position.y = h - 0.02;
      });
      break;
    case 'tournesol':
      plants(4, 5, seed, (x, z, _i, r) => {
        const h = 0.55 * g;
        add(p, G(`stalkT${h.toFixed(2)}`, () => new THREE.CylinderGeometry(0.012, 0.016, h, 5).translate(0, h / 2, 0)), toon(0x5a8a3a), x, 0, z, false);
        for (let k = 0; k < 3; k++) ball(p, 0.04, green, x + Math.cos(k * 2.1) * 0.05, h * (0.3 + k * 0.2), z + Math.sin(k * 2.1) * 0.05, 0.4);
        if (stage >= 3) {
          const head = new THREE.Group();
          head.position.set(x + 0.02, h + 0.02, z + 0.02);
          head.rotation.set(0.9, 0, -0.5); // tourné vers le soleil (et la caméra)
          p.add(head);
          add(head, G('petals', () => new THREE.CylinderGeometry(0.075, 0.075, 0.012, 12)), toon(stage === 4 ? 0xf0c020 : 0x7aa040), 0, 0, 0, false);
          add(head, G('disc', () => new THREE.CylinderGeometry(0.045, 0.045, 0.02, 10)), toon(stage === 4 ? 0x5a3a1a : 0x6a8a3a), 0, 0.008, 0, false);
        }
        void r;
      });
      break;
    case 'colza':
    case 'lin':
      plants(6, 7, seed, (x, z, _i, r) => {
        const h = (look === 'lin' ? 0.32 : 0.36) * g;
        for (let k = 0; k < 3; k++) blade(p, x + (r() - 0.5) * 0.05, z + (r() - 0.5) * 0.04, h, k ? green : 0x5a9a42, (r() - 0.5) * 0.3);
        if (stage === 4) for (let k = 0; k < 3; k++) ball(p, 0.022, look === 'lin' ? 0x7a9ae8 : 0xf0d830, x + (r() - 0.5) * 0.07, h + r() * 0.03, z + (r() - 0.5) * 0.05);
        else if (look === 'colza' && stage === 3) ball(p, 0.05, 0x5a9a42, x, h * 0.6, z, 0.8);
      });
      break;
    case 'betterave':
    case 'patate':
    case 'legumes':
    case 'fraises':
    case 'melons':
      plants(look === 'melons' ? 3 : 5, look === 'melons' ? 4 : 6, seed, (x, z, i, r) => {
        const s = look === 'melons' ? 0.09 : look === 'fraises' ? 0.05 : 0.06;
        const leafC = look === 'betterave' ? [0x3a7a3a, 0x4a8a3a] : look === 'patate' ? [0x5a8a3a, 0x4a7a32] : look === 'legumes' ? [0x4a8a3a, 0x8aa84a, 0x6a8a9a, 0x3a6a2a] : [0x3a7a32, 0x4a8a3a];
        const c = leafC[i % leafC.length];
        for (let k = 0; k < 3; k++) ball(p, s * g, c, x + (r() - 0.5) * 0.05, s * g * 0.6, z + (r() - 0.5) * 0.04, 0.6, k === 0);
        if (stage === 4) {
          if (look === 'fraises') for (let k = 0; k < 3; k++) ball(p, 0.016, 0xd8202a, x + (r() - 0.5) * 0.08, 0.02, z + (r() - 0.5) * 0.06);
          if (look === 'melons') ball(p, 0.05, i % 2 ? 0xe8a040 : 0x9ab040, x + 0.04, 0.04, z + 0.03, 0.85, true);
          if (look === 'legumes' && i % 4 === 1) ball(p, 0.035, 0xd83a2a, x + 0.03, 0.05, z, 1);
          if (look === 'patate' && i % 3 === 0) ball(p, 0.012, 0xf4f0e0, x, s * g + 0.02, z);
          if (look === 'betterave') ball(p, 0.03, 0xe8dcc0, x, 0.02, z, 0.8);
        }
      });
      break;
    case 'lavande':
      plants(4, 5, seed, (x, z, _i, r) => {
        ball(p, 0.08 * (0.5 + g * 0.5), stage === 2 ? 0x8a9a7a : 0x7a8a6a, x, 0.06, z, 0.8, true);
        if (stage >= 3)
          for (let k = 0; k < 9; k++) {
            const a = (k / 9) * Math.PI * 2;
            const m = blade(p, x + Math.cos(a) * 0.04, z + Math.sin(a) * 0.035, 0.16, stage === 4 ? [0x8a5ac8, 0x9a6ad8][k % 2] : 0x8a9a7a, Math.cos(a) * 0.4);
            m.position.y = 0.05;
          }
        void r;
      });
      break;
    case 'houblon':
      for (const z of [-0.22, 0.22]) {
        for (const x of [-0.4, 0.4]) add(p, G('pole', () => new THREE.CylinderGeometry(0.012, 0.014, 0.9, 5).translate(0, 0.45, 0)), toon(0x8a6a42), x, 0, z, false);
        add(p, G('wire', () => new THREE.BoxGeometry(0.82, 0.005, 0.005)), toon(0x9a9a9a), 0, 0.88, z, false);
        for (let k = 0; k < 4; k++) {
          const x = -0.3 + k * 0.2;
          const h = 0.85 * g;
          add(p, G(`bine${h.toFixed(2)}`, () => new THREE.CylinderGeometry(0.05, 0.045, h, 7).translate(0, h / 2, 0)), toon(k % 2 ? 0x4a8a3a : 0x5a9a42), x, 0, z, true);
          if (stage === 4) for (let j = 0; j < 4; j++) ball(p, 0.022, 0xb8d070, x + 0.04, 0.2 + j * 0.15, z + 0.04, 1.4);
        }
      }
      break;
    case 'fleurs':
      plants(5, 7, seed, (x, z, i, r) => {
        const h = 0.2 * g;
        blade(p, x, z, h, green, (r() - 0.5) * 0.2);
        ball(p, 0.03, 0x5a9a42, x, 0.03, z, 0.7);
        if (stage >= 3) ball(p, stage === 4 ? 0.032 : 0.018, stage === 4 ? [0xe83a5a, 0xf0c030, 0xf4f0f0, 0x9a5ad8, 0xf0802a][Math.floor(i / 7) % 5] : 0x7ab84a, x, h, z, 0.7);
      });
      break;
  }
  return p;
}
