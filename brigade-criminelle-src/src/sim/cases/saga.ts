// Grande affaire scénarisée « Les ombres de Saint-Clair ».
// Quatre signalements apparemment indépendants partagent des éléments communs (une
// camionnette de déménagement, la vieille ville, des registres du cadastre). Trois sont
// réellement liés par une fraude immobilière ; le quatrième n'est qu'une coïncidence.
import type { Rng } from '../../core/rng';
import { MIN_D, MIN_H } from '../calendar';
import type { Case, GameState, Person } from '../types';
import { CaseBuilder, pickPlace } from './builder';

export const SAGA_ID = 'ombres';
export const SAGA_STEPS = [
  { key: 'A', day: 0, label: 'Registres disparus aux archives' },
  { key: 'D', day: 3, label: 'Cambriolage chez l\'antiquaire' },
  { key: 'B', day: 6, label: 'Disparition de l\'archiviste' },
  { key: 'C', day: 11, label: 'Vente suspecte dans la vieille ville' },
] as const;

const FIXED: Record<string, Omit<Person, 'id' | 'cases' | 'appearance'> & { appearance?: Person['appearance'] }> = {
  valois: { prenom: 'Bertrand', nom: 'Valois', sexe: 'M', age: 52, profession: 'promoteur immobilier', district: 'centre', homePlace: null, sincerity: 0.15, nervosity: 0.15, cooperation: 0.6, memory: 0.9, record: false },
  marchal: { prenom: 'Odile', nom: 'Marchal', sexe: 'F', age: 46, profession: 'agente du service du cadastre', district: 'vieille', homePlace: null, sincerity: 0.35, nervosity: 0.6, cooperation: 0.5, memory: 0.8, record: false },
  delmas: { prenom: 'Henri', nom: 'Delmas', sexe: 'M', age: 63, profession: 'archiviste municipal', district: 'vieille', homePlace: null, sincerity: 0.95, nervosity: 0.8, cooperation: 0.9, memory: 0.95, record: false },
  roussel: { prenom: 'Gilles', nom: 'Roussel', sexe: 'M', age: 58, profession: 'gérant d\'une entreprise de déménagement', district: 'industrie', homePlace: null, sincerity: 0.9, nervosity: 0.3, cooperation: 0.8, memory: 0.7, record: false },
  ferrand: { prenom: 'Mireille', nom: 'Ferrand', sexe: 'F', age: 67, profession: 'antiquaire', district: 'vieille', homePlace: null, sincerity: 0.95, nervosity: 0.4, cooperation: 0.9, memory: 0.8, record: false },
  kevin: { prenom: 'Romain', nom: 'Joly', sexe: 'M', age: 19, profession: 'apprenti carrossier', district: 'residentiel', homePlace: null, sincerity: 0.4, nervosity: 0.9, cooperation: 0.4, memory: 0.7, record: true },
  aubert: { prenom: 'Lucienne', nom: 'Aubert', sexe: 'F', age: 84, profession: 'retraitée, propriétaire d\'un immeuble', district: 'vieille', homePlace: null, sincerity: 0.95, nervosity: 0.5, cooperation: 0.9, memory: 0.55, record: false },
  lemaire: { prenom: 'Arnaud', nom: 'Lemaire', sexe: 'M', age: 49, profession: 'notaire', district: 'centre', homePlace: null, sincerity: 0.9, nervosity: 0.3, cooperation: 0.85, memory: 0.9, record: false },
};

function ensurePeople(st: GameState, rng: Rng) {
  for (const [k, p] of Object.entries(FIXED)) {
    const id = `SAGA-${k}`;
    if (!st.people[id]) {
      st.people[id] = {
        ...p, id, cases: [],
        appearance: { skin: rng.int(0, 4), hair: p.age > 55 ? 6 : rng.int(0, 5), hairStyle: p.sexe === 'F' ? rng.pick([3, 4, 5]) : rng.pick([0, 1, 2]), outfit: rng.int(0, 9), build: rng.int(0, 2), glasses: p.age > 55, beard: false },
      };
    }
  }
}

