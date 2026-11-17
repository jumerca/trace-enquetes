// Personnages dessinés procéduralement, image par image : de vraies séquences de sprites (marche 8 images,
// course 6, parole, observation, atlas, attaque, choc, attente), en trois orientations (face, dos, profil).
import { INK, Ctx, canvas, ink, ellipse, capsule, shade, rrect, softShadow } from './draw';

export type HairStyle = 'tousle' | 'bun' | 'braid' | 'short' | 'pigtails' | 'long' | 'bald' | 'curly';
export type Hat = 'none' | 'cap' | 'flatcap' | 'kettle' | 'kerchief' | 'hood';
export type TopStyle = 'coat' | 'shirt' | 'dress' | 'robe' | 'uniform' | 'tunic';

export interface CharSpec {
  id: string;
  height: number; // 1 = adulte, ~0.78 enfant
  width: number; // corpulence
  headR: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  hat?: Hat;
  hatCol?: string;
  top: string;
  topStyle: TopStyle;
  bottom: string;
  shoes: string;
  accent?: string; // écharpe / ceinture / châle
  scarf?: boolean;
  shawl?: boolean;
  apron?: string;
  bag?: string;
  mailbag?: boolean;
  glasses?: boolean;
  mustache?: boolean;
  beard?: boolean;
  goggles?: boolean;
  flour?: boolean;
  blush?: boolean;
  belt?: string;
  eyeCol?: string;
  pattern?: 'dots' | 'flowers' | 'stripes' | 'leaves';
  patternCol?: string;
  cuff?: string;
}

export type Dir3 = 'down' | 'up' | 'right';
export interface Limb { swing: number; lift: number; raise?: number; bend?: number; fwd?: number }
export interface Pose {
  bob: number;
  lean: number;
  crouch: number;
  legs: [Limb, Limb];
  arms: [Limb, Limb];
  turn: number; // regard latéral -1..1
  nod: number;
  tilt: number;
  eyes: 'open' | 'closed' | 'half' | 'wide' | 'squint';
  mouth: 'closed' | 'open' | 'smile' | 'o' | 'grit' | 'talk';
  brows: number;
  item?: { kind: 'atlas'; open: number } | { kind: 'staff'; angle: number; reach: number } | { kind: 'broom'; angle: number } | { kind: 'hammer'; angle: number } | { kind: 'quill' } | { kind: 'letter' } | { kind: 'basket' };
  hurt?: boolean;
  coatFlap: number;
}

export const FW = 64, FH = 86, FOOT = 80;

function basePose(): Pose {
  return {
    bob: 0, lean: 0, crouch: 0,
    legs: [{ swing: 0, lift: 0 }, { swing: 0, lift: 0 }],
    arms: [{ swing: 0, lift: 0, raise: 0, bend: 0.15 }, { swing: 0, lift: 0, raise: 0, bend: 0.15 }],
    turn: 0, nod: 0, tilt: 0, eyes: 'open', mouth: 'closed', brows: 0, coatFlap: 0,
  };
}

// ---------------------------------------------------------------- animations
export type AnimName = 'idle' | 'fidget' | 'walk' | 'run' | 'talk' | 'inspect' | 'atlas' | 'attack' | 'hurt' | 'work';
export interface AnimDef { frames: number; rate: number; loop: boolean; pose: (i: number, n: number, dir: Dir3) => Pose }

const TAU = Math.PI * 2;

export const ANIMS: Record<AnimName, AnimDef> = {
  idle: {
    frames: 4, rate: 3.2, loop: true,
    pose: (i, n) => {
      const p = basePose();
      const t = (i / n) * TAU;
      p.bob = Math.sin(t) * 0.6 + 0.3;
      p.arms[0].swing = Math.sin(t) * 0.04; p.arms[1].swing = -Math.sin(t) * 0.04;
      if (i === 3) p.eyes = 'closed';
      return p;
    },
  },
  fidget: {
    frames: 8, rate: 5, loop: false,
    pose: (i) => {
      const p = basePose();
      const look = [0, -0.6, -1, -1, -0.2, 0.7, 1, 0.3][i];
      p.turn = look; p.bob = 0.3;
      if (i >= 5) { p.arms[1].raise = 0.85; p.arms[1].bend = 0.9; p.brows = 1; p.mouth = 'o'; }
      if (i === 3) p.eyes = 'half';
      return p;
    },
  },
  walk: {
    frames: 8, rate: 11, loop: true,
    pose: (i, n) => {
      const p = basePose();
      const t = (i / n) * TAU;
      const s = Math.sin(t);
      p.legs[0].swing = s; p.legs[1].swing = -s;
      p.legs[0].lift = Math.max(0, Math.cos(t)) * 0.7; p.legs[1].lift = Math.max(0, -Math.cos(t)) * 0.7;
      p.arms[0].swing = -s * 0.75; p.arms[1].swing = s * 0.75;
      p.bob = -Math.abs(Math.cos(t)) * 1.4 + 0.7;
      p.lean = 0.05;
      p.coatFlap = Math.cos(t * 2) * 0.5;
      return p;
    },
  },
  run: {
    frames: 6, rate: 14, loop: true,
    pose: (i, n) => {
      const p = basePose();
      const t = (i / n) * TAU;
      const s = Math.sin(t);
      p.legs[0].swing = s * 1.35; p.legs[1].swing = -s * 1.35;
      p.legs[0].lift = Math.max(0, Math.cos(t)) * 1.3; p.legs[1].lift = Math.max(0, -Math.cos(t)) * 1.3;
      p.arms[0].swing = -s * 1.1; p.arms[1].swing = s * 1.1;
      p.arms[0].bend = 0.75; p.arms[1].bend = 0.75;
      p.bob = -Math.abs(Math.cos(t)) * 2.6 + 1;
      p.lean = 0.2;
      p.coatFlap = 0.8 + Math.cos(t * 2) * 0.4;
      p.mouth = 'open';
      return p;
    },
  },
  talk: {
    frames: 4, rate: 7, loop: true,
    pose: (i) => {
      const p = basePose();
      p.mouth = (['talk', 'closed', 'open', 'smile'] as const)[i];
      p.arms[1].raise = [0.35, 0.5, 0.6, 0.4][i]; p.arms[1].bend = 0.8;
      p.arms[1].fwd = 1;
      p.nod = [0, 0.6, 0, -0.4][i];
      p.brows = i === 2 ? 1 : 0;
      p.bob = 0.3;
      return p;
    },
  },
  inspect: {
    frames: 4, rate: 4, loop: true,
    pose: (i) => {
      const p = basePose();
      p.crouch = 0.55; p.lean = 0.35; p.nod = 1.5;
      p.arms[0].raise = 0.65; p.arms[0].bend = 0.95; // main au menton
      p.arms[1].raise = 0.15; p.arms[1].fwd = 1; p.arms[1].bend = 0.5;
      p.eyes = i === 2 ? 'squint' : 'open';
      p.brows = -0.6; p.mouth = i === 3 ? 'o' : 'closed';
      p.turn = [0.15, 0.3, 0.1, -0.1][i];
      return p;
    },
  },
  atlas: {
    frames: 6, rate: 6, loop: false,
    pose: (i) => {
      const p = basePose();
      const open = [0, 0.2, 0.6, 1, 1, 1][i];
      p.item = { kind: 'atlas', open };
      p.arms[0].raise = 0.45; p.arms[1].raise = 0.45; p.arms[0].bend = 0.9; p.arms[1].bend = 0.9; p.arms[0].fwd = 1; p.arms[1].fwd = 1;
      p.nod = 1.6; p.lean = 0.12;
      p.eyes = i >= 4 ? 'wide' : 'open'; p.brows = i >= 4 ? 1 : 0;
      p.mouth = i === 5 ? 'o' : 'closed';
      return p;
    },
  },
  attack: {
    frames: 4, rate: 13, loop: false,
    pose: (i) => {
      const p = basePose();
      const ang = [-2.2, -2.7, 0.5, 0.9][i];
      p.item = { kind: 'staff', angle: ang, reach: i >= 2 ? 1 : 0 };
      p.arms[1].raise = [0.9, 1, 0.3, 0.15][i]; p.arms[1].bend = [0.6, 0.4, 0.1, 0.15][i]; p.arms[1].fwd = 1;
      p.arms[0].raise = [0.6, 0.7, 0.25, 0.1][i]; p.arms[0].fwd = 1; p.arms[0].bend = 0.4;
      p.lean = [-0.1, -0.15, 0.35, 0.3][i];
      p.legs[0].swing = [0.2, 0.3, 0.8, 0.7][i]; p.legs[1].swing = -0.4;
      p.mouth = i >= 2 ? 'grit' : 'closed'; p.brows = -1;
      p.coatFlap = i >= 2 ? 0.8 : 0;
      return p;
    },
  },
  hurt: {
    frames: 2, rate: 6, loop: false,
    pose: (i) => {
      const p = basePose();
      p.lean = -0.3; p.eyes = 'closed'; p.mouth = 'o'; p.brows = 1; p.hurt = i === 0;
      p.arms[0].raise = 0.5; p.arms[1].raise = 0.5; p.arms[0].bend = 0.7; p.arms[1].bend = 0.7;
      p.bob = 1; p.tilt = -0.15;
      return p;
    },
  },
  work: {
    frames: 4, rate: 4, loop: true,
    pose: (i) => {
      const p = basePose();
      const s = Math.sin((i / 4) * TAU);
      p.arms[1].raise = 0.35 + s * 0.25; p.arms[1].fwd = 1; p.arms[1].bend = 0.6;
      p.arms[0].raise = 0.3 - s * 0.15; p.arms[0].fwd = 1; p.arms[0].bend = 0.6;
      p.lean = 0.15 + s * 0.05; p.nod = 1; p.bob = 0.5 + s * 0.3;
      p.eyes = i === 2 ? 'half' : 'open';
      return p;
    },
  },
};

// ---------------------------------------------------------------- dessin
interface G { cx: number; feet: number; hipY: number; shY: number; headY: number; r: number; w: number; h: number; lw: number }

