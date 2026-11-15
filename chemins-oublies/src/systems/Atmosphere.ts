// Atmosphère : rendu « diorama » (flou de profondeur, halos, vignettage, étalonnage), ombres de nuages,
// rayons de soleil, pétales, poussière sous les pas, reflets qui coulent dans la rivière.
import Phaser from 'phaser';
import type { ZoneDef, Pt } from '../world/types';
import type { Settings } from '../core/state';
import { Rng } from '../core/rng';

const TAU = Math.PI * 2;

function ensureTextures(scene: Phaser.Scene) {
  const T = scene.textures;
  if (!T.exists('atm_cloud')) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 320; const x = c.getContext('2d')!;
    const r = new Rng(7);
    for (let i = 0; i < 14; i++) {
      const cx = 90 + r.next() * 330, cy = 90 + r.next() * 140, rr = 60 + r.next() * 70;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, cy, rr, 0, TAU); x.fill();
    }
    T.addCanvas('atm_cloud', c);
  }
  if (!T.exists('atm_ray')) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 512; const x = c.getContext('2d')!;
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, 'rgba(255,240,190,0)'); g.addColorStop(0.35, 'rgba(255,240,190,0.55)'); g.addColorStop(1, 'rgba(255,240,190,0)');
    x.fillStyle = g; x.beginPath(); x.moveTo(40, 0); x.lineTo(88, 0); x.lineTo(128, 512); x.lineTo(0, 512); x.closePath(); x.fill();
    const h = x.createLinearGradient(0, 0, 128, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 128, 512);
    T.addCanvas('atm_ray', c);
  }
  if (!T.exists('atm_water')) {
    // motif de reflets qui se répète sans couture
    const S = 256; const c = document.createElement('canvas'); c.width = S; c.height = S; const x = c.getContext('2d')!;
    const r = new Rng(11);
    x.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const px = r.next() * S, py = r.next() * S, len = 8 + r.next() * 22, a = 0.25 + r.next() * 0.5;
      for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) {
        x.strokeStyle = `rgba(255,255,255,${a})`; x.lineWidth = 1.4 + r.next() * 1.4;
        x.beginPath(); x.moveTo(px + ox - len / 2, py + oy); x.quadraticCurveTo(px + ox, py + oy - 2.5, px + ox + len / 2, py + oy); x.stroke();
      }
    }
    T.addCanvas('atm_water', c);
  }
  if (!T.exists('atm_petal')) {
    const c = document.createElement('canvas'); c.width = 16; c.height = 12; const x = c.getContext('2d')!;
    x.fillStyle = '#f6c6d6'; x.beginPath(); x.ellipse(8, 6, 6, 3.2, 0.4, 0, TAU); x.fill(); x.strokeStyle = 'rgba(160,80,110,0.6)'; x.lineWidth = 1; x.stroke();
    T.addCanvas('atm_petal', c);
  }
}

/** Effets de rendu de la caméra (WebGL). Basse qualité : aucun ; moyenne : étalonnage + vignettage ; haute : tout. */
export function applyCameraFX(cam: Phaser.Cameras.Scene2D.Camera, q: Settings['quality'], interior: boolean) {
  const fx = (cam as any).postFX as Phaser.GameObjects.Components.FX | undefined;
  if (!fx || cam.scene.game.renderer.type !== Phaser.WEBGL) return;
  fx.clear();
  if (q === 'basse') return;
  const cm = fx.addColorMatrix();
  cm.saturate(0.18, true);
  cm.contrast(0.06, true);
  if (q === 'haute') {
    fx.addBloom(0xffffff, 1, 1, 1, interior ? 0.55 : 0.4, 4);
    fx.addTiltShift(interior ? 0.62 : 0.55, 0.9, 0.12, 1, 1, interior ? 0.45 : 0.7);
  }
  fx.addVignette(0.5, 0.5, interior ? 0.78 : 0.88, interior ? 0.42 : 0.3);
}

export class Atmosphere {
  private objs: Phaser.GameObjects.GameObject[] = [];
  private waters: { ts: Phaser.GameObjects.TileSprite; dx: number; dy: number }[] = [];
  constructor(private scene: Phaser.Scene) { ensureTextures(scene); }

  clear() { this.objs.forEach((o) => o.destroy()); this.objs = []; this.waters = []; }

