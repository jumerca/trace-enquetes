// Modèles narratifs procéduraux. Chaque modèle fixe d'abord la vérité (auteur éventuel,
// chronologie), puis génère les informations obtenables qui en découlent : constatations,
// témoignages (sincères, imprécis ou mensongers), documents, analyses, fausses pistes et
// éléments disculpants. Les investigations restent abstraites : aucune méthode exploitable.
import type { Rng } from '../../core/rng';
import { calendar, eraOf, MIN_D, MIN_H } from '../calendar';
import type { Case, CaseType, DistrictId, GameState, LabType, PlaceKind } from '../types';
import { CaseBuilder, hm, pickPlace } from './builder';
import { accidentSite, disparitionRandonneur, scripts2, volVoitureDeclare } from './templates2';

export interface Template {
  id: string;
  type: CaseType;
  label: string;
  weight: number; // fréquence relative
  districts: DistrictId[]; // quartiers où l'affaire peut survenir
  minYear?: number;
  build: (st: GameState, rng: Rng, opts?: { district?: DistrictId }) => Case;
}

export interface Suspect { prof: string; link: string; trait: string; motive: string; record?: boolean; age?: [number, number] }

export interface CrimeScript {
  id: string;
  type: CaseType;
  kinds: PlaceKind[];
  hours: [number, number];
  victimProf: (place: string) => string;
  victimRole?: 'victime' | 'declarant';
  title: (place: string) => string;
  summary: (v: string, place: string, when: string) => string;
  suspects: Suspect[];
  constat: string;
  inside: string;
  item: { label: string; labTypes: LabType[]; lab: LabType; result: (c: string) => string };
  witnessProf: string;
  sighting: (trait: string, when: string) => string;
  alibi: (c: string, il: string) => string;
  alibiCheck: (c: string, il: string) => string;
  records?: { text: (c: string) => string; requisition: boolean };
  search: (c: string) => string;
  confess: (c: string, il: string) => string;
  priority: 1 | 2 | 3;
  complexity: number;
  media: number;
  extra?: (b: CaseBuilder, ids: { victim: string; culprit: string; herrings: string[] }) => void;
}

export function crime(s: CrimeScript, st: GameState, rng: Rng, district?: DistrictId): Case {
  const place = pickPlace(st, rng, s.kinds, district);
  const day = st.minute - rng.int(0, 2) * MIN_D;
  const factsAt = day - (day % MIN_D) + rng.int(s.hours[0] * 60, s.hours[1] * 60 - 1);
  const b = new CaseBuilder(st, rng, s.id, s.type, place, Math.min(factsAt, st.minute - 30));
  const when = hm(b.c.factsAt);
  const victim = b.person(s.victimRole ?? 'victime', { prof: s.victimProf(place.name), known: true, age: [28, 78] });
  const pool = [...s.suspects];
  const chosen: Suspect[] = [];
  const nb = Math.min(pool.length, rng.chance(0.4) ? 3 : 2);
  while (chosen.length < nb) chosen.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const ci = rng.int(0, chosen.length - 1);
  const ids = chosen.map((x) => b.person('suspect', { prof: x.prof, record: x.record, age: x.age ?? [20, 64], sincerity: rng.range(0.2, 0.9) }));
  const culprit = ids[ci];
  const herrings = ids.filter((_, i) => i !== ci);
  const C = b.n(culprit);
  const il = b.il(culprit);
  const V = b.n(victim);

  b.truth({
    culprit, kind: 'infraction',
    summary: `${C} (${chosen[ci].prof}) est l'auteur${b.e(culprit) ? 'e' : ''} des faits. Mobile : ${chosen[ci].motive}.`,
    timeline: [
      { t: -120, text: `${C} se rend près de ${place.name}.` },
      { t: 0, text: `Faits commis par ${C} vers ${when}.` },
      { t: 30, text: `${C} quitte les lieux (${chosen[ci].trait}).` },
    ],
  });

  // Constatations
  const kConst = b.clue({ nature: 'fait', text: s.constat, action: 'constatations', difficulty: 4, skill: 'observation', reliable: true, time: 0 });
  const item = b.item(s.item.label, s.item.labTypes);
  b.c.clues.find((k) => k.id === kConst)!.revealsItem = item;
  b.clue({ nature: 'fait', text: s.inside, action: 'constatations', difficulty: 11, skill: 'observation', reliable: true, implicates: [{ pid: culprit, w: 2 }] });
  // Entretien de la victime : elle cite les personnes de son entourage
  const kV = b.clue({
    nature: 'declaration', text: `${V} cite ${chosen.map((x, i) => `${b.n(ids[i])} (${x.link})`).join(', ')}.`, action: 'entretien', personId: victim, difficulty: 2, skill: 'entretien', reliable: true,
  });
  b.c.clues.find((k) => k.id === kV)!.revealsPerson = ids[0];
  ids.slice(1).forEach((pid) => b.clue({ nature: 'declaration', text: `${V} précise ses relations avec ${b.n(pid)}.`, action: 'entretien', personId: victim, difficulty: 3, skill: 'entretien', reliable: true, requires: [kV], revealsPerson: pid }));
  b.clue({ nature: 'declaration', text: `${V} situe les faits entre ${hm(b.c.factsAt - 90)} et ${hm(b.c.factsAt + 60)}.`, action: 'entretien', personId: victim, approach: 'chronologie', difficulty: 5, skill: 'entretien', reliable: true, time: 0 });
  // Témoin trouvé par l'enquête de voisinage
  const witness = b.person('temoin', { prof: s.witnessProf, age: [25, 82] });
  const kW = b.clue({ nature: 'declaration', text: `Une personne du voisinage, ${b.n(witness)}, dit avoir remarqué quelque chose ce jour-là.`, action: 'voisinage', difficulty: 6, skill: 'investigation', reliable: true, revealsPerson: witness, expiresAfterH: 24 * 6 });
  const kSight = b.clue({ nature: 'declaration', text: s.sighting(chosen[ci].trait, hm(b.c.factsAt + 20)), action: 'entretien', personId: witness, requires: [kW], difficulty: 5, skill: 'entretien', reliable: true, implicates: [{ pid: culprit, w: 2 }], time: 20 });
  b.clue({ nature: 'declaration', text: `${b.n(witness)} est sûr${b.e(witness)} de l'heure : ${b.il(witness)} rentrait d'une course habituelle.`, action: 'entretien', personId: witness, approach: 'chronologie', requires: [kSight], difficulty: 9, skill: 'entretien', reliable: true, implicates: [{ pid: culprit, w: 1 }] });
  // Mobile (recherches documentaires / entourage)
  b.clue({ nature: 'document', text: `Recherches : ${C} — ${chosen[ci].motive}.`, action: 'recherche', requires: [kV], difficulty: 8, skill: 'investigation', reliable: true, implicates: [{ pid: culprit, w: 2 }] });
  // Alibi mensonger et vérification
  const kAl = b.clue({ nature: 'declaration', text: s.alibi(C, il), action: 'entretien', personId: culprit, difficulty: 2, skill: 'entretien', reliable: false });
  const kChk = b.clue({ nature: 'fait', text: s.alibiCheck(C, il), action: 'recherche', requires: [kAl], difficulty: 9, skill: 'investigation', reliable: true, contradicts: [kAl], implicates: [{ pid: culprit, w: 4 }], time: -40 });
  // Analyse de l'élément matériel (comparaison possible une fois la personne identifiée)
  b.clue({ nature: 'analyse', text: s.item.result(C), action: 'labo', itemId: item, labType: s.item.lab, requires: [kV], difficulty: 8, skill: 'scientifique', reliable: true, implicates: [{ pid: culprit, w: 6 }] });
  if (s.records) b.clue({ nature: 'document', text: s.records.text(C), action: s.records.requisition ? 'requisition' : 'recherche', personId: culprit, requires: [kV], difficulty: 7, skill: 'analyse', reliable: true, implicates: [{ pid: culprit, w: 4 }] });
  b.clue({ nature: 'fait', text: s.search(C), action: 'perquisition', personId: culprit, requires: [kChk], difficulty: 6, skill: 'observation', reliable: true, implicates: [{ pid: culprit, w: 7 }] });
  b.clue({ nature: 'declaration', text: s.confess(C, il), action: 'audition', personId: culprit, approach: 'element', requires: [kChk], difficulty: 12, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: culprit, w: 3 }] });
  // Fausses pistes : antécédents ou comportement suspect… et éléments disculpants vérifiables
  herrings.forEach((h, i) => {
    const hs = chosen[ids.indexOf(h)];
    const H = b.n(h);
    b.p(h).nervosity = Math.max(b.p(h).nervosity, 0.7);
    b.clue({ nature: 'declaration', text: `${H} se montre nerveu${b.e(h) ? 'se' : 'x'} et évasi${b.e(h) ? 've' : 'f'} sur son emploi du temps.`, action: 'entretien', personId: h, difficulty: 2, skill: 'entretien', reliable: true });
    const kLie = b.clue({ nature: 'declaration', text: `${H} affirme être resté${b.e(h)} chez ${b.il(h) === 'elle' ? 'elle' : 'lui'} au moment des faits.`, action: 'entretien', personId: h, difficulty: 3, skill: 'entretien', reliable: false, implicates: [] });
    if (hs.record || i === 0) b.clue({ nature: 'document', text: `${H} ${hs.record ? 'a des antécédents pour des faits similaires anciens' : `avait eu un différend avec ${V}`} (${hs.motive}).`, action: 'recherche', requires: [kV], difficulty: 5, skill: 'investigation', reliable: true, implicates: [{ pid: h, w: 2 }] });
    b.clue({ nature: 'fait', text: `Vérification : au moment des faits, ${H} se trouvait en réalité ${rng.pick(['à un rendez-vous médical', 'chez un ami qu\'il ne voulait pas mêler à l\'affaire', 'sur son lieu de travail, attesté par le registre', 'au marché, plusieurs commerçants le confirment'])}. ${hs.trait[0].toUpperCase() + hs.trait.slice(1)} ne correspond pas au témoignage.`, action: 'recherche', requires: [kLie], difficulty: 7, skill: 'investigation', reliable: true, contradicts: [kLie], exculpates: [h] });
  });
  s.extra?.(b, { victim, culprit, herrings });
  return b.finish({
    title: s.title(place.name), summary: s.summary(V, place.name, when), priority: s.priority, complexity: s.complexity + (nb === 3 ? 1 : 0), urgency: s.priority === 1 ? 0.7 : 0.35, media: s.media,
  });
}

