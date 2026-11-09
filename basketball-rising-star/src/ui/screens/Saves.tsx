import { useRef, useState } from 'react';
import { useApp } from '../App';
import { deleteSlot, exportCareer, importCareer, loadSlot, metaOf, saveSlot, SLOT_COUNT } from '../../save/db';
import { Modal } from '../components/Modal';
import { Logo } from '../components/Art';
import { user, userClub } from '../../career/career';
import { playerOvr } from '../../data/generate';

export function Saves({ mode }: { mode: 'load' | 'delete' }) {
  const app = useApp();
  const [confirm, setConfirm] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importSlot, setImportSlot] = useState<number>(0);

  const load = async (i: number) => {
    try {
      const { career, fromBackup } = await loadSlot(i);
      app.setCareer(career, i);
      if (fromBackup) app.toast('Sauvegarde endommagée : copie de secours chargée.');
      app.go({ name: 'hub', tab: 'home' });
    } catch (e) {
      app.toast((e as Error).message);
    }
  };
  const exportSlot = async (i: number) => {
    try {
      const { career } = await loadSlot(i);
      const blob = new Blob([exportCareer(career)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const u = career.world.players[career.userId];
      a.download = `brs-${u.lastName.toLowerCase()}-${career.world.season}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch (e) {
      app.toast((e as Error).message);
    }
  };
  const onImport = async (f: File) => {
    try {
      const c = importCareer(await f.text());
      await saveSlot(importSlot, c, metaOf(c, importSlot, playerOvr(user(c)), userClub(c).name));
      await app.refreshSlots();
      app.toast(`Carrière importée dans l'emplacement ${importSlot + 1}.`);
    } catch (e) {
      app.toast(`Import impossible : ${(e as Error).message}`);
    }
  };

  return (
    <div className="screen-pad fade-in">
      <div className="row spread" style={{ marginBottom: 20 }}>
        <Logo compact />
        <button className="btn ghost" onClick={() => app.go({ name: 'home' })}>
          ← Accueil
        </button>
      </div>
      <h2>{mode === 'load' ? 'Charger une carrière' : 'Supprimer une sauvegarde'}</h2>
      <p className="muted">Les sauvegardes sont conservées dans le navigateur de cet appareil (IndexedDB), avec une copie de secours automatique. Exportez-les pour les transférer.</p>
      <div className="grid cols-2" style={{ marginTop: 14 }}>
        {Array.from({ length: SLOT_COUNT }).map((_, i) => {
          const s = app.slots[i];
          return (
            <div className="card" key={i}>
              <div className="row spread">
                <h3>Emplacement {i + 1}</h3>
                {s && <span className="pill">{new Date(s.updatedAt).toLocaleDateString('fr-FR')}</span>}
              </div>
              {s ? (
                <>
                  <div style={{ fontSize: '1.2rem', fontWeight: 750, marginTop: 8 }}>{s.name}</div>
                  <div className="muted small">
                    {s.club} · saison {s.season}-{s.season + 1} · semaine {s.week} · note {s.ovr}
                  </div>
                  <div className="row wrap" style={{ marginTop: 12 }}>
                    {mode === 'load' ? (
                      <button className="btn primary small" onClick={() => load(i)}>
                        Charger
                      </button>
                    ) : (
                      <button className="btn danger small" onClick={() => setConfirm(i)}>
                        Supprimer
                      </button>
                    )}
                    <button className="btn small" onClick={() => exportSlot(i)}>
                      Exporter
                    </button>
                  </div>
                </>
              ) : (
                <div className="muted small" style={{ marginTop: 8 }}>
                  Emplacement libre
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Importer une sauvegarde</h3>
        <div className="row wrap" style={{ marginTop: 10 }}>
          <select className="input" style={{ width: 'auto' }} value={importSlot} onChange={(e) => setImportSlot(Number(e.target.value))} aria-label="Emplacement de destination">
            {Array.from({ length: SLOT_COUNT }).map((_, i) => (
              <option key={i} value={i}>
                Emplacement {i + 1} {app.slots[i] ? '(occupé — sera remplacé)' : '(libre)'}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Choisir un fichier .json
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
        </div>
      </div>
      {confirm !== null && (
        <Modal
          title="Supprimer la carrière ?"
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirm(null)}>
                Annuler
              </button>
              <button
                className="btn danger"
                onClick={async () => {
                  await deleteSlot(confirm);
                  if (app.slot === confirm) app.setCareer(null, null);
                  await app.refreshSlots();
                  setConfirm(null);
                  app.toast('Sauvegarde supprimée.');
                }}
              >
                Supprimer définitivement
              </button>
            </>
          }
        >
          <p>
            La carrière de <b>{app.slots[confirm]?.name}</b> sera effacée de cet appareil. Cette action est irréversible (pensez à l'exporter).
          </p>
        </Modal>
      )}
    </div>
  );
}
