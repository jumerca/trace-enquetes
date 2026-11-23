// Régions de France : relief, climat, architecture, végétation et productions possibles.

export interface Architecture {
  mur: string; // couleur des murs
  toit: string;
  toitType: 'tuiles' | 'tuilesPlates' | 'ardoise' | 'lauzes';
  pente: number; // multiplicateur de hauteur de toit
  volets: string;
  colombages?: boolean;
  brique?: boolean;
}

export interface RegionDef {
  id: string;
  nom: string;
  sous: string; // sous-titre géographique
  desc: string;
  relief: { amplitude: number; echelle: number; montagne: number }; // hauteur max des collines (px), taille des reliefs, part de massif montagneux
  mer: boolean; // côte sur le bord ouest
  rivieres: number;
  forets: number; // 0..1
  essences: string[]; // ids d'arbres de décor
  bocage: boolean; // haies autour des champs
  champsVoisins: string[]; // cultures des fermes voisines (décor)
  architecture: Architecture;
  meteo: number[][]; // [saison][soleil, nuageux, pluie, orage, neige]
  /** multiplicateurs de rendement (cultures, vergers, élevages) */
  aptitudes: Record<string, number>;
  cultures: string[];
  vergers: string[];
  elevages: string[];
  ateliers: string[];
  tourisme: number;
  depart: { parcelle: string; atelier: string; argent: number; hangar?: boolean; second?: string };
  specialites: string;
}

const COMMUNS = [
  'grange', 'hangar', 'remise', 'boutique', 'accueil', 'silo', 'chambre_froide', 'garage_quad', 'garage_utilitaire', 'garage_bus', 'telescopique',
  'irrigation', 'solaire', 'gite', 'camping', 'auberge', 'pedagogique', 'champ_tomates', 'champ_prairie', 'elevage_chevaux', 'elevage_anes',
  // V0.6 : équipements, commerce, loisirs, filières présentes partout
  'eolienne', 'methaniseur', 'robot_traite', 'drone', 'station_meteo', 'compost', 'stand', 'magasin', 'salle_reception', 'musee', 'labyrinthe', 'aire_jeux', 'cueillette', 'jardin', 'mare',
  'champ_courges', 'champ_fleurs', 'verger_framboisier', 'elevage_dindes', 'elevage_pintades', 'elevage_cailles', 'elevage_escargots', 'elevage_alpagas', 'elevage_cerfs',
  'patisserie', 'glacerie', 'savonnerie', 'filature', 'boucherie',
];

