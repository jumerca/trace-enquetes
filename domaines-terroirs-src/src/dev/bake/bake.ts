// Page de cuisson des sprites de véhicules : rend tous les modèles en 8 directions et les empaquette.
import { LIVERIES, car, combine, grapeHarvester, livestockTruck, plough, seeder, shoot, sprayer, spreader, tractor, trailer, van, type Load, type Shot } from './vehicles3d';
import * as THREE from 'three';
import { PEOPLE, animal, person } from './living3d';

const SET = new URLSearchParams(location.search).get('set') ?? 'vehicules';

const RES = 1.6;
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
  } else if (tool === 'epandeur') {
    const t = spreader(phase);
    t.position.x = -1.08;
    g.add(t);
  } else if (tool === 'pulverisateur') {
    const t = sprayer(phase);
    t.position.x = -1.0;
    g.add(t);
  }
  // recentre l'attelage pour que l'ancre soit au milieu de l'ensemble
  const bb = new THREE.Box3().setFromObject(g);
  const mid = (bb.min.x + bb.max.x) / 2;
  for (const c of g.children) c.position.x -= mid;
  return g;
}

const TOOLS = SET !== 'vehicules' ? [] : ['seul', 'remorque-vide', 'remorque-ble', 'remorque-pommes', 'remorque-foin', 'charrue', 'semoir', 'epandeur', 'pulverisateur'];
for (let d = 0; d < 8 && SET === 'vehicules'; d++) {
  for (let f = 0; f < 2; f++) {
    for (const livery of ['rouge', 'vert', 'bleu'] as const)
      for (const tool of TOOLS) {
        // roues animées (2 images) pour toutes les livrées ; remorques fruits/foin seulement en rouge
        if (livery !== 'rouge' && (tool === 'remorque-pommes' || tool === 'remorque-foin')) continue;
        shots.push(shoot(`tracteur:${livery}:${tool}:${d}:${f}`, rig(livery, tool, PH[f]), d, RES));
      }
    shots.push(shoot(`moissonneuse:${d}:${f}`, combine(PH[f]), d, RES));
    shots.push(shoot(`vendangeuse:${d}:${f}`, grapeHarvester(PH[f]), d, RES));
    shots.push(shoot(`betaillere:${d}:${f}`, livestockTruck(PH[f]), d, RES));
    shots.push(shoot(`camionnette:${d}:${f}`, van(PH[f]), d, RES));
    [0xb8443a, 0x3f6a8a, 0xe8e2d0].forEach((c, i) => shots.push(shoot(`voiture:${i}:${d}:${f}`, car(c, PH[f]), d, RES)));
  }
}

if (SET === 'vivants') {
  for (let d = 0; d < 8; d++) {
    for (const [k, look] of Object.entries(PEOPLE)) for (let fr = 0; fr < 5; fr++) shots.push(shoot(`pp:${k}:${d}:${fr}`, person(look, fr), d, RES));
    for (const kind of ['vache', 'chevre', 'brebis', 'cochon', 'canard', 'poule'])
      for (let l = 0; l < 3; l++) for (let fr = 0; fr < 4; fr++) shots.push(shoot(`aa:${kind}:${l}:${d}:${fr}`, animal(kind, l, fr), d, RES));
  }
}

// empaquetage par étagères, sur plusieurs pages de 2048×2048 (limite sûre des GPU mobiles)
const PAGE = 2048;
shots.sort((a, b) => b.canvas.height - a.canvas.height);
const pages: HTMLCanvasElement[] = [];
const frames: Record<string, { p: number; x: number; y: number; w: number; h: number; ax: number; ay: number }> = {};
let x = 0, y = 0, rowH = 0;
const newPage = () => {
  const c = document.createElement('canvas');
  c.width = PAGE;
  c.height = PAGE;
  pages.push(c);
  x = 0;
  y = 0;
  rowH = 0;
};
newPage();
for (const s of shots) {
  if (x + s.canvas.width + 2 > PAGE) {
    x = 0;
    y += rowH + 2;
    rowH = 0;
  }
  if (y + s.canvas.height > PAGE) newPage();
  frames[s.key] = { p: pages.length - 1, x, y, w: s.canvas.width, h: s.canvas.height, ax: s.ax, ay: s.ay };
  pages[pages.length - 1].getContext('2d')!.drawImage(s.canvas, x, y);
  x += s.canvas.width + 2;
  rowH = Math.max(rowH, s.canvas.height);
}
// la dernière page est réduite à la hauteur utile
const last = pages[pages.length - 1];
const usedH = Math.pow(2, Math.ceil(Math.log2(y + rowH + 2)));
if (usedH < PAGE) {
  const c = document.createElement('canvas');
  c.width = PAGE;
  c.height = usedH;
  c.getContext('2d')!.drawImage(last, 0, 0);
  pages[pages.length - 1] = c;
}
for (const p of pages) document.body.appendChild(p);
(window as unknown as { baked: unknown }).baked = { pngs: pages.map((p) => p.toDataURL('image/png')), json: { res: RES, pages: pages.length, frames } };
