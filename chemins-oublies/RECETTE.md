# Recette — Les Chemins Oubliés (V0.2 : Prologue et Chapitre II)

Document de recette de la version 0.1 : ce qui est testé, comment le rejouer, et les résultats de la dernière campagne.

- **Campagne :** 17 novembre 2026
- **Version testée :** branche `main` + correctifs de cette campagne (musique composée, indices précis, équilibrage)
- **Langue :** français uniquement (textes, interface, aides)

---

## 1. Environnements

| Environnement | Usage | Statut |
|---|---|---|
| Chromium (Playwright) sans écran, rendu logiciel (SwiftShader), 1280×720, souris | Parcours automatisé complet | ✔ |
| Chromium, écran de téléphone en paysage 844×390, toucher (`--touch`) | Parcours automatisé au toucher | ✔ |
| Téléphone réel (testeur : porteur du projet), PWA installée depuis le lien HTTPS | Partie complète, ressenti | ✔ (retour positif ; demandes : musique plus variée, indices plus précis — traitées dans cette version) |

Le rendu logiciel des tests est très lent (6 à 15 images par seconde). Les durées « réelles » ci-dessous ne
reflètent donc pas un vrai appareil ; seules comptent les vérifications.

## 2. Tests automatisés

### 2.1 Tests unitaires — `npm test`

52 tests, tous verts :

