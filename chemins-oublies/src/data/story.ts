// Quêtes, indices, annotations de l'atlas, aides progressives. Données pures : aucune logique d'affichage.
import { S, flag, has } from '../core/state';

export const CLUES: Record<string, { title: string; text: string }> = {
  agathe: { title: 'Agathe, aubergiste', text: "Le Moulin des Trois-Eaux figurait sur toutes les cartes il y a cinq ans. Elle croit qu'il était « au sud, après les champs »… sans en être sûre." },
  ninon: { title: 'Ninon', text: "La route passait par la place et le pont, puis « montait, montait ». Elle finit au rocher fendu qui a l'air de bâiller : « la dernière pierre le regarde »." },
  salome: { title: 'Salomé, archiviste', text: "Carte de 1802 : la route partait de la place, franchissait le pont et remontait la rivière. Règle des anciens : chaque borne regardait la suivante, la dernière regardait le lieu à atteindre." },
  basile: { title: 'Basile, facteur', text: "Depuis la place, la route partait « plein vers le soleil levant » jusqu'au pont. Ensuite, elle « tournait vers le nord, vers les bois »." },
  mara_eau: { title: 'Mara, herboriste', text: "Dans le Bois, les anciens saluaient toujours la rivière en premier : « c'est l'eau qui réveille les chemins »." },
  mara_creatures: { title: 'Mara : les créatures', text: "Quand un ronceux gonfle, il frappe tout autour de lui : s'écarter. Un murmure fonce en ligne droite : faire un pas de côté." },
  frag_borne: { title: 'Borne du Bois', text: "Inscription à demi effacée : « …l'oiseau ne chante qu'après que l'eau s'est éveillée… »" },
  frag_pont: { title: 'Pont en ruine', text: "Gravé sur le pilier : « …et la clé se tourne en dernier, toujours. »" },
  anton_lune: { title: "Frottis d'Anton", text: "Relevé sur une pierre brisée : « La lune n'ouvre aucun chemin : elle les cache. »" },
  anton_roue: { title: 'Anton : la roue', text: "« La roue est vieille et lourde : un filet d'eau ne la fera jamais tourner. Il lui faut un coup d'eau. » Et il serrait toujours le frein, à l'intérieur." },
  journal_meunier: { title: 'Journal du meunier', text: "Vanne de prise : laisse entrer la rivière dans le bief. Vanne de décharge : vide le bief vers la rivière. Vanne motrice : lâche l'eau du bief sur la roue. « La vieille roue ne démarre qu'avec un bief plein, lâché d'un seul coup. »" },
  registre: { title: 'Registre des rues', text: "« Chemin des Saules — rayé l'an dernier. Trois maisons : Verdier, Bastien, Lerouge. » Verdier est le nom d'Anton, le meunier." },
};

export const NOTES: Record<string, { title: string; text: string }> = {
  maelys_depart: { title: 'Première page', text: "Au crayon, de la main de Maëlys : « Clairval. Commencer par les bornes. Écouter ceux qui se souviennent mal : ils se souviennent quand même. »" },
  note_bornes: { title: 'Trace retrouvée', text: "La route quittait la place vers l'est, franchissait le pont, montait plein nord puis au nord-est, jusqu'au rocher fendu. Au-delà, la page reste blanche." },
  note_lettre: { title: 'La lettre à Anton', text: "Maëlys avait écrit à Anton avant qu'il oublie le chemin de son moulin. Elle savait que l'Effacement allait le toucher." },
  note_passage: { title: 'Sentier caché', text: "Derrière les ronces, à l'ouest du Bois, un ancien sentier mène à une clairière oubliée." },
  note_pierres: { title: 'Les pierres gravées', text: "L'eau, puis l'oiseau, puis la clé. La lune, elle, cachait le chemin. La brume s'est retirée vers le nord." },
  note_page: { title: 'Page de carnet', text: "« Les Conservateurs ne détruisent pas les chemins, ils les mettent à l'abri. Reste à savoir de quoi. — M. »" },
  note_finale: { title: 'Sous le moulin', text: "« Cette route n'a pas été oubliée. Elle a été effacée — volontairement. Le gardien des ronces n'était pas là pour te barrer la route : il gardait le silence de la roue. Les Conservateurs savent pourquoi. Ne me cherche pas encore à Brumecime. — M. »" },
};

