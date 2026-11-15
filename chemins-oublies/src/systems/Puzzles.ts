// PuzzleManager : logique pure des trois énigmes (aucun affichage). L'état vit dans S et est sauvegardé.
import { S } from '../core/state';

// ---- Énigme 1 : les bornes. Orientation 0..7, 0 = est, sens horaire (y vers le bas).
export const BORNE_IDS = ['borneA', 'borneB', 'borneC'] as const;
export const BORNE_POS: Record<string, [number, number]> = { borneA: [1640, 1115], borneB: [2640, 1115], borneC: [2640, 815] };
export const BORNE_TARGET: [number, number] = [2860, 595]; // rocher fendu
export const DIR_LABEL = ['est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest', 'nord', 'nord-est'];

/** Solution déduite de la géométrie : chaque borne regarde la suivante, la dernière le rocher. */
export function borneSolution(): number[] {
  const pts = [BORNE_POS.borneA, BORNE_POS.borneB, BORNE_POS.borneC, BORNE_TARGET];
  return [0, 1, 2].map((i) => {
    const a = Math.atan2(pts[i + 1][1] - pts[i][1], pts[i + 1][0] - pts[i][0]);
    return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
  });
}

export function rotateBorne(i: number, delta: number): number {
  S.bornes[i] = (((S.bornes[i] + delta) % 8) + 8) % 8;
  return S.bornes[i];
}

export function bornesCorrect(): boolean {
  const sol = borneSolution();
  return S.bornes.every((v, i) => v === sol[i]);
}

// ---- Énigme 2 : les pierres gravées. Séquence attendue : eau, oiseau, clé (la lune est un leurre).
export const STONE_ORDER = ['eau', 'oiseau', 'cle'];
export const STONES: { sym: string; x: number; y: number }[] = [
  { sym: 'oiseau', x: 975, y: 690 }, { sym: 'lune', x: 1230, y: 685 }, { sym: 'cle', x: 965, y: 860 }, { sym: 'eau', x: 1240, y: 855 },
];

/** Touche une pierre. Retourne 'progress' | 'wrong' | 'solved'. */
export function touchStone(sym: string): 'progress' | 'wrong' | 'solved' {
  const idx = STONE_ORDER.indexOf(sym);
  const next = S.stones.length;
  if (idx !== next) { S.stones = []; return 'wrong'; }
  S.stones = STONE_ORDER.slice(0, next + 1).map((s) => STONE_ORDER.indexOf(s));
  if (S.stones.length === STONE_ORDER.length) return 'solved';
  return 'progress';
}
export const stoneLit = (sym: string) => S.stones.includes(STONE_ORDER.indexOf(sym));

// ---- Énigme 3 : les vannes du moulin. Simulation continue, entièrement déterministe.
// v1 = prise d'eau (rivière → bief), v2 = décharge (bief → rivière), v3 = vanne motrice (bief → roue).
export const FILL_RATE = 0.16; // par seconde (bief plein en ~6 s)
export const DRAIN_RATE = 0.3;
export const WHEEL_DRAIN = 0.55;
export const SURGE_MIN = 0.92; // niveau nécessaire pour décoller la roue

export interface MillEvents { wheelKick?: 'weak' | 'start'; overflow?: boolean }

/** Avance la simulation de dt secondes. La roue démarre seulement si : frein desserré, bief ≥ SURGE_MIN à l'ouverture de v3. */
export function stepMill(dt: number): MillEvents {
  const m = S.mill;
  const ev: MillEvents = {};
  if (m.solved) { m.level = m.v1 ? Math.min(1, m.level + dt * FILL_RATE) : m.level; return ev; }
  let lv = m.level;
  if (m.v1) lv += FILL_RATE * dt;
  if (m.v2) lv -= DRAIN_RATE * dt;
  if (m.v3) lv -= WHEEL_DRAIN * dt;
  if (lv > 1) { lv = 1; ev.overflow = true; }
  m.level = Math.max(0, lv);
  return ev;
}

/** Appelé quand le joueur actionne un levier. */
export function toggleVanne(which: 'v1' | 'v2' | 'v3'): MillEvents {
  const m = S.mill;
  const ev: MillEvents = {};
  m[which] = !m[which];
  if (which === 'v3' && m.v3) {
    if (!m.brake && m.level >= SURGE_MIN && !m.v2) { m.solved = true; ev.wheelKick = 'start'; }
    else ev.wheelKick = 'weak';
  }
  return ev;
}

/** Explication contextuelle (affichée à côté du levier) : ce que fait l'eau en ce moment. */
export function millStatus(): string {
  const m = S.mill;
  if (m.solved) return 'La roue tourne.';
  const parts: string[] = [];
  parts.push(m.v1 ? "La rivière entre dans le bief." : "La prise d'eau est fermée.");
  if (m.v2) parts.push("La décharge vide le bief dans la rivière.");
  if (m.v3) parts.push(m.brake ? "L'eau frappe la roue… freinée, elle ne bouge pas." : "Un filet d'eau tombe sur la roue.");
  parts.push(`Bief : ${Math.round(m.level * 100)} %`);
  return parts.join(' ');
}
