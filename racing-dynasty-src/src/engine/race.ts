// Moteur de course déterministe à pas fixe (10 Hz).
// Les positions, classements, dépassements, erreurs et arrêts sont entièrement calculés ici ;
// le rendu ne fait qu'afficher l'état (aucune animation décorative ne modifie l'ordre).
import { Rng } from './rng';
import { forwardDist, locate, type Track } from './track';
import { getTrack } from './tracks';
import {
  MODE_ERR, MODE_PACE, MODE_WEAR, physicsFor, profileLapTime, speedProfile, tyreFactor, tyreWearRate, COMPOUNDS,
  type CarPhysics,
} from './physics';
import type {
  CarEntry, ClassifiedResult, Compound, DriveMode, RaceCommand, RaceCommandInput, RaceConfig, RaceEvent, TeamOrder,
} from './types';

export const DT = 0.1;
export const CAR_LEN = 5.2;
export const CAR_W = 1.9;
export const LIGHTS_ON = 0.8; // intervalle d'allumage des feux de départ (s)
const LAT_CLEAR = CAR_W + 0.3; // séparation latérale minimale entre deux voitures côte à côte
const PIT_SPEED = 28; // 100 km/h
const CP = 50; // pas des points de chronométrage (m)
const MECH_FAILS = ['Moteur', 'Boîte de vitesses', 'Hydraulique', 'Freins', 'Électronique', 'Suspension'];
const SC_PACE = 0.6; // allure sous voiture de sécurité (fraction du profil)
const WET_RISE = 1 / 45; // humidification par seconde quand il pleut
const WET_DRY = 1 / 240; // séchage par seconde

/** Voiture de sécurité (n'est pas une concurrente : elle ne figure pas au classement). */
export interface SafetyCar {
  s: number;
  v: number;
  lat: number;
  prevS: number;
  prevLat: number;
  until: number; // instant à partir duquel elle peut rentrer
  phase: 'piste' | 'rentre';
}

export type PitPhase = 0 | 1 | 2 | 3; // 0 piste, 1 entrée, 2 arrêt, 3 sortie

export interface SimCar {
  id: string;
  e: CarEntry;
  idx: number; // index dans la grille
  teamIdx: number;
  phys: CarPhysics;
  prof: Float32Array;
  refLap: number; // temps de tour théorique (profil)
  s: number;
  v: number;
  lat: number;
  prevS: number;
  prevLat: number;
  lineOff: number;
  mode: DriveMode;
  compound: Compound;
  wear: number;
  stops: number;
  planIdx: number;
  pitReq: Compound | null;
  pit: PitPhase;
  pitTimer: number;
  pitBoxS: number;
  pitExitS: number;
  status: 'run' | 'retiring' | 'dnf' | 'done';
  reason?: string;
  laps: number;
  lapStartT: number;
  lastLap: number;
  bestLap: number;
  finishT: number;
  errTimer: number;
  errCap: number;
  errKind: 0 | 1 | 2 | 3; // 0 aucune, 1 blocage, 2 tout-droit, 3 tête-à-queue
  errLat: number;
  pass: null | { target: number; other: string; ok: boolean; timer: number; lap: boolean };
  cooldown: number;
  yieldTimer: number;
  yieldLat: number;
  noise: number;
  noiseTimer: number;
  startDelay: number;
  cpIdx: number; // dernier point de chronométrage franchi
  cpCross: number; // instant de ce franchissement
  gap: number; // écart au leader (s)
  interval: number; // écart à la voiture devant (s)
  position: number;
  gridPos: number;
  overtakes: number;
  launch: number; // qualité d'envol au départ
  damage: 0 | 1 | 2; // 0 aucun, 1 aileron avant, 2 crevaison
  penalty: number; // secondes
  wearWarn: number; // dernier palier d'usure annoncé à la radio
  used: Compound[]; // gommes utilisées pendant la course
}

export class RaceSim {
  readonly track: Track;
  readonly cfg: RaceConfig;
  readonly cars: SimCar[];
  readonly events: RaceEvent[] = [];
  readonly commands: RaceCommand[];
  private rng: Rng;
  private cpTimes: number[] = [];
  private cmdPtr = 0;
  private wearScale: number;
  private failHazard: number[];
  tick = 0;
  t = 0;
  flag = false; // drapeau à damier agité
  finished = false;
  fastest: { carId: string; time: number } | null = null;
  /** Instant d'extinction des feux (s) : 5 feux rouges s'allument un par un puis s'éteignent après un délai aléatoire. */
  lightsOut: number;
  /** Instant d'allumage du premier feu (0 sans tour de formation). */
  lightsStart = 0;
  /** Tour de formation en cours. */
  formation = false;
  private lightsHold: number;
  private gridS: number[] = [];
  private gridLat: number[] = [];
  /** Humidité de la piste (0 sec, 1 détrempé) et pluie en cours. */
  wet = 0;
  raining = false;
  /** Humidité maximale atteinte : au-delà de 0,3 la règle des deux gommes sèches est levée. */
  maxWet = 0;
  private wIdx = 0;
  sc: SafetyCar | null = null;
  /** Reprise après voiture de sécurité : pas de dépassement avant que le leader recoupe la ligne. */
  restartLap = -1;
  scCount = 0;
  teamOrders: Record<string, TeamOrder> = {};
  private radioLast: Record<string, number> = {};
  private profWet: Float32Array[] = [];
  private refWet: number[] = [];

  constructor(cfg: RaceConfig, commands: RaceCommand[] = []) {
    this.cfg = cfg;
    this.track = getTrack(cfg.trackId);
    this.rng = new Rng(cfg.seed);
    this.commands = [...commands].sort((a, b) => a.tick - b.tick);
    const tr = this.track;
    this.wearScale = (110 / cfg.laps) * (tr.def.wear / 3.6);
    const teams: string[] = [];
    this.cars = cfg.entries.map((e, i) => {
      if (!teams.includes(e.teamId)) teams.push(e.teamId);
      const phys = physicsFor(e, tr, 'sec');
      const prof = speedProfile(tr, phys);
      const wetProf = speedProfile(tr, physicsFor(e, tr, 'pluie'));
      this.profWet.push(wetProf);
      this.refWet.push(profileLapTime(tr, wetProf));
      const side = i % 2 === 0 ? 1 : -1;
      const s0 = -(8 + i * 8);
      const c: SimCar = {
        id: e.id, e, idx: i, teamIdx: 0, phys, prof, refLap: profileLapTime(tr, prof),
        s: s0, v: 0, lat: side * Math.min(2.6, tr.half - 1.6), prevS: s0, prevLat: 0,
        lineOff: this.rng.range(-0.6, 0.6),
        mode: 'normal', compound: e.startCompound, wear: 0, stops: 0, planIdx: 0, pitReq: null,
        pit: 0, pitTimer: 0, pitBoxS: 0, pitExitS: 0, status: 'run', laps: 0, lapStartT: 0, lastLap: 0, bestLap: 0,
        finishT: 0, errTimer: 0, errCap: 0, errKind: 0, errLat: 0, pass: null, cooldown: 3, yieldTimer: 0, yieldLat: 0,
        noise: 1, noiseTimer: 0,
        startDelay: 0.15 + this.rng.next() * 0.6 * (1.4 - e.driver.mental / 20),
        cpIdx: -1, cpCross: 0, gap: 0, interval: 0, position: i + 1, gridPos: i + 1, overtakes: 0,
        launch: 1, damage: 0, penalty: 0, wearWarn: 0, used: [e.startCompound],
      };
      c.launch = Math.max(0.8, Math.min(1.2, this.rng.normal(1, 0.07) + (e.driver.mental - 10) * 0.005));
      c.prevLat = c.lat;
      return c;
    });
    for (const c of this.cars) c.teamIdx = teams.indexOf(c.e.teamId);
    // Fiabilité : probabilité d'abandon mécanique sur la course, répartie par mètre parcouru.
    this.failHazard = this.cars.map((c) => (0.0045 * (21 - c.e.car.fiabilite)) / (cfg.laps * tr.length));
    this.lightsHold = 0.4 + this.rng.next() * 1.2;
    this.lightsOut = LIGHTS_ON * 5 + this.lightsHold;
    for (const c of this.cars) {
      c.lapStartT = this.lightsOut;
      this.gridS.push(c.s);
      this.gridLat.push(c.lat);
    }
    if (cfg.formation) {
      this.formation = true;
      this.lightsOut = Infinity;
      this.log('depart', 'Tour de formation : les pilotes chauffent leurs pneus.');
    }
    this.raining = cfg.weather === 'pluie';
    this.wet = this.raining ? 1 : 0;
    this.maxWet = this.wet;
  }

