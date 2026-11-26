// Moteur judiciaire (modèle simplifié du jeu, qui ne reproduit pas exhaustivement le droit
// réel) : autorisations, transmission au parquet, compléments d'enquête, classements,
// décisions de jugement simulées et réouvertures.
import type { Rng } from '../core/rng';
import { MIN_D } from './calendar';
import { PROOF } from './cases/builder';
import { charges, found, noCrimeWeight } from './knowledge';
import { caseLog, notify } from './log';
import { pname } from './investigation';
import { randomName } from './names';
import { fullName } from './staff';
import type { Case, CaseOutcome, GameState, Magistrate } from './types';

export function makeMagistrate(rng: Rng, st: GameState, role: Magistrate['role']): Magistrate {
  const sexe = rng.chance(0.5) ? 'F' : 'M';
  const n = randomName(rng, sexe);
  return { id: `M${++st.counters.mag}`, ...n, role, rigueur: rng.range(0.3, 0.9), delai: rng.range(4, 30), relation: 55, since: st.minute };
}

export const MAG_LABEL: Record<Magistrate['role'], string> = {
  procureur: 'Procureur de la République', substitut: 'Substitut du procureur', juge_instruction: 'Juge d\'instruction', juge_libertes: 'Juge des libertés et de la détention',
};

export function processRequests(st: GameState, _rng?: Rng) {
  for (const r of st.requests) {
    if (r.answered || st.minute < r.answerAt) continue;
    r.answered = true;
    const c = st.cases.find((x) => x.id === r.caseId);
    const m = st.magistrates.find((x) => x.id === r.magistrateId) ?? st.magistrates[0];
    if (!c) continue;
    const a = c.auths.find((x) => x.kind === r.kind && x.target === r.target && x.granted === null);
    if (!a) continue;
    // recalcul au moment de la décision : de nouveaux éléments ont pu être découverts
    const just = charges(c, r.target).total + (c.priority === 1 ? 2 : 0) + (r.kind === 'requisition' ? 2 : 0) + (m.relation - 50) / 25;
    const need = r.kind === 'requisition' ? 1 + m.rigueur * 2 : r.kind === 'perquisition' ? 3 + m.rigueur * 3 : 4 + m.rigueur * 3;
    a.granted = just >= need;
    const label = r.kind === 'garde_a_vue' ? 'placement en garde à vue' : r.kind;
    if (a.granted) {
      caseLog(st, c.id, `${MAG_LABEL[m.role]} ${m.prenom} ${m.nom} autorise : ${label} (${pname(st, r.target)}).`);
      notify(st, { level: 'info', text: `Autorisation accordée (${label}) — « ${c.title} ».`, caseId: c.id });
      // en délégation ou en supervision, l'équipe planifie l'acte autorisé
      if (st.settings.assist !== 'manuel' && c.lead) {
        const kind = (r.kind === 'garde_a_vue' ? 'audition' : r.kind) as 'audition' | 'perquisition' | 'requisition';
        if (!c.actions.some((x) => x.kind === kind && x.target === r.target)) {
          c.actions.push({ id: `${c.id}-X${++st.counters.action}`, kind, target: r.target, hours: kind === 'audition' ? 4 : kind === 'perquisition' ? 5 : 3, total: kind === 'audition' ? 4 : 5, by: [c.lead, ...c.team.filter((x) => x !== c.lead).slice(0, kind === 'perquisition' ? 1 : 0)], approved: true });
        }
      }
    } else {
      caseLog(st, c.id, `${MAG_LABEL[m.role]} refuse : ${label} (${pname(st, r.target)}). Éléments jugés insuffisants à ce stade.`);
      notify(st, { level: 'alerte', text: `Autorisation refusée (${label}) — « ${c.title} » : éléments insuffisants.`, caseId: c.id });
      m.relation = Math.max(0, m.relation - 2);
    }
  }
  st.requests = st.requests.filter((r) => !r.answered || st.minute - r.answerAt < 30 * MIN_D);
}

export type TransmitChoice =
  | { kind: 'poursuites'; pid: string }
  | { kind: 'classement_absence' }
  | { kind: 'classement_insuffisant' }
  | { kind: 'classement_inconnu' };

