import { ArticleCard, ConferenceCard } from './HubCareer';
import { lazy, Suspense, useEffect, useState } from 'react';
import type { GameApi } from '../App';
import {
  closeWeekend, driverById, expectedWearPerLap, playerTeam, practiceRun, raceLaps, runQualifying, setSetup, setStrategy,
  startRace, strategyRuleOk, suggestStrategy, teamById, teamDrivers, PRACTICE_RUNS, type Strategy,
} from '../../game/career';
import { getTrack } from '../../engine/tracks';
import { fmtLap } from '../../engine/race';
import { COMPOUNDS } from '../../engine/physics';
import type { CarSetup, Compound } from '../../engine/types';
import { TyreChip, Weather, money } from '../common';
// La course (PixiJS, rendu) est chargée à la demande : les menus s'ouvrent plus vite sur mobile.
const RaceView = lazy(() => import('./RaceView').then((m) => ({ default: m.RaceView })));
import { PracticeChart, QualiSession } from '../Visuals';
import { teamStandings } from '../../game/career';

const PHASES = [['essais', 'Essais libres'], ['qualifs', 'Qualifications'], ['strategie', 'Stratégie'], ['course', 'Course'], ['resultats', 'Résultats']] as const;

export function WeekendScreen({ api }: { api: GameApi }) {
  const c = api.career;
  const w = c.weekend;
  useEffect(() => {
    if (!w) api.go('hub');
  }, [w, api]);
  if (!w) return null;
  const tr = getTrack(w.trackId).def;
  const phaseIdx = PHASES.findIndex(([p]) => p === w.phase);
  if (w.phase === 'course') return <Suspense fallback={<div className="page loading"><p>Chargement de la course…</p></div>}><RaceView api={api} /></Suspense>;
  return (
    <div className="page weekend">
      <header className="pagehead">
        <button className="btn ghost" onClick={() => api.go('hub')}>← QG</button>
        <div>
          <h1>{tr.gp}</h1>
          <small>{tr.name} · {raceLaps(c)} tours · <Weather w={w.weather} /></small>
          {w.forecast && <small className="forecast"> · Prévision : {w.forecast}</small>}
        </div>
        <span className="steps">{PHASES.map(([p, l], i) => <i key={p} className={i === phaseIdx ? 'on' : i < phaseIdx ? 'done' : ''}>{l}</i>)}</span>
      </header>
      {w.phase === 'essais' && <Practice api={api} />}
      {w.phase === 'qualifs' && <Quali api={api} />}
      {w.phase === 'strategie' && <StrategyPhase api={api} />}
      {w.phase === 'resultats' && <Results api={api} />}
    </div>
  );
}

