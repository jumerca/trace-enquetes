# Rapport — tranche verticale V0.1 (état au 23/11/2026)

Ce rapport distingue ce qui est **fait et testé** de ce qui est **partiel**, **non commencé** ou **non testé**. Aucune mesure sur téléphone réel n'a pu être faite dans cet environnement.

## Résultats des tests

| Suite | Commande | Résultat |
|---|---|---|
| TypeScript strict | `npm run build` (tsc --noEmit) | 0 erreur |
| Unitaires (Vitest) | `npm test` | **22/22** réussis |
| Bout en bout (Playwright, build de prod) | `npm run test:e2e` | **37/37** vérifications réussies (détail : `docs/captures/resultats-e2e.json`) |

Couverture des tests unitaires : reproductibilité à graine égale sur 30 jours (argent, statistiques, comptes identiques) ; boucle pommes→jus→boutique ; conservation de la matière (pommes récoltées = stock + pressées + vendues) ; salaires/entretien imputés et ventilés par activité ; aucune vente au négociant sans stock ; capacité de grange respectée ; ateliers à l'arrêt sans intrants ; constructions invalides refusées (eau, chemin, hors domaine, occupé, non constructible, fonds insuffisants) ; enclos→traite→fromage ; blé→moisson au tracteur→moulin avec retour du tracteur au hangar ; véhicules contournant le décor ; démolition ; chemins ; sauvegarde→restauration à l'identique puis suite identique ; refus d'un fichier étranger ou plus récent ; A* sans traversée d'obstacle ni coupe de coin ; aucun travailleur/visiteur sur une case de bâtiment ou d'eau pendant 2 jours simulés ; accessibilité des portes ; tri en profondeur (devant/derrière un bâtiment).

E2E (Chromium, rendu logiciel) : 6 boutons du menu et leurs fenêtres ; démarrage ; vitesses ×1/×2/×4 et pause ; glisser = déplacement ; molette = zoom ; **la caméra reste immobile pendant la simulation** ; fiche bâtiment au toucher ; construction refusée sur l'eau ; construction d'un champ et débit du coût ; ouverture des 6 panneaux ; embauche ; commande négociant (stock réservé) ; export JSON ; enregistrement, rechargement de page et chargement à l'identique ; **mobile Pixel 5 émulé** : pincement à deux doigts = zoom, toucher = fantôme sans construire, « Valider » = construction ; aucune erreur JavaScript.

## Performance (mesures réelles, à interpréter avec prudence)

- Coût JavaScript par image (simulation + préparation de la scène) : **≈ 0,24 ms** en moyenne (mesuré dans le test E2E).
- Images/seconde dans le conteneur de test : **≈ 10 i/s** — rendu WebGL **logiciel** (SwiftShader, sans GPU), donc **non représentatif**. Le goulot est la rastérisation logicielle, pas le code du jeu.
- **Objectif 30 i/s sur Android 4 Go : NON VALIDÉ** (aucun appareil disponible). À mesurer sur un téléphone réel : le jeu expose `window.__dt.measuredFps()` et `window.__dt.cpuMs()` (console à distance Chrome).
- Mesures de maîtrise prévues dans le code : sol en 36 chunks 16×16 masqués hors champ, décor/bâtiments masqués hors champ, assets regroupés en 2–3 pages d'atlas (≈ 16 Mo GPU chacune en qualité haute, 4× moins en qualité « Économie »), pas de rattrapage de simulation au-delà de 40 pas par image, réglage « Économie » (résolution 1×).

## Tableau d'avancement

