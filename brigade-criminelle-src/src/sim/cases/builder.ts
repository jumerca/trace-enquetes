// Outils de construction d'un dossier : la vérité (qui, quoi, quand) est fixée AVANT
// l'apparition de l'affaire ; chaque information obtenable en découle.
import type { Rng } from '../../core/rng';
import { calendar, MIN_D } from '../calendar';
import { placesOf } from '../city';
import { PROFESSIONS, randomAppearance, randomName } from '../names';
import type { Case, CasePerson, CaseType, Clue, DistrictId, EvidenceItem, GameState, Person, Place, PlaceKind, Truth } from '../types';

export const PROOF = 10; // seuil de charges suffisantes (modèle simplifié du jeu)

export type ClueInput = Omit<Clue, 'id' | 'found' | 'attempts'> & { id?: string };

export class CaseBuilder {
  c: Case;
  constructor(public st: GameState, public rng: Rng, templateId: string, type: CaseType, place: Place, factsAt: number) {
    const id = `A${++st.counters.case}`;
    const y = calendar(st.startYear, st.minute).year;
    this.c = {
      id, number: `${y}/${String(st.counters.case).padStart(4, '0')}`, templateId, type, title: '', summary: '',
      openedAt: st.minute, factsAt, placeId: place.id, district: place.district, priority: 2, complexity: 2, urgency: 0.3,
      mediaInterest: 0.2, persons: [], clues: [], items: [], truth: { culprit: null, kind: 'infraction', summary: '', timeline: [] },
      stage: 'signalement', status: 'ouverte', lead: null, team: [], vehicle: null, budgetSpent: 0, budgetCap: 1500,
      actions: [], done: [], board: { notes: [], links: [], pos: {} }, linkedCases: [], hypothesis: { pid: null, kind: null },
      auths: [], reopenCount: 0, procedureFlaws: 0, workload: 0, stalledH: 0,
    };
  }

  person(role: CasePerson['role'], opts: { prof?: string; age?: [number, number]; sexe?: 'F' | 'M'; known?: boolean; sincerity?: number; nervosity?: number; record?: boolean; district?: DistrictId; reuse?: string } = {}): string {
    if (opts.reuse && this.st.people[opts.reuse]) {
      const p = this.st.people[opts.reuse];
      p.cases.push(this.c.id);
      this.c.persons.push({ pid: p.id, role, known: opts.known ?? false, interviewed: 0, stress: p.nervosity * 0.5, lawyer: false, silent: false, inCustody: false, cleared: false });
      return p.id;
    }
    const rng = this.rng;
    const sexe = opts.sexe ?? (rng.chance(0.5) ? 'F' : 'M');
    const age = rng.int(...(opts.age ?? [22, 70]));
    const { prenom, nom } = randomName(rng, sexe);
    const id = `H${++this.st.counters.person}`;
    const p: Person = {
      id, prenom, nom, sexe, age, profession: opts.prof ?? rng.pick(PROFESSIONS),
      district: opts.district ?? this.c.district, homePlace: null,
      sincerity: opts.sincerity ?? rng.range(0.6, 1), nervosity: opts.nervosity ?? rng.range(0.05, 0.9),
      cooperation: rng.range(0.4, 1), memory: rng.range(0.5, 1), appearance: randomAppearance(rng, sexe, age),
      record: opts.record ?? false, cases: [this.c.id],
    };
    this.st.people[id] = p;
    this.c.persons.push({ pid: id, role, known: opts.known ?? false, interviewed: 0, stress: p.nervosity * 0.5, lawyer: false, silent: false, inCustody: false, cleared: false });
    return id;
  }

  n(pid: string) {
    const p = this.st.people[pid];
    return `${p.prenom} ${p.nom}`;
  }
  p(pid: string) {
    return this.st.people[pid];
  }
  /** « il » / « elle » selon la personne simulée (personnage fictif dont le sexe est défini). */
  il(pid: string) {
    return this.st.people[pid].sexe === 'F' ? 'elle' : 'il';
  }
  e(pid: string) {
    return this.st.people[pid].sexe === 'F' ? 'e' : '';
  }

  item(label: string, labTypes: EvidenceItem['labTypes']): string {
    const id = `${this.c.id}-I${this.c.items.length + 1}`;
    this.c.items.push({ id, label, labTypes, collected: false, sealed: false, location: 'terrain', chain: [], degraded: false });
    return id;
  }

  clue(ci: ClueInput): string {
    const id = ci.id ?? `${this.c.id}-K${this.c.clues.length + 1}`;
    this.c.clues.push({ ...ci, id, found: false, attempts: 0 });
    return id;
  }

  truth(t: Truth) {
    this.c.truth = t;
  }

  finish(o: { title: string; summary: string; priority: 1 | 2 | 3; complexity: number; urgency: number; media: number; budget?: number }): Case {
    const c = this.c;
    Object.assign(c, { title: o.title, summary: o.summary, priority: o.priority, complexity: o.complexity, urgency: o.urgency, mediaInterest: o.media, budgetCap: o.budget ?? 800 + o.complexity * 500 });
    c.workload = c.clues.length * 3 + o.complexity * 6;
    c.deadline = c.openedAt + (o.priority === 1 ? 10 : o.priority === 2 ? 30 : 60) * MIN_D;
    return c;
  }
}

export function pickPlace(st: GameState, rng: Rng, kinds: PlaceKind[], district?: DistrictId): Place {
  const list = placesOf(st.city, kinds, district);
  const all = list.length ? list : placesOf(st.city, kinds);
  return all.length ? rng.pick(all) : rng.pick(st.city.places.filter((p) => p.kind !== 'commissariat'));
}

export function hm(minute: number) {
  const h = Math.floor(((minute % 1440) + 1440) % 1440 / 60), m = ((minute % 60) + 60) % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}
