import { clamp, dist, lerpV, norm, type V2 } from '../../core/vec';
import type { MatchEngine } from '../engine';
import type { MPlayer } from '../types';
import { predictBall } from './offense';

const POS_ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

/** Attribution homme à homme : chaque défenseur prend l'attaquant du poste le plus proche. */
export function assignDefense(e: MatchEngine, defTeam: 0 | 1): void {
  const defs = e.teamOnCourt(defTeam);
  const offs = e.teamOnCourt((1 - defTeam) as 0 | 1);
  const free = new Set(offs.map((o) => o.idx));
  const sortedDefs = [...defs].sort((a, b) => POS_ORDER.indexOf(a.data.pos) - POS_ORDER.indexOf(b.data.pos));
  for (const d of sortedDefs) {
    let best = -1;
    let bs = 1e9;
    for (const oi of free) {
      const o = e.players[oi];
      const posGap = Math.abs(POS_ORDER.indexOf(o.data.pos) - POS_ORDER.indexOf(d.data.pos)) * 2.5;
      // Le défenseur spécialiste prend le meilleur extérieur adverse
      const star = d.data.archetype === 'lockdown' ? -(o.data.attrs.shotCreation + o.data.attrs.three) / 6 : 0;
      const s = posGap + star + dist(o.pos, d.pos) * 0.15;
      if (s < bs) {
        bs = s;
        best = oi;
      }
    }
    d.assign = best;
    free.delete(best);
  }
}

interface DefTeamState {
  helper: number;
  helpT: number;
  switchCd: number;
}
const defStates = new WeakMap<MatchEngine, [DefTeamState, DefTeamState]>();
function ds(e: MatchEngine, t: 0 | 1): DefTeamState {
  let s = defStates.get(e);
  if (!s) {
    s = [
      { helper: -1, helpT: -9, switchCd: 0 },
      { helper: -1, helpT: -9, switchCd: 0 },
    ];
    defStates.set(e, s);
  }
  return s[t];
}

/** Faut-il commettre une faute volontaire (fin de match, mené) ? */
export function shouldFoul(e: MatchEngine, defTeam: 0 | 1): boolean {
  if (e.quarter < 4) return false;
  const diff = e.scoreDiff(defTeam);
  return diff < 0 && diff >= -7 && e.clock < 26 && e.clock > 0.5 && e.shotClock > e.clock - 2;
}

