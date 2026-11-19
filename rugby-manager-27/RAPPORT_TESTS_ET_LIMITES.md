# Rugby Manager 27 — V2.0 · Rapport des tests et limites connues

Tous les chiffres ci-dessous proviennent d'exécutions réelles (fichiers bruts dans `tests/`). Environnement : Chromium (Playwright) et Node 22 dans un conteneur Linux ; **aucun appareil Android, iPad ou Windows physique n'a été testé.**

## 1. Moteur — 12 matchs complets de 80 minutes (`tests/engine_tests_report.json`)

Équipes de niveaux 72 à 82 et six plans de jeu différents (équilibré, très large, avants + peu de pied, beaucoup de pied, défense très montante, défense attentiste).

| Contrôle | Résultat |
|---|---|
| Pas de simulation contrôlés | 367 924 |
| Joueurs déplacés plus vite que physiquement possible (« téléportations ») | **2** sur 367 924 pas (liaison de fin de maul ; signalé ci-dessous) |
| Ballon tenu à plus de 0,6 m de son porteur | 0 |
| Passes lancées vers l'avant | 0 sur 3 950 (les passes en avant existent comme faute aléatoire de l'exécutant : trajectoire correcte, faute sifflée) |
| Score ≠ essais×5 + transfos×2 + pénalités×3 + drops×3 (+ essais de pénalité) | 0 |
| Chronomètre final < 80:00 ou sans 2e période | 0 (fin entre 80:06 et 83:30, sirène respectée) |
| Joueurs liés dans un même ruck (max) | 5 |

### Volumes par match (moyenne ± écart-type, [min–max])

| Indicateur | V2.0 | Repères réels (voir sources) |
|---|---|---|
| Points | 49,3 ± 8,4 [37–64] | Top 14 2025-26 (mi-saison) : 56,5 |
| Essais | 5,8 ± 1,5 [3–8] | Top 14 2025-26 : ≈ 7,0 ; Tournoi des Six Nations historiquement ≈ 5 |
| Temps de jeu effectif | 36,2 min ± 2,7 | Premiership ≈ 38 min ; une équipe URC 2022-23 : 38 min 30 |
| Rucks | 255 ± 23 | Six Nations (ancien rapport World Rugby) : 181 rucks + mauls |
| Plaquages | 305 ± 30 | URC 2025-26 : 344 par match |
| Plaquages manqués | 34 ± 7 | — |
| Passes | 329 ± 33 | — |
| Jeux au pied (dont renvois) | 64 ± 5 | — |
| Touches | 23,3 ± 4,6 | Six Nations (ancien rapport) : 23 |
| Mêlées | 14,8 ± 3,1 | Six Nations (ancien rapport) : 14 |
| Pénalités concédées | 25,2 ± 3,4 | — |
| Franchissements | 11,4 ± 3,1 | — |
| Cartons jaunes | 0,6 | — |

Résultats variés : nuls (27-27), matchs serrés à 1–3 points, larges victoires (39-3), victoires de l'outsider (13-28).

**Lecture honnête.** Contrairement à l'hypothèse de départ, les sources trouvées ne montrent pas que 177 rucks et 318 plaquages (Core 3.8) soient excessifs : un match professionnel compte environ 180 rucks/mauls et 300 à 345 plaquages. Le défaut réel du Core 3.8 était ailleurs (12 touches au lieu d'environ 23). Le moteur V2 est dans les bons ordres de grandeur pour les touches, les mêlées, les plaquages, le temps de jeu effectif et les points. **Il reste trop riche en rucks (≈ 255 contre ≈ 180)** : les temps de jeu sont un peu trop courts.

