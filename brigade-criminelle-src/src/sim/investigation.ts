// Cycle d'enquête : actions d'investigation, découverte des informations, erreurs,
// IA des enquêteurs (propositions et décisions autonomes selon le niveau d'assistance).
import type { Rng } from '../core/rng';
import { calendar, eraOf, MIN_H } from './calendar';
import { charges, contradictions, found, isContradicted, noCrimeWeight, suspicionRanking } from './knowledge';
import { caseLog, notify } from './log';
import { spend } from './finance';
import { condition, eff, fullName, gainXp, load, capacity } from './staff';
import { PROOF } from './cases/builder';
import { capacities } from './station';
import type { ActionKind, Approach, Case, Clue, GameState, LabType, PlannedAction, RoomType, SkillKey, Staff } from './types';

export interface ActionDef {
  label: string;
  verb: string;
  hours: number;
  skills: SkillKey[];
  room: RoomType;
  outside: boolean;
  vehicle: boolean;
  cost: number;
  auth?: 'requisition' | 'perquisition' | 'garde_a_vue';
  target: 'person' | 'item' | 'none';
}

export const ACTIONS: Record<ActionKind, ActionDef> = {
  constatations: { label: 'Premières constatations', verb: 'procéder aux constatations', hours: 4, skills: ['observation', 'scientifique'], room: 'garage', outside: true, vehicle: true, cost: 45, target: 'none' },
  voisinage: { label: 'Enquête de voisinage', verb: 'mener l\'enquête de voisinage', hours: 5, skills: ['investigation', 'entretien'], room: 'garage', outside: true, vehicle: true, cost: 35, target: 'none' },
  entretien: { label: 'Entretien', verb: 'entendre', hours: 2, skills: ['entretien', 'psychologie'], room: 'interrogatoire', outside: false, vehicle: false, cost: 0, target: 'person' },
  recherche: { label: 'Recherches et vérifications', verb: 'mener des recherches documentaires', hours: 4, skills: ['investigation', 'analyse', 'informatique'], room: 'archives', outside: false, vehicle: false, cost: 10, target: 'none' },
  requisition: { label: 'Réquisition (relevés)', verb: 'exploiter les relevés obtenus sur réquisition', hours: 3, skills: ['analyse', 'juridique'], room: 'bureaux', outside: false, vehicle: false, cost: 60, auth: 'requisition', target: 'person' },
  perquisition: { label: 'Perquisition', verb: 'perquisitionner', hours: 5, skills: ['observation', 'juridique'], room: 'garage', outside: true, vehicle: true, cost: 70, auth: 'perquisition', target: 'person' },
  labo: { label: 'Envoi au laboratoire', verb: 'conditionner et transmettre au laboratoire', hours: 1, skills: ['scientifique', 'fiabilite'], room: 'preuves', outside: false, vehicle: false, cost: 0, target: 'item' },
  recoupement: { label: 'Recoupement et analyse des relations', verb: 'recouper les informations', hours: 3, skills: ['deduction', 'analyse'], room: 'briefing', outside: false, vehicle: false, cost: 0, target: 'none' },
  audition: { label: 'Audition en garde à vue', verb: 'auditionner en garde à vue', hours: 4, skills: ['psychologie', 'entretien', 'juridique'], room: 'interrogatoire', outside: false, vehicle: false, cost: 20, auth: 'garde_a_vue', target: 'person' },
  rapport: { label: 'Rédaction du rapport de synthèse', verb: 'rédiger le rapport', hours: 4, skills: ['redaction', 'juridique'], room: 'bureaux', outside: false, vehicle: false, cost: 0, target: 'none' },
};

const sig = (x: number) => 1 / (1 + Math.exp(-x));

export function teamSkill(st: GameState, by: string[], skills: SkillKey[]): number {
  const members = by.map((id) => st.staff.find((s) => s.id === id)).filter(Boolean) as Staff[];
  if (!members.length) return 0;
  const per = members.map((m) => skills.reduce((s, k) => s + eff(m, k), 0) / skills.length).sort((a, b) => b - a);
  // le meilleur mène ; les autres apportent un complément selon le travail collectif
  const collab = members.reduce((s, m) => s + m.skills.collectif, 0) / members.length;
  return per[0] + per.slice(1).reduce((s, v) => s + v * 0.12 * (collab / 12), 0);
}

