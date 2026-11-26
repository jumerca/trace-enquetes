// Moteur temporel et orchestration de la simulation. Un pas = 10 minutes de jeu.
// Toute la logique est indépendante du rendu : les affaires évoluent même hors écran.
import { Rng } from '../core/rng';
import { calendar, eraOf, MIN_D, MIN_H } from './calendar';
import { districtActivity, generateCity } from './city';
import { buildSagaCase, sagaDue } from './cases/saga';
import { templates } from './cases/templates';
import { makeBudget, evaluateFundRequest, remaining, totalEnvelope, totalSpent, spend } from './finance';
import { ACTIONS, authGranted, completeAction, finishLab, investigatorsThink, pname, updateStage } from './investigation';
import { charges, noCrimeWeight, suspicionRanking } from './knowledge';
import { caseLog, notify } from './log';
import { makeMagistrate, processRequests, processTrials, transmit } from './justice';
import { capacities, initialStation } from './station';
import { ensureNetwork, networkNewYear, networkNote, networkTick, payDotations } from './network';
import { actionBonus, initialTechs, techBonus, techNewYear, wearFactor } from './tech';
import { applyGrade, careerNewYear, commanderAge, gradeFor, level } from './career';
import { ageOf, capacity, condition, fullName, gainXp, gradeIndex, gradesFor, isOnDuty, load, makeCandidate, makeStaff, refreshCandidates, salary, tickStaff } from './staff';
import { PROOF } from './cases/builder';
import { eventActive, incidentFactor, mediaTick, receptionTick, rollEvents, staffDeparture, updateWeather } from './world';
import { randomAppearance } from './names';
import { axisSpawnFactor, axisWorkFactor, ensureSummit, summitMonthly, summitNote } from './summit';
import { ensurePartners, partnerBoost, partnerLabBoost, partnersDaily } from './partners';
import type { Case, CaseType, CitySize, Commander, GameState, Role, Staff, Unit, Vehicle } from './types';

export const SAVE_VERSION = 3;
export const STEP = 10;

export interface NewGameOptions {
  seed?: number;
  startYear: number;
  size: CitySize;
  cityName?: string;
  commander: Omit<Commander, 'grade' | 'appearance' | 'reputation'> & { appearance?: Commander['appearance'] };
  scenario?: 'saint-clair' | 'libre';
  assist?: GameState['settings']['assist'];
  minute?: number; // reprise en cours de carrière (mutation)
}

export function newGame(o: NewGameOptions): GameState {
  const seed = o.seed ?? Math.floor(Math.random() * 1e9);
  const rng = new Rng(seed);
  const city = generateCity(rng, o.size, o.cityName ?? 'Saint-Clair');
  const startMinute = o.minute ?? 9 * 60;
  const year = calendar(o.startYear, startMinute).year;
  const st: GameState = {
    version: SAVE_VERSION, seed, rng: 0, startYear: o.startYear, minute: startMinute,
    commander: { ...o.commander, grade: gradeFor(0, year), reputation: o.commander.experience === 'chevronne' ? 62 : o.commander.experience === 'confirme' ? 50 : 40, appearance: o.commander.appearance ?? randomAppearance(rng, o.commander.sexe, o.commander.age) },
    city, station: initialStation(), staff: [], units: [], vehicles: [], people: {}, cases: [],
    lab: { queue: [], done: 0, externalUsed: 0 }, magistrates: [], requests: [], budget: null as never, articles: [], mediaRequests: [],
    publicTrust: 55, events: [], notices: [], candidates: [], stats: [],
    settings: { assist: o.assist ?? 'assiste', autoPause: true, speed: 1 },
    counters: { staff: 0, case: 0, person: 0, action: 0, lab: 0, req: 0, mag: 0, notice: 0, event: 0, media: 0, room: 100, vehicle: 0, unit: 0 },
    weather: { kind: 'clair', temp: 8, until: 0 }, saga: { started: false, stepsSpawned: 0, resolved: false },
    scenario: o.scenario ?? 'saint-clair', reception: { visitors: 0, satisfied: 0 }, techs: initialTechs(year), hierarchy: { evaluations: [], rank: 0, postSince: startMinute, offers: [], career: [{ minute: startMinute, year, rank: 0, city: city.name, text: `Prise de fonctions à la tête de la brigade de ${city.name}.` }], retired: false },
  };
  // équipe initiale (scénario de référence : 12 personnes)
  const scale = { commune: 0.6, petite: 0.8, moyenne: 1, grande: 1.3, metropole: 1.6 }[o.size];
  const mk = (role: Role, extra: Partial<Parameters<typeof makeStaff>[1]> = {}) => {
    const s = makeStaff(rng, { id: `S${++st.counters.staff}`, role, year, minute: st.minute, ...extra });
    st.staff.push(s);
    return s;
  };
  const cmd = mk('commandant', { age: o.commander.age, sexe: o.commander.sexe, level: o.commander.experience === 'chevronne' ? 14 : o.commander.experience === 'confirme' ? 12 : 10, specialite: o.commander.specialite });
  Object.assign(cmd, { id: 'CMD', prenom: o.commander.prenom, nom: o.commander.nom, grade: st.commander.grade, appearance: st.commander.appearance });
  const o1 = mk('officier', { age: 46, specialite: 'Atteintes aux personnes' });
  const o2 = mk('officier', { age: 39, specialite: 'Délinquance financière' });
  const invs = [mk('enqueteur', { age: 34 }), mk('enqueteur', { age: 29 }), mk('enqueteur', { age: 42, specialite: 'Atteintes aux biens' }), mk('enqueteur', { age: 25, specialite: 'Généraliste' })];
  void scale;
  const ag1 = mk('agent', { age: 31 });
  const ag2 = mk('agent', { age: 27 });
  const ag3 = mk('agent', { age: 50 });
  const tech = mk('technicien', { age: 36 });
  const sec = mk('secretaire', { age: 44, sexe: 'F' });
  // planning : une permanence de nuit assurée par un agent, astreinte d'un officier
  ag2.shift = 'nuit'; ag2.restDays = [2, 3];
  ag3.shift = 'mixte'; ag3.restDays = [0, 1];
  invs[3].restDays = [1, 2];
  o2.astreinte = true;
  for (const s of st.staff) { s.relations = {}; for (const t of st.staff) if (t !== s) s.relations[t.id] = rng.int(-10, 40); }
  void sec; void tech; void ag1;
  // unités
  const u = (name: string, kind: Unit['kind'], chief: Staff, members: Staff[], domain: Unit['domain']): Unit => {
    const unit: Unit = { id: `U${++st.counters.unit}`, name, kind, chief: chief.id, domain, districts: [] };
    for (const m of [chief, ...members]) m.unitId = unit.id;
    st.units.push(unit);
    return unit;
  };
  u('Groupe des atteintes aux personnes', 'criminel', o1, [invs[0], invs[1]], ['disparition', 'deces_suspect', 'homicide', 'extorsion', 'ancien']);
  u('Groupe des atteintes aux biens et financier', 'biens', o2, [invs[2], invs[3], ...invs.slice(4)], ['vol', 'cambriolage', 'escroquerie', 'fraude_doc', 'trafic_art', 'financiere', 'vol_vehicule', 'numerique', 'sabotage', 'fausse_declaration']);
  u('Police technique et scientifique', 'scientifique', tech, [], []);
  // véhicules
  const era = eraOf(year);
  const colors = [0x6b7a8f, 0xe8e4da, 0x2f3a48, 0x7a2e2e];
  const vehs: Vehicle['kind'][] = ['banalisee', 'banalisee', 'fourgon'];
  vehs.forEach((k, i) => st.vehicles.push({ id: `V${++st.counters.vehicle}`, label: `${k === 'fourgon' ? 'Fourgon' : 'Véhicule'} ${i + 1}`, model: era.vehicles[k === 'fourgon' ? 2 : i % 2], kind: k, year: year - rng.int(1, 6), condition: rng.int(60, 90), km: rng.int(40000, 140000), busyUntil: 0, caseId: null, color: colors[i % colors.length] }));
  // justice
  st.magistrates.push(makeMagistrate(rng, st, 'procureur'), makeMagistrate(rng, st, 'substitut'), makeMagistrate(rng, st, 'juge_libertes'), makeMagistrate(rng, st, 'juge_instruction'));
  st.budget = makeBudget(st, year);
  staffUp(st, rng, startMinute);
  if (capacities(st).desks < investigators(st).length) notify(st, { level: 'alerte', text: `Postes de travail insuffisants : ${capacities(st).desks} bureaux pour ${investigators(st).length} enquêteurs. Construisez des bureaux d'enquête (menu Construction).` });
  refreshCandidates(rng, st);
  ensurePartners(st, rng);
  notify(st, { level: 'info', text: `Prise de fonctions à ${city.name}. Bienvenue, ${st.commander.grade.toLowerCase()} ${o.commander.nom}.` });
  // quelques affaires déjà en cours au début de partie
  for (let i = 0; i < (o.scenario === 'libre' ? 3 : 2); i++) spawnCase(st, rng, true);
  st.rng = rng.state;
  return st;
}

