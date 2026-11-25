// Commissariat constructible : pièces sur plusieurs étages, portes, mobilier avec collisions,
// grille de navigation (A*) et capacités fonctionnelles de chaque pièce.
import { astar } from './city';
import type { Furniture, GameState, Room, RoomType, Station } from './types';

export const SW = 22, SH = 14;

export interface RoomDef { label: string; cost: number; minArea: number; color: number; floorTex: 'parquet' | 'carrelage' | 'lino' | 'beton' | 'moquette'; desc: string; effect: string }

export const ROOM_DEFS: Record<RoomType, RoomDef> = {
  accueil: { label: 'Accueil', cost: 900, minArea: 12, color: 0xd8c9a8, floorTex: 'carrelage', desc: 'Réception du public et des plaignants.', effect: 'Satisfaction des personnes accueillies, prise de plainte.' },
  commandant: { label: 'Bureau du commandant', cost: 1200, minArea: 9, color: 0xa88b6a, floorTex: 'parquet', desc: 'Bureau de direction.', effect: 'Supervision : +10 % sur la qualité des décisions assistées.' },
  bureaux: { label: 'Bureaux d\'enquête', cost: 800, minArea: 9, color: 0xc2b49a, floorTex: 'moquette', desc: 'Postes de travail des enquêteurs.', effect: 'Un poste par bureau : sans poste, le travail de bureau est ralenti de 30 %.' },
  briefing: { label: 'Salle de briefing', cost: 1000, minArea: 12, color: 0xb9a98c, floorTex: 'moquette', desc: 'Réunions d\'équipe et recoupements.', effect: '+15 % sur les recoupements ; améliore le travail collectif.' },
  interrogatoire: { label: 'Salle d\'entretien et d\'interrogatoire', cost: 1100, minArea: 6, color: 0x9fa4a8, floorTex: 'lino', desc: 'Entretiens et auditions.', effect: 'Une audition à la fois par salle.' },
  archives: { label: 'Archives', cost: 900, minArea: 9, color: 0xb3a58a, floorTex: 'beton', desc: 'Dossiers papier et registres.', effect: '+20 % sur les recherches documentaires ; dossiers anciens.' },
  labo: { label: 'Laboratoire scientifique', cost: 4000, minArea: 12, color: 0xd9e2e6, floorTex: 'carrelage', desc: 'Analyses techniques internes.', effect: 'Une analyse simultanée par paillasse.' },
  informatique: { label: 'Salle informatique', cost: 3000, minArea: 9, color: 0xc9d0d6, floorTex: 'lino', desc: 'Serveurs et postes d\'exploitation.', effect: '+15 % sur les recherches et analyses numériques (selon l\'époque).' },
  preuves: { label: 'Salle sécurisée des preuves', cost: 1800, minArea: 6, color: 0x8f8a80, floorTex: 'beton', desc: 'Conservation des scellés.', effect: '12 scellés par armoire ; au-delà, risque de rupture de traçabilité.' },
  radio: { label: 'Local radio', cost: 1500, minArea: 6, color: 0xa7a08f, floorTex: 'lino', desc: 'Liaisons avec les équipages.', effect: 'Réduit les délais d\'intervention sur le terrain.' },
  vestiaires: { label: 'Vestiaires', cost: 700, minArea: 6, color: 0xb0b7ad, floorTex: 'carrelage', desc: 'Casiers et douches.', effect: 'Petit bonus de moral.' },
  repos: { label: 'Salle de repos', cost: 900, minArea: 9, color: 0xc7b8a0, floorTex: 'moquette', desc: 'Canapés pour la récupération.', effect: 'Récupération de la fatigue pendant le service.' },
  cafeteria: { label: 'Cafétéria', cost: 1300, minArea: 12, color: 0xd6c3a0, floorTex: 'carrelage', desc: 'Repas et échanges informels.', effect: 'Moral et relations entre collègues.' },
  garage: { label: 'Garage', cost: 2500, minArea: 20, color: 0x8a8d90, floorTex: 'beton', desc: 'Stationnement et entretien des véhicules.', effect: 'Un emplacement par véhicule ; entretien réduit l\'usure.' },
  formation: { label: 'Salle de formation', cost: 1600, minArea: 12, color: 0xbfb294, floorTex: 'moquette', desc: 'Stages internes.', effect: 'Formations internes moins coûteuses.' },
  supervision: { label: 'Centre de supervision', cost: 5000, minArea: 12, color: 0x6f7880, floorTex: 'lino', desc: 'Pilotage des opérations.', effect: 'Alertes plus précoces ; meilleure coordination.' },
  ancien: { label: 'Cellule des affaires anciennes', cost: 1500, minArea: 9, color: 0xa69a83, floorTex: 'parquet', desc: 'Réexamen des dossiers non élucidés.', effect: 'Permet la réouverture méthodique de dossiers classés.' },
  financiere: { label: 'Unité financière', cost: 2000, minArea: 9, color: 0xbdb197, floorTex: 'moquette', desc: 'Analyse comptable et financière.', effect: '+20 % sur les réquisitions et recherches des affaires financières.' },
  numerique: { label: 'Unité numérique', cost: 3500, minArea: 9, color: 0xaeb8c2, floorTex: 'lino', desc: 'Exploitation des supports numériques.', effect: 'Analyses numériques internes (selon l\'époque).' },
  liaison: { label: 'Bureau de liaison avec la justice', cost: 1200, minArea: 6, color: 0xb8a37e, floorTex: 'parquet', desc: 'Relation quotidienne avec le parquet.', effect: 'Délais de réponse judiciaires réduits de 25 %.' },
  administratif: { label: 'Bureau administratif', cost: 800, minArea: 6, color: 0xc4b79c, floorTex: 'moquette', desc: 'Secrétariat, gestion du personnel.', effect: 'Accélère la frappe des procédures et les demandes de moyens.' },
  couloir: { label: 'Couloir', cost: 150, minArea: 2, color: 0xcfc7b6, floorTex: 'lino', desc: 'Circulation.', effect: 'Relie les pièces.' },
  escalier: { label: 'Escalier', cost: 2000, minArea: 4, color: 0xa9a294, floorTex: 'beton', desc: 'Relie les étages.', effect: 'Accès aux étages.' },
};

