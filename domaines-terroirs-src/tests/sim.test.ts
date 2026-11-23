import { describe, expect, it } from 'vitest';
import { newGame, Sim, dayOf } from '../src/sim/sim';
import { build, buildPath, buyLot, canBuyLot, checkBuild, checkPath, createOrder, demolish } from '../src/sim/actions';
import { findPath } from '../src/nav/astar';
import { deserialize, serialize } from '../src/save/save';
import { doorOf, footprint } from '../src/sim/geom';
import { BUILDINGS, CROPS, RES_IDS, RESOURCES, ROLES } from '../src/data/content';
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

  it.each(REGIONS.map((r) => r.id))('%s : la ferme de départ tient l\'équilibre sur 4 semaines (hiver compris)', (id) => {
    const sim = new Sim(newGame(4, id));
    const m0 = sim.s.money;
    run(sim, 28 * 1440);
    expect(sim.s.money - m0).toBeGreaterThan(-300);
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
    const expected = sim.s.workers.reduce((a, w) => a + ROLES[w.role].salaire, 0) + sim.s.buildings.reduce((a, b) => a + BUILDINGS[b.type].entretien, 0);
    expect(sum(day0.cost)).toBeGreaterThanOrEqual(expected - 0.01);
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
    // épandage puis semis puis traitement au pulvérisateur : bonus de rendement
    run(sim, 6 * 1440);
    const lines = sim.s.ledger.flatMap((l) => l.lines.map((x) => x.label));
    expect(lines).toContain('Fumure (épandage)');
    expect(lines).toContain('Traitement des cultures');
  });

  it('vendangeuse : vendange mécanique de la vigne', () => {
    const sim = new Sim(newGame(14, 'sudouest'));
    sim.s.money = 90000;
    const vigne = place(sim, 'verger_vigne')!;
    expect(vigne).not.toBeNull();
    expect(place(sim, 'remise_viti')).not.toBeNull();
    expect(sim.s.vehicles.some((v) => v.kind === 'vendangeuse')).toBe(true);
    vigne.ready = 150;
    run(sim, 900);
    expect(sim.s.stats.harvested.raisin ?? 0).toBeGreaterThan(100);
    const vm = sim.s.vehicles.find((v) => v.kind === 'vendangeuse')!;
    run(sim, 600);
    expect(vm.driver).toBeNull();
    expect(vigne.busyBy).toBeNull();
  });

  it('bétaillère pour les animaux vendus, livrées de tracteur variées', () => {
    const sim = new Sim(newGame(14, 'sudouest'));
    sim.storages()[0].inv.canards = 6;
    expect(createOrder(sim, 'canards', 4)).toBe(true);
    let seen = false;
    for (let i = 0; i < 300 && !seen; i++) {
      sim.tick();
      seen = sim.s.vehicles.some((v) => v.kind === 'betaillere');
    }
    expect(seen).toBe(true);
    const nord = new Sim(newGame(2, 'nord'));
    nord.s.money = 90000;
    expect(place(nord, 'hangar')).not.toBeNull();
    expect(nord.s.vehicles.find((v) => v.kind === 'tracteur')!.look % 3).toBe(2); // bleu dans le Nord
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

  it('routes et ponts construits par le joueur', () => {
    const sim = new Sim(newGame(8, 'limousin'));
    sim.s.money = 50000;
    const W = sim.s.world;
    // une case d'eau du domaine, bordée d'une case de terre
    let spotW: [number, number] | null = null, land: [number, number] | null = null;
    for (let y = 1; y < 255 && !spotW; y++)
      for (let x = 1; x < 255 && !spotW; x++) {
        if (W.terrain[y * 256 + x] !== T.eau || !W.owned[Math.floor(y / 16) * 16 + Math.floor(x / 16)]) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]])
          if (!spotW && checkPath(sim, x + dx, y + dy, 'route').ok && W.terrain[(y + dy) * 256 + x + dx] !== T.chemin) {
            spotW = [x, y];
            land = [x + dx, y + dy];
          }
      }
    expect(spotW).not.toBeNull();
    expect(checkPath(sim, ...spotW!, 'pont').reason).toMatch(/prolonger/);
    expect(buildPath(sim, ...land!, 'route')).toBe(true);
    expect(W.terrain[land![1] * 256 + land![0]]).toBe(T.route);
    expect(sim.cost('vehicle')(...land!)).toBe(1);
    const m = sim.s.money;
    expect(buildPath(sim, ...spotW!, 'pont')).toBe(true);
    expect(sim.s.money).toBe(m - 450);
    expect(sim.cost('worker')(...spotW!)).toBeLessThan(Infinity);
    expect(checkPath(sim, ...land!, 'chemin').ok).toBe(false);
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

  it('refuse un fichier étranger ou plus récent', () => {
    expect(() => deserialize('{"format":"autre"}')).toThrow();
    const f = JSON.parse(serialize(new Sim(newGame(1)).s));
    f.version = 999;
    expect(() => deserialize(JSON.stringify(f))).toThrow();
  });

  it('reprend une sauvegarde de la V0.1 (argent, stocks, personnel, bâtiments)', () => {
    const v1 = {
      format: 'domaines-terroirs', version: 1, savedAt: '2026-11-23T00:00:00Z', label: 'Jour 5',
      state: {
        version: 1, seed: 1789, minute: 5 * 1440 + 600, money: 23456.5, weather: 'pluie', reputation: 61, satisfaction: 70, visitFee: 5, tutorial: 3,
        prices: { jus: 5.2, fromage: 10 },
        stats: { harvested: { pommes: 300, lait: 40 }, produced: { jus: 120, fromage: 6 }, sold: { jus: 80 }, batches: 24, built: 2, visitors: 90 },
        world: { w: 96, h: 96, owned: [...Array(36)].map((_, i) => [14, 15, 20, 21, 22].includes(i)) },
        buildings: [
          { type: 'maison', inv: {} }, { type: 'grange', inv: { pommes: 40, jus: 30, lait: 12 } }, { type: 'pressoir', inv: {} }, { type: 'boutique', inv: { jus: 9 } }, { type: 'verger', inv: {} },
          { type: 'enclos', inv: {} }, { type: 'fromagerie', inv: {} },
        ],
        workers: [{ nom: 'Lucie', role: 'cultivateur' }, { nom: 'Rémi', role: 'artisan' }, { nom: 'Odile', role: 'eleveur' }],
      },
    };
    const s = deserialize(JSON.stringify(v1));
    expect(s.version).toBe(2);
    expect(s.world.w).toBe(256);
    expect(s.money).toBeGreaterThanOrEqual(23456.5 + 4500); // + un lot remboursé
    expect(s.minute).toBe(5 * 1440 + 600);
    expect(s.workers.map((w) => w.nom)).toEqual(['Lucie', 'Rémi', 'Odile']);
    const stock = (r: string) => s.buildings.reduce((a, b) => a + (b.inv[r] ?? 0), 0);
    expect(stock('jus')).toBe(39);
    expect(stock('lait_chevre')).toBe(12);
    expect(s.buildings.some((b) => b.type === 'elevage_chevres') || s.events.some((e) => /Remboursés/.test(e.text))).toBe(true);
    expect(s.buildings.some((b) => b.type === 'fromagerie') || s.events.some((e) => /fromagerie/i.test(e.text))).toBe(true);
    expect(s.prices.fromage_chevre).toBe(10);
    // la partie reprise tourne normalement
    const sim = new Sim(s);
    run(sim, 1440);
    expect(sim.s.stats.batches).toBeGreaterThan(24);
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

describe('domaine étendu (V0.4)', () => {
  const rich = (id = 'limousin', seed = 5) => {
    const sim = new Sim(newGame(seed, id));
    sim.s.money = 1e6;
    sim.s.reputation = 80;
    return sim;
  };

  it('les produits servis à l\'auberge existent', async () => {
    const { MEAL_FOODS } = await import('../src/sim/sim');
    expect(MEAL_FOODS.filter((r) => RESOURCES[r]).length).toBeGreaterThan(15);
  });

  it('le silo n\'accepte que les grains', () => {
    const sim = rich('beauce');
    const silo = place(sim, 'silo')!;
    expect(silo).toBeTruthy();
    expect(sim.canStore(silo, 'ble')).toBe(true);
    expect(sim.canStore(silo, 'lait')).toBe(false);
    const grange = sim.s.buildings.find((b) => b.type === 'grange')!;
    expect(sim.canStore(grange, 'lait')).toBe(true);
  });

  it('les gens entrent dans les bâtiments (invisibles dedans) et en ressortent', () => {
    const sim = rich();
    let inside = 0, out = 0;
    const seen = new Set<number>();
    for (let i = 0; i < 1440; i++) {
      sim.tick();
      for (const w of sim.s.workers) {
        if (w.hidden && w.vehicle == null && w.inside != null) {
          inside++;
          seen.add(w.id);
        } else if (seen.has(w.id) && !w.hidden) out++;
      }
    }
    expect(inside).toBeGreaterThan(50);
    expect(out).toBeGreaterThan(50);
  });

  it('gîte, auberge, navette, centre équestre et ferme pédagogique rapportent', () => {
    const sim = rich('limousin', 9);
    for (const t of ['accueil', 'gite', 'auberge', 'garage_bus', 'pedagogique', 'elevage_chevaux']) expect(place(sim, t), t).toBeTruthy();
    sim.hire('guide');
    // un peu de stock pour la cuisine
    const g = sim.s.buildings.find((b) => b.type === 'grange')!;
    for (const r of ['tomme', 'legumes', 'viande', 'oeufs', 'pain']) if (RESOURCES[r]) g.inv[r] = 60;
    run(sim, 8 * 1440);
    const lines = sim.s.ledger.flatMap((d) => d.lines.map((l) => l.label));
    for (const l of ['Nuitées — Gîte rural', 'Repas à la ferme-auberge', 'Balade à cheval', 'Ateliers de la ferme pédagogique']) expect(lines, l).toContain(l);
    expect(sim.s.stats.visitors).toBeGreaterThan(40);
  });

  it('l\'utilitaire vend au marché tous les 3 jours', () => {
    const sim = rich('est', 3);
    expect(place(sim, 'garage_utilitaire')).toBeTruthy();
    const g = sim.s.buildings.find((b) => b.type === 'grange')!;
    g.inv.confiture = 50;
    run(sim, 4 * 1440);
    expect(sim.s.ledger.flatMap((d) => d.lines).some((l) => l.label.startsWith('Marché'))).toBe(true);
  });

  it('la prairie donne du foin récolté au tracteur', () => {
    const sim = rich('limousin', 2);
    expect(place(sim, 'hangar')).toBeTruthy();
    const p = place(sim, 'champ_prairie')!;
    expect(p).toBeTruthy();
    run(sim, 20 * 1440);
    expect(sim.s.stats.harvested.foin ?? 0).toBeGreaterThan(0);
  });
});

describe('routes, parking et chemins (V0.4.1)', () => {
  it.each(REGIONS.map((r) => r.id))('%s : parking goudronné desservi par la route, chemins de terre vers les fermes voisines', (id) => {
    const sim = new Sim(newGame(6, id));
    const W = sim.s.world;
    expect(W.parkingLot).toBeDefined();
    expect(W.parking.length).toBeGreaterThanOrEqual(10);
    // chaque place est accessible en voiture depuis l'entrée de la carte
    for (const p of W.parking.slice(0, 3)) expect(findPath(256, 256, ...W.entry, ...p, sim.cost('vehicle'))).not.toBeNull();
    expect(W.roads.filter((r) => !r.road).length).toBeGreaterThan(5);
    let dirt = 0;
    for (let i = 0; i < W.terrain.length; i++) if (W.terrain[i] === T.chemin) dirt++;
    expect(dirt).toBeGreaterThan(150);
  });
});

describe('gestion avancée (V0.6)', () => {
  const rich = (id = 'limousin', seed = 5) => {
    const sim = new Sim(newGame(seed, id));
    sim.s.money = 1e6;
    sim.s.reputation = 70;
    return sim;
  };

  it('les cours du marché varient et le négociant les applique', async () => {
    const { wholesaleOf } = await import('../src/sim/economy');
    const sim = rich();
    run(sim, 10 * 1440);
    const vals = Object.values(sim.s.market) as number[];
    expect(vals.length).toBeGreaterThan(20);
    expect(Math.max(...vals) - Math.min(...vals)).toBeGreaterThan(0.05);
    for (const v of vals) expect(v).toBeGreaterThanOrEqual(0.7);
    sim.s.market.ble = 1.3;
    expect(wholesaleOf(sim.s, 'ble')).toBeCloseTo(0.5 * 0.9 * 1.3, 2);
  });

  it('une campagne augmente la fréquentation ; le salon vend des produits', async () => {
    const { launchCampaign, visitorMult } = await import('../src/sim/economy');
    const sim = rich();
    const k0 = visitorMult(sim);
    expect(launchCampaign(sim, 'radio')).toBeNull();
    expect(visitorMult(sim)).toBeGreaterThan(k0 * 1.5);
    expect(launchCampaign(sim, 'radio')).toBe('Déjà en cours');
    const g = sim.s.buildings.find((b) => b.type === 'grange')!;
    g.inv.confiture = 80;
    const m0 = sim.s.money;
    expect(launchCampaign(sim, 'salon')).toBeNull();
    expect(sim.s.money).toBeGreaterThan(m0 - 1500 + 100);
  });

  it('label bio : prix acceptés plus hauts après la conversion', async () => {
    const { buyLabel, priceBonus } = await import('../src/sim/economy');
    const sim = rich();
    expect(buyLabel(sim, 'bio')).toBeNull();
    expect(priceBonus(sim.s)).toBe(1);
    run(sim, 15 * 1440);
    expect(priceBonus(sim.s)).toBeCloseTo(1.15, 2);
  });

  it('emprunt : capital versé puis remboursé chaque jour', async () => {
    const { borrow } = await import('../src/sim/economy');
    const sim = new Sim(newGame(5, 'limousin'));
    const m0 = sim.s.money;
    expect(borrow(sim, 0)).toBeNull();
    expect(sim.s.money).toBe(m0 + 10000);
    run(sim, 3 * 1440);
    expect(sim.s.loans[0].left).toBe(25);
    expect(sim.s.ledger.flatMap((d) => d.lines).some((l) => l.label.startsWith('Remboursement'))).toBe(true);
  });

  it('équipements, attractions et nouvelles filières fonctionnent', () => {
    const sim = rich('provence', 3);
    for (const t of ['accueil', 'boutique', 'eolienne', 'stand', 'musee', 'salle_reception', 'cueillette', 'verger_amandier', 'nougaterie', 'elevage_alpagas', 'elevage_escargots']) expect(place(sim, t), t).toBeTruthy();
    const g = sim.s.buildings.find((b) => b.type === 'grange')!;
    g.inv.miel = 60;
    sim.hire('eleveur');
    run(sim, 8 * 1440);
    const lines = sim.s.ledger.flatMap((d) => d.lines.map((l) => l.label));
    expect(lines.some((l) => l.startsWith('Électricité éolienne'))).toBe(true);
    expect(lines.some((l) => l.startsWith('Étal de bord de route'))).toBe(true);
    expect(lines).toContain('Musée de la vie rurale');
    expect(lines.some((l) => l.startsWith('Aides PAC'))).toBe(true);
    expect((sim.s.stats.harvested.laine ?? 0) + (sim.s.stats.harvested.escargots ?? 0)).toBeGreaterThan(0);
  });

  it('chaque nouveau bâtiment, culture, verger et élevage est disponible dans au moins une région', () => {
    const all = new Set(REGIONS.flatMap((r) => [...regionBuildings(r)]));
    for (const id of ['champ_riz', 'champ_safran', 'champ_lentilles', 'champ_piments', 'verger_citronnier', 'verger_myrtillier', 'verger_noisetier', 'verger_figuier', 'elevage_brebis_lait', 'elevage_cerfs', 'nougaterie', 'distillerie_fruits', 'labyrinthe', 'methaniseur']) expect(all.has(id), id).toBe(true);
  });
});
