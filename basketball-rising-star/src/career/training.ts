import { Rng } from '../core/rng';
import { ARCHETYPES, OVR_WEIGHTS, type AttrKey } from '../data/attributes';
import { playerOvr } from '../data/generate';
import type { PlayerData } from '../data/model';

export type ProgramId =
  | 'shootingOut'
  | 'shootingIn'
  | 'dribble'
  | 'passing'
  | 'defense'
  | 'rebound'
  | 'explosive'
  | 'endurance'
  | 'vertical'
  | 'mental'
  | 'reading'
  | 'recovery';

export const PROGRAMS: Record<ProgramId, { label: string; desc: string; attrs: AttrKey[]; load: number }> = {
  shootingOut: { label: 'Tir extérieur', desc: 'Répétitions à 3 points, sorties d’écran, tirs après dribble.', attrs: ['three', 'catchShoot', 'pullUp', 'midRange', 'freeThrow'], load: 0.9 },
  shootingIn: { label: 'Tir intérieur', desc: 'Finition, lay-ups des deux mains, jeu au poste.', attrs: ['finishing', 'layup', 'postPlay', 'footwork', 'dunk'], load: 1.0 },
  dribble: { label: 'Dribble', desc: 'Maniement, changements de rythme, protection de balle.', attrs: ['dribble', 'ballSecurity', 'ballControl', 'shotCreation'], load: 0.9 },
  passing: { label: 'Passe', desc: 'Lecture des aides, passes en mouvement, vision.', attrs: ['passing', 'vision', 'ballControl'], load: 0.7 },
  defense: { label: 'Défense', desc: 'Déplacements défensifs, aides, pick-and-roll.', attrs: ['perimeterD', 'teamD', 'pnrD', 'steal', 'positioning'], load: 1.1 },
  rebound: { label: 'Rebond', desc: 'Box-out, placement, timing du saut.', attrs: ['defRebound', 'positioning', 'strength', 'block'], load: 1.1 },
  explosive: { label: 'Explosivité', desc: 'Pliométrie, premiers pas, accélérations.', attrs: ['explosiveness', 'acceleration', 'speed', 'agility'], load: 1.3 },
  endurance: { label: 'Endurance', desc: 'Capacité aérobie, répétitions de sprints.', attrs: ['stamina', 'durability', 'balance'], load: 1.2 },
  vertical: { label: 'Détente', desc: 'Travail de saut, gainage, réception.', attrs: ['vertical', 'explosiveness', 'balance'], load: 1.3 },
  mental: { label: 'Mental', desc: 'Préparation mentale, gestion de la pression.', attrs: ['composure', 'pressure', 'concentration', 'consistency'], load: 0.3 },
  reading: { label: 'Lecture du jeu', desc: 'Vidéo, situations tactiques, jeu sans ballon.', attrs: ['iq', 'offBall', 'screenUse', 'passReading', 'teamwork'], load: 0.4 },
  recovery: { label: 'Récupération', desc: 'Soins, sommeil, prévention. Réduit la fatigue.', attrs: [], load: -1.2 },
};

export type Intensity = 'light' | 'normal' | 'intense';
export const INTENSITY: Record<Intensity, { label: string; mul: number; fatigue: number }> = {
  light: { label: 'Légère', mul: 0.55, fatigue: 6 },
  normal: { label: 'Normale', mul: 1, fatigue: 14 },
  intense: { label: 'Intense', mul: 1.45, fatigue: 26 },
};

export type TrainingMode = 'manual' | 'auto-weakness' | 'auto-objectives';

export interface TrainingPlan {
  mode: TrainingMode;
  program: ProgramId;
  intensity: Intensity;
  specialistCoach: boolean;
}

/** Programme automatique : cible les points faibles par rapport au profil. */
export function autoProgram(p: PlayerData, mode: TrainingMode, nextOpponentStyle?: 'big' | 'shooting' | 'fast'): ProgramId {
  if (p.fatigue > 70) return 'recovery';
  if (mode === 'auto-objectives' && nextOpponentStyle) {
    if (nextOpponentStyle === 'big') return p.pos === 'C' || p.pos === 'PF' ? 'rebound' : 'shootingIn';
    if (nextOpponentStyle === 'shooting') return 'defense';
    return 'endurance';
  }
  // Faiblesses qui comptent pour le poste : importance de l'attribut × marge de progression
  const arch = ARCHETYPES[p.archetype];
  const w = OVR_WEIGHTS[p.pos];
  let best: ProgramId = 'shootingOut';
  let bestScore = -1;
  for (const [id, prog] of Object.entries(PROGRAMS) as [ProgramId, (typeof PROGRAMS)[ProgramId]][]) {
    if (!prog.attrs.length) continue;
    let score = 0;
    for (const a of prog.attrs) score += ((w[a] ?? 0.3) + (arch.growth.includes(a) ? 1 : 0)) * Math.max(0, 19 - p.attrs[a]);
    score /= prog.attrs.length;
    if (score > bestScore) {
      bestScore = score;
      best = id;
    }
  }
  return best;
}

