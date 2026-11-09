import { useEffect, useState } from 'react';
import { useApp } from '../App';
import { HeroArt, Logo } from '../components/Art';
import { loadSlot } from '../../save/db';
import { canPromptInstall, isIos, isStandalone, onInstallChange, promptInstall } from '../pwa';
import { Modal } from '../components/Modal';

export function Home() {
  const app = useApp();
  const [installHelp, setInstallHelp] = useState<string | null>(null);
  const [, force] = useState(0);
  useEffect(() => onInstallChange(() => force((x) => x + 1)), []);
  const latest = app.slots.map((s, i) => (s ? { ...s, i } : null)).filter(Boolean).sort((a, b) => b!.updatedAt - a!.updatedAt)[0];

  const cont = async () => {
    if (!latest) {
      app.toast('Aucune carrière sauvegardée : commencez une nouvelle carrière.');
      return;
    }
    try {
      const { career, fromBackup } = await loadSlot(latest.slot);
      app.setCareer(career, latest.slot);
      if (fromBackup) app.toast('Sauvegarde endommagée : la copie de secours a été chargée.');
      app.go({ name: 'hub', tab: 'home' });
    } catch (e) {
      app.toast((e as Error).message);
    }
  };

  const install = async () => {
    if (isStandalone()) {
      app.toast('Le jeu est déjà installé sur cet appareil.');
      return;
    }
    if (canPromptInstall()) {
      const r = await promptInstall();
      app.toast(r === 'accepted' ? 'Installation lancée.' : 'Installation annulée.');
      return;
    }
    if (isIos()) setInstallHelp('Sur iPhone / iPad : ouvrez ce jeu dans Safari, touchez le bouton Partager puis « Sur l’écran d’accueil ».');
    else if (location.protocol !== 'https:' && location.hostname !== 'localhost') setInstallHelp('L’installation nécessite une connexion HTTPS. Ouvrez la version publiée du jeu (adresse en https://) pour l’installer.');
    else setInstallHelp('Votre navigateur ne propose pas encore l’installation automatique. Utilisez le menu du navigateur (⋮) puis « Installer l’application » ou « Ajouter à l’écran d’accueil ». Chrome, Edge et Samsung Internet sont compatibles.');
  };

  return (
    <div className="home">
      <div className="home-art">
        <HeroArt />
      </div>
      <nav className="home-menu fade-in" aria-label="Menu principal">
        <Logo />
        <p className="muted" style={{ margin: '4px 0 14px', maxWidth: 380 }}>
          Du centre de formation aux plus grandes salles : construisez la carrière d'un futur grand du basket.
        </p>
        <button className="btn primary" onClick={() => app.go({ name: 'create' })}>
          ▶ Nouvelle carrière
        </button>
        <button className="btn" onClick={cont}>
          ⟳ Continuer {latest && <span className="k">{latest.name} · {latest.season}</span>}
        </button>
        <button className="btn" onClick={() => app.go({ name: 'saves', mode: 'load' })}>
          ⇩ Charger une carrière
        </button>
        <button className="btn" onClick={() => app.go({ name: 'match', quick: true })}>
          ⚡ Match rapide <span className="k">sans carrière</span>
        </button>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => app.go({ name: 'settings', back: { name: 'home' } })}>
            ⚙ Paramètres
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={() => app.go({ name: 'help', back: { name: 'home' } })}>
            ? Comment jouer
          </button>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn ghost" style={{ flex: 1 }} onClick={install}>
            ⬇ Installer le jeu
          </button>
          <button className="btn ghost danger" style={{ flex: 1 }} onClick={() => app.go({ name: 'saves', mode: 'delete' })}>
            🗑 Supprimer une sauvegarde
          </button>
        </div>
        <div className="signature" style={{ marginTop: 14 }}>
          JLG CREATIVE
        </div>
      </nav>
      {installHelp && (
        <Modal title="Installer Basketball Rising Star" onClose={() => setInstallHelp(null)}>
          <p>{installHelp}</p>
        </Modal>
      )}
    </div>
  );
}
