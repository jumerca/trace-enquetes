// Trois circuits originaux (tracés imaginaires, coordonnées en mètres, y vers le bas, sens horaire).
import { buildTrack, type Track, type TrackDef } from './track';

export const TRACK_DEFS: TrackDef[] = [
  {
    id: 'port-azur',
    name: 'Circuit du Port-Azur',
    gp: "Grand Prix de Port-Azur",
    place: 'Port-Azur, Riviera des Lys',
    theme: 'port',
    width: 12,
    pitSide: 1,
    wear: 3.2,
    suspOpt: 30,
    overtaking: 0.45,
    rainChance: 0.2,
    description: 'Tracé urbain serré entre les quais et la vieille ville. Dépasser y est un art.',
    points: [
      [0, 0], [180, 0], [360, 0], [470, 0], [515, 10], [536, 45], [538, 130], [522, 182], [472, 212], [420, 238], [398, 290],
      [412, 350], [462, 400], [490, 452], [488, 522], [452, 566], [395, 590], [260, 598], [150, 592], [98, 562], [72, 500],
      [38, 456], [-20, 440], [-105, 452], [-190, 508], [-235, 526], [-320, 522], [-368, 494], [-392, 438], [-378, 362],
      [-370, 300], [-412, 240], [-432, 175], [-433, 80], [-418, 30], [-380, 6], [-290, 0], [-150, 0]
    ],
  },
  {
    id: 'valbrune',
    name: 'Autodrome de Valbrune',
    gp: 'Grand Prix de Valbrune',
    place: 'Valbrune, Forêt des Hautes-Combes',
    theme: 'foret',
    width: 13,
    pitSide: -1,
    wear: 3.6,
    suspOpt: 55,
    overtaking: 0.35,
    rainChance: 0.35,
    description: 'Rapide et fluide, entre les sapins. Les grandes courbes usent les pneus avant.',
    points: [
      [0, 0], [300, 0], [600, 0], [800, 18], [920, 110], [970, 260], [930, 410], [860, 460], [760, 482], [665, 540], [628, 640],
      [650, 760], [720, 830], [850, 875], [895, 945], [880, 1040], [800, 1100], [600, 1120], [400, 1060], [270, 965], [175, 950],
      [100, 975], [-80, 1060], [-200, 1060], [-280, 1010], [-330, 900], [-300, 720], [-340, 600], [-420, 535], [-530, 470],
      [-590, 380], [-585, 240], [-530, 120], [-440, 40], [-300, 6], [-150, 0]
    ],
  },
  {
    id: 'kharam',
    name: 'Circuit des Sables de Kharam',
    gp: 'Grand Prix de Kharam',
    place: 'Kharam, Désert d’Ocre',
    theme: 'desert',
    width: 14,
    pitSide: 1,
    wear: 4.1,
    suspOpt: 70,
    overtaking: 0.55,
    rainChance: 0.05,
    description: 'Longues lignes droites et freinages appuyés. Le sable rend la piste abrasive.',
    points: [
      [0, 0], [400, 0], [800, 0], [990, 0], [1034, 8], [1058, 34], [1062, 76], [1046, 112], [1010, 134], [960, 145],
      [800, 160], [620, 190], [552, 226], [522, 280], [530, 352], [570, 404], [630, 430], [900, 456], [1100, 476], [1150, 505],
      [1176, 560], [1170, 630], [1130, 680], [1060, 700], [700, 702], [400, 692], [280, 660], [210, 590], [150, 515], [90, 476],
      [20, 470], [-80, 510], [-190, 610], [-240, 632], [-310, 620], [-360, 570], [-372, 480], [-340, 360], [-300, 250],
      [-322, 150], [-300, 50], [-250, 8], [-150, 0]
    ],
  },
  {
    id: 'lac-argent',
    name: 'Circuit du Lac d\u2019Argent',
    gp: 'Grand Prix du Lac d\u2019Argent',
    place: 'Saint-Aubin-du-Lac, Pays des Mille Étangs',
    theme: 'lac',
    width: 13,
    pitSide: -1,
    wear: 3.4,
    suspOpt: 45,
    overtaking: 0.45,
    rainChance: 0.3,
    description: 'Un tracé équilibré autour d\u2019un lac glaciaire, avec une épingle redoutée au bout de la ligne droite.',
    points: [
      [0, 0], [300, 0], [560, 0], [650, 25], [700, 90], [700, 200], [660, 260], [580, 280], [520, 330], [520, 420],
      [580, 480], [640, 560], [620, 660], [540, 700], [400, 700], [300, 660], [240, 580], [160, 560], [60, 600],
      [-60, 640], [-180, 620], [-260, 540], [-280, 420], [-240, 320], [-300, 230], [-360, 150], [-340, 60], [-260, 10],
      [-130, 0],
    ],
  },
  {
    id: 'montclair',
    name: 'Circuit de Montclair',
    gp: 'Grand Prix de Montclair',
    place: 'Montclair, Massif des Aiguilles',
    theme: 'montagne',
    width: 12,
    pitSide: 1,
    wear: 3.0,
    suspOpt: 20,
    overtaking: 0.5,
    rainChance: 0.4,
    description: 'Sinueux et piégeux au pied des sommets enneigés. La météo y change vite.',
    points: [
      [0, 0], [250, 0], [420, 0], [500, 30], [530, 100], [500, 170], [420, 200], [380, 260], [420, 330], [520, 360],
      [600, 420], [610, 520], [540, 580], [440, 560], [360, 500], [280, 520], [230, 600], [150, 660], [40, 650],
      [-20, 580], [-10, 480], [-80, 420], [-180, 440], [-270, 420], [-320, 340], [-300, 250], [-220, 200], [-200, 120],
      [-285, 75], [-325, 35], [-300, 5], [-220, 0], [-110, 0],
    ],
  },
];

const cache = new Map<string, Track>();

export function getTrack(id: string): Track {
  let t = cache.get(id);
  if (!t) {
    const def = TRACK_DEFS.find((d) => d.id === id);
    if (!def) throw new Error('Circuit inconnu : ' + id);
    t = buildTrack(def);
    cache.set(id, t);
  }
  return t;
}
