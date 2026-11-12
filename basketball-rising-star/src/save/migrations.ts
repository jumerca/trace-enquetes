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
  // v2 -> v3 : consignes personnelles, compétitions (coupes, Europe), Espoirs, sélection, vie hors terrain
  // v3 -> v4 : matchs à la durée officielle par défaut (accélération disponible)
  3: (c) => ({ ...c, settings: { ...(c.settings as object), quarterMin: 0, speed: 4 }, version: 4 }),
  // v4 -> v5 : le match démarre en vitesse réelle (×1) ; l'accélération reste au choix
  4: (c) => ({ ...c, settings: { ...(c.settings as object), speed: 1 }, version: 5 }),
  2: (c) => ({ ...c, style: c.style ?? { shooting: 0, defense: 0.5, hustle: 0.5 }, compStats: c.compStats ?? {}, version: 3 }),
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
