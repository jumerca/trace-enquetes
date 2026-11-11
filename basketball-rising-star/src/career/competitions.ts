import { hashString, Rng } from '../core/rng';
import type { Position } from '../data/attributes';
import { age as ageOf, generatePlayer, NameRegistry, playerOvr } from '../data/generate';
import { DEFAULT_TACTICS, type Club, type PlayerData } from '../data/model';
import { NATIONS } from '../data/names';
import type { TeamInput } from '../sim/engine';
import type { RosterEntry } from './fastsim';
import type { Fixture, World } from './world';
import type { Career } from './career';

/**
 * Compétitions annexes (toutes fictives) :
 * - Coupe de France des clubs (16 équipes, élimination directe),
 * - Copa Peninsular (8 équipes),
 * - EuroCoupe des clubs (8 meilleurs clubs français et espagnols),
 * - matchs Espoirs (U21) pour les jeunes peu utilisés en équipe première,
 * - tournoi des sélections nationales pendant l'été.
 */
export type CompKind = 'cup' | 'euro' | 'youth' | 'nat';

export interface Competition {
  id: string;
  name: string;
  kind: CompKind;
  teams: string[];
  rounds: { week: number; label: string }[];
  round: number; // index du tour en cours
  alive: string[];
  winner?: string;
  category?: string; // sélection : A, U20, U18
}

const CUP_WEEKS = [4, 9, 14, 19];
const CUP_LABELS_16 = ['Huitièmes de finale', 'Quarts de finale', 'Demi-finales', 'Finale'];
const EURO_WEEKS = [7, 13, 20];
const LABELS_8 = ['Quarts de finale', 'Demi-finales', 'Finale'];
export const NAT_WEEKS = [25, 26, 27, 28];

export function comps(w: World): Record<string, Competition> {
  const x = w as World & { comps?: Record<string, Competition> };
  return (x.comps ??= {});
}

const byRep = (w: World, ids: string[]) => [...ids].sort((a, b) => w.clubs[b].reputation - w.clubs[a].reputation);

/** Création des compétitions de la saison (appelée avec le calendrier). */
export function createCompetitions(c: Career): void {
  const w = c.world;
  const all = comps(w);
  for (const k of Object.keys(all)) if (all[k].kind !== 'nat') delete all[k];
  const fra1 = w.leagues.FRA1?.teams ?? [];
  const fra2 = w.leagues.FRA2?.teams ?? [];
  const esp = w.leagues.ESP1?.teams ?? [];
  if (fra1.length >= 12 && fra2.length >= 4) {
    const teams = [...fra1, ...byRep(w, fra2).slice(0, 4)];
    all.CUP_FRA = { id: 'CUP_FRA', name: 'Coupe de France des clubs', kind: 'cup', teams, rounds: CUP_WEEKS.map((wk, i) => ({ week: wk, label: CUP_LABELS_16[i] })), round: 0, alive: teams };
  }
  if (esp.length >= 8) {
    const teams = byRep(w, esp).slice(0, 8);
    all.CUP_ESP = { id: 'CUP_ESP', name: 'Copa Peninsular', kind: 'cup', teams, rounds: CUP_WEEKS.slice(1).map((wk, i) => ({ week: wk, label: LABELS_8[i] })), round: 0, alive: teams };
  }
  if (fra1.length && esp.length) {
    // 16 clubs si tous les championnats européens existent, sinon 8 (anciennes sauvegardes)
    const lg = (id: string, n: number) => byRep(w, w.leagues[id]?.teams ?? []).slice(0, n);
    const wide = ['ITA1', 'GER1', 'GRE1', 'TUR1'].every((id) => w.leagues[id]);
    const teams = wide ? [...lg('FRA1', 3), ...lg('ESP1', 3), ...lg('ITA1', 3), ...lg('GER1', 3), ...lg('GRE1', 2), ...lg('TUR1', 2)] : [...lg('FRA1', 4), ...lg('ESP1', 4)];
    const rounds = wide ? [2, 7, 13, 20].map((wk, i) => ({ week: wk, label: CUP_LABELS_16[i] })) : EURO_WEEKS.map((wk, i) => ({ week: wk, label: LABELS_8[i] }));
    all.EURO = { id: 'EURO', name: 'EuroCoupe des clubs', kind: 'euro', teams, rounds, round: 0, alive: teams };
  }
  for (const comp of Object.values(all)) if (comp.kind === 'cup' || comp.kind === 'euro') drawRound(c, comp);
}

