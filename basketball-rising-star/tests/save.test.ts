import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { createCareer, SAVE_VERSION, user, userClub } from '../src/career/career';
import { deleteSlot, exportCareer, importCareer, listSlots, loadSlot, metaOf, saveSlot } from '../src/save/db';
import { migrate, validateCareer } from '../src/save/migrations';
import { playerOvr } from '../src/data/generate';

const career = () =>
  createCareer({
    firstName: 'Nina',
    lastName: 'Sauvegarde',
    nationality: 'FRA',
    birthCity: 'Paris',
    age: 18,
    heightCm: 190,
    weightKg: 82,
    hand: 'L',
    number: 7,
    pos: 'PG',
    pos2: 'SG',
    archetype: 'playmaker',
    appearance: { skin: 1, hair: 4, hairColor: 2, beard: 0, headband: true, sleeve: false },
    path: 'pro',
    seed: 555,
  });

describe('Sauvegardes', () => {
  it('sauvegarde, liste, recharge et supprime plusieurs carrières', async () => {
    const a = career();
    const b = career();
    b.week = 9;
    await saveSlot(0, a, metaOf(a, 0, playerOvr(user(a)), userClub(a).name));
    await saveSlot(2, b, metaOf(b, 2, playerOvr(user(b)), userClub(b).name));
    const slots = await listSlots();
    expect(slots[0]?.name).toBe('Nina Sauvegarde');
    expect(slots[1]).toBeNull();
    expect(slots[2]?.week).toBe(9);
    const { career: re, fromBackup } = await loadSlot(2);
    expect(fromBackup).toBe(false);
    expect(re.week).toBe(9);
    expect(re.world.players.user.attrs).toEqual(b.world.players.user.attrs);
    await deleteSlot(2);
    expect((await listSlots())[2]).toBeNull();
  });

  it('récupère la copie de secours si la sauvegarde principale est corrompue', async () => {
    const a = career();
    await saveSlot(1, a, metaOf(a, 1, 50, 'X'));
    a.week = 5;
    await saveSlot(1, a, metaOf(a, 1, 50, 'X'));
    // Corruption volontaire de l'enregistrement principal
    const db: IDBDatabase = await new Promise((res) => {
      const r = indexedDB.open('brs-saves', 1);
      r.onsuccess = () => res(r.result);
    });
    await new Promise<void>((res) => {
      const tx = db.transaction('slots', 'readwrite');
      const st = tx.objectStore('slots');
      const g = st.get(1);
      g.onsuccess = () => {
        const rec = g.result;
        rec.data = rec.data.slice(0, 500);
        st.put(rec);
      };
      tx.oncomplete = () => res();
    });
    const { career: re, fromBackup } = await loadSlot(1);
    expect(fromBackup).toBe(true);
    expect(re.week).toBe(1);
  });

  it('exporte et réimporte une carrière à l’identique', () => {
    const a = career();
    const b = importCareer(exportCareer(a));
    expect(b.world.season).toBe(a.world.season);
    expect(Object.keys(b.world.players).length).toBe(Object.keys(a.world.players).length);
    expect(() => importCareer('{"format":"basketball-rising-star","career":{}}')).toThrow();
  });

  it('migre une sauvegarde v1 sans perdre la carrière', () => {
    const a = career() as unknown as Record<string, unknown>;
    const v1: Record<string, unknown> = { ...a, version: 1 };
    delete v1.relations;
    delete v1.bestGames;
    delete v1.nationalCaps;
    const m = migrate(v1);
    expect(m.version).toBe(SAVE_VERSION);
    expect(m.relations.coach).toBe(50);
    expect(validateCareer(m)).toBe(true);
    expect(() => migrate({ ...a, version: SAVE_VERSION + 1 })).toThrow();
  });
});
