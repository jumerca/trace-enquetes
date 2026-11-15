// CombatSystem : ennemis, attaques annoncées, zones de danger, santé, reprise au point de contrôle.
import Phaser from 'phaser';
import { S, Settings } from '../core/state';
import { ENCOUNTERS, EncounterDef } from '../data/objects';
import type { NavGrid } from './Navigation';
import { audio } from './Audio';

export type EnemyKind = 'ronceux' | 'murmure' | 'ancien';
type St = 'idle' | 'chase' | 'windup' | 'strike' | 'recover' | 'hurt' | 'dead';

interface KindDef { hp: number; speed: number; reach: number; windup: number; recover: number; dmg: number; aggro: number; tex: string; scale: number; hitW: number; hitH: number }
const KINDS: Record<EnemyKind, KindDef> = {
  ronceux: { hp: 3, speed: 52, reach: 74, windup: 1.0, recover: 1.3, dmg: 1, aggro: 300, tex: 'ronceux', scale: 1, hitW: 56, hitH: 64 },
  murmure: { hp: 2, speed: 78, reach: 210, windup: 0.85, recover: 1.5, dmg: 1, aggro: 340, tex: 'murmure', scale: 1, hitW: 48, hitH: 70 },
  ancien: { hp: 6, speed: 46, reach: 100, windup: 1.1, recover: 1.1, dmg: 1, aggro: 260, tex: 'ronceux_ancien', scale: 1, hitW: 80, hitH: 92 },
};

export class Enemy {
  hp: number;
  st: St = 'idle';
  t = 0;
  x: number; y: number;
  homeX: number; homeY: number;
  sprite: Phaser.GameObjects.Sprite;
  tele: Phaser.GameObjects.Graphics;
  dashTo: [number, number] | null = null;
  dashFrom: [number, number] | null = null;
  flip = false;
  hitDone = false;
  constructor(public scene: Phaser.Scene, public kind: EnemyKind, x: number, y: number, public enc: EncounterDef, S_: number) {
    const d = KINDS[kind];
    this.hp = d.hp; this.x = this.homeX = x; this.y = this.homeY = y;
    this.sprite = scene.add.sprite(x, y, d.tex).setOrigin(0.5, 1 - 6 / (80 * (kind === 'ancien' ? 1.45 : 1))).setScale(1 / S_);
    this.sprite.play(`${d.tex}_idle`);
    this.tele = scene.add.graphics().setDepth(-5000 + 1);
  }
  get def() { return KINDS[this.kind]; }
  get alive() { return this.st !== 'dead'; }
  hitTest(wx: number, wy: number, pad: number) {
    const d = this.def;
    return this.alive && Math.abs(wx - this.x) < d.hitW / 2 + pad && wy < this.y + 10 + pad && wy > this.y - d.hitH - pad;
  }
  destroy() { this.sprite.destroy(); this.tele.destroy(); }
}

export interface CombatHost {
  nav: NavGrid;
  heroPos(): [number, number];
  heroHit(dmg: number, fromX: number, fromY: number): void;
  settings(): Settings;
  onEncounterDone(id: string): void;
  onEngage(active: boolean): void;
}

const DIFF: Record<Settings['combat'], { windup: number; dmg: number; heroDmg: number }> = {
  exploration: { windup: 1.5, dmg: 0, heroDmg: 2 },
  facile: { windup: 1.35, dmg: 1, heroDmg: 1.5 },
  normale: { windup: 1, dmg: 1, heroDmg: 1 },
  difficile: { windup: 0.75, dmg: 1, heroDmg: 1 },
};

export class Combat {
  enemies: Enemy[] = [];
  engaged = false;
  constructor(private scene: Phaser.Scene, private host: CombatHost, private S_: number) {}

  spawnZone(zone: string) {
    this.clear();
    for (const enc of ENCOUNTERS) {
      if (enc.zone !== zone || S.defeated.includes(enc.id)) continue;
      for (const e of enc.enemies) this.enemies.push(new Enemy(this.scene, e.kind, e.x, e.y, enc, this.S_));
    }
  }
  clear() { this.enemies.forEach((e) => e.destroy()); this.enemies = []; this.engaged = false; }

