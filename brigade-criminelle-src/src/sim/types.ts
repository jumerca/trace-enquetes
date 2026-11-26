// Modèle de données de la simulation. Tout est sérialisable en JSON (sauvegardes) et
// indépendant du rendu : le moteur tourne identiquement sans affichage (tests, Web Worker).

export const SKILLS = [
  'observation', 'deduction', 'analyse', 'investigation', 'entretien', 'psychologie', 'stress', 'juridique',
  'redaction', 'organisation', 'collectif', 'fiabilite', 'discipline', 'leadership', 'informatique', 'scientifique',
  'endurance', 'experience',
] as const;
export type SkillKey = (typeof SKILLS)[number];
export type Skills = Record<SkillKey, number>;

export const SKILL_LABELS: Record<SkillKey, string> = {
  observation: 'Observation', deduction: 'Déduction', analyse: 'Analyse', investigation: 'Investigation',
  entretien: 'Entretien', psychologie: 'Psychologie', stress: 'Gestion du stress', juridique: 'Connaissances juridiques',
  redaction: 'Rédaction', organisation: 'Organisation', collectif: 'Travail collectif', fiabilite: 'Fiabilité',
  discipline: 'Discipline', leadership: 'Leadership', informatique: 'Maîtrise informatique',
  scientifique: 'Compétences scientifiques', endurance: 'Endurance', experience: 'Expérience',
};

export type Role = 'commandant' | 'officier' | 'enqueteur' | 'agent' | 'technicien' | 'secretaire';
export type Shift = 'jour' | 'nuit' | 'mixte';
export type StaffStatus = 'service' | 'repos' | 'conge' | 'formation' | 'maladie';

export interface Appearance {
  skin: number; // index palette
  hair: number;
  hairStyle: number;
  outfit: number; // couleur vêtement
  build: number; // 0 mince 1 moyen 2 fort
  glasses: boolean;
  beard: boolean;
}

export interface CareerEntry {
  minute: number;
  kind: 'arrivee' | 'affaire' | 'resolue' | 'formation' | 'evaluation' | 'decoration' | 'promotion' | 'mutation' | 'erreur' | 'demande' | 'affectation';
  text: string;
}

export interface Staff {
  id: string;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M';
  birthYear: number;
  entryYear: number;
  grade: string;
  role: Role;
  specialite: string;
  skills: Skills;
  potential: number; // plafond de progression moyen (caché, 10-20)
  ambition: number; // 1-20
  fatigue: number; // 0 reposé → 100 épuisé
  moral: number; // 0-100
  relations: Record<string, number>; // -100..100
  unitId: string | null;
  shift: Shift;
  restDays: number[]; // jours de repos dans la semaine (0 = dimanche)
  astreinte: boolean;
  status: StaffStatus;
  statusUntil: number; // minute de fin du statut (congés, formation…)
  leaveDays: number; // solde de congés
  assignments: string[]; // ids d'affaires
  task: StaffTask | null;
  history: CareerEntry[];
  casesHandled: number;
  casesSolved: number;
  errors: number;
  xp: Partial<Record<SkillKey, number>>; // progression fractionnaire
  appearance: Appearance;
  requests: string[]; // demandes en cours (mutation, promotion…)
  hoursThisWeek: number;
  overtime: number;
}

export interface StaffTask {
  caseId: string | null;
  action: ActionKind | 'pause' | 'admin' | 'accueil' | 'labo' | 'formation' | 'reunion' | 'patrouille';
  label: string;
  room: RoomType;
  outside?: boolean; // hors du commissariat (terrain)
  placeId?: string;
}

// ————— Ville —————
export type DistrictId =
  | 'centre' | 'vieille' | 'pavillons' | 'residentiel' | 'commercial' | 'industrie' | 'gare' | 'campus'
  | 'hopital' | 'rural' | 'foret' | 'villages' | 'axes' | 'tourisme';

export interface District {
  id: DistrictId;
  name: string;
  population: number;
  activity: number; // 0-1 densité d'activité
  x: number; y: number; w: number; h: number; // emprise sur la carte (cases)
}

export type PlaceKind =
  | 'commerce' | 'banque' | 'bar' | 'restaurant' | 'mairie' | 'musee' | 'gare' | 'hopital' | 'universite' | 'usine'
  | 'entrepot' | 'maison' | 'immeuble' | 'eglise' | 'ecole' | 'parc' | 'hotel' | 'ferme' | 'garage' | 'antiquaire'
  | 'notaire' | 'bijouterie' | 'supermarche' | 'commissariat' | 'tribunal' | 'journal' | 'archives' | 'camping';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  district: DistrictId;
  x: number; y: number; // case
  open: number; close: number; // heures d'ouverture (open=close → toujours ouvert/sans objet)
  closedDays: number[];
  floors: number;
}

