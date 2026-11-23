// Données de contenu déclaratives : ressources, cultures, vergers, élevages, ateliers, bâtiments, rôles.
// Toutes les valeurs économiques sont ici ; les régions (regions.ts) choisissent ce qui est disponible.

export type Res = string;
export type Activity = 'verger' | 'cereales' | 'grandes' | 'maraichage' | 'vigne' | 'lavande' | 'lait' | 'elevage' | 'apiculture' | 'accueil' | 'general';

export const ACTIVITIES: Record<Activity, string> = {
  verger: 'Vergers & fruits',
  cereales: 'Céréales, farine & pain',
  grandes: 'Grandes cultures & huiles',
  maraichage: 'Maraîchage',
  vigne: 'Vigne & vin',
  lavande: 'Lavande',
  lait: 'Lait & fromages',
  elevage: 'Élevage & viandes',
  apiculture: 'Apiculture',
  accueil: 'Accueil & visites',
  general: 'Domaine (frais généraux)',
};

export interface ResDef {
  id: Res;
  nom: string;
  unite: string;
  prix: number; // prix de référence (€ / unité)
  activite: Activity;
  boutique: boolean; // vendable aux visiteurs
  couleur: string; // pictogramme et caisses
}

const R = (id: string, nom: string, unite: string, prix: number, activite: Activity, boutique: boolean, couleur: string): ResDef => ({ id, nom, unite, prix, activite, boutique, couleur });
export const RESOURCES: Record<Res, ResDef> = Object.fromEntries(
  [
    R('pommes', 'Pommes', 'kg', 1.8, 'verger', true, '#d2322a'),
    R('jus', 'Jus de pomme', 'bouteille', 4.8, 'verger', true, '#e8a32a'),
    R('prunes', 'Prunes d\'ente', 'kg', 2.4, 'verger', true, '#6a3a7a'),
    R('pruneaux', 'Pruneaux', 'sachet', 6.5, 'verger', true, '#3a1a2a'),
    R('mirabelles', 'Mirabelles', 'kg', 3.2, 'verger', true, '#e8c03a'),
    R('confiture', 'Confiture', 'pot', 5.5, 'verger', true, '#c8402a'),
    R('noix', 'Noix', 'kg', 4.2, 'verger', true, '#9a7448'),
    R('huile_noix', 'Huile de noix', 'bouteille', 14, 'verger', true, '#a8842a'),
    R('olives', 'Olives', 'kg', 2.6, 'verger', true, '#4a5a2a'),
    R('huile_olive', 'Huile d\'olive', 'bouteille', 16, 'verger', true, '#8a9a2a'),
    R('raisin', 'Raisin', 'kg', 1.3, 'vigne', true, '#5a2a6a'),
    R('vin', 'Vin du domaine', 'bouteille', 9, 'vigne', true, '#7a1a2a'),
    R('lavande', 'Lavande', 'botte', 3, 'lavande', true, '#8a66c8'),
    R('essence', 'Huile essentielle de lavande', 'flacon', 12, 'lavande', true, '#a888e0'),
    R('ble', 'Blé', 'kg', 0.5, 'cereales', false, '#e0b84a'),
    R('farine', 'Farine', 'kg', 2.2, 'cereales', true, '#efe7d8'),
    R('pain', 'Pain de campagne', 'pièce', 3.2, 'cereales', true, '#c88a4a'),
    R('orge', 'Orge', 'kg', 0.45, 'cereales', false, '#d8c070'),
    R('biere', 'Bière de la ferme', 'bouteille', 3.6, 'cereales', true, '#d89a2a'),
    R('mais', 'Maïs grain', 'kg', 0.4, 'grandes', false, '#f0c430'),
    R('tournesol', 'Graines de tournesol', 'kg', 0.9, 'grandes', false, '#3a3020'),
    R('colza', 'Graines de colza', 'kg', 0.85, 'grandes', false, '#2a2018'),
    R('huile', 'Huile vierge', 'bouteille', 6, 'grandes', true, '#e8c84a'),
    R('betterave', 'Betteraves sucrières', 'kg', 0.12, 'grandes', false, '#e8dcc0'),
    R('pommes_de_terre', 'Pommes de terre', 'kg', 1, 'maraichage', true, '#c8a060'),
    R('legumes', 'Légumes de saison', 'kg', 2.6, 'maraichage', true, '#5f9a3a'),
    R('bocaux', 'Bocaux de légumes', 'bocal', 6, 'maraichage', true, '#7aa64a'),
    R('lait_chevre', 'Lait de chèvre', 'L', 1.6, 'lait', true, '#f4f0e6'),
    R('fromage_chevre', 'Fromage de chèvre', 'pièce', 9, 'lait', true, '#f0e0a8'),
    R('lait', 'Lait de vache', 'L', 0.9, 'lait', true, '#fbfaf5'),
    R('tomme', 'Tomme fermière', 'pièce', 15, 'lait', true, '#e8c870'),
    R('oeufs', 'Œufs', 'boîte de 6', 2.8, 'elevage', true, '#f0dcb8'),
    R('agneaux', 'Agneaux', 'tête', 140, 'elevage', false, '#e8e2d0'),
    R('canards', 'Canards gras', 'tête', 18, 'elevage', false, '#7a8a6a'),
    R('confit', 'Confit de canard', 'bocal', 14, 'elevage', true, '#b87a3a'),
    R('porcs', 'Porcs', 'tête', 180, 'elevage', false, '#e8a8a0'),
    R('charcuterie', 'Charcuterie', 'kg', 18, 'elevage', true, '#b84a4a'),
    R('miel', 'Miel', 'pot', 8, 'apiculture', true, '#e8a82a'),
  ].map((r) => [r.id, r]),
);
export const RES_IDS = Object.keys(RESOURCES) as Res[];

