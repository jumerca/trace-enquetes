// Données de départ du championnat (toutes fictives).
import { Rng } from '../engine/rng';
import type { CarStats, DriverStats } from '../engine/types';

export type Emblem = 'bouclier' | 'cercle' | 'etoile' | 'chevron' | 'eclair' | 'couronne';

export interface Team {
  id: string;
  name: string;
  short: string;
  color: string;
  color2: string;
  emblem: Emblem;
  base: string;
  principal: string;
  car: CarStats;
  pitCrew: number;
  reputation: number; // 1..100
  isPlayer: boolean;
}

export interface Contract {
  salary: number; // M€ par saison
  years: number; // saisons restantes (saison en cours incluse)
}

export interface Driver {
  id: string;
  first: string;
  last: string;
  short: string;
  nat: string;
  age: number;
  number: number;
  stats: DriverStats;
  teamId: string | null;
  contract: Contract | null;
  askSalary: number; // M€ / saison demandés
  /** Rôle dans l'écurie : titulaire (défaut), réserve ou académie. */
  role?: 'titulaire' | 'reserve' | 'academie';
  /** Moral 0..100 (65 = neutre). */
  morale?: number;
  /** Plafond de progression (note visée) pour les jeunes. */
  potential?: number;
  retired?: boolean;
}

export type StaffRole = 'ingenieur' | 'mecanicien' | 'directeur';

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
  rating: number; // 1..20
  salary: number; // M€ / saison
}

export const STAFF_LABEL: Record<StaffRole, { title: string; effect: string }> = {
  ingenieur: { title: 'Ingénieur de course', effect: 'Essais plus efficaces, retours pilote plus fiables, meilleures stratégies.' },
  mecanicien: { title: 'Chef mécanicien', effect: 'Arrêts aux stands plus rapides, voiture plus fiable.' },
  directeur: { title: 'Directeur technique', effect: 'Projets de R&D plus courts et plus souvent réussis.' },
};

const STAFF_FIRST = ['Claire', 'Marco', 'Yusuf', 'Hanna', 'Pierre', 'Ines', 'Rafael', 'Greta', 'Tomás', 'Aiko', 'Oliver', 'Nadia', 'Sven', 'Léa', 'Bruno', 'Maya'];
const STAFF_LAST = ['Delorme', 'Castelli', 'Arslan', 'Lindgren', 'Moreau', 'Benali', 'Quintero', 'Hoffmann', 'Vidal', 'Tanaka', 'Price', 'Haddad', 'Nyberg', 'Garnier', 'Rocha', 'Ishii'];

export function makeStaff(rng: Rng, role: StaffRole, level: number, id: string): StaffMember {
  const rating = clamp(level + rng.normal(0, 1.5));
  return {
    id, role, rating,
    name: `${rng.pick(STAFF_FIRST)} ${rng.pick(STAFF_LAST)}`,
    salary: Math.round((0.25 + Math.max(0, rating - 6) * 0.09) * 10) / 10,
  };
}

const YOUTH_FIRST = ['Hugo', 'Lina', 'Mateo', 'Nora', 'Kai', 'Zoé', 'Elio', 'Ayla', 'Sami', 'Iris', 'Malo', 'Yara', 'Teo', 'Lou', 'Ravi', 'Emma'];
const YOUTH_LAST = ['Fontaine', 'Okoye', 'Brenner', 'Silva', 'Nakamura', 'Duval', 'Kowalski', 'Romero', 'Lindahl', 'Haas', 'Mbappé-Diallo', 'Costa', 'Reyes', 'Varga', 'Petit', 'Moreno'];
const YOUTH_NAT = ['FRA', 'GHA', 'GER', 'BRA', 'JPN', 'FRA', 'POR', 'ESP', 'SWE', 'AUT', 'BEL', 'ITA', 'MEX', 'HUN', 'CAN', 'ARG'];