/** Volume d'affaires attendu (1 = brigade de 80 000 habitants) : taille de la ville et ressort
 * de l'échelon, sans double comptage. */
export function demandOf(st: Pick<GameState, 'city' | 'hierarchy'>): number {
  const popF = Math.pow(st.city.population / 80000, 0.6);
  return popF * Math.max(1, LEVELS_SCALE(st.hierarchy.rank) / Math.max(1, popF));
}
const LEVELS_SCALE = (rank: number) => [1, 1.3, 1.7, 2.1, 2.5, 3][Math.min(5, rank)];

/** Effectif d'enquête cible : environ six enquêteurs par unité de volume d'affaires. */
export function targetInvestigators(st: Pick<GameState, 'city' | 'hierarchy'>): number {
  return Math.max(6, Math.round(6 * demandOf(st)));
}

/** Complète les effectifs d'une structure jusqu'à sa cible (création de partie, mutation). */
export function staffUp(st: GameState, rng: Rng, minute: number) {
  const year = calendar(st.startYear, minute).year;
  const inv = st.staff.filter((s) => s.role === 'enqueteur' || s.role === 'officier').length;
  const missing = targetInvestigators(st) - inv;
  for (let i = 0; i < missing; i++) {
    const role: Role = i % 3 === 2 ? 'officier' : 'enqueteur';
    const s = makeStaff(rng, { id: `S${++st.counters.staff}`, role, year, minute });
    s.unitId = st.units[i % 2]?.id ?? null;
    st.staff.push(s);
  }
  const techsWanted = Math.max(1, Math.round(targetInvestigators(st) / 7));
  for (let i = st.staff.filter((s) => s.role === 'technicien').length; i < techsWanted; i++) st.staff.push(makeStaff(rng, { id: `S${++st.counters.staff}`, role: 'technicien', year, minute }));
  const agentsWanted = Math.max(3, Math.round(targetInvestigators(st) / 4));
  for (let i = st.staff.filter((s) => s.role === 'agent').length; i < agentsWanted; i++) st.staff.push(makeStaff(rng, { id: `S${++st.counters.staff}`, role: 'agent', year, minute }));
  // garage et véhicules à proportion
  const wantVeh = Math.max(3, Math.round(targetInvestigators(st) / 3));
  const era = eraOf(year);
  while (st.vehicles.length < wantVeh) st.vehicles.push({ id: `V${++st.counters.vehicle}`, label: `Véhicule ${st.vehicles.length + 1}`, model: era.vehicles[st.vehicles.length % 2], kind: 'banalisee', year: year - rng.int(0, 4), condition: rng.int(70, 95), km: rng.int(10000, 80000), busyUntil: 0, caseId: null, color: [0x6b7a8f, 0xe8e4da, 0x2f3a48, 0x7a2e2e][st.vehicles.length % 4] });
  st.budget.payroll = st.staff.reduce((t, x) => t + salary(x, year), 0);
}

export function yearNow(st: GameState) {
  return calendar(st.startYear, st.minute).year;
}

// ————— Incidents —————
export function spawnCase(st: GameState, rng: Rng, initial = false, types?: CaseType[]): Case | null {
  const c = calendar(st.startYear, st.minute);
  const all = templates(c.year).filter((t) => !t.minYear || c.year >= t.minYear);
  const typed = types ? all.filter((t) => types.includes(t.type)) : all;
  const tpls = typed.length ? typed : all;
  // poids selon l'activité des quartiers concernés à cette heure et les événements en cours
  const heavy = ['homicide', 'trafic_art', 'financiere', 'extorsion', 'numerique', 'ancien', 'escroquerie'];
  const weights = tpls.map((t) => t.weight * axisSpawnFactor(st, t.type) * (heavy.includes(t.type) ? 1 + st.hierarchy.rank * 0.3 : 1) * Math.max(...t.districts.map((d) => {
    const dist = st.city.districts.find((x) => x.id === d)!;
    return districtActivity(dist, c.weekday, c.hour, c.season) * incidentFactor(st, d);
  })));
  let r = rng.next() * weights.reduce((a, b) => a + b, 0);
  let t = tpls[0];
  for (let i = 0; i < tpls.length; i++) { r -= weights[i]; if (r <= 0) { t = tpls[i]; break; } }
  if (t.id === 'dossier-ancien' && !initial && rng.chance(0.5)) return null;
  // le quartier est tiré parmi ceux du modèle, selon leur activité
  const dw = t.districts.map((d) => districtActivity(st.city.districts.find((x) => x.id === d)!, c.weekday, c.hour, c.season) * incidentFactor(st, d));
  let q = rng.next() * dw.reduce((a, b) => a + b, 0);
  let district = t.districts[0];
  for (let i = 0; i < dw.length; i++) { q -= dw[i]; if (q <= 0) { district = t.districts[i]; break; } }
  const cs = t.build(st, rng, { district });
  st.cases.push(cs);
  onNewCase(st, rng, cs);
  // certains auteurs récidivent : une série d'affaires liées se prépare (inconnue du joueur)
  if (t.crime && cs.truth.culprit && !initial && rng.chance(0.07)) {
    (st.series ??= []).push({ tpl: t.id, culprit: cs.truth.culprit, caseId: cs.id, due: st.minute + rng.int(5, 14) * MIN_D, left: rng.chance(0.3) ? 2 : 1 });
  }
  return cs;
}

/** Récidive : nouvelle affaire du même auteur, même mode opératoire, si l'auteur court toujours. */
function seriesTick(st: GameState, rng: Rng) {
  if (!st.series?.length) return;
  const year = calendar(st.startYear, st.minute).year;
  for (const s of [...st.series]) {
    if (s.due > st.minute) continue;
    const first = st.cases.find((c) => c.id === s.caseId);
    const caught = st.cases.some((c) => (c.id === s.caseId || c.series === (first?.series ?? s.caseId)) && c.outcome?.designated === s.culprit && c.outcome.decision === 'poursuites');
    const t = templates(year).find((x) => x.id === s.tpl);
    if (caught || !t || !st.people[s.culprit]) { st.series = st.series.filter((x) => x !== s); continue; }
    const last = st.cases.filter((c) => c.series === (first?.series ?? s.caseId) || c.id === s.caseId).pop() ?? first;
    const cs = t.build(st, rng, { district: rng.pick(t.districts), forced: { culprit: s.culprit, linkTo: last?.id ?? s.caseId } });
    st.cases.push(cs);
    onNewCase(st, rng, cs);
    s.left--;
    s.caseId = cs.id;
    s.due = st.minute + rng.int(6, 15) * MIN_D;
    if (s.left <= 0) st.series = st.series.filter((x) => x !== s);
  }
}

