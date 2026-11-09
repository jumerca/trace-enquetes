import type { Rng } from '../core/rng';
import { age as ageOf, playerOvr } from '../data/generate';
import { fullName } from '../data/model';
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