export const VEHICLES = ['une camionnette blanche avec une échelle sur le toit', 'un scooter rouge', 'une berline grise ancienne', 'une petite voiture bleue cabossée', 'un vélo de course jaune', 'une fourgonnette verte'];
const vt = (rng: Rng) => rng.pick(VEHICLES);

function scripts(rng: Rng, year: number): CrimeScript[] {
  const era = eraOf(year);
  const tv = () => vt(rng);
  return [
    {
      id: 'cambriolage-pavillon', type: 'cambriolage', kinds: ['maison'], hours: [9, 17],
      victimProf: () => rng.pick(['enseignante', 'comptable', 'infirmier', 'retraitée', 'agent immobilier']),
      title: (p) => `Cambriolage — ${p}`,
      summary: (v, p, w) => `${v} signale un cambriolage à son domicile (${p}) en rentrant du travail. Les faits ont eu lieu dans la journée, vers ${w} selon les premières estimations.`,
      suspects: [
        { prof: 'artisan peintre', link: 'a refait les peintures il y a deux mois', trait: tv(), motive: 'difficultés financières importantes et dettes auprès d\'un fournisseur' },
        { prof: 'neveu sans emploi', link: 'connaît la maison et le code du portail', trait: tv(), motive: 'besoin d\'argent pour rembourser un prêt' },
        { prof: 'livreur', link: 'passe chaque semaine dans le quartier', trait: tv(), motive: 'aucun mobile apparent', record: true },
        { prof: 'jardinier', link: 'entretient le jardin le jeudi', trait: tv(), motive: 'conflit sur une facture impayée' },
      ],
      constat: 'Fenêtre arrière forcée avec un outil plat. Aucune trace sur la porte d\'entrée.',
      inside: 'Seuls les bijoux et l\'argent rangés dans la chambre ont disparu ; les autres pièces n\'ont pas été fouillées : l\'auteur semblait connaître les lieux.',
      item: { label: 'Empreinte partielle relevée sur le rebord de fenêtre', labTypes: ['empreintes', 'photo'], lab: 'empreintes', result: (c) => `L'empreinte partielle présente des concordances suffisantes avec celle de ${c}.` },
      witnessProf: 'retraité', sighting: (t, w) => `Le témoin a vu ${t} stationner devant la maison vers ${w}.`,
      alibi: (c) => `${c} affirme avoir passé l'après-midi sur un chantier à Brévannes.`,
      alibiCheck: (c) => `Le client de Brévannes indique que ${c} a quitté le chantier en tout début d'après-midi.`,
      search: (c) => `Des bijoux correspondant à la liste de la victime sont retrouvés au domicile de ${c}.`,
      confess: (c) => `Face aux éléments vérifiés, ${c} reconnaît être entré dans la maison.`,
      priority: 2, complexity: 2, media: 0.2,
    },
    {
      id: 'vol-commerce', type: 'vol', kinds: ['commerce', 'supermarche', 'bijouterie'], hours: [10, 19],
      victimProf: (p) => `gérant${rng.chance(0.5) ? 'e' : ''} (${p})`,
      title: (p) => `Vol de caisse — ${p}`,
      summary: (v, p, w) => `${v}, responsable de ${p}, constate la disparition de la recette du jour, rangée dans le bureau. Dernière vérification : ${w}.`,
      suspects: [
        { prof: 'vendeur', link: 'employé depuis six mois', trait: 'un blouson de cuir marron', motive: 'retards de loyer répétés' },
        { prof: 'vendeuse', link: 'a les clés du bureau', trait: 'un sac à dos orange', motive: 'jeux d\'argent' },
        { prof: 'livreur', link: 'livre le magasin le mardi', trait: 'une casquette verte', motive: 'aucun mobile apparent', record: true },
        { prof: 'ancien employé', link: 'licencié le mois dernier', trait: 'un long manteau gris', motive: 'rancœur après son licenciement' },
      ],
      constat: 'Le coffre du bureau a été ouvert avec sa clé : aucune effraction.',
      inside: 'Le vol a eu lieu pendant les quinze minutes où le bureau reste sans surveillance chaque jour : l\'auteur connaissait cette habitude.',
      item: { label: 'Enveloppe de recette déchirée retrouvée dans la réserve', labTypes: ['empreintes', 'document'], lab: 'empreintes', result: (c) => `Les traces papillaires relevées sur l'enveloppe concordent avec celles de ${c}.` },
      witnessProf: 'cliente habituelle', sighting: (t, w) => `La cliente a vu une personne portant ${t} sortir par la réserve vers ${w}.`,
      alibi: (c, il) => `${c} affirme qu'${il} était en pause à l'extérieur au moment des faits.`,
      alibiCheck: (c) => `Le planning et le badge de la réserve montrent que ${c} y est entré peu avant la disparition.`,
      records: { text: (c) => `Les relevés bancaires de ${c} montrent un dépôt en espèces le lendemain des faits.`, requisition: true },
      search: (c) => `Une partie des billets, encore liés par la bande du magasin, est retrouvée chez ${c}.`,
      confess: (c) => `${c} admet avoir pris l'enveloppe pour couvrir une dette.`,
      priority: 3, complexity: 1, media: 0.1,
    },
    {
      id: 'escroquerie-aines', type: 'escroquerie', kinds: ['maison', 'immeuble'], hours: [10, 17],
      victimProf: () => rng.pick(['retraitée', 'retraité', 'veuve']),
      title: () => 'Escroquerie au faux démarchage',
      summary: (v, p, w) => `${v}, à ${p}, a remis une somme importante à un prétendu conseiller en rénovation énergétique venu vers ${w}. Les travaux n'ont jamais commencé.`,
      suspects: [
        { prof: 'commercial indépendant', link: 'a laissé une carte de visite', trait: 'une voiture de société sans logo', motive: 'société radiée et dettes fiscales' },
        { prof: 'artisan chauffagiste', link: 'a réalisé un devis l\'an dernier', trait: 'une camionnette rouge', motive: 'chiffre d\'affaires en chute' },
        { prof: 'voisin', link: 'a recommandé le « conseiller »', trait: 'un vélo électrique', motive: 'aucun mobile apparent' },
      ],
      constat: 'Le bon de commande remis à la victime comporte un numéro d\'entreprise inexistant.',
      inside: 'Les plaquettes publicitaires laissées chez la victime ont été imprimées localement : l\'auteur opère dans la région.',
      item: { label: 'Bon de commande et carte de visite', labTypes: ['document', 'empreintes'], lab: 'document', result: (c) => `L'écriture manuscrite du bon de commande présente de fortes similitudes avec celle de ${c}.` },
      witnessProf: 'gardienne d\'immeuble', sighting: (t, w) => `La gardienne a remarqué ${t} garée devant l'entrée vers ${w}.`,
      alibi: (c) => `${c} nie être venu dans le quartier ce mois-ci.`,
      alibiCheck: (c) => `Un procès-verbal de stationnement établi le jour des faits concerne le véhicule de ${c}, à deux rues de là.`,
      records: { text: (c) => `Le chèque de la victime a été encaissé sur un compte ouvert par ${c}.`, requisition: true },
      search: (c) => `Des bons de commande vierges identiques et une liste de personnes âgées du quartier sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir encaissé l'argent sans intention de réaliser les travaux.`,
      priority: 2, complexity: 3, media: 0.45,
    },
    {
      id: 'fraude-mairie', type: 'fraude_doc', kinds: ['mairie'], hours: [9, 16],
      victimProf: () => 'directrice des services', title: () => 'Fraude documentaire à l\'état civil',
      summary: (v) => `${v} signale des actes et justificatifs suspects déposés à l'hôtel de ville pour obtenir des aides et des titres.`,
      suspects: [
        { prof: 'agent d\'accueil', link: 'enregistre les dossiers', trait: 'un parapluie noir à manche rouge', motive: 'rémunération occulte versée par un intermédiaire' },
        { prof: 'intermédiaire « écrivain public »', link: 'accompagne de nombreux usagers', trait: 'une sacoche en cuir fauve', motive: 'facture ses services au prix fort' },
        { prof: 'stagiaire', link: 'a accès aux tampons', trait: 'un sweat bleu à capuche', motive: 'aucun mobile apparent' },
      ],
      constat: 'Plusieurs justificatifs de domicile portent la même mise en page et la même erreur typographique.',
      inside: 'Les dossiers frauduleux sont tous passés par le même guichet, le mardi après-midi.',
      item: { label: 'Lot de justificatifs suspects', labTypes: ['authenticite', 'document'], lab: 'authenticite', result: (c) => `Les documents ont été produits avec le même matériel, dont un exemplaire se trouve dans l'entourage professionnel de ${c}.` },
      witnessProf: 'usager', sighting: (t, w) => `Un usager a vu une personne avec ${t} remettre une enveloppe au guichet vers ${w}.`,
      alibi: (c) => `${c} affirme ne jamais traiter ces dossiers lui-même.`,
      alibiCheck: (c) => `Le registre informatique montre que ${c} a validé chacun des dossiers suspects.`,
      records: { text: (c) => `Des virements réguliers d'un même payeur apparaissent sur le compte de ${c}.`, requisition: true },
      search: (c) => `Des modèles de justificatifs vierges et un tampon non réglementaire sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir accepté des sommes pour faciliter certains dossiers.`,
      priority: 2, complexity: 3, media: 0.5,
    },
    {
      id: 'vol-oeuvre', type: 'trafic_art', kinds: ['musee', 'antiquaire', 'eglise'], hours: [10, 18],
      victimProf: (p) => `conservateur (${p})`, title: (p) => `Disparition d'une œuvre — ${p}`,
      summary: (v, p) => `${v} constate qu'un tableau exposé à ${p} a été remplacé par une copie. La substitution est découverte lors d'un inventaire.`,
      suspects: [
        { prof: 'restauratrice d\'art', link: 'a restauré le tableau l\'an dernier', trait: 'une fourgonnette de transport d\'œuvres', motive: 'liens avec un marchand étranger endetté' },
        { prof: 'gardien de salle', link: 'assure les fermetures', trait: 'une moto noire', motive: 'endettement' },
        { prof: 'collectionneur', link: 'avait proposé de racheter l\'œuvre', trait: 'une berline de luxe', motive: 'collectionneur passionné éconduit', record: false },
      ],
      constat: 'La copie est de bonne facture ; le cadre d\'origine a été réutilisé.',
      inside: 'La substitution exigeait un accès prolongé au tableau hors de la présence du public.',
      item: { label: 'Copie du tableau et son châssis', labTypes: ['authenticite', 'comparaison'], lab: 'authenticite', result: (c) => `La toile et les pigments de la copie correspondent au matériel utilisé dans l'atelier de ${c}.` },
      witnessProf: 'agent d\'entretien', sighting: (t, w) => `L'agent d'entretien se souvient de ${t} stationnée dans la cour de service vers ${w}.`,
      alibi: (c) => `${c} affirme ne plus être venu dans le bâtiment depuis plusieurs mois.`,
      alibiCheck: (c) => `Le registre des badges et la main courante montrent un passage de ${c} hors des horaires d'ouverture.`,
      records: { text: (c) => `Des échanges réguliers avec un marchand d'art endetté figurent dans les ${era.digitalLabel} de ${c}.`, requisition: true },
      search: (c) => `L'original, roulé dans un tube de transport, est retrouvé dans un local loué par ${c}.`,
      confess: (c) => `${c} reconnaît avoir réalisé la substitution à la demande d'un acheteur.`,
      priority: 1, complexity: 4, media: 0.75,
    },
    {
      id: 'extorsion-commerce', type: 'extorsion', kinds: ['bar', 'restaurant', 'commerce'], hours: [18, 23],
      victimProf: (p) => `exploitant de ${p}`, title: (p) => `Extorsion — ${p}`,
      summary: (v, p) => `${v}, qui tient ${p}, déclare recevoir des lettres et des visites exigeant de l'argent « pour éviter des ennuis ».`,
      suspects: [
        { prof: 'ancien associé', link: 'a quitté l\'affaire en mauvais termes', trait: 'une voiture de sport blanche', motive: 'estime avoir été lésé lors de la séparation' },
        { prof: 'concurrent', link: 'tient un établissement voisin', trait: 'un utilitaire gris', motive: 'souhaite voir l\'établissement fermer' },
        { prof: 'client régulier', link: 'a été interdit d\'entrée', trait: 'un scooter noir', motive: 'humiliation lors de son exclusion', record: true },
      ],
      constat: 'Les lettres de menace sont rédigées avec un vocabulaire juridique précis et une connaissance des comptes de l\'établissement.',
      inside: 'Les montants exigés correspondent exactement à la trésorerie de l\'établissement : l\'auteur a eu accès aux comptes.',
      item: { label: 'Lettres de menace et enveloppes', labTypes: ['document', 'empreintes', 'biologie'], lab: 'document', result: (c) => `L'analyse des lettres permet de les rattacher à du papier et à une imprimante saisis dans l'environnement de ${c}.` },
      witnessProf: 'serveuse', sighting: (t, w) => `La serveuse a vu ${t} s'arrêter devant l'établissement vers ${w} le soir de la dernière visite.`,
      alibi: (c) => `${c} affirme n'avoir eu aucun contact avec la victime depuis un an.`,
      alibiCheck: (c) => `Des ${era.digitalLabel} attestent de plusieurs appels de ${c} vers l'établissement le mois dernier.`,
      records: { text: (c) => `Le compte bancaire de ${c} révèle des difficultés compatibles avec les sommes réclamées.`, requisition: true },
      search: (c) => `Des brouillons des lettres de menace sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir écrit les lettres « pour récupérer son dû ».`,
      priority: 1, complexity: 3, media: 0.4,
    },
    {
      id: 'abus-biens', type: 'financiere', kinds: ['usine', 'entrepot', 'commerce'], hours: [9, 18],
      victimProf: () => 'président de société', title: (p) => `Détournement de fonds — ${p}`,
      summary: (v, p) => `${v} dépose plainte : un audit révèle la disparition progressive de fonds dans la comptabilité de ${p}.`,
      suspects: [
        { prof: 'comptable', link: 'tient les comptes depuis dix ans', trait: 'une berline neuve', motive: 'train de vie sans rapport avec son salaire' },
        { prof: 'directeur commercial', link: 'signe les notes de frais', trait: 'un coupé gris', motive: 'objectifs non atteints et primes réduites' },
        { prof: 'fournisseur', link: 'facture des prestations de conseil', trait: 'une moto rouge', motive: 'aucun mobile apparent' },
      ],
      constat: 'Les écritures suspectes sont toutes passées en fin de mois, juste avant la clôture.',
      inside: 'Les montants détournés restent toujours sous le seuil qui déclenche un contrôle : l\'auteur connaît les procédures internes.',
      item: { label: 'Classeurs comptables et factures', labTypes: ['document', 'numerique'], lab: 'document', result: (c) => `Les factures fictives ont été établies sur un modèle retrouvé dans les fichiers de ${c}.` },
      witnessProf: 'assistante de direction', sighting: (t) => `L'assistante indique que la personne qui conduit ${t} restait souvent tard le soir des clôtures.`,
      alibi: (c) => `${c} affirme ne pas avoir accès au logiciel de paiement.`,
      alibiCheck: (c) => `Les journaux de connexion montrent que les validations ont été faites avec les codes de ${c}.`,
      records: { text: (c) => `Les fonds ont transité vers un compte dont ${c} est le bénéficiaire.`, requisition: true },
      search: (c) => `Des relevés d'un compte non déclaré sont retrouvés chez ${c}.`,
      confess: (c, il) => `${c} reconnaît des « avances » qu'${il} comptait rembourser.`,
      priority: 2, complexity: 4, media: 0.3,
    },
    {
      id: 'vol-voiture', type: 'vol_vehicule', kinds: ['gare', 'hotel', 'supermarche', 'immeuble'], hours: [20, 24],
      victimProf: () => rng.pick(['infirmière de nuit', 'commercial', 'étudiant', 'cheffe de rang']),
      title: (p) => `Vol de véhicule — ${p}`,
      summary: (v, p) => `${v} signale le vol de son véhicule garé près de ${p} pendant la soirée.`,
      suspects: [
        { prof: 'jeune majeur du quartier', link: 'a déjà emprunté la voiture d\'un ami', trait: 'une casquette rouge', motive: 'voulait se rendre à une fête', record: true },
        { prof: 'garagiste', link: 'a réparé la voiture le mois dernier et conservé un double', trait: 'un bleu de travail', motive: 'revend des pièces détachées' },
        { prof: 'ex-conjoint', link: 'conflit sur le partage des biens', trait: 'une veste kaki', motive: 'conflit sur le partage des biens' },
      ],
      constat: 'Aucun bris de glace : le véhicule a été démarré avec une clé.',
      inside: 'L\'auteur savait où la victime gare habituellement son véhicule et à quelle heure elle s\'absente.',
      item: { label: 'Véhicule retrouvé abandonné en lisière de forêt', labTypes: ['vehicule', 'empreintes'], lab: 'vehicule', result: (c) => `L'expertise du véhicule et des traces relevées au volant oriente vers ${c}.` },
      witnessProf: 'agent de sécurité', sighting: (t, w) => `Le témoin a vu une personne portant ${t} monter dans la voiture vers ${w}.`,
      alibi: (c) => `${c} affirme être resté chez lui toute la soirée.`,
      alibiCheck: (c) => `Un chauffeur de taxi a déposé ${c} près du parking une demi-heure avant le vol.`,
      search: (c) => `Le double de la clé du véhicule volé est retrouvé chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir pris le véhicule.`,
      priority: 3, complexity: 1, media: 0.1,
    },
    {
      id: 'usurpation', type: 'numerique', kinds: ['universite', 'immeuble', 'commerce'], hours: [8, 22],
      victimProf: () => rng.pick(['étudiante', 'professeur', 'commerçant']), title: () => year < 1995 ? 'Usurpation d\'identité par correspondance' : 'Usurpation d\'identité numérique',
      summary: (v) => `${v} découvre que des achats et des messages ont été effectués en son nom (${era.digitalLabel}).`,
      suspects: [
        { prof: 'colocataire', link: 'partage le logement', trait: 'un ordinateur portable autocollé', motive: 'difficultés financières' },
        { prof: 'collègue', link: 'a eu accès à ses documents', trait: 'une tablette rouge', motive: 'jalousie professionnelle' },
        { prof: 'réparateur informatique', link: 'a réparé son matériel', trait: 'une camionnette de dépannage', motive: 'revente de données', record: true },
      ],
      constat: 'Les opérations ont été réalisées avec des informations personnelles que peu de gens connaissent.',
      inside: 'Les opérations frauduleuses ont lieu aux heures où la victime est absente de chez elle.',
      item: { label: 'Copies des opérations et matériel de la victime', labTypes: ['numerique', 'document'], lab: 'numerique', result: (c) => `L'analyse rattache les opérations à un appareil utilisé par ${c}.` },
      witnessProf: 'voisin de palier', sighting: (t) => `Le voisin a vu quelqu'un avec ${t} récupérer des colis adressés à la victime.`,
      alibi: (c) => `${c} affirme ne rien connaître aux démarches en ligne.`,
      alibiCheck: (c) => `Les livraisons ont été retirées au point relais avec la pièce d'identité de ${c}.`,
      records: { text: (c) => `Les ${era.digitalLabel} transmises sur réquisition désignent une ligne au nom de ${c}.`, requisition: true },
      search: (c) => `Les objets commandés au nom de la victime sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir utilisé l'identité de la victime.`,
      priority: 3, complexity: 3, media: 0.15,
    },
    {
      id: 'sabotage-usine', type: 'sabotage', kinds: ['usine', 'entrepot'], hours: [0, 6],
      victimProf: () => 'directeur de site', title: (p) => `Sabotage d'une ligne de production — ${p}`,
      summary: (v, p) => `${v} signale qu'une ligne de production de ${p} a été volontairement mise hors service pendant la nuit, provoquant l'arrêt du site.`,
      suspects: [
        { prof: 'technicien de maintenance', link: 'a reçu un avertissement', trait: 'une moto rouge', motive: 'sanction disciplinaire contestée' },
        { prof: 'chef d\'équipe de nuit', link: 'responsable de la ronde', trait: 'un break bleu', motive: 'conflit avec la direction sur les horaires' },
        { prof: 'prestataire de nettoyage', link: 'intervient la nuit', trait: 'une fourgonnette blanche', motive: 'aucun mobile apparent', record: true },
      ],
      constat: 'Un organe de commande a été démonté et un réglage modifié : l\'acte demandait des connaissances techniques.',
      inside: 'Le dispositif de sécurité a été contourné dans l\'ordre prévu par la procédure de maintenance.',
      item: { label: 'Pièce démontée et outillage abandonné', labTypes: ['comparaison', 'empreintes'], lab: 'comparaison', result: (c) => `L'outillage abandonné appartient à la caisse personnelle de ${c}.` },
      witnessProf: 'gardien', sighting: (t, w) => `Le gardien a vu ${t} quitter le parking du personnel vers ${w}.`,
      alibi: (c) => `${c} affirme avoir quitté le site à la fin de son service.`,
      alibiCheck: (c) => `Le pointage montre que ${c} est revenu sur le site au milieu de la nuit.`,
      search: (c) => `Des notes détaillant la procédure de contournement sont retrouvées chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir mis la ligne à l'arrêt « pour qu'on l'écoute ».`,
      priority: 2, complexity: 3, media: 0.45,
    },
  ];
}

