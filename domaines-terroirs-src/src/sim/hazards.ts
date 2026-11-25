// Aléas de la vie agricole (grêle, sécheresse, gel, maladies, pannes, tempêtes) et assurances.
import { BUILDINGS, CROPS, ORCHARDS, RESOURCES } from '../data/content';
import type { GameState } from './state';
import type { Sim } from './sim';

export type Assurance = 'recoltes' | 'cheptel' | 'materiel';
export const ASSURANCES: Record<Assurance, { nom: string; desc: string }> = {
  recoltes: { nom: 'Assurance récoltes', desc: 'Grêle, gel et sécheresse : 80 % des pertes remboursées.' },
  cheptel: { nom: 'Assurance cheptel', desc: 'Maladies des animaux : frais vétérinaires et pertes remboursés à 80 %.' },
  materiel: { nom: 'Assurance matériel et bâtiments', desc: 'Pannes d\'engins et dégâts de tempête : 80 % des réparations remboursés.' },
};

const SEASON = (min: number) => Math.floor(min / 1440 / 7) % 4;
const parcels = (s: GameState) => s.buildings.filter((b) => ['champ', 'verger'].includes(BUILDINGS[b.type]?.kind ?? '')).length;
const pens = (s: GameState) => s.buildings.filter((b) => BUILDINGS[b.type]?.livestock).length;
const machines = (s: GameState) => s.vehicles.filter((v) => v.home >= 0).length;

/** Prime quotidienne de chaque assurance (selon ce qu'elle couvre). */
export function premium(s: GameState, a: Assurance) {
  if (a === 'recoltes') return 4 + 1.5 * parcels(s);
  if (a === 'cheptel') return 3 + 2 * pens(s);
  return 4 + 3 * machines(s) + 0.4 * s.buildings.length;
}

export function ensureHazards(s: GameState) {
  s.insurance ??= {};
  s.hazards ??= {};
}

/** Sécheresse ou gel en cours (effets sur la croissance et les vergers). */
export const droughtActive = (s: GameState) => (s.hazards?.secheresse ?? 0) > s.minute;
export const frostActive = (s: GameState) => (s.hazards?.gel ?? 0) > s.minute;

function indemnise(sim: Sim, a: Assurance, perte: number, quoi: string) {
  if (perte <= 0) return '';
  if (!sim.s.insurance[a]) return ` Perte estimée : ${Math.round(perte)} € (non assuré).`;
  const r = Math.round(perte * 0.8);
  sim.book('general', r, `Indemnité — ${ASSURANCES[a].nom} (${quoi})`);
  return ` L'assurance rembourse ${r} €.`;
}

