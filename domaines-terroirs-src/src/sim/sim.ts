// Moteur de simulation : pas fixe d'une minute de jeu, RNG déterministe, aucune dépendance au rendu.
import { economyDaily, ensureEconomy, labelActive, priceBonus, visitorMult, wholesaleOf } from './economy';
import {
  BUILDINGS, CARRY, CROPS, DAY_MIN, DAYS_PER_SEASON, FIRST_NAMES, LIVESTOCK, ORCHARDS, RESOURCES, RES_IDS, ROLES, SEASONS, VISIT_END, VISIT_FEE_DEFAULT,
  VISIT_START, WEATHER, WORK_END, WORK_START, wholesaleFactor, FUMURE_COST, TRAITEMENT_COST,
  type Activity, type Recipe, type Res, type Role, type Season, type Weather,
} from '../data/content';
import { REGION_BY_ID, aptitude, type RegionDef } from '../data/regions';
import { Rng } from '../core/rng';
import { findPath } from '../nav/astar';
import { D, FARM, generateWorld, isPathLike, T } from '../world/terrain';
import { buildOccupancy, defOf, doorOf, footprint, makeCost, type NavKind } from './geom';
import {
  SAVE_VERSION, type Agent, type Animal, type Building, type FieldOp, type GameState, type LedgerDay, type Order, type Step, type Vehicle, type VehicleKind, type Visitor, type Worker,
} from './state';

export const SPEED = { worker: 0.35, visitor: 0.3, tracteur: 0.55, moissonneuse: 0.4, vendangeuse: 0.35, camionnette: 2, betaillere: 1.6, voiture: 2.2, bus: 1.6, utilitaire: 2, animal: 0.05 };
/** Produits servis à la ferme-auberge (3 par repas). */
export const MEAL_FOODS = ['pain', 'galettes', 'tomme', 'fromage_chevre', 'beurre', 'legumes', 'tomates', 'pommes_de_terre', 'viande', 'charcuterie', 'confit', 'foie_gras', 'truite_fumee', 'oeufs', 'vin', 'cidre', 'biere', 'jus', 'fraises', 'melons', 'cerises', 'confiture', 'miel', 'asperges'];
const HERBIVORES = new Set(['vache', 'limousine', 'chevre', 'brebis', 'cheval', 'ane', 'lapin']);
export const LIVERIES = ['rouge', 'vert', 'bleu'];
const REGION_LIVERY: Record<string, number> = { limousin: 0, nord: 2, beauce: 1, est: 0, sudouest: 1, montagne: 0, mer: 2, provence: 1 };
const START_SEASON = 1; // la partie commence en été
/** Au-delà de ce stock de produit fini, l'atelier ne tourne plus (sauf priorité) : on produit pour vendre. */
export const PROCESS_TARGET = 80;

export function dayOf(min: number) {
  return Math.floor(min / DAY_MIN);
}
export function seasonOf(min: number): Season {
  return ((START_SEASON + Math.floor(dayOf(min) / DAYS_PER_SEASON)) % 4) as Season;
}
export function minuteOfDay(min: number) {
  return min % DAY_MIN;
}
export function fmtTime(min: number) {
  const m = minuteOfDay(min);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}
export function dateLabel(min: number) {
  const d = dayOf(min);
  return `Jour ${d + 1} · ${SEASONS[seasonOf(min)]} (${(d % DAYS_PER_SEASON) + 1}/${DAYS_PER_SEASON})`;
}
export const round2 = (v: number) => Math.round(v * 100) / 100;
const xy = (p: [number, number]) => ({ x: p[0], y: p[1] });

function newAgent(id: number, x: number, y: number): Agent {
  return { id, x, y, px: x, py: y, path: [], dir: 0, moving: false, timer: 0, steps: [], label: '', hidden: false };
}

function newBuilding(id: number, type: string, x: number, y: number, rot: 0 | 1, day: number): Building {
  return { id, type, x, y, rot, inv: {}, ready: 0, growth: 0, phase: 'labour', done: [], busyBy: null, priority: false, batches: 0, builtDay: day };
}

/** Produit principal d'un bâtiment de production. */
export function productOf(b: Building): Res | null {
  const d = defOf(b);
  if (d.crop) return CROPS[d.crop].produit;
  if (d.orchard) return ORCHARDS[d.orchard].produit;
  if (d.livestock) return LIVESTOCK[d.livestock].produit;
  return null;
}

export function newGame(seed = 1789, regionId = 'limousin'): GameState {
  const region = REGION_BY_ID[regionId] ?? REGION_BY_ID.limousin;
  const world = generateWorld(seed, region.id);
  const rng = new Rng(seed ^ 0x5eed);
  const s: GameState = {
    version: SAVE_VERSION, seed, region: region.id, rng: 0, minute: 7 * 60, money: region.depart.argent, weather: 'soleil', reputation: 35, satisfaction: 60, satSamples: [],
    world, buildings: [], workers: [], visitors: [], vehicles: [], animals: [], orders: [],
    prices: Object.fromEntries(RES_IDS.map((r) => [r, RESOURCES[r].prix])) as Record<Res, number>,
    visitFee: VISIT_FEE_DEFAULT, market: {}, waitMarket: false, campaigns: [], labels: {}, loans: [], press: [], ledger: [], stats: { harvested: {}, produced: {}, sold: {}, batches: 0, built: 0, visitors: 0 },
    tutorial: 0, nextId: 1, events: [], autoSell: Object.fromEntries(RES_IDS.map((r) => [r, -2])),
  };
  const [cx, cy] = world.farm;
  const add = (type: string, rel: [number, number], rot: 0 | 1) => {
    const b = newBuilding(s.nextId++, type, cx + rel[0], cy + rel[1], rot, 0);
    for (const [x, y] of footprint(b)) {
      world.decor[y * world.w + x] = D.none;
      if (!isPathLike(world.terrain[y * world.w + x])) world.terrain[y * world.w + x] = T.herbe;
    }
    s.buildings.push(b);
    return b;
  };
  add('maison', FARM.maison, 0);
  const grange = add('grange', FARM.grange, 0);
  const shop = add('boutique', FARM.boutique, 0);
  const parcel = add(region.depart.parcelle, FARM.parcelle, 0);
  const atelier = add(region.depart.atelier, FARM.atelier, 1);
  if (region.depart.second) add(region.depart.second, FARM.second, 1);
  // une seconde parcelle (deux de plus en Beauce) pour les départs en cultures et vergers
  const extra = defOf(parcel).kind === 'enclos' ? 0 : region.id === 'beauce' ? 2 : 1;
  const extras = FARM.parcelles.slice(0, extra).map((p) => add(region.depart.parcelle, p, 0));
  if (region.depart.hangar) {
    add('hangar', FARM.hangar, 1);
    add('remise', FARM.remise, 1);
  }
  // stocks de départ cohérents avec la spécialité de la région
  const rec = defOf(atelier).recettes!.find((r) => r.input === productOf(parcel)) ?? defOf(atelier).recettes![0];
  grange.inv = { [rec.input]: Math.max(rec.inQty * 3, 24), [rec.output]: rec.outQty * 3 };
  if (RESOURCES[rec.output].boutique) shop.inv[rec.output] = Math.min(10, rec.outQty * 2);
  if (RESOURCES[rec.input].boutique) shop.inv[rec.input] = 8;
  const pd = defOf(parcel);
  for (const e of extras) {
    e.phase = pd.kind === 'champ' ? 'pousse' : e.phase;
    e.growth = 0.35;
  }
  if (pd.kind === 'verger') parcel.ready = 46;
  if (pd.kind === 'enclos') parcel.ready = LIVESTOCK[pd.livestock!].cap * 0.4;
  if (pd.kind === 'champ') {
    if (pd.crop === 'ble' || pd.crop === 'orge') {
      parcel.phase = 'mur';
      parcel.ready = CROPS[pd.crop].rendement;
      parcel.growth = 1;
    } else {
      parcel.phase = 'pousse';
      parcel.growth = 0.8;
    }
  }
  s.ledger.push(emptyDay(0));
  const names = [...FIRST_NAMES];
  const pickName = () => names.splice(rng.int(0, names.length - 1), 1)[0];
  const sim = new Sim(s);
  sim.rng = rng;
  for (const b of s.buildings) sim.onBuilt(b, true);
  sim.hire(pd.kind === 'enclos' ? 'eleveur' : 'cultivateur', pickName(), true);
  sim.hire('artisan', pickName(), true);
  sim.hire('vendeur', pickName(), true);
  for (let i = 0; i < 5; i++) sim.addAnimal('poule', -1);
  s.rng = rng.state;
  s.events = [];
  sim.event(`Bienvenue au domaine — ${region.nom} ! ${region.specialites}`, 'info');
  return s;
}

function emptyDay(day: number): LedgerDay {
  return { day, rev: {}, cost: {}, invest: 0, lines: [] };
}

export class Sim {
  rng: Rng;
  occ!: Int32Array;
  byId = new Map<number, Building>();
  region: RegionDef;
  private costCache = new Map<string, (x: number, y: number) => number>();
  /** compteur incrémenté à chaque modification du monde (bâtiments, terrain) : le rendu s'y synchronise */
  worldRev = 0;

  constructor(public s: GameState) {
    this.rng = new Rng(s.rng || s.seed);
    this.region = REGION_BY_ID[s.region] ?? REGION_BY_ID.limousin;
    ensureEconomy(s);
    this.refresh();
  }

  /** Zone de la carte modifiée depuis le dernier rendu (null = tout). */
  private dirty: [number, number, number, number] | null = null;
  private dirtyAll = true;
  touch(x0: number, y0: number, x1: number, y1: number) {
    this.dirty = this.dirty ? [Math.min(this.dirty[0], x0), Math.min(this.dirty[1], y0), Math.max(this.dirty[2], x1), Math.max(this.dirty[3], y1)] : [x0, y0, x1, y1];
  }
  /** Rectangle à redessiner (null : toute la carte), puis remise à zéro. */
  takeDirty(): [number, number, number, number] | null {
    const r = this.dirtyAll ? null : this.dirty;
    this.dirty = null;
    this.dirtyAll = false;
    return r;
  }
  private paths = new Map<string, [number, number][]>();

  refresh(partial = false) {
    if (!partial) this.dirtyAll = true;
    this.paths.clear();
    this.byId = new Map(this.s.buildings.map((b) => [b.id, b]));
    this.occ = buildOccupancy(this.s.world, this.s.buildings);
    this.costCache.clear();
    this.worldRev++;
  }

  cost(kind: NavKind, field = -1) {
    const key = kind + field;
    let c = this.costCache.get(key);
    if (!c) {
      c = makeCost(this.s.world, this.occ, this.byId, kind, field);
      this.costCache.set(key, c);
    }
    return c;
  }

  // ————— journal et comptabilité —————
  event(text: string, kind: 'info' | 'alerte' | 'succes' = 'info') {
    this.s.events.push({ min: this.s.minute, text, kind });
    if (this.s.events.length > 60) this.s.events.splice(0, this.s.events.length - 60);
  }

