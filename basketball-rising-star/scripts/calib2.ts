import { MatchEngine } from '../src/sim/engine';
import { FIBA, withQuarterLength } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
const agg: Record<string, { n: number; exp: number; made: number }> = {};
const oob: Record<string, number> = {};
for (let g = 0; g < 3; g++) {
  const e = new MatchEngine({ home: quickTeam(10 + g, 'Lions'), away: quickTeam(200 + g, 'Aigles'), rules: withQuarterLength(FIBA, 10), seed: 1000 + g });
  const orig = e.outOfBounds.bind(e);
  e.outOfBounds = () => { const k = `${e.ball.flight?.kind ?? 'none'}|last=${e.lastShot ? 'shot' : '-'}`; oob[k] = (oob[k] ?? 0) + 1; orig(); };
  e.runToEnd();
  let cur: { type: string; p: number } | null = null;
  for (const ev of e.events) {
    if (ev.type === 'shot') { cur = { type: ev.text.split(' ').slice(2).join(' '), p: parseInt(ev.detail ?? '0') / 100 }; }
    if ((ev.type === 'made' || ev.type === 'miss' || ev.type === 'block') && cur) {
      const a = (agg[cur.type] ??= { n: 0, exp: 0, made: 0 });
      a.n++; a.exp += cur.p; if (ev.type === 'made') a.made++; cur = null;
    }
  }
}
for (const [k, a] of Object.entries(agg)) console.log(k.padEnd(30), a.n, 'exp', (a.exp / a.n).toFixed(2), 'real', (a.made / a.n).toFixed(2));
console.log(oob);