// ————— Modèles spéciaux (vérité sans auteur possible) —————

function disparition(st: GameState, rng: Rng, district?: DistrictId): Case {
  const place = pickPlace(st, rng, ['immeuble', 'maison', 'universite'], district);
  const factsAt = st.minute - rng.int(20, 40) * MIN_H;
  const b = new CaseBuilder(st, rng, 'disparition', 'disparition', place, factsAt);
  const variant = rng.pick(['volontaire', 'volontaire', 'hopital', 'proche'] as const);
  const missing = b.person('disparu', { age: [17, 75], known: true });
  const decl = b.person('declarant', { prof: 'proche', known: true });
  const friend = b.person('temoin', { prof: rng.pick(['collègue', 'ami d\'enfance', 'voisine']) });
  const ex = b.person('suspect', { prof: rng.pick(['ex-conjoint', 'associé', 'frère']), sincerity: 0.4, nervosity: 0.8 });
  const M = b.n(missing), D = b.n(decl), F = b.n(friend), X = b.n(ex);
  const culprit = variant === 'proche' ? ex : null;
  b.truth({
    culprit, kind: variant === 'proche' ? 'infraction' : variant === 'hopital' ? 'accident' : 'volontaire',
    summary: variant === 'volontaire' ? `${M} est parti${b.e(missing)} volontairement s'installer chez un parent éloigné, sans prévenir.` : variant === 'hopital' ? `${M} a fait un malaise et a été hospitalisé${b.e(missing)} sans papiers d'identité.` : `${X} retient ${M} contre son gré dans une maison de campagne, à la suite d'un conflit.`,
    timeline: [{ t: 0, text: `Dernier contact de ${M} avec ses proches.` }, { t: 120, text: variant === 'hopital' ? `${M} est admis${b.e(missing)} aux urgences sans papiers.` : variant === 'volontaire' ? `${M} prend un train en direction du sud.` : `${M} rejoint ${X} pour un rendez-vous.` }],
  });
  const kD = b.clue({ nature: 'declaration', text: `${D} décrit les habitudes de ${M} et cite ${F} et ${X}.`, action: 'entretien', personId: decl, difficulty: 2, skill: 'entretien', reliable: true, revealsPerson: friend });
  const kConf = b.clue({ nature: 'declaration', text: `${D} mentionne un conflit récent entre ${M} et ${X}.`, action: 'entretien', personId: decl, requires: [kD], difficulty: 4, skill: 'psychologie', reliable: true, revealsPerson: ex, implicates: [{ pid: ex, w: 2 }] });
  b.clue({ nature: 'fait', text: 'Au domicile, le chargeur de téléphone, une valise et les papiers d\'identité ont été examinés.', action: 'constatations', difficulty: 4, skill: 'observation', reliable: true });
  const item = b.item('Agenda et courriers personnels', ['document', 'numerique']);
  b.c.clues[b.c.clues.length - 1].revealsItem = item;
  if (variant === 'volontaire') {
    b.clue({ nature: 'fait', text: 'Une valise et des vêtements manquent ; les papiers d\'identité ont été emportés.', action: 'constatations', difficulty: 7, skill: 'observation', reliable: true, noCrime: 3 });
    b.clue({ nature: 'declaration', text: `${F} confie que ${M} parlait depuis des mois de « tout quitter ».`, action: 'entretien', personId: friend, difficulty: 6, skill: 'psychologie', reliable: true, noCrime: 3 });
    b.clue({ nature: 'document', text: `Un billet de train au départ de Saint-Clair a été acheté au nom de ${M} le jour de la disparition.`, action: 'requisition', personId: missing, difficulty: 5, skill: 'analyse', reliable: true, noCrime: 4 });
    const kAg = b.clue({ nature: 'analyse', text: `L'agenda contient l'adresse d'un parent éloigné, soulignée récemment.`, action: 'labo', itemId: item, labType: 'document', difficulty: 6, skill: 'analyse', reliable: true, noCrime: 2 });
    b.clue({ nature: 'fait', text: `Contact établi avec ${M}, en bonne santé chez ce parent, qui ne souhaite pas que son adresse soit communiquée.`, action: 'recherche', requires: [kAg], difficulty: 8, skill: 'investigation', reliable: true, noCrime: 8, exculpates: [ex] });
  } else if (variant === 'hopital') {
    b.clue({ nature: 'fait', text: 'Papiers et téléphone sont restés au domicile : la sortie paraissait brève.', action: 'constatations', difficulty: 6, skill: 'observation', reliable: true });
    b.clue({ nature: 'declaration', text: `${F} indique que ${M} se plaignait de vertiges ces dernières semaines.`, action: 'entretien', personId: friend, difficulty: 5, skill: 'entretien', reliable: true, noCrime: 2 });
    const kH = b.clue({ nature: 'document', text: 'Le centre hospitalier signale l\'admission d\'une personne non identifiée le jour de la disparition.', action: 'recherche', difficulty: 7, skill: 'investigation', reliable: true, noCrime: 3 });
    b.clue({ nature: 'fait', text: `Identification formelle : la personne hospitalisée est bien ${M}. Son état est stable.`, action: 'recherche', requires: [kH], difficulty: 5, skill: 'investigation', reliable: true, noCrime: 9, exculpates: [ex] });
  } else {
    b.clue({ nature: 'fait', text: 'Papiers et téléphone ont disparu, mais aucune valise n\'a été préparée.', action: 'constatations', difficulty: 6, skill: 'observation', reliable: true });
    const kAl = b.clue({ nature: 'declaration', text: `${X} affirme ne pas avoir vu ${M} depuis des semaines.`, action: 'entretien', personId: ex, difficulty: 2, skill: 'entretien', reliable: false });
    const kChk = b.clue({ nature: 'document', text: `Les ${eraOf(calendar(st.startYear, st.minute).year).digitalLabel} montrent un appel de ${M} vers ${X} une heure avant sa disparition.`, action: 'requisition', personId: ex, requires: [kAl], difficulty: 6, skill: 'analyse', reliable: true, contradicts: [kAl], implicates: [{ pid: ex, w: 5 }] });
    b.clue({ nature: 'declaration', text: `${F} a vu ${M} monter dans la voiture de ${X} le soir des faits.`, action: 'entretien', personId: friend, difficulty: 7, skill: 'entretien', reliable: true, implicates: [{ pid: ex, w: 4 }] });
    b.clue({ nature: 'fait', text: `Le contrôle d'une maison de campagne appartenant à ${X} permet de retrouver ${M}, sain${b.e(missing) ? 'e' : ''} et sauf, retenu${b.e(missing)} contre son gré.`, action: 'perquisition', personId: ex, requires: [kChk], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: ex, w: 9 }] });
    b.clue({ nature: 'declaration', text: `${X} reconnaît avoir retenu ${M} « pour régler un différend ».`, action: 'audition', personId: ex, approach: 'element', requires: [kChk], difficulty: 11, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: ex, w: 3 }] });
  }
  if (variant !== 'proche') {
    b.clue({ nature: 'declaration', text: `${X} reste évasi${b.e(ex) ? 've' : 'f'} et visiblement nerveu${b.e(ex) ? 'se' : 'x'} : ${b.il(ex)} craint d'être accusé${b.e(ex)} à cause de leur dispute.`, action: 'entretien', personId: ex, difficulty: 3, skill: 'entretien', reliable: true });
    b.clue({ nature: 'fait', text: `${X} était à son travail au moment de la disparition (planning vérifié).`, action: 'recherche', requires: [kConf], difficulty: 6, skill: 'investigation', reliable: true, exculpates: [ex] });
  }
  return b.finish({ title: `Disparition inquiétante — ${M}`, summary: `${D} signale la disparition de ${M}, ${b.p(missing).age} ans, sans nouvelles depuis plus d'une journée (${place.name}).`, priority: 1, complexity: 3, urgency: 0.9, media: 0.6 });
}

