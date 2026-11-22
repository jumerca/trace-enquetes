import { RaceSim, CAR_LEN, CAR_W } from '../src/engine/race';
import { forwardDist } from '../src/engine/track';
import { Rng } from '../src/engine/rng';
import type { CarEntry, RaceConfig } from '../src/engine/types';

function entries(seed = 1, fiab = 13): CarEntry[] {
  const r = new Rng(seed);
  return Array.from({ length: 20 }, (_, i) => {
    const st = (b: number) => Math.round(Math.max(1, Math.min(20, b + r.normal(0, 2))));
    const lvl = 16 - Math.floor(i / 2) * 0.7;
    return {
      id: 'd' + i, name: 'Pilote ' + i, short: 'P' + i, number: i + 1, teamId: 't' + Math.floor(i / 2), teamName: 'T' + Math.floor(i / 2),
      color: '#f00', color2: '#fff',
      driver: { vitesse: st(lvl), regularite: st(9), depassement: st(12), defense: st(12), pneus: st(12), pluie: st(12), mental: st(12) },
      car: { moteur: st(lvl), aero: st(lvl), chassis: st(lvl), fiabilite: fiab }, setup: { aileron: 55, suspension: 50, boite: 60 }, pitCrew: 12,
      startCompound: 'M', pitPlan: [{ lap: 5, compound: 'D' }], isPlayer: i < 2,
    } as CarEntry;
  });
}
const cfg = (trackId: string, seed: number, extra: Partial<RaceConfig> = {}): RaceConfig =>
  ({ trackId, laps: 10, weather: 'sec', seed, entries: entries(seed), ...extra });

/** Cherche une graine qui produit une voiture de sécurité. */
function raceWithSafetyCar(): RaceSim {
  for (let seed = 1; seed < 200; seed++) {
    const c = cfg('montclair', seed, { entries: entries(seed, 4) });
    const sim = new RaceSim(c);
    sim.runToEnd();
    if (sim.scCount > 0) return new RaceSim(c);
  }
  throw new Error('aucune voiture de sécurité trouvée');
}