/** Qualité professionnelle d'un dossier (indépendante du nombre d'interpellations). */
export function dossierQuality(st: GameState, c: Case): number {
  const f = found(c);
  const ratio = f.length / Math.max(1, c.clues.length);
  const report = (c as Case & { reportQuality?: number }).reportQuality ?? 8;
  const sealedOk = c.items.filter((i) => i.collected).every((i) => i.sealed) ? 1 : 0.8;
  const late = c.deadline && st.minute > c.deadline ? Math.min(20, (st.minute - c.deadline) / MIN_D) : 0;
  return Math.round(Math.max(0, Math.min(100, (30 + ratio * 40 + report * 1.6) * sealedOk - c.procedureFlaws * 8 - late)));
}

export function transmit(st: GameState, _rng: Rng | null, c: Case, choice: TransmitChoice) {
  const m = st.magistrates.find((x) => x.role === 'procureur') ?? st.magistrates[0];
  const quality = dossierQuality(st, c);
  const truth = c.truth;
  let outcome: CaseOutcome;
  const lead = st.staff.find((s) => s.id === c.lead);
  if (choice.kind === 'poursuites') {
    const ch = charges(c, choice.pid);
    const need = PROOF * (0.8 + m.rigueur * 0.4);
    const ok = ch.total >= need && !ch.exculpated && ch.material >= 6;
    if (!ok) {
      outcome = { decision: 'complement', designated: choice.pid, correct: false, quality, at: st.minute, verdict: null, text: ch.exculpated ? `Le parquet relève des éléments disculpant ${pname(st, choice.pid)} et demande un complément d'enquête.` : ch.material < 6 && ch.confession ? 'Le parquet rappelle que des aveux ne suffisent pas : il demande des éléments matériels corroborants.' : 'Le parquet estime les charges insuffisantes et demande un complément d\'enquête.' };
      c.outcome = outcome;
      c.stage = 'coordination';
      caseLog(st, c.id, outcome.text);
      notify(st, { level: 'alerte', text: `Complément d'enquête demandé — « ${c.title} ».`, caseId: c.id });
      return outcome;
    }
    const isRight = truth.culprit === choice.pid || truth.accomplice === choice.pid;
    outcome = { decision: 'poursuites', designated: choice.pid, correct: isRight, quality, at: st.minute, verdict: null, text: `Le parquet engage des poursuites contre ${pname(st, choice.pid)}.` };
    c.status = 'transmise';
    c.stage = 'jugement';
  } else {
    const nc = noCrimeWeight(c);
    const top = c.persons.filter((p) => p.known).map((p) => charges(c, p.pid)).filter((x) => !x.exculpated).map((x) => x.total).sort((a, b) => b - a)[0] ?? 0;
    let text: string;
    let correct: boolean;
    if (choice.kind === 'classement_absence') {
      correct = truth.culprit === null;
      text = nc >= 6 ? 'Classement sans suite : absence d\'infraction établie par l\'enquête.' : 'Classement sans suite pour absence d\'infraction, malgré un dossier peu étayé.';
    } else {
      // classer faute de preuves peut être la bonne décision professionnelle
      correct = top < PROOF;
      text = choice.kind === 'classement_inconnu' ? 'Classement sans suite : auteur non identifié. Le dossier pourra être rouvert.' : 'Classement sans suite : charges insuffisantes. Le dossier pourra être rouvert si des éléments nouveaux apparaissent.';
    }
    outcome = { decision: choice.kind, designated: null, correct, quality: Math.round(quality * (correct ? 1 : 0.7)), at: st.minute, verdict: null, text };
    c.status = 'classee';
    c.stage = 'archive';
  }
  c.outcome = outcome;
  caseLog(st, c.id, outcome.text);
  notify(st, { level: 'info', text: `${outcome.text} (« ${c.title} »)`, caseId: c.id });
  // carrières : l'affaire compte pour tous les membres
  for (const id of new Set([c.lead, ...c.team].filter(Boolean) as string[])) {
    const s = st.staff.find((x) => x.id === id);
    if (!s) continue;
    s.casesHandled++;
    s.assignments = s.assignments.filter((x) => x !== c.id);
    s.history.push({ minute: st.minute, kind: 'affaire', text: `${c.title} : ${outcome.text}` });
  }
  if (lead) lead.moral = Math.min(100, lead.moral + 3);
  c.team = [];
  c.lead = c.lead; // conservé pour l'historique
  c.actions = [];
  if (c.vehicle) {
    const v = st.vehicles.find((x) => x.id === c.vehicle);
    if (v) v.caseId = null;
    c.vehicle = null;
  }
  return outcome;
}