| Élément | État | Test |
|---|---|---|
| Projet TS strict + Vite + PixiJS + React, PWA installable, service worker hors ligne | Fait | Build testé ; installation PWA non testée sur appareil |
| Sauvegarde IndexedDB, schéma versionné (migrations), export/import JSON, autosauvegarde quotidienne et à la mise en arrière-plan | Fait | Testé (unitaire + E2E) |
| Carte 96×96 Corrèze/Périgord : rivière, étang, bois, prés, routes courbes, pont, cour, parking, hameau d'arrière-plan | Fait | Testé visuellement (captures) |
| Relief illustratif (collines, dénivelés) | Non commencé | — |
| Caméra : pan, zoom molette/pincement, bornes, recentrage manuel, jamais de saut automatique | Fait | Testé (E2E) |
| Verger → pressoir → jus → boutique, stocks, coûts, profits vérifiables | Fait | Testé |
| Chèvres → lait → fromagerie → tomme → boutique | Fait | Testé |
| Blé → moisson (tracteur + remorque ou à la main) → moulin → farine → boulangerie → pain | Fait | Testé jusqu'à la farine (unitaire) ; pain : logique identique, non testé spécifiquement |
| Accueil des visiteurs (arrivée au parking, visite payante, achats en boutique, satisfaction, réputation) | Fait | Testé indirectement (ventes, visiteurs) |
| 11 bâtiments constructibles + maison (12 types) | Fait | Construction/refus testés |
| Placement : fantôme vert/rouge, porte sur chemin, orientation (2 sens), défrichage | Fait | Testé |
| Chemins tracés par le joueur, achat de terrains (lots 16×16) | Fait | Chemins testés ; achat de lots non testé en E2E |
| Personnel : 4 rôles, embauche/licenciement, horaires, salaires ventilés par activité | Fait | Testé |
| Fatigue, compétences, saisonniers | Non commencé | — |
| PNJ sur A* (travailleurs, visiteurs, tracteur, camionnette du négociant), pas de traversée d'obstacles | Fait | Testé |
| Négociant (vente en gros, camionnette qui vient charger) | Fait | Testé |
| 4 saisons (végétation, vergers en fleurs/fruits, champs, givre), météo quotidienne pilotant rendements et visites, jour/nuit | Fait | Vérifié visuellement (captures été/automne/hiver) |
| Vitesses ×1/×2/×4, pause | Fait | Testé |
| Tutoriel 5 objectifs (récolter → produire → transformer → vendre → investir) | Fait | Progression observée en jeu ; pas de test dédié |
| Interface : menu (Nouvelle partie, Continuer, Charger, Réglages, Crédits, Installer), barre d'état, 6 panneaux repliables, fiches, journal | Fait | Testé (E2E) |
| Identité : logo original, icônes PWA 32/180/192/512/masquable | Fait | — |
| Animaux animés : chèvres, poules | Fait (animation 2 images) | Visuel |
| Animations de personnages | Partiel : marche 3 poses, travail 2 poses, charge portée ; pas de poses par métier | Visuel |
| Sons et musique | Non commencé | — |
| Emprunts, événements, marché, gîtes, autres régions | Non commencé (hors V0.1) | — |
| 30 i/s sur Android 4 Go | Non validé | Non testé (pas d'appareil) |

## Limites honnêtes

1. **Niveau graphique.** Tous les assets sont **originaux et peints par code** (Canvas 2D : pierre en moellons, tuiles canal, volets, glycine, arbres en grappes, ombres douces) dans une perspective et une lumière communes. Le rendu est cohérent et lisible, mais **n'atteint pas** la richesse des concept arts fournis (densité de détails, matières peintes, personnages expressifs). C'est un remplacement provisoire assumé ; la liste des illustrations à produire est dans `ASSETS_A_PRODUIRE.md`. Le moteur charge des sprites isolés via un atlas : remplacer une peinture procédurale par un PNG ne demande que d'ajouter la texture sous la même clé.
2. **Personnages petits et peu détaillés** à zoom normal ; animations simples.
3. Les routes d'origine sont dessinées en courbes lissées par-dessus la grille ; les chemins tracés par le joueur restent en tuiles raccordables.
4. Les bâtiments n'ont que deux orientations (porte côté avant-gauche ou avant-droite).
5. Les visiteurs « apparaissent » à leurs voitures garées au parking (pas d'animation d'arrivée en voiture).
6. Équilibrage économique : la seule filière pomme est proche de l'équilibre en saison et déficitaire en hiver/printemps (pas de pommes) ; la diversification est nécessaire. Valeurs à affiner après essais.
