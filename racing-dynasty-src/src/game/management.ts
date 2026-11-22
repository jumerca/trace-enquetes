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
  return (0.6 + staffRating(c, 'ingenieur') / 25) * (1 + (facilities(c).simulateur - 2) * 0.08);
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
  const f = facilities(c);
  const fac = stat === 'aero' ? f.soufflerie : f.usine; // l'aéro dépend de la soufflerie, le reste de l'usine
  return {
    cost: round1(upgradeCost(level) * 1.1),
    duration: clamp(Math.round(3.2 - (dir - 10) / 5 + (level >= 16 ? 1 : 0) - (fac >= 4 ? 1 : 0)), 1, 5),
    chance: clamp(0.62 + (dir - 10) * 0.025 - (level - 12) * 0.02 + (fac - 2) * 0.035, 0.3, 0.95),
  };
}

export function startProject(c: Career, stat: keyof CarStats): string | null {
  const projects = (c.projects ??= []);
  if (projects.length >= maxProjects(c)) return `L'usine mène déjà ${maxProjects(c)} projet(s) de front (agrandissez-la pour en mener plus).`;
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
  const coach = 0.8 + staffRating(c, 'ingenieur') / 50 + (facilities(c).simulateur - 2) * 0.05;
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
  facilities(c);
  director(c);
  c.press ??= [];
  c.rivalries ??= {};
  void teamById;
}

// ================================================================ Installations (soufflerie, simulateur, usine)

export type FacilityKind = 'soufflerie' | 'simulateur' | 'usine';
export interface Facilities {
  soufflerie: number;
  simulateur: number;
  usine: number;
  building?: { kind: FacilityKind; left: number }; // agrandissement en cours (GP restants)
}

export const FACILITY_INFO: Record<FacilityKind, { title: string; effect: string }> = {
  soufflerie: { title: 'Soufflerie', effect: 'Projets aérodynamiques plus sûrs et plus courts.' },
  simulateur: { title: 'Simulateur', effect: 'Réglages trouvés plus vite aux essais, jeunes pilotes qui progressent plus vite.' },
  usine: { title: 'Usine', effect: 'Projets moteur / châssis / fiabilité plus sûrs ; davantage de projets en parallèle.' },
};

export const MAX_FACILITY = 5;

export function facilities(c: Career): Facilities {
  return (c.facilities ??= { soufflerie: 2, simulateur: 2, usine: 2 });
}

export function facilityCost(level: number): number {
  return round1(3 + level * 2.5);
}

export function facilityDuration(level: number): number {
  return 1 + level;
}

/** Coût d'entretien par Grand Prix (M€). */
export function facilityUpkeep(c: Career): number {
  const f = facilities(c);
  return round1((f.soufflerie + f.simulateur + f.usine) * 0.06);
}

export function maxProjects(c: Career): number {
  const u = facilities(c).usine;
  return 1 + (u >= 2 ? 1 : 0) + (u >= 4 ? 1 : 0);
}

export function startFacilityUpgrade(c: Career, kind: FacilityKind): string | null {
  const f = facilities(c);
  if (c.weekend) return 'Les travaux se lancent entre deux Grands Prix.';
  if (f.building) return 'Un chantier est déjà en cours.';
  if (f[kind] >= MAX_FACILITY) return 'Niveau maximal atteint.';
  const cost = facilityCost(f[kind]);
  if (c.budget < cost) return 'Budget insuffisant.';
  addLedger(c, `Agrandissement ${FACILITY_INFO[kind].title.toLowerCase()} (niveau ${f[kind] + 1})`, -cost);
  f.building = { kind, left: facilityDuration(f[kind]) };
  addNews(c, `Début des travaux : ${FACILITY_INFO[kind].title.toLowerCase()} niveau ${f[kind] + 1} (${f.building.left} GP).`);
  return null;
}

export function progressFacilities(c: Career): void {
  const f = facilities(c);
  if (!f.building) return;
  f.building.left--;
  if (f.building.left <= 0) {
    f[f.building.kind]++;
    addNews(c, `Inauguration : ${FACILITY_INFO[f.building.kind].title.toLowerCase()} niveau ${f[f.building.kind]} !`);
    f.building = undefined;
  }
}

// ================================================================ Presse et rivalités

export interface Article {
  season: number;
  round: number;
  title: string;
  body: string;
  quote?: { driverId: string; text: string };
  rivalQuote?: { driverId: string; text: string };
  director?: string; // réponse du directeur en conférence de presse
}

