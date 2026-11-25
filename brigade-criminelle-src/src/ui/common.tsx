import { createContext, useContext, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { Game } from '../game';
import { portraitURL, type Look } from '../render/art';
import { shortDate, dayLabel } from '../sim/calendar';
import type { Appearance, GameState } from '../sim/types';

export const GameCtx = createContext<Game | null>(null);

export function useGame(): [Game, GameState] {
  const g = useContext(GameCtx)!;
  useSyncExternalStore(g.subscribe, g.getVersion);
  return [g, g.st];
}

export const eur = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} €`;
export const when = (st: GameState, m: number) => shortDate(st.startYear, m);
export const day = (st: GameState, m: number) => dayLabel(st.startYear, m);

export function Portrait({ a, sexe, look = 'civil', size = 'md', bg }: { a: Appearance; sexe: 'F' | 'M'; look?: Look; size?: 'sm' | 'md' | 'lg'; bg?: string }) {
  const url = useMemo(() => portraitURL({ a, sexe, look }, 96, bg), [a, sexe, look, bg]);
  return <img className={`portrait ${size === 'md' ? '' : size}`} src={url} alt="" />;
}

export function Bar({ v, max = 100, color, invert }: { v: number; max?: number; color?: string; invert?: boolean }) {
  const p = Math.max(0, Math.min(100, (v / max) * 100));
  const c = color ?? (invert ? (p > 70 ? 'var(--red)' : p > 45 ? 'var(--ochre)' : 'var(--green)') : p < 30 ? 'var(--red)' : p < 55 ? 'var(--ochre)' : 'var(--green)');
  return <div className="bar"><i style={{ width: `${p}%`, background: c }} /></div>;
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: [T, string][]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)} role="tab" aria-selected={value === k}>{l}</button>)}
    </div>
  );
}

export interface Col<R> { key: string; label: string; get: (r: R) => string | number; render?: (r: R) => ReactNode; width?: number }

export function SortTable<R>({ rows, cols, onRow, initial, rowKey }: { rows: R[]; cols: Col<R>[]; onRow?: (r: R) => void; initial?: string; rowKey: (r: R) => string }) {
  const [sort, setSort] = useState<{ k: string; d: 1 | -1 }>({ k: initial ?? cols[0].key, d: 1 });
  const col = cols.find((c) => c.key === sort.k) ?? cols[0];
  const sorted = [...rows].sort((a, b) => {
    const x = col.get(a), y = col.get(b);
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr')) * sort.d;
  });
  return (
    <div className="tbl-wrap">
      <table className="t">
        <thead>
          <tr>{cols.map((c) => <th key={c.key} style={{ width: c.width }} onClick={() => setSort({ k: c.key, d: sort.k === c.key ? (-sort.d as 1 | -1) : 1 })}>{c.label}{sort.k === c.key ? (sort.d === 1 ? ' ▲' : ' ▼') : ''}</th>)}</tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={rowKey(r)} className={onRow ? 'click' : ''} onClick={() => onRow?.(r)}>
              {cols.map((c) => <td key={c.key}>{c.render ? c.render(r) : c.get(r)}</td>)}
            </tr>
          ))}
          {!sorted.length && <tr><td colSpan={cols.length} className="muted">Aucun élément.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function PanelShell({ title, children, wide, actions }: { title: ReactNode; children: ReactNode; wide?: boolean; actions?: ReactNode }) {
  const g = useContext(GameCtx)!;
  return (
    <section className={`panel ${wide ? 'wide' : ''}`} aria-label={typeof title === 'string' ? title : undefined}>
      <div className="panel-head">
        <button className="back" onClick={() => g.back()} title="Retour">← Retour</button>
        <h2>{title}</h2>
        {actions}
        <button className="back" onClick={() => g.close()} title="Fermer">✕</button>
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

export function Stat({ v, l, tone }: { v: ReactNode; l: string; tone?: 'bad' | 'good' }) {
  return <div className="stat"><b style={{ color: tone === 'bad' ? 'var(--red)' : tone === 'good' ? 'var(--green)' : undefined }}>{v}</b><span>{l}</span></div>;
}

/** Petit graphique en ligne (SVG) pour les statistiques. */
export function Spark({ data, color = 'var(--navy)', h = 60, label }: { data: number[]; color?: string; h?: number; label?: string }) {
  if (data.length < 2) return <div className="muted">Pas encore assez de données.</div>;
  const max = Math.max(1, ...data), min = Math.min(0, ...data);
  const w = 300;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / (max - min || 1)) * (h - 6) - 3}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: h, background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 6 }} role="img" aria-label={label}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" />
      <text x="4" y="12" fontSize="10" fill="#6b6255">{Math.round(max)}</text>
      <text x="4" y={h - 3} fontSize="10" fill="#6b6255">{Math.round(min)}</text>
    </svg>
  );
}