/** Le négociant paie 70 % du prix de référence pour les produits de boutique, 90 % pour les matières brutes. */
export const wholesaleFactor = (r: Res) => (RESOURCES[r].boutique ? 0.7 : 0.9);

// ————— cultures annuelles (parcelles) —————
export type PlantLook = 'cereale' | 'mais' | 'tournesol' | 'colza' | 'betterave' | 'patate' | 'lavande' | 'legumes';
export interface CropDef {
  id: string;
  nom: string;
  produit: Res;
  rendement: number; // par parcelle 4×4
  croissance: [number, number, number, number]; // progression / jour selon la saison
  recolte: 'moissonneuse' | 'tracteur' | 'main';
  semence: number; // € par semis
  vivace?: boolean; // repousse sans labour (lavande)
  look: PlantLook;
  cout: number;
}
export const CROPS: Record<string, CropDef> = {
  ble: { id: 'ble', nom: 'Blé tendre', produit: 'ble', rendement: 520, croissance: [0.15, 0.13, 0.06, 0.03], recolte: 'moissonneuse', semence: 24, look: 'cereale', cout: 900 },
  orge: { id: 'orge', nom: 'Orge de brasserie', produit: 'orge', rendement: 500, croissance: [0.16, 0.14, 0.06, 0.03], recolte: 'moissonneuse', semence: 22, look: 'cereale', cout: 900 },
  mais: { id: 'mais', nom: 'Maïs', produit: 'mais', rendement: 600, croissance: [0.08, 0.16, 0.1, 0], recolte: 'moissonneuse', semence: 30, look: 'mais', cout: 950 },
  tournesol: { id: 'tournesol', nom: 'Tournesol', produit: 'tournesol', rendement: 220, croissance: [0.1, 0.17, 0.06, 0], recolte: 'moissonneuse', semence: 26, look: 'tournesol', cout: 950 },
  colza: { id: 'colza', nom: 'Colza', produit: 'colza', rendement: 240, croissance: [0.16, 0.12, 0.08, 0.04], recolte: 'moissonneuse', semence: 26, look: 'colza', cout: 950 },
  betterave: { id: 'betterave', nom: 'Betterave sucrière', produit: 'betterave', rendement: 1260, croissance: [0.1, 0.12, 0.1, 0.01], recolte: 'tracteur', semence: 30, look: 'betterave', cout: 1000 },
  pommes_de_terre: { id: 'pommes_de_terre', nom: 'Pommes de terre', produit: 'pommes_de_terre', rendement: 520, croissance: [0.16, 0.15, 0.05, 0], recolte: 'tracteur', semence: 40, look: 'patate', cout: 1000 },
  lavande: { id: 'lavande', nom: 'Lavande', produit: 'lavande', rendement: 220, croissance: [0.12, 0.18, 0.03, 0], recolte: 'main', semence: 0, vivace: true, look: 'lavande', cout: 1400 },
  legumes: { id: 'legumes', nom: 'Potager de maraîchage', produit: 'legumes', rendement: 150, croissance: [0.3, 0.32, 0.22, 0.06], recolte: 'main', semence: 18, look: 'legumes', cout: 1100 },
};