const pickS = <T,>(arr: T[], rng: Rng): T => arr[rng.int(0, arr.length - 1)];

/** Intensité des rivalités entre vos pilotes et leurs adversaires (0..100), alimentée par les duels en piste. */
export function updateRivalries(c: Career, events: RaceEvent[]): void {
  const riv = (c.rivalries ??= {});
  for (const k of Object.keys(riv)) {
    riv[k] = Math.round(riv[k] * 0.85);
    if (riv[k] < 5) delete riv[k];
  }
  const mine = new Set(c.drivers.filter((d) => d.teamId === c.playerTeamId).map((d) => d.id));
  for (const e of events) {
    if (!e.carId || !e.otherId) continue;
    const a = e.carId, b = e.otherId;
    if (mine.has(a) === mine.has(b)) continue; // duel entre un pilote à vous et un adversaire uniquement
    const me = mine.has(a) ? a : b, other = mine.has(a) ? b : a;
    const k = me + '|' + other;
    const gain = e.kind === 'contact' ? 25 : e.kind === 'penalite' ? 12 : e.kind === 'depassement' ? 8 : 0;
    if (gain) riv[k] = Math.min(100, (riv[k] ?? 0) + gain);
  }
}

/** Principale rivalité d'un pilote (identifiant de l'adversaire et intensité). */
export function mainRival(c: Career, driverId: string): { id: string; level: number } | null {
  let best: { id: string; level: number } | null = null;
  for (const [k, v] of Object.entries(c.rivalries ?? {})) {
    const [me, other] = k.split('|');
    if (me === driverId && v >= 25 && (!best || v > best.level)) best = { id: other, level: v };
  }
  return best;
}

/** Effet des rivalités sur le moral : battre son rival galvanise, être battu agace. */
export function rivalryMorale(c: Career, res: RoundResult): void {
  const pos = new Map(res.entries.map((e) => [e.driverId, e.status === 'arrivé' ? e.position : 99]));
  for (const d of c.drivers.filter((x) => x.teamId === c.playerTeamId)) {
    const r = mainRival(c, d.id);
    if (!r || !pos.has(d.id) || !pos.has(r.id)) continue;
    const delta = pos.get(d.id)! < pos.get(r.id)! ? 4 : -4;
    d.morale = Math.max(5, Math.min(100, moraleOf(d) + delta * (r.level >= 60 ? 1.5 : 1)));
  }
}

