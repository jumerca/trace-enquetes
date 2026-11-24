// Page de cuisson des sprites de véhicules : rend tous les modèles en 8 directions et les empaquette.
import { LIVERIES, car, coach, pickup, tedder, lifter, combine, grapeHarvester, livestockTruck, plough, seeder, shoot, sprayer, spreader, tractor, trailer, van, type Load, type Shot } from './vehicles3d';
import * as THREE from 'three';
import { PEOPLE, animal, person } from './living3d';
import { fruitTree, tree } from './nature3d';
import { CROP3D, cropTile } from './crops3d';
import { buildingModel, buildingSize, regionStyle, shootBuilding } from './buildings3d';
import { BUILDINGS } from '../../data/content';
import { REGIONS } from '../../data/regions';

const Q = new URLSearchParams(location.search);
const SET = Q.get('set') ?? 'vehicules';

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
  } else if (tool === 'faneuse') {
    const t = tedder(phase);
    t.position.x = -0.85;
    g.add(t);
  } else if (tool === 'arracheuse') {
    const t = lifter(phase);
    t.position.x = -0.95;
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

const TOOLS = SET !== 'vehicules' ? [] : ['seul', 'remorque-vide', 'remorque-ble', 'remorque-pommes', 'remorque-foin', 'charrue', 'semoir', 'epandeur', 'pulverisateur', 'faneuse', 'arracheuse'];
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
    shots.push(shoot(`bus:${d}:${f}`, coach(PH[f]), d, RES));
    shots.push(shoot(`utilitaire:${d}:${f}`, pickup(PH[f]), d, RES));
    [0xb8443a, 0x3f6a8a, 0xe8e2d0].forEach((c, i) => shots.push(shoot(`voiture:${i}:${d}:${f}`, car(c, PH[f]), d, RES)));
  }
}

if (SET === 'vivants') {
  for (let d = 0; d < 8; d++) {
    for (const [k, look] of Object.entries(PEOPLE)) for (let fr = 0; fr < 5; fr++) shots.push(shoot(`pp:${k}:${d}:${fr}`, person(look, fr), d, RES));
    for (const kind of ['vache', 'limousine', 'chevre', 'brebis', 'cochon', 'canard', 'poule', 'cheval', 'ane', 'oie', 'lapin', 'dinde', 'pintade', 'caille', 'alpaga', 'cerf'])
      for (let l = 0; l < 3; l++) for (let fr = 0; fr < 4; fr++) shots.push(shoot(`aa:${kind}:${l}:${d}:${fr}`, animal(kind, l, fr), d, RES));
  }
}

if (SET === 'batiments') {
  // une planche par région : chaque bâtiment dans les deux orientations, plus le calque neige des toits
  const region = REGIONS.find((r) => r.id === Q.get('region')) ?? REGIONS[0];
  const st = regionStyle(region.architecture);
  const types = Object.values(BUILDINGS).filter((b) => !['verger', 'champ', 'enclos'].includes(b.kind)).map((b) => b.id);
  for (const t of types) {
    const s = BUILDINGS[t].size;
    shots.push(...shootBuilding(`b:${t}`, buildingModel(t, st, s, (s >> 1) + 0.5), s, RES));
    const g = new THREE.Group();
    const m = buildingModel(t, st, s, s - (s >> 1) - 0.5);
    m.rotation.y = Math.PI / 2;
    m.position.z = s;
    g.add(m);
    shots.push(...shootBuilding(`b:${t}:m`, g, s, RES));
  }
  for (const t of ['abri', 'etable', 'bergerie', 'ecurie', 'poulailler', 'porcherie', 'clapier', 'etang', 'serre', 'hameau0', 'hameau1', 'hameau2', 'hameau3']) {
    const s = buildingSize(t);
    shots.push(...shootBuilding(`b:${t}`, buildingModel(t, st, s, (s >> 1) + 0.5), s, RES, t !== 'etang'));
  }
}

if (SET === 'nature') {
  // arbres du paysage et des vergers, pour chaque saison
  const SPECIES: Record<string, number> = { chene: 3, chataignier: 3, noyer: 2, pin: 2, bouleau: 2, buisson: 3, cypres: 1, sapin: 2, epicea: 2, hetre: 2, peuplier: 2, olivier: 2, haie: 2 };
  const LOOKS = ['pommier', 'poirier', 'prunier', 'mirabellier', 'cerisier', 'abricotier', 'noyer', 'chataignier', 'truffier', 'olivier', 'vigne', 'noisetier', 'pecher', 'figuier', 'amandier', 'framboisier', 'myrtillier', 'citronnier'];
  for (const season of [0, 1, 2, 3] as const) {
    for (const [sp, n] of Object.entries(SPECIES)) for (let v = 0; v < n; v++) {
      const t = tree(sp, v, season);
      t.scale.setScalar(sp === 'buisson' || sp === 'haie' ? 1.25 : 1.4);
      shots.push(shoot(`tree:${sp}:${v}:s${season}`, t, 0, RES));
    }
    for (const look of LOOKS) for (let f = 0; f < 4; f++) for (let v = 0; v < 2; v++) {
      const t = fruitTree(look, f, v, season);
      t.scale.setScalar(look === 'vigne' || look === 'framboisier' || look === 'myrtillier' ? 1 : 1.2);
      shots.push(shoot(`fruit:${look}:${f}:${v}:s${season}`, t, 0, RES));
    }
  }
}

if (SET === 'cultures') {
  for (const look of CROP3D) for (const st of [2, 3, 4]) for (let v = 0; v < 2; v++) shots.push(shoot(`crop:${look}:${st}:${v}`, cropTile(look, st, v), 0, RES));
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
// WebP (avec transparence) : planches 5 fois plus légères que le PNG
const EXT = SET === 'vehicules' ? 'png' : 'webp';
(window as unknown as { baked: unknown }).baked = { ext: EXT, pngs: pages.map((p) => (EXT === 'png' ? p.toDataURL('image/png') : p.toDataURL('image/webp', 0.84))), json: { res: RES, pages: pages.length, ext: EXT, frames } };