export interface City {
  name: string;
  population: number;
  size: CitySize;
  w: number; h: number;
  tiles: number[]; // type de sol par case (voir city.ts)
  districts: District[];
  places: Place[];
  roads: number[]; // index de case des routes
}

export type CitySize = 'commune' | 'petite' | 'moyenne' | 'grande' | 'metropole';

// ————— Personnes impliquées dans les affaires (simulées individuellement) —————
export interface Person {
  id: string;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M';
  age: number;
  profession: string;
  district: DistrictId;
  homePlace: string | null;
  sincerity: number; // 0-1 tendance à dire la vérité (n'est jamais liée à la nervosité)
  nervosity: number; // 0-1 nervosité apparente
  cooperation: number; // 0-1
  memory: number; // 0-1 précision du souvenir
  appearance: Appearance;
  record: boolean; // antécédents (n'implique rien)
  cases: string[];
}

// ————— Affaires —————
export type CaseType =
  | 'disparition' | 'vol' | 'cambriolage' | 'escroquerie' | 'fraude_doc' | 'trafic_art' | 'sabotage' | 'extorsion'
  | 'deces_suspect' | 'homicide' | 'financiere' | 'vol_vehicule' | 'numerique' | 'ancien' | 'fausse_declaration';

export type ActionKind =
  | 'constatations' | 'voisinage' | 'entretien' | 'recherche' | 'requisition' | 'perquisition' | 'labo'
  | 'recoupement' | 'audition' | 'rapport';

export type Approach = 'ecoute' | 'ouverte' | 'clarification' | 'chronologie' | 'contradiction' | 'element' | 'confrontation';

export type LabType = 'photo' | 'document' | 'empreintes' | 'biologie' | 'medical' | 'numerique' | 'comparaison' | 'vehicule' | 'authenticite';

export type Nature = 'fait' | 'declaration' | 'analyse' | 'document' | 'hypothese';

export interface Clue {
  id: string;
  nature: Nature;
  text: string;
  action: ActionKind;
  personId?: string;
  labType?: LabType;
  itemId?: string;
  requires?: string[];
  difficulty: number;
  skill: SkillKey;
  approach?: Approach;
  reliable: boolean;
  contradicts?: string[];
  implicates?: { pid: string; w: number }[];
  exculpates?: string[];
  noCrime?: number; // poids en faveur de l'absence d'infraction (accident, départ volontaire…)
  expiresAfterH?: number;
  revealsPerson?: string;
  revealsItem?: string;
  time?: number; // minutes par rapport aux faits (chronologie)
  confession?: boolean;
  links?: string; // id d'un autre dossier lié
  // état d'enquête
  found: boolean;
  foundAt?: number;
  foundBy?: string;
  attempts: number;
}

export interface EvidenceItem {
  id: string;
  label: string;
  labTypes: LabType[];
  collected: boolean;
  collectedAt?: number;
  collectedBy?: string;
  sealed: boolean; // scellé conforme
  location: 'terrain' | 'salle_preuves' | 'labo' | 'parquet';
  chain: { minute: number; text: string }[];
  degraded: boolean;
}

export interface CasePerson {
  pid: string;
  role: 'victime' | 'temoin' | 'suspect' | 'declarant' | 'proche' | 'disparu';
  known: boolean;
  interviewed: number; // nombre d'entretiens
  lastInterview?: number;
  stress: number; // émotion courante 0-1
  lawyer: boolean;
  silent: boolean;
  inCustody: boolean;
  custodyUntil?: number;
  alibi?: string;
  cleared: boolean; // disculpé par l'équipe
}

export interface Truth {
  culprit: string | null;
  accomplice?: string | null;
  kind: 'infraction' | 'accident' | 'volontaire' | 'fausse_declaration' | 'naturel';
  summary: string;
  timeline: { t: number; text: string }[];
}

export type CaseStage =
  | 'signalement' | 'evaluation' | 'attribution' | 'constatations' | 'recherches' | 'entretiens' | 'examens'
  | 'relations' | 'hypotheses' | 'coordination' | 'identification' | 'transmission' | 'jugement' | 'archive';

export interface BoardNote { id: string; text: string; x: number; y: number; kind: 'note' | 'hypothese' }
export interface BoardLink { a: string; b: string; label: string }

export interface PlannedAction {
  id: string;
  kind: ActionKind;
  target?: string; // personId, itemId ou autre
  approach?: Approach;
  hours: number; // charge restante
  total: number;
  by: string[]; // enquêteurs
  proposedBy?: string; // proposée par un enquêteur (supervision assistée)
  approved: boolean;
  started?: number;
  supervised?: boolean; // le joueur mène l'entretien
}

