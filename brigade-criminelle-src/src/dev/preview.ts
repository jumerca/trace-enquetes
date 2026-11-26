import { drawCharacter, drawPortrait, drawVehicle, type Look, type Pose } from '../render/art';
const ctx = (document.getElementById('c') as HTMLCanvasElement).getContext('2d')!;
const looks: Look[] = ['civil', 'uniforme', 'blouse', 'costume', 'robe', 'medecin', 'presse', 'civil'];
const poses: Pose[] = ['idle', 'walk', 'run', 'sit', 'type', 'phone', 'read', 'talk', 'carry'];
for (let i = 0; i < 8; i++) for (let j = 0; j < 9; j++) {
  ctx.save(); ctx.translate(j * 70, i * 60); ctx.scale(0.8, 0.8);
  drawCharacter(ctx, { a: { skin: i % 6, hair: i, hairStyle: (i + j) % 8, outfit: i + j, build: i % 3, glasses: i % 3 === 0, beard: i === 2 }, sexe: i % 2 ? 'F' : 'M', look: looks[i] }, poses[j], j, j === 8 && i % 2 === 1);
  ctx.restore();
}
const ERAS = [1978, 1990, 2000, 2010, 2018, 2024]; for (let e = 0; e < 6; e++) for (let i = 0; i < 3; i++) { ctx.save(); ctx.translate(650 + i * 110, e * 95 - 10); drawVehicle(ctx, { body: ['#e8e4da', '#6b7a8f', '#7a2e2e'][i], kind: (['fourgon', 'banalisee', 'civil'] as const)[i], police: i < 2, era: ERAS[e], lights: i === 1 }, 'px'); ctx.restore(); }
for (let i = 0; i < 4; i++) { ctx.save(); ctx.translate(660 + i * 100, 220); drawPortrait(ctx, { a: { skin: i, hair: i + 1, hairStyle: i * 2, outfit: i, build: 1, glasses: i === 1, beard: i === 2 }, sexe: i % 2 ? 'F' : 'M', look: 'civil' }, 90); ctx.restore(); }
