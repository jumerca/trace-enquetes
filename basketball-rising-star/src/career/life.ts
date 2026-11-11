import type { Rng } from '../core/rng';
import { age as ageOf, playerOvr } from '../data/generate';
import { fullName, type PlayerData } from '../data/model';
import type { Career, Offer } from './career';
import { addNews, AGENTS, depthChart, perGame, teamLevel, user, userClub, userRole, rngFor } from './career';
import { salaryFor } from './world';

/** Vie hors terrain : chaque choix modifie des variables réellement utilisées par la simulation. */

export type Lifestyle = 'modest' | 'comfort' | 'star';
export const LIFESTYLES: Record<Lifestyle, { label: string; weekly: number; desc: string }> = {
  modest: { label: 'Modeste', weekly: 250, desc: 'Économies, concentration sur le basket. Moral stable.' },
  comfort: { label: 'Confortable', weekly: 900, desc: 'Bon équilibre. Moral +, coéquipiers apprécient.' },
  star: { label: 'Train de vie de star', weekly: 3500, desc: 'Médias et supporters +, mais discipline et coach méfiants.' },
};

export type StaffKey = 'trainer' | 'nutrition' | 'physio' | 'mental';
export const STAFF: Record<StaffKey, { label: string; weekly: number; desc: string }> = {
  trainer: { label: 'Préparateur individuel', weekly: 600, desc: '+18 % de progression à l’entraînement.' },
  nutrition: { label: 'Nutritionniste', weekly: 350, desc: 'Risque de blessure −25 %, récupération +.' },
  physio: { label: 'Kinésithérapeute personnel', weekly: 500, desc: 'Blessures guérissent 40 % plus vite.' },
  mental: { label: 'Préparateur mental', weekly: 400, desc: 'Confiance plus stable, gestion de la pression +.' },
};

export type ActivityKey = 'video' | 'teamDinner' | 'charity' | 'rest' | 'extraShooting' | 'interview' | 'gym';
export const ACTIVITIES: Record<ActivityKey, { label: string; desc: string }> = {
  video: { label: 'Séance vidéo personnelle', desc: 'Lecture du jeu +, confiance du coach +.' },
  teamDinner: { label: 'Dîner avec les coéquipiers', desc: 'Intégration +, capitaine +.' },
  charity: { label: 'Action caritative', desc: 'Supporters +, médias +, réputation +.' },
  rest: { label: 'Repos complet', desc: 'Fatigue −20, moral +.' },
  extraShooting: { label: 'Tirs supplémentaires', desc: 'Tir +, fatigue +10.' },
  interview: { label: 'Interview médias', desc: 'Réputation +, médias +, concentration −.' },
  gym: { label: 'Musculation', desc: 'Force et résistance +, fatigue +8.' },
};

export interface Objective {
  id: string;
  label: string;
  target: number;
  kind: 'games' | 'ppg' | 'minutes' | 'rating';
  done?: boolean;
}

export interface Life {
  money: number;
  lifestyle: Lifestyle;
  staff: Partial<Record<StaffKey, boolean>>;
  activity: ActivityKey | null;
  lastActivity: string;
  objectives: Objective[];
  loanFrom: string | null;
  transferRequest: boolean;
  requestCooldown: number;
  pendingPress: string | null; // id du match concerné
  ledger: { week: number; season: number; income: number; costs: number }[];
}

export function defaultLife(): Life {
  return { money: 5000, lifestyle: 'modest', staff: {}, activity: null, lastActivity: '', objectives: [], loanFrom: null, transferRequest: false, requestCooldown: 0, pendingPress: null, ledger: [] };
}

export function life(c: Career): Life {
  const x = c as Career & { life?: Life };
  return (x.life ??= defaultLife());
}

const clamp100 = (v: number) => Math.max(0, Math.min(100, v));

export function weeklyCosts(c: Career): number {
  const l = life(c);
  return LIFESTYLES[l.lifestyle].weekly + (Object.keys(l.staff) as StaffKey[]).filter((k) => l.staff[k]).reduce((s, k) => s + STAFF[k].weekly, 0);
}

export function weeklyIncome(c: Career): number {
  const u = user(c);
  const agent = AGENTS.find((a) => a.id === c.agentId) ?? AGENTS[0];
  return Math.round(((u.contract?.salary ?? 0) / 52) * (1 - agent.commission / 100) * 0.62); // net d'impôts et charges (approximation)
}