  /** Ajoute une consigne joueur à appliquer au prochain pas (enregistrée pour la reproductibilité). */
  issue(cmd: RaceCommandInput): RaceCommand {
    const full = { ...cmd, tick: this.tick } as RaceCommand;
    this.commands.push(full);
    return full;
  }

  car(id: string): SimCar | undefined {
    return this.cars.find((c) => c.id === id);
  }

  private log(kind: RaceEvent['kind'], text: string, carId?: string, otherId?: string): void {
    const leader = this.cars.reduce((a, b) => (b.s > a.s ? b : a), this.cars[0]);
    this.events.push({ t: this.t, lap: Math.min(this.cfg.laps, Math.max(1, leader.laps + 1)), kind, text, carId, otherId });
  }

  private applyCommands(): void {
    while (this.cmdPtr < this.commands.length && this.commands[this.cmdPtr].tick <= this.tick) {
      const cmd = this.commands[this.cmdPtr++];
      const c = this.car(cmd.carId);
      if (!c) continue;
      if (cmd.type === 'teamOrder') {
        this.teamOrders[c.e.teamId] = cmd.order;
        this.log('consigne', cmd.order === 'inverser' ? `Consigne d'équipe ${c.e.teamName} : inverser les positions.`
          : cmd.order === 'tenir' ? `Consigne d'équipe ${c.e.teamName} : tenir les positions.` : `Consigne d'équipe ${c.e.teamName} : course libre.`, c.id);
        continue;
      }
      if (c.status !== 'run') continue;
      if (cmd.type === 'mode') c.mode = cmd.mode;
      else if (cmd.type === 'pit') c.pitReq = cmd.compound;
      else if (cmd.type === 'cancelPit' && c.pit === 0) c.pitReq = null;
    }
  }

