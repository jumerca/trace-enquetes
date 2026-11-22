# Racing Dynasty — V0.9 (JLG Creative)

Jeu de management d'écurie de monoplaces, direction artistique BD 2,5D.
TypeScript · React 18 · PixiJS 8 · three.js (modèles 3D) · Vite 5. PWA installable, jouable hors ligne.

## Boucle de jeu livrée

Accueil → création d'écurie (nom, trigramme, couleurs, emblème, siège, directeur, difficulté, budget, durée des GP,
emplacement de sauvegarde) → QG (recrutement et contrats, sponsors, évolutions de voiture, classements, finances)
→ week-end : essais libres (réglages + retours pilote) → qualifications → stratégie pneus → Grand Prix 2,5D
(pause, ×1, ×2, ×4, fin directe, consignes éco/normal/attaque, appel au stand) → résultats (points, primes, réputation)
→ GP suivant → fin de saison → saison suivante.

Championnat : 10 écuries (9 IA + la vôtre), 20 pilotes titulaires, agents libres et jeunes espoirs, 8 circuits originaux
(Port-Azur, Lac d'Argent, Brumevent, Valbrune, Montclair, Rocheval, Lumen de nuit, Kharam),
barème 25-18-15-12-10-8-6-4-2-1.

### Nouveautés V0.9 — modèles 3D
* Monoplaces modélisées en 3D (`src/render/models3d.ts`, three.js) : monocoque, nez, pontons sculptés, capot et
  prise d'air, aileron de requin, halo, rétroviseurs, ailerons avant (3 éléments) et arrière (volet + dérives),
  fond plat et diffuseur, suspensions, roues à jantes et liseré, casque du pilote, sponsor sur les flancs.
  Ombrage cel-shading 3 tons + arêtes et contour encrés façon BD.
* Les modèles sont « cuits » au chargement de la course en planches d'images (48 angles en 2,5D, 36 angles en vue
  rasante), en un seul rendu par livrée, puis affichés comme des sprites : la voiture montre son vrai volume quand
  elle tourne, sans aucun coût 3D pendant la course. Planches gardées en mémoire d'une course à l'autre.
* Toutes les vues en profitent : Suivre / Embarquée / TV / Hélico (2,5D), Bord (de face, de profil, de dos) et
  Cockpit, dont le nez, les roues avant, le halo et les rétroviseurs sont rendus en perspective depuis le casque.
* Voiture de sécurité en 3D (coupé blanc et orange, rampe lumineuse).
* Décor en 3D low-poly : feuillus, sapins, palmiers, buissons, cactus, rochers, immeubles (façades fenêtrées,
  allumées de nuit, équipements de toit) ; forêts plus denses.
* Repli automatique sur les dessins 2D si WebGL est indisponible pour la cuisson.
* Aperçu des modèles pour le développement : `npm run dev` puis `/preview/models.html`.

### Nouveautés V0.8
* Vues de course : « Bord » (caméra de télévision au bord de la piste, au téléobjectif, qui voit arriver la voiture
  de face, la suit de profil puis de dos avant de passer à la caméra suivante) et « Hélico » (vue large qui suit la
  voiture de haut), en plus de Suivre, Embarquée, Cockpit, TV et Circuit.
* Conférence de presse après chaque GP : une question selon la course (rivalité, abandons, podium, contre-performance),
  trois réponses aux effets différents (moral des pilotes, confiance des actionnaires, réputation, rivalité). Votre
  réponse est citée dans l'article de la Gazette.
* Contrat du directeur : salaire personnel et prime d'objectif, gains de carrière cumulés ; en fin de contrat, trois
  propositions de prolongation (1, 2 ou 3 saisons) à signer, ou à négocier (« Exiger plus » : refus possible).
* Chargement plus rapide : le moteur de course (PixiJS) n'est téléchargé qu'au premier départ (≈110 Ko compressés
  au lieu de ≈200 Ko pour ouvrir le jeu) ; il reste mis en cache pour le hors-ligne.
