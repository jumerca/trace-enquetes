// Carrière complète simulée (délégation avancée) : un commandant de 28 ans en 1975 jusqu'à sa retraite.
// Les propositions sont acceptées (sur place, puis mutation une fois sur deux quand elle est offerte).
import { newGame, step, acceptMutation } from '../src/sim/sim';
import { acceptInPlace, level, postTitle } from '../src/sim/career';
import { Rng } from '../src/core/rng';
import { calendar } from '../src/sim/calendar';
let st = newGame({ seed: Number(process.argv[2] ?? 11), startYear: 1975, size: 'petite', scenario: 'libre', assist: 'delegation', commander: { prenom: 'Marc', nom: 'Henry', age: 28, portrait: 0, experience: 'debutant', formation: 'ecole', specialite: 'Généraliste', style: 'participatif', sexe: 'M' } });
const t0 = Date.now();
let k = 0;
while (!st.hierarchy.retired && k < 45) {
  step(st, 365 * 1440);
  k++;
  for (const o of st.hierarchy.offers.filter((x) => !x.answered)) {
    const mut = o.options.find((x) => x.kind === 'mutation');
    if (mut && k % 2 === 0) { const ns = acceptMutation(st, o.id); if (ns) st = ns; }
    else acceptInPlace(st, new Rng(k), o.id);
  }
  const y = calendar(st.startYear, st.minute).year;
  const closed = st.cases.filter((c) => c.outcome && c.outcome.decision !== 'complement');
  const ok = closed.length ? Math.round(closed.filter((c) => c.outcome!.correct).length / closed.length * 100) : 0;
  const ev = st.hierarchy.evaluations.slice(-1)[0];
  const net = st.network ? ` | antennes ${st.network.antennes.length} stock ${Math.round(st.network.antennes.reduce((t, a) => t + a.backlog, 0))}` : '';
  const fleet = st.vehicles.map((v) => v.year).join(',');
  console.log(`${y} | ${postTitle(st)} | ${st.commander.grade} | ${st.city.name} ${st.city.population} hab | staff ${st.staff.length} | cas ${st.cases.length} ouverts ${st.cases.filter((c) => c.status === 'ouverte').length} conformes ${ok}% | éval ${ev?.note ?? '-'} | rép ${Math.round(st.commander.reputation)} | ${Math.round(JSON.stringify(st).length / 1024)} Ko | ${Math.round((Date.now() - t0) / 1000)} s${net} | techs ${st.techs.length} | flotte ${fleet}`);
}
console.log('FIN carrière', st.hierarchy.retired ? 'retraite' : 'non terminée', 'échelon', st.hierarchy.rank, level(st).grade);
for (const c of st.hierarchy.career) console.log('  ', c.year, c.city, c.text);
