import { hashString, Rng } from '../core/rng';
import { ALL_ATTRS, ATTR_LABELS, ARCHETYPES, OVR_WEIGHTS, POSITION_BASE, type Archetype, type AttrKey, type Position } from '../data/attributes';
import { age as ageOf, generatePlayer, NameRegistry, playerOvr } from '../data/generate';
import { fullName, type Appearance, type Club, type PlayerData, type SeasonLine } from '../data/model';
import { NATIONS } from '../data/names';
import { DEFAULT_STYLE, type TeamInput, type UserStyle } from '../sim/engine';
import { FIBA, NBA, NCB, withQuarterLength, type Ruleset } from '../sim/rules';
import { addStat, emptySeasonStat, fastSimGame, type RosterEntry, type SeasonStat } from './fastsim';
import { applyGains, trainWeek, type TrainingPlan } from './training';
import { createWorld, ensureNumbers, salaryFor, type Fixture, type UserGameLine, type World } from './world';
import { desk, focusWork, trainingReport, updateInterest, weeklyMessages, extra, applyCamp, endLoan, injuryWeek, life, mentorWeek, recordHistory, reviewObjectives, setObjectives, sponsorWeek, updateFollowers, weeklyLife, winterOffers, WINTER_WINDOW } from './life';
import { clearNational, comps, createCompetitions, ensureYouthFixture, fixtureLevel, isComp, isSpecialTeam, natId, progressCompetitions, progressNational, specialEntries, specialTeamInput, startNationalTournament } from './competitions';

export const SAVE_VERSION = 4;
export const START_SEASON = 2026;
export const REGULAR_WEEKS = 22;

export type StartPath = 'formation' | 'amateur' | 'academy' | 'ncaa' | 'pro';

export const START_PATHS: Record<StartPath, { label: string; desc: string; league: string; age: [number, number]; level: number; role: 'prospect' | 'rotation' }> = {
  formation: { label: 'Centre de formation', desc: 'Espoir d’un club d’Élite Nationale. Peu de minutes au début, mais un staff de qualité.', league: 'FRA1', age: [16, 17], level: 8.4, role: 'prospect' },
  amateur: { label: 'Club amateur → Pro Nationale', desc: 'Vous signez dans un club modeste de deuxième division : du temps de jeu tout de suite.', league: 'FRA2', age: [17, 18], level: 8.6, role: 'rotation' },
  academy: { label: 'Académie européenne', desc: 'Académie d’un club de Liga Peninsular. Exigence, concurrence internationale.', league: 'ESP1', age: [16, 17], level: 8.5, role: 'prospect' },
  ncaa: { label: 'Université américaine (NCB)', desc: 'Bourse dans une université fictive de la conférence NCB (4×10 min, horloge 30 s).', league: 'NCB', age: [18, 18], level: 9.0, role: 'rotation' },
  pro: { label: 'Jeune pro déjà intégré', desc: 'Contrat pro dans un club d’Élite Nationale, en fond de rotation.', league: 'FRA1', age: [18, 18], level: 9.6, role: 'rotation' },
};

export interface CreationInput {
  firstName: string;
  lastName: string;
  nationality: string;
  birthCity: string;
  age: number;
  heightCm: number;
  weightKg: number;
  hand: 'R' | 'L';
  number: number;
  pos: Position;
  pos2: Position;
  archetype: Archetype;
  appearance: Appearance;
  path: StartPath;
  seed?: number;
}

export interface NewsItem {
  id: string;
  season: number;
  week: number;
  kind: 'match' | 'transfer' | 'rumor' | 'award' | 'injury' | 'coach' | 'league' | 'national' | 'training' | 'event';
  title: string;
  body: string;
}

export interface Trophy {
  season: number;
  title: string;
  kind: 'team' | 'individual';
}

export interface Offer {
  id: string;
  clubId: string;
  salary: number;
  years: number;
  role: 'prospect' | 'rotation' | 'starter' | 'star';
  note: string;
}

export interface Agent {
  id: string;
  name: string;
  network: number; // 1..20
  negotiation: number;
  commission: number; // %
  region: string;
}

export const AGENTS: Agent[] = [
  { id: 'none', name: 'Aucun agent', network: 3, negotiation: 3, commission: 0, region: '—' },
  { id: 'a1', name: 'Claire Duvernois (Sportis Conseil)', network: 12, negotiation: 14, commission: 6, region: 'France' },
  { id: 'a2', name: 'Marco Lazzari (EuroHoops Management)', network: 16, negotiation: 11, commission: 8, region: 'Europe' },
  { id: 'a3', name: 'Dwayne Brooks (Atlantic Talent Group)', network: 18, negotiation: 16, commission: 10, region: 'Amérique du Nord' },
];

export interface Relations {
  coach: number;
  teammates: number;
  captain: number;
  fans: number;
  media: number;
  agent: number;
  medical: number;
  board: number;
}

export interface PendingEvent {
  id: string;
  title: string;
  body: string;
  choices: { label: string; effect: string }[];
}

export interface MatchSettings {
  quarterMin: number; // 0 = durée officielle de la compétition ; sinon option arcade (minutes)
  speed: number;
  assist: boolean;
}

export interface Career {
  version: number;
  id: string;
  createdAt: number;
  updatedAt: number;
  world: World;
  userId: string;
  week: number;
  phase: 'regular' | 'playoffs' | 'offseason';
  plan: TrainingPlan;
  trust: number;
  relations: Relations;
  news: NewsItem[];
  trophies: Trophy[];
  offers: Offer[];
  agentId: string;
  seasonStats: Record<string, SeasonStat>;
  lastTraining: { note: string; changed: AttrKey[]; program: string } | null;
  event: PendingEvent | null;
  settings: MatchSettings;
  ovrHistory: { season: number; week: number; ovr: number }[];
  bestGames: { season: number; week: number; opp: string; pts: number; reb: number; ast: number; rating: number }[];
  retired: boolean;
  nationalCaps: number;
  /** Statistiques du joueur hors championnat (coupes, Europe, Espoirs, sélection) */
  compStats: Record<string, SeasonStat>;
  /** Consignes personnelles appliquées par l'IA quand elle joue votre joueur */
  style: UserStyle;
}

let newsCounter = 0;
export function addNews(c: Career, kind: NewsItem['kind'], title: string, body: string): void {
  newsCounter++;
  c.news.unshift({ id: `n${Date.now().toString(36)}${newsCounter}`, season: c.world.season, week: c.week, kind, title, body });
  if (c.news.length > 120) c.news.length = 120;
}

export function user(c: Career): PlayerData {
  return c.world.players[c.userId];
}
export function userClub(c: Career): Club {
  const u = user(c);
  return c.world.clubs[u.clubId!];
}
export function rngFor(c: Career, salt: string): Rng {
  return new Rng(hashString(`${c.world.seed}|${c.world.season}|${c.week}|${salt}`));
}

export function rulesFor(c: Career, leagueId: string): Ruleset {
  const l = c.world.leagues[leagueId];
  const base = !l ? FIBA : l.rules === 'NBA' ? NBA : l.rules === 'NCB' ? NCB : FIBA;
  return c.settings.quarterMin > 0 && c.settings.quarterMin < base.quarterMin ? withQuarterLength(base, c.settings.quarterMin) : base;
}

