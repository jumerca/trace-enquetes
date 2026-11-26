import { useState } from 'react';
import { calendar, MIN_D } from '../sim/calendar';
import { spend } from '../sim/finance';
import { notify } from '../sim/log';
import { arrive, promote, sendTraining, targetInvestigators, TRAININGS } from '../sim/sim';
import { level } from '../sim/career';
import { ageOf, capacity, fullName, load, overall, ROLE_LABELS, salary } from '../sim/staff';
import { lookOf } from '../render/station-view';
import { SKILL_LABELS, SKILLS, type Shift, type Unit } from '../sim/types';
import { Bar, eur, PanelShell, Portrait, SortTable, Tabs, useGame, when } from './common';

const STATUS: Record<string, string> = { service: 'En service', repos: 'Repos', conge: 'Congés', formation: 'Formation', maladie: 'Arrêt maladie' };

export function StaffList() {
  const [g, st] = useGame();
  const year = calendar(st.startYear, st.minute).year;
  return (
    <PanelShell title={`Personnel (${st.staff.length})`} wide>
      <SortTable rows={st.staff} rowKey={(s) => s.id} onRow={(s) => g.open({ id: 'staff', arg: s.id })} initial="role" cols={[
        { key: 'p', label: '', get: () => 0, render: (s) => <Portrait a={s.appearance} sexe={s.sexe} look={lookOf(s)} size="sm" /> },
        { key: 'nom', label: 'Nom', get: (s) => `${s.nom} ${s.prenom}`, render: (s) => <b>{fullName(s)}</b> },
        { key: 'role', label: 'Fonction', get: (s) => ['commandant', 'officier', 'enqueteur', 'technicien', 'agent', 'secretaire'].indexOf(s.role), render: (s) => ROLE_LABELS[s.role] },
        { key: 'grade', label: 'Grade', get: (s) => s.grade },
        { key: 'age', label: 'Âge', get: (s) => ageOf(s, year) },
        { key: 'unit', label: 'Unité', get: (s) => st.units.find((u) => u.id === s.unitId)?.name ?? '—' },
        { key: 'note', label: 'Niveau', get: (s) => overall(s) },
        { key: 'load', label: 'Charge', get: (s) => load(s, st) / capacity(s), render: (s) => <Bar v={load(s, st)} max={capacity(s) * 1.5} invert /> },
        { key: 'fat', label: 'Fatigue', get: (s) => s.fatigue, render: (s) => <Bar v={s.fatigue} invert /> },
        { key: 'mor', label: 'Moral', get: (s) => s.moral, render: (s) => <Bar v={s.moral} /> },
        { key: 'st', label: 'Statut', get: (s) => s.status, render: (s) => STATUS[s.status] + (s.requests.length ? ' ✉️' : '') },
      ]} />
      <p className="muted">Le niveau indicatif synthétise les compétences utiles au poste ; il ne se réduit jamais au nombre d'interpellations.</p>
    </PanelShell>
  );
}

