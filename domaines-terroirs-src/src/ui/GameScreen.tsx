import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Game, type Speed } from '../game';
import { BUILDINGS, RESOURCES, WEATHER } from '../data/content';
import { TUTORIAL, dateLabel, fmtTime } from '../sim/sim';
import { VOIES, build, buildPath, checkBuild, checkPath, demolish, togglePriority, type Voie } from '../sim/actions';
import { defOf, isParcel } from '../sim/geom';
import type { GameState } from '../sim/state';
import { deserialize, downloadSave, saveSlot, SLOTS, SLOT_NAMES, listSlots, loadSlot, type Slot } from '../save/save';
import { Icon, WEATHER_ICON } from './icons';
import { BuildingCard, PANELS, type PanelId } from './panels';
import { SettingsForm } from './App';
import type { Settings } from './settings';

export type Tool = { kind: 'build'; type: string; rot: 0 | 1; x: number; y: number; placed: boolean } | { kind: 'chemin'; voie: Voie } | { kind: 'demolir' } | null;

export const eur = (v: number, d = 0) => `${v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d })} €`;

export function GameScreen({ initial, settings, onSettings, onQuit, onLoad }: { initial: GameState; settings: Settings; onSettings: (s: Settings) => void; onQuit: () => void; onLoad: (s: GameState) => void }) {
  const game = useMemo(() => new Game(initial), [initial]);
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [tool, setToolState] = useState<Tool>(null);
  const toolRef = useRef<Tool>(null);
  const [menu, setMenu] = useState<null | 'pause' | 'save' | 'load' | 'reglages'>(null);
  const [toast, setToast] = useState('');
  const [tutoOpen, setTutoOpen] = useState(() => window.innerWidth > 700);
  const [loadError, setLoadError] = useState('');
  useSyncExternalStore(
    (l) => game.subscribe(l),
    () => game.version,
  );
  const s = game.sim.s;
  const sim = game.sim;

  const setTool = (t: Tool) => {
    toolRef.current = t;
    setToolState(t);
    if (game.scene) {
      game.scene.ghost = null;
      if (t?.kind === 'build') updateGhost(t);
    }
  };

  const updateGhost = (t: Extract<Tool, { kind: 'build' }>) => {
    if (!game.scene) return;
    const c = checkBuild(sim, t.type, t.x, t.y, t.rot);
    game.scene.ghost = { type: t.type, x: t.x, y: t.y, rot: t.rot, ok: c.ok };
  };

  const flash = (msg: string) => {
    setToast(msg);
    window.clearTimeout((flash as unknown as { t: number }).t);
    (flash as unknown as { t: number }).t = window.setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    let alive = true;
    const onTap = (tx: number, ty: number, pointerType: string) => {
      const t = toolRef.current;
      if (t?.kind === 'build') {
        const sz = BUILDINGS[t.type].size;
        const nx = tx - (sz >> 1), ny = ty - (sz >> 1);
        if (pointerType === 'mouse' || (t.placed && nx === t.x && ny === t.y)) {
          placeBuilding({ ...t, x: nx, y: ny });
          return;
        }
        const nt = { ...t, x: nx, y: ny, placed: true };
        toolRef.current = nt;
        setToolState(nt);
        updateGhost(nt);
        return;
      }
      if (t?.kind === 'chemin') {
        const c = checkPath(sim, tx, ty, t.voie);
        if (c.ok) buildPath(sim, tx, ty, t.voie);
        else flash(c.reason);
        game.notify();
        return;
      }
      const scene = game.scene!;
      const id = scene.pickBuilding(scene.lastTap.sx, scene.lastTap.sy);
      if (t?.kind === 'demolir') {
        if (id != null) setSelected(id);
        scene.selected = id;
        return;
      }
      setSelected(id);
      scene.selected = id;
      if (id != null) setPanelOpen(false);
    };
    const onHover = (tx: number, ty: number) => {
      const t = toolRef.current;
      if (t?.kind === 'build') {
        const sz = BUILDINGS[t.type].size;
        const nt = { ...t, x: tx - (sz >> 1), y: ty - (sz >> 1) };
        if (nt.x === t.x && nt.y === t.y) return;
        toolRef.current = nt;
        updateGhost(nt);
      } else if (t?.kind === 'chemin' && game.scene) {
        const c = checkPath(sim, tx, ty, t.voie);
        game.scene.ghost = { type: 'chemin', x: tx, y: ty, rot: 0, ok: c.ok };
      }
    };
    game.mount(host.current!, { onTap, onHover }, settings.quality).then(() => {
      if (!alive) return;
      setReady(true);
      // accès de test et de diagnostic (Playwright)
      Object.assign(window, { __dt: game, __dtActions: { build, buildPath, demolish, checkBuild } });
    });
    const vis = () => {
      if (document.hidden) saveSlot('auto', game.sim.s).catch(() => undefined);
    };
    document.addEventListener('visibilitychange', vis);
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const sc = game.scene;
      if (!sc) return;
      if (e.key === ' ') {
        game.setSpeed(game.speed === 0 ? 1 : 0);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        setTool(null);
        setSelected(null);
        sc.selected = null;
      } else if (e.key === 'r' || e.key === 'R') {
        const t = toolRef.current;
        if (t?.kind === 'build') {
          const nt = { ...t, rot: (t.rot ? 0 : 1) as 0 | 1 };
          toolRef.current = nt;
          setToolState(nt);
          updateGhost(nt);
        }
      } else if (e.key === '+' || e.key === '=') sc.zoomBy(1.15);
      else if (e.key === '-') sc.zoomBy(1 / 1.15);
      else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        const d = 60;
        sc.panBy(e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0, e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0);
      } else if (['1', '2', '3'].includes(e.key)) game.setSpeed(([1, 2, 4] as Speed[])[+e.key - 1]);
    };
    window.addEventListener('keydown', key);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('keydown', key);
      saveSlot('auto', game.sim.s).catch(() => undefined);
      game.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  const placeBuilding = (t: Extract<Tool, { kind: 'build' }>) => {
    const c = checkBuild(sim, t.type, t.x, t.y, t.rot);
    if (!c.ok) {
      flash(c.reason);
      updateGhost(t);
      return;
    }
    const b = build(sim, t.type, t.x, t.y, t.rot);
    if (b) {
      setTool(null);
      setSelected(b.id);
      if (game.scene) game.scene.selected = b.id;
      game.notify();
    }
  };

  const openPanel = (p: PanelId) => {
    if (panel === p && panelOpen) {
      setPanel(null);
      return;
    }
    setPanel(p);
    setPanelOpen(true);
    if (game.scene) game.scene.showLots = p === 'territoire';
  };

  const sel = selected != null ? sim.byId.get(selected) : undefined;
  const speedBtn = (sp: Speed, label: string) => (
    <button className={'speed' + (game.speed === sp ? ' on' : '')} onClick={() => game.setSpeed(sp)} aria-pressed={game.speed === sp} data-testid={'vitesse-' + sp}>
      {sp === 0 ? <Icon name="pause" size={16} /> : label}
    </button>
  );
  const today = s.ledger[s.ledger.length - 1];
  const todayNet = today ? Object.values(today.rev).reduce((a, b) => a + (b ?? 0), 0) - Object.values(today.cost).reduce((a, b) => a + (b ?? 0), 0) : 0;
  game.adaptive = settings.adaptive;
  const recentEvents = s.events.slice(-3).filter((e) => s.minute - e.min < 240);

  const buildTool = tool?.kind === 'build' ? tool : null;
  const check = buildTool ? checkBuild(sim, buildTool.type, buildTool.x, buildTool.y, buildTool.rot) : null;
  const PanelBody = panel ? PANELS[panel].Body : null;

  return (
    <div className={'game' + (panel && panelOpen ? ' has-panel' : '')}>
      <div className="stage" ref={host} />
      {!ready && <div className="loading">Préparation du domaine…</div>}
      <header className="hud">
        <div className="hud-group money" title="Trésorerie">
          <Icon name="coin" size={18} />
          <b className={s.money < 0 ? 'neg' : ''} data-testid="argent">{eur(s.money)}</b>
          <small className={todayNet < 0 ? 'neg' : 'pos'}>{todayNet >= 0 ? '+' : ''}{eur(todayNet)} auj.</small>
        </div>
        <div className="hud-group date" title="Date et heure">
          <span data-testid="date">{dateLabel(s.minute)}</span>
          <b>{fmtTime(s.minute)}</b>
        </div>
        <div className="hud-group" title={'Météo : ' + WEATHER[s.weather].nom}>
          <Icon name={WEATHER_ICON[s.weather]} size={18} />
          <span className="hide-s">{WEATHER[s.weather].nom}</span>
        </div>
        <div className="hud-group" title="Satisfaction des visiteurs (moyenne du dernier jour)">
          <Icon name="smile" size={18} />
          <span>{s.satisfaction}</span>
        </div>
        <div className="hud-group" title="Réputation du domaine">
          <Icon name="star" size={18} />
          <span>{Math.round(s.reputation)}</span>
        </div>
        <div className="hud-group speeds" role="group" aria-label="Vitesse">
          {speedBtn(0, '')}
          {speedBtn(1, '×1')}
          {speedBtn(2, '×2')}
          {speedBtn(4, '×4')}
        </div>
        {settings.perf && (
          <div className="hud-group perf" data-testid="perf">
            <span>{game.measuredFps()} i/s</span>
            <small>
              {game.cpuMs().toFixed(1)} ms · {game.scene?.visibleObjects ?? 0} obj. · détail {2 - (game.scene?.lodLevel ?? 0)}/2
            </small>
          </div>
        )}
        <div className="hud-group tools">
          <button className="icon-btn" title="Recentrer sur la ferme" aria-label="Recentrer" onClick={() => game.scene?.centerOn(game.sim.s.world.farm[0] + 2, game.sim.s.world.farm[1])}>
            <Icon name="target" />
          </button>
          <button
            className="icon-btn"
            title="Menu"
            aria-label="Menu"
            data-testid="menu-jeu"
            onClick={() => {
              game.setSpeed(0);
              setMenu('pause');
            }}
          >
            <Icon name="menu" />
          </button>
        </div>
      </header>

      {settings.tutorial && s.tutorial < TUTORIAL.length && (
        <aside className={'tuto' + (tutoOpen ? '' : ' closed')} data-testid="tutoriel">
          <button className="tuto-head" onClick={() => setTutoOpen(!tutoOpen)}>
            <Icon name="leaf" size={16} /> Objectif {s.tutorial + 1}/5 : <b>{TUTORIAL[s.tutorial].titre}</b>
            <span className={'chev' + (tutoOpen ? ' up' : '')}>
              <Icon name="chevron" size={16} />
            </span>
          </button>
          {tutoOpen && (
            <>
              <p>{TUTORIAL[s.tutorial].texte}</p>
              <ol className="tuto-steps">
                {TUTORIAL.map((t, i) => (
                  <li key={i} className={i < s.tutorial ? 'done' : i === s.tutorial ? 'cur' : ''}>
                    {t.titre}
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      )}

      <div className="toasts" aria-live="polite">
        {toast && <div className="toast warn">{toast}</div>}
        {recentEvents.map((e, i) => (
          <div key={e.min + ':' + i} className={'toast ' + e.kind}>
            {e.text}
          </div>
        ))}
      </div>

      {tool && (
        <div className="buildbar" data-testid="barre-construction">
          {buildTool && (
            <>
              <div>
                <b>{BUILDINGS[buildTool.type].nom}</b>
                <small className={check?.ok ? 'ok' : 'ko'}>
                  {buildTool.placed || game.scene?.ghost ? check?.reason : 'Touchez la carte pour placer'} · {eur(check?.cost ?? BUILDINGS[buildTool.type].cout)}
                </small>
              </div>
              {!isParcel(buildTool.type) && (
                <button
                  className="btn small"
                  onClick={() => {
                    const nt = { ...buildTool, rot: (buildTool.rot ? 0 : 1) as 0 | 1 };
                    toolRef.current = nt;
                    setToolState(nt);
                    updateGhost(nt);
                  }}
                >
                  <Icon name="rotate" size={16} /> Pivoter
                </button>
              )}
              <button className="btn small primary" disabled={!check?.ok || !buildTool.placed} onClick={() => placeBuilding(buildTool)} data-testid="valider-construction">
                <Icon name="check" size={16} /> Valider
              </button>
            </>
          )}
          {tool.kind === 'chemin' && (
            <div>
              <b>{VOIES[tool.voie].nom}</b>
              <small>
                Touchez chaque case · {eur(VOIES[tool.voie].cout)} la case{tool.voie !== 'pont' ? ' (+ défrichage)' : ''} · {VOIES[tool.voie].desc}
              </small>
            </div>
          )}
          {tool.kind === 'demolir' && (
            <div>
              <b>Démolir</b>
              <small>Touchez un bâtiment puis confirmez · 30 % récupérés</small>
            </div>
          )}
          <button
            className="btn small"
            onClick={() => {
              setTool(null);
              if (game.scene) game.scene.ghost = null;
            }}
          >
            Terminer
          </button>
        </div>
      )}

      {sel && (
        <BuildingCard
          key={sel.id}
          b={sel}
          sim={sim}
          demolishMode={tool?.kind === 'demolir'}
          onClose={() => {
            setSelected(null);
            if (game.scene) game.scene.selected = null;
          }}
          onPriority={() => {
            togglePriority(sim, sel.id);
            game.notify();
          }}
          onDemolish={() => {
            if (demolish(sim, sel.id)) {
              setSelected(null);
              if (game.scene) game.scene.selected = null;
            }
            game.notify();
          }}
        />
      )}

      {panel && PanelBody && (
        <section className={'panel' + (panelOpen ? '' : ' collapsed')} data-testid={'panneau-' + panel}>
          <header>
            <button className="panel-title" onClick={() => setPanelOpen(!panelOpen)} aria-expanded={panelOpen}>
              <Icon name={PANELS[panel].icon} size={18} /> {PANELS[panel].nom}
              <span className={'chev' + (panelOpen ? ' up' : '')}>
                <Icon name="chevron" size={16} />
              </span>
            </button>
            <button
              className="icon-btn"
              aria-label="Fermer le panneau"
              onClick={() => {
                setPanel(null);
                if (game.scene) game.scene.showLots = false;
              }}
            >
              <Icon name="close" size={18} />
            </button>
          </header>
          {panelOpen && (
            <div className="panel-body">
              <PanelBody
                sim={sim}
                game={game}
                onTool={(t) => {
                  setTool(t);
                  setSelected(null);
                  if (game.scene) game.scene.selected = null;
                  setPanelOpen(false);
                }}
                onSelect={(id) => {
                  setSelected(id);
                  const b = sim.byId.get(id);
                  if (game.scene && b) {
                    game.scene.selected = id;
                    game.scene.centerOn(b.x + defOf(b).size / 2, b.y + defOf(b).size / 2);
                  }
                }}
              />
            </div>
          )}
        </section>
      )}

      <nav className="toolbar" aria-label="Gestion du domaine">
        {(Object.keys(PANELS) as PanelId[]).map((p) => (
          <button key={p} className={panel === p ? 'on' : ''} onClick={() => openPanel(p)} data-testid={'onglet-' + p}>
            <Icon name={PANELS[p].icon} />
            <span>{PANELS[p].nom}</span>
          </button>
        ))}
      </nav>

      {menu && (
        <div className="modal-back" onClick={() => setMenu(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <button className="icon-btn close" onClick={() => setMenu(null)} aria-label="Fermer">
              <Icon name="close" />
            </button>
            {menu === 'pause' && (
              <>
                <h2>Pause</h2>
                <div className="menu-buttons">
                  <button
                    className="btn primary"
                    onClick={() => {
                      setMenu(null);
                      game.setSpeed(1);
                    }}
                  >
                    Reprendre
                  </button>
                  <button className="btn" onClick={() => setMenu('save')}>
                    <Icon name="save" size={18} /> Enregistrer
                  </button>
                  <button className="btn" onClick={() => setMenu('load')}>
                    Charger
                  </button>
                  <button className="btn" onClick={() => downloadSave(s)}>
                    <Icon name="download" size={18} /> Exporter (.json)
                  </button>
                  <button className="btn" onClick={() => setMenu('reglages')}>
                    <Icon name="gear" size={18} /> Réglages
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      saveSlot('auto', s).finally(onQuit);
                    }}
                  >
                    Quitter vers le menu
                  </button>
                </div>
              </>
            )}
            {menu === 'save' && <SaveList mode="save" state={s} onDone={(msg) => { flash(msg); setMenu(null); }} />}
            {menu === 'load' && (
              <>
                <SaveList
                  mode="load"
                  state={s}
                  onDone={(msg) => flash(msg)}
                  onLoaded={(st) => {
                    setMenu(null);
                    onLoad(st);
                  }}
                />
                <ImportButton
                  onFile={async (f) => {
                    try {
                      onLoad(deserialize(await f.text()));
                    } catch (e) {
                      setLoadError((e as Error).message);
                    }
                  }}
                />
                {loadError && <p className="error">{loadError}</p>}
              </>
            )}
            {menu === 'reglages' && <SettingsForm settings={settings} onChange={onSettings} />}
          </div>
        </div>
      )}
    </div>
  );
}

function ImportButton({ onFile }: { onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button className="btn" onClick={() => ref.current?.click()}>
        <Icon name="upload" size={18} /> Importer un fichier (.json)
      </button>
      <input ref={ref} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </>
  );
}

function SaveList({ mode, state, onDone, onLoaded }: { mode: 'save' | 'load'; state: GameState; onDone: (msg: string) => void; onLoaded?: (s: GameState) => void }) {
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof listSlots>>>([]);
  useEffect(() => {
    listSlots().then(setSlots).catch(() => setSlots([]));
  }, []);
  const list = mode === 'save' ? SLOTS.filter((x) => x !== 'auto') : SLOTS;
  return (
    <>
      <h2>{mode === 'save' ? 'Enregistrer' : 'Charger'}</h2>
      <ul className="slots">
        {list.map((slot: Slot) => {
          const info = slots.find((x) => x.slot === slot);
          if (mode === 'load' && !info) return null;
          return (
            <li key={slot}>
              <button
                className="btn"
                data-testid={'emplacement-' + slot}
                onClick={async () => {
                  try {
                    if (mode === 'save') {
                      await saveSlot(slot, state);
                      onDone(`Partie enregistrée (${SLOT_NAMES[slot]}).`);
                    } else {
                      const st = await loadSlot(slot);
                      if (st) onLoaded?.(st);
                    }
                  } catch (e) {
                    onDone('Erreur : ' + (e as Error).message);
                  }
                }}
              >
                <b>{SLOT_NAMES[slot]}</b>
                <small>{info ? `${info.label} · ${eur(info.money)} · ${new Date(info.savedAt).toLocaleString('fr-FR')}` : 'Vide'}</small>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export { RESOURCES };
