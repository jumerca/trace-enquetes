import type { Career } from '../career/career';
import { migrate, validateCareer } from './migrations';

/**
 * Sauvegardes IndexedDB. Chaque emplacement conserve aussi une copie de secours (version précédente) :
 * une écriture interrompue ou corrompue ne détruit jamais la carrière.
 */
const DB_NAME = 'brs-saves';
const DB_VERSION = 1;
const STORE = 'slots';
export const SLOT_COUNT = 4;

export interface SlotMeta {
  slot: number;
  name: string;
  club: string;
  season: number;
  week: number;
  ovr: number;
  updatedAt: number;
  version: number;
}

interface SlotRecord {
  slot: number;
  meta: SlotMeta;
  data: string;
  backup?: string;
  checksum: number;
}

function checksum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

let dbp: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'slot' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then(
    (d) =>
      new Promise<T>((resolve, reject) => {
        const t = d.transaction(STORE, mode);
        const r = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(r.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      }),
  );
}

export function metaOf(c: Career, slot: number, ovr: number, clubName: string): SlotMeta {
  const u = c.world.players[c.userId];
  return { slot, name: `${u.firstName} ${u.lastName}`, club: clubName, season: c.world.season, week: c.week, ovr, updatedAt: Date.now(), version: c.version };
}

export async function listSlots(): Promise<(SlotMeta | null)[]> {
  const all = (await tx<SlotRecord[]>('readonly', (s) => s.getAll() as IDBRequest<SlotRecord[]>)) ?? [];
  const res: (SlotMeta | null)[] = new Array(SLOT_COUNT).fill(null);
  for (const r of all) if (r.slot >= 0 && r.slot < SLOT_COUNT) res[r.slot] = r.meta;
  return res;
}

export async function saveSlot(slot: number, c: Career, meta: SlotMeta): Promise<void> {
  const data = JSON.stringify(c);
  const prev = await tx<SlotRecord | undefined>('readonly', (s) => s.get(slot) as IDBRequest<SlotRecord | undefined>);
  const rec: SlotRecord = { slot, meta, data, backup: prev?.data, checksum: checksum(data) };
  await tx('readwrite', (s) => s.put(rec));
}

export async function loadSlot(slot: number): Promise<{ career: Career; fromBackup: boolean }> {
  const rec = await tx<SlotRecord | undefined>('readonly', (s) => s.get(slot) as IDBRequest<SlotRecord | undefined>);
  if (!rec) throw new Error('Emplacement vide');
  const tryParse = (raw: string | undefined): Career | null => {
    if (!raw) return null;
    try {
      const c = migrate(JSON.parse(raw));
      return validateCareer(c) ? c : null;
    } catch {
      return null;
    }
  };
  if (checksum(rec.data) === rec.checksum) {
    const c = tryParse(rec.data);
    if (c) return { career: c, fromBackup: false };
  }
  const b = tryParse(rec.backup);
  if (b) return { career: b, fromBackup: true };
  throw new Error('Sauvegarde illisible (et copie de secours indisponible)');
}

export async function deleteSlot(slot: number): Promise<void> {
  await tx('readwrite', (s) => s.delete(slot));
}

export function exportCareer(c: Career): string {
  return JSON.stringify({ format: 'basketball-rising-star', exportedAt: new Date().toISOString(), career: c });
}

export function importCareer(text: string): Career {
  const obj = JSON.parse(text);
  const raw = obj && obj.format === 'basketball-rising-star' ? obj.career : obj;
  const c = migrate(raw);
  if (!validateCareer(c)) throw new Error('Fichier de sauvegarde invalide');
  return c;
}