function geom(spec: CharSpec, p: Pose): G {
  const h = spec.height;
  const legLen = 15 * h * (1 - p.crouch * 0.28);
  const torso = 12.5 * h;
  const hipY = FOOT - legLen + p.bob;
  const shY = hipY - torso + p.crouch * 2;
  const r = spec.headR * 1.22;
  return { cx: FW / 2, feet: FOOT, hipY, shY, headY: shY - r * 0.8 + p.nod, r, w: spec.width * 1.08, h, lw: 1.9 };
}

function topColor(spec: CharSpec): string { return spec.top; }

// ---- jambes
function legFront(ctx: Ctx, spec: CharSpec, g: G, p: Pose, side: number) {
  const L = p.legs[side === -1 ? 0 : 1];
  const hx = g.cx + side * 3.9 * g.w;
  const fy = g.feet - L.lift * 4.5 + L.swing * 1.6;
  const fx = hx + side * 0.6;
  const col = spec.topStyle === 'dress' || spec.topStyle === 'robe' ? spec.skin : spec.bottom;
  ctx.beginPath(); capsule(ctx, hx, g.hipY, fx, fy - 2.2, 7.4 * g.w * 0.92, 6.2);
  ink(ctx, col, g.lw, { shadeFn: () => ctx.rect(hx + side * 0.5, g.hipY - 2, 6, 40) });
  if (spec.topStyle === 'dress' || spec.topStyle === 'robe') {
    // chaussettes
    ctx.beginPath(); capsule(ctx, fx, fy - 6, fx, fy - 2.2, 5.2, 5.2); ink(ctx, '#f3eadb', g.lw);
  }
  ctx.beginPath(); ellipse(ctx, fx + side * 0.4, fy, 4.8, 3.1 + L.swing * 0.3);
  ink(ctx, spec.shoes, g.lw, { light: () => ellipse(ctx, fx - 1, fy - 1.3, 2.2, 1) });
}

function legBack(ctx: Ctx, spec: CharSpec, g: G, p: Pose, side: number) {
  const L = p.legs[side === -1 ? 0 : 1];
  const hx = g.cx + side * 3.9 * g.w;
  const fy = g.feet - L.lift * 4.5 - L.swing * 1.6;
  const col = spec.topStyle === 'dress' || spec.topStyle === 'robe' ? spec.skin : spec.bottom;
  ctx.beginPath(); capsule(ctx, hx, g.hipY, hx, fy - 2.2, 6.6 * g.w * 0.92, 5.4);
  ink(ctx, shade(col, -0.05), g.lw, { shadeFn: () => ctx.rect(hx + 0.5, g.hipY - 2, 6, 40) });
  ctx.beginPath(); ellipse(ctx, hx, fy - 0.6, 4, 2.6); ink(ctx, shade(spec.shoes, -0.1), g.lw);
}

function legSide(ctx: Ctx, spec: CharSpec, g: G, p: Pose, idx: number, far: boolean) {
  const L = p.legs[idx];
  const len = g.feet - g.hipY;
  const a = L.swing * 0.5;
  const hx = g.cx - 0.5 + p.lean * 4;
  const footX = hx + Math.sin(a) * len;
  const footY = g.hipY + Math.cos(a) * len - L.lift * 4;
  const kneeX = (hx + footX) / 2 + L.lift * 3.5 + 0.8;
  const kneeY = (g.hipY + footY) / 2;
  let col = spec.topStyle === 'dress' || spec.topStyle === 'robe' ? spec.skin : spec.bottom;
  let shoe = spec.shoes;
  if (far) { col = shade(col, -0.25); shoe = shade(shoe, -0.25); }
  ctx.beginPath(); capsule(ctx, hx, g.hipY, kneeX, kneeY, 6.8 * g.w * 0.92, 6); ink(ctx, col, g.lw);
  ctx.beginPath(); capsule(ctx, kneeX, kneeY, footX, footY - 2.2, 6, 5.2); ink(ctx, col, g.lw);
  ctx.beginPath(); ellipse(ctx, footX + 2, footY - 0.6, 4.6, 2.6, 0.08 - L.lift * 0.2);
  ink(ctx, shoe, g.lw, { light: () => ellipse(ctx, footX + 2.5, footY - 1.8, 2.2, 0.9) });
}

// ---- torse
function torsoFront(ctx: Ctx, spec: CharSpec, g: G, p: Pose, back: boolean) {
  const sw = 7.6 * g.w, hw = 7 * g.w;
  const long = spec.topStyle === 'coat' || spec.topStyle === 'robe' || spec.topStyle === 'dress';
  const hem = g.hipY + (long ? (spec.topStyle === 'dress' ? 9 : spec.topStyle === 'robe' ? 14 : 7) : 2) * g.h;
  const flare = long ? 2.6 + p.coatFlap * 1.2 : 0.6;
  const col = back ? shade(topColor(spec), -0.04) : topColor(spec);
  ctx.beginPath();
  ctx.moveTo(g.cx - sw + 1.5, g.shY);
  ctx.quadraticCurveTo(g.cx, g.shY - 2.2, g.cx + sw - 1.5, g.shY);
  ctx.quadraticCurveTo(g.cx + sw + 1, g.shY + 1, g.cx + sw, g.shY + 4);
  ctx.lineTo(g.cx + hw + flare, hem);
  ctx.quadraticCurveTo(g.cx, hem + 2, g.cx - hw - flare, hem);
  ctx.lineTo(g.cx - sw, g.shY + 4);
  ctx.quadraticCurveTo(g.cx - sw - 1, g.shY + 1, g.cx - sw + 1.5, g.shY);
  ctx.closePath();
  const torsoPath: Path2D | undefined = (ctx as any).__p;
  ink(ctx, col, g.lw, {
    shadeFn: () => { ctx.rect(g.cx + 2.5 * g.w, g.shY - 4, 20, 40); ctx.rect(g.cx - 30, hem - 3, 60, 6); },
    light: () => ctx.rect(g.cx - sw - 2, g.shY - 3, 3.5, 30),
  });
  // motif du tissu, ourlet surpiqué, plis
  if (torsoPath) {
    ctx.save(); ctx.clip(torsoPath);
    const pc = spec.patternCol ?? shade(col, 0.35);
    if (spec.pattern === 'dots') { ctx.fillStyle = pc; for (let y = g.shY + 3; y < hem; y += 4.5) for (let x = g.cx - 12 + ((y / 4.5) % 2) * 2.2; x < g.cx + 12; x += 4.4) { ctx.beginPath(); ctx.arc(x, y, 0.85, 0, TAU); ctx.fill(); } }
    if (spec.pattern === 'flowers') { for (let y = g.shY + 4; y < hem; y += 6) for (let x = g.cx - 12 + ((y / 6) % 2) * 3; x < g.cx + 12; x += 6) { ctx.fillStyle = pc; for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, 0.8, 0, TAU); ctx.fill(); } ctx.fillStyle = '#fff3a0'; ctx.beginPath(); ctx.arc(x, y, 0.5, 0, TAU); ctx.fill(); } }
    if (spec.pattern === 'stripes') { ctx.fillStyle = pc; for (let x = g.cx - 14; x < g.cx + 14; x += 3.4) ctx.fillRect(x, g.shY, 1.3, hem - g.shY + 3); }
    if (spec.pattern === 'leaves') { ctx.fillStyle = pc; for (let x = g.cx - 12; x < g.cx + 12; x += 4) { ctx.beginPath(); ellipse(ctx, x, hem - 3.5, 1.6, 0.9, -0.6); ctx.fill(); ctx.beginPath(); ellipse(ctx, x + 2, hem - 5.5, 1.6, 0.9, 0.6); ctx.fill(); } }
    // ourlet
    ctx.fillStyle = shade(col, -0.25); ctx.fillRect(g.cx - 20, hem - 2.6, 40, 4);
    ctx.strokeStyle = shade(col, 0.3); ctx.lineWidth = 0.6; ctx.setLineDash([1.2, 1.2]); ctx.beginPath(); ctx.moveTo(g.cx - 18, hem - 3.6); ctx.quadraticCurveTo(g.cx, hem - 2, g.cx + 18, hem - 3.6); ctx.stroke(); ctx.setLineDash([]);
    // plis
    ctx.strokeStyle = shade(col, -0.22); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(g.cx - hw * 0.6, g.hipY + 1); ctx.quadraticCurveTo(g.cx - hw * 0.7, (g.hipY + hem) / 2, g.cx - hw * 0.85, hem - 2); ctx.moveTo(g.cx + hw * 0.5, g.hipY + 1); ctx.quadraticCurveTo(g.cx + hw * 0.6, (g.hipY + hem) / 2, g.cx + hw * 0.8, hem - 2); ctx.stroke();
    ctx.restore();
  }
  if (back) {
    if (spec.topStyle === 'coat') { ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(g.cx, g.hipY - 1); ctx.lineTo(g.cx, hem); ctx.stroke(); }
    return;
  }
  // détails de face
  if (spec.topStyle === 'coat' || spec.topStyle === 'uniform') {
    ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(g.cx, g.shY + 1); ctx.lineTo(g.cx + 0.3, hem); ctx.stroke();
    // revers
    ctx.beginPath(); ctx.moveTo(g.cx - 3.5, g.shY - 0.5); ctx.lineTo(g.cx, g.shY + 6); ctx.lineTo(g.cx + 3.5, g.shY - 0.5); ctx.stroke();
    ctx.fillStyle = spec.topStyle === 'uniform' ? '#e8c45a' : '#d9b25b';
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(g.cx + 1.6, g.shY + 7 + k * 3.6, 0.95, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5; ctx.stroke(); }
    // poches à rabat
    for (const sd of [-1, 1]) { ctx.beginPath(); rrect(ctx, g.cx + sd * 4.2 - 2.6, g.hipY + 1, 5.2, 4, 1); ink(ctx, shade(col, -0.12), 0.8); ctx.fillStyle = shade(col, 0.2); ctx.fillRect(g.cx + sd * 4.2 - 2.6, g.hipY + 1, 5.2, 1.3); }
  } else if (spec.topStyle === 'shirt' || spec.topStyle === 'tunic') {
    ctx.strokeStyle = shade(col, -0.35); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(g.cx - 2.5, g.shY - 0.5); ctx.lineTo(g.cx, g.shY + 3.5); ctx.lineTo(g.cx + 2.5, g.shY - 0.5); ctx.stroke();
  } else if (spec.topStyle === 'dress') {
    ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 0.8;
    for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(g.cx + k * 3, g.hipY + 1); ctx.lineTo(g.cx + k * 4.2, hem - 0.5); ctx.stroke(); }
    ctx.fillStyle = '#fff6e6'; ctx.beginPath(); ellipse(ctx, g.cx, g.shY + 0.6, 3.8, 1.8); ctx.fill();
  }
  if (spec.apron) {
    ctx.beginPath(); rrect(ctx, g.cx - hw + 1.6, g.shY + 5, (hw - 1.6) * 2, hem - g.shY - 4 + (long ? 0 : 6), 2.5);
    ink(ctx, spec.apron, g.lw * 0.8, { shadeFn: () => ctx.rect(g.cx + 2, g.shY, 20, 40) });
    ctx.fillStyle = shade(spec.apron, -0.15); ctx.fillRect(g.cx - 2.8, g.hipY + 1, 5.6, 3);
  }
  if (spec.belt && !spec.apron) { ctx.fillStyle = spec.belt; ctx.fillRect(g.cx - hw - 0.3, g.hipY - 2.2, hw * 2 + 0.6, 2.4); ctx.fillStyle = '#d9b25b'; ctx.fillRect(g.cx - 1.3, g.hipY - 2.4, 2.6, 2.8); }
  if (spec.flour) { ctx.fillStyle = 'rgba(255,255,255,0.65)'; for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(g.cx - 5 + ((k * 37) % 11), g.shY + 4 + ((k * 53) % 15), 0.9, 0, TAU); ctx.fill(); } }
}

