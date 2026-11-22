// Gestion approfondie : personnel, R&D, sponsors négociés, moral, académie, réserve, blessures, transferts, statistiques.
import { hashSeed, Rng } from '../engine/rng';
import type { CarStats, DriverStats, RaceEvent } from '../engine/types';
import type { Career, RoundResult, Weekend } from './career';
import { driverById, playerTeam, teamById, teamDrivers, UPGRADE_LABEL, upgradeCost } from './career';
import {
  buildYouthPool, driverRating, makeStaff, salaryFor, SPONSOR_SEEDS, type Driver, type SponsorOffer, type StaffMember, type StaffRole,
} from './data';
import { addLedger, addNews, fullName, isRaceDriver, round1 } from './util';

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ================================================================ Personnel

export type Staff = Record<StaffRole, StaffMember>;
export const STAFF_ROLES: StaffRole[] = ['ingenieur', 'mecanicien', 'directeur'];

export function initialStaff(c: Pick<Career, 'seed' | 'budgetProfile' | 'difficulty'>): Staff {
  const rng = new Rng(hashSeed(c.seed, 'personnel'));
  const base = c.difficulty === 'facile' ? 12 : c.difficulty === 'normale' ? 10.5 : 9;
  const tilt: Record<StaffRole, number> = c.budgetProfile === 'serre'
    ? { ingenieur: 0, mecanicien: 2, directeur: -1 }
    : c.budgetProfile === 'investisseur' ? { ingenieur: 0.5, mecanicien: -1, directeur: 2 } : { ingenieur: 0.5, mecanicien: 0.5, directeur: 0.5 };
  const s = {} as Staff;
  for (const r of STAFF_ROLES) {
    s[r] = makeStaff(rng, r, base + tilt[r], 'stf-init-' + r);
    s[r].rating = Math.round(base + tilt[r]);
  }
  return s;
}

export function staffRating(c: Career, role: StaffRole): number {
  return c.staff?.[role]?.rating ?? 10;
}

export function staffSalaries(c: Career): number {
  return c.staff ? STAFF_ROLES.reduce((a, r) => a + c.staff![r].salary, 0) : 0;
}

/** Candidats du marché du personnel (renouvelés chaque saison). */
export function refreshStaffMarket(c: Career): void {
  const rng = new Rng(hashSeed(c.seed, c.season, 'marche-personnel'));
  const list: StaffMember[] = [];
  for (const r of STAFF_ROLES) {
    for (let k = 0; k < 3; k++) list.push(makeStaff(rng, r, 8 + k * 3.5 + rng.range(0, 2), `stf-${c.season}-${r}-${k}`));
  }
  c.staffMarket = list;
}

export function staffSigningFee(m: StaffMember): number {
  return round1(m.salary * 0.5);
}

export function hireStaff(c: Career, id: string): string | null {
  if (c.weekend) return 'Impossible de changer de personnel pendant un week-end de course.';
  const m = c.staffMarket?.find((x) => x.id === id);
  if (!m) return 'Candidat introuvable.';
  if (!c.staff) c.staff = initialStaff(c);
  const cur = c.staff[m.role];
  const severance = round1(cur.salary * 0.25);
  const fee = staffSigningFee(m);
  if (c.budget < fee + severance) return 'Budget insuffisant.';
  addLedger(c, `Recrutement — ${m.name}`, -fee);
  if (severance) addLedger(c, `Indemnité de départ — ${cur.name}`, -severance);
  c.staff[m.role] = { ...m };
  c.staffMarket = c.staffMarket!.filter((x) => x.id !== id);
  applyStaffEffects(c);
  addNews(c, `${m.name} devient ${m.role === 'ingenieur' ? 'ingénieur de course' : m.role === 'mecanicien' ? 'chef mécanicien' : 'directeur technique'} de ${playerTeam(c).name}.`);
  return null;
}

/** Le chef mécanicien détermine la qualité des arrêts de l'écurie du joueur. */
export function applyStaffEffects(c: Career): void {
  const t = playerTeam(c);
  t.pitCrew = staffRating(c, 'mecanicien');
}

/** Bonus de fiabilité apporté par le chef mécanicien (appliqué à la voiture en course). */
export function reliabilityBonus(c: Career): number {
  return Math.round((staffRating(c, 'mecanicien') - 10) / 4);
}