function Practice({ api }: { api: GameApi }) {
  const c = api.career;
  const w = c.weekend!;
  const mine = teamDrivers(c, c.playerTeamId);
  const [, setV] = useState(0);
  return (
    <div>
      <p className="intro panel">
        Ajustez les réglages puis lancez des relais de 5 tours. Les retours des pilotes deviennent plus fiables à chaque relais.
        {w.weather === 'pluie' && ' Piste mouillée : roulage en pneus pluie.'}
      </p>
      <div className="grid2">
        {mine.map((d) => {
          const p = w.practice[d.id];
          const s = w.setups[d.id];
          const last = p.runs[p.runs.length - 1];
          const best = p.runs.length ? Math.min(...p.runs.map((r) => r.best)) : 0;
          const upd = (k: keyof CarSetup, v: number) => { setSetup(c, d.id, { ...s, [k]: v }); setV((x) => x + 1); };
          return (
            <section className="panel" key={d.id}>
              <h2>#{d.number} {d.first} {d.last}</h2>
              <SetupSlider label="Aileron (appui)" left="Peu d’appui" right="Beaucoup" value={s.aileron} onChange={(v) => upd('aileron', v)} />
              <SetupSlider label="Suspensions" left="Souples" right="Raides" value={s.suspension} onChange={(v) => upd('suspension', v)} />
              <SetupSlider label="Rapports de boîte" left="Courts" right="Longs" value={s.boite} onChange={(v) => upd('boite', v)} />
              <div className="row spread">
                <small>Connaissance du réglage : <b>{Math.round(p.knowledge * 100)} %</b></small>
                <button className="btn primary" disabled={p.runs.length >= PRACTICE_RUNS} onClick={() => api.act((cc) => { const r = practiceRun(cc, d.id); return typeof r === 'string' ? r : null; })}>
                  Lancer un relais ({p.runs.length}/{PRACTICE_RUNS})
                </button>
              </div>
              {last && (
                <div className="feedback">
                  <p>Dernier relais : meilleur tour <b>{fmtLap(last.best)}</b> {best && best < last.best - 0.001 ? <small>(record du week-end {fmtLap(best)})</small> : null}</p>
                  <ul>{last.feedback.map((f) => <li key={f.axis} className={f.dir === 0 ? 'ok' : 'todo'}>« {f.text} »</li>)}</ul>
                </div>
              )}
              <PracticeChart runs={p.runs} />
              {p.runs.length > 1 && (
                <table className="table small">
                  <thead><tr><th>Relais</th><th>Aileron</th><th>Susp.</th><th>Boîte</th><th>Meilleur</th></tr></thead>
                  <tbody>{p.runs.map((r, i) => <tr key={i} className={r.best === best ? 'me' : ''}><td>{i + 1}</td><td>{r.setup.aileron}</td><td>{r.setup.suspension}</td><td>{r.setup.boite}</td><td>{fmtLap(r.best)}</td></tr>)}</tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
      <footer className="actions">
        <button className="btn primary big" onClick={() => api.act((cc) => { cc.weekend!.phase = 'qualifs'; })}>Passer aux qualifications →</button>
      </footer>
    </div>
  );
}

function SetupSlider({ label, left, right, value, onChange }: { label: string; left: string; right: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="setup">
      <span>{label} <b>{value}</b></span>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="ends"><small>{left}</small><small>{right}</small></span>
    </label>
  );
}

function Quali({ api }: { api: GameApi }) {
  const c = api.career;
  return (
    <div className="panel center">
      <h2>Qualifications</h2>
      <p>Chaque pilote dispose de trois tentatives en pneus {c.weekend!.weather === 'pluie' ? 'pluie' : 'tendres'}. Le meilleur tour détermine la grille.</p>
      <button className="btn primary big" onClick={() => api.act((cc) => { const r = runQualifying(cc); return typeof r === 'string' ? r : null; })}>Lancer les qualifications</button>
    </div>
  );
}

function StrategyPhase({ api }: { api: GameApi }) {
  const c = api.career;
  const w = c.weekend!;
  const q = w.quali!;
  const laps = raceLaps(c);
  const mine = teamDrivers(c, c.playerTeamId);
  const [reveal, setReveal] = useState(q.length);
  useEffect(() => {
    // Révélation progressive de la grille (purement visuelle : les temps sont déjà calculés).
    setReveal(0);
    const id = window.setInterval(() => setReveal((r) => (r >= q.length ? (window.clearInterval(id), r) : r + 1)), 90);
    return () => window.clearInterval(id);
  }, [q, w.qualiSeen]);
  const pole = q[0].time;
  if (!w.qualiSeen) {
    const runners = q.map((e) => {
      const d = driverById(c, e.driverId);
      const t = teamById(c, d.teamId!);
      return { id: d.id, short: d.short, color: t.color, mine: t.isPlayer, laps: e.laps };
    }).sort((a, b) => a.id.localeCompare(b.id));
    return <QualiSession trackId={w.trackId} runners={runners} onDone={() => api.act((cc) => { cc.weekend!.qualiSeen = true; })} />;
  }
  return (
    <>
    <Briefing api={api} />
    <div className="grid2">
      <section className="panel">
        <h2>Grille de départ</h2>
        <table className="table">
          <thead><tr><th>Pos</th><th>Pilote</th><th>Temps</th><th>Écart</th></tr></thead>
          <tbody>
            {q.map((e, i) => {
              if (i < q.length - reveal) return null;
              const d = driverById(c, e.driverId);
              const t = teamById(c, d.teamId!);
              return (
                <tr key={e.driverId} className={t.isPlayer ? 'me' : ''}>
                  <td>{i + 1}</td><td><i className="dot" style={{ background: t.color }} />{d.first[0]}. {d.last} <small>{t.short}</small>{e.mistake ? <small title="erreur sur une tentative"> ⚠</small> : null}</td>
                  <td>{fmtLap(e.time)}</td><td>{i ? '+' + (e.time - pole).toFixed(3) : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="panel">
        <h2>Stratégie ({laps} tours)</h2>
        {mine.map((d) => <StrategyEditor key={d.id} api={api} driverId={d.id} grid={q.findIndex((x) => x.driverId === d.id) + 1} />)}
        {w.forecast && <p className="forecast-box">🌦 Prévision météo : {w.forecast}</p>}
        <p className="muted">Pendant la course : rythme (éco / normal / attaque), appel au stand, consignes d’équipe. Votre ingénieur vous parle à la radio.</p>
        <button className="btn primary big" onClick={() => { api.act((cc) => { const r = startRace(cc); return typeof r === 'string' ? r : null; }); }}>
          Départ du Grand Prix 🏁
        </button>
      </section>
    </div>
    </>
  );
}

/** Briefing d'avant-course : météo, profil du circuit, rivaux directs, conseil de l'ingénieur. */
function Briefing({ api }: { api: GameApi }) {
  const c = api.career;
  const w = c.weekend!;
  const tr = getTrack(w.trackId).def;
  const q = w.quali!;
  const mine = teamDrivers(c, c.playerTeamId);
  const stars = (v: number, max = 5) => '★'.repeat(Math.max(1, Math.round(v * max))) + '☆'.repeat(Math.max(0, max - Math.max(1, Math.round(v * max))));
  const ts = teamStandings(c);
  const myPos = ts.findIndex((t) => t.teamId === c.playerTeamId);
  const champRivals = [ts[myPos - 1], ts[myPos + 1]].filter(Boolean).map((t) => teamById(c, t.teamId).name);
  return (
    <section className="panel briefing">
      <h2>🎧 Briefing de l’ingénieur</h2>
      <div className="brief-grid">
        <div>
          <h3>Conditions</h3>
          <p>{w.forecast ?? (w.weather === 'pluie' ? 'Pluie.' : 'Temps sec.')}</p>
          <p className="muted">Dépassement : {stars(tr.overtaking)} · Usure des pneus : {stars(Math.min(1, tr.wear / 4.5))}</p>
          <p className="muted">{tr.description}</p>
        </div>
        <div>
          <h3>Rivaux directs</h3>
          {mine.map((d) => {
            const k = q.findIndex((x) => x.driverId === d.id);
            const ahead = q[k - 1] ? driverById(c, q[k - 1].driverId) : null;
            const behind = q[k + 1] ? driverById(c, q[k + 1].driverId) : null;
            return <p key={d.id}><b>{d.short}</b> ({k + 1}ᵉ) : devant {ahead ? `${ahead.short} (${teamById(c, ahead.teamId!).short})` : '—'}, derrière {behind ? `${behind.short} (${teamById(c, behind.teamId!).short})` : '—'}</p>;
          })}
          {champRivals.length > 0 && <p className="muted">Au championnat, surveillez : {champRivals.join(' et ')}.</p>}
        </div>
        <div>
          <h3>Stratégie conseillée</h3>
          {mine.map((d) => {
            const sg = suggestStrategy(c, d.id, w.weather === 'pluie' ? 'P' : 'M');
            const seq = [sg.start, ...sg.plan.map((p) => p.compound)].map((k) => COMPOUNDS[k].name).join(' → ');
            return <p key={d.id}><b>{d.short}</b> : {seq}{sg.plan.length ? ` (arrêt${sg.plan.length > 1 ? 's' : ''} tour ${sg.plan.map((p) => p.lap).join(', ')})` : ''}</p>;
          })}
          <p className="muted">Sur les circuits à forte usure, deux arrêts en pneus tendres peuvent payer ; une voiture de sécurité rend un arrêt presque gratuit.</p>
        </div>
      </div>
    </section>
  );
}

function StrategyEditor({ api, driverId, grid }: { api: GameApi; driverId: string; grid: number }) {
  const c = api.career;
  const w = c.weekend!;
  const laps = raceLaps(c);
  const d = driverById(c, driverId);
  const st = w.strategy[driverId];
  const set = (s: Strategy) => api.act((cc) => setStrategy(cc, driverId, s));
  const comps: Compound[] = w.weather === 'pluie' ? ['P', 'M'] : ['T', 'M', 'D', 'P'];
  let lapAcc = 0;
  const stints = [st.start, ...st.plan.map((p) => p.compound)].map((comp, i) => {
    const end = i < st.plan.length ? st.plan[i].lap : laps;
    const len = end - lapAcc;
    lapAcc = end;
    return { comp, len, wear: expectedWearPerLap(c, driverId, comp) * len };
  });
  return (
    <div className="strategy">
      <h3>#{d.number} {d.last} <small>— départ {grid}ᵉ</small></h3>
      <div className="row wrap">
        <span>Pneus de départ :</span>
        {comps.map((k) => <button key={k} className={'chip' + (st.start === k ? ' on' : '')} onClick={() => set({ ...st, start: k })}><TyreChip c={k} /> {COMPOUNDS[k].name}</button>)}
      </div>
      {st.plan.map((p, i) => (
        <div className="row wrap" key={i}>
          <span>Arrêt {i + 1} : fin du tour</span>
          <input type="number" min={1} max={laps - 1} value={p.lap} onChange={(e) => {
            const plan = st.plan.map((x, k) => (k === i ? { ...x, lap: Math.max(1, Math.min(laps - 1, Number(e.target.value) || 1)) } : x));
            set({ ...st, plan });
          }} />
          {comps.map((k) => <button key={k} className={'chip' + (p.compound === k ? ' on' : '')} onClick={() => set({ ...st, plan: st.plan.map((x, j) => (j === i ? { ...x, compound: k } : x)) })}><TyreChip c={k} /></button>)}
          <button className="icon" aria-label="Supprimer l’arrêt" onClick={() => set({ ...st, plan: st.plan.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <div className="row wrap">
        <button className="btn small" disabled={st.plan.length >= 3} onClick={() => set({ ...st, plan: [...st.plan, { lap: Math.min(laps - 1, (st.plan[st.plan.length - 1]?.lap ?? 0) + Math.ceil(laps / 2)), compound: w.weather === 'pluie' ? 'P' : 'M' }] })}>+ Ajouter un arrêt</button>
        <button className="btn small ghost" onClick={() => set(suggestStrategy(c, driverId, st.start))}>Suggestion de l’ingénieur</button>
      </div>
      {!strategyRuleOk(c, st) && <p className="warn">Règle : sur piste sèche, il faut utiliser au moins deux gommes différentes (sinon 20 s de pénalité).</p>}
      <div className="stints">
        {stints.map((s, i) => (
          <div key={i} className={'stint' + (s.wear > 95 ? ' bad' : s.wear > 80 ? ' warn' : '')} style={{ flex: Math.max(1, s.len), borderColor: COMPOUNDS[s.comp].color }}>
            <TyreChip c={s.comp} /> {s.len} t. · usure ≈ {Math.round(s.wear)} %
          </div>
        ))}
      </div>
    </div>
  );
}

function Results({ api }: { api: GameApi }) {
  const c = api.career;
  const w = c.weekend!;
  const res = w.result!;
  const tr = getTrack(w.trackId).def;
  const total = res.earnings.reduce((a, e) => a + e.amount, 0);
  const team = playerTeam(c);
  return (
    <div className="grid2">
      <section className="panel">
        <h2>Classement — {tr.gp}</h2>
        <table className="table">
          <thead><tr><th>Pos</th><th>Pilote</th><th>Écart</th><th>Grille</th><th>Arrêts</th><th>Pts</th></tr></thead>
          <tbody>
            {res.entries.map((e) => {
              const d = driverById(c, e.driverId);
              const t = teamById(c, e.teamId);
              return (
                <tr key={e.driverId} className={t.isPlayer ? 'me' : ''}>
                  <td>{e.status === 'abandon' ? 'Ab' : e.position}</td>
                  <td><i className="dot" style={{ background: t.color }} />{d.first[0]}. {d.last} <small>{t.short}</small>{res.fastest?.driverId === e.driverId ? <small title="meilleur tour"> ⏱</small> : null}</td>
                  <td>{e.gap}{e.penalty ? <small className="warn"> ⚖</small> : null}</td><td>{e.grid}</td><td>{e.stops}</td><td><b>{e.points || ''}</b></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {res.fastest && <p className="muted">Meilleur tour : {driverById(c, res.fastest.driverId).last} en {fmtLap(res.fastest.time)}</p>}
      </section>
      <section className="panel">
        <h2>Bilan de {team.name}</h2>
        <table className="table">
          <tbody>{res.earnings.map((e, i) => <tr key={i}><td>{e.label}</td><td className={e.amount < 0 ? 'neg' : 'pos'}>{money(e.amount, true)}</td></tr>)}</tbody>
          <tfoot><tr><td><b>Total</b></td><td className={total < 0 ? 'neg' : 'pos'}><b>{money(total, true)}</b></td></tr></tfoot>
        </table>
        <p>Budget : <b>{money(c.budget)}</b> · Réputation : <b>{team.reputation}</b> · Confiance des actionnaires : <b>{c.director?.confidence ?? '—'}/100</b></p>
        <button className="btn primary big" onClick={() => { api.act((cc) => closeWeekend(cc)); api.go('hub'); }}>Retour au QG →</button>
      </section>
      {c.conference && c.conference.round === res.round + 1 && c.conference.season === c.season && <ConferenceCard api={api} />}
      {c.press?.[0] && c.press[0].round === res.round + 1 && c.press[0].season === c.season && (
        <section className="panel"><ArticleCard c={c} a={c.press[0]} /></section>
      )}
    </div>
  );
}
