// Sommet de carrière (échelons « direction spécialisée » et « coordination nationale ») :
// arbitrages propres au pilotage national. Le joueur répartit l'effort entre grandes
// priorités, répond aux crises et aux demandes du cabinet ministériel (fictif), adopte ou
// diffère des réformes, et entretient la confiance du ministère.
import type { Rng } from '../core/rng';
import { calendar, MIN_D } from './calendar';
import { notify } from './log';
import type { ActionKind, CaseType, GameState } from './types';

export const SUMMIT_RANK = 4;

export type Axis = 'criminel' | 'financier' | 'numerique' | 'biens' | 'personnes';
export const AXIS_LABEL: Record<Axis, string> = {
  criminel: 'Criminalité grave', financier: 'Délinquance financière', numerique: 'Cybercriminalité', biens: 'Atteintes aux biens', personnes: 'Personnes vulnérables et disparitions',
};
export const AXIS_TYPES: Record<Axis, CaseType[]> = {
  criminel: ['homicide', 'extorsion', 'trafic_art', 'sabotage'],
  financier: ['financiere', 'escroquerie', 'fraude_doc'],
  numerique: ['numerique'],
  biens: ['vol', 'cambriolage', 'vol_vehicule'],
  personnes: ['disparition', 'deces_suspect', 'ancien', 'fausse_declaration'],
};

export interface SummitOption { label: string; effect: { confidence?: number; trust?: number; budget?: number; morale?: number; flaw?: number; axis?: Axis; axisDelta?: number; reform?: string; text: string } }
export interface SummitDossier {
  id: string;
  at: number;
  expires: number;
  kind: 'crise' | 'cabinet' | 'reforme' | 'nomination' | 'budget';
  title: string;
  text: string;
  options: SummitOption[];
  answered: boolean;
  outcome?: string;
}

export interface SummitState {
  priorities: Record<Axis, number>; // parts de l'effort, total 100
  confidence: number; // confiance du ministère 0-100
  dossiers: SummitDossier[];
  reforms: string[];
  log: { minute: number; text: string }[];
}

export function ensureSummit(st: GameState): SummitState | null {
  if (st.hierarchy.rank < SUMMIT_RANK) return st.summit ?? null;
  if (!st.summit) st.summit = { priorities: { criminel: 20, financier: 20, numerique: 20, biens: 20, personnes: 20 }, confidence: 60, dossiers: [], reforms: [], log: [] };
  return st.summit;
}

/** Ajuste une priorité ; les autres sont rééquilibrées pour garder un total de 100. */
export function setAxis(st: GameState, axis: Axis, v: number) {
  const s = ensureSummit(st);
  if (!s) return;
  v = Math.max(5, Math.min(60, Math.round(v)));
  const others = (Object.keys(s.priorities) as Axis[]).filter((a) => a !== axis);
  const rest = others.reduce((t, a) => t + s.priorities[a], 0) || 1;
  const left = 100 - v;
  s.priorities[axis] = v;
  for (const a of others) s.priorities[a] = Math.max(5, Math.round(s.priorities[a] / rest * left));
  const sum = (Object.values(s.priorities) as number[]).reduce((t, x) => t + x, 0);
  s.priorities[others[0]] += 100 - sum;
}

/** Effet des priorités nationales sur la fréquence (signalements remontés) d'un type d'affaire. */
export function axisSpawnFactor(st: GameState, type: CaseType): number {
  const s = st.summit;
  if (!s || st.hierarchy.rank < SUMMIT_RANK) return 1;
  for (const a of Object.keys(AXIS_TYPES) as Axis[]) if (AXIS_TYPES[a].includes(type)) return 0.7 + s.priorities[a] / 100 * 1.5;
  return 1;
}

/** Effet des priorités sur la vitesse des investigations : les moyens suivent les priorités. */
export function axisWorkFactor(st: GameState, type: CaseType, kind: ActionKind): number {
  const s = st.summit;
  if (!s || st.hierarchy.rank < SUMMIT_RANK) return 1;
  let f = 1;
  for (const a of Object.keys(AXIS_TYPES) as Axis[]) if (AXIS_TYPES[a].includes(type)) f = 0.8 + s.priorities[a] / 100 * 1.4;
  if (s.reforms.includes('office-cyber') && type === 'numerique') f *= 1.25;
  if (s.reforms.includes('pole-financier') && (type === 'financiere' || type === 'escroquerie')) f *= 1.2;
  if (s.reforms.includes('fichier-commun') && (kind === 'recoupement' || kind === 'recherche')) f *= 1.15;
  return f;
}

