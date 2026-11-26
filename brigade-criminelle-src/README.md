# Brigade criminelle Tycoon — Sous haute tension

**JLG Creative — version 0.4.0**

Jeu de gestion d'une brigade de police judiciaire dans une ville française fictive, en 2,5D isométrique.
Le joueur recrute et organise ses équipes, supervise des enquêtes procédurales fondées sur une vérité
fixée à l'avance, gère le laboratoire, les relations avec la justice et les médias, le budget public et
les locaux du commissariat.

- Version jouable : `../brigade-criminelle/` (build publié, PWA installable).
- Sources : ce dossier (TypeScript + React + PixiJS 8 + Vite, tests Vitest).
- Rapport de tests, fonctionnalités et limites : [`RAPPORT_TESTS_ET_LIMITES.md`](RAPPORT_TESTS_ET_LIMITES.md).
- Journal des modifications : [`CHANGELOG.md`](CHANGELOG.md).

## Lancer le jeu

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # tests automatisés (moteur, 1 000 affaires, plusieurs années simulées)
npm run build        # contrôle de types + build de production dans dist/
npm run build:pages  # build + copie dans ../brigade-criminelle (publication GitHub Pages)
npm run test:e2e -- http://localhost:4175/ test-results   # parcours navigateur (après `npm run preview`)
node scripts/perf.cjs http://localhost:4175/            # mesure indicative images/s et mémoire
npx vite-node scripts/longrun.ts <graine> <mois>         # simulation longue en délégation, bilan mensuel
npx vite-node scripts/career-run.ts <graine>             # carrière complète 1975 → retraite, bilan annuel
```

Pages de développement (serveur `npm run dev`) : `preview.html` (planche des personnages et véhicules),
`eras.html` (personnages de 1976 à 2025), `station.html?lshape=1` (pièce en L et meubles tournés),
`station.html?f=1&m=200` (commissariat seul), `city.html?m=600` (carte seule).

## Prise en main

Un **tutoriel guidé** (16 étapes) est proposé à la création de carrière ; le menu **❓ Guide** le relance
et résume les règles.

1. **Nouvelle carrière** : nom, prénom, âge, portrait, expérience, formation, spécialité, style de
   management ; scénario de référence (Saint-Clair, 1995, 80 000 habitants, « Les ombres de Saint-Clair »)
   ou partie libre (années 1975 à 2025, cinq tailles de ville) ; niveau d'assistance.
2. **Temps** : pause, ×1 (10 min de jeu par seconde), ×2, ×5, ×10, +1 h, « ⏭ » jusqu'au prochain
   événement, « ☀ Jour » jusqu'au lendemain 8 h. Pause automatique sur événement urgent (réglable).
   Clavier : espace = pause/reprise, 1–4 = vitesses, Échap = retour.
3. **Affaires** : attribuez un responsable et une équipe (suggestion de l'adjoint disponible), puis
   ordonnez ou validez les actions : constatations, voisinage, entretiens, recherches, réquisitions et
   perquisitions (autorisation judiciaire), envois au laboratoire, recoupements, garde à vue, rapport.
4. **Entretiens supervisés** : écoute, question ouverte, clarification, vérification chronologique,
   présentation d'une contradiction ou d'un élément vérifié, confrontation (en garde à vue).
5. **Tableau d'enquête** : cartes déplaçables (personnes, faits, déclarations, analyses, documents,
   hypothèses), contradictions en rouge, éléments disculpants en vert, liens et notes du joueur,
   chronologie reconstituée. Aucune jauge de culpabilité.
6. **Transmission au parquet** : désigner un auteur présumé ou proposer un classement (absence
   d'infraction, charges insuffisantes, auteur inconnu). Le parquet peut demander un complément
   d'enquête ; le jugement simulé intervient plus tard.

7. **Carrière** (menu 🎖️) : chaque 1er janvier, la direction examine votre dossier (ancienneté dans
   le poste, évaluations, réputation, moral des équipes, irrégularités). Si tout est rempli, une
   proposition d'avancement arrive : sur place (ressort élargi, moyens relevés, renforts) ou par
   mutation dans une ville plus grande. Six échelons, jusqu'à une coordination nationale fictive ;
   retraite à 65 ans.

8. **Réseau** (menu 🛰️) : à partir de la brigade départementale, pilotez vos antennes (dotations,
   priorités, inspections, affectations). **Construction** : achetez du terrain pour agrandir le site.
   **Équipements** : renouvelez la flotte et adoptez les technologies de chaque décennie.

9. **Partenaires** (menu 🤝) : légiste, gendarmerie, maire, hôpital, services sociaux, banques et
   opérateurs vous sollicitent et peuvent vous appuyer sur une affaire, selon la relation entretenue.
   Aux deux derniers échelons, **Carrière** ajoute le **pilotage national** (priorités, crises, cabinet,
   réformes, nominations).

10. **Construction** : pièces rectangulaires ou en L, déplacement d'une pièce (menu de la pièce),
   rotation et retrait des meubles, démolition remboursée. **Son** : réglages dans Options.

## Architecture

```
src/
  core/rng.ts            générateur pseudo-aléatoire à graine (état sauvegardé)
  sim/                   moteur de simulation, sans dépendance au rendu
    types.ts             modèle de données (JSON)
    calendar.ts          moteur temporel, époques et technologies (1975 → 2025)
    city.ts              moteur urbain : carte, quartiers, lieux et horaires, A* routier
    staff.ts             moteur du personnel : 18 compétences, grilles, fatigue, moral, progression
    cases/               générateur d'affaires : builder, 40 modèles procéduraux, grande affaire
    career.ts            progression de carrière : échelons, avancements, mutations, retraite
    network.ts           réseau d'antennes des échelons supérieurs
    tech.ts              technologies datées et leurs effets
    knowledge.ts         moteur des connaissances (ce que l'équipe sait, charges, contradictions)
    investigation.ts     actions d'enquête, découverte des informations, IA des enquêteurs
    interview.ts         entretiens supervisés (mémoire, émotions, sincérité, droits)
    justice.ts           moteur judiciaire simplifié (autorisations, parquet, jugements, réouvertures)
    finance.ts           moteur financier (enveloppe par poste, masse salariale séparée, demandes)
    station.ts           commissariat constructible : pièces, mobilier, portes, étages, A*
    world.ts             événements, météo, médias fictifs, accueil du public
    sim.ts               orchestration : création de partie, pas de 10 min, routines quotidiennes
  save/save.ts           sauvegardes versionnées IndexedDB + export/import de fichiers
  render/                rendu PixiJS (lit l'état, ne le modifie jamais)
    art.ts               dessin procédural des personnages, portraits et véhicules (Canvas 2D)
    iso.ts, engine.ts    projection isométrique, caméra, nuit, lumières, météo
    station-view.ts      commissariat animé (personnages pilotés par leurs tâches, véhicules, visiteurs)
    city-view.ts         ville vivante (circulation, piétons, missions de police, marqueurs)
    furniture.ts         mobilier vectoriel et équipements animés
  ui/                    interface React (écrans, panneaux, tableau d'enquête, entretiens)
  game.ts                boucle temporelle, vitesses, pause automatique, sauvegarde automatique
```

Principes :

- **La vérité précède l'enquête.** Chaque dossier est généré avec son auteur éventuel (ou l'absence
  d'infraction), sa chronologie et toutes les informations obtenables. Rien n'est tiré au sort après
  coup ; un innocent ne peut pas « devenir » coupable.
- **Le rendu ne décide de rien.** Les affaires avancent même hors écran ; la simulation tourne
  identiquement sans affichage (tests, simulations longues).
- **Reproductibilité.** Même graine + mêmes décisions = même partie (vérifié par les tests).

## Hébergement

Le build est publié dans `../brigade-criminelle/` à la racine du dépôt (GitHub Pages). Le service
worker met le jeu en cache pour un usage hors ligne et ne touche jamais aux sauvegardes IndexedDB.
