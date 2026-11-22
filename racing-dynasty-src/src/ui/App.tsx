import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { Career } from '../game/career';
import { SaveStore, requestPersistence } from '../game/save';
import { loadSettings, saveSettings, type Settings } from '../game/settings';
import { Home } from './screens/Home';
import { NewCareer } from './screens/NewCareer';
import { Hub } from './screens/Hub';
import { WeekendScreen } from './screens/Weekend';
import { SettingsScreen, Credits } from './screens/Settings';
import { menuMusic } from './music';

declare const __APP_VERSION__: string;
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

export type Screen = 'home' | 'new' | 'hub' | 'weekend' | 'settings' | 'credits';

export interface GameApi {
  career: Career;
  /** Applique une action de gestion, sauvegarde et rafraîchit. Renvoie le message d'erreur éventuel. */
  act: (fn: (c: Career) => string | null | void | unknown) => string | null;
  save: () => void;
  toast: (msg: string) => void;
  go: (s: Screen) => void;
  settings: Settings;
  setSettings: (s: Settings) => void;
}

export const store = new SaveStore(typeof localStorage !== 'undefined' ? localStorage : null, APP_VERSION);

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [career, setCareer] = useState<Career | null>(null);
  const [slot, setSlot] = useState(0);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [toastMsg, setToast] = useState<string | null>(null);
  const [ver, bump] = useReducer((x: number) => x + 1, 0);
  const toastTimer = useRef<number>();

  const toast = useCallback((m: string) => {
    setToast(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  const save = useCallback(() => {
    if (!career) return;
    try {
      store.save(slot, career);
    } catch (e) {
      toast('Sauvegarde impossible : ' + (e as Error).message);
    }
  }, [career, slot, toast]);

  const act = useCallback(
    (fn: (c: Career) => unknown) => {
      if (!career) return 'Aucune carrière chargée.';
      const r = fn(career);
      const err = typeof r === 'string' ? r : null;
      if (err) toast(err);
      save();
      bump();
      return err;
    },
    [career, save, toast],
  );

  useEffect(() => {
    void requestPersistence();
  }, []);

  // Musique des menus : démarre au premier geste, jamais pendant une course.
  useEffect(() => {
    menuMusic.setEnabled(settings.music);
    const onGesture = () => {
      if (!document.querySelector('.race')) menuMusic.play();
    };
    window.addEventListener('pointerdown', onGesture);
    return () => window.removeEventListener('pointerdown', onGesture);
  }, [settings.music]);

  // Le bouton « retour » d'Android ramène au QG plutôt que de quitter.
  useEffect(() => {
    const onPop = () => {
      if (screen !== 'home' && screen !== 'hub') setScreen(career ? 'hub' : 'home');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [screen, career]);

  const go = useCallback((s: Screen) => {
    if (s !== 'home') history.pushState({ s }, '');
    setScreen(s);
  }, []);

  const startCareer = (c: Career, s: number) => {
    setCareer(c);
    setSlot(s);
    store.save(s, c);
    go(c.weekend ? 'weekend' : 'hub');
  };

  const load = (s: number) => {
    const c = store.load(s);
    if (!c) return toast('Sauvegarde illisible.');
    setCareer(c);
    setSlot(s);
    go(c.weekend ? 'weekend' : 'hub');
  };

  const updateSettings = (s: Settings) => {
    setSettings(s);
    saveSettings(s);
  };

  const api: GameApi | null = useMemo(
    () => (career ? { career, act, save, toast, go, settings, setSettings: updateSettings } : null),
    // ver : la carrière est modifiée en place, on force un nouvel objet api à chaque action
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [career, act, save, toast, go, settings, ver],
  );

  return (
    <div className="app">
      {screen === 'home' && (
        <Home
          onNew={() => go('new')}
          onLoad={load}
          onSettings={() => go('settings')}
          onCredits={() => go('credits')}
        />
      )}
      {screen === 'new' && <NewCareer onCancel={() => setScreen('home')} onCreate={startCareer} />}
      {screen === 'hub' && api && <Hub api={api} />}
      {screen === 'weekend' && api && <WeekendScreen api={api} />}
      {screen === 'settings' && (
        <SettingsScreen settings={settings} onChange={updateSettings} onBack={() => setScreen(career ? 'hub' : 'home')} toast={toast} onQuit={() => { setCareer(null); setScreen('home'); }} hasCareer={!!career} />
      )}
      {screen === 'credits' && <Credits onBack={() => setScreen(career ? 'hub' : 'home')} />}
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </div>
  );
}
