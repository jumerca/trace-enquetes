import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { userClub, user, type Career } from '../career/career';
import { playerOvr } from '../data/generate';
import { listSlots, metaOf, saveSlot, type SlotMeta } from '../save/db';
import { setVolume } from './audio';
import { applyDocumentSettings, loadSettings, saveSettings, type Settings } from './settings';
import { Home } from './screens/Home';
import { Saves } from './screens/Saves';
import { Create } from './screens/Create';
import { Hub, type HubTab } from './screens/Hub';
import { PreMatch } from './screens/PreMatch';
import { MatchScreen } from './screens/MatchScreen';
import { PostMatch } from './screens/PostMatch';
import { SettingsScreen } from './screens/SettingsScreen';
import { Help } from './screens/Help';
import type { MatchEngine } from '../sim/engine';
import type { UserGameLine } from '../career/world';

export type Screen =
  | { name: 'home' }
  | { name: 'saves'; mode: 'load' | 'delete' }
  | { name: 'create' }
  | { name: 'hub'; tab: HubTab }
  | { name: 'prematch' }
  | { name: 'match'; quick?: boolean; watch?: string }
  | { name: 'postmatch' }
  | { name: 'settings'; back: Screen }
  | { name: 'help'; back: Screen };

export interface LastMatch {
  engine: MatchEngine;
  line: UserGameLine | null;
  fixtureId: string | null;
  quick: boolean;
  /** Match d'autres équipes regardé en spectateur */
  watch?: boolean;
  reputationBefore: number;
}

interface Ctx {
  screen: Screen;
  go: (s: Screen) => void;
  career: Career | null;
  slot: number | null;
  setCareer: (c: Career | null, slot?: number | null) => void;
  persist: (c?: Career) => Promise<void>;
  settings: Settings;
  setSettings: (s: Settings) => void;
  toast: (msg: string) => void;
  slots: (SlotMeta | null)[];
  refreshSlots: () => Promise<void>;
  lastMatch: LastMatch | null;
  setLastMatch: (m: LastMatch | null) => void;
  bump: () => void;
}

const AppCtx = createContext<Ctx | null>(null);
export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('Contexte absent');
  return c;
}

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [career, setCareerState] = useState<Career | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [settings, setSettingsState] = useState<Settings>(() => loadSettings());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [slots, setSlots] = useState<(SlotMeta | null)[]>([]);
  const [lastMatch, setLastMatch] = useState<LastMatch | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    applyDocumentSettings(settings);
    setVolume(settings.volume);
  }, [settings]);

  const refreshSlots = useCallback(async () => {
    try {
      setSlots(await listSlots());
    } catch {
      setSlots([]);
    }
  }, []);
  useEffect(() => {
    void refreshSlots();
  }, [refreshSlots]);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    window.setTimeout(() => setToastMsg((cur) => (cur === m ? null : cur)), 3200);
  }, []);

  const persist = useCallback(
    async (c?: Career) => {
      const k = c ?? career;
      if (!k || slot === null) return;
      try {
        k.updatedAt = Date.now();
        await saveSlot(slot, k, metaOf(k, slot, playerOvr(user(k)), userClub(k).name));
        await refreshSlots();
      } catch (e) {
        toast(`Échec de la sauvegarde : ${(e as Error).message}`);
      }
    },
    [career, slot, refreshSlots, toast],
  );

  const ctx = useMemo<Ctx>(
    () => ({
      screen,
      go: (s) => {
        setScreen(s);
        window.scrollTo(0, 0);
      },
      career,
      slot,
      setCareer: (c, s) => {
        setCareerState(c);
        if (s !== undefined) setSlot(s);
      },
      persist,
      settings,
      setSettings: (s) => {
        setSettingsState(s);
        saveSettings(s);
      },
      toast,
      slots,
      refreshSlots,
      lastMatch,
      setLastMatch,
      bump: () => setTick((t) => t + 1),
    }),
    [screen, career, slot, persist, settings, toast, slots, refreshSlots, lastMatch],
  );

  let body: JSX.Element;
  switch (screen.name) {
    case 'home':
      body = <Home />;
      break;
    case 'saves':
      body = <Saves mode={screen.mode} />;
      break;
    case 'create':
      body = <Create />;
      break;
    case 'hub':
      body = career ? <Hub tab={screen.tab} /> : <Home />;
      break;
    case 'prematch':
      body = career ? <PreMatch /> : <Home />;
      break;
    case 'match':
      body = <MatchScreen key={screen.watch ?? 'own'} quick={!!screen.quick} watch={screen.watch} />;
      break;
    case 'postmatch':
      body = <PostMatch />;
      break;
    case 'settings':
      body = <SettingsScreen back={screen.back} />;
      break;
    case 'help':
      body = <Help back={screen.back} />;
      break;
  }
  return (
    <AppCtx.Provider value={ctx}>
      {body}
      {toastMsg && (
        <div className="toast fade-in" role="status">
          {toastMsg}
        </div>
      )}
    </AppCtx.Provider>
  );
}
