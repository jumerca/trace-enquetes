import { describe, expect, it } from 'vitest';
import { MatchEngine } from '../src/sim/engine';
import { FIBA, withQuarterLength } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';

/** Test d'équilibre sur de nombreux matchs complets (quarts officiels de 10 min). */
describe('Équilibre statistique du moteur', () => {
  it('produit des statistiques plausibles sur 24 matchs', () => {
    const N = 24;
    const t = { pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, tov: 0, pf: 0, orb: 0, drb: 0 } as Record<string, number>;
    let overtime = 0;
    for (let g = 0; g < N; g++) {
      const e = new MatchEngine({ home: quickTeam(100 + g, 'A'), away: quickTeam(500 + g, 'B'), rules: withQuarterLength(FIBA, 10), seed: 7000 + g });
      e.runToEnd();
      if (e.quarter > 4) overtime++;
      for (const p of e.players) for (const k of Object.keys(t)) t[k] += (p.box as unknown as Record<string, number>)[k];
    }
    const per = (k: string) => t[k] / N / 2;
    const fg = t.fgm / t.fga;
    const tp = t.tpm / t.tpa;
    const ft = t.ftm / t.fta;
    const orbRate = t.orb / (t.orb + t.drb);
    console.log({ ppg: per('pts'), fga: per('fga'), fg, tp, ft, tov: per('tov'), pf: per('pf'), orbRate, overtime });
    expect(per('pts')).toBeGreaterThan(68);
    expect(per('pts')).toBeLessThan(100);
    expect(fg).toBeGreaterThan(0.36);
    expect(fg).toBeLessThan(0.56);
    expect(tp).toBeGreaterThan(0.26);
    expect(tp).toBeLessThan(0.45);
    expect(ft).toBeGreaterThan(0.6);
    expect(ft).toBeLessThan(0.9);
    expect(orbRate).toBeGreaterThan(0.15);
    expect(orbRate).toBeLessThan(0.4);
    expect(per('tov')).toBeLessThan(25);
  });
});
