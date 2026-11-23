// Bâtiments 3D (three.js, rendu « toon » encré) — OUTIL DE PRODUCTION D'ASSETS.
// Chaque bâtiment est modélisé dans le style architectural de la région (murs, toits, volets,
// colombages, briques), photographié sous la caméra isométrique du jeu dans ses deux orientations,
// avec une seconde prise « neige » (seulement les toits, enneigés) superposée en hiver.
import * as THREE from 'three';
import { PX_PER_UNIT, add, box, toon, van, wheel } from './vehicles3d';
import type { Architecture } from '../../data/regions';

const hex = (s: string) => parseInt(s.slice(1), 16);
const shade = (c: number, k: number) => {
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};
const css = (c: number) => '#' + c.toString(16).padStart(6, '0');

// ————— textures procédurales (1 répétition = 1 unité = 1 case) —————
function rand(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function texCanvas(draw: (ctx: CanvasRenderingContext2D, n: number) => void, rot = false) {
  const n = 128;
  const c = document.createElement('canvas');
  c.width = c.height = n;
  draw(c.getContext('2d')!, n);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rot) {
    t.center.set(0.5, 0.5);
    t.rotation = Math.PI / 2;
  }
  return t;
}

type WallKind = 'pierre' | 'enduit' | 'brique' | 'colombages' | 'bois' | 'tole' | 'blanc';
function wallTex(kind: WallKind, base: number, seed: number) {
  return texCanvas((ctx, n) => {
    const r = rand(seed);
    ctx.fillStyle = css(base);
    ctx.fillRect(0, 0, n, n);
    if (kind === 'pierre') {
      // moellons irréguliers et joints clairs
      for (let y = 0; y < n; y += 16) {
        let x = -r() * 20;
        while (x < n) {
          const w = 16 + r() * 22;
          ctx.fillStyle = css(shade(base, 0.82 + r() * 0.3));
          ctx.fillRect(x + 1.5, y + 1.5, w - 3, 13);
          x += w;
        }
      }
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fff';
      for (let k = 0; k < 40; k++) ctx.fillRect(r() * n, r() * n, 3, 1);
      ctx.globalAlpha = 1;
    } else if (kind === 'enduit' || kind === 'blanc') {
      for (let k = 0; k < 220; k++) {
        ctx.fillStyle = css(shade(base, 0.92 + r() * 0.12));
        ctx.fillRect(r() * n, r() * n, 2 + r() * 6, 2 + r() * 4);
      }
    } else if (kind === 'brique') {
      for (let y = 0, row = 0; y < n; y += 8, row++)
        for (let x = row % 2 ? -8 : 0; x < n; x += 16) {
          ctx.fillStyle = css(shade(base, 0.85 + r() * 0.25));
          ctx.fillRect(x + 1, y + 1, 14, 6);
        }
    } else if (kind === 'colombages') {
      for (let k = 0; k < 160; k++) {
        ctx.fillStyle = css(shade(base, 0.94 + r() * 0.08));
        ctx.fillRect(r() * n, r() * n, 4, 3);
      }
      ctx.fillStyle = '#5a3a22';
      ctx.fillRect(0, 0, n, 7);
      ctx.fillRect(0, n / 2 - 3, n, 6);
      for (const x of [0, n / 2]) ctx.fillRect(x, 0, 7, n);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#5a3a22';
      ctx.beginPath();
      ctx.moveTo(4, n / 2);
      ctx.lineTo(n / 2, 4);
      ctx.moveTo(n / 2 + 4, n);
      ctx.lineTo(n, n / 2 + 4);
      ctx.stroke();
    } else if (kind === 'bois') {
      for (let x = 0; x < n; x += 16) {
        ctx.fillStyle = css(shade(base, 0.88 + r() * 0.2));
        ctx.fillRect(x + 1, 0, 14, n);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, 0, 1.5, n);
      }
    } else if (kind === 'tole') {
      for (let x = 0; x < n; x += 8) {
        ctx.fillStyle = css(shade(base, 1.12));
        ctx.fillRect(x, 0, 3, n);
        ctx.fillStyle = css(shade(base, 0.8));
        ctx.fillRect(x + 5, 0, 2, n);
      }
    }
  });
}

type RoofKind = Architecture['toitType'] | 'tole' | 'chaume' | 'verre' | 'solaire';
function roofTex(kind: RoofKind, base: number, seed: number, rot: boolean) {
  return texCanvas((ctx, n) => {
    const r = rand(seed);
    ctx.fillStyle = css(base);
    ctx.fillRect(0, 0, n, n);
    if (kind === 'tuiles') {
      // tuiles canal : rangs ondulés
      for (let y = 0; y < n; y += 14)
        for (let x = 0; x < n; x += 12) {
          const c = shade(base, 0.85 + r() * 0.3);
          const g = ctx.createLinearGradient(x, 0, x + 12, 0);
          g.addColorStop(0, css(shade(c, 0.75)));
          g.addColorStop(0.5, css(shade(c, 1.15)));
          g.addColorStop(1, css(shade(c, 0.75)));
          ctx.fillStyle = g;
          ctx.fillRect(x, y, 12, 13);
          ctx.fillStyle = 'rgba(0,0,0,0.35)';
          ctx.fillRect(x, y + 12, 12, 2);
        }
    } else if (kind === 'tuilesPlates' || kind === 'ardoise' || kind === 'lauzes' || kind === 'chaume') {
      const h = kind === 'lauzes' ? 18 : kind === 'chaume' ? 10 : 10;
      for (let y = 0, row = 0; y < n; y += h, row++) {
        let x = row % 2 ? -r() * 14 : 0;
        while (x < n) {
          const w = kind === 'lauzes' ? 18 + r() * 20 : kind === 'chaume' ? 3 : 12;
          ctx.fillStyle = css(shade(base, (kind === 'ardoise' ? 0.9 : 0.8) + r() * (kind === 'ardoise' ? 0.18 : 0.35)));
          ctx.fillRect(x + 1, y + 1, w - 1.5, h - 2);
          x += w;
        }
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, y + h - 1.5, n, 1.5);
      }
    } else if (kind === 'tole') {
      for (let x = 0; x < n; x += 8) {
        ctx.fillStyle = css(shade(base, 1.15));
        ctx.fillRect(x, 0, 3, n);
        ctx.fillStyle = css(shade(base, 0.78));
        ctx.fillRect(x + 5, 0, 2, n);
      }
      ctx.fillStyle = 'rgba(120,60,20,0.18)';
      for (let k = 0; k < 10; k++) ctx.fillRect(r() * n, r() * n, 6, 14);
    } else if (kind === 'solaire') {
      ctx.fillStyle = '#1e3050';
      ctx.fillRect(0, 0, n, n);
      ctx.strokeStyle = '#8aa0c0';
      ctx.lineWidth = 2;
      for (let x = 0; x <= n; x += 32) ctx.strokeRect(x, 0, 32, n / 2), ctx.strokeRect(x, n / 2, 32, n / 2);
      ctx.strokeStyle = 'rgba(160,190,230,0.35)';
      ctx.lineWidth = 1;
      for (let y = 0; y < n; y += 8) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(n, y);
        ctx.stroke();
      }
    } else if (kind === 'verre') {
      ctx.fillStyle = 'rgba(220,240,250,1)';
      ctx.fillRect(0, 0, n, n);
      ctx.fillStyle = '#e8ece8';
      for (let x = 0; x < n; x += 32) ctx.fillRect(x, 0, 3, n);
    }
  }, rot);
}

/** Met à l'échelle les UV d'une boîte (1 répétition de texture = 1 unité). */
function boxUV(geo: THREE.BufferGeometry, w: number, h: number, d: number) {
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  // ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z (4 sommets chacune)
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
  }
  uv.needsUpdate = true;
  return geo;
}

// ————— style régional —————
export interface Style {
  wall: THREE.Material;
  wallKind: WallKind;
  wallColor: number;
  roofColor: number;
  roofKind: RoofKind;
  pente: number;
  volets: number;
  roofMat: (rot: boolean) => THREE.Material;
  timber: THREE.Material;
  stone: THREE.Material;
}