  /** Avance la simulation d'un pas. */
  step(): void {
    if (this.finished) return;
    this.applyCommands();
    if (this.formation) {
      this.formationStep();
      return;
    }
    if (this.t < this.lightsOut && this.t + DT >= this.lightsOut) this.log('depart', 'Feux éteints ! Départ du ' + this.track.def.gp + '.');
    const tr = this.track, L = tr.length, rng = this.rng;
    const order = this.cars.filter((c) => c.status !== 'dnf').sort((a, b) => b.s - a.s);
    for (const c of this.cars) {
      c.prevS = c.s;
      c.prevLat = c.lat;
    }
    this.updateWeather(order);
    this.updateSafetyCar(order);
    const sc = this.sc;
    const leaderLaps = order.length ? Math.max(...order.map((o) => o.laps)) : 0;
    const lap1 = this.t > this.lightsOut && leaderLaps === 0;
    const noOvertake = !!sc || leaderLaps < this.restartLap;
    for (const c of order) {
      const e = c.e;
      const { i: idx } = locate(tr, c.s);
      const corner = tr.corner[idx];
      const rl = tr.line[idx] + c.lineOff;
      const racing = c.status === 'run';

      // --- Vitesse visée ---
      c.noiseTimer -= DT;
      if (c.noiseTimer <= 0) {
        c.noiseTimer = 2;
        c.noise = 1 + rng.normal(0, 0.0022 * (1.35 - e.driver.regularite / 20));
      }
      let pace = tyreFactor(c.compound, c.wear, this.wet) * MODE_PACE[c.mode] * c.noise;
      pace *= 1 + (e.driver.pluie - 10) * 0.0009 * this.wet;
      pace *= e.form ?? 1;
      if (c.damage === 1) pace *= 0.985;
      if (c.damage === 2) pace *= 0.7;
      if (c.status === 'done') pace *= 0.8;
      const base = this.wet > 0 ? c.prof[idx] * (1 - this.wet) + this.profWet[c.idx][idx] * this.wet : c.prof[idx];
      let vt = base * pace;
      if (sc && c.status === 'run') vt = base * SC_PACE * (c.pit === 0 ? 1 : 1);
      if (this.t < this.lightsOut + c.startDelay) vt = 0;
      if (c.status === 'retiring') vt = 0;
      // Hors trajectoire en virage : perte de vitesse.
      vt *= 1 - 0.006 * Math.min(6, Math.abs(c.lat - rl)) * corner;
      let latTarget = rl;
      let latRate = 3.2;
      let boost = 1;

      // --- Erreurs de pilotage ---
      if (c.errTimer > 0) {
        c.errTimer -= DT;
        vt = Math.min(vt, c.errCap);
        if (c.errKind >= 2) latTarget = c.errLat;
        if (c.errTimer <= 0) c.errKind = 0;
      } else if (racing && !sc && c.pit === 0 && this.t > this.lightsOut + 4 && corner > 0.15) {
        this.maybeError(c, corner, order);
      }

      // --- Stands ---
      if (racing) this.pitLogic(c, idx);
      if (c.pit === 1) {
        latTarget = tr.pitLat;
        latRate = 4;
        if (Math.abs(c.lat) > tr.half + 1) vt = Math.min(vt, PIT_SPEED);
        const d = c.pitBoxS - c.s;
        const mate = this.cars.find((o) => o !== c && o.teamIdx === c.teamIdx && o.pit === 2);
        if (mate && d < 16) vt = 0;
        if (d < 30 && !mate) {
          latTarget = tr.boxLat;
          vt = Math.min(vt, Math.sqrt(Math.max(0, 2 * 7 * d)) + 0.5);
        }
        if (d <= 0.6 && !mate && Math.abs(c.lat - tr.boxLat) < 0.6) {
          c.pit = 2;
          c.v = 0;
          const crew = e.pitCrew;
          c.pitTimer = 2.2 + (20 - crew) * 0.07 + Math.abs(rng.normal(0, 0.3)) + (rng.chance(0.04) ? rng.range(2.5, 6) : 0) +
            (c.damage === 1 ? 6 : 0);
        }
      }
      if (c.pit === 2) {
        vt = 0;
        latTarget = tr.boxLat;
        c.pitTimer -= DT;
        if (c.pitTimer <= 0) {
          const from = c.compound;
          c.compound = c.pitReq ?? c.compound;
          if (!c.used.includes(c.compound)) c.used.push(c.compound);
          c.wear = 0;
          c.wearWarn = 0;
          if (c.damage) this.log('stand', `${e.short} : ${c.damage === 1 ? 'aileron avant remplacé' : 'roue crevée remplacée'}.`, c.id);
          c.damage = 0;
          c.stops++;
          c.pitReq = null;
          c.pit = 3;
          this.log('stand', `${e.short} change de pneus (${COMPOUNDS[from].name} → ${COMPOUNDS[c.compound].name}).`, c.id);
        }
      }
      if (c.pit === 3) {
        latTarget = c.s < c.pitExitS ? tr.pitLat : rl;
        latRate = 3;
        if (c.s < c.pitExitS) vt = Math.min(vt, PIT_SPEED);
        else if (Math.abs(c.lat) < tr.half - 0.5) c.pit = 0;
      }
      if (c.status === 'retiring') {
        latTarget = -tr.def.pitSide * (tr.half + 6);
        if (c.v < 0.2 && Math.abs(c.lat - latTarget) < 0.5) {
          c.status = 'dnf';
          c.v = 0;
        }
      }
      if (c.status === 'done') {
        latTarget = rl;
      }

      // --- Trafic : voiture devant dans le même couloir ---
      const onTrack = c.pit === 0 && c.status !== 'retiring';
      let ahead: SimCar | null = null;
      let aheadD = 70;
      for (const o of order) {
        if (o === c || o.status === 'dnf') continue;
        const d = forwardDist(tr, c.s, o.s);
        if (d <= 0 || d >= aheadD) continue;
        if (Math.abs(o.lat - c.lat) < LAT_CLEAR) {
          ahead = o;
          aheadD = d;
        }
      }
      // La voiture de sécurité est un obstacle comme une autre.
      let scAhead = -1;
      if (sc) {
        const d = forwardDist(tr, c.s, sc.s);
        if (d > 0 && d < 70 && Math.abs(sc.lat - c.lat) < LAT_CLEAR) {
          scAhead = d;
          if (d < aheadD) {
            aheadD = d;
            ahead = null;
          }
        }
      }
      // Voiture devant sur la trajectoire (même si décalée) pour les tentatives de dépassement.
      let target: SimCar | null = null;
      let targetD = 30;
      if (onTrack && c.status === 'run') {
        for (const o of order) {
          if (o === c || o.status === 'dnf' || o.pit !== 0) continue;
          const d = forwardDist(tr, c.s, o.s);
          if (d > 0 && d < targetD && Math.abs(o.lat - c.lat) < 4) {
            target = o;
            targetD = d;
          }
        }
      }
      if (c.cooldown > 0) c.cooldown -= DT;

      if (noOvertake && c.pass && !c.pass.lap) c.pass = null;
      if (target && !c.pass && c.cooldown <= 0 && targetD - CAR_LEN < (lap1 ? 18 : 14)) this.considerPass(c, target, idx, lap1, noOvertake);
      if (c.pass) {
        const p = c.pass;
        const o = this.car(p.other)!;
        const rel = forwardDist(tr, o.s, c.s); // > 0 si c est devant o
        const aheadOfOther = rel > 0 && rel < L / 2;
        p.timer -= DT;
        if (aheadOfOther && rel > CAR_LEN + 1.5) {
          if (p.ok && !p.lap && o.status === 'run') {
            c.overtakes++;
            if (o.e.teamId === e.teamId) {
              this.log('consigne', `${o.e.short} laisse passer son équipier ${e.short}.`, c.id, o.id);
              if (this.teamOrders[e.teamId] === 'inverser') this.teamOrders[e.teamId] = 'tenir';
            } else this.log('depassement', `${e.short} dépasse ${o.e.short}.`, c.id, o.id);
          }
          c.pass = null;
          c.cooldown = 2;
        } else if (p.timer <= 0 || o.pit !== 0 || (corner > (p.ok ? 0.8 : 0.45) && !aheadOfOther && !p.lap)) {
          if (!aheadOfOther && rel < CAR_LEN) vt *= 0.975; // cède la place en entrée de virage
          if (p.timer <= 0 || corner > 0.7 || o.pit !== 0) {
            c.pass = null;
            c.cooldown = p.ok ? 2 : 5;
          }
        } else {
          latTarget = p.target;
          if (p.ok) {
            vt *= p.lap ? 1.01 : 1.045; // aspiration + meilleure motricité + freinage plus tardif
            boost = 1.05;
            if (!p.lap && Math.abs(o.lat - c.lat) >= LAT_CLEAR && rel > -CAR_LEN * 1.5 && o.yieldTimer <= 0) { o.yieldTimer = 0.3; o.yieldLat = o.lat; }
          }
          else vt *= 0.998;
        }
      }
      if (c.yieldTimer > 0) {
        c.yieldTimer -= DT;
        latTarget = c.yieldLat;
        vt *= 0.985;
      }

      // Aspiration en ligne droite (plus forte de près).
      if (target && tr.zone[idx] && !sc) vt *= targetD < 30 ? 1.012 : targetD < 45 ? 1.006 : 1;
      // Sous voiture de sécurité : on recolle au peloton avant de s'aligner.
      if (sc && c.status === 'run' && c.pit === 0 && aheadD > 60) vt = base * 0.82;
      // Suivi : ne jamais rattraper la voiture de devant dans le même couloir.
      if (ahead || scAhead >= 0) {
        const aheadV = ahead ? ahead.v : sc!.v;
        const gap = aheadD - CAR_LEN;
        const follow = sc ? 9 + c.v * 0.12 : 1.6 + c.v * 0.1;
        if (gap < follow * 2.5) vt = Math.min(vt, aheadV + (gap - follow) * 0.9);
        if (!sc && gap < 22 && corner > 0.3) vt *= 0.994; // air turbulent
      }

      // --- Intégration longitudinale ---
      if (vt > c.v) {
        const r = c.v / (c.phys.vTop * boost);
        const launch = this.t < this.lightsOut + 6 ? c.launch : 1;
        const acc = c.phys.aAcc * Math.max(0.05, 1 - r * r * r) * (c.errKind === 3 ? 0.4 : 1) * launch;
        c.v = Math.min(vt, c.v + acc * DT);
      } else {
        const dec = (c.phys.brake + 0.0056 * c.v * c.v) * 1.4 + (c.status === 'retiring' ? 6 : 0);
        c.v = Math.max(Math.max(0, vt), c.v - dec * DT);
      }

      // --- Mouvement latéral, bloqué s'il créerait un chevauchement ---
      const limIn = tr.half - 1.1;
      if (c.pit === 0 && c.errKind < 2 && c.status === 'run') latTarget = Math.max(-limIn, Math.min(limIn, latTarget));
      const dl = Math.max(-latRate * DT, Math.min(latRate * DT, latTarget - c.lat));
      if (dl !== 0) {
        const nl = c.lat + dl;
        let blocked = false;
        for (const o of order) {
          if (o === c || o.status === 'dnf') continue;
          const d = forwardDist(tr, c.s, o.s);
          const along = Math.min(d, L - d);
          if (along < CAR_LEN + 0.9 && Math.abs(nl - o.lat) < LAT_CLEAR && Math.abs(nl - o.lat) < Math.abs(c.lat - o.lat)) {
            blocked = true;
            break;
          }
        }
        if (!blocked && sc) {
          const d = forwardDist(tr, c.s, sc.s);
          if (Math.min(d, L - d) < CAR_LEN + 0.9 && Math.abs(nl - sc.lat) < LAT_CLEAR && Math.abs(nl - sc.lat) < Math.abs(c.lat - sc.lat)) blocked = true;
        }
        if (!blocked) c.lat = nl;
      }

      // --- Avance + contrainte dure anti-collision ---
      let ns = c.s + c.v * DT;
      for (const o of order) {
        if (o === c || o.status === 'dnf') continue;
        if (Math.abs(o.lat - c.lat) >= LAT_CLEAR) continue;
        const d0 = forwardDist(tr, c.s, o.s);
        if (d0 <= 0 || d0 > L / 2) continue; // o n'est pas devant
        const room = d0 - CAR_LEN - 0.2;
        if (ns - c.s > room) {
          ns = c.s + Math.max(0, room);
          c.v = Math.min(c.v, o.v);
        }
      }
      if (sc && Math.abs(sc.lat - c.lat) < LAT_CLEAR) {
        const d0 = forwardDist(tr, c.s, sc.s);
        if (d0 > 0 && d0 < L / 2 && ns - c.s > d0 - CAR_LEN - 0.2) {
          ns = c.s + Math.max(0, d0 - CAR_LEN - 0.2);
          c.v = Math.min(c.v, sc.v);
        }
      }
      c.s = ns;

      // --- Usure, fiabilité ---
      if (c.status === 'run' && c.s > 0) {
        const dist = c.v * DT;
        const dr = e.driver;
        const setupWear = 1 + 0.5 * Math.abs(e.setup.suspension - tr.def.suspOpt) / 100;
        c.wear += (dist / L) * this.wearScale * tyreWearRate(c.compound, this.wet) *
          (1.15 - (dr.pneus / 20) * 0.3) * MODE_WEAR[c.mode] * setupWear * (sc ? 0.4 : 1);
        if (c.wear > 100) c.wear = 100;
        if (c.wear >= 70 && c.wearWarn < 70) {
          c.wearWarn = 70;
          this.radio(c, 'usure70', `Pneus à ${Math.round(c.wear)} %. Prépare-toi à rentrer.`);
        } else if (c.wear >= 90 && c.wearWarn < 90) {
          c.wearWarn = 90;
          this.radio(c, 'usure90', 'Les pneus sont finis ! Rentre au stand dès que possible.');
        }
        if (rng.next() < this.failHazard[c.idx] * dist) {
          this.retire(c, rng.pick(MECH_FAILS));
        }
      }

      // --- Tours, arrivée ---
      if (c.s >= 0 && c.status !== 'dnf') {
        const lapsNow = Math.floor(c.s / L);
        if (lapsNow > c.laps && c.status !== 'done') {
          const tc = this.t + DT * Math.min(1, Math.max(0, (lapsNow * L - c.prevS) / Math.max(1e-6, c.s - c.prevS)));
          const lt = tc - c.lapStartT;
          c.lapStartT = tc;
          c.laps = lapsNow;
          if (c.status === 'run') {
            c.lastLap = lt;
            if (c.laps > 1 && (c.bestLap === 0 || lt < c.bestLap)) c.bestLap = lt;
            if (c.laps > 1 && (!this.fastest || lt < this.fastest.time) && c.status === 'run') {
              this.fastest = { carId: c.id, time: lt };
              if (this.t > 100) this.log('meilleur-tour', `Meilleur tour pour ${e.short} : ${fmtLap(lt)}.`, c.id);
            }
          }
          if (c.status === 'run') {
            if (c.laps >= this.cfg.laps && !this.flag) {
              if (this.sc) {
                this.log('securite', 'La course se termine sous voiture de sécurité.');
                this.sc = null;
              }
              this.flag = true;
              this.log('drapeau', `Drapeau à damier ! Victoire de ${e.name} (${e.teamName}).`, c.id);
            }
            if (this.flag) {
              c.status = 'done';
              c.finishT = tc;
              if (!this.twoCompoundsOk(c)) {
                c.penalty += 20;
                this.log('penalite', `${e.short} n'a pas utilisé deux gommes sèches différentes : 20 s de pénalité.`, c.id);
              }
              c.pass = null;
              c.pitReq = null;
            } else {
              this.autoStrategy(c);
              if (c.laps === this.cfg.laps - 1) this.radio(c, 'dernier', 'Dernier tour, ramène-la à la maison !');
              if (c.laps >= this.cfg.laps - 3 && c.laps < this.cfg.laps - 1 && !this.twoCompoundsOk(c) && !c.pitReq) {
                this.radio(c, 'regle', 'Attention : il faut encore utiliser une autre gomme sèche, sinon 20 s de pénalité !', 200);
              }
              this.gapRadio(c);
            }
          }
        }
        // chronométrage
        const cp = Math.floor(c.s / CP);
        if (cp > c.cpIdx) {
          const tc = this.t + DT * Math.min(1, Math.max(0, (cp * CP - c.prevS) / Math.max(1e-6, c.s - c.prevS)));
          c.cpIdx = cp;
          c.cpCross = tc;
          if (this.cpTimes[cp] === undefined) this.cpTimes[cp] = tc;
        }
      }
    }
    this.tick++;
    this.t = this.tick * DT;
    this.updateOrder();
    if (this.flag && this.cars.every((c) => c.status === 'done' || c.status === 'dnf' || c.status === 'retiring')) {
      this.finished = true;
    }
    if (this.t > this.cfg.laps * 400) this.finished = true; // garde-fou
  }