/** Jugements simulés : la juridiction apprécie les preuves ; la défense peut faire valoir
 * des éléments que l'enquête n'a pas découverts. */
export function processTrials(st: GameState, rng: Rng) {
  for (const c of st.cases) {
    const o = c.outcome;
    if (!o || o.decision !== 'poursuites' || o.verdict) continue;
    if (st.minute < o.at + 25 * MIN_D + (c.complexity * 7 * MIN_D)) continue;
    const ch = charges(c, o.designated!);
    const hiddenExcul = c.clues.some((k) => !k.found && k.exculpates?.includes(o.designated!));
    let pConv = Math.min(0.97, 0.45 + (ch.total - PROOF) / 25 + o.quality / 250 - c.procedureFlaws * 0.12);
    if (!o.correct) pConv = hiddenExcul ? 0.03 : 0.12;
    const conv = rng.chance(Math.max(0.02, pConv));
    o.verdict = conv ? 'condamnation' : 'relaxe';
    o.verdictAt = st.minute;
    c.status = 'jugee';
    c.stage = 'archive';
    const name = pname(st, o.designated!);
    const lead = st.staff.find((s) => s.id === c.lead);
    st.publicTrust = Math.max(0, Math.min(100, st.publicTrust + (conv && o.correct ? 0.8 : !o.correct ? -1 : 0)));
    if (conv) {
      caseLog(st, c.id, `Jugement : ${name} est déclaré${st.people[o.designated!].sexe === 'F' ? 'e' : ''} coupable.`);
      notify(st, { level: 'succes', text: `Jugement — « ${c.title} » : culpabilité retenue.`, caseId: c.id });
      if (o.correct && lead) {
        lead.casesSolved++;
        lead.history.push({ minute: st.minute, kind: 'resolue', text: `${c.title} : décision de culpabilité.` });
        for (const id of c.done.map((d) => d.by).filter(Boolean)) {
          const s = st.staff.find((x) => x.id === id);
          if (s && s !== lead && !s.history.some((h) => h.text.startsWith(c.title) && h.kind === 'resolue')) {
            s.casesSolved++;
            s.history.push({ minute: st.minute, kind: 'resolue', text: `${c.title} : décision de culpabilité.` });
          }
        }
      }
      if (!o.correct) {
        // erreur judiciaire : elle pourra être révélée plus tard (réouverture)
        o.text += ' (décision fondée sur un dossier erroné)';
      }
    } else {
      caseLog(st, c.id, `Jugement : ${name} est relaxé${st.people[o.designated!].sexe === 'F' ? 'e' : ''}.${!o.correct ? ' La défense a démontré que la personne n\'était pas l\'auteur des faits.' : ' Les preuves ont été jugées insuffisantes.'}`);
      notify(st, { level: 'alerte', text: `Jugement — « ${c.title} » : relaxe.`, caseId: c.id });
      if (!o.correct) {
        st.publicTrust = Math.max(0, st.publicTrust - 4);
        if (lead) {
          lead.errors++;
          lead.history.push({ minute: st.minute, kind: 'erreur', text: `Mise en cause infondée (${c.title}).` });
        }
        st.commander.reputation = Math.max(0, st.commander.reputation - 3);
      }
    }
  }
}

/** Réouverture d'un dossier classé (élément nouveau, technique nouvelle, plainte). */
export function reopen(st: GameState, c: Case, reason: string) {
  c.status = 'ouverte';
  c.stage = 'evaluation';
  c.reopenCount++;
  c.outcome = undefined;
  c.lead = null;
  c.team = [];
  c.openedAt = st.minute;
  c.stalledH = 0;
  (c as Case & { compact?: boolean }).compact = false;
  for (const k of c.clues) if (!k.found) k.attempts = 0;
  caseLog(st, c.id, `Réouverture du dossier : ${reason}`);
  notify(st, { level: 'urgent', text: `Réouverture : « ${c.title} » — ${reason}`, caseId: c.id });
}

export function staffLabel(st: GameState, id: string | null) {
  const s = id ? st.staff.find((x) => x.id === id) : null;
  return s ? fullName(s) : '—';
}
