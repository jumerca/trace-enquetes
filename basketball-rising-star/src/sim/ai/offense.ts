import { clamp, dist, norm, type V2 } from '../../core/vec';
import type { MatchEngine } from '../engine';
import { stepBall } from '../physics';
import { shotProbability } from '../shooting';
import type { MPlayer, ShotType } from '../types';

export interface OffenseState {
  spots: Record<number, V2>;
  pnr: { handler: number; screener: number; t: number; pop: boolean; set?: boolean; screenPos?: V2 } | null;
  transition: boolean;
  startT: number;
  passes: number;
  cutter: number;
  cutT: number;
}

export const setupOffense = (): OffenseState => ({ spots: {}, pnr: null, transition: false, startT: 0, passes: 0, cutter: -1, cutT: 0 });

/** Prédiction de la position du ballon (rebond) quand il redescend à hauteur de prise. */
export function predictBall(e: MatchEngine, maxT = 1.2): V2 {
  const f = e.ball.flight;
  if (e.ball.state === 'air' && f && f.kind === 'shot' && !f.touchedRim && f.side) {
    // Avant le contact avec l'anneau, on ne connaît pas l'issue : zone de rebond probable
    const hoop = e.court.hoop(f.side);
    const dir = norm({ x: f.start.x - hoop.x, y: f.start.y - hoop.y });
    const long = f.shotType === 'three' ? 2.6 : f.shotType === 'jumper' ? 2.0 : 1.4;
    return e.court.clampInside({ x: hoop.x + dir.x * long, y: hoop.y + dir.y * long }, 0.3);
  }
  const b = { ...e.ball };
  const dt = 1 / 30;
  if (b.z < 2.7) {
    // Ballon déjà à hauteur : on vise sa position un peu plus loin (interception de trajectoire)
    return e.court.clampInside({ x: b.x + b.vx * 0.4, y: b.y + b.vy * 0.4 }, 0.2);
  }
  for (let t = 0; t < maxT; t += dt) {
    stepBall(b, e.court, dt);
    if (b.z < 2.7 && b.vz < 0) break;
  }
  return e.court.clampInside({ x: b.x, y: b.y }, 0.2);
}

/** Contestation estimée si le joueur tirait maintenant. */
export function estimateContest(e: MatchEngine, p: MPlayer, at: V2 = p.pos): { contest: number; heightAdv: number } {
  const hoop = e.hoopFor(p.team);
  const d = dist(at, hoop);
  let contest = 0;
  let heightAdv = 0;
  for (const o of e.teamOnCourt((1 - p.team) as 0 | 1)) {
    const od = dist(o.pos, at);
    if (od > 3.2) continue;
    const front = dist(o.pos, hoop) < d + 0.8;
    // Un défenseur qui arrive vite contestera davantage au moment du tir
    const closing = Math.max(0, ((at.x - o.pos.x) * o.vel.x + (at.y - o.pos.y) * o.vel.y) / Math.max(0.3, od));
    const eff = Math.max(0, od - closing * 0.35);
    const c = clamp((2.4 - eff) / 2.0, 0, 1) * (front ? 0.95 : 0.35) * (0.75 + o.data.attrs.perimeterD / 80);
    if (c > contest) {
      contest = c;
      heightAdv = p.heightM - o.heightM;
    }
  }
  return { contest: clamp(contest, 0, 1), heightAdv };
}

export function guessShotType(e: MatchEngine, p: MPlayer, at: V2 = p.pos): { type: ShotType; d: number; pts: number } {
  const side = e.attackSide(p.team);
  const d = dist(at, e.court.hoop(side));
  let type: ShotType;
  if (d < 1.9 && p.data.attrs.dunk >= 10 && p.heightM + p.data.attrs.vertical / 25 > 2.5) type = 'dunk';
  else if (d < 2.6) type = 'layup';
  else if (d < 3.6 && p.role === 'post') type = 'hook';
  else if (e.court.isThree(side, at)) type = 'three';
  else type = 'jumper';
  return { type, d, pts: type === 'three' ? 3 : 2 };
}

