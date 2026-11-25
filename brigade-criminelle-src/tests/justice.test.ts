import { Rng } from '../src/core/rng';
import { templates } from '../src/sim/cases/templates';
import { transmit } from '../src/sim/justice';
import { charges } from '../src/sim/knowledge';
import { discover } from '../src/sim/investigation';
import { startInterview, interviewTurn } from '../src/sim/interview';
import { game, solveAll } from './helpers';

function crimeCase(seed: number) {
  const st = game(seed, 1995, 'manuel');
  const t = templates(1995).find((x) => x.id === 'cambriolage-pavillon')!;
  const c = t.build(st, new Rng(seed));
  st.cases.push(c);
  return { st, c };
}

describe('Justice simulée', () => {
  it('des aveux seuls ne suffisent pas : complément d\'enquête', () => {
    const { st, c } = crimeCase(11);
    const conf = c.clues.find((k) => k.confession)!;
    conf.found = true;
    const o = transmit(st, null, c, { kind: 'poursuites', pid: c.truth.culprit! });
    expect(o.decision).toBe('complement');
    expect(c.status).toBe('ouverte');
  });
  it('un dossier complet contre l\'auteur entraîne des poursuites', () => {
    const { st, c } = crimeCase(12);
    const solved = solveAll(st, c);
    c.clues = solved.clues; c.items = solved.items;
    const o = transmit(st, null, c, { kind: 'poursuites', pid: c.truth.culprit! });
    expect(o.decision).toBe('poursuites');
    expect(o.correct).toBe(true);
  });
  it('désigner une personne disculpée est refusé par le parquet', () => {
    const { st, c } = crimeCase(13);
    const solved = solveAll(st, c);
    c.clues = solved.clues; c.items = solved.items;
    const innocent = c.persons.find((p) => p.role === 'suspect' && p.pid !== c.truth.culprit)!.pid;
    expect(charges(c, innocent).exculpated).toBe(true);
    const o = transmit(st, null, c, { kind: 'poursuites', pid: innocent });
    expect(o.decision).toBe('complement');
  });
  it('un classement faute de preuves est jugé approprié quand les charges sont faibles', () => {
    const { st, c } = crimeCase(14);
    const o = transmit(st, null, c, { kind: 'classement_insuffisant' });
    expect(o.correct).toBe(true);
    expect(c.status).toBe('classee');
  });
  it('une déclaration mensongère est réfutable et la contradiction est détectée', () => {
    const { st, c } = crimeCase(15);
    const lie = c.clues.find((k) => !k.reliable)!;
    const check = c.clues.find((k) => k.contradicts?.includes(lie.id))!;
    discover(st, c, lie, undefined);
    discover(st, c, check, undefined);
    const ch = charges(c, lie.personId!);
    expect(ch.items.some((k) => k.id === lie.id)).toBe(false);
  });
});

describe('Entretiens', () => {
  it('la nervosité ne révèle rien en soi ; les approches donnent accès à la mémoire de la personne', () => {
    const { st, c } = crimeCase(21);
    const victim = c.persons.find((p) => p.role === 'victime')!;
    c.lead = st.staff.find((s) => s.role === 'officier')!.id;
    const s = startInterview(st, c, victim.pid, false);
    for (let i = 0; i < 6; i++) interviewTurn(st, new Rng(i), s, i % 2 ? 'ouverte' : 'chronologie');
    expect(c.clues.filter((k) => k.found && k.personId === victim.pid).length).toBeGreaterThan(0);
    // une personne nerveuse mais innocente n'a pas de charge du seul fait de sa nervosité
    const herring = c.persons.find((p) => p.role === 'suspect' && p.pid !== c.truth.culprit)!;
    expect(st.people[herring.pid].nervosity).toBeGreaterThanOrEqual(0.7);
    expect(charges(c, herring.pid).total).toBe(0);
  });
  it('les aveux ne sont accessibles qu\'en garde à vue', () => {
    const { st, c } = crimeCase(22);
    const culprit = c.truth.culprit!;
    for (const k of c.clues) if (k.id !== c.clues.find((x) => x.confession)!.id) k.found = true;
    c.lead = st.staff.find((s) => s.role === 'officier')!.id;
    const s = startInterview(st, c, culprit, false);
    for (let i = 0; i < 8; i++) interviewTurn(st, new Rng(i), s, 'element');
    expect(c.clues.find((k) => k.confession)!.found).toBe(false);
  });
});