function decesSuspect(st: GameState, rng: Rng, district?: DistrictId): Case {
  const place = pickPlace(st, rng, ['maison', 'immeuble', 'ferme'], district);
  const factsAt = st.minute - rng.int(6, 20) * MIN_H;
  const b = new CaseBuilder(st, rng, 'deces-suspect', 'deces_suspect', place, factsAt);
  const natural = rng.chance(0.55);
  const dead = b.person('victime', { age: [62, 90], prof: 'retraité', known: true });
  const heir = b.person('suspect', { prof: 'neveu et héritier', sincerity: 0.5, nervosity: 0.7, known: true });
  const carer = b.person('suspect', { prof: 'aide à domicile', nervosity: 0.85, sincerity: 0.9 });
  const doc = b.person('temoin', { prof: 'médecin traitant' });
  const H = b.n(heir), A = b.n(carer), V = b.n(dead), Dr = b.n(doc);
  b.truth({
    culprit: natural ? null : heir, kind: natural ? 'naturel' : 'infraction',
    summary: natural ? `${V} est décédé${b.e(dead)} de cause naturelle (pathologie cardiaque connue).` : `${H} a provoqué la mort de ${V} en modifiant son traitement, pour hériter plus tôt.`,
    timeline: [{ t: -600, text: natural ? `${V} se plaint de fatigue.` : `${H} rend visite à ${V}.` }, { t: 0, text: `Décès de ${V}.` }],
  });
  const kD = b.clue({ nature: 'declaration', text: `${H}, qui a découvert le corps, cite ${A}, l'aide à domicile.`, action: 'entretien', personId: heir, difficulty: 2, skill: 'entretien', reliable: true, revealsPerson: carer });
  b.clue({ nature: 'fait', text: 'Aucune trace de lutte ni d\'effraction. Le pilulier de la semaine est entamé.', action: 'constatations', difficulty: 4, skill: 'observation', reliable: true });
  const item = b.item('Pilulier et boîtes de médicaments', ['medical', 'biologie', 'empreintes']);
  b.c.clues[b.c.clues.length - 1].revealsItem = item;
  const kDoc = b.clue({ nature: 'document', text: `Le dossier médical mentionne le médecin traitant, ${Dr}.`, action: 'recherche', difficulty: 3, skill: 'investigation', reliable: true, revealsPerson: doc });
  b.clue({ nature: 'declaration', text: `${A} est très ému${b.e(carer)} et se contredit sur l'heure de son dernier passage.`, action: 'entretien', personId: carer, difficulty: 2, skill: 'entretien', reliable: true });
  const kA = b.clue({ nature: 'declaration', text: `${A} affirme être passé${b.e(carer)} à 18 h comme chaque jour.`, action: 'entretien', personId: carer, approach: 'chronologie', difficulty: 5, skill: 'entretien', reliable: false });
  b.clue({ nature: 'fait', text: `Le planning de l'association montre que ${A} était en réalité chez une autre personne à 18 h et n'est venu${b.e(carer)} qu'à 19 h 30 : ${b.il(carer)} craignait une sanction pour son retard.`, action: 'recherche', requires: [kA], difficulty: 6, skill: 'investigation', reliable: true, contradicts: [kA], exculpates: [carer] });
  b.clue({ nature: 'document', text: `Recherches : ${H} hérite de la maison ; ${b.il(heir)} rencontre des difficultés financières.`, action: 'recherche', requires: [kD], difficulty: 7, skill: 'investigation', reliable: true, implicates: [{ pid: heir, w: 2 }] });
  if (natural) {
    b.clue({ nature: 'declaration', text: `${Dr} indique que ${V} souffrait d'une pathologie cardiaque sévère et qu'un décès soudain était possible.`, action: 'entretien', personId: doc, requires: [kDoc], difficulty: 4, skill: 'entretien', reliable: true, noCrime: 4 });
    b.clue({ nature: 'analyse', text: 'L\'expertise médicale conclut à un décès d\'origine naturelle, compatible avec les antécédents.', action: 'labo', itemId: item, labType: 'medical', difficulty: 5, skill: 'scientifique', reliable: true, noCrime: 8, exculpates: [heir, carer] });
    b.clue({ nature: 'analyse', text: 'Le contenu du pilulier est conforme à la prescription.', action: 'labo', itemId: item, labType: 'biologie', difficulty: 6, skill: 'scientifique', reliable: true, noCrime: 3 });
  } else {
    b.clue({ nature: 'declaration', text: `${Dr} indique que l'état de ${V} était stable et qu'un décès soudain était inattendu.`, action: 'entretien', personId: doc, requires: [kDoc], difficulty: 4, skill: 'entretien', reliable: true });
    b.clue({ nature: 'analyse', text: 'L\'expertise médicale conclut à une intoxication médicamenteuse incompatible avec le traitement prescrit.', action: 'labo', itemId: item, labType: 'medical', difficulty: 6, skill: 'scientifique', reliable: true, implicates: [{ pid: heir, w: 2 }, { pid: carer, w: 1 }] });
    b.clue({ nature: 'analyse', text: `Le pilulier a été manipulé : les seules traces exploitables sur les compartiments modifiés sont celles de ${H}.`, action: 'labo', itemId: item, labType: 'empreintes', requires: [kD], difficulty: 8, skill: 'scientifique', reliable: true, implicates: [{ pid: heir, w: 6 }] });
    const kAl = b.clue({ nature: 'declaration', text: `${H} affirme ne pas être venu${b.e(heir)} chez ${V} la semaine précédant le décès.`, action: 'entretien', personId: heir, difficulty: 3, skill: 'entretien', reliable: false });
    const kChk = b.clue({ nature: 'declaration', text: `Une voisine a vu ${H} entrer chez ${V} la veille du décès.`, action: 'voisinage', requires: [kAl], difficulty: 7, skill: 'investigation', reliable: true, contradicts: [kAl], implicates: [{ pid: heir, w: 4 }] });
    b.clue({ nature: 'fait', text: `Des boîtes du médicament en cause, prescrites à un tiers, sont retrouvées chez ${H}.`, action: 'perquisition', personId: heir, requires: [kChk], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: heir, w: 6 }] });
    b.clue({ nature: 'declaration', text: `${H} reconnaît avoir modifié le pilulier.`, action: 'audition', personId: heir, approach: 'element', requires: [kChk], difficulty: 13, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: heir, w: 3 }] });
  }
  return b.finish({ title: `Décès suspect — ${V}`, summary: `Le médecin appelé constate le décès de ${V}, ${b.p(dead).age} ans, à son domicile (${place.name}) et refuse de délivrer le permis d'inhumer sans examen.`, priority: 1, complexity: 4, urgency: 0.6, media: 0.5 });
}

