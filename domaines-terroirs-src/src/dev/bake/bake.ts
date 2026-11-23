// Page de cuisson des sprites de véhicules : rend tous les modèles en 8 directions et les empaquette.
import { LIVERIES, car, combine, plough, seeder, shoot, tractor, trailer, van, type Load, type Shot } from './vehicles3d';
import * as THREE from 'three';

const RES = 2;
const shots: Shot[] = [];
const PH = [0, 0.5]; // deux images d'animation des roues

function rig(livery: keyof typeof LIVERIES, tool: string, phase: number) {
  const g = new THREE.Group();
  g.add(tractor(LIVERIES[livery], phase));
  if (tool.startsWith('remorque')) {
    const t = trailer(tool.split('-')[1] as Load, phase);
    t.position.x = -1.08;
    g.add(t);
  } else if (tool === 'charrue') {
    const t = plough();
    t.position.x = -0.95;
    g.add(t);
  } else if (tool === 'semoir') {
    const t = seeder(phase);
    t.position.x = -0.78;
    g.add(t);
  }
  // recentre l'attelage pour que l'ancre soit au milieu de l'ensemble
  const bb = new THREE.Box3().setFromObject(g);
  const mid = (bb.min.x + bb.max.x) / 2;
  for (const c of g.children) c.position.x -= mid;
  return g;
}

for (let d = 0; d < 8; d++) {
  for (let f = 0; f < 2; f++) {
    for (const tool of ['seul', 'remorque-vide', 'remorque-ble', 'remorque-pommes', 'remorque-foin', 'charrue', 'semoir']) {
      shots.push(shoot(`tracteur:rouge:${tool}:${d}:${f}`, rig('rouge', tool, PH[f]), d, RES));
    }
    shots.push(shoot(`tracteur:vert:seul:${d}:${f}`, rig('vert', 'seul', PH[f]), d, RES));
    shots.push(shoot(`moissonneuse:${d}:${f}`, combine(PH[f]), d, RES));
    shots.push(shoot(`camionnette:${d}:${f}`, van(PH[f]), d, RES));
    [0xb8443a, 0x3f6a8a, 0xe8e2d0].forEach((c, i) => shots.push(shoot(`voiture:${i}:${d}:${f}`, car(c, PH[f]), d, RES)));
  }
}

// empaquetage par étagères
const PAGE_W = 2048;
shots.sort((a, b) => b.canvas.height - a.canvas.height);
let x = 0, y = 0, rowH = 0;
const frames: Record<string, { x: number; y: number; w: number; h: number; ax: number; ay: number }> = {};
for (const s of shots) {
  if (x + s.canvas.width + 2 > PAGE_W) {
    x = 0;
    y += rowH + 2;
    rowH = 0;
  }
  frames[s.key] = { x, y, w: s.canvas.width, h: s.canvas.height, ax: s.ax, ay: s.ay };
  x += s.canvas.width + 2;
  rowH = Math.max(rowH, s.canvas.height);
}
const page = document.createElement('canvas');
page.width = PAGE_W;
page.height = y + rowH;
const ctx = page.getContext('2d')!;
for (const s of shots) ctx.drawImage(s.canvas, frames[s.key].x, frames[s.key].y);
document.body.appendChild(page);
page.style.background = '#7a9a4a';
(window as unknown as { baked: unknown }).baked = { png: page.toDataURL('image/png'), json: { res: RES, width: page.width, height: page.height, frames } };
