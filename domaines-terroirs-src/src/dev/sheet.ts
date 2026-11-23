// Planche-contact des assets (outil de développement, non inclus dans le build).
import * as P from '../render/paint';
const season = Number(new URLSearchParams(location.search).get('s') ?? 1) as P.Season;
const c = document.getElementById('c') as HTMLCanvasElement;
c.width = 1400; c.height = 1000;
const ctx = c.getContext('2d')!;
ctx.fillStyle = '#556b3a'; ctx.fillRect(0, 0, c.width, c.height);
const put = (p: P.Painted, x: number, y: number) => ctx.drawImage(p.canvas, x - p.ax, y - p.ay, p.canvas.width / P.RES, p.canvas.height / P.RES);
// sol : 6×6 cases avec chemin, eau et champ
const kinds: P.TileKind[] = ['herbe', 'pre', 'bois', 'cour', 'verger', 'enclos'];
for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 8; gx++) {
  const [x, y] = P.iso(300, 20, gx, gy);
  let t: HTMLCanvasElement;
  if (gy === 3) t = P.paintTile('chemin', gx, season, 1 | 4);
  else if (gx === 5) t = P.paintTile('route', gy, season, 2 | 8 | (gy === 3 ? 5 : 0));
  else if (gx >= 6) t = P.paintTile('eau', gy, season, (gx === 6 ? 1 : 4) | (gy > 0 ? 8 : 0) | (gy < 7 ? 2 : 0) | (gx === 6 ? 0 : 0));
  else if (gy >= 6) t = P.paintTile('champ', gx, season, 0, gx % 6);
  else t = P.paintTile(kinds[(gx + gy) % 6], gx + gy, season);
  ctx.drawImage(t, x - 32 - 1, y - 1, t.width / P.RES, t.height / P.RES);
}
const trees = ['chene', 'chataignier', 'noyer', 'pin', 'bouleau', 'cypres', 'buisson', 'pommier'] as const;
trees.forEach((sp, i) => put(P.paintTree(sp, i, season, 3), 60 + i * 80, 420));
put(P.paintRock(1, season), 700, 420); put(P.paintFlowers(1, season), 760, 420);
const bs = ['maison', 'grange', 'hangar', 'pressoir', 'fromagerie', 'moulin', 'boulangerie', 'boutique', 'accueil', 'hameau0', 'hameau1', 'abri'];
bs.forEach((b, i) => { const p = P.paintBuilding(b); put(p, 110 + (i % 6) * 220, 520 + Math.floor(i / 6) * 220 - 60); });
Object.values(P.ROLE_LOOKS).concat(P.VISITOR_LOOKS).forEach((l, i) => { for (let f = 0; f < 5; f++) put(P.paintPerson(l, (f % 2) as 0 | 1, f), 900 + f * 30, 60 + i * 40); });
put(P.paintGoat(0, 0, 0), 1100, 80); put(P.paintGoat(1, 1, 1), 1140, 80); put(P.paintHen(1, 0), 1180, 80);
put(P.paintTractor(0, true), 1120, 180); put(P.paintTractor(1, false), 1220, 180); put(P.paintVan(0), 1120, 260); put(P.paintCar(0), 1220, 260);
put(P.paintFence(15, season), 1300, 100);
(window as any).ready = true;
