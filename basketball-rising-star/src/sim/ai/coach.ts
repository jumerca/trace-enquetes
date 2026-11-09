import { overall, type Position } from '../../data/attributes';
import type { MatchEngine } from '../engine';
import type { MPlayer } from '../types';

const SLOT_POS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
const ORDER = ['PG', 'SG', 'SF', 'PF', 'C'];

export function initialRotation(e: MatchEngine, team: 0 | 1): number[] {
  return [...e.teams[team].players];
}

function fit(p: MPlayer, slot: number): number {
  const want = SLOT_POS[slot];
  if (p.data.pos === want) return 1;
  if (p.data.pos2 === want) return 0.6;
  const gap = Math.abs(ORDER.indexOf(p.data.pos) - ORDER.indexOf(want));
  return gap === 1 ? 0 : -2.5;
}

/** Désirabilité d'un joueur pour le coach à cet instant du match. */
function desirability(e: MatchEngine, p: MPlayer): number {
  if (p.fouls >= e.rules.foulOut) return -99;
  const ovr = overall(p.data.attrs, p.data.pos);
  const regulation = e.rules.quarterMin * 60 * 4;
  const elapsed = Math.min(regulation, (e.quarter - 1) * e.rules.quarterMin * 60 + (e.rules.quarterMin * 60 - e.clock));
  const progress = elapsed / regulation;
  const planShare = (e.teams[p.team].minutesPlan[p.idx] ?? 15) / 40;
  const playedShare = p.box.sec / regulation;
  const deficit = (planShare * Math.min(1, progress + 0.05) - playedShare) * 40; // minutes
  let d = ovr / 10 + (p.energy - 0.72) * 9 + deficit * 0.35;
  // Gestion des fautes
  const q = e.quarter;
  const limit = q === 1 ? 2 : q === 2 ? 3 : q === 3 ? 4 : e.rules.foulOut - 1;
  if (p.fouls >= limit && !(q >= 4 && e.clock < 240)) d -= 3;
  if (p.onCourt) d += 0.6; // continuité
  // Fin de match serrée : les meilleurs jouent
  if (e.clutch() > 0.3) d += (ovr / 10) * e.clutch();
  // Match plié : le coach vide son banc (temps de jeu pour les jeunes, repos des cadres)
  const gap = Math.abs(e.teams[0].score - e.teams[1].score);
  if (e.quarter >= 4 && e.clock < e.rules.quarterMin * 60 * 0.45 && gap >= 16) d += planShare < 0.25 ? 6 : -2;
  return d;
}

/** Remplacements et ajustements lors d'un arrêt de jeu. */
export function coachDeadBall(e: MatchEngine, allowSubs: boolean, maxChanges = 2): void {
  if (!allowSubs) return;
  for (const t of [0, 1] as const) {
    const roster = e.teams[t].players.map((i) => e.players[i]);
    const scores = new Map<number, number>();
    for (const p of roster) scores.set(p.idx, desirability(e, p));
    const used = new Set<number>();
    const changes: [number, number][] = [];
    const current = roster.filter((p) => p.onCourt).sort((a, b) => a.slot - b.slot);
    for (let s = 0; s < 5; s++) {
      const cur = current.find((p) => p.slot === s);
      let best: MPlayer | null = null;
      let bs = -1e9;
      for (const p of roster) {
        if (used.has(p.idx)) continue;
        if (p.onCourt && p !== cur) continue;
        const v = (scores.get(p.idx) ?? -9) + fit(p, s) * 1.4;
        if (v > bs) {
          bs = v;
          best = p;
        }
      }
      if (!best) continue;
      used.add(best.idx);
      if (cur && best !== cur) {
        const curV = (scores.get(cur.idx) ?? -9) + fit(cur, s) * 1.4;
        if (bs > curV + 0.9 || cur.fouls >= e.rules.foulOut) changes.push([cur.idx, best.idx]);
        else used.delete(best.idx), used.add(cur.idx);
      }
    }
    for (const [o, i] of changes.slice(0, maxChanges)) e.substitute(o, i);
    // Sécurité : toujours 5 joueurs
    let on = roster.filter((p) => p.onCourt);
    while (on.length < 5) {
      const cand = roster.filter((p) => !p.onCourt && p.fouls < e.rules.foulOut).sort((a, b) => b.energy - a.energy)[0];
      if (!cand) break;
      const slots = [0, 1, 2, 3, 4].filter((s) => !on.some((p) => p.slot === s));
      cand.onCourt = true;
      cand.slot = slots[0];
      cand.pos = { x: e.court.g.length / 2, y: 1 };
      on = roster.filter((p) => p.onCourt);
    }
  }
}

/** Temps mort pour casser une série adverse ou organiser une dernière possession. */
export function coachTimeoutCheck(e: MatchEngine, team: 0 | 1, afterScore: boolean): void {
  const t = e.teams[team];
  const opp = e.teams[1 - team];
  if (t.timeouts <= 0) return;
  if (afterScore && opp.run >= 8 && e.rng.chance(0.75)) {
    e.callTimeout(team, `série de ${opp.run}-0 encaissée`);
    coachDeadBall(e, true);
    return;
  }
  const diff = e.scoreDiff(team);
  if (afterScore && e.quarter >= 4 && e.clock < 25 && diff <= 0 && diff >= -3 && t.timeouts > 0 && !(t as { usedLate?: boolean }).usedLate) {
    (t as { usedLate?: boolean }).usedLate = true;
    e.callTimeout(team, 'dernière possession');
    coachDeadBall(e, true);
  }
}
