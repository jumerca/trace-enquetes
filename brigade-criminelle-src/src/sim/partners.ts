// Partenaires institutionnels : des personnages avec qui le commandant traite directement.
// Ils sollicitent la brigade (demandes à arbitrer) et peuvent être sollicités en retour
// (appuis concrets sur une affaire). La qualité de la relation conditionne leur aide.
import type { Rng } from '../core/rng';
import { calendar, MIN_D, MIN_H } from './calendar';
import { spend } from './finance';
import { notify } from './log';
import { randomAppearance, randomName } from './names';
import { fullName, isOnDuty } from './staff';
import { discover } from './investigation';
import type { ActionKind, Appearance, BudgetCat, Case, CaseType, GameState, LabType } from './types';

export type PartnerKind = 'legiste' | 'gendarmerie' | 'mairie' | 'hopital' | 'social' | 'banque';

export interface Partner {
  kind: PartnerKind;
  prenom: string;
  nom: string;
  sexe: 'F' | 'M';
  appearance: Appearance;
  relation: number; // 0-100
  since: number;
  busyUntil: number; // indisponible pour une nouvelle sollicitation
  favours: number; // services rendus par la brigade non encore « rendus »
  lastLine?: string;
}

export interface PartnerEffect {
  relation?: number;
  trust?: number;
  reputation?: number;
  budget?: { cat: BudgetCat; amount: number }; // dépense (positive) ou recette (négative)
  lend?: { roles: ('agent' | 'enqueteur' | 'technicien')[]; count: number; hours: number; label: string };
  flaw?: number;
  spawn?: CaseType[];
  tip?: boolean; // un renseignement fait avancer une affaire ouverte
  text: string;
}

export interface PartnerRequest {
  id: string;
  partner: PartnerKind;
  at: number;
  expires: number;
  title: string;
  quote: string;
  options: { label: string; effect: PartnerEffect }[];
  ignore: PartnerEffect;
  answered: boolean;
  outcome?: string;
}

export interface PartnersState {
  list: Partner[];
  requests: PartnerRequest[];
  history: { minute: number; partner: PartnerKind; text: string }[];
}

export const PARTNER_INFO: Record<PartnerKind, { org: (y: number) => string; title: (p: Partner) => string; look: 'medecin' | 'uniforme' | 'costume' | 'civil'; help: string }> = {
  legiste: { org: () => 'Institut médico-légal', title: (p) => `Dr ${p.nom}`, look: 'medecin', help: 'Examens médico-légaux, autopsies, avis sur les causes de décès.' },
  gendarmerie: { org: () => 'Groupement de gendarmerie', title: (p) => `Lieutenant-colonel ${p.nom}`, look: 'uniforme', help: 'Zones rurales, opérations conjointes, renseignements de terrain.' },
  mairie: { org: (y) => (y >= 2000 ? 'Mairie — police municipale et vidéoprotection' : 'Mairie'), title: (p) => `${p.sexe === 'F' ? 'Mme' : 'M.'} ${p.nom}, maire`, look: 'costume', help: 'Images de vidéoprotection, registres municipaux, subventions locales, ordre public.' },
  hopital: { org: () => 'Centre hospitalier', title: (p) => `${p.sexe === 'F' ? 'Mme' : 'M.'} ${p.nom}, directeur${p.sexe === 'F' ? 'rice' : ''}`, look: 'costume', help: 'Admissions, signalements, constatations médicales sur les victimes.' },
  social: { org: () => 'Services sociaux du département', title: (p) => `${p.prenom} ${p.nom}, cheffe de service`.replace('cheffe', p.sexe === 'F' ? 'cheffe' : 'chef'), look: 'civil', help: 'Personnes vulnérables, mineurs, disparitions, accompagnement des victimes.' },
  banque: { org: (y) => (y < 1990 ? 'Banques et PTT' : y < 2005 ? 'Banques et opérateurs téléphoniques' : 'Banques, opérateurs et plateformes'), title: (p) => `${p.sexe === 'F' ? 'Mme' : 'M.'} ${p.nom}, correspondant${p.sexe === 'F' ? 'e' : ''} réquisitions`, look: 'costume', help: 'Relevés bancaires, téléphoniques et numériques sur réquisition.' },
};