### Sources de calibration
Le site world.rugby n'était pas joignable depuis l'environnement de développement : les chiffres viennent de rapports et d'articles secondaires, d'années différentes, à vérifier sur les rapports officiels les plus récents.
- World Rugby, analyses statistiques du Tournoi des Six Nations (ancien rapport cité : 23 touches, 14 mêlées, 181 rucks/mauls) — https://resources.world.rugby/worldrugby/document/2022/01/26/16fb40d2-2ee9-464c-90cc-e74d52d99796/6_Nations_analysis_2017.pdf
- Top 14 2025-26, bilan de mi-saison (639 essais en 91 matchs, 56,5 points/match) — https://dicodusport.fr/blog/essais-points-attaque-plaquages-les-chiffres-marquants-du-top-14-a-mi-parcours/
- Premiership, temps de jeu effectif ≈ 38 min — https://www.rugbypass.com/plus/has-ball-in-play-time-reached-its-optimal-level/
- URC 2025-26, 344,2 plaquages par match — https://www.vftt.co.za/post/fine-margins-fierce-rivalries-and-more-attacking-rugby-in-the-urc
- URC 2022-23, étude d'une équipe : 38 min 30 de jeu effectif — https://www.mdpi.com/2076-3417/16/22/11236

### Influence du niveau et des tactiques
- 80 contre 72 : 7 victoires sur 10 pour le favori (le résultat n'est pas écrit d'avance).
- Modèle rapide (matchs IA) contre moteur complet, à niveau égal : 50,0 contre 52,2 points et 6,2 contre 6,8 essais (`tests/calibrate_quick_report.json`).

## 2. Visuel — Chromium, 4 formats (`tests/visual_qa_report.json`, `tests/captures/`)

| Format | Canvas (px réels) | Images/s mesurées | Erreurs JS |
|---|---|---|---|
| PC 1366×768 | 1366×768 | 60 | 0 |
| Tablette 1024×768 (×2) | 2048×1536 | 60 | 0 |
| Mobile paysage 852×393 (×3) | 2130×983 | 60 | 0 |
| Mobile portrait 393×852 (×3) | 983×2130 | 60 | 0 |

Ces mesures sont faites en Chromium sans limite matérielle : elles ne garantissent pas 60 i/s sur un téléphone d'entrée de gamme.

Captures réelles : ruck, mêlée en poussée, touche, ballon en l'air, plaquage, caméras tactique / terrain entier / proche, statistiques, panneau tactique, pour chaque format. Comparaison `comparaison_avant_apres.jpg` (V1.6 / V2.0, même match). Séquence animée calculée image par image : `RM27_V2_sequence_match.gif` / `.mp4` (15 s : mêlée, mêlée à refaire, attaque en leurre, ligne défensive, ruck).

## 3. Gestion — Chromium (`tests/career_qa_report.json`, `career_qa.log`)

- Carrière créée avec la **V1.6 d'origine** (une journée jouée), puis chargée par la V2.0 : club, 8 résultats et trésorerie identiques ; copie de secours `…-avant-v2` créée.
- Toutes les pages ouvertes sans erreur (effectif, tactique, transferts, finances, calendrier, championnats, staff, accueil).
- Entraînement : défense prioritaire + intensité 120 % → bonus défense +3,8 au match suivant.
- Négociation réelle via l'interface : transfert accepté, effectif 49 → 50, indemnité débitée.
- **5 saisons enchaînées** (Brive, Pro D2, 30 journées par saison, matchs du club joués par le moteur complet, ≈ 20 s par saison) : âge +1 à chaque intersaison, un jeune passe de 64 à 76, effectif réel stable (41 à 47 joueurs), clubs IA qui recrutent (30 à 107 signatures par intersaison), espoirs formés, objectifs de la direction recalculés.
- Sauvegarde puis rechargement de la page : données identiques ; taille ≈ 960 Ko après 6 saisons.

## 4. Limites connues (non masquées)

1. **Rucks trop nombreux** (≈ 255 contre ≈ 180 réels) ; le 50:22 est codé mais quasiment jamais réussi (0 sur 12 matchs).
2. Deux sauts de position résiduels sur 367 924 pas, en fin de maul.
3. **Performances** : un match complet calculé sans affichage prend ≈ 3 s (Node). La simulation d'une journée inclut le match du club au moteur complet ; les autres matchs utilisent le modèle rapide calibré, **pas** le moteur à 30 agents.
4. Dessin vectoriel 2D stylisé, pas d'animation par capture de mouvement ; la mêlée et le maul sont lisibles mais compacts en vue large.
5. Les joueurs « Joueur test » de la V1.6 (places sans identité vérifiée) restent signalés comme tels ; les espoirs créés par le jeu ont des noms fictifs, étiquetés « Espoir ».
6. Équilibre économique : sur 5 saisons passives (aucun investissement ni vente), la trésorerie de Brive baisse de 7,6 à 1,4 M€. Les prolongations automatiques ont été modérées ensuite, mais l'équilibre sur 15–20 saisons **n'est pas validé** par ce test court.
7. Pas de test sur appareil physique (Android, iPad, Windows) ni d'installation PWA réelle : elle exige une publication HTTPS.
8. Les notes de réalisme visées (8,5/10…) ne sont pas auto-attribuées : elles doivent être jugées en jouant.

