// Progression de carrière du commandant (V0.5) : de la brigade locale à une coordination
// nationale fictive. Les propositions d'avancement dépendent de la qualité globale du travail
// (évaluations), de la gestion humaine (moral), du respect des règles (irrégularités) et de
// l'expérience (ancienneté dans le poste). Le joueur accepte un avancement sur place (ressort
// élargi) ou une mutation dans une ville plus grande ; il peut aussi refuser. La carrière
// s'étend sur 30 à 40 années simulées, jusqu'à la retraite.
import type { Rng } from '../core/rng';
import { calendar, eraOf, LAB_LABELS, MIN_D } from './calendar';
import { SIZE_POP } from './city';
import { notify } from './log';
import { makeCandidate } from './staff';
import type { CitySize, GameState } from './types';

export interface Level {
  title: string; // {ville} remplacé par le nom de la ville
  grade: string;
  scale: number; // volume d'affaires
  budget: number; // multiplicateur de l'enveloppe
  ceiling: number; // postes supplémentaires au plafond d'emplois
  years: number; // ancienneté minimale dans le poste avant de pouvoir le quitter
  note: number; // moyenne des deux dernières évaluations exigée
  desc: string;
}

export const LEVELS: Level[] = [
  { title: 'Brigade de sûreté de {ville}', grade: 'Commandant', scale: 1, budget: 1, ceiling: 0, years: 3, note: 13, desc: 'Une brigade locale : affaires du quotidien et premières enquêtes complexes.' },
  { title: 'Service de police judiciaire de {ville}', grade: 'Commissaire principal', scale: 1.3, budget: 1.25, ceiling: 3, years: 4, note: 13.5, desc: 'Le service couvre toute l\'agglomération : plus d\'affaires et des groupes spécialisés.' },
  { title: 'Brigade départementale de police judiciaire', grade: 'Commissaire divisionnaire', scale: 1.7, budget: 1.6, ceiling: 6, years: 4, note: 14, desc: 'Ressort départemental : affaires sérielles, financières et criminelles plus fréquentes.' },
  { title: 'Unité régionale de police judiciaire', grade: 'Contrôleur général', scale: 2.1, budget: 2, ceiling: 9, years: 5, note: 14.5, desc: 'Coordination de plusieurs départements ; affaires sensibles et très médiatisées.' },
  { title: 'Direction spécialisée de la police judiciaire', grade: 'Inspecteur général', scale: 2.5, budget: 2.4, ceiling: 12, years: 5, note: 15, desc: 'Direction thématique (criminalité financière, affaires anciennes, analyse).' },
  { title: 'Coordination nationale de la police judiciaire', grade: 'Directeur central', scale: 3, budget: 2.8, ceiling: 15, years: 99, note: 99, desc: 'Sommet de la carrière (structure fictive) : pilotage national.' },
];

export const RETIREMENT_AGE = 65;

/** Grades du commandant : une seule échelle, strictement croissante, quelle que soit l'époque
 * (avant 1995, un chef de brigade est commissaire ; après, commandant). Simplification de jeu. */
export function gradeFor(rank: number, year: number): string {
  const r = Math.min(LEVELS.length - 1, rank);
  return r === 0 && year < 1995 ? 'Commissaire' : LEVELS[r].grade;
}
const SIZES: CitySize[] = ['commune', 'petite', 'moyenne', 'grande', 'metropole'];
const CITY_NAMES = ['Valmont', 'Rochebrune', 'Montclar', 'Belleriviere', 'Saint-Aurèle', 'Port-Vallon', 'Clairefontaine', 'Hautmesnil', 'Vercourt', 'Lussan-la-Ville'];

export type OfferOption = { kind: 'surplace' } | { kind: 'mutation'; city: string; size: CitySize };
export interface Offer { id: string; at: number; expires: number; toRank: number; options: OfferOption[]; answered: boolean; text: string }
export interface CareerStep { minute: number; year: number; rank: number; city: string; text: string }

