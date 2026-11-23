# Domaines & Terroirs — JLG Creative (V0.1, tranche verticale)

Jeu de gestion d'un domaine rural français en 2,5D isométrique. PWA installable, jouable au toucher et à la souris, entièrement en français.

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
npm run build:pages  # build + copie dans ../domaines-terroirs (publication GitHub Pages)
```

Outils de diagnostic : `sheet.html` (planche-contact de tous les assets peints, en `npm run dev` : `/sheet.html?s=0..3` pour la saison), `scripts/showcase.cjs` (captures d'un domaine développé et des saisons).

## Commandes de jeu

- Glisser : déplacer la carte · pincer / molette : zoom · bouton ⌖ : recentrer (la caméra ne bouge jamais d'elle-même).
- Toucher un bâtiment : fiche (état, recette, priorité, démolition).
- Construire : choisir un bâtiment, puis — à la souris, cliquer pour poser ; au toucher, toucher pour placer le fantôme puis « Valider » (ou toucher à nouveau la même case). `R` ou « Pivoter » : orientation de la porte.
- Clavier : Espace pause, 1/2/3 vitesses ×1/×2/×4, flèches déplacement, +/− zoom, Échap annuler.

## Architecture

```
src/
  core/rng.ts          RNG déterministe (état sauvegardé), bruit de valeur
  data/content.ts      données déclaratives : ressources, prix, bâtiments, recettes, rôles, météo, saisons
  world/terrain.ts     grille 96×96, génération du paysage Corrèze/Périgord (rivière, étang, bois, hameau, routes)
  nav/astar.ts         A* 8 directions sans coupe de coin
  sim/state.ts         état de partie sérialisable
  sim/geom.ts          emprises, portes, coûts de navigation par type d'agent (travailleur, visiteur, véhicule)
  sim/sim.ts           moteur à pas fixe (1 minute de jeu) : production, tâches, visiteurs, négociant, comptabilité
  sim/actions.ts       actions du joueur, toutes validées (construction, chemins, terrains, prix, commandes)
  save/save.ts         JSON versionné + migrations, IndexedDB, export/import
  render/paint.ts      peinture procédurale Canvas 2D des assets isolés (tuiles, arbres, bâtiments, personnages…)
  render/atlas.ts      empaquetage en pages d'atlas (peu de textures GPU)
  render/depth.ts      règles de tri en profondeur (testées)
  render/scene.ts      scène Pixi : chunks 16×16, culling, interpolation, saisons, jour/nuit, météo, caméra tactile
  game.ts              boucle : simulation à pas fixe découplée du rendu, vitesses, autosauvegarde quotidienne
  ui/                  interface React (menu, HUD, panneaux, fiches, tutoriel)
tests/                 Vitest
scripts/               e2e Playwright, icônes, captures
```

Temps de jeu : à ×1, 4 minutes de jeu par seconde réelle (une journée ≈ 6 min). Une saison dure 7 jours ; la partie commence en été.
