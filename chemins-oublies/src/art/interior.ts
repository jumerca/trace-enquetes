// Mobilier d'intérieur (auberge, atelier, archives, moulin) en vue trois quarts.
import { Ctx, ink, ellipse, rrect, shade, softShadow, INK, line, capsule } from './draw';
import { makeTex, PropTex } from './props';
import { Rng } from '../core/rng';

const TAU = Math.PI * 2;

function box(ctx: Ctx, w: number, h: number, top: number, col: string, topCol?: string) {
  ctx.beginPath(); ctx.rect(-w / 2, -h, w, h); ink(ctx, col, 1.5, { shadeFn: () => ctx.rect(w * 0.15, -h, w, h) });
  ctx.beginPath(); ctx.rect(-w / 2, -h - top, w, top); ink(ctx, topCol ?? shade(col, 0.15), 1.5);
}

/** Mur du fond d'une pièce (vue de face) avec plinthe, poutres et fenêtres. */
export function backWall(S: number, w: number, style: 'plaster' | 'stone' | 'wood', windows: number[], deco: string): PropTex {
  const H = 150;
  const r = new Rng(w + style.length); const rnd = () => r.next();
  return makeTex(w, H + 10, H, S, (ctx) => {
    const col = style === 'stone' ? '#9e978b' : style === 'wood' ? '#8a6040' : '#e4d6b8';
    ctx.beginPath(); ctx.rect(-w / 2, -H, w, H); ink(ctx, col, 3, { shadeFn: () => ctx.rect(-w / 2, -H, w, 18), shadeCol: shade(col, -0.25) });
    ctx.save(); ctx.beginPath(); ctx.rect(-w / 2, -H, w, H); ctx.clip();
    if (style === 'stone') { ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 1; for (let y = -H + 18; y < 0; y += 16) for (let x = -w / 2 + ((y / 16) % 2 ? 0 : 14); x < w / 2; x += 28) { ctx.beginPath(); rrect(ctx, x, y, 26, 14, 3); ctx.stroke(); } }
    if (style === 'wood') { ctx.strokeStyle = shade(col, -0.25); ctx.lineWidth = 1; for (let x = -w / 2; x < w / 2; x += 22) { ctx.beginPath(); ctx.moveTo(x, -H); ctx.lineTo(x, 0); ctx.stroke(); } }
    if (style === 'plaster') { ctx.fillStyle = shade(col, -0.06); for (let i = 0; i < 40; i++) { ctx.beginPath(); ellipse(ctx, -w / 2 + rnd() * w, -H + rnd() * H, 4 + rnd() * 8, 2 + rnd() * 3); ctx.fill(); } ctx.fillStyle = '#5a3a26'; for (let x = -w / 2 + 40; x < w / 2; x += 160) ctx.fillRect(x, -H, 10, H); ctx.fillRect(-w / 2, -H + 18, w, 9); }
    ctx.restore();
    // lambris bas
    ctx.fillStyle = '#6b4428'; ctx.fillRect(-w / 2, -42, w, 42);
    ctx.fillStyle = '#8a5a35'; ctx.fillRect(-w / 2, -42, w, 5);
    ctx.strokeStyle = '#4a2c18'; ctx.lineWidth = 1.4; for (let x = -w / 2 + 6; x < w / 2 - 20; x += 44) { ctx.beginPath(); ctx.roundRect(x, -32, 36, 26, 3); ctx.stroke(); }
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(-w / 2, -42, w, 42);
    // appliques murales
    for (const lx of [-w / 2 + 70, w / 2 - 70]) {
      ctx.beginPath(); rrect(ctx, lx - 3, -H + 70, 6, 14, 2); ink(ctx, '#3d3a3a', 1.6);
      ctx.beginPath(); ctx.moveTo(lx - 6, -H + 70); ctx.lineTo(lx + 6, -H + 70); ctx.lineTo(lx + 4, -H + 56); ctx.lineTo(lx - 4, -H + 56); ctx.closePath(); ink(ctx, '#ffd773', 1.6, { light: () => ctx.rect(lx - 4, -H + 56, 3, 14), lightCol: '#fff4c4' });
      const gl = ctx.createRadialGradient(lx, -H + 62, 2, lx, -H + 62, 34); gl.addColorStop(0, 'rgba(255,220,140,0.45)'); gl.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(lx, -H + 62, 34, 0, TAU); ctx.fill();
    }
    for (const wx of windows) {
      ctx.beginPath(); ctx.rect(wx - 22, -H + 40, 44, 52); ink(ctx, '#bfe0f0', 1.6, { light: () => { ctx.moveTo(wx - 22, -H + 92); ctx.lineTo(wx + 6, -H + 40); ctx.lineTo(wx + 22, -H + 40); ctx.lineTo(wx - 6, -H + 92); ctx.closePath(); }, lightCol: '#e6f4fa' });
      line(ctx, wx, -H + 40, wx, -H + 92, '#6b4a30', 2); line(ctx, wx - 22, -H + 66, wx + 22, -H + 66, '#6b4a30', 2);
      ctx.beginPath(); rrect(ctx, wx - 26, -H + 92, 52, 5, 1.5); ink(ctx, '#8a6040', 1);
    }
    if (deco === 'maps') {
      for (let i = 0; i < 3; i++) { const x = -w / 2 + 60 + i * 70; ctx.beginPath(); ctx.rect(x, -H + 36, 50, 38); ink(ctx, '#efe2c0', 1.1); ctx.strokeStyle = '#b48a52'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x + 6, -H + 60); ctx.quadraticCurveTo(x + 25, -H + 40, x + 44, -H + 58); ctx.stroke(); ctx.setLineDash([2, 2]); ctx.beginPath(); ctx.moveTo(x + 10, -H + 48); ctx.lineTo(x + 40, -H + 68); ctx.stroke(); ctx.setLineDash([]); }
    }
    if (deco === 'tools') {
      for (let i = 0; i < 6; i++) { const x = w / 2 - 200 + i * 26; line(ctx, x, -H + 40, x, -H + 80, '#6b4a30', 3); ctx.fillStyle = '#8d96a0'; ctx.fillRect(x - 5, -H + 76, 10, 7); }
      ctx.beginPath(); ctx.arc(-w / 2 + 120, -H + 70, 22, 0, TAU); ink(ctx, '#b07a3a', 1.4); for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-w / 2 + 120 + Math.cos(a) * 22, -H + 70 + Math.sin(a) * 22, 2.5, 0, TAU); ctx.fill(); }
    }
    if (deco === 'inn') {
      for (let i = 0; i < 5; i++) { const x = -w / 2 + 330 + i * 24; ctx.beginPath(); ctx.moveTo(x - 6, -H + 52); ctx.quadraticCurveTo(x, -H + 70, x + 6, -H + 52); ctx.closePath(); ink(ctx, '#c9a24a', 1); }
      line(ctx, -w / 2 + 320, -H + 50, -w / 2 + 450, -H + 50, '#5a3a26', 3);
      ctx.beginPath(); ctx.arc(w / 2 - 140, -H + 64, 18, 0, TAU); ink(ctx, '#d9d0bc', 1.4); line(ctx, w / 2 - 140, -H + 64, w / 2 - 140, -H + 52, INK, 1.2); line(ctx, w / 2 - 140, -H + 64, w / 2 - 132, -H + 64, INK, 1.2);
    }
    if (deco === 'gears') {
      for (const [x, y, rr] of [[-w / 2 + 120, -H + 70, 34], [-w / 2 + 175, -H + 100, 20]] as [number, number, number][]) { ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ink(ctx, '#7a5236', 1.6); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; ctx.beginPath(); rrect(ctx, x + Math.cos(a) * rr - 3, y + Math.sin(a) * rr - 3, 6, 6, 1); ink(ctx, '#8a6040', 1); } ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ink(ctx, '#4a4440', 1.2); }
    }
  });
}

