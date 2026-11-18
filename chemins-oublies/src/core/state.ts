// État de partie : tout ce qui est sauvegardé. Les systèmes lisent et écrivent ici, jamais dans les sprites.
export type ZoneId = 'clairval' | 'bois' | 'moulin' | 'auberge' | 'atelier' | 'archives' | 'moulin_int'
  | 'poste' | 'maison_mara' | 'maison_ninon' | 'maisonA' | 'maisonB' | 'maisonC' | 'maisonD' | 'maisonF' | 'maisonG' | 'grange'
  | 'landes' | 'brumecime' | 'tour' | 'tissage';
export type Dir = 'down' | 'up' | 'left' | 'right';

export const SAVE_SCHEMA = 3;

export interface MillState { brake: boolean; v1: boolean; v2: boolean; v3: boolean; level: number; solved: boolean }

export interface GameState {
  v: number;
  build: string;
  created: number;
  updated: number;
  playTime: number; // secondes
  zone: ZoneId;
  x: number;
  y: number;
  facing: Dir;
  clock: number; // minutes depuis 0h du jour 1 (le jour = clock / 1440)
  hp: number;
  maxHp: number;
  flags: Record<string, boolean>;
  counters: Record<string, number>;
  inventory: string[];
  clues: string[];
  notes: string[]; // annotations de l'atlas
  traces: string[]; // chemins révélés dans l'atlas
  secrets: string[];
  discovered: Partial<Record<ZoneId, string>>; // brouillard de l'atlas (bits en base64)
  bornes: number[]; // orientation 0..7 (0 = est, sens horaire)
  stones: number[]; // séquence en cours sur les pierres gravées
  mill: MillState;
  defeated: string[]; // rencontres terminées
  hints: Record<string, number>;
  checkpoint: { zone: ZoneId; x: number; y: number };
  log: string[]; // journal (événements marquants)
  chapterDone: boolean;
}

export function newGame(): GameState {
  const now = Date.now();
  return {
    v: SAVE_SCHEMA,
    build: typeof __APP_BUILD__ !== 'undefined' ? __APP_BUILD__ : 'test',
    created: now,
    updated: now,
    playTime: 0,
    zone: 'clairval',
    x: 1330,
    y: 2140,
    facing: 'up',
    clock: 9 * 60,
    hp: 5,
    maxHp: 5,
    flags: {},
    counters: {},
    inventory: ['atlas', 'boussole_brisee', 'baton'],
    clues: [],
    notes: ['maelys_depart'],
    traces: [],
    secrets: [],
    discovered: {},
    bornes: [3, 5, 2],
    stones: [],
    mill: { brake: true, v1: false, v2: true, v3: false, level: 0, solved: false },
    defeated: [],
    hints: {},
    checkpoint: { zone: 'clairval', x: 1330, y: 2140 },
    log: [],
    chapterDone: false,
  };
}

// Référence globale de la partie en cours (un seul jeu à la fois).
export let S: GameState = newGame();
export function setState(s: GameState): void { S = s; }

export const has = (item: string) => S.inventory.includes(item);
export const flag = (f: string) => !!S.flags[f];
export function setFlag(f: string, v = true): void { S.flags[f] = v; }
export function addItem(item: string): boolean {
  if (S.inventory.includes(item)) return false;
  S.inventory.push(item);
  return true;
}
export function removeItem(item: string): void { S.inventory = S.inventory.filter((i) => i !== item); }
export function addClue(c: string): boolean { if (S.clues.includes(c)) return false; S.clues.push(c); return true; }
export function addNote(n: string): boolean { if (S.notes.includes(n)) return false; S.notes.push(n); return true; }
export function addTrace(t: string): boolean { if (S.traces.includes(t)) return false; S.traces.push(t); return true; }
export function addSecret(t: string): boolean { if (S.secrets.includes(t)) return false; S.secrets.push(t); return true; }

export const hour = () => Math.floor((S.clock % 1440) / 60);
export type Phase = 'matin' | 'apresmidi' | 'soir' | 'nuit';
export function phaseOf(clock: number): Phase {
  const h = (clock % 1440) / 60;
  if (h >= 6 && h < 12) return 'matin';
  if (h >= 12 && h < 18) return 'apresmidi';
  if (h >= 18 && h < 22) return 'soir';
  return 'nuit';
}
export const PHASE_LABEL: Record<Phase, string> = { matin: 'Matin', apresmidi: 'Après-midi', soir: 'Soir', nuit: 'Nuit' };

export interface Settings {
  quality: 'basse' | 'moyenne' | 'haute';
  music: number;
  sfx: number;
  textSpeed: 'lente' | 'normale' | 'rapide' | 'instantanee';
  combat: 'exploration' | 'facile' | 'normale' | 'difficile';
  lastSlot: number;
}
export const DEFAULT_SETTINGS: Settings = { quality: (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) ? 'moyenne' : 'haute', music: 0.6, sfx: 0.8, textSpeed: 'normale', combat: 'normale', lastSlot: -1 };
