import { describe, it, expect } from 'vitest';
import { SONGS, compile, midi, chordNotes } from '../src/systems/Music';

describe('partitions', () => {
  it('notes et accords', () => {
    expect(midi('A4')).toBe(69); expect(midi('C#5')).toBe(73); expect(midi('Bb4')).toBe(70);
    expect(chordNotes('Am')).toEqual([57, 60, 64]); expect(chordNotes('F#m')).toEqual([54, 57, 61]);
  });
  for (const [id, s] of Object.entries(SONGS)) {
    it(`${id} : chaque mesure est complète, la mélodie reste chantable`, () => {
      const { evs, len } = compile(s);
      expect(len).toBeGreaterThan(0);
      const lead = evs.filter((e) => e.part === 'lead');
      expect(lead.length).toBeGreaterThan(s.melody.length);
      for (const e of lead) { expect(e.note).toBeGreaterThanOrEqual(midi('E4') - 3); expect(e.note).toBeLessThanOrEqual(midi('E6')); }
      for (const e of evs) expect(e.at).toBeLessThan(len);
    });
  }
});
