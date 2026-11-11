import { useEffect, type ReactNode } from 'react';

export function Modal({ title, children, onClose, actions }: { title: string; children: ReactNode; onClose: () => void; actions?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal fade-in" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.3rem' }}>{title}</h2>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
        <div className="row wrap" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
          {actions ?? (
            <button className="btn" onClick={onClose}>
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