* Sauvegardes : bouton « Partager » (Android : Drive, e-mail, messagerie…) pour reprendre la partie sur un autre
  appareil via « Importer ».
* Tests automatiques sur GitHub (`.github/workflows/racing-dynasty.yml`) : typecheck, tests unitaires, build et
  parcours E2E Android à chaque pull request touchant le jeu.

### Nouveautés V0.7 — la gestion sur le long terme
* Installations : soufflerie, simulateur et usine (niveaux 1 à 5), agrandies par chantiers de plusieurs GP avec
  entretien par course. L'usine débloque des projets de R&D en parallèle (1 à 3) et fiabilise moteur / châssis /
  fiabilité ; la soufflerie fiabilise et accélère l'aéro ; le simulateur accélère la mise au point aux essais et la
  progression des jeunes.
* Presse : « La Gazette des Paddocks » publie un article BD après chaque Grand Prix (titre, compte rendu, déclaration
  d'un de vos pilotes, réplique d'un rival). Nouvel onglet Presse et « À la une » au QG.
* Rivalités : les dépassements, contacts et pénalités entre vos pilotes et un adversaire créent une rivalité ; battre
  son rival remonte le moral, être battu l'entame.
* Carrière du directeur : contrat de 2 saisons, confiance des actionnaires mise à jour à chaque course ; limogeage si
  elle s'effondre (avec offres d'écuries modestes pour rebondir) ; débauchage par une écurie plus forte après une
  saison réussie (accepter ou rester fidèle).
* Économie rééquilibrée pour 8 GP : sponsors ×0,55 par course, primes un peu réduites, logistique et entretien des
  installations — une saison passive est désormais proche de l'équilibre (simulation de 2 saisons complètes pour
  chaque difficulté et chaque profil de budget).
* Course : vue Cockpit (perspective pseudo-3D depuis le baquet : halo, nez et roues avant, rétroviseurs, volant avec
  vitesse et rapport, adversaires vus de dos, gouttes sur la visière, ciel de nuit ou de crépuscule, brouillard).
* Sauvegardes : schéma 4, migration automatique des parties V0.6.

### Nouveautés V0.6
* Week-end : séance de qualifications animée (chronos en direct, tour lancé de vos pilotes sur la carte, mêmes
  temps que le moteur), graphique des relais d'essais, briefing de l'ingénieur (météo, profil du circuit, rivaux,
  stratégie conseillée).
* Course : drapeaux jaunes locaux (ralentissement et dépassements interdits dans la zone), caméra embarquée,
  commentateur en bulles BD, podium animé (portraits, monoplaces, champagne), arrêts au stand animés.
* Stratégie : pneus tendres plus performants mais plus fragiles, arrêts moins coûteux, attaques facilitées avec des
  pneus nettement plus frais — deux arrêts deviennent une option sur les circuits à forte usure.
* Ambiance : portraits dessinés de chaque pilote, brouillard à Brumevent, crépuscule à Kharam, flaques et reflets
  sur piste mouillée, clameurs de la foule sur les temps forts.

### Nouveautés V0.5 — refonte graphique
* Atelier de peinture procédurale (`src/render/art.ts`, Canvas 2D) : tous les éléments sont peints une fois au
  chargement (dégradés, encrage BD, reflets) puis affichés en sprites — plus beau et moins coûteux pour le GPU.
* Monoplaces détaillées : pneus, suspensions, pontons sculptés, capot, airbox, halo, rétroviseurs, ailerons
  multi-éléments, numéro, sponsor ; flanc visible (épaisseur 2,5D) et ombre douce.
* Piste : grain d'asphalte, gomme sur la trajectoire, ombrage des bords, vibreurs en relief, bacs à gravier à
  l'extérieur des virages, grillages, murs de pneus colorés, postes de commissaires, spectateurs.
