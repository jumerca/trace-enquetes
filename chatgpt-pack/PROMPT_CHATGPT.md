# À coller dans ChatGPT (avec le fichier `animopolis-site.zip` joint)

> Je te joins `animopolis-site.zip` : c'est un jeu d'enquête **déjà terminé**, une application web statique (HTML, JavaScript, images), sans serveur ni base de données.
> Je veux le mettre en ligne en **HTTPS** pour pouvoir l'installer sur mon téléphone, ma tablette et mon ordinateur, avec son **logo** (fichiers `icon-*.png`, `apple-touch-icon*.png`, `icon.svg`, `favicon*`).
>
> Guide-moi pas à pas, en français, avec des mots simples, sans supposer que je sais coder. Pose-moi une question à la fois.
>
> **Ce que contient le zip (à la racine du site)** :
> - `index.html` : tout le jeu (une seule page, ~450 Ko) ;
> - `manifest.webmanifest` : nom, couleurs et icônes de l'application installable ;
> - `sw.js` : le service worker (mode installé, mises à jour automatiques) ;
> - `version.json` : numéro de version lu par le jeu pour proposer « Mettre à jour » ;
> - icônes et logo : `icon.svg`, `icon-48` à `icon-1024.png`, `icon-maskable-*`, `apple-touch-icon*.png`, `favicon*` ;
> - `_headers` : règles de cache utiles si je choisis Netlify (le service worker et `version.json` ne doivent pas être mis en cache).
>
> **Règles à respecter** :
> 1. Tous les fichiers du zip doivent rester **au même niveau**, à la racine du site (ne pas les mettre dans un sous-dossier de plus).
> 2. Le site doit être servi en **HTTPS** (obligatoire pour l'installation et le service worker).
> 3. Ne modifie pas `index.html` à la main.
> 4. Les mises à jour futures : on remplace les fichiers par ceux d'un nouveau zip, et le jeu propose la mise à jour tout seul.
>
> **Ce que je te demande** :
> 1. Compare 3 hébergements gratuits (Netlify Drop, GitHub Pages, Cloudflare Pages) pour mon cas, et recommande-m'en un seul (le plus simple : glisser-déposer).
> 2. Explique-moi comment y mettre le site, puis comment obtenir l'adresse https.
> 3. Explique-moi comment vérifier que c'est bon : le logo apparaît dans l'onglet, le bouton « Installer l'application » apparaît, et la version s'affiche en bas de la page d'accueil.
> 4. Explique-moi comment l'installer sur Android (Chrome), iPhone/iPad (Safari → Partager → Sur l'écran d'accueil) et ordinateur (Chrome ou Edge).
> 5. Explique-moi comment envoyer une mise à jour plus tard.
>
> Remarque honnête : tu ne peux pas publier le site à ma place, c'est moi qui fais les manipulations sur le site d'hébergement. Dis-moi simplement quoi cliquer.

---

## Pour toi (pas pour ChatGPT)

- `animopolis-site.zip` : à joindre à ChatGPT, et c'est aussi ce que tu glisses sur Netlify Drop (https://app.netlify.com/drop) : **dézippe d'abord** et glisse le **dossier** (les fichiers doivent être à la racine).
- `animopolis-sources.zip` : les sources du jeu (pour modifier ensuite). Ils se reconstruisent avec `./build.sh` (Node n'est pas nécessaire pour jouer, seulement pour reconstruire).
- `logo-512.png` et `logo.svg` : le logo seul, pour l'avoir sous la main.
- Le jeu est déjà en ligne sur GitHub Pages : https://jumerca.github.io/trace-enquetes/animopolis/ (c'est déjà du HTTPS).
- Version incluse : voir `animopolis/version.json` dans le zip.
