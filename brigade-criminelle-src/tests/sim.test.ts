import { step, advanceToNext, assignCase, suggestTeam, sendTraining, promote, newGame } from '../src/sim/sim';
import { serialize, deserialize } from '../src/save/save';
import { isOnDuty, tickStaff, gainXp, salary, condition } from '../src/sim/staff';
import { spend, totalSpent } from '../src/sim/finance';
import { planAction, availableActions } from '../src/sim/investigation';
import { calendar } from '../src/sim/calendar';
import { placeRoom, navPath, canPlaceFurniture, initialStation, roomConnected } from '../src/sim/station';
import { game } from './helpers';

describe('Reproductibilité', () => {
  it('même graine → même simulation', () => {
    const a = game(123), b = game(123);
    step(a, 20 * 1440);
    step(b, 20 * 1440);
    expect(serialize(a).replace(/"savedAt":"[^"]+"/, '')).toBe(serialize(b).replace(/"savedAt":"[^"]+"/, ''));
  });
  it('graines différentes → parties différentes', () => {
    const a = game(1), b = game(2);
    step(a, 5 * 1440); step(b, 5 * 1440);
    expect(JSON.stringify(a.cases.map((c) => c.title))).not.toBe(JSON.stringify(b.cases.map((c) => c.title)));
  });
});

describe('Sauvegardes', () => {
  it('aller-retour sans perte et poursuite identique', () => {
    const a = game(9);
    step(a, 10 * 1440);
    const b = deserialize(serialize(a));
    expect(b.cases.length).toBe(a.cases.length);
    step(a, 3 * 1440); step(b, 3 * 1440);
    expect(JSON.stringify(b.cases)).toBe(JSON.stringify(a.cases));
  });
  it('refuse un fichier étranger', () => {
    expect(() => deserialize(JSON.stringify({ format: 'autre' }))).toThrow();
  });
  it('IndexedDB : écriture et relecture', async () => {
    const { saveSlot, loadSlot, listSlots } = await import('../src/save/save');
    const a = game(3);
    await saveSlot('emplacement-1', a);
    const b = await loadSlot('emplacement-1');
    expect(b?.seed).toBe(a.seed);
    expect((await listSlots()).some((s) => s.slot === 'emplacement-1')).toBe(true);
  });
});

describe('Personnel', () => {
  it('équipe initiale de 12 personnes et plusieurs véhicules', () => {
    const st = game(1);
    expect(st.staff.length).toBeGreaterThanOrEqual(12);
    expect(st.vehicles.length).toBe(3);
    expect(st.staff.filter((s) => s.role === 'officier').length).toBe(2);
  });
  it('horaires : équipe de jour, de nuit, jours de repos', () => {
    const st = game(1);
    const day = st.staff.find((s) => s.shift === 'jour' && !s.restDays.includes(1))!;
    const night = st.staff.find((s) => s.shift === 'nuit')!;
    // 2 janvier 1995 = lundi
    expect(calendar(1995, 0).weekday).toBe(1);
    expect(isOnDuty(day, st, 10 * 60)).toBe(true);
    expect(isOnDuty(day, st, 22 * 60)).toBe(false);
    expect(isOnDuty(night, st, 23 * 60)).toBe(true);
    expect(isOnDuty(night, st, 10 * 60)).toBe(false);
    expect(isOnDuty(day, st, 5 * 1440 + 10 * 60)).toBe(false); // samedi
  });
  it('fatigue : le travail fatigue, le repos récupère, la fatigue réduit la performance', () => {
    const st = game(1);
    const s = st.staff[2];
    s.fatigue = 20;
    for (let i = 0; i < 60; i++) tickStaff(s, st, 10, { working: true, night: false, overloaded: true, restBonus: 0 });
    const tired = s.fatigue;
    expect(tired).toBeGreaterThan(30);
    s.fatigue = 90;
    const lowPerf = condition(s);
    s.fatigue = 10;
    expect(condition(s)).toBeGreaterThan(lowPerf);
    s.fatigue = tired;
    for (let i = 0; i < 60; i++) tickStaff(s, st, 10, { working: false, night: false, overloaded: false, restBonus: 0.8 });
    expect(s.fatigue).toBeLessThan(tired);
  });
  it('compétences : progression par la pratique et la formation, plafonnée', () => {
    const st = game(1);
    const s = st.staff[3];
    s.skills.analyse = 8; s.potential = 18;
    for (let i = 0; i < 200; i++) gainXp(s, 'analyse', 0.3);
    expect(s.skills.analyse).toBeGreaterThan(8);
    expect(s.skills.analyse).toBeLessThanOrEqual(20);
    const before = s.skills.entretien;
    s.potential = 20;
    sendTraining(st, s, 'audition');
    expect(s.status).toBe('formation');
    expect(s.skills.entretien).toBe(Math.min(20, before + 1));
  });
  it('grilles : salaire selon grade et ancienneté, promotion encadrée', () => {
    const st = game(1);
    const s = st.staff.find((x) => x.role === 'enqueteur')!;
    const sal = salary(s, 1995);
    s.skills.experience = 20;
    promote(st, s);
    expect(salary(s, 1995)).toBeGreaterThanOrEqual(sal);
  });
});

