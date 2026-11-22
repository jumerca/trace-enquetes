// Préférences de l'appareil (indépendantes des sauvegardes de carrière).
export interface Settings {
  quality: 'auto' | 'haute' | 'economie';
  fpsCap: 30 | 60;
  showFps: boolean;
  names: boolean; // étiquettes au-dessus des voitures
  sound: boolean;
}

const KEY = 'racing-dynasty/settings';
export const DEFAULT_SETTINGS: Settings = { quality: 'auto', fpsCap: 60, showFps: false, names: true, sound: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    /* valeurs par défaut */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible */
  }
}

/** Appareil modeste : peu de mémoire ou de cœurs → qualité économie par défaut. */
export function isLowEndDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.deviceMemory !== undefined && nav.deviceMemory <= 4) || (navigator.hardwareConcurrency ?? 8) <= 4;
}
