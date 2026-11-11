/**
 * Règlements. Les valeurs reprennent les règles officielles FIBA (2024) et NBA.
 * Seule la durée des quarts-temps peut être réduite, et uniquement en tant qu'option « arcade » explicite.
 */
export interface CourtGeo {
  length: number; // m
  width: number;
  hoopFromBaseline: number; // centre de l'anneau
  boardFromBaseline: number;
  boardHalfWidth: number;
  boardBottom: number;
  boardTop: number;
  rimHeight: number;
  rimRadius: number;
  threeRadius: number;
  cornerThreeFromSideline: number;
  keyHalfWidth: number;
  ftLineFromBaseline: number;
  ftRadius: number;
  restrictedRadius: number;
  centerRadius: number;
}

export interface Ruleset {
  id: 'FIBA' | 'NBA' | 'NCB';
  label: string;
  quarterMin: number;
  otMin: number;
  shotClock: number;
  offRebReset: number;
  backcourtSec: number;
  threeSec: number;
  foulOut: number;
  /** Lancers francs de pénalité à partir de la N-ième faute d'équipe dans le quart-temps */
  bonusAtFoul: number;
  timeouts: number;
  /** FIBA : le chrono s'arrête après panier marqué dans les 2 dernières minutes du 4e QT / prolongation */
  stopClockAfterMadeLast2: boolean;
  /** FIBA : flèche de possession alternée ; NBA : entre-deux à chaque prolongation */
  alternatingPossession: boolean;
  court: CourtGeo;
}

export const FIBA_COURT: CourtGeo = {
  length: 28,
  width: 15,
  hoopFromBaseline: 1.575,
  boardFromBaseline: 1.2,
  boardHalfWidth: 0.9,
  boardBottom: 2.9,
  boardTop: 3.95,
  rimHeight: 3.05,
  rimRadius: 0.225,
  threeRadius: 6.75,
  cornerThreeFromSideline: 0.9,
  keyHalfWidth: 2.45,
  ftLineFromBaseline: 5.8,
  ftRadius: 1.8,
  restrictedRadius: 1.25,
  centerRadius: 1.8,
};

export const NBA_COURT: CourtGeo = {
  length: 28.65,
  width: 15.24,
  hoopFromBaseline: 1.6,
  boardFromBaseline: 1.22,
  boardHalfWidth: 0.915,
  boardBottom: 2.9,
  boardTop: 3.97,
  rimHeight: 3.05,
  rimRadius: 0.2286,
  threeRadius: 7.24,
  cornerThreeFromSideline: 0.91,
  keyHalfWidth: 2.44,
  ftLineFromBaseline: 5.79,
  ftRadius: 1.83,
  restrictedRadius: 1.22,
  centerRadius: 1.83,
};

export const FIBA: Ruleset = {
  id: 'FIBA',
  label: 'FIBA',
  quarterMin: 10,
  otMin: 5,
  shotClock: 24,
  offRebReset: 14,
  backcourtSec: 8,
  threeSec: 3,
  foulOut: 5,
  bonusAtFoul: 5,
  timeouts: 5,
  stopClockAfterMadeLast2: true,
  alternatingPossession: true,
  court: FIBA_COURT,
};

export const NBA: Ruleset = {
  id: 'NBA',
  label: 'NBA',
  quarterMin: 12,
  otMin: 5,
  shotClock: 24,
  offRebReset: 14,
  backcourtSec: 8,
  threeSec: 3,
  foulOut: 6,
  bonusAtFoul: 5,
  timeouts: 7,
  stopClockAfterMadeLast2: true,
  alternatingPossession: false,
  court: NBA_COURT,
};

/**
 * Ligue universitaire fictive NCB : format en 4 × 10 min avec horloge de tir de 30 s
 * (format utilisé par le basket universitaire féminin américain). Terrain FIBA.
 */
export const NCB: Ruleset = {
  ...FIBA,
  id: 'NCB',
  label: 'Universitaire (4×10, 30 s)',
  shotClock: 30,
  offRebReset: 20,
  backcourtSec: 10,
  timeouts: 4,
};

export const RULESETS = { FIBA, NBA, NCB };

/** Option arcade explicite : durée de quart-temps réduite. Le reste du règlement est inchangé. */
export function withQuarterLength(r: Ruleset, minutes: number): Ruleset {
  const ratio = minutes / r.quarterMin;
  return { ...r, quarterMin: minutes, otMin: Math.max(1, Math.round(r.otMin * ratio * 2) / 2) };
}
