import { hashString, Rng } from '../core/rng';
import { POSITIONS, type Position } from '../data/attributes';
import { generatePlayer, NameRegistry, newId, playerOvr } from '../data/generate';
import { DEFAULT_TACTICS, type Club, type PlayerData, type TeamTactics } from '../data/model';

/** Univers fictif : aucun club, ligue ou joueur ne correspond à une entité réelle. */
export interface League {
  id: string;
  name: string;
  country: string;
  level: number; // 1 = élite
  rules: 'FIBA' | 'NBA' | 'NCB';
  teams: string[];
  strength: number; // niveau moyen d'attribut visé
  playoffs: number; // nombre de qualifiés (0 = aucun)
  promotesTo?: string;
  relegatesTo?: string;
  fictionalNote: string;
}

export interface Fixture {
  id: string;
  leagueId: string;
  round: number;
  week: number;
  home: string;
  away: string;
  played: boolean;
  hs: number;
  as: number;
  stage: 'regular' | 'semi' | 'final' | 'cup' | 'youth' | 'nat';
  label?: string;
  /** Ligne statistique du joueur incarné, si concerné */
  userLine?: UserGameLine;
}

export interface UserGameLine {
  min: number;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  pf: number;
  pm: number;
  rating: number;
  started: boolean;
  played: boolean; // match joué en direct (true) ou simulé
}

interface ClubSeed {
  name: string;
  short: string;
  city: string;
  colors: [string, string];
}