/** Appliqué chaque semaine par advanceWeek. */
export function weeklyLife(c: Career, rng: Rng): string[] {
  const l = life(c);
  const u = user(c);
  const notes: string[] = [];
  const income = weeklyIncome(c);
  let costs = weeklyCosts(c);
  // Staff impayable : contrats suspendus
  if (l.money + income - costs < 0) {
    for (const k of Object.keys(l.staff) as StaffKey[]) l.staff[k] = false;
    if (l.lifestyle !== 'modest') l.lifestyle = 'modest';
    costs = weeklyCosts(c);
    notes.push('Budget insuffisant : staff personnel suspendu et train de vie réduit.');
    u.morale = clamp100(u.morale - 4);
  }
  l.money += income - costs;
  l.ledger.push({ week: c.week, season: c.world.season, income, costs });
  if (l.ledger.length > 60) l.ledger.shift();
  // Train de vie
  if (l.lifestyle === 'comfort') {
    u.morale = clamp100(u.morale + 0.6);
    c.relations.teammates = clamp100(c.relations.teammates + 0.2);
  } else if (l.lifestyle === 'star') {
    u.morale = clamp100(u.morale + 1);
    c.relations.media = clamp100(c.relations.media + 0.8);
    c.relations.fans = clamp100(c.relations.fans + 0.4);
    c.relations.coach = clamp100(c.relations.coach - 0.6);
    if (rng.chance(0.05)) {
      c.trust = clamp100(c.trust - 4);
      addNews(c, 'event', `${u.lastName} aperçu en soirée`, 'Des photos circulent la veille d’un entraînement. Le coach n’apprécie pas.');
    }
  }
  // Staff personnel
  if (l.staff.nutrition) {
    u.fatigue = Math.max(0, u.fatigue - 6);
    u.injuryRisk = Math.max(0.55, u.injuryRisk * 0.995);
  }
  if (l.staff.physio && u.injuryDays > 0) u.injuryDays = Math.max(0, u.injuryDays - 3);
  if (l.staff.mental) u.confidence = Math.max(u.confidence, 45);
  c.plan.specialistCoach = !!l.staff.trainer;
  // Activité de la semaine
  if (l.activity) {
    const a = l.activity;
    const fr = (k: keyof typeof u.attrs, v: number) => {
      u.frac ??= {};
      u.frac[k] = (u.frac[k] ?? 0) + v;
    };
    switch (a) {
      case 'video':
        fr('iq', 0.25);
        fr('passReading', 0.15);
        c.trust = clamp100(c.trust + 1.2);
        break;
      case 'teamDinner':
        c.relations.teammates = clamp100(c.relations.teammates + 4);
        c.relations.captain = clamp100(c.relations.captain + 3);
        u.teamFit = clamp100(u.teamFit + 3);
        break;
      case 'charity':
        c.relations.fans = clamp100(c.relations.fans + 4);
        c.relations.media = clamp100(c.relations.media + 3);
        u.reputation = clamp100(u.reputation + 0.6);
        break;
      case 'rest':
        u.fatigue = Math.max(0, u.fatigue - 20);
        u.morale = clamp100(u.morale + 2);
        break;
      case 'extraShooting':
        fr('three', 0.22);
        fr('catchShoot', 0.15);
        u.fatigue = Math.min(100, u.fatigue + 10);
        break;
      case 'interview':
        u.reputation = clamp100(u.reputation + 0.8);
        c.relations.media = clamp100(c.relations.media + 5);
        fr('concentration', -0.1);
        break;
      case 'gym':
        fr('strength', 0.25);
        fr('durability', 0.15);
        u.fatigue = Math.min(100, u.fatigue + 8);
        break;
    }
    l.lastActivity = ACTIVITIES[a].label;
    l.activity = null;
  }
  if (l.requestCooldown > 0) l.requestCooldown--;
  return notes;
}

// ------------------------------------------------------------------ Conférence de presse
export const PRESS_ANSWERS = [
  { label: 'Mettre en avant le collectif', effect: 'Coéquipiers +5, coach +2', apply: (c: Career) => ((c.relations.teammates = clamp100(c.relations.teammates + 5)), (c.relations.coach = clamp100(c.relations.coach + 2))) },
  { label: 'Afficher ses ambitions personnelles', effect: 'Médias +6, réputation +1, coéquipiers −3', apply: (c: Career) => ((c.relations.media = clamp100(c.relations.media + 6)), (user(c).reputation = clamp100(user(c).reputation + 1)), (c.relations.teammates = clamp100(c.relations.teammates - 3))) },
  { label: 'Critiquer le temps de jeu', effect: 'Coach −8, supporters +2, moral +3', apply: (c: Career) => ((c.relations.coach = clamp100(c.relations.coach - 8)), (c.trust = clamp100(c.trust - 3)), (c.relations.fans = clamp100(c.relations.fans + 2)), (user(c).morale = clamp100(user(c).morale + 3))) },
  { label: 'Rester sobre et poli', effect: 'Aucun risque, médias −1', apply: (c: Career) => (c.relations.media = clamp100(c.relations.media - 1)) },
];

export function answerPress(c: Career, i: number): string {
  const a = PRESS_ANSWERS[i];
  a.apply(c);
  life(c).pendingPress = null;
  addNews(c, 'event', `Conférence de presse : ${user(c).lastName}`, `Réponse : « ${a.label} ». (${a.effect})`);
  return a.effect;
}

// ------------------------------------------------------------------ Demandes au staff
export type Request = 'minutes' | 'loan' | 'transfer' | 'stay';

export function canLoan(c: Career): boolean {
  const u = user(c);
  return c.phase === 'regular' && c.week <= 14 && !life(c).loanFrom && ageOf(u, c.world.season) <= 23 && userRole(c).rank >= 8 && c.world.leagues[userClub(c).leagueId]?.level === 1;
}

