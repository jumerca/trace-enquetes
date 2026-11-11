import { Rng } from '../core/rng';
import {
  ALL_ATTRS,
  ARCHETYPES,
  POSITION_BASE,
  POSITION_HEIGHT,
  overall,
  type Archetype,
  type Attributes,
  type AttrKey,
  type Position,
} from './attributes';
import { NAME_BANKS, NATIONS } from './names';
import type { Appearance, PlayerData } from './model';

const ARCH_BY_POS: Record<Position, Archetype[]> = {
  PG: ['playmaker', 'scoringGuard', 'twoWayGuard'],
  SG: ['sharpshooter', 'scoringGuard', 'twoWayGuard', 'lockdown', 'shotCreator'],
  SF: ['athleticWing', 'allAround', 'shotCreator', 'lockdown', 'sharpshooter'],
  PF: ['allAround', 'stretchBig', 'skilledBig', 'dominantBig'],
  C: ['dominantBig', 'rimProtector', 'skilledBig', 'stretchBig'],
};

const SECOND_POS: Record<Position, Position[]> = {
  PG: ['SG'],
  SG: ['PG', 'SF'],
  SF: ['SG', 'PF'],
  PF: ['SF', 'C'],
  C: ['PF'],
};

export function archetypesFor(pos: Position): Archetype[] {
  return ARCH_BY_POS[pos];
}

/** Registre empêchant les doublons d'identité dans un monde. */
export class NameRegistry {
  used = new Set<string>();
  constructor(existing: Iterable<string> = []) {
    for (const n of existing) this.used.add(n);
  }
  generate(rng: Rng, nation: string): { firstName: string; lastName: string } {
    const bank = NAME_BANKS[NATIONS[nation]?.names ?? 'fr'];
    for (let i = 0; i < 60; i++) {
      const firstName = rng.pick(bank.first);
      const lastName = rng.pick(bank.last);
      const key = `${firstName} ${lastName}`;
      if (!this.used.has(key)) {
        this.used.add(key);
        return { firstName, lastName };
      }
    }
    // Repli : nom composé pour garantir l'unicité
    const firstName = rng.pick(bank.first);
    const lastName = `${rng.pick(bank.last)}-${rng.pick(bank.last)}`;
    this.used.add(`${firstName} ${lastName}`);
    return { firstName, lastName };
  }
}

export function randomAppearance(rng: Rng, nation: string): Appearance {
  const darkBias = ['SEN', 'CMR', 'USA'].includes(nation) ? 0.7 : nation === 'FRA' ? 0.35 : 0.12;
  const skin = rng.chance(darkBias) ? rng.int(3, 5) : rng.int(0, 3);
  return {
    skin,
    hair: rng.int(0, 5),
    hairColor: skin >= 3 ? 0 : rng.int(0, 3),
    beard: rng.chance(0.35) ? rng.int(1, 2) : 0,
    headband: rng.chance(0.12),
    sleeve: rng.chance(0.15),
  };
}

export interface GenOptions {
  pos: Position;
  archetype?: Archetype;
  age: number;
  /** Moyenne d'attribut visée (sur 20) */
  level: number;
  nation: string;
  season: number;
  potentialBonus?: number;
}

let idCounter = 0;
export function newId(prefix: string, rng: Rng): string {
  idCounter++;
  return `${prefix}_${Math.floor(rng.next() * 1e9).toString(36)}${idCounter.toString(36)}`;
}

export function buildAttributes(rng: Rng, pos: Position, archetype: Archetype, level: number, spread = 1.6): Attributes {
  const a = {} as Attributes;
  const base = POSITION_BASE[pos];
  const mods = ARCHETYPES[archetype].mods;
  for (const k of ALL_ATTRS) {
    let v = level + (base[k] ?? 0) * 0.8 + (mods[k] ?? 0) * 0.8 + rng.normal(0, spread);
    if (k === 'ambition' || k === 'determination' || k === 'discipline' || k === 'leadership') v = 10 + rng.normal(0, 3.2);
    a[k] = Math.round(Math.max(1, Math.min(20, v)));
  }
  return a;
}

export function generatePlayer(rng: Rng, names: NameRegistry, o: GenOptions): PlayerData {
  const archetype = o.archetype ?? rng.pick(ARCH_BY_POS[o.pos]);
  const attrs = buildAttributes(rng, o.pos, archetype, o.level);
  const { firstName, lastName } = names.generate(rng, o.nation);
  const heightCm = Math.round(POSITION_HEIGHT[o.pos] + rng.normal(0, 4));
  const weightKg = Math.round(heightCm - 100 + (o.pos === 'C' || o.pos === 'PF' ? 12 : 0) + rng.normal(-6, 6));
  const ovr = overall(attrs, o.pos);
  const youthRoom = Math.max(0, 25 - o.age);
  const potential = Math.round(Math.min(97, Math.max(ovr, ovr + youthRoom * rng.range(0.8, 3.0) + (o.potentialBonus ?? 0))));
  const birthYear = o.season - o.age;
  const month = rng.int(1, 12);
  const day = rng.int(1, 28);
  const nat = NATIONS[o.nation] ?? NATIONS.FRA;
  return {
    id: newId('p', rng),
    firstName,
    lastName,
    nationality: o.nation,
    birthCity: rng.pick(nat.cities),
    birthYear,
    birthDate: `${birthYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    heightCm,
    weightKg,
    hand: rng.chance(0.12) ? 'L' : 'R',
    number: rng.int(0, 55),
    pos: o.pos,
    pos2: rng.pick(SECOND_POS[o.pos]),
    archetype,
    attrs,
    potential,
    form: rng.range(0.4, 0.7),
    fatigue: 0,
    morale: 60 + rng.int(-10, 15),
    confidence: 55 + rng.int(-10, 15),
    injuryDays: 0,
    injuryRisk: rng.range(0.7, 1.3),
    reputation: Math.max(1, Math.min(100, Math.round((ovr - 40) * 1.6 + rng.normal(0, 6)))),
    teamFit: 60,
    appearance: randomAppearance(rng, o.nation),
    clubId: null,
    contract: null,
    history: [],
  };
}

export function age(p: PlayerData, season: number): number {
  return season - p.birthYear;
}

export function playerOvr(p: PlayerData): number {
  return overall(p.attrs, p.pos);
}

export function attrAvg(p: PlayerData, keys: AttrKey[]): number {
  let s = 0;
  for (const k of keys) s += p.attrs[k];
  return s / keys.length;
}
