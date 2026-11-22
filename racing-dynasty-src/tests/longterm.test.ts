import {
  createCareer, freeAgents, hireDriver, startWeekend, runQualifying, startRace, finishRace, closeWeekend, teamDrivers, playerTeam,
  canRace, type Career, type CareerOptions,
} from '../src/game/career';
import {
  facilities, startFacilityUpgrade, maxProjects, projectTerms, director, directorSeasonReview, switchTeam, declineOffers,
  updateRivalries, mainRival, facilityUpkeep,
} from '../src/game/management';
import { RaceSim } from '../src/engine/race';
import { SaveStore, MemoryKV, SAVE_SCHEMA } from '../src/game/save';

const opts: CareerOptions = {
  name: 'Écurie Durable', short: 'DUR', color: '#224466', color2: '#ffcc00', emblem: 'etoile', base: 'Lyon', principal: 'Alex',
  difficulty: 'normale', budgetProfile: 'equilibre', raceLength: 'courte', seed: 99,
};

function ready(): Career {
  const c = createCareer(opts);
  c.budget = 200;
  for (const d of freeAgents(c)) {
    if (teamDrivers(c, c.playerTeamId).length >= 2) break;
    hireDriver(c, d.id, d.askSalary * 1.05, 2);
  }
  return c;
}

function playRound(c: Career): void {
  startWeekend(c);
  runQualifying(c);
  const sim = new RaceSim(startRace(c) as any);
  sim.runToEnd();
  finishRace(c, sim.results(), sim.fastest, sim.events);
  closeWeekend(c);
}

describe('carrière sur le long terme', () => {
  it('installations : chantier sur plusieurs GP, puis effets (projets en parallèle, chances de R&D, entretien)', () => {
    const c = ready();
    const f = facilities(c);
    expect(maxProjects(c)).toBe(2);
    const chance0 = projectTerms(c, 'moteur').chance;
    const upkeep0 = facilityUpkeep(c);
    const budget = c.budget;
    expect(startFacilityUpgrade(c, 'usine')).toBeNull();
    expect(c.budget).toBeLessThan(budget);
    expect(startFacilityUpgrade(c, 'soufflerie')).toMatch(/chantier/);
    const left = f.building!.left;
    for (let k = 0; k < left; k++) playRound(c);
    expect(f.usine).toBe(3);
    expect(f.building).toBeUndefined();
    expect(projectTerms(c, 'moteur').chance).toBeGreaterThan(chance0 - 0.05); // le niveau de la voiture peut aussi avoir changé
    expect(facilityUpkeep(c)).toBeGreaterThan(upkeep0);
    f.usine = 4;
    expect(maxProjects(c)).toBe(3);
  }, 60000);

  it('presse et rivalités : un article par GP, les duels créent des rivalités', () => {
    const c = ready();
    playRound(c);
    playRound(c);
    expect(c.press!.length).toBe(2);
    expect(c.press![0].round).toBe(2);
    expect(c.press![0].title.length).toBeGreaterThan(5);
    const me = teamDrivers(c, c.playerTeamId)[0];
    const other = c.drivers.find((d) => d.teamId && d.teamId !== c.playerTeamId)!;
    updateRivalries(c, [
      { t: 1, lap: 1, kind: 'contact', text: '', carId: me.id, otherId: other.id },
      { t: 2, lap: 2, kind: 'contact', text: '', carId: other.id, otherId: me.id },
    ] as any);
    expect(mainRival(c, me.id)?.id).toBe(other.id);
  }, 60000);

  it('directeur : limogé après une saison catastrophique, puis repris par une autre écurie', () => {
    const c = ready();
    const dir = director(c);
    dir.confidence = 20;
    directorSeasonReview(c, 10);
    expect(dir.fired).toBe(true);
    expect(canRace(c)).toMatch(/limogé/);
    expect(dir.offers.length).toBeGreaterThan(0);
    const old = c.playerTeamId;
    const target = dir.offers[0].teamId;
    expect(switchTeam(c, target)).toBeNull();
    expect(c.playerTeamId).toBe(target);
    expect(playerTeam(c).isPlayer).toBe(true);
    expect(c.teams.find((t) => t.id === old)!.isPlayer).toBe(false);
    expect(dir.fired).toBe(false);
    expect(teamDrivers(c, c.playerTeamId)).toHaveLength(2); // les titulaires de la nouvelle écurie
    playRound(c); // on peut courir avec la nouvelle écurie
    expect(c.results.length).toBe(1);
  }, 60000);

  it('directeur : une grande écurie le débauche après une saison réussie ; refuser rassure les actionnaires', () => {
    const c = ready();
    const dir = director(c);
    dir.confidence = 72;
    directorSeasonReview(c, 1);
    expect(dir.fired).toBe(false);
    expect(dir.offers.length).toBe(1);
    const conf = dir.confidence;
    declineOffers(c);
    expect(dir.offers).toEqual([]);
    expect(dir.confidence).toBeGreaterThan(conf);
  });

  it('migration : une carrière V0.6 (schéma 3) reçoit installations, directeur et presse', () => {
    const kv = new MemoryKV();
    const c = createCareer(opts) as any;
    delete c.facilities; delete c.director; delete c.press; delete c.rivalries;
    kv.setItem('racing-dynasty/save/0', JSON.stringify({ app: 'racing-dynasty', schema: 3, gameVersion: '0.6.0', savedAt: new Date().toISOString(), career: c }));
    const loaded = new SaveStore(kv).load(0)!;
    expect(SAVE_SCHEMA).toBe(4);
    expect(loaded.facilities).toEqual({ soufflerie: 2, simulateur: 2, usine: 2 });
    expect(loaded.director?.confidence).toBe(60);
    expect(loaded.press).toEqual([]);
  });
});
