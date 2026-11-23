// Données de contenu déclaratives : ressources, bâtiments, recettes, rôles.
// Toutes les valeurs économiques du jeu sont ici, modifiables sans toucher au moteur.

export type Res = 'pommes' | 'jus' | 'lait' | 'fromage' | 'ble' | 'farine' | 'pain';
export type Activity = 'pomme' | 'chevre' | 'ble' | 'accueil' | 'general';

export const ACTIVITIES: Record<Activity, string> = {
  pomme: 'Pommes & jus',
  chevre: 'Chèvres & fromage',
  ble: 'Blé, farine & pain',
  accueil: 'Accueil & visites',
  general: 'Domaine (frais généraux)',
};

export interface ResDef {
  id: Res;
  nom: string;
  unite: string;
  prix: number; // prix de vente conseillé en boutique (€ / unité)
  activite: Activity;
  boutique: boolean; // vendable aux visiteurs
}

export const RESOURCES: Record<Res, ResDef> = {
  pommes: { id: 'pommes', nom: 'Pommes', unite: 'kg', prix: 1.8, activite: 'pomme', boutique: true },
  jus: { id: 'jus', nom: 'Jus de pomme', unite: 'bouteille', prix: 4.8, activite: 'pomme', boutique: true },
  lait: { id: 'lait', nom: 'Lait de chèvre', unite: 'L', prix: 1.6, activite: 'chevre', boutique: true },
  fromage: { id: 'fromage', nom: 'Tomme de chèvre', unite: 'pièce', prix: 9, activite: 'chevre', boutique: true },
  ble: { id: 'ble', nom: 'Blé', unite: 'kg', prix: 0.35, activite: 'ble', boutique: false },
  farine: { id: 'farine', nom: 'Farine', unite: 'kg', prix: 2.2, activite: 'ble', boutique: true },
  pain: { id: 'pain', nom: 'Pain de campagne', unite: 'pièce', prix: 3.2, activite: 'ble', boutique: true },
};
export const RES_IDS = Object.keys(RESOURCES) as Res[];

// Prix payé par le négociant (vente en gros, enlèvement par camionnette).
export const WHOLESALE_FACTOR = 0.6;

export interface Recipe {
  input: Res;
  inQty: number;
  output: Res;
  outQty: number;
  minutes: number;
  consommables: number; // € par lot (bouteilles, présure, bois…)
  consoLabel: string;
}

export type BuildingKind = 'maison' | 'stock' | 'hangar' | 'verger' | 'champ' | 'enclos' | 'atelier' | 'boutique' | 'accueil';

export interface BuildingDef {
  id: string;
  nom: string;
  desc: string;
  kind: BuildingKind;
  size: number; // emprise carrée (cases)
  cout: number;
  entretien: number; // €/jour
  activite: Activity;
  capacite?: number; // stockage (grange) ou rayonnage (boutique)
  recette?: Recipe;
  unique?: boolean;
  constructible: boolean;
}

export const BUILDINGS: Record<string, BuildingDef> = {
  maison: { id: 'maison', nom: 'Maison du domaine', desc: 'Logis du domaine. Le personnel y prend son repos hors des heures de travail.', kind: 'maison', size: 3, cout: 0, entretien: 12, activite: 'general', unique: true, constructible: false },
  grange: { id: 'grange', nom: 'Grange', desc: 'Stockage de toutes les récoltes et productions du domaine.', kind: 'stock', size: 3, cout: 3200, entretien: 8, activite: 'general', capacite: 400, constructible: true },
  hangar: { id: 'hangar', nom: 'Hangar & tracteur', desc: 'Abrite un tracteur avec remorque : moisson du blé bien plus rapide.', kind: 'hangar', size: 3, cout: 9500, entretien: 22, activite: 'ble', constructible: true },
  verger: { id: 'verger', nom: 'Verger de pommiers', desc: '16 pommiers. Les fruits mûrissent en été et en automne ; floraison au printemps.', kind: 'verger', size: 4, cout: 1900, entretien: 4, activite: 'pomme', constructible: true },
  champ: { id: 'champ', nom: 'Parcelle de blé', desc: 'Le blé pousse au fil des jours puis se moissonne ; ressemis automatique (semences 24 €).', kind: 'champ', size: 4, cout: 900, entretien: 3, activite: 'ble', constructible: true },
  enclos: { id: 'enclos', nom: 'Enclos caprin', desc: 'Six chèvres et leur abri. Traite par un éleveur. Foin compris dans l\'entretien.', kind: 'enclos', size: 4, cout: 2600, entretien: 14, activite: 'chevre', constructible: true },
  pressoir: { id: 'pressoir', nom: 'Pressoir', desc: 'Presse les pommes en jus mis en bouteille.', kind: 'atelier', size: 2, cout: 3600, entretien: 6, activite: 'pomme', constructible: true,
    recette: { input: 'pommes', inQty: 8, output: 'jus', outQty: 5, minutes: 50, consommables: 2, consoLabel: 'bouteilles et bouchons' } },
  fromagerie: { id: 'fromagerie', nom: 'Fromagerie', desc: 'Transforme le lait de chèvre en tommes.', kind: 'atelier', size: 2, cout: 5200, entretien: 9, activite: 'chevre', constructible: true,
    recette: { input: 'lait', inQty: 10, output: 'fromage', outQty: 2, minutes: 80, consommables: 1.2, consoLabel: 'présure et sel' } },
  moulin: { id: 'moulin', nom: 'Moulin', desc: 'Moud le blé en farine.', kind: 'atelier', size: 2, cout: 6000, entretien: 10, activite: 'ble', constructible: true,
    recette: { input: 'ble', inQty: 20, output: 'farine', outQty: 15, minutes: 45, consommables: 0.8, consoLabel: 'entretien des meules' } },
  boulangerie: { id: 'boulangerie', nom: 'Boulangerie', desc: 'Four à bois : pains de campagne.', kind: 'atelier', size: 2, cout: 4600, entretien: 8, activite: 'ble', constructible: true,
    recette: { input: 'farine', inQty: 5, output: 'pain', outQty: 12, minutes: 70, consommables: 3, consoLabel: 'bois de four, levain, sel' } },
  boutique: { id: 'boutique', nom: 'Boutique de la ferme', desc: 'Vente directe aux visiteurs. Un membre du personnel doit tenir la caisse.', kind: 'boutique', size: 2, cout: 3200, entretien: 7, activite: 'general', capacite: 90, constructible: true },
  accueil: { id: 'accueil', nom: 'Accueil des visiteurs', desc: 'Attire davantage de visiteurs et propose une visite de la ferme (tarif réglable).', kind: 'accueil', size: 2, cout: 3800, entretien: 9, activite: 'accueil', constructible: true },
};

