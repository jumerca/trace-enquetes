// Le Dévoreur de brume : boss du Chapitre II, sur la rive nord de la tourbière.
// Dans la brume, il est insaisissable (les coups le traversent). Un brasero allumé le force à prendre forme :
// tant qu'une flamme brûle, il est visible et vulnérable. Il souffle des nappes de brume annoncées au sol.
// Seconde moitié : souffle double, flammes plus brèves.
import Phaser from 'phaser';
import type { CombatHost } from './Combat';
import { audio } from './Audio';
import { propTex } from '../world/textures';

type St = 'intro' | 'drift' | 'windup' | 'burst' | 'hurt' | 'dead';
export interface Arena { x: number; y: number; r: number }

export class Devoreur {
  readonly name = 'Le Dévoreur de brume';
  readonly kind = 'devoreur';
  hp = 12;
  readonly maxHp = 12;
  st: St = 'intro';
  t = 0;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  tele: Phaser.GameObjects.Graphics;
  targets: [number, number][] = [];
  onDefeat: (() => void) | null = null;
  /** secondes de flamme restantes par brasero, et temps de recharge */
  lit: number[];
  cool: number[];
  private shownAlpha = 0;
  constructor(private scene: Phaser.Scene, private host: CombatHost, private S: number, public arena: Arena, private getBraziers: () => Phaser.GameObjects.Image[]) {
    this.x = arena.x; this.y = arena.y - 40;
    this.sprite = scene.add.sprite(this.x, this.y, 'murmure').setOrigin(0.5, 0.92).setScale(3.1 / S).setTint(0xc8dcea).play('murmure_idle');
    this.sprite.setAlpha(0);
    this.tele = scene.add.graphics().setDepth(-4.9e5);
    this.lit = [0, 0, 0]; this.cool = [0, 0, 0];
  }
  get alive() { return this.st !== 'dead'; }
  get phase2() { return this.hp <= this.maxHp / 2; }
  get revealed() { return this.lit.some((v) => v > 0); }
  get vulnerable() { return this.alive && this.st !== 'intro' && this.revealed; }
  get core(): [number, number] { return [this.x, this.y - 90]; }

  appear() { this.st = 'drift'; this.t = 0; }

  hitTest(wx: number, wy: number, pad: number) { return this.alive && this.st !== 'intro' && Math.abs(wx - this.x) < 90 + pad && wy < this.y + 10 + pad && wy > this.y - 210 - pad; }

  strike(hx: number, hy: number, dmg: number): 'hit' | 'bounce' | 'miss' {
    if (!this.alive || Math.hypot(this.x - hx, (this.y - hy) * 1.3) > 120) return 'miss';
    if (!this.revealed) { audio.sfx('whoosh'); return 'bounce'; }
    this.hp = Math.max(0, this.hp - dmg);
    audio.sfx('hit'); this.scene.cameras.main.shake(140, 0.006);
    this.sprite.setTintFill(0xffffff); this.scene.time.delayedCall(90, () => { this.sprite.clearTint(); this.sprite.setTint(0xc8dcea); });
    // repoussé hors de portée : il faut le poursuivre dans l'arène
    const a = Math.atan2(this.y - hy, this.x - hx);
    this.x = Phaser.Math.Clamp(this.x + Math.cos(a) * 60, this.arena.x - this.arena.r + 60, this.arena.x + this.arena.r - 60);
    this.y = Phaser.Math.Clamp(this.y + Math.sin(a) * 40, this.arena.y - this.arena.r * 0.6, this.arena.y + this.arena.r * 0.6);
    if (this.hp <= 0) { this.die(); return 'hit'; }
    this.sprite.play('murmure_hurt'); this.scene.time.delayedCall(260, () => { if (this.alive) this.sprite.play('murmure_idle'); });
    return 'hit';
  }

  /** Allume un brasero (si le combat a commencé et qu'il n'est pas en recharge). */
  light(i: number): boolean {
    if (!this.alive || this.st === 'intro' || this.lit[i] > 0 || this.cool[i] > 0) return false;
    this.lit[i] = this.phase2 ? 5 : 7;
    audio.sfx('discover');
    this.setBrazier(i, true);
    return true;
  }
  private setBrazier(i: number, on: boolean) {
    const key = (on ? 'brazier:on' : 'brazier') ;
    const k = 'p:' + key + '@' + this.S;
    if (!this.scene.textures.exists(k)) this.scene.textures.addCanvas(k, propTex(key, this.S).canvas);
    const img = this.getBraziers()[i]; if (!img) return;
    const t = propTex(key, this.S);
    img.setTexture(k).setOrigin(t.ax, t.ay);
  }

