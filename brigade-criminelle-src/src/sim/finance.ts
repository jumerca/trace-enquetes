// Moteur financier : enveloppe annuelle de fonctionnement par poste, masse salariale suivie
// séparément, demandes de moyens supplémentaires. Aucune récompense financière par affaire.
import type { Rng } from '../core/rng';
import { calendar, eraOf, MIN_D } from './calendar';
import { salary } from './staff';
import { BUDGET_CATS, type Budget, type BudgetCat, type GameState, type Notice } from './types';

export const CAT_LABELS: Record<BudgetCat, string> = {
  equipements: 'Équipements', vehicules: 'Véhicules', entretien: 'Entretien', laboratoires: 'Laboratoires',
  informatique: 'Informatique', formation: 'Formation', batiments: 'Bâtiments', prestations: 'Prestations',
  deplacements: 'Déplacements', operationnel: 'Dépenses opérationnelles',
};

const BASE: Record<BudgetCat, number> = {
  equipements: 18000, vehicules: 14000, entretien: 9000, laboratoires: 26000, informatique: 9000, formation: 12000,
  batiments: 30000, prestations: 8000, deplacements: 11000, operationnel: 14000,
};

export function makeBudget(st: Pick<GameState, 'startYear' | 'city' | 'staff'>, year: number, factor = 1): Budget {
  const era = eraOf(year);
  const popF = Math.sqrt(st.city.population / 80000);
  const env = {} as Record<BudgetCat, number>;
  const spent = {} as Record<BudgetCat, number>;
  for (const c of BUDGET_CATS) {
    env[c] = Math.round((BASE[c] * era.budgetFactor * popF * factor) / 100) * 100;
    spent[c] = 0;
  }
  if (era.computers === 'aucun') env.informatique = Math.round(env.informatique * 0.15);
  return { year, envelope: env, spent, payroll: st.staff.reduce((s, x) => s + salary(x, year), 0), payrollPaid: 0, requests: [], history: [] };
}

export function remaining(b: Budget, cat: BudgetCat) {
  return b.envelope[cat] - b.spent[cat];
}
export function totalEnvelope(b: Budget) {
  return BUDGET_CATS.reduce((s, c) => s + b.envelope[c], 0);
}
export function totalSpent(b: Budget) {
  return BUDGET_CATS.reduce((s, c) => s + b.spent[c], 0);
}

/** Engage une dépense. Un dépassement reste possible (la dépense est due) mais il est signalé
 * et pèse sur l'évaluation de gestion. Renvoie false si le poste est déjà épuisé. */
export function spend(st: GameState, cat: BudgetCat, amount: number, note?: (n: Omit<Notice, 'id' | 'read'>) => void): boolean {
  const b = st.budget;
  const before = remaining(b, cat);
  b.spent[cat] += amount;
  if (before >= 0 && remaining(b, cat) < 0 && note) note({ minute: st.minute, level: 'alerte', text: `Le poste « ${CAT_LABELS[cat]} » dépasse son enveloppe annuelle.` });
  return before > 0;
}

/** Demande de moyens : réponse après plusieurs semaines, selon les besoins démontrés. */
export function requestFunds(st: GameState, rng: Rng, cat: BudgetCat, amount: number, reason: string) {
  st.budget.requests.push({ id: `R${++st.counters.req}`, cat, amount, reason, sentAt: st.minute, answerAt: st.minute + rng.int(14, 40) * MIN_D, granted: null });
}

/** Évalue une demande : charge de travail, consommation du poste, délais d'expertise, contexte. */
export function evaluateFundRequest(st: GameState, rng: Rng, r: Budget['requests'][number]): number {
  const b = st.budget;
  const used = b.spent[r.cat] / Math.max(1, b.envelope[r.cat]);
  const open = st.cases.filter((c) => c.status === 'ouverte').length;
  const inv = st.staff.filter((s) => ['enqueteur', 'officier'].includes(s.role)).length || 1;
  const loadNeed = Math.min(1, open / inv / 3);
  const labNeed = r.cat === 'laboratoires' ? Math.min(1, st.lab.queue.length / 6) : 0;
  const restrictions = st.events.some((e) => e.kind === 'restriction' && e.end > st.minute) ? 0.4 : 1;
  const score = (used * 0.5 + loadNeed * 0.3 + labNeed * 0.3 + st.commander.reputation / 300) * restrictions;
  const p = Math.min(0.95, score);
  if (rng.next() > p) return 0;
  return Math.round((r.amount * Math.min(1, 0.4 + score * 0.6)) / 100) * 100;
}

export function yearOf(st: GameState) {
  return calendar(st.startYear, st.minute).year;
}
