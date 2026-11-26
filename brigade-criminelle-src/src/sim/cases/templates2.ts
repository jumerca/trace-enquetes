// Modèles narratifs supplémentaires (V0.2) : 23 scénarios d'infraction fondés sur le moteur
// générique (auteur, fausses pistes disculpables, alibi réfutable, éléments matériels) et 3
// scénarios spéciaux où l'absence d'infraction est possible. Les investigations restent abstraites.
import type { Rng } from '../../core/rng';
import { calendar, eraOf, MIN_H } from '../calendar';
import type { Case, DistrictId, GameState } from '../types';
import { CaseBuilder, pickPlace } from './builder';
import { VEHICLES, type CrimeScript } from './templates';

export function scripts2(rng: Rng, year: number): CrimeScript[] {
  const era = eraOf(year);
  const tv = () => rng.pick(VEHICLES);
  const dig = era.digitalLabel;
  return [
    {
      id: 'cambriolage-bijouterie', type: 'cambriolage', kinds: ['bijouterie', 'commerce', 'antiquaire'], hours: [1, 5],
      victimProf: (p) => `gérant de ${p}`, title: (p) => `Cambriolage nocturne — ${p}`,
      summary: (v, p, w) => `${v} découvre à l'ouverture que ${p} a été cambriolé pendant la nuit. L'alarme s'est déclenchée vers ${w} sans que personne n'intervienne.`,
      suspects: [
        { prof: 'ancien vigile', link: 'a été remercié le mois dernier', trait: tv(), motive: 'licenciement vécu comme une injustice' },
        { prof: 'installateur d\'alarmes', link: 'a posé le système l\'an dernier', trait: tv(), motive: 'difficultés de trésorerie' },
        { prof: 'voisin de la boutique', link: 'se plaint souvent du bruit de l\'alarme', trait: tv(), motive: 'aucun mobile apparent', record: true },
      ],
      constat: 'Le rideau métallique a été forcé ; la vitrine intérieure est brisée.',
      inside: 'L\'alarme a été neutralisée dans l\'ordre exact où l\'on désactive le système : l\'auteur en connaissait le fonctionnement.',
      item: { label: 'Boîtier d\'alarme démonté', labTypes: ['empreintes', 'comparaison'], lab: 'empreintes', result: (c) => `Les traces relevées sur le boîtier concordent avec celles de ${c}.` },
      witnessProf: 'boulanger', sighting: (t, w) => `Le boulanger, qui commence tôt, a vu ${t} repartir de la rue vers ${w}.`,
      alibi: (c) => `${c} affirme avoir dormi chez lui toute la nuit.`,
      alibiCheck: (c) => `Un relevé de passage à la station-service de la N12 situe ${c} près de la ville en pleine nuit.`,
      records: { text: (c) => `Les ${dig} montrent que ${c} a téléphoné à un receleur connu le lendemain.`, requisition: true },
      search: (c) => `Des bijoux étiquetés au nom de la boutique sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît le cambriolage.`, priority: 2, complexity: 3, media: 0.45,
    },
    {
      id: 'cambriolage-appartement', type: 'cambriolage', kinds: ['immeuble'], hours: [10, 18],
      victimProf: () => rng.pick(['cadre en déplacement', 'retraitée en vacances', 'étudiante']), title: (p) => `Cambriolage d'appartement — ${p}`,
      summary: (v, p) => `${v} rentre de plusieurs jours d'absence et trouve son appartement de ${p} visité.`,
      suspects: [
        { prof: 'gardien d\'immeuble', link: 'détient un double des clés', trait: 'un trousseau de clés à la ceinture', motive: 'dettes de jeu' },
        { prof: 'voisin de palier', link: 'arrosait les plantes', trait: 'un sac de sport rouge', motive: 'récemment au chômage' },
        { prof: 'ancien colocataire', link: 'a gardé une clé', trait: 'une veste en jean', motive: 'litige sur la caution', record: true },
      ],
      constat: 'La porte n\'est pas fracturée : elle a été ouverte avec une clé.',
      inside: 'Seuls les objets cachés dans la penderie ont disparu : l\'auteur savait où chercher.',
      item: { label: 'Poignée et serrure de la porte', labTypes: ['empreintes', 'comparaison'], lab: 'comparaison', result: (c) => `La serrure a été ouverte avec une clé de même découpe que celle de ${c}.` },
      witnessProf: 'voisine du dessus', sighting: (t, w) => `La voisine a croisé dans l'escalier une personne avec ${t} vers ${w}.`,
      alibi: (c) => `${c} assure ne pas être monté dans les étages ce jour-là.`,
      alibiCheck: (c) => `Le registre de l'interphone enregistre le code de ${c} à l'heure des faits.`,
      search: (c) => `Les objets de la victime sont retrouvés dans une cave utilisée par ${c}.`,
      confess: (c) => `${c} admet être entré dans l'appartement avec la clé.`, priority: 3, complexity: 2, media: 0.1,
    },
    {
      id: 'vol-tire', type: 'vol', kinds: ['gare', 'supermarche', 'commerce'], hours: [7, 19],
      victimProf: () => rng.pick(['voyageuse', 'touriste', 'commercial']), title: (p) => `Vols à la tire — ${p}`,
      summary: (v, p) => `${v} signale le vol de son portefeuille à ${p}. Plusieurs plaintes similaires ont été enregistrées cette semaine.`,
      suspects: [
        { prof: 'vendeur ambulant', link: 'travaille sur le parvis', trait: 'un anorak orange', motive: 'revend les cartes volées' },
        { prof: 'jeune homme sans domicile', link: 'est souvent présent sur les lieux', trait: 'un bonnet gris', motive: 'aucun mobile établi', record: true },
        { prof: 'agent de nettoyage', link: 'intervient aux heures d\'affluence', trait: 'un gilet bleu', motive: 'salaire très modeste' },
      ],
      constat: 'Les vols ont tous lieu au même endroit, au moment des arrivées de trains ou des files d\'attente.',
      inside: 'L\'auteur choisit toujours des victimes qui tiennent leur portefeuille dans une poche arrière : il observe longuement.',
      item: { label: 'Portefeuilles vides retrouvés dans une poubelle', labTypes: ['empreintes', 'biologie'], lab: 'empreintes', result: (c) => `Des traces relevées sur deux portefeuilles correspondent à ${c}.` },
      witnessProf: 'contrôleur', sighting: (t, w) => `Un contrôleur a remarqué une personne portant ${t} se coller aux voyageurs vers ${w}.`,
      alibi: (c) => `${c} affirme ne jamais fréquenter cet endroit aux heures de pointe.`,
      alibiCheck: (c) => `Une caméra du hall a filmé ${c} au moment de trois des vols.`,
      records: { text: (c) => `Une carte volée a été utilisée dans un commerce où ${c} est client régulier.`, requisition: true },
      search: (c) => `Plusieurs cartes et pièces d'identité appartenant aux victimes sont retrouvées chez ${c}.`,
      confess: (c) => `${c} reconnaît une série de vols.`, priority: 3, complexity: 2, media: 0.2,
    },
    {
      id: 'vol-chantier', type: 'vol', kinds: ['entrepot', 'garage', 'usine'], hours: [19, 24],
      victimProf: () => 'conducteur de travaux', title: (p) => `Vol de matériel — ${p}`,
      summary: (v, p) => `${v} constate la disparition d'outillage et de câbles de cuivre sur le site de ${p}.`,
      suspects: [
        { prof: 'intérimaire', link: 'a travaillé sur le site la semaine dernière', trait: tv(), motive: 'contrat non renouvelé' },
        { prof: 'ferrailleur', link: 'achète régulièrement des métaux', trait: tv(), motive: 'revend le cuivre', record: true },
        { prof: 'chef d\'équipe', link: 'ferme le site chaque soir', trait: tv(), motive: 'dettes personnelles' },
      ],
      constat: 'Le cadenas du conteneur a été coupé net.',
      inside: 'Seul le matériel de valeur a été pris, rangé pourtant dans un conteneur sans marquage.',
      item: { label: 'Cadenas sectionné', labTypes: ['comparaison', 'empreintes'], lab: 'comparaison', result: (c) => `Les traces de coupe correspondent à une pince saisie dans le véhicule de ${c}.` },
      witnessProf: 'riverain', sighting: (t, w) => `Un riverain a vu ${t} tous feux éteints près du site vers ${w}.`,
      alibi: (c) => `${c} affirme ne pas être revenu sur le site après le travail.`,
      alibiCheck: (c) => `Le registre d'un ferrailleur mentionne une vente de cuivre par ${c} le lendemain matin.`,
      search: (c) => `Des bobines de câble portant le marquage de l'entreprise sont retrouvées chez ${c}.`,
      confess: (c) => `${c} admet avoir pris le matériel.`, priority: 3, complexity: 2, media: 0.1,
    },
    {
      id: 'vol-ferme', type: 'vol', kinds: ['ferme'], hours: [0, 5],
      victimProf: () => 'exploitant agricole', title: (p) => `Vol de carburant et d'outillage — ${p}`,
      summary: (v, p) => `${v} signale que la cuve de gazole et l'atelier de ${p} ont été vidés pendant la nuit.`,
      suspects: [
        { prof: 'ouvrier saisonnier', link: 'a travaillé pour la récolte', trait: tv(), motive: 'conflit sur une paie' },
        { prof: 'voisin agriculteur', link: 'partage le chemin d\'accès', trait: tv(), motive: 'querelle de bornage ancienne' },
        { prof: 'mécanicien agricole', link: 'entretient le tracteur', trait: tv(), motive: 'revente de pièces' },
      ],
      constat: 'Des traces de pneus et une odeur de gazole partent de la cuve vers le chemin.',
      inside: 'Le cadenas de la cuve a été ouvert sans être forcé : l\'auteur connaissait la cachette de la clé.',
      item: { label: 'Bidon abandonné sur le chemin', labTypes: ['empreintes', 'comparaison'], lab: 'empreintes', result: (c) => `Les traces relevées sur le bidon concordent avec celles de ${c}.` },
      witnessProf: 'chasseur', sighting: (t, w) => `Un chasseur a croisé ${t} sur le chemin de la ferme vers ${w}.`,
      alibi: (c) => `${c} dit être resté chez lui à Saint-Aubin.`,
      alibiCheck: (c) => `Un ticket de carte bancaire montre que ${c} a acheté des bidons la veille.`,
      search: (c) => `Des fûts de gazole et l'outillage de la ferme sont retrouvés dans une grange louée par ${c}.`,
      confess: (c) => `${c} reconnaît le vol.`, priority: 3, complexity: 2, media: 0.1,
    },
    {
      id: 'vol-hotel', type: 'vol', kinds: ['hotel', 'camping'], hours: [9, 17],
      victimProf: () => rng.pick(['client de passage', 'touriste étrangère', 'représentant de commerce']), title: (p) => `Vols dans les chambres — ${p}`,
      summary: (v, p) => `${v} constate la disparition d'argent et d'un appareil photo dans sa chambre de ${p}.`,
      suspects: [
        { prof: 'femme de chambre', link: 'nettoie l\'étage', trait: 'un chariot de linge', motive: 'aucun mobile apparent' },
        { prof: 'réceptionniste de nuit', link: 'a accès au tableau des clés', trait: 'un blazer bordeaux', motive: 'dettes importantes' },
        { prof: 'client habitué', link: 'loge à l\'étage', trait: 'une valise métallique', motive: 'déjà soupçonné ailleurs', record: true },
      ],
      constat: 'La porte n\'est pas forcée ; la serrure électronique a été ouverte avec un passe.',
      inside: 'Les vols touchent uniquement des chambres dont les occupants avaient prévenu de leur absence à l\'accueil.',
      item: { label: 'Journal de la serrure électronique', labTypes: ['numerique', 'document'], lab: 'document', result: (c) => `Le journal des ouvertures désigne le passe attribué à ${c}.` },
      witnessProf: 'client voisin', sighting: (t) => `Un client a vu une personne avec ${t} entrer dans la chambre pendant l'absence de la victime.`,
      alibi: (c) => `${c} affirme ne pas avoir travaillé à cet étage ce jour-là.`,
      alibiCheck: (c) => `Le planning du personnel affecte ${c} à cet étage à l'heure des faits.`,
      search: (c) => `L'appareil photo de la victime est retrouvé dans le casier de ${c}.`,
      confess: (c) => `${c} reconnaît avoir pris l'argent et l'appareil.`, priority: 3, complexity: 2, media: 0.15,
    },
    {
      id: 'escroquerie-placement', type: 'escroquerie', kinds: ['notaire', 'banque', 'immeuble'], hours: [9, 18],
      victimProf: () => 'retraité', title: () => 'Escroquerie au faux placement',
      summary: (v) => `${v} a confié ses économies à un « conseiller » promettant des intérêts exceptionnels ; l'argent a disparu.`,
      suspects: [
        { prof: 'conseiller en gestion', link: 'a démarché la victime', trait: 'une berline allemande noire', motive: 'train de vie fastueux et dettes' },
        { prof: 'employé de banque', link: 'gère le compte de la victime', trait: 'un imperméable beige', motive: 'aucun mobile apparent' },
        { prof: 'neveu de la victime', link: 'a recommandé le conseiller', trait: 'une moto verte', motive: 'commission occulte' },
      ],
      constat: 'Les « certificats de placement » remis sont des documents sans valeur, imprimés sur papier ordinaire.',
      inside: 'Les victimes ont toutes été choisies parmi des clients ayant récemment vendu un bien : l\'auteur avait accès à cette information.',
      item: { label: 'Certificats de placement', labTypes: ['authenticite', 'document'], lab: 'authenticite', result: (c) => `Les certificats ont été produits sur l'imprimante saisie au bureau de ${c}.` },
      witnessProf: 'voisine de la victime', sighting: (t) => `La voisine se souvient de ${t} garée devant chez la victime à chaque visite du « conseiller ».`,
      alibi: (c) => `${c} affirme n'avoir jamais rencontré la victime.`,
      alibiCheck: (c) => `L'agenda saisi chez la victime mentionne trois rendez-vous avec ${c}.`,
      records: { text: (c) => `Les fonds ont été virés vers un compte à l'étranger ouvert au nom de ${c}.`, requisition: true },
      search: (c) => `Une liste de retraités et des certificats vierges sont saisis chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir détourné les fonds.`, priority: 2, complexity: 4, media: 0.5,
    },
    {
      id: 'escroquerie-location', type: 'escroquerie', kinds: ['camping', 'hotel', 'maison'], hours: [9, 20],
      victimProf: () => 'vacancière', title: () => 'Fausse location saisonnière',
      summary: (v, p) => `${v} arrive pour une location de vacances réglée d'avance près de ${p} : le logement n'existe pas.`,
      suspects: [
        { prof: 'agent immobilier indépendant', link: 'gère des locations saisonnières', trait: 'un cabriolet bleu', motive: 'faillite de son agence' },
        { prof: 'propriétaire d\'une maison voisine', link: 'dont les photos ont été utilisées', trait: 'un pick-up gris', motive: 'aucun mobile apparent' },
        { prof: 'employé d\'office de tourisme', link: 'oriente les vacanciers', trait: 'une bicyclette hollandaise', motive: 'dettes de jeu', record: true },
      ],
      constat: 'L\'annonce utilise des photos d\'une maison réelle dont le propriétaire n\'a jamais loué.',
      inside: 'L\'annonce cite des détails que seuls les professionnels du tourisme local connaissent.',
      item: { label: 'Contrat de location et courriers', labTypes: ['document', 'numerique'], lab: 'document', result: (c) => `L'écriture et la mise en page du contrat sont identiques à des documents saisis chez ${c}.` },
      witnessProf: 'voisin de la maison', sighting: (t) => `Le voisin a vu quelqu'un avec ${t} photographier la maison au printemps.`,
      alibi: (c) => `${c} nie toute relation avec cette annonce.`,
      alibiCheck: (c) => `La boîte postale indiquée dans l'annonce a été ouverte au nom de ${c}.`,
      records: { text: (c) => `Les acomptes de plusieurs vacanciers ont été encaissés sur un compte de ${c}.`, requisition: true },
      search: (c) => `D'autres annonces identiques sont retrouvées chez ${c}.`,
      confess: (c) => `${c} reconnaît les fausses annonces.`, priority: 3, complexity: 3, media: 0.35,
    },
    {
      id: 'escroquerie-garage', type: 'escroquerie', kinds: ['garage'], hours: [8, 19],
      victimProf: () => 'gestionnaire d\'une compagnie d\'assurance', victimRole: 'declarant', title: (p) => `Fausses factures de réparation — ${p}`,
      summary: (v, p) => `${v} signale des factures de réparation gonflées ou fictives émises par ${p}.`,
      suspects: [
        { prof: 'garagiste', link: 'émet les factures', trait: 'une dépanneuse rouge', motive: 'difficultés financières' },
        { prof: 'expert automobile', link: 'valide les devis', trait: 'une berline grise', motive: 'pots-de-vin' },
        { prof: 'secrétaire du garage', link: 'saisit les factures', trait: 'une petite citadine jaune', motive: 'aucun mobile apparent' },
      ],
      constat: 'Plusieurs véhicules « réparés » n\'ont jamais été déposés au garage selon leurs propriétaires.',
      inside: 'Les montants sont toujours juste sous le seuil qui déclenche une contre-expertise.',
      item: { label: 'Liasse de factures', labTypes: ['document', 'authenticite'], lab: 'document', result: (c) => `Les factures fictives portent la signature manuscrite de ${c}.` },
      witnessProf: 'client du garage', sighting: (t) => `Un client a vu ${t} sur le parking du garage à des heures où il était censé être fermé.`,
      alibi: (c) => `${c} affirme ne pas s'occuper de la facturation.`,
      alibiCheck: (c) => `Les doubles des factures sont annotés de la main de ${c}.`,
      records: { text: (c) => `Les comptes de ${c} reçoivent des sommes correspondant aux surfacturations.`, requisition: true },
      search: (c) => `Un carnet de faux devis est retrouvé chez ${c}.`,
      confess: (c) => `${c} reconnaît les surfacturations.`, priority: 3, complexity: 3, media: 0.15,
    },
    {
      id: 'fraude-permis', type: 'fraude_doc', kinds: ['commerce', 'mairie'], hours: [9, 18],
      victimProf: () => 'agent de préfecture', victimRole: 'declarant', title: () => 'Faux certificats de formation',
      summary: (v) => `${v} signale des dossiers de permis accompagnés de certificats de formation suspects.`,
      suspects: [
        { prof: 'gérant d\'auto-école', link: 'délivre les certificats', trait: 'une voiture à double commande', motive: 'clientèle en baisse' },
        { prof: 'moniteur', link: 'signe les livrets', trait: 'un blouson d\'aviateur', motive: 'rémunération occulte' },
        { prof: 'imprimeur', link: 'fournit les formulaires', trait: 'une camionnette d\'imprimerie', motive: 'aucun mobile apparent', record: true },
      ],
      constat: 'Les certificats portent un numéro d\'agrément valide mais des heures de formation impossibles.',
      inside: 'Les dossiers frauduleux proviennent tous d\'élèves inscrits la même semaine.',
      item: { label: 'Certificats suspects', labTypes: ['authenticite', 'document'], lab: 'authenticite', result: (c) => `Le tampon des certificats est une copie retrouvée dans les affaires de ${c}.` },
      witnessProf: 'élève', sighting: (t) => `Un élève a vu ${t} déposer les dossiers en préfecture.`,
      alibi: (c) => `${c} affirme ne jamais remplir les certificats lui-même.`,
      alibiCheck: (c) => `Les dates des certificats correspondent à des jours de fermeture où seul ${c} détenait les clés.`,
      records: { text: (c) => `Des paiements en espèces d'élèves apparaissent sur le compte de ${c}.`, requisition: true },
      search: (c) => `Un faux tampon et des certificats vierges sont saisis chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir établi les faux certificats.`, priority: 3, complexity: 3, media: 0.3,
    },
    {
      id: 'faux-testament', type: 'fraude_doc', kinds: ['notaire'], hours: [9, 17],
      victimProf: () => 'héritière', title: () => 'Testament contesté',
      summary: (v) => `${v} conteste un testament de dernière minute qui la déshérite au profit d'un tiers.`,
      suspects: [
        { prof: 'aide-soignant du défunt', link: 'principal bénéficiaire du testament', trait: 'une veste polaire verte', motive: 'héritage important' },
        { prof: 'cousin éloigné', link: 'a rendu visite au défunt', trait: 'une moto noire', motive: 'dettes' },
        { prof: 'clerc de notaire', link: 'a enregistré l\'acte', trait: 'une serviette en cuir', motive: 'aucun mobile apparent' },
      ],
      constat: 'L\'écriture du testament est tremblante mais régulière, sans correspondre aux derniers écrits connus du défunt.',
      inside: 'Le testament est daté d\'un jour où le défunt était hospitalisé.',
      item: { label: 'Testament olographe', labTypes: ['document', 'authenticite'], lab: 'document', result: (c) => `L'expertise en écriture attribue le testament à la main de ${c}.` },
      witnessProf: 'infirmière', sighting: (t) => `L'infirmière se souvient d'une visite tardive d'une personne avec ${t}.`,
      alibi: (c) => `${c} affirme que le défunt a rédigé seul son testament.`,
      alibiCheck: (c) => `Le dossier médical atteste que le défunt ne pouvait plus écrire à la date indiquée ; ${c} était présent ce jour-là.`,
      search: (c) => `Des brouillons d'écriture imitant celle du défunt sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir rédigé le testament.`, priority: 2, complexity: 3, media: 0.3,
    },
    {
      id: 'objets-eglise', type: 'trafic_art', kinds: ['eglise', 'antiquaire'], hours: [12, 18],
      victimProf: () => 'conservatrice des antiquités', title: () => 'Objets d\'église dérobés',
      summary: (v) => `${v} signale la disparition de statues et d'orfèvrerie dans plusieurs églises de la région, dont l'une réapparaît en vente.`,
      suspects: [
        { prof: 'brocanteur itinérant', link: 'fréquente les foires', trait: 'un fourgon bâché', motive: 'clients collectionneurs' },
        { prof: 'sacristain', link: 'détient les clés', trait: 'une soutane noire', motive: 'dettes cachées' },
        { prof: 'guide touristique', link: 'fait visiter les églises', trait: 'un parapluie à carreaux', motive: 'aucun mobile apparent' },
      ],
      constat: 'Les objets volés étaient fixés ; ils ont été descellés avec soin.',
      inside: 'Les vols ont eu lieu pendant les heures de visite guidée, quand les églises sont ouvertes.',
      item: { label: 'Statue retrouvée en vente', labTypes: ['authenticite', 'comparaison'], lab: 'comparaison', result: (c) => `Les traces d'outil sur le socle correspondent à l'outillage de ${c}.` },
      witnessProf: 'paroissienne', sighting: (t) => `Une paroissienne a vu ${t} stationné derrière l'église un après-midi de semaine.`,
      alibi: (c) => `${c} prétend avoir acheté la statue à un inconnu.`,
      alibiCheck: (c) => `Le livre de police (registre obligatoire des objets achetés) de ${c} ne mentionne pas cet achat.`,
      records: { text: (c) => `Des échanges avec un acheteur étranger figurent dans les ${dig} de ${c}.`, requisition: true },
      search: (c) => `D'autres objets liturgiques sont retrouvés dans un entrepôt loué par ${c}.`,
      confess: (c) => `${c} reconnaît les vols.`, priority: 2, complexity: 4, media: 0.55,
    },
    {
      id: 'faussaire', type: 'trafic_art', kinds: ['musee', 'antiquaire', 'commerce'], hours: [10, 19],
      victimProf: () => 'collectionneur', title: () => 'Faux tableaux en circulation',
      summary: (v) => `${v} découvre que le tableau de maître qu'il a acheté est un faux ; d'autres acheteurs se manifestent.`,
      suspects: [
        { prof: 'peintre copiste', link: 'expose dans la vieille ville', trait: 'une 2CV couverte de peinture', motive: 'ventes en berne' },
        { prof: 'marchand d\'art', link: 'a vendu le tableau', trait: 'une berline de luxe', motive: 'marges considérables' },
        { prof: 'expert auprès des assurances', link: 'a délivré le certificat', trait: 'un costume trois-pièces', motive: 'aucun mobile apparent' },
      ],
      constat: 'Le certificat d\'authenticité accompagnant le tableau comporte une erreur de date.',
      inside: 'Les faux reproduisent des œuvres dont seules des photographies anciennes circulent : le faussaire a accès à des archives spécialisées.',
      item: { label: 'Tableau litigieux', labTypes: ['authenticite', 'comparaison'], lab: 'authenticite', result: (c) => `Les pigments et la toile correspondent au matériel de l'atelier de ${c}.` },
      witnessProf: 'galeriste voisin', sighting: (t) => `Un galeriste a vu ${t} livrer des toiles emballées la nuit.`,
      alibi: (c) => `${c} dit ignorer tout de l'origine du tableau.`,
      alibiCheck: (c) => `Une photographie de l'œuvre en cours de réalisation est retrouvée dans les archives de ${c}.`,
      records: { text: (c) => `Les ventes ont été réglées sur un compte dont ${c} est titulaire.`, requisition: true },
      search: (c) => `Des toiles vieillies artificiellement et des certificats vierges sont saisis chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir peint et vendu les faux.`, priority: 2, complexity: 4, media: 0.55,
    },
    {
      id: 'sabotage-fete', type: 'sabotage', kinds: ['parc', 'camping', 'musee'], hours: [5, 9],
      victimProf: () => 'organisateur de festival', title: (p) => `Matériel de spectacle saboté — ${p}`,
      summary: (v, p) => `${v} découvre que la sonorisation et l'éclairage installés à ${p} ont été rendus inutilisables la veille de l'ouverture.`,
      suspects: [
        { prof: 'prestataire évincé', link: 'a perdu le contrat cette année', trait: tv(), motive: 'contrat perdu' },
        { prof: 'riverain', link: 'a déposé plusieurs plaintes pour bruit', trait: tv(), motive: 'nuisances sonores' },
        { prof: 'technicien bénévole', link: 'a monté les installations', trait: tv(), motive: 'aucun mobile apparent' },
      ],
      constat: 'Les câbles d\'alimentation ont été sectionnés à des endroits invisibles depuis l\'allée.',
      inside: 'Seuls les éléments impossibles à remplacer avant l\'ouverture ont été visés.',
      item: { label: 'Câbles sectionnés', labTypes: ['comparaison', 'empreintes'], lab: 'comparaison', result: (c) => `Les coupes correspondent à une pince saisie chez ${c}.` },
      witnessProf: 'gardien du site', sighting: (t, w) => `Le gardien a vu ${t} quitter le site vers ${w}.`,
      alibi: (c) => `${c} affirme ne pas s'être approché du site depuis des semaines.`,
      alibiCheck: (c) => `Le badge d'accès du site a été utilisé par ${c} la nuit des faits.`,
      search: (c) => `Le plan d'installation, annoté aux endroits sabotés, est retrouvé chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir abîmé le matériel.`, priority: 2, complexity: 2, media: 0.5,
    },
    {
      id: 'chantage-elu', type: 'extorsion', kinds: ['mairie'], hours: [9, 19],
      victimProf: () => 'adjoint au maire', title: () => 'Lettres de chantage à un élu',
      summary: (v) => `${v} reçoit des lettres exigeant de l'argent contre le silence sur des « révélations » le concernant.`,
      suspects: [
        { prof: 'ancien collaborateur de cabinet', link: 'a été écarté après les élections', trait: 'une voiture électrique blanche', motive: 'rancœur politique' },
        { prof: 'opposant municipal', link: 'mène une campagne contre l\'élu', trait: 'un vélo hollandais', motive: 'adversaire déclaré' },
        { prof: 'journaliste pigiste', link: 'enquête sur la mairie', trait: 'un appareil photo en bandoulière', motive: 'aucun mobile apparent' },
      ],
      constat: 'Les lettres citent des documents internes à la mairie.',
      inside: 'Les documents cités n\'ont circulé que dans l\'ancien cabinet du maire.',
      item: { label: 'Lettres et enveloppes', labTypes: ['document', 'empreintes'], lab: 'document', result: (c) => `Les lettres ont été imprimées sur une imprimante saisie chez ${c}.` },
      witnessProf: 'appariteur', sighting: (t, w) => `L'appariteur a vu une personne avec ${t} déposer une enveloppe vers ${w}.`,
      alibi: (c) => `${c} affirme ne plus avoir aucun document de la mairie.`,
      alibiCheck: (c) => `Le registre des badges montre que ${c} a utilisé un badge non désactivé après son départ.`,
      records: { text: (c) => `Les ${dig} relient ${c} au numéro qui a appelé l'élu.`, requisition: true },
      search: (c) => `Des copies des documents internes sont retrouvées chez ${c}.`,
      confess: (c) => `${c} reconnaît les lettres.`, priority: 1, complexity: 3, media: 0.7,
    },
    {
      id: 'racket-chantier', type: 'extorsion', kinds: ['entrepot', 'usine', 'commerce'], hours: [7, 18],
      victimProf: () => 'chef d\'entreprise du bâtiment', title: (p) => `Racket sur les chantiers — ${p}`,
      summary: (v) => `${v} dénonce des menaces : on exige une « taxe » pour que ses chantiers ne soient plus dégradés.`,
      suspects: [
        { prof: 'concurrent', link: 'perd des marchés au profit de la victime', trait: 'un 4x4 noir', motive: 'élimination d\'un concurrent' },
        { prof: 'ancien associé', link: 'a quitté l\'entreprise', trait: 'une berline grise', motive: 'litige financier' },
        { prof: 'gardien de chantier', link: 'surveille les sites', trait: 'un chien berger', motive: 'aucun mobile apparent', record: true },
      ],
      constat: 'Les dégradations ont visé uniquement les chantiers de la victime.',
      inside: 'Les dates des dégradations suivent le calendrier interne des livraisons de l\'entreprise.',
      item: { label: 'Messages de menace', labTypes: ['document', 'empreintes'], lab: 'document', result: (c) => `Les messages ont été rédigés sur le papier à en-tête raturé de l'entreprise de ${c}.` },
      witnessProf: 'livreur', sighting: (t, w) => `Un livreur a vu ${t} rôder autour du chantier vers ${w}.`,
      alibi: (c) => `${c} affirme ne pas connaître les chantiers de la victime.`,
      alibiCheck: (c) => `Les ${dig} placent ${c} près de deux chantiers dégradés.`,
      records: { text: (c) => `Un versement de la victime a été encaissé par une société liée à ${c}.`, requisition: true },
      search: (c) => `Un planning des chantiers de la victime est retrouvé chez ${c}.`,
      confess: (c) => `${c} reconnaît les menaces.`, priority: 1, complexity: 4, media: 0.5,
    },
    {
      id: 'detournement-asso', type: 'financiere', kinds: ['ecole', 'parc', 'immeuble'], hours: [9, 20],
      victimProf: () => 'président d\'association', title: () => 'Caisse d\'association vidée',
      summary: (v) => `${v} constate que les comptes du club dont il est président sont vides, à la veille d'une échéance.`,
      suspects: [
        { prof: 'trésorier bénévole', link: 'tient les comptes', trait: 'un scooter blanc', motive: 'surendettement' },
        { prof: 'entraîneur salarié', link: 'gère les inscriptions', trait: 'un survêtement aux couleurs du club', motive: 'salaire impayé' },
        { prof: 'fournisseur d\'équipements', link: 'facture le club', trait: 'une camionnette siglée', motive: 'aucun mobile apparent' },
      ],
      constat: 'Les retraits ont été faits en espèces, par petites sommes, sur plusieurs mois.',
      inside: 'Les relevés envoyés au bureau ont été falsifiés pour masquer les retraits.',
      item: { label: 'Relevés bancaires remis au bureau', labTypes: ['document', 'authenticite'], lab: 'document', result: (c) => `Les relevés ont été modifiés à partir d'un modèle retrouvé chez ${c}.` },
      witnessProf: 'parent d\'adhérent', sighting: (t) => `Un parent a vu ${t} au guichet de la banque à chaque début de mois.`,
      alibi: (c) => `${c} affirme ne pas avoir la signature sur le compte.`,
      alibiCheck: (c) => `La banque confirme que ${c} dispose d'une procuration sur le compte.`,
      records: { text: (c) => `Des dépôts réguliers en espèces apparaissent sur le compte personnel de ${c}.`, requisition: true },
      search: (c) => `Les vrais relevés, cachés, sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir puisé dans la caisse.`, priority: 3, complexity: 2, media: 0.25,
    },
    {
      id: 'fraude-subventions', type: 'financiere', kinds: ['ferme', 'usine', 'mairie'], hours: [9, 17],
      victimProf: () => 'contrôleur d\'un organisme public', victimRole: 'declarant', title: () => 'Subventions indûment perçues',
      summary: (v) => `${v} signale des aides publiques versées pour des investissements jamais réalisés.`,
      suspects: [
        { prof: 'chef d\'entreprise', link: 'bénéficiaire des aides', trait: 'une berline neuve', motive: 'difficultés financières' },
        { prof: 'consultant en montage de dossiers', link: 'a constitué les demandes', trait: 'une valise à roulettes', motive: 'commission proportionnelle' },
        { prof: 'fournisseur de matériel', link: 'a émis les devis', trait: 'un utilitaire rouge', motive: 'aucun mobile apparent' },
      ],
      constat: 'Le matériel déclaré acheté n\'est pas présent sur le site.',
      inside: 'Les devis joints aux demandes sont au nom de fournisseurs radiés depuis plusieurs années.',
      item: { label: 'Dossiers de demande d\'aide', labTypes: ['document', 'authenticite'], lab: 'authenticite', result: (c) => `Les factures jointes ont été fabriquées sur l'ordinateur de ${c}.` },
      witnessProf: 'ancien salarié', sighting: (t) => `Un ancien salarié se souvient de ${t} lors des visites des contrôleurs, avec du matériel loué pour l'occasion.`,
      alibi: (c) => `${c} affirme que le matériel est en réparation.`,
      alibiCheck: (c) => `Aucun réparateur de la région n'a reçu ce matériel ; une location ponctuelle au nom de ${c} est retrouvée.`,
      records: { text: (c) => `Les aides ont transité vers un compte personnel de ${c}.`, requisition: true },
      search: (c) => `Des en-têtes de fournisseurs radiés sont retrouvés dans les fichiers de ${c}.`,
      confess: (c) => `${c} reconnaît les fausses déclarations.`, priority: 2, complexity: 4, media: 0.35,
    },
    {
      id: 'vol-utilitaire', type: 'vol_vehicule', kinds: ['garage', 'entrepot', 'maison'], hours: [0, 6],
      victimProf: () => 'artisan plombier', title: (p) => `Vol d'utilitaire — ${p}`,
      summary: (v, p) => `${v} constate le vol de sa camionnette chargée d'outillage, garée près de ${p}.`,
      suspects: [
        { prof: 'apprenti', link: 'connaît la cachette du double des clés', trait: 'une casquette noire', motive: 'besoin d\'argent', age: [18, 24] },
        { prof: 'concurrent', link: 'a perdu un chantier', trait: 'un bleu de travail', motive: 'jalousie professionnelle' },
        { prof: 'revendeur de pièces', link: 'achète des véhicules accidentés', trait: 'un blouson de cuir', motive: 'trafic de pièces', record: true },
      ],
      constat: 'Aucun bris de glace ; le véhicule a été démarré avec une clé.',
      inside: 'Le voleur a d\'abord vidé le coffre-fort à clés dissimulé dans le garage.',
      item: { label: 'Camionnette retrouvée désossée', labTypes: ['vehicule', 'empreintes'], lab: 'vehicule', result: (c) => `L'expertise du véhicule relève des traces correspondant à ${c}.` },
      witnessProf: 'livreur de journaux', sighting: (t, w) => `Le livreur de journaux a vu une personne avec ${t} démarrer la camionnette vers ${w}.`,
      alibi: (c) => `${c} affirme avoir passé la nuit chez des amis.`,
      alibiCheck: (c) => `Les amis cités indiquent que ${c} est parti avant minuit.`,
      search: (c) => `L'outillage de l'artisan est retrouvé chez ${c}.`,
      confess: (c) => `${c} reconnaît avoir pris la camionnette.`, priority: 3, complexity: 1, media: 0.05,
    },
    {
      id: 'vol-collection', type: 'vol_vehicule', kinds: ['garage', 'musee', 'maison'], hours: [1, 5],
      victimProf: () => 'collectionneur d\'automobiles', title: () => 'Voiture de collection volée',
      summary: (v) => `${v} signale le vol d'une voiture de collection de grande valeur dans son garage fermé.`,
      suspects: [
        { prof: 'restaurateur de véhicules anciens', link: 'a restauré la voiture', trait: 'un porte-voitures', motive: 'commande d\'un acheteur étranger' },
        { prof: 'chauffeur du collectionneur', link: 'a les clés', trait: 'une casquette de chauffeur', motive: 'salaire impayé' },
        { prof: 'membre du club automobile', link: 'convoitait la voiture', trait: 'un coupé rouge', motive: 'offre de rachat refusée' },
      ],
      constat: 'Le garage a été ouvert avec la télécommande d\'origine.',
      inside: 'La voiture, qui ne démarre qu\'avec une procédure particulière, a été emmenée sans difficulté.',
      item: { label: 'Télécommande et boîtier de garage', labTypes: ['empreintes', 'numerique'], lab: 'empreintes', result: (c) => `Les traces sur le boîtier correspondent à ${c}.` },
      witnessProf: 'voisin insomniaque', sighting: (t, w) => `Un voisin a vu ${t} manœuvrer devant le garage vers ${w}.`,
      alibi: (c) => `${c} affirme être resté à son atelier.`,
      alibiCheck: (c) => `Un péage de l'autoroute enregistre le passage d'un véhicule de ${c} au milieu de la nuit.`,
      records: { text: (c) => `Les ${dig} montrent des échanges entre ${c} et un acheteur la veille.`, requisition: true },
      search: (c) => `La voiture, maquillée, est retrouvée dans un hangar loué par ${c}.`,
      confess: (c) => `${c} reconnaît le vol.`, priority: 2, complexity: 3, media: 0.45,
    },
    {
      id: 'piratage-messagerie', type: 'numerique', kinds: ['universite', 'commerce', 'immeuble'], hours: [8, 23],
      victimProf: () => rng.pick(['cheffe d\'entreprise', 'chercheur', 'avocate']), title: () => year < 2005 ? 'Intrusion dans un ordinateur' : 'Piratage d\'une messagerie',
      summary: (v) => `${v} constate que des courriers confidentiels ont été consultés et transmis à son insu.`,
      suspects: [
        { prof: 'ancien informaticien de l\'entreprise', link: 'a configuré le système', trait: 'un sac à dos noir', motive: 'licenciement' },
        { prof: 'associé', link: 'en conflit avec la victime', trait: 'une montre connectée', motive: 'rachat de parts' },
        { prof: 'stagiaire', link: 'a eu accès au bureau', trait: 'un sweat à capuche', motive: 'aucun mobile apparent' },
      ],
      constat: 'Les connexions illégitimes utilisent un ancien mot de passe administrateur.',
      inside: 'Les documents consultés sont précisément ceux qui concernent un projet de rachat.',
      item: { label: 'Ordinateur et journaux de connexion', labTypes: ['numerique', 'document'], lab: 'numerique', result: (c) => `Les connexions proviennent d'un appareil utilisé par ${c}.` },
      witnessProf: 'collègue', sighting: (t) => `Un collègue a vu quelqu'un avec ${t} brancher un appareil sur l'ordinateur de la victime.`,
      alibi: (c) => `${c} affirme ne plus avoir aucun accès au système.`,
      alibiCheck: (c) => `Le compte administrateur de ${c} n'a jamais été désactivé et a servi la nuit des faits.`,
      records: { text: (c) => `Les ${dig} de l'opérateur rattachent les connexions à la ligne de ${c}.`, requisition: true },
      search: (c) => `Des copies des courriers de la victime sont retrouvées chez ${c}.`,
      confess: (c) => `${c} reconnaît les intrusions.`, priority: 2, complexity: 3, media: 0.3,
    },
    {
      id: 'arnaque-annonces', type: 'numerique', kinds: ['immeuble', 'universite', 'commerce'], hours: [8, 23],
      victimProf: () => 'étudiant', title: () => 'Arnaques aux petites annonces en ligne',
      summary: (v) => `${v} a payé un téléphone vendu sur un site d'annonces, jamais reçu. Une dizaine de victimes sont recensées.`,
      suspects: [
        { prof: 'jeune revendeur', link: 'publie beaucoup d\'annonces', trait: 'une trottinette électrique', motive: 'gains faciles', age: [18, 26] },
        { prof: 'gérant d\'une boutique de téléphonie', link: 'dont les photos sont réutilisées', trait: 'une voiture de société', motive: 'aucun mobile apparent' },
        { prof: 'livreur', link: 'a remis des colis vides', trait: 'un scooter de livraison', motive: 'complicité supposée' },
      ],
      constat: 'Les annonces utilisent des photos reprises sur le site d\'une boutique du quartier commercial.',
      inside: 'Les annonces sont publiées aux heures où un même point d\'accès public est utilisé.',
      item: { label: 'Captures des annonces et échanges', labTypes: ['numerique', 'document'], lab: 'numerique', result: (c) => `L'analyse rattache les annonces à un appareil utilisé par ${c}.` },
      witnessProf: 'gérant de cybercafé', sighting: (t) => `Le gérant du point d'accès se souvient d'un habitué avec ${t}.`,
      alibi: (c) => `${c} affirme n'avoir jamais rien vendu en ligne.`,
      alibiCheck: (c) => `Le compte de paiement qui a reçu les fonds a été ouvert avec la pièce d'identité de ${c}.`,
      records: { text: (c) => `Les ${dig} transmises par la plateforme désignent ${c}.`, requisition: true },
      search: (c) => `Plusieurs téléphones prépayés et une liste de victimes sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît les fausses annonces.`, priority: 3, complexity: 2, media: 0.2,
    },
    {
      id: 'homicide-domaine', type: 'homicide', kinds: ['maison', 'ferme', 'hotel'], hours: [20, 24],
      victimProf: () => rng.pick(['propriétaire du domaine', 'hôtelier', 'négociant en vins']), victimRole: 'declarant',
      title: (p) => `Mort violente — ${p}`,
      summary: (v, p) => `${v} donne l'alerte : un proche de la maison a été retrouvé sans vie au matin à ${p}. Le médecin constate un décès suspect.`,
      suspects: [
        { prof: 'associé de la victime', link: 'en conflit sur la vente du domaine', trait: 'une berline anglaise verte', motive: 'conflit sur une vente de plusieurs millions' },
        { prof: 'régisseur', link: 'vit sur place', trait: 'une lampe torche rouge', motive: 'menacé de renvoi' },
        { prof: 'invité de la soirée', link: 'a dîné sur place la veille', trait: 'un manteau camel', motive: 'aucun mobile apparent' },
      ],
      constat: 'La pièce est en ordre ; une seule chaise est renversée près de la porte-fenêtre.',
      inside: 'La porte-fenêtre a été refermée de l\'extérieur avec la clé habituellement cachée sous un pot : l\'auteur connaissait les lieux.',
      item: { label: 'Expertise médico-légale et vêtements de la victime', labTypes: ['medical', 'biologie'], lab: 'medical', result: (c) => `L'expertise médicale situe le décès vers minuit, à un moment où seul ${c} n'a pas d'alibi vérifié.` },
      witnessProf: 'gardien d\'un domaine voisin', sighting: (t, w) => `Le gardien voisin a vu ${t} quitter le domaine vers ${w}.`,
      alibi: (c) => `${c} affirme avoir quitté les lieux bien avant minuit.`,
      alibiCheck: (c) => `Un témoin et un ticket de péage établissent que ${c} est revenu sur place peu avant minuit.`,
      records: { text: (c) => `Les ${dig} montrent un échange tendu entre ${c} et la victime en soirée.`, requisition: true },
      search: (c) => `Des vêtements portant des traces compatibles avec la scène sont retrouvés chez ${c}.`,
      confess: (c) => `${c} reconnaît une dispute qui a mal tourné.`, priority: 1, complexity: 5, media: 0.85,
    },
  ];
}

