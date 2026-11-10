import { ARCHETYPES, ATTR_LABELS, OVR_WEIGHTS, type AttrKey } from '../data/attributes';
import { age as ageOf, playerOvr } from '../data/generate';
import type { PlayerData } from '../data/model';
import type { Career } from './career';
import { perGame } from './career';

/** Badges de style : décrivent un savoir-faire réel, calculé à partir des attributs. */
export interface Badge {
  id: string;
  name: string;
  desc: string;
  tier: 0 | 1 | 2 | 3; // 0 = non obtenu, 1 bronze, 2 argent, 3 or
  next: number; // points manquants pour le palier suivant
}

const BADGES: { id: string; name: string; desc: string; keys: AttrKey[] }[] = [
  { id: 'sniper', name: 'Sniper', desc: 'Tir à 3 points en sortie d’écran', keys: ['three', 'catchShoot'] },
  { id: 'pullup', name: 'Créateur de tirs', desc: 'Tir en suspension après dribble', keys: ['pullUp', 'shotCreation'] },
  { id: 'finisher', name: 'Finisseur', desc: 'Conclut près du cercle malgré le contact', keys: ['finishing', 'layup', 'strength'] },
  { id: 'aerial', name: 'Poster', desc: 'Dunks et finitions aériennes', keys: ['dunk', 'vertical', 'explosiveness'] },
  { id: 'handles', name: 'Manieur de ballon', desc: 'Dribble et protection sous pression', keys: ['dribble', 'ballSecurity', 'ballControl'] },
  { id: 'playmaker', name: 'Chef d’orchestre', desc: 'Vision et qualité de passe', keys: ['passing', 'vision', 'iq'] },
  { id: 'post', name: 'Maître du poste', desc: 'Jeu dos au panier et pied de pivot', keys: ['postPlay', 'footwork'] },
  { id: 'lockdown', name: 'Verrou', desc: 'Défense sur porteur de balle', keys: ['perimeterD', 'agility', 'pnrD'] },
  { id: 'thief', name: 'Pickpocket', desc: 'Interceptions et lecture des lignes de passe', keys: ['steal', 'passReading'] },
  { id: 'anchor', name: 'Gardien du cercle', desc: 'Contres et protection de la raquette', keys: ['block', 'rimProtect', 'positioning'] },
  { id: 'glass', name: 'Aimant à rebonds', desc: 'Rebond et placement', keys: ['defRebound', 'positioning', 'strength'] },
  { id: 'engine', name: 'Moteur', desc: 'Endurance et répétition des efforts', keys: ['stamina', 'durability', 'determination'] },
  { id: 'clutch', name: 'Sang-froid', desc: 'Performance dans les fins de match', keys: ['composure', 'pressure', 'concentration'] },
  { id: 'leader', name: 'Leader', desc: 'Influence sur le collectif', keys: ['leadership', 'teamwork', 'iq'] },
];

export function badges(p: PlayerData): Badge[] {
  return BADGES.map((b) => {
    const avg = b.keys.reduce((s, k) => s + p.attrs[k], 0) / b.keys.length;
    const tier = (avg >= 17 ? 3 : avg >= 15 ? 2 : avg >= 13 ? 1 : 0) as Badge['tier'];
    const nextAt = tier === 0 ? 13 : tier === 1 ? 15 : tier === 2 ? 17 : 20;
    return { id: b.id, name: b.name, desc: b.desc, tier, next: Math.max(0, Math.round((nextAt - avg) * b.keys.length * 10) / 10) };
  });
}

export const RADAR_AXES: { label: string; keys: AttrKey[] }[] = [
  { label: 'Tir', keys: ['three', 'midRange', 'catchShoot', 'pullUp', 'freeThrow'] },
  { label: 'Finition', keys: ['finishing', 'layup', 'dunk', 'postPlay'] },
  { label: 'Création', keys: ['dribble', 'passing', 'vision', 'shotCreation'] },
  { label: 'Défense', keys: ['perimeterD', 'teamD', 'steal', 'pnrD', 'block'] },
  { label: 'Rebond', keys: ['defRebound', 'positioning', 'strength'] },
  { label: 'Athlétisme', keys: ['speed', 'acceleration', 'vertical', 'stamina', 'agility'] },
  { label: 'Mental', keys: ['iq', 'composure', 'concentration', 'consistency', 'pressure'] },
];

export function radar(p: PlayerData): number[] {
  return RADAR_AXES.map((ax) => ax.keys.reduce((s, k) => s + p.attrs[k], 0) / ax.keys.length);
}

