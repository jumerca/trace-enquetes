import { Court } from '../src/sim/court';
import { FIBA } from '../src/sim/rules';
import { launchVelocity, stepBall } from '../src/sim/physics';
import { Rng } from '../src/core/rng';
import type { Ball } from '../src/sim/types';
const court = new Court(FIBA.court);
const rng = new Rng(1);
function trial(dist: number, sigma: number, arc: number, releaseZ: number) {
  const hoop = court.hoop(1);
  const ang = rng.range(-1.2, 1.2);
  const s = { x: hoop.x - Math.cos(ang) * dist, y: hoop.y + Math.sin(ang) * dist, z: releaseZ };
  const dirx = (hoop.x - s.x) / dist, diry = (hoop.y - s.y) / dist;
  const e1 = rng.normal(0, sigma), e2 = rng.normal(0, sigma * 0.6);
  const aim = 0.03; // léger vers l'arrière de l'anneau
  const t = { x: hoop.x + dirx * (e1 + aim) - diry * e2, y: hoop.y + diry * (e1 + aim) + dirx * e2, z: 3.05 };
  const v = launchVelocity(s, t, Math.max(3.05, releaseZ) + arc);
  const b: Ball = { state: 'air', holder: -1, x: s.x, y: s.y, z: s.z, vx: v.vx, vy: v.vy, vz: v.vz, flight: null, lastTouch: 0, lastTeam: 0, dribblePhase: 0, dribbling: false, airT: 0, spin: 0 };
  for (let i = 0; i < 400; i++) {
    const r = stepBall(b, court, 1 / 60);
    if (r.scored) return 1;
    if (b.z < 2.0 && i > 20) return 0;
  }
  return 0;
}
const args = process.argv.slice(2);
for (const [dist, arc, rz] of [[1.2, 0.5, 2.9], [4.5, 1.2, 2.5], [7, 1.5, 2.5]]) {
  const row: string[] = [];
  for (const sigma of [0.02, 0.05, 0.08, 0.11, 0.14, 0.18, 0.22, 0.27, 0.33, 0.4, 0.5]) {
    let m = 0; const N = 1500;
    for (let i = 0; i < N; i++) m += trial(dist, sigma, arc, rz);
    row.push(`${sigma}:${(m / N).toFixed(2)}`);
  }
  console.log(dist, row.join(' '));
}