/** Résultat d'une demande, calculé à partir du niveau réel, de la confiance et des relations. */
export function makeRequest(c: Career, kind: Request): { ok: boolean; text: string } {
  const l = life(c);
  const u = user(c);
  const club = userClub(c);
  const rng = rngFor(c, `req${kind}`);
  if (l.requestCooldown > 0 && kind !== 'stay') return { ok: false, text: `Le staff vous a déjà reçu récemment. Revenez dans ${l.requestCooldown} semaine(s).` };
  l.requestCooldown = 3;
  if (kind === 'minutes') {
    const dc = depthChart(c, club.id);
    const rank = dc.order.findIndex((p) => p.id === u.id);
    const above = dc.order[Math.max(0, rank - 1)];
    const gap = above ? playerOvr(above) - playerOvr(u) : 0;
    const chance = 0.25 + (c.relations.coach - 50) / 150 + (u.form - 0.5) * 0.4 - gap * 0.06;
    if (rng.chance(Math.max(0.05, Math.min(0.85, chance)))) {
      c.trust = Math.min(100, c.trust + 10);
      return { ok: true, text: `${club.coach.name} accepte de vous donner votre chance. Confiance du coach +10.` };
    }
    c.relations.coach = clamp100(c.relations.coach - 5);
    return { ok: false, text: `${club.coach.name} refuse : « ${gap > 3 ? `${above.lastName} est devant toi pour l’instant.` : 'Montre-le-moi à l’entraînement.'} » Relation avec le coach −5.` };
  }
  if (kind === 'loan') {
    if (!canLoan(c)) return { ok: false, text: 'Un prêt n’est possible que pour un jeune peu utilisé d’un club d’élite, avant la 15e journée.' };
    const target = Object.values(c.world.clubs)
      .filter((cl) => cl.leagueId === 'FRA2' || (cl.leagueId !== club.leagueId && c.world.leagues[cl.leagueId]?.level === 2))
      .sort((a, b) => Math.abs(teamLevel(c, a.id) - playerOvr(u)) - Math.abs(teamLevel(c, b.id) - playerOvr(u)))[0];
    if (!target) return { ok: false, text: 'Aucun club n’a de place pour vous.' };
    l.loanFrom = club.id;
    club.roster = club.roster.filter((id) => id !== u.id);
    target.roster.push(u.id);
    u.clubId = target.id;
    c.trust = 55;
    addNews(c, 'transfer', `${fullName(u)} prêté à ${target.name}`, `Prêt jusqu’à la fin de la saison pour accumuler du temps de jeu. Retour prévu à ${club.name}.`);
    return { ok: true, text: `Prêt accepté : vous rejoignez ${target.name} jusqu’à la fin de la saison.` };
  }
  if (kind === 'transfer') {
    l.transferRequest = true;
    c.relations.board = clamp100(c.relations.board - 8);
    c.relations.coach = clamp100(c.relations.coach - 4);
    addNews(c, 'rumor', `${u.lastName} demande à partir`, `Le joueur a signifié aux dirigeants de ${club.name} son souhait de changer d’air. Les clubs intéressés sont prévenus.`);
    return { ok: true, text: 'Vous êtes placé sur la liste des transferts : plus d’offres au mercato, mais relations avec le club en baisse.' };
  }
  l.transferRequest = false;
  c.relations.board = clamp100(c.relations.board + 4);
  return { ok: true, text: 'Vous retirez votre demande de départ. Les dirigeants apprécient.' };
}

/** Fin de prêt : retour au club d'origine. */
export function endLoan(c: Career): void {
  const l = life(c);
  if (!l.loanFrom) return;
  const u = user(c);
  const cur = userClub(c);
  const home = c.world.clubs[l.loanFrom];
  cur.roster = cur.roster.filter((id) => id !== u.id);
  if (home) {
    home.roster.push(u.id);
    u.clubId = home.id;
    addNews(c, 'transfer', `Retour de prêt pour ${fullName(u)}`, `${u.lastName} retrouve ${home.name} après une saison à ${cur.name}.`);
  }
  l.loanFrom = null;
}

// ------------------------------------------------------------------ Mercato d'hiver
export const WINTER_WINDOW = [11, 12];
export function winterOpen(c: Career): boolean {
  return c.phase === 'regular' && c.week >= WINTER_WINDOW[0] && c.week <= WINTER_WINDOW[1] && !life(c).loanFrom;
}

export function winterOffers(c: Career): void {
  const u = user(c);
  const l = life(c);
  const pg = perGame(c.seasonStats[u.id]);
  const rng = rngFor(c, 'winter');
  const interest = (l.transferRequest ? 0.6 : 0.15) + (pg.ppg > 12 ? 0.25 : 0) + u.reputation / 300;
  if (!rng.chance(Math.min(0.9, interest))) return;
  const ovr = playerOvr(u);
  const clubs = Object.values(c.world.clubs).filter((cl) => cl.id !== u.clubId && c.world.leagues[cl.leagueId] && c.world.leagues[cl.leagueId].id !== 'NCB' && Math.abs(teamLevel(c, cl.id) - ovr) < 6);
  const picks = rng.shuffle(clubs).slice(0, l.transferRequest ? 3 : 1);
  c.offers = picks.map<Offer>((cl) => ({ id: `w${cl.id}${c.world.season}`, clubId: cl.id, salary: salaryFor(ovr, c.world.leagues[cl.leagueId].level), years: 2, role: ovr - teamLevel(c, cl.id) > 2 ? 'starter' : 'rotation', note: `Mercato d’hiver · ${c.world.leagues[cl.leagueId].name}` }));
  if (c.offers.length) addNews(c, 'transfer', 'Mercato d’hiver : des clubs se manifestent', `${c.offers.length} offre(s) reçue(s) pour ${fullName(u)}. Décision avant la fin de la ${WINTER_WINDOW[1]}e semaine.`);
}