  private maybeError(c: SimCar, corner: number, order: SimCar[]): void {
    const e = c.e, d = e.driver, rng = this.rng, tr = this.track;
    let f = (1.6 - (d.regularite / 20) * 1.2) * MODE_ERR[c.mode];
    const w = this.wet;
    if (c.compound === 'P') f *= w < 0.15 ? 1.5 : 1 + 1.2 * w * (1.4 - d.pluie / 20);
    else f *= 1 + 6 * w * (1.3 - d.pluie / 40);
    if (c.damage === 1) f *= 1.3;
    f *= Math.max(0.6, 1 + (1 - (e.form ?? 1)) * 25);
    if (c.wear > 70) f *= 1 + (c.wear - 70) / 15;
    // Pression d'un poursuivant proche.
    const chaser = order.find((o) => o !== c && o.status === 'run' && o.pit === 0 && forwardDist(tr, o.s, c.s) > 0 && forwardDist(tr, o.s, c.s) < 20);
    if (chaser) f *= 1.5 - d.mental / 40;
    const p = 2.2e-4 * corner * f * DT * 10;
    if (rng.next() >= p) return;
    const r = rng.next();
    const out = -Math.sign(tr.curv[locate(tr, c.s).i] || 1);
    if (r < 0.62) {
      c.errKind = 1;
      c.errTimer = 1.4;
      c.errCap = c.v * 0.8;
      this.log('erreur', `${e.short} bloque ses roues au freinage.`, c.id);
    } else if (r < 0.93) {
      c.errKind = 2;
      c.errTimer = 3.6;
      c.errCap = c.v * 0.55;
      c.errLat = out * (tr.half + 3);
      this.log('sortie', `${e.short} part tout droit et coupe par le dégagement !`, c.id);
    } else {
      c.errKind = 3;
      c.errTimer = 5;
      c.errCap = 3;
      c.errLat = out * (tr.half + 4);
      if (rng.chance(0.2)) {
        this.log('tete-a-queue', `${e.short} part en tête-à-queue et touche le mur.`, c.id);
        this.retire(c, 'Accident');
        c.errTimer = 0;
        c.errKind = 0;
      } else this.log('tete-a-queue', `Tête-à-queue de ${e.short} ! Il repart.`, c.id);
    }
    c.pass = null;
    c.cooldown = 4;
  }

