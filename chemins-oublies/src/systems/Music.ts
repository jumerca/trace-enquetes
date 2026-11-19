// Partitions du jeu : de vrais morceaux écrits (mélodie, accords, basse, accompagnement),
// joués par les instruments synthétisés d'Audio.ts. Notation compacte : « D5/2 B4 r/2 » = note/durée en croches.

export type Theme =
  | 'titre' | 'village' | 'soir' | 'nuit' | 'fete' | 'foret' | 'foret_clair' | 'maison' | 'auberge' | 'archives'
  | 'moulin_silence' | 'moulin' | 'souvenir' | 'danger' | 'boss' | 'landes' | 'hauts' | 'none';

export type Inst = 'pluck' | 'flute' | 'bell' | 'harp' | 'fiddle';
type Accomp = 'strum' | 'waltz' | 'arp' | 'pad' | 'box' | 'drive';
type Perc = 'none' | 'light' | 'dance' | 'march' | 'heavy';

export interface Song {
  bpm: number;
  /** croches par mesure (8 = 4/4, 6 = 3/4 ou 6/8) */
  bar: number;
  chords: string[];
  melody: string[];
  lead: Inst;
  /** instrument de la mélodie au second passage */
  lead2?: Inst;
  accomp: Accomp;
  perc: Perc;
  swing?: number;
  /** mesures de silence (respiration) à la fin de chaque boucle */
  rest?: number;
  /** décalage en demi-tons (ex. variante plus grave) */
  shift?: number;
  vol?: number;
}

