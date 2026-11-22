// État de carrière et règles de gestion (aucune dépendance au rendu).
import { hashSeed, Rng } from '../engine/rng';
import { getTrack } from '../engine/tracks';
import { TRACK_DEFS } from '../engine/tracks';
import { optimalSetup, setupFeedback, timedLap, type SetupFeedback } from '../engine/quali';
import { COMPOUNDS, tyreWearRate } from '../engine/physics';
import type {
  CarEntry, CarSetup, CarStats, ClassifiedResult, Compound, DriverStats, PitPlan, RaceCommand, RaceConfig, Weather,
} from '../engine/types';
import {
  buildWorld, carRating, driverRating, SPONSOR_SEEDS, type Driver, type Emblem, type SponsorOffer, type Team,
} from './data';

export const POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
export const RACE_LAPS = { courte: 6, standard: 12, longue: 20 } as const;
export type RaceLength = keyof typeof RACE_LAPS;
export type Difficulty = 'facile' | 'normale' | 'difficile';
export type BudgetProfile = 'serre' | 'equilibre' | 'investisseur';

export const DIFFICULTY_INFO: Record<Difficulty, { label: string; carLevel: number; budget: number; reputation: number; text: string }> = {
  facile: { label: 'Facile', carLevel: 13.5, budget: 1.3, reputation: 35, text: 'Voiture de milieu de grille, budget confortable.' },
  normale: { label: 'Normale', carLevel: 11.5, budget: 1, reputation: 22, text: 'Voiture de fond de peloton, tout reste à construire.' },
  difficile: { label: 'Difficile', carLevel: 9.5, budget: 0.75, reputation: 12, text: 'Petite structure, voiture lente, chaque euro compte.' },
};

export const BUDGET_INFO: Record<BudgetProfile, { label: string; amount: number; text: string }> = {
  serre: { label: 'Garage indépendant', amount: 20, text: 'Peu de moyens mais une équipe soudée (+2 mécaniciens).' },
  equilibre: { label: 'Projet équilibré', amount: 30, text: 'Un budget raisonnable pour démarrer.' },
  investisseur: { label: 'Investisseur ambitieux', amount: 42, text: 'Beaucoup d’argent, mais une équipe technique encore rodée (-1 aux stands).' },
};

export interface TeamIdentity {
  name: string;
  short: string;
  color: string;
  color2: string;
  emblem: Emblem;
  base: string;
  principal: string;
}

export interface CareerOptions extends TeamIdentity {
  difficulty: Difficulty;
  budgetProfile: BudgetProfile;
  raceLength: RaceLength;
  seed?: number;
}

export interface SignedSponsor extends SponsorOffer {
  slot: 'principal' | 'secondaire';
}

export interface RoundEntry {
  driverId: string;
  teamId: string;
  position: number;
  grid: number;
  points: number;
  status: 'arrivé' | 'abandon';
  gap: string;
  bestLap: number;
  stops: number;
}

export interface RoundResult {
  round: number;
  trackId: string;
  weather: Weather;
  entries: RoundEntry[];
  fastest: { driverId: string; time: number } | null;
  earnings: { label: string; amount: number }[];
}

export interface PracticeRun {
  setup: CarSetup;
  best: number;
  laps: number[];
  feedback: SetupFeedback[];
}

export interface QualiEntry {
  driverId: string;
  time: number;
  laps: number[];
  mistake: boolean;
}

export interface Strategy {
  start: Compound;
  plan: PitPlan[];
}

export type WeekendPhase = 'essais' | 'qualifs' | 'strategie' | 'course' | 'resultats';

export interface Weekend {
  round: number;
  trackId: string;
  weather: Weather;
  phase: WeekendPhase;
  setups: Record<string, CarSetup>;
  practice: Record<string, { runs: PracticeRun[]; knowledge: number }>;
  quali: QualiEntry[] | null;
  strategy: Record<string, Strategy>;
  race: { seed: number; commands: RaceCommand[]; tick: number } | null;
  result: RoundResult | null;
}

export interface LedgerLine {
  season: number;
  round: number;
  label: string;
  amount: number;
}