// ————— Modèles spéciaux supplémentaires —————

/** Randonneur disparu en forêt : accident, départ volontaire ou séquestration. */
export function disparitionRandonneur(st: GameState, rng: Rng): Case {
  const place = pickPlace(st, rng, ['maison', 'parc'], 'foret');
  const b = new CaseBuilder(st, rng, 'disparition-randonneur', 'disparition', place, st.minute - rng.int(10, 30) * MIN_H);
  const variant = rng.pick(['accident', 'accident', 'volontaire', 'proche'] as const);
  const m = b.person('disparu', { age: [25, 70], known: true });
  const d = b.person('declarant', { prof: 'conjoint', known: true });
  const g = b.person('temoin', { prof: 'garde forestier' });
  const x = b.person('suspect', { prof: rng.pick(['compagnon de randonnée', 'beau-frère']), sincerity: 0.4, nervosity: 0.8 });
  const M = b.n(m), X = b.n(x), G = b.n(g);
  b.truth({
    culprit: variant === 'proche' ? x : null, kind: variant === 'accident' ? 'accident' : variant === 'volontaire' ? 'volontaire' : 'infraction',
    summary: variant === 'accident' ? `${M} a fait une chute en forêt et attend les secours dans un ravin, blessé${b.e(m)}.` : variant === 'volontaire' ? `${M} a quitté la région volontairement en laissant sa voiture au parking de la forêt.` : `${X} retient ${M} dans un chalet isolé après une dispute d'argent.`,
    timeline: [{ t: 0, text: `${M} part randonner seul${b.e(m)}.` }],
  });
  const kD = b.clue({ nature: 'declaration', text: `Le conjoint indique l'itinéraire habituel de ${M} et cite ${X}, qui devait l'accompagner.`, action: 'entretien', personId: d, difficulty: 2, skill: 'entretien', reliable: true, revealsPerson: x });
  const kCar = b.clue({ nature: 'fait', text: `La voiture de ${M} est retrouvée au parking de l'étang des Moines.`, action: 'constatations', difficulty: 3, skill: 'observation', reliable: true, revealsPerson: g });
  const it = b.item('Contenu de la voiture (carte annotée, effets personnels)', ['document', 'empreintes']);
  b.c.clues.find((k) => k.id === kCar)!.revealsItem = it;
  if (variant === 'accident') {
    b.clue({ nature: 'declaration', text: `${G} signale un passage dangereux, éboulé récemment, sur l'itinéraire annoncé.`, action: 'entretien', personId: g, difficulty: 4, skill: 'entretien', reliable: true, noCrime: 3 });
    const kMap = b.clue({ nature: 'analyse', text: 'La carte annotée trace un détour par le ravin du Loup.', action: 'labo', itemId: it, labType: 'document', difficulty: 5, skill: 'analyse', reliable: true, noCrime: 2 });
    b.clue({ nature: 'fait', text: `Les recherches dans le ravin permettent de retrouver ${M}, blessé${b.e(m)} mais vivant${b.e(m)}, après une chute.`, action: 'voisinage', requires: [kMap], difficulty: 6, skill: 'investigation', reliable: true, noCrime: 9, exculpates: [x] });
    b.clue({ nature: 'fait', text: `${X} était à son travail toute la journée (planning vérifié).`, action: 'recherche', requires: [kD], difficulty: 5, skill: 'investigation', reliable: true, exculpates: [x] });
  } else if (variant === 'volontaire') {
    b.clue({ nature: 'fait', text: 'Le sac de randonnée est resté dans le coffre ; un sac de voyage manque à la maison.', action: 'constatations', difficulty: 7, skill: 'observation', reliable: true, noCrime: 3 });
    const kT = b.clue({ nature: 'document', text: `Un billet de car pour le sud a été acheté au nom de ${M}.`, action: 'requisition', personId: m, difficulty: 5, skill: 'analyse', reliable: true, noCrime: 4 });
    b.clue({ nature: 'fait', text: `${M} est joint${b.e(m)} par téléphone chez un ami ; ${b.il(m)} est parti${b.e(m)} de son plein gré.`, action: 'recherche', requires: [kT], difficulty: 6, skill: 'investigation', reliable: true, noCrime: 9, exculpates: [x] });
    b.clue({ nature: 'fait', text: `${X} était à son travail toute la journée (planning vérifié).`, action: 'recherche', requires: [kD], difficulty: 5, skill: 'investigation', reliable: true, exculpates: [x] });
  } else {
    const kAl = b.clue({ nature: 'declaration', text: `${X} affirme avoir renoncé à la randonnée et n'avoir pas vu ${M}.`, action: 'entretien', personId: x, difficulty: 2, skill: 'entretien', reliable: false });
    const kChk = b.clue({ nature: 'declaration', text: `${G} a vu ${M} et ${X} ensemble sur le sentier dans la matinée.`, action: 'entretien', personId: g, requires: [kAl], difficulty: 5, skill: 'entretien', reliable: true, contradicts: [kAl], implicates: [{ pid: x, w: 5 }] });
    b.clue({ nature: 'document', text: `${X} avait prêté une grosse somme à ${M}, qui tardait à rembourser.`, action: 'recherche', requires: [kD], difficulty: 7, skill: 'investigation', reliable: true, implicates: [{ pid: x, w: 2 }] });
    b.clue({ nature: 'analyse', text: `Les traces sur la portière de la voiture de ${M} correspondent à ${X}.`, action: 'labo', itemId: it, labType: 'empreintes', requires: [kD], difficulty: 7, skill: 'scientifique', reliable: true, implicates: [{ pid: x, w: 4 }] });
    b.clue({ nature: 'fait', text: `${M} est retrouvé${b.e(m)} sain${b.e(m) ? 'e' : ''} et sauf dans un chalet appartenant à ${X}.`, action: 'perquisition', personId: x, requires: [kChk], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: x, w: 9 }] });
    b.clue({ nature: 'declaration', text: `${X} reconnaît avoir retenu ${M} « pour récupérer son argent ».`, action: 'audition', personId: x, approach: 'element', requires: [kChk], difficulty: 10, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: x, w: 3 }] });
  }
  if (variant !== 'proche') b.clue({ nature: 'declaration', text: `${X} paraît mal à l'aise : ${b.il(x)} s'en veut de ne pas avoir accompagné ${M}.`, action: 'entretien', personId: x, difficulty: 2, skill: 'psychologie', reliable: true });
  return b.finish({ title: `Randonneur disparu — ${M}`, summary: `Le conjoint de ${M} signale qu'${b.il(m)} n'est pas rentré${b.e(m)} d'une randonnée en forêt domaniale.`, priority: 1, complexity: 3, urgency: 0.95, media: 0.6 });
}