const styleCache = new Map<string, Style>();
export function regionStyle(a: Architecture): Style {
  const k = JSON.stringify(a);
  let s = styleCache.get(k);
  if (s) return s;
  const wallColor = hex(a.mur);
  const roofColor = hex(a.toit);
  const wallKind: WallKind = a.brique ? 'brique' : a.colombages ? 'colombages' : a.toitType === 'lauzes' || a.toitType === 'ardoise' ? 'pierre' : 'enduit';
  const roofs = new Map<boolean, THREE.Material>();
  s = {
    wallKind,
    wallColor,
    roofColor,
    roofKind: a.toitType,
    pente: a.pente,
    volets: hex(a.volets),
    wall: texMat(wallTex(wallKind, wallKind === 'colombages' ? 0xefe6d0 : wallColor, 7)),
    roofMat: (rot) => {
      let m = roofs.get(rot);
      if (!m) roofs.set(rot, (m = texMat(roofTex(a.toitType, roofColor, 3, rot))));
      return m;
    },
    timber: toon(0x6a4a2e),
    stone: texMat(wallTex('pierre', shade(wallColor, 0.9), 11)),
  };
  styleCache.set(k, s);
  return s;
}

function texMat(map: THREE.Texture, opts: { glass?: boolean } = {}) {
  const grad = (toon(0xffffff) as THREE.MeshToonMaterial).gradientMap;
  return new THREE.MeshToonMaterial({ map, gradientMap: grad, transparent: !!opts.glass, opacity: opts.glass ? 0.5 : 1 });
}
const matByKind = new Map<string, THREE.Material>();
function wallMat(kind: WallKind, color: number) {
  const k = kind + color;
  let m = matByKind.get(k);
  if (!m) matByKind.set(k, (m = texMat(wallTex(kind, color, 5))));
  return m;
}
function roofMatOf(kind: RoofKind, color: number, rot: boolean) {
  const k = 'r' + kind + color + rot;
  let m = matByKind.get(k);
  if (!m) matByKind.set(k, (m = texMat(roofTex(kind, color, 9, rot), { glass: kind === 'verre' })));
  return m;
}

// ————— éléments de construction —————
const ROOF = 'roof';
const markRoof = (m: THREE.Object3D) => {
  m.userData[ROOF] = true;
  return m;
};

/** Volume de murs : coin (x0, z0) au sol, largeur w (x), profondeur d (z), hauteur h. */
function walls(p: THREE.Object3D, x0: number, z0: number, w: number, d: number, h: number, mat: THREE.Material, y0 = 0) {
  return add(p, boxUV(new THREE.BoxGeometry(w, h, d), w, h, d), mat, x0 + w / 2, y0 + h / 2, z0 + d / 2);
}

/** Toit à deux pans (faîtage selon x ou z), pignons maçonnés, débord. */
function gable(p: THREE.Object3D, x0: number, z0: number, w: number, d: number, y0: number, rise: number, along: 'x' | 'z', roof: THREE.Material, gableMat: THREE.Material, over = 0.1) {
  const span = along === 'x' ? d : w;
  const len = along === 'x' ? w : d;
  // pignons
  const sh = new THREE.Shape([new THREE.Vector2(-span / 2, 0), new THREE.Vector2(span / 2, 0), new THREE.Vector2(0, rise)]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false });
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  if (along === 'x') {
    g.rotateY(Math.PI / 2);
    add(p, g, gableMat, x0, y0, z0 + d / 2);
  } else add(p, g, gableMat, x0 + w / 2, y0, z0);
  // pans
  const half = span / 2 + over;
  const L = Math.hypot(half, rise * (half / (span / 2)));
  const ang = Math.atan2(rise, span / 2);
  const t = 0.07;
  for (const sgn of [-1, 1]) {
    const geo = along === 'x' ? boxUV(new THREE.BoxGeometry(len + 2 * over, t, L), len + 2 * over, t, L) : boxUV(new THREE.BoxGeometry(L, t, len + 2 * over), L, t, len + 2 * over);
    const off = (L / 2) * Math.cos(ang) - over * 0;
    const cy = y0 + rise - (L / 2) * Math.sin(ang) + t / 2 + 0.01;
    let m: THREE.Mesh;
    if (along === 'x') {
      m = add(p, geo, roof, x0 + w / 2, cy, z0 + d / 2 + sgn * off);
      m.rotation.x = sgn * ang;
    } else {
      m = add(p, geo, roof, x0 + w / 2 + sgn * off, cy, z0 + d / 2);
      m.rotation.z = -sgn * ang;
    }
    markRoof(m);
  }
  // faîtière
  const rg = along === 'x' ? new THREE.BoxGeometry(len + 2 * over, 0.06, 0.08) : new THREE.BoxGeometry(0.08, 0.06, len + 2 * over);
  markRoof(add(p, rg, toon(shade((roof as THREE.MeshToonMaterial).color?.getHex?.() ?? 0x884433, 0.7)), x0 + w / 2, y0 + rise + 0.05, z0 + d / 2));
}

/** Toit en croupe (4 pans) : pyramide tronquée. */
function hip(p: THREE.Object3D, x0: number, z0: number, w: number, d: number, y0: number, rise: number, roof: THREE.Material, over = 0.1) {
  const g = new THREE.CylinderGeometry(0.0001, Math.SQRT1_2, 1, 4, 1);
  g.rotateY(Math.PI / 4);
  g.scale(w + 2 * over, rise, d + 2 * over);
  const m = add(p, g, roof, x0 + w / 2, y0 + rise / 2, z0 + d / 2);
  markRoof(m);
  if (w > d * 1.2) {
    // faîtage allongé : deux pans complémentaires
    const g2 = new THREE.BoxGeometry(w - d, 0.05, 0.05);
    markRoof(add(p, g2, toon(0x6a4030), x0 + w / 2, y0 + rise, z0 + d / 2));
  }
}

/** Toit monopente (appentis, hangars). */
function shed(p: THREE.Object3D, x0: number, z0: number, w: number, d: number, yBack: number, yFront: number, roof: THREE.Material, over = 0.12) {
  const L = Math.hypot(d + 2 * over, yBack - yFront);
  const ang = Math.atan2(yBack - yFront, d);
  const geo = boxUV(new THREE.BoxGeometry(w + 2 * over, 0.06, L), w + 2 * over, 0.06, L);
  const m = add(p, geo, roof, x0 + w / 2, (yBack + yFront) / 2 + 0.03, z0 + d / 2);
  m.rotation.x = ang;
  markRoof(m);
}

type Face = 'z' | 'x';
/** Position sur une façade avant : face +z (le long de x) ou +x (le long de z). */
function onFace(face: Face, x0: number, z0: number, w: number, d: number, along: number, out = 0.01): [number, number] {
  return face === 'z' ? [x0 + along, z0 + d + out] : [x0 + w + out, z0 + along];
}
function plate(p: THREE.Object3D, face: Face, pos: [number, number], bw: number, bh: number, y: number, c: number | THREE.Material, depth = 0.04, ink = true) {
  const geo = face === 'z' ? new THREE.BoxGeometry(bw, bh, depth) : new THREE.BoxGeometry(depth, bh, bw);
  return add(p, geo, typeof c === 'number' ? toon(c) : c, pos[0], y, pos[1], ink);
}

function door(p: THREE.Object3D, face: Face, pos: [number, number], kind: 'simple' | 'grange' | 'vitree' | 'garage' | 'arche', color = 0x7a5034) {
  if (kind === 'grange') {
    plate(p, face, pos, 0.62, 0.62, 0.31, color);
    // croix de Saint-André
    for (const s of [-1, 1]) {
      const m = plate(p, face, [pos[0] + (face === 'x' ? 0.012 : 0), pos[1] + (face === 'z' ? 0.012 : 0)], 0.78, 0.05, 0.31, shade(color, 0.7), 0.02, false);
      if (face === 'z') m.rotation.z = s * 0.78;
      else m.rotation.x = s * 0.78;
    }
    plate(p, face, pos, 0.02, 0.62, 0.31, shade(color, 0.6), 0.05, false);
    return;
  }
  if (kind === 'garage') {
    plate(p, face, pos, 0.7, 0.55, 0.28, 0xd8d4cc);
    for (let k = 0; k < 5; k++) plate(p, face, pos, 0.68, 0.012, 0.08 + k * 0.1, 0x9a968e, 0.05, false);
    return;
  }
  const h = kind === 'arche' ? 0.48 : 0.42;
  plate(p, face, pos, 0.3, h + 0.04, h / 2, 0xe8e0cc, 0.03); // encadrement
  plate(p, face, pos, 0.24, h, h / 2, kind === 'vitree' ? toon(0x6a8aa0) : color, 0.05);
  if (kind === 'vitree') plate(p, face, pos, 0.02, h, h / 2, 0xe8e0cc, 0.06, false);
  // poignée
  const hp: [number, number] = face === 'z' ? [pos[0] + 0.07, pos[1] + 0.03] : [pos[0] + 0.03, pos[1] - 0.07];
  plate(p, face, hp, 0.025, 0.025, h * 0.5, 0xd8b040, 0.03, false);
}

