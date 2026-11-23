// Économie avancée : cours du marché, communication et presse, labels, emprunts, aides et équipements.
import { BUILDINGS, LIVESTOCK, RESOURCES, RES_IDS, type Res } from '../data/content';
import { hash2 } from '../core/rng';
import type { GameState } from './state';
import type { Sim } from './sim';

export interface Campaign {
  nom: string;
  desc: string;
  cout: number;
  jours: number; // durée de l'effet (0 = immédiat)
  visiteurs: number; // multiplicateur de fréquentation
  reputation: number; // gain immédiat
  minRep?: number;
  vente?: number; // salon : produits vendus sur place
}

export const CAMPAIGNS: Record<string, Campaign> = {
  affiches: { nom: 'Affiches à l\'office de tourisme', desc: 'Affiches et dépliants dans les offices de tourisme du canton.', cout: 120, jours: 14, visiteurs: 1.15, reputation: 0 },
  reseaux: { nom: 'Campagne sur les réseaux sociaux', desc: 'Photos du domaine, vidéos des récoltes et des animaux.', cout: 90, jours: 7, visiteurs: 1.12, reputation: 1 },
  journal: { nom: 'Annonce dans le journal local', desc: 'Encart publicitaire dans la presse départementale.', cout: 250, jours: 7, visiteurs: 1.3, reputation: 1 },
  portes: { nom: 'Journée portes ouvertes', desc: 'Une journée de fête au domaine : visites, dégustations, animations.', cout: 400, jours: 1, visiteurs: 3, reputation: 2 },
  radio: { nom: 'Spot à la radio régionale', desc: 'Message diffusé pendant une semaine aux heures de grande écoute.', cout: 900, jours: 7, visiteurs: 1.6, reputation: 2 },
  salon: { nom: 'Stand au salon de l\'agriculture', desc: 'Vente directe sur un stand (jusqu\'à 150 produits de la grange au prix boutique +10 %) et notoriété.', cout: 1500, jours: 0, visiteurs: 1, reputation: 4, vente: 150 },
  tv: { nom: 'Reportage à la télévision régionale', desc: 'Une équipe de télévision filme le domaine : grosse affluence pendant 10 jours.', cout: 3200, jours: 10, visiteurs: 2.1, reputation: 6, minRep: 45 },
};

export interface LabelDef {
  nom: string;
  desc: string;
  cout: number;
  jours: number; // délai de certification
  quotidien: number; // cotisation et contrôles (€/jour)
  prix: number; // prix acceptés par les clients et le négociant
}
export const LABELS: Record<string, LabelDef> = {
  bio: { nom: 'Agriculture biologique', desc: 'Conversion de 14 jours, puis les clients acceptent des prix 15 % plus élevés et le négociant paie 15 % de plus.', cout: 6000, jours: 14, quotidien: 15, prix: 1.15 },
  terroir: { nom: 'Label du terroir (IGP / AOP)', desc: 'Appellation régionale : +8 % sur tous les prix après 7 jours d\'instruction du dossier.', cout: 4000, jours: 7, quotidien: 6, prix: 1.08 },
  bienvenue: { nom: 'Réseau « Bienvenue à la ferme »', desc: 'Signalétique et guide touristique : +12 % de visiteurs, +3 de satisfaction.', cout: 1200, jours: 3, quotidien: 3, prix: 1 },
};

export interface LoanOffer {
  montant: number;
  jours: number;
  taux: number; // coût total en % du capital
}
export const LOANS: LoanOffer[] = [
  { montant: 10000, jours: 28, taux: 0.04 },
  { montant: 30000, jours: 56, taux: 0.07 },
  { montant: 80000, jours: 112, taux: 0.11 },
];

const JOURNAUX = ['L\'Écho des Campagnes', 'La Gazette du Terroir', 'Le Courrier Rural', 'Terre & Saveurs', 'Le Petit Journal du Canton', 'Radio Pays'];
const TITRES_BONS = [
  'Une ferme qui fait revivre le terroir',
  'Le domaine où l\'on vient en famille',
  'Des produits fermiers qui font l\'unanimité',
  'Visite d\'une exploitation exemplaire',
  'Ces jeunes agriculteurs qui réinventent la ferme',
  'Le goût d\'autrefois, à deux pas d\'ici',
];
const TITRES_MAUVAIS = ['Des visiteurs déçus par l\'accueil', 'Files d\'attente et rayons vides : la ferme critiquée'];

