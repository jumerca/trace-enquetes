// Progression : paliers d'exploitation avec récompenses, défis propres à chaque région, conseils du jour.
import { BUILDINGS, RESOURCES, type Res } from '../data/content';
import { LABELS, labelActive } from './economy';
import type { GameState } from './state';
import type { Sim } from './sim';

export interface Goal {
  nom: string;
  val: (sim: Sim) => number;
  cible: number;
  unite?: string;
}
export interface Palier {
  nom: string;
  texte: string;
  objectifs: Goal[];
  prime: number;
  reputation: number;
}

const count = (sim: Sim, f: (kind: string, id: string) => boolean) => sim.s.buildings.filter((b) => f(BUILDINGS[b.type]?.kind ?? '', b.type)).length;
const sum = (o: Partial<Record<Res, number>>) => Object.values(o).reduce((a: number, b) => a + (b ?? 0), 0);
const labels = (s: GameState) => Object.keys(LABELS).filter((id) => labelActive(s, id)).length;

export const PALIERS: Palier[] = [
  {
    nom: 'Exploitant débutant',
    texte: 'Agrandissez le domaine et formez une petite équipe.',
    objectifs: [
      { nom: 'Bâtiments et parcelles', val: (sim) => sim.s.buildings.length, cible: 9 },
      { nom: 'Employés', val: (sim) => sim.s.workers.length, cible: 4 },
      { nom: 'Recettes cumulées', val: (sim) => sim.s.stats.revenue ?? 0, cible: 3000, unite: '€' },
    ],
    prime: 2500,
    reputation: 2,
  },
  {
    nom: 'Ferme diversifiée',
    texte: 'Transformez vos produits, élevez des animaux et accueillez du public.',
    objectifs: [
      { nom: 'Ateliers de transformation', val: (sim) => count(sim, (k) => k === 'atelier'), cible: 2 },
      { nom: 'Élevages', val: (sim) => count(sim, (k) => k === 'enclos'), cible: 1 },
      { nom: 'Visiteurs accueillis', val: (sim) => sim.s.stats.visitors, cible: 150 },
    ],
    prime: 5000,
    reputation: 3,
  },
  {
    nom: 'Domaine reconnu',
    texte: 'Faites connaître la qualité de vos produits.',
    objectifs: [
      { nom: 'Réputation', val: (sim) => Math.round(sim.s.reputation), cible: 60 },
      { nom: 'Labels obtenus', val: (sim) => labels(sim.s), cible: 1 },
      { nom: 'Recettes cumulées', val: (sim) => sim.s.stats.revenue ?? 0, cible: 25000, unite: '€' },
    ],
    prime: 8000,
    reputation: 3,
  },
  {
    nom: 'Entreprise rurale',
    texte: 'Changez d\'échelle : terres, équipe et volumes.',
    objectifs: [
      { nom: 'Employés', val: (sim) => sim.s.workers.length, cible: 10 },
      { nom: 'Lots de terrain', val: (sim) => sim.s.world.owned.filter(Boolean).length, cible: 12 },
      { nom: 'Produits vendus', val: (sim) => Math.round(sum(sim.s.stats.sold)), cible: 5000 },
    ],
    prime: 12000,
    reputation: 4,
  },
  {
    nom: 'Destination du terroir',
    texte: 'Le domaine devient un lieu de séjour et de loisirs.',
    objectifs: [
      { nom: 'Hébergements (gîte, camping)', val: (sim) => count(sim, (k) => k === 'gite'), cible: 1 },
      { nom: 'Attractions', val: (sim) => count(sim, (k) => k === 'attraction'), cible: 2 },
      { nom: 'Visiteurs accueillis', val: (sim) => sim.s.stats.visitors, cible: 1500 },
      { nom: 'Satisfaction', val: (sim) => sim.s.satisfaction, cible: 70 },
    ],
    prime: 18000,
    reputation: 5,
  },
  {
    nom: 'Grand domaine d\'excellence',
    texte: 'Le sommet : un domaine prospère, admiré, fidèle à son terroir.',
    objectifs: [
      { nom: 'Recettes cumulées', val: (sim) => sim.s.stats.revenue ?? 0, cible: 250000, unite: '€' },
      { nom: 'Réputation', val: (sim) => Math.round(sim.s.reputation), cible: 85 },
      { nom: 'Défis de la région réussis', val: (sim) => sim.s.career?.defis.length ?? 0, cible: 3 },
    ],
    prime: 30000,
    reputation: 5,
  },
];