function torsoSide(ctx: Ctx, spec: CharSpec, g: G, p: Pose) {
  const d = 5.2 * g.w;
  const long = spec.topStyle === 'coat' || spec.topStyle === 'robe' || spec.topStyle === 'dress';
  const hem = g.hipY + (long ? (spec.topStyle === 'dress' ? 9 : spec.topStyle === 'robe' ? 14 : 7) : 2) * g.h;
  const lx = p.lean * 5;
  const col = topColor(spec);
  ctx.beginPath();
  ctx.moveTo(g.cx - d + lx, g.shY + 1);
  ctx.quadraticCurveTo(g.cx + lx, g.shY - 2.4, g.cx + d + lx, g.shY + 1.5);
  ctx.quadraticCurveTo(g.cx + d + 1.5 + lx * 0.6, g.hipY - 6, g.cx + d + 0.5, g.hipY);
  ctx.lineTo(g.cx + d + 1.5 + (long ? 1.5 : 0), hem);
  ctx.quadraticCurveTo(g.cx - 1, hem + 1.5, g.cx - d - 1 - (long ? 2 + p.coatFlap * 2.6 : 0), hem - (long ? p.coatFlap * 1.5 : 0));
  ctx.quadraticCurveTo(g.cx - d - 1.5 + lx * 0.4, g.hipY - 8, g.cx - d + lx, g.shY + 1);
  ctx.closePath();
  ink(ctx, col, g.lw, { shadeFn: () => ctx.rect(g.cx - 30, g.shY - 5, 30 - d * 0.3 + lx, 60), light: () => ctx.rect(g.cx + d - 1.5 + lx, g.shY, 3, 20) });
  if (spec.apron) {
    ctx.beginPath(); ctx.moveTo(g.cx + d - 0.5 + lx, g.shY + 5); ctx.lineTo(g.cx + d + 2.5, hem + (long ? 0 : 5)); ctx.lineTo(g.cx + 1, hem + (long ? 0 : 5)); ctx.lineTo(g.cx + 1.5 + lx, g.shY + 5); ctx.closePath();
    ink(ctx, spec.apron, g.lw * 0.8);
  }
  if (spec.belt && !spec.apron) { ctx.fillStyle = spec.belt; ctx.fillRect(g.cx - d - 0.5, g.hipY - 2.2, d * 2 + 1.2, 2.4); }
  if (spec.topStyle === 'coat' || spec.topStyle === 'uniform') {
    ctx.fillStyle = '#d9b25b';
    for (let k = 0; k < 2; k++) { ctx.beginPath(); ctx.arc(g.cx + d - 1 + lx * 0.7, g.shY + 7 + k * 4, 0.7, 0, TAU); ctx.fill(); }
  }
}

// ---- bras
function armFront(ctx: Ctx, spec: CharSpec, g: G, p: Pose, side: number, back: boolean) {
  const A = p.arms[side === -1 ? 0 : 1];
  const sx = g.cx + side * 7.6 * g.w, sy = g.shY + 2.5;
  const raise = A.raise ?? 0, bend = A.bend ?? 0, fwd = A.fwd ?? 0;
  const len = 12 * g.h;
  // main : pendante → levée vers la poitrine/le visage
  let hx = sx + side * 1.6 - side * raise * (fwd ? 5.5 : 2) * (back ? -0.2 : 1) + A.swing * (back ? 0 : 0.6) * side * -0.2;
  let hy = sy + len * (1 - raise * 0.95) - A.swing * (back ? -1.8 : 1.8);
  if (bend > 0.5 && raise > 0.3) { hy -= 2; }
  const ex = sx + side * (2.3 + bend * 1.6), ey = (sy + hy) / 2 + (raise > 0.4 ? 2.5 : 0);
  const col = back ? shade(topColor(spec), -0.08) : topColor(spec);
  ctx.beginPath(); capsule(ctx, sx, sy, ex, ey, 5.2, 4.6); ink(ctx, col, g.lw, { shadeFn: () => ctx.rect(sx + (side > 0 ? 0 : -1), sy - 3, 6, 30) });
  ctx.beginPath(); capsule(ctx, ex, ey, hx, hy - 1.4, 4.6, 4.0); ink(ctx, col, g.lw);
  ctx.beginPath(); ellipse(ctx, hx, hy - 2.2, 2.6, 1.6); ink(ctx, spec.cuff ?? shade(col, 0.3), g.lw * 0.6);
  ctx.beginPath(); ctx.arc(hx, hy, 2.6, 0, TAU); ink(ctx, spec.skin, g.lw * 0.85);
}

function armSide(ctx: Ctx, spec: CharSpec, g: G, p: Pose, idx: number, far: boolean) {
  const A = p.arms[idx];
  const raise = A.raise ?? 0, bend = A.bend ?? 0;
  const sx = g.cx + p.lean * 5 - 0.5, sy = g.shY + 2.8;
  const len = 11.5 * g.h;
  const a = A.swing * 0.75 + raise * 1.6 + (A.fwd ? raise * 0.2 : 0); // angle depuis la verticale, vers l'avant
  const ua = a * (1 - bend * 0.25);
  const ex = sx + Math.sin(ua) * len * 0.5, ey = sy + Math.cos(ua) * len * 0.5;
  const fa = ua + bend * 1.2 * (raise > 0.2 ? 1 : 0.4);
  const hx = ex + Math.sin(fa) * len * 0.5, hy = ey + Math.cos(fa) * len * 0.5;
  let col = topColor(spec), skin = spec.skin;
  if (far) { col = shade(col, -0.28); skin = shade(skin, -0.2); }
  ctx.beginPath(); capsule(ctx, sx, sy, ex, ey, 5, 4.5); ink(ctx, col, g.lw);
  ctx.beginPath(); capsule(ctx, ex, ey, hx, hy, 4.5, 3.9); ink(ctx, col, g.lw);
  ctx.beginPath(); ctx.arc(hx, hy + 0.5, 2.4, 0, TAU); ink(ctx, skin, g.lw * 0.85);
  return [hx, hy] as [number, number];
}