/** Champs économiques absents des anciennes sauvegardes. */
export function ensureEconomy(s: GameState) {
  s.market ??= {};
  s.waitMarket ??= false;
  s.campaigns ??= [];
  s.labels ??= {};
  s.loans ??= [];
  s.press ??= [];
}

/** Cours du marché d'un produit (1 = prix de référence). */
export const marketOf = (s: GameState, r: Res) => s.market?.[r] ?? 1;

/** Prix accepté grâce aux labels obtenus. */
export function priceBonus(s: GameState) {
  let k = 1;
  for (const [id, since] of Object.entries(s.labels ?? {})) if (since != null && s.minute >= since) k *= LABELS[id]?.prix ?? 1;
  return k;
}

export function labelActive(s: GameState, id: string) {
  const since = s.labels?.[id];
  return since != null && s.minute >= since;
}

/** Fréquentation : campagnes en cours, articles de presse, attractions, labels. */
export function visitorMult(sim: Sim) {
  const s = sim.s;
  let k = 1;
  for (const c of s.campaigns ?? []) if (s.minute < c.until) k *= c.visiteurs;
  const summer = Math.floor(s.minute / 1440 / 7) % 4 === 1;
  for (const b of s.buildings) {
    const d = BUILDINGS[b.type];
    if (d?.attrait && (d.effet !== 'labyrinthe' || summer)) k *= 1 + d.attrait;
  }
  if (labelActive(s, 'bienvenue')) k *= 1.12;
  return k;
}

/** Prix payé par le négociant (cours du marché et labels compris). */
export function wholesaleOf(s: GameState, r: Res) {
  const f = RESOURCES[r].boutique ? 0.7 : 0.9;
  return Math.round(RESOURCES[r].prix * f * marketOf(s, r) * priceBonus(s) * 100) / 100;
}

/** Évolution quotidienne des cours : marche aléatoire rappelée vers une tendance saisonnière, et quelques chocs. */
export function marketDaily(sim: Sim) {
  const s = sim.s;
  const season = Math.floor(s.minute / 1440 / 7) % 4;
  for (const r of RES_IDS) {
    const phase = hash2(r.length, r.charCodeAt(0), 11) * Math.PI * 2;
    const target = 1 + 0.12 * Math.sin(phase + (season * Math.PI) / 2);
    const m = s.market[r] ?? 1;
    s.market[r] = Math.round(Math.max(0.7, Math.min(1.4, m + (target - m) * 0.2 + sim.rng.range(-0.06, 0.06))) * 1000) / 1000;
  }
  if (sim.rng.chance(0.08)) {
    const r = sim.rng.pick(RES_IDS.filter((x) => (s.stats.harvested[x] ?? 0) + (s.stats.produced[x] ?? 0) > 0)) ?? sim.rng.pick(RES_IDS);
    const up = sim.rng.chance(0.5);
    s.market[r] = Math.max(0.7, Math.min(1.4, (s.market[r] ?? 1) * (up ? 1.25 : 0.78)));
    sim.event(up ? `Flambée des cours : ${RESOURCES[r].nom.toLowerCase()} à ${Math.round(s.market[r] * 100)} % du prix habituel.` : `Chute des cours : ${RESOURCES[r].nom.toLowerCase()} à ${Math.round(s.market[r] * 100)} % du prix habituel.`, up ? 'succes' : 'alerte');
  }
}

