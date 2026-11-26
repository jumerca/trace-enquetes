import { Rng } from '../src/core/rng';
import { acceptInPlace, careerNewYear, gradeFor, commanderAge, criteria, declineOffer, level, LEVELS, RETIREMENT_AGE } from '../src/sim/career';
import { acceptMutation, step } from '../src/sim/sim';
import { serialize, deserialize } from '../src/save/save';
import { calendar } from '../src/sim/calendar';
import { game } from './helpers';
import type { GameState } from '../src/sim/types';

/** Prépare un dossier d'avancement exemplaire. */
function goodRecord(st: GameState, years = 5) {
  st.minute += years * 365 * 1440;
  st.hierarchy.evaluations.push({ year: 1996, note: 16, text: '' }, { year: 1997, note: 16.5, text: '' });
  st.commander.reputation = 80;
  for (const s of st.staff) s.moral = 75;
}

describe('Progression de carrière', () => {
  it('six échelons, de la brigade locale à la coordination nationale', () => {
    expect(LEVELS.length).toBe(6);
    expect(LEVELS[0].title).toContain('Brigade');
    expect(LEVELS[5].title).toContain('nationale');
    for (let i = 1; i < LEVELS.length; i++) expect(LEVELS[i].scale).toBeGreaterThan(LEVELS[i - 1].scale);
  });

  it('aucune proposition sans dossier suffisant', () => {
    const st = game(1);
    careerNewYear(st, new Rng(1), 1996);
    expect(st.hierarchy.offers.length).toBe(0);
    expect(criteria(st).some((c) => !c.ok)).toBe(true);
  });

  it('un dossier exemplaire entraîne une proposition ; l\'avancement sur place élargit le ressort', () => {
    const st = game(2);
    goodRecord(st);
    careerNewYear(st, new Rng(2), 1998);
    expect(st.hierarchy.offers.length).toBe(1);
    const envBefore = Object.values(st.budget.envelope).reduce((a, b) => a + b, 0);
    const cand = st.candidates.length;
    acceptInPlace(st, new Rng(3), st.hierarchy.offers[0].id);
    expect(st.hierarchy.rank).toBe(1);
    expect(st.commander.grade).toBe(gradeFor(1, calendar(st.startYear, st.minute).year));
    expect(st.staff.find((s) => s.id === 'CMD')!.grade).toBe(st.commander.grade);
    expect(Object.values(st.budget.envelope).reduce((a, b) => a + b, 0)).toBeGreaterThan(envBefore);
    expect(st.candidates.filter((c) => c.requested).length).toBeGreaterThan(0);
    expect(st.candidates.length).toBeGreaterThan(cand);
    expect(level(st).scale).toBeGreaterThan(1);
    // l'ancienneté dans le nouveau poste repart de zéro : pas de nouvelle proposition immédiate
    careerNewYear(st, new Rng(4), 1999);
    expect(st.hierarchy.offers.filter((o) => !o.answered).length).toBe(0);
  });

  it('on peut décliner une proposition', () => {
    const st = game(3);
    goodRecord(st);
    careerNewYear(st, new Rng(2), 1998);
    declineOffer(st, st.hierarchy.offers[0].id);
    expect(st.hierarchy.rank).toBe(0);
    expect(st.hierarchy.offers[0].answered).toBe(true);
  });

  it('mutation dans une ville plus grande : même commandant, même date, même carrière', () => {
    const st = game(4);
    st.hierarchy.rank = 1;
    goodRecord(st);
    careerNewYear(st, new Rng(5), 2000);
    const o = st.hierarchy.offers[0];
    expect(o.options.some((x) => x.kind === 'mutation')).toBe(true);
    const ns = acceptMutation(st, o.id)!;
    expect(ns.city.population).toBeGreaterThan(st.city.population);
    expect(ns.city.name).not.toBe(st.city.name);
    expect(ns.minute).toBe(st.minute - (st.minute % 10));
    expect(ns.commander.nom).toBe(st.commander.nom);
    expect(commanderAge(ns)).toBe(commanderAge(st));
    expect(ns.hierarchy.rank).toBe(2);
    expect(ns.hierarchy.career.length).toBeGreaterThan(st.hierarchy.career.length);
    expect(calendar(ns.startYear, ns.minute).year).toBe(calendar(st.startYear, st.minute).year);
    // la nouvelle brigade tourne normalement
    step(ns, 10 * 1440);
    expect(ns.cases.length).toBeGreaterThan(0);
    expect(deserialize(serialize(ns)).hierarchy.rank).toBe(2);
  });

  it('grades cohérents selon l\'époque, jamais de rétrogradation apparente', () => {
    for (const y of [1975, 1990, 1995, 2025]) for (let r = 0; r < LEVELS.length; r++) expect(gradeFor(r, y)).toBeTruthy();
    expect(gradeFor(0, 1975)).toBe('Commissaire');
    expect(gradeFor(1, 1975)).toBe('Commissaire principal');
    // le passage de 1995 ne fait jamais « reculer » un grade
    for (let r = 1; r < LEVELS.length; r++) expect(gradeFor(r, 1994)).toBe(gradeFor(r, 1996));
    const st = game(9, 1975);
    expect(st.commander.grade).toBe('Commissaire');
  });

  it('retraite du commandant à 65 ans', () => {
    const st = game(5);
    const cmd = st.staff.find((s) => s.id === 'CMD')!;
    cmd.birthYear = calendar(st.startYear, st.minute).year - RETIREMENT_AGE;
    careerNewYear(st, new Rng(1), calendar(st.startYear, st.minute).year);
    expect(st.hierarchy.retired).toBe(true);
    expect(st.notices.some((n) => n.text.includes('retraite'))).toBe(true);
  });

  it('les sauvegardes de la version précédente sont migrées', () => {
    const st = game(6);
    const old = JSON.parse(serialize(st));
    old.version = 1;
    old.state.hierarchy = { evaluations: [{ year: 1995, note: 12, text: '' }], rank: 1 };
    const ns = deserialize(JSON.stringify(old));
    expect(ns.hierarchy.rank).toBe(1);
    expect(Array.isArray(ns.hierarchy.offers)).toBe(true);
    expect(ns.hierarchy.career.length).toBe(1);
    expect(ns.hierarchy.retired).toBe(false);
  });

  it('changement d\'époque annoncé avec les nouvelles techniques', () => {
    const st = game(7, 1975);
    careerNewYear(st, new Rng(1), 1985);
    expect(st.notices.some((n) => n.text.includes('Nouvelle époque') && n.text.includes('biologiques'))).toBe(true);
  });
});
