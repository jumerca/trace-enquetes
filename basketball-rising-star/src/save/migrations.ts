import { SAVE_VERSION, type Career } from '../career/career';

/**
 * Migrations successives : une sauvegarde d'une version antérieure est mise à niveau, jamais effacée.
 */
type Raw = Record<string, unknown> & { version?: number };
const MIGRATIONS: Record<number, (c: Raw) => Raw> = {
  // v1 -> v2 : ajout des relations, des meilleurs matchs et des sélections
  1: (c) => ({
    ...c,
    relations: c.relations ?? { coach: 50, teammates: 55, captain: 50, fans: 30, media: 30, agent: 50, medical: 60, board: 50 },
    bestGames: c.bestGames ?? [],
    nationalCaps: c.nationalCaps ?? 0,
    version: 2,
  }),
};

export function migrate(raw: Raw): Career {
  let c = { ...raw };
  let v = typeof c.version === 'number' ? c.version : 1;
  if (v > SAVE_VERSION) throw new Error('Sauvegarde créée par une version plus récente du jeu');
  while (v < SAVE_VERSION) {
    const m = MIGRATIONS[v];
    if (!m) throw new Error(`Migration manquante depuis la version ${v}`);
    c = m(c);
    v = c.version as number;
  }
  return c as unknown as Career;
}

export function validateCareer(c: unknown): c is Career {
  if (!c || typeof c !== 'object') return false;
  const k = c as Career;
  if (!k.world || !k.world.players || !k.world.clubs || !k.world.leagues || !Array.isArray(k.world.fixtures)) return false;
  const u = k.world.players[k.userId];
  if (!u || !u.attrs || !u.clubId || !k.world.clubs[u.clubId]) return false;
  if (!k.world.clubs[u.clubId].roster.includes(u.id)) return false;
  return typeof k.week === 'number' && typeof k.world.season === 'number';
}
