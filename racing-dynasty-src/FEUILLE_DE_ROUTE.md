# Racing Dynasty — Feuille de route (après V0.2)

État au 22/11/2026 : V0.2 en ligne sur https://jumerca.github.io/trace-enquetes/racing-dynasty/
Ce qu'il reste à vérifier, corriger et développer, par ordre de priorité.

## 0. À vérifier sur le téléphone du joueur (bloquant)
- [ ] Images/s réelles sur Android 4 Go (compteur dans Paramètres), en Suivre / TV / Circuit, ×1 et ×4.
- [ ] Le son : volume, agrément, coupure correcte quand l'appli passe en arrière-plan.
- [ ] Installation PWA et passage V0.1 → V0.2 sans perte de sauvegarde.
- [ ] Lisibilité en portrait (taille des voitures, panneau classement qui masque la piste).

## 1. Équilibrage de la course (priorité haute)
- [ ] Trop peu de dépassements à Port-Azur et sous la pluie (1 à 3 par course) : élargir les zones, différencier
      davantage le rythme pneus neufs / usés.
- [ ] Départ : premier virage trop « sage » ; ajouter des gains/pertes de places selon le mental et l'envol.
- [ ] Vérifier l'écart d'usure entre Tendre / Médium / Dur pour que plusieurs stratégies soient viables.
- [ ] Gain des réglages (≈1 s/tour) peut-être trop fort par rapport à l'écart des voitures.

## 2. Course : profondeur de simulation
- [ ] Voiture de sécurité / drapeaux jaunes après accident (regroupement du peloton).
- [ ] Météo évolutive pendant la course (pluie qui arrive, piste qui sèche) avec choix des pneus au bon moment.
- [ ] Contacts légers et dégâts (aileron cassé → arrêt forcé), pénalités.
- [ ] Consignes d'équipe : « laisser passer le coéquipier », « défendre la position ».
- [ ] Radio de l'ingénieur : messages contextuels (pneus en fin de vie, écart avec le rival, météo).
- [ ] Reprise d'une course sauvegardée plus rapide (instantané d'état au lieu de tout recalculer).

## 3. Rendu et ambiance
- [ ] Phase de tour de formation et voitures qui se placent sur la grille.
- [ ] Ralenti / rediffusion des dépassements (la simulation déterministe le permet).
- [ ] Traces de pneus, étincelles, plus d'animations du public et des drapeaux de commissaires.
- [ ] Course de nuit (un circuit éclairé) et variantes jour/crépuscule.
- [ ] Livrées plus détaillées (numéro sur la voiture, logo du sponsor principal).
- [ ] Musique de menu et habillage sonore des écrans de gestion.

## 4. Gestion (développer le jeu)
- [ ] Marché des transferts vivant : les écuries IA recrutent et libèrent des pilotes à l'intersaison.
- [ ] Centre de développement : projets de R&D sur plusieurs courses au lieu d'évolutions instantanées.
- [ ] Personnel : ingénieur de course, chef mécanicien, directeur technique (qualité des arrêts, des réglages).
- [ ] Moral et forme des pilotes, relation avec le directeur, demandes de revalorisation.
- [ ] Jeunes pilotes / académie, pilote de réserve en cas de blessure.
- [ ] Sponsors : négociation, objectifs par course, renouvellement en fin de saison.
- [ ] Calendrier plus long (8 à 10 GP) et nouveaux circuits.
- [ ] Statistiques et palmarès détaillés (records, victoires, pole positions par pilote et par écurie).

## 5. Technique
- [ ] Synchronisation optionnelle des sauvegardes entre appareils (export/import en un geste via un fichier partagé).
- [ ] Tests E2E dans la CI GitHub (Playwright) à chaque pull request.
- [ ] Séparer le bundle (React / PixiJS) pour accélérer le premier chargement mobile.
- [ ] Traduction anglaise.
- [ ] Préparer les autres disciplines automobiles (endurance, rallye) : le moteur « tracé + décalage latéral » est
      réutilisable ; à isoler en module générique.