export function authGranted(c: Case, kind: 'requisition' | 'perquisition' | 'garde_a_vue', target: string) {
  return c.auths.some((a) => a.kind === kind && a.target === target && a.granted === true);
}
export function authPending(c: Case, kind: string, target: string) {
  return c.auths.some((a) => a.kind === kind && a.target === target && a.granted === null);
}

/** Actions possibles à ce stade, du point de vue de l'équipe (sans lire la vérité). */
export function availableActions(st: GameState, c: Case): { kind: ActionKind; target?: string; label: string; blocked?: string }[] {
  const out: { kind: ActionKind; target?: string; label: string; blocked?: string }[] = [];
  const era = eraOf(calendar(st.startYear, st.minute).year);
  out.push({ kind: 'constatations', label: ACTIONS.constatations.label });
  out.push({ kind: 'voisinage', label: ACTIONS.voisinage.label });
  out.push({ kind: 'recherche', label: ACTIONS.recherche.label });
  out.push({ kind: 'recoupement', label: ACTIONS.recoupement.label });
  for (const p of c.persons) {
    if (!p.known) continue;
    const per = st.people[p.pid];
    const name = `${per.prenom} ${per.nom}`;
    out.push({ kind: 'entretien', target: p.pid, label: `Entendre ${name} (${roleLabel(p.role)})` });
    if (p.role === 'suspect' || p.role === 'declarant' || p.role === 'temoin' || p.role === 'proche' || p.role === 'disparu') {
      for (const kind of ['requisition', 'perquisition', 'audition'] as const) {
        const auth = kind === 'audition' ? 'garde_a_vue' : kind;
        if (kind === 'audition' && p.role !== 'suspect' && p.role !== 'declarant') continue;
        if (kind === 'perquisition' && p.role === 'disparu') continue;
        const ok = authGranted(c, auth, p.pid);
        out.push({ kind, target: p.pid, label: `${ACTIONS[kind].label} — ${name}`, blocked: ok ? undefined : authPending(c, auth, p.pid) ? 'Autorisation demandée' : 'Autorisation judiciaire requise' });
      }
    }
  }
  for (const it of c.items) {
    if (!it.collected) continue;
    for (const t of it.labTypes) {
      const av = era.lab[t].available;
      out.push({ kind: 'labo', target: `${it.id}|${t}`, label: `${labLabel(t)} — ${it.label}`, blocked: av ? (st.lab.queue.some((j) => j.itemId === it.id && j.type === t) ? 'Déjà en cours d\'analyse' : undefined) : 'Technique indisponible à cette époque' });
    }
  }
  out.push({ kind: 'rapport', label: ACTIONS.rapport.label });
  return out;
}

export function roleLabel(r: string) {
  return ({ victime: 'victime', temoin: 'témoin', suspect: 'personne mise en cause', declarant: 'déclarant', proche: 'proche', disparu: 'personne disparue' } as Record<string, string>)[r] ?? r;
}
function labLabel(t: LabType) {
  return ({ photo: 'Photographies', document: 'Examen documentaire', empreintes: 'Empreintes', biologie: 'Analyse biologique', medical: 'Expertise médicale', numerique: 'Analyse numérique', comparaison: 'Comparaison technique', vehicule: 'Expertise du véhicule', authenticite: 'Authenticité' } as Record<LabType, string>)[t];
}

export function planAction(st: GameState, c: Case, kind: ActionKind, target: string | undefined, by: string[], opts: { approved?: boolean; proposedBy?: string; approach?: Approach; supervised?: boolean } = {}): PlannedAction | null {
  if (c.actions.some((a) => a.kind === kind && a.target === target)) return null;
  const def = ACTIONS[kind];
  const hours = def.hours * (kind === 'recherche' && eraOf(calendar(st.startYear, st.minute).year).computers === 'aucun' ? 1.4 : 1);
  const a: PlannedAction = { id: `${c.id}-X${++st.counters.action}`, kind, target, hours, total: hours, by: by.length ? by : c.lead ? [c.lead] : [], approved: opts.approved ?? true, proposedBy: opts.proposedBy, approach: opts.approach, supervised: opts.supervised };
  c.actions.push(a);
  return a;
}

