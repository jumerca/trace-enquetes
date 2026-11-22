import { useState } from 'react';
import {
  BUDGET_INFO, DIFFICULTY_INFO, RACE_LAPS, createCareer, type BudgetProfile, type Career, type Difficulty, type RaceLength,
} from '../../game/career';
import type { Emblem } from '../../game/data';
import { CarLivery, EmblemIcon, money } from '../common';
import { store } from '../App';

const PALETTE = ['#d62828', '#ff7a00', '#ffd400', '#06d6a0', '#1f9e89', '#3a86ff', '#1d3557', '#7b2cbf', '#ff5d8f', '#f4f1ea', '#8a8f99', '#232323'];
const EMBLEMS: Emblem[] = ['bouclier', 'cercle', 'etoile', 'chevron', 'eclair', 'couronne'];

export function NewCareer({ onCancel, onCreate }: { onCancel: () => void; onCreate: (c: Career, slot: number) => void }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [principal, setPrincipal] = useState('');
  const [base, setBase] = useState('');
  const [color, setColor] = useState('#3a86ff');
  const [color2, setColor2] = useState('#ffd400');
  const [emblem, setEmblem] = useState<Emblem>('bouclier');
  const [difficulty, setDifficulty] = useState<Difficulty>('normale');
  const [budget, setBudget] = useState<BudgetProfile>('equilibre');
  const [length, setLength] = useState<RaceLength>('standard');
  const slots = store.list();
  const [slot, setSlot] = useState(Math.max(0, slots.findIndex((s) => s.empty)));

  const nameOk = name.trim().length >= 3;
  const create = () => {
    if (!slots[slot].empty && !confirm(`L’emplacement ${slot + 1} contient déjà « ${slots[slot].teamName} ». L’écraser ?`)) return;
    const c = createCareer({ name, short: short || name.replace(/[^A-Za-zÀ-ÿ]/g, '').slice(0, 3), color, color2, emblem, base, principal, difficulty, budgetProfile: budget, raceLength: length });
    onCreate(c, slot);
  };

  return (
    <div className="page newcareer">
      <header className="pagehead">
        <button className="btn ghost" onClick={step ? () => setStep(step - 1) : onCancel}>← {step ? 'Retour' : 'Accueil'}</button>
        <h1>Nouvelle écurie</h1>
        <span className="steps">{['Identité', 'Ambitions', 'Confirmation'].map((s, i) => <i key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</i>)}</span>
      </header>

      {step === 0 && (
        <div className="grid2">
          <section className="panel">
            <h2>Identité</h2>
            <label>Nom de l’écurie<input value={name} maxLength={28} onChange={(e) => setName(e.target.value)} placeholder="ex. Dynastie Racing" autoFocus /></label>
            <div className="row">
              <label>Trigramme<input value={short} maxLength={3} onChange={(e) => setShort(e.target.value.toUpperCase())} placeholder="DYN" /></label>
              <label>Directeur·rice<input value={principal} maxLength={24} onChange={(e) => setPrincipal(e.target.value)} placeholder="Votre nom" /></label>
            </div>
            <label>Ville du siège<input value={base} maxLength={24} onChange={(e) => setBase(e.target.value)} placeholder="ex. Magny-les-Prés" /></label>
            <h3>Emblème</h3>
            <div className="choices emblems">
              {EMBLEMS.map((e) => (
                <button key={e} className={'chip' + (e === emblem ? ' on' : '')} onClick={() => setEmblem(e)} aria-label={e}>
                  <EmblemIcon emblem={e} color={color} color2={color2} size={34} />
                </button>
              ))}
            </div>
          </section>
          <section className="panel">
            <h2>Livrée</h2>
            <div className="livery-preview"><CarLivery color={color} color2={color2} width={300} /></div>
            <h3>Couleur principale</h3>
            <div className="choices swatches">
              {PALETTE.map((p) => <button key={p} className={'swatch' + (p === color ? ' on' : '')} style={{ background: p }} onClick={() => setColor(p)} aria-label={p} />)}
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Couleur principale libre" />
            </div>
            <h3>Couleur secondaire</h3>
            <div className="choices swatches">
              {PALETTE.map((p) => <button key={p} className={'swatch' + (p === color2 ? ' on' : '')} style={{ background: p }} onClick={() => setColor2(p)} aria-label={p} />)}
              <input type="color" value={color2} onChange={(e) => setColor2(e.target.value)} aria-label="Couleur secondaire libre" />
            </div>
          </section>
          <footer className="actions">
            <button className="btn primary big" disabled={!nameOk} onClick={() => setStep(1)}>Continuer →</button>
            {!nameOk && <small>Le nom doit comporter au moins 3 caractères.</small>}
          </footer>
        </div>
      )}

      {step === 1 && (
        <div className="grid2">
          <section className="panel">
            <h2>Difficulté</h2>
            {(Object.keys(DIFFICULTY_INFO) as Difficulty[]).map((d) => (
              <button key={d} className={'option' + (d === difficulty ? ' on' : '')} onClick={() => setDifficulty(d)}>
                <b>{DIFFICULTY_INFO[d].label}</b><span>{DIFFICULTY_INFO[d].text}</span>
              </button>
            ))}
            <h2>Durée des Grands Prix</h2>
            <div className="choices">
              {(Object.keys(RACE_LAPS) as RaceLength[]).map((l) => (
                <button key={l} className={'chip' + (l === length ? ' on' : '')} onClick={() => setLength(l)}>
                  {l === 'courte' ? 'Courte' : l === 'standard' ? 'Standard' : 'Longue'} · {RACE_LAPS[l]} tours
                </button>
              ))}
            </div>
            <small className="muted">Environ {RACE_LAPS[length] * 1.3 | 0} à {RACE_LAPS[length] * 1.6 | 0} minutes par course en vitesse ×1 (×2 et ×4 disponibles).</small>
          </section>
          <section className="panel">
            <h2>Budget de départ</h2>
            {(Object.keys(BUDGET_INFO) as BudgetProfile[]).map((b) => (
              <button key={b} className={'option' + (b === budget ? ' on' : '')} onClick={() => setBudget(b)}>
                <b>{BUDGET_INFO[b].label} — {money(BUDGET_INFO[b].amount * DIFFICULTY_INFO[difficulty].budget)}</b>
                <span>{BUDGET_INFO[b].text}</span>
              </button>
            ))}
          </section>
          <footer className="actions"><button className="btn primary big" onClick={() => setStep(2)}>Continuer →</button></footer>
        </div>
      )}

      {step === 2 && (
        <div className="grid2">
          <section className="panel summary">
            <div className="team-hero" style={{ ['--c1' as string]: color, ['--c2' as string]: color2 }}>
              <EmblemIcon emblem={emblem} color={color} color2={color2} size={64} />
              <div>
                <h2>{name}</h2>
                <p>{(short || name.slice(0, 3)).toUpperCase()} · {base || 'Atelier sans nom'} · {principal || 'Directeur'}</p>
              </div>
            </div>
            <CarLivery color={color} color2={color2} width={280} />
            <ul className="facts">
              <li>Difficulté : <b>{DIFFICULTY_INFO[difficulty].label}</b></li>
              <li>Budget : <b>{money(BUDGET_INFO[budget].amount * DIFFICULTY_INFO[difficulty].budget)}</b></li>
              <li>Grands Prix : <b>{RACE_LAPS[length]} tours</b></li>
              <li>Championnat : <b>10 écuries, 20 pilotes, 5 circuits</b></li>
            </ul>
          </section>
          <section className="panel">
            <h2>Emplacement de sauvegarde</h2>
            {slots.map((s) => (
              <button key={s.slot} className={'option' + (s.slot === slot ? ' on' : '')} onClick={() => setSlot(s.slot)}>
                <b>Emplacement {s.slot + 1}</b>
                <span>{s.empty ? 'Libre' : `Occupé : ${s.teamName ?? 'partie illisible'}`}</span>
              </button>
            ))}
            <p className="muted">Première mission : recruter deux pilotes et signer un sponsor depuis le QG.</p>
          </section>
          <footer className="actions"><button className="btn primary big" onClick={create}>Fonder l’écurie 🏁</button></footer>
        </div>
      )}
    </div>
  );
}