// ————— vergers et vignes (arbres pérennes) —————
export type TreeLook = 'pommier' | 'prunier' | 'mirabellier' | 'noyer' | 'olivier' | 'vigne';
export interface OrchardDef {
  id: string;
  nom: string;
  produit: Res;
  taux: number; // kg mûrissant par heure de jour (parcelle 4×4)
  cap: number;
  saisons: [number, number, number, number];
  look: TreeLook;
  cout: number;
}
export const ORCHARDS: Record<string, OrchardDef> = {
  pommier: { id: 'pommier', nom: 'Verger de pommiers', produit: 'pommes', taux: 6.72, cap: 196, saisons: [0, 0.8, 1.3, 0], look: 'pommier', cout: 1900 },
  prunier: { id: 'prunier', nom: 'Verger de pruniers d\'ente', produit: 'prunes', taux: 5.76, cap: 168, saisons: [0, 1.4, 0.6, 0], look: 'prunier', cout: 2000 },
  mirabellier: { id: 'mirabellier', nom: 'Verger de mirabelliers', produit: 'mirabelles', taux: 4.8, cap: 140, saisons: [0, 1.5, 0.4, 0], look: 'mirabellier', cout: 2100 },
  noyer: { id: 'noyer', nom: 'Noyeraie', produit: 'noix', taux: 2.56, cap: 112, saisons: [0, 0.1, 1.9, 0.1], look: 'noyer', cout: 2400 },
  olivier: { id: 'olivier', nom: 'Oliveraie', produit: 'olives', taux: 3.84, cap: 126, saisons: [0, 0.2, 1.1, 1.0], look: 'olivier', cout: 2600 },
  vigne: { id: 'vigne', nom: 'Vigne', produit: 'raisin', taux: 7.04, cap: 210, saisons: [0, 0.4, 1.8, 0], look: 'vigne', cout: 2300 },
};

// ————— élevages —————
export type AnimalLook = 'chevre' | 'vache' | 'brebis' | 'poule' | 'canard' | 'cochon' | 'ruche';
export interface LivestockDef {
  id: string;
  nom: string;
  animal: AnimalLook;
  nombre: number;
  produit: Res;
  tauxParTete: number; // unités / heure / animal
  cap: number;
  saisons: [number, number, number, number];
  entretien: number; // nourriture, soins (€/jour)
  cout: number;
  abri: 'abri' | 'etable' | 'bergerie' | 'poulailler' | 'porcherie' | 'rucher';
}
export const LIVESTOCK: Record<string, LivestockDef> = {
  chevres: { id: 'chevres', nom: 'Enclos caprin', animal: 'chevre', nombre: 6, produit: 'lait_chevre', tauxParTete: 0.208, cap: 70, saisons: [1.1, 1, 0.9, 0.6], entretien: 14, cout: 2600, abri: 'abri' },
  vaches: { id: 'vaches', nom: 'Étable et pré (vaches laitières)', animal: 'vache', nombre: 6, produit: 'lait', tauxParTete: 1.2, cap: 224, saisons: [1.1, 1, 0.95, 0.85], entretien: 28, cout: 6800, abri: 'etable' },
  brebis: { id: 'brebis', nom: 'Bergerie (agneaux)', animal: 'brebis', nombre: 8, produit: 'agneaux', tauxParTete: 0.00192, cap: 8, saisons: [1.6, 0.8, 0.8, 0.8], entretien: 16, cout: 3400, abri: 'bergerie' },
  poules: { id: 'poules', nom: 'Poulailler', animal: 'poule', nombre: 14, produit: 'oeufs', tauxParTete: 0.012, cap: 42, saisons: [1.1, 1, 0.8, 0.5], entretien: 6, cout: 1200, abri: 'poulailler' },
  canards: { id: 'canards', nom: 'Parc à canards', animal: 'canard', nombre: 10, produit: 'canards', tauxParTete: 0.0096, cap: 28, saisons: [0.8, 0.8, 1.3, 1.1], entretien: 12, cout: 2400, abri: 'poulailler' },
  porcs: { id: 'porcs', nom: 'Porcherie plein air', animal: 'cochon', nombre: 5, produit: 'porcs', tauxParTete: 0.0072, cap: 8, saisons: [1, 1, 1, 1], entretien: 18, cout: 4200, abri: 'porcherie' },
  ruches: { id: 'ruches', nom: 'Rucher', animal: 'ruche', nombre: 6, produit: 'miel', tauxParTete: 0.0192, cap: 56, saisons: [1.3, 1.4, 0.4, 0], entretien: 3, cout: 1500, abri: 'rucher' },
};