function fausseDeclaration(st: GameState, rng: Rng, district?: DistrictId): Case {
  const place = pickPlace(st, rng, ['immeuble', 'maison', 'hotel'], district);
  const factsAt = st.minute - rng.int(2, 30) * MIN_H;
  const b = new CaseBuilder(st, rng, 'fausse-declaration', 'fausse_declaration', place, factsAt);
  const obj = rng.pick(['une bague ancienne', 'une montre de collection', 'un ordinateur portable', 'un collier de famille']);
  const lies = rng.chance(0.6);
  const decl = b.person('declarant', { prof: rng.pick(['commerçant', 'cadre', 'agent immobilier']), known: true, sincerity: lies ? 0.2 : 0.9 });
  const guest = b.person('suspect', { prof: rng.pick(['femme de ménage', 'invité', 'artisan']), nervosity: 0.8, sincerity: 0.9 });
  const D = b.n(decl), G = b.n(guest);
  b.truth({
    culprit: lies ? decl : null, kind: lies ? 'fausse_declaration' : 'accident',
    summary: lies ? `${D} a vendu ${obj} et déclare un vol pour percevoir l'indemnité d'assurance.` : `${obj} a été égaré${obj.startsWith('une') ? 'e' : ''} par ${D} lui-même ; aucune infraction.`,
    timeline: [{ t: -2000, text: lies ? `${D} vend ${obj} à un brocanteur.` : `${D} porte ${obj} lors d'une sortie.` }, { t: 0, text: `${D} déclare le vol.` }],
  });
  const kD = b.clue({ nature: 'declaration', text: `${D} déclare le vol de ${obj} et soupçonne ${G}, venu${b.e(guest)} récemment.`, action: 'entretien', personId: decl, difficulty: 2, skill: 'entretien', reliable: lies ? false : true, revealsPerson: guest });
  b.clue({ nature: 'fait', text: 'Aucune trace d\'effraction ni de fouille dans le logement.', action: 'constatations', difficulty: 4, skill: 'observation', reliable: true, implicates: lies ? [{ pid: decl, w: 1 }] : [], noCrime: lies ? 0 : 1 });
  b.clue({ nature: 'declaration', text: `${G} nie fermement et semble très inquiet${b.e(guest)} de perdre son emploi.`, action: 'entretien', personId: guest, difficulty: 2, skill: 'entretien', reliable: true });
  b.clue({ nature: 'fait', text: `${G} n'est pas entré${b.e(guest)} dans la pièce où se trouvait l'objet (témoignage concordant d'un tiers présent).`, action: 'recherche', requires: [kD], difficulty: 6, skill: 'investigation', reliable: true, exculpates: [guest] });
  if (lies) {
    const kReg = b.clue({ nature: 'document', text: `Le registre d'un brocanteur de la vieille ville mentionne l'achat de ${obj} à ${D} trois semaines avant la déclaration.`, action: 'recherche', requires: [kD], difficulty: 9, skill: 'investigation', reliable: true, contradicts: [kD], implicates: [{ pid: decl, w: 6 }] });
    b.clue({ nature: 'document', text: `${D} a augmenté la garantie de son contrat d'assurance un mois avant les faits.`, action: 'requisition', personId: decl, difficulty: 6, skill: 'analyse', reliable: true, implicates: [{ pid: decl, w: 4 }] });
    b.clue({ nature: 'declaration', text: `Confronté${b.e(decl)} au registre du brocanteur, ${D} reconnaît la fausse déclaration.`, action: 'audition', personId: decl, approach: 'element', requires: [kReg], difficulty: 9, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: decl, w: 3 }] });
  } else {
    b.clue({ nature: 'declaration', text: `${D} se souvient finalement avoir porté ${obj} lors d'un dîner au restaurant.`, action: 'entretien', personId: decl, approach: 'chronologie', difficulty: 7, skill: 'entretien', reliable: true, noCrime: 3 });
    b.clue({ nature: 'fait', text: `${obj[0].toUpperCase() + obj.slice(1)} a été déposé${obj.startsWith('une') ? 'e' : ''} aux objets trouvés par le restaurant le soir même.`, action: 'recherche', difficulty: 7, skill: 'investigation', reliable: true, noCrime: 9 });
  }
  return b.finish({ title: `Vol déclaré — ${obj}`, summary: `${D} se présente à l'accueil pour déclarer le vol de ${obj} à son domicile (${place.name}).`, priority: 3, complexity: 2, urgency: 0.2, media: 0.05 });
}

