import { Rng } from '../core/rng';
import { clamp, dist, distToSegment, norm, type V2 } from '../core/vec';
import { shortName, type PlayerData, type TeamTactics } from '../data/model';
import { Court } from './court';
import { launchVelocity, stepBall, BALL_R } from './physics';
import type { Ruleset } from './rules';
import { shotProbability, sigmaFor, sigmaForShot } from './shooting';
import {
  emptyBox,
  emptyInput,
  type Ball,
  type Flight,
  type GameEvent,
  type MPlayer,
  type Phase,
  type ShotType,
  type TeamState,
  type UserInput,
} from './types';
import { offenseThink, setupOffense, type OffenseState } from './ai/offense';
import { defenseThink, assignDefense } from './ai/defense';
import { coachAdjust, coachDeadBall, coachTimeoutCheck, initialRotation } from './ai/coach';

export interface TeamInput {
  id: string;
  name: string;
  short: string;
  colors: [string, string];
  tactics: TeamTactics;
  players: PlayerData[]; // ordonnés : cinq majeur d'abord, puis banc
  minutesPlan?: Record<string, number>;
}

export interface MatchConfig {
  home: TeamInput;
  away: TeamInput;
  rules: Ruleset;
  seed: number;
  userPlayerId?: string | null;
  /** Échelle de fatigue : 1 = match officiel. Calculée automatiquement si quarts raccourcis. */
  fatigueScale?: number;
  /** Assistance IA lorsque le joueur ne touche pas aux commandes */
  userAssist?: boolean;
  /** false = mode spectateur : le joueur incarné est joué par l'IA selon ses consignes */
  userControl?: boolean;
  /** Consignes personnelles données au joueur incarné (-1..1) */
  userStyle?: UserStyle;
}

export interface UserStyle {
  shooting: number; // -1 collectif … +1 prend ses responsabilités
  defense: number; // 0 prudent … 1 agressif
  hustle: number; // 0 économise … 1 se donne à fond (rebond, repli, fatigue)
  /** Rôle offensif demandé */
  role?: 'auto' | 'shooter' | 'slasher' | 'post' | 'playmaker';
  /** Défendre sur le meilleur attaquant adverse */
  guardStar?: boolean;
  /** Demande au coach : sortir souffler ou entrer en jeu */
  sub?: 'none' | 'out' | 'in';
}
export const DEFAULT_STYLE: UserStyle = { shooting: 0, defense: 0.5, hustle: 0.5, role: 'auto', guardStar: false, sub: 'none' };

export const TICK = 1 / 60;

interface Pending {
  at: number;
  fn: () => void;
}

export class MatchEngine {
  rng: Rng;
  court: Court;
  rules: Ruleset;
  players: MPlayer[] = [];
  teams: [TeamState, TeamState];
  ball: Ball;
  phase: Phase = 'jumpball';
  quarter = 1;
  clock: number;
  shotClock: number;
  clockRunning = false;
  shotClockOn = false;
  time = 0; // temps simulé total (s)
  possession: 0 | 1 = 0;
  arrow: 0 | 1 = 0; // possession alternée
  jumpWinner: 0 | 1 = 0;
  events: GameEvent[] = [];
  offense: [OffenseState, OffenseState];
  pending: Pending | null = null;
  backcourtT = 0;
  frontcourtReached = false;
  userIdx = -1;
  input: UserInput = emptyInput();
  prevInput: UserInput = emptyInput();
  userIdleT = 0;
  userAssist: boolean;
  userControl: boolean;
  userStyle: UserStyle;
  /** Sons à jouer (consommés par l'interface) */
  sounds: string[] = [];
  fatigueScale: number;
  lastScoreT = -10;
  netSwish = [0, 0]; // animation filets (côté 0 = gauche, 1 = droite)
  replayMarks: { t: number; kind: string }[] = [];
  possessionStartT = 0;
  ftQueue: { shooter: number; remaining: number; total: number; team: 0 | 1; keep?: boolean } | null = null;
  shotClockExpiredInFlight = false;
  slowmo = 0;
  finished = false;
  startedPossessions = 0;
  lastEventText = '';

  constructor(public config: MatchConfig) {
    this.rng = new Rng(config.seed);
    this.rules = config.rules;
    this.court = new Court(config.rules.court);
    this.clock = this.rules.quarterMin * 60;
    this.shotClock = this.rules.shotClock;
    this.userAssist = config.userAssist ?? true;
    this.userControl = config.userControl ?? false;
    this.userStyle = config.userStyle ?? DEFAULT_STYLE;
    this.fatigueScale = config.fatigueScale ?? Math.max(1, (config.rules.id === 'NBA' ? 12 : 10) / config.rules.quarterMin);
    const mk = (t: TeamInput): TeamState => ({
      id: t.id,
      name: t.name,
      short: t.short,
      colors: t.colors,
      tactics: t.tactics,
      score: 0,
      quarterFouls: 0,
      timeouts: this.rules.timeouts,
      players: [],
      rotation: [],
      minutesPlan: {},
      run: 0,
      scoreByQ: [0, 0, 0, 0],
    });
    this.teams = [mk(config.home), mk(config.away)];
    [config.home, config.away].forEach((t, ti) => {
      t.players.forEach((pd, i) => {
        const idx = this.players.length;
        const mp: MPlayer = {
          idx,
          team: ti as 0 | 1,
          data: pd,
          heightM: pd.heightCm / 100,
          onCourt: i < 5,
          slot: i < 5 ? i : -1,
          pos: { x: 0, y: 0 },
          vel: { x: 0, y: 0 },
          facing: ti === 0 ? 0 : Math.PI,
          z: 0,
          vz: 0,
          target: { x: 0, y: 0 },
          urgency: 0.5,
          stride: this.rng.next() * 6,
          anim: i < 5 ? 'idle' : 'bench',
          animT: 0,
          actionLock: 0,
          energy: clamp(1 - pd.fatigue / 250, 0.75, 1),
          fouls: 0,
          box: emptyBox(),
          role: 'spot',
          spot: null,
          assign: -1,
          thinkT: this.rng.next() * 0.2,
          keyTime: 0,
          slowT: 0,
          intent: '',
          screenT: 0,
          isUser: !!config.userPlayerId && pd.id === config.userPlayerId,
          hotness: 0,
          lastTouchT: -10,
          pickupT: 0,
          jumpCd: 0,
        };
        if (mp.isUser) this.userIdx = idx;
        this.players.push(mp);
        this.teams[ti].players.push(idx);
      });
      const plan = t.minutesPlan ?? {};
      for (const idx of this.teams[ti].players) {
        const pid = this.players[idx].data.id;
        this.teams[ti].minutesPlan[idx] = plan[pid] ?? (this.players[idx].onCourt ? 30 : 14);
      }
      this.teams[ti].rotation = initialRotation(this, ti as 0 | 1);
    });
    this.ball = {
      state: 'dead',
      holder: -1,
      x: this.court.g.length / 2,
      y: this.court.cy,
      z: 1.5,
      vx: 0,
      vy: 0,
      vz: 0,
      flight: null,
      lastTouch: -1,
      lastTeam: 0,
      dribblePhase: 0,
      dribbling: false,
      airT: 0,
      spin: 0,
    };
    this.offense = [setupOffense(), setupOffense()];
    this.benchPositions();
    this.setupJumpBall();
  }

