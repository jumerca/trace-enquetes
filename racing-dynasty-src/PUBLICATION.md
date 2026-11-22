# Publication HTTPS

Rien n'a été déployé depuis cette session : les procédures ci-dessous sont prêtes mais non exécutées.

## Option A — Vercel (recommandée)

1. Sur vercel.com : *Add New… → Project* → importer le dépôt GitHub `trace-enquetes`.
2. **Root Directory : `racing-dynasty-src`** (le dépôt contient plusieurs jeux).
3. Vercel lit `vercel.json` : framework Vite, `npm ci`, `npm run build`, sortie `dist`, en-têtes de cache
   (`sw.js`, `index.html` et `version.json` jamais mis en cache longue durée ; `assets/` immuables).
4. Déployer. Vercel fournit l'URL HTTPS (`https://<projet>.vercel.app`) : HTTPS est obligatoire pour le service
   worker et l'installation PWA.
5. Vérifier sur l'URL publique : Chrome DevTools → *Application* → *Manifest* (icônes, installable) et
   *Service Workers* (activé), puis Lighthouse → PWA.

En ligne de commande (alternative) : `npm i -g vercel && cd racing-dynasty-src && vercel` puis `vercel --prod`.

## Option B — GitHub Pages (comme les autres jeux du dépôt)

```bash
cd racing-dynasty-src
npm ci && npm run build:pages   # copie dist/ dans ../racing-dynasty
git add ../racing-dynasty && git commit -m "Racing Dynasty : publication" && git push
```

Le jeu est alors servi sous `https://<compte>.github.io/trace-enquetes/racing-dynasty/` (chemins relatifs,
`base: './'`).

## Mises à jour sans perte de sauvegarde

* Chaque build génère un `sw.js` dont le nom de cache contient la version + l'horodatage du build : l'ancien cache
  est supprimé à l'activation, le `localStorage` (sauvegardes) n'est jamais touché.
* Paramètres → *Rechercher une mise à jour* déclenche la vérification et active la nouvelle version.
* Si une future version modifie le format de carrière : incrémenter `SAVE_SCHEMA` dans `src/game/save.ts` et
  ajouter la fonction correspondante dans `MIGRATIONS` (jamais changer les clés de stockage).

## Validation sur appareil réel (à faire)

1. Ouvrir l'URL HTTPS sur un Android 4 Go, Chrome à jour → *Installer l'application*.
2. Paramètres → cocher *Afficher le compteur d'images/s*, qualité *Auto* (passe en *Économie* sur ≤ 4 Go / ≤ 4 cœurs).
3. Lancer un GP, vue *Suivre* puis *Circuit*, en ×1 et ×4 : relever le compteur i/s (objectif ≥ 30).
4. Si < 30 i/s : essayer qualité *Économie* et plafond 30 i/s ; noter le modèle d'appareil et les valeurs.
