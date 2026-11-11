import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
import { auditMatch, emptyReport, perGame } from '../src/sim/audit';
const N = Number(process.argv[2] ?? 10);
const r = emptyReport();
for (let g = 0; g < N; g++) {
  const reg = new NameRegistry();
  const e = new MatchEngine({ home: quickTeam(700 + g, 'A', 12, undefined, reg), away: quickTeam(900 + g, 'B', 12, ['#F36B32', '#101827'], reg), rules: FIBA, seed: 4000 + g });
  auditMatch(e, r);
}
const pg = perGame(r);
for (const [k, v] of Object.entries(pg)) console.log(k.padEnd(22), v.toFixed(2));
console.log('violations/match', Object.fromEntries(Object.entries(r.violations).map(([k, v]) => [k, (v / N).toFixed(2)])));
