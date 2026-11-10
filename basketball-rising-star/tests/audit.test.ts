import { describe, expect, it } from 'vitest';
import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
import { auditMatch, emptyReport, perGame } from '../src/sim/audit';

/** Garde-fou de l'intelligence de jeu : aucune régression vers des comportements absurdes. */
describe('Audit de l’intelligence de jeu (matchs complets 4 × 10 min)', () => {
  it('pas de contre-attaque gâchée, pas de rétention de balle, pas d’attaque bloquée', () => {
    const r = emptyReport();
    for (let g = 0; g < 5; g++) {
      const reg = new NameRegistry();
      const e = new MatchEngine({ home: quickTeam(1700 + g, 'A', 12, undefined, reg), away: quickTeam(1900 + g, 'B', 12, undefined, reg), rules: FIBA, seed: 8000 + g });
      auditMatch(e, r);
    }
    const pg = perGame(r);
    const viol = (k: string) => (r.violations[k] ?? 0) / r.games;
    console.log(pg, r.violations);
    expect(pg.missedBreakPass).toBeLessThan(3);
    expect(pg.holdTooLong).toBeLessThan(1.5);
    expect(pg.holderInKey).toBeLessThan(1);
    expect(pg.frozen).toBeLessThan(1.5);
    expect(pg.lostPassPct).toBeLessThan(7);
    expect(viol('Violation des 24 secondes')).toBeLessThan(1.5);
    expect(viol('Retour en zone')).toBeLessThan(1.5);
    expect(viol('Trois secondes dans la raquette')).toBeLessThan(1.5);
    expect(pg.threeRate).toBeGreaterThan(25);
  });
});
