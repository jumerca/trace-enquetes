import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
import { dist } from '../src/core/vec';
const N = Number(process.argv[2] ?? 6);
const passMax: number[] = [], lobMax: number[] = [], shotMax: number[] = [], passSpeed: number[] = [];
const brk = { total: 0, shot: 0, fwd: 0, back: 0, lost: 0, caught: 0 };
for (let g = 0; g < N; g++) {
  const reg = new NameRegistry();
  const e = new MatchEngine({ home: quickTeam(700 + g, 'A', 12, undefined, reg), away: quickTeam(900 + g, 'B', 12, ['#F36B32', '#101827'], reg), rules: FIBA, seed: 6000 + g });
  let cur: { kind: string; lob: boolean; max: number; d: number; t: number } | null = null;
  let lastFlight: unknown = null;
  let br: { idx: number; team: number; d0: number } | null = null;
  let cool = 0;
  while (!e.finished) {
    const ev0 = e.events.length;
    e.step();
    const f = e.ball.flight;
    if (f && f !== lastFlight && (f.kind === 'pass' || f.kind === 'shot')) {
      cur = { kind: f.kind, lob: !!f.lob, max: e.ball.z, d: Math.hypot(f.end.x - f.start.x, f.end.y - f.start.y), t: 0 };
      if (f.kind === 'pass' && f.from < 0) cur = null;
    }
    if (cur && f && (f.kind === cur.kind)) { cur.max = Math.max(cur.max, e.ball.z); cur.t += 1 / 60; }
    if (cur && (!f || f.kind !== cur.kind)) {
      if (cur.kind === 'shot') shotMax.push(cur.max);
      else { (cur.lob ? lobMax : passMax).push(cur.max); if (cur.t > 0.1) passSpeed.push(cur.d / cur.t); }
      cur = null;
    }
    lastFlight = f;
    // Échappées réelles en match
    cool -= 1 / 60;
    const h = e.holder();
    if (!br && cool <= 0 && h && e.phase === 'live') {
      const hoop = e.hoopFor(h.team);
      const d = dist(h.pos, hoop);
      if (d > 8 && d < 20 && e.teamOnCourt((1 - h.team) as 0 | 1).every((o) => dist(o.pos, hoop) > d + 0.6)) { br = { idx: h.idx, team: h.team, d0: d }; brk.total++; }
    }
    if (br) {
      for (const ev of e.events.slice(ev0)) {
        if (!br) break;
        if (ev.type === 'shot' && ev.player === br.idx) { brk.shot++; br = null; }
        else if (ev.type === 'pass' && ev.player === br.idx) {
          const hoop = e.hoopFor(br.team as 0 | 1);
          const to = e.players[ev.other!];
          const me = e.players[br.idx];
          if (dist(to.pos, hoop) < dist(me.pos, hoop)) brk.fwd++; else brk.back++;
          br = null;
        } else if (ev.type === 'turnover' || ev.type === 'violation' || ev.type === 'foul' || ev.type === 'steal') { brk.lost++; br = null; }
      }
      if (br && h && h.idx === br.idx) {
        const hoop = e.hoopFor(h.team);
        if (!e.teamOnCourt((1 - h.team) as 0 | 1).every((o) => dist(o.pos, hoop) > dist(h.pos, hoop) - 0.3)) { brk.caught++; br = null; }
      }
      if (!br) cool = 3;
    }
  }
}
const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.floor((a.length - 1) * p)]?.toFixed(2);
console.log('passes tendues  n=', passMax.length, 'hauteur max médiane', q(passMax, 0.5), '95e centile', q(passMax, 0.95), 'part au-dessus de 2,5 m', ((passMax.filter((z) => z > 2.5).length / passMax.length) * 100).toFixed(1) + ' %');
console.log('passes lobées   n=', lobMax.length, 'médiane', q(lobMax, 0.5), '95e', q(lobMax, 0.95), 'part des passes', ((lobMax.length / (lobMax.length + passMax.length)) * 100).toFixed(1) + ' %');
console.log('tirs            n=', shotMax.length, 'médiane', q(shotMax, 0.5), '5e centile', q(shotMax, 0.05));
console.log('vitesse des passes (m/s) médiane', q(passSpeed, 0.5), '5e', q(passSpeed, 0.05), '95e', q(passSpeed, 0.95));
console.log('échappées /match', (brk.total / N).toFixed(1), brk);