export function counter(S: number, w = 220): PropTex {
  return makeTex(w + 20, 110, 96, S, (ctx) => {
    softShadow(ctx, 6, 0, w * 0.5, 10);
    box(ctx, w, 44, 16, '#8a5a35', '#a8784a');
    ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 1; for (let x = -w / 2 + 30; x < w / 2; x += 40) { ctx.strokeRect(x - 14, -38, 28, 28); }
    for (let i = 0; i < 4; i++) { const x = -w / 2 + 30 + i * 22; ctx.beginPath(); rrect(ctx, x - 5, -74, 10, 14, 2); ink(ctx, '#e0d4b0', 1); }
    ctx.beginPath(); ellipse(ctx, w / 2 - 40, -64, 14, 5); ink(ctx, '#c9a24a', 1.1);
    // tonneau à bière
    ctx.beginPath(); ellipse(ctx, w / 2 - 80, -68, 10, 12); ink(ctx, '#9a6234', 1.2);
  });
}

export function table(S: number, seed = 1): PropTex {
  const r = new Rng(seed);
  return makeTex(110, 80, 64, S, (ctx) => {
    softShadow(ctx, 4, 0, 46, 9);
    for (const x of [-36, 36]) { ctx.beginPath(); rrect(ctx, x - 3, -26, 6, 26, 1); ink(ctx, '#6b4a30', 1); }
    ctx.beginPath(); ellipse(ctx, 0, -28, 46, 16); ink(ctx, '#a8784a', 1.5, { shadeFn: () => ellipse(ctx, 6, -22, 46, 14), shadeCol: '#8a6040' });
    ctx.beginPath(); ellipse(ctx, 0, -32, 46, 16); ink(ctx, '#b88a55', 1.5);
    if (r.chance(0.7)) { ctx.beginPath(); rrect(ctx, -12, -46, 8, 12, 2); ink(ctx, '#e0d4b0', 1); ctx.beginPath(); ellipse(ctx, 10, -34, 8, 3.5); ink(ctx, '#f4ecd8', 1); }
    if (r.chance(0.6)) { ctx.beginPath(); rrect(ctx, 18, -48, 5, 14, 1.5); ink(ctx, '#f4ecd8', 0.8); ctx.fillStyle = '#ffcc55'; ctx.beginPath(); ellipse(ctx, 20.5, -51, 2, 3); ctx.fill(); }
  });
}

