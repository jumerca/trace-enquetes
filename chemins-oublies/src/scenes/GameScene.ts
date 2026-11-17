// Scène de jeu : WorldManager (zones, décors, transitions), déplacement au toucher, interactions,
// caméra, lumière du jour, vie du monde. Implémente l'API utilisée par les scripts et dialogues.
import Phaser from 'phaser';
import { S, ZoneId, Dir, flag, setFlag, has, addItem, removeItem, addClue, addNote, addTrace, addSecret, phaseOf, Settings } from '../core/state';
import { ZONES, ZONE_LABEL } from '../world/zones';
import { evalCond, ZoneDef, PropDef, Pt } from '../world/types';
import { propTex } from '../world/textures';
import { paintChunk, paintRouteLayer, CHUNK, samplePolyline } from '../art/ground';
import { NavGrid } from '../systems/Navigation';
import { Actor } from '../systems/Actor';
import { NPCManager, Npc } from '../systems/NPCManager';
import { Combat, Enemy } from '../systems/Combat';
import { OBJECTS, ObjDef, ENCOUNTERS } from '../data/objects';
import { SCRIPTS } from '../systems/Scripts';
import { DIALOGS, Line, FETE } from '../data/dialogues';
import { MEMORIES } from '../data/memories';
import { MAIN, SIDE, currentMainStep } from '../data/story';
import { ITEMS } from '../data/items';
import { BORNE_POS, STONES, stoneLit, stepMill, BORNE_IDS } from '../systems/Puzzles';
import { revealAround } from '../systems/Atlas';
import { audio } from '../systems/Audio';
import { Atmosphere, applyCameraFX } from '../systems/Atmosphere';
import { Boss, ARENA } from '../systems/Boss';
import { writeSlot } from '../systems/SaveManager';
import type { Api } from '../systems/api';
import { ui } from '../ui/UI';
import { NpcId, isFete } from '../data/npcs';
import { CLUES, NOTES } from '../data/story';

const CLOCK_RATE = 1.5; // minutes de jeu par seconde
const WALK = 132, RUN = 215;

interface PropRt { def: PropDef; img: Phaser.GameObjects.Image; x0: number; y0: number; x1: number; y1: number; alpha: number }
type Target = { kind: 'npc'; npc: Npc } | { kind: 'obj'; obj: ObjDef } | { kind: 'enemy'; e: Enemy } | { kind: 'boss' } | { kind: 'cut'; img: Phaser.GameObjects.Image } | { kind: 'point' };

export class GameScene extends Phaser.Scene implements Api {
  zone!: ZoneDef;
  nav!: NavGrid;
  S_ = 2;
  groundScale = 1;
  hero!: Actor;
  npcs!: NPCManager;
  combat!: Combat;
  slot = 0;
  settings!: Settings;
  private zoneObjs: Phaser.GameObjects.GameObject[] = [];
  private staticObjs: Phaser.GameObjects.GameObject[] = [];
  private groundKeys: string[] = [];
  private props: PropRt[] = [];
  private objs: ObjDef[] = [];
  private path: Pt[] = [];
  private target: Target | null = null;
  private repathT = 0;
  private blockedT = 0;
  private idleT = 0;
  private busyUntil = 0;
  private busy = false;
  private memActors: Actor[] = [];
  /** Après un travelling scénarisé, la caméra garde son cadrage jusqu'à la fin de la scène. */
  private camHold = false;
  private pendingMem: string | null = null;
  private attackT = 0;
  private hurtT = 0;
  private inv = 0;
  private stepT = 0;
  private camX = 0; private camY = 0;
  private vx = 0; private vy = 0;
  private userZoom = 1;
  private light!: Phaser.GameObjects.Rectangle;
  private glows: Phaser.GameObjects.Image[] = [];
  private arrows: Phaser.GameObjects.Image[] = [];
  private stoneImgs = new Map<string, Phaser.GameObjects.Image>();
  private wheel: Phaser.GameObjects.Image | null = null;
  private wheelSpeed = 0;
  private waterFx: { ch: string; g: Phaser.GameObjects.Graphics }[] = [];
  private gauge: Phaser.GameObjects.Graphics | null = null;
  private sluices: Record<string, Phaser.GameObjects.Image> = {};
  private label!: Phaser.GameObjects.Text;
  private labelT = 0;
  private bubbles = new Map<string, Phaser.GameObjects.Image>();
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch: { d: number; z: number; mx: number; my: number } | null = null;
  private gesture: { id: number; sx: number; sy: number; lx: number; ly: number; wx: number; wy: number; t: number; mode: 'pending' | 'pan' | 'walk' } | null = null;
  private walkHold = false;
  camFree = false;
  private dragT = 0;
  private transitioning = false;
  private fogT = 0;
  private lastStep = '';
  private sideState = '';
  private engaged = false;
  private cullT = 0;
  private routeLayer: Phaser.GameObjects.Image | null = null;
  private exitMsgT = 0;
  selectedItem: string | null = null;
  atmo!: Atmosphere;
  boss: Boss | null = null;
  bossActive = false;
  private bossRing: Phaser.GameObjects.Image[] = [];
  private hearts: Phaser.GameObjects.Image[] = [];
  private hitStop = 0;
  private dodgeT = 0;
  private dodgeCd = 0;
  private dodgeV: [number, number] = [0, 0];
  private cut = new Set<string>();
  private fpsT = 0;
  private fpsN = 0;
  private fxDowngraded = false;

  constructor() { super('game'); }

  attract = false;
  private attractT = 0;

  init(data: { slot: number; settings: Settings; attract?: boolean }) {
    this.slot = data.slot; this.settings = data.settings; this.attract = !!data.attract;
    this.S_ = this.registry.get('S') ?? 2;
    this.groundScale = this.registry.get('groundScale') ?? 1;
  }

