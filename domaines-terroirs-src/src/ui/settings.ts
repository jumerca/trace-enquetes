// Réglages par appareil (confort uniquement : la partie elle-même est en IndexedDB).
export interface Settings {
  quality: 'haute' | 'basse';
  tutorial: boolean;
}
const KEY = 'dt-reglages';
export function loadSettings(): Settings {
  const def: Settings = { quality: 'haute', tutorial: true };
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