// ---- tête
function eyesFront(ctx: Ctx, spec: CharSpec, g: G, p: Pose, hx: number, hy: number) {
  const r = g.r;
  const ex = r * 0.36, ey = hy + r * 0.16;
  const t = p.turn * r * 0.22;
  for (const s of [-1, 1]) {
    const x = hx + s * ex + t;
    if (p.eyes === 'closed') {
      ctx.strokeStyle = INK; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.arc(x, ey - 0.4, 2.2, 0.2, Math.PI - 0.2); ctx.stroke();
    } else {
      const ry = p.eyes === 'half' ? 2.4 : p.eyes === 'squint' ? 1.8 : p.eyes === 'wide' ? 5 : 4.3;
      ctx.beginPath(); ellipse(ctx, x, ey, 3.1, ry); ctx.fillStyle = '#fffdf6'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.save(); ctx.beginPath(); ellipse(ctx, x, ey, 3.1, ry); ctx.clip();
      const px = x + p.turn * 1.2;
      ctx.fillStyle = spec.eyeCol ?? '#3b2a20';
      ctx.beginPath(); ellipse(ctx, px, ey + 0.6, 2.3, 3); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ellipse(ctx, px, ey + 0.9, 1.3, 1.8); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(px - 0.9, ey - 0.7, 0.9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(px + 0.9, ey + 1.8, 0.45, 0, TAU); ctx.fill();
      if (p.eyes === 'half' || p.eyes === 'squint') { ctx.fillStyle = spec.skin; ctx.fillRect(x - 4, ey - 6, 8, p.eyes === 'squint' ? 4.6 : 3.6); }
      ctx.restore();
    }
    // sourcils
    ctx.strokeStyle = shade(spec.hair, -0.25); ctx.lineWidth = 1.6;
    const by = ey - 6 - p.brows * 1.3;
    ctx.beginPath();
    ctx.moveTo(x - 2.4, by + (p.brows < 0 ? -s * 0.9 : 0.4));
    ctx.quadraticCurveTo(x, by - 1, x + 2.4, by + (p.brows < 0 ? s * 0.9 : 0.4));
    ctx.stroke();
  }
  if (spec.glasses) {
    ctx.strokeStyle = '#5a3d2a'; ctx.lineWidth = 0.9;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * ex + t, ey, 3.4, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(hx - ex + t + 3.4, ey); ctx.lineTo(hx + ex + t - 3.4, ey); ctx.stroke();
  }
}

function mouthFront(ctx: Ctx, spec: CharSpec, g: G, p: Pose, hx: number, hy: number) {
  const r = g.r;
  const mx = hx + p.turn * r * 0.22, my = hy + r * 0.55;
  // nez
  ctx.strokeStyle = shade(spec.skin, -0.35); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(mx + 0.2, hy + r * 0.2); ctx.quadraticCurveTo(mx + 1.6, hy + r * 0.36, mx - 0.4, hy + r * 0.38); ctx.stroke();
  if (spec.blush !== false) { ctx.fillStyle = 'rgba(230,110,90,0.28)'; for (const s of [-1, 1]) { ctx.beginPath(); ellipse(ctx, hx + s * r * 0.58 + p.turn * 1.5, hy + r * 0.35, 2.2, 1.3); ctx.fill(); } }
  if (spec.mustache) {
    ctx.beginPath(); ctx.moveTo(mx, my - 2); ctx.quadraticCurveTo(mx - 3, my - 3.4, mx - 5.2, my - 0.5); ctx.quadraticCurveTo(mx - 2.5, my - 1, mx, my - 0.7);
    ctx.quadraticCurveTo(mx + 2.5, my - 1, mx + 5.2, my - 0.5); ctx.quadraticCurveTo(mx + 3, my - 3.4, mx, my - 2); ctx.closePath();
    ink(ctx, spec.hair, 0.8);
  }
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  switch (p.mouth) {
    case 'closed': ctx.beginPath(); ctx.moveTo(mx - 2, my); ctx.quadraticCurveTo(mx, my + 0.9, mx + 2, my); ctx.stroke(); break;
    case 'smile': ctx.beginPath(); ctx.moveTo(mx - 2.8, my - 0.6); ctx.quadraticCurveTo(mx, my + 2.6, mx + 2.8, my - 0.6); ctx.stroke(); break;
    case 'grit': ctx.beginPath(); rrect(ctx, mx - 2.6, my - 1, 5.2, 2.4, 0.8); ctx.fillStyle = '#fff'; ctx.fill(); ctx.stroke(); break;
    case 'o': ctx.beginPath(); ellipse(ctx, mx, my + 0.5, 1.3, 1.7); ctx.fillStyle = '#6b2a24'; ctx.fill(); ctx.stroke(); break;
    case 'open': case 'talk': {
      const hgt = p.mouth === 'open' ? 2.6 : 1.8;
      ctx.beginPath(); ctx.moveTo(mx - 2.4, my - 0.4); ctx.quadraticCurveTo(mx, my + hgt * 1.6, mx + 2.4, my - 0.4); ctx.closePath();
      ctx.fillStyle = '#6b2a24'; ctx.fill(); ctx.stroke(); break;
    }
  }
  if (spec.beard) {
    ctx.beginPath(); ctx.moveTo(hx - r * 0.85, hy + r * 0.1); ctx.quadraticCurveTo(hx - r * 0.8, hy + r * 1.25, hx, hy + r * 1.3);
    ctx.quadraticCurveTo(hx + r * 0.8, hy + r * 1.25, hx + r * 0.85, hy + r * 0.1);
    ctx.quadraticCurveTo(hx + r * 0.5, hy + r * 0.75, mx + 3, my + 1.5); ctx.quadraticCurveTo(mx, my + 3.2, mx - 3, my + 1.5);
    ctx.quadraticCurveTo(hx - r * 0.5, hy + r * 0.75, hx - r * 0.85, hy + r * 0.1); ctx.closePath();
    ink(ctx, spec.hair, g.lw * 0.8, { shadeFn: () => ctx.rect(hx + 2, hy, 20, 20) });
  }
}

function hairBackLayer(ctx: Ctx, spec: CharSpec, g: G, hx: number, hy: number, view: Dir3) {
  const r = g.r;
  if (spec.hairStyle === 'long' || spec.hairStyle === 'braid' || spec.hairStyle === 'curly') {
    if (view === 'down') {
      ctx.beginPath(); rrect(ctx, hx - r * 1.02, hy - r * 0.3, r * 2.04, r * (spec.hairStyle === 'long' ? 2.1 : 1.35), r * 0.7);
      ink(ctx, shade(spec.hair, -0.12), g.lw);
    }
  }
  if (spec.hairStyle === 'pigtails' && view !== 'up') {
    for (const s of view === 'right' ? [-1] : [-1, 1]) {
      const tx = hx + s * r * 1.05 + (view === 'right' ? -2 : 0);
      ctx.beginPath(); ellipse(ctx, tx + s * 2.5, hy + r * 0.45, 3.6, 6.2, s * 0.5); ink(ctx, spec.hair, g.lw);
      ctx.fillStyle = spec.accent ?? '#d4473d'; ctx.beginPath(); ctx.arc(tx, hy - r * 0.05, 1.9, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8; ctx.stroke();
    }
  }
}

function headFront(ctx: Ctx, spec: CharSpec, g: G, p: Pose) {
  const r = g.r, hx = g.cx + p.turn * 0.8, hy = g.headY;
  ctx.save();
  ctx.translate(hx, hy + r); ctx.rotate(p.tilt); ctx.translate(-hx, -(hy + r));
  hairBackLayer(ctx, spec, g, hx, hy, 'down');
  // oreilles
  for (const s of [-1, 1]) { ctx.beginPath(); ellipse(ctx, hx + s * r * 0.96 - p.turn * 1.2, hy + r * 0.12, 2.3, 3); ink(ctx, shade(spec.skin, -0.05), g.lw * 0.85); }
  // visage
  ctx.beginPath();
  ctx.moveTo(hx - r, hy - r * 0.1);
  ctx.bezierCurveTo(hx - r, hy - r * 1.15, hx + r, hy - r * 1.15, hx + r, hy - r * 0.1);
  ctx.bezierCurveTo(hx + r, hy + r * 0.75, hx + r * 0.45, hy + r * 1.02, hx, hy + r * 1.02);
  ctx.bezierCurveTo(hx - r * 0.45, hy + r * 1.02, hx - r, hy + r * 0.75, hx - r, hy - r * 0.1);
  ctx.closePath();
  ink(ctx, spec.skin, g.lw, { shadeFn: () => { ctx.moveTo(hx + r * 0.35 - p.turn * 3, hy - r * 2); ctx.quadraticCurveTo(hx + r * 0.7, hy + r * 0.2, hx + r * 0.1, hy + r * 1.3); ctx.lineTo(hx + r * 2, hy + r * 2); ctx.lineTo(hx + r * 2, hy - r * 2); ctx.closePath(); }, shadeCol: shade(spec.skin, -0.13) });
  eyesFront(ctx, spec, g, p, hx, hy);
  mouthFront(ctx, spec, g, p, hx, hy);
  hairFront(ctx, spec, g, hx, hy, p);
  ctx.restore();
}

function hairFront(ctx: Ctx, spec: CharSpec, g: G, hx: number, hy: number, p: Pose) {
  const r = g.r, H = spec.hair;
  const t = p.turn * 1.4;
  const lit = shade(H, 0.32), dark = shade(H, -0.28);
  const lw = g.lw;
  // calotte : du sommet jusqu'aux tempes, échancrée au-dessus du front
  const mass = (side: number, hairline = 0.42) => {
    ctx.beginPath();
    ctx.moveTo(hx - r * 1.07, hy + r * side);
    ctx.bezierCurveTo(hx - r * 1.22, hy - r * 1.5, hx + r * 1.22, hy - r * 1.5, hx + r * 1.07, hy + r * side);
    ctx.lineTo(hx + r * 0.78, hy - r * (hairline - 0.1));
    ctx.quadraticCurveTo(hx + t, hy - r * (hairline + 0.42), hx - r * 0.78, hy - r * (hairline - 0.1));
    ctx.closePath();
    ink(ctx, H, lw, { shadeFn: () => { ctx.rect(hx + r * 0.42, hy - r * 2, r * 2, r * 3); }, shadeCol: dark });
  };
  // une mèche en goutte, de la racine (x0,y0) à la pointe (x1,y1)
  const lock = (x0: number, y0: number, x1: number, y1: number, w: number, bend = 0.25) => {
    const mx = (x0 + x1) / 2 + (y1 - y0) * bend * 0.3, my = (y0 + y1) / 2;
    ctx.beginPath();
    ctx.moveTo(x0 - w / 2, y0);
    ctx.quadraticCurveTo(mx - w * 0.45, my, x1, y1);
    ctx.quadraticCurveTo(mx + w * 0.45, my, x0 + w / 2, y0);
    ctx.closePath();
    ink(ctx, H, lw * 0.85, { shadeFn: () => ctx.rect(Math.min(x0, x1) + w * 0.15, y0 - 2, w * 2, Math.abs(y1 - y0) + 6), shadeCol: shade(H, -0.12) });
  };
  const fringe = (n: number, len: number, spread: number, wid: number) => {
    for (let i = 0; i < n; i++) {
      const u = n === 1 ? 0 : i / (n - 1) * 2 - 1;
      const x0 = hx + u * r * spread + t, y0 = hy - r * 0.62 + Math.abs(u) * r * 0.12;
      lock(x0, y0, x0 + u * r * 0.18 - 0.6, y0 + r * len * (1 - Math.abs(u) * 0.25), r * wid);
    }
  };
  const sideLocks = (len: number) => { for (const sd of [-1, 1]) lock(hx + sd * r * 0.8, hy - r * 0.5, hx + sd * r * 0.86, hy + r * len, r * 0.28, 0); };
  const shine = () => {
    // reflet en anneau, très lisible de loin
    ctx.strokeStyle = lit; ctx.lineWidth = r * 0.14; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(hx - r * 0.05, hy - r * 0.35, r * 0.68, Math.PI * 1.2, Math.PI * 1.45); ctx.stroke();
    ctx.lineWidth = r * 0.09; ctx.beginPath(); ctx.arc(hx - r * 0.05, hy - r * 0.35, r * 0.68, Math.PI * 1.53, Math.PI * 1.62); ctx.stroke();
  };
  switch (spec.hairStyle) {
    case 'tousle': {
      mass(0.15);
      // épis sur le dessus
      // épi : une mèche recourbée sur le sommet
      ctx.beginPath(); ctx.moveTo(hx - r * 0.2, hy - r * 1.02); ctx.quadraticCurveTo(hx - r * 0.1, hy - r * 1.6, hx + r * 0.45, hy - r * 1.42); ctx.quadraticCurveTo(hx + r * 0.1, hy - r * 1.3, hx + r * 0.15, hy - r * 1.02); ctx.closePath(); ink(ctx, H, lw * 0.85);
      sideLocks(0.35);
      fringe(5, 0.62, 0.62, 0.48);
      shine();
      break;
    }
    case 'short': mass(0.02, 0.5); fringe(4, 0.32, 0.55, 0.5); shine(); break;
    case 'bun': {
      ctx.beginPath(); ctx.arc(hx, hy - r * 1.2, r * 0.5, 0, TAU); ink(ctx, H, lw, { light: () => ellipse(ctx, hx - 2.5, hy - r * 1.35, r * 0.2, r * 0.12), lightCol: lit });
      mass(0.25, 0.5);
      ctx.strokeStyle = dark; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx + t, hy - r * 1.05); ctx.quadraticCurveTo(hx - r * 0.55, hy - r * 0.75, hx - r * 0.95, hy - r * 0.05); ctx.moveTo(hx + t, hy - r * 1.05); ctx.quadraticCurveTo(hx + r * 0.55, hy - r * 0.75, hx + r * 0.95, hy - r * 0.05); ctx.stroke();
      shine();
      break;
    }
    case 'braid': {
      mass(0.4, 0.45);
      lock(hx - r * 0.1 + t, hy - r * 0.95, hx - r * 0.75, hy - r * 0.2, r * 0.7, -0.3);
      sideLocks(0.5); shine();
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ellipse(ctx, hx + r * 0.88 + (k % 2) * 0.9, hy + r * 0.85 + k * 3.6, 3, 2.5); ink(ctx, H, lw * 0.8, { light: () => ellipse(ctx, hx + r * 0.8 + (k % 2) * 0.9, hy + r * 0.8 + k * 3.6, 1.2, 0.8), lightCol: lit }); }
      break;
    }
    case 'long': mass(0.7, 0.45); sideLocks(0.9); fringe(3, 0.45, 0.45, 0.55); shine(); break;
    case 'curly': {
      for (let k = 0; k < 10; k++) { const a = Math.PI * 0.95 + (k / 9) * Math.PI * 1.1; ctx.beginPath(); ctx.arc(hx + Math.cos(a) * r * 1.0, hy - r * 0.2 + Math.sin(a) * r * 1.0, r * 0.38, 0, TAU); ink(ctx, H, lw * 0.8, { light: () => ctx.arc(hx + Math.cos(a) * r * 1.0 - 1, hy - r * 0.2 + Math.sin(a) * r * 1.0 - 1, r * 0.12, 0, TAU), lightCol: lit }); }
      mass(0.05, 0.55);
      for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(hx - r * 0.55 + k * r * 0.37 + t, hy - r * 0.6, r * 0.24, 0, TAU); ink(ctx, H, lw * 0.75); }
      break;
    }
    case 'pigtails': mass(0.25, 0.45); fringe(5, 0.42, 0.6, 0.45); shine(); break;
    case 'bald': break;
  }
  hatFront(ctx, spec, g, hx, hy);
  if (spec.goggles) {
    ctx.fillStyle = '#6a4a32'; ctx.fillRect(hx - r, hy - r * 0.72, r * 2, 2.2);
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(hx + s * 4, hy - r * 0.62, 3, 0, TAU); ink(ctx, '#9fd2d8', 1, { light: () => ctx.arc(hx + s * 4 - 1, hy - r * 0.7, 1, 0, TAU) }); }
  }
}