export const BUILDABLE: RoomType[] = ['bureaux', 'interrogatoire', 'archives', 'labo', 'informatique', 'preuves', 'radio', 'vestiaires', 'repos', 'cafeteria', 'formation', 'supervision', 'ancien', 'financiere', 'numerique', 'liaison', 'administratif', 'briefing', 'couloir', 'accueil', 'garage'];

export const FURN_LABEL: Record<string, string> = {
  bureau: 'Bureau', table: 'Table de réunion', armoire: 'Armoire à dossiers', etagere: 'Rayonnage', paillasse: 'Paillasse de laboratoire',
  canape: 'Canapé', cafe: 'Machine à café', comptoir: 'Comptoir d\'accueil', banc: 'Banc d\'attente', casier: 'Casiers', coffre: 'Armoire à scellés',
  tableau: 'Tableau d\'enquête', plante: 'Plante', serveur: 'Baie informatique', radio: 'Console radio', place: 'Place de stationnement', ecran: 'Mur d\'écrans',
  table_interro: 'Table d\'audition', frigo: 'Réfrigérateur', photocopieur: 'Photocopieur',
};
export const FURN_COST: Record<string, number> = { bureau: 450, table: 600, armoire: 250, etagere: 200, paillasse: 1800, canape: 350, cafe: 300, comptoir: 700, banc: 150, casier: 200, coffre: 500, tableau: 120, plante: 40, serveur: 2500, radio: 1500, place: 0, ecran: 3000, table_interro: 300, frigo: 350, photocopieur: 900 };
/** Mobilier qu'on peut ajouter à la main dans chaque type de pièce. */
export const ROOM_FURN: Partial<Record<RoomType, string[]>> = {
  bureaux: ['bureau', 'armoire', 'plante', 'tableau', 'photocopieur'], commandant: ['bureau', 'armoire', 'plante', 'table'], briefing: ['table', 'tableau', 'plante'],
  interrogatoire: ['table_interro'], archives: ['etagere', 'armoire'], labo: ['paillasse', 'armoire', 'frigo'], informatique: ['serveur', 'bureau'],
  preuves: ['coffre'], radio: ['radio'], vestiaires: ['casier'], repos: ['canape', 'plante'], cafeteria: ['table', 'cafe', 'frigo', 'plante'],
  formation: ['table', 'tableau'], supervision: ['ecran', 'bureau'], ancien: ['bureau', 'etagere', 'tableau'], financiere: ['bureau', 'armoire'],
  numerique: ['bureau', 'serveur'], liaison: ['bureau', 'armoire'], administratif: ['bureau', 'armoire', 'photocopieur'], accueil: ['comptoir', 'banc', 'plante'], garage: ['place'],
};