export function chair(S: number): PropTex {
  return makeTex(30, 50, 44, S, (ctx) => {
    softShadow(ctx, 2, 0, 11, 4);
    ctx.beginPath(); rrect(ctx, -9, -34, 18, 20, 2); ink(ctx, '#8a5a35', 1.2);
    ctx.beginPath(); rrect(ctx, -10, -16, 20, 6, 1.5); ink(ctx, '#a8784a', 1.2);
    for (const x of [-8, 8]) line(ctx, x, -10, x, 0, '#5a3a20', 2.4);
  });
}

export function fireplace(S: number, lit: boolean): PropTex {
  return makeTex(130, 160, 150, S, (ctx) => {
    ctx.beginPath(); ctx.rect(-56, -140, 112, 140); ink(ctx, '#a39d92', 1.8, { shadeFn: () => ctx.rect(20, -140, 40, 140), shadeCol: '#837d72' });
    ctx.strokeStyle = '#6f6a62'; ctx.lineWidth = 0.9; for (let y = -130; y < 0; y += 14) { ctx.beginPath(); ctx.moveTo(-56, y); ctx.lineTo(56, y); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(-36, 0); ctx.lineTo(-36, -50); ctx.quadraticCurveTo(0, -74, 36, -50); ctx.lineTo(36, 0); ctx.closePath(); ink(ctx, '#2a1e18', 1.6);
    ctx.beginPath(); rrect(ctx, -64, -80, 128, 10, 2); ink(ctx, '#7a5236', 1.3);
    if (lit) { ctx.beginPath(); ctx.moveTo(-18, -2); ctx.quadraticCurveTo(-20, -30, 0, -46); ctx.quadraticCurveTo(20, -30, 18, -2); ctx.closePath(); ink(ctx, '#f39a2e', 1.2, { light: () => ellipse(ctx, 0, -14, 8, 16), lightCol: '#ffe38a' }); }
    ctx.beginPath(); capsule(ctx, -20, -4, 20, -6, 6, 6); ink(ctx, '#6b4a30', 1);
  });
}

export function shelf(S: number, books: boolean, seed = 3): PropTex {
  const r = new Rng(seed); const rnd = () => r.next();
  return makeTex(110, 150, 140, S, (ctx) => {
    ctx.beginPath(); ctx.rect(-48, -130, 96, 130); ink(ctx, '#7a5236', 1.6, { shadeFn: () => ctx.rect(30, -130, 30, 130) });
    for (let s = 0; s < 4; s++) {
      const y = -120 + s * 30;
      ctx.fillStyle = '#4a3020'; ctx.fillRect(-42, y, 84, 26);
      if (books) { let x = -40; while (x < 38) { const bw = 5 + rnd() * 5, bh = 16 + rnd() * 8; ctx.beginPath(); ctx.rect(x, y + 26 - bh, bw, bh); ink(ctx, ['#8a3a32', '#3a5a7a', '#5f7d3c', '#c9a24a', '#6a4a7a'][Math.floor(rnd() * 5)], 0.7); x += bw + 0.5; } }
      else { for (let k = 0; k < 3; k++) { ctx.beginPath(); ellipse(ctx, -26 + k * 26, y + 18, 9, 8); ink(ctx, ['#d9b25b', '#9fb8b0', '#c56b3a'][k], 0.8); } }
      ctx.fillStyle = '#8a6040'; ctx.fillRect(-46, y + 26, 92, 4);
    }
  });
}

export function workbench(S: number): PropTex {
  return makeTex(170, 100, 84, S, (ctx) => {
    softShadow(ctx, 5, 0, 72, 10);
    for (const x of [-64, 64]) { ctx.beginPath(); rrect(ctx, x - 4, -40, 8, 40, 1); ink(ctx, '#6b4a30', 1); }
    ctx.beginPath(); ctx.rect(-74, -52, 148, 14); ink(ctx, '#a8784a', 1.5);
    ctx.beginPath(); ctx.rect(-74, -58, 148, 8); ink(ctx, '#b88a55', 1.3);
    ctx.beginPath(); rrect(ctx, -50, -70, 24, 12, 2); ink(ctx, '#8d96a0', 1.1);
    ctx.beginPath(); capsule(ctx, 10, -62, 40, -66, 3, 3); ink(ctx, '#7a5236', 1);
    ctx.beginPath(); rrect(ctx, 36, -72, 10, 8, 1); ink(ctx, '#6b6a68', 1);
    for (let k = 0; k < 4; k++) { ctx.fillStyle = '#c9a24a'; ctx.beginPath(); ctx.arc(-10 + k * 6, -60, 2, 0, TAU); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); }
  });
}