export const PATH_COST = 14; // € par case de chemin
export const TREE_CLEAR_COST = 35; // € par arbre/buisson défriché
export const LOT_SIZE = 16;
export const LOT_PRICE = 4500;

export type Role = 'cultivateur' | 'eleveur' | 'artisan' | 'vendeur';
export interface RoleDef {
  id: Role;
  nom: string;
  salaire: number; // €/jour
  desc: string;
}
export const ROLES: Record<Role, RoleDef> = {
  cultivateur: { id: 'cultivateur', nom: 'Cultivateur', salaire: 72, desc: 'Récolte le verger, moissonne le blé (au tracteur s\'il y a un hangar).' },
  eleveur: { id: 'eleveur', nom: 'Éleveur', salaire: 72, desc: 'Trait les chèvres ; aide aux récoltes quand il n\'y a pas de traite.' },
  artisan: { id: 'artisan', nom: 'Artisan', salaire: 80, desc: 'Fait tourner les ateliers ; réassortit et tient la boutique sinon.' },
  vendeur: { id: 'vendeur', nom: 'Vendeur', salaire: 64, desc: 'Tient la boutique et réassortit les rayons.' },
};

export const FIRST_NAMES = ['Mathilde', 'Pierre', 'Jeanne', 'Antoine', 'Lucie', 'Bastien', 'Odile', 'Rémi', 'Margaux', 'Étienne', 'Camille', 'Jules', 'Élise', 'Gaspard', 'Rose', 'Hugo'];

// Production agricole
export const ORCHARD_RATE = 4.2; // kg de pommes mûrissant par heure de jour (16 arbres)
export const ORCHARD_CAP = 140;
export const GOATS_PER_PEN = 6;
export const MILK_PER_GOAT_H = 0.13; // L/h
export const PEN_MILK_CAP = 50;
export const WHEAT_YIELD = 130; // kg par moisson de parcelle
export const WHEAT_SEED_COST = 24;
export const CARRY = 25;

export const DAY_MIN = 1440;
export const DAYS_PER_SEASON = 7;
export const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'] as const;
export type Season = 0 | 1 | 2 | 3;
export const ORCHARD_SEASON = [0, 0.8, 1.3, 0];
export const MILK_SEASON = [1.1, 1, 0.9, 0.6];
export const WHEAT_GROWTH = [0.15, 0.13, 0.06, 0.03];

export type Weather = 'soleil' | 'nuageux' | 'pluie' | 'orage' | 'neige';
export const WEATHER: Record<Weather, { nom: string; rendement: number; visiteurs: number }> = {
  soleil: { nom: 'Ensoleillé', rendement: 1.1, visiteurs: 1.15 },
  nuageux: { nom: 'Nuageux', rendement: 1, visiteurs: 1 },
  pluie: { nom: 'Pluie', rendement: 0.85, visiteurs: 0.55 },
  orage: { nom: 'Orage', rendement: 0.6, visiteurs: 0.2 },
  neige: { nom: 'Neige', rendement: 0.5, visiteurs: 0.35 },
};
// Probabilités par saison [soleil, nuageux, pluie, orage, neige]
export const WEATHER_TABLE: number[][] = [
  [0.45, 0.3, 0.22, 0.03, 0],
  [0.62, 0.2, 0.1, 0.08, 0],
  [0.35, 0.33, 0.28, 0.04, 0],
  [0.25, 0.35, 0.2, 0, 0.2],
];

export const WORK_START = 7 * 60;
export const WORK_END = 19 * 60;
export const VISIT_START = 9 * 60;
export const VISIT_END = 18 * 60;
export const VISIT_FEE_DEFAULT = 4;