const FRA1: ClubSeed[] = [
  { name: 'Paris Lumière BC', short: 'PLB', city: 'Paris', colors: ['#1E2A78', '#F6F4EF'] },
  { name: 'Lyon Confluence', short: 'LYC', city: 'Lyon', colors: ['#7A1C2E', '#F2C14E'] },
  { name: 'Monaco Riviera', short: 'MON', city: 'Monaco', colors: ['#C8102E', '#F6F4EF'] },
  { name: 'Strasbourg Rhin Basket', short: 'SRB', city: 'Strasbourg', colors: ['#0B6E4F', '#F6F4EF'] },
  { name: 'Le Mans Sarthe Hoops', short: 'LMS', city: 'Le Mans', colors: ['#F36B32', '#101827'] },
  { name: 'Limoges Émaux', short: 'LIM', city: 'Limoges', colors: ['#2F7D32', '#F6F4EF'] },
  { name: 'Nanterre Seine Ouest', short: 'NSO', city: 'Nanterre', colors: ['#3988F5', '#101827'] },
  { name: 'Cholet Mauges Basket', short: 'CMB', city: 'Cholet', colors: ['#B71C1C', '#101827'] },
  { name: 'Dijon Bourgogne Pro', short: 'DBP', city: 'Dijon', colors: ['#6A1B9A', '#F2C14E'] },
  { name: 'Pau Gaves Basket', short: 'PAU', city: 'Pau', colors: ['#00897B', '#F6F4EF'] },
  { name: 'Bordeaux Garonne', short: 'BDX', city: 'Bordeaux', colors: ['#5D1F3A', '#DDB65A'] },
  { name: 'Lille Flandres BC', short: 'LFB', city: 'Lille', colors: ['#D84315', '#1A237E'] },
];
const FRA2: ClubSeed[] = [
  { name: 'Rouen Seine Maritime', short: 'RSM', city: 'Rouen', colors: ['#283593', '#FFCA28'] },
  { name: 'Nantes Atlantique', short: 'NAT', city: 'Nantes', colors: ['#F9A825', '#1B5E20'] },
  { name: 'Toulouse Garonne Pro', short: 'TGP', city: 'Toulouse', colors: ['#AD1457', '#F6F4EF'] },
  { name: 'Orléans Loire BC', short: 'OLB', city: 'Orléans', colors: ['#00838F', '#F6F4EF'] },
  { name: 'Saint-Quentin Picardie', short: 'SQP', city: 'Saint-Quentin', colors: ['#1565C0', '#F6F4EF'] },
  { name: 'Évreux Normandie', short: 'EVN', city: 'Évreux', colors: ['#4E342E', '#FFB300'] },
  { name: 'Antibes Azur', short: 'ANT', city: 'Antibes', colors: ['#0277BD', '#F6F4EF'] },
  { name: 'Vichy Allier', short: 'VCH', city: 'Vichy', colors: ['#2E7D32', '#F2C14E'] },
  { name: 'Quimper Cornouaille', short: 'QCO', city: 'Quimper', colors: ['#212121', '#F6F4EF'] },
  { name: 'Fos Provence Mer', short: 'FPM', city: 'Fos-sur-Mer', colors: ['#00ACC1', '#101827'] },
  { name: 'Denain Escaut', short: 'DEN', city: 'Denain', colors: ['#C62828', '#F6F4EF'] },
  { name: 'Pointe-à-Pitre Caraïbes', short: 'PAP', city: 'Pointe-à-Pitre', colors: ['#FFB300', '#0D47A1'] },
];
const ESP: ClubSeed[] = [
  { name: 'Madrid Castilla', short: 'MCA', city: 'Madrid', colors: ['#F6F4EF', '#4A148C'] },
  { name: 'Barcelona Litoral', short: 'BLI', city: 'Barcelone', colors: ['#1A237E', '#B71C1C'] },
  { name: 'Valencia Turia', short: 'VTU', city: 'Valence', colors: ['#EF6C00', '#101827'] },
  { name: 'Vitoria Álava', short: 'VAL', city: 'Vitoria', colors: ['#0D47A1', '#C62828'] },
  { name: 'Málaga Costa', short: 'MCO', city: 'Malaga', colors: ['#2E7D32', '#F6F4EF'] },
  { name: 'Badalona Marina', short: 'BMA', city: 'Badalona', colors: ['#00695C', '#F6F4EF'] },
  { name: 'Murcia Segura', short: 'MSE', city: 'Murcie', colors: ['#C62828', '#F2C14E'] },
  { name: 'Zaragoza Ebro', short: 'ZEB', city: 'Saragosse', colors: ['#3949AB', '#F6F4EF'] },
  { name: 'Tenerife Teide', short: 'TTE', city: 'Tenerife', colors: ['#FBC02D', '#1A237E'] },
  { name: 'Bilbao Nervión', short: 'BNE', city: 'Bilbao', colors: ['#212121', '#C62828'] },
  { name: 'Granada Alhambra', short: 'GAL', city: 'Grenade', colors: ['#AD1457', '#101827'] },
  { name: 'Manresa Bages', short: 'MBA', city: 'Manresa', colors: ['#558B2F', '#F6F4EF'] },
];
const NCB: ClubSeed[] = [
  { name: 'Lakeshore University', short: 'LKU', city: 'Chicago', colors: ['#4527A0', '#F2C14E'] },
  { name: 'Pacific Coast State', short: 'PCS', city: 'Los Angeles', colors: ['#0277BD', '#FFCA28'] },
  { name: 'Hudson Tech', short: 'HUD', city: 'New York', colors: ['#B71C1C', '#F6F4EF'] },
  { name: 'Peachtree College', short: 'PTC', city: 'Atlanta', colors: ['#E65100', '#101827'] },
  { name: 'Gulf Coast University', short: 'GCU', city: 'Houston', colors: ['#B71C1C', '#101827'] },
  { name: 'Liberty Bell State', short: 'LBS', city: 'Philadelphie', colors: ['#1565C0', '#F6F4EF'] },
  { name: 'Motor City University', short: 'MCU', city: 'Detroit', colors: ['#00695C', '#F6F4EF'] },
  { name: 'Chesapeake College', short: 'CHC', city: 'Baltimore', colors: ['#311B92', '#DDB65A'] },
  { name: 'Prairie State', short: 'PRS', city: 'Kansas City', colors: ['#2E7D32', '#F2C14E'] },
  { name: 'Bluegrass University', short: 'BGU', city: 'Lexington', colors: ['#0D47A1', '#F6F4EF'] },
  { name: 'Tobacco Road College', short: 'TRC', city: 'Durham', colors: ['#1A237E', '#F6F4EF'] },
  { name: 'Desert Valley Tech', short: 'DVT', city: 'Phoenix', colors: ['#BF360C', '#101827'] },
];