export interface Case {
  id: string;
  number: string; // n° de procédure
  templateId: string;
  type: CaseType;
  title: string;
  summary: string; // signalement
  openedAt: number;
  factsAt: number; // date des faits
  placeId: string;
  district: DistrictId;
  priority: 1 | 2 | 3; // 1 haute
  complexity: number; // 1-5
  urgency: number; // 0-1
  mediaInterest: number; // 0-1
  persons: CasePerson[];
  clues: Clue[];
  items: EvidenceItem[];
  truth: Truth;
  stage: CaseStage;
  status: 'ouverte' | 'transmise' | 'classee' | 'jugee' | 'suspendue';
  lead: string | null;
  team: string[];
  vehicle: string | null;
  budgetSpent: number;
  budgetCap: number;
  actions: PlannedAction[];
  done: { minute: number; text: string; by?: string }[];
  board: { notes: BoardNote[]; links: BoardLink[]; pos: Record<string, { x: number; y: number }> };
  linkedCases: string[];
  hypothesis: { pid: string | null; kind: Truth['kind'] | null };
  auths: { kind: 'requisition' | 'perquisition' | 'garde_a_vue'; target: string; granted: boolean | null; at: number }[];
  outcome?: CaseOutcome;
  reopenCount: number;
  saga?: string;
  procedureFlaws: number;
  deadline?: number; // délai indicatif
  boosts?: { by: string; actions?: ActionKind[]; labTypes?: LabType[]; factor: number; until: number }[]; // appuis des partenaires
  series?: string; // série d'affaires liées (même auteur)
  twist?: string; // variante de déroulement
  workload: number; // heures estimées
  stalledH: number;
}

export interface CaseOutcome {
  decision: 'poursuites' | 'classement_insuffisant' | 'classement_absence' | 'classement_inconnu' | 'complement';
  verdict?: 'condamnation' | 'relaxe' | 'non_lieu' | null;
  designated: string | null;
  correct: boolean; // conformité avec la vérité (inconnue du joueur jusqu'au jugement)
  quality: number; // 0-100
  at: number;
  verdictAt?: number;
  text: string;
}

// ————— Laboratoire —————
export interface LabJob {
  id: string;
  caseId: string;
  itemId: string;
  type: LabType;
  cost: number;
  hoursLeft: number;
  hoursTotal: number;
  external: boolean;
  queuedAt: number;
  priority: number;
  result?: string;
}

// ————— Justice —————
export interface Magistrate {
  id: string;
  prenom: string;
  nom: string;
  role: 'procureur' | 'substitut' | 'juge_instruction' | 'juge_libertes';
  rigueur: number; // 0-1 exigence de preuve
  delai: number; // heures de réponse moyennes
  relation: number; // 0-100
  since: number;
}

export interface JudicialRequest {
  id: string;
  caseId: string;
  kind: 'requisition' | 'perquisition' | 'garde_a_vue' | 'transmission' | 'moyens';
  target: string;
  justification: number;
  sentAt: number;
  answerAt: number;
  magistrateId: string;
  answered: boolean;
}

// ————— Commissariat —————
export type RoomType =
  | 'accueil' | 'commandant' | 'bureaux' | 'briefing' | 'interrogatoire' | 'archives' | 'labo' | 'informatique'
  | 'preuves' | 'radio' | 'vestiaires' | 'repos' | 'cafeteria' | 'garage' | 'formation' | 'supervision'
  | 'ancien' | 'financiere' | 'numerique' | 'liaison' | 'administratif' | 'couloir' | 'escalier'
  | 'cellules' | 'cantine' | 'armurerie' | 'sport' | 'infirmerie' | 'signaletique' | 'presse' | 'ecoutes' | 'tir';

export interface Furniture {
  id: string;
  kind: string;
  x: number; y: number; // case dans l'étage
  rot: 0 | 1;
}

export interface Room {
  id: string;
  type: RoomType;
  floor: number;
  x: number; y: number; w: number; h: number;
  doors: { x: number; y: number }[]; // cases de porte (sur la bordure)
  cut?: { x: number; y: number; w: number; h: number }; // angle retiré (pièce en L)
  furniture: Furniture[];
  built: number; // minute de construction
}

export interface Station {
  w: number; h: number; // emprise constructible par étage
  floors: number;
  lot: { x: number; y: number; w: number; h: number }; // emprise du bâtiment actuel
  rooms: Room[];
}

export interface Vehicle {
  id: string;
  label: string;
  model: string;
  kind: 'banalisee' | 'secours' | 'fourgon' | 'technique';
  year: number;
  condition: number; // 0-100
  km: number;
  busyUntil: number;
  caseId: string | null;
  color: number;
}

// ————— Unités —————
export interface Unit {
  id: string;
  name: string;
  kind: 'generale' | 'disparitions' | 'biens' | 'criminel' | 'financiere' | 'numerique' | 'scientifique' | 'ancien' | 'coordination' | 'analyse';
  chief: string | null;
  domain: CaseType[];
  districts: DistrictId[];
}

