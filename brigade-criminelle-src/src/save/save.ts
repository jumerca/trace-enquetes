// Sauvegardes : JSON versionné, stockage IndexedDB (plusieurs emplacements), export/import.
import { dateLabel } from '../sim/calendar';
import { SAVE_VERSION } from '../sim/sim';
import type { GameState } from '../sim/types';

export interface SaveFile {
  format: 'brigade-criminelle';
  version: number;
  savedAt: string;
  label: string;
  city: string;
  commander: string;
  state: GameState;
}

export function serialize(s: GameState): string {
  const file: SaveFile = { format: 'brigade-criminelle', version: SAVE_VERSION, savedAt: new Date().toISOString(), label: dateLabel(s.startYear, s.minute), city: s.city.name, commander: `${s.commander.prenom} ${s.commander.nom}`, state: s };
  return JSON.stringify(file);
}

/** Migrations successives : chaque version future ajoutera une étape ici. */
const MIGRATIONS: Record<number, (st: GameState) => GameState> = {};

export function deserialize(json: string): GameState {
  const f = JSON.parse(json) as SaveFile;
  if (f.format !== 'brigade-criminelle') throw new Error('Fichier de sauvegarde non reconnu');
  if (f.version > SAVE_VERSION) throw new Error('Sauvegarde issue d\'une version plus récente du jeu');
  let st = f.state;
  for (let v = f.version; v < SAVE_VERSION; v++) st = MIGRATIONS[v]?.(st) ?? st;
  if (!Array.isArray(st.staff) || !Array.isArray(st.cases) || typeof st.minute !== 'number' || !st.city?.tiles) throw new Error('Sauvegarde corrompue');
  st.version = SAVE_VERSION;
  return st;
}

const DB = 'brigade-criminelle';
const STORE = 'saves';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const r = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(r.result); };
    t.onerror = () => { db.close(); reject(t.error); };
  }));
}

export const SLOTS = ['auto', 'emplacement-1', 'emplacement-2', 'emplacement-3'] as const;
export type Slot = (typeof SLOTS)[number];
export const SLOT_NAMES: Record<Slot, string> = { auto: 'Sauvegarde automatique', 'emplacement-1': 'Emplacement 1', 'emplacement-2': 'Emplacement 2', 'emplacement-3': 'Emplacement 3' };

export async function saveSlot(slot: Slot, s: GameState) {
  await tx('readwrite', (st) => st.put(serialize(s), slot));
}

export async function loadSlot(slot: Slot): Promise<GameState | null> {
  const json = await tx<string | undefined>('readonly', (st) => st.get(slot) as IDBRequest<string | undefined>);
  return json ? deserialize(json) : null;
}

export async function listSlots(): Promise<{ slot: Slot; label: string; savedAt: string; city: string; commander: string }[]> {
  const out: { slot: Slot; label: string; savedAt: string; city: string; commander: string }[] = [];
  for (const slot of SLOTS) {
    try {
      const json = await tx<string | undefined>('readonly', (st) => st.get(slot) as IDBRequest<string | undefined>);
      if (!json) continue;
      const f = JSON.parse(json) as SaveFile;
      out.push({ slot, label: f.label, savedAt: f.savedAt, city: f.city, commander: f.commander });
    } catch {
      /* emplacement illisible : ignoré */
    }
  }
  return out;
}

export async function deleteSlot(slot: Slot) {
  await tx('readwrite', (st) => st.delete(slot));
}

export function downloadSave(s: GameState) {
  const blob = new Blob([serialize(s)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `brigade-criminelle-${s.city.name.toLowerCase().replace(/\W+/g, '-')}-jour${Math.floor(s.minute / 1440) + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