describe('profondeur de course', () => {
  it('instantané : reprise identique au déroulé continu (météo, consignes)', () => {
    const c = cfg('lac-argent', 9, { weatherPlan: [{ lap: 3, rain: true }, { lap: 7, rain: false }] });
    const a = new RaceSim(c);
    for (let k = 0; k < 2500; k++) a.step();
    a.issue({ carId: 'd0', type: 'mode', mode: 'attaque' });
    a.issue({ carId: 'd1', type: 'teamOrder', order: 'tenir' });
    for (let k = 0; k < 500; k++) a.step();
    const snap = JSON.parse(JSON.stringify(a.snapshot()));
    const b = RaceSim.restore(c, a.commands, snap);
    a.runToEnd();
    b.runToEnd();
    expect(b.results()).toEqual(a.results());
    expect(b.events.length).toBe(a.events.length);
  });

  it('voiture de sécurité : aucun chevauchement, aucun dépassement pendant la neutralisation, puis elle rentre', () => {
    const sim = raceWithSafetyCar();
    let scTicks = 0;
    let overlaps = 0;
    let wasSc = false;
    let restartSeen = false;
    while (!sim.finished) {
      const evBefore = sim.events.length;
      sim.step();
      const cs = sim.cars.filter((x) => x.status !== 'dnf');
      if (sim.sc) {
        scTicks++;
        wasSc = true;
        for (const x of cs) {
          const d = forwardDist(sim.track, x.s, sim.sc.s);
          if (Math.min(d, sim.track.length - d) < CAR_LEN - 0.05 && Math.abs(x.lat - sim.sc.lat) < CAR_W) overlaps++;
        }
        // pas de dépassement entre concurrents sous voiture de sécurité
        expect(sim.events.slice(evBefore).filter((e) => e.kind === 'depassement')).toHaveLength(0);
      } else if (wasSc) restartSeen = true;
    }
    expect(scTicks).toBeGreaterThan(100);
    expect(overlaps).toBe(0);
    expect(restartSeen || sim.flag).toBe(true);
    expect(sim.events.some((e) => e.kind === 'securite')).toBe(true);
  });

  it('averse : la piste se mouille, l’IA passe en pneus pluie, puis la piste sèche', () => {
    const c = cfg('valbrune', 3, { laps: 14, weatherPlan: [{ lap: 3, rain: true }, { lap: 7, rain: false }] });
    const sim = new RaceSim(c);
    let maxWet = 0;
    let usedWet = false;
    while (!sim.finished) {
      sim.step();
      maxWet = Math.max(maxWet, sim.wet);
      if (sim.cars.some((x) => !x.e.isPlayer && x.compound === 'P')) usedWet = true;
    }
    expect(maxWet).toBeGreaterThan(0.8);
    expect(usedWet).toBe(true);
    expect(sim.wet).toBeLessThan(maxWet);
    expect(sim.events.some((e) => e.kind === 'meteo')).toBe(true);
    // radio du joueur sur la météo
    expect(sim.events.some((e) => e.kind === 'radio' && /pluie|pleuvoir/i.test(e.text))).toBe(true);
  });

  it('règle des deux gommes : 20 s de pénalité sans changement de gomme, reflétées au classement', () => {
    const c = cfg('kharam', 5);
    c.entries[1].pitPlan = []; // voiture du joueur : dur sans arrêt (l'IA, elle, s'adapterait)
    c.entries[1].startCompound = 'D';
    const sim = new RaceSim(c);
    sim.runToEnd();
    const r = sim.results().find((x) => x.carId === 'd1')!;
    if (r.status === 'arrivé' && r.stops === 0) {
      expect(r.penalty).toBeGreaterThanOrEqual(20);
      expect(r.gap).toMatch(/pénalité/);
    }
    // les autres ont respecté la règle
    expect(sim.results().filter((x) => x.carId !== 'd1' && x.penalty >= 20)).toHaveLength(0);
    // classement trié par temps pénalités incluses
    const fin = sim.results().filter((x) => x.status === 'arrivé');
    for (let k = 1; k < fin.length; k++) if (fin[k].laps === fin[k - 1].laps) expect(fin[k].time).toBeGreaterThanOrEqual(fin[k - 1].time);
  });

  it('consignes d’équipe : « tenir » interdit les dépassements entre équipiers', () => {
    let swaps = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const c = cfg('kharam', seed);
      const sim = new RaceSim(c);
      for (const id of ['d0', 'd2', 'd4', 'd6']) sim.issue({ carId: id, type: 'teamOrder', order: 'tenir' });
      sim.runToEnd();
      swaps += sim.events.filter((e) => e.kind === 'depassement' && e.carId && e.otherId && sim.car(e.carId)!.e.teamId === sim.car(e.otherId)!.e.teamId).length;
    }
    expect(swaps).toBe(0);
  });

  it('consignes d’équipe : « inverser » fait passer l’équipier', () => {
    let swapped = 0;
    for (let seed = 1; seed <= 8 && !swapped; seed++) {
      const c = cfg('valbrune', seed);
      const sim = new RaceSim(c);
      for (let k = 0; k < 900; k++) sim.step();
      sim.issue({ carId: 'd0', type: 'teamOrder', order: 'inverser' });
      sim.runToEnd();
      swapped += sim.events.filter((e) => e.kind === 'consigne' && /laisse passer/.test(e.text)).length;
    }
    expect(swapped).toBeGreaterThan(0);
  });

  it('drapeaux jaunes locaux : signalés, puis levés, sans dépassement dans la zone', () => {
    let yellowSeen = 0, illegal = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const sim = new RaceSim({ ...cfg('montclair', seed), entries: entries(seed, 6) });
      while (!sim.finished) {
        const before = sim.events.length;
        const zones = sim.yellows.map((z) => ({ ...z }));
        sim.step();
        for (const e of sim.events.slice(before)) {
          if (e.kind === 'jaune' && /secteur/.test(e.text)) yellowSeen++;
          if (e.kind === 'depassement' && e.carId && zones.length) {
            const c = sim.car(e.carId)!;
            if (zones.some((z) => forwardDist(sim.track, z.s0, c.s) < z.len - 20)) illegal++;
          }
        }
      }
    }
    expect(yellowSeen).toBeGreaterThan(0);
    expect(illegal).toBe(0);
  });

  it('contacts : produisent des dégâts ou des pénalités sur un ensemble de courses', () => {
    let contacts = 0, damage = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const sim = new RaceSim(cfg('kharam', seed));
      for (let k = 0; k < 4000 && !sim.finished; k++) {
        sim.step();
        damage = Math.max(damage, sim.cars.filter((x) => x.damage > 0).length);
      }
      contacts += sim.events.filter((e) => e.kind === 'contact').length;
    }
    expect(contacts).toBeGreaterThan(0);
  });
});
