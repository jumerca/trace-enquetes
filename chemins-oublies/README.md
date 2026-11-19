# Les Chemins Oubliés — Prologue et Chapitre II

Aventure narrative 2,5D illustrée (JLG Creative), jouable au toucher et à la souris, **sans joystick**.
Version **0.2.0**. PWA installable, jouable hors ligne après le premier chargement, sauvegardes locales.

**Prologue — La Route effacée** : Clairval (village, auberge, atelier, archives, maisons), le Bois des Murmures,
le Moulin des Trois-Eaux ; 8 personnages principaux + 3 habitants d'ambiance ; 3 énigmes ; le Gardien des Ronces ;
3 missions facultatives ; 3 secrets ; 3 souvenirs de Maëlys ; la fête des moissons.

**Chapitre II — Les Voix des bois** : les Landes de Brume, le hameau de Brumecime, la Tour des Vents, l'atelier de
tissage ; 3 nouveaux habitants (Jules Bastien, Ysolde, Léna Lerouge) et Silas, le Conservateur ; une nouvelle
mécanique (les **échos** : voix restées dans les lieux, entendues avec l'atlas) ; 2 énigmes (pierres veilleuses,
miroirs) ; le Dévoreur de brume (braseros) ; une mission (le Troupeau égaré). Le chapitre commence à la fin du
prologue, par le pont de l'est du moulin.

## Lancer

```bash
cd chemins-oublies
npm install
npm run dev            # http://localhost:5173
npm run build          # production dans dist/ (sw.js et version.json générés)
npm run preview        # sert dist/ sur http://localhost:4173
```

## Tests

```bash
npm test                         # unitaires : navigation, énigmes, sauvegardes/migrations, cohérence des données, partitions
npm run preview &                # puis :
node scripts/e2e.cjs             # recette : joue le prologue complet par de vrais clics (Chromium)
FROM=bois node scripts/e2e.cjs   # départ à la porte du Bois (FROM=moulin : devant le moulin ; FROM=chap2 : début du Chapitre II)
node scripts/e2e.cjs --touch --w=844 --h=390   # même parcours au toucher, écran de téléphone en paysage
node scripts/e2e.cjs --unusual   # ordre de conversation inhabituel
node scripts/tour.cjs 1280 720 /tmp/tour       # captures de chaque lieu
```

Résultats de recette : voir `RECETTE.md`.

## Publication HTTPS

`npm run build:pages` copie le build dans `../chemins/`. Une fois fusionné sur la branche servie par GitHub Pages,
le jeu est servi à l'adresse `https://<compte>.github.io/trace-enquetes/chemins/`.

Chaque build porte un numéro (`version.json`, daté). Le service worker met en cache la liste exacte des fichiers du
build ; une nouvelle publication est détectée par **Options → Rechercher les mises à jour** (ou automatiquement au
lancement) et activée sur demande. Les parties sont dans `localStorage` (clés `chemins-oublies.save.N`, copie de secours
`.bak`, somme de contrôle) : une mise à jour du jeu ne les efface pas, et `SaveManager.migrate()` adapte les anciennes
sauvegardes (schéma versionné).

## Architecture

| Module | Fichier | Rôle |
|---|---|---|
| WorldManager | `src/scenes/GameScene.ts` (`loadZone`, `buildStatic`, `transition`) | zones, décors, transitions en fondu |
| NavigationSystem | `src/systems/Navigation.ts` | grille de collisions indépendante des dessins, A* 8 directions, lissage, obstacles temporaires |
| CharacterController | `src/systems/Actor.ts` + `GameScene.updateHero` | animations, orientation, marche/course, approche des cibles |
| NPCManager | `src/systems/NPCManager.ts`, `src/data/npcs.ts` | routines horaires (Agathe, Basile, Mara…), arrivées/départs |
| QuestManager | `src/data/story.ts`, `GameScene.quest/run` | étapes dérivées des drapeaux (jamais de progression perdue), aides progressives |
| PuzzleManager | `src/systems/Puzzles.ts` | logique pure des 3 énigmes (testée) |
| CombatSystem | `src/systems/Combat.ts` | ronceux (frappe circulaire), murmures (charge en ligne), attaques annoncées |
| AtlasSystem | `src/systems/Atlas.ts` | brouillard d'exploration, cartes parchemin, traces révélées |
| SaveManager | `src/systems/SaveManager.ts` | 3 emplacements, secours, migrations |
| UIManager | `src/ui/UI.ts`, `src/ui/style.css` | dialogues, atlas, sacoche, journal, menus, accueil, options, mise à jour |

Données séparées de l'affichage : `src/data/` (dialogues, quêtes, objets, habitants, rencontres) et `src/world/zones.ts`
(cartes : chemins, eau, décors, empreintes de collision, sorties).

**Graphismes** : tout est dessiné procéduralement au chargement (Canvas 2D, contour d'encre, ombrage en aplats),
puis envoyé à Phaser comme textures. Les personnages sont de vraies planches de sprites générées image par image
(marche 8 images, course 6, parole, observation, atlas, attaque, choc, attente) en trois orientations.
**Son** : musique et effets synthétisés (WebAudio), aucun fichier audio. 17 morceaux écrits (`src/systems/Music.ts`) : village le jour / le soir / la nuit, fête, landes de Brume, Brumecime, Bois (inquiet puis apaisé), maisons, auberge, Archives, moulin (à l'arrêt puis en marche), souvenirs, combat, boss, titre. Le morceau suit le lieu, l'heure et l'avancée de l'histoire, avec fondu enchaîné.
