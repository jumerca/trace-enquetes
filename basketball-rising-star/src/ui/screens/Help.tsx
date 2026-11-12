import { useApp, type Screen } from '../App';
import { Logo } from '../components/Art';
import { keyLabel } from '../settings';

export function Help({ back }: { back: Screen }) {
  const app = useApp();
  const k = app.settings.keys;
  return (
    <div className="screen-pad fade-in">
      <div className="row spread" style={{ marginBottom: 18 }}>
        <Logo compact />
        <button className="btn" onClick={() => app.go(back)}>
          ← Retour
        </button>
      </div>
      <h2 style={{ marginBottom: 12 }}>Comment jouer</h2>
      <div className="grid cols-2">
        <div className="card">
          <h3>Le principe</h3>
          <p>
            Vous incarnez <b>un seul joueur</b>, pas l'équipe. Les neuf autres basketteurs sont pilotés par une IA qui lit le jeu : espacements, écrans, coupes, aides défensives, rotations, rebonds. Votre coach gère les rotations : il faut gagner sa confiance pour obtenir des minutes.
          </p>
          <p>
            Chaque semaine : choisissez votre programme d'entraînement, jouez (ou simulez) le match, puis passez à la semaine suivante. En fin de saison, les clubs intéressés font des offres.
          </p>
        </div>
        <div className="card">
          <h3>Commandes au clavier</h3>
          <ul className="small" style={{ paddingLeft: 18, margin: '8px 0' }}>
            <li>
              Se déplacer : {keyLabel(k.up)} {keyLabel(k.left)} {keyLabel(k.down)} {keyLabel(k.right)} ou flèches · Sprint : {keyLabel(k.sprint)}
            </li>
            <li>
              Avec le ballon : <b>{keyLabel(k.shoot)}</b> tirer (maintenez, relâchez au sommet du saut — la jauge dorée indique le bon moment ; près du cercle : lay-up ou dunk automatiquement), <b>{keyLabel(k.pass)}</b> passe (vers la direction du déplacement, sinon vers le partenaire le plus libre), <b>{keyLabel(k.lob)}</b> passe lobée, <b>{keyLabel(k.action)}</b> dribble de débordement si un défenseur est au contact (crossover, entre les jambes ou dans le dos selon votre technique), sinon appeler un écran.
            </li>
            <li>
              Sans ballon en attaque : <b>{keyLabel(k.shoot)}</b> couper vers le cercle, <b>{keyLabel(k.pass)}</b> demander le ballon, <b>{keyLabel(k.action)}</b> poser un écran au porteur.
            </li>
            <li>
              En défense : <b>{keyLabel(k.shoot)}</b> sauter pour contrer / contester, <b>{keyLabel(k.pass)}</b> tenter une interception (attention aux fautes).
            </li>
            <li>Tab : statistiques en direct · {keyLabel(k.pause)} ou P : pause</li>
          </ul>
        </div>
        <div className="card">
          <h3>Sur téléphone et tablette</h3>
          <p className="small">Joystick à gauche (poussez au bord pour sprinter), boutons contextuels à droite : leur libellé change selon que vous avez le ballon, que vous attaquez sans ballon ou que vous défendez. Jouez en mode paysage pour voir tout le terrain.</p>
          <p className="small">Si vous ne touchez à rien pendant ~2 secondes, l'assistance IA déplace votre joueur intelligemment (désactivable dans la pause).</p>
        </div>
        <div className="card">
          <h3>Règles</h3>
          <p className="small">
            Règlement FIBA (Europe) : 24 s (14 s après rebond offensif), 8 s pour franchir le milieu, 3 s dans la raquette, retour en zone, 5 fautes personnelles, lancers de pénalité dès la 5e faute d'équipe du quart-temps, possession alternée. La ligue universitaire fictive NCB joue en 4×10 min avec 30 s. Seule la durée des quarts-temps peut être raccourcie (option arcade signalée).
          </p>
          <p className="small muted">Toutes les équipes, ligues et joueurs sont fictifs.</p>
        </div>
      </div>
    </div>
  );
}
