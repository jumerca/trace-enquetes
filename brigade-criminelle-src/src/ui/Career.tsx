// Écran « Carrière » : poste actuel, critères d'avancement, propositions, parcours, époques.
import { useState } from 'react';
import { Rng } from '../core/rng';
import { calendar, eraOf, LAB_LABELS } from '../sim/calendar';
import { acceptInPlace, commanderAge, criteria, declineOffer, gradeFor, level, LEVELS, postTitle, RETIREMENT_AGE, yearsInPost } from '../sim/career';
import { SIZE_LABEL } from '../sim/city';
import { acceptMutation, returnToCity } from '../sim/sim';
import { loadCity, saveCity } from '../save/save';
import { Bar, PanelShell, Portrait, day, useGame, when } from './common';
import { AXIS_LABEL, decide, SUMMIT_RANK, setAxis, summitNote, type Axis } from '../sim/summit';
import { sfx } from '../audio/audio';

const ERAS = [1975, 1985, 1995, 2005, 2015, 2025];

export function Career() {
  const [g, st] = useGame();
  const [msg, setMsg] = useState('');
  const L = level(st);
  const year = calendar(st.startYear, st.minute).year;
  const crit = criteria(st);
  const offers = st.hierarchy.offers.filter((o) => !o.answered);
  const age = commanderAge(st);
  const evals = st.hierarchy.evaluations;
  const avg = evals.length ? evals.reduce((s, e) => s + e.note, 0) / evals.length : 0;
  return (
    <PanelShell title="Carrière" wide>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Portrait a={st.commander.appearance} sexe={st.commander.sexe} look="costume" size="lg" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>{st.commander.grade} {st.commander.prenom} {st.commander.nom}</h3>
            <div><b>{postTitle(st)}</b> — échelon {st.hierarchy.rank + 1}/{LEVELS.length}</div>
            <div className="muted">{L.desc}</div>
            <div className="muted">{age} ans · {Math.floor(yearsInPost(st) * 10) / 10} an(s) dans le poste · {year - st.startYear} an(s) de carrière simulée · retraite à {RETIREMENT_AGE} ans ({Math.max(0, RETIREMENT_AGE - age)} an(s) restant(s))</div>
            <div className="muted">Réputation {Math.round(st.commander.reputation)}/100 · moyenne des évaluations {avg ? avg.toFixed(1) : '—'}/20 · {st.city.name}, {st.city.population.toLocaleString('fr-FR')} habitants</div>
          </div>
        </div>
        {st.hierarchy.retired && <p style={{ background: '#fff3d6', padding: 8, borderRadius: 8 }}>🎖️ Vous avez pris votre retraite. La partie peut continuer à titre honoraire ; votre bilan de carrière figure ci-dessous.</p>}
      </div>

      {offers.map((o) => (
        <div className="card" key={o.id} style={{ background: '#fff3d6' }}>
          <h3>Proposition d'avancement</h3>
          <p style={{ margin: '4px 0' }}>{o.text}</p>
          <p className="muted">Nouveau poste : {LEVELS[o.toRank].desc} Réponse attendue avant le {day(st, o.expires)}.</p>
          <div className="row">
            {o.options.map((op, i) => op.kind === 'surplace'
              ? <button key={i} className="btn small green" onClick={() => { let t = ''; g.mutate((s) => { t = acceptInPlace(s, new Rng(s.minute), o.id); }); setMsg(t); }}>Accepter sur place ({st.city.name}, ressort élargi)</button>
              : op.kind === 'mutation'
                ? <button key={i} className="btn small navy" onClick={async () => { if (!confirm(`Accepter la mutation à ${op.city} ? Vous quitterez ${st.city.name} ; votre successeur reprendra la brigade et ses dossiers en cours.`)) return; try { await saveCity(st); } catch { /* archive facultative */ } const ns = acceptMutation(st, o.id); if (ns) g.replaceState(ns); }}>Accepter la mutation à {op.city} ({SIZE_LABEL[op.size].toLowerCase()})</button>
                : <button key={i} className="btn small navy" onClick={async () => { if (!confirm(`Revenir à ${op.city} avec ce nouveau grade ? Vous quitterez ${st.city.name}.`)) return; const old = await loadCity(op.city); try { await saveCity(st); } catch { /* archive facultative */ } const ns = returnToCity(st, o.id, old); if (ns) g.replaceState(ns); }}>Revenir à {op.city} (ancienne affectation)</button>)}
            <button className="btn small" onClick={() => { g.mutate((s) => declineOffer(s, o.id)); setMsg('Proposition déclinée.'); }}>Décliner</button>
          </div>
        </div>
      ))}
      {msg && <div className="card">{msg}</div>}

      {!st.hierarchy.retired && st.hierarchy.rank < LEVELS.length - 1 && (
        <div className="card">
          <h3>Vers l'échelon suivant : {gradeFor(st.hierarchy.rank + 1, year)}</h3>
          <p className="muted" style={{ marginTop: 0 }}>La direction examine votre dossier chaque 1er janvier. Tous les critères doivent être remplis.</p>
          {crit.map((c) => (
            <div key={c.label} className="skill" style={{ gridTemplateColumns: 'minmax(0, 1.4fr) 1fr auto' }}>
              <span>{c.ok ? '✅' : '⬜'} {c.label}</span>
              <Bar v={c.unit === 'au plus' ? Math.max(0, c.need - c.value) : c.value} max={c.unit === 'au plus' ? c.need : c.need} />
              <b style={{ whiteSpace: 'nowrap' }}>{c.unit === 'au plus' ? `${c.value} / ${c.need} max` : `${Math.round(c.value * 10) / 10} / ${c.need}${c.unit === 'ans' ? ' ans' : ''}`}</b>
            </div>
          ))}
        </div>
      )}

      <Summit />

      <div className="card">
        <h3>Échelons</h3>
        {LEVELS.map((l, i) => (
          <div key={i} style={{ padding: '4px 0', borderBottom: '1px dashed var(--line)', opacity: i > st.hierarchy.rank + 1 ? 0.6 : 1 }}>
            <b>{i === st.hierarchy.rank ? '▶ ' : i < st.hierarchy.rank ? '✓ ' : ''}{gradeFor(i, year)}</b> — {l.title.replace('{ville}', i <= st.hierarchy.rank ? st.city.name : 'la ville')}
            <div className="muted">Volume d'affaires ×{l.scale}, moyens ×{l.budget}, +{l.ceiling} postes{i < LEVELS.length - 1 ? ` · pour progresser : ${l.years} ans dans le poste, évaluations ≥ ${l.note}/20` : ''}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Parcours</h3>
        <div className="log">{[...st.hierarchy.career].reverse().map((c, i) => <div key={i}><time>{c.year}</time><b>{c.city}</b> — {c.text}</div>)}</div>
      </div>

      <div className="card">
        <h3>Évaluations annuelles</h3>
        {evals.length ? <div className="log">{[...evals].reverse().map((e) => <div key={e.year}><time>{e.year}</time><b>{e.note}/20</b> — {e.text}</div>)}</div> : <span className="muted">Première évaluation au 1er janvier.</span>}
      </div>

      <div className="card">
        <h3>Évolution des techniques par décennie</h3>
        {ERAS.map((y) => {
          const e = eraOf(y);
          const cur = eraOf(year).id === e.id;
          return (
            <div key={y} style={{ padding: '4px 0', borderBottom: '1px dashed var(--line)', fontWeight: cur ? 700 : 400 }}>
              {cur ? '▶ ' : ''}{e.label} — informatique : {e.computers === 'aucun' ? 'aucune' : e.computers === 'terminal' ? 'terminaux, Minitel' : e.computers === 'pc' ? 'premiers PC' : e.computers === 'reseau' ? 'réseau' : 'outils en ligne'} · {e.phone}
              <div className="muted" style={{ fontWeight: 400 }}>Laboratoire : {Object.entries(e.lab).filter(([, v]) => v.available).map(([k]) => LAB_LABELS[k as keyof typeof LAB_LABELS]).join(', ')}</div>
            </div>
          );
        })}
      </div>
    </PanelShell>
  );
}

/** Arbitrages nationaux : mécanique propre au sommet de la carrière. */
function Summit() {
  const [g, st] = useGame();
  const [msg, setMsg] = useState('');
  const s = st.summit;
  if (st.hierarchy.rank < SUMMIT_RANK || !s) {
    return (
      <div className="card">
        <h3>Pilotage national</h3>
        <p className="muted" style={{ margin: 0 }}>À partir de l'échelon « {LEVELS[SUMMIT_RANK].title} », vous arbitrerez les priorités nationales, les crises, les demandes du cabinet ministériel (fictif), les réformes et les nominations. Ces décisions compteront pour un quart de l'évaluation annuelle.</p>
      </div>
    );
  }
  const pending = s.dossiers.filter((d) => !d.answered);
  const note = summitNote(st);
  return (
    <div className="card">
      <h3>Pilotage national</h3>
      <div className="row" style={{ gap: 16 }}>
        <div style={{ minWidth: 200, flex: 1 }}>Confiance du ministère <Bar v={s.confidence} /></div>
        <div>Note de pilotage : <b>{note ?? '—'}/20</b> <span className="muted">(25 % de l'évaluation)</span></div>
      </div>
      <h4 style={{ marginBottom: 4 }}>Priorités nationales (répartition de l'effort)</h4>
      {(Object.keys(AXIS_LABEL) as Axis[]).map((a) => (
        <label key={a} className="row between" style={{ padding: '2px 0' }}>
          <span style={{ minWidth: 0, flex: 1 }}>{AXIS_LABEL[a]}</span>
          <input type="range" min={5} max={60} value={s.priorities[a]} onChange={(e) => g.mutate((x) => setAxis(x, a, Number(e.target.value)))} style={{ width: 140 }} />
          <b style={{ width: 42, textAlign: 'right' }}>{s.priorities[a]} %</b>
        </label>
      ))}
      <p className="muted" style={{ margin: '4px 0' }}>Un axe prioritaire fait remonter plus de dossiers de ce type et ses enquêtes avancent plus vite ; un équilibre trop rompu pèse sur la note.</p>
      {s.reforms.length > 0 && <p className="muted">Réformes adoptées : {s.reforms.join(', ').replace(/-/g, ' ')}.</p>}
      {msg && <p style={{ background: '#fff3d6', padding: 6, borderRadius: 6 }}>{msg}</p>}
      {pending.map((d) => (
        <div key={d.id} className="card" style={{ background: '#f6efe0' }}>
          <b>{d.kind === 'crise' ? '🚨' : d.kind === 'cabinet' ? '🏛️' : d.kind === 'reforme' ? '📜' : d.kind === 'nomination' ? '🎖️' : '💶'} {d.title}</b>
          <p style={{ margin: '4px 0' }}>{d.text}</p>
          <div className="muted">Décision attendue avant le {day(st, d.expires)}.</div>
          <div className="row" style={{ marginTop: 4 }}>{d.options.map((o, i) => <button key={i} className="btn small" onClick={() => { let t = ''; g.mutate((x) => { t = decide(x, d.id, i); }); sfx('stamp'); setMsg(t); }}>{o.label}</button>)}</div>
        </div>
      ))}
      {!pending.length && <p className="muted">Aucun arbitrage en attente. De nouveaux dossiers arrivent en début de mois.</p>}
      {s.log.length > 0 && <div className="log">{[...s.log].reverse().slice(0, 12).map((l, i) => <div key={i}><time>{when(st, l.minute)}</time>{l.text}</div>)}</div>}
    </div>
  );
}