  // ---------------------------------------------------------------- Helpers
  get onCourt(): MPlayer[] {
    return this.players.filter((p) => p.onCourt);
  }
  teamOnCourt(t: 0 | 1): MPlayer[] {
    return this.players.filter((p) => p.onCourt && p.team === t);
  }
  /** Côté du panier attaqué par l'équipe t (+1 droite, -1 gauche). */
  attackSide(t: 0 | 1): 1 | -1 {
    const firstHalf = this.quarter <= 2;
    const s: 1 | -1 = t === 0 ? 1 : -1;
    return firstHalf ? s : (-s as 1 | -1);
  }
  hoopFor(t: 0 | 1): V2 {
    return this.court.hoop(this.attackSide(t));
  }
  /** Panier défendu par l'équipe t */
  ownHoop(t: 0 | 1): V2 {
    return this.court.hoop((-this.attackSide(t)) as 1 | -1);
  }
  holder(): MPlayer | null {
    return this.ball.state === 'held' && this.ball.holder >= 0 ? this.players[this.ball.holder] : null;
  }
  ballPos(): V2 {
    return { x: this.ball.x, y: this.ball.y };
  }
  name(i: number): string {
    return i >= 0 ? shortName(this.players[i].data) : '';
  }
  scoreDiff(t: 0 | 1): number {
    return this.teams[t].score - this.teams[1 - t].score;
  }
  isLateGame(): boolean {
    return this.quarter >= 4 && this.clock < 120;
  }
  /** Pression du moment : 0 normal, 1 fin de match serrée */
  clutch(): number {
    if (this.quarter < 4) return 0;
    const d = Math.abs(this.teams[0].score - this.teams[1].score);
    if (d > 8) return 0;
    return clamp((120 - this.clock) / 120, 0, 1) * (1 - d / 10);
  }
  emit(e: Omit<GameEvent, 't' | 'q' | 'clock'>): void {
    const ev: GameEvent = { ...e, t: this.time, q: this.quarter, clock: this.clock };
    this.events.push(ev);
    this.lastEventText = ev.text;
  }
  schedule(delay: number, fn: () => void): void {
    this.pending = { at: this.time + delay, fn };
  }
  nearestDefender(p: MPlayer): { d: number; pl: MPlayer | null } {
    let best: MPlayer | null = null;
    let bd = 99;
    for (const o of this.players) {
      if (!o.onCourt || o.team === p.team) continue;
      const d = dist(o.pos, p.pos);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return { d: bd, pl: best };
  }

  // ---------------------------------------------------------------- Mise en place
  benchPositions(): void {
    const g = this.court.g;
    for (const t of [0, 1] as const) {
      const bench = this.teams[t].players.filter((i) => !this.players[i].onCourt);
      bench.forEach((idx, k) => {
        const p = this.players[idx];
        const baseX = t === 0 ? g.length / 2 - 3.5 - k * 0.85 : g.length / 2 + 3.5 + k * 0.85;
        p.pos = { x: baseX, y: g.width + 1.3 };
        p.target = { ...p.pos };
        p.vel = { x: 0, y: 0 };
        p.anim = 'bench';
        p.facing = -Math.PI / 2;
      });
    }
  }

  setupJumpBall(): void {
    this.phase = 'jumpball';
    const g = this.court.g;
    const c = { x: g.length / 2, y: this.court.cy };
    for (const t of [0, 1] as const) {
      const ps = this.teamOnCourt(t).sort((a, b) => b.heightM - a.heightM);
      const dir = this.attackSide(t);
      ps.forEach((p, k) => {
        let pos: V2;
        if (k === 0) pos = { x: c.x - dir * 0.45, y: c.y };
        else {
          const offs = [
            { x: -2.6, y: -2.2 },
            { x: -2.6, y: 2.2 },
            { x: -5, y: -4.5 },
            { x: -5, y: 4.5 },
          ][k - 1];
          pos = { x: c.x + dir * (k <= 2 ? 2.2 : -3.4) + offs.x * 0 , y: c.y + offs.y };
          if (k > 2) pos.x = c.x - dir * 3.6;
        }
        p.pos = { ...pos };
        p.target = { ...pos };
        p.facing = dir === 1 ? 0 : Math.PI;
        p.anim = k === 0 ? 'jumpball' : 'stance';
      });
    }
    Object.assign(this.ball, { state: 'dead', holder: -1, x: c.x, y: c.y, z: 1.4, vx: 0, vy: 0, vz: 0, flight: null });
    this.schedule(1.4, () => this.tossJumpBall());
  }

  tossJumpBall(): void {
    const b = this.ball;
    b.state = 'air';
    b.vz = 5.4;
    b.vx = 0;
    b.vy = 0;
    b.flight = {
      kind: 'tip',
      from: -1,
      to: -1,
      team: 0,
      t: 0,
      dur: 0,
      start: { x: b.x, y: b.y, z: b.z },
      end: { x: b.x, y: b.y, z: b.z },
    };
    // Les sauteurs décollent au bon moment (selon leur détente/coordination)
    const jumpers = [0, 1].map((t) => this.teamOnCourt(t as 0 | 1).sort((a, c) => b2(c) - b2(a))[0]);
    function b2(p: MPlayer) {
      return p.heightM;
    }
    const reach = jumpers.map((p) => p.heightM * 1.33 + 0.45 + (p.data.attrs.vertical / 20) * 0.45 + this.rng.normal(0, 0.06));
    jumpers.forEach((p) => {
      p.vz = 3.3;
      p.anim = 'jumpball';
      p.animT = 0;
    });
    const winner = reach[0] >= reach[1] ? 0 : 1;
    this.schedule(0.55, () => {
      const w = jumpers[winner];
      const mates = this.teamOnCourt(winner as 0 | 1).filter((p) => p !== w);
      const dir = this.attackSide(winner as 0 | 1);
      const tgt = mates.sort((a, c) => dir * (a.pos.x - c.pos.x))[0] ?? mates[0];
      this.jumpWinner = winner as 0 | 1;
      this.arrow = (1 - winner) as 0 | 1;
      this.emit({ type: 'jumpball', team: winner as 0 | 1, player: w.idx, text: `Entre-deux remporté par ${this.name(w.idx)}` });
      this.phase = 'live';
      this.clockRunning = false;
      this.launchPass(w, tgt, 'tip');
    });
  }

  // ---------------------------------------------------------------- Boucle
  inboundStuckT = 0;
  step(input?: UserInput): void {
    if (this.finished) return;
    const dt = TICK;
    if (input) {
      this.prevInput = this.input;
      this.input = input;
    }
    this.time += dt;
    if (this.slowmo > 0) this.slowmo -= dt;

    if (this.pending && this.time >= this.pending.at) {
      const fn = this.pending.fn;
      this.pending = null;
      fn();
      if (this.finished) return;
    }

    this.updateClocks(dt);
    this.think(dt);
    this.applyUserInput(dt);
    this.movePlayers(dt);
    this.updateBall(dt);
    if (this.phase === 'live') this.checkViolations(dt);
    // Garde-fou : une remise en jeu dont le ballon reste libre est rejouée
    if (this.phase === 'inbound' && this.ball.state === 'loose' && !this.pending) {
      this.inboundStuckT += dt;
      if (this.inboundStuckT > 2.5) {
        this.inboundStuckT = 0;
        this.setupInbound(this.possession, 'sideline');
      }
    } else this.inboundStuckT = 0;
    this.updateMinutes(dt);
    for (let i = 0; i < 2; i++) this.netSwish[i] = Math.max(0, this.netSwish[i] - dt);
  }

  updateClocks(dt: number): void {
    if (this.phase !== 'live' && this.phase !== 'inbound') return;
    if (!this.clockRunning) return;
    this.clock -= dt;
    if (this.shotClockOn && this.phase === 'live') this.shotClock -= dt;
    if (this.clock <= 0) {
      this.clock = 0;
      // Un tir déjà lâché compte : on attend son issue
      if (this.ball.state === 'air' && this.ball.flight && (this.ball.flight.kind === 'shot' || this.ball.flight.kind === 'ft')) {
        this.clockRunning = false;
        (this.ball.flight as Flight & { buzzer?: boolean }).buzzer = true;
        return;
      }
      this.endQuarter();
    }
  }

  updateMinutes(dt: number): void {
    if (!this.clockRunning || (this.phase !== 'live' && this.phase !== 'inbound')) {
      // Récupération légère lors des arrêts de jeu
      for (const p of this.players) if (p.onCourt) p.energy = Math.min(1, p.energy + 0.0025 * dt * this.fatigueScale);
    }
    for (const p of this.players) {
      if (p.onCourt) {
        if (this.clockRunning) p.box.sec += dt;
        const sp = Math.hypot(p.vel.x, p.vel.y);
        const stam = p.data.attrs.stamina / 20;
        const drain = (0.0016 + sp * sp * 0.00011) * (1.45 - stam * 0.8) * this.fatigueScale * (p.isUser ? 0.85 + this.userStyle.hustle * 0.3 : 1);
        if (this.clockRunning || this.phase === 'live') p.energy = Math.max(0.05, p.energy - drain * dt);
      } else {
        p.energy = Math.min(1, p.energy + 0.0075 * dt * this.fatigueScale);
      }
    }
  }

  // ---------------------------------------------------------------- IA
  think(dt: number): void {
    for (const p of this.players) {
      if (!p.onCourt) continue;
      p.actionLock = Math.max(0, p.actionLock - dt);
      p.slowT = Math.max(0, p.slowT - dt);
      p.jumpCd = Math.max(0, p.jumpCd - dt);
      p.pickupT += dt;
      p.animT += dt;
      p.thinkT -= dt;
      p.screenT = Math.max(0, p.screenT - dt);
    }
    if (this.phase !== 'live') return;
    // Sauts de contestation programmés (le timing dépend de l'attribut contre)
    for (const p of this.players) {
      const ext = p as MPlayer & { jumpAt?: number };
      if (ext.jumpAt !== undefined && this.time >= ext.jumpAt) {
        ext.jumpAt = undefined;
        if (p.onCourt && p.team !== this.possession) this.defensiveJump(p);
      }
    }
    const off = this.possession;
    for (const p of this.players) {
      if (!p.onCourt || p.thinkT > 0) continue;
      const iq = p.data.attrs.iq;
      p.thinkT = 0.1 + (20 - iq) * 0.006 + this.rng.next() * 0.05;
      const userControlled = p.isUser && !this.userAutoActive();
      if (p.team === off) offenseThink(this, p, userControlled);
      else defenseThink(this, p, userControlled);
    }
  }

  userAutoActive(): boolean {
    if (!this.userControl) return true;
    return this.userAssist && this.userIdleT > 1.6;
  }

  applyUserInput(dt: number): void {
    if (this.userIdx < 0 || !this.userControl) return;
    const u = this.players[this.userIdx];
    const inp = this.input;
    const moving = Math.hypot(inp.mx, inp.my) > 0.15;
    const any = moving || inp.shoot || inp.pass || inp.action || inp.jump || inp.callBall || inp.lob;
    this.userIdleT = any ? 0 : this.userIdleT + dt;
    if (!u.onCourt || this.phase !== 'live') return;
    if (moving && u.actionLock <= 0) {
      const l = Math.min(1, Math.hypot(inp.mx, inp.my));
      u.target = this.court.clampInside({ x: u.pos.x + inp.mx * 2.2, y: u.pos.y + inp.my * 2.2 }, -0.3);
      u.urgency = inp.sprint ? 1 : 0.55 + 0.25 * l;
      u.intent = 'contrôle';
    } else if (!this.userAutoActive() && !moving) {
      // Le joueur s'arrête si on lâche le joystick (pas d'IA tant qu'il n'est pas inactif)
      u.target = { ...u.pos };
    }
    const pressed = (k: keyof UserInput) => !!inp[k] && !this.prevInput[k];
    const released = (k: keyof UserInput) => !inp[k] && !!this.prevInput[k];
    const hasBall = this.ball.state === 'held' && this.ball.holder === u.idx;
    if (hasBall) {
      if (pressed('shoot') && u.actionLock <= 0) this.beginShot(u, { userTimed: true });
      if (released('shoot') && u.anim === 'shoot') (u as MPlayer & { releaseAt?: number }).releaseAt = u.animT;
      if ((pressed('pass') || pressed('lob')) && u.actionLock <= 0) {
        const tgt = this.pickPassTarget(u, inp.mx, inp.my);
        if (tgt) this.launchPass(u, tgt, inp.lob ? 'lob' : 'chest');
      }
      if (pressed('action')) this.callScreen(u);
    } else if (u.team === this.possession) {
      if (pressed('action')) this.userSetScreen(u);
      if (pressed('callBall')) {
        u.intent = 'demande le ballon';
        (u as MPlayer & { callT?: number }).callT = this.time;
      }
      if (pressed('shoot') && u.actionLock <= 0) {
        u.intent = 'coupe';
        const h = this.hoopFor(u.team);
        u.target = { x: h.x - this.attackSide(u.team) * 0.8, y: h.y + (u.pos.y < h.y ? -0.6 : 0.6) };
        u.urgency = 1;
        u.actionLock = 0.9;
      }
    } else {
      if (pressed('jump') || pressed('shoot')) this.defensiveJump(u);
      if (pressed('action') || pressed('pass')) this.attemptSteal(u, true);
    }
  }

  // ---------------------------------------------------------------- Déplacements
  maxSpeed(p: MPlayer): number {
    const a = p.data.attrs;
    let v = 4.4 + (a.speed / 20) * 3.4;
    v *= 0.78 + 0.22 * p.energy;
    if (this.ball.holder === p.idx && this.ball.state === 'held') v *= 0.86 + (a.dribble / 20) * 0.08;
    if (p.slowT > 0) v *= 0.45;
    return v;
  }

  movePlayers(dt: number): void {
    const act = this.players.filter((p) => p.onCourt);
    for (const p of act) {
      // Suspendu à l'arceau après un dunk
      const hang = p as MPlayer & { hangT?: number };
      if (hang.hangT && hang.hangT > 0) {
        hang.hangT -= dt;
        p.vz = 0;
      } else if (p.z > 0 || p.vz > 0) {
        p.vz -= 9.81 * dt;
        p.z += p.vz * dt;
        if (p.z <= 0) {
          p.z = 0;
          p.vz = 0;
        }
      }
      const a = p.data.attrs;
      const acc = (6 + (a.acceleration / 20) * 9) * (0.8 + 0.2 * p.energy);
      // Cible lissée : les petits réajustements de l'IA ne provoquent plus d'à-coups
      const st = p as MPlayer & { aim?: V2 };
      const jump = st.aim ? Math.hypot(p.target.x - st.aim.x, p.target.y - st.aim.y) : 99;
      if (!st.aim || jump > 2.5 || p.urgency >= 0.95 || p.isUser) st.aim = { x: p.target.x, y: p.target.y };
      else {
        const k = Math.min(1, dt * 5);
        st.aim.x += (p.target.x - st.aim.x) * k;
        st.aim.y += (p.target.y - st.aim.y) * k;
      }
      const dx = st.aim.x - p.pos.x;
      const dy = st.aim.y - p.pos.y;
      const d = Math.hypot(dx, dy);
      const vmax = this.maxSpeed(p) * (0.32 + 0.68 * clamp(p.urgency, 0, 1));
      let desired = Math.min(vmax, d * 2.6);
      if (d < 0.05) desired = 0;
      if (p.z > 0.05) desired *= 0.3; // en l'air : on ne change plus de direction
      if (p.screenT > 0) desired = 0; // pose un écran : immobile
      let dvx = (d > 1e-6 ? (dx / d) * desired : 0) - p.vel.x;
      let dvy = (d > 1e-6 ? (dy / d) * desired : 0) - p.vel.y;
      // Évitement simple des obstacles devant soi
      if (desired > 1) {
        const dir = { x: dx / d, y: dy / d };
        for (const o of act) {
          if (o === p) continue;
          const rx = o.pos.x - p.pos.x;
          const ry = o.pos.y - p.pos.y;
          const along = rx * dir.x + ry * dir.y;
          if (along <= 0 || along > 1.3) continue;
          const lat = -rx * dir.y + ry * dir.x;
          if (Math.abs(lat) > 0.7) continue;
          // Contourner : l'intelligence défensive sur écran (pnrD) aide à passer l'écran plus vite
          const skill = p.team !== this.possession ? a.pnrD / 20 : a.agility / 20;
          const sideSign = lat > 0 ? -1 : 1;
          const k = (0.6 + skill * 1.6) * (1 - along / 1.3) * desired;
          dvx += -dir.y * sideSign * k;
          dvy += dir.x * sideSign * k;
        }
      }
      const dl = Math.hypot(dvx, dvy);
      const maxDv = acc * dt;
      if (dl > maxDv) {
        dvx = (dvx / dl) * maxDv;
        dvy = (dvy / dl) * maxDv;
      }
      p.vel.x += dvx;
      p.vel.y += dvy;
    }
    // Intégration + collisions (personne ne traverse personne)
    for (const p of act) {
      p.pos.x += p.vel.x * dt;
      p.pos.y += p.vel.y * dt;
    }
    const R = 0.34;
    for (let i = 0; i < act.length; i++) {
      for (let j = i + 1; j < act.length; j++) {
        const a = act[i];
        const b = act[j];
        let dx = b.pos.x - a.pos.x;
        let dy = b.pos.y - a.pos.y;
        let d = Math.hypot(dx, dy);
        if (d < 1e-6) {
          // Positions confondues : séparation dans une direction arbitraire mais déterministe
          d = 1e-3;
          dx = Math.cos(a.idx * 2.399) * d;
          dy = Math.sin(a.idx * 2.399) * d;
          b.pos.x = a.pos.x + dx;
          b.pos.y = a.pos.y + dy;
        }
        if (d < R * 2) {
          const overlap = R * 2 - d;
          const nx = dx / d;
          const ny = dy / d;
          const ma = this.mass(a);
          const mb = this.mass(b);
          const wa = mb / (ma + mb);
          const wb = ma / (ma + mb);
          a.pos.x -= nx * overlap * wa;
          a.pos.y -= ny * overlap * wa;
          b.pos.x += nx * overlap * wb;
          b.pos.y += ny * overlap * wb;
          // Amortissement des vitesses relatives (contact)
          const rv = (b.vel.x - a.vel.x) * nx + (b.vel.y - a.vel.y) * ny;
          if (rv < 0) {
            a.vel.x += nx * rv * wa;
            a.vel.y += ny * rv * wa;
            b.vel.x -= nx * rv * wb;
            b.vel.y -= ny * rv * wb;
          }
          if (a.team !== b.team && (rv < -0.9 || this.ball.holder === a.idx || this.ball.holder === b.idx)) {
            if (this.time - (a.bumpT ?? -9) > 0.35) {
              a.bumpT = this.time;
              a.bumpX = -nx;
              a.bumpY = -ny;
            }
            if (this.time - (b.bumpT ?? -9) > 0.35) {
              b.bumpT = this.time;
              b.bumpX = nx;
              b.bumpY = ny;
            }
          }
          this.onContact(a, b);
        }
      }
    }
    for (const p of act) {
      const sp = Math.hypot(p.vel.x, p.vel.y);
      p.stride += (sp * dt) / 1.45 * Math.PI;
      // Orientation
      let face: number | null = null;
      if (p.team !== this.possession && this.phase === 'live') {
        const tgt = p.assign >= 0 ? this.players[p.assign].pos : this.ballPos();
        face = Math.atan2(tgt.y - p.pos.y, tgt.x - p.pos.x);
      } else if (sp > 0.6) face = Math.atan2(p.vel.y, p.vel.x);
      else if (this.ball.holder === p.idx) {
        const h = this.hoopFor(p.team);
        face = Math.atan2(h.y - p.pos.y, h.x - p.pos.x);
      } else {
        face = Math.atan2(this.ball.y - p.pos.y, this.ball.x - p.pos.x);
      }
      if (face !== null) {
        let da = face - p.facing;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        p.facing += da * Math.min(1, dt * 9);
      }
      // Animation de base selon l'état
      const busy = ['shoot', 'layup', 'dunk', 'pass', 'block', 'rebound', 'celebrate', 'jumpball', 'stumble', 'catch', 'fall'];
      if (!busy.includes(p.anim) || p.animT > (p.anim === 'fall' ? 1.5 : 0.9)) {
        if (p.screenT > 0) p.anim = 'screen';
        else if (this.ball.holder === p.idx && this.ball.state === 'held') {
          // Jeu dos au panier : l'intérieur près du cercle, défenseur au contact
          const postUp = p.role === 'post' && this.phase === 'live' && sp < 2.5 && dist(p.pos, this.hoopFor(p.team)) < 5.5 && this.nearestDefender(p).d < 1.3;
          p.anim = postUp ? 'post' : 'dribble';
        }
        else if (p.team !== this.possession && this.phase === 'live' && sp < 3.5) p.anim = 'stance';
        else if (this.phase !== 'live' && p.energy < 0.55 && sp < 0.3) p.anim = 'tired';
        else p.anim = sp > 0.35 ? 'run' : 'idle';
      }
      // Limites : on peut sortir légèrement (remises en jeu), pas au-delà
      const g = this.court.g;
      p.pos.x = clamp(p.pos.x, -1.2, g.length + 1.2);
      p.pos.y = clamp(p.pos.y, -1.2, g.width + 1.2);
    }
  }

  mass(p: MPlayer): number {
    let m = p.data.weightKg * (0.7 + (p.data.attrs.strength / 20) * 0.6);
    if (p.screenT > 0) m *= 4;
    if (p.z > 0.1) m *= 0.6;
    return m;
  }

  /** Contact physique : passage en force, charge, faute défensive… */
  onContact(a: MPlayer, b: MPlayer): void {
    if (this.phase !== 'live') return;
    const h = this.holder();
    if (!h || (h !== a && h !== b)) return;
    const def = h === a ? b : a;
    if (def.team === h.team) return;
    const sp = Math.hypot(h.vel.x, h.vel.y);
    if (sp < 4.2 || h.intent !== 'drive') return;
    // Défenseur bien placé et immobile -> passage en force possible ; sinon faute défensive possible
    const defSp = Math.hypot(def.vel.x, def.vel.y);
    const hoop = this.hoopFor(h.team);
    const between = dist(def.pos, hoop) < dist(h.pos, hoop);
    if (!between) return;
    if (this.rng.chance(0.2)) {
      const set = defSp < 1.0 && def.data.attrs.positioning / 20 > this.rng.next() * 0.9;
      const inRA = dist(def.pos, hoop) < this.court.g.restrictedRadius;
      if (set && !inRA) this.callFoul(h, def, 'offensive');
      else if (this.rng.chance(0.55 - def.data.attrs.discipline / 60)) this.callFoul(def, h, 'blocking');
    } else {
      h.slowT = Math.max(h.slowT, 0.25);
    }
  }

  // ---------------------------------------------------------------- Actions
  /** Le porteur déclenche un tir (l'issue sera calculée à la libération du ballon). */
  beginShot(p: MPlayer, opts: { userTimed?: boolean } = {}): void {
    if (this.ball.holder !== p.idx || this.ball.state !== 'held') return;
    const hoop = this.hoopFor(p.team);
    const d = dist(p.pos, hoop);
    const a = p.data.attrs;
    let type: ShotType;
    const driving = p.intent === 'drive' || Math.hypot(p.vel.x, p.vel.y) > 3.5;
    const canDunk = p.heightM + (a.vertical / 20) * 0.75 + (a.dunk / 20) * 0.35 > 2.55;
    if (d < 1.9 && canDunk && (driving || a.dunk >= 14) && this.nearestDefender(p).d > 0.8) type = 'dunk';
    else if (d < 2.6) type = 'layup';
    else if (d < 4.6 && driving && a.finishing >= 8) type = 'floater';
    else if (d < 3.6 && p.role === 'post') type = 'hook';
    else type = this.court.isThree(this.attackSide(p.team), p.pos) ? 'three' : 'jumper';
    const gather = type === 'dunk' ? 0.42 : type === 'layup' ? 0.36 : type === 'floater' ? 0.32 : type === 'hook' ? 0.38 : 0.46;
    p.anim = type === 'dunk' ? 'dunk' : type === 'layup' || type === 'floater' ? 'layup' : 'shoot';
    p.animT = 0;
    {
      // Variante visuelle du geste (déterministe, sans tirage aléatoire de simulation)
      const hsh = (p.idx * 7 + Math.floor(this.time * 13)) % 12;
      const pressed = this.nearestDefender(p).d < 1.5;
      if (type === 'dunk') p.move = a.dunk >= 15 && hsh % 3 === 0 ? 'tomahawk' : hsh % 2 === 0 ? 'dunk1' : 'dunk2';
      else if (type === 'layup') p.move = pressed && hsh % 3 === 0 ? 'reverse' : pressed && a.finishing >= 13 && hsh % 3 === 1 ? 'euro' : hsh % 2 === 0 ? 'fingerroll' : 'layup';
      else if (type === 'floater') p.move = 'floater';
      else if (type === 'hook') p.move = 'hook';
      else if (pressed && p.pickupT > 0.9 && a.midRange >= 12 && hsh % 2 === 0) p.move = 'fade';
      else if (pressed && p.pickupT > 0.9 && hsh % 3 === 0) p.move = 'stepback';
      else p.move = p.pickupT > 0.9 ? 'pullup' : 'set';
    }
    p.actionLock = gather + 0.5;
    p.intent = 'tir';
    const ext = p as MPlayer & { shotPlan?: { type: ShotType; gather: number; userTimed: boolean; offDribble: boolean }; releaseAt?: number };
    ext.shotPlan = { type, gather, userTimed: !!opts.userTimed, offDribble: p.pickupT > 0.9 };
    ext.releaseAt = undefined;
    // Pas d'appel vers le cercle pendant les appuis
    if (type === 'layup' || type === 'dunk') {
      const dir = norm({ x: hoop.x - p.pos.x, y: hoop.y - p.pos.y });
      const stopAt = type === 'dunk' ? 0.7 : 1.35;
      p.target = d > stopAt ? { x: hoop.x - dir.x * stopAt, y: hoop.y - dir.y * stopAt } : { ...p.pos };
      p.urgency = 0.8;
    } else {
      p.target = { ...p.pos };
      p.vel.x *= 0.3;
      p.vel.y *= 0.3;
    }
    // Les défenseurs proches réagissent (contestation)
    for (const o of this.teamOnCourt((1 - p.team) as 0 | 1)) {
      if (o.isUser && !this.userAutoActive()) continue;
      const od = dist(o.pos, p.pos);
      if (od < 3.2) {
        o.target = { x: p.pos.x + (o.pos.x - p.pos.x) * 0.25, y: p.pos.y + (o.pos.y - p.pos.y) * 0.25 };
        o.urgency = 1;
        if (od < 2.0 && o.jumpCd <= 0) {
          const delay = 0.12 + (1 - o.data.attrs.block / 20) * 0.22 + this.rng.next() * 0.1;
          (o as MPlayer & { jumpAt?: number }).jumpAt = this.time + delay;
        }
      }
    }
    this.emit({ type: 'info', team: p.team, player: p.idx, text: '' });
    this.events.pop();
    this.shotPending.push(p.idx);
  }
  shotPending: number[] = [];

  /** Calcule et lance le ballon au moment de la libération */
  releaseShot(p: MPlayer): void {
    const ext = p as MPlayer & { shotPlan?: { type: ShotType; gather: number; userTimed: boolean; offDribble: boolean }; releaseAt?: number };
    const plan = ext.shotPlan;
    if (!plan || this.ball.holder !== p.idx) return;
    const side = this.attackSide(p.team);
    const hoop = this.court.hoop(side);
    const d = dist(p.pos, hoop);
    let type = plan.type;
    if (type === 'three' && !this.court.isThree(side, p.pos)) type = 'jumper';
    if (type === 'jumper' && this.court.isThree(side, p.pos)) type = 'three';
    // Contestation réelle au moment du tir
    let contest = 0;
    let heightAdv = 0;
    let fouler: MPlayer | null = null;
    for (const o of this.teamOnCourt((1 - p.team) as 0 | 1)) {
      const od = dist(o.pos, p.pos);
      const front = dist(o.pos, hoop) < d + 0.6;
      if (od < 2.6 && front) {
        const c = clamp((2.4 - od) / 2.0, 0, 1) * (o.z > 0.15 ? 1.05 : 0.7) * (0.75 + o.data.attrs.perimeterD / 80);
        if (c > contest) {
          contest = c;
          heightAdv = p.heightM - o.heightM;
        }
        // Faute sur le tireur
        const contactR = type === 'layup' || type === 'dunk' ? 1.05 : 0.85;
        if (od < contactR) {
          const disc = o.data.attrs.discipline / 20;
          const foulTrouble = o.fouls >= this.rules.foulOut - 1 ? 0.5 : 1;
          let pf = (type === 'layup' || type === 'dunk' ? 0.62 : 0.16) * (1.35 - disc * 0.6) * foulTrouble;
          pf *= 0.8 + (p.data.attrs.strength / 20) * 0.4;
          if (!fouler && this.rng.chance(pf)) fouler = o;
        }
      }
    }
    contest = clamp(contest, 0, 1);
    let prob = shotProbability(p.data, {
      type,
      dist: d,
      contest,
      offDribble: plan.offDribble,
      energy: p.energy,
      hotness: p.hotness,
      clutch: this.clutch(),
      heightAdv,
      confidence: p.data.confidence,
    });
    if (fouler) prob *= 0.62;
    let timingMul = 1;
    if (plan.userTimed && plan.type !== 'layup' && plan.type !== 'dunk') {
      const rel = ext.releaseAt ?? plan.gather + 0.25;
      const err = Math.abs(rel - plan.gather) / 0.18; // 0 = parfait
      timingMul = err < 0.25 ? 0.72 : err < 0.6 ? 0.95 : err < 1 ? 1.15 : 1.45;
      (p as MPlayer & { lastTiming?: number }).lastTiming = err;
    }
    const sigma = sigmaForShot(prob, d, type) * timingMul;
    // Erreur de visée (profondeur / latérale) puis trajectoire physique
    const dir = norm({ x: hoop.x - p.pos.x, y: hoop.y - p.pos.y });
    const e1 = this.rng.normal(0, sigma) + 0.03;
    const e2 = this.rng.normal(0, sigma * 0.6);
    const releaseZ = type === 'dunk' ? 3.2 : p.heightM * 1.18 + p.z + (type === 'layup' ? 0.35 : 0.2);
    const start = { x: p.pos.x + dir.x * 0.25, y: p.pos.y + dir.y * 0.25, z: releaseZ };
    const end = { x: hoop.x + dir.x * e1 - dir.y * e2, y: hoop.y + dir.y * e1 + dir.x * e2, z: this.court.g.rimHeight };
    let apex: number;
    if (type === 'dunk') {
      apex = 3.35;
      end.x = hoop.x + dir.x * (e1 * 0.5);
      end.y = hoop.y + dir.y * (e1 * 0.5);
    } else if (type === 'layup') apex = 3.05 + 0.7;
    else if (type === 'floater') apex = 3.05 + 1.5;
    else apex = 3.05 + clamp(0.9 + d * 0.11, 0.9, 1.9);
    const v = launchVelocity(start, end, apex);
    const points = type === 'three' ? 3 : 2;
    const b = this.ball;
    b.state = 'air';
    b.holder = -1;
    b.x = start.x;
    b.y = start.y;
    b.z = start.z;
    b.vx = v.vx;
    b.vy = v.vy;
    b.vz = v.vz;
    b.airT = 0;
    b.lastTouch = p.idx;
    b.lastTeam = p.team;
    b.dribbling = false;
    const lastPass = (p as MPlayer & { passFrom?: number; caughtAt?: number });
    b.flight = {
      kind: 'shot',
      from: p.idx,
      to: -1,
      team: p.team,
      t: 0,
      dur: v.T,
      start,
      end,
      shotType: type,
      points,
      side,
      assistFrom: lastPass.passFrom !== undefined && lastPass.caughtAt !== undefined && this.time - lastPass.caughtAt < 4.2 ? lastPass.passFrom : undefined,
      contest,
      fouled: !!fouler,
    };
    this.shotClockOn = false;
    if (this.shotClock <= 0) this.shotClockExpiredInFlight = true;
    p.box.fga += fouler ? 0 : 1;
    if (type === 'three' && !fouler) p.box.tpa += 1;
    const label: Record<ShotType, string> = {
      jumper: 'tire à mi-distance',
      three: 'tente à 3 points',
      layup: 'attaque le cercle (lay-up)',
      dunk: 'monte au dunk',
      floater: 'tente un floater',
      hook: 'tente un bras roulé',
      ft: 'lancer franc',
      tip: 'claquette',
    };
    const hv = this.court.toHoop(side, p.pos);
    this.emit({ type: 'shot', team: p.team, player: p.idx, text: `${this.name(p.idx)} ${label[type]}`, detail: `${Math.round(prob * 100)}%`, sx: hv.u, sy: hv.v, shotType: type });
    // Contres : un défenseur en l'air à proximité peut toucher le ballon à la sortie de la main
    for (const o of this.teamOnCourt((1 - p.team) as 0 | 1)) {
      const od = dist(o.pos, start);
      if (o.z < 0.12 || od > 1.25) continue;
      const reach = o.heightM * 1.33 + o.z + 0.12;
      if (reach < releaseZ - 0.1 && type !== 'layup') continue;
      const blockSkill = (o.data.attrs.block * 0.6 + o.data.attrs.rimProtect * 0.4) / 20;
      let pb = 0.08 + blockSkill * 0.32 - (p.heightM - o.heightM) * 0.6;
      if (type === 'three' || type === 'jumper') pb *= 0.45;
      if (type === 'dunk') pb *= 0.5;
      pb *= 1.2 - od / 1.25;
      if (this.rng.chance(clamp(pb, 0, 0.45))) {
        this.blockShot(o, p);
        break;
      }
    }
    if (fouler && b.flight && !b.flight.blocked) {
      b.flight.ftsAfter = points;
      this.pendingShootingFoul = { fouler: fouler.idx, shooter: p.idx, points };
    }
    if (fouler && b.flight?.blocked) {
      // Faute sur un contre
      this.callFoul(fouler, p, 'shooting', points);
    }
    this.onShotReleased(p);
    p.actionLock = 0.35;
    ext.shotPlan = undefined;
  }
  pendingShootingFoul: { fouler: number; shooter: number; points: number } | null = null;

  blockShot(blocker: MPlayer, shooter: MPlayer): void {
    const b = this.ball;
    const away = norm({ x: b.x - blocker.pos.x, y: b.y - blocker.pos.y });
    const own = this.ownHoop(blocker.team);
    const toward = norm({ x: own.x - b.x, y: own.y - b.y });
    // Contre « propre » : le ballon est le plus souvent gardé en jeu, dévié vers le terrain
    const g = this.court.g;
    const inX = b.x < g.length / 2 ? 1 : -1;
    const inY = b.y < g.width / 2 ? 1 : -1;
    const edge = Math.min(b.x, g.length - b.x) < 2.2 || Math.min(b.y, g.width - b.y) < 2.2 ? 0.45 : 1;
    b.vx = (-toward.x * 1.4 + away.x * 1.2 + this.rng.normal(0, 0.7)) * edge + inX * 1.3;
    b.vy = (-toward.y * 1.4 + away.y * 1.2 + this.rng.normal(0, 0.7)) * edge + inY * 0.9;
    b.vz = -1.5 + this.rng.next() * 1.5;
    if (b.flight) {
      b.flight.blocked = true;
      b.flight.kind = 'block';
    }
    b.lastTouch = blocker.idx;
    b.lastTeam = blocker.team;
    blocker.box.blk++;
    shooter.box.fga += 0; // déjà compté
    blocker.anim = 'block';
    blocker.animT = 0;
    this.slowmo = 1.2;
    this.replayMarks.push({ t: this.time, kind: 'block' });
    this.emit({ type: 'block', team: blocker.team, player: blocker.idx, other: shooter.idx, text: `CONTRE de ${this.name(blocker.idx)} sur ${this.name(shooter.idx)} !` });
    this.ball.state = 'loose';
    this.shotClockOn = true;
  }

  onShotReleased(shooter: MPlayer): void {
    // Rebond : les intérieurs vont au rebond offensif, les défenseurs bloquent
    const tac = this.teams[shooter.team].tactics;
    for (const p of this.teamOnCourt(shooter.team)) {
      if (p === shooter) continue;
      const big = p.data.pos === 'C' || p.data.pos === 'PF';
      const crash = tac.crashBoards * (big ? 1.4 : 0.6) + (p.data.attrs.defRebound / 20) * 0.2;
      p.role = this.rng.chance(p.isUser ? crash * (0.5 + this.userStyle.hustle) : crash) ? 'crash' : 'safety';
    }
  }

  defensiveJump(p: MPlayer): void {
    if (p.z > 0.02 || p.jumpCd > 0) return;
    const a = p.data.attrs;
    p.vz = 2.6 + (a.vertical / 20) * 1.6;
    p.anim = 'block';
    p.animT = 0;
    p.jumpCd = 0.9;
    p.actionLock = 0.5;
  }

  /** Tentative d'interception sur le porteur ou dans une ligne de passe */
  attemptSteal(p: MPlayer, user = false): void {
    if (p.actionLock > 0) return;
    const h = this.holder();
    if (h && h.team !== p.team && dist(h.pos, p.pos) < 1.15) {
      const a = p.data.attrs;
      const success = 0.05 + (a.steal / 20) * 0.13 - (h.data.attrs.ballSecurity / 20) * 0.1 - (h.data.attrs.dribble / 20) * 0.04;
      const r = this.rng.next();
      p.anim = 'block';
      p.animT = 0;
      p.actionLock = 0.6;
      if (r < success) {
        // Ballon arraché : ballon libre
        const b = this.ball;
        b.state = 'loose';
        b.holder = -1;
        b.vx = (p.pos.x - h.pos.x) * 1.4 + this.rng.normal(0, 0.6);
        b.vy = (p.pos.y - h.pos.y) * 1.4 + this.rng.normal(0, 0.6);
        b.vz = 1.2;
        b.z = 0.8;
        b.lastTouch = p.idx;
        b.lastTeam = p.team;
        (b as Ball & { stripBy?: number; stripOf?: number }).stripBy = p.idx;
        (b as Ball & { stripBy?: number; stripOf?: number }).stripOf = h.idx;
        h.anim = 'stumble';
        h.animT = 0;
        h.slowT = 0.4;
      } else {
        const disc = a.discipline / 20;
        if (this.rng.chance(0.45 * (1.35 - disc * 0.7) * (user ? 1.2 : 1))) {
          this.callFoul(p, h, 'reach');
        } else {
          p.slowT = 0.55; // déséquilibré : le porteur peut en profiter
        }
      }
    } else if (this.ball.state === 'air' && this.ball.flight?.kind === 'pass') {
      // Plongée dans la ligne de passe
      p.urgency = 1;
      p.target = { x: this.ball.x + this.ball.vx * 0.25, y: this.ball.y + this.ball.vy * 0.25 };
      (p as MPlayer & { lungeT?: number }).lungeT = this.time;
      p.actionLock = 0.4;
    }
  }

  callScreen(handler: MPlayer): void {
    const mates = this.teamOnCourt(handler.team).filter((p) => p !== handler && !p.isUser);
    if (!mates.length) return;
    const big = mates.sort((a, b) => b.heightM - a.heightM)[0];
    this.offense[handler.team].pnr = { handler: handler.idx, screener: big.idx, t: 0, pop: big.data.attrs.three >= 13 && this.rng.chance(0.6) };
    this.emit({ type: 'info', team: handler.team, player: handler.idx, text: `${this.name(handler.idx)} appelle l'écran de ${this.name(big.idx)}` });
  }

  userSetScreen(u: MPlayer): void {
    const h = this.holder();
    if (!h || h.team !== u.team) return;
    this.offense[u.team].pnr = { handler: h.idx, screener: u.idx, t: 0, pop: false };
    u.intent = 'pose un écran';
  }

  pickPassTarget(p: MPlayer, mx: number, my: number): MPlayer | null {
    const mates = this.teamOnCourt(p.team).filter((m) => m !== p);
    if (!mates.length) return null;
    const l = Math.hypot(mx, my);
    if (l > 0.3) {
      let best: MPlayer | null = null;
      let bs = -9;
      for (const m of mates) {
        const v = norm({ x: m.pos.x - p.pos.x, y: m.pos.y - p.pos.y });
        const s = (v.x * mx + v.y * my) / l - dist(m.pos, p.pos) * 0.015;
        if (s > bs) {
          bs = s;
          best = m;
        }
      }
      return best;
    }
    // Meilleur partenaire selon la lecture de l'IA
    let best: MPlayer | null = null;
    let bs = -9;
    for (const m of mates) {
      const open = this.nearestDefender(m).d;
      const s = open - this.passRisk(p, m) * 4 + (dist(m.pos, this.hoopFor(p.team)) < 3 ? 1 : 0);
      if (s > bs) {
        bs = s;
        best = m;
      }
    }
    return best;
  }

  /** Risque d'interception d'une passe (0..1) selon les défenseurs proches de la trajectoire */
  passRisk(from: MPlayer, to: MPlayer, lob = false): number {
    let risk = 0;
    for (const o of this.teamOnCourt((1 - from.team) as 0 | 1)) {
      const { d, t } = distToSegment(o.pos, from.pos, to.pos);
      if (t < 0.08) continue;
      const reach = lob ? 0.35 : 1;
      const r = clamp((1.3 - d) / 1.3, 0, 1) * (0.5 + o.data.attrs.passReading / 40) * reach;
      risk = Math.max(risk, r * (t > 0.85 ? 0.6 : 1));
    }
    return risk;
  }

  /** Choix du type de passe : directe, ou lobée par-dessus un défenseur placé dans la ligne (selon la qualité de passe). */
  bestPass(from: MPlayer, to: MPlayer): { risk: number; kind: 'chest' | 'lob' } {
    const direct = this.passRisk(from, to);
    const skill = from.data.attrs.passing;
    const recvOpen = this.nearestDefender(to).d;
    const lob = this.passRisk(from, to, true) + 0.06 + Math.max(0, 12 - skill) / 40 + Math.max(0, 1.6 - recvOpen) * 0.12;
    return lob < direct ? { risk: lob, kind: 'lob' } : { risk: direct, kind: 'chest' };
  }

  launchPass(from: MPlayer, to: MPlayer, kind: 'chest' | 'lob' | 'bounce' | 'tip' | 'inbound'): void {
    const b = this.ball;
    const lob = kind === 'lob';
    const speed = kind === 'tip' ? 7 : lob ? 8 : 11 + (from.data.attrs.passing / 20) * 3;
    const d0 = dist(from.pos, to.pos);
    const T0 = d0 / speed;
    // Passe dans la course du receveur
    const leadT = Math.min(T0 * 0.85, 0.6);
    let lead = { x: to.pos.x + to.vel.x * leadT, y: to.pos.y + to.vel.y * leadT };
    lead = this.court.clampInside(lead, 0.6);
    // Ballon déjà en zone avant : la passe vise l'avant de la ligne médiane
    if (this.frontcourtReached && kind !== 'tip' && kind !== 'inbound') {
      const sideA = this.attackSide(from.team);
      const mid = this.court.g.length / 2;
      if ((lead.x - mid) * sideA < 0.8) lead.x = mid + sideA * 0.8;
    }
    const acc = from.data.attrs.passing / 20;
    const err = (1 - acc) * 0.5 + (from.energy < 0.4 ? 0.2 : 0);
    lead.x += this.rng.normal(0, err * 0.5);
    lead.y += this.rng.normal(0, err * 0.5);
    // Passe mal ajustée (rare) : sous pression, un passeur moyen envoie parfois le ballon hors de portée
    if (kind === 'chest' || kind === 'lob') {
      const pressed = this.nearestDefender(from).d < 1.3 ? 1.8 : 1;
      if (this.rng.chance((1.15 - acc) * 0.012 * pressed)) {
        const a = this.rng.next() * Math.PI * 2;
        lead.x += Math.cos(a) * 2.2;
        lead.y += Math.sin(a) * 2.2;
      }
    }
    const start = kind === 'tip' ? { x: b.x, y: b.y, z: b.z } : { x: from.pos.x, y: from.pos.y, z: 1.35 };
    const end = { x: lead.x, y: lead.y, z: lob ? 2.6 : 1.3 };
    const apex = lob ? Math.max(3.6, 2.5 + d0 * 0.18) : Math.max(start.z, end.z) + 0.15 + d0 * 0.02;
    const v = launchVelocity(start, end, apex);
    b.state = 'air';
    b.holder = -1;
    b.dribbling = false;
    Object.assign(b, { x: start.x, y: start.y, z: start.z, vx: v.vx, vy: v.vy, vz: v.vz, airT: 0 });
    b.lastTouch = from.idx;
    b.lastTeam = from.team;
    b.flight = { kind: 'pass', from: from.idx, to: to.idx, team: from.team, t: 0, dur: v.T, start, end, lob };
    if (kind !== 'tip') {
      from.anim = 'pass';
      from.animT = 0;
      from.actionLock = 0.25;
    }
    to.target = { ...lead };
    to.urgency = 0.9;
    to.intent = 'reçoit';
    if (kind !== 'tip' && kind !== 'inbound') this.emit({ type: 'pass', team: from.team, player: from.idx, other: to.idx, text: `${this.name(from.idx)} → ${this.name(to.idx)}` });
  }

  // ---------------------------------------------------------------- Ballon
  updateBall(dt: number): void {
    const b = this.ball;
    if (b.state === 'held') {
      const h = this.players[b.holder];
      // Tir en préparation
      const ext = h as MPlayer & { shotPlan?: { gather: number }; releaseAt?: number };
      if (ext.shotPlan) {
        const gather = ext.shotPlan.gather;
        const userRelease = h.isUser && !this.userAutoActive() && ext.releaseAt === undefined && this.input.shoot;
        if (h.animT > gather * 0.45 && h.z === 0 && (h.anim === 'shoot' || h.anim === 'layup' || h.anim === 'dunk')) {
          h.vz = h.anim === 'dunk' ? 3.6 : h.anim === 'layup' ? 2.6 : 2.0 + (h.data.attrs.vertical / 20) * 0.6;
        }
        const releaseAt = ext.releaseAt ?? (userRelease ? Math.max(gather + 0.32, h.animT + 1) : gather);
        if (h.animT >= releaseAt || h.animT > gather + 0.45) {
          if (ext.releaseAt === undefined && h.isUser) ext.releaseAt = h.animT;
          this.releaseShot(h);
          return;
        }
        // Le ballon monte vers la position de tir
        const k = clamp(h.animT / gather, 0, 1);
        // (position de tir au-dessus du front ; bras tendu vers le cercle sur double pas et dunk)
        const mvs = h.move ?? '';
        const reach = h.anim === 'shoot' ? (mvs === 'hook' ? 0.6 : mvs === 'floater' ? 0.5 : 0.4) : 0.58;
        const fw = mvs === 'fingerroll' ? 0.36 : mvs === 'hook' ? 0.05 : mvs === 'tomahawk' && k < 0.8 ? -0.05 : h.anim === 'shoot' ? 0.16 : 0.26;
        const ks = k * k * (3 - 2 * k);
        b.x = h.pos.x + Math.cos(h.facing) * fw;
        b.y = h.pos.y + Math.sin(h.facing) * fw;
        b.z = 1.0 + ks * (h.heightM * 0.8 + reach - 1.0) + h.z;
        return;
      }
      // Dribble : le ballon rebondit au sol au rythme de la course
      const natural = h.data.hand === 'L' ? -1 : 1;
      const perp = h.facing + Math.PI / 2;
      const sp = Math.hypot(h.vel.x, h.vel.y);
      if (h.ballHand === undefined) h.ballHand = natural;
      h.xoverT = (h.xoverT ?? 9) + dt;
      if (this.phase === 'live' && h.xoverT > 0.85) {
        // Protection du ballon : on dribble de la main opposée au défenseur
        const nd = this.nearestDefender(h);
        let want: 1 | -1 = h.ballHand;
        if (nd.pl && nd.d < 2.4) {
          const lat = (nd.pl.pos.x - h.pos.x) * Math.cos(perp) + (nd.pl.pos.y - h.pos.y) * Math.sin(perp);
          if (Math.abs(lat) > 0.3) want = lat > 0 ? -1 : 1;
          else if (sp < 0.9 && h.data.attrs.dribble >= 11 && h.xoverT > 1.3 + (h.idx % 3) * 0.35) want = (-h.ballHand) as 1 | -1; // dribbles d'attente
        } else if (sp > 3 && h.xoverT > 2.5) want = natural;
        if (want !== h.ballHand) {
          h.ballHand = want;
          h.xoverT = 0;
          const skill = h.data.attrs.dribble;
          const hsh = (h.idx * 5 + Math.floor(this.time * 9)) % 6;
          h.xoverKind = skill < 10 ? 0 : hsh < 3 ? 0 : hsh < 5 || skill < 14 ? 1 : 2;
        }
      }
      const pick = h as MPlayer & { pickedUp?: boolean };
      if (pick.pickedUp) {
        // Dribble arrêté : ballon tenu à deux mains (pied de pivot)
        b.dribbling = false;
        b.x = h.pos.x + Math.cos(h.facing) * 0.3;
        b.y = h.pos.y + Math.sin(h.facing) * 0.3;
        b.z = 1.15 + h.z;
        return;
      }
      const prevPh = b.dribblePhase;
      b.dribblePhase += dt * (5.5 + sp * 0.9);
      if (Math.floor(b.dribblePhase / Math.PI) !== Math.floor(prevPh / Math.PI) && this.phase === 'live') this.sounds.push('dribble');
      b.dribbling = true;
      let lat = h.ballHand * 0.32;
      let fwd = 0.18 + sp * 0.04;
      b.z = BALL_R + Math.abs(Math.sin(b.dribblePhase)) * 0.85;
      const XD = 0.34;
      if (h.xoverT < XD) {
        // Changement de main : le ballon traverse devant, entre les jambes ou dans le dos
        const k0 = h.xoverT / XD;
        const k = k0 * k0 * (3 - 2 * k0);
        lat = h.ballHand * 0.32 * (2 * k - 1);
        if (h.xoverKind === 1) fwd = 0.02;
        else if (h.xoverKind === 2) fwd = -0.26;
        b.z = BALL_R + Math.abs(Math.cos(Math.PI * k)) * (h.xoverKind === 0 ? 0.6 : 0.5);
        if (k0 + dt / XD >= 1) b.dribblePhase = Math.PI / 2;
      }
      b.x = h.pos.x + Math.cos(perp) * lat + Math.cos(h.facing) * fwd;
      b.y = h.pos.y + Math.sin(perp) * lat + Math.sin(h.facing) * fwd;
      if (this.phase === 'inbound' || h.anim === 'pass') b.z = 1.2;
      return;
    }
    if (b.state === 'dead') return;
    b.airT += dt;
    if (b.flight) b.flight.t += dt;
    const res = stepBall(b, this.court, dt);
    const f = b.flight;
    if (res.rimHit) this.sounds.push('rim');
    else if (res.boardHit) this.sounds.push('board');
    if (res.floorHit) this.sounds.push('bounce');

    if (f && (f.kind === 'shot' || f.kind === 'ft')) {
      if (res.rimHit || res.boardHit) {
        if (res.rimHit && !f.touchedRim) this.shotClockExpiredInFlight = false;
        f.touchedRim = f.touchedRim || res.rimHit;
        if (res.rimHit) this.netSwish[res.side === 1 ? 1 : 0] = 0.15;
      }
      if (res.scored && res.side === f.side) {
        this.shotMade(f);
        return;
      }
      // Échec : le ballon redescend sous l'anneau sans être entré -> rebond disputé
      const missed = (b.z < this.court.g.rimHeight - 0.25 && b.vz < 0) || b.airT > 3.5;
      if (missed) {
        this.shotMissed(f);
        return;
      }
      if (b.airT > 2.2 && f.touchedRim) {
        // Ballon posé sur l'arceau : il finit par tomber
        b.vx += this.rng.normal(0, 0.6);
        b.vy += this.rng.normal(0, 0.6);
      }
      return;
    }

    if (f && f.kind === 'pass') {
      // Interceptions dans la ligne de passe
      for (const o of this.teamOnCourt((1 - f.team) as 0 | 1)) {
        const d = Math.hypot(o.pos.x - b.x, o.pos.y - b.y);
        const reachZ = o.heightM * 1.25 + o.z + 0.3;
        const checked = ((f as Flight & { checked?: number[] }).checked ??= []);
        if (d < 0.8 && b.z < reachZ && f.t > 0.08 && !checked.includes(o.idx)) {
          checked.push(o.idx);
          const lunge = (o as MPlayer & { lungeT?: number }).lungeT;
          const bonus = lunge !== undefined && this.time - lunge < 0.6 ? 0.18 : 0;
          const close = 1 - d / 0.8;
          const p = (0.016 + (o.data.attrs.passReading / 20) * 0.065 + (o.data.attrs.steal / 20) * 0.035 + bonus * 0.6) * (0.4 + close * 0.6) * (f.lob ? 0.5 : 1);
          if (this.rng.chance(p)) {
            this.interception(o, f);
            return;
          }
        }
      }
      const to = this.players[f.to];
      if (to && to.onCourt) {
        const d = Math.hypot(to.pos.x - b.x, to.pos.y - b.y);
        if (d < 0.85 && b.z < to.heightM * 1.3 + to.z + 0.5) {
          // Réception : les mauvaises mains peuvent échapper le ballon
          const hands = (to.data.attrs.ballControl * 0.6 + to.data.attrs.coordination * 0.4) / 20;
          const drop = (1 - hands) * 0.015 + (f.lob ? 0.02 : 0);
          if (this.rng.chance(drop)) {
            b.vx *= -0.3;
            b.vy *= -0.3;
            b.flight = null;
            b.state = 'loose';
            b.lastTouch = to.idx;
            b.lastTeam = to.team;
            this.emit({ type: 'info', team: to.team, player: to.idx, text: `${this.name(to.idx)} échappe le ballon` });
            return;
          }
          this.gainBall(to, f.from >= 0 ? 'pass' : 'tip', f.from);
          return;
        }
        // Le receveur ajuste sa course
        if (!to.isUser || this.userAutoActive()) {
          to.target = b.vz < 0 && b.z < 3 ? { x: b.x + b.vx * 0.12, y: b.y + b.vy * 0.12 } : { x: f.end.x, y: f.end.y };
          to.urgency = 1;
        }
      }
      if (b.z < 0.4 || f.t > f.dur + 0.6) {
        b.flight = null;
        b.state = 'loose';
      }
    }

    if (b.state === 'loose' || (f && (f.kind === 'block' || f.kind === 'tip'))) {
      if (f && f.kind === 'tip' && f.t < 0.3) return;
      this.updateLooseBall(res.floorHit);
    }
  }

  interception(o: MPlayer, f: Flight): void {
    o.box.stl++;
    const passer = this.players[f.from];
    passer.box.tov++;
    this.emit({ type: 'steal', team: o.team, player: o.idx, other: f.from, text: `Interception de ${this.name(o.idx)} !` });
    this.emit({ type: 'turnover', team: passer.team, player: passer.idx, text: `Balle perdue par ${this.name(passer.idx)}` });
    this.gainBall(o, 'steal', -1);
  }

  updateLooseBall(floorHit: boolean): void {
    const b = this.ball;
    // Sortie de terrain
    if (b.z < 0.4 && !this.court.inBounds({ x: b.x, y: b.y })) {
      this.outOfBounds();
      return;
    }
    // Ballon récupérable : rebonds et ballons libres
    let best: MPlayer | null = null;
    let bestW = 0;
    for (const p of this.players) {
      if (!p.onCourt) continue;
      const d = Math.hypot(p.pos.x - b.x, p.pos.y - b.y);
      const reach = p.heightM * 1.32 + p.z + 0.15;
      if (d < 0.85 && b.z < reach) {
        const a = p.data.attrs;
        const isDef = p.team !== b.flight?.team;
        const skill = ((isDef ? a.defRebound : a.defRebound * 0.8 + a.strength * 0.2) / 20) * 0.6 + (a.vertical / 20) * 0.2 + (a.strength / 20) * 0.2;
        let w = (0.85 - d) * (0.5 + skill) * (isDef ? 1.45 : 1);
        if (!isDef) {
          // Un défenseur qui bloque (box-out) entre l'attaquant et le ballon le gêne
          for (const o of this.players) {
            if (!o.onCourt || o.team === p.team || o.intent !== 'box-out') continue;
            if (Math.hypot(o.pos.x - p.pos.x, o.pos.y - p.pos.y) < 0.9) w *= 0.55;
          }
          if (this.lastShot && this.lastShot.shooter === p.idx && this.time - this.lastShot.t < 0.9) w *= 0.6;
        }
        if (w > bestW) {
          bestW = w;
          best = p;
        }
      }
    }
    if (best && this.rng.chance(0.3 + bestW)) {
      // Faute au rebond (contact dans la lutte)
      const rival = this.players.find((o) => o.onCourt && o.team !== best!.team && Math.hypot(o.pos.x - best!.pos.x, o.pos.y - best!.pos.y) < 0.75);
      if (rival && this.rng.chance(0.11 * (1.3 - rival.data.attrs.discipline / 30))) {
        this.callFoul(rival, best, 'loose');
        return;
      }
      this.gainBall(best, b.flight?.kind === 'shot' || this.lastShot ? 'rebound' : 'loose', -1);
    }
    if (floorHit && b.vz === 0 && Math.hypot(b.vx, b.vy) < 0.2) {
      b.vx = 0;
      b.vy = 0;
    }
  }
  lastShot: { team: 0 | 1; shooter: number; t: number } | null = null;

  gainBall(p: MPlayer, how: 'pass' | 'tip' | 'steal' | 'rebound' | 'loose' | 'inbound', from: number): void {
    const b = this.ball;
    const prevTeam = this.possession;
    const strip = b as Ball & { stripBy?: number; stripOf?: number };
    if (how === 'rebound' && this.lastShot) {
      const off = p.team === this.lastShot.team;
      if (off) p.box.orb++;
      else p.box.drb++;
      this.emit({ type: 'rebound', team: p.team, player: p.idx, text: `Rebond ${off ? 'offensif' : 'défensif'} de ${this.name(p.idx)}` });
      p.anim = 'rebound';
      p.animT = 0;
      if (p.z === 0) p.vz = 1.8;
      this.lastShot = null;
      if (off) {
        this.shotClock = Math.max(this.shotClockExpiredInFlight ? 0 : this.rules.offRebReset, this.shotClockExpiredInFlight ? 0 : this.rules.offRebReset);
        if (this.shotClockExpiredInFlight) {
          this.shotClockExpiredInFlight = false;
          this.violation(p.team, 'Violation des 24 secondes', p);
          return;
        }
      }
    } else if ((how === 'loose' || how === 'rebound') && strip.stripBy !== undefined && strip.stripOf !== undefined) {
      if (p.team === this.players[strip.stripBy].team) {
        this.players[strip.stripBy].box.stl++;
        this.players[strip.stripOf!].box.tov++;
        this.emit({ type: 'steal', team: p.team, player: strip.stripBy, other: strip.stripOf, text: `${this.name(strip.stripBy)} subtilise le ballon !` });
      }
      strip.stripBy = undefined;
      strip.stripOf = undefined;
    }
    strip.stripBy = undefined;
    strip.stripOf = undefined;
    this.shotClockExpiredInFlight = false;
    b.state = 'held';
    b.holder = p.idx;
    b.flight = null;
    b.lastTouch = p.idx;
    b.lastTeam = p.team;
    p.pickupT = 0;
    (p as MPlayer & { pickedUp?: boolean }).pickedUp = false;
    p.lastTouchT = this.time;
    const ext = p as MPlayer & { passFrom?: number; caughtAt?: number };
    ext.passFrom = how === 'pass' && from >= 0 ? from : undefined;
    ext.caughtAt = this.time;
    if (how === 'pass') {
      p.anim = 'catch';
      p.animT = 0;
    }
    if (this.phase === 'inbound') {
      this.phase = 'live';
      this.clockRunning = true;
      this.shotClockOn = true;
    }
    if (this.phase === 'live' && !this.clockRunning && how !== 'tip') this.clockRunning = true;
    if (how === 'tip') {
      this.clockRunning = true;
      this.shotClockOn = true;
    }
    if (p.team !== prevTeam || how === 'steal' || how === 'tip') {
      this.changePossession(p.team, how === 'tip' ? 'tip' : how === 'steal' ? 'steal' : 'live');
    } else {
      this.shotClockOn = true;
    }
  }

  changePossession(team: 0 | 1, why: 'tip' | 'steal' | 'live' | 'inbound'): void {
    const changed = team !== this.possession || why === 'tip';
    this.possession = team;
    if (changed) {
      this.shotClock = this.rules.shotClock;
      this.backcourtT = 0;
      this.possessionStartT = this.time;
      this.startedPossessions++;
      const h = this.holder();
      this.frontcourtReached = !!h && this.court.inFrontcourt(this.attackSide(team), h.pos) && why !== 'inbound';
      if (why === 'inbound') this.frontcourtReached = false;
      this.offense[team] = setupOffense();
      // Contre-attaque possible sur interception ou rebond défensif (pas après une remise en jeu)
      this.offense[team].transition = why === 'steal' || why === 'live';
      this.offense[team].startT = this.time;
      setOffenseRoles(this, team);
      assignDefense(this, (1 - team) as 0 | 1);
      for (const p of this.players) if (p.onCourt) p.keyTime = 0;
    }
    this.shotClockOn = true;
  }

  shotMade(f: Flight): void {
    const shooter = this.players[f.from];
    const pts = f.kind === 'ft' ? 1 : f.points ?? 2;
    const b = this.ball;
    b.flight = null;
    b.state = 'dead';
    this.netSwish[f.side === 1 ? 1 : 0] = 0.9;
    const t = shooter.team;
    this.teams[t].score += pts;
    while (this.teams[t].scoreByQ.length < this.quarter) this.teams[t].scoreByQ.push(0);
    this.teams[t].scoreByQ[this.quarter - 1] += pts;
    this.teams[t].run += pts;
    this.teams[1 - t].run = 0;
    shooter.box.pts += pts;
    for (const p of this.players) {
      if (!p.onCourt) continue;
      p.box.pm += p.team === t ? pts : -pts;
    }
    if (f.kind === 'ft') {
      shooter.box.ftm++;
      this.emit({ type: 'ft', team: t, player: shooter.idx, points: 1, text: `${this.name(shooter.idx)} réussit son lancer franc` });
    } else {
      if (!f.fouled) shooter.box.fgm++;
      else shooter.box.fga++, shooter.box.fgm++;
      if (pts === 3) {
        shooter.box.tpm++;
        if (f.fouled) shooter.box.tpa++;
      }
      shooter.hotness = clamp(shooter.hotness + 0.25, -1, 1);
      let txt = `${this.name(shooter.idx)} marque ${pts === 3 ? 'à 3 points' : f.shotType === 'dunk' ? 'sur un dunk' : f.shotType === 'layup' ? 'en lay-up' : 'à 2 points'}`;
      if (f.assistFrom !== undefined && f.assistFrom !== shooter.idx) {
        this.players[f.assistFrom].box.ast++;
        txt += ` (passe de ${this.name(f.assistFrom)})`;
      }
      if (f.fouled) txt += ' + la faute !';
      this.emit({ type: 'made', team: t, player: shooter.idx, other: f.assistFrom, points: pts, text: txt, detail: f.shotType });
      shooter.anim = 'celebrate';
      shooter.animT = 0;
      // Les coéquipiers proches célèbrent aussi (poing levé, tape dans la main)
      for (const m of this.teamOnCourt(t)) {
        if (m !== shooter && dist(m.pos, shooter.pos) < 6 && (pts === 3 || f.shotType === 'dunk' || this.rng.chance(0.35))) {
          m.anim = 'celebrate';
          m.animT = 0.2;
        }
      }
      if (f.shotType === 'dunk' || pts === 3) this.replayMarks.push({ t: this.time, kind: f.shotType ?? 'shot' });
      if (f.shotType === 'dunk') {
        this.slowmo = 1.0;
        (shooter as MPlayer & { hangT?: number }).hangT = 0.4;
        shooter.z = Math.max(shooter.z, 0.75);
      }
    }
    this.lastScoreT = this.time;
    this.lastShot = null;
    // Le ballon tombe à travers le filet
    b.state = 'dead';
    const hoop = this.court.hoop(f.side ?? 1);
    Object.assign(b, { x: hoop.x, y: hoop.y, z: 2.5, vx: 0, vy: 0, vz: -2 });
    const buzzer = (f as Flight & { buzzer?: boolean }).buzzer;
    if (this.pendingShootingFoul && f.kind === 'shot') {
      const pf = this.pendingShootingFoul;
      this.pendingShootingFoul = null;
      this.callFoul(this.players[pf.fouler], shooter, 'shooting', 1, true);
      return;
    }
    if (f.kind === 'ft') {
      this.nextFreeThrow(true);
      return;
    }
    if (buzzer || this.clock <= 0) {
      this.endQuarter();
      return;
    }
    // Remise en jeu derrière la ligne de fond par l'équipe adverse
    const other = (1 - t) as 0 | 1;
    const stopClock = this.rules.stopClockAfterMadeLast2 && this.quarter >= 4 && this.clock < 120;
    if (stopClock) this.clockRunning = false;
    coachTimeoutCheck(this, other, true);
    this.schedule(0.9, () => this.setupInbound(other, 'baseline', !stopClock));
  }

  shotMissed(f: Flight): void {
    const shooter = this.players[f.from];
    const b = this.ball;
    if (f.kind === 'ft') {
      this.emit({ type: 'ft', team: shooter.team, player: shooter.idx, points: 0, text: `${this.name(shooter.idx)} manque son lancer franc` });
      if (this.ftQueue && (this.ftQueue.remaining > 0 || this.ftQueue.keep)) {
        b.state = 'dead';
        b.flight = null;
        this.nextFreeThrow(false);
        return;
      }
      this.ftQueue = null;
      this.phase = 'live';
      this.clockRunning = this.clock > 0;
    } else {
      shooter.hotness = clamp(shooter.hotness - 0.12, -1, 1);
      this.emit({ type: 'miss', team: shooter.team, player: shooter.idx, text: `${this.name(shooter.idx)} manque son tir${f.touchedRim ? '' : ' (air ball)'}` });
      if (this.pendingShootingFoul) {
        const pf = this.pendingShootingFoul;
        this.pendingShootingFoul = null;
        b.state = 'dead';
        b.flight = null;
        this.callFoul(this.players[pf.fouler], shooter, 'shooting', f.points ?? 2);
        return;
      }
    }
    const buzzer = (f as Flight & { buzzer?: boolean }).buzzer || this.clock <= 0;
    this.lastShot = { team: shooter.team, shooter: shooter.idx, t: this.time };
    b.flight = { ...f, kind: 'block' };
    b.flight.team = shooter.team;
    b.state = 'loose';
    if (!f.touchedRim && f.kind === 'shot') {
      // Air ball : le chrono des tirs n'est pas réinitialisé
      this.shotClockOn = true;
    } else if (f.touchedRim) {
      this.shotClock = this.rules.shotClock;
      this.shotClockOn = false;
    }
    if (buzzer) {
      this.endQuarter();
      return;
    }
    this.clockRunning = this.clock > 0;
  }

  // ---------------------------------------------------------------- Fautes & lancers
  callFoul(fouler: MPlayer, victim: MPlayer, kind: 'shooting' | 'reach' | 'blocking' | 'offensive' | 'loose' | 'intentional', fts = 0, andOne = false): void {
    if (this.phase !== 'live' && kind !== 'shooting') return;
    fouler.fouls++;
    fouler.box.pf++;
    const team = this.teams[fouler.team];
    if (kind !== 'offensive') team.quarterFouls++;
    const labels = { shooting: 'faute sur le tireur', reach: 'faute (main)', blocking: 'faute défensive', offensive: 'passage en force', loose: 'faute', intentional: 'faute volontaire' };
    this.emit({ type: 'foul', team: fouler.team, player: fouler.idx, other: victim.idx, text: `Coup de sifflet : ${labels[kind]} de ${this.name(fouler.idx)} (${fouler.fouls}e faute)` });
    this.clockRunning = false;
    this.shotClockOn = false;
    const b = this.ball;
    if (kind === 'offensive') {
      // Passage en force : le défenseur tombe à la renverse
      victim.anim = 'fall';
      victim.animT = 0;
      fouler.box.tov++;
      this.emit({ type: 'turnover', team: fouler.team, player: fouler.idx, text: `Balle perdue (passage en force) par ${this.name(fouler.idx)}` });
    }
    if (b.state !== 'dead' && kind !== 'shooting') {
      b.state = 'dead';
      b.flight = null;
      b.holder = -1;
    }
    if (kind === 'blocking' || kind === 'reach' || kind === 'loose') {
      victim.anim = 'stumble';
      victim.animT = 0;
    }
    this.phase = 'deadball';
    const fouledOut = fouler.fouls >= this.rules.foulOut;
    if (fouledOut) this.emit({ type: 'info', team: fouler.team, player: fouler.idx, text: `${this.name(fouler.idx)} est exclu (${this.rules.foulOut} fautes)` });
    this.schedule(1.2, () => {
      coachDeadBall(this, true);
      if (kind === 'offensive') {
        this.setupInbound(victim.team, 'sideline');
        return;
      }
      let n = fts;
      if (kind !== 'shooting') {
        const bonus = team.quarterFouls >= this.rules.bonusAtFoul;
        n = bonus || kind === 'intentional' ? 2 : 0;
      }
      if (andOne) n = 1;
      if (n > 0) this.startFreeThrows(victim, n);
      else this.setupInbound(victim.team, 'sideline');
    });
  }

  startFreeThrows(shooter: MPlayer, n: number, keep = false): void {
    if (!shooter.onCourt) {
      // remplaçant éventuel : on prend le meilleur tireur sur le terrain
      shooter = this.teamOnCourt(shooter.team).sort((a, b) => b.data.attrs.freeThrow - a.data.attrs.freeThrow)[0];
    }
    this.ftQueue = { shooter: shooter.idx, remaining: n, total: n, team: shooter.team, keep };
    this.phase = 'freethrow';
    this.possession = shooter.team;
    this.lineUpFreeThrow();
    this.schedule(1.3, () => this.shootFreeThrow());
  }

  lineUpFreeThrow(): void {
    const q = this.ftQueue!;
    const sh = this.players[q.shooter];
    const side = this.attackSide(sh.team);
    const g = this.court.g;
    const ftSpot = this.court.fromHoop(side, g.ftLineFromBaseline - g.hoopFromBaseline + 0.25, 0);
    sh.pos = { ...ftSpot };
    sh.target = { ...ftSpot };
    sh.vel = { x: 0, y: 0 };
    const lane = [
      [1.75, -2.75], [1.75, 2.75], [2.85, -2.75], [2.85, 2.75], [3.95, -2.75], [3.95, 2.75],
    ];
    const def = this.teamOnCourt((1 - sh.team) as 0 | 1);
    const off = this.teamOnCourt(sh.team).filter((p) => p !== sh);
    // Les défenseurs occupent les places les plus proches du panier
    const order = [...def.slice(0, 2), ...off.slice(0, 2), def[2], off[2]].filter(Boolean) as MPlayer[];
    order.forEach((p, i) => {
      const [u, v] = lane[i] ?? [7.5, i % 2 ? 4 : -4];
      const pos = this.court.fromHoop(side, u - g.hoopFromBaseline + 1.575 - 0.0, v);
      p.pos = { ...pos };
      p.target = { ...pos };
      p.vel = { x: 0, y: 0 };
    });
    const rest = [...def.slice(3), ...off.slice(3)];
    rest.forEach((p, i) => {
      const spots: [number, number][] = [[8.4, -3.2], [8.4, 3.2], [9.6, 0], [7.6, -5.5], [7.6, 5.5]];
      const [su, sv] = spots[i % spots.length];
      const pos = this.court.fromHoop(side, su, sv);
      p.pos = { ...pos };
      p.target = { ...pos };
      p.vel = { x: 0, y: 0 };
    });
    for (const p of this.onCourt) p.anim = 'idle';
    this.ball.state = 'held';
    this.ball.holder = sh.idx;
  }

  shootFreeThrow(): void {
    const q = this.ftQueue;
    if (!q) return;
    const sh = this.players[q.shooter];
    q.remaining--;
    const side = this.attackSide(sh.team);
    const hoop = this.court.hoop(side);
    const prob = shotProbability(sh.data, { type: 'ft', dist: 4.2, contest: 0, offDribble: false, energy: sh.energy, hotness: sh.hotness, clutch: this.clutch(), heightAdv: 0, confidence: sh.data.confidence });
    const sigma = sigmaFor(Math.min(0.98, prob * 0.86), 4.5); // correction mesurée (trajectoire de lancer plus haute)
    const dir = norm({ x: hoop.x - sh.pos.x, y: hoop.y - sh.pos.y });
    const e1 = this.rng.normal(0, sigma) + 0.03;
    const e2 = this.rng.normal(0, sigma * 0.5);
    const start = { x: sh.pos.x + dir.x * 0.2, y: sh.pos.y + dir.y * 0.2, z: sh.heightM * 1.15 };
    const end = { x: hoop.x + dir.x * e1 - dir.y * e2, y: hoop.y + dir.y * e1 + dir.x * e2, z: 3.05 };
    const v = launchVelocity(start, end, 4.35);
    sh.anim = 'shoot';
    sh.animT = 0.3;
    sh.box.fta++;
    const b = this.ball;
    Object.assign(b, { state: 'air', holder: -1, x: start.x, y: start.y, z: start.z, vx: v.vx, vy: v.vy, vz: v.vz, airT: 0 });
    b.flight = { kind: 'ft', from: sh.idx, to: -1, team: sh.team, t: 0, dur: v.T, start, end, shotType: 'ft', points: 1, side };
    if (q.remaining === 0 && !q.keep) {
      // Dernier lancer : les joueurs peuvent entrer dans la raquette au rebond
      this.phase = 'live';
    }
  }

  nextFreeThrow(made: boolean): void {
    const q = this.ftQueue;
    if (q && q.remaining > 0) {
      this.phase = 'freethrow';
      this.lineUpFreeThrow();
      this.schedule(1.3, () => this.shootFreeThrow());
      return;
    }
    this.ftQueue = null;
    if (q?.keep) {
      // Lancer technique : l'équipe garde la possession (remise en jeu)
      this.phase = 'deadball';
      this.schedule(0.8, () => this.setupInbound(q.team, 'sideline'));
      return;
    }
    if (made) {
      const shooterTeam = q ? q.team : this.possession;
      if (this.clock <= 0) {
        this.endQuarter();
        return;
      }
      this.schedule(0.8, () => this.setupInbound((1 - shooterTeam) as 0 | 1, 'baseline', false));
    }
  }

  // ---------------------------------------------------------------- Violations et sorties
  checkViolations(dt: number): void {
    const off = this.possession;
    const h = this.holder();
    const side = this.attackSide(off);
    // 24 secondes
    if (this.shotClockOn && this.shotClock <= 0 && !(this.ball.state === 'air' && this.ball.flight?.kind === 'shot')) {
      this.shotClock = 0;
      if (this.ball.state === 'held' || this.ball.state === 'loose') {
        this.violation(off, 'Violation des 24 secondes', h);
        return;
      }
    }
    if (h && h.team === off) {
      const inFront = this.court.inFrontcourt(side, h.pos);
      if (!this.frontcourtReached) {
        this.backcourtT += dt;
        if (inFront) this.frontcourtReached = true;
        else if (this.backcourtT > this.rules.backcourtSec) {
          this.violation(off, `Violation des ${this.rules.backcourtSec} secondes`, h);
          return;
        }
      } else if (!inFront && this.ball.lastTeam === off && Math.abs(h.pos.x - this.court.g.length / 2) > 0.3) {
        this.violation(off, 'Retour en zone', h);
        return;
      }
      // Sortie du porteur
      if (!this.court.inBounds(h.pos) && this.phase === 'live') {
        this.violation(off, 'Sortie de terrain', h);
        return;
      }
      // Ballon arrêté : un déplacement sans dribble est un marcher
      const pick = h as MPlayer & { pickedUp?: boolean; pickPos?: V2; doubleDribble?: boolean };
      if (pick.pickedUp && pick.pickPos && dist(h.pos, pick.pickPos) > 1.15) {
        this.violation(off, 'Marcher', h);
        return;
      }
      if (pick.doubleDribble) {
        pick.doubleDribble = false;
        this.violation(off, 'Reprise de dribble', h);
        return;
      }
      // Marcher : erreur de pied de pivot sous pression (joueurs IA peu techniques)
      if (h.intent === 'drive' && h.pickupT > 0.4 && !h.isUser) {
        const fw = (h.data.attrs.footwork + h.data.attrs.ballControl) / 40;
        if (this.rng.chance((1 - fw) * 0.0012)) {
          this.violation(off, 'Marcher', h);
          return;
        }
      }
    }
    // 3 secondes dans la raquette
    if (this.ball.state === 'held' && h && h.team === off) {
      for (const p of this.teamOnCourt(off)) {
        if (this.court.inKey(side, p.pos)) p.keyTime += dt;
        else p.keyTime = 0;
        // Le porteur est aussi concerné (tolérance s'il est en train de tirer ou de dribbler pour aller au cercle)
        const shooting = p === h && (!!(p as MPlayer & { shotPlan?: unknown }).shotPlan || p.intent === 'drive');
        if (p.keyTime > this.rules.threeSec + (shooting ? 1 : 0)) {
          this.violation(off, 'Trois secondes dans la raquette', p);
          return;
        }
      }
      // Joueur serré de près qui tient le ballon sans dribbler : 5 secondes (FIBA)
      const hx = h as MPlayer & { pickedUp?: boolean; guardedT?: number; backT?: number };
      const tight = this.teamOnCourt((1 - off) as 0 | 1).some((o) => dist(o.pos, h.pos) < 1.2);
      hx.guardedT = tight && hx.pickedUp ? (hx.guardedT ?? 0) + dt : 0;
      if (hx.guardedT > 5) {
        hx.guardedT = 0;
        this.violation(off, 'Cinq secondes (joueur serré de près)', h);
        return;
      }
      // NBA : dribble dos au panier sous la ligne des lancers francs, 5 secondes maximum
      if (this.rules.id === 'NBA') {
        const hoopA = this.court.hoop(side);
        const backTurned = Math.cos(h.facing - Math.atan2(hoopA.y - h.pos.y, hoopA.x - h.pos.x)) < -0.3;
        const low = this.court.toHoop(side, h.pos).u < this.court.g.ftLineFromBaseline - this.court.g.hoopFromBaseline;
        hx.backT = backTurned && low && !hx.pickedUp ? (hx.backT ?? 0) + dt : 0;
        if (hx.backT > 5) {
          hx.backT = 0;
          this.violation(off, 'Cinq secondes dos au panier', h);
          return;
        }
      }
    } else {
      for (const p of this.onCourt) p.keyTime = 0;
    }
    // NBA : trois secondes défensives (faute technique, un lancer franc et possession conservée)
    if (this.rules.id === 'NBA' && h && h.team === off) {
      const def = (1 - off) as 0 | 1;
      for (const d of this.teamOnCourt(def)) {
        const ext = d as MPlayer & { defKey?: number };
        const guarding = this.teamOnCourt(off).some((o) => dist(o.pos, d.pos) < 1.3);
        ext.defKey = this.court.inKey(side, d.pos) && !guarding ? (ext.defKey ?? 0) + dt : 0;
        if ((ext.defKey ?? 0) > this.rules.threeSec) {
          ext.defKey = 0;
          this.emit({ type: 'violation', team: def, player: d.idx, text: `Trois secondes défensives (${this.name(d.idx)}) : faute technique` });
          this.clockRunning = false;
          this.shotClockOn = false;
          this.ball.state = 'dead';
          this.ball.holder = -1;
          this.phase = 'deadball';
          const shooter = this.teamOnCourt(off).sort((a, b) => b.data.attrs.freeThrow - a.data.attrs.freeThrow)[0];
          this.schedule(1.1, () => this.startFreeThrows(shooter, 1, true));
          return;
        }
      }
    }
  }

  violation(team: 0 | 1, label: string, p: MPlayer | null): void {
    if (p) p.box.tov++;
    this.emit({ type: 'violation', team, player: p ? p.idx : -1, text: `${label}${p ? ` (${this.name(p.idx)})` : ''}` });
    this.emit({ type: 'turnover', team, player: p ? p.idx : -1, text: '' });
    this.events.pop();
    this.deadBallTo((1 - team) as 0 | 1, 'sideline');
  }

  outOfBounds(): void {
    const last = this.ball.lastTeam;
    const lp = this.ball.lastTouch;
    const keep = this.lastShot && this.ball.lastTouch === this.lastShot.shooter ? false : false;
    void keep;
    if (lp >= 0 && this.lastShot === null && last === this.possession) this.players[lp].box.tov++;
    this.emit({ type: 'violation', team: last, player: lp, text: `Ballon sorti${lp >= 0 ? ` (dernière touche : ${this.name(lp)})` : ''}` });
    this.lastShot = null;
    this.deadBallTo((1 - last) as 0 | 1, 'sideline');
  }

  deadBallTo(team: 0 | 1, where: 'sideline' | 'baseline'): void {
    this.phase = 'deadball';
    this.clockRunning = false;
    this.shotClockOn = false;
    const b = this.ball;
    b.state = 'dead';
    b.flight = null;
    b.holder = -1;
    this.schedule(1.1, () => {
      coachDeadBall(this, true);
      this.setupInbound(team, where);
    });
  }

  setupInbound(team: 0 | 1, where: 'baseline' | 'sideline' | 'midcourt', clockRuns = false): void {
    this.phase = 'inbound';
    this.clockRunning = clockRuns && this.clock > 0;
    this.shotClockOn = false;
    const side = this.attackSide(team);
    const g = this.court.g;
    const b = this.ball;
    const players = this.teamOnCourt(team);
    let spot: V2;
    if (where === 'baseline') {
      // Derrière la ligne de fond du panier défendu par l'équipe qui remet en jeu
      const base = this.court.baselineX((-side) as 1 | -1);
      spot = { x: base + side * -0.6, y: this.court.cy + 1.4 };
    } else if (where === 'midcourt') {
      spot = { x: g.length / 2, y: g.width + 0.6 };
    } else {
      const bx = clamp(b.x, 2, g.length - 2);
      spot = { x: bx, y: b.y < g.width / 2 ? -0.6 : g.width + 0.6 };
    }
    // Inbounder : intérieur après panier, sinon le moins créateur
    const sorted = [...players].sort((a, c) => (where === 'baseline' ? c.heightM - a.heightM : a.data.attrs.passing - c.data.attrs.passing));
    const inb = where === 'baseline' ? sorted[0] : sorted.find((p) => !p.isUser) ?? sorted[0];
    inb.pos = { ...spot };
    inb.target = { ...spot };
    inb.vel = { x: 0, y: 0 };
    inb.role = 'inbounder';
    b.state = 'held';
    b.holder = inb.idx;
    b.flight = null;
    b.x = spot.x;
    b.y = spot.y;
    b.z = 1.2;
    const prev = this.possession;
    this.possession = team;
    if (prev !== team || where !== 'sideline') {
      this.offense[team] = setupOffense();
    }
    this.shotClock = prev !== team || this.shotClock < this.rules.offRebReset || where === 'baseline' ? (prev === team && where === 'sideline' ? Math.max(this.shotClock, this.rules.offRebReset) : this.rules.shotClock) : this.shotClock;
    if (where === 'midcourt') this.shotClock = this.rules.shotClock;
    this.backcourtT = 0;
    this.frontcourtReached = this.court.inFrontcourt(side, spot);
    this.possessionStartT = this.time;
    setOffenseRoles(this, team);
    assignDefense(this, (1 - team) as 0 | 1);
    // Receveur : le meneur s'approche
    const recv = players.filter((p) => p !== inb).sort((a, c) => c.data.attrs.ballControl - a.data.attrs.ballControl)[0];
    for (const p of players) {
      if (p === inb) continue;
      const base = p === recv ? { x: spot.x + (where === 'baseline' ? side * 3.5 : 0), y: where === 'baseline' ? spot.y + 1.5 : spot.y < 1 ? 3 : g.width - 3 } : p.spot ?? p.pos;
      p.target = this.court.clampInside(base);
      p.urgency = 0.7;
    }
    for (const p of this.onCourt) p.keyTime = 0;
    const delay = 0.9 + this.rng.next() * 0.8;
    this.schedule(delay, () => {
      if (this.ball.holder !== inb.idx) return;
      const r = this.players[recv.idx];
      if (!r.onCourt) return;
      this.launchPass(inb, r, 'inbound');
      // Le chrono démarre au toucher : géré dans gainBall
      inb.role = 'spot';
    });
  }

  // ---------------------------------------------------------------- Quarts-temps
  endQuarter(): void {
    this.clockRunning = false;
    this.shotClockOn = false;
    const b = this.ball;
    b.state = 'dead';
    b.flight = null;
    b.holder = -1;
    this.pendingShootingFoul = null;
    this.lastShot = null;
    const tied = this.teams[0].score === this.teams[1].score;
    const last = this.quarter >= 4 && !tied;
    this.emit({ type: 'quarter', team: -1, player: -1, text: last ? 'Fin du match' : `Fin du ${this.quarter <= 4 ? this.quarter + 'e quart-temps' : 'prolongation'}` });
    if (last) {
      this.phase = 'final';
      this.finished = true;
      this.emit({ type: 'final', team: this.teams[0].score > this.teams[1].score ? 0 : 1, player: -1, text: `Score final ${this.teams[0].score} - ${this.teams[1].score}` });
      return;
    }
    this.phase = 'quarterEnd';
    this.schedule(2.0, () => this.startQuarter());
  }

  startQuarter(): void {
    this.quarter++;
    const ot = this.quarter > 4;
    this.clock = (ot ? this.rules.otMin : this.rules.quarterMin) * 60;
    for (const t of this.teams) {
      t.quarterFouls = 0;
      if (t.scoreByQ.length < this.quarter) t.scoreByQ.push(0);
      if (this.quarter === 3) t.timeouts = Math.max(t.timeouts, this.rules.id === 'FIBA' ? 3 : t.timeouts);
    }
    this.emit({ type: 'quarter', team: -1, player: -1, text: ot ? `Prolongation n°${this.quarter - 4}` : `Début du ${this.quarter}e quart-temps` });
    // Récupération entre les périodes
    for (const p of this.players) p.energy = Math.min(1, p.energy + (this.quarter === 3 ? 0.18 : 0.07));
    coachDeadBall(this, true, 5);
    if (this.quarter > 1) for (const t of [0, 1] as const) coachAdjust(this, t);
    if (ot && !this.rules.alternatingPossession) {
      this.setupJumpBall();
      return;
    }
    let team: 0 | 1;
    if (this.rules.alternatingPossession) {
      team = this.arrow;
      this.arrow = (1 - this.arrow) as 0 | 1;
    } else {
      team = this.quarter === 4 ? this.jumpWinner : ((1 - this.jumpWinner) as 0 | 1);
    }
    for (const p of this.onCourt) {
      p.pos = this.court.clampInside({ x: this.court.g.length / 2 + (p.team === team ? 1 : -1) * this.attackSide(team) * (2 + p.slot), y: 2 + p.slot * 2.6 });
      p.vel = { x: 0, y: 0 };
    }
    this.setupInbound(team, 'midcourt');
  }

  // ---------------------------------------------------------------- Remplacements
  substitute(outIdx: number, inIdx: number): void {
    const o = this.players[outIdx];
    const i = this.players[inIdx];
    if (!o.onCourt || i.onCourt) return;
    if (i.fouls >= this.rules.foulOut) return;
    i.onCourt = true;
    i.slot = o.slot;
    o.onCourt = false;
    o.slot = -1;
    i.pos = { ...o.pos };
    i.target = { ...o.target };
    i.vel = { x: 0, y: 0 };
    i.anim = 'idle';
    i.role = o.role;
    i.spot = o.spot;
    i.assign = o.assign;
    for (const p of this.players) if (p.assign === outIdx) p.assign = inIdx;
    if (this.ball.holder === outIdx) this.ball.holder = inIdx;
    if (this.ftQueue && this.ftQueue.shooter === outIdx) this.ftQueue.shooter = inIdx;
    this.emit({ type: 'sub', team: o.team, player: inIdx, other: outIdx, text: `Changement : ${this.name(inIdx)} remplace ${this.name(outIdx)}` });
    if ((o.isUser && this.userStyle.sub === 'out') || (i.isUser && this.userStyle.sub === 'in')) this.userStyle = { ...this.userStyle, sub: 'none' };
    this.benchPositions();
  }

  callTimeout(team: 0 | 1, reason = ''): boolean {
    const t = this.teams[team];
    if (t.timeouts <= 0) return false;
    t.timeouts--;
    t.run = 0;
    this.teams[1 - team].run = 0;
    for (const p of this.players) if (p.onCourt) p.energy = Math.min(1, p.energy + 0.05);
    for (const p of this.teamOnCourt((1 - team) as 0 | 1)) p.hotness *= 0.5;
    this.emit({ type: 'timeout', team, player: -1, text: `Temps mort ${t.name}${reason ? ` — ${reason}` : ''}` });
    coachAdjust(this, team);
    return true;
  }

  // ---------------------------------------------------------------- Utilitaires de haut niveau
  /** Simule sans rendu jusqu'à la condition (ou fin du match). Renvoie le nombre de ticks. */
  runUntil(cond: (e: MatchEngine) => boolean, maxTicks = 60 * 60 * 120): number {
    let n = 0;
    while (!this.finished && !cond(this) && n < maxTicks) {
      this.step();
      n++;
    }
    return n;
  }

  runToEnd(): void {
    this.runUntil(() => false);
  }
}

/** Attribue les rôles offensifs de base au début d'une possession. */
export function setOffenseRoles(e: MatchEngine, team: 0 | 1): void {
  const st = e.offense[team];
  st.spots = computeSpots(e, team);
  for (const p of e.teamOnCourt(team)) {
    p.role = e.ball.holder === p.idx ? 'handler' : 'spot';
    p.spot = st.spots[p.idx] ?? null;
  }
}

/** Placement « 4 dehors / 1 dedans » ou « 5 dehors » selon les profils. */
export function computeSpots(e: MatchEngine, team: 0 | 1): Record<number, V2> {
  const side = e.attackSide(team);
  const ps = e.teamOnCourt(team);
  const tac = e.teams[team].tactics;
  const R = e.court.g.threeRadius;
  const W = e.court.g.width / 2 - e.court.g.cornerThreeFromSideline;
  const spotsUV: Record<string, [number, number]> = {
    top: [R + 0.6, 0],
    wingL: [R * 0.62 + 0.5, -(R * 0.78 + 0.4)],
    wingR: [R * 0.62 + 0.5, R * 0.78 + 0.4],
    cornerL: [0.2, -(W + 0.35)],
    cornerR: [0.2, W + 0.35],
    dunkerL: [0.3, -2.9],
    dunkerR: [0.3, 2.9],
    elbow: [4.5, -2.2],
  };
  const order = [...ps].sort((a, b) => ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(a.data.pos) - ['PG', 'SG', 'SF', 'PF', 'C'].indexOf(b.data.pos));
  const res: Record<number, V2> = {};
  const insideCount = order.filter((p) => p.data.attrs.three < 9 + tac.threeRate * 4 && (p.data.pos === 'C' || p.data.pos === 'PF')).length;
  const plan: string[] = insideCount >= 2 ? ['top', 'wingR', 'cornerL', 'dunkerR', 'elbow'] : insideCount === 1 ? ['top', 'wingL', 'wingR', 'cornerL', 'dunkerR'] : ['top', 'wingL', 'wingR', 'cornerL', 'cornerR'];
  // Les meilleurs shooteurs dans les coins / ailes, l'intérieur au poste
  const outside = order.filter((p) => !(p.data.attrs.three < 9 + tac.threeRate * 4 && (p.data.pos === 'C' || p.data.pos === 'PF')));
  const inside = order.filter((p) => !outside.includes(p));
  const seq = [...outside, ...inside];
  seq.forEach((p, i) => {
    const key = plan[i] ?? 'top';
    const [u, v] = spotsUV[key];
    res[p.idx] = e.court.fromHoop(side, u, v);
  });
  return res;
}
