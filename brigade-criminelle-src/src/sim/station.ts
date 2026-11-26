// Commissariat constructible : pièces sur plusieurs étages, portes, mobilier avec collisions,
// grille de navigation (A*) et capacités fonctionnelles de chaque pièce.
import { astar } from './city';
import type { Furniture, GameState, Room, RoomType, Station } from './types';

export const SW = 22, SH = 14; // emprise initiale
export const MAXW = 40, MAXH = 32; // emprise maximale après agrandissements (indexation de la navigation)

export interface RoomDef { label: string; cost: number; minArea: number; color: number; floorTex: 'parquet' | 'carrelage' | 'lino' | 'beton' | 'moquette'; desc: string; effect: string; minYear?: number }

export const ROOM_DEFS: Record<RoomType, RoomDef> = {
  accueil: { label: 'Accueil', cost: 900, minArea: 12, color: 0xd8c9a8, floorTex: 'carrelage', desc: 'Réception du public et des plaignants.', effect: 'Satisfaction des personnes accueillies, prise de plainte.' },
  commandant: { label: 'Bureau du commandant', cost: 1200, minArea: 9, color: 0xa88b6a, floorTex: 'parquet', desc: 'Bureau de direction.', effect: 'Supervision : +10 % sur la qualité des décisions assistées.' },
  bureaux: { label: 'Bureaux d\'enquête', cost: 800, minArea: 9, color: 0xc2b49a, floorTex: 'moquette', desc: 'Postes de travail des enquêteurs.', effect: 'Un poste par bureau : sans poste, le travail de bureau est ralenti de 30 %.' },
  briefing: { label: 'Salle de briefing', cost: 1000, minArea: 12, color: 0xb9a98c, floorTex: 'moquette', desc: 'Réunions d\'équipe et recoupements.', effect: '+15 % sur les recoupements ; améliore le travail collectif.' },
  interrogatoire: { label: 'Salle d\'entretien et d\'interrogatoire', cost: 1100, minArea: 6, color: 0x9fa4a8, floorTex: 'lino', desc: 'Entretiens et auditions.', effect: 'Une audition à la fois par salle.' },
  archives: { label: 'Archives', cost: 900, minArea: 9, color: 0xb3a58a, floorTex: 'beton', desc: 'Dossiers papier et registres.', effect: '+20 % sur les recherches documentaires ; dossiers anciens.' },
  labo: { label: 'Laboratoire scientifique', cost: 4000, minArea: 12, color: 0xd9e2e6, floorTex: 'carrelage', desc: 'Analyses techniques internes.', effect: 'Une analyse simultanée par paillasse.' },
  informatique: { label: 'Salle informatique', cost: 3000, minArea: 9, color: 0xc9d0d6, floorTex: 'lino', desc: 'Serveurs et postes d\'exploitation.', effect: '+15 % sur les recherches et analyses numériques (selon l\'époque).', minYear: 1983 },
  preuves: { label: 'Salle sécurisée des preuves', cost: 1800, minArea: 6, color: 0x8f8a80, floorTex: 'beton', desc: 'Conservation des scellés.', effect: '12 scellés par armoire ; au-delà, risque de rupture de traçabilité.' },
  radio: { label: 'Local radio', cost: 1500, minArea: 6, color: 0xa7a08f, floorTex: 'lino', desc: 'Liaisons avec les équipages.', effect: 'Réduit les délais d\'intervention sur le terrain.' },
  vestiaires: { label: 'Vestiaires', cost: 700, minArea: 6, color: 0xb0b7ad, floorTex: 'carrelage', desc: 'Casiers et douches.', effect: 'Petit bonus de moral.' },
  repos: { label: 'Salle de repos', cost: 900, minArea: 9, color: 0xc7b8a0, floorTex: 'moquette', desc: 'Canapés pour la récupération.', effect: 'Récupération de la fatigue pendant le service.' },
  cafeteria: { label: 'Cafétéria', cost: 1300, minArea: 12, color: 0xd6c3a0, floorTex: 'carrelage', desc: 'Repas et échanges informels.', effect: 'Moral et relations entre collègues.' },
  garage: { label: 'Garage', cost: 2500, minArea: 20, color: 0x8a8d90, floorTex: 'beton', desc: 'Stationnement et entretien des véhicules.', effect: 'Un emplacement par véhicule ; entretien réduit l\'usure.' },
  formation: { label: 'Salle de formation', cost: 1600, minArea: 12, color: 0xbfb294, floorTex: 'moquette', desc: 'Stages internes.', effect: 'Formations internes moins coûteuses.' },
  supervision: { label: 'Centre de supervision', cost: 5000, minArea: 12, color: 0x6f7880, floorTex: 'lino', desc: 'Pilotage des opérations.', effect: 'Alertes plus précoces ; meilleure coordination.', minYear: 1990 },
  ancien: { label: 'Cellule des affaires anciennes', cost: 1500, minArea: 9, color: 0xa69a83, floorTex: 'parquet', desc: 'Réexamen des dossiers non élucidés.', effect: 'Permet la réouverture méthodique de dossiers classés.' },
  financiere: { label: 'Unité financière', cost: 2000, minArea: 9, color: 0xbdb197, floorTex: 'moquette', desc: 'Analyse comptable et financière.', effect: '+20 % sur les réquisitions et recherches des affaires financières.' },
  numerique: { label: 'Unité numérique', cost: 3500, minArea: 9, color: 0xaeb8c2, floorTex: 'lino', desc: 'Exploitation des supports numériques.', effect: 'Analyses numériques internes (selon l\'époque).', minYear: 1995 },
  liaison: { label: 'Bureau de liaison avec la justice', cost: 1200, minArea: 6, color: 0xb8a37e, floorTex: 'parquet', desc: 'Relation quotidienne avec le parquet.', effect: 'Délais de réponse judiciaires réduits de 25 %.' },
  administratif: { label: 'Bureau administratif', cost: 800, minArea: 6, color: 0xc4b79c, floorTex: 'moquette', desc: 'Secrétariat, gestion du personnel.', effect: 'Accélère la frappe des procédures et les demandes de moyens.' },
  cellules: { label: 'Cellules de garde à vue', cost: 3500, minArea: 6, color: 0x9a9c98, floorTex: 'beton', desc: 'Geôles pour les personnes gardées à vue.', effect: 'Indispensables aux gardes à vue sur place : sans cellule, chaque audition prend 60 % de temps en plus (transfert vers un autre service).' },
  cantine: { label: 'Cantine', cost: 4500, minArea: 20, color: 0xd9c8a4, floorTex: 'carrelage', desc: 'Restauration collective avec cuisine.', effect: 'Forte récupération pendant les pauses et meilleur moral (davantage qu\'une cafétéria).' },
  armurerie: { label: 'Armurerie', cost: 2800, minArea: 4, color: 0x7c7f80, floorTex: 'beton', desc: 'Stockage sécurisé de l\'armement et des équipements.', effect: 'Moins d\'irrégularités lors des perquisitions (−40 % de risque).' },
  sport: { label: 'Salle de sport', cost: 2200, minArea: 12, color: 0xb8bcae, floorTex: 'lino', desc: 'Entraînement physique.', effect: 'Endurance et gestion du stress progressent avec le temps.' },
  infirmerie: { label: 'Infirmerie', cost: 2600, minArea: 6, color: 0xe2e8e6, floorTex: 'carrelage', desc: 'Examens médicaux des gardés à vue, premiers soins.', effect: 'Auditions en garde à vue 15 % plus rapides (examen médical sur place).' },
  signaletique: { label: 'Identité judiciaire (signalisation)', cost: 3000, minArea: 6, color: 0xd0d4d6, floorTex: 'lino', desc: 'Photographies, empreintes et signalement des mis en cause.', effect: 'Analyses d\'empreintes et de photographies plus rapides et plus fiables.' },
  presse: { label: 'Salle de presse', cost: 1800, minArea: 9, color: 0xbfae8c, floorTex: 'moquette', desc: 'Conférences et communication institutionnelle.', effect: 'Les communiqués améliorent davantage la confiance du public.' },
  ecoutes: { label: 'Salle des interceptions', cost: 4000, minArea: 6, color: 0x8f9aa6, floorTex: 'lino', desc: 'Exploitation des réquisitions téléphoniques et numériques.', effect: 'Réquisitions exploitées 30 % plus vite.', minYear: 1990 },
  tir: { label: 'Stand de tir', cost: 5000, minArea: 12, color: 0x8a8678, floorTex: 'beton', desc: 'Entraînement réglementaire au tir.', effect: 'Discipline et gestion du stress progressent avec le temps.' },
  couloir: { label: 'Couloir', cost: 150, minArea: 2, color: 0xcfc7b6, floorTex: 'lino', desc: 'Circulation.', effect: 'Relie les pièces.' },
  escalier: { label: 'Escalier', cost: 2000, minArea: 4, color: 0xa9a294, floorTex: 'beton', desc: 'Relie les étages.', effect: 'Accès aux étages.' },
};