/** Multiplicateur de progression du réglage aux essais (ingénieur de course). */
export function engineerFactor(c: Career): number {
  return 0.6 + staffRating(c, 'ingenieur') / 25;
}

// ================================================================ Recherche & développement

export interface RndProject {
  id: string;
  stat: keyof CarStats;
  cost: number;
  duration: number; // Grands Prix nécessaires
  progress: number;
  chance: number; // probabilité de réussite
  season: number;
}

export const MAX_PROJECTS = 2;

export function projectTerms(c: Career, stat: keyof CarStats): { cost: number; duration: number; chance: number } {
  const level = playerTeam(c).car[stat];
  const dir = staffRating(c, 'directeur');
  return {
    cost: round1(upgradeCost(level) * 1.1),
    duration: clamp(Math.round(3.2 - (dir - 10) / 5 + (level >= 16 ? 1 : 0)), 1, 5),
    chance: clamp(0.62 + (dir - 10) * 0.025 - (level - 12) * 0.02, 0.35, 0.95),
  };
}

export function startProject(c: Career, stat: keyof CarStats): string | null {
  const projects = (c.projects ??= []);
  if (projects.length >= MAX_PROJECTS) return `L'usine mène déjà ${MAX_PROJECTS} projets de front.`;
  if (projects.some((p) => p.stat === stat)) return 'Un projet est déjà en cours sur cet élément.';
  if (playerTeam(c).car[stat] >= 20) return 'Niveau maximal atteint.';
  const t = projectTerms(c, stat);
  if (c.budget < t.cost) return 'Budget insuffisant.';
  addLedger(c, `Projet R&D ${UPGRADE_LABEL[stat].toLowerCase()} lancé`, -t.cost);
  projects.push({ id: `rnd-${c.season}-${c.round}-${stat}`, stat, cost: t.cost, duration: t.duration, progress: 0, chance: t.chance, season: c.season });
  addNews(c, `L'usine lance un projet ${UPGRADE_LABEL[stat].toLowerCase()} (${t.duration} GP, réussite estimée ${Math.round(t.chance * 100)} %).`);
  return null;
}

/** Avance les projets d'un Grand Prix (appelé à la clôture de chaque week-end). */
export function progressProjects(c: Career): void {
  if (!c.projects?.length) return;
  const rng = new Rng(hashSeed(c.seed, c.season, c.round, 'rnd'));
  const t = playerTeam(c);
  const dir = staffRating(c, 'directeur');
  for (const p of [...c.projects]) {
    p.progress++;
    if (p.progress < p.duration) continue;
    c.projects = c.projects.filter((x) => x !== p);
    const label = UPGRADE_LABEL[p.stat].toLowerCase();
    if (rng.chance(p.chance)) {
      const gain = rng.chance(0.1 + Math.max(0, dir - 12) * 0.015) ? 2 : 1;
      t.car[p.stat] = Math.min(20, t.car[p.stat] + gain);
      addNews(c, gain === 2 ? `Percée à l'usine ! Évolution ${label} : +2 (niveau ${t.car[p.stat]}).` : `Évolution ${label} réussie : niveau ${t.car[p.stat]}.`);
    } else {
      addNews(c, `Le projet ${label} n'a pas donné les gains espérés en soufflerie. Budget perdu.`);
    }
  }
}

// ================================================================ Sponsors : négociation, durée, renouvellement

/** Exigence maximale acceptée par le sponsor (multiplicateur des montants). */
export function sponsorLimit(c: Career, s: SponsorOffer, years: number): number {
  const rep = playerTeam(c).reputation;
  return 1 + (rep - s.minReputation) / 180 + 0.04 * (years - 1);
}

export function sponsorStance(c: Career, s: SponsorOffer, mult: number, years: number): 'favorable' | 'hesitant' | 'reticent' {
  const lim = sponsorLimit(c, s, years);
  return mult <= lim - 0.06 ? 'favorable' : mult <= lim ? 'hesitant' : 'reticent';
}