/** Valeur attendue (points) d'un tir à cette position, avec la contestation actuelle. */
export function shotEV(e: MatchEngine, p: MPlayer, at: V2 = p.pos, offDribble = true): number {
  const { type, d, pts } = guessShotType(e, p, at);
  if (d > e.court.g.threeRadius + 2.2) return 0;
  const { contest, heightAdv } = estimateContest(e, p, at);
  const prob = shotProbability(p.data, {
    type,
    dist: d,
    contest,
    offDribble,
    energy: p.energy,
    hotness: p.hotness,
    clutch: e.clutch(),
    heightAdv,
    confidence: p.data.confidence,
  });
  return prob * pts;
}

function gumbel(e: MatchEngine): number {
  return -Math.log(-Math.log(Math.max(1e-6, e.rng.next())));
}

export function offenseThink(e: MatchEngine, p: MPlayer, userControlled: boolean): void {
  const b = e.ball;
  const st = e.offense[p.team];
  if (userControlled) return;
  // Rebond / ballon libre
  if (b.state === 'loose' || (b.state === 'air' && b.flight && (b.flight.kind === 'shot' || b.flight.kind === 'block'))) {
    reboundBehaviour(e, p, true);
    return;
  }
  if (b.state === 'air' && b.flight?.kind === 'pass' && b.flight.to === p.idx) return;
  if (e.ball.holder === p.idx && b.state === 'held') {
    handlerThink(e, p);
    return;
  }
  offBallThink(e, p, st);
}

function reboundBehaviour(e: MatchEngine, p: MPlayer, offense: boolean): void {
  const b = e.ball;
  const pred = predictBall(e);
  const dBall = dist(p.pos, pred);
  const mates = e.teamOnCourt(p.team).sort((a, c) => dist(a.pos, pred) - dist(c.pos, pred));
  const rank = mates.indexOf(p);
  const shotInAir = b.state === 'air' && b.flight?.kind === 'shot';
  if (offense) {
    if (p.role === 'crash' || (rank === 0 && dBall < 3.5) || (b.state === 'loose' && !e.lastShot && rank <= 1)) {
      p.target = pred;
      p.urgency = 1;
      p.intent = 'rebond offensif';
    } else {
      // Repli défensif (équilibre)
      const own = e.ownHoop(p.team);
      const mid = e.court.g.length / 2;
      p.target = { x: mid + (own.x - mid) * 0.15, y: e.court.cy + (p.slot - 2) * 2.5 };
      p.urgency = 0.75;
      p.intent = 'repli';
    }
  } else {
    // Box-out tant que le ballon est haut, puis attaque du ballon
    const man = p.assign >= 0 ? e.players[p.assign] : null;
    const own = e.ownHoop(p.team);
    if (shotInAir && man && dist(man.pos, own) < 6.5 && b.z > 3.3) {
      const dir = norm({ x: own.x - man.pos.x, y: own.y - man.pos.y });
      p.target = { x: man.pos.x + dir.x * 0.65, y: man.pos.y + dir.y * 0.65 };
      p.urgency = 0.9;
      p.intent = 'box-out';
    } else if (rank <= 1 || dBall < 3) {
      p.target = pred;
      p.urgency = 1;
      p.intent = 'rebond';
    } else {
      p.target = { x: pred.x + (p.pos.x - pred.x) * 0.5, y: pred.y + (p.pos.y - pred.y) * 0.5 };
      p.urgency = 0.6;
    }
  }
  // Saut au rebond quand le ballon arrive à portée
  const bd = Math.hypot(p.pos.x - b.x, p.pos.y - b.y);
  if (bd < 1.2 && b.z > 2.2 && b.z < p.heightM * 1.33 + 0.9 && b.vz < 0 && p.z === 0 && p.jumpCd <= 0) {
    p.vz = 2.4 + (p.data.attrs.vertical / 20) * 1.4;
    p.anim = 'rebound';
    p.animT = 0;
    p.jumpCd = 1.0;
  }
}