/** Article de « La Gazette des Paddocks » après chaque Grand Prix. */
export function writeArticle(c: Career, res: RoundResult, events: RaceEvent[], gp: string): Article {
  const rng = new Rng(hashSeed(c.seed, c.season, res.round, 'presse'));
  const win = driverById(c, res.entries[0].driverId);
  const winTeam = teamById(c, win.teamId!);
  const team = playerTeam(c);
  const mine = res.entries.filter((e) => e.teamId === c.playerTeamId);
  const best = mine.reduce<typeof mine[number] | null>((a, e) => (e.status === 'arrivé' && (!a || e.position < a.position) ? e : a), null);
  const sc = events.some((e) => e.kind === 'securite');
  const rain = events.some((e) => e.kind === 'meteo');
  let title: string;
  let body: string;
  if (win.teamId === c.playerTeamId) {
    title = pickS([`TRIOMPHE ! ${win.last.toUpperCase()} OFFRE LA VICTOIRE À ${team.name.toUpperCase()}`, `${team.name.toUpperCase()} AU SOMMET À ${gp.replace('Grand Prix de ', '').toUpperCase()}`], rng);
    body = `Personne ne les attendait si haut : ${win.first} ${win.last} s'impose et fait exploser de joie tout le garage de ${team.name}.`;
  } else if (best && best.position <= 3) {
    title = pickS([`PODIUM HISTORIQUE POUR ${team.name.toUpperCase()}`, `${team.name.toUpperCase()} S'INVITE SUR LE PODIUM`], rng);
    body = `${winTeam.name} gagne avec ${win.first} ${win.last}, mais tous les regards sont tournés vers la ${best.position}ᵉ place de ${driverById(c, best.driverId).last}.`;
  } else if (mine.length && mine.every((e) => e.status === 'abandon')) {
    title = pickS([`CAUCHEMAR POUR ${team.name.toUpperCase()}`, `DOUBLE ABANDON : ${team.name.toUpperCase()} DANS LA TOURMENTE`], rng);
    body = `Pendant que ${win.first} ${win.last} (${winTeam.name}) l'emporte, ${team.name} repart avec zéro point et beaucoup de questions.`;
  } else {
    title = pickS([`${win.last.toUpperCase()} S'IMPOSE`, `${winTeam.name.toUpperCase()} INTOUCHABLE`, `VICTOIRE DE ${win.last.toUpperCase()} À ${gp.replace('Grand Prix de ', '').replace('Grand Prix du ', '').toUpperCase()}`], rng);
    body = `${win.first} ${win.last} remporte le ${gp} pour ${winTeam.name}.` + (best ? ` Chez ${team.name}, meilleur résultat : ${best.position}ᵉ.` : '');
  }
  if (sc) body += ' La voiture de sécurité a rebattu les cartes.';
  if (rain) body += ' La météo capricieuse a piégé plus d’un pilote.';
  // déclaration d'un de vos pilotes
  let quote: Article['quote'];
  let rivalQuote: Article['rivalQuote'];
  const speaker = mine.length ? mine[rng.int(0, mine.length - 1)] : null;
  if (speaker) {
    const d = driverById(c, speaker.driverId);
    const m = moraleOf(d);
    const rival = mainRival(c, d.id);
    let text: string;
    if (speaker.status === 'abandon') text = pickS(['Frustrant. On avait le rythme, il faut comprendre ce qui s’est passé.', 'Ça arrive en course, on reviendra plus forts.'], rng);
    else if (speaker.position <= 3) text = pickS(['Incroyable ! L’équipe a fait un travail fantastique.', 'Je rêvais de ce moment depuis des années !'], rng);
    else if (speaker.points > 0) text = pickS(['De bons points, c’est encourageant pour la suite.', 'On progresse course après course.'], rng);
    else text = m < 45 ? pickS(['Je ne suis pas satisfait, la voiture n’est pas au niveau.', 'Il va falloir des changements.'], rng) : pickS(['Course difficile, mais on garde le moral.', 'On a beaucoup appris aujourd’hui.'], rng);
    if (rival && rival.level >= 40) {
      const r = driverById(c, rival.id);
      text += ' ' + pickS([`Quant à ${r.last}… il sait ce qu’il a fait.`, `${r.last} ? Je l’attends au prochain virage.`], rng);
      rivalQuote = { driverId: r.id, text: pickS([`${d.last} devrait regarder ses rétroviseurs avant de parler.`, `Je n’ai aucun problème avec ${d.last}. C’est la course.`], rng) };
    }
    quote = { driverId: d.id, text };
  }
  const art: Article = { season: c.season, round: res.round + 1, title, body, quote, rivalQuote };
  (c.press ??= []).unshift(art);
  if (c.press.length > 24) c.press.length = 24;
  return art;
}

// ================================================================ Carrière du directeur

export interface DirectorOffer {
  teamId: string;
  reason: string;
}

export interface Director {
  confidence: number; // confiance des actionnaires 0..100
  contractYears: number;
  fired: boolean;
  offers: DirectorOffer[];
  teams: { season: number; teamName: string; pos: number }[];
  salary?: number; // salaire personnel du directeur (M€/saison, versé par les actionnaires, hors budget de l'écurie)
  bonus?: number; // prime personnelle si l'objectif est atteint
  earnings?: number; // gains cumulés de votre carrière
  renewal?: RenewalOption[]; // proposition de prolongation à arbitrer
}

export interface RenewalOption {
  years: number;
  salary: number;
  bonus: number;
  label: string;
}

export function director(c: Career): Director {
  const d = (c.director ??= { confidence: 60, contractYears: 2, fired: false, offers: [], teams: [] });
  d.salary ??= 0.8;
  d.bonus ??= 0.3;
  d.earnings ??= 0;
  return d;
}

/** Propositions de prolongation, plus généreuses quand les actionnaires sont satisfaits. */
export function renewalOptions(c: Career): RenewalOption[] {
  const dir = director(c);
  const base = dir.salary! * (0.85 + dir.confidence / 200);
  const r = (x: number) => Math.round(x * 100) / 100;
  return [
    { years: 1, salary: r(base * 1.2), bonus: r(dir.bonus! * 1.5), label: 'Une saison, salaire élevé : vous restez libre' },
    { years: 2, salary: r(base * 1.05), bonus: r(dir.bonus! * 1.2), label: 'Deux saisons, équilibré' },
    { years: 3, salary: r(base * 0.92), bonus: r(dir.bonus!), label: 'Trois saisons : la sécurité de l’emploi' },
  ];
}

