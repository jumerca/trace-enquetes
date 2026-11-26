// Dessin procédural des personnages, portraits et véhicules (Canvas 2D), dans un style
// bande dessinée franco-belge : contours sombres, aplats, ombres portées simples.
import type { Appearance } from '../sim/types';

export const SKINS = ['#f3d3b5', '#e8bb93', '#d29b6e', '#b07a4f', '#8a5a3a', '#5e3b26'];
export const HAIRS = ['#2a1d14', '#4a3222', '#7a5230', '#b08850', '#d9b878', '#8a3b1e', '#b9b4ab'];
export const OUTFITS = ['#3d4a5c', '#6b4c3b', '#2f5d50', '#7a2e3a', '#4a4f57', '#5c6f8a', '#8a7a5a', '#355070', '#6d597a', '#b56576'];
const INK = '#1d1a17';

export type Look = 'civil' | 'uniforme' | 'blouse' | 'costume' | 'robe' | 'medecin' | 'presse' | 'tenue';
export type Pose = 'idle' | 'walk' | 'run' | 'sit' | 'type' | 'phone' | 'read' | 'talk' | 'carry';

export interface CharSpec { a: Appearance; sexe: 'F' | 'M'; look: Look; era?: number }

// ————— Époque des personnages : coiffures, coupes, couleurs et accessoires suivent la décennie —————
let ART_YEAR = 1995;
export function setArtYear(y: number) { ART_YEAR = y; }
/** 0 : années 1970 … 5 : années 2020. */
export function eraBucket(y: number = ART_YEAR): number {
  return y < 1980 ? 0 : y < 1990 ? 1 : y < 2000 ? 2 : y < 2010 ? 3 : y < 2020 ? 4 : 5;
}
export function artEra(): number { return eraBucket(ART_YEAR); }
const ERA_PAL: string[][] = [
  ['#8a5a2b', '#c27c2c', '#6b7b3a', '#a0522d', '#b8860b', '#7a4a3a', '#5d6b4a', '#9c6b3c', '#c9a05a', '#6e4b6e'], // brun, moutarde, orange
  ['#c0392b', '#2e86c1', '#8e44ad', '#16a085', '#d4a017', '#e67e22', '#34495e', '#d35d8a', '#3cb3a0', '#5a6fd8'], // couleurs vives
  ['#3b5b8a', '#556b2f', '#7d5a50', '#2f4f4f', '#8b3a3a', '#4a6a8a', '#6b6b3a', '#5a4a6a', '#996644', '#2c5d7a'], // denim, vert sapin, bordeaux
  ['#3a3a3f', '#5a5f66', '#2b3a55', '#6a3a3a', '#4b5a4a', '#7a7f86', '#2e2e33', '#405a7a', '#6a5a4a', '#55606a'], // gris, noir
  ['#22355a', '#6b2737', '#c49a3a', '#3e5a48', '#8a8f96', '#2d2d33', '#5a7a8a', '#a0553a', '#46506a', '#7a6a5a'], // marine, bordeaux, moutarde
  ['#b9a88a', '#5a6340', '#2a2a2e', '#8a9aa6', '#c7b9a0', '#3c4a5a', '#7a5a4a', '#6a7a5a', '#d9d2c4', '#4a3a4a'], // beige, kaki, noir
];

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function outfitColors(s: CharSpec) {
  const e = eraBucket(s.era ?? ART_YEAR);
  const pal = ERA_PAL[e];
  const base = pal[s.a.outfit % pal.length] ?? OUTFITS[s.a.outfit % OUTFITS.length];
  const jeans = ['#4b4f57', '#5a4a3a', '#3d5a8a', '#2f4a72', '#2a2f3a', '#3a3f4a'][e];
  switch (s.look) {
    case 'uniforme': return e <= 1 ? { top: '#1f2b4a', bottom: '#1a2338', accent: '#d8dde8' } : e <= 3 ? { top: '#4a6a9a', bottom: '#1e2a40', accent: '#c9d3e6' } : { top: '#2a3550', bottom: '#1c2436', accent: '#c9d3e6' };
    case 'blouse': return { top: '#f1f3f4', bottom: '#4a4f57', accent: '#9fb3c8' };
    case 'medecin': return { top: '#eef3f2', bottom: '#5a7d8a', accent: '#3a8f7a' };
    case 'robe': return { top: '#1c1c22', bottom: '#1c1c22', accent: '#e8e2d0' };
    case 'costume': {
      const suit = [['#6b4a2e', '#5a3e28'], ['#5a5f6a', '#4a4f5a'], ['#3a3f4a', '#30343c'], ['#2a2e36', '#24272e'], ['#26334d', '#1f2a40'], ['#3a3f46', '#2f3339']][e];
      return { top: suit[0], bottom: suit[1], accent: e === 0 ? '#e8d8b0' : '#ece6da' };
    }
    case 'presse': return { top: e <= 1 ? '#7a6a4a' : e <= 3 ? '#4a5a4a' : '#2f3a46', bottom: '#3d3a36', accent: '#d9c9a0' };
    default: return { top: base, bottom: s.a.outfit % 2 ? jeans : s.a.build === 2 ? '#3a3a40' : shade(base, 0.55), accent: e === 0 ? '#e8d0a0' : '#e9e1d2' };
  }
}

