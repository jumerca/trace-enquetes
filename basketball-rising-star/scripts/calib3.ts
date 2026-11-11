import { Court } from '../src/sim/court';
import { FIBA } from '../src/sim/rules';
import { launchVelocity, stepBall } from '../src/sim/physics';
import { Rng } from '../src/core/rng';
import type { Ball } from '../src/sim/types';
const court = new Court(FIBA.court);
const rng = new Rng(3);
function trial(dist: number, sigma: number, apexAdd: number, rz: number) {
  const hoop = court.hoop(1);
  const ang = rng.range(-1.3, 1.3);
  const s = { x: hoop.x - Math.cos(ang) * dist, y: hoop.y + Math.sin(ang) * dist, z: rz };
  const dirx = (hoop.x - s.x) / dist, diry = (hoop.y - s.y) / dist;
  const e1 = rng.normal(0, sigma) + 0.03, e2 = rng.normal(0, sigma * 0.6);
  const t = { x: hoop.x + dirx * e1 - diry * e2, y: hoop.y + diry * e1 + dirx * e2, z: 3.05 };
  const v = launchVelocity(s, t, 3.05 + apexAdd);
  const b: Ball = { state: 'air', holder: -1, x: s.x, y: s.y, z: s.z, vx: v.vx, vy: v.vy, vz: v.vz, flight: null, lastTouch: 0, lastTeam: 0, dribblePhase: 0, dribbling: false, airT: 0, spin: 0 };
  for (let i = 0; i < 400; i++) { const r = stepBall(b, court, 1 / 60); if (r.scored) return 1; if (b.z < 2.8 && b.vz < 0) return 0; }
  return 0;
}
for (const [d, apex, rz] of [[1.2, 0.45, 2.95], [1.8, 0.45, 2.95], [1.8, 0.7, 2.95], [3.5, 1.5, 2.6], [4.5, 1.4, 2.55], [7, 1.67, 2.55], [4.2, 1.3, 2.3]]) {
  const row: string[] = [];
  for (const sigma of [0.02, 0.05, 0.08, 0.11, 0.14, 0.18, 0.22, 0.27, 0.33, 0.4, 0.5]) {
    let m = 0; const N = 1500; for (let i = 0; i < N; i++) m += trial(d, sigma, apex, rz); row.push((m / N).toFixed(2));
  }
  console.log(d, apex, rz, row.join(', '));
}