let fid = 0;
function F(kind: string, x: number, y: number, rot: 0 | 1 = 0): Furniture {
  return { id: `F${++fid}`, kind, x, y, rot };
}

/** Disposition automatique du mobilier selon le type de pièce (laisse un passage depuis la porte). */
export function furnish(r: Room): Furniture[] {
  const out: Furniture[] = [];
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w - 1, y1 = r.y + r.h - 1;
  const isDoorZone = (x: number, y: number) => r.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 1);
  const put = (k: string, x: number, y: number, rot: 0 | 1 = 0) => {
    if (x < x0 || y < y0 || x > x1 || y > y1 || isDoorZone(x, y) || out.some((f) => f.x === x && f.y === y)) return;
    out.push(F(k, x, y, rot));
  };
  switch (r.type) {
    case 'bureaux': case 'administratif': case 'financiere': case 'numerique': case 'ancien': case 'liaison':
      for (let y = y0 + 1; y <= y1 - 1; y += 2) for (let x = x0 + 1; x <= x1 - 1; x += 2) put('bureau', x, y);
      put('armoire', x0, y0); put('plante', x1, y0);
      if (r.type === 'ancien') put('tableau', x1, y1);
      if (r.type === 'numerique') put('serveur', x0, y1);
      break;
    case 'commandant':
      put('bureau', x0 + 1, y0 + 1); put('armoire', x1, y0); put('plante', x0, y1); put('table', x1 - 1, y1 - 1);
      break;
    case 'briefing': case 'formation':
      for (let x = x0 + 1; x <= x1 - 1; x++) for (let y = y0 + 1; y <= y1 - 1; y++) if ((x - x0) % 3 !== 0) put('table', x, y);
      put('tableau', x0, y0 + 1); put('plante', x1, y0);
      break;
    case 'interrogatoire':
      put('table_interro', Math.floor((x0 + x1) / 2), Math.floor((y0 + y1) / 2));
      break;
    case 'archives':
      for (let x = x0; x <= x1; x += 2) for (let y = y0; y <= y1 - 1; y++) put('etagere', x, y);
      break;
    case 'labo':
      for (let x = x0; x <= x1; x++) put('paillasse', x, y0);
      for (let x = x0 + 1; x <= x1 - 1; x += 3) put('paillasse', x, y1);
      put('frigo', x1, Math.floor((y0 + y1) / 2));
      break;
    case 'informatique':
      for (let x = x0; x <= x1; x += 2) put('serveur', x, y0);
      put('bureau', x0 + 1, y1);
      break;
    case 'preuves':
      for (let x = x0; x <= x1; x++) put('coffre', x, y0);
      put('coffre', x0, y1);
      break;
    case 'radio': put('radio', x0, y0); put('radio', x0 + 1, y0); break;
    case 'supervision': for (let x = x0; x <= x1; x++) put('ecran', x, y0); put('bureau', x0 + 1, y0 + 2); put('bureau', x0 + 3, y0 + 2); break;
    case 'vestiaires': for (let x = x0; x <= x1; x++) put('casier', x, y0); break;
    case 'repos': put('canape', x0, y0); put('canape', x0 + 2, y0); put('plante', x1, y1); break;
    case 'cafeteria':
      for (let x = x0 + 1; x <= x1 - 1; x += 2) for (let y = y0 + 1; y <= y1 - 1; y += 2) put('table', x, y);
      put('cafe', x1, y0); put('frigo', x1 - 1, y0); put('plante', x0, y0);
      break;
    case 'accueil': put('comptoir', x0 + 1, y0 + 1); put('comptoir', x0 + 2, y0 + 1); put('banc', x1, y1 - 1); put('banc', x1, y1 - 2); put('plante', x0, y1); break;
    case 'garage': for (let x = x0; x + 1 <= x1; x += 3) put('place', x + 1, Math.floor((y0 + y1) / 2)); break;
    default: break;
  }
  return out;
}

