// État complet d'une partie : sérialisable, sans référence au rendu.
import type { Activity, Res, Role, Weather } from '../data/content';
import type { World } from '../world/terrain';

export type Step =
  | { k: 'go'; x: number; y: number; vehicle?: boolean }
  | { k: 'pick'; b: number } // récolte (verger) ou traite (enclos) → charge
  | { k: 'take'; b: number; res: Res; qty: number } // prise dans un stock
  | { k: 'put'; b: number } // dépôt de la charge dans un stock / rayon
  | { k: 'process'; b: number } // lot d'atelier
  | { k: 'tend'; b: number; min: number } // tenir la boutique
  | { k: 'rest'; b: number } // repos à la maison
  | { k: 'board'; v: number } // monter dans un véhicule
  | { k: 'harvestField'; b: number; v: number } // moisson (tracteur)
  | { k: 'reapTile'; b: number } // moisson manuelle d'une case
  | { k: 'unload'; v: number; b: number } // décharger la remorque
  | { k: 'alight'; v: number }
  | { k: 'wait'; min: number; label: string }
  | { k: 'visit'; b: number } // visiteur : accueil (paiement) ou point de vue
  | { k: 'shop'; b: number } // visiteur : achats en boutique
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
  timer: number; // minutes restantes de l'étape en cours
  steps: Step[];
  label: string; // ce que fait l'agent (affiché)
  hidden: boolean;
}

export interface Worker extends Agent {
  nom: string;
  role: Role;
  carry: Carry | null;
  vehicle: number | null;
  minutes: Partial<Record<Activity, number>>; // minutes travaillées du jour par activité
  activity: Activity;
  hiredDay: number;
}

export interface Wish {
  res: Res;
  qty: number;
  maxPrice: number;
}

export interface Visitor extends Agent {
  look: number; // variante d'apparence
  budget: number;
  wishes: Wish[];
  spent: number;
  bought: number;
  wanted: number;
  waited: number;
  visited: boolean;
  done: boolean;
}

export interface Vehicle extends Agent {
  kind: 'tracteur' | 'camionnette';
  home: number; // id du hangar (tracteur) ou -1
  load: Carry | null;
  cap: number;
  driver: number | null;
  order: number | null; // id de commande (camionnette)
}

export interface Animal {
  id: number;
  kind: 'chevre' | 'poule';
  pen: number; // bâtiment de rattachement (-1 = cour)
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
  inv: Partial<Record<Res, number>>; // stock (grange, boutique)
  ready: number; // récolte disponible (verger, enclos, champ mûr)
  growth: number; // 0..1 (champ de blé)
  reaped: number[]; // cases moissonnées (champ)
  busyBy: number | null; // atelier réservé / boutique tenue
  priority: boolean;
  batches: number;
  builtDay: number;
}

export interface Order {
  id: number;
  res: Res;
  qty: number;
  price: number; // €/unité
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
  tutorial: number; // index de l'objectif courant (5 = terminé)
  nextId: number;
  events: { min: number; text: string; kind: 'info' | 'alerte' | 'succes' }[];
}

export const SAVE_VERSION = 1;