/** Demande d'autorisation au parquet (le moteur judiciaire répond en différé). */
export function requestAuth(st: GameState, rng: Rng, c: Case, kind: 'requisition' | 'perquisition' | 'garde_a_vue', target: string) {
  if (authPending(c, kind, target) || authGranted(c, kind, target)) return;
  const mag = st.magistrates.find((m) => m.role === (kind === 'perquisition' ? 'juge_libertes' : 'procureur')) ?? st.magistrates[0];
  c.auths.push({ kind, target, granted: null, at: st.minute });
  const just = charges(c, target).total + (c.priority === 1 ? 2 : 0) + (kind === 'requisition' ? 2 : 0);
  st.requests.push({ id: `J${++st.counters.req}`, caseId: c.id, kind, target, justification: just, sentAt: st.minute, answerAt: st.minute + Math.round(mag.delai * rng.range(0.5, 1.5) * MIN_H), magistrateId: mag.id, answered: false });
  caseLog(st, c.id, `Demande d'autorisation (${kind === 'garde_a_vue' ? 'garde à vue' : kind}) concernant ${pname(st, target)}.`);
}

export function pname(st: GameState, pid: string) {
  const p = st.people[pid];
  return p ? `${p.prenom} ${p.nom}` : pid;
}

function expired(st: GameState, c: Case, k: Clue) {
  return k.expiresAfterH !== undefined && st.minute > c.factsAt + k.expiresAfterH * MIN_H;
}
function prereqOk(c: Case, k: Clue) {
  return !k.requires || k.requires.every((id) => c.clues.find((x) => x.id === id)?.found);
}

/** Probabilité d'obtenir une information selon la compétence et la difficulté. */
export function successChance(skill: number, difficulty: number, attempts: number) {
  return Math.min(0.97, sig((skill - difficulty + 1.5) / 2.2) * (attempts > 2 ? 0.7 : 1));
}

export function discover(st: GameState, c: Case, k: Clue, by: string | undefined) {
  if (k.found) return;
  k.found = true;
  k.foundAt = st.minute;
  k.foundBy = by;
  if (k.revealsPerson) {
    const p = c.persons.find((x) => x.pid === k.revealsPerson);
    if (p && !p.known) {
      p.known = true;
      caseLog(st, c.id, `Nouvelle personne identifiée : ${pname(st, p.pid)}.`, by);
    }
  }
  if (k.revealsItem) {
    const it = c.items.find((x) => x.id === k.revealsItem);
    if (it && !it.collected) {
      const s = by ? st.staff.find((x) => x.id === by) : undefined;
      it.collected = true;
      it.collectedAt = st.minute;
      it.collectedBy = by;
      // la qualité du scellé dépend de la rigueur de l'agent (et de la présence d'un technicien)
      const rel = s ? (s.skills.fiabilite + s.skills.scientifique) / 2 * condition(s) : 12;
      it.sealed = rel > 6.5 || (c.team.some((id) => st.staff.find((x) => x.id === id)?.role === 'technicien'));
      it.location = 'salle_preuves';
      it.chain.push({ minute: st.minute, text: `Saisi et placé sous scellé${it.sealed ? '' : ' (scellé non conforme)'} par ${s ? fullName(s) : 'l\'équipe'}.` });
      it.chain.push({ minute: st.minute + 60, text: 'Déposé en salle sécurisée des pièces à conviction.' });
      if (!it.sealed) {
        c.procedureFlaws++;
        if (s) {
          s.errors++;
          s.history.push({ minute: st.minute, kind: 'erreur', text: `Scellé non conforme (${c.title}).` });
        }
      }
    }
  }
  caseLog(st, c.id, k.text, by);
}