const mk = (rows: [string, string, string, string, string][]): ClubSeed[] => rows.map(([name, short, city, c1, c2]) => ({ name, short, city, colors: [c1, c2] }));
const ITA = mk([
  ['Milano Navigli', 'MIN', 'Milan', '#B71C1C', '#F6F4EF'], ['Bologna Portici', 'BOP', 'Bologne', '#101827', '#F6F4EF'], ['Venezia Laguna', 'VLA', 'Venise', '#7A1C2E', '#DDB65A'],
  ['Roma Sette Colli', 'RSC', 'Rome', '#8E1B1B', '#F2C14E'], ['Torino Mole', 'TMO', 'Turin', '#F9A825', '#1A237E'], ['Napoli Vesuvio', 'NVE', 'Naples', '#0277BD', '#F6F4EF'],
  ['Trento Dolomiti', 'TDO', 'Trente', '#212121', '#F6F4EF'], ['Brescia Leonessa', 'BLE', 'Brescia', '#1565C0', '#F6F4EF'], ['Sassari Isola', 'SIS', 'Sassari', '#1A237E', '#F6F4EF'],
  ['Trieste Bora', 'TBO', 'Trieste', '#C62828', '#F6F4EF'], ['Varese Laghi', 'VLG', 'Varèse', '#B71C1C', '#101827'], ['Pesaro Riviera', 'PRI', 'Pesaro', '#AD1457', '#F6F4EF'],
]);
const GER = mk([
  ['Berlin Spree', 'BSP', 'Berlin', '#F9A825', '#0D47A1'], ['München Isar', 'MIS', 'Munich', '#B71C1C', '#F6F4EF'], ['Hamburg Hafen', 'HHA', 'Hambourg', '#101827', '#F6F4EF'],
  ['Bamberg Franken', 'BFR', 'Bamberg', '#C62828', '#101827'], ['Ulm Donau', 'UDO', 'Ulm', '#EF6C00', '#101827'], ['Bonn Rhein', 'BRH', 'Bonn', '#AD1457', '#F6F4EF'],
  ['Oldenburg Hunte', 'OHU', 'Oldenbourg', '#F9A825', '#1A237E'], ['Ludwigsburg Neckar', 'LNE', 'Ludwigsburg', '#FBC02D', '#101827'], ['Göttingen Leine', 'GLE', 'Göttingen', '#4527A0', '#F6F4EF'],
  ['Würzburg Main', 'WMA', 'Wurtzbourg', '#C62828', '#F6F4EF'], ['Braunschweig Oker', 'BOK', 'Brunswick', '#F9A825', '#0D47A1'], ['Frankfurt Mainufer', 'FMA', 'Francfort', '#1565C0', '#F6F4EF'],
]);
const GRE = mk([
  ['Athina Akropolis', 'ATA', 'Athènes', '#2E7D32', '#F6F4EF'], ['Pireas Limani', 'PIL', 'Le Pirée', '#C62828', '#F6F4EF'], ['Thessaloniki Lefkos', 'THL', 'Thessalonique', '#101827', '#F6F4EF'],
  ['Patra Gefyra', 'PGE', 'Patras', '#1565C0', '#F9A825'], ['Heraklion Minos', 'HMI', 'Héraklion', '#6A1B9A', '#F6F4EF'], ['Larissa Thessalia', 'LTH', 'Larissa', '#AD1457', '#F6F4EF'],
  ['Rodos Ilios', 'ROI', 'Rhodes', '#F9A825', '#0D47A1'], ['Volos Argo', 'VAR', 'Volos', '#0277BD', '#F6F4EF'], ['Ioannina Pamvotis', 'IPA', 'Ioannina', '#00695C', '#F6F4EF'],
  ['Kavala Thassos', 'KTH', 'Kavala', '#1A237E', '#F6F4EF'], ['Chalkida Evripos', 'CEV', 'Chalcis', '#EF6C00', '#101827'], ['Kalamata Messinia', 'KME', 'Kalamata', '#212121', '#DDB65A'],
]);
const TUR = mk([
  ['Istanbul Boğaz', 'IBO', 'Istanbul', '#1A237E', '#F9A825'], ['Istanbul Haliç', 'IHA', 'Istanbul', '#B71C1C', '#F9A825'], ['Ankara Başkent', 'ABA', 'Ankara', '#0D47A1', '#F6F4EF'],
  ['Izmir Körfez', 'IKO', 'Izmir', '#2E7D32', '#F6F4EF'], ['Bursa Uludağ', 'BUL', 'Bursa', '#2E7D32', '#101827'], ['Antalya Akdeniz', 'AAK', 'Antalya', '#C62828', '#F6F4EF'],
  ['Konya Mevlana', 'KMV', 'Konya', '#00695C', '#F6F4EF'], ['Gaziantep Zeugma', 'GZE', 'Gaziantep', '#B71C1C', '#101827'], ['Trabzon Karadeniz', 'TKA', 'Trabzon', '#7A1C2E', '#3988F5'],
  ['Eskişehir Porsuk', 'EPO', 'Eskişehir', '#C62828', '#101827'], ['Adana Seyhan', 'ASE', 'Adana', '#EF6C00', '#1A237E'], ['Kayseri Erciyes', 'KER', 'Kayseri', '#F9A825', '#B71C1C'],
]);
const APL = mk([
  ['New York Empire', 'NYE', 'New York', '#1A237E', '#F36B32'], ['Los Angeles Waves', 'LAW', 'Los Angeles', '#4527A0', '#F9A825'], ['Chicago Wind', 'CHW', 'Chicago', '#B71C1C', '#101827'],
  ['Houston Oilmen', 'HOU', 'Houston', '#C62828', '#F6F4EF'], ['Miami Tide', 'MIA', 'Miami', '#00838F', '#F6F4EF'], ['Boston Harbor', 'BOS', 'Boston', '#2E7D32', '#F6F4EF'],
  ['Seattle Rain', 'SEA', 'Seattle', '#1B5E20', '#F9A825'], ['Denver Summit', 'DEN', 'Denver', '#0D47A1', '#F9A825'], ['Atlanta Firebirds', 'ATL', 'Atlanta', '#C62828', '#F9A825'],
  ['Dallas Lone Stars', 'DAL', 'Dallas', '#0277BD', '#101827'], ['Toronto North', 'TOR', 'Toronto', '#B71C1C', '#101827'], ['Phoenix Scorpions', 'PHX', 'Phoenix', '#4A148C', '#EF6C00'],
]);

