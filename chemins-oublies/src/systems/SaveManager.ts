// SaveManager : trois emplacements locaux, copie de secours, somme de contrôle, migrations de schéma.
// Le stockage est indépendant du service worker : une mise à jour du jeu ne touche pas aux parties.
import { GameState, SAVE_SCHEMA, newGame, Settings, DEFAULT_SETTINGS } from '../core/state';

export const SLOTS = 3;
const KEY = (i: number) => `chemins-oublies.save.${i}`;
const SETTINGS_KEY = 'chemins-oublies.settings';

export interface Store { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

function memoryStore(): Store {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

let store: Store = (() => {
  try { const t = '__co_test'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; } catch { return memoryStore(); }
})();
export function useStore(s: Store) { store = s; }

function checksum(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Migrations : chaque version ajoute ce qui manque, sans jamais perdre la progression. */
export function migrate(raw: any): GameState {
  const base = newGame();
  const s = { ...base, ...raw } as GameState;
  const v = raw.v ?? 1;
  if (v < 2) {
    // v1 → v2 : la machine du moulin a gagné un frein ; l'inventaire était un objet { id: qté }.
    s.mill = { ...base.mill, ...(raw.mill ?? {}) };
    if (raw.inventory && !Array.isArray(raw.inventory)) s.inventory = Object.keys(raw.inventory);
  }
  if (v < 3) {
    // v2 → v3 : compteurs (baumes) et secrets séparés des drapeaux.
    s.counters = raw.counters ?? {};
    s.secrets = raw.secrets ?? [];
  }
  s.flags = { ...(raw.flags ?? {}) };
  s.mill = { ...base.mill, ...(s.mill ?? {}) };
  s.checkpoint = s.checkpoint ?? { zone: s.zone, x: s.x, y: s.y };
  s.v = SAVE_SCHEMA;
  return s;
}

export interface SlotInfo { slot: number; state: GameState | null; corrupted?: boolean; fromBackup?: boolean }

function parse(txt: string | null): GameState | null {
  if (!txt) return null;
  const o = JSON.parse(txt);
  if (!o || typeof o !== 'object' || !o.data) return null;
  if (o.sum !== checksum(JSON.stringify(o.data))) throw new Error('checksum');
  return migrate(o.data);
}

export function readSlot(i: number): SlotInfo {
  try {
    const st = parse(store.getItem(KEY(i)));
    return { slot: i, state: st };
  } catch {
    try {
      const bak = parse(store.getItem(KEY(i) + '.bak'));
      return { slot: i, state: bak, corrupted: !bak, fromBackup: !!bak };
    } catch { return { slot: i, state: null, corrupted: true }; }
  }
}

export function writeSlot(i: number, s: GameState): boolean {
  s.updated = Date.now();
  s.build = typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'test';
  const data = JSON.parse(JSON.stringify(s));
  const txt = JSON.stringify({ data, sum: checksum(JSON.stringify(data)) });
  try {
    const prev = store.getItem(KEY(i));
    if (prev) store.setItem(KEY(i) + '.bak', prev);
    store.setItem(KEY(i), txt);
    return true;
  } catch { return false; }
}

export function deleteSlot(i: number) { store.removeItem(KEY(i)); store.removeItem(KEY(i) + '.bak'); }
export function listSlots(): SlotInfo[] { return Array.from({ length: SLOTS }, (_, i) => readSlot(i)); }

export function loadSettings(): Settings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(store.getItem(SETTINGS_KEY) ?? '{}') }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s: Settings) { try { store.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* stockage plein */ } }

export function mostRecentSlot(): number {
  let best = -1, t = 0;
  for (const s of listSlots()) if (s.state && s.state.updated > t) { t = s.state.updated; best = s.slot; }
  return best;
}
