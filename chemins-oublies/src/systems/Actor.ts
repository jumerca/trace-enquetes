// CharacterController (partie visuelle) : sprite animé + ombre, orientation, choix d'animation.
import Phaser from 'phaser';
import type { Dir } from '../core/state';
import { FH, FOOT, type AnimName } from '../art/characters';

/** Les personnages sont affichés plus grands que leurs dessins (proportions « aventure » : tête et silhouette lisibles). */
export const CHAR_SCALE = 1.25;

export class Actor {
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Image;
  dir: Dir = 'down';
  anim: AnimName = 'idle';
  x: number;
  y: number;
  constructor(public scene: Phaser.Scene, public id: string, x: number, y: number, S: number) {
    this.x = x; this.y = y;
    this.shadow = scene.add.image(x, y, 'shadow').setScale(1.25 / S).setOrigin(0.5, 0.5);
    this.sprite = scene.add.sprite(x, y, id).setOrigin(0.5, FOOT / FH).setScale(CHAR_SCALE / S);
    this.play('idle', true);
  }
  setPos(x: number, y: number) {
    this.x = x; this.y = y;
    this.sprite.setPosition(x, y).setDepth(y);
    this.shadow.setPosition(x, y + 1).setDepth(y - 0.5);
  }
  face(d: Dir) { if (d !== this.dir) { this.dir = d; this.play(this.anim, true); } }
  faceToward(x: number, y: number) {
    const dx = x - this.x, dy = (y - this.y) * 1.3;
    this.face(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
  }
  play(a: AnimName, force = false) {
    if (a === this.anim && !force && this.sprite.anims.isPlaying) return;
    this.anim = a;
    const d3 = this.dir === 'left' ? 'right' : this.dir;
    const key = `${this.id}_${a}_${d3}`;
    if (!this.scene.anims.exists(key)) return;
    this.sprite.setFlipX(this.dir === 'left');
    this.sprite.play(key, !force && this.sprite.anims.currentAnim?.key === key);
  }
  setVisible(v: boolean) { this.sprite.setVisible(v); this.shadow.setVisible(v); }
  destroy() { this.sprite.destroy(); this.shadow.destroy(); }
}