export const LEAGUE_DEFS: { id: string; name: string; country: string; level: number; rules: League['rules']; strength: number; seeds: ClubSeed[]; nations: string[]; playoffs: number; promotesTo?: string; relegatesTo?: string; age: [number, number]; wealth?: number; repBonus?: number }[] = [
  { id: 'FRA1', name: 'Élite Nationale', country: 'FRA', level: 1, rules: 'FIBA', strength: 12.2, seeds: FRA1, nations: ['FRA', 'FRA', 'FRA', 'USA', 'SEN', 'SRB', 'BEL', 'CMR'], playoffs: 4, relegatesTo: 'FRA2', age: [19, 34] },
  { id: 'FRA2', name: 'Pro Nationale', country: 'FRA', level: 2, rules: 'FIBA', strength: 10.4, seeds: FRA2, nations: ['FRA', 'FRA', 'FRA', 'FRA', 'USA', 'BEL', 'SEN'], playoffs: 4, promotesTo: 'FRA1', age: [18, 34] },
  { id: 'ESP1', name: 'Liga Peninsular', country: 'ESP', level: 1, rules: 'FIBA', strength: 12.6, seeds: ESP, nations: ['ESP', 'ESP', 'ESP', 'USA', 'SRB', 'LTU', 'GRE', 'ITA', 'TUR'], playoffs: 4, age: [19, 34] },
  { id: 'ITA1', name: 'Lega Adriatica', country: 'ITA', level: 1, rules: 'FIBA', strength: 12.3, seeds: ITA, nations: ['ITA', 'ITA', 'ITA', 'USA', 'SRB', 'LTU', 'SEN'], playoffs: 4, age: [19, 34] },
  { id: 'GER1', name: 'Korbliga', country: 'GER', level: 1, rules: 'FIBA', strength: 12.1, seeds: GER, nations: ['GER', 'GER', 'GER', 'USA', 'USA', 'LTU', 'SRB'], playoffs: 4, age: [19, 34] },
  { id: 'GRE1', name: 'Elliniki Liga', country: 'GRE', level: 1, rules: 'FIBA', strength: 12.2, seeds: GRE, nations: ['GRE', 'GRE', 'GRE', 'USA', 'SRB', 'TUR'], playoffs: 4, age: [19, 35] },
  { id: 'TUR1', name: 'Anadolu Ligi', country: 'TUR', level: 1, rules: 'FIBA', strength: 12.5, seeds: TUR, nations: ['TUR', 'TUR', 'TUR', 'USA', 'SRB', 'GRE', 'FRA'], playoffs: 4, age: [19, 35] },
  { id: 'APL', name: 'American Pro League', country: 'USA', level: 1, rules: 'NBA', strength: 14.6, seeds: APL, nations: ['USA', 'USA', 'USA', 'USA', 'CAN', 'FRA', 'SRB', 'GRE', 'ESP', 'GER', 'CMR', 'SEN'], playoffs: 4, age: [20, 35], wealth: 6, repBonus: 22 },
  { id: 'NCB', name: 'NCB — Conférence universitaire', country: 'USA', level: 3, rules: 'NCB', strength: 9.8, seeds: NCB, nations: ['USA', 'USA', 'USA', 'CAN', 'FRA', 'SEN'], playoffs: 4, age: [18, 22] },
];

