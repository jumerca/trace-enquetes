import { drawVehicle } from '../render/art';
const cv = document.getElementById('c') as HTMLCanvasElement; cv.width = 1300; cv.height = 900;
const ctx = cv.getContext('2d')!; ctx.fillStyle = '#c9c1ad'; ctx.fillRect(0, 0, 1300, 900);
const ERAS = [1978, 1990, 2000, 2010, 2018, 2024];
for (let e = 0; e < 6; e++) for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(20 + i * 300, e * 145); ctx.scale(2.2, 2.2); drawVehicle(ctx, { body: ['#e8e4da', '#6b7a8f', '#7a2e2e', '#e8e4da'][i], kind: (['fourgon', 'banalisee', 'civil', 'banalisee'] as const)[i], police: i !== 2, era: ERAS[e], lights: i === 1 }, i === 3 ? 'nx' : 'px'); ctx.restore(); ctx.fillStyle = '#000'; ctx.fillText(String(ERAS[e]), 4, e * 145 + 12); }
