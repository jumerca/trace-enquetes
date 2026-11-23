// Moteur de simulation : pas fixe d'une minute de jeu, RNG déterministe, aucune dépendance au rendu.
import {
  BUILDINGS, CARRY, DAY_MIN, DAYS_PER_SEASON, FIRST_NAMES, MILK_PER_GOAT_H, MILK_SEASON, ORCHARD_CAP, ORCHARD_RATE,
  ORCHARD_SEASON, PEN_MILK_CAP, RESOURCES, RES_IDS, ROLES, SEASONS, VISIT_END, VISIT_FEE_DEFAULT, VISIT_START, WEATHER, WEATHER_TABLE,
  WHEAT_GROWTH, WHEAT_SEED_COST, WHEAT_YIELD, WORK_END, WORK_START,
  type Activity, type Res, type Role, type Season, type Weather,
} from '../data/content';
import { Rng } from '../core/rng';
import { findPath } from '../nav/astar';
import { ENTRY_EAST, PARKING, generateWorld, isPathLike, T } from '../world/terrain';
import { buildOccupancy, defOf, doorOf, footprint, makeCost, type NavKind } from './geom';
import {
  SAVE_VERSION, type Agent, type Animal, type Building, type GameState, type LedgerDay, type Order, type Step, type Vehicle, type Visitor, type Worker,
} from './state';

export const SPEED = { worker: 0.35, visitor: 0.3, tracteur: 0.5, camionnette: 0.8, chevre: 0.05, poule: 0.06 };
const START_SEASON = 1;
/** Au-delà de ce stock de produit fini, l'atelier ne tourne plus (sauf priorité) : on produit pour vendre. */
export const PROCESS_TARGET = 80; // la partie commence en été

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

function newAgent(id: number, x: number, y: number): Agent {
  return { id, x, y, px: x, py: y, path: [], dir: 0, moving: false, timer: 0, steps: [], label: '', hidden: false };
}

export function newGame(seed = 1789): GameState {
  const world = generateWorld(seed);
  const rng = new Rng(seed ^ 0x5eed);
  const s: GameState = {
    version: SAVE_VERSION, seed, rng: 0, minute: 7 * 60, money: 18000, weather: 'soleil', reputation: 35, satisfaction: 60, satSamples: [],
    world, buildings: [], workers: [], visitors: [], vehicles: [], animals: [], orders: [],
    prices: Object.fromEntries(RES_IDS.map((r) => [r, RESOURCES[r].prix])) as Record<Res, number>,
    visitFee: VISIT_FEE_DEFAULT, ledger: [], stats: { harvested: {}, produced: {}, sold: {}, batches: 0, built: 0, visitors: 0 },
    tutorial: 0, nextId: 1, events: [],
  };
  const add = (type: string, x: number, y: number, rot: 0 | 1) => {
    const b: Building = { id: s.nextId++, type, x, y, rot, inv: {}, ready: 0, growth: 0, reaped: [], busyBy: null, priority: false, batches: 0, builtDay: 0 };
    s.buildings.push(b);
    return b;
  };
  add('maison', 43, 40, 0);
  const grange = add('grange', 48, 40, 0);
  grange.inv = { pommes: 30, jus: 12 };
  add('pressoir', 39, 44, 1);
  const shop = add('boutique', 54, 41, 0);
  shop.inv = { jus: 8, pommes: 10 };
  const verger = add('verger', 43, 49, 0);
  verger.ready = 46;
  s.ledger.push(emptyDay(0));
  const names = [...FIRST_NAMES];
  const pickName = () => names.splice(rng.int(0, names.length - 1), 1)[0];
  const sim = new Sim(s);
  sim.rng = rng;
  sim.hire('cultivateur', pickName(), true);
  sim.hire('artisan', pickName(), true);
  for (let i = 0; i < 5; i++) sim.addAnimal('poule', -1);
  s.rng = rng.state;
  s.events = [];
  sim.event('Bienvenue au domaine ! Récoltez, transformez et vendez pour le faire prospérer.', 'info');
  return s;
}

function emptyDay(day: number): LedgerDay {
  return { day, rev: {}, cost: {}, invest: 0, lines: [] };
}

export class Sim {
  rng: Rng;
  occ!: Int32Array;
  byId = new Map<number, Building>();
  private costCache = new Map<string, (x: number, y: number) => number>();
  /** compteur incrémenté à chaque modification du monde (bâtiments, terrain) : le rendu s'y synchronise */
  worldRev = 0;

  constructor(public s: GameState) {
    this.rng = new Rng(s.rng || s.seed);
    this.refresh();
  }