export interface World {
  seed: number;
  season: number;
  leagues: Record<string, League>;
  clubs: Record<string, Club>;
  players: Record<string, PlayerData>;
  fixtures: Fixture[];
  usedNames: string[];
}

function tacticsFor(rng: Rng): TeamTactics {
  return {
    ...DEFAULT_TACTICS,
    pace: Math.round(rng.range(0.3, 0.8) * 100) / 100,
    threeRate: Math.round(rng.range(0.3, 0.8) * 100) / 100,
    defense: rng.chance(0.12) ? 'zone23' : rng.chance(0.2) ? 'switch' : 'man',
    pressure: Math.round(rng.range(0.3, 0.8) * 100) / 100,
    crashBoards: Math.round(rng.range(0.2, 0.55) * 100) / 100,
    pnrFreq: Math.round(rng.range(0.3, 0.8) * 100) / 100,
  };
}

const COACH_FIRST = ['Jean-Marc', 'Pascal', 'Vincent', 'Laurent', 'Frédéric', 'Sergio', 'Dušan', 'Georgios', 'Mike', 'Andrea', 'Erik', 'Thierry', 'Olivier', 'Rubén'];
const COACH_LAST = ['Durand', 'Petit', 'Collet', 'Mercier', 'Rivera', 'Ivković', 'Papas', 'Hollis', 'Benedetti', 'Larsen', 'Moreau', 'Aubry', 'Navarro', 'Fontaine'];

export function createWorld(seed: number, season: number): World {
  const rng = new Rng(seed);
  const names = new NameRegistry();
  const w: World = { seed, season, leagues: {}, clubs: {}, players: {}, fixtures: [], usedNames: [] };
  for (const def of LEAGUE_DEFS) addLeague(w, def, rng, names, season);
  w.usedNames = [...names.used];
  return w;
}

/** Ajoute à un monde existant les championnats apparus dans une version plus récente du jeu. */
export function ensureLeagues(w: World, season: number): string[] {
  const added: string[] = [];
  for (const def of LEAGUE_DEFS) {
    if (w.leagues[def.id]) continue;
    const names = new NameRegistry(w.usedNames);
    addLeague(w, def, new Rng(hashString(`${w.seed}|${def.id}`)), names, season);
    w.usedNames = [...names.used];
    added.push(def.name);
  }
  return added;
}