/** Vol de voiture déclaré : vrai vol ou fraude à l'assurance du propriétaire. */
export function volVoitureDeclare(st: GameState, rng: Rng, district?: DistrictId): Case {
  const place = pickPlace(st, rng, ['immeuble', 'maison', 'supermarche'], district);
  const b = new CaseBuilder(st, rng, 'vol-voiture-declare', 'fausse_declaration', place, st.minute - rng.int(2, 20) * MIN_H);
  const fraud = rng.chance(0.5);
  const o = b.person('declarant', { prof: rng.pick(['commerçant', 'agent commercial', 'chauffeur VTC']), known: true, sincerity: fraud ? 0.2 : 0.9 });
  const t = b.person('suspect', { prof: rng.pick(['jeune du quartier', 'mécanicien']), record: true, nervosity: 0.8 });
  const O = b.n(o), T = b.n(t);
  b.truth({ culprit: fraud ? o : t, kind: fraud ? 'fausse_declaration' : 'infraction', summary: fraud ? `${O} a fait disparaître sa propre voiture, très endettée, pour toucher l'assurance.` : `${T} a volé la voiture de ${O} pour la revendre en pièces.`, timeline: [{ t: 0, text: 'Disparition du véhicule.' }] });
  const kD = b.clue({ nature: 'declaration', text: `${O} déclare le vol de sa voiture et soupçonne ${T}, déjà connu pour des vols.`, action: 'entretien', personId: o, difficulty: 2, skill: 'entretien', reliable: !fraud, revealsPerson: t });
  b.clue({ nature: 'fait', text: 'Aucun débris de verre à l\'emplacement de stationnement.', action: 'constatations', difficulty: 4, skill: 'observation', reliable: true });
  const it = b.item('Véhicule retrouvé incendié en lisière de forêt', ['vehicule', 'comparaison']);
  b.c.clues[b.c.clues.length - 1].revealsItem = it;
  b.clue({ nature: 'declaration', text: `${T} se montre agressif et refuse de répondre sur son emploi du temps.`, action: 'entretien', personId: t, difficulty: 2, skill: 'entretien', reliable: true });
  if (fraud) {
    b.clue({ nature: 'analyse', text: 'L\'expertise établit que le véhicule a été démarré avec sa clé d\'origine, présente dans le contact.', action: 'labo', itemId: it, labType: 'vehicule', difficulty: 6, skill: 'scientifique', reliable: true, contradicts: [kD], implicates: [{ pid: o, w: 4 }] });
    b.clue({ nature: 'document', text: `${O} accuse plusieurs mois de retard sur le crédit du véhicule et a augmenté son assurance récemment.`, action: 'requisition', personId: o, difficulty: 6, skill: 'analyse', reliable: true, implicates: [{ pid: o, w: 4 }] });
    const kW = b.clue({ nature: 'declaration', text: `Un riverain a vu ${O} lui-même partir au volant de la voiture la nuit de la déclaration.`, action: 'voisinage', difficulty: 6, skill: 'investigation', reliable: true, implicates: [{ pid: o, w: 4 }] });
    b.clue({ nature: 'fait', text: `${T} était en garde à vue dans une autre affaire au moment des faits.`, action: 'recherche', requires: [kD], difficulty: 5, skill: 'investigation', reliable: true, exculpates: [t] });
    b.clue({ nature: 'fait', text: `Le double des clés et un bidon d'essence sont retrouvés dans le garage de ${O}.`, action: 'perquisition', personId: o, requires: [kW], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: o, w: 5 }] });
    b.clue({ nature: 'declaration', text: `${O} reconnaît avoir organisé la disparition du véhicule.`, action: 'audition', personId: o, approach: 'element', requires: [kW], difficulty: 9, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: o, w: 3 }] });
  } else {
    b.clue({ nature: 'analyse', text: 'L\'expertise montre que le neiman a été forcé.', action: 'labo', itemId: it, labType: 'vehicule', difficulty: 6, skill: 'scientifique', reliable: true, implicates: [{ pid: t, w: 2 }] });
    const kAl = b.clue({ nature: 'declaration', text: `${T} affirme avoir passé la soirée chez sa mère.`, action: 'entretien', personId: t, approach: 'chronologie', difficulty: 4, skill: 'entretien', reliable: false });
    const kChk = b.clue({ nature: 'fait', text: `Sa mère était à l'hôpital ce soir-là ; un témoin a vu ${T} près du véhicule.`, action: 'voisinage', requires: [kAl], difficulty: 6, skill: 'investigation', reliable: true, contradicts: [kAl], implicates: [{ pid: t, w: 4 }] });
    b.clue({ nature: 'document', text: `${O} est à jour de ses crédits ; aucune modification récente de son assurance.`, action: 'requisition', personId: o, difficulty: 5, skill: 'analyse', reliable: true, exculpates: [o] });
    b.clue({ nature: 'fait', text: `Des pièces de la voiture de ${O} sont retrouvées chez ${T}.`, action: 'perquisition', personId: t, requires: [kChk], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: t, w: 7 }] });
    b.clue({ nature: 'declaration', text: `${T} reconnaît le vol.`, action: 'audition', personId: t, approach: 'element', requires: [kChk], difficulty: 9, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: t, w: 3 }] });
  }
  return b.finish({ title: `Vol de voiture déclaré — ${O}`, summary: `${O} déclare le vol de sa voiture garée près de ${place.name}. Elle est retrouvée incendiée le lendemain.`, priority: 3, complexity: 2, urgency: 0.2, media: 0.1 });
}