  today(): LedgerDay {
    const d = dayOf(this.s.minute);
    let l = this.s.ledger[this.s.ledger.length - 1];
    if (!l || l.day !== d) {
      l = emptyDay(d);
      this.s.ledger.push(l);
      if (this.s.ledger.length > 60) this.s.ledger.shift();
    }
    return l;
  }

  /** amount > 0 : recette ; amount < 0 : charge. invest : investissement (hors marge d'exploitation). */
  book(a: Activity, amount: number, label: string, invest = false) {
    amount = round2(amount);
    if (!amount) return;
    this.s.money = round2(this.s.money + amount);
    const l = this.today();
    if (invest) l.invest = round2(l.invest - amount);
    else if (amount > 0) l.rev[a] = round2((l.rev[a] ?? 0) + amount);
    else l.cost[a] = round2((l.cost[a] ?? 0) - amount);
    const line = l.lines.find((x) => x.a === a && x.label === label);
    if (line) line.amount = round2(line.amount + amount);
    else l.lines.push({ a, label, amount });
  }

  // ————— stocks —————
  storages() {
    return this.s.buildings.filter((b) => defOf(b).kind === 'stock');
  }
  /** Le silo n'accepte que les grains ; la grange et la chambre froide acceptent tout. */
  canStore(b: Building, res: Res) {
    const a = defOf(b).accepte;
    return !a || a.includes(res);
  }
  storagesFor(res: Res) {
    return this.storages().filter((b) => this.canStore(b, res));
  }
  spaceFor(res: Res) {
    return this.storagesFor(res).reduce((a, b) => a + this.space(b), 0);
  }
  has(type: string) {
    return this.s.buildings.some((b) => b.type === type);
  }
  used(b: Building) {
    let n = 0;
    for (const v of Object.values(b.inv)) n += v ?? 0;
    return n;
  }
  space(b: Building) {
    return Math.max(0, (defOf(b).capacite ?? 0) - this.used(b));
  }
  stockOf(res: Res) {
    let n = 0;
    for (const b of this.storages()) n += b.inv[res] ?? 0;
    return n;
  }
  totalSpace() {
    return this.storages().reduce((a, b) => a + this.space(b), 0);
  }
  add(b: Building, res: Res, q: number) {
    b.inv[res] = round2((b.inv[res] ?? 0) + q);
  }
  remove(b: Building, res: Res, q: number) {
    const have = b.inv[res] ?? 0;
    const t = Math.min(have, q);
    b.inv[res] = round2(have - t);
    if (b.inv[res] === 0) delete b.inv[res];
    return t;
  }

  nearest<B extends Building>(list: B[], x: number, y: number): B | null {
    let best: B | null = null, bd = Infinity;
    for (const b of list) {
      const [dx, dy] = doorOf(b);
      const d = Math.abs(dx - x) + Math.abs(dy - y);
      if (d < bd) {
        bd = d;
        best = b;
      }
    }
    return best;
  }

  // ————— constructions, personnel, animaux —————
  /** Effets d'une construction : animaux, engins. */
  onBuilt(b: Building, initial = false) {
    const d = defOf(b);
    if (d.livestock) {
      const l = LIVESTOCK[d.livestock];
      for (let i = 0; i < l.nombre; i++) this.addAnimal(l.animal, b.id, i);
    }
    if (d.kind === 'hangar') this.addVehicle('tracteur', b);
    if (d.kind === 'remise') this.addVehicle(b.type === 'remise_viti' ? 'vendangeuse' : 'moissonneuse', b);
    if (!initial && d.crop) b.phase = 'labour';
  }

  addVehicle(kind: VehicleKind, home: Building | null, x?: number, y?: number): Vehicle {
    const [dx, dy] = home ? doorOf(home) : [x!, y!];
    const v: Vehicle = { ...newAgent(this.s.nextId++, dx, dy), kind, home: home?.id ?? -1, load: null, cap: kind === 'moissonneuse' ? 260 : 400, driver: null, order: null, tool: 'seul', look: 0, passengers: 0, back: 0, slot: -1 };
    v.dir = 1;
    // livrée des tracteurs : couleur dominante de la région, puis alternance
    if (kind === 'tracteur') v.look = (REGION_LIVERY[this.s.region] ?? 0) + this.s.vehicles.filter((x) => x.kind === 'tracteur').length;
    v.label = { tracteur: 'Tracteur', moissonneuse: 'Moissonneuse-batteuse', vendangeuse: 'Machine à vendanger', betaillere: 'Bétaillère', voiture: 'Voiture de visiteurs', camionnette: 'Camionnette', bus: 'Car de tourisme', utilitaire: 'Utilitaire du marché' }[kind];
    this.s.vehicles.push(v);
    return v;
  }

  hire(role: Role, nom?: string, free = false): Worker | null {
    const home = this.s.buildings.find((b) => b.type === 'maison');
    if (!home) return null;
    const [x, y] = doorOf(home);
    const used = new Set(this.s.workers.map((w) => w.nom));
    const name = nom ?? FIRST_NAMES.find((n) => !used.has(n)) ?? `Employé ${this.s.nextId}`;
    const w: Worker = { ...newAgent(this.s.nextId++, x, y), nom: name, role, carry: null, vehicle: null, minutes: {}, activity: 'general', hiredDay: dayOf(this.s.minute) };
    this.s.workers.push(w);
    if (!free) this.event(`${name} rejoint le domaine (${ROLES[role].nom}, ${ROLES[role].salaire} €/jour).`, 'succes');
    return w;
  }

  fire(id: number) {
    const w = this.s.workers.find((x) => x.id === id);
    if (!w) return false;
    this.abort(w);
    if (w.vehicle != null) this.alight(w);
    if (w.carry) {
      const st = this.nearest(this.storages().filter((b) => this.space(b) > 0), w.x, w.y);
      if (st) this.add(st, w.carry.res, Math.min(w.carry.qty, this.space(st)));
    }
    const worked = Object.values(w.minutes).reduce((a, b) => a + (b ?? 0), 0);
    if (worked > 0) this.paySalary(w);
    this.s.workers = this.s.workers.filter((x) => x !== w);
    this.event(`${w.nom} quitte le domaine.`, 'info');
    return true;
  }

  addAnimal(kind: string, pen: number, index = 0) {
    let x = 0, y = 0;
    const [cx, cy] = this.s.world.farm;
    if (pen >= 0) {
      const b = this.byId.get(pen)!;
      const s = defOf(b).size;
      if (kind === 'ruche') {
        // ruches alignées
        x = b.x + 0.6 + (index % 3) * ((s - 1.2) / 2);
        y = b.y + 0.9 + Math.floor(index / 3) * ((s - 1.4) / 1);
      } else [x, y] = this.penSpot(b);
    } else {
      x = cx - 3 + this.rng.next() * 9;
      y = cy - 2 + this.rng.next() * 4;
    }
    const a: Animal = { id: this.s.nextId++, kind, pen, x, y, px: x, py: y, tx: x, ty: y, dir: 0, pause: kind === 'ruche' ? 1e9 : 0, look: this.rng.int(0, 2) };
    this.s.animals.push(a);
  }

  // ————— boucle principale —————
  tick() {
    const s = this.s;
    s.minute++;
    const mod = minuteOfDay(s.minute);
    if (mod === 0) this.endOfDay();
    for (const a of s.workers) (a.px = a.x), (a.py = a.y);
    for (const a of s.visitors) (a.px = a.x), (a.py = a.y);
    for (const a of s.vehicles) (a.px = a.x), (a.py = a.y);
    for (const a of s.animals) (a.px = a.x), (a.py = a.y);
    this.producers(mod);
    if (mod >= VISIT_START - 120 && mod < VISIT_END - 90) this.spawnVisitors(mod);
    if (mod >= 17 * 60 && mod < 19 * 60 + 30) this.spawnGuests();
    if (mod === 10 * 60 + 15) this.spawnBus();
    if (mod === 7 * 60 + 30) this.marketTrip();
    if (mod === 8 * 60) this.autoSell();
    this.processOrders();
    for (const w of s.workers) this.updateWorker(w, mod);
    for (const v of s.visitors) this.updateVisitor(v);
    s.visitors = s.visitors.filter((v) => !v.done);
    for (const v of s.vehicles) this.updateVehicle(v);
    s.vehicles = s.vehicles.filter((v) => !(v.home < 0 && v.order === -2));
    for (const a of s.animals) this.updateAnimal(a);
    this.checkTutorial();
    s.rng = this.rng.state;
  }

  private producers(mod: number) {
    const season = seasonOf(this.s.minute);
    const wf = this.weatherYield();
    for (const b of this.s.buildings) {
      const d = defOf(b);
      if (d.orchard && mod >= 6 * 60 && mod < 20 * 60) {
        const o = ORCHARDS[d.orchard];
        b.ready = Math.min(o.cap, b.ready + (o.taux * o.saisons[season] * wf * aptitude(this.region, o.id)) / 60);
      } else if (d.livestock) {
        const l = LIVESTOCK[d.livestock];
        if (!l.produit) continue;
        // l'étang produit sans animaux visibles ; les autres élevages au prorata des bêtes présentes
        const rate = l.nombre === 0 ? 1.4 : this.s.animals.filter((a) => a.pen === b.id).length * l.tauxParTete;
        const traite = ['vaches', 'chevres', 'brebis_lait'].includes(l.id) && this.has('robot_traite') ? 1.25 : 1;
        b.ready = Math.min(l.cap, b.ready + (rate * traite * l.saisons[season] * aptitude(this.region, l.id)) / 60);
      }
    }
  }

