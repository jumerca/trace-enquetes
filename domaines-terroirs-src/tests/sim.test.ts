import { describe, expect, it } from 'vitest';
import { newGame, Sim, dayOf } from '../src/sim/sim';
import { build, buildPath, checkBuild, createOrder, demolish } from '../src/sim/actions';
import { findPath } from '../src/nav/astar';
import { deserialize, serialize } from '../src/save/save';
import { doorOf, footprint } from '../src/sim/geom';
import { BUILDINGS, RES_IDS } from '../src/data/content';

const run = (sim: Sim, minutes: number) => {
  for (let i = 0; i < minutes; i++) sim.tick();
};

describe('simulation', () => {
  it('est reproductible à graine égale sur 30 jours', () => {
    const a = new Sim(newGame(42));
    const b = new Sim(newGame(42));
    run(a, 30 * 1440);
    run(b, 30 * 1440);
    expect(a.s.money).toBe(b.s.money);
    expect(JSON.stringify(a.s.stats)).toBe(JSON.stringify(b.s.stats));
    expect(a.s.ledger.map((l) => l.rev)).toEqual(b.s.ledger.map((l) => l.rev));
    expect(dayOf(a.s.minute)).toBe(30);
  });

  it('boucle pommes → jus → boutique : récolte, transformation et ventes réelles', () => {
    const sim = new Sim(newGame(7));
    run(sim, 3 * 1440);
    const st = sim.s.stats;
    expect(st.harvested.pommes ?? 0).toBeGreaterThan(20);
    expect(st.produced.jus ?? 0).toBeGreaterThan(10);
    expect(st.sold.jus ?? 0).toBeGreaterThan(0);
    expect(st.visitors).toBeGreaterThan(5);
  });

  it('conservation de la matière : pommes récoltées = stock + pressées + vendues', () => {
    const sim = new Sim(newGame(3));
    const total = (r: 'pommes' | 'jus') =>
      sim.s.buildings.reduce((a, b) => a + (b.inv[r] ?? 0), 0) + sim.s.workers.reduce((a, w) => a + (w.carry?.res === r ? w.carry.qty : 0), 0);
    const p0 = total('pommes'), j0 = total('jus');
    run(sim, 2 * 1440 + 300);
    const s = sim.s.stats;
    const batches = (s.produced.jus ?? 0) / 5;
    const pommes = p0 + (s.harvested.pommes ?? 0) - batches * 8 - (s.sold.pommes ?? 0);
    const jus = j0 + (s.produced.jus ?? 0) - (s.sold.jus ?? 0);
    expect(total('pommes')).toBeCloseTo(pommes, 1);
    expect(total('jus')).toBeCloseTo(jus, 1);
  });

  it('salaires et entretien débités chaque jour et ventilés par activité', () => {
    const sim = new Sim(newGame(5));
    run(sim, 1440 + 1);
    const day0 = sim.s.ledger.find((l) => l.day === 0)!;
    const costs = Object.values(day0.cost).reduce((a, b) => a + (b ?? 0), 0);
    expect(costs).toBeGreaterThanOrEqual(72 + 80 + 12 + 8 + 6 + 7 + 4);
    expect(day0.lines.some((l) => l.label.startsWith('Salaires'))).toBe(true);
    expect(day0.cost.pomme ?? 0).toBeGreaterThan(0);
  });

  it('aucune vente sans stock (négociant)', () => {
    const sim = new Sim(newGame(1));
    expect(createOrder(sim, 'fromage', 5)).toBe(false);
    expect(createOrder(sim, 'jus', 999)).toBe(false);
    const before = sim.stockOf('jus');
    expect(createOrder(sim, 'jus', 5)).toBe(true);
    expect(sim.stockOf('jus')).toBe(before - 5);
    const money = sim.s.money;
    run(sim, 400);
    expect(sim.s.orders[0].status).toBe('livrée');
    expect(sim.s.money).not.toBe(money);
  });

  it('capacité de grange respectée', () => {
    const sim = new Sim(newGame(9));
    const g = sim.storages()[0];
    g.inv = { pommes: 390 };
    sim.s.buildings.find((b) => b.type === 'verger')!.ready = 140;
    run(sim, 600);
    for (const b of sim.storages()) expect(sim.used(b)).toBeLessThanOrEqual(BUILDINGS[b.type].capacite!);
  });

  it('les ateliers ne produisent pas sans intrants', () => {
    const sim = new Sim(newGame(11));
    for (const b of sim.s.buildings) b.inv = {};
    sim.s.buildings.find((b) => b.type === 'verger')!.ready = 0;
    run(sim, 600);
    expect(sim.s.stats.batches).toBe(0);
    expect(sim.s.stats.produced.jus ?? 0).toBe(0);
  });

  it('construction invalide refusée (eau, chemin, hors domaine, occupé, sans accès, sans argent)', () => {
    const sim = new Sim(newGame(2));
    expect(checkBuild(sim, 'pressoir', 34, 58, 0).ok).toBe(false); // étang
    expect(checkBuild(sim, 'pressoir', 47, 53, 0).ok).toBe(false); // chemin
    expect(checkBuild(sim, 'pressoir', 5, 5, 0).ok).toBe(false); // hors domaine
    expect(checkBuild(sim, 'pressoir', 43, 40, 0).ok).toBe(false); // maison
    expect(checkBuild(sim, 'pressoir', 36, 36, 0).reason).toMatch(/chemin|Sol|Terrain/);
    expect(checkBuild(sim, 'maison', 36, 36, 0).ok).toBe(false); // non constructible
    sim.s.money = 10;
    expect(checkBuild(sim, 'champ', 48, 53, 0).reason).toBe('Fonds insuffisants');
  });

  it('construction valide : enclos caprin, chèvres, traite et fromage', () => {
    const sim = new Sim(newGame(4));
    // chemin vers une zone libre, puis enclos et fromagerie
    const c = checkBuild(sim, 'enclos', 48, 50, 0);
    expect(c.ok).toBe(true);
    expect(build(sim, 'enclos', 48, 50, 0)).not.toBeNull();
    expect(sim.s.animals.filter((a) => a.kind === 'chevre').length).toBe(6);
    expect(build(sim, 'fromagerie', 54, 46 - 3, 0)).toBeNull(); // collision avec la boutique
    const f = build(sim, 'fromagerie', 58, 42, 1);
    expect(f).not.toBeNull();
    sim.hire('eleveur');
    run(sim, 3 * 1440);
    expect(sim.s.stats.harvested.lait ?? 0).toBeGreaterThan(20);
    expect(sim.s.stats.produced.fromage ?? 0).toBeGreaterThan(0);
  });

  it('blé → moisson au tracteur → moulin → boulangerie', () => {
    const sim = new Sim(newGame(6));
    sim.s.money = 60000;
    const champ = build(sim, 'champ', 48, 50, 0)!;
    expect(champ).not.toBeNull();
    expect(build(sim, 'hangar', 57, 37, 1)).not.toBeNull();
    expect(build(sim, 'moulin', 58, 42, 1)).not.toBeNull();
    expect(sim.s.vehicles.filter((v) => v.kind === 'tracteur').length).toBe(1);
    champ.ready = 130;
    champ.growth = 1;
    run(sim, 1440);
    expect(sim.s.stats.harvested.ble ?? 0).toBeGreaterThan(100);
    expect(sim.s.stats.produced.farine ?? 0).toBeGreaterThan(0);
    // le tracteur est revenu au hangar et personne ne le conduit plus
    const t = sim.s.vehicles.find((v) => v.kind === 'tracteur')!;
    const hangar = sim.s.buildings.find((b) => b.type === 'hangar')!;
    expect(t.driver).toBeNull();
    expect([Math.round(t.x), Math.round(t.y)]).toEqual(doorOf(hangar));
  });

  it('les véhicules contournent le décor (puits, charrette, voitures garées)', () => {
    const sim = new Sim(newGame(6));
    const c = sim.cost('vehicle');
    expect(c(49, 46)).toBe(Infinity); // puits
    expect(c(54, 47)).toBe(Infinity); // charrette
    expect(c(50, 46)).toBe(1);
  });

  it('démolition : remboursement partiel et occupation libérée', () => {
    const sim = new Sim(newGame(8));
    const b = build(sim, 'champ', 48, 50, 0)!;
    expect(demolish(sim, b.id)).toBe(true);
    expect(sim.occ[50 * 96 + 48]).toBe(-1);
    expect(demolish(sim, sim.s.buildings.find((x) => x.type === 'maison')!.id)).toBe(false);
  });

  it('chemin : coût et praticabilité', () => {
    const sim = new Sim(newGame(8));
    const m = sim.s.money;
    expect(buildPath(sim, 48, 52)).toBe(true);
    expect(sim.s.money).toBeLessThan(m);
    expect(buildPath(sim, 48, 52)).toBe(false);
  });

  it('sauvegarde / restauration à l\'identique, puis suite identique', () => {
    const sim = new Sim(newGame(13));
    run(sim, 900);
    const json = serialize(sim.s);
    const restored = new Sim(deserialize(json));
    expect(restored.s.money).toBe(sim.s.money);
    expect(restored.s.minute).toBe(sim.s.minute);
    expect(restored.s.workers.map((w) => [w.x, w.y, w.label])).toEqual(sim.s.workers.map((w) => [w.x, w.y, w.label]));
    expect(Array.from(restored.s.world.terrain)).toEqual(Array.from(sim.s.world.terrain));
    run(sim, 500);
    run(restored, 500);
    expect(restored.s.money).toBe(sim.s.money);
    expect(JSON.stringify(restored.s.stats)).toBe(JSON.stringify(sim.s.stats));
  });

  it('refuse un fichier étranger ou plus récent', () => {
    expect(() => deserialize('{"format":"autre"}')).toThrow();
    const sim = new Sim(newGame(1));
    const f = JSON.parse(serialize(sim.s));
    f.version = 999;
    expect(() => deserialize(JSON.stringify(f))).toThrow();
  });
});