function hatFront(ctx: Ctx, spec: CharSpec, g: G, hx: number, hy: number) {
  const r = g.r, c = spec.hatCol ?? '#4a5a7a';
  switch (spec.hat) {
    case 'cap': // casquette de facteur
      ctx.beginPath(); rrect(ctx, hx - r * 0.92, hy - r * 1.25, r * 1.84, r * 0.75, 3); ink(ctx, c, g.lw, { shadeFn: () => ctx.rect(hx + 3, hy - r * 2, 20, 20) });
      ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.48, r * 0.95, 2.4); ink(ctx, shade(c, -0.3), g.lw);
      ctx.fillStyle = '#e8c45a'; ctx.beginPath(); ctx.arc(hx, hy - r * 0.9, 1.5, 0, TAU); ctx.fill();
      break;
    case 'flatcap':
      ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.75, r * 1.08, r * 0.52); ink(ctx, c, g.lw, { light: () => ellipse(ctx, hx - 3, hy - r * 0.95, 4, 1.5) });
      ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.42, r * 0.8, 2); ink(ctx, shade(c, -0.25), g.lw);
      break;
    case 'kettle': // chapeau de fer du garde
      ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.5, r * 1.45, r * 0.36); ink(ctx, '#8d96a0', g.lw, { light: () => ellipse(ctx, hx - 4, hy - r * 0.58, 6, 1.4) });
      ctx.beginPath(); ctx.moveTo(hx - r * 0.85, hy - r * 0.55); ctx.bezierCurveTo(hx - r * 0.9, hy - r * 1.55, hx + r * 0.9, hy - r * 1.55, hx + r * 0.85, hy - r * 0.55); ctx.closePath();
      ink(ctx, '#a3acb5', g.lw, { shadeFn: () => ctx.rect(hx + 2, hy - r * 2, 20, 20), light: () => ellipse(ctx, hx - 3, hy - r * 1.05, 2, 3) });
      break;
    case 'hood': // capuche profonde (le Conservateur)
      ctx.beginPath(); ctx.moveTo(hx - r * 1.2, hy + r * 0.9); ctx.bezierCurveTo(hx - r * 1.45, hy - r * 1.7, hx + r * 1.45, hy - r * 1.7, hx + r * 1.2, hy + r * 0.9);
      ctx.quadraticCurveTo(hx + r * 0.9, hy - r * 0.55, hx, hy - r * 0.62); ctx.quadraticCurveTo(hx - r * 0.9, hy - r * 0.55, hx - r * 1.2, hy + r * 0.9); ctx.closePath();
      ink(ctx, c, g.lw, { shadeFn: () => ctx.rect(hx + r * 0.2, hy - r * 2, r * 2, r * 4), light: () => ellipse(ctx, hx - r * 0.5, hy - r * 0.95, 3, 1.4) });
      ctx.fillStyle = 'rgba(20,18,30,0.55)'; ctx.beginPath(); ctx.moveTo(hx - r * 0.95, hy + r * 0.2); ctx.quadraticCurveTo(hx, hy - r * 0.75, hx + r * 0.95, hy + r * 0.2); ctx.quadraticCurveTo(hx, hy - r * 0.25, hx - r * 0.95, hy + r * 0.2); ctx.fill();
      break;
    case 'kerchief':
      ctx.beginPath(); ctx.moveTo(hx - r * 1.05, hy - r * 0.2); ctx.bezierCurveTo(hx - r * 1.1, hy - r * 1.4, hx + r * 1.1, hy - r * 1.4, hx + r * 1.05, hy - r * 0.2); ctx.quadraticCurveTo(hx, hy - r * 0.65, hx - r * 1.05, hy - r * 0.2); ctx.closePath();
      ink(ctx, c, g.lw, { light: () => ellipse(ctx, hx - 3, hy - r * 0.95, 3, 1.4) });
      ctx.fillStyle = '#fff6e6'; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(hx - r * 0.6 + k * r * 0.24, hy - r * 0.8 + (k % 2) * 2, 0.7, 0, TAU); ctx.fill(); }
      break;
    default: break;
  }
}