function window_(p: THREE.Object3D, face: Face, pos: [number, number], y: number, volets: number | null, w = 0.2, h = 0.26) {
  plate(p, face, pos, w + 0.05, h + 0.05, y, 0xece4d2, 0.025);
  plate(p, face, pos, w, h, y, toon(0x3a5068), 0.035, false);
  plate(p, face, pos, 0.015, h, y, 0xece4d2, 0.04, false);
  plate(p, face, pos, w, 0.015, y, 0xece4d2, 0.04, false);
  if (volets != null)
    for (const s of [-1, 1]) {
      const q: [number, number] = face === 'z' ? [pos[0] + s * (w / 2 + 0.07), pos[1]] : [pos[0], pos[1] + s * (w / 2 + 0.07)];
      plate(p, face, q, 0.12, h + 0.02, y, volets, 0.03);
    }
  // appui fleuri
  const fl: [number, number] = face === 'z' ? [pos[0], pos[1] + 0.04] : [pos[0] + 0.04, pos[1]];
  plate(p, face, fl, w + 0.04, 0.05, y - h / 2 - 0.04, 0x8a5a3a, 0.06, false);
}

function flowers(p: THREE.Object3D, x: number, z: number, n = 5, seed = 1) {
  const r = rand(seed);
  for (let k = 0; k < n; k++) {
    const c = [0xd84050, 0xf0c040, 0xe070b0, 0xf4f0e0, 0x9050c0][Math.floor(r() * 5)];
    add(p, new THREE.SphereGeometry(0.045, 6, 4), toon(c), x + (r() - 0.5) * 0.4, 0.05, z + (r() - 0.5) * 0.15, false);
  }
  add(p, new THREE.SphereGeometry(0.1, 6, 4).scale(2.2, 0.7, 0.8), toon(0x4a7a3a), x, 0.04, z, false);
}

function chimney(p: THREE.Object3D, x: number, z: number, y: number, h = 0.45, mat?: THREE.Material) {
  add(p, boxUV(new THREE.BoxGeometry(0.16, h, 0.16), 0.16, h, 0.16), mat ?? toon(0x9a8a7a), x, y + h / 2, z);
  box(p, 0.2, 0.04, 0.2, 0x6a5a4a, x, y + h + 0.02, z, 0.005);
}

