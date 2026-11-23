# Rapport — V0.5 (état au 23/11/2026)

## Nouveautés V0.5 (faites et testées)

- **Sol continu** : une carte des couleurs moyennes du sol (une valeur par case, floutée sur ±2 cases) est fondue dans le shader avec des bords ondulés (bruit), plus des variations naturelles à grande échelle ; le quadrillage des tuiles a disparu (fond de tuile uni, couleurs non pré-multipliées). Les champs, cours et chemins gardent des bords nets.
- **Eau** : isoligne lissée d'un masque d'eau (net + flouté) : rives arrondies, eau plus profonde au centre, reflets et ondulations animés, écume, berges humides ; plus de « dents » noires aux angles.
- **Arbres et vergers 3D** pour les 4 saisons : 13 essences du paysage, 11 vergers × 4 stades de fruits (464 images, planche WebP de 0,7 Mo). Les vergers ajoutés en V0.4 (cerisier, abricotier, poirier, châtaignier, truffier) ont enfin leurs propres arbres.
- **Lisières** : arbres avancés et buissons hors de la forêt, trouées en bordure.
- Les chemins traversant une cour sont dessinés en tronçons lissés (plus de chemins « en escalier »).
- Mesures (processeur bridé ×4, rendu logiciel) : 4 à 7 ms de calcul JS par image ; bascule de saison 9 ms ; aucun pic après le chargement (le flou de la carte est limité à la zone modifiée et fait au chargement).
- Limites : le shader du sol est plus coûteux pour la carte graphique (6 lectures de texture et du bruit par pixel) — non mesuré sur un vrai téléphone ; les cultures dans les champs restent dessinées en 2D (le lin, le houblon, les fraises et les melons empruntent l'aspect de cultures proches).
- Captures : `docs/captures/v05-ferme-ete.jpg`, `v05-hiver-montagne.jpg`, `v05-provence-lac.jpg`, `v05-bord-de-mer.jpg`.


## Nouveautés V0.4.1 (faites et testées)

- Routes goudronnées (accotements, rives, axe pointillé), parking goudronné à 14 places marquées et panneau « P », abords dégagés ; chemins de terre (ornières, bande d'herbe) vers une dizaine de fermes voisines et entre elles ; tracés lissés (plus d'escaliers). Capture : `docs/captures/v041-parking-routes.jpg`.
- Modèles 3D des engins et véhicules retravaillés (tracteur, remorque, moissonneuse, voitures, fourgon, bétaillère).
- Tests unitaires : **59/59** (8 nouveaux, un par région : parking accessible en voiture depuis l'entrée de la carte, au moins 10 places, chemins de terre présents). E2E : 46/46.
- Limite : les parties sauvegardées avant la V0.4.1 gardent leur ancienne carte (petit parking, pas de fermes voisines) ; le nouveau dessin des routes s'y applique quand même.


## Nouveautés V0.4 (faites et testées)

- **Bâtiments 3D par région** : chaque bâtiment (≈ 45 types, deux orientations) est modélisé en 3D et cuit en sprites dans l'architecture de la région ; planches WebP d'environ 1 Mo par région, téléchargées seulement pour la région jouée. Calque « neige » des toits affiché en hiver selon l'altitude. Repli dessiné si la planche ne se charge pas.
- **Entrées et sorties visibles** : un ouvrier qui dépose à la grange, travaille à l'atelier, tient la boutique ou rentre à la maison disparaît par la porte et ressort ensuite ; les touristes entrent dans la boutique, l'accueil, la ferme pédagogique, l'auberge et le gîte (où ils passent la nuit).
- **Personnages** retravaillés (visage, mains, coiffures, ceinture, bottes, lunettes, barbe, gilet, chapeaux) et nouveaux profils : saisonnier, guide, enfants, randonneur, vacancière. **Animaux** : cheval, âne, oie, lapin, vache limousine (8 directions, marche et pâture).
- **Climat** : ombres de nuages, brume du matin (plus dense en automne et en hiver), feuilles mortes en automne, éclairs par orage.
- **Contenu et simulation** : nouvelles cultures, vergers, élevages, ateliers ; gîte et camping (nuitées selon réputation, saison, tourisme), ferme-auberge (repas à 24 € avec 3 produits du stock), visites payantes (balade à cheval, ânes, pêche), ferme pédagogique, navette touristique le week-end, utilitaire de marché tous les 3 jours, quad (éleveur plus rapide), chargeur télescopique, silo (grains seulement), chambre froide, irrigation (+25 % de croissance), panneaux solaires, foin des prairies qui réduit le coût d'alimentation des herbivores ; faneuse et arracheuse attelées au tracteur ; rôles saisonnier (récolte à la main) et guide (accueil, satisfaction).


Ce rapport distingue ce qui est **fait et testé** de ce qui est **partiel**, **non commencé** ou **non testé**. Aucune mesure sur téléphone réel n'a pu être faite dans cet environnement.

## Résultats des tests

| Suite | Commande | Résultat |
|---|---|---|
| TypeScript strict | `npm run build` | 0 erreur |
| Unitaires (Vitest) | `npm test` | **51/51** réussis (dont 6 nouveaux : silo, entrées dans les bâtiments, gîte/auberge/navette/centre équestre/ferme pédagogique, marché, foin) |
| Bout en bout (Playwright, build de prod) | `npm run test:e2e` | **46/46** vérifications (détail : `docs/captures/resultats-e2e.json`) |
| Performance, processeur bridé ×4 | `node scripts/perf.cjs <url> 4` | voir ci-dessous |

Unitaires : chacune des **8 régions** démarre jouable (bâtiments autorisés et accessibles, route du bord de carte au parking, récolte, transformation et visiteurs dès 3 jours) ; la mer existe au bord de mer, la montagne a > 3× le relief de la Beauce ; productions refusées hors région ; reproductibilité sur 30 jours ; conservation de la matière ; salaires ventilés ; négociant (aucune vente sans stock, camionnette qui vient charger) ; capacité de grange ; ateliers à l'arrêt sans intrants ; constructions invalides ; élevage caprin → fromage ; **blé mécanisé : moissonneuse → grange, puis labour et semis au tracteur, engins rentrés au garage** ; champ sans engin travaillé à la main ; **visiteurs en voiture : arrivée, stationnement, départ** ; véhicules contournant le décor et restant sur les voies ; démolition, chemins, achat de terrain contigu ; sauvegarde/restauration à l'identique (relief compris) ; refus des fichiers étrangers, plus récents ou de la V0.1 ; A* ; personne ne traverse bâtiment, eau ou pente infranchissable (2 jours en montagne) ; cohérence des données ; tri en profondeur.

E2E (Chromium, rendu logiciel) : menu et fenêtres, **choix de la région**, carte 256×256, vitesses et pause, déplacement et zoom, caméra immobile pendant la simulation, fiche bâtiment, refus sur l'eau, construction d'un champ, panneaux, embauche, négociant, export JSON, enregistrement et rechargement à l'identique, **lancement des 7 autres régions avec la planche de véhicules chargée**, mobile Pixel 5 émulé (pincement, placement tactile + « Valider »), aucune erreur JavaScript.

## Performance (mesures réelles, à interpréter avec prudence)

Toutes les mesures ci-dessous sont faites avec le **processeur bridé ×4** (approximation d'un téléphone d'entrée de gamme), écran 412×915, rendu WebGL logiciel. Outils : `scripts/saccades.cjs` (glissements continus de la caméra), `scripts/pics.cjs` (saison, construction), `scripts/perf.cjs`.

**Glissements de caméra** (≈ 1 900 images, montagne et Est, zooms 1 / 0,6 / 0,4) :

| | médiane | 95 % | 99 % | pire |
|---|---|---|---|---|
| Mise à jour (simulation + scène) | 1,1 – 1,7 ms | 3,6 – 5,4 ms | 4,9 – 10,4 ms | 37 ms (une image, au repositionnement) |
| Préparation du rendu (tri, lots) | 3 – 5 ms | 6 – 10 ms | 8,5 – 13 ms | 19 ms |

**1 image sur ≈ 1 900 dépasse 33 ms** (budget à 30 i/s), contre des pics répétés jusqu'à 75 ms auparavant.

**À-coups ponctuels supprimés** (mesures non bridées ; ×4 environ sur téléphone modeste) :

| Événement | Avant | Après |
|---|---|---|
| Changement de saison | 276 ms d'un bloc | 6 ms à la bascule ; préparation en tâche de fond pendant le dernier jour, pire image 7,6 ms |
| Construction d'un bâtiment, chemin, achat de terrain | 40 ms | 1 à 3 ms (seule la zone modifiée est recalculée) |
| Premier affichage d'une planche (véhicules, personnages) | envoi au GPU au premier usage | planches envoyées dès le chargement |
| Arrivée/départ de visiteurs, défilement | créations et retraits de sprites | sprites recyclés, retraits supprimés ; trajets fréquents en cache |

Autres mesures : niveau de détail au dézoom, qualité adaptative, compteur de performances dans Réglages.

- **30 i/s sur Android 4 Go : toujours NON VALIDÉ sur un vrai téléphone** — le coût GPU réel (remplissage, envoi des textures) ne se mesure pas ici. Activez « Afficher les performances » dans Réglages pour lire la valeur sur votre appareil.
- Mémoire GPU : véhicules 3 pages, personnages/animaux 2 pages, plus 3 à 4 pages d'atlas peints ; pendant le dernier jour d'une saison, la saison suivante est préparée en plus (≈ +50 Mo de mémoire vive le temps de la bascule).

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

1. **Graphismes** : véhicules, bâtiments, personnages et animaux sont des modèles 3D cohérents avec la caméra ; les **arbres, cultures et le décor des villages voisins (église, phare) restent peints par code**. Les portes ne s'ouvrent pas : on voit la personne passer le seuil et s'effacer. L'étang ne gèle pas en hiver. Voir `ASSETS_A_PRODUIRE.md`.
6. Les nouveaux équilibrages (gîte, auberge, marché, solaire) sont testés en simulation accélérée, pas encore en longues parties réelles.
2. Le relief est continu (collines douces) : pas de falaises verticales franches ni de tunnels ; l'eau est plane par case (petits paliers sur les rivières de montagne).
3. Les cultures des fermes voisines sont décoratives (elles suivent seulement la saison).
4. Une sauvegarde V0.1 reprise est réinstallée sur la nouvelle carte : la disposition exacte des bâtiments n'est pas conservée.
5. Les ruches restent dessinées en 2D.

Captures V0.4 : `docs/captures/v04-ferme-limousin.jpg`, `v04-ferme-est.jpg` (colombages), `v04-hiver-montagne.jpg` (neige sur les toits, pierre et lauzes). Performance V0.4 (processeur bridé ×4, rendu logiciel) : coût JS moyen 2,6 à 5,2 ms par image selon la région et le zoom, du même ordre qu'en V0.3.
