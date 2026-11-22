import { useEffect, useState } from 'react';
import { Logo } from '../common';
import { PaintedCar } from '../PaintedCar';
import { store, APP_VERSION } from '../App';
import { SLOT_COUNT } from '../../game/save';

interface InstallEvent extends Event {
  prompt: () => Promise<void>;
}

let deferredInstall: InstallEvent | null = null;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e as InstallEvent;
  });
}

export function Home({ onNew, onLoad, onSettings, onCredits }: { onNew: () => void; onLoad: (slot: number) => void; onSettings: () => void; onCredits: () => void }) {
  const last = store.lastSlot();
  const [showSlots, setShowSlots] = useState(false);
  const [canInstall, setCanInstall] = useState(!!deferredInstall);
  const slots = store.list();
  useEffect(() => {
    const h = () => setCanInstall(true);
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  return (
    <div className="home">
      <div className="home-sky" aria-hidden />
      <div className="home-track" aria-hidden>
        <div className="home-lane">
          <div className="home-road" />
          <div className="home-car c1"><PaintedCar livery={{ color: '#d62828', color2: '#ffd400', number: 1, sponsor: 'DYNASTY', sponsorColor: '#16130f' }} width={340} /></div>
          <div className="home-car c2"><PaintedCar livery={{ color: '#1f9e89', color2: '#f4d35e', number: 27 }} width={300} /></div>
          <div className="home-car c3"><PaintedCar livery={{ color: '#3a86ff', color2: '#f4f1ea', number: 44 }} width={280} /></div>
        </div>
      </div>
      <div className="home-inner">
        <Logo size={0.95} />
        <p className="tagline">Bâtissez votre écurie. Écrivez votre légende.</p>
        <nav className="home-menu">
          <button className="btn big primary" onClick={onNew}>Nouvelle carrière</button>
          <button className="btn big" disabled={last === null} onClick={() => last !== null && onLoad(last)}>
            Continuer
            {last !== null && <small>{slots[last].teamName} — saison {slots[last].season}</small>}
          </button>
          <button className="btn" disabled={slots.every((s) => s.empty)} onClick={() => setShowSlots(!showSlots)}>Charger une partie</button>
          {showSlots && (
            <div className="slots">
              {slots.map((s) => (
                <button key={s.slot} className="slot" disabled={s.empty} onClick={() => onLoad(s.slot)}>
                  <b>Emplacement {s.slot + 1}</b>
                  {s.empty ? <span>vide</span> : s.corrupted ? <span>illisible (copie de secours tentée)</span> : (
                    <span>{s.teamName} · saison {s.season} · GP {Math.min((s.round ?? 0) + 1, s.rounds ?? 5)}/{s.rounds ?? 5} · {new Date(s.savedAt!).toLocaleString('fr-FR')}</span>
                  )}
                </button>
              ))}
            </div>
          )}
          <div className="row">
            <button className="btn" onClick={onSettings}>Paramètres</button>
            <button className="btn" onClick={onCredits}>Crédits</button>
          </div>
          {canInstall && (
            <button className="btn ghost" onClick={async () => { await deferredInstall?.prompt(); deferredInstall = null; setCanInstall(false); }}>
              ⇩ Installer l’application
            </button>
          )}
        </nav>
      </div>
      <footer className="home-foot">JLG Creative · v{APP_VERSION} · {SLOT_COUNT} emplacements de sauvegarde</footer>
    </div>
  );
}