export interface Defi {
  id: string;
  nom: string;
  res: Res;
  type: 'produced' | 'harvested' | 'sold';
  cible: number;
}
const D = (id: string, nom: string, res: Res, type: Defi['type'], cible: number): Defi => ({ id, nom, res, type, cible });
/** Trois défis par région, tirés de ses spécialités. */
export const DEFIS: Record<string, Defi[]> = {
  limousin: [D('chataignes', 'La châtaigne du Limousin', 'chataignes', 'harvested', 300), D('viande', 'Viande limousine en caissettes', 'viande', 'produced', 100), D('confit', 'Confits du Périgord', 'confit', 'produced', 40)],
  nord: [D('biere', 'Bière de la ferme', 'biere', 'produced', 200), D('patates', 'Pommes de terre des Flandres', 'pommes_de_terre', 'harvested', 1500), D('beurre', 'Beurre fermier', 'beurre', 'produced', 120)],
  beauce: [D('ble', 'Grenier à blé', 'ble', 'harvested', 12000), D('farine', 'Meunier de Beauce', 'farine', 'produced', 4000), D('pain', 'Pain de campagne', 'pain', 'produced', 900)],
  est: [D('mirabelles', 'Mirabelles de Lorraine', 'mirabelles', 'harvested', 400), D('vin', 'Vins d\'Alsace', 'vin', 'produced', 200), D('eaudevie', 'Eau-de-vie de mirabelle', 'eau_de_vie', 'produced', 30)],
  sudouest: [D('confit', 'Confit de canard', 'confit', 'produced', 60), D('pruneaux', 'Pruneaux d\'Agen', 'pruneaux', 'produced', 150), D('foiegras', 'Foie gras du Sud-Ouest', 'foie_gras', 'produced', 30)],
  montagne: [D('tomme', 'Tommes d\'alpage', 'tomme', 'produced', 60), D('miel', 'Miel de montagne', 'miel', 'produced', 80), D('lentilles', 'Lentilles vertes', 'lentilles', 'harvested', 200)],
  mer: [D('cidre', 'Cidre fermier', 'cidre', 'produced', 200), D('galettes', 'Galettes de sarrasin', 'galettes', 'produced', 300), D('beurre', 'Beurre demi-sel', 'beurre', 'produced', 120)],
  provence: [D('essence', 'Essence de lavande', 'essence', 'produced', 150), D('olive', 'Huile d\'olive de Provence', 'huile_olive', 'produced', 80), D('nougat', 'Nougat de Provence', 'nougat', 'produced', 100)],
};
export const DEFI_PRIME = 3000;

export const defiVal = (s: GameState, d: Defi) => Math.floor(s.stats[d.type][d.res] ?? 0);

export function ensureCareer(s: GameState) {
  s.career ??= { palier: 0, defis: [] };
  s.stats.revenue ??= 0;
}

/** Vérifiée chaque heure de jeu : paliers franchis et défis réussis sont récompensés. */
export function checkProgress(sim: Sim) {
  const s = sim.s;
  const c = s.career;
  for (const d of DEFIS[s.region] ?? []) {
    if (c.defis.includes(d.id) || defiVal(s, d) < d.cible) continue;
    c.defis.push(d.id);
    sim.book('general', DEFI_PRIME, `Prime — défi « ${d.nom} »`);
    s.reputation = Math.min(100, s.reputation + 5);
    sim.event(`Défi régional réussi : « ${d.nom} » ! Prime de ${DEFI_PRIME} € et réputation +5.`, 'succes');
  }
  // les paliers commencent après le tutoriel
  if (s.tutorial < 5) return;
  while (c.palier < PALIERS.length) {
    const p = PALIERS[c.palier];
    if (!p.objectifs.every((g) => g.val(sim) >= g.cible)) break;
    c.palier++;
    sim.book('general', p.prime, `Prime — palier « ${p.nom} »`);
    s.reputation = Math.min(100, s.reputation + p.reputation);
    sim.event(c.palier >= PALIERS.length ? `Palier final atteint : « ${p.nom} » ! Prime de ${p.prime} €.` : `Palier atteint : « ${p.nom} » ! Prime de ${p.prime} €. Nouveau palier : « ${PALIERS[c.palier].nom} ».`, 'succes');
  }
}

/** Conseils du jour : ce qui bloque ou ce qui rapporterait le plus maintenant. */
export function conseils(sim: Sim): string[] {
  const s = sim.s;
  const out: string[] = [];
  const kinds = (k: string) => s.buildings.filter((b) => BUILDINGS[b.type]?.kind === k);
  const roles = (r: string) => s.workers.filter((w) => w.role === r).length;
  const cap = sim.storages().reduce((a, b) => a + (BUILDINGS[b.type].capacite ?? 0), 0);
  const used = sim.storages().reduce((a, b) => a + Object.values(b.inv).reduce((x: number, y) => x + (y ?? 0), 0), 0);
  if (cap && used / cap > 0.85) out.push('La grange est presque pleine : vendez au négociant (Commerce) ou construisez un silo ou une chambre froide.');
  if (kinds('boutique').length && !roles('vendeur') && !roles('artisan')) out.push('Personne ne tient la boutique : embauchez un vendeur (Personnel).');
  if (!kinds('boutique').length) out.push('Construisez une boutique : la vente au détail rapporte bien plus que le négociant.');
  if (kinds('enclos').length && !roles('eleveur')) out.push('Vos animaux n\'ont pas d\'éleveur : embauchez-en un pour récolter lait, œufs, miel…');
  if (s.buildings.some((b) => BUILDINGS[b.type]?.kind === 'champ' && b.phase === 'mur') && !roles('cultivateur') && !roles('saisonnier')) out.push('Des récoltes attendent : embauchez un cultivateur ou un saisonnier.');
  for (const b of kinds('atelier')) {
    const r = BUILDINGS[b.type].recettes ?? [];
    if (r.length && r.every((x) => sim.stockOf(x.input) < x.inQty)) {
      out.push(`${BUILDINGS[b.type].nom} : aucune matière première (${r.map((x) => RESOURCES[x.input].nom.toLowerCase()).join(', ')}).`);
      break;
    }
  }
  if (s.money < 1500) out.push('Trésorerie basse : un prêt (Gestion › Banque) ou une vente au négociant évitera le découvert.');
  if (s.satisfaction < 45 && s.stats.visitors > 20) out.push('Visiteurs déçus : baissez les prix, remplissez les rayons ou embauchez un guide.');
  if (!s.insurance?.recoltes && s.buildings.some((b) => ['champ', 'verger'].includes(BUILDINGS[b.type]?.kind ?? ''))) out.push('Vos récoltes ne sont pas assurées contre la grêle et le gel (Gestion › Banque & assurances).');
  if (s.stats.visitors > 50 && !s.campaigns.some((c) => s.minute < c.until) && s.money > 3000) out.push('Une campagne de communication attirerait plus de visiteurs (Commerce › Communication).');
  return out.slice(0, 3);
}