  create() {
    this.npcs = new NPCManager(this, this.S_);
    this.atmo = new Atmosphere(this);
    this.combat = new Combat(this, {
      nav: null as any,
      heroPos: () => [this.hero.x, this.hero.y],
      heroHit: (d, x, y) => this.heroHit(d, x, y),
      settings: () => this.settings,
      onEncounterDone: (id) => this.encounterDone(id),
      onKill: (x, y) => { if (Math.random() < 0.5) this.dropHeart(x, y); },
      onEngage: (a) => { this.engaged = a; ui.setDodge(a || this.bossActive); if (a) this.recenter(); ui.setDanger(a); audio.play(a ? 'danger' : ZONES[S.zone].music); },
    }, this.S_);
    Object.defineProperty((this.combat as any).host, 'nav', { get: () => this.nav });
    this.hero = new Actor(this, 'eloi', S.x, S.y, this.S_);
    this.label = this.add.text(0, 0, '', { fontFamily: 'Alegreya, serif', fontSize: '15px', color: '#fff6dc', stroke: '#2b1e16', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(2e7).setVisible(false).setResolution(2);
    this.light = this.add.rectangle(0, 0, 10, 10, 0xffffff).setOrigin(0).setDepth(1e7).setBlendMode(Phaser.BlendModes.MULTIPLY);
    if (this.attract) {
      this.hero.setVisible(false);
      this.loadZone(S.zone, S.x, S.y, S.facing);
      this.cameras.main.fadeIn(900, 20, 14, 10);
      this.scale.on('resize', () => this.applyZoom());
      this.events.on('shutdown', () => { this.npcs.clear(); this.combat.clear(); this.clearZone(); });
      return;
    }
    this.setupInput();
    ui.attachGame(this);
    this.lastStep = currentMainStep()?.id ?? 'fin';
    this.sideState = this.sideSig();
    this.loadZone(S.zone, S.x, S.y, S.facing);
    this.cameras.main.fadeIn(500, 20, 14, 10);
    this.scale.on('resize', () => this.applyZoom());
    this.events.on('shutdown', () => { this.npcs.clear(); this.combat.clear(); this.clearZone(); });
    if (!flag('intro_vue')) this.time.delayedCall(700, () => this.intro());
  }

  /** Ce qu'Éloi pense en découvrant un lieu pour la première fois. */
  private firstVisit(id: ZoneId) {
    const T: Partial<Record<ZoneId, Line[]>> = {
      bois: [
        { s: 'eloi', t: "Le Bois des Murmures. On dirait que les arbres se penchent pour écouter ce qu'on dit." },
        { s: 'eloi', t: "Maëlys disait : « Dans un bois qui change, ne regarde pas les sentiers, regarde la lumière. » Facile à dire quand on n'a pas peur du noir.", m: 'souci' },
      ],
      moulin: [
        { s: 'eloi', t: "Le Moulin des Trois-Eaux… Il existe vraiment. À Valrive, personne ne m'aurait cru.", m: 'surprise' },
        { s: 'eloi', t: "Maëlys, tu es venue jusqu'ici. Je le sens. Il y a encore l'odeur de ton encre partout dans cette histoire." },
      ],
      archives: [{ s: 'eloi', t: "Des cartes du sol au plafond. Maëlys a dû se sentir chez elle ici. Moi, j'ai peur d'éternuer." }],
    };
    const lines = T[id];
    if (!lines || flag('vu_zone_' + id)) return;
    setFlag('vu_zone_' + id);
    this.time.delayedCall(1100, async () => {
      if (this.busy || ui.isModal()) return;
      this.busy = true;
      try { await this.say(lines); } finally { this.busy = false; }
    });
  }

  // ============================================================== souvenirs
  /** Flash-back sépia : Maëlys (et Éloi enfant) apparaissent autour d'Éloi le temps d'un souvenir. */
  async playMemory(id: string) {
    const m = MEMORIES[id];
    if (!m || flag('mem_' + id) || this.attract) return;
    setFlag('mem_' + id);
    const wasBusy = this.busy; this.busy = true;
    this.path = []; this.target = null; this.hero.play('idle', true);
    const cam = this.cameras.main;
    const hx = this.hero.x, hy = this.hero.y;
    audio.sfx('page');
    cam.flash(900, 255, 238, 205);
    await this.wait(300);
    const pfx = (cam as any).postFX as Phaser.GameObjects.Components.FX | undefined;
    let cm: any = null;
    if (pfx && this.game.renderer.type === Phaser.WEBGL) { cm = pfx.addColorMatrix(); cm.sepia(); }
    const veil = this.add.rectangle(hx, hy, 8000, 8000, 0xf3e2c0, cm ? 0.16 : 0.34).setDepth(1.6e7).setBlendMode(cm ? Phaser.BlendModes.NORMAL : Phaser.BlendModes.MULTIPLY);
    ui.setMemory(true);
    const hidden: Actor[] = [];
    for (const n of this.npcs.npcs.values()) { if (n.actor.sprite.visible) { n.actor.setVisible(false); hidden.push(n.actor); } }
    if (m.child) this.hero.setVisible(false);
    else this.hero.faceToward(hx + 40, hy);
    for (const c of m.cast) {
      const a = new Actor(this, c.id, hx + c.dx, hy + c.dy, this.S_);
      a.setPos(hx + c.dx, hy + c.dy);
      a.sprite.setAlpha(0); a.shadow.setAlpha(0);
      this.tweens.add({ targets: [a.sprite, a.shadow], alpha: 1, duration: 600 });
      this.memActors.push(a);
    }
    for (const a of this.memActors) { const o = this.memActors.find((b) => b !== a); if (o) a.faceToward(o.x, o.y); else a.faceToward(hx, hy); }
    await this.pan([hx, hy - 30], 500, 200);
    await this.say(m.lines);
    cam.flash(900, 255, 238, 205);
    await this.wait(250);
    this.memActors.forEach((a) => a.destroy()); this.memActors = [];
    veil.destroy();
    if (cm && pfx) pfx.remove(cm);
    ui.setMemory(false);
    hidden.forEach((a) => a.setVisible(true));
    this.hero.setVisible(true); this.hero.play('idle', true);
    this.camX = this.hero.x; this.camY = this.hero.y;
    await this.wait(350);
    await this.say(m.after);
    this.run([`note:${m.note}`, `log:Souvenir : ${NOTES[m.note]?.title.replace('Souvenir : ', '') ?? id}.`]);
    this.save('souvenir');
    this.busy = wasBusy;
  }

  private async intro() {
    setFlag('intro_vue');
    await this.say([
      { s: 'narr', t: "Clairval. Un village au creux de la vallée, entre la rivière et le Bois des Murmures." },
      { s: 'eloi', t: "La dernière lettre de Maëlys venait d'ici. « Si je ne reviens pas, prends l'atlas et suis les chemins que personne ne voit. »" },
      { s: 'eloi', t: "Six mois sans nouvelles. Et la dernière fois qu'on s'est parlé, je lui ai crié dessus.", m: 'souci' },
      { s: 'eloi', t: "Elle a toujours aimé les phrases mystérieuses. Moi, j'aime les cartes qui ont une légende." },
      { s: 'eloi', t: "Bon. Un cartographe qui se lamente, c'est un cartographe qui ne marche pas. Commençons par regarder autour de nous." },
    ]);
    ui.tutorial();
  }

  // ============================================================== zones
  private clearZone() {
    this.atmo?.clear();
    this.zoneObjs.forEach((o) => o.destroy()); this.zoneObjs = [];
    this.staticObjs.forEach((o) => o.destroy()); this.staticObjs = [];
    this.props = []; this.glows = []; this.arrows = []; this.stoneImgs.clear(); this.waterFx = []; this.sluices = {};
    this.wheel = null; this.gauge = null; this.routeLayer = null;
    this.bubbles.forEach((b) => b.destroy()); this.bubbles.clear();
    for (const k of this.groundKeys) this.textures.remove(k);
    this.groundKeys = [];
    this.tweens.killAll();
  }

  loadZone(id: ZoneId, x?: number, y?: number, facing?: Dir) {
    this.clearZone();
    this.cut.clear();
    this.npcs.clear(); this.combat.clear();
    const z = ZONES[id];
    this.zone = z;
    S.zone = id;
    this.nav = new NavGrid(z, flag);
    // sol
    const gs = this.groundScale;
    for (let cy = 0; cy < z.h; cy += CHUNK) for (let cx = 0; cx < z.w; cx += CHUNK) {
      const key = `g_${id}_${cx}_${cy}_${Date.now() % 100000}`;
      this.textures.addCanvas(key, paintChunk(z, cx, cy, gs, flag));
      this.groundKeys.push(key);
      this.zoneObjs.push(this.add.image(cx, cy, key).setOrigin(0).setScale(1 / gs).setDepth(-1e6));
    }
    if (flag('route_revealed')) this.addRouteLayer(1);
    this.buildStatic();
    this.objs = OBJECTS.filter((o) => o.zone === id);
    this.npcs.spawn(id);
    this.combat.spawnZone(id);
    this.boss?.destroy(); this.boss = null; this.bossActive = false; this.bossRing = []; this.hearts = []; ui.bossBar(null);
    if (id === 'moulin' && flag('stones_solved') && !flag('boss_done')) this.boss = new Boss(this, (this.combat as any).host, this.S_);
    this.ambient();
    this.atmo.build(z, this.settings.quality);
    applyCameraFX(this.cameras.main, this.fxDowngraded ? 'moyenne' : this.settings.quality, !!z.interior);
    // caméra
    const cam = this.cameras.main;
    cam.setBackgroundColor(z.interior ? '#1a120e' : '#3f6b3a');
    this.applyZoom();
    const px = x ?? S.x, py = y ?? S.y;
    this.hero.setPos(px, py);
    this.hero.face(facing ?? S.facing);
    this.hero.play('idle', true);
    this.path = []; this.target = null; this.camFree = false; if (!this.attract) ui.setFreeCam(false);
    this.camX = px; this.camY = py; cam.centerOn(px, py);
    S.x = px; S.y = py;
    S.checkpoint = { zone: id, x: px, y: py };
    audio.play(this.attract ? 'titre' : z.music);
    if (!this.attract) ui.zoneName(ZONE_LABEL[id]);
    revealAround(id, px, py);
    if (!this.attract) this.firstVisit(id);
  }

  private propImage(def: PropDef): Phaser.GameObjects.Image {
    const key = 'p:' + def.tex + '@' + this.S_;
    const t = propTex(def.tex, this.S_);
    if (!this.textures.exists(key)) this.textures.addCanvas(key, t.canvas);
    const img = this.add.image(def.x, def.y, key).setOrigin(t.ax, t.ay).setScale(1 / this.S_);
    img.setDepth(def.ground ? -5e5 + def.y : def.y + (def.depth ?? 0));
    if (def.flipX) img.setFlipX(true);
    return img;
  }

  /** Décors dépendants des drapeaux (ronces, brume, coffres…) + mécanismes. */
  buildStatic() {
    this.staticObjs.forEach((o) => o.destroy()); this.staticObjs = [];
    this.props = []; this.arrows = []; this.stoneImgs.clear(); this.waterFx = []; this.sluices = {}; this.wheel = null; this.gauge = null; this.glows = [];
    const z = this.zone;
    const lowQ = this.settings.quality === 'basse';
    for (const def of z.props) {
      if (!evalCond(def.cond, flag)) continue;
      if (def.id?.startsWith('vanne')) continue;
      const img = this.propImage(def);
      this.staticObjs.push(img);
      const w = img.displayWidth, h = img.displayHeight;
      const rt: PropRt = { def, img, x0: def.x - w * img.originX, y0: def.y - h * img.originY, x1: def.x + w * (1 - img.originX), y1: def.y + h * (1 - img.originY) - 6, alpha: 1 };
      this.props.push(rt);
      if (def.sway && !lowQ) this.tweens.add({ targets: img, angle: { from: -0.6, to: 0.6 }, duration: 2200 + ((def.x * 7) % 1500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (def.smoke && !lowQ) this.smoke(def.x + def.smoke[0], def.y + def.smoke[1]);
      if (def.id?.startsWith('pierre_')) this.stoneImgs.set(def.id.slice(7), img);
      if (def.tex === 'lamp') this.glow(def.x, def.y - 79, 0.9);
      if (def.tex === 'fire' || def.tex === 'fireplace') this.glow(def.x, def.y - 20, 1.4, true);
      if (def.tex.startsWith('house:')) this.glow(def.x, def.y - 40, 1.6);
      if (def.tex.startsWith('tall:') && this.cut.has(`${z.id}:${def.x}:${def.y}`)) img.setVisible(false).setAlpha(0);
      if (def.tex === 'laundry' && !lowQ) this.tweens.add({ targets: img, scaleX: { from: img.scaleX, to: img.scaleX * 0.98 }, duration: 900, yoyo: true, repeat: -1 });
    }
    // flèches des bornes
    if (z.id === 'clairval') BORNE_IDS.forEach((id, i) => {
      const [x, y] = BORNE_POS[id];
      const k = 'p:arrow@' + this.S_;
      if (!this.textures.exists(k)) this.textures.addCanvas(k, propTex('arrow', this.S_).canvas);
      const a = this.add.image(x, y - 50, k).setScale(1 / this.S_, 0.55 / this.S_).setDepth(y + 1);
      a.setRotation(0);
      this.staticObjs.push(a); this.arrows.push(a);
      this.drawArrow(i);
    });
    // paillassons devant les portes : on voit où l'on peut entrer
    if (!z.interior) for (const e of z.exits) {
      if (!e.door) continue;
      const m = this.propImage({ tex: 'mat', x: e.rect.x + e.rect.w / 2, y: e.rect.y + 22, ground: true });
      this.staticObjs.push(m);
    }
    if (z.id === 'bois') this.updateStones();
    if (z.id === 'moulin') this.buildMill();
  }

  /** Une flèche « posée à plat » : on simule la rotation dans le plan du sol (vue plongeante). */
  private drawArrow(i: number) {
    const a = this.arrows[i]; if (!a) return;
    const ang = (S.bornes[i] * Math.PI) / 4;
    a.setRotation(Math.atan2(Math.sin(ang) * 0.55, Math.cos(ang)));
    const k = Math.hypot(Math.cos(ang), Math.sin(ang) * 0.55);
    a.setScale((1 / this.S_) * k, (0.55 / this.S_) * (1 / Math.max(0.55, k)));
    a.setTint(flag('bornes_solved') ? 0xffe08a : 0xffffff);
  }

  private updateStones() {
    for (const s of STONES) {
      const img = this.stoneImgs.get(s.sym); if (!img) continue;
      const lit = flag('stones_solved') ? s.sym !== 'lune' : stoneLit(s.sym);
      const key = 'p:stone:' + s.sym + (lit ? ':lit' : '') + '@' + this.S_;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, propTex('stone:' + s.sym + (lit ? ':lit' : ''), this.S_).canvas);
      img.setTexture(key);
    }
  }

  private buildMill() {
    const m = S.mill;
    const key = 'p:wheel@' + this.S_;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, propTex('wheel', this.S_).canvas);
    this.wheel = this.add.image(1450, 845, key).setScale(1 / this.S_).setDepth(905);
    this.staticObjs.push(this.wheel);
    this.wheelSpeed = m.solved ? 1.1 : 0;
    for (const ch of ['bief', 'decharge', 'fuite', 'prise']) { const g = this.add.graphics().setDepth(-4e5); this.staticObjs.push(g); this.waterFx.push({ ch, g }); }
    this.gauge = this.add.graphics().setDepth(470); this.staticObjs.push(this.gauge);
    for (const [id, x, y, v] of [['vanne1_s', 1745, 418, 'v1'], ['vanne2_s', 1470, 606, 'v2'], ['vanne3_s', 1450, 800, 'v3']] as [string, number, number, 'v1' | 'v2' | 'v3'][]) {
      const img = this.add.image(x, y, '__DEFAULT').setDepth(y + (id === 'vanne3_s' ? -40 : 10));
      this.staticObjs.push(img); this.sluices[v] = img;
    }
    for (const [id, x, y] of [['levier1', 1640, 335], ['levier2', 1395, 600], ['levier3', 1395, 760]] as [string, number, number][]) {
      const img = this.add.image(x, y, '__DEFAULT').setDepth(y); img.setData('lever', id); this.staticObjs.push(img); this.sluices[id] = img;
    }
    this.refreshMill();
  }

  private texFor(k: string) { const key = 'p:' + k + '@' + this.S_; if (!this.textures.exists(key)) this.textures.addCanvas(key, propTex(k, this.S_).canvas); return key; }

  private refreshMill() {
    const m = S.mill;
    const setT = (img: Phaser.GameObjects.Image | undefined, k: string) => { if (!img) return; const t = propTex(k, this.S_); img.setTexture(this.texFor(k)).setOrigin(t.ax, t.ay).setScale(1 / this.S_); };
    setT(this.sluices.v1, `sluice:${m.v1 ? 'open' : 'closed'}`);
    setT(this.sluices.v2, `sluice:${m.v2 ? 'open' : 'closed'}`);
    setT(this.sluices.v3, `sluice:${m.v3 || m.solved ? 'open' : 'closed'}`);
    setT(this.sluices.levier1, `lever:${m.v1 ? 'on' : 'off'}:3d6a8a`);
    setT(this.sluices.levier2, `lever:${m.v2 ? 'on' : 'off'}:c08a3a`);
    setT(this.sluices.levier3, `lever:${m.v3 || m.solved ? 'on' : 'off'}:7a3f2a`);
  }

  private drawMillWater(t: number) {
    const m = S.mill;
    const z = this.zone;
    for (const { ch, g } of this.waterFx) {
      g.clear();
      let pts: Pt[] | undefined; let w = 30; let flow = 0; let fill = 0;
      if (ch === 'prise') { pts = [[1800, 405], [1752, 400]]; w = 30; flow = m.v1 ? 1 : 0; fill = flow; }
      else { const wd = z.water.find((q) => q.channel === ch); if (!wd) continue; pts = wd.pts; w = wd.w - 6; }
      if (ch === 'bief') { fill = m.level; flow = m.v1 || m.v3 ? 1 : 0.3; }
      if (ch === 'decharge') { flow = m.v2 && m.level > 0.02 ? 1 : 0; fill = flow; }
      if (ch === 'fuite') { flow = m.solved || (m.v3 && m.level > 0.02) ? 1 : 0; fill = flow; }
      if (fill <= 0.01 || !pts) continue;
      const smooth = (lw: number, col: number, a: number) => { g.lineStyle(lw, col, a); g.beginPath(); g.moveTo(pts![0][0], pts![0][1]); for (let i = 1; i < pts!.length; i++) g.lineTo(pts![i][0], pts![i][1]); g.strokePath(); };
      smooth(w * (0.4 + 0.6 * fill), 0x3f6f8f, 0.95);
      smooth(w * (0.25 + 0.4 * fill), 0x5f97b6, 0.9);
      if (flow > 0) {
        const sp = samplePolyline(pts, 18);
        for (let i = 0; i < sp.length; i++) {
          const ph = ((t * 0.0016 * flow) + i * 0.37) % 1;
          if (ph > 0.5) continue;
          const [x, y] = sp[i];
          g.lineStyle(2, 0xffffff, 0.55 * (1 - ph * 2)); g.beginPath(); g.moveTo(x - 5, y + (i % 2 ? 3 : -3)); g.lineTo(x + 5, y + (i % 2 ? 3 : -3)); g.strokePath();
        }
      }
    }
    // chute d'eau sur la roue
    if (this.gauge) {
      const g = this.gauge; g.clear();
      g.fillStyle(0x6b4a30, 1).fillRect(1472, 420, 10, 60); g.lineStyle(1.5, 0x2b1e16, 1).strokeRect(1472, 420, 10, 60);
      g.fillStyle(0x5f97b6, 1).fillRect(1474, 478 - 56 * m.level, 6, 56 * m.level);
      for (let k = 0; k <= 4; k++) g.lineStyle(1, 0xf4ecd8, 0.9).lineBetween(1472, 422 + k * 14, 1478, 422 + k * 14);
      if (m.solved || (m.v3 && m.level > 0.02)) {
        for (let i = 0; i < 6; i++) { const yy = 775 + ((t * 0.25 + i * 13) % 70); g.lineStyle(3, 0xbfe0f0, 0.7).lineBetween(1440 + (i % 3) * 7, yy, 1442 + (i % 3) * 7, yy + 9); }
      }
    }
  }

  private glow(x: number, y: number, size: number, warm = false) {
    const img = this.add.image(x, y, 'fx_soft').setScale(size * 3).setDepth(1e7 + 1).setBlendMode(Phaser.BlendModes.ADD).setTint(warm ? 0xffa040 : 0xffd080).setAlpha(0);
    this.staticObjs.push(img); this.glows.push(img);
  }

  private smoke(x: number, y: number) {
    const p = this.add.particles(x, y, 'fx_soft', { lifespan: 3200, speedY: { min: -26, max: -16 }, speedX: { min: 4, max: 12 }, scale: { start: 0.5, end: 1.6 }, alpha: { start: 0.35, end: 0 }, tint: 0xd8d4cc, frequency: 420 });
    p.setDepth(y - 200 > 0 ? 9e6 : 9e6);
    this.staticObjs.push(p);
  }

  private addRouteLayer(alpha: number) {
    const r = paintRouteLayer(this.zone, this.groundScale);
    if (!r) return;
    const key = `route_${this.zone.id}_${Date.now() % 100000}`;
    this.textures.addCanvas(key, r.canvas); this.groundKeys.push(key);
    this.routeLayer = this.add.image(r.x, r.y, key).setOrigin(0).setScale(1 / this.groundScale).setDepth(-9e5).setAlpha(alpha);
    this.zoneObjs.push(this.routeLayer);
  }

  /** Vie du monde : oiseaux, papillons, animaux, feuilles, lucioles, rides sur l'eau. */
  private ambient() {
    const z = this.zone; const q = this.settings.quality;
    if (z.interior) {
      const dust = this.add.particles(0, 0, 'fx_soft', { x: { min: 60, max: 660 }, y: { min: 200, max: 480 }, lifespan: 6000, speedY: { min: -4, max: 4 }, speedX: { min: -4, max: 4 }, scale: { start: 0.06, end: 0.04 }, alpha: { start: 0, end: 0.5, ease: 'Sine.easeInOut' }, tint: 0xffe9b0, frequency: q === 'basse' ? 900 : 300, blendMode: 'ADD' });
      dust.setDepth(9e6); this.zoneObjs.push(dust);
      return;
    }
    const n = q === 'basse' ? 0.4 : q === 'moyenne' ? 0.7 : 1;
    const rnd = new Phaser.Math.RandomDataGenerator([z.id]);
    const wander = (sprite: Phaser.GameObjects.Sprite, cx: number, cy: number, r: number, dur: number) => {
      const go = () => { if (!sprite.active) return; const tx = cx + rnd.between(-r, r), ty = cy + rnd.between(-r * 0.6, r * 0.6); sprite.setFlipX(tx < sprite.x); this.tweens.add({ targets: sprite, x: tx, y: ty, duration: dur * (0.7 + rnd.frac() * 0.6), ease: 'Sine.easeInOut', onUpdate: () => sprite.setDepth(sprite.y + 60), onComplete: go }); };
      go();
    };
    const sc = 1 / this.S_;
    if (z.id !== 'bois') for (let i = 0; i < Math.round(8 * n); i++) {
      const x = rnd.between(200, z.w - 200), y = rnd.between(300, z.h - 200);
      if (!this.nav.freeAt(x, y)) continue;
      const b = this.add.sprite(x, y, 'animals').setScale(sc).play(i % 2 ? 'animals_bfly_a' : 'animals_bfly_b'); b.anims.setProgress(rnd.frac());
      this.zoneObjs.push(b); wander(b, x, y, 90, 2500);
    }
    if (z.id === 'bois') {
      for (const [x, y] of [[600, 1950], [2600, 900], [2700, 2100]] as Pt[]) { const d = this.add.sprite(x, y, 'animals').setScale(sc).play('animals_deer_graze').setDepth(y); this.zoneObjs.push(d); }
      for (const [x, y] of [[1420, 2120], [800, 1200], [2000, 1800], [1500, 700]] as Pt[]) { const r = this.add.sprite(x, y, 'animals').setScale(sc).play('animals_rabbit'); this.zoneObjs.push(r); wander(r, x, y, 70, 1800); }
      const leaves = this.add.particles(0, 0, 'fx_leaf', { x: { min: 0, max: z.w }, y: { min: 0, max: z.h }, lifespan: 7000, speedY: { min: 12, max: 26 }, speedX: { min: -14, max: 14 }, rotate: { start: 0, end: 360 }, scale: { start: 1 / this.S_, end: 1 / this.S_ }, alpha: { start: 0.9, end: 0 }, frequency: 60 / n, quantity: 1 });
      leaves.setDepth(8e6); this.zoneObjs.push(leaves);
    }
    if (z.id === 'moulin') for (const [x, y] of [[1730, 1500], [1780, 1600], [1720, 700]] as Pt[]) { const d = this.add.sprite(x, y, 'animals').setScale(sc).play('animals_duck'); this.zoneObjs.push(d); wander(d, x, y, 30, 4000); }
    // oiseaux qui traversent le ciel
    const bird = () => {
      if (!this.scene.isActive() || this.zone !== z) return;
      const cam = this.cameras.main.worldView;
      const y = cam.y + rnd.between(40, cam.height * 0.6), fromL = rnd.frac() < 0.5;
      const b = this.add.sprite(fromL ? cam.x - 40 : cam.right + 40, y, 'animals').setScale(sc).play('animals_bird').setDepth(9.5e6).setFlipX(!fromL);
      this.zoneObjs.push(b);
      this.tweens.add({ targets: b, x: fromL ? cam.right + 60 : cam.x - 60, y: y - rnd.between(20, 120), duration: rnd.between(5000, 8000), onComplete: () => b.destroy() });
      this.time.delayedCall(rnd.between(5000, 14000) / n, bird);
    };
    this.time.delayedCall(2500, bird);
    // lucioles (soir/nuit, et toujours dans le Bois)
    const ff = this.add.particles(0, 0, 'fx_soft', { x: { min: 0, max: z.w }, y: { min: 0, max: z.h }, lifespan: 4000, speedX: { min: -8, max: 8 }, speedY: { min: -8, max: 8 }, scale: { start: 0.08, end: 0.05 }, alpha: { start: 0, end: 1, ease: 'Sine.easeInOut' }, tint: 0xd8ff8a, blendMode: 'ADD', frequency: z.id === 'bois' ? 25 / n : 60 / n });
    ff.setDepth(1e7 + 2); this.zoneObjs.push(ff); ff.setData('fireflies', true);
    (this as any)._ff = ff;
    // rides sur l'eau
    const rivers = z.water.filter((w) => !w.channel);
    if (rivers.length) {
      const pts = rivers.flatMap((w) => samplePolyline(w.pts, 30).map((p) => [p, w.w] as [Pt, number]));
      this.time.addEvent({ delay: 260 / n, loop: true, callback: () => {
        const cam = this.cameras.main.worldView;
        const vis = pts.filter(([[x, y]]) => cam.contains(x, y));
        if (!vis.length) return;
        const [[x, y], w] = vis[Math.floor(Math.random() * vis.length)];
        const r = this.add.image(x + (Math.random() - 0.5) * w * 0.6, y + (Math.random() - 0.5) * 10, 'fx_ripple').setScale(0.2 / this.S_).setDepth(-4e5).setAlpha(0.8);
        this.tweens.add({ targets: r, scale: 1 / this.S_, alpha: 0, duration: 1600, onComplete: () => r.destroy() });
      } });
    }
  }

  rebuild() {
    this.nav = new NavGrid(this.zone, flag);
    this.buildStatic();
    this.objs = OBJECTS.filter((o) => o.zone === this.zone.id);
  }

  // ============================================================== entrée
  private setupInput() {
    this.input.addPointer(2);
    const rs = () => this.registry.get('renderScale') ?? 1;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      if (ui.isModal() || this.transitioning) return;
      this.pointers.set(p.id, { x: p.x, y: p.y });
      if (this.pointers.size >= 2) {
        // deux doigts : pincer pour zoomer, glisser pour parcourir la carte — Éloi ne bouge pas
        this.gesture = null;
        if (this.walkHold) { this.walkHold = false; this.stopHero(); }
        const [a, b] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.userZoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
        return;
      }
      this.gesture = { id: p.id, sx: p.x, sy: p.y, lx: p.x, ly: p.y, wx: p.worldX, wy: p.worldY, t: this.time.now, mode: 'pending' };
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.pointers.has(p.id)) return;
      const prev = this.pointers.get(p.id)!;
      this.pointers.set(p.id, { x: p.x, y: p.y });
      const z = this.cameras.main.zoom;
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.panBy((mx - this.pinch.mx) / z, (my - this.pinch.my) / z);
        this.pinch.mx = mx; this.pinch.my = my;
        this.setZoom(this.pinch.z * (d / this.pinch.d));
        return;
      }
      const g = this.gesture;
      if (!g || g.id !== p.id || !p.isDown) return;
      if (g.mode === 'pending' && Math.hypot(p.x - g.sx, p.y - g.sy) > 12 * rs()) g.mode = 'pan';
      if (g.mode === 'pan') this.panBy((p.x - prev.x) / z, (p.y - prev.y) / z);
      if (g.mode === 'walk' && this.time.now - this.dragT > 140 && !ui.isModal()) { this.dragT = this.time.now; this.goToPoint(p.worldX, p.worldY, true); }
    });
    const up = (p: Phaser.Input.Pointer) => {
      this.pointers.delete(p.id);
      if (this.pinch) { if (this.pointers.size < 2) { this.pinch = null; this.gesture = null; } return; }
      const g = this.gesture;
      if (g && g.id === p.id && g.mode === 'pending') this.fireTap(g.wx, g.wy);
      this.walkHold = false;
      this.gesture = null;
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: any, _dx: number, dy: number) => {
      // zoom vers le curseur
      const before = this.cameras.main.getWorldPoint(p.x, p.y);
      this.setZoom(this.userZoom * (dy > 0 ? 0.88 : 1.14));
      const after = this.cameras.main.getWorldPoint(p.x, p.y);
      if (this.camFree) this.panBy(after.x - before.x, after.y - before.y);
    });
    this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') ui.escape();
      if (ui.isModal()) return;
      if (k === 'm') ui.openPanel('atlas');
      if (k === 'i') ui.openPanel('inventaire');
      if (k === 'j') ui.openPanel('journal');
      if (k === '+' || k === '=') this.zoomStep(1);
      if (k === '-') this.zoomStep(-1);
      if (k === ' ') { if (this.engaged || this.bossActive) this.dodge(); else this.recenter(); }
      if (k === 'c') this.recenter();
    });
  }

  /** Geste en attente : resté appuyé sans bouger → marche continue vers le doigt. */
  private updateGesture() {
    const g = this.gesture;
    if (!g || g.mode !== 'pending' || this.time.now - g.t < 320 || ui.isModal()) return;
    g.mode = 'walk';
    this.walkHold = true;
    this.camFree = false;
    const p = this.input.manager.pointers.find((q) => q.id === g.id);
    this.goToPoint(p ? p.worldX : g.wx, p ? p.worldY : g.wy, false);
  }

  panBy(dx: number, dy: number) {
    const cam = this.cameras.main;
    if (!this.camFree) { this.camFree = true; this.camX = cam.midPoint.x; this.camY = cam.midPoint.y; ui.setFreeCam(true); }
    const vw = cam.width / cam.zoom / 2, vh = cam.height / cam.zoom / 2, Z = this.zone;
    this.camX = Phaser.Math.Clamp(this.camX - dx, Math.min(vw, Z.w / 2), Math.max(Z.w - vw, Z.w / 2));
    this.camY = Phaser.Math.Clamp(this.camY - dy, Math.min(vh, Z.h / 2), Math.max(Z.h - vh, Z.h / 2));
  }
  setZoom(z: number) { this.userZoom = Phaser.Math.Clamp(z, 0.45, 2.2); this.applyZoom(); ui.setZoomLevel(this.userZoom); }
  zoomStep(dir: number) { this.setZoom(this.userZoom * (dir > 0 ? 1.2 : 1 / 1.2)); }
  recenter() { this.camFree = false; ui.setFreeCam(false); }

  applyZoom() {
    const rs = this.registry.get('renderScale') ?? 1;
    const cssMin = Math.min(this.scale.width, this.scale.height) / rs;
    const fit = Phaser.Math.Clamp(cssMin / 560, 0.62, 1.5);
    let z = rs * fit * this.userZoom;
    if (this.zone?.interior) z = Math.max(z, Math.min(this.scale.width / 760, this.scale.height / 560));
    const cam = this.cameras.main;
    cam.setZoom(z);
    if (this.zone) {
      // pièce plus petite que l'écran : on la centre
      const vw = cam.width / z, vh = cam.height / z, Z = this.zone;
      cam.setBounds(Math.min(0, (Z.w - vw) / 2), Math.min(0, (Z.h - vh) / 2), Math.max(Z.w, vw), Math.max(Z.h, vh));
    }
  }

  private fireTap(wx: number, wy: number) {
    if (this.busy || this.time.now < this.busyUntil) return;
    const pad = 16 / this.cameras.main.zoom * (this.registry.get('renderScale') ?? 1);
    // ordre de priorité : ennemi, habitant, objet, sol
    if (this.boss && this.boss.hitTest(wx, wy, pad)) { this.setTarget({ kind: 'boss' }); this.showLabel('Le Gardien des Ronces', this.boss.x, this.boss.y - 170); return; }
    const e = this.combat.pick(wx, wy, pad);
    if (e) { this.setTarget({ kind: 'enemy', e }); this.showLabel(e.kind === 'murmure' ? 'Murmure' : e.kind === 'ancien' ? 'Ronceux ancien' : 'Ronceux', e.x, e.y - 70); return; }
    const n = this.npcs.pick(wx, wy, pad);
    if (n) { this.setTarget({ kind: 'npc', npc: n }); this.showLabel(DIALOGS[n.id]?.name ?? n.id, n.x, n.y - 88); return; }
    // une porte : Éloi entre
    if (!this.zone.interior) for (const e of this.zone.exits) {
      if (!e.door) continue;
      const dx = e.rect.x + e.rect.w / 2;
      if (Math.abs(wx - dx) < 28 + pad && wy > e.rect.y - 60 - pad && wy < e.rect.y + e.rect.h + 26 + pad) {
        this.showLabel(evalCond(e.cond, flag) || (e.to === 'moulin_int' && has('cle_moulin')) ? 'Entrer : ' + ZONE_LABEL[e.to] : ZONE_LABEL[e.to] + ' (fermé)', dx, e.rect.y - 50);
        this.goToPoint(dx, e.rect.y + e.rect.h / 2, false);
        return;
      }
    }
    const o = this.pickObj(wx, wy, pad);
    // hautes herbes : un coup de bâton les fauche
    if (!o) {
      const g = this.props.find((p) => p.def.tex.startsWith('tall:') && p.img.visible && p.img.alpha > 0.5 && Math.abs(wx - p.def.x) < 20 + pad && wy < p.def.y + 6 + pad && wy > p.def.y - 34 - pad);
      if (g) { this.setTarget({ kind: 'cut', img: g.img }); return; }
    }
    if (o) { this.setTarget({ kind: 'obj', obj: o }); if (!o.hidden) this.showLabel(o.name, o.x, o.y - (o.h ?? 50) - 8); return; }
    this.goToPoint(wx, wy, false);
  }

  private pickObj(wx: number, wy: number, pad: number): ObjDef | null {
    let best: ObjDef | null = null;
    for (const o of this.objs) {
      if (!evalCond(o.cond, flag)) continue;
      const w = (o.w ?? 40) / 2 + pad, h = o.h ?? 50;
      if (Math.abs(wx - o.x) < w && wy < o.y + 10 + pad && wy > o.y - h - pad && (!best || o.y > best.y)) best = o;
    }
    return best;
  }

  private marker(x: number, y: number, ok: boolean) {
    const m = this.add.image(x, y, ok ? 'fx_marker' : 'fx_cross').setScale(0.4 / this.S_).setDepth(ok ? -4e5 : 9e6).setAlpha(0.9);
    this.tweens.add({ targets: m, scale: (ok ? 1 : 0.8) / this.S_, alpha: 0, duration: ok ? 520 : 700, ease: 'Quad.easeOut', onComplete: () => m.destroy() });
  }

  goToPoint(wx: number, wy: number, drag: boolean) {
    wx = Phaser.Math.Clamp(wx, 4, this.zone.w - 4); wy = Phaser.Math.Clamp(wy, 4, this.zone.h - 4);
    let dest: Pt | null = this.nav.freeAt(wx, wy) ? [wx, wy] : this.nav.nearestFree(wx, wy, 5, [this.hero.x, this.hero.y]);
    if (dest && this.nav.component(dest[0], dest[1]) !== this.nav.component(this.hero.x, this.hero.y)) dest = null;
    if (!dest) { if (!drag) { this.marker(wx, wy, false); audio.sfx('nope'); ui.hint('Impossible d’aller par là.'); } return; }
    this.npcs.markDyn(this.nav);
    const path = this.nav.findPath([this.hero.x, this.hero.y], dest, true) ?? this.nav.findPath([this.hero.x, this.hero.y], dest, false);
    if (!path) { if (!drag) { this.marker(wx, wy, false); audio.sfx('nope'); } return; }
    this.target = { kind: 'point' };
    this.path = path;
    if (this.camFree && !drag) this.recenter();
    if (!drag) { this.marker(dest[0], dest[1], true); audio.sfx('tap'); }
  }

  private setTarget(t: Target) {
    if (this.camFree) this.recenter();
    this.target = t; this.repathT = 0; this.attackT = 0;
    audio.sfx('tap', { pitch: 1.2 });
    this.repath();
  }

  private targetPos(): { x: number; y: number; r: number } | null {
    const t = this.target;
    if (!t) return null;
    if (t.kind === 'npc') return { x: t.npc.x, y: t.npc.y, r: t.npc.talkRange };
    if (t.kind === 'obj') return { x: t.obj.x, y: t.obj.y, r: t.obj.stand ?? 40 };
    if (t.kind === 'enemy') return { x: t.e.x, y: t.e.y, r: t.e.kind === 'ancien' ? 66 : 48 };
    if (t.kind === 'boss' && this.boss) return { x: this.boss.x, y: this.boss.y + 6, r: 84 };
    if (t.kind === 'cut') return { x: t.img.x, y: t.img.y, r: 34 };
    return null;
  }

  private repath() {
    const tp = this.targetPos(); if (!tp) return;
    const hx = this.hero.x, hy = this.hero.y;
    if (Math.hypot(tp.x - hx, (tp.y - hy) * 1.25) <= tp.r) { this.path = []; return; }
    const curD = Math.hypot(tp.x - hx, (tp.y - hy) * 1.25);
    // point d'approche : côté du héros, au sol libre, dans le même composant
    const a = Math.atan2(hy - tp.y, hx - tp.x);
    const cands: Pt[] = [];
    for (const da of [0, 0.6, -0.6, 1.2, -1.2, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const aa = a + da; const rr = Math.max(18, tp.r * 0.8);
      cands.push([tp.x + Math.cos(aa) * rr, tp.y + Math.sin(aa) * rr * 0.8]);
    }
    if (this.target?.kind === 'obj') cands.unshift([tp.x, tp.y + Math.min(30, tp.r * 0.7)]);
    const ex = this.target?.kind === 'npc' ? this.target.npc.id : undefined;
    this.npcs.markDyn(this.nav, ex);
    for (const c of cands) {
      const f = this.nav.freeAt(c[0], c[1], true) ? c : this.nav.nearestFree(c[0], c[1], 2, [hx, hy]);
      if (!f) continue;
      const p = this.nav.findPath([hx, hy], f, true);
      if (p) {
        const end = p[p.length - 1];
        if (Math.hypot(tp.x - end[0], (tp.y - end[1]) * 1.25) >= curD - 4 && curD <= tp.r + 60) continue; // ne rapproche pas
        this.path = p; return;
      }
    }
    this.path = [];
    if (curD <= tp.r + 60) return;
    if (this.target?.kind !== 'enemy') { ui.hint('Impossible d’y accéder d’ici.'); this.marker(tp.x, tp.y, false); this.target = null; }
  }

  stopHero() { this.path = []; this.target = null; this.hero.play('idle'); }

  private showLabel(t: string, x: number, y: number) {
    this.label.setText(t).setPosition(x, y).setVisible(true).setScale(1 / this.cameras.main.zoom * (this.registry.get('renderScale') ?? 1));
    this.labelT = 2.2;
  }

  // ============================================================== mise à jour
  update(time: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000);
    this.atmo.update(dt);
    if (this.camHold && !this.busy && !ui.isModal()) this.camHold = false;
    // qualité adaptative : si l'image saccade en qualité haute, on retire les effets coûteux
    if (this.settings.quality === 'haute' && !this.fxDowngraded) {
      this.fpsT += dt; this.fpsN++;
      if (this.fpsT > 6) { const fps = this.fpsN / this.fpsT; this.fpsT = 0; this.fpsN = 0; if (fps < 38) { this.fxDowngraded = true; applyCameraFX(this.cameras.main, 'moyenne', !!this.zone.interior); } }
    }
    if (this.attract) {
      // écran d'accueil : la caméra flâne dans le village, les habitants vivent leur vie
      this.attractT += dt;
      const k = (Math.sin(this.attractT * 0.05) + 1) / 2;
      const cam = this.cameras.main;
      cam.centerOn(1150 + k * 650, 1080 - Math.sin(this.attractT * 0.031) * 120);
      S.clock += dt * 0.4;
      this.npcs.update(dt, this.nav, this.zone.id, [-999, -999]);
      this.updateLight(); this.updateOcclusion(dt);
      this.cullT -= dt; if (this.cullT <= 0) { this.cullT = 0.3; this.cull(); }
      return;
    }
    const modal = ui.isModal();
    if (!modal && !this.transitioning) { S.clock += dt * CLOCK_RATE; S.playTime += dt; }
    if (this.hurtT > 0) this.hurtT -= dt;
    if (this.inv > 0) this.inv -= dt;
    this.updateGesture();
    if (this.hitStop > 0) { this.hitStop -= dt; return; }
    if (this.dodgeCd > 0) this.dodgeCd -= dt;
    if (this.dodgeT > 0) this.updateDodge(dt);
    else if (!modal && !this.busy && !this.transitioning) this.updateHero(dt);
    if (this.hearts.length) this.collectHearts();
    if (this.boss && !modal && !this.transitioning) {
      if (!this.bossActive && this.boss.st === 'intro' && !this.busy && Math.hypot(this.hero.x - ARENA.x, this.hero.y - ARENA.y) < ARENA.r - 20) void this.startBossFight();
      if (this.bossActive) {
        const diff = { exploration: [1.5, 0], facile: [1.35, 1], normale: [1, 1], difficile: [0.8, 1] }[this.settings.combat];
        this.boss.update(dt, diff[0], diff[1]);
        ui.bossBar('Le Gardien des Ronces', this.boss.hp / this.boss.maxHp);
        // l'arène est fermée par les ronces
        const dx = this.hero.x - ARENA.x, dy = this.hero.y - ARENA.y, d = Math.hypot(dx, dy);
        if (d > ARENA.r - 10) this.hero.setPos(ARENA.x + dx / d * (ARENA.r - 12), ARENA.y + dy / d * (ARENA.r - 12));
      }
    }
    this.npcs.update(dt, this.nav, this.zone.id, [this.hero.x, this.hero.y]);
    if (!modal && !this.transitioning) this.combat.update(dt);
    if (this.zone.id === 'moulin') {
      if (!modal) stepMill(dt);
      if (this.wheel) {
        const want = S.mill.solved ? 1.1 : 0;
        this.wheelSpeed += (want - this.wheelSpeed) * Math.min(1, dt * 0.8);
        this.wheel.rotation += this.wheelSpeed * dt;
      }
      this.drawMillWater(time);
      audio.ambience.machine = S.mill.solved ? Math.max(0, 1 - Math.hypot(this.hero.x - 1450, this.hero.y - 850) / 700) : 0;
    } else audio.ambience.machine = this.zone.id === 'moulin_int' && flag('mill_running') ? 1 : 0;
    this.updateOcclusion(dt);
    this.updateCamera(dt);
    this.updateLight();
    if (this.labelT > 0) { this.labelT -= dt; if (this.labelT <= 0) this.label.setVisible(false); }
    this.fogT -= dt;
    if (this.fogT <= 0) { this.fogT = 0.5; revealAround(S.zone, this.hero.x, this.hero.y); this.updateBubbles(); this.updateAmbienceAudio(); }
    this.cullT -= dt;
    if (this.cullT <= 0) { this.cullT = 0.25; this.cull(); }
    S.x = this.hero.x; S.y = this.hero.y; S.facing = this.hero.dir;
    if (!this.transitioning && !modal) this.checkExits(dt);
    ui.tick(dt, this.compass());
  }

  private updateHero(dt: number) {
    const h = this.hero;
    // poursuite d'une cible mobile
    if (this.target && this.target.kind !== 'point') {
      const tp = this.targetPos()!;
      if (this.target.kind === 'enemy' && !this.target.e.alive) { this.target = null; this.path = []; }
      else {
        const d = Math.hypot(tp.x - h.x, (tp.y - h.y) * 1.25);
        if (d <= tp.r) { this.path = []; this.arrive(dt); return; }
        this.repathT -= dt;
        if (this.repathT <= 0 && (this.target.kind !== 'obj' || !this.path.length)) {
          this.repathT = 0.3; this.repath();
          // au plus près possible (comptoir, table…) : on accepte l'arrivée
          if (this.target && !this.path.length && this.target.kind !== 'enemy' && d <= tp.r + 60) { this.arrive(dt); return; }
        }
      }
    }
    if (!this.path.length) {
      if (this.attackT > 0) { this.attackT -= dt; return; }
      if (this.hurtT > 0) return;
      this.idleT += dt;
      if (h.anim !== 'idle' && h.anim !== 'fidget' && h.anim !== 'attack') h.play('idle');
      if (h.anim === 'attack' && !h.sprite.anims.isPlaying) h.play('idle');
      if (this.idleT > 9 && h.anim === 'idle') { h.play('fidget', true); this.idleT = 0; h.sprite.once('animationcomplete', () => h.play('idle', true)); }
      this.vx *= 0.8; this.vy *= 0.8;
      return;
    }
    this.idleT = 0;
    const [tx, ty] = this.path[0];
    const dx = tx - h.x, dy = ty - h.y, d = Math.hypot(dx, dy);
    let remain = d; for (let i = 1; i < this.path.length; i++) remain += Math.hypot(this.path[i][0] - this.path[i - 1][0], this.path[i][1] - this.path[i - 1][1]);
    const running = remain > 300 || this.engaged;
    const sp = (running ? RUN : WALK) * dt;
    // un habitant sur la route : on contourne
    const nx = h.x + (dx / Math.max(d, 0.001)) * Math.min(sp, d), ny = h.y + (dy / Math.max(d, 0.001)) * Math.min(sp, d);
    for (const n of this.npcs.npcs.values()) {
      if (this.target?.kind === 'npc' && this.target.npc === n) continue;
      if (Math.hypot(n.x - nx, (n.y - ny) * 1.4) < 20) {
        this.blockedT += dt;
        if (this.blockedT > 0.25) {
          this.blockedT = 0;
          const dest = this.path[this.path.length - 1];
          this.npcs.markDyn(this.nav);
          const p = this.nav.findPath([h.x, h.y], dest, true);
          if (p) this.path = p; else { h.play('idle'); }
        }
        return;
      }
    }
    this.blockedT = 0;
    if (d <= sp) { h.setPos(tx, ty); this.path.shift(); }
    else h.setPos(nx, ny);
    this.vx = dx / d; this.vy = dy / d;
    h.faceToward(h.x + dx, h.y + dy);
    h.play(running ? 'run' : 'walk');
    this.stepT -= dt;
    if (this.stepT <= 0) { this.stepT = running ? 0.22 : 0.34; const sf = this.surface(); audio.sfx('step', { surface: sf }); if (this.settings.quality !== 'basse') this.atmo.dust(h.x, h.y, sf); }
    if (!this.path.length && this.target?.kind === 'point') { this.target = null; h.play('idle'); }
  }

  private surface(): string {
    const z = this.zone;
    if (z.interior) return z.id === 'atelier' ? 'stone' : 'wood';
    if (z.bridges.some((b) => this.hero.x > b.x && this.hero.x < b.x + b.w && this.hero.y > b.y && this.hero.y < b.y + b.h)) return 'wood';
    if (z.areas.some((a) => a.kind === 'cobble' && Phaser.Geom.Polygon.Contains(new Phaser.Geom.Polygon(a.poly.flat()), this.hero.x, this.hero.y))) return 'stone';
    return 'grass';
  }

  private arrive(dt: number) {
    const t = this.target!; const h = this.hero;
    const tp = this.targetPos()!;
    h.faceToward(tp.x, tp.y);
    if (t.kind === 'enemy' || t.kind === 'boss') {
      this.attackT -= dt;
      if (this.attackT <= 0 && this.hurtT <= 0) {
        this.attackT = 0.55;
        h.play('attack', true);
        audio.sfx('swing');
        this.slash(tp.x, tp.y);
        this.time.delayedCall(150, () => {
          if (t.kind === 'enemy') { if (t.e.alive && this.combat.strike(t.e, this.hero.x, this.hero.y)) this.hitStop = 0.07; }
          else if (this.boss) {
            const r = this.boss.strike(this.hero.x, this.hero.y, { exploration: 2, facile: 1.5, normale: 1, difficile: 1 }[this.settings.combat]);
            if (r === 'hit') this.hitStop = 0.09;
            if (r === 'bounce') { const a = Math.atan2(this.hero.y - this.boss.y, this.hero.x - this.boss.x); const nx = this.hero.x + Math.cos(a) * 28, ny = this.hero.y + Math.sin(a) * 28; if (this.nav.freeAt(nx, ny)) this.hero.setPos(nx, ny); this.spark(this.boss.x, this.boss.y - 60); if (!flag('tuto_coeur')) { setFlag('tuto_coeur'); ui.hint('Ses ronces sont trop dures : attendez que son cœur s\'ouvre !'); } }
          }
        });
      }
      return;
    }
    if (t.kind === 'cut') {
      this.target = null; this.path = [];
      h.play('attack', true); audio.sfx('swing'); this.slash(t.img.x, t.img.y - 10);
      this.time.delayedCall(140, () => this.mow(t.img));
      return;
    }
    this.target = null; this.path = [];
    h.play('idle');
    if (t.kind === 'npc') void this.talk(t.npc);
    else if (t.kind === 'obj') void this.useObj(t.obj);
  }

  private async useObj(o: ObjDef) {
    if (this.selectedItem) {
      const it = this.selectedItem; ui.selectItem(null);
      await this.say([{ s: 'eloi', t: `Utiliser ${ITEMS[it].name.toLowerCase()} ici ? Ça ne servirait à rien.` }]);
      return;
    }
    const fn = SCRIPTS[o.id];
    if (!fn) return;
    this.busy = true;
    try { await fn(this); } finally { this.busy = false; }
  }

  async talk(n: Npc) {
    const D = DIALOGS[n.id]; if (!D) return;
    if (this.selectedItem) {
      const it = this.selectedItem; ui.selectItem(null);
      await this.say([{ s: n.id, t: it === 'lettre' && n.id === 'anton' && flag('lettre_registre') ? "Une lettre ? Pour moi ? Montrez-la-moi, je vous écoute." : `${ITEMS[it].name} ? Je ne vois pas ce que je pourrais en faire.` }]);
      if (!(it === 'lettre' && n.id === 'anton' && flag('lettre_registre'))) return;
    }
    this.busy = true;
    n.talking = true;
    n.actor.faceToward(this.hero.x, this.hero.y); n.actor.play('idle', true);
    this.hero.faceToward(n.x, n.y);
    try {
      const g = isFete() && FETE[n.id] ? { lines: FETE[n.id], fx: undefined } : D.greet();
      await this.say(g.lines);
      if (g.fx) this.run(g.fx);
      for (;;) {
        const topics = D.topics.filter((t) => !t.cond || t.cond());
        if (!topics.length) break;
        const opts = topics.map((t) => (flag(`vu_${n.id}_${t.id}`) ? '· ' : '') + t.label);
        const r = await this.choose(null, [...opts, 'Au revoir']);
        if (r < 0 || r >= topics.length) break;
        const t = topics[r];
        setFlag(`vu_${n.id}_${t.id}`);
        if (t.anim) { n.actor.play('work', true); await this.wait(900); n.actor.play('idle', true); }
        await this.say(t.lines());
        if (t.fx) this.run(t.fx);
        if (this.pendingMem) break;
      }
    } finally {
      n.talking = false; this.busy = false;
      n.actor.play(n.place.mode === 'work' ? 'work' : 'idle', true);
      if (n.place.face && n.place.mode !== 'loop') n.actor.face(n.place.face);
    }
    if (this.pendingMem) { const m = this.pendingMem; this.pendingMem = null; this.busy = true; await this.wait(300); this.busy = false; await this.playMemory(m); }
  }

  // ============================================================== occlusion, caméra, lumière
  private updateOcclusion(dt: number) {
    const hx = this.hero.x, hy = this.hero.y;
    for (const p of this.props) {
      if (!p.def.occlude) continue;
      const behind = hy < p.def.y - 4 && hx > p.x0 + 6 && hx < p.x1 - 6 && hy - 50 < p.y1 && hy > p.y0 + 10;
      const want = behind ? 0.42 : 1;
      if (p.alpha !== want) { p.alpha += (want - p.alpha) * Math.min(1, dt * 8); if (Math.abs(p.alpha - want) < 0.02) p.alpha = want; p.img.setAlpha(p.alpha); }
    }
  }

  private cull() {
    const v = this.cameras.main.worldView;
    const m = 160;
    for (const p of this.props) p.img.setVisible(p.x1 > v.x - m && p.x0 < v.right + m && p.y1 > v.y - m && p.y0 < v.bottom + m);
  }

  private updateCamera(dt: number) {
    const cam = this.cameras.main;
    const look = this.path.length ? 70 : 0;
    const tx = this.hero.x + this.vx * look, ty = this.hero.y - 20 + this.vy * look * 0.7;
    if (this.camFree || this.camHold) { if (!(this as any)._panning) cam.centerOn(this.camX, this.camY); return; }
    if (this.bossActive && this.boss && !(this as any)._panning) {
      // combat de boss : la caméra cadre l'arène entière (Éloi et le Gardien toujours visibles)
      const tx = (this.hero.x + this.boss.x) / 2 * 0.5 + ARENA.x * 0.5, ty = (this.hero.y + this.boss.y - 60) / 2 * 0.5 + ARENA.y * 0.5;
      const k = Math.min(1, dt * 3);
      this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
      const want = Math.min(cam.height / (ARENA.r * 2 + 220), cam.width / (ARENA.r * 2 + 360));
      cam.setZoom(cam.zoom + (want - cam.zoom) * k);
      cam.centerOn(this.camX, this.camY);
      return;
    }
    const k = Math.min(1, dt * 4.5);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
    if (!(this as any)._panning) cam.centerOn(this.camX, this.camY);
  }

  private updateLight() {
    const v = this.cameras.main.worldView;
    this.light.setPosition(v.x - 10, v.y - 10).setSize(v.width + 20, v.height + 20);
    const h = (S.clock % 1440) / 60;
    // couleur multiplicative selon l'heure (interpolée)
    const keys: [number, number[]][] = [[0, [70, 84, 140]], [5, [80, 90, 150]], [6.5, [255, 214, 190]], [9, [255, 248, 236]], [12, [255, 255, 255]], [16, [255, 246, 228]], [18.5, [255, 196, 150]], [20.5, [150, 130, 175]], [22, [78, 90, 148]], [24, [70, 84, 140]]];
    let i = 0; while (i < keys.length - 1 && keys[i + 1][0] <= h) i++;
    const [h0, c0] = keys[i], [h1, c1] = keys[Math.min(i + 1, keys.length - 1)];
    const t = h1 > h0 ? (h - h0) / (h1 - h0) : 0;
    let c = c0.map((v0, k) => v0 + (c1[k] - v0) * t);
    if (this.zone.interior) c = [255, 236, 214];
    if (this.zone.dark) c = c.map((v0) => v0 * (1 - this.zone.dark!));
    this.light.setFillStyle(Phaser.Display.Color.GetColor(c[0], c[1], c[2]));
    const night = this.zone.interior ? 0.25 : Phaser.Math.Clamp((230 - c[0]) / 160, 0, 1);
    for (const g of this.glows) g.setAlpha(night * 0.55);
    const ff = (this as any)._ff as Phaser.GameObjects.Particles.ParticleEmitter | undefined;
    if (ff) ff.emitting = this.zone.id === 'bois' || night > 0.4;
    if (!this.attract) ui.setPhase(phaseOf(S.clock));
  }

  private updateBubbles() {
    const relevant = this.relevantNpcs();
    for (const n of this.npcs.npcs.values()) {
      let b = this.bubbles.get(n.id);
      const show = relevant.has(n.id);
      if (show && !b) { b = this.add.image(n.x, n.y - 96, 'fx_bubble_q').setScale(1 / this.S_).setDepth(2e7); this.bubbles.set(n.id, b); this.tweens.add({ targets: b, y: '-=5', yoyo: true, repeat: -1, duration: 600 }); }
      if (!show && b) { b.destroy(); this.bubbles.delete(n.id); }
    }
    for (const [id, b] of this.bubbles) { const n = this.npcs.npcs.get(id as NpcId); if (!n) { b.destroy(); this.bubbles.delete(id); } else b.setX(n.x); }
  }

  /** Personnages qui ont quelque chose d'important à dire pour l'étape en cours. */
  relevantNpcs(): Set<string> {
    const s = new Set<string>();
    const st = currentMainStep()?.id;
    if (st === 'agathe') s.add('agathe');
    if (st === 'temoins') { if (!flag('t_ninon')) s.add('ninon'); if (!flag('t_salome')) s.add('salome'); if (!flag('t_basile')) s.add('basile'); }
    if (st === 'bois' || (st === 'bornes' && flag('theo_condition'))) {
      if (!flag('met_coline')) s.add('coline');
      else if (!flag('boussole_ok')) { if (has('aimant')) s.add('coline'); else s.add('mara'); }
      if (flag('boussole_ok') && flag('bornes_solved')) s.add('theodore');
    }
    if (st === 'anton') s.add('anton');
    if (has('lettre') && flag('lettre_registre')) s.add('anton');
    if (has('lettre') && !flag('lettre_registre') && flag('lettre_recue')) s.add('salome');
    if (flag('jardin_accepte') && !flag('jardin_fini') && has('sauge') && has('pied_de_loup') && has('fleur_lanterne')) s.add('mara');
    return s;
  }

  private updateAmbienceAudio() {
    const z = this.zone; const ph = phaseOf(S.clock);
    let water = 0;
    for (const w of z.water) { if (w.channel) continue; const d = samplePolyline(w.pts, 60).reduce((m, [x, y]) => Math.min(m, Math.hypot(x - this.hero.x, y - this.hero.y)), 1e9); water = Math.max(water, Math.max(0, 1 - d / 420)); }
    audio.ambience = { ...audio.ambience, water, birds: z.interior ? 0 : ph === 'nuit' ? 0 : z.id === 'bois' ? 1 : 0.6, crickets: z.interior ? 0 : ph === 'nuit' || ph === 'soir' ? 1 : 0, wind: z.id === 'bois' ? 0.7 : z.interior ? 0 : 0.25 };
  }

  // ============================================================== sorties et déclencheurs
  private checkExits(dt: number) {
    const hx = this.hero.x, hy = this.hero.y;
    this.exitMsgT -= dt;
    for (const e of this.zone.exits) {
      const r = e.rect;
      if (hx < r.x || hx > r.x + r.w || hy < r.y || hy > r.y + r.h) continue;
      if (!evalCond(e.cond, flag)) {
        if (e.to === 'moulin_int' && has('cle_moulin') && flag('boss_done') && !flag('mill_unlocked')) { setFlag('mill_unlocked'); audio.sfx('door'); void this.say([{ s: 'narr', t: "La clé d'Anton tourne dans la serrure. En soulevant la porte, elle s'ouvre avec un long grincement." }]); return; }
        if (e.blockedMsg && this.exitMsgT <= 0) { this.exitMsgT = 4; void this.say([{ s: 'narr', t: e.blockedMsg }]); this.stopHero(); this.hero.setPos(hx, hy + 18); }
        continue;
      }
      void this.transition(e.to, e.at, e.facing, !!e.door);
      return;
    }
    // rencontres : point de reprise à l'entrée de la zone dangereuse
    for (const enc of ENCOUNTERS) {
      if (enc.zone !== this.zone.id || S.defeated.includes(enc.id)) continue;
      if (Math.hypot(hx - enc.center[0], hy - enc.center[1]) < enc.radius + 120 && (S.checkpoint.x !== enc.checkpoint[0] || S.checkpoint.y !== enc.checkpoint[1])) {
        S.checkpoint = { zone: this.zone.id, x: enc.checkpoint[0], y: enc.checkpoint[1] };
        if (!flag('tuto_combat') && enc.id === 'enc1') { setFlag('tuto_combat'); ui.combatTutorial(); }
      }
    }
    // Théodore intercepte qui s'approche de la porte sans autorisation
    if (this.zone.id === 'clairval' && !flag('theo_ok') && hy < 330 && Math.abs(hx - 1300) < 120 && !this.busy) {
      const n = this.npcs.npcs.get('theodore');
      if (n && Math.hypot(n.x - hx, n.y - hy) < 90) { this.stopHero(); void this.talk(n).then(() => { if (!flag('theo_ok')) this.goToPoint(1300, 420, true); }); }
    }
  }

  async transition(to: ZoneId, at: Pt, facing: Dir, door: boolean) {
    if (this.transitioning) return;
    this.transitioning = true;
    if (door) audio.sfx('door');
    this.stopHero();
    const cam = this.cameras.main;
    cam.fadeOut(220, 20, 14, 10);
    await this.wait(240);
    this.loadZone(to, at[0], at[1], facing);
    this.save('zone');
    cam.fadeIn(260, 20, 14, 10);
    await this.wait(200);
    this.transitioning = false;
  }

  // ============================================================== combat
  private heroHit(dmg: number, fx: number, fy: number) {
    if (this.inv > 0) return;
    this.inv = 0.9; this.hurtT = 0.35;
    const a = Math.atan2(this.hero.y - fy, this.hero.x - fx);
    const nx = this.hero.x + Math.cos(a) * 26, ny = this.hero.y + Math.sin(a) * 26;
    if (this.nav.freeAt(nx, ny)) this.hero.setPos(nx, ny);
    this.hero.play('hurt', true);
    audio.sfx('hurt');
    this.cameras.main.flash(120, 200, 60, 40);
    if (dmg <= 0) { ui.hint('Mode exploration : les créatures ne blessent pas.'); return; }
    S.hp = Math.max(0, S.hp - dmg);
    ui.hearts();
    if (S.hp <= 0) void this.defeat();
  }

  private async defeat() {
    this.busy = true; this.stopHero();
    const cam = this.cameras.main;
    cam.fadeOut(600, 30, 10, 10);
    await this.wait(700);
    S.hp = S.maxHp;
    const cp = S.checkpoint;
    if (cp.zone !== this.zone.id) this.loadZone(cp.zone, cp.x, cp.y, 'up');
    else { this.hero.setPos(cp.x, cp.y); this.camX = cp.x; this.camY = cp.y; }
    this.combat.resetAlive();
    if (this.bossActive && this.boss) this.boss.reset();
    ui.hearts();
    cam.fadeIn(600, 30, 10, 10);
    await this.say([{ s: 'narr', t: "Éloi reprend ses esprits un peu plus loin, le souffle court. Les créatures n'ont pas bougé." }, { s: 'eloi', t: "Quand elles se préparent, je m'écarte. Quand elles se reposent, je frappe." }]);
    this.busy = false;
  }

  private async encounterDone(id: string) {
    setFlag(id + '_done');
    this.target = null;
    audio.sfx('fanfare');
    await this.wait(600);
    if (id === 'enc1') { this.toast('Les ronces se rétractent : le chemin est libre', 'info'); this.rebuild(); }
    if (id === 'enc2') this.toast('Les murmures se sont dissipés', 'info');
    if (id === 'enc3') { this.toast('Le gardien du coffre est vaincu', 'info'); }
    this.save('combat');
  }

  // ============================================================== atlas
  async consultAtlas() {
    if (this.busy) return;
    const hx = this.hero.x, hy = this.hero.y;
    this.busy = true;
    try {
      await this.anim('atlas', 1300);
      if (this.zone.id === 'bois' && flag('arbre_vu') && !flag('passage_open') && Math.hypot(hx - 620, hy - 1340) < 200) {
        audio.sfx('discover');
        setFlag('passage_open'); addNote('note_passage'); addSecret('passage');
        await this.say([{ s: 'narr', t: "Sur la page du Bois, une ligne pointillée apparaît derrière le vieux chêne. Au même instant, les ronces frissonnent… et s'écartent." }]);
        const br = this.props.find((p) => p.def.id === 'ronces_passage');
        if (br) await new Promise<void>((r) => this.tweens.add({ targets: br.img, alpha: 0, scaleY: 0, duration: 900, onComplete: () => r() }));
        this.rebuild();
        this.toast('Secret découvert : le sentier caché', 'secret');
        this.save('secret');
        return;
      }
      if (this.zone.id === 'moulin' && flag('mill_running') && !flag('route_revealed')) { this.busy = false; await this.finale(); return; }
      if (this.zone.id === 'clairval' && flag('bornes_solved') && Object.values(BORNE_POS).some(([x, y]) => Math.hypot(hx - x, hy - y) < 220)) {
        await this.say([{ s: 'eloi', t: "La trace dorée brille plus fort près des bornes. Elle file vers le rocher fendu… puis s'arrête net." }]);
        return;
      }
      await this.say([{ s: 'eloi', t: "L'atlas ne révèle rien de plus ici." }]);
    } finally { this.busy = false; }
  }

  private async finale() {
    this.busy = true;
    await this.say([{ s: 'narr', t: "La roue tourne, et l'atlas s'ouvre tout seul entre les mains d'Éloi. Les pages blanches se couvrent d'encre." }]);
    audio.sfx('discover');
    this.addRouteLayer(0);
    const route = this.zone.paths.filter((p) => p.kind === 'route').flatMap((p) => samplePolyline(p.pts, 40));
    for (const [i, [x, y]] of route.entries()) this.time.delayedCall(i * 45, () => { const s = this.add.image(x, y, 'fx_spark').setScale(1 / this.S_).setDepth(9e6).setBlendMode(Phaser.BlendModes.ADD); this.tweens.add({ targets: s, alpha: 0, scale: 2 / this.S_, angle: 90, duration: 1200, onComplete: () => s.destroy() }); });
    if (this.routeLayer) this.tweens.add({ targets: this.routeLayer, alpha: 1, duration: 4000 });
    await this.pan([500, 1350], 1800, 600);
    setFlag('route_revealed'); addTrace('route_moulin');
    this.rebuild();
    await this.pan([2150, 1060], 1600, 1200);
    await this.say([{ s: 'eloi', t: "La route… elle revient ! Elle repart vers Clairval. Et de l'autre côté, un pont, vers l'est… vers la brume.", m: 'surprise' }]);
    // Quelqu'un observe la route renaître depuis la brume.
    const [gx, gy] = this.watcherSpot();
    const watcher = new Actor(this, 'conservateur', gx, gy, this.S_);
    watcher.setPos(gx, gy); watcher.face('left');
    watcher.sprite.setAlpha(0); watcher.shadow.setAlpha(0);
    await this.pan([gx - 60, gy - 30], 900, 0);
    await new Promise<void>((r) => this.tweens.add({ targets: [watcher.sprite, watcher.shadow], alpha: 0.92, duration: 1400, onComplete: () => r() }));
    await this.say([
      { s: 'narr', t: "Au bout du pont, dans la brume, une silhouette grise. Immobile. Elle regarde la route renaître." },
      { s: 'eloi', t: "Hé ! Vous, là-bas ! Attendez !", m: 'surprise' },
    ]);
    watcher.play('talk', true); await this.wait(900); watcher.play('idle', true);
    await this.say([{ s: 'narr', t: "La silhouette lève lentement la main. Un salut, peut-être. Ou un geste pour prendre note." }]);
    const puff = this.add.image(gx, gy - 40, 'fx_soft').setScale(3).setTint(0xdfe4ea).setAlpha(0).setDepth(gy + 2);
    this.tweens.add({ targets: puff, alpha: 0.8, scale: 6, duration: 700, yoyo: true, onComplete: () => puff.destroy() });
    await new Promise<void>((r) => this.tweens.add({ targets: [watcher.sprite, watcher.shadow], alpha: 0, duration: 900, delay: 300, onComplete: () => r() }));
    watcher.destroy();
    addNote('note_silhouette');
    await this.say([{ s: 'eloi', t: flag('garde_avoue') ? "Un manteau gris, une capuche… Comme l'homme qui a payé Théodore, il y a cinq ans." : "Qui était-ce ? Il me regardait comme on regarde une carte qu'on va devoir corriger.", m: 'souci' }]);
    await this.pan([this.hero.x, this.hero.y], 1200, 100);
    await this.anim('atlas', 1200);
    addNote('note_finale');
    await this.say([
      { s: 'narr', t: "Sur la dernière page complétée, une annotation à l'encre brune. L'écriture penchée de Maëlys." },
      { s: 'narr', t: "« Cette route n'a pas été oubliée. Elle a été effacée — volontairement. Le gardien des ronces n'était pas là pour te barrer la route : il gardait le silence de la roue. »" },
      { s: 'narr', t: "« Les Conservateurs savent pourquoi. »" },
      { s: 'narr', t: "« Ne me cherche pas encore à Brumecime. Pas avant d'avoir compris ce que les chemins protègent. — M. »" },
      { s: 'eloi', t: "Volontairement… Maëlys, dans quoi est-ce que tu t'es lancée ?", m: 'souci' },
      { s: 'eloi', t: "« Pas avant d'avoir compris. » Toujours une longueur d'avance, hein ?" },
      { s: 'eloi', t: "Très bien. Je vais comprendre. Et cette fois, je ne claquerai pas la porte : je viendrai te chercher." },
    ]);
    setFlag('chapter_done'); S.chapterDone = true;
    S.log.push('La route effacée est revenue. Fin du prologue.');
    this.quest();
    this.save('fin');
    audio.sfx('fanfare');
    await ui.chapterEnd();
    this.busy = false;
  }

  /** Point au bout de la route, côté est, où le Conservateur apparaît (sur une case praticable). */
  private watcherSpot(): [number, number] {
    for (const [x, y] of [[2260, 1080], [2230, 1100], [2200, 1060], [2150, 1100]] as [number, number][]) if (this.nav.freeAt(x, y)) return [x, y];
    return [2200, 1080];
  }

  // ============================================================== combat façon aventure
  private slash(tx: number, ty: number) {
    const a = Math.atan2(ty - 30 - (this.hero.y - 30), tx - this.hero.x);
    const sl = this.add.image(this.hero.x + Math.cos(a) * 26, this.hero.y - 30 + Math.sin(a) * 18, 'fx_slash').setRotation(a).setScale(0.9 / this.S_).setDepth(this.hero.y + 5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: sl, alpha: 0, scale: 1.2 / this.S_, duration: 180, onComplete: () => sl.destroy() });
  }
  private spark(x: number, y: number) {
    const s = this.add.image(x, y, 'fx_spark').setScale(1.4 / this.S_).setDepth(9e6).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: s, alpha: 0, scale: 2.4 / this.S_, angle: 90, duration: 260, onComplete: () => s.destroy() });
  }
  /** Fauche une touffe d'herbe : brins qui volent, parfois un cœur caché. */
  private mow(img: Phaser.GameObjects.Image) {
    if (!img.active || !img.visible) return;
    audio.sfx('page');
    for (let i = 0; i < 7; i++) {
      const b = this.add.image(img.x, img.y - 12, 'fx_blade').setScale(1 / this.S_).setDepth(img.y + 10).setRotation(Math.random() * 6);
      this.tweens.add({ targets: b, x: img.x + (Math.random() - 0.5) * 60, y: img.y - 10 - Math.random() * 30, angle: 360, alpha: 0, duration: 600, ease: 'Quad.easeOut', onComplete: () => b.destroy() });
    }
    img.setVisible(false).setAlpha(0);
    this.cut.add(`${this.zone.id}:${img.x}:${img.y}`);
    if (Math.random() < (S.hp < S.maxHp ? 0.22 : 0.08)) this.dropHeart(img.x, img.y);
  }
  dropHeart(x: number, y: number) {
    const h = this.add.image(x, y - 10, 'fx_heart').setScale(1 / this.S_).setDepth(y + 1);
    this.tweens.add({ targets: h, y: y - 26, duration: 220, yoyo: true, ease: 'Quad.easeOut' });
    this.tweens.add({ targets: h, scale: 1.12 / this.S_, duration: 500, yoyo: true, repeat: -1, delay: 450 });
    this.hearts.push(h);
    this.time.delayedCall(14000, () => { if (h.active) { this.tweens.add({ targets: h, alpha: 0, duration: 600, onComplete: () => h.destroy() }); } });
  }
  private collectHearts() {
    for (const h of this.hearts) {
      if (!h.active) continue;
      if (Math.hypot(h.x - this.hero.x, h.y - 14 - this.hero.y) < 34) {
        h.destroy(); S.hp = Math.min(S.maxHp, S.hp + 1); audio.sfx('heal'); ui.hearts();
      }
    }
    this.hearts = this.hearts.filter((h) => h.active);
  }
  /** Esquive (roulade) : bond rapide, invulnérable un court instant. */
  dodge() {
    if (this.dodgeCd > 0 || this.dodgeT > 0 || this.busy || ui.isModal()) return;
    let ax = this.vx, ay = this.vy;
    const threats: [number, number][] = this.combat.enemies.filter((e) => e.alive).map((e) => [e.x, e.y]);
    if (this.boss && this.bossActive) threats.push([this.boss.x, this.boss.y]);
    if (threats.length) {
      threats.sort((p, q) => Math.hypot(p[0] - this.hero.x, p[1] - this.hero.y) - Math.hypot(q[0] - this.hero.x, q[1] - this.hero.y));
      const [tx, ty] = threats[0];
      const a = Math.atan2(this.hero.y - ty, this.hero.x - tx) + (Math.random() < 0.5 ? 0.9 : -0.9);
      ax = Math.cos(a); ay = Math.sin(a);
    }
    if (Math.hypot(ax, ay) < 0.1) { const d = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.hero.dir]; ax = d[0]; ay = d[1]; }
    const n = Math.hypot(ax, ay); this.dodgeV = [ax / n, ay / n];
    this.dodgeT = 0.24; this.dodgeCd = 0.65; this.inv = Math.max(this.inv, 0.42);
    this.path = []; if (this.target?.kind === 'point') this.target = null;
    this.hero.faceToward(this.hero.x + ax * 10, this.hero.y + ay * 10); this.hero.play('run', true);
    audio.sfx('whoosh');
  }
  private updateDodge(dt: number) {
    this.dodgeT -= dt;
    const sp = 430 * dt;
    const nx = this.hero.x + this.dodgeV[0] * sp, ny = this.hero.y + this.dodgeV[1] * sp;
    if (this.nav.freeAt(nx, ny)) this.hero.setPos(nx, ny);
    this.hero.sprite.setAngle(this.dodgeT > 0 ? Math.sin((0.24 - this.dodgeT) / 0.24 * Math.PI) * 18 * Math.sign(this.dodgeV[0] || 1) : 0);
    this.atmo.dust(this.hero.x, this.hero.y, 'dirt');
    if (this.dodgeT <= 0) { this.hero.sprite.setAngle(0); this.hero.play('idle', true); }
  }

  // ============================================================== le Gardien des Ronces
  private async startBossFight() {
    if (!this.boss || this.bossActive) return;
    this.busy = true; this.stopHero();
    S.checkpoint = { zone: 'moulin', x: ARENA.x, y: ARENA.y + ARENA.r - 50 };
    this.bossActive = true;
    // anneau de ronces : l'arène se referme
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, x = ARENA.x + Math.cos(a) * (ARENA.r + 20), y = ARENA.y + Math.sin(a) * (ARENA.r + 20);
      const k = 'p:bramble:70:' + (i % 5 + 30) + '@' + this.S_;
      if (!this.textures.exists(k)) this.textures.addCanvas(k, propTex('bramble:70:' + (i % 5 + 30), this.S_).canvas);
      const b = this.add.image(x, y + 20, k).setScale(0.2 / this.S_).setOrigin(0.5, 0.85).setDepth(y);
      this.tweens.add({ targets: b, scale: 1 / this.S_, y, duration: 500, delay: i * 25, ease: 'Back.easeOut' });
      this.bossRing.push(b);
    }
    audio.sfx('slam'); this.cameras.main.shake(400, 0.006);
    audio.play('danger');
    await this.pan([this.boss.x, this.boss.y - 60], 900, 200);
    this.boss.appear();
    await this.wait(700);
    await this.say([
      { s: 'narr', t: "Les ronces qui étouffent la roue se mettent à bouger. Elles se rassemblent, se tressent, se dressent…" },
      { s: 'eloi', t: "Ce n'est pas une haie. C'est un gardien. Quelqu'un l'a planté là pour que le moulin se taise !", m: 'surprise' },
      { s: 'narr', t: "Au centre de la masse d'épines bat un cœur d'ambre, enfermé dans des pétales d'écorce." },
    ]);
    if (!flag('tuto_boss')) { setFlag('tuto_boss'); ui.toast('Ses ronces sont invulnérables : esquivez les coups annoncés, et frappez son cœur quand il s\'ouvre.', 'info'); }
    await this.pan([this.hero.x, this.hero.y], 700, 0);
    this.boss.onDefeat = () => void this.bossDefeated();
    ui.setDodge(true);
    this.engaged = true; ui.setDanger(true);
    this.busy = false;
  }

  private async bossDefeated() {
    this.busy = true; this.stopHero();
    this.bossActive = false; ui.bossBar(null); ui.setDodge(false); this.engaged = false; ui.setDanger(false); this.applyZoom();
    for (const [i, b] of this.bossRing.entries()) this.tweens.add({ targets: b, scale: 0, alpha: 0, duration: 400, delay: i * 20, onComplete: () => b.destroy() });
    this.bossRing = [];
    setFlag('boss_done');
    audio.play('moulin');
    await this.say([
      { s: 'narr', t: "Le cœur d'ambre se fend. Les ronces sèchent d'un coup, tombent en poussière autour de la roue." },
      { s: 'narr', t: "Dans les cendres, une graine dure comme une pierre, chaude comme une braise : un cœur de chêne." },
      { s: 'eloi', t: "Le moulin est libre. Maintenant, la roue." },
    ]);
    this.give('coeur_chene');
    S.maxHp += 1; S.hp = S.maxHp; ui.hearts();
    this.toast('Cœur de chêne : un cœur de plus !', 'secret');
    S.log.push('Le Gardien des Ronces est vaincu. Le moulin est libre.');
    this.rebuild(); this.quest(); this.save('boss');
    this.busy = false;
  }

  // ============================================================== API scripts
  say(lines: Line[]): Promise<void> { return ui.dialogue(lines, (s) => this.speaking(s)); }
  choose(prompt: Line | null, options: string[]): Promise<number> { return ui.choose(prompt, options); }
  private speaking(s: string | null) {
    this.hero.play(s === 'eloi' ? 'talk' : 'idle');
    for (const n of this.npcs.npcs.values()) if (n.talking) n.actor.play(s === n.id ? 'talk' : 'idle');
    for (const a of this.memActors) a.play(s === a.id ? 'talk' : 'idle');
  }
  toast(msg: string, kind: 'decouverte' | 'objet' | 'info' | 'quete' | 'secret' = 'info') { ui.toast(msg, kind); }
  give(item: string, silent = false) {
    if (addItem(item) && !silent) { this.toast(`Objet obtenu : ${ITEMS[item]?.name ?? item}`, 'objet'); audio.sfx('item'); ui.badge('inventaire'); }
  }
  take(item: string) { removeItem(item); }
  async anim(name: 'inspect' | 'atlas' | 'talk' | 'work', ms = 800) {
    const key = name === 'work' ? 'inspect' : name;
    this.hero.play(key as any, true);
    if (name === 'atlas') audio.sfx('page');
    this.busyUntil = this.time.now + ms;
    await this.wait(ms);
    this.hero.play('idle', true);
  }
  sfx(name: string, opt?: { pitch?: number }) { audio.sfx(name, opt); }
  save(_reason?: string) { if (this.slot >= 0) writeSlot(this.slot, S); ui.saved(); }
  wait(ms: number) { return new Promise<void>((r) => this.time.delayedCall(ms, () => r())); }
  async pan(to: Pt, ms: number, hold = 0) {
    (this as any)._panning = true;
    const cam = this.cameras.main;
    await new Promise<void>((r) => cam.pan(to[0], to[1], ms, 'Sine.easeInOut', true, (_c: any, p: number) => { if (p >= 1) r(); }));
    await this.wait(hold);
    this.camX = cam.midPoint.x; this.camY = cam.midPoint.y;
    (this as any)._panning = false;
    this.camHold = true;
  }
  async fx(effect: string, data?: any) {
    if (effect === 'memory') { await this.playMemory(data as string); return; }
    if (effect === 'borne') this.drawArrow(data as number);
    if (effect === 'bornesGlow') {
      this.arrows.forEach((a, i) => { this.drawArrow(i); const s = this.add.image(a.x, a.y, 'fx_soft').setScale(4).setBlendMode(Phaser.BlendModes.ADD).setTint(0xffd36a).setDepth(9e6); this.tweens.add({ targets: s, alpha: 0, scale: 7, duration: 1400, onComplete: () => s.destroy() }); });
      await this.wait(600);
    }
    if (effect === 'stones') this.updateStones();
    if (effect === 'mist') {
      const m = this.props.find((p) => p.def.tex.startsWith('mist'));
      if (m) await new Promise<void>((r) => this.tweens.add({ targets: m.img, alpha: 0, y: m.img.y - 60, duration: 1600, onComplete: () => r() }));
      await this.pan([1150, 300], 1000, 600);
    }
    if (effect === 'mill') this.refreshMill();
    if (effect === 'wheelWeak' && this.wheel) { this.tweens.add({ targets: this.wheel, angle: '+=8', yoyo: true, duration: 500, ease: 'Sine.easeInOut' }); audio.sfx('creak'); await this.wait(700); }
    if (effect === 'wheelStart') { this.refreshMill(); audio.sfx('creak'); this.cameras.main.shake(400, 0.003); await this.pan([1450, 820], 900, 1600); }
  }
  quest() {
    const st = currentMainStep()?.id ?? 'fin';
    if (st !== this.lastStep) {
      this.lastStep = st;
      const step = MAIN.find((m) => m.id === st);
      if (step) { this.toast(`Nouvel objectif : ${step.title}`, 'quete'); audio.sfx('quest'); ui.badge('journal'); }
    }
    const sig = this.sideSig();
    if (sig !== this.sideState) {
      const prev = this.sideState; this.sideState = sig;
      SIDE.forEach((q, i) => { if (sig[i * 2] === '1' && prev[i * 2] !== '1') this.toast(`Mission : ${q.title}`, 'quete'); if (sig[i * 2 + 1] === '1' && prev[i * 2 + 1] !== '1') this.toast(`Mission accomplie : ${q.title}`, 'quete'); });
    }
    ui.refresh();
  }
  private sideSig() { return SIDE.map((q) => `${q.started() ? 1 : 0}${q.done() ? 1 : 0}`).join(''); }
  run(fx: string[]) {
    for (const f of fx) {
      const [k, ...rest] = f.split(':'); const v = rest.join(':');
      if (k === 'flag') setFlag(v);
      else if (k === 'give') this.give(v);
      else if (k === 'take') removeItem(v);
      else if (k === 'clue') { if (addClue(v)) { this.toast(`Nouvel indice : ${CLUES[v]?.title ?? v}`, 'decouverte'); ui.badge('atlas'); } }
      else if (k === 'note') { if (addNote(v)) { this.toast(`Nouvelle annotation : ${NOTES[v]?.title ?? v}`, 'decouverte'); audio.sfx('discover'); ui.badge('atlas'); } }
      else if (k === 'log') S.log.push(v);
      else if (k === 'baume') { S.counters.baume = (S.counters.baume ?? 0) + Number(v); this.give('baume'); }
      else if (k === 'save') this.save();
      else if (k === 'quest') this.quest();
      else if (k === 'memory') this.pendingMem = v;
    }
  }

  /** Utilisation d'un objet depuis l'inventaire. */
  async useItem(id: string) {
    if (id === 'baume') {
      if (S.hp >= S.maxHp) { this.toast('Éloi est en pleine forme.', 'info'); return; }
      S.counters.baume = (S.counters.baume ?? 1) - 1;
      if (S.counters.baume <= 0) removeItem('baume');
      S.hp = Math.min(S.maxHp, S.hp + 3); audio.sfx('heal'); ui.hearts(); this.toast('Baume appliqué : +3 cœurs', 'info');
      return;
    }
    if (id === 'atlas') { ui.openPanel('atlas'); return; }
    this.selectedItem = id;
    ui.selectItem(id);
  }

  combine(a: string, b: string): boolean {
    const pair = [a, b].sort().join('+');
    if (pair === 'page_droite+page_gauche') {
      removeItem('page_gauche'); removeItem('page_droite'); this.give('page_maelys'); addNote('note_page');
      audio.sfx('discover'); this.toast('Les deux moitiés se rejoignent : une page du carnet de Maëlys', 'decouverte'); this.save();
      return true;
    }
    return false;
  }

  /** Angle (radians, écran) de la boussole vers l'objectif, ou null. */
  compass(): number | null {
    if (!flag('boussole_ok') || flag('chapter_done')) return null;
    const st = currentMainStep()?.id;
    const goals: Record<string, [ZoneId, number, number]> = {
      bois: ['clairval', 1300, 230], anton: ['bois', 1760, 1440], pierres: ['bois', 1100, 770], gardien: ['moulin', ARENA.x, ARENA.y], moulin: flag('mill_unlocked') ? ['moulin_int', 560, 360] : ['moulin', 1190, 940], roue: ['moulin', 1500, 500], route: ['moulin', 1250, 960],
    };
    const g = st ? goals[st] : undefined; if (!g) return null;
    let [gz, gx, gy] = g;
    if (gz !== this.zone.id) {
      const hop = nextHop(this.zone.id, gz); if (!hop) return null;
      gx = hop[0]; gy = hop[1];
    }
    return Math.atan2(gy - this.hero.y, gx - this.hero.x);
  }

  settingsChanged(s: Settings) { this.settings = s; audio.setVolumes(s.music, s.sfx); }
  hpPct() { return S.hp / S.maxHp; }
  isEngaged() { return this.engaged; }
}

function nextHop(from: ZoneId, to: ZoneId): Pt | null {
  const prev = new Map<ZoneId, { z: ZoneId; at: Pt }>();
  const q: ZoneId[] = [from]; const seen = new Set([from]);
  while (q.length) {
    const z = q.shift()!;
    if (z === to) break;
    for (const e of ZONES[z].exits) { if (seen.has(e.to) || (e.cond === 'route_revealed' && !flag('route_revealed'))) continue; seen.add(e.to); prev.set(e.to, { z, at: [e.rect.x + e.rect.w / 2, e.rect.y + e.rect.h / 2] }); q.push(e.to); }
  }
  let cur = to; let step: { z: ZoneId; at: Pt } | undefined;
  while ((step = prev.get(cur))) { if (step.z === from) return step.at; cur = step.z; }
  return null;
}