  private endOfDay() {
    const s = this.s;
    const prevDay = dayOf(s.minute) - 1;
    const l = s.ledger[s.ledger.length - 1];
    const save = s.minute;
    if (l && l.day === prevDay) s.minute -= 1; // comptabilise sur la veille
    for (const w of s.workers) this.paySalary(w);
    for (const b of s.buildings) {
      const d = defOf(b);
      let cost = d.entretien;
      // foin du domaine : nourrit les herbivores et réduit de 40 % le coût de nourriture de l'élevage
      if (d.livestock) {
        const n = s.animals.filter((a) => a.pen === b.id && HERBIVORES.has(a.kind)).length;
        const need = Math.ceil(n * (seasonOf(s.minute - 1) === 3 ? 0.8 : 0.4));
        if (need > 0 && this.stockOf('foin') >= need) {
          let left = need;
          for (const st of this.storagesFor('foin')) left -= this.remove(st, 'foin', left);
          cost = round2(cost * 0.6);
        }
      }
      this.book(d.activite, -cost, `Entretien — ${d.nom}`);
      if (d.effet === 'solaire') {
        const sun = { soleil: 1, nuageux: 0.5, pluie: 0.25, orage: 0.1, neige: 0.15 }[s.weather];
        this.book('general', round2(45 * sun * [0.9, 1.2, 0.8, 0.5][seasonOf(s.minute - 1)]), 'Électricité solaire revendue');
      }
    }
    economyDaily(this);
    s.minute = save;
    if (s.satSamples.length) {
      s.satisfaction = Math.round(s.satSamples.reduce((a, b) => a + b, 0) / s.satSamples.length);
      s.reputation = round2(Math.max(0, Math.min(100, s.reputation + (s.satisfaction - s.reputation) * 0.18 + Math.min(3, s.satSamples.length * 0.1))));
      s.satSamples = [];
    } else s.reputation = round2(Math.max(0, s.reputation - 0.5));
    const season = seasonOf(s.minute);
    const table = this.region.meteo[season];
    const kinds: Weather[] = ['soleil', 'nuageux', 'pluie', 'orage', 'neige'];
    let r = this.rng.next(), wi = 0;
    while (wi < 4 && r >= table[wi]) r -= table[wi++];
    s.weather = kinds[wi];
    for (const b of s.buildings) {
      const d = defOf(b);
      if (!d.crop || b.phase !== 'pousse') continue;
      const c = CROPS[d.crop];
      const irrigue = this.irrigated(b);
      b.growth = Math.min(1, b.growth + c.croissance[season] * this.weatherYield() * (irrigue ? 1.25 : 1));
      if (b.growth >= 1) {
        b.phase = 'mur';
        b.done = [];
        b.ready = round2(c.rendement * aptitude(this.region, c.id) * (1 + (b.bonus ?? 0) + (irrigue ? 0.15 : 0) + (this.has('drone') ? 0.08 : 0)));
        this.event(`${d.nom} : récolte possible (${Math.round(b.ready)} ${RESOURCES[c.produit].unite}).`, 'succes');
      }
    }
    if (dayOf(s.minute) % DAYS_PER_SEASON === 0) this.event(`Nouvelle saison : ${SEASONS[season]}.`, 'info');
    this.today();
    if (s.money < 0) this.event('Trésorerie négative : réduisez les charges ou vendez vos stocks.', 'alerte');
  }

  /** L'agent entre dans un bâtiment fermé (grange, atelier, boutique…) : il disparaît derrière la porte. */
  enter(a: Agent, b: Building) {
    const k = defOf(b).kind;
    if (!['maison', 'stock', 'atelier', 'boutique', 'accueil', 'gite', 'auberge', 'hangar', 'remise', 'garage'].includes(k)) return;
    a.hidden = true;
    a.inside = b.id;
  }

  /** Rendement météo ; la station météo divise les pertes par deux. */
  weatherYield() {
    const r = WEATHER[this.s.weather].rendement;
    return r < 1 && this.has('station_meteo') ? 1 - (1 - r) / 2 : r;
  }

  /** Parcelle à moins de 14 cases d'une réserve d'irrigation. */
  irrigated(b: Building) {
    return this.s.buildings.some((i) => defOf(i).effet === 'irrigation' && Math.hypot(i.x - b.x, i.y - b.y) < 14);
  }

  paySalary(w: Worker) {
    const sal = ROLES[w.role].salaire;
    const total = Object.values(w.minutes).reduce((a, b) => a + (b ?? 0), 0);
    if (total <= 0) this.book('general', -sal, `Salaires — ${ROLES[w.role].nom}`);
    else for (const [a, m] of Object.entries(w.minutes) as [Activity, number][]) if (m > 0) this.book(a, (-sal * m) / total, `Salaires — ${ROLES[w.role].nom}`);
    w.minutes = {};
  }

  // ————— déplacements —————
  navTo(a: Agent, kind: NavKind, tx: number, ty: number, field = -1): boolean {
    const sx = Math.round(a.x), sy = Math.round(a.y);
    // trajets fréquents mis en cache (vidé à chaque modification du monde)
    const key = `${kind}${field}:${sx},${sy}>${tx},${ty}`;
    let p: [number, number][] | null | undefined = this.paths.get(key);
    if (p) p = p.slice();
    else {
      p = findPath(this.s.world.w, this.s.world.h, sx, sy, tx, ty, this.cost(kind, field));
      if (p) {
        if (this.paths.size > 3000) this.paths.clear();
        this.paths.set(key, p.slice());
      }
    }
    if (!p) return false;
    a.path = p;
    a.moving = p.length > 0;
    return true;
  }

  /** Avance l'agent le long de son chemin. Retourne vrai à l'arrivée. */
  private move(a: Agent, speed: number): boolean {
    let budget = speed;
    while (budget > 0 && a.path.length) {
      const [nx, ny] = a.path[0];
      const dx = nx - a.x, dy = ny - a.y;
      const d = Math.hypot(dx, dy);
      if (d > 1e-6) a.dir = dirOf(dx, dy);
      if (d <= budget) {
        a.x = nx;
        a.y = ny;
        budget -= d;
        a.path.shift();
      } else {
        a.x += (dx / d) * budget;
        a.y += (dy / d) * budget;
        budget = 0;
      }
    }
    if (!a.path.length) a.moving = false;
    return !a.moving;
  }

  private terrainSpeed(a: Agent) {
    const t = this.s.world.terrain[Math.round(a.y) * this.s.world.w + Math.round(a.x)];
    return isPathLike(t) ? 1 : t === T.bois ? 0.6 : 0.8;
  }

  // ————— travailleurs —————
  abort(w: Worker | Visitor | Vehicle) {
    for (const b of this.s.buildings) if (b.busyBy === w.id) b.busyBy = null;
    w.steps = [];
    w.path = [];
    w.moving = false;
    w.timer = 0;
  }

  vehicleOf(w: Worker) {
    return w.vehicle != null ? this.s.vehicles.find((x) => x.id === w.vehicle) ?? null : null;
  }

  private updateWorker(w: Worker, mod: number) {
    const working = mod >= WORK_START && mod < WORK_END;
    if (working && (!w.hidden || w.vehicle != null || w.steps.length > 0)) w.minutes[w.activity] = (w.minutes[w.activity] ?? 0) + 1;
    const v = this.vehicleOf(w);
    if (v) {
      w.x = v.x;
      w.y = v.y;
    }
    if (w.moving) {
      if (v) {
        v.path = w.path;
        v.moving = true;
        const arrived = this.move(v, SPEED[v.kind as 'tracteur'] * (v.tool === 'charrue' || v.tool === 'semoir' ? 0.7 : 1));
        w.path = v.path;
        w.x = v.x;
        w.y = v.y;
        w.dir = v.dir;
        if (arrived) {
          w.moving = false;
          w.steps.shift();
        }
      } else if (this.move(w, SPEED.worker * this.terrainSpeed(w) * (w.role === 'eleveur' && this.has('garage_quad') ? 1.7 : 1))) w.steps.shift();
      return;
    }
    if (w.timer > 0) {
      w.timer--;
      if (w.timer <= 0) {
        this.finishStep(w);
        // ressort du bâtiment, sauf s'il y enchaîne une autre tâche
        const nx = w.steps[0];
        const stay = !!nx && 'b' in nx && nx.b === w.inside;
        if (w.hidden && w.vehicle == null && !stay) w.hidden = false;
      }
      return;
    }
    if (!w.steps.length) {
      if (!working && w.vehicle == null) {
        const home = this.s.buildings.find((b) => b.type === 'maison');
        if (w.hidden) return;
        if (home) {
          w.activity = 'general';
          w.steps = [...this.depositSteps(w), { k: 'go', ...xy(doorOf(home)) }, { k: 'rest', b: home.id }];
          w.label = 'Rentre au logis';
        }
      } else {
        if (w.hidden && w.vehicle == null) w.hidden = false;
        this.plan(w);
      }
      if (!w.steps.length) return;
    }
    this.startStep(w);
  }

  private depositSteps(w: Worker): Step[] {
    if (!w.carry) return [];
    const st = this.nearest(this.storagesFor(w.carry.res).filter((b) => this.space(b) >= 1), w.x, w.y);
    if (!st) return [];
    return [{ k: 'go', ...xy(doorOf(st)) }, { k: 'put', b: st.id }];
  }

  /** Choix d'une tâche selon le rôle : priorités explicites, testables. */
  plan(w: Worker) {
    if (w.vehicle != null) {
      w.steps = this.vehicleHome(w);
      return;
    }
    if (w.carry) {
      const dep = this.depositSteps(w);
      w.activity = 'general';
      w.label = dep.length ? 'Dépose sa charge' : 'Stock plein : attend de la place';
      w.steps = dep.length ? dep : [{ k: 'wait', min: 30, label: 'Stock plein' }];
      return;
    }
    const order: Record<Role, string[]> = {
      cultivateur: ['harvest', 'vines', 'fieldwork', 'orchard', 'restock', 'tendUrgent'],
      eleveur: ['animals', 'orchard', 'harvest', 'tendUrgent'],
      artisan: ['tendUrgent', 'process', 'restock', 'tend'],
      vendeur: ['tendUrgent', 'restock', 'tend'],
      saisonnier: ['orchard', 'handHarvest', 'restock'],
      guide: ['tendUrgent', 'guide', 'restock', 'tend'],
    };
    for (const task of order[w.role]) {
      const st = this.tryTask(w, task);
      if (st) {
        w.activity = st.a;
        w.label = st.label;
        w.steps = st.steps;
        return;
      }
    }
    const home = this.s.buildings.find((b) => b.type === 'maison');
    const [hx, hy] = home ? doorOf(home) : [Math.round(w.x), Math.round(w.y)];
    const tx = hx + this.rng.int(-2, 2), ty = hy + this.rng.int(0, 3);
    w.activity = 'general';
    w.label = 'En attente de travail';
    w.steps = isFinite(this.cost('worker')(tx, ty)) ? [{ k: 'go', x: tx, y: ty }, { k: 'wait', min: 20, label: 'En attente' }] : [{ k: 'wait', min: 20, label: 'En attente' }];
  }

  /** Engin disponible pour une opération de parcelle. */
  private machineFor(op: FieldOp, cropId: string): Vehicle | null {
    const c = CROPS[cropId];
    const kind: VehicleKind = op === 'recolte' && c.recolte === 'moissonneuse' ? 'moissonneuse' : 'tracteur';
    void c;
    if (op === 'recolte' && c.recolte === 'main') return null;
    return this.s.vehicles.find((v) => v.kind === kind && v.driver == null && this.byId.has(v.home)) ?? null;
  }

  private tileOrder(f: Building) {
    const todo = footprint(f).filter(([x, y]) => !f.done.includes(y * 10000 + x));
    // ordre en serpentin, plausible pour un engin
    todo.sort((a, b) => a[1] - b[1] || ((a[1] - f.y) % 2 ? b[0] - a[0] : a[0] - b[0]));
    return todo;
  }

