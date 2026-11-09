/** Définition des attributs (notés sur 20) et des catégories. */
export const ATTRIBUTE_GROUPS = {
  offense: {
    label: 'Attaque',
    keys: ['three', 'midRange', 'freeThrow', 'finishing', 'layup', 'dunk', 'postPlay', 'shotCreation', 'pullUp', 'catchShoot'],
  },
  technique: {
    label: 'Technique',
    keys: ['dribble', 'ballSecurity', 'passing', 'vision', 'ballControl', 'offBall', 'screenUse', 'footwork', 'coordination'],
  },
  defense: {
    label: 'Défense',
    keys: ['perimeterD', 'teamD', 'passReading', 'steal', 'block', 'rimProtect', 'pnrD', 'defRebound', 'positioning'],
  },
  physical: {
    label: 'Physique',
    keys: ['speed', 'acceleration', 'vertical', 'strength', 'stamina', 'agility', 'balance', 'explosiveness', 'durability'],
  },
  mental: {
    label: 'Mental',
    keys: ['concentration', 'composure', 'iq', 'leadership', 'ambition', 'consistency', 'discipline', 'pressure', 'teamwork', 'determination'],
  },
} as const;

export type AttrGroup = keyof typeof ATTRIBUTE_GROUPS;
export type AttrKey = (typeof ATTRIBUTE_GROUPS)[AttrGroup]['keys'][number];
export type Attributes = Record<AttrKey, number>;

export const ATTR_LABELS: Record<AttrKey, string> = {
  three: 'Tir à 3 pts',
  midRange: 'Mi-distance',
  freeThrow: 'Lancers francs',
  finishing: 'Finition',
  layup: 'Lay-up',
  dunk: 'Dunk',
  postPlay: 'Jeu au poste',
  shotCreation: 'Création de tirs',
  pullUp: 'Tir après dribble',
  catchShoot: 'Sortie d’écran',
  dribble: 'Dribble',
  ballSecurity: 'Protection de balle',
  passing: 'Passe',
  vision: 'Vision du jeu',
  ballControl: 'Contrôle du ballon',
  offBall: 'Jeu sans ballon',
  screenUse: 'Utilisation des écrans',
  footwork: 'Pied de pivot',
  coordination: 'Coordination',
  perimeterD: 'Défense individuelle',
  teamD: 'Défense collective',
  passReading: 'Lecture des passes',
  steal: 'Interceptions',
  block: 'Contres',
  rimProtect: 'Protection du cercle',
  pnrD: 'Défense pick & roll',
  defRebound: 'Rebond',
  positioning: 'Placement',
  speed: 'Vitesse',
  acceleration: 'Accélération',
  vertical: 'Détente',
  strength: 'Force',
  stamina: 'Endurance',
  agility: 'Agilité',
  balance: 'Équilibre',
  explosiveness: 'Explosivité',
  durability: 'Résistance',
  concentration: 'Concentration',
  composure: 'Sang-froid',
  iq: 'Intelligence basket',
  leadership: 'Leadership',
  ambition: 'Ambition',
  consistency: 'Régularité',
  discipline: 'Discipline',
  pressure: 'Gestion pression',
  teamwork: 'Esprit collectif',
  determination: 'Détermination',
};

export const ALL_ATTRS: AttrKey[] = Object.values(ATTRIBUTE_GROUPS).flatMap((g) => [...g.keys]) as AttrKey[];

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export const POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];
export const POSITION_LABELS: Record<Position, string> = {
  PG: 'Meneur',
  SG: 'Arrière',
  SF: 'Ailier',
  PF: 'Ailier fort',
  C: 'Pivot',
};

export type Archetype =
  | 'playmaker'
  | 'scoringGuard'
  | 'sharpshooter'
  | 'twoWayGuard'
  | 'lockdown'
  | 'athleticWing'
  | 'shotCreator'
  | 'allAround'
  | 'skilledBig'
  | 'dominantBig'
  | 'rimProtector'
  | 'stretchBig';

export interface ArchetypeDef {
  label: string;
  desc: string;
  positions: Position[];
  /** Bonus/malus par attribut (en points sur 20) */
  mods: Partial<Record<AttrKey, number>>;
  /** Attributs dont la progression est accélérée */
  growth: AttrKey[];
}

