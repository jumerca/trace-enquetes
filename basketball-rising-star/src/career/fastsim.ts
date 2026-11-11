import { Rng } from '../core/rng';
import { playerOvr } from '../data/generate';
import type { PlayerData } from '../data/model';

export interface SeasonStat {
  gp: number;
  gs: number;
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  pf: number;
}

export const emptySeasonStat = (): SeasonStat => ({ gp: 0, gs: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, pf: 0 });

export interface RosterEntry {
  p: PlayerData;
  minutes: number; // minutes prévues (sur 40)
  starter: boolean;
}

/**
 * Simulation rapide (au niveau de la possession, sans rendu ni déplacements) utilisée pour les
 * matchs du monde qui n'impliquent pas le joueur incarné. Les matchs du joueur passent toujours
 * par le moteur complet.
 */
export function fastSimGame(home: RosterEntry[], away: RosterEntry[], rng: Rng, homeAdv = 1.5): { hs: number; as: number; lines: Map<string, SeasonStat> } {
  const lines = new Map<string, SeasonStat>();
  const rate = (r: RosterEntry[]) => {
    let o = 0;
    let d = 0;
    let t = 0;
    for (const e of r) {
      const a = e.p.attrs;
      const fat = 1 - Math.min(0.3, e.p.fatigue / 300);
      const ovr = playerOvr(e.p) * fat * (0.9 + e.p.form * 0.2);
      o += (ovr + (a.shotCreation + a.three + a.finishing - 30) * 0.4) * e.minutes;
      d += (ovr + (a.perimeterD + a.teamD + a.rimProtect - 30) * 0.4) * e.minutes;
      t += e.minutes;
    }
    return { o: o / Math.max(1, t), d: d / Math.max(1, t) };
  };
  const H = rate(home);
  const A = rate(away);
  const poss = Math.round(rng.normal(74, 4));
  const ppp = (off: number, def: number, adv: number) => Math.max(0.75, Math.min(1.35, 1.04 + (off - def) * 0.014 + adv * 0.006 + rng.normal(0, 0.06)));
  let hs = Math.round(poss * ppp(H.o, A.d, homeAdv));
  let as = Math.round(poss * ppp(A.o, H.d, -homeAdv));
  if (hs === as) rng.chance(0.5) ? hs++ : as++;
  for (const [team, score] of [
    [home, hs],
    [away, as],
  ] as [RosterEntry[], number][]) {
    const usage = team.map((e) => Math.max(0.2, (e.p.attrs.shotCreation + e.p.attrs.three + e.p.attrs.finishing + playerOvr(e.p) / 4 - 25) / 20) * e.minutes);
    const tot = usage.reduce((s, u) => s + u, 0);
    team.forEach((e, i) => {
      if (e.minutes <= 0) return;
      const a = e.p.attrs;
      const min = Math.max(0, Math.round(rng.normal(e.minutes, 3)));
      if (min <= 0) return;
      const share = usage[i] / tot;
      const pts = Math.max(0, Math.round(score * share + rng.normal(0, 2.2)));
      const threeShare = Math.min(0.6, a.three / 32);
      const tpm = Math.round((pts * threeShare) / 3);
      const ftm = Math.round(pts * 0.15);
      const fgm = Math.max(0, Math.round((pts - tpm * 3 - ftm) / 2) + tpm);
      const fga = Math.round(fgm / Math.max(0.3, 0.42 + (playerOvr(e.p) - 60) / 400));
      const big = e.p.pos === 'C' || e.p.pos === 'PF' ? 1.6 : e.p.pos === 'SF' ? 1.0 : 0.7;
      const st: SeasonStat = {
        gp: 1,
        gs: e.starter ? 1 : 0,
        min,
        pts,
        reb: Math.max(0, Math.round((min / 40) * (3 + (a.defRebound / 20) * 7 * big) + rng.normal(0, 1.4))),
        ast: Math.max(0, Math.round((min / 40) * ((a.passing + a.vision) / 40) * 9 + rng.normal(0, 1.1))),
        stl: Math.max(0, Math.round((min / 40) * (a.steal / 20) * 2.2 + rng.normal(0, 0.6))),
        blk: Math.max(0, Math.round((min / 40) * (a.block / 20) * 2 * big + rng.normal(0, 0.5))),
        tov: Math.max(0, Math.round((min / 40) * 2 * (1.2 - a.ballSecurity / 20) + rng.normal(0, 0.7))),
        fgm,
        fga: Math.max(fgm, fga),
        tpm,
        tpa: Math.max(tpm, Math.round(tpm / 0.36)),
        ftm,
        fta: Math.max(ftm, Math.round(ftm / 0.76)),
        pf: Math.max(0, Math.round((min / 40) * 2.6 + rng.normal(0, 0.8))),
      };
      lines.set(e.p.id, st);
    });
  }
  return { hs, as, lines };
}

export function addStat(a: SeasonStat, b: SeasonStat): void {
  for (const k of Object.keys(a) as (keyof SeasonStat)[]) a[k] += b[k];
}