type Gen = (st: GameState, rng: Rng, year: number) => Omit<SummitDossier, 'id' | 'at' | 'expires' | 'answered'> | null;

const REFORMS: { id: string; year: number; title: string; text: string; pro: string; con: string }[] = [
  { id: 'fichier-commun', year: 1985, title: 'Fichier national commun des enquêtes', text: 'Le cabinet propose de fusionner les fichiers d\'enquête des services. Gain de temps considérable, mais lourde migration.', pro: 'Recherches et recoupements +15 %', con: 'Coût immédiat, grogne des services' },
  { id: 'pole-financier', year: 1998, title: 'Pôles spécialisés contre la délinquance financière', text: 'Créer des pôles d\'enquêteurs financiers dans chaque région.', pro: 'Affaires financières +20 %', con: 'Prélève des effectifs sur les atteintes aux biens' },
  { id: 'garde-a-vue', year: 2011, title: 'Réforme de la garde à vue', text: 'Présence de l\'avocat dès la première heure : les droits sont renforcés, les procédures s\'allongent.', pro: 'Moins d\'irrégularités, confiance du public', con: 'Auditions plus longues' },
  { id: 'office-cyber', year: 2014, title: 'Office national de lutte contre la cybercriminalité', text: 'Regrouper les compétences numériques dans un office national.', pro: 'Affaires numériques +25 %', con: 'Budget important, priorités à revoir' },
  { id: 'police-proximite', year: 1998, title: 'Police de proximité', text: 'Redéployer des effectifs vers le contact avec la population.', pro: 'Confiance du public', con: 'Moins de moyens pour l\'investigation' },
  { id: 'evaluation-chiffree', year: 2003, title: 'Pilotage par indicateurs chiffrés', text: 'Évaluer les services sur des objectifs chiffrés trimestriels.', pro: 'Confiance du cabinet', con: 'Pression sur les équipes, tentation d\'enjoliver' },
];