function headBack(ctx: Ctx, spec: CharSpec, g: G, p: Pose) {
  const r = g.r, hx = g.cx, hy = g.headY;
  for (const s of [-1, 1]) { ctx.beginPath(); ellipse(ctx, hx + s * r * 0.96, hy + r * 0.12, 2.3, 3); ink(ctx, shade(spec.skin, -0.1), g.lw * 0.85); }
  ctx.beginPath(); ellipse(ctx, hx, hy, r, r * 1.02); ink(ctx, spec.skin, g.lw);
  const H = spec.hair;
  if (spec.hairStyle !== 'bald') {
    const low = spec.hairStyle === 'long' ? 1.9 : spec.hairStyle === 'braid' ? 0.75 : spec.hairStyle === 'bun' ? 0.55 : 0.68;
    if (spec.hairStyle === 'bun') { ctx.beginPath(); ctx.arc(hx, hy - r * 0.6, r * 0.52, 0, TAU); ink(ctx, H, g.lw); }
    ctx.beginPath();
    ctx.moveTo(hx - r * 1.08, hy + r * 0.2);
    ctx.bezierCurveTo(hx - r * 1.2, hy - r * 1.45, hx + r * 1.2, hy - r * 1.45, hx + r * 1.08, hy + r * 0.2);
    // bord inférieur en mèches arrondies
    const n = 5;
    for (let i = 0; i <= n; i++) {
      const u = 1 - (i / n) * 2;
      const x = hx + u * r * 1.0, y = hy + r * (low + (1 - Math.abs(u)) * 0.18);
      const xp = hx + (1 - ((i + 0.5) / n) * 2) * r * 1.0;
      ctx.quadraticCurveTo(x, y + 2.5, i < n ? xp : x, hy + r * (low - 0.12));
    }
    ctx.closePath();
    ink(ctx, H, g.lw, { shadeFn: () => ctx.rect(hx + r * 0.3, hy - r * 2, r * 2, r * 4), shadeCol: shade(H, -0.25) });
    ctx.strokeStyle = shade(H, 0.32); ctx.lineWidth = r * 0.13; ctx.beginPath(); ctx.arc(hx, hy - r * 0.35, r * 0.68, Math.PI * 1.2, Math.PI * 1.55); ctx.stroke();
    ctx.strokeStyle = shade(H, -0.3); ctx.lineWidth = 0.9; for (const k of [-0.45, 0, 0.45]) { ctx.beginPath(); ctx.moveTo(hx + k * r, hy - r * 0.6); ctx.quadraticCurveTo(hx + k * r * 1.2, hy + r * 0.1, hx + k * r * 1.1, hy + r * (low - 0.1)); ctx.stroke(); }
    if (spec.hairStyle === 'tousle') { ctx.beginPath(); ctx.moveTo(hx - r * 0.2, hy - r * 1.02); ctx.quadraticCurveTo(hx - r * 0.1, hy - r * 1.6, hx + r * 0.45, hy - r * 1.42); ctx.quadraticCurveTo(hx + r * 0.1, hy - r * 1.3, hx + r * 0.15, hy - r * 1.02); ctx.closePath(); ink(ctx, H, g.lw * 0.85); }
    if (spec.hairStyle === 'braid') { for (let k = 0; k < 6; k++) { ctx.beginPath(); ellipse(ctx, hx + (k % 2) * 0.9 - 0.45, hy + r * 0.85 + k * 3.6, 3, 2.5); ink(ctx, H, g.lw * 0.8); } }
    if (spec.hairStyle === 'pigtails') { for (const sd of [-1, 1]) { ctx.beginPath(); ellipse(ctx, hx + sd * r * 1.15, hy + r * 0.45, 4.2, 7, sd * 0.5); ink(ctx, H, g.lw); } }
  }
  const c = spec.hatCol ?? '#4a5a7a';
  if (spec.hat === 'cap' || spec.hat === 'flatcap') { ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.72, r * 1.02, r * 0.55); ink(ctx, c, g.lw); }
  if (spec.hat === 'kettle') {
    ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.5, r * 1.45, r * 0.36); ink(ctx, '#8d96a0', g.lw);
    ctx.beginPath(); ctx.moveTo(hx - r * 0.85, hy - r * 0.55); ctx.bezierCurveTo(hx - r * 0.9, hy - r * 1.55, hx + r * 0.9, hy - r * 1.55, hx + r * 0.85, hy - r * 0.55); ctx.closePath(); ink(ctx, '#a3acb5', g.lw);
  }
  if (spec.hat === 'hood') { ctx.beginPath(); ctx.moveTo(hx - r * 1.2, hy + r * 1.0); ctx.bezierCurveTo(hx - r * 1.45, hy - r * 1.7, hx + r * 1.45, hy - r * 1.7, hx + r * 1.2, hy + r * 1.0); ctx.quadraticCurveTo(hx, hy + r * 1.5, hx - r * 1.2, hy + r * 1.0); ctx.closePath(); ink(ctx, c, g.lw, { shadeFn: () => ctx.rect(hx + r * 0.3, hy - r * 2, r * 2, r * 4) }); ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hx, hy - r * 1.1); ctx.lineTo(hx, hy + r * 1.1); ctx.stroke(); }
  if (spec.hat === 'kerchief') { ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.45, r * 1.06, r * 0.75); ink(ctx, c, g.lw); }
  if (spec.goggles) { ctx.fillStyle = '#6a4a32'; ctx.fillRect(hx - r, hy - r * 0.6, r * 2, 2.2); }
  void p;
}

function headSide(ctx: Ctx, spec: CharSpec, g: G, p: Pose) {
  const r = g.r, hx = g.cx + 1 + p.lean * 6, hy = g.headY + p.lean * 2;
  ctx.save();
  ctx.translate(hx, hy + r); ctx.rotate(p.tilt + p.lean * 0.15); ctx.translate(-hx, -(hy + r));
  const H = spec.hair;
  if (spec.hairStyle === 'long') { ctx.beginPath(); rrect(ctx, hx - r * 1.05, hy - r * 0.4, r * 1.3, r * 2.1, r * 0.6); ink(ctx, shade(H, -0.12), g.lw); }
  if (spec.hairStyle === 'pigtails') { ctx.beginPath(); ellipse(ctx, hx - r * 1.05, hy + r * 0.45, 3.6, 6.2, -0.5); ink(ctx, H, g.lw); }
  // visage de profil
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.95, hy);
  ctx.bezierCurveTo(hx - r * 1.0, hy - r * 1.2, hx + r * 0.95, hy - r * 1.2, hx + r * 0.95, hy - r * 0.1);
  ctx.quadraticCurveTo(hx + r * 1.25, hy + r * 0.2, hx + r * 0.98, hy + r * 0.35); // nez
  ctx.quadraticCurveTo(hx + r * 0.95, hy + r * 0.85, hx + r * 0.35, hy + r * 1.0);
  ctx.quadraticCurveTo(hx - r * 0.6, hy + r * 1.05, hx - r * 0.95, hy);
  ctx.closePath();
  ink(ctx, spec.skin, g.lw, { shadeFn: () => ctx.rect(hx - r * 2, hy - r * 2, r * 1.5, r * 4), shadeCol: shade(spec.skin, -0.12) });
  // oeil
  const ex = hx + r * 0.5, ey = hy + r * 0.12;
  if (p.eyes === 'closed') { ctx.strokeStyle = INK; ctx.lineWidth = 1.1; ctx.beginPath(); ctx.arc(ex, ey - 0.4, 1.8, 0.2, Math.PI - 0.2); ctx.stroke(); }
  else {
    const ry = p.eyes === 'half' ? 2.2 : p.eyes === 'squint' ? 1.6 : p.eyes === 'wide' ? 4.6 : 4;
    ctx.beginPath(); ellipse(ctx, ex, ey, 2.4, ry); ctx.fillStyle = '#fffdf6'; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ellipse(ctx, ex, ey, 2.4, ry); ctx.clip();
    ctx.fillStyle = spec.eyeCol ?? '#3b2a20'; ctx.beginPath(); ellipse(ctx, ex + 0.9, ey + 0.6, 1.8, 2.8); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ellipse(ctx, ex + 1.1, ey + 0.9, 1, 1.6); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + 0.4, ey - 0.6, 0.8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.strokeStyle = shade(H, -0.25); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(ex - 2, ey - 4.4 - p.brows); ctx.quadraticCurveTo(ex, ey - 5.4 - p.brows, ex + 2.2, ey - 4.2 - p.brows + (p.brows < 0 ? 1 : 0)); ctx.stroke();
  if (spec.glasses) { ctx.strokeStyle = '#5a3d2a'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(ex, ey, 3.2, 0, TAU); ctx.moveTo(ex - 3.2, ey); ctx.lineTo(hx - r * 0.2, ey - 0.5); ctx.stroke(); }
  // bouche
  const mx = hx + r * 0.72, my = hy + r * 0.62;
  ctx.strokeStyle = INK; ctx.lineWidth = 1;
  if (p.mouth === 'open' || p.mouth === 'talk' || p.mouth === 'o') { ctx.beginPath(); ellipse(ctx, mx, my, 1.4, p.mouth === 'open' ? 1.9 : 1.3); ctx.fillStyle = '#6b2a24'; ctx.fill(); ctx.stroke(); }
  else if (p.mouth === 'smile') { ctx.beginPath(); ctx.moveTo(mx - 2.4, my - 0.6); ctx.quadraticCurveTo(mx - 0.5, my + 1.6, mx + 1.4, my - 0.4); ctx.stroke(); }
  else { ctx.beginPath(); ctx.moveTo(mx - 2, my); ctx.lineTo(mx + 1, my); ctx.stroke(); }
  if (spec.blush !== false) { ctx.fillStyle = 'rgba(230,110,90,0.28)'; ctx.beginPath(); ellipse(ctx, hx + r * 0.35, hy + r * 0.42, 2, 1.2); ctx.fill(); }
  if (spec.mustache) { ctx.beginPath(); ctx.moveTo(hx + r * 0.95, hy + r * 0.42); ctx.quadraticCurveTo(hx + r * 0.6, hy + r * 0.75, hx + r * 0.25, hy + r * 0.55); ctx.quadraticCurveTo(hx + r * 0.6, hy + r * 0.45, hx + r * 0.95, hy + r * 0.42); ink(ctx, H, 0.8); }
  if (spec.beard) { ctx.beginPath(); ctx.moveTo(hx - r * 0.25, hy + r * 0.3); ctx.quadraticCurveTo(hx - r * 0.2, hy + r * 1.3, hx + r * 0.55, hy + r * 1.25); ctx.quadraticCurveTo(hx + r * 1.0, hy + r * 1.0, hx + r * 0.85, hy + r * 0.65); ctx.quadraticCurveTo(hx + r * 0.4, hy + r * 0.85, hx - r * 0.25, hy + r * 0.3); ctx.closePath(); ink(ctx, H, g.lw * 0.8); }
  // cheveux de profil : calotte, mèches du front vers l'avant, nuque en mèches
  if (spec.hairStyle !== 'bald') {
    const nape = spec.hairStyle === 'long' ? 1.6 : spec.hairStyle === 'braid' ? 0.75 : spec.hairStyle === 'bun' ? 0.5 : 0.7;
    if (spec.hairStyle === 'bun') { ctx.beginPath(); ctx.arc(hx - r * 0.6, hy - r * 0.95, r * 0.5, 0, TAU); ink(ctx, H, g.lw); }
    ctx.beginPath();
    ctx.moveTo(hx + r * 0.82, hy - r * 0.45);
    ctx.bezierCurveTo(hx + r * 0.8, hy - r * 1.45, hx - r * 1.3, hy - r * 1.4, hx - r * 1.1, hy + r * 0.15);
    ctx.quadraticCurveTo(hx - r * 1.05, hy + r * nape, hx - r * 0.8, hy + r * (nape + 0.1));
    ctx.lineTo(hx - r * 0.6, hy + r * (nape - 0.15)); ctx.lineTo(hx - r * 0.4, hy + r * (nape + 0.05));
    ctx.quadraticCurveTo(hx - r * 0.25, hy + r * 0.2, hx - r * 0.05, hy - r * 0.1);
    ctx.quadraticCurveTo(hx + r * 0.3, hy - r * 0.42, hx + r * 0.82, hy - r * 0.45);
    ctx.closePath();
    ink(ctx, H, g.lw, { shadeFn: () => ctx.rect(hx - r * 2, hy - r * 0.05, r * 1.6, r * 3), shadeCol: shade(H, -0.25) });
    ctx.strokeStyle = shade(H, 0.32); ctx.lineWidth = r * 0.13; ctx.beginPath(); ctx.arc(hx - r * 0.2, hy - r * 0.35, r * 0.68, Math.PI * 1.25, Math.PI * 1.6); ctx.stroke();
    // mèches du front
    if (spec.hairStyle === 'tousle') { ctx.beginPath(); ctx.moveTo(hx - 3, hy - r * 1.05); ctx.quadraticCurveTo(hx + 1, hy - r * 1.6, hx + 6, hy - r * 1.35); ctx.quadraticCurveTo(hx + 2, hy - r * 1.08, hx + 2, hy - r * 0.95); ctx.closePath(); ink(ctx, H, g.lw * 0.9); }
    if (spec.hairStyle === 'braid') { for (let k = 0; k < 5; k++) { ctx.beginPath(); ellipse(ctx, hx - r * 0.8 + (k % 2) * 0.8, hy + r * 0.85 + k * 3.6, 3, 2.5); ink(ctx, H, g.lw * 0.8); } }
    if (spec.hairStyle === 'curly') { for (let k = 0; k < 7; k++) { const a = Math.PI * 0.85 + (k / 6) * Math.PI * 0.95; ctx.beginPath(); ctx.arc(hx - r * 0.15 + Math.cos(a) * r * 0.95, hy - r * 0.15 + Math.sin(a) * r * 0.95, r * 0.36, 0, TAU); ink(ctx, H, g.lw * 0.8); } }
  }
  // oreille (devant la chevelure)
  ctx.beginPath(); ellipse(ctx, hx - r * 0.12, hy + r * 0.2, 2.6, 3.4); ink(ctx, shade(spec.skin, -0.04), g.lw * 0.8);
  ctx.strokeStyle = shade(spec.skin, -0.3); ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(hx - r * 0.1, hy + r * 0.2, 1.2, -1.2, 1.2); ctx.stroke();
  const c = spec.hatCol ?? '#4a5a7a';
  if (spec.hat === 'cap') { ctx.beginPath(); rrect(ctx, hx - r * 0.95, hy - r * 1.25, r * 1.8, r * 0.75, 3); ink(ctx, c, g.lw); ctx.beginPath(); ellipse(ctx, hx + r * 0.95, hy - r * 0.52, r * 0.55, 1.8); ink(ctx, shade(c, -0.3), g.lw); }
  if (spec.hat === 'flatcap') { ctx.beginPath(); ellipse(ctx, hx - 0.5, hy - r * 0.78, r * 1.08, r * 0.48); ink(ctx, c, g.lw); ctx.beginPath(); ellipse(ctx, hx + r * 0.85, hy - r * 0.5, r * 0.45, 1.7); ink(ctx, shade(c, -0.25), g.lw); }
  if (spec.hat === 'kettle') {
    ctx.beginPath(); ellipse(ctx, hx, hy - r * 0.5, r * 1.45, r * 0.3); ink(ctx, '#8d96a0', g.lw);
    ctx.beginPath(); ctx.moveTo(hx - r * 0.85, hy - r * 0.55); ctx.bezierCurveTo(hx - r * 0.9, hy - r * 1.55, hx + r * 0.9, hy - r * 1.55, hx + r * 0.85, hy - r * 0.55); ctx.closePath(); ink(ctx, '#a3acb5', g.lw);
  }
  if (spec.hat === 'hood') { ctx.beginPath(); ctx.moveTo(hx + r * 0.75, hy + r * 0.9); ctx.quadraticCurveTo(hx + r * 0.6, hy - r * 0.2, hx + r * 1.05, hy - r * 0.6); ctx.bezierCurveTo(hx + r * 0.9, hy - r * 1.7, hx - r * 1.5, hy - r * 1.5, hx - r * 1.35, hy + r * 1.1); ctx.closePath(); ink(ctx, c, g.lw, { shadeFn: () => ctx.rect(hx - r * 2, hy - r * 2, r * 1.6, r * 4) }); }
  if (spec.hat === 'kerchief') { ctx.beginPath(); ctx.moveTo(hx + r * 0.9, hy - r * 0.35); ctx.bezierCurveTo(hx + r * 0.8, hy - r * 1.4, hx - r * 1.2, hy - r * 1.4, hx - r * 1.05, hy - r * 0.1); ctx.lineTo(hx - r * 1.4, hy + r * 0.3); ctx.quadraticCurveTo(hx, hy - r * 0.5, hx + r * 0.9, hy - r * 0.35); ctx.closePath(); ink(ctx, c, g.lw); }
  if (spec.goggles) { ctx.fillStyle = '#6a4a32'; ctx.fillRect(hx - r, hy - r * 0.72, r * 1.9, 2.2); ctx.beginPath(); ctx.arc(hx + r * 0.6, hy - r * 0.62, 2.8, 0, TAU); ink(ctx, '#9fd2d8', 1); }
  ctx.restore();
}

