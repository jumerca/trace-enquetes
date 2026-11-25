// Moteur du personnel : génération, grilles indiciaires (simplifiées), compétences effectives,
// fatigue, moral, progression, formations, promotions, retraites et vivier de recrutement.
import type { Rng } from '../core/rng';
import { calendar, MIN_D, MIN_H } from './calendar';
import { randomAppearance, randomName } from './names';
import { SKILLS, type Candidate, type GameState, type Role, type SkillKey, type Skills, type Staff } from './types';

// Grilles : simplification de jeu inspirée des corps de la police nationale (non exhaustive).
export const GRADES: Record<Role, string[]> = {
  commandant: ['Commandant', 'Commandant divisionnaire', 'Commissaire'],
  officier: ['Lieutenant', 'Capitaine', 'Commandant de police'],
  enqueteur: ['Gardien de la paix', 'Brigadier', 'Brigadier-chef', 'Major'],
  agent: ['Adjoint de sécurité', 'Gardien de la paix', 'Brigadier'],
  technicien: ['Technicien de PTS', 'Technicien principal', 'Ingénieur de PTS'],
  secretaire: ['Adjoint administratif', 'Secrétaire administratif', 'Attaché'],
};
const GRADES_AVANT_1995: Partial<Record<Role, string[]>> = {
  officier: ['Inspecteur', 'Inspecteur principal', 'Inspecteur divisionnaire'],
  enqueteur: ['Enquêteur', 'Enquêteur principal', 'Enquêteur-chef', 'Major'],
};
export function gradesFor(role: Role, year: number): string[] {
  return (year < 1995 && GRADES_AVANT_1995[role]) || GRADES[role];
}
export function gradeIndex(s: Staff, year: number): number {
  const g = gradesFor(s.role, year);
  const i = g.indexOf(s.grade);
  return i < 0 ? Math.max(0, GRADES[s.role].indexOf(s.grade)) : i;
}

const BASE_SALARY: Record<Role, number> = { commandant: 52000, officier: 40000, enqueteur: 30000, agent: 24000, technicien: 29000, secretaire: 24500 };
/** Salaire annuel indicatif (euros constants) : grille selon grade et ancienneté, non négociable. */
export function salary(s: Staff, year: number): number {
  const g = gradeIndex(s, year);
  const anc = Math.max(0, year - s.entryYear);
  return Math.round(BASE_SALARY[s.role] * (1 + g * 0.14) * (1 + Math.min(30, anc) * 0.012) / 10) * 10;
}

export const ROLE_LABELS: Record<Role, string> = {
  commandant: 'Commandant de brigade', officier: 'Officier de police judiciaire', enqueteur: 'Enquêteur',
  agent: 'Agent d\'intervention et d\'appui', technicien: 'Technicien scientifique', secretaire: 'Secrétariat administratif',
};

export const SPECIALITES = ['Atteintes aux personnes', 'Atteintes aux biens', 'Disparitions', 'Délinquance financière', 'Criminalité numérique', 'Police technique et scientifique', 'Analyse criminelle', 'Affaires anciennes', 'Procédure', 'Généraliste'];