// ————— ateliers de transformation —————
export interface Recipe {
  input: Res;
  inQty: number;
  output: Res;
  outQty: number;
  minutes: number;
  consommables: number; // € par lot
  consoLabel: string;
}
const rc = (input: Res, inQty: number, output: Res, outQty: number, minutes: number, consommables: number, consoLabel: string): Recipe => ({ input, inQty, output, outQty, minutes, consommables, consoLabel });
export const WORKSHOPS: Record<string, { nom: string; desc: string; cout: number; entretien: number; recettes: Recipe[] }> = {
  pressoir: { nom: 'Pressoir', desc: 'Presse les pommes en jus mis en bouteille.', cout: 3600, entretien: 6, recettes: [rc('pommes', 8, 'jus', 5, 50, 2, 'bouteilles et bouchons')] },
  fromagerie: { nom: 'Fromagerie', desc: 'Fromages de chèvre et tommes de vache.', cout: 5200, entretien: 9, recettes: [rc('lait_chevre', 10, 'fromage_chevre', 3, 80, 1.2, 'présure et sel'), rc('lait', 20, 'tomme', 2, 140, 2, 'présure, sel, toile')] },
  moulin: { nom: 'Moulin', desc: 'Moud le blé en farine.', cout: 6000, entretien: 10, recettes: [rc('ble', 50, 'farine', 38, 50, 2, 'entretien des meules')] },
  boulangerie: { nom: 'Boulangerie', desc: 'Four à bois : pains de campagne.', cout: 4600, entretien: 8, recettes: [rc('farine', 5, 'pain', 12, 70, 3, 'bois de four, levain, sel')] },
  brasserie: { nom: 'Brasserie', desc: 'Bière de la ferme à partir de l\'orge.', cout: 7800, entretien: 12, recettes: [rc('orge', 20, 'biere', 30, 150, 9, 'houblon, bouteilles, capsules')] },
  chai: { nom: 'Chai', desc: 'Vinification et mise en bouteille.', cout: 8200, entretien: 12, recettes: [rc('raisin', 15, 'vin', 10, 110, 6, 'bouteilles, bouchons, étiquettes')] },
  huilerie: { nom: 'Huilerie', desc: 'Presse olives, noix, tournesol et colza.', cout: 6400, entretien: 10, recettes: [rc('olives', 10, 'huile_olive', 3, 70, 1.6, 'bouteilles'), rc('noix', 8, 'huile_noix', 3, 70, 1.6, 'bouteilles'), rc('tournesol', 15, 'huile', 6, 60, 2.4, 'bouteilles'), rc('colza', 15, 'huile', 6, 60, 2.4, 'bouteilles')] },
  distillerie: { nom: 'Distillerie de lavande', desc: 'Alambic : huile essentielle de lavande.', cout: 6800, entretien: 10, recettes: [rc('lavande', 20, 'essence', 8, 100, 3, 'flacons, bois de chauffe')] },
  conserverie: { nom: 'Conserverie', desc: 'Pruneaux, confitures, bocaux et confits.', cout: 5600, entretien: 9, recettes: [rc('prunes', 10, 'pruneaux', 6, 90, 1.5, 'sachets'), rc('mirabelles', 6, 'confiture', 8, 70, 4, 'sucre et pots'), rc('legumes', 8, 'bocaux', 6, 60, 3, 'bocaux et sel'), rc('canards', 1, 'confit', 4, 120, 4, 'bocaux et sel')] },
  charcuterie: { nom: 'Atelier de charcuterie', desc: 'Jambons, saucissons et pâtés.', cout: 7200, entretien: 12, recettes: [rc('porcs', 1, 'charcuterie', 38, 240, 14, 'sel, épices, boyaux')] },
};