// ---- accessoires
function scarf(ctx: Ctx, spec: CharSpec, g: G, p: Pose, view: Dir3) {
  if (!spec.scarf && !spec.shawl) return;
  const c = spec.accent ?? '#e0a630';
  if (spec.shawl) {
    if (view === 'right') { ctx.beginPath(); ctx.moveTo(g.cx - 6, g.shY - 1); ctx.quadraticCurveTo(g.cx + 6, g.shY - 3, g.cx + 6.5, g.shY + 2); ctx.lineTo(g.cx - 7, g.shY + 12); ctx.closePath(); ink(ctx, c, g.lw); return; }
    ctx.beginPath(); ctx.moveTo(g.cx - 8.5 * g.w, g.shY + 1); ctx.quadraticCurveTo(g.cx, g.shY - 3.5, g.cx + 8.5 * g.w, g.shY + 1); ctx.lineTo(g.cx + 5, g.shY + 9); ctx.lineTo(g.cx, g.shY + (view === 'up' ? 14 : 12)); ctx.lineTo(g.cx - 5, g.shY + 9); ctx.closePath();
    ink(ctx, c, g.lw, { shadeFn: () => ctx.rect(g.cx + 1, g.shY - 5, 20, 30) });
    ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(g.cx - 5, g.shY + 3); ctx.lineTo(g.cx + 5, g.shY + 3); ctx.stroke();
    return;
  }
  if (view === 'right') {
    ctx.beginPath(); ellipse(ctx, g.cx + 1 + p.lean * 5, g.shY + 0.5, 5.5, 2.6); ink(ctx, c, g.lw);
    const fl = 0.6 + p.coatFlap * 0.7;
    ctx.beginPath(); ctx.moveTo(g.cx - 3, g.shY + 0.5); ctx.quadraticCurveTo(g.cx - 7 - fl * 4, g.shY + 2, g.cx - 9 - fl * 6, g.shY + 4 - fl * 2); ctx.lineTo(g.cx - 8 - fl * 5, g.shY + 6.5 - fl * 2); ctx.quadraticCurveTo(g.cx - 5, g.shY + 4, g.cx - 2, g.shY + 3); ctx.closePath();
    ink(ctx, c, g.lw);
    return;
  }
  ctx.beginPath(); ellipse(ctx, g.cx, g.shY + 0.6, 7.2 * g.w, 2.9); ink(ctx, c, g.lw, { shadeFn: () => ctx.rect(g.cx + 2, g.shY - 3, 10, 8) });
  if (view === 'down') {
    ctx.beginPath(); ctx.moveTo(g.cx + 2, g.shY + 2); ctx.lineTo(g.cx + 4.5 + p.coatFlap, g.shY + 11); ctx.lineTo(g.cx + 1, g.shY + 10.5); ctx.lineTo(g.cx - 0.5, g.shY + 2.5); ctx.closePath();
    ink(ctx, shade(c, -0.08), g.lw);
    ctx.strokeStyle = shade(c, -0.35); ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(g.cx + 1.3, g.shY + 9); ctx.lineTo(g.cx + 4, g.shY + 9.4); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(g.cx - 1, g.shY + 2); ctx.lineTo(g.cx - 3 - p.coatFlap * 2, g.shY + 10); ctx.lineTo(g.cx + 0.5, g.shY + 10.5); ctx.lineTo(g.cx + 1.5, g.shY + 2); ctx.closePath(); ink(ctx, shade(c, -0.08), g.lw);
  }
}

