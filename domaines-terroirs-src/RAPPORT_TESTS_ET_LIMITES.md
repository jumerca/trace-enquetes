# Rapport — V0.2 (état au 23/11/2026)

Ce rapport distingue ce qui est **fait et testé** de ce qui est **partiel**, **non commencé** ou **non testé**. Aucune mesure sur téléphone réel n'a pu être faite dans cet environnement.

## Résultats des tests

| Suite | Commande | Résultat |
|---|---|---|
| TypeScript strict | `npm run build` | 0 erreur |
| Unitaires (Vitest) | `npm test` | **33/33** réussis |
| Bout en bout (Playwright, build de prod) | `npm run test:e2e` | **45/45** vérifications (détail : `docs/captures/resultats-e2e.json`) |

Unitaires : chacune des **8 régions** démarre jouable (bâtiments autorisés et accessibles, route du bord de carte au parking, récolte, transformation et visiteurs dès 3 jours) ; la mer existe au bord de mer, la montagne a > 3× le relief de la Beauce ; productions refusées hors région ; reproductibilité sur 30 jours ; conservation de la matière ; salaires ventilés ; négociant (aucune vente sans stock, camionnette qui vient charger) ; capacité de grange ; ateliers à l'arrêt sans intrants ; constructions invalides ; élevage caprin → fromage ; **blé mécanisé : moissonneuse → grange, puis labour et semis au tracteur, engins rentrés au garage** ; champ sans engin travaillé à la main ; **visiteurs en voiture : arrivée, stationnement, départ** ; véhicules contournant le décor et restant sur les voies ; démolition, chemins, achat de terrain contigu ; sauvegarde/restauration à l'identique (relief compris) ; refus des fichiers étrangers, plus récents ou de la V0.1 ; A* ; personne ne traverse bâtiment, eau ou pente infranchissable (2 jours en montagne) ; cohérence des données ; tri en profondeur.

E2E (Chromium, rendu logiciel) : menu et fenêtres, **choix de la région**, carte 256×256, vitesses et pause, déplacement et zoom, caméra immobile pendant la simulation, fiche bâtiment, refus sur l'eau, construction d'un champ, panneaux, embauche, négociant, export JSON, enregistrement et rechargement à l'identique, **lancement des 7 autres régions avec la planche de véhicules chargée**, mobile Pixel 5 émulé (pincement, placement tactile + « Valider »), aucune erreur JavaScript.

## Performance (mesures réelles, à interpréter avec prudence)

- Coût JavaScript par image : **≈ 0,3 ms** au zoom normal ; **4 à 7 ms** dézoomé au maximum sur des zones très boisées (5 000 à 7 000 objets visibles, tri en profondeur compris).
- Images/seconde dans le conteneur : **≈ 11 i/s**, rendu WebGL **logiciel** (SwiftShader, sans GPU) : non représentatif.
- **30 i/s sur Android 4 Go : NON VALIDÉ** (pas d'appareil). Outils : `window.__dt.measuredFps()`, `window.__dt.cpuMs()`.
- Maîtrise prévue : 256 maillages de sol (un par chunk, une seule texture), objets du décor créés seulement pour les chunks visibles puis recyclés (pool de sprites), décor léger masqué quand on dézoome, véhicules pré-cuits (aucune 3D à l'exécution), recherche de chemin sans allocation. Le zoom minimal est borné ; un niveau de détail plus agressif sera peut-être nécessaire sur téléphone modeste.

## Tableau d'avancement

| Élément | État | Test |
|---|---|---|
| Choix de la région à la nouvelle partie (8 régions : relief, climat, architecture, essences, productions, tourisme, départ) | Fait | Testé |
| Carte 256×256 avec relief par sommet, ombrage des pentes, neige d'altitude/hivernale | Fait | Testé (unitaire) + visuel |
| Mer, plage, falaises, phare, bateaux (bord de mer) ; massif, estives, rochers (montagne) ; rivières, étangs, villages avec église, champs des fermes voisines, bocage | Fait | Visuel (captures) |
| Terrassement automatique des pentes à la construction (coût) | Fait | Indirect |
| 9 cultures, 6 vergers/vignes, 7 élevages, 10 ateliers (recettes multiples), 38 ressources | Fait | Testé (données + chaînes principales) |
| Labour → semis → pousse → récolte ; tracteur (charrue, semoir, remorque), moissonneuse-batteuse ; travail à la main sans engin | Fait | Testé |
| Véhicules 3D toon pré-cuits en 8 directions avec roues animées (tracteur ×7 configurations, moissonneuse, camionnette, 3 voitures) | Fait | Visuel + E2E (chargement) |
| Visiteurs arrivant en voiture, parking, départ | Fait | Testé |
| Contrats négociant (surplus vendus chaque matin, seuils réglables) | Fait | Testé indirectement (économie) |
| Économie rééquilibrée par région | Partiel : départs entre −3 700 € et +2 000 € sur 4 semaines hiver compris ; à affiner après essais | Mesuré |
| Tracteurs de couleurs/marques variées | Partiel : rouge (et vert cuit mais non utilisé) | — |
| Engins spécialisés (arracheuse, épandeur, pulvérisateur, ensileuse, vendangeuse, bétaillère) | Non commencé (l'arrachage utilise tracteur + remorque) | — |
| Ponts constructibles, routes par le joueur, carte encore plus vaste (512²) | Non commencé | — |
| Fatigue/compétences du personnel, emprunts, événements, sons | Non commencé | — |
| 30 i/s sur Android 4 Go | Non validé | Non testé |

## Limites honnêtes

1. **Graphismes** : les véhicules ont fait un vrai bond (modèles 3D cohérents avec la caméra) ; le reste (bâtiments, arbres, personnages, animaux) reste peint par code — cohérent mais en deçà des concept arts. Voir `ASSETS_A_PRODUIRE.md`.
2. Le relief est continu (collines douces) : pas de falaises verticales franches ni de tunnels ; l'eau est plane par case (petits paliers sur les rivières de montagne).
3. Les cultures des fermes voisines sont décoratives (elles suivent seulement la saison).
4. Les sauvegardes V0.1 ne sont pas reprises (la carte et le contenu ont changé) : le jeu le signale clairement.
5. Les animaux restent dessinés en 2D (2 images d'animation).
