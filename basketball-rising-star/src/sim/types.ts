import type { V2 } from '../core/vec';
import type { PlayerData, TeamTactics } from '../data/model';

export type Anim =
  | 'idle'
  | 'run'
  | 'dribble'
  | 'stance'
  | 'shoot'
  | 'layup'
  | 'dunk'
  | 'pass'
  | 'catch'
  | 'block'
  | 'rebound'
  | 'screen'
  | 'celebrate'
  | 'jumpball'
  | 'stumble'
  | 'bench';

export interface BoxLine {
  pts: number;
  sec: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  orb: number;
  drb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
  pm: number;
}

export const emptyBox = (): BoxLine => ({
  pts: 0,
  sec: 0,
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0,
  orb: 0,
  drb: 0,
  ast: 0,
  stl: 0,
  blk: 0,
  tov: 0,
  pf: 0,
  pm: 0,
});

export type OffRole = 'handler' | 'spot' | 'screener' | 'roller' | 'popper' | 'cutter' | 'post' | 'crash' | 'safety' | 'lane' | 'inbounder' | 'ftShooter' | 'ftLane';

export interface MPlayer {
  idx: number; // index global 0..n
  team: 0 | 1;
  data: PlayerData;
  heightM: number;
  onCourt: boolean;
  slot: number; // 0..4 sur le terrain (poste tactique)
  pos: V2;
  vel: V2;
  facing: number; // radians
  z: number; // hauteur des pieds (saut)
  vz: number;
  target: V2;
  urgency: number; // 0..1 (marche -> sprint)
  stride: number; // phase de foulée (dépend de la distance parcourue)
  anim: Anim;
  animT: number;
  actionLock: number; // secondes pendant lesquelles le joueur ne peut pas agir
  energy: number; // 0..1
  fouls: number;
  box: BoxLine;
  role: OffRole;
  spot: V2 | null;
  assign: number; // défense : idx de l'attaquant suivi (-1 si zone)
  thinkT: number;
  keyTime: number; // secondes passées dans la raquette (règle des 3 s)
  slowT: number; // ralenti (déséquilibré, écran)
  intent: string; // libellé lisible (debug / UI)
  screenT: number;
  isUser: boolean;
  hotness: number; // -1..1 (adresse du moment)
  lastTouchT: number;
  pickupT: number; // temps depuis réception (le porteur ne décide pas instantanément)
  jumpCd: number;
}

export type BallState = 'held' | 'air' | 'loose' | 'dead';

export interface Flight {
  kind: 'pass' | 'shot' | 'ft' | 'tip' | 'block';
  from: number; // idx joueur
  to: number; // idx receveur (passe) ou -1
  team: 0 | 1;
  t: number;
  dur: number; // pour les passes : durée prévue
  start: { x: number; y: number; z: number };
  end: { x: number; y: number; z: number };
  shotType?: ShotType;
  points?: number;
  side?: 1 | -1;
  touchedRim?: boolean;
  scored?: boolean;
  assistFrom?: number;
  fouled?: boolean;
  ftsAfter?: number;
  blocked?: boolean;
  contest?: number;
  lob?: boolean;
}

export type ShotType = 'jumper' | 'three' | 'layup' | 'dunk' | 'floater' | 'hook' | 'ft' | 'tip';

export interface Ball {
  state: BallState;
  holder: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  flight: Flight | null;
  lastTouch: number;
  lastTeam: 0 | 1;
  dribblePhase: number;
  dribbling: boolean;
  airT: number;
  spin: number;
}

export interface TeamState {
  id: string;
  name: string;
  short: string;
  colors: [string, string];
  tactics: TeamTactics;
  score: number;
  quarterFouls: number;
  timeouts: number;
  players: number[]; // idx dans MatchState.players
  /** Ordre de la rotation (idx), fourni par le coach */
  rotation: number[];
  minutesPlan: Record<number, number>;
  run: number; // série de points encaissés sans réponse (pour temps-morts)
  scoreByQ: number[];
  /** Défense : attaquant adverse à surveiller en priorité (joueur en feu) */
  focus?: number;
  /** Derniers ajustements tactiques annoncés */
  adjustments?: string[];
}

export type Phase = 'jumpball' | 'inbound' | 'live' | 'freethrow' | 'deadball' | 'quarterEnd' | 'final';

export interface GameEvent {
  t: number; // secondes simulées depuis le début
  q: number;
  clock: number;
  type:
    | 'jumpball'
    | 'shot'
    | 'made'
    | 'miss'
    | 'ft'
    | 'rebound'
    | 'assist'
    | 'steal'
    | 'block'
    | 'turnover'
    | 'foul'
    | 'violation'
    | 'sub'
    | 'timeout'
    | 'quarter'
    | 'final'
    | 'pass'
    | 'info';
  team: 0 | 1 | -1;
  player: number;
  other?: number;
  points?: number;
  text: string;
  detail?: string;
  /** Position du tir dans le repère du panier attaqué (u : profondeur depuis le panier, v : latéral) */
  sx?: number;
  sy?: number;
  shotType?: string;
}

export interface UserInput {
  mx: number;
  my: number;
  sprint: boolean;
  shoot: boolean; // maintenu
  pass: boolean; // impulsion
  lob: boolean;
  action: boolean; // contextuel : écran / demander / intercepter
  jump: boolean; // défense : contre / contester
  callBall: boolean;
}

export const emptyInput = (): UserInput => ({ mx: 0, my: 0, sprint: false, shoot: false, pass: false, lob: false, action: false, jump: false, callBall: false });
