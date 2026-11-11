import { advanceWeek, createCareer, depthChart, recordUserMatch, startNextSeason, user, userClub, userFixture, userRole } from '../src/career/career';
import { fastSimGame } from '../src/career/fastsim';
import { Rng } from '../src/core/rng';
import { age, playerOvr } from '../src/data/generate';
for (const seed of [1, 2]) {
  const c = createCareer({ firstName: 'A', lastName: 'B' + seed, nationality: 'FRA', birthCity: 'Lyon', age: 17, heightCm: 196, weightKg: 90, hand: 'R', number: 23, pos: 'SG', pos2: 'SF', archetype: 'sharpshooter', appearance: { skin: 2, hair: 1, hairColor: 0, beard: 0, headband: false, sleeve: false }, path: 'amateur', seed });
  const line: string[] = [];
  for (let s = 0; s < 14 && !c.retired; s++) {
    while (c.phase !== 'offseason') {
      const f = userFixture(c);
      if (f) {
        const ti = (id: string) => { const dc = depthChart(c, id); return dc.order.filter((p) => p.injuryDays <= 0).map((p) => ({ p, minutes: dc.minutes[p.id] ?? 0, starter: dc.starters.includes(p) })); };
        const r = fastSimGame(ti(f.home), ti(f.away), new Rng(c.week * 31 + s));
        recordUserMatch(c, f, r.hs, r.as, new Map([...r.lines].map(([k, v]) => [k, { ...v, pm: 0 }])), false);
      }
      advanceWeek(c);
      if (c.week > 40) { console.log('STUCK', c.phase, c.week, c.world.season); process.exit(1); }
    }
    if (c.offers.length && c.offers[0].clubId !== user(c).clubId && Math.random() < 0.5) { /* garde les offres pour l'acceptation auto */ }
    line.push(`${age(user(c), c.world.season)}:${playerOvr(user(c))}/${userClub(c).short}/${userRole(c).label[0]}`);
    console.log('season', s, line[line.length-1]);
    startNextSeason(c);
  }
  console.log('pot', user(c).potential, line.join(' '));
}
