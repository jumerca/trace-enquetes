import { describe, expect, it } from 'vitest';
import { newGame, Sim, dayOf } from '../src/sim/sim';
import { build, buildPath, buyLot, canBuyLot, checkBuild, createOrder, demolish } from '../src/sim/actions';
import { findPath } from '../src/nav/astar';
import { deserialize, serialize } from '../src/save/save';
import { doorOf, footprint } from '../src/sim/geom';
import { BUILDINGS, CROPS, RES_IDS, RESOURCES } from '../src/data/content';
import { REGIONS, regionBuildings } from '../src/data/regions';
import { T, isWater } from '../src/world/terrain';

const run = (sim: Sim, minutes: number) => {
  for (let i = 0; i < minutes; i++) sim.tick();
};
const sum = (o: Record<string, number | undefined>) => Object.values(o).reduce((a: number, b) => a + (b ?? 0), 0);

/** Premier emplacement valide près de la ferme (spirale). */
function spot(sim: Sim, type: string): [number, number, 0 | 1] | null {
  const [cx, cy] = sim.s.world.farm;
  for (let r = 0; r < 24; r++)
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        for (const rot of [0, 1] as const) if (checkBuild(sim, type, cx + dx, cy + dy, rot).ok) return [cx + dx, cy + dy, rot];
      }
  return null;
}
const place = (sim: Sim, type: string) => {
  const p = spot(sim, type);
  return p ? build(sim, type, ...p) : null;
};

describe('régions', () => {
  it.each(REGIONS.map((r) => r.id))('%s : partie jouable dès le départ', (id) => {
    const sim = new Sim(newGame(11, id));
    const s = sim.s;
    expect(s.world.w).toBe(256);
    expect(s.buildings.length).toBeGreaterThanOrEqual(5);
    // tous les bâtiments de départ sont autorisés dans la région et accessibles depuis la maison
    const home = doorOf(s.buildings[0]);
    for (const b of s.buildings) {
      if (b.type !== 'maison') expect(regionBuildings(sim.region).has(b.type)).toBe(true);
      const d = BUILDINGS[b.type].kind === 'atelier' || BUILDINGS[b.type].kind === 'stock' || BUILDINGS[b.type].kind === 'boutique' ? doorOf(b) : sim.gateOf(b);
      expect(findPath(256, 256, home[0], home[1], d[0], d[1], sim.cost('worker'))).not.toBeNull();
    }
    // la route mène du bord de la carte au parking
    expect(s.world.parking.length).toBeGreaterThan(0);
    expect(findPath(256, 256, ...s.world.entry, ...s.world.parking[0], sim.cost('vehicle'))).not.toBeNull();
    run(sim, 3 * 1440);
    expect(sum(s.stats.harvested)).toBeGreaterThan(10);
    expect(s.stats.batches).toBeGreaterThan(0);
    expect(s.stats.visitors).toBeGreaterThan(0);
  });

  it('le bord de mer a la mer, la montagne a du relief, la Beauce est plate', () => {
    const mer = newGame(3, 'mer').world;
    expect(Array.from(mer.terrain).filter((t) => t === T.mer).length).toBeGreaterThan(5000);
    const relief = (id: string) => {
      const w = newGame(3, id).world;
      return Math.max(...w.height) - Math.min(...w.height);
    };
    expect(relief('montagne')).toBeGreaterThan(3 * relief('beauce'));
  });

  it('les productions dépendent de la région', () => {
    const sim = new Sim(newGame(5, 'nord'));
    expect(checkBuild(sim, 'champ_lavande', sim.s.world.farm[0], sim.s.world.farm[1] + 10, 0).reason).toBe('Non adapté à cette région');
    expect(spot(sim, 'champ_betterave')).not.toBeNull();
  });
});

