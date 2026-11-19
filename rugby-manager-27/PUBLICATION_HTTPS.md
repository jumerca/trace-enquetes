# Publier Rugby Manager 27 V2.0 en HTTPS

## Ce qu'il faut publier
Le dossier `dist/PWA/` (ou la racine de `rugby-manager-27/`, qui contient la même chose) :
`index.html`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`.
Le fichier `dist/Rugby_Manager_27_V2_0.html` est la version autonome hors connexion (double-clic) ; elle ne s'installe pas comme application.

## 1. Protéger les sauvegardes AVANT toute mise à jour
Les sauvegardes sont stockées dans le navigateur **par adresse de site** (origine). Changer d'adresse = repartir sans sauvegarde.
1. Dans l’ancienne version : menu **Base de données** → **Exporter ma carrière** (fichier JSON). Faites-le sur chaque appareil.
2. Publiez la V2.0 **à la même adresse** que la version précédente si possible : la carrière est alors reprise automatiquement (même clé de sauvegarde), et la V2 crée elle-même une copie `…-avant-v2`.
3. Si l'adresse change : **Base de données** → **Restaurer une carrière** avec le fichier exporté.

## 2. GitHub Pages (ce dépôt)
Le jeu est dans `rugby-manager-27/` sur la branche de travail. GitHub Pages ne le publie qu'une fois la branche **fusionnée dans la branche publiée** (`main`). Adresse : celle de GitHub Pages du dépôt suivie de `/rugby-manager-27/`. Vérifiez qu'elle s'ouvre en `https://`.

## 3. Autres hébergeurs (Netlify, Vercel, serveur personnel)
- Netlify / Vercel : déposer le contenu de `dist/PWA/` comme site statique (aucune commande de compilation).
- Serveur : copier les 5 fichiers dans un dossier servi en HTTPS ; type MIME `application/manifest+json` pour le manifeste si possible.

## 4. Installation
- **Android / Chrome** : ouvrir l'adresse → menu ⋮ → *Installer l'application*.
- **Windows / Edge ou Chrome** : icône d'installation dans la barre d'adresse.
- **iPad / iPhone (Safari)** : Partager → *Sur l'écran d'accueil*.

## 5. Mises à jour
Le service worker V2 charge la page depuis le réseau en priorité (mises à jour immédiates) et garde une copie pour le hors-ligne. Il ne touche jamais aux sauvegardes. À chaque nouvelle version, changer `CACHE` dans `src/v2/ui/sw.js`, puis relancer `python3 tools/build.py`.
