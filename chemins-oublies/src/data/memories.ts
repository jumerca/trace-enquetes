// Souvenirs jouables : courtes scènes en flash-back (teinte sépia) où l'on voit Éloi apprendre auprès de Maëlys.
// Chaque souvenir se déclenche une seule fois, après une étape clé, et laisse une annotation dans l'atlas.
import type { Line } from './dialogues';

export interface Memory {
  /** Les acteurs du souvenir, placés autour d'Éloi (dx, dy en pixels du monde). */
  cast: { id: string; dx: number; dy: number }[];
  /** true : Éloi enfant remplace le héros pendant la scène. */
  child: boolean;
  lines: Line[];
  /** Ce qu'Éloi en dit, une fois revenu au présent. */
  after: Line[];
  note: string;
}

const Ma = (t: string, m?: Line['m']): Line => ({ s: 'maelys', t, m });
const J = (t: string, m?: Line['m']): Line => ({ s: 'eloi_jeune', t, m });
const E = (t: string, m?: Line['m']): Line => ({ s: 'eloi', t, m });
const N = (t: string): Line => ({ s: 'narr', t });

export const MEMORIES: Record<string, Memory> = {
  borne: {
    cast: [{ id: 'maelys', dx: -78, dy: -6 }, { id: 'eloi_jeune', dx: -24, dy: 8 }],
    child: true,
    lines: [
      N('Souvenir — Six ans plus tôt, sur les collines de Valrive.'),
      J("Maëlys ! Encore un caillou avec une flèche. On le met sur la carte ?", 'joie'),
      Ma("Ce n'est pas un caillou, Éloi. C'est une borne. Quelqu'un l'a posée là pour que les autres ne se perdent pas."),
      Ma("Une borne, c'est une promesse : « D'ici, on arrive quelque part. »"),
      J("Et si plus personne ne se souvient où ?", 'souci'),
      Ma("Alors on demande aux gens. Ils se souviennent toujours un peu. Même mal.", 'joie'),
      Ma("Surtout mal, d'ailleurs. Écoute ceux qui se trompent, petit : leurs erreurs dessinent le contour de la vérité."),
      J("C'est une phrase de cartographe, ça ?"),
      Ma("C'est une phrase de Maëlys. Note-la quand même.", 'joie'),
    ],
    after: [
      E("« Écouter ceux qui se souviennent mal. » Elle l'a même écrit sur la première page de l'atlas."),
      E("J'avais onze ans. Je dessinais des cartes du village à la craie sur les murs de l'école. C'est comme ça qu'elle m'a remarqué… et qu'elle m'a évité une punition.", 'joie'),
    ],
    note: 'mem_borne',
  },
  boussole: {
    cast: [{ id: 'maelys', dx: 34, dy: 0 }, { id: 'eloi_jeune', dx: -30, dy: 4 }],
    child: true,
    lines: [
      N("Souvenir — Quatre ans plus tôt. L'atelier de Maëlys, un soir d'orage."),
      J("Elle est cassée, ta boussole. Elle ne montre même pas le nord.", 'colere'),
      Ma("Elle n'a jamais montré le nord. Le nord, tout le monde sait le trouver."),
      Ma("Celle-ci montre les chemins qui veulent qu'on les retrouve."),
      J("Un chemin, ça ne « veut » rien. C'est un chemin."),
      Ma("Tu verras. Un jour, je te la donnerai.", 'joie'),
      J("Quand ?"),
      Ma("Le jour où tu sauras te perdre sans avoir peur."),
    ],
    after: [
      E("Elle ne me l'a jamais donnée. Je l'ai trouvée sur son bureau, l'aiguille morte, le matin où elle est partie.", 'souci'),
      E("Alors disons que je sais me perdre sans avoir peur. À peu près. Les jours de soleil.", 'joie'),
    ],
    note: 'mem_boussole',
  },
  dispute: {
    cast: [{ id: 'maelys', dx: 40, dy: -2 }],
    child: false,
    lines: [
      N("Souvenir — Il y a six mois. La veille du départ de Maëlys."),
      Ma("Je pars demain. Seule.", 'souci'),
      E("Encore ? C'est la troisième fois cette année. Et tu ne me dis jamais où.", 'colere'),
      Ma("Moins tu en sais, mieux tu es protégé."),
      E("Protégé de quoi ? Je suis ton apprenti, pas ton chat !", 'colere'),
      Ma("Il y a des gens qui n'aiment pas qu'on redessine certains chemins, Éloi. Des gens très patients.", 'souci'),
      E("Alors emmène-moi. J'ai besoin que tu me fasses confiance."),
      Ma("Je te fais confiance. C'est pour ça que je te laisse l'atlas."),
      E("Garde-le, ton atlas !", 'colere'),
      N("La porte a claqué. Le lendemain matin, la maison était vide. L'atlas attendait sur la table, ouvert à une page blanche."),
    ],
    after: [
      E("Je ne lui ai même pas dit au revoir.", 'souci'),
      E("« Des gens très patients. » Des gens qui effacent un chemin, puis attendent que tout le monde l'oublie…", 'souci'),
      E("Cette fois, je ne claquerai pas la porte. Je vais te retrouver, Maëlys."),
    ],
    note: 'mem_dispute',
  },
};