const sid = (k: string) => `SAGA-${k}`;

export function buildSagaCase(st: GameState, rng: Rng, key: 'A' | 'B' | 'C' | 'D'): Case {
  ensurePeople(st, rng);
  const archives = pickPlace(st, rng, ['archives']);
  const antiquaire = pickPlace(st, rng, ['antiquaire']);
  const immeuble = st.city.places.find((p) => p.district === 'vieille' && p.kind === 'immeuble') ?? archives;
  const van = 'une camionnette blanche des Déménagements Roussel';
  let b: CaseBuilder;
  if (key === 'A') {
    b = new CaseBuilder(st, rng, 'saga-A', 'fraude_doc', archives, st.minute - 14 * MIN_H);
    const delmas = b.person('declarant', { reuse: sid('delmas'), known: true });
    const marchal = b.person('suspect', { reuse: sid('marchal') });
    const roussel = b.person('temoin', { reuse: sid('roussel') });
    const stag = b.person('suspect', { prof: 'stagiaire aux archives', nervosity: 0.85, sincerity: 0.9 });
    const S = b.n(stag);
    b.truth({ culprit: marchal, accomplice: sid('valois'), kind: 'infraction', summary: 'Odile Marchal a retiré des registres les pages de cadastre de la rue des Tanneurs, à la demande de Bertrand Valois, pour faciliter de faux actes de propriété.', timeline: [{ t: -1440 * 3, text: 'Valois et Marchal se rencontrent au Café des Halles.' }, { t: 0, text: 'Pages arrachées dans la réserve des archives.' }] });
    const kD = b.clue({ nature: 'declaration', text: 'Henri Delmas signale que des pages des registres du cadastre de la vieille ville ont été arrachées. Il cite Odile Marchal, venue consulter les registres, et le stagiaire ' + S + '.', action: 'entretien', personId: delmas, difficulty: 2, skill: 'entretien', reliable: true, revealsPerson: marchal });
    b.clue({ nature: 'declaration', text: `Delmas précise qu'il cite aussi ${S}, qui range la réserve.`, action: 'entretien', personId: delmas, requires: [kD], difficulty: 3, skill: 'entretien', reliable: true, revealsPerson: stag });
    const it = b.item('Registre du cadastre mutilé', ['document', 'empreintes']);
    b.clue({ nature: 'fait', text: 'Les pages manquantes concernent toutes la rue des Tanneurs, dans la vieille ville.', action: 'constatations', difficulty: 5, skill: 'observation', reliable: true, revealsItem: it, links: 'C' });
    const kVan = b.clue({ nature: 'declaration', text: `Un riverain a vu ${van} stationnée devant les archives la veille au soir.`, action: 'voisinage', difficulty: 5, skill: 'investigation', reliable: true, revealsPerson: roussel });
    b.clue({ nature: 'declaration', text: 'Gilles Roussel explique que son équipe déménageait un appartement voisin ce soir-là ; il fournit le bon de livraison.', action: 'entretien', personId: roussel, requires: [kVan], difficulty: 3, skill: 'entretien', reliable: true });
    b.clue({ nature: 'analyse', text: 'Les traces papillaires relevées sur la tranche du registre concordent avec celles d\'Odile Marchal.', action: 'labo', itemId: it, labType: 'empreintes', requires: [kD], difficulty: 8, skill: 'scientifique', reliable: true, implicates: [{ pid: marchal, w: 5 }] });
    const kAl = b.clue({ nature: 'declaration', text: 'Odile Marchal affirme ne pas avoir consulté ces registres depuis des mois.', action: 'entretien', personId: marchal, difficulty: 2, skill: 'entretien', reliable: false });
    const kChk = b.clue({ nature: 'document', text: 'Le cahier de consultation porte la signature d\'Odile Marchal le jour de la disparition des pages.', action: 'recherche', requires: [kAl], difficulty: 7, skill: 'investigation', reliable: true, contradicts: [kAl], implicates: [{ pid: marchal, w: 4 }] });
    b.clue({ nature: 'document', text: 'Les relevés bancaires d\'Odile Marchal montrent un virement de la société de Bertrand Valois.', action: 'requisition', personId: marchal, requires: [kChk], difficulty: 7, skill: 'analyse', reliable: true, implicates: [{ pid: marchal, w: 3 }], links: 'C', revealsPerson: undefined });
    b.clue({ nature: 'fait', text: 'Les pages arrachées sont retrouvées chez Odile Marchal, dans une enveloppe au nom de la société Valois.', action: 'perquisition', personId: marchal, requires: [kChk], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: marchal, w: 7 }], links: 'C' });
    b.clue({ nature: 'declaration', text: 'Odile Marchal reconnaît avoir retiré les pages « pour rendre service » à Bertrand Valois.', action: 'audition', personId: marchal, approach: 'element', requires: [kChk], difficulty: 11, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: marchal, w: 3 }], links: 'C' });
    b.clue({ nature: 'declaration', text: `${S} est très nerveu${b.e(stag) ? 'se' : 'x'} : ${b.il(stag)} n'a pas fermé la réserve à clé ce soir-là.`, action: 'entretien', personId: stag, difficulty: 2, skill: 'entretien', reliable: true });
    b.clue({ nature: 'fait', text: `Le badge de ${S} montre qu'${b.il(stag)} a quitté le bâtiment deux heures avant la disparition des pages.`, action: 'recherche', requires: [kD], difficulty: 5, skill: 'investigation', reliable: true, exculpates: [stag] });
    b.c.saga = SAGA_ID;
    return b.finish({ title: 'Les ombres de Saint-Clair — registres mutilés', summary: 'L\'archiviste municipal signale la disparition de pages des registres du cadastre de la vieille ville.', priority: 2, complexity: 3, urgency: 0.4, media: 0.4 });
  }
  if (key === 'D') {
    b = new CaseBuilder(st, rng, 'saga-D', 'cambriolage', antiquaire, st.minute - 9 * MIN_H);
    const fer = b.person('victime', { reuse: sid('ferrand'), known: true });
    const rom = b.person('suspect', { reuse: sid('kevin') });
    const roussel = b.person('temoin', { reuse: sid('roussel') });
    b.truth({ culprit: rom, kind: 'infraction', summary: 'Romain Joly, apprenti du quartier, a volé des objets en vitrine pour les revendre. Ce cambriolage n\'a aucun lien avec la fraude immobilière.', timeline: [{ t: 0, text: 'Vitrine arrière forcée pendant la nuit.' }] });
    b.clue({ nature: 'fait', text: 'La vitre de la réserve a été brisée ; seuls des petits objets de valeur faciles à revendre ont disparu.', action: 'constatations', difficulty: 4, skill: 'observation', reliable: true });
    const it = b.item('Sang séché sur un éclat de verre', ['biologie', 'empreintes']);
    b.clue({ nature: 'fait', text: 'Un éclat de verre porte une trace : l\'auteur s\'est probablement blessé.', action: 'constatations', difficulty: 8, skill: 'observation', reliable: true, revealsItem: it });
    const kVan = b.clue({ nature: 'declaration', text: `Une voisine a vu ${van} dans la rue la veille au soir.`, action: 'voisinage', difficulty: 4, skill: 'investigation', reliable: true, revealsPerson: roussel });
    b.clue({ nature: 'declaration', text: 'Gilles Roussel indique que ses équipes travaillent tous les jours dans la vieille ville ; ses déménageurs avaient quitté la rue à 20 h.', action: 'entretien', personId: roussel, requires: [kVan], difficulty: 3, skill: 'entretien', reliable: true });
    b.clue({ nature: 'document', text: 'Le planning des Déménagements Roussel montre que la camionnette était au dépôt de la zone industrielle à l\'heure du vol : simple coïncidence.', action: 'recherche', requires: [kVan], difficulty: 6, skill: 'investigation', reliable: true });
    const kK = b.clue({ nature: 'declaration', text: 'Un brocanteur signale qu\'un jeune homme, Romain Joly, lui a proposé une boîte à musique ancienne.', action: 'voisinage', difficulty: 7, skill: 'investigation', reliable: true, revealsPerson: rom, implicates: [{ pid: rom, w: 3 }] });
    b.clue({ nature: 'declaration', text: 'Mireille Ferrand reconnaît la boîte à musique décrite par le brocanteur.', action: 'entretien', personId: fer, requires: [kK], difficulty: 3, skill: 'entretien', reliable: true, implicates: [{ pid: rom, w: 2 }] });
    const kAl = b.clue({ nature: 'declaration', text: 'Romain Joly dit avoir trouvé la boîte à musique dans une poubelle.', action: 'entretien', personId: rom, difficulty: 2, skill: 'entretien', reliable: false });
    b.clue({ nature: 'fait', text: 'Romain Joly porte un pansement récent à la main droite.', action: 'entretien', personId: rom, approach: 'ecoute', difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: rom, w: 1 }] });
    b.clue({ nature: 'analyse', text: 'La trace sur l\'éclat de verre correspond au profil de Romain Joly.', action: 'labo', itemId: it, labType: 'biologie', requires: [kK], difficulty: 7, skill: 'scientifique', reliable: true, contradicts: [kAl], implicates: [{ pid: rom, w: 7 }] });
    const kE = b.clue({ nature: 'analyse', text: 'Une empreinte partielle sur la vitrine correspond à Romain Joly.', action: 'labo', itemId: it, labType: 'empreintes', requires: [kK], difficulty: 9, skill: 'scientifique', reliable: true, contradicts: [kAl], implicates: [{ pid: rom, w: 5 }] });
    b.clue({ nature: 'fait', text: 'D\'autres objets de la boutique sont retrouvés chez Romain Joly.', action: 'perquisition', personId: rom, requires: [kK], difficulty: 4, skill: 'observation', reliable: true, implicates: [{ pid: rom, w: 6 }] });
    b.clue({ nature: 'declaration', text: 'Romain Joly reconnaît le cambriolage.', action: 'audition', personId: rom, approach: 'element', requires: [kE], difficulty: 9, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: rom, w: 3 }] });
    b.c.saga = SAGA_ID;
    return b.finish({ title: 'Les ombres de Saint-Clair — l\'antiquaire', summary: 'Mireille Ferrand découvre au matin que la réserve de sa boutique de la vieille ville a été forcée.', priority: 3, complexity: 2, urgency: 0.3, media: 0.25 });
  }
  if (key === 'B') {
    const forest = pickPlace(st, rng, ['maison'], 'foret');
    b = new CaseBuilder(st, rng, 'saga-B', 'disparition', archives, st.minute - 30 * MIN_H);
    const delmas = b.person('disparu', { reuse: sid('delmas'), known: true });
    const sister = b.person('declarant', { prof: 'sœur d\'Henri Delmas', sexe: 'F', age: [58, 70], known: true });
    const marchal = b.person('suspect', { reuse: sid('marchal') });
    const roussel = b.person('temoin', { reuse: sid('roussel') });
    b.truth({ culprit: null, kind: 'volontaire', summary: `Henri Delmas, effrayé après avoir compris la fraude, s'est caché de lui-même à la ${forest.name} avec ses notes.`, timeline: [{ t: 0, text: 'Delmas quitte son domicile avec une sacoche de documents.' }] });
    const kS = b.clue({ nature: 'declaration', text: `La sœur d'Henri Delmas explique qu'il semblait inquiet depuis « l'histoire des registres » et qu'il parlait souvent de la ${forest.name}, où il passait ses étés.`, action: 'entretien', personId: sister, difficulty: 3, skill: 'psychologie', reliable: true, links: 'A' });
    b.clue({ nature: 'fait', text: 'Au domicile, le bureau a été vidé de ses dossiers personnels ; sa voiture et une valise manquent.', action: 'constatations', difficulty: 5, skill: 'observation', reliable: true, noCrime: 3 });
    const kVan = b.clue({ nature: 'declaration', text: `Un voisin a vu ${van} dans la rue la semaine dernière.`, action: 'voisinage', difficulty: 4, skill: 'investigation', reliable: true, revealsPerson: roussel });
    b.clue({ nature: 'declaration', text: 'Gilles Roussel confirme avoir déménagé un voisin de Delmas ; il n\'a jamais rencontré l\'archiviste.', action: 'entretien', personId: roussel, requires: [kVan], difficulty: 3, skill: 'entretien', reliable: true });
    b.clue({ nature: 'declaration', text: 'Odile Marchal affirme ne pas savoir où se trouve Delmas, et paraît réellement surprise.', action: 'entretien', personId: marchal, difficulty: 3, skill: 'psychologie', reliable: true, revealsPerson: marchal });
    const kC = b.clue({ nature: 'document', text: 'Un paiement par carte de Delmas est enregistré à l\'épicerie de Brévannes, près de la forêt, hier.', action: 'requisition', personId: delmas, difficulty: 5, skill: 'analyse', reliable: true, noCrime: 3 });
    b.clue({ nature: 'fait', text: `Henri Delmas est retrouvé sain et sauf à la ${forest.name}. Il remet ses notes sur les faux actes de la rue des Tanneurs.`, action: 'recherche', requires: [kS, kC], difficulty: 6, skill: 'investigation', reliable: true, noCrime: 9, exculpates: [marchal], links: 'C' });
    b.c.saga = SAGA_ID;
    return b.finish({ title: 'Les ombres de Saint-Clair — l\'archiviste', summary: 'La sœur d\'Henri Delmas, archiviste municipal, signale qu\'il ne répond plus depuis plus d\'une journée.', priority: 1, complexity: 3, urgency: 0.9, media: 0.7 });
  }
  // C : escroquerie immobilière (affaire principale)
  b = new CaseBuilder(st, rng, 'saga-C', 'escroquerie', immeuble, st.minute - 20 * MIN_H);
  const aubert = b.person('victime', { reuse: sid('aubert'), known: true });
  const lemaire = b.person('declarant', { reuse: sid('lemaire'), known: true });
  const valois = b.person('suspect', { reuse: sid('valois') });
  const marchal = b.person('suspect', { reuse: sid('marchal') });
  const roussel = b.person('suspect', { reuse: sid('roussel') });
  b.truth({ culprit: valois, accomplice: marchal, kind: 'infraction', summary: 'Bertrand Valois a fabriqué de faux titres de propriété pour s\'approprier des immeubles de la rue des Tanneurs, avec l\'aide d\'Odile Marchal qui a fait disparaître les registres. Les Déménagements Roussel, mandatés pour vider les logements, ignoraient tout.', timeline: [{ t: -1440 * 20, text: 'Valois prépare de faux actes.' }, { t: -1440 * 9, text: 'Les registres disparaissent.' }, { t: 0, text: 'Le notaire Lemaire refuse de signer une vente.' }] });
  const kL = b.clue({ nature: 'declaration', text: 'Le notaire Arnaud Lemaire signale qu\'une société dirigée par Bertrand Valois a présenté un titre de propriété douteux sur l\'immeuble de Mme Aubert.', action: 'entretien', personId: lemaire, difficulty: 2, skill: 'entretien', reliable: true, revealsPerson: valois });
  b.clue({ nature: 'declaration', text: 'Lucienne Aubert affirme n\'avoir jamais vendu son immeuble ; on lui a seulement proposé de « faire vider la cave » par des déménageurs.', action: 'entretien', personId: aubert, difficulty: 4, skill: 'psychologie', reliable: true, revealsPerson: roussel });
  const it = b.item('Titre de propriété présenté au notaire', ['authenticite', 'document']);
  b.clue({ nature: 'fait', text: 'Copie du titre de propriété litigieux remise par l\'étude notariale.', action: 'constatations', difficulty: 3, skill: 'organisation', reliable: true, revealsItem: it });
  b.clue({ nature: 'analyse', text: 'Le titre est un faux : papier et tampons ne correspondent pas à l\'époque indiquée.', action: 'labo', itemId: it, labType: 'authenticite', difficulty: 7, skill: 'scientifique', reliable: true, implicates: [{ pid: valois, w: 3 }] });
  b.clue({ nature: 'document', text: 'Les registres officiels du cadastre, s\'ils étaient complets, permettraient de démontrer le faux : or ce sont précisément les pages disparues des archives.', action: 'recherche', difficulty: 9, skill: 'deduction', reliable: true, implicates: [{ pid: valois, w: 2 }, { pid: marchal, w: 2 }], links: 'A' });
  b.clue({ nature: 'declaration', text: 'Gilles Roussel montre ses bons de commande : sa société a été mandatée par Valois pour vider plusieurs logements de la rue des Tanneurs.', action: 'entretien', personId: roussel, difficulty: 4, skill: 'entretien', reliable: true, implicates: [{ pid: valois, w: 2 }] });
  b.clue({ nature: 'fait', text: 'Roussel ne disposait d\'aucun document de propriété : il exécutait des commandes payées normalement.', action: 'recherche', difficulty: 6, skill: 'analyse', reliable: true, exculpates: [roussel] });
  const kAl = b.clue({ nature: 'declaration', text: 'Bertrand Valois affirme avoir acheté le bien de bonne foi à un intermédiaire.', action: 'entretien', personId: valois, requires: [kL], difficulty: 3, skill: 'entretien', reliable: false });
  const kF = b.clue({ nature: 'document', text: 'Les comptes de la société Valois révèlent des virements vers Odile Marchal et aucun paiement à un quelconque intermédiaire.', action: 'requisition', personId: valois, requires: [kL], difficulty: 8, skill: 'analyse', reliable: true, contradicts: [kAl], implicates: [{ pid: valois, w: 5 }, { pid: marchal, w: 2 }], revealsPerson: marchal });
  b.clue({ nature: 'fait', text: 'Des modèles vierges d\'actes anciens et des tampons fabriqués sont saisis au siège de la société Valois.', action: 'perquisition', personId: valois, requires: [kF], difficulty: 6, skill: 'observation', reliable: true, implicates: [{ pid: valois, w: 8 }] });
  b.clue({ nature: 'declaration', text: 'Bertrand Valois garde le silence, puis reconnaît « des irrégularités » en présence de son avocat.', action: 'audition', personId: valois, approach: 'element', requires: [kF], difficulty: 14, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: valois, w: 2 }] });
  b.clue({ nature: 'declaration', text: 'Les notes d\'Henri Delmas recensent quatre immeubles visés par de faux titres.', action: 'recherche', requires: [kL], difficulty: 10, skill: 'deduction', reliable: true, implicates: [{ pid: valois, w: 3 }], links: 'B' });
  b.c.saga = SAGA_ID;
  return b.finish({ title: 'Les ombres de Saint-Clair — l\'immeuble Aubert', summary: 'Le notaire Lemaire refuse de signer la vente de l\'immeuble de Mme Aubert, rue des Tanneurs, et alerte la police.', priority: 1, complexity: 5, urgency: 0.5, media: 0.8, budget: 4000 });
}

export function sagaDue(st: GameState): (typeof SAGA_STEPS)[number] | null {
  if (st.scenario !== 'saint-clair') return null;
  const step = SAGA_STEPS[st.saga.stepsSpawned];
  if (!step) return null;
  const startDay = 1; // le premier signalement arrive le lendemain matin du début de partie
  return st.minute >= (startDay + step.day) * MIN_D + 9 * 60 ? step : null;
}
