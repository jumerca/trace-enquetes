// Réseau d'antennes (échelons supérieurs) : à partir de la brigade départementale, le commandant
// pilote plusieurs antennes locales simulées de façon agrégée. Chaque antenne a son chef, ses
// effectifs, sa qualité de travail, son moral et un stock de dossiers. Le joueur répartit les
// effectifs et les dotations, ordonne des inspections, fixe des priorités et peut se saisir des
// dossiers sensibles, qui deviennent alors des affaires suivies au siège.
import type { Rng } from '../core/rng';
import { MIN_D } from './calendar';
import { spend } from './finance';
import { notify } from './log';
import { randomName } from './names';
import { makeCandidate } from './staff';
import type { GameState } from './types';

export type Priority = 'equilibre' | 'biens' | 'personnes' | 'financier';
export const PRIORITY_LABEL: Record<Priority, string> = { equilibre: 'Équilibrée', biens: 'Atteintes aux biens', personnes: 'Atteintes aux personnes', financier: 'Délinquance financière' };

export interface Antenne {
  id: string;
  name: string;
  population: number;
  chief: { prenom: string; nom: string; skill: number }; // skill 5–18
  staff: number;
  quality: number; // 0,3 – 1
  moral: number; // 0 – 100
  backlog: number; // dossiers en attente
  inflowPerDay: number;
  dotation: number; // € par mois, prélevés sur « dépenses opérationnelles »
  priority: Priority;
  solvedYear: number;
  receivedYear: number;
  escalated: number;
  inspectedAt: number;
  history: { year: number; solved: number; received: number; backlog: number }[];
}

export interface Network { antennes: Antenne[]; log: { minute: number; text: string }[] }

const TOWNS = ['Brévannes', 'Saint-Aubin', 'Val-d\'Orsay', 'Montlieu', 'Les Essarts', 'Clairvaux-le-Bas', 'Roncelles', 'Pont-Sainte-Marie', 'Aubeterre', 'Villiers-la-Forêt'];
export const ANTENNES_BY_RANK = [0, 0, 2, 3, 4, 5];

/** Crée ou complète le réseau selon l'échelon (appelé à chaque promotion et chaque année). */
export function ensureNetwork(st: GameState, rng: Rng) {
  const want = ANTENNES_BY_RANK[Math.min(5, st.hierarchy.rank)];
  if (!want) return;
  if (!st.network) st.network = { antennes: [], log: [] };
  const n = st.network;
  const used = new Set(n.antennes.map((a) => a.name));
  while (n.antennes.length < want) {
    const town = TOWNS.find((t) => !used.has(`Antenne de ${t}`)) ?? `Secteur ${n.antennes.length + 1}`;
    used.add(`Antenne de ${town}`);
    const sexe = rng.chance(0.5) ? 'F' : 'M';
    const pop = rng.int(15, 70) * 1000;
    const staff = Math.max(3, Math.round(pop / 9000));
    n.antennes.push({
      id: `AN${n.antennes.length + 1}`, name: `Antenne de ${town}`, population: pop, chief: { ...randomName(rng, sexe), skill: rng.int(7, 16) },
      staff, quality: rng.range(0.5, 0.85), moral: rng.int(50, 75), backlog: rng.int(5, 25), inflowPerDay: (pop / 80000) * 0.35,
      dotation: staff * 250, priority: 'equilibre', solvedYear: 0, receivedYear: 0, escalated: 0, inspectedAt: 0, history: [],
    });
    n.log.push({ minute: st.minute, text: `${n.antennes[n.antennes.length - 1].name} rattachée à votre commandement.` });
  }
}

/** Capacité de traitement quotidienne d'une antenne. */
export function capacityOf(a: Antenne): number {
  const chief = 0.75 + a.chief.skill / 40;
  const funding = Math.min(1.15, 0.7 + a.dotation / (a.staff * 250) * 0.3);
  return a.staff * 0.12 * a.quality * (0.6 + a.moral / 180) * chief * funding;
}

export function networkTick(st: GameState, rng: Rng): number {
  const n = st.network;
  if (!n) return 0;
  let esc = 0;
  for (const a of n.antennes) {
    const inflow = a.inflowPerDay * (0.8 + rng.next() * 0.4);
    a.receivedYear += inflow;
    a.backlog += inflow;
    const done = Math.min(a.backlog, capacityOf(a));
    a.backlog -= done;
    a.solvedYear += done;
    // moral : la surcharge use les équipes ; la qualité retombe lentement sans inspection
    const load = a.backlog / Math.max(1, a.staff * 4);
    a.moral = Math.max(10, Math.min(95, a.moral + (load > 1 ? -0.25 : 0.12)));
    a.quality = Math.max(0.3, Math.min(1, a.quality - 0.0004 + (a.chief.skill - 11) * 0.00004));
    // dossiers sensibles remontés au siège
    if (rng.chance(0.004 * (1 + load))) {
      a.escalated++;
      a.backlog = Math.max(0, a.backlog - 1);
      n.log.push({ minute: st.minute, text: `${a.name} transmet un dossier sensible au siège.` });
      st.counters.escalations = (st.counters.escalations ?? 0) + 1;
      esc++;
    }
  }
  // dotations : versées chaque 1er du mois (appelé une fois par jour)
  n.log = n.log.slice(-80);
  return esc;
}