/** Coupe de cheveux adaptée à la décennie (les civils suivent la mode, l'uniforme reste court). */
function eraHair(s: CharSpec, e: number): number {
  const hs = s.a.hairStyle;
  if (s.look === 'uniforme' || s.look === 'robe') return s.sexe === 'M' ? (hs % 2 ? 2 : 0) : hs;
  if (s.sexe === 'M') {
    if (e === 0) return [6, 3, 6, 0, 1, 6, 3, 6][hs % 8]; // cheveux longs, mi-longs
    if (e === 1) return [0, 1, 6, 0, 1, 7, 0, 1][hs % 8];
    if (e === 2) return [1, 7, 0, 1, 2, 0, 1, 7][hs % 8]; // raie au milieu
    if (e >= 4) return [2, 1, 0, 2, 4, 1, 2, 0][hs % 8]; // dégradés courts, chignon
    return [2, 0, 1, 2, 7, 0, 2, 1][hs % 8];
  }
  if (e === 0) return [5, 3, 5, 6, 3, 5, 6, 5][hs % 8]; // longs et raides
  if (e === 1) return [6, 6, 3, 1, 6, 6, 3, 6][hs % 8];
  if (e === 2) return [3, 1, 5, 7, 3, 4, 1, 5][hs % 8];
  if (e === 5) return [4, 5, 3, 4, 1, 5, 4, 3][hs % 8]; // chignons, longs
  return hs;
}

/** Dessine un personnage en vue isométrique (face = vers le spectateur, ou dos).
 * Le canvas fait 48 × 72 unités ; les pieds sont en (24, 66). */