export function level(st: GameState): Level {
  return LEVELS[Math.min(LEVELS.length - 1, st.hierarchy.rank)];
}

export function postTitle(st: GameState, rank = st.hierarchy.rank): string {
  return LEVELS[Math.min(LEVELS.length - 1, rank)].title.replace('{ville}', st.city.name);
}

export function commanderAge(st: GameState): number {
  const cmd = st.staff.find((s) => s.id === 'CMD');
  const year = calendar(st.startYear, st.minute).year;
  return cmd ? year - cmd.birthYear : st.commander.age;
}

export function yearsInPost(st: GameState): number {
  return (st.minute - (st.hierarchy.postSince ?? 0)) / (365 * MIN_D);
}

/** Critères d'avancement (affichés au joueur) : chaque critère avec sa valeur et son seuil. */
export function criteria(st: GameState) {
  const L = level(st);
  const ev = st.hierarchy.evaluations.slice(-2);
  const avg = ev.length ? ev.reduce((s, e) => s + e.note, 0) / ev.length : 0;
  const moral = st.staff.reduce((s, x) => s + x.moral, 0) / Math.max(1, st.staff.length);
  const recentFlaws = st.cases.filter((c) => c.outcome && st.minute - c.outcome.at < 365 * MIN_D).reduce((s, c) => s + c.procedureFlaws, 0);
  const maxFlaws = 6 + st.hierarchy.rank * 2;
  return [
    { label: 'Ancienneté dans le poste', value: yearsInPost(st), need: L.years, unit: 'ans', ok: yearsInPost(st) >= L.years },
    { label: 'Moyenne des deux dernières évaluations', value: avg, need: L.note, unit: '/20', ok: ev.length >= 2 && avg >= L.note },
    { label: 'Réputation', value: st.commander.reputation, need: 45 + st.hierarchy.rank * 5, unit: '/100', ok: st.commander.reputation >= 45 + st.hierarchy.rank * 5 },
    { label: 'Moral des équipes', value: moral, need: 50, unit: '/100', ok: moral >= 50 },
    { label: 'Irrégularités de procédure (12 derniers mois)', value: recentFlaws, need: maxFlaws, unit: 'au plus', ok: recentFlaws <= maxFlaws },
  ];
}

/** Bilan annuel : proposition d'avancement, retraite, changement d'époque technologique. */
export function careerNewYear(st: GameState, rng: Rng, year: number) {
  const h = st.hierarchy;
  // nouvelles technologies (changement d'époque)
  const before = eraOf(year - 1), now = eraOf(year);
  if (before.id !== now.id) {
    const fresh = Object.entries(now.lab).filter(([k, v]) => v.available && !before.lab[k as keyof typeof before.lab].available).map(([k]) => LAB_LABELS[k as keyof typeof LAB_LABELS]);
    notify(st, { level: 'succes', text: `Nouvelle époque : ${now.label}. ${fresh.length ? `Techniques désormais disponibles : ${fresh.join(', ')}. ` : ''}Communications : ${now.phone}. Les délais et la qualité des analyses s'améliorent.` });
    h.career.push({ minute: st.minute, year, rank: h.rank, city: st.city.name, text: `Entrée dans les ${now.label.toLowerCase()} : nouveaux équipements et méthodes.` });
  }
  if (h.retired) return;
  // retraite du commandant
  if (commanderAge(st) >= RETIREMENT_AGE) {
    h.retired = true;
    const years = year - st.startYear;
    h.career.push({ minute: st.minute, year, rank: h.rank, city: st.city.name, text: `Départ à la retraite après ${years} ans de carrière simulée, au poste de ${postTitle(st)}.` });
    notify(st, { level: 'urgent', text: `Fin de carrière : vous partez à la retraite (${RETIREMENT_AGE} ans). Consultez votre bilan dans le menu Carrière ; vous pouvez poursuivre la partie à titre honoraire.` });
    return;
  }
  // expiration des propositions non traitées
  for (const o of h.offers) if (!o.answered && st.minute > o.expires) { o.answered = true; notify(st, { level: 'info', text: 'Une proposition d\'avancement a expiré sans réponse.' }); }
  if (h.rank >= LEVELS.length - 1 || h.offers.some((o) => !o.answered)) return;
  if (!criteria(st).every((c) => c.ok)) return;
  const toRank = h.rank + 1;
  const options: OfferOption[] = [{ kind: 'surplace' }];
  const si = SIZES.indexOf(st.city.size);
  if (toRank >= 2 && si < SIZES.length - 1) {
    const size = SIZES[Math.min(SIZES.length - 1, si + 1)];
    options.push({ kind: 'mutation', city: rng.pick(CITY_NAMES.filter((n) => n !== st.city.name)), size });
  }
  const o: Offer = { id: `OF${++st.counters.event}`, at: st.minute, expires: st.minute + 90 * MIN_D, toRank, options, answered: false, text: `La direction vous propose le grade de ${gradeFor(toRank, year)} à la tête du poste « ${LEVELS[toRank].title.replace('{ville}', st.city.name)} ».` };
  h.offers.push(o);
  notify(st, { level: 'urgent', text: `Proposition d'avancement : ${gradeFor(toRank, year)}. Réponse attendue sous trois mois (menu Carrière).` });
}