  private tryTask(w: Worker, task: string): { a: Activity; label: string; steps: Step[] } | null {
    const B = this.s.buildings;
    const spaceTotal = this.totalSpace();
    if (task === 'orchard') {
      if (spaceTotal < 5) return null;
      const list = B.filter((b) => defOf(b).kind === 'verger' && b.ready >= (b.priority ? 3 : ORCHARDS[defOf(b).orchard!].cap < 20 ? 1 : 12) && this.spaceFor(ORCHARDS[defOf(b).orchard!].produit) >= 3);
      if (!list.length) return null;
      list.sort((a, b) => Number(b.priority) - Number(a.priority) || b.ready - a.ready);
      const b = list[0];
      const s = defOf(b).size;
      const tx = b.x + this.rng.int(0, s - 1), ty = b.y + this.rng.int(0, s - 1);
      return { a: defOf(b).activite, label: `Récolte : ${defOf(b).nom.toLowerCase()}`, steps: [{ k: 'go', x: tx, y: ty }, { k: 'pick', b: b.id }, { k: 'put', b: -1 }] };
    }
    if (task === 'animals') {
      const list = B.filter((b) => defOf(b).kind === 'enclos' && LIVESTOCK[defOf(b).livestock!].produit && b.ready >= (b.priority ? 1 : Math.max(1, LIVESTOCK[defOf(b).livestock!].cap * 0.15)));
      if (!list.length || spaceTotal < 3) return null;
      list.sort((a, b) => Number(b.priority) - Number(a.priority) || b.ready / LIVESTOCK[defOf(b).livestock!].cap - a.ready / LIVESTOCK[defOf(a).livestock!].cap);
      const b = list[0];
      return { a: defOf(b).activite, label: `Soins et collecte : ${defOf(b).nom.toLowerCase()}`, steps: [{ k: 'go', ...xy(this.gateOf(b)) }, { k: 'pick', b: b.id }, { k: 'put', b: -1 }] };
    }
    if (task === 'vines') {
      // vendange mécanique : machine enjambeuse sur les rangs de vigne
      const vm = this.s.vehicles.find((v) => v.kind === 'vendangeuse' && v.driver == null && this.byId.has(v.home));
      if (!vm || spaceTotal < 30) return null;
      const vines = B.filter((b) => b.type === 'verger_vigne' && b.busyBy == null && b.ready >= 30);
      if (!vines.length) return null;
      const f = vines.sort((a, b) => b.ready - a.ready)[0];
      const home = this.byId.get(vm.home)!;
      const steps: Step[] = [{ k: 'go', ...xy(doorOf(home)) }, { k: 'board', v: vm.id, tool: 'seul' }];
      for (const [x, y] of footprint(f).sort((a, b) => a[1] - b[1] || ((a[1] - f.y) % 2 ? b[0] - a[0] : a[0] - b[0]))) steps.push({ k: 'go', x, y, vehicle: true }, { k: 'vine', b: f.id });
      f.busyBy = w.id;
      steps.push(...this.vehicleReturn(vm, true));
      return { a: 'vigne', label: 'Vendanges à la machine', steps };
    }
    if (task === 'guide') {
      // le guide accueille à l'accueil, au gîte ou à la ferme pédagogique pendant les heures de visite
      const mod = minuteOfDay(this.s.minute);
      if (mod < VISIT_START - 30 || mod >= VISIT_END) return null;
      const spot = B.find((b) => ['accueil', 'auberge', 'gite'].includes(defOf(b).kind) && b.busyBy == null);
      if (!spot) return null;
      spot.busyBy = w.id;
      return { a: 'accueil', label: `Accueille les visiteurs (${defOf(spot).nom.toLowerCase()})`, steps: [{ k: 'go', ...xy(doorOf(spot)) }, { k: 'tend', b: spot.id, min: 60 }] };
    }
    if (task === 'handHarvest') task = 'harvest';
    if (task === 'harvest' || task === 'fieldwork') {
      const hasTractor = this.s.vehicles.some((v) => v.kind === 'tracteur' && this.byId.has(v.home));
      const needsTreatment = (b: Building) => b.phase === 'pousse' && hasTractor && !b.treated && b.growth >= 0.3 && b.growth < 0.9 && !CROPS[defOf(b).crop!].vivace;
      const want = (b: Building) => (task === 'harvest' ? b.phase === 'mur' : b.phase === 'labour' || b.phase === 'epandage' || b.phase === 'semis' || needsTreatment(b));
      const fields = B.filter((b) => defOf(b).crop && b.busyBy == null && want(b));
      if (!fields.length) return null;
      if (task === 'harvest' && spaceTotal < 10) return null;
      const f = fields.sort((a, b) => Number(b.priority) - Number(a.priority))[0];
      const crop = CROPS[defOf(f).crop!];
      const op: FieldOp = f.phase === 'mur' ? 'recolte' : f.phase === 'labour' ? 'labour' : f.phase === 'epandage' ? 'epandage' : f.phase === 'pousse' ? 'traitement' : 'semis';
      const todo = this.tileOrder(f);
      if (!todo.length) return null;
      const machine = w.role === 'saisonnier' ? null : this.machineFor(op, crop.id);
      const home = machine ? this.byId.get(machine.home) : null;
      const opName = { labour: 'Labour', epandage: 'Épandage', semis: 'Semis', traitement: 'Traitement', recolte: 'Récolte' }[op];
      if (op === 'traitement' && !(machine && home)) return null; // le traitement se fait au pulvérisateur
      if (machine && home) {
        const tool = { labour: 'charrue', epandage: 'epandeur', semis: 'semoir', traitement: 'pulverisateur', recolte: machine.kind === 'tracteur' ? (crop.look === 'pre' ? 'faneuse' : ['patate', 'betterave', 'lin'].includes(crop.look) ? 'arracheuse' : 'remorque') : 'seul' }[op];
        const steps: Step[] = [{ k: 'go', ...xy(doorOf(home)) }, { k: 'board', v: machine.id, tool }];
        for (const [x, y] of todo) steps.push({ k: 'go', x, y, vehicle: true }, { k: 'field', b: f.id, op });
        f.busyBy = w.id;
        steps.push(...this.vehicleReturn(machine, op === 'recolte'));
        return { a: defOf(f).activite, label: `${opName} ${machine.kind === 'moissonneuse' ? 'à la moissonneuse' : 'au tracteur'}`, steps };
      }
      // travail à la main : quelques cases par voyage
      const per = op === 'recolte' ? f.ready / Math.max(1, todo.length) : 0;
      const n = op === 'recolte' ? Math.max(1, Math.min(todo.length, Math.floor(CARRY / Math.max(1, per)))) : Math.min(todo.length, 4);
      const steps: Step[] = [];
      for (const [x, y] of todo.slice(0, n)) steps.push({ k: 'go', x, y }, { k: 'field', b: f.id, op });
      if (op === 'recolte') steps.push({ k: 'put', b: -1 });
      return { a: defOf(f).activite, label: `${opName} à la main`, steps };
    }
    if (task === 'process') {
      const cands: { b: Building; r: Recipe; ri: number; score: number }[] = [];
      for (const b of B) {
        const d = defOf(b);
        if (d.kind !== 'atelier' || b.busyBy != null) continue;
        d.recettes!.forEach((r, ri) => {
          const have = this.stockOf(r.input);
          if (have < r.inQty || this.totalSpace() + r.inQty < r.outQty) return;
          // on produit tant que le surplus peut s'écouler (boutique ou contrat négociant)
          const seuil = this.sellThreshold(r.output);
          if (!b.priority && this.stockOf(r.output) >= Math.max(PROCESS_TARGET, seuil >= 0 ? seuil + 60 : 0)) return;
          cands.push({ b, r, ri, score: (b.priority ? -1e6 : 0) + this.stockOf(r.output) / r.outQty - have / r.inQty / 100 });
        });
      }
      if (!cands.length) return null;
      cands.sort((a, b) => a.score - b.score);
      const { b, r, ri } = cands[0];
      const src = this.nearest(this.storages().filter((s) => (s.inv[r.input] ?? 0) >= r.inQty), b.x, b.y);
      if (!src) return null;
      b.busyBy = w.id;
      return {
        a: RESOURCES[r.output].activite,
        label: `${defOf(b).nom} : ${RESOURCES[r.output].nom.toLowerCase()}`,
        steps: [{ k: 'go', ...xy(doorOf(src)) }, { k: 'take', b: src.id, res: r.input, qty: r.inQty }, { k: 'go', ...xy(doorOf(b)) }, { k: 'process', b: b.id, r: ri }, { k: 'put', b: -1 }],
      };
    }
    if (task === 'restock') {
      for (const shop of B.filter((b) => defOf(b).kind === 'boutique')) {
        const free = this.space(shop);
        if (free < 4) continue;
        let best: Res | null = null, bestQ = Infinity;
        for (const r of RES_IDS) {
          if (!RESOURCES[r].boutique) continue;
          const q = shop.inv[r] ?? 0;
          if (q < 12 && this.stockOf(r) >= 1 && q < bestQ) {
            best = r;
            bestQ = q;
          }
        }
        if (!best) continue;
        const src = this.nearest(this.storages().filter((s) => (s.inv[best!] ?? 0) >= 1), shop.x, shop.y);
        if (!src) continue;
        const qty = Math.min(CARRY, free, 20 - bestQ);
        return { a: 'general', label: `Réassort : ${RESOURCES[best].nom.toLowerCase()}`, steps: [{ k: 'go', ...xy(doorOf(src)) }, { k: 'take', b: src.id, res: best, qty }, { k: 'go', ...xy(doorOf(shop)) }, { k: 'put', b: shop.id }] };
      }
      return null;
    }
    if (task === 'tendUrgent') {
      const waiting = B.find((b) => defOf(b).kind === 'boutique' && b.busyBy == null && this.s.visitors.some((v) => v.steps[0]?.k === 'shop' && (v.steps[0] as { b: number }).b === b.id && !v.moving));
      if (!waiting) return null;
      waiting.busyBy = w.id;
      return { a: 'general', label: 'Accourt à la caisse', steps: [{ k: 'go', ...xy(doorOf(waiting)) }, { k: 'tend', b: waiting.id, min: 30 }] };
    }
    if (task === 'tend') {
      const shop = B.find((b) => defOf(b).kind === 'boutique' && (b.busyBy == null || b.busyBy === w.id));
      if (!shop) return null;
      const mod = minuteOfDay(this.s.minute);
      if (mod < VISIT_START - 30 || mod >= VISIT_END) return null;
      shop.busyBy = w.id;
      return { a: 'general', label: 'Tient la boutique', steps: [{ k: 'go', ...xy(doorOf(shop)) }, { k: 'tend', b: shop.id, min: 40 }] };
    }
    return null;
  }

  /** Fin de tournée d'un engin : déchargement (si récolte) puis retour au hangar. */
  private vehicleReturn(v: Vehicle, unload: boolean): Step[] {
    const home = this.byId.get(v.home);
    const steps: Step[] = [];
    if (unload) {
      const st = this.nearest(this.storages(), v.x, v.y);
      if (st) steps.push({ k: 'go', ...xy(doorOf(st)), vehicle: true }, { k: 'unload', v: v.id, b: st.id });
    }
    if (home) steps.push({ k: 'go', ...xy(doorOf(home)), vehicle: true });
    steps.push({ k: 'alight', v: v.id });
    return steps;
  }

