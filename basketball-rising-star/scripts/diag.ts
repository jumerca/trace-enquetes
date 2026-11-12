import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
const N = Number(process.argv[2] ?? 8);
const oob: Record<string, number> = {};
const tov: Record<string, number> = {};
let pts = 0, fga = 0, fgm = 0, stl = 0, tovs = 0, ast = 0, orb = 0, reb = 0, pf = 0, tpa = 0, tpm = 0, fta = 0, blk = 0;
for (let g = 0; g < N; g++) {
  const reg = new NameRegistry();
  const e = new MatchEngine({ home: quickTeam(700 + g, 'A', 12, undefined, reg), away: quickTeam(900 + g, 'B', 12, ['#F36B32', '#101827'], reg), rules: FIBA, seed: 4000 + g });
  let ctx = 'none';
  let lastKind = 'none';
  const orig = e.outOfBounds.bind(e);
  e.outOfBounds = () => { oob[ctx] = (oob[ctx] ?? 0) + 1; orig(); };
  while (!e.finished) {
    const f = e.ball.flight;
    if (f) { lastKind = f.kind + ((f as any).lob ? '-lob' : ''); ctx = lastKind + (e.lastShot ? '+shot' : ''); }
    else if (e.ball.state === 'held') { ctx = 'held'; }
    else if (e.ball.state === 'loose' && ctx === 'held') ctx = 'strip/drop';
    e.step();
  }
  for (const ev of e.events) {
    if (ev.type === 'violation') { const k = ev.text.split(' (')[0]; tov[k] = (tov[k] ?? 0) + 1; }
    if (ev.type === 'turnover' && ev.text) { const k = ev.text.replace(/ par .*/, ''); tov[k] = (tov[k] ?? 0) + 1; }
  }
  for (const p of e.players) { const b = p.box; pts += b.pts; fga += b.fga; fgm += b.fgm; stl += b.stl; tovs += b.tov; ast += b.ast; orb += b.orb; reb += b.reb ?? (b.orb + b.drb); pf += b.pf; tpa += b.tpa; tpm += b.tpm; fta += b.fta; blk += b.blk; }
}
const t = (v: number) => (v / N / 2).toFixed(1);
console.log('par équipe: pts', t(pts), 'fg', t(fgm) + '/' + t(fga), (fgm / fga * 100).toFixed(1) + '%', '3p', t(tpm) + '/' + t(tpa), 'fta', t(fta), 'ast', t(ast), 'stl', t(stl), 'tov', t(tovs), 'orb', t(orb), 'reb', t(reb), 'pf', t(pf), 'blk', t(blk));
console.log('OOB/match', Object.fromEntries(Object.entries(oob).map(([k, v]) => [k, (v / N).toFixed(2)])));
console.log('events/match', Object.fromEntries(Object.entries(tov).map(([k, v]) => [k, (v / N).toFixed(2)])));
