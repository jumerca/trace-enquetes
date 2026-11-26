# Rapport de tests, fonctionnalités et limites — V0.4.0

Ce rapport distingue ce qui est **vérifié** (test automatisé ou contrôle manuel documenté) de ce qui
est **partiel** ou **non réalisé**. Aucune fonctionnalité n'y est déclarée terminée sans preuve.

## 1. Tests automatisés (`npm test`) — 52 tests, tous réussis

| Domaine | Test | Résultat |
|---|---|---|
| Solvabilité | **2 000** affaires procédurales générées (**40 modèles** × 6 époques, 15 types d'affaires) : toute personne identifiable, auteur démontrable (charges ≥ 12, éléments matériels ≥ 6, jamais disculpé), absence d'infraction démontrable quand il n'y a pas d'auteur, aucun innocent accusable sans élément disculpant | ✅ |
| Cohérence des témoignages | Toute déclaration mensongère est réfutable par un fait vérifiable ; références internes (personnes, pièces, prérequis) valides ; aucun texte « undefined » | ✅ |
| Grande affaire | Les 4 dossiers sont cohérents ; 3 sont liés, l'antiquaire est une coïncidence malgré l'élément commun ; personnages partagés | ✅ |
| Persistance de la vérité | La vérité de chaque dossier ne change pas pendant 20 jours de simulation | ✅ |
| Reproductibilité | Même graine → état strictement identique après 20 jours ; graines différentes → parties différentes | ✅ |
| Sauvegardes | Aller-retour JSON sans perte et poursuite identique ; fichier étranger refusé ; IndexedDB écriture/lecture | ✅ |
| Horaires | Équipes de jour, de nuit, jours de repos | ✅ |
| Fatigue | Le travail fatigue (davantage en surcharge), le repos récupère, la fatigue dégrade la performance | ✅ |
| Compétences | Progression par la pratique, plafonnée par le potentiel ; formation | ✅ |
| Grilles | Salaire selon grade et ancienneté ; promotion encadrée | ✅ |
| Affectations | Suggestion d'équipe, attribution, exécution d'une action ordonnée en gestion manuelle | ✅ |
| Temps | « Prochain événement » s'arrête sur une alerte | ✅ |
| Budget | Imputation par poste, masse salariale séparée, aucune récompense financière par affaire | ✅ |
| Commissariat | A* entre étages ; collisions de construction ; porte automatique ; circulation préservée | ✅ |
| Justice | Aveux seuls → complément d'enquête ; dossier complet → poursuites ; personne disculpée refusée ; classement faute de preuves jugé approprié ; déclaration contredite exclue des charges | ✅ |
| Entretiens | Les approches donnent accès à la mémoire de la personne ; la nervosité ne crée aucune charge ; aveux seulement en garde à vue | ✅ |
| Carrière | 6 échelons ; aucune proposition sans dossier suffisant ; proposition sur dossier exemplaire ; avancement sur place (grade, moyens, renforts, volume d'affaires) ; refus ; mutation dans une ville plus grande (même commandant, même date, carrière conservée, nouvelle brigade fonctionnelle, sauvegarde) ; grades sans rétrogradation apparente en 1995 ; retraite à 65 ans ; migration des sauvegardes v1 ; annonce des changements d'époque | ✅ |
| Commissariat (V0.3) | Agrandissement du terrain puis construction de nouvelles pièces ; allée du garage protégée ; pièces datées ; capacités (cellules, cantine, stand de tir) | ✅ |
| Époques (V0.3) | Technologies disponibles selon l'année, achat et effet mesuré ; véhicule renouvelé avec le modèle de son époque | ✅ |
| Réseau et retour (V0.3) | Antennes créées selon l'échelon ; détachement, inspection, dotation ; dossiers sensibles remontés au siège en simulation ; retour dans une ville quittée (équipe retrouvée, dossiers clos par le successeur), et repli sans archive | ✅ |
| Longue durée | 3 années en délégation sans intervention : > 100 dossiers clôturés, > 70 % de décisions conformes aux faits, < 5 % de condamnations erronées, fatigue et compétences bornées, budget fini, sauvegarde < 8 Mo | ✅ |
| Époques | 1975, 1985, 2005, 2015, 2025 (commune à métropole) : démarrage et un mois de simulation | ✅ |
| Variantes (V0.4) | Les six variantes de déroulement apparaissent ; toutes restent solvables (incluses dans les 2 000 affaires) ; un auteur non arrêté récidive et le nouveau dossier renvoie au précédent | ✅ |
| Partenaires (V0.4) | Six partenaires ; une demande arrive, la réponse modifie la relation ; une sollicitation acceptée accélère l'affaire ; pas de nouvelle sollicitation immédiate | ✅ |
| Sommet (V0.4) | Aucun pilotage national avant l'échelon 5 ; priorités toujours égales à 100 % ; arbitrages générés et décidés ; note de pilotage | ✅ |
| Construction (V0.4) | Pièce en L (angle retiré inaccessible), déplacement avec mobilier, démolition remboursée au centime ; refus de démolir un couloir qui couperait l'accès à d'autres pièces | ✅ |

**Équilibrage V0.4 sur Saint-Clair 1995** (`scripts/longrun.ts`, délégation avancée, graines 1 à 4,
13 mois) : la première version des nouveautés provoquait un engorgement sur deux graines sur trois
(jusqu'à 45 dossiers en attente, fatigue moyenne 65-78, évaluation 1,1 à 5,4/20). Après réglage :
2 à 29 dossiers en attente fin décembre, 113 à 142 dossiers dans l'année, délai médian 6 à 10 jours,
93 à 97 % de décisions conformes aux faits, évaluations 14,8 à 16,6/20, budget consommé à 62-72 %
(le reste finance les choix du joueur : construction, technologies, partenaires). Sur 3 ans (graine 5) :
2 à 4 dossiers en attente en fin d'année.

Simulation longue de contrôle de la V0.3 (`npx vite-node scripts/longrun.ts 7 36`, délégation avancée, 3 ans) :
343 dossiers ouverts, 2 encore en cours fin 1997 ; 251 condamnations conformes, 32 classements pour
absence d'infraction, 16 relaxes ; délai médian de traitement 8,2 jours ; évaluations 15,3 puis 13,3/20.
La grande affaire est résolue correctement (Marchal et Valois condamnés, l'archiviste retrouvé,
l'antiquaire traité comme une affaire distincte). Durée de calcul : ≈ 3,5 s par année simulée.
Les classements « charges insuffisantes » jugés inappropriés (~6 %) proviennent de l'IA déléguée qui
classe après 25 jours un dossier où l'auteur était presque démontré : comportement voulu (l'IA n'est
pas infaillible), à équilibrer.

## 1 bis. Carrière complète simulée (`npx vite-node scripts/career-run.ts 11`)

**V0.4** — Même carrière (1975 → retraite en 2012), cette fois jusqu'au sommet : Directeur central
en 2000 à Hautmesnil (700 000 habitants, 33 agents, 5 antennes), avec le pilotage national actif
12 ans. Un premier passage a révélé deux défauts, corrigés : l'adjoint délégué n'inspectait jamais
les antennes (stock montant à 202 dossiers) et choisissait parfois la pire option d'un arbitrage.
Après correction : stock des antennes résorbé (0 en fin d'année), 6 à 16 dossiers en attente au
siège, 97 à 98 % de décisions conformes, évaluations 13,1 à 18,4/20. Sauvegarde : jusqu'à 11,6 Mo
au poste national dans une métropole (registre détaillé limité à 3 ans quand le volume est élevé).

**V0.3** — Commandant de 28 ans en 1975 dans une petite ville (20 000 habitants), délégation avancée,
chaque proposition acceptée : **37 années jusqu'à la retraite en 2012**. Parcours : Commissaire
principal (1979), Commissaire divisionnaire et réseau de 2 antennes (1983), mutation à Rochebrune
(80 000 habitants, Contrôleur général, 3 antennes, 1998), mutation à Port-Vallon (250 000 habitants,
Inspecteur général, 4 antennes, 2004). La flotte est renouvelée au fil des décennies (véhicules de
1969-1973, puis de 1983-1986, 1994-1997, 2001-2004, 2011-2012) et 10 technologies sont adoptées.
Sur toute la carrière : 0 à 11 dossiers en attente en fin d'année, 95 à 99 % de décisions conformes
aux faits, stocks des antennes résorbés, sauvegarde de 1 à 8,2 Mo.
Contrôle complémentaire : partie libre en métropole (700 000 habitants, 2015, 33 agents) sur un an :
4 à 12 dossiers en attente, 96 à 99 % de décisions conformes.

Les simulations longues ont révélé et permis de corriger, au fil des versions : une boucle de l'IA
déléguée, des journaux non purgés (sauvegarde passée de 3 à 108 Mo), un double comptage du volume
d'affaires, des structures sous-dotées après mutation et en métropole (jusqu'à 165 dossiers en
attente), des véhicules de 1969 encore en service en 2006 et des technologies inaccessibles aux
petites villes (coûts désormais proportionnés à l'époque et à la taille du service).

## 2. Contrôle dans un vrai navigateur (`scripts/e2e.cjs`)

**V0.1.1** : le parcours tourne sur quatre formats (1366 × 800, tablette 1024 × 700, mobile 412 × 860,
petit mobile 360 × 740) et vérifie en plus, sur chaque écran, l'absence de tout défilement horizontal
(HUD, panneaux, tableaux, page) et que le menu tient sans défilement : **aucune erreur, aucun
débordement**. Contrôle de la circulation (script sur la carte) : 100 % des véhicules sur la chaussée,
quasi tous sur la voie de droite (les autres en virage), 100 % des piétons sur trottoirs ou passages.


Parcours automatisé sur le build de production (Chromium, 1366 × 800 et 412 × 860) : écran titre,
création de carrière, commissariat, simulation d'une journée, liste des affaires, dossier,
attribution, investigations, **entretien supervisé** (4 approches), tableau d'enquête, ×10, carte,
personnel, planning, laboratoire, budget, statistiques, justice, recrutement, unités, médias,
archives, construction, sauvegarde dans un emplacement. **Aucune erreur JavaScript.** Les captures
ont été examinées une à une (jour, nuit, neige, pluie, étages, mobile).

## 3. Performances (indicatives)

Mesure `scripts/perf.cjs`, Chromium sans interface **en rendu logiciel** (pas de GPU) — les chiffres
réels sur un appareil avec GPU sont supérieurs :

| Vue (×10) | 1280 × 720 | 412 × 860 |
|---|---|---|
| Commissariat | 20 i/s, 31 Mo de tas JS | 41 i/s, 33 Mo |
| Carte | 18 i/s, 47 Mo | 29 i/s, 44 Mo |

Simulation : ≈ 0,2 ms par pas de 10 minutes (×10 = 10 pas/s). Taille de sauvegarde : ≈ 0,9 Mo par
année simulée après allègement des archives. Bundle : 545 ko (174 ko gzip) + PixiJS et React.
**Non vérifié** : test sur un vrai téléphone Android 4 Go (aucun appareil disponible ici).

## 4. Fonctionnalités de la V0.1 demandées (§ 27 du cahier des charges)

| Élément | État |
|---|---|
| Logo original | ✅ (SVG vectoriel) |
| Écran de création de carrière | ✅ |
| Commissariat détaillé et animé | ✅ 2 étages, mobilier, équipements animés, personnages pilotés par la simulation |
| Petite carte urbaine | ✅ 48 × 48, 14 quartiers, 55 lieux à horaires |
| Au moins 12 employés | ✅ 12 au départ |
| Plusieurs véhicules | ✅ 3 + achats |
| Bureaux interactifs | ✅ toucher un personnage ou une pièce ouvre sa fiche |
| Planning | ✅ |
| Moteur d'affectation | ✅ manuel, suggestion, délégation |
| Au moins cinq affaires jouables | ✅ 40 modèles procéduraux + 4 dossiers scénarisés |
| Témoins et suspects | ✅ mémoire, sincérité, nervosité, coopération, droits |
| Tableau d'enquête | ✅ |
| Laboratoire simplifié, résultats d'examens | ✅ file d'attente, paillasses, prestataire, traçabilité |
| Transmission judiciaire simulée | ✅ |
| Gestion budgétaire | ✅ |
| Statistiques | ✅ |
| Sauvegardes | ✅ |
| « Les ombres de Saint-Clair » | ✅ 4 dossiers, liens à démontrer, coïncidence |
| Simulation de plusieurs mois | ✅ (testé sur 3 ans) |

## 5. Limites connues et écarts avec le cahier des charges complet

- **Modèles d'affaires** : 40 modèles procéduraux. 33 partagent un squelette commun, mais 60 % des
  affaires reçoivent l'une des six variantes de déroulement, et certaines forment des séries ; la
  grande affaire scénarisée reste la seule intrigue écrite à la main. Les textes des
  déclarations sont rédigés à la troisième personne (style procès-verbal) ; l'accord en genre de
  quelques phrases génériques reste approximatif.
- **Graphismes** : personnages, véhicules et mobilier sont dessinés procéduralement (style BD) ;
  ce ne sont pas des graphismes définitifs. Animations présentes : marche, course, conversation,
  ordinateur, lecture, téléphone, transport de dossiers, assis ; arrivée/départ en véhicule au
  commissariat.
- **Ville** : les personnes liées aux affaires en cours sont suivies une à une sur la carte (domicile,
  travail, sorties ; jusqu'à 18 à la fois). Les autres passants et la circulation suivent l'activité
  des quartiers et les feux, sans identité propre ; il n'y a ni bouchons ni accidents de la route.
- **Progression de carrière** : six échelons, mutations, retour dans une ville déjà dirigée (si son
  archive est sur l'appareil ; sinon une brigade y est reconstituée), réseau d'antennes simulé de
  façon agrégée (leurs dossiers ne sont pas instruits un par un, sauf les dossiers sensibles remontés
  au siège). Le pilotage national (V0.4) passe par des arbitrages et des priorités, pas par la
  gestion individuelle de chaque service régional.
- **Fluidité sur téléphone** : toujours non mesurée sur un vrai appareil. Le jeu s'adapte désormais
  seul (résolution puis nombre de figurants) et affiche sa fluidité à la demande (Options).
- **Partenaires** : six partenaires incarnés (demandes et appuis) en plus des magistrats. Leurs
  échanges passent par des choix à options, pas par un dialogue libre ; ils ne se déplacent pas au
  commissariat.
- **Construction** : rectangles et L (pas de formes libres plus complexes) ; la rotation d'un meuble
  est un quart de tour visuel (les meubles occupent une seule case).
- **Web Worker** : non utilisé — la simulation coûte ≈ 0,2 ms par pas et tourne sur le fil principal.
- **Audio** : musique et effets synthétisés à la volée (pas d'enregistrements ni de voix) ; le son
  démarre au premier toucher, comme l'exigent les navigateurs.
- **Personnages** : la tenue suit l'année en cours pour tout le monde ; l'âge ne change pas le style
  (un retraité de 2025 s'habille comme un jeune de 2025).
- **Entretiens supervisés** : ils ne consomment pas de temps de jeu (instantanés) ; l'aléa des
  entretiens supervisés n'est pas sauvegardé (le reste de la simulation est reproductible).
- **Équilibrage** : calibré sur Saint-Clair 1995 (4 graines sur 13 mois, une sur 3 ans) et sur une
  carrière complète en délégation ; non mesuré sur un joueur réel en gestion manuelle. En délégation
  l'adjoint obtient souvent « excellente année » : la difficulté vient surtout de la gestion manuelle.
- **Déploiement** : le build est copié dans `brigade-criminelle/` pour GitHub Pages ; l'adresse
  publique n'a pas pu être contrôlée depuis l'environnement de développement (accès réseau à
  github.io indisponible). Elle sera active après fusion sur la branche publiée.