function room(id: string, type: RoomType, floor: number, x: number, y: number, w: number, h: number, doors: { x: number; y: number }[]): Room {
  const r: Room = { id, type, floor, x, y, w, h, doors, furniture: [], built: 0 };
  r.furniture = furnish(r);
  return r;
}

/** Hôtel de police initial (scénario de référence). */
export function initialStation(): Station {
  fid = 0;
  const rooms: Room[] = [
    // rez-de-chaussée
    room('R1', 'couloir', 0, 0, 6, 22, 2, [{ x: 0, y: 6 }, { x: 0, y: 7 }]),
    room('R2', 'accueil', 0, 0, 0, 6, 6, [{ x: 3, y: 5 }]),
    room('R3', 'interrogatoire', 0, 6, 0, 4, 6, [{ x: 7, y: 5 }]),
    room('R4', 'preuves', 0, 10, 0, 3, 6, [{ x: 11, y: 5 }]),
    room('R5', 'labo', 0, 13, 0, 6, 6, [{ x: 15, y: 5 }]),
    room('R6', 'escalier', 0, 19, 0, 3, 6, [{ x: 20, y: 5 }]),
    room('R7', 'garage', 0, 0, 8, 9, 6, [{ x: 4, y: 8 }, { x: 3, y: 13 }, { x: 4, y: 13 }, { x: 5, y: 13 }]),
    room('R8', 'vestiaires', 0, 9, 8, 3, 6, [{ x: 10, y: 8 }]),
    room('R9', 'archives', 0, 12, 8, 5, 6, [{ x: 14, y: 8 }]),
    // étage
    room('R10', 'couloir', 1, 0, 6, 22, 2, []),
    room('R11', 'commandant', 1, 0, 0, 5, 6, [{ x: 2, y: 5 }]),
    room('R12', 'bureaux', 1, 5, 0, 9, 6, [{ x: 9, y: 5 }]),
    room('R13', 'briefing', 1, 14, 0, 5, 6, [{ x: 16, y: 5 }]),
    room('R14', 'escalier', 1, 19, 0, 3, 6, [{ x: 20, y: 5 }]),
    room('R15', 'bureaux', 1, 0, 8, 7, 6, [{ x: 3, y: 8 }]),
    room('R16', 'administratif', 1, 7, 8, 4, 5, [{ x: 9, y: 8 }]),
  ];
  return { w: SW, h: SH, floors: 2, lot: { x: 0, y: 0, w: SW, h: SH }, rooms };
}

export function roomAt(s: Station, floor: number, x: number, y: number): Room | undefined {
  return s.rooms.find((r) => r.floor === floor && x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h);
}

export function furnitureAt(r: Room, x: number, y: number) {
  return r.furniture.find((f) => f.x === x && f.y === y);
}

// ————— Navigation —————
const node = (f: number, x: number, y: number) => f * SW * SH + y * SW + x;
export const unnode = (n: number) => ({ f: Math.floor(n / (SW * SH)), x: n % SW, y: Math.floor((n % (SW * SH)) / SW) });

export function walkable(s: Station, f: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= SW || y >= SH) return false;
  const r = roomAt(s, f, x, y);
  if (!r) return false;
  const fu = furnitureAt(r, x, y);
  return !fu || fu.kind === 'place';
}

function passable(s: Station, f: number, ax: number, ay: number, bx: number, by: number): boolean {
  if (!walkable(s, f, bx, by)) return false;
  const ra = roomAt(s, f, ax, ay), rb = roomAt(s, f, bx, by);
  if (ra === rb) return true;
  // franchissement d'un mur : seulement par une porte de l'une des deux pièces
  const isDoor = (r: Room | undefined, x: number, y: number) => !!r?.doors.some((d) => d.x === x && d.y === y);
  return isDoor(ra, ax, ay) || isDoor(rb, bx, by);
}

