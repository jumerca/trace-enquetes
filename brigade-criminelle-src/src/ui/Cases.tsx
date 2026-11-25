import { useState } from 'react';
import { MIN_D, durationLabel, LAB_LABELS, calendar, eraOf } from '../sim/calendar';
import { districtName } from '../sim/city';
import { ACTIONS, availableActions, authGranted, authPending, planAction, pickExecutors, propose, requestAuth, roleLabel } from '../sim/investigation';
import { charges, contradictions, found, noCrimeWeight } from '../sim/knowledge';
import { dossierQuality, MAG_LABEL, transmit, type TransmitChoice } from '../sim/justice';
import { assignCase, investigators, suggestTeam } from '../sim/sim';
import { capacity, fullName, load } from '../sim/staff';
import { Rng } from '../core/rng';
import type { Case, CaseStage, GameState, PlannedAction } from '../sim/types';
import { Board } from './Board';
import { InterviewModal } from './Interview';
import { Bar, eur, PanelShell, Portrait, SortTable, Tabs, useGame, when } from './common';
import { makeStatement, type Statement } from '../sim/world';

export const TYPE_LABEL: Record<string, string> = {
  disparition: 'Disparition', vol: 'Vol', cambriolage: 'Cambriolage', escroquerie: 'Escroquerie', fraude_doc: 'Fraude documentaire', trafic_art: 'Trafic d\'œuvres d\'art', sabotage: 'Sabotage', extorsion: 'Extorsion', deces_suspect: 'Décès suspect', homicide: 'Homicide', financiere: 'Affaire financière', vol_vehicule: 'Vol de véhicule', numerique: 'Affaire numérique', ancien: 'Dossier ancien', fausse_declaration: 'Fausse déclaration',
};
export const STAGES: [CaseStage, string][] = [
  ['signalement', 'Signalement'], ['evaluation', 'Évaluation'], ['attribution', 'Attribution'], ['constatations', 'Constatations'], ['recherches', 'Recherches'], ['entretiens', 'Entretiens'], ['examens', 'Examens techniques'], ['relations', 'Relations'], ['hypotheses', 'Hypothèses'], ['coordination', 'Coordination judiciaire'], ['identification', 'Identification'], ['transmission', 'Transmission'], ['jugement', 'Décision judiciaire'], ['archive', 'Archivage'],
];
export const STATUS_LABEL: Record<Case['status'], string> = { ouverte: 'En cours', transmise: 'Transmise au parquet', classee: 'Classée', jugee: 'Jugée', suspendue: 'Suspendue' };
export const DECISION_LABEL: Record<string, string> = { poursuites: 'Poursuites engagées', classement_insuffisant: 'Classement — charges insuffisantes', classement_absence: 'Classement — absence d\'infraction', classement_inconnu: 'Classement — auteur inconnu', complement: 'Complément d\'enquête demandé' };

export function CasesList() {
  const [g, st] = useGame();
  const [filter, setFilter] = useState<'ouvertes' | 'urgentes' | 'sans' | 'propositions' | 'toutes'>('ouvertes');
  let rows = st.cases.filter((c) => c.status === 'ouverte' || filter === 'toutes');
  if (filter === 'urgentes') rows = rows.filter((c) => c.priority === 1);
  if (filter === 'sans') rows = rows.filter((c) => !c.lead);
  if (filter === 'propositions') rows = rows.filter((c) => c.actions.some((a) => !a.approved));
  return (
    <PanelShell title="Affaires" wide>
      <Tabs tabs={[['ouvertes', 'En cours'], ['urgentes', 'Urgentes'], ['sans', 'Non attribuées'], ['propositions', 'Propositions à valider'], ['toutes', 'Toutes']]} value={filter} onChange={setFilter} />
      <SortTable rows={rows} rowKey={(c) => c.id} onRow={(c) => g.open({ id: 'case', arg: c.id })} initial="prio" cols={[
        { key: 'prio', label: 'Prio.', get: (c) => c.priority, render: (c) => <span className={`tag p${c.priority}`}>{c.priority === 1 ? 'Haute' : c.priority === 2 ? 'Moyenne' : 'Basse'}</span> },
        { key: 'num', label: 'N°', get: (c) => c.number },
        { key: 'title', label: 'Affaire', get: (c) => c.title, render: (c) => <span>{c.saga ? '🕯️ ' : ''}{c.title}{c.reopenCount ? ' (rouverte)' : ''}</span> },
        { key: 'type', label: 'Type', get: (c) => TYPE_LABEL[c.type] },
        { key: 'lead', label: 'Responsable', get: (c) => (c.lead ? fullName(st.staff.find((s) => s.id === c.lead) ?? { prenom: '—', nom: '' }) : '— à attribuer —') },
        { key: 'stage', label: 'Étape', get: (c) => STAGES.findIndex((s) => s[0] === c.stage), render: (c) => STAGES.find((s) => s[0] === c.stage)?.[1] ?? c.stage },
        { key: 'info', label: 'Infos', get: (c) => found(c).length, render: (c) => `${found(c).length}` },
        { key: 'age', label: 'Ouverte depuis', get: (c) => st.minute - c.openedAt, render: (c) => durationLabel((st.minute - c.openedAt) / 60) },
        { key: 'prop', label: '', get: (c) => c.actions.filter((a) => !a.approved).length, render: (c) => (c.actions.some((a) => !a.approved) ? <span className="tag p2">{c.actions.filter((a) => !a.approved).length} prop.</span> : c.status !== 'ouverte' ? STATUS_LABEL[c.status] : '') },
      ]} />
    </PanelShell>
  );
}

