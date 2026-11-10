import { MatchEngine } from '../src/sim/engine';
import { FIBA } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
const e = new MatchEngine({ home: quickTeam(+process.argv[2], 'A'), away: quickTeam(+process.argv[2] + 190, 'B'), rules: FIBA, seed: 1000 + +process.argv[2] });
let n = 0;
const orig = e.violation.bind(e);
e.violation = (team, label, p) => {
  if (label === 'Retour en zone' && n++ < 5) {
    const evs = e.events.slice(-6).map((x) => `${x.type}:${x.text}`);
    console.log('---', p?.intent, 'pos', p?.pos.x.toFixed(1), 'side', e.attackSide(team), 'fcr', e.frontcourtReached, 'lastTeam', e.ball.lastTeam, 'phase', e.phase, 'pickupT', p?.pickupT.toFixed(2));
    console.log(evs.join('\n'));
  }
  orig(team, label, p);
};
e.runToEnd();
