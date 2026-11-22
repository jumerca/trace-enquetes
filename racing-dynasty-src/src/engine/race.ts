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
import type { CarEntry, ClassifiedResult, Compound, DriveMode, RaceCommand, RaceCommandInput, RaceConfig, RaceEvent } from './types';

export const DT = 0.1;
export const CAR_LEN = 5.2;
export const CAR_W = 1.9;
export const LIGHTS_ON = 0.8; // intervalle d'allumage des feux de départ (s)
const LAT_CLEAR = CAR_W + 0.3; // séparation latérale minimale entre deux voitures côte à côte
const PIT_SPEED = 22; // 80 km/h
const CP = 50; // pas des points de chronométrage (m)
const MECH_FAILS = ['Moteur', 'Boîte de vitesses', 'Hydraulique', 'Freins', 'Électronique', 'Suspension'];

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
  readonly lightsOut: number;

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
      const phys = physicsFor(e, tr, cfg.weather);
      const prof = speedProfile(tr, phys);
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
        startDelay: 0.2 + this.rng.next() * 0.45 * (1.35 - e.driver.mental / 20),
        cpIdx: -1, cpCross: 0, gap: 0, interval: 0, position: i + 1, gridPos: i + 1, overtakes: 0,
      };
      c.prevLat = c.lat;
      return c;
    });
    for (const c of this.cars) c.teamIdx = teams.indexOf(c.e.teamId);
    // Fiabilité : probabilité d'abandon mécanique sur la course, répartie par mètre parcouru.
    this.failHazard = this.cars.map((c) => (0.0045 * (21 - c.e.car.fiabilite)) / (cfg.laps * tr.length));
    this.lightsOut = LIGHTS_ON * 5 + 0.4 + this.rng.next() * 1.2;
    for (const c of this.cars) c.lapStartT = this.lightsOut;
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
      if (!c || c.status !== 'run') continue;
      if (cmd.type === 'mode') c.mode = cmd.mode;
      else if (cmd.type === 'pit') c.pitReq = cmd.compound;
      else if (cmd.type === 'cancelPit' && c.pit === 0) c.pitReq = null;
    }
  }

  /** Avance la simulation d'un pas. */
  step(): void {
    if (this.finished) return;
    this.applyCommands();
    if (this.t < this.lightsOut && this.t + DT >= this.lightsOut) this.log('depart', 'Feux éteints ! Départ du ' + this.track.def.gp + '.');
    const tr = this.track, L = tr.length, rng = this.rng;
    const order = this.cars.filter((c) => c.status !== 'dnf').sort((a, b) => b.s - a.s);
    for (const c of this.cars) {
      c.prevS = c.s;
      c.prevLat = c.lat;
    }
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
      let pace = tyreFactor(c.compound, c.wear, this.cfg.weather) * MODE_PACE[c.mode] * c.noise;
      if (this.cfg.weather === 'pluie') pace *= 1 + (e.driver.pluie - 10) * 0.0009;
      if (c.status === 'done') pace *= 0.8;
      let vt = c.prof[idx] * pace;
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
      } else if (racing && c.pit === 0 && this.t > this.lightsOut + 4 && corner > 0.15) {
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
          c.pitTimer = 2.2 + (20 - crew) * 0.07 + Math.abs(rng.normal(0, 0.3)) + (rng.chance(0.04) ? rng.range(2.5, 6) : 0);
        }
      }
      if (c.pit === 2) {
        vt = 0;
        latTarget = tr.boxLat;
        c.pitTimer -= DT;
        if (c.pitTimer <= 0) {
          const from = c.compound;
          c.compound = c.pitReq ?? c.compound;
          c.wear = 0;
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

      if (target && !c.pass && c.cooldown <= 0 && targetD - CAR_LEN < 14) this.considerPass(c, target, idx);
      if (c.pass) {
        const p = c.pass;
        const o = this.car(p.other)!;
        const rel = forwardDist(tr, o.s, c.s); // > 0 si c est devant o
        const aheadOfOther = rel > 0 && rel < L / 2;
        p.timer -= DT;
        if (aheadOfOther && rel > CAR_LEN + 1.5) {
          if (p.ok && !p.lap && o.status === 'run') {
            c.overtakes++;
            this.log('depassement', `${e.short} dépasse ${o.e.short}.`, c.id, o.id);
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

      // Aspiration en ligne droite.
      if (target && tr.zone[idx] && targetD < 45) vt *= 1.006;
      // Suivi : ne jamais rattraper la voiture de devant dans le même couloir.
      if (ahead) {
        const gap = aheadD - CAR_LEN;
        const follow = 1.6 + c.v * 0.1;
        if (gap < follow * 2.5) vt = Math.min(vt, ahead.v + (gap - follow) * 0.9);
        if (gap < 22 && corner > 0.3) vt *= 0.994; // air turbulent
      }

      // --- Intégration longitudinale ---
      if (vt > c.v) {
        const r = c.v / (c.phys.vTop * boost);
        const acc = c.phys.aAcc * Math.max(0.05, 1 - r * r * r) * (c.errKind === 3 ? 0.4 : 1);
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
      c.s = ns;

      // --- Usure, fiabilité ---
      if (c.status === 'run' && c.s > 0) {
        const dist = c.v * DT;
        const dr = e.driver;
        const setupWear = 1 + 0.5 * Math.abs(e.setup.suspension - tr.def.suspOpt) / 100;
        c.wear += (dist / L) * this.wearScale * tyreWearRate(c.compound, this.cfg.weather) *
          (1.15 - (dr.pneus / 20) * 0.3) * MODE_WEAR[c.mode] * setupWear;
        if (c.wear > 100) c.wear = 100;
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
              this.flag = true;
              this.log('drapeau', `Drapeau à damier ! Victoire de ${e.name} (${e.teamName}).`, c.id);
            }
            if (this.flag) {
              c.status = 'done';
              c.finishT = tc;
              c.pass = null;
              c.pitReq = null;
            } else this.autoStrategy(c);
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
    if (this.cfg.weather === 'pluie') f *= c.compound === 'P' ? 2.2 * (1.4 - d.pluie / 20) : 7;
    else if (c.compound === 'P') f *= 1.5;
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
  }

  private considerPass(c: SimCar, o: SimCar, idx: number): void {
    const tr = this.track, rng = this.rng, L = tr.length;
    const lapping = c.s - o.s > L / 2 || o.status === 'done' || o.status === 'retiring';
    if (lapping) {
      if (tr.corner[idx] > 0.5) return;
      const side = o.lat > 0 ? -1 : 1;
      if (o.status !== 'retiring') o.yieldTimer = 5;
      o.yieldLat = -side * (tr.half - 1.4);
      c.pass = { target: side * (tr.half - 1.4), other: o.id, ok: true, timer: 8, lap: true };
      return;
    }
    if (!tr.zone[idx]) return;
    // Avantage de rythme réel (profil × état des pneus × mode).
    const pc = (1 / c.refLap) * tyreFactor(c.compound, c.wear, this.cfg.weather) * MODE_PACE[c.mode];
    const po = (1 / o.refLap) * tyreFactor(o.compound, o.wear, this.cfg.weather) * MODE_PACE[o.mode];
    const adv = pc / po - 1 + (o.errTimer > 0 ? 0.02 : 0);
    if (adv < (c.mode === 'attaque' ? -0.004 : -0.0015)) {
      c.cooldown = 3;
      return;
    }
    const tryP = 0.45 + (c.mode === 'attaque' ? 0.25 : c.mode === 'eco' ? -0.2 : 0) + adv * 20;
    if (!rng.chance(Math.min(0.95, tryP))) {
      c.cooldown = 3;
      return;
    }
    const chance = Math.max(0.05, Math.min(0.9,
      0.3 + adv * 35 + (c.e.driver.depassement - o.e.driver.defense) / 35 + (tr.def.overtaking - 0.5) * 0.5 +
      (c.mode === 'attaque' ? 0.08 : 0) - (o.mode === 'attaque' ? 0.05 : 0)));
    const ok = rng.chance(chance);
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

  private pitLogic(c: SimCar, idx: number): void {
    const tr = this.track;
    if (c.pit !== 0 || c.status !== 'run' || this.flag) return;
    // Sécurité : pneus trop usés ou pneus inadaptés à la météo.
    if (!c.pitReq && c.laps < this.cfg.laps - 1) {
      if (c.wear > 88) c.pitReq = this.cfg.weather === 'pluie' ? 'P' : c.compound === 'D' ? 'M' : 'D';
    }
    if (!c.pitReq || c.s < 0 || c.laps >= this.cfg.laps - 1) return;
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
      if (p.lap === c.laps && !c.pitReq && c.laps < this.cfg.laps) c.pitReq = p.compound;
    }
    if (!c.e.isPlayer && !c.pitReq && c.laps < this.cfg.laps - 1) {
      // L'IA s'arrête plus tôt si l'usure dépasse son seuil.
      const thr = 66 + (c.idx * 7) % 12;
      const remaining = this.cfg.laps - c.laps;
      const perLap = c.wear / Math.max(1, c.laps - this.lastStopLap(c));
      if (c.wear > thr && c.wear + perLap * remaining > 92) {
        c.pitReq = this.cfg.weather === 'pluie' ? 'P' : remaining <= this.cfg.laps * 0.35 ? 'T' : c.compound === 'D' ? 'M' : 'D';
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
      if (da && db) return b.laps - a.laps || a.finishT - b.finishT;
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
        c.gap = c.laps < leader.laps ? -(leader.laps - c.laps) : c.finishT - leader.finishT;
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

  results(): ClassifiedResult[] {
    const st = this.standings();
    const winner = st[0];
    return st.map((c) => {
      const done = c.status === 'done';
      let gap = '';
      if (!done) gap = c.reason ?? 'Abandon';
      else if (c === winner) gap = fmtTime(c.finishT - this.lightsOut);
      else if (c.laps < winner.laps) gap = `+${winner.laps - c.laps} tour${winner.laps - c.laps > 1 ? 's' : ''}`;
      else gap = '+' + (c.finishT - winner.finishT).toFixed(3) + ' s';
      return {
        carId: c.id, position: c.position, laps: c.laps, time: done ? c.finishT - this.lightsOut : 0, gap,
        bestLap: c.bestLap, stops: c.stops, status: done ? 'arrivé' : 'abandon', reason: c.reason, gridPosition: c.gridPos,
      };
    });
  }
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
