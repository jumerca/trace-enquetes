// Génère toutes les textures procédurales (personnages, créatures, effets) avec une barre de progression.
import Phaser from 'phaser';
import { buildSheet, shadowTexture, type Sheet, type AnimName } from '../art/characters';
import { ronceuxSheet, murmureSheet, animalsSheet, fxTextures, gardienSheet } from '../art/creatures';
import { ELOI, CAST } from '../data/cast';

export function registerSheet(scene: Phaser.Scene, key: string, sh: Sheet) {
  const tex = scene.textures.addCanvas(key, sh.canvas)!;
  for (const f of sh.frames) tex.add(f.name, 0, f.x, f.y, f.w, f.h);
  for (const a of sh.anims) if (!scene.anims.exists(a.key)) scene.anims.create({ key: a.key, frames: a.frames.map((n) => ({ key, frame: n })), frameRate: a.rate, repeat: a.loop ? -1 : 0 });
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export class BootScene extends Phaser.Scene {
  constructor() { super('boot'); }
  async create() {
    const S = this.registry.get('S') as number;
    const bar = document.querySelector<HTMLElement>('#boot .boot-bar i');
    const msg = document.querySelector<HTMLElement>('#boot .boot-msg');
    const jobs: [string, () => void][] = [
      ['Encre et papier…', () => { this.textures.addCanvas('shadow', shadowTexture(S)); for (const [k, c] of Object.entries(fxTextures(S))) this.textures.addCanvas('fx_' + k, c); }],
      ['Les créatures du Bois…', () => { registerSheet(this, 'ronceux', ronceuxSheet(S)); registerSheet(this, 'ronceux_ancien', ronceuxSheet(S, true)); registerSheet(this, 'murmure', murmureSheet(S)); registerSheet(this, 'gardien', gardienSheet(S)); registerSheet(this, 'animals', animalsSheet(S)); }],
      ['Éloi prépare sa sacoche…', () => registerSheet(this, 'eloi', buildSheet(ELOI, ['idle', 'fidget', 'walk', 'run', 'talk', 'inspect', 'atlas', 'attack', 'hurt'], S))],
      ...Object.values(CAST).map((c) => [`Les habitants de Clairval… (${c.id})`, () => registerSheet(this, c.id, buildSheet(c, ['idle', 'walk', 'talk', 'work'] as AnimName[], S))] as [string, () => void]),
    ];
    try { await Promise.race([Promise.all([document.fonts.load('20px Alegreya'), document.fonts.load('20px "Alegreya SC"')]), new Promise((r) => setTimeout(r, 1500))]); } catch { /* police de secours */ }
    for (let i = 0; i < jobs.length; i++) {
      if (msg) msg.textContent = jobs[i][0];
      jobs[i][1]();
      if (bar) bar.style.width = `${Math.round(((i + 1) / jobs.length) * 100)}%`;
      await tick();
    }
    this.game.events.emit('booted');
  }
}