// ————— Budget —————
export const BUDGET_CATS = ['equipements', 'vehicules', 'entretien', 'laboratoires', 'informatique', 'formation', 'batiments', 'prestations', 'deplacements', 'operationnel'] as const;
export type BudgetCat = (typeof BUDGET_CATS)[number];

export interface Budget {
  year: number;
  envelope: Record<BudgetCat, number>;
  spent: Record<BudgetCat, number>;
  payroll: number; // masse salariale annuelle (suivi séparé)
  payrollPaid: number;
  requests: { id: string; cat: BudgetCat; amount: number; reason: string; sentAt: number; answerAt: number; granted: number | null }[];
  history: { year: number; envelope: number; spent: number; payroll: number }[];
}

// ————— Médias —————
export interface Article {
  id: string;
  outlet: string;
  minute: number;
  title: string;
  body: string;
  tone: number; // -1 critique … +1 favorable
  caseId?: string;
  rectified?: boolean;
  erroneous?: boolean;
}

export interface MediaRequest { id: string; outlet: string; caseId: string; at: number; until: number; answered: boolean }

// ————— Événements —————
export interface CityEvent {
  id: string;
  kind: 'sport' | 'festival' | 'tourisme' | 'tempete' | 'panne' | 'route' | 'magistrat' | 'reorganisation' | 'restriction' | 'depart' | 'reouverture' | 'mediatique' | 'neige' | 'canicule';
  title: string;
  text: string;
  start: number;
  end: number;
  district?: DistrictId;
  incidentFactor: number;
}

export interface Notice {
  id: string;
  minute: number;
  level: 'info' | 'alerte' | 'urgent' | 'succes';
  text: string;
  caseId?: string;
  staffId?: string;
  read: boolean;
}

export interface Candidate {
  staff: Staff;
  source: 'sortie_ecole' | 'mutation' | 'specialiste';
  availableFrom: number;
  interviewed: boolean;
  requested: boolean;
}

export interface Commander {
  prenom: string;
  nom: string;
  age: number;
  portrait: number;
  experience: 'debutant' | 'confirme' | 'chevronne';
  formation: 'ecole' | 'rang' | 'universite';
  specialite: string;
  reputation: number; // 0-100
  style: 'participatif' | 'directif' | 'delegatif' | 'bienveillant';
  grade: string;
  appearance: Appearance;
  sexe: 'F' | 'M';
}

export interface DailyStat {
  day: number;
  open: number;
  closed: number;
  solved: number;
  moral: number;
  fatigue: number;
  spent: number;
  labQueue: number;
  load: number;
  satisfaction: number;
}

export interface Settings {
  assist: 'manuel' | 'assiste' | 'delegation';
  autoPause: boolean;
  speed: number;
}

export interface GameState {
  version: number;
  seed: number;
  rng: number;
  startYear: number;
  minute: number; // minutes écoulées depuis le 2 janvier de l'année de départ, 00h00
  commander: Commander;
  city: City;
  station: Station;
  staff: Staff[];
  units: Unit[];
  vehicles: Vehicle[];
  people: Record<string, Person>;
  cases: Case[];
  lab: { queue: LabJob[]; done: number; externalUsed: number };
  magistrates: Magistrate[];
  requests: JudicialRequest[];
  budget: Budget;
  articles: Article[];
  mediaRequests: MediaRequest[];
  publicTrust: number; // 0-100
  events: CityEvent[];
  notices: Notice[];
  candidates: Candidate[];
  stats: DailyStat[];
  settings: Settings;
  counters: Record<string, number>;
  weather: { kind: 'clair' | 'nuageux' | 'pluie' | 'orage' | 'neige' | 'brouillard'; temp: number; until: number };
  saga: { started: boolean; stepsSpawned: number; resolved: boolean };
  scenario: 'saint-clair' | 'libre';
  reception: { visitors: number; satisfied: number };
  techs: string[];
  network?: import('./network').Network;
  partners?: import('./partners').PartnersState;
  summit?: import('./summit').SummitState;
  tutorial?: { on: boolean; step: number };
  series?: { tpl: string; culprit: string; caseId: string; due: number; left: number }[]; // affaires en série à venir (même auteur)
  hierarchy: {
    evaluations: { year: number; note: number; text: string }[];
    rank: number;
    postSince: number;
    offers: { id: string; at: number; expires: number; toRank: number; options: ({ kind: 'surplace' } | { kind: 'mutation'; city: string; size: CitySize } | { kind: 'retour'; city: string; size: CitySize })[]; answered: boolean; text: string }[];
    pastCities?: { city: string; size: CitySize; leftAt: number }[];
    career: { minute: number; year: number; rank: number; city: string; text: string }[];
    retired: boolean;
  };
}
