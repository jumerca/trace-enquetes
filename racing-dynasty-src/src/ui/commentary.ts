// Commentateur de course : transforme les événements du moteur en répliques façon BD.
import type { RaceEvent } from '../engine/types';

const pick = <T,>(arr: T[], seed: number): T => arr[Math.abs(Math.floor(seed)) % arr.length];

/** Nom court d'un pilote à partir de son identifiant (fourni par l'appelant). */
export type NameOf = (id?: string) => string;

/** Réplique du commentateur pour un événement, ou null s'il ne mérite pas de commentaire. */
export function comment(e: RaceEvent, idx: number, name: NameOf, isMine: (id?: string) => boolean): { text: string; mood: 'excite' | 'grave' | 'calme' } | null {
  const a = name(e.carId), b = name(e.otherId);
  const mine = isMine(e.carId) || isMine(e.otherId);
  switch (e.kind) {
    case 'depart':
      if (/Feux éteints/.test(e.text)) return { text: pick(['Et c’est parti ! Les feux s’éteignent !', 'Extinction des feux… GO GO GO !', 'Le départ est donné, quelle envolée !'], idx), mood: 'excite' };
      return null;
    case 'depassement':
      return {
        text: pick([
          `${a} plonge à l’intérieur… et passe ${b} !`,
          `Quel freinage de ${a} ! ${b} n’a rien pu faire.`,
          `${a} prend l’aspiration et déborde ${b} !`,
          `Dépassement autoritaire de ${a} sur ${b} !`,
          `${b} se fait surprendre par ${a} !`,
        ], idx) + (isMine(e.carId) ? ' Belle opération pour votre écurie !' : isMine(e.otherId) ? ' Dommage pour votre écurie…' : ''),
        mood: 'excite',
      };
    case 'contact':
      return { text: pick([`Aïe ! Contact entre ${a} et ${b} !`, `Ça frotte entre ${a} et ${b} ! Les commissaires regardent.`, `Accrochage ! ${a} et ${b} se touchent !`], idx), mood: 'grave' };
    case 'tete-a-queue':
      return { text: pick([`Tête-à-queue pour ${a} ! Il a perdu l’arrière.`, `${a} part en toupie !`, `Oh ! ${a} est en travers !`], idx), mood: 'grave' };
    case 'sortie':
      return idx % 2 ? { text: `${a} tire tout droit… il coupe par le dégagement.`, mood: 'calme' } : null;
    case 'abandon':
      return { text: pick([`Coup dur ! ${a} doit abandonner.`, `C’est fini pour ${a}, quelle déception.`, `${a} se range sur le bas-côté…`], idx), mood: 'grave' };
    case 'securite':
      if (/déployée/.test(e.text)) return { text: 'Voiture de sécurité ! Le peloton va se regrouper, les stratégies vont bouger !', mood: 'grave' };
      if (/rentre/.test(e.text)) return { text: 'La voiture de sécurité rentre ! Tout le monde se prépare à la relance !', mood: 'excite' };
      return null;
    case 'jaune':
      return /vert/.test(e.text) ? { text: 'Drapeau vert, on repart à fond !', mood: 'calme' } : { text: 'Drapeau jaune agité : on lève le pied dans ce secteur.', mood: 'grave' };
    case 'meteo':
      return { text: /tomber/.test(e.text) ? 'Les premières gouttes ! Qui va rentrer chausser les pneus pluie ?' : /détrempée/.test(e.text) ? 'La piste est un miroir, il faut des pneus pluie !' : 'Le soleil revient, la trajectoire sèche à vue d’œil.', mood: 'calme' };
    case 'meilleur-tour':
      return idx % 3 === 0 ? { text: `Tour rapide pour ${a} ! Il met le chrono sous pression.`, mood: 'calme' } : null;
    case 'penalite':
      return /Pénalité/.test(e.text) ? { text: `Les commissaires sanctionnent ${a} !`, mood: 'grave' } : null;
    case 'consigne':
      return /laisse passer/.test(e.text) ? { text: `Consigne d’équipe ! ${b} s’écarte pour ${a}.`, mood: 'calme' } : null;
    case 'stand':
      return mine ? { text: `Arrêt au stand pour ${a} : les mécaniciens s’activent !`, mood: 'calme' } : null;
    case 'drapeau':
      return { text: `DRAPEAU À DAMIER ! ${a} remporte la course !`, mood: 'excite' };
    default:
      return null;
  }
}