## 5. Rejouer les tests
```
python3 tools/build.py
node tests/engine_tests.js 12 101 > tests/engine_tests_report.json
node tests/calibrate_quick.js 10
node tests/visual_qa.js
node tests/career_qa.js 5
node tests/record_sequence.js 150
node tests/compare_v16.js
```


---

## V2.1 — Tests ajoutés (exécutés)

- **Non-régression moteur, 12 matchs** (`tests/engine_tests_report.json`) : 45,4 ± 11,5 points ; 5,8 ± 1,6 essais ; 34,2 min de jeu effectif ; 245 rucks ; 285 plaquages ; 27 touches ; 15,6 mêlées ; 9,3 franchissements ; score et chronomètre toujours cohérents ; 0 passe en avant lancée ; 2 sauts de position sur 362 377 pas.
- **Combinaisons** (`tests/setpiece_qa_report.json`, Chromium) : la fenêtre s'ouvre à la touche offensive (choix du 3e sauteur → 9 combinaisons compatibles ; « Lancer au fond, charge du n°8 » appliquée) et à la mêlée offensive (15 combinaisons ; « Départ du n°8 côté fermé » appliquée) ; la pénalité affiche l'explication du capitaine ; le plan « jeu au pied » change immédiatement les consignes effectives ; 0 erreur JS. Captures : `combinaison_touche.jpg`, `combinaison_melee.jpg`, `penalite_capitaine.jpg`, `plan_de_jeu_direct.jpg`.
- **Décisions du capitaine** (`tests/decision_tests_report.json`) : à 2 m de l'en-but → mêlée ou pénalité jouée vite (jamais la touche), y compris quand il manque un essai pour le bonus ; mené de 2 à la 78e à 5 m → poteaux ; mené de 5 à la 79e → touche ; mené de 9 à la 72e → poteaux pour le bonus défensif.
- **Météo et plan de jeu** (`tests/weather_tests_report.json`, 6 matchs par condition) : pluie forte → en-avant 20,3 contre 15,7, passes 252 contre 274, essais 3,5 contre 4,7 ; plan « jeu à la main » → 57,5 jeux au pied et 340 passes, contre 72,3 et 301 pour « jeu au pied ».
- **Carrière, 3 saisons** (`tests/career_qa.log`) : sans erreur, sauvegarde identique après rechargement.

Limites V2.1 : les combinaisons influencent les courses et le porteur, mais le moteur ne garantit pas que chaque combinaison « réussisse » visuellement comme au tableau noir (la défense réagit). L'effet du vent sur les jeux au pied est modéré (quelques mètres) et n'est pas appliqué aux tirs au but, dont la réussite reste calculée sans vent. Les rucks restent trop nombreux (≈ 245).

---

## V2.2 — Tests (exécutés)

- `tests/fluidite_report.json` (3 matchs) : virages brusques 49 pour 1 000 pas en mouvement (V2.1 : 189) ; joueurs du mauvais côté du ballon 6,5 % des échantillons (V2.1 : 8,0 %), essentiellement des joueurs en train de se replacer dans les 2 s suivant un plaquage ou une récupération.
- Non-régression 10 matchs (`tests/engine_tests_report.json`) : 52,4 ± 16 points, 6,7 ± 2,6 essais, 33 min de jeu effectif, 223 rucks, 260 plaquages, 26 touches, 15,7 mêlées, 11,9 franchissements ; score et chronomètre cohérents ; 1 saut de position sur 298 901 pas.
- Navigateur : combinaisons et parcours de base sans erreur JS ; séquence au format téléphone `tests/captures/RM27_V2_1_sequence_telephone.mp4` / `.gif`.
- Limite : après une réception de coup de pied, un regroupement assez dense se forme encore autour du premier ruck.