function onNewCase(st: GameState, rng: Rng, cs: Case) {
  caseLog(st, cs.id, `Signalement : ${cs.summary}`);
  notify(st, { level: cs.priority === 1 ? 'urgent' : 'info', text: `Nouveau dossier ${cs.number} : ${cs.title}`, caseId: cs.id });
  if (st.settings.assist === 'delegation') autoAssign(st, rng, cs);
}

/** Attribution d'un dossier (choix du joueur ou de son adjoint en délégation). */
export function assignCase(st: GameState, c: Case, lead: string, team: string[], vehicle?: string | null) {
  const prev = new Set([c.lead, ...c.team].filter(Boolean) as string[]);
  c.lead = lead;
  c.team = [...new Set([lead, ...team])];
  for (const id of prev) if (!c.team.includes(id)) { const s = st.staff.find((x) => x.id === id); if (s) s.assignments = s.assignments.filter((x) => x !== c.id); }
  for (const id of c.team) {
    const s = st.staff.find((x) => x.id === id);
    if (s && !s.assignments.includes(c.id)) {
      s.assignments.push(c.id);
      s.history.push({ minute: st.minute, kind: 'affectation', text: `${id === lead ? 'Responsable' : 'Membre de l\'équipe'} : ${c.title}` });
    }
  }
  if (vehicle !== undefined) c.vehicle = vehicle;
  if (c.stage === 'signalement' || c.stage === 'evaluation') c.stage = 'attribution';
  caseLog(st, c.id, `Dossier attribué à ${fullName(st.staff.find((s) => s.id === lead)!)}${c.team.length > 1 ? ` avec ${c.team.filter((x) => x !== lead).map((x) => fullName(st.staff.find((s) => s.id === x)!)).join(', ')}` : ''}.`);
  updateStage(c);
}

export function investigators(st: GameState) {
  return st.staff.filter((s) => s.role === 'enqueteur' || s.role === 'officier');
}

/** Choix d'une équipe selon les compétences, la spécialité, l'unité et la charge. */
export function suggestTeam(st: GameState, c: Case): { lead: string; team: string[] } | null {
  const unit = st.units.find((u) => u.domain.includes(c.type));
  const cands = investigators(st).filter((s) => s.status === 'service' || s.status === 'repos');
  if (!cands.length) return null;
  const score = (s: Staff) => {
    let v = (s.skills.deduction + s.skills.investigation + s.skills.entretien) / 3 - (load(s, st) / capacity(s)) * 8 - Math.max(0, s.fatigue - 50) / 8;
    if (unit && s.unitId === unit.id) v += 2.5;
    if (s.specialite.toLowerCase().includes(c.type.slice(0, 5))) v += 1.5;
    return v;
  };
  const sorted = cands.sort((a, b) => score(b) - score(a));
  const leadC = sorted.find((s) => s.role === 'officier' && load(s, st) < capacity(s) * 1.1 && (c.priority === 1 || c.complexity >= 4)) ?? sorted[0];
  const size = c.priority === 1 || c.complexity >= 4 ? 3 : 2;
  const team = sorted.filter((s) => s !== leadC).slice(0, size - 1).map((s) => s.id);
  return { lead: leadC.id, team };
}

function autoAssign(st: GameState, rng: Rng, c: Case) {
  void rng;
  const sug = suggestTeam(st, c);
  if (!sug) return;
  assignCase(st, c, sug.lead, sug.team);
}

// ————— Pas de simulation —————
export function step(st: GameState, minutes: number) {
  const rng = new Rng(st.rng);
  const end = st.minute + minutes;
  while (st.minute < end) {
    tick(st, rng);
    st.minute += STEP;
  }
  st.rng = rng.state;
}

function tick(st: GameState, rng: Rng) {
  const cal = calendar(st.startYear, st.minute);
  const newHour = cal.min === 0;
  const newDay = newHour && cal.hour === 0;
  if (newDay) daily(st, rng, cal);
  if (newHour) hourly(st, rng, cal);
  work(st, rng, cal);
}

function hourly(st: GameState, rng: Rng, cal: ReturnType<typeof calendar>) {
  updateWeather(st, rng);
  rollEvents(st, rng);
  processRequests(st, rng);
  processTrials(st, rng);
  mediaTick(st, rng);
  // grande affaire scénarisée
  const due = sagaDue(st);
  if (due) {
    const cs = buildSagaCase(st, rng, due.key);
    st.cases.push(cs);
    st.saga.stepsSpawned++;
    st.saga.started = true;
    onNewCase(st, rng, cs);
  }
  // incidents : volume proportionnel à la population, modulé par l'heure
  const open = st.cases.filter((c) => c.status === 'ouverte').length;
  // volume d'affaires : taille de la ville et ressort de l'échelon (sans double comptage —
  // un poste élevé dans une grande ville couvre surtout la ville elle-même)
  const demand = demandOf(st);
  const perDay = 0.34 * demand;
  const hourW = cal.hour >= 8 && cal.hour < 20 ? 1.4 : 0.45;
  if (open < 45 * Math.max(1, demand) && rng.chance((perDay / 24) * hourW)) spawnCase(st, rng);
  if (cal.hour === 10) seriesTick(st, rng);
  // décisions des enquêteurs (toutes les deux heures en service)
  if (cal.hour % 2 === 0 && cal.hour >= 8 && cal.hour <= 18) investigatorsThink(st, rng);
  // délégation avancée : l'adjoint attribue et transmet
  if (st.settings.assist === 'delegation') delegateHourly(st, rng);
  for (const c of st.cases) if (c.status === 'ouverte') {
    const busy = c.actions.some((a) => a.approved);
    c.stalledH = busy ? 0 : c.stalledH + 1;
  }
  // accueil du public
  const atDesk = st.staff.filter((s) => (s.role === 'agent' || s.role === 'secretaire') && isOnDuty(s, st)).length;
  receptionTick(st, rng, capacities(st).accueil ? atDesk : 0);
}

function delegateHourly(st: GameState, rng: Rng) {
  const openN = st.cases.filter((c) => c.status === 'ouverte').length;
  const overloaded = openN > investigators(st).length * 1.6;
  for (const c of st.cases) {
    if (c.status !== 'ouverte') continue;
    if (!c.lead) { autoAssign(st, rng, c); continue; }
    if (c.stage === 'transmission') {
      const top = suspicionRanking(c)[0];
      if (top && top.total >= PROOF * 1.15 && !top.exculpated && top.material >= 6) transmit(st, rng, c, { kind: 'poursuites', pid: top.pid });
      else if (noCrimeWeight(c) >= 8) transmit(st, rng, c, { kind: 'classement_absence' });
      else if ((st.minute - c.openedAt) / MIN_D > (overloaded && c.priority >= 2 ? 10 : 25)) transmit(st, rng, c, { kind: top && top.total > 2 ? 'classement_insuffisant' : 'classement_inconnu' });
      // sinon le dossier reste prêt à transmettre : l'équipe poursuit si des éléments nouveaux arrivent
    } else if (c.stalledH > 72 && (st.minute - c.openedAt) / MIN_D > 30) {
      c.stage = 'transmission';
    } else if (overloaded && c.priority >= 2 && c.stalledH > 36 && (st.minute - c.openedAt) / MIN_D > (c.priority === 3 ? 8 : 18)) {
      // service débordé : les dossiers mineurs enlisés sont présentés au parquet en l'état
      c.stage = 'transmission';
    }
  }
}

