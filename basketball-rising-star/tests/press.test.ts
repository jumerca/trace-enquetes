import { describe, expect, it } from 'vitest';
import { advanceWeek, createCareer, generateOffers, acceptOffer, simFixture, startNextSeason, user, userClub, userFixture, type CreationInput } from '../src/career/career';
import { createMatch, finishMatch } from '../src/career/matchBridge';
import { draftBoard, draftState, runDraft, userProjection } from '../src/career/draft';

const BASE: CreationInput = {
  firstName: 'Noé',
  lastName: 'Plume',
  nationality: 'FRA',
  birthCity: 'Nantes',
  age: 18,
  heightCm: 198,
  weightKg: 92,
  hand: 'R',
  number: 11,
  pos: 'SF',
  pos2: 'SG',
  archetype: 'allAround',
  appearance: { skin: 1, hair: 1, hairColor: 1, beard: 0, headband: false, sleeve: false },
  path: 'pro',
  seed: 606,
};

describe('Presse', () => {
  it('les articles sont variés, sourcés et fondés sur les faits de la saison', () => {
    const c = createCareer(BASE);
    c.settings.quarterMin = 3;
    for (let w = 0; w < 18; w++) {
      let f;
      while ((f = userFixture(c))) {
        if (w < 4) {
          const e = createMatch(c, f);
          e.runToEnd();
          finishMatch(c, f, e, false);
        } else simFixture(c, f);
      }
      advanceWeek(c);
    }
    const titles = c.news.map((n) => n.title);
    const kinds = new Set(c.news.map((n) => n.kind));
    console.log(titles.slice(0, 30).join('\n'));
    // Peu de titres répétés à l'identique
    expect(new Set(titles).size / titles.length).toBeGreaterThan(0.85);
    expect(kinds.size).toBeGreaterThanOrEqual(2);
    expect(c.news.filter((n) => n.source).length).toBeGreaterThan(5);
    // Un compte rendu cite le vrai score du match
    const f0 = c.world.fixtures.find((f) => f.userLine && f.week === 1 && f.stage === 'regular')!;
    expect(c.news.some((n) => n.kind === 'match' && (n.body.includes(`${f0.hs}-${f0.as}`) || n.body.includes(`${f0.as}-${f0.hs}`)))).toBe(true);
  });
});

describe('Draft APL', () => {
  it('classe les espoirs de 19 à 22 ans et sélectionne 24 joueurs, une seule fois chacun', () => {
    const c = createCareer(BASE);
    const board = draftBoard(c);
    expect(board.length).toBeGreaterThan(24);
    for (const x of board) {
      const a = c.world.season - x.p.birthYear;
      expect(a).toBeGreaterThanOrEqual(19);
      expect(a).toBeLessThanOrEqual(22);
      expect(c.world.clubs[x.p.clubId!].leagueId).not.toBe('APL');
    }
    expect(userProjection(c).eligible).toBe(false); // 18 ans : trop jeune
    c.phase = 'offseason';
    runDraft(c);
    const res = draftState(c).results[0];
    expect(res.picks.length).toBe(24);
    expect(new Set(res.picks.map((p) => p.playerId)).size).toBe(24);
    // Les choix du premier tour ont rejoint leur club américain
    for (const p of res.picks.slice(0, 12)) expect(c.world.players[p.playerId].clubId).toBe(p.toId);
    // Un joueur drafté ne réapparaît pas l'année suivante
    startNextSeason(c);
    const again = draftBoard(c).map((x) => x.p.id);
    for (const p of res.picks) expect(again).not.toContain(p.playerId);
    for (const cl of Object.values(c.world.clubs)) expect(cl.roster.length).toBeGreaterThanOrEqual(12);
  });

  it('un joueur incarné très prometteur est drafté et peut signer son contrat rookie', () => {
    const c = createCareer({ ...BASE, age: 18, seed: 77 });
    const u = user(c);
    u.birthYear -= 1; // 19 ans
    u.potential = 96;
    for (const k of Object.keys(u.attrs) as (keyof typeof u.attrs)[]) u.attrs[k] = Math.min(20, u.attrs[k] + 4);
    const pr = userProjection(c);
    expect(pr.eligible).toBe(true);
    expect(pr.rank).toBeGreaterThan(0);
    expect(pr.rank).toBeLessThanOrEqual(24);
    c.phase = 'offseason';
    runDraft(c);
    const st = draftState(c);
    expect(st.userDrafted).toBe(true);
    expect(st.rights).not.toBeNull();
    generateOffers(c);
    const offer = c.offers.find((o) => o.id.startsWith('draft'))!;
    expect(offer.clubId).toBe(st.rights!.clubId);
    acceptOffer(c, offer.id);
    expect(userClub(c).leagueId).toBe('APL');
    expect(draftState(c).rights).toBeNull();
    expect(c.trophies.some((t) => t.title.startsWith('Drafté'))).toBe(true);
  });
});
