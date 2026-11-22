// Composants visuels : portraits, podium animé, bulle du commentateur, séance de qualifications, graphique des essais.
import { useEffect, useMemo, useRef, useState } from 'react';
import { paintPortrait } from '../render/art';
import { PaintedCar } from './PaintedCar';
import { getTrack } from '../engine/tracks';
import { fmtLap } from '../engine/race';

// ================================================================ Portrait

export function DriverPortrait({ id, color, color2, size = 56, className }: { id: string; color: string; color2: string; size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const art = paintPortrait(id, color, color2, Math.round(size * dpr));
    cv.width = art.width;
    cv.height = art.height;
    cv.getContext('2d')!.drawImage(art, 0, 0);
  }, [id, color, color2, size]);
  return <canvas ref={ref} className={'portrait ' + (className ?? '')} style={{ width: size, height: size }} aria-hidden />;
}

// ================================================================ Commentateur

export function CommentatorBubble({ text, mood }: { text: string; mood: 'excite' | 'grave' | 'calme' }) {
  return (
    <div className={'commentator ' + mood} role="status">
      <DriverPortrait id="commentateur-jlg" color="#1d3557" color2="#ffd400" size={44} />
      <div className="bubble"><b>{mood === 'excite' ? 'INCROYABLE !' : mood === 'grave' ? 'OUILLE…' : 'EN DIRECT'}</b> {text}</div>
    </div>
  );
}

// ================================================================ Podium

export interface PodiumRow {
  id: string;
  name: string;
  teamName: string;
  color: string;
  color2: string;
  number: number;
  mine: boolean;
}

export function Podium({ rows, extra, onContinue }: { rows: PodiumRow[]; extra: React.ReactNode; onContinue: () => void }) {
  const order = [rows[1], rows[0], rows[2]].filter(Boolean);
  // gouttes de champagne et confettis (positions pseudo-aléatoires stables)
  const drops = useMemo(() => Array.from({ length: 46 }, (_, i) => ({
    left: 50 + Math.sin(i * 12.9898) * 38,
    delay: (i % 12) * 0.12,
    dur: 1.4 + (i % 5) * 0.25,
    color: i % 3 === 0 ? '#ffd400' : i % 3 === 1 ? '#f4f1ea' : rows[i % rows.length]?.color ?? '#d62828',
    size: 5 + (i % 4) * 2,
    dx: Math.cos(i * 4.1) * 160,
  })), [rows]);
  return (
    <div className="podium-overlay">
      <div className="podium-stage">
        <div className="podium-spray" aria-hidden>
          {drops.map((d, i) => (
            <i key={i} style={{ left: d.left + '%', animationDelay: d.delay + 's', animationDuration: d.dur + 's', background: d.color, width: d.size, height: d.size, ['--dx' as string]: d.dx + 'px' }} />
          ))}
        </div>
        <h2 className="podium-title">PODIUM !</h2>
        <div className="podium-steps">
          {order.map((r) => {
            const place = rows.indexOf(r) + 1;
            return (
              <div key={r.id} className={'step p' + place + (r.mine ? ' mine' : '')}>
                <div className="who">
                  <DriverPortrait id={r.id} color={r.color} color2={r.color2} size={place === 1 ? 74 : 60} />
                  <b>{r.name}</b>
                  <small>{r.teamName}</small>
                </div>
                <div className="car"><PaintedCar livery={{ color: r.color, color2: r.color2, number: r.number }} width={place === 1 ? 170 : 140} angle={-Math.PI / 2} /></div>
                <div className="block"><span>{place}</span></div>
              </div>
            );
          })}
        </div>
        <div className="podium-extra">{extra}</div>
        <button className="btn primary big" onClick={onContinue}>Voir les résultats →</button>
      </div>
    </div>
  );
}

// ================================================================ Qualifications animées

export interface QualiRunner {
  id: string;
  short: string;
  color: string;
  mine: boolean;
  laps: number[]; // temps des 3 tentatives (s)
}

/**
 * Rejoue la séance de qualifications calculée par le moteur : chrono en direct, classement qui évolue,
 * tour lancé de vos pilotes sur la carte. Les temps affichés sont exactement ceux du moteur.
 */
