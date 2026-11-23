// Règles de tri en profondeur (fonctions pures, testées hors navigateur).
// Une case (x, y) a son centre en (x + 0.5, y + 0.5) ; la profondeur croît vers le bas de l'écran.

/** Objet occupant une case (arbre, personnage, animal) — x, y en coordonnées de case. */
export const tileDepth = (x: number, y: number) => x + y + 1;

/** Bâtiment carré : profondeur de son centre, très légèrement en retrait (départage les coins). */
export const buildingDepth = (x: number, y: number, size: number) => x + y + size - 0.02;

/** Agents mobiles : légèrement devant le décor de leur case. */
export const agentDepth = (x: number, y: number, bias = 0.02) => x + y + 1 + bias;