describe('simulation', () => {
  it('est reproductible à graine égale sur 30 jours', () => {
    const a = new Sim(newGame(42));
    const b = new Sim(newGame(42));
    run(a, 30 * 1440);
    run(b, 30 * 1440);
    expect(a.s.money).toBe(b.s.money);
    expect(JSON.stringify(a.s.stats)).toBe(JSON.stringify(b.s.stats));
    expect(dayOf(a.s.minute)).toBe(30);
  });

  it('boucle pommes → jus → boutique avec ventes réelles', () => {
    const sim = new Sim(newGame(7, 'limousin'));
    run(sim, 3 * 1440);
    const st = sim.s.stats;
    expect(st.harvested.pommes ?? 0).toBeGreaterThan(20);
    expect(st.produced.jus ?? 0).toBeGreaterThan(10);
    expect(sum(st.sold)).toBeGreaterThan(0);
  });

  it('conservation de la matière (pommes et jus)', () => {
    const sim = new Sim(newGame(3, 'limousin'));
    const total = (r: string) =>
      sim.s.buildings.reduce((a, b) => a + (b.inv[r] ?? 0), 0) + sim.s.workers.reduce((a, w) => a + (w.carry?.res === r ? w.carry.qty : 0), 0);
    const p0 = total('pommes'), j0 = total('jus');
    run(sim, 2 * 1440 + 300);
    const s = sim.s.stats;
    const batches = (s.produced.jus ?? 0) / 5;
    expect(total('pommes')).toBeCloseTo(p0 + (s.harvested.pommes ?? 0) - batches * 8 - (s.sold.pommes ?? 0), 1);
    expect(total('jus')).toBeCloseTo(j0 + (s.produced.jus ?? 0) - (s.sold.jus ?? 0), 1);
  });

  it('salaires et entretien imputés chaque jour, ventilés par activité', () => {
    const sim = new Sim(newGame(5, 'limousin'));
    run(sim, 1440 + 1);
    const day0 = sim.s.ledger.find((l) => l.day === 0)!;
    expect(sum(day0.cost)).toBeGreaterThanOrEqual(72 + 80 + 12 + 8 + 6 + 7 + 4);
    expect(day0.lines.some((l) => l.label.startsWith('Salaires'))).toBe(true);
    expect(day0.cost.verger ?? 0).toBeGreaterThan(0);
  });

  it('aucune vente sans stock (négociant) et camionnette qui vient charger', () => {
    const sim = new Sim(newGame(1, 'limousin'));
    expect(createOrder(sim, 'fromage_chevre', 5)).toBe(false);
    expect(createOrder(sim, 'jus', 999)).toBe(false);
    const before = sim.stockOf('jus');
    expect(createOrder(sim, 'jus', 5)).toBe(true);
    expect(sim.stockOf('jus')).toBe(before - 5);
    const money = sim.s.money;
    run(sim, 700);
    expect(sim.s.orders[0].status).toBe('livrée');
    expect(sim.s.money).not.toBe(money);
  });

  it('capacité de grange respectée', () => {
    const sim = new Sim(newGame(9, 'limousin'));
    sim.storages()[0].inv = { pommes: 490 };
    sim.s.buildings.find((b) => b.type === 'verger_pommier')!.ready = 140;
    run(sim, 600);
    for (const b of sim.storages()) expect(sim.used(b)).toBeLessThanOrEqual(BUILDINGS[b.type].capacite!);
  });

  it('les ateliers ne produisent pas sans intrants', () => {
    const sim = new Sim(newGame(11, 'limousin'));
    // aucun intrant : stocks vides et plus aucune source de pommes
    sim.s.buildings = sim.s.buildings.filter((b) => !b.type.startsWith('verger'));
    sim.refresh();
    for (const b of sim.s.buildings) b.inv = {};
    run(sim, 600);
    expect(sim.s.stats.batches).toBe(0);
  });

  it('constructions invalides refusées', () => {
    const sim = new Sim(newGame(2, 'limousin'));
    const W = sim.s.world;
    const water = Array.from(W.terrain).findIndex((t, i) => isWater(t) && W.owned[Math.floor(Math.floor(i / 256) / 16) * 16 + Math.floor((i % 256) / 16)]);
    if (water >= 0) expect(checkBuild(sim, 'pressoir', water % 256, Math.floor(water / 256), 0).ok).toBe(false);
    expect(checkBuild(sim, 'pressoir', 5, 5, 0).reason).toMatch(/non acquis|région|eau|Sol|chemin|plage|rocheux/);
    const m = sim.s.buildings[0];
    expect(checkBuild(sim, 'pressoir', m.x, m.y, 0).ok).toBe(false);
    expect(checkBuild(sim, 'maison', m.x + 20, m.y, 0).ok).toBe(false);
    sim.s.money = 10;
    expect(spot(sim, 'champ_ble')).toBeNull();
  });

  it('élevage caprin : animaux, collecte et fromage', () => {
    const sim = new Sim(newGame(4, 'limousin'));
    const pen = place(sim, 'elevage_chevres');
    expect(pen).not.toBeNull();
    expect(sim.s.animals.filter((a) => a.pen === pen!.id).length).toBe(6);
    expect(place(sim, 'fromagerie')).not.toBeNull();
    sim.hire('eleveur');
    sim.hire('artisan');
    run(sim, 3 * 1440);
    expect(sim.s.stats.harvested.lait_chevre ?? 0).toBeGreaterThan(20);
    expect(sim.s.stats.produced.fromage_chevre ?? 0).toBeGreaterThan(0);
  });

  it('champ de blé mécanisé : labour → semis → pousse → moissonneuse → grange ; engins rentrés', () => {
    const sim = new Sim(newGame(6, 'beauce'));
    sim.s.money = 90000;
    const champ = sim.s.buildings.find((b) => b.type === 'champ_ble')!;
    expect(champ.phase).toBe('mur');
    expect(sim.s.vehicles.filter((v) => v.kind === 'tracteur' || v.kind === 'moissonneuse').length).toBe(2);
    run(sim, 1440);
    expect(sim.s.stats.harvested.ble ?? 0).toBeGreaterThan(120);
    // après la moisson : labour puis semis au tracteur
    run(sim, 2 * 1440);
    expect(['pousse', 'mur']).toContain(champ.phase);
    expect(sim.s.ledger.some((l) => l.lines.some((x) => x.label.startsWith('Semences')))).toBe(true);
    for (const v of sim.s.vehicles.filter((v) => v.kind === 'tracteur' || v.kind === 'moissonneuse')) {
      expect(v.driver).toBeNull();
      expect([Math.round(v.x), Math.round(v.y)]).toEqual(doorOf(sim.byId.get(v.home)!));
    }
    expect(sim.s.stats.produced.farine ?? 0).toBeGreaterThan(0);
  });

  it('champ sans engin : travaux à la main (plus lents)', () => {
    const sim = new Sim(newGame(6, 'limousin'));
    sim.s.money = 90000;
    const f = place(sim, 'champ_ble')!;
    expect(f.phase).toBe('labour');
    run(sim, 3 * 1440);
    expect(['semis', 'pousse']).toContain(f.phase);
  });

  it('visiteurs : arrivée en voiture, stationnement, départ', () => {
    const sim = new Sim(newGame(12, 'provence'));
    let maxCars = 0, parked = 0;
    for (let i = 0; i < 1440; i++) {
      sim.tick();
      const cars = sim.s.vehicles.filter((v) => v.kind === 'voiture');
      maxCars = Math.max(maxCars, cars.length);
      parked = Math.max(parked, cars.filter((c) => c.label === 'Garée').length);
    }
    expect(maxCars).toBeGreaterThan(0);
    expect(parked).toBeGreaterThan(0);
    expect(sim.s.vehicles.filter((v) => v.kind === 'voiture').length).toBeLessThan(maxCars + 1);
    expect(sim.s.stats.visitors).toBeGreaterThan(3);
  });

  it('les véhicules contournent le décor et restent sur les voies', () => {
    const sim = new Sim(newGame(6, 'limousin'));
    const [cx, cy] = sim.s.world.farm;
    const c = sim.cost('vehicle');
    expect(c(cx + 3, cy)).toBe(Infinity); // puits
    expect(c(cx + 7, cy + 1)).toBe(Infinity); // charrette
    expect(c(cx + 2, cy)).toBe(1);
    expect(c(cx, cy + 20)).toBe(Infinity); // pas à travers champs
  });

  it('démolition et chemins', () => {
    const sim = new Sim(newGame(8, 'limousin'));
    sim.s.money = 50000;
    const b = place(sim, 'champ_ble')!;
    expect(demolish(sim, b.id)).toBe(true);
    expect(sim.occ[b.y * 256 + b.x]).toBe(-1);
    expect(demolish(sim, sim.s.buildings[0].id)).toBe(false);
    const [cx, cy] = sim.s.world.farm;
    let ok = false;
    for (let d = 3; d < 20 && !ok; d++) ok = buildPath(sim, cx - d, cy + 4);
    expect(ok).toBe(true);
  });

  it('achat de terrain contigu uniquement', () => {
    const sim = new Sim(newGame(8, 'limousin'));
    const W = sim.s.world;
    const per = 16;
    const owned = W.owned.findIndex(Boolean);
    expect(canBuyLot(sim, 0).ok).toBe(false);
    const next = owned - 1;
    expect(buyLot(sim, next)).toBe(true);
    expect(W.owned[next]).toBe(true);
    expect(per).toBe(16);
  });

  it('sauvegarde / restauration à l\'identique, puis suite identique', () => {
    const sim = new Sim(newGame(13, 'sudouest'));
    run(sim, 900);
    const restored = new Sim(deserialize(serialize(sim.s)));
    expect(restored.s.money).toBe(sim.s.money);
    expect(Array.from(restored.s.world.height)).toEqual(Array.from(sim.s.world.height));
    run(sim, 500);
    run(restored, 500);
    expect(restored.s.money).toBe(sim.s.money);
    expect(JSON.stringify(restored.s.stats)).toBe(JSON.stringify(sim.s.stats));
  });

  it('refuse un fichier étranger, plus récent ou de la V0.1', () => {
    expect(() => deserialize('{"format":"autre"}')).toThrow();
    const f = JSON.parse(serialize(new Sim(newGame(1)).s));
    f.version = 999;
    expect(() => deserialize(JSON.stringify(f))).toThrow();
    f.version = 1;
    expect(() => deserialize(JSON.stringify(f))).toThrow(/V0.1/);
  });
});