export interface QuestStep { id: string; title: string; text: () => string; done: () => boolean; hints: string[] }

export const MAIN: QuestStep[] = [
  { id: 'arrivee', title: 'Arrivée à Clairval', text: () => "Une vieille borne, à l'entrée du village, indique une direction où il n'y a aucune route. L'examiner.", done: () => flag('borne_vue'), hints: ["Touchez la borne de pierre juste devant vous, au bord du chemin.", "Un toucher sur un objet : Éloi s'en approche et l'examine tout seul."] },
  { id: 'agathe', title: "Le Pot d'Étain", text: () => "Maëlys a logé à l'auberge au printemps. Parler à Agathe, l'aubergiste.", done: () => flag('agathe_moulin'), hints: ["L'auberge est le grand bâtiment au nord de la place, avec une enseigne.", "Agathe est dehors le matin et le soir, et derrière son comptoir l'après-midi. Le Journal (onglet Habitants) indique où elle se trouve.", "Touchez Agathe : Éloi la rejoint et lui parle."] },
  { id: 'temoins', title: 'Les trois témoignages', text: () => { const n = ['t_ninon', 't_salome', 't_basile'].filter(flag).length; return `Recueillir les souvenirs de Ninon, de Salomé et de Basile sur la route du moulin (${n}/3).`; }, done: () => flag('t_ninon') && flag('t_salome') && flag('t_basile'), hints: ["Ninon joue près de la fontaine. Salomé est aux Archives (bâtiment de pierre à l'est de l'auberge). Basile fait sa tournée de facteur.", "Le Journal, onglet Habitants, indique où chacun se trouve à cette heure-ci.", "Les témoignages se retrouvent dans l'Atlas, onglet Indices."] },
  { id: 'bornes', title: 'Les trois bornes', text: () => "Les trois anciennes bornes ont été tournées. Les réorienter pour reconstituer la direction de la route effacée.", done: () => flag('bornes_solved'), hints: ["Relisez les indices dans l'Atlas. Salomé donne la règle : chaque borne regarde la suivante, la dernière regarde le lieu à atteindre.", "La première borne (près de la place) doit regarder la deuxième, de l'autre côté du pont. La deuxième regarde la troisième, plus haut. La troisième regarde le rocher fendu dont parle Ninon.", "Première borne : vers l'est. Deuxième : vers le nord. Troisième : vers le nord-est."] },
  { id: 'bois', title: 'Le droit de passage', text: () => { const a = flag('boussole_ok') ? '✓' : '·'; return `Théodore garde l'entrée du Bois des Murmures. Il exige une boussole qui fonctionne. [${a}] Faire réparer la boussole de Maëlys par Coline, puis convaincre Théodore.`; }, done: () => flag('theo_ok'), hints: ["Coline, l'artisane, travaille dans son atelier à l'ouest de la place.", "Coline a besoin d'une pierre d'aimant. Mara, l'herboriste, en possède une.", "Avec la boussole réparée et la trace des bornes, retournez voir Théodore à la porte nord."] },
  { id: 'anton', title: 'Le meunier perdu', text: () => "Traverser le Bois des Murmures. Anton le meunier y a disparu il y a trois semaines.", done: () => flag('anton_found'), hints: ["Suivez le sentier principal vers le nord. La boussole, en haut de l'écran, indique la direction à suivre.", "Des ronceux gardent le passage : touchez-les pour frapper, et éloignez-vous quand ils gonflent.", "Après la clairière des ronceux, un sentier part vers l'est : on y voit de la fumée."] },
  { id: 'pierres', title: 'Les pierres gravées', text: () => "Une brume épaisse ferme le nord du Bois. Quatre pierres gravées l'entourent : les toucher dans le bon ordre.", done: () => flag('stones_solved'), hints: ["Il existe trois inscriptions : la borne de la première clairière, le pont en ruine à l'est, et le frottis d'Anton. Mara connaît aussi une coutume.", "La lune n'ouvre aucun chemin : elle n'en fait pas partie. L'eau vient en premier, la clé en dernier.", "Touchez : l'eau, puis l'oiseau, puis la clé."] },
  { id: 'gardien', title: 'Le Gardien des Ronces', text: () => "Des ronces vivantes enserrent le moulin. Quelqu'un les a plantées là pour que la roue se taise. Libérer le moulin.", done: () => flag('boss_done'), hints: ["Approchez-vous du moulin : le gardien se réveillera.", "Ses ronces sont invulnérables. Esquivez les zones rouges (bouton « Esquive » ou en vous déplaçant), puis frappez son cœur d'ambre quand ses pétales s'ouvrent.", "Seconde moitié du combat : il charge en ligne droite. S'il vous rate, il s'étourdit contre le bord de l'arène — c'est le moment de frapper."] },
  { id: 'moulin', title: 'Le Moulin des Trois-Eaux', text: () => "Le moulin est là, à l'abandon. Entrer et comprendre pourquoi sa roue est immobile.", done: () => flag('brake_released') && flag('journal_lu'), hints: ["La clé d'Anton ouvre la porte du moulin.", "À l'intérieur : lisez le journal du meunier sur le bureau, et regardez le grand levier rouge.", "Le frein de la roue est serré : touchez le levier pour le desserrer."] },
  { id: 'roue', title: "Le coup d'eau", text: () => "Remettre l'eau en mouvement : trois leviers commandent la prise d'eau, la décharge et la vanne motrice.", done: () => flag('mill_running'), hints: ["Observez le bief (le canal au-dessus de la roue) et sa jauge. Que fait chaque vanne à son niveau ?", "Tant que la décharge est ouverte, le bief se vide dans la rivière : il ne peut pas se remplir.", "Fermez la décharge, ouvrez la prise d'eau, attendez que le bief soit plein, puis ouvrez la vanne motrice."] },
  { id: 'route', title: 'La route retrouvée', text: () => "La roue tourne. Quelque chose se dessine dans l'atlas… Consulter l'atlas près du moulin.", done: () => flag('chapter_done'), hints: ["Ouvrez l'Atlas (icône en haut à droite) près du moulin.", "Dans l'Atlas, touchez « Consulter ici »."] },
];