function drawRound(c: Career, comp: Competition): void {
  const w = c.world;
  const rng = new Rng(hashString(`${comp.id}|${w.season}|${comp.round}|${w.seed}`));
  const pool = rng.shuffle([...comp.alive]);
  const r = comp.rounds[comp.round];
  for (let i = 0; i + 1 < pool.length; i += 2) {
    // Le club de division inférieure ou le moins réputé reçoit (tradition des coupes)
    let [home, away] = [pool[i], pool[i + 1]];
    if (w.clubs[home].reputation > w.clubs[away].reputation && r.label !== 'Finale') [home, away] = [away, home];
    w.fixtures.push({ id: `${comp.id}-${w.season}-${comp.round}-${i / 2}`, leagueId: comp.id, round: comp.round + 1, week: r.week, home, away, played: false, hs: 0, as: 0, stage: 'cup', label: r.label });
  }
}

/** Fait progresser les compétitions à élimination directe après une semaine jouée. */
export function progressCompetitions(c: Career, week: number): string[] {
  const w = c.world;
  const msgs: string[] = [];
  for (const comp of Object.values(comps(w))) {
    if (comp.kind !== 'cup' && comp.kind !== 'euro') continue;
    const r = comp.rounds[comp.round];
    if (!r || r.week !== week || comp.winner) continue;
    const fx = w.fixtures.filter((f) => f.leagueId === comp.id && f.round === comp.round + 1);
    if (fx.some((f) => !f.played)) continue;
    comp.alive = fx.map((f) => (f.hs > f.as ? f.home : f.away));
    if (comp.round === comp.rounds.length - 1) {
      comp.winner = comp.alive[0];
      msgs.push(`${w.clubs[comp.winner].name} remporte la ${comp.name}`);
    } else {
      comp.round++;
      drawRound(c, comp);
    }
  }
  return msgs;
}

export function isComp(leagueId: string, w: World): Competition | null {
  return comps(w)[leagueId] ?? null;
}

export function fixtureName(c: Career, f: Fixture): string {
  const comp = isComp(f.leagueId, c.world);
  if (comp) return `${comp.name}${f.label ? ` · ${f.label}` : ''}`;
  if (f.stage === 'youth') return 'Championnat Espoirs (U21)';
  const l = c.world.leagues[f.leagueId];
  if (!l) return f.leagueId;
  return f.stage === 'regular' ? `${l.name} · journée ${f.round}` : f.stage === 'semi' ? `${l.name} · demi-finale` : `${l.name} · finale`;
}

/** Niveau de prestige (influence la réputation gagnée). */
export function fixtureLevel(c: Career, f: Fixture): number {
  const comp = isComp(f.leagueId, c.world);
  if (comp) return comp.kind === 'euro' || comp.kind === 'nat' ? 1 : 1.5;
  if (f.stage === 'youth') return 3;
  return c.world.leagues[f.leagueId]?.level ?? 2;
}

// ------------------------------------------------------------------ Espoirs (U21)
const fillerCache = new Map<string, PlayerData[]>();

function fillers(c: Career, key: string, n: number, level: number, maxAge: number, nation?: string): PlayerData[] {
  const k = `${key}|${c.world.season}|${n}`;
  const hit = fillerCache.get(k);
  if (hit) return hit;
  const rng = new Rng(hashString(k + c.world.seed));
  const names = new NameRegistry(c.world.usedNames);
  const pos: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
  const res: PlayerData[] = [];
  for (let i = 0; i < n; i++) {
    const p = generatePlayer(rng, names, { pos: pos[i % 5], age: Math.max(16, maxAge - rng.int(0, 3)), level: level + rng.normal(0, 0.8), nation: nation ?? 'FRA', season: c.world.season });
    p.id = `x_${key}_${i}`;
    p.number = 4 + ((i * 7) % 50);
    res.push(p);
  }
  fillerCache.set(k, res);
  return res;
}

export function youthEligible(c: Career): boolean {
  const u = c.world.players[c.userId];
  const club = c.world.clubs[u.clubId!];
  const league = c.world.leagues[club.leagueId];
  return !!league && league.level === 1 && ageOf(u, c.world.season) <= 20 && u.injuryDays <= 0;
}

