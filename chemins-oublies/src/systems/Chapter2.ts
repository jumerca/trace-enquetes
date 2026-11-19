// Logique pure des énigmes du Chapitre II (aucun affichage). L'état vit dans S.counters.
import { S } from '../core/state';
import type { Pt } from '../world/types';

// ---- Les pierres veilleuses : saule, corbeau, cloche, lanterne. L'œil fermé (le signe des Conservateurs) est un piège.
export const VEILLE_ORDER = ['saule', 'corbeau', 'cloche', 'lanterne'];
export const VEILLES = ['saule', 'corbeau', 'cloche', 'lanterne', 'oeil'];
export const veilleLit = (sym: string) => VEILLE_ORDER.indexOf(sym) >= 0 && VEILLE_ORDER.indexOf(sym) < (S.counters.veille ?? 0);

/** Éveille une pierre. Retourne 'progress' | 'wrong' | 'trap' | 'solved'. */
export function touchVeille(sym: string): 'progress' | 'wrong' | 'trap' | 'solved' {
  const n = S.counters.veille ?? 0;
  if (sym === 'oeil') { S.counters.veille = 0; return 'trap'; }
  if (VEILLE_ORDER.indexOf(sym) !== n) { S.counters.veille = 0; return 'wrong'; }
  S.counters.veille = n + 1;
  return S.counters.veille >= VEILLE_ORDER.length ? 'solved' : 'progress';
}

// ---- Les miroirs de la Tour des Vents. '/' renvoie est→haut ; '\' renvoie est→bas.
export const MIRRORS: Record<string, { x: number; y: number; start: 0 | 1 }> = {
  miroirA: { x: 100, y: 300, start: 0 },
  miroirB: { x: 590, y: 300, start: 0 },
  miroirC: { x: 590, y: 440, start: 1 },
  miroirD: { x: 420, y: 440, start: 0 },
};
export const WINDOW: Pt = [100, 205];
export const LENS: Pt = [420, 250];
/** true si le miroir est en « \ » */
export const mirrorBack = (id: string) => ((S.counters['m_' + id] ?? MIRRORS[id].start) === 1);
export function toggleMirror(id: string) { S.counters['m_' + id] = mirrorBack(id) ? 0 : 1; }

/** Suit le rayon depuis la fenêtre : points du trajet et si la lentille est atteinte. */
export function traceBeam(): { pts: Pt[]; lit: boolean } {
  let [x, y] = WINDOW; let dx = 0, dy = 1;
  const pts: Pt[] = [[x, y]];
  for (let step = 0; step < 12; step++) {
    // prochain obstacle dans la direction (miroir aligné, lentille, ou mur)
    let best: { d: number; id?: string; lens?: boolean } | null = null;
    for (const [id, m] of Object.entries(MIRRORS)) {
      const d = dx ? (m.x - x) * dx : (m.y - y) * dy;
      const off = dx ? Math.abs(m.y - y) : Math.abs(m.x - x);
      if (d > 4 && off < 6 && (!best || d < best.d)) best = { d, id };
    }
    { const d = dx ? (LENS[0] - x) * dx : (LENS[1] - y) * dy; const off = dx ? Math.abs(LENS[1] - y) : Math.abs(LENS[0] - x); if (d > 4 && off < 6 && (!best || d < best.d)) best = { d, lens: true }; }
    if (!best) {
      // jusqu'au mur
      const tx = dx > 0 ? 680 : dx < 0 ? 40 : x, ty = dy > 0 ? 500 : dy < 0 ? 200 : y;
      pts.push([tx, ty]); return { pts, lit: false };
    }
    x += dx * best.d; y += dy * best.d; pts.push([x, y]);
    if (best.lens) return { pts, lit: true };
    const back = mirrorBack(best.id!);
    // '\' : (dx,dy)→(dy,dx) ; '/' : (dx,dy)→(-dy,-dx)
    [dx, dy] = back ? [dy, dx] : [-dy, -dx];
  }
  return { pts, lit: false };
}
