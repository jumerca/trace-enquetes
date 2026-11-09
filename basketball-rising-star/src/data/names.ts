/** Générateur de noms cohérents par origine. Toutes les identités sont fictives. */
export interface NameBank {
  first: string[];
  last: string[];
}

export const NATIONS: Record<string, { label: string; flag: string; names: string; cities: string[] }> = {
  FRA: { label: 'France', flag: '🇫🇷', names: 'fr', cities: ['Paris', 'Lyon', 'Marseille', 'Villeurbanne', 'Nanterre', 'Le Mans', 'Strasbourg', 'Limoges', 'Pau', 'Bordeaux', 'Lille', 'Nantes', 'Rouen', 'Dijon', 'Cholet', 'Monaco', 'Pointe-à-Pitre', 'Fort-de-France', 'Saint-Denis (Réunion)', 'Toulouse'] },
  ESP: { label: 'Espagne', flag: '🇪🇸', names: 'es', cities: ['Madrid', 'Barcelone', 'Valence', 'Malaga', 'Vitoria', 'Badalona', 'Murcie', 'Saragosse'] },
  ITA: { label: 'Italie', flag: '🇮🇹', names: 'it', cities: ['Milan', 'Bologne', 'Rome', 'Venise', 'Sassari', 'Trente', 'Brescia'] },
  GER: { label: 'Allemagne', flag: '🇩🇪', names: 'de', cities: ['Berlin', 'Munich', 'Bamberg', 'Ulm', 'Hambourg', 'Oldenbourg'] },
  GRE: { label: 'Grèce', flag: '🇬🇷', names: 'gr', cities: ['Athènes', 'Le Pirée', 'Thessalonique', 'Patras'] },
  TUR: { label: 'Turquie', flag: '🇹🇷', names: 'tr', cities: ['Istanbul', 'Ankara', 'Izmir', 'Bursa'] },
  USA: { label: 'États-Unis', flag: '🇺🇸', names: 'us', cities: ['Chicago', 'Los Angeles', 'New York', 'Atlanta', 'Houston', 'Philadelphie', 'Detroit', 'Baltimore'] },
  SRB: { label: 'Serbie', flag: '🇷🇸', names: 'rs', cities: ['Belgrade', 'Novi Sad', 'Niš'] },
  SEN: { label: 'Sénégal', flag: '🇸🇳', names: 'sn', cities: ['Dakar', 'Thiès', 'Saint-Louis'] },
  CMR: { label: 'Cameroun', flag: '🇨🇲', names: 'cm', cities: ['Yaoundé', 'Douala'] },
  BEL: { label: 'Belgique', flag: '🇧🇪', names: 'be', cities: ['Bruxelles', 'Anvers', 'Liège', 'Ostende'] },
  LTU: { label: 'Lituanie', flag: '🇱🇹', names: 'lt', cities: ['Kaunas', 'Vilnius', 'Klaipėda'] },
  CAN: { label: 'Canada', flag: '🇨🇦', names: 'us', cities: ['Toronto', 'Montréal', 'Vancouver'] },
};