export function anvil(S: number): PropTex {
  return makeTex(60, 50, 44, S, (ctx) => {
    softShadow(ctx, 3, 0, 22, 5);
    ctx.beginPath(); rrect(ctx, -10, -22, 20, 22, 2); ink(ctx, '#6b4a30', 1.2);
    ctx.beginPath(); ctx.moveTo(-24, -32); ctx.lineTo(18, -32); ctx.lineTo(26, -26); ctx.lineTo(14, -22); ctx.lineTo(-18, -22); ctx.closePath(); ink(ctx, '#4a4a50', 1.3, { light: () => ctx.rect(-24, -32, 50, 3), lightCol: '#7a7a82' });
  });
}

export function mapTable(S: number): PropTex {
  return makeTex(160, 100, 80, S, (ctx) => {
    softShadow(ctx, 5, 0, 66, 10);
    for (const x of [-60, 60]) { ctx.beginPath(); rrect(ctx, x - 4, -36, 8, 36, 1); ink(ctx, '#6b4a30', 1); }
    ctx.beginPath(); ctx.moveTo(-70, -36); ctx.lineTo(70, -36); ctx.lineTo(60, -62); ctx.lineTo(-60, -62); ctx.closePath(); ink(ctx, '#8a5a35', 1.5);
    ctx.beginPath(); ctx.moveTo(-52, -40); ctx.lineTo(48, -40); ctx.lineTo(42, -58); ctx.lineTo(-46, -58); ctx.closePath(); ink(ctx, '#efe2c0', 1.1);
    ctx.strokeStyle = '#b48a52'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-40, -44); ctx.quadraticCurveTo(-10, -60, 20, -46); ctx.quadraticCurveTo(30, -42, 40, -52); ctx.stroke();
    ctx.fillStyle = '#4f86a6'; ctx.beginPath(); ellipse(ctx, -20, -50, 8, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(30, -52, 4, 0, TAU); ink(ctx, '#c9a24a', 0.9);
  });
}