export function defenseThink(e: MatchEngine, p: MPlayer, userControlled: boolean): void {
  const b = e.ball;
  const own = e.ownHoop(p.team);
  if (userControlled) return;
  const tac = e.teams[p.team].tactics;
  const a = p.data.attrs;
  const offTeam = (1 - p.team) as 0 | 1;

  // Rebond / ballon libre
  if (b.state === 'loose' || (b.state === 'air' && b.flight && (b.flight.kind === 'shot' || b.flight.kind === 'block'))) {
    const pred = predictBall(e);
    const man = p.assign >= 0 ? e.players[p.assign] : null;
    const shotInAir = b.state === 'air' && b.flight?.kind === 'shot';
    const mates = e.teamOnCourt(p.team).sort((x, y) => dist(x.pos, pred) - dist(y.pos, pred));
    const rank = mates.indexOf(p);
    if (shotInAir && man && dist(man.pos, own) < 6.5 && b.z > 3.2) {
      const dir = norm({ x: own.x - man.pos.x, y: own.y - man.pos.y });
      p.target = { x: man.pos.x + dir.x * 0.6, y: man.pos.y + dir.y * 0.6 };
      p.urgency = 0.95;
      p.intent = 'box-out';
    } else if (rank <= 1 || dist(p.pos, pred) < 3) {
      p.target = pred;
      p.urgency = 1;
      p.intent = 'rebond';
    } else if (man) {
      p.target = lerpV(man.pos, own, 0.35);
      p.urgency = 0.7;
    }
    const bd = Math.hypot(p.pos.x - b.x, p.pos.y - b.y);
    if (bd < 1.2 && b.z > 2.2 && b.z < p.heightM * 1.33 + 0.9 && b.vz < 0 && p.z === 0 && p.jumpCd <= 0) {
      p.vz = 2.4 + (a.vertical / 20) * 1.4;
      p.anim = 'rebound';
      p.animT = 0;
      p.jumpCd = 1.0;
    }
    return;
  }

  // Passe en l'air : anticipation dans la ligne de passe
  if (b.state === 'air' && b.flight?.kind === 'pass') {
    const f = b.flight;
    const end = f.end;
    const dEnd = Math.hypot(p.pos.x - end.x, p.pos.y - end.y);
    const read = (a.passReading + a.steal) / 40;
    if (dEnd < 2.4 && e.rng.chance(read * 0.5 * (0.6 + tac.pressure * 0.6))) {
      p.target = { x: end.x + (p.pos.x - end.x) * 0.2, y: end.y + (p.pos.y - end.y) * 0.2 };
      p.urgency = 1;
      p.intent = 'anticipe la passe';
      (p as MPlayer & { lungeT?: number }).lungeT = e.time;
      return;
    }
    // Receveur : fermeture (closeout) anticipée
    if (p.assign === f.to) {
      const dir = norm({ x: own.x - end.x, y: own.y - end.y });
      p.target = { x: end.x + dir.x * 1.1, y: end.y + dir.y * 1.1 };
      p.urgency = 1;
      p.intent = 'close-out';
      return;
    }
  }

  const h = e.holder();
  if (!h || h.team !== offTeam) return;
  if (p.assign < 0 || !e.players[p.assign].onCourt || e.players[p.assign].team === p.team) assignDefense(e, p.team);
  const state = ds(e, p.team);

  // Faute volontaire en fin de match
  if (shouldFoul(e, p.team) && (p.assign === h.idx || dist(p.pos, h.pos) < 1.5)) {
    p.target = { ...h.pos };
    p.urgency = 1;
    if (dist(p.pos, h.pos) < 1.0 && e.phase === 'live') {
      e.callFoul(p, h, 'intentional');
    }
    return;
  }

  // Repli défensif quand l'adversaire remonte vite
  const hOwnD = dist(h.pos, own);
  if (!e.frontcourtReached && hOwnD > 13) {
    const man = e.players[p.assign];
    const behindBall = dist(p.pos, own) > hOwnD - 1;
    const tgt = man ? lerpV(man.pos, own, man === h ? 0.15 : 0.45) : own;
    // En pressing, le défenseur du porteur monte sur lui
    if (man === h && tac.pressure > 0.75) {
      p.target = { x: h.pos.x + (own.x - h.pos.x) * 0.08, y: h.pos.y };
    } else {
      p.target = e.court.clampInside(tgt);
    }
    p.urgency = behindBall ? 1 : 0.75;
    p.intent = 'repli';
    return;
  }

  // Aide sur pénétration
  const onBall = e.players.find((o) => o.onCourt && o.team === p.team && o.assign === h.idx);
  const beaten = onBall ? dist(onBall.pos, own) > hOwnD - 0.2 || onBall.slowT > 0 : true;
  const driving = h.intent === 'drive' || (Math.hypot(h.vel.x, h.vel.y) > 3.6 && hOwnD < 7);
  if (driving && beaten && hOwnD < 6.5) {
    if (state.helper < 0 || e.time - state.helpT > 1.6 || !e.players[state.helper].onCourt) {
      // Choix de l'aide : le plus proche du chemin, de préférence un protecteur de cercle
      const pathPt = lerpV(h.pos, own, 0.45);
      let best = -1;
      let bs = 1e9;
      for (const d of e.teamOnCourt(p.team)) {
        if (d.assign === h.idx) continue;
        const rp = d.data.attrs.rimProtect / 20;
        const lateness = (20 - d.data.attrs.teamD) / 20; // les défenseurs moins collectifs aident trop tard
        const s = dist(d.pos, pathPt) * (1.2 - rp * 0.5) + lateness * 1.5 + e.rng.next() * 0.8;
        if (s < bs) {
          bs = s;
          best = d.idx;
        }
      }
      state.helper = best;
      state.helpT = e.time;
    }
  } else if (e.time - state.helpT > 1.2) {
    state.helper = -1;
  }

  if (state.helper === p.idx) {
    const dir = norm({ x: own.x - h.pos.x, y: own.y - h.pos.y });
    p.target = { x: h.pos.x + dir.x * 1.0, y: h.pos.y + dir.y * 1.0 };
    p.urgency = 1;
    p.intent = 'aide';
    // Le protecteur de cercle saute sur le tir
    return;
  }

  // Rotation : si un coéquipier aide, le défenseur côté faible le plus intelligent bascule sur son joueur libéré
  if (state.helper >= 0 && state.helper !== p.idx) {
    const helper = e.players[state.helper];
    const freed = helper.assign >= 0 ? e.players[helper.assign] : null;
    if (freed && a.teamD >= 12 && p.assign !== h.idx) {
      const myMan = e.players[p.assign];
      if (myMan && dist(myMan.pos, h.pos) > dist(freed.pos, h.pos) + 2 && dist(p.pos, freed.pos) < 6) {
        p.target = lerpV(freed.pos, own, 0.35);
        p.urgency = 1;
        p.intent = 'rotation';
        return;
      }
    }
  }

  // Changement défensif sur écran
  if (state.switchCd > 0) state.switchCd -= 0.1;
  const pnr = e.offense[offTeam].pnr;
  if (pnr && pnr.set && onBall && p.assign === pnr.screener && state.switchCd <= 0) {
    const stuck = dist(onBall.pos, h.pos) > 2.3;
    const wantSwitch = tac.defense === 'switch' || (stuck && a.pnrD + a.iq > 22);
    if (wantSwitch && dist(p.pos, h.pos) < dist(onBall.pos, h.pos)) {
      const tmp = onBall.assign;
      onBall.assign = p.assign;
      p.assign = tmp;
      state.switchCd = 2.5;
      e.emit({ type: 'info', team: p.team, player: p.idx, text: `Changement défensif : ${e.name(p.idx)} prend ${e.name(h.idx)}` });
    } else if (!wantSwitch) {
      // « Drop » : l'intérieur recule entre le porteur et le cercle
      const dir = norm({ x: own.x - h.pos.x, y: own.y - h.pos.y });
      p.target = { x: h.pos.x + dir.x * 2.8, y: h.pos.y + dir.y * 2.8 };
      p.urgency = 0.9;
      p.intent = 'drop';
      return;
    }
  }

  if (tac.defense === 'zone23') {
    zonePosition(e, p, h, own);
    maybeSteal(e, p, h);
    return;
  }

  const man = e.players[p.assign];
  if (!man) return;
  if (man === h) {
    // Défense sur le porteur : entre l'attaquant et le panier, distance selon la menace
    const shooter = (man.data.attrs.three + man.data.attrs.pullUp) / 40;
    const quick = (man.data.attrs.speed + man.data.attrs.dribble) / 40;
    let gap = 0.9 + (1 - shooter) * 1.0 + quick * 0.35 - tac.pressure * 0.35;
    if (hOwnD > 10) gap += 1.2;
    if (p.fouls >= e.rules.foulOut - 1) gap += 0.3;
    const dir = norm({ x: own.x - man.pos.x, y: own.y - man.pos.y });
    // Anticipation : on se place selon la vitesse de l'attaquant
    const lead = 0.12 + (a.perimeterD / 20) * 0.12;
    p.target = { x: man.pos.x + man.vel.x * lead + dir.x * gap, y: man.pos.y + man.vel.y * lead + dir.y * gap };
    p.urgency = 1;
    p.intent = 'sur le porteur';
    maybeSteal(e, p, h);
  } else {
    // Hors ballon : position d'aide selon la distance au ballon (un temps d'avance / côté faible)
    const ball = h.pos;
    const manBall = dist(man.pos, ball);
    const posSkill = (a.positioning + a.teamD) / 40;
    const kBasket = 0.18 + (manBall > 7 ? 0.22 : 0.06);
    let k2 = manBall > 7 ? 0.32 : 0.12;
    // Les défenseurs peu disciplinés regardent trop le ballon
    k2 += (1 - posSkill) * 0.18;
    const base = lerpV(man.pos, own, kBasket);
    let tgt: V2 = lerpV(base, ball, k2);
    // Refus de passe sur le joueur à une passe du porteur
    if (manBall < 6.5 && tac.pressure > 0.55) {
      const deny = lerpV(man.pos, ball, 0.22);
      tgt = lerpV(tgt, deny, 0.5);
    }
    // Le ballon dans la raquette : on resserre
    if (hOwnD < 4) tgt = lerpV(tgt, own, 0.2);
    tgt.x += Math.sin(e.time * 0.9 + p.idx) * (1 - posSkill) * 0.4;
    p.target = e.court.clampInside(tgt);
    const far = dist(p.pos, p.target);
    p.urgency = clamp(0.45 + far * 0.2, 0.45, 1);
    p.intent = manBall > 7 ? 'côté faible' : 'refus';
  }
}