/** Un tirage par jour ; la fréquence dépend de la saison, de la météo et de la région. */
export function hazardsDaily(sim: Sim) {
  const s = sim.s;
  const season = SEASON(s.minute);
  for (const a of Object.keys(ASSURANCES) as Assurance[]) if (s.insurance[a]) sim.book('general', -premium(s, a), `Prime — ${ASSURANCES[a].nom}`);
  const rng = sim.rng;
  const dry = s.region === 'provence' || s.region === 'sudouest' ? 2 : s.region === 'mer' || s.region === 'nord' ? 0.4 : 1;
  const fields = s.buildings.filter((b) => ['champ', 'verger'].includes(BUILDINGS[b.type]?.kind ?? ''));
  // grêle : printemps et été, surtout les jours d'orage
  if (fields.length && rng.chance((season <= 1 ? 0.035 : 0.008) + (s.weather === 'orage' ? 0.12 : 0))) {
    let perte = 0;
    const hit = fields.filter(() => rng.chance(0.4)).slice(0, 3);
    if (!hit.length) hit.push(rng.pick(fields));
    for (const b of hit) {
      const d = BUILDINGS[b.type];
      const res = d.crop ? CROPS[d.crop].produit : ORCHARDS[d.orchard!].produit;
      const before = b.ready;
      b.ready *= d.crop ? 0.5 : 0.4;
      if (d.crop && b.phase === 'pousse') {
        perte += b.growth * 0.4 * CROPS[d.crop].rendement * RESOURCES[res].prix * 0.5;
        b.growth *= 0.6;
      }
      perte += (before - b.ready) * RESOURCES[res].prix * 0.7;
    }
    sim.event(`Orage de grêle sur ${hit.length} parcelle(s) : récoltes abîmées.${indemnise(sim, 'recoltes', perte, 'grêle')}`, 'alerte');
  }
  // sécheresse estivale : croissance ralentie hors irrigation pendant 4 jours
  if (season === 1 && !droughtActive(s) && fields.length && rng.chance(0.03 * dry)) {
    s.hazards.secheresse = s.minute + 4 * 1440;
    const perte = fields.length * 140;
    sim.event(`Sécheresse : arrêtés préfectoraux, cultures ralenties pendant 4 jours (sauf parcelles irriguées).${indemnise(sim, 'recoltes', perte, 'sécheresse')}`, 'alerte');
  }
  // gel tardif au printemps : bourgeons et fleurs des vergers détruits
  const vergers = s.buildings.filter((b) => BUILDINGS[b.type]?.kind === 'verger');
  if (season === 0 && vergers.length && !frostActive(s) && rng.chance(0.04 * (s.region === 'est' || s.region === 'montagne' ? 1.8 : s.region === 'provence' || s.region === 'mer' ? 0.5 : 1))) {
    s.hazards.gel = s.minute + 5 * 1440;
    let perte = 0;
    for (const b of vergers) {
      const o = ORCHARDS[BUILDINGS[b.type].orchard!];
      perte += b.ready * RESOURCES[o.produit].prix * 0.7 + o.cap * 0.25 * RESOURCES[o.produit].prix * 0.7;
      b.ready = 0;
    }
    sim.event(`Gel tardif : fleurs et bourgeons des vergers détruits, production réduite pendant 5 jours.${indemnise(sim, 'recoltes', perte, 'gel')}`, 'alerte');
  }
  // maladie dans un élevage : production arrêtée, vétérinaire
  const elevages = s.buildings.filter((b) => BUILDINGS[b.type]?.livestock && !(b.sickUntil && b.sickUntil > s.minute));
  if (elevages.length && rng.chance(0.012 * Math.min(4, elevages.length))) {
    const b = rng.pick(elevages);
    b.sickUntil = s.minute + 4 * 1440;
    b.ready = 0;
    const veto = 150 + 25 * s.animals.filter((a) => a.pen === b.id).length;
    sim.book(BUILDINGS[b.type].activite, -veto, 'Vétérinaire et traitements');
    sim.event(`Maladie dans « ${BUILDINGS[b.type].nom} » : production arrêtée 4 jours, vétérinaire ${veto} €.${indemnise(sim, 'cheptel', veto + 250, 'maladie')}`, 'alerte');
  }
  // panne d'un engin
  const engins = s.vehicles.filter((v) => v.home >= 0 && !(v.brokenUntil && v.brokenUntil > s.minute));
  if (engins.length && rng.chance(0.02 * Math.min(4, engins.length))) {
    const v = rng.pick(engins);
    v.brokenUntil = s.minute + 2 * 1440;
    const cout = Math.round(rng.range(300, v.kind === 'tracteur' ? 1100 : 1800));
    sim.book('general', -cout, 'Réparation d\'engin');
    sim.event(`Panne : ${v.label.toLowerCase()} immobilisé(e) 2 jours, réparation ${cout} €.${indemnise(sim, 'materiel', cout, 'panne')}`, 'alerte');
  }
  // tempête : dégâts sur un bâtiment
  const bats = s.buildings.filter((b) => !['champ', 'verger', 'enclos'].includes(BUILDINGS[b.type]?.kind ?? ''));
  if (bats.length && rng.chance(s.weather === 'orage' ? 0.08 : season === 3 ? 0.015 : 0.004)) {
    const b = rng.pick(bats);
    const cout = Math.round(rng.range(400, 2500));
    sim.book('general', -cout, 'Réparations après tempête');
    sim.event(`Tempête : toiture de « ${BUILDINGS[b.type].nom} » endommagée, réparations ${cout} €.${indemnise(sim, 'materiel', cout, 'tempête')}`, 'alerte');
  }
}
