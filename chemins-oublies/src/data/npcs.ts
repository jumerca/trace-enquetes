// Où se trouvent les habitants selon l'heure et la progression. Trois routines complètes (Agathe, Basile, Mara).
import type { ZoneId, Dir } from '../core/state';
import { S, flag } from '../core/state';
import type { Pt } from '../world/types';

export interface Place { zone: ZoneId; pts: Pt[]; mode: 'stand' | 'loop' | 'work'; face?: Dir; talkRange?: number; where: string; pause?: number; speed?: number }

const h = () => (S.clock % 1440) / 60;
const between = (a: number, b: number) => { const x = h(); return a < b ? x >= a && x < b : x >= a || x < b; };

export const NPC_IDS = ['agathe', 'basile', 'mara', 'ninon', 'paulin', 'salome', 'coline', 'theodore', 'anton', 'gaspard', 'odile'] as const;
export type NpcId = typeof NPC_IDS[number];

export const ROUTINES: Record<NpcId, () => Place | null> = {
  agathe: () => {
    if (between(6, 12)) return { zone: 'clairval', pts: [[1205, 965], [1395, 968]], mode: 'loop', pause: 3, where: "balaie devant l'auberge" };
    if (between(18, 21)) return { zone: 'clairval', pts: [[1175, 948], [1300, 950], [1425, 948]], mode: 'loop', pause: 2.5, where: "ferme les volets de l'auberge" };
    return { zone: 'auberge', pts: [[520, 248]], mode: 'stand', face: 'down', talkRange: 110, where: "derrière le comptoir de l'auberge" };
  },
  basile: () => {
    if (between(7, 12)) return { zone: 'clairval', pts: [[1300, 1000], [1000, 745], [640, 820], [600, 1150], [1540, 1010], [1780, 950], [2050, 765], [1900, 1180]], mode: 'loop', pause: 2, where: 'fait sa tournée (nord et est du village)' };
    if (between(12, 14)) return { zone: 'clairval', pts: [[1110, 1078]], mode: 'stand', face: 'down', where: 'déjeune sur un banc de la place' };
    if (between(14, 18)) return { zone: 'clairval', pts: [[1320, 1650], [955, 1800], [635, 1565], [1100, 1730], [1760, 1905], [2070, 1525], [1740, 1515]], mode: 'loop', pause: 2, where: 'fait sa tournée (sud du village)' };
    return { zone: 'poste', pts: [[360, 250]], mode: 'work', face: 'down', talkRange: 125, where: 'trie le courrier à la Poste' };
  },
  mara: () => {
    if (between(7, 11)) return { zone: 'clairval', pts: [[2740, 1600], [2860, 1595]], mode: 'loop', pause: 5, where: 'dans son jardin, de l\'autre côté du pont' };
    if (between(11, 16)) return { zone: 'clairval', pts: [[1500, 1445]], mode: 'stand', face: 'down', where: 'à son étal du marché' };
    if (between(16, 19)) return { zone: 'clairval', pts: [[1420, 420], [1520, 470]], mode: 'loop', pause: 4, where: 'cueille des herbes près de la porte nord' };
    return { zone: 'maison_mara', pts: [[360, 300]], mode: 'work', face: 'down', where: 'chez elle, de l\'autre côté du pont' };
  },
  ninon: () => {
    if (between(7, 20)) return { zone: 'clairval', pts: [[1150, 1300], [1300, 1325], [1455, 1300], [1450, 1110], [1150, 1120]], mode: 'loop', pause: 1.2, speed: 70, where: 'joue autour de la fontaine' };
    return { zone: 'maison_ninon', pts: [[340, 300]], mode: 'stand', face: 'down', where: 'chez elle, au sud du village' };
  },
  paulin: () => {
    if (between(7, 20)) return { zone: 'clairval', pts: [[1450, 1110], [1150, 1120], [1150, 1300], [1300, 1325], [1455, 1300]], mode: 'loop', pause: 0.8, speed: 85, where: 'court autour de la fontaine' };
    return null;
  },
  salome: () => ({ zone: 'archives', pts: [[360, 285]], mode: 'work', face: 'down', talkRange: 125, where: 'aux Archives, penchée sur ses cartes' }),
  coline: () => ({ zone: 'atelier', pts: [[380, 238]], mode: 'work', face: 'down', talkRange: 125, where: 'dans son atelier' }),
  theodore: () => flag('theo_ok')
    ? { zone: 'clairval', pts: [[1420, 300]], mode: 'stand', face: 'left', where: 'à la porte nord' }
    : { zone: 'clairval', pts: [[1300, 262]], mode: 'stand', face: 'down', where: 'garde la porte nord' },
  anton: () => {
    if (flag('stones_solved')) return { zone: 'moulin', pts: [[1040, 1020]], mode: flag('mill_running') ? 'work' : 'stand', face: 'right', where: 'devant son moulin' };
    return { zone: 'bois', pts: [[1745, 1440]], mode: 'work', face: 'right', where: 'au campement, dans le Bois' };
  },
  gaspard: () => (between(6, 21) ? { zone: 'clairval', pts: [[2292, 1650]], mode: 'stand', face: 'right', where: 'pêche au bord de la rivière' } : null),
  odile: () => (between(6, 19) ? { zone: 'clairval', pts: [[760, 1612], [840, 1612]], mode: 'loop', pause: 6, where: 'dans son potager' } : null),
};

export const MAIN_NPCS: NpcId[] = ['agathe', 'basile', 'ninon', 'mara', 'anton', 'coline', 'theodore', 'salome'];
