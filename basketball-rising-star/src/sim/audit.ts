import { dist } from '../core/vec';
import { MatchEngine } from './engine';
import { shotProbability } from './shooting';
import type { MPlayer } from './types';

/**
 * Audit de l'intelligence de jeu : observe un match complet et compte les comportements anormaux.
 * Sert d'outil de diagnostic (scripts/audit.ts) et de garde-fou dans les tests.
 */
export interface AuditReport {
  games: number;
  possessions: number;
  /** Contre-attaque : partenaire seul devant (≥3 m d'avance, défenseur à ≥3 m) et le porteur dribble plus de 1,5 s */
  missedBreakPass: number;
  /** Porteur qui garde le ballon plus de 7 s sans passer ni tirer (attaque bloquée) */
  holdTooLong: number;
  /** Porteur dans la raquette plus de 2,5 s */
  holderInKey: number;
  /** Trois attaquants ou plus à moins de 2 m les uns des autres (pas d'espacement), en attaque placée, par minute */
  clusterSec: number;
  /** Tirs à faible probabilité (<24 %) pris avec plus de 12 s au chrono */
  badEarlyShots: number;
  /** Tirs à 3 points complètement ouverts (aucun défenseur à moins de 3,5 m) */
  wideOpenThrees: number;
  /** Porteur non défendu (personne à moins de 3 m) en attaque placée, secondes */
  unguardedHandlerSec: number;
  /** Joueur immobile (vitesse < 0,2 m/s) plus de 6 s pendant le jeu */
  frozen: number;
  /** Passes non attrapées par le destinataire (ballon libre) */
  lostPasses: number;
  passes: number;
  violations: Record<string, number>;
  shots: number;
  threes: number;
  fastBreakPoints: number;
  points: number;
}

export function emptyReport(): AuditReport {
  return { games: 0, possessions: 0, missedBreakPass: 0, holdTooLong: 0, holderInKey: 0, clusterSec: 0, badEarlyShots: 0, wideOpenThrees: 0, unguardedHandlerSec: 0, frozen: 0, lostPasses: 0, passes: 0, violations: {}, shots: 0, threes: 0, fastBreakPoints: 0, points: 0 };
}

export function auditMatch(e: MatchEngine, r: AuditReport): void {
  const dt = 1 / 60;
  let breakT = 0;
  let holdT = 0;
  let lastHolder = -1;
  let keyT = 0;
  const still = new Map<number, number>();
  const flagged = new Set<string>();
  // Instrumentation des tirs et des passes
  const origRelease = e.releaseShot.bind(e);
  e.releaseShot = (p: MPlayer) => {
    if (e.ball.holder === p.idx) {
      const side = e.attackSide(p.team);
      const hoop = e.court.hoop(side);
      const d = dist(p.pos, hoop);
      const three = e.court.isThree(side, p.pos);
      const near = e.nearestDefender(p).d;
      const prob = shotProbability(p.data, { type: three ? 'three' : d < 2.6 ? 'layup' : 'jumper', dist: d, contest: Math.max(0, Math.min(1, (2.4 - near) / 2)), offDribble: true, energy: p.energy, hotness: p.hotness, clutch: 0, heightAdv: 0, confidence: 50 });
      r.shots++;
      if (three) r.threes++;
      if (three && near > 3.5) r.wideOpenThrees++;
      if (prob < 0.24 && e.shotClock > 12 && e.clock > 14) r.badEarlyShots++;
    }
    origRelease(p);
  };
  const origPass = e.launchPass.bind(e);
  e.launchPass = (from, to, kind) => {
    if (kind !== 'tip' && kind !== 'inbound') r.passes++;
    origPass(from, to, kind);
  };
  let prevPassTo = -1;
  while (!e.finished) {
    const before = e.ball.flight?.kind === 'pass' ? e.ball.flight.to : -1;
    e.step();
    // Passe ratée : le ballon devient libre pendant le vol sans interception
    if (before >= 0 && e.ball.state === 'loose' && prevPassTo === before) r.lostPasses++;
    prevPassTo = e.ball.flight?.kind === 'pass' ? e.ball.flight.to : -1;
    if (e.phase !== 'live') continue;
    const h = e.holder();
    if (!h) {
      breakT = 0;
      holdT = 0;
      keyT = 0;
      continue;
    }
    const side = e.attackSide(h.team);
    const hoop = e.court.hoop(side);
    const st = e.offense[h.team];
    if (h.idx !== lastHolder) {
      holdT = 0;
      breakT = 0;
      keyT = 0;
      lastHolder = h.idx;
    }
    holdT += dt;
    if (holdT > 7 && !flagged.has(`hold${e.time | 0}${h.idx}`)) {
      r.holdTooLong++;
      flagged.add(`hold${e.time | 0}${h.idx}`);
      holdT = -999;
    }
    if (e.court.inKey(side, h.pos)) keyT += dt;
    else keyT = 0;
    if (keyT > 2.5) {
      r.holderInKey++;
      keyT = -999;
    }
    // Contre-attaque ratée
    const dH = dist(h.pos, hoop);
    const freeAhead = e.teamOnCourt(h.team).some((m) => m !== h && dH - dist(m.pos, hoop) > 3 && dist(m.pos, hoop) < 6 && e.nearestDefender(m).d > 3 && e.bestPass(h, m).risk < 0.3);
    breakT = freeAhead ? breakT + dt : 0;
    if (breakT > 1.5) {
      r.missedBreakPass++;
      breakT = -999;
    }
    // Attaque placée : espacement et défense sur le porteur
    if (e.frontcourtReached && !st.transition) {
      const offs = e.teamOnCourt(h.team);
      for (const a of offs) {
        const close = offs.filter((b) => b !== a && dist(a.pos, b.pos) < 2).length;
        if (close >= 2) {
          r.clusterSec += dt;
          break;
        }
      }
      if (e.nearestDefender(h).d > 3 && dH < 9) r.unguardedHandlerSec += dt;
    }
    for (const p of e.onCourt) {
      const v = Math.hypot(p.vel.x, p.vel.y);
      const t = v < 0.2 && p.idx !== h.idx ? (still.get(p.idx) ?? 0) + dt : 0;
      still.set(p.idx, t);
      if (t > 6) {
        r.frozen++;
        still.set(p.idx, -999);
      }
    }
  }
  for (const ev of e.events) {
    if (ev.type === 'violation') {
      const k = ev.text.split(' (')[0];
      r.violations[k] = (r.violations[k] ?? 0) + 1;
    }
  }
  r.possessions += e.startedPossessions;
  r.points += e.teams[0].score + e.teams[1].score;
  r.games++;
}

export function perGame(r: AuditReport): Record<string, number> {
  const g = Math.max(1, r.games);
  return {
    points: r.points / g / 2,
    missedBreakPass: r.missedBreakPass / g,
    holdTooLong: r.holdTooLong / g,
    holderInKey: r.holderInKey / g,
    clusterMin: r.clusterSec / g / 60,
    badEarlyShots: r.badEarlyShots / g,
    wideOpenThrees: r.wideOpenThrees / g,
    unguardedHandlerMin: r.unguardedHandlerSec / g / 60,
    frozen: r.frozen / g,
    lostPassPct: (r.lostPasses / Math.max(1, r.passes)) * 100,
    threeRate: (r.threes / Math.max(1, r.shots)) * 100,
    passesPerTeam: r.passes / g / 2,
  };
}
