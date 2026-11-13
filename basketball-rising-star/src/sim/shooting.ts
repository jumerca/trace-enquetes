import { clamp } from '../core/vec';
import type { PlayerData } from '../data/model';
import type { ShotType } from './types';

/**
 * Modèle de tir : les attributs, la contestation et la fatigue déterminent la précision de la visée
 * (écart-type de l'erreur), puis la trajectoire est simulée physiquement (anneau, planche, filet).
 * Les tables ci-dessous ont été mesurées avec scripts/calib.ts (1 500 tirs simulés par point).
 */
const SIGMAS = [0.02, 0.05, 0.08, 0.11, 0.14, 0.18, 0.22, 0.27, 0.33, 0.4, 0.5];
/** [distance, probabilités mesurées pour chaque sigma] */
const TABLES: [number, number[]][] = [
  [1.2, [1.0, 1.0, 0.99, 0.94, 0.85, 0.71, 0.57, 0.46, 0.35, 0.29, 0.2]],
  [1.8, [1.0, 1.0, 0.99, 0.91, 0.81, 0.62, 0.53, 0.4, 0.3, 0.25, 0.19]],
  [3.5, [1.0, 1.0, 0.95, 0.85, 0.72, 0.55, 0.45, 0.33, 0.26, 0.2, 0.14]],
  [4.5, [1.0, 0.99, 0.92, 0.79, 0.66, 0.53, 0.39, 0.3, 0.24, 0.18, 0.15]],
  [7.0, [1.0, 0.98, 0.86, 0.74, 0.61, 0.46, 0.35, 0.27, 0.2, 0.16, 0.11]],
];

/**
 * Corrections mesurées dans le moteur complet (scripts/calib2.ts) : la géométrie réelle des tirs
 * en match (angles, hauteur de lâcher, déplacement) diffère légèrement du banc de calibration.
 */
const TYPE_CORRECTION: Partial<Record<ShotType, number>> = { layup: 1.32, dunk: 0.82, three: 1.17, jumper: 1.05, floater: 1.0, hook: 1.0 };
export function sigmaForShot(p: number, dist: number, type: ShotType): number {
  return sigmaFor(Math.min(0.985, p * (TYPE_CORRECTION[type] ?? 1)), dist);
}

function invert(table: number[], p: number): number {
  const target = clamp(p, 0.08, 0.995);
  for (let i = 1; i < table.length; i++) {
    if (table[i] <= target) {
      const a = table[i - 1];
      const b = table[i];
      const t = a === b ? 0 : (a - target) / (a - b);
      return SIGMAS[i - 1] + (SIGMAS[i] - SIGMAS[i - 1]) * t;
    }
  }
  return SIGMAS[SIGMAS.length - 1];
}

/** Écart-type de visée produisant (en moyenne) la probabilité de réussite visée à cette distance. */
export function sigmaFor(p: number, dist: number): number {
  if (dist <= TABLES[0][0]) return invert(TABLES[0][1], p);
  for (let i = 1; i < TABLES.length; i++) {
    if (dist <= TABLES[i][0]) {
      const [d0, t0] = TABLES[i - 1];
      const [d1, t1] = TABLES[i];
      const k = (dist - d0) / (d1 - d0);
      return invert(t0, p) * (1 - k) + invert(t1, p) * k;
    }
  }
  return invert(TABLES[TABLES.length - 1][1], p);
}

export interface ShotContext {
  type: ShotType;
  dist: number;
  contest: number; // 0 (ouvert) .. 1 (étouffé)
  offDribble: boolean;
  energy: number;
  hotness: number;
  clutch: number; // 0..1 pression du moment
  heightAdv: number; // (taille tireur - taille défenseur) en m
  confidence: number; // 0..100
}

const s = (v: number) => v / 20;

/** Probabilité « intrinsèque » de réussite d'un tir (avant simulation physique). */
export function shotProbability(p: PlayerData, c: ShotContext): number {
  const a = p.attrs;
  let base: number;
  let contestImpact: number;
  switch (c.type) {
    case 'dunk':
      base = 0.82 + s(a.dunk) * 0.14;
      contestImpact = 0.3;
      break;
    case 'layup':
      base = 0.5 + s(a.layup * 0.6 + a.finishing * 0.4) * 0.3 - Math.max(0, c.dist - 1.2) * 0.04;
      contestImpact = 0.42;
      break;
    case 'tip':
      base = 0.42 + s(a.finishing) * 0.2;
      contestImpact = 0.4;
      break;
    case 'floater':
      base = 0.3 + s(a.finishing * 0.5 + a.shotCreation * 0.2 + a.coordination * 0.3) * 0.22;
      contestImpact = 0.3;
      break;
    case 'hook':
      base = 0.32 + s(a.postPlay * 0.6 + a.footwork * 0.4) * 0.28;
      contestImpact = 0.32;
      break;
    case 'jumper': {
      const sk = c.offDribble ? a.pullUp * 0.55 + a.midRange * 0.45 : a.midRange * 0.6 + a.catchShoot * 0.4;
      // Tir ouvert un peu moins généreux, tir contesté inchangé (les tirs ouverts sont désormais tous pris)
      base = 0.315 + s(sk) * 0.26 - Math.max(0, c.dist - 4) * 0.008;
      contestImpact = 0.24;
      break;
    }
    case 'three': {
      const sk = c.offDribble ? a.three * 0.65 + a.pullUp * 0.35 : a.three * 0.7 + a.catchShoot * 0.3;
      base = 0.205 + s(sk) * 0.26 - Math.max(0, c.dist - 7.2) * 0.045;
      contestImpact = 0.22;
      break;
    }
    case 'ft':
      base = 0.42 + s(a.freeThrow) * 0.5;
      contestImpact = 0;
      break;
  }
  let p0 = base;
  p0 *= 1 - contestImpact * clamp(c.contest, 0, 1) * (1 - clamp(c.heightAdv, -0.2, 0.2));
  p0 *= 0.84 + 0.16 * clamp(c.energy, 0, 1);
  p0 *= 1 + 0.06 * c.hotness;
  p0 *= 1 + (c.confidence - 50) / 1000;
  if (c.clutch > 0) {
    const mental = s(a.pressure * 0.5 + a.composure * 0.5);
    p0 *= 1 + c.clutch * (mental - 0.55) * 0.18;
  }
  return clamp(p0, 0.03, 0.97);
}
