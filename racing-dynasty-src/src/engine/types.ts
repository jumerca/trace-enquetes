// Types partagés du moteur de course (aucune dépendance DOM / rendu).

export type Compound = 'T' | 'M' | 'D' | 'P'; // Tendre, Médium, Dur, Pluie
export type Weather = 'sec' | 'pluie';
export type DriveMode = 'attaque' | 'normal' | 'eco';

export interface DriverStats {
  vitesse: number;
  regularite: number;
  depassement: number;
  defense: number;
  pneus: number;
  pluie: number;
  mental: number;
}

export interface CarStats {
  moteur: number;
  aero: number;
  chassis: number;
  fiabilite: number;
}

/** Réglages de voiture, chaque valeur sur 0..100. */
export interface CarSetup {
  aileron: number; // appui aérodynamique
  suspension: number; // raideur
  boite: number; // rapports : 0 = courts (accélération), 100 = longs (vitesse de pointe)
}

export interface PitPlan {
  lap: number; // tour au terme duquel on s'arrête
  compound: Compound;
}

export interface CarEntry {
  id: string; // identifiant pilote
  name: string;
  short: string; // trigramme
  number: number;
  teamId: string;
  teamName: string;
  color: string;
  color2: string;
  driver: DriverStats;
  car: CarStats;
  setup: CarSetup;
  pitCrew: number; // 1..20
  startCompound: Compound;
  pitPlan: PitPlan[];
  isPlayer: boolean;
}

/** Changement de météo pendant la course : à partir du tour `lap` (fraction possible), il pleut ou non. */
export interface WeatherChange {
  lap: number;
  rain: boolean;
}

export type TeamOrder = 'libre' | 'tenir' | 'inverser';

export interface RaceConfig {
  trackId: string;
  laps: number;
  weather: Weather; // météo au départ
  weatherPlan?: WeatherChange[];
  seed: number;
  entries: CarEntry[]; // dans l'ordre de la grille
}

export type RaceCommand =
  | { tick: number; carId: string; type: 'mode'; mode: DriveMode }
  | { tick: number; carId: string; type: 'pit'; compound: Compound }
  | { tick: number; carId: string; type: 'cancelPit' }
  | { tick: number; carId: string; type: 'teamOrder'; order: TeamOrder };

/** Consigne sans numéro de pas (il est fixé au moment de l'émission). */
export type RaceCommandInput = RaceCommand extends infer T ? (T extends RaceCommand ? Omit<T, 'tick'> : never) : never;

export interface RaceEvent {
  t: number;
  lap: number;
  kind:
    | 'depart' | 'depassement' | 'erreur' | 'sortie' | 'tete-a-queue' | 'abandon' | 'stand' | 'meilleur-tour' | 'drapeau'
    | 'securite' | 'meteo' | 'contact' | 'penalite' | 'radio' | 'consigne';
  carId?: string;
  otherId?: string;
  text: string;
}

export interface ClassifiedResult {
  carId: string;
  position: number;
  laps: number;
  time: number; // temps total (s) si arrivé
  gap: string; // écart affiché
  bestLap: number;
  stops: number;
  status: 'arrivé' | 'abandon';
  reason?: string;
  gridPosition: number;
  penalty: number; // secondes de pénalité ajoutées au temps final
}