/** Ajoute un match Espoirs pour la semaine en cours si le joueur est concerné. */
export function ensureYouthFixture(c: Career, minutesRank: number): void {
  const w = c.world;
  if (c.phase !== 'regular' || !youthEligible(c) || minutesRank < 8) return;
  const u = w.players[c.userId];
  const id = `U21-${w.season}-${c.week}`;
  if (w.fixtures.some((f) => f.id === id)) return;
  const lg = w.clubs[u.clubId!].leagueId;
  const opp = w.fixtures.find((f) => f.week === c.week && f.leagueId === lg && f.stage === 'regular' && (f.home === u.clubId || f.away === u.clubId));
  const oppId = opp ? (opp.home === u.clubId ? opp.away : opp.home) : w.leagues[lg].teams.find((t) => t !== u.clubId)!;
  w.fixtures.push({ id, leagueId: 'U21', round: c.week, week: c.week, home: u.clubId!, away: oppId, played: false, hs: 0, as: 0, stage: 'youth', label: 'Espoirs' });
}

function youthRoster(c: Career, clubId: string): PlayerData[] {
  const w = c.world;
  const club = w.clubs[clubId];
  const young = club.roster.map((id) => w.players[id]).filter((p) => p && ageOf(p, w.season) <= 20 && p.injuryDays <= 0);
  const league = w.leagues[club.leagueId];
  const fill = fillers(c, `y${clubId}`, Math.max(0, 11 - young.length), (league?.strength ?? 11) - 3.4 + club.youth / 12, 20);
  return [...young, ...fill].slice(0, 12);
}

// ------------------------------------------------------------------ Sélections nationales
const NAT_COLORS: Record<string, [string, string]> = {
  FRA: ['#1E3A8A', '#F6F4EF'],
  ESP: ['#B91C1C', '#FACC15'],
  ITA: ['#1D4ED8', '#F6F4EF'],
  GER: ['#111827', '#FACC15'],
  GRE: ['#2563EB', '#F6F4EF'],
  TUR: ['#DC2626', '#F6F4EF'],
  USA: ['#1E3A8A', '#DC2626'],
  SRB: ['#991B1B', '#F6F4EF'],
  SEN: ['#15803D', '#FACC15'],
  CMR: ['#15803D', '#DC2626'],
  BEL: ['#111827', '#F59E0B'],
  LTU: ['#15803D', '#FACC15'],
  CAN: ['#DC2626', '#F6F4EF'],
};

export function natId(code: string): string {
  return `NAT_${code}`;
}

/** Tournoi d'été : 4 sélections, poule unique puis finale. */
export function startNationalTournament(c: Career, category: 'A' | 'U20' | 'U18'): void {
  const w = c.world;
  const u = w.players[c.userId];
  const rng = new Rng(hashString(`nat${w.season}${w.seed}`));
  const others = rng.shuffle(Object.keys(NATIONS).filter((n) => n !== u.nationality)).slice(0, 3);
  const nations = [u.nationality, ...others];
  const maxAge = category === 'A' ? 99 : category === 'U20' ? 20 : 18;
  for (const code of nations) {
    const id = natId(code);
    const pool = Object.values(w.players)
      .filter((p) => !p.retired && p.nationality === code && p.clubId && ageOf(p, w.season) <= maxAge)
      .sort((a, b) => playerOvr(b) - playerOvr(a));
    let roster = pool.slice(0, 12).map((p) => p.id);
    if (code === u.nationality && !roster.includes(u.id)) roster = [u.id, ...roster.slice(0, 11)];
    const club: Club = {
      id,
      name: `${NATIONS[code].label}${category === 'A' ? '' : ` ${category}`}`,
      short: code,
      city: NATIONS[code].label,
      country: code,
      leagueId: 'NAT',
      colors: NAT_COLORS[code] ?? ['#334155', '#F6F4EF'],
      budget: 0,
      reputation: 60,
      coach: { name: 'Sélectionneur national', tactics: { ...DEFAULT_TACTICS }, youthTrust: 0.6, development: 12 },
      philosophy: 'win-now',
      facilities: 15,
      youth: 15,
      roster,
    };
    w.clubs[id] = club;
  }
  const ids = nations.map(natId);
  const pairs: [number, number][][] = [
    [
      [0, 1],
      [2, 3],
    ],
    [
      [0, 2],
      [1, 3],
    ],
    [
      [0, 3],
      [1, 2],
    ],
  ];
  pairs.forEach((rd, r) => rd.forEach(([a, b], k) => w.fixtures.push({ id: `NAT-${w.season}-${r}-${k}`, leagueId: 'NAT', round: r + 1, week: NAT_WEEKS[r], home: ids[a], away: ids[b], played: false, hs: 0, as: 0, stage: 'nat', label: `Tournoi des nations · poule, ${r + 1}e journée` })));
  comps(w).NAT = { id: 'NAT', name: `Tournoi des nations ${category === 'A' ? '' : category}`.trim(), kind: 'nat', teams: ids, rounds: NAT_WEEKS.map((wk, i) => ({ week: wk, label: i < 3 ? 'Poule' : 'Finale' })), round: 0, alive: ids, category };
}