/** Travail des personnels en service pendant 10 minutes. */
function work(st: GameState, rng: Rng, cal: ReturnType<typeof calendar>) {
  const cap = capacities(st);
  const dt = STEP;
  const panne = eventActive(st, 'panne');
  const night = cal.hour < 6 || cal.hour >= 21;
  const busy = new Set<string>();
  let interviewsInUse = 0;
  const open = st.cases.filter((c) => c.status === 'ouverte').sort((a, b) => a.priority - b.priority || a.openedAt - b.openedAt);
  // véhicules libérés
  for (const v of st.vehicles) if (v.busyUntil <= st.minute && v.caseId) v.caseId = null;
  const deskUsers: string[] = [];
  for (const c of open) {
    for (const a of [...c.actions]) {
      if (!a.approved) continue;
      const def = ACTIONS[a.kind];
      if (def.auth && a.target && !authGranted(c, def.auth, a.target)) continue;
      const workers = a.by.map((id) => st.staff.find((s) => s.id === id)).filter((s): s is Staff => !!s && !busy.has(s.id) && (isOnDuty(s, st) || (c.priority === 1 && s.astreinte && s.status === 'service')));
      if (!workers.length) continue;
      if ((a.kind === 'audition') && interviewsInUse >= Math.max(1, cap.interviewRooms)) continue;
      if (def.vehicle && !a.started) {
        const v = st.vehicles.find((x) => x.busyUntil <= st.minute && x.condition > 10);
        if (!v) continue;
        v.busyUntil = st.minute + Math.round((a.hours + 0.5) * MIN_H);
        v.caseId = c.id;
        v.km += rng.int(8, 40);
        v.condition = Math.max(0, v.condition - 0.4 * wearFactor(st));
      }
      if (!a.started) a.started = st.minute;
      if (a.kind === 'audition') interviewsInUse++;
      for (const w of workers) {
        busy.add(w.id);
        w.task = { caseId: c.id, action: a.kind, label: `${def.label}${a.target && def.target === 'person' ? ` — ${pname(st, a.target)}` : ''}`, room: def.room, outside: def.outside, placeId: c.placeId };
        if (!def.outside && (def.room === 'bureaux' || def.room === 'archives')) deskUsers.push(w.id);
      }
      let rate = workers.reduce((s, w) => s + (0.55 + condition(w) * 0.45), 0) / Math.max(1, a.by.length) * (1 + 0.15 * (workers.length - 1));
      if (panne && (a.kind === 'recherche' || a.kind === 'rapport' || a.kind === 'requisition')) rate *= 0.5;
      if (a.kind === 'recherche' && cap.archives) rate *= 1.2;
      if (a.kind === 'recoupement' && cap.briefing) rate *= 1.15;
      if (a.kind === 'audition') rate *= (cap.cells > 0 ? 1 : 1 / 1.6) * (cap.infirmerie ? 1.15 : 1);
      if (a.kind === 'requisition' && cap.ecoutes) rate *= 1.3;
      rate *= actionBonus(st, a.kind) * partnerBoost(st, c, a.kind) * axisWorkFactor(st, c.type, a.kind);
      if (a.kind === 'audition' && st.summit?.reforms.includes('garde-a-vue')) rate *= 0.85;
      if (a.kind === 'rapport' && st.staff.some((s) => s.role === 'secretaire' && isOnDuty(s, st))) rate *= 1.2;
      if (def.outside && (eventActive(st, 'tempete') || eventActive(st, 'neige'))) rate *= 0.6;
      if (def.outside && c.district === 'villages' && eventActive(st, 'route')) rate *= 0.7;
      // surcharge : un enquêteur dispersé sur trop d'affaires avance moins vite
      const lead = workers[0];
      const l = load(lead, st), capa = capacity(lead);
      if (l > capa) rate *= Math.max(0.5, capa / l);
      a.hours -= (dt / 60) * rate;
      if (a.hours <= 0) completeAction(st, rng, c, a);
    }
  }
  // postes de travail : sans bureau disponible, le travail sédentaire est ralenti (déjà comptabilisé au pas suivant)
  if (deskUsers.length > cap.desks) {
    for (const c of open) for (const a of c.actions) if (deskUsers.includes(a.by[0]) && (ACTIONS[a.kind].room === 'bureaux' || ACTIONS[a.kind].room === 'archives')) a.hours += (dt / 60) * 0.3;
  }
  // laboratoire : techniciens en service et paillasses disponibles
  const techs = st.staff.filter((s) => s.role === 'technicien' && isOnDuty(s, st));
  const slots = Math.min(Math.max(0, cap.labBenches), techs.length * 2);
  const internal = st.lab.queue.filter((j) => !j.external).sort((a, b) => a.priority - b.priority || a.queuedAt - b.queuedAt);
  const techSkill = techs.length ? Math.max(...techs.map((t) => t.skills.scientifique * condition(t))) : 10;
  // les appareils tournent en continu ; la présence d'un technicien accélère le traitement
  const benchSlots = Math.max(0, Math.min(cap.labBenches, Math.max(1, st.staff.filter((s) => s.role === 'technicien').length) * 2));
  for (const j of internal.slice(0, Math.max(slots, benchSlots))) {
    j.hoursLeft -= (dt / 60) * (techs.length ? 1 : 0.4) * (cap.signaletique && (j.type === 'empreintes' || j.type === 'photo') ? 1.3 : 1) * techBonus(st, j.type) * partnerLabBoost(st, j.caseId, j.type);
    if (j.hoursLeft <= 0) { finishLab(st, rng, j.id, techSkill); for (const t of techs) gainXp(t, 'scientifique', 0.06); }
  }
  for (const t of techs) if (!busy.has(t.id) && internal.length) { busy.add(t.id); t.task = { caseId: internal[0].caseId, action: 'labo', label: 'Analyses en laboratoire', room: 'labo' }; }
  for (const j of st.lab.queue.filter((x) => x.external)) {
    j.hoursLeft -= dt / 60 / 1.6; // prestataire extérieur : délais incluant l'acheminement
    if (j.hoursLeft <= 0) finishLab(st, rng, j.id, 13);
  }
  // personnels sans tâche d'enquête
  const restBonus = cap.rest > 0 ? 0.6 + cap.rest * 0.2 : 0;
  for (const s of st.staff) {
    const on = isOnDuty(s, st);
    if (!busy.has(s.id)) {
      if (!on) s.task = null;
      else if (s.role === 'commandant') s.task = { caseId: null, action: 'admin', label: 'Direction du service', room: 'commandant' };
      else if (s.role === 'secretaire') s.task = { caseId: null, action: 'admin', label: 'Frappe des procédures et gestion', room: 'administratif' };
      else if (s.role === 'agent') s.task = { caseId: null, action: 'accueil', label: 'Accueil du public et permanence', room: 'accueil' };
      else if (s.fatigue > 65 || (cal.hour === 12 && cal.min < 50) || (cal.hour === 10 && cal.min === 30)) s.task = { caseId: null, action: 'pause', label: 'Pause', room: cap.rest ? (st.station.rooms.some((r) => r.type === 'repos') ? 'repos' : 'cafeteria') : 'vestiaires' };
      else if (s.role === 'technicien') s.task = { caseId: null, action: 'labo', label: 'Entretien du matériel et classement des scellés', room: 'labo' };
      else s.task = { caseId: null, action: 'admin', label: s.assignments.length ? 'Mise à jour des procédures' : 'Travail de fond, fichiers et archives', room: 'bureaux' };
    }
    const pausing = s.task?.action === 'pause';
    tickStaff(s, st, dt, { restBonus: pausing ? restBonus + 0.8 : 0, working: on && !pausing, night: on && night, overloaded: load(s, st) > capacity(s) });
  }
}