export const PARTNER_LABEL: Record<PartnerKind, string> = {
  legiste: 'Médecin légiste', gendarmerie: 'Gendarmerie', mairie: 'Mairie', hopital: 'Hôpital', social: 'Services sociaux', banque: 'Banques et opérateurs',
};

export function ensurePartners(st: GameState, rng: Rng): PartnersState {
  if (st.partners) return st.partners;
  const kinds: PartnerKind[] = ['legiste', 'gendarmerie', 'mairie', 'hopital', 'social', 'banque'];
  st.partners = {
    list: kinds.map((kind) => {
      const sexe: 'F' | 'M' = kind === 'social' ? (rng.chance(0.75) ? 'F' : 'M') : rng.chance(0.4) ? 'F' : 'M';
      const n = randomName(rng, sexe);
      return { kind, ...n, sexe, appearance: randomAppearance(rng, sexe, rng.int(38, 60)), relation: rng.int(45, 60), since: st.minute, busyUntil: 0, favours: 0 };
    }),
    requests: [],
    history: [],
  };
  return st.partners;
}

export function partner(st: GameState, k: PartnerKind): Partner | undefined {
  return st.partners?.list.find((p) => p.kind === k);
}

export function partnerName(p: Partner, year: number) {
  return `${PARTNER_INFO[p.kind].title(p)} (${PARTNER_INFO[p.kind].org(year)})`;
}

// ————— Sollicitations par la brigade —————
export interface Solicitation {
  id: string;
  partner: PartnerKind;
  label: string;
  text: string;
  minYear?: number;
  forCase: boolean;
  caseTypes?: CaseType[];
  actions?: ActionKind[];
  labTypes?: LabType[];
  factor: number;
  days: number;
  cost: number; // coût en relation (service demandé)
}

export const SOLICITATIONS: Solicitation[] = [
  { id: 'autopsie', partner: 'legiste', label: 'Examen prioritaire', text: 'Le légiste fait passer vos examens médicaux et biologiques en priorité.', forCase: true, caseTypes: ['deces_suspect', 'homicide', 'disparition', 'ancien'], labTypes: ['medical', 'biologie'], factor: 2.4, days: 4, cost: 10 },
  { id: 'conjointe', partner: 'gendarmerie', label: 'Opération conjointe', text: 'Une patrouille de gendarmerie appuie vos recherches et perquisitions sur le terrain.', forCase: true, actions: ['perquisition', 'recherche', 'voisinage', 'constatations'], factor: 1.6, days: 3, cost: 12 },
  { id: 'video', partner: 'mairie', label: 'Images et registres municipaux', text: 'La mairie communique ses registres (et, selon l\'époque, les images de vidéoprotection).', forCase: true, actions: ['recherche', 'recoupement', 'voisinage'], factor: 1.5, days: 3, cost: 8 },
  { id: 'subvention', partner: 'mairie', label: 'Participation aux travaux', text: 'Demander à la commune de participer aux travaux du commissariat.', forCase: false, factor: 1, days: 0, cost: 18 },
  { id: 'dossiermed', partner: 'hopital', label: 'Signalements et admissions', text: 'L\'hôpital vérifie ses admissions et facilite les entretiens avec les victimes hospitalisées.', forCase: true, caseTypes: ['disparition', 'deces_suspect', 'homicide', 'extorsion', 'sabotage'], actions: ['entretien', 'recherche', 'audition'], factor: 1.5, days: 3, cost: 8 },
  { id: 'social', partner: 'social', label: 'Appui des services sociaux', text: 'Les services sociaux orientent vos enquêteurs dans l\'entourage des personnes vulnérables.', forCase: true, caseTypes: ['disparition', 'escroquerie', 'fausse_declaration', 'extorsion'], actions: ['entretien', 'voisinage', 'recherche'], factor: 1.5, days: 4, cost: 8 },
  { id: 'requis', partner: 'banque', label: 'Réponse accélérée aux réquisitions', text: 'Le correspondant traite vos réquisitions bancaires et téléphoniques en priorité.', forCase: true, actions: ['requisition', 'recoupement'], labTypes: ['numerique', 'document'], factor: 1.9, days: 4, cost: 10 },
];