// ------------------------------------------------------------------ Objectifs de saison
export function setObjectives(c: Career): void {
  const role = userRole(c);
  const l = life(c);
  const starter = role.rank < 5;
  l.objectives = [
    { id: 'games', label: starter ? 'Disputer au moins 18 matchs de championnat' : 'Disputer au moins 10 matchs de championnat', target: starter ? 18 : 10, kind: 'games' },
    { id: 'minutes', label: `Jouer en moyenne ${starter ? 24 : role.rank < 9 ? 14 : 6} minutes`, target: starter ? 24 : role.rank < 9 ? 14 : 6, kind: 'minutes' },
    { id: 'rating', label: 'Note moyenne ≥ 6,0 sur les matchs joués', target: 6, kind: 'rating' },
  ];
  if (starter) l.objectives.push({ id: 'ppg', label: 'Marquer 10 points par match', target: 10, kind: 'ppg' });
}

export function objectiveProgress(c: Career, o: Objective): number {
  const u = user(c);
  const pg = perGame(c.seasonStats[u.id]);
  if (o.kind === 'games') return pg.gp;
  if (o.kind === 'minutes') return pg.mpg;
  if (o.kind === 'ppg') return pg.ppg;
  const lines = c.world.fixtures.filter((f) => f.userLine && f.userLine.min > 0 && c.world.leagues[f.leagueId]).map((f) => f.userLine!.rating);
  return lines.length ? lines.reduce((s, r) => s + r, 0) / lines.length : 0;
}

/** Bilan des objectifs en fin de saison : effets sur la confiance et la réputation. */
export function reviewObjectives(c: Career): string {
  const l = life(c);
  const u = user(c);
  let done = 0;
  for (const o of l.objectives) {
    o.done = objectiveProgress(c, o) >= o.target;
    if (o.done) done++;
  }
  const n = l.objectives.length || 1;
  c.trust = clamp100(c.trust + (done / n - 0.5) * 16);
  u.reputation = clamp100(u.reputation + done);
  u.morale = clamp100(u.morale + (done / n - 0.5) * 12);
  return `${done}/${n} objectif(s) atteint(s)`;
}

export { userRole };

// ================================================================== Extensions de la vie de joueur
export interface Sponsor {
  id: string;
  brand: string;
  sector: string;
  weekly: number;
  until: number; // saison de fin incluse
  minRep: number;
}

const BRANDS: Omit<Sponsor, 'until'>[] = [
  { id: 'sp1', brand: 'Vantage Sportswear', sector: 'Équipementier', weekly: 300, minRep: 20 },
  { id: 'sp2', brand: 'Hydra Boisson isotonique', sector: 'Boisson', weekly: 450, minRep: 30 },
  { id: 'sp3', brand: 'Kinetik Chaussures', sector: 'Chaussures', weekly: 900, minRep: 45 },
  { id: 'sp4', brand: 'Orbis Montres', sector: 'Horlogerie', weekly: 1600, minRep: 60 },
  { id: 'sp5', brand: 'Nova Mobile', sector: 'Téléphonie', weekly: 2800, minRep: 75 },
  { id: 'sp6', brand: 'Altiva Automobiles', sector: 'Automobile', weekly: 4500, minRep: 88 },
];

export interface LifeExtra {
  sponsors: Sponsor[];
  sponsorOffers: Sponsor[];
  followers: number;
  mentorId: string | null;
  injuryPlan: 'full' | 'fast' | 'specialist' | null;
  campChoice: CampId | null;
  history: { season: number; league: string; champion: string; mvp: string; userTeam: boolean }[];
  rivalNote: string;
  shots?: { u: number; v: number; made: boolean; type: string; season: number }[];
  injuries?: { season: number; week: number; days: number; cause: string }[];
  attrSnap?: { season: number; attrs: Record<string, number> };
  wellness?: { season: number; week: number; fatigue: number; morale: number; confidence: number }[];
}

export function extra(c: Career): LifeExtra {
  const l = life(c) as Life & { extra?: LifeExtra };
  l.extra ??= { sponsors: [], sponsorOffers: [], followers: 300, mentorId: null, injuryPlan: null, campChoice: null, history: [], rivalNote: '' };
  return l.extra;
}

/** Abonnés sur les réseaux : réputation, relation avec les médias et résultats. */
export function updateFollowers(c: Career): void {
  const x = extra(c);
  const u = user(c);
  const target = 200 + Math.pow(u.reputation, 2.4) * 3 + c.relations.media * 60 + c.relations.fans * 40;
  x.followers = Math.round(x.followers + (target - x.followers) * 0.08);
}

