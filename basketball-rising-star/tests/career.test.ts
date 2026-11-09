import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { acceptOffer, advanceWeek, createCareer, depthChart, generateOffers, recordUserMatch, standings, startNextSeason, teamInput, user, userClub, userFixture, userRole, type Career, type CreationInput } from '../src/career/career';
import { createMatch, finishMatch } from '../src/career/matchBridge';
import { fastSimGame } from '../src/career/fastsim';
import { trainWeek, applyGains } from '../src/career/training';
import { age, playerOvr } from '../src/data/generate';

const INPUT: CreationInput = {
  firstName: 'Lucas',
  lastName: 'Testeur',
  nationality: 'FRA',
  birthCity: 'Lyon',
  age: 17,
  heightCm: 196,
  weightKg: 90,
  hand: 'R',
  number: 23,
  pos: 'SG',
  pos2: 'SF',
  archetype: 'sharpshooter',
  appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, headband: false, sleeve: false },
  path: 'amateur',
  seed: 4242,
};

function simUserFixtureFast(c: Career): void {
  const f = userFixture(c);
  if (!f) return;
  const ti = (id: string) => {
    const dc = depthChart(c, id);
    return dc.order.filter((p) => p.injuryDays <= 0).map((p) => ({ p, minutes: dc.minutes[p.id] ?? 0, starter: dc.starters.includes(p) }));
  };
  const r = fastSimGame(ti(f.home), ti(f.away), new Rng(f.id.length + c.week));
  recordUserMatch(c, f, r.hs, r.as, new Map([...r.lines].map(([k, v]) => [k, { ...v, pm: 0 }])), false);
}