export function desk(S: number): PropTex {
  return makeTex(130, 100, 84, S, (ctx) => {
    softShadow(ctx, 5, 0, 54, 9);
    box(ctx, 110, 34, 12, '#7a5236', '#9a6d45');
    for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(-30 + i * 16, -52); ctx.rotate(-0.2 + i * 0.15); ctx.beginPath(); ctx.rect(-8, -6, 16, 11); ink(ctx, '#f4ecd8', 0.8); ctx.restore(); }
    ctx.beginPath(); rrect(ctx, 22, -60, 8, 12, 2); ink(ctx, '#2a2a3a', 0.9); line(ctx, 26, -60, 34, -76, '#f4ecd8', 1.4);
    ctx.beginPath(); rrect(ctx, 38, -62, 6, 16, 1.5); ink(ctx, '#f4ecd8', 0.8); ctx.fillStyle = '#ffcc55'; ctx.beginPath(); ellipse(ctx, 41, -65, 2, 3); ctx.fill();
  });
}

export function millstone(S: number): PropTex {
  return makeTex(130, 100, 80, S, (ctx) => {
    softShadow(ctx, 5, 0, 56, 12);
    ctx.beginPath(); ctx.rect(-56, -30, 112, 30); ink(ctx, '#7a5236', 1.5, { shadeFn: () => ctx.rect(20, -30, 40, 30) });
    ctx.beginPath(); ellipse(ctx, 0, -30, 56, 16); ink(ctx, '#9a6d45', 1.4);
    ctx.beginPath(); ellipse(ctx, 0, -40, 44, 13); ink(ctx, '#a39d92', 1.4, { shadeFn: () => ctx.rect(-50, -38, 100, 12), shadeCol: '#837d72' });
    ctx.beginPath(); ellipse(ctx, 0, -48, 44, 13); ink(ctx, '#bdb5a8', 1.4);
    ctx.beginPath(); ellipse(ctx, 0, -48, 7, 3); ink(ctx, '#3a3530', 1);
    ctx.beginPath(); ctx.moveTo(-14, -84); ctx.lineTo(14, -84); ctx.lineTo(5, -56); ctx.lineTo(-5, -56); ctx.closePath(); ink(ctx, '#8a6040', 1.3); // trémie
  });
}

export function sacks(S: number): PropTex {
  return makeTex(80, 60, 52, S, (ctx) => {
    softShadow(ctx, 3, 0, 32, 6);
    for (const [x, y] of [[-16, 0], [14, 0], [0, -14]] as [number, number][]) { ctx.beginPath(); ctx.moveTo(x - 13, y); ctx.quadraticCurveTo(x - 16, y - 20, x - 6, y - 26); ctx.lineTo(x + 6, y - 26); ctx.quadraticCurveTo(x + 16, y - 20, x + 13, y); ctx.closePath(); ink(ctx, '#e0d4b0', 1.2, { shadeFn: () => ctx.rect(x + 3, y - 30, 20, 30), shadeCol: '#c4b68e' }); }
  });
}