// ------------------------------------------------------------------ Création
export function createCareer(input: CreationInput): Career {
  const seed = input.seed ?? (Date.now() & 0x7fffffff);
  const world = createWorld(seed, START_SEASON);
  const rng = new Rng(seed ^ 0x51ed);
  const path = START_PATHS[input.path];
  const names = new NameRegistry(world.usedNames);
  names.used.add(`${input.firstName} ${input.lastName}`);
  const base = generatePlayer(rng, names, { pos: input.pos, archetype: input.archetype, age: input.age, level: path.level, nation: input.nationality, season: START_SEASON });
  // Morphologie choisie : influence réelle sur les qualités physiques
  const hDiff = (input.heightCm - (base.heightCm ?? input.heightCm)) / 5;
  const bmi = input.weightKg / (input.heightCm / 100) ** 2;
  const adj: Partial<Record<AttrKey, number>> = {
    speed: -hDiff * 0.6 - (bmi - 23) * 0.35,
    agility: -hDiff * 0.5,
    strength: hDiff * 0.4 + (bmi - 23) * 0.6,
    defRebound: hDiff * 0.6,
    block: hDiff * 0.5,
    rimProtect: hDiff * 0.4,
    dribble: -hDiff * 0.3,
  };
  for (const [k, v] of Object.entries(adj) as [AttrKey, number][]) base.attrs[k] = Math.round(Math.max(1, Math.min(20, base.attrs[k] + v)));
  const u: PlayerData = {
    ...base,
    id: 'user',
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    nationality: input.nationality,
    birthCity: input.birthCity,
    heightCm: input.heightCm,
    weightKg: input.weightKg,
    hand: input.hand,
    number: input.number,
    pos2: input.pos2,
    appearance: input.appearance,
    isUser: true,
    potential: Math.round(Math.min(94, Math.max(playerOvr(base) + 18, 72 + rng.normal(4, 6)))),
    reputation: 5,
    morale: 70,
    confidence: 55,
  };
  // Club de départ : un club du championnat choisi, au hasard mais cohérent avec le parcours
  const league = world.leagues[path.league];
  const clubId = rng.pick(league.teams.slice(input.path === 'formation' ? 0 : 3));
  const club = world.clubs[clubId];
  u.clubId = clubId;
  u.contract = { clubId, salary: path.league === 'NCB' ? 0 : path.role === 'prospect' ? 18000 : salaryFor(playerOvr(u), league.level), until: START_SEASON + (input.path === 'ncaa' ? 3 : 2), role: path.role };
  world.players[u.id] = u;
  // Le joueur prend la place du dernier de l'effectif au même poste
  const victims = club.roster.filter((id) => world.players[id].pos === u.pos).sort((a, b) => playerOvr(world.players[a]) - playerOvr(world.players[b]));
  if (club.roster.length >= 12 && victims.length) {
    const out = world.players[victims[0]];
    club.roster = club.roster.filter((id) => id !== out.id);
    out.clubId = null;
    out.contract = null;
  }
  club.roster.push(u.id);
  ensureNumbers(world, club);
  u.number = input.number;
  for (const id of club.roster) if (id !== u.id && world.players[id].number === u.number) world.players[id].number = (u.number + 11) % 56;
  world.usedNames = [...names.used];

  const c: Career = {
    version: SAVE_VERSION,
    id: `c${seed.toString(36)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    world,
    userId: u.id,
    week: 1,
    phase: 'regular',
    plan: { mode: 'auto-weakness', program: 'shootingOut', intensity: 'normal', specialistCoach: false },
    trust: path.role === 'prospect' ? 30 : 42,
    relations: { coach: 50, teammates: 55, captain: 50, fans: 30, media: 30, agent: 50, medical: 60, board: 50 },
    news: [],
    trophies: [],
    offers: [],
    agentId: 'none',
    seasonStats: {},
    lastTraining: null,
    event: null,
    settings: { quarterMin: 0, speed: 4, assist: true },
    ovrHistory: [{ season: START_SEASON, week: 0, ovr: playerOvr(u) }],
    bestGames: [],
    retired: false,
    nationalCaps: 0,
    compStats: {},
    style: { ...DEFAULT_STYLE },
  };
  generateSchedule(c);
  ensureYouthFixture(c, userRole(c).rank);
  setObjectives(c);
  extra(c).attrSnap = { season: START_SEASON, attrs: { ...u.attrs } };
  addNews(c, 'league', `${fullName(u)} rejoint ${club.name}`, `À ${input.age} ans, le ${ARCHETYPES[u.archetype].label.toLowerCase()} né à ${u.birthCity} (${NATIONS[u.nationality]?.label ?? u.nationality}) commence son aventure en ${league.name}. L’entraîneur ${club.coach.name} prévient : « Ici, les minutes se méritent. »`);
  return c;
}

// ------------------------------------------------------------------ Calendrier
export function generateSchedule(c: Career): void {
  const w = c.world;
  w.fixtures = w.fixtures.filter((f) => false && f);
  for (const league of Object.values(w.leagues)) {
    const teams = [...league.teams];
    const n = teams.length;
    const rounds: [string, string][][] = [];
    const arr = [...teams];
    for (let r = 0; r < n - 1; r++) {
      const pairs: [string, string][] = [];
      for (let i = 0; i < n / 2; i++) {
        const a = arr[i];
        const b = arr[n - 1 - i];
        pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
      }
      rounds.push(pairs);
      arr.splice(1, 0, arr.pop()!);
    }
    const all = [...rounds, ...rounds.map((rd) => rd.map(([a, b]) => [b, a] as [string, string]))];
    all.forEach((rd, i) => {
      rd.forEach(([home, away], k) => {
        w.fixtures.push({ id: `${league.id}-${w.season}-${i + 1}-${k}`, leagueId: league.id, round: i + 1, week: i + 1, home, away, played: false, hs: 0, as: 0, stage: 'regular' });
      });
    });
  }
  createCompetitions(c);
}

export interface StandingRow {
  clubId: string;
  w: number;
  l: number;
  pf: number;
  pa: number;
  streak: string;
  last5: string;
}

export function standings(c: Career, leagueId: string): StandingRow[] {
  const rows = new Map<string, StandingRow & { res: string[] }>();
  for (const id of c.world.leagues[leagueId].teams) rows.set(id, { clubId: id, w: 0, l: 0, pf: 0, pa: 0, streak: '', last5: '', res: [] });
  for (const f of c.world.fixtures) {
    if (f.leagueId !== leagueId || !f.played || f.stage !== 'regular') continue;
    const h = rows.get(f.home);
    const a = rows.get(f.away);
    if (!h || !a) continue; // composition modifiée (montées/descentes)
    h.pf += f.hs;
    h.pa += f.as;
    a.pf += f.as;
    a.pa += f.hs;
    if (f.hs > f.as) {
      h.w++;
      a.l++;
      h.res.push('V');
      a.res.push('D');
    } else {
      a.w++;
      h.l++;
      h.res.push('D');
      a.res.push('V');
    }
  }
  const list = [...rows.values()];
  for (const r of list) {
    r.last5 = r.res.slice(-5).join('');
    const last = r.res[r.res.length - 1];
    let n = 0;
    for (let i = r.res.length - 1; i >= 0 && r.res[i] === last; i--) n++;
    r.streak = last ? `${last}${n}` : '';
  }
  list.sort((a, b) => b.w - a.w || b.pf - b.pa - (a.pf - a.pa) || b.pf - a.pf);
  return list;
}

/** Équipes que le joueur représente cette saison (club, et sélection nationale l'été). */
export function userTeams(c: Career): string[] {
  const u = user(c);
  const nat = c.world.clubs[natId(u.nationality)];
  return nat && nat.roster.includes(u.id) ? [u.clubId!, nat.id] : [u.clubId!];
}

const STAGE_ORDER: Record<string, number> = { regular: 0, semi: 0, final: 0, cup: 1, nat: 1, youth: 2 };
export function userFixture(c: Career): Fixture | null {
  const teams = userTeams(c);
  const list = c.world.fixtures.filter((f) => f.week === c.week && !f.played && (teams.includes(f.home) || teams.includes(f.away)));
  list.sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]);
  return list[0] ?? null;
}

/** Côté du joueur dans un match (id de l'équipe qu'il représente). */
export function userSideId(c: Career, f: Fixture): string {
  const teams = userTeams(c);
  return teams.includes(f.home) ? f.home : f.away;
}

// ------------------------------------------------------------------ Coach et rotation
const SLOT_ORDER: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

/** Note du coach pour un joueur : niveau, forme, confiance, âge et philosophie. */
export function coachScore(c: Career, club: Club, p: PlayerData): number {
  if (p.injuryDays > 0) return -99;
  const age = ageOf(p, c.world.season);
  let s = playerOvr(p) + (p.form - 0.5) * 6 - p.fatigue / 25;
  if (age < 20) s -= (1 - club.coach.youthTrust) * 4;
  if (club.philosophy === 'youth' && age < 23) s += 1.5;
  if (club.philosophy === 'win-now' && age > 26) s += 1;
  if (p.isUser) s += (c.trust - 50) / 7 + (c.relations.coach - 50) / 25;
  else s += (p.confidence - 50) / 25;
  return s;
}

export interface DepthChart {
  starters: PlayerData[];
  bench: PlayerData[];
  minutes: Record<string, number>;
  order: PlayerData[];
}

export function depthChart(c: Career, clubId: string): DepthChart {
  const club = c.world.clubs[clubId];
  const players = club.roster.map((id) => c.world.players[id]).filter((p) => p && !p.retired);
  const scored = players.map((p) => ({ p, s: coachScore(c, club, p) })).sort((a, b) => b.s - a.s);
  const starters: PlayerData[] = [];
  const used = new Set<string>();
  for (const pos of SLOT_ORDER) {
    const cand = scored.find((x) => !used.has(x.p.id) && x.s > -50 && (x.p.pos === pos || x.p.pos2 === pos) && (x.p.pos === pos || scored.filter((y) => y.p.pos === pos && !used.has(y.p.id) && y.s > -50).every((y) => y.s < x.s - 3)));
    const pick = cand ?? scored.find((x) => !used.has(x.p.id) && x.p.pos === pos && x.s > -50) ?? scored.find((x) => !used.has(x.p.id) && x.s > -50);
    if (pick) {
      starters.push(pick.p);
      used.add(pick.p.id);
    }
  }
  // Ordonner les titulaires par poste pour le moteur
  starters.sort((a, b) => SLOT_ORDER.indexOf(a.pos) - SLOT_ORDER.indexOf(b.pos));
  const bench = scored.filter((x) => !used.has(x.p.id)).map((x) => x.p);
  const minutes: Record<string, number> = {};
  const benchMins = [22, 18, 14, 9, 5, 3, 0, 0, 0];
  starters.forEach((p, i) => (minutes[p.id] = 31 - i * 0.5));
  bench.forEach((p, i) => (minutes[p.id] = p.injuryDays > 0 ? 0 : benchMins[i] ?? 0));
  return { starters, bench, minutes, order: [...starters, ...bench] };
}

export function userRole(c: Career): { label: string; minutes: number; rank: number } {
  const u = user(c);
  const dc = depthChart(c, u.clubId!);
  const rank = dc.order.findIndex((p) => p.id === u.id);
  const minutes = dc.minutes[u.id] ?? 0;
  let label: string;
  if (u.injuryDays > 0) label = 'Blessé';
  else if (rank < 5) label = rank === 0 && playerOvr(u) >= 70 ? 'Leader titulaire' : 'Titulaire';
  else if (rank === 5) label = 'Sixième homme';
  else if (rank <= 8) label = 'Rotation';
  else if (minutes > 0) label = 'Fin de banc';
  else label = 'Hors rotation';
  return { label, minutes, rank };
}

/** Construit l'équipe pour le moteur de match (titulaires d'abord). Exclut les blessés. */
export function teamInput(c: Career, clubId: string, f?: Fixture): TeamInput {
  const sp = f ? isSpecialTeam(c, clubId, f) : null;
  if (sp) return specialTeamInput(c, clubId, sp, c.userId);
  const club = c.world.clubs[clubId];
  const dc = depthChart(c, clubId);
  const healthy = dc.order.filter((p) => p.injuryDays <= 0).slice(0, 12);
  const minutesPlan: Record<string, number> = {};
  for (const p of healthy) minutesPlan[p.id] = dc.minutes[p.id] ?? 0;
  return { id: club.id, name: club.name, short: club.short, colors: club.colors, tactics: { ...club.coach.tactics }, players: healthy, minutesPlan };
}

function rosterEntries(c: Career, clubId: string, f?: Fixture): RosterEntry[] {
  const sp = f ? isSpecialTeam(c, clubId, f) : null;
  if (sp) return specialEntries(c, clubId, sp, c.userId);
  const dc = depthChart(c, clubId);
  return dc.order.filter((p) => p.injuryDays <= 0).map((p) => ({ p, minutes: dc.minutes[p.id] ?? 0, starter: dc.starters.includes(p) }));
}

// ------------------------------------------------------------------ Résultats
export function gameRating(l: { pts: number; reb: number; ast: number; stl: number; blk: number; tov: number; fgm: number; fga: number; ftm: number; fta: number; pf: number; min: number; pm: number }): number {
  if (l.min <= 0) return 0;
  const gs = l.pts + 0.4 * l.fgm - 0.7 * l.fga - 0.4 * (l.fta - l.ftm) + 0.7 * (l.reb * 0.7) + 0.3 * (l.reb * 0.3) + l.stl + 0.7 * l.ast + 0.7 * l.blk - 0.4 * l.pf - l.tov + l.pm * 0.05;
  const per40 = (gs / Math.max(4, l.min)) * 30;
  return Math.round(Math.max(1, Math.min(10, 5.6 + per40 * 0.22)) * 10) / 10;
}

function ensureStat(c: Career, id: string): SeasonStat {
  return (c.seasonStats[id] ??= emptySeasonStat());
}

/** Enregistre le résultat d'un match (joué en direct ou simulé par le moteur complet). */
export function recordUserMatch(
  c: Career,
  fixture: Fixture,
  hs: number,
  as: number,
  lines: Map<string, SeasonStat & { pm?: number }>,
  live: boolean,
): UserGameLine {
  fixture.played = true;
  fixture.hs = hs;
  fixture.as = as;
  const leagueGame = !!c.world.leagues[fixture.leagueId];
  const u = user(c);
  if (leagueGame) {
    for (const [id, st] of lines) if (c.world.players[id]) addStat(ensureStat(c, id), { ...emptySeasonStat(), ...st, gp: st.min > 0 ? 1 : 0 });
  } else {
    const kind = fixture.stage === 'youth' ? 'youth' : fixture.stage === 'nat' ? 'nat' : isComp(fixture.leagueId, c.world)?.kind ?? 'cup';
    const st0 = lines.get(u.id);
    if (st0) addStat((c.compStats[kind] ??= emptySeasonStat()), { ...emptySeasonStat(), ...st0, gp: st0.min > 0 ? 1 : 0 });
  }
  const st = lines.get(u.id);
  const line: UserGameLine = {
    min: st?.min ?? 0,
    pts: st?.pts ?? 0,
    reb: st?.reb ?? 0,
    ast: st?.ast ?? 0,
    stl: st?.stl ?? 0,
    blk: st?.blk ?? 0,
    tov: st?.tov ?? 0,
    fgm: st?.fgm ?? 0,
    fga: st?.fga ?? 0,
    tpm: st?.tpm ?? 0,
    tpa: st?.tpa ?? 0,
    ftm: st?.ftm ?? 0,
    fta: st?.fta ?? 0,
    pf: st?.pf ?? 0,
    pm: st?.pm ?? 0,
    rating: 0,
    started: (st?.gs ?? 0) > 0,
    played: live,
  };
  line.rating = gameRating(line);
  fixture.userLine = line;
  const side = userSideId(c, fixture);
  const won = (fixture.home === side && hs > as) || (fixture.away === side && as > hs);
  // Conséquences : confiance, forme, confiance du coach, réputation, relations
  if (line.min > 0) {
    const delta = (line.rating - 6) * 3;
    u.confidence = clamp100(u.confidence + delta);
    u.form = Math.max(0, Math.min(1, u.form * 0.7 + (line.rating / 10) * 0.3));
    c.trust = clamp100(c.trust + (line.rating - 5.8) * 2.2 + (won ? 0.6 : -0.3));
    const lvl = fixtureLevel(c, fixture);
    if (fixture.stage === 'youth') c.trust = clamp100(c.trust + (line.rating - 5.5) * 0.8);
    u.reputation = clamp100(u.reputation + Math.max(-0.5, (line.rating - 6) * (lvl === 1 ? 0.9 : 0.5)) + line.min / 120);
    c.relations.fans = clamp100(c.relations.fans + (line.rating - 6) * 1.2 + (won ? 0.5 : 0));
    c.relations.media = clamp100(c.relations.media + (line.rating - 6.2) * 0.8);
    const opp = c.world.clubs[fixture.home === side ? fixture.away : fixture.home];
    c.bestGames.push({ season: c.world.season, week: c.week, opp: opp.name, pts: line.pts, reb: line.reb, ast: line.ast, rating: line.rating });
    c.bestGames.sort((a, b) => b.rating - a.rating || b.pts - a.pts);
    c.bestGames.length = Math.min(c.bestGames.length, 10);
  } else {
    u.confidence = clamp100(u.confidence - 1.5);
    c.relations.coach = clamp100(c.relations.coach - 0.5);
  }
  u.fatigue = Math.min(100, u.fatigue + line.min * 0.55);
  if (line.min > 0 && fixture.stage !== 'youth') life(c).pendingPress = fixture.id;
  matchNews(c, fixture, line, won);
  return line;
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function matchNews(c: Career, f: Fixture, l: UserGameLine, won: boolean): void {
  const u = user(c);
  const club = userClub(c);
  const opp = c.world.clubs[f.home === club.id ? f.away : f.home];
  const score = f.home === club.id ? `${f.hs}-${f.as}` : `${f.as}-${f.hs}`;
  const rng = rngFor(c, 'news' + f.id);
  const name = fullName(u);
  if (l.min <= 0) {
    addNews(c, 'match', `${club.short} ${won ? 'bat' : 's’incline face à'} ${opp.name} (${score})`, `${name} n’est pas entré en jeu. ${rng.pick(['Le staff lui demande de rester patient.', 'Une soirée passée à observer depuis le banc.', 'Il faudra convaincre à l’entraînement.'])}`);
    return;
  }
  const big = l.pts >= 20 || l.rating >= 8;
  const titles = big
    ? [`${name} crève l’écran contre ${opp.name}`, `Soirée de gala pour ${u.lastName}`, `${u.lastName}, l’homme du match`]
    : l.rating < 4.5
      ? [`Match difficile pour ${u.lastName}`, `${u.lastName} en manque de repères`]
      : [`${club.short} ${won ? 's’impose' : 'tombe'} face à ${opp.short}`, `${won ? 'Victoire' : 'Défaite'} ${score} pour ${club.name}`];
  const coachQuotes = won
    ? ['« On a défendu ensemble, c’est la clé. »', '« Je suis content de l’énergie du banc. »', '« Il faudra confirmer la semaine prochaine. »']
    : ['« Trop de pertes de balle, on doit être plus lucides. »', '« On n’a pas su contrôler le rebond. »', '« La défense n’a pas tenu dans le dernier quart. »'];
  addNews(
    c,
    'match',
    rng.pick(titles),
    `${club.name} ${won ? 'bat' : 'perd contre'} ${opp.name} (${score}). ${u.lastName} : ${l.pts} pts, ${l.reb} rbd, ${l.ast} pd en ${l.min} min (${l.fgm}/${l.fga} aux tirs, note ${l.rating.toFixed(1)}). ${club.coach.name} : ${rng.pick(coachQuotes)}`,
  );
}

// ------------------------------------------------------------------ Semaine
export interface WeekReport {
  training: { note: string; changed: AttrKey[]; program: string };
  injuries: string[];
  promoted?: string;
}

/** Fait avancer la carrière d'une semaine. Le match du joueur doit avoir été joué/simulé avant. */
export function advanceWeek(c: Career): WeekReport {
  const w = c.world;
  const rng = rngFor(c, 'week');
  const u = user(c);
  const uf = userFixture(c);
  if (uf) throw new Error('Le match de la semaine doit être joué ou simulé avant d’avancer.');
  // Matchs du monde (simulation rapide)
  for (const f of w.fixtures) {
    if (f.week !== c.week || f.played) continue;
    simFixture(c, f);
  }
  for (const m of [...progressCompetitions(c, c.week), ...progressNational(c, c.week)]) {
    addNews(c, 'league', m, 'Palmarès mis à jour.');
  }
  for (const comp of Object.values(comps(w))) {
    if (comp.winner && userTeams(c).includes(comp.winner) && !c.trophies.some((t) => t.season === w.season && t.title === comp.name)) {
      c.trophies.push({ season: w.season, title: comp.name, kind: 'team' });
      u.reputation = clamp100(u.reputation + (comp.kind === 'euro' || comp.kind === 'nat' ? 5 : 3));
    }
  }
  // Entraînement du joueur
  const club = userClub(c);
  const lastMin = c.world.fixtures.filter((f) => f.week === c.week && f.userLine).map((f) => f.userLine!.min)[0] ?? 0;
  const tr = trainWeek(u, c.plan, club.coach.development, club.facilities, lastMin, ageOf(u, w.season), rng);
  const changed = applyGains(u, tr.gains);
  u.fatigue = Math.max(0, Math.min(100, u.fatigue + tr.fatigue));
  const injuries: string[] = [];
  if (tr.injured > 0) {
    u.injuryDays = tr.injured;
    injuries.push(tr.note);
    addNews(c, 'injury', `${fullName(u)} blessé à l’entraînement`, `Le staff médical annonce une indisponibilité d’environ ${Math.ceil(tr.injured / 7)} semaine(s). La charge de travail était ${c.plan.intensity === 'intense' ? 'très élevée' : 'normale'}.`);
    c.relations.medical = clamp100(c.relations.medical - 3);
  }
  // Entraînement visible par le coach
  const intensityTrust = c.plan.intensity === 'intense' ? 0.8 : c.plan.intensity === 'light' ? -0.4 : 0.3;
  c.trust = clamp100(c.trust + intensityTrust + (u.attrs.discipline - 10) / 40);
  const progName = c.plan.mode === 'manual' ? c.plan.program : 'auto';
  c.lastTraining = { note: tr.note || (changed.length ? 'Progression constatée' : 'Travail régulier, sans progrès visible cette semaine'), changed, program: progName };
  // Évolution hebdomadaire légère des autres joueurs (jeunes) et récupération
  for (const p of Object.values(w.players)) {
    if (p.isUser || p.retired) {
      if (p.isUser) {
        p.fatigue = Math.max(0, p.fatigue - 22);
        if (p.injuryDays > 0) p.injuryDays = Math.max(0, p.injuryDays - 7);
      }
      continue;
    }
    p.fatigue = Math.max(0, p.fatigue - 26);
    if (p.injuryDays > 0) p.injuryDays = Math.max(0, p.injuryDays - 7);
    else if (rng.chance(0.004 * p.injuryRisk)) p.injuryDays = rng.int(7, 42);
    p.form = Math.max(0.1, Math.min(0.95, p.form + rng.normal(0, 0.06)));
  }
  // Blessure en match (joueur incarné)
  const lastLine = c.world.fixtures.find((f) => f.week === c.week && f.userLine)?.userLine;
  if (lastLine && lastLine.min > 0 && u.injuryDays <= 0 && rng.chance(0.012 * u.injuryRisk * (1 + u.fatigue / 80) * (1.5 - u.attrs.durability / 20))) {
    u.injuryDays = rng.int(7, 30);
    injuries.push(`Blessure en match (${u.injuryDays} jours)`);
    addNews(c, 'injury', `Coup dur pour ${fullName(u)}`, `Touché lors du dernier match, ${u.lastName} devrait manquer environ ${Math.ceil(u.injuryDays / 7)} semaine(s).`);
  }
  for (const n of weeklyLife(c, rng)) injuries.push(n);
  sponsorWeek(c, rng);
  focusWork(c);
  trainingReport(c, rng, changed.map((k) => ATTR_LABELS[k]));
  updateInterest(c, rng);
  weeklyMessages(c, rng);
  const ex = extra(c);
  (ex.wellness ??= []).push({ season: w.season, week: c.week, fatigue: Math.round(u.fatigue), morale: Math.round(u.morale), confidence: Math.round(u.confidence) });
  if (ex.wellness.length > 120) ex.wellness.shift();
  if (u.injuryDays > 0 && injuries.length) (ex.injuries ??= []).push({ season: w.season, week: c.week, days: u.injuryDays, cause: injuries[0] });
  injuryWeek(c, rng);
  mentorWeek(c);
  updateFollowers(c);
  if (c.phase === 'regular' && c.week === WINTER_WINDOW[0]) winterOffers(c);
  if (c.phase === 'regular' && c.week === WINTER_WINDOW[1]) c.offers = c.offers.filter((o) => !o.id.startsWith('w'));
  c.ovrHistory.push({ season: w.season, week: c.week, ovr: playerOvr(u) });
  if (c.ovrHistory.length > 400) c.ovrHistory.shift();
  maybeEvent(c, rng);
  leagueNews(c, rng);
  c.week++;
  if (c.phase === 'regular' && c.week > REGULAR_WEEKS) startPlayoffs(c);
  else if (c.phase === 'playoffs') progressPlayoffs(c);
  ensureYouthFixture(c, userRole(c).rank);
  c.updatedAt = Date.now();
  return { training: c.lastTraining, injuries };
}

/** Simulation rapide d'un match qui n'implique pas le joueur (ou qu'il ne joue pas). */
export function simFixture(c: Career, f: Fixture): void {
  const w = c.world;
  const res = fastSimGame(rosterEntries(c, f.home, f), rosterEntries(c, f.away, f), new Rng(hashString(f.id + w.seed)));
  f.played = true;
  f.hs = res.hs;
  f.as = res.as;
  if (!w.leagues[f.leagueId]) return;
  for (const [id, st] of res.lines) if (w.players[id]) addStat(ensureStat(c, id), st);
  for (const [id, st] of res.lines) if (w.players[id]) w.players[id].fatigue = Math.min(100, w.players[id].fatigue + st.min * 0.5);
}

function leagueNews(c: Career, rng: Rng): void {
  const u = user(c);
  const lid = userClub(c).leagueId;
  if (c.week % 4 === 0) {
    const st = standings(c, lid);
    const lead = c.world.clubs[st[0].clubId];
    addNews(c, 'league', `${lead.name} en tête de ${c.world.leagues[lid].name}`, `Après ${c.week} journées, ${lead.name} compte ${st[0].w} victoires pour ${st[0].l} défaites. ${rng.pick(['Les poursuivants restent à portée.', 'Une domination qui interroge la concurrence.', 'La course aux playoffs s’annonce serrée.'])}`);
  }
  // Rumeurs de transfert fondées sur la réputation réelle
  if (u.reputation > 35 && rng.chance(0.12 + u.reputation / 400)) {
    const clubs = Object.values(c.world.clubs).filter((cl) => cl.id !== u.clubId && cl.reputation > userClub(c).reputation - 10 && Math.abs(teamLevel(c, cl.id) - playerOvr(u)) < 8);
    if (clubs.length) {
      const cl = rng.pick(clubs);
      addNews(c, 'rumor', `Rumeur : ${cl.name} s’intéresse à ${u.lastName}`, `Selon nos informations, la cellule de recrutement de ${cl.name} a suivi ${u.lastName} lors de ses dernières sorties. Rien de concret à ce stade.`);
    }
  }
}

export function teamLevel(c: Career, clubId: string): number {
  const dc = depthChart(c, clubId);
  const top = dc.order.slice(0, 8);
  return top.reduce((s, p) => s + playerOvr(p), 0) / Math.max(1, top.length);
}

// ------------------------------------------------------------------ Événements à choix
const EVENTS: { id: string; cond: (c: Career) => boolean; title: string; body: (c: Career) => string; choices: { label: string; effect: string; apply: (c: Career) => void }[] }[] = [
  {
    id: 'coach-minutes',
    cond: (c) => userRole(c).rank >= 7 && c.week > 4,
    title: 'Peu de temps de jeu',
    body: (c) => `Vous jouez peu depuis plusieurs semaines. ${userClub(c).coach.name} accepte de vous recevoir.`,
    choices: [
      { label: 'Demander plus de minutes', effect: 'Confiance du coach −4, Ambition reconnue', apply: (c) => ((c.trust = clamp100(c.trust - 4)), (c.relations.coach = clamp100(c.relations.coach - 4)), (user(c).morale = clamp100(user(c).morale + 4))) },
      { label: 'Demander comment progresser', effect: 'Confiance du coach +5, travail spécifique', apply: (c) => ((c.trust = clamp100(c.trust + 5)), (c.relations.coach = clamp100(c.relations.coach + 4)), (c.plan.specialistCoach = true)) },
      { label: 'Ne rien dire', effect: 'Moral −3', apply: (c) => (user(c).morale = clamp100(user(c).morale - 3)) },
    ],
  },
  {
    id: 'locker',
    cond: (c) => c.relations.teammates < 50 || c.week % 7 === 3,
    title: 'Tension dans le vestiaire',
    body: () => 'Après une défaite, un cadre de l’équipe critique publiquement l’implication des jeunes joueurs.',
    choices: [
      { label: 'Répondre devant le groupe', effect: 'Leadership +1, Relations coéquipiers −6', apply: (c) => ((user(c).attrs.leadership = Math.min(20, user(c).attrs.leadership + 1)), (c.relations.teammates = clamp100(c.relations.teammates - 6))) },
      { label: 'Répondre sur le terrain', effect: 'Détermination +1, Concentration +1', apply: (c) => ((user(c).attrs.determination = Math.min(20, user(c).attrs.determination + 1)), (user(c).attrs.concentration = Math.min(20, user(c).attrs.concentration + 1))) },
      { label: 'En parler au capitaine', effect: 'Relations capitaine +8, coéquipiers +4', apply: (c) => ((c.relations.captain = clamp100(c.relations.captain + 8)), (c.relations.teammates = clamp100(c.relations.teammates + 4))) },
    ],
  },
  {
    id: 'media',
    cond: (c) => user(c).reputation > 25 && c.relations.media < 55,
    title: 'Sollicitation médiatique',
    body: (c) => `Un grand quotidien sportif souhaite consacrer un portrait à ${user(c).lastName}.`,
    choices: [
      { label: 'Accepter l’interview', effect: 'Médias +10, Supporters +5, Fatigue +8', apply: (c) => ((c.relations.media = clamp100(c.relations.media + 10)), (c.relations.fans = clamp100(c.relations.fans + 5)), (user(c).fatigue = Math.min(100, user(c).fatigue + 8))) },
      { label: 'Refuser poliment', effect: 'Médias −4, Concentration préservée', apply: (c) => (c.relations.media = clamp100(c.relations.media - 4)) },
    ],
  },
  {
    id: 'extra-work',
    cond: (c) => user(c).fatigue < 45 && c.week % 5 === 2,
    title: 'Séance supplémentaire',
    body: () => 'Un assistant propose des séances de tir supplémentaires tôt le matin.',
    choices: [
      { label: 'Accepter (3 semaines)', effect: 'Tir à 3 pts +1, Fatigue +15, risque de blessure accru', apply: (c) => ((user(c).attrs.three = Math.min(20, user(c).attrs.three + 1)), (user(c).fatigue = Math.min(100, user(c).fatigue + 15)), (user(c).injuryRisk *= 1.05)) },
      { label: 'Préserver son corps', effect: 'Relations staff médical +6', apply: (c) => (c.relations.medical = clamp100(c.relations.medical + 6)) },
    ],
  },
];

function maybeEvent(c: Career, rng: Rng): void {
  if (c.event || !rng.chance(0.22)) return;
  const ok = EVENTS.filter((e) => e.cond(c));
  if (!ok.length) return;
  const e = rng.pick(ok);
  c.event = { id: e.id, title: e.title, body: e.body(c), choices: e.choices.map((ch) => ({ label: ch.label, effect: ch.effect })) };
}

export function resolveEvent(c: Career, choice: number): void {
  if (!c.event) return;
  const def = EVENTS.find((e) => e.id === c.event!.id);
  const ch = def?.choices[choice];
  if (ch) {
    ch.apply(c);
    addNews(c, 'event', c.event.title, `Décision : ${ch.label}. (${ch.effect})`);
  }
  c.event = null;
}

// ------------------------------------------------------------------ Playoffs
function startPlayoffs(c: Career): void {
  c.phase = 'playoffs';
  const w = c.world;
  for (const l of Object.values(w.leagues)) {
    if (l.playoffs < 4) continue;
    const st = standings(c, l.id);
    const seeds = st.slice(0, 4).map((r) => r.clubId);
    w.fixtures.push({ id: `${l.id}-${w.season}-SF1`, leagueId: l.id, round: 23, week: REGULAR_WEEKS + 1, home: seeds[0], away: seeds[3], played: false, hs: 0, as: 0, stage: 'semi' });
    w.fixtures.push({ id: `${l.id}-${w.season}-SF2`, leagueId: l.id, round: 23, week: REGULAR_WEEKS + 1, home: seeds[1], away: seeds[2], played: false, hs: 0, as: 0, stage: 'semi' });
  }
  addNews(c, 'league', 'Place aux playoffs', 'Les quatre meilleures équipes de chaque championnat disputent le Final Four : demi-finales puis finale.');
}

function progressPlayoffs(c: Career): void {
  const w = c.world;
  if (c.week === REGULAR_WEEKS + 2) {
    for (const l of Object.values(w.leagues)) {
      const semis = w.fixtures.filter((f) => f.leagueId === l.id && f.stage === 'semi' && f.played);
      if (semis.length < 2) continue;
      const win = (f: Fixture) => (f.hs > f.as ? f.home : f.away);
      const [a, b] = semis.map(win);
      const sa = standings(c, l.id).findIndex((r) => r.clubId === a);
      const sb = standings(c, l.id).findIndex((r) => r.clubId === b);
      w.fixtures.push({ id: `${l.id}-${w.season}-F`, leagueId: l.id, round: 24, week: REGULAR_WEEKS + 2, home: sa < sb ? a : b, away: sa < sb ? b : a, played: false, hs: 0, as: 0, stage: 'final' });
    }
  } else if (c.week > REGULAR_WEEKS + 2) {
    c.phase = 'offseason';
    seasonReview(c);
  }
}

// ------------------------------------------------------------------ Fin de saison
export function champion(c: Career, leagueId: string): string | null {
  const f = c.world.fixtures.find((x) => x.leagueId === leagueId && x.stage === 'final' && x.played);
  if (!f) return null;
  return f.hs > f.as ? f.home : f.away;
}

function seasonReview(c: Career): void {
  const w = c.world;
  const u = user(c);
  for (const l of Object.values(w.leagues)) {
    const champ = champion(c, l.id);
    if (champ) {
      addNews(c, 'league', `${w.clubs[champ].name} champion de ${l.name}`, `Sacre pour ${w.clubs[champ].name} au terme du Final Four ${w.season}-${w.season + 1}.`);
      if (champ === u.clubId) c.trophies.push({ season: w.season, title: `Champion — ${l.name}`, kind: 'team' });
    }
    // Récompenses individuelles calculées sur les statistiques réelles de la saison
    const elig = l.teams.flatMap((t) => w.clubs[t].roster).map((id) => w.players[id]).filter((p) => p && (c.seasonStats[p.id]?.gp ?? 0) >= 10);
    const score = (p: PlayerData) => {
      const s = c.seasonStats[p.id];
      return (s.pts + s.reb * 0.8 + s.ast + s.stl + s.blk - s.tov * 0.7) / s.gp;
    };
    const mvp = [...elig].sort((a, b) => score(b) - score(a))[0];
    const young = elig.filter((p) => ageOf(p, w.season) <= 21).sort((a, b) => score(b) - score(a))[0];
    if (champ) recordHistory(c, l.name, w.clubs[champ].name, mvp ? `${fullName(mvp)} (${w.clubs[mvp.clubId!]?.short ?? '—'})` : '—', champ === u.clubId);
    if (mvp) {
      addNews(c, 'award', `${fullName(mvp)} élu MVP de ${l.name}`, `${(c.seasonStats[mvp.id].pts / c.seasonStats[mvp.id].gp).toFixed(1)} points de moyenne pour le joueur de ${w.clubs[mvp.clubId!]?.name ?? 'son club'}.`);
      if (mvp.isUser) c.trophies.push({ season: w.season, title: `MVP — ${l.name}`, kind: 'individual' });
    }
    if (young) {
      if (young.isUser) c.trophies.push({ season: w.season, title: `Meilleur jeune — ${l.name}`, kind: 'individual' });
      addNews(c, 'award', `${fullName(young)} meilleur jeune de ${l.name}`, 'Une saison prometteuse récompensée.');
    }
  }
  // Sélection nationale (convocation fondée sur le niveau réel)
  const age = ageOf(u, w.season);
  const ovr = playerOvr(u);
  const threshold = age <= 18 ? 58 : age <= 20 ? 62 : 70;
  if (ovr >= threshold) {
    const cat = age <= 18 ? 'U18' : age <= 20 ? 'U20' : 'A';
    c.nationalCaps += cat === 'A' ? 4 : 0;
    startNationalTournament(c, cat);
    c.trophies.push({ season: w.season, title: `Sélection nationale ${cat} — ${NATIONS[u.nationality]?.label ?? u.nationality}`, kind: 'individual' });
    addNews(c, 'national', `${fullName(u)} convoqué en équipe nationale ${cat}`, `Le sélectionneur récompense une saison à ${ovr} de note globale. Rendez-vous cet été pour le Tournoi des nations : trois matchs de poule puis une finale.`);
    u.reputation = clamp100(u.reputation + (cat === 'A' ? 6 : 3));
  }
  addNews(c, 'coach', 'Bilan des objectifs de la saison', `${reviewObjectives(c)}. Le staff en tient compte pour la saison prochaine.`);
  generateOffers(c);
}

export function generateOffers(c: Career): void {
  const w = c.world;
  const u = user(c);
  const rng = rngFor(c, 'offers');
  const agent = AGENTS.find((a) => a.id === c.agentId) ?? AGENTS[0];
  const ovr = playerOvr(u);
  const offers: Offer[] = [];
  const clubs = Object.values(w.clubs).filter((cl) => cl.id !== u.clubId && !!w.leagues[cl.leagueId]);
  for (const cl of clubs) {
    const lvl = teamLevel(c, cl.id);
    const league = w.leagues[cl.leagueId];
    if (league.id === 'NCB' && ageOf(u, w.season) > 21) continue;
    if (league.id === 'NCB' && u.clubId && w.clubs[u.clubId].leagueId !== 'NCB') continue;
    // Intérêt : le joueur doit apporter quelque chose au club (niveau, poste, réputation)
    const fitLevel = ovr - lvl;
    if (fitLevel < -9 || fitLevel > 10) continue;
    const needPos = cl.roster.filter((id) => w.players[id]?.pos === u.pos).length <= 2 ? 0.15 : 0;
    const followed = (desk(c).interest[cl.id] ?? 0) / 100;
    const interest = followed * 0.6 + (life(c).transferRequest ? 0.2 : 0) + 0.08 + (fitLevel + 9) / 40 + needPos + u.reputation / 300 + agent.network / 120 - (cl.reputation - u.reputation) / 400;
    if (!rng.chance(Math.max(0, Math.min(0.8, interest)))) continue;
    const role: Offer['role'] = fitLevel > 4 ? 'star' : fitLevel > 0 ? 'starter' : fitLevel > -5 ? 'rotation' : 'prospect';
    const salary = Math.round((salaryFor(ovr, league.level) * (1 + agent.negotiation / 60) * rng.range(0.85, 1.2)) / 1000) * 1000;
    offers.push({ id: `o${cl.id}${w.season}`, clubId: cl.id, salary, years: rng.int(1, 3), role, note: `${league.name} · niveau d’équipe ${Math.round(lvl)}` });
  }
  offers.sort((a, b) => w.clubs[b.clubId].reputation - w.clubs[a.clubId].reputation);
  c.offers = offers.slice(0, 2 + Math.floor(agent.network / 6));
  // Prolongation proposée par le club actuel si le contrat expire
  if (u.contract && u.contract.until <= w.season && u.clubId) {
    const club = w.clubs[u.clubId];
    if (c.trust > 35 || ovr >= teamLevel(c, club.id) - 2) {
      c.offers.unshift({ id: `ext${w.season}`, clubId: club.id, salary: Math.round((salaryFor(ovr, w.leagues[club.leagueId].level) * 1.05) / 1000) * 1000, years: 2, role: c.trust > 60 ? 'starter' : 'rotation', note: 'Prolongation proposée par votre club' });
    }
  }
}

export function acceptOffer(c: Career, offerId: string): void {
  const o = c.offers.find((x) => x.id === offerId);
  if (!o) return;
  const w = c.world;
  const u = user(c);
  const old = u.clubId ? w.clubs[u.clubId] : null;
  if (old && old.id !== o.clubId) old.roster = old.roster.filter((id) => id !== u.id);
  const club = w.clubs[o.clubId];
  if (!club.roster.includes(u.id)) {
    // Le club libère son joueur le moins utile pour faire de la place
    if (club.roster.length >= 13) {
      const out = club.roster.map((id) => w.players[id]).sort((a, b) => playerOvr(a) - playerOvr(b))[0];
      club.roster = club.roster.filter((id) => id !== out.id);
      out.clubId = null;
      out.contract = null;
      if (old) {
        old.roster.push(out.id);
        out.clubId = old.id;
        out.contract = { clubId: old.id, salary: salaryFor(playerOvr(out), w.leagues[old.leagueId].level), until: w.season + 2, role: 'rotation' };
      }
    }
    club.roster.push(u.id);
  }
  u.clubId = club.id;
  u.contract = { clubId: club.id, salary: o.salary, until: w.season + o.years, role: o.role };
  c.trust = o.role === 'star' ? 70 : o.role === 'starter' ? 58 : o.role === 'rotation' ? 45 : 32;
  c.relations.teammates = 50;
  c.relations.coach = 55;
  c.relations.board = 55;
  ensureNumbers(w, club);
  if (old?.id !== club.id) {
    addNews(c, 'transfer', `Officiel : ${fullName(u)} signe à ${club.name}`, `Contrat de ${o.years} an(s), rôle annoncé : ${roleLabel(o.role)}. ${old ? `Il quitte ${old.name}.` : ''}`);
    u.teamFit = 40;
  } else addNews(c, 'transfer', `${fullName(u)} prolonge à ${club.name}`, `Nouveau contrat jusqu’en ${u.contract.until + 1}.`);
  c.offers = [];
  life(c).transferRequest = false;
}

export function roleLabel(r: Offer['role']): string {
  return { prospect: 'Espoir', rotation: 'Joueur de rotation', starter: 'Titulaire', star: 'Leader' }[r];
}

/** Passage à la saison suivante : vieillissement, progression du monde, retraites, jeunes, promotions. */
export function startNextSeason(c: Career): void {
  const w = c.world;
  const rng = rngFor(c, 'season');
  const u = user(c);
  endLoan(c);
  applyCamp(c);
  // Fin du tournoi des nations si le joueur passe directement à la saison suivante
  for (let guard = 0; guard < 6 && comps(w).NAT && !comps(w).NAT.winner; guard++) {
    for (const f of w.fixtures) if (f.leagueId === 'NAT' && !f.played) simFixture(c, f);
    progressNational(c, 27);
    for (const f of w.fixtures) if (f.leagueId === 'NAT' && !f.played) simFixture(c, f);
    const msg = progressNational(c, 28);
    if (msg[0]) addNews(c, 'national', msg[0], 'Fin du tournoi d\u2019été.');
    if (comps(w).NAT?.winner && userTeams(c).includes(comps(w).NAT.winner!)) c.trophies.push({ season: w.season, title: comps(w).NAT.name, kind: 'team' });
  }
  clearNational(c);
  // Historique de la saison du joueur
  const st = c.seasonStats[u.id] ?? emptySeasonStat();
  const club = userClub(c);
  const line: SeasonLine = {
    season: w.season,
    clubId: club.id,
    clubName: club.name,
    league: w.leagues[club.leagueId].name,
    gp: st.gp,
    gs: st.gs,
    min: st.min,
    pts: st.pts,
    reb: st.reb,
    ast: st.ast,
    stl: st.stl,
    blk: st.blk,
    tov: st.tov,
    fgm: st.fgm,
    fga: st.fga,
    tpm: st.tpm,
    tpa: st.tpa,
    ftm: st.ftm,
    fta: st.fta,
    pf: st.pf,
  };
  u.history.push(line);
  // Classements finaux mémorisés avant les montées/descentes
  const finalRank = new Map<string, number>();
  for (const l of Object.values(w.leagues)) standings(c, l.id).forEach((r, i) => finalRank.set(r.clubId, i));
  // Promotions / relégations (classement de saison régulière)
  for (const l of Object.values(w.leagues)) {
    if (!l.relegatesTo) continue;
    const lower = w.leagues[l.relegatesTo];
    const down = standings(c, l.id).slice(-2).map((r) => r.clubId);
    const up = standings(c, lower.id).slice(0, 2).map((r) => r.clubId);
    l.teams = l.teams.filter((t) => !down.includes(t)).concat(up);
    lower.teams = lower.teams.filter((t) => !up.includes(t)).concat(down);
    for (const t of up) w.clubs[t].leagueId = l.id;
    for (const t of down) w.clubs[t].leagueId = lower.id;
    addNews(c, 'league', 'Montées et descentes', `${up.map((t) => w.clubs[t].name).join(' et ')} accèdent à ${l.name}. ${down.map((t) => w.clubs[t].name).join(' et ')} descendent en ${lower.name}.`);
  }
  // Vieillissement et évolution de tous les joueurs (hors joueur incarné, qui progresse à l'entraînement)
  const names = new NameRegistry(w.usedNames);
  const minutesOf = (id: string) => (c.seasonStats[id]?.min ?? 0) / Math.max(1, c.seasonStats[id]?.gp ?? 1);
  for (const p of Object.values(w.players)) {
    if (p.retired) continue;
    const age = ageOf(p, w.season + 1);
    if (p.isUser) {
      // Développement par l'expérience (temps de jeu, âge, marge par rapport au potentiel)
      const mins = minutesOf(p.id);
      const ovrU = playerOvr(p);
      let dev = age <= 20 ? rng.normal(1.8, 0.7) : age <= 23 ? rng.normal(1.2, 0.6) : age <= 27 ? rng.normal(0.4, 0.5) : age <= 30 ? rng.normal(-0.1, 0.4) : rng.normal(-0.9, 0.5);
      if (dev > 0) dev *= (mins > 22 ? 1.25 : mins > 12 ? 1 : mins > 4 ? 0.75 : 0.5) * (ovrU >= p.potential ? 0.15 : Math.min(1.2, (p.potential - ovrU) / 12));
      const weights = Object.entries(OVR_WEIGHTS[p.pos]) as [AttrKey, number][];
      const n = Math.round(Math.abs(dev) * 3);
      for (let i = 0; i < n; i++) {
        const k = rng.weighted(weights.map((x) => x[0]), weights.map((x) => x[1] * (dev > 0 ? Math.max(0.2, 19 - p.attrs[x[0]]) : 1)));
        p.attrs[k] = Math.max(1, Math.min(20, p.attrs[k] + Math.sign(dev)));
      }
      // Vieillissement physique du joueur incarné
      if (age >= 30) for (const k of ['speed', 'acceleration', 'vertical', 'explosiveness', 'stamina'] as AttrKey[]) p.attrs[k] = Math.max(1, p.attrs[k] - (rng.chance(0.25 * (age - 29)) ? 1 : 0));
      continue;
    }
    const ovr = playerOvr(p);
    const mins = minutesOf(p.id);
    const room = p.potential - ovr;
    let delta = age <= 21 ? rng.normal(1.6, 1.0) : age <= 24 ? rng.normal(0.9, 0.9) : age <= 28 ? rng.normal(0.3, 0.7) : age <= 31 ? rng.normal(-0.3, 0.6) : rng.normal(-1.2, 0.8);
    if (room <= 0 && delta > 0) delta *= 0.2;
    delta *= mins > 15 ? 1.15 : mins < 5 && age < 25 ? 0.6 : 1;
    // Répartition sur quelques attributs (physiques en déclin après 30 ans)
    const keys = age >= 30 ? (['speed', 'acceleration', 'vertical', 'explosiveness', 'stamina', 'agility'] as AttrKey[]) : ARCHETYPES[p.archetype].growth.concat(rng.pick(ALL_ATTRS) as AttrKey);
    const n = Math.round(Math.abs(delta) * 2);
    for (let i = 0; i < n; i++) {
      const k = rng.pick(keys);
      p.attrs[k] = Math.max(1, Math.min(20, p.attrs[k] + Math.sign(delta)));
    }
    if (age >= 30) for (const k of ['iq', 'composure'] as AttrKey[]) if (rng.chance(0.3)) p.attrs[k] = Math.min(20, p.attrs[k] + 1);
    // Retraite
    if ((age >= 34 && rng.chance((age - 33) * 0.25)) || age >= 39) {
      p.retired = true;
      if (p.clubId) w.clubs[p.clubId].roster = w.clubs[p.clubId].roster.filter((id) => id !== p.id);
      p.clubId = null;
    }
  }
  // Marché : départs de fin de contrat et universitaires vers le monde pro
  for (const p of Object.values(w.players)) {
    if (p.retired || p.isUser || !p.clubId) continue;
    const cl = w.clubs[p.clubId];
    const age = ageOf(p, w.season + 1);
    if (cl.leagueId === 'NCB' && age >= 23) {
      cl.roster = cl.roster.filter((id) => id !== p.id);
      p.clubId = null;
      continue;
    }
    if (p.contract && p.contract.until <= w.season && rng.chance(0.35)) {
      cl.roster = cl.roster.filter((id) => id !== p.id);
      p.clubId = null;
      p.contract = null;
    }
  }
  // Contrat expiré sans accord : le joueur signe là où l'on veut encore de lui (club de niveau comparable)
  if (u.contract && u.contract.until <= w.season) {
    const keep = c.offers.find((o) => o.clubId === u.clubId);
    if (keep) acceptOffer(c, keep.id);
    else {
      const best = Object.values(w.clubs)
        .filter((cl) => cl.id !== u.clubId && (cl.leagueId !== 'NCB' || ageOf(u, w.season) < 22))
        .sort((a, b) => Math.abs(teamLevel(c, a.id) - playerOvr(u) - 2) - Math.abs(teamLevel(c, b.id) - playerOvr(u) - 2))[0];
      c.offers = [{ id: `auto${w.season}`, clubId: best.id, salary: salaryFor(playerOvr(u), w.leagues[best.leagueId].level), years: 1, role: 'rotation', note: 'Seule offre restante' }];
      acceptOffer(c, c.offers[0].id);
    }
  }
  // Recrutement : chaque club complète son effectif (agents libres puis jeunes du centre de formation)
  const free = Object.values(w.players).filter((p) => !p.retired && !p.clubId && !p.isUser);
  for (const cl of Object.values(w.clubs).sort((a, b) => b.reputation - a.reputation)) {
    const league = w.leagues[cl.leagueId];
    while (cl.roster.length < 12) {
      const need = (['PG', 'SG', 'SF', 'PF', 'C'] as Position[]).sort((a, b) => cl.roster.filter((id) => w.players[id].pos === a).length - cl.roster.filter((id) => w.players[id].pos === b).length)[0];
      const lvl = teamLevel(c, cl.id);
      const cand = league.id === 'NCB' ? null : free.filter((p) => p.pos === need && Math.abs(playerOvr(p) - lvl) < 9).sort((a, b) => playerOvr(b) - playerOvr(a))[0];
      let p: PlayerData;
      if (cand && rng.chance(0.7)) {
        p = cand;
        free.splice(free.indexOf(cand), 1);
      } else {
        const ageNew = league.id === 'NCB' ? 18 : rng.int(17, 19);
        p = generatePlayer(rng, names, { pos: need, age: ageNew, level: league.strength - 2.4 + cl.youth / 10 + rng.normal(0, 0.8), nation: rng.pick(LEAGUE_NATIONS[league.id] ?? ['FRA']), season: w.season + 1, potentialBonus: cl.youth / 4 });
        w.players[p.id] = p;
      }
      p.clubId = cl.id;
      p.contract = { clubId: cl.id, salary: salaryFor(playerOvr(p), league.level), until: w.season + 1 + rng.int(1, 3), role: 'rotation' };
      cl.roster.push(p.id);
    }
    ensureNumbers(w, cl);
    // Cycles des clubs : budget/réputation suivent les résultats, changement d'entraîneur possible
    const rk = finalRank.get(cl.id) ?? 6;
    cl.reputation = Math.max(10, Math.min(95, cl.reputation + (rk < 3 ? 2 : rk > 8 ? -2 : 0)));
    if (rk > 8 && rng.chance(0.35)) {
      const old = cl.coach.name;
      cl.coach = { ...cl.coach, name: `${rng.pick(['Thierry', 'Paolo', 'Vasilis', 'Jérôme', 'Aleksandar', 'Kevin'])} ${rng.pick(['Garnier', 'Ricci', 'Papadakis', 'Leclerc', 'Marković', 'Holt'])}`, youthTrust: rng.range(0.15, 0.85), development: rng.int(7, 18) };
      if (cl.id === u.clubId) {
        c.trust = 45;
        addNews(c, 'coach', `${cl.name} change d’entraîneur`, `${old} est remplacé par ${cl.coach.name}. Tout le monde repart de zéro.`);
      }
    }
  }
  // Nettoyage des retraités anciens pour garder des sauvegardes compactes
  for (const [id, p] of Object.entries(w.players)) if (p.retired && !p.isUser && ageOf(p, w.season) > 42) delete w.players[id];
  w.usedNames = [...names.used];
  w.season += 1;
  c.seasonStats = {};
  c.compStats = {};
  c.week = 1;
  c.phase = 'regular';
  c.offers = [];
  u.fatigue = 0;
  generateSchedule(c);
  ensureYouthFixture(c, userRole(c).rank);
  setObjectives(c);
  extra(c).attrSnap = { season: w.season, attrs: { ...u.attrs } };
  const age = ageOf(u, w.season);
  addNews(c, 'league', `Saison ${w.season}-${w.season + 1} : c’est parti`, `${fullName(u)} (${age} ans, ${playerOvr(u)} de note globale) aborde une nouvelle saison avec ${userClub(c).name}.`);
  if (age >= 41) c.retired = true;
  c.updatedAt = Date.now();
}

const LEAGUE_NATIONS: Record<string, string[]> = { FRA1: ['FRA', 'FRA', 'FRA', 'SEN', 'BEL'], FRA2: ['FRA', 'FRA', 'FRA', 'BEL'], ESP1: ['ESP', 'ESP', 'SRB', 'LTU', 'ITA', 'GRE', 'TUR'], NCB: ['USA', 'USA', 'CAN', 'FRA'] };

export function retirePlayer(c: Career): void {
  c.retired = true;
  addNews(c, 'league', `${fullName(user(c))} annonce sa retraite`, `Fin d’une carrière de ${user(c).history.length} saison(s).`);
}

/** Moyennes de la saison en cours pour le joueur. */
export function perGame(s: SeasonStat | undefined): { gp: number; mpg: number; ppg: number; rpg: number; apg: number; fg: number; tp: number; ft: number } {
  if (!s || s.gp === 0) return { gp: 0, mpg: 0, ppg: 0, rpg: 0, apg: 0, fg: 0, tp: 0, ft: 0 };
  return {
    gp: s.gp,
    mpg: s.min / s.gp,
    ppg: s.pts / s.gp,
    rpg: s.reb / s.gp,
    apg: s.ast / s.gp,
    fg: s.fga ? (s.fgm / s.fga) * 100 : 0,
    tp: s.tpa ? (s.tpm / s.tpa) * 100 : 0,
    ft: s.fta ? (s.ftm / s.fta) * 100 : 0,
  };
}

export { POSITION_BASE };