export const SIDE: { id: string; title: string; started: () => boolean; text: () => string; done: () => boolean }[] = [
  {
    id: 'lettre', title: 'La Lettre sans destinataire', started: () => flag('lettre_recue'), done: () => flag('lettre_livree'),
    text: () => flag('lettre_livree') ? "La lettre de Maëlys est arrivée à Anton." : flag('lettre_registre') ? "La famille Verdier est celle d'Anton, le meunier. Lui remettre la lettre." : "Basile ne trouve pas le « chemin des Saules ». Les Archives gardent peut-être sa trace.",
  },
  {
    id: 'jardin', title: 'Le Jardin de Mara', started: () => flag('jardin_accepte'), done: () => flag('jardin_fini'),
    text: () => { if (flag('jardin_fini')) return 'Mara a retrouvé ses trois plantes.'; const n = ['sauge', 'pied_de_loup', 'fleur_lanterne'].filter((i) => has(i)).length; return `Cueillir dans le Bois la sauge des brumes (ruisseau), le pied-de-loup (première clairière) et la fleur-lanterne (près des pierres) : ${n}/3.`; },
  },
];

export function currentMainStep(): QuestStep | null {
  return MAIN.find((s) => !s.done()) ?? null;
}

export const SECRETS_TOTAL = 3;
export const SECRET_LABEL: Record<string, string> = { passage: 'Le sentier caché', pont: 'La boîte sous le pont', coffre: 'Le coffre des ronces' };

export function chapterProgress(): number {
  const i = MAIN.findIndex((s) => !s.done());
  return i < 0 ? 1 : i / MAIN.length;
}
export { S };
