import { useEffect, useRef, useState } from 'react';
import { newGame } from '../sim/sim';
import { REGIONS } from '../data/regions';
import type { GameState } from '../sim/state';
import { deserialize, listSlots, loadSlot, SLOT_NAMES, type Slot } from '../save/save';
import { Logo } from './Logo';
import { Icon } from './icons';
import { GameScreen } from './GameScreen';
import { loadSettings, saveSettings, type Settings } from './settings';

type Modal = null | 'nouvelle' | 'charger' | 'reglages' | 'credits' | 'installer';

interface InstallEvent extends Event {
  prompt(): Promise<void>;
}

export function App() {
  const [state, setState] = useState<GameState | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [modal, setModal] = useState<Modal>(null);
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof listSlots>>>([]);
  const [error, setError] = useState('');
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [gameKey, setGameKey] = useState(0);
  const [region, setRegion] = useState('limousin');
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshSlots = () => listSlots().then(setSlots).catch(() => setSlots([]));
  useEffect(() => {
    refreshSlots();
    const h = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);

  const start = (s: GameState) => {
    setError('');
    setModal(null);
    setGameKey((k) => k + 1);
    setState(s);
  };
  const load = async (slot: Slot) => {
    try {
      const s = await loadSlot(slot);
      if (s) start(s);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const importFile = async (f: File | undefined) => {
    if (!f) return;
    try {
      start(deserialize(await f.text()));
    } catch (e) {
      setError('Import impossible : ' + (e as Error).message);
    }
  };
  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  if (state)
    return (
      <GameScreen
        key={gameKey}
        initial={state}
        settings={settings}
        onSettings={updateSettings}
        onQuit={() => {
          setState(null);
          refreshSlots();
        }}
        onLoad={start}
      />
    );

  const auto = slots.find((s) => s.slot === 'auto') ?? slots[0];
  return (
    <div className="menu">
      <MenuBackdrop />
      <div className="menu-inner">
        <Logo width={Math.min(420, window.innerWidth - 40)} />
        <p className="tagline">Bâtissez et faites vivre un domaine rural, du verger à la table.</p>
        <nav className="menu-buttons">
          <button className="btn primary" onClick={() => setModal('nouvelle')} data-testid="nouvelle-partie">
            Nouvelle partie
          </button>
          <button className="btn" disabled={!auto} onClick={() => auto && load(auto.slot)} data-testid="continuer">
            Continuer{auto ? <small> — {auto.label}</small> : null}
          </button>
          <button className="btn" onClick={() => setModal('charger')}>Charger</button>
          <button className="btn" onClick={() => setModal('reglages')}>Réglages</button>
          <button className="btn" onClick={() => setModal('credits')}>Crédits</button>
          <button className="btn" onClick={() => (install ? install.prompt().then(() => setInstall(null)) : setModal('installer'))}>
            Installer
          </button>
        </nav>
        {error && <p className="error">{error}</p>}
        <p className="version">V{__APP_VERSION__} · huit régions de France</p>
      </div>
      {modal && (
        <div className="modal-back" onClick={() => setModal(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <button className="icon-btn close" onClick={() => setModal(null)} aria-label="Fermer">
              <Icon name="close" />
            </button>
            {modal === 'nouvelle' && (
              <>
                <h2>Où installer votre domaine ?</h2>
                <p className="muted">Chaque région a son relief, son climat, son architecture, ses cultures et ses élevages.</p>
                <div className="regions" role="radiogroup">
                  {REGIONS.map((r) => (
                    <button key={r.id} role="radio" aria-checked={region === r.id} className={'region' + (region === r.id ? ' on' : '')} onClick={() => setRegion(r.id)} data-testid={'region-' + r.id}>
                      <span className="region-swatch" style={{ background: `linear-gradient(135deg, ${r.architecture.toit} 0 30%, ${r.architecture.mur} 30% 60%, ${r.mer ? '#3f8fb5' : r.relief.montagne > 0.3 ? '#8e8a7e' : '#7aa64a'} 60%)` }} />
                      <b>{r.nom}</b>
                      <small>{r.sous}</small>
                    </button>
                  ))}
                </div>
                {(() => {
                  const r = REGIONS.find((x) => x.id === region)!;
                  return (
                    <div className="region-detail">
                      <p>{r.desc}</p>
                      <p>
                        <b>Spécialités :</b> {r.specialites}
                      </p>
                      <p className="muted">
                        Relief : {r.relief.montagne > 0.3 ? 'montagneux' : r.relief.amplitude > 100 ? 'collines marquées' : r.relief.amplitude > 30 ? 'vallonné' : 'plat'} · {r.mer ? 'côte et plage · ' : ''}tourisme {r.tourisme >= 1.5 ? 'très fort' : r.tourisme >= 1.1 ? 'fort' : r.tourisme >= 0.9 ? 'moyen' : 'faible'} · départ avec {r.depart.argent.toLocaleString('fr-FR')} €
                      </p>
                    </div>
                  );
                })()}
                <button className="btn primary" onClick={() => start(newGame(Math.floor(Math.random() * 1e6), region))} data-testid="commencer">
                  Commencer en {REGIONS.find((x) => x.id === region)!.nom}
                </button>
              </>
            )}
            {modal === 'charger' && (
              <>
                <h2>Charger une partie</h2>
                {!slots.length && <p className="muted">Aucune sauvegarde sur cet appareil.</p>}
                <ul className="slots">
                  {slots.map((s) => (
                    <li key={s.slot}>
                      <button className="btn" onClick={() => load(s.slot)}>
                        <b>{SLOT_NAMES[s.slot]}</b>
                        <small>
                          {s.label} · {Math.round(s.money).toLocaleString('fr-FR')} € · {new Date(s.savedAt).toLocaleString('fr-FR')}
                        </small>
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="btn" onClick={() => fileRef.current?.click()}>
                  <Icon name="upload" /> Importer un fichier (.json)
                </button>
                <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
              </>
            )}
            {modal === 'reglages' && <SettingsForm settings={settings} onChange={updateSettings} />}
            {modal === 'credits' && <Credits />}
            {modal === 'installer' && (
              <>
                <h2>Installer le jeu</h2>
                <p>Le jeu est une application web installable et jouable hors ligne.</p>
                <ul>
                  <li>Android (Chrome) : menu ⋮ → « Installer l'application » ou « Ajouter à l'écran d'accueil ».</li>
                  <li>iPhone / iPad (Safari) : bouton Partager → « Sur l'écran d'accueil ».</li>
                  <li>Ordinateur (Chrome, Edge) : icône d'installation dans la barre d'adresse.</li>
                </ul>
                <p className="muted">Le navigateur n'a pas proposé d'installation directe sur cette page (déjà installé, navigation privée ou navigateur non compatible).</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function SettingsForm({ settings, onChange }: { settings: Settings; onChange: (s: Settings) => void }) {
  return (
    <>
      <h2>Réglages</h2>
      <label className="field">
        <span>Qualité graphique</span>
        <select value={settings.quality} onChange={(e) => onChange({ ...settings, quality: e.target.value as Settings['quality'] })}>
          <option value="haute">Haute (textures nettes, écran haute densité)</option>
          <option value="basse">Économie (téléphones modestes, batterie)</option>
        </select>
      </label>
      <label className="field check">
        <input type="checkbox" checked={settings.tutorial} onChange={(e) => onChange({ ...settings, tutorial: e.target.checked })} />
        <span>Afficher le tutoriel</span>
      </label>
      <label className="field check">
        <input type="checkbox" checked={settings.adaptive} onChange={(e) => onChange({ ...settings, adaptive: e.target.checked })} />
        <span>Alléger l'affichage automatiquement si le jeu ralentit</span>
      </label>
      <label className="field check">
        <input type="checkbox" checked={settings.perf} onChange={(e) => onChange({ ...settings, perf: e.target.checked })} data-testid="reglage-perf" />
        <span>Afficher les performances (images/s, coût par image, objets affichés)</span>
      </label>
      <p className="muted">La qualité graphique s'applique au prochain lancement d'une partie.</p>
    </>
  );
}

function Credits() {
  return (
    <>
      <h2>Crédits</h2>
      <p>
        <b>Domaines & Terroirs</b> — une création <b>JLG Creative</b>.
      </p>
      <p>Conception, programmation et illustrations procédurales originales. Aucune ressource graphique ou sonore tierce n'est utilisée.</p>
      <p className="muted">
        Technologies libres : TypeScript, React, PixiJS, Vite. Version {__APP_VERSION__} (build {__APP_BUILD__}).
      </p>
    </>
  );
}

/** Paysage vectoriel du menu (collines corréziennes, cyprès, ferme). */
function MenuBackdrop() {
  return (
    <svg className="menu-backdrop" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8fc3e8" />
          <stop offset="0.55" stopColor="#f4dcae" />
          <stop offset="1" stopColor="#f0c98a" />
        </linearGradient>
      </defs>
      <rect width="1600" height="900" fill="url(#sky)" />
      <circle cx="1240" cy="250" r="70" fill="#fff4cf" opacity="0.8" />
      <path d="M0 520 Q200 420 420 480 T860 450 T1300 470 T1600 430 V900 H0z" fill="#9db7a0" opacity="0.8" />
      <path d="M0 580 Q260 500 520 560 T1040 530 T1600 540 V900 H0z" fill="#8aa96a" />
      <path d="M0 650 Q300 590 640 640 T1300 620 T1600 640 V900 H0z" fill="#7a9a4a" />
      {Array.from({ length: 9 }).map((_, i) => (
        <path key={i} d={`M${120 + i * 165} ${708 - (i % 3) * 18} l0 -10 q-9 -40 0 -70 q9 30 0 70z`} fill="#3f6a34" />
      ))}
      {Array.from({ length: 14 }).map((_, i) => (
        <path key={'v' + i} d={`M${-40 + i * 60} 900 L${560 + i * 40} 700`} stroke="#6a8a3a" strokeWidth="6" opacity="0.55" />
      ))}
      <g transform="translate(1080 600)">
        <rect x="0" y="0" width="150" height="70" fill="#e2cfa4" />
        <path d="M-12 4 L75 -40 L162 4z" fill="#b8553a" />
        <rect x="20" y="22" width="16" height="20" fill="#6f93b4" />
        <rect x="60" y="30" width="22" height="40" fill="#7a4f2e" />
        <rect x="110" y="22" width="16" height="20" fill="#6f93b4" />
      </g>
      <path d="M0 760 Q400 700 800 760 T1600 740 V900 H0z" fill="#6a8a3a" />
    </svg>
  );
}
