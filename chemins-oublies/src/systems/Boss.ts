// Le Gardien des Ronces : boss en deux phases devant le moulin.
// Phase 1 : trois fouets annoncés au sol, puis le cœur s'ouvre (vulnérable).
// Phase 2 (moitié de vie) : charges en ligne droite ; s'il rate sa cible, il s'étourdit et son cœur s'ouvre.
import Phaser from 'phaser';
import type { CombatHost } from './Combat';
import { audio } from './Audio';

type St = 'intro' | 'idle' | 'windup' | 'lash' | 'exposed' | 'cwindup' | 'charge' | 'stunned' | 'hurt' | 'dead';

export const ARENA = { x: 1120, y: 1130, r: 260 };

export class Boss {
  hp = 12;
  readonly maxHp = 12;
  st: St = 'intro';
  t = 0;
  x = ARENA.x + 20;
  y = ARENA.y - 50;
  lashes = 0;
  sprite: Phaser.GameObjects.Sprite;
  tele: Phaser.GameObjects.Graphics;
  lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  chargeTo: [number, number] | null = null;
  chargeFrom: [number, number] | null = null;
  hitDone = false;
  onDefeat: (() => void) | null = null;
  constructor(private scene: Phaser.Scene, private host: CombatHost, S: number) {
    this.sprite = scene.add.sprite(this.x, this.y, 'gardien').setOrigin(0.5, 1 - 6 / 200).setScale(1 / S).play('gardien_idle');
    this.tele = scene.add.graphics().setDepth(-4.9e5);
    this.sprite.setAlpha(0);
  }
  get alive() { return this.st !== 'dead'; }
  get phase2() { return this.hp <= this.maxHp / 2; }
  get vulnerable() { return this.st === 'exposed' || this.st === 'stunned' || this.st === 'hurt'; }
  /** Point visé quand on le frappe : son cœur. */
  get core(): [number, number] { return [this.x, this.y - 58]; }

  appear() { this.scene.tweens.add({ targets: this.sprite, alpha: 1, duration: 900 }); this.st = 'idle'; this.t = 0; }

  hitTest(wx: number, wy: number, pad: number) { return this.alive && this.st !== 'intro' && Math.abs(wx - this.x) < 80 + pad && wy < this.y + 10 + pad && wy > this.y - 150 - pad; }

  /** Coup du héros : n'entame que le cœur ouvert ; sinon, ça « rebondit ». */
  strike(hx: number, hy: number, dmg: number): 'hit' | 'bounce' | 'miss' {
    if (!this.alive || Math.hypot(this.x - hx, (this.y - hy) * 1.3) > 110) return 'miss';
    if (!this.vulnerable) { audio.sfx('lever'); return 'bounce'; }
    this.hp = Math.max(0, this.hp - dmg);
    audio.sfx('hit'); this.scene.cameras.main.shake(140, 0.006);
    this.sprite.setTintFill(0xffffff); this.scene.time.delayedCall(90, () => this.sprite.clearTint());
    if (this.hp <= 0) { this.die(); return 'hit'; }
    if (this.st === 'exposed' || this.st === 'stunned') { const keep = this.st; this.sprite.play('gardien_hurt'); this.scene.time.delayedCall(260, () => { if (this.alive && this.st === keep) this.sprite.play('gardien_exposed'); }); }
    return 'hit';
  }

