import { useEffect, useMemo, useRef, useState } from 'react';
import { Game } from '../game';
import { portraitURL } from '../render/art';
import { deleteSlot, deserialize, listSlots, loadSlot, SLOT_NAMES, type Slot } from '../save/save';
import { SIZE_LABEL } from '../sim/city';
import { eraOf } from '../sim/calendar';
import { newGame } from '../sim/sim';
import { SPECIALITES } from '../sim/staff';
import type { Appearance, CitySize, Commander, GameState } from '../sim/types';
import { onUpdateReady, applyUpdate } from '../update';
import { GameCtx } from './common';
import { GameScreen } from './GameScreen';
import { Logo } from './Logo';

export function App() {
  const [game, setGame] = useState<Game | null>(null);
  const [mode, setMode] = useState<'title' | 'create'>('title');
  const [update, setUpdate] = useState(false);
  useEffect(() => onUpdateReady(() => setUpdate(true)), []);
  const start = (st: GameState) => {
    setGame(new Game(st));
  };
  if (game)
    return (
      <GameCtx.Provider value={game}>
        <GameScreen onQuit={() => { game.autosave(); game.unmount(); setGame(null); setMode('title'); }} />
        {update && <div className="toast" style={{ bottom: 80 }}>Une nouvelle version est disponible. <button className="btn small" onClick={async () => { await game.autosave(); applyUpdate(); }}>Mettre à jour</button></div>}
      </GameCtx.Provider>
    );
  return (
    <div className="title-screen">
      <Logo className="logo" />
      {mode === 'title' ? <Title onNew={() => setMode('create')} onLoad={start} /> : <Create onBack={() => setMode('title')} onStart={start} />}
      <p className="small-print">JLG Creative — version {__APP_VERSION__}. Ville, personnages, médias et affaires sont entièrement fictifs. Les procédures judiciaires sont un modèle de jeu simplifié, inspiré du fonctionnement français, et ne reproduisent pas le droit réel.</p>
      {update && <div className="toast">Une nouvelle version est disponible. <button className="btn small" onClick={applyUpdate}>Mettre à jour</button></div>}
    </div>
  );
}

