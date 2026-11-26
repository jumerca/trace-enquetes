import { drawCharacter, type Look } from '../render/art';
const cv = document.getElementById('c') as HTMLCanvasElement;
cv.width = 1300; cv.height = 900;
const ctx = cv.getContext('2d')!;
ctx.fillStyle = '#e9dfc9'; ctx.fillRect(0, 0, cv.width, cv.height);
const ERAS = [1976, 1986, 1996, 2006, 2016, 2025];
const looks: Look[] = ['civil', 'civil', 'civil', 'civil', 'civil', 'civil', 'uniforme', 'costume', 'blouse', 'civil', 'civil', 'uniforme'];
ERAS.forEach((y, e) => {
  ctx.fillStyle = '#333'; ctx.font = '16px sans-serif'; ctx.fillText(String(y), 6, e * 148 + 80);
  for (let i = 0; i < 12; i++) {
    ctx.save(); ctx.translate(60 + i * 103, e * 148); ctx.scale(2, 2);
    drawCharacter(ctx, { a: { skin: i % 6, hair: i % 7, hairStyle: i % 8, outfit: i, build: i % 3, glasses: i % 4 === 1, beard: i % 5 === 2 }, sexe: i % 2 ? 'F' : 'M', look: looks[i], era: y }, i === 10 ? 'phone' : 'idle', 0, false);
    ctx.restore();
  }
});