export interface Career {
  id: string;
  createdAt: string;
  seed: number;
  season: number;
  difficulty: Difficulty;
  budgetProfile: BudgetProfile;
  raceLength: RaceLength;
  playerTeamId: string;
  teams: Team[];
  drivers: Driver[];
  sponsorOffers: SponsorOffer[];
  sponsors: SignedSponsor[];
  calendar: { round: number; trackId: string }[];
  round: number; // index du prochain Grand Prix (0..calendar.length)
  results: RoundResult[];
  budget: number; // M€
  ledger: LedgerLine[];
  weekend: Weekend | null;
  news: { season: number; round: number; text: string }[];
  history: { season: number; driverChampion: string; teamChampion: string; playerTeamPos: number; objective?: number }[];
  /** Objectif fixé par les actionnaires : position au championnat constructeurs. */
  objective: { season: number; target: number };
}

export const PRACTICE_RUNS = 4;
export const MAX_SPONSORS = 2;

function round1(v: number): number {
  return Math.round(v * 100) / 100;
}

export function createCareer(o: CareerOptions): Career {
  const seed = o.seed ?? (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
  const { teams, drivers } = buildWorld(seed);
  const rng = new Rng(hashSeed(seed, 'joueur'));
  const diff = DIFFICULTY_INFO[o.difficulty];
  const lvl = diff.carLevel;
  const st = (b: number) => Math.max(1, Math.min(20, Math.round(b + rng.normal(0, 0.6))));
  const player: Team = {
    id: 'team-joueur',
    name: o.name.trim() || 'Mon Écurie',
    short: (o.short.trim() || o.name.slice(0, 3)).toUpperCase().slice(0, 3),
    color: o.color, color2: o.color2, emblem: o.emblem, base: o.base.trim() || 'Atelier sans nom', principal: o.principal.trim() || 'Directeur',
    car: { moteur: st(lvl), aero: st(lvl), chassis: st(lvl), fiabilite: st(lvl + 0.5) },
    pitCrew: Math.round(lvl + (o.budgetProfile === 'serre' ? 2 : o.budgetProfile === 'investisseur' ? -1 : 0)),
    reputation: diff.reputation,
    isPlayer: true,
  };
  teams.push(player);
  const sponsorOffers: SponsorOffer[] = SPONSOR_SEEDS.map((s, i) => ({ ...s, id: 'spn-' + i }));
  const c: Career = {
    id: 'car-' + seed.toString(36),
    createdAt: new Date().toISOString(),
    seed,
    season: 1,
    difficulty: o.difficulty,
    budgetProfile: o.budgetProfile,
    raceLength: o.raceLength,
    playerTeamId: player.id,
    teams,
    drivers,
    sponsorOffers,
    sponsors: [],
    calendar: seasonCalendar(),
    round: 0,
    results: [],
    budget: round1(BUDGET_INFO[o.budgetProfile].amount * diff.budget),
    ledger: [],
    weekend: null,
    news: [],
    history: [],
    objective: { season: 1, target: 10 },
  };
  c.objective = { season: 1, target: computeObjective(c) };
  addLedger(c, 'Budget initial', c.budget, true);
  addNews(c, `${player.name} rejoint le championnat ! Objectif : recruter deux pilotes avant le premier Grand Prix.`);
  addNews(c, `Les actionnaires visent la ${c.objective.target}ᵉ place au championnat constructeurs.`);
  return c;
}

function addLedger(c: Career, label: string, amount: number, silent = false): void {
  if (!silent) c.budget = round1(c.budget + amount);
  c.ledger.push({ season: c.season, round: c.round, label, amount: round1(amount) });
  if (c.ledger.length > 200) c.ledger.splice(0, c.ledger.length - 200);
}

function addNews(c: Career, text: string): void {
  c.news.unshift({ season: c.season, round: c.round, text });
  if (c.news.length > 40) c.news.length = 40;
}

/** Ordre du calendrier (les circuits sont définis dans engine/tracks). */
export const CALENDAR_ORDER = ['port-azur', 'lac-argent', 'valbrune', 'montclair', 'kharam'];

export function seasonCalendar(): { round: number; trackId: string }[] {
  const ids = CALENDAR_ORDER.filter((id) => TRACK_DEFS.some((t) => t.id === id));
  return ids.map((trackId, round) => ({ round, trackId }));
}

/** Objectif réaliste : rang de la voiture parmi les 10, ajusté selon la difficulté. */
export function computeObjective(c: Pick<Career, 'teams' | 'playerTeamId' | 'difficulty'>): number {
  const ranked = [...c.teams].sort((a, b) => carRating(b.car) - carRating(a.car));
  const rank = ranked.findIndex((t) => t.id === c.playerTeamId) + 1;
  const bonus = c.difficulty === 'facile' ? 2 : c.difficulty === 'normale' ? 1 : 0;
  return Math.max(1, Math.min(10, rank - bonus));
}

export function playerTeam(c: Career): Team {
  return c.teams.find((t) => t.id === c.playerTeamId)!;
}

export function teamById(c: Career, id: string): Team {
  return c.teams.find((t) => t.id === id)!;
}

export function driverById(c: Career, id: string): Driver {
  return c.drivers.find((d) => d.id === id)!;
}

export function teamDrivers(c: Career, teamId: string): Driver[] {
  return c.drivers.filter((d) => d.teamId === teamId).sort((a, b) => a.number - b.number);
}

export function freeAgents(c: Career): Driver[] {
  return c.drivers.filter((d) => !d.teamId).sort((a, b) => driverRating(b.stats) - driverRating(a.stats));
}

export function signingFee(salary: number): number {
  return round1(salary * 0.2);
}

export function canRace(c: Career): string | null {
  if (teamDrivers(c, c.playerTeamId).length < 2) return 'Recrutez deux pilotes pour pouvoir disputer un Grand Prix.';
  if (c.round >= c.calendar.length) return 'La saison est terminée.';
  return null;
}

/** Proposition de contrat : renvoie un message d'erreur ou null si signé. */
export function hireDriver(c: Career, driverId: string, salary: number, years: number): string | null {
  const d = driverById(c, driverId);
  if (!d || d.teamId) return 'Ce pilote n’est pas libre.';
  if (c.weekend) return 'Le marché des pilotes est fermé pendant un week-end de course.';
  if (teamDrivers(c, c.playerTeamId).length >= 2) return 'Votre écurie compte déjà deux pilotes titulaires.';
  const minAccept = d.askSalary * (years >= 3 ? 1.1 : years === 2 ? 1 : 0.95);
  if (salary < minAccept - 1e-9) return `${d.first} ${d.last} refuse : il demande au moins ${minAccept.toFixed(1)} M€ par saison pour ${years} saison(s).`;
  const team = playerTeam(c);
  if (team.reputation + 40 < driverRating(d.stats) * 4) return `${d.first} ${d.last} ne croit pas encore au projet (réputation insuffisante).`;
  const fee = signingFee(salary);
  if (c.budget < fee) return 'Budget insuffisant pour la prime de signature.';
  d.teamId = c.playerTeamId;
  d.contract = { salary: round1(salary), years };
  const used = new Set(c.drivers.filter((x) => x.teamId && x !== d).map((x) => x.number));
  while (used.has(d.number)) d.number++;
  addLedger(c, `Prime de signature — ${d.first} ${d.last}`, -fee);
  addNews(c, `${d.first} ${d.last} signe chez ${team.name} pour ${years} saison(s).`);
  return null;
}

export function releaseCost(c: Career, driverId: string): number {
  const d = driverById(c, driverId);
  if (!d.contract) return 0;
  return round1(d.contract.salary * 0.5 * d.contract.years);
}

export function releaseDriver(c: Career, driverId: string): string | null {
  const d = driverById(c, driverId);
  if (d.teamId !== c.playerTeamId) return 'Ce pilote ne fait pas partie de votre écurie.';
  if (c.weekend) return 'Impossible de libérer un pilote pendant un week-end de course.';
  const cost = releaseCost(c, driverId);
  if (c.budget < cost) return 'Budget insuffisant pour payer l’indemnité de départ.';
  addLedger(c, `Indemnité de départ — ${d.first} ${d.last}`, -cost);
  d.teamId = null;
  d.contract = null;
  addNews(c, `${d.first} ${d.last} quitte ${playerTeam(c).name}.`);
  return null;
}

export function availableSponsors(c: Career): SponsorOffer[] {
  return c.sponsorOffers.filter((s) => !c.sponsors.some((x) => x.id === s.id));
}

export function signSponsor(c: Career, offerId: string): string | null {
  const s = c.sponsorOffers.find((x) => x.id === offerId);
  if (!s) return 'Offre introuvable.';
  if (c.sponsors.length >= MAX_SPONSORS) return 'Vos deux emplacements de sponsors sont occupés.';
  if (playerTeam(c).reputation < s.minReputation) return `${s.name} exige une réputation de ${s.minReputation}.`;
  c.sponsors.push({ ...s, slot: c.sponsors.some((x) => x.slot === 'principal') ? 'secondaire' : 'principal' });
  addLedger(c, `Prime de signature — ${s.name}`, s.signing);
  addNews(c, `${s.name} devient partenaire de ${playerTeam(c).name}.`);
  return null;
}

export const UPGRADE_LABEL: Record<keyof CarStats, string> = {
  moteur: 'Moteur', aero: 'Aérodynamique', chassis: 'Châssis', fiabilite: 'Fiabilité',
};

export function upgradeCost(level: number): number {
  return round1(1.2 + Math.max(0, level - 8) * 0.55);
}

export function buyUpgrade(c: Career, key: keyof CarStats): string | null {
  const t = playerTeam(c);
  if (c.weekend) return 'Les évolutions s’installent entre deux Grands Prix.';
  if (t.car[key] >= 20) return 'Niveau maximal atteint.';
  const cost = upgradeCost(t.car[key]);
  if (c.budget < cost) return 'Budget insuffisant.';
  t.car[key]++;
  addLedger(c, `Évolution ${UPGRADE_LABEL[key].toLowerCase()} (niveau ${t.car[key]})`, -cost);
  return null;
}

export function raceLaps(c: Career): number {
  return RACE_LAPS[c.raceLength];
}

// ---------------------------------------------------------------- Week-end

const optCache = new Map<string, CarSetup>();
function trackOptimum(trackId: string, weather: Weather): CarSetup {
  const k = trackId + weather;
  let o = optCache.get(k);
  if (!o) {
    const avg: DriverStats = { vitesse: 12, regularite: 12, depassement: 12, defense: 12, pneus: 12, pluie: 12, mental: 12 };
    o = optimalSetup(getTrack(trackId), { driver: avg, car: { moteur: 12, aero: 12, chassis: 12, fiabilite: 12 } }, weather);
    optCache.set(k, o);
  }
  return o;
}

export function forecastFor(c: Career, round: number): { weather: Weather; rainProb: number } {
  const tr = getTrack(c.calendar[round].trackId).def;
  const rng = new Rng(hashSeed(c.seed, c.season, round, 'meteo'));
  const rainProb = Math.min(0.9, Math.max(0.02, tr.rainChance + rng.range(-0.1, 0.15)));
  const weather: Weather = rng.next() < rainProb ? 'pluie' : 'sec';
  return { weather, rainProb };
}

export function startWeekend(c: Career): string | null {
  const err = canRace(c);
  if (err) return err;
  if (c.weekend) return null;
  const { trackId } = c.calendar[c.round];
  const { weather } = forecastFor(c, c.round);
  const opt = trackOptimum(trackId, weather);
  const rng = new Rng(hashSeed(c.seed, c.season, c.round, 'reglages'));
  const setups: Record<string, CarSetup> = {};
  const practice: Weekend['practice'] = {};
  for (const d of c.drivers) {
    if (!d.teamId) continue;
    const team = teamById(c, d.teamId);
    if (team.isPlayer) {
      setups[d.id] = { aileron: 50, suspension: 50, boite: 50 };
      practice[d.id] = { runs: [], knowledge: 0 };
    } else {
      // Les écuries IA approchent l'optimum selon leur niveau technique.
      const err = (21 - (team.car.chassis + team.pitCrew) / 2) * 1.4;
      const cl = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
      setups[d.id] = {
        aileron: cl(opt.aileron + rng.normal(0, err)),
        suspension: cl(opt.suspension + rng.normal(0, err)),
        boite: cl(opt.boite + rng.normal(0, err)),
      };
    }
  }
  c.weekend = { round: c.round, trackId, weather, phase: 'essais', setups, practice, quali: null, strategy: {}, race: null, result: null };
  return null;
}

function entryFor(c: Career, d: Driver, w: Weekend): Pick<CarEntry, 'driver' | 'car' | 'setup'> {
  const team = teamById(c, d.teamId!);
  return { driver: d.stats, car: team.car, setup: w.setups[d.id] };
}

export function setSetup(c: Career, driverId: string, setup: CarSetup): void {
  if (!c.weekend || c.weekend.phase !== 'essais') return;
  c.weekend.setups[driverId] = { ...setup };
}

/** Relais d'essais libres (5 tours) : chronos + retour du pilote. */
export function practiceRun(c: Career, driverId: string): PracticeRun | string {
  const w = c.weekend;
  if (!w || w.phase !== 'essais') return 'Les essais libres sont terminés.';
  const p = w.practice[driverId];
  if (!p) return 'Pilote inconnu.';
  if (p.runs.length >= PRACTICE_RUNS) return 'Plus de pneus disponibles pour ce pilote.';
  const d = driverById(c, driverId);
  const track = getTrack(w.trackId);
  const rng = new Rng(hashSeed(c.seed, c.season, w.round, driverId, p.runs.length, JSON.stringify(w.setups[driverId])));
  const e = entryFor(c, d, w);
  const compound: Compound = w.weather === 'pluie' ? 'P' : 'M';
  const laps: number[] = [];
  for (let i = 0; i < 5; i++) laps.push(timedLap(track, e, w.weather, compound, false, rng).time);
  const fb = setupFeedback(track, e, w.weather, p.knowledge, rng);
  const run: PracticeRun = { setup: { ...w.setups[driverId] }, best: Math.min(...laps), laps, feedback: fb };
  p.runs.push(run);
  p.knowledge = Math.min(1, p.knowledge + 0.25 + d.stats.regularite / 100);
  return run;
}

export function runQualifying(c: Career): QualiEntry[] | string {
  const w = c.weekend;
  if (!w) return 'Aucun week-end en cours.';
  if (w.quali) return w.quali;
  const track = getTrack(w.trackId);
  const rng = new Rng(hashSeed(c.seed, c.season, w.round, 'qualifs'));
  const list: QualiEntry[] = [];
  const racers = c.drivers.filter((d) => d.teamId).sort((a, b) => a.id.localeCompare(b.id));
  for (const d of racers) {
    const e = entryFor(c, d, w);
    const laps: number[] = [];
    let mistake = false;
    for (let k = 0; k < 3; k++) {
      const l = timedLap(track, e, w.weather, w.weather === 'pluie' ? 'P' : 'T', true, rng);
      laps.push(l.time);
      if (l.mistake) mistake = true;
    }
    list.push({ driverId: d.id, time: Math.min(...laps), laps, mistake });
  }
  list.sort((a, b) => a.time - b.time);
  w.quali = list;
  w.phase = 'strategie';
  // Stratégies par défaut (IA et suggestion joueur).
  for (const q of list) {
    const d = driverById(c, q.driverId);
    const team = teamById(c, d.teamId!);
    w.strategy[d.id] = team.isPlayer ? suggestStrategy(c, d.id, w.weather === 'pluie' ? 'P' : 'M') : aiStrategy(c, d.id, rng);
  }
  return list;
}

export function expectedWearPerLap(c: Career, driverId: string, compound: Compound): number {
  const w = c.weekend!;
  const tr = getTrack(w.trackId).def;
  const d = driverById(c, driverId);
  const laps = raceLaps(c);
  return (110 / laps) * (tr.wear / 3.6) * tyreWearRate(compound, w.weather) * (1.15 - (d.stats.pneus / 20) * 0.3);
}

export function suggestStrategy(c: Career, driverId: string, start: Compound, stintWear = 72): Strategy {
  const w = c.weekend!;
  const laps = raceLaps(c);
  if (w.weather === 'pluie') return { start: 'P', plan: planStops(c, driverId, 'P', laps, stintWear) };
  return { start, plan: planStops(c, driverId, start, laps, stintWear) };
}

function planStops(c: Career, driverId: string, start: Compound, laps: number, stintWear: number): PitPlan[] {
  const plan: PitPlan[] = [];
  let lap = 0;
  let comp = start;
  for (let guard = 0; guard < 4; guard++) {
    const wpl = expectedWearPerLap(c, driverId, comp);
    const remaining = laps - lap;
    if (wpl * remaining <= 90) break;
    const stint = Math.max(1, Math.floor(stintWear / wpl));
    lap += stint;
    if (lap >= laps) break;
    const rem = laps - lap;
    const options: Compound[] = c.weekend!.weather === 'pluie' ? ['P'] : ['T', 'M', 'D'];
    comp = options.find((o) => expectedWearPerLap(c, driverId, o) * rem <= 85) ?? options[options.length - 1];
    plan.push({ lap, compound: comp });
  }
  return plan;
}

function aiStrategy(c: Career, driverId: string, rng: Rng): Strategy {
  if (c.weekend!.weather === 'pluie') return suggestStrategy(c, driverId, 'P');
  const r = rng.next();
  const start: Compound = r < 0.3 ? 'T' : r < 0.8 ? 'M' : 'D';
  return suggestStrategy(c, driverId, start, rng.range(64, 80));
}

export function setStrategy(c: Career, driverId: string, s: Strategy): void {
  const w = c.weekend;
  if (!w || w.phase !== 'strategie') return;
  const laps = raceLaps(c);
  const plan = s.plan
    .filter((p) => p.lap >= 1 && p.lap < laps)
    .sort((a, b) => a.lap - b.lap)
    .filter((p, i, arr) => i === 0 || arr[i - 1].lap !== p.lap);
  w.strategy[driverId] = { start: s.start, plan };
}

export function startRace(c: Career): RaceConfig | string {
  const w = c.weekend;
  if (!w || !w.quali) return 'Les qualifications n’ont pas eu lieu.';
  if (!w.race) {
    w.race = { seed: hashSeed(c.seed, c.season, w.round, 'course'), commands: [], tick: 0 };
  }
  w.phase = 'course';
  return raceConfig(c);
}

export function raceConfig(c: Career): RaceConfig {
  const w = c.weekend!;
  const entries: CarEntry[] = w.quali!.map((q) => {
    const d = driverById(c, q.driverId);
    const team = teamById(c, d.teamId!);
    const st = w.strategy[d.id];
    return {
      id: d.id, name: `${d.first} ${d.last}`, short: d.short, number: d.number,
      teamId: team.id, teamName: team.name, color: team.color, color2: team.color2,
      driver: d.stats, car: team.car, setup: w.setups[d.id], pitCrew: team.pitCrew,
      startCompound: st.start, pitPlan: st.plan, isPlayer: team.isPlayer,
    };
  });
  return { trackId: w.trackId, laps: raceLaps(c), weather: w.weather, seed: w.race!.seed, entries };
}

/** Enregistre la progression de la course en cours (consignes + pas atteint) pour pouvoir la reprendre. */
export function recordRaceProgress(c: Career, commands: RaceCommand[], tick: number): void {
  if (c.weekend?.race) {
    c.weekend.race.commands = commands.map((x) => ({ ...x }));
    c.weekend.race.tick = tick;
  }
}

/** Applique le résultat d'une course : points, finances, réputation, actualités. */
export function finishRace(c: Career, results: ClassifiedResult[], fastest: { carId: string; time: number } | null): RoundResult {
  const w = c.weekend!;
  if (w.result) return w.result;
  const entries: RoundEntry[] = results.map((r) => {
    const d = driverById(c, r.carId);
    return {
      driverId: r.carId, teamId: d.teamId!, position: r.position, grid: r.gridPosition,
      points: r.status === 'arrivé' && r.position <= 10 ? POINTS[r.position - 1] : 0,
      status: r.status, gap: r.gap, bestLap: r.bestLap, stops: r.stops,
    };
  });
  const earnings: { label: string; amount: number }[] = [];
  const mine = entries.filter((e) => e.teamId === c.playerTeamId);
  const pts = mine.reduce((a, e) => a + e.points, 0);
  earnings.push({ label: 'Prime de participation', amount: 0.5 });
  if (pts) earnings.push({ label: `Prix au championnat (${pts} pts)`, amount: round1(pts * 0.12) });
  for (const s of c.sponsors) {
    earnings.push({ label: `${s.name} — versement`, amount: s.perRace });
    const ok =
      s.objective === 'arrivee' ? mine.every((e) => e.status === 'arrivé') :
      s.objective === 'points' ? mine.some((e) => e.points > 0) :
      s.objective === 'top5' ? mine.some((e) => e.status === 'arrivé' && e.position <= 5) :
      mine.some((e) => e.status === 'arrivé' && e.position <= 3);
    if (ok) earnings.push({ label: `${s.name} — bonus objectif`, amount: s.bonus });
  }
  const salaries = teamDrivers(c, c.playerTeamId).reduce((a, d) => a + (d.contract?.salary ?? 0), 0) / c.calendar.length;
  earnings.push({ label: 'Salaires des pilotes', amount: -round1(salaries) });
  earnings.push({ label: 'Logistique et personnel', amount: -1.4 });
  for (const e of earnings) addLedger(c, `${getTrack(w.trackId).def.gp} — ${e.label}`, e.amount);

  // Réputation : résultat comparé au niveau attendu.
  const team = playerTeam(c);
  const best = Math.min(...mine.map((e) => (e.status === 'arrivé' ? e.position : 21)));
  team.reputation = Math.max(1, Math.min(100, team.reputation + (best <= 3 ? 6 : best <= 10 ? 3 : best <= 15 ? 1 : -1)));

  const res: RoundResult = {
    round: w.round, trackId: w.trackId, weather: w.weather, entries,
    fastest: fastest ? { driverId: fastest.carId, time: fastest.time } : null, earnings,
  };
  w.result = res;
  w.phase = 'resultats';
  c.results.push(res);
  const win = driverById(c, entries[0].driverId);
  addNews(c, `${getTrack(w.trackId).def.gp} : victoire de ${win.first} ${win.last} (${teamById(c, win.teamId!).name}).`);
  return res;
}

/** Clôt le week-end et passe au Grand Prix suivant (ou à la fin de saison). */
export function closeWeekend(c: Career): void {
  if (!c.weekend?.result) return;
  c.weekend = null;
  aiDevelopment(c);
  c.round++;
  if (c.round >= c.calendar.length) {
    const ds = driverStandings(c);
    const ts = teamStandings(c);
    const champ = driverById(c, ds[0].driverId);
    const pos = ts.findIndex((t) => t.teamId === c.playerTeamId) + 1;
    c.history.push({
      season: c.season,
      driverChampion: `${champ.first} ${champ.last}`,
      teamChampion: teamById(c, ts[0].teamId).name,
      playerTeamPos: pos,
      objective: c.objective.target,
    });
    addNews(c, `${champ.first} ${champ.last} est sacré champion ! ${teamById(c, ts[0].teamId).name} remporte le titre constructeurs.`);
    const team = playerTeam(c);
    if (pos <= c.objective.target) {
      const bonus = 3 + (c.objective.target - pos) * 0.8;
      addLedger(c, `Prime des actionnaires (objectif ${c.objective.target}ᵉ atteint : ${pos}ᵉ)`, bonus);
      team.reputation = Math.min(100, team.reputation + 6);
      addNews(c, `Objectif atteint ! Les actionnaires versent une prime de ${bonus.toFixed(1)} M€.`);
    } else {
      team.reputation = Math.max(1, team.reputation - 4);
      addNews(c, `Objectif manqué (${pos}ᵉ au lieu de ${c.objective.target}ᵉ) : les actionnaires sont déçus.`);
    }
  }
}

/** Entre deux Grands Prix, les écuries IA apportent des évolutions selon leurs moyens. */
function aiDevelopment(c: Career): void {
  const rng = new Rng(hashSeed(c.seed, c.season, c.round, 'evolutions'));
  const keys: (keyof CarStats)[] = ['moteur', 'aero', 'chassis', 'fiabilite'];
  for (const t of c.teams) {
    if (t.isPlayer) continue;
    if (!rng.chance(0.18 + t.reputation / 260)) continue;
    const k = rng.pick(keys);
    if (t.car[k] >= 20) continue;
    t.car[k]++;
    if (rng.chance(0.5)) addNews(c, `${t.name} apporte une évolution ${UPGRADE_LABEL[k].toLowerCase()} (niveau ${t.car[k]}).`);
  }
}

export function seasonOver(c: Career): boolean {
  return c.round >= c.calendar.length && !c.weekend;
}

/** Nouvelle saison : contrats décomptés, pilotes vieillissent, classements remis à zéro. */
export function startNextSeason(c: Career): void {
  if (!seasonOver(c)) return;
  const rng = new Rng(hashSeed(c.seed, c.season, 'intersaison'));
  for (const d of c.drivers) {
    d.age++;
    const growth = d.age < 25 ? 0.6 : d.age > 32 ? -0.5 : 0;
    for (const k of Object.keys(d.stats) as (keyof DriverStats)[]) {
      if (rng.chance(0.35)) d.stats[k] = Math.max(1, Math.min(20, d.stats[k] + Math.round(growth + rng.normal(0, 0.6))));
    }
    if (d.contract) {
      d.contract.years--;
      if (d.contract.years <= 0) {
        const team = d.teamId ? teamById(c, d.teamId) : null;
        if (team && !team.isPlayer) d.contract.years = 1 + rng.int(0, 2); // l'IA prolonge
        else {
          if (team) addNews(c, `Fin de contrat : ${d.first} ${d.last} quitte ${team.name}.`);
          d.teamId = null;
          d.contract = null;
        }
      }
    }
  }
  c.season++;
  c.round = 0;
  c.results = [];
  c.sponsors = [];
  c.calendar = seasonCalendar();
  c.objective = { season: c.season, target: computeObjective(c) };
  addNews(c, `Les actionnaires visent la ${c.objective.target}ᵉ place cette saison.`);
  addNews(c, `Saison ${c.season} : les contrats de sponsoring sont à renégocier.`);
}

// ---------------------------------------------------------------- Classements

export interface DriverStanding {
  driverId: string;
  teamId: string;
  points: number;
  wins: number;
  podiums: number;
  best: number;
  results: (RoundEntry | null)[];
}

export function driverStandings(c: Career): DriverStanding[] {
  const map = new Map<string, DriverStanding>();
  for (const d of c.drivers) {
    if (!d.teamId && !c.results.some((r) => r.entries.some((e) => e.driverId === d.id))) continue;
    map.set(d.id, { driverId: d.id, teamId: d.teamId ?? '', points: 0, wins: 0, podiums: 0, best: 99, results: [] });
  }
  c.results.forEach((r, ri) => {
    for (const e of r.entries) {
      const s = map.get(e.driverId)!;
      s.teamId = e.teamId;
      s.points += e.points;
      if (e.status === 'arrivé') {
        if (e.position === 1) s.wins++;
        if (e.position <= 3) s.podiums++;
        s.best = Math.min(s.best, e.position);
      }
      s.results[ri] = e;
    }
  });
  return [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums || a.best - b.best || a.driverId.localeCompare(b.driverId));
}

export interface TeamStanding {
  teamId: string;
  points: number;
  wins: number;
  best: number;
}

export function teamStandings(c: Career): TeamStanding[] {
  const map = new Map<string, TeamStanding>(c.teams.map((t) => [t.id, { teamId: t.id, points: 0, wins: 0, best: 99 }]));
  for (const r of c.results) {
    for (const e of r.entries) {
      const s = map.get(e.teamId);
      if (!s) continue;
      s.points += e.points;
      if (e.status === 'arrivé') {
        if (e.position === 1) s.wins++;
        s.best = Math.min(s.best, e.position);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best || a.teamId.localeCompare(b.teamId));
}

export function compoundName(c: Compound): string {
  return COMPOUNDS[c].name;
}
