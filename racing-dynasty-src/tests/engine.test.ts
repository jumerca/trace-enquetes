import { RaceSim, CAR_LEN, CAR_W } from '../src/engine/race';
import { forwardDist } from '../src/engine/track';
import { getTrack, TRACK_DEFS } from '../src/engine/tracks';
import { Rng } from '../src/engine/rng';
import type { CarEntry, RaceConfig } from '../src/engine/types';

function entries(seed = 1): CarEntry[] {
  const r = new Rng(seed);
  return Array.from({ length: 20 }, (_, i) => {
    const st = (b: number) => Math.round(Math.max(1, Math.min(20, b + r.normal(0, 2))));
    const lvl = 16 - Math.floor(i / 2) * 0.7;
    return {
      id: 'd' + i, name: 'Pilote ' + i, short: 'P' + i, number: i + 1, teamId: 't' + Math.floor(i / 2), teamName: 'T', color: '#f00', color2: '#fff',
      driver: { vitesse: st(lvl), regularite: st(12), depassement: st(12), defense: st(12), pneus: st(12), pluie: st(12), mental: st(12) },
      car: { moteur: st(lvl), aero: st(lvl), chassis: st(lvl), fiabilite: st(13) }, setup: { aileron: 55, suspension: 50, boite: 60 }, pitCrew: 12,
      startCompound: i % 3 === 0 ? 'T' : i % 3 === 1 ? 'M' : 'D', pitPlan: [{ lap: 5, compound: 'M' }], isPlayer: i < 2,
    } as CarEntry;
  });
}

const cfg = (trackId: string, seed: number, weather: 'sec' | 'pluie' = 'sec'): RaceConfig => ({ trackId, laps: 8, weather, seed, entries: entries() });

describe('circuits', () => {
  it('trois circuits fermés de longueur réaliste', () => {
    expect(TRACK_DEFS).toHaveLength(8);
    for (const d of TRACK_DEFS) {
      const t = getTrack(d.id);
      expect(t.length).toBeGreaterThan(2500);
      expect(t.length).toBeLessThan(7000);
      // la trajectoire idéale reste dans la piste
      for (let i = 0; i < t.n; i++) expect(Math.abs(t.line[i])).toBeLessThan(t.half);
    }
  });
});

describe('simulation de course', () => {
  it('est reproductible avec la même graine', () => {
    const a = new RaceSim(cfg('valbrune', 7));
    const b = new RaceSim(cfg('valbrune', 7));
    a.runToEnd();
    b.runToEnd();
    expect(a.results()).toEqual(b.results());
    expect(a.events).toEqual(b.events);
  });

  it('change avec une autre graine', () => {
    const a = new RaceSim(cfg('valbrune', 7));
    const b = new RaceSim(cfg('valbrune', 8));
    a.runToEnd();
    b.runToEnd();
    expect(JSON.stringify(a.results())).not.toEqual(JSON.stringify(b.results()));
  });

  it('rejoue à l’identique une course avec consignes enregistrées', () => {
    const a = new RaceSim(cfg('kharam', 3));
    for (let k = 0; k < 600; k++) a.step();
    a.issue({ carId: 'd0', type: 'mode', mode: 'attaque' });
    for (let k = 0; k < 300; k++) a.step();
    a.issue({ carId: 'd1', type: 'pit', compound: 'T' });
    a.runToEnd();
    const b = new RaceSim(cfg('kharam', 3), a.commands);
    b.runToEnd();
    expect(b.results()).toEqual(a.results());
  });

  for (const d of TRACK_DEFS) {
    it(`course complète sans chevauchement ni sortie arbitraire — ${d.id}`, () => {
      const sim = new RaceSim(cfg(d.id, 11));
      const t = sim.track;
      let overlaps = 0;
      const recentErr = new Map<string, number>();
      while (!sim.finished) {
        sim.step();
        const cs = sim.cars.filter((c) => c.status !== 'dnf');
        for (let a = 0; a < cs.length; a++)
          for (let b = a + 1; b < cs.length; b++) {
            const dd = forwardDist(t, cs[a].s, cs[b].s);
            if (Math.min(dd, t.length - dd) < CAR_LEN - 0.05 && Math.abs(cs[a].lat - cs[b].lat) < CAR_W) overlaps++;
          }
        for (const c of cs) {
          if (c.errKind >= 2) recentErr.set(c.id, sim.t);
          // hors de la piste seulement : stands, abandon, ou dans les 8 s qui suivent une erreur
          if (Math.abs(c.lat) > t.half + 0.3 && c.pit === 0 && c.status === 'run') {
            expect(sim.t - (recentErr.get(c.id) ?? -99)).toBeLessThan(8);
          }
        }
      }
      expect(overlaps).toBe(0);
      const res = sim.results();
      expect(res).toHaveLength(20);
      expect(res.filter((r) => r.status === 'arrivé').length).toBeGreaterThan(12);
      // positions 1..20 uniques, arrivés devant les abandons, ordre par tours puis temps
      expect(new Set(res.map((r) => r.position)).size).toBe(20);
      const fin = res.filter((r) => r.status === 'arrivé');
      for (let k = 1; k < fin.length; k++) {
        expect(fin[k].laps <= fin[k - 1].laps).toBe(true);
        if (fin[k].laps === fin[k - 1].laps) expect(fin[k].time).toBeGreaterThanOrEqual(fin[k - 1].time);
      }
      expect(res.slice(fin.length).every((r) => r.status === 'abandon')).toBe(true);
      expect(fin[0].laps).toBe(8);
      // tous les pilotes ont respecté l'arrêt prévu (sauf abandons précoces)
      expect(fin.every((r) => r.stops >= 1)).toBe(true);
    });
  }

  it('course sous la pluie en pneus pluie : se termine', () => {
    const c = cfg('valbrune', 5, 'pluie');
    c.entries.forEach((e) => { e.startCompound = 'P'; e.pitPlan = []; });
    const sim = new RaceSim(c);
    sim.runToEnd();
    expect(sim.finished).toBe(true);
    expect(sim.results()[0].status).toBe('arrivé');
  });

  it('aucune voiture ne bouge avant l’extinction des feux', () => {
    const sim = new RaceSim(cfg('valbrune', 4));
    const s0 = sim.cars.map((c) => c.s);
    while (sim.t < sim.lightsOut - 0.05) sim.step();
    expect(sim.cars.map((c) => c.s)).toEqual(s0);
    expect(sim.lightsOut).toBeGreaterThan(4);
    for (let k = 0; k < 30; k++) sim.step();
    expect(sim.cars.some((c, i) => c.s > s0[i])).toBe(true);
    expect(sim.events.some((e) => e.kind === 'depart')).toBe(true);
  });

  it('les consignes modifient le comportement (attaque use plus les pneus)', () => {
    const base = cfg('valbrune', 21);
    base.entries.forEach((e) => (e.pitPlan = []));
    const a = new RaceSim(base);
    const b = new RaceSim(base);
    b.issue({ carId: 'd5', type: 'mode', mode: 'attaque' });
    for (let k = 0; k < 2500; k++) { a.step(); b.step(); }
    expect(b.car('d5')!.wear).toBeGreaterThan(a.car('d5')!.wear);
  });
});