export const ARCHETYPES: Record<Archetype, ArchetypeDef> = {
  playmaker: {
    label: 'Meneur organisateur',
    desc: 'Vision, passes millimétrées, orchestre le pick-and-roll.',
    positions: ['PG'],
    mods: { passing: 4, vision: 4, ballControl: 3, dribble: 3, iq: 3, leadership: 2, dunk: -3, strength: -2, block: -3, postPlay: -3 },
    growth: ['passing', 'vision', 'iq', 'dribble'],
  },
  scoringGuard: {
    label: 'Meneur scoreur',
    desc: 'Agressif, crée ses tirs et attaque le cercle.',
    positions: ['PG', 'SG'],
    mods: { shotCreation: 4, pullUp: 3, dribble: 3, layup: 2, acceleration: 2, passing: -1, block: -3, postPlay: -3 },
    growth: ['shotCreation', 'pullUp', 'dribble', 'layup'],
  },
  sharpshooter: {
    label: 'Shooteur extérieur',
    desc: 'Mécanique pure, redoutable en sortie d’écran.',
    positions: ['SG', 'SF'],
    mods: { three: 5, catchShoot: 4, freeThrow: 3, midRange: 2, offBall: 2, dunk: -3, strength: -2, block: -2 },
    growth: ['three', 'catchShoot', 'midRange', 'offBall'],
  },
  twoWayGuard: {
    label: 'Arrière polyvalent',
    desc: 'Solide des deux côtés du terrain.',
    positions: ['SG', 'PG', 'SF'],
    mods: { perimeterD: 2, three: 1, passing: 1, steal: 2, teamD: 1, stamina: 1 },
    growth: ['perimeterD', 'three', 'steal', 'teamD'],
  },
  lockdown: {
    label: 'Défenseur spécialiste',
    desc: 'Étouffe le meilleur extérieur adverse.',
    positions: ['SG', 'SF'],
    mods: { perimeterD: 5, steal: 3, passReading: 3, pnrD: 3, agility: 2, three: -2, shotCreation: -3, pullUp: -2 },
    growth: ['perimeterD', 'steal', 'pnrD', 'passReading'],
  },
  athleticWing: {
    label: 'Ailier athlétique',
    desc: 'Explosif, finisseur aérien, transition.',
    positions: ['SF', 'SG'],
    mods: { vertical: 4, explosiveness: 4, dunk: 4, speed: 2, finishing: 2, three: -2, passing: -1, vision: -1 },
    growth: ['dunk', 'finishing', 'vertical', 'perimeterD'],
  },
  shotCreator: {
    label: 'Créateur de tirs',
    desc: 'Isolation, mi-distance et tirs difficiles.',
    positions: ['SG', 'SF'],
    mods: { shotCreation: 5, midRange: 4, pullUp: 3, footwork: 2, dribble: 2, teamD: -2, defRebound: -1 },
    growth: ['shotCreation', 'midRange', 'pullUp', 'footwork'],
  },
  allAround: {
    label: 'Joueur complet',
    desc: 'Aucune faiblesse majeure, s’adapte à tout.',
    positions: ['SF', 'PF', 'SG'],
    mods: { iq: 2, passing: 1, defRebound: 1, teamD: 1, teamwork: 2 },
    growth: ['iq', 'passing', 'three', 'teamD'],
  },
  skilledBig: {
    label: 'Intérieur technique',
    desc: 'Jeu de pieds, toucher et passes au poste.',
    positions: ['PF', 'C'],
    mods: { postPlay: 5, footwork: 4, finishing: 2, passing: 2, midRange: 2, speed: -2, three: -2, dribble: -1 },
    growth: ['postPlay', 'footwork', 'finishing', 'midRange'],
  },
  dominantBig: {
    label: 'Pivot dominant',
    desc: 'Puissance, finition et rebond offensif.',
    positions: ['C', 'PF'],
    mods: { strength: 5, finishing: 4, dunk: 3, defRebound: 3, postPlay: 2, three: -5, dribble: -3, speed: -2, freeThrow: -2 },
    growth: ['strength', 'finishing', 'defRebound', 'dunk'],
  },
  rimProtector: {
    label: 'Pivot protecteur',
    desc: 'Dissuasion, contres, verrou de la raquette.',
    positions: ['C'],
    mods: { block: 5, rimProtect: 5, defRebound: 3, positioning: 3, vertical: 2, three: -5, dribble: -4, shotCreation: -4, midRange: -2 },
    growth: ['block', 'rimProtect', 'positioning', 'defRebound'],
  },
  stretchBig: {
    label: 'Intérieur shooteur',
    desc: 'Écarte le jeu, pick-and-pop à 3 points.',
    positions: ['PF', 'C'],
    mods: { three: 4, catchShoot: 3, midRange: 3, freeThrow: 2, postPlay: -1, block: -1, strength: -1 },
    growth: ['three', 'catchShoot', 'midRange', 'defRebound'],
  },
};

