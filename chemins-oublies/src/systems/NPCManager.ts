// NPCManager : habitants visibles dans la zone, suivi des routines (déplacements, pauses, travail), arrêt pour parler.
import Phaser from 'phaser';
import { S, ZoneId } from '../core/state';
import { ROUTINES, NPC_IDS, NpcId, Place } from '../data/npcs';
import { Actor } from './Actor';
import type { NavGrid } from './Navigation';
import type { Pt } from '../world/types';
import { ZONES } from '../world/zones';

export class Npc {
  actor: Actor;
  place: Place;
  idx = 0;
  path: Pt[] = [];
  wait = 0;
  talking = false;
  leaving = false;
  constructor(scene: Phaser.Scene, public id: NpcId, place: Place, x: number, y: number, S_: number) {
    this.place = place;
    this.actor = new Actor(scene, id, x, y, S_);
    this.actor.setPos(x, y);
    if (place.face) this.actor.face(place.face);
    this.actor.play(place.mode === 'work' ? 'work' : 'idle', true);
  }
  get x() { return this.actor.x; }
  get y() { return this.actor.y; }
  get talkRange() { return this.place.talkRange ?? 54; }
}

export class NPCManager {
  npcs = new Map<NpcId, Npc>();
  private sig = '';
  constructor(private scene: Phaser.Scene, private S_: number) {}

  /** (Re)place les habitants pour la zone courante. */
  spawn(zone: ZoneId) {
    this.clear();
    for (const id of NPC_IDS) {
      const p = ROUTINES[id]();
      if (!p || p.zone !== zone) continue;
      const [x, y] = p.mode === 'loop' ? p.pts[Math.floor((S.clock / 7) % p.pts.length)] : p.pts[0];
      const n = new Npc(this.scene, id, p, x, y, this.S_);
      n.idx = p.pts.findIndex((q) => q[0] === x && q[1] === y);
      this.npcs.set(id, n);
    }
    this.sig = this.signature();
  }
  clear() { this.npcs.forEach((n) => n.actor.destroy()); this.npcs.clear(); }

  private signature() { return NPC_IDS.map((id) => { const p = ROUTINES[id](); return p ? p.zone + p.where : '-'; }).join('|'); }

  update(dt: number, nav: NavGrid, zone: ZoneId, hero: Pt) {
    // changement d'horaire : les habitants partent / arrivent en marchant
    const sig = this.signature();
    if (sig !== this.sig) {
      this.sig = sig;
      for (const id of NPC_IDS) {
        const p = ROUTINES[id]();
        const n = this.npcs.get(id);
        if (n && (!p || p.zone !== zone)) {
          // s'en va vers la porte ou le bord le plus proche
          const exit = ZONES[zone].exits.find((e) => p && e.to === p.zone);
          const tgt: Pt = exit ? [exit.rect.x + exit.rect.w / 2, exit.rect.y + exit.rect.h / 2 + 10] : [n.x, n.y];
          n.leaving = true; n.path = nav.findPath([n.x, n.y], nav.nearestFree(tgt[0], tgt[1], 4) ?? tgt, false) ?? [];
          if (!n.path.length) { n.actor.destroy(); this.npcs.delete(id); }
        } else if (n && p) {
          n.place = p; n.idx = 0; n.path = nav.findPath([n.x, n.y], p.pts[0], false) ?? []; n.wait = 0;
        } else if (!n && p && p.zone === zone) {
          // arrive par la porte qui mène à sa zone précédente, sinon apparaît discrètement
          const exit = ZONES[zone].exits.find((e) => e.door);
          const from: Pt = exit && ZONES[zone].interior ? [exit.at[0], exit.at[1]] : exit && Math.hypot(exit.rect.x - hero[0], exit.rect.y - hero[1]) > 200 ? [exit.rect.x + exit.rect.w / 2, exit.rect.y + exit.rect.h + 20] : p.pts[0];
          const nn = new Npc(this.scene, id, p, from[0], from[1], this.S_);
          nn.path = nav.findPath(from, p.pts[0], false) ?? [];
          this.npcs.set(id, nn);
        }
      }
    }
    for (const n of this.npcs.values()) this.step(n, dt, nav);
  }

  private step(n: Npc, dt: number, nav: NavGrid) {
    if (n.talking) return;
    const speed = n.place.speed ?? 62;
    if (n.path.length) {
      const [tx, ty] = n.path[0];
      const dx = tx - n.x, dy = ty - n.y, d = Math.hypot(dx, dy);
      const st = speed * dt;
      if (d <= st) { n.actor.setPos(tx, ty); n.path.shift(); }
      else n.actor.setPos(n.x + (dx / d) * st, n.y + (dy / d) * st);
      n.actor.faceToward(tx, ty);
      n.actor.play('walk');
      if (!n.path.length) {
        if (n.leaving) { n.actor.destroy(); this.npcs.delete(n.id); return; }
        n.wait = n.place.pause ?? 2;
        n.actor.play(n.place.mode === 'work' || (n.place.mode === 'loop' && (n.id === 'agathe' || n.id === 'mara' || n.id === 'odile')) ? 'work' : 'idle');
        if (n.place.face && n.place.mode !== 'loop') n.actor.face(n.place.face);
      }
      return;
    }
    if (n.place.mode === 'loop' && n.place.pts.length > 1) {
      n.wait -= dt;
      if (n.wait <= 0) {
        n.idx = (n.idx + 1) % n.place.pts.length;
        n.path = nav.findPath([n.x, n.y], n.place.pts[n.idx], false) ?? [n.place.pts[n.idx]];
      }
    }
  }

  pick(wx: number, wy: number, pad: number): Npc | null {
    let best: Npc | null = null;
    for (const n of this.npcs.values()) {
      if (Math.abs(wx - n.x) < 18 + pad && wy < n.y + 8 + pad && wy > n.y - 66 - pad && (!best || n.y > best.y)) best = n;
    }
    return best;
  }

  markDyn(nav: NavGrid, except?: NpcId) { nav.clearDyn(); for (const n of this.npcs.values()) if (n.id !== except) nav.markDyn(n.x, n.y, 18); }
}