function bag(ctx: Ctx, spec: CharSpec, g: G, view: Dir3, front: boolean) {
  if (!spec.bag && !spec.mailbag) return;
  const c = spec.bag ?? '#8a5a35';
  const big = spec.mailbag ? 1.35 : 1;
  if (view === 'down' && front) {
    ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(g.cx - 6.5 * g.w, g.shY + 0.5); ctx.lineTo(g.cx + 6 * g.w, g.hipY - 1); ctx.stroke();
    ctx.beginPath(); rrect(ctx, g.cx + 4.5 * g.w, g.hipY - 4.5, 7 * big, 7.5 * big, 2); ink(ctx, c, g.lw, { light: () => ctx.rect(g.cx + 4.5 * g.w, g.hipY - 4.5, 7 * big, 2.2) });
    if (spec.mailbag) { ctx.fillStyle = '#f2ead6'; ctx.fillRect(g.cx + 5.5 * g.w, g.hipY - 6, 3, 2.5); ctx.fillRect(g.cx + 8 * g.w, g.hipY - 6.5, 2.6, 2.5); }
    else { ctx.fillStyle = '#efe2c0'; ctx.beginPath(); ctx.arc(g.cx + 9.5 * g.w, g.hipY - 6.4, 1.4, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.7; ctx.stroke(); }
  }
  if (view === 'up' && front) {
    ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(g.cx + 6.5 * g.w, g.shY + 0.5); ctx.lineTo(g.cx - 6 * g.w, g.hipY - 1); ctx.stroke();
    ctx.beginPath(); rrect(ctx, g.cx - 11.5 * g.w, g.hipY - 4.5, 7 * big, 7.5 * big, 2); ink(ctx, c, g.lw);
    // rouleaux de cartes
    if (!spec.mailbag) { ctx.beginPath(); rrect(ctx, g.cx - 10 * g.w, g.hipY - 9, 2.6, 6, 1.2); ink(ctx, '#efe2c0', 0.8); }
  }
  if (view === 'right') {
    if (!front) return;
    ctx.beginPath(); rrect(ctx, g.cx - 8.5, g.hipY - 5, 6.5 * big, 7.5 * big, 2); ink(ctx, c, g.lw, { light: () => ctx.rect(g.cx - 8.5, g.hipY - 5, 7, 2) });
    if (!spec.mailbag) { ctx.beginPath(); rrect(ctx, g.cx - 7.5, g.hipY - 10, 2.6, 6, 1.2); ink(ctx, '#efe2c0', 0.8); }
  }
}

function item(ctx: Ctx, g: G, p: Pose, view: Dir3, hand?: [number, number]) {
  const it = p.item;
  if (!it) return;
  if (it.kind === 'atlas') {
    const o = it.open;
    if (view === 'up') return;
    const bx = view === 'right' ? g.cx + 7 + p.lean * 6 : g.cx, by = g.shY + 9;
    ctx.save(); ctx.translate(bx, by);
    if (o < 0.3) {
      ctx.beginPath(); rrect(ctx, -5, -4, 10, 8, 1.2); ink(ctx, '#6b3b2a', 1.2, { light: () => ctx.rect(-5, -4, 10, 1.6) });
      ctx.fillStyle = '#d9b25b'; ctx.beginPath(); ctx.arc(0, 0, 1.6, 0, TAU); ctx.fill();
    } else {
      const w = 5 + o * 4.5;
      ctx.beginPath(); ctx.moveTo(0, -3); ctx.quadraticCurveTo(-w * 0.5, -5, -w, -3.5); ctx.lineTo(-w, 4); ctx.quadraticCurveTo(-w * 0.5, 2.5, 0, 4.5); ctx.quadraticCurveTo(w * 0.5, 2.5, w, 4); ctx.lineTo(w, -3.5); ctx.quadraticCurveTo(w * 0.5, -5, 0, -3); ctx.closePath();
      ink(ctx, '#f4e7c6', 1.1);
      ctx.strokeStyle = '#b48a52'; ctx.lineWidth = 0.6;
      for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(-w + 1.5, -1.5 + k * 1.8); ctx.lineTo(-1.5, -1.2 + k * 1.8); ctx.stroke(); }
      if (o >= 1) { ctx.strokeStyle = '#d98a2b'; ctx.lineWidth = 0.9; ctx.setLineDash([1.2, 1]); ctx.beginPath(); ctx.moveTo(1.5, 2); ctx.quadraticCurveTo(4, -2, w - 1.5, -2); ctx.stroke(); ctx.setLineDash([]); }
      if (o >= 1) { ctx.fillStyle = 'rgba(255,214,120,0.55)'; ctx.beginPath(); ctx.arc(0, -2, 7, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }
  if (it.kind === 'staff') {
    const [hx, hy] = hand ?? [g.cx + 8, g.shY + 10];
    const a = it.angle;
    const L = 20;
    const dx = Math.cos(a) * L, dy = Math.sin(a) * L;
    ctx.beginPath(); capsule(ctx, hx - dx * 0.25, hy - dy * 0.25, hx + dx, hy + dy, 2.6, 2.2); ink(ctx, '#8a5a35', 1.1, { light: () => ctx.rect(hx - 30, hy - 30, 60, 30) });
    ctx.beginPath(); ctx.arc(hx + dx, hy + dy, 2.2, 0, TAU); ink(ctx, '#d9b25b', 1);
    if (it.reach) { ctx.strokeStyle = 'rgba(255,240,200,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, hy, L * 0.95, a - 1.2, a); ctx.stroke(); }
  }
}

/** Dessine un personnage complet pour une pose et une orientation, à l'échelle S (dans un canvas déjà positionné). */
export function drawCharacter(ctx: Ctx, spec: CharSpec, p: Pose, view: Dir3): void {
  const g = geom(spec, p);
  const shift = p.hurt ? -1.5 : 0;
  ctx.save();
  ctx.translate(shift, 0);
  if (view === 'down') {
    legFront(ctx, spec, g, p, -1); legFront(ctx, spec, g, p, 1);
    bag(ctx, spec, g, view, false);
    torsoFront(ctx, spec, g, p, false);
    armFront(ctx, spec, g, p, -1, false); armFront(ctx, spec, g, p, 1, false);
    scarf(ctx, spec, g, p, view);
    bag(ctx, spec, g, view, true);
    headFront(ctx, spec, g, p);
    item(ctx, g, p, view, [g.cx + 7.6 * g.w, g.shY + 10]);
  } else if (view === 'up') {
    item(ctx, g, p, view);
    legBack(ctx, spec, g, p, -1); legBack(ctx, spec, g, p, 1);
    armFront(ctx, spec, g, p, -1, true); armFront(ctx, spec, g, p, 1, true);
    torsoFront(ctx, spec, g, p, true);
    bag(ctx, spec, g, view, true);
    scarf(ctx, spec, g, p, view);
    headBack(ctx, spec, g, p);
  } else {
    armSide(ctx, spec, g, p, 0, true);
    legSide(ctx, spec, g, p, 0, true);
    legSide(ctx, spec, g, p, 1, false);
    bag(ctx, spec, g, view, true);
    torsoSide(ctx, spec, g, p);
    scarf(ctx, spec, g, p, view);
    headSide(ctx, spec, g, p);
    const hand = armSide(ctx, spec, g, p, 1, false);
    item(ctx, g, p, view, hand);
  }
  if (p.hurt) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,90,70,0.35)';
    ctx.fillRect(0, 0, FW, FH);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- planches de sprites
export interface SheetFrame { name: string; x: number; y: number; w: number; h: number }
export interface Sheet { canvas: HTMLCanvasElement; frames: SheetFrame[]; anims: { key: string; frames: string[]; rate: number; loop: boolean }[] }

export function buildSheet(spec: CharSpec, anims: AnimName[], S: number): Sheet {
  const dirs: Dir3[] = ['down', 'up', 'right'];
  let count = 0;
  for (const a of anims) count += ANIMS[a].frames * dirs.length;
  const fw = Math.ceil(FW * S), fh = Math.ceil(FH * S);
  const cols = Math.max(1, Math.floor(2048 / fw));
  const rows = Math.ceil(count / cols);
  const [cv, ctx] = canvas(cols * fw, rows * fh);
  const frames: SheetFrame[] = [];
  const out: Sheet['anims'] = [];
  let k = 0;
  for (const a of anims) {
    const def = ANIMS[a];
    for (const d of dirs) {
      const names: string[] = [];
      for (let i = 0; i < def.frames; i++) {
        const x = (k % cols) * fw, y = Math.floor(k / cols) * fh;
        ctx.save(); ctx.translate(x, y); ctx.scale(S, S);
        ctx.beginPath(); ctx.rect(0, 0, FW, FH); ctx.clip();
        drawCharacter(ctx, spec, def.pose(i, def.frames, d), d);
        ctx.restore();
        const name = `${a}_${d}_${i}`;
        frames.push({ name, x, y, w: fw, h: fh });
        names.push(name);
        k++;
      }
      out.push({ key: `${spec.id}_${a}_${d}`, frames: names, rate: def.rate, loop: def.loop });
    }
  }
  return { canvas: cv, frames, anims: out };
}

/** Portrait de dialogue (buste), rendu en grand. */
export function portrait(spec: CharSpec, mood: 'neutre' | 'joie' | 'souci' | 'surprise' | 'colere', size = 160): string {
  const [cv, ctx] = canvas(size, size);
  const g0 = ctx.createLinearGradient(0, 0, 0, size);
  g0.addColorStop(0, '#f6e7c4'); g0.addColorStop(1, '#e2c58f');
  ctx.fillStyle = g0; ctx.fillRect(0, 0, size, size);
  const p = basePose();
  if (mood === 'joie') { p.mouth = 'smile'; p.brows = 0.6; }
  if (mood === 'souci') { p.mouth = 'closed'; p.brows = 1; p.eyes = 'half'; p.tilt = 0.08; }
  if (mood === 'surprise') { p.mouth = 'o'; p.brows = 1.5; p.eyes = 'wide'; }
  if (mood === 'colere') { p.mouth = 'grit'; p.brows = -1.2; }
  const k = size / (spec.headR * 4.2);
  ctx.save();
  ctx.translate(size / 2, size * 0.95);
  ctx.scale(k, k);
  const g = geom(spec, p);
  ctx.translate(-g.cx, -(g.shY + 10));
  torsoFront(ctx, spec, g, p, false);
  scarf(ctx, spec, g, p, 'down');
  headFront(ctx, spec, g, p);
  ctx.restore();
  ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
  return cv.toDataURL();
}

export function shadowTexture(S: number): HTMLCanvasElement {
  const [cv, ctx] = canvas(40 * S, 16 * S);
  softShadow(ctx, 20 * S, 8 * S, 17 * S, 6.5 * S, 0.34);
  return cv;
}
