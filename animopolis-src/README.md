# Animopolis — sources

Le jeu publié (`../animopolis/index.html`) est **généré** à partir des fichiers de ce dossier.
Ne modifie pas `index.html` à la main : modifie les sources puis relance le script de construction.

## Construire

```bash
./build.sh                      # build daté de maintenant, écrit dans ../animopolis/
VERSION=2.2 ./build.sh          # change aussi le numéro de version (sinon : fichier VERSION)
BUILD=202611120921 OUT=/tmp/x ./build.sh   # build reproductible vers un autre dossier
```

Le script écrit trois fichiers dans `../animopolis/` :
- `index.html` : `head.html` + `parts/*.js` (dans l'ordre des numéros) + `tail.html`, avec `APP_VERSION` et `APP_BUILD` remplacés ;
- `sw.js` : `sw.tpl.js` daté avec le numéro de build (change à chaque build, ce qui renouvelle le cache de l'application installée) ;
- `version.json` : lu par le jeu pour savoir si une version plus récente existe.

**À chaque modification publiée, relance `build.sh`** : un nouveau numéro de build est ce qui déclenche la mise à jour sur les téléphones et affiche la bonne version sur la page d'accueil. Puis fusionne dans `main` : GitHub Pages publie le dossier `animopolis/`.

## Les morceaux (`parts/`, concaténés dans cet ordre)

| Fichier | Contenu |
|---|---|
| `00-base.js` | constantes, couleurs, générateur aléatoire déterministe, primitives de dessin |
| `01-chars.js` | têtes d'animaux, chapeaux, objets tenus, poses, silhouettes, queues, `drawChar` |
| `02-world.js` | moteur isométrique (projection, tri en profondeur), décor commun, bâtiments, foule |
| `03-city.js` | décors de fête foraine, quartiers Le Centre et Le Port, enquêtes de départ |
| `04-city2.js` | quartier La Gare, enquête Zorbo et ses scènes |
| `05-city3.js` | quartier La Colline (forêt, village, château) |
| `06-urban.js` | canal, ponts, rond-point, rue en biais, oiseaux |
| `07-ombre.js` | fil rouge de l'Ombre : indices et enquête finale |
| `08-more.js` | enquêtes supplémentaires (vase, chapeau, phare, pêche, tickets…) |
| `09-island.js` | quartier L'Île aux Tortues |
| `10-decoys.js` | questions énigmatiques des enquêtes difficiles et sosies des suspects |
| `11-ui.js` | rendu par tuiles, caméra, gestes, cartes d'enquête, dossiers, étoiles, carnet, défi chrono |
| `12-home.js` | accueil, parties sauvegardées, options, installation, version et mises à jour |

Autres fichiers : `head.html` (balises, styles, structure de la page), `tail.html` (fermeture), `sw.tpl.js` (service worker), `VERSION`.

## Ajouter une enquête

1. Ajoute l'objet dans `CASES.push({...})` (`id`, `dist` = numéro de quartier, `diff` 1 à 3, `intro`, `cast`, `steps`, `outro`).
2. Pour chaque étape, appelle `setT('id', numéro_étape, u, v, rayon)` à l'endroit où tu poses la scène (ou `setTxy` en coordonnées écran). Une étape « qui est le coupable ? » a `choice` et `ans` au lieu d'une cible.
3. Place les personnages avec `addChar(u, v, personnage, {…})`.
4. Reconstruis, puis lance le test ci-dessous.

## Tester

```bash
npm i playwright                # une fois, hors dépôt
node tests/playthrough.js       # rejoue toutes les enquêtes de zéro à la fin
```

Le test résout toutes les étapes dans l'ordre d'ouverture et vérifie que les 6 quartiers s'ouvrent, que les 5 indices de l'Ombre sont réunis et que l'enquête finale se termine, sans erreur. On peut aussi le lancer sur le site publié : `ANIMOPOLIS_URL=https://jumerca.github.io/trace-enquetes/animopolis/ node tests/playthrough.js`.
