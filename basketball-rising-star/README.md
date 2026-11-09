# Basketball Rising Star — JLG Creative

Jeu de carrière de basketball (PWA) : vous incarnez un jeune joueur, de 16-18 ans jusqu'à la retraite,
avec un **moteur de match 2,5D réellement simulé** (dix joueurs, ballon physique, IA collective, règles FIBA).

## Lancer le jeu

```bash
cd basketball-rising-star
npm install
npm run dev          # http://localhost:5173 (développement)
npm run build        # version de production dans dist/
npm run preview      # sert dist/ sur http://localhost:4173
```

## Tests

```bash
npm test             # unitaires + simulation (moteur, règles, carrière, sauvegardes, équilibre) ~3 min
npm run preview &    # puis, dans un autre terminal :
npm run test:e2e     # parcours essentiels dans Chromium (création → match → semaine suivante → rechargement)
npm run sim -- 8 10  # statistiques moyennes sur 8 matchs officiels (4×10 min)
```

## Publication HTTPS

Le build utilise des chemins relatifs (`base: './'`) : `dist/` peut être servi depuis n'importe quel dossier HTTPS.

- **GitHub Pages (ce dépôt)** : `npm run build:pages` copie le build dans `../brs/`. Une fois fusionné sur la branche
  servie par Pages, le jeu est accessible sous `/brs/` du site du dépôt.
- **Vercel** : `npx vercel --prod` depuis `basketball-rising-star/` (framework Vite détecté, dossier de sortie `dist`).
- **Netlify** : `npx netlify deploy --prod --dir=dist`.

L'installation PWA (manifest + service worker) nécessite HTTPS. Les sauvegardes sont stockées dans IndexedDB :
une mise à jour du jeu (nouveau service worker) ne les efface jamais.

## Architecture

| Dossier | Rôle |
|---|---|
| `src/sim/` | Moteur de match indépendant du rendu : `engine.ts` (état déterministe, pas fixe 1/60 s, horloges, fautes, violations, lancers, remplacements), `physics.ts` (ballon 3D : anneau, planche, sol, filet), `shooting.ts` (modèle de tir), `rules.ts` (FIBA, NBA, NCB), `court.ts` (géométrie réglementaire) |
| `src/sim/ai/` | IA : `offense.ts` (lecture des options du porteur, pick-and-roll, coupes, transition, espacement), `defense.ts` (homme à homme, zone 2-3, aides, rotations, changements, box-out, fautes tactiques), `coach.ts` (rotations, fautes, temps morts) |
| `src/render/` | Rendu Canvas 2D 2,5D (projection oblique) : parquet, paniers, filets animés, joueurs articulés, ballon avec ombre et hauteur |
| `src/career/` | Monde fictif (4 ligues, 48 clubs), calendrier, classement, entraînement, progression, contrats/agents/offres, événements à choix, fin de saison (vieillissement, retraites, jeunes, montées/descentes) |
| `src/save/` | IndexedDB (4 emplacements, copie de secours, somme de contrôle), export/import, migrations |
| `src/ui/` | Interface React : accueil, création, hub, avant-match, match, feuille de match, paramètres, aide |

**Choix technique** : Canvas 2D + simulation maison plutôt que Phaser/PixiJS. Le moteur de jeu (collisions joueurs,
physique du ballon, IA) est entièrement spécifique ; un moteur généraliste aurait ajouté ~1 Mo sans rien apporter à
la simulation. Le rendu ne fait que lire l'état simulé, ce qui permet la simulation sans rendu (matchs simulés,
« accélérer jusqu'à mon entrée », tests sur des centaines de matchs).

Les tirs ne sont pas tirés au sort : les attributs, la contestation, la fatigue et la pression déterminent la précision
de la visée, puis la trajectoire est intégrée physiquement (anneau, planche, filet). Les tables de calibration
(`scripts/calib*.ts`) relient précision et taux de réussite mesuré.

Tous les clubs, ligues et joueurs sont fictifs.