  private die() {
    this.st = 'dead'; this.tele.clear();
    this.sprite.play('murmure_die');
    audio.sfx('poof'); audio.sfx('fanfare');
    this.scene.cameras.main.shake(600, 0.01);
    this.scene.tweens.add({ targets: this.sprite, alpha: 0, scale: 4.5 / this.S, delay: 600, duration: 1200 });
    this.lit.forEach((_, i) => { this.lit[i] = 0; this.setBrazier(i, false); });
    this.scene.time.delayedCall(1700, () => this.onDefeat?.());
  }

  reset() {
    this.hp = this.maxHp; this.st = 'drift'; this.t = 0; this.x = this.arena.x; this.y = this.arena.y - 40; this.tele.clear(); this.targets = [];
    this.lit.forEach((_, i) => { this.lit[i] = 0; this.cool[i] = 0; this.setBrazier(i, false); });
    this.sprite.play('murmure_idle');
  }

  destroy() { this.sprite.destroy(); this.tele.destroy(); }

  update(dt: number, windupMul: number, dmg: number) {
    // flammes
    for (let i = 0; i < this.lit.length; i++) {
      if (this.lit[i] > 0) { this.lit[i] -= dt; if (this.lit[i] <= 0) { this.lit[i] = 0; this.cool[i] = 3; this.setBrazier(i, false); audio.sfx('poof'); } }
      else if (this.cool[i] > 0) this.cool[i] = Math.max(0, this.cool[i] - dt);
    }
    // visibilité : une ombre dans la brume, ou une forme nette près des flammes
    const want = this.st === 'intro' ? this.shownAlpha : this.st === 'dead' ? this.sprite.alpha : this.revealed ? 0.95 : 0.28 + Math.sin(this.scene.time.now / 300) * 0.06;
    if (this.st !== 'dead') { this.shownAlpha += (want - this.shownAlpha) * Math.min(1, dt * 5); this.sprite.setAlpha(this.shownAlpha); }
    if (this.st === 'intro' || this.st === 'dead') { this.sprite.setPosition(this.x, this.y).setDepth(this.y); return; }
    const [hx, hy] = this.host.heroPos();
    this.t += dt;
    switch (this.st) {
      case 'drift': {
        // il rôde à distance d'Éloi ; révélé, il ralentit
        const sp = this.revealed ? 30 : 70;
        const a = Math.atan2(hy - this.y, hx - this.x), d = Math.hypot(hx - this.x, hy - this.y);
        if (d > 150) { this.x += Math.cos(a) * sp * dt; this.y += Math.sin(a) * sp * dt * 0.8; }
        if (this.t > (this.phase2 ? 1.6 : 2.3)) this.startBreath(hx, hy);
        break;
      }
      case 'windup': {
        const W = (this.phase2 ? 0.95 : 1.2) * windupMul;
        this.drawTargets(Math.min(1, this.t / W));
        if (this.t >= W) {
          this.st = 'burst'; this.t = 0; this.sprite.play('murmure_dash');
          audio.sfx('whoosh'); this.scene.cameras.main.shake(180, 0.006);
          if (this.targets.some(([x, y]) => Math.hypot(hx - x, (hy - y) * 1.3) < 66)) this.host.heroHit(dmg, this.x, this.y);
          for (const [x, y] of this.targets) { const p = this.scene.add.image(x, y - 20, 'fx_soft').setScale(2.6).setTint(0xdfe8ee).setAlpha(0.85).setDepth(y + 5); this.scene.tweens.add({ targets: p, alpha: 0, scale: 5, duration: 700, onComplete: () => p.destroy() }); }
        }
        break;
      }
      case 'burst':
        this.drawTargets(1, 1 - this.t / 0.3);
        if (this.t > 0.3) { this.tele.clear(); this.st = 'drift'; this.t = 0; this.sprite.play('murmure_idle'); }
        break;
    }
    // reste dans l'arène
    const dx = this.x - this.arena.x, dy = this.y - this.arena.y, d = Math.hypot(dx, dy), m = this.arena.r - 50;
    if (d > m) { this.x = this.arena.x + dx / d * m; this.y = this.arena.y + dy / d * m; }
    this.sprite.setPosition(this.x, this.y).setDepth(this.y).setFlipX(hx < this.x);
  }

  private startBreath(hx: number, hy: number) {
    this.st = 'windup'; this.t = 0; this.sprite.play('murmure_windup'); audio.sfx('windup');
    this.targets = [[hx, hy]];
    if (this.phase2) { const a = Math.random() * Math.PI * 2; this.targets.push([hx + Math.cos(a) * 120, hy + Math.sin(a) * 90]); }
  }

  private drawTargets(k: number, fade = 1) {
    const g = this.tele; g.clear();
    for (const [x, y] of this.targets) {
      g.fillStyle(0x9fb8c8, 0.18 * fade).fillEllipse(x, y, 132, 100);
      g.fillStyle(0x6f8ea2, 0.4 * fade).fillEllipse(x, y, 132 * k, 100 * k);
      g.lineStyle(2, 0x3f5a6e, 0.85 * fade).strokeEllipse(x, y, 132, 100);
    }
  }
}
