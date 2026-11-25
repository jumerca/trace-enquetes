// Prénoms et noms fictifs (combinaisons aléatoires ; toute ressemblance serait fortuite).
import type { Rng } from '../core/rng';
import type { Appearance } from './types';

const PRENOMS_F = ['Anne', 'Claire', 'Sophie', 'Isabelle', 'Nathalie', 'Sandrine', 'Valérie', 'Catherine', 'Hélène', 'Martine', 'Sylvie', 'Christine', 'Julie', 'Camille', 'Léa', 'Manon', 'Inès', 'Chloé', 'Sarah', 'Émilie', 'Aurélie', 'Céline', 'Laure', 'Marion', 'Nadia', 'Yasmina', 'Fatou', 'Agnès', 'Brigitte', 'Odile', 'Pauline', 'Lucie', 'Margaux', 'Élodie', 'Karine', 'Mireille', 'Josiane', 'Samia', 'Leïla', 'Mathilde'];
const PRENOMS_M = ['Jean', 'Pierre', 'Michel', 'Philippe', 'Alain', 'Patrick', 'Nicolas', 'Christophe', 'Laurent', 'Frédéric', 'Stéphane', 'Olivier', 'Thierry', 'Éric', 'Pascal', 'Julien', 'Thomas', 'Antoine', 'Hugo', 'Lucas', 'Maxime', 'Karim', 'Mehdi', 'Bruno', 'Didier', 'Gérard', 'Bernard', 'Yves', 'Marc', 'Vincent', 'Sébastien', 'Romain', 'Damien', 'Samuel', 'Rachid', 'Moussa', 'François', 'Denis', 'Gilles', 'Arnaud'];
const NOMS = ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon', 'Laurent', 'Lefèvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier', 'Morel', 'Girard', 'André', 'Mercier', 'Dupont', 'Lambert', 'Bonnet', 'François', 'Martinez', 'Legrand', 'Garnier', 'Faure', 'Rousseau', 'Blanc', 'Guérin', 'Muller', 'Henry', 'Roussel', 'Nicolas', 'Perrin', 'Morin', 'Mathieu', 'Clément', 'Gauthier', 'Dumont', 'Lopez', 'Fontaine', 'Chevalier', 'Robin', 'Masson', 'Sanchez', 'Gérard', 'Nguyen', 'Boyer', 'Denis', 'Lemaire', 'Duval', 'Joly', 'Gautier', 'Roger', 'Roche', 'Roy', 'Noël', 'Meyer', 'Lucas', 'Meunier', 'Jean', 'Perez', 'Marchand', 'Dufour', 'Blanchard', 'Marie', 'Barbier', 'Brun', 'Dumas', 'Brunet', 'Schmitt', 'Leroux', 'Colin', 'Fernandez', 'Pierre', 'Renard', 'Arnaud', 'Rolland', 'Caron', 'Aubert', 'Giraud', 'Leclerc', 'Vidal', 'Bourgeois', 'Renaud', 'Lemoine', 'Picard', 'Gaillard', 'Philippe', 'Leclercq', 'Lacroix', 'Fabre', 'Dupuis', 'Olivier', 'Rodriguez', 'Da Silva', 'Hubert', 'Louis', 'Charles', 'Guillot', 'Rivière', 'Le Gall', 'Guillaume', 'Adam', 'Rey', 'Moulin', 'Gonzalez', 'Berger', 'Lecomte', 'Ménard', 'Fleury', 'Deschamps', 'Carpentier', 'Julien', 'Benoît', 'Paris', 'Maillard', 'Marchal', 'Aubry', 'Vasseur', 'Le Roux', 'Renault', 'Jacquet', 'Collet', 'Prévost', 'Poirier', 'Charpentier', 'Royer', 'Huet', 'Baron', 'Dupuy', 'Pons', 'Paul', 'Laine', 'Carré', 'Breton', 'Rémy', 'Schneider', 'Perrot', 'Guyot', 'Barre', 'Marty', 'Cousin'];

export const PROFESSIONS = ['commerçant', 'employée de banque', 'enseignant', 'retraité', 'infirmière', 'artisan', 'chauffeur livreur', 'étudiante', 'comptable', 'agent municipal', 'ouvrier', 'agricultrice', 'médecin', 'serveur', 'agent immobilier', 'gardien d\'immeuble', 'antiquaire', 'notaire', 'architecte', 'technicien', 'journaliste', 'restauratrice', 'pharmacien', 'électricien', 'secrétaire', 'vendeur', 'conducteur de bus', 'aide-soignante', 'ingénieur', 'sans emploi'];

export function randomName(rng: Rng, sexe: 'F' | 'M') {
  return { prenom: rng.pick(sexe === 'F' ? PRENOMS_F : PRENOMS_M), nom: rng.pick(NOMS) };
}

export function randomAppearance(rng: Rng, sexe: 'F' | 'M', age: number): Appearance {
  const grey = age > 55 ? rng.chance(0.7) : age > 45 ? rng.chance(0.3) : false;
  return {
    skin: rng.int(0, 5),
    hair: grey ? 6 : rng.int(0, 5),
    hairStyle: sexe === 'F' ? rng.pick([3, 4, 5, 6]) : rng.pick(age > 50 && rng.chance(0.3) ? [2] : [0, 1, 2, 7]),
    outfit: rng.int(0, 9),
    build: rng.int(0, 2),
    glasses: rng.chance(age > 45 ? 0.45 : 0.2),
    beard: sexe === 'M' && rng.chance(0.25),
  };
}
