# Racing Dynasty — Feuille de route

État au 22/11/2026 : V0.8 en ligne sur https://jumerca.github.io/trace-enquetes/racing-dynasty/
Ce qu'il reste à vérifier, corriger et développer, par ordre de priorité.

## 0. À vérifier sur le téléphone du joueur (bloquant)
- [ ] Images/s réelles sur Android 4 Go (compteur dans Paramètres), en Suivre / TV / Circuit, ×1 et ×4.
- [ ] Le son : volume, agrément, coupure correcte quand l'appli passe en arrière-plan.
- [ ] Installation PWA et passage V0.1 → V0.2 sans perte de sauvegarde.
- [ ] Lisibilité en portrait (taille des voitures, panneau classement qui masque la piste).

## 1. Équilibrage de la course — fait en V0.3 (à affiner avec vos retours)
- [x] Trop peu de dépassements à Port-Azur et sous la pluie (1 à 3 par course) : élargir les zones, différencier
      davantage le rythme pneus neufs / usés.
- [x] Départ : premier virage trop « sage » ; ajouter des gains/pertes de places selon le mental et l'envol.
- [x] Vérifier l'écart d'usure entre Tendre / Médium / Dur pour que plusieurs stratégies soient viables.
- [x] Gain des réglages (≈1 s/tour) peut-être trop fort par rapport à l'écart des voitures.

## 2. Course : profondeur de simulation — fait en V0.3
- [x] Voiture de sécurité / drapeaux jaunes après accident (regroupement du peloton).
- [x] Météo évolutive pendant la course (pluie qui arrive, piste qui sèche) avec choix des pneus au bon moment.
- [x] Contacts légers et dégâts (aileron cassé → arrêt forcé), pénalités.
- [x] Consignes d'équipe : « laisser passer le coéquipier », « défendre la position ».
- [x] Radio de l'ingénieur : messages contextuels (pneus en fin de vie, écart avec le rival, météo).
- [x] Reprise d'une course sauvegardée plus rapide (instantané d'état au lieu de tout recalculer).

### Constats restants après la V0.3
- [ ] Deux arrêts restent rarement rentables sur 6 à 12 tours (réaliste pour des courses courtes).
- [ ] Valbrune et Kharam : ~35-45 dépassements en 12 tours, peut-être encore un peu élevé.
- [x] Drapeaux jaunes locaux (fait en V0.6).

## 3. Rendu et ambiance — fait en V0.4
- [x] Phase de tour de formation et voitures qui se placent sur la grille.
- [x] Ralenti / rediffusion des dépassements (la simulation déterministe le permet).
- [x] Traces de pneus, étincelles, plus d'animations du public et des drapeaux de commissaires.
- [x] Course de nuit (un circuit éclairé) et variantes jour/crépuscule.
- [x] Livrées plus détaillées (numéro sur la voiture, logo du sponsor principal).
- [x] Musique de menu et habillage sonore des écrans de gestion.

## 4. Gestion — fait en V0.4
- [x] Marché des transferts vivant : les écuries IA recrutent et libèrent des pilotes à l'intersaison.
- [x] Centre de développement : projets de R&D sur plusieurs courses au lieu d'évolutions instantanées.
- [x] Personnel : ingénieur de course, chef mécanicien, directeur technique (qualité des arrêts, des réglages).
- [x] Moral et forme des pilotes, relation avec le directeur, demandes de revalorisation.
- [x] Jeunes pilotes / académie, pilote de réserve en cas de blessure.
- [x] Sponsors : négociation, objectifs par course, renouvellement en fin de saison.
- [x] Calendrier plus long (8 à 10 GP) et nouveaux circuits.
- [x] Statistiques et palmarès détaillés (records, victoires, pole positions par pilote et par écurie).

## 4 bis. Gestion sur le long terme — fait en V0.7
- [x] Installations (soufflerie, simulateur, usine) : chantiers, entretien, plus de projets et meilleures chances.
- [x] Presse BD après chaque GP, déclarations des pilotes, rivalités qui influencent le moral.
- [x] Contrat du directeur, confiance des actionnaires, limogeage, débauchage par une plus grande écurie.
- [x] Économie rééquilibrée pour 8 GP (simulation de 2 saisons par difficulté et profil de budget).
- [x] Vue cockpit pseudo-3D.
- [ ] À affiner avec une vraie saison jouée par vous : niveau de sévérité des actionnaires, prix des installations.
- [x] Négociation du contrat du directeur (salaire, prime), conférences de presse à choix multiples (V0.8).
- [x] Vues hélicoptère et bord de piste (V0.8).
- [ ] Idée suivante : offres de motoristes (moteur client ou partenariat d'usine).

## 5. Technique
- [x] Partage de la sauvegarde en un geste (bouton « Partager ») puis import sur l'autre appareil (V0.8).
- [x] Tests (typecheck, unitaires, build, E2E Android) dans la CI GitHub à chaque pull request (V0.8).
- [x] Bundle séparé : PixiJS chargé seulement pour la course (V0.8).
- [ ] Traduction anglaise.
- [ ] Préparer les autres disciplines automobiles (endurance, rallye) : le moteur « tracé + décalage latéral » est
      réutilisable ; à isoler en module générique.