export function negotiateSponsor(c: Career, offerId: string, mult: number, years: number): string | null {
  const s = c.sponsorOffers.find((x) => x.id === offerId);
  if (!s) return 'Offre introuvable.';
  if (c.sponsors.length >= 2) return 'Vos deux emplacements de sponsors sont occupés.';
  if (playerTeam(c).reputation < s.minReputation) return `${s.name} exige une réputation de ${s.minReputation}.`;
  const talks = (c.sponsorTalks ??= {});
  if (mult > sponsorLimit(c, s, years) + 1e-9) {
    talks[offerId] = (talks[offerId] ?? 0) + 1;
    if (talks[offerId] >= 2) {
      c.sponsorOffers = c.sponsorOffers.filter((x) => x.id !== offerId);
      return `${s.name} rompt les discussions pour cette saison.`;
    }
    return `${s.name} refuse ces conditions. Dernière chance avant la rupture des discussions.`;
  }
  const signed = {
    ...s,
    perRace: round1(s.perRace * mult),
    bonus: round1(s.bonus * mult),
    signing: round1(s.signing * (1 + 0.15 * (years - 1))),
    years,
    slot: (c.sponsors.some((x) => x.slot === 'principal') ? 'secondaire' : 'principal') as 'principal' | 'secondaire',
  };
  c.sponsors.push(signed);
  addLedger(c, `Prime de signature — ${s.name}`, signed.signing);
  addNews(c, `${s.name} devient partenaire de ${playerTeam(c).name} pour ${years} saison(s).`);
  return null;
}

/** Fin de saison : les contrats pluriannuels continuent, les autres reviennent en renouvellement. */
export function renewSponsors(c: Career): void {
  const rep = playerTeam(c).reputation;
  const kept = c.sponsors.filter((s) => (s.years ?? 1) > 1).map((s) => ({ ...s, years: (s.years ?? 1) - 1 }));
  const expired = c.sponsors.filter((s) => (s.years ?? 1) <= 1);
  const scale = 0.85 + rep / 250;
  const offers: SponsorOffer[] = SPONSOR_SEEDS.map((s, i) => ({
    ...s, id: 'spn-' + i, perRace: round1(s.perRace * scale), bonus: round1(s.bonus * scale), signing: round1(s.signing * scale),
  })).filter((o) => !kept.some((k) => k.id === o.id));
  for (const e of expired) addNews(c, `Le contrat de ${e.name} arrive à échéance : une offre de renouvellement vous attend.`);
  c.sponsors = kept;
  c.sponsorOffers = offers;
  c.sponsorTalks = {};
}

// ================================================================ Pilotes : moral, académie, réserve, blessures

export function moraleOf(d: Driver): number {
  return d.morale ?? 65;
}

/** Influence du moral sur le rythme (±0,75 %). */
export function formFactor(d: Driver): number {
  return 1 + (moraleOf(d) - 65) * 0.00025;
}

export function moraleLabel(m: number): string {
  return m >= 85 ? 'Euphorique' : m >= 70 ? 'Motivé' : m >= 55 ? 'Serein' : m >= 40 ? 'Contrarié' : 'Démotivé';
}

/** Moral après une course : résultat, duel avec l'équipier, consignes subies. */
export function updateMorale(c: Career, res: RoundResult, events: RaceEvent[] = []): void {
  const byTeam = new Map<string, typeof res.entries>();
  for (const e of res.entries) {
    if (!byTeam.has(e.teamId)) byTeam.set(e.teamId, []);
    byTeam.get(e.teamId)!.push(e);
  }
  for (const e of res.entries) {
    const d = driverById(c, e.driverId);
    let m = moraleOf(d);
    if (e.status === 'abandon') m -= 5;
    else if (e.position === 1) m += 10;
    else if (e.position <= 3) m += 6;
    else if (e.points > 0) m += 3;
    const mate = byTeam.get(e.teamId)!.find((x) => x !== e);
    if (mate) m += e.position < mate.position ? 2 : -3;
    // a dû céder sa place à son équipier
    const victim = events.filter((ev) => ev.kind === 'consigne' && ev.otherId === d.id && /laisse passer/.test(ev.text)).length;
    m -= victim * 10;
    if (d.contract && d.contract.years <= 1 && c.round >= c.calendar.length / 2 && d.teamId === c.playerTeamId) m -= 1;
    m += (65 - m) * 0.08;
    d.morale = Math.round(clamp(m, 5, 100));
  }
}

export function academyDrivers(c: Career): Driver[] {
  return c.drivers.filter((d) => d.teamId === c.playerTeamId && d.role === 'academie');
}

export function reserveDriver(c: Career): Driver | undefined {
  return c.drivers.find((d) => d.teamId === c.playerTeamId && d.role === 'reserve');
}

export function youthProspects(c: Career): Driver[] {
  return c.drivers.filter((d) => !d.teamId && !d.retired && d.age <= 19).sort((a, b) => (b.potential ?? 0) - (a.potential ?? 0));
}