/** Moyenne des joueurs du même poste dans un championnat. */
export function leagueRadar(c: Career, leagueId: string, pos: PlayerData['pos']): number[] {
  const ps = (c.world.leagues[leagueId]?.teams ?? []).flatMap((t) => c.world.clubs[t].roster).map((id) => c.world.players[id]).filter((p) => p && p.pos === pos);
  if (!ps.length) return RADAR_AXES.map(() => 10);
  const sums = RADAR_AXES.map(() => 0);
  for (const p of ps) radar(p).forEach((v, i) => (sums[i] += v));
  return sums.map((s) => s / ps.length);
}

/** Valeur marchande estimée (€), dépend du niveau, de l'âge, du potentiel et de la réputation. */
export function marketValue(c: Career, p: PlayerData): number {
  const ovr = playerOvr(p);
  const a = ageOf(p, c.world.season);
  const ageF = a <= 21 ? 1.4 : a <= 25 ? 1.2 : a <= 29 ? 1 : a <= 32 ? 0.6 : 0.3;
  const pot = Math.max(0, p.potential - ovr) * (a <= 23 ? 0.6 : 0.15);
  const base = Math.max(0, ovr + pot - 48) ** 2.6 * 55;
  return Math.round((base * ageF * (1 + p.reputation / 200)) / 5000) * 5000;
}

export function potentialStars(p: PlayerData): number {
  return p.potential >= 88 ? 5 : p.potential >= 80 ? 4 : p.potential >= 72 ? 3 : p.potential >= 64 ? 2 : 1;
}

/** Rapport de recruteur rédigé à partir des données réelles du joueur. */
export function scoutingReport(c: Career, p: PlayerData): string[] {
  const a = ageOf(p, c.world.season);
  const ovr = playerOvr(p);
  const w = OVR_WEIGHTS[p.pos];
  const keys = (Object.keys(w) as AttrKey[]).sort((x, y) => p.attrs[y] - p.attrs[x]);
  const best = keys.slice(0, 3).map((k) => ATTR_LABELS[k].toLowerCase());
  const worst = keys.slice(-2).map((k) => ATTR_LABELS[k].toLowerCase());
  const pg = perGame(c.seasonStats[p.id]);
  const lines: string[] = [];
  lines.push(`${ARCHETYPES[p.archetype].label} de ${a} ans, ${p.heightCm} cm pour ${p.weightKg} kg. Ses meilleures armes à son poste : ${best.join(', ')}.`);
  lines.push(`Axes de progrès prioritaires : ${worst.join(' et ')}. ${p.attrs.discipline >= 14 ? 'Très sérieux à l’entraînement.' : p.attrs.discipline <= 7 ? 'Son manque de rigueur inquiète le staff.' : 'Investissement correct au quotidien.'}`);
  if (pg.gp > 0) lines.push(`Cette saison : ${pg.ppg.toFixed(1)} pts, ${pg.rpg.toFixed(1)} rbd et ${pg.apg.toFixed(1)} pd en ${pg.mpg.toFixed(1)} min (${pg.fg.toFixed(0)} % aux tirs, ${pg.tp.toFixed(0)} % à 3 pts).`);
  const gap = p.potential - ovr;
  const proj = a <= 20 ? (gap > 15 ? 'peut devenir un titulaire important en Élite, voire viser l’Europe' : gap > 8 ? 'a le profil d’un bon joueur de rotation en Élite' : 'devra beaucoup travailler pour s’imposer au plus haut niveau') : a <= 26 ? (gap > 6 ? 'a encore une marge de progression réelle' : 'approche de son plafond : il faut maintenant être régulier') : a <= 30 ? 'est dans ses meilleures années' : 'devra gérer le déclin physique en misant sur l’expérience';
  lines.push(`Projection : ${proj}. ${p.attrs.pressure >= 14 ? 'N’a pas peur des grands rendez-vous.' : p.attrs.pressure <= 7 ? 'Peut se crisper dans les moments chauds.' : ''}`);
  return lines;
}

export function attrDelta(c: Career, p: PlayerData, snap?: { season: number; attrs: Record<string, number> }): Partial<Record<AttrKey, number>> {
  if (!snap || snap.season !== c.world.season) return {};
  const d: Partial<Record<AttrKey, number>> = {};
  for (const k of Object.keys(p.attrs) as AttrKey[]) {
    const v = p.attrs[k] - (snap.attrs[k] ?? p.attrs[k]);
    if (v !== 0) d[k] = v;
  }
  return d;
}