const GENS: Gen[] = [
  // crise nationale
  (_st, rng) => {
    const crisis = rng.pick([
      { t: 'Vague de cambriolages dans plusieurs régions', a: 'biens' as Axis, d: 'Les préfets signalent une série de cambriolages commis par des équipes itinérantes.' },
      { t: 'Escroquerie de grande ampleur', a: 'financier' as Axis, d: 'Des milliers d\'épargnants ont été trompés par un faux placement. Les plaintes affluent de tout le pays.' },
      { t: 'Disparitions inquiétantes en série', a: 'personnes' as Axis, d: 'Trois disparitions dans des départements voisins inquiètent l\'opinion.' },
      { t: 'Règlements de comptes entre réseaux', a: 'criminel' as Axis, d: 'Plusieurs agressions graves laissent craindre une guerre de territoires.' },
    ]);
    return {
      kind: 'crise', title: crisis.t, text: crisis.d,
      options: [
        { label: 'Créer une cellule nationale dédiée', effect: { axis: crisis.a, axisDelta: 15, confidence: 8, budget: 60000, morale: -3, text: 'Une cellule nationale coordonne les services ; les premiers résultats rassurent.' } },
        { label: 'Laisser les services territoriaux traiter', effect: { confidence: -6, trust: -2, text: 'Les services traitent au cas par cas ; la presse dénonce un manque de coordination.' } },
        { label: 'Communiquer et renforcer la prévention', effect: { confidence: 2, trust: 3, axis: crisis.a, axisDelta: 5, text: 'Une campagne de prévention apaise l\'opinion.' } },
      ],
    };
  },
  // demande du cabinet
  (_st, rng) => {
    const req = rng.pick([
      { t: 'Le cabinet veut des chiffres en hausse', d: 'Le conseiller du ministre souhaite que le taux d\'élucidation affiché progresse « d\'au moins cinq points » avant la fin du trimestre.' },
      { t: 'Une affaire sensible touche un proche du pouvoir', d: 'Un dossier financier vise une personnalité proche du gouvernement. Le cabinet demande « de la discrétion ».' },
      { t: 'Audition devant une commission parlementaire', d: 'Vous êtes convoqué pour présenter l\'action de la police judiciaire.' },
    ]);
    if (req.t.startsWith('Le cabinet veut')) return {
      kind: 'cabinet', title: req.t, text: req.d,
      options: [
        { label: 'Publier des chiffres exacts', effect: { confidence: -5, trust: 2, text: 'Les chiffres sont sincères. Le cabinet est déçu, les syndicats saluent la transparence.' } },
        { label: 'Requalifier des affaires pour améliorer le taux', effect: { confidence: 8, flaw: 2, morale: -4, text: 'Le taux progresse sur le papier ; des enquêteurs s\'en émeuvent en interne.' } },
        { label: 'Proposer un plan d\'amélioration réaliste', effect: { confidence: 3, morale: 2, text: 'Le plan est accepté ; vous gagnez du temps.' } },
      ],
    };
    if (req.t.startsWith('Une affaire sensible')) return {
      kind: 'cabinet', title: req.t, text: req.d,
      options: [
        { label: 'Garantir l\'indépendance des enquêteurs', effect: { confidence: -8, trust: 3, morale: 4, text: 'L\'enquête suit son cours normal. Le cabinet vous bat froid.' } },
        { label: 'Ralentir discrètement le dossier', effect: { confidence: 6, flaw: 3, trust: -4, morale: -6, text: 'Le dossier s\'enlise… et un journaliste commence à s\'y intéresser.' } },
      ],
    };
    return {
      kind: 'cabinet', title: req.t, text: req.d,
      options: [
        { label: 'Présenter un bilan précis et sans fard', effect: { confidence: 3, trust: 3, text: 'Les parlementaires saluent la clarté de l\'exposé.' } },
        { label: 'Plaider pour davantage de moyens', effect: { confidence: -2, budget: -80000, text: 'La commission recommande une rallonge budgétaire, accordée en partie.' } },
      ],
    };
  },
  // réforme datée
  (st, _rng, year) => {
    const s = st.summit!;
    const r = REFORMS.find((x) => year >= x.year && !s.reforms.includes(x.id) && !s.dossiers.some((d) => d.title === x.title && (d.answered ? year - calendar(st.startYear, d.at).year < 4 : true)));
    if (!r) return null;
    return {
      kind: 'reforme', title: r.title, text: `${r.text} Avantage : ${r.pro}. Inconvénient : ${r.con}.`,
      options: [
        { label: 'Adopter la réforme', effect: { reform: r.id, confidence: 4, budget: 40000, morale: r.id === 'evaluation-chiffree' ? -5 : -2, trust: r.id === 'police-proximite' || r.id === 'garde-a-vue' ? 4 : 0, text: `Réforme adoptée : ${r.title.toLowerCase()}.` } },
        { label: 'Différer (nouvel examen dans quelques années)', effect: { confidence: -3, text: 'La réforme est reportée.' } },
      ],
    };
  },
  // nomination
  (_st, rng) => {
    const a = rng.pick(['un directeur régional', 'le chef de l\'office central', 'votre adjoint national']);
    return {
      kind: 'nomination', title: `Nomination : ${a}`, text: 'Deux profils s\'opposent : un enquêteur chevronné, respecté des équipes, et un administrateur apprécié du cabinet.',
      options: [
        { label: 'Nommer l\'enquêteur chevronné', effect: { morale: 6, confidence: -3, text: 'Les équipes saluent la nomination d\'un des leurs.' } },
        { label: 'Nommer l\'administrateur', effect: { morale: -3, confidence: 6, text: 'Le cabinet apprécie ; les équipes restent prudentes.' } },
      ],
    };
  },
  // budget
  (_st, rng) => ({
    kind: 'budget', title: 'Arbitrage budgétaire', text: `Bercy demande une économie de ${rng.pick([3, 4, 5])} % sur les crédits de la police judiciaire.`,
    options: [
      { label: 'Réduire l\'équipement (véhicules, informatique)', effect: { budget: 50000, confidence: 4, morale: -2, text: 'Les renouvellements sont décalés d\'un an.' } },
      { label: 'Geler les formations', effect: { budget: 35000, confidence: 3, morale: -4, text: 'Les formations sont repoussées ; les équipes grincent des dents.' } },
      { label: 'Refuser et défendre les crédits', effect: { confidence: -7, text: 'Vous obtenez le maintien des crédits, au prix d\'une relation tendue avec le cabinet.' } },
    ],
  }),
];