export function drawCharacter(ctx: CanvasRenderingContext2D, s: CharSpec, pose: Pose, frame: number, back: boolean) {
  const e = eraBucket(s.era ?? ART_YEAR);
  const civil = s.look === 'civil';
  const c = outfitColors(s);
  const skin = SKINS[s.a.skin % SKINS.length];
  const hair = HAIRS[s.a.hair % HAIRS.length];
  const w = s.a.build === 0 ? 0.9 : s.a.build === 2 ? 1.15 : 1;
  const sitting = pose === 'sit' || pose === 'type';
  const walk = pose === 'walk' || pose === 'run' || pose === 'carry';
  const ph = walk ? Math.sin((frame / 4) * Math.PI * 2) : 0;
  const amp = pose === 'run' ? 1.6 : 1;
  const bob = walk ? Math.abs(ph) * -1.2 * amp : pose === 'talk' ? (frame % 2) * -0.6 : 0;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = INK;
  // ombre portée
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(24, 66, 10 * w, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.translate(0, bob + (sitting ? 7 : 0));
  // jambes
  const legY = 46;
  const legLen = sitting ? 9 : 19;
  const drawLeg = (x: number, swing: number) => {
    ctx.fillStyle = c.bottom;
    ctx.beginPath();
    if (sitting) {
      ctx.rect(x - 3, legY, 6, 6);
      ctx.rect(x - 3 + (back ? -2 : 2), legY + 4, 6, legLen);
    } else if (e === 0 && (civil || s.look === 'costume')) {
      // pantalon à pattes d'éléphant
      const sx = x + swing * 0.5;
      ctx.moveTo(sx - 3, legY); ctx.lineTo(sx + 3, legY); ctx.lineTo(sx + 4.6, legY + legLen); ctx.lineTo(sx - 4.6, legY + legLen); ctx.closePath();
    } else if (e >= 4 && civil) ctx.rect(x - 2.5 + swing * 0.5, legY, 5, legLen);
    else if (e === 2 && civil) ctx.rect(x - 3.5 + swing * 0.5, legY, 7, legLen);
    else ctx.rect(x - 3 + swing * 0.5, legY, 6, legLen);
    ctx.fill();
    ctx.stroke();
    // baskets blanches à partir des années 2000 pour les civils
    ctx.fillStyle = s.look === 'uniforme' ? '#111' : civil && e >= 3 && s.a.outfit % 3 !== 2 ? '#ecebe6' : civil && e === 1 && s.a.outfit % 4 === 0 ? '#e9e4d8' : '#2b2420';
    ctx.beginPath();
    ctx.ellipse(x + swing * 0.9 + (back ? -1 : 1), legY + legLen + (sitting ? 4 : 0) + 1, 4, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  };
  if (s.look === 'robe' || (s.sexe === 'F' && s.a.outfit % 3 === 0 && s.look === 'civil')) {
    // jupe ou robe longue
    drawLeg(20, ph * 3 * amp);
    drawLeg(28, -ph * 3 * amp);
    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.moveTo(16 - 2 * w, 44);
    ctx.lineTo(32 + 2 * w, 44);
    ctx.lineTo(34 + 2 * w, s.look === 'robe' ? 63 : 56);
    ctx.lineTo(14 - 2 * w, s.look === 'robe' ? 63 : 56);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    drawLeg(20, ph * 4 * amp);
    drawLeg(28, -ph * 4 * amp);
  }
  // torse
  const tw = 16 * w * (e === 1 && (civil || s.look === 'costume') ? 1.12 : e === 2 && civil ? 1.08 : 1);
  const pads = e === 1 && (civil || s.look === 'costume');
  ctx.fillStyle = c.top;
  ctx.beginPath();
  ctx.moveTo(24 - tw / 2, 30);
  if (pads) { ctx.lineTo(24 - tw / 2, 28.6); ctx.lineTo(24 + tw / 2, 28.6); ctx.lineTo(24 + tw / 2, 30); }
  else ctx.quadraticCurveTo(24, 27, 24 + tw / 2, 30);
  ctx.lineTo(24 + tw / 2 + 1, 48);
  ctx.lineTo(24 - tw / 2 - 1, 48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!back) {
    // col, chemise, cravate ou insignes
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    if (e === 0 && (civil || s.look === 'costume')) {
      // grand col pelle à tarte
      ctx.moveTo(18, 29); ctx.lineTo(24, 37); ctx.lineTo(30, 29); ctx.lineTo(28.5, 33); ctx.lineTo(24, 38.5); ctx.lineTo(19.5, 33);
    } else if (civil && e === 5 && s.a.outfit % 3 === 0) {
      // sweat à capuche
      ctx.fillStyle = shade(c.top.startsWith('#') ? c.top : '#555555', 0.8);
      ctx.ellipse(24, 29.5, 6, 2.4, 0, 0, Math.PI * 2);
    } else if (civil && e === 3 && s.a.outfit % 4 === 2) {
      // col roulé
      ctx.fillStyle = c.top;
      ctx.rect(20.5, 27, 7, 3.5);
    } else { ctx.moveTo(21, 29); ctx.lineTo(24, 35); ctx.lineTo(27, 29); }
    ctx.closePath();
    ctx.fill();
    if (civil && e === 5 && s.a.outfit % 3 === 0) { ctx.strokeStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(22.6, 30); ctx.lineTo(22.2, 35); ctx.moveTo(25.4, 30); ctx.lineTo(25.8, 35); ctx.stroke(); ctx.strokeStyle = INK; }
    if (civil && e === 5 && s.a.outfit % 3 === 1) {
      // doudoune matelassée
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(24 - tw / 2 + 1, 33 + k * 3.6); ctx.lineTo(24 + tw / 2 - 1, 33 + k * 3.6); ctx.stroke(); }
      ctx.strokeStyle = INK;
    }
    const tie = s.look === 'costume' ? e <= 3 || s.a.outfit % 2 === 0 : civil && s.sexe === 'M' && s.a.outfit % 4 === 1 && e <= 3;
    if (tie) {
      ctx.fillStyle = e === 0 ? '#a0522d' : e === 1 ? '#5a2e5a' : '#7a2e2e';
      if (e === 0) { ctx.beginPath(); ctx.moveTo(22.6, 31); ctx.lineTo(25.4, 31); ctx.lineTo(26.4, 41); ctx.lineTo(24, 42.5); ctx.lineTo(21.6, 41); ctx.closePath(); ctx.fill(); }
      else ctx.fillRect(23.2, 31, e === 1 ? 1.2 : 1.6, 9);
    }
    if (s.look === 'uniforme' && e >= 4) {
      // gilet tactique avec bandeau « POLICE »
      ctx.fillStyle = '#1b1e24';
      ctx.fillRect(24 - tw / 2 + 1, 32, tw - 2, 14);
      ctx.strokeRect(24 - tw / 2 + 1, 32, tw - 2, 14);
      ctx.fillStyle = '#e9edf3';
      ctx.fillRect(24 - tw / 2 + 2, 37, tw - 4, 2.6);
      ctx.fillStyle = '#1b1e24';
      ctx.font = 'bold 2.4px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('POLICE', 24, 39.2);
      if (e >= 5) { ctx.fillStyle = '#0d0d0f'; ctx.fillRect(26.5, 33, 3, 3); ctx.fillStyle = '#c0392b'; ctx.fillRect(27.6, 33.6, 0.8, 0.8); }
    }
    if (s.look === 'uniforme' && e < 4) {
      ctx.fillStyle = '#d8b24a';
      ctx.fillRect(18, 34, 3, 2);
      ctx.fillStyle = '#c9d3e6';
      ctx.fillRect(16, 31, 4, 1.5);
      ctx.fillRect(28, 31, 4, 1.5);
    }
    if (s.look === 'blouse' || s.look === 'medecin') {
      ctx.strokeStyle = '#b8c2c8';
      ctx.beginPath();
      ctx.moveTo(24, 35);
      ctx.lineTo(24, 48);
      ctx.stroke();
      ctx.strokeStyle = INK;
      if (s.look === 'medecin') {
        ctx.strokeStyle = '#3a3a3a';
        ctx.beginPath();
        ctx.arc(24, 33, 4, 0.2, Math.PI - 0.2);
        ctx.stroke();
        ctx.strokeStyle = INK;
      }
    }
    if (s.look === 'presse') {
      ctx.fillStyle = '#222';
      ctx.fillRect(25, 36, 7, 5);
      ctx.fillStyle = '#666';
      ctx.beginPath();
      ctx.arc(28.5, 38.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // bras
  const arm = (side: -1 | 1, angle: number, bend = 0) => {
    const sx = 24 + side * (tw / 2 + 0.5), sy = 32;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    ctx.fillStyle = c.top;
    ctx.beginPath();
    ctx.rect(-2.5, 0, 5, 9);
    ctx.fill();
    ctx.stroke();
    ctx.translate(0, 9);
    ctx.rotate(bend);
    ctx.beginPath();
    ctx.rect(-2.3, -1, 4.6, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(0, 8, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  if (walk && pose !== 'carry') {
    arm(-1, ph * 0.5 * amp + 0.08);
    arm(1, -ph * 0.5 * amp - 0.08);
  } else if (pose === 'carry') {
    arm(-1, -0.6, -0.9);
    arm(1, 0.6, 0.9);
    // pile de dossiers
    ctx.fillStyle = '#d9b46a';
    ctx.fillRect(16, 37, 16, 5);
    ctx.fillStyle = '#b98f45';
    ctx.fillRect(16, 41, 16, 3);
    ctx.strokeRect(16, 37, 16, 7);
  } else if (pose === 'type') {
    const t = frame % 2 ? 0.1 : -0.05;
    arm(-1, -0.9 + t, -0.6);
    arm(1, 0.9 - t, 0.6);
  } else if (pose === 'phone') {
    arm(-1, 0.1);
    arm(1, -2.6, -1.9);
    if (e >= 4) { ctx.fillStyle = '#16181c'; ctx.fillRect(29.6, 17, 3.6, 7); ctx.fillStyle = '#7ab8e8'; ctx.fillRect(30.1, 17.6, 2.6, 5.6); }
    else if (e === 3) { ctx.fillStyle = '#b9bec6'; ctx.fillRect(30, 18, 3, 6); }
    else { ctx.fillStyle = e <= 1 ? '#3a3a3a' : '#222'; ctx.fillRect(30, 18, 3, 7); }
  } else if (pose === 'read') {
    arm(-1, -0.7, -0.9);
    arm(1, 0.7, 0.9);
    ctx.fillStyle = '#f4efe2';
    ctx.beginPath();
    ctx.rect(17, 34 + (frame % 2), 14, 9);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#9a9080';
    for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(19, 37 + i * 2 + (frame % 2)); ctx.lineTo(29, 37 + i * 2 + (frame % 2)); ctx.stroke(); }
    ctx.strokeStyle = INK;
  } else if (pose === 'talk') {
    arm(-1, 0.15);
    arm(1, frame % 2 ? -0.9 : -0.5, -0.6);
  } else {
    arm(-1, 0.12);
    arm(1, -0.12);
  }
  // cou et tête
  ctx.fillStyle = skin;
  ctx.fillRect(22, 24, 4, 5);
  ctx.beginPath();
  ctx.ellipse(24, 18, 7, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // cheveux selon la coupe
  ctx.fillStyle = hair;
  const hs = eraHair(s, e);
  ctx.beginPath();
  if (back) {
    ctx.ellipse(24, 16.5, 7.4, 7.6, 0, 0, Math.PI * 2);
    if (hs >= 3 && hs <= 5) ctx.rect(17, 16, 14, hs === 5 ? 12 : 9);
  } else if (hs === 2) {
    ctx.ellipse(24, 12.5, 6.2, 3, 0, Math.PI, Math.PI * 2);
  } else if (hs === 0 || hs === 7) {
    ctx.ellipse(24, 13, 7.4, 4.6, 0, Math.PI, Math.PI * 2);
    ctx.rect(16.6, 12, 2, 5);
    ctx.rect(29.4, 12, 2, 5);
  } else if (hs === 1) {
    ctx.ellipse(24, 12.5, 7.6, 5, -0.15, Math.PI, Math.PI * 2);
    ctx.ellipse(21, 12, 4, 2.6, 0.3, 0, Math.PI * 2);
  } else if (hs === 3) {
    ctx.ellipse(24, 13, 7.8, 5, 0, Math.PI, Math.PI * 2);
    ctx.rect(16, 12, 3, 12);
    ctx.rect(29, 12, 3, 12);
  } else if (hs === 4) {
    ctx.ellipse(24, 13, 7.8, 5, 0, Math.PI, Math.PI * 2);
    ctx.ellipse(24, 8.5, 3.5, 3, 0, 0, Math.PI * 2);
  } else if (hs === 5) {
    ctx.ellipse(24, 13, 8, 5.5, 0, Math.PI, Math.PI * 2);
    ctx.rect(15.8, 12, 3.2, 16);
    ctx.rect(29, 12, 3.2, 16);
  } else {
    ctx.ellipse(24, 14, 8.4, 6.6, 0, Math.PI, Math.PI * 2);
    ctx.rect(15.6, 13, 3, 8);
    ctx.rect(29.4, 13, 3, 8);
  }
  ctx.fill();
  ctx.stroke();
  if (civil && e === 1 && s.sexe === 'M' && s.a.hairStyle % 3 === 0) {
    // nuque longue
    ctx.fillStyle = hair; ctx.beginPath(); ctx.rect(18, 18, 12, 9); ctx.fill(); ctx.stroke();
  }
  if (civil && e === 1 && s.sexe === 'F') {
    // permanente volumineuse
    ctx.fillStyle = hair;
    for (const [hx, hy] of [[16.5, 15], [31.5, 15], [17, 21], [31, 21], [24, 9.5]]) { ctx.beginPath(); ctx.arc(hx, hy, 3.4, 0, Math.PI * 2); ctx.fill(); }
  }
  if (!back) {
    // visage
    ctx.fillStyle = INK;
    const blink = pose === 'idle' && frame % 4 === 3;
    if (blink) { ctx.fillRect(20.2, 18.5, 2.4, 0.8); ctx.fillRect(25.4, 18.5, 2.4, 0.8); }
    else { ctx.beginPath(); ctx.arc(21.4, 18.6, 1, 0, Math.PI * 2); ctx.arc(26.6, 18.6, 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = shade(skin, 0.6);
    ctx.beginPath();
    ctx.moveTo(24, 19.5);
    ctx.lineTo(23.3, 21.8);
    ctx.stroke();
    ctx.strokeStyle = '#7a3b2e';
    ctx.beginPath();
    if (pose === 'talk' && frame % 2) ctx.ellipse(24, 23.4, 1.6, 1.1, 0, 0, Math.PI * 2);
    else ctx.arc(24, 22.4, 1.8, 0.25, Math.PI - 0.25);
    ctx.stroke();
    ctx.strokeStyle = INK;
    if (s.a.glasses) {
      ctx.lineWidth = 0.9;
      if (e <= 1) {
        // grandes montures
        ctx.strokeStyle = e === 0 ? '#6a4a2a' : INK;
        ctx.beginPath(); ctx.ellipse(21.3, 18.8, 2.9, 2.6, 0, 0, Math.PI * 2); ctx.ellipse(26.7, 18.8, 2.9, 2.6, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = INK;
      } else if (e === 2 || e === 5) { ctx.beginPath(); ctx.arc(21.4, 18.6, 2.1, 0, Math.PI * 2); ctx.arc(26.6, 18.6, 2.1, 0, Math.PI * 2); ctx.stroke(); }
      else if (e === 3) { ctx.strokeRect(19.6, 17.8, 3.8, 1.8); ctx.strokeRect(24.6, 17.8, 3.8, 1.8); }
      else { ctx.lineWidth = 1.4; ctx.strokeRect(19.3, 17.2, 4.2, 3); ctx.strokeRect(24.6, 17.2, 4.2, 3); ctx.lineWidth = 0.9; }
      ctx.beginPath(); ctx.moveTo(23.5, 18.4); ctx.lineTo(24.6, 18.4); ctx.stroke();
      ctx.lineWidth = 1.3;
    }
    const beard = s.sexe === 'M' && (s.a.beard || (e >= 4 && civil && s.a.outfit % 3 === 0));
    if (beard && e <= 1 && s.a.outfit % 2 === 0) {
      // moustache épaisse
      ctx.fillStyle = hair;
      ctx.beginPath(); ctx.ellipse(24, 21.3, 3.6, 1.3, 0, 0, Math.PI * 2); ctx.fill();
    } else if (beard) {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(17.5, 19);
      ctx.quadraticCurveTo(24, e >= 4 ? 32 : 31, 30.5, 19);
      ctx.quadraticCurveTo(24, 25, 17.5, 19);
      ctx.fill();
    } else if (s.sexe === 'M' && e === 0 && civil && s.a.hairStyle % 2 === 1) {
      // favoris
      ctx.fillStyle = hair; ctx.fillRect(16.8, 15, 1.8, 6); ctx.fillRect(29.4, 15, 1.8, 6);
    }
    if (civil && e === 5 && s.a.outfit % 4 === 1) { ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.arc(16.8, 19.5, 1, 0, Math.PI * 2); ctx.arc(31.2, 19.5, 1, 0, Math.PI * 2); ctx.fill(); }
  }
  if (civil && e === 1 && s.a.outfit % 5 === 0) {
    ctx.strokeStyle = '#9a9a9a'; ctx.beginPath(); ctx.arc(24, 17, 8.2, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.strokeStyle = INK;
    ctx.fillStyle = '#e8892a'; ctx.beginPath(); ctx.arc(16.4, 18.5, 2, 0, Math.PI * 2); ctx.arc(31.6, 18.5, 2, 0, Math.PI * 2); ctx.fill();
  }
  if (s.look === 'uniforme' && e <= 1) {
    // képi
    ctx.fillStyle = '#1a2540';
    ctx.beginPath();
    ctx.moveTo(17.6, 13); ctx.lineTo(18.4, 5.5); ctx.lineTo(29.6, 5.5); ctx.lineTo(30.4, 13); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(24, 13.2, 8, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    if (!back) { ctx.fillStyle = '#c9a43a'; ctx.fillRect(18.2, 10.2, 11.6, 1.1); ctx.fillRect(23, 6.8, 2, 2.4); }
  } else if (s.look === 'uniforme') {
    // casquette
    ctx.fillStyle = '#1a2540';
    ctx.beginPath();
    ctx.ellipse(24, 11.5, 7.6, 3.4, 0, Math.PI, Math.PI * 2);
    ctx.rect(16.4, 11, 15.2, 2.4);
    ctx.fill();
    ctx.stroke();
    if (!back) { ctx.fillStyle = '#d8b24a'; ctx.fillRect(22.6, 9, 2.8, 2.2); ctx.fillStyle = '#111'; ctx.fillRect(18, 12.6, 12, 1.6); }
  }
  ctx.restore();
}

/** Portrait (buste) pour les fiches, le tableau d'enquête et la création de carrière. */
export function drawPortrait(ctx: CanvasRenderingContext2D, s: CharSpec, size: number, bg = '#e9dfc9') {
  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  // trame BD
  ctx.fillStyle = 'rgba(0,0,0,0.05)';
  for (let y = 0; y < size; y += 6) for (let x = (y / 6) % 2 ? 3 : 0; x < size; x += 6) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI * 2); ctx.fill(); }
  ctx.beginPath();
  ctx.rect(0, 0, size, size);
  ctx.clip();
  const k = size / 34;
  ctx.translate(size / 2 - 24 * k, size * 0.4 - 18 * k);
  ctx.scale(k, k);
  drawCharacter(ctx, s, 'idle', 0, false);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, size - 2, size - 2);
}

const portraitCache = new Map<string, string>();
export function portraitURL(s: CharSpec, size = 96, bg?: string): string {
  if (s.era === undefined) s = { ...s, era: ART_YEAR };
  const key = JSON.stringify([s.a, s.sexe, s.look, eraBucket(s.era), size, bg]);
  const hit = portraitCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const cv = document.createElement('canvas');
  cv.width = cv.height = size * 2;
  const ctx = cv.getContext('2d')!;
  ctx.scale(2, 2);
  drawPortrait(ctx, s, size, bg);
  const url = cv.toDataURL('image/png');
  portraitCache.set(key, url);
  return url;
}

// ————— Véhicules —————
export interface VehSpec { body: string; kind: 'banalisee' | 'secours' | 'fourgon' | 'technique' | 'civil' | 'bus' | 'camion'; police: boolean; era: number; lights?: boolean }

export type Dir = 'px' | 'nx' | 'py' | 'ny';
export const DIR_VEC: Record<Dir, [number, number]> = { px: [1, 0], nx: [-1, 0], py: [0, 1], ny: [0, -1] };

/** Véhicule en volume isométrique (modèle à prismes, faces cachées éliminées), orienté dans
 * l'une des quatre directions de la grille. Canvas 128 × 96 ; le centre au sol est en (64, 60).
 * Unité : la case (64 px de large). */
export function drawVehicle(ctx: CanvasRenderingContext2D, v: VehSpec, dir: Dir, frame = 0) {
  const [dx, dy] = DIR_VEC[dir];
  const rx = -dy, ry = dx; // droite du véhicule (y vers le bas)
  const K = 32;
  const S = (gx: number, gy: number, z: number): [number, number] => [64 + (gx - gy) * K, 60 + (gx + gy) * K / 2 - z];
  // local (f avant, s droite) -> grille
  const G = (f: number, s: number): [number, number] => [f * dx + s * rx, f * dy + s * ry];
  const big = v.kind === 'bus' || v.kind === 'camion';
  const van = v.kind === 'fourgon' || v.kind === 'technique';
  // style de l'époque du modèle : 0 = années 1970 … 5 = années 2020 (électrique)
  const yr = v.era || 1995;
  const E = yr < 1985 ? 0 : yr < 1995 ? 1 : yr < 2005 ? 2 : yr < 2015 ? 3 : yr < 2022 ? 4 : 5;
  const L = v.kind === 'bus' ? 1.5 : v.kind === 'camion' ? 1.15 : van ? 0.92 : E === 0 ? 0.86 : E >= 3 ? 0.78 : 0.8;
  const W = big ? 0.42 : van ? 0.38 : 0.34;
  const marked = v.police && v.kind !== 'banalisee';
  const body = marked ? (E === 0 ? '#24365a' : '#f1f1ec') : v.body;
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(29,26,23,0.9)';
  ctx.lineWidth = 0.9;
  const poly = (pts: [number, number][], fill: string, stroke = true) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    if (stroke) ctx.stroke();
  };
  // ombre portée douce
  const sh: [number, number][] = [G(-L / 2 - 0.04, -W / 2 - 0.04), G(L / 2 + 0.04, -W / 2 - 0.04), G(L / 2 + 0.04, W / 2 + 0.06), G(-L / 2 - 0.04, W / 2 + 0.06)].map(([gx, gy]) => S(gx + 0.05, gy + 0.05, 0));
  poly(sh, 'rgba(0,0,0,0.28)', false);
  type Face = { pts: [number, number][]; fill: string; depth: number; kind: string; n?: [number, number] };
  /** Prisme local [f0,f1]×[s0,s1]×[z0,z1] : renvoie ses faces visibles. */
  const prism = (f0: number, f1: number, s0: number, s1: number, z0: number, z1: number, col: string, opts: { front?: string; back?: string; side?: string; top?: string; taper?: number } = {}): Face[] => {
    const out: Face[] = [];
    const t = opts.taper ?? 0; // rétrécissement du haut (pare-brise incliné)
    const corner = (f: number, s: number, z: number, up: boolean) => S(...G(up ? f + (f > (f0 + f1) / 2 ? -t : t) : f, s), z);
    const faces: { n: [number, number]; a: [number, number]; b: [number, number]; kind: string }[] = [
      { n: [dx, dy], a: [f1, s0], b: [f1, s1], kind: 'front' },
      { n: [-dx, -dy], a: [f0, s1], b: [f0, s0], kind: 'back' },
      { n: [rx, ry], a: [f1, s1], b: [f0, s1], kind: 'right' },
      { n: [-rx, -ry], a: [f0, s0], b: [f1, s0], kind: 'left' },
    ];
    for (const fc of faces) {
      if (fc.n[0] + fc.n[1] <= 0) continue; // face tournée vers l'arrière-plan
      const pts: [number, number][] = [corner(fc.a[0], fc.a[1], z0, false), corner(fc.b[0], fc.b[1], z0, false), corner(fc.b[0], fc.b[1], z1, true), corner(fc.a[0], fc.a[1], z1, true)];
      const lit = fc.n[0] > 0 ? 0.78 : 0.92; // face +x plus sombre que la face +y
      const base = fc.kind === 'front' ? opts.front ?? col : fc.kind === 'back' ? opts.back ?? col : opts.side ?? col;
      out.push({ pts, fill: shade(base, lit), depth: 0, kind: fc.kind, n: fc.n });
    }
    out.push({ pts: [corner(f0, s0, z1, true), corner(f1, s0, z1, true), corner(f1, s1, z1, true), corner(f0, s1, z1, true)], fill: shade(opts.top ?? col, 1.1), depth: 1, kind: 'top' });
    return out;
  };
  const glass = '#8fb2c8';
  const wheelsAt = big ? [-L / 2 + 0.22, L / 2 - 0.25] : [-L / 2 + 0.17, L / 2 - 0.17];
  const drawWheels = (visibleSide: boolean) => {
    for (const side of [-1, 1]) {
      const n: [number, number] = [rx * side, ry * side];
      if ((n[0] + n[1] > 0) !== visibleSide) continue;
      for (const f of wheelsAt) {
        const [cx, cy] = S(...G(f, side * (W / 2 - 0.01)), 4.5);
        ctx.fillStyle = '#141414';
        ctx.beginPath();
        // ellipse orientée selon l'axe du véhicule
        const ang = Math.atan2((dx + dy) * K / 2, (dx - dy) * K);
        ctx.ellipse(cx, cy, 5.2, 4.2, ang, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9a9a9a';
        ctx.beginPath();
        ctx.ellipse(cx, cy, 2.2, 1.8, ang, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  };
  drawWheels(false);
  const zb = 4, zt = big ? 26 : van ? 20 : E >= 3 && v.kind !== 'civil' ? 12.5 : 11;
  const faces: Face[] = [];
  // caisse
  faces.push(...prism(-L / 2, L / 2, -W / 2, W / 2, zb, zt, body, { front: shade(body, 0.95) }));
  for (const f of faces) ctx.save(), poly(f.pts, f.fill), ctx.restore();
  // détails sur les faces de caisse : feux, calandre, bandeau police
  const faceQuad = (f0: number, f1: number, s0: number, s1: number, z0: number, z1: number, col: string, kind: 'front' | 'back' | 'right' | 'left') => {
    const n: [number, number] = kind === 'front' ? [dx, dy] : kind === 'back' ? [-dx, -dy] : kind === 'right' ? [rx, ry] : [-rx, -ry];
    if (n[0] + n[1] <= 0) return;
    if (kind === 'front' || kind === 'back') {
      const f = kind === 'front' ? f1 : f0;
      poly([S(...G(f, s0), z0), S(...G(f, s1), z0), S(...G(f, s1), z1), S(...G(f, s0), z1)], col);
    } else {
      const s = kind === 'right' ? s1 : s0;
      poly([S(...G(f0, s), z0), S(...G(f1, s), z0), S(...G(f1, s), z1), S(...G(f0, s), z1)], col);
    }
  };
  const ws = W / 2;
  // phares et feux arrière
  const lamp = v.lights ? '#fff7c4' : '#efe8cf';
  if (E === 5) {
    // années 2020 : bandeau lumineux continu, pas de calandre (électrique)
    faceQuad(0, L / 2, -ws + 0.03, ws - 0.03, zb + 4.5, zb + 5.8, lamp, 'front');
    faceQuad(-L / 2, 0, -ws + 0.03, ws - 0.03, zb + 4.5, zb + 5.8, '#d0302a', 'back');
  } else {
    const hw = E === 0 ? 0.06 : E >= 3 ? 0.09 : 0.07;
    faceQuad(0, L / 2, -ws + 0.03, -ws + 0.03 + hw, zb + 3, zb + (E === 0 ? 6.5 : 6), lamp, 'front');
    faceQuad(0, L / 2, ws - 0.03 - hw, ws - 0.03, zb + 3, zb + (E === 0 ? 6.5 : 6), lamp, 'front');
    faceQuad(-L / 2, 0, -ws + 0.03, -ws + 0.1, zb + 3, zb + 6, '#c8322a', 'back');
    faceQuad(-L / 2, 0, ws - 0.1, ws - 0.03, zb + 3, zb + 6, '#c8322a', 'back');
    faceQuad(0, L / 2, -ws + 0.13, ws - 0.13, zb + 1.5, zb + 4.5, E <= 1 ? '#3a3a3a' : '#2a2a2a', 'front');
  }
  if (E <= 1) {
    // pare-chocs chromés (années 1970-1980)
    faceQuad(0, L / 2, -ws, ws, zb - 1, zb + 1.2, '#c9ccd0', 'front');
    faceQuad(-L / 2, 0, -ws, ws, zb - 1, zb + 1.2, '#c9ccd0', 'back');
    for (const k of ['right', 'left'] as const) faceQuad(-L / 2, L / 2, 0, 0, zb - 1, zb + 0.8, '#c9ccd0', k);
  }
  if (marked) {
    // livrées fictives successives de la police
    for (const k of ['right', 'left'] as const) {
      if (E === 0) faceQuad(-L / 2 + 0.03, L / 2 - 0.03, 0, 0, zb + 5, zb + 6.5, '#f1f1ec', k);
      else if (E === 1) faceQuad(-L / 2 + 0.03, L / 2 - 0.03, 0, 0, zb + 3, zb + 8, '#1f3a6e', k);
      else if (E === 2) { faceQuad(-L / 2 + 0.03, L / 2 - 0.03, 0, 0, zb + 4, zb + 8, '#1f3a6e', k); faceQuad(-L / 2 + 0.03, L / 2 - 0.03, 0, 0, zb + 8, zb + 9.3, '#e58a2c', k); }
      else if (E === 3) { faceQuad(-L / 2 + 0.03, L / 2 - 0.03, 0, 0, zb + 3.5, zb + 8, '#1c3f8a', k); faceQuad(-L / 2 + 0.03, L / 2 - 0.03, 0, 0, zb + 8, zb + 9, '#c8322a', k); }
      else {
        // damier haute visibilité
        const n = big || van ? 8 : 6;
        for (let i = 0; i < n; i++) {
          const f0 = -L / 2 + 0.03 + i * ((L - 0.06) / n), f1 = f0 + (L - 0.06) / n;
          faceQuad(f0, f1, 0, 0, zb + 3, zb + 5.5, i % 2 ? '#f1f1ec' : '#1c3f8a', k);
          faceQuad(f0, f1, 0, 0, zb + 5.5, zb + 8, i % 2 ? '#1c3f8a' : '#f1f1ec', k);
        }
      }
    }
  }
  if (van || big) {
    // vitrages de la cabine (fourgons, camions, bus)
    const cabF0 = big && v.kind === 'bus' ? -L / 2 + 0.06 : L / 2 - 0.3;
    for (const k of ['right', 'left'] as const) faceQuad(cabF0, L / 2 - 0.05, 0, 0, zt - 10, zt - 3, glass, k);
    faceQuad(0, L / 2, -ws + 0.04, ws - 0.04, zt - 10, zt - 2, glass, 'front');
    if (v.kind === 'bus') for (const k of ['right', 'left'] as const) for (let i = 0; i < 5; i++) faceQuad(-L / 2 + 0.1 + i * 0.25, -L / 2 + 0.3 + i * 0.25, 0, 0, zt - 11, zt - 4, glass, k);
    if (v.kind === 'camion') {
      // séparation cabine / caisse
      const [a1, b1] = S(...G(L / 2 - 0.34, -ws), zt), [a2, b2] = S(...G(L / 2 - 0.34, ws), zt);
      ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
    }
  } else {
    // habitacle de voiture : vitrages en biseau
    const c0 = -L / 2 + 0.2, c1 = L / 2 - 0.26;
    const cabH = E === 0 ? 9 : E >= 3 ? 8.5 : 8;
    const roof = marked && E === 0 ? '#f1f1ec' : body;
    const cab = prism(c0, c1, -ws + 0.03, ws - 0.03, zt, zt + cabH, glass, { top: roof, taper: E === 0 ? 0.015 : E === 1 ? 0.03 : E === 2 ? 0.06 : 0.085 });
    for (const f of cab) poly(f.pts, f.kind === 'top' ? shade(roof, 1.12) : f.fill);
    // montants
    const [m1x, m1y] = S(...G((c0 + c1) / 2, ws - 0.03), zt), [m2x, m2y] = S(...G((c0 + c1) / 2, ws - 0.03), zt + cabH);
    const [n1x, n1y] = S(...G((c0 + c1) / 2, -ws + 0.03), zt), [n2x, n2y] = S(...G((c0 + c1) / 2, -ws + 0.03), zt + cabH);
    ctx.beginPath(); ctx.moveTo(m1x, m1y); ctx.lineTo(m2x, m2y); ctx.moveTo(n1x, n1y); ctx.lineTo(n2x, n2y); ctx.stroke();
  }
  // gyrophare : dôme unique (années 1970-1980), rampe, puis rampe LED fine ; aimanté sur les banalisées
  if (v.police && (marked || v.lights)) {
    const top = van || big ? zt : zt + (E === 0 ? 9 : E >= 3 ? 8.5 : 8);
    const on = !!v.lights && frame % 2 === 0;
    if (E <= 1 || !marked) {
      const [dx2, dy2] = S(0, 0, top);
      ctx.fillStyle = on ? '#5ab4ff' : '#2a5aa0';
      ctx.beginPath(); ctx.ellipse(dx2, dy2 - 2, 4, 4.5, 0, Math.PI, 0); ctx.rect(dx2 - 4, dy2 - 2, 8, 2); ctx.fill(); ctx.stroke();
    } else {
      const bar = prism(-0.05, 0.06, -ws + 0.05, ws - 0.05, top, top + (E >= 4 ? 1.8 : 3), on ? '#4aa8ff' : '#26457a');
      for (const f of bar) poly(f.pts, f.fill);
    }
    if (on) {
      const [gx, gy] = S(0, 0, top + 3);
      const g = ctx.createRadialGradient(gx, gy, 1, gx, gy, 16);
      g.addColorStop(0, 'rgba(120,190,255,0.75)');
      g.addColorStop(1, 'rgba(120,190,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(gx, gy, 16, 0, Math.PI * 2); ctx.fill();
    }
  }
  drawWheels(true);
  if (v.lights && !v.police) {
    // faisceau des phares la nuit
    const [hx, hy] = S(...G(L / 2 + 0.25, 0), 2);
    const g = ctx.createRadialGradient(hx, hy, 1, hx, hy, 18);
    g.addColorStop(0, 'rgba(255,240,180,0.45)');
    g.addColorStop(1, 'rgba(255,240,180,0)');
    if (dx + dy > 0) { ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 18, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.restore();
}

export function canvasOf(w: number, h: number, scale: number, fn: (ctx: CanvasRenderingContext2D) => void): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = Math.ceil(w * scale);
  cv.height = Math.ceil(h * scale);
  const ctx = cv.getContext('2d')!;
  ctx.scale(scale, scale);
  fn(ctx);
  return cv;
}

const vehCache = new Map<string, string>();
/** Image d'un véhicule pour l'interface (fiche Équipements). */
export function vehicleURL(v: VehSpec, dir: Dir = 'px'): string {
  const key = JSON.stringify([v, dir]);
  const hit = vehCache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  // agrandi et centré sur le véhicule pour les fiches
  const url = canvasOf(128, 96, 2, (ctx) => { ctx.translate(64, 52); ctx.scale(1.75, 1.75); ctx.translate(-64, -52); drawVehicle(ctx, v, dir); }).toDataURL('image/png');
  vehCache.set(key, url);
  return url;
}