function dossierAncien(st: GameState, rng: Rng): Case {
  const year = calendar(st.startYear, st.minute).year;
  const place = pickPlace(st, rng, ['bijouterie', 'banque', 'commerce']);
  const b = new CaseBuilder(st, rng, 'dossier-ancien', 'ancien', place, st.minute - rng.int(8, 20) * 365 * MIN_D);
  const v = b.person('victime', { prof: 'ancien bijoutier', age: [60, 85], known: true });
  const c = b.person('suspect', { prof: 'ancien employé', age: [45, 70], sincerity: 0.3 });
  const h = b.person('suspect', { prof: 'ancien voisin', age: [45, 75], nervosity: 0.7, record: true, known: true });
  const C = b.n(c), H = b.n(h), V = b.n(v);
  const bio = eraOf(year).lab.biologie.available;
  b.truth({ culprit: c, kind: 'infraction', summary: `${C}, alors employé, a organisé le vol des bijoux de ${V}.`, timeline: [{ t: 0, text: 'Vol nocturne des bijoux.' }] });
  b.clue({ nature: 'document', text: `Le dossier d'archive, classé « auteur inconnu », désignait à l'époque ${H}, faute d'autre piste.`, action: 'recherche', difficulty: 3, skill: 'investigation', reliable: true, implicates: [{ pid: h, w: 2 }] });
  const kR = b.clue({ nature: 'document', text: `Relecture du dossier : un employé, ${C}, n'avait jamais été entendu.`, action: 'recherche', difficulty: 10, skill: 'deduction', reliable: true, revealsPerson: c });
  const item = b.item('Scellés d\'époque (gant et outil)', bio ? ['biologie', 'empreintes'] : ['empreintes', 'comparaison']);
  b.clue({ nature: 'fait', text: 'Les scellés d\'origine sont retrouvés intacts aux archives judiciaires.', action: 'constatations', difficulty: 5, skill: 'organisation', reliable: true, revealsItem: item });
  b.clue({ nature: 'analyse', text: bio ? `L'analyse biologique du gant, impossible à l'époque, désigne ${C}.` : `Une nouvelle comparaison des traces relevées sur l'outil désigne ${C}.`, action: 'labo', itemId: item, labType: bio ? 'biologie' : 'empreintes', requires: [kR], difficulty: 8, skill: 'scientifique', reliable: true, implicates: [{ pid: c, w: 7 }] });
  b.clue({ nature: 'analyse', text: `Les traces relevées ne correspondent pas à ${H}.`, action: 'labo', itemId: item, labType: bio ? 'biologie' : 'empreintes', difficulty: 6, skill: 'scientifique', reliable: true, exculpates: [h] });
  const kAl = b.clue({ nature: 'declaration', text: `${C} affirme avoir été en congé la semaine du vol.`, action: 'entretien', personId: c, difficulty: 3, skill: 'entretien', reliable: false });
  b.clue({ nature: 'document', text: `Les fiches de paie conservées montrent que ${C} travaillait ce jour-là.`, action: 'recherche', requires: [kAl], difficulty: 8, skill: 'analyse', reliable: true, contradicts: [kAl], implicates: [{ pid: c, w: 3 }] });
  b.clue({ nature: 'declaration', text: `${V} se souvient que ${C} avait demandé le code de l'alarme peu avant.`, action: 'entretien', personId: v, requires: [kR], difficulty: 8, skill: 'psychologie', reliable: true, implicates: [{ pid: c, w: 2 }] });
  b.clue({ nature: 'declaration', text: `${C} reconnaît les faits, désormais confronté${b.e(c)} à l'analyse.`, action: 'audition', personId: c, approach: 'element', requires: [kR], difficulty: 12, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: c, w: 3 }] });
  return b.finish({ title: `Dossier ancien — vol chez ${V}`, summary: `Le parquet demande le réexamen d'un vol non élucidé de ${calendar(st.startYear, b.c.factsAt).year} à ${place.name}, à la lumière des techniques actuelles.`, priority: 3, complexity: 4, urgency: 0.1, media: 0.35 });
}

