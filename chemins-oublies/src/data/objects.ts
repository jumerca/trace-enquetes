// Objets interactifs et rencontres. Les scripts (ce qui se passe au toucher) sont dans systems/Scripts.ts.
import type { ZoneId } from '../core/state';
import type { Pt } from '../world/types';

export interface ObjDef {
  id: string; zone: ZoneId; x: number; y: number; name: string;
  w?: number; h?: number; // zone de toucher (au-dessus du point de pied)
  stand?: number; // distance d'arrêt
  cond?: string; hidden?: boolean; // hidden : pas de bulle d'indication
  kind?: 'examine' | 'puzzle' | 'pickup' | 'lever';
}

export const OBJECTS: ObjDef[] = [
  // Clairval
  { id: 'borne_arrivee', zone: 'clairval', x: 1395, y: 2050, name: 'Vieille borne', w: 34, h: 56 },
  { id: 'panneau', zone: 'clairval', x: 1390, y: 1720, name: 'Panneau indicateur', w: 60, h: 90 },
  { id: 'notice', zone: 'clairval', x: 1530, y: 1012, name: "Panneau d'affichage", w: 64, h: 80 },
  { id: 'fontaine', zone: 'clairval', x: 1300, y: 1230, name: 'Fontaine', w: 170, h: 100, stand: 70 },
  { id: 'puits', zone: 'clairval', x: 700, y: 1300, name: 'Puits', w: 60, h: 90, stand: 46 },
  { id: 'borneA', zone: 'clairval', x: 1640, y: 1115, name: 'Borne de la place', w: 40, h: 70, kind: 'puzzle' },
  { id: 'borneB', zone: 'clairval', x: 2640, y: 1115, name: 'Borne du pont', w: 40, h: 70, kind: 'puzzle' },
  { id: 'borneC', zone: 'clairval', x: 2640, y: 815, name: 'Borne de la colline', w: 40, h: 70, kind: 'puzzle' },
  { id: 'rocher', zone: 'clairval', x: 2860, y: 595, name: 'Rocher fendu', w: 130, h: 100, stand: 66 },
  { id: 'cache_pont', zone: 'clairval', x: 2262, y: 1206, name: 'Sous le pont', w: 50, h: 40, hidden: true, cond: '!cache_pont' },
  { id: 'ruches', zone: 'clairval', x: 2975, y: 1625, name: 'Ruches', w: 70, h: 60, stand: 50 },
  // Intérieurs
  { id: 'cheminee', zone: 'auberge', x: 120, y: 230, name: 'Cheminée', w: 110, h: 140, stand: 60 },
  { id: 'etabli', zone: 'atelier', x: 380, y: 290, name: 'Établi', w: 150, h: 60, stand: 50 },
  { id: 'registre', zone: 'archives', x: 560, y: 250, name: 'Registres', w: 90, h: 130, stand: 50 },
  { id: 'table_cartes', zone: 'archives', x: 360, y: 360, name: 'Carte de 1802', w: 130, h: 60, stand: 50 },
  { id: 'bureau_meunier', zone: 'moulin_int', x: 140, y: 380, name: 'Bureau du meunier', w: 110, h: 70, stand: 50 },
  { id: 'frein', zone: 'moulin_int', x: 560, y: 340, name: 'Frein de la roue', w: 70, h: 100, stand: 46, kind: 'lever' },
  { id: 'meule', zone: 'moulin_int', x: 360, y: 300, name: 'Meule', w: 110, h: 80, stand: 60 },
  // Bois
  { id: 'borne_bois', zone: 'bois', x: 1300, y: 1990, name: 'Borne moussue', w: 34, h: 56 },
  { id: 'pont_ruine', zone: 'bois', x: 2120, y: 1352, name: 'Pont en ruine', w: 70, h: 80, stand: 40 },
  { id: 'stele', zone: 'bois', x: 1700, y: 1380, name: 'Pierre brisée', w: 40, h: 56 },
  { id: 'arbre_grave', zone: 'bois', x: 620, y: 1318, name: 'Vieux chêne gravé', w: 50, h: 90, stand: 46 },
  { id: 'coffre_cache', zone: 'bois', x: 250, y: 920, name: 'Coffre moussu', w: 40, h: 36, cond: '!coffre_cache_ouvert' },
  { id: 'coffre_garde', zone: 'bois', x: 1880, y: 2235, name: 'Coffre envahi de ronces', w: 40, h: 36, cond: '!coffre_garde_ouvert' },
  { id: 'sauge', zone: 'bois', x: 2060, y: 1760, name: 'Plante argentée', w: 34, h: 34, cond: '!pick_sauge', kind: 'pickup' },
  { id: 'pied_de_loup', zone: 'bois', x: 1060, y: 2110, name: 'Plante rampante', w: 34, h: 34, cond: '!pick_pied_de_loup', kind: 'pickup' },
  { id: 'fleur_lanterne', zone: 'bois', x: 1290, y: 640, name: 'Fleur lumineuse', w: 34, h: 34, cond: '!pick_fleur_lanterne', kind: 'pickup' },
  { id: 'pierre_eau', zone: 'bois', x: 1240, y: 855, name: 'Pierre gravée (vagues)', w: 44, h: 90, stand: 44, kind: 'puzzle' },
  { id: 'pierre_oiseau', zone: 'bois', x: 975, y: 690, name: 'Pierre gravée (oiseau)', w: 44, h: 90, stand: 44, kind: 'puzzle' },
  { id: 'pierre_cle', zone: 'bois', x: 965, y: 860, name: 'Pierre gravée (clé)', w: 44, h: 90, stand: 44, kind: 'puzzle' },
  { id: 'pierre_lune', zone: 'bois', x: 1230, y: 685, name: 'Pierre gravée (lune)', w: 44, h: 90, stand: 44, kind: 'puzzle' },
  { id: 'brume', zone: 'bois', x: 1150, y: 360, name: 'Brume épaisse', w: 260, h: 110, stand: 80, cond: '!stones_solved' },
  // Moulin
  { id: 'levier1', zone: 'moulin', x: 1640, y: 335, name: "Levier de la prise d'eau", w: 50, h: 60, stand: 40, kind: 'lever' },
  { id: 'levier2', zone: 'moulin', x: 1395, y: 600, name: 'Levier de la décharge', w: 50, h: 60, stand: 40, kind: 'lever' },
  { id: 'levier3', zone: 'moulin', x: 1395, y: 760, name: 'Levier de la vanne motrice', w: 50, h: 60, stand: 40, kind: 'lever' },
  { id: 'jauge', zone: 'moulin', x: 1478, y: 480, name: 'Jauge du bief', w: 30, h: 60, stand: 60 },
  { id: 'roue', zone: 'moulin', x: 1450, y: 900, name: 'Roue à aubes', w: 120, h: 130, stand: 70 },
  { id: 'panneau_brume', zone: 'moulin', x: 2200, y: 980, name: 'Panneau', w: 60, h: 90 },
  // Chapitre II : Landes de Brume
  { id: 'panneau_landes', zone: 'landes', x: 300, y: 1610, name: 'Poteau indicateur', w: 50, h: 90 },
  { id: 'echo_1', zone: 'landes', x: 620, y: 1810, name: 'Cercle d\'herbe argentée', w: 90, h: 50, stand: 30, cond: '!echo_1' },
  { id: 'echo_2', zone: 'landes', x: 1300, y: 1770, name: 'Cercle d\'herbe argentée', w: 90, h: 50, stand: 30, cond: '!echo_2' },
  { id: 'echo_3', zone: 'landes', x: 1450, y: 950, name: 'Cercle d\'herbe argentée', w: 90, h: 50, stand: 30, cond: '!echo_3' },
  { id: 'veille_saule', zone: 'landes', x: 1640, y: 1070, name: 'Pierre au saule', w: 44, h: 90, kind: 'puzzle' },
  { id: 'veille_corbeau', zone: 'landes', x: 1830, y: 1300, name: 'Pierre au corbeau', w: 44, h: 90, kind: 'puzzle' },
  { id: 'veille_cloche', zone: 'landes', x: 1560, y: 1430, name: 'Pierre à la cloche', w: 44, h: 90, kind: 'puzzle' },
  { id: 'veille_lanterne', zone: 'landes', x: 1760, y: 990, name: 'Pierre à la lanterne', w: 44, h: 90, kind: 'puzzle' },
  { id: 'veille_oeil', zone: 'landes', x: 1440, y: 1170, name: 'Pierre à l\'œil fermé', w: 44, h: 90, kind: 'puzzle' },
  { id: 'brasero1', zone: 'landes', x: 2408, y: 676, name: 'Brasero', w: 46, h: 80, stand: 44, kind: 'lever' },
  { id: 'brasero2', zone: 'landes', x: 2715, y: 693, name: 'Brasero', w: 46, h: 80, stand: 44, kind: 'lever' },
  { id: 'brasero3', zone: 'landes', x: 2560, y: 900, name: 'Brasero', w: 46, h: 80, stand: 44, kind: 'lever' },
  { id: 'mouton1', zone: 'landes', x: 380, y: 1900, name: 'Mouton égaré', w: 50, h: 40, cond: '!mouton1' },
  { id: 'mouton2', zone: 'landes', x: 1700, y: 1880, name: 'Mouton égaré', w: 50, h: 40, cond: '!mouton2' },
  { id: 'mouton3', zone: 'landes', x: 860, y: 760, name: 'Mouton égaré', w: 50, h: 40, cond: '!mouton3' },
  // Brumecime
  { id: 'puits_bru', zone: 'brumecime', x: 1200, y: 1150, name: 'Puits', w: 60, h: 90, stand: 46 },
  { id: 'metier', zone: 'tissage', x: 360, y: 290, name: 'Métier à tisser', w: 160, h: 130, stand: 56 },
  { id: 'miroirA', zone: 'tour', x: 100, y: 300, name: 'Miroir', w: 56, h: 100, stand: 44, kind: 'puzzle' },
  { id: 'miroirB', zone: 'tour', x: 590, y: 300, name: 'Miroir', w: 56, h: 100, stand: 44, kind: 'puzzle' },
  { id: 'miroirC', zone: 'tour', x: 590, y: 440, name: 'Miroir', w: 56, h: 100, stand: 44, kind: 'puzzle' },
  { id: 'miroirD', zone: 'tour', x: 420, y: 440, name: 'Miroir', w: 56, h: 100, stand: 44, kind: 'puzzle' },
  { id: 'lentille', zone: 'tour', x: 420, y: 240, name: 'Grande lentille', w: 80, h: 130, stand: 50 },
  { id: 'bureau_maelys', zone: 'tour', x: 110, y: 470, name: 'Pupitre', w: 110, h: 60, stand: 46 },
];