const ROLE_PROFILE: Record<Role, Partial<Record<SkillKey, number>>> = {
  commandant: { leadership: 4, organisation: 3, juridique: 2, deduction: 1 },
  officier: { deduction: 2, juridique: 3, redaction: 2, leadership: 2, entretien: 1 },
  enqueteur: { investigation: 2, entretien: 2, observation: 2, endurance: 1 },
  agent: { endurance: 3, stress: 2, observation: 1, discipline: 2, entretien: -1, juridique: -2 },
  technicien: { scientifique: 5, observation: 3, analyse: 2, entretien: -3, leadership: -3 },
  secretaire: { organisation: 4, redaction: 3, informatique: 2, fiabilite: 2, endurance: -2, investigation: -3, scientifique: -3 },
};
const SPEC_PROFILE: Record<string, Partial<Record<SkillKey, number>>> = {
  'Atteintes aux personnes': { entretien: 2, psychologie: 2 },
  'Atteintes aux biens': { observation: 2, investigation: 1 },
  Disparitions: { psychologie: 2, investigation: 2 },
  'Délinquance financière': { analyse: 3, informatique: 1, juridique: 1 },
  'Criminalité numérique': { informatique: 4, analyse: 1 },
  'Police technique et scientifique': { scientifique: 3, observation: 1 },
  'Analyse criminelle': { analyse: 3, deduction: 2 },
  'Affaires anciennes': { deduction: 2, analyse: 1, investigation: 1 },
  Procédure: { juridique: 3, redaction: 2 },
  Généraliste: {},
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

export function makeStaff(rng: Rng, opts: { id: string; role: Role; year: number; age?: number; level?: number; specialite?: string; minute: number; sexe?: 'F' | 'M' }): Staff {
  const sexe = opts.sexe ?? (rng.chance(opts.year < 1990 ? 0.25 : opts.year < 2010 ? 0.35 : 0.45) ? 'F' : 'M');
  const age = opts.age ?? rng.int(23, 55);
  const { prenom, nom } = randomName(rng, sexe);
  const years = Math.max(0, age - rng.int(21, 26));
  const level = opts.level ?? clamp(7 + years * 0.22 + rng.range(-2, 2), 5, 16);
  const specialite = opts.specialite ?? (opts.role === 'technicien' ? 'Police technique et scientifique' : opts.role === 'secretaire' ? 'Procédure' : rng.pick(SPECIALITES));
  const skills = {} as Skills;
  for (const k of SKILLS) {
    const bonus = (ROLE_PROFILE[opts.role][k] ?? 0) + (SPEC_PROFILE[specialite]?.[k] ?? 0);
    skills[k] = Math.round(clamp(level + bonus + rng.range(-3, 3), 1, 20));
  }
  skills.experience = Math.round(clamp(3 + years * 0.55 + rng.range(-1, 1), 1, 20));
  skills.endurance = Math.round(clamp(skills.endurance - Math.max(0, age - 45) * 0.25, 1, 20));
  const grades = gradesFor(opts.role, opts.year);
  const gi = clamp(Math.floor(years / 9 + rng.range(-0.5, 0.6)), 0, grades.length - 1);
  const s: Staff = {
    id: opts.id, prenom, nom, sexe, birthYear: opts.year - age, entryYear: opts.year - years,
    grade: grades[opts.role === 'commandant' ? 0 : gi], role: opts.role, specialite, skills,
    potential: Math.round(clamp(level + rng.range(0, 6), 8, 20)), ambition: rng.int(3, 18),
    fatigue: rng.int(5, 25), moral: rng.int(55, 80), relations: {}, unitId: null,
    shift: 'jour', restDays: [0, 6], astreinte: false, status: 'service', statusUntil: 0,
    leaveDays: 25, assignments: [], task: null, history: [], casesHandled: Math.round(years * rng.range(6, 14)),
    casesSolved: 0, errors: 0, xp: {}, appearance: randomAppearance(rng, sexe, age), requests: [], hoursThisWeek: 0, overtime: 0,
  };
  s.casesSolved = Math.round(s.casesHandled * rng.range(0.4, 0.7));
  s.history.push({ minute: opts.minute, kind: 'arrivee', text: `Entrée dans la police en ${s.entryYear}.` });
  return s;
}

export function ageOf(s: Staff, year: number) {
  return year - s.birthYear;
}

export function fullName(s: { prenom: string; nom: string }) {
  return `${s.prenom} ${s.nom}`;
}

/** Facteur de performance lié à la fatigue et au moral (0.45 … 1.1). */
export function condition(s: Staff): number {
  const f = s.fatigue > 60 ? 1 - (s.fatigue - 60) / 75 : 1;
  const m = 0.85 + s.moral / 670;
  return clamp(f * m, 0.45, 1.1);
}

/** Compétence effective pour une tâche, fatigue et moral compris. */
export function eff(s: Staff, k: SkillKey): number {
  return s.skills[k] * condition(s);
}

/** Note globale (moyenne pondérée selon le rôle) — indicatif, jamais réduit aux interpellations. */
export function overall(s: Staff): number {
  const w: Partial<Record<SkillKey, number>> =
    s.role === 'technicien' ? { scientifique: 3, observation: 2, analyse: 2, fiabilite: 1 }
      : s.role === 'secretaire' ? { organisation: 3, redaction: 2, informatique: 2, fiabilite: 2 }
        : s.role === 'agent' ? { endurance: 2, stress: 2, discipline: 2, observation: 1, collectif: 1 }
          : { deduction: 2, investigation: 2, entretien: 2, observation: 1.5, analyse: 1.5, juridique: 1, redaction: 1, collectif: 1, fiabilite: 1 };
  let t = 0, n = 0;
  for (const [k, v] of Object.entries(w)) {
    if (!v || !(k in s.skills)) continue;
    t += s.skills[k as SkillKey] * v;
    n += v;
  }
  return Math.round((t / n) * 10) / 10;
}

/** Gain d'expérience : la pratique fait progresser jusqu'au potentiel (rendements décroissants). */
export function gainXp(s: Staff, k: SkillKey, amount: number) {
  const cur = s.skills[k];
  const cap = Math.min(20, s.potential + (k === 'experience' ? 4 : 0));
  if (cur >= cap) return;
  const rate = amount * (1 - cur / 22) * (1 + s.ambition / 60);
  s.xp[k] = (s.xp[k] ?? 0) + rate;
  if ((s.xp[k] ?? 0) >= 1) {
    s.xp[k] = 0;
    s.skills[k] = Math.min(20, cur + 1);
  }
}

export function isOnDuty(s: Staff, st: GameState, minute = st.minute): boolean {
  if (s.status !== 'service') return false;
  const c = calendar(st.startYear, minute);
  if (s.restDays.includes(c.weekday)) return false;
  const h = c.hour;
  if (s.shift === 'jour') return h >= 8 && h < 18;
  if (s.shift === 'nuit') return h >= 20 || h < 6;
  return h >= 13 && h < 22; // mixte : après-midi et soirée
}

/** Charge : nombre d'affaires actives pondérées par la complexité. */
export function load(s: Staff, st: GameState): number {
  let l = 0;
  for (const id of s.assignments) {
    const c = st.cases.find((x) => x.id === id);
    if (c && c.status === 'ouverte') l += (c.lead === s.id ? 1.3 : 1) * (0.6 + c.complexity * 0.2);
  }
  return Math.round(l * 10) / 10;
}

/** Capacité raisonnable d'un enquêteur (affaires pondérées). */
export function capacity(s: Staff): number {
  return 2.5 + s.skills.organisation / 8 + s.skills.endurance / 12;
}

export function makeCandidate(rng: Rng, st: GameState, source: Candidate['source']): Candidate {
  const year = calendar(st.startYear, st.minute).year;
  const role: Role = source === 'specialiste' ? rng.pick(['technicien', 'officier', 'enqueteur'] as Role[]) : source === 'sortie_ecole' ? rng.pick(['enqueteur', 'enqueteur', 'agent', 'officier'] as Role[]) : rng.pick(['enqueteur', 'officier', 'agent', 'technicien', 'secretaire'] as Role[]);
  const age = source === 'sortie_ecole' ? rng.int(22, 27) : rng.int(28, 52);
  const id = `S${++st.counters.staff}`;
  const s = makeStaff(rng, { id, role, year, age, minute: st.minute, specialite: source === 'specialiste' ? rng.pick(SPECIALITES.slice(0, 8)) : undefined, level: source === 'sortie_ecole' ? rng.range(6, 10) : undefined });
  if (source === 'sortie_ecole') s.potential = Math.min(20, s.potential + rng.int(1, 4));
  s.casesHandled = source === 'sortie_ecole' ? 0 : s.casesHandled;
  s.casesSolved = source === 'sortie_ecole' ? 0 : s.casesSolved;
  return { staff: s, source, availableFrom: st.minute + rng.int(7, 45) * MIN_D, interviewed: false, requested: false };
}

export function refreshCandidates(rng: Rng, st: GameState) {
  st.candidates = st.candidates.filter((c) => !c.requested || c.availableFrom > st.minute);
  while (st.candidates.length < 8) st.candidates.push(makeCandidate(rng, st, rng.pick(['sortie_ecole', 'mutation', 'mutation', 'specialiste'] as const)));
}

/** Fatigue et moral : appelé toutes les 10 minutes de jeu. */
export function tickStaff(s: Staff, st: GameState, dtMin: number, ctx: { restBonus: number; working: boolean; night: boolean; overloaded: boolean }) {
  const h = dtMin / MIN_H;
  if (ctx.working) {
    const end = 0.6 + (20 - s.skills.endurance) / 25;
    let f = 1.15 * end * h;
    if (ctx.night) f *= 1.35;
    if (ctx.overloaded) f *= 1.3;
    s.fatigue = clamp(s.fatigue + f, 0, 100);
    s.hoursThisWeek += h;
  } else {
    s.fatigue = clamp(s.fatigue - (0.42 + ctx.restBonus) * h, 0, 100);
  }
  // moral : tend vers une cible dépendant de la fatigue, de la charge et des conditions
  const target = clamp(72 - Math.max(0, s.fatigue - 50) * 0.6 - (ctx.overloaded ? 12 : 0) + ctx.restBonus * 6 + (st.publicTrust - 50) * 0.1, 10, 95);
  s.moral = clamp(s.moral + (target - s.moral) * 0.004 * h * 6, 0, 100);
}