export const MAX_ACADEMY = 3;

export function signYouth(c: Career, id: string): string | null {
  const d = driverById(c, id);
  if (!d || d.teamId || d.age > 19) return 'Ce jeune pilote n’est pas disponible.';
  if (c.weekend) return 'Le marché est fermé pendant un week-end de course.';
  if (academyDrivers(c).length >= MAX_ACADEMY) return `L'académie est complète (${MAX_ACADEMY} places).`;
  const fee = 0.1;
  if (c.budget < fee) return 'Budget insuffisant.';
  d.teamId = c.playerTeamId;
  d.role = 'academie';
  d.contract = { salary: 0.2, years: 3 };
  addLedger(c, `Académie — ${fullName(d)}`, -fee);
  addNews(c, `${fullName(d)} (${d.age} ans) rejoint l'académie de ${playerTeam(c).name}.`);
  return null;
}

/** Changer le rôle d'un pilote de l'écurie (titulaire, réserve, académie). */
export function setDriverRole(c: Career, id: string, role: 'titulaire' | 'reserve' | 'academie'): string | null {
  const d = driverById(c, id);
  if (!d || d.teamId !== c.playerTeamId) return 'Pilote introuvable.';
  if (c.weekend) return 'Impossible pendant un week-end de course.';
  if (role === 'titulaire' && teamDrivers(c, c.playerTeamId).length >= 2 && !isRaceDriver(d)) return 'Vous avez déjà deux titulaires : passez-en un en réserve d’abord.';
  if (role === 'reserve' && reserveDriver(c) && reserveDriver(c) !== d) return 'Vous avez déjà un pilote de réserve.';
  if (role === 'academie' && d.age > 21) return 'L’académie est réservée aux pilotes de 21 ans maximum.';
  d.role = role;
  if (role !== 'academie' && d.contract && d.contract.salary < d.askSalary * 0.5) {
    d.contract.salary = round1(Math.max(d.contract.salary, d.askSalary * 0.6));
  }
  addNews(c, `${fullName(d)} : nouveau rôle — ${role === 'titulaire' ? 'pilote titulaire' : role === 'reserve' ? 'pilote de réserve' : 'académie'}.`);
  return null;
}

/** Progression des jeunes de l'académie (et du réserviste) après chaque Grand Prix. */
export function developYouth(c: Career): void {
  const rng = new Rng(hashSeed(c.seed, c.season, c.round, 'academie'));
  const coach = 0.8 + staffRating(c, 'ingenieur') / 50;
  for (const d of c.drivers) {
    if (d.teamId !== c.playerTeamId || (d.role !== 'academie' && d.role !== 'reserve')) continue;
    const pot = d.potential ?? driverRating(d.stats) + 1;
    for (const k of Object.keys(d.stats) as (keyof DriverStats)[]) {
      const gap = pot - d.stats[k];
      if (gap > 0 && rng.chance((gap / 25) * coach)) d.stats[k] = Math.min(20, d.stats[k] + 1);
    }
    d.askSalary = salaryFor(driverRating(d.stats), d.age);
  }
}

/** Avant chaque Grand Prix : risque de blessure ou de maladie (3 % par titulaire). */
export function checkInjuries(c: Career): void {
  if (!c.weekend) return;
  const rng = new Rng(hashSeed(c.seed, c.season, c.round, 'blessures'));
  for (const d of teamDrivers(c, c.playerTeamId)) {
    if (!rng.chance(0.03)) continue;
    const reserve = reserveDriver(c);
    let sub: Driver | undefined = reserve;
    let temp = false;
    if (!sub) {
      sub = c.drivers.filter((x) => !x.teamId && !x.retired && x.age > 19).sort((a, b) => driverRating(b.stats) - driverRating(a.stats))[0];
      if (!sub) return;
      temp = true;
      sub.teamId = c.playerTeamId;
      sub.contract = { salary: 0, years: 0 };
      addLedger(c, `Pilote de remplacement — ${fullName(sub)}`, -0.4);
    }
    d.role = 'reserve';
    sub.role = 'titulaire';
    c.weekend.standIn = { injured: d.id, sub: sub.id, temp };
    addNews(c, `${fullName(d)} est malade et manquera le Grand Prix : ${fullName(sub)} le remplace${temp ? ' (pilote libre appelé en urgence)' : ''}.`);
    return; // un seul forfait par week-end
  }
}