export function StaffProfile({ id }: { id: string }) {
  const [g, st] = useGame();
  const s = st.staff.find((x) => x.id === id);
  const [tab, setTab] = useState<'comp' | 'carriere' | 'affaires'>('comp');
  const [msg, setMsg] = useState('');
  if (!s) return <PanelShell title="Personnel">Cette personne ne fait plus partie de la brigade.</PanelShell>;
  const year = calendar(st.startYear, st.minute).year;
  const top = Object.entries(s.relations).sort((a, b) => b[1] - a[1]);
  return (
    <PanelShell title={fullName(s)}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <Portrait a={s.appearance} sexe={s.sexe} look={lookOf(s)} size="lg" />
        <div style={{ flex: 1, fontSize: 14 }}>
          <b>{s.grade}</b> — {ROLE_LABELS[s.role]}<br />
          {ageOf(s, year)} ans · {year - s.entryYear} ans d'ancienneté · {s.specialite}<br />
          Unité : {st.units.find((u) => u.id === s.unitId)?.name ?? 'aucune'}<br />
          Salaire indicatif (grille) : {eur(salary(s, year))} / an<br />
          Horaires : {s.shift === 'jour' ? 'équipe de jour (8 h–18 h)' : s.shift === 'nuit' ? 'équipe de nuit (20 h–6 h)' : 'après-midi et soirée (13 h–22 h)'}{s.astreinte ? ' · astreinte' : ''}<br />
          Statut : <b>{STATUS[s.status]}</b>{s.status !== 'service' && s.statusUntil > st.minute ? ` jusqu'au ${when(st, s.statusUntil)}` : ''}<br />
          {s.task && <span className="muted">Actuellement : {s.task.label}</span>}
        </div>
      </div>
      <div className="grid3" style={{ margin: '10px 0' }}>
        <div>Fatigue<Bar v={s.fatigue} invert /></div>
        <div>Moral<Bar v={s.moral} /></div>
        <div>Charge ({load(s, st)} / {capacity(s).toFixed(1)})<Bar v={load(s, st)} max={capacity(s) * 1.5} invert /></div>
        <div>Ambition<Bar v={s.ambition} max={20} color="var(--violet)" /></div>
        <div>Affaires traitées<br /><b>{s.casesHandled}</b> ({s.casesSolved} élucidées)</div>
        <div>Erreurs relevées (année)<br /><b>{s.errors}</b></div>
      </div>
      {s.requests.length > 0 && (
        <div className="card" style={{ background: '#fff3d6' }}>
          <h3>Demandes</h3>
          {s.requests.includes('promotion') && <div className="row between">Présentation à l'avancement<span className="row"><button className="btn small green" onClick={() => { let m = ''; g.mutate((x) => { m = promote(x, s); }); setMsg(m); }}>Soutenir la demande</button><button className="btn small" onClick={() => g.mutate(() => { s.requests = s.requests.filter((r) => r !== 'promotion'); s.moral -= 6; })}>Refuser</button></span></div>}
          {s.requests.includes('mutation') && <div className="row between">Demande de mutation<span className="row"><button className="btn small red" onClick={() => g.mutate((x) => { x.staff = x.staff.filter((y) => y !== s); for (const c of x.cases) { c.team = c.team.filter((y) => y !== s.id); if (c.lead === s.id) c.lead = c.team[0] ?? null; } notify(x, { level: 'alerte', text: `${fullName(s)} quitte la brigade (mutation acceptée).` }); g.back(); })}>Accepter</button><button className="btn small" onClick={() => g.mutate(() => { s.requests = s.requests.filter((r) => r !== 'mutation'); s.moral = Math.max(0, s.moral - 8); })}>Refuser</button><button className="btn small" onClick={() => g.mutate(() => { s.requests = s.requests.filter((r) => r !== 'mutation'); s.moral = Math.min(100, s.moral + 10); s.history.push({ minute: st.minute, kind: 'demande', text: 'Entretien avec le commandant : demande de mutation retirée.' }); })}>Entretien individuel</button></span></div>}
          {s.requests.includes('formation') && <div className="row between">Souhaite une formation<button className="btn small" onClick={() => g.open({ id: 'training', arg: s.id })}>Proposer une formation</button></div>}
        </div>
      )}
      {msg && <div className="card">{msg}</div>}
      <div className="row" style={{ marginBottom: 8 }}>
        <label className="row">Unité <select value={s.unitId ?? ''} onChange={(e) => g.mutate(() => { s.unitId = e.target.value || null; s.history.push({ minute: st.minute, kind: 'affectation', text: `Affectation : ${st.units.find((u) => u.id === e.target.value)?.name ?? 'sans unité'}.` }); })}><option value="">Aucune</option>{st.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        {s.role !== 'commandant' && <button className="btn small" onClick={() => g.open({ id: 'training', arg: s.id })}>Formation…</button>}
        {s.status === 'service' && s.role !== 'commandant' && <button className="btn small" onClick={() => g.mutate(() => { s.status = 'repos'; s.statusUntil = st.minute + 2 * MIN_D; s.moral = Math.min(100, s.moral + 4); notify(st, { level: 'info', text: `${fullName(s)} bénéficie de deux jours de récupération.`, staffId: s.id }); })}>Accorder 2 jours de récupération</button>}
        {s.status === 'service' && s.leaveDays >= 5 && s.role !== 'commandant' && <button className="btn small" onClick={() => g.mutate(() => { s.status = 'conge'; s.statusUntil = st.minute + 7 * MIN_D; s.leaveDays -= 5; s.moral = Math.min(100, s.moral + 8); })}>Congés (1 semaine) — solde {s.leaveDays} j</button>}
        <button className="btn small" onClick={() => { g.close(); g.setScreen('station'); const p = g.station?.agentPos(s.id); if (p) { g.setFloor(p.f); g.engine?.centerOn(p.x, p.y, 1.6); } }}>Localiser</button>
      </div>
      <Tabs tabs={[['comp', 'Compétences'], ['carriere', 'Carrière'], ['affaires', 'Affaires et relations']]} value={tab} onChange={setTab} />
      {tab === 'comp' && <div className="card">{SKILLS.map((k) => <div className="skill" key={k}><span>{SKILL_LABELS[k]}</span><Bar v={s.skills[k]} max={20} /><b>{s.skills[k]}</b></div>)}<div className="muted" style={{ marginTop: 6 }}>Notes sur 20. La fatigue et le moral modulent les performances réelles.</div></div>}
      {tab === 'carriere' && <div className="card log">{[...s.history].reverse().map((h, i) => <div key={i}><time>{when(st, h.minute)}</time><span className="tag">{h.kind}</span> {h.text}</div>)}</div>}
      {tab === 'affaires' && <>
        <div className="card"><h3>Affaires en cours</h3>{s.assignments.map((cid) => { const c = st.cases.find((x) => x.id === cid); return c ? <div key={cid}><button className="btn small" onClick={() => g.open({ id: 'case', arg: cid })}>{c.lead === s.id ? '★ ' : ''}{c.title}</button></div> : null; })}{!s.assignments.length && <span className="muted">Aucune.</span>}</div>
        <div className="card"><h3>Relations professionnelles</h3>{top.map(([oid, v]) => { const o = st.staff.find((x) => x.id === oid); return o ? <div className="skill" key={oid}><span>{fullName(o)}</span><Bar v={v + 100} max={200} /><b>{v > 30 ? '😊' : v < -10 ? '😠' : '😐'}</b></div> : null; })}</div>
      </>}
    </PanelShell>
  );
}

export function Recruit() {
  const [g, st] = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const ceiling = Math.max(14 + level(st).ceiling, Math.round(targetInvestigators(st) * 1.9));
  const pending = st.candidates.filter((c) => c.requested).length;
  const cand = st.candidates.find((c) => c.staff.id === sel);
  const year = calendar(st.startYear, st.minute).year;
  return (
    <PanelShell title="Recrutement et affectations" wide>
      <p className="muted">Dans un service public, le commandant ne recrute ni ne négocie librement : il demande des affectations à l'administration, dans la limite du plafond d'emplois ({st.staff.length + pending}/{ceiling}). Les rémunérations suivent les grilles.</p>
      <SortTable rows={st.candidates} rowKey={(c) => c.staff.id} onRow={(c) => setSel(c.staff.id)} initial="role" cols={[
        { key: 'p', label: '', get: () => 0, render: (c) => <Portrait a={c.staff.appearance} sexe={c.staff.sexe} look={lookOf(c.staff)} size="sm" /> },
        { key: 'nom', label: 'Nom', get: (c) => fullName(c.staff) },
        { key: 'role', label: 'Fonction', get: (c) => ROLE_LABELS[c.staff.role] },
        { key: 'src', label: 'Origine', get: (c) => (c.source === 'sortie_ecole' ? 'Sortie d\'école' : c.source === 'mutation' ? 'Mutation' : 'Spécialiste') },
        { key: 'spec', label: 'Spécialité', get: (c) => c.staff.specialite },
        { key: 'age', label: 'Âge', get: (c) => ageOf(c.staff, year) },
        { key: 'niv', label: 'Niveau', get: (c) => overall(c.staff) },
        { key: 'pot', label: 'Potentiel', get: (c) => (c.interviewed ? c.staff.potential : -1), render: (c) => (c.interviewed ? (c.staff.potential >= 16 ? 'Élevé' : c.staff.potential >= 12 ? 'Correct' : 'Limité') : '?') },
        { key: 'dispo', label: 'Disponible', get: (c) => c.availableFrom, render: (c) => (c.requested ? `Arrivée le ${when(st, c.availableFrom).slice(0, 10)}` : when(st, c.availableFrom).slice(0, 10)) },
      ]} />
      {cand && (
        <div className="card" style={{ marginTop: 10 }}>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Portrait a={cand.staff.appearance} sexe={cand.staff.sexe} look={lookOf(cand.staff)} size="lg" />
            <div style={{ flex: 1 }}>
              <b>{fullName(cand.staff)}</b> — {cand.staff.grade}, {ROLE_LABELS[cand.staff.role]}<br />
              <span className="muted">{cand.staff.specialite} · {cand.staff.casesHandled} affaires traitées · salaire de grille {eur(salary(cand.staff, year))}</span>
              {cand.interviewed && <p style={{ fontSize: 13 }}>Impression d'entretien : {cand.staff.ambition > 13 ? 'très ambitieux·se' : cand.staff.ambition > 8 ? 'motivé·e' : 'discret·e'}, {cand.staff.skills.collectif > 12 ? 'à l\'aise en équipe' : 'plutôt solitaire'}, potentiel {cand.staff.potential >= 16 ? 'élevé' : cand.staff.potential >= 12 ? 'correct' : 'limité'}.</p>}
            </div>
          </div>
          <div className="grid2">{SKILLS.map((k) => <div className="skill" key={k}><span>{SKILL_LABELS[k]}</span><Bar v={cand.interviewed ? cand.staff.skills[k] : Math.round(cand.staff.skills[k] / 4) * 4} max={20} /><b>{cand.interviewed ? cand.staff.skills[k] : `~${Math.round(cand.staff.skills[k] / 4) * 4}`}</b></div>)}</div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn small" disabled={cand.interviewed} onClick={() => g.mutate((x) => { cand.interviewed = true; spend(x, 'deplacements', 60); })}>Organiser un entretien (60 €)</button>
            <button className="btn small primary" disabled={cand.requested || st.staff.length + pending >= ceiling} onClick={() => g.mutate((x) => { cand.requested = true; notify(x, { level: 'info', text: `Demande d'affectation transmise pour ${fullName(cand.staff)}.` }); })}>{cand.requested ? 'Affectation demandée' : 'Demander l\'affectation'}</button>
            {cand.requested && cand.availableFrom <= st.minute && <button className="btn small green" onClick={() => g.mutate((x) => { arrive(x, cand.staff); x.candidates = x.candidates.filter((c) => c !== cand); })}>Accueillir</button>}
          </div>
        </div>
      )}
    </PanelShell>
  );
}

export function Training({ id }: { id?: string }) {
  const [g, st] = useGame();
  const [who, setWho] = useState<string>(id ?? '');
  const [msg, setMsg] = useState('');
  const s = st.staff.find((x) => x.id === who);
  return (
    <PanelShell title="Formation">
      <label className="field">Agent<select value={who} onChange={(e) => setWho(e.target.value)}><option value="">Choisir…</option>{st.staff.filter((x) => x.role !== 'commandant').map((x) => <option key={x.id} value={x.id}>{fullName(x)} — {x.grade} ({STATUS[x.status]})</option>)}</select></label>
      <p className="muted">Crédits de formation restants : {eur(st.budget.envelope.formation - st.budget.spent.formation)}. Une salle de formation réduit les coûts de 30 %.</p>
      {TRAININGS.map((t) => (
        <div className="card" key={t.id}>
          <div className="row between"><b>{t.label}</b><span>{t.days} jours · {eur(t.cost)}</span></div>
          <div className="muted">Améliore : {t.skills.map((k) => SKILL_LABELS[k]).join(', ')}{s ? ` (actuellement ${t.skills.map((k) => s.skills[k]).join(' / ')})` : ''}</div>
          <button className="btn small" disabled={!s || s.status !== 'service'} onClick={() => { let m = ''; g.mutate((x) => { m = sendTraining(x, s!, t.id); }); setMsg(m); }}>Inscrire</button>
        </div>
      ))}
      {msg && <div className="card" style={{ background: '#fff3d6' }}>{msg}</div>}
    </PanelShell>
  );
}

const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export function Planning() {
  const [g, st] = useGame();
  const cycle: Shift[] = ['jour', 'nuit', 'mixte'];
  return (
    <PanelShell title="Planning du service" wide>
      <p className="muted">Touchez une journée pour basculer travail / repos, et l'horaire pour changer d'équipe. La fatigue accumulée dégrade les performances et augmente les erreurs.</p>
      <div className="week" style={{ fontWeight: 700, marginBottom: 4 }}><span>Agent</span>{DAYS.map((d) => <span key={d} style={{ textAlign: 'center' }}>{d}</span>)}<span>Heures / sem.</span></div>
      {st.staff.map((s) => (
        <div className="week" key={s.id} style={{ marginBottom: 3 }}>
          <span style={{ cursor: 'pointer' }} onClick={() => g.open({ id: 'staff', arg: s.id })}><b>{fullName(s)}</b><br /><span className="muted">{s.grade}</span> <Bar v={s.fatigue} invert /></span>
          {DAYS.map((_, i) => {
            const wd = (i + 1) % 7;
            const rest = s.restDays.includes(wd);
            const st2 = s.status !== 'service' ? s.status : rest ? 'repos' : s.shift;
            return <span key={i} className={`cell ${st2}`} onClick={() => g.mutate(() => { if (s.status !== 'service') return; s.restDays = rest ? s.restDays.filter((x) => x !== wd) : [...s.restDays, wd]; })} title={rest ? 'Repos' : 'Travail'}>{st2 === 'jour' ? '☀' : st2 === 'nuit' ? '☾' : st2 === 'mixte' ? '◐' : st2 === 'repos' ? '—' : st2 === 'conge' ? 'C' : st2 === 'formation' ? 'F' : 'M'}</span>;
          })}
          <span style={{ textAlign: 'center' }}>{Math.round(s.hoursThisWeek)} h{s.overtime > 0 ? <><br /><span className="muted">+{Math.round(s.overtime)} sup.</span></> : null}</span>
          <span style={{ gridColumn: '2 / span 8' }} className="row">
            <button className="btn small" onClick={() => g.mutate(() => { s.shift = cycle[(cycle.indexOf(s.shift) + 1) % 3]; })}>Équipe : {s.shift === 'jour' ? 'jour' : s.shift === 'nuit' ? 'nuit' : 'après-midi'}</button>
            <label className="row" style={{ fontSize: 12 }}><input type="checkbox" checked={s.astreinte} onChange={(e) => g.mutate(() => { s.astreinte = e.target.checked; })} /> Astreinte</label>
            <span className="muted" style={{ fontSize: 12 }}>{7 - s.restDays.length} jours travaillés · solde congés {s.leaveDays} j</span>
          </span>
        </div>
      ))}
      <div className="card" style={{ marginTop: 10 }}><b>Couverture :</b> {['jour', 'nuit', 'mixte'].map((sh) => `${sh === 'mixte' ? 'après-midi' : sh} ${st.staff.filter((s) => s.shift === sh && s.status === 'service').length}`).join(' · ')}. Une permanence de nuit est recommandée pour les affaires urgentes.</div>
    </PanelShell>
  );
}

const UNIT_KINDS: [Unit['kind'], string, Unit['domain']][] = [
  ['generale', 'Brigade générale', []], ['disparitions', 'Groupe des disparitions', ['disparition']], ['biens', 'Groupe des atteintes aux biens', ['vol', 'cambriolage', 'vol_vehicule']],
  ['criminel', 'Groupe criminel', ['deces_suspect', 'homicide', 'extorsion']], ['financiere', 'Unité financière', ['escroquerie', 'financiere', 'fraude_doc']], ['numerique', 'Unité de criminalité numérique', ['numerique']],
  ['scientifique', 'Police scientifique', []], ['ancien', 'Groupe des affaires anciennes', ['ancien']], ['coordination', 'Équipe de coordination', []], ['analyse', 'Cellule d\'analyse', []],
];

export function Units() {
  const [g, st] = useGame();
  const [kind, setKind] = useState<Unit['kind']>('disparitions');
  return (
    <PanelShell title="Organisation des unités" wide>
      {st.units.map((u) => {
        const members = st.staff.filter((s) => s.unitId === u.id);
        const work = st.cases.filter((c) => c.status === 'ouverte' && u.domain.includes(c.type)).length;
        return (
          <div className="card" key={u.id}>
            <div className="row between"><h3>{u.name}</h3><button className="btn small" onClick={() => g.mutate((x) => { x.units = x.units.filter((y) => y !== u); for (const s of x.staff) if (s.unitId === u.id) s.unitId = null; })}>Dissoudre</button></div>
            <label className="row">Responsable <select value={u.chief ?? ''} onChange={(e) => g.mutate(() => { u.chief = e.target.value || null; const s = st.staff.find((x) => x.id === e.target.value); if (s) { s.unitId = u.id; s.history.push({ minute: st.minute, kind: 'affectation', text: `Chef de groupe : ${u.name}.` }); } })}><option value="">—</option>{st.staff.filter((s) => s.role !== 'secretaire').map((s) => <option key={s.id} value={s.id}>{fullName(s)} ({s.grade})</option>)}</select></label>
            <div className="muted">Domaine : {u.domain.length ? u.domain.join(', ') : 'tous types / soutien'} · charge actuelle : {work} dossier(s) ouvert(s)</div>
            <div className="row" style={{ marginTop: 6 }}>{members.map((m) => <span key={m.id} className="tag" style={{ cursor: 'pointer' }} onClick={() => g.open({ id: 'staff', arg: m.id })}>{u.chief === m.id ? '★ ' : ''}{fullName(m)}</span>)}</div>
            <label className="row" style={{ marginTop: 6 }}>Ajouter <select value="" onChange={(e) => g.mutate(() => { const s = st.staff.find((x) => x.id === e.target.value); if (s) s.unitId = u.id; })}><option value="">Choisir…</option>{st.staff.filter((s) => s.unitId !== u.id).map((s) => <option key={s.id} value={s.id}>{fullName(s)}</option>)}</select></label>
          </div>
        );
      })}
      <div className="card">
        <h3>Créer une unité</h3>
        <div className="row"><select value={kind} onChange={(e) => setKind(e.target.value as Unit['kind'])}>{UNIT_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <button className="btn small primary" onClick={() => g.mutate((x) => { const d = UNIT_KINDS.find((u) => u[0] === kind)!; x.units.push({ id: `U${++x.counters.unit}`, name: d[1], kind, chief: null, domain: d[2], districts: [] }); })}>Créer</button></div>
        <p className="muted">Les dossiers sont de préférence attribués aux membres de l'unité compétente ; les enquêteurs peuvent collaborer entre unités.</p>
      </div>
    </PanelShell>
  );
}
