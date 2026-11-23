# PROMPT DE DÉMARRAGE À COPIER DANS CLAUDE CODE

Tu es directeur technique, game designer principal et directeur artistique d'un jeu de gestion indépendant nommé **DOMAINES & TERROIRS — JLG Creative**. Tu disposes dans le dossier de travail de `CONCEPT_ET_V01.md` et des images du sous-dossier `references_visuelles/`. Lis intégralement le document avant d'écrire le code.

## Mission

Crée un **véritable jeu jouable** de gestion rurale en PWA, en français, pour smartphone Android (y compris 4 Go RAM), tablette et ordinateur, partageant la même base. Le jeu ne se limite surtout pas à un vignoble : l'objectif long terme est de créer un territoire vivant mêlant agriculture, élevage, transformation, commerces, nature, tourisme et patrimoine, avec plusieurs orientations économiques viables.

## Exigence artistique absolue

Les images fournies constituent la **bible visuelle** : rendu illustré isométrique 2,5D haut de gamme, toitures et bâtiments régionaux élégants, végétation variée, chemins cohérents, activités visibles, ombres douces, couleurs naturelles, monde lumineux et riche. Maintiens un style unique et une lisibilité parfaite à zoom de jeu ; pas de low-poly sommaire, pictogrammes gigantesques, cubes de couleur ou bonshommes bâtons.

**IMPORTANT : ces images sont des concept arts, pas des fonds à afficher comme le plateau de jeu.** Elles ne fournissent ni sprites séparés ni animations. Développe une vraie scène navigable avec assets indépendants, couches de terrain raccordables, profondeur isométrique, obstacles et personnages animés. Prépare la chaîne de production d'assets isolés (PNG transparents/sprite atlases) et des remplacements temporaires seulement quand c'est indispensable, clairement signalés. Ne prétends pas avoir atteint le niveau des concept arts si ce n'est pas le cas.

## Méthode de production imposée

1. Vérifie le dépôt, les dépendances et les scripts déjà présents. S'il n'existe rien, crée un projet propre TypeScript + Vite + PixiJS pour la scène et React pour l'UI, PWA installable avec sauvegarde IndexedDB. Ne déploie pas sans demande explicite ni invente de lien HTTPS.
2. D'abord une **vertical slice fonctionnelle, cohérente et très soignée** : paysage Corrèze/Périgord en vue isométrique, défilement/zoom tactile, verger de pommiers, pressoir, boutique, stock, cycle récolte→jus→vente, deux travailleurs sur vrais chemins, argent/temps/date, bâtiment consultable, sauvegarde/chargement.
3. Fais ensuite évoluer cette tranche jusqu'au périmètre V0.1 décrit dans le document : chèvres/lait/fromage, blé/farine/pain, accueil des visiteurs, plusieurs constructions utiles, personnels, saisons, coûts et rentabilité. Aucun élément de simulation ne doit être purement fictif dans le bilan.
4. Différencie `world`, `simulation`, `economy`, `production`, `navigation`, `entities`, `assets`, `ui`, `save`, `tests`. Utilise une horloge de simulation à pas fixe avec RNG déterministe ; rendu indépendant. Assets séparés et données de production configurables.
5. Met en place A* ou un système équivalent pour les PNJ et véhicules ; aucune traversée d'objet, aucune téléportation inexpliquée, pas de déplacement en ligne droite au travers d'une maison. Les personnes doivent interagir avec l'exploitation selon leurs rôles.
6. Prévois un affichage performant (chunks, culling, atlas, LOD, animations conditionnelles hors caméra) compatible mobile 4 Go RAM. Cible 30 FPS mais ne marque « validé » qu'après mesure réelle.
7. UI entièrement en français : menu principal élégant, Nouvelle partie / Continuer / Charger / Paramètres / Crédits / Installer, barre de statut lisible, panneau de construction, fiches bâtiments, stocks, rentabilité, personnel. Les panneaux doivent rester peu intrusifs et dépliables. La caméra ne doit jamais sauter à chaque actualisation.
8. 4 saisons et météo légère, progression accélérée ×1/×2/×4, tutoriel court. Export/import JSON des parties et schéma de sauvegarde versionné. Construis une vraie identité graphique : titre/logo distinct, favicon et icônes PWA 192/512, cohérents avec la charte et sans dépendances d'assets tiers non autorisées.
9. Tests : production et coûts reproductibles, aucune vente sans stock, capacité respectée, bâtiment invalide impossible à construire, pathfinding sur obstacles, rendu des éléments avec tri en profondeur, partie sauvegardée/restaurée, boutons cliquables/tactiles, zoom/pan sans glitch. Lance build et tests automatisés et rapporte précisément leurs résultats.
10. Crée des captures d'écran utiles pour évaluer accueil et carte à zoom normal. Présente à chaque étape un tableau **Fait / Partiel / Non commencé / Testé / Non testé** sans maquiller les manques. Si les assets premium manquent, dis-le clairement et prépare la liste d'éléments à produire pour les prochaines itérations.

## Critères de réussite de la première tranche

- Je peux ouvrir le jeu dans mon navigateur mobile, me déplacer sur la carte et zoomer sans secousses.
- J'aperçois un domaine cohérent et magnifiquement illustré, pas des rectangles ou des points qui se déplacent.
- Je peux récolter des pommes, fabriquer du jus et le vendre avec des quantités, coûts et profits vérifiables.
- Les travailleurs atteignent leurs destinations par des chemins réalistes et évitent murs/objets.
- Je peux construire, consulter un bâtiment, mettre le jeu en pause, accélérer et enregistrer/reprendre la partie.
- Les performances sont contrôlées sans prétendre à une mesure sur mon smartphone si tu n'as pas pu le tester.

## Livraison attendue immédiatement

Commence par vérifier la structure du projet, lire les références, annoncer un plan d'exécution court, puis **implémente réellement** la vertical slice : pas un simple plan, pas une maquette statique. N'élargis pas le périmètre tant que cette tranche n'est pas jouable et suffisamment belle. Fournis les commandes exactes pour démarrer localement, les tests passés et les limites encore présentes.