/** Probabilité qu'un partenaire accepte une sollicitation, selon la relation et les services rendus. */
export function acceptChance(p: Partner): number {
  return Math.max(0.15, Math.min(0.97, 0.3 + p.relation / 100 * 0.6 + p.favours * 0.06));
}

export function solicit(st: GameState, rng: Rng, sid: string, caseId?: string): { ok: boolean; text: string } {
  const so = SOLICITATIONS.find((x) => x.id === sid);
  const ps = ensurePartners(st, rng);
  const p = ps.list.find((x) => x.kind === so?.partner);
  if (!so || !p) return { ok: false, text: 'Sollicitation inconnue.' };
  if (p.busyUntil > st.minute) return { ok: false, text: `${PARTNER_INFO[p.kind].title(p)} a déjà été sollicité récemment.` };
  const c = caseId ? st.cases.find((x) => x.id === caseId) : undefined;
  if (so.forCase && (!c || c.status !== 'ouverte')) return { ok: false, text: 'Choisissez une affaire en cours.' };
  p.busyUntil = st.minute + 2 * MIN_D;
  const title = PARTNER_INFO[p.kind].title(p);
  if (!rng.chance(acceptChance(p))) {
    p.relation = Math.max(0, p.relation - 2);
    const line = rng.pick(['Je regrette, commandant, nous sommes débordés cette semaine.', 'Pas cette fois. Rappelez-moi quand vous aurez un dossier plus solide.', 'Faites une demande écrite, je verrai ce que je peux faire.']);
    p.lastLine = line;
    log(st, p.kind, `${title} décline : « ${line} »`);
    return { ok: false, text: `${title} : « ${line} »` };
  }
  p.relation = Math.max(0, p.relation - so.cost * (p.favours > 0 ? 0.5 : 1));
  p.favours = Math.max(0, p.favours - 1);
  const line = rng.pick(['Entendu, je m\'en occupe personnellement.', 'D\'accord. Vous me revaudrez ça.', 'C\'est noté, mes équipes sont prévenues.', 'Pour vous, je fais le nécessaire.']);
  p.lastLine = line;
  if (so.id === 'subvention') {
    const year = calendar(st.startYear, st.minute).year;
    const amount = Math.round((15000 + st.city.population / 20) * (year < 1990 ? 0.5 : year < 2005 ? 0.8 : 1) / 500) * 500;
    st.budget.envelope.batiments += amount;
    log(st, p.kind, `${title} accorde ${amount.toLocaleString('fr-FR')} € de participation aux travaux.`);
    return { ok: true, text: `${title} : « ${line} » La commune verse ${amount.toLocaleString('fr-FR')} € (crédits de bâtiments).` };
  }
  c!.boosts = (c!.boosts ?? []).filter((b) => b.until > st.minute);
  c!.boosts.push({ by: p.kind, actions: so.actions, labTypes: so.labTypes, factor: so.factor, until: st.minute + so.days * MIN_D });
  if (so.labTypes) for (const j of st.lab.queue) if (j.caseId === c!.id && so.labTypes.includes(j.type)) j.priority = 0;
  c!.done.push({ minute: st.minute, text: `${title} (${PARTNER_LABEL[p.kind]}) : ${so.text}` });
  log(st, p.kind, `${so.label} accordé pour le dossier ${c!.number}.`);
  return { ok: true, text: `${title} : « ${line} » ${so.text}` };
}

/** Multiplicateur de vitesse d'une action grâce aux appuis en cours sur l'affaire. */
export function partnerBoost(st: GameState, c: Case, kind: ActionKind): number {
  if (!c.boosts?.length) return 1;
  let f = 1;
  for (const b of c.boosts) if (b.until > st.minute && b.actions?.includes(kind)) f = Math.max(f, b.factor);
  return f;
}
export function partnerLabBoost(st: GameState, caseId: string, type: LabType): number {
  const c = st.cases.find((x) => x.id === caseId);
  let f = 1;
  if (c?.boosts) for (const b of c.boosts) if (b.until > st.minute && b.labTypes?.includes(type)) f = Math.max(f, b.factor);
  // la qualité de la relation avec le légiste joue sur les examens médicaux
  if (type === 'medical') { const p = partner(st, 'legiste'); if (p) f *= 0.85 + p.relation / 100 * 0.3; }
  return f;
}
/** Effet passif de la relation avec la gendarmerie sur l'incidence dans les zones rurales. */
export function ruralFactor(st: GameState): number {
  const p = partner(st, 'gendarmerie');
  return p ? 1.1 - p.relation / 100 * 0.25 : 1;
}

