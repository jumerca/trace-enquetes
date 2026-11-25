# Rapport de tests, fonctionnalités et limites — V0.1.1

Ce rapport distingue ce qui est **vérifié** (test automatisé ou contrôle manuel documenté) de ce qui
est **partiel** ou **non réalisé**. Aucune fonctionnalité n'y est déclarée terminée sans preuve.

## 1. Tests automatisés (`npm test`) — 30 tests, tous réussis

| Domaine | Test | Résultat |
|---|---|---|
| Solvabilité | 1 000 affaires procédurales générées (14 modèles × 6 époques) : toute personne identifiable, auteur démontrable (charges ≥ 12, éléments matériels ≥ 6, jamais disculpé), absence d'infraction démontrable quand il n'y a pas d'auteur, aucun innocent accusable sans élément disculpant | ✅ |
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
| Longue durée | 3 années en délégation sans intervention : > 100 dossiers clôturés, > 70 % de décisions conformes aux faits, < 5 % de condamnations erronées, fatigue et compétences bornées, budget fini, sauvegarde < 8 Mo | ✅ |
| Époques | 1975, 1985, 2005, 2015, 2025 (commune à métropole) : démarrage et un mois de simulation | ✅ |

Simulation longue de contrôle (`npx vite-node scripts/longrun.ts 7 36`, délégation avancée, 3 ans) :
343 dossiers ouverts, 2 encore en cours fin 1997 ; 251 condamnations conformes, 32 classements pour
absence d'infraction, 16 relaxes ; délai médian de traitement 8,2 jours ; évaluations 15,3 puis 13,3/20.
La grande affaire est résolue correctement (Marchal et Valois condamnés, l'archiviste retrouvé,
l'antiquaire traité comme une affaire distincte). Durée de calcul : ≈ 3,5 s par année simulée.
Les classements « charges insuffisantes » jugés inappropriés (~6 %) proviennent de l'IA déléguée qui
classe après 25 jours un dossier où l'auteur était presque démontré : comportement voulu (l'IA n'est
pas infaillible), à équilibrer.

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
| Au moins cinq affaires jouables | ✅ 14 modèles procéduraux + 4 dossiers scénarisés |
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

- **Modèles d'affaires** : 14 modèles procéduraux (objectif version complète : 40). Les textes des
  déclarations sont rédigés à la troisième personne (style procès-verbal) ; l'accord en genre de
  quelques phrases génériques reste approximatif.
- **Graphismes** : personnages, véhicules et mobilier sont dessinés procéduralement (style BD) ;
  ce ne sont pas des graphismes définitifs. Animations présentes : marche, course, conversation,
  ordinateur, lecture, téléphone, transport de dossiers, assis ; arrivée/départ en véhicule au
  commissariat.
- **Ville** : population agrégée par quartier ; seuls les lieux et personnes des affaires sont
  individualisés. Les piétons et la circulation sont décoratifs (pilotés par l'activité des
  quartiers), pas des habitants simulés un par un avec domicile et travail.
- **Progression de carrière** (brigade départementale, régionale…) : seulement un indicateur
  d'avancement après de bonnes évaluations — prévu en V0.5. Pas de changement de ville.
- **Partenaires** : parquet, juge des libertés et juge d'instruction simulés ; médecins légistes,
  gendarmerie, services municipaux, hôpital et services sociaux n'interviennent que de façon
  implicite (laboratoire, textes des affaires).
- **Construction** : pièces rectangulaires sur une emprise fixe de 22 × 14 cases par étage ;
  pas de rotation du mobilier ; la démolition ne rembourse rien.
- **Web Worker** : non utilisé — la simulation coûte ≈ 0,2 ms par pas et tourne sur le fil principal.
- **Audio** : aucun son dans cette version.
- **Entretiens supervisés** : ils ne consomment pas de temps de jeu (instantanés) ; l'aléa des
  entretiens supervisés n'est pas sauvegardé (le reste de la simulation est reproductible).
- **Équilibrage** : volumes, coûts et délais calibrés sur Saint-Clair 1995 ; les autres tailles et
  époques n'ont été testées que sur un mois.
- **Déploiement** : le build est copié dans `brigade-criminelle/` pour GitHub Pages ; l'adresse
  publique n'a pas pu être contrôlée depuis l'environnement de développement (accès réseau à
  github.io indisponible). Elle sera active après fusion sur la branche publiée.
