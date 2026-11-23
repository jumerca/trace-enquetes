# DOMAINES & TERROIRS — JLG Creative
## Document de conception — vision de long terme et version V0.1

**Promesse :** bâtir, exploiter et faire vivre un territoire rural français, de la petite ferme au domaine diversifié mêlant agriculture, élevage, transformation, tourisme, nature et patrimoine. Jeu de gestion profond, visuellement chaleureux et vivant, en 2,5D isométrique, jouable au tactile et à la souris.

## 1. Les piliers

1. **Un monde vivant :** les actions des habitants, animaux, ouvriers, véhicules et visiteurs ont un sens dans la simulation ; ils se déplacent en respectant les chemins et obstacles.
2. **Production et transformation :** sols, climat, saisons, récolte, stocks, recettes, main-d'œuvre, logistique et vente.
3. **Économie réelle de jeu :** prix variables mais explicables, charges fixes, salaires, entretien, investissements, emprunts possibles plus tard, marges par activité.
4. **Territoire et identité :** achat de parcelles, vocation agricole, forestière, paysagère ou touristique ; villages et artisanat ; diversité régionale.
5. **Patrimoine et esthétique :** architecture rurale française illustrée, lisibilité au zoom de jeu, cycle des saisons, densité visuelle sans surcharge.
6. **Liberté d'exploitation :** vignoble, polyculture, élevage, agritourisme, domaine équestre, gastronomie, ou combinaison ; chaque spécialisation peut être viable.

## 2. Activités complètes visées à terme (ne pas tout coder en V0.1)

- Grandes cultures : blé, orge, maïs, tournesol, luzerne, prairie, oléagineux.
- Maraîchage et horticulture : potagers, serres, légumes, fleurs, irrigation.
- Vergers et vignes : pommes, poires, prunes, noix, raisin ; récoltes et saisons.
- Élevages : bovins, ovins, caprins, volailles, porcins, équins, apiculture.
- Sylviculture, étangs, biodiversité, protection des sols et gestion de l'eau.
- Transformation : moulin, boulangerie, fromagerie, conserverie, presse à jus, cave, miellerie, ateliers artisanaux.
- Commercialisation : boutique, marché, livraisons, restaurateurs, grossistes, circuits courts, commandes saisonnières.
- Accueil : gîtes, chambres d'hôtes, camping nature, restaurant, ferme pédagogique, équitation, sentiers, ateliers, événements.
- Gestion des personnels : recrutements, missions, horaires, compétences, fatigue, salaire, saisonniers.
- Régions futures : Corrèze/Périgord, Provence, Normandie/Bretagne, moyenne montagne/Alpes avec architecture, flore, productions et climat distincts.

## 3. Boucle de jeu

Observer son domaine → choisir ses objectifs → acheter/aménager une parcelle → construire et relier → affecter employés et équipements → produire/récolter → transformer/acheminer → vendre et accueillir → analyser marges, satisfaction, réputation et environnement → agrandir.

Toutes les ressources sont comptabilisées. Une vente ne peut pas avoir lieu sans stock ; une transformation ne peut pas produire sans intrants, capacité et temps ; les salaires et frais sont déduits ; les déplacements sont cohérents avec la géographie.

## 4. Direction artistique figée

- 2,5D isométrique en illustration numérique haut de gamme, élégante, colorée, nette et détaillée. Pas de pixel art, low-poly brut, générateurs de rectangles, sprites bâtons, 3D photoréaliste disparate, bruit ou grain excessif.
- Campagne française chaleureuse : pierres calcaires, toitures tuiles/ardoises suivant région, bois, potagers, haies, bosquets, cour de ferme et chemins ruraux.
- Rendus cohérents : même point de vue, hauteur de caméra, échelle, contraste, ombres et éclairage sur tous les assets.
- Pour le jeu réel, **ne pas poser les images panoramiques comme fond de carte** : elles servent de bible graphique ; créer bâtiments et végétation séparés, sprites transparents, atlas de personnages/animaux, éléments de sol et tuiles raccordables.
- Adapter la densité au zoom normal ; effets discrets et saisonnalité marquée ; limiter draw calls et textures en mémoire pour Android 4 Go RAM.
- Références jointes : 01 panorama (terrain), 02 village/activités (densité et personnages), 03 identité/couverture (ambiance et marque). Le logo présent dans l'image est une piste illustrative à refaire comme véritable asset séparé.

## 5. V0.1 — « Le domaine prend vie » : périmètre faisable

### Carte et caméra

- 1 paysage de type Corrèze/Périgord ; zone jouable d'environ 96×96 cellules logiques, extensible, avec relief illustratif, rivière, bois, chemins, champs, cour de ferme, verger, pré et petit hameau d'arrière-plan. Diviser le rendu en chunks de 16×16 ; ne dessiner/animer finement que le visible.
- Pan au doigt/souris, zoom progressif, bornes de caméra, recentrage manuel. Ne jamais déplacer automatiquement la caméra à chaque mise à jour.
- Placement de bâtiments sur sol compatible et accès via routes/chemins. Prévisualisation verte/rouge, orientation lorsque pertinente, collisions et profondeur correctes.

### Contenu jouable

