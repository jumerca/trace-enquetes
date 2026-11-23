# Illustrations à produire pour atteindre le niveau des concept arts

Le moteur affiche des **sprites isolés** (PNG transparents) regroupés en atlas ; chaque élément ci-dessous remplace une peinture procédurale de `src/render/paint.ts` sous la même clé d'atlas. Contraintes communes : projection isométrique 2:1 (case = 64×32 px à zoom 1, fournir en 2× : 128×64), lumière haut-gauche, ombre douce intégrée vers le bas-droite, point d'ancrage = sommet haut de l'emprise (bâtiments) ou pied (objets, personnages), palette des références (pierre calcaire chaude, tuiles terre cuite, volets bleu-gris, verts saturés).

## Priorité 1 — ce qui se voit le plus
- **Bâtiments** (×2 orientations ou avant/arrière symétrisables, enseignes séparées) : maison du domaine 3×3, grange 3×3, hangar ouvert 3×3, pressoir 2×2, fromagerie 2×2, moulin 2×2 (roue animée 4 images), boulangerie 2×2 (four avec lueur animée), boutique 2×2 (auvent rayé), accueil 2×2 (pergola, parasols), abri de l'enclos 1×1, 2 maisons de hameau.
- **Tuiles de sol raccordables** (4 variantes chacune, 4 saisons) : herbe, pré fleuri, sous-bois, cour pavée (+ 15 bordures), chemin de terre (16 raccords), route (16), eau/berges (16) + animation de reflets 4 images, champ de blé (6 stades), sol de verger, sol d'enclos.
- **Arbres** (4 saisons, 2–3 variantes) : chêne, châtaignier, noyer, bouleau, pin, cyprès, buisson ; **pommier** (floraison, feuillage, 4 niveaux de fruits, automne, hiver).

## Priorité 2 — vie du domaine
- **Personnages** (8 directions ou 4 + miroir) : marche 6–8 images, repos, actions métier (cueillir, traire, porter une caisse, presser, pétrir, encaisser) pour cultivateur, éleveur, artisan, vendeur ; 6 visiteurs dont 2 enfants.
- **Animaux** : chèvre (3 robes ; marche, broute, couchée), poule (picore), à ajouter : vache, mouton, cheval, canards sur l'étang.
- **Véhicules** (4 directions) : tracteur + remorque vide/chargée, camionnette du négociant, voitures de visiteurs.

## Priorité 3 — finitions
- Décor : puits, charrette, bottes de foin, caisses, tonneaux, pots fleuris, lavande (4 saisons), clôtures (15 raccords), rochers, fleurs.
- Effets : fumée (4 images), pluie/neige en particules texturées, lueurs nocturnes des fenêtres.
- Interface : pictogrammes des ressources (pommes, jus, lait, tomme, blé, farine, pain), cadre de panneau illustré, logo définitif vectorisé, écran-titre illustré (à partir de la référence 03, en séparant le logo).