/** Choisir une option de prolongation (ou tenter d'exiger plus : refus possible si la confiance est faible). */
export function signRenewal(c: Career, idx: number, demandMore = false): string | null {
  const dir = director(c);
  const opt = dir.renewal?.[idx];
  if (!opt) return 'Aucune proposition en cours.';
  if (demandMore) {
    const rng = new Rng(hashSeed(c.seed, c.season, 'exigence'));
    if (!rng.chance(Math.max(0.1, Math.min(0.9, (dir.confidence - 30) / 60)))) {
      dir.confidence = Math.max(0, dir.confidence - 8);
      dir.renewal = renewalOptions(c).map((o) => ({ ...o, salary: Math.round(o.salary * 90) / 100 }));
      addNews(c, 'Les actionnaires jugent vos exigences déplacées : leur nouvelle offre est revue à la baisse.');
      return null;
    }
    opt.salary = Math.round(opt.salary * 125) / 100;
    opt.bonus = Math.round(opt.bonus * 150) / 100;
  }
  dir.contractYears = opt.years;
  dir.salary = opt.salary;
  dir.bonus = opt.bonus;
  dir.renewal = undefined;
  addNews(c, `Contrat de directeur prolongé : ${opt.years} saison(s), ${opt.salary.toFixed(2)} M€/saison + prime ${opt.bonus.toFixed(2)} M€.`);
  return null;
}

/** Confiance des actionnaires après une course : classement par rapport à l'objectif, résultats, finances. */
export function updateConfidence(c: Career, res: RoundResult, pos: number): void {
  const dir = director(c);
  const mine = res.entries.filter((e) => e.teamId === c.playerTeamId);
  const lenient = c.difficulty === 'facile' ? 0.5 : c.difficulty === 'normale' ? 0.75 : 1;
  // Une place d'écart avec l'objectif est tolérée.
  const gap = c.objective.target - pos;
  let d = gap >= 0 ? Math.min(2.5, 0.5 + gap * 0.5) : gap === -1 ? -0.5 * lenient : Math.max(-3, gap * 0.8) * lenient;
  if (mine.some((e) => e.status === 'arrivé' && e.position <= 3)) d += 4;
  else if (mine.some((e) => e.points > 0)) d += 1;
  if (mine.length && mine.every((e) => e.status === 'abandon')) d -= 2 * lenient;
  if (c.budget < 0) d -= 3;
  dir.confidence = Math.round(Math.max(0, Math.min(100, dir.confidence + d)));
  if (dir.confidence <= 5 && c.round >= 4 && !dir.fired) fireDirector(c, 'Les actionnaires ont perdu toute confiance.');
}

function fireDirector(c: Career, why: string): void {
  const dir = director(c);
  dir.fired = true;
  dir.offers = rescueOffers(c);
  addNews(c, `LIMOGEAGE : ${why} Vous quittez ${playerTeam(c).name}.`);
}

/** Petites écuries prêtes à vous donner une seconde chance. */
function rescueOffers(c: Career): DirectorOffer[] {
  return c.teams
    .filter((t) => !t.isPlayer)
    .sort((a, b) => a.reputation - b.reputation)
    .slice(0, 2)
    .map((t) => ({ teamId: t.id, reason: `${t.name} cherche un directeur pour se relancer.` }));
}

