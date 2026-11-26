import { getPrefs, initAudio, setPrefs, sfx } from '../audio/audio';
import { useRef, useState } from 'react';
import { Rng } from '../core/rng';
import { calendar, durationLabel, eraOf, LAB_LABELS, MIN_D } from '../sim/calendar';
import { districtName } from '../sim/city';
import { CAT_LABELS, remaining, requestFunds, spend, totalEnvelope, totalSpent } from '../sim/finance';
import { charges, found } from '../sim/knowledge';
import { MAG_LABEL, reopen } from '../sim/justice';
import { notify } from '../sim/log';
import { BUILDABLE, buildCost, canExtend, canPlaceFurniture, capacities, cutFor, demolish, extend, EXTENSIONS, furnAvailable, FURN_COST, FURN_LABEL, moveCost, moveRoom, placeRoom, refundValue, removeFurniture, roomArea, roomAvailable, ROOM_DEFS, ROOM_FURN, rotateFurniture, SHAPE_LABEL, type Shape } from '../sim/station';
import { fullName, load } from '../sim/staff';
import { BUDGET_CATS, type BudgetCat, type GameState } from '../sim/types';
import { placeStatus } from '../render/city-view';
import { vehicleURL } from '../render/art';
import { buyTech, owned, techAvailable, techCost, TECHS } from '../sim/tech';
import { renewVehicle, vehicleCost } from '../sim/sim';
import { economyMode, setEconomyMode } from '../render/engine';
import { downloadSave, saveSlot, SLOT_NAMES, SLOTS, type Slot } from '../save/save';
import { DECISION_LABEL, STATUS_LABEL, TYPE_LABEL } from './Cases';
import { Bar, eur, PanelShell, SortTable, Spark, Stat, useGame, when, day } from './common';
import { useEffect } from 'react';

export function Lab() {
  const [g, st] = useGame();
  const era = eraOf(calendar(st.startYear, st.minute).year);
  const cap = capacities(st);
  const techs = st.staff.filter((s) => s.role === 'technicien');
  const q = [...st.lab.queue].sort((a, b) => a.priority - b.priority || a.queuedAt - b.queuedAt);
  return (
    <PanelShell title="Laboratoire et police scientifique" wide>
      <div className="stat-grid">
        <Stat v={q.filter((j) => !j.external).length} l="Analyses internes en file" />
        <Stat v={q.filter((j) => j.external).length} l="Chez un prestataire" />
        <Stat v={cap.labBenches} l="Paillasses (capacité)" />
        <Stat v={techs.length} l="Techniciens" />
        <Stat v={st.lab.done} l="Analyses réalisées" />
        <Stat v={eur(remaining(st.budget, 'laboratoires'))} l="Crédits laboratoire restants" tone={remaining(st.budget, 'laboratoires') < 0 ? 'bad' : undefined} />
      </div>
      <h3>File d'attente</h3>
      <SortTable rows={q} rowKey={(j) => j.id} initial="prio" cols={[
        { key: 'prio', label: 'Prio.', get: (j) => j.priority, render: (j) => <span className={`tag p${j.priority}`}>{j.priority}</span> },
        { key: 'type', label: 'Examen', get: (j) => LAB_LABELS[j.type] },
        { key: 'case', label: 'Affaire', get: (j) => st.cases.find((c) => c.id === j.caseId)?.title ?? '', render: (j) => <button className="btn small" onClick={() => g.open({ id: 'case', arg: j.caseId, tab: 'pieces' })}>{st.cases.find((c) => c.id === j.caseId)?.number}</button> },
        { key: 'item', label: 'Pièce', get: (j) => st.cases.find((c) => c.id === j.caseId)?.items.find((i) => i.id === j.itemId)?.label ?? '' },
        { key: 'prog', label: 'Avancement', get: (j) => 1 - j.hoursLeft / j.hoursTotal, render: (j) => <Bar v={(1 - j.hoursLeft / j.hoursTotal) * 100} color="var(--violet)" /> },
        { key: 'left', label: 'Reste', get: (j) => j.hoursLeft, render: (j) => durationLabel(j.hoursLeft) },
        { key: 'ext', label: 'Lieu', get: (j) => (j.external ? 1 : 0), render: (j) => (j.external ? 'Extérieur' : <button className="btn small" title="Sous-traiter : plus cher mais hors file interne" onClick={() => g.mutate((x) => { j.external = true; spend(x, 'prestations', Math.round(j.cost * 0.8)); })}>Sous-traiter</button>) },
        { key: 'up', label: '', get: () => 0, render: (j) => <button className="btn small" onClick={() => g.mutate(() => { j.priority = Math.max(0, j.priority - 1); })}>▲ Prioriser</button> },
      ]} />
      <h3>Techniques disponibles ({era.label})</h3>
      <div className="tbl-wrap"><table className="t"><thead><tr><th>Examen</th><th>Disponible</th><th>Durée</th><th>Coût</th><th>Qualité</th></tr></thead><tbody>
        {Object.entries(era.lab).map(([k, v]) => <tr key={k}><td className="wide"><b>{LAB_LABELS[k as keyof typeof LAB_LABELS]}</b></td><td data-label="Disponible">{v.available ? 'Oui' : 'Non'}</td><td data-label="Durée">{v.available ? durationLabel(v.hours) : '—'}</td><td data-label="Coût">{v.available ? eur(v.cost) : '—'}</td><td data-label="Qualité">{v.available ? <Bar v={v.quality * 100} /> : '—'}</td></tr>)}
      </tbody></table></div>
      <p className="muted">Chaque paillasse traite une analyse à la fois, à condition qu'un technicien soit en service (au plus deux analyses suivies par technicien). Les résultats découlent des faits réels de l'affaire : une trace absente ne peut pas apparaître.</p>
    </PanelShell>
  );
}

