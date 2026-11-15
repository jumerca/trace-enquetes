import { newGame, setState, S } from '../src/core/state';
import { borneSolution, rotateBorne, bornesCorrect, touchStone, toggleVanne, stepMill, SURGE_MIN } from '../src/systems/Puzzles';
import { migrate, writeSlot, readSlot, useStore, listSlots } from '../src/systems/SaveManager';
import { DIALOGS } from '../src/data/dialogues';
import { ITEMS } from '../src/data/items';
import { CLUES, NOTES, MAIN } from '../src/data/story';
import { OBJECTS } from '../src/data/objects';
import { SCRIPTS } from '../src/systems/Scripts';
import { ROUTINES, NPC_IDS } from '../src/data/npcs';
import { NavGrid } from '../src/systems/Navigation';
import { ZONES } from '../src/world/zones';

beforeEach(() => setState(newGame()));

describe('énigme 1 : bornes', () => {
  it('la solution découle de la géométrie (est, nord, nord-est)', () => { expect(borneSolution()).toEqual([0, 6, 7]); });
  it('l’état initial est faux et se résout par rotations', () => {
    expect(bornesCorrect()).toBe(false);
    const sol = borneSolution();
    sol.forEach((v, i) => { while (S.bornes[i] !== v) rotateBorne(i, 1); });
    expect(bornesCorrect()).toBe(true);
  });
  it('rotation modulo 8 dans les deux sens', () => { S.bornes = [0, 0, 0]; rotateBorne(0, -1); expect(S.bornes[0]).toBe(7); rotateBorne(0, 1); expect(S.bornes[0]).toBe(0); });
});

describe('énigme 2 : pierres', () => {
  it('eau, oiseau, clé', () => { expect(touchStone('eau')).toBe('progress'); expect(touchStone('oiseau')).toBe('progress'); expect(touchStone('cle')).toBe('solved'); });
  it('une erreur réinitialise', () => { touchStone('eau'); expect(touchStone('cle')).toBe('wrong'); expect(S.stones).toEqual([]); expect(touchStone('lune')).toBe('wrong'); });
});

describe('énigme 3 : vannes', () => {
  const run = (sec: number) => { for (let t = 0; t < sec * 10; t++) stepMill(0.1); };
  it('décharge ouverte : le bief ne se remplit pas', () => { S.mill.brake = false; toggleVanne('v1'); run(20); expect(S.mill.level).toBeLessThan(SURGE_MIN); expect(toggleVanne('v3').wheelKick).toBe('weak'); });
  it('frein serré : jamais de démarrage', () => { toggleVanne('v2'); toggleVanne('v1'); run(20); expect(S.mill.level).toBe(1); expect(toggleVanne('v3').wheelKick).toBe('weak'); expect(S.mill.solved).toBe(false); });
  it('bonne procédure : frein, décharge fermée, bief plein, vanne motrice', () => { S.mill.brake = false; toggleVanne('v2'); toggleVanne('v1'); run(8); expect(S.mill.level).toBeGreaterThanOrEqual(SURGE_MIN); expect(toggleVanne('v3').wheelKick).toBe('start'); expect(S.mill.solved).toBe(true); });
  it('ouvrir la motrice trop tôt vide le bief', () => { S.mill.brake = false; toggleVanne('v2'); toggleVanne('v1'); run(3); toggleVanne('v3'); run(5); expect(S.mill.level).toBeLessThan(0.5); });
});