  private retire(c: SimCar, reason: string): void {
    c.status = 'retiring';
    c.reason = reason;
    c.pass = null;
    c.pitReq = null;
    c.pit = 0;
    this.log('abandon', `Abandon de ${c.e.short} (${reason.toLowerCase()}).`, c.id);
    const p = reason === 'Accident' ? 0.75 : 0.2;
    const leader = this.cars.reduce((a, b) => (b.status === 'run' && b.s > a.s ? b : a), this.cars[0]);
    if (!this.sc && !this.flag && leader.laps < this.cfg.laps - 1 && this.t > this.lightsOut + 10 && this.rng.chance(p)) {
      this.deploySafetyCar(leader, reason === 'Accident' ? 'accident de ' + c.e.short : 'voiture de ' + c.e.short + ' arrêtée');
    }
  }

  private deploySafetyCar(leader: SimCar, why: string): void {
    const tr = this.track, L = tr.length;
    let s0 = leader.s + 70;
    for (let k = 0; k < 30; k++) {
      const clash = this.cars.some((o) => {
        if (o.status === 'dnf') return false;
        const d = forwardDist(tr, o.s, s0);
        return Math.min(d, L - d) < 14;
      });
      if (!clash) break;
      s0 += 12;
    }
    const lat = tr.line[locate(tr, s0).i];
    this.sc = { s: s0, v: leader.v * 0.6, lat, prevS: s0, prevLat: lat, until: this.t + 70 + this.rng.range(0, 40), phase: 'piste' };
    this.scCount++;
    this.log('securite', `Voiture de sécurité déployée (${why}).`);
    for (const c of this.cars) {
      c.pass = null;
      if (c.status !== 'run') continue;
      this.radio(c, 'sc', 'Voiture de sécurité ! Un arrêt maintenant coûte beaucoup moins de temps.', 0);
      // L'IA profite de la neutralisation pour s'arrêter si ses pneus ont vécu.
      if (!c.e.isPlayer && !c.pitReq && c.wear > 35 && c.laps < this.cfg.laps - 2) c.pitReq = this.bestCompound(c);
    }
  }

  /** Tour de formation : file indienne à allure réduite, puis retour exact sur la case de grille. */
  private formationStep(): void {
    const tr = this.track, L = tr.length;
    const order = [...this.cars].sort((a, b) => b.s - a.s);
    for (const c of this.cars) {
      c.prevS = c.s;
      c.prevLat = c.lat;
    }
    let settled = true;
    for (const c of order) {
      const target = this.gridS[c.idx] + L;
      const left = target - c.s;
      const { i } = locate(tr, c.s);
      let vt = Math.min(c.prof[i] * (this.wet > 0.3 ? 0.5 : 0.6), Math.sqrt(Math.max(0, 2 * 5 * left)));
      if (this.t < 1 + c.idx * 0.25) vt = 0; // départ échelonné de la grille
      // suivre la voiture qui précède sans jamais la toucher
      for (const o of order) {
        if (o === c || Math.abs(o.lat - c.lat) >= LAT_CLEAR) continue;
        const d = forwardDist(tr, c.s, o.s);
        if (d > 0 && d < 40) vt = Math.min(vt, o.v + (d - CAR_LEN - 6) * 0.6);
      }
      vt = Math.max(0, vt);
      c.v = vt > c.v ? Math.min(vt, c.v + 6 * DT) : Math.max(vt, c.v - 9 * DT);
      // trajectoire puis retour sur sa colonne de grille dans les 250 derniers mètres
      const latT = left < 250 ? this.gridLat[c.idx] : tr.line[i];
      const nl = c.lat + Math.max(-2 * DT, Math.min(2 * DT, latT - c.lat));
      let blocked = false;
      for (const o of order) {
        if (o === c) continue;
        const d = forwardDist(tr, c.s, o.s);
        if (Math.min(d, L - d) < CAR_LEN + 0.9 && Math.abs(nl - o.lat) < LAT_CLEAR && Math.abs(nl - o.lat) < Math.abs(c.lat - o.lat)) blocked = true;
      }
      if (!blocked) c.lat = nl;
      let ns = Math.min(target, c.s + c.v * DT);
      for (const o of order) {
        if (o === c || Math.abs(o.lat - c.lat) >= LAT_CLEAR) continue;
        const d0 = forwardDist(tr, c.s, o.s);
        if (d0 > 0 && d0 < L / 2 && ns - c.s > d0 - CAR_LEN - 0.2) ns = c.s + Math.max(0, d0 - CAR_LEN - 0.2);
      }
      c.s = ns;
      if (target - c.s > 0.3 || Math.abs(c.lat - this.gridLat[c.idx]) > 0.3 || c.v > 0.1) settled = false;
    }
    this.tick++;
    this.t = this.tick * DT;
    if (settled || this.t > 600) {
      // en place : on ramène les abscisses d'un tour en arrière (même position physique)
      for (const c of this.cars) {
        c.s = this.gridS[c.idx];
        c.prevS = c.s;
        c.lat = c.prevLat = this.gridLat[c.idx];
        c.v = 0;
      }
      this.formation = false;
      this.lightsStart = this.t + 1.5;
      this.lightsOut = this.lightsStart + LIGHTS_ON * 5 + this.lightsHold;
      for (const c of this.cars) c.lapStartT = this.lightsOut;
      this.log('depart', 'Les voitures sont en place sur la grille.');
    }
  }

  /** Règle des deux gommes sèches (levée si la piste a été mouillée ou si des pneus pluie ont servi). */
  twoCompoundsOk(c: SimCar): boolean {
    if (this.maxWet >= 0.3 || c.used.includes('P')) return true;
    return new Set(c.used).size >= 2;
  }

  /** Gomme conseillée selon l'humidité et le nombre de tours restants. */
  private bestCompound(c: SimCar): Compound {
    if (this.wet > 0.3 || (this.raining && this.wet > 0.15)) return 'P';
    const remaining = this.cfg.laps - c.laps;
    let pick: Compound = remaining <= this.cfg.laps * 0.35 ? 'T' : c.compound === 'D' ? 'M' : remaining > this.cfg.laps * 0.6 ? 'D' : 'M';
    if (pick === c.compound && new Set(c.used).size < 2) pick = pick === 'M' ? (remaining <= this.cfg.laps * 0.4 ? 'T' : 'D') : 'M';
    return pick;
  }