/** Articles de presse : la notoriété du domaine attire (ou fait fuir) les visiteurs. */
export function pressDaily(sim: Sim) {
  const s = sim.s;
  const active = s.campaigns.filter((c) => s.minute < c.until).length;
  const p = 0.03 + s.reputation / 1500 + active * 0.04;
  if (!sim.rng.chance(p)) return;
  const bad = s.satisfaction < 38 && sim.rng.chance(0.6);
  const journal = sim.rng.pick(JOURNAUX);
  const titre = sim.rng.pick(bad ? TITRES_MAUVAIS : TITRES_BONS);
  s.press.push({ min: s.minute, journal, titre, bon: !bad });
  if (s.press.length > 12) s.press.shift();
  if (bad) {
    s.reputation = Math.max(0, s.reputation - 3);
    sim.event(`Article dans « ${journal} » : « ${titre} ». Réputation −3.`, 'alerte');
  } else {
    s.reputation = Math.min(100, s.reputation + 2);
    s.campaigns.push({ id: 'article', until: s.minute + 3 * 1440, visiteurs: 1.25 });
    sim.event(`Article dans « ${journal} » : « ${titre} ». Plus de visiteurs pendant 3 jours !`, 'succes');
  }
}

export function launchCampaign(sim: Sim, id: string): string | null {
  const s = sim.s;
  const c = CAMPAIGNS[id];
  if (!c) return 'Campagne inconnue';
  if (c.minRep && s.reputation < c.minRep) return `Réputation insuffisante (${c.minRep} requis)`;
  if (s.money < c.cout) return 'Trésorerie insuffisante';
  if (s.campaigns.some((x) => x.id === id && s.minute < x.until)) return 'Déjà en cours';
  sim.book('accueil', -c.cout, `Communication — ${c.nom}`);
  s.reputation = Math.min(100, s.reputation + c.reputation);
  if (c.jours > 0) s.campaigns.push({ id, until: s.minute + c.jours * 1440, visiteurs: c.visiteurs });
  if (c.vente) {
    // salon : vente directe des produits de la grange
    let left = c.vente, total = 0;
    const list = RES_IDS.filter((r) => RESOURCES[r].boutique).sort((a, b) => sim.stockOf(b) * RESOURCES[b].prix - sim.stockOf(a) * RESOURCES[a].prix);
    for (const r of list) {
      if (left <= 0) break;
      const q = Math.min(left, Math.floor(sim.stockOf(r) * 0.6));
      if (q <= 0) continue;
      let l2 = q;
      for (const b of sim.storages()) l2 -= sim.remove(b, r, l2);
      const sold = q - l2;
      const amount = Math.round(sold * s.prices[r] * 1.1 * priceBonus(s) * 100) / 100;
      total += amount;
      left -= sold;
      s.stats.sold[r] = (s.stats.sold[r] ?? 0) + sold;
      sim.book(RESOURCES[r].activite, amount, `Salon — ${RESOURCES[r].nom}`);
    }
    sim.event(`Salon de l'agriculture : ${Math.round(total)} € de ventes sur le stand, réputation +${c.reputation}.`, 'succes');
  } else sim.event(`${c.nom} : campagne lancée pour ${c.jours} jour(s).`, 'succes');
  return null;
}

export function buyLabel(sim: Sim, id: string): string | null {
  const s = sim.s;
  const l = LABELS[id];
  if (!l) return 'Label inconnu';
  if (s.labels[id] != null) return 'Déjà engagé';
  if (s.money < l.cout) return 'Trésorerie insuffisante';
  sim.book('general', -l.cout, `Label — ${l.nom}`, true);
  s.labels[id] = s.minute + l.jours * 1440;
  sim.event(`${l.nom} : dossier engagé, obtention dans ${l.jours} jours.`, 'info');
  return null;
}

export function borrow(sim: Sim, i: number): string | null {
  const s = sim.s;
  const o = LOANS[i];
  if (!o) return 'Offre inconnue';
  if (s.loans.length >= 3) return 'Trois emprunts maximum en même temps';
  const total = o.montant * (1 + o.taux);
  s.money += o.montant;
  s.loans.push({ id: s.nextId++, nom: `Prêt de ${o.montant.toLocaleString('fr-FR')} €`, daily: Math.round((total / o.jours) * 100) / 100, left: o.jours });
  sim.event(`Prêt accordé : ${o.montant.toLocaleString('fr-FR')} € remboursés en ${o.jours} jours (coût total ${Math.round(o.taux * 100)} %).`, 'succes');
  return null;
}