export function sponsorIncome(c: Career): number {
  return extra(c).sponsors.reduce((s, sp) => s + sp.weekly, 0);
}

export function sponsorWeek(c: Career, rng: Rng): void {
  const x = extra(c);
  const u = user(c);
  x.sponsors = x.sponsors.filter((s) => s.until >= c.world.season);
  life(c).money += sponsorIncome(c);
  // Obligations : une journée promotionnelle par mois (fatigue)
  if (x.sponsors.length && c.week % 4 === 0) u.fatigue = Math.min(100, u.fatigue + 3 * x.sponsors.length);
  if (c.week % 6 === 3 && x.sponsorOffers.length < 2) {
    const have = new Set([...x.sponsors, ...x.sponsorOffers].map((s) => s.id));
    const cand = BRANDS.filter((b) => !have.has(b.id) && u.reputation + x.followers / 4000 >= b.minRep);
    if (cand.length && rng.chance(0.6)) {
      const b = cand[cand.length - 1];
      x.sponsorOffers.push({ ...b, weekly: Math.round(b.weekly * (0.85 + x.followers / 200000)), until: c.world.season + 1 });
      addNews(c, 'event', `Proposition de partenariat : ${b.brand}`, `La marque (${b.sector.toLowerCase()}) propose un contrat d’image jusqu’en ${c.world.season + 2}.`);
    }
  }
}

export function acceptSponsor(c: Career, id: string, accept: boolean): void {
  const x = extra(c);
  const sp = x.sponsorOffers.find((s) => s.id === id);
  x.sponsorOffers = x.sponsorOffers.filter((s) => s.id !== id);
  if (sp && accept) {
    x.sponsors.push(sp);
    c.relations.media = clamp100(c.relations.media + 3);
    addNews(c, 'event', `${user(c).lastName} s’associe à ${sp.brand}`, `Contrat d’image signé (${sp.weekly} €/semaine).`);
  }
}

// ------------------------------------------------------------------ Négociation
/** Contre-proposition à une offre : plus de salaire ou un rôle plus important. Peut faire échouer l'offre. */
export function negotiate(c: Career, offerId: string, ask: 'salary' | 'role'): { ok: boolean; text: string } {
  const o = c.offers.find((x) => x.id === offerId);
  if (!o) return { ok: false, text: 'Offre introuvable.' };
  if ((o as Offer & { negotiated?: boolean }).negotiated) return { ok: false, text: 'Le club a déjà fait son dernier effort.' };
  const agent = AGENTS.find((a) => a.id === c.agentId) ?? AGENTS[0];
  const rng = rngFor(c, `neg${offerId}${ask}`);
  const u = user(c);
  const club = c.world.clubs[o.clubId];
  const need = teamLevel(c, club.id) <= playerOvr(u) ? 0.15 : 0;
  const p = 0.3 + agent.negotiation / 40 + need + (u.reputation - club.reputation) / 200;
  (o as Offer & { negotiated?: boolean }).negotiated = true;
  if (rng.chance(Math.max(0.08, Math.min(0.85, p)))) {
    if (ask === 'salary') {
      o.salary = Math.round((o.salary * 1.15) / 1000) * 1000;
      return { ok: true, text: `${club.name} accepte : salaire porté à ${Math.round(o.salary / 1000)} k€/an.` };
    }
    const order: Offer['role'][] = ['prospect', 'rotation', 'starter', 'star'];
    o.role = order[Math.min(3, order.indexOf(o.role) + 1)];
    return { ok: true, text: `${club.name} accepte de vous promettre un rôle plus important.` };
  }
  if (rng.chance(0.4)) {
    c.offers = c.offers.filter((x) => x.id !== offerId);
    return { ok: false, text: `${club.name} se retire des discussions.` };
  }
  return { ok: false, text: `${club.name} refuse mais maintient son offre initiale.` };
}

// ------------------------------------------------------------------ Blessures
export const INJURY_PLANS = {
  full: { label: 'Rééducation complète', desc: 'Durée normale, aucun risque supplémentaire.' },
  fast: { label: 'Retour accéléré', desc: 'Durée −40 %, mais risque de rechute et fragilité accrue.' },
  specialist: { label: 'Clinique spécialisée (6 000 €)', desc: 'Durée −25 %, sans risque, payé sur votre épargne.' },
} as const;

export function chooseInjuryPlan(c: Career, plan: keyof typeof INJURY_PLANS): string {
  const u = user(c);
  const x = extra(c);
  if (u.injuryDays <= 0 || x.injuryPlan) return 'Aucune décision à prendre.';
  x.injuryPlan = plan;
  if (plan === 'fast') {
    u.injuryDays = Math.ceil(u.injuryDays * 0.6);
    u.injuryRisk *= 1.15;
    c.relations.medical = clamp100(c.relations.medical - 6);
    c.trust = clamp100(c.trust + 2);
  } else if (plan === 'specialist') {
    if (life(c).money < 6000) {
      x.injuryPlan = null;
      return 'Épargne insuffisante pour la clinique spécialisée.';
    }
    life(c).money -= 6000;
    u.injuryDays = Math.ceil(u.injuryDays * 0.75);
    c.relations.medical = clamp100(c.relations.medical + 4);
  } else c.relations.medical = clamp100(c.relations.medical + 3);
  return `${INJURY_PLANS[plan].label} : retour estimé dans ${Math.ceil(u.injuryDays / 7)} semaine(s).`;
}

