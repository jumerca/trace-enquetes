import {
  createCareer, freeAgents, hireDriver, startWeekend, runQualifying, startRace, finishRace, closeWeekend, teamDrivers, playerTeam,
  seasonOver, startNextSeason, driverById, type Career, type CareerOptions,
} from '../src/game/career';
import {
  hireStaff, startProject, negotiateSponsor, sponsorLimit, signYouth, youthProspects, academyDrivers, setDriverRole, reserveDriver,
  checkInjuries, restoreStandIn, extendContract, extensionDemand, topBy, staffRating,
} from '../src/game/management';
import { driverRating } from '../src/game/data';
import { RaceSim } from '../src/engine/race';
import { SaveStore, MemoryKV } from '../src/game/save';

const opts: CareerOptions = {
  name: 'Écurie Test', short: 'TST', color: '#123456', color2: '#abcdef', emblem: 'etoile', base: 'Lyon', principal: 'Alex',
  difficulty: 'normale', budgetProfile: 'equilibre', raceLength: 'courte', seed: 4321,
};

function ready(): Career {
  const c = createCareer(opts);
  c.budget = 200; // tests : budget confortable
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

describe('personnel et R&D', () => {
  it('recruter un chef mécanicien change la qualité des arrêts', () => {
    const c = ready();
    const best = c.staffMarket!.filter((m) => m.role === 'mecanicien').sort((a, b) => b.rating - a.rating)[0];
    expect(hireStaff(c, best.id)).toBeNull();
    expect(playerTeam(c).pitCrew).toBe(best.rating);
    expect(staffRating(c, 'mecanicien')).toBe(best.rating);
  });

  it('un projet de R&D dure plusieurs GP puis se conclut', () => {
    const c = ready();
    const before = playerTeam(c).car.aero;
    expect(startProject(c, 'aero')).toBeNull();
    const dur = c.projects![0].duration;
    expect(dur).toBeGreaterThanOrEqual(1);
    expect(startProject(c, 'aero')).toMatch(/déjà/);
    for (let k = 0; k < dur; k++) {
      expect(c.projects).toHaveLength(1);
      playRound(c);
    }
    expect(c.projects).toHaveLength(0);
    expect(playerTeam(c).car.aero).toBeGreaterThanOrEqual(before);
    expect(c.news.some((n) => /aérodynamique|soufflerie|Percée/i.test(n.text))).toBe(true);
  });
});

describe('sponsors', () => {
  it('négociation : exigence excessive refusée puis rupture ; conditions raisonnables acceptées', () => {
    const c = ready();
    const offer = c.sponsorOffers.find((s) => s.minReputation === 0)!;
    const lim = sponsorLimit(c, offer, 1);
    expect(negotiateSponsor(c, offer.id, lim + 0.2, 1)).toMatch(/refuse/);
    expect(negotiateSponsor(c, offer.id, lim + 0.2, 1)).toMatch(/rompt/);
    expect(c.sponsorOffers.some((s) => s.id === offer.id)).toBe(false);
    const other = c.sponsorOffers.find((s) => s.minReputation === 0)!;
    expect(negotiateSponsor(c, other.id, 1.05, 3)).toBeNull();
    expect(c.sponsors[0].years).toBe(3);
    expect(c.sponsors[0].perRace).toBeCloseTo(other.perRace * 1.05, 1);
  });

  it('un contrat de 3 saisons continue la saison suivante', () => {
    const c = ready();
    const o = c.sponsorOffers.find((s) => s.minReputation === 0)!;
    negotiateSponsor(c, o.id, 1, 3);
    for (let r = 0; r < c.calendar.length; r++) playRound(c);
    expect(seasonOver(c)).toBe(true);
    startNextSeason(c);
    expect(c.sponsors).toHaveLength(1);
    expect(c.sponsors[0].years).toBe(2);
  }, 60000);
});

describe('pilotes', () => {
  it('académie : signature, progression, passage en réserve', () => {
    const c = ready();
    const y = youthProspects(c)[0];
    expect(signYouth(c, y.id)).toBeNull();
    expect(academyDrivers(c)).toHaveLength(1);
    const r0 = driverRating(y.stats);
    for (let k = 0; k < 4; k++) playRound(c);
    expect(driverRating(driverById(c, y.id).stats)).toBeGreaterThanOrEqual(r0);
    expect(setDriverRole(c, y.id, 'reserve')).toBeNull();
    expect(reserveDriver(c)?.id).toBe(y.id);
    expect(teamDrivers(c, c.playerTeamId)).toHaveLength(2); // la réserve ne court pas
  }, 60000);

  it('blessure : le réserviste remplace le titulaire puis lui rend sa place', () => {
    let found = false;
    for (let seed = 1; seed < 400 && !found; seed++) {
      const c = createCareer({ ...opts, seed });
      c.budget = 200;
      for (const d of freeAgents(c).slice(0, 2)) hireDriver(c, d.id, d.askSalary * 1.05, 2);
      const y = youthProspects(c)[0];
      signYouth(c, y.id);
      setDriverRole(c, y.id, 'reserve');
      startWeekend(c);
      const si = c.weekend!.standIn;
      if (!si) continue;
      found = true;
      expect(si.sub).toBe(y.id);
      expect(teamDrivers(c, c.playerTeamId).map((d) => d.id)).toContain(y.id);
      expect(teamDrivers(c, c.playerTeamId).map((d) => d.id)).not.toContain(si.injured);
      restoreStandIn(c, c.weekend!);
      expect(teamDrivers(c, c.playerTeamId).map((d) => d.id)).toContain(si.injured);
      expect(reserveDriver(c)?.id).toBe(y.id);
    }
    expect(found).toBe(true);
    void checkInjuries;
  });

  it('moral : évolue après une course ; prolongation selon les exigences', () => {
    const c = ready();
    const d = teamDrivers(c, c.playerTeamId)[0];
    playRound(c);
    expect(driverById(c, d.id).morale).not.toBe(65);
    const need = extensionDemand(d);
    expect(extendContract(c, d.id, need * 0.5, 1)).toMatch(/demande/);
    const yearsBefore = d.contract!.years;
    expect(extendContract(c, d.id, need * 1.1, 2)).toBeNull();
    expect(d.contract!.years).toBe(yearsBefore + 2);
  });
});

describe('intersaison et statistiques', () => {
  it('saison complète : transferts IA, grilles complètes, statistiques cohérentes, titres', () => {
    const c = ready();
    for (let r = 0; r < c.calendar.length; r++) playRound(c);
    const st = c.stats!;
    const wins = Object.values(st.drivers).reduce((a, l) => a + l.wins, 0);
    expect(wins).toBe(c.calendar.length);
    const poles = Object.values(st.drivers).reduce((a, l) => a + l.poles, 0);
    expect(poles).toBe(c.calendar.length);
    expect(Object.values(st.drivers).reduce((a, l) => a + l.titles, 0)).toBe(1);
    expect(topBy(c, 'drivers', 'wins', 3).length).toBeGreaterThan(0);
    startNextSeason(c);
    for (const t of c.teams.filter((x) => !x.isPlayer)) expect(teamDrivers(c, t.id)).toHaveLength(2);
    expect(c.drivers.filter((d) => d.age <= 19 && !d.teamId).length).toBeGreaterThanOrEqual(3);
    expect(c.staffMarket!.length).toBe(9);
  }, 90000);

  it('migration : une carrière V0.3 (schéma 2) reçoit personnel, R&D, statistiques', () => {
    const kv = new MemoryKV();
    const c = createCareer(opts) as any;
    delete c.staff; delete c.staffMarket; delete c.projects; delete c.stats; delete c.sponsorTalks;
    c.drivers = c.drivers.filter((d: any) => d.age > 19);
    for (const d of c.drivers) { delete d.morale; delete d.potential; }
    kv.setItem('racing-dynasty/save/0', JSON.stringify({ app: 'racing-dynasty', schema: 2, gameVersion: '0.3.0', savedAt: new Date().toISOString(), career: c }));
    const loaded = new SaveStore(kv).load(0)!;
    expect(loaded.staff?.mecanicien.rating).toBe(loaded.teams.find((t) => t.isPlayer)!.pitCrew);
    expect(loaded.projects).toEqual([]);
    expect(loaded.stats).toBeDefined();
    expect(loaded.drivers.filter((d) => d.age <= 19).length).toBe(6);
    expect(loaded.drivers.every((d) => typeof d.morale === 'number')).toBe(true);
  });
});