  build(z: ZoneDef, q: Settings['quality']) {
    this.clear();
    const s = this.scene;
    if (z.interior) {
      // rais de lumière par les fenêtres
      if (q !== 'basse') for (const x of [200, 520]) {
        const ray = s.add.image(x, 330, 'atm_ray').setScale(1.1, 0.75).setAngle(-12).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.22).setDepth(9e6);
        s.tweens.add({ targets: ray, alpha: { from: 0.14, to: 0.26 }, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        this.objs.push(ray);
      }
      return;
    }
    // reflets qui coulent dans la rivière (masque = forme de l'eau)
    if (q !== 'basse') for (const w of z.water) {
      if (w.channel) continue;
      const g = s.make.graphics({}, false);
      g.lineStyle(w.w * 0.82, 0xffffff, 1); g.beginPath(); g.moveTo(w.pts[0][0], w.pts[0][1]); for (const [x, y] of w.pts.slice(1)) g.lineTo(x, y); g.strokePath();
      const xs = w.pts.map((p) => p[0]), ys = w.pts.map((p) => p[1]);
      const x0 = Math.min(...xs) - w.w, y0 = Math.min(...ys) - w.w, x1 = Math.max(...xs) + w.w, y1 = Math.max(...ys) + w.w;
      const ts = s.add.tileSprite(x0, y0, x1 - x0, y1 - y0, 'atm_water').setOrigin(0).setDepth(-4.6e5).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
      ts.setMask(g.createGeometryMask());
      const [a, b] = [w.pts[0], w.pts[w.pts.length - 1]];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      this.waters.push({ ts, dx: (b[0] - a[0]) / d, dy: (b[1] - a[1]) / d });
      this.objs.push(ts, g);
    }
    // ombres de nuages qui glissent
    const r = new Rng(z.seed + 5);
    const n = q === 'basse' ? 0 : q === 'moyenne' ? 3 : 5;
    for (let i = 0; i < n; i++) {
      const c = s.add.image(r.next() * z.w, r.next() * z.h, 'atm_cloud').setScale(2.2 + r.next() * 1.6).setDepth(9.6e6).setTint(0x1d2a3a).setAlpha(0.13).setBlendMode(Phaser.BlendModes.MULTIPLY);
      const speed = 9 + r.next() * 8;
      const drift = () => { if (!c.active) return; const from = c.x; s.tweens.add({ targets: c, x: z.w + 700, y: c.y + 80, duration: ((z.w + 700 - from) / speed) * 1000, onComplete: () => { c.x = -700; c.y = r.next() * z.h; drift(); } }); };
      drift();
      this.objs.push(c);
    }
    // rayons de soleil dans les clairières de la forêt
    if (z.corridor && q !== 'basse') for (const [cx, cy, cr] of z.corridor.clearings.slice(0, 6)) {
      const ray = s.add.image(cx + cr * 0.2, cy - 40, 'atm_ray').setScale(2.2, 1.4).setAngle(-16).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.2).setDepth(9.7e6);
      s.tweens.add({ targets: ray, alpha: { from: 0.12, to: 0.28 }, duration: 2600 + r.next() * 2000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.objs.push(ray);
    }
    // pétales au vent au village
    if (z.id === 'clairval' && q !== 'basse') {
      const p = s.add.particles(0, 0, 'atm_petal', { x: { min: 0, max: z.w }, y: { min: 0, max: z.h }, lifespan: 9000, speedX: { min: 10, max: 30 }, speedY: { min: 4, max: 16 }, rotate: { start: 0, end: 540 }, scale: { start: 0.9, end: 0.6 }, alpha: { start: 0.95, end: 0 }, frequency: q === 'haute' ? 70 : 160 });
      p.setDepth(9.5e6); this.objs.push(p);
    }
  }

  update(dt: number) {
    for (const w of this.waters) { w.ts.tilePositionX -= w.dx * dt * 28; w.ts.tilePositionY -= w.dy * dt * 28; }
  }

  /** Petit nuage de poussière sous les pas. */
  dust(x: number, y: number, surface: string) {
    if (surface === 'wood') return;
    const s = this.scene;
    const p = s.add.image(x + (Math.random() - 0.5) * 6, y - 2, 'fx_soft').setScale(0.25).setTint(surface === 'grass' ? 0xb8d890 : 0xd8c49a).setAlpha(0.55).setDepth(y - 1);
    s.tweens.add({ targets: p, scale: 0.6, alpha: 0, y: y - 8, duration: 500, onComplete: () => p.destroy() });
  }
}

export type { Pt };
