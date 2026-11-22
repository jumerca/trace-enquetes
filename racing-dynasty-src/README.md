# Racing Dynasty — V0.1 (JLG Creative)

Jeu de management d'écurie de monoplaces, direction artistique BD 2,5D.
TypeScript · React 18 · PixiJS 8 · Vite 5. PWA installable, jouable hors ligne.

## Boucle de jeu livrée

Accueil → création d'écurie (nom, trigramme, couleurs, emblème, siège, directeur, difficulté, budget, durée des GP,
emplacement de sauvegarde) → QG (recrutement et contrats, sponsors, évolutions de voiture, classements, finances)
→ week-end : essais libres (réglages + retours pilote) → qualifications → stratégie pneus → Grand Prix 2,5D
(pause, ×1, ×2, ×4, fin directe, consignes éco/normal/attaque, appel au stand) → résultats (points, primes, réputation)
→ GP suivant → fin de saison → saison suivante.

Championnat : 10 écuries (9 IA + la vôtre), 20 pilotes titulaires + 10 agents libres, 3 circuits originaux
(Port-Azur urbain, Valbrune rapide, Kharam désertique), barème 25-18-15-12-10-8-6-4-2-1.

## Commandes

```bash
npm ci                 # dépendances (versions exactes verrouillées)
npm run dev            # serveur de développement http://localhost:5173
npm test               # tests unitaires et d'intégration (Vitest)
npm run typecheck      # vérification TypeScript stricte
npm run build          # build de production dans dist/ (+ sw.js et version.json générés)
npm run preview        # sert dist/ sur http://localhost:4173
npm run test:e2e       # parcours complet dans Chromium (nécessite `npm run preview` lancé et Playwright)
npm run icons          # régénère les icônes PWA (Playwright)
npm run build:pages    # build + copie dans ../racing-dynasty (publication GitHub Pages du dépôt)
```

## Architecture

```
src/engine/   moteur de course pur (aucun DOM) : rng, géométrie de circuit, physique, simulation, tours chrono
src/game/     données de gestion : monde fictif, carrière, finances, classements, sauvegardes, préférences
src/render/   rendu PixiJS 2,5D en lecture seule de l'état du moteur
src/ui/       interface React (écrans, contrôles de simulation)
tests/        tests Vitest (moteur, carrière, sauvegardes)
scripts/      E2E Playwright, génération des icônes
```

* **Simulation reproductible** : tout l'aléatoire passe par un générateur à graine (`engine/rng.ts`). Une course est
  définie par sa configuration + sa graine + la liste horodatée des consignes du joueur : on peut la rejouer à
  l'identique (c'est ainsi qu'une course interrompue est reprise après rechargement).
* **Classements issus de la simulation** : pas fixe de 0,1 s ; chaque voiture a une abscisse et un décalage latéral
  calculés par le moteur (profil de vitesse physique par voiture, pneus, usure, rythme, aspiration, erreurs, arrêts).
  Le rendu ne fait qu'interpoler entre deux pas.
* **Pas de collision visuelle** : un mouvement latéral est refusé s'il crée un chevauchement, et une contrainte dure
  empêche toute voiture de rattraper celle qui la précède dans son couloir. Les tests vérifient 0 chevauchement à
  chaque pas d'une course complète sur les trois circuits.
* **Dépassements plausibles** : uniquement dans les zones de ligne droite, selon l'écart de rythme réel,
  dépassement/défense des pilotes et facilité du circuit ; une manœuvre ratée en entrée de virage est abandonnée.
* **Sorties de piste** : uniquement lors d'une erreur de pilotage (tout-droit, tête-à-queue) annoncée dans le fil
  d'événements, dans le dégagement, ou lors d'un abandon (la voiture se range hors piste).

## Sauvegardes

`localStorage`, clés stables `racing-dynasty/save/<n>` (3 emplacements) avec schéma versionné (`SAVE_SCHEMA`) et
table de migrations, copie de secours `.bak` automatique, export/import JSON depuis Paramètres, demande de stockage
persistant (`navigator.storage.persist`). Le service worker ne touche jamais au `localStorage`.

Voir `RAPPORT_TESTS_ET_LIMITES.md` et `PUBLICATION.md`.
