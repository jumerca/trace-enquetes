// V0.4 : variantes d'enquête, séries, partenaires, pilotage national, construction libre.
import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { answerRequest, ensurePartners, partnersDaily, solicit } from '../src/sim/partners';
import { decide, ensureSummit, setAxis, summitMonthly, summitNote } from '../src/sim/summit';
import { allReachable, cutFor, demolish, inRoom, moveRoom, placeRoom, refundValue, roomArea, roomAt } from '../src/sim/station';
import { spawnCase, step } from '../src/sim/sim';
import { MIN_D } from '../src/sim/calendar';
import { game } from './helpers';

describe('Variété des enquêtes', () => {
  it('les affaires prennent des tours différents (variantes de déroulement)', () => {
    const st = game(7);
    const rng = new Rng(9);
    const twists = new Set<string>();
    for (let i = 0; i < 300; i++) { const c = spawnCase(st, rng); if (c?.twist) twists.add(c.twist); }
    expect(twists.size).toBeGreaterThanOrEqual(6);
  });
  it('un auteur peut récidiver : série d\'affaires liées au même auteur', () => {
    const st = game(11);
    const rng = new Rng(3);
    for (let i = 0; i < 80; i++) spawnCase(st, rng);
    expect((st.series ?? []).length).toBeGreaterThan(0);
    const s = st.series![0];
    s.due = st.minute;
    step(st, 24 * 60);
    const linked = st.cases.filter((c) => c.series && c.truth.culprit === s.culprit);
    expect(linked.length).toBeGreaterThanOrEqual(2);
    expect(linked.some((c) => c.clues.some((k) => k.links))).toBe(true);
  });
});

describe('Partenaires institutionnels', () => {
  it('six partenaires incarnés, demandes à arbitrer et appuis sur une affaire', () => {
    const st = game(5, 1995, 'assiste');
    const rng = new Rng(1);
    const ps = ensurePartners(st, rng);
    expect(ps.list.map((p) => p.kind).sort()).toEqual(['banque', 'gendarmerie', 'hopital', 'legiste', 'mairie', 'social']);
    for (let d = 0; d < 60 && !ps.requests.length; d++) { st.minute += MIN_D; partnersDaily(st, rng, () => null); }
    expect(ps.requests.length).toBeGreaterThan(0);
    const r = ps.requests[0];
    const before = ps.list.find((p) => p.kind === r.partner)!.relation;
    const out = answerRequest(st, rng, r.id, 0, (t) => spawnCase(st, rng, false, t));
    expect(out.length).toBeGreaterThan(0);
    expect(r.answered).toBe(true);
    expect(ps.list.find((p) => p.kind === r.partner)!.relation).not.toBe(before);
    // sollicitation acceptée : la gendarmerie accélère une enquête
    const c = st.cases.find((x) => x.status === 'ouverte')!;
    ps.list.find((p) => p.kind === 'gendarmerie')!.relation = 100;
    const res = solicit(st, new Rng(2), 'conjointe', c.id);
    expect(res.ok).toBe(true);
    expect(c.boosts?.length).toBe(1);
    // nouvelle sollicitation immédiate : partenaire indisponible
    expect(solicit(st, new Rng(2), 'conjointe', c.id).ok).toBe(false);
  });
});

describe('Sommet de carrière : pilotage national', () => {
  it('priorités, arbitrages et note de pilotage aux échelons supérieurs', () => {
    const st = game(8, 1995, 'assiste');
    expect(ensureSummit(st)).toBeNull();
    st.hierarchy.rank = 5;
    const s = ensureSummit(st)!;
    setAxis(st, 'numerique', 50);
    expect(Object.values(s.priorities).reduce((a, b) => a + b, 0)).toBe(100);
    expect(s.priorities.numerique).toBe(50);
    const rng = new Rng(4);
    for (let i = 0; i < 6 && !s.dossiers.length; i++) summitMonthly(st, rng);
    expect(s.dossiers.length).toBeGreaterThan(0);
    const d = s.dossiers[0];
    expect(decide(st, d.id, 0).length).toBeGreaterThan(0);
    expect(d.answered).toBe(true);
    expect(summitNote(st)).not.toBeNull();
  });
});

describe('Construction libre', () => {
  it('pièce en L, déplacement avec son mobilier, démolition remboursée', () => {
    const st = game(3);
    expect(allReachable(st.station)).toBe(true);
    st.station.w = 34; st.station.h = 20; // terrain agrandi
    const cut = cutFor('L-se', 22, 0, 6, 6)!;
    expect(cut).toEqual({ x: 25, y: 3, w: 3, h: 3 });
    // trouver un emplacement libre contigu au bâtiment
    let placed = null as ReturnType<typeof placeRoom> | null;
    for (let y = 0; y < 14 && !placed?.ok; y++) placed = placeRoom(st, 'bureaux', 0, 22, y, 6, 6, 'L-se');
    expect(placed?.ok).toBe(true);
    const r = placed!.room!;
    expect(roomArea(r)).toBe(27);
    expect(inRoom(r, r.cut!.x, r.cut!.y)).toBe(false);
    expect(roomAt(st.station, 0, r.cut!.x, r.cut!.y)).toBeUndefined();
    r.built = st.minute;
    const nf = r.furniture.length;
    const mv = moveRoom(st, r.id, 0, 22, r.y + 6 <= 14 ? r.y + 6 : r.y - 6 >= 0 ? r.y - 6 : r.y);
    if (mv.ok) { expect(r.furniture.length).toBeLessThanOrEqual(nf); expect(allReachable(st.station)).toBe(true); }
    const env = st.budget.envelope.batiments;
    const v = refundValue(st, r);
    expect(v).toBeGreaterThan(0);
    const d = demolish(st, r.id);
    expect(d.ok).toBe(true);
    expect(st.budget.envelope.batiments).toBe(env + v);
  });
  it('on ne peut pas démolir une pièce qui couperait l\'accès à d\'autres', () => {
    const st = game(3);
    const corridor = st.station.rooms.find((r) => r.type === 'couloir' && r.floor === 0)!;
    const res = demolish(st, corridor.id);
    expect(res.ok).toBe(false);
  });
});