  /** Ramène l'engin conduit au hangar (en déchargeant d'abord si besoin). */
  vehicleHome(w: Worker): Step[] {
    const v = this.vehicleOf(w);
    if (!v || !this.byId.get(v.home)) {
      this.alight(w);
      return [];
    }
    return this.vehicleReturn(v, !!v.load);
  }

  gateOf(b: Building): [number, number] {
    const s = defOf(b).size;
    const cands: [number, number][] = [];
    for (let i = 0; i < s; i++) cands.push([b.x + i, b.y + s], [b.x + s, b.y + i], [b.x + i, b.y - 1], [b.x - 1, b.y + i]);
    const c = this.cost('worker');
    const valid = cands.filter(([x, y]) => isFinite(c(x, y)) && this.occ[y * this.s.world.w + x] < 0);
    valid.sort((p, q) => c(p[0], p[1]) - c(q[0], q[1]));
    return valid[0] ?? doorOf(b);
  }

  private startStep(w: Worker) {
    const st = w.steps[0];
    const fail = (why: string) => {
      this.abort(w);
      w.label = why;
      w.steps = w.vehicle != null ? this.vehicleHome(w) : [{ k: 'wait', min: 15, label: why }];
    };
    switch (st.k) {
      case 'go': {
        if (Math.round(w.x) === st.x && Math.round(w.y) === st.y && !w.path.length) {
          w.steps.shift();
          return;
        }
        if (st.vehicle) {
          const v = this.vehicleOf(w);
          const field = this.s.buildings.find((b) => b.busyBy === w.id && defOf(b).crop);
          if (!v) return fail('Engin introuvable');
          const p = findPath(this.s.world.w, this.s.world.h, Math.round(v.x), Math.round(v.y), st.x, st.y, this.cost('vehicle', field ? field.id : -1));
          if (!p) {
            this.event(`${w.nom} : l'engin ne trouve pas de route praticable.`, 'alerte');
            this.alight(w);
            this.abort(w);
            w.steps = [{ k: 'wait', min: 15, label: 'Route impraticable' }];
            return;
          }
          w.path = p;
          w.moving = p.length > 0;
          if (!w.moving) w.steps.shift();
          return;
        }
        if (!this.navTo(w, 'worker', st.x, st.y)) return fail('Chemin bloqué');
        if (!w.moving) w.steps.shift();
        return;
      }
      case 'pick': {
        const b = this.byId.get(st.b);
        const res = b && productOf(b);
        if (!b || !res || b.ready < 1) return fail('Rien à récolter');
        const q = Math.min(CARRY, Math.floor(b.ready), this.totalSpace());
        if (q < 1) return fail('Stock plein');
        b.ready -= q;
        w.carry = { res, qty: q };
        const animal = defOf(b).kind === 'enclos';
        w.timer = Math.ceil(Math.max(8, q * (animal ? (RESOURCES[res].unite === 'tête' ? 20 : 1.4) : 1.2)));
        w.label = animal ? 'Soigne les animaux' : 'Cueille';
        return;
      }
      case 'take': {
        const b = this.byId.get(st.b);
        if (!b) return fail('Stock introuvable');
        if (w.carry && w.carry.res !== st.res) return fail('Mains pleines');
        const q = this.remove(b, st.res, st.qty);
        if (q <= 0) return fail('Stock épuisé');
        w.carry = { res: st.res, qty: round2((w.carry?.qty ?? 0) + q) };
        w.timer = this.has('telescopique') ? 2 : 3;
        this.enter(w, b);
        return;
      }
      case 'put': {
        if (st.b === -1) {
          const dep = this.depositSteps(w);
          w.steps.shift();
          if (!w.carry) return;
          if (!dep.length) {
            w.steps.unshift({ k: 'wait', min: 30, label: 'Stock plein' });
            this.event('Grange pleine : construisez une grange ou vendez au négociant.', 'alerte');
            return;
          }
          w.steps.unshift(...dep);
          return;
        }
        const b = this.byId.get(st.b);
        if (!b || !w.carry) {
          w.steps.shift();
          return;
        }
        const q = defOf(b).kind === 'stock' && !this.canStore(b, w.carry.res) ? 0 : Math.min(this.space(b), w.carry.qty);
        if (q > 0) this.add(b, w.carry.res, q);
        w.carry.qty = round2(w.carry.qty - q);
        if (w.carry.qty <= 0) w.carry = null;
        w.timer = this.has('telescopique') ? 2 : 3;
        this.enter(w, b);
        return;
      }
      case 'process': {
        const b = this.byId.get(st.b);
        const r = b && defOf(b).recettes?.[st.r];
        if (!b || !r || !w.carry || w.carry.res !== r.input || w.carry.qty < r.inQty) return fail('Intrants manquants');
        w.timer = r.minutes;
        w.label = `${defOf(b).nom} : en production`;
        this.enter(w, b);
        return;
      }
      case 'tend': {
        const b = this.byId.get(st.b);
        if (!b) return fail('Boutique introuvable');
        b.busyBy = w.id;
        w.timer = st.min;
        w.label = { boutique: 'Tient la boutique', accueil: 'Accueille les visiteurs', gite: 'Prépare le gîte', auberge: 'En cuisine' }[defOf(b).kind as 'boutique'] ?? 'Tient la boutique';
        this.enter(w, b);
        return;
      }
      case 'rest':
        w.hidden = true;
        w.inside = st.b;
        w.label = 'Au repos';
        w.steps.shift();
        return;
      case 'board': {
        const v = this.s.vehicles.find((x) => x.id === st.v);
        if (!v || v.driver != null) return fail('Engin indisponible');
        v.driver = w.id;
        v.tool = st.tool;
        w.vehicle = v.id;
        w.hidden = true;
        w.inside = undefined;
        w.x = v.x;
        w.y = v.y;
        w.timer = 3; // attelage, mise en route
        return;
      }
      case 'field': {
        const b = this.byId.get(st.b);
        const want = st.op === 'recolte' ? 'mur' : st.op === 'traitement' ? 'pousse' : st.op;
        if (!b || b.phase !== want || (st.op === 'traitement' && b.treated)) {
          // opération déjà terminée : l'engin rentre (en déchargeant), le travailleur dépose sa charge
          w.steps = w.vehicle != null ? this.vehicleHome(w) : w.carry ? [{ k: 'put', b: -1 }] : [];
          return;
        }
        const v = this.vehicleOf(w);
        const crop = CROPS[defOf(b).crop!];
        w.timer = v ? { labour: 3, epandage: 2, semis: 2, traitement: 1, recolte: v.kind === 'moissonneuse' ? 3 : v.tool === 'arracheuse' || v.tool === 'faneuse' ? 2 : 4 }[st.op] : { labour: 14, epandage: 8, semis: 8, traitement: 6, recolte: crop.look === 'lavande' || crop.look === 'legumes' ? 7 : 10 }[st.op];
        w.label = `${{ labour: 'Laboure', epandage: 'Épand le fumier', semis: 'Sème', traitement: 'Traite la culture', recolte: 'Récolte' }[st.op]}${v ? (v.kind === 'moissonneuse' ? ' (moissonneuse)' : ' (tracteur)') : ' à la main'}`;
        return;
      }
      case 'vine': {
        const b = this.byId.get(st.b);
        if (!b || b.ready < 1) {
          w.steps = this.vehicleHome(w);
          return;
        }
        w.timer = 3;
        w.label = 'Vendange (machine à vendanger)';
        return;
      }
      case 'unload':
        w.timer = 8;
        w.label = 'Décharge';
        return;
      case 'alight':
        w.timer = 2;
        return;
      case 'wait':
        w.timer = st.min;
        w.label = st.label;
        return;
      default:
        w.steps.shift();
    }
  }

  private finishStep(w: Worker) {
    const st = w.steps.shift();
    if (!st) return;
    if (st.k === 'pick' && w.carry) {
      this.s.stats.harvested[w.carry.res] = round2((this.s.stats.harvested[w.carry.res] ?? 0) + w.carry.qty);
    } else if (st.k === 'process') {
      const b = this.byId.get(st.b);
      const r = b && defOf(b).recettes?.[st.r];
      if (b && r && w.carry && w.carry.res === r.input && w.carry.qty >= r.inQty) {
        w.carry.qty = round2(w.carry.qty - r.inQty);
        const rest = w.carry.qty > 0 ? { ...w.carry } : null;
        w.carry = { res: r.output, qty: r.outQty };
        if (rest) {
          const st2 = this.nearest(this.storages().filter((s) => this.space(s) >= rest.qty), b.x, b.y);
          if (st2) this.add(st2, rest.res, rest.qty);
        }
        this.book(RESOURCES[r.output].activite, -r.consommables, `Consommables — ${r.consoLabel}`);
        b.batches++;
        this.s.stats.batches++;
        this.s.stats.produced[r.output] = round2((this.s.stats.produced[r.output] ?? 0) + r.outQty);
      }
      if (b && b.busyBy === w.id) b.busyBy = null;
    } else if (st.k === 'tend') {
      const b = this.byId.get(st.b);
      if (b && b.busyBy === w.id) b.busyBy = null;
    } else if (st.k === 'field') {
      this.fieldTile(w, st.b, st.op);
    } else if (st.k === 'vine') {
      const b = this.byId.get(st.b);
      const v = this.vehicleOf(w);
      if (b && v && b.ready > 0) {
        const left = footprint(b).length - b.done.length;
        const q = round2(b.ready / Math.max(1, left));
        b.ready = round2(b.ready - q);
        v.load = { res: 'raisin', qty: round2((v.load?.qty ?? 0) + q) };
        this.s.stats.harvested.raisin = round2((this.s.stats.harvested.raisin ?? 0) + q);
        b.done.push(Math.round(w.y) * 10000 + Math.round(w.x));
        if (b.done.length >= footprint(b).length) b.done = [];
      }
    } else if (st.k === 'unload') {
      const v = this.s.vehicles.find((x) => x.id === st.v);
      const b = this.byId.get(st.b);
      if (v && v.load && b) {
        const q = this.canStore(b, v.load.res) ? Math.min(this.space(b), v.load.qty) : 0;
        this.add(b, v.load.res, q);
        v.load.qty = round2(v.load.qty - q);
        if (v.load.qty > 0) {
          // grange pleine : le reste part directement à la coopérative, au prix du négociant
          const r = v.load.res, rest = v.load.qty;
          const price = round2(RESOURCES[r].prix * wholesaleFactor(r));
          this.book(RESOURCES[r].activite, rest * price, `Coopérative — ${RESOURCES[r].nom}`);
          this.s.stats.sold[r] = round2((this.s.stats.sold[r] ?? 0) + rest);
          this.event(`Grange pleine : ${Math.round(rest)} ${RESOURCES[r].unite} livrés directement à la coopérative (${Math.round(rest * price)} €).`, 'info');
        }
        v.load = null;
      }
      for (const f of this.s.buildings) if (f.busyBy === w.id && (defOf(f).crop || defOf(f).kind === 'verger')) f.busyBy = null;
    } else if (st.k === 'alight') this.alight(w);
  }