export function navPath(s: Station, from: { f: number; x: number; y: number }, to: { f: number; x: number; y: number }): { f: number; x: number; y: number }[] {
  const goal = node(to.f, to.x, to.y);
  const stairs = s.rooms.filter((r) => r.type === 'escalier');
  const res = astar(
    node(from.f, from.x, from.y), goal,
    (n) => {
      const { f, x, y } = unnode(n);
      const out: number[] = [];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (passable(s, f, x, y, x + dx, y + dy)) out.push(node(f, x + dx, y + dy));
      const st = roomAt(s, f, x, y);
      if (st?.type === 'escalier') {
        for (const o of stairs) if (o.floor !== f && Math.abs(o.floor - f) === 1 && x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h) out.push(node(o.floor, x, y));
      }
      return out;
    },
    (n) => { const a = unnode(n); return Math.abs(a.x - to.x) + Math.abs(a.y - to.y) + Math.abs(a.f - to.f) * 6; },
    (a, b) => (unnode(a).f !== unnode(b).f ? 6 : 1),
  );
  return res.map(unnode);
}

/** Case libre dans une pièce, près d'un meuble d'un type donné (pour s'y installer). */
export function spotIn(s: Station, r: Room, near?: string, k = 0): { f: number; x: number; y: number } {
  const free: { x: number; y: number; d: number }[] = [];
  const targets = near ? r.furniture.filter((f) => f.kind === near) : [];
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      if (!walkable(s, r.floor, x, y)) continue;
      const d = targets.length ? Math.min(...targets.map((t) => Math.abs(t.x - x) + Math.abs(t.y - y))) : 0;
      free.push({ x, y, d });
    }
  if (!free.length) return { f: r.floor, x: r.doors[0]?.x ?? r.x, y: r.doors[0]?.y ?? r.y };
  free.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  const near1 = free.filter((p) => p.d === free[0].d);
  const p = near1[k % near1.length];
  return { f: r.floor, x: p.x, y: p.y };
}

// ————— Capacités —————
export function count(s: Station, type: RoomType, furn?: string): number {
  const rs = s.rooms.filter((r) => r.type === type && r.built <= Infinity);
  return furn ? rs.reduce((t, r) => t + r.furniture.filter((f) => f.kind === furn).length, 0) : rs.length;
}

export function capacities(st: GameState) {
  const s = st.station;
  const ready = (r: Room) => r.built <= st.minute;
  const rs = s.rooms.filter(ready);
  const fc = (type: RoomType | null, k: string) => rs.filter((r) => !type || r.type === type).reduce((t, r) => t + r.furniture.filter((f) => f.kind === k).length, 0);
  return {
    desks: fc(null, 'bureau'),
    interviewRooms: rs.filter((r) => r.type === 'interrogatoire').length,
    labBenches: fc('labo', 'paillasse'),
    evidenceSlots: fc('preuves', 'coffre') * 12,
    garage: fc('garage', 'place'),
    rest: rs.filter((r) => r.type === 'repos').length + rs.filter((r) => r.type === 'cafeteria').length * 0.7,
    briefing: rs.some((r) => r.type === 'briefing'),
    archives: rs.some((r) => r.type === 'archives'),
    informatique: rs.some((r) => r.type === 'informatique'),
    numerique: rs.some((r) => r.type === 'numerique'),
    financiere: rs.some((r) => r.type === 'financiere'),
    liaison: rs.some((r) => r.type === 'liaison'),
    radio: rs.some((r) => r.type === 'radio'),
    supervision: rs.some((r) => r.type === 'supervision'),
    formation: rs.some((r) => r.type === 'formation'),
    ancien: rs.some((r) => r.type === 'ancien'),
    vestiaires: rs.some((r) => r.type === 'vestiaires'),
    accueil: rs.some((r) => r.type === 'accueil'),
  };
}

