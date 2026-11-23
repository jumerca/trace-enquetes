// Sauvegardes : sérialisation JSON versionnée, stockage IndexedDB, export/import de fichiers.
import { SAVE_VERSION, type GameState } from '../sim/state';
import { dateLabel } from '../sim/sim';

const toB64 = (a: Uint8Array) => {
  let s = '';
  for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode(...a.subarray(i, i + 0x8000));
  return btoa(s);
};
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export interface SaveFile {
  format: 'domaines-terroirs';
  version: number;
  savedAt: string;
  label: string;
  state: unknown;
}

export function serialize(s: GameState): string {
  const state = { ...s, world: { ...s.world, terrain: toB64(s.world.terrain), decor: toB64(s.world.decor), height: toB64(s.world.height), field: toB64(s.world.field) } };
  const file: SaveFile = { format: 'domaines-terroirs', version: SAVE_VERSION, savedAt: new Date().toISOString(), label: dateLabel(s.minute), state };
  return JSON.stringify(file);
}

/** Migrations successives : chaque version future ajoutera une étape ici. */
const MIGRATIONS: Record<number, (st: any) => any> = {
  1: () => {
    throw new Error('Sauvegarde de la V0.1 : la carte et le contenu ont changé (V0.2), elle ne peut pas être reprise');
  },
};

export function deserialize(json: string): GameState {
  const f = JSON.parse(json) as SaveFile;
  if (f.format !== 'domaines-terroirs') throw new Error('Fichier de sauvegarde non reconnu');
  if (f.version > SAVE_VERSION) throw new Error('Sauvegarde issue d\'une version plus récente du jeu');
  let st: any = f.state;
  for (let v = f.version; v < SAVE_VERSION; v++) st = MIGRATIONS[v]?.(st) ?? st;
  st.world.terrain = fromB64(st.world.terrain);
  st.world.decor = fromB64(st.world.decor);
  st.world.height = fromB64(st.world.height);
  st.world.field = fromB64(st.world.field);
  st.version = SAVE_VERSION;
  const n = st.world.w * st.world.h;
  if (st.world.terrain.length !== n || st.world.decor.length !== n || st.world.height.length !== (st.world.w + 1) * (st.world.h + 1)) throw new Error('Sauvegarde corrompue (carte)');
  if (!Array.isArray(st.buildings) || typeof st.money !== 'number') throw new Error('Sauvegarde corrompue');
  return st as GameState;
}

// ————— IndexedDB —————
const DB = 'domaines-terroirs';
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
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => {
          db.close();
          resolve(r.result);
        };
        t.onerror = () => {
          db.close();
          reject(t.error);
        };
      }),
  );
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

export async function listSlots(): Promise<{ slot: Slot; label: string; savedAt: string; money: number }[]> {
  const out: { slot: Slot; label: string; savedAt: string; money: number }[] = [];
  for (const slot of SLOTS) {
    try {
      const json = await tx<string | undefined>('readonly', (st) => st.get(slot) as IDBRequest<string | undefined>);
      if (!json) continue;
      const f = JSON.parse(json) as SaveFile;
      out.push({ slot, label: f.label, savedAt: f.savedAt, money: (f.state as { money: number }).money });
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
  a.download = `domaines-terroirs-jour${Math.floor(s.minute / 1440) + 1}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
