// Moteur de rendu : application Pixi, caméra (déplacement, zoom, pincement), calques
// d'ambiance (nuit, lumières, météo). Le rendu lit l'état de la simulation sans la modifier.
import { Application, Container, Graphics } from 'pixi.js';
import type { GameState } from '../sim/types';

export interface View {
  root: Container;
  lights: Container;
  bounds(): { x: number; y: number; w: number; h: number };
  update(dtMs: number, time: number): void;
  tap(wx: number, wy: number): void;
  hover?(wx: number, wy: number): void;
  drag?(phase: 'start' | 'move' | 'end', wx: number, wy: number): boolean;
  night(): number; // 0 jour … 1 nuit noire
  viewport?(x: number, y: number, w: number, h: number): void; // zone visible (coordonnées monde)
  outdoor(): number; // part de la scène en extérieur (météo)
  destroy(): void;
}

export class Engine {
  app = new Application();
  cam = { x: 0, y: 0, z: 1 };
  view: View | null = null;
  private world = new Container();
  private lightLayer = new Container();
  private nightG = new Graphics();
  private weatherG = new Graphics();
  private drops: { x: number; y: number; v: number; l: number }[] = [];
  private pointers = new Map<number, { x: number; y: number; sx: number; sy: number; t: number }>();
  private pinch: { d: number; mx: number; my: number } | null = null;
  private moved = false;
  private dragging = false;
  private time = 0;
  ready = false;
  private host: HTMLElement | null = null;
  getState: () => GameState | null = () => null;
  fps = 60;
  /** Adaptation automatique : résolution abaissée puis figurants réduits si l'appareil saccade. */
  quality: 'haute' | 'reduite' | 'minimale' = 'haute';
  private slowSince = 0;
  private started = 0;

  async init(host: HTMLElement) {
    const eco = economyMode();
    await this.app.init({
      resizeTo: host, background: '#2b2a28', antialias: !eco, autoDensity: true,
      resolution: eco ? 1 : Math.min(window.devicePixelRatio || 1, 2), powerPreference: 'high-performance', preference: 'webgl',
    });
    this.host = host;
    host.appendChild(this.app.canvas);
    this.app.canvas.style.touchAction = 'none';
    this.app.canvas.setAttribute('aria-label', 'Vue de jeu');
    this.nightG.blendMode = 'multiply';
    this.lightLayer.blendMode = 'add';
    this.app.stage.addChild(this.world, this.nightG, this.lightLayer, this.weatherG);
    this.app.ticker.add((t) => this.frame(t.deltaMS));
    this.bindInput();
    this.ready = true;
  }

  setView(v: View, cam?: { x: number; y: number; z: number }) {
    if (this.view) {
      this.world.removeChild(this.view.root);
      this.lightLayer.removeChild(this.view.lights);
      this.view.destroy();
    }
    this.view = v;
    this.world.addChild(v.root);
    this.lightLayer.addChild(v.lights);
    if (cam) this.cam = { ...cam };
    else {
      const b = v.bounds();
      const sw = this.host?.clientWidth || this.app.screen.width, sh = this.host?.clientHeight || this.app.screen.height;
      const fit = Math.min(sw / b.w, sh / b.h) * 1.05;
      // sur petit écran, on cadre plus serré (zoom lisible) plutôt que tout le plan
      this.cam = { x: b.x + b.w / 2, y: b.y + b.h / 2, z: Math.min(1.4, Math.max(sw < 700 ? 0.62 : 0.35, fit)) };
    }
    this.clamp();
  }

