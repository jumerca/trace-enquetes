// Contrôleur de partie : boucle temporelle, vitesses, pause automatique, sauvegarde
// automatique, et lien entre la simulation, le rendu et l'interface React.
import { Engine } from './render/engine';
import { StationView, type BuildMode } from './render/station-view';
import { CityView } from './render/city-view';
import { saveSlot } from './save/save';
import { MIN_D, MIN_H } from './sim/calendar';
import { advanceToNext, step } from './sim/sim';
import type { GameState } from './sim/types';

export type Screen = 'station' | 'city';
export type Panel = { id: string; arg?: string; tab?: string } | null;

export const SPEEDS = [0, 1, 2, 5, 10] as const;

export class Game {
  st: GameState;
  version = 0;
  speed = 0;
  screen: Screen = 'station';
  panel: Panel = null;
  history: Panel[] = [];
  engine: Engine | null = null;
  station: StationView | null = null;
  city: CityView | null = null;
  buildMode: BuildMode = null;
  toast: { text: string; at: number } | null = null;
  private listeners = new Set<() => void>();
  private timer: number | null = null;
  private acc = 0;
  private last = performance.now();
  private lastBump = 0;
  private lastSave = performance.now();
  private noticeSeen = 0;
  onBuildRect?: (floor: number, x: number, y: number, w: number, h: number) => void;
  onPlaceFurniture?: (roomId: string, x: number, y: number) => void;
  onMoveTo?: (floor: number, x: number, y: number) => void;

  constructor(st: GameState) {
    this.st = st;
    this.noticeSeen = st.counters.notice;
  }

  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  getVersion = () => this.version;
  bump(force = false) {
    const now = performance.now();
    if (!force && now - this.lastBump < 200) return;
    this.lastBump = now;
    this.version++;
    for (const l of this.listeners) l();
  }

  async mount(host: HTMLElement) {
    const e = new Engine();
    e.getState = () => this.st;
    await e.init(host);
    this.engine = e;
    this.station = new StationView(() => this.st, {
      onStaff: (id) => this.open({ id: 'staff', arg: id }),
      onRoom: (id) => this.open({ id: 'room', arg: id }),
      onBuildRect: (f, x, y, w, h) => this.onBuildRect?.(f, x, y, w, h),
      onPlaceFurniture: (r, x, y) => this.onPlaceFurniture?.(r, x, y),
      onMoveTo: (f, x, y) => this.onMoveTo?.(f, x, y),
    });
    this.setScreen('station');
    this.timer = window.setInterval(() => this.loop(), 100);
  }

  unmount() {
    if (this.timer) clearInterval(this.timer);
    this.engine?.destroy();
    this.engine = null;
  }

  setScreen(s: Screen) {
    if (!this.engine) return;
    this.screen = s;
    if (s === 'station') {
      if (!this.station) return;
      // la vue est recréée à chaque affichage (libère la mémoire de l'autre vue)
      const old = this.station;
      this.station = new StationView(() => this.st, {
        onStaff: (id) => this.open({ id: 'staff', arg: id }),
        onRoom: (id) => this.open({ id: 'room', arg: id }),
        onBuildRect: (f, x, y, w, h) => this.onBuildRect?.(f, x, y, w, h),
        onPlaceFurniture: (r, x, y) => this.onPlaceFurniture?.(r, x, y),
        onMoveTo: (f, x, y) => this.onMoveTo?.(f, x, y),
      });
      this.station.setFloor(old.floor);
      this.station.mode = this.buildMode;
      this.engine.setView(this.station);
      this.city = null;
    } else {
      this.city = new CityView(() => this.st, {
        onCase: (id) => this.open({ id: 'case', arg: id }),
        onPlace: (id) => this.open({ id: 'place', arg: id }),
      });
      this.engine.setView(this.city);
    }
    this.bump(true);
  }

  setFloor(f: number) {
    this.station?.setFloor(f);
    this.bump(true);
  }

  setBuildMode(m: BuildMode) {
    this.buildMode = m;
    if (this.station) this.station.mode = m;
    if (m && this.screen !== 'station') this.setScreen('station');
    this.bump(true);
  }

  open(p: Panel) {
    if (this.panel && p && (this.panel.id !== p.id || this.panel.arg !== p.arg)) this.history.push(this.panel);
    this.panel = p;
    this.bump(true);
  }
  back() {
    this.panel = this.history.pop() ?? null;
    this.bump(true);
  }
  close() {
    this.panel = null;
    this.history = [];
    this.bump(true);
  }

  setSpeed(s: number) {
    this.speed = s;
    this.st.settings.speed = s;
    this.last = performance.now();
    this.acc = 0;
    this.bump(true);
  }

  say(text: string) {
    this.toast = { text, at: performance.now() };
    this.bump(true);
  }

  private loop() {
    const now = performance.now();
    const dt = Math.min(500, now - this.last);
    this.last = now;
    if (this.station) this.station.speed = this.speed;
    if (this.city) this.city.speed = this.speed;
    if (this.speed > 0) {
      // ×1 = 10 minutes de jeu par seconde ; ×10 = 100 minutes par seconde
      this.acc += (dt / 1000) * this.speed * 10;
      let n = 0;
      while (this.acc >= 10 && n < 30) {
        step(this.st, 10);
        this.acc -= 10;
        n++;
        if (this.checkAutoPause()) break;
      }
      this.bump();
    }
    if (this.toast && now - this.toast.at > 4500) { this.toast = null; this.bump(true); }
    if (now - this.lastSave > 90000) { this.lastSave = now; this.autosave(); }
  }

  /** Pause automatique sur un événement urgent (selon les préférences). */
  private checkAutoPause(): boolean {
    const fresh = this.st.notices.filter((n) => Number(n.id.slice(1)) > this.noticeSeen);
    this.noticeSeen = this.st.counters.notice;
    if (this.st.settings.autoPause && fresh.some((n) => n.level === 'urgent')) {
      this.setSpeed(0);
      const n = fresh.find((x) => x.level === 'urgent')!;
      this.say(`❚❚ Pause automatique : ${n.text}`);
      return true;
    }
    return false;
  }

  advanceHour() { step(this.st, MIN_H); this.checkAutoPause(); this.bump(true); }
  advanceDay() {
    const toMidnight = MIN_D - (this.st.minute % MIN_D);
    step(this.st, toMidnight + 8 * MIN_H);
    this.checkAutoPause();
    this.bump(true);
  }
  advanceNext() { const m = advanceToNext(this.st, 72); this.checkAutoPause(); this.say(`Avance de ${Math.round(m / 60)} h jusqu'au prochain événement.`); this.bump(true); }

  async autosave() {
    try { await saveSlot('auto', this.st); } catch { /* stockage indisponible : sans conséquence */ }
  }

  /** Remplace la partie en cours (mutation dans une autre ville) et reconstruit les vues. */
  replaceState(ns: GameState) {
    this.st = ns;
    this.noticeSeen = ns.counters.notice - 1;
    this.panel = null;
    this.history = [];
    this.setSpeed(0);
    if (this.station) this.station.setFloor(0);
    this.setScreen(this.screen);
    this.autosave();
  }

  mutate(fn: (st: GameState) => void) {
    fn(this.st);
    this.bump(true);
  }
}