/** Jeune espoir (17-19 ans) : note modeste, fort potentiel. */
export function makeYouth(rng: Rng, idx: number, usedIds: Set<string>): Driver {
  const k = rng.int(0, YOUTH_FIRST.length - 1);
  const first = YOUTH_FIRST[k];
  const last = YOUTH_LAST[rng.int(0, YOUTH_LAST.length - 1)];
  let id = 'drv-' + last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '') + '-' + first.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  while (usedIds.has(id)) id += idx;
  usedIds.add(id);
  const level = rng.range(7, 9.5);
  const stats = makeDriverStats(level, rng);
  return {
    id, first, last, nat: YOUTH_NAT[k], age: rng.int(17, 19), number: 40 + ((idx * 13) % 59),
    short: last.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(), stats, teamId: null, contract: null,
    askSalary: 0.2, potential: Math.round(rng.range(13, 18.5) * 10) / 10, morale: 70,
  };
}

export interface SponsorOffer {
  id: string;
  name: string;
  sector: string;
  color: string;
  perRace: number; // M€ par Grand Prix
  signing: number; // prime à la signature (M€)
  objective: 'arrivee' | 'points' | 'top5' | 'podium';
  bonus: number; // M€ par Grand Prix si objectif atteint
  minReputation: number;
  /** Durée proposée (saisons) ; les offres renégociées gardent leurs conditions. */
  years?: number;
}

export const OBJECTIVE_LABEL: Record<SponsorOffer['objective'], string> = {
  arrivee: 'Les deux voitures à l’arrivée',
  points: 'Au moins un pilote dans les points',
  top5: 'Au moins un pilote dans le top 5',
  podium: 'Au moins un podium',
};

interface TeamSeed {
  name: string; short: string; color: string; color2: string; emblem: Emblem; base: string; principal: string; level: number;
}

export const AI_TEAMS: TeamSeed[] = [
  { name: 'Vortex Racing', short: 'VTX', color: '#d62828', color2: '#fdf0d5', emblem: 'eclair', base: 'Maranello-sur-Lys', principal: 'Ottavio Brenna', level: 17 },
  { name: 'Aurora Motorsport', short: 'AUR', color: '#1f9e89', color2: '#f4d35e', emblem: 'etoile', base: 'Silvermoor', principal: 'Helen Whitcombe', level: 16 },
  { name: 'Kestrel Grand Prix', short: 'KES', color: '#ff7a00', color2: '#1d1d1f', emblem: 'chevron', base: 'Woking Vale', principal: 'Darius Kell', level: 15 },
  { name: 'Silverline Engineering', short: 'SLE', color: '#b8c0c8', color2: '#0b2545', emblem: 'cercle', base: 'Stuttgart-Nord', principal: 'Ingrid Vossberg', level: 14 },
  { name: 'Nordhaven Racing', short: 'NOR', color: '#1d3557', color2: '#a8dadc', emblem: 'bouclier', base: 'Nordhaven', principal: 'Lars Åkerlund', level: 12.5 },
  { name: 'Solaris Corse', short: 'SOL', color: '#ffd400', color2: '#111111', emblem: 'couronne', base: 'Faenza Alta', principal: 'Chiara Montalto', level: 11.5 },
  { name: 'Blackthorn F', short: 'BKT', color: '#232323', color2: '#d4af37', emblem: 'bouclier', base: 'Brackley Moor', principal: 'Graham Thorne', level: 10.5 },
  { name: 'Meridian Racing Team', short: 'MER', color: '#7b2cbf', color2: '#ff5d8f', emblem: 'cercle', base: 'Hinwil-See', principal: 'Ana Sobral', level: 9.5 },
  { name: 'Ardent Motorsport', short: 'ARD', color: '#06d6a0', color2: '#073b4c', emblem: 'chevron', base: 'Enstone Ridge', principal: 'Malik Duarte', level: 8.5 },
];