export function declineOffer(st: GameState, id: string) {
  const o = st.hierarchy.offers.find((x) => x.id === id);
  if (!o || o.answered) return;
  o.answered = true;
  st.hierarchy.career.push({ minute: st.minute, year: calendar(st.startYear, st.minute).year, rank: st.hierarchy.rank, city: st.city.name, text: 'Proposition d\'avancement déclinée : vous restez à la tête de votre service.' });
  notify(st, { level: 'info', text: 'Vous déclinez la proposition. La direction prend acte ; une autre pourra suivre.' });
}

/** Avancement sur place : le ressort s'élargit, les moyens et le volume d'affaires augmentent. */
export function acceptInPlace(st: GameState, rng: Rng, id: string): string {
  const o = st.hierarchy.offers.find((x) => x.id === id);
  if (!o || o.answered) return 'Proposition introuvable.';
  o.answered = true;
  const before = level(st);
  st.hierarchy.rank = o.toRank;
  const L = level(st);
  applyGrade(st, gradeFor(st.hierarchy.rank, calendar(st.startYear, st.minute).year));
  st.hierarchy.postSince = st.minute;
  // l'enveloppe de l'année est relevée au prorata du nouveau ressort
  const k = L.budget / before.budget;
  for (const c of Object.keys(st.budget.envelope) as (keyof typeof st.budget.envelope)[]) st.budget.envelope[c] = Math.round((st.budget.envelope[c] * k) / 100) * 100;
  // renforts affectés par l'administration
  const n = Math.max(1, L.ceiling - before.ceiling - 1);
  for (let i = 0; i < n; i++) {
    const c = makeCandidate(rng, st, i === 0 ? 'mutation' : 'sortie_ecole');
    c.requested = true;
    c.availableFrom = st.minute + (15 + i * 10) * MIN_D;
    st.candidates.push(c);
  }
  st.commander.reputation = Math.min(100, st.commander.reputation + 4);
  const text = `Promotion : ${st.commander.grade}, à la tête du poste « ${postTitle(st)} ». ${n} renfort(s) annoncé(s), moyens relevés de ${Math.round((k - 1) * 100)} %.`;
  st.hierarchy.career.push({ minute: st.minute, year: calendar(st.startYear, st.minute).year, rank: st.hierarchy.rank, city: st.city.name, text });
  notify(st, { level: 'succes', text });
  return text;
}

export function applyGrade(st: GameState, grade: string) {
  st.commander.grade = grade;
  const cmd = st.staff.find((s) => s.id === 'CMD');
  if (cmd) {
    cmd.grade = grade;
    cmd.history.push({ minute: st.minute, kind: 'promotion', text: `Promotion au grade de ${grade}.` });
  }
}

export function popOf(size: CitySize) {
  return SIZE_POP[size];
}
