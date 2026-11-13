import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
const N = Number(process.argv[2] ?? 8);
const sh: Record<string, [number, number]> = {};
let passes = 0, poss = 0, pts = 0, fga = 0, fgm = 0, tpa = 0, fta = 0, ast = 0, tov = 0, orb = 0, bigPts = 0, bigFga = 0, postTouch = 0;
const site: Record<string, number> = {};
const band: Record<string, [number, number]> = {};
for (let g = 0; g < N; g++) {
  const reg = new NameRegistry();
  const e = new MatchEngine({ home: quickTeam(700 + g, 'A', 12, undefined, reg), away: quickTeam(900 + g, 'B', 12, ['#F36B32', '#101827'], reg), rules: FIBA, seed: 8000 + g });
  const orig = e.launchPass.bind(e);
  e.launchPass = (a, b, k) => { if (k !== 'tip' && k !== 'inbound') { passes++; const key = (new Error().stack!.split('\n')[2] || '').replace(/.*offense\.ts:/, 'off:').replace(/:\d+\)?$/, ''); site[key] = (site[key] ?? 0) + 1; } orig(a, b, k); };
  let lastPoss = -1; let lastHolder = -1; let evN = 0; let pend: string | null = null;
  while (!e.finished) {
    e.step();
    if (e.phase === 'live' && e.possession !== lastPoss) { poss++; lastPoss = e.possession; }
    for (; evN < e.events.length; evN++) {
      const ev = e.events[evN];
      if (ev.type === 'shot' && ev.shotType === 'jumper') { const pl = e.players[ev.player]; const d = Math.hypot(pl.pos.x - e.hoopFor(pl.team).x, pl.pos.y - e.hoopFor(pl.team).y); pend = d < 3.5 ? 'mi-dist <3,5 m' : d < 5 ? 'mi-dist 3,5-5 m' : 'mi-dist >5 m'; }
      else if (pend && (ev.type === 'made' || ev.type === 'miss')) { const q = (band[pend] ??= [0, 0]); q[1]++; if (ev.type === 'made') q[0]++; pend = null; }
      else if (ev.type === 'shot') pend = null;
    }
    const h = e.holder();
    if (h && h.idx !== lastHolder) { lastHolder = h.idx; if (h.anim === 'post' || (h.role === 'post')) postTouch++; }
  }
  let pending: string | null = null;
  for (const ev of e.events) {
    if (ev.type === 'shot') pending = ev.shotType ?? 'jumper';
    else if (pending && (ev.type === 'made' || ev.type === 'miss')) { const s = (sh[pending] ??= [0, 0]); s[1]++; if (ev.type === 'made') s[0]++; pending = null; }
  }
  for (const p of e.players) { const b = p.box; pts += b.pts; fga += b.fga; fgm += b.fgm; tpa += b.tpa; fta += b.fta; ast += b.ast; tov += b.tov; orb += b.orb; if (p.data.pos === 'C' || p.data.pos === 'PF') { bigPts += b.pts; bigFga += b.fga; } }
}
const t = (v: number) => (v / N / 2).toFixed(1);
console.log('par équipe : pts', t(pts), 'tirs', t(fga), (fgm / fga * 100).toFixed(1) + '%', '3pts tentés', t(tpa), '(' + (tpa / fga * 100).toFixed(0) + '% des tirs)', 'LF', t(fta), 'pd', t(ast), 'bp', t(tov), 'reb off', t(orb));
console.log('passes/équipe', t(passes), 'possessions/équipe', t(poss), 'passes par possession', (passes / poss).toFixed(2));
console.log('intérieurs (PF+C) : part des tirs', (bigFga / fga * 100).toFixed(0) + '%', 'part des points', (bigPts / pts * 100).toFixed(0) + '%', 'ballons reçus au poste/équipe', t(postTouch));
console.log('types de tir (réussis/tentés par équipe)', Object.fromEntries(Object.entries(sh).map(([k, [m, a]]) => [k, `${t(m)}/${t(a)} ${(m / a * 100).toFixed(0)}%`])));
console.log('mi-distance par zone', Object.fromEntries(Object.entries(band).map(([k, [m, a]]) => [k, `${t(m)}/${t(a)} ${(m / a * 100).toFixed(0)}%`])));
console.log('origine des passes/équipe', Object.fromEntries(Object.entries(site).map(([k, v]) => [k, t(v)])));
