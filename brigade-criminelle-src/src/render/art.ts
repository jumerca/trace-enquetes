// Dessin procédural des personnages, portraits et véhicules (Canvas 2D), dans un style
// bande dessinée franco-belge : contours sombres, aplats, ombres portées simples.
import type { Appearance } from '../sim/types';

export const SKINS = ['#f3d3b5', '#e8bb93', '#d29b6e', '#b07a4f', '#8a5a3a', '#5e3b26'];
export const HAIRS = ['#2a1d14', '#4a3222', '#7a5230', '#b08850', '#d9b878', '#8a3b1e', '#b9b4ab'];
export const OUTFITS = ['#3d4a5c', '#6b4c3b', '#2f5d50', '#7a2e3a', '#4a4f57', '#5c6f8a', '#8a7a5a', '#355070', '#6d597a', '#b56576'];
const INK = '#1d1a17';

export type Look = 'civil' | 'uniforme' | 'blouse' | 'costume' | 'robe' | 'medecin' | 'presse' | 'tenue';
export type Pose = 'idle' | 'walk' | 'run' | 'sit' | 'type' | 'phone' | 'read' | 'talk' | 'carry';

export interface CharSpec { a: Appearance; sexe: 'F' | 'M'; look: Look }

function shade(hex: string, f: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * f)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * f)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

function outfitColors(s: CharSpec) {
  const base = OUTFITS[s.a.outfit % OUTFITS.length];
  switch (s.look) {
    case 'uniforme': return { top: '#23324f', bottom: '#1e2a40', accent: '#c9d3e6' };
    case 'blouse': return { top: '#f1f3f4', bottom: '#4a4f57', accent: '#9fb3c8' };
    case 'medecin': return { top: '#eef3f2', bottom: '#5a7d8a', accent: '#3a8f7a' };
    case 'robe': return { top: '#1c1c22', bottom: '#1c1c22', accent: '#e8e2d0' };
    case 'costume': return { top: shade(base, 0.6), bottom: shade(base, 0.5), accent: '#ece6da' };
    case 'presse': return { top: '#7a6a4a', bottom: '#3d3a36', accent: '#d9c9a0' };
    default: return { top: base, bottom: s.a.build === 2 ? '#3a3a40' : '#4b5563', accent: '#e9e1d2' };
  }
}

/** Dessine un personnage en vue isométrique (face = vers le spectateur, ou dos).
 * Le canvas fait 48 × 72 unités ; les pieds sont en (24, 66). */
