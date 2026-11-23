// Contrôleur : relie simulation (pas fixe), rendu (interpolé) et interface (rafraîchie ~5×/s).
import { Sim, dayOf } from './sim/sim';
import type { GameState } from './sim/state';
import { Scene, type SceneCallbacks } from './render/scene';
import { saveSlot } from './save/save';

export const MIN_PER_SEC = 4; // minutes de jeu par seconde réelle à ×1
export type Speed = 0 | 1 | 2 | 4;

export class Game {
  sim: Sim;
  scene: Scene | null = null;
  speed: Speed = 1;
  private acc = 0;
  private listeners = new Set<() => void>();
  private uiAcc = 0;
  version = 0; // incrémenté à chaque notification de l'interface
  private lastDay: number;
  frameTimes: number[] = [];
  cpuTimes: number[] = []; // coût JS (simulation + préparation du rendu) par image

  constructor(state: GameState) {
    this.sim = new Sim(state);
    this.lastDay = dayOf(state.minute);
  }

  async mount(host: HTMLElement, cb: SceneCallbacks, quality: 'haute' | 'basse') {
    this.scene = new Scene(host, this.sim, cb, { quality });
    await this.scene.init();
    this.scene.app.ticker.add((t) => this.frame(t.deltaMS));
  }

  private frame(dt: number) {
    const t0 = performance.now();
    dt = Math.min(dt, 250); // onglet en arrière-plan : pas de rattrapage massif
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 120) this.frameTimes.shift();
    if (this.speed > 0) {
      this.acc += (dt / 1000) * MIN_PER_SEC * this.speed;
      let n = Math.floor(this.acc);
      if (n > 40) {
        n = 40;
        this.acc = 40;
      }
      for (let i = 0; i < n; i++) this.sim.tick();
      this.acc -= n;
      const d = dayOf(this.sim.s.minute);
      if (d !== this.lastDay) {
        this.lastDay = d;
        saveSlot('auto', this.sim.s).catch(() => undefined);
      }
    }
    this.scene?.update(dt, this.speed > 0 ? this.acc : 1);
    this.cpuTimes.push(performance.now() - t0);
    if (this.cpuTimes.length > 120) this.cpuTimes.shift();
    this.uiAcc += dt;
    if (this.uiAcc > 200) {
      this.uiAcc = 0;
      this.notify();
    }
  }

  setSpeed(s: Speed) {
    this.speed = s;
    this.notify();
  }

  notify() {
    this.version++;
    for (const l of this.listeners) l();
  }

  subscribe(l: () => void) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  /** FPS mesuré sur les 120 dernières images (moyenne). */
  measuredFps() {
    if (!this.frameTimes.length) return 0;
    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
    return Math.round(1000 / avg);
  }

  /** Coût JS moyen par image (ms), hors rendu GPU. */
  cpuMs() {
    return this.cpuTimes.length ? this.cpuTimes.reduce((a, b) => a + b, 0) / this.cpuTimes.length : 0;
  }

  destroy() {
    this.scene?.destroy();
    this.listeners.clear();
  }
}