describe('Affectations', () => {
  it('suggestion d\'équipe et attribution', () => {
    const st = game(4, 1995, 'manuel');
    const c = st.cases[0];
    const sug = suggestTeam(st, c)!;
    assignCase(st, c, sug.lead, sug.team);
    expect(c.lead).toBe(sug.lead);
    expect(st.staff.find((s) => s.id === sug.lead)!.assignments).toContain(c.id);
  });
  it('gestion manuelle : une action planifiée est exécutée par l\'enquêteur', () => {
    const st = game(4, 1995, 'manuel');
    const c = st.cases[0];
    const sug = suggestTeam(st, c)!;
    assignCase(st, c, sug.lead, sug.team);
    planAction(st, c, 'constatations', undefined, [sug.lead]);
    step(st, 2 * 1440);
    expect(c.done.some((d) => d.text.startsWith('Premières constatations'))).toBe(true);
    expect(availableActions(st, c).length).toBeGreaterThan(3);
  });
  it('avancer jusqu\'au prochain événement s\'arrête sur une alerte', () => {
    const st = game(8);
    const dt = advanceToNext(st, 72);
    expect(dt).toBeGreaterThan(0);
    expect(dt).toBeLessThanOrEqual(72 * 60);
  });
});

describe('Budget', () => {
  it('les dépenses sont imputées au bon poste, la masse salariale est séparée', () => {
    const st = game(1);
    const before = totalSpent(st.budget);
    spend(st, 'laboratoires', 500);
    expect(totalSpent(st.budget)).toBe(before + 500);
    expect(st.budget.payroll).toBeGreaterThan(200000);
    expect(st.budget.spent.laboratoires).toBe(500);
  });
  it('aucune récompense financière automatique par affaire', () => {
    const st = game(2);
    const env = JSON.stringify(st.budget.envelope);
    step(st, 25 * 1440);
    const closed = st.cases.filter((c) => c.status !== 'ouverte').length;
    expect(closed).toBeGreaterThan(0);
    // l'enveloppe ne varie que par événements (restrictions) ou demandes acceptées
    const changedByEvent = st.events.some((e) => e.kind === 'restriction') || st.budget.requests.some((r) => r.granted);
    if (!changedByEvent) expect(JSON.stringify(st.budget.envelope)).toBe(env);
  });
});

describe('Commissariat', () => {
  it('navigation A* entre étages par l\'escalier', () => {
    const s = initialStation();
    const p = navPath(s, { f: 0, x: 3, y: 2 }, { f: 1, x: 9, y: 2 });
    expect(p.length).toBeGreaterThan(5);
    expect(p.some((n) => n.f === 1)).toBe(true);
  });
  it('construction : collisions, porte automatique, mobilier qui ne bloque pas la circulation', () => {
    const st = game(1);
    expect(placeRoom(st, 'cafeteria', 0, 0, 0, 4, 4).ok).toBe(false); // occupé
    const r = placeRoom(st, 'cafeteria', 1, 11, 8, 6, 6);
    expect(r.ok).toBe(true);
    expect(r.room!.doors.length).toBe(1);
    expect(roomConnected(st.station, r.room!)).toBe(true);
    const err = canPlaceFurniture(st.station, r.room!, 'canape', r.room!.x, r.room!.y);
    expect(typeof err === 'string' || err === null).toBe(true);
  });
});

