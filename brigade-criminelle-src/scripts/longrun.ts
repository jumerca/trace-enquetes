import { game } from '../tests/helpers';
import { step } from '../src/sim/sim';
import { dateLabel } from '../src/sim/calendar';
const st = game(Number(process.argv[2] ?? 1), 1995, 'delegation');
const t0 = Date.now();
for (let m = 0; m < Number(process.argv[3] ?? 12); m++) {
  step(st, 30 * 1440);
  const cl = st.cases.filter((c) => c.status !== 'ouverte');
  const dec: Record<string, number> = {};
  for (const c of cl) { const k = (c.outcome?.decision ?? '?') + (c.outcome?.verdict ? ':' + c.outcome.verdict : '') + (c.outcome?.correct ? '+' : '-'); dec[k] = (dec[k] ?? 0) + 1; }
  console.log(dateLabel(st.startYear, st.minute, false), 'cases', st.cases.length, 'open', st.cases.length - cl.length, JSON.stringify(dec), 'staff', st.staff.length, 'fat', Math.round(st.staff.reduce((s, x) => s + x.fatigue, 0) / st.staff.length), 'mor', Math.round(st.staff.reduce((s, x) => s + x.moral, 0) / st.staff.length), 'lab', st.lab.queue.length, 'spent', Object.values(st.budget.spent).reduce((a, b) => a + b, 0), '/', Object.values(st.budget.envelope).reduce((a, b) => a + b, 0), 'trust', Math.round(st.publicTrust));
}
console.log('ms', Date.now() - t0, 'json KB', Math.round(JSON.stringify(st).length / 1024));
const c = st.cases.find((x) => x.status === 'ouverte');
if (c) console.log(c.title, c.stage, c.lead, c.actions.map((a) => a.kind + ':' + a.approved + ':' + a.hours.toFixed(1)), c.done.slice(-6).map((d) => d.text));
for (const c of st.cases.filter((x) => x.saga)) console.log('SAGA', c.templateId, c.status, c.outcome?.decision, c.outcome?.verdict, c.outcome?.correct, c.outcome?.designated && st.people[c.outcome.designated].nom, 'found', c.clues.filter((k) => k.found).length + '/' + c.clues.length);
const cl = st.cases.filter((c) => c.outcome && c.outcome.decision !== 'complement');
const d = cl.map((c) => (c.outcome!.at - c.openedAt) / 1440).sort((a, b) => a - b);
console.log('median days', d[Math.floor(d.length / 2)]?.toFixed(1), 'flaws', st.cases.reduce((s, c) => s + c.procedureFlaws, 0), 'eval', JSON.stringify(st.hierarchy.evaluations));
