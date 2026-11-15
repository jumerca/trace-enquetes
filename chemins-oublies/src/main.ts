// Point d'entrée : Phaser + interface DOM + PWA (installation, hors ligne, mises à jour).
import '@fontsource/alegreya/latin-400.css';
import '@fontsource/alegreya/latin-400-italic.css';
import '@fontsource/alegreya/latin-700.css';
import '@fontsource/alegreya-sc/latin-400.css';
import '@fontsource/alegreya-sc/latin-700.css';
import './ui/style.css';
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { ui } from './ui/UI';
import { newGame, setState, S } from './core/state';
import { readSlot, writeSlot, mostRecentSlot, saveSettings } from './systems/SaveManager';
import { resetFog } from './systems/Atlas';
import { audio } from './systems/Audio';
import { ZONES } from './world/zones';
import { ROUTINES } from './data/npcs';

const settings = ui.settings;
const Q = { haute: { S: 2, rs: 2, g: 1 }, moyenne: { S: 1.5, rs: 1.5, g: 0.8 }, basse: { S: 1, rs: 1, g: 0.6 } }[settings.quality];
const renderScale = Math.max(1, Math.min(window.devicePixelRatio || 1, Q.rs));
audio.setVolumes(settings.music, settings.sfx);

ui.init();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: Math.round(innerWidth * renderScale),
  height: Math.round(innerHeight * renderScale),
  backgroundColor: '#1a120e',
  scale: { mode: Phaser.Scale.NONE },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  input: { activePointers: 3 },
  banner: false,
  scene: [BootScene, GameScene],
});
game.registry.set('S', Q.S);
game.registry.set('renderScale', renderScale);
game.registry.set('groundScale', Q.g);

function resize() {
  game.scale.resize(Math.round(innerWidth * renderScale), Math.round(innerHeight * renderScale));
  game.canvas.style.width = innerWidth + 'px';
  game.canvas.style.height = innerHeight + 'px';
  game.scale.refresh();
}
addEventListener('resize', resize);
addEventListener('orientationchange', () => setTimeout(resize, 200));

function startScene(data: object) {
  resetFog();
  const sc = game.scene.getScene('game');
  if (sc && game.scene.isActive('game')) game.scene.stop('game');
  game.scene.start('game', { settings, ...data });
}

function toHome() {
  ui.attachGame(null);
  const demo = newGame(); demo.clock = 17.6 * 60; demo.x = 1300; demo.y = 1150;
  setState(demo);
  startScene({ slot: -1, attract: true });
  ui.showHome({
    canContinue: () => mostRecentSlot() >= 0,
    onContinue: () => { const i = mostRecentSlot(); if (i >= 0) play(i); },
    onLoad: (i) => play(i),
    onNew: (i) => { const st = newGame(); setState(st); writeSlot(i, st); settings.lastSlot = i; saveSettings(settings); ui.hideHome(); startScene({ slot: i }); ui.refreshPortraitWarn(); },
  });
}

function play(i: number) {
  const r = readSlot(i);
  if (!r.state) { ui.toast('Cette sauvegarde est illisible.', 'info'); return; }
  if (r.fromBackup) ui.toast('Sauvegarde restaurée depuis la copie de secours.', 'info');
  setState(r.state);
  settings.lastSlot = i; saveSettings(settings);
  ui.hideHome();
  startScene({ slot: i });
  setTimeout(() => ui.refreshPortraitWarn(), 100);
}

ui.onQuitToHome = () => toHome();

game.events.once('booted', () => {
  resize();
  document.getElementById('boot')?.classList.add('done');
  setTimeout(() => document.getElementById('boot')?.remove(), 800);
  toHome();
});

// Sauvegarde de sécurité quand l'application passe en arrière-plan.
document.addEventListener('visibilitychange', () => {
  const g = game.scene.getScene('game') as GameScene | null;
  if (document.hidden && g && game.scene.isActive('game') && !g.attract && g.slot >= 0) writeSlot(g.slot, S);
});

// ---- PWA
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); ui.installEvt = e; if (!document.getElementById('home')?.classList.contains('hidden')) toHome(); });
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    ui.swReg = reg;
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) ui.toast('Une nouvelle version est prête : Options → Rechercher les mises à jour.', 'info'); });
    });
    // vérification discrète au lancement
    setTimeout(() => reg.update().catch(() => {}), 4000);
  }).catch(() => {});
}

// Outils de test (recette automatisée) : accès en lecture à l'état et à la scène.
(window as any).__co = { game, get S() { return S; }, ui, scene: () => game.scene.getScene('game'), zones: ZONES, routines: ROUTINES };
