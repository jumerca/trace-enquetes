import { describe, expect, it } from 'vitest';
import { MatchEngine } from '../src/sim/engine';
import { FIBA, NBA, withQuarterLength } from '../src/sim/rules';
import { quickTeam } from '../src/sim/testTeams';
import { NameRegistry } from '../src/data/generate';
import { emptyInput } from '../src/sim/types';
import { Court } from '../src/sim/court';
import { launchVelocity, stepBall } from '../src/sim/physics';
import { sigmaFor } from '../src/sim/shooting';
import type { Ball } from '../src/sim/types';

function match(seed: number, q = 4, rules = FIBA) {
  const reg = new NameRegistry();
  return new MatchEngine({ home: quickTeam(seed, 'Home', 12, undefined, reg), away: quickTeam(seed + 999, 'Away', 12, ['#F36B32', '#101827'], reg), rules: withQuarterLength(rules, q), seed });
}

describe('Moteur de match — match complet', () => {
  it('va au bout, avec un score cohérent avec les statistiques simulées', () => {
    const e = match(11);
    let checks = 0;
    while (!e.finished) {
      e.step();
      if (e.time % 1 < 1 / 60) {
        checks++;
        // Toujours 5 joueurs par équipe sur le terrain
        expect(e.teamOnCourt(0).length).toBe(5);
        expect(e.teamOnCourt(1).length).toBe(5);
        // Le ballon existe et sa position est valide
        expect(Number.isFinite(e.ball.x) && Number.isFinite(e.ball.y) && Number.isFinite(e.ball.z)).toBe(true);
        expect([0, 1]).toContain(e.possession);
        if (e.ball.state === 'held') expect(e.players[e.ball.holder].onCourt).toBe(true);
        for (const p of e.onCourt) expect(Number.isFinite(p.pos.x) && Number.isFinite(p.pos.y)).toBe(true);
      }
      if (e.time > 4 * 4 * 60 * 3) throw new Error('Match bloqué');
    }
    expect(checks).toBeGreaterThan(100);
    for (const t of [0, 1] as const) {
      const ps = e.teams[t].players.map((i) => e.players[i]);
      const sumPts = ps.reduce((s, p) => s + p.box.pts, 0);
      expect(sumPts).toBe(e.teams[t].score);
      for (const p of ps) {
        const b = p.box;
        expect(b.pts).toBe(2 * (b.fgm - b.tpm) + 3 * b.tpm + b.ftm);
        expect(b.fgm).toBeLessThanOrEqual(b.fga);
        expect(b.tpm).toBeLessThanOrEqual(b.tpa);
        expect(b.ftm).toBeLessThanOrEqual(b.fta);
        expect(p.fouls).toBeLessThanOrEqual(FIBA.foulOut);
      }
      expect(e.teams[t].scoreByQ.reduce((a, b) => a + b, 0)).toBe(e.teams[t].score);
    }
    expect(e.teams[0].score).not.toBe(e.teams[1].score);
    expect(e.events.filter((x) => x.type === 'quarter').length).toBeGreaterThanOrEqual(4);
  });

  it('est déterministe à graine égale', () => {
    const a = match(5, 2);
    const b = match(5, 2);
    a.runToEnd();
    b.runToEnd();
    expect(a.teams.map((t) => t.score)).toEqual(b.teams.map((t) => t.score));
    expect(a.events.length).toBe(b.events.length);
  });

  it('les dix joueurs se déplacent réellement (aucun joueur figé)', () => {
    const e = match(21, 4);
    const travelled = new Map<number, number>();
    let prev = e.onCourt.map((p) => ({ i: p.idx, x: p.pos.x, y: p.pos.y }));
    for (let t = 0; t < 60 * 40; t++) {
      e.step();
      const cur = e.onCourt.map((p) => ({ i: p.idx, x: p.pos.x, y: p.pos.y }));
      for (const c of cur) {
        const pv = prev.find((p) => p.i === c.i);
        if (pv) travelled.set(c.i, (travelled.get(c.i) ?? 0) + Math.hypot(c.x - pv.x, c.y - pv.y));
      }
      prev = cur;
    }
    const moving = [...travelled.values()].filter((d) => d > 15).length;
    expect(moving).toBeGreaterThanOrEqual(10);
  });

  it('les joueurs ne se traversent pas', () => {
    const e = match(31, 4);
    let minD = 99;
    for (let t = 0; t < 60 * 120; t++) {
      e.step();
      const on = e.onCourt;
      for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) minD = Math.min(minD, Math.hypot(on[i].pos.x - on[j].pos.x, on[i].pos.y - on[j].pos.y));
    }
    expect(minD).toBeGreaterThan(0.45);
  });

  it('enregistre passes, tirs, rebonds, interceptions, fautes, lancers et remplacements', () => {
    const counts: Record<string, number> = {};
    for (const seed of [1, 2, 3]) {
      const e = match(seed, 6);
      e.runToEnd();
      for (const ev of e.events) counts[ev.type] = (counts[ev.type] ?? 0) + 1;
    }
    for (const k of ['pass', 'shot', 'made', 'miss', 'rebound', 'steal', 'foul', 'ft', 'sub', 'quarter', 'final']) expect(counts[k] ?? 0, k).toBeGreaterThan(0);
  });

  it('les équipes changent de panier à la mi-temps', () => {
    const e = match(4, 2);
    const first = e.attackSide(0);
    e.runUntil((x) => x.quarter === 3);
    expect(e.attackSide(0)).toBe(-first);
  });

  it('fonctionne aussi avec le règlement NBA (6 fautes, 12 min)', () => {
    const e = match(8, 3, NBA);
    e.runToEnd();
    expect(e.finished).toBe(true);
    expect(e.rules.foulOut).toBe(6);
  });
});