/** Accident grave sur un site industriel : défaillance technique ou malveillance. */
export function accidentSite(st: GameState, rng: Rng): Case {
  const place = pickPlace(st, rng, ['usine', 'entrepot']);
  const b = new CaseBuilder(st, rng, 'accident-site', 'sabotage', place, st.minute - rng.int(4, 16) * MIN_H);
  const sabotage = rng.chance(0.45);
  const v = b.person('victime', { prof: 'cariste', known: true });
  const dir = b.person('declarant', { prof: 'directrice de site', sexe: 'F', known: true });
  const c = b.person('suspect', { prof: 'responsable de maintenance', sincerity: sabotage ? 0.3 : 0.8, nervosity: 0.85 });
  const r = b.person('suspect', { prof: 'collègue en conflit avec la victime', sincerity: 0.6, nervosity: 0.7 });
  const V = b.n(v), C = b.n(c), R = b.n(r);
  b.truth({ culprit: sabotage ? r : null, kind: sabotage ? 'infraction' : 'accident', summary: sabotage ? `${R} a volontairement déréglé le chariot de ${V} pour lui nuire.` : `Le frein du chariot de ${V} a cédé par usure : la maintenance avait été reportée faute de pièces.`, timeline: [{ t: 0, text: `Accident du chariot de ${V}.` }] });
  const kD = b.clue({ nature: 'declaration', text: `La directrice décrit l'accident de ${V} et cite le responsable de maintenance, ${C}, et un collègue, ${R}.`, action: 'entretien', personId: dir, difficulty: 2, skill: 'entretien', reliable: true, revealsPerson: c });
  b.clue({ nature: 'declaration', text: `La directrice précise que ${R} et ${V} s'étaient disputés la semaine précédente.`, action: 'entretien', personId: dir, requires: [kD], difficulty: 4, skill: 'psychologie', reliable: true, revealsPerson: r, implicates: [{ pid: r, w: 2 }] });
  const it = b.item('Chariot élévateur accidenté', ['vehicule', 'comparaison']);
  b.clue({ nature: 'fait', text: 'Le chariot est placé sous scellés pour expertise.', action: 'constatations', difficulty: 3, skill: 'observation', reliable: true, revealsItem: it });
  b.clue({ nature: 'declaration', text: `${C} est très nerveu${b.e(c) ? 'se' : 'x'} et craint d'être tenu${b.e(c)} pour responsable.`, action: 'entretien', personId: c, difficulty: 2, skill: 'entretien', reliable: true });
  if (sabotage) {
    b.clue({ nature: 'analyse', text: 'L\'expertise révèle qu\'une vis de réglage du frein a été desserrée volontairement, avec un outil spécifique.', action: 'labo', itemId: it, labType: 'vehicule', difficulty: 6, skill: 'scientifique', reliable: true, implicates: [{ pid: r, w: 2 }] });
    b.clue({ nature: 'analyse', text: `Les marques d'outil sur la vis correspondent à la clé personnelle de ${R}.`, action: 'labo', itemId: it, labType: 'comparaison', requires: [kD], difficulty: 8, skill: 'scientifique', reliable: true, implicates: [{ pid: r, w: 5 }] });
    const kAl = b.clue({ nature: 'declaration', text: `${R} affirme ne jamais s'être approché du chariot de ${V}.`, action: 'entretien', personId: r, difficulty: 3, skill: 'entretien', reliable: false });
    const kChk = b.clue({ nature: 'fait', text: `Le pointage montre que ${R} est revenu dans l'atelier pendant la pause de ${V}.`, action: 'recherche', requires: [kAl], difficulty: 7, skill: 'investigation', reliable: true, contradicts: [kAl], implicates: [{ pid: r, w: 4 }] });
    b.clue({ nature: 'document', text: `Le registre de maintenance, tenu par ${C}, est à jour : le frein avait été contrôlé deux jours avant.`, action: 'recherche', requires: [kD], difficulty: 5, skill: 'analyse', reliable: true, exculpates: [c] });
    b.clue({ nature: 'fait', text: `Des notes visant ${V} sont retrouvées dans le casier de ${R}.`, action: 'perquisition', personId: r, requires: [kChk], difficulty: 5, skill: 'observation', reliable: true, implicates: [{ pid: r, w: 5 }] });
    b.clue({ nature: 'declaration', text: `${R} reconnaît avoir déréglé le frein « pour lui faire peur ».`, action: 'audition', personId: r, approach: 'element', requires: [kChk], difficulty: 11, skill: 'psychologie', reliable: true, confession: true, implicates: [{ pid: r, w: 3 }] });
  } else {
    b.clue({ nature: 'analyse', text: 'L\'expertise conclut à une rupture par usure d\'une pièce du frein, sans trace d\'intervention.', action: 'labo', itemId: it, labType: 'vehicule', difficulty: 6, skill: 'scientifique', reliable: true, noCrime: 6, exculpates: [r] });
    b.clue({ nature: 'document', text: 'Le registre de maintenance montre que le remplacement de la pièce avait été reporté faute de livraison.', action: 'recherche', requires: [kD], difficulty: 5, skill: 'analyse', reliable: true, noCrime: 3 });
    b.clue({ nature: 'fait', text: `${R} était en congé le jour de l'accident.`, action: 'recherche', requires: [kD], difficulty: 5, skill: 'investigation', reliable: true, exculpates: [r] });
    b.clue({ nature: 'declaration', text: `${C} avait signalé par écrit la pièce défectueuse à sa hiérarchie.`, action: 'entretien', personId: c, approach: 'chronologie', difficulty: 6, skill: 'entretien', reliable: true, noCrime: 2, exculpates: [c] });
  }
  return b.finish({ title: `Accident grave — ${place.name}`, summary: `Un cariste, ${V}, est grièvement blessé : son chariot élévateur a perdu ses freins à ${place.name}. L'inspection du travail demande une enquête.`, priority: 2, complexity: 3, urgency: 0.5, media: 0.45 });
}

export function yearOfState(st: GameState) {
  return calendar(st.startYear, st.minute).year;
}
