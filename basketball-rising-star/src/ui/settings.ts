/** Préférences de l'appareil (confort individuel) — stockées localement, jamais indispensables. */
export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  sprint: string;
  shoot: string;
  pass: string;
  lob: string;
  action: string;
  pause: string;
}

export interface Settings {
  volume: number; // 0..1
  camera: 'full' | 'follow' | 'player';
  controlMode: 'watch' | 'play';
  quality: 'low' | 'high';
  showOpen: boolean;
  showNames: boolean;
  showTactics: boolean;
  view: '3d' | '2d';
  colorblind: boolean;
  textSize: 'normal' | 'large';
  contrast: 'normal' | 'high';
  slowmo: boolean;
  vibration: boolean;
  keys: KeyMap;
  defaultQuarter: number;
}

export const DEFAULT_KEYS: KeyMap = {
  up: 'KeyW',
  down: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  sprint: 'ShiftLeft',
  shoot: 'Space',
  pass: 'KeyE',
  lob: 'KeyQ',
  action: 'KeyR',
  pause: 'Escape',
};

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.6,
  camera: 'player',
  controlMode: 'watch',
  quality: 'high',
  showOpen: true,
  showNames: true,
  showTactics: true,
  view: '3d',
  colorblind: false,
  textSize: 'normal',
  contrast: 'normal',
  slowmo: true,
  vibration: true,
  keys: DEFAULT_KEYS,
  defaultQuarter: 0,
};

const KEY = 'brs-settings-v1';

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const s = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...s, keys: { ...DEFAULT_KEYS, ...(s.keys ?? {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* stockage indisponible : préférences non persistées */
  }
}

export function applyDocumentSettings(s: Settings): void {
  document.documentElement.dataset.textsize = s.textSize;
  document.documentElement.dataset.contrast = s.contrast;
}

export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  const map: Record<string, string> = { Space: 'Espace', ShiftLeft: 'Maj', ShiftRight: 'Maj D', Escape: 'Échap', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Entrée', ControlLeft: 'Ctrl' };
  return map[code] ?? code;
}
