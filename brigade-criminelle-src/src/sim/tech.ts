// Technologies et méthodes qui apparaissent au fil des décennies. Chacune devient disponible à
// une date, s'achète sur le budget, et améliore durablement certaines tâches. Les techniques de
// laboratoire elles-mêmes (délais, coûts, qualité) évoluent déjà avec l'époque (calendar.ts).
import { calendar, eraOf } from './calendar';
import { notify } from './log';
import { remaining, spend } from './finance';
import type { ActionKind, BudgetCat, GameState, LabType } from './types';

export interface Tech {
  id: string;
  label: string;
  year: number;
  cost: number;
  cat: BudgetCat;
  desc: string;
  actions?: Partial<Record<ActionKind, number>>; // multiplicateur de vitesse
  lab?: Partial<Record<LabType, number>>; // multiplicateur de vitesse d'analyse
  wear?: number; // multiplicateur d'usure des véhicules
}

export const TECHS: Tech[] = [
  { id: 'telex', label: 'Télex et fichiers centraux', year: 1975, cost: 3000, cat: 'equipements', desc: 'Interrogation des fichiers nationaux par télex.', actions: { recherche: 1.1 } },
  { id: 'radio-portative', label: 'Radios portatives', year: 1978, cost: 5000, cat: 'equipements', desc: 'Liaison permanente des équipes sur le terrain.', actions: { constatations: 1.08, voisinage: 1.08, perquisition: 1.08 } },
  { id: 'telematique', label: 'Consultation télématique des fichiers', year: 1983, cost: 6000, cat: 'informatique', desc: 'Terminaux et Minitel pour les vérifications.', actions: { recherche: 1.15 } },
  { id: 'micro', label: 'Micro-informatique de bureau', year: 1988, cost: 15000, cat: 'informatique', desc: 'Traitement de texte et tableurs pour les procédures.', actions: { rapport: 1.15, recherche: 1.1 } },
  { id: 'empreintes-auto', label: 'Fichier automatisé des empreintes', year: 1988, cost: 20000, cat: 'laboratoires', desc: 'Comparaison automatisée des traces papillaires.', lab: { empreintes: 1.4 } },
  { id: 'gsm', label: 'Téléphonie mobile des équipes', year: 1994, cost: 9000, cat: 'equipements', desc: 'Joindre enquêteurs et témoins à tout moment.', actions: { entretien: 1.05, voisinage: 1.1 } },
  { id: 'adn', label: 'Fichier des empreintes génétiques', year: 1999, cost: 30000, cat: 'laboratoires', desc: 'Rapprochement des profils biologiques.', lab: { biologie: 1.4 } },
  { id: 'reseau', label: 'Procédure informatisée en réseau', year: 2001, cost: 25000, cat: 'informatique', desc: 'Rédaction et partage des procédures en réseau.', actions: { rapport: 1.25, recoupement: 1.1 } },
  { id: 'video', label: 'Exploitation de la vidéoprotection', year: 2005, cost: 18000, cat: 'equipements', desc: 'Images urbaines pour reconstituer les déplacements.', actions: { voisinage: 1.2, recherche: 1.05 }, lab: { photo: 1.3 } },
  { id: 'geoloc', label: 'Géolocalisation et téléphonie', year: 2008, cost: 22000, cat: 'informatique', desc: 'Exploitation rapide des données des opérateurs.', actions: { requisition: 1.25 } },
  { id: 'plateforme-num', label: 'Plateforme d\'analyse numérique', year: 2012, cost: 35000, cat: 'laboratoires', desc: 'Extraction des téléphones et ordinateurs.', lab: { numerique: 1.5 } },
  { id: 'terminaux', label: 'Terminaux mobiles de procédure', year: 2016, cost: 20000, cat: 'informatique', desc: 'Saisie des constatations et auditions sur le terrain.', actions: { constatations: 1.15, rapport: 1.1 } },
  { id: 'donnees', label: 'Analyse de données et rapprochements', year: 2021, cost: 40000, cat: 'informatique', desc: 'Outils de rapprochement des dossiers et des relations.', actions: { recoupement: 1.3, recherche: 1.1 } },
  { id: 'flotte-electrique', label: 'Flotte électrique connectée', year: 2022, cost: 15000, cat: 'vehicules', desc: 'Véhicules électriques suivis à distance : moins d\'usure et d\'entretien.', wear: 0.5 },
];

export function techAvailable(t: Tech, year: number) {
  return year >= t.year;
}

export function owned(st: GameState, id: string) {
  return (st.techs ?? []).includes(id);
}

export function actionBonus(st: GameState, kind: ActionKind): number {
  let m = 1;
  for (const t of TECHS) if (t.actions?.[kind] && owned(st, t.id)) m *= t.actions[kind]!;
  return m;
}

export function techBonus(st: GameState, lab: LabType): number {
  let m = 1;
  for (const t of TECHS) if (t.lab?.[lab] && owned(st, t.id)) m *= t.lab[lab]!;
  return m;
}

export function wearFactor(st: GameState): number {
  return TECHS.filter((t) => t.wear && owned(st, t.id)).reduce((m, t) => m * t.wear!, 1);
}

/** Coût réel : en euros de l'époque et proportionné à la taille du service. */
export function techCost(st: GameState, t: Tech): number {
  const year = calendar(st.startYear, st.minute).year;
  const k = eraOf(year).budgetFactor * Math.max(0.4, Math.sqrt(st.city.population / 80000));
  return Math.round((t.cost * k) / 100) * 100;
}

export function buyTech(st: GameState, id: string): string {
  const t = TECHS.find((x) => x.id === id);
  if (!t) return 'Technologie inconnue.';
  if (owned(st, id)) return 'Déjà en service.';
  if (!techAvailable(t, calendar(st.startYear, st.minute).year)) return `Pas encore disponible (à partir de ${t.year}).`;
  spend(st, t.cat, techCost(st, t), (n) => notify(st, n));
  st.techs = [...(st.techs ?? []), id];
  notify(st, { level: 'succes', text: `Nouvelle technologie en service : ${t.label}.` });
  return `${t.label} : en service.`;
}

/** Technologies déjà en usage au début d'une partie (anciennes de plus de trois ans). */
export function initialTechs(year: number): string[] {
  return TECHS.filter((t) => t.year <= year - 3).map((t) => t.id);
}

/** Bilan annuel : nouveautés disponibles ; en délégation, achat si les crédits le permettent. */
export function techNewYear(st: GameState, year: number) {
  for (const t of TECHS) if (t.year === year) notify(st, { level: 'info', text: `Nouveauté disponible : ${t.label} (${techCost(st, t).toLocaleString('fr-FR')} €). Voir Équipements.` });
  if (st.settings.assist !== 'delegation') return;
  for (const t of TECHS) if (techAvailable(t, year) && !owned(st, t.id) && remaining(st.budget, t.cat) > techCost(st, t) * 0.8) buyTech(st, t.id);
}