  /** Remise à zéro des rencontres non terminées (après une défaite). */
  resetAlive() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.hp = e.def.hp; e.x = e.homeX; e.y = e.homeY; e.st = 'idle'; e.t = 0; e.tele.clear(); e.dashTo = null;
      e.sprite.setVisible(true).setAlpha(1).play(`${e.def.tex}_idle`);
    }
  }

  pick(wx: number, wy: number, pad: number): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies) if (e.hitTest(wx, wy, pad) && (!best || e.y > best.y)) best = e;
    return best;
  }

  /** Le héros frappe : retourne vrai si l'ennemi est touché. */
  strike(e: Enemy, hx: number, hy: number): boolean {
    if (!e.alive || Math.hypot(e.x - hx, (e.y - hy) * 1.3) > 70 + (e.kind === 'ancien' ? 20 : 0)) return false;
    const dm = DIFF[this.host.settings().combat].heroDmg;
    e.hp -= dm;
    const a = Math.atan2(e.y - hy, e.x - hx);
    const nx = e.x + Math.cos(a) * 14, ny = e.y + Math.sin(a) * 14;
    if (this.host.nav.freeAt(nx, ny)) { e.x = nx; e.y = ny; }
    audio.sfx('hit');
    if (e.hp <= 0) {
      e.st = 'dead'; e.tele.clear();
      e.sprite.play(`${e.def.tex}_die`);
      audio.sfx('poof');
      this.scene.tweens.add({ targets: e.sprite, alpha: 0, delay: 500, duration: 400, onComplete: () => e.sprite.setVisible(false) });
      this.checkDone(e.enc);
    } else if (e.st !== 'windup' && e.st !== 'strike') {
      e.st = 'hurt'; e.t = 0; e.sprite.play(`${e.def.tex}_hurt`);
    }
    return true;
  }

  private checkDone(enc: EncounterDef) {
    if (this.enemies.some((e) => e.enc === enc && e.alive)) return;
    if (!S.defeated.includes(enc.id)) S.defeated.push(enc.id);
    this.host.onEncounterDone(enc.id);
  }

  update(dt: number) {
    const [hx, hy] = this.host.heroPos();
    const diff = DIFF[this.host.settings().combat];
    let engaged = false;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = e.def;
      const dist = Math.hypot(hx - e.x, (hy - e.y) * 1.2);
      const inZone = Math.hypot(hx - e.enc.center[0], hy - e.enc.center[1]) < e.enc.radius + 160;
      e.t += dt;
      if (inZone && dist < d.aggro + 120) engaged = true;
      switch (e.st) {
        case 'idle':
          if (inZone && dist < d.aggro) { e.st = 'chase'; e.t = 0; e.sprite.play(`${d.tex}_${e.kind === 'murmure' ? 'idle' : 'walk'}`); }
          else if (Math.hypot(e.x - e.homeX, e.y - e.homeY) > 6) this.moveToward(e, e.homeX, e.homeY, d.speed * 0.6, dt);
          break;
        case 'chase':
          if (!inZone || dist > d.aggro * 1.6) { e.st = 'idle'; e.sprite.play(`${d.tex}_idle`); break; }
          if (dist < d.reach * (e.kind === 'murmure' ? 1 : 0.8) && e.t > 0.4) {
            e.st = 'windup'; e.t = 0; e.hitDone = false;
            e.sprite.play(`${d.tex}_windup`);
            audio.sfx('windup');
            if (e.kind === 'murmure') { e.dashFrom = [e.x, e.y]; const a = Math.atan2(hy - e.y, hx - e.x); e.dashTo = [e.x + Math.cos(a) * d.reach, e.y + Math.sin(a) * d.reach]; }
          } else this.moveToward(e, hx, hy, d.speed, dt, e.kind === 'murmure' ? 120 : 30);
          break;
        case 'windup': {
          const W = d.windup * diff.windup;
          this.drawTele(e, Math.min(1, e.t / W));
          if (e.t >= W) {
            e.st = 'strike'; e.t = 0;
            e.sprite.play(`${d.tex}_${e.kind === 'murmure' ? 'dash' : 'slam'}`);
            audio.sfx(e.kind === 'murmure' ? 'whoosh' : 'slam');
            if (e.kind !== 'murmure') { this.scene.cameras.main.shake(120, 0.004); if (this.inSlam(e, hx, hy)) this.hit(e, diff.dmg); }
          }
          break;
        }
        case 'strike':
          if (e.kind === 'murmure' && e.dashTo && e.dashFrom) {
            const k = Math.min(1, e.t / 0.32);
            const nx = e.dashFrom[0] + (e.dashTo[0] - e.dashFrom[0]) * k, ny = e.dashFrom[1] + (e.dashTo[1] - e.dashFrom[1]) * k;
            if (this.host.nav.freeAt(nx, ny)) { e.x = nx; e.y = ny; }
            this.drawTele(e, 1, 1 - k);
            if (!e.hitDone && Math.hypot(hx - e.x, (hy - e.y) * 1.3) < 34) { e.hitDone = true; this.hit(e, diff.dmg); }
            if (k >= 1) { e.st = 'recover'; e.t = 0; e.tele.clear(); e.sprite.play(`${d.tex}_idle`); }
          } else if (e.t > 0.3) { e.st = 'recover'; e.t = 0; e.tele.clear(); e.sprite.play(`${d.tex}_idle`); }
          break;
        case 'recover':
          if (e.t > d.recover) { e.st = 'chase'; e.t = 0; e.sprite.play(`${d.tex}_${e.kind === 'murmure' ? 'idle' : 'walk'}`); }
          break;
        case 'hurt':
          if (e.t > 0.35) { e.st = 'chase'; e.t = 0.2; e.sprite.play(`${d.tex}_${e.kind === 'murmure' ? 'idle' : 'walk'}`); }
          break;
      }
      e.sprite.setPosition(e.x, e.y).setDepth(e.y);
      if (e.st === 'chase' || e.st === 'idle') e.flip = hx < e.x;
      e.sprite.setFlipX(e.flip);
    }
    if (engaged !== this.engaged) { this.engaged = engaged; this.host.onEngage(engaged); }
  }

  private inSlam(e: Enemy, hx: number, hy: number) { return Math.hypot(hx - e.x, (hy - e.y) * 1.6) < e.def.reach; }
  private hit(e: Enemy, dmg: number) { this.host.heroHit(dmg, e.x, e.y); }

  private drawTele(e: Enemy, k: number, fade = 1) {
    const g = e.tele; g.clear();
    if (e.kind === 'murmure' && e.dashFrom && e.dashTo) {
      const [x1, y1] = e.dashFrom, [x2, y2] = e.dashTo;
      const a = Math.atan2(y2 - y1, x2 - x1), w = 38;
      const px = Math.cos(a + Math.PI / 2) * w / 2, py = Math.sin(a + Math.PI / 2) * w / 2;
      g.fillStyle(0xd04a3a, 0.18 * fade).fillPoints([{ x: x1 + px, y: y1 + py }, { x: x2 + px, y: y2 + py }, { x: x2 - px, y: y2 - py }, { x: x1 - px, y: y1 - py }], true);
      const xm = x1 + (x2 - x1) * k, ym = y1 + (y2 - y1) * k;
      g.fillStyle(0xd04a3a, 0.35 * fade).fillPoints([{ x: x1 + px, y: y1 + py }, { x: xm + px, y: ym + py }, { x: xm - px, y: ym - py }, { x: x1 - px, y: y1 - py }], true);
      g.lineStyle(2, 0x8a1f16, 0.8 * fade).strokePoints([{ x: x1 + px, y: y1 + py }, { x: x2 + px, y: y2 + py }, { x: x2 - px, y: y2 - py }, { x: x1 - px, y: y1 - py }], true);
    } else {
      const R = e.def.reach;
      g.fillStyle(0xd04a3a, 0.16).fillEllipse(e.x, e.y, R * 2, R * 2 / 1.6);
      g.fillStyle(0xd04a3a, 0.32).fillEllipse(e.x, e.y, R * 2 * k, (R * 2 / 1.6) * k);
      g.lineStyle(2, 0x8a1f16, 0.85).strokeEllipse(e.x, e.y, R * 2, R * 2 / 1.6);
    }
  }

  private moveToward(e: Enemy, tx: number, ty: number, speed: number, dt: number, keep = 0) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
    if (d <= keep + 1) return;
    const step = Math.min(d - keep, speed * dt);
    const nx = e.x + (dx / d) * step, ny = e.y + (dy / d) * step;
    if (this.host.nav.freeAt(nx, ny)) { e.x = nx; e.y = ny; }
    else if (this.host.nav.freeAt(nx, e.y)) e.x = nx;
    else if (this.host.nav.freeAt(e.x, ny)) e.y = ny;
    // séparation entre ennemis
    for (const o of this.enemies) { if (o === e || !o.alive) continue; const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy); if (od < 40 && od > 0.1) { e.x += (ox / od) * (40 - od) * 0.2; e.y += (oy / od) * (40 - od) * 0.2; } }
  }
}
