# Rapport — V0.3 (état au 23/11/2026)

Ce rapport distingue ce qui est **fait et testé** de ce qui est **partiel**, **non commencé** ou **non testé**. Aucune mesure sur téléphone réel n'a pu être faite dans cet environnement.

## Résultats des tests

| Suite | Commande | Résultat |
|---|---|---|
| TypeScript strict | `npm run build` | 0 erreur |
| Unitaires (Vitest) | `npm test` | **46/46** réussis |
| Bout en bout (Playwright, build de prod) | `npm run test:e2e` | **46/46** vérifications (détail : `docs/captures/resultats-e2e.json`) |
| Performance, processeur bridé ×4 | `node scripts/perf.cjs <url> 4` | voir ci-dessous |

Unitaires : chacune des **8 régions** démarre jouable (bâtiments autorisés et accessibles, route du bord de carte au parking, récolte, transformation et visiteurs dès 3 jours) ; la mer existe au bord de mer, la montagne a > 3× le relief de la Beauce ; productions refusées hors région ; reproductibilité sur 30 jours ; conservation de la matière ; salaires ventilés ; négociant (aucune vente sans stock, camionnette qui vient charger) ; capacité de grange ; ateliers à l'arrêt sans intrants ; constructions invalides ; élevage caprin → fromage ; **blé mécanisé : moissonneuse → grange, puis labour et semis au tracteur, engins rentrés au garage** ; champ sans engin travaillé à la main ; **visiteurs en voiture : arrivée, stationnement, départ** ; véhicules contournant le décor et restant sur les voies ; démolition, chemins, achat de terrain contigu ; sauvegarde/restauration à l'identique (relief compris) ; refus des fichiers étrangers, plus récents ou de la V0.1 ; A* ; personne ne traverse bâtiment, eau ou pente infranchissable (2 jours en montagne) ; cohérence des données ; tri en profondeur.

E2E (Chromium, rendu logiciel) : menu et fenêtres, **choix de la région**, carte 256×256, vitesses et pause, déplacement et zoom, caméra immobile pendant la simulation, fiche bâtiment, refus sur l'eau, construction d'un champ, panneaux, embauche, négociant, export JSON, enregistrement et rechargement à l'identique, **lancement des 7 autres régions avec la planche de véhicules chargée**, mobile Pixel 5 émulé (pincement, placement tactile + « Valider »), aucune erreur JavaScript.

## Performance (mesures réelles, à interpréter avec prudence)

Mesure du coût JavaScript par image avec le **processeur bridé ×4** (approximation d'un téléphone d'entrée de gamme), écran 412×915, sur les zones les plus chargées :

| Région | Zoom 1 | Zoom 0,6 | Zoom 0,35 (dézoom max) |
|---|---|---|---|
| Est (forêts denses) | 3,9 ms | 2,6 ms | 2,3 ms |
| Montagne | 3,8 ms | 5,7 ms | 2,8 ms |
| Limousin | 2,4 ms | 2,4 ms | 4,5 ms |

Budget à 30 i/s : 33 ms. Des pics isolés (jusqu'à ~75 ms bridé) subsistent lors de grands déplacements de caméra ; ils sont étalés (création des objets limitée à 2 chunks par image).

V0.3 : **niveau de détail** (petit décor masqué sous le zoom 0,62, forêts éclaircies sous 0,42 : jusqu'à 3,7× moins d'objets), **qualité adaptative** (si l'affichage reste sous 24 i/s pendant 4 s, le décor est allégé automatiquement, réglable), **compteur de performances** activable dans Réglages (images/s, ms par image, objets affichés).

- **30 i/s sur Android 4 Go : toujours NON VALIDÉ sur un vrai téléphone** — le coût GPU (remplissage, textures) ne peut pas être mesuré ici (rendu logiciel). Activez « Afficher les performances » dans Réglages pour lire la valeur sur votre appareil.
- Mémoire GPU des planches : véhicules 3 pages, personnages/animaux 2 pages, plus 3 à 4 pages d'atlas peints (≈ 16 Mo par page de 2048², moitié moins en qualité « Économie » pour les atlas peints).

## Tableau d'avancement

| Élément | État | Test |
|---|---|---|
| Choix de la région à la nouvelle partie (8 régions : relief, climat, architecture, essences, productions, tourisme, départ) | Fait | Testé |
| Carte 256×256 avec relief par sommet, ombrage des pentes, neige d'altitude/hivernale | Fait | Testé (unitaire) + visuel |
| Mer, plage, falaises, phare, bateaux (bord de mer) ; massif, estives, rochers (montagne) ; rivières, étangs, villages avec église, champs des fermes voisines, bocage | Fait | Visuel (captures) |
| Terrassement automatique des pentes à la construction (coût) | Fait | Indirect |
| 9 cultures, 6 vergers/vignes, 7 élevages, 10 ateliers (recettes multiples), 38 ressources | Fait | Testé (données + chaînes principales) |
| Labour → semis → pousse → récolte ; tracteur (charrue, semoir, remorque), moissonneuse-batteuse ; travail à la main sans engin | Fait | Testé |
| Véhicules 3D toon pré-cuits en 8 directions, roues animées : tracteurs rouge/vert/bleu × 9 outils (remorques, charrue, épandeur, semoir, pulvérisateur), moissonneuse, vendangeuse, bétaillère, camionnette, 3 voitures | Fait | Visuel + E2E (chargement) |
| Épandage (+15 %) et traitement au pulvérisateur (+10 %) ; vendange mécanique ; bétaillère pour les animaux vendus ; livrée des tracteurs selon la région | Fait | Testé |
| Routes empierrées et ponts construits par le joueur | Fait | Testé (unitaire + E2E) |
| Personnages et animaux 3D toon pré-cuits en 8 directions (marche, travail, broutage) | Fait | Visuel + E2E (chargement) |
| Reprise des sauvegardes V0.1 (domaine réinstallé en Limousin : argent, stocks, personnel, date, statistiques ; bâtiments replacés ou remboursés) | Fait | Testé |
| Visiteurs arrivant en voiture, parking, départ | Fait | Testé |
| Contrats négociant (surplus vendus chaque matin, seuils réglables) | Fait | Testé indirectement (économie) |
| Économie : ferme de départ à l'équilibre ou bénéficiaire dans les 8 régions sur 4 semaines hiver compris (de +65 € à +3 300 €) ; coopérative quand la grange déborde ; contrats négociant « automatiques » qui gardent les matières des ateliers | Fait | Testé (régression par région) |
| Autres engins (arracheuse dédiée, ensileuse, faneuse, presse à balles) | Non commencé (l'arrachage utilise tracteur + remorque) | — |
| Carte encore plus vaste (512²) | Non commencé | — |
| Fatigue/compétences du personnel, emprunts, événements, sons | Non commencé | — |
| 30 i/s sur Android 4 Go | Non validé | Non testé |

## Limites honnêtes

1. **Graphismes** : véhicules, personnages et animaux sont désormais des modèles 3D cohérents avec la caméra. Les **bâtiments et les arbres restent peints par code** — cohérents mais en deçà des concept arts. Voir `ASSETS_A_PRODUIRE.md`.
2. Le relief est continu (collines douces) : pas de falaises verticales franches ni de tunnels ; l'eau est plane par case (petits paliers sur les rivières de montagne).
3. Les cultures des fermes voisines sont décoratives (elles suivent seulement la saison).
4. Une sauvegarde V0.1 reprise est réinstallée sur la nouvelle carte : la disposition exacte des bâtiments n'est pas conservée.
5. Les ruches restent dessinées en 2D.