describe('sauvegardes', () => {
  const mem = new Map<string, string>();
  beforeEach(() => { mem.clear(); useStore({ getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => void mem.set(k, v), removeItem: (k) => void mem.delete(k) }); });
  it('aller-retour exact des états importants', () => {
    S.flags.bornes_solved = true; S.bornes = [0, 6, 7]; S.mill.solved = true; S.mill.level = 0.7; S.inventory.push('boussole'); S.zone = 'moulin'; S.x = 1200; S.y = 950;
    writeSlot(1, S);
    const r = readSlot(1).state!;
    expect(r.flags.bornes_solved).toBe(true); expect(r.bornes).toEqual([0, 6, 7]); expect(r.mill).toMatchObject({ solved: true, level: 0.7 }); expect(r.inventory).toContain('boussole'); expect(r.zone).toBe('moulin');
  });
  it('sauvegarde corrompue : restauration depuis la copie de secours', () => {
    S.flags.a = true; writeSlot(0, S); S.flags.b = true; writeSlot(0, S);
    mem.set('chemins-oublies.save.0', mem.get('chemins-oublies.save.0')!.replace('"b":true', '"b":false'));
    const r = readSlot(0);
    expect(r.fromBackup).toBe(true); expect(r.state!.flags.a).toBe(true);
  });
  it('trois emplacements indépendants', () => { writeSlot(0, S); expect(listSlots().map((s) => !!s.state)).toEqual([true, false, false]); });
  it('migration d’une sauvegarde v1 (inventaire en objet, pas de frein)', () => {
    const v1 = { v: 1, zone: 'bois', x: 10, y: 20, flags: { theo_ok: true }, inventory: { atlas: 1, boussole: 1 }, mill: { v1: true, v2: false, v3: false, level: 0.3, solved: false } };
    const m = migrate(v1);
    expect(m.v).toBe(3); expect(m.inventory).toEqual(['atlas', 'boussole']); expect(m.mill.brake).toBe(true); expect(m.mill.level).toBe(0.3); expect(m.flags.theo_ok).toBe(true); expect(m.counters).toEqual({}); expect(m.zone).toBe('bois');
  });
});

describe('cohérence des données', () => {
  it('chaque effet de dialogue référence un objet, un indice ou une note existants', () => {
    const bad: string[] = [];
    for (const [id, d] of Object.entries(DIALOGS)) {
      const fxs = [...(d.topics.flatMap((t) => t.fx ?? []))];
      try { fxs.push(...(d.greet().fx ?? [])); } catch { /* */ }
      for (const f of fxs) {
        const [k, v] = f.split(':');
        if ((k === 'give' || k === 'take') && !ITEMS[v]) bad.push(`${id}:${f}`);
        if (k === 'clue' && !CLUES[v]) bad.push(`${id}:${f}`);
        if (k === 'note' && !NOTES[v]) bad.push(`${id}:${f}`);
      }
    }
    expect(bad).toEqual([]);
  });
  it('chaque objet interactif a un script', () => { expect(OBJECTS.filter((o) => !SCRIPTS[o.id]).map((o) => o.id)).toEqual([]); });
  it('chaque étape de quête a au moins deux indices progressifs', () => { for (const m of MAIN) expect(m.hints.length).toBeGreaterThanOrEqual(2); });
  it('les huit personnages ont au moins deux situations de dialogue', () => {
    for (const id of ['agathe', 'basile', 'ninon', 'mara', 'anton', 'coline', 'theodore', 'salome']) {
      setState(newGame());
      const a = DIALOGS[id].greet().lines.map((l) => l.t).join();
      for (const f of ['met_' + id, 't_' + id, 'anton_found', 'theo_ok', 'boussole_ok', 'bornes_solved', 'lettre_livree', 'jardin_fini', 'chapter_done', 'mill_running', 'stones_solved']) S.flags[f] = true;
      const b = DIALOGS[id].greet().lines.map((l) => l.t).join();
      expect(a, id).not.toEqual(b);
    }
  });
  it('les habitants sont toujours à un endroit praticable', () => {
    const grids = new Map<string, NavGrid>();
    for (let h = 0; h < 24; h += 0.5) {
      S.clock = h * 60;
      for (const id of NPC_IDS) {
        const p = ROUTINES[id](); if (!p) continue;
        const g = grids.get(p.zone) ?? new NavGrid(ZONES[p.zone], () => false); grids.set(p.zone, g);
        for (const [x, y] of p.pts) expect(g.freeAt(x, y) || !!g.nearestFree(x, y, 2), `${id} ${h}h ${x},${y}`).toBe(true);
      }
    }
  });
  it('les personnages indispensables sont toujours localisables', () => {
    for (let h = 0; h < 24; h++) { S.clock = h * 60; for (const id of ['agathe', 'basile', 'ninon', 'mara', 'salome', 'coline', 'theodore', 'anton'] as const) expect(ROUTINES[id](), `${id} à ${h}h`).not.toBeNull(); }
  });
});