/** Exécution d'une action terminée : chaque information atteignable est tentée. */
export function completeAction(st: GameState, rng: Rng, c: Case, a: PlannedAction) {
  const def = ACTIONS[a.kind];
  const skill = teamSkill(st, a.by, def.skills);
  const lead = st.staff.find((s) => s.id === a.by[0]);
  let got = 0;
  if (a.kind === 'labo') {
    const [itemId, type] = (a.target ?? '').split('|') as [string, LabType];
    const internalQueue = st.lab.queue.filter((j) => !j.external).length;
    queueLab(st, rng, c, itemId, type, a.by[0], st.settings.assist === 'delegation' && internalQueue >= 6 && c.priority === 1);
    c.actions = c.actions.filter((x) => x !== a);
    return;
  }
  if (a.kind === 'rapport') {
    c.stage = 'transmission';
    caseLog(st, c.id, 'Rapport de synthèse rédigé : le dossier peut être transmis au parquet.', a.by[0]);
    c.actions = c.actions.filter((x) => x !== a);
    (c as Case & { reportQuality?: number }).reportQuality = skill;
    return;
  }
  const person = a.target ? c.persons.find((p) => p.pid === a.target) : undefined;
  if (a.kind === 'audition' && person) {
    person.inCustody = true;
    person.custodyUntil = st.minute + 24 * MIN_H;
    const per = st.people[person.pid];
    if (rng.chance(0.5 + (1 - per.cooperation) * 0.4)) {
      person.lawyer = true;
      caseLog(st, c.id, `${pname(st, person.pid)} demande l'assistance d'un avocat : l'audition est différée le temps de son arrivée.`);
    }
    if (charges(c, person.pid).material < 4 && rng.chance(0.5)) {
      person.silent = true;
      caseLog(st, c.id, `${pname(st, person.pid)} fait usage de son droit de se taire.`);
    }
  }
  if (person) {
    person.interviewed++;
    person.lastInterview = st.minute;
  }
  for (const k of c.clues) {
    if (k.found || k.action !== a.kind) continue;
    if (def.target === 'person' && k.personId !== a.target) continue;
    if (!prereqOk(c, k) || expired(st, c, k)) continue;
    // approches particulières : sans supervision, l'enquêteur choisit l'approche selon sa psychologie
    let bonus = 0;
    if (k.approach) {
      if (a.approach && a.approach !== k.approach) continue;
      if (!a.approach) bonus -= 3 - (lead ? lead.skills.psychologie / 10 : 0);
    }
    if (person) {
      const per = st.people[person.pid];
      if (person.silent && (k.confession || k.nature === 'declaration')) continue;
      bonus += (per.memory - 0.6) * 4 + (per.cooperation - 0.6) * 3;
      if (person.lawyer && k.confession) bonus -= 2;
    }
    k.attempts++;
    if (rng.chance(successChance(skill + bonus, k.difficulty, k.attempts))) {
      discover(st, c, k, a.by[0]);
      got++;
    }
  }
  if (a.kind === 'recoupement') {
    for (const { a: x, b: y } of contradictions(c)) {
      const id = `ctr-${x.id}`;
      if (!c.board.notes.some((n) => n.id === id)) {
        c.board.notes.push({ id, text: `Contradiction : « ${short(x.text)} » est contredit par « ${short(y.text)} »`, x: 0, y: 0, kind: 'hypothese' });
        caseLog(st, c.id, `Contradiction identifiée : ${short(x.text)}`, a.by[0]);
        got++;
      }
    }
    for (const p of c.persons) {
      const ch = charges(c, p.pid);
      if (ch.exculpated && !p.cleared) {
        p.cleared = true;
        caseLog(st, c.id, `Hypothèse abandonnée : les éléments vérifiés disculpent ${pname(st, p.pid)}.`, a.by[0]);
      }
    }
  }
  // charges : déplacements et dépenses opérationnelles
  if (def.cost) spend(st, def.outside ? 'deplacements' : 'operationnel', def.cost, (n) => notify(st, n));
  c.budgetSpent += def.cost;
  // expérience
  for (const id of a.by) {
    const s = st.staff.find((x) => x.id === id);
    if (!s) continue;
    for (const sk of def.skills) gainXp(s, sk, 0.05 + got * 0.04);
    gainXp(s, 'experience', 0.03);
  }
  // erreur de procédure possible (fatigue, discipline)
  if (lead && (a.kind === 'audition' || a.kind === 'perquisition')) {
    const risk = (0.02 + Math.max(0, lead.fatigue - 55) / 400 + (12 - lead.skills.discipline) / 200 + (12 - lead.skills.juridique) / 250) * (a.kind === 'perquisition' && capacities(st).armurerie ? 0.6 : 1);
    if (rng.chance(Math.max(0, risk))) {
      c.procedureFlaws++;
      lead.errors++;
      lead.history.push({ minute: st.minute, kind: 'erreur', text: `Irrégularité de procédure lors d'une ${def.label.toLowerCase()} (${c.title}).` });
      caseLog(st, c.id, `Irrégularité de procédure constatée (${def.label.toLowerCase()}) : elle pourra être relevée par la défense.`, lead.id);
      notify(st, { level: 'alerte', text: `${fullName(lead)} : irrégularité de procédure dans « ${c.title} ».`, caseId: c.id, staffId: lead.id });
    }
  }
  const tgt = a.target ? ` (${pname(st, a.target)})` : '';
  caseLog(st, c.id, `${def.label}${tgt} — action terminée : ${got ? `${got} information(s) nouvelle(s)` : 'aucun élément nouveau'}.`, a.by[0]);
  if (person?.inCustody && a.kind === 'audition') {
    person.inCustody = false;
    caseLog(st, c.id, `Fin de la garde à vue de ${pname(st, person.pid)}.`);
  }
  c.actions = c.actions.filter((x) => x !== a);
  updateStage(c);
}