- 4 activités pleinement bouclées : verger de pommes → pressoir → jus → boutique ; prairie/caprins → lait → fromagerie → fromage → boutique ; blé → moulin → farine → boulangerie → pain → boutique ; accueil visiteurs → boutique et visites.
- 10–14 types de bâtiments fonctionnels, dont maison de domaine, hangar, enclos caprin, grange/stockage, verger, parcelle de blé, pressoir, fromagerie, moulin, boulangerie, boutique et accueil.
- 3 à 5 cultures ou types de parcelles visuellement différents, 2 animaux réellement animés au minimum, 1 tracteur et une remorque ou camionnette suivant cohérence.
- 12 à 20 personnages maximum à l'écran, avec rôles et itinéraires (cultivateur, éleveur, transformateur, vendeur, visiteur), pas des silhouettes qui flottent ; montée en charge par instanciation.
- Production à l'heure/jour avec saisonnalité ; stocks par ressource et capacité, tâches, salaire et frais ; prix achat/vente configurables ; bilan des activités ; sauvegarde et chargement.
- Quatre saisons distinctes visuellement au moins sur la végétation et les cultures, météo simple pilotant rendement, pas de simulation climatique prétendument scientifique.

### Interactions et UI

- Accueil : Nouvelle partie, Continuer, Charger, Réglages, Crédits, Installer si disponible.
- En jeu : barre de statut (argent, date/saison, météo, satisfaction, réputation), boutons Gestion, Construire, Production, Personnel, Commerce, Territoire ; panneau rétractable ; infobulle bâtiment ; pause et vitesses ×1/×2/×4.
- UI tactile : gros contrôles, aucun panneau masquant durablement la carte, gestes sans conflit avec placement, respect des safe areas.
- Tutoriel guidé de 5 objectifs : récolter → produire → transformer → vendre → investir.

## 6. Architecture technique préconisée

TypeScript strict + Vite ; PixiJS pour une scène isométrique 2,5D avec tri de profondeur et atlases, React pour les interfaces hors scène ; PWA installable et hors-ligne pour données et assets ; sauvegardes IndexedDB avec version de schéma, export/import JSON ; tests unitaires Vitest et tests E2E Playwright. Choisir une version compatible des dépendances, créer la base de projet puis expliquer les commandes à l'utilisateur.

Séparer simulation pure (état, règles, RNG seed, économie, tâches), rendu, données de contenu (JSON/TS déclaratif), IA/navigation, gestion des entrées, UI et sauvegarde. Tick à pas fixe découplé du FPS ; économie déterministe à seed donnée ; règles de production testables hors interface. Pas de services payants, de clés API ni de dépendance Internet pour jouer.

## 7. Performance et qualité — critères de validation

- Objectif de **30 FPS** sur téléphone Android 4 Go de RAM représentatif (à vérifier sur appareil réel, ne pas proclamer un résultat non mesuré) ; >45 FPS sur un PC moyen à titre indicatif.
- Pas de traversée des maisons, clôtures ou parcelles infranchissables ; A* ou grille de navigation valide ; distance et capacité des chemins considérées.
- Le tracteur ne doit pas traverser bâtiments et arbres ; comportements de pause, demi-tour, manœuvre à simplifier de manière plausible.
- Chaque action de l'interface doit fonctionner. Pas de menu inerte, pas d'information inventée, pas de fonctionnalités « décoratives » présentées comme implémentées.
- Débits, stocks, salaires et marges cohérents, résultats reproductibles sur 30 jours simulés ; tests sur insuffisance de matières, de personnel et de capacité.
- Sauvegarder, recharger et retrouver argent, temps, parcelles, constructions, travailleurs, stocks, météo/saison, tâches.
- Vérifier visuellement à zoom normal et sur petite largeur mobile. Captures avant/après et compte rendu de tests, sans prétendre avoir validé sur un appareil indisponible.

## 8. Ordre de fabrication recommandé

**Étape A — Vertical slice jouable :** carte réduite mais magnifique, 1 cycle complet pommes→jus→boutique, 2 bâtiments fonctionnels + pressoir + verger, 2 PNJ, navigation et sauvegarde ; preuve que style, tactilité et logique fonctionnent.

**Étape B — V0.1 :** autres chaînes, aménagement et bâtiments, animations, personnels, saisons, finances, tutoriel, optimisation.

**Étape C — Extension :** élevages avancés, activités de plein air, tourisme et événements, plusieurs régions, rivières/reliefs et limites plus grandes, sans sacrifier la V0.1.

## 9. Risques à traiter explicitement

- Les panoramas conceptuels sont superbes mais non exploitables tels quels pour un jeu animé en caméra libre : prévoir une production **d'assets isolés**.
- Ne pas générer un monde géant vide : préparer un pipeline de chunks et un monde compact et dense avant extension.
- Ne pas promettre animations réalistes à partir de simples translations de sprites : prévoir frames/poses et ombres cohérentes.
- Ne pas ajouter d'innombrables menus avant d'avoir une chaîne d'activité réellement jouable.
- Éviter tout fichier de marque déposée ou asset tiers sans licence vérifiée ; produire une identité originale JLG Creative.