export function QualiSession({ trackId, runners, onDone }: { trackId: string; runners: QualiRunner[]; onDone: () => void }) {
  const SPEEDUP = 9; // 1 s affichée = 9 s de séance
  const STAGGER = 0.5; // départs échelonnés (s affichées)
  const RUN_GAP = 14; // écart entre deux tentatives (s affichées)
  const [clock, setClock] = useState(0);
  const [mult, setMult] = useState(1);
  const multRef = useRef(1);
  multRef.current = mult;
  const t = getTrack(trackId);
  const geo = useMemo(() => {
    const b = t.bounds, pad = 60;
    let d = '';
    for (let i = 0; i < t.n; i += 6) d += (i ? 'L' : 'M') + t.x[i].toFixed(0) + ' ' + t.y[i].toFixed(0);
    return { d: d + 'Z', vb: `${b.minX - pad} ${b.minY - pad} ${b.maxX - b.minX + pad * 2} ${b.maxY - b.minY + pad * 2}` };
  }, [t]);
  const sched = useMemo(() => {
    const items: { id: string; run: number; start: number; dur: number; time: number }[] = [];
    runners.forEach((r, i) => r.laps.forEach((lap, run) => items.push({ id: r.id, run, start: run * RUN_GAP + i * STAGGER, dur: lap / SPEEDUP, time: lap })));
    return items;
  }, [runners]);
  const end = Math.max(...sched.map((x) => x.start + x.dur)) + 1;
  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      setClock((c) => Math.min(end, c + dt * multRef.current));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [end]);
  // meilleurs temps connus à l'instant « clock »
  const best = new Map<string, number>();
  for (const it of sched) if (clock >= it.start + it.dur) best.set(it.id, Math.min(best.get(it.id) ?? Infinity, it.time));
  const tower = runners
    .map((r) => ({ r, t: best.get(r.id) ?? Infinity }))
    .sort((a, b) => a.t - b.t);
  const pole = tower[0]?.t ?? Infinity;
  // pilotes du joueur en piste : position sur la carte (fraction du tour) et chrono en cours
  const live = runners.filter((r) => r.mine).map((r) => {
    const it = sched.find((x) => x.id === r.id && clock >= x.start && clock < x.start + x.dur);
    if (!it) return null;
    const f = (clock - it.start) / it.dur;
    const i = Math.min(t.n - 1, Math.floor(f * t.n));
    return { r, x: t.x[i], y: t.y[i], chrono: (clock - it.start) * SPEEDUP, run: it.run };
  }).filter(Boolean) as { r: QualiRunner; x: number; y: number; chrono: number; run: number }[];
  const done = clock >= end;
  const run = Math.min(3, Math.floor(clock / RUN_GAP) + 1);
  return (
    <div className="quali-session">
      <div className="panel quali-map">
        <div className="row spread">
          <h2>Qualifications — tentative {run}/3</h2>
          <div className="seg">
            {[1, 3].map((m) => <button key={m} className={mult === m ? 'on' : ''} onClick={() => setMult(m)}>×{m}</button>)}
            <button onClick={() => setClock(end)}>Fin ⏭</button>
          </div>
        </div>
        <svg viewBox={geo.vb} className="quali-svg">
          <path d={geo.d} fill="none" stroke="#16130f" strokeWidth="40" strokeLinejoin="round" />
          <path d={geo.d} fill="none" stroke="#5a5c62" strokeWidth="24" strokeLinejoin="round" />
          <rect x={t.x[0] - 6} y={t.y[0] - 30} width="12" height="60" fill="#f4f1ea" stroke="#16130f" strokeWidth="4" />
          {live.map((l) => (
            <g key={l.r.id}>
              <circle cx={l.x} cy={l.y} r="34" fill={l.r.color} stroke="#16130f" strokeWidth="8" />
              <text x={l.x} y={l.y - 46} textAnchor="middle" fontSize="54" fontFamily="Bangers, Impact" fill="#ffd400" stroke="#16130f" strokeWidth="8" paintOrder="stroke">{l.r.short}</text>
            </g>
          ))}
        </svg>
        <div className="quali-live">
          {live.length === 0 && !done && <p className="muted">Vos pilotes attendent leur tour dans le garage…</p>}
          {live.map((l) => (
            <p key={l.r.id}><b style={{ color: l.r.color }}>{l.r.short}</b> en tour lancé (tentative {l.run + 1}) : <b className="chrono">{fmtLap(l.chrono)}</b>
              {Number.isFinite(pole) && <small> · pole actuelle {fmtLap(pole)}</small>}</p>
          ))}
          {done && <button className="btn primary big" onClick={onDone}>Voir la grille et la stratégie →</button>}
        </div>
      </div>
      <div className="panel quali-tower">
        <h3>Chronos</h3>
        <ol>
          {tower.map(({ r, t: tt }, i) => (
            <li key={r.id} className={r.mine ? 'me' : ''}>
              <span className="p">{Number.isFinite(tt) ? i + 1 : '–'}</span>
              <i style={{ background: r.color }} />
              <span className="n">{r.short}</span>
              <span className="g">{Number.isFinite(tt) ? (i === 0 ? fmtLap(tt) : '+' + (tt - pole).toFixed(3)) : 'en piste…'}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ================================================================ Graphique des essais

export function PracticeChart({ runs }: { runs: { best: number; setup: { aileron: number; suspension: number; boite: number } }[] }) {
  if (runs.length < 2) return null;
  const W = 300, H = 120, P = 28;
  const ts = runs.map((r) => r.best);
  const lo = Math.min(...ts), hi = Math.max(...ts);
  const span = Math.max(0.2, hi - lo);
  const x = (i: number) => P + (i * (W - P * 2)) / Math.max(1, runs.length - 1);
  const y = (v: number) => 14 + ((v - lo) / span) * (H - 44);
  const bestIdx = ts.indexOf(lo);
  return (
    <svg className="practice-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Meilleur tour par relais">
      <line x1={P} x2={W - P} y1={H - 26} y2={H - 26} stroke="#16130f" strokeWidth="1.5" />
      <polyline points={runs.map((r, i) => `${x(i)},${y(r.best)}`).join(' ')} fill="none" stroke="#3a86ff" strokeWidth="2.5" />
      {runs.map((r, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(r.best)} r={i === bestIdx ? 6 : 4.5} fill={i === bestIdx ? '#2aa876' : '#f4f1ea'} stroke="#16130f" strokeWidth="2" />
          <text x={x(i)} y={y(r.best) - 9} textAnchor="middle" fontSize="9" fill="#16130f">{i === 0 ? fmtLap(r.best) : (r.best - runs[0].best >= 0 ? '+' : '') + (r.best - runs[0].best).toFixed(2)}</text>
          <text x={x(i)} y={H - 14} textAnchor="middle" fontSize="8" fill="#6d665b">R{i + 1}</text>
          <text x={x(i)} y={H - 4} textAnchor="middle" fontSize="7" fill="#6d665b">{r.setup.aileron}/{r.setup.suspension}/{r.setup.boite}</text>
        </g>
      ))}
    </svg>
  );
}