| Fichier | Ce qui est vérifié |
|---|---|
| `tests/logic.test.ts` (21) | chaque indice a un conseil d’Éloi et toutes les aides se lisent, énigmes (bornes, pierres, vannes et bief), sauvegardes et migrations v1→v3, cohérence des données (chaque effet de dialogue référence un objet, un indice ou une note qui existe ; chaque objet interactif a un script ; chaque étape a au moins deux aides), chaque personnage principal change de répliques selon la progression, habitants toujours sur une case praticable à toute heure, personnages indispensables toujours localisables, places de la fête des moissons praticables |
| `tests/nav.test.ts` (6) | grille de navigation, recherche de chemin, falaises infranchissables, portes |
| `tests/music.test.ts` (18) | lecture des notes et accords ; pour chacun des 17 morceaux : chaque mesure contient exactement le bon nombre de temps, la mélodie reste dans une tessiture chantable |
| `tests/chapter2.test.ts` (7) | pierres veilleuses (bon ordre, piège de l'œil fermé, mauvais ordre) ; miroirs (lentille éteinte au départ, une seule combinaison gagnante sur 16) ; chaque objet des nouveaux lieux a un script et est accessible ; rencontres loin des échos ; indices des échos |

### 2.2 Parcours de bout en bout — `scripts/e2e.cjs`

Le robot joue **par de vrais clics** (ou touchers) sur le sol, les personnages et les objets visibles à l'écran.
Il ne téléporte jamais le héros (sauf les raccourcis de départ ci-dessous, qui fabriquent une sauvegarde, et le
passage au soir pour la fête).

```bash
npm run build && npx vite preview --port 4173 &   # servir une version compilée (pas le serveur de dev :
                                                  # il recharge la page à chaque modification du code)
node scripts/e2e.cjs http://localhost:4173/                 # prologue complet depuis l'arrivée
FROM=bois   node scripts/e2e.cjs http://localhost:4173/     # départ à la porte du Bois
FROM=moulin node scripts/e2e.cjs http://localhost:4173/     # départ devant le moulin (boss, énigme 3, fin)
node scripts/e2e.cjs http://localhost:4173/ --touch --w=844 --h=390   # au toucher, téléphone en paysage
node scripts/e2e.cjs http://localhost:4173/ --unusual       # ordre de conversation inhabituel
```

Le parcours se joue en qualité graphique « basse » (plus rapide en rendu logiciel). Il échoue dès qu'une
erreur JavaScript apparaît.

**Fiabilisation faite dans cette campagne :**
- le robot ne considérait un combat comme gagné que lorsque **tous** les ennemis de la forêt étaient vaincus,
  y compris ceux d'une autre rencontre, hors de l'écran : il restait bloqué indéfiniment. Chaque combat ne
  vise maintenant que les ennemis de sa rencontre (temps d'un combat : 7 à 14 s au lieu de « jamais ») ;
- le robot attend la fin des pensées d'Éloi à la première visite d'un lieu avant d'agir ;
- départ intermédiaire `FROM=bois` pour rejouer la deuxième moitié sans refaire le village ;
- nouvelles vérifications : secret du garde, fête des moissons ;
- tests sur version compilée, pour ne plus être interrompus par le rechargement du serveur de développement.

## 3. Grille de recette fonctionnelle

Statut : **A** = vérifié par le parcours automatisé, **V** = vérifié visuellement (capture), **M** = vérifié
sur appareil réel, **—** = à vérifier.

### 3.1 Prise en main

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| P1 | Toucher le sol | Éloi s'y rend par le chemin le plus court, en contournant obstacles et falaises | A M |
| P2 | Toucher un habitant ou un objet | Éloi s'en approche, puis parle ou examine | A M |
| P3 | Glisser sur l'écran | La carte défile sans déplacer Éloi ; bouton « Éloi » pour recentrer | V M |
| P4 | Pincer / molette / boutons + − | Zoom avant et arrière, centré sur le geste | V M |
| P5 | Appui long | Éloi marche vers le point tant que le doigt reste posé | M |
| P6 | Toucher une porte | Entrée dans le bâtiment (16 intérieurs visitables) | A V |
| P7 | Écran vertical sur téléphone | Invitation à tourner l'appareil | V |

### 3.2 Histoire et quête principale (11 étapes)

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| H1 | Arrivée, examen de la borne | Intro d'Éloi (voix, culpabilité, humour), puis **souvenir 1** « La première borne » en sépia | A V |
| H2 | Agathe | Indice + étape suivante | A |
| H3 | Témoignages de Ninon, Salomé, Basile | 3 indices, lettre confiée par Basile | A |
| H4 | Énigme 1 : trois bornes | Bornes réorientées (est, nord, nord-est) → première trace dans l'atlas | A |
| H5 | Boussole : Mara → Coline | Pierre d'aimant, boussole réparée, **souvenir 2** « La boussole » | A |
| H6 | Théodore | Refuse sans boussole ni direction ; ouvre ensuite le Bois | A |
| H7 | Combat 1 (ronceux), Anton | Combat gagné, Anton retrouvé (clé + frottis), réplique personnelle d'Éloi | A |
| H8 | Énigme 2 : pierres gravées | Erreur (lune) → réinitialisation ; eau, oiseau, clé → brume levée, **souvenir 3** « La dernière soirée » | A |
| H9 | Boss : Gardien des Ronces | Deux phases (fouets puis charges), cœur d'ambre vulnérable seulement ouvert ; victoire → +1 cœur | A |
| H10 | Moulin : journal, frein, énigme 3 | Vanne motrice trop tôt → la roue retombe ; bief plein puis vanne → la roue tourne | A |
| H11 | Finale | Route révélée, **silhouette grise du Conservateur** au bout du pont, annotation de Maëlys, écran de fin | A V |

### 3.3 Missions, secrets, mystère

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| S1 | Mission « La Lettre sans destinataire » | Registre aux Archives → lettre remise à Anton | A |
| S2 | Mission « Le Jardin de Mara » | 3 plantes → 3 baumes | A |
| S3 | Mission « Le Secret du garde » | Ninon (après les bornes) → aveu de Théodore → insigne d'argent → Salomé reconnaît le sceau | A |
| S4 | 3 secrets : boîte sous le pont, coffre des ronces, sentier caché | Chacun trouvé et compté | A |
| S5 | Combinaison des deux moitiés de page | Page du carnet de Maëlys + annotation | A |

### 3.4 Monde vivant

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| W1 | Routines (Agathe, Basile, Mara) | Lieux différents matin, midi, après-midi, soir ; Journal → Habitants indique où | A |
| W2 | Réactions du village | Répliques nouvelles après le retour d'Anton, la brume levée, la roue, la route | tests ✔ |
| W3 | Fête des moissons | Après le prologue, de 17 h à 23 h : guirlandes, banquet, tous les habitants sur la place, répliques de fête | A V |
| W4 | Affiche du village | Change après la fin du prologue | — |

### 3.5 Combat et équilibrage

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| C1 | Préparation d'attaque annoncée | Zone rouge au sol ; un coup de bâton interrompt la préparation d'un ronceux | A |
| C2 | Esquive (bouton ou Espace) | Roulade avec invulnérabilité courte | A |
| C3 | Défaite | Retour au point de passage, cœurs restaurés | A |
| C4 | Difficultés (Options) | Exploration (aucun dégât), facile, normale, difficile | — |
| C5 | Cœurs dans les hautes herbes et sur les ennemis vaincus | Apparition et ramassage | A |

### 3.6 Aides

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| A1 | Journal → « Un indice ? » | Aides progressives ; les dernières s'adaptent à la situation (qui il reste à voir et où, ce qui manque pour la boussole, heure de la journée) | V |
| A2 | Atlas → Indices → toucher un indice | Conseil concret d'Éloi ; ✓ et ce qu'il a permis une fois l'énigme résolue | V |
| A3 | Journal → Missions | Conseil sous chaque mission en cours | — |
| A4 | Boussole en haut de l'écran | Pointe vers l'objectif du moment | A |

### 3.7 Son et musique

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| M1 | Village le jour / le soir / la nuit | 3 morceaux différents (luth sautillant, valse à la flûte, boîte à musique) | tests ✔, — à l'oreille |
| M2 | Intérieurs | Auberge (air de taverne), Archives (arpèges mystérieux), maisons (berceuse) | — |
| M3 | Selon l'intrigue | Bois inquiet puis apaisé après la brume ; moulin silencieux puis joyeux quand la roue tourne ; fête ; souvenirs ; apparition | — |
| M4 | Combat, boss | Morceaux dédiés, retour au thème du lieu ensuite | A (aucune erreur) |
| M5 | Changement de morceau | Fondu enchaîné, pas de coupure sèche | — |
| M6 | Volumes musique / effets | Réglables dans les Options | — |

### 3.8 Sauvegarde, options, PWA

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| D1 | 3 emplacements, sauvegarde automatique aux étapes | Reprise exacte (zone, énigmes, inventaire, drapeaux) après rechargement | A |
| D2 | Rechargement en fin de partie | Tout est conservé, la roue tourne toujours | A |
| D3 | Options : qualité, vitesse du texte, volumes, difficulté | Appliquées immédiatement et mémorisées | — |
| D4 | Qualité adaptative | Si l'image saccade en « haute », les effets coûteux sont retirés | — |
| D5 | Installation PWA depuis le lien HTTPS | Icône, plein écran, jeu hors ligne après le premier chargement | M |
| D6 | Mise à jour | Options → Rechercher les mises à jour : nouvelle version proposée et activée | — |

### 3.9 Chapitre II — Les Voix des bois

| # | Scénario | Attendu | Statut |
|---|---|---|---|
| K1 | Après l'écran de fin du prologue | Nouvel objectif « Au-delà de la brume » ; le pont de l'est du moulin est ouvert | A |
| K2 | Landes de Brume, Jules Bastien | Arrivée (pensées d'Éloi), rencontre du berger, indice des voix | A |
| K3 | Les trois échos | Toucher un cercle d'herbe argentée (ou consulter l'atlas tout près) : flash-back bleuté, indice dans l'atlas ; impossible d'écouter en plein combat | A V |
| K4 | Pierres veilleuses | L'œil fermé est un piège (tout s'éteint) ; saule, corbeau, cloche, lanterne libèrent la chaussée | A |
| K5 | Le Dévoreur de brume | Arène de brume ; coups qui traversent tant qu'aucun brasero ne brûle ; brasero allumé = vulnérable ; nappes de brume annoncées au sol ; victoire = +1 cœur, chemin de Brumecime | A V |
| K6 | Mission « Le Troupeau égaré » | 3 moutons ramenés → baume | A |
| K7 | Brumecime : Ysolde, Léna | La clé est tissée dans la tapisserie de Léna ; la porte de la tour s'ouvre avec elle | A |
| K8 | La Tour des Vents | Le rayon part de la fenêtre et suit les miroirs ; une seule combinaison sur 16 allume la lentille | A V, tests ✔ |
| K9 | Finale : Silas | Chemins des hauts dans l'atlas, conversation avec Silas (répliques selon Théodore et Léna), sauf-conduit, écran « Fin du Chapitre II » | A V |
| K10 | Journal, boussole, atlas | Étapes du chapitre II, habitants des Hautes Terres, boussole vers l'objectif, cartes de la lande et de Brumecime | V |
| K11 | Musique | Complainte de la lande, air des hauts à Brumecime, arpèges dans la tour, boss | tests ✔ |

## 4b. Résultats de la campagne du 18 novembre 2026 (Chapitre II)

| Campagne | Résultat |
|---|---|
| Tests unitaires (`npm test`) | **52 / 52** |
| Chapitre II seul, souris (`FROM=chap2`) | **20 / 20** |
| Chapitre II seul, toucher 844×390 (`FROM=chap2 --touch`) | **20 / 20** |
| Partie complète au toucher, prologue puis chapitre II | **69 / 69**, aucune erreur JavaScript |
| Partie complète à la souris, prologue puis chapitre II | **69 / 69**, aucune erreur JavaScript |

Anomalies trouvées et corrigées pendant cette campagne :

| # | Anomalie | Gravité | Correction |
|---|---|---|---|
| C1 | Caméra figée pour de bon : quand un point du chemin tombait exactement sur la position d'Éloi, sa vitesse devenait invalide (division par zéro), et la caméra qui la suit aussi. Existait aussi dans le prologue. | Majeure | Vitesse calculée seulement si la distance est non nulle ; garde-fou qui recentre la caméra si sa position devient invalide. |
| C2 | Le bouton « Esquive » et l'état de danger restaient actifs en changeant de lieu pendant un combat. | Moyenne | Remis à zéro à chaque changement de lieu. |
| C3 | Sortie Lande → Brumecime sous les boutons du menu sur téléphone en paysage. | Majeure (téléphone) | Zones de sortie agrandies entre la lande et le hameau. |
| C4 | Des murmures pouvaient attaquer pendant l'écoute d'un écho. | Moyenne | Rencontre déplacée loin des échos ; impossible d'écouter en plein combat (contrôle automatique). |
| C5 | Le Dévoreur n'apparaissait qu'en revenant dans la lande après avoir éveillé les pierres. | Bloquante | Le boss est créé dès que la brume quitte la chaussée. |

## 4. Résultats de la campagne du 17 novembre 2026

| Campagne | Résultat | Durée réelle |
|---|---|---|
| Tests unitaires (`npm test`) | **43 / 43** | < 2 s |
| Parcours complet depuis l'arrivée, souris 1280×720 (avec secret du garde et fête) | **52 / 52** | 18 min |
| Départ à la porte du Bois (`FROM=bois`) | **33 / 33** | 25 min (dont un boss joué lentement par le robot) |
| Départ devant le moulin (`FROM=moulin`), avec secret du garde et fête | **20 / 20** | 12 min |
| Parcours complet au toucher, téléphone en paysage 844×390 (`--touch`) | **52 / 52** | 16 min |

Le parcours souris a été joué juste avant la dernière correction (B1c, sélection d'un habitant), le parcours au
toucher sur la version finale.

Détail du parcours complet : arrivée et premier souvenir, Agathe, trois témoignages, lettre et registre,
énigme des bornes, secret du pont, Mara, Coline et souvenir de la boussole, Théodore, rechargement en cours de
partie, pied-de-loup, combat des ronceux (7 s), Anton et la lettre, inscriptions, sauge, ronceux ancien
(facultatif), coffre des ronces, arbre gravé, sentier caché, page de Maëlys, combat des murmures (7 s),
fleur-lanterne, énigme des pierres (avec une erreur volontaire) et souvenir de la dispute, Gardien des Ronces
(41 s), porte du moulin, journal et frein, énigme des vannes (avec une erreur volontaire), fin du chapitre,
retour par la route, jardin de Mara, rechargement final. **Aucune erreur JavaScript.**

Après la fin, le parcours vérifie aussi : Ninon et l'homme au chapeau de fer, l'aveu de Théodore et l'insigne, Salomé et
le sceau des Conservateurs, la fête (les 11 habitants sur la place), la réplique de fête d'Agathe.

### Anomalies trouvées et corrigées pendant la campagne

| # | Anomalie | Gravité | Correction |
|---|---|---|---|
| B1 | **Au toucher, un choix était sélectionné tout seul.** En touchant la boîte de dialogue pour passer à la ligne suivante, les boutons de choix apparaissent sous le doigt, et le « clic » que le navigateur envoie juste après le toucher sélectionnait l'un d'eux (ex. : une borne « laissée ainsi » sans qu'on ait choisi). | Majeure (téléphone) | Un choix n'est validé que si le doigt (ou la souris) s'est posé sur ce bouton-là ; le clavier reste accepté. |
| B1b | **Au toucher, l'écran « Fin du Prologue » se fermait aussitôt** : même cause, le toucher qui termine le dernier dialogue tombait sur le bouton « Continuer à explorer ». | Majeure (téléphone) | Même protection sur ce bouton. |
| B1c | Quand deux habitants se chevauchent (fête sur la place), toucher l'un sélectionnait celui qui est au premier plan. | Moyenne (téléphone) | Le jeu choisit l'habitant dont le corps est le plus proche du doigt. |
| B0 | **Conversation impossible à fermer à la porte nord** (signalé par le testeur). En montant vers l'escalier sans autorisation, Théodore intercepte Éloi ; après « Au revoir », Éloi était encore dans la zone d'interception pendant qu'il reculait, et la conversation se relançait aussitôt, sans fin. | Bloquante | Théodore n'intercepte qu'une fois par approche (il faut s'éloigner pour qu'il recommence) ; recul avec positions de repli. Nouveau contrôle automatique « porte nord ». |
| B2 | Pendant un travelling scénarisé suivi d'un dialogue, la caméra revenait sur Éloi : la silhouette de la fin n'était pas cadrée. | Moyenne | La caméra garde son cadrage jusqu'à la fin de la scène. |
| B3 | Robot de test : combat jamais terminé (ennemis d'autres rencontres comptés), retour involontaire dans un bâtiment en touchant devant sa porte, bord haut de l'écran jamais touché sur petit écran, objets cachés sous les boutons de l'interface (le robot fait maintenant glisser la vue, comme un joueur), arrêt juste avant la zone du boss, chemin vide. | Outil de test | Corrigés dans `scripts/e2e.cjs`. |

## 5. Équilibrage appliqué

| Élément | Avant | Après | Raison |
|---|---|---|---|
| Gardien des Ronces : vie | 16 | 12 | combat trop long au doigt ; environ 4 ouvertures du cœur au lieu de 5 à 6 |
| Gardien : cœurs | aucun | 2 cœurs au passage à la phase 2 ; 35 % de chance d'un cœur par coup réussi si Éloi a 2 cœurs ou moins | éviter l'échec en fin de combat après un long effort |
| Temps de réaction (mode normal) | ×1,0 | ×1,1 | réaction plus lente au toucher qu'à la souris |
| Aides | 2 à 3 par étape | 3 à 4, dont des aides qui s'adaptent à la situation | retour du testeur : indices trop vagues |

Les autres réglages (ronceux 3 PV, murmures 2 PV, ancien 6 PV, Éloi 5 cœurs + 1 cœur secret + 1 cœur du boss)
sont conservés.

## 6. Limites connues

- La musique est vérifiée par les tests (partitions valides, aucune erreur) mais pas encore écoutée sur appareil :
  à valider à l'oreille.
- Le rendu logiciel des tests ne mesure pas les performances réelles ; la fluidité se juge sur téléphone.