describe('navigation', () => {
  it('A* contourne les obstacles et ne coupe pas les coins', () => {
    const W = 10, H = 10;
    const wall = (x: number, y: number) => x === 5 && y < 8;
    const p = findPath(W, H, 2, 2, 8, 2, (x, y) => (wall(x, y) ? Infinity : 1))!;
    expect(p).not.toBeNull();
    expect(p.some(([x, y]) => wall(x, y))).toBe(false);
    for (let i = 1; i < p.length; i++) {
      const [ax, ay] = p[i - 1], [bx, by] = p[i];
      if (ax !== bx && ay !== by) expect(wall(bx, ay) || wall(ax, by)).toBe(false);
    }
    expect(findPath(W, H, 2, 2, 8, 2, (x) => (x === 5 ? Infinity : 1))).toBeNull();
  });

  it('les travailleurs ne traversent jamais un bâtiment ni l\'eau', () => {
    const sim = new Sim(newGame(21));
    const bad = new Set<number>();
    for (const b of sim.s.buildings) if (!['verger', 'champ'].includes(BUILDINGS[b.type].kind)) for (const [x, y] of footprint(b)) bad.add(y * 96 + x);
    for (let i = 0; i < 2 * 1440; i++) {
      sim.tick();
      for (const a of [...sim.s.workers, ...sim.s.visitors]) {
        if (a.hidden) continue;
        const k = Math.round(a.y) * 96 + Math.round(a.x);
        expect(bad.has(k)).toBe(false);
        expect(sim.s.world.terrain[k]).not.toBe(3);
      }
    }
  });

  it('chaque porte de bâtiment initial est accessible depuis la maison', () => {
    const sim = new Sim(newGame(1));
    const home = doorOf(sim.s.buildings[0]);
    for (const b of sim.s.buildings) {
      const d = BUILDINGS[b.type].kind === 'verger' ? sim.gateOf(b) : doorOf(b);
      expect(findPath(96, 96, home[0], home[1], d[0], d[1], sim.cost('worker'))).not.toBeNull();
    }
  });
});

describe('contenu', () => {
  it('toutes les recettes référencent des ressources connues', () => {
    for (const b of Object.values(BUILDINGS)) if (b.recette) {
      expect(RES_IDS).toContain(b.recette.input);
      expect(RES_IDS).toContain(b.recette.output);
    }
  });
});