  private frame(dt: number) {
    this.time += dt;
    this.fps = this.fps * 0.95 + (1000 / Math.max(1, dt)) * 0.05;
    if (!this.started) this.started = this.time;
    this.adapt();
    const { width, height } = this.app.screen;
    for (const c of [this.world, this.lightLayer]) {
      c.scale.set(this.cam.z);
      c.position.set(width / 2 - this.cam.x * this.cam.z, height / 2 - this.cam.y * this.cam.z);
    }
    if (!this.view) return;
    this.view.viewport?.(this.cam.x - width / 2 / this.cam.z, this.cam.y - height / 2 / this.cam.z, width / this.cam.z, height / this.cam.z);
    this.view.update(Math.min(dt, 100), this.time);
    // nuit : assombrissement multiplicatif, les lumières passent par-dessus (addition)
    const n = this.view.night();
    this.nightG.clear();
    if (n > 0.01) this.nightG.rect(0, 0, width, height).fill({ color: mixNight(n), alpha: 1 });
    this.lightLayer.alpha = Math.min(1, n * 1.4);
    this.lightLayer.visible = n > 0.02;
    this.drawWeather(dt, width, height);
  }

  private drawWeather(dt: number, w: number, h: number) {
    const st = this.getState();
    const g = this.weatherG;
    g.clear();
    if (!st || !this.view) return;
    const out = this.view.outdoor();
    const k = st.weather.kind;
    if (k === 'brouillard') { g.rect(0, 0, w, h).fill({ color: 0xd8dde0, alpha: 0.28 * out }); return; }
    if (k !== 'pluie' && k !== 'orage' && k !== 'neige') { this.drops.length = 0; return; }
    const snow = k === 'neige';
    const target = Math.round((k === 'orage' ? 260 : snow ? 160 : 170) * out * Math.min(2, (w * h) / 900000));
    while (this.drops.length < target) this.drops.push({ x: Math.random() * w, y: Math.random() * h, v: snow ? 30 + Math.random() * 40 : 500 + Math.random() * 300, l: snow ? 2 + Math.random() * 2 : 8 + Math.random() * 10 });
    this.drops.length = Math.min(this.drops.length, target);
    const s = dt / 1000;
    for (const d of this.drops) {
      d.y += d.v * s;
      d.x += (snow ? Math.sin((this.time / 700) + d.l) * 12 : -d.v * 0.18) * s;
      if (d.y > h) { d.y = -10; d.x = Math.random() * (w + 60); }
      if (snow) g.circle(d.x, d.y, d.l * 0.6);
      else g.moveTo(d.x, d.y).lineTo(d.x - d.l * 0.18, d.y + d.l);
    }
    if (snow) g.fill({ color: 0xffffff, alpha: 0.85 });
    else g.stroke({ width: 1, color: 0xbcd0e6, alpha: 0.55 });
    if (k === 'orage' && Math.random() < 0.003 * (dt / 16)) g.rect(0, 0, w, h).fill({ color: 0xffffff, alpha: 0.35 });
    if (!snow) g.rect(0, 0, w, h).fill({ color: 0x5a6a7a, alpha: 0.12 * out });
  }

  private adapt() {
    if (this.time - this.started < 6000 || this.quality === 'minimale' || document.hidden) return;
    if (this.fps < 24) {
      if (!this.slowSince) this.slowSince = this.time;
      if (this.time - this.slowSince > 6000) {
        this.slowSince = 0;
        if (this.quality === 'haute' && this.app.renderer.resolution > 1) {
          this.quality = 'reduite';
          this.app.renderer.resize(this.app.screen.width, this.app.screen.height, 1);
        } else {
          this.quality = 'minimale';
          runtimeLowPower = true;
        }
      }
    } else this.slowSince = 0;
  }