export interface TrainingResult {
  gains: Partial<Record<AttrKey, number>>;
  fatigue: number;
  injured: number; // jours
  note: string;
}

/**
 * Une semaine d'entraînement. La progression dépend de l'âge, de l'écart au potentiel,
 * de l'entraîneur (développement), des infrastructures, de l'intensité et de la fatigue.
 * Le potentiel n'est jamais garanti : un joueur peut stagner.
 */
export function trainWeek(p: PlayerData, plan: TrainingPlan, coachDev: number, facilities: number, minutesLastGame: number, age: number, rng: Rng): TrainingResult {
  const program = plan.mode === 'manual' ? plan.program : autoProgram(p, plan.mode);
  const prog = PROGRAMS[program];
  const inten = INTENSITY[plan.intensity];
  const res: TrainingResult = { gains: {}, fatigue: 0, injured: 0, note: '' };
  if (p.injuryDays > 0) {
    res.note = 'Blessé : soins uniquement';
    res.fatigue = -20;
    return res;
  }
  if (program === 'recovery') {
    res.fatigue = -28 * (plan.intensity === 'light' ? 1.2 : 1);
    res.note = 'Récupération : fatigue réduite';
    return res;
  }
  const ovr = playerOvr(p);
  const gap = Math.max(0, p.potential - ovr) / 30; // 0..1+
  const ageF = age <= 19 ? 1.25 : age <= 22 ? 1.05 : age <= 26 ? 0.7 : age <= 29 ? 0.35 : age <= 32 ? 0.1 : -0.15;
  const staff = 0.75 + coachDev / 40 + facilities / 80 + (plan.specialistCoach ? 0.18 : 0);
  const tired = p.fatigue > 60 ? 0.55 : p.fatigue > 40 ? 0.85 : 1;
  const work = (p.attrs.determination + p.attrs.discipline) / 40;
  const play = Math.min(1, minutesLastGame / 25) * 0.15;
  const growth = ARCHETYPES[p.archetype].growth;
  for (const k of prog.attrs) {
    const cur = p.attrs[k];
    const ceiling = cur >= 18 ? 0.35 : cur >= 16 ? 0.65 : 1;
    let g = 0.06 * inten.mul * staff * tired * (ovr >= p.potential ? 0.12 : 0.35 + Math.min(1, gap)) * Math.max(0.05, ageF) * (0.7 + work * 0.6) * ceiling + play * 0.05;
    if (growth.includes(k)) g *= 1.25;
    g *= rng.range(0.5, 1.5);
    if (ageF < 0) g = rng.chance(0.3) ? -0.05 : 0;
    res.gains[k] = g;
  }
  // Déclin physique naturel avec l'âge, même en s'entraînant
  if (age >= 30) {
    for (const k of ['speed', 'acceleration', 'vertical', 'explosiveness'] as AttrKey[]) res.gains[k] = (res.gains[k] ?? 0) - 0.012 * (age - 29) * rng.range(0.5, 1.5);
  }
  res.fatigue = inten.fatigue * prog.load;
  // Risque de blessure : intensité, fatigue accumulée, résistance physique
  const risk = 0.004 * inten.mul ** 2 * (1 + Math.max(0, p.fatigue - 40) / 25) * (1.6 - p.attrs.durability / 20) * p.injuryRisk;
  if (rng.chance(risk)) {
    res.injured = rng.int(4, plan.intensity === 'intense' ? 35 : 18);
    res.note = `Blessure à l'entraînement (${res.injured} jours)`;
  }
  return res;
}

/** Applique des gains fractionnaires : les attributs restent entiers, l'excédent est conservé. */
export function applyGains(p: PlayerData, gains: Partial<Record<AttrKey, number>>): AttrKey[] {
  const changed: AttrKey[] = [];
  p.frac ??= {};
  for (const [k, g] of Object.entries(gains) as [AttrKey, number][]) {
    const f = (p.frac[k] ?? 0) + g;
    const whole = f >= 1 ? Math.floor(f) : f <= -1 ? Math.ceil(f) : 0;
    p.frac[k] = f - whole;
    if (whole !== 0) {
      const nv = Math.max(1, Math.min(20, p.attrs[k] + whole));
      if (nv !== p.attrs[k]) {
        p.attrs[k] = nv;
        changed.push(k);
      }
    }
  }
  return changed;
}
