// Sauvegardes persistantes : schéma versionné + migrations, copie de secours, export/import.
// Les clés de stockage ne changent jamais d'une version du jeu à l'autre : une mise à jour ne perd pas les parties.
import { computeObjective, type Career } from './career';
import { upgradeCareerV3 } from './management';

export const SAVE_SCHEMA = 4;
export const SLOT_COUNT = 3;
const PREFIX = 'racing-dynasty/save/';
const LAST = 'racing-dynasty/last-slot';

export interface SaveFile {
  app: 'racing-dynasty';
  schema: number;
  gameVersion: string;
  savedAt: string;
  career: Career;
}

export interface SlotInfo {
  slot: number;
  empty: boolean;
  teamName?: string;
  season?: number;
  round?: number;
  rounds?: number;
  savedAt?: string;
  corrupted?: boolean;
}

export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

/** Migrations successives : MIGRATIONS[n] transforme un fichier du schéma n en schéma n + 1. */
const MIGRATIONS: Record<number, (f: any) => any> = {
  // V0.1 → V0.2 : objectif des actionnaires (le calendrier à 5 GP s'applique à la saison suivante).
  1: (f) => {
    f.career.objective = { season: f.career.season, target: computeObjective(f.career) };
    f.schema = 2;
    return f;
  },
  // V0.3 → V0.4 : personnel, R&D, académie, moral, statistiques, sponsors pluriannuels.
  2: (f) => {
    upgradeCareerV3(f.career);
    f.schema = 3;
    return f;
  },
  // V0.6 → V0.7 : installations, presse, rivalités, carrière du directeur (complétés par upgradeCareerV3).
  3: (f) => {
    upgradeCareerV3(f.career);
    f.schema = 4;
    return f;
  },
};

export function migrate(raw: any): SaveFile {
  if (!raw || raw.app !== 'racing-dynasty' || typeof raw.schema !== 'number' || !raw.career) {
    throw new Error('Fichier de sauvegarde invalide.');
  }
  let f = raw;
  while (f.schema < SAVE_SCHEMA) {
    const m = MIGRATIONS[f.schema];
    if (!m) throw new Error('Aucune migration depuis le schéma ' + f.schema);
    f = m(f);
  }
  if (f.schema > SAVE_SCHEMA) throw new Error('Cette sauvegarde provient d’une version plus récente du jeu.');
  return f as SaveFile;
}

function defaultStore(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export class SaveStore {
  constructor(private kv: KV | null = defaultStore(), private version = '0.1.0') {}

  private key(slot: number): string {
    return PREFIX + slot;
  }

  save(slot: number, career: Career): void {
    if (!this.kv) throw new Error('Stockage indisponible sur cet appareil.');
    const file: SaveFile = { app: 'racing-dynasty', schema: SAVE_SCHEMA, gameVersion: this.version, savedAt: new Date().toISOString(), career };
    const json = JSON.stringify(file);
    const prev = this.kv.getItem(this.key(slot));
    if (prev) this.kv.setItem(this.key(slot) + '.bak', prev);
    this.kv.setItem(this.key(slot), json);
    this.kv.setItem(LAST, String(slot));
  }

  load(slot: number): Career | null {
    if (!this.kv) return null;
    for (const k of [this.key(slot), this.key(slot) + '.bak']) {
      const raw = this.kv.getItem(k);
      if (!raw) continue;
      try {
        return migrate(JSON.parse(raw)).career;
      } catch {
        /* on tente la copie de secours */
      }
    }
    return null;
  }

  info(slot: number): SlotInfo {
    const raw = this.kv?.getItem(this.key(slot));
    if (!raw) return { slot, empty: true };
    try {
      const f = migrate(JSON.parse(raw));
      const team = f.career.teams.find((t) => t.id === f.career.playerTeamId);
      return { slot, empty: false, teamName: team?.name, season: f.career.season, round: f.career.round, rounds: f.career.calendar.length, savedAt: f.savedAt };
    } catch {
      return { slot, empty: false, corrupted: true };
    }
  }

  list(): SlotInfo[] {
    return Array.from({ length: SLOT_COUNT }, (_, i) => this.info(i));
  }

  lastSlot(): number | null {
    const v = this.kv?.getItem(LAST);
    if (v === null || v === undefined) return null;
    const n = Number(v);
    return Number.isInteger(n) && !this.info(n).empty ? n : null;
  }

  remove(slot: number): void {
    this.kv?.removeItem(this.key(slot));
    this.kv?.removeItem(this.key(slot) + '.bak');
  }

  exportText(slot: number): string | null {
    return this.kv?.getItem(this.key(slot)) ?? null;
  }

  importText(slot: number, text: string): Career {
    const f = migrate(JSON.parse(text));
    this.save(slot, f.career);
    return f.career;
  }
}

export class MemoryKV implements KV {
  map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
  removeItem(k: string): void {
    this.map.delete(k);
  }
}

/** Demande au navigateur de ne pas purger le stockage (Android/Chrome). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignoré */
  }
  return false;
}
