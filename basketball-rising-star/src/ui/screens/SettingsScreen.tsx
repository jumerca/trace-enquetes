import { useState } from 'react';
import { useApp, type Screen } from '../App';
import { DEFAULT_KEYS, keyLabel, type KeyMap } from '../settings';
import { Logo } from '../components/Art';

const KEY_LABELS: Record<keyof KeyMap, string> = {
  up: 'Haut',
  down: 'Bas',
  left: 'Gauche',
  right: 'Droite',
  sprint: 'Sprint',
  shoot: 'Tir / Couper / Contre',
  pass: 'Passe / Demander / Intercepter',
  lob: 'Passe lobée',
  action: 'Écran / Aide',
  pause: 'Pause',
};

export function SettingsScreen({ back }: { back: Screen }) {
  const app = useApp();
  const s = app.settings;
  const c = app.career;
  const [listening, setListening] = useState<keyof KeyMap | null>(null);
  const set = (patch: Partial<typeof s>) => app.setSettings({ ...s, ...patch });
  const quarter = c ? c.settings.quarterMin : s.defaultQuarter;
  const setQuarter = (q: number) => {
    set({ defaultQuarter: q });
    if (c) {
      c.settings.quarterMin = q;
      void app.persist(c);
    }
  };
  const listen = (k: keyof KeyMap) => {
    setListening(k);
    const h = (e: KeyboardEvent) => {
      e.preventDefault();
      set({ keys: { ...s.keys, [k]: e.code } });
      setListening(null);
      window.removeEventListener('keydown', h, true);
    };
    window.addEventListener('keydown', h, true);
  };
  return (
    <div className="screen-pad fade-in">
      <div className="row spread" style={{ marginBottom: 18 }}>
        <Logo compact />
        <button className="btn" onClick={() => app.go(back)}>
          ← Retour
        </button>
      </div>
      <h2 style={{ marginBottom: 12 }}>Paramètres</h2>
      <div className="grid cols-2">
        <div className="card grid" style={{ gap: 14 }}>
          <h3>Match</h3>
          <div className="field">
            <label>Durée des quarts-temps {c ? '(cette carrière)' : '(par défaut)'}</label>
            <div className="seg">
              {[0, 7, 5, 3].map((q) => (
                <button key={q} aria-pressed={quarter === q} onClick={() => setQuarter(q)}>
                  {q === 0 ? 'Officielle (10 min FIBA, 12 min NBA)' : `${q} min (arcade)`}
                </button>
              ))}
            </div>
            <span className="small muted">Option arcade : en dessous de la durée officielle, seules la durée et l'échelle de fatigue changent ; toutes les autres règles restent officielles. Les minutes sont ramenées à l'échelle officielle dans les statistiques.</span>
          </div>
          <div className="field">
            <label>Caméra par défaut</label>
            <div className="seg">
              <button aria-pressed={s.camera === 'full'} onClick={() => set({ camera: 'full' })}>
                Terrain entier
              </button>
              <button aria-pressed={s.camera === 'follow'} onClick={() => set({ camera: 'follow' })}>
                Rapprochée
              </button>
            </div>
          </div>
          <div className="field">
            <label>Qualité graphique</label>
            <div className="seg">
              <button aria-pressed={s.quality === 'high'} onClick={() => set({ quality: 'high' })}>
                Haute (écrans haute densité)
              </button>
              <button aria-pressed={s.quality === 'low'} onClick={() => set({ quality: 'low' })}>
                Économie (appareils modestes)
              </button>
            </div>
          </div>
          <div className="field">
            <label>Aide à la lecture : partenaires démarqués surlignés</label>
            <div className="seg">
              <button aria-pressed={s.showOpen} onClick={() => set({ showOpen: true })}>
                Oui
              </button>
              <button aria-pressed={!s.showOpen} onClick={() => set({ showOpen: false })}>
                Non
              </button>
            </div>
          </div>
          <div className="field">
            <label>Noms des joueurs sous leurs pieds (caméra rapprochée)</label>
            <div className="seg">
              <button aria-pressed={s.showNames} onClick={() => set({ showNames: true })}>
                Oui
              </button>
              <button aria-pressed={!s.showNames} onClick={() => set({ showNames: false })}>
                Non
              </button>
            </div>
          </div>
          <div className="field">
            <label>Ralenti sur les actions majeures</label>
            <div className="seg">
              <button aria-pressed={s.slowmo} onClick={() => set({ slowmo: true })}>
                Oui
              </button>
              <button aria-pressed={!s.slowmo} onClick={() => set({ slowmo: false })}>
                Non
              </button>
            </div>
          </div>
        </div>
        <div className="card grid" style={{ gap: 14 }}>
          <h3>Son & accessibilité</h3>
          <div className="field">
            <label>Volume : {Math.round(s.volume * 100)} %</label>
            <input type="range" min={0} max={1} step={0.05} value={s.volume} onChange={(e) => set({ volume: Number(e.target.value) })} />
          </div>
          <div className="field">
            <label>Taille du texte</label>
            <div className="seg">
              <button aria-pressed={s.textSize === 'normal'} onClick={() => set({ textSize: 'normal' })}>
                Normale
              </button>
              <button aria-pressed={s.textSize === 'large'} onClick={() => set({ textSize: 'large' })}>
                Grande
              </button>
            </div>
          </div>
          <div className="field">
            <label>Contraste</label>
            <div className="seg">
              <button aria-pressed={s.contrast === 'normal'} onClick={() => set({ contrast: 'normal' })}>
                Standard
              </button>
              <button aria-pressed={s.contrast === 'high'} onClick={() => set({ contrast: 'high' })}>
                Élevé
              </button>
            </div>
          </div>
          <div className="field">
            <label>Couleurs adaptées (daltonisme)</label>
            <div className="seg">
              <button aria-pressed={!s.colorblind} onClick={() => set({ colorblind: false })}>
                Standard
              </button>
              <button aria-pressed={s.colorblind} onClick={() => set({ colorblind: true })}>
                Adaptées
              </button>
            </div>
          </div>
          <div className="field">
            <label>Vibrations (mobile)</label>
            <div className="seg">
              <button aria-pressed={s.vibration} onClick={() => set({ vibration: true })}>
                Oui
              </button>
              <button aria-pressed={!s.vibration} onClick={() => set({ vibration: false })}>
                Non
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-title">
          <h3>Touches du clavier</h3>
          <button className="btn small" onClick={() => set({ keys: DEFAULT_KEYS })}>
            Réinitialiser
          </button>
        </div>
        <div className="grid cols-2" style={{ gap: 8 }}>
          {(Object.keys(KEY_LABELS) as (keyof KeyMap)[]).map((k) => (
            <div key={k} className="row spread" style={{ borderBottom: '1px solid var(--line)', padding: '6px 0' }}>
              <span className="small">{KEY_LABELS[k]}</span>
              <button className="btn small" onClick={() => listen(k)}>
                {listening === k ? 'Appuyez sur une touche…' : keyLabel(s.keys[k])}
              </button>
            </div>
          ))}
        </div>
        <p className="small muted">Les flèches directionnelles fonctionnent toujours en plus des touches choisies.</p>
      </div>
    </div>
  );
}
