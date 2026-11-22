import { useEffect, useRef, useState } from 'react';
import type { GameApi } from '../App';
import { finishRace, raceConfig, recordRaceProgress, teamById } from '../../game/career';
import { isLowEndDevice } from '../../game/settings';
import { DT, RaceSim, fmtLap, type SimCar } from '../../engine/race';
import { RaceRenderer, type CameraMode } from '../../render/RaceRenderer';
import { RaceAudio } from '../../render/audio';
import { SPONSOR_SEEDS } from '../../game/data';
import type { Compound, DriveMode, RaceEvent } from '../../engine/types';
import { TyreChip, Weather } from '../common';

type Speed = 0 | 1 | 2 | 4;

interface Row {
  id: string;
  pos: number;
  short: string;
  name: string;
  color: string;
  gap: number;
  interval: number;
  compound: Compound;
  wear: number;
  status: SimCar['status'];
  pit: number;
  pitReq: Compound | null;
  mode: DriveMode;
  lastLap: number;
  bestLap: number;
  stops: number;
  player: boolean;
  laps: number;
  reason?: string;
}

interface Hud {
  rows: Row[];
  lap: number;
  events: RaceEvent[];
  t: number;
  flag: boolean;
  finished: boolean;
}

function snapshot(sim: RaceSim): Hud {
  return {
    rows: sim.standings().map((c) => ({
      id: c.id, pos: c.position, short: c.e.short, name: c.e.name, color: c.e.color, gap: c.gap, interval: c.interval,
      compound: c.compound, wear: c.wear, status: c.status, pit: c.pit, pitReq: c.pitReq, mode: c.mode, lastLap: c.lastLap,
      bestLap: c.bestLap, stops: c.stops, player: c.e.isPlayer, laps: c.laps, reason: c.reason,
    })),
    lap: sim.leaderLap,
    events: sim.events.slice(-5).reverse(),
    t: sim.t,
    flag: sim.flag,
    finished: sim.finished,
  };
}

function gapText(r: Row, mode: 'gap' | 'int'): string {
  if (r.status === 'dnf' || r.status === 'retiring') return 'ABD';
  if (r.pos === 1) return mode === 'gap' ? 'Leader' : '—';
  const v = mode === 'gap' ? r.gap : r.interval;
  if (r.gap < 0) return `+${-r.gap} T`;
  return '+' + v.toFixed(1);
}