  /** Une case de parcelle travaillée : labour, semis ou récolte. */
  private fieldTile(w: Worker, id: number, op: FieldOp) {
    const b = this.byId.get(id);
    if (!b) return;
    const crop = CROPS[defOf(b).crop!];
    const tiles = footprint(b);
    const left = tiles.filter(([x, y]) => !b.done.includes(y * 10000 + x));
    const tx = Math.round(w.x), ty = Math.round(w.y);
    const here = left.find(([x, y]) => x === tx && y === ty) ?? left[0];
    if (!here) return;
    if (op === 'traitement') {
      if (b.phase !== 'pousse' || b.treated) return;
    } else if (op === 'recolte') {
      if (b.phase !== 'mur') return;
      const q = round2(b.ready / Math.max(1, left.length));
      b.ready = round2(b.ready - q);
      const v = this.vehicleOf(w);
      if (v) v.load = { res: crop.produit, qty: round2((v.load?.qty ?? 0) + q) };
      else w.carry = { res: crop.produit, qty: round2((w.carry?.qty ?? 0) + q) };
      this.s.stats.harvested[crop.produit] = round2((this.s.stats.harvested[crop.produit] ?? 0) + q);
    } else if (b.phase !== op) return;
    b.done.push(here[1] * 10000 + here[0]);
    if (b.done.length >= tiles.length) {
      b.done = [];
      const hasTractor = this.s.vehicles.some((v) => v.kind === 'tracteur' && this.byId.has(v.home));
      if (op === 'labour') b.phase = hasTractor ? 'epandage' : 'semis';
      else if (op === 'epandage') {
        b.phase = 'semis';
        b.bonus = round2((b.bonus ?? 0) + 0.15);
        if (!this.has('compost')) this.book(defOf(b).activite, -FUMURE_COST, 'Fumure (épandage)');
      } else if (op === 'traitement') {
        b.treated = true;
        b.bonus = round2((b.bonus ?? 0) + 0.1);
        this.book(defOf(b).activite, -TRAITEMENT_COST, 'Traitement des cultures');
        if (b.busyBy === w.id && !this.vehicleOf(w)) b.busyBy = null;
      } else if (op === 'semis') {
        b.phase = 'pousse';
        b.growth = 0;
        this.book(defOf(b).activite, -crop.semence, `Semences — ${crop.nom}`);
      } else {
        b.ready = 0;
        b.growth = 0;
        b.bonus = 0;
        b.treated = false;
        b.phase = crop.vivace ? 'pousse' : 'labour';
        if (b.busyBy === w.id && !this.vehicleOf(w)) b.busyBy = null;
        this.event(`${defOf(b).nom} : récolte terminée.`, 'info');
      }
      if (op !== 'recolte' && b.busyBy === w.id && !this.vehicleOf(w)) b.busyBy = null;
    }
  }

  alight(w: Worker) {
    const v = this.vehicleOf(w);
    if (v) {
      v.driver = null;
      v.tool = 'seul';
      w.x = Math.round(v.x);
      w.y = Math.round(v.y);
    }
    w.vehicle = null;
    w.hidden = false;
    for (const f of this.s.buildings) if (f.busyBy === w.id && (defOf(f).crop || defOf(f).kind === 'verger')) f.busyBy = null;
  }

  // ————— visiteurs (en voiture) —————
  private spawnVisitors(mod: number) {
    const s = this.s;
    const shop = s.buildings.some((b) => defOf(b).kind === 'boutique');
    const accueil = s.buildings.some((b) => defOf(b).kind === 'accueil');
    if (!shop && !accueil) return;
    const season = seasonOf(s.minute);
    const perHour = (0.5 + s.reputation / 40) * WEATHER[s.weather].visiteurs * (accueil ? 1.7 : 1) * this.region.tourisme * (season === 1 ? 1.3 : season === 3 ? 0.6 : 1) * visitorMult(this);
    if (!this.rng.chance(perHour / 60)) return;
    const used = new Set(s.vehicles.filter((v) => v.kind === 'voiture').map((v) => v.slot));
    const slot = s.world.parking.findIndex((_, i) => !used.has(i));
    if (slot < 0) return;
    const [ex, ey] = s.world.entry;
    const car = this.addVehicle('voiture', null, ex, ey);
    car.look = this.rng.int(0, 2);
    car.slot = slot;
    car.passengers = this.rng.int(1, 3);
    // trajet impossible, ou arrivée trop tardive pour la boutique : la famille ne vient pas
    if (!this.navTo(car, 'vehicle', ...s.world.parking[slot]) || mod + car.path.length / SPEED.voiture > VISIT_END - 60) {
      s.vehicles = s.vehicles.filter((v) => v !== car);
      return;
    }
    car.steps = [{ k: 'go', ...xy(s.world.parking[slot]) }];
    car.label = 'Visiteurs en route';
  }

  /** La voiture est garée : la famille descend et part visiter. */
  private unloadCar(car: Vehicle) {
    const s = this.s;
    const [px, py] = s.world.parking[car.slot];
    const catalog = RES_IDS.filter((r) => RESOURCES[r].boutique);
    const shopB = s.buildings.find((b) => defOf(b).kind === 'boutique');
    const offer = catalog.filter((r) => (shopB?.inv[r] ?? 0) > 0 || this.stockOf(r) > 0);
    const acc = s.buildings.find((b) => b.type === 'accueil');
    const pedago = s.buildings.find((b) => b.type === 'pedagogique');
    const pois = s.buildings.filter((b) => ['verger', 'enclos', 'champ'].includes(defOf(b).kind));
    const loisirs = s.buildings.filter((b) => defOf(b).livestock && LIVESTOCK[defOf(b).livestock!].visite);
    const auberge = s.buildings.find((b) => defOf(b).kind === 'auberge');
    const mod = minuteOfDay(s.minute);
    const lunch = (mod >= 11 * 60 + 30 && mod < 14 * 60) || (mod >= 18 * 60 + 30 && mod < 20 * 60 + 30);
    const sejour = car.sejour != null ? this.byId.get(car.sejour) : undefined;
    // une famille : mêmes envies de repas et de loisirs pour tout le groupe
    const eat = !!auberge && (sejour ? this.rng.chance(0.5) : lunch && this.rng.chance(0.6));
    const fun = loisirs.length && this.rng.chance(0.65) ? this.rng.pick(loisirs) : null;
    const kids = !!pedago && this.rng.chance(0.55);
    const group = car.kind === 'bus' ? 'bus' : sejour ? 'sejour' : kids ? 'famille' : 'visite';
    for (let k = 0; k < car.passengers; k++) {
      const look = group === 'famille' && k > 0 ? this.rng.int(6, 7) : group === 'bus' ? this.rng.pick([0, 1, 2, 3, 4, 5, 8, 9]) : group === 'sejour' && this.rng.chance(0.4) ? this.rng.int(8, 9) : this.rng.int(0, 5);
      const v: Visitor = { ...newAgent(s.nextId++, px, py), look, budget: Math.round(this.rng.range(15, 60)), wishes: [], spent: 0, bought: 0, wanted: 0, waited: 0, visited: false, done: false, car: car.id };
      const n = this.rng.int(1, 3);
      for (let i = 0; i < n; i++) {
        const r = offer.length && this.rng.chance(0.75) ? this.rng.pick(offer) : this.rng.pick(catalog);
        if (v.wishes.some((x) => x.res === r)) continue;
        const u = RESOURCES[r].unite;
        const qty = this.rng.int(1, u === 'kg' ? 5 : RESOURCES[r].prix > 10 ? 2 : 4);
        v.wishes.push({ res: r, qty, maxPrice: round2(RESOURCES[r].prix * this.rng.range(0.85, 1.5)) });
        v.wanted += qty;
      }
      const steps: Step[] = [];
      if (sejour) {
        // vacanciers : installation au gîte, nuit sur place, départ le lendemain matin
        const until = s.minute - mod + DAY_MIN + 9 * 60 + this.rng.int(0, 60);
        steps.push({ k: 'go', ...xy(doorOf(sejour)) }, { k: 'stay', b: sejour.id, until });
        if (eat) steps.splice(1, 0, { k: 'go', ...xy(doorOf(auberge!)) }, { k: 'meal', b: auberge!.id }, { k: 'go', ...xy(doorOf(sejour)) });
        if (fun) steps.push({ k: 'go', ...xy(this.gateOf(fun)) }, { k: 'visit', b: fun.id });
      } else {
        if (acc) {
          steps.push({ k: 'go', ...xy(doorOf(acc)) }, { k: 'visit', b: acc.id });
          if (pois.length) {
            const p = this.rng.pick(pois);
            steps.push({ k: 'go', ...xy(this.gateOf(p)) }, { k: 'wait', min: this.rng.int(8, 16), label: 'Admire le domaine' });
          }
        }
        if (kids) steps.push({ k: 'go', ...xy(doorOf(pedago!)) }, { k: 'visit', b: pedago!.id });
        if (fun) steps.push({ k: 'go', ...xy(this.gateOf(fun)) }, { k: 'visit', b: fun.id });
        if (eat) steps.push({ k: 'go', ...xy(doorOf(auberge!)) }, { k: 'meal', b: auberge!.id });
        // attractions payantes (musée, labyrinthe) et cueillette dans les vergers
        const attr = s.buildings.filter((b) => defOf(b).tarif);
        if (attr.length && this.rng.chance(0.6)) {
          const a = this.rng.pick(attr);
          steps.push({ k: 'go', ...xy(doorOf(a)) }, { k: 'visit', b: a.id });
        }
        if (this.has('cueillette') && this.rng.chance(0.5)) {
          const vg = s.buildings.filter((b) => defOf(b).kind === 'verger' && b.ready >= 2 && RESOURCES[ORCHARDS[defOf(b).orchard!].produit].boutique);
          if (vg.length) {
            const g = this.rng.pick(vg);
            steps.push({ k: 'go', ...xy(this.gateOf(g)) }, { k: 'visit', b: g.id });
          }
        }
      }
      if (shopB) steps.push({ k: 'go', ...xy(doorOf(shopB)) }, { k: 'shop', b: shopB.id });
      steps.push({ k: 'go', x: px, y: py }, { k: 'leave' });
      v.steps = steps;
      v.label = group === 'sejour' ? 'Vacancier' : group === 'bus' ? 'Touriste (car)' : 'Visiteur';
      s.visitors.push(v);
      s.stats.visitors++;
    }
    car.label = 'Garée';
  }