  private updateSafetyCar(order: SimCar[]): void {
    const sc = this.sc;
    if (!sc) return;
    const tr = this.track;
    sc.prevS = sc.s;
    sc.prevLat = sc.lat;
    const { i } = locate(tr, sc.s);
    const vt = (this.wet > 0 ? this.cars[0].prof[i] * (1 - this.wet) + this.profWet[0][i] * this.wet : this.cars[0].prof[i]) * SC_PACE;
    const L = tr.length;
    // Déplacement latéral refusé s'il crée un chevauchement (même règle que les concurrentes).
    const moveLat = (target: number, rate: number) => {
      const nl = sc.lat + Math.max(-rate, Math.min(rate, target - sc.lat));
      for (const o of order) {
        const d = forwardDist(tr, sc.s, o.s);
        if (Math.min(d, L - d) < CAR_LEN + 0.9 && Math.abs(nl - o.lat) < LAT_CLEAR && Math.abs(nl - o.lat) < Math.abs(sc.lat - o.lat)) return;
      }
      sc.lat = nl;
    };
    if (sc.phase === 'piste') {
      moveLat(tr.line[i], 0.3);
      // rentre aux stands à l'entrée de la voie, une fois la piste dégagée
      const d = forwardDist(tr, sc.s, tr.pitEntry);
      if (this.t > sc.until && d < 8) {
        sc.phase = 'rentre';
        this.log('securite', 'La voiture de sécurité rentre : reprise de la course au prochain passage sur la ligne !');
        const leaderLaps = Math.max(...order.map((o) => o.laps));
        this.restartLap = leaderLaps + 1;
      }
    } else {
      moveLat(tr.pitLat, 0.4);
    }
    sc.v += Math.max(-4, Math.min(1.5, (sc.phase === 'rentre' && Math.abs(sc.lat) > tr.half + 1 ? Math.min(vt, PIT_SPEED) : vt) - sc.v));
    // Ne jamais rattraper une voiture devant dans le même couloir (retardataire, voiture lente…).
    let ns = sc.s + sc.v * DT;
    for (const o of order) {
      if (Math.abs(o.lat - sc.lat) >= LAT_CLEAR) continue;
      const d0 = forwardDist(tr, sc.s, o.s);
      if (d0 <= 0 || d0 > L / 2) continue;
      if (ns - sc.s > d0 - CAR_LEN - 0.2) {
        ns = sc.s + Math.max(0, d0 - CAR_LEN - 0.2);
        sc.v = Math.min(sc.v, o.v);
      }
    }
    sc.s = ns;
    if (sc.phase === 'rentre' && forwardDist(tr, tr.pitEntry, sc.s) > 140 && forwardDist(tr, tr.pitEntry, sc.s) < tr.length / 2) {
      this.sc = null;
    }
  }

  private updateWeather(order: SimCar[]): void {
    const plan = this.cfg.weatherPlan;
    if (plan && this.wIdx < plan.length && order.length) {
      const leaderS = Math.max(...order.map((o) => o.s));
      const ch = plan[this.wIdx];
      if (leaderS / this.track.length >= ch.lap) {
        this.wIdx++;
        if (ch.rain !== this.raining) {
          this.raining = ch.rain;
          this.log('meteo', ch.rain ? 'La pluie se met à tomber sur le circuit !' : 'La pluie cesse : la piste va commencer à sécher.');
          for (const c of this.cars) {
            if (c.status === 'run') this.radio(c, 'meteo', ch.rain ? 'Il commence à pleuvoir, sois prudent.' : 'Plus de pluie, la trajectoire va sécher.', 0);
          }
        }
      }
    }
    const before = this.wet;
    this.wet = Math.max(0, Math.min(1, this.wet + (this.raining ? WET_RISE : -WET_DRY) * DT));
    this.maxWet = Math.max(this.maxWet, this.wet);
    if (before < 0.3 && this.wet >= 0.3) this.log('meteo', 'Piste détrempée : les pneus pluie deviennent indispensables.');
    if (before > 0.15 && this.wet <= 0.15) this.log('meteo', 'La piste est presque sèche : place aux pneus slicks.');
    for (const c of this.cars) {
      if (c.status !== 'run' || c.pit !== 0) continue;
      if (this.wet > 0.32 && c.compound !== 'P') this.radio(c, 'slicks', 'Piste trop mouillée pour les slicks, rentre chausser des pneus pluie !', 90);
      if (this.wet < 0.12 && !this.raining && c.compound === 'P') this.radio(c, 'seche', 'La trajectoire est sèche, les slicks seraient bien plus rapides.', 90);
    }
  }

  /** Message radio de l'ingénieur (écuries du joueur uniquement), limité en fréquence par sujet. */
  private radio(c: SimCar, key: string, text: string, minGap = 30): void {
    if (!c.e.isPlayer) return;
    const k = c.id + key;
    if (this.radioLast[k] !== undefined && this.t - this.radioLast[k] < minGap) return;
    this.radioLast[k] = this.t;
    this.events.push({ t: this.t, lap: this.leaderLap, kind: 'radio', text: `📻 ${c.e.short} : « ${text} »`, carId: c.id });
  }

  private gapRadio(c: SimCar): void {
    if (!c.e.isPlayer || this.sc) return;
    const st = this.standings();
    const k = st.indexOf(c);
    const front = st[k - 1], back = st[k + 1];
    if (front && front.status === 'run' && c.interval > 0 && c.interval < 0.9 && front.e.teamId !== c.e.teamId) {
      this.radio(c, 'chasse', `${front.e.short} est à ${c.interval.toFixed(1)} s devant. Attaque !`, 150);
    } else if (back && back.status === 'run' && back.interval > 0 && back.interval < 0.7 && back.e.teamId !== c.e.teamId) {
      this.radio(c, 'defense', `${back.e.short} revient à ${back.interval.toFixed(1)} s. Protège la position.`, 150);
    }
  }