* Décor : sols peints (herbe tondue, sable ridé, dalles, alpage), arbres / sapins / palmiers / cactus / rochers
  ombrés, immeubles (fenêtres éclairées la nuit), mer et lac animés, yachts, garages et tribune peints.
* Ambiance : ombres de nuages qui dérivent, vignettage, traits de vitesse façon BD, caméra plus proche.
* Interface de course compacte (le rendu occupe l'essentiel de l'écran) ; accueil illustré avec monoplaces
  animées ; aperçu de livrée peint à la création d'écurie.

### Nouveautés V0.4
* Ambiance : tour de formation (bouton « Passer »), ralenti des dépassements / contacts / sorties (🎬 dans le fil),
  traces de pneus (blocages, sorties, envol), étincelles, course de nuit à Lumen (projecteurs, halos), numéros de
  course et sponsor principal sur les voitures, musique des menus synthétisée (coupable).
* Gestion : saison de 8 Grands Prix ; marché des transferts IA à l'intersaison (retraites, non-prolongations,
  recrutements) ; R&D en projets étalés sur plusieurs GP (coût, durée, chance de réussite, percées) ;
  personnel clé (ingénieur de course, chef mécanicien, directeur technique) avec marché et effets en jeu ; moral des
  pilotes (influence le rythme et les erreurs, les prolongations) ; académie de jeunes espoirs, pilote de réserve,
  forfaits pour maladie ; sponsors négociés (montants, durée 1–3 saisons, renouvellement) ; statistiques et palmarès.
* Sauvegardes : schéma 3, migration automatique des parties précédentes.

### Nouveautés V0.3
* Équilibrage : plus de dépassements (zones élargies, aspiration plus forte, pneus usés plus pénalisants),
  départs animés (qualité d'envol, premier tour plus agressif), règle des deux gommes sèches (20 s de pénalité),
  effet des réglages ramené à 0,2–0,6 % du temps au tour (contre 2,5–3 % d'écart entre voitures).
* Voiture de sécurité après un accident (ou une voiture arrêtée) : peloton regroupé, dépassements interdits,
  arrêts aux stands « gratuits », reprise au passage de la ligne.
* Météo évolutive : averses et séchage pendant la course, humidité de piste progressive, choix du bon moment pour
  passer en pneus pluie ou revenir aux slicks ; prévision approximative affichée pendant le week-end.
* Contacts lors des attaques ratées : aileron endommagé, crevaison, enquête et pénalité de 5 s.
* Consignes d'équipe : libre / tenir les positions / inverser.
* Radio de l'ingénieur : pneus, météo, voiture de sécurité, dégâts, pénalités, écarts avec les rivaux.
* Reprise instantanée d'une course sauvegardée (instantané complet de l'état, compatible avec les anciennes parties).

### Nouveautés V0.2
* Départ arrêté avec feux rouges (portique au-dessus de la ligne + panneau à l'écran, bips sonores).
* Décor enrichi : rails de sécurité, murs de pneus, panneaux publicitaires de vos sponsors, mécaniciens qui
  entourent la voiture pendant l'arrêt, gerbes d'eau et feu arrière clignotant sous la pluie, lac, sommets enneigés.
* Caméras : Suivre (zoom dynamique selon la vitesse), TV (réalisateur automatique qui suit les bagarres), Circuit ;
  zoom au pincement et à la molette.
* Son synthétisé (moteur de la voiture suivie, feux de départ, public), coupable dans la course et les paramètres.
* Gestion : 2 nouveaux circuits (calendrier de 5 GP), les écuries IA font évoluer leurs voitures pendant la saison,
  objectif de classement fixé par les actionnaires (prime ou perte de réputation en fin de saison).
* Performances : décor découpé en tronçons, seuls ceux à l'écran sont dessinés ; particules recyclées.
* Sauvegardes : schéma 2 avec migration automatique des parties V0.1 (aucune perte).

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
tests/        tests Vitest (moteur, carrière, gestion, long terme, sauvegardes)
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