// ————— Demandes des partenaires —————
type Gen = (st: GameState, rng: Rng, p: Partner, year: number) => Omit<PartnerRequest, 'id' | 'at' | 'expires' | 'answered' | 'partner'> | null;

const GENS: Record<PartnerKind, Gen[]> = {
  mairie: [
    (_st, rng) => ({
      title: 'Sécurisation d\'une manifestation', quote: rng.pick(['Commandant, la fête de quartier attire beaucoup de monde samedi. J\'aimerais voir vos agents sur place.', 'Le marché de nuit reprend : les commerçants s\'inquiètent. Pouvez-vous être visibles ?']),
      options: [
        { label: 'Détacher deux agents pour la journée', effect: { relation: 12, trust: 2, lend: { roles: ['agent'], count: 2, hours: 10, label: 'Sécurisation d\'une manifestation' }, text: 'Deux agents sécurisent la manifestation. Le maire remercie publiquement la brigade.' } },
        { label: 'Une patrouille de passage seulement', effect: { relation: 4, text: 'Une patrouille passe en fin de journée. Le maire s\'en contente.' } },
      ],
      ignore: { relation: -8, trust: -1, text: 'Aucune présence policière : le maire s\'en plaint dans la presse locale.' },
    }),
    (st, rng) => {
      const c = rng.pick(st.cases.filter((x) => x.status === 'ouverte' && x.mediaInterest > 0.3).concat(st.cases.filter((x) => x.status === 'ouverte')).slice(0, 4));
      if (!c) return null;
      return {
        title: `Le maire veut des nouvelles du dossier ${c.number}`, quote: `Je suis harcelé par les administrés au sujet de « ${c.title} ». Dites-moi où vous en êtes, entre nous.`,
        options: [
          { label: 'Rappeler le secret de l\'enquête', effect: { relation: -4, reputation: 1, text: 'Le maire est vexé, mais la procédure est respectée.' } },
          { label: 'Donner les grandes lignes « entre nous »', effect: { relation: 10, flaw: 1, trust: -1, text: 'Le maire est satisfait… et quelques détails se retrouvent dans la presse.' } },
          { label: 'Proposer un point public avec le parquet', effect: { relation: 5, trust: 2, text: 'Un point presse commun rassure la population sans rien compromettre.' } },
        ],
        ignore: { relation: -6, text: 'Le maire n\'a pas eu de réponse et le fait savoir.' },
      };
    },
    (_st, _rng, _p, year) => ({
      title: 'Conseil local de sécurité', quote: `Nous réunissons le conseil ${year >= 2000 ? 'local de sécurité et de prévention de la délinquance' : 'communal de prévention'} jeudi. Votre présence serait appréciée.`,
      options: [
        { label: 'Y assister personnellement', effect: { relation: 9, trust: 1, text: 'Vous présentez le bilan de la brigade. Les élus sont attentifs.' } },
        { label: 'Envoyer un officier', effect: { relation: 4, lend: { roles: ['enqueteur'], count: 1, hours: 4, label: 'Conseil local de sécurité' }, text: 'Un officier représente la brigade.' } },
      ],
      ignore: { relation: -7, text: 'Votre absence au conseil est remarquée.' },
    }),
  ],
  gendarmerie: [
    (_st, rng) => ({
      title: 'Appui sur une affaire en limite de zone', quote: rng.pick(['Nous avons un dossier qui déborde sur votre ressort. Un enquêteur à vous connaît le terrain : vous pouvez nous le prêter deux jours ?', 'Une série de vols touche les deux zones. Travaillons ensemble : prêtez-moi un enquêteur.']),
      options: [
        { label: 'Prêter un enquêteur deux jours', effect: { relation: 14, lend: { roles: ['enqueteur'], count: 1, hours: 20, label: 'Appui à la gendarmerie' }, tip: true, text: 'Votre enquêteur rend service et revient avec un renseignement utile.' } },
        { label: 'Échanger seulement les informations', effect: { relation: 5, text: 'Les fichiers sont recoupés par téléphone.' } },
      ],
      ignore: { relation: -9, text: 'La gendarmerie gardera ses renseignements pour elle.' },
    }),
    (_st, _rng) => ({
      title: 'Renseignement transmis', quote: 'Mes hommes ont relevé un véhicule suspect près d\'un de vos lieux d\'enquête. Je vous transmets la fiche ; on se tient au courant ?',
      options: [
        { label: 'Remercier et partager en retour', effect: { relation: 8, tip: true, text: 'Le renseignement est versé au dossier le plus avancé.' } },
        { label: 'Prendre la fiche sans plus', effect: { relation: -2, tip: true, text: 'La fiche est exploitée.' } },
      ],
      ignore: { relation: -4, text: 'La fiche reste sans réponse.' },
    }),
  ],
  legiste: [
    (_st, _rng) => ({
      title: 'Présence à une autopsie', quote: 'J\'ai besoin qu\'un de vos enquêteurs assiste à l\'examen de demain matin, pour la procédure et les scellés.',
      options: [
        { label: 'Envoyer un enquêteur', effect: { relation: 11, lend: { roles: ['enqueteur'], count: 1, hours: 4, label: 'Assistance à une autopsie' }, text: 'Votre enquêteur assiste à l\'examen ; la chaîne des scellés est irréprochable.' } },
      ],
      ignore: { relation: -10, flaw: 1, text: 'Personne ne s\'est présenté : le procès-verbal est incomplet.' },
    }),
    (st, _rng, _p, year) => {
      const amount = Math.round((year < 1990 ? 600 : year < 2005 ? 1100 : 1600) * (1 + st.hierarchy.rank * 0.4));
      return {
        title: 'Actes médico-légaux impayés', quote: `Mes actes du trimestre ne sont toujours pas réglés : ${amount.toLocaleString('fr-FR')} €. Je ne peux pas continuer à travailler à crédit.`,
        options: [
          { label: `Régler ${amount.toLocaleString('fr-FR')} € (prestations)`, effect: { relation: 10, budget: { cat: 'prestations', amount }, text: 'La facture est réglée ; les examens reprennent à bon rythme.' } },
          { label: 'Demander un délai', effect: { relation: -5, text: 'Le légiste accepte un délai, sans enthousiasme.' } },
        ],
        ignore: { relation: -12, text: 'Le légiste suspend ses examens non urgents pour la brigade.' },
      };
    },
  ],
  hopital: [
    (_st, rng) => ({
      title: 'Incidents aux urgences', quote: rng.pick(['Mes équipes des urgences sont agressées la nuit. Pouvez-vous organiser des passages ?', 'Un patient agité menace le personnel : j\'ai besoin d\'une présence policière.']),
      options: [
        { label: 'Organiser des passages de nuit', effect: { relation: 12, trust: 1, lend: { roles: ['agent'], count: 1, hours: 8, label: 'Présence aux urgences' }, text: 'Les passages rassurent le personnel soignant.' } },
        { label: 'Conseiller un dépôt de plainte', effect: { relation: -3, text: 'La direction de l\'hôpital trouve la réponse un peu courte.' } },
      ],
      ignore: { relation: -8, trust: -1, text: 'Le personnel de l\'hôpital se sent abandonné.' },
    }),
  ],
  social: [
    (_st, _rng) => ({
      title: 'Personne vulnérable en danger', quote: 'Une personne âgée isolée reçoit des visites suspectes et vide ses comptes. Pouvez-vous intervenir ?',
      options: [
        { label: 'Ouvrir une enquête', effect: { relation: 12, trust: 2, spawn: ['escroquerie'], text: 'Un dossier est ouvert sur le signalement des services sociaux.' } },
        { label: 'Orienter vers le parquet', effect: { relation: 2, text: 'Le signalement est transmis au parquet.' } },
      ],
      ignore: { relation: -9, trust: -2, text: 'Le signalement est resté sans suite.' },
    }),
    (_st, _rng) => ({
      title: 'Fugue d\'un mineur placé', quote: 'Un adolescent a quitté son foyer depuis hier soir. Il n\'a jamais fugué. Je suis inquiète.',
      options: [
        { label: 'Lancer les recherches', effect: { relation: 12, trust: 2, spawn: ['disparition'], text: 'Un dossier de disparition est ouvert immédiatement.' } },
        { label: 'Diffuser un avis de recherche', effect: { relation: 4, text: 'L\'avis est diffusé aux patrouilles.' } },
      ],
      ignore: { relation: -10, trust: -2, text: 'Les services sociaux saisissent directement le parquet.' },
    }),
  ],
  banque: [
    (_st, _rng, _p, year) => ({
      title: year < 1995 ? 'Signalement de chèques volés' : year < 2010 ? 'Alerte de fraude à la carte' : 'Alerte de fraude en ligne',
      quote: 'Notre service de contrôle a détecté des opérations anormales sur plusieurs comptes de la ville. Voulez-vous la note détaillée ?',
      options: [
        { label: 'Ouvrir une enquête', effect: { relation: 10, spawn: year >= 2000 ? ['numerique', 'escroquerie'] : ['escroquerie', 'financiere'], text: 'Un dossier est ouvert à partir de la note bancaire.' } },
        { label: 'Classer la note pour l\'instant', effect: { relation: -3, text: 'La note est archivée.' } },
      ],
      ignore: { relation: -5, text: 'La banque transmet directement au parquet.' },
    }),
    (_st, _rng) => ({
      title: 'Réquisitions trop nombreuses', quote: 'Vos réquisitions arrivent incomplètes et sans référence. Mes équipes perdent un temps fou.',
      options: [
        { label: 'Former un enquêteur aux réquisitions', effect: { relation: 10, lend: { roles: ['enqueteur'], count: 1, hours: 6, label: 'Formation aux réquisitions' }, text: 'Les échanges sont harmonisés ; les réponses arrivent plus vite.' } },
        { label: 'Défendre vos procédures', effect: { relation: -4, text: 'Le correspondant n\'est pas convaincu.' } },
      ],
      ignore: { relation: -6, text: 'Les réponses aux réquisitions vont ralentir.' },
    }),
  ],
};