function short(t: string) {
  return t.length > 70 ? t.slice(0, 68) + '…' : t;
}

export function updateStage(c: Case) {
  if (c.status !== 'ouverte') return;
  const f = found(c);
  const kinds = new Set(f.map((k) => k.action));
  if (c.stage === 'transmission') return;
  if (!c.lead) c.stage = 'evaluation';
  else if (!kinds.has('constatations')) c.stage = 'constatations';
  else if (kinds.has('audition')) c.stage = 'identification';
  else if (kinds.has('labo') || kinds.has('requisition')) c.stage = 'examens';
  else if (kinds.has('entretien')) c.stage = 'entretiens';
  else c.stage = 'recherches';
}

// ————— Laboratoire —————
export function queueLab(st: GameState, rng: Rng, c: Case, itemId: string, type: LabType, by?: string, external = false) {
  const era = eraOf(calendar(st.startYear, st.minute).year);
  const e = era.lab[type];
  if (!e.available) return;
  const it = c.items.find((i) => i.id === itemId);
  if (!it) return;
  const cost = Math.round(e.cost * (external ? 1.8 : 1));
  st.lab.queue.push({ id: `L${++st.counters.lab}`, caseId: c.id, itemId, type, cost, hoursLeft: e.hours * rng.range(0.85, 1.2), hoursTotal: e.hours, external, queuedAt: st.minute, priority: c.priority });
  spend(st, external ? 'prestations' : 'laboratoires', cost, (n) => notify(st, n));
  c.budgetSpent += cost;
  it.location = 'labo';
  it.chain.push({ minute: st.minute, text: `Transmis ${external ? 'à un laboratoire extérieur' : 'au laboratoire du service'} pour ${labLabel(type).toLowerCase()}${by ? ` par ${fullName(st.staff.find((s) => s.id === by)!)}` : ''}.` });
  caseLog(st, c.id, `Pièce « ${it.label} » envoyée au laboratoire (${labLabel(type)}).`, by);
}

export function finishLab(st: GameState, rng: Rng, jobId: string, techSkill: number) {
  const j = st.lab.queue.find((x) => x.id === jobId);
  if (!j) return;
  st.lab.queue = st.lab.queue.filter((x) => x !== j);
  st.lab.done++;
  const c = st.cases.find((x) => x.id === j.caseId);
  if (!c) return;
  const it = c.items.find((i) => i.id === j.itemId)!;
  const era = eraOf(calendar(st.startYear, st.minute).year);
  const q = era.lab[j.type].quality;
  it.location = 'salle_preuves';
  it.chain.push({ minute: st.minute, text: `Retour du laboratoire (${labLabel(j.type)}), replacé en salle sécurisée.` });
  const clue = c.clues.find((k) => k.action === 'labo' && k.itemId === j.itemId && k.labType === j.type && !k.found);
  if (!clue) {
    j.result = 'Aucun élément exploitable supplémentaire.';
    caseLog(st, c.id, `Résultat (${labLabel(j.type)}) : aucun élément exploitable.`);
    notify(st, { level: 'info', text: `Laboratoire : résultat non concluant pour « ${c.title} ».`, caseId: c.id });
    return;
  }
  if (!prereqOk(c, clue)) {
    j.result = 'Trace exploitable, mais aucune référence de comparaison à ce stade.';
    caseLog(st, c.id, `Résultat (${labLabel(j.type)}) : trace exploitable, sans élément de comparaison pour l'instant. Une nouvelle analyse sera possible quand une personne aura été identifiée.`);
    notify(st, { level: 'info', text: `Laboratoire : trace exploitable mais sans comparaison possible (« ${c.title} »).`, caseId: c.id });
    return;
  }
  clue.attempts++;
  // traces fragiles : envoyées trop tard, elles se sont dégradées
  if (clue.expiresAfterH !== undefined && j.queuedAt > c.factsAt + clue.expiresAfterH * MIN_H && !it.degraded) {
    it.degraded = true;
    caseLog(st, c.id, `Les traces de « ${it.label} » se sont dégradées avant l'analyse : le résultat sera plus difficile à obtenir.`);
  }
  const skill = techSkill * (0.6 + q * 0.6) * (it.degraded ? 0.7 : 1);
  if (rng.chance(successChance(skill + 3, clue.difficulty, clue.attempts))) {
    discover(st, c, clue, undefined);
    j.result = clue.text;
    notify(st, { level: 'succes', text: `Laboratoire : résultat exploitable pour « ${c.title} ».`, caseId: c.id });
  } else {
    j.result = 'Résultat non concluant (qualité de la trace insuffisante).';
    caseLog(st, c.id, `Résultat (${labLabel(j.type)}) : non concluant.`);
    notify(st, { level: 'info', text: `Laboratoire : résultat non concluant pour « ${c.title} ».`, caseId: c.id });
  }
}