export const BUILDABLE: RoomType[] = ['bureaux', 'interrogatoire', 'cellules', 'archives', 'labo', 'signaletique', 'informatique', 'numerique', 'ecoutes', 'preuves', 'armurerie', 'radio', 'supervision', 'vestiaires', 'repos', 'cafeteria', 'cantine', 'sport', 'tir', 'infirmerie', 'formation', 'presse', 'ancien', 'financiere', 'liaison', 'administratif', 'briefing', 'couloir', 'accueil', 'garage'];

export function roomAvailable(t: RoomType, year: number) {
  return !ROOM_DEFS[t].minYear || year >= ROOM_DEFS[t].minYear!;
}

export const FURN_LABEL: Record<string, string> = {
  bureau: 'Bureau', table: 'Table de réunion', armoire: 'Armoire à dossiers', etagere: 'Rayonnage', paillasse: 'Paillasse de laboratoire',
  canape: 'Canapé', cafe: 'Machine à café', comptoir: 'Comptoir d\'accueil', banc: 'Banc d\'attente', casier: 'Casiers', coffre: 'Armoire à scellés',
  tableau: 'Tableau d\'enquête', plante: 'Plante', serveur: 'Baie informatique', radio: 'Console radio', place: 'Place de stationnement', ecran: 'Mur d\'écrans',
  table_interro: 'Table d\'audition', frigo: 'Réfrigérateur', photocopieur: 'Photocopieur',
  cellule: 'Cellule (banc et grille)', lit_medical: 'Lit d\'examen', pharmacie: 'Armoire à pharmacie', rack_armes: 'Armoire forte à armes', tapis_course: 'Tapis de course',
  banc_muscu: 'Banc de musculation', sac_frappe: 'Sac de frappe', toise: 'Toise et fond de signalisation', appareil_photo: 'Appareil photo sur pied', table_empreintes: 'Table d\'empreintes',
  pupitre: 'Pupitre de conférence', chaises: 'Rangée de chaises', console_ecoute: 'Poste d\'interception', cible: 'Poste de tir et cible', self: 'Comptoir self-service',
  cuisine: 'Cuisine professionnelle', table_longue: 'Grande table de cantine', fontaine: 'Fontaine à eau', distributeur: 'Distributeur de boissons', horloge: 'Horloge murale',
  affichage: 'Panneau d\'affichage', extincteur: 'Extincteur', carte: 'Carte de la circonscription', imprimante: 'Imprimante', fax: 'Télécopieur', drapeau: 'Drapeau',
};
/** Années de disponibilité de certains équipements (technologie). */
export const FURN_YEARS: Record<string, [number, number]> = { serveur: [1983, 9999], imprimante: [1985, 9999], fax: [1980, 2014], console_ecoute: [1990, 9999], photocopieur: [1975, 9999] };
export function furnAvailable(kind: string, year: number) {
  const r = FURN_YEARS[kind];
  return !r || (year >= r[0] && year <= r[1]);
}
export const FURN_COST: Record<string, number> = { cellule: 1500, lit_medical: 700, pharmacie: 300, rack_armes: 1200, tapis_course: 900, banc_muscu: 500, sac_frappe: 150, toise: 400, appareil_photo: 900, table_empreintes: 500, pupitre: 400, chaises: 300, console_ecoute: 2500, cible: 1800, self: 2500, cuisine: 6000, table_longue: 700, fontaine: 200, distributeur: 600, horloge: 40, affichage: 60, extincteur: 80, carte: 120, imprimante: 600, fax: 500, drapeau: 90, bureau: 450, table: 600, armoire: 250, etagere: 200, paillasse: 1800, canape: 350, cafe: 300, comptoir: 700, banc: 150, casier: 200, coffre: 500, tableau: 120, plante: 40, serveur: 2500, radio: 1500, place: 0, ecran: 3000, table_interro: 300, frigo: 350, photocopieur: 900 };
/** Mobilier qu'on peut ajouter à la main dans chaque type de pièce. */
const DECOR = ['plante', 'horloge', 'extincteur', 'affichage', 'fontaine', 'distributeur', 'carte', 'imprimante', 'fax', 'drapeau'];
/** Mobilier qu'on peut ajouter à la main dans chaque type de pièce (+ objets de décor partout). */
const ROOM_FURN_BASE: Partial<Record<RoomType, string[]>> = {
  bureaux: ['bureau', 'armoire', 'tableau', 'photocopieur'], commandant: ['bureau', 'armoire', 'table'], briefing: ['table', 'tableau'],
  interrogatoire: ['table_interro'], archives: ['etagere', 'armoire'], labo: ['paillasse', 'armoire', 'frigo'], informatique: ['serveur', 'bureau'],
  preuves: ['coffre'], radio: ['radio', 'bureau'], vestiaires: ['casier'], repos: ['canape'], cafeteria: ['table', 'cafe', 'frigo'],
  formation: ['table', 'tableau'], supervision: ['ecran', 'bureau'], ancien: ['bureau', 'etagere', 'tableau'], financiere: ['bureau', 'armoire'],
  numerique: ['bureau', 'serveur'], liaison: ['bureau', 'armoire'], administratif: ['bureau', 'armoire', 'photocopieur'], accueil: ['comptoir', 'banc'], garage: ['place'],
  cellules: ['cellule'], cantine: ['table_longue', 'self', 'cuisine', 'cafe', 'frigo'], armurerie: ['rack_armes', 'armoire'], sport: ['tapis_course', 'banc_muscu', 'sac_frappe', 'casier'],
  infirmerie: ['lit_medical', 'pharmacie', 'bureau'], signaletique: ['toise', 'appareil_photo', 'table_empreintes', 'bureau'], presse: ['pupitre', 'chaises'],
  ecoutes: ['console_ecoute', 'serveur'], tir: ['cible', 'rack_armes'],
};
export const ROOM_FURN: Partial<Record<RoomType, string[]>> = Object.fromEntries(
  Object.entries(ROOM_FURN_BASE).map(([k, v]) => [k, k === 'garage' ? v : [...v, ...DECOR]]),
) as Partial<Record<RoomType, string[]>>;

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
    if (x < x0 || y < y0 || x > x1 || y > y1 || !inRoom(r, x, y) || isDoorZone(x, y) || out.some((f) => f.x === x && f.y === y)) return;
    out.push(F(k, x, y, rot));
  };
  switch (r.type) {
    case 'bureaux': case 'administratif': case 'financiere': case 'numerique': case 'ancien': case 'liaison':
      for (let y = y0 + 1; y <= y1 - 1; y += 2) for (let x = x0 + 1; x <= x1 - 1; x += 2) put('bureau', x, y);
      put('armoire', x0, y0); put('plante', x1, y0); put('horloge', x0 + 1, y0); put('affichage', x1, y1);
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
    case 'accueil': put('affichage', x0 + 4, y0); put('horloge', x0, y0); put('comptoir', x0 + 1, y0 + 1); put('comptoir', x0 + 2, y0 + 1); put('banc', x1, y1 - 1); put('banc', x1, y1 - 2); put('plante', x0, y1); break;
    case 'garage': for (let x = x0; x + 1 <= x1; x += 3) put('place', x + 1, Math.floor((y0 + y1) / 2)); break;
    case 'cellules': for (let x = x0; x <= x1; x++) put('cellule', x, y0); put('extincteur', x1, y1); break;
    case 'cantine':
      for (let y = y0 + 2; y <= y1 - 1; y += 2) for (let x = x0 + 1; x <= x1 - 1; x++) if ((x - x0) % 4 !== 0) put('table_longue', x, y);
      put('cuisine', x0, y0); put('cuisine', x0 + 1, y0); put('self', x0 + 2, y0); put('self', x0 + 3, y0); put('cafe', x1, y0); put('fontaine', x1, y1); put('horloge', x1 - 1, y0);
      break;
    case 'armurerie': for (let x = x0; x <= x1; x++) put('rack_armes', x, y0); break;
    case 'sport': put('tapis_course', x0, y0); put('tapis_course', x0 + 1, y0); put('banc_muscu', x0 + 3, y0 + 2); put('sac_frappe', x1, y1 - 1); put('casier', x1, y0); break;
    case 'infirmerie': put('lit_medical', x0, y0); put('pharmacie', x1, y0); put('bureau', x1 - 1, y1); break;
    case 'signaletique': put('toise', x0, y0); put('appareil_photo', x0 + 1, y0 + 2); put('table_empreintes', x1, y0); put('bureau', x1, y1); break;
    case 'presse': put('pupitre', Math.floor((x0 + x1) / 2), y0); put('drapeau', x0, y0); for (let y = y0 + 2; y <= y1; y++) for (let x = x0; x <= x1; x++) if ((x - x0) % 3 !== 1) put('chaises', x, y); break;
    case 'ecoutes': for (let x = x0; x <= x1; x++) put('console_ecoute', x, y0); put('serveur', x1, y1); break;
    case 'tir': for (let x = x0; x <= x1; x++) put('cible', x, y0); put('rack_armes', x1, y1); break;
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
    room('R17', 'cellules', 0, 17, 8, 5, 4, [{ x: 19, y: 8 }]),
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

/** Case appartenant à la pièce (rectangle, moins l'angle retiré pour une pièce en L). */
export function inRoom(r: Pick<Room, 'x' | 'y' | 'w' | 'h' | 'cut'>, x: number, y: number): boolean {
  if (x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return false;
  const c = r.cut;
  return !(c && x >= c.x && y >= c.y && x < c.x + c.w && y < c.y + c.h);
}
export function roomArea(r: Pick<Room, 'w' | 'h' | 'cut'>): number {
  return r.w * r.h - (r.cut ? r.cut.w * r.cut.h : 0);
}
export type Shape = 'rect' | 'L-no' | 'L-ne' | 'L-so' | 'L-se';
export const SHAPE_LABEL: Record<Shape, string> = { rect: 'Rectangle', 'L-no': 'En L (angle nord retiré)', 'L-ne': 'En L (angle est retiré)', 'L-so': 'En L (angle ouest retiré)', 'L-se': 'En L (angle sud retiré)' };
/** Angle retiré pour une pièce en L (la moitié de chaque côté, arrondie vers le bas). */
export function cutFor(shape: Shape | undefined, x: number, y: number, w: number, h: number): Room['cut'] {
  if (!shape || shape === 'rect' || w < 3 || h < 3) return undefined;
  const cw = Math.floor(w / 2), ch = Math.floor(h / 2);
  // repères de l'écran isométrique : nord = haut (x0,y0), est = droite (x1,y0), ouest = gauche (x0,y1), sud = bas (x1,y1)
  const cx = shape === 'L-ne' || shape === 'L-se' ? x + w - cw : x;
  const cy = shape === 'L-so' || shape === 'L-se' ? y + h - ch : y;
  return { x: cx, y: cy, w: cw, h: ch };
}

export function roomAt(s: Station, floor: number, x: number, y: number): Room | undefined {
  return s.rooms.find((r) => r.floor === floor && inRoom(r, x, y));
}

export function furnitureAt(r: Room, x: number, y: number) {
  return r.furniture.find((f) => f.x === x && f.y === y);
}

// ————— Navigation —————
const node = (f: number, x: number, y: number) => f * MAXW * MAXH + y * MAXW + x;
export const unnode = (n: number) => ({ f: Math.floor(n / (MAXW * MAXH)), x: n % MAXW, y: Math.floor((n % (MAXW * MAXH)) / MAXW) });

/** Objets muraux ou au sol qui ne gênent pas le passage. */
export const NONBLOCK = new Set(['place', 'horloge', 'affichage', 'carte', 'extincteur', 'drapeau']);

export function walkable(s: Station, f: number, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return false;
  const r = roomAt(s, f, x, y);
  if (!r) return false;
  const fu = furnitureAt(r, x, y);
  return !fu || NONBLOCK.has(fu.kind);
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
      if (!inRoom(r, x, y) || !walkable(s, r.floor, x, y)) continue;
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
    rest: rs.filter((r) => r.type === 'repos').length + rs.filter((r) => r.type === 'cafeteria').length * 0.7 + rs.filter((r) => r.type === 'cantine').length * 1.3,
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
    cells: fc('cellules', 'cellule'),
    cantine: rs.filter((r) => r.type === 'cantine').length,
    armurerie: rs.some((r) => r.type === 'armurerie'),
    sport: rs.some((r) => r.type === 'sport'),
    infirmerie: rs.some((r) => r.type === 'infirmerie'),
    signaletique: rs.some((r) => r.type === 'signaletique'),
    presse: rs.some((r) => r.type === 'presse'),
    ecoutes: rs.some((r) => r.type === 'ecoutes'),
    tir: rs.some((r) => r.type === 'tir'),
  };
}

// ————— Construction —————
export function canPlaceRoom(s: Station, floor: number, x: number, y: number, w: number, h: number, cut?: Room['cut']): string | null {
  if (w < 2 || h < 2) return 'Une pièce mesure au moins 2 × 2 cases.';
  if (x < 0 || y < 0 || x + w > s.w || y + h > s.h) return 'Hors de l\'emprise du terrain : agrandissez le site.';
  if (floor >= s.floors) return 'Cet étage n\'existe pas encore.';
  const shape = { x, y, w, h, cut };
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (inRoom(shape, xx, yy) && roomAt(s, floor, xx, yy)) return 'Emplacement déjà occupé.';
  // l'allée devant les portes extérieures des garages doit rester libre jusqu'à la rue
  if (floor === 0) for (const g of s.rooms.filter((r) => r.type === 'garage' && r.floor === 0)) for (const d of g.doors) {
    if (d.y !== g.y + g.h - 1) continue;
    if (d.x >= x && d.x < x + w && y + h > d.y + 1) return 'Cette zone sert d\'allée à la sortie du garage : laissez-la libre.';
  }
  return null;
}

/** Porte automatique : sur le bord de la pièce, vers un couloir de préférence. */
export function autoDoor(s: Station, floor: number, x: number, y: number, w: number, h: number, cut?: Room['cut']): { x: number; y: number } | null {
  const cands: { x: number; y: number; ox: number; oy: number }[] = [];
  const shape = { x, y, w, h, cut };
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
    if (!inRoom(shape, xx, yy)) continue;
    for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) if (!inRoom(shape, xx + dx, yy + dy)) cands.push({ x: xx, y: yy, ox: xx + dx, oy: yy + dy });
  }
  const scored = cands
    .map((c) => ({ c, r: roomAt(s, floor, c.ox, c.oy) }))
    .filter((v) => v.r && walkable(s, floor, v.c.ox, v.c.oy))
    .sort((a, b) => (a.r!.type === 'couloir' ? 0 : 1) - (b.r!.type === 'couloir' ? 0 : 1));
  return scored.length ? { x: scored[0].c.x, y: scored[0].c.y } : null;
}