/** Fin du week-end : le pilote blessé retrouve son baquet. */
export function restoreStandIn(c: Career, w: Weekend): void {
  const si = w.standIn;
  if (!si) return;
  const inj = driverById(c, si.injured);
  const sub = driverById(c, si.sub);
  inj.role = 'titulaire';
  if (si.temp) {
    sub.teamId = null;
    sub.contract = null;
    sub.role = undefined;
  } else sub.role = 'reserve';
}

/** Prolongation de contrat : le moral influence les exigences. */
export function extensionDemand(d: Driver): number {
  const m = moraleOf(d);
  const base = salaryFor(driverRating(d.stats), d.age);
  return round1(base * (m < 45 ? 1.3 : m < 60 ? 1.1 : m > 80 ? 0.92 : 1));
}

export function extendContract(c: Career, id: string, salary: number, years: number): string | null {
  const d = driverById(c, id);
  if (!d || d.teamId !== c.playerTeamId || !d.contract) return 'Pilote introuvable.';
  const need = extensionDemand(d) * (years >= 3 ? 1.08 : 1);
  if (salary < need - 1e-9) return `${fullName(d)} demande au moins ${need.toFixed(1)} M€ par saison.`;
  if (moraleOf(d) < 30) return `${fullName(d)} est trop démotivé pour prolonger.`;
  d.contract = { salary: round1(salary), years: d.contract.years + years };
  d.morale = Math.min(100, moraleOf(d) + 8);
  addNews(c, `${fullName(d)} prolonge chez ${playerTeam(c).name} (${years} saison(s) de plus).`);
  return null;
}

// ================================================================ Transferts de l'intersaison

export function seasonTransfers(c: Career, rng: Rng): void {
  const ai = c.teams.filter((t) => !t.isPlayer);
  // Retraites
  for (const d of c.drivers) {
    if (d.retired || d.teamId === c.playerTeamId) continue;
    if (d.age >= 36 && rng.chance(0.5)) {
      if (d.teamId) addNews(c, `${fullName(d)} (${d.age} ans) prend sa retraite.`);
      d.retired = true;
      d.teamId = null;
      d.contract = null;
    }
  }
  // Contrats arrivés à échéance chez l'IA : prolongation ou départ selon le niveau attendu.
  for (const t of ai) {
    for (const d of teamDrivers(c, t.id)) {
      if (!d.contract || d.contract.years > 0) continue;
      const expected = 6 + t.reputation / 8;
      if (driverRating(d.stats) >= expected - 0.5 || rng.chance(0.4)) d.contract = { salary: salaryFor(driverRating(d.stats), d.age), years: 1 + rng.int(0, 2) };
      else {
        addNews(c, `Transferts : ${t.name} ne prolonge pas ${fullName(d)}.`);
        d.teamId = null;
        d.contract = null;
      }
    }
  }
  // Les meilleures écuries remplacent leur pilote le plus faible si un pilote libre est nettement meilleur.
  const ranked = [...ai].sort((a, b) => b.reputation - a.reputation);
  for (const t of ranked.slice(0, 4)) {
    const mine = teamDrivers(c, t.id);
    if (mine.length < 2) continue;
    const worst = mine.reduce((a, b) => (driverRating(a.stats) < driverRating(b.stats) ? a : b));
    const best = available(c)[0];
    if (best && driverRating(best.stats) > driverRating(worst.stats) + 1.2 && rng.chance(0.7)) {
      addNews(c, `Transferts : ${t.name} écarte ${fullName(worst)} et recrute ${fullName(best)}.`);
      worst.teamId = null;
      worst.contract = null;
      sign(c, t.id, best, rng);
    }
  }
  // Compléter les baquets vacants, des meilleures écuries aux plus modestes.
  for (const t of ranked) {
    while (teamDrivers(c, t.id).length < 2) {
      const pool = available(c);
      if (!pool.length) break;
      // une écurie modeste ne s'offre pas toujours le meilleur pilote libre
      const pick = t.reputation > 60 ? pool[0] : pool[Math.min(pool.length - 1, rng.int(0, 2))];
      sign(c, t.id, pick, rng);
      addNews(c, `Transferts : ${fullName(pick)} rejoint ${t.name}.`);
    }
  }
  // Nouveaux espoirs sur le marché.
  const fresh = buildYouthPool(hashSeed(c.seed, c.season, 'espoirs'), 3, c.drivers);
  c.drivers.push(...fresh);
}

