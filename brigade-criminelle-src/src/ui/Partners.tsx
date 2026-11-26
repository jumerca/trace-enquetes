// Écran « Partenaires » : légiste, gendarmerie, mairie, hôpital, services sociaux, banques et
// opérateurs. Chacun est un personnage avec qui l'on traite : demandes à arbitrer, appuis à solliciter.
import { useState } from 'react';
import { Rng } from '../core/rng';
import { calendar } from '../sim/calendar';
import { acceptChance, answerRequest, ensurePartners, PARTNER_INFO, PARTNER_LABEL, SOLICITATIONS, solicit } from '../sim/partners';
import { spawnCase } from '../sim/sim';
import { sfx } from '../audio/audio';
import { Bar, PanelShell, Portrait, useGame, when } from './common';

export function PartnersPanel() {
  const [g, st] = useGame();
  const [msg, setMsg] = useState('');
  const [caseSel, setCaseSel] = useState('');
  const ps = st.partners ?? (g.mutate((s) => ensurePartners(s, new Rng(s.seed + 11))), st.partners);
  if (!ps) return null;
  const year = calendar(st.startYear, st.minute).year;
  const open = st.cases.filter((c) => c.status === 'ouverte');
  const pending = ps.requests.filter((r) => !r.answered);
  return (
    <PanelShell title="Partenaires" wide>
      {msg && <div className="card" style={{ background: '#fff3d6' }}>{msg}</div>}
      {pending.length > 0 && <h3>Demandes en attente</h3>}
      {pending.map((r) => {
        const p = ps.list.find((x) => x.kind === r.partner)!;
        return (
          <div className="card partner-req" key={r.id}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <Portrait a={p.appearance} sexe={p.sexe} look={PARTNER_INFO[p.kind].look} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <b>{r.title}</b> <span className="muted">— {PARTNER_INFO[p.kind].title(p)}, {PARTNER_LABEL[p.kind].toLowerCase()} · réponse avant le {when(st, r.expires).slice(0, 10)}</span>
                <p className="quote">« {r.quote} »</p>
                <div className="row">
                  {r.options.map((o, i) => <button key={i} className={`btn small ${i === 0 ? 'green' : ''}`} onClick={() => { let t = ''; g.mutate((s) => { const rng = new Rng(s.minute + 3); t = answerRequest(s, rng, r.id, i, (types) => spawnCase(s, rng, false, types)); }); sfx('stamp'); setMsg(t); }}>{o.label}</button>)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
      <div className="card">
        <label className="row">Affaire pour laquelle solliciter un appui :
          <select value={caseSel} onChange={(e) => setCaseSel(e.target.value)}>
            <option value="">— choisir une affaire en cours —</option>
            {open.map((c) => <option key={c.id} value={c.id}>{c.number} · {c.title}</option>)}
          </select>
        </label>
        {caseSel && (() => { const c = st.cases.find((x) => x.id === caseSel); const b = c?.boosts?.filter((x) => x.until > st.minute) ?? []; return b.length ? <p className="muted">Appuis en cours : {b.map((x) => `${PARTNER_LABEL[x.by as keyof typeof PARTNER_LABEL]} (jusqu'au ${when(st, x.until).slice(0, 10)})`).join(', ')}</p> : null; })()}
      </div>
      <div className="partner-grid">
        {ps.list.map((p) => {
          const info = PARTNER_INFO[p.kind];
          const sols = SOLICITATIONS.filter((x) => x.partner === p.kind && (!x.minYear || year >= x.minYear));
          const busy = p.busyUntil > st.minute;
          return (
            <div className="card partner" key={p.kind}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <Portrait a={p.appearance} sexe={p.sexe} look={info.look} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="tag">{PARTNER_LABEL[p.kind]}</div>
                  <h3 style={{ margin: '2px 0' }}>{info.title(p)}</h3>
                  <div className="muted">{info.org(year)}</div>
                  <div style={{ marginTop: 4 }}>Relation <Bar v={p.relation} /></div>
                  <div className="muted">{p.relation >= 70 ? 'Excellente' : p.relation >= 42 ? 'Cordiale' : p.relation >= 25 ? 'Tendue' : 'Détériorée'} · accord probable {Math.round(acceptChance(p) * 100)} %{p.favours ? ` · vous doit ${p.favours} service(s)` : ''}</div>
                </div>
              </div>
              <p className="muted" style={{ margin: '6px 0' }}>{info.help}</p>
              {p.lastLine && <p className="quote">« {p.lastLine} »</p>}
              {sols.map((so) => (
                <div key={so.id} className="row between" style={{ padding: '3px 0' }}>
                  <span title={so.text}>{so.label}</span>
                  <button className="btn small navy" disabled={busy || (so.forCase && !caseSel)} title={busy ? 'Déjà sollicité ces deux derniers jours' : so.text} onClick={() => { let r = { ok: false, text: '' }; g.mutate((s) => { r = solicit(s, new Rng(s.minute + p.kind.length), so.id, caseSel || undefined); }); sfx(r.ok ? 'success' : 'fail'); setMsg(r.text); }}>{busy ? 'Patienter' : 'Solliciter'}</button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="card"><h3>Historique des relations</h3><div className="log">{[...ps.history].reverse().slice(0, 30).map((h, i) => <div key={i}><time>{when(st, h.minute)}</time><b>{PARTNER_LABEL[h.partner]} : </b>{h.text}</div>)}{!ps.history.length && <span className="muted">Aucun échange pour l'instant.</span>}</div></div>
    </PanelShell>
  );
}