export const REGIONS: RegionDef[] = [
  {
    id: 'limousin', nom: 'Collines du Limousin', sous: 'Corrèze et Périgord', desc: 'Collines verdoyantes, châtaigneraies, vergers et vallées. Pierre calcaire dorée et tuiles brunes.',
    relief: { amplitude: 70, echelle: 22, montagne: 0 }, mer: false, rivieres: 1, forets: 0.38, essences: ['chataignier', 'chene', 'noyer', 'bouleau', 'pin'], bocage: true,
    champsVoisins: ['ble', 'mais', 'pre'], architecture: { mur: '#d9c39a', toit: '#a8553a', toitType: 'tuiles', pente: 1.1, volets: '#6f93b4' },
    meteo: [[0.45, 0.3, 0.22, 0.03, 0], [0.62, 0.2, 0.1, 0.08, 0], [0.35, 0.33, 0.28, 0.04, 0], [0.25, 0.35, 0.25, 0, 0.15]],
    aptitudes: { pommier: 1.15, noyer: 1.2, chevres: 1.1, vaches: 1.05 },
    cultures: ['ble', 'mais', 'orge', 'legumes', 'pommes_de_terre', 'prairie', 'fraises', 'asperges'], vergers: ['pommier', 'noyer', 'prunier', 'chataigneraie', 'cerisier', 'truffiere', 'poirier'], elevages: ['chevres', 'vaches', 'brebis', 'poules', 'canards', 'porcs', 'ruches', 'allaitantes', 'oies', 'lapins', 'truites'],
    ateliers: ['pressoir', 'fromagerie', 'moulin', 'boulangerie', 'huilerie', 'conserverie', 'charcuterie', 'confiserie', 'boucherie', 'fumoir', 'cidrerie', 'beurrerie'], tourisme: 1, depart: { parcelle: 'verger_pommier', atelier: 'pressoir', argent: 18000 },
    specialites: 'Pommes et jus, noix et huile de noix, fromages de chèvre.',
  },
  {
    id: 'nord', nom: 'Plaine du Nord', sous: 'Flandre et Picardie', desc: 'Immenses plaines limoneuses, ciel changeant, fermes en brique rouge. Betteraves, pommes de terre, orge et vaches laitières.',
    relief: { amplitude: 14, echelle: 40, montagne: 0 }, mer: false, rivieres: 1, forets: 0.12, essences: ['chene', 'bouleau', 'peuplier'], bocage: false,
    champsVoisins: ['betterave', 'ble', 'patate', 'orge', 'colza'], architecture: { mur: '#b0553a', toit: '#5a6068', toitType: 'ardoise', pente: 1.0, volets: '#e8e2d0', brique: true },
    meteo: [[0.3, 0.38, 0.29, 0.03, 0], [0.45, 0.3, 0.2, 0.05, 0], [0.2, 0.4, 0.37, 0.03, 0], [0.15, 0.4, 0.3, 0, 0.15]],
    aptitudes: { betterave: 1.3, pommes_de_terre: 1.25, orge: 1.2, ble: 1.15, vaches: 1.3, lavande: 0.3, olivier: 0 },
    cultures: ['ble', 'orge', 'betterave', 'pommes_de_terre', 'colza', 'legumes', 'lin', 'houblon', 'prairie', 'ail'], vergers: ['pommier', 'poirier'], elevages: ['vaches', 'poules', 'porcs', 'brebis', 'allaitantes', 'lapins'],
    ateliers: ['fromagerie', 'moulin', 'boulangerie', 'brasserie', 'huilerie', 'charcuterie', 'pressoir', 'beurrerie', 'cidrerie', 'boucherie'], tourisme: 0.9, depart: { parcelle: 'elevage_vaches', atelier: 'fromagerie', argent: 20000 },
    specialites: 'Tommes au lait de vache, bière d\'orge, pommes de terre.',
  },
  {
    id: 'beauce', nom: 'Rase campagne', sous: 'Beauce et Centre', desc: 'Le grenier de la France : openfield à perte de vue, rares bosquets, grosses fermes en pierre et tuiles plates. Le pays des moissonneuses.',
    relief: { amplitude: 8, echelle: 50, montagne: 0 }, mer: false, rivieres: 0, forets: 0.06, essences: ['chene', 'peuplier', 'noyer'], bocage: false,
    champsVoisins: ['ble', 'ble', 'orge', 'colza', 'tournesol', 'mais'], architecture: { mur: '#d6c4a0', toit: '#8a4a32', toitType: 'tuilesPlates', pente: 1.35, volets: '#7a8a6a' },
    meteo: [[0.45, 0.32, 0.2, 0.03, 0], [0.6, 0.24, 0.1, 0.06, 0], [0.38, 0.34, 0.25, 0.03, 0], [0.25, 0.4, 0.22, 0, 0.13]],
    aptitudes: { ble: 1.6, orge: 1.3, colza: 1.2, tournesol: 1.05, mais: 1.0, brebis: 1.1 },
    cultures: ['ble', 'orge', 'colza', 'tournesol', 'mais', 'betterave', 'lin', 'prairie', 'sarrasin'], vergers: ['pommier', 'poirier'], elevages: ['brebis', 'poules', 'vaches', 'allaitantes'],
    ateliers: ['moulin', 'boulangerie', 'huilerie', 'brasserie', 'fromagerie', 'boucherie', 'beurrerie'], tourisme: 0.8, depart: { parcelle: 'champ_ble', atelier: 'moulin', argent: 24000, hangar: true, second: 'boulangerie' },
    specialites: 'Blé, farine et pain ; huiles de colza et tournesol.',
  },
  {
    id: 'est', nom: 'Piémont de l\'Est', sous: 'Alsace et Lorraine', desc: 'Coteaux de vignes au pied des Vosges, vergers de mirabelliers, maisons à colombages et toits pentus. Hivers froids et neigeux.',
    relief: { amplitude: 110, echelle: 26, montagne: 0.25 }, mer: false, rivieres: 1, forets: 0.35, essences: ['sapin', 'hetre', 'chene', 'bouleau'], bocage: false,
    champsVoisins: ['vigne', 'ble', 'mais', 'orge', 'legumes'], architecture: { mur: '#efe2c4', toit: '#b8503a', toitType: 'tuilesPlates', pente: 1.6, volets: '#6f8a5a', colombages: true },
    meteo: [[0.4, 0.33, 0.24, 0.03, 0], [0.55, 0.22, 0.13, 0.1, 0], [0.3, 0.38, 0.29, 0.03, 0], [0.18, 0.37, 0.1, 0, 0.35]],
    aptitudes: { mirabellier: 1.15, vigne: 1.15, porcs: 1.1, legumes: 1.05 },
    cultures: ['ble', 'orge', 'mais', 'legumes', 'pommes_de_terre', 'houblon', 'asperges', 'prairie'], vergers: ['mirabellier', 'vigne', 'pommier', 'prunier', 'cerisier', 'poirier'], elevages: ['porcs', 'vaches', 'poules', 'ruches', 'oies', 'lapins', 'truites'],
    ateliers: ['conserverie', 'chai', 'brasserie', 'charcuterie', 'pressoir', 'fromagerie', 'boulangerie', 'moulin', 'fumoir', 'boucherie', 'confiserie', 'beurrerie'], tourisme: 1.1, depart: { parcelle: 'verger_mirabellier', atelier: 'conserverie', argent: 18000 },
    specialites: 'Confitures de mirabelles, vin blanc, charcuterie, bière.',
  },
  {
    id: 'sudouest', nom: 'Sud-Ouest', sous: 'Gascogne et Lot-et-Garonne', desc: 'Collines dorées, champs de tournesols et de maïs, pruniers d\'ente et canards. Tuiles canal et pierre blonde.',
    relief: { amplitude: 80, echelle: 18, montagne: 0 }, mer: false, rivieres: 1, forets: 0.22, essences: ['chene', 'peuplier', 'noyer', 'pin'], bocage: false,
    champsVoisins: ['tournesol', 'mais', 'ble', 'vigne'], architecture: { mur: '#e2c89a', toit: '#c06a40', toitType: 'tuiles', pente: 0.9, volets: '#8aa0b8' },
    meteo: [[0.5, 0.28, 0.19, 0.03, 0], [0.72, 0.14, 0.06, 0.08, 0], [0.45, 0.3, 0.22, 0.03, 0], [0.3, 0.38, 0.27, 0, 0.05]],
    aptitudes: { tournesol: 1.3, mais: 1.25, prunier: 1.3, canards: 1.3, vigne: 1.1 },
    cultures: ['tournesol', 'mais', 'ble', 'colza', 'legumes', 'soja', 'melons', 'ail', 'asperges', 'fraises', 'prairie'], vergers: ['prunier', 'vigne', 'noyer', 'pommier', 'chataigneraie', 'abricotier', 'cerisier', 'truffiere'], elevages: ['canards', 'poules', 'porcs', 'brebis', 'ruches', 'oies', 'allaitantes', 'truites'],
    ateliers: ['conserverie', 'chai', 'huilerie', 'moulin', 'boulangerie', 'charcuterie', 'confiserie', 'boucherie', 'fumoir'], tourisme: 1.2, depart: { parcelle: 'elevage_canards', atelier: 'conserverie', argent: 18000 },
    specialites: 'Confits de canard, pruneaux, vin, huile de tournesol.',
  },
  {
    id: 'montagne', nom: 'Moyenne montagne', sous: 'Auvergne et Massif central', desc: 'Volcans, estives, forêts de sapins et burons de pierre sombre aux toits de lauzes. Fromages de caractère, hivers enneigés.',
    relief: { amplitude: 200, echelle: 20, montagne: 0.7 }, mer: false, rivieres: 2, forets: 0.3, essences: ['sapin', 'epicea', 'hetre', 'bouleau'], bocage: true,
    champsVoisins: ['pre', 'pre', 'orge', 'pre'], architecture: { mur: '#7a746c', toit: '#4f4a46', toitType: 'lauzes', pente: 1.3, volets: '#a8553a' },
    meteo: [[0.35, 0.35, 0.22, 0.03, 0.05], [0.55, 0.25, 0.12, 0.08, 0], [0.3, 0.36, 0.26, 0.02, 0.06], [0.2, 0.3, 0.08, 0, 0.42]],
    aptitudes: { vaches: 1.25, chevres: 1.15, ruches: 1.15, ble: 0.7, mais: 0.5, tournesol: 0.3, vigne: 0.4, olivier: 0 },
    cultures: ['orge', 'pommes_de_terre', 'legumes', 'ble', 'prairie', 'sarrasin'], vergers: ['pommier', 'chataigneraie', 'cerisier'], elevages: ['vaches', 'chevres', 'brebis', 'ruches', 'porcs', 'poules', 'allaitantes', 'truites', 'lapins'],
    ateliers: ['fromagerie', 'charcuterie', 'boulangerie', 'brasserie', 'conserverie', 'beurrerie', 'boucherie', 'fumoir', 'confiserie'], tourisme: 1.2, depart: { parcelle: 'elevage_vaches', atelier: 'fromagerie', argent: 20000 },
    specialites: 'Tommes et fromages de montagne, charcuterie, miel de montagne.',
  },
  {
    id: 'mer', nom: 'Bord de mer', sous: 'Côte bretonne et normande', desc: 'Littoral, dunes et falaises, prés-salés, bocage et maisons de granit à toits d\'ardoise. Légumes de plein champ et vergers à cidre ; été très touristique.',
    relief: { amplitude: 40, echelle: 20, montagne: 0 }, mer: true, rivieres: 1, forets: 0.18, essences: ['chene', 'pin', 'hetre'], bocage: true,
    champsVoisins: ['legumes', 'pre', 'ble', 'mais'], architecture: { mur: '#b8b4aa', toit: '#4c525a', toitType: 'ardoise', pente: 1.3, volets: '#3f6a8a' },
    meteo: [[0.35, 0.35, 0.25, 0.05, 0], [0.55, 0.25, 0.14, 0.06, 0], [0.28, 0.34, 0.31, 0.07, 0], [0.2, 0.38, 0.38, 0.03, 0.01]],
    aptitudes: { legumes: 1.3, pommier: 1.15, brebis: 1.25, vaches: 1.1, olivier: 0 },
    cultures: ['legumes', 'pommes_de_terre', 'ble', 'mais', 'sarrasin', 'fraises', 'prairie', 'ail'], vergers: ['pommier', 'poirier'], elevages: ['brebis', 'vaches', 'poules', 'porcs', 'lapins', 'truites'],
    ateliers: ['conserverie', 'pressoir', 'fromagerie', 'boulangerie', 'moulin', 'charcuterie', 'creperie', 'cidrerie', 'beurrerie', 'boucherie'], tourisme: 1.6, depart: { parcelle: 'champ_legumes', atelier: 'conserverie', argent: 18000 },
    specialites: 'Légumes primeurs et bocaux, jus de pomme, agneaux de pré-salé.',
  },
  {
    id: 'provence', nom: 'Collines de Provence', sous: 'Luberon et Haute-Provence', desc: 'Garrigue, champs de lavande, oliviers et vignes sous un soleil généreux. Mas en pierre claire et tuiles roses ; visiteurs nombreux.',
    relief: { amplitude: 130, echelle: 18, montagne: 0.15 }, mer: false, rivieres: 1, forets: 0.25, essences: ['pin', 'chene', 'cypres', 'olivierSauvage'], bocage: false,
    champsVoisins: ['lavande', 'vigne', 'ble', 'tournesol'], architecture: { mur: '#ead8b8', toit: '#cf8060', toitType: 'tuiles', pente: 0.85, volets: '#8aaaa0' },
    meteo: [[0.6, 0.24, 0.13, 0.03, 0], [0.8, 0.1, 0.03, 0.07, 0], [0.52, 0.25, 0.18, 0.05, 0], [0.48, 0.3, 0.19, 0, 0.03]],
    aptitudes: { lavande: 1.5, olivier: 1.3, vigne: 1.2, chevres: 1.1, ruches: 1.25, vaches: 0.7, betterave: 0.3 },
    cultures: ['lavande', 'ble', 'tournesol', 'legumes', 'melons', 'fraises', 'asperges', 'ail', 'prairie'], vergers: ['olivier', 'vigne', 'abricotier', 'cerisier', 'truffiere'], elevages: ['chevres', 'brebis', 'ruches', 'poules', 'lapins'],
    ateliers: ['distillerie', 'huilerie', 'chai', 'fromagerie', 'boulangerie', 'moulin', 'confiserie'], tourisme: 1.7, depart: { parcelle: 'champ_lavande', atelier: 'distillerie', argent: 18000 },
    specialites: 'Huile essentielle de lavande, huile d\'olive, vin rosé, fromages de chèvre.',
  },
];