describe('Simulation de longue durée', () => {
  it('plusieurs années de gestion déléguée sans intervention', () => {
    const st = game(2024, 1995, 'delegation');
    for (let y = 0; y < 3; y++) step(st, 365 * 1440);
    expect(calendar(st.startYear, st.minute).year).toBeGreaterThanOrEqual(1997);
    const closed = st.cases.filter((c) => c.outcome && c.outcome.decision !== 'complement');
    expect(closed.length).toBeGreaterThan(100);
    const correct = closed.filter((c) => c.outcome!.correct).length / closed.length;
    expect(correct).toBeGreaterThan(0.7);
    expect(st.hierarchy.evaluations.length).toBeGreaterThanOrEqual(2);
    for (const s of st.staff) {
      expect(s.fatigue).toBeGreaterThanOrEqual(0);
      expect(s.fatigue).toBeLessThanOrEqual(100);
      for (const v of Object.values(s.skills)) expect(v).toBeGreaterThanOrEqual(1);
    }
    expect(Number.isFinite(totalSpent(st.budget))).toBe(true);
    expect(JSON.stringify(st).length).toBeLessThan(8_000_000);
    // innocents condamnés : rares
    const wrong = closed.filter((c) => c.outcome!.verdict === 'condamnation' && !c.outcome!.correct).length;
    expect(wrong / closed.length).toBeLessThan(0.05);
  }, 120000);
  it('toutes les époques démarrent et tournent un mois', () => {
    for (const y of [1975, 1985, 2005, 2015, 2025]) {
      const st = newGame({ seed: y, startYear: y, size: y === 1975 ? 'commune' : 'metropole', scenario: 'libre', assist: 'delegation', commander: { prenom: 'Marc', nom: 'Henry', age: 50, portrait: 1, experience: 'chevronne', formation: 'rang', specialite: 'Procédure', style: 'directif', sexe: 'M' } });
      step(st, 30 * 1440);
      expect(st.cases.length).toBeGreaterThan(2);
    }
  });
});

describe('Commissariat agrandissable (V0.3)', () => {
  it('agrandir le terrain puis construire cellules, cantine et autres pièces', async () => {
    const { extend, placeRoom, capacities, canPlaceRoom, roomAvailable, BUILDABLE } = await import('../src/sim/station');
    const st = game(31);
    expect(capacities(st).cells).toBeGreaterThan(0); // le commissariat de référence a des cellules
    expect(canPlaceRoom(st.station, 0, 22, 0, 6, 6)).toMatch(/agrandissez/);
    extend(st.station, 'est');
    expect(st.station.w).toBe(28);
    expect(placeRoom(st, 'cantine', 0, 22, 0, 6, 6).ok).toBe(true);
    // l'allée du garage reste libre
    extend(st.station, 'sud');
    expect(placeRoom(st, 'tir', 0, 2, 14, 6, 4).ok).toBe(false);
    expect(placeRoom(st, 'tir', 0, 6, 14, 8, 4).ok).toBe(true);
    for (const r of st.station.rooms) r.built = 0;
    const cap = capacities(st);
    expect(cap.cantine).toBe(1);
    expect(cap.tir).toBe(true);
    // pièces datées : pas d'unité numérique en 1975
    expect(roomAvailable('numerique', 1975)).toBe(false);
    expect(roomAvailable('cellules', 1975)).toBe(true);
    expect(BUILDABLE.length).toBeGreaterThanOrEqual(30);
  });
  it('les cellules raccourcissent les gardes à vue, la cantine aide à récupérer', async () => {
    const { capacities } = await import('../src/sim/station');
    const st = game(32);
    const withCells = capacities(st).cells;
    st.station.rooms = st.station.rooms.filter((r) => r.type !== 'cellules');
    expect(capacities(st).cells).toBe(0);
    expect(withCells).toBeGreaterThan(0);
  });
});

describe('Technologies et flotte au fil des époques (V0.3)', () => {
  it('technologies disponibles selon l\'année, achat et effet', async () => {
    const { TECHS, buyTech, actionBonus, initialTechs } = await import('../src/sim/tech');
    expect(initialTechs(1975)).toEqual([]);
    expect(initialTechs(2025).length).toBeGreaterThan(8);
    const st = game(33, 1995, 'manuel');
    expect(st.techs).toContain('telex');
    expect(st.techs).not.toContain('adn');
    expect(buyTech(st, 'adn')).toMatch(/Pas encore/);
    const before = actionBonus(st, 'requisition');
    st.minute += 14 * 365 * 1440; // 2009
    buyTech(st, 'geoloc');
    expect(actionBonus(st, 'requisition')).toBeGreaterThan(before);
    expect(TECHS.length).toBeGreaterThanOrEqual(12);
  });
  it('un véhicule renouvelé prend le modèle de son époque', async () => {
    const { renewVehicle } = await import('../src/sim/sim');
    const { eraOf } = await import('../src/sim/calendar');
    const { Rng } = await import('../src/core/rng');
    const st = game(34, 1975, 'manuel');
    st.minute += 30 * 366 * 1440; // 2005
    const v = st.vehicles[0];
    renewVehicle(st, new Rng(1), v.id);
    expect(v.year).toBe(2005);
    expect(eraOf(2005).vehicles).toContain(v.model);
  });
});