  private updateVisitor(v: Visitor) {
    // dans un bâtiment (boutique, accueil, auberge, gîte) : invisible derrière la porte
    const cur = v.steps[0];
    if (v.timer <= 0 && v.hidden && !(cur && (cur.k === 'shop' || cur.k === 'meal' || cur.k === 'stay'))) v.hidden = false;
    if (v.moving) {
      if (this.move(v, SPEED.visitor * this.terrainSpeed(v))) v.steps.shift();
      return;
    }
    if (v.timer > 0) {
      v.timer--;
      const st = v.steps[0];
      if (st?.k === 'shop') {
        const b = this.byId.get(st.b);
        if (b && b.busyBy != null && this.s.workers.some((w) => w.id === b.busyBy && !w.moving && w.steps[0]?.k === 'tend')) {
          this.buy(v, b);
          v.timer = 4;
          v.steps[0] = { k: 'wait', min: 0, label: 'Ressort de la boutique' };
          v.hidden = false;
          return;
        }
        if (v.timer <= 0) {
          v.waited = 1;
          v.steps.shift();
          v.hidden = false;
        }
        return;
      }
      if (v.timer <= 0) {
        v.steps.shift();
        v.hidden = false;
      }
      return;
    }
    const st = v.steps[0];
    if (!st) {
      v.done = true;
      return;
    }
    switch (st.k) {
      case 'go':
        if (!this.navTo(v, 'visitor', st.x, st.y)) {
          const exit = [...v.steps].reverse().find((x) => x.k === 'go') as Extract<Step, { k: 'go' }>;
          v.waited = 1;
          if (st === exit || !this.navTo(v, 'visitor', exit.x, exit.y)) {
            v.steps = [{ k: 'leave' }];
            return;
          }
          v.steps = [exit, { k: 'leave' }];
          return;
        }
        if (!v.moving) v.steps.shift();
        return;
      case 'visit': {
        const b = this.byId.get(st.b);
        const d = b && defOf(b);
        const loisir = d?.livestock ? LIVESTOCK[d.livestock].visite : undefined;
        // un guide présent rend la visite plus agréable
        v.guided ||= !!b && b.busyBy != null && this.s.workers.some((w) => w.id === b.busyBy && w.role === 'guide');
        if (loisir) {
          if (this.rng.chance(0.75)) {
            this.book('accueil', loisir.prix, loisir.nom);
            v.visited = true;
          }
          v.timer = this.rng.int(15, 30);
          v.label = loisir.nom;
          return;
        }
        if (d?.tarif) {
          this.book('accueil', d.tarif, d.nom);
          v.visited = true;
          v.timer = d.effet === 'labyrinthe' ? 35 : 25;
          v.label = d.nom;
          if (d.effet === 'musee') this.enter(v, b!);
          return;
        }
        if (d?.kind === 'verger' && b) {
          // cueillette par les visiteurs : 2 unités au prix boutique
          const o = ORCHARDS[d.orchard!];
          const q = Math.min(2, Math.floor(b.ready));
          if (q > 0) {
            b.ready -= q;
            this.book(RESOURCES[o.produit].activite, round2(q * this.s.prices[o.produit] * priceBonus(this.s)), `Cueillette — ${RESOURCES[o.produit].nom}`);
            this.s.stats.sold[o.produit] = round2((this.s.stats.sold[o.produit] ?? 0) + q);
            v.visited = true;
          }
          v.timer = 20;
          v.label = 'Cueillette';
          return;
        }
        if (b?.type === 'pedagogique') {
          if (this.rng.chance(0.85)) {
            this.book('accueil', 6, 'Ateliers de la ferme pédagogique');
            v.visited = true;
          }
          v.timer = 25;
          v.label = 'Atelier pédagogique';
          this.enter(v, b);
          return;
        }
        if (b && this.s.visitFee <= this.rng.range(2, 9)) {
          this.book('accueil', this.s.visitFee, 'Visites de la ferme');
          v.visited = true;
        }
        v.timer = 5;
        v.label = 'À l\'accueil';
        if (b) this.enter(v, b);
        return;
      }
      case 'meal': {
        const b = this.byId.get(st.b);
        v.timer = 45;
        v.label = 'Déjeune à la ferme-auberge';
        if (!b) return;
        this.enter(v, b);
        // trois produits du domaine par repas ; à défaut de deux, la cuisine ne peut pas servir
        const foods = MEAL_FOODS.filter((r) => RESOURCES[r] && this.stockOf(r) >= 1);
        if (foods.length < 2) {
          v.timer = 4;
          v.waited = 1;
          v.label = 'Auberge : rien à servir';
          return;
        }
        for (let i = 0; i < 3; i++) {
          const r = foods[(i + v.id) % foods.length];
          let left = 1;
          for (const st2 of this.storages()) left -= this.remove(st2, r, left);
        }
        this.book('accueil', 24, 'Repas à la ferme-auberge');
        v.visited = true;
        return;
      }
      case 'stay': {
        const b = this.byId.get(st.b);
        if (!b) {
          v.steps.shift();
          return;
        }
        if (v.label !== 'En séjour') {
          this.book('accueil', defOf(b).nuitee ?? 20, `Nuitées — ${defOf(b).nom}`);
          v.visited = true;
        }
        v.timer = Math.max(1, st.until - this.s.minute);
        v.label = 'En séjour';
        this.enter(v, b);
        return;
      }
      case 'wait':
        v.timer = Math.max(1, st.min);
        v.label = st.label;
        return;
      case 'shop': {
        v.timer = 40;
        v.label = 'En boutique';
        const b = this.byId.get(st.b);
        if (b) this.enter(v, b);
        return;
      }
      case 'leave': {
        let sat = 45;
        if (v.wanted > 0) sat += 45 * (v.bought / v.wanted);
        if (v.waited) sat -= 30;
        if (v.visited) sat += 12;
        if (v.guided) sat += 8;
        if (this.has('mare')) sat += 5;
        if (this.has('aire_jeux')) sat += 6;
        if (labelActive(this.s, 'bienvenue')) sat += 3;
        this.s.satSamples.push(Math.max(0, Math.min(100, Math.round(sat))));
        const car = this.s.vehicles.find((c) => c.id === v.car);
        if (car) car.back++;
        v.done = true;
        return;
      }
      default:
        v.steps.shift();
    }
  }

  /** Vacanciers du gîte et du camping : arrivées en fin d'après-midi selon l'occupation attendue. */
  private spawnGuests() {
    const s = this.s;
    const season = seasonOf(s.minute);
    for (const g of s.buildings) {
      const d = defOf(g);
      if (d.kind !== 'gite' || !d.lits) continue;
      const camping = g.type === 'camping';
      const occ = Math.min(0.95, (0.2 + s.reputation / 130) * Math.sqrt(visitorMult(this)) * this.region.tourisme * WEATHER[s.weather].visiteurs * (camping ? [0.6, 1.6, 0.5, 0.05][season] : [0.9, 1.35, 0.8, 0.5][season]));
      const present = s.visitors.filter((v) => v.steps.some((x) => x.k === 'stay' && x.b === g.id)).length + s.vehicles.filter((c) => c.sejour === g.id && c.label === 'Visiteurs en route').reduce((a, c) => a + c.passengers, 0);
      const want = Math.round(d.lits * occ);
      if (present + 2 > want || !this.rng.chance(1 / 40)) continue;
      const used = new Set(s.vehicles.filter((v) => v.slot >= 0).map((v) => v.slot));
      const slot = s.world.parking.findIndex((_, i) => !used.has(i));
      if (slot < 0) return;
      const [ex, ey] = s.world.entry;
      const car = this.addVehicle('voiture', null, ex, ey);
      car.look = this.rng.int(0, 2);
      car.slot = slot;
      car.sejour = g.id;
      car.passengers = Math.min(d.lits - present, this.rng.int(2, 4));
      if (car.passengers < 1 || !this.navTo(car, 'vehicle', ...s.world.parking[slot])) {
        s.vehicles = s.vehicles.filter((v) => v !== car);
        continue;
      }
      car.steps = [{ k: 'go', ...xy(s.world.parking[slot]) }];
      car.label = 'Visiteurs en route';
      car.order = null;
    }
  }

  /** Navette de l'office de tourisme : un car le samedi et le dimanche. */
  private spawnBus() {
    const s = this.s;
    if (dayOf(s.minute) % 7 < 5 || !this.has('garage_bus') || !s.buildings.some((b) => defOf(b).kind === 'accueil')) return;
    const used = new Set(s.vehicles.filter((v) => v.slot >= 0).map((v) => v.slot));
    const slot = s.world.parking.findIndex((_, i) => !used.has(i));
    if (slot < 0) return;
    const [ex, ey] = s.world.entry;
    const bus = this.addVehicle('bus', null, ex, ey);
    bus.slot = slot;
    bus.passengers = this.rng.int(10, 14);
    if (!this.navTo(bus, 'vehicle', ...s.world.parking[slot])) {
      s.vehicles = s.vehicles.filter((v) => v !== bus);
      return;
    }
    bus.steps = [{ k: 'go', ...xy(s.world.parking[slot]) }];
    bus.label = 'Visiteurs en route';
    this.event(`Un car de ${bus.passengers} touristes arrive au domaine.`, 'info');
  }

  /** Utilitaire : tous les 3 jours, tournée au marché avec les produits de la boutique. */
  private marketTrip() {
    const s = this.s;
    const g = s.buildings.find((b) => b.type === 'garage_utilitaire');
    if (!g || dayOf(s.minute) % 3 !== 0 || s.vehicles.some((v) => v.kind === 'utilitaire')) return;
    const st = this.nearest(this.storages(), g.x, g.y);
    if (!st) return;
    const v = this.addVehicle('utilitaire', g);
    v.home = -1; // part et revient comme un véhicule de passage
    if (!this.navTo(v, 'vehicle', ...doorOf(st))) {
      s.vehicles = s.vehicles.filter((x) => x !== v);
      return;
    }
    v.steps = [{ k: 'go', ...xy(doorOf(st)) }, { k: 'wait', min: 12, label: 'Chargement' }, { k: 'go', ...xy(s.world.entry) }];
    v.label = 'Utilitaire : départ au marché';
  }

  private loadMarket(v: Vehicle) {
    if (v.cargo) return;
    v.cargo = {};
    let left = 80;
    // d'abord les produits transformés (meilleure marge), puis les produits frais
    const list = RES_IDS.filter((r) => RESOURCES[r].boutique).sort((a, b) => RESOURCES[b].prix - RESOURCES[a].prix);
    for (const r of list) {
      if (left <= 0) break;
      const keep = Math.max(10, this.sellThreshold(r) >= 0 ? 0 : 10);
      const q = Math.min(left, Math.floor(this.stockOf(r) - keep));
      if (q <= 0) continue;
      let l2 = q;
      for (const b of this.storages()) l2 -= this.remove(b, r, l2);
      v.cargo[r] = q - l2;
      left -= q - l2;
    }
    v.load = left < 80 ? { res: Object.keys(v.cargo)[0], qty: 80 - left } : null;
    v.label = 'Utilitaire : en route pour le marché';
  }

