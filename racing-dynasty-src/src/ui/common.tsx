import { useEffect, type ReactNode } from 'react';
import type { Emblem } from '../game/data';
import { COMPOUNDS } from '../engine/physics';
import type { Compound } from '../engine/types';

export function money(v: number, sign = false): string {
  const s = Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
  return (v < 0 ? '−' : sign ? '+' : '') + s + ' M€';
}

export function Logo({ size = 1 }: { size?: number }) {
  return (
    <svg className="logo" viewBox="0 0 420 170" width={420 * size} height={170 * size} role="img" aria-label="Racing Dynasty">
      <defs>
        <pattern id="chk" width="16" height="16" patternUnits="userSpaceOnUse">
          <rect width="16" height="16" fill="#f4f1ea" />
          <rect width="8" height="8" fill="#16130f" />
          <rect x="8" y="8" width="8" height="8" fill="#16130f" />
        </pattern>
      </defs>
      <g transform="skewX(-12)">
        <rect x="58" y="20" width="330" height="22" fill="url(#chk)" stroke="#16130f" strokeWidth="4" />
        <path d="M40 52 H400 L388 112 H28 Z" fill="#d62828" stroke="#16130f" strokeWidth="6" strokeLinejoin="round" />
        <path d="M44 58 H392 L389 70 H42 Z" fill="#ff6b5b" opacity="0.7" />
        <text x="214" y="104" textAnchor="middle" fontFamily="Bangers, Impact, sans-serif" fontSize="56" fill="#f4f1ea" stroke="#16130f" strokeWidth="3" paintOrder="stroke" letterSpacing="3">RACING</text>
        <path d="M70 118 H372 L364 158 H62 Z" fill="#ffd400" stroke="#16130f" strokeWidth="6" strokeLinejoin="round" />
        <text x="216" y="152" textAnchor="middle" fontFamily="Bangers, Impact, sans-serif" fontSize="38" fill="#16130f" letterSpacing="8">DYNASTY</text>
      </g>
      <g stroke="#16130f" strokeWidth="4" strokeLinecap="round">
        <line x1="4" y1="66" x2="30" y2="66" />
        <line x1="10" y1="84" x2="26" y2="84" />
        <line x1="0" y1="102" x2="22" y2="102" />
      </g>
    </svg>
  );
}

export function EmblemIcon({ emblem, color, color2, size = 40 }: { emblem: Emblem; color: string; color2: string; size?: number }) {
  const ink = '#16130f';
  const shapes: Record<Emblem, ReactNode> = {
    bouclier: <path d="M20 3 L35 9 V20 C35 29 28 35 20 38 C12 35 5 29 5 20 V9 Z" />,
    cercle: <circle cx="20" cy="20" r="16" />,
    etoile: <path d="M20 3 L25 15 L38 15 L27 23 L31 36 L20 28 L9 36 L13 23 L2 15 L15 15 Z" />,
    chevron: <path d="M4 8 L20 18 L36 8 V22 L20 34 L4 22 Z" />,
    eclair: <path d="M23 2 L8 22 H18 L14 38 L32 15 H22 Z" />,
    couronne: <path d="M4 30 L6 10 L14 18 L20 6 L26 18 L34 10 L36 30 Z" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" className="emblem">
      <g fill={color} stroke={ink} strokeWidth="2.5" strokeLinejoin="round">{shapes[emblem]}</g>
      <circle cx="20" cy="20" r="4.5" fill={color2} stroke={ink} strokeWidth="1.5" />
    </svg>
  );
}

/** Vue de dessus de la livrée (aperçu de création). */
export function CarLivery({ color, color2, width = 260 }: { color: string; color2: string; width?: number }) {
  const ink = '#16130f';
  return (
    <svg viewBox="-28 -12 56 24" width={width} height={(width * 24) / 56} className="livery">
      <ellipse cx="1" cy="2" rx="27" ry="9" fill="#000" opacity="0.2" />
      {[[-21.5, -9.8], [-21.5, 6], [12.5, -9.3], [12.5, 6]].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="7.5" height="3.8" rx="1" fill="#1b1b1b" stroke={ink} strokeWidth="1" />
      ))}
      <rect x="-26" y="-8.5" width="5" height="17" rx="1" fill={color2} stroke={ink} strokeWidth="1.2" />
      <path d="M-21.5 -4.2 L-6 -6.2 L8 -3.4 L23.5 -1.4 L23.5 1.4 L8 3.4 L-6 6.2 L-21.5 4.2 Z" fill={color} stroke={ink} strokeWidth="1.2" />
      <path d="M-19 -0.8 L22 -0.5 L22 0.5 L-19 0.8 Z" fill={color2} />
      <path d="M-14 -5 L6 -3 L6 -2.2 L-14 -3.8 Z" fill="#fff" opacity="0.35" />
      <rect x="22.5" y="-9.5" width="3.8" height="19" rx="1" fill={color2} stroke={ink} strokeWidth="1.2" />
      <ellipse cx="-1" cy="0" rx="5.5" ry="2.7" fill={ink} />
      <circle cx="0" cy="0" r="2" fill="#f4f1ea" />
      <circle cx="0.4" cy="0" r="1.2" fill={color2} />
    </svg>
  );
}

export function StatBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(1, value / max));
  const tone = value >= 16 ? 'hi' : value >= 11 ? 'mid' : 'lo';
  return (
    <div className="statbar">
      <span>{label}</span>
      <div className="bar"><i className={tone} style={{ width: pct * 100 + '%' }} /></div>
      <b>{value}</b>
    </div>
  );
}

export function TyreChip({ c, wear }: { c: Compound; wear?: number }) {
  return (
    <span className="tyre" style={{ borderColor: COMPOUNDS[c].color }} title={COMPOUNDS[c].name}>
      {c}
      {wear !== undefined && <small>{Math.round(wear)}%</small>}
    </span>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <header>
          <h2>{title}</h2>
          <button className="icon" onClick={onClose} aria-label="Fermer">✕</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Weather({ w }: { w: 'sec' | 'pluie' }) {
  return <span className={'weather ' + w}>{w === 'pluie' ? '🌧 Pluie' : '☀ Sec'}</span>;
}