export function buildCost(type: RoomType, w: number, h: number, cut?: Room['cut']) {
  return Math.round(ROOM_DEFS[type].cost + roomArea({ w, h, cut }) * 160);
}

export function placeRoom(st: GameState, type: RoomType, floor: number, x: number, y: number, w: number, h: number, shape?: Shape): { ok: boolean; msg: string; room?: Room } {
  const s = st.station;
  const cut = cutFor(shape, x, y, w, h);
  if (shape && shape !== 'rect' && !cut) return { ok: false, msg: 'Une pièce en L mesure au moins 3 × 3 cases.' };
  const err = canPlaceRoom(s, floor, x, y, w, h, cut);
  if (err) return { ok: false, msg: err };
  if (roomArea({ w, h, cut }) < ROOM_DEFS[type].minArea) return { ok: false, msg: `Surface minimale : ${ROOM_DEFS[type].minArea} cases.` };
  const door = autoDoor(s, floor, x, y, w, h, cut);
  if (!door) return { ok: false, msg: 'La pièce doit toucher un couloir ou une autre pièce pour avoir une porte.' };
  const r: Room = { id: `R${++st.counters.room}`, type, floor, x, y, w, h, cut, doors: [door], furniture: [], built: st.minute + Math.max(2, Math.round(roomArea({ w, h, cut }) / 4)) * 24 * 60 };
  if (!cut) delete r.cut;
  r.furniture = furnish(r);
  s.rooms.push(r);
  return { ok: true, msg: `Travaux lancés : ${ROOM_DEFS[type].label}.`, room: r };
}

