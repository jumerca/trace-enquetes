// Interface que la scène de jeu offre aux scripts (objets, dialogues, énigmes).
import type { Line } from '../data/dialogues';
import type { Pt } from '../world/types';

export interface Api {
  say(lines: Line[]): Promise<void>;
  choose(prompt: Line | null, options: string[]): Promise<number>;
  toast(msg: string, kind?: 'decouverte' | 'objet' | 'info' | 'quete' | 'secret'): void;
  give(item: string, silent?: boolean): void;
  take(item: string): void;
  anim(name: 'inspect' | 'atlas' | 'talk' | 'work', ms?: number): Promise<void>;
  sfx(name: string, opt?: { pitch?: number }): void;
  save(reason?: string): void;
  rebuild(): void; // reconstruit décors et collisions après un changement de drapeaux
  wait(ms: number): Promise<void>;
  pan(to: Pt, ms: number, hold?: number): Promise<void>;
  fx(effect: string, data?: any): Promise<unknown> | unknown;
  quest(): void;
  run(fx: string[]): void;
}