/** Profil de base par poste (moyenne autour de laquelle les attributs sont tirés). */
export const POSITION_BASE: Record<Position, Partial<Record<AttrKey, number>>> = {
  PG: { dribble: 3, passing: 3, vision: 3, ballControl: 3, speed: 3, acceleration: 3, agility: 2, steal: 1, strength: -3, block: -4, rimProtect: -4, defRebound: -3, postPlay: -4, dunk: -2 },
  SG: { three: 2, catchShoot: 2, pullUp: 1, speed: 2, dribble: 1, agility: 1, block: -3, rimProtect: -3, postPlay: -3, defRebound: -2 },
  SF: { perimeterD: 1, vertical: 1, finishing: 1, layup: 1 },
  PF: { strength: 2, defRebound: 3, finishing: 2, postPlay: 2, block: 1, rimProtect: 1, dribble: -2, speed: -1, three: -1, ballControl: -1 },
  C: { strength: 4, defRebound: 4, block: 3, rimProtect: 4, finishing: 3, postPlay: 3, dunk: 2, dribble: -4, speed: -3, three: -4, ballControl: -3, passing: -2, acceleration: -2, agility: -2, pullUp: -3 },
};

/** Taille moyenne (cm) par poste. */
export const POSITION_HEIGHT: Record<Position, number> = { PG: 188, SG: 194, SF: 200, PF: 205, C: 211 };

/** Poids de chaque attribut dans la note globale selon le poste. */
export const OVR_WEIGHTS: Record<Position, Partial<Record<AttrKey, number>>> = {
  PG: { passing: 3, vision: 3, dribble: 3, ballControl: 2, three: 2, pullUp: 2, layup: 2, iq: 2, perimeterD: 1.5, speed: 2, acceleration: 1.5, steal: 1, shotCreation: 1.5, freeThrow: 1, ballSecurity: 1.5 },
  SG: { three: 3, catchShoot: 2, pullUp: 2, shotCreation: 2, layup: 1.5, dribble: 1.5, perimeterD: 2, speed: 1.5, midRange: 1.5, steal: 1, iq: 1.5, offBall: 1.5, freeThrow: 1 },
  SF: { three: 2, finishing: 2, layup: 1.5, perimeterD: 2, teamD: 1.5, vertical: 1.5, iq: 1.5, defRebound: 1.5, midRange: 1.5, speed: 1.5, passing: 1, dunk: 1, shotCreation: 1 },
  PF: { finishing: 2.5, defRebound: 2.5, strength: 2, postPlay: 2, teamD: 2, block: 1.5, rimProtect: 1.5, midRange: 1.5, vertical: 1.5, iq: 1.5, three: 1, dunk: 1 },
  C: { finishing: 3, defRebound: 3, rimProtect: 3, block: 2.5, strength: 2.5, postPlay: 2, positioning: 2, vertical: 1.5, dunk: 1.5, iq: 1, teamD: 1.5 },
};

export function overall(attrs: Attributes, pos: Position): number {
  const w = OVR_WEIGHTS[pos];
  let s = 0;
  let t = 0;
  for (const k of Object.keys(w) as AttrKey[]) {
    s += attrs[k] * (w[k] as number);
    t += w[k] as number;
  }
  // 20 -> 99, 10 -> ~55
  const avg = s / t;
  return Math.round(Math.max(25, Math.min(99, 10 + avg * 4.5)));
}
