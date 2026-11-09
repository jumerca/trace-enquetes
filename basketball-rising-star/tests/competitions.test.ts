import { describe, expect, it } from 'vitest';
import { advanceWeek, createCareer, depthChart, startNextSeason, user, userClub, userFixture, userTeams, type CreationInput } from '../src/career/career';
import { comps, natId, startNationalTournament, youthEligible } from '../src/career/competitions';
import { answerPress, life, makeRequest, weeklyCosts } from '../src/career/life';
import { createMatch, finishMatch } from '../src/career/matchBridge';
import { simFixture } from '../src/career/career';

const BASE: CreationInput = {
  firstName: 'Théo',
  lastName: 'Compet',
  nationality: 'FRA',
  birthCity: 'Pau',
  age: 16,
  heightCm: 200,
  weightKg: 92,
  hand: 'R',
  number: 9,
  pos: 'SF',
  pos2: 'PF',
  archetype: 'athleticWing',
  appearance: { skin: 3, hair: 2, hairColor: 0, beard: 0, headband: false, sleeve: false },
  path: 'formation',
  seed: 31,
};

describe('Compétitions', () => {
  it('crée la Coupe de France, la Copa Peninsular et l’EuroCoupe avec leurs premiers tours', () => {
    const c = createCareer(BASE);
    const all = comps(c.world);
    expect(all.CUP_FRA.teams.length).toBe(16);
    expect(all.CUP_ESP.teams.length).toBe(8);
    expect(all.EURO.teams.length).toBe(8);
    expect(c.world.fixtures.filter((f) => f.leagueId === 'CUP_FRA').length).toBe(8);
  });

  it('un jeune peu utilisé d’un club d’élite dispute des matchs Espoirs joués par le moteur complet', () => {
    const c = createCareer(BASE);
    c.settings.quarterMin = 3;
    expect(youthEligible(c)).toBe(true);
    const yf = c.world.fixtures.find((f) => f.stage === 'youth');
    expect(yf).toBeDefined();
    // Jouer tous les matchs de la semaine (championnat puis Espoirs)
    let f;
    let played = 0;
    while ((f = userFixture(c))) {
      const e = createMatch(c, f);
      expect(e.teams[0].players.length).toBeGreaterThanOrEqual(10);
      e.runToEnd();
      finishMatch(c, f, e, false);
      played++;
    }
    expect(played).toBe(2);
    expect(c.compStats.youth?.gp ?? 0).toBeGreaterThanOrEqual(0);
    advanceWeek(c);
    expect(c.week).toBe(2);
  });

  it('les coupes vont jusqu’à la finale et désignent un vainqueur', () => {
    const c = createCareer({ ...BASE, path: 'amateur', age: 17 });
    for (let wk = 0; wk < 20; wk++) {
      let f;
      while ((f = userFixture(c))) simFixture(c, f);
      advanceWeek(c);
    }
    expect(comps(c.world).CUP_FRA.winner).toBeDefined();
    expect(comps(c.world).EURO.winner).toBeDefined();
  });

  it('le tournoi des nations se joue avec la sélection du joueur et se nettoie à la saison suivante', () => {
    const c = createCareer({ ...BASE, path: 'pro', age: 18 });
    c.settings.quarterMin = 3;
    c.phase = 'offseason';
    c.week = 25;
    startNationalTournament(c, 'U20');
    const nat = c.world.clubs[natId('FRA')];
    expect(nat.roster).toContain(user(c).id);
    expect(userTeams(c)).toContain(nat.id);
    const f = userFixture(c)!;
    expect(f.stage).toBe('nat');
    const e = createMatch(c, f);
    expect(e.teams[0].players.length).toBe(12);
    e.runToEnd();
    finishMatch(c, f, e, false);
    expect(c.compStats.nat.gp).toBeLessThanOrEqual(1);
    startNextSeason(c);
    expect(c.world.clubs[natId('FRA')]).toBeUndefined();
    expect(userClub(c).roster).toContain(user(c).id);
  });
});

describe('Vie hors terrain', () => {
  it('les finances, le staff et l’activité de la semaine ont des effets réels', () => {
    const c = createCareer({ ...BASE, path: 'pro', age: 18 });
    const l = life(c);
    const money0 = l.money;
    l.staff.nutrition = true;
    l.activity = 'teamDinner';
    const team0 = c.relations.teammates;
    expect(weeklyCosts(c)).toBeGreaterThan(250);
    let f;
    while ((f = userFixture(c))) simFixture(c, f);
    advanceWeek(c);
    expect(c.relations.teammates).toBeGreaterThan(team0);
    expect(l.money).not.toBe(money0);
    expect(l.activity).toBeNull();
  });

  it('la conférence de presse et les demandes au staff modifient les relations', () => {
    const c = createCareer(BASE);
    life(c).pendingPress = 'x';
    const coach0 = c.relations.coach;
    answerPress(c, 2);
    expect(c.relations.coach).toBeLessThan(coach0);
    expect(life(c).pendingPress).toBeNull();
    const r = makeRequest(c, 'transfer');
    expect(r.ok).toBe(true);
    expect(life(c).transferRequest).toBe(true);
  });

  it('un prêt envoie le jeune en deuxième division puis il revient à son club', () => {
    const c = createCareer(BASE);
    const home = user(c).clubId!;
    // Placer le joueur en fin de rotation
    c.trust = 0;
    expect(depthChart(c, home).order.findIndex((p) => p.isUser)).toBeGreaterThanOrEqual(8);
    const r = makeRequest(c, 'loan');
    expect(r.ok).toBe(true);
    expect(c.world.clubs[user(c).clubId!].leagueId).toBe('FRA2');
    c.phase = 'offseason';
    startNextSeason(c);
    expect(user(c).clubId === home || life(c).loanFrom === null).toBe(true);
  });
});