export function canPlaceFurniture(s: Station, r: Room, kind: string, x: number, y: number): string | null {
  if (!inRoom(r, x, y)) return 'En dehors de la pièce.';
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
    if (!inRoom(r, x, y) || !walkable(s, r.floor, x, y)) continue;
    seen.add(k);
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  let free = 0;
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (inRoom(r, x, y) && walkable(s, r.floor, x, y)) free++;
  return seen.size === free;
}

/** Toutes les pièces restent accessibles depuis l'accueil (et les étages par l'escalier). */
export function allReachable(s: Station): boolean {
  const acc = s.rooms.find((r) => r.type === 'accueil' && r.floor === 0) ?? s.rooms.find((r) => r.floor === 0);
  if (!acc) return true;
  const start = { f: acc.floor, x: acc.doors[0]?.x ?? acc.x, y: acc.doors[0]?.y ?? acc.y };
  const seen = new Set<number>([node(start.f, start.x, start.y)]);
  const q = [node(start.f, start.x, start.y)];
  const stairs = s.rooms.filter((r) => r.type === 'escalier');
  while (q.length) {
    const n = q.pop()!;
    const { f, x, y } = unnode(n);
    const next: number[] = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (passable(s, f, x, y, x + dx, y + dy)) next.push(node(f, x + dx, y + dy));
    if (roomAt(s, f, x, y)?.type === 'escalier') for (const o of stairs) if (o.floor !== f && Math.abs(o.floor - f) === 1 && inRoom(o, x, y)) next.push(node(o.floor, x, y));
    for (const m of next) if (!seen.has(m)) { seen.add(m); q.push(m); }
  }
  return s.rooms.every((r) => r.type === 'escalier' || r.doors.length === 0 || r.doors.some((d) => seen.has(node(r.floor, d.x, d.y))) || [...seen].some((m) => { const u = unnode(m); return u.f === r.floor && inRoom(r, u.x, u.y); }));
}

