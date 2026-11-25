// Moteur des connaissances : ce que l'équipe SAIT (indices découverts), et ce qu'elle peut
// en déduire. Rien ici ne lit la vérité cachée, à l'exception explicite des fonctions
// préfixées par « truth » (réservées aux décisions simulées des tiers et aux tests).
import type { Case, Clue } from './types';

export function found(c: Case): Clue[] {
  return c.clues.filter((k) => k.found);
}

export function knownPersons(c: Case) {
  return c.persons.filter((p) => p.known);
}

/** Une déclaration est « contredite » si un élément découvert la contredit. */
export function isContradicted(c: Case, k: Clue): boolean {
  return c.clues.some((o) => o.found && o.contradicts?.includes(k.id));
}

/** Contradictions identifiables à partir des informations découvertes. */
export function contradictions(c: Case): { a: Clue; b: Clue }[] {
  const out: { a: Clue; b: Clue }[] = [];
  for (const o of c.clues) {
    if (!o.found || !o.contradicts) continue;
    for (const id of o.contradicts) {
      const a = c.clues.find((x) => x.id === id);
      if (a?.found) out.push({ a, b: o });
    }
  }
  return out;
}

/** Éléments à charge connus contre une personne (pondérés, avant appréciation du parquet).
 * Les déclarations contredites ne comptent plus ; un élément disculpant découvert annule. */
export function charges(c: Case, pid: string): { total: number; material: number; confession: number; exculpated: boolean; items: Clue[] } {
  let total = 0, material = 0, confession = 0;
  const items: Clue[] = [];
  let exculpated = false;
  for (const k of c.clues) {
    if (!k.found) continue;
    if (k.exculpates?.includes(pid)) exculpated = true;
    const w = k.implicates?.find((x) => x.pid === pid)?.w ?? 0;
    if (!w || isContradicted(c, k)) continue;
    let v = w;
    // une analyse sur une pièce dont la chaîne de traçabilité est rompue perd de sa force
    if (k.action === 'labo' && k.itemId) {
      const it = c.items.find((i) => i.id === k.itemId);
      if (it && (!it.sealed || it.degraded)) v *= 0.5;
    }
    if (k.confession) {
      confession += v;
    } else {
      material += v;
    }
    items.push(k);
  }
  total = material + Math.min(confession, 3);
  return { total, material, confession, exculpated, items };
}

export function noCrimeWeight(c: Case): number {
  return found(c).reduce((s, k) => s + (k.noCrime ?? 0), 0);
}

/** Classement des personnes selon les éléments connus (affichage « éléments à charge »). */
export function suspicionRanking(c: Case) {
  return c.persons
    .filter((p) => p.known && p.role !== 'victime' && p.role !== 'disparu')
    .map((p) => ({ pid: p.pid, ...charges(c, p.pid) }))
    .sort((a, b) => b.total - a.total);
}

/** Les pistes que l'équipe a épuisées : aucune action connue ne peut plus rien apporter. */
export function progressRatio(c: Case): number {
  const reachable = c.clues.length;
  return reachable ? found(c).length / reachable : 0;
}