function log(st: GameState, k: PartnerKind, text: string) {
  const ps = st.partners!;
  ps.history.push({ minute: st.minute, partner: k, text });
  if (ps.history.length > 80) ps.history.splice(0, ps.history.length - 80);
}

export function partnersDaily(st: GameState, rng: Rng, spawn: (types: CaseType[]) => Case | null) {
  const ps = ensurePartners(st, rng);
  const year = calendar(st.startYear, st.minute).year;
  // demandes expirées
  for (const r of ps.requests) if (!r.answered && r.expires <= st.minute) {
    r.answered = true;
    r.outcome = applyEffect(st, rng, r.partner, r.ignore, spawn);
  }
  ps.requests = ps.requests.filter((r) => !r.answered || st.minute - r.at < 20 * MIN_D).slice(-30);
  // relations : retour lent vers la moyenne
  for (const p of ps.list) p.relation += (50 - p.relation) * 0.004;
  // nouvelle demande (environ une tous les 4 à 5 jours ; plus fréquentes dans les grands ressorts)
  const pending = ps.requests.filter((r) => !r.answered).length;
  if (pending < 3 && rng.chance(0.085 + st.hierarchy.rank * 0.015)) {
    const p = rng.pick(ps.list);
    const gen = rng.pick(GENS[p.kind]);
    const r = gen(st, rng, p, year);
    if (r) {
      const req: PartnerRequest = { id: `PR${++st.counters.notice}`, partner: p.kind, at: st.minute, expires: st.minute + 3 * MIN_D, answered: false, ...r };
      ps.requests.push(req);
      notify(st, { level: 'alerte', text: `${PARTNER_INFO[p.kind].title(p)} (${PARTNER_LABEL[p.kind]}) : ${r.title}. Répondez dans le menu Partenaires.` });
      // en délégation avancée, l'adjoint répond de façon prudente
      if (st.settings.assist === 'delegation') {
        // l'adjoint ménage l'équipe quand elle est fatiguée : il évite alors de prêter du monde
        const tired = st.staff.reduce((t, s) => t + s.fatigue, 0) / Math.max(1, st.staff.length) > 50;
        const k = tired ? Math.max(0, req.options.findIndex((o) => !o.effect.lend)) : 0;
        answerRequest(st, rng, req.id, k, spawn);
      }
    }
  }
}