/** Valeur de reprise d'une pièce démolie : 60 % de la construction et 50 % du mobilier
 * (90 % si les travaux n'étaient pas terminés). */
export function refundValue(st: GameState, r: Room): number {
  if (r.type === 'escalier') return 0;
  const build = buildCost(r.type, r.w, r.h, r.cut);
  const furn = r.furniture.reduce((t, f) => t + (FURN_COST[f.kind] ?? 200), 0);
  return Math.round((r.built > st.minute ? 0.9 : 0.6) * build + 0.5 * furn);
}

export function demolish(st: GameState, id: string): { ok: boolean; msg: string } {
  const s = st.station;
  const r = s.rooms.find((x) => x.id === id);
  if (!r) return { ok: false, msg: 'Pièce introuvable.' };
  if (['escalier', 'accueil'].includes(r.type)) return { ok: false, msg: 'Cette pièce est indispensable au bâtiment.' };
  s.rooms = s.rooms.filter((x) => x !== r);
  if (!allReachable(s)) { s.rooms.push(r); return { ok: false, msg: 'Impossible : d\'autres pièces n\'auraient plus d\'accès.' }; }
  const v = refundValue(st, r);
  st.budget.envelope.batiments += v;
  return { ok: true, msg: `Démolition (${ROOM_DEFS[r.type].label}) : ${v.toLocaleString('fr-FR')} € reversés aux crédits de bâtiments.` };
}