// [prénom, nom, nationalité, âge, niveau]
const DRIVER_SEEDS: [string, string, string, number, number][] = [
  ['Matteo', 'Ravelli', 'ITA', 29, 17.5], ['Jonas', 'Wexler', 'GER', 31, 16.5],
  ['Théo', 'Marchetti', 'FRA', 24, 16.5], ['Kenji', 'Arakawa', 'JPN', 27, 15.5],
  ['Lucas', 'Ferreira', 'BRA', 26, 15.5], ['Oscar', 'Lindqvist', 'SWE', 23, 15],
  ['Daniel', 'Okafor', 'GBR', 28, 14.5], ['Pablo', 'Iturbe', 'ESP', 33, 14.5],
  ['Nikolai', 'Varga', 'HUN', 25, 13.5], ['Sebastián', 'Rojas', 'MEX', 30, 13.5],
  ['Finn', 'Hartley', 'AUS', 22, 13], ['Émile', 'Dufresne', 'CAN', 27, 12.5],
  ['Aarav', 'Mehta', 'IND', 24, 12.5], ['Tobias', 'Krüger', 'AUT', 34, 12],
  ['Yuto', 'Sakamoto', 'JPN', 21, 11.5], ['Rafael', 'Monteiro', 'POR', 26, 11.5],
  ['Henrik', 'Dahl', 'NOR', 29, 11], ['Leo', 'Brandt', 'SUI', 23, 10.5],
  // agents libres
  ['Antoine', 'Lacroix', 'FRA', 25, 13.5], ['Mia', 'Castellanos', 'ARG', 22, 12.5],
  ['Kofi', 'Mensah', 'GHA', 24, 12], ['Elias', 'Novak', 'CZE', 28, 11.5],
  ['Sofia', 'Bergström', 'FIN', 21, 11], ['Jack', 'Moreau', 'BEL', 30, 11],
  ['Ravi', 'Chandran', 'MAS', 20, 10], ['Ilya', 'Petrenko', 'UKR', 26, 9.5],
  ['Noah', 'Vidal', 'MON', 20, 9.5], ['Lena', 'Fischer', 'GER', 23, 9],
];

export const SPONSOR_SEEDS: Omit<SponsorOffer, 'id'>[] = [
  { name: 'Helix Énergie', sector: 'Énergie', color: '#ff9f1c', perRace: 0.88, signing: 1.5, objective: 'points', bonus: 0.48, minReputation: 0 },
  { name: 'Corvane Montres', sector: 'Horlogerie', color: '#c9a227', perRace: 1.32, signing: 2.0, objective: 'top5', bonus: 0.84, minReputation: 45 },
  { name: 'Nimbus Cloud', sector: 'Informatique', color: '#4cc9f0', perRace: 0.66, signing: 1.0, objective: 'arrivee', bonus: 0.3, minReputation: 0 },
  { name: 'Brasserie Haute-Combe', sector: 'Boissons', color: '#9d4edd', perRace: 0.5, signing: 0.6, objective: 'arrivee', bonus: 0.24, minReputation: 0 },
  { name: 'Orbis Télécom', sector: 'Télécoms', color: '#3a86ff', perRace: 1.1, signing: 1.5, objective: 'points', bonus: 0.6, minReputation: 30 },
  { name: 'Valtek Pneumatique', sector: 'Industrie', color: '#8ac926', perRace: 0.61, signing: 0.8, objective: 'points', bonus: 0.36, minReputation: 0 },
  { name: 'Aster Banque Privée', sector: 'Finance', color: '#1b263b', perRace: 1.65, signing: 3.0, objective: 'podium', bonus: 1.5, minReputation: 60 },
  { name: 'Kairo Mobilité', sector: 'Automobile', color: '#e63946', perRace: 0.77, signing: 1.0, objective: 'arrivee', bonus: 0.42, minReputation: 15 },
];

function clamp(v: number, a = 1, b = 20): number {
  return Math.max(a, Math.min(b, Math.round(v)));
}

