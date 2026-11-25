# Journal des modifications

## 0.1.1 — Qualité graphique de la carte et ergonomie (25 novembre 2026)

- **Carte entièrement redessinée** : sol continu sans effet « damier » (variations douces, touffes
  d'herbe, sillons des champs, fleurs au printemps), forêts et champs en masses naturelles, berges,
  eau animée, ponts avec garde-corps, voie ferrée (ballast, traverses, rails), chaussées avec
  bordures, marquage central et passages piétons aux carrefours, réverbères.
- **Bâtiments détaillés** selon le quartier : toits à deux ou quatre pans, ardoise, tuile, zinc,
  toits-terrasses avec édicules, sheds industriels, cheminées, lucarnes, fenêtres encadrées, vitrines
  avec auvents colorés, portes, ombres portées ; clocher, drapeau et enseigne du commissariat ;
  îlots bâtis denses avec trottoirs libres le long des rues.
- **Véhicules en volume** dans les quatre directions (phares à l'avant, feux rouges à l'arrière,
  gyrophare, livrée, cabine vitrée), textures haute définition avec mipmaps (nettes au zoom comme
  au dézoom, plus de pixellisation).
- **Circulation crédible** : conduite à droite sur une voie décalée, virages lissés, distances de
  sécurité, apparition et disparition en fondu, véhicules de police garés gyrophare allumé sur les lieux.
- **Piétons** sur les trottoirs le long des façades, traversée aux passages, trajets entre lieux,
  densité selon l'heure et la météo, orientation correcte.
- **Ergonomie** : plus aucun défilement horizontal ; menu latéral qui tient sans défilement sur
  ordinateur ; sur mobile, barre de 5 boutons et grille « ☰ Menu » de toutes les rubriques ; HUD sur
  deux lignes ; tableaux affichés en fiches sur petit écran ; onglets en liste déroulante et étapes
  résumées dans les dossiers ; tableau d'enquête zoomable et déplaçable au doigt ; fenêtres
  d'entretien toujours au premier plan ; panneaux qui ne recouvrent plus le menu sur tablette ;
  page verrouillée (aucun défilement parasite du navigateur).
- Contrôle automatique de l'ergonomie ajouté au parcours e2e (ordinateur, mobile, petit mobile 360 px,
  tablette) : aucun débordement horizontal, menu sans défilement.

## 0.1.0 — V0.1 jouable (25 novembre 2026)

Première tranche verticale jouable de *Brigade criminelle Tycoon — Sous haute tension*.

- Logo original, écran titre, création de carrière (identité, portrait, expérience, formation,
  spécialité, style de management, réputation), six époques (1975 → 2025), cinq tailles de ville,
  scénario de référence « Saint-Clair 1995 » et partie libre, trois niveaux d'assistance.
- Moteur de simulation indépendant du rendu, pas de 10 minutes, graine reproductible.
- Commissariat isométrique sur deux étages (troisième constructible) : 16 pièces initiales, mobilier
  détaillé, équipements animés, murs en coupe, portes, escalier, navigation A*, véhicules qui
  sortent du garage, visiteurs, éclairage nocturne, saisons et météo.
- Construction : 21 types de pièces avec effets fonctionnels, collisions, porte automatique,
  durée de travaux ; ajout de mobilier sans bloquer la circulation ; surélévation.
- Carte isométrique de Saint-Clair (48 × 48 cases, 14 quartiers, 55 lieux avec horaires),
  circulation automobile, piétons, véhicules de police en mission, marqueurs d'affaires.
- Personnel : 12 personnes au départ, 18 compétences sur 20, personnalité, fatigue, moral,
  relations, grilles indiciaires, carrières détaillées, demandes (avancement, mutation, formation),
  retraites, vivier de recrutement (sorties d'école, mutations, spécialistes), formations.
- Planning : équipes de jour, de nuit, d'après-midi, repos, astreintes, congés, arrêts maladie.
- Unités spécialisées créées, réorganisées, avec responsable et domaine.
- Générateur d'affaires : 14 modèles procéduraux (dont décès suspect naturel ou non, disparition
  volontaire, hospitalisée ou séquestration, fausse déclaration, dossier ancien) + grande affaire
  « Les ombres de Saint-Clair » en quatre dossiers (trois liés, une coïncidence).
- Cycle d'enquête en 14 étapes, actions, autorisations judiciaires, laboratoire avec file d'attente,
  traçabilité des scellés, IA des enquêteurs (propositions, décisions, renforts, abandon d'hypothèse).
- Entretiens supervisés (7 approches, droits, avocat, droit au silence), tableau d'enquête
  interactif, transmission au parquet, compléments d'enquête, jugements, réouvertures.
- Budget public par poste, masse salariale séparée, demandes de moyens ; médias fictifs autonomes et
  communication institutionnelle ; événements dynamiques ; statistiques et évaluations annuelles.
- Sauvegardes IndexedDB (automatique + 3 emplacements), export/import ; PWA installable hors ligne.
- 30 tests automatisés, parcours navigateur de bout en bout (bureau et mobile).