export const REGION_BY_ID: Record<string, RegionDef> = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

/** Bâtiments constructibles dans une région. */
// V0.6 : spécialités régionales supplémentaires
const EXTRA: Record<string, Partial<Pick<RegionDef, 'cultures' | 'vergers' | 'elevages' | 'ateliers'>>> = {
  limousin: { cultures: ['lentilles', 'safran', 'chanvre'], vergers: ['noisetier', 'myrtillier'], elevages: ['brebis_lait'], ateliers: ['nougaterie', 'distillerie_fruits', 'conserverie'] },
  nord: { cultures: ['chanvre', 'lentilles'], vergers: ['cerisier'], elevages: ['brebis_lait'], ateliers: ['distillerie_fruits', 'beurrerie'] },
  beauce: { cultures: ['lentilles', 'chanvre', 'safran'], vergers: ['cerisier'], elevages: ['porcs'], ateliers: ['patisserie'] },
  est: { cultures: ['chanvre'], vergers: ['myrtillier', 'noisetier'], elevages: ['brebis_lait', 'chevres'], ateliers: ['distillerie_fruits'] },
  sudouest: { cultures: ['piments'], vergers: ['noisetier', 'pecher', 'figuier', 'poirier'], elevages: ['brebis_lait', 'chevres'], ateliers: ['distillerie_fruits', 'nougaterie'] },
  montagne: { cultures: ['lentilles'], vergers: ['myrtillier', 'noisetier'], elevages: ['brebis_lait', 'oies'], ateliers: ['distillerie_fruits'] },
  mer: { cultures: ['chanvre', 'lentilles'], vergers: ['cerisier'], elevages: ['brebis_lait', 'chevres', 'canards'], ateliers: ['distillerie_fruits'] },
  provence: { cultures: ['riz', 'safran', 'piments'], vergers: ['amandier', 'figuier', 'pecher', 'citronnier', 'noisetier'], elevages: ['brebis_lait', 'porcs'], ateliers: ['nougaterie', 'distillerie_fruits', 'conserverie'] },
};
for (const r of REGIONS) {
  const e = EXTRA[r.id];
  if (!e) continue;
  for (const k of ['cultures', 'vergers', 'elevages', 'ateliers'] as const) for (const v of e[k] ?? []) if (!r[k].includes(v)) r[k].push(v);
}

export function regionBuildings(r: RegionDef): Set<string> {
  return new Set([...COMMUNS, ...(r.vergers.includes('vigne') ? ['remise_viti'] : []), ...r.cultures.map((c) => 'champ_' + c), ...r.vergers.map((v) => 'verger_' + v), ...r.elevages.map((e) => 'elevage_' + e), ...r.ateliers]);
}

/** Rendement relatif d'une production dans la région (1 par défaut). */
export const aptitude = (r: RegionDef, id: string) => r.aptitudes[id] ?? 1;
