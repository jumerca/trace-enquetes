# Journal des modifications

## 0.2.0 — 40 modèles d'affaires et progression de carrière (25 novembre 2026)

- **40 modèles d'affaires** (14 → 40), couvrant les 15 types du cahier des charges :
  cambriolages (pavillon, appartement, commerce de nuit), vols (commerce, à la tire, chantier,
  exploitation agricole, hôtel), escroqueries (aînés, faux placement, fausse location saisonnière,
  fausses factures de garage), fraudes documentaires (état civil, certificats de formation,
  testament), trafic d'œuvres (substitution, objets d'église, faussaire), sabotages (usine,
  matériel de spectacle, accident de site — défaillance ou malveillance), extorsions (commerce,
  chantage d'élu, racket d'entreprise), affaires financières (abus de biens, association,
  subventions), vols de véhicules (voiture, utilitaire, collection, fausse déclaration à l'assurance),
  affaires numériques (usurpation, intrusion, petites annonces, selon l'époque), disparitions
  (inquiétante, randonneur), décès suspect, mort violente (non graphique), fausse déclaration,
  dossier ancien. Chacun avec variations de personnes, lieux, horaires, auteur et fausses pistes.
- **Progression de carrière** en six échelons : brigade de sûreté, service de police judiciaire,
  brigade départementale, unité régionale, direction spécialisée, coordination nationale fictive.
  Propositions d'avancement chaque 1er janvier selon l'ancienneté dans le poste, les évaluations,
  la réputation, le moral des équipes et le respect des procédures ; acceptation sur place (ressort
  élargi, moyens relevés, renforts) ou **mutation dans une ville plus grande** (nouvelle brigade,
  même commandant, même date, même carrière) ; refus possible. Grades sur une échelle unique.
- Retraite du commandant à 65 ans, bilan de carrière ; partie poursuivable à titre honoraire.
- Annonce des changements d'époque (techniques de laboratoire, communications) au fil des décennies.
- Nouvel écran « Carrière » : poste, critères d'avancement avec jauges, propositions, échelons,
  parcours, évaluations, évolution des techniques par décennie.
- Corrections trouvées par la simulation d'une carrière complète : boucle de l'IA déléguée qui
  réécrivait son rapport, demandes de presse jamais purgées et journaux non plafonnés (la sauvegarde
  grossissait sans limite), volume d'affaires compté deux fois dans les grandes villes, nouvelle
  structure sous-dotée après une mutation.
- Sauvegardes : format v2, migration automatique des parties v1.

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