export function makeDriverStats(level: number, rng: Rng): DriverStats {
  const s = (b: number, sd = 1.6) => clamp(b + rng.normal(0, sd));
  return {
    vitesse: s(level, 1),
    regularite: s(level - 0.5),
    depassement: s(level - 0.5, 2),
    defense: s(level - 1, 2),
    pneus: s(level - 1, 2),
    pluie: s(level - 1, 2.5),
    mental: s(level - 0.5, 2),
  };
}

export function driverRating(st: DriverStats): number {
  return st.vitesse * 0.34 + st.regularite * 0.16 + st.depassement * 0.12 + st.defense * 0.08 + st.pneus * 0.12 + st.pluie * 0.06 + st.mental * 0.12;
}

export function carRating(c: CarStats): number {
  return c.moteur * 0.32 + c.aero * 0.34 + c.chassis * 0.24 + c.fiabilite * 0.1;
}

/** Salaire demandé (M€ / saison) selon la note. */
export function salaryFor(rating: number, age: number): number {
  const base = 0.35 + Math.pow(Math.max(0, rating - 8), 2) * 0.085;
  return Math.round(base * (age < 23 ? 0.8 : 1) * 10) / 10;
}

/** Espoirs disponibles au départ (pas encore en F1). */
export function buildYouthPool(seed: number, count: number, existing: Driver[]): Driver[] {
  const rng = new Rng(seed);
  const used = new Set(existing.map((d) => d.id));
  return Array.from({ length: count }, (_, i) => makeYouth(rng, i + existing.length, used));
}

export function buildWorld(seed: number): { teams: Team[]; drivers: Driver[] } {
  const rng = new Rng(seed);
  const teams: Team[] = AI_TEAMS.map((t, i) => ({
    id: 'team-' + t.short.toLowerCase(),
    name: t.name, short: t.short, color: t.color, color2: t.color2, emblem: t.emblem, base: t.base, principal: t.principal,
    car: {
      moteur: clamp(t.level + rng.normal(0, 1)),
      aero: clamp(t.level + rng.normal(0, 1)),
      chassis: clamp(t.level + rng.normal(0, 1)),
      fiabilite: clamp(12 + (t.level - 12) * 0.4 + rng.normal(0, 1.5)),
    },
    pitCrew: clamp(t.level + rng.normal(0, 1.5)),
    reputation: Math.round(30 + t.level * 3.5 - i),
    isPlayer: false,
  }));
  const usedNumbers = new Set<number>();
  const drivers: Driver[] = DRIVER_SEEDS.map(([first, last, nat, age, level], i) => {
    const stats = makeDriverStats(level, rng);
    let number = 2 + ((i * 7 + 3) % 97);
    while (usedNumbers.has(number)) number = (number % 98) + 2;
    usedNumbers.add(number);
    const rating = driverRating(stats);
    const ask = salaryFor(rating, age);
    const teamId = i < 18 ? teams[Math.floor(i / 2)].id : null;
    return {
      id: 'drv-' + last.toLowerCase().normalize('NFD').replace(/[^a-z]/g, ''),
      first, last, nat, age, number, stats, teamId,
      short: last.normalize('NFD').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase(),
      contract: teamId ? { salary: ask, years: 1 + (i % 3) } : null,
      askSalary: ask,
      morale: 65,
      potential: Math.max(level, 12) + (age < 24 ? 1.5 : 0),
    };
  });
  return { teams, drivers };
}

export const NAT_LABEL: Record<string, string> = {
  ITA: 'Italie', GER: 'Allemagne', FRA: 'France', JPN: 'Japon', BRA: 'Brésil', SWE: 'Suède', GBR: 'Royaume-Uni', ESP: 'Espagne',
  HUN: 'Hongrie', MEX: 'Mexique', AUS: 'Australie', CAN: 'Canada', IND: 'Inde', AUT: 'Autriche', POR: 'Portugal', NOR: 'Norvège',
  SUI: 'Suisse', ARG: 'Argentine', GHA: 'Ghana', CZE: 'Tchéquie', FIN: 'Finlande', BEL: 'Belgique', MAS: 'Malaisie', UKR: 'Ukraine',
  MON: 'Monaco',
};