describe('navigation', () => {
  it('A* contourne les obstacles et ne coupe pas les coins', () => {
    const wall = (x: number, y: number) => x === 5 && y < 8;
    const p = findPath(10, 10, 2, 2, 8, 2, (x, y) => (wall(x, y) ? Infinity : 1))!;
    expect(p.some(([x, y]) => wall(x, y))).toBe(false);
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      if (ax !== bx && ay !== by) expect(wall(bx, ay) || wall(ax, by)).toBe(false);
    }
    expect(findPath(10, 10, 2, 2, 8, 2, (x) => (x === 5 ? Infinity : 1))).toBeNull();
  });

  it('personne ne traverse un bâtiment, l\'eau ou une pente infranchissable', () => {
    const sim = new Sim(newGame(21, 'montagne'));
    const bad = new Set<number>();
    for (const b of sim.s.buildings) if (!['verger', 'champ'].includes(BUILDINGS[b.type].kind)) for (const [x, y] of footprint(b)) bad.add(y * 256 + x);
    for (let i = 0; i < 2 * 1440; i++) {
      sim.tick();
      for (const a of [...sim.s.workers, ...sim.s.visitors]) {
        if (a.hidden) continue;
        const k = Math.round(a.y) * 256 + Math.round(a.x);
        expect(bad.has(k)).toBe(false);
        expect(isWater(sim.s.world.terrain[k])).toBe(false);
      }
    }
  });
});

describe('contenu', () => {
  it('recettes, cultures et régions cohérentes', () => {
    for (const b of Object.values(BUILDINGS)) for (const r of b.recettes ?? []) {
      expect(RES_IDS).toContain(r.input);
      expect(RES_IDS).toContain(r.output);
    }
    for (const c of Object.values(CROPS)) expect(RESOURCES[c.produit]).toBeDefined();
    for (const r of REGIONS) for (const id of regionBuildings(r)) expect(BUILDINGS[id], `${r.id} → ${id}`).toBeDefined();
  });
});
