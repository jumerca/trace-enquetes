import { useEffect, useState } from 'react';
import type { Settings } from '../../game/settings';
import { isLowEndDevice } from '../../game/settings';
import { store, APP_VERSION } from '../App';
import { Logo } from '../common';

export function SettingsScreen({ settings, onChange, onBack, toast, onQuit, hasCareer }: {
  settings: Settings; onChange: (s: Settings) => void; onBack: () => void; toast: (m: string) => void; onQuit: () => void; hasCareer: boolean;
}) {
  const [slots, setSlots] = useState(store.list());
  const [update, setUpdate] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });

  const exportSlot = (slot: number) => {
    const txt = store.exportText(slot);
    if (!txt) return;
    const blob = new Blob([txt], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `racing-dynasty-emplacement${slot + 1}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const importSlot = (slot: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      try {
        if (!slots[slot].empty && !confirm('Remplacer la partie de cet emplacement ?')) return;
        store.importText(slot, await f.text());
        setSlots(store.list());
        toast('Sauvegarde importée.');
      } catch (e) {
        toast('Import impossible : ' + (e as Error).message);
      }
    };
    input.click();
  };
  const checkUpdate = async () => {
    try {
      const reg = await navigator.serviceWorker?.getRegistration();
      if (!reg) return setUpdate('Mode développement : aucun service worker actif.');
      await reg.update();
      if (reg.waiting) {
        setUpdate('Nouvelle version prête. Elle s’installe au redémarrage (vos sauvegardes sont conservées).');
        reg.waiting.postMessage('skipWaiting');
      } else setUpdate('Vous avez la dernière version (' + APP_VERSION + ').');
    } catch {
      setUpdate('Vérification impossible (hors ligne ?).');
    }
  };

  return (
    <div className="page settings">
      <header className="pagehead"><button className="btn ghost" onClick={onBack}>← Retour</button><h1>Paramètres</h1></header>
      <div className="grid2">
        <section className="panel">
          <h2>Affichage de la course</h2>
          <label>Qualité graphique</label>
          <div className="seg">
            {(['auto', 'haute', 'economie'] as const).map((q) => <button key={q} className={settings.quality === q ? 'on' : ''} onClick={() => set('quality', q)}>{q === 'auto' ? 'Auto' : q === 'haute' ? 'Haute' : 'Économie'}</button>)}
          </div>
          <small className="muted">Auto choisit « Économie » sur cet appareil : {isLowEndDevice() ? 'oui (mémoire ≤ 4 Go ou ≤ 4 cœurs)' : 'non'}.</small>
          <label>Images par seconde max.</label>
          <div className="seg">
            {([30, 60] as const).map((f) => <button key={f} className={settings.fpsCap === f ? 'on' : ''} onClick={() => set('fpsCap', f)}>{f} i/s</button>)}
          </div>
          <label className="check"><input type="checkbox" checked={settings.names} onChange={(e) => set('names', e.target.checked)} /> Noms au-dessus des voitures</label>
          <label className="check"><input type="checkbox" checked={settings.sound} onChange={(e) => set('sound', e.target.checked)} /> Son (moteur, feux de départ, public)</label>
          <label className="check"><input type="checkbox" checked={settings.showFps} onChange={(e) => set('showFps', e.target.checked)} /> Afficher le compteur d’images/s</label>
        </section>
        <section className="panel">
          <h2>Sauvegardes</h2>
          <p className="muted">Sauvegarde automatique après chaque action et toutes les 15 s en course. Stockage protégé : {persisted === null ? 'inconnu' : persisted ? 'oui' : 'non garanti (exportez régulièrement)'}.</p>
          {slots.map((s) => (
            <div key={s.slot} className="slotrow">
              <div><b>Emplacement {s.slot + 1}</b><small>{s.empty ? 'vide' : s.corrupted ? 'illisible' : `${s.teamName} · saison ${s.season}`}</small></div>
              <div className="row">
                <button className="btn small" disabled={s.empty} onClick={() => exportSlot(s.slot)}>Exporter</button>
                <button className="btn small" onClick={() => importSlot(s.slot)}>Importer</button>
                <button className="btn small danger" disabled={s.empty} onClick={() => { if (confirm('Supprimer définitivement cette partie ?')) { store.remove(s.slot); setSlots(store.list()); } }}>Suppr.</button>
              </div>
            </div>
          ))}
          <h2>Application</h2>
          <p>Version {APP_VERSION}</p>
          <button className="btn" onClick={checkUpdate}>Rechercher une mise à jour</button>
          {update && <p className="muted">{update}</p>}
          {hasCareer && <button className="btn ghost" onClick={onQuit}>Quitter vers l’écran d’accueil</button>}
        </section>
      </div>
    </div>
  );
}

export function Credits({ onBack }: { onBack: () => void }) {
  return (
    <div className="page credits">
      <header className="pagehead"><button className="btn ghost" onClick={onBack}>← Retour</button><h1>Crédits</h1></header>
      <section className="panel center">
        <Logo size={0.7} />
        <h2>Racing Dynasty — V{APP_VERSION}</h2>
        <p>Une création <b>JLG Creative</b>.</p>
        <p>Conception, simulation, interface et graphismes originaux. Écuries, pilotes, sponsors et circuits sont entièrement fictifs ; toute ressemblance serait fortuite.</p>
        <p className="muted">Technologies : TypeScript, React, PixiJS, Vite. Polices : Bangers et Barlow Condensed (SIL Open Font License).</p>
      </section>
    </div>
  );
}