export function moveCost(r: Room): number {
  return Math.round(buildCost(r.type, r.w, r.h, r.cut) * 0.35 + r.furniture.length * 60);
}

/** Déplace une pièce (avec son mobilier) vers un nouvel emplacement, éventuellement à un autre étage. */
export function moveRoom(st: GameState, id: string, floor: number, nx: number, ny: number): { ok: boolean; msg: string } {
  const s = st.station;
  const r = s.rooms.find((x) => x.id === id);
  if (!r) return { ok: false, msg: 'Pièce introuvable.' };
  if (['escalier', 'accueil', 'garage', 'couloir'].includes(r.type)) return { ok: false, msg: 'Cette pièce ne peut pas être déplacée.' };
  if (floor > 0 && r.type === 'cellules') return { ok: false, msg: 'Les cellules restent au rez-de-chaussée.' };
  const dx = nx - r.x, dy = ny - r.y;
  if (!dx && !dy && floor === r.floor) return { ok: false, msg: 'La pièce est déjà ici.' };
  const cut = r.cut ? { ...r.cut, x: r.cut.x + dx, y: r.cut.y + dy } : undefined;
  const old = { ...r, doors: [...r.doors], furniture: r.furniture.map((f) => ({ ...f })), cut: r.cut ? { ...r.cut } : undefined };
  s.rooms = s.rooms.filter((x) => x !== r);
  const err = canPlaceRoom(s, floor, nx, ny, r.w, r.h, cut);
  const door = err ? null : autoDoor(s, floor, nx, ny, r.w, r.h, cut);
  if (err || !door) { s.rooms.push(r); return { ok: false, msg: err ?? 'Le nouvel emplacement doit toucher un couloir ou une pièce.' }; }
  Object.assign(r, { floor, x: nx, y: ny, cut, doors: [door] });
  if (!cut) delete r.cut;
  for (const f of r.furniture) { f.x += dx; f.y += dy; }
  // le mobilier ne doit bloquer ni la nouvelle porte ni la circulation
  r.furniture = r.furniture.filter((f) => Math.abs(f.x - door.x) + Math.abs(f.y - door.y) > 0);
  s.rooms.push(r);
  let guard = 0;
  while (!roomConnected(s, r) && r.furniture.length && guard++ < 40) {
    r.furniture.sort((a, b) => (Math.abs(a.x - door.x) + Math.abs(a.y - door.y)) - (Math.abs(b.x - door.x) + Math.abs(b.y - door.y)));
    r.furniture.shift();
  }
  if (!allReachable(s)) { s.rooms = s.rooms.filter((x) => x !== r); s.rooms.push(Object.assign(r, old)); return { ok: false, msg: 'Impossible : d\'autres pièces n\'auraient plus d\'accès.' }; }
  r.built = Math.max(r.built, st.minute + 2 * 24 * 60);
  return { ok: true, msg: `${ROOM_DEFS[r.type].label} déménagé${r.furniture.length < old.furniture.length ? ` (${old.furniture.length - r.furniture.length} meuble(s) retiré(s) pour dégager le passage)` : ''}. Deux jours de déménagement.` };
}