  private die() {
    this.st = 'dead'; this.tele.clear();
    this.sprite.play('gardien_die');
    audio.sfx('poof'); audio.sfx('fanfare');
    this.scene.cameras.main.shake(600, 0.01);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, delay: 1300, duration: 900 });
    this.scene.time.delayedCall(1600, () => this.onDefeat?.());
  }

  reset() {
    this.hp = this.maxHp; this.st = 'idle'; this.t = 0; this.lashes = 0; this.x = ARENA.x + 20; this.y = ARENA.y - 50; this.tele.clear();
    this.sprite.setAlpha(1).play('gardien_idle');
  }

  destroy() { this.sprite.destroy(); this.tele.destroy(); }

  update(dt: number, windupMul: number, dmg: number) {
    if (this.st === 'intro' || this.st === 'dead') { this.sprite.setPosition(this.x, this.y).setDepth(this.y); return; }
    const [hx, hy] = this.host.heroPos();
    this.t += dt;
    switch (this.st) {
      case 'idle':
        if (this.t > (this.phase2 ? 0.7 : 1.1)) {
          if (this.phase2 && this.lashes >= 1) this.startCharge(hx, hy);
          else this.startLash(hx, hy);
        }
        break;
      case 'windup': {
        const W = (this.phase2 ? 0.85 : 1.1) * windupMul;
        this.drawLines(Math.min(1, this.t / W));
        if (this.t >= W) {
          this.st = 'lash'; this.t = 0; this.sprite.play('gardien_lash');
          audio.sfx('slam'); this.scene.cameras.main.shake(200, 0.008);
          if (this.lines.some((l) => distSeg(hx, hy, l) < 30)) this.host.heroHit(dmg, this.x, this.y);
        }
        break;
      }
      case 'lash':
        this.drawLines(1, 1 - this.t / 0.35);
        if (this.t > 0.35) {
          this.tele.clear(); this.lashes++;
          if (!this.phase2 && this.lashes >= 3) { this.st = 'exposed'; this.t = 0; this.sprite.play('gardien_exposed'); audio.sfx('creak'); }
          else { this.st = 'idle'; this.t = 0; this.sprite.play('gardien_idle'); }
        }
        break;
      case 'exposed': case 'stunned':
        if (this.t > (this.st === 'stunned' ? 2.6 : 2.8)) { this.st = 'idle'; this.t = 0; this.lashes = 0; this.sprite.play('gardien_idle'); }
        break;
      case 'cwindup': {
        const W = 0.9 * windupMul;
        this.drawCharge(Math.min(1, this.t / W));
        if (this.t >= W) { this.st = 'charge'; this.t = 0; this.hitDone = false; this.sprite.play('gardien_charge'); audio.sfx('whoosh'); }
        break;
      }
      case 'charge': {
        const [fx, fy] = this.chargeFrom!, [tx, ty] = this.chargeTo!;
        const k = Math.min(1, this.t / 0.55);
        this.x = fx + (tx - fx) * k; this.y = fy + (ty - fy) * k;
        this.drawCharge(1, 1 - k);
        if (!this.hitDone && Math.hypot(hx - this.x, (hy - this.y) * 1.3) < 70) { this.hitDone = true; this.host.heroHit(dmg, this.x, this.y); }
        if (k >= 1) {
          this.tele.clear(); this.lashes = 0;
          // il s'écrase contre le bord de l'arène : étourdi si sa charge a manqué Éloi
          this.scene.cameras.main.shake(260, 0.01); audio.sfx('slam');
          if (!this.hitDone) { this.st = 'stunned'; this.t = 0; this.sprite.play('gardien_exposed'); }
          else { this.st = 'idle'; this.t = 0; this.sprite.play('gardien_idle'); }
        }
        break;
      }
    }
    this.sprite.setPosition(this.x, this.y).setDepth(this.y).setFlipX(hx < this.x);
  }

  private startLash(hx: number, hy: number) {
    this.st = 'windup'; this.t = 0; this.sprite.play('gardien_windup'); audio.sfx('windup');
    const a0 = Math.atan2(hy - this.y, hx - this.x);
    const spread = this.phase2 ? [-0.55, -0.18, 0.18, 0.55] : [-0.45, 0, 0.45];
    this.lines = spread.map((da) => ({ x1: this.x, y1: this.y - 10, x2: this.x + Math.cos(a0 + da) * 380, y2: this.y - 10 + Math.sin(a0 + da) * 380 }));
  }

  private startCharge(hx: number, hy: number) {
    this.st = 'cwindup'; this.t = 0; this.sprite.play('gardien_windup'); audio.sfx('windup');
    const a = Math.atan2(hy - this.y, hx - this.x);
    // traverse toute l'arène, jusqu'au bord opposé
    const L = ARENA.r * 1.5;
    const tx = this.x + Math.cos(a) * L, ty = this.y + Math.sin(a) * L;
    const d = Math.hypot(tx - ARENA.x, ty - ARENA.y);
    const k = d > ARENA.r - 40 ? (ARENA.r - 40) / d : 1;
    this.chargeFrom = [this.x, this.y];
    this.chargeTo = [ARENA.x + (tx - ARENA.x) * k, ARENA.y + (ty - ARENA.y) * k];
  }

  private drawLines(k: number, fade = 1) {
    const g = this.tele; g.clear();
    for (const l of this.lines) {
      const a = Math.atan2(l.y2 - l.y1, l.x2 - l.x1), w = 50;
      const px = Math.cos(a + Math.PI / 2) * w / 2, py = Math.sin(a + Math.PI / 2) * w / 2;
      const pts = (x2: number, y2: number) => [{ x: l.x1 + px, y: l.y1 + py }, { x: x2 + px, y: y2 + py }, { x: x2 - px, y: y2 - py }, { x: l.x1 - px, y: l.y1 - py }];
      g.fillStyle(0xd04a3a, 0.16 * fade).fillPoints(pts(l.x2, l.y2), true);
      g.fillStyle(0xd04a3a, 0.36 * fade).fillPoints(pts(l.x1 + (l.x2 - l.x1) * k, l.y1 + (l.y2 - l.y1) * k), true);
      g.lineStyle(2, 0x8a1f16, 0.85 * fade).strokePoints(pts(l.x2, l.y2), true);
    }
  }

  private drawCharge(k: number, fade = 1) {
    const g = this.tele; g.clear();
    if (!this.chargeFrom || !this.chargeTo) return;
    const [x1, y1] = this.chargeFrom, [x2, y2] = this.chargeTo;
    const a = Math.atan2(y2 - y1, x2 - x1), w = 120;
    const px = Math.cos(a + Math.PI / 2) * w / 2, py = Math.sin(a + Math.PI / 2) * w / 2;
    const pts = (xe: number, ye: number) => [{ x: x1 + px, y: y1 + py }, { x: xe + px, y: ye + py }, { x: xe - px, y: ye - py }, { x: x1 - px, y: y1 - py }];
    g.fillStyle(0xd04a3a, 0.16 * fade).fillPoints(pts(x2, y2), true);
    g.fillStyle(0xd04a3a, 0.34 * fade).fillPoints(pts(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k), true);
    g.lineStyle(2.5, 0x8a1f16, 0.85 * fade).strokePoints(pts(x2, y2), true);
  }
}

function distSeg(px: number, py: number, l: { x1: number; y1: number; x2: number; y2: number }) {
  const dx = l.x2 - l.x1, dy = l.y2 - l.y1, L2 = dx * dx + dy * dy;
  const t = Math.max(0, Math.min(1, ((px - l.x1) * dx + (py - l.y1) * dy) / L2));
  return Math.hypot(px - (l.x1 + t * dx), py - (l.y1 + t * dy));
}