export function Justice() {
  const [g, st] = useGame();
  const trans = st.cases.filter((c) => c.outcome && c.outcome.decision !== 'complement').sort((a, b) => b.outcome!.at - a.outcome!.at);
  return (
    <PanelShell title="Justice et partenaires" wide>
      <h3>Magistrats</h3>
      <div className="grid2">{st.magistrates.map((m) => <div className="card" key={m.id}><b>{m.prenom} {m.nom}</b><div className="muted">{MAG_LABEL[m.role]}</div><div className="skill"><span>Exigence de preuve</span><Bar v={m.rigueur * 100} color="var(--navy)" /><b /></div><div className="skill"><span>Délai de réponse</span><span>{Math.round(m.delai)} h en moyenne</span><b /></div><div className="skill"><span>Relation</span><Bar v={m.relation} /><b /></div></div>)}</div>
      <div className="card muted">Partenaires : médecins légistes et services d'expertise (via le laboratoire), gendarmerie (dossiers en zone rurale), services municipaux, centre hospitalier, services sociaux. Leurs décisions sont simulées de façon autonome. Le modèle judiciaire du jeu est simplifié et ne reproduit pas le droit réel.</div>
      <h3>Demandes en attente</h3>
      {st.requests.filter((r) => !r.answered).map((r) => <div key={r.id} className="row" style={{ fontSize: 13 }}>{r.kind === 'garde_a_vue' ? 'Garde à vue' : r.kind} — {st.people[r.target]?.prenom} {st.people[r.target]?.nom} — <button className="btn small" onClick={() => g.open({ id: 'case', arg: r.caseId, tab: 'justice' })}>{st.cases.find((c) => c.id === r.caseId)?.number}</button> réponse vers {when(st, r.answerAt)}</div>)}
      {!st.requests.some((r) => !r.answered) && <div className="muted">Aucune.</div>}
      <h3>Dossiers transmis et décisions</h3>
      <SortTable rows={trans} rowKey={(c) => c.id} onRow={(c) => g.open({ id: 'case', arg: c.id, tab: 'justice' })} initial="date" cols={[
        { key: 'date', label: 'Date', get: (c) => -c.outcome!.at, render: (c) => day(st, c.outcome!.at) },
        { key: 'title', label: 'Affaire', get: (c) => c.title },
        { key: 'dec', label: 'Décision du parquet', get: (c) => DECISION_LABEL[c.outcome!.decision] },
        { key: 'ver', label: 'Jugement', get: (c) => c.outcome!.verdict ?? '', render: (c) => (c.outcome!.verdict === 'condamnation' ? 'Culpabilité retenue' : c.outcome!.verdict === 'relaxe' ? 'Relaxe' : c.outcome!.decision === 'poursuites' ? 'En attente' : '—') },
        { key: 'q', label: 'Qualité', get: (c) => c.outcome!.quality },
      ]} />
    </PanelShell>
  );
}

