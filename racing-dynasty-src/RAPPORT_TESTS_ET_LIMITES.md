# Racing Dynasty — Tests réellement effectués et limites constatées

## V0.9 (dernière version)

* `npm test` : 49/49 (aucune régression ; la cuisson 3D est testée par l'E2E et les contrôles visuels).
* Contrôles visuels (captures) : planches de vues de la monoplace et de la voiture de sécurité, vue 2,5D sur 4
  circuits, vue Bord, vue Cockpit (cockpit 3D), décor 3D de jour et de nuit.
* Temps de préparation de la course, mesuré dans Chromium headless sans GPU (rendu WebGL logiciel) : ≈ 6 à 7 s,
  décor et monoplaces compris (≈ 20 s avant le passage à un rendu unique par livrée). Sur un téléphone avec GPU,
  ce devrait être nettement plus court, mais ce n'est pas mesuré. Les courses suivantes réutilisent les planches.
* Mémoire : 11 planches 2,5D de 1024×768 (haute qualité) ou 672×336 (économie), plus les planches rasantes quand la
  vue Cockpit ou Bord est ouverte (≈ 40 Mo en haute qualité) — à surveiller sur un téléphone de 4 Go.
* Limites :
  * les deux voitures d'une même écurie partagent le modèle (numéro visible sur l'étiquette) ;
  * les roues ne tournent pas sur les modèles cuits ;
  * la tribune et les garages restent dessinés en 2D.

## V0.8

* `npm test` : **49/49**. Nouveaux tests : conférence de presse (une question par GP, effets de la réponse sur le
  moral et la confiance, réponse citée dans l'article, réponse unique), prolongation du contrat du directeur (3
  propositions, course bloquée tant qu'elle n'est pas signée, gains de carrière), migration avec salaire du directeur.
* E2E Chromium (PC avec saison complète, Android paysage et portrait, tablette) : vues Bord et Hélico, réponse à la
  conférence de presse en plus du parcours V0.7.
* Bundle : ouverture du jeu ≈110 Ko compressés (React 45 + jeu 64) au lieu de ≈200 Ko ; course chargée à la demande
  (≈96 Ko + PixiJS).
* Le workflow GitHub Actions n'a pas pu être lancé depuis ici ; il s'exécutera sur la prochaine pull request.
* Le bouton « Partager » dépend du navigateur (Web Share avec fichiers : Chrome Android oui ; ailleurs, il
  télécharge le fichier comme « Exporter »). Non testé sur téléphone réel.
* Vue Bord : décor proche de la caméra masqué volontairement au téléobjectif ; voitures de profil dessinées en 2D.

## V0.7

* `npm test` : **47/47**. Nouveau fichier `tests/longterm.test.ts` :
  * chantier d'usine sur plusieurs GP, puis projets en parallèle et entretien plus élevés ;
  * un article de presse par GP, rivalité née de contacts ;
  * limogeage après une saison catastrophique, puis reprise d'une autre écurie et course jouée avec elle ;
  * offre de débauchage après une saison réussie, refus qui rassure les actionnaires ;
  * migration d'une sauvegarde V0.6 (schéma 3 → 4).
* Économie : 2 saisons complètes de 8 GP simulées pour chaque difficulté × profil de budget (2 pilotes, 2 sponsors,
  aucun investissement). Avant : le budget gagnait de +15 à +26 M€ par saison (par exemple 30 → 45 → 59 en
  normale/équilibré). Après : à peu près stable (30 → 28 → 26 en normale/équilibré, 15 → 13 en difficile/serré).
  Le budget de départ sert désormais vraiment à investir (R&D, installations, personnel).
* Actionnaires : dans ces simulations passives (sans aucun investissement), le directeur est remercié au bout de
  2 saisons dans 2 cas sur 9. C'est voulu (objectif jamais atteint), mais c'est à juger en jouant.
* E2E Chromium (PC avec saison complète de 8 GP, Android paysage et portrait, tablette) : réussi, avec en plus un
  chantier d'installation, la vue cockpit, l'article de presse aux résultats et l'onglet Presse.
* Vue cockpit : même ordre de vitesse que la vue Suivre en rendu logiciel headless (environ 9 contre 10 i/s à
  1000×560 sur cette machine chargée). Elle n'a pas été mesurée sur un téléphone réel.
* Limites :
  * la vue cockpit est une projection pseudo-3D d'un circuit plat (pas de relief) ;
  * les adversaires sont vus de dos uniquement ;
  * la voie des stands est simplifiée.

