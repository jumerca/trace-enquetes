// Tableau d'enquête : portraits, informations classées par nature, relations, chronologie,
// notes et hypothèses. Aucune jauge de culpabilité : seulement des faits, déclarations,
// résultats d'analyse et hypothèses, que le joueur organise et relie.
import { useRef, useState } from 'react';
import { contradictions, found, isContradicted } from '../sim/knowledge';
import { roleLabel } from '../sim/investigation';
import type { Case, Clue } from '../sim/types';
import { Portrait, useGame } from './common';

const NATURE: Record<string, string> = { fait: 'Fait établi', declaration: 'Déclaration', analyse: 'Résultat d\'analyse', document: 'Document', hypothese: 'Hypothèse' };

export function Board({ c }: { c: Case }) {
  const [g, st] = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('tout');
  const [note, setNote] = useState('');
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const persons = c.persons.filter((p) => p.known);
  const clues = found(c).filter((k) => filter === 'tout' || k.nature === filter);
  const ctr = contradictions(c);
  const ctrIds = new Set(ctr.flatMap((x) => [x.a.id, x.b.id]));
  // disposition par défaut : personnes en haut, informations par nature en colonnes
  const pos = (id: string, i: number, kind: 'p' | 'k' | 'n', nature?: string) => {
    if (c.board.pos[id]) return c.board.pos[id];
    if (kind === 'p') return { x: 20 + i * 140, y: 20 };
    if (kind === 'n') return { x: 1260, y: 20 + i * 110 };
    const col = ['fait', 'declaration', 'analyse', 'document', 'hypothese'].indexOf(nature ?? 'fait');
    const idx = clues.filter((k) => k.nature === nature).findIndex((k) => k.id === id);
    return { x: 20 + col * 245, y: 220 + idx * 118 };
  };
  const cards: { id: string; x: number; y: number }[] = [];
  persons.forEach((p, i) => cards.push({ id: p.pid, ...pos(p.pid, i, 'p') }));
  clues.forEach((k, i) => cards.push({ id: k.id, ...pos(k.id, i, 'k', k.nature) }));
  c.board.notes.forEach((n, i) => cards.push({ id: n.id, ...pos(n.id, i, 'n') }));
  const at = (id: string) => cards.find((x) => x.id === id);
  const center = (id: string) => { const p = at(id); if (!p) return null; const w = c.persons.some((x) => x.pid === id) ? 120 : 170; return { x: p.x + w / 2, y: p.y + 40 }; };
  const onDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (linking) {
      if (linking !== id) {
        const label = prompt('Nature du lien (ex. « connaît », « contredit », « même véhicule »)', 'lien') ?? '';
        g.mutate(() => { c.board.links.push({ a: linking, b: id, label: label.slice(0, 40) }); });
      }
      setLinking(null);
      return;
    }
    setSel(id);
    const p = at(id)!;
    const r = wrap.current!.getBoundingClientRect();
    drag.current = { id, dx: e.clientX - r.left + wrap.current!.scrollLeft - p.x, dy: e.clientY - r.top + wrap.current!.scrollTop - p.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const r = wrap.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(1330, e.clientX - r.left + wrap.current!.scrollLeft - drag.current.dx));
    const y = Math.max(0, Math.min(920, e.clientY - r.top + wrap.current!.scrollTop - drag.current.dy));
    c.board.pos[drag.current.id] = { x, y };
    g.bump(true);
  };
  const onUp = () => { drag.current = null; };
  const timeline = found(c).filter((k) => k.time !== undefined).sort((a, b) => a.time! - b.time!);
  const lines: { a: { x: number; y: number }; b: { x: number; y: number }; color: string; dash?: string; label?: string }[] = [];
  for (const k of clues) {
    const kc = center(k.id);
    if (!kc) continue;
    const pid = k.personId;
    if (pid && center(pid)) lines.push({ a: kc, b: center(pid)!, color: '#6b6255', dash: '2 4' });
    for (const ex of k.exculpates ?? []) if (center(ex)) lines.push({ a: kc, b: center(ex)!, color: '#2f8a55', label: 'disculpe' });
  }
  for (const x of ctr) { const a = center(x.a.id), b = center(x.b.id); if (a && b) lines.push({ a, b, color: '#c83a2a', label: 'contredit' }); }
  for (const l of c.board.links) { const a = center(l.a), b = center(l.b); if (a && b) lines.push({ a, b, color: '#1f3a6e', label: l.label }); }
  const selClue = c.clues.find((k) => k.id === sel);
  return (
    <>
      <div className="row" style={{ marginBottom: 6 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="tout">Toutes les informations</option>
          {Object.entries(NATURE).map(([k, l]) => <option key={k} value={k}>{l}s</option>)}
        </select>
        <button className={`btn small ${linking ? 'navy' : ''}`} onClick={() => setLinking(linking ? null : sel)} disabled={!sel && !linking}>{linking ? 'Choisissez la 2e carte…' : '🔗 Relier la carte sélectionnée'}</button>
        <input placeholder="Note ou hypothèse…" value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 120 }} maxLength={160} />
        <button className="btn small" disabled={!note.trim()} onClick={() => { g.mutate(() => c.board.notes.push({ id: `note-${Date.now()}`, text: note.trim(), x: 0, y: 0, kind: 'note' })); setNote(''); }}>+ Note</button>
        <button className="btn small" disabled={!note.trim()} onClick={() => { g.mutate(() => c.board.notes.push({ id: `hyp-${Date.now()}`, text: note.trim(), x: 0, y: 0, kind: 'hypothese' })); setNote(''); }}>+ Hypothèse</button>
        {sel && (c.board.notes.some((n) => n.id === sel) || c.board.links.some((l) => l.a === sel || l.b === sel)) && <button className="btn small" onClick={() => { g.mutate(() => { c.board.notes = c.board.notes.filter((n) => n.id !== sel); c.board.links = c.board.links.filter((l) => l.a !== sel && l.b !== sel); }); setSel(null); }}>Retirer note / liens</button>}
        <button className="btn small" onClick={() => g.mutate(() => { c.board.pos = {}; })}>Réorganiser</button>
      </div>
      <div className="row muted" style={{ fontSize: 12, marginBottom: 4 }}>
        <span className="tag fait">Fait établi</span><span className="tag declaration">Déclaration</span><span className="tag analyse">Analyse</span><span className="tag document">Document</span><span className="tag hypothese">Hypothèse</span>
        <span>— trait rouge : contradiction · vert : élément disculpant · bleu : vos liens</span>
      </div>
      <div className="board-wrap" ref={wrap} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onClick={() => !linking && setSel(null)}>
        <div className="board">
          <svg width="1500" height="1000" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {lines.map((l, i) => (
              <g key={i}>
                <line x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={l.color} strokeWidth={l.dash ? 1.2 : 2.5} strokeDasharray={l.dash} opacity={0.85} />
                {l.label && <text x={(l.a.x + l.b.x) / 2} y={(l.a.y + l.b.y) / 2 - 3} fontSize="11" fill={l.color} fontWeight="700" textAnchor="middle" style={{ paintOrder: 'stroke', stroke: '#f6efdd', strokeWidth: 3 }}>{l.label}</text>}
              </g>
            ))}
          </svg>
          {persons.map((p) => {
            const per = st.people[p.pid];
            const q = at(p.pid)!;
            return (
              <div key={p.pid} className={`bcard person ${sel === p.pid ? 'sel' : ''} ${p.cleared ? 'excul' : ''}`} style={{ left: q.x, top: q.y }} onPointerDown={(e) => onDown(e, p.pid)}>
                <span className="pin" />
                <Portrait a={per.appearance} sexe={per.sexe} size="lg" bg="#eae2cf" />
                <div><b>{per.prenom} {per.nom}</b></div>
                <div className="muted" style={{ fontSize: 11 }}>{roleLabel(p.role)} · {per.age} ans<br />{per.profession}</div>
              </div>
            );
          })}
          {clues.map((k) => {
            const q = at(k.id)!;
            return (
              <div key={k.id} className={`bcard ${sel === k.id ? 'sel' : ''} ${ctrIds.has(k.id) ? 'contra' : ''} ${k.exculpates?.length ? 'excul' : ''}`} style={{ left: q.x, top: q.y }} onPointerDown={(e) => onDown(e, k.id)}>
                <span className="pin" style={{ background: `var(--${k.nature})` }} />
                <span className={`tag ${k.nature}`}>{NATURE[k.nature]}</span>{isContradicted(c, k) ? <span className="tag p1" style={{ marginLeft: 3 }}>contredite</span> : null}
                <div style={{ marginTop: 3 }}>{k.text.length > 150 ? k.text.slice(0, 148) + '…' : k.text}</div>
              </div>
            );
          })}
          {c.board.notes.map((n) => {
            const q = at(n.id)!;
            return (
              <div key={n.id} className={`bcard note ${sel === n.id ? 'sel' : ''}`} style={{ left: q.x, top: q.y, background: n.kind === 'hypothese' ? '#f9d8ea' : undefined }} onPointerDown={(e) => onDown(e, n.id)}>
                <span className="pin" style={{ background: n.kind === 'hypothese' ? 'var(--hypothese)' : '#e0b040' }} />
                <span className={`tag ${n.kind === 'hypothese' ? 'hypothese' : ''}`}>{n.kind === 'hypothese' ? 'Hypothèse' : 'Note'}</span>
                <div style={{ marginTop: 3 }}>{n.text}</div>
              </div>
            );
          })}
        </div>
      </div>
      {selClue && <div className="card" style={{ marginTop: 8 }}><span className={`tag ${selClue.nature}`}>{NATURE[selClue.nature]}</span> {selClue.text}<div className="muted">Recueilli {selClue.foundBy && st.staff.find((s) => s.id === selClue.foundBy) ? `par ${st.staff.find((s) => s.id === selClue.foundBy)!.prenom} ${st.staff.find((s) => s.id === selClue.foundBy)!.nom}` : ''} le {selClue.foundAt ? new Date(Date.UTC(st.startYear, 0, 2) + selClue.foundAt * 60000).toLocaleDateString('fr-FR') : ''}.{selClue.links ? ' Cet élément évoque un autre dossier.' : ''}</div></div>}
      <h3 style={{ margin: '10px 0 2px' }}>Chronologie reconstituée</h3>
      <div className="timeline">
        {!timeline.length && <span className="muted">Aucun élément daté pour l'instant.</span>}
        {timeline.map((k: Clue) => (
          <div key={k.id} className="ev"><b>{k.time! === 0 ? 'Heure des faits' : `${k.time! > 0 ? '+' : '−'}${Math.abs(Math.round(k.time! / 6) / 10)} h`}</b><br /><span className={`tag ${k.nature}`}>{NATURE[k.nature]}</span> {k.text.slice(0, 110)}</div>
        ))}
      </div>
    </>
  );
}
