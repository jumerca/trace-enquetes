import {
  createCareer, freeAgents, hireDriver, signSponsor, startWeekend, practiceRun, runQualifying, startRace, finishRace,
  closeWeekend, driverStandings, teamStandings, teamDrivers, playerTeam, canRace, setSetup, setStrategy, seasonOver,
  startNextSeason, buyUpgrade, raceConfig, recordRaceProgress, availableSponsors, releaseDriver, POINTS,
  type Career, type CareerOptions,
} from '../src/game/career';
import { RaceSim } from '../src/engine/race';
import { SaveStore, MemoryKV } from '../src/game/save';

const opts: CareerOptions = {
  name: 'Écurie Test', short: 'TST', color: '#123456', color2: '#abcdef', emblem: 'etoile', base: 'Lyon', principal: 'Alex',
  difficulty: 'normale', budgetProfile: 'equilibre', raceLength: 'courte', seed: 1234,
};

function hireTwo(c: Career) {
  for (const d of freeAgents(c)) {
    if (teamDrivers(c, c.playerTeamId).length >= 2) break;
    hireDriver(c, d.id, d.askSalary * 1.05, 2);
  }
}

function playRound(c: Career): void {
  expect(startWeekend(c)).toBeNull();
  const mine = teamDrivers(c, c.playerTeamId);
  for (const d of mine) {
    setSetup(c, d.id, { aileron: 60, suspension: 45, boite: 60 });
    const run = practiceRun(c, d.id);
    expect(typeof run).toBe('object');
  }
  const q = runQualifying(c);
  expect(Array.isArray(q) && q.length).toBe(20);
  setStrategy(c, mine[0].id, { start: 'M', plan: [{ lap: 3, compound: 'D' }] });
  const cfg = startRace(c);
  expect(typeof cfg).toBe('object');
  const sim = new RaceSim(cfg as any);
  sim.runToEnd();
  finishRace(c, sim.results(), sim.fastest);
  closeWeekend(c);
}

describe('création de carrière', () => {
  it('crée 10 écuries, 28 pilotes dont 10 libres, 3 Grands Prix', () => {
    const c = createCareer(opts);
    expect(c.teams).toHaveLength(10);
    expect(c.drivers.filter((d) => d.teamId)).toHaveLength(18);
    expect(freeAgents(c)).toHaveLength(10);
    expect(c.calendar).toHaveLength(3);
    expect(playerTeam(c).name).toBe('Écurie Test');
    expect(c.budget).toBe(30);
    expect(canRace(c)).not.toBeNull();
  });

  it('recrutement : refus sous le salaire demandé, prime déduite, max 2 pilotes', () => {
    const c = createCareer(opts);
    const d = freeAgents(c)[0];
    expect(hireDriver(c, d.id, d.askSalary * 0.5, 1)).toMatch(/refuse/);
    const before = c.budget;
    expect(hireDriver(c, d.id, d.askSalary, 2)).toBeNull();
    expect(c.budget).toBeLessThan(before);
    hireTwo(c);
    expect(teamDrivers(c, c.playerTeamId)).toHaveLength(2);
    const third = freeAgents(c)[0];
    expect(hireDriver(c, third.id, third.askSalary * 2, 1)).toMatch(/deux pilotes/);
    expect(canRace(c)).toBeNull();
    // libérer puis re-recruter
    expect(releaseDriver(c, d.id)).toBeNull();
    expect(teamDrivers(c, c.playerTeamId)).toHaveLength(1);
  });

  it('sponsors : deux emplacements, réputation requise', () => {
    const c = createCareer(opts);
    const rich = c.sponsorOffers.find((s) => s.minReputation > 50)!;
    expect(signSponsor(c, rich.id)).toMatch(/réputation/);
    const ok = availableSponsors(c).filter((s) => s.minReputation <= playerTeam(c).reputation);
    expect(signSponsor(c, ok[0].id)).toBeNull();
    expect(signSponsor(c, ok[1].id)).toBeNull();
    expect(signSponsor(c, ok[2].id)).toMatch(/emplacements/);
  });

  it('évolutions de voiture payantes', () => {
    const c = createCareer(opts);
    const lvl = playerTeam(c).car.aero;
    expect(buyUpgrade(c, 'aero')).toBeNull();
    expect(playerTeam(c).car.aero).toBe(lvl + 1);
  });
});