## V0.6

* `npm test` : **42/42** (nouveau : drapeaux jaunes signalés et levés, aucun dépassement dans une zone neutralisée).
* Stratégies (voitures identiques, seules en piste, 5 circuits, 12 tours) : Tendre→Médium, Médium→Dur et
  Tendre→Tendre→Médium à moins de 1 s / 3 s les unes des autres. En course (trafic), deux arrêts restent environ 5 s
  derrière en moyenne mais battent Médium→Dur sur Valbrune et Kharam (forte usure).
* Dépassements par course (12 tours, sec) : 12 à 37 selon le circuit (contre 9 à 41 en V0.5).
* E2E Chromium : PC (saison complète de 8 GP, qualifications animées, podium), Android paysage et portrait : réussi.
* Contrôles visuels : brouillard (Brumevent), crépuscule (Kharam), flaques sous la pluie, commentateur, podium,
  portraits, briefing, graphique des essais.

## V0.5 — refonte graphique

* `npm test` : 41/41 (aucune régression de la simulation ou de la gestion).
* Contrôle visuel par captures sur les 8 circuits (vue grille, course, zoom, circuit) : aucune erreur console.
* E2E Chromium (PC avec saison complète, Android paysage et portrait) : voir ci-dessous.
* Performances (800×360, rendu logiciel sans GPU, indicatif) : qualité Économie 32 i/s en vue Suivre (31 avant la
  refonte), 24 en vue Circuit (28 avant) ; qualité Haute 11 / 6 (antialiasing coûteux sans GPU). La mesure sur
  téléphone réel reste à faire ; en Économie, le grain d'asphalte, le gravier texturé, les nuages, les spectateurs
  et une partie du décor sont désactivés.

## V0.4