export function brake(S: number, engaged: boolean): PropTex {
  return makeTex(70, 110, 100, S, (ctx) => {
    softShadow(ctx, 3, 0, 22, 6);
    ctx.beginPath(); rrect(ctx, -18, -30, 36, 30, 2); ink(ctx, '#6b4a30', 1.4);
    const a = engaged ? -1.25 : -0.35;
    const x2 = Math.cos(a) * 60, y2 = -24 + Math.sin(a) * 60;
    ctx.beginPath(); capsule(ctx, 0, -24, x2, y2, 7, 5); ink(ctx, '#8a5a35', 1.3);
    ctx.beginPath(); ctx.arc(x2, y2, 6, 0, TAU); ink(ctx, engaged ? '#c0523a' : '#5f8a42', 1.2);
    ctx.beginPath(); ctx.arc(0, -24, 5, 0, TAU); ink(ctx, '#4a4440', 1.1);
  });
}

export function stairs(S: number): PropTex {
  return makeTex(90, 170, 160, S, (ctx) => {
    for (let i = 0; i < 8; i++) { ctx.beginPath(); ctx.rect(-36, -18 * (i + 1), 72, 18); ink(ctx, i % 2 ? '#9a6d45' : '#a8784a', 1.2); }
    line(ctx, 40, 0, 40, -150, '#5a3a20', 4);
  });
}

export function barrelRack(S: number): PropTex {
  return makeTex(130, 80, 70, S, (ctx) => {
    softShadow(ctx, 4, 0, 56, 8);
    ctx.beginPath(); ctx.rect(-58, -12, 116, 12); ink(ctx, '#6b4a30', 1.2);
    for (const x of [-34, 0, 34]) { ctx.beginPath(); ctx.arc(x, -30, 18, 0, TAU); ink(ctx, '#9a6234', 1.3); ctx.beginPath(); ctx.arc(x, -30, 10, 0, TAU); ctx.strokeStyle = '#5a3a20'; ctx.lineWidth = 1; ctx.stroke(); ctx.fillStyle = '#3a2a20'; ctx.beginPath(); ctx.arc(x, -30, 2, 0, TAU); ctx.fill(); }
  });
}

export function rugTex(S: number, w: number, h: number): PropTex {
  return makeTex(w, h, h / 2, S, (ctx) => {
    ctx.beginPath(); rrect(ctx, -w / 2, -h / 2, w, h, 6); ink(ctx, '#8a3a32', 1.2);
    ctx.strokeStyle = '#d9b25b'; ctx.lineWidth = 2.5; ctx.beginPath(); rrect(ctx, -w / 2 + 8, -h / 2 + 8, w - 16, h - 16, 4); ctx.stroke();
    ctx.fillStyle = 'rgba(217,178,91,0.5)'; for (let x = -w / 2 + 24; x < w / 2 - 20; x += 22) for (let y = -h / 2 + 22; y < h / 2 - 18; y += 22) { ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill(); }
  });
}

export function plantPot(S: number): PropTex {
  const r = new Rng(12); const rnd = () => r.next();
  return makeTex(40, 60, 54, S, (ctx) => {
    softShadow(ctx, 2, 0, 13, 4);
    for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + (rnd() - 0.5) * 2; ctx.beginPath(); ellipse(ctx, Math.cos(a) * 9, -22 + Math.sin(a) * 12, 4, 9, a + Math.PI / 2); ink(ctx, '#5c9a45', 0.8); }
    ctx.beginPath(); ctx.moveTo(-10, -18); ctx.lineTo(10, -18); ctx.lineTo(7, 0); ctx.lineTo(-7, 0); ctx.closePath(); ink(ctx, '#c56b3a', 1.2);
  });
}