export function templates(year: number): Template[] {
  const rngFor = (rng: Rng) => rng;
  const crimeT = (id: string, label: string, weight: number, districts: DistrictId[], minYear?: number): Template => ({
    id, type: 'vol', label, weight, districts, minYear,
    build: (st, rng, o) => {
      const y = calendar(st.startYear, st.minute).year;
      const s = scripts(rngFor(rng), y).find((x) => x.id === id) ?? scripts2(rngFor(rng), y).find((x) => x.id === id)!;
      return crime(s, st, rng, o?.district);
    },
  });
  void year;
  return [
    { ...crimeT('cambriolage-pavillon', 'Cambriolage', 14, ['pavillons', 'residentiel', 'villages']), type: 'cambriolage' },
    { ...crimeT('vol-commerce', 'Vol en commerce', 10, ['centre', 'commercial', 'residentiel']), type: 'vol' },
    { ...crimeT('escroquerie-aines', 'Escroquerie', 7, ['pavillons', 'residentiel', 'vieille']), type: 'escroquerie' },
    { ...crimeT('fraude-mairie', 'Fraude documentaire', 3, ['centre']), type: 'fraude_doc' },
    { ...crimeT('vol-oeuvre', 'Trafic d\'œuvres d\'art', 2, ['vieille', 'tourisme']), type: 'trafic_art' },
    { ...crimeT('extorsion-commerce', 'Extorsion', 3, ['centre', 'gare', 'commercial', 'campus']), type: 'extorsion' },
    { ...crimeT('abus-biens', 'Affaire financière', 3, ['industrie', 'commercial']), type: 'financiere' },
    { ...crimeT('vol-voiture', 'Vol de véhicule', 10, ['gare', 'residentiel', 'commercial', 'tourisme']), type: 'vol_vehicule' },
    { ...crimeT('usurpation', 'Affaire numérique', 5, ['campus', 'residentiel', 'centre'], 1985), type: 'numerique' },
    { ...crimeT('sabotage-usine', 'Sabotage', 2, ['industrie']), type: 'sabotage' },
    { id: 'disparition', type: 'disparition', label: 'Disparition', weight: 5, districts: ['residentiel', 'campus', 'pavillons', 'villages'], build: (st, rng, o) => disparition(st, rng, o?.district) },
    { id: 'deces-suspect', type: 'deces_suspect', label: 'Décès suspect', weight: 3, districts: ['pavillons', 'villages', 'rural', 'residentiel'], build: (st, rng, o) => decesSuspect(st, rng, o?.district) },
    { id: 'fausse-declaration', type: 'fausse_declaration', label: 'Fausse déclaration', weight: 6, districts: ['residentiel', 'centre', 'pavillons'], build: (st, rng, o) => fausseDeclaration(st, rng, o?.district) },
    { id: 'dossier-ancien', type: 'ancien', label: 'Dossier ancien', weight: 1, districts: ['centre'], build: (st, rng) => dossierAncien(st, rng) },
    // ————— V0.2 : 26 modèles supplémentaires —————
    { ...crimeT('cambriolage-bijouterie', 'Cambriolage nocturne de commerce', 4, ['centre', 'vieille', 'commercial']), type: 'cambriolage' },
    { ...crimeT('cambriolage-appartement', 'Cambriolage d\'appartement', 8, ['residentiel', 'centre', 'campus']), type: 'cambriolage' },
    { ...crimeT('vol-tire', 'Vols à la tire', 6, ['gare', 'commercial', 'centre', 'tourisme']), type: 'vol' },
    { ...crimeT('vol-chantier', 'Vol sur un chantier', 4, ['industrie', 'commercial', 'axes']), type: 'vol' },
    { ...crimeT('vol-ferme', 'Vol dans une exploitation agricole', 3, ['rural', 'villages']), type: 'vol' },
    { ...crimeT('vol-hotel', 'Vols dans un hôtel', 3, ['gare', 'vieille', 'tourisme', 'axes']), type: 'vol' },
    { ...crimeT('escroquerie-placement', 'Escroquerie au faux placement', 3, ['centre', 'pavillons', 'residentiel']), type: 'escroquerie' },
    { ...crimeT('escroquerie-location', 'Fausse location saisonnière', 3, ['tourisme', 'villages', 'pavillons']), type: 'escroquerie' },
    { ...crimeT('escroquerie-garage', 'Fausses factures de garage', 2, ['commercial', 'axes']), type: 'escroquerie' },
    { ...crimeT('fraude-permis', 'Faux certificats de formation', 2, ['centre', 'commercial']), type: 'fraude_doc' },
    { ...crimeT('faux-testament', 'Testament contesté', 2, ['centre', 'vieille']), type: 'fraude_doc' },
    { ...crimeT('objets-eglise', 'Objets d\'église dérobés', 1, ['vieille', 'villages']), type: 'trafic_art' },
    { ...crimeT('faussaire', 'Faux tableaux', 1, ['vieille', 'centre', 'tourisme']), type: 'trafic_art' },
    { ...crimeT('sabotage-fete', 'Sabotage de matériel de spectacle', 1, ['tourisme', 'residentiel', 'vieille']), type: 'sabotage' },
    { ...crimeT('chantage-elu', 'Chantage envers un élu', 1, ['centre']), type: 'extorsion' },
    { ...crimeT('racket-chantier', 'Racket d\'entreprise', 2, ['industrie', 'commercial']), type: 'extorsion' },
    { ...crimeT('detournement-asso', 'Détournement dans une association', 3, ['residentiel', 'pavillons', 'campus']), type: 'financiere' },
    { ...crimeT('fraude-subventions', 'Fraude aux subventions', 2, ['rural', 'industrie']), type: 'financiere' },
    { ...crimeT('vol-utilitaire', 'Vol d\'utilitaire', 6, ['pavillons', 'industrie', 'villages']), type: 'vol_vehicule' },
    { ...crimeT('vol-collection', 'Vol de voiture de collection', 1, ['pavillons', 'villages', 'tourisme']), type: 'vol_vehicule' },
    { ...crimeT('piratage-messagerie', 'Intrusion informatique', 2, ['campus', 'centre', 'commercial'], 1990), type: 'numerique' },
    { ...crimeT('arnaque-annonces', 'Arnaque aux annonces en ligne', 4, ['campus', 'residentiel', 'commercial'], 2000), type: 'numerique' },
    { ...crimeT('homicide-domaine', 'Mort violente', 1, ['villages', 'rural', 'tourisme', 'pavillons']), type: 'homicide' },
    { id: 'disparition-randonneur', type: 'disparition', label: 'Randonneur disparu', weight: 2, districts: ['foret', 'villages'], build: (st, rng) => disparitionRandonneur(st, rng) },
    { id: 'vol-voiture-declare', type: 'fausse_declaration', label: 'Vol de voiture déclaré', weight: 4, districts: ['residentiel', 'pavillons', 'commercial'], build: (st, rng, o) => volVoitureDeclare(st, rng, o?.district) },
    { id: 'accident-site', type: 'sabotage', label: 'Accident grave sur un site', weight: 1, districts: ['industrie'], build: (st, rng) => accidentSite(st, rng) },
  ];
}
