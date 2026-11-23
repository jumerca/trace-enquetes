# Domaines & Terroirs — JLG Creative (V0.3)

Jeu de gestion d'un domaine rural français en 2,5D isométrique. PWA installable, jouable au toucher et à la souris, entièrement en français.

**V0.3** : nouveaux engins (épandeur, pulvérisateur, vendangeuse, bétaillère, tracteurs de trois couleurs), personnages et animaux 3D, routes et ponts, économie équilibrée dans les 8 régions, reprise des sauvegardes V0.1, niveau de détail et qualité adaptative, compteur de performances.

**V0.2** : huit régions au choix (Limousin, Nord, Beauce, Est, Sud-Ouest, moyenne montagne, bord de mer, Provence) avec relief, climat, architecture et productions propres ; carte de 256×256 cases ; 9 cultures, 6 vergers et vignes, 7 élevages, 10 ateliers ; véhicules modélisés en 3D (tracteur et outils, moissonneuse-batteuse, camionnette, voitures) rendus en sprites 8 directions ; labour, semis et moisson mécanisés ; visiteurs qui arrivent en voiture ; contrats négociant.

- Build publié : `../domaines-terroirs/` (GitHub Pages)
- Sources : ce dossier — TypeScript strict, Vite, PixiJS 8 (scène), React 18 (interface)
- Bible visuelle et cahier des charges : `docs/` (`CONCEPT_ET_V01.md`, `PROMPT_CLAUDE_CODE.md`, `docs/references/` (JPEG))
- État d'avancement, tests et limites : **`RAPPORT_TESTS_ET_LIMITES.md`**
- Assets illustrés à produire : **`ASSETS_A_PRODUIRE.md`**

## Commandes

```bash
npm install
npm run dev          # http://localhost:5173 (serveur de développement)
npm test             # tests unitaires Vitest (simulation, économie, navigation, sauvegarde, profondeur)
npm run build        # vérification TypeScript + build de production dans dist/
npm run preview      # sert dist/ sur http://localhost:4174
npm run test:e2e     # tests de bout en bout Playwright sur dist/ (ordinateur + Pixel 5 émulé), captures dans docs/captures/
npm run icons        # régénère les icônes PNG depuis public/icons/icon.svg
npm run bake:sprites    # re-cuit véhicules, personnages et animaux 3D (three.js) en planches PNG 8 directions : public/sprites/
npm run build:pages  # build + copie dans ../domaines-terroirs (publication GitHub Pages)
```

Outils de diagnostic : `sheet.html` (planche-contact des assets peints, `/sheet.html?s=0..3`), `bake.html` + `src/dev/bake/` (modèles 3D des véhicules), `scripts/quick.cjs` (capture d'une région), `scripts/engins.cjs` (engins au travail), `scripts/vivants.cjs` (personnages et animaux), `scripts/perf.cjs` (coût par image avec processeur bridé), `scripts/saccades.cjs` (glissements de caméra : médiane, 95 %, 99 %, pire image), `scripts/pics.cjs` (bascule de saison, construction).

## Commandes de jeu

- Glisser : déplacer la carte · pincer / molette : zoom · bouton ⌖ : recentrer (la caméra ne bouge jamais d'elle-même).
- Toucher un bâtiment : fiche (état, recette, priorité, démolition).
- Construire : choisir un bâtiment, puis — à la souris, cliquer pour poser ; au toucher, toucher pour placer le fantôme puis « Valider » (ou toucher à nouveau la même case). `R` ou « Pivoter » : orientation de la porte.
- Clavier : Espace pause, 1/2/3 vitesses ×1/×2/×4, flèches déplacement, +/− zoom, Échap annuler.

## Architecture

```
src/
  core/rng.ts          RNG déterministe (état sauvegardé), bruit de valeur
  data/content.ts      données déclaratives : ressources, cultures, vergers, élevages, ateliers, bâtiments, rôles
  data/regions.ts      les 8 régions : relief, climat, architecture, essences, productions, départ
  world/terrain.ts     grille 256×256 avec hauteurs par sommet ; génération par région (mer, massif, rivières, villages, champs voisins, bocage)
  nav/astar.ts         A* 8 directions sans coupe de coin
  sim/state.ts         état de partie sérialisable
  sim/geom.ts          emprises, portes, coûts de navigation par type d'agent (travailleur, visiteur, véhicule)
  sim/sim.ts           moteur à pas fixe (1 minute de jeu) : production, tâches, visiteurs, négociant, comptabilité
  sim/actions.ts       actions du joueur, toutes validées (construction, chemins, terrains, prix, commandes)
  save/save.ts         JSON versionné + migrations, IndexedDB, export/import
  render/paint.ts      peinture procédurale Canvas 2D (tuiles, arbres, bâtiments au style régional, personnages…)
  render/paint2.ts     sols régionaux, cultures, nouvelles essences, vigne, animaux, ateliers, église, phare
  render/atlas.ts      atlas : sol (page unique pour les maillages), décor saisonnier, bâtiments, véhicules pré-cuits
  dev/bake/            modèles 3D three.js des véhicules (outil de production, non embarqué dans le jeu)
  render/depth.ts      règles de tri en profondeur (testées)
  render/scene.ts      scène Pixi : sol en maillages par chunk 16×16 (shader : ombrage des pentes, neige d'altitude),
                       objets instanciés autour de la caméra et recyclés, véhicules 8 directions, saisons, météo
  game.ts              boucle : simulation à pas fixe découplée du rendu, vitesses, autosauvegarde quotidienne
  ui/                  interface React (menu, HUD, panneaux, fiches, tutoriel)
tests/                 Vitest
scripts/               e2e Playwright, icônes, captures
```

Temps de jeu : à ×1, 4 minutes de jeu par seconde réelle (une journée ≈ 6 min). Une saison dure 7 jours ; la partie commence en été.
