import { eraOf, calendar } from '../src/sim/calendar';
import { newGame } from '../src/sim/sim';
import type { Case, GameState } from '../src/sim/types';

export function game(seed = 42, year = 1995, assist: GameState['settings']['assist'] = 'delegation', scenario: 'saint-clair' | 'libre' = 'saint-clair') {
  return newGame({ seed, startYear: year, size: 'moyenne', scenario, assist, commander: { prenom: 'Claire', nom: 'Vasseur', age: 45, portrait: 0, experience: 'confirme', formation: 'ecole', specialite: 'Généraliste', style: 'participatif', sexe: 'F' } });
}

/** Découverte « omnisciente » : toutes les informations atteignables, prérequis respectés. */
export function solveAll(st: GameState, c0: Case): Case {
  const c: Case = JSON.parse(JSON.stringify(c0));
  const era = eraOf(calendar(st.startYear, st.minute).year);
  const reachableItem = (id?: string) => !id || c.clues.some((k) => k.found && k.revealsItem === id);
  let changed = true;
  while (changed) {
    changed = false;
    for (const k of c.clues) {
      if (k.found) continue;
      if (k.requires && !k.requires.every((r) => c.clues.find((x) => x.id === r)?.found)) continue;
      if (k.action === 'labo' && (!reachableItem(k.itemId) || !era.lab[k.labType!].available)) continue;
      k.found = true;
      changed = true;
      if (k.revealsItem) { const it = c.items.find((i) => i.id === k.revealsItem)!; it.collected = true; it.sealed = true; }
    }
  }
  return c;
}
