# Rugby Manager 27 — V2.0 · Rapport des modifications

JLG Creative · version 2.0 · base : Édition Jouable V1.6 (conservée intacte dans `archive/`).

## 1. Inspection (phase A) — constats sur la V1.6

| Zone | Constat |
|---|---|
| Moteur de match | `rm-simple-js` : le résultat de chaque « action » était tiré aux dés (≈ 400 lancers par match), puis **illustré** par quatre couches d'animation successives (1.3 → 1.6). Les joueurs ne décidaient de rien : ils étaient interpolés vers des positions calculées après coup. |
| Rendu | Canvas de taille fixe (1100×545) agrandi par CSS, donc flou à certains zooms et sur écrans haute densité ; 4 couches visuelles superposées. |
| Gestion | Une seule note par joueur (`attr`, tirée d'un hachage), sans âge, potentiel, condition, blessure, moral ni contrat. Transferts sans négociation. Aucun club IA ne recrutait. |
| Architecture | Un HTML de 784 Ko composé de 8 scripts qui se surchargent les uns les autres. |
| Rugby Core 3.8 | Prototype indépendant (classe `RugbyCore`, ses propres données). Idées utiles (appel tactique à la sortie du ruck, touche selon la couverture adverse, règle 50:22, locomotion indexée sur la distance), mais non branchable tel quel sur la carrière. **Choix : réécrire un moteur propre en reprenant ces principes, plutôt que greffer le prototype.** |

Cinq chantiers prioritaires retenus : (1) moteur à agents qui décide du résultat, (2) rythme calibré, (3) contacts/rucks/phases statiques réglementaires, (4) rendu net et caméras adaptatives, (5) profondeur de gestion reliée au moteur.

## 2. Nouveau moteur de match (phase B) — `src/v2/engine/`

Le moteur V2 **décide** du match : score, statistiques et commentaire découlent de ce que font réellement les 30 joueurs. Les matchs de carrière (en direct comme simulés) passent tous par lui. Aucun mode démonstration séparé.

- **Noyau** (`rm2_core.js`) : pas fixe de 0,1 s, état JSON sérialisable (reprise d'un match interrompu), horloge réglementaire (la mi-temps et la fin sont sifflées au premier arrêt de jeu après 40:00 / 80:00), arrêts de jeu compressés mais comptés dans le chronomètre.
- **Locomotion** : accélération décroissante avec la vitesse, freinage, rayon de virage qui augmente avec la vitesse, fatigue (énergie) qui réduit vitesse et accélération, vitesses et masses par poste (pilier 7,3 m/s, ailier 9,5 m/s…), séparation physique (personne ne se traverse), temps de réaction individuel (pas de mouvements synchronisés).
- **Attaque** (`rm2_ai.js`) : structure 1-3-3-1 ou 2-4-2 réellement appliquée ; à chaque sortie de ruck, annonce collective selon zone, largeur, numéro de temps de jeu, score, temps restant, fatigue et consignes : pick and go, cellule d'avants (avec passe au contact ou passe dans le dos), attaque des trois-quarts (ligne, passe sautée, croisée, redoublée, leurre, arrière intercalé), départ du 9, chandelle du 9, jeu au pied du 10 (touche, long, chandelle, rasant, petit par-dessus, transversale, 50:22), drop. Le porteur lit la défense (recherche d'intervalle, fixation et passe en 2 contre 1, prise de contact), peut abandonner l'annonce s'il voit un trou.
- **Défense** : ligne ordonnée par appariement latéral (épaule intérieure), gardes de ruck, arrière et ailier pendule en couverture selon la menace de jeu au pied, montée paramétrée (glissée / inversée / attentiste), choix du plaqueur par temps d'interception, plaquage à deux, **repli défensif** en angle après un franchissement, contestation des rucks (gratteur) selon la consigne.
- **Contacts** : approche, contact, ralentissement, mise au sol, plaqueur au sol puis relevé, arrivée des soutiens, nettoyage du gratteur, sortie du 9. Plaquages manqués, dominants, offloads, en-avant au contact, tenu en l'air dans l'en-but, percussion près de la ligne.
- **Phases statiques** (`rm2_phases.js`) : mêlée (placement, liaison, poussée selon la puissance des 8 avec première ligne prépondérante, pénalités, mêlées à refaire, ballon volé, départ du 8), touche (alignement, annonce avant/milieu/fond, défense qui devine, sauteur soulevé, lancer pas droit, ballon volé, maul ou ballon au 9), maul (progression selon la masse et la force des liés, maul arrêté, écroulé, essai de pénalité), renvois au centre / 22 m / en-but, pénalités (poteaux, pénaltouche avec touche conservée, mêlée, jeu à la main), coups francs, marque, transformations dans l'axe de l'aplatissement, drops.
- **Règles** : avantage (pénalité et en-avant, retour à la faute si pas d'avantage réel), passes en avant, hors-jeu des joueurs devant le botteur (remis en jeu), touche directe hors des 22 = retour au point de frappe, 50:22, ballon mort, cartons jaunes (10 min), blessures, remplacements (automatiques ou manuels, entrée par la ligne de touche).
- **Modèle rapide** (`rm2_quick.js`) : uniquement pour les centaines de matchs IA contre IA des autres affiches, calibré sur les sorties du moteur (`tests/calibrate_quick_report.json`).

## 3. Rendu 2D et écran de match (phase C) — `src/v2/render/`, `src/v2/ui/`

- Canvas à la résolution réelle de l'écran (densité de pixels jusqu'à 2,5), redimensionné en continu : net à tous les zooms.
- Interpolation entre deux pas de simulation : aucun saut visuel, même à ×16.
- Caméras : **TV** (perspective discrète depuis la tribune, suivi lissé du ballon avec anticipation), **Proche**, **Large**, **Terrain entier**, **Tactique** (vue de dessus, pivotée automatiquement en portrait). Zoom molette, pincement et boutons. Cadrage vertical adaptatif (portrait, tablette, paysage).
- Silhouettes articulées : gabarit par poste, maillot à motif par club, numéro, short, chaussettes, tête et cheveux variés ; **foulée indexée sur la distance réellement parcourue** (pas de glissade) ; postures : course, sprint, trot, attente, passe, réception, saut, plaquage, plongeon, au sol, relevé, liaison de ruck, gratteur, mêlée, maul, sauteur soulevé, lancer, coup de pied, placement du buteur.
- Écran plein terrain : score et chrono compacts, bandeau d'action, barre unique (pause, ×1 ×2 ×4 ×8 ×16, mode « Résumé » qui accélère les temps faibles, « Action clé », caméra, zoom) ; panneaux repliables : consignes en direct, statistiques + **analyse « pourquoi votre plan fonctionne ou pas »**, joueurs (énergie, plaquages, mètres) et remplacements, fil du match, options (noms, calque tactique ligne défensive/cellules/annonce, i/s, simuler la fin, export JSON). Décision du manager à chaque pénalité (avec % de réussite estimé et conseil du capitaine), mi-temps avec bilan, fin de match avec meilleurs joueurs. Raccourcis clavier.

## 4. Gestion (phase D) — `src/v2/career/rm2_career.js`

- **Joueur** : âge, potentiel (estimé selon la cellule Analyse pour les joueurs adverses), note évolutive, 14 attributs **identiques à ceux du moteur**, condition physique, blessures (durée en semaines), moral, forme (5 derniers matchs), contrat (échéance, salaire), statistiques de saison. Fiche joueur détaillée.
- **Composition** : les blessés sont écartés, la condition entre en compte, le XV choisi est respecté sinon.
- **Entraînement hebdomadaire** : 6 domaines (attaque, défense, conquête, jeu au pied, physique, cohésion) et intensité ; effet immédiat sur les attributs du prochain match, progression des jeunes, fatigue et risque de blessure en cas de surcharge.
- **Tactique détaillée** : 7 curseurs (largeur, rythme, jeu au pied, avants, risque, montée, contestation) et 6 choix (zone de touche, après touche, mêlée, pénalités, type de jeu au pied, remplacements), tous lus par le moteur.
- **Marché** : filtres, valeur, négociation (indemnité, salaire, durée, prestige du club, 3 tentatives), joueurs libres, vente (liste des transferts → offres des clubs IA), prolongations.
- **Intersaison** : progression / déclin selon l'âge et le temps de jeu, retraites, fins de contrat (prolongations automatiques du directeur sportif, désactivables), recrutement des clubs IA (agents libres puis jeunes formés), centre de formation du club dirigé (influencé par l'investissement « académie »), objectifs et confiance de la direction (renvoi possible si la confiance s'effondre), actualités du club.
- **Masse salariale** issue des contrats ; finances V1.3 conservées (billetterie, sponsors, infrastructures).

## 5. Sauvegardes et compatibilité

- Clé de sauvegarde **inchangée** (`rugby-manager-27-alpha-v1`) : une carrière V1.6 se charge en V2.0 sans perte (testé).
- Avant la première écriture V2, copie automatique `…-avant-v2` ; avant chaque changement de saison, copie `…-saison-N`.
- Les nouvelles données vivent dans `state.rm2` ; l'historique des anciennes saisons est compacté (classements conservés) pour rester sous la limite de stockage du navigateur sur 15–20 saisons (+≈ 20 Ko par saison mesurés).
- Export / import JSON de la V1.6 conservés.

## 6. Architecture

```
rugby-manager-27/
  archive/            V1.6 d'origine, intacte
  src/legacy/         V1.6 découpée (8 scripts, 12 styles, gabarit) — reconstruit la V1.6 à l'identique
  src/v2/engine/      moteur (noyau, IA, phases et règles, modèle rapide) — sans DOM, testable sous Node
  src/v2/render/      rendu Canvas
  src/v2/ui/          écran de match, habillage, styles, service worker
  src/v2/career/      gestion
  tools/build.py      assemble le HTML autonome et la PWA
  tests/              tests Node et Chromium, rapports JSON, captures, séquence animée
  dist/               livrables
```
Aucune fonctionnalité V1.6 n'a été retirée : les modules hérités restent chargés, la V2 surcharge uniquement les points d'entrée (match, simulation, effectif, tactique, marché, accueil, menu).