export const LEVERS: Record<string, { pos: Pt; v: 'v1' | 'v2' | 'v3' }> = {
  levier1: { pos: [1640, 335], v: 'v1' }, levier2: { pos: [1395, 600], v: 'v2' }, levier3: { pos: [1395, 760], v: 'v3' },
};

export interface EncounterDef { id: string; zone: ZoneId; center: Pt; radius: number; checkpoint: Pt; enemies: { kind: 'ronceux' | 'murmure' | 'ancien'; x: number; y: number }[]; optional?: boolean }

export const ENCOUNTERS: EncounterDef[] = [
  { id: 'enc1', zone: 'bois', center: [950, 1480], radius: 240, checkpoint: [1170, 1830], enemies: [{ kind: 'ronceux', x: 890, y: 1430 }, { kind: 'ronceux', x: 1020, y: 1520 }] },
  { id: 'enc2', zone: 'bois', center: [1100, 770], radius: 250, checkpoint: [1010, 1130], enemies: [{ kind: 'murmure', x: 1010, y: 720 }, { kind: 'murmure', x: 1200, y: 800 }] },
  { id: 'enc4', zone: 'landes', center: [720, 1150], radius: 200, checkpoint: [660, 1580], enemies: [{ kind: 'murmure', x: 660, y: 1100 }, { kind: 'murmure', x: 800, y: 1190 }] },
  { id: 'enc5', zone: 'landes', center: [2300, 1250], radius: 180, checkpoint: [2250, 1020], enemies: [{ kind: 'ronceux', x: 2280, y: 1230 }, { kind: 'ronceux', x: 2380, y: 1260 }], optional: true },
  { id: 'enc3', zone: 'bois', center: [1880, 2160], radius: 170, checkpoint: [1890, 1880], enemies: [{ kind: 'ancien', x: 1880, y: 2150 }], optional: true },
];
