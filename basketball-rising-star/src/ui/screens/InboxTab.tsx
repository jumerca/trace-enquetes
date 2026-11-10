import { useState } from 'react';
import { useApp } from '../App';
import type { Career } from '../../career/career';
import { desk, resolveMessage, topInterest, type Message } from '../../career/life';
import { ALL_ATTRS, ATTR_LABELS, type AttrKey } from '../../data/attributes';
import { user } from '../../career/career';
import { Bar } from './Hub';

const KIND_LABEL: Record<Message['kind'], string> = { coach: 'Coach', agent: 'Agent', board: 'Direction', media: 'Médias', medical: 'Médical', club: 'Club', scout: 'Recrutement' };
const KIND_COLOR: Record<Message['kind'], string> = { coach: 'orange', agent: 'gold', board: 'blue', media: 'blue', medical: 'red', club: 'green', scout: 'green' };

/** Messagerie (à la manière des jeux de gestion) : messages du staff, de l'agent, de la direction, des médias. */
export function InboxTab({ c }: { c: Career }) {
  const app = useApp();
  const d = desk(c);
  const [filter, setFilter] = useState<Message['kind'] | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(d.inbox[0]?.id ?? null);
  const list = d.inbox.filter((m) => filter === 'all' || m.kind === filter);
  const open = d.inbox.find((m) => m.id === openId) ?? null;
  if (open && !open.read) {
    open.read = true;
    void app.persist(c);
  }
  return (
    <div className="grid" style={{ gap: 14 }}>
      <div className="seg">
        <button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
          Tous ({d.inbox.length})
        </button>
        {(Object.keys(KIND_LABEL) as Message['kind'][]).map((k) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>
            {KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <div className="inbox">
        <div className="inbox-list card tight">
          {list.length === 0 && <p className="small muted">Aucun message. Ils arrivent au fil des semaines : rapports du coach, agent, direction, médias.</p>}
          {list.map((m) => (
            <button key={m.id} className={`inbox-item ${m.id === openId ? 'on' : ''} ${m.read ? '' : 'unread'}`} onClick={() => setOpenId(m.id)}>
              <span className={`pill ${KIND_COLOR[m.kind]}`}>{KIND_LABEL[m.kind]}</span>
              <b>{m.subject}</b>
              <span className="tiny muted">
                {m.from} · S{m.week} {m.season}
              </span>
            </button>
          ))}
        </div>
        <div className="card">
          {open ? (
            <>
              <div className="tiny muted">
                De : {open.from} · semaine {open.week}, saison {open.season}-{open.season + 1}
              </div>
              <h2 style={{ fontSize: '1.4rem', margin: '6px 0 12px' }}>{open.subject}</h2>
              <p>{open.body}</p>
              {open.actions && !open.done && (
                <div className="grid" style={{ gap: 8, marginTop: 12 }}>
                  {open.actions.map((a, i) => (
                    <button
                      key={a.code}
                      className="choice"
                      onClick={async () => {
                        const eff = resolveMessage(c, open.id, i);
                        await app.persist(c);
                        app.bump();
                        app.toast(eff);
                      }}
                    >
                      <b>{a.label}</b>
                      <span className="small muted">{a.effect}</span>
                    </button>
                  ))}
                </div>
              )}
              {open.done && <p className="small" style={{ color: 'var(--green)' }}>Décision prise : {open.done}</p>}
            </>
          ) : (
            <p className="muted">Sélectionnez un message.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function InterestCard({ c }: { c: Career }) {
  const top = topInterest(c, 8);
  return (
    <div className="card">
      <div className="card-title">
        <h3>Clubs qui vous suivent</h3>
        <span className="muted small">Mis à jour chaque semaine selon vos matchs</span>
      </div>
      {top.length === 0 ? (
        <p className="small muted">Aucun club ne vous suit encore. Les bonnes performances attirent les recruteurs.</p>
      ) : (
        top.map((t) => {
          const cl = c.world.clubs[t.clubId];
          return (
            <div key={t.clubId} style={{ marginBottom: 8 }}>
              <div className="row spread small">
                <span>
                  <b>{cl.name}</b> <span className="muted">· {c.world.leagues[cl.leagueId]?.name}</span>
                </span>
                <b>{t.v >= 70 ? 'Très intéressé' : t.v >= 45 ? 'Intéressé' : t.v >= 20 ? 'Observe' : 'Curieux'}</b>
              </div>
              <Bar v={t.v} tone={t.v >= 70 ? 'green' : t.v >= 45 ? 'gold' : ''} />
            </div>
          );
        })
      )}
    </div>
  );
}

export function FocusCard({ c }: { c: Career }) {
  const app = useApp();
  const d = desk(c);
  const u = user(c);
  return (
    <div className="grid cols-2">
      <div className="card">
        <div className="card-title">
          <h3>Travail individuel ciblé</h3>
        </div>
        <p className="small muted">Un attribut travaillé en plus du programme, chaque semaine (charge supplémentaire légère).</p>
        <select
          className="input"
          value={d.focusAttr ?? ''}
          onChange={(e) => {
            d.focusAttr = (e.target.value || null) as AttrKey | null;
            app.bump();
            void app.persist(c);
          }}
          aria-label="Attribut ciblé"
        >
          <option value="">Aucun</option>
          {ALL_ATTRS.filter((k) => !['ambition', 'leadership'].includes(k)).map((k) => (
            <option key={k} value={k}>
              {ATTR_LABELS[k]} ({u.attrs[k]})
            </option>
          ))}
        </select>
      </div>
      <div className="card">
        <div className="card-title">
          <h3>Rapports du coach</h3>
        </div>
        {d.reports.length === 0 && <p className="small muted">Le premier rapport arrive à la fin de la semaine.</p>}
        {d.reports.slice(0, 6).map((r, i) => (
          <div key={i} className="row small" style={{ padding: '5px 0', borderBottom: '1px solid var(--line)', gap: 10 }}>
            <span className={`grade g${r.grade}`}>{r.grade}</span>
            <span style={{ flex: 1 }}>{r.note}</span>
            <span className="muted tiny">S{r.week}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