// ————— Construction —————
export function canPlaceRoom(s: Station, floor: number, x: number, y: number, w: number, h: number): string | null {
  if (w < 2 || h < 2) return 'Une pièce mesure au moins 2 × 2 cases.';
  if (x < 0 || y < 0 || x + w > SW || y + h > SH) return 'Hors de l\'emprise du bâtiment.';
  if (floor >= s.floors) return 'Cet étage n\'existe pas encore.';
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (roomAt(s, floor, xx, yy)) return 'Emplacement déjà occupé.';
  return null;
}

/** Porte automatique : sur le bord de la pièce, vers un couloir de préférence. */
export function autoDoor(s: Station, floor: number, x: number, y: number, w: number, h: number): { x: number; y: number } | null {
  const cands: { x: number; y: number; ox: number; oy: number }[] = [];
  for (let xx = x; xx < x + w; xx++) { cands.push({ x: xx, y, ox: xx, oy: y - 1 }); cands.push({ x: xx, y: y + h - 1, ox: xx, oy: y + h }); }
  for (let yy = y; yy < y + h; yy++) { cands.push({ x, y: yy, ox: x - 1, oy: yy }); cands.push({ x: x + w - 1, y: yy, ox: x + w, oy: yy }); }
  const scored = cands
    .map((c) => ({ c, r: roomAt(s, floor, c.ox, c.oy) }))
    .filter((v) => v.r && walkable(s, floor, v.c.ox, v.c.oy))
    .sort((a, b) => (a.r!.type === 'couloir' ? 0 : 1) - (b.r!.type === 'couloir' ? 0 : 1));
  return scored.length ? { x: scored[0].c.x, y: scored[0].c.y } : null;
}

export function buildCost(type: RoomType, w: number, h: number) {
  return Math.round(ROOM_DEFS[type].cost + w * h * 160);
}

export function placeRoom(st: GameState, type: RoomType, floor: number, x: number, y: number, w: number, h: number): { ok: boolean; msg: string; room?: Room } {
  const s = st.station;
  const err = canPlaceRoom(s, floor, x, y, w, h);
  if (err) return { ok: false, msg: err };
  if (w * h < ROOM_DEFS[type].minArea) return { ok: false, msg: `Surface minimale : ${ROOM_DEFS[type].minArea} cases.` };
  const door = autoDoor(s, floor, x, y, w, h);
  if (!door) return { ok: false, msg: 'La pièce doit toucher un couloir ou une autre pièce pour avoir une porte.' };
  const r: Room = { id: `R${++st.counters.room}`, type, floor, x, y, w, h, doors: [door], furniture: [], built: st.minute + Math.max(2, Math.round(w * h / 4)) * 24 * 60 };
  r.furniture = furnish(r);
  s.rooms.push(r);
  return { ok: true, msg: `Travaux lancés : ${ROOM_DEFS[type].label}.`, room: r };
}

export function canPlaceFurniture(s: Station, r: Room, kind: string, x: number, y: number): string | null {
  if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return 'En dehors de la pièce.';
  if (furnitureAt(r, x, y)) return 'Case déjà occupée.';
  if (r.doors.some((d) => Math.abs(d.x - x) + Math.abs(d.y - y) <= 0)) return 'Ne pas bloquer une porte.';
  if (!(ROOM_FURN[r.type] ?? []).includes(kind)) return 'Ce mobilier n\'a pas sa place dans cette pièce.';
  // la pièce doit rester entièrement accessible depuis sa porte
  r.furniture.push({ id: 'tmp', kind, x, y, rot: 0 });
  const ok = roomConnected(s, r);
  r.furniture.pop();
  return ok ? null : 'Ce meuble couperait la circulation dans la pièce.';
}

export function roomConnected(s: Station, r: Room): boolean {
  const d = r.doors[0];
  if (!d) return true;
  const seen = new Set<string>();
  const q = [[d.x, d.y]];
  while (q.length) {
    const [x, y] = q.pop()!;
    const k = `${x},${y}`;
    if (seen.has(k)) continue;
    if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h || !walkable(s, r.floor, x, y)) continue;
    seen.add(k);
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let free = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (walkable(s, r.floor, x, y)) free++;
  return seen.size === free;
}
