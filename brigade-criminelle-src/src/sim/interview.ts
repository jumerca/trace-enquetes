// Entretiens supervisés par le joueur. Les personnes ont une mémoire (les informations
// qu'elles détiennent), des émotions (stress), une coopération et une sincérité propres.
// La nervosité est affichée mais n'est JAMAIS un indicateur de culpabilité.
import type { Rng } from '../core/rng';
import { charges, isContradicted } from './knowledge';
import { caseLog } from './log';
import { discover, pname, successChance, teamSkill } from './investigation';
import type { Approach, Case, Clue, GameState } from './types';

export const APPROACHES: { id: Approach; label: string; hint: string; custody?: boolean }[] = [
  { id: 'ecoute', label: 'Écoute', hint: 'Laisser parler, apaiser. Diminue le stress, révèle des détails spontanés.' },
  { id: 'ouverte', label: 'Question ouverte', hint: 'Faire raconter les faits dans ses propres mots.' },
  { id: 'clarification', label: 'Demande de clarification', hint: 'Approfondir un point déjà évoqué.' },
  { id: 'chronologie', label: 'Vérification chronologique', hint: 'Reprendre l\'emploi du temps heure par heure.' },
  { id: 'contradiction', label: 'Présenter une contradiction', hint: 'Exposer un écart entre la déclaration et un fait vérifié.' },
  { id: 'element', label: 'Présenter un élément vérifié', hint: 'Montrer un fait établi ou un résultat d\'analyse.' },
  { id: 'confrontation', label: 'Confrontation des déclarations', hint: 'Dans le cadre autorisé : opposer deux versions incompatibles.', custody: true },
];

export interface InterviewTurn { speaker: 'enqueteur' | 'personne' | 'note'; text: string; clueId?: string }

export interface InterviewSession {
  caseId: string;
  pid: string;
  custody: boolean;
  turns: InterviewTurn[];
  stress: number;
  ended: boolean;
  count: number;
}

export function startInterview(st: GameState, c: Case, pid: string, custody: boolean): InterviewSession {
  const p = c.persons.find((x) => x.pid === pid)!;
  const per = st.people[pid];
  const s: InterviewSession = { caseId: c.id, pid, custody, turns: [], stress: Math.min(1, p.stress + (custody ? 0.25 : 0)), ended: false, count: 0 };
  s.turns.push({ speaker: 'note', text: custody ? `Audition de ${pname(st, pid)} en garde à vue. Notification des droits effectuée : droit de se taire, d'être assisté${per.sexe === 'F' ? 'e' : ''} par un avocat, de faire prévenir un proche et d'être examiné${per.sexe === 'F' ? 'e' : ''} par un médecin.` : `Entretien avec ${pname(st, pid)} (${per.profession}, ${per.age} ans). La personne est entendue librement et peut partir à tout moment.` });
  if (custody && !p.lawyer && per.cooperation < 0.7) {
    p.lawyer = true;
    s.turns.push({ speaker: 'personne', text: 'Je souhaite être assisté' + (per.sexe === 'F' ? 'e' : '') + ' par un avocat.' });
    s.turns.push({ speaker: 'note', text: 'L\'avocat est présent ; l\'audition peut commencer.' });
  }
  p.interviewed++;
  p.lastInterview = st.minute;
  return s;
}

export function demeanor(stress: number, nervosity: number): string {
  const v = stress * 0.6 + nervosity * 0.4;
  return v > 0.75 ? 'très tendu, mains crispées' : v > 0.55 ? 'nerveux, cherche ses mots' : v > 0.35 ? 'attentif, un peu sur la réserve' : 'calme';
}

const FILLER: Record<Approach, string[]> = {
  ecoute: ['Ça me fait du bien d\'en parler… je n\'ai pas grand-chose de plus à dire.', 'Je vous ai tout dit, je crois.'],
  ouverte: ['Je ne vois pas ce que je pourrais ajouter.', 'Tout s\'est passé comme d\'habitude, je n\'ai rien remarqué d\'autre.'],
  clarification: ['Je ne suis pas sûr de comprendre ce que vous voulez préciser.', 'C\'est tout ce dont je me souviens.'],
  chronologie: ['Je ne regarde pas ma montre toutes les cinq minutes, vous savez.', 'Les heures, c\'est flou pour moi.'],
  contradiction: ['Je ne vois pas de contradiction.', 'Vous déformez ce que j\'ai dit.'],
  element: ['Je n\'ai rien à dire là-dessus.', 'Ça ne prouve rien.'],
  confrontation: ['Chacun sa version. Moi, je maintiens la mienne.', 'Je n\'ai rien à ajouter.'],
};