function zonePosition(e: MatchEngine, p: MPlayer, h: MPlayer, own: V2): void {
  const side = (own.x > e.court.g.length / 2 ? 1 : -1) as 1 | -1;
  const defs = e.teamOnCourt(p.team).sort((a, b) => POS_ORDER.indexOf(a.data.pos) - POS_ORDER.indexOf(b.data.pos));
  const slots: [number, number][] = [
    [5.2, -2.0],
    [5.2, 2.0],
    [2.2, -3.6],
    [2.2, 3.6],
    [1.0, 0],
  ];
  const k = defs.indexOf(p);
  const [u, v] = slots[Math.max(0, k)];
  const bv = e.court.toHoop(side, h.pos);
  const shift = { u: clamp(bv.u - 5, -2, 3) * 0.2, v: clamp(bv.v, -6, 6) * 0.38 };
  let tgt = e.court.fromHoop(side, Math.max(0.6, u + shift.u), v + shift.v);
  // Le défenseur de zone le plus proche du porteur monte dessus
  const nearest = defs.reduce((acc, d) => (dist(d.pos, h.pos) < dist(acc.pos, h.pos) ? d : acc), defs[0]);
  if (nearest === p && dist(h.pos, own) < 9) {
    const dir = norm({ x: own.x - h.pos.x, y: own.y - h.pos.y });
    tgt = { x: h.pos.x + dir.x * 1.1, y: h.pos.y + dir.y * 1.1 };
    p.intent = 'zone (porteur)';
  } else p.intent = 'zone';
  p.target = e.court.clampInside(tgt);
  p.urgency = 0.85;
}

function maybeSteal(e: MatchEngine, p: MPlayer, h: MPlayer): void {
  if (dist(p.pos, h.pos) > 1.1 || p.actionLock > 0) return;
  const tac = e.teams[p.team].tactics;
  const a = p.data.attrs;
  let chance = 0.004 + tac.pressure * 0.01 + (a.steal / 20) * 0.008;
  if (p.fouls >= e.rules.foulOut - 1) chance *= 0.3;
  if (e.rng.chance(chance)) e.attemptSteal(p);
}

/** Utilisé par l'IA pour prévoir la zone de rebond (export pour tests) */
export { predictBall };
