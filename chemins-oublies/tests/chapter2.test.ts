import { describe, it, expect, beforeEach } from 'vitest';
import { setState, newGame, S } from '../src/core/state';
import { touchVeille, veilleLit, traceBeam, toggleMirror, mirrorBack, MIRRORS } from '../src/systems/Chapter2';
import { ZONES } from '../src/world/zones';
import { NavGrid } from '../src/systems/Navigation';
import { OBJECTS, ENCOUNTERS } from '../src/data/objects';
import { SCRIPTS } from '../src/systems/Scripts';
import { MEMORIES } from '../src/data/memories';
import { CLUES } from '../src/data/story';

describe('Chapitre II : pierres veilleuses', () => {
  beforeEach(() => setState(newGame()));
  it('saule, corbeau, cloche, lanterne résout l\'énigme', () => {
    expect(touchVeille('saule')).toBe('progress');
    expect(veilleLit('saule')).toBe(true);
    expect(touchVeille('corbeau')).toBe('progress');
    expect(touchVeille('cloche')).toBe('progress');
    expect(touchVeille('lanterne')).toBe('solved');
  });
  it('l\'œil fermé est un piège et un mauvais ordre réinitialise', () => {
    touchVeille('saule');
    expect(touchVeille('oeil')).toBe('trap');
    expect(S.counters.veille).toBe(0);
    touchVeille('saule');
    expect(touchVeille('cloche')).toBe('wrong');
    expect(veilleLit('saule')).toBe(false);
  });
});

describe('Chapitre II : miroirs de la tour', () => {
  beforeEach(() => setState(newGame()));
  it('au départ, la lumière n\'atteint pas la lentille', () => { expect(traceBeam().lit).toBe(false); });
  it('une seule combinaison sur seize allume la lentille', () => {
    const ids = Object.keys(MIRRORS);
    let wins = 0;
    for (let m = 0; m < 16; m++) {
      setState(newGame());
      ids.forEach((id, k) => { if ((m >> k) & 1) toggleMirror(id); });
      if (traceBeam().lit) { wins++; expect(ids.map(mirrorBack)).toEqual([true, true, false, true]); }
    }
    expect(wins).toBe(1);
  });
});

describe('Chapitre II : cohérence', () => {
  it('chaque objet des nouveaux lieux a un script et se trouve sur une case atteignable', () => {
    for (const z of ['landes', 'brumecime', 'tour', 'tissage'] as const) {
      const g = new NavGrid(ZONES[z], () => true);
      for (const o of OBJECTS.filter((x) => x.zone === z)) {
        expect(SCRIPTS[o.id], o.id).toBeTruthy();
        expect(g.freeAt(o.x, o.y + 40) || !!g.nearestFree(o.x, o.y + 40, 5), `${o.id} accessible`).toBe(true);
      }
    }
  });
  it('les rencontres des landes sont sur des cases libres et loin des échos', () => {
    const g = new NavGrid(ZONES.landes, () => false);
    for (const e of ENCOUNTERS.filter((x) => x.zone === 'landes')) {
      for (const en of e.enemies) expect(g.freeAt(en.x, en.y), `${e.id}`).toBe(true);
      for (const o of OBJECTS.filter((x) => x.id.startsWith('echo_'))) expect(Math.hypot(o.x - e.center[0], o.y - e.center[1]), `${e.id} / ${o.id}`).toBeGreaterThan(e.radius + 360);
    }
  });
  it('les échos donnent des indices qui existent', () => {
    for (const k of ['echo1', 'echo2', 'echo3']) expect(CLUES[MEMORIES[k].clue!], k).toBeTruthy();
  });
});
