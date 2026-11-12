import { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../App';
import { MatchEngine, TICK } from '../../sim/engine';
import { MatchRenderer } from '../../render/renderer';
import { emptyInput, type UserInput } from '../../sim/types';
import { FIBA, withQuarterLength } from '../../sim/rules';
import { quickTeam } from '../../sim/testTeams';
import { NameRegistry } from '../../data/generate';
import { user, userFixture } from '../../career/career';
import { createMatch, finishMatch, finishWatched } from '../../career/matchBridge';
import { simulateAsync } from '../simulate';
import { crowdLevel, crowdSfx, sfx, startAmbience, stopAmbience } from '../audio';
import { keyLabel } from '../settings';
import { fullName } from '../../data/model';
import { Modal } from '../components/Modal';

interface Hud {
  s0: number;
  s1: number;
  q: number;
  clock: number;
  shot: number;
  shotOn: boolean;
  f0: number;
  f1: number;
  to0: number;
  to1: number;
  feed: string;
  feed2: string;
  poss: number;
  bonus0: boolean;
  bonus1: boolean;
  run: string;
  top0: string;
  top1: string;
  ticker: { sep?: boolean; name: string; color?: string; pts?: number; reb?: number; ast?: number; min?: number; pf?: number; on?: boolean; me?: boolean }[];
  onCourt: boolean;
  hasBall: boolean;
  offense: boolean;
  energy: number;
  pts: number;
  reb: number;
  ast: number;
  fouls: number;
  fg: string;
  phase: string;
  finished: boolean;
  intent: string;
  auto: boolean;
}

function fmtClock(s: number): string {
  if (s < 60) return s.toFixed(1);
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${String(ss).padStart(2, '0')}`;
}

export function MatchScreen({ quick, watch }: { quick: boolean; watch?: string }) {
  const app = useApp();
  const c = app.career;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const input = useRef<UserInput>(emptyInput());
  const prevBall = useRef<{ x: number; y: number; z: number } | null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const tickerHold = useRef(0);
  // Défilement automatique lent du bandeau ; il s'arrête quelques secondes quand on le fait défiler soi-même
  useEffect(() => {
    const id = window.setInterval(() => {
      const el = tickerRef.current;
      if (!el || Date.now() - tickerHold.current < 6000) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) el.scrollLeft = 0;
      else el.scrollLeft += 1;
    }, 40);
    return () => window.clearInterval(id);
  }, []);
  const [banner, setBanner] = useState<{ text: string; color: string; id: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [speed, setSpeed] = useState(c?.settings.speed ?? 1);
  const speedRef = useRef(speed);
  const [hud, setHud] = useState<Hud | null>(null);
  const [simMsg, setSimMsg] = useState<string | null>(null);
  const simRef = useRef(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [camera, setCamera] = useState(app.settings.camera);
  const [view, setView] = useState<'3d' | '2d'>(app.settings.view ?? '3d');
  const [tactics, setTactics] = useState(app.settings.showTactics ?? true);
  const viewRef = useRef(view);
  const tacticsRef = useRef(tactics);
  viewRef.current = view;
  tacticsRef.current = tactics;
  const doneRef = useRef(false);
  const timingRef = useRef<HTMLDivElement>(null);
  const fixture = useMemo(() => (c && !quick ? (watch ? c.world.fixtures.find((f) => f.id === watch && !f.played) ?? null : userFixture(c)) : null), [c, quick, watch]);
  const repBefore = useMemo(() => (c ? user(c).reputation : 0), [c]);

  const engine = useMemo(() => {
    const control = app.settings.controlMode === 'play';
    if (!quick && c && fixture) return createMatch(c, fixture, control && !watch, !!watch);
    const reg = new NameRegistry();
    const home = quickTeam(Date.now() & 0xffff, 'Riverside', 12, ['#3988F5', '#F6F4EF'], reg);
    const away = quickTeam((Date.now() >> 3) & 0xffff, 'Northport', 12, ['#F36B32', '#101827'], reg);
    home.name = 'Riverside Lights';
    home.short = 'RIV';
    away.name = 'Northport Comets';
    away.short = 'NPC';
    return new MatchEngine({ home, away, rules: app.settings.defaultQuarter > 0 ? withQuarterLength(FIBA, app.settings.defaultQuarter) : FIBA, seed: Date.now() & 0x7fffffff, userPlayerId: home.players[1].id, userAssist: true, userControl: control });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);
  useEffect(() => {
    speedRef.current = speed;
    if (c) c.settings.speed = speed;
  }, [speed, c]);

  // ---------------------------------------------------------------- Boucle de jeu
  useEffect(() => {
    const canvas = canvasRef.current!;
    const r = new MatchRenderer(canvas, engine);
    r.opts = { camera, quality: app.settings.quality, showOpen: app.settings.showOpen, colorblind: app.settings.colorblind, showNames: app.settings.showNames };
    const resize = () => {
      const w = wrapRef.current;
      if (w) r.resize(w.clientWidth, w.clientHeight);
    };
    resize();
    window.addEventListener('resize', resize);
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current!);
    (window as unknown as { __brs?: unknown }).__brs = { engine, renderer: r };
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    let evCount = engine.events.length;
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      r.opts.camera = cameraRef.current;
      r.opts.view = viewRef.current;
      r.opts.showTactics = tacticsRef.current;
      if (!pausedRef.current && !simRef.current && !engine.finished) {
        let sp = speedRef.current;
        if (app.settings.slowmo && engine.slowmo > 0 && sp === 1) sp *= 0.45;
        acc += dt * sp;
        let n = 0;
        while (acc >= TICK && n < 30) {
          // État précédent mémorisé pour interpoler l'image entre deux pas de simulation
          for (const pl of engine.players) {
            const ip = pl as typeof pl & { prevX?: number; prevY?: number };
            ip.prevX = pl.pos.x;
            ip.prevY = pl.pos.y;
          }
          prevBall.current = { x: engine.ball.x, y: engine.ball.y, z: engine.ball.z };
          engine.step({ ...input.current, callBall: input.current.pass });
          acc -= TICK;
          n++;
        }
        if (n >= 30) acc = 0;
      }
      // Sons physiques (ballon) produits par la simulation
      if (engine.sounds.length) {
        const seen = new Set<string>();
        for (const snd of engine.sounds) {
          if (seen.has(snd)) continue;
          seen.add(snd);
          if (snd === 'rim') sfx.rim();
          else if (snd === 'board') sfx.board();
          else if (snd === 'bounce') sfx.bounce();
          else if (snd === 'dribble' && speedRef.current === 1) sfx.dribble();
        }
        engine.sounds.length = 0;
      }
      crowdLevel(engine.time - engine.lastScoreT < 2.5 ? 1 : engine.clutch());
      // Sons liés aux événements simulés
      for (; evCount < engine.events.length; evCount++) {
        const ev = engine.events[evCount];
        const big = ev.type === 'made' && (ev.points === 3 || ev.detail === 'dunk') ? (ev.points === 3 ? 'À 3 POINTS !' : 'DUNK !') : ev.type === 'block' ? 'CONTRE !' : ev.type === 'steal' ? 'INTERCEPTION' : ev.type === 'timeout' ? 'TEMPS MORT' : ev.type === 'quarter' ? ev.text.toUpperCase() : ev.type === 'info' && ev.text.startsWith('Ajustement') ? 'AJUSTEMENT TACTIQUE' : '';
        if (big) {
          const col = ev.team >= 0 ? engine.teams[ev.team as 0 | 1].colors[0] : '#F36B32';
          setBanner({ text: big, color: col, id: evCount });
          window.setTimeout(() => setBanner((b) => (b && b.id === evCount ? null : b)), 1700);
        }
        if (ev.type === 'made') {
          sfx.swish();
          if (ev.points === 3 || ev.detail === 'dunk') sfx.crowd();
          if (ev.player === engine.userIdx && app.settings.vibration) navigator.vibrate?.(40);
        } else if (ev.type === 'foul' || ev.type === 'violation' || ev.type === 'timeout') sfx.whistle();
        else if (ev.type === 'quarter' || ev.type === 'final') sfx.buzzer();
        else if (ev.type === 'block') sfx.rim();
      }
      // Interpolation : positions affichées entre l'état précédent et l'état courant (fluidité à toute fréquence d'écran)
      const alpha = pausedRef.current || simRef.current ? 1 : Math.min(1, acc / TICK);
      const saved = engine.players.map((pl) => ({ x: pl.pos.x, y: pl.pos.y }));
      const sb = { x: engine.ball.x, y: engine.ball.y, z: engine.ball.z };
      if (alpha < 1) {
        for (const pl of engine.players) {
          const ip = pl as typeof pl & { prevX?: number; prevY?: number };
          if (ip.prevX === undefined || Math.hypot(pl.pos.x - ip.prevX, pl.pos.y - (ip.prevY ?? 0)) > 1.5) continue;
          pl.pos.x = ip.prevX + (pl.pos.x - ip.prevX) * alpha;
          pl.pos.y = (ip.prevY ?? pl.pos.y) + (pl.pos.y - (ip.prevY ?? pl.pos.y)) * alpha;
        }
        const pb = prevBall.current;
        if (pb && Math.hypot(sb.x - pb.x, sb.y - pb.y) < 1.5) {
          engine.ball.x = pb.x + (sb.x - pb.x) * alpha;
          engine.ball.y = pb.y + (sb.y - pb.y) * alpha;
          engine.ball.z = pb.z + (sb.z - pb.z) * alpha;
        }
      }
      const t0r = performance.now();
      r.render(pausedRef.current ? 0 : dt);
      if (!pausedRef.current) r.adapt(dt * 1000 > 40 ? 16 : Math.max(dt * 1000, performance.now() - t0r));
      engine.players.forEach((pl, i) => {
        pl.pos.x = saved[i].x;
        pl.pos.y = saved[i].y;
      });
      engine.ball.x = sb.x;
      engine.ball.y = sb.y;
      engine.ball.z = sb.z;
      if (r.crowdEvents.length) {
        if (!simRef.current && speedRef.current <= 4) crowdSfx[r.crowdEvents[r.crowdEvents.length - 1]]?.();
        r.crowdEvents.length = 0;
      }
      // Jauge de timing du tir
      const u = engine.userIdx >= 0 ? engine.players[engine.userIdx] : null;
      const tm = timingRef.current;
      if (tm && u) {
        const plan = (u as unknown as { shotPlan?: { gather: number; userTimed: boolean } }).shotPlan;
        if (plan && plan.userTimed && engine.ball.holder === u.idx && u.anim === 'shoot') {
          tm.style.display = 'block';
          tm.style.left = `${r.px(u.pos.x) + 0.6 * r.s}px`;
          tm.style.top = `${r.py(u.pos.y, u.heightM + 0.4) - 40}px`;
          const fill = Math.min(1, u.animT / (plan.gather * 1.6));
          (tm.firstChild as HTMLElement).style.height = `${fill * 100}%`;
        } else tm.style.display = 'none';
      }
      if (engine.finished && !doneRef.current) {
        doneRef.current = true;
        window.setTimeout(onFinish, 1400);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    startAmbience();
    const hudT = window.setInterval(() => {
      const u = engine.userIdx >= 0 ? engine.players[engine.userIdx] : null;
      const lastEv = [...engine.events].reverse().find((e) => e.type !== 'pass' && e.text);
      setHud({
        s0: engine.teams[0].score,
        s1: engine.teams[1].score,
        q: engine.quarter,
        clock: engine.clock,
        shot: engine.shotClock,
        shotOn: engine.shotClockOn || engine.phase === 'live',
        f0: engine.teams[0].quarterFouls,
        f1: engine.teams[1].quarterFouls,
        to0: engine.teams[0].timeouts,
        to1: engine.teams[1].timeouts,
        feed: lastEv ? lastEv.text : '',
        feed2: [...engine.events].reverse().filter((e) => e.type !== 'pass' && e.text && e !== lastEv).slice(0, 1).map((e) => e.text)[0] ?? '',
        poss: engine.possession,
        top0: topScorers(engine, 0),
        top1: topScorers(engine, 1),
        ticker: tickerRows(engine),
        bonus0: engine.teams[1].quarterFouls >= engine.rules.bonusAtFoul,
        bonus1: engine.teams[0].quarterFouls >= engine.rules.bonusAtFoul,
        run: engine.teams[0].run >= 6 ? `${engine.teams[0].short} ${engine.teams[0].run}-0` : engine.teams[1].run >= 6 ? `${engine.teams[1].short} ${engine.teams[1].run}-0` : '',
        onCourt: !!u?.onCourt,
        hasBall: !!u && engine.ball.state === 'held' && engine.ball.holder === u.idx,
        offense: !!u && engine.possession === u.team,
        energy: u ? u.energy : 0,
        pts: u?.box.pts ?? 0,
        reb: u ? u.box.orb + u.box.drb : 0,
        ast: u?.box.ast ?? 0,
        fouls: u?.fouls ?? 0,
        fg: u ? `${u.box.fgm}/${u.box.fga}` : '',
        phase: engine.phase,
        finished: engine.finished,
        intent: u?.intent ?? '',
        auto: engine.userAutoActive(),
      });
    }, 120);
    return () => {
      cancelAnimationFrame(raf);
      stopAmbience();
      window.clearInterval(hudT);
      window.removeEventListener('resize', resize);
      ro.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // ---------------------------------------------------------------- Clavier
  useEffect(() => {
    const k = app.settings.keys;
    const held = new Set<string>();
    const sync = () => {
      const i = input.current;
      const left = held.has(k.left) || held.has('ArrowLeft');
      const right = held.has(k.right) || held.has('ArrowRight');
      const up = held.has(k.up) || held.has('ArrowUp');
      const down = held.has(k.down) || held.has('ArrowDown');
      if (!joyActive.current) {
        let mx = (right ? 1 : 0) - (left ? 1 : 0);
        let my = (down ? 1 : 0) - (up ? 1 : 0);
        const l = Math.hypot(mx, my);
        if (l > 0) {
          mx /= l;
          my /= l;
        }
        i.mx = mx;
        i.my = my;
      }
      i.sprint = held.has(k.sprint) || held.has('ShiftRight') || touchSprint.current;
      i.shoot = held.has(k.shoot) || touchBtn.current.shoot;
      i.pass = held.has(k.pass) || touchBtn.current.pass;
      i.lob = held.has(k.lob) || touchBtn.current.lob;
      i.action = held.has(k.action) || touchBtn.current.action;
    };
    syncRef.current = sync;
    const down = (e: KeyboardEvent) => {
      if (e.code === k.pause || e.code === 'KeyP') {
        setPaused((p) => !p);
        e.preventDefault();
        return;
      }
      if (e.code === 'Tab') {
        setStatsOpen((s) => !s);
        e.preventDefault();
        return;
      }
      held.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      sync();
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      sync();
    };
    const blur = () => {
      held.clear();
      sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [app.settings.keys]);

  // ---------------------------------------------------------------- Tactile
  const joyActive = useRef(false);
  const joyRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLElement>(null);
  const touchBtn = useRef({ shoot: false, pass: false, lob: false, action: false });
  const touchSprint = useRef(false);
  const syncRef = useRef<() => void>(() => undefined);
  const joyMove = (ev: React.PointerEvent) => {
    const el = joyRef.current!;
    const rc = el.getBoundingClientRect();
    const cx = rc.left + rc.width / 2;
    const cy = rc.top + rc.height / 2;
    let dx = ev.clientX - cx;
    let dy = ev.clientY - cy;
    const R = rc.width / 2 - 10;
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx = (dx / l) * R;
      dy = (dy / l) * R;
    }
    knobRef.current!.style.transform = `translate(${dx}px, ${dy}px)`;
    input.current.mx = dx / R;
    input.current.my = dy / R;
    touchSprint.current = l > R * 1.05;
    syncRef.current();
  };
  const joyEnd = () => {
    joyActive.current = false;
    knobRef.current!.style.transform = '';
    input.current.mx = 0;
    input.current.my = 0;
    touchSprint.current = false;
    syncRef.current();
  };
  const btn = (key: 'shoot' | 'pass' | 'lob' | 'action', on: boolean) => {
    touchBtn.current[key] = on;
    syncRef.current();
  };

  // ---------------------------------------------------------------- Fin / simulation
  const onFinish = () => {
    if (!quick && c && fixture && watch) {
      finishWatched(c, fixture, engine);
      app.setLastMatch({ engine, line: null, fixtureId: fixture.id, quick: true, watch: true, reputationBefore: 0 });
      void app.persist(c);
    } else if (!quick && c && fixture) {
      const line = finishMatch(c, fixture, engine, true);
      app.setLastMatch({ engine, line, fixtureId: fixture.id, quick: false, reputationBefore: repBefore });
      void app.persist(c);
    } else app.setLastMatch({ engine, line: null, fixtureId: null, quick: true, reputationBefore: 0 });
    app.go({ name: 'postmatch' });
  };

  const fastForward = async (untilEntry: boolean | 'quarter') => {
    const q0 = engine.quarter;
    simRef.current = true;
    setPaused(false);
    setSimMsg('Simulation en cours…');
    await simulateAsync(
      engine,
      (e) => (untilEntry === 'quarter' ? e.quarter > q0 && e.phase !== 'quarterEnd' : untilEntry ? e.userIdx >= 0 && e.players[e.userIdx].onCourt && e.phase === 'live' : false),
      (e) => setSimMsg(`Simulation… ${e.quarter <= 4 ? `QT${e.quarter}` : 'Prol.'} ${fmtClock(e.clock)} — ${e.teams[0].score}-${e.teams[1].score}`),
    );
    simRef.current = false;
    setSimMsg(null);
  };

  const h = hud;
  const t0 = engine.teams[0];
  const t1 = engine.teams[1];
  const u = engine.userIdx >= 0 ? engine.players[engine.userIdx] : null;
  const keys = app.settings.keys;
  const labels = !h || !h.onCourt ? null : h.hasBall ? { shoot: 'TIRER', pass: 'PASSE', lob: 'LOB', action: 'DRIBBLE\nÉCRAN' } : h.offense ? { shoot: 'COUPER', pass: 'DEMANDER', lob: '', action: 'ÉCRAN' } : { shoot: 'CONTRE', pass: 'INTER-\nCEPTER', lob: '', action: 'AIDE' };

  return (
    <div className="match" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="Terrain de basket : simulation du match en direct" />
      {h && (
        <>
          <div className="mtop">
            <div className="mtop-btns">
              <button className="icon-btn" aria-label="Pause" onClick={() => setPaused(true)}>
                ❚❚
              </button>
              <button className="icon-btn" aria-label="Vitesse" onClick={() => setSpeed((s) => (s >= 16 ? 1 : s * 2))}>
                ×{speed}
              </button>
              <button className="icon-btn" aria-label="Aller à la fin du quart-temps" title="Fin du quart-temps" onClick={() => fastForward('quarter')}>
                ⏭
              </button>
            </div>
            <div className="scorebug" aria-live="off">
              <div className="tm">
                <div className="tm-line">
                  <i style={{ background: t0.colors[0], outline: '1px solid rgba(255,255,255,.5)' }} />
                  <span>{t0.short}</span>
                  {h.bonus0 && <span className="bonus">BONUS</span>}
                  {h.poss === 0 && <span className="possdot" aria-label="Possession" />}
                  <span className="sc">{h.s0}</span>
                </div>
                <div className="tops">{h.top0}</div>
              </div>
              <div className="clk">
                <span>{h.q <= 4 ? `QT${h.q}` : `PR${h.q - 4}`}</span>
                <b>{fmtClock(h.clock)}</b>
                <span className={`sc24 ${h.shot < 5 ? 'low' : ''}`}>{h.shotOn ? Math.ceil(Math.max(0, h.shot)) : '—'}</span>
              </div>
              <div className="tm">
                <div className="tm-line">
                  <span className="sc">{h.s1}</span>
                  {h.poss === 1 && <span className="possdot" aria-label="Possession" />}
                  {h.bonus1 && <span className="bonus">BONUS</span>}
                  <span>{t1.short}</span>
                  <i style={{ background: t1.colors[0] }} />
                </div>
                <div className="tops" style={{ textAlign: 'right' }}>{h.top1}</div>
              </div>
            </div>
            <div className="mtop-btns">
              <button className="icon-btn" aria-label="Caméra" title="Caméra" onClick={() => setCamera((v) => (v === 'player' ? 'follow' : v === 'follow' ? 'full' : 'player'))}>
                {camera === 'full' ? '⤢' : camera === 'follow' ? '⤡' : '◎'}
              </button>
              <button className="icon-btn" aria-label="Vue 2D ou 2,5D" title="Vue 2D tactique / vue 2,5D" onClick={() => setView((v) => (v === '3d' ? '2d' : '3d'))} style={{ fontSize: '0.75rem', fontWeight: 800 }}>
                {view === '3d' ? '2D' : '3D'}
              </button>
              <button className="icon-btn" aria-label="Afficher les flèches de jeu" title="Flèches de course et de passe" aria-pressed={tactics} onClick={() => setTactics((t) => !t)} style={{ opacity: tactics ? 1 : 0.5 }}>
                ✎
              </button>
              <button className="icon-btn" aria-label="Statistiques" onClick={() => setStatsOpen(true)}>
                ≡
              </button>
            </div>
            <div className="ticker" ref={tickerRef} onPointerDown={() => (tickerHold.current = Date.now())} onWheel={() => (tickerHold.current = Date.now())} aria-label="Statistiques individuelles (faire défiler)">
              {h.ticker.map((row, i) =>
                row.sep ? (
                  <span key={i} className="tk-sep" style={{ borderColor: row.color }}>
                    {row.name}
                  </span>
                ) : (
                  <span key={i} className={`tk ${row.on ? 'on' : ''} ${row.me ? 'me' : ''}`}>
                    <b>{row.name}</b> {row.pts} pts · {row.reb} rb · {row.ast} pd · {row.min}' {(row.pf ?? 0) >= 3 ? `· ${row.pf} f` : ''}
                  </span>
                ),
              )}
            </div>
            {h.feed && (
            <div className="feed">
              <div>{h.feed}</div>
              {h.feed2 && <div className="feed-old">{h.feed2}</div>}
            </div>
          )}
          </div>
          {h.run && <div className="runbadge">Série {h.run}</div>}
          {banner && (
            <div className="banner" key={banner.id} style={{ borderColor: banner.color }}>
              {banner.text}
            </div>
          )}
          {u && h.onCourt && (
            <div className="hud-me">
              <div className="row spread">
                <b>
                  #{u.data.number} {u.data.lastName}
                </b>
                <span className="muted">{h.auto ? 'IA' : 'Vous'}</span>
              </div>
              <div className="muted">
                {h.pts} pts · {h.reb} rbd · {h.ast} pd · {h.fg} · {h.fouls} f.
              </div>
              <div className="bar green" style={{ marginTop: 4 }}>
                <i style={{ width: `${h.energy * 100}%` }} />
              </div>
              <div className="tiny muted">
                Énergie · fautes équipe {h.f0}-{h.f1} · TM {h.to0}-{h.to1}
              </div>
            </div>
          )}
          <div className="rotate-hint">↻ Tournez l'appareil pour une vue plus large</div>
        </>
      )}
      <div className="timing" ref={timingRef} style={{ display: 'none' }}>
        <i />
        <b style={{ bottom: `${(1 / 1.6) * 100}%` }} />
      </div>
      {h && !h.finished && !simMsg && !engine.userControl && engine.userIdx >= 0 && <StyleBar engine={engine} onChange={(st) => c && (c.style = st)} />}
      {h && h.onCourt && !h.finished && labels && engine.userControl && (
        <div className="controls touch-only">
          <div className="joy" ref={joyRef} onPointerDown={(e) => ((joyActive.current = true), (e.target as HTMLElement).setPointerCapture(e.pointerId), joyMove(e))} onPointerMove={(e) => joyActive.current && joyMove(e)} onPointerUp={joyEnd} onPointerCancel={joyEnd} aria-label="Joystick de déplacement">
            <i ref={knobRef} />
          </div>
          <div className="actions">
            {labels.lob ? (
              <ActBtn label={labels.lob} k={keyLabel(keys.lob)} on={(v) => btn('lob', v)} />
            ) : (
              <ActBtn label="SPRINT" k={keyLabel(keys.sprint)} on={(v) => ((touchSprint.current = v), syncRef.current())} />
            )}
            <ActBtn label={labels.action} k={keyLabel(keys.action)} on={(v) => btn('action', v)} />
            <ActBtn label={labels.pass} k={keyLabel(keys.pass)} on={(v) => btn('pass', v)} />
            <ActBtn label={labels.shoot} k={keyLabel(keys.shoot)} main on={(v) => btn('shoot', v)} />
          </div>
        </div>
      )}
      {h && !h.onCourt && !h.finished && !simMsg && engine.userIdx >= 0 && (
        <div className="bench-banner fade-in">
          <b>Vous êtes sur le banc</b>
          <span className="small muted">Le coach décide des rotations selon la fatigue, les fautes et votre niveau de confiance.</span>
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <button className="btn primary small" onClick={() => fastForward(true)}>
              Accélérer jusqu'à mon entrée
            </button>
            <button className="btn small" onClick={() => setSpeed(3)}>
              Regarder (×3)
            </button>
            <button className="btn small" onClick={() => fastForward(false)}>
              Simuler la fin
            </button>
          </div>
        </div>
      )}
      {simMsg && <div className="bench-banner">{simMsg}</div>}
      {paused && (
        <Modal
          title="Pause"
          onClose={() => setPaused(false)}
          actions={
            <>
              <button
                className="btn"
                onClick={() => {
                  setPaused(false);
                  void fastForward(false);
                }}
              >
                Simuler la fin du match
              </button>
              {watch && (
                <button className="btn danger" onClick={() => app.go({ name: 'hub', tab: 'calendar' })}>
                  Quitter (le match sera simulé)
                </button>
              )}
              {quick && (
                <button className="btn danger" onClick={() => app.go({ name: 'home' })}>
                  Quitter
                </button>
              )}
              <button className="btn primary" onClick={() => setPaused(false)}>
                Reprendre
              </button>
            </>
          }
        >
          <div className="grid" style={{ gap: 12 }}>
            <div className="field">
              <label>Vitesse de jeu</label>
              <div className="seg">
                {[1, 2, 4, 8, 16].map((s) => (
                  <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                    ×{s}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Caméra</label>
              <div className="seg">
                <button aria-pressed={camera === 'full'} onClick={() => setCamera('full')}>
                  Terrain entier
                </button>
                <button aria-pressed={camera === 'player'} onClick={() => setCamera('player')}>
                  Centrée sur mon joueur
                </button>
                <button aria-pressed={camera === 'follow'} onClick={() => setCamera('follow')}>
                  Rapprochée (suit le ballon)
                </button>
              </div>
            </div>
            <div className="field">
              <label>Mode de jeu</label>
              <div className="seg">
                <button aria-pressed={!engine.userControl} onClick={() => ((engine.userControl = false), app.setSettings({ ...app.settings, controlMode: 'watch' }))}>
                  Regarder (l'IA joue selon vos consignes)
                </button>
                <button aria-pressed={engine.userControl} onClick={() => ((engine.userControl = true), app.setSettings({ ...app.settings, controlMode: 'play' }))}>
                  Contrôler mon joueur
                </button>
              </div>
            </div>
            <div className="field">
              <label>Volume : {Math.round(app.settings.volume * 100)} %</label>
              <input type="range" min={0} max={1} step={0.05} value={app.settings.volume} onChange={(e) => app.setSettings({ ...app.settings, volume: Number(e.target.value) })} />
            </div>
            <div className="field">
              <label>Ralenti sur les actions majeures</label>
              <div className="seg">
                <button aria-pressed={app.settings.slowmo} onClick={() => app.setSettings({ ...app.settings, slowmo: true })}>
                  Oui
                </button>
                <button aria-pressed={!app.settings.slowmo} onClick={() => app.setSettings({ ...app.settings, slowmo: false })}>
                  Non
                </button>
              </div>
            </div>
            <p className="small muted">
              Commandes : déplacement {keyLabel(keys.up)}/{keyLabel(keys.left)}/{keyLabel(keys.down)}/{keyLabel(keys.right)} ou flèches, sprint {keyLabel(keys.sprint)}, tir/contre {keyLabel(keys.shoot)} (maintenir puis relâcher au sommet du saut), passe/interception {keyLabel(keys.pass)}, lob {keyLabel(keys.lob)}, écran {keyLabel(keys.action)}, statistiques Tab, pause {keyLabel(keys.pause)}.
            </p>
          </div>
        </Modal>
      )}
      {statsOpen && (
        <Modal title="Statistiques en direct" onClose={() => setStatsOpen(false)}>
          {[0, 1].map((t) => (
            <div key={t} style={{ marginBottom: 12 }}>
              <h3 style={{ marginBottom: 6 }}>
                {engine.teams[t].name} — {engine.teams[t].score}
              </h3>
              <div className="table-wrap">
                <table className="t">
                  <thead>
                    <tr>
                      <th>Joueur</th>
                      <th className="r">Pts</th>
                      <th className="r">Tirs</th>
                      <th className="r">Rbd</th>
                      <th className="r">Pd</th>
                      <th className="r">F</th>
                      <th className="r">Énergie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {engine.teams[t].players.map((i) => {
                      const p = engine.players[i];
                      return (
                        <tr key={i} className={p.isUser ? 'me' : ''}>
                          <td>
                            {p.onCourt ? '● ' : ''}
                            {fullName(p.data)}
                          </td>
                          <td className="r">{p.box.pts}</td>
                          <td className="r">
                            {p.box.fgm}/{p.box.fga}
                          </td>
                          <td className="r">{p.box.orb + p.box.drb}</td>
                          <td className="r">{p.box.ast}</td>
                          <td className="r">{p.fouls}</td>
                          <td className="r">{Math.round(p.energy * 100)}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

function ActBtn({ label, k, main, on }: { label: string; k: string; main?: boolean; on: (v: boolean) => void }) {
  const [pressed, setPressed] = useState(false);
  const set = (v: boolean) => {
    setPressed(v);
    on(v);
  };
  return (
    <button
      className={`act ${main ? 'main' : ''} ${pressed ? 'on' : ''}`}
      onPointerDown={(e) => {
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        set(true);
      }}
      onPointerUp={() => set(false)}
      onPointerCancel={() => set(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span style={{ whiteSpace: 'pre-line' }}>{label}</span>
      <kbd>{k}</kbd>
    </button>
  );
}

const STYLE_OPTS = {
  shooting: { label: 'Tirs', opts: [[-0.8, 'Collectif'], [0, 'Équilibré'], [0.8, 'Prend ses responsabilités']] },
  defense: { label: 'Défense', opts: [[0.15, 'Prudente'], [0.5, 'Normale'], [0.95, 'Agressive']] },
  hustle: { label: 'Effort', opts: [[0.15, 'Gérer'], [0.5, 'Normal'], [0.95, 'À fond']] },
} as const;
const ROLES = [
  ['auto', 'Selon le coach'],
  ['shooter', 'Shooteur (coins, ailes)'],
  ['slasher', 'Attaquer le cercle'],
  ['post', 'Jouer au poste'],
  ['playmaker', 'Organiser le jeu'],
] as const;

/** Consignes données à votre joueur pendant le match (mode spectateur). */
function StyleBar({ engine, onChange }: { engine: MatchEngine; onChange: (s: MatchEngine['userStyle']) => void }) {
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);
  const st = engine.userStyle;
  const set = (patch: Partial<MatchEngine['userStyle']>) => {
    engine.userStyle = { ...engine.userStyle, ...patch };
    onChange(engine.userStyle);
    force((x) => x + 1);
  };
  const me = engine.userIdx >= 0 ? engine.players[engine.userIdx] : null;
  return (
    <div className="stylebar">
      {open && (
        <div className="stylebar-panel fade-in">
          {(Object.keys(STYLE_OPTS) as (keyof typeof STYLE_OPTS)[]).map((k) => (
            <div key={k} className="field">
              <label>{STYLE_OPTS[k].label}</label>
              <div className="seg">
                {STYLE_OPTS[k].opts.map(([v, l]) => (
                  <button key={l} aria-pressed={Math.abs(st[k] - v) < 0.2} onClick={() => set({ [k]: v })}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <div className="field">
            <label>Rôle offensif</label>
            <div className="seg">
              {ROLES.map(([k, l]) => (
                <button key={k} aria-pressed={(st.role ?? 'auto') === k} onClick={() => set({ role: k })}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>Marquage</label>
            <div className="seg">
              <button aria-pressed={!st.guardStar} onClick={() => set({ guardStar: false })}>
                Selon le coach
              </button>
              <button aria-pressed={!!st.guardStar} onClick={() => set({ guardStar: true })}>
                Défendre sur leur meilleur joueur
              </button>
            </div>
          </div>
          <div className="field">
            <label>Demande au coach {st.sub && st.sub !== 'none' ? '(en attente du prochain arrêt de jeu)' : ''}</label>
            <div className="seg">
              {me?.onCourt ? (
                <button aria-pressed={st.sub === 'out'} onClick={() => set({ sub: st.sub === 'out' ? 'none' : 'out' })}>
                  Demander à souffler ({Math.round((me?.energy ?? 0) * 100)} % d'énergie)
                </button>
              ) : (
                <button aria-pressed={st.sub === 'in'} onClick={() => set({ sub: st.sub === 'in' ? 'none' : 'in' })}>
                  Demander à entrer en jeu
                </button>
              )}
            </div>
          </div>
          <p className="tiny muted">Ces consignes modifient réellement les décisions de votre joueur (tirs, placement, marquage, interceptions, rebond, énergie). Le coach reste libre d'accepter les changements.</p>
        </div>
      )}
      <button className="btn small" onClick={() => setOpen((o) => !o)}>
        {open ? 'Fermer' : 'Consignes à mon joueur'}
      </button>
    </div>
  );
}

function topScorers(e: MatchEngine, t: 0 | 1): string {
  return e.teams[t].players
    .map((i) => e.players[i])
    .filter((p) => p.box.pts > 0)
    .sort((a, b) => b.box.pts - a.box.pts)
    .slice(0, 2)
    .map((p) => `${p.data.lastName} ${p.box.pts}`)
    .join(' · ');
}

function tickerRows(e: MatchEngine): MatchHudRow[] {
  const official = e.rules.id === 'NBA' ? 12 : 10;
  const scale = official / e.rules.quarterMin;
  const rows: MatchHudRow[] = [];
  for (const t of [0, 1] as const) {
    rows.push({ sep: true, name: e.teams[t].short, color: e.teams[t].colors[0] });
    for (const i of e.teams[t].players) {
      const p = e.players[i];
      rows.push({ name: `${p.data.number} ${p.data.lastName}`, pts: p.box.pts, reb: p.box.orb + p.box.drb, ast: p.box.ast, min: Math.round((p.box.sec / 60) * scale), pf: p.fouls, on: p.onCourt, me: p.isUser });
    }
  }
  return rows;
}
type MatchHudRow = { sep?: boolean; name: string; color?: string; pts?: number; reb?: number; ast?: number; min?: number; pf?: number; on?: boolean; me?: boolean };