function handlerThink(e: MatchEngine, p: MPlayer): void {
  const st = e.offense[p.team];
  const ext = p as MPlayer & { shotPlan?: unknown };
  if (ext.shotPlan || p.actionLock > 0) return;
  const side = e.attackSide(p.team);
  const hoop = e.court.hoop(side);
  const a = p.data.attrs;
  const d = dist(p.pos, hoop);
  p.role = 'handler';
  const reaction = 0.18 + (20 - a.iq) * 0.012;
  if (p.pickupT < reaction) {
    p.target = { ...p.pos };
    return;
  }
  const inFront = e.court.inFrontcourt(side, p.pos);
  const shotClockLeft = Math.min(e.shotClock, e.clock);
  const gameClockLimited = e.clock < e.shotClock + 0.5;
  // Situations de fin de période
  const diff = e.scoreDiff(p.team);
  const lastPoss = gameClockLimited && e.clock < 24;
  const holdForLast = lastPoss && e.clock > 6 && (diff >= 0 || e.quarter < 4 || e.clock > 10) && diff <= 3;
  const milk = e.quarter >= 4 && e.clock < 150 && diff > 0 && e.shotClock > 7;
  const urgency = clamp((6 - shotClockLeft) / 6, 0, 1);
  const needThree = e.quarter >= 4 && diff < 0 && diff >= -3 && e.clock < 12;

  // Remontée du ballon
  if (!inFront) {
    const defBack = e.teamOnCourt((1 - p.team) as 0 | 1).filter((o) => dist(o.pos, hoop) < dist(p.pos, hoop)).length;
    const offAhead = e.teamOnCourt(p.team).filter((o) => o !== p && dist(o.pos, hoop) < dist(p.pos, hoop) - 2).length;
    const fast = st.transition && offAhead >= defBack;
    // Passe longue vers un partenaire seul devant
    if (fast) {
      for (const m of e.teamOnCourt(p.team)) {
        if (m === p) continue;
        const md = dist(m.pos, hoop);
        if (md < 6 && e.nearestDefender(m).d > 3 && e.passRisk(p, m) < 0.2 && a.vision >= 9) {
          e.launchPass(p, m, dist(m.pos, p.pos) > 12 ? 'lob' : 'chest');
          return;
        }
      }
    }
    const top = e.court.fromHoop(side, e.court.g.threeRadius + 0.8, clamp(p.pos.y - e.court.cy, -3, 3));
    p.target = fast ? { x: hoop.x - side * 1.2, y: hoop.y } : top;
    p.urgency = fast ? 1 : 0.42 + e.teams[p.team].tactics.pace * 0.3 + (e.backcourtT > 5 ? 0.3 : 0);
    p.intent = fast ? 'contre-attaque' : 'remonte le ballon';
    if (fast) {
      p.intent = 'drive';
      (p as MPlayer & { driveT?: number }).driveT = e.time;
    }
    return;
  }
  if (st.transition && e.time - st.startT > 6) st.transition = false;
  // Avantage numérique réel : moins de 4 défenseurs repliés entre le ballon et le panier
  const defSet = e.teamOnCourt((1 - p.team) as 0 | 1).filter((o) => dist(o.pos, hoop) < d + 0.5).length;
  const advantage = st.transition && defSet <= 3;
  if (st.transition && !advantage && e.time - st.startT > 2.5) st.transition = false;

  // Lecture des options
  const temp = 0.03 + ((20 - a.iq) / 20) * 0.13;
  const visionNoise = ((20 - a.vision) / 20) * 0.45;
  type Opt = { kind: 'shoot' | 'drive' | 'pass' | 'hold' | 'pnr' | 'post'; v: number; to?: MPlayer };
  const opts: Opt[] = [];

  // 1) Tir
  const sEV = shotEV(e, p, p.pos, p.pickupT > 0.9);
  const { type } = guessShotType(e, p);
  // Valeur de la possession si l'on continue à jouer (diminue avec le chrono)
  const elapsed = e.time - st.startT;
  const early = clamp((e.shotClock - 7) / 12, 0, 1);
  let possValue = 1.02 + (advantage ? -0.05 : early * 0.75) - urgency * 0.9 + (elapsed < 3 && !st.transition ? 0.08 : 0) - e.teams[p.team].tactics.pace * 0.08;
  if (milk) possValue += 0.3;
  if (holdForLast && e.clock > 5) possValue += 1;
  const selfish = (a.ambition + a.shotCreation - a.teamwork) / 40;
  const usage = 1 + (a.shotCreation + a.three + a.finishing - 30) / 140;
  let shootV = sEV * usage + selfish * 0.1 + p.hotness * 0.06;
  if (needThree && type !== 'three') shootV -= 0.5;
  opts.push({ kind: 'shoot', v: shootV });

  // 2) Pénétration
  const own = p.assign;
  void own;
  const defs = e.teamOnCourt((1 - p.team) as 0 | 1);
  const toHoop = norm({ x: hoop.x - p.pos.x, y: hoop.y - p.pos.y });
  let laneBlock = 0;
  for (const o of defs) {
    const rx = o.pos.x - p.pos.x;
    const ry = o.pos.y - p.pos.y;
    const along = rx * toHoop.x + ry * toHoop.y;
    if (along < -0.2 || along > Math.min(d, 4.5)) continue;
    const lat = Math.abs(-rx * toHoop.y + ry * toHoop.x);
    const closing = Math.max(0, -(o.vel.x * toHoop.x + o.vel.y * toHoop.y));
    const block = clamp((1.4 - lat) / 1.4, 0, 1) * (o.slowT > 0 ? 0.3 : 1) * (closing > 2.5 ? 0.55 : 1);
    laneBlock += block * (1.2 - along / 6);
  }
  const helpers = defs.filter((o) => dist(o.pos, hoop) < 3.2).length;
  const finish = (a.layup + a.finishing + a.dunk * 0.5) / 50;
  const dribbleSkill = (a.dribble + a.ballControl) / 40;
  if (d > 2.2 && d < 11) {
    const v = (0.86 + finish * 0.62 + dribbleSkill * 0.3) * (1 - clamp(laneBlock, 0, 1.4) * 0.4) - helpers * 0.08 + (st.transition ? 0.25 : 0) + (possValue - 1) * 0.3;
    opts.push({ kind: 'drive', v });
  }
  const extD = p as MPlayer & { driveT?: number };
  if (p.intent === 'drive' && extD.driveT !== undefined && e.time - extD.driveT < 2.8) {
    // Pénétration engagée : finir, ressortir le ballon sur l'aide, ou s'arrêter en suspension
    if (d < 2.3) {
      e.beginShot(p);
      return;
    }
    if (laneBlock > 0.85) {
      let kick: MPlayer | null = null;
      let kv = 0.9;
      for (const m of e.teamOnCourt(p.team)) {
        if (m === p || m.keyTime > 2.2) continue;
        const open = e.nearestDefender(m).d + e.rng.normal(0, visionNoise);
        const v = shotEV(e, m, m.pos, false) * (0.85 + Math.min(open, 4) * 0.06) - e.passRisk(p, m) * 1.2;
        if (v > kv) {
          kv = v;
          kick = m;
        }
      }
      if (kick && e.rng.chance(0.35 + a.vision / 40)) {
        e.launchPass(p, kick, 'chest');
        st.passes++;
        p.intent = 'ressort';
        return;
      }
      if (d < 4.6 && a.finishing >= 9) {
        e.beginShot(p);
        return;
      }
      if (d < 6.5 && sEV > 0.75) {
        e.beginShot(p);
        return;
      }
    }
    return;
  }
  if (p.intent === 'drive') p.intent = '';

  // 3) Passes
  const called = e.userIdx >= 0 ? (e.players[e.userIdx] as MPlayer & { callT?: number }).callT : undefined;
  for (const m of e.teamOnCourt(p.team)) {
    if (m === p) continue;
    if (e.frontcourtReached && !e.court.inFrontcourt(side, m.pos)) continue;
    if (m.keyTime > 2.2) continue;
    const open = e.nearestDefender(m).d + e.rng.normal(0, visionNoise);
    const mEV = shotEV(e, m, m.pos, false);
    const risk = e.passRisk(p, m);
    const cutting = m.intent === 'coupe' || m.intent === 'roll';
    let v = (mEV * (0.85 + Math.min(open, 4) * 0.04) * 0.55 + possValue * 0.45) * (1 - risk) - risk * 1.2;
    if (cutting && open > 1.2) v += 0.25;
    if (m.role === 'post' && open > 0.6) v += (m.data.attrs.postPlay - 10) / 30;
    v += (a.teamwork + a.passing - 20) / 100;
    if (m.isUser && called !== undefined && e.time - called < 2) v += 0.35;
    if (holdForLast) v -= 0.3;
    opts.push({ kind: 'pass', v, to: m });
  }

  // 4) Pick-and-roll / tenir le ballon
  const tac = e.teams[p.team].tactics;
  if (!st.pnr && shotClockLeft > 9 && d > 5.5 && a.dribble >= 8) {
    opts.push({ kind: 'pnr', v: possValue * 0.9 + tac.pnrFreq * 0.2 + (a.vision - 10) / 80 - st.passes * 0.04 });
  }
  const hold = possValue - p.pickupT * 0.07;
  opts.push({ kind: 'hold', v: hold });

  // Cadence de décision : le porteur s'engage dans une lecture pendant un court instant,
  // sauf opportunité nette (tir ouvert, partenaire seul sous le cercle).
  const ext2 = p as MPlayer & { decideAt?: number };
  const committed = ext2.decideAt !== undefined && e.time < ext2.decideAt && p.intent !== 'drive';
  let best: Opt = opts[opts.length - 1];
  let bv = -99;
  for (const o of opts) {
    const margin = o.kind === 'hold' ? 0 : committed ? 0.3 : 0.05;
    const v = o.v + gumbel(e) * temp - margin;
    if (v > bv) {
      bv = v;
      best = o;
    }
  }
  if ((e as MatchEngine & { debug?: string[] }).debug) (e as MatchEngine & { debug?: string[] }).debug!.push(`${e.time.toFixed(1)} sc=${e.shotClock.toFixed(0)} ${e.name(p.idx)} ${committed ? 'C' : ''} -> ${best.kind} | ` + opts.map((o) => `${o.kind}${o.to ? ':' + o.to.data.lastName : ''}=${o.v.toFixed(2)}`).join(' '));
  if (best.kind === 'hold' && !committed) ext2.decideAt = e.time + 0.45 + e.rng.next() * 0.6 - e.teams[p.team].tactics.pace * 0.2;
  if (urgency >= 0.95 && best.kind !== 'shoot' && sEV > 0.15 && !holdForLast) best = { kind: 'shoot', v: 1 };
  if (holdForLast && e.clock <= 5.5 && best.kind === 'hold') best = sEV > 0.6 ? { kind: 'shoot', v: 1 } : { kind: 'drive', v: 1 };

  switch (best.kind) {
    case 'shoot':
      e.beginShot(p);
      return;
    case 'drive': {
      p.intent = 'drive';
      extD.driveT = e.time;
      const pnr = st.pnr && st.pnr.handler === p.idx && st.pnr.set ? st.pnr : null;
      let tgt: V2 = { x: hoop.x - toHoop.x * 0.9, y: hoop.y - toHoop.y * 0.9 };
      if (pnr && pnr.screenPos) {
        // Utiliser l'écran : passer à l'épaule du poseur
        const sp = pnr.screenPos;
        const away = norm({ x: sp.x - p.pos.x, y: sp.y - p.pos.y });
        tgt = { x: sp.x + away.x * 1.2 + toHoop.x * 2, y: sp.y + away.y * 1.2 + toHoop.y * 2 };
      } else {
        // Attaquer l'espace le moins défendu
        let bestSide = 0;
        let bestScore = 99;
        for (const s of [-1, 0, 1]) {
          const probe = { x: p.pos.x + toHoop.x * 2 - toHoop.y * s * 1.6, y: p.pos.y + toHoop.y * 2 + toHoop.x * s * 1.6 };
          const crowd = defs.reduce((acc, o) => acc + Math.max(0, 2.2 - dist(o.pos, probe)), 0);
          if (crowd < bestScore) {
            bestScore = crowd;
            bestSide = s;
          }
        }
        if (d > 4) tgt = { x: p.pos.x + toHoop.x * 3 - toHoop.y * bestSide * 1.4, y: p.pos.y + toHoop.y * 3 + toHoop.x * bestSide * 1.4 };
      }
      p.target = e.court.clampInside(tgt, 0.4);
      p.urgency = 1;
      // Faute volontaire, etc. non concernés ici
      return;
    }
    case 'pass':
      if (best.to) {
        e.launchPass(p, best.to, e.passRisk(p, best.to) > 0.35 && p.data.attrs.passing >= 11 ? 'lob' : 'chest');
        st.passes++;
      }
      return;
    case 'pnr': {
      const mates = e.teamOnCourt(p.team).filter((m) => m !== p && !(m.isUser && !e.userAutoActive()));
      if (!mates.length) return;
      const screener = mates.sort((x, y) => y.heightM + y.data.attrs.screenUse / 20 - (x.heightM + x.data.attrs.screenUse / 20))[0];
      st.pnr = { handler: p.idx, screener: screener.idx, t: e.time, pop: screener.data.attrs.three >= 12 && e.rng.chance(0.25 + screener.data.attrs.three / 40) };
      e.emit({ type: 'info', team: p.team, player: p.idx, text: `${e.name(p.idx)} appelle le pick-and-${st.pnr.pop ? 'pop' : 'roll'} avec ${e.name(screener.idx)}` });
      p.target = { ...p.pos };
      p.intent = 'attend l’écran';
      return;
    }
    default: {
      // Dribble de sondage : déplacer la défense, chercher un angle
      p.intent = holdForLast ? 'gère le chrono' : 'temporise';
      const lat = e.rng.normal(0, 1.8);
      const base = st.spots[p.idx] ?? e.court.fromHoop(side, e.court.g.threeRadius + 0.6, 0);
      p.target = e.court.clampInside({ x: base.x - toHoop.x * 0.2, y: base.y + lat }, 0.6);
      if (!e.court.inFrontcourt(side, p.target)) p.target = e.court.fromHoop(side, e.court.g.threeRadius + 0.5, 0);
      p.urgency = 0.45;
    }
  }
}