// ————— IA des enquêteurs —————
export interface Proposal { kind: ActionKind; target?: string; utility: number; reason: string; auth?: 'requisition' | 'perquisition' | 'garde_a_vue' }

/** L'enquêteur évalue les pistes à partir de ce que l'équipe sait (jamais de la vérité). */
export function propose(st: GameState, rng: Rng, c: Case, s: Staff): Proposal[] {
  const out: Proposal[] = [];
  const f = found(c);
  const done = (kind: ActionKind) => c.done.some((d) => d.text.startsWith(ACTIONS[kind].label));
  const doneCount = (kind: ActionKind) => c.done.filter((d) => d.text.startsWith(ACTIONS[kind].label)).length;
  const era = eraOf(calendar(st.startYear, st.minute).year);
  const age = (st.minute - c.openedAt) / MIN_H;
  if (doneCount('constatations') < 1) out.push({ kind: 'constatations', utility: 1.2, reason: 'Les constatations doivent être faites rapidement, avant que les traces ne disparaissent.' });
  else if (doneCount('constatations') < 2 && f.filter((k) => k.action === 'constatations').length < 2) out.push({ kind: 'constatations', utility: 0.35, reason: 'Un second passage sur les lieux pourrait révéler des détails manqués.' });
  if (doneCount('voisinage') < 1) out.push({ kind: 'voisinage', utility: 0.95 - Math.min(0.4, age / 200), reason: 'Des témoins du voisinage peuvent avoir remarqué quelque chose ; leurs souvenirs s\'estompent.' });
  else if (doneCount('voisinage') < 2 && !c.persons.some((p) => p.role === 'temoin' && p.known)) out.push({ kind: 'voisinage', utility: 0.45, reason: 'Aucun témoin identifié : élargir l\'enquête de voisinage.' });
  for (const p of c.persons) {
    if (!p.known) continue;
    const ch = charges(c, p.pid);
    const name = pname(st, p.pid);
    if (p.interviewed === 0) {
      const u = p.role === 'victime' || p.role === 'declarant' ? 1.1 : p.role === 'temoin' ? 0.9 : 0.75;
      out.push({ kind: 'entretien', target: p.pid, utility: u, reason: `${name} n'a pas encore été entendu${st.people[p.pid].sexe === 'F' ? 'e' : ''}.` });
    } else {
      const newer = f.filter((k) => (k.foundAt ?? 0) > (p.lastInterview ?? 0)).length;
      if (newer >= 2 && p.interviewed < 4) out.push({ kind: 'entretien', target: p.pid, utility: 0.35 + newer * 0.06, reason: `De nouveaux éléments justifient de recontacter ${name}.` });
    }
    if (p.role === 'suspect' || p.role === 'declarant' || p.role === 'disparu') {
      if (ch.exculpated) continue;
      if ((ch.total >= 2 || p.role === 'disparu') && !authGranted(c, 'requisition', p.pid) && !done('requisition'))
        out.push({ kind: 'requisition', target: p.pid, auth: 'requisition', utility: 0.5 + ch.total / 20, reason: `Les éléments contre ${name} justifient de demander des relevés (${era.digitalLabel}).` });
      else if (authGranted(c, 'requisition', p.pid) && !c.done.some((d) => d.text.startsWith(ACTIONS.requisition.label) && d.text.includes(name)))
        out.push({ kind: 'requisition', target: p.pid, utility: 0.85, reason: `Exploiter les relevés obtenus concernant ${name}.` });
      if (p.role !== 'disparu' && ch.total >= 4) {
        if (!c.done.some((d) => d.text.startsWith(ACTIONS.perquisition.label) && d.text.includes(name)))
          out.push({ kind: 'perquisition', target: p.pid, auth: 'perquisition', utility: 0.55 + ch.total / 25, reason: `Les charges contre ${name} justifient une perquisition.` });
        if (ch.total >= 6 && !c.done.some((d) => d.text.startsWith(ACTIONS.audition.label) && d.text.includes(name)))
          out.push({ kind: 'audition', target: p.pid, auth: 'garde_a_vue', utility: 0.5 + ch.total / 25, reason: `Présenter les éléments vérifiés à ${name} dans le cadre d'une garde à vue.` });
      }
    }
  }
  for (const it of c.items) {
    if (!it.collected) continue;
    for (const t of it.labTypes) {
      if (!era.lab[t].available) continue;
      const tried = c.done.filter((d) => d.text.includes(`« ${it.label} » envoyée au laboratoire (${labLabel(t)})`)).length;
      const pendingCompare = c.done.some((d) => d.text.includes(labLabel(t)) && d.text.includes('sans élément de comparaison'));
      const queued = st.lab.queue.some((j) => j.itemId === it.id && j.type === t);
      if (queued) continue;
      // une expertise à la fois par pièce : la suivante seulement si la première n'a rien donné
      const order = it.labTypes.filter((x) => era.lab[x].available).indexOf(t);
      const prevDone = order === 0 || c.done.some((d) => d.text.includes(`(${labLabel(it.labTypes.filter((x) => era.lab[x].available)[order - 1])})`) && d.text.startsWith('Résultat'));
      if (tried === 0 && prevDone) out.push({ kind: 'labo', target: `${it.id}|${t}`, utility: order === 0 ? 0.8 : 0.45, reason: `Demander une expertise (${labLabel(t).toLowerCase()}) sur « ${it.label} ».` });
      else if (pendingCompare && tried < 3 && c.persons.filter((p) => p.known && p.role === 'suspect').length > 0) out.push({ kind: 'labo', target: `${it.id}|${t}`, utility: 0.6, reason: `Des personnes ont été identifiées : relancer la comparaison (${labLabel(t).toLowerCase()}).` });
    }
  }
  const sinceSearch = f.filter((k) => (k.foundAt ?? 0) > lastDone(c, 'recherche')).length;
  if (!done('recherche') || sinceSearch >= 2) out.push({ kind: 'recherche', utility: 0.45 + sinceSearch * 0.08, reason: 'Vérifier les déclarations et consulter archives et fichiers.' });
  const ctr = contradictions(c).filter((x) => !c.board.notes.some((n) => n.id === `ctr-${x.a.id}`)).length;
  const sinceCross = f.filter((k) => (k.foundAt ?? 0) > lastDone(c, 'recoupement')).length;
  if (sinceCross >= 3 || ctr) out.push({ kind: 'recoupement', utility: 0.35 + ctr * 0.3, reason: ctr ? 'Une contradiction semble apparaître entre les déclarations.' : 'Recouper les informations et les relations entre les personnes.' });
  // rapport : charges suffisantes, absence d'infraction établie, ou pistes épuisées
  const top = suspicionRanking(c)[0];
  const strong = top && top.total >= PROOF && !top.exculpated;
  const exhausted = out.filter((o) => o.utility > 0.4).length === 0 && age > 72;
  // un rapport déjà rédigé n'est refait que si des éléments nouveaux sont apparus depuis
  const lastReport = lastDone(c, 'rapport');
  const freshSinceReport = f.some((k) => (k.foundAt ?? 0) > lastReport);
  if ((strong || noCrimeWeight(c) >= 8 || exhausted) && c.stage !== 'transmission' && !c.actions.some((a) => a.kind === 'rapport') && (!lastReport || freshSinceReport))
    out.push({ kind: 'rapport', utility: strong || noCrimeWeight(c) >= 8 ? 1.0 : 0.5, reason: strong ? 'Les éléments réunis paraissent suffisants : préparer la transmission au parquet.' : noCrimeWeight(c) >= 8 ? 'Les éléments indiquent l\'absence d\'infraction : préparer le rapport.' : 'Les pistes semblent épuisées : rédiger un rapport de situation.' });
  // évaluation : une déduction faible rend le jugement plus bruité (jamais infaillible)
  const noise = (21 - s.skills.deduction) / 20 * 0.35;
  for (const o of out) o.utility += (rng.next() - 0.5) * noise;
  // les actions déjà planifiées sont exclues
  return out.filter((o) => !c.actions.some((a) => a.kind === o.kind && a.target === o.target)).sort((a, b) => b.utility - a.utility);
}