function addLeague(w: World, def: (typeof LEAGUE_DEFS)[number], rng: Rng, names: NameRegistry, season: number): void {
  {
    const league: League = {
      id: def.id,
      name: def.name,
      country: def.country,
      level: def.level,
      rules: def.rules,
      teams: [],
      strength: def.strength,
      playoffs: def.playoffs,
      promotesTo: def.promotesTo,
      relegatesTo: def.relegatesTo,
      fictionalNote: 'Compétition fictive',
    };
    def.seeds.forEach((cs, i) => {
      const id = `${def.id}_${cs.short}`;
      // Hiérarchie : quelques clubs riches et ambitieux, d'autres modestes
      const tier = i < 3 ? 1.2 : i < 7 ? 0 : -1;
      const club: Club = {
        id,
        name: cs.name,
        short: cs.short,
        city: cs.city,
        country: def.country,
        leagueId: def.id,
        colors: cs.colors,
        budget: Math.round((def.level === 1 ? 6 : def.level === 2 ? 2.2 : 1.5) * (1 + tier * 0.35 + rng.range(-0.15, 0.15)) * 1e6 * (def.wealth ?? 1)),
        reputation: Math.round(Math.max(10, Math.min(95, (def.level === 1 ? 62 : def.level === 2 ? 40 : 45) + tier * 9 + (def.repBonus ?? 0) + rng.normal(0, 4)))),
        coach: {
          name: `${rng.pick(COACH_FIRST)} ${rng.pick(COACH_LAST)}`,
          tactics: tacticsFor(rng),
          youthTrust: Math.round(rng.range(0.15, 0.85) * 100) / 100,
          development: rng.int(7, 18),
        },
        philosophy: rng.pick(['youth', 'win-now', 'balanced'] as const),
        facilities: rng.int(6, 18) + (tier > 0 ? 2 : 0),
        youth: rng.int(5, 18),
        roster: [],
      };
      const level = def.strength + tier * 0.55;
      const plan: Position[] = ['PG', 'SG', 'SF', 'PF', 'C', 'PG', 'SG', 'SF', 'PF', 'C', 'SG', 'PF'];
      plan.forEach((pos, k) => {
        const age = rng.int(def.age[0], def.age[1]);
        const lvl = level + (k < 5 ? 0.9 : k < 9 ? 0 : -1.2) + rng.normal(0, 0.6) + (age < 21 ? -1.2 : age > 31 ? -0.4 : 0);
        const p = generatePlayer(rng, names, { pos, age, level: lvl, nation: rng.pick(def.nations), season });
        p.clubId = id;
        p.contract = { clubId: id, salary: salaryFor(playerOvr(p), def.level), until: season + rng.int(0, 2), role: k < 5 ? 'starter' : 'rotation' };
        w.players[p.id] = p;
        club.roster.push(p.id);
      });
      ensureNumbers(w, club);
      w.clubs[id] = club;
      league.teams.push(id);
    });
    w.leagues[def.id] = league;
  }
}

export function salaryFor(ovr: number, level: number): number {
  const base = level === 1 ? 60000 : level === 2 ? 30000 : 0; // NCB : bourse universitaire (pas de salaire)
  if (level === 3) return 0;
  return Math.round((base + Math.max(0, ovr - 50) ** 2 * (level === 1 ? 900 : 380)) / 1000) * 1000;
}

export function ensureNumbers(w: World, club: Club): void {
  const used = new Set<number>();
  for (const id of club.roster) {
    const p = w.players[id];
    if (!p) continue;
    let n = p.number;
    while (used.has(n)) n = (n + 1) % 100; // +1 parcourt tous les numéros (l'ancien pas de 7 pouvait boucler sans fin)
    p.number = n;
    used.add(n);
  }
}

export function newPlayerId(rng: Rng): string {
  return newId('p', rng);
}

export { POSITIONS };