/** Rechute possible après un retour accéléré. */
export function injuryWeek(c: Career, rng: Rng): void {
  const u = user(c);
  const x = extra(c);
  if (u.injuryDays <= 0 && x.injuryPlan) {
    if (x.injuryPlan === 'fast' && rng.chance(0.18)) {
      u.injuryDays = rng.int(7, 21);
      addNews(c, 'injury', `Rechute pour ${u.lastName}`, 'Le retour précipité n’a pas tenu : nouvelle indisponibilité.');
    }
    x.injuryPlan = null;
  }
}

// ------------------------------------------------------------------ Mentor
export function mentorCandidates(c: Career): PlayerData[] {
  const u = user(c);
  return userClub(c)
    .roster.map((id) => c.world.players[id])
    .filter((p) => p && !p.isUser && ageOf(p, c.world.season) >= 27 && (p.pos === u.pos || p.pos === u.pos2 || p.pos2 === u.pos));
}

export function mentorWeek(c: Career): string | null {
  const x = extra(c);
  const u = user(c);
  if (!x.mentorId) return null;
  const m = c.world.players[x.mentorId];
  if (!m || m.clubId !== u.clubId) {
    x.mentorId = null;
    return null;
  }
  // Le mentor transmet ses deux meilleurs points forts où il dépasse le joueur
  const keys = (Object.keys(m.attrs) as (keyof typeof m.attrs)[]).filter((k) => m.attrs[k] > u.attrs[k] + 1).sort((a, b) => m.attrs[b] - u.attrs[b] - (m.attrs[a] - u.attrs[a]));
  u.frac ??= {};
  for (const k of keys.slice(0, 2)) u.frac[k] = (u.frac[k] ?? 0) + 0.08 * (m.attrs.leadership / 14);
  c.relations.captain = clamp100(c.relations.captain + 0.3);
  return keys.slice(0, 2).join(',');
}

// ------------------------------------------------------------------ Stage d'été
export type CampId = 'shooting' | 'athletic' | 'iq' | 'big';
export const CAMPS: Record<CampId, { label: string; cost: number; desc: string; gains: Partial<Record<keyof PlayerData['attrs'], number>> }> = {
  shooting: { label: 'Stage de tir (Californie)', cost: 8000, desc: '3 pts +1, sortie d’écran +1, lancers +1', gains: { three: 1, catchShoot: 1, freeThrow: 1 } },
  athletic: { label: 'Préparation athlétique', cost: 6000, desc: 'Détente +1, explosivité +1, endurance +1', gains: { vertical: 1, explosiveness: 1, stamina: 1 } },
  iq: { label: 'Camp de lecture du jeu', cost: 4000, desc: 'Intelligence +1, vision +1, défense collective +1', gains: { iq: 1, vision: 1, teamD: 1 } },
  big: { label: 'Camp des intérieurs', cost: 6000, desc: 'Jeu au poste +1, pied de pivot +1, rebond +1', gains: { postPlay: 1, footwork: 1, defRebound: 1 } },
};

export function chooseCamp(c: Career, id: CampId | null): string {
  const x = extra(c);
  if (id && life(c).money < CAMPS[id].cost) return 'Épargne insuffisante pour ce stage.';
  x.campChoice = id;
  return id ? `${CAMPS[id].label} réservé : effets appliqués au début de la saison.` : 'Aucun stage cet été.';
}

export function applyCamp(c: Career): void {
  const x = extra(c);
  if (!x.campChoice) return;
  const camp = CAMPS[x.campChoice];
  const u = user(c);
  life(c).money -= camp.cost;
  for (const [k, v] of Object.entries(camp.gains)) u.attrs[k as keyof typeof u.attrs] = Math.min(20, u.attrs[k as keyof typeof u.attrs] + (v ?? 0));
  addNews(c, 'training', `${u.lastName} de retour de stage`, `${camp.label} : ${camp.desc}.`);
  x.campChoice = null;
}

// ------------------------------------------------------------------ Concurrent direct
export function rival(c: Career): PlayerData | null {
  const u = user(c);
  const dc = depthChart(c, u.clubId!);
  const same = dc.order.filter((p) => !p.isUser && (p.pos === u.pos || p.pos2 === u.pos));
  const idx = dc.order.findIndex((p) => p.isUser);
  return same.find((p) => dc.order.indexOf(p) < idx) ?? same[0] ?? null;
}

// ------------------------------------------------------------------ Histoire du championnat
export function recordHistory(c: Career, league: string, champion: string, mvp: string, userTeam: boolean): void {
  const x = extra(c);
  x.history.unshift({ season: c.world.season, league, champion, mvp, userTeam });
  if (x.history.length > 200) x.history.length = 200;
}