/** Enseigne peinte (texte lisible, jamais en miroir). */
function sign(p: THREE.Object3D, face: Face, pos: [number, number], y: number, text: string, bg = 0x3a5a3a, fg = '#f4ead0', w = 0.7) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = css(bg);
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = fg;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 244, 52);
  ctx.fillStyle = fg;
  ctx.font = `bold ${text.length > 10 ? 30 : 38}px Georgia, serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 34, 236);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  const m = new THREE.MeshBasicMaterial({ map: t });
  const h = w / 4;
  const geo = face === 'z' ? new THREE.BoxGeometry(w, h, 0.03) : new THREE.BoxGeometry(0.03, h, w);
  if (face === 'x') {
    // le texte se lit depuis +x : la face +x de la boîte porte la texture
    const mats = [m, toon(bg), toon(bg), toon(bg), toon(bg), toon(bg)];
    return add(p, geo, mats as unknown as THREE.Material, pos[0] + 0.02, y, pos[1]);
  }
  const mats = [toon(bg), toon(bg), toon(bg), toon(bg), m, toon(bg)];
  return add(p, geo, mats as unknown as THREE.Material, pos[0], y, pos[1] + 0.02);
}

function barrel(p: THREE.Object3D, x: number, z: number, y = 0, lying = false) {
  const g = new THREE.CylinderGeometry(0.11, 0.11, 0.26, 12);
  if (lying) g.rotateX(Math.PI / 2);
  add(p, g, toon(0x8a5a32), x, y + (lying ? 0.11 : 0.13), z);
  for (const k of [-0.08, 0.08]) {
    const h = new THREE.CylinderGeometry(0.115, 0.115, 0.02, 12);
    if (lying) h.rotateX(Math.PI / 2);
    add(p, h, toon(0x3a3632), x, y + (lying ? 0.11 : 0.13 + k), z + (lying ? k : 0), false);
  }
}
function crate(p: THREE.Object3D, x: number, z: number, c: number, y = 0) {
  box(p, 0.2, 0.12, 0.16, 0xb88a58, x, y + 0.06, z, 0.01);
  for (let k = 0; k < 4; k++) add(p, new THREE.SphereGeometry(0.035, 6, 4), toon(c), x - 0.06 + (k % 2) * 0.12, y + 0.14, z - 0.03 + (k >> 1) * 0.06, false);
}
function bench(p: THREE.Object3D, x: number, z: number, alongX = true) {
  box(p, alongX ? 0.36 : 0.1, 0.03, alongX ? 0.1 : 0.36, 0x8a6a42, x, 0.12, z, 0.005);
  for (const s of [-1, 1]) box(p, 0.03, 0.12, 0.03, 0x5a4a32, x + (alongX ? s * 0.15 : 0), 0.06, z + (alongX ? 0 : s * 0.15), 0);
}
function parasol(p: THREE.Object3D, x: number, z: number, c: number) {
  add(p, new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), toon(0xe8e0d0), x, 0.25, z, false);
  add(p, new THREE.ConeGeometry(0.26, 0.1, 8), toon(c), x, 0.52, z);
  box(p, 0.3, 0.03, 0.3, 0xf0ece0, x, 0.2, z, 0.01);
  for (const [dx, dz] of [[-0.2, 0], [0.2, 0]]) box(p, 0.08, 0.14, 0.08, 0x8a6a42, x + dx, 0.07, z + dz, 0.01);
}
function tree(p: THREE.Object3D, x: number, z: number, s = 1, c = 0x4a7a32) {
  add(p, new THREE.CylinderGeometry(0.04 * s, 0.06 * s, 0.4 * s, 6), toon(0x6a4a2e), x, 0.2 * s, z);
  add(p, new THREE.IcosahedronGeometry(0.26 * s, 1), toon(c), x, 0.5 * s, z);
  add(p, new THREE.IcosahedronGeometry(0.18 * s, 1), toon(shade(c, 1.15)), x + 0.1 * s, 0.6 * s, z + 0.08 * s);
}
function hayBale(p: THREE.Object3D, x: number, z: number, y = 0) {
  const g = new THREE.CylinderGeometry(0.16, 0.16, 0.22, 14);
  g.rotateX(Math.PI / 2);
  add(p, g, toon(0xd8b860), x, y + 0.16, z);
}
function fenceRow(p: THREE.Object3D, x0: number, z0: number, x1: number, z1: number, c = 0xe8e0cc) {
  const n = Math.max(2, Math.round(Math.hypot(x1 - x0, z1 - z0) / 0.25));
  for (let k = 0; k <= n; k++) box(p, 0.03, 0.16, 0.03, c, x0 + ((x1 - x0) * k) / n, 0.08, z0 + ((z1 - z0) * k) / n, 0);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const m = box(p, len, 0.025, 0.02, c, (x0 + x1) / 2, 0.13, (z0 + z1) / 2, 0);
  m.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
}

// ————— maison type (bloc + toit + ouvertures) —————
interface HouseSpec {
  x0: number;
  z0: number;
  w: number;
  d: number;
  h: number;
  rise?: number;
  along?: 'x' | 'z';
  hip?: boolean;
  door?: 'simple' | 'grange' | 'vitree' | 'garage' | 'arche' | null;
  doorAt?: number; // position de la porte le long de la façade +z (absolue en x)
  winZ?: number[]; // fenêtres façade +z (x absolu)
  winX?: number[]; // fenêtres façade +x (z absolu)
  floors?: number;
  chimneys?: [number, number][];
  wall?: THREE.Material;
  roof?: THREE.Material;
  volets?: number | null;
}
function house(p: THREE.Object3D, st: Style, o: HouseSpec) {
  const wall = o.wall ?? st.wall;
  walls(p, o.x0, o.z0, o.w, o.d, o.h, wall);
  // soubassement
  walls(p, o.x0 - 0.02, o.z0 - 0.02, o.w + 0.04, o.d + 0.04, 0.08, st.stone);
  const along = o.along ?? (o.w >= o.d ? 'x' : 'z');
  const rise = (o.rise ?? 0.55) * st.pente;
  const roof = o.roof ?? st.roofMat(along === 'z');
  if (o.hip) hip(p, o.x0, o.z0, o.w, o.d, o.h, rise, roof);
  else gable(p, o.x0, o.z0, o.w, o.d, o.h, rise, along, roof, wall);
  const vol = o.volets === undefined ? st.volets : o.volets;
  const floors = o.floors ?? (o.h > 1 ? 2 : 1);
  const ys = floors === 2 ? [0.33, o.h - 0.32] : [o.h * 0.5];
  for (const x of o.winZ ?? [])
    for (const [i, y] of ys.entries()) if (!(i === 0 && o.door && o.doorAt != null && Math.abs(x - o.doorAt) < 0.3)) window_(p, 'z', onFace('z', o.x0, o.z0, o.w, o.d, x - o.x0), y, vol);
  for (const z of o.winX ?? []) for (const y of ys) window_(p, 'x', onFace('x', o.x0, o.z0, o.w, o.d, z - o.z0), y, vol);
  if (o.door && o.doorAt != null) door(p, 'z', onFace('z', o.x0, o.z0, o.w, o.d, o.doorAt - o.x0), o.door);
  for (const [x, z] of o.chimneys ?? []) chimney(p, x, z, o.h + rise * 0.5, 0.5, st.stone);
}

// ————— modèles par type —————
// size = côté de l'emprise ; dx = abscisse de la porte (façade +z). La porte du jeu est sur la case
// devant la façade +z, au milieu (orientation 0) ; l'orientation 1 réutilise le modèle tourné.
export function buildingModel(type: string, st: Style, size: number, dx: number): THREE.Group {
  const p = new THREE.Group();
  const s = size;
  const m = 0.16; // retrait par rapport au bord de l'emprise
  const W = s - 2 * m;
  const atelier = (label: string, extras: (front: number) => void, o: Partial<HouseSpec> = {}) => {
    // silhouettes variées : pignon en façade pour un atelier sur deux
    let hsh = 0;
    for (const ch of type) hsh = (hsh * 31 + ch.charCodeAt(0)) >>> 0;
    const along = hsh % 2 ? 'z' : 'x';
    const h = 0.78 + (hsh % 3) * 0.06;
    house(p, st, { x0: m, z0: m + 0.1, w: W, d: W - 0.25, h, along, rise: along === 'z' ? 0.5 : 0.55, door: 'vitree', doorAt: dx, winZ: [dx + (dx > s / 2 ? -0.55 : 0.5)], winX: [s / 2], chimneys: [[m + 0.3, m + 0.5]], ...o });
    const front = m + 0.1 + W - 0.25;
    // enseigne au-dessus de la porte, sous l'avancée du toit
    sign(p, 'z', [dx, front + 0.01], along === 'z' ? h + 0.12 : 0.6, label, [0x5a3a2a, 0x3a5a3a, 0x2a4a6a, 0x7a2a2a][hsh % 4], '#f4ead0', 0.6);
    extras(front);
  };
  switch (type) {
    case 'maison': {
      house(p, st, { x0: 0.3, z0: 0.35, w: 2.4, d: 1.55, h: 1.25, door: 'arche', doorAt: dx, winZ: [0.75, dx, 2.25], winX: [0.75, 1.5], chimneys: [[0.7, 1.1], [2.3, 1.1]], hip: st.roofKind === 'tuiles' });
      // appentis et perron
      walls(p, 0.3, 1.9, 0.7, 0.55, 0.6, st.wall);
      shed(p, 0.3, 1.9, 0.7, 0.55, 0.78, 0.55, st.roofMat(false));
      box(p, 0.5, 0.06, 0.25, 0xa89880, dx, 0.03, 2.05, 0.01);
      flowers(p, 1.0, 2.0, 6, 3);
      flowers(p, 2.25, 2.0, 5, 4);
      bench(p, 2.6, 1.6, false);
      tree(p, 2.65, 2.6, 0.9);
      break;
    }
    case 'grange': {
      house(p, st, { x0: 0.25, z0: 0.25, w: 2.5, d: 2.2, h: 1.15, rise: 0.75, along: 'z', door: 'grange', doorAt: dx, winX: [0.8, 1.8], floors: 1, volets: null, wall: st.wallKind === 'enduit' ? wallMat('bois', 0x8a5a3a) : st.wall });
      // lucarne de fenil + foin
      plate(p, 'z', [dx, 2.46], 0.32, 0.26, 1.35, 0x3a2a1a);
      hayBale(p, 2.55, 2.65);
      hayBale(p, 2.2, 2.75);
      hayBale(p, 2.4, 2.65, 0.3);
      add(p, new THREE.CylinderGeometry(0.02, 0.02, 0.5, 4), toon(0x8a6a42), 0.5, 0.25, 2.6, false);
      break;
    }
    case 'hangar':
    case 'remise':
    case 'remise_viti': {
      const wood = type !== 'hangar';
      const roof = roofMatOf('tole', wood ? 0x7a6a5a : 0x8a9298, false);
      const posts = wood ? 0x6a4a2e : 0x5a6068;
      for (const x of [0.25, 1.5, 2.75]) for (const z of [0.3, 2.65]) box(p, 0.08, 1.05, 0.08, posts, x, 0.52, z, 0.01);
      walls(p, 0.2, 0.25, 2.6, 0.08, 1.0, wallMat(wood ? 'bois' : 'tole', wood ? 0x8a6a4a : 0x9aa2a8));
      walls(p, 0.2, 0.25, 0.08, 2.4, 1.0, wallMat(wood ? 'bois' : 'tole', wood ? 0x8a6a4a : 0x9aa2a8));
      shed(p, 0.2, 0.25, 2.6, 2.45, 1.25, 1.0, roof);
      // outillage rangé au fond
      box(p, 0.5, 0.06, 0.5, 0x3a3632, 0.7, 0.03, 0.75, 0.01);
      for (let k = 0; k < 3; k++) box(p, 0.06, 0.3, 0.06, 0xc4332b, 2.2 + k * 0.15, 0.15, 0.6, 0.01);
      if (type === 'remise_viti') for (let k = 0; k < 3; k++) barrel(p, 2.4, 1.0 + k * 0.3, 0, true);
      else hayBale(p, 2.45, 1.2);
      break;
    }
    case 'silo': {
      for (const [x, z, r] of [[0.6, 0.65, 0.42], [1.4, 1.2, 0.36]] as const) {
        const t = texMat(wallTex('tole', 0xb8bec4, 2));
        add(p, new THREE.CylinderGeometry(r, r, 1.6, 20), t, x, 0.8, z);
        markRoof(add(p, new THREE.ConeGeometry(r * 1.04, 0.35, 20), toon(0xa8aeb4), x, 1.77, z));
        for (let k = 0; k < 4; k++) add(p, new THREE.CylinderGeometry(r * 1.01, r * 1.01, 0.02, 20), toon(0x7a8288), x, 0.3 + k * 0.4, z, false);
        for (let k = 0; k < 4; k++) box(p, 0.05, 0.25, 0.05, 0x5a6068, x + Math.cos(k * 1.57) * r * 0.8, 0.12, z + Math.sin(k * 1.57) * r * 0.8, 0);
      }
      // élévateur à godets et trémie de réception
      box(p, 0.12, 2.0, 0.12, 0xd8a030, 1.55, 1.0, 0.35, 0.01);
      const tube = box(p, 0.08, 0.08, 1.0, 0xd8a030, 1.1, 1.85, 0.45, 0.01);
      tube.rotation.y = 0.9;
      box(p, 0.5, 0.25, 0.4, 0x7a8288, dx, 0.13, 1.7, 0.02);
      for (let k = 0; k < 6; k++) box(p, 0.08, 0.015, 0.02, 0x3a3632, 0.62 + Math.cos(0.3) * 0.42, 0.2 + k * 0.25, 0.65 + 0.42, 0);
      break;
    }
    case 'chambre_froide': {
      const panel = wallMat('blanc', 0xeef0f0);
      walls(p, m, m + 0.2, W, W - 0.35, 0.85, panel);
      shed(p, m, m + 0.2, W, W - 0.35, 0.95, 0.88, roofMatOf('tole', 0xc8ccd0, false));
      door(p, 'z', onFace('z', m, m + 0.2, W, W - 0.35, dx - m), 'garage');
      // groupe froid sur le côté
      box(p, 0.3, 0.32, 0.35, 0x9aa2a8, s - 0.12, 0.17, 0.7, 0.02);
      add(p, new THREE.CylinderGeometry(0.11, 0.11, 0.03, 16).rotateZ(Math.PI / 2), toon(0x3a3632), s + 0.04, 0.2, 0.7, false);
      sign(p, 'z', [dx, s - m + 0.02 - 0.15], 0.72, 'FROID', 0x2a5a8a, '#fff', 0.4);
      break;
    }
    case 'garage_quad':
    case 'garage_utilitaire': {
      house(p, st, { x0: m, z0: m + 0.15, w: W, d: W - 0.4, h: 0.75, rise: 0.35, along: 'z', door: 'garage', doorAt: dx, winX: [0.9], floors: 1, wall: type === 'garage_quad' ? wallMat('bois', 0x8a6a4a) : st.wall });
      if (type === 'garage_quad') {
        // quad garé devant
        const q = new THREE.Group();
        for (const [x, z] of [[0.17, 0.12], [0.17, -0.12], [-0.17, 0.12], [-0.17, -0.12]]) wheel(q, 0.08, 0.07, 0x9a9a9a, x, 0.08, z, 0.3, true);
        box(q, 0.45, 0.12, 0.22, 0x3a7a3a, 0, 0.2, 0, 0.04);
        box(q, 0.14, 0.06, 0.16, 0x2c2a28, -0.04, 0.29, 0, 0.02);
        box(q, 0.03, 0.03, 0.3, 0x2c2a28, 0.15, 0.33, 0, 0.01);
        q.position.set(dx + 0.55, 0, s - 0.15);
        q.rotation.y = 0.4;
        p.add(q);
      } else {
        const v = van(0);
        v.scale.setScalar(0.8);
        v.position.set(dx - 0.1, 0, s - 0.05);
        p.add(v);
        sign(p, 'x', [s - m, 0.9], 0.55, 'MARCHÉ', 0x8a2a2a, '#fff', 0.5);
      }
      break;
    }
    case 'garage_bus': {
      // abri de la navette : quai, banc, poteau d'arrêt, panneau
      box(p, 1.6, 0.06, 0.7, 0xb8b0a0, 1.0, 0.03, 1.2, 0.01);
      for (const x of [0.3, 1.7]) box(p, 0.05, 0.7, 0.05, 0x3a5a7a, x, 0.38, 0.95, 0.01);
      walls(p, 0.25, 0.88, 1.5, 0.04, 0.6, texMat(roofTex('verre', 0, 1, false), { glass: true }), 0.08);
      shed(p, 0.2, 0.85, 1.6, 0.7, 0.78, 0.72, toon(0x3a5a7a));
      bench(p, 1.0, 1.05);
      add(p, new THREE.CylinderGeometry(0.02, 0.02, 0.9, 6), toon(0x9aa2a8), 1.85, 0.45, 1.55);
      add(p, new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16).rotateX(Math.PI / 2), toon(0x2a7a3a), 1.85, 0.9, 1.56);
      sign(p, 'z', [1.0, 1.58], 0.72, 'NAVETTE', 0x2a7a3a, '#fff', 0.6);
      break;
    }
    case 'telescopique': {
      walls(p, 0.2, 0.2, 1.6, 0.06, 0.8, wallMat('bois', 0x7a5a3a));
      shed(p, 0.2, 0.2, 1.6, 0.9, 0.95, 0.8, roofMatOf('tole', 0x8a9298, false));
      for (const x of [0.2, 1.8]) box(p, 0.06, 0.85, 0.06, 0x5a4a32, x, 0.42, 1.08, 0.01);
      // chargeur télescopique jaune
      const t = new THREE.Group();
      for (const [x, z] of [[0.28, 0.2], [0.28, -0.2], [-0.28, 0.2], [-0.28, -0.2]]) wheel(t, 0.13, 0.1, 0x3a3632, x, 0.13, z, 0.2, true);
      box(t, 0.8, 0.16, 0.34, 0xe0b020, 0, 0.28, 0, 0.04);
      box(t, 0.24, 0.3, 0.2, 0xe0b020, -0.05, 0.5, 0.1, 0.03);
      box(t, 0.2, 0.25, 0.18, toon(0x9cc8e0, { glass: true }), -0.05, 0.52, 0.1, 0.02);
      const boom = box(t, 0.9, 0.1, 0.1, 0xe0b020, 0.15, 0.52, -0.08, 0.02);
      boom.rotation.z = 0.32;
      box(t, 0.06, 0.04, 0.34, 0x3a3632, 0.62, 0.62, -0.08, 0.01);
      t.position.set(1.2, 0, 1.5);
      t.rotation.y = -0.5;
      p.add(t);
      for (const k of [0, 1]) box(p, 0.3, 0.12, 0.3, 0xc8a878, 0.5, 0.06 + k * 0.13, 1.6, 0.01);
      break;
    }
    case 'irrigation': {
      // bassin de rétention bâché, pompe et canalisations
      const g = new THREE.CylinderGeometry(0.82, 0.9, 0.18, 24);
      add(p, g, toon(0x5a5a50), 1.0, 0.09, 1.0);
      add(p, new THREE.CylinderGeometry(0.76, 0.76, 0.02, 24), toon(0x3a7aa8, { emissive: 0x0a2030 }), 1.0, 0.17, 1.0, false);
      box(p, 0.32, 0.3, 0.26, 0x2a5a8a, 1.75, 0.15, 1.75, 0.03);
      for (const [x, z, l, r] of [[1.9, 1.3, 0.8, 0], [1.4, 1.9, 0.8, Math.PI / 2]] as const) {
        const pipe = new THREE.CylinderGeometry(0.035, 0.035, l, 8);
        pipe.rotateX(Math.PI / 2);
        const mm = add(p, pipe, toon(0x9aa2a8), x, 0.06, z);
        mm.rotation.y = r;
      }
      fenceRow(p, 0.1, 0.1, 1.9, 0.1, 0x7a8288);
      fenceRow(p, 0.1, 0.1, 0.1, 1.9, 0x7a8288);
      break;
    }
    case 'solaire': {
      house(p, st, { x0: m, z0: m + 0.1, w: W, d: W - 0.25, h: 0.7, along: 'x', rise: 0.45, door: 'grange', doorAt: dx, floors: 1, volets: null, roof: roofMatOf('solaire', 0, false), wall: wallMat('bois', 0x8a6a4a) });
      box(p, 0.2, 0.3, 0.12, 0xd8d8d0, s - 0.2, 0.15, 0.5, 0.01); // onduleur
      break;
    }
    case 'gite': {
      house(p, st, { x0: 0.3, z0: 0.3, w: 2.3, d: 1.45, h: 1.2, door: 'vitree', doorAt: dx, winZ: [0.7, dx, 2.25], winX: [0.8], chimneys: [[0.6, 1.0]] });
      // terrasse, salon de jardin, piscine hors-sol
      box(p, 1.1, 0.05, 0.6, 0xb89870, 2.0, 0.03, 2.15, 0.01);
      parasol(p, 2.15, 2.15, 0xe0a040);
      add(p, new THREE.CylinderGeometry(0.35, 0.35, 0.16, 20), toon(0xe8e8e0), 0.75, 0.08, 2.45);
      add(p, new THREE.CylinderGeometry(0.31, 0.31, 0.02, 20), toon(0x4ab0d0, { emissive: 0x103040 }), 0.75, 0.16, 2.45, false);
      flowers(p, dx - 0.35, 1.85, 5, 7);
      tree(p, 2.75, 0.6, 1.1);
      sign(p, 'z', [dx + 0.55, 1.77], 0.85, 'GÎTE', 0x3a6a4a, '#f4ead0', 0.4);
      break;
    }
    case 'camping': {
      // tentes, caravane, bloc sanitaire, table de pique-nique
      house(p, st, { x0: 0.2, z0: 0.2, w: 0.9, d: 0.7, h: 0.6, rise: 0.3, along: 'x', door: 'simple', doorAt: 0.65, floors: 1, wall: wallMat('bois', 0x9a7a52) });
      for (const [x, z, c] of [[1.6, 0.6, 0xd84a3a], [2.5, 0.7, 0x3a8ad8], [2.4, 1.7, 0x5aa84a]] as const) {
        const tent = new THREE.ConeGeometry(0.34, 0.42, 4);
        tent.rotateY(Math.PI / 4);
        add(p, tent, toon(c), x, 0.21, z);
        plate(p, 'z', [x, z + 0.18], 0.12, 0.2, 0.1, 0x2a2a2a, 0.02, false);
      }
      const cv = new THREE.Group();
      box(cv, 0.8, 0.4, 0.4, 0xf0ece4, 0, 0.32, 0, 0.08);
      box(cv, 0.8, 0.06, 0.41, 0x4a8ac0, 0, 0.3, 0, 0.01);
      for (const z of [-0.2, 0.2]) wheel(cv, 0.08, 0.05, 0xc8c8c8, 0.05, 0.08, z, 0, false);
      box(cv, 0.2, 0.12, 0.01, toon(0x9cc8e0, { glass: true }), 0.15, 0.4, 0.205, 0);
      cv.position.set(1.0, 0, 1.9);
      p.add(cv);
      box(p, 0.4, 0.04, 0.2, 0x8a6a42, 1.7, 0.22, 2.55, 0.01);
      for (const s2 of [-1, 1]) box(p, 0.4, 0.03, 0.06, 0x8a6a42, 1.7, 0.12, 2.55 + s2 * 0.16, 0.01);
      tree(p, 0.4, 1.4, 1.1);
      tree(p, 2.75, 2.6, 0.9, 0x5a8a3a);
      sign(p, 'z', [0.65, 0.92], 0.55, 'CAMPING', 0x2a6a8a, '#fff', 0.5);
      break;
    }
    case 'auberge': {
      house(p, st, { x0: 0.25, z0: 0.3, w: 2.5, d: 1.4, h: 1.05, door: 'vitree', doorAt: dx, winZ: [0.6, dx, 2.4], winX: [1.0], chimneys: [[0.6, 0.9], [2.4, 0.9]] });
      // pergola et tables en terrasse
      for (const x of [0.35, 1.0, 2.0, 2.65]) box(p, 0.05, 0.7, 0.05, 0x6a4a2e, x, 0.35, 2.55, 0.01);
      for (const z of [1.75, 2.15, 2.55]) box(p, 2.4, 0.04, 0.04, 0x6a4a2e, 1.5, 0.71, z, 0.005);
      for (const [x, z] of [[0.7, 2.15], [2.3, 2.15]]) parasol(p, x, z, 0xd84a3a);
      for (let k = 0; k < 6; k++) add(p, new THREE.SphereGeometry(0.06, 6, 4), toon(0x4a8a3a), 0.4 + k * 0.45, 0.74, 2.55, false);
      sign(p, 'z', [dx + 0.6, 1.71], 0.8, 'AUBERGE', 0x7a2a2a, '#f4ead0', 0.5);
      break;
    }
    case 'pedagogique': {
      house(p, st, { x0: m, z0: m + 0.1, w: W, d: W - 0.5, h: 0.75, along: 'z', rise: 0.45, door: 'grange', doorAt: dx, winX: [0.7], floors: 1, volets: null, wall: wallMat('bois', 0xb84a3a) });
      sign(p, 'z', [dx, 1.25 + 0.02], 0.98, 'FERME PÉDAGOGIQUE', 0xf0d050, '#5a3a1a', 0.75);
      bench(p, 0.5, 1.75);
      bench(p, 1.5, 1.75);
      fenceRow(p, 0.1, 1.95, 1.9, 1.95);
      flowers(p, 1.0, 1.45, 4, 9);
      break;
    }
    case 'boutique': {
      house(p, st, { x0: m, z0: m + 0.1, w: W, d: W - 0.3, h: 0.85, along: 'x', door: 'vitree', doorAt: dx, winZ: [dx - 0.6 > 0.3 ? dx - 0.6 : dx + 0.6], winX: [0.9], volets: st.volets });
      // auvent rayé, étal de produits, ardoise
      const front = m + 0.1 + W - 0.3;
      for (let k = 0; k < 6; k++) {
        const a = box(p, 0.24, 0.03, 0.36, k % 2 ? 0xf0ece0 : 0xc4332b, m + 0.12 + k * 0.24, 0.76, front + 0.15, 0);
        a.rotation.x = 0.45;
      }
      crate(p, dx + 0.45, front + 0.2, 0xd84a3a);
      crate(p, dx + 0.45, front + 0.42, 0xe8c040);
      crate(p, dx - 0.45, front + 0.25, 0x6aa040);
      box(p, 0.16, 0.24, 0.03, 0x2a2a2a, dx + 0.25, 0.12, front + 0.5, 0.005);
      sign(p, 'z', [dx, front + 0.01], 0.6, 'BOUTIQUE', 0x3a5a3a, '#f4ead0', 0.62);
      break;
    }
    case 'accueil': {
      house(p, st, { x0: m, z0: m + 0.1, w: W, d: W - 0.3, h: 0.85, along: 'x', door: 'vitree', doorAt: dx, winZ: [dx - 0.6 > 0.3 ? dx - 0.6 : dx + 0.6], winX: [0.9] });
      const front = m + 0.1 + W - 0.3;
      sign(p, 'z', [dx, front + 0.01], 0.6, 'ACCUEIL', 0x2a4a6a, '#f4ead0', 0.55);
      // panneau d'information et banc
      box(p, 0.04, 0.5, 0.04, 0x6a4a2e, dx + 0.6, 0.25, front + 0.35, 0.005);
      box(p, 0.36, 0.26, 0.03, 0x3a5a3a, dx + 0.6, 0.5, front + 0.37, 0.01);
      bench(p, dx - 0.55, front + 0.3);
      flowers(p, dx + 0.3, front + 0.12, 3, 5);
      break;
    }
    case 'pressoir':
      atelier('PRESSOIR', (f) => {
        box(p, 0.4, 0.08, 0.4, 0x8a5a32, s - 0.35, 0.3, f + 0.3, 0.01);
        add(p, new THREE.CylinderGeometry(0.16, 0.18, 0.26, 14), toon(0x8a5a32), s - 0.35, 0.17, f + 0.3);
        add(p, new THREE.CylinderGeometry(0.025, 0.025, 0.5, 6), toon(0x3a3632), s - 0.35, 0.55, f + 0.3);
        crate(p, 0.4, f + 0.25, 0xc83a2a);
      });
      break;
    case 'fromagerie':
      atelier('FROMAGERIE', (f) => {
        for (let k = 0; k < 3; k++) add(p, new THREE.CylinderGeometry(0.1, 0.1, 0.07, 14), toon(0xf0d890), 0.45 + k * 0.05, 0.04 + k * 0.07, f + 0.25);
        add(p, new THREE.CylinderGeometry(0.08, 0.1, 0.25, 12), toon(0xc8ccd0), s - 0.35, 0.12, f + 0.25);
      });
      break;
    case 'moulin':
      atelier('MOULIN', (f) => {
        // roue à aubes sur le côté
        const g = new THREE.Group();
        add(g, new THREE.CylinderGeometry(0.45, 0.45, 0.12, 16).rotateZ(Math.PI / 2), toon(0x6a4a2e));
        for (let k = 0; k < 8; k++) {
          const b2 = box(g, 0.14, 0.04, 0.95, 0x8a6a42, 0, 0, 0, 0.005);
          b2.rotation.x = (k * Math.PI) / 8;
        }
        g.position.set(s - 0.05, 0.45, 1.0);
        p.add(g);
        for (let k = 0; k < 2; k++) box(p, 0.22, 0.14, 0.16, 0xe8e0d0, 0.4, 0.07 + k * 0.14, f + 0.25, 0.02);
      }, { rise: 0.75 });
      break;
    case 'boulangerie':
      atelier('BOULANGERIE', (f) => {
        add(p, new THREE.SphereGeometry(0.32, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xb87a5a), s - 0.3, 0.0, 0.7);
        chimney(p, s - 0.3, 0.7, 0.28, 0.4);
        for (let k = 0; k < 3; k++) box(p, 0.16, 0.06, 0.07, 0xc8884a, 0.45 + k * 0.03, 0.06 + k * 0.06, f + 0.2, 0.03);
      });
      break;
    case 'brasserie':
      atelier('BRASSERIE', (f) => {
        add(p, new THREE.CylinderGeometry(0.2, 0.2, 0.5, 16), toon(0xc87a3a), s - 0.3, 0.25, f + 0.15);
        add(p, new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xc87a3a), s - 0.3, 0.5, f + 0.15);
        barrel(p, 0.45, f + 0.25);
        barrel(p, 0.45, f + 0.5, 0, true);
      });
      break;
    case 'chai':
      atelier('CHAI', (f) => {
        for (let k = 0; k < 3; k++) barrel(p, 0.45 + k * 0.28, f + 0.25, 0, true);
        barrel(p, 0.73, f + 0.25, 0.22, true);
      }, { door: 'arche' });
      break;
    case 'cidrerie':
      atelier('CIDRERIE', (f) => {
        barrel(p, s - 0.35, f + 0.25, 0, true);
        barrel(p, s - 0.35, f + 0.5, 0, true);
        crate(p, 0.45, f + 0.25, 0xd8b030);
        crate(p, 0.45, f + 0.45, 0xc83a2a);
      });
      break;
    case 'huilerie':
      atelier('HUILERIE', (f) => {
        for (let k = 0; k < 3; k++) {
          add(p, new THREE.SphereGeometry(0.1, 10, 8).scale(1, 1.3, 1), toon(0xc87848), 0.4 + k * 0.22, 0.13, f + 0.25);
        }
        add(p, new THREE.CylinderGeometry(0.22, 0.22, 0.12, 16), toon(0xb8b0a0), s - 0.35, 0.06, f + 0.3);
      }, { hip: true });
      break;
    case 'distillerie':
      atelier('DISTILLERIE', (f) => {
        add(p, new THREE.SphereGeometry(0.18, 12, 10), toon(0xc87a3a), s - 0.35, 0.22, f + 0.25);
        add(p, new THREE.CylinderGeometry(0.03, 0.06, 0.3, 8), toon(0xc87a3a), s - 0.35, 0.48, f + 0.25);
        for (let k = 0; k < 3; k++) add(p, new THREE.CylinderGeometry(0.04, 0.04, 0.12, 8), toon(0x9070c8, { glass: true }), 0.4 + k * 0.1, 0.06, f + 0.2, false);
      });
      break;
    case 'conserverie':
      atelier('CONSERVERIE', (f) => {
        for (let k = 0; k < 4; k++) add(p, new THREE.CylinderGeometry(0.045, 0.045, 0.1, 10), toon(k % 2 ? 0xc83a2a : 0xd8a030), 0.4 + k * 0.1, 0.05, f + 0.2, false);
        crate(p, s - 0.35, f + 0.25, 0x8a3a5a);
      });
      break;
    case 'beurrerie':
      atelier('BEURRERIE', (f) => {
        add(p, new THREE.CylinderGeometry(0.1, 0.13, 0.32, 12), toon(0xa87a4a), s - 0.35, 0.16, f + 0.25);
        add(p, new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), toon(0x6a4a2e), s - 0.35, 0.42, f + 0.25);
        box(p, 0.2, 0.08, 0.12, 0xf4e080, 0.45, 0.04, f + 0.2, 0.02);
      });
      break;
    case 'creperie':
      atelier('CRÊPERIE', (f) => {
        for (const [x, c] of [[0.45, 0xd84a3a], [s - 0.4, 0x2a6aa8]] as const) parasol(p, x, f + 0.35, c);
      }, { wall: st.stone });
      break;
    case 'confiserie':
      atelier('CONFISERIE', (f) => {
        for (let k = 0; k < 3; k++) add(p, new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), toon([0xe070b0, 0xd8a030, 0x8a3a2a][k]), 0.4 + k * 0.12, 0.06, f + 0.2, false);
        flowers(p, s - 0.4, f + 0.2, 4, 12);
      });
      break;
    case 'fumoir':
      atelier('FUMOIR', (f) => {
        walls(p, s - 0.55, f + 0.05, 0.36, 0.36, 0.7, st.stone);
        chimney(p, s - 0.37, f + 0.23, 0.7, 0.4, st.stone);
        for (let k = 0; k < 4; k++) box(p, 0.2, 0.08, 0.06, 0x8a6a42, 0.45, 0.04 + k * 0.08, f + 0.2, 0.01);
      });
      break;
    case 'boucherie':
    case 'charcuterie':
      atelier(type === 'boucherie' ? 'BOUCHERIE' : 'CHARCUTERIE', (f) => {
        for (let k = 0; k < 6; k++) {
          const a = box(p, 0.2, 0.03, 0.3, k % 2 ? 0xf0ece0 : 0xb82a2a, m + 0.25 + k * 0.22, 0.78, f + 0.12, 0);
          a.rotation.x = 0.45;
        }
        for (let k = 0; k < 3; k++) add(p, new THREE.CylinderGeometry(0.035, 0.035, 0.18, 8), toon(0x9a4a3a), 0.5 + k * 0.1, 0.55, f + 0.06, false);
      });
      break;
    case 'serre': {
      // tunnel maraîcher sur une parcelle 4×4 (arceaux et bâche translucide)
      const g = new THREE.CylinderGeometry(1.25, 1.25, 3.6, 18, 1, true, 0, Math.PI);
      g.rotateZ(Math.PI / 2); // axe du tunnel selon x, demi-cylindre au-dessus du sol
      g.scale(1, 0.75, 1);
      const glass = new THREE.MeshToonMaterial({ color: 0xe8f4f8, transparent: true, opacity: 0.42, side: THREE.DoubleSide, gradientMap: (toon(0xffffff) as THREE.MeshToonMaterial).gradientMap });
      markRoof(add(p, g, glass, 2.0, 0, 2.0, false));
      for (let k = 0; k < 7; k++) {
        const t = new THREE.TorusGeometry(1.25, 0.018, 4, 24, Math.PI);
        t.scale(1, 0.75, 1);
        add(p, t, toon(0xd8dcdc), 0.2 + k * 0.6, 0, 2.0, false).rotation.y = Math.PI / 2;
      }
      break;
    }
    // ————— abris des élevages (posés au coin de l'enclos) —————
    case 'abri':
      walls(p, 0.1, 0.1, 1.0, 0.06, 0.5, wallMat('bois', 0x8a6a4a));
      walls(p, 0.1, 0.1, 0.06, 0.9, 0.5, wallMat('bois', 0x8a6a4a));
      for (const [x, z] of [[1.1, 1.0], [1.1, 0.1], [0.1, 1.0]]) box(p, 0.06, 0.5, 0.06, 0x6a4a2e, x, 0.25, z, 0.01);
      shed(p, 0.1, 0.1, 1.0, 0.92, 0.65, 0.5, roofMatOf('tole', 0x8a6a5a, false));
      hayBale(p, 0.4, 0.4);
      break;
    case 'etable':
    case 'bergerie':
    case 'ecurie':
      house(p, st, { x0: 0.1, z0: 0.1, w: 2.0, d: 1.6, h: 0.75, rise: 0.5, along: 'x', door: type === 'ecurie' ? null : 'grange', doorAt: 1.1, floors: 1, volets: null, winX: [0.9], wall: type === 'bergerie' ? st.stone : wallMat('bois', type === 'ecurie' ? 0x6a4a2e : 0x8a5a3a) });
      if (type === 'ecurie')
        for (const x of [0.45, 1.1, 1.75]) {
          plate(p, 'z', [x, 1.71], 0.36, 0.3, 0.17, 0x5a3a22);
          plate(p, 'z', [x, 1.72], 0.32, 0.22, 0.5, 0x1a1410);
        }
      hayBale(p, 2.0, 1.95);
      break;
    case 'poulailler':
      walls(p, 0.15, 0.15, 0.75, 0.6, 0.42, wallMat('bois', 0xb8603a), 0.12);
      for (const [x, z] of [[0.2, 0.2], [0.85, 0.2], [0.2, 0.7], [0.85, 0.7]]) box(p, 0.05, 0.14, 0.05, 0x5a3a22, x, 0.07, z, 0);
      gable(p, 0.15, 0.15, 0.75, 0.6, 0.54, 0.25, 'x', roofMatOf('tuilesPlates', 0x8a4a32, false), wallMat('bois', 0xb8603a));
      plate(p, 'z', [0.5, 0.76], 0.14, 0.16, 0.3, 0x2a1a10);
      add(p, new THREE.BoxGeometry(0.06, 0.03, 0.35).rotateX(0.5), toon(0x8a6a42), 0.5, 0.1, 0.92);
      break;
    case 'porcherie':
      walls(p, 0.1, 0.1, 1.1, 0.8, 0.45, st.stone);
      shed(p, 0.1, 0.1, 1.1, 0.8, 0.62, 0.48, st.roofMat(false));
      plate(p, 'z', [0.55, 0.91], 0.26, 0.3, 0.15, 0x2a1a10);
      box(p, 0.5, 0.1, 0.16, 0x8a8a80, 0.55, 0.05, 1.15, 0.02);
      break;
    case 'clapier':
      for (let k = 0; k < 2; k++) {
        box(p, 1.0, 0.36, 0.5, 0x9a7a52, 0.65, 0.3 + k * 0.38, 0.45, 0.01);
        for (let c = 0; c < 3; c++) plate(p, 'z', [0.35 + c * 0.3, 0.71], 0.22, 0.24, 0.3 + k * 0.38, toon(0x5a5048), 0.02, false);
      }
      for (const x of [0.2, 1.1]) box(p, 0.05, 0.14, 0.05, 0x5a3a22, x, 0.07, 0.65, 0);
      shed(p, 0.12, 0.15, 1.06, 0.6, 1.0, 0.9, roofMatOf('tole', 0x8a7a6a, false));
      break;
    case 'etang': {
      const g = new THREE.CylinderGeometry(1.35, 1.35, 0.04, 28);
      g.scale(1, 1, 0.8);
      add(p, new THREE.CylinderGeometry(1.45, 1.45, 0.03, 28).scale(1, 1, 0.82), toon(0x8a7a58), 2.0, 0.01, 1.9, false);
      add(p, g, toon(0x3a7a98, { emissive: 0x0a2030 }), 2.0, 0.03, 1.9, false);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        add(p, new THREE.ConeGeometry(0.04, 0.32, 4), toon(0x5a8a3a), 2.0 + Math.cos(a) * 1.4, 0.16, 1.9 + Math.sin(a) * 1.1, false);
      }
      // ponton
      box(p, 0.7, 0.04, 0.24, 0x9a7a52, 2.8, 0.08, 2.9, 0.005);
      for (const x of [2.5, 3.1]) box(p, 0.04, 0.12, 0.04, 0x5a3a22, x, 0.04, 3.0, 0);
      add(p, new THREE.SphereGeometry(0.12, 8, 6).scale(1, 0.2, 1), toon(0x4a9a4a), 1.5, 0.05, 1.6, false);
      add(p, new THREE.SphereGeometry(0.1, 8, 6).scale(1, 0.2, 1), toon(0x4a9a4a), 2.4, 0.05, 1.5, false);
      break;
    }
    case 'hameau0':
    case 'hameau1':
    case 'hameau2':
    case 'hameau3': {
      const v = Number(type.slice(-1));
      house(p, st, { x0: 0.25, z0: 0.3, w: v % 2 ? 1.4 : 1.6, d: 1.2, h: v < 2 ? 0.95 : 1.15, door: 'simple', doorAt: v % 2 ? 0.7 : 1.1, winZ: [0.55, 1.45].filter((x) => x < (v % 2 ? 1.5 : 1.75)), winX: [0.9], chimneys: [[0.5, 0.9]], along: v === 3 ? 'z' : 'x' });
      if (v === 2) tree(p, 1.75, 1.7, 0.8);
      if (v === 1) flowers(p, 1.2, 1.62, 4, 21);
      break;
    }
    default:
      atelier(type.toUpperCase(), () => undefined);
  }
  return p;
}

// ————— prise de vue —————
export interface BShot {
  key: string;
  canvas: HTMLCanvasElement;
  ax: number;
  ay: number;
}

let renderer: THREE.WebGLRenderer | null = null;
const DEPTH_ONLY = new THREE.MeshBasicMaterial({ colorWrite: false });
const SNOW = new THREE.MeshToonMaterial({ color: 0xf4f8ff, gradientMap: (toon(0xffffff) as THREE.MeshToonMaterial).gradientMap });

/**
 * Photographie un bâtiment (coin d'emprise à l'origine) : image normale + calque « neige » de même cadrage.
 * L'ancre (ax, ay) est le coin haut de l'emprise, comme pour les bâtiments peints.
 */
export function shootBuilding(key: string, obj: THREE.Object3D, size: number, res: number, snow = true): BShot[] {
  const W = Math.ceil(size * 64 + 80), H = Math.ceil(size * 32 + 220), OY = 170;
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
  }
  renderer.setPixelRatio(1);
  renderer.setSize(W * res, H * res, false);
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xfff4e0, 1.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.0);
  sun.position.set(-2.2, 5, 1.2);
  scene.add(sun);
  scene.add(obj);
  const S = PX_PER_UNIT;
  // la caméra vise l'origine (coin haut de l'emprise), placée à OY px du haut du cadre
  const cam = new THREE.OrthographicCamera(-W / 2 / S, W / 2 / S, OY / S, -(H - OY) / S, -60, 60);
  const el = (30 * Math.PI) / 180;
  cam.position.set(Math.cos(el) * Math.SQRT1_2, Math.sin(el), Math.cos(el) * Math.SQRT1_2).multiplyScalar(20);
  cam.lookAt(0, 0, 0);
  const grab = () => {
    renderer!.render(scene, cam);
    const c = document.createElement('canvas');
    c.width = W * res;
    c.height = H * res;
    c.getContext('2d')!.drawImage(renderer!.domElement, 0, 0);
    return c;
  };
  const full = grab();
  const fctx = full.getContext('2d')!;
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
  const cx = (W / 2) * res, cy = OY * res;
  const proj = (gx: number, gz: number): [number, number] => [cx + (gx - gz) * 32 * res, cy + (gx + gz) * 16 * res];
  // ombre portée (lumière haut-gauche) : emprise décalée vers la droite
  const bb = new THREE.Box3().setFromObject(obj);
  const hgt = Math.max(0.3, bb.max.y);
  const sx = 0.45 * hgt, sz = -0.1 * hgt;
  const corners = [proj(bb.min.x, bb.min.z), proj(bb.max.x + sx, bb.min.z + sz), proj(bb.max.x + sx, bb.max.z + sz), proj(bb.max.x, bb.max.z), proj(bb.min.x, bb.max.z)];
  const pad = 6 * res;
  x0 = Math.max(0, Math.min(x0, ...corners.map((c) => c[0])) - pad);
  x1 = Math.min(full.width - 1, Math.max(x1, ...corners.map((c) => c[0])) + pad);
  y0 = Math.max(0, y0 - 2);
  y1 = Math.min(full.height - 1, Math.max(y1, ...corners.map((c) => c[1])) + pad);
  const crop = (src: HTMLCanvasElement, shadow: boolean) => {
    const c = document.createElement('canvas');
    c.width = x1 - x0 + 1;
    c.height = y1 - y0 + 1;
    const ctx = c.getContext('2d')!;
    if (shadow) {
      ctx.filter = `blur(${4 * res}px)`;
      ctx.fillStyle = 'rgba(30,30,15,0.34)';
      ctx.beginPath();
      ctx.moveTo(corners[0][0] - x0, corners[0][1] - y0);
      for (const p of corners.slice(1)) ctx.lineTo(p[0] - x0, p[1] - y0);
      ctx.closePath();
      ctx.fill();
      ctx.filter = 'none';
    }
    ctx.drawImage(src, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
    return c;
  };
  const out: BShot[] = [{ key, canvas: crop(full, true), ax: (cx - x0) / res, ay: (cy - y0) / res }];
  if (snow) {
    // calque neige : seuls les toits sont dessinés (en blanc), le reste masque par la profondeur
    const saved: [THREE.Mesh, THREE.Material | THREE.Material[], boolean][] = [];
    let roofs = 0;
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const isRoof = !!m.userData[ROOF] || !!m.parent?.userData[ROOF];
      const hull = (m.material as THREE.MeshBasicMaterial).side === THREE.BackSide;
      saved.push([m, m.material, m.visible]);
      m.renderOrder = 0;
      if (isRoof && !hull && !(m.material as THREE.Material).transparent) {
        m.material = SNOW;
        roofs++;
      } else if (hull && m.parent?.userData[ROOF]) m.visible = true;
      else {
        m.material = DEPTH_ONLY;
        m.renderOrder = -1; // la profondeur des murs et cheminées d'abord : masque proprement la neige
      }
    });
    if (roofs) {
      const sn = grab();
      out.push({ key: key + ':neige', canvas: crop(sn, false), ax: (cx - x0) / res, ay: (cy - y0) / res });
    }
    for (const [m, mat, v] of saved) {
      m.material = mat;
      m.visible = v;
    }
  }
  scene.remove(obj);
  return out;
}

export function buildingSize(type: string): number {
  if (type === 'serre' || type === 'etang') return 4;
  if (['abri', 'poulailler', 'porcherie', 'clapier'].includes(type)) return 2;
  if (['etable', 'bergerie', 'ecurie'].includes(type)) return 3;
  if (type.startsWith('hameau')) return 2;
  return 0;
}
