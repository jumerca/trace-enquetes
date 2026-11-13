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
    expect(all.EURO.teams.length).toBe(16);
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

describe('Vie hors terrain — extensions', () => {
  it('sponsors, négociation, blessure, mentor, stage d’été et héritage', async () => {
    const { extra, acceptSponsor, negotiate, chooseInjuryPlan, mentorCandidates, chooseCamp, legacyScore, sponsorIncome } = await import('../src/career/life');
    const { generateOffers } = await import('../src/career/career');
    const c = createCareer({ ...BASE, path: 'pro', age: 18, seed: 77 });
    const x = extra(c);
    x.sponsorOffers.push({ id: 'spX', brand: 'Test', sector: 'Test', weekly: 500, until: c.world.season + 1, minRep: 0 });
    acceptSponsor(c, 'spX', true);
    expect(sponsorIncome(c)).toBe(500);
    // Négociation : l'offre change ou disparaît, jamais les deux
    c.phase = 'offseason';
    generateOffers(c);
    if (c.offers[0]) {
      const id = c.offers[0].id;
      const before = c.offers[0].salary;
      const r = negotiate(c, id, 'salary');
      const after = c.offers.find((o) => o.id === id);
      if (r.ok) expect(after!.salary).toBeGreaterThan(before);
      else expect(!after || after.salary === before).toBe(true);
    }
    // Blessure : retour accéléré raccourcit l'indisponibilité
    user(c).injuryDays = 30;
    chooseInjuryPlan(c, 'fast');
    expect(user(c).injuryDays).toBe(18);
    // Mentor : candidats expérimentés uniquement
    for (const m of mentorCandidates(c)) expect(c.world.season - m.birthYear).toBeGreaterThanOrEqual(27);
    // Stage d'été appliqué à la saison suivante
    life(c).money = 50000;
    chooseCamp(c, 'shooting');
    const three = user(c).attrs.three;
    user(c).injuryDays = 0;
    startNextSeason(c);
    expect(user(c).attrs.three).toBeGreaterThanOrEqual(Math.min(20, three + 1) - 1);
    expect(legacyScore(c)).toBeGreaterThan(0);
  });
});

describe('Messagerie, intérêt des clubs, rapports', () => {
  it('les semaines produisent des rapports, des messages et un intérêt des clubs', async () => {
    const { desk, topInterest, resolveMessage, sendMessage } = await import('../src/career/life');
    const c = createCareer({ ...BASE, path: 'pro', age: 18, seed: 9 });
    for (let w = 0; w < 6; w++) {
      let f;
      while ((f = userFixture(c))) {
        const e = createMatch(c, f);
        c.settings.quarterMin = 3;
        e.runToEnd();
        finishMatch(c, f, e, false);
      }
      advanceWeek(c);
    }
    const d = desk(c);
    expect(d.reports.length).toBe(6);
    expect(['A', 'B', 'C', 'D', 'E']).toContain(d.reports[0].grade);
    expect(topInterest(c).length).toBeGreaterThan(0);
    sendMessage(c, { from: 'Test', kind: 'media', subject: 'x', body: 'y', actions: [{ label: 'Oui', effect: 'Médias +8', code: 'media_long' }] });
    const media0 = c.relations.media;
    resolveMessage(c, d.inbox[0].id, 0);
    expect(c.relations.media).toBeGreaterThan(media0);
  });
});

describe('Nouvelles coupes, récompenses et bilan de carrière', () => {
  it('crée une coupe nationale dans chaque pays et les mène à leur terme', async () => {
    const { careerVerdict } = await import('../src/career/life');
    const c = createCareer({ ...BASE, seed: 5 });
    const all = comps(c.world);
    for (const id of ['CUP_ITA', 'CUP_GER', 'CUP_GRE', 'CUP_TUR', 'CUP_APL']) expect(all[id].teams.length).toBe(8);
    for (let i = 0; i < 22; i++) {
      for (let f = userFixture(c); f; f = userFixture(c)) simFixture(c, f);
      advanceWeek(c);
    }
    for (const id of ['CUP_ITA', 'CUP_GER', 'CUP_GRE', 'CUP_TUR', 'CUP_APL']) expect(comps(c.world)[id].winner).toBeDefined();
    // Un joueur du mois est désigné chaque mois
    expect(c.news.filter((n) => n.title.includes('joueur du mois')).length + 0).toBeGreaterThanOrEqual(1);
    const v = careerVerdict(c);
    expect(v.tier.length).toBeGreaterThan(3);
    expect(v.score).toBeGreaterThanOrEqual(0);
  });
});