/** Score d'héritage : palmarès, statistiques et longévité. */
export function legacyScore(c: Career): number {
  const u = user(c);
  const tot = u.history.reduce((a, h) => ({ gp: a.gp + h.gp, pts: a.pts + h.pts }), { gp: 0, pts: 0 });
  const team = c.trophies.filter((t) => t.kind === 'team').length;
  const ind = c.trophies.filter((t) => t.kind === 'individual').length;
  return Math.round(tot.gp * 0.4 + tot.pts * 0.05 + team * 40 + ind * 25 + c.nationalCaps * 3 + u.reputation * 2);
}

// ================================================================== Intérêt des clubs, messagerie, rapports
export interface Message {
  id: string;
  season: number;
  week: number;
  from: string;
  kind: 'coach' | 'agent' | 'board' | 'media' | 'medical' | 'club' | 'scout';
  subject: string;
  body: string;
  read: boolean;
  actions?: { label: string; effect: string; code: string }[];
  done?: string;
}

export interface Desk {
  interest: Record<string, number>;
  inbox: Message[];
  focusAttr: keyof PlayerData['attrs'] | null;
  reports: { season: number; week: number; grade: string; note: string }[];
}

export function desk(c: Career): Desk {
  const l = life(c) as Life & { desk?: Desk };
  l.desk ??= { interest: {}, inbox: [], focusAttr: null, reports: [] };
  return l.desk;
}

let msgN = 0;
export function sendMessage(c: Career, m: Omit<Message, 'id' | 'season' | 'week' | 'read'>): void {
  const d = desk(c);
  msgN++;
  d.inbox.unshift({ ...m, id: `m${c.world.season}${c.week}${msgN}${Math.floor(Math.random() * 1e6)}`, season: c.world.season, week: c.week, read: false });
  if (d.inbox.length > 150) d.inbox.length = 150;
}

export function unread(c: Career): number {
  return desk(c).inbox.filter((m) => !m.read).length;
}

/** Intérêt des clubs : performances réelles, réputation, besoins à votre poste et niveau. */
export function updateInterest(c: Career, rng: Rng): void {
  const d = desk(c);
  const u = user(c);
  const ovr = playerOvr(u);
  const last = c.world.fixtures.filter((f) => f.userLine && f.userLine.min > 0 && f.week === c.week).map((f) => f.userLine!.rating);
  const perf = last.length ? last.reduce((s, r) => s + r, 0) / last.length : 0;
  for (const cl of Object.values(c.world.clubs)) {
    if (cl.id === u.clubId || !c.world.leagues[cl.leagueId]) continue;
    const lvl = teamLevel(c, cl.id);
    const fit = 1 - Math.min(1, Math.abs(ovr + 2 - lvl) / 10);
    const need = cl.roster.filter((id) => c.world.players[id]?.pos === u.pos).length <= 2 ? 6 : 0;
    const cur = d.interest[cl.id] ?? 0;
    const gain = fit * (perf ? (perf - 5.5) * 3 : 0) + fit * u.reputation / 40 + need * fit;
    const next = Math.max(0, Math.min(100, cur * 0.93 + gain + rng.normal(0, 1)));
    if (next >= 1) d.interest[cl.id] = Math.round(next * 10) / 10;
    else delete d.interest[cl.id];
    if (cur < 60 && next >= 60) {
      sendMessage(c, { from: 'Votre agent', kind: 'agent', subject: `${cl.name} vous suit de près`, body: `Le recruteur de ${cl.name} (${c.world.leagues[cl.leagueId].name}) a assisté à vos derniers matchs. Leur intérêt est sérieux : une offre est possible au prochain mercato.` });
      addNews(c, 'rumor', `${cl.name} sur la piste de ${u.lastName}`, `Les dirigeants de ${cl.name} apprécient le profil de ${fullName(u)}.`);
    }
  }
}

export function topInterest(c: Career, n = 6): { clubId: string; v: number }[] {
  return Object.entries(desk(c).interest)
    .map(([clubId, v]) => ({ clubId, v }))
    .sort((a, b) => b.v - a.v)
    .slice(0, n);
}

/** Rapport d'entraînement hebdomadaire du coach (note A à E) : effet sur la confiance du coach. */
export function trainingReport(c: Career, rng: Rng, changed: string[]): void {
  const d = desk(c);
  const u = user(c);
  const work = (u.attrs.discipline + u.attrs.determination + u.attrs.concentration) / 3;
  const score = work / 20 - u.fatigue / 220 + (c.plan.intensity === 'intense' ? 0.08 : c.plan.intensity === 'light' ? -0.06 : 0) + rng.normal(0, 0.12) + changed.length * 0.05;
  const grade = score > 0.72 ? 'A' : score > 0.58 ? 'B' : score > 0.44 ? 'C' : score > 0.3 ? 'D' : 'E';
  const effect = { A: 2.5, B: 1, C: 0, D: -1.5, E: -3 }[grade]!;
  c.trust = Math.max(0, Math.min(100, c.trust + effect));
  const notes: Record<string, string[]> = {
    A: ['Semaine remarquable, tu tires tout le groupe vers le haut.', 'Intensité et concentration exemplaires.'],
    B: ['Bon travail, continue comme ça.', 'Sérieux et appliqué, rien à redire.'],
    C: ['Semaine correcte, sans plus.', 'Je veux voir un peu plus d’envie.'],
    D: ['Trop d’erreurs de concentration cette semaine.', 'Tu as semblé fatigué et peu impliqué.'],
    E: ['Inacceptable. Ce n’est pas le niveau attendu.', 'Ton attitude à l’entraînement me pose problème.'],
  };
  const note = rng.pick(notes[grade]);
  d.reports.unshift({ season: c.world.season, week: c.week, grade, note });
  if (d.reports.length > 40) d.reports.length = 40;
  if (grade === 'A' || grade === 'D' || grade === 'E' || c.week % 4 === 0)
    sendMessage(c, { from: userClub(c).coach.name, kind: 'coach', subject: `Rapport d'entraînement : note ${grade}`, body: `${note}${changed.length ? ` Progrès constatés : ${changed.join(', ')}.` : ''} (Confiance du coach ${effect >= 0 ? '+' : ''}${effect})` });
}