export function summitMonthly(st: GameState, rng: Rng) {
  const s = ensureSummit(st);
  if (!s || st.hierarchy.rank < SUMMIT_RANK || st.hierarchy.retired) return;
  const year = calendar(st.startYear, st.minute).year;
  for (const d of s.dossiers) if (!d.answered && d.expires <= st.minute) {
    d.answered = true;
    d.outcome = 'Sans décision de votre part, le cabinet a tranché à votre place.';
    s.confidence = Math.max(0, s.confidence - 6);
    s.log.push({ minute: st.minute, text: `${d.title} : ${d.outcome}` });
  }
  s.dossiers = s.dossiers.filter((d) => !d.answered || st.minute - d.at < 400 * MIN_D).slice(-24);
  const pending = s.dossiers.filter((d) => !d.answered).length;
  const n = st.hierarchy.rank >= 5 ? 2 : 1;
  for (let i = 0; i < n && pending + i < 3; i++) {
    if (!rng.chance(0.75)) continue;
    const g = rng.pick(GENS)(st, rng, year) ?? GENS[4](st, rng, year);
    if (!g) continue;
    const d: SummitDossier = { id: `SD${++st.counters.notice}`, at: st.minute, expires: st.minute + 21 * MIN_D, answered: false, ...g };
    s.dossiers.push(d);
    notify(st, { level: 'alerte', text: `Arbitrage national : ${d.title}. Décidez dans le menu Carrière.` });
    if (st.settings.assist === 'delegation') decide(st, d.id, d.options.length - 1);
  }
  // la confiance du ministère dérive vers 50
  s.confidence += (50 - s.confidence) * 0.03;
}

export function decide(st: GameState, id: string, opt: number): string {
  const s = st.summit;
  const d = s?.dossiers.find((x) => x.id === id);
  if (!s || !d || d.answered) return '';
  const o = d.options[opt];
  if (!o) return '';
  const e = o.effect;
  d.answered = true;
  if (e.confidence) s.confidence = Math.max(0, Math.min(100, s.confidence + e.confidence));
  if (e.trust) st.publicTrust = Math.max(0, Math.min(100, st.publicTrust + e.trust));
  if (e.budget) {
    // positif : économie réalisée (crédits retirés) ; négatif : rallonge
    const cats = ['equipements', 'vehicules', 'formation', 'operationnel'] as const;
    const scale = e.budget > 0 ? 1 : -1;
    for (const c of cats) st.budget.envelope[c] = Math.max(0, st.budget.envelope[c] - scale * Math.abs(e.budget) / cats.length);
  }
  if (e.morale) for (const x of st.staff) x.moral = Math.max(0, Math.min(100, x.moral + e.morale));
  if (e.flaw) { const c = st.cases.find((x) => x.status === 'ouverte'); if (c) c.procedureFlaws += e.flaw; }
  if (e.axis && e.axisDelta) setAxis(st, e.axis, s.priorities[e.axis] + e.axisDelta);
  if (e.reform && !s.reforms.includes(e.reform)) s.reforms.push(e.reform);
  d.outcome = e.text;
  s.log.push({ minute: st.minute, text: `${d.title} — ${o.label} : ${e.text}` });
  if (s.log.length > 60) s.log.splice(0, s.log.length - 60);
  return e.text;
}

/** Note de pilotage national (0-20) mêlée à l'évaluation annuelle (25 %). */
export function summitNote(st: GameState): number | null {
  const s = st.summit;
  if (!s || st.hierarchy.rank < SUMMIT_RANK) return null;
  const balance = 1 - (Math.max(...Object.values(s.priorities)) - 20) / 80; // éviter de tout miser sur un axe
  return Math.round((s.confidence / 100 * 12 + st.publicTrust / 100 * 5 + balance * 3) * 10) / 10;
}