function daily(st: GameState, rng: Rng, cal: ReturnType<typeof calendar>) {
  const year = cal.year;
  // statuts : fin de congés, formations, arrêts
  for (const s of st.staff) {
    if (s.status !== 'service' && s.status !== 'repos' && st.minute >= s.statusUntil) {
      if (s.status === 'formation') {
        s.history.push({ minute: st.minute, kind: 'formation', text: 'Formation terminée.' });
        notify(st, { level: 'succes', text: `${fullName(s)} a terminé sa formation.`, staffId: s.id });
      }
      s.status = 'service';
    }
    if (s.status === 'service' && s.fatigue > 85 && rng.chance(0.08)) {
      s.status = 'maladie';
      s.statusUntil = st.minute + rng.int(2, 6) * MIN_D;
      notify(st, { level: 'alerte', text: `${fullName(s)} est en arrêt maladie (épuisement).`, staffId: s.id });
    }
    if (cal.weekday === 1) { s.overtime += Math.max(0, s.hoursThisWeek - 46); s.hoursThisWeek = 0; } // seuil : 39 h + pauses et permanences comptées
    // demandes individuelles
    if (s.role !== 'commandant' && rng.chance(0.004)) {
      const gi = gradeIndex(s, year);
      const grades = gradesFor(s.role, year);
      if (s.ambition > 12 && gi < grades.length - 1 && s.skills.experience > 8 + gi * 3 && !s.requests.includes('promotion')) {
        s.requests.push('promotion');
        notify(st, { level: 'info', text: `${fullName(s)} demande à être présenté${s.sexe === 'F' ? 'e' : ''} à l'avancement.`, staffId: s.id });
      } else if (s.moral < 35 && !s.requests.includes('mutation')) {
        s.requests.push('mutation');
        s.history.push({ minute: st.minute, kind: 'demande', text: 'Demande de mutation.' });
        notify(st, { level: 'alerte', text: `${fullName(s)} demande sa mutation (moral bas).`, staffId: s.id });
      } else if (s.ambition > 10 && !s.requests.includes('formation') && s.status === 'service') {
        s.requests.push('formation');
        notify(st, { level: 'info', text: `${fullName(s)} souhaite suivre une formation.`, staffId: s.id });
      }
    }
    // congés d'été planifiés automatiquement si le solde est important
    if (s.status === 'service' && cal.month >= 6 && cal.month <= 7 && s.leaveDays >= 15 && rng.chance(0.03) && st.staff.filter((x) => x.status === 'conge').length < 2) {
      s.status = 'conge';
      s.statusUntil = st.minute + 14 * MIN_D;
      s.leaveDays -= 14;
      notify(st, { level: 'info', text: `${fullName(s)} part en congés pour deux semaines.`, staffId: s.id });
    }
  }
  if (rng.chance(0.3)) staffDeparture(st, rng);
  // partenaires institutionnels : demandes, relations
  partnersDaily(st, rng, (types) => spawnCase(st, rng, false, types));
  // installations d'entraînement : progression lente de l'endurance, du stress et de la discipline
  const capD = capacities(st);
  for (const s of st.staff) {
    if (s.status !== 'service') continue;
    if (capD.sport) { gainXp(s, 'endurance', 0.02); gainXp(s, 'stress', 0.015); }
    if (capD.tir) gainXp(s, 'discipline', 0.015);
  }
  // réseau d'antennes (échelons supérieurs) : dossiers sensibles remontés au siège
  const esc = networkTick(st, rng);
  for (let k = 0; k < esc; k++) {
    const c = spawnCase(st, rng);
    if (c) { c.priority = Math.min(c.priority, 2) as 1 | 2; c.summary = `Dossier sensible transmis par une antenne du réseau. ${c.summary}`; }
  }
  // véhicules : entretien quotidien
  for (const v of st.vehicles) {
    if (v.condition < 35 && rng.chance(0.1)) {
      spend(st, 'entretien', rng.int(300, 900), (n) => notify(st, n));
      v.condition = Math.min(100, v.condition + 40);
      notify(st, { level: 'info', text: `${v.label} : passage au garage pour entretien.` });
    }
  }
  spend(st, 'operationnel', Math.round(12 * Math.sqrt(st.staff.length)));
  if (eraOf(year).computers !== 'aucun') spend(st, 'informatique', 8);
  // paie mensuelle (masse salariale suivie séparément)
  if (cal.day === 1) {
    payDotations(st);
    summitMonthly(st, rng);
    st.budget.payroll = st.staff.reduce((s, x) => s + salary(x, year), 0);
    st.budget.payrollPaid += Math.round(st.budget.payroll / 12);
  }
  // réponses aux demandes de moyens
  for (const r of st.budget.requests) if (r.granted === null && st.minute >= r.answerAt) {
    r.granted = evaluateFundRequest(st, rng, r);
    if (r.granted > 0) st.budget.envelope[r.cat] += r.granted;
    notify(st, { level: r.granted ? 'succes' : 'alerte', text: r.granted ? `Demande de moyens acceptée : +${r.granted.toLocaleString('fr-FR')} € (${r.reason}).` : `Demande de moyens refusée (${r.reason}).` });
  }
  // vivier de recrutement et retraites
  if (cal.weekday === 1) refreshCandidates(rng, st);
  for (const cand of st.candidates) if (cand.requested && st.minute >= cand.availableFrom) arrive(st, cand.staff);
  st.candidates = st.candidates.filter((c) => !(c.requested && st.minute >= c.availableFrom));
  // la confiance du public revient lentement vers la normale
  st.publicTrust += (55 - st.publicTrust) * 0.01;
  compactArchives(st);
  // statistiques
  snapshot(st);
  // nouvel an : budget, évaluations, avancement, vieillissement, retraites
  if (cal.month === 0 && cal.day === 1 && st.minute > MIN_D) newYear(st, rng, year);
  // en délégation, l'administration propose des remplacements quand l'effectif baisse
  if (st.settings.assist === 'delegation') {
    const inv = investigators(st).length;
    const pending = st.candidates.filter((c) => c.requested).length;
    if (inv + pending < targetInvestigators(st)) {
      const c = st.candidates.find((x) => !x.requested && (x.staff.role === 'enqueteur' || x.staff.role === 'officier')) ?? makeCandidate(rng, st, 'sortie_ecole');
      if (!st.candidates.includes(c)) st.candidates.push(c);
      c.requested = true;
    }
  }
}