export function drawCharacter(ctx: CanvasRenderingContext2D, s: CharSpec, pose: Pose, frame: number, back: boolean) {
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
    } else ctx.rect(x - 3 + swing * 0.5, legY, 6, legLen);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = s.look === 'uniforme' ? '#111' : '#2b2420';
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
  const tw = 16 * w;
  ctx.fillStyle = c.top;
  ctx.beginPath();
  ctx.moveTo(24 - tw / 2, 30);
  ctx.quadraticCurveTo(24, 27, 24 + tw / 2, 30);
  ctx.lineTo(24 + tw / 2 + 1, 48);
  ctx.lineTo(24 - tw / 2 - 1, 48);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (!back) {
    // col, chemise, cravate ou insignes
    ctx.fillStyle = c.accent;
    ctx.beginPath();
    ctx.moveTo(21, 29);
    ctx.lineTo(24, 35);
    ctx.lineTo(27, 29);
    ctx.closePath();
    ctx.fill();
    if (s.look === 'costume' || (s.look === 'civil' && s.sexe === 'M' && s.a.outfit % 4 === 1)) {
      ctx.fillStyle = '#7a2e2e';
      ctx.fillRect(23.2, 31, 1.6, 9);
    }
    if (s.look === 'uniforme') {
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
    ctx.fillStyle = '#222';
    ctx.fillRect(30, 18, 3, 7);
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
  const hs = s.a.hairStyle;
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
      ctx.strokeRect(19.3, 17.2, 4.2, 3);
      ctx.strokeRect(24.6, 17.2, 4.2, 3);
      ctx.beginPath(); ctx.moveTo(23.5, 18.4); ctx.lineTo(24.6, 18.4); ctx.stroke();
      ctx.lineWidth = 1.3;
    }
    if (s.a.beard) {
      ctx.fillStyle = hair;
      ctx.beginPath();
      ctx.moveTo(17.5, 19);
      ctx.quadraticCurveTo(24, 31, 30.5, 19);
      ctx.quadraticCurveTo(24, 25, 17.5, 19);
      ctx.fill();
    }
  }
  if (s.look === 'uniforme') {
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
  const key = JSON.stringify([s, size, bg]);
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

/** Véhicule isométrique, orienté le long de l'axe x (vers le sud-est) ou de l'axe y (sud-ouest).
 * Canvas 96 × 64, roues au sol vers y = 50. */
export function drawVehicle(ctx: CanvasRenderingContext2D, v: VehSpec, alongX: boolean, frame = 0) {
  ctx.save();
  if (!alongX) { ctx.translate(96, 0); ctx.scale(-1, 1); }
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = INK;
  const L = v.kind === 'bus' ? 70 : v.kind === 'fourgon' || v.kind === 'camion' || v.kind === 'technique' ? 52 : 44; // longueur projetée
  const H = v.kind === 'bus' ? 26 : v.kind === 'fourgon' || v.kind === 'camion' || v.kind === 'technique' ? 22 : 13; // hauteur caisse
  const ox = 48 - L / 2, oy = 34;
  // projection : avant vers le bas à droite (dx, dy) = (L, L/2)
  const P = (u: number, w: number, h: number): [number, number] => [ox + u - w * 0.9, oy + u / 2 + w * 0.45 - h];
  const quad = (pts: [number, number][], fill: string) => {
    ctx.fillStyle = fill;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  const W = 18; // largeur
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(48 - 6, 50, L * 0.62, 11, 0.45, 0, Math.PI * 2);
  ctx.fill();
  // roues arrière (côté visible)
  const wheel = (u: number, w: number) => { const [x, y] = P(u, w, -1); ctx.fillStyle = '#141414'; ctx.beginPath(); ctx.ellipse(x, y, 4.2, 5, 0.45, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#8a8a8a'; ctx.beginPath(); ctx.ellipse(x, y, 1.8, 2.2, 0.45, 0, Math.PI * 2); ctx.fill(); };
  const body = v.body;
  const side = shade(body, 0.8), top = shade(body, 1.12), front = shade(body, 0.65);
  // caisse : côté gauche (w = W), dessus, avant
  quad([P(0, W, 0), P(L, W, 0), P(L, W, H), P(0, W, H)], side);
  quad([P(L, 0, 0), P(L, W, 0), P(L, W, H), P(L, 0, H)], front);
  const roofStart = v.kind === 'fourgon' || v.kind === 'camion' || v.kind === 'bus' || v.kind === 'technique' ? 2 : L * 0.25;
  const roofEnd = v.kind === 'bus' ? L - 2 : v.kind === 'fourgon' || v.kind === 'camion' || v.kind === 'technique' ? L * 0.82 : L * 0.72;
  const cabH = v.kind === 'bus' || v.kind === 'fourgon' || v.kind === 'camion' || v.kind === 'technique' ? 0 : 9;
  quad([P(0, 0, H), P(L, 0, H), P(L, W, H), P(0, W, H)], top);
  if (cabH) {
    // habitacle
    quad([P(roofStart, W - 1, H), P(roofEnd, W - 1, H), P(roofEnd - 3, W - 2, H + cabH), P(roofStart + 4, W - 2, H + cabH)], '#9fb8c8');
    quad([P(roofEnd, 1, H), P(roofEnd, W - 1, H), P(roofEnd - 3, W - 2, H + cabH), P(roofEnd - 3, 2, H + cabH)], '#bcd2df');
    quad([P(roofStart + 4, 2, H + cabH), P(roofEnd - 3, 2, H + cabH), P(roofEnd - 3, W - 2, H + cabH), P(roofStart + 4, W - 2, H + cabH)], top);
    // montant central
    const [mx1, my1] = P((roofStart + roofEnd) / 2, W - 1, H);
    const [mx2, my2] = P((roofStart + roofEnd) / 2 - 1, W - 2, H + cabH);
    ctx.beginPath(); ctx.moveTo(mx1, my1); ctx.lineTo(mx2, my2); ctx.stroke();
  } else {
    // vitres latérales du fourgon / bus
    const n = v.kind === 'bus' ? 6 : 2;
    for (let i = 0; i < n; i++) {
      const u0 = L * 0.12 + i * (L * 0.62 / n), u1 = u0 + L * 0.62 / n - 3;
      if (v.kind !== 'bus' && i === 0 && v.kind !== 'technique') continue;
      quad([P(u0, W, H * 0.55), P(u1, W, H * 0.55), P(u1, W, H * 0.9), P(u0, W, H * 0.9)], '#9fb8c8');
    }
    quad([P(L, 2, H * 0.5), P(L, W - 2, H * 0.5), P(L, W - 2, H * 0.92), P(L, 2, H * 0.92)], '#bcd2df');
  }
  // phares
  const [hx, hy] = P(L, W - 4, H * 0.3);
  ctx.fillStyle = v.lights ? '#fff6c8' : '#e8e2cf';
  ctx.beginPath(); ctx.ellipse(hx, hy, 2, 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  const [hx2, hy2] = P(L, 4, H * 0.3);
  ctx.beginPath(); ctx.ellipse(hx2, hy2, 2, 1.6, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // livrée police originale : bandeau bleu nuit et filet orangé
  if (v.police && v.kind !== 'banalisee') {
    quad([P(2, W, H * 0.22), P(L - 1, W, H * 0.22), P(L - 1, W, H * 0.42), P(2, W, H * 0.42)], '#1f3a6e');
    quad([P(2, W, H * 0.42), P(L - 1, W, H * 0.42), P(L - 1, W, H * 0.48), P(2, W, H * 0.48)], '#e58a2c');
    const [tx, ty] = P(L * 0.42, W, H * 0.25);
    ctx.save();
    ctx.translate(tx, ty);
    ctx.transform(1, 0.5, 0, 1, 0, 0);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 6px sans-serif';
    ctx.fillText('POLICE', -12, 0);
    ctx.restore();
  }
  if (v.police) {
    // gyrophare (amovible sur les banalisées)
    const [gx, gy] = P(L * 0.5, W / 2, H + (cabH || 0) + 1);
    const on = v.lights && frame % 2 === 0;
    ctx.fillStyle = on ? '#4aa8ff' : '#2a4f8a';
    ctx.beginPath(); ctx.rect(gx - 4, gy - 3, 8, 3); ctx.fill(); ctx.stroke();
    if (on) { ctx.fillStyle = 'rgba(80,170,255,0.35)'; ctx.beginPath(); ctx.arc(gx, gy - 2, 9, 0, Math.PI * 2); ctx.fill(); }
  }
  wheel(L * 0.2, W);
  wheel(L * 0.82, W);
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
