import { useEffect, useRef, useState } from 'react';
import { Rng } from '../core/rng';
import { APPROACHES, demeanor, endInterview, interviewTurn, startInterview, type InterviewSession } from '../sim/interview';
import type { Case } from '../sim/types';
import { Portrait, useGame } from './common';

export function InterviewModal({ c, pid, custody, onClose }: { c: Case; pid: string; custody: boolean; onClose: () => void }) {
  const [g, st] = useGame();
  const [s, setS] = useState<InterviewSession | null>(null);
  const rng = useRef(new Rng(st.minute ^ 0x5a5a));
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let sess: InterviewSession | null = null;
    g.mutate((x) => { sess = startInterview(x, c, pid, custody); });
    setS(sess);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { box.current?.scrollTo(0, box.current.scrollHeight); });
  if (!s) return null;
  const per = st.people[pid];
  const close = () => { g.mutate((x) => endInterview(x, s)); onClose(); };
  return (
    <div className="modal-bg" role="dialog" aria-label="Entretien">
      <div className="modal">
        <div className="panel-head">
          <Portrait a={per.appearance} sexe={per.sexe} size="sm" />
          <h2 style={{ fontSize: 17 }}>{custody ? 'Audition' : 'Entretien'} — {per.prenom} {per.nom}</h2>
          <button className="back" onClick={close}>Terminer</button>
        </div>
        <div className="panel-body" ref={box}>
          <div className="muted" style={{ marginBottom: 6 }}>Attitude observée : <b>{demeanor(s.stress, per.nervosity)}</b>. La nervosité n'indique pas la culpabilité.</div>
          <div className="dialog">
            {s.turns.map((t, i) => <div key={i} className={`say ${t.speaker} ${t.clueId ? 'found' : ''}`}>{t.text}{t.clueId ? <div className="muted" style={{ fontSize: 11 }}>→ Information ajoutée au dossier</div> : null}</div>)}
          </div>
        </div>
        <div style={{ padding: 10, borderTop: '2px solid var(--ink)', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.ended ? <button className="btn primary" onClick={close}>Clore l'entretien</button> : APPROACHES.filter((a) => !a.custody || custody).map((a) => (
            <button key={a.id} className="btn small" title={a.hint} onClick={() => { g.mutate((x) => interviewTurn(x, rng.current, s, a.id)); setS({ ...s }); }}>{a.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