// ————— bâtiments —————
export type BuildingKind = 'maison' | 'stock' | 'hangar' | 'remise' | 'verger' | 'champ' | 'enclos' | 'atelier' | 'boutique' | 'accueil';
export type BuildCategory = 'base' | 'cultures' | 'vergers' | 'elevages' | 'ateliers' | 'accueil';

export interface BuildingDef {
  id: string;
  nom: string;
  desc: string;
  kind: BuildingKind;
  categorie: BuildCategory;
  size: number; // emprise carrée (cases)
  cout: number;
  entretien: number; // €/jour
  activite: Activity;
  capacite?: number;
  recettes?: Recipe[];
  crop?: string;
  orchard?: string;
  livestock?: string;
  unique?: boolean;
  constructible: boolean;
}

const B: BuildingDef[] = [
  { id: 'maison', nom: 'Maison du domaine', desc: 'Logis du domaine. Le personnel y prend son repos hors des heures de travail.', kind: 'maison', categorie: 'base', size: 3, cout: 0, entretien: 6, activite: 'general', unique: true, constructible: false },
  { id: 'grange', nom: 'Grange', desc: 'Stockage de toutes les récoltes et productions du domaine.', kind: 'stock', categorie: 'base', size: 3, cout: 3200, entretien: 5, activite: 'general', capacite: 1200, constructible: true },
  { id: 'hangar', nom: 'Hangar & tracteur', desc: 'Un tracteur avec remorque, charrue, épandeur, semoir et pulvérisateur : labours, fumure (+15 % de récolte), semis, traitement (+10 %), arrachage et transports.', kind: 'hangar', categorie: 'base', size: 3, cout: 12500, entretien: 12, activite: 'grandes', constructible: true },
  { id: 'remise', nom: 'Remise & moissonneuse-batteuse', desc: 'Moissonneuse-batteuse pour les céréales, le colza, le tournesol et le maïs.', kind: 'remise', categorie: 'base', size: 3, cout: 26000, entretien: 18, activite: 'cereales', constructible: true },
  { id: 'remise_viti', nom: 'Hangar viticole & vendangeuse', desc: 'Machine à vendanger enjambeuse : vendanges de la vigne bien plus rapides.', kind: 'remise', categorie: 'base', size: 3, cout: 21000, entretien: 22, activite: 'vigne', constructible: true },
  { id: 'boutique', nom: 'Boutique de la ferme', desc: 'Vente directe aux visiteurs. Un membre du personnel doit tenir la caisse.', kind: 'boutique', categorie: 'accueil', size: 2, cout: 3200, entretien: 4, activite: 'general', capacite: 140, constructible: true },
  { id: 'accueil', nom: 'Accueil des visiteurs', desc: 'Attire davantage de visiteurs et propose une visite de la ferme (tarif réglable).', kind: 'accueil', categorie: 'accueil', size: 2, cout: 3800, entretien: 9, activite: 'accueil', constructible: true },
  ...Object.values(CROPS).map((c): BuildingDef => ({
    id: 'champ_' + c.id, nom: c.id === 'legumes' ? c.nom : `Parcelle — ${c.nom.toLowerCase()}`, kind: 'champ', categorie: 'cultures', size: 4, cout: c.cout, entretien: 3, activite: RESOURCES[c.produit].activite, crop: c.id, constructible: true,
    desc: `Rendement ≈ ${c.rendement} ${RESOURCES[c.produit].unite}. ${c.vivace ? 'Culture vivace : repousse chaque année.' : `Labour puis semis (${c.semence} € de semences)`}${c.recolte === 'moissonneuse' ? ' ; récolte à la moissonneuse (ou à la main, lentement).' : c.recolte === 'tracteur' ? ' ; arrachage au tracteur (ou à la main).' : ' ; récolte à la main.'}`,
  })),
  ...Object.values(ORCHARDS).map((o): BuildingDef => ({
    id: 'verger_' + o.id, nom: o.nom, kind: 'verger', categorie: 'vergers', size: 4, cout: o.cout, entretien: 4, activite: RESOURCES[o.produit].activite, orchard: o.id, constructible: true,
    desc: `16 ${o.id === 'vigne' ? 'rangs de ceps' : 'arbres'}. Récolte à la main ; production surtout en ${['printemps', 'été', 'automne', 'hiver'][o.saisons.indexOf(Math.max(...o.saisons))]}.`,
  })),
  ...Object.values(LIVESTOCK).map((l): BuildingDef => ({
    id: 'elevage_' + l.id, nom: l.nom, kind: 'enclos', categorie: 'elevages', size: l.id === 'ruches' || l.id === 'poules' ? 3 : 4, cout: l.cout, entretien: l.entretien, activite: RESOURCES[l.produit].activite, livestock: l.id, constructible: true,
    desc: `${l.nombre} ${l.animal === 'ruche' ? 'ruches' : 'animaux'} ; produit : ${RESOURCES[l.produit].nom.toLowerCase()}. Soins quotidiens par un éleveur.`,
  })),
  ...Object.entries(WORKSHOPS).map(([id, w]): BuildingDef => ({ id, nom: w.nom, desc: w.desc, kind: 'atelier', categorie: 'ateliers', size: 2, cout: w.cout, entretien: w.entretien, activite: RESOURCES[w.recettes[0].output].activite, recettes: w.recettes, constructible: true })),
];
export const BUILDINGS: Record<string, BuildingDef> = Object.fromEntries(B.map((b) => [b.id, b]));
export const CATEGORIES: Record<BuildCategory, string> = { base: 'Domaine & matériel', cultures: 'Cultures', vergers: 'Vergers & vignes', elevages: 'Élevages', ateliers: 'Ateliers', accueil: 'Commerce & accueil' };

