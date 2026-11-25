// Mobilier isométrique dessiné en vectoriel (PixiJS). Chaque meuble occupe une case.
import { Container, Graphics } from 'pixi.js';
import { box, iso, poly, shadeN } from './iso';

const WOOD = 0x9a6b42, WOOD_L = 0xb98a5a, METAL = 0x8d949b, STEEL = 0x6f777f, WHITE = 0xeef0ee, INK = 0x1d1a17;

export interface Animated { g: Graphics; kind: string; x: number; y: number; phase: number }

/** Dessine un meuble ; renvoie aussi les éléments animés (voyants, écrans, vapeur). */
export function drawFurniture(kind: string, x: number, y: number, year: number, seed: number): { c: Container; anim: Animated[]; glow?: [number, number, number] } {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  const anim: Animated[] = [];
  let glow: [number, number, number] | undefined;
  const m = 0.1; // marge dans la case
  switch (kind) {
    case 'bureau': {
      box(g, x + m, y + 0.15, 1 - 2 * m, 0.7, 20, WOOD_L, 0, { top: 0xc79c6c });
      // tiroirs
      poly(g, [iso(x + 0.6, y + 0.85, 4), iso(x + 0.88, y + 0.85, 4), iso(x + 0.88, y + 0.85, 16), iso(x + 0.6, y + 0.85, 16)], 0xa77b4e, 1, true, 0.6);
      // poste de travail selon l'époque
      if (year < 1985) {
        box(g, x + 0.3, y + 0.35, 0.4, 0.3, 8, 0x5b6b5a, 20, { top: 0x6e7e6c });
        poly(g, [iso(x + 0.36, y + 0.4, 28), iso(x + 0.64, y + 0.4, 28), iso(x + 0.64, y + 0.4, 34), iso(x + 0.36, y + 0.4, 34)], 0xf4efe2, 1, true, 0.5);
      } else if (year < 2005) {
        box(g, x + 0.32, y + 0.22, 0.36, 0.36, 18, 0xd9d2bd, 20, { top: 0xe4ddc8 });
        const scr = new Graphics();
        poly(scr, [iso(x + 0.36, y + 0.58, 24), iso(x + 0.64, y + 0.58, 24), iso(x + 0.64, y + 0.58, 35), iso(x + 0.36, y + 0.58, 35)], 0x2d4a3a, 1, true, 0.5);
        c.addChild(scr);
        anim.push({ g: scr, kind: 'crt', x, y, phase: seed });
        box(g, x + 0.3, y + 0.66, 0.4, 0.12, 2, 0xcfc7b0, 20);
        glow = [x + 0.5, y + 0.6, 0x3c8a5a];
      } else {
        box(g, x + 0.45, y + 0.4, 0.1, 0.1, 6, 0x333333, 20);
        const scr = new Graphics();
        poly(scr, [iso(x + 0.26, y + 0.48, 26), iso(x + 0.74, y + 0.48, 26), iso(x + 0.74, y + 0.48, 40), iso(x + 0.26, y + 0.48, 40)], 0x1e2a38, 1, true, 0.6);
        c.addChild(scr);
        anim.push({ g: scr, kind: 'lcd', x, y, phase: seed });
        box(g, x + 0.28, y + 0.62, 0.44, 0.12, 1.5, 0x2a2a2a, 20);
        glow = [x + 0.5, y + 0.55, 0x5a8ac8];
      }
      // dossiers et téléphone
      box(g, x + 0.72, y + 0.25, 0.14, 0.2, 5, 0xe0c27a, 20);
      box(g, x + 0.14, y + 0.22, 0.12, 0.14, 3, year < 1995 ? 0x7a2e2e : 0x2a2a2a, 20);
      // chaise (côté nord)
      box(g, x + 0.35, y - 0.25, 0.3, 0.3, 11, 0x2f3a48, 0);
      break;
    }
    case 'table': box(g, x + 0.05, y + 0.05, 0.9, 0.9, 18, WOOD, 0, { top: 0xb5834f }); box(g, x + 0.3, y + 0.3, 0.12, 0.16, 2, 0xf4efe2, 18); break;
    case 'table_interro': {
      box(g, x + 0.1, y + 0.2, 0.8, 0.6, 18, 0x8f969c, 0, { top: 0xa7adb2 });
      box(g, x + 0.35, y - 0.3, 0.3, 0.3, 11, 0x4a4f57);
      box(g, x + 0.35, y + 1.0, 0.3, 0.3, 11, 0x4a4f57);
      box(g, x + 0.62, y + 0.3, 0.16, 0.12, 3, 0x222222, 18); // magnétophone
      const led = new Graphics();
      c.addChild(led);
      anim.push({ g: led, kind: 'rec', x: x + 0.7, y: y + 0.36, phase: seed });
      break;
    }
    case 'armoire': box(g, x + 0.15, y + 0.2, 0.7, 0.6, 46, 0x9aa1a6, 0, { top: 0xaeb4b8 }); for (let i = 0; i < 3; i++) poly(g, [iso(x + 0.85, y + 0.25, 8 + i * 13), iso(x + 0.85, y + 0.75, 8 + i * 13), iso(x + 0.85, y + 0.75, 17 + i * 13), iso(x + 0.85, y + 0.25, 17 + i * 13)], 0x868d93, 1, true, 0.5); break;
    case 'etagere': {
      box(g, x + 0.1, y + 0.3, 0.8, 0.4, 52, 0x7d6a55, 0, { top: 0x8e7a64 });
      const cols = [0xc9a25a, 0x5c6f8a, 0x8a3b2e, 0xd9cfb8, 0x4a6a4a];
      for (let s = 0; s < 4; s++) for (let b = 0; b < 4; b++) {
        const xx = x + 0.15 + b * 0.18;
        poly(g, [iso(xx, y + 0.7, 4 + s * 12), iso(xx + 0.15, y + 0.7, 4 + s * 12), iso(xx + 0.15, y + 0.7, 13 + s * 12), iso(xx, y + 0.7, 13 + s * 12)], cols[(seed + s * 4 + b) % cols.length], 1, true, 0.4);
      }
      break;
    }
    case 'paillasse': {
      box(g, x + 0.05, y + 0.15, 0.9, 0.7, 22, WHITE, 0, { top: 0xdfe6e9 });
      if (seed % 3 === 0) { box(g, x + 0.35, y + 0.35, 0.2, 0.2, 14, 0x3a3f45, 22); box(g, x + 0.4, y + 0.35, 0.08, 0.1, 10, 0x8a9096, 36); }
      else if (seed % 3 === 1) { for (let i = 0; i < 3; i++) box(g, x + 0.2 + i * 0.2, y + 0.4, 0.08, 0.08, 9, [0x7ac0d8, 0xd87a7a, 0xa8d87a][i], 22, { alpha: 0.85 }); }
      else { box(g, x + 0.25, y + 0.3, 0.5, 0.35, 12, 0xcfd6da, 22); const led = new Graphics(); c.addChild(led); anim.push({ g: led, kind: 'led', x: x + 0.7, y: y + 0.6, phase: seed }); }
      glow = [x + 0.5, y + 0.5, 0x4a6a7a];
      break;
    }
    case 'canape': box(g, x + 0.05, y + 0.2, 0.9, 0.6, 12, 0x7a4a3a, 0); box(g, x + 0.05, y + 0.2, 0.9, 0.18, 24, 0x6a3a2c, 0); break;
    case 'cafe': {
      box(g, x + 0.2, y + 0.25, 0.6, 0.5, 40, 0x3a3a3a, 0, { top: 0x4a4a4a });
      poly(g, [iso(x + 0.8, y + 0.35, 20), iso(x + 0.8, y + 0.65, 20), iso(x + 0.8, y + 0.65, 34), iso(x + 0.8, y + 0.35, 34)], 0x8a3b2e, 1, true, 0.5);
      const st = new Graphics(); c.addChild(st); anim.push({ g: st, kind: 'steam', x: x + 0.5, y: y + 0.5, phase: seed });
      break;
    }
    case 'frigo': box(g, x + 0.2, y + 0.2, 0.6, 0.6, 44, 0xe8ecec, 0); break;
    case 'photocopieur': box(g, x + 0.15, y + 0.2, 0.7, 0.6, 24, 0xd8d4c8, 0, { top: 0xbfbab0 }); break;
    case 'comptoir': box(g, x, y + 0.2, 1, 0.6, 26, 0x6b4c3b, 0, { top: 0xc7b08a }); box(g, x + 0.3, y + 0.3, 0.3, 0.25, 4, 0x2a2a2a, 26); break;
    case 'banc': box(g, x + 0.1, y + 0.3, 0.8, 0.4, 10, 0x5a4a3a); break;
    case 'casier': for (let i = 0; i < 2; i++) box(g, x + 0.05 + i * 0.45, y + 0.25, 0.42, 0.5, 48, [0x7d8a96, 0x8b98a3][i], 0); break;
    case 'coffre': {
      box(g, x + 0.08, y + 0.2, 0.84, 0.6, 50, STEEL, 0, { top: 0x7f878f });
      for (let i = 0; i < 4; i++) poly(g, [iso(x + 0.92, y + 0.25, 4 + i * 11.5), iso(x + 0.92, y + 0.75, 4 + i * 11.5), iso(x + 0.92, y + 0.75, 14 + i * 11.5), iso(x + 0.92, y + 0.25, 14 + i * 11.5)], 0x646c74, 1, true, 0.5);
      for (let i = 0; i < 4; i++) { const [lx, ly] = iso(x + 0.92, y + 0.5, 9 + i * 11.5); g.rect(lx - 3, ly - 1.5, 6, 3).fill(0xf0e6c8); }
      break;
    }
    case 'tableau': {
      box(g, x + 0.45, y + 0.4, 0.08, 0.08, 24, METAL);
      poly(g, [iso(x + 0.05, y + 0.5, 24), iso(x + 0.95, y + 0.5, 24), iso(x + 0.95, y + 0.5, 56), iso(x + 0.05, y + 0.5, 56)], 0xf4f1e8, 1, true, 1);
      const pins = [0xd84a3a, 0x3a7ad8, 0xe0b040];
      for (let i = 0; i < 5; i++) { const [px, py] = iso(x + 0.15 + ((seed + i * 37) % 70) / 100, y + 0.5, 30 + ((seed * 7 + i * 13) % 22)); g.rect(px - 3, py - 3, 6, 5).fill(0xe8dcb8).stroke({ width: 0.4, color: INK }); g.circle(px, py - 3, 1.2).fill(pins[i % 3]); }
      const [a1, b1] = iso(x + 0.2, y + 0.5, 40), [a2, b2] = iso(x + 0.75, y + 0.5, 48);
      g.moveTo(a1, b1).lineTo(a2, b2).stroke({ width: 0.8, color: 0xc83a2a });
      break;
    }
    case 'plante': {
      box(g, x + 0.35, y + 0.35, 0.3, 0.3, 10, 0xa0603a, 0);
      const [px, py] = iso(x + 0.5, y + 0.5, 22);
      g.circle(px, py, 9).fill(0x4a7a3a).stroke({ width: 1, color: INK, alpha: 0.6 });
      g.circle(px - 5, py + 3, 6).fill(0x5a8a4a);
      g.circle(px + 5, py - 2, 6).fill(0x3e6a30);
      break;
    }
    case 'serveur': {
      box(g, x + 0.2, y + 0.2, 0.6, 0.6, 50, 0x2a2e33, 0, { top: 0x3a3f45 });
      const led = new Graphics(); c.addChild(led); anim.push({ g: led, kind: 'rack', x, y, phase: seed });
      glow = [x + 0.5, y + 0.7, 0x2a6a4a];
      break;
    }
    case 'radio': {
      box(g, x + 0.1, y + 0.2, 0.8, 0.6, 20, 0x4a4f57, 0, { top: 0x5a6068 });
      box(g, x + 0.2, y + 0.25, 0.5, 0.2, 14, 0x3a3f45, 20);
      const led = new Graphics(); c.addChild(led); anim.push({ g: led, kind: 'led', x: x + 0.6, y: y + 0.4, phase: seed });
      break;
    }
    case 'ecran': {
      box(g, x + 0.1, y + 0.3, 0.8, 0.3, 18, 0x3a3f45);
      const scr = new Graphics(); c.addChild(scr); anim.push({ g: scr, kind: 'wall', x, y, phase: seed });
      glow = [x + 0.5, y + 0.8, 0x4a7ab8];
      break;
    }
    case 'place': {
      const [a, b] = iso(x, y + 1), [cc, d] = iso(x + 1, y + 1);
      g.moveTo(a, b).lineTo(cc, d).stroke({ width: 1.5, color: 0xe8e0a0, alpha: 0.7 });
      break;
    }
    default: box(g, x + 0.2, y + 0.2, 0.6, 0.6, 16, shadeN(0x998877, 1));
  }
  return { c, anim, glow };
}