* `npm test` : **41/41**. Nouveaux tests de gestion (`tests/management.test.ts`) : recrutement du chef mécanicien
  (effet sur les arrêts), projet de R&D sur plusieurs GP, négociation de sponsor (refus, rupture, contrat de 3 saisons
  conservé à l'intersaison), académie (signature, progression, passage en réserve), forfait d'un titulaire remplacé
  par le réserviste puis retour, moral et prolongation, saison complète de 8 GP (statistiques : 8 victoires,
  8 poles, 1 titre ; grilles IA complètes après les transferts ; marché du personnel renouvelé), migration d'une
  carrière V0.3 (schéma 2 → 3).
* Tour de formation simulé sur les 8 circuits : 0 chevauchement, chaque voiture revient exactement sur sa case,
  durée 2 à 2,7 min en ×1 (bouton « Passer »).
* E2E Chromium sur PC (saison entière de **8 GP**, négociation de sponsor, académie, usine, palmarès, saison 2),
  Android paysage et portrait, tablette : réussi, ralenti lancé depuis le fil d'événements, aucune erreur console.
  PWA hors ligne : OK. Rendu de nuit (Lumen) vérifié sur capture.
* Images/s dans ce conteneur sans GPU, qualité Haute forcée : 5 à 9 i/s — non représentatif d'un téléphone ;
  la mesure sur appareil réel reste à faire.
* Non vérifiable ici : la musique et le son (synthèse WebAudio, testée seulement sans erreur).

## V0.3

* `npm test` : **29/29**. Nouveaux tests (`tests/race-depth.test.ts`) : reprise par instantané identique au déroulé
  continu (avec averse et consignes), voiture de sécurité sans chevauchement ni dépassement pendant la
  neutralisation, averse (la piste se mouille, l'IA passe en pneus pluie, radio météo), règle des deux gommes
  (pénalité de 20 s reflétée au classement), consignes « tenir » (0 dépassement entre équipiers sur 6 courses) et
  « inverser » (échange effectué), contacts.
* Bancs d'équilibrage (graines fixes, 12 tours, champ réel de la carrière) — moyennes par course :

  | Circuit | Dépassements (sec) | Dépassements (averse) | Voitures de sécurité | Contacts | Chevauchements |
  |---|---|---|---|---|---|
  | Port-Azur | 9 | 18 | 0,3–0,8 | 2–4 | 0 |
  | Lac d'Argent | 26 | 45 | 0–0,3 | 2–3 | 0 |
  | Valbrune | 41 | 74 | 0–0,7 | 3–5 | 0 |
  | Montclair | 7 | 10 | 0,5–1 | 2–4 | 0 |
  | Kharam | 37 | 51 | 0,3 | 3–5 | 0 |

  Avant la V0.3 : 1 à 3 dépassements à Port-Azur et sous la pluie. Changements de place au premier tour : 25 à 45
  places cumulées sur 20 voitures.
* Stratégies (20 voitures identiques, 5 stratégies réparties au hasard, 10 graines × 5 circuits, 12 tours) :
  position moyenne Tendre→Médium 5,8 · Médium→Dur 7,2 · Dur→Tendre 8,9 · deux arrêts 14 · Dur sans arrêt 15,8
  (pénalité des deux gommes). Avant : « Dur sans arrêt » gagnait (3,8) et rendait les autres stratégies inutiles.
* Réglages : passer du réglage par défaut à l'optimal = 0,2 à 0,65 % ; un réglage très mauvais = 1 à 2,8 %.
* E2E Chromium (PC, Android paysage et portrait, tablette) : parcours complet réussi, voiture de sécurité et averse
  forcées en course (bandeau, voiture SC, pluie à l'écran vérifiés sur capture), aucune erreur console.
* Non vérifiable ici : rendu et fluidité sur téléphone réel, son.

## V0.2

* `npm test` : **22/22** (ajouts : 5 circuits, course complète sans chevauchement sur Lac d'Argent et Montclair,
  aucune voiture ne bouge avant l'extinction des feux, évolution des voitures IA sur une saison de 5 GP, objectif des
  actionnaires évalué en fin de saison, **migration d'une sauvegarde V0.1 (schéma 1) vers le schéma 2** sans perte).
* E2E Chromium sur PC, Android paysage, Android portrait et tablette : parcours complet réussi, saison entière de
  5 GP jouée sur PC (5 circuits rendus et capturés, caméra TV testée), aucune erreur console.
* PWA : service worker actif, hors ligne OK, sauvegarde intacte.
* Images/s en 800×360, Chromium headless **sans GPU** (indicatif seulement, pas un téléphone) : qualité Économie
  31 (Suivre) / 28 (Circuit) contre ~25 avant le découpage du décor en tronçons ; qualité Haute 14, dont l'essentiel
  est le coût de l'antialiasing en rendu logiciel (25 sans antialiasing). Portrait 360×740 Économie : 46 / 37.
  **Toujours à valider sur un Android 4 Go réel** (compteur i/s dans Paramètres).
* Son : synthétisé en WebAudio, non vérifiable à l'oreille dans ce conteneur (testé uniquement : pas d'erreur).

---

# V0.1

Environnement de test : conteneur Linux (Node 22), Chromium headless (rendu WebGL logiciel, sans GPU).
**Aucun test sur appareil Android réel n'a pu être fait depuis cet environnement.**

## 1. Tests automatisés (Vitest) — `npm test` : 18/18 réussis

Moteur (`tests/engine.test.ts`)
* 3 circuits fermés, longueur 3,0 à 5,2 km, trajectoire idéale toujours dans la piste.
* Même graine → résultats et fil d'événements strictement identiques ; graine différente → course différente.
* Rejeu : une course avec consignes joueur (mode attaque, arrêt au stand) rejouée depuis la liste de consignes
  donne exactement le même classement.
* Course complète sur chacun des 3 circuits : **0 chevauchement de voitures à chaque pas** (20 voitures, contrôle
  par paires) ; aucune voiture hors piste en dehors des stands, des abandons ou des 8 s suivant une erreur annoncée ;
  positions 1–20 uniques ; arrivants classés par tours puis temps, abandons en fin de classement ; tous les arrivants
  ont effectué l'arrêt prévu.
* Course sous la pluie en pneus pluie : se termine normalement.
* Le mode « attaque » use davantage les pneus que « normal » (même graine).

Gestion et sauvegardes (`tests/career.test.ts`)
* Création de carrière : 10 écuries, 18 pilotes sous contrat + 10 agents libres, 3 GP, budget conforme.
* Recrutement : refus sous le salaire demandé, prime déduite, limite de 2 titulaires, libération avec indemnité.
* Sponsors : réputation minimale exigée, 2 emplacements maximum. Évolution de voiture payante.
* Saison complète (3 GP, essais → qualifs → stratégie → course → résultats) : total des points pilotes = somme du
  barème des arrivants, classements triés, constructeurs = somme des pilotes, palmarès, passage en saison 2.
* Même graine de carrière → mêmes résultats.
* Sauvegarde pendant une course (après 1000 pas + consigne) puis rechargement : positions identiques au pas près
  et même résultat final.
* Sauvegarde principale corrompue → copie de secours chargée ; export/import ; refus d'un fichier étranger.

## 2. Test de bout en bout dans le navigateur — `scripts/e2e.cjs`

Sur le build de production servi par `vite preview`, dans 4 formats : PC 1366×768, Android paysage 800×360,
Android portrait 360×740, tablette 1024×768 (tactile).
Parcours vérifié à chaque fois : création d'écurie → recrutement de 2 pilotes (négociation) → signature d'un sponsor
→ essais (réglage + 2 relais) → qualifications → départ → course en ×4 → consigne « attaque » → vue circuit →
retour au QG en pleine course → **rechargement de la page → Continuer → reprise de la course** → fin directe →
résultats → classements → **rechargement → classement conservé**. Sur PC, la saison entière est jouée (Port-Azur,
Valbrune, Kharam) jusqu'à « Saison 1 terminée » puis lancement de la saison 2.
Résultat : réussi dans les 4 formats, **aucune erreur JavaScript ni erreur console**.

## 2 bis. PWA — `scripts/pwa-check.cjs` (build servi sur localhost)

Manifeste lu (4 icônes dont 2 masquables) ; service worker installé et contrôlant la page ; **hors ligne**, l'écran
d'accueil s'affiche et la sauvegarde `localStorage` est intacte. L'invite d'installation Android n'a pas pu être
testée ici (elle nécessite un vrai Chrome Android sur HTTPS).

## 3. Mesures de performance (dans le conteneur, pas sur téléphone)

* Moteur : 55 à 120 µs par pas de simulation (20 voitures) ; une course de 12 tours se calcule en 0,7 à 1 s
  (« Fin directe »), une course de 20 tours en ~1 s.
* Bundle : JS principal 470 Ko (153 Ko gzip), CSS 20 Ko, total `dist/` 1,6 Mo avec polices et icônes.
* Images/s mesurées dans Chromium headless **sans GPU** (rendu logiciel) : 12 à 54 i/s selon la taille de fenêtre.
  Ce chiffre n'est **pas** représentatif d'un téléphone (qui dispose d'un GPU) et ne valide pas l'objectif de
  30 i/s sur Android 4 Go : **la mesure sur appareil réel reste à faire** (procédure dans `PUBLICATION.md`,
  compteur i/s intégré dans Paramètres).
* Mesures prises côté rendu pour les appareils modestes : mode Économie automatique (≤ 4 Go ou ≤ 4 cœurs) :
  résolution 1×, sans antialiasing, moins de décors, pas de fumée, étiquettes réduites ; plafond 30/60 i/s ;
  décor statique dessiné une fois ; textures de voitures générées une fois par écurie ; interface React rafraîchie
  4 fois par seconde seulement (pas à chaque image).

## 4. Équilibrage observé (bancs d'essai, graine fixe)

* Temps au tour : ~63 s (Port-Azur, 3,0 km), ~74 s (Valbrune, 5,1 km), ~90 s (Kharam, 5,2 km).
* Écart voiture la plus rapide / plus lente : ~3,5 %. Réglages optimaux différents selon le circuit
  (~1 s au tour entre un bon et un mauvais réglage).
* Dépassements par course (12 tours) : Port-Azur 1 à 3 (urbain, voulu), Valbrune 3 à 17, Kharam ~20 à 28.
  Abandons : 0 à 4 par course. Durée réelle d'un GP en ×1 : 13 à 19 min (6 à 8 min en tours « courts »).

## 5. Limites constatées

* **Performance mobile non validée** sur Android réel (voir §3). Le déploiement HTTPS n'a pas été effectué depuis
  cette session (procédure prête : `PUBLICATION.md`).
* Simulation en « 1D + latéral » : les voitures suivent le tracé et se décalent latéralement ; pas de contacts
  physiques ni de dégâts, pas de voiture de sécurité ni de drapeaux jaunes.
* Peu de dépassements à Port-Azur et sous la pluie : à rééquilibrer avec plus de retours de jeu.
* Météo constante pendant une course (pas de pluie qui commence en cours de GP).
* Reprise d'une course après rechargement : la course est recalculée depuis le départ (≈ 1 s sur PC ; peut
  prendre quelques secondes sur un téléphone modeste).
* Marché des transferts IA, développement de la voiture des IA, sons et musiques : non inclus en V0.1.
* Une seule langue (français). Sauvegardes locales à l'appareil (export/import manuel pour changer d'appareil).