  // ————— Caméra —————
  screenToWorld(sx: number, sy: number) {
    const { width, height } = this.app.screen;
    return { x: (sx - width / 2) / this.cam.z + this.cam.x, y: (sy - height / 2) / this.cam.z + this.cam.y };
  }
  worldToScreen(wx: number, wy: number) {
    const { width, height } = this.app.screen;
    return { x: (wx - this.cam.x) * this.cam.z + width / 2, y: (wy - this.cam.y) * this.cam.z + height / 2 };
  }
  zoomBy(f: number, sx?: number, sy?: number) {
    const { width, height } = this.app.screen;
    const px = sx ?? width / 2, py = sy ?? height / 2;
    const before = this.screenToWorld(px, py);
    this.cam.z = Math.max(0.3, Math.min(2.6, this.cam.z * f));
    this.cam.x = before.x - (px - width / 2) / this.cam.z;
    this.cam.y = before.y - (py - height / 2) / this.cam.z;
    this.clamp();
  }
  panBy(dx: number, dy: number) {
    this.cam.x -= dx / this.cam.z;
    this.cam.y -= dy / this.cam.z;
    this.clamp();
  }
  centerOn(wx: number, wy: number, z?: number) {
    this.cam.x = wx; this.cam.y = wy;
    if (z) this.cam.z = z;
    this.clamp();
  }
  private clamp() {
    if (!this.view) return;
    const b = this.view.bounds();
    this.cam.x = Math.max(b.x, Math.min(b.x + b.w, this.cam.x));
    this.cam.y = Math.max(b.y, Math.min(b.y + b.h, this.cam.y));
  }

  private bindInput() {
    const el = this.app.canvas;
    const rect = () => el.getBoundingClientRect();
    el.addEventListener('pointerdown', (e) => {
      try { el.setPointerCapture(e.pointerId); } catch { /* sans conséquence */ }
      const r = rect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      this.pointers.set(e.pointerId, { x, y, sx: x, sy: y, t: performance.now() });
      if (this.pointers.size === 1) {
        this.moved = false;
        const w = this.screenToWorld(x, y);
        this.dragging = !!this.view?.drag?.('start', w.x, w.y);
      }
      if (this.pointers.size === 2) {
        if (this.dragging) { this.dragging = false; }
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        this.moved = true;
      }
    });
    el.addEventListener('pointermove', (e) => {
      const r = rect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const p = this.pointers.get(e.pointerId);
      const w = this.screenToWorld(x, y);
      if (!p) { this.view?.hover?.(w.x, w.y); return; }
      const dx = x - p.x, dy = y - p.y;
      p.x = x; p.y = y;
      if (this.pointers.size >= 2 && this.pinch) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.panBy(mx - this.pinch.mx, my - this.pinch.my);
        if (this.pinch.d > 10) this.zoomBy(d / this.pinch.d, mx, my);
        this.pinch = { d, mx, my };
        return;
      }
      if (this.dragging) { this.view?.drag?.('move', w.x, w.y); this.view?.hover?.(w.x, w.y); return; }
      if (!this.moved && Math.hypot(x - p.sx, y - p.sy) > 7) this.moved = true;
      if (this.moved) this.panBy(dx, dy);
      this.view?.hover?.(w.x, w.y);
    });
    const end = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (!p || e.type === 'pointercancel') { this.dragging = false; return; }
      const w = this.screenToWorld(p.x, p.y);
      if (this.dragging) { this.dragging = false; this.view?.drag?.('end', w.x, w.y); return; }
      if (!this.moved && this.pointers.size === 0 && performance.now() - p.t < 600) this.view?.tap(w.x, w.y);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = rect();
      this.zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }

  destroy() {
    this.view?.destroy();
    this.app.destroy(true, { children: true });
  }
}

function mixNight(n: number): number {
  // du blanc (aucun effet) vers un bleu nuit profond
  const t = Math.min(1, n);
  const r = Math.round(255 - (255 - 58) * t), g = Math.round(255 - (255 - 70) * t), b = Math.round(255 - (255 - 120) * t);
  return (r << 16) | (g << 8) | b;
}

/** Mode économie (appareils modestes) : résolution 1, sans anticrénelage, moins de figurants. */
export let runtimeLowPower = false;
export function economyMode(): boolean {
  if (runtimeLowPower) return true;
  try { return localStorage.getItem('bct-qualite') === 'economie'; } catch { return false; }
}
export function setEconomyMode(on: boolean) {
  try { localStorage.setItem('bct-qualite', on ? 'economie' : 'haute'); } catch { /* stockage indisponible */ }
}