export function RaceView({ api }: { api: GameApi }) {
  const c = api.career;
  const host = useRef<HTMLDivElement>(null);
  const simRef = useRef<RaceSim | null>(null);
  const rendRef = useRef<RaceRenderer | null>(null);
  const audioRef = useRef<RaceAudio | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; moved: boolean }>({ d: 0, moved: false });
  const [camMode, setCamMode] = useState<CameraMode>('suivre');
  const [sound, setSound] = useState(api.settings.sound);
  const speedRef = useRef<Speed>(1);
  const accRef = useRef(0);
  const [speed, setSpeedState] = useState<Speed>(1);
  const [hud, setHud] = useState<Hud | null>(null);
  const [gapMode, setGapMode] = useState<'gap' | 'int'>('gap');
  const [follow, setFollow] = useState<string | null>(null);
  const [fullList, setFullList] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [fps, setFps] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const setSpeed = (s: Speed) => {
    speedRef.current = s;
    setSpeedState(s);
    if (s === 0) persist();
  };

  const persist = () => {
    const sim = simRef.current;
    if (!sim || !c.weekend?.race || c.weekend.result) return;
    recordRaceProgress(c, sim.commands, sim.tick);
    api.save();
  };

  useEffect(() => {
    const w = c.weekend!;
    const sim = new RaceSim(raceConfig(c), w.race!.commands);
    while (sim.tick < w.race!.tick && !sim.finished) sim.step(); // reprise exacte grâce au déterminisme
    simRef.current = sim;
    const quality = api.settings.quality === 'auto' ? (isLowEndDevice() ? 'economie' : 'haute') : api.settings.quality;
    const banners = [...c.sponsors.map((x) => ({ name: x.name, color: x.color })), ...SPONSOR_SEEDS.map((x) => ({ name: x.name, color: x.color }))];
    const r = new RaceRenderer(sim, { quality, fpsCap: api.settings.fpsCap, names: api.settings.names, focusTeamId: c.playerTeamId, banners });
    const audio = new RaceAudio(api.settings.sound);
    audio.start();
    audioRef.current = audio;
    rendRef.current = r;
    let alive = true;
    r.init(host.current!).then(() => {
      if (!alive) return r.destroy();
      setFollow(r.follow);
      r.app.ticker.add((tk) => {
        const dtMs = Math.min(250, tk.deltaMS);
        const sp = speedRef.current;
        if (sp > 0 && !sim.finished) {
          accRef.current += (dtMs / 1000) * sp;
          let n = 0;
          while (accRef.current >= DT && n < 60) {
            sim.step();
            accRef.current -= DT;
            n++;
          }
          if (n >= 60) accRef.current = 0;
        }
        r.alpha = sim.finished ? 1 : Math.min(1, accRef.current / DT);
        r.render(dtMs);
        audio.update(sim, r.follow, sim.finished ? 0 : speedRef.current);
      });
    }).catch((e) => setError('Impossible d’initialiser le rendu graphique : ' + (e as Error).message));
    const hudId = window.setInterval(() => {
      setHud(snapshot(sim));
      if (rendRef.current) {
        setFps(Math.round(rendRef.current.fps));
        setFollow(rendRef.current.follow);
      }
    }, 250);
    const saveId = window.setInterval(persist, 15000);
    const onVis = () => {
      if (document.hidden) {
        speedRef.current = 0;
        setSpeedState(0);
        persist();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    setHud(snapshot(sim));
    return () => {
      alive = false;
      window.clearInterval(hudId);
      window.clearInterval(saveId);
      document.removeEventListener('visibilitychange', onVis);
      persist();
      r.destroy();
      audio.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sim = simRef.current;
  const issue = (carId: string, cmd: { type: 'mode'; mode: DriveMode } | { type: 'pit'; compound: Compound } | { type: 'cancelPit' }) => {
    if (!sim) return;
    sim.issue({ carId, ...cmd });
    persist();
    setHud(snapshot(sim));
  };

  const skipToEnd = () => {
    if (!sim || skipping) return;
    if (!confirm('Simuler instantanément la fin de la course ? Vos consignes actuelles seront conservées.')) return;
    setSkipping(true);
    const chunk = () => {
      for (let k = 0; k < 1500 && !sim.finished; k++) sim.step();
      setHud(snapshot(sim));
      if (!sim.finished) window.setTimeout(chunk, 0);
      else setSkipping(false);
    };
    chunk();
  };

  const toResults = () => {
    if (!sim) return;
    api.act((cc) => {
      recordRaceProgress(cc, sim.commands, sim.tick);
      finishRace(cc, sim.results(), sim.fastest);
    });
  };

  const followCar = (id: string | null) => {
    const r = rendRef.current;
    if (!r) return;
    audioRef.current?.start();
    if (id) r.setMode('suivre', id);
    else r.setMode('circuit');
    setCamMode(r.mode);
    setFollow(r.follow);
  };

  const setCamera = (m: CameraMode) => {
    const r = rendRef.current;
    if (!r) return;
    audioRef.current?.start();
    r.setMode(m);
    setCamMode(m);
    setFollow(r.follow);
  };

  const toggleSound = () => {
    const on = !sound;
    setSound(on);
    audioRef.current?.setEnabled(on);
    api.setSettings({ ...api.settings, sound: on });
  };

  // Toucher : appui = choisir une voiture ; pincement / molette = zoom.
  const onDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    pinch.current.moved = false;
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current.d = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current.d > 0 && Math.abs(d - pinch.current.d) > 4) {
        rendRef.current?.zoomBy(d / pinch.current.d);
        pinch.current.d = d;
        pinch.current.moved = true;
      }
    }
  };
  const onUp = (e: React.PointerEvent) => {
    const wasPinch = pointers.current.size > 1 || pinch.current.moved;
    pointers.current.delete(e.pointerId);
    if (wasPinch) return;
    const r = rendRef.current;
    if (!r) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const id = r.pick(e.clientX - rect.left, e.clientY - rect.top);
    if (id) followCar(id);
  };

  const players = hud?.rows.filter((r) => r.player) ?? [];
  const visibleRows = hud ? (fullList ? hud.rows : hud.rows.filter((r) => r.pos <= 5 || r.player || r.id === follow)) : [];
  const w = c.weekend!;
  const winner = hud?.rows[0];

  return (
    <div className="race">
      <div className="race-canvas" ref={host} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onWheel={(e) => rendRef.current?.zoomBy(e.deltaY < 0 ? 1.12 : 1 / 1.12)} />
      {error && <div className="panel error-box">{error}<button className="btn" onClick={() => api.go('hub')}>Retour au QG</button></div>}

      <div className="race-top">
        <button className="btn small ghost" onClick={() => { persist(); api.go('hub'); }}>← QG</button>
        <div className="lapbox"><small>Tour</small><b>{hud ? Math.min(hud.lap, sim?.cfg.laps ?? 0) : 1}/{sim?.cfg.laps}</b></div>
        <Weather w={w.weather} />
        {hud?.flag && <span className="flag">🏁</span>}
        <button className="btn small icon-btn" onClick={toggleSound} aria-label={sound ? 'Couper le son' : 'Activer le son'}>{sound ? '🔊' : '🔇'}</button>
        {api.settings.showFps && <span className="fps">{fps} i/s</span>}
      </div>

      <aside className={'race-standings' + (fullList ? ' full' : '')}>
        <header>
          <button className="linkish" onClick={() => setGapMode(gapMode === 'gap' ? 'int' : 'gap')}>{gapMode === 'gap' ? 'Écart leader' : 'Intervalle'}</button>
          <button className="linkish" onClick={() => setFullList(!fullList)}>{fullList ? 'Réduire' : 'Tous'}</button>
        </header>
        <ol>
          {visibleRows.map((r) => (
            <li key={r.id} className={(r.player ? 'me ' : '') + (r.id === follow ? 'followed ' : '') + (r.status === 'dnf' || r.status === 'retiring' ? 'out' : '')} onClick={() => followCar(r.id)}>
              <span className="p">{r.pos}</span>
              <i style={{ background: r.color }} />
              <span className="n">{r.short}</span>
              <span className="g">{gapText(r, gapMode)}</span>
              <TyreChip c={r.compound} />
              {r.pit > 0 ? <span className="tag pit">STAND</span> : r.status === 'done' ? <span className="tag">🏁</span> : null}
            </li>
          ))}
        </ol>
      </aside>

      <div className="race-feed">
        {hud?.events.slice(0, 3).map((e, i) => <div key={e.t + e.text} className={'ev ' + e.kind} style={{ opacity: 1 - i * 0.25 }}>T{e.lap} · {e.text}</div>)}
      </div>

      <div className="race-bottom">
        <div className="sim-controls">
          {([0, 1, 2, 4] as Speed[]).map((s) => (
            <button key={s} className={'btn small' + (speed === s ? ' on' : '')} onClick={() => setSpeed(s)} disabled={hud?.finished}>
              {s === 0 ? '❚❚' : '×' + s}
            </button>
          ))}
          <span className="sep" />
          <div className="seg cams">
            <button className={camMode === 'suivre' ? 'on' : ''} onClick={() => setCamera('suivre')}>Suivre</button>
            <button className={camMode === 'tv' ? 'on' : ''} onClick={() => setCamera('tv')}>TV</button>
            <button className={camMode === 'circuit' ? 'on' : ''} onClick={() => setCamera('circuit')}>Circuit</button>
          </div>
          <button className="btn small zoombtn" onClick={() => rendRef.current?.zoomBy(1 / 1.25)} disabled={camMode === 'circuit'} aria-label="Dézoomer">−</button>
          <button className="btn small zoombtn" onClick={() => rendRef.current?.zoomBy(1.25)} disabled={camMode === 'circuit'} aria-label="Zoomer">+</button>
          <span className="sep" />
          <button className="btn small ghost" onClick={skipToEnd} disabled={skipping || hud?.finished}>{skipping ? 'Simulation…' : <><span className="lbl">Fin directe </span>⏭</>}</button>
        </div>
        <div className="driver-controls">
          {players.map((p) => (
            <div key={p.id} className={'dc' + (p.id === follow ? ' followed' : '')}>
              <header onClick={() => followCar(p.id)}>
                <b>P{p.pos}</b> <span className="fullname">{p.name}</span><span className="shortname">{p.short}</span>
                <small>{p.status === 'dnf' || p.status === 'retiring' ? `Abandon — ${p.reason}` : `Dernier ${fmtLap(p.lastLap)} · Meilleur ${fmtLap(p.bestLap)}`}</small>
              </header>
              <div className="wear">
                <TyreChip c={p.compound} />
                <div className="bar"><i style={{ width: Math.min(100, p.wear) + '%', background: p.wear > 75 ? '#d62828' : p.wear > 55 ? '#f2a33a' : '#2aa876' }} /></div>
                <small>{Math.round(p.wear)} %</small>
              </div>
              {p.status === 'run' && (
                <div className="row wrap">
                  <div className="seg">
                    {(['eco', 'normal', 'attaque'] as DriveMode[]).map((m) => (
                      <button key={m} className={p.mode === m ? 'on' : ''} onClick={() => issue(p.id, { type: 'mode', mode: m })}>
                        {m === 'eco' ? 'Éco' : m === 'normal' ? 'Normal' : 'Attaque'}
                      </button>
                    ))}
                  </div>
                  {p.pit > 0 ? <span className="tag pit">Aux stands</span> : p.pitReq ? (
                    <button className="btn small danger" onClick={() => issue(p.id, { type: 'cancelPit' })}>Annuler l’arrêt ({p.pitReq})</button>
                  ) : (
                    <div className="seg pitsel">
                      <span>Stand :</span>
                      {(w.weather === 'pluie' ? ['P', 'M'] : ['T', 'M', 'D', 'P']).map((k) => (
                        <button key={k} onClick={() => issue(p.id, { type: 'pit', compound: k as Compound })}><TyreChip c={k as Compound} /></button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {hud?.finished && winner && (
        <div className="finish-overlay">
          <div className="panel">
            <h2>🏁 Drapeau à damier</h2>
            <ol className="podium">
              {hud.rows.slice(0, 3).map((r) => <li key={r.id} className={r.player ? 'me' : ''}><i style={{ background: r.color }} />{r.name} <small>{teamById(c, sim!.car(r.id)!.e.teamId).name}</small></li>)}
            </ol>
            {players.map((p) => <p key={p.id}>{p.name} : {p.status === 'done' ? `${p.pos}ᵉ` : 'abandon'}</p>)}
            <button className="btn primary big" onClick={toResults}>Voir les résultats →</button>
          </div>
        </div>
      )}
    </div>
  );
}
