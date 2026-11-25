// Outils de projection isométrique et de dessin de volumes (PixiJS v8).
import { CanvasSource, Graphics, Texture } from 'pixi.js';
import { canvasOf, drawCharacter, drawVehicle, type CharSpec, type Pose, type VehSpec, type Dir } from './art';

export const TW = 64, TH = 32;

export function iso(x: number, y: number, z = 0): [number, number] {
  return [(x - y) * (TW / 2), (x + y) * (TH / 2) - z];
}

export function shadeN(c: number, f: number): number {
  const r = Math.min(255, Math.max(0, Math.round(((c >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((c >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((c & 255) * f)));
  return (r << 16) | (g << 8) | b;
}

export function mix(a: number, b: number, t: number): number {
  const r = ((a >> 16) & 255) * (1 - t) + ((b >> 16) & 255) * t;
  const g = ((a >> 8) & 255) * (1 - t) + ((b >> 8) & 255) * t;
  const bl = (a & 255) * (1 - t) + (b & 255) * t;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

const INK = 0x1d1a17;

export function poly(g: Graphics, pts: [number, number][], fill: number, alpha = 1, stroke = true, sw = 1) {
  g.poly(pts.flat()).fill({ color: fill, alpha });
  if (stroke) g.poly(pts.flat()).stroke({ width: sw, color: INK, alpha: 0.85 });
}

export function tile(g: Graphics, x: number, y: number, color: number, z = 0, alpha = 1, stroke = false) {
  poly(g, [iso(x, y, z), iso(x + 1, y, z), iso(x + 1, y + 1, z), iso(x, y + 1, z)], color, alpha, stroke, 0.5);
}

/** Prisme posé sur l'emprise [x, x+w] × [y, y+d], hauteur h (pixels), base z. */
export function box(g: Graphics, x: number, y: number, w: number, d: number, h: number, color: number, z = 0, opts: { top?: number; outline?: boolean; alpha?: number } = {}) {
  const o = opts.outline ?? true;
  const a = opts.alpha ?? 1;
  poly(g, [iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)], shadeN(color, 0.78), a, o);
  poly(g, [iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], shadeN(color, 0.9), a, o);
  poly(g, [iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)], opts.top ?? shadeN(color, 1.08), a, o);
}

/** Face verticale le long de l'axe x (mur nord/sud) ou y (mur ouest/est). */
export function wallX(g: Graphics, x0: number, x1: number, y: number, h: number, color: number, z = 0, alpha = 1) {
  poly(g, [iso(x0, y, z), iso(x1, y, z), iso(x1, y, z + h), iso(x0, y, z + h)], color, alpha);
}
export function wallY(g: Graphics, y0: number, y1: number, x: number, h: number, color: number, z = 0, alpha = 1) {
  poly(g, [iso(x, y0, z), iso(x, y1, z), iso(x, y1, z + h), iso(x, y0, z + h)], color, alpha);
}

// ————— Textures des personnages et véhicules (générées une fois, mises en cache) —————
const texCache = new Map<string, Texture>();
export const CHAR_W = 48, CHAR_H = 72;
// textures générées en haute définition (nettes même zoomées)
const RES = typeof window !== 'undefined' ? Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1) + 1)) : 1;
/** Texture lissée avec mipmaps : pas de crénelage quand le sprite est réduit (dézoom). */
function smoothTexture(cv: HTMLCanvasElement): Texture {
  return new Texture({ source: new CanvasSource({ resource: cv, resolution: RES, autoGenerateMipmaps: true, scaleMode: 'linear', antialias: true }) });
}

export function charTexture(s: CharSpec, pose: Pose, frame: number, back: boolean): Texture {
  const key = `c|${JSON.stringify(s)}|${pose}|${frame}|${back}`;
  let t = texCache.get(key);
  if (!t) {
    t = smoothTexture(canvasOf(CHAR_W, CHAR_H, RES, (ctx) => drawCharacter(ctx, s, pose, frame, back)));
    texCache.set(key, t);
  }
  return t;
}

export function vehTexture(v: VehSpec, dir: Dir, frame = 0): Texture {
  const key = `v|${JSON.stringify(v)}|${dir}|${frame}`;
  let t = texCache.get(key);
  if (!t) {
    t = smoothTexture(canvasOf(128, 96, RES, (ctx) => drawVehicle(ctx, v, dir, frame)));
    texCache.set(key, t);
  }
  return t;
}

export function clearTextureCache() {
  for (const t of texCache.values()) t.destroy(true);
  texCache.clear();
}

export function textureCount() {
  return texCache.size;
}

