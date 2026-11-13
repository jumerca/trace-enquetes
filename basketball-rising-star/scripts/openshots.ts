import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
import { shotEV } from '../src/sim/ai/offense';
// Tir ouvert refusé : le porteur a eu un bon tir sans défenseur à moins de 3 m pendant au moins 0,5 s, et ne l'a pas pris.
const N = Number(process.argv[2] ?? 6);
let open = 0, taken = 0, refused = 0;
const kinds: Record<string, number> = {};
const whys: Record<string, number> = {};
for (let g = 0; g < N; g++) {
  const reg = new NameRegistry();
  const e = new MatchEngine({ home: quickTeam(700 + g, 'A', 12, undefined, reg), away: quickTeam(900 + g, 'B', 12, ['#F36B32', '#101827'], reg), rules: FIBA, seed: 9000 + g });
  let cur = -1, openT = 0, flagged = false, three = false, why = '';
  const close = (shot: boolean) => { if (flagged) { open++; if (shot) taken++; else { refused++; whys[why] = (whys[why] ?? 0) + 1; kinds[three ? '3 points' : '2 points'] = (kinds[three ? '3 points' : '2 points'] ?? 0) + 1; } } flagged = false; openT = 0; };
  while (!e.finished) {
    e.step();
    const h = e.holder();
    if (!h || e.phase !== 'live') { if (cur >= 0) { const sh = e.ball.flight?.kind === 'shot' && e.ball.flight.from === cur; close(!!sh); cur = -1; } continue; }
    if (h.idx !== cur) { if (cur >= 0) close(false); cur = h.idx; }
    const shooting = h.anim === 'shoot' || h.anim === 'layup' || h.anim === 'dunk';
    if (shooting) continue;
    const side = e.attackSide(h.team);
    const ev = shotEV(e, h, h.pos, h.pickupT > 0.9);
    const hp = e.hoopFor(h.team); const dh = Math.hypot(h.pos.x - hp.x, h.pos.y - hp.y);
    const ok = e.frontcourtReached && e.nearestDefender(h).d > 3 && ev >= (e.court.isThree(side, h.pos) || dh < 3 ? 1.08 : 1.15) && e.clock > 3;
    openT = ok ? openT + 1 / 60 : 0;
    if (openT > 0.5 && !flagged) { flagged = true; three = e.court.isThree(side, h.pos); why = `${h.intent || '-'} | lock ${h.actionLock > 0 ? 'oui' : 'non'} | pickup ${h.pickupT < 0.6 ? '<0.6' : '>0.6'} | ${e.offense[h.team].transition ? 'transition' : 'placé'} | chrono ${e.clock < 26 ? 'fin de quart' : 'normal'} | ${(h as any).pickedUp ? 'dribble arrêté' : 'dribble'} v=${Math.hypot(h.vel.x, h.vel.y) > 2 ? 'court' : 'lent'}`; }
  }
}
console.log(`tirs ouverts par match: ${(open / N).toFixed(1)}  pris: ${(taken / N).toFixed(1)}  refusés: ${(refused / N).toFixed(1)} (${((refused / Math.max(1, open)) * 100).toFixed(0)} %)`, kinds);

console.log(Object.entries(whys).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${v}  ${k}`).join('\n'));