export function answerRequest(st: GameState, rng: Rng, rid: string, opt: number, spawn: (types: CaseType[]) => Case | null): string {
  const ps = ensurePartners(st, rng);
  const r = ps.requests.find((x) => x.id === rid);
  if (!r || r.answered) return '';
  const o = r.options[opt];
  if (!o) return '';
  r.answered = true;
  r.outcome = applyEffect(st, rng, r.partner, o.effect, spawn);
  return r.outcome;
}

function applyEffect(st: GameState, rng: Rng, k: PartnerKind, e: PartnerEffect, spawn: (types: CaseType[]) => Case | null): string {
  const p = partner(st, k)!;
  let text = e.text;
  if (e.lend) {
    const pool = st.staff.filter((s) => e.lend!.roles.includes(s.role as never) && s.status === 'service' && isOnDuty(s, st));
    const pool2 = pool.length ? pool : st.staff.filter((s) => e.lend!.roles.includes(s.role as never) && s.status === 'service');
    const chosen = [...pool2].sort((a, b) => a.assignments.length - b.assignments.length).slice(0, e.lend.count);
    if (chosen.length < e.lend.count) {
      text = 'Personne n\'est disponible : la brigade ne peut pas honorer sa promesse.';
      p.relation = Math.max(0, Math.min(100, p.relation - 6));
      log(st, k, text);
      return text;
    }
    for (const s of chosen) {
      s.status = 'formation';
      s.statusUntil = st.minute + e.lend.hours * MIN_H;
      s.history.push({ minute: st.minute, kind: 'affectation', text: `${e.lend.label}.` });
    }
    text += ` (${chosen.map(fullName).join(', ')})`;
  }
  if (e.relation) {
    p.relation = Math.max(0, Math.min(100, p.relation + e.relation));
    if (e.relation > 0) p.favours = Math.min(3, p.favours + 1);
  }
  if (e.trust) st.publicTrust = Math.max(0, Math.min(100, st.publicTrust + e.trust));
  if (e.reputation) st.commander.reputation = Math.max(0, Math.min(100, st.commander.reputation + e.reputation));
  if (e.budget) spend(st, e.budget.cat, e.budget.amount);
  if (e.flaw) { const c = st.cases.find((x) => x.status === 'ouverte'); if (c) c.procedureFlaws += e.flaw; }
  if (e.spawn) { const c = spawn(e.spawn); if (c) { c.done.push({ minute: st.minute, text: `Signalement transmis par ${PARTNER_INFO[k].title(p)} (${PARTNER_LABEL[k]}).` }); text += ` Dossier ${c.number}.` } }
  if (e.tip) {
    // un renseignement fait progresser l'affaire ouverte la plus avancée : un élément accessible est trouvé
    const open = st.cases.filter((c) => c.status === 'ouverte' && c.lead);
    const order = [...open].sort(() => rng.next() - 0.5);
    for (const c of order) {
      const cl = c.clues.find((x) => !x.found && (x.action === 'recherche' || x.action === 'voisinage' || x.action === 'recoupement') && (!x.requires || x.requires.every((r) => c.clues.find((y) => y.id === r)?.found)) && !x.confession);
      if (cl) {
        c.done.push({ minute: st.minute, text: `Renseignement transmis (${PARTNER_LABEL[k]}).` });
        cl.attempts++;
        discover(st, c, cl, undefined);
        text += ` Renseignement versé au dossier ${c.number}.`;
        break;
      }
    }
  }
  log(st, k, text);
  return text;
}