/** Allège les dossiers archivés depuis longtemps (mémoire et taille des sauvegardes). */
export function compactArchives(st: GameState) {
  for (const c of st.cases) {
    if (c.status === 'ouverte' || c.status === 'transmise') continue;
    const at = c.outcome?.verdictAt ?? c.outcome?.at ?? c.openedAt;
    if (st.minute - at < 120 * MIN_D || (c as Case & { compact?: boolean }).compact) continue;
    (c as Case & { compact?: boolean }).compact = true;
    c.done = c.done.slice(0, 2).concat(c.done.slice(-6));
    c.board.notes = c.board.notes.filter((n) => !n.id.startsWith('idle-'));
    // un dossier jugé, ou sans auteur, ne sera pas rouvert : les pistes non explorées sont oubliées
    if (c.status === 'jugee' || !c.truth.culprit) c.clues = c.clues.filter((k) => k.found);
  }
  // journaux plafonnés (dossiers rouverts ou très longs, historiques de carrière)
  for (const c of st.cases) if (c.done.length > 150) c.done = c.done.slice(0, 3).concat(c.done.slice(-140));
  const KEEP = new Set(['arrivee', 'promotion', 'mutation', 'decoration', 'erreur', 'formation', 'resolue', 'evaluation']);
  for (const s of st.staff) if (s.history.length > 220) {
    const imp = s.history.filter((h) => KEEP.has(h.kind));
    const rest = s.history.filter((h) => !KEEP.has(h.kind)).slice(-100);
    s.history = [...imp.slice(-120), ...rest].sort((a, b) => a.minute - b.minute);
  }
  // au-delà de six ans, un dossier classé n'est plus rouvert (prescription, modèle simplifié)
  for (const c of st.cases) if (c.status === 'classee' && c.clues.length && st.minute - (c.outcome?.at ?? 0) > 6 * 365 * MIN_D) { c.clues = []; c.items = []; c.done = c.done.slice(-2); c.board = { notes: [], links: [], pos: {} }; }
  // au-delà d'un an, un dossier définitivement jugé (ou sans auteur) ne garde que sa fiche d'archive
  for (const c of st.cases) {
    if (!(c.status === 'jugee' || (c.status === 'classee' && (!c.truth.culprit || !c.clues.some((k) => !k.found))))) continue;
    if (st.minute - (c.outcome?.verdictAt ?? c.outcome?.at ?? 0) < 365 * MIN_D || !c.clues.length) continue;
    c.clues = [];
    c.items = [];
    c.done = c.done.slice(-2);
    c.board = { notes: [], links: [], pos: {} };
    c.actions = [];
  }
  // au-delà de cinq ans, un dossier clos ne subsiste qu'en statistiques (registre d'archives)
  const cutoff = st.minute - 5 * 365 * MIN_D;
  const keep: Case[] = [];
  for (const c of st.cases) {
    const at = c.outcome?.verdictAt ?? c.outcome?.at;
    const old = (c.status === 'jugee' || c.status === 'classee') && at !== undefined && at < cutoff && !c.saga && (c.status === 'jugee' || !c.clues.length);
    if (!old) { keep.push(c); continue; }
    const k = st.counters;
    k.arch_n = (k.arch_n ?? 0) + 1;
    k.arch_correct = (k.arch_correct ?? 0) + (c.outcome!.correct ? 1 : 0);
    k.arch_quality = (k.arch_quality ?? 0) + c.outcome!.quality;
    k.arch_conv = (k.arch_conv ?? 0) + (c.outcome!.verdict === 'condamnation' ? 1 : 0);
    k.arch_class = (k.arch_class ?? 0) + (c.outcome!.decision.startsWith('classement') ? 1 : 0);
    k.arch_flaws = (k.arch_flaws ?? 0) + c.procedureFlaws;
    k.arch_reopened = (k.arch_reopened ?? 0) + (c.reopenCount > 0 ? 1 : 0);
  }
  if (keep.length !== st.cases.length) st.cases = keep;
  // les personnes qui n'apparaissent plus que dans des archives allégées sont oubliées
  if (Math.floor(st.minute / MIN_D) % 30 === 0) {
    const live = new Set<string>();
    for (const c of st.cases) if (c.clues.length || c.status === 'ouverte' || c.status === 'transmise') for (const p of c.persons) live.add(p.pid);
    for (const id of Object.keys(st.people)) if (!live.has(id) && !id.startsWith('SAGA-')) delete st.people[id];
    for (const c of st.cases) if (!c.clues.length && c.status !== 'ouverte') c.persons = c.persons.filter((p) => st.people[p.pid]);
  }
}

export function arrive(st: GameState, s: Staff) {
  s.history.push({ minute: st.minute, kind: 'mutation', text: `Affectation à la brigade de ${st.city.name}.` });
  for (const t of st.staff) { s.relations[t.id] = 0; t.relations[s.id] = 0; }
  st.staff.push(s);
  notify(st, { level: 'succes', text: `${fullName(s)} (${s.grade}) rejoint la brigade.`, staffId: s.id });
}

function newYear(st: GameState, rng: Rng, year: number) {
  const b = st.budget;
  b.history.push({ year: b.year, envelope: totalEnvelope(b), spent: totalSpent(b), payroll: b.payrollPaid });
  // évaluation hiérarchique : qualité, respect des procédures, gestion humaine et budgétaire
  const closed = st.cases.filter((c) => c.outcome && c.outcome.decision !== 'complement' && c.outcome.at >= (year - 1 - st.startYear) * 365 * MIN_D);
  const q = closed.length ? closed.reduce((s, c) => s + c.outcome!.quality, 0) / closed.length : 50;
  const correct = closed.length ? closed.filter((c) => c.outcome!.correct).length / closed.length : 0.5;
  const flaws = closed.reduce((s, c) => s + c.procedureFlaws, 0);
  const moral = st.staff.reduce((s, x) => s + x.moral, 0) / st.staff.length;
  const budgetOk = totalSpent(b) <= totalEnvelope(b) * 1.02 ? 1 : 0;
  // irrégularités : pénalité rapportée au volume traité (au plus 6 points)
  const flawPen = Math.min(6, flaws / Math.max(8, closed.length) * 9);
  const note = Math.max(0, Math.min(20, Math.round((q / 100 * 6 + correct * 6 + moral / 100 * 3 + budgetOk * 2 + st.publicTrust / 100 * 3 - flawPen) * 10) / 10));
  st.hierarchy.evaluations.push({ year: year - 1, note, text: note >= 15 ? 'Excellente année : travail de qualité et équipe bien gérée.' : note >= 12 ? 'Année satisfaisante.' : note >= 9 ? 'Résultats contrastés : des progrès sont attendus.' : 'Année difficile : la hiérarchie demande un plan d\'amélioration.' });
  st.commander.reputation = Math.max(0, Math.min(100, st.commander.reputation + (note - 12) * 1.2));
  notify(st, { level: note >= 12 ? 'succes' : 'alerte', text: `Évaluation annuelle ${year - 1} : ${note}/20.` });
  // la gestion du réseau d'antennes compte pour 30 % de l'évaluation aux échelons supérieurs
  const nn = networkNote(st);
  if (nn !== null) {
    const ev = st.hierarchy.evaluations[st.hierarchy.evaluations.length - 1];
    ev.note = Math.round((ev.note * 0.7 + nn * 0.3) * 10) / 10;
    ev.text += ` Réseau d'antennes : ${nn}/20.`;
  }
  const sn = summitNote(st);
  if (sn !== null) {
    const ev = st.hierarchy.evaluations[st.hierarchy.evaluations.length - 1];
    ev.note = Math.round((ev.note * 0.75 + sn * 0.25) * 10) / 10;
    ev.text += ` Pilotage national : ${sn}/20.`;
  }
  networkNewYear(st, year);
  careerNewYear(st, rng, year);
  ensureSummit(st);
  ensureNetwork(st, rng);
  techNewYear(st, year);
  fleetNewYear(st, rng, year);
  st.budget = makeBudget(st, year, (0.95 + note / 100) * level(st).budget);
  st.budget.history = b.history;
  st.budget.payrollPaid = 0;
  // personnel : vieillissement, évaluations individuelles, retraites
  for (const s of [...st.staff]) {
    const age = ageOf(s, year);
    if (s.role !== 'commandant' && age >= 62 && rng.chance(age >= 65 ? 1 : 0.4)) {
      st.staff = st.staff.filter((x) => x !== s);
      for (const c of st.cases) { c.team = c.team.filter((x) => x !== s.id); if (c.lead === s.id) c.lead = c.team[0] ?? null; }
      notify(st, { level: 'alerte', text: `${fullName(s)} part à la retraite après ${year - s.entryYear} ans de service.` });
      continue;
    }
    s.leaveDays = 25;
    s.skills.endurance = Math.max(1, s.skills.endurance - (age > 45 ? 1 : 0) * (rng.chance(0.4) ? 1 : 0));
    const ev = Math.round(((s.skills.fiabilite + s.skills.discipline + s.skills.collectif) / 3 + (s.casesSolved > 0 ? 1 : 0) - s.errors * 0.3) * 10) / 10;
    s.history.push({ minute: st.minute, kind: 'evaluation', text: `Évaluation ${year - 1} : ${ev}/20.` });
    if (ev >= 16 && rng.chance(0.15)) s.history.push({ minute: st.minute, kind: 'decoration', text: 'Lettre de félicitations du directeur départemental.' });
    s.errors = 0;
  }
  if (st.settings.assist === 'delegation') {
    for (const s of st.staff) if (s.requests.includes('promotion')) promote(st, s);
  }
}