describe('Carrière', () => {
  it('crée une carrière jouable avec un monde cohérent', () => {
    const c = createCareer(INPUT);
    const u = user(c);
    expect(u.firstName).toBe('Lucas');
    expect(userClub(c).roster).toContain(u.id);
    expect(c.world.leagues.FRA2.teams).toContain(u.clubId);
    expect(Object.keys(c.world.clubs).length).toBe(48);
    // Pas de doublon d'identité
    const names = Object.values(c.world.players).map((p) => `${p.firstName} ${p.lastName}`);
    expect(new Set(names).size).toBe(names.length);
    // Tous les clubs ont un effectif complet
    for (const cl of Object.values(c.world.clubs)) expect(cl.roster.length).toBeGreaterThanOrEqual(12);
    expect(userFixture(c)).not.toBeNull();
    const ti = teamInput(c, u.clubId!);
    expect(ti.players.length).toBeGreaterThanOrEqual(10);
  });

  it('joue un premier match avec le moteur complet et met à jour statistiques, classement et progression', () => {
    const c = createCareer({ ...INPUT, seed: 99 });
    c.settings.quarterMin = 3;
    const f = userFixture(c)!;
    const e = createMatch(c, f);
    e.runToEnd();
    const line = finishMatch(c, f, e, false);
    expect(f.played).toBe(true);
    expect(f.hs + f.as).toBeGreaterThan(20);
    expect(line.rating).toBeGreaterThanOrEqual(0);
    const before = playerOvr(user(c));
    advanceWeek(c);
    expect(c.week).toBe(2);
    const st = standings(c, userClub(c).leagueId);
    expect(st.reduce((s, r) => s + r.w, 0)).toBe(6);
    expect(playerOvr(user(c))).toBeGreaterThanOrEqual(before - 1);
  });

  it('dispute une saison entière (moteur complet pour les matchs du joueur), playoffs et intersaison', () => {
    const c = createCareer({ ...INPUT, seed: 7 });
    c.settings.quarterMin = 3;
    let guard = 0;
    while (c.phase !== 'offseason' && guard++ < 40) {
      const f = userFixture(c);
      if (f) {
        const e = createMatch(c, f);
        e.runToEnd();
        finishMatch(c, f, e, false);
      }
      advanceWeek(c);
    }
    expect(c.phase).toBe('offseason');
    const lid = userClub(c).leagueId;
    const st = standings(c, lid);
    expect(st.reduce((s, r) => s + r.w + r.l, 0)).toBe(12 * 22);
    expect(c.world.fixtures.some((f) => f.stage === 'final' && f.played)).toBe(true);
    const u = user(c);
    expect(c.seasonStats[u.id]).toBeDefined();
    startNextSeason(c);
    expect(c.world.season).toBe(2027);
    expect(c.week).toBe(1);
    expect(user(c).history.length).toBe(1);
    expect(age(user(c), c.world.season)).toBe(18);
  }, 120000);

  it('reste équilibrée sur 20 saisons (monde, effectifs, notes)', () => {
    const c = createCareer({ ...INPUT, seed: 2024 });
    const avgOvr = () => {
      const ps = Object.values(c.world.players).filter((p) => !p.retired && p.clubId && !p.isUser);
      return ps.reduce((s, p) => s + playerOvr(p), 0) / ps.length;
    };
    const start = avgOvr();
    const samples: number[] = [];
    for (let s = 0; s < 20; s++) {
      let guard = 0;
      while (c.phase !== 'offseason' && guard++ < 40) {
        simUserFixtureFast(c);
        advanceWeek(c);
      }
      startNextSeason(c);
      samples.push(avgOvr());
      for (const cl of Object.values(c.world.clubs)) {
        expect(cl.roster.length).toBeGreaterThanOrEqual(12);
        expect(cl.roster.length).toBeLessThanOrEqual(14);
      }
      if (c.retired) break;
    }
    const end = samples[samples.length - 1];
    console.log('note moyenne du monde', start.toFixed(1), '→', samples.map((x) => x.toFixed(1)).join(' '));
    expect(Math.abs(end - start)).toBeLessThan(6);
    expect(Object.keys(c.world.players).length).toBeLessThan(2500);
    expect(user(c).history.length).toBeGreaterThanOrEqual(15);
  }, 300000);

  it('le temps de jeu ne dépend pas que de la note : confiance du coach et âge comptent', () => {
    const c = createCareer({ ...INPUT, seed: 5, path: 'formation', age: 16 });
    const r1 = userRole(c);
    c.trust = 100;
    c.relations.coach = 100;
    const r2 = userRole(c);
    expect(r2.rank).toBeLessThanOrEqual(r1.rank);
  });

  it('les offres de transfert sont cohérentes avec le niveau du joueur', () => {
    const c = createCareer({ ...INPUT, seed: 77 });
    c.phase = 'offseason';
    generateOffers(c);
    const ovr = playerOvr(user(c));
    for (const o of c.offers) {
      const cl = c.world.clubs[o.clubId];
      expect(c.world.leagues[cl.leagueId].level).toBeGreaterThanOrEqual(1);
      // Un joueur moyen n'est pas recruté par les meilleurs clubs d'élite
      if (ovr < 60) expect(cl.reputation).toBeLessThan(90);
    }
    if (c.offers[0]) {
      acceptOffer(c, c.offers[0].id);
      expect(user(c).clubId).toBe(c.world.clubs[user(c).clubId!].id);
      expect(userClub(c).roster).toContain('user');
    }
  });

  it('l’entraînement intense fait progresser davantage mais augmente fatigue et blessures', () => {
    const c = createCareer({ ...INPUT, seed: 3 });
    const u = user(c);
    let injN = 0;
    let injI = 0;
    let gainN = 0;
    let gainI = 0;
    const rng = new Rng(1);
    for (let i = 0; i < 3000; i++) {
      const p = { ...u, fatigue: 30 };
      const n = trainWeek(p, { mode: 'manual', program: 'shootingOut', intensity: 'light', specialistCoach: false }, 12, 12, 20, 17, rng);
      const it = trainWeek(p, { mode: 'manual', program: 'shootingOut', intensity: 'intense', specialistCoach: false }, 12, 12, 20, 17, rng);
      if (n.injured) injN++;
      if (it.injured) injI++;
      gainN += Object.values(n.gains).reduce((s, g) => s + (g ?? 0), 0);
      gainI += Object.values(it.gains).reduce((s, g) => s + (g ?? 0), 0);
    }
    expect(gainI).toBeGreaterThan(gainN);
    expect(injI).toBeGreaterThan(injN);
    const p = { ...u, attrs: { ...u.attrs }, frac: {} };
    const ch = applyGains(p, { three: 1.4 });
    expect(ch).toContain('three');
    expect(p.attrs.three).toBe(Math.min(20, u.attrs.three + 1));
  });
});