export function CaseView({ id, tab: tab0 }: { id: string; tab?: string }) {
  const [g, st] = useGame();
  const c = st.cases.find((x) => x.id === id);
  const [tab, setTab] = useState<string>(tab0 ?? 'synthese');
  const [interview, setInterview] = useState<{ pid: string; custody: boolean } | null>(null);
  if (!c) return <PanelShell title="Affaire introuvable">Ce dossier n'existe plus.</PanelShell>;
  const place = st.city.places.find((p) => p.id === c.placeId);
  const proposals = c.actions.filter((a) => !a.approved).length;
  return (
    <PanelShell title={<>{c.saga ? '🕯️ ' : ''}{c.title}</>} wide>
      <div className="row" style={{ marginBottom: 6 }}>
        <span className={`tag p${c.priority}`}>Priorité {c.priority === 1 ? 'haute' : c.priority === 2 ? 'moyenne' : 'basse'}</span>
        <span className="tag">{TYPE_LABEL[c.type]}</span>
        <span className="tag">N° {c.number}</span>
        <span className="tag">{STATUS_LABEL[c.status]}</span>
        <span className="muted">{place?.name} — {districtName(st.city, c.district)}</span>
      </div>
      <div className="pipeline">{STAGES.map(([k, l], i) => { const cur = STAGES.findIndex((s) => s[0] === c.stage); return <span key={k} className={i < cur ? 'done' : i === cur ? 'cur' : ''}>{l}</span>; })}</div>
      <Tabs tabs={[['synthese', 'Synthèse'], ['actions', `Investigations${proposals ? ` (${proposals})` : ''}`], ['board', 'Tableau d\'enquête'], ['personnes', 'Personnes'], ['pieces', 'Pièces et analyses'], ['journal', 'Journal'], ['justice', 'Justice et médias']]} value={tab} onChange={setTab} />
      {tab === 'synthese' && <Synthese c={c} />}
      {tab === 'actions' && <Actions c={c} onInterview={(pid, custody) => setInterview({ pid, custody })} />}
      {tab === 'board' && <Board c={c} />}
      {tab === 'personnes' && <Persons c={c} onInterview={(pid, custody) => setInterview({ pid, custody })} />}
      {tab === 'pieces' && <Items c={c} />}
      {tab === 'journal' && <div className="log card">{[...c.done].reverse().map((d, i) => <div key={i}><time>{when(st, d.minute)}</time>{d.by && st.staff.find((s) => s.id === d.by) ? <b>{fullName(st.staff.find((s) => s.id === d.by)!)} : </b> : null}{d.text}</div>)}</div>}
      {tab === 'justice' && <JusticeTab c={c} />}
      {interview && <InterviewModal c={c} pid={interview.pid} custody={interview.custody} onClose={() => { setInterview(null); g.bump(true); }} />}
    </PanelShell>
  );
}