  private sellAtMarket(v: Vehicle) {
    let total = 0;
    for (const [r, q] of Object.entries(v.cargo ?? {})) {
      if (!q) continue;
      const amount = round2(q * this.s.prices[r] * 0.9 * priceBonus(this.s));
      total += amount;
      this.s.stats.sold[r] = round2((this.s.stats.sold[r] ?? 0) + q);
      this.book(RESOURCES[r].activite, amount, `Marché — ${RESOURCES[r].nom}`);
    }
    if (total > 0) this.event(`Marché du jour : ${Math.round(total)} € de ventes.`, 'succes');
    v.cargo = null;
  }

  private buy(v: Visitor, shop: Building) {
    const s = this.s;
    for (const wsh of v.wishes) {
      const price = s.prices[wsh.res];
      if (price > wsh.maxPrice * priceBonus(s)) continue;
      const q = Math.min(wsh.qty, Math.floor(shop.inv[wsh.res] ?? 0), Math.floor((v.budget - v.spent) / price));
      if (q <= 0) continue;
      this.remove(shop, wsh.res, q);
      v.spent = round2(v.spent + q * price);
      v.bought += q;
      s.stats.sold[wsh.res] = round2((s.stats.sold[wsh.res] ?? 0) + q);
      this.book(RESOURCES[wsh.res].activite, q * price, `Ventes boutique — ${RESOURCES[wsh.res].nom}`);
    }
  }

  /** Seuil effectif d'un contrat négociant (-2 = automatique, -1 = désactivé). */
  sellThreshold(res: Res): number {
    const v = this.s.autoSell[res] ?? -2;
    if (v !== -2) return v;
    // automatique : on garde de quoi alimenter les ateliers du domaine
    const input = this.s.buildings.some((b) => defOf(b).recettes?.some((r) => r.input === res));
    return input ? 300 : 150;
  }

  /** Contrats négociant : chaque matin, les stocks au-delà du seuil sont vendus en gros. */
  private autoSell() {
    for (const res of RES_IDS) {
      const seuil = this.sellThreshold(res);
      if (seuil < 0) continue;
      // option : attendre un cours au moins égal au prix de référence (sauf si les stocks débordent)
      if (this.s.waitMarket && (this.s.market[res] ?? 1) < 1 && this.stockOf(res) < seuil * 2.5) continue;
      const surplus = Math.floor(this.stockOf(res) - seuil);
      if (surplus >= 5) this.order(res, surplus, true);
    }
  }

  /** Vente au négociant : la marchandise est réservée tout de suite, payée à l'enlèvement. */
  order(res: Res, qty: number, auto = false): boolean {
    qty = Math.floor(qty);
    if (qty <= 0 || this.stockOf(res) < qty) return false;
    let left = qty;
    for (const b of this.storages()) left -= this.remove(b, res, left);
    const delay = 40 + Math.floor(this.rng.next() * 50);
    const price = wholesaleOf(this.s, res);
    this.s.orders.push({ id: this.s.nextId++, res, qty, price, status: 'attente', createdMin: this.s.minute, dueMin: this.s.minute + delay });
    this.event(`${auto ? 'Contrat négociant' : 'Commande négociant'} : ${qty} ${RESOURCES[res].unite} de ${RESOURCES[res].nom.toLowerCase()}, enlèvement d'ici ${delay} min.`, 'info');
    return true;
  }

  // ————— négociant (vente en gros) —————
  private processOrders() {
    const s = this.s;
    for (const o of s.orders) {
      if (o.status !== 'attente' || s.minute < o.dueMin) continue;
      const [ex, ey] = s.world.entry;
      const st = this.nearest(this.storages(), ex, ey);
      // les animaux vendus partent en bétaillère, le reste en camionnette
      const van = this.addVehicle(RESOURCES[o.res].unite === 'tête' ? 'betaillere' : 'camionnette', null, ex, ey);
      van.order = o.id;
      if (!st || !this.navTo(van, 'vehicle', ...doorOf(st))) {
        s.vehicles = s.vehicles.filter((v) => v !== van);
        this.cancelOrder(o, 'la camionnette ne peut pas atteindre la grange');
        continue;
      }
      van.steps = [{ k: 'go', ...xy(doorOf(st)) }, { k: 'wait', min: 15, label: 'Chargement' }, { k: 'go', x: ex, y: ey }];
      van.label = van.kind === 'betaillere' ? 'Bétaillère du négociant' : 'Camionnette du négociant';
      o.status = 'en route';
    }
    s.orders = s.orders.filter((o) => o.status === 'attente' || o.status === 'en route' || o.status === 'chargement' || s.minute - o.createdMin < DAY_MIN);
  }

  cancelOrder(o: Order, why: string) {
    let left = o.qty;
    for (const b of this.storages()) {
      const q = Math.min(left, this.space(b));
      if (q > 0) this.add(b, o.res, q);
      left -= q;
    }
    o.status = 'annulée';
    this.event(`Commande annulée : ${why}.`, 'alerte');
  }

  private updateVehicle(v: Vehicle) {
    if (v.kind === 'tracteur' || v.kind === 'moissonneuse' || v.kind === 'vendangeuse') return; // conduits par un travailleur
    if (v.moving) {
      if (this.move(v, SPEED[v.kind])) {
        v.steps.shift();
        if ((v.kind === 'voiture' || v.kind === 'bus') && v.label === 'Visiteurs en route') this.unloadCar(v);
      }
      return;
    }
    if ((v.kind === 'voiture' || v.kind === 'bus') && v.label === 'Garée') {
      if (v.back >= v.passengers) {
        v.label = 'Repart';
        if (!this.navTo(v, 'vehicle', ...this.s.world.entry)) v.order = -2;
        v.steps = [{ k: 'go', ...xy(this.s.world.entry) }];
      }
      return;
    }
    if (v.timer > 0) {
      v.timer--;
      if (v.timer <= 0) {
        v.steps.shift();
        const o = this.s.orders.find((x) => x.id === v.order);
        if (o && o.status === 'chargement') {
          v.load = { res: o.res, qty: o.qty };
          this.book(RESOURCES[o.res].activite, o.qty * o.price, `Négociant — ${RESOURCES[o.res].nom}`);
          this.s.stats.sold[o.res] = round2((this.s.stats.sold[o.res] ?? 0) + o.qty);
          o.status = 'livrée';
          this.event(`Le négociant a enlevé ${o.qty} ${RESOURCES[o.res].unite} de ${RESOURCES[o.res].nom.toLowerCase()} (${round2(o.qty * o.price)} €).`, 'succes');
        }
      }
      return;
    }
    const st = v.steps[0];
    if (!st) {
      if (v.kind === 'utilitaire') this.sellAtMarket(v);
      v.order = -2; // arrivé hors carte : retiré
      return;
    }
    if (st.k === 'go') {
      if (Math.round(v.x) === st.x && Math.round(v.y) === st.y) {
        v.steps.shift();
        return;
      }
      if (!this.navTo(v, 'vehicle', st.x, st.y)) v.order = -2;
      return;
    }
    if (st.k === 'wait') {
      if (v.kind === 'utilitaire') this.loadMarket(v);
      const o = this.s.orders.find((x) => x.id === v.order);
      if (o) o.status = 'chargement';
      v.timer = st.min;
      v.label = 'Chargement';
    }
  }

  // ————— animaux —————
  private updateAnimal(a: Animal) {
    if (a.pause > 0) {
      a.pause--;
      return;
    }
    const dx = a.tx - a.x, dy = a.ty - a.y;
    const d = Math.hypot(dx, dy);
    const sp = SPEED.animal * (a.kind === 'poule' || a.kind === 'canard' || a.kind === 'lapin' ? 1.2 : a.kind === 'vache' || a.kind === 'limousine' ? 0.7 : a.kind === 'cheval' ? 1.3 : 1);
    if (d < sp) {
      a.x = a.tx;
      a.y = a.ty;
      a.pause = this.rng.int(5, 40);
      if (a.pen >= 0) {
        const b = this.byId.get(a.pen);
        if (!b) return;
        [a.tx, a.ty] = this.penSpot(b);
      } else {
        const [cx, cy] = this.s.world.farm;
        a.tx = cx - 4 + this.rng.next() * 10;
        a.ty = cy - 2.8 + this.rng.next() * 4.6;
      }
      return;
    }
    a.dir = dirOf(dx, dy);
    a.x += (dx / d) * sp;
    a.y += (dy / d) * sp;
  }

  /** Point libre dans un enclos, hors de l'abri (étable et bergerie : 2×2 au fond ; autres : 1×1). */
  penSpot(b: Building): [number, number] {
    const s = defOf(b).size;
    const abri = LIVESTOCK[defOf(b).livestock!]?.abri;
    const sh = abri === 'etable' || abri === 'bergerie' || abri === 'ecurie' ? 2.3 : abri === 'rucher' ? 0 : abri === 'etang' ? 0 : 1.3;
    for (let k = 0; k < 8; k++) {
      const x = b.x + 0.3 + this.rng.next() * (s - 0.8), y = b.y + 0.4 + this.rng.next() * (s - 0.9);
      if (!(x < b.x + sh && y < b.y + sh)) return [x, y];
    }
    return [b.x + s - 0.6, b.y + s - 0.6];
  }

  // ————— tutoriel —————
  private checkTutorial() {
    const s = this.s;
    const sum = (o: Partial<Record<Res, number>>) => Object.values(o).reduce((a: number, b) => a + (b ?? 0), 0);
    const ok = [() => sum(s.stats.harvested) >= 20, () => s.stats.batches >= 1, () => sum(s.stats.produced) >= 20, () => sum(s.stats.sold) >= 10, () => s.stats.built >= 1];
    while (s.tutorial < ok.length && ok[s.tutorial]()) {
      s.tutorial++;
      this.event(s.tutorial >= ok.length ? 'Tutoriel terminé : le domaine est à vous !' : 'Objectif atteint !', 'succes');
    }
  }
}

export const TUTORIAL = [
  { titre: 'Récolter', texte: 'Récoltez 20 unités (fruits, lait, œufs, grain…). Le personnel s\'en charge ; touchez une parcelle et activez « Priorité » pour l\'y envoyer.' },
  { titre: 'Produire', texte: 'Lancez un premier lot dans votre atelier : l\'artisan va chercher la matière première à la grange.' },
  { titre: 'Transformer', texte: 'Produisez 20 unités de produits transformés.' },
  { titre: 'Vendre', texte: 'Vendez 10 produits (boutique ou négociant, menu Commerce).' },
  { titre: 'Investir', texte: 'Construisez un nouveau bâtiment (menu Construire) : culture, élevage, atelier, matériel…' },
];

/** Direction écran : 0 = vers le bas-droite (+x), 1 = bas-gauche (+y), 2 = haut-gauche (−x), 3 = haut-droite (−y). */
export function dirOf(dx: number, dy: number): number {
  const sx = dx - dy, sy = dx + dy;
  if (sy >= 0) return sx >= 0 ? 0 : 1;
  return sx < 0 ? 2 : 3;
}

export { BUILDINGS };