/** Bilan de fin de saison : prolongation, limogeage, offres des grandes écuries. */
export function directorSeasonReview(c: Career, pos: number): void {
  const dir = director(c);
  dir.teams.push({ season: c.season, teamName: playerTeam(c).name, pos });
  if (dir.fired) return;
  dir.earnings = Math.round((dir.earnings! + dir.salary! + (pos <= c.objective.target ? dir.bonus! : 0)) * 100) / 100;
  const lenient = c.difficulty === 'facile' ? 0.5 : c.difficulty === 'normale' ? 0.75 : 1;
  const miss = pos - c.objective.target;
  dir.confidence = Math.round(Math.max(0, Math.min(100, dir.confidence + (miss <= 0 ? 12 - miss * 3 : miss === 1 ? -3 * lenient : -miss * 6 * lenient))));
  dir.contractYears--;
  if (dir.confidence < 15) {
    fireDirector(c, `Saison jugée insuffisante (${pos}ᵉ pour un objectif de ${c.objective.target}ᵉ).`);
    return;
  }
  if (dir.contractYears <= 0) {
    if (dir.confidence >= 30) {
      dir.renewal = renewalOptions(c);
      addNews(c, 'Votre contrat arrive à échéance : les actionnaires vous proposent une prolongation (QG).');
    } else {
      fireDirector(c, 'Votre contrat n’est pas renouvelé.');
      return;
    }
  }
  // Débauchage : une écurie plus forte vous veut si vous avez dépassé les attentes.
  dir.offers = [];
  if (dir.confidence >= 70 && pos <= c.objective.target) {
    const mine = playerTeam(c);
    const better = c.teams
      .filter((t) => !t.isPlayer && carRatingOf(t) > carRatingOf(mine))
      .sort((a, b) => carRatingOf(b) - carRatingOf(a));
    const pick = better[Math.min(better.length - 1, Math.max(0, better.length - 2))];
    if (pick) {
      dir.offers.push({ teamId: pick.id, reason: `${pick.name} veut vous confier son écurie (voiture plus rapide, attentes plus élevées).` });
      addNews(c, `Rumeur : ${pick.name} courtise le directeur de ${mine.name} !`);
    }
  }
}

function carRatingOf(t: { car: CarStats }): number {
  return t.car.moteur * 0.32 + t.car.aero * 0.34 + t.car.chassis * 0.24 + t.car.fiabilite * 0.1;
}

/** Prendre la direction d'une autre écurie (offre acceptée ou reconversion après limogeage). */
export function switchTeam(c: Career, teamId: string): string | null {
  const dir = director(c);
  if (c.weekend) return 'Impossible pendant un week-end de course.';
  if (!dir.offers.some((o) => o.teamId === teamId)) return 'Aucune offre de cette écurie.';
  const old = playerTeam(c);
  const next = teamById(c, teamId);
  old.isPlayer = false;
  next.isPlayer = true;
  c.playerTeamId = next.id;
  // les jeunes et le réserviste restent dans l'ancienne écurie
  for (const d of c.drivers) if (d.teamId === old.id && d.role && d.role !== 'titulaire') { d.teamId = null; d.contract = null; d.role = undefined; }
  c.sponsors = [];
  renewSponsors(c);
  c.projects = [];
  const lvl = Math.max(1, Math.min(5, Math.round(next.reputation / 22)));
  c.facilities = { soufflerie: lvl, simulateur: lvl, usine: lvl };
  c.staff = initialStaff({ seed: hashSeed(c.seed, next.id), budgetProfile: c.budgetProfile, difficulty: 'facile' });
  for (const r of STAFF_ROLES) c.staff[r].rating = Math.max(6, Math.min(18, Math.round(next.pitCrew + (r === 'mecanicien' ? 0 : -1))));
  applyStaffEffects(c);
  c.budget = round1(Math.max(c.budget * 0.4, 12 + next.reputation / 5));
  addLedger(c, `Budget de ${next.name} à votre arrivée`, 0, true);
  c.objective = { season: c.season, target: Math.max(1, Math.min(10, Math.round(11 - next.reputation / 9))) };
  dir.confidence = 60;
  dir.contractYears = 2;
  dir.salary = Math.round((0.5 + next.reputation / 80) * 100) / 100;
  dir.bonus = Math.round(dir.salary * 40) / 100;
  dir.renewal = undefined;
  dir.fired = false;
  dir.offers = [];
  c.rivalries = {};
  addNews(c, `Vous prenez la direction de ${next.name} ! Objectif fixé : ${c.objective.target}ᵉ au championnat constructeurs.`);
  return null;
}

/** Refuser une offre de débauchage : les actionnaires apprécient la fidélité. */
export function declineOffers(c: Career): void {
  const dir = director(c);
  if (dir.fired) return;
  if (dir.offers.length) {
    dir.confidence = Math.min(100, dir.confidence + 5);
    addNews(c, 'Vous restez fidèle à votre écurie : les actionnaires saluent votre engagement.');
  }
  dir.offers = [];
}

// ================================================================ Conférence de presse

export interface PressAnswer {
  text: string;
  morale: number; // effet sur le moral de vos pilotes
  confidence: number; // effet sur la confiance des actionnaires
  reputation: number;
  rivalry?: number; // effet sur la rivalité citée
}

export interface PressConference {
  season: number;
  round: number;
  question: string;
  answers: PressAnswer[];
  rivalKey?: string;
  answered?: number;
}