export function payDotations(st: GameState) {
  const n = st.network;
  if (!n) return;
  const total = n.antennes.reduce((s, a) => s + a.dotation, 0);
  if (total > 0) spend(st, 'operationnel', total, (x) => notify(st, x));
}

/** Note de gestion du réseau sur 20 (taux de traitement, stocks, moral). */
export function networkNote(st: GameState): number | null {
  const n = st.network;
  if (!n || !n.antennes.length) return null;
  let s = 0;
  for (const a of n.antennes) {
    const ratio = a.receivedYear ? Math.min(1.2, a.solvedYear / a.receivedYear) : 1;
    const stock = Math.max(0, 1 - a.backlog / Math.max(1, a.staff * 6));
    s += (ratio / 1.2) * 10 + stock * 6 + (a.moral / 100) * 4;
  }
  return Math.round((s / n.antennes.length) * 10) / 10;
}

export function networkNewYear(st: GameState, year: number) {
  const n = st.network;
  if (!n) return;
  for (const a of n.antennes) {
    a.history.push({ year: year - 1, solved: Math.round(a.solvedYear), received: Math.round(a.receivedYear), backlog: Math.round(a.backlog) });
    a.history = a.history.slice(-15);
    a.solvedYear = 0;
    a.receivedYear = 0;
  }
}

// ————— décisions du commandant —————
export function inspect(st: GameState, id: string): string {
  const a = st.network?.antennes.find((x) => x.id === id);
  if (!a) return 'Antenne introuvable.';
  if (a.inspectedAt && st.minute - a.inspectedAt < 90 * MIN_D) return 'Une inspection a déjà eu lieu ce trimestre.';
  spend(st, 'deplacements', 1500, (x) => notify(st, x));
  a.inspectedAt = st.minute;
  a.quality = Math.min(1, a.quality + 0.12);
  a.moral = Math.max(10, a.moral - 4);
  const text = `Inspection de ${a.name} : méthodes revues, qualité du travail en hausse (le moral fléchit un peu).`;
  st.network!.log.push({ minute: st.minute, text });
  return text;
}

export function setDotation(st: GameState, id: string, value: number) {
  const a = st.network?.antennes.find((x) => x.id === id);
  if (a) a.dotation = Math.max(0, Math.min(a.staff * 600, Math.round(value / 50) * 50));
}

export function setPriority(st: GameState, id: string, p: Priority) {
  const a = st.network?.antennes.find((x) => x.id === id);
  if (!a) return;
  a.priority = p;
  // une priorité claire améliore légèrement l'efficacité, au prix d'un peu de moral
  a.quality = Math.min(1, a.quality + (p === 'equilibre' ? 0 : 0.03));
}

/** Détache un enquêteur du siège vers une antenne. */
export function detachTo(st: GameState, id: string, staffId: string): string {
  const a = st.network?.antennes.find((x) => x.id === id);
  const s = st.staff.find((x) => x.id === staffId);
  if (!a || !s || s.id === 'CMD') return 'Impossible.';
  st.staff = st.staff.filter((x) => x !== s);
  for (const c of st.cases) { c.team = c.team.filter((x) => x !== s.id); if (c.lead === s.id) c.lead = c.team[0] ?? null; }
  a.staff++;
  a.moral = Math.min(95, a.moral + 4);
  const text = `${s.prenom} ${s.nom} est détaché${s.sexe === 'F' ? 'e' : ''} à ${a.name}.`;
  st.network!.log.push({ minute: st.minute, text });
  notify(st, { level: 'info', text });
  return text;
}

/** Rappelle un agent d'une antenne vers le siège (il arrive sous quelques jours). */
export function recallFrom(st: GameState, rng: Rng, id: string): string {
  const a = st.network?.antennes.find((x) => x.id === id);
  if (!a || a.staff <= 2) return 'L\'antenne ne peut pas descendre sous deux agents.';
  a.staff--;
  a.moral = Math.max(10, a.moral - 5);
  const c = makeCandidate(rng, st, 'mutation');
  c.requested = true;
  c.availableFrom = st.minute + 3 * MIN_D;
  st.candidates.push(c);
  const text = `${c.staff.prenom} ${c.staff.nom} quitte ${a.name} pour rejoindre le siège (arrivée sous trois jours).`;
  st.network!.log.push({ minute: st.minute, text });
  return text;
}

export function changeChief(st: GameState, rng: Rng, id: string): string {
  const a = st.network?.antennes.find((x) => x.id === id);
  if (!a) return 'Antenne introuvable.';
  const old = `${a.chief.prenom} ${a.chief.nom}`;
  a.chief = { ...randomName(rng, rng.chance(0.5) ? 'F' : 'M'), skill: rng.int(8, 17) };
  a.moral = Math.max(10, a.moral - 6);
  const text = `${a.name} : ${old} est remplacé${''} par ${a.chief.prenom} ${a.chief.nom}.`;
  st.network!.log.push({ minute: st.minute, text });
  return text;
}