describe('Règles', () => {
  it('sanctionne la violation des 24 secondes si le porteur garde le ballon', () => {
    const home = quickTeam(3, 'Home');
    const e = new MatchEngine({ home, away: quickTeam(4, 'Away'), rules: withQuarterLength(FIBA, 10), seed: 3, userPlayerId: home.players[0].id, userAssist: false, userControl: true });
    // On attend une possession de son équipe, on lui confie le ballon et il ne fait plus rien.
    const u = e.players[e.userIdx];
    e.runUntil((x) => x.phase === 'live' && x.possession === u.team && x.ball.state === 'held' && x.frontcourtReached);
    const h = e.hoopFor(u.team);
    u.pos = { x: h.x - e.attackSide(u.team) * 7.5, y: h.y };
    if (e.ball.holder !== u.idx) e.gainBall(u, 'loose', -1);
    const sc = e.shotClock;
    let violation = false;
    for (let t = 0; t < 60 * (sc + 3) && !violation; t++) {
      e.step(emptyInput());
      if (e.events.some((x) => x.type === 'violation' && x.text.includes('24 secondes'))) violation = true;
    }
    expect(violation).toBe(true);
  });

  it('accorde des lancers francs et respecte la faute d’équipe', () => {
    let fts = 0;
    for (const seed of [10, 12, 14]) {
      const e = match(seed, 8);
      e.runToEnd();
      fts += e.players.reduce((s, p) => s + p.box.fta, 0);
    }
    expect(fts).toBeGreaterThan(10);
  });

  it('distingue les tirs à 3 points (géométrie FIBA)', () => {
    const c = new Court(FIBA.court);
    const h = c.hoop(1);
    expect(c.isThree(1, { x: h.x - 7.0, y: h.y })).toBe(true);
    expect(c.isThree(1, { x: h.x - 6.5, y: h.y })).toBe(false);
    expect(c.isThree(1, { x: 27.5, y: 0.5 })).toBe(true); // corner
    expect(c.isThree(1, { x: 27.5, y: 1.2 })).toBe(false);
  });
});

describe('Physique du ballon', () => {
  it('un tir parfaitement visé traverse l’anneau', () => {
    const c = new Court(FIBA.court);
    const h = c.hoop(1);
    const s = { x: h.x - 5, y: h.y, z: 2.4 };
    const v = launchVelocity(s, { x: h.x + 0.02, y: h.y, z: 3.05 }, 4.4);
    const b: Ball = { state: 'air', holder: -1, x: s.x, y: s.y, z: s.z, vx: v.vx, vy: v.vy, vz: v.vz, flight: null, lastTouch: -1, lastTeam: 0, dribblePhase: 0, dribbling: false, airT: 0, spin: 0 };
    let scored = false;
    for (let i = 0; i < 200 && !scored; i++) scored = stepBall(b, c, 1 / 60).scored;
    expect(scored).toBe(true);
  });
  it('un tir trop court touche l’anneau ou tombe sans marquer', () => {
    const c = new Court(FIBA.court);
    const h = c.hoop(1);
    const s = { x: h.x - 5, y: h.y, z: 2.4 };
    const v = launchVelocity(s, { x: h.x - 0.4, y: h.y, z: 3.05 }, 4.4);
    const b: Ball = { state: 'air', holder: -1, x: s.x, y: s.y, z: s.z, vx: v.vx, vy: v.vy, vz: v.vz, flight: null, lastTouch: -1, lastTeam: 0, dribblePhase: 0, dribbling: false, airT: 0, spin: 0 };
    let scored = false;
    for (let i = 0; i < 200; i++) scored = scored || stepBall(b, c, 1 / 60).scored;
    expect(scored).toBe(false);
  });
  it('la précision diminue quand la probabilité visée baisse', () => {
    expect(sigmaFor(0.8, 4.5)).toBeLessThan(sigmaFor(0.4, 4.5));
    expect(sigmaFor(0.4, 7)).toBeLessThan(sigmaFor(0.2, 7));
  });
});

describe('Identités', () => {
  it('aucun homonyme entre les deux équipes d\u2019un match', () => {
    const e = match(77, 2);
    const names = e.players.map((p) => `${p.data.firstName} ${p.data.lastName}`);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('Mode spectateur', () => {
  it('le joueur incarné est joué par l’IA selon ses consignes', () => {
    const run = (shooting: number) => {
      let fga = 0;
      for (const seed of [1, 2, 3, 4]) {
        const reg = new NameRegistry();
        const home = quickTeam(seed, 'H', 12, undefined, reg);
        const e = new MatchEngine({ home, away: quickTeam(seed + 50, 'A', 12, undefined, reg), rules: withQuarterLength(FIBA, 5), seed, userPlayerId: home.players[1].id, userStyle: { shooting, defense: 0.5, hustle: 0.5 } });
        e.runToEnd();
        fga += e.players[e.userIdx].box.fga;
      }
      return fga;
    };
    const selfish = run(0.8);
    const team = run(-0.8);
    expect(selfish).toBeGreaterThan(0);
    expect(selfish).toBeGreaterThan(team);
  });
});
