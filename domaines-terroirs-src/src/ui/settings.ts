// Réglages par appareil (confort uniquement : la partie elle-même est en IndexedDB).
export interface Settings {
  quality: 'haute' | 'basse';
  tutorial: boolean;
  perf: boolean; // afficher les performances
  adaptive: boolean; // alléger l'affichage automatiquement
  musique: number; // volume 0..1
  ambiance: number; // bruits de la ferme 0..1
}
const KEY = 'dt-reglages';
export function loadSettings(): Settings {
  const def: Settings = { quality: 'haute', tutorial: true, perf: false, adaptive: true, musique: 0.5, ambiance: 0.7 };
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return def;
  }
}
export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : réglage conservé pour la session seulement */
  }
}