export function natStandings(c: Career): { id: string; w: number; diff: number }[] {
  const comp = comps(c.world).NAT;
  if (!comp) return [];
  const rows = comp.teams.map((id) => ({ id, w: 0, diff: 0 }));
  for (const f of c.world.fixtures) {
    if (f.leagueId !== 'NAT' || !f.played || f.label?.includes('Finale')) continue;
    const h = rows.find((r) => r.id === f.home)!;
    const a = rows.find((r) => r.id === f.away)!;
    h.diff += f.hs - f.as;
    a.diff += f.as - f.hs;
    if (f.hs > f.as) h.w++;
    else a.w++;
  }
  return rows.sort((a, b) => b.w - a.w || b.diff - a.diff);
}

export function progressNational(c: Career, week: number): string[] {
  const w = c.world;
  const comp = comps(w).NAT;
  if (!comp || comp.winner) return [];
  if (week === NAT_WEEKS[2]) {
    const st = natStandings(c);
    w.fixtures.push({ id: `NAT-${w.season}-F`, leagueId: 'NAT', round: 4, week: NAT_WEEKS[3], home: st[0].id, away: st[1].id, played: false, hs: 0, as: 0, stage: 'nat', label: 'Tournoi des nations · Finale' });
    return [];
  }
  const fin = w.fixtures.find((f) => f.id === `NAT-${w.season}-F` && f.played);
  if (fin) {
    comp.winner = fin.hs > fin.as ? fin.home : fin.away;
    return [`${w.clubs[comp.winner].name} remporte le ${comp.name}`];
  }
  return [];
}

export function clearNational(c: Career): void {
  const w = c.world;
  for (const id of Object.keys(w.clubs)) if (w.clubs[id].leagueId === 'NAT') delete w.clubs[id];
  delete comps(w).NAT;
  w.fixtures = w.fixtures.filter((f) => f.leagueId !== 'NAT');
}

function natRoster(c: Career, clubId: string): PlayerData[] {
  const w = c.world;
  const club = w.clubs[clubId];
  const comp = comps(w).NAT;
  const maxAge = comp?.category === 'U18' ? 18 : comp?.category === 'U20' ? 20 : 30;
  const real = club.roster.map((id) => w.players[id]).filter((p) => p && p.injuryDays <= 0);
  const avg = real.length ? real.reduce((s, p) => s + playerOvr(p), 0) / real.length : 60;
  const fill = fillers(c, `n${clubId}`, Math.max(0, 12 - real.length), (avg - 10) / 4.5 - 0.5, maxAge, club.country);
  return [...real, ...fill].slice(0, 12);
}

// ------------------------------------------------------------------ Effectifs par type de match
export function isSpecialTeam(c: Career, clubId: string, f: Fixture): 'youth' | 'nat' | null {
  if (f.stage === 'youth') return 'youth';
  if (c.world.clubs[clubId]?.leagueId === 'NAT') return 'nat';
  return null;
}

export function specialTeamInput(c: Career, clubId: string, kind: 'youth' | 'nat', userId: string): TeamInput {
  const club = c.world.clubs[clubId];
  let players = kind === 'youth' ? youthRoster(c, clubId) : natRoster(c, clubId);
  // Ordonner : meilleurs d'abord, en couvrant les cinq postes
  const order: PlayerData[] = [];
  const left = [...players].sort((a, b) => playerOvr(b) - playerOvr(a) + (b.id === userId ? 2 : 0) - (a.id === userId ? 2 : 0));
  for (const pos of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
    const i = left.findIndex((p) => p.pos === pos);
    if (i >= 0) order.push(left.splice(i, 1)[0]);
  }
  players = [...order, ...left];
  const minutesPlan: Record<string, number> = {};
  players.forEach((p, i) => (minutesPlan[p.id] = i < 5 ? 30 : i < 9 ? 15 : 5));
  const label = kind === 'youth' ? `${club.short} Espoirs` : club.name;
  return { id: `${club.id}${kind === 'youth' ? '_U21' : ''}`, name: label, short: kind === 'youth' ? `${club.short}U` : club.short, colors: club.colors, tactics: { ...club.coach.tactics }, players, minutesPlan };
}

export function specialEntries(c: Career, clubId: string, kind: 'youth' | 'nat', userId: string): RosterEntry[] {
  const t = specialTeamInput(c, clubId, kind, userId);
  return t.players.map((p, i) => ({ p, minutes: t.minutesPlan?.[p.id] ?? 0, starter: i < 5 }));
}
