// Écran « Réseau » : pilotage des antennes aux échelons supérieurs.
import { useState } from 'react';
import { Rng } from '../core/rng';
import { ANTENNES_BY_RANK, capacityOf, changeChief, detachTo, inspect, networkNote, PRIORITY_LABEL, recallFrom, setDotation, setPriority, type Priority } from '../sim/network';
import { LEVELS } from '../sim/career';
import { fullName } from '../sim/staff';
import { Bar, eur, PanelShell, Stat, useGame, when } from './common';

export function NetworkPanel() {
  const [g, st] = useGame();
  const [msg, setMsg] = useState('');
  const n = st.network;
  if (!n || !n.antennes.length) {
    const first = ANTENNES_BY_RANK.findIndex((x) => x > 0);
    return (
      <PanelShell title="Réseau d'antennes">
        <div className="card">
          <p>Le pilotage d'un réseau d'antennes commence à l'échelon « {LEVELS[first].title.replace('{ville}', st.city.name)} ».</p>
          <p className="muted">Vous y dirigerez {ANTENNES_BY_RANK[first]} antennes, puis davantage aux échelons suivants (jusqu'à {ANTENNES_BY_RANK[5]}). Consultez le menu Carrière pour voir les critères d'avancement.</p>
        </div>
      </PanelShell>
    );
  }
  const note = networkNote(st);
  const invs = st.staff.filter((s) => s.role === 'enqueteur' || s.role === 'officier');
  return (
    <PanelShell title="Réseau d'antennes" wide>
      <div className="stat-grid">
        <Stat v={n.antennes.length} l="Antennes rattachées" />
        <Stat v={n.antennes.reduce((s, a) => s + a.staff, 0)} l="Agents dans les antennes" />
        <Stat v={Math.round(n.antennes.reduce((s, a) => s + a.backlog, 0))} l="Dossiers en attente" />
        <Stat v={note !== null ? `${note}/20` : '—'} l="Note de gestion du réseau (30 % de l'évaluation)" />
        <Stat v={eur(n.antennes.reduce((s, a) => s + a.dotation, 0))} l="Dotations mensuelles" />
        <Stat v={st.counters.escalations ?? 0} l="Dossiers sensibles remontés" />
      </div>
      {msg && <div className="card" style={{ background: '#fff3d6' }}>{msg}</div>}
      {n.antennes.map((a) => {
        const cap = capacityOf(a);
        const trend = a.inflowPerDay > cap ? 'le stock augmente' : 'le stock diminue';
        return (
          <div className="card" key={a.id}>
            <div className="row between"><h3 style={{ margin: 0 }}>{a.name}</h3><span className="muted">{a.population.toLocaleString('fr-FR')} habitants</span></div>
            <div className="muted">Chef d'antenne : {a.chief.prenom} {a.chief.nom} (compétence {a.chief.skill}/20) · {a.staff} agents · priorité : {PRIORITY_LABEL[a.priority]}{a.inspectedAt ? ` · dernière inspection ${when(st, a.inspectedAt).slice(0, 10)}` : ''}</div>
            <div className="grid3" style={{ marginTop: 6 }}>
              <div>Qualité du travail<Bar v={a.quality * 100} /></div>
              <div>Moral<Bar v={a.moral} /></div>
              <div>Stock : <b>{Math.round(a.backlog)}</b> dossiers ({trend})<Bar v={a.backlog} max={Math.max(10, a.staff * 6)} invert /></div>
              <div>Entrées : {(a.inflowPerDay * 30).toFixed(0)} / mois</div>
              <div>Capacité : {(cap * 30).toFixed(0)} / mois</div>
              <div>Cette année : {Math.round(a.solvedYear)} traités sur {Math.round(a.receivedYear)} reçus</div>
            </div>
            <div className="row" style={{ marginTop: 8 }}>
              <label className="row">Dotation <input type="range" min={0} max={a.staff * 600} step={50} value={a.dotation} onChange={(e) => g.mutate((s) => setDotation(s, a.id, Number(e.target.value)))} /> {eur(a.dotation)}/mois</label>
              <select value={a.priority} onChange={(e) => g.mutate((s) => setPriority(s, a.id, e.target.value as Priority))}>{Object.entries(PRIORITY_LABEL).map(([k, l]) => <option key={k} value={k}>Priorité : {l}</option>)}</select>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small" onClick={() => { let t = ''; g.mutate((s) => { t = inspect(s, a.id); }); setMsg(t); }}>Inspection (1 500 €)</button>
              <select value="" onChange={(e) => { if (!e.target.value) return; let t = ''; g.mutate((s) => { t = detachTo(s, a.id, e.target.value); }); setMsg(t); }}>
                <option value="">Détacher un enquêteur du siège…</option>
                {invs.map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.grade})</option>)}
              </select>
              <button className="btn small" onClick={() => { let t = ''; g.mutate((s) => { t = recallFrom(s, new Rng(s.minute), a.id); }); setMsg(t); }}>Rappeler un agent au siège</button>
              <button className="btn small" onClick={() => { if (!confirm(`Remplacer le chef de ${a.name} ?`)) return; let t = ''; g.mutate((s) => { t = changeChief(s, new Rng(s.minute + 7), a.id); }); setMsg(t); }}>Remplacer le chef</button>
            </div>
            {a.history.length > 0 && <div className="muted" style={{ marginTop: 4 }}>Bilans : {a.history.slice(-4).map((h) => `${h.year} : ${h.solved}/${h.received} (stock ${h.backlog})`).join(' · ')}</div>}
          </div>
        );
      })}
      <div className="card"><h3>Journal du réseau</h3><div className="log">{[...n.log].reverse().slice(0, 30).map((l, i) => <div key={i}><time>{when(st, l.minute)}</time>{l.text}</div>)}</div></div>
      <p className="muted">Les antennes sont simulées de façon agrégée : leurs dossiers ne sont pas instruits un par un, sauf les dossiers sensibles qu'elles transmettent au siège.</p>
    </PanelShell>
  );
}