function Title({ onNew, onLoad }: { onNew: () => void; onLoad: (st: GameState) => void }) {
  const [slots, setSlots] = useState<Awaited<ReturnType<typeof listSlots>>>([]);
  const [err, setErr] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const refresh = () => listSlots().then(setSlots).catch(() => setSlots([]));
  useEffect(() => { refresh(); }, []);
  const load = async (s: Slot) => {
    try { const st = await loadSlot(s); if (st) onLoad(st); } catch (e) { setErr(String((e as Error).message)); }
  };
  return (
    <>
      <div className="title-menu">
        {slots.some((s) => s.slot === 'auto') && <button className="btn primary" onClick={() => load('auto')}>▶ Continuer</button>}
        <button className={`btn ${slots.some((s) => s.slot === 'auto') ? '' : 'primary'}`} onClick={onNew}>Nouvelle carrière</button>
        <button className="btn" onClick={() => file.current?.click()}>Importer une sauvegarde…</button>
        <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          try { onLoad(deserialize(await f.text())); } catch (er) { setErr(String((er as Error).message)); }
        }} />
      </div>
      {err && <p style={{ color: '#ffb0a0' }}>{err}</p>}
      {slots.length > 0 && (
        <div className="saves">
          {slots.map((s) => (
            <div className="row" key={s.slot}>
              <div style={{ flex: 1 }}><b>{SLOT_NAMES[s.slot]}</b><br /><span style={{ opacity: .8 }}>{s.commander} — {s.city} — {s.label}</span></div>
              <button className="btn small" onClick={() => load(s.slot)}>Charger</button>
              <button className="btn small ghost" onClick={async () => { if (confirm('Supprimer cette sauvegarde ?')) { await deleteSlot(s.slot); refresh(); } }}>Suppr.</button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const YEARS = [1975, 1985, 1995, 2005, 2015, 2025];
const SIZES: CitySize[] = ['commune', 'petite', 'moyenne', 'grande', 'metropole'];

function Create({ onBack, onStart }: { onBack: () => void; onStart: (st: GameState) => void }) {
  const [c, setC] = useState({ prenom: 'Claire', nom: 'Vasseur', age: 42, sexe: 'F' as 'F' | 'M', experience: 'confirme' as Commander['experience'], formation: 'ecole' as Commander['formation'], specialite: 'Atteintes aux personnes', style: 'participatif' as Commander['style'], portrait: 0 });
  const [year, setYear] = useState(1995);
  const [size, setSize] = useState<CitySize>('moyenne');
  const [scenario, setScenario] = useState<'saint-clair' | 'libre'>('saint-clair');
  const [assist, setAssist] = useState<'manuel' | 'assiste' | 'delegation'>('assiste');
  const [city, setCity] = useState('Saint-Clair');
  const [tuto, setTuto] = useState<'oui' | 'non'>('oui');
  const looks: Appearance[] = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ skin: [0, 1, 2, 3, 4, 5, 1, 2][i], hair: [0, 1, 2, 3, 6, 0, 4, 5][i], hairStyle: c.sexe === 'F' ? [3, 4, 5, 6, 3, 4, 5, 6][i] : [0, 1, 2, 7, 0, 1, 2, 7][i], outfit: i, build: i % 3, glasses: i % 3 === 1, beard: c.sexe === 'M' && i % 4 === 2 })), [c.sexe]);
  const reference = scenario === 'saint-clair';
  const rep = c.experience === 'chevronne' ? 62 : c.experience === 'confirme' ? 50 : 40;
  const era = eraOf(reference ? 1995 : year);
  const go = () => {
    const st = newGame({
      startYear: reference ? 1995 : year, size: reference ? 'moyenne' : size, cityName: reference ? 'Saint-Clair' : city || 'Saint-Clair', scenario, assist,
      commander: { prenom: c.prenom || 'Claire', nom: c.nom || 'Vasseur', age: c.age, portrait: c.portrait, experience: c.experience, formation: c.formation, specialite: c.specialite, style: c.style, sexe: c.sexe, appearance: looks[c.portrait] },
    });
    st.tutorial = { on: tuto === 'oui', step: 0 };
    onStart(st);
  };
  const Chips = <T extends string | number>({ v, set, opts }: { v: T; set: (x: T) => void; opts: [T, string][] }) => (
    <div className="chips">{opts.map(([k, l]) => <button key={String(k)} className={`chip ${v === k ? 'on' : ''}`} onClick={() => set(k)}>{l}</button>)}</div>
  );
  return (
    <div className="create">
      <h2>Création de carrière</h2>
      <div className="grid">
        <label className="field">Prénom<input value={c.prenom} onChange={(e) => setC({ ...c, prenom: e.target.value })} maxLength={30} /></label>
        <label className="field">Nom<input value={c.nom} onChange={(e) => setC({ ...c, nom: e.target.value })} maxLength={30} /></label>
        <label className="field">Âge<input type="number" min={28} max={60} value={c.age} onChange={(e) => setC({ ...c, age: Math.max(28, Math.min(60, Number(e.target.value) || 40)) })} /></label>
        <div className="field">Sexe du personnage<Chips v={c.sexe} set={(s) => setC({ ...c, sexe: s })} opts={[['F', 'Femme'], ['M', 'Homme']]} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>Portrait
          <div className="portraits">{looks.map((a, i) => <img key={i} className={c.portrait === i ? 'on' : ''} src={portraitURL({ a, sexe: c.sexe, look: 'costume', era: reference ? 1995 : year }, 64)} onClick={() => setC({ ...c, portrait: i })} alt={`Portrait ${i + 1}`} />)}</div>
        </div>
        <div className="field">Expérience<Chips v={c.experience} set={(x) => setC({ ...c, experience: x })} opts={[['debutant', 'Débutant'], ['confirme', 'Confirmé'], ['chevronne', 'Chevronné']]} /></div>
        <div className="field">Formation<Chips v={c.formation} set={(x) => setC({ ...c, formation: x })} opts={[['ecole', 'École d\'officiers'], ['rang', 'Issu du rang'], ['universite', 'Concours externe']]} /></div>
        <label className="field">Spécialité<select value={c.specialite} onChange={(e) => setC({ ...c, specialite: e.target.value })}>{SPECIALITES.map((s) => <option key={s}>{s}</option>)}</select></label>
        <div className="field">Style de management<Chips v={c.style} set={(x) => setC({ ...c, style: x })} opts={[['participatif', 'Participatif'], ['directif', 'Directif'], ['delegatif', 'Délégatif'], ['bienveillant', 'Bienveillant']]} /></div>
        <div className="field">Réputation de départ<div>{rep}/100 <span className="muted">(selon l'expérience)</span></div></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>Scénario<Chips v={scenario} set={setScenario} opts={[['saint-clair', 'Saint-Clair, 1995 — « Les ombres de Saint-Clair » (scénario de référence)'], ['libre', 'Partie libre']]} /></div>
        {!reference && <>
          <div className="field">Année de départ<Chips v={year} set={setYear} opts={YEARS.map((y) => [y, String(y)] as [number, string])} /></div>
          <div className="field">Taille de la ville<select value={size} onChange={(e) => setSize(e.target.value as CitySize)}>{SIZES.map((s) => <option key={s} value={s}>{SIZE_LABEL[s]}</option>)}</select></div>
          <label className="field">Nom de la ville<input value={city} onChange={(e) => setCity(e.target.value)} maxLength={30} /></label>
        </>}
        <div className="field" style={{ gridColumn: '1 / -1' }}>Tutoriel de prise en main<Chips v={tuto} set={setTuto} opts={[['oui', 'Oui, guidez-moi pas à pas (recommandé pour une première partie)'], ['non', 'Non merci']]} /></div>
        <div className="field" style={{ gridColumn: '1 / -1' }}>Niveau d'assistance<Chips v={assist} set={setAssist} opts={[['manuel', 'Gestion entièrement manuelle'], ['assiste', 'Supervision assistée (recommandé)'], ['delegation', 'Délégation avancée']]} /></div>
      </div>
      <p className="muted" style={{ marginTop: 10 }}>Époque : <b>{era.label}</b> — informatique : {era.computers === 'aucun' ? 'aucune (machines à écrire, fiches papier)' : era.computers === 'terminal' ? 'terminaux et Minitel' : era.computers === 'pc' ? 'premiers PC' : era.computers === 'reseau' ? 'réseau et fichiers informatisés' : 'outils numériques et données en ligne'} ; communications : {era.phone} ; laboratoire : {Object.entries(era.lab).filter(([, v]) => v.available).length} types d'examens disponibles.</p>
      <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onBack}>← Retour</button>
        <button className="btn primary" onClick={go}>Prendre ses fonctions</button>
      </div>
    </div>
  );
}