export const FUMURE_COST = 30; // € par parcelle (fumier, engrais)
export const TRAITEMENT_COST = 20; // € par parcelle
export const PATH_COST = 14;
export const ROAD_COST = 40; // € par case de route empierrée
export const BRIDGE_COST = 450; // € par case de pont
export const TREE_CLEAR_COST = 35;
export const LEVEL_COST = 6; // € par unité de dénivelé à terrasser
export const LOT_SIZE = 16;
export const LOT_PRICE = 4500;

export type Role = 'cultivateur' | 'eleveur' | 'artisan' | 'vendeur';
export interface RoleDef {
  id: Role;
  nom: string;
  salaire: number;
  desc: string;
}
export const ROLES: Record<Role, RoleDef> = {
  cultivateur: { id: 'cultivateur', nom: 'Cultivateur', salaire: 46, desc: 'Labours, semis et récoltes ; conduit le tracteur et la moissonneuse.' },
  eleveur: { id: 'eleveur', nom: 'Éleveur', salaire: 46, desc: 'Soigne les animaux et récolte lait, œufs, miel… ; aide aux récoltes sinon.' },
  artisan: { id: 'artisan', nom: 'Artisan', salaire: 52, desc: 'Fait tourner les ateliers ; réassortit et tient la boutique sinon.' },
  vendeur: { id: 'vendeur', nom: 'Vendeur', salaire: 40, desc: 'Tient la boutique et réassortit les rayons.' },
};

export const FIRST_NAMES = ['Mathilde', 'Pierre', 'Jeanne', 'Antoine', 'Lucie', 'Bastien', 'Odile', 'Rémi', 'Margaux', 'Étienne', 'Camille', 'Jules', 'Élise', 'Gaspard', 'Rose', 'Hugo', 'Louise', 'Victor', 'Anaïs', 'Marius'];

export const CARRY = 25;
export const DAY_MIN = 1440;
export const DAYS_PER_SEASON = 7;
export const SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'] as const;
export type Season = 0 | 1 | 2 | 3;

export type Weather = 'soleil' | 'nuageux' | 'pluie' | 'orage' | 'neige';
export const WEATHER: Record<Weather, { nom: string; rendement: number; visiteurs: number }> = {
  soleil: { nom: 'Ensoleillé', rendement: 1.1, visiteurs: 1.15 },
  nuageux: { nom: 'Nuageux', rendement: 2, visiteurs: 1 },
  pluie: { nom: 'Pluie', rendement: 0.85, visiteurs: 0.55 },
  orage: { nom: 'Orage', rendement: 0.6, visiteurs: 0.2 },
  neige: { nom: 'Neige', rendement: 0.5, visiteurs: 0.35 },
};

export const WORK_START = 7 * 60;
export const WORK_END = 19 * 60;
export const VISIT_START = 9 * 60;
export const VISIT_END = 18 * 60;
export const VISIT_FEE_DEFAULT = 4;