/** Animation des équipements (écrans, voyants, vapeur) — appelé à chaque image. */
export function animate(a: Animated, t: number, on: boolean) {
  const g = a.g;
  g.clear();
  const p = (t / 1000 + a.phase * 0.37);
  switch (a.kind) {
    case 'crt': case 'lcd': {
      const base = a.kind === 'crt' ? (on ? 0x3c8a5a : 0x1f2a22) : (on ? 0x5a8ac8 : 0x1e2a38);
      const x = a.x, y = a.y;
      const z0 = a.kind === 'crt' ? 24 : 26, z1 = a.kind === 'crt' ? 35 : 40;
      const x0 = a.kind === 'crt' ? 0.36 : 0.26, x1 = a.kind === 'crt' ? 0.64 : 0.74, yy = a.kind === 'crt' ? 0.58 : 0.48;
      poly(g, [iso(x + x0, y + yy, z0), iso(x + x1, y + yy, z0), iso(x + x1, y + yy, z1), iso(x + x0, y + yy, z1)], base, 1, true, 0.5);
      if (on) for (let i = 0; i < 3; i++) {
        const w = 0.08 + ((Math.floor(p * 2) + i * 3 + a.phase) % 5) * 0.03;
        const [lx, ly] = iso(x + x0 + 0.04, y + yy, z1 - 3 - i * 3);
        const [rx, ry] = iso(x + x0 + 0.04 + w, y + yy, z1 - 3 - i * 3);
        g.moveTo(lx, ly).lineTo(rx, ry).stroke({ width: 1, color: 0xd8f0e0, alpha: 0.8 });
      }
      break;
    }
    case 'rack': for (let i = 0; i < 6; i++) { const blink = Math.sin(p * (3 + i) + i) > 0.2; const [lx, ly] = iso(a.x + 0.8, a.y + 0.3 + (i % 2) * 0.3, 8 + Math.floor(i / 2) * 14); g.circle(lx, ly, 1.4).fill(blink ? (i % 3 ? 0x5aff8a : 0xffb030) : 0x1a3a22); } break;
    case 'led': case 'rec': { const [lx, ly] = iso(a.x, a.y, a.kind === 'rec' ? 22 : 30); const on2 = a.kind === 'rec' ? on && Math.sin(p * 4) > 0 : Math.sin(p * 2.5) > 0; g.circle(lx, ly, 1.8).fill(on2 ? 0xff4a3a : 0x4a1a1a); break; }
    case 'wall': for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const [sx, sy] = iso(a.x + 0.15 + i * 0.25, a.y + 0.3, 22 + j * 14); const col = [0x4a7ab8, 0x3a8a5a, 0xb88a3a, 0x7a4ab8][(Math.floor(p) + i + j * 2) % 4]; g.rect(sx - 7, sy - 12, 15, 11).fill(on ? col : 0x1a1f25).stroke({ width: 0.6, color: INK }); } break;
    case 'steam': if (on) for (let i = 0; i < 3; i++) { const k = (p * 0.8 + i / 3) % 1; const [sx, sy] = iso(a.x, a.y, 44 + k * 16); g.circle(sx + Math.sin(p * 3 + i) * 2, sy, 2 + k * 3).fill({ color: 0xffffff, alpha: 0.35 * (1 - k) }); } break;
  }
}
