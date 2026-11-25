// Calendrier et époques. Le temps de jeu est compté en minutes depuis le 2 janvier
// de l'année de départ à 0 h. Les technologies disponibles dépendent de l'année courante.
import type { LabType } from './types';

export const MIN_H = 60;
export const MIN_D = 24 * 60;

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function toDate(startYear: number, minute: number): Date {
  return new Date(Date.UTC(startYear, 0, 2) + minute * 60000);
}

export function hourOf(minute: number): number {
  return Math.floor((minute % MIN_D) / 60);
}
export function minOfHour(minute: number): number {
  return minute % 60;
}
export function dayIndex(minute: number): number {
  return Math.floor(minute / MIN_D);
}

export function calendar(startYear: number, minute: number) {
  const d = toDate(startYear, minute);
  const month = d.getUTCMonth();
  return {
    year: d.getUTCFullYear(),
    month,
    day: d.getUTCDate(),
    weekday: d.getUTCDay(),
    hour: d.getUTCHours(),
    min: d.getUTCMinutes(),
    season: (month === 11 || month < 2 ? 'hiver' : month < 5 ? 'printemps' : month < 8 ? 'ete' : 'automne') as Season,
  };
}
export type Season = 'hiver' | 'printemps' | 'ete' | 'automne';

export function dateLabel(startYear: number, minute: number, withTime = true): string {
  const c = calendar(startYear, minute);
  const t = withTime ? ` ${String(c.hour).padStart(2, '0')} h ${String(c.min).padStart(2, '0')}` : '';
  return `${JOURS[c.weekday]} ${c.day} ${MOIS[c.month]} ${c.year}${t}`;
}
export function shortDate(startYear: number, minute: number): string {
  const c = calendar(startYear, minute);
  return `${String(c.day).padStart(2, '0')}/${String(c.month + 1).padStart(2, '0')}/${c.year} ${String(c.hour).padStart(2, '0')}:${String(c.min).padStart(2, '0')}`;
}
export function dayLabel(startYear: number, minute: number): string {
  const c = calendar(startYear, minute);
  return `${String(c.day).padStart(2, '0')}/${String(c.month + 1).padStart(2, '0')}/${c.year}`;
}
export function durationLabel(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} j`;
}

/** Lumière ambiante 0 (nuit) … 1 (plein jour), selon l'heure et la saison. */
export function daylight(startYear: number, minute: number): number {
  const c = calendar(startYear, minute);
  const h = c.hour + c.min / 60;
  const len = { hiver: 9, printemps: 13, ete: 15.5, automne: 11 }[c.season];
  const rise = 13.5 - len / 2, set = 13.5 + len / 2;
  if (h < rise - 1 || h > set + 1) return 0;
  if (h < rise) return h - (rise - 1);
  if (h > set) return 1 - (h - set);
  return 1;
}

// ————— Époques —————
export interface Era {
  id: number;
  label: string;
  computers: 'aucun' | 'terminal' | 'pc' | 'reseau' | 'cloud';
  lab: Record<LabType, { available: boolean; hours: number; cost: number; quality: number }>;
  phone: string;
  vehicles: string[];
  digitalLabel: string; // libellé des traces numériques de l'époque
  budgetFactor: number; // euros constants (francs convertis)
}

function lab(av: Partial<Record<LabType, [number, number, number]>>): Era['lab'] {
  const all: LabType[] = ['photo', 'document', 'empreintes', 'biologie', 'medical', 'numerique', 'comparaison', 'vehicule', 'authenticite'];
  const out = {} as Era['lab'];
  for (const t of all) {
    const v = av[t];
    out[t] = v ? { available: true, hours: v[0], cost: v[1], quality: v[2] } : { available: false, hours: 0, cost: 0, quality: 0 };
  }
  return out;
}

export function eraOf(year: number): Era {
  if (year < 1985)
    return {
      id: 1975, label: 'Années 1970', computers: 'aucun', phone: 'téléphone fixe et télex', digitalLabel: 'relevés téléphoniques',
      vehicles: ['Berline 1300', 'Break familial', 'Fourgon tôlé'], budgetFactor: 0.55,
      lab: lab({ photo: [24, 80, 0.6], document: [72, 150, 0.55], empreintes: [96, 200, 0.5], medical: [48, 400, 0.6], comparaison: [72, 180, 0.5], vehicule: [48, 160, 0.6], authenticite: [120, 300, 0.5] }),
    };
  if (year < 1995)
    return {
      id: 1985, label: 'Années 1980', computers: 'terminal', phone: 'Minitel et téléphone fixe', digitalLabel: 'fichiers Minitel',
      vehicles: ['Compacte 5 portes', 'Berline diesel', 'Fourgon vitré'], budgetFactor: 0.7,
      lab: lab({ photo: [18, 90, 0.65], document: [60, 160, 0.6], empreintes: [72, 220, 0.6], biologie: [240, 900, 0.45], medical: [40, 420, 0.65], comparaison: [60, 190, 0.55], vehicule: [40, 170, 0.65], authenticite: [100, 320, 0.55] }),
    };
  if (year < 2005)
    return {
      id: 1995, label: 'Années 1990', computers: 'pc', phone: 'téléphones portables naissants et Minitel', digitalLabel: 'relevés d\'opérateur',
      vehicles: ['Citadine banalisée', 'Berline break', 'Fourgon d\'intervention'], budgetFactor: 0.82,
      lab: lab({ photo: [12, 100, 0.7], document: [48, 170, 0.65], empreintes: [48, 240, 0.7], biologie: [168, 700, 0.6], medical: [36, 450, 0.7], numerique: [120, 500, 0.45], comparaison: [48, 200, 0.6], vehicule: [36, 180, 0.7], authenticite: [80, 340, 0.6] }),
    };
  if (year < 2015)
    return {
      id: 2005, label: 'Années 2000', computers: 'reseau', phone: 'téléphones mobiles et courriels', digitalLabel: 'données de téléphonie',
      vehicles: ['Compacte banalisée', 'Monospace', 'Fourgon équipé'], budgetFactor: 0.92,
      lab: lab({ photo: [8, 90, 0.78], document: [36, 160, 0.7], empreintes: [24, 200, 0.8], biologie: [96, 520, 0.75], medical: [30, 450, 0.75], numerique: [72, 420, 0.65], comparaison: [36, 190, 0.7], vehicule: [30, 180, 0.75], authenticite: [60, 320, 0.7] }),
    };
  if (year < 2025)
    return {
      id: 2015, label: 'Années 2010', computers: 'reseau', phone: 'smartphones et messageries', digitalLabel: 'données de smartphone',
      vehicles: ['SUV banalisé', 'Break hybride', 'Fourgon équipé'], budgetFactor: 1,
      lab: lab({ photo: [6, 80, 0.85], document: [30, 150, 0.75], empreintes: [16, 180, 0.85], biologie: [72, 420, 0.82], medical: [24, 440, 0.8], numerique: [48, 380, 0.75], comparaison: [30, 180, 0.75], vehicule: [24, 170, 0.8], authenticite: [48, 300, 0.75] }),
    };
  return {
    id: 2025, label: 'Années 2020', computers: 'cloud', phone: 'smartphones et réseaux sociaux', digitalLabel: 'données numériques',
    vehicles: ['Compacte électrique', 'SUV hybride', 'Fourgon électrique'], budgetFactor: 1.08,
    lab: lab({ photo: [4, 70, 0.9], document: [24, 140, 0.8], empreintes: [12, 170, 0.88], biologie: [48, 380, 0.86], medical: [24, 430, 0.82], numerique: [36, 360, 0.8], comparaison: [24, 170, 0.8], vehicule: [20, 160, 0.82], authenticite: [36, 280, 0.8] }),
  };
}

export const LAB_LABELS: Record<LabType, string> = {
  photo: 'Photographies', document: 'Examen de documents', empreintes: 'Empreintes', biologie: 'Analyses biologiques',
  medical: 'Expertise médicale', numerique: 'Analyse numérique', comparaison: 'Comparaison technique',
  vehicule: 'Expertise de véhicule', authenticite: 'Vérification d\'authenticité',
};
