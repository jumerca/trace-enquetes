import type { Archetype, AttrKey, Attributes, Position } from './attributes';

export interface Appearance {
  skin: number; // index palette peau
  hair: number; // style
  hairColor: number;
  beard: number;
  headband: boolean;
  sleeve: boolean;
}

export interface SeasonLine {
  season: number;
  clubId: string;
  clubName: string;
  league: string;
  gp: number;
  gs: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  pf: number;
}

export interface Contract {
  clubId: string;
  salary: number; // €/an
  until: number; // saison de fin incluse
  role: 'prospect' | 'rotation' | 'starter' | 'star';
}

export interface PlayerData {
  id: string;
  firstName: string;
  lastName: string;
  nationality: string;
  birthCity: string;
  birthYear: number;
  birthDate: string;
  heightCm: number;
  weightKg: number;
  hand: 'R' | 'L';
  number: number;
  pos: Position;
  pos2: Position;
  archetype: Archetype;
  attrs: Attributes;
  potential: number; // 40..99 (note globale plafond estimée)
  form: number; // 0..1
  fatigue: number; // 0..100 (accumulée sur la semaine)
  morale: number; // 0..100
  confidence: number; // 0..100
  injuryDays: number;
  injuryRisk: number; // 0..1 (multiplicateur)
  reputation: number; // 0..100
  teamFit: number; // 0..100
  appearance: Appearance;
  clubId: string | null;
  contract: Contract | null;
  isUser?: boolean;
  history: SeasonLine[];
  retired?: boolean;
  /** Progression fractionnaire accumulée (les attributs affichés restent entiers) */
  frac?: Partial<Record<AttrKey, number>>;
}

export interface Club {
  id: string;
  name: string;
  short: string;
  city: string;
  country: string;
  leagueId: string;
  colors: [string, string];
  budget: number;
  reputation: number;
  coach: Coach;
  philosophy: 'youth' | 'win-now' | 'balanced';
  facilities: number; // 1..20
  youth: number; // 1..20
  roster: string[]; // ids joueurs
}

export interface Coach {
  name: string;
  tactics: TeamTactics;
  youthTrust: number; // 0..1 propension à faire jouer les jeunes
  development: number; // 1..20
}

export interface TeamTactics {
  pace: number; // 0..1
  threeRate: number; // 0..1 préférence tir à 3
  defense: 'man' | 'zone23' | 'switch';
  pressure: number; // 0..1 agressivité défensive
  crashBoards: number; // 0..1 rebond offensif
  pnrFreq: number; // 0..1
}

export const DEFAULT_TACTICS: TeamTactics = {
  pace: 0.5,
  threeRate: 0.5,
  defense: 'man',
  pressure: 0.5,
  crashBoards: 0.35,
  pnrFreq: 0.5,
};

export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`;
}
export function shortName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName[0]}. ${p.lastName}`;
}