function available(c: Career): Driver[] {
  return c.drivers
    .filter((d) => !d.teamId && !d.retired && d.age > 19)
    .sort((a, b) => driverRating(b.stats) - driverRating(a.stats));
}

function sign(c: Career, teamId: string, d: Driver, rng: Rng): void {
  d.teamId = teamId;
  d.role = undefined;
  d.contract = { salary: salaryFor(driverRating(d.stats), d.age), years: 1 + rng.int(0, 2) };
  const used = new Set(c.drivers.filter((x) => x.teamId && x !== d).map((x) => x.number));
  while (used.has(d.number)) d.number = (d.number % 98) + 2;
}

// ================================================================ Statistiques et palmarès

export interface StatLine {
  starts: number;
  wins: number;
  podiums: number;
  poles: number;
  points: number;
  fastest: number;
  dnf: number;
  titles: number;
  best: number;
}

export interface CareerStats {
  drivers: Record<string, StatLine>;
  teams: Record<string, StatLine>;
}

const emptyLine = (): StatLine => ({ starts: 0, wins: 0, podiums: 0, poles: 0, points: 0, fastest: 0, dnf: 0, titles: 0, best: 99 });

export function recordRaceStats(c: Career, res: RoundResult, poleId: string | null): void {
  const st = (c.stats ??= { drivers: {}, teams: {} });
  const teamSeen = new Set<string>();
  for (const e of res.entries) {
    const dl = (st.drivers[e.driverId] ??= emptyLine());
    const tl = (st.teams[e.teamId] ??= emptyLine());
    dl.starts++;
    if (!teamSeen.has(e.teamId)) {
      tl.starts++;
      teamSeen.add(e.teamId);
    }
    dl.points += e.points;
    tl.points += e.points;
    if (e.status === 'abandon') dl.dnf++;
    else {
      dl.best = Math.min(dl.best, e.position);
      tl.best = Math.min(tl.best, e.position);
      if (e.position === 1) { dl.wins++; tl.wins++; }
      if (e.position <= 3) { dl.podiums++; tl.podiums++; }
    }
  }
  if (poleId) {
    const d = driverById(c, poleId);
    (st.drivers[poleId] ??= emptyLine()).poles++;
    if (d.teamId) (st.teams[d.teamId] ??= emptyLine()).poles++;
  }
  if (res.fastest) {
    (st.drivers[res.fastest.driverId] ??= emptyLine()).fastest++;
    const d = driverById(c, res.fastest.driverId);
    if (d.teamId) (st.teams[d.teamId] ??= emptyLine()).fastest++;
  }
}

export function recordTitles(c: Career, driverId: string, teamId: string): void {
  const st = (c.stats ??= { drivers: {}, teams: {} });
  (st.drivers[driverId] ??= emptyLine()).titles++;
  (st.teams[teamId] ??= emptyLine()).titles++;
}

export function topBy(c: Career, kind: 'drivers' | 'teams', key: keyof StatLine, n = 5): { id: string; value: number }[] {
  const lines = c.stats?.[kind] ?? {};
  return Object.entries(lines)
    .map(([id, l]) => ({ id, value: l[key] }))
    .filter((x) => x.value > 0 && x.value < 99)
    .sort((a, b) => b.value - a.value)
    .slice(0, n);
}

// ================================================================ Migration des anciennes carrières

/** Complète une carrière V0.1–V0.3 (schéma ≤ 2) avec les systèmes de la V0.4. */
export function upgradeCareerV3(c: Career): void {
  for (const d of c.drivers) {
    d.morale ??= 65;
    d.potential ??= Math.max(driverRating(d.stats), 12);
  }
  if (!c.drivers.some((d) => d.age <= 19)) c.drivers.push(...buildYouthPool(hashSeed(c.seed, 'espoirs-init'), 6, c.drivers));
  c.staff ??= initialStaff(c);
  // l'équipe des stands existante devient le chef mécanicien
  c.staff.mecanicien.rating = playerTeam(c).pitCrew;
  if (!c.staffMarket) refreshStaffMarket(c);
  c.projects ??= [];
  c.sponsorTalks ??= {};
  for (const s of c.sponsors) s.years ??= 1;
  if (!c.stats) {
    c.stats = { drivers: {}, teams: {} };
    for (const r of c.results) recordRaceStats(c, r, null);
  }
  void teamById;
}
