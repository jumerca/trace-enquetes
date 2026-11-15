import type { ZoneId, Dir } from '../core/state';

export type Pt = [number, number];

export interface PathDef { pts: Pt[]; w: number; kind: 'dirt' | 'cobble' | 'forest' | 'route' }
export interface AreaDef { poly: Pt[]; kind: 'cobble' | 'field' | 'garden' | 'sand' | 'wood' | 'stone' | 'moss' | 'dark' | 'mud' | 'rug' }
export interface WaterDef { pts: Pt[]; w: number; channel?: string } // channel = id d'un canal du moulin
export interface Rect { x: number; y: number; w: number; h: number }

/** Placement d'un décor : clé de texture (cf. world/textures.ts), position au sol, empreinte de collision. */
export interface PropDef {
  tex: string;
  x: number;
  y: number;
  foot?: { r: number } | { w: number; h: number; dy?: number };
  occlude?: boolean; // devient transparent quand le héros passe derrière
  depth?: number; // décalage de profondeur
  sway?: boolean; // feuillage animé
  smoke?: Pt; // cheminée (position relative)
  cond?: string; // visible seulement si (expression de drapeau, cf. evalCond)
  id?: string;
  flipX?: boolean;
  ground?: boolean; // posé à plat (pont, tapis) : sous les personnages
}

export interface ExitDef { rect: Rect; to: ZoneId; at: Pt; facing: Dir; cond?: string; blockedMsg?: string; door?: boolean }

export interface ZoneDef {
  id: ZoneId;
  name: string;
  w: number;
  h: number;
  interior?: boolean;
  grass: string[];
  floor?: string;
  paths: PathDef[];
  areas: AreaDef[];
  water: WaterDef[];
  bridges: Rect[];
  props: PropDef[];
  blockers: (Rect & { cond?: string })[];
  exits: ExitDef[];
  music: 'village' | 'foret' | 'interieur' | 'moulin';
  seed: number;
  /** cases franchissables imposées (intérieurs : sol) */
  walkPoly?: Pt[];
  dark?: number;
  /** sous-bois : seuls les sentiers (+marge) et les clairières sont praticables */
  corridor?: { pad: number; clearings: [number, number, number][] };
}

/** Évalue une condition de drapeaux : "a & !b | c". */
export function evalCond(expr: string | undefined, flag: (f: string) => boolean): boolean {
  if (!expr) return true;
  return expr.split('|').some((part) => part.split('&').every((t) => {
    t = t.trim();
    return t.startsWith('!') ? !flag(t.slice(1)) : flag(t);
  }));
}