  refresh() {
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
  used(b: Building) {
    let n = 0;
    for (const r of RES_IDS) n += b.inv[r] ?? 0;
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

  nearest<T extends Building>(list: T[], x: number, y: number): T | null {
    let best: T | null = null, bd = Infinity;
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

  // ————— personnel, animaux —————
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
    // la charge éventuelle est rendue au stock le plus proche
    if (w.carry) {
      const st = this.nearest(this.storages().filter((b) => this.space(b) > 0), w.x, w.y);
      if (st) this.add(st, w.carry.res, Math.min(w.carry.qty, this.space(st)));
    }
    // salaire dû au prorata de la journée
    const worked = Object.values(w.minutes).reduce((a, b) => a + (b ?? 0), 0);
    if (worked > 0) this.paySalary(w);
    this.s.workers = this.s.workers.filter((x) => x !== w);
    this.event(`${w.nom} quitte le domaine.`, 'info');
    return true;
  }

  addAnimal(kind: 'chevre' | 'poule', pen: number) {
    let x = 46, y = 45;
    if (pen >= 0) {
      const b = this.byId.get(pen)!;
      x = b.x + 1 + this.rng.next() * 2;
      y = b.y + 1 + this.rng.next() * 2;
    } else {
      x = 44 + this.rng.next() * 8;
      y = 44 + this.rng.next() * 4;
    }
    const a: Animal = { id: this.s.nextId++, kind, pen, x, y, px: x, py: y, tx: x, ty: y, dir: 0, pause: 0, look: this.rng.int(0, 2) };
    this.s.animals.push(a);
  }

  // ————— boucle principale —————
  tick() {
    const s = this.s;
    s.minute++;
    const mod = minuteOfDay(s.minute);
    if (mod === 0) this.endOfDay();
    for (const a of [...s.workers, ...s.visitors, ...s.vehicles, ...s.animals]) {
      a.px = a.x;
      a.py = a.y;
    }
    this.producers(mod);
    if (mod >= VISIT_START && mod < VISIT_END) this.spawnVisitors();
    this.processOrders();
    for (const w of s.workers) this.updateWorker(w, mod);
    for (const v of s.visitors) this.updateVisitor(v);
    s.visitors = s.visitors.filter((v) => !v.done);
    for (const v of s.vehicles) this.updateVehicle(v);
    s.vehicles = s.vehicles.filter((v) => !(v.kind === 'camionnette' && v.order === null && !v.steps.length && !v.moving && v.timer <= 0));
    for (const a of s.animals) this.updateAnimal(a);
    this.checkTutorial();
    s.rng = this.rng.state;
  }

  private producers(mod: number) {
    const season = seasonOf(this.s.minute);
    const wf = WEATHER[this.s.weather].rendement;
    for (const b of this.s.buildings) {
      const k = defOf(b).kind;
      if (k === 'verger' && mod >= 6 * 60 && mod < 20 * 60) b.ready = Math.min(ORCHARD_CAP, b.ready + (ORCHARD_RATE * ORCHARD_SEASON[season] * wf) / 60);
      else if (k === 'enclos') {
        const goats = this.s.animals.filter((a) => a.pen === b.id).length;
        b.ready = Math.min(PEN_MILK_CAP, b.ready + (goats * MILK_PER_GOAT_H * MILK_SEASON[season]) / 60);
      }
    }
  }

  private endOfDay() {
    const s = this.s;
    const prevDay = dayOf(s.minute) - 1;
    // Salaires et entretien du jour écoulé (inscrits sur le jour écoulé)
    const l = s.ledger[s.ledger.length - 1];
    const save = s.minute;
    if (l && l.day === prevDay) s.minute -= 1; // comptabilise sur la veille
    for (const w of s.workers) this.paySalary(w);
    for (const b of s.buildings) this.book(defOf(b).activite, -defOf(b).entretien, `Entretien — ${defOf(b).nom}`);
    s.minute = save;
    // Satisfaction et réputation
    if (s.satSamples.length) {
      s.satisfaction = Math.round(s.satSamples.reduce((a, b) => a + b, 0) / s.satSamples.length);
      s.reputation = round2(Math.max(0, Math.min(100, s.reputation + (s.satisfaction - s.reputation) * 0.18 + Math.min(3, s.satSamples.length * 0.1))));
      s.satSamples = [];
    } else s.reputation = round2(Math.max(0, s.reputation - 0.5));
    // Météo du jour et cultures
    const season = seasonOf(s.minute);
    const table = WEATHER_TABLE[season];
    const kinds: Weather[] = ['soleil', 'nuageux', 'pluie', 'orage', 'neige'];
    let r = this.rng.next(), wi = 0;
    while (wi < 4 && r >= table[wi]) r -= table[wi++];
    s.weather = kinds[wi];
    for (const b of s.buildings) {
      if (defOf(b).kind !== 'champ' || b.ready > 0) continue;
      b.growth = Math.min(1, b.growth + WHEAT_GROWTH[season] * WEATHER[s.weather].rendement);
      if (b.growth >= 1) {
        b.ready = WHEAT_YIELD;
        this.event(`Le blé de la parcelle n°${b.id} est mûr : moisson possible.`, 'succes');
      }
    }
    if (dayOf(s.minute) % DAYS_PER_SEASON === 0) this.event(`Nouvelle saison : ${SEASONS[season]}.`, 'info');
    this.today();
    if (s.money < 0) this.event('Trésorerie négative : réduisez les charges ou vendez vos stocks.', 'alerte');
  }

  paySalary(w: Worker) {
    const sal = ROLES[w.role].salaire;
    const total = Object.values(w.minutes).reduce((a, b) => a + (b ?? 0), 0);
    if (total <= 0) this.book('general', -sal, `Salaires — ${ROLES[w.role].nom}`);
    else
      for (const [a, m] of Object.entries(w.minutes) as [Activity, number][]) if (m > 0) this.book(a, (-sal * m) / total, `Salaires — ${ROLES[w.role].nom}`);
    w.minutes = {};
  }

  // ————— déplacements —————
  private navTo(a: Agent, kind: NavKind, tx: number, ty: number, field = -1): boolean {
    const sx = Math.round(a.x), sy = Math.round(a.y);
    const p = findPath(this.s.world.w, this.s.world.h, sx, sy, tx, ty, this.cost(kind, field));
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

  private updateWorker(w: Worker, mod: number) {
    const working = mod >= WORK_START && mod < WORK_END;
    if (working && (!w.hidden || w.vehicle != null)) w.minutes[w.activity] = (w.minutes[w.activity] ?? 0) + 1;
    if (w.vehicle != null) {
      const v = this.s.vehicles.find((x) => x.id === w.vehicle);
      if (v) {
        w.x = v.x;
        w.y = v.y;
      }
    }
    if (w.moving) {
      const v = w.vehicle != null ? this.s.vehicles.find((x) => x.id === w.vehicle) : null;
      if (v) {
        v.path = w.path;
        v.moving = true;
        const arrived = this.move(v, SPEED.tracteur);
        w.path = v.path;
        w.x = v.x;
        w.y = v.y;
        w.dir = v.dir;
        if (arrived) {
          w.moving = false;
          w.steps.shift();
        }
      } else if (this.move(w, SPEED.worker * this.terrainSpeed(w))) w.steps.shift();
      return;
    }
    if (w.timer > 0) {
      w.timer--;
      if (w.timer <= 0) this.finishStep(w);
      return;
    }
    if (!w.steps.length) {
      // fin de journée : rentrer à la maison
      if (!working && w.vehicle == null) {
        const home = this.s.buildings.find((b) => b.type === 'maison');
        if (w.hidden) return;
        if (home) {
          w.activity = 'general';
          w.steps = w.carry ? [...this.depositSteps(w), { k: 'go', ...xy(doorOf(home)) }, { k: 'rest', b: home.id }] : [{ k: 'go', ...xy(doorOf(home)) }, { k: 'rest', b: home.id }];
          w.label = 'Rentre au logis';
        }
      } else {
        if (w.hidden) w.hidden = false;
        this.plan(w);
      }
      if (!w.steps.length) return;
    }
    this.startStep(w);
  }

  private depositSteps(w: Worker): Step[] {
    if (!w.carry) return [];
    const st = this.nearest(this.storages().filter((b) => this.space(b) >= 1), w.x, w.y);
    if (!st) return [];
    return [{ k: 'go', ...xy(doorOf(st)) }, { k: 'put', b: st.id }];
  }

  /** Choix d'une tâche selon le rôle : priorités explicites, testables. */
  plan(w: Worker) {
    const steps: Step[] = [];
    const set = (a: Activity, label: string, st: Step[]) => {
      w.activity = a;
      w.label = label;
      steps.push(...st);
    };
    if (w.carry) {
      const dep = this.depositSteps(w);
      if (dep.length) set('general', 'Dépose sa charge', dep);
      else set('general', 'Stock plein : attend de la place', [{ k: 'wait', min: 30, label: 'Stock plein' }]);
      w.steps = steps;
      return;
    }
    const order: Record<Role, string[]> = {
      cultivateur: ['wheat', 'orchard', 'restock', 'tendUrgent'],
      eleveur: ['milk', 'orchard', 'wheat', 'tendUrgent'],
      artisan: ['tendUrgent', 'process', 'restock', 'tend'],
      vendeur: ['tendUrgent', 'restock', 'tend'],
    };
    for (const task of order[w.role]) {
      const st = this.tryTask(w, task);
      if (st) {
        set(st.a, st.label, st.steps);
        break;
      }
    }
    if (!steps.length) {
      const home = this.s.buildings.find((b) => b.type === 'maison');
      const [hx, hy] = home ? doorOf(home) : [Math.round(w.x), Math.round(w.y)];
      const tx = hx + this.rng.int(-2, 2), ty = hy + this.rng.int(0, 3);
      const ok = isFinite(this.cost('worker')(tx, ty));
      set('general', 'En attente de travail', ok ? [{ k: 'go', x: tx, y: ty }, { k: 'wait', min: 20, label: 'En attente' }] : [{ k: 'wait', min: 20, label: 'En attente' }]);
    }
    w.steps = steps;
  }

  private tryTask(w: Worker, task: string): { a: Activity; label: string; steps: Step[] } | null {
    const B = this.s.buildings;
    const spaceTotal = this.totalSpace();
    if (task === 'orchard') {
      if (spaceTotal < 5) return null;
      const list = B.filter((b) => defOf(b).kind === 'verger' && (b.ready >= (b.priority ? 3 : 12)));
      if (!list.length) return null;
      list.sort((a, b) => Number(b.priority) - Number(a.priority) || b.ready - a.ready);
      const b = list[0];
      const s = defOf(b).size;
      const tx = b.x + this.rng.int(0, s - 1), ty = b.y + this.rng.int(0, s - 1);
      return { a: 'pomme', label: `Récolte au verger`, steps: [{ k: 'go', x: tx, y: ty }, { k: 'pick', b: b.id }, ...this.depositPlaceholder()] };
    }
    if (task === 'milk') {
      const list = B.filter((b) => defOf(b).kind === 'enclos' && b.ready >= (b.priority ? 2 : 8));
      if (!list.length || spaceTotal < 5) return null;
      list.sort((a, b) => Number(b.priority) - Number(a.priority) || b.ready - a.ready);
      const b = list[0];
      return { a: 'chevre', label: 'Traite des chèvres', steps: [{ k: 'go', ...xy(this.gateOf(b)) }, { k: 'pick', b: b.id }, ...this.depositPlaceholder()] };
    }
    if (task === 'wheat') {
      const fields = B.filter((b) => defOf(b).kind === 'champ' && b.ready > 0 && b.busyBy == null);
      if (!fields.length || spaceTotal < 10) return null;
      const f = fields.sort((a, b) => Number(b.priority) - Number(a.priority))[0];
      const todo = footprint(f).filter(([x, y]) => !f.reaped.includes(y * 1000 + x));
      // ordre en serpentin pour une moisson plausible
      todo.sort((a, b) => a[1] - b[1] || ((a[1] - f.y) % 2 ? b[0] - a[0] : a[0] - b[0]));
      const tractor = this.s.vehicles.find((v) => v.kind === 'tracteur' && v.driver == null);
      const hangar = tractor ? this.byId.get(tractor.home) : null;
      const st = this.nearest(this.storages(), f.x, f.y);
      if (tractor && hangar && st) {
        // trajet à pied jusqu'au tracteur, puis conduite
        const steps: Step[] = [{ k: 'go', ...xy(doorOf(hangar)) }, { k: 'board', v: tractor.id }];
        for (const [x, y] of todo) steps.push({ k: 'go', x, y, vehicle: true }, { k: 'reapTile', b: f.id });
        steps.push({ k: 'go', ...xy(doorOf(st)), vehicle: true }, { k: 'unload', v: tractor.id, b: st.id }, { k: 'go', ...xy(doorOf(hangar)), vehicle: true }, { k: 'alight', v: tractor.id });
        f.busyBy = w.id;
        return { a: 'ble', label: 'Moissonne au tracteur', steps };
      }
      // moisson manuelle : quelques cases par voyage (charge limitée)
      const per = f.ready / Math.max(1, todo.length);
      const n = Math.max(1, Math.min(todo.length, Math.floor(CARRY / Math.max(1, per))));
      const steps: Step[] = [];
      for (const [x, y] of todo.slice(0, n)) steps.push({ k: 'go', x, y }, { k: 'reapTile', b: f.id });
      steps.push(...this.depositPlaceholder());
      return { a: 'ble', label: 'Moisson à la faux', steps };
    }
    if (task === 'process') {
      const ateliers = B.filter((b) => defOf(b).kind === 'atelier' && b.busyBy == null);
      const cands = ateliers
        .map((b) => ({ b, r: defOf(b).recette!, have: this.stockOf(defOf(b).recette!.input) }))
        .filter((c) => c.have >= c.r.inQty && this.totalSpace() + c.r.inQty >= c.r.outQty && (c.b.priority || this.stockOf(c.r.output) < PROCESS_TARGET))
        // l'atelier dont le produit fini manque le plus en stock passe en premier (équilibre entre filières)
        .sort((a, b) => Number(b.b.priority) - Number(a.b.priority) || this.stockOf(a.r.output) / a.r.outQty - this.stockOf(b.r.output) / b.r.outQty || b.have / b.r.inQty - a.have / a.r.inQty);
      if (!cands.length) return null;
      const { b, r } = cands[0];
      const src = this.nearest(this.storages().filter((s) => (s.inv[r.input] ?? 0) >= r.inQty), b.x, b.y);
      if (!src) return null;
      b.busyBy = w.id;
      return {
        a: RESOURCES[r.output].activite,
        label: `${defOf(b).nom} : ${RESOURCES[r.output].nom.toLowerCase()}`,
        steps: [{ k: 'go', ...xy(doorOf(src)) }, { k: 'take', b: src.id, res: r.input, qty: r.inQty }, { k: 'go', ...xy(doorOf(b)) }, { k: 'process', b: b.id }, ...this.depositPlaceholder()],
      };
    }
    if (task === 'restock') {
      const shops = B.filter((b) => defOf(b).kind === 'boutique');
      for (const shop of shops) {
        const free = this.space(shop);
        if (free < 4) continue;
        // produit le moins présent en rayon (et disponible en stock)
        let best: Res | null = null, bestQ = Infinity;
        for (const r of RES_IDS) {
          if (!RESOURCES[r].boutique) continue;
          const q = shop.inv[r] ?? 0;
          const stock = this.stockOf(r);
          if (q < 12 && stock >= 1 && q < bestQ) {
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
      // des clients attendent à une caisse que personne ne tient
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

  /** Le dépôt est résolu au moment de partir (stock le plus proche ayant de la place). */
  private depositPlaceholder(): Step[] {
    return [{ k: 'put', b: -1 }];
  }

  gateOf(b: Building): [number, number] {
    // case praticable voisine de la parcelle, de préférence un chemin
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
      w.steps = [{ k: 'wait', min: 15, label: why }];
      if (w.vehicle != null) w.steps = this.tractorHome(w);
    };
    switch (st.k) {
      case 'go': {
        if (Math.round(w.x) === st.x && Math.round(w.y) === st.y && !w.path.length) {
          w.steps.shift();
          return;
        }
        if (st.vehicle) {
          const v = this.s.vehicles.find((x) => x.id === w.vehicle);
          const field = this.s.buildings.find((b) => b.busyBy === w.id && defOf(b).kind === 'champ');
          if (!v) return fail('Véhicule introuvable');
          const p = findPath(this.s.world.w, this.s.world.h, Math.round(v.x), Math.round(v.y), st.x, st.y, this.cost('vehicle', field ? field.id : -1));
          if (!p) {
            this.event(`${w.nom} : le tracteur ne trouve pas de route praticable.`, 'alerte');
            this.alight(w); // tracteur laissé sur place : il repartira de là
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
        if (!b || b.ready < 1) return fail('Rien à récolter');
        const isPen = defOf(b).kind === 'enclos';
        const q = Math.min(CARRY, Math.floor(b.ready), this.totalSpace());
        if (q < 1) return fail('Stock plein');
        b.ready -= q;
        w.carry = { res: isPen ? 'lait' : 'pommes', qty: q };
        w.timer = Math.ceil(q * (isPen ? 1.6 : 1.2));
        w.label = isPen ? 'Traite' : 'Cueille des pommes';
        return;
      }
      case 'take': {
        const b = this.byId.get(st.b);
        if (!b) return fail('Stock introuvable');
        if (w.carry && w.carry.res !== st.res) return fail('Mains pleines');
        const q = this.remove(b, st.res, st.qty);
        if (q <= 0) return fail('Stock épuisé');
        w.carry = { res: st.res, qty: round2((w.carry?.qty ?? 0) + q) };
        w.timer = 3;
        return;
      }
      case 'put': {
        if (st.b === -1) {
          // résolution tardive du dépôt
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
        const room = this.space(b);
        const q = Math.min(room, w.carry.qty);
        if (q > 0) this.add(b, w.carry.res, q);
        w.carry.qty = round2(w.carry.qty - q);
        if (w.carry.qty <= 0) w.carry = null;
        w.timer = 3;
        return;
      }
      case 'process': {
        const b = this.byId.get(st.b);
        const r = b && defOf(b).recette;
        if (!b || !r || !w.carry || w.carry.res !== r.input || w.carry.qty < r.inQty) return fail('Intrants manquants');
        w.timer = r.minutes;
        w.label = `${defOf(b).nom} : en production`;
        return;
      }
      case 'tend': {
        const b = this.byId.get(st.b);
        if (!b) return fail('Boutique introuvable');
        b.busyBy = w.id;
        w.timer = st.min;
        w.label = 'Tient la boutique';
        return;
      }
      case 'rest': {
        w.hidden = true;
        w.label = 'Au repos';
        w.steps.shift();
        return;
      }
      case 'board': {
        const v = this.s.vehicles.find((x) => x.id === st.v);
        if (!v || v.driver != null) return fail('Tracteur indisponible');
        v.driver = w.id;
        w.vehicle = v.id;
        w.hidden = true;
        w.x = v.x;
        w.y = v.y;
        w.timer = 2;
        return;
      }
      case 'reapTile': {
        const b = this.byId.get(st.b);
        if (!b || b.ready <= 0) {
          // parcelle déjà terminée : on saute directement au déchargement / dépôt
          const k = w.steps.findIndex((x) => x.k === 'unload' || x.k === 'put');
          w.steps = k < 0 ? [] : w.steps.slice(w.steps[k].k === 'unload' ? k - 1 : k);
          if (!w.steps.length && w.vehicle != null) w.steps = this.tractorHome(w);
          return;
        }
        w.timer = w.vehicle != null ? 4 : 9;
        w.label = w.vehicle != null ? 'Moissonne au tracteur' : 'Moissonne à la faux';
        return;
      }
      case 'unload': {
        w.timer = 8;
        w.label = 'Décharge la remorque';
        return;
      }
      case 'alight': {
        w.timer = 1;
        return;
      }
      case 'wait': {
        w.timer = st.min;
        w.label = st.label;
        return;
      }
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
      const r = b && defOf(b).recette;
      if (b && r && w.carry && w.carry.qty >= r.inQty) {
        w.carry.qty = round2(w.carry.qty - r.inQty);
        // un éventuel reliquat d'intrant est rapporté au stock lors d'un prochain dépôt
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
    } else if (st.k === 'reapTile') {
      const b = this.byId.get(st.b);
      if (b && b.ready > 0) {
        const left = footprint(b).filter(([x, y]) => !b.reaped.includes(y * 1000 + x));
        const tx = Math.round(w.x), ty = Math.round(w.y);
        const here = left.find(([x, y]) => x === tx && y === ty) ?? left[0];
        const q = round2(b.ready / Math.max(1, left.length));
        if (here) b.reaped.push(here[1] * 1000 + here[0]);
        b.ready = round2(b.ready - q);
        if (w.vehicle != null) {
          const v = this.s.vehicles.find((x) => x.id === w.vehicle)!;
          v.load = { res: 'ble', qty: round2((v.load?.qty ?? 0) + q) };
        } else w.carry = { res: 'ble', qty: round2((w.carry?.qty ?? 0) + q) };
        this.s.stats.harvested.ble = round2((this.s.stats.harvested.ble ?? 0) + q);
        if (b.reaped.length >= footprint(b).length || b.ready <= 0.01) {
          b.ready = 0;
          b.growth = 0;
          b.reaped = [];
          b.busyBy = null;
          this.book('ble', -WHEAT_SEED_COST, 'Semences de blé');
          this.event('Moisson terminée : la parcelle est ressemée.', 'info');
        }
      }
    } else if (st.k === 'unload') {
      const v = this.s.vehicles.find((x) => x.id === st.v);
      const b = this.byId.get(st.b);
      if (v && v.load && b) {
        const q = Math.min(this.space(b), v.load.qty);
        this.add(b, v.load.res, q);
        v.load.qty = round2(v.load.qty - q);
        if (v.load.qty <= 0) v.load = null;
        else this.event('Remorque non entièrement déchargée : grange pleine.', 'alerte');
      }
      for (const f of this.s.buildings) if (f.busyBy === w.id && defOf(f).kind === 'champ') f.busyBy = null;
    } else if (st.k === 'alight') {
      this.alight(w);
    }
  }

  /** Ramène le tracteur au hangar (en déchargeant d'abord la remorque si besoin). */
  tractorHome(w: Worker): Step[] {
    const v = this.s.vehicles.find((x) => x.id === w.vehicle);
    const hangar = v ? this.byId.get(v.home) : null;
    if (!v || !hangar) {
      this.alight(w);
      return [];
    }
    const steps: Step[] = [];
    const st = v.load ? this.nearest(this.storages().filter((b) => this.space(b) > 0), v.x, v.y) : null;
    if (st) steps.push({ k: 'go', ...xy(doorOf(st)), vehicle: true }, { k: 'unload', v: v.id, b: st.id });
    steps.push({ k: 'go', ...xy(doorOf(hangar)), vehicle: true }, { k: 'alight', v: v.id });
    return steps;
  }

  alight(w: Worker) {
    const v = this.s.vehicles.find((x) => x.id === w.vehicle);
    if (v) v.driver = null;
    w.vehicle = null;
    w.hidden = false;
    if (v) {
      w.x = Math.round(v.x);
      w.y = Math.round(v.y);
    }
    for (const f of this.s.buildings) if (f.busyBy === w.id && defOf(f).kind === 'champ') f.busyBy = null;
  }

  // ————— visiteurs —————
  private spawnVisitors() {
    const s = this.s;
    const shop = s.buildings.some((b) => defOf(b).kind === 'boutique');
    const accueil = s.buildings.some((b) => defOf(b).kind === 'accueil');
    const perHour = (0.5 + s.reputation / 35) * WEATHER[s.weather].visiteurs * (accueil ? 1.7 : 1) * (shop ? 1 : 0.3);
    if (!shop && !accueil) return;
    if (s.visitors.length >= 16 || !this.rng.chance(perHour / 60)) return;
    const [ex, ey] = PARKING;
    const v: Visitor = { ...newAgent(s.nextId++, ex, ey), look: this.rng.int(0, 5), budget: Math.round(this.rng.range(15, 60)), wishes: [], spent: 0, bought: 0, wanted: 0, waited: 0, visited: false, done: false };
    const catalog = RES_IDS.filter((r) => RESOURCES[r].boutique);
    // les visiteurs connaissent surtout ce que le domaine propose déjà (bouche-à-oreille)
    const shopB = s.buildings.find((b) => defOf(b).kind === 'boutique');
    const offer = catalog.filter((r) => (shopB?.inv[r] ?? 0) > 0 || this.stockOf(r) > 0);
    const n = this.rng.int(1, 3);
    for (let i = 0; i < n; i++) {
      const r = offer.length && this.rng.chance(0.75) ? this.rng.pick(offer) : this.rng.pick(catalog);
      if (v.wishes.some((x) => x.res === r)) continue;
      const qty = this.rng.int(1, r === 'pommes' || r === 'farine' ? 5 : r === 'fromage' ? 2 : 4);
      v.wishes.push({ res: r, qty, maxPrice: round2(RESOURCES[r].prix * this.rng.range(0.85, 1.5)) });
      v.wanted += qty;
    }
    const steps: Step[] = [];
    const acc = s.buildings.find((b) => defOf(b).kind === 'accueil');
    if (acc) {
      steps.push({ k: 'go', ...xy(doorOf(acc)) }, { k: 'visit', b: acc.id });
      const pois = s.buildings.filter((b) => ['verger', 'enclos', 'champ'].includes(defOf(b).kind));
      if (pois.length) {
        const p = this.rng.pick(pois);
        steps.push({ k: 'go', ...xy(this.gateOf(p)) }, { k: 'wait', min: this.rng.int(8, 16), label: 'Admire le domaine' });
      }
    }
    const boutique = s.buildings.find((b) => defOf(b).kind === 'boutique');
    if (boutique) steps.push({ k: 'go', ...xy(doorOf(boutique)) }, { k: 'shop', b: boutique.id });
    steps.push({ k: 'go', x: ex, y: ey }, { k: 'leave' });
    v.steps = steps;
    v.label = 'Visiteur';
    s.visitors.push(v);
    s.stats.visitors++;
  }

  private updateVisitor(v: Visitor) {
    if (v.moving) {
      if (this.move(v, SPEED.visitor * this.terrainSpeed(v))) v.steps.shift();
      return;
    }
    if (v.timer > 0) {
      v.timer--;
      const st = v.steps[0];
      if (st?.k === 'shop') {
        // attente d'un vendeur : l'achat a lieu dès que la caisse est tenue
        const b = this.byId.get(st.b);
        if (b && b.busyBy != null && this.s.workers.some((w) => w.id === b.busyBy && !w.moving && w.steps[0]?.k === 'tend')) {
          this.buy(v, b);
          v.timer = 4;
          v.steps[0] = { k: 'wait', min: 0, label: 'Ressort de la boutique' };
          return;
        }
        if (v.timer <= 0) {
          v.waited = 1;
          v.steps.shift();
        }
        return;
      }
      if (v.timer <= 0) v.steps.shift();
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
          // destination inaccessible : le visiteur repart, déçu
          const exit = [...v.steps].reverse().find((x) => x.k === 'go') as Extract<Step, { k: 'go' }>;
          v.waited = 1;
          if (st === exit || !this.navTo(v, 'visitor', exit.x, exit.y)) {
            v.done = true;
            return;
          }
          v.steps = [exit, { k: 'leave' }];
          return;
        }
        if (!v.moving) v.steps.shift();
        return;
      case 'visit': {
        const b = this.byId.get(st.b);
        const willing = this.rng.range(2, 9);
        if (b && this.s.visitFee <= willing) {
          this.book('accueil', this.s.visitFee, 'Visites de la ferme');
          v.visited = true;
        }
        v.timer = 5;
        v.label = 'À l\'accueil';
        return;
      }
      case 'wait':
        v.timer = Math.max(1, st.min);
        v.label = st.label;
        return;
      case 'shop':
        v.timer = 40;
        v.label = 'En boutique';
        return;
      case 'leave': {
        let sat = 45;
        if (v.wanted > 0) sat += 45 * (v.bought / v.wanted);
        if (v.waited) sat -= 30;
        if (v.visited) sat += 12;
        this.s.satSamples.push(Math.max(0, Math.min(100, Math.round(sat))));
        v.done = true;
        return;
      }
      default:
        v.steps.shift();
    }
  }

  private buy(v: Visitor, shop: Building) {
    const s = this.s;
    for (const wsh of v.wishes) {
      const price = s.prices[wsh.res];
      if (price > wsh.maxPrice) continue;
      const have = shop.inv[wsh.res] ?? 0;
      const q = Math.min(wsh.qty, Math.floor(have), Math.floor((v.budget - v.spent) / price));
      if (q <= 0) continue;
      this.remove(shop, wsh.res, q);
      v.spent = round2(v.spent + q * price);
      v.bought += q;
      s.stats.sold[wsh.res] = round2((s.stats.sold[wsh.res] ?? 0) + q);
      this.book(RESOURCES[wsh.res].activite, q * price, `Ventes boutique — ${RESOURCES[wsh.res].nom}`);
    }
  }

  // ————— négociant (vente en gros) —————
  private processOrders() {
    const s = this.s;
    for (const o of s.orders) {
      if (o.status !== 'attente' || s.minute < o.dueMin) continue;
      const st = this.nearest(this.storages(), ENTRY_EAST[0], ENTRY_EAST[1]);
      const van: Vehicle = { ...newAgent(s.nextId++, ENTRY_EAST[0], ENTRY_EAST[1]), kind: 'camionnette', home: -1, load: null, cap: 400, driver: null, order: o.id };
      if (!st || !this.navTo(van, 'vehicle', ...doorOf(st))) {
        this.cancelOrder(o, 'la camionnette ne peut pas atteindre la grange');
        continue;
      }
      // le premier trajet est déjà calculé (navTo) : l'étape « go » sera retirée à l'arrivée
      van.steps = [{ k: 'go', ...xy(doorOf(st)) }, { k: 'wait', min: 15, label: 'Chargement' }, { k: 'go', x: ENTRY_EAST[0], y: ENTRY_EAST[1] }];
      van.label = 'Camionnette du négociant';
      o.status = 'en route';
      s.vehicles.push(van);
    }
    s.orders = s.orders.filter((o) => o.status === 'attente' || o.status === 'en route' || o.status === 'chargement' || s.minute - o.createdMin < DAY_MIN);
  }

  cancelOrder(o: Order, why: string) {
    // la marchandise réservée retourne en stock
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
    if (v.kind === 'tracteur') return; // conduit par un travailleur
    if (v.moving) {
      if (this.move(v, SPEED.camionnette)) v.steps.shift();
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
      v.order = null;
      return;
    }
    if (st.k === 'go') {
      if (Math.round(v.x) === st.x && Math.round(v.y) === st.y) {
        v.steps.shift();
        if (!v.steps.length) v.order = null;
        return;
      }
      if (!this.navTo(v, 'vehicle', st.x, st.y)) {
        v.steps = [];
        v.order = null;
        return;
      }
      return;
    }
    if (st.k === 'wait') {
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
    const sp = a.kind === 'chevre' ? SPEED.chevre : SPEED.poule;
    if (d < sp) {
      a.x = a.tx;
      a.y = a.ty;
      a.pause = this.rng.int(5, 40);
      if (a.pen >= 0) {
        const b = this.byId.get(a.pen);
        if (!b) return;
        const s = defOf(b).size;
        a.tx = b.x + 0.25 + this.rng.next() * (s - 1.5);
        a.ty = b.y + 0.9 + this.rng.next() * (s - 1.2);
      } else {
        a.tx = 44 + this.rng.next() * 9;
        a.ty = 44.2 + this.rng.next() * 3.6;
      }
      return;
    }
    a.dir = dirOf(dx, dy);
    a.x += (dx / d) * sp;
    a.y += (dy / d) * sp;
  }

  // ————— tutoriel —————
  private checkTutorial() {
    const s = this.s;
    const ok = [
      () => (s.stats.harvested.pommes ?? 0) >= 20,
      () => s.stats.batches >= 1,
      () => (s.stats.produced.jus ?? 0) >= 20,
      () => (s.stats.sold.jus ?? 0) >= 10,
      () => s.stats.built >= 1,
    ];
    while (s.tutorial < ok.length && ok[s.tutorial]()) {
      s.tutorial++;
      this.event(s.tutorial >= ok.length ? 'Tutoriel terminé : le domaine est à vous !' : 'Objectif atteint !', 'succes');
    }
  }
}

export const TUTORIAL = [
  { titre: 'Récolter', texte: 'Récoltez 20 kg de pommes. Le cultivateur s\'en charge ; touchez le verger et activez « Priorité » pour l\'y envoyer.' },
  { titre: 'Produire', texte: 'Lancez un premier lot au pressoir : l\'artisan va chercher les pommes en grange.' },
  { titre: 'Transformer', texte: 'Produisez 20 bouteilles de jus de pomme.' },
  { titre: 'Vendre', texte: 'Vendez 10 bouteilles de jus (boutique ou négociant, menu Commerce).' },
  { titre: 'Investir', texte: 'Construisez un nouveau bâtiment (menu Construire) : enclos, champ, grange…' },
];

function xy(p: [number, number]) {
  return { x: p[0], y: p[1] };
}

/** Direction écran : 0 = vers le bas-droite (+x), 1 = bas-gauche (+y), 2 = haut-gauche (−x), 3 = haut-droite (−y). */
export function dirOf(dx: number, dy: number): number {
  const sx = dx - dy, sy = dx + dy; // repère écran
  if (sy >= 0) return sx >= 0 ? 0 : 1;
  return sx < 0 ? 2 : 3;
}

export { BUILDINGS };
