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
      // dossiers, téléphone et équipements selon l'époque
      box(g, x + 0.72, y + 0.25, 0.14, 0.2, 5, 0xe0c27a, 20);
      if (year < 1990) {
        // téléphone à cadran
        box(g, x + 0.12, y + 0.2, 0.16, 0.16, 4, [0x7a2e2e, 0xd8c8a0, 0x2a2a2a][seed % 3], 20);
        const [hx, hy] = iso(x + 0.2, y + 0.28, 25); g.ellipse(hx, hy, 4, 1.6).fill(0x1d1a17);
      } else if (year < 2008) {
        box(g, x + 0.13, y + 0.22, 0.12, 0.14, 3, 0x3a3a3a, 20);
        box(g, x + 0.15, y + 0.24, 0.04, 0.1, 5, 0x2a2a2a, 23);
      } else {
        // téléphone mobile sur socle
        box(g, x + 0.16, y + 0.26, 0.06, 0.1, 1.5, 0x111111, 20);
      }
      if (year >= 1983 && year < 1996 && seed % 4 === 0) {
        // terminal télématique
        box(g, x + 0.62, y + 0.62, 0.22, 0.16, 9, 0x6b5a48, 20);
        poly(g, [iso(x + 0.64, y + 0.78, 21), iso(x + 0.82, y + 0.78, 21), iso(x + 0.82, y + 0.78, 28), iso(x + 0.64, y + 0.78, 28)], 0x2a3a2a, 1, true, 0.4);
      }
      if (year >= 2015 && seed % 2 === 0) {
        // second écran
        box(g, x + 0.72, y + 0.48, 0.06, 0.06, 6, 0x333333, 20);
        poly(g, [iso(x + 0.62, y + 0.52, 26), iso(x + 0.9, y + 0.52, 26), iso(x + 0.9, y + 0.52, 37), iso(x + 0.62, y + 0.52, 37)], 0x24344a, 1, true, 0.5);
      }
      if (year >= 2020 && seed % 3 === 1) {
        // ordinateur portable
        poly(g, [iso(x + 0.15, y + 0.6, 20.5), iso(x + 0.4, y + 0.6, 20.5), iso(x + 0.4, y + 0.78, 20.5), iso(x + 0.15, y + 0.78, 20.5)], 0x9aa0a6, 1, true, 0.4);
        poly(g, [iso(x + 0.15, y + 0.6, 20.5), iso(x + 0.4, y + 0.6, 20.5), iso(x + 0.4, y + 0.6, 29), iso(x + 0.15, y + 0.6, 29)], 0x2a3f5a, 1, true, 0.4);
      }
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
    case 'cellule': {
      // banc de cellule, sol carrelé et grille sur la face avant
      box(g, x + 0.08, y + 0.1, 0.84, 0.3, 10, 0xb0aca2, 0, { top: 0xc2bdb2 });
      box(g, x + 0.65, y + 0.55, 0.22, 0.25, 9, 0xe8ecec, 0); // sanitaire
      const bars = new Graphics();
      for (let k = 0; k <= 8; k++) { const [a, b] = iso(x + k / 8, y + 0.98, 0), [c, d] = iso(x + k / 8, y + 0.98, 56); bars.moveTo(a, b).lineTo(c, d); }
      const [h1, h2] = iso(x, y + 0.98, 56), [h3, h4] = iso(x + 1, y + 0.98, 56); bars.moveTo(h1, h2).lineTo(h3, h4);
      const [m1, m2] = iso(x, y + 0.98, 28), [m3, m4] = iso(x + 1, y + 0.98, 28); bars.moveTo(m1, m2).lineTo(m3, m4);
      bars.stroke({ width: 1.6, color: 0x4a4f55 });
      c.addChild(bars);
      break;
    }
    case 'lit_medical': box(g, x + 0.1, y + 0.15, 0.8, 0.55, 16, 0xdfe6e9, 0, { top: 0xf2f5f6 }); box(g, x + 0.1, y + 0.15, 0.25, 0.55, 20, 0xc8d8e0); break;
    case 'pharmacie': box(g, x + 0.2, y + 0.25, 0.6, 0.4, 40, 0xf2f2f0); { const [a, b] = iso(x + 0.8, y + 0.45, 28); g.rect(a - 4, b - 1.5, 8, 3).fill(0x2f8a55); g.rect(a - 1.5, b - 4, 3, 8).fill(0x2f8a55); } break;
    case 'rack_armes': box(g, x + 0.12, y + 0.25, 0.76, 0.5, 48, 0x3e4449, 0, { top: 0x4e555b }); for (let k = 0; k < 4; k++) { const [a, b] = iso(x + 0.88, y + 0.3 + k * 0.12, 10), [c2, d] = iso(x + 0.88, y + 0.3 + k * 0.12, 42); g.moveTo(a, b).lineTo(c2, d).stroke({ width: 0.8, color: 0x8a9096 }); } break;
    case 'tapis_course': box(g, x + 0.05, y + 0.25, 0.9, 0.5, 6, 0x2a2a2a); box(g, x + 0.78, y + 0.3, 0.12, 0.4, 34, 0x4a4f55); box(g, x + 0.74, y + 0.3, 0.2, 0.4, 4, 0x2a3f5a, 34); break;
    case 'banc_muscu': box(g, x + 0.2, y + 0.35, 0.6, 0.3, 12, 0x2a2a2a); box(g, x + 0.1, y + 0.2, 0.08, 0.6, 30, 0x8a9096); box(g, x + 0.82, y + 0.2, 0.08, 0.6, 30, 0x8a9096); { const [a, b] = iso(x + 0.14, y + 0.5, 32), [c2, d] = iso(x + 0.86, y + 0.5, 32); g.moveTo(a, b).lineTo(c2, d).stroke({ width: 2.5, color: 0x5a5f65 }); } break;
    case 'sac_frappe': { const [a, b] = iso(x + 0.5, y + 0.5, 54); g.moveTo(a, b).lineTo(a, b + 10).stroke({ width: 1, color: 0x333333 }); g.roundRect(a - 7, b + 10, 14, 30, 6).fill(0x8a2e2e).stroke({ width: 1, color: INK }); } break;
    case 'toise': { poly(g, [iso(x + 0.05, y + 0.3, 0), iso(x + 0.95, y + 0.3, 0), iso(x + 0.95, y + 0.3, 62), iso(x + 0.05, y + 0.3, 62)], 0xe8eef0, 1, true, 0.8); for (let k = 0; k < 6; k++) { const [a, b] = iso(x + 0.1, y + 0.3, 10 + k * 9), [c2, d] = iso(x + 0.9, y + 0.3, 10 + k * 9); g.moveTo(a, b).lineTo(c2, d).stroke({ width: 0.6, color: 0x6a7a8a }); } } break;
    case 'appareil_photo': { const [a, b] = iso(x + 0.5, y + 0.5, 0); for (const dx2 of [-6, 0, 6]) g.moveTo(a, b - 34).lineTo(a + dx2, b + (dx2 ? 2 : 4)).stroke({ width: 1.2, color: 0x2a2a2a }); g.roundRect(a - 7, b - 42, 14, 9, 2).fill(0x1d1d1d); g.circle(a, b - 37.5, 3).fill(0x4a6a8a); const fl = new Graphics(); c.addChild(fl); anim.push({ g: fl, kind: 'flash', x: x + 0.5, y: y + 0.5, phase: seed }); } break;
    case 'table_empreintes': box(g, x + 0.1, y + 0.2, 0.8, 0.6, 22, 0xd8dde0, 0, { top: 0xeaeef0 }); box(g, x + 0.25, y + 0.35, 0.3, 0.2, 1.5, 0x1d1d1d, 22); box(g, x + 0.6, y + 0.35, 0.2, 0.25, 1, 0xffffff, 22); break;
    case 'pupitre': box(g, x + 0.3, y + 0.3, 0.4, 0.35, 30, 0x5a3a2a, 0, { top: 0x6b4c3b }); { const [a, b] = iso(x + 0.5, y + 0.55, 30); g.circle(a, b, 3).fill(0x1f3a6e); } break;
    case 'chaises': for (let k = 0; k < 3; k++) { box(g, x + 0.08 + k * 0.3, y + 0.35, 0.24, 0.3, 10, 0x2f3a48); box(g, x + 0.08 + k * 0.3, y + 0.35, 0.24, 0.05, 20, 0x2f3a48); } break;
    case 'console_ecoute': {
      box(g, x + 0.08, y + 0.2, 0.84, 0.6, 20, 0x4a4f57, 0, { top: 0x5a6068 });
      poly(g, [iso(x + 0.2, y + 0.4, 22), iso(x + 0.8, y + 0.4, 22), iso(x + 0.8, y + 0.4, 34), iso(x + 0.2, y + 0.4, 34)], year < 2005 ? 0x2d4a3a : 0x1e2a38, 1, true, 0.5);
      const [a, b] = iso(x + 0.3, y + 0.7, 22); g.arc(a, b - 3, 4, Math.PI, 0).stroke({ width: 1.5, color: 0x1d1d1d });
      const led = new Graphics(); c.addChild(led); anim.push({ g: led, kind: 'led', x: x + 0.75, y: y + 0.6, phase: seed });
      glow = [x + 0.5, y + 0.6, 0x3a6a8a];
      break;
    }
    case 'cible': {
      box(g, x + 0.1, y + 0.75, 0.8, 0.15, 14, 0x6b5a48); // tablette de tir
      poly(g, [iso(x + 0.3, y + 0.1, 20), iso(x + 0.7, y + 0.1, 20), iso(x + 0.7, y + 0.1, 52), iso(x + 0.3, y + 0.1, 52)], 0xf2ecd8, 1, true, 0.6);
      const [a, b] = iso(x + 0.5, y + 0.1, 36); for (const r of [9, 6, 3]) g.ellipse(a, b, r, r * 1.1).stroke({ width: 1, color: 0x1d1a17 }); g.circle(a, b, 1.5).fill(0xc83a2a);
      break;
    }
    case 'self': box(g, x, y + 0.25, 1, 0.5, 24, 0xb8bec2, 0, { top: 0xd8dee2 }); for (let k = 0; k < 3; k++) box(g, x + 0.08 + k * 0.3, y + 0.32, 0.24, 0.32, 3, [0xd89a3a, 0x7aa84a, 0xc8662a][k], 24); box(g, x, y + 0.25, 1, 0.08, 40, 0xcfd6da, 24, { alpha: 0.6 }); break;
    case 'cuisine': box(g, x + 0.05, y + 0.15, 0.9, 0.7, 26, 0xc8cfd3, 0, { top: 0xdde3e6 }); for (const k of [0.3, 0.65]) { const [a, b] = iso(x + k, y + 0.5, 26); g.ellipse(a, b, 6, 3).stroke({ width: 1.2, color: 0x2a2a2a }); } { const st2 = new Graphics(); c.addChild(st2); anim.push({ g: st2, kind: 'steam', x: x + 0.4, y: y + 0.5, phase: seed }); } break;
    case 'table_longue': box(g, x, y + 0.2, 1, 0.6, 17, 0xc8a878, 0, { top: 0xd8b888 }); box(g, x + 0.1, y - 0.12, 0.8, 0.25, 9, 0x8a6a4a); box(g, x + 0.1, y + 0.88, 0.8, 0.25, 9, 0x8a6a4a); for (let k = 0; k < 2; k++) box(g, x + 0.2 + k * 0.4, y + 0.35, 0.18, 0.14, 2, 0xf0f0f0, 17); break;
    case 'fontaine': box(g, x + 0.35, y + 0.35, 0.3, 0.3, 30, 0xe8ecec); box(g, x + 0.38, y + 0.38, 0.24, 0.24, 14, 0x9ec4de, 30, { alpha: 0.8 }); break;
    case 'distributeur': box(g, x + 0.15, y + 0.3, 0.7, 0.45, 48, 0xb83a2a, 0, { top: 0xc84a3a }); poly(g, [iso(x + 0.85, y + 0.35, 20), iso(x + 0.85, y + 0.7, 20), iso(x + 0.85, y + 0.7, 44), iso(x + 0.85, y + 0.35, 44)], 0x9ec4de, 0.85, true, 0.5); glow = [x + 0.7, y + 0.6, 0x8a4a3a]; break;
    case 'horloge': { const [a, b] = iso(x + 0.5, y + 0.02, 52); g.circle(a, b, 6).fill(0xf6f2e6).stroke({ width: 1.2, color: INK }); const cl = new Graphics(); c.addChild(cl); anim.push({ g: cl, kind: 'clock', x: a, y: b, phase: seed }); break; }
    case 'affichage': poly(g, [iso(x + 0.1, y + 0.02, 26), iso(x + 0.9, y + 0.02, 26), iso(x + 0.9, y + 0.02, 50), iso(x + 0.1, y + 0.02, 50)], 0xb08a5a, 1, true, 0.8); for (let k = 0; k < 4; k++) { const [a, b] = iso(x + 0.18 + k * 0.18, y + 0.02, 32 + (k % 2) * 8); g.rect(a - 3, b - 4, 6, 7).fill([0xf6f2e6, 0xf0e08a, 0xd8e8f6, 0xf6d8d8][k]); } break;
    case 'extincteur': { const [a, b] = iso(x + 0.15, y + 0.15, 0); g.roundRect(a - 2.5, b - 14, 5, 14, 2).fill(0xc83a2a).stroke({ width: 0.6, color: INK }); g.rect(a - 1, b - 17, 2, 3).fill(0x2a2a2a); break; }
    case 'carte': poly(g, [iso(x + 0.05, y + 0.02, 24), iso(x + 0.95, y + 0.02, 24), iso(x + 0.95, y + 0.02, 54), iso(x + 0.05, y + 0.02, 54)], 0xe8e0c8, 1, true, 0.8); for (let k = 0; k < 5; k++) { const [a, b] = iso(x + 0.15 + k * 0.17, y + 0.02, 30 + ((seed + k * 7) % 18)); g.circle(a, b, 1.4).fill(0xc83a2a); } { const [a, b] = iso(x + 0.1, y + 0.02, 40), [c2, d] = iso(x + 0.9, y + 0.02, 34); g.moveTo(a, b).lineTo(c2, d).stroke({ width: 1, color: 0x3a7ad8 }); } break;
    case 'imprimante': box(g, x + 0.25, y + 0.3, 0.5, 0.4, 14, year < 2000 ? 0xd8d2c0 : 0x3a3f45); box(g, x + 0.3, y + 0.35, 0.3, 0.2, 2, 0xffffff, 14); break;
    case 'fax': box(g, x + 0.3, y + 0.3, 0.4, 0.35, 10, 0xd8d2c0); box(g, x + 0.35, y + 0.4, 0.15, 0.2, 4, 0xffffff, 10); break;
    case 'drapeau': { const [a, b] = iso(x + 0.2, y + 0.2, 0); g.moveTo(a, b).lineTo(a, b - 58).stroke({ width: 1.5, color: 0x8a7a5a }); g.rect(a, b - 58, 5, 12).fill(0x1f3a6e); g.rect(a + 5, b - 58, 5, 12).fill(0xffffff); g.rect(a + 10, b - 58, 5, 12).fill(0xc83a2a); break; }
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
    case 'flash': if (Math.sin(p * 0.9) > 0.985 && on) { const [fx, fy] = iso(a.x, a.y, 42); g.circle(fx, fy, 10).fill({ color: 0xffffff, alpha: 0.8 }); } break;
    case 'clock': { const ang = (t / 60000) % 1 * Math.PI * 2; g.moveTo(a.x, a.y).lineTo(a.x + Math.sin(ang) * 4.5, a.y - Math.cos(ang) * 4.5).stroke({ width: 0.8, color: INK }); const ang2 = (t / 720000) % 1 * Math.PI * 2; g.moveTo(a.x, a.y).lineTo(a.x + Math.sin(ang2) * 3, a.y - Math.cos(ang2) * 3).stroke({ width: 1.3, color: INK }); break; }
    case 'steam': if (on) for (let i = 0; i < 3; i++) { const k = (p * 0.8 + i / 3) % 1; const [sx, sy] = iso(a.x, a.y, 44 + k * 16); g.circle(sx + Math.sin(p * 3 + i) * 2, sy, 2 + k * 3).fill({ color: 0xffffff, alpha: 0.35 * (1 - k) }); } break;
  }
}