export function Budget() {
  const [g, st] = useGame();
  const b = st.budget;
  const [cat, setCat] = useState<BudgetCat>('laboratoires');
  const [amount, setAmount] = useState(5000);
  const [reason, setReason] = useState('Hausse de l\'activité et délais d\'expertise');
  return (
    <PanelShell title={`Budget ${b.year}`} wide>
      <div className="stat-grid">
        <Stat v={eur(totalEnvelope(b))} l="Enveloppe de fonctionnement" />
        <Stat v={eur(totalSpent(b))} l="Dépensé" />
        <Stat v={eur(totalEnvelope(b) - totalSpent(b))} l="Disponible" tone={totalSpent(b) > totalEnvelope(b) ? 'bad' : 'good'} />
        <Stat v={eur(b.payroll)} l="Masse salariale annuelle (suivie séparément)" />
        <Stat v={eur(b.payrollPaid)} l="Salaires versés cette année" />
      </div>
      <div className="tbl-wrap" style={{ marginTop: 10 }}><table className="t"><thead><tr><th>Poste</th><th>Enveloppe</th><th>Dépensé</th><th>Disponible</th><th style={{ width: '30%' }}>Consommation</th></tr></thead><tbody>
        {BUDGET_CATS.map((k) => <tr key={k}><td className="wide"><b>{CAT_LABELS[k]}</b></td><td data-label="Enveloppe">{eur(b.envelope[k])}</td><td data-label="Dépensé">{eur(b.spent[k])}</td><td data-label="Disponible" style={{ color: remaining(b, k) < 0 ? 'var(--red)' : undefined }}>{eur(remaining(b, k))}</td><td data-label="Consommation"><Bar v={b.spent[k]} max={Math.max(1, b.envelope[k])} invert /></td></tr>)}
      </tbody></table></div>
      <div className="card" style={{ marginTop: 10 }}>
        <h3>Demander des moyens supplémentaires</h3>
        <div className="row">
          <select value={cat} onChange={(e) => setCat(e.target.value as BudgetCat)}>{BUDGET_CATS.map((k) => <option key={k} value={k}>{CAT_LABELS[k]}</option>)}</select>
          <input type="number" step={500} min={500} value={amount} onChange={(e) => setAmount(Math.max(500, Number(e.target.value)))} style={{ width: 100 }} /> €
          <input value={reason} onChange={(e) => setReason(e.target.value)} style={{ flex: 1, minWidth: 160 }} maxLength={80} />
          <button className="btn small primary" onClick={() => g.mutate((x) => { requestFunds(x, new Rng(x.minute), cat, amount, reason); notify(x, { level: 'info', text: `Demande de ${eur(amount)} transmise (${CAT_LABELS[cat]}).` }); })}>Transmettre</button>
        </div>
        <p className="muted">La décision dépend des besoins démontrés (charge de travail, consommation du poste, délais d'expertise) et du contexte budgétaire. Aucune récompense n'est versée par affaire : l'objectif est d'utiliser efficacement les moyens publics.</p>
        {b.requests.map((r) => <div key={r.id} style={{ fontSize: 13 }}>{when(st, r.sentAt).slice(0, 10)} — {CAT_LABELS[r.cat]} {eur(r.amount)} : {r.granted === null ? `réponse vers le ${day(st, r.answerAt)}` : r.granted ? `accordé ${eur(r.granted)}` : 'refusé'}</div>)}
      </div>
      {b.history.length > 0 && <div className="card"><h3>Exercices précédents</h3>{b.history.map((h) => <div key={h.year} style={{ fontSize: 13 }}>{h.year} : {eur(h.spent)} dépensés sur {eur(h.envelope)} ({Math.round((h.spent / h.envelope) * 100)} %) · salaires {eur(h.payroll)}</div>)}</div>}
    </PanelShell>
  );
}

export function Stats() {
  const [, st] = useGame();
  const closed = st.cases.filter((c) => c.outcome && c.outcome.decision !== 'complement');
  const durations = closed.map((c) => (c.outcome!.at - c.openedAt) / MIN_D).sort((a, b) => a - b);
  const median = durations.length ? durations[Math.floor(durations.length / 2)] : 0;
  const inv = st.staff.filter((s) => s.role === 'enqueteur' || s.role === 'officier');
  const nArch = st.counters.arch_n ?? 0;
  const quality = closed.length + nArch ? (closed.reduce((s, c) => s + c.outcome!.quality, 0) + (st.counters.arch_quality ?? 0)) / (closed.length + nArch) : 0;
  const correct = closed.filter((c) => c.outcome!.correct).length;
  const flaws = st.cases.reduce((s, c) => s + c.procedureFlaws, 0);
  const errors = st.staff.reduce((s, x) => s + x.history.filter((h) => h.kind === 'erreur').length, 0);
  const reopened = st.cases.filter((c) => c.reopenCount > 0).length;
  const labDone = st.lab.done;
  const s = st.stats.slice(-180);
  const conv = closed.filter((c) => c.outcome!.verdict === 'condamnation').length;
  const classes = closed.filter((c) => c.outcome!.decision.startsWith('classement')).length;
  const vUse = st.vehicles.filter((v) => v.busyUntil > st.minute).length;
  return (
    <PanelShell title="Statistiques" wide>
      <div className="stat-grid">
        <Stat v={st.cases.length + (st.counters.arch_n ?? 0)} l="Dossiers ouverts (total)" />
        <Stat v={closed.length + (st.counters.arch_n ?? 0)} l="Dossiers clôturés" />
        <Stat v={`${median.toFixed(1)} j`} l="Délai médian de traitement" />
        <Stat v={inv.length ? (inv.reduce((a, x) => a + load(x, st), 0) / inv.length).toFixed(1) : '—'} l="Charge moyenne par enquêteur" />
        <Stat v={`${Math.round(quality)}/100`} l="Qualité moyenne des dossiers" />
        <Stat v={reopened + (st.counters.arch_reopened ?? 0)} l="Affaires réouvertes" />
        <Stat v={closed.length + (st.counters.arch_n ?? 0) ? `${Math.round(((correct + (st.counters.arch_correct ?? 0)) / (closed.length + (st.counters.arch_n ?? 0))) * 100)} %` : '—'} l="Décisions conformes aux faits" tone="good" />
        <Stat v={`${conv + (st.counters.arch_conv ?? 0)} / ${classes + (st.counters.arch_class ?? 0)}`} l="Condamnations / classements" />
        <Stat v={flaws} l="Irrégularités de procédure" tone={flaws ? 'bad' : undefined} />
        <Stat v={errors} l="Erreurs identifiées (carrières)" />
        <Stat v={labDone} l="Expertises réalisées" />
        <Stat v={st.lab.queue.length} l="Expertises en attente" />
        <Stat v={st.reception.visitors ? `${Math.round((st.reception.satisfied / st.reception.visitors) * 100)} %` : '—'} l="Satisfaction à l'accueil" />
        <Stat v={`${Math.round(st.staff.reduce((a, x) => a + x.moral, 0) / st.staff.length)}`} l="Moral moyen" />
        <Stat v={`${Math.round(st.staff.reduce((a, x) => a + x.fatigue, 0) / st.staff.length)}`} l="Fatigue moyenne" />
        <Stat v={`${vUse}/${st.vehicles.length}`} l="Véhicules engagés" />
        <Stat v={`${Math.round((totalSpent(st.budget) / Math.max(1, totalEnvelope(st.budget))) * 100)} %`} l="Budget consommé" />
        <Stat v={Math.round(st.publicTrust)} l="Confiance du public" />
      </div>
      {(st.counters.arch_n ?? 0) > 0 && <p className="muted">Dont {st.counters.arch_n} dossiers de plus de cinq ans conservés au registre d'archives (statistiques uniquement).</p>}
      <p className="muted">Le jeu ne récompense pas le nombre d'interpellations : un classement fondé faute de preuves est une décision professionnelle appropriée.</p>
      <div className="grid2">
        <div><h3>Dossiers en cours</h3><Spark data={s.map((x) => x.open)} label="Dossiers en cours" /></div>
        <div><h3>Dossiers clôturés (cumul)</h3><Spark data={s.map((x) => x.closed)} color="var(--green)" /></div>
        <div><h3>Moral moyen</h3><Spark data={s.map((x) => x.moral)} color="var(--ochre)" /></div>
        <div><h3>Fatigue moyenne</h3><Spark data={s.map((x) => x.fatigue)} color="var(--red)" /></div>
        <div><h3>Analyses en attente</h3><Spark data={s.map((x) => x.labQueue)} color="var(--violet)" /></div>
        <div><h3>Dépenses cumulées</h3><Spark data={s.map((x) => x.spent)} color="var(--navy)" /></div>
      </div>
      <h3>Évaluations annuelles</h3>
      {st.hierarchy.evaluations.map((e) => <div key={e.year} className="card"><b>{e.year} : {e.note}/20</b> — {e.text}</div>)}
      {!st.hierarchy.evaluations.length && <div className="muted">Première évaluation au 1er janvier.</div>}
    </PanelShell>
  );
}

export function Archives() {
  const [g, st] = useGame();
  const [type, setType] = useState('');
  const [dec, setDec] = useState('');
  const rows = st.cases.filter((c) => c.status !== 'ouverte' && (!type || c.type === type) && (!dec || c.outcome?.decision === dec));
  return (
    <PanelShell title="Archives" wide>
      <div className="row" style={{ marginBottom: 8 }}>
        <select value={type} onChange={(e) => setType(e.target.value)}><option value="">Tous types</option>{Object.entries(TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select value={dec} onChange={(e) => setDec(e.target.value)}><option value="">Toutes décisions</option>{Object.entries(DECISION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </div>
      <SortTable rows={rows} rowKey={(c) => c.id} onRow={(c) => g.open({ id: 'case', arg: c.id })} initial="date" cols={[
        { key: 'date', label: 'Ouvert', get: (c) => -c.openedAt, render: (c) => day(st, c.openedAt) },
        { key: 'num', label: 'N°', get: (c) => c.number },
        { key: 'title', label: 'Affaire', get: (c) => c.title },
        { key: 'st', label: 'Statut', get: (c) => STATUS_LABEL[c.status] },
        { key: 'dec', label: 'Décision', get: (c) => (c.outcome ? DECISION_LABEL[c.outcome.decision] : '') },
        { key: 're', label: '', get: (c) => c.reopenCount, render: (c) => (c.status === 'classee' ? <button className="btn small" onClick={(e) => { e.stopPropagation(); g.mutate((x) => reopen(x, c, capacities(x).ancien ? 'réexamen méthodique par la cellule des affaires anciennes' : 'décision du commandant')); }}>Rouvrir</button> : '') },
      ]} />
      <p className="muted">Un dossier classé peut être rouvert si des éléments nouveaux apparaissent. Une cellule des affaires anciennes facilite ces réexamens.</p>
    </PanelShell>
  );
}

export function Media() {
  const [g, st] = useGame();
  const active = st.events.filter((e) => e.end > st.minute - 3 * MIN_D).reverse();
  return (
    <PanelShell title="Médias et événements" wide>
      <div className="stat-grid"><Stat v={Math.round(st.publicTrust)} l="Confiance du public (0-100)" /><Stat v={st.mediaRequests.filter((m) => !m.answered).length} l="Demandes de déclaration" /><Stat v={st.commander.reputation.toFixed(0)} l="Votre réputation" /></div>
      {st.mediaRequests.filter((m) => !m.answered).map((m) => <div key={m.id} className="card" style={{ background: '#fff3d6' }}>{m.outlet} demande une déclaration sur « {st.cases.find((c) => c.id === m.caseId)?.title} » avant le {when(st, m.until)}. <button className="btn small" onClick={() => g.open({ id: 'case', arg: m.caseId, tab: 'justice' })}>Répondre</button></div>)}
      <h3>Événements</h3>
      {active.map((e) => <div key={e.id} className="card"><b>{e.title}</b> <span className="muted">({day(st, e.start)} → {day(st, e.end)})</span><div>{e.text}</div></div>)}
      {!active.length && <div className="muted">Rien de particulier en ce moment.</div>}
      <h3>Revue de presse</h3>
      {[...st.articles].reverse().slice(0, 40).map((a) => <div key={a.id} className="card" style={{ borderLeft: `6px solid ${a.tone < -0.2 ? 'var(--red)' : a.tone > 0.2 ? 'var(--green)' : 'var(--line)'}` }}><div className="muted">{a.outlet} — {when(st, a.minute)}</div><b>{a.title}</b><div style={{ fontSize: 13 }}>{a.body}</div>{a.erroneous && !a.rectified && <span className="tag p1">Information erronée — à rectifier</span>}{a.caseId && <button className="btn small" style={{ marginLeft: 6 }} onClick={() => g.open({ id: 'case', arg: a.caseId!, tab: 'justice' })}>Dossier</button>}</div>)}
      <p className="muted">La communication institutionnelle distingue les faits confirmés des informations confidentielles et préserve la présomption d'innocence et la protection des victimes.</p>
    </PanelShell>
  );
}

export function Equipment() {
  const [g, st] = useGame();
  const year = calendar(st.startYear, st.minute).year;
  const era = eraOf(year);
  const cap = capacities(st);
  const [msg, setMsg] = useState('');
  const spec = (v: (typeof st.vehicles)[number]) => ({ body: '#' + v.color.toString(16).padStart(6, '0'), kind: (v.kind === 'fourgon' ? 'fourgon' : v.kind === 'technique' ? 'technique' : 'banalisee') as 'banalisee', police: true, era: v.year });
  return (
    <PanelShell title="Véhicules, technologies et équipements" wide>
      {msg && <div className="card" style={{ background: '#fff3d6' }}>{msg}</div>}
      <h3>Parc automobile</h3>
      <div className="grid2">
        {st.vehicles.map((v) => (
          <div className="card" key={v.id}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <img src={vehicleURL(spec(v))} alt="" style={{ width: 110, height: 82 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{v.label}</b><div className="muted">{v.model} — mis en service en {v.year} ({year - v.year} an{year - v.year > 1 ? 's' : ''})</div>
                <div>État<Bar v={v.condition} /></div>
                <div className="muted">{v.km.toLocaleString('fr-FR')} km · {v.busyUntil > st.minute ? `en mission jusqu'à ${when(st, v.busyUntil).slice(11)}` : 'disponible'}</div>
              </div>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small" disabled={v.condition > 90} onClick={() => g.mutate((x) => { spend(x, 'entretien', 450); v.condition = Math.min(100, v.condition + 35); })}>Entretien (450 €)</button>
              <button className="btn small" disabled={year - v.year < 3} onClick={() => { let t = ''; g.mutate((x) => { t = renewVehicle(x, new Rng(x.minute), v.id); }); setMsg(t); }}>Remplacer par un modèle {era.label.toLowerCase().replace('années', 'des années')} ({eur(vehicleCost(st, v.kind))})</button>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Acquérir un véhicule</h3>
        <p className="muted">Places de garage : {cap.garage} ({st.vehicles.length} occupées). Crédits véhicules : {eur(remaining(st.budget, 'vehicules'))}. Les modèles proposés et la livrée évoluent avec les décennies.</p>
        <div className="row">{era.vehicles.map((m, i) => (
          <button key={m} className="btn small" disabled={st.vehicles.length >= cap.garage} onClick={() => g.mutate((x) => { spend(x, 'vehicules', vehicleCost(x, i === 2 ? 'fourgon' : 'banalisee'), (n) => notify(x, n)); x.vehicles.push({ id: `V${++x.counters.vehicle}`, label: `${i === 2 ? 'Fourgon' : 'Véhicule'} ${x.vehicles.length + 1}`, model: m, kind: i === 2 ? 'fourgon' : 'banalisee', year, condition: 100, km: 0, busyUntil: 0, caseId: null, color: [0x6b7a8f, 0xe8e4da, 0x2f3a48, 0x7a2e2e][x.vehicles.length % 4] }); })}>
            <img src={vehicleURL({ body: '#e8e4da', kind: i === 2 ? 'fourgon' : 'banalisee', police: true, era: year })} alt="" style={{ width: 64, height: 48, verticalAlign: 'middle' }} /> {m} ({eur(vehicleCost(st, i === 2 ? 'fourgon' : 'banalisee'))})
          </button>
        ))}</div>
      </div>
      <h3>Technologies et méthodes</h3>
      <p className="muted">Les techniques de laboratoire progressent d'elles-mêmes avec les époques ; ces équipements s'achètent et accélèrent durablement certaines tâches. {era.label} — informatique : {era.computers === 'aucun' ? 'machines à écrire et fichiers papier' : era.computers === 'terminal' ? 'terminaux et Minitel' : era.computers === 'pc' ? 'premiers ordinateurs individuels' : era.computers === 'reseau' ? 'réseau informatique' : 'outils en ligne'} ; communications : {era.phone}.</p>
      <div className="grid2">
        {TECHS.map((t) => {
          const av = techAvailable(t, year), has = owned(st, t.id);
          return (
            <div className="card" key={t.id} style={{ opacity: av ? 1 : 0.55 }}>
              <div className="row between"><b>{t.label}</b><span className={`tag ${has ? 'fait' : av ? 'p2' : ''}`}>{has ? 'En service' : av ? 'Disponible' : `Dès ${t.year}`}</span></div>
              <div className="muted">{t.desc}</div>
              <div style={{ fontSize: 12 }}>{[...Object.entries(t.actions ?? {}).map(([k, m]) => `${ACTION_LABEL[k] ?? k} +${Math.round((m! - 1) * 100)} %`), ...Object.entries(t.lab ?? {}).map(([k, m]) => `${LAB_LABELS[k as keyof typeof LAB_LABELS]} +${Math.round((m! - 1) * 100)} %`), ...(t.wear ? [`usure des véhicules −${Math.round((1 - t.wear) * 100)} %`] : [])].join(' · ')}</div>
              {!has && <button className="btn small" disabled={!av} onClick={() => { let m = ''; g.mutate((x) => { m = buyTech(x, t.id); }); setMsg(m); }}>Acquérir ({eur(techCost(st, t))})</button>}
            </div>
          );
        })}
      </div>
      <div className="card">
        <h3>Petit matériel</h3>
        <div className="row">
          <button className="btn small" onClick={() => g.mutate((x) => { spend(x, 'equipements', 3000); for (const s of x.staff) s.moral = Math.min(100, s.moral + 2); notify(x, { level: 'succes', text: 'Renouvellement du petit matériel (radios, appareils photo, mallettes).' }); })}>Renouveler le petit matériel (3 000 €)</button>
          {era.computers !== 'aucun' && <button className="btn small" onClick={() => g.mutate((x) => { spend(x, 'informatique', 6000); for (const s of x.staff) if (s.skills.informatique < 14) s.skills.informatique++; notify(x, { level: 'succes', text: 'Postes informatiques modernisés.' }); })}>Moderniser les postes (6 000 €)</button>}
        </div>
      </div>
    </PanelShell>
  );
}

const ACTION_LABEL: Record<string, string> = { constatations: 'Constatations', voisinage: 'Voisinage', entretien: 'Entretiens', recherche: 'Recherches', requisition: 'Réquisitions', perquisition: 'Perquisitions', recoupement: 'Recoupements', audition: 'Auditions', rapport: 'Rédaction' };

export function Build() {
  const [g, st] = useGame();
  const [err, setErr] = useState('');
  const mode = g.buildMode;
  useEffect(() => {
    g.onBuildRect = (floor, x, y, w, h) => {
      if (g.buildMode?.kind !== 'room') return;
      const type = g.buildMode.type;
      const shape = g.buildMode.shape;
      const cost = buildCost(type, w, h, cutFor(shape, x, y, w, h));
      g.mutate((s) => {
        const r = placeRoom(s, type, floor, x, y, w, h, shape);
        if (r.ok) { spend(s, 'batiments', cost, (n) => notify(s, n)); notify(s, { level: 'info', text: `${r.msg} Coût : ${eur(cost)}. Livraison le ${day(s, r.room!.built)}.` }); }
        setErr(r.ok ? `${r.msg} (${eur(cost)})` : r.msg);
      });
    };
    g.onPlaceFurniture = (roomId, x, y) => {
      if (g.buildMode?.kind !== 'furniture') return;
      const kind = g.buildMode.fkind;
      g.mutate((s) => {
        const r = s.station.rooms.find((q) => q.id === roomId)!;
        const e = canPlaceFurniture(s.station, r, kind, x, y);
        if (e) { setErr(e); return; }
        r.furniture.push({ id: `F${Date.now()}`, kind, x, y, rot: 0 });
        spend(s, 'equipements', FURN_COST[kind] ?? 200);
        setErr(`${FURN_LABEL[kind]} installé (${eur(FURN_COST[kind] ?? 200)}).`);
      });
    };
    g.onMoveTo = (floor, x, y) => {
      if (g.buildMode?.kind !== 'move') return;
      const id = g.buildMode.roomId;
      g.mutate((s) => {
        const r = s.station.rooms.find((q) => q.id === id);
        if (!r) return;
        const cost = moveCost(r);
        const res = moveRoom(s, id, floor, x, y);
        if (res.ok) { spend(s, 'batiments', cost, (n) => notify(s, n)); g.setBuildMode(null); }
        setErr(res.ok ? `${res.msg} Coût : ${eur(cost)}.` : res.msg);
      });
      g.station?.setFloor(g.station.floor);
    };
    return () => { g.onBuildRect = undefined; g.onPlaceFurniture = undefined; g.onMoveTo = undefined; };
  }, [g]);
  const furnKinds = [...new Set(Object.values(ROOM_FURN).flat())] as string[];
  return (
    <>
      <div className="build-bar">
        <b>Construction</b>
        <select value={mode?.kind === 'room' ? `r:${mode.type}` : mode?.kind === 'furniture' ? `f:${mode.fkind}` : ''} onChange={(e) => {
          const v = e.target.value;
          if (!v) g.setBuildMode(null);
          else if (v.startsWith('r:')) g.setBuildMode({ kind: 'room', type: v.slice(2) as never, shape: mode?.kind === 'room' ? mode.shape : 'rect' });
          else g.setBuildMode({ kind: 'furniture', fkind: v.slice(2) });
        }}>
          <option value="">— Choisir —</option>
          <optgroup label="Pièces (tracez un rectangle sur le plan)">{BUILDABLE.filter((t) => roomAvailable(t, calendar(st.startYear, st.minute).year)).map((t) => <option key={t} value={`r:${t}`}>{ROOM_DEFS[t].label} — dès {eur(buildCost(t, 2, 2))}</option>)}</optgroup>
          <optgroup label="Mobilier et équipements (touchez une case libre)">{furnKinds.filter((k) => furnAvailable(k, calendar(st.startYear, st.minute).year)).map((k) => <option key={k} value={`f:${k}`}>{FURN_LABEL[k]} — {eur(FURN_COST[k] ?? 0)}</option>)}</optgroup>
        </select>
        {mode?.kind === 'room' && <select value={mode.shape ?? 'rect'} onChange={(e) => g.setBuildMode({ ...mode, shape: e.target.value as Shape })} aria-label="Forme de la pièce">{(Object.keys(SHAPE_LABEL) as Shape[]).map((k) => <option key={k} value={k}>{SHAPE_LABEL[k]}</option>)}</select>}
        {Array.from({ length: st.station.floors }, (_, f) => <button key={f} className={`btn small ${g.station?.floor === f ? 'navy' : ''}`} onClick={() => g.setFloor(f)}>{f === 0 ? 'RDC' : `Étage ${f}`}</button>)}
        {st.station.floors < 3 && <button className="btn small" onClick={() => g.mutate((s) => { spend(s, 'batiments', 60000, (n) => notify(s, n)); s.station.floors++; s.station.rooms.push({ id: `R${++s.counters.room}`, type: 'escalier', floor: s.station.floors - 1, x: 19, y: 0, w: 3, h: 6, doors: [{ x: 20, y: 5 }], furniture: [], built: s.minute + 60 * MIN_D }, { id: `R${++s.counters.room}`, type: 'couloir', floor: s.station.floors - 1, x: 0, y: 6, w: 22, h: 2, doors: [], furniture: [], built: s.minute + 60 * MIN_D }); notify(s, { level: 'info', text: 'Surélévation du bâtiment lancée (60 000 €, deux mois de travaux).' }); })}>Ajouter un étage (60 000 €)</button>}
        {EXTENSIONS.map((e) => <button key={e.id} className="btn small" disabled={!!canExtend(st.station, e.id)} title={canExtend(st.station, e.id) ?? ''} onClick={() => { if (!confirm(`${e.label} : acquisition et viabilisation du terrain pour ${eur(e.cost)} ?`)) return; g.mutate((s) => { spend(s, 'batiments', e.cost, (n) => notify(s, n)); extend(s.station, e.id); notify(s, { level: 'succes', text: `${e.label} : nouveau terrain constructible (${s.station.w} × ${s.station.h} cases).` }); }); g.station?.setFloor(g.station.floor); }}>{e.label} — {eur(e.cost)}</button>)}
        <button className="btn small" onClick={() => { g.setBuildMode(null); g.close(); }}>Terminer</button>
        <span className="muted" style={{ flexBasis: '100%' }}>{mode?.kind === 'move' ? `Déplacement : touchez le futur emplacement du coin nord de la pièce (changez d'étage si besoin). Coût : ${eur(moveCost(st.station.rooms.find((r) => r.id === mode.roomId)!))}.` : mode?.kind === 'room' ? `${ROOM_DEFS[mode.type].label} : ${ROOM_DEFS[mode.type].effect} Surface minimale ${ROOM_DEFS[mode.type].minArea} cases ; la porte est placée automatiquement côté couloir.${mode.shape && mode.shape !== 'rect' ? ' Forme en L : tracez le rectangle englobant (3 × 3 minimum), l\'angle choisi est retiré.' : ''}` : mode?.kind === 'furniture' ? 'Le mobilier ne doit ni bloquer une porte ni couper la circulation.' : 'Choisissez une pièce ou un meuble. Crédits bâtiments : ' + eur(remaining(st.budget, 'batiments'))}{err ? ` — ${err}` : ''}</span>
      </div>
    </>
  );
}

export function RoomInfo({ id }: { id: string }) {
  const [g, st] = useGame();
  const [msg, setMsg] = useState('');
  const r = st.station.rooms.find((x) => x.id === id);
  if (!r) return <PanelShell title="Pièce">Introuvable.</PanelShell>;
  const def = ROOM_DEFS[r.type];
  const here = st.staff.filter((s) => s.task?.room === r.type && !s.task.outside);
  return (
    <PanelShell title={def.label}>
      <p>{def.desc}</p>
      <p><b>Effet :</b> {def.effect}</p>
      <p className="muted">{r.cut ? 'Pièce en L' : `${r.w} × ${r.h} cases`} · {roomArea(r)} cases · {r.floor === 0 ? 'rez-de-chaussée' : `étage ${r.floor}`} · {r.furniture.length} meuble(s){r.built > st.minute ? ` · travaux jusqu'au ${day(st, r.built)}` : ''}</p>
      {msg && <p style={{ background: '#fff3d6', padding: 6, borderRadius: 6 }}>{msg}</p>}
      <div className="card"><h3>Présents</h3>{here.map((s) => <div key={s.id}><button className="btn small" onClick={() => g.open({ id: 'staff', arg: s.id })}>{fullName(s)}</button> <span className="muted">{s.task?.label}</span></div>)}{!here.length && <span className="muted">Personne.</span>}</div>
      {r.furniture.length > 0 && <div className="card"><h3>Mobilier</h3>
        {r.furniture.map((f) => <div key={f.id} className="row between" style={{ padding: '2px 0' }}><span>{FURN_LABEL[f.kind] ?? f.kind} <span className="muted">({f.x - r.x + 1}, {f.y - r.y + 1}){f.rot ? ' · tourné' : ''}</span></span><span className="row"><button className="btn small" onClick={() => { g.mutate((s) => rotateFurniture(s.station.rooms.find((x) => x.id === r.id)!, f.id)); g.station?.setFloor(g.station.floor); }} title="Tourner d'un quart de tour">↻ Tourner</button><button className="btn small" onClick={() => { let v = 0; g.mutate((s) => { v = removeFurniture(s, s.station.rooms.find((x) => x.id === r.id)!, f.id); }); setMsg(`Meuble retiré : ${eur(v)} récupérés (revente).`); g.station?.setFloor(g.station.floor); }}>Retirer (+{eur(Math.round((FURN_COST[f.kind] ?? 200) * 0.5))})</button></span></div>)}
      </div>}
      <div className="row">
        {!['couloir', 'escalier', 'accueil', 'garage'].includes(r.type) && <button className="btn small navy" onClick={() => { g.setBuildMode({ kind: 'move', roomId: r.id }); g.open({ id: 'build' }); }}>Déplacer… ({eur(moveCost(r))})</button>}
        {!['escalier', 'accueil'].includes(r.type) && <button className="btn small red" onClick={() => { if (!confirm(`Démolir cette pièce ? ${eur(refundValue(st, r))} seront reversés aux crédits de bâtiments.`)) return; let res = { ok: false, msg: '' }; g.mutate((s) => { res = demolish(s, r.id); }); if (res.ok) { g.say(res.msg); g.back(); } else setMsg(res.msg); }}>Démolir (remboursement {eur(refundValue(st, r))})</button>}
      </div>
    </PanelShell>
  );
}

export function PlaceInfo({ id }: { id: string }) {
  const [g, st] = useGame();
  const p = st.city.places.find((x) => x.id === id);
  if (!p) return <PanelShell title="Lieu">Introuvable.</PanelShell>;
  const cases = st.cases.filter((c) => c.placeId === p.id);
  const d = st.city.districts.find((x) => x.id === p.district);
  return (
    <PanelShell title={p.name}>
      <p>{districtName(st.city, p.district)} · {placeStatus(st, p)}</p>
      {d && <p className="muted">Quartier : {d.population.toLocaleString('fr-FR')} habitants (simulation agrégée).</p>}
      <div className="card"><h3>Affaires liées à ce lieu</h3>{cases.map((c) => <div key={c.id}><button className="btn small" onClick={() => g.open({ id: 'case', arg: c.id })}>{c.number} — {c.title}</button> <span className="muted">{STATUS_LABEL[c.status]}</span></div>)}{!cases.length && <span className="muted">Aucune.</span>}</div>
    </PanelShell>
  );
}

export function Search() {
  const [g, st] = useGame();
  const [q, setQ] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const n = q.trim().toLowerCase();
  const hit = (s: string) => n.length >= 2 && s.toLowerCase().includes(n);
  const people = Object.values(st.people).filter((p) => hit(`${p.prenom} ${p.nom} ${p.profession}`) && p.cases.some((cid) => st.cases.find((c) => c.id === cid)?.persons.find((x) => x.pid === p.id)?.known)).slice(0, 20);
  const staff = st.staff.filter((s) => hit(`${s.prenom} ${s.nom} ${s.grade}`));
  const places = st.city.places.filter((p) => hit(`${p.name} ${districtName(st.city, p.district)}`)).slice(0, 15);
  const cases = st.cases.filter((c) => hit(`${c.number} ${c.title} ${c.summary}`)).slice(0, 20);
  const docs = st.cases.flatMap((c) => found(c).filter((k) => hit(k.text)).map((k) => ({ c, k }))).slice(0, 25);
  return (
    <PanelShell title="Recherche globale">
      <input ref={ref} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Personne, lieu, dossier, document…" style={{ width: '100%', padding: 8, border: '2px solid var(--ink)', borderRadius: 8 }} />
      {n.length >= 2 && <>
        <h3>Dossiers ({cases.length})</h3>{cases.map((c) => <div key={c.id}><button className="btn small" onClick={() => g.open({ id: 'case', arg: c.id })}>{c.number} — {c.title}</button></div>)}
        <h3>Personnes ({people.length + staff.length})</h3>
        {staff.map((s) => <div key={s.id}><button className="btn small" onClick={() => g.open({ id: 'staff', arg: s.id })}>👮 {fullName(s)} — {s.grade}</button></div>)}
        {people.map((p) => <div key={p.id} className="row"><span>{p.prenom} {p.nom} ({p.profession})</span>{p.cases.map((cid) => <button key={cid} className="btn small" onClick={() => g.open({ id: 'case', arg: cid, tab: 'personnes' })}>{st.cases.find((c) => c.id === cid)?.number}</button>)}</div>)}
        <h3>Lieux ({places.length})</h3>{places.map((p) => <div key={p.id}><button className="btn small" onClick={() => g.open({ id: 'place', arg: p.id })}>{p.name}</button></div>)}
        <h3>Documents et informations ({docs.length})</h3>{docs.map(({ c, k }) => <div key={k.id} style={{ fontSize: 13, padding: '3px 0', cursor: 'pointer' }} onClick={() => g.open({ id: 'case', arg: c.id, tab: 'board' })}><span className={`tag ${k.nature}`}>{k.nature}</span> {k.text} <span className="muted">({c.number})</span></div>)}
      </>}
    </PanelShell>
  );
}

export function Settings({ onQuit }: { onQuit: () => void }) {
  const [g, st] = useGame();
  const [msg, setMsg] = useState('');
  return (
    <PanelShell title="Options et sauvegardes">
      <div className="card">
        <h3>Niveau d'assistance</h3>
        {([['manuel', 'Gestion entièrement manuelle', 'Vous attribuez les dossiers et ordonnez chaque action. L\'équipe vous signale quand elle attend des instructions.'], ['assiste', 'Supervision assistée', 'Les enquêteurs proposent des pistes que vous approuvez ou refusez.'], ['delegation', 'Délégation avancée', 'Votre adjoint attribue les dossiers ; les équipes décident, demandent les autorisations et transmettent elles-mêmes.']] as const).map(([k, l, d]) => (
          <label key={k} className="row" style={{ alignItems: 'flex-start', marginBottom: 6 }}><input type="radio" checked={st.settings.assist === k} onChange={() => g.mutate((s) => { s.settings.assist = k; })} /><span><b>{l}</b><br /><span className="muted">{d}</span></span></label>
        ))}
        <label className="row"><input type="checkbox" defaultChecked={economyMode()} onChange={(e) => { setEconomyMode(e.target.checked); setMsg('Réglage graphique enregistré : il s\'applique au prochain lancement du jeu.'); }} /> Mode économie graphique (téléphones modestes : moins de figurants, rendu allégé)</label>
        <label className="row"><input type="checkbox" defaultChecked={(() => { try { return localStorage.getItem('bct-fps') === '1'; } catch { return false; } })()} onChange={(e) => { try { localStorage.setItem('bct-fps', e.target.checked ? '1' : '0'); } catch { /* indisponible */ } g.bump(true); }} /> Afficher la fluidité (images par seconde) en bas de l'écran</label>
        <p className="muted" style={{ margin: '2px 0 6px' }}>Fluidité actuelle : <b>{Math.round(g.engine?.fps ?? 0)} images/s</b> — {g.engine?.quality === 'haute' ? 'qualité haute' : g.engine?.quality === 'reduite' ? 'résolution réduite automatiquement (l\'appareil saccadait)' : 'mode minimal automatique (moins de figurants)'}. Le jeu s'adapte seul si l'appareil peine.</p>
        <label className="row"><input type="checkbox" checked={st.settings.autoPause} onChange={(e) => g.mutate((s) => { s.settings.autoPause = e.target.checked; })} /> Pause automatique lors d'un événement urgent</label>
      </div>
      <AudioSettings />
      <div className="card">
        <h3>Sauvegardes</h3>
        <div className="row">{SLOTS.filter((s) => s !== 'auto').map((s) => <button key={s} className="btn small" onClick={async () => { try { await saveSlot(s as Slot, st); setMsg(`Partie enregistrée (${SLOT_NAMES[s as Slot]}).`); } catch (e) { setMsg(String(e)); } }}>Enregistrer : {SLOT_NAMES[s as Slot]}</button>)}</div>
        <div className="row" style={{ marginTop: 6 }}><button className="btn small" onClick={() => downloadSave(st)}>Exporter un fichier</button><button className="btn small" onClick={async () => { await g.autosave(); setMsg('Sauvegarde automatique mise à jour.'); }}>Sauvegarde automatique maintenant</button></div>
        {msg && <p className="muted">{msg}</p>}
        <p className="muted">La partie est aussi enregistrée automatiquement toutes les 90 secondes et en quittant.</p>
      </div>
      <div className="card">
        <h3>Partie</h3>
        <p style={{ fontSize: 13 }}>{st.commander.grade} {st.commander.prenom} {st.commander.nom} — {st.city.name} ({st.city.population.toLocaleString('fr-FR')} habitants) — graine {st.seed} — début {st.startYear}.</p>
        <p className="muted">Version {__APP_VERSION__} ({__APP_BUILD__}) · rendu {Math.round(g.engine?.fps ?? 0)} images/s.</p>
        <button className="btn red" onClick={onQuit}>Quitter vers l'écran titre</button>
      </div>
    </PanelShell>
  );
}

export function BoardIndex() {
  const [g, st] = useGame();
  const open = st.cases.filter((c) => c.status === 'ouverte');
  return (
    <PanelShell title="Tableaux d'enquête">
      <p className="muted">Choisissez un dossier pour ouvrir son tableau.</p>
      {open.map((c) => <div key={c.id} className="row between card"><span>{c.saga ? '🕯️ ' : ''}{c.title} <span className="muted">({found(c).length} informations, {c.persons.filter((p) => p.known).length} personnes)</span></span><button className="btn small" onClick={() => g.open({ id: 'case', arg: c.id, tab: 'board' })}>Ouvrir</button></div>)}
    </PanelShell>
  );
}

export function suspicionText(st: GameState, caseId: string, pid: string) {
  const c = st.cases.find((x) => x.id === caseId)!;
  return charges(c, pid).items.length;
}

function AudioSettings() {
  const [p, setP] = useState(getPrefs());
  const upd = (q: Partial<ReturnType<typeof getPrefs>>) => { initAudio(); setPrefs(q); setP(getPrefs()); };
  return (
    <div className="card">
      <h3>Son</h3>
      <label className="row"><input type="checkbox" checked={!p.muted} onChange={(e) => upd({ muted: !e.target.checked })} /> Son activé</label>
      {([['music', 'Musique d\'ambiance (instrumentation selon la décennie)'], ['ambience', 'Ambiance des lieux (bureaux, circulation)'], ['sfx', 'Effets (téléphone, sirène, tampon, notifications)']] as const).map(([k, l]) => (
        <label key={k} className="row between" style={{ padding: '2px 0' }}><span style={{ flex: 1, minWidth: 0 }}>{l}</span><input type="range" min={0} max={1} step={0.05} value={p[k]} onChange={(e) => upd({ [k]: Number(e.target.value) })} style={{ width: 130 }} /></label>
      ))}
      <div className="row"><button className="btn small" onClick={() => { initAudio(); sfx('phone'); }}>Tester : téléphone</button><button className="btn small" onClick={() => { initAudio(); sfx('siren'); }}>Sirène</button><button className="btn small" onClick={() => { initAudio(); sfx('type'); }}>Frappe</button></div>
    </div>
  );
}