export function promote(st: GameState, s: Staff): string {
  const year = yearNow(st);
  const grades = gradesFor(s.role, year);
  const gi = gradeIndex(s, year);
  s.requests = s.requests.filter((r) => r !== 'promotion');
  if (gi >= grades.length - 1) return `${fullName(s)} est déjà au grade le plus élevé de son corps.`;
  const quota = st.staff.filter((x) => x.role === s.role && gradeIndex(x, year) > gi).length;
  if (s.skills.experience < 6 + gi * 3 || quota > 3) {
    s.moral = Math.max(0, s.moral - 5);
    return `Avancement refusé par la commission : ancienneté ou quotas insuffisants pour ${fullName(s)}.`;
  }
  s.grade = grades[gi + 1];
  s.moral = Math.min(100, s.moral + 15);
  s.history.push({ minute: st.minute, kind: 'promotion', text: `Promotion au grade de ${s.grade}.` });
  notify(st, { level: 'succes', text: `${fullName(s)} est promu${s.sexe === 'F' ? 'e' : ''} ${s.grade}.`, staffId: s.id });
  return `${fullName(s)} est promu${s.sexe === 'F' ? 'e' : ''} ${s.grade}.`;
}

export const TRAININGS: { id: string; label: string; days: number; cost: number; skills: (keyof Staff['skills'])[] }[] = [
  { id: 'audition', label: 'Techniques d\'audition', days: 5, cost: 900, skills: ['entretien', 'psychologie'] },
  { id: 'procedure', label: 'Procédure pénale (mise à jour)', days: 4, cost: 700, skills: ['juridique', 'redaction'] },
  { id: 'analyse', label: 'Analyse criminelle', days: 8, cost: 1600, skills: ['analyse', 'deduction'] },
  { id: 'pts', label: 'Police technique et scientifique', days: 10, cost: 2200, skills: ['scientifique', 'observation'] },
  { id: 'numerique', label: 'Enquêtes numériques', days: 8, cost: 1900, skills: ['informatique', 'analyse'] },
  { id: 'management', label: 'Management d\'équipe', days: 5, cost: 1200, skills: ['leadership', 'collectif'] },
  { id: 'stress', label: 'Gestion du stress', days: 3, cost: 500, skills: ['stress', 'endurance'] },
];

export function sendTraining(st: GameState, s: Staff, id: string): string {
  const t = TRAININGS.find((x) => x.id === id)!;
  if (s.status !== 'service') return `${fullName(s)} n'est pas disponible.`;
  const cost = Math.round(t.cost * (capacities(st).formation ? 0.7 : 1));
  spend(st, 'formation', cost, (n) => notify(st, n));
  s.status = 'formation';
  s.statusUntil = st.minute + t.days * MIN_D;
  s.requests = s.requests.filter((r) => r !== 'formation');
  for (const k of t.skills) if (s.skills[k] < Math.min(20, s.potential + 2)) s.skills[k] += 1;
  s.moral = Math.min(100, s.moral + 6);
  s.history.push({ minute: st.minute, kind: 'formation', text: `Formation : ${t.label}.` });
  return `${fullName(s)} part en formation « ${t.label} » (${t.days} jours, ${cost} €).`;
}

function snapshot(st: GameState) {
  const day = Math.floor(st.minute / MIN_D);
  const closed = st.cases.filter((c) => c.status !== 'ouverte');
  const inv = investigators(st);
  st.stats.push({
    day,
    open: st.cases.filter((c) => c.status === 'ouverte').length,
    closed: closed.length,
    solved: closed.filter((c) => c.outcome?.correct).length,
    moral: Math.round(st.staff.reduce((s, x) => s + x.moral, 0) / st.staff.length),
    fatigue: Math.round(st.staff.reduce((s, x) => s + x.fatigue, 0) / st.staff.length),
    spent: totalSpent(st.budget),
    labQueue: st.lab.queue.length,
    load: inv.length ? Math.round(inv.reduce((s, x) => s + load(x, st), 0) / inv.length * 10) / 10 : 0,
    satisfaction: st.reception.visitors ? Math.round((st.reception.satisfied / st.reception.visitors) * 100) : 100,
  });
  if (st.stats.length > 3650) st.stats.splice(0, st.stats.length - 3650);
}

// ————— Contrôles du temps —————
/** Avance jusqu'au prochain événement notable (nouvelle alerte), au plus `maxH` heures. */
export function advanceToNext(st: GameState, maxH = 72): number {
  const start = st.minute;
  const n0 = st.counters.notice;
  while (st.minute - start < maxH * MIN_H) {
    step(st, STEP);
    const fresh = st.notices.slice(-(st.counters.notice - n0));
    if (st.counters.notice > n0 && fresh.some((n) => n.level !== 'info' || n.caseId)) break;
  }
  return st.minute - start;
}

export function hasUrgent(st: GameState, sinceCounter: number) {
  return st.notices.some((n) => Number(n.id.slice(1)) > sinceCounter && n.level === 'urgent');
}

export { charges, MIN_D, MIN_H };

/** Mutation avec avancement dans une ville plus grande : nouvelle brigade, même commandant,
 * même carrière, même date. Renvoie le nouvel état de partie. */
export function acceptMutation(st: GameState, offerId: string): GameState | null {
  const o = st.hierarchy.offers.find((x) => x.id === offerId);
  const opt = o?.options.find((x) => x.kind === 'mutation') as { kind: 'mutation'; city: string; size: CitySize } | undefined;
  if (!o || o.answered || !opt) return null;
  o.answered = true;
  const oldCmd = st.staff.find((s) => s.id === 'CMD');
  const minute = st.minute - (st.minute % STEP);
  const ns = newGame({
    seed: (st.seed * 31 + st.minute) >>> 0, startYear: st.startYear, size: opt.size, cityName: opt.city, scenario: 'libre', assist: st.settings.assist, minute,
    commander: { ...st.commander, age: commanderAge(st) },
  });
  ns.commander = { ...st.commander };
  const cmd = ns.staff.find((s) => s.id === 'CMD');
  if (cmd && oldCmd) Object.assign(cmd, { birthYear: oldCmd.birthYear, entryYear: oldCmd.entryYear, skills: { ...oldCmd.skills }, history: [...oldCmd.history], appearance: oldCmd.appearance, casesHandled: oldCmd.casesHandled, casesSolved: oldCmd.casesSolved });
  ns.hierarchy = { ...st.hierarchy, rank: o.toRank, postSince: minute, offers: st.hierarchy.offers, career: [...st.hierarchy.career], pastCities: [...(st.hierarchy.pastCities ?? []).filter((p) => p.city !== st.city.name), { city: st.city.name, size: st.city.size, leftAt: minute }] };
  applyGrade(ns, gradeFor(o.toRank, calendar(ns.startYear, minute).year));
  ensureNetwork(ns, new Rng(ns.seed ^ 0x51));
  for (const c of Object.keys(ns.budget.envelope) as (keyof typeof ns.budget.envelope)[]) ns.budget.envelope[c] = Math.round((ns.budget.envelope[c] * level(ns).budget) / 100) * 100;
  // la structure d'accueil est dimensionnée pour son volume d'affaires
  staffUp(ns, new Rng(ns.seed ^ 0x9e37), minute);
  ns.budget.payroll = ns.staff.reduce((t, x) => t + salary(x, calendar(ns.startYear, minute).year), 0);
  ns.settings = { ...st.settings, speed: 0 };
  ns.publicTrust = 55;
  const text = `Mutation et promotion : ${ns.commander.grade}, à la tête du poste « ${level(ns).title.replace('{ville}', opt.city)} » (${ns.city.population.toLocaleString('fr-FR')} habitants). Les dossiers de ${st.city.name} sont transmis à votre successeur.`;
  ns.hierarchy.career.push({ minute, year: calendar(ns.startYear, minute).year, rank: o.toRank, city: opt.city, text });
  notify(ns, { level: 'succes', text });
  return ns;
}