  private considerPass(c: SimCar, o: SimCar, idx: number, lap1 = false, noOvertake = false): void {
    const tr = this.track, rng = this.rng, L = tr.length;
    const lapping = c.s - o.s > L / 2 || o.status === 'done' || o.status === 'retiring' || o.damage === 2;
    if (noOvertake && !(o.status === 'retiring')) return;
    // Consignes d'équipe.
    if (!lapping && o.e.teamId === c.e.teamId && o.status === 'run') {
      const ord = this.teamOrders[c.e.teamId] ?? 'libre';
      if (ord === 'tenir') {
        c.cooldown = 5;
        return;
      }
      if (ord === 'inverser') {
        if (tr.corner[idx] > 0.4) return;
        const side = o.lat > 0 ? -1 : 1;
        o.yieldTimer = 5;
        o.yieldLat = -side * (tr.half - 1.4);
        c.pass = { target: side * (tr.half - 1.4), other: o.id, ok: true, timer: 10, lap: false };
        return;
      }
    }
    if (lapping) {
      if (tr.corner[idx] > 0.5) return;
      const side = o.lat > 0 ? -1 : 1;
      if (o.status !== 'retiring') o.yieldTimer = 5;
      o.yieldLat = -side * (tr.half - 1.4);
      c.pass = { target: side * (tr.half - 1.4), other: o.id, ok: true, timer: 8, lap: true };
      return;
    }
    // Zones : lignes droites ; au premier tour, tout ce qui n'est pas un virage serré.
    if (!tr.zone[idx] && !(lap1 && tr.corner[idx] < 0.3)) return;
    // Avantage de rythme réel (profil × pneus × humidité × mode × forme du moment × dégâts).
    const w = this.wet;
    const ref = (x: SimCar) => x.refLap * (1 - w) + this.refWet[x.idx] * w;
    const form = (x: SimCar) => tyreFactor(x.compound, x.wear, w) * MODE_PACE[x.mode] * x.noise *
      (1 + (x.e.driver.pluie - 10) * 0.0009 * w) * (x.damage === 1 ? 0.985 : 1);
    const adv = (ref(o) / ref(c)) * (form(c) / form(o)) - 1 + (o.errTimer > 0 ? 0.02 : 0);
    if (adv < (c.mode === 'attaque' ? -0.004 : -0.0015)) {
      c.cooldown = 3;
      return;
    }
    const tryP = 0.45 + (c.mode === 'attaque' ? 0.25 : c.mode === 'eco' ? -0.2 : 0) + adv * 20 + (lap1 ? 0.25 : 0);
    if (!rng.chance(Math.min(0.95, tryP))) {
      c.cooldown = 3;
      return;
    }
    const chance = Math.max(0.05, Math.min(0.9,
      0.2 + adv * 28 + (c.e.driver.depassement - o.e.driver.defense) / 35 + (tr.def.overtaking - 0.5) * 0.5 +
      (c.mode === 'attaque' ? 0.08 : 0) - (o.mode === 'attaque' ? 0.05 : 0) + 0.12 * w + (lap1 ? 0.15 : 0)));
    const ok = rng.chance(chance);
    if (!ok) this.maybeContact(c, o, lap1);
    if (c.status !== 'run') return;
    const lim = tr.half - 1.2;
    let side = o.lat > tr.line[idx] ? -1 : 1;
    let tgt = o.lat + side * (CAR_W + 1.2);
    if (Math.abs(tgt) > lim) {
      side = -side;
      tgt = o.lat + side * (CAR_W + 1.2);
    }
    tgt = Math.max(-lim, Math.min(lim, tgt));
    if (Math.abs(tgt - o.lat) < LAT_CLEAR + 0.2) {
      c.cooldown = 2;
      return;
    }
    c.pass = { target: tgt, other: o.id, ok, timer: 9, lap: false };
  }

  /** Accrochage lors d'une attaque ratée : dégâts éventuels, enquête des commissaires. */
  private maybeContact(c: SimCar, o: SimCar, lap1: boolean): void {
    const rng = this.rng;
    const skill = (c.e.driver.depassement + o.e.driver.defense) / 40;
    const p = 0.03 * (c.mode === 'attaque' ? 1.6 : 1) * (1 + this.wet) * (1.5 - skill) * (lap1 ? 1.8 : 1);
    if (!rng.chance(p)) return;
    const r = rng.next();
    let text: string;
    if (r < 0.42) {
      c.damage = 1;
      text = `Contact entre ${c.e.short} et ${o.e.short} : aileron avant endommagé pour ${c.e.short}.`;
      this.radio(c, 'degat', 'Aileron avant touché, on perd du temps dans les virages. Rentre quand tu peux.', 0);
      if (!c.e.isPlayer && !c.pitReq) c.pitReq = this.bestCompound(c);
    } else if (r < 0.66) {
      o.damage = 2;
      o.pitReq = o.pitReq ?? this.bestCompound(o);
      o.pass = null;
      text = `Contact ! ${o.e.short} est victime d'une crevaison après l'attaque de ${c.e.short}.`;
      this.radio(o, 'crevaison', 'Crevaison ! Rentre au stand immédiatement.', 0);
    } else {
      text = `Léger accrochage entre ${c.e.short} et ${o.e.short}, sans dégât.`;
    }
    this.log('contact', text, c.id, o.id);
    c.cooldown = 6;
    if (r < 0.66 && rng.chance(0.55)) {
      c.penalty += 5;
      this.log('penalite', `Pénalité de 5 s pour ${c.e.short} (accrochage provoqué).`, c.id, o.id);
      this.radio(c, 'penalite', 'Les commissaires nous infligent 5 secondes de pénalité.', 0);
    } else if (r < 0.66) {
      this.log('penalite', `Les commissaires ne retiennent pas de sanction contre ${c.e.short}.`, c.id, o.id);
    }
  }

  private pitLogic(c: SimCar, idx: number): void {
    const tr = this.track;
    if (c.pit !== 0 || c.status !== 'run' || this.flag) return;
    // Sécurité : pneus trop usés ou pneus inadaptés à la météo.
    if (!c.pitReq && c.laps < this.cfg.laps - 1) {
      if (c.wear > 88) c.pitReq = this.bestCompound(c);
      if (c.damage === 2) c.pitReq = this.bestCompound(c);
    }
    if (!c.pitReq || c.s < 0 || (c.laps >= this.cfg.laps - 1 && c.damage !== 2)) return;
    const u = idx * tr.ds;
    const d = forwardDist(tr, u, tr.pitEntry);
    if (d < 4 || d > tr.length - 8) {
      if (Math.abs(c.lat) > tr.half - 0.2) return;
      const entryS = c.s;
      const box = (tr.length - 150 + c.teamIdx * 30) % tr.length;
      c.pit = 1;
      c.pitBoxS = entryS + forwardDist(tr, tr.pitEntry, box);
      c.pitExitS = entryS + forwardDist(tr, tr.pitEntry, tr.pitExit);
      c.pass = null;
    }
  }

  /** Arrêts programmés (plan joueur ou IA). */
  private autoStrategy(c: SimCar): void {
    const plan = c.e.pitPlan;
    while (c.planIdx < plan.length && plan[c.planIdx].lap <= c.laps) {
      const p = plan[c.planIdx++];
      if (p.lap === c.laps && !c.pitReq && c.laps < this.cfg.laps) {
        c.pitReq = p.compound;
        // l'IA adapte la gomme prévue à la météo réelle
        if (!c.e.isPlayer && ((p.compound === 'P') !== (this.bestCompound(c) === 'P'))) c.pitReq = this.bestCompound(c);
      }
    }
    if (!c.e.isPlayer && !c.pitReq && c.laps < this.cfg.laps - 1) {
      const wantWet = this.bestCompound(c) === 'P';
      if (wantWet !== (c.compound === 'P') && (this.wet > 0.32 || this.wet < 0.12)) c.pitReq = this.bestCompound(c);
    }
    if (!c.e.isPlayer && !c.pitReq && c.laps < this.cfg.laps - 1) {
      // L'IA s'arrête plus tôt si l'usure dépasse son seuil.
      const thr = 66 + (c.idx * 7) % 12;
      const remaining = this.cfg.laps - c.laps;
      const perLap = c.wear / Math.max(1, c.laps - this.lastStopLap(c));
      if (c.wear > thr && c.wear + perLap * remaining > 92) {
        c.pitReq = this.bestCompound(c);
      }
    }
  }