/** Fin de journée : remboursements, aides, labels, énergie, ventes automatiques, réceptions. */
export function economyDaily(sim: Sim) {
  const s = sim.s;
  const day = Math.floor(s.minute / 1440);
  for (const l of s.loans) {
    sim.book('general', -l.daily, `Remboursement — ${l.nom}`);
    l.left--;
  }
  s.loans = s.loans.filter((l) => l.left > 0);
  for (const [id, since] of Object.entries(s.labels)) {
    if (since == null) continue;
    sim.book('general', -(LABELS[id]?.quotidien ?? 0), `Label — ${LABELS[id]?.nom ?? id}`);
    if (s.minute >= since && s.minute - 1440 < since) sim.event(`Label obtenu : ${LABELS[id]?.nom} !`, 'succes');
  }
  // aides de la PAC au début de chaque saison
  if (day % 7 === 0) {
    const lots = s.world.owned.filter(Boolean).length;
    const elevages = s.buildings.filter((b) => BUILDINGS[b.type]?.livestock).length;
    const aid = 140 * lots + 35 * elevages + (labelActive(s, 'bio') ? 400 : 0);
    sim.book('general', aid, 'Aides PAC (versement saisonnier)');
    sim.event(`Aides de la PAC versées : ${aid} €.`, 'info');
  }
  const has = (e: string) => s.buildings.filter((b) => BUILDINGS[b.type]?.effet === e).length;
  // énergie
  const wind = { soleil: 0.35, nuageux: 0.8, pluie: 1, orage: 1.1, neige: 0.7 }[s.weather];
  if (has('eolien')) sim.book('general', Math.round(40 * wind * has('eolien')), 'Électricité éolienne revendue');
  if (has('methaniseur')) {
    const n = Math.min(8, s.buildings.filter((b) => BUILDINGS[b.type]?.livestock && LIVESTOCK[BUILDINGS[b.type].livestock!].nombre > 0).length);
    if (n) sim.book('general', 22 * n * has('methaniseur'), 'Méthanisation (biogaz revendu)');
  }
  // ventes sans vendeur : étal au bord de la route, magasin de producteurs
  const sellAuto = (n: number, factor: number, label: string) => {
    let left = n;
    const list = RES_IDS.filter((r) => RESOURCES[r].boutique && sim.stockOf(r) > 5).sort((a, b) => sim.stockOf(b) - sim.stockOf(a));
    for (const r of list) {
      if (left <= 0) break;
      const q = Math.min(left, Math.ceil(n / 3), Math.floor(sim.stockOf(r) - 5));
      if (q <= 0) continue;
      let l2 = q;
      for (const b of sim.storages()) l2 -= sim.remove(b, r, l2);
      const sold = q - l2;
      left -= sold;
      s.stats.sold[r] = (s.stats.sold[r] ?? 0) + sold;
      sim.book(RESOURCES[r].activite, Math.round(sold * s.prices[r] * factor * priceBonus(s) * 100) / 100, `${label} — ${RESOURCES[r].nom}`);
    }
  };
  for (let k = 0; k < has('stand'); k++) sellAuto(15, 1, 'Étal de bord de route');
  for (let k = 0; k < has('magasin'); k++) sellAuto(40, 0.85, 'Magasin de producteurs');
  // réceptions du week-end
  if (has('reception') && day % 7 >= 5 && sim.rng.chance(0.35 + s.reputation / 250)) {
    const amount = Math.round(600 + s.reputation * 8);
    sim.book('accueil', amount, 'Location de la salle de réception');
    sim.event(sim.rng.pick(['Un mariage', 'Une fête de famille', 'Un séminaire', 'Un anniversaire']) + ` à la salle de réception : +${amount} €.`, 'succes');
  }
  // jardin fleuri : la réputation progresse doucement
  if (has('jardin') && day % 7 === 0 && s.reputation < 80) s.reputation = Math.min(80, s.reputation + has('jardin'));
  s.campaigns = s.campaigns.filter((c) => s.minute < c.until);
  marketDaily(sim);
  pressDaily(sim);
}

/** Coût de revient estimé d'une recette d'atelier (intrants au prix du négociant + consommables). */
export function recipeCost(s: GameState, input: Res, inQty: number, outQty: number, conso: number) {
  return (wholesaleOf(s, input) * inQty + conso) / outQty;
}