/** Flotte : les véhicules vieillissent ; en délégation, les plus anciens sont remplacés par le
 * modèle de l'époque (le style des véhicules évolue donc avec les années). */
export function fleetNewYear(st: GameState, rng: Rng, year: number) {
  for (const v of [...st.vehicles]) {
    const age = year - v.year;
    if (age > 8) v.condition = Math.max(5, v.condition - 6);
    if (age >= 14) {
      // programme national de renouvellement : remplacement d'office, financé par l'administration
      renewVehicle(st, rng, v.id, true);
    } else if (st.settings.assist === 'delegation' && (age >= 10 || v.condition < 25) && remaining(st.budget, 'vehicules') > vehicleCost(st, v.kind) * 0.6) {
      renewVehicle(st, rng, v.id);
    } else if (age === 10) {
      notify(st, { level: 'info', text: `${v.label} (${v.model}) a dix ans : un remplacement par un modèle actuel est conseillé (Équipements).` });
    }
  }
}

export function vehicleCost(st: GameState, kind: Vehicle['kind']): number {
  const year = calendar(st.startYear, st.minute).year;
  return Math.round(((kind === 'fourgon' || kind === 'technique' ? 26000 : 17000) * eraOf(year).budgetFactor) / 100) * 100;
}

export function renewVehicle(st: GameState, rng: Rng, id: string, national = false): string {
  const v = st.vehicles.find((x) => x.id === id);
  if (!v) return 'Véhicule introuvable.';
  const year = calendar(st.startYear, st.minute).year;
  const era = eraOf(year);
  if (!national) spend(st, 'vehicules', vehicleCost(st, v.kind), (n) => notify(st, n));
  const old = v.model;
  v.model = era.vehicles[v.kind === 'fourgon' || v.kind === 'technique' ? 2 : rng.int(0, 1)];
  v.year = year;
  v.condition = 100;
  v.km = 0;
  notify(st, { level: 'succes', text: `${v.label} remplacé${national ? ' (programme national de renouvellement)' : ''} : ${old} → ${v.model} (${year}).` });
  return `${v.label} renouvelé (${v.model}).`;
}

/** Retour dans une ville déjà dirigée : la brigade laissée à votre successeur est reprise telle
 * qu'elle a évolué entre-temps (dossiers clos par le successeur, départs en retraite, expérience
 * acquise, véhicules renouvelés). Si l'archive de la ville n'existe pas sur cet appareil, une
 * nouvelle brigade est constituée dans cette ville. */
export function returnToCity(st: GameState, offerId: string, archived: GameState | null): GameState | null {
  const o = st.hierarchy.offers.find((x) => x.id === offerId);
  const opt = o?.options.find((x) => x.kind === 'retour') as { kind: 'retour'; city: string; size: CitySize } | undefined;
  if (!o || o.answered || !opt) return null;
  const minute = st.minute - (st.minute % STEP);
  const year = calendar(st.startYear, minute).year;
  let ns: GameState;
  if (archived && archived.city.name === opt.city) {
    ns = archived;
    const away = Math.max(0, (minute - ns.minute) / (365 * MIN_D));
    ns.minute = minute;
    // dossiers repris et clos par le successeur
    const handled = ns.cases.filter((c) => c.status === 'ouverte' || c.status === 'transmise').length;
    ns.cases = ns.cases.filter((c) => c.status !== 'ouverte' && c.status !== 'transmise');
    ns.counters.arch_n = (ns.counters.arch_n ?? 0) + handled;
    const rng = new Rng((ns.seed ^ minute) >>> 0);
    // personnel : retraites, expérience gagnée en votre absence
    ns.staff = ns.staff.filter((s) => s.id === 'CMD' || year - s.birthYear < 62);
    for (const s of ns.staff) {
      s.assignments = [];
      s.task = null;
      s.fatigue = 20;
      s.status = 'service';
      if (s.id !== 'CMD') for (let k = 0; k < Math.round(away * 3); k++) gainXp(s, rng.pick(['investigation', 'entretien', 'deduction', 'experience', 'analyse'] as const), 0.6);
      s.history.push({ minute, kind: 'affectation', text: `Retour de ${st.commander.prenom} ${st.commander.nom} à la tête du service.` });
    }
    for (const v of ns.vehicles) { v.busyUntil = 0; v.caseId = null; if (year - v.year >= 10) renewVehicle(ns, rng, v.id); }
    ns.lab.queue = [];
    ns.requests = [];
    ns.events = [];
    ns.mediaRequests = [];
    ns.notices = [];
    ns.weather = { kind: 'clair', temp: 10, until: 0 };
    ns.techs = [...new Set([...(ns.techs ?? []), ...initialTechs(year)])];
    ns.budget = makeBudget(ns, year, 1);
    refreshCandidates(rng, ns);
    void handled;
  } else {
    ns = newGame({ seed: (st.seed * 17 + minute) >>> 0, startYear: st.startYear, size: opt.size, cityName: opt.city, scenario: 'libre', assist: st.settings.assist, minute, commander: { ...st.commander, age: commanderAge(st) } });
  }
  o.answered = true;
  const oldCmd = st.staff.find((s) => s.id === 'CMD');
  const cmd = ns.staff.find((s) => s.id === 'CMD');
  if (cmd && oldCmd) Object.assign(cmd, { prenom: oldCmd.prenom, nom: oldCmd.nom, birthYear: oldCmd.birthYear, entryYear: oldCmd.entryYear, skills: { ...oldCmd.skills }, history: [...oldCmd.history], appearance: oldCmd.appearance, casesHandled: oldCmd.casesHandled, casesSolved: oldCmd.casesSolved });
  ns.commander = { ...st.commander };
  ns.hierarchy = { ...st.hierarchy, rank: o.toRank, postSince: minute, career: [...st.hierarchy.career], pastCities: [...(st.hierarchy.pastCities ?? []).filter((p) => p.city !== opt.city && p.city !== st.city.name), { city: st.city.name, size: st.city.size, leftAt: minute }] };
  applyGrade(ns, gradeFor(o.toRank, year));
  for (const c of Object.keys(ns.budget.envelope) as (keyof typeof ns.budget.envelope)[]) ns.budget.envelope[c] = Math.round((ns.budget.envelope[c] * level(ns).budget) / 100) * 100;
  ns.network = undefined;
  ensureNetwork(ns, new Rng(ns.seed ^ 0x77));
  staffUp(ns, new Rng(ns.seed ^ 0x78), minute);
  ns.settings = { ...st.settings, speed: 0 };
  const text = `Retour à ${opt.city} avec le grade de ${ns.commander.grade}, à la tête du poste « ${level(ns).title.replace('{ville}', opt.city)} »${archived ? ' : vous retrouvez votre ancienne équipe.' : '.'}`;
  ns.hierarchy.career.push({ minute, year, rank: o.toRank, city: opt.city, text });
  notify(ns, { level: 'succes', text });
  return ns;
}
