import type { V2 } from '../core/vec';
import type { CourtGeo } from './rules';

/** Coordonnées : x le long du terrain (0 = ligne de fond gauche), y en largeur. Hauteur z. Unité : mètre. */
export class Court {
  constructor(public g: CourtGeo) {}
  get cy(): number {
    return this.g.width / 2;
  }
  /** Panier côté +1 (droite) ou -1 (gauche) */
  hoop(side: 1 | -1): V2 {
    return { x: side === 1 ? this.g.length - this.g.hoopFromBaseline : this.g.hoopFromBaseline, y: this.cy };
  }
  boardX(side: 1 | -1): number {
    return side === 1 ? this.g.length - this.g.boardFromBaseline : this.g.boardFromBaseline;
  }
  baselineX(side: 1 | -1): number {
    return side === 1 ? this.g.length : 0;
  }
  /** Convertit un repère « panier » (u = distance vers le milieu de terrain, v = latéral) en monde. */
  fromHoop(side: 1 | -1, u: number, v: number): V2 {
    const h = this.hoop(side);
    return { x: h.x - side * u, y: this.cy + v };
  }
  toHoop(side: 1 | -1, p: V2): { u: number; v: number } {
    const h = this.hoop(side);
    return { u: (h.x - p.x) * side, v: p.y - this.cy };
  }
  isThree(side: 1 | -1, p: V2): boolean {
    const h = this.hoop(side);
    const dy = Math.abs(p.y - h.y);
    const cornerLimit = this.g.width / 2 - this.g.cornerThreeFromSideline;
    const straightDepth = Math.sqrt(Math.max(0, this.g.threeRadius ** 2 - cornerLimit ** 2));
    const u = (h.x - p.x) * side;
    if (u <= straightDepth) return dy >= cornerLimit;
    return Math.hypot(p.x - h.x, p.y - h.y) >= this.g.threeRadius;
  }
  inBounds(p: V2, margin = 0): boolean {
    return p.x >= -margin && p.x <= this.g.length + margin && p.y >= -margin && p.y <= this.g.width + margin;
  }
  inKey(side: 1 | -1, p: V2): boolean {
    const bx = this.baselineX(side);
    const depth = (bx - p.x) * side;
    return depth >= 0 && depth <= this.g.ftLineFromBaseline && Math.abs(p.y - this.cy) <= this.g.keyHalfWidth;
  }
  /** Moitié de terrain offensive de l'équipe qui attaque `side` */
  inFrontcourt(side: 1 | -1, p: V2): boolean {
    return side === 1 ? p.x > this.g.length / 2 : p.x < this.g.length / 2;
  }
  clampInside(p: V2, margin = 0.25): V2 {
    return {
      x: Math.min(this.g.length - margin, Math.max(margin, p.x)),
      y: Math.min(this.g.width - margin, Math.max(margin, p.y)),
    };
  }
}