export const NAME_BANKS: Record<string, NameBank> = {
  fr: {
    first: ['Hugo', 'Lucas', 'Théo', 'Nathan', 'Mathis', 'Enzo', 'Louis', 'Maxime', 'Axel', 'Yanis', 'Rayan', 'Ilan', 'Noah', 'Adam', 'Kylian', 'Malik', 'Bastien', 'Clément', 'Florian', 'Romain', 'Jordan', 'Kévin', 'Thomas', 'Alexis', 'Moussa', 'Ibrahim', 'Mamadou', 'Killian', 'Sacha', 'Timothé', 'Gaël', 'Léo', 'Elie', 'Yohan', 'Samuel', 'Kenzo', 'Amadou', 'Bilal', 'Dylan', 'Teddy'],
    last: ['Martin', 'Bernard', 'Dubois', 'Lefèvre', 'Moreau', 'Laurent', 'Girard', 'Roux', 'Fournier', 'Garnier', 'Chevalier', 'Mercier', 'Blanc', 'Guérin', 'Faure', 'Rousseau', 'Diallo', 'Traoré', 'Koné', 'Camara', 'Sylla', 'Bamba', 'Lemaire', 'Marchand', 'Perrin', 'Morel', 'Barbier', 'Collin', 'Vidal', 'Renard', 'Lacroix', 'Joly', 'Gauthier', 'Lambert', 'Fabre', 'Bertin', 'Mallet', 'Hoarau', 'Jean-Baptiste', 'Saint-Ange', 'Tchamba', 'Mendy', 'Ndiaye', 'Bonnet', 'Carpentier'],
  },
  es: {
    first: ['Pablo', 'Sergio', 'Álvaro', 'Javier', 'Marc', 'Pau', 'Jaime', 'Rudy', 'Alberto', 'Dario', 'Iván', 'Carlos', 'Víctor', 'Adrián', 'Hugo', 'Aleix', 'Unai', 'Mario'],
    last: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ruiz', 'Alonso', 'Moreno', 'Iglesias', 'Castillo', 'Ortega', 'Serrano', 'Llull'],
  },
  it: {
    first: ['Marco', 'Luca', 'Alessandro', 'Matteo', 'Andrea', 'Simone', 'Nicolò', 'Davide', 'Giorgio', 'Stefano', 'Federico', 'Riccardo', 'Tommaso', 'Achille'],
    last: ['Rossi', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'Conti', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti', 'Fontana'],
  },
  de: {
    first: ['Lukas', 'Jonas', 'Leon', 'Maximilian', 'Felix', 'Tim', 'Niklas', 'Moritz', 'Paul', 'Johannes', 'Dennis', 'Tobias', 'Jan', 'Kai'],
    last: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Koch', 'Richter', 'Wolf', 'Neumann', 'Braun', 'Zimmermann', 'Krüger', 'Hartmann'],
  },
  gr: {
    first: ['Giorgos', 'Nikos', 'Kostas', 'Dimitris', 'Giannis', 'Vasilis', 'Panagiotis', 'Thanasis', 'Kostas', 'Ioannis', 'Stelios', 'Michalis'],
    last: ['Papadopoulos', 'Papanikolaou', 'Georgiou', 'Dimitriou', 'Nikolaidis', 'Konstantinou', 'Karagiannis', 'Vasileiou', 'Antoniou', 'Pappas', 'Christodoulou', 'Lazaridis'],
  },
  tr: {
    first: ['Emre', 'Mehmet', 'Burak', 'Can', 'Ahmet', 'Furkan', 'Cedi', 'Ömer', 'Kerem', 'Arda', 'Berk', 'Yiğit'],
    last: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Korkmaz'],
  },
  us: {
    first: ['Jalen', 'Marcus', 'Tyrese', 'Jaylen', 'Darius', 'Malik', 'Andre', 'DeShawn', 'Trevor', 'Cameron', 'Isaiah', 'Brandon', 'Jordan', 'Tyler', 'Justin', 'Devin', 'Caleb', 'Elijah', 'Xavier', 'Terrence', 'Kendall', 'Jamal'],
    last: ['Johnson', 'Williams', 'Brown', 'Jones', 'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor', 'Anderson', 'Jackson', 'White', 'Harris', 'Thompson', 'Robinson', 'Walker', 'Young', 'King', 'Wright', 'Hill', 'Green', 'Carter', 'Mitchell', 'Bryant'],
  },
  rs: {
    first: ['Nikola', 'Marko', 'Stefan', 'Bogdan', 'Vasilije', 'Aleksa', 'Filip', 'Uroš', 'Nemanja', 'Dušan', 'Luka'],
    last: ['Jovanović', 'Petrović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Ilić', 'Pavlović', 'Milosavljević', 'Simonović'],
  },
  sn: {
    first: ['Mamadou', 'Cheikh', 'Ousmane', 'Ibrahima', 'Modou', 'Pape', 'Abdoulaye', 'Babacar', 'Moustapha'],
    last: ['Diop', 'Ndiaye', 'Fall', 'Sow', 'Faye', 'Gueye', 'Sarr', 'Mbaye', 'Seck', 'Cissé'],
  },
  cm: {
    first: ['Joël', 'Christian', 'Serge', 'Landry', 'Franck', 'Hervé', 'Patrick', 'Arnaud'],
    last: ['Mbappé', 'Eto’o', 'Nkoulou', 'Mbida', 'Essomba', 'Atangana', 'Fouda', 'Ngono'],
  },
  be: {
    first: ['Arne', 'Thibaut', 'Wout', 'Jonas', 'Maxime', 'Kevin', 'Pieter', 'Ruben', 'Sander'],
    last: ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Willems', 'Claes', 'Goossens', 'Wouters', 'De Smet', 'Lejeune'],
  },
  lt: {
    first: ['Jonas', 'Mantas', 'Domantas', 'Tadas', 'Rokas', 'Lukas', 'Edgaras', 'Arnas', 'Paulius'],
    last: ['Kazlauskas', 'Petrauskas', 'Jankauskas', 'Žukauskas', 'Butkus', 'Paulauskas', 'Valančius', 'Grigonis'],
  },
};
