import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
const c: Record<string, number> = {};
for (let g = 0; g < 3; g++) {
  const e = new MatchEngine({ home: quickTeam(10 + g, 'A'), away: quickTeam(300 + g, 'B'), rules: FIBA, seed: 50 + g });
  const orig = e.launchPass.bind(e);
  e.launchPass = (from, to, kind) => { const k = 'pass_' + (from.intent === 'lecture' ? 'lecture' : 'normal'); c[k] = (c[k] ?? 0) + 1; orig(from, to, kind); };
  e.runToEnd();
  for (const ev of e.events) {
    if (ev.type === 'steal') { const k = ev.text.includes('Interception') ? 'interception' : 'strip'; c[k] = (c[k] ?? 0) + 1; }
  }
}
console.log(c);