function lastDone(c: Case, kind: ActionKind) {
  let t = 0;
  const prefix = kind === 'rapport' ? 'Rapport de synthèse rédigé' : ACTIONS[kind].label;
  for (const d of c.done) if (d.text.startsWith(prefix)) t = d.minute;
  return t;
}

/** Décisions des enquêteurs sur leurs affaires, selon le niveau d'assistance choisi. */
export function investigatorsThink(st: GameState, rng: Rng) {
  const mode = st.settings.assist;
  for (const c of st.cases) {
    if (c.status !== 'ouverte' || !c.lead) continue;
    const lead = st.staff.find((s) => s.id === c.lead);
    if (!lead) continue;
    const pending = c.actions.filter((a) => a.approved).length;
    const team = c.team.length ? c.team : [c.lead];
    const want = Math.min(3, team.length + 1);
    if (mode === 'manuel') {
      // l'équipe signale au commandant lorsqu'elle n'a plus d'instructions
      if (!pending && c.stalledH > 6 && !c.board.notes.some((n) => n.id === 'idle-' + Math.floor(st.minute / 1440))) {
        c.board.notes.push({ id: 'idle-' + Math.floor(st.minute / 1440), text: `${fullName(lead)} attend vos instructions sur ce dossier.`, x: 0, y: 0, kind: 'note' });
        notify(st, { level: 'alerte', text: `${fullName(lead)} attend vos instructions : « ${c.title} ».`, caseId: c.id, staffId: lead.id });
      }
      continue;
    }
    if (pending >= want) continue;
    const props = propose(st, rng, c, lead);
    const proposedOpen = c.actions.filter((a) => !a.approved).length;
    for (const p of props.slice(0, want - pending)) {
      if (p.utility < 0.3) break;
      if (p.kind === 'rapport' && mode === 'assiste' && proposedOpen > 0) continue;
      const by = pickExecutors(st, c, p.kind);
      if (p.auth && !authGranted(c, p.auth, p.target!)) {
        if (mode === 'delegation') {
          if (!authPending(c, p.auth, p.target!)) {
            requestAuth(st, rng, c, p.auth, p.target!);
            caseLog(st, c.id, `${fullName(lead)} : ${p.reason}`, lead.id);
          }
        } else if (!c.actions.some((a) => a.kind === p.kind && a.target === p.target)) {
          planAction(st, c, p.kind, p.target, by, { approved: false, proposedBy: lead.id });
          notify(st, { level: 'info', text: `${fullName(lead)} propose : ${p.reason}`, caseId: c.id, staffId: lead.id });
        }
        continue;
      }
      const a = planAction(st, c, p.kind, p.target, by, { approved: mode === 'delegation', proposedBy: lead.id });
      if (a) {
        if (mode === 'assiste') notify(st, { level: 'info', text: `${fullName(lead)} propose : ${p.reason}`, caseId: c.id, staffId: lead.id });
        else caseLog(st, c.id, `${fullName(lead)} décide : ${p.reason}`, lead.id);
      }
    }
    // alerte de surcharge et demande de renforts
    if (load(lead, st) > capacity(lead) * 1.25 && rng.chance(0.05)) notify(st, { level: 'alerte', text: `${fullName(lead)} signale une surcharge de travail et demande des renforts.`, staffId: lead.id });
  }
}

/** Choisit qui exécute une action : le plus compétent disponible dans l'équipe. */
export function pickExecutors(st: GameState, c: Case, kind: ActionKind): string[] {
  const def = ACTIONS[kind];
  const team = (c.team.length ? c.team : [c.lead!]).map((id) => st.staff.find((s) => s.id === id)).filter(Boolean) as Staff[];
  const scored = team.map((s) => ({ s, v: def.skills.reduce((t, k) => t + s.skills[k], 0) - load(s, st) * 1.5 })).sort((a, b) => b.v - a.v);
  const n = kind === 'perquisition' || kind === 'voisinage' || kind === 'constatations' ? 2 : 1;
  const chosen = scored.slice(0, n).map((x) => x.s.id);
  if (kind === 'constatations') {
    const tech = st.staff.find((s) => s.role === 'technicien' && s.status === 'service');
    if (tech && !chosen.includes(tech.id)) chosen.push(tech.id);
  }
  return chosen;
}

export { isContradicted };
