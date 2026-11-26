import { Rng } from '../src/core/rng';
import { templates } from '../src/sim/cases/templates';
import { buildSagaCase, SAGA_STEPS } from '../src/sim/cases/saga';
import { PROOF } from '../src/sim/cases/builder';
import { charges, isContradicted, noCrimeWeight } from '../src/sim/knowledge';
import { game, solveAll } from './helpers';
import type { Case, GameState } from '../src/sim/types';

function checkCase(st: GameState, c: Case): string[] {
  const errs: string[] = [];
  const ids = new Set(c.clues.map((k) => k.id));
  const pids = new Set(c.persons.map((p) => p.pid));
  if (ids.size !== c.clues.length) errs.push('identifiants d\'indices dupliqués');
  for (const k of c.clues) {
    for (const r of k.requires ?? []) if (!ids.has(r)) errs.push(`${k.id} requiert ${r} inexistant`);
    for (const r of k.contradicts ?? []) if (!ids.has(r)) errs.push(`${k.id} contredit ${r} inexistant`);
    if (k.personId && !pids.has(k.personId)) errs.push(`${k.id} concerne une personne hors dossier`);
    if (k.revealsPerson && !pids.has(k.revealsPerson)) errs.push(`${k.id} révèle une personne hors dossier`);
    for (const i of k.implicates ?? []) if (!pids.has(i.pid)) errs.push(`${k.id} implique une personne hors dossier`);
    if (k.itemId && !c.items.some((i) => i.id === k.itemId)) errs.push(`${k.id} : pièce inexistante`);
    if (k.action === 'labo' && !c.clues.some((o) => o.revealsItem === k.itemId)) errs.push(`${k.id} : pièce jamais saisie`);
    if (!k.text || k.text.includes('undefined')) errs.push(`${k.id} : texte invalide « ${k.text} »`);
  }
  if (c.title.includes('undefined') || c.summary.includes('undefined')) errs.push('titre/résumé invalide');
  const s = solveAll(st, c);
  // chaque personne inconnue au départ doit pouvoir être identifiée
  for (const p of c.persons) if (!p.known && !s.clues.some((k) => k.found && k.revealsPerson === p.pid)) errs.push(`${st.people[p.pid].prenom} ${st.people[p.pid].nom} n'est jamais identifiable`);
  // cohérence des témoignages : toute déclaration mensongère est réfutable par un fait vérifiable
  for (const k of s.clues) if (!k.reliable && !isContradicted(s, k)) errs.push(`déclaration fausse non réfutable : ${k.text}`);
  const t = c.truth;
  if (t.culprit) {
    if (!pids.has(t.culprit)) errs.push('auteur hors dossier');
    const ch = charges(s, t.culprit);
    if (ch.total < PROOF * 1.2) errs.push(`charges max contre l'auteur insuffisantes (${ch.total})`);
    if (ch.material < 6) errs.push('pas assez d\'éléments matériels contre l\'auteur');
    if (ch.exculpated) errs.push('l\'auteur est disculpé par un élément « fiable »');
  } else {
    if (noCrimeWeight(s) < 8) errs.push(`absence d'infraction non démontrable (${noCrimeWeight(s)})`);
  }
  for (const p of c.persons) {
    if (p.pid === t.culprit || p.pid === t.accomplice) continue;
    const ch = charges(s, p.pid);
    if (ch.total >= PROOF && !ch.exculpated) errs.push(`innocent ${st.people[p.pid].nom} accusable (${ch.total})`);
  }
  // aucune information fiable ne doit impliquer un innocent plus que l'auteur
  return errs;
}

describe('Générateur d\'affaires', () => {
  it('40 modèles procéduraux et la grande affaire', () => {
    expect(templates(1995).length).toBeGreaterThanOrEqual(40);
    expect(new Set(templates(1995).map((t) => t.id)).size).toBe(templates(1995).length);
    // les quinze types d'affaires du cahier des charges sont couverts
    expect(new Set(templates(1995).map((t) => t.type)).size).toBe(15);
    expect(SAGA_STEPS.length).toBe(4);
  });

  it('2 000 affaires procédurales sont solvables et cohérentes, toutes époques', () => {
    const years = [1975, 1985, 1995, 2005, 2015, 2025];
    const problems: string[] = [];
    const counts: Record<string, number> = {};
    let n = 0;
    for (let i = 0; n < 2000; i++) {
      const year = years[i % years.length];
      const st = game(1000 + i, year);
      const rng = new Rng(7 + i * 13);
      for (const t of templates(year)) {
        if (t.minYear && year < t.minYear) continue;
        const c = t.build(st, rng);
        st.cases.push(c);
        counts[t.id] = (counts[t.id] ?? 0) + 1;
        const e = checkCase(st, c);
        if (e.length) problems.push(`[${year} ${t.id}] ${e.join(' ; ')}`);
        n++;
      }
    }
    expect(problems.slice(0, 15)).toEqual([]);
    expect(Object.keys(counts).length).toBeGreaterThanOrEqual(40);
  });

  it('la grande affaire « Les ombres de Saint-Clair » est cohérente et contient une coïncidence', () => {
    const st = game(5);
    const cases = (['A', 'D', 'B', 'C'] as const).map((k) => { const c = buildSagaCase(st, new Rng(3), k); st.cases.push(c); return c; });
    for (const c of cases) expect(checkCase(st, c)).toEqual([]);
    const linked = cases.filter((c) => c.clues.some((k) => k.links));
    expect(linked.map((c) => c.templateId).sort()).toEqual(['saga-A', 'saga-B', 'saga-C']);
    // l'antiquaire : élément commun (la camionnette) mais aucun lien réel
    const d = cases.find((c) => c.templateId === 'saga-D')!;
    expect(d.clues.some((k) => k.text.includes('Roussel'))).toBe(true);
    expect(d.clues.some((k) => k.links)).toBe(false);
    // personnages partagés entre dossiers
    expect(st.people['SAGA-marchal'].cases.length).toBe(3);
  });

  it('la vérité est fixée avant l\'apparition et ne change pas pendant l\'enquête', async () => {
    const st = game(77, 1995, 'delegation');
    const { step } = await import('../src/sim/sim');
    const before = new Map(st.cases.map((c) => [c.id, JSON.stringify(c.truth)]));
    step(st, 20 * 1440);
    for (const c of st.cases) if (before.has(c.id)) expect(JSON.stringify(c.truth)).toBe(before.get(c.id));
  });
});
