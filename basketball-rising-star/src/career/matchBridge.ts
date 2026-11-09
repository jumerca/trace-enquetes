import { hashString } from '../core/rng';
import { MatchEngine } from '../sim/engine';
import type { BoxLine } from '../sim/types';
import { recordUserMatch, rulesFor, teamInput, type Career } from './career';
import type { SeasonStat } from './fastsim';
import type { Fixture, UserGameLine } from './world';

export function createMatch(c: Career, f: Fixture, control = false): MatchEngine {
  return new MatchEngine({
    home: teamInput(c, f.home, f),
    away: teamInput(c, f.away, f),
    rules: rulesFor(c, f.leagueId),
    seed: hashString(`${f.id}|${c.world.seed}`),
    userPlayerId: c.userId,
    userAssist: c.settings.assist,
    userControl: control,
    userStyle: c.style,
  });
}

export function boxToStat(b: BoxLine, started: boolean): SeasonStat & { pm: number } {
  return {
    gp: b.sec > 0 ? 1 : 0,
    gs: started ? 1 : 0,
    min: Math.round(b.sec / 60),
    pts: b.pts,
    reb: b.orb + b.drb,
    ast: b.ast,
    stl: b.stl,
    blk: b.blk,
    tov: b.tov,
    fgm: b.fgm,
    fga: b.fga,
    tpm: b.tpm,
    tpa: b.tpa,
    ftm: b.ftm,
    fta: b.fta,
    pf: b.pf,
    pm: b.pm,
  };
}

/** Les minutes jouées sur des quarts raccourcis (option arcade) sont ramenées à l'échelle d'un match officiel. */
export function engineLines(e: MatchEngine): Map<string, SeasonStat & { pm: number }> {
  const official = e.rules.id === 'NBA' ? 12 : 10;
  const scale = official / e.rules.quarterMin;
  const m = new Map<string, SeasonStat & { pm: number }>();
  e.teams.forEach((t) => {
    t.players.forEach((idx, i) => {
      const p = e.players[idx];
      const st = boxToStat(p.box, i < 5);
      st.min = Math.round((p.box.sec / 60) * scale);
      m.set(p.data.id, st);
    });
  });
  return m;
}

export function finishMatch(c: Career, f: Fixture, e: MatchEngine, live: boolean): UserGameLine {
  return recordUserMatch(c, f, e.teams[0].score, e.teams[1].score, engineLines(e), live);
}
