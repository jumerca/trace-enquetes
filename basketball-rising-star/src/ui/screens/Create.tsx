import { useMemo, useState } from 'react';
import { useApp } from '../App';
import { Logo, Portrait } from '../components/Art';
import { ARCHETYPES, ATTR_LABELS, POSITION_HEIGHT, POSITION_LABELS, POSITIONS, overall, type Archetype, type AttrKey, type Position } from '../../data/attributes';
import { NATIONS } from '../../data/names';
import { buildAttributes } from '../../data/generate';
import { Rng } from '../../core/rng';
import type { Appearance } from '../../data/model';
import { createCareer, START_PATHS, START_SEASON, type StartPath } from '../../career/career';
import { metaOf, saveSlot, SLOT_COUNT } from '../../save/db';
import { playerOvr } from '../../data/generate';
import { user, userClub } from '../../career/career';

const STEPS = ['Identité', 'Physique', 'Profil de jeu', 'Parcours'];
const HEIGHT_RANGE: Record<Position, [number, number]> = { PG: [175, 198], SG: [183, 203], SF: [191, 208], PF: [198, 214], C: [203, 226] };

export function Create() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [firstName, setFirst] = useState('');
  const [lastName, setLast] = useState('');
  const [nation, setNation] = useState('FRA');
  const [city, setCity] = useState(NATIONS.FRA.cities[0]);
  const [pos, setPos] = useState<Position>('SG');
  const [pos2, setPos2] = useState<Position>('SF');
  const [arch, setArch] = useState<Archetype>('sharpshooter');
  const [height, setHeight] = useState(194);
  const [weight, setWeight] = useState(88);
  const [hand, setHand] = useState<'R' | 'L'>('R');
  const [num, setNum] = useState(23);
  const [app_, setAppearance] = useState<Appearance>({ skin: 2, hair: 1, hairColor: 0, beard: 0, headband: false, sleeve: false });
  const [path, setPath] = useState<StartPath>('amateur');
  const [age, setAge] = useState(17);
  const firstFree = app.slots.findIndex((s) => !s);
  const [slot, setSlot] = useState<number>(firstFree >= 0 ? firstFree : 0);
  const [busy, setBusy] = useState(false);

  const archs = (Object.keys(ARCHETYPES) as Archetype[]).filter((a) => ARCHETYPES[a].positions.includes(pos));
  const preview = useMemo(() => buildAttributes(new Rng(7), pos, arch, 9, 0), [pos, arch]);
  const sorted = (Object.keys(preview) as AttrKey[]).filter((k) => !['ambition', 'determination', 'discipline', 'leadership'].includes(k)).sort((a, b) => preview[b] - preview[a]);
  const pr = START_PATHS[path];

  const setPosition = (p: Position) => {
    setPos(p);
    const a = (Object.keys(ARCHETYPES) as Archetype[]).find((x) => ARCHETYPES[x].positions[0] === p) ?? (Object.keys(ARCHETYPES) as Archetype[]).find((x) => ARCHETYPES[x].positions.includes(p))!;
    setArch(a);
    setHeight(POSITION_HEIGHT[p]);
    setWeight(Math.round(POSITION_HEIGHT[p] - 104 + (p === 'C' || p === 'PF' ? 10 : 0)));
    const sec: Record<Position, Position> = { PG: 'SG', SG: 'SF', SF: 'PF', PF: 'C', C: 'PF' };
    setPos2(sec[p]);
  };
  const choosePath = (p: StartPath) => {
    setPath(p);
    const [a0, a1] = START_PATHS[p].age;
    setAge(Math.min(a1, Math.max(a0, age)));
  };
  const valid = [firstName.trim().length >= 2 && lastName.trim().length >= 2, true, true, true];

  const create = async () => {
    if (!valid[0]) {
      setStep(0);
      app.toast('Indiquez un prénom et un nom (2 caractères minimum).');
      return;
    }
    setBusy(true);
    try {
      const c = createCareer({ firstName, lastName, nationality: nation, birthCity: city, age, heightCm: height, weightKg: weight, hand, number: num, pos, pos2, archetype: arch, appearance: app_, path });
      await saveSlot(slot, c, metaOf(c, slot, playerOvr(user(c)), userClub(c).name));
      await app.refreshSlots();
      app.setCareer(c, slot);
      app.go({ name: 'hub', tab: 'home' });
      app.toast(`Bienvenue à ${userClub(c).name} !`);
    } catch (e) {
      app.toast(`Création impossible : ${(e as Error).message}`);
      setBusy(false);
    }
  };

  const [h0, h1] = HEIGHT_RANGE[pos];
  return (
    <div className="screen-pad fade-in">
      <div className="row spread">
        <Logo compact />
        <button className="btn ghost" onClick={() => app.go({ name: 'home' })}>
          Annuler
        </button>
      </div>
      <div className="stepper" aria-hidden="true">
        {STEPS.map((s, i) => (
          <i key={s} className={i <= step ? 'on' : ''} />
        ))}
      </div>
      <div className="row spread wrap" style={{ marginBottom: 14 }}>
        <h2>
          {step + 1}. {STEPS[step]}
        </h2>
        <span className="muted small">Étape {step + 1} sur {STEPS.length}</span>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'start' }}>
        <div className="card">
          {step === 0 && (
            <div className="grid cols-2">
              <div className="field">
                <label htmlFor="fn">Prénom</label>
                <input id="fn" className="input" value={firstName} maxLength={20} onChange={(e) => setFirst(e.target.value)} placeholder="Ex. Lucas" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="ln">Nom</label>
                <input id="ln" className="input" value={lastName} maxLength={24} onChange={(e) => setLast(e.target.value)} placeholder="Ex. Moreau" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="nat">Nationalité</label>
                <select
                  id="nat"
                  className="input"
                  value={nation}
                  onChange={(e) => {
                    setNation(e.target.value);
                    setCity(NATIONS[e.target.value].cities[0]);
                  }}
                >
                  {Object.entries(NATIONS).map(([k, n]) => (
                    <option key={k} value={k}>
                      {n.flag} {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="city">Ville de naissance</label>
                <select id="city" className="input" value={city} onChange={(e) => setCity(e.target.value)}>
                  {NATIONS[nation].cities.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="num">Numéro préféré</label>
                <input id="num" className="input" type="number" min={0} max={99} value={num} onChange={(e) => setNum(Math.max(0, Math.min(99, Number(e.target.value) || 0)))} />
              </div>
              <div className="field">
                <label>Main dominante</label>
                <div className="seg">
                  <button aria-pressed={hand === 'R'} onClick={() => setHand('R')}>
                    Droitier
                  </button>
                  <button aria-pressed={hand === 'L'} onClick={() => setHand('L')}>
                    Gaucher
                  </button>
                </div>
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="grid">
              <div className="field">
                <label>Poste principal (définit la morphologie de base)</label>
                <div className="seg">
                  {POSITIONS.map((p) => (
                    <button key={p} aria-pressed={pos === p} onClick={() => setPosition(p)}>
                      {p} · {POSITION_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label htmlFor="h">
                  Taille : {height} cm <span className="muted">(plus grand : rebond et contres ; plus petit : vitesse et dribble)</span>
                </label>
                <input id="h" type="range" min={h0} max={h1} value={height} onChange={(e) => setHeight(Number(e.target.value))} />
              </div>
              <div className="field">
                <label htmlFor="w">
                  Poids : {weight} kg <span className="muted">(plus lourd : force ; plus léger : vitesse)</span>
                </label>
                <input id="w" type="range" min={Math.round(height - 125)} max={Math.round(height - 75)} value={weight} onChange={(e) => setWeight(Number(e.target.value))} />
              </div>
              <AppearanceEditor a={app_} set={setAppearance} />
            </div>
          )}
          {step === 2 && (
            <div className="grid">
              <div className="field">
                <label>Poste secondaire</label>
                <div className="seg">
                  {POSITIONS.filter((p) => p !== pos).map((p) => (
                    <button key={p} aria-pressed={pos2 === p} onClick={() => setPos2(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="field">
                <label>Profil de jeu</label>
                <div className="choice-grid">
                  {archs.map((a) => (
                    <button key={a} className="choice" aria-pressed={arch === a} onClick={() => setArch(a)}>
                      <b>{ARCHETYPES[a].label}</b>
                      <span className="muted small">{ARCHETYPES[a].desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid cols-2">
                <div>
                  <h3 style={{ marginBottom: 6 }}>Points forts</h3>
                  {sorted.slice(0, 5).map((k) => (
                    <div key={k} className="row spread small" style={{ padding: '3px 0' }}>
                      <span>{ATTR_LABELS[k]}</span>
                      <span className="pill green">▲</span>
                    </div>
                  ))}
                </div>
                <div>
                  <h3 style={{ marginBottom: 6 }}>Points faibles</h3>
                  {sorted.slice(-5).map((k) => (
                    <div key={k} className="row spread small" style={{ padding: '3px 0' }}>
                      <span>{ATTR_LABELS[k]}</span>
                      <span className="pill red">▼</span>
                    </div>
                  ))}
                </div>
              </div>
              <p className="muted small">Le profil influence les attributs initiaux, les axes de progression rapide et les décisions de l'IA quand vous êtes en mode assisté. Note de départ indicative : {overall(preview, pos)} (avant ajustements du parcours).</p>
            </div>
          )}
          {step === 3 && (
            <div className="grid">
              <div className="choice-grid">
                {(Object.keys(START_PATHS) as StartPath[]).map((p) => (
                  <button key={p} className="choice" aria-pressed={path === p} onClick={() => choosePath(p)}>
                    <b>{START_PATHS[p].label}</b>
                    <span className="muted small">{START_PATHS[p].desc}</span>
                    <span className="tiny muted">
                      Âge : {START_PATHS[p].age[0]}
                      {START_PATHS[p].age[1] !== START_PATHS[p].age[0] ? `–${START_PATHS[p].age[1]}` : ''} ans
                    </span>
                  </button>
                ))}
              </div>
              {pr.age[0] !== pr.age[1] && (
                <div className="field">
                  <label>Âge de départ</label>
                  <div className="seg">
                    {Array.from({ length: pr.age[1] - pr.age[0] + 1 }).map((_, i) => {
                      const a = pr.age[0] + i;
                      return (
                        <button key={a} aria-pressed={age === a} onClick={() => setAge(a)}>
                          {a} ans (né en {START_SEASON - a})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="field">
                <label htmlFor="slot">Emplacement de sauvegarde</label>
                <select id="slot" className="input" value={slot} onChange={(e) => setSlot(Number(e.target.value))}>
                  {Array.from({ length: SLOT_COUNT }).map((_, i) => (
                    <option key={i} value={i}>
                      Emplacement {i + 1} — {app.slots[i] ? `occupé par ${app.slots[i]!.name} (sera remplacé)` : 'libre'}
                    </option>
                  ))}
                </select>
                {app.slots[slot] && <span className="small" style={{ color: '#ff8d90' }}>Attention : cet emplacement contient déjà une carrière.</span>}
              </div>
            </div>
          )}
        </div>
        <aside className="card" style={{ width: 230 }} aria-label="Aperçu du joueur">
          <Portrait a={app_} colors={['#3988F5', '#F6F4EF']} number={num} size={198} />
          <div style={{ marginTop: 10, fontWeight: 800, fontSize: '1.1rem' }}>{firstName || 'Prénom'} {lastName || 'Nom'}</div>
          <div className="muted small">
            {NATIONS[nation].flag} {city} · {height} cm · {weight} kg
          </div>
          <div className="row wrap" style={{ marginTop: 8, gap: 6 }}>
            <span className="pill orange">{pos}</span>
            <span className="pill">{pos2}</span>
            <span className="pill blue">{ARCHETYPES[arch].label}</span>
          </div>
        </aside>
      </div>
      <div className="row spread" style={{ marginTop: 16 }}>
        <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)}>
          ← Retour
        </button>
        {step < STEPS.length - 1 ? (
          <button
            className="btn primary"
            onClick={() => {
              if (!valid[step]) {
                app.toast('Indiquez un prénom et un nom (2 caractères minimum).');
                return;
              }
              setStep(step + 1);
            }}
          >
            Continuer →
          </button>
        ) : (
          <button className="btn primary" disabled={busy} onClick={create}>
            {busy ? 'Création du monde…' : 'Commencer la carrière'}
          </button>
        )}
      </div>
      <style>{`@media (max-width: 760px){ .screen-pad .grid[style*="auto"]{ grid-template-columns: 1fr !important; } .screen-pad aside.card{ width:auto !important; display:grid; grid-template-columns: 110px 1fr; gap: 12px; align-items:center } .screen-pad aside.card svg{ width:110px; height:110px } }`}</style>
    </div>
  );
}

function AppearanceEditor({ a, set }: { a: Appearance; set: (a: Appearance) => void }) {
  const opt = (label: string, key: keyof Appearance, n: number, names?: string[]) => (
    <div className="field">
      <label>{label}</label>
      <div className="seg">
        {Array.from({ length: n }).map((_, i) => (
          <button key={i} aria-pressed={a[key] === i} onClick={() => set({ ...a, [key]: i })}>
            {names ? names[i] : i + 1}
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid cols-2">
      {opt('Teint', 'skin', 6)}
      {opt('Coiffure', 'hair', 6, ['Ras', 'Courte', 'Afro', 'Tresses', 'Chignon', 'Rasé'])}
      {opt('Couleur des cheveux', 'hairColor', 4, ['Noir', 'Brun', 'Châtain', 'Blond'])}
      {opt('Barbe', 'beard', 3, ['Aucune', 'Légère', 'Fournie'])}
      <div className="field">
        <label>Accessoires</label>
        <div className="seg">
          <button aria-pressed={a.headband} onClick={() => set({ ...a, headband: !a.headband })}>
            Bandeau
          </button>
          <button aria-pressed={a.sleeve} onClick={() => set({ ...a, sleeve: !a.sleeve })}>
            Manchon
          </button>
        </div>
      </div>
    </div>
  );
}
