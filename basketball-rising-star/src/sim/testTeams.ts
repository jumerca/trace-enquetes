import { Rng } from '../core/rng';
import { POSITIONS } from '../data/attributes';
import { generatePlayer, NameRegistry } from '../data/generate';
import { DEFAULT_TACTICS } from '../data/model';
import type { TeamInput } from './engine';

/** Équipe générée rapidement (tests, match d'exhibition). */
/** Passer le même registre aux deux équipes d'un match évite tout joueur homonyme. */
export function quickTeam(seed: number, name: string, level = 12, colors: [string, string] = ['#3988F5', '#F6F4EF'], names = new NameRegistry()): TeamInput {
  const rng = new Rng(seed);
  const players = [];
  for (let i = 0; i < 10; i++) {
    const pos = POSITIONS[i % 5];
    players.push(generatePlayer(rng, names, { pos, age: 22 + rng.int(0, 10), level: level + (i < 5 ? 1 : -1) + rng.normal(0, 0.8), nation: 'FRA', season: 2026 }));
  }
  players.forEach((p, i) => (p.number = [4, 7, 10, 13, 21, 5, 8, 11, 15, 33][i]));
  return { id: name.toLowerCase(), name, short: name.slice(0, 3).toUpperCase(), colors, tactics: { ...DEFAULT_TACTICS }, players };
}