export function rotateFurniture(r: Room, fid: string) {
  const f = r.furniture.find((x) => x.id === fid);
  if (f) f.rot = f.rot ? 0 : 1;
}
export function removeFurniture(st: GameState, r: Room, fid: string): number {
  const f = r.furniture.find((x) => x.id === fid);
  if (!f) return 0;
  r.furniture = r.furniture.filter((x) => x !== f);
  const v = Math.round((FURN_COST[f.kind] ?? 200) * 0.5);
  st.budget.envelope.equipements += v;
  return v;
}

/** Agrandissements du site : acquisition de terrain vers l'est ou le sud (paliers de 6 cases). */
export const EXTENSIONS = [
  { id: 'est', label: 'Extension vers l\'est (+6 cases)', dw: 6, dh: 0, cost: 45000 },
  { id: 'sud', label: 'Extension vers le sud (+6 cases)', dw: 0, dh: 6, cost: 45000 },
];
export function canExtend(s: Station, id: string): string | null {
  const e = EXTENSIONS.find((x) => x.id === id)!;
  if (s.w + e.dw > MAXW || s.h + e.dh > MAXH) return 'Le terrain disponible autour du commissariat est épuisé.';
  return null;
}
export function extend(s: Station, id: string) {
  const e = EXTENSIONS.find((x) => x.id === id)!;
  s.w += e.dw;
  s.h += e.dh;
  s.lot = { x: 0, y: 0, w: s.w, h: s.h };
}