describe('boucle complète', () => {
  it('saison entière : points, classements cohérents, finances', () => {
    const c = createCareer(opts);
    hireTwo(c);
    signSponsor(c, availableSponsors(c).find((s) => s.minReputation === 0)!.id);
    for (let r = 0; r < 3; r++) playRound(c);
    expect(c.results).toHaveLength(3);
    expect(seasonOver(c)).toBe(true);
    const ds = driverStandings(c);
    const total = ds.reduce((a, s) => a + s.points, 0);
    // 3 courses × 101 points (si au moins 10 arrivants à chaque fois)
    const expected = c.results.reduce((a, r) => a + r.entries.filter((e) => e.status === 'arrivé').slice(0, 10).reduce((x, _e, i) => x + POINTS[i], 0), 0);
    expect(total).toBe(expected);
    for (let k = 1; k < ds.length; k++) expect(ds[k].points).toBeLessThanOrEqual(ds[k - 1].points);
    const ts = teamStandings(c);
    expect(ts).toHaveLength(10);
    expect(ts.reduce((a, s) => a + s.points, 0)).toBe(total);
    expect(c.history).toHaveLength(1);
    expect(c.ledger.length).toBeGreaterThan(10);
    startNextSeason(c);
    expect(c.season).toBe(2);
    expect(c.results).toHaveLength(0);
  });

  it('même graine de carrière → mêmes résultats', () => {
    const run = () => {
      const c = createCareer(opts);
      hireTwo(c);
      playRound(c);
      return c.results[0].entries.map((e) => e.driverId + e.position).join();
    };
    expect(run()).toBe(run());
  });
});

describe('sauvegardes', () => {
  it('sauvegarde, recharge, reprend une course en cours à l’identique', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    const c = createCareer(opts);
    hireTwo(c);
    startWeekend(c);
    runQualifying(c);
    const cfg = startRace(c) as any;
    const sim = new RaceSim(cfg);
    for (let k = 0; k < 800; k++) sim.step();
    sim.issue({ carId: teamDrivers(c, c.playerTeamId)[0].id, type: 'mode', mode: 'attaque' });
    for (let k = 0; k < 200; k++) sim.step();
    recordRaceProgress(c, sim.commands, sim.tick);
    store.save(0, c);

    const loaded = new SaveStore(kv).load(0)!;
    expect(loaded.weekend?.phase).toBe('course');
    const sim2 = new RaceSim(raceConfig(loaded), loaded.weekend!.race!.commands);
    while (sim2.tick < loaded.weekend!.race!.tick) sim2.step();
    expect(sim2.cars.map((x) => x.s)).toEqual(sim.cars.map((x) => x.s));
    sim.runToEnd();
    sim2.runToEnd();
    expect(sim2.results()).toEqual(sim.results());
  });

  it('copie de secours si la sauvegarde principale est corrompue, liste des emplacements', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    const c = createCareer(opts);
    store.save(1, c);
    c.budget = 99;
    store.save(1, c);
    kv.setItem('racing-dynasty/save/1', '{corrompu');
    expect(store.load(1)!.budget).toBe(30);
    expect(store.list()[1].corrupted).toBe(true);
    expect(store.list()[0].empty).toBe(true);
  });

  it('export / import et refus d’un fichier étranger', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    const c = createCareer(opts);
    store.save(0, c);
    const txt = store.exportText(0)!;
    const imported = store.importText(2, txt);
    expect(imported.id).toBe(c.id);
    expect(() => store.importText(2, '{"app":"autre"}')).toThrow();
    expect(store.lastSlot()).toBe(2);
  });
});
