import { Engine } from '../render/engine';
import { StationView } from '../render/station-view';
import { newGame, step } from '../sim/sim';
const q = new URLSearchParams(location.search);
const st = newGame({ seed: 3, startYear: Number(q.get('y') ?? 1995), size: 'moyenne', assist: 'delegation', commander: { prenom: 'Claire', nom: 'Vasseur', age: 45, portrait: 0, experience: 'confirme', formation: 'ecole', specialite: 'Généraliste', style: 'participatif', sexe: 'F' } });
step(st, Number(q.get('m') ?? 120));
if (q.get('ext')) {
  const { extend, placeRoom } = await import('../sim/station');
  extend(st.station, 'est'); extend(st.station, 'sud');
  const plan: [string, number, number, number, number, number][] = [['cantine', 0, 22, 0, 6, 6], ['couloir', 0, 22, 6, 6, 2], ['armurerie', 0, 22, 8, 3, 3], ['infirmerie', 0, 25, 8, 3, 3], ['sport', 0, 22, 11, 6, 5], ['signaletique', 0, 0, 14, 4, 4], ['tir', 0, 6, 14, 8, 4], ['presse', 1, 11, 8, 6, 6], ['ecoutes', 1, 17, 8, 5, 4], ['couloir', 1, 22, 6, 6, 2], ['repos', 1, 22, 0, 6, 6]];
  for (const [t, f, x, y, w, h] of plan) { const r = placeRoom(st, t as never, f, x, y, w, h); if (r.room) r.room.built = 0; else console.log('KO', t, r.msg); }
}
if (q.get('lshape')) {
  const { extend, placeRoom } = await import('../sim/station');
  extend(st.station, 'est');
  const r = placeRoom(st, 'bureaux', 0, 22, 2, 6, 7, 'L-se');
  if (r.room) { r.room.built = 0; r.room.furniture.forEach((f, i) => { if (i % 2) f.rot = 1; }); } else console.log('KO L', r.msg);
}
const e = new Engine();
e.getState = () => st;
await e.init(document.getElementById('h')!);
const v = new StationView(() => st, { onStaff: (id) => console.log('staff', id), onRoom: (id) => console.log('room', id) });
v.setFloor(Number(q.get('f') ?? 0));
e.setView(v);
if (q.get('z')) e.zoomBy(Number(q.get('z')));
setInterval(() => step(st, 10), 1000);
(window as any).st = st;
