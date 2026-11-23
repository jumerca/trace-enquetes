// État complet d'une partie : sérialisable, sans référence au rendu.
import type { Activity, Res, Role, Weather } from '../data/content';
import type { World } from '../world/terrain';

export type FieldOp = 'labour' | 'epandage' | 'semis' | 'traitement' | 'recolte';

export type Step =
  | { k: 'go'; x: number; y: number; vehicle?: boolean }
  | { k: 'pick'; b: number } // récolte (verger) ou collecte (élevage) → charge
  | { k: 'take'; b: number; res: Res; qty: number }
  | { k: 'put'; b: number } // dépôt de la charge (b = -1 : stock le plus proche, résolu au départ)
  | { k: 'process'; b: number; r: number } // lot d'atelier (r = index de recette)
  | { k: 'tend'; b: number; min: number }
  | { k: 'rest'; b: number }
  | { k: 'board'; v: number; tool: string }
  | { k: 'field'; b: number; op: FieldOp } // travail d'une case de parcelle (à pied ou en engin)
  | { k: 'vine'; b: number } // vendange mécanique d'une case de vigne
  | { k: 'unload'; v: number; b: number }
  | { k: 'alight'; v: number }
  | { k: 'wait'; min: number; label: string }
  | { k: 'visit'; b: number }
  | { k: 'shop'; b: number }
  | { k: 'leave' };

export interface Carry {
  res: Res;
  qty: number;
}

export interface Agent {
  id: number;
  x: number; // position continue en cases
  y: number;
  px: number; // position au pas précédent (interpolation du rendu)
  py: number;
  path: [number, number][];
  dir: number; // 0 SE, 1 SW, 2 NW, 3 NE (sens écran)
  moving: boolean;
  timer: number;
  steps: Step[];
  label: string;
  hidden: boolean;
}

export interface Worker extends Agent {
  nom: string;
  role: Role;
  carry: Carry | null;
  vehicle: number | null;
  minutes: Partial<Record<Activity, number>>;
  activity: Activity;
  hiredDay: number;
}

export interface Wish {
  res: Res;
  qty: number;
  maxPrice: number;
}

export interface Visitor extends Agent {
  look: number;
  budget: number;
  wishes: Wish[];
  spent: number;
  bought: number;
  wanted: number;
  waited: number;
  visited: boolean;
  done: boolean;
  car: number; // voiture du groupe
}

export type VehicleKind = 'tracteur' | 'moissonneuse' | 'vendangeuse' | 'camionnette' | 'betaillere' | 'voiture';

export interface Vehicle extends Agent {
  kind: VehicleKind;
  home: number; // hangar / remise (-1 sinon)
  load: Carry | null;
  cap: number;
  driver: number | null;
  order: number | null; // commande (camionnette)
  tool: string; // outil attelé (tracteur) : seul, charrue, semoir, remorque
  look: number; // couleur (voitures)
  passengers: number; // voiture : visiteurs partis à pied
  back: number; // voiture : visiteurs revenus
  slot: number; // place de parking
}

export interface Animal {
  id: number;
  kind: string; // chevre, vache, brebis, poule, canard, cochon, ruche
  pen: number;
  x: number;
  y: number;
  px: number;
  py: number;
  tx: number;
  ty: number;
  dir: number;
  pause: number;
  look: number;
}

export interface Building {
  id: number;
  type: string;
  x: number;
  y: number;
  rot: 0 | 1;
  inv: Partial<Record<Res, number>>;
  ready: number; // récolte disponible
  growth: number; // 0..1 (parcelle en pousse)
  phase: 'labour' | 'epandage' | 'semis' | 'pousse' | 'mur'; // parcelles de culture
  bonus?: number; // gain de rendement (épandage, traitement)
  treated?: boolean; // traitement déjà passé pour cette culture
  done: number[]; // cases traitées pour l'opération en cours
  busyBy: number | null;
  priority: boolean;
  batches: number;
  builtDay: number;
}

export interface Order {
  id: number;
  res: Res;
  qty: number;
  price: number;
  status: 'attente' | 'en route' | 'chargement' | 'livrée' | 'annulée';
  createdMin: number;
  dueMin: number;
}

export interface LedgerDay {
  day: number;
  rev: Partial<Record<Activity, number>>;
  cost: Partial<Record<Activity, number>>;
  invest: number;
  lines: { a: Activity; label: string; amount: number }[];
}

export interface Stats {
  harvested: Partial<Record<Res, number>>;
  produced: Partial<Record<Res, number>>;
  sold: Partial<Record<Res, number>>;
  batches: number;
  built: number;
  visitors: number;
}

export interface GameState {
  version: number;
  seed: number;
  region: string;
  rng: number;
  minute: number;
  money: number;
  weather: Weather;
  reputation: number;
  satisfaction: number;
  satSamples: number[];
  world: World;
  buildings: Building[];
  workers: Worker[];
  visitors: Visitor[];
  vehicles: Vehicle[];
  animals: Animal[];
  orders: Order[];
  prices: Record<Res, number>;
  visitFee: number;
  ledger: LedgerDay[];
  stats: Stats;
  tutorial: number;
  nextId: number;
  events: { min: number; text: string; kind: 'info' | 'alerte' | 'succes' }[];
  /** contrats négociant : seuil de stock au-delà duquel le surplus est vendu chaque matin (-2 = automatique, -1 = désactivé) */
  autoSell: Record<Res, number>;
}

export const SAVE_VERSION = 2;