/** Un tour d'entretien : l'approche choisie détermine les informations accessibles. */
export function interviewTurn(st: GameState, rng: Rng, s: InterviewSession, approach: Approach): InterviewTurn[] {
  const c = st.cases.find((x) => x.id === s.caseId)!;
  const p = c.persons.find((x) => x.pid === s.pid)!;
  const per = st.people[s.pid];
  const out: InterviewTurn[] = [];
  const ap = APPROACHES.find((a) => a.id === approach)!;
  out.push({ speaker: 'enqueteur', text: `[${ap.label}]` });
  s.count++;
  if (ap.custody && !s.custody) {
    out.push({ speaker: 'note', text: 'La confrontation n\'est possible que dans le cadre d\'une audition autorisée.' });
    s.turns.push(...out);
    return out;
  }
  const lead = c.lead ? [c.lead] : [];
  const skill = teamSkill(st, lead, ['entretien', 'psychologie']) + 1; // la présence du commandant aide un peu
  // émotions
  if (approach === 'ecoute') s.stress = Math.max(0, s.stress - 0.15);
  if (approach === 'contradiction' || approach === 'confrontation') s.stress = Math.min(1, s.stress + 0.18);
  if (approach === 'chronologie' || approach === 'element') s.stress = Math.min(1, s.stress + 0.07);
  p.stress = s.stress;
  // droit au silence : une personne mise en cause peut refuser de répondre
  if (s.custody && !p.silent && s.stress > 0.85 && per.cooperation < 0.55 && charges(c, s.pid).material < 5) {
    p.silent = true;
    out.push({ speaker: 'personne', text: 'Sur les conseils de mon avocat, je ne répondrai plus aux questions.' });
  }
  if (!s.custody && s.stress > 0.9 && rng.chance(0.4)) {
    out.push({ speaker: 'personne', text: 'Je préfère m\'arrêter là. Je reviendrai si vous avez besoin de moi.' });
    s.ended = true;
    s.turns.push(...out);
    return out;
  }
  const mine = c.clues.filter((k) => k.personId === s.pid && (k.action === 'entretien' || (s.custody && k.action === 'audition')) && !k.found && prereq(c, k));
  let candidates: Clue[] = [];
  if (approach === 'ouverte' || approach === 'ecoute') candidates = mine.filter((k) => !k.approach || k.approach === approach);
  else if (approach === 'clarification') candidates = mine.filter((k) => (!k.approach && k.requires?.length) || k.approach === 'clarification');
  else if (approach === 'chronologie') candidates = mine.filter((k) => k.approach === 'chronologie');
  else if (approach === 'contradiction') {
    const lies = c.clues.filter((k) => k.personId === s.pid && k.found && !k.reliable && isContradicted(c, k));
    const shown = c.clues.filter((k) => k.found && k.personId === s.pid && !k.reliable);
    if (lies.length) {
      out.push({ speaker: 'personne', text: per.sincerity > 0.5 ? 'Bon… c\'est vrai, je n\'ai pas tout dit. J\'avais peur des conséquences.' : 'Admettons que je me sois trompé sur ce point. Ça ne change rien.' });
      caseLog(st, c.id, `${pname(st, s.pid)} revient sur sa version après présentation d'une contradiction.`);
      candidates = mine.filter((k) => k.approach === 'element' || k.approach === 'contradiction');
      if (!s.custody) candidates = candidates.filter((k) => !k.confession);
    } else if (shown.length) {
      out.push({ speaker: 'note', text: 'Aucun fait vérifié ne contredit encore cette déclaration : la personne maintient sa version.' });
    } else out.push({ speaker: 'note', text: 'Aucune contradiction n\'est établie à ce stade.' });
  } else if (approach === 'element' || approach === 'confrontation') {
    const ch = charges(c, s.pid);
    if (ch.material < 3) out.push({ speaker: 'note', text: 'Les éléments présentés ne mettent pas la personne en difficulté.' });
    candidates = mine.filter((k) => k.approach === 'element' && (s.custody || !k.confession));
  }
  let revealed = 0;
  for (const k of candidates.sort((a, b) => a.difficulty - b.difficulty).slice(0, 2)) {
    if (p.silent && k.nature === 'declaration') continue;
    const bonus = (per.memory - 0.6) * 4 + (per.cooperation - 0.5) * 3 - (s.stress > 0.7 ? 2 : 0) + (approach === 'confrontation' ? 1 : 0);
    k.attempts++;
    if (rng.chance(successChance(skill + bonus, k.difficulty, k.attempts))) {
      discover(st, c, k, c.lead ?? undefined);
      out.push({ speaker: 'personne', text: voice(k), clueId: k.id });
      revealed++;
    }
  }
  if (!revealed && !out.some((t) => t.speaker === 'personne')) out.push({ speaker: 'personne', text: p.silent ? 'Je n\'ai rien à déclarer.' : rng.pick(FILLER[approach]) });
  if (s.count >= 8) {
    out.push({ speaker: 'note', text: 'L\'entretien touche à sa fin : la personne est fatiguée.' });
    s.ended = true;
  }
  s.turns.push(...out);
  return out;
}

function prereq(c: Case, k: Clue) {
  return !k.requires || k.requires.every((id) => c.clues.find((x) => x.id === id)?.found);
}

function voice(k: Clue) {
  return k.text;
}

export function endInterview(st: GameState, s: InterviewSession) {
  const c = st.cases.find((x) => x.id === s.caseId);
  if (!c) return;
  const got = s.turns.filter((t) => t.clueId).length;
  caseLog(st, c.id, `Entretien supervisé avec ${pname(st, s.pid)} : ${got} information(s) recueillie(s).`, 'commandant');
  if (c.lead) {
    const lead = st.staff.find((x) => x.id === c.lead);
    if (lead) lead.fatigue = Math.min(100, lead.fatigue + 2);
  }
}