function offBallThink(e: MatchEngine, p: MPlayer, st: OffenseState): void {
  const side = e.attackSide(p.team);
  const hoop = e.court.hoop(side);
  const a = p.data.attrs;
  const h = e.holder();
  const spot = st.spots[p.idx] ?? p.spot ?? e.court.fromHoop(side, 5, 0);
  // Règle des 3 secondes : sortir de la raquette (les joueurs disciplinés y pensent plus tôt)
  if (p.keyTime > 0.9 + (p.data.attrs.discipline < 7 ? 0.7 : 0)) {
    p.target = e.court.fromHoop(side, 2.4, p.pos.y < e.court.cy ? -3.4 : 3.4);
    p.urgency = 0.9;
    p.intent = 'sort de la raquette';
    p.screenT = 0;
    return;
  }
  if (p.actionLock > 0 && p.intent === 'coupe') return;

  // Pick-and-roll : poseur d'écran
  if (st.pnr && st.pnr.screener === p.idx && h && h.idx === st.pnr.handler) {
    const pnr = st.pnr;
    const hd = e.players.find((o) => o.onCourt && o.team !== p.team && o.assign === h.idx);
    const age = e.time - pnr.t;
    if (!pnr.set) {
      const ref = hd ? hd.pos : h.pos;
      const toH = norm({ x: hoop.x - h.pos.x, y: hoop.y - h.pos.y });
      const middle = h.pos.y < e.court.cy ? 1 : -1;
      const sp = { x: ref.x - toH.y * middle * 0.55 * -1 + toH.x * 0.1, y: ref.y + toH.x * middle * 0.55 * -1 + toH.y * 0.1 };
      p.target = sp;
      p.urgency = 0.9;
      p.intent = 'pose un écran';
      if (dist(p.pos, sp) < 0.6 || age > 3.2) {
        pnr.set = true;
        pnr.screenPos = { ...p.pos };
        p.screenT = 0.9 + a.screenUse / 40;
        p.anim = 'screen';
        p.animT = 0;
        // Le porteur attaque
        h.intent = 'drive';
        (h as MPlayer & { driveT?: number }).driveT = e.time;
        h.thinkT = 0.05;
      }
      return;
    }
    if (p.screenT <= 0) {
      if (pnr.pop) {
        const pop = e.court.fromHoop(side, e.court.g.threeRadius + 0.4, p.pos.y < e.court.cy ? -2.5 : 2.5);
        p.target = pop;
        p.intent = 'pop';
      } else {
        p.target = { x: hoop.x - side * 1.2, y: hoop.y + (p.pos.y < e.court.cy ? -0.5 : 0.5) };
        p.intent = 'roll';
      }
      p.urgency = 1;
      if (age > 5.5) st.pnr = null;
    }
    return;
  }
  if (st.pnr && e.time - st.pnr.t > 6) st.pnr = null;

  // Contre-attaque : courir les couloirs
  if (st.transition && e.time - st.startT < 4.5) {
    const big = p.data.pos === 'C';
    const lane = big ? { x: hoop.x - side * (p.data.attrs.speed > 11 ? 1.5 : 7.5), y: hoop.y } : spot;
    p.target = lane;
    p.urgency = 1;
    p.intent = big ? 'rim run' : 'couloir';
    return;
  }


  // Lecture du défenseur : coupe si le défenseur regarde le ballon ou aide
  const myDef = e.players.find((o) => o.onCourt && o.team !== p.team && o.assign === p.idx);
  const ballP = e.ballPos();
  const dHoop = dist(p.pos, hoop);
  if (st.cutter === p.idx && e.time - st.cutT < 1.6) return;
  if (myDef && h && h !== p) {
    const sep = dist(myDef.pos, p.pos);
    const defBallSide = dist(myDef.pos, ballP) < dist(p.pos, ballP) - 1;
    const denial = sep < 1.0 && dist(myDef.pos, ballP) < dist(p.pos, ballP);
    const readSkill = (a.offBall + a.iq) / 40;
    if (dHoop > 3 && ((sep > 2.6 && defBallSide) || (denial && dHoop < 8)) && e.rng.chance(0.18 + readSkill * 0.35)) {
      st.cutter = p.idx;
      st.cutT = e.time;
      p.intent = 'coupe';
      p.target = { x: hoop.x - side * 1.0, y: hoop.y + (p.pos.y < e.court.cy ? -0.6 : 0.6) };
      p.urgency = 1;
      return;
    }
  }
  // Après une coupe : remplir l'espace libre (« fill »)
  let tgt = spot;
  if (st.cutter >= 0 && st.cutter !== p.idx && e.time - st.cutT < 2.5) {
    const cutterSpot = st.spots[st.cutter];
    if (cutterSpot && dist(p.pos, cutterSpot) < 6 && e.rng.chance(0.4)) tgt = cutterSpot;
  }
  // Pénétration du porteur : les shooteurs se décalent pour offrir une solution (drift)
  if (h && h.intent === 'drive' && h !== p) {
    const awayFromBall = p.pos.y < h.pos.y ? -1 : 1;
    tgt = { x: tgt.x, y: clamp(tgt.y + awayFromBall * 1.2, 0.5, e.court.g.width - 0.5) };
  }
  // Espacement : ne pas s'agglutiner
  for (const m of e.teamOnCourt(p.team)) {
    if (m === p) continue;
    const md = dist(m.pos, tgt);
    if (md < 2.5) {
      const away = norm({ x: tgt.x - m.pos.x, y: tgt.y - m.pos.y });
      tgt = { x: tgt.x + away.x * (2.5 - md) * 0.6, y: tgt.y + away.y * (2.5 - md) * 0.6 };
    }
  }
  // Petits mouvements vivants autour du spot (jamais figés)
  const wob = Math.sin(e.time * 0.7 + p.idx * 1.7) * 0.5;
  p.target = e.court.clampInside({ x: tgt.x + wob * 0.3, y: tgt.y + wob }, 0.35);
  if (e.frontcourtReached && !e.court.inFrontcourt(side, p.target)) p.target = spot;
  p.urgency = dist(p.pos, p.target) > 4 ? 0.85 : 0.5;
  p.intent = p.role === 'post' ? 'poste bas' : 'se démarque';
}