/** Travail ciblé d'un attribut au choix, en plus du programme (petite charge supplémentaire). */
export function focusWork(c: Career): void {
  const d = desk(c);
  const u = user(c);
  if (!d.focusAttr || u.injuryDays > 0) return;
  u.frac ??= {};
  const cur = u.attrs[d.focusAttr];
  u.frac[d.focusAttr] = (u.frac[d.focusAttr] ?? 0) + (cur >= 17 ? 0.04 : 0.11);
  u.fatigue = Math.min(100, u.fatigue + 2);
}

/** Messages ponctuels : demandes d'interview, direction, staff médical, agent. */
export function weeklyMessages(c: Career, rng: Rng): void {
  const u = user(c);
  const club = userClub(c);
  if (c.week % 5 === 2 && rng.chance(0.6)) {
    const outlet = rng.pick(['Basket Hebdo', 'Le Parquet', 'Radio Sport Info', 'Courtside TV', 'Dunk Magazine']);
    sendMessage(c, {
      from: outlet,
      kind: 'media',
      subject: 'Demande d’interview',
      body: `${outlet} aimerait vous interroger sur votre saison et vos ambitions. Que décidez-vous ?`,
      actions: [
        { label: 'Interview longue et sincère', effect: 'Médias +8, abonnés +, fatigue +4', code: 'media_long' },
        { label: 'Quelques mots rapides', effect: 'Médias +3', code: 'media_short' },
        { label: 'Refuser', effect: 'Médias −4, concentration préservée', code: 'media_no' },
      ],
    });
  }
  if (c.week === 11 && c.phase === 'regular') {
    sendMessage(c, { from: 'Direction du club', kind: 'board', subject: 'Point de mi-saison', body: `La direction de ${club.name} fait le point : confiance du coach ${Math.round(c.trust)}/100, relation avec la direction ${Math.round(c.relations.board)}/100. ${c.trust > 60 ? 'Vous faites partie des plans du club.' : 'Le club attend davantage de vous en deuxième partie de saison.'}` });
  }
  if (u.contract && u.contract.until === c.world.season && c.week === 16) {
    sendMessage(c, {
      from: 'Votre agent',
      kind: 'agent',
      subject: 'Votre contrat expire en fin de saison',
      body: `Votre contrat avec ${club.name} se termine cet été. ${topInterest(c, 3).length ? `Clubs intéressés : ${topInterest(c, 3).map((i) => c.world.clubs[i.clubId].name).join(', ')}.` : 'Peu de clubs se sont manifestés pour l’instant.'} Souhaitez-vous ouvrir des discussions de prolongation ?`,
      actions: [
        { label: 'Ouvrir les discussions de prolongation', effect: 'Direction +6, prolongation plus probable', code: 'extend_yes' },
        { label: 'Attendre les offres de l’été', effect: 'Direction −3, marché ouvert', code: 'extend_wait' },
      ],
    });
  }
  if (u.fatigue > 75 && rng.chance(0.5)) sendMessage(c, { from: 'Staff médical', kind: 'medical', subject: 'Alerte fatigue', body: `Votre niveau de fatigue (${Math.round(u.fatigue)}/100) augmente fortement le risque de blessure. Nous recommandons une semaine de récupération.` });
}

export function resolveMessage(c: Career, id: string, i: number): string {
  const d = desk(c);
  const m = d.inbox.find((x) => x.id === id);
  if (!m || !m.actions || m.done) return '';
  const a = m.actions[i];
  const u = user(c);
  const x = extra(c);
  switch (a.code) {
    case 'media_long':
      c.relations.media = clamp100(c.relations.media + 8);
      x.followers = Math.round(x.followers * 1.06 + 200);
      u.fatigue = Math.min(100, u.fatigue + 4);
      break;
    case 'media_short':
      c.relations.media = clamp100(c.relations.media + 3);
      break;
    case 'media_no':
      c.relations.media = clamp100(c.relations.media - 4);
      break;
    case 'extend_yes':
      c.relations.board = clamp100(c.relations.board + 6);
      c.trust = clamp100(c.trust + 3);
      break;
    case 'extend_wait':
      c.relations.board = clamp100(c.relations.board - 3);
      break;
  }
  m.done = a.label;
  m.read = true;
  return a.effect;
}
