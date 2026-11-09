import type { Court } from './court';
import type { Ball } from './types';

export const G = 9.81;
export const BALL_R = 0.12;
const RIM_TUBE = 0.01;
const RIM_RESTITUTION = 0.36;
const BOARD_RESTITUTION = 0.5;
const FLOOR_RESTITUTION = 0.74;

export interface PhysicsResult {
  rimHit: boolean;
  boardHit: boolean;
  scored: boolean;
  floorHit: boolean;
  side: 1 | -1 | 0;
}

/**
 * Calcule la vitesse initiale pour qu'une balle lancée de `s` passe par `t` en culminant à `apex`.
 */
export function launchVelocity(
  s: { x: number; y: number; z: number },
  t: { x: number; y: number; z: number },
  apex: number,
): { vx: number; vy: number; vz: number; T: number } {
  const top = Math.max(apex, s.z + 0.05, t.z + 0.05);
  const vz = Math.sqrt(2 * G * (top - s.z));
  const tUp = vz / G;
  const tDown = Math.sqrt((2 * (top - t.z)) / G);
  const T = tUp + tDown;
  return { vx: (t.x - s.x) / T, vy: (t.y - s.y) / T, vz, T };
}

/** Intègre le ballon libre (en l'air ou au sol) avec collisions anneau / planche / sol. */
export function stepBall(ball: Ball, court: Court, dt: number): PhysicsResult {
  const res: PhysicsResult = { rimHit: false, boardHit: false, scored: false, floorHit: false, side: 0 };
  const sub = 4;
  const h = dt / sub;
  const g = court.g;
  for (let i = 0; i < sub; i++) {
    const pz = ball.z;
    ball.vz -= G * h;
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    ball.z += ball.vz * h;

    for (const side of [1, -1] as const) {
      const hoop = court.hoop(side);
      const dxh = ball.x - hoop.x;
      if (Math.abs(dxh) > 1.2) continue;
      // Planche
      const bx = court.boardX(side);
      const behind = side === 1 ? ball.x + BALL_R > bx : ball.x - BALL_R < bx;
      if (behind && Math.abs(ball.y - hoop.y) < g.boardHalfWidth && ball.z > g.boardBottom - BALL_R && ball.z < g.boardTop + 0.02) {
        if ((side === 1 && ball.vx > 0) || (side === -1 && ball.vx < 0)) {
          ball.vx = -ball.vx * BOARD_RESTITUTION;
          ball.vy *= 0.9;
          ball.vz *= 0.9;
          res.boardHit = true;
          res.side = side;
        }
        ball.x = side === 1 ? bx - BALL_R : bx + BALL_R;
      }
      // Anneau (tore)
      const dx = ball.x - hoop.x;
      const dy = ball.y - hoop.y;
      const dh = Math.hypot(dx, dy);
      if (Math.abs(ball.z - g.rimHeight) < 0.3 && dh < g.rimRadius + 0.3) {
        const nx0 = dh > 1e-6 ? dx / dh : 1;
        const ny0 = dh > 1e-6 ? dy / dh : 0;
        const qx = hoop.x + nx0 * g.rimRadius;
        const qy = hoop.y + ny0 * g.rimRadius;
        const ex = ball.x - qx;
        const ey = ball.y - qy;
        const ez = ball.z - g.rimHeight;
        const d = Math.hypot(ex, ey, ez);
        const minD = BALL_R + RIM_TUBE;
        if (d < minD && d > 1e-6) {
          const nx = ex / d;
          const ny = ey / d;
          const nz = ez / d;
          const vn = ball.vx * nx + ball.vy * ny + ball.vz * nz;
          if (vn < 0) {
            ball.vx -= (1 + RIM_RESTITUTION) * vn * nx;
            ball.vy -= (1 + RIM_RESTITUTION) * vn * ny;
            ball.vz -= (1 + RIM_RESTITUTION) * vn * nz;
            // Frottement anneau / effet : l'énergie tangentielle est fortement absorbée
            ball.vx *= 0.7;
            ball.vy *= 0.7;
            const hs = Math.hypot(ball.vx, ball.vy);
            if (hs > 3.6) {
              ball.vx *= 3.6 / hs;
              ball.vy *= 3.6 / hs;
            }
            res.rimHit = true;
            res.side = side;
          }
          ball.x = qx + nx * minD;
          ball.y = qy + ny * minD;
          ball.z = g.rimHeight + nz * minD;
        }
        // Panier : traversée du plan de l'anneau vers le bas, à l'intérieur du cercle
        if (pz >= g.rimHeight && ball.z < g.rimHeight && ball.vz < 0 && Math.hypot(ball.x - hoop.x, ball.y - hoop.y) < g.rimRadius - 0.02) {
          res.scored = true;
          res.side = side;
          // Le filet freine le ballon
          ball.vx *= 0.25;
          ball.vy *= 0.25;
          ball.vz *= 0.45;
        }
      }
    }
    // Sol
    if (ball.z < BALL_R) {
      ball.z = BALL_R;
      if (ball.vz < 0) {
        ball.vz = -ball.vz * FLOOR_RESTITUTION;
        if (ball.vz < 0.6) ball.vz = 0;
        ball.vx *= 0.86;
        ball.vy *= 0.86;
        res.floorHit = true;
      }
    }
  }
  // Roulement : frottement au sol
  if (ball.z <= BALL_R + 0.02 && Math.abs(ball.vz) < 0.7) {
    const k = Math.max(0, 1 - 1.6 * dt);
    ball.vx *= k;
    ball.vy *= k;
  }
  ball.spin += dt * 10;
  return res;
}