/** Question posée au directeur après le Grand Prix, selon ce qui s'est passé. */
export function makeConference(c: Career, res: RoundResult): PressConference {
  const mine = res.entries.filter((e) => e.teamId === c.playerTeamId);
  const best = mine.reduce((a, e) => (e.status === 'arrivé' && e.position < a ? e.position : a), 99);
  const base = { season: c.season, round: res.round + 1 };
  let rivalKey: string | undefined;
  let rivalLevel = 0;
  for (const d of mine) {
    const r = mainRival(c, d.driverId);
    if (r && r.level >= 45 && r.level > rivalLevel) { rivalKey = d.driverId + '|' + r.id; rivalLevel = r.level; }
  }
  if (rivalKey) {
    const [me, other] = rivalKey.split('|');
    return {
      ...base, rivalKey,
      question: `La tension monte entre ${driverById(c, me).last} et ${driverById(c, other).last}. Quelle est votre position ?`,
      answers: [
        { text: 'Mon pilote a eu raison de ne rien lâcher.', morale: 5, confidence: 0, reputation: -1, rivalry: 15 },
        { text: 'J’appelle tout le monde au calme.', morale: -2, confidence: 2, reputation: 1, rivalry: -30 },
        { text: 'Pas de commentaire.', morale: 0, confidence: 0, reputation: 0 },
      ],
    };
  }
  if (mine.length && mine.every((e) => e.status === 'abandon')) {
    return {
      ...base,
      question: 'Double abandon : votre écurie a-t-elle un problème de fiabilité ?',
      answers: [
        { text: 'Nous allons investir massivement dans l’usine.', morale: 1, confidence: 3, reputation: 0 },
        { text: 'C’est la course, ça arrive.', morale: 2, confidence: -1, reputation: 0 },
        { text: 'Nos fournisseurs doivent rendre des comptes.', morale: 0, confidence: 1, reputation: -2 },
      ],
    };
  }
  if (best <= 3) {
    return {
      ...base,
      question: 'Superbe résultat ! Peut-on désormais parler de titre ?',
      answers: [
        { text: 'Le titre, rien de moins !', morale: -2, confidence: 4, reputation: 2 },
        { text: 'On reste humbles, course après course.', morale: 3, confidence: 1, reputation: 0 },
        { text: 'Tout le mérite revient aux mécaniciens.', morale: 4, confidence: 0, reputation: 1 },
      ],
    };
  }
  if (best > 10) {
    return {
      ...base,
      question: 'Encore aucun point. Les actionnaires s’impatientent : votre poste est-il menacé ?',
      answers: [
        { text: 'J’assume, c’est ma responsabilité.', morale: 2, confidence: 2, reputation: 0 },
        { text: 'Les pilotes doivent faire beaucoup mieux.', morale: -6, confidence: 3, reputation: -1 },
        { text: 'La voiture va progresser, patience.', morale: 3, confidence: -2, reputation: 0 },
      ],
    };
  }
  return {
    ...base,
    question: 'Des points aujourd’hui. Êtes-vous satisfait ?',
    answers: [
      { text: 'Oui, l’équipe progresse.', morale: 3, confidence: 1, reputation: 0 },
      { text: 'Non, nous visons beaucoup plus haut.', morale: -2, confidence: 3, reputation: 1 },
      { text: 'Bravo à nos pilotes, ils ont été parfaits.', morale: 4, confidence: 0, reputation: 0 },
    ],
  };
}

export function answerConference(c: Career, idx: number): string | null {
  const pc = c.conference;
  if (!pc || pc.answered !== undefined) return 'Aucune question en attente.';
  const a = pc.answers[idx];
  if (!a) return 'Réponse inconnue.';
  pc.answered = idx;
  for (const d of c.drivers.filter((x) => x.teamId === c.playerTeamId)) d.morale = Math.max(5, Math.min(100, moraleOf(d) + a.morale));
  const dir = director(c);
  dir.confidence = Math.max(0, Math.min(100, dir.confidence + a.confidence));
  const t = playerTeam(c);
  t.reputation = Math.max(0, Math.min(100, t.reputation + a.reputation));
  if (pc.rivalKey && a.rivalry) {
    const riv = (c.rivalries ??= {});
    riv[pc.rivalKey] = Math.max(0, Math.min(100, (riv[pc.rivalKey] ?? 0) + a.rivalry));
  }
  const art = c.press?.[0];
  if (art && art.season === pc.season && art.round === pc.round) art.director = a.text;
  return null;
}