  private lastStopLap(c: SimCar): number {
    return c.stops === 0 ? 0 : c.laps - Math.round(c.wear / 8);
  }

  private updateOrder(): void {
    const sorted = [...this.cars].sort((a, b) => {
      const ra = a.status === 'dnf' || a.status === 'retiring' ? 1 : 0;
      const rb = b.status === 'dnf' || b.status === 'retiring' ? 1 : 0;
      if (ra !== rb) return ra - rb;
      if (ra) return b.s - a.s;
      const da = a.status === 'done', db = b.status === 'done';
      if (da && db) return b.laps - a.laps || a.finishT + a.penalty - (b.finishT + b.penalty);
      if (da !== db) {
        // une voiture arrivée garde son rang face aux voitures du même tour encore en piste
        const fa = da ? a.laps * this.track.length : a.s;
        const fb = db ? b.laps * this.track.length : b.s;
        return fb - fa || (da ? -1 : 1);
      }
      return b.s - a.s;
    });
    let prev: SimCar | null = null;
    sorted.forEach((c, k) => {
      c.position = k + 1;
      if (c.status === 'done') {
        const leader = sorted[0];
        c.gap = c.laps < leader.laps ? -(leader.laps - c.laps) : c.finishT + c.penalty - (leader.finishT + leader.penalty);
      } else if (c.cpIdx >= 0) {
        const ref = this.cpTimes[c.cpIdx];
        c.gap = ref === undefined ? 0 : Math.max(0, c.cpCross - ref);
        const lapsDown = Math.floor((sorted[0].s - c.s) / this.track.length);
        if (lapsDown >= 1 && sorted[0].status !== 'done') c.gap = -lapsDown;
      } else c.gap = 0;
      c.interval = prev && c.gap >= 0 && prev.gap >= 0 ? c.gap - prev.gap : 0;
      prev = c;
    });
  }

  /** Classement en direct. */
  standings(): SimCar[] {
    return [...this.cars].sort((a, b) => a.position - b.position);
  }

  get leaderLap(): number {
    return Math.min(this.cfg.laps, Math.max(...this.cars.map((c) => c.laps)) + 1);
  }

  /** Simule jusqu'au bout (ou maxTicks) et renvoie le nombre de pas exécutés. */
  runToEnd(maxTicks = 1e7): number {
    let k = 0;
    while (!this.finished && k < maxTicks) {
      this.step();
      k++;
    }
    return k;
  }

  /** Instantané complet de l'état (reprise instantanée d'une course sauvegardée). */
  snapshot(): RaceSnapshot {
    const skip = new Set(['e', 'phys', 'prof']);
    const cars = this.cars.map((c) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(c)) if (!skip.has(k)) o[k] = v && typeof v === 'object' ? JSON.parse(JSON.stringify(v)) : v;
      return o;
    });
    return {
      v: SNAPSHOT_VERSION, tick: this.tick, t: this.t, flag: this.flag, finished: this.finished, fastest: this.fastest,
      cpTimes: [...this.cpTimes], cmdPtr: this.cmdPtr, rng: this.rng.state, events: this.events.map((x) => ({ ...x })),
      wet: this.wet, raining: this.raining, wIdx: this.wIdx, sc: this.sc ? { ...this.sc } : null, restartLap: this.restartLap,
      scCount: this.scCount, teamOrders: { ...this.teamOrders }, radioLast: { ...this.radioLast }, cars,
      formation: this.formation, lightsStart: this.lightsStart, lightsOut: Number.isFinite(this.lightsOut) ? this.lightsOut : -1,
    };
  }

  /** Recrée une course à partir de sa configuration, de ses consignes et d'un instantané. */
  static restore(cfg: RaceConfig, commands: RaceCommand[], snap: RaceSnapshot): RaceSim {
    const sim = new RaceSim(cfg, commands);
    if (snap.v !== SNAPSHOT_VERSION || snap.cars.length !== sim.cars.length) throw new Error('Instantané incompatible');
    sim.tick = snap.tick;
    sim.t = snap.t;
    sim.flag = snap.flag;
    sim.finished = snap.finished;
    sim.fastest = snap.fastest;
    sim.cpTimes = [...snap.cpTimes];
    sim.cmdPtr = snap.cmdPtr;
    sim.rng.state = snap.rng;
    sim.events.splice(0, sim.events.length, ...snap.events);
    sim.wet = snap.wet;
    sim.raining = snap.raining;
    sim.wIdx = snap.wIdx;
    sim.sc = snap.sc ? { ...snap.sc } : null;
    sim.restartLap = snap.restartLap;
    sim.scCount = snap.scCount;
    sim.teamOrders = { ...snap.teamOrders };
    sim.radioLast = { ...snap.radioLast };
    if (snap.formation !== undefined) {
      sim.formation = snap.formation;
      sim.lightsStart = snap.lightsStart ?? 0;
      sim.lightsOut = snap.lightsOut === -1 ? Infinity : snap.lightsOut ?? sim.lightsOut;
    }
    snap.cars.forEach((o, i) => {
      if (o.id !== sim.cars[i].id) throw new Error('Instantané incompatible');
      Object.assign(sim.cars[i], JSON.parse(JSON.stringify(o)));
    });
    return sim;
  }

  results(): ClassifiedResult[] {
    const st = this.standings();
    const winner = st[0];
    return st.map((c) => {
      const done = c.status === 'done';
      let gap = '';
      if (!done) gap = c.reason ?? 'Abandon';
      else if (c === winner) gap = fmtTime(c.finishT + c.penalty - this.lightsOut);
      else if (c.laps < winner.laps) gap = `+${winner.laps - c.laps} tour${winner.laps - c.laps > 1 ? 's' : ''}`;
      else gap = '+' + (c.finishT + c.penalty - winner.finishT - winner.penalty).toFixed(3) + ' s';
      if (done && c.penalty) gap += ` (dont ${c.penalty} s de pénalité)`;
      return {
        carId: c.id, position: c.position, laps: c.laps, time: done ? c.finishT + c.penalty - this.lightsOut : 0, gap,
        bestLap: c.bestLap, stops: c.stops, status: done ? 'arrivé' : 'abandon', reason: c.reason, gridPosition: c.gridPos,
        penalty: c.penalty,
      };
    });
  }
}

export const SNAPSHOT_VERSION = 1;

export interface RaceSnapshot {
  v: number;
  tick: number;
  t: number;
  flag: boolean;
  finished: boolean;
  fastest: { carId: string; time: number } | null;
  cpTimes: number[];
  cmdPtr: number;
  rng: number;
  events: RaceEvent[];
  wet: number;
  raining: boolean;
  wIdx: number;
  sc: SafetyCar | null;
  restartLap: number;
  scCount: number;
  teamOrders: Record<string, TeamOrder>;
  radioLast: Record<string, number>;
  cars: Record<string, unknown>[];
  formation?: boolean;
  lightsStart?: number;
  lightsOut?: number;
}

export function fmtLap(t: number): string {
  if (!t) return '—';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

export function fmtTime(t: number): string {
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + s.toFixed(3).padStart(6, '0');
}