export const SONGS: Record<Exclude<Theme, 'none'>, Song> = {
  // Thème principal : la route effacée (écran titre)
  titre: {
    bpm: 72, bar: 8, lead: 'flute', lead2: 'harp', accomp: 'pad', perc: 'none', rest: 1,
    chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'G', 'D'],
    melody: ['A4/2 D5/2 F#5/4', 'E5/2 D5 B4 D5/4', 'B4/2 D5/2 G5/3 F#5', 'E5/8', 'A4/2 D5/2 F#5/2 A5/2', 'B5/3 A5 F#5/4', 'G5/2 E5/2 C#5/2 E5/2', 'D5/8'],
  },
  // Clairval, en journée : air de luth, léger et sautillant
  village: {
    bpm: 104, bar: 8, lead: 'pluck', lead2: 'flute', accomp: 'strum', perc: 'light', swing: 0.12,
    chords: ['G', 'D', 'Em', 'C', 'G', 'C', 'D', 'D', 'Em', 'C', 'G', 'D', 'C', 'D', 'G', 'G'],
    melody: [
      'D5/2 B4 D5 G5/3 F#5', 'E5/2 D5/2 A4/4', 'B4 C5 D5 E5 G5/2 E5/2', 'D5/2 C5 B4 A4/4',
      'B4/2 D5 G5 A5/2 G5 F#5', 'E5/2 G5 E5 D5/2 C5/2', 'B4/2 A4 G4 A4/2 D5/2', 'D5/6 r/2',
      'G5/3 F#5 E5/2 B4/2', 'C5 D5 E5 G5 E5/4', 'D5/3 B4 G4/2 B4/2', 'A4/2 B4 C5 D5/4',
      'E5/2 G5/2 E5 D5 C5/2', 'D5/2 F#5/2 A5/2 F#5/2', 'G5/3 D5 B4/2 D5/2', 'G5/6 r/2',
    ],
  },
  // Clairval, le soir : valse lente à la flûte
  soir: {
    bpm: 84, bar: 6, lead: 'flute', lead2: 'harp', accomp: 'waltz', perc: 'none', rest: 1,
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'G'],
    melody: [
      'B4/3 D5 G5/2', 'G5/2 F#5 E5/3', 'E5/3 D5 C5/2', 'A4/6', 'B4/3 D5 G5/2', 'B5/2 A5 G5/3', 'E5/2 D5 C5 A4/2', 'D5/6',
      'E5/3 G5 E5/2', 'D5/2 F#5 A5/3', 'F#5/2 D5 B4/3', 'E5/6', 'C5/2 E5/2 G5/2', 'F#5/2 A5 F#5 D5/2', 'G5/6', 'r/6',
    ],
  },
  // Clairval, la nuit : boîte à musique clairsemée
  nuit: {
    bpm: 64, bar: 8, lead: 'bell', accomp: 'box', perc: 'none', rest: 2, vol: 0.8,
    chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'D'],
    melody: ['B5/2 r/2 G5/2 E5/2', 'G5/4 r/4', 'D5/2 G5/2 B5/4', 'A5/6 r/2', 'E5/2 G5 B5 A5/2 G5/2', 'E5/6 r/2', 'D5/2 B4/2 D5/2 G5/2', 'F#5/8'],
  },
  // Fête des moissons : gigue à 6/8, tambourin et violon
  fete: {
    bpm: 126, bar: 6, lead: 'fiddle', lead2: 'flute', accomp: 'waltz', perc: 'dance',
    chords: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D', 'Bm', 'G', 'D', 'A', 'Bm', 'G', 'A', 'D'],
    melody: [
      'A4 D5 F#5 A5/2 F#5', 'B5/2 G5 E5/2 G5', 'F#5 A5 F#5 D5/2 F#5', 'E5/3 C#5/3', 'A4 D5 F#5 A5/2 D6', 'B5/2 A5 G5/2 B5', 'A5 G5 F#5 E5/2 C#5', 'D5/3 r/3',
      'F#5/2 D5 B4/2 D5', 'G5/2 B5 D6/2 B5', 'A5/2 F#5 D5/2 F#5', 'E5 F#5 E5 C#5/3', 'B4 D5 F#5 B5/3', 'G5 A5 B5 G5/3', 'A5/2 G5 E5/2 C#5', 'D5/3 D6/3',
    ],
  },
  // Bois des Murmures : flûte mélancolique sur harpe, mode de ré
  foret: {
    bpm: 68, bar: 8, lead: 'flute', accomp: 'arp', perc: 'none', rest: 2,
    chords: ['Dm', 'C', 'Bb', 'A', 'Dm', 'C', 'Gm', 'A'],
    melody: ['A4/2 D5/2 E5 F5 E5/2', 'G5/3 F5 E5/4', 'D5/2 F5/2 Bb5/2 A5 G5', 'A5/6 r/2', 'F5/2 E5 D5 A4/4', 'C5 D5 E5 G5 E5/4', 'D5/2 Bb4/2 G4/2 Bb4 C5', 'C#5/2 E5/2 A4/4'],
  },
  // Bois, une fois la brume levée : même air, en majeur, plus allant
  foret_clair: {
    bpm: 82, bar: 8, lead: 'harp', lead2: 'flute', accomp: 'arp', perc: 'none', rest: 1,
    chords: ['D', 'C', 'G', 'A', 'D', 'C', 'G', 'A'],
    melody: ['A4/2 D5/2 E5 F#5 E5/2', 'G5/3 F#5 E5/4', 'D5/2 F#5/2 B5/2 A5 G5', 'A5/6 r/2', 'F#5/2 E5 D5 A4/4', 'C5 D5 E5 G5 E5/4', 'D5/2 B4/2 G4/2 B4 C#5', 'C#5/2 E5/2 A4/4'],
  },
  // Maisons, atelier, poste : berceuse au coin du feu
  maison: {
    bpm: 76, bar: 6, lead: 'bell', lead2: 'harp', accomp: 'waltz', perc: 'none', rest: 1, vol: 0.85,
    chords: ['F', 'Dm', 'Bb', 'C', 'F', 'Dm', 'Gm', 'C', 'F'],
    melody: ['C5/3 A4 C5 F5', 'A5/4 G5 F5', 'D5/3 F5 Bb5/2', 'G5/6', 'C5/3 A4 C5 F5', 'A5/2 C6 A5 F5/2', 'G5/2 Bb5 G5 E5/2', 'E5/3 G5/3', 'F5/6'],
  },
  // L'auberge du Pot d'Étain : air de taverne
  auberge: {
    bpm: 112, bar: 8, lead: 'fiddle', lead2: 'pluck', accomp: 'strum', perc: 'light', swing: 0.15,
    chords: ['D', 'C', 'D', 'A', 'D', 'C', 'G', 'A'],
    melody: ['D5 F#5 A5 F#5 D5 F#5 A5/2', 'G5 E5 C5 E5 G5/2 E5/2', 'F#5 A5 D6/2 A5 F#5 D5/2', 'E5/2 C#5/2 A4/4', 'D5 F#5 A5 F#5 D5 F#5 A5/2', 'G5 A5 G5 E5 C5/2 E5/2', 'D5/2 B4 D5 G5/2 B5/2', 'A5/2 E5/2 D5/4'],
  },
  // Les Archives : arpèges de clavecin, mystère et poussière
  archives: {
    bpm: 84, bar: 8, lead: 'harp', lead2: 'bell', accomp: 'pad', perc: 'none', rest: 1,
    chords: ['Am', 'F', 'C', 'E', 'Am', 'Dm', 'E', 'Am'],
    melody: ['A4 C5 E5 A5 E5 C5 A4/2', 'A4 C5 F5 A5 F5/4', 'G4 C5 E5 G5 C6/4', 'B5/2 G#5/2 E5/4', 'C6/2 B5 A5 E5/4', 'F5/2 E5 D5 A4/4', 'G#4/2 B4/2 E5/2 D5/2', 'A4/8'],
  },
  // Le moulin à l'arrêt : tension retenue, cloches et nappes
  moulin_silence: {
    bpm: 70, bar: 8, lead: 'bell', accomp: 'pad', perc: 'none', rest: 1,
    chords: ['Em', 'C', 'Am', 'B', 'Em', 'C', 'Am', 'B'],
    melody: ['E5/4 G5/2 F#5/2', 'E5/6 r/2', 'C5/4 E5/2 A5/2', 'F#5/6 r/2', 'B4/2 E5/2 G5/2 B5/2', 'C6/4 B5/2 G5/2', 'A5/2 G5/2 E5/2 C5/2', 'D#5/8'],
  },
  // Le moulin qui tourne : la roue chante
  moulin: {
    bpm: 100, bar: 8, lead: 'pluck', lead2: 'flute', accomp: 'arp', perc: 'light',
    chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'C'],
    melody: ['E5 G5 C6/2 G5 E5 G5/2', 'D5 G5 B5/2 G5 D5 G5/2', 'C5 E5 A5/2 G5 E5 C5/2', 'A5/2 F5 A5 C6/4', 'G5/2 E5 G5 C6/2 E6/2', 'D6/2 B5 G5 D5/4', 'C5 D5 F5 A5 G5/2 F5/2', 'E5/2 D5/2 C5/4'],
  },
  // Landes de Brume : complainte de cornemuse (violon sur bourdon), mode de mi éolien, à 6/8
  landes: {
    bpm: 72, bar: 6, lead: 'fiddle', lead2: 'flute', accomp: 'pad', perc: 'none', rest: 2, shift: -2,
    chords: ['Em', 'Em', 'D', 'Em', 'C', 'D', 'Em', 'Em'],
    melody: ['B4/3 E5 G5/2', 'F#5/2 E5 D5/3', 'D5/3 F#5 A5/2', 'G5/2 F#5 E5/3', 'E5/2 G5 C6/3', 'B5/2 A5 F#5/3', 'G5/2 E5 B4 D5/2', 'E5/6'],
  },
  // Brumecime : air clair des hauts, harpe et cloches dans le vent
  hauts: {
    bpm: 80, bar: 8, lead: 'harp', lead2: 'flute', accomp: 'arp', perc: 'none', rest: 1,
    chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'C', 'G'],
    melody: ['D5/2 G5/2 B5/3 A5', 'A5/2 F#5/2 D5/4', 'E5/2 G5 B5 E6/2 D6/2', 'C6/4 G5/4', 'B5/2 D6 B5 G5/2 B5/2', 'A5/2 F#5 A5 D6/4', 'E6/2 C6 A5 E5/2 G5/2', 'G5/8'],
  },
  // Souvenirs : boîte à musique nostalgique
  souvenir: {
    bpm: 70, bar: 6, lead: 'bell', lead2: 'flute', accomp: 'box', perc: 'none', rest: 1,
    chords: ['A', 'F#m', 'D', 'E', 'A', 'F#m', 'E', 'A'],
    melody: ['E5/2 A5/2 C#6/2', 'B5/3 A5 F#5/2', 'F#5/2 A5/2 D6/2', 'C#6/2 B5/4', 'E5/2 A5/2 C#6/2', 'E6/3 D6 C#6 A5', 'B5/2 F#5/2 G#5/2', 'A5/6'],
  },
  // Combat : ostinato pressant
  danger: {
    bpm: 132, bar: 8, lead: 'pluck', lead2: 'fiddle', accomp: 'drive', perc: 'march',
    chords: ['Am', 'F', 'G', 'E', 'Am', 'F', 'Dm', 'E'],
    melody: ['A4 C5 E5 A4 C5 E5 G5 E5', 'F4 A4 C5 F4 A4 C5 E5 C5', 'G4 B4 D5 G4 B4 D5 F5 D5', 'E5/2 G#5/2 B5/2 G#5/2', 'A5/2 E5 C5 A4/2 C5 E5', 'F5/2 C5 A4 F4/2 A4 C5', 'D5 F5 A5 F5 D5 F5 A5 F5', 'G#5/2 E5/2 B4/2 E5/2'],
  },
  // Le Gardien des Ronces : plus grave, plus lourd
  boss: {
    bpm: 140, bar: 8, lead: 'fiddle', lead2: 'pluck', accomp: 'drive', perc: 'heavy', shift: -2, vol: 1.1,
    chords: ['Am', 'Am', 'F', 'E', 'Dm', 'Am', 'Bb', 'E'],
    melody: ['A4/2 A4 C5 E5/2 A5/2', 'G5 E5 C5 E5 A4/4', 'F5/2 F5 A5 C6/2 A5/2', 'G#5/3 E5 B4/4', 'D5/2 F5 A5 D6/2 A5/2', 'C6 B5 A5 E5 A4/4', 'Bb4 D5 F5 Bb5 A5/2 F5/2', 'E5/2 G#5/2 B5/4'],
  },
};

