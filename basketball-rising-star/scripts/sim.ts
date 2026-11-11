import { MatchEngine } from '../src/sim/engine';
import { FIBA, withQuarterLength } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
const N = Number(process.argv[2] ?? 5);
const qlen = Number(process.argv[3] ?? 10);
let tot = { pts: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, orb: 0, drb: 0, ast: 0, stl: 0, blk: 0, tov: 0, pf: 0 } as Record<string, number>;
const vio: Record<string, number> = {};
let poss = 0;
const t0 = Date.now();
for (let g = 0; g < N; g++) {
  const e = new MatchEngine({ home: quickTeam(10 + g, 'Lions'), away: quickTeam(200 + g, 'Aigles', 12, ['#F36B32', '#101827']), rules: withQuarterLength(FIBA, qlen), seed: 1000 + g });
  e.runToEnd();
  poss += e.startedPossessions;
  for (const p of e.players) for (const k of Object.keys(tot)) tot[k] += (p.box as any)[k];
  for (const ev of e.events) if (ev.type === 'violation') { const k = ev.text.split(' (')[0]; vio[k] = (vio[k] ?? 0) + 1; }
  console.log(`G${g}: ${e.teams[0].score}-${e.teams[1].score} q=${e.quarter} t=${e.time.toFixed(0)}s ev=${e.events.length} fin=${e.finished}`);
}
const per = (k: string) => (tot[k] / N / 2).toFixed(1);
console.log('par équipe:', Object.keys(tot).map((k) => `${k}=${per(k)}`).join(' '));
console.log(`FG%=${(tot.fgm / tot.fga * 100).toFixed(1)} 3P%=${(tot.tpm / tot.tpa * 100).toFixed(1)} FT%=${(tot.ftm / tot.fta * 100).toFixed(1)} poss/team=${(poss / N / 2).toFixed(1)}`);
console.log('violations', vio, `ms/match=${((Date.now() - t0) / N).toFixed(0)}`);