function Synthese({ c }: { c: Case }) {
  const [g, st] = useGame();
  const lead = st.staff.find((s) => s.id === c.lead);
  const invs = investigators(st).concat(st.staff.filter((s) => s.role === 'technicien'));
  const [sel, setSel] = useState<string[]>(c.team.length ? c.team : []);
  const [leadSel, setLeadSel] = useState<string>(c.lead ?? '');
  const sug = c.status === 'ouverte' ? suggestTeam(st, c) : null;
  const f = found(c);
  const ctr = contradictions(c);
  return (
    <>
      <div className="card">
        <h3>Signalement</h3>
        <p style={{ margin: '4px 0' }}>{c.summary}</p>
        <div className="muted">Ouvert le {when(st, c.openedAt)} · faits estimés le {when(st, c.factsAt)}{c.deadline ? ` · délai indicatif : ${when(st, c.deadline)}` : ''}</div>
        <div className="grid3" style={{ marginTop: 8 }}>
          <div>Complexité<br /><b>{'★'.repeat(c.complexity)}{'☆'.repeat(5 - c.complexity)}</b></div>
          <div>Urgence<Bar v={c.urgency * 100} invert /></div>
          <div>Intérêt médiatique<Bar v={c.mediaInterest * 100} invert /></div>
          <div>Charge estimée<br /><b>{Math.round(c.workload)} h</b></div>
          <div>Budget opérationnel<br /><b>{eur(c.budgetSpent)}</b> / {eur(c.budgetCap)}</div>
          <div>Informations recueillies<br /><b>{f.length}</b>{ctr.length ? <span className="tag p1" style={{ marginLeft: 6 }}>{ctr.length} contradiction(s)</span> : null}</div>
        </div>
      </div>
      {c.status === 'ouverte' && (
        <div className="card">
          <h3>Attribution du dossier</h3>
          {lead ? <p style={{ margin: '4px 0' }}>Responsable : <b>{fullName(lead)}</b> ({lead.grade}){c.team.length > 1 ? ` — équipe : ${c.team.filter((x) => x !== c.lead).map((x) => fullName(st.staff.find((s) => s.id === x)!)).join(', ')}` : ''}</p> : <p style={{ margin: '4px 0', color: 'var(--red)' }}>Ce dossier n'est pas encore attribué.</p>}
          {sug && <p className="muted">Suggestion de l'adjoint : {fullName(st.staff.find((s) => s.id === sug.lead)!)} avec {sug.team.map((x) => fullName(st.staff.find((s) => s.id === x)!)).join(', ') || 'personne d\'autre'}. <button className="btn small" onClick={() => { setLeadSel(sug.lead); setSel([sug.lead, ...sug.team]); }}>Reprendre</button></p>}
          <div className="tbl-wrap">
            <table className="t"><thead><tr><th>Resp.</th><th>Équipe</th><th>Nom</th><th>Spécialité</th><th>Charge</th><th>Fatigue</th><th>Disponibilité</th></tr></thead>
              <tbody>{invs.map((s) => {
                const l = load(s, st), cap = capacity(s);
                return (
                  <tr key={s.id}>
                    <td><input type="radio" name="lead" checked={leadSel === s.id} onChange={() => { setLeadSel(s.id); if (!sel.includes(s.id)) setSel([...sel, s.id]); }} disabled={s.role === 'technicien'} aria-label={`Responsable ${fullName(s)}`} /></td>
                    <td><input type="checkbox" checked={sel.includes(s.id)} onChange={(e) => setSel(e.target.checked ? [...sel, s.id] : sel.filter((x) => x !== s.id))} aria-label={`Équipe ${fullName(s)}`} /></td>
                    <td>{fullName(s)} <span className="muted">{s.grade}</span></td>
                    <td className="muted">{s.specialite}</td>
                    <td><Bar v={l} max={cap * 1.5} invert /> {l}/{cap.toFixed(1)}</td>
                    <td><Bar v={s.fatigue} invert /></td>
                    <td>{s.status === 'service' ? 'En service' : s.status}</td>
                  </tr>
                );
              })}</tbody></table>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn primary" disabled={!leadSel} onClick={() => { g.mutate((s) => assignCase(s, c, leadSel, sel)); g.say('Dossier attribué.'); }}>Valider l'attribution</button>
            <label className="row">Priorité <select value={c.priority} onChange={(e) => g.mutate(() => { c.priority = Number(e.target.value) as 1 | 2 | 3; })}><option value={1}>Haute</option><option value={2}>Moyenne</option><option value={3}>Basse</option></select></label>
            <label className="row">Budget plafond <input type="number" step={100} min={0} style={{ width: 90 }} value={c.budgetCap} onChange={(e) => g.mutate(() => { c.budgetCap = Math.max(0, Number(e.target.value)); })} /> €</label>
          </div>
        </div>
      )}
      {c.outcome && <div className="card"><h3>Décision</h3><p>{c.outcome.text}</p>{c.outcome.verdict && <p><b>Jugement : {c.outcome.verdict === 'condamnation' ? 'culpabilité retenue' : 'relaxe'}</b></p>}<div className="muted">Qualité du dossier : {c.outcome.quality}/100</div></div>}
      {c.status !== 'ouverte' && c.outcome?.verdict && (
        <div className="card"><h3>Ce qui s'est réellement passé</h3><p>{c.truth.summary}</p><div className="muted">La vérité d'une affaire n'est révélée qu'après la décision de justice.</div></div>
      )}
      {c.linkedCases.length > 0 && <div className="card"><h3>Dossiers liés par l'équipe</h3>{c.linkedCases.map((x) => { const o = st.cases.find((k) => k.id === x); return o ? <div key={x}><button className="btn small" onClick={() => g.open({ id: 'case', arg: x })}>{o.title}</button></div> : null; })}</div>}
    </>
  );
}

function actionLabel(st: GameState, a: PlannedAction) {
  const def = ACTIONS[a.kind];
  if (a.kind === 'labo') { const [itemId, t] = (a.target ?? '').split('|'); const it = st.cases.flatMap((c) => c.items).find((i) => i.id === itemId); return `${def.label} — ${LAB_LABELS[t as keyof typeof LAB_LABELS]} (${it?.label ?? ''})`; }
  return `${def.label}${a.target ? ` — ${st.people[a.target] ? `${st.people[a.target].prenom} ${st.people[a.target].nom}` : ''}` : ''}`;
}

function Actions({ c, onInterview }: { c: Case; onInterview: (pid: string, custody: boolean) => void }) {
  const [g, st] = useGame();
  const avail = availableActions(st, c);
  const team = c.team.length ? c.team : c.lead ? [c.lead] : [];
  const [who, setWho] = useState<string>('auto');
  const lead = st.staff.find((s) => s.id === c.lead);
  const ideas = lead && c.status === 'ouverte' ? propose(st, new Rng(st.minute + c.openedAt), c, lead).slice(0, 4) : [];
  const plan = (kind: PlannedAction['kind'], target?: string) => g.mutate((s) => {
    const by = who === 'auto' ? pickExecutors(s, c, kind) : [who];
    planAction(s, c, kind, target, by);
  });
  if (c.status !== 'ouverte') return <div className="card">Ce dossier n'est plus en cours d'investigation.</div>;
  if (!c.lead) return <div className="card">Attribuez d'abord le dossier à un responsable (onglet Synthèse).</div>;
  return (
    <>
      {c.actions.some((a) => !a.approved) && (
        <div className="card" style={{ background: '#fff3d6' }}>
          <h3>Propositions de l'équipe</h3>
          {c.actions.filter((a) => !a.approved).map((a) => {
            const def = ACTIONS[a.kind];
            const needAuth = def.auth && a.target && !authGranted(c, def.auth, a.target);
            return (
              <div key={a.id} className="row between" style={{ padding: '4px 0', borderBottom: '1px dashed var(--line)' }}>
                <span>{actionLabel(st, a)} <span className="muted">— proposé par {fullName(st.staff.find((s) => s.id === a.proposedBy) ?? { prenom: '?', nom: '' })}</span>{needAuth ? <span className="tag p2" style={{ marginLeft: 6 }}>autorisation nécessaire</span> : null}</span>
                <span className="row">
                  <button className="btn small green" onClick={() => g.mutate((s) => { a.approved = true; if (needAuth) requestAuth(s, new Rng(s.minute), c, def.auth!, a.target!); })}>{needAuth ? 'Approuver et demander' : 'Approuver'}</button>
                  <button className="btn small" onClick={() => g.mutate(() => { c.actions = c.actions.filter((x) => x !== a); })}>Refuser</button>
                </span>
              </div>
            );
          })}
          <button className="btn small green" style={{ marginTop: 6 }} onClick={() => g.mutate((s) => { for (const a of c.actions) if (!a.approved) { a.approved = true; const d = ACTIONS[a.kind]; if (d.auth && a.target && !authGranted(c, d.auth, a.target)) requestAuth(s, new Rng(s.minute), c, d.auth, a.target); } })}>Tout approuver</button>
        </div>
      )}
      <div className="card">
        <h3>Investigations en cours</h3>
        {!c.actions.filter((a) => a.approved).length && <div className="muted">Aucune action planifiée : l'équipe attend des instructions{st.settings.assist !== 'manuel' ? ' ou va en proposer' : ''}.</div>}
        {c.actions.filter((a) => a.approved).map((a) => {
          const def = ACTIONS[a.kind];
          const blocked = def.auth && a.target && !authGranted(c, def.auth, a.target);
          return (
            <div key={a.id} style={{ padding: '5px 0', borderBottom: '1px dashed var(--line)' }}>
              <div className="row between"><b>{actionLabel(st, a)}</b><button className="btn small" onClick={() => g.mutate(() => { c.actions = c.actions.filter((x) => x !== a); })}>Annuler</button></div>
              <div className="row"><span className="muted">{a.by.map((x) => fullName(st.staff.find((s) => s.id === x) ?? { prenom: '?', nom: '' })).join(', ')}</span><div style={{ flex: 1, minWidth: 80 }}><Bar v={(1 - a.hours / a.total) * 100} color="var(--blue)" /></div><span className="muted">{blocked ? (authPending(c, def.auth!, a.target!) ? 'en attente d\'autorisation' : 'autorisation refusée ou non demandée') : `reste ${durationLabel(Math.max(0, a.hours))} de travail`}</span></div>
            </div>
          );
        })}
      </div>
      {ideas.length > 0 && st.settings.assist !== 'delegation' && (
        <div className="card">
          <h3>Avis de {lead ? fullName(lead) : 'l\'équipe'}</h3>
          {ideas.map((p, i) => <div key={i} className="row between" style={{ padding: '3px 0' }}><span>💡 {p.reason}</span><button className="btn small" onClick={() => g.mutate((s) => { const a = planAction(s, c, p.kind, p.target, pickExecutors(s, c, p.kind)); if (a && p.auth && p.target && !authGranted(c, p.auth, p.target)) requestAuth(s, new Rng(s.minute), c, p.auth, p.target); })}>Retenir</button></div>)}
          <div className="muted">Les enquêteurs compétents proposent généralement de meilleures pistes, sans être infaillibles.</div>
        </div>
      )}
      <div className="card">
        <h3>Ordonner une action</h3>
        <label className="row" style={{ marginBottom: 6 }}>Exécutant : <select value={who} onChange={(e) => setWho(e.target.value)}><option value="auto">Le plus compétent de l'équipe</option>{team.map((id) => <option key={id} value={id}>{fullName(st.staff.find((s) => s.id === id)!)}</option>)}</select></label>
        {avail.map((a, i) => {
          const planned = c.actions.some((x) => x.kind === a.kind && x.target === a.target);
          const def = ACTIONS[a.kind];
          const isPerson = def.target === 'person' && a.target;
          return (
            <div key={i} className="row between" style={{ padding: '3px 0', borderBottom: '1px dashed var(--line)' }}>
              <span>{a.label} <span className="muted">({durationLabel(def.hours)}{def.cost ? `, ${def.cost} €` : ''})</span>{a.blocked ? <span className="tag" style={{ marginLeft: 6 }}>{a.blocked}</span> : null}</span>
              <span className="row">
                {a.kind === 'entretien' && isPerson && <button className="btn small navy" onClick={() => onInterview(a.target!, false)}>Mener l'entretien</button>}
                {a.kind === 'audition' && isPerson && authGranted(c, 'garde_a_vue', a.target!) && <button className="btn small navy" onClick={() => onInterview(a.target!, true)}>Mener l'audition</button>}
                {a.blocked === 'Autorisation judiciaire requise' && <button className="btn small" onClick={() => g.mutate((s) => requestAuth(s, new Rng(s.minute), c, def.auth!, a.target!))}>Demander</button>}
                <button className="btn small" disabled={planned || (!!a.blocked && a.blocked !== 'Autorisation demandée')} onClick={() => plan(a.kind, a.target)}>{planned ? 'Planifiée' : 'Confier'}</button>
              </span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Persons({ c, onInterview }: { c: Case; onInterview: (pid: string, custody: boolean) => void }) {
  const [g, st] = useGame();
  return (
    <>
      {c.persons.filter((p) => p.known).map((p) => {
        const per = st.people[p.pid];
        const ch = charges(c, p.pid);
        const statements = found(c).filter((k) => k.personId === p.pid);
        return (
          <div className="card" key={p.pid}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Portrait a={per.appearance} sexe={per.sexe} />
              <div style={{ flex: 1 }}>
                <b>{per.prenom} {per.nom}</b> — {roleLabel(p.role)}{p.cleared ? <span className="tag fait" style={{ marginLeft: 6 }}>disculpé·e par les vérifications</span> : null}
                <div className="muted">{per.age} ans, {per.profession}{per.record ? ' — antécédents judiciaires (sans valeur de preuve)' : ''}</div>
                <div className="muted">Entendu·e {p.interviewed} fois{p.lawyer ? ' · assisté·e d\'un avocat' : ''}{p.silent ? ' · a fait usage du droit de se taire' : ''}{p.inCustody ? ' · en garde à vue' : ''}</div>
                {ch.items.length > 0 && <div style={{ fontSize: 13, marginTop: 4 }}>Éléments à charge connus : {ch.items.length}{ch.confession ? ' (dont des aveux, insuffisants seuls)' : ''}</div>}
                {statements.length > 0 && <ul style={{ margin: '4px 0', paddingLeft: 18, fontSize: 13 }}>{statements.map((k) => <li key={k.id}><span className={`tag ${k.nature}`}>{k.nature}</span> {k.text}</li>)}</ul>}
              </div>
            </div>
            {c.status === 'ouverte' && c.lead && <div className="row" style={{ marginTop: 6 }}>
              <button className="btn small navy" onClick={() => onInterview(p.pid, false)}>Mener un entretien</button>
              {(p.role === 'suspect' || p.role === 'declarant') && (authGranted(c, 'garde_a_vue', p.pid) ? <button className="btn small red" onClick={() => onInterview(p.pid, true)}>Audition en garde à vue</button> : <button className="btn small" disabled={authPending(c, 'garde_a_vue', p.pid)} onClick={() => g.mutate((s) => requestAuth(s, new Rng(s.minute), c, 'garde_a_vue', p.pid))}>{authPending(c, 'garde_a_vue', p.pid) ? 'Garde à vue demandée' : 'Demander une garde à vue'}</button>)}
              <button className="btn small" onClick={() => g.mutate(() => { p.cleared = !p.cleared; })}>{p.cleared ? 'Rétablir comme piste' : 'Écarter cette piste'}</button>
            </div>}
          </div>
        );
      })}
      <div className="muted">La nervosité d'une personne n'est pas un indice de culpabilité. Seuls les faits vérifiés font foi.</div>
    </>
  );
}

function Items({ c }: { c: Case }) {
  const [g, st] = useGame();
  const era = eraOf(calendar(st.startYear, st.minute).year);
  const items = c.items.filter((i) => i.collected);
  const jobs = st.lab.queue.filter((j) => j.caseId === c.id);
  return (
    <>
      {!items.length && <div className="card muted">Aucune pièce saisie pour l'instant. Les constatations et perquisitions permettent d'en recueillir.</div>}
      {items.map((it) => (
        <div className="card" key={it.id}>
          <div className="row between"><b>🧾 {it.label}</b><span className={`tag ${it.sealed ? 'fait' : 'p1'}`}>{it.sealed ? 'Scellé conforme' : 'Scellé non conforme'}</span></div>
          <div className="muted">Emplacement : {it.location === 'salle_preuves' ? 'salle sécurisée des pièces à conviction' : it.location === 'labo' ? 'laboratoire' : it.location}</div>
          <details><summary className="muted">Traçabilité ({it.chain.length} mouvements)</summary><div className="log">{it.chain.map((x, i) => <div key={i}><time>{when(st, x.minute)}</time>{x.text}</div>)}</div></details>
          {c.status === 'ouverte' && <div className="row" style={{ marginTop: 6 }}>{it.labTypes.map((t) => {
            const av = era.lab[t];
            const queued = jobs.some((j) => j.itemId === it.id && j.type === t);
            return (
              <span key={t} className="row" style={{ gap: 4 }}>
                <button className="btn small" disabled={!av.available || queued || !c.lead} title={av.available ? `${durationLabel(av.hours)}, ${av.cost} €` : 'Technique indisponible à cette époque'} onClick={() => g.mutate((s) => planAction(s, c, 'labo', `${it.id}|${t}`, pickExecutors(s, c, 'labo')))}>{LAB_LABELS[t]}{av.available ? ` (${av.cost} €)` : ' — indisponible'}</button>
              </span>
            );
          })}</div>}
        </div>
      ))}
      {jobs.length > 0 && <div className="card"><h3>Analyses en cours</h3>{jobs.map((j) => <div key={j.id} className="row"><span style={{ flex: 1 }}>{LAB_LABELS[j.type]} {j.external ? '(prestataire extérieur)' : ''}</span><div style={{ width: 120 }}><Bar v={(1 - j.hoursLeft / j.hoursTotal) * 100} color="var(--violet)" /></div></div>)}</div>}
      <div className="card"><h3>Résultats d'analyse</h3>{found(c).filter((k) => k.action === 'labo').map((k) => <div key={k.id} style={{ fontSize: 13, padding: '3px 0' }}><span className="tag analyse">analyse</span> {k.text}</div>)}{!found(c).some((k) => k.action === 'labo') && <span className="muted">Aucun résultat exploitable pour l'instant.</span>}</div>
    </>
  );
}

function JusticeTab({ c }: { c: Case }) {
  const [g, st] = useGame();
  const [choice, setChoice] = useState<string>('');
  const [msg, setMsg] = useState('');
  const persons = c.persons.filter((p) => p.known && p.role !== 'victime' && p.role !== 'disparu' && p.role !== 'temoin');
  const proc = st.magistrates.find((m) => m.role === 'procureur');
  const nc = noCrimeWeight(c);
  const reqs = st.requests.filter((r) => r.caseId === c.id);
  const statement = (k: Statement) => { let out = ''; g.mutate((s) => { out = makeStatement(s, new Rng(s.minute), c, k); }); setMsg(out); };
  return (
    <>
      <div className="card">
        <h3>Autorisations</h3>
        {!c.auths.length && <div className="muted">Aucune demande.</div>}
        {c.auths.map((a, i) => <div key={i} style={{ fontSize: 13 }}>{a.kind === 'garde_a_vue' ? 'Garde à vue' : a.kind === 'perquisition' ? 'Perquisition' : 'Réquisition'} — {st.people[a.target]?.prenom} {st.people[a.target]?.nom} : <b>{a.granted === null ? 'en attente' : a.granted ? 'accordée' : 'refusée'}</b> <span className="muted">({when(st, a.at)})</span></div>)}
        {reqs.filter((r) => !r.answered).length > 0 && <div className="muted">Réponse attendue vers {when(st, Math.min(...reqs.filter((r) => !r.answered).map((r) => r.answerAt)))}.</div>}
      </div>
      {c.status === 'ouverte' && (
        <div className="card">
          <h3>Transmission au parquet</h3>
          {proc && <div className="muted">{MAG_LABEL.procureur} : {proc.prenom} {proc.nom} — {proc.rigueur > 0.65 ? 'très exigeant·e sur les preuves' : proc.rigueur > 0.45 ? 'exigeant·e' : 'pragmatique'}.</div>}
          {c.stage !== 'transmission' && <p className="muted">Il est préférable de faire rédiger le rapport de synthèse avant la transmission (meilleure qualité du dossier).</p>}
          <p style={{ fontSize: 13 }}>Qualité actuelle estimée du dossier : <b>{dossierQuality(st, c)}/100</b>. Éléments en faveur de l'absence d'infraction : {nc > 0 ? <b>{nc}</b> : 'aucun'}.</p>
          <div style={{ display: 'grid', gap: 4 }}>
            {persons.map((p) => {
              const ch = charges(c, p.pid);
              return <label key={p.pid} className="row"><input type="radio" name="tr" checked={choice === p.pid} onChange={() => setChoice(p.pid)} /> Désigner <b>{st.people[p.pid].prenom} {st.people[p.pid].nom}</b> comme auteur présumé <span className="muted">({ch.items.length} élément(s) à charge{ch.exculpated ? ', élément disculpant connu !' : ''})</span></label>;
            })}
            <label className="row"><input type="radio" name="tr" checked={choice === 'classement_absence'} onChange={() => setChoice('classement_absence')} /> Proposer un classement : absence d'infraction (accident, départ volontaire, cause naturelle…)</label>
            <label className="row"><input type="radio" name="tr" checked={choice === 'classement_insuffisant'} onChange={() => setChoice('classement_insuffisant')} /> Proposer un classement : charges insuffisantes</label>
            <label className="row"><input type="radio" name="tr" checked={choice === 'classement_inconnu'} onChange={() => setChoice('classement_inconnu')} /> Proposer un classement : auteur non identifié</label>
          </div>
          <button className="btn primary" style={{ marginTop: 8 }} disabled={!choice} onClick={() => {
            const ch: TransmitChoice = choice.startsWith('classement') ? { kind: choice as 'classement_absence' } : { kind: 'poursuites', pid: choice };
            let text = '';
            g.mutate((s) => { text = transmit(s, null, c, ch).text; });
            setMsg(text);
          }}>Transmettre au parquet</button>
          <p className="muted">Un classement faute de preuves peut être une décision professionnelle appropriée. Les aveux seuls ne suffisent jamais.</p>
        </div>
      )}
      {c.outcome && <div className="card"><h3>Décision du parquet</h3><p>{c.outcome.text}</p>{c.outcome.verdict && <p>Jugement : <b>{c.outcome.verdict === 'condamnation' ? 'culpabilité retenue' : 'relaxe'}</b> ({when(st, c.outcome.verdictAt!)})</p>}{c.outcome.decision === 'poursuites' && !c.outcome.verdict && <p className="muted">Audience prévue dans les prochaines semaines.</p>}</div>}
      <div className="card">
        <h3>Communication</h3>
        <div className="row">
          <button className="btn small" onClick={() => statement('faits')}>Communiqué : faits confirmés</button>
          <button className="btn small" onClick={() => statement('appel_temoins')}>Appel à témoins</button>
          <button className="btn small" onClick={() => statement('rectification')}>Rectifier une information erronée</button>
          <button className="btn small red" onClick={() => { if (confirm('Communiquer le nom d\'une personne mise en cause porte atteinte à la présomption d\'innocence. Continuer ?')) statement('nommer'); }}>Citer un nom à la presse…</button>
        </div>
        {st.articles.filter((a) => a.caseId === c.id).slice(-6).reverse().map((a) => <div key={a.id} style={{ fontSize: 13, padding: '4px 0', borderTop: '1px dashed var(--line)' }}><b>{a.outlet}</b> — « {a.title} » {a.erroneous && !a.rectified ? <span className="tag p1">information erronée</span> : null}<div className="muted">{a.body}</div></div>)}
      </div>
      {msg && <div className="card" style={{ background: '#fff3d6' }}>{msg}</div>}
      <div className="card"><h3>Lier à un autre dossier</h3>
        <select value="" onChange={(e) => { const o = st.cases.find((x) => x.id === e.target.value); if (o) g.mutate(() => { if (!c.linkedCases.includes(o.id)) c.linkedCases.push(o.id); if (!o.linkedCases.includes(c.id)) o.linkedCases.push(c.id); }); }}>
          <option value="">Choisir un dossier…</option>
          {st.cases.filter((x) => x.id !== c.id && (x.status === 'ouverte' || st.minute - x.openedAt < 120 * MIN_D)).map((x) => <option key={x.id} value={x.id}>{x.number} — {x.title}</option>)}
        </select>
        {c.linkedCases.length > 0 && <div className="row" style={{ marginTop: 6 }}>{c.linkedCases.map((x) => <button key={x} className="btn small" onClick={() => g.mutate(() => { c.linkedCases = c.linkedCases.filter((y) => y !== x); const o = st.cases.find((k) => k.id === x); if (o) o.linkedCases = o.linkedCases.filter((y) => y !== c.id); })}>✕ {st.cases.find((k) => k.id === x)?.number}</button>)}</div>}
        <div className="muted">Des éléments communs ne prouvent pas un lien : à l'équipe de le démontrer.</div>
      </div>
    </>
  );
}

export function caseLinkHints(st: GameState, c: Case): string[] {
  // indices découverts qui pointent vers une autre étape de la grande affaire
  return found(c).filter((k) => k.links).map((k) => k.links!).map((key) => st.cases.find((x) => x.saga && x.templateId === `saga-${key}`)?.id).filter(Boolean) as string[];
}