// ---- compilation
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function midi(n: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(n);
  if (!m) throw new Error('note ' + n);
  return 12 * (Number(m[3]) + 1) + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
/** Accord → hauteurs (racine à l'octave 3) */
export function chordNotes(name: string): number[] {
  const m = /^([A-G])(#|b)?(m)?(7)?/.exec(name);
  if (!m) throw new Error('accord ' + name);
  const r = 48 + PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const n = [r, r + (m[3] ? 3 : 4), r + 7];
  if (m[4]) n.push(r + (m[3] ? 10 : 10));
  return n;
}

export interface Ev { at: number; dur: number; note: number; part: 'lead' | 'bass' | 'chord' | 'arp' | 'pad' | 'spark' | 'drum' | 'hat' | 'snare'; inst?: Inst; vol: number }

/** Partition complète d'une boucle (deux passages : le second varie l'instrument et ajoute des étincelles). */
export function compile(s: Song): { evs: Ev[]; len: number } {
  const evs: Ev[] = [];
  const B = s.bar, nb = s.melody.length, sh = s.shift ?? 0;
  for (let pass = 0; pass < 2; pass++) {
    const off = pass * nb * B;
    const lead = pass === 1 && s.lead2 ? s.lead2 : s.lead;
    s.melody.forEach((bar, bi) => {
      let t = 0;
      for (const tok of bar.trim().split(/\s+/)) {
        const [n, d] = tok.split('/'); const dur = d ? Number(d) : 1;
        if (n !== 'r') evs.push({ at: off + bi * B + t, dur, note: midi(n) + sh, part: 'lead', inst: lead, vol: 1 });
        t += dur;
      }
      if (t !== B) throw new Error(`mesure ${bi + 1} : ${t} croches au lieu de ${B}`);
      const ch = chordNotes(s.chords[bi % s.chords.length]).map((x) => x + sh);
      const at = off + bi * B;
      const root = ch[0] - 12, fifth = ch[2] - 12;
      switch (s.accomp) {
        case 'strum':
          evs.push({ at, dur: 3, note: root, part: 'bass', vol: 1 }, { at: at + B / 2, dur: 3, note: fifth, part: 'bass', vol: 0.75 });
          for (const k of [2, 6]) for (const n of ch) evs.push({ at: at + k, dur: 1.2, note: n + 12, part: 'chord', vol: 1 });
          break;
        case 'waltz':
          evs.push({ at, dur: 2, note: root, part: 'bass', vol: 1 });
          for (const k of [2, 4]) for (const n of ch) evs.push({ at: at + k, dur: 1.5, note: n + 12, part: 'chord', vol: 0.8 });
          break;
        case 'arp': {
          evs.push({ at, dur: B, note: root, part: 'bass', vol: 0.8 });
          const seq = [ch[0], ch[1], ch[2], ch[0] + 12, ch[1] + 12, ch[2], ch[1], ch[2] - 12];
          for (let k = 0; k < B; k++) evs.push({ at: at + k, dur: 2, note: seq[k % seq.length] + 12, part: 'arp', vol: k % 2 ? 0.6 : 0.85 });
          break;
        }
        case 'pad':
          evs.push({ at, dur: B, note: root, part: 'bass', vol: 0.7 });
          for (const n of ch) evs.push({ at, dur: B, note: n, part: 'pad', vol: 1 });
          break;
        case 'box':
          for (const [k, i] of [[0, 0], [2, 1], [4, 2]] as [number, number][]) if (k < B) evs.push({ at: at + k, dur: 2, note: ch[i] + 24, part: 'arp', vol: 0.5 });
          for (const n of ch) evs.push({ at, dur: B, note: n, part: 'pad', vol: 0.6 });
          break;
        case 'drive':
          for (let k = 0; k < B; k++) evs.push({ at: at + k, dur: 0.8, note: k % 4 === 3 ? fifth : root, part: 'bass', vol: k % 2 ? 0.6 : 0.9 });
          for (const n of ch) evs.push({ at, dur: B, note: n, part: 'pad', vol: 0.8 });
          break;
      }
      // percussions
      for (let k = 0; k < B; k++) {
        const p = s.perc;
        if (p === 'light' && (k === 2 || k === 6)) evs.push({ at: at + k, dur: 0.3, note: 0, part: 'hat', vol: 0.6 });
        if (p === 'dance') { if (k === 0 || k === 3) evs.push({ at: at + k, dur: 0.4, note: 0, part: 'drum', vol: k ? 0.6 : 1 }); evs.push({ at: at + k, dur: 0.2, note: 0, part: 'hat', vol: k % 3 === 0 ? 0.7 : 0.4 }); }
        if (p === 'march') { if (k % 4 === 0) evs.push({ at: at + k, dur: 0.4, note: 0, part: 'drum', vol: 1 }); if (k % 4 === 2) evs.push({ at: at + k, dur: 0.2, note: 0, part: 'snare', vol: 0.7 }); evs.push({ at: at + k, dur: 0.1, note: 0, part: 'hat', vol: 0.35 }); }
        if (p === 'heavy') { if (k === 0 || k === 3 || k === 4) evs.push({ at: at + k, dur: 0.4, note: 0, part: 'drum', vol: 1.15 }); if (k === 2 || k === 6) evs.push({ at: at + k, dur: 0.2, note: 0, part: 'snare', vol: 0.9 }); evs.push({ at: at + k, dur: 0.1, note: 0, part: 'hat', vol: 0.4 }); }
      }
      // second passage : étincelle de cloche sur la tierce, une mesure sur deux
      if (pass === 1 && bi % 2 === 0 && s.lead !== 'bell') evs.push({ at, dur: 4, note: ch[1] + 36, part: 'spark', vol: 0.5 });
    });
  }
  const len = nb * B * 2 + (s.rest ?? 0) * B;
  evs.sort((a, b) => a.at - b.at);
  return { evs, len };
}
