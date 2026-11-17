// Dialogues des habitants : salutation selon la situation, puis sujets disponibles.
// Effets déclaratifs : 'flag:x', 'give:objet', 'take:objet', 'clue:id', 'note:id', 'log:texte', 'baume:3', 'save', 'quest'.
import { S, flag, has, phaseOf } from '../core/state';

export type Mood = 'neutre' | 'joie' | 'souci' | 'surprise' | 'colere';
export interface Line { s: string; t: string; m?: Mood }
export interface Topic { id: string; label: string; cond?: () => boolean; lines: () => Line[]; fx?: string[]; once?: boolean; anim?: 'work' }
export interface NpcDialog { name: string; role: string; greet: () => { lines: Line[]; fx?: string[] }; topics: Topic[] }

const E = (t: string, m?: Mood): Line => ({ s: 'eloi', t, m });
const say = (s: string) => (t: string, m?: Mood): Line => ({ s, t, m });
const A = say('agathe'), N = say('ninon'), Sa = say('salome'), B = say('basile'), M = say('mara'), C = say('coline'), T = say('theodore'), An = say('anton');
const ph = () => phaseOf(S.clock);

export const DIALOGS: Record<string, NpcDialog> = {
  agathe: {
    name: 'Agathe', role: "Aubergiste du Pot d'Étain",
    greet: () => {
      if (!flag('met_agathe')) return {
        lines: [
          A("Tiens, une tête nouvelle ! Bienvenue à Clairval. Agathe, du Pot d'Étain, pour vous servir.", 'joie'),
          E("Éloi. Je suis cartographe… enfin, apprenti. Je cherche Maëlys, ma mentore. Sa dernière lettre venait d'ici."),
          A("Maëlys ? La dame aux cartes ! Elle a dormi chez moi au printemps. Elle ne parlait que du moulin.", 'surprise'),
          E("Quel moulin ? Il n'y en a aucun sur ma carte."),
          A("C'est bien ça le problème. Le Moulin des Trois-Eaux était sur toutes les cartes il y a cinq ans. Et puis la route s'est… effacée. Plus personne ne se rappelle le chemin.", 'souci'),
          A("Moi, je dirais qu'il était au sud, après les champs. Ou peut-être pas. Ça me file entre les doigts, comme un rêve au réveil.", 'souci'),
          A("Demandez aux autres. Chacun en garde un morceau : la petite Ninon, près de la fontaine ; Salomé, aux Archives ; et Basile, le facteur. Il y a porté le courrier pendant vingt ans."),
        ],
        fx: ['flag:met_agathe', 'flag:agathe_moulin', 'clue:agathe', 'log:Agathe se souvient du moulin, mais pas du chemin.', 'quest', 'save'],
      };
      if (flag('chapter_done')) return { lines: [A("Une route ! Une vraie route, qui part du pont ! Tout le village est sorti la regarder. Éloi… merci.", 'joie')] };
      if (flag('mill_running')) return { lines: [A("On entend un grondement, du côté de la rivière. Comme une roue. Je n'osais plus l'espérer.", 'surprise')] };
      if (flag('anton_found')) return { lines: [A("Il paraît que vous avez retrouvé Anton, vivant ! Je lui garde sa table près de la fenêtre. Et une soupe. Une très grande soupe.", 'joie')] };
      if (ph() === 'matin' && S.zone === 'clairval') return { lines: [A("Je balaie avant les clients. S'il en vient. Vous avez avancé ?")] };
      if (ph() === 'soir' && S.zone === 'clairval') return { lines: [A("Je ferme les volets. La nuit, les anciens disaient que les chemins bougent. Moi, je ferme quand même.", 'souci')] };
      return { lines: [A("Asseyez-vous, je vous sers quelque chose ? C'est la maison qui offre aux chercheurs de moulins.", 'joie')] };
    },
    topics: [
      { id: 'effacement', label: "L'Effacement ?", lines: () => [A("C'est comme ça qu'on dit, ici. Un matin, on cherche un chemin qu'on a pris mille fois, et nos pieds ne le trouvent plus."), A("Les anciens racontent que ça arrive aux lieux dont plus personne ne parle. Moi, je trouve qu'on en parlait beaucoup, de ce moulin.", 'souci')] },
      { id: 'anton', label: 'Le meunier ?', lines: () => [A("Anton Verdier. Je servais sa farine tous les matins. Il est parti il y a trois semaines « retrouver son moulin », et il n'est pas revenu.", 'souci'), A("Théodore a fouillé le Bois jusqu'à l'orée. Pas plus loin : il dit qu'on s'y perd.")] },
      { id: 'maelys', label: 'Maëlys, ici ?', lines: () => [A("Trois nuits dans la chambre du fond. Elle étalait ses cartes partout, même sur mes tables. Elle chantonnait en écrivant."), A("Le dernier matin, elle m'a demandé : « Agathe, si quelqu'un vient avec mon atlas, vous lui donnerez à manger ? » J'ai cru qu'elle plaisantait.", 'souci')] },
      { id: 'bornes', label: 'Les vieilles bornes', cond: () => flag('bornes_solved'), lines: () => [A("Vous avez fait tourner les vieilles bornes ? Mon grand-père disait qu'elles « se parlaient ». J'ai toujours cru que c'était une façon de dire.", 'surprise')] },
    ],
  },

  ninon: {
    name: 'Ninon', role: 'Enfant du village',
    greet: () => {
      if (!flag('t_ninon')) return {
        lines: [
          N("Toi aussi tu cherches le chemin qui n'existe pas ?"),
          E("Tu le connais ?", 'surprise'),
          N("Je le VOIS. Des fois. Le soir, quand je plisse les yeux. Les grands disent que j'invente.", 'colere'),
          N("Il part de la place, il passe le pont, et après il monte, il monte… et il finit au gros rocher fendu. Celui qui a l'air de bâiller."),
          N("La dernière pierre le regarde, toujours. Comme si elle attendait qu'il se réveille.", 'joie'),
          E("La dernière pierre… une borne ?"),
          N("Je sais pas comment ça s'appelle. Une pierre avec une flèche. Il y en a trois."),
        ],
        fx: ['flag:met_ninon', 'flag:t_ninon', 'clue:ninon', 'log:Ninon voit le chemin qui finit au rocher fendu.', 'quest', 'save'],
      };
      if (flag('chapter_done')) return { lines: [N("Tu vois ? Je l'avais dit. JE L'AVAIS DIT !", 'joie')] };
      if (flag('anton_found')) return { lines: [N("C'est vrai que le meunier vivait dans le Bois comme un ours ? Paulin dit qu'il avait des feuilles dans la barbe.", 'joie')] };
      if (flag('bornes_solved')) return { lines: [N("Tu les as réveillées, les pierres ! Il y avait de la lumière, je l'ai vue !", 'surprise')] };
      return { lines: [N("Chut, je me cache. Paulin compte jusqu'à cent. Enfin, il dit qu'il compte.")] };
    },
    topics: [
      { id: 'rocher', label: 'Le rocher qui bâille ?', lines: () => [N("De l'autre côté du pont, tout en haut, vers les ronces. Maman dit de pas y aller."), N("J'y vais quand même. Chut.", 'joie')] },
      { id: 'garde', label: 'Qui avait tourné les bornes ?', cond: () => flag('bornes_solved'), lines: () => flag('ninon_garde') ? [N("Je t'ai déjà dit. Le monsieur au chapeau en fer. Et c'est un secret.")] : [N("…Je sais pas si j'ai le droit de le dire.", 'souci'), E("Tu as vu quelqu'un ?"), N("Un soir, il y a longtemps. J'étais toute petite. Un monsieur tournait la pierre près de la fontaine. Il avait un chapeau en fer.", 'souci'), N("Il pleurait, je crois. Après, il m'a donné un sucre d'orge et il a dit que c'était un jeu. Que fallait pas le dire."), E("Un chapeau en fer… Il n'y en a qu'un, à Clairval.", 'surprise')], fx: ['flag:ninon_garde', 'clue:ninon_garde', 'log:Ninon a vu un homme au chapeau de fer tourner une borne.', 'quest', 'save'] },
      { id: 'jeu', label: 'Tu joues à quoi ?', lines: () => [N("À chat avec Paulin. Il triche, il court trop vite."), N("Toi tu marches bizarre. Tu regardes toujours par terre, comme si t'avais perdu un bouton.", 'joie'), E("C'est le métier. Les cartographes regardent où ils mettent les pieds.")] },
    ],
  },

  salome: {
    name: 'Salomé', role: 'Archiviste de Clairval',
    greet: () => {
      if (!flag('t_salome')) return {
        lines: [
          Sa("Fermez la porte, je vous prie. Le courant d'air abîme les cartes."),
          Sa("Vous portez l'atlas de Maëlys. Elle m'avait prévenue qu'un jeune homme viendrait, tôt ou tard.", 'surprise'),
          E("Elle est venue ici ?"),
          Sa("Trois jours penchée sur mes registres. Puis elle est partie sans dire où. Elle fait toujours ça.", 'souci'),
          Sa("Regardez cette carte de 1802. La route du moulin partait de la place, franchissait le pont et remontait le long de la rivière. Et voyez ces trois points : les bornes de Clairval."),
          Sa("Les anciens cartographes avaient une règle : chaque borne regardait la suivante, et la dernière regardait le lieu à atteindre. Ainsi, personne ne se perdait."),
          E("Les bornes existent encore ?"),
          Sa("Trois vieilles pierres, oui. Quelqu'un s'est amusé à les tourner dans tous les sens. Ou quelqu'un a voulu qu'on ne puisse plus les lire.", 'souci'),
        ],
        fx: ['flag:met_salome', 'flag:t_salome', 'clue:salome', 'log:Salomé connaît la règle des bornes.', 'quest', 'save'],
      };
      if (flag('chapter_done')) return { lines: [Sa("Une route de plus sur la carte. Je vais devoir tout recopier."), Sa("C'est le plus beau travail qu'on m'ait donné depuis des années.", 'joie')] };
      if (flag('anton_found')) return { lines: [Sa("Le meunier est revenu, à ce qu'on dit ? Je vais devoir rouvrir son dossier. Il était classé « disparu ». J'ai horreur de déclasser.")] };
      return { lines: [Sa("Vous revoilà. Ne touchez à rien sans gants, voulez-vous.")] };
    },
    topics: [
      { id: 'registre', label: 'Le chemin des Saules ?', cond: () => has('lettre') && !flag('lettre_registre'), lines: () => [Sa("Le chemin des Saules… voyons. Le registre des rues."), Sa("Ici. « Chemin des Saules, rayé l'an dernier. Trois maisons : Verdier, Bastien, Lerouge. »", 'surprise'), Sa("Rayé, et personne n'a protesté. Verdier, c'est le nom d'Anton, le meunier. Sa famille vivait près du moulin, autrefois.", 'souci')], fx: ['flag:lettre_registre', 'clue:registre', 'log:La lettre est destinée à la famille Verdier : Anton.', 'quest'] },
      { id: 'cartes', label: 'Vos cartes', lines: () => [Sa("Deux siècles de cartes. Certaines montrent des villages que plus personne ne sait situer. J'appelle ça « l'étagère des absents »."), Sa("Maëlys y a passé plus de temps que partout ailleurs.")] },
      { id: 'insigne', label: "Cet insigne d'argent ?", cond: () => has('insigne'), lines: () => [Sa("Un œil fermé sur une carte pliée… Rangez ça, je vous en prie.", 'surprise'), Sa("On me l'a décrit quand j'étais jeune archiviste, à la Cité. C'est le sceau des Conservateurs.", 'souci'), Sa("Ils ne détruisent rien, disait-on. Ils « mettent à l'abri ». Des cartes, des noms, des routes entières."), E("Et des villages qui ne se souviennent plus de rien."), Sa("Si cet homme est venu jusqu'à Clairval, c'est que le moulin cachait quelque chose. Soyez prudent, Éloi.", 'souci')], fx: ['flag:insigne_salome', 'log:Salomé reconnaît le sceau des Conservateurs.'] },
      { id: 'conservateurs', label: '« Conservateurs » ?', cond: () => flag('chapter_done') || has('page_maelys') || has('insigne'), lines: () => [Sa("Où avez-vous lu ce mot ?", 'surprise'), Sa("… Ne le répétez pas trop fort. Certains archivistes de la Cité en parlaient, quand j'étais jeune. Des gardiens de cartes qui décidaient de ce qui devait être oublié.", 'souci'), Sa("On racontait aussi qu'ils plantaient des « gardiens » : des haies, des ronces, des brumes qui tiennent les curieux à distance des lieux qu'ils voulaient faire oublier.", 'souci'), Sa("Je n'en sais pas plus. Et pour être honnête, je préfère ne pas en savoir plus.")] },
    ],
  },

  basile: {
    name: 'Basile', role: 'Facteur',
    greet: () => {
      if (!flag('t_basile')) return {
        lines: [
          B("Bonjour bonjour ! Pas de courrier pour vous, je suppose ? Plus personne n'écrit aux voyageurs.", 'joie'),
          E("Je cherche la route du Moulin des Trois-Eaux."),
          B("La route du moulin ! Je l'ai faite pendant vingt ans, sacoche à l'épaule !"),
          B("Elle partait de la fontaine, plein vers le soleil levant, jusqu'au pont. Après le pont… elle tournait vers le nord. Vers les bois. J'en suis certain."),
          B("Enfin… presque certain.", 'souci'),
          B("Tenez, puisque vous êtes cartographe. J'ai une lettre que je n'arrive pas à distribuer : « Famille Verdier, 3 chemin des Saules ». Il n'y a pas de chemin des Saules à Clairval !"),
          B("Si vous trouvez à qui elle appartient… Un facteur ne garde pas une lettre, c'est une question d'honneur."),
        ],
        fx: ['flag:met_basile', 'flag:t_basile', 'clue:basile', 'give:lettre', 'flag:lettre_recue', 'log:Basile confie une lettre impossible à distribuer.', 'quest', 'save'],
      };
      if (flag('chapter_done')) return { lines: [B("Une route, une vraie ! Dès demain je reprends la tournée du moulin. J'ai cinq ans de retard dans le courrier !", 'joie')] };
      if (flag('lettre_livree')) return { lines: [B("Livrée ? Vingt ans que je n'avais pas vu une lettre perdue retrouver son chemin. Merci, collègue !", 'joie')] };
      if (flag('anton_found')) return { lines: [B("On dit que vous avez retrouvé Anton ! Tout le village ne parle que de ça. Enfin… surtout Agathe.", 'joie')] };
      return { lines: [B(ph() === 'apresmidi' && S.clock % 1440 < 14 * 60 ? "Je déjeune ! Mais un facteur répond toujours." : "La tournée, la tournée… Vous avez besoin de quelque chose ?")] };
    },
    topics: [
      { id: 'lettre_info', label: "J'ai trouvé : Verdier", cond: () => flag('lettre_registre') && !flag('lettre_livree'), lines: () => [E("La famille Verdier, c'est celle d'Anton, le meunier."), B("Anton ! Mais Anton a disparu…", 'surprise'), B("Gardez-la, alors. Si quelqu'un peut la lui remettre, c'est bien vous.")] },
      { id: 'tournee', label: 'Votre tournée', lines: () => [B("Le matin, les maisons du nord et de l'est. À midi, je mange sur le banc de la place. L'après-midi, celles du sud. Le soir, je trie à la Poste."), B("Si vous me cherchez, suivez les boîtes aux lettres !", 'joie')] },
    ],
  },

  mara: {
    name: 'Mara', role: 'Herboriste',
    greet: () => {
      if (!flag('met_mara')) return {
        lines: [
          M("Tu as les bottes de quelqu'un qui va entrer dans le Bois. Ou qui va bientôt y entrer."),
          E("Si le garde me laisse passer."),
          M("Théodore… Il a peur pour les autres, c'est tout. Moi, j'y vais tous les jours. Le Bois n'est pas méchant. Il est seulement… distrait, depuis que les sentiers bougent."),
        ],
        fx: ['flag:met_mara'],
      };
      if (flag('chapter_done')) return { lines: [M("Tu as rendu sa route au moulin. Le Bois respire mieux : même les ronces ont l'air de dormir.", 'joie')] };
      if (flag('jardin_fini')) return { lines: [M("Mes plantes ont repris. Le Bois t'aime bien, je crois.", 'joie')] };
      if (flag('stones_solved')) return { lines: [M("La brume du nord s'est levée. Les plantes l'ont senti avant moi : la sauge fleurit, en plein automne.", 'surprise')] };
      return { lines: [M(ph() === 'soir' ? "Je reviens de l'orée. La lumière du soir rend les feuilles bavardes." : "Tu veux quelque chose ? Je n'ai pas toute la journée, les plantes non plus.")] };
    },
    topics: [
      { id: 'aimant', label: "Une pierre d'aimant ?", cond: () => flag('coline_besoin') && !has('aimant') && !flag('boussole_ok'), lines: () => [M("Une pierre d'aimant ? J'en ai une : je m'en sers pour retrouver mes aiguilles dans l'herbe."), M("Tiens. Rends-la à Coline quand elle aura fini, ou garde-la. Les cailloux ne sont à personne.", 'joie')], fx: ['give:aimant', 'flag:mara_aimant', 'log:Mara donne une pierre d\'aimant.', 'quest'] },
      { id: 'bois', label: 'Le Bois des Murmures', lines: () => [M("Dans le Bois, les anciens saluaient toujours la rivière en premier. « C'est l'eau qui réveille les chemins », disait ma grand-mère."), M("Et méfie-toi des créatures. Quand un ronceux gonfle, il frappe tout autour de lui : écarte-toi. Un murmure fonce tout droit : un pas de côté suffit.")], fx: ['clue:mara_eau', 'clue:mara_creatures'] },
      { id: 'jardin', label: 'Votre jardin', cond: () => !flag('jardin_accepte'), lines: () => [M("Mon jardin ? Il lui manque trois plantes que le Bois me donnait, et que je ne trouve plus depuis que les sentiers changent."), M("La sauge des brumes, au bord du ruisseau. Le pied-de-loup, dans la première clairière. La fleur-lanterne, près des vieilles pierres."), M("Si tu en croises, pense à moi. Je saurai te remercier.")], fx: ['flag:jardin_accepte', 'log:Mission : le Jardin de Mara.', 'quest'] },
      { id: 'plantes', label: 'Voici vos plantes', cond: () => flag('jardin_accepte') && !flag('jardin_fini') && has('sauge') && has('pied_de_loup') && has('fleur_lanterne'), lines: () => [M("Elles sentent encore la pluie du Bois.", 'joie'), M("Tiens : du baume à la sauge, trois pots. Ça referme les égratignures et le reste."), M("Et… Éloi ? Ta Maëlys est passée me voir au printemps. Elle m'a demandé quelles plantes poussent là où un chemin s'est effacé.", 'souci'), M("Je lui ai répondu : aucune. Le sol oublie, lui aussi.", 'souci')], fx: ['take:sauge', 'take:pied_de_loup', 'take:fleur_lanterne', 'baume:3', 'flag:jardin_fini', 'log:Mission accomplie : le Jardin de Mara.', 'quest', 'save'] },
    ],
  },

  coline: {
    name: 'Coline', role: 'Artisane',
    greet: () => {
      if (!flag('met_coline')) return {
        lines: [
          C("Si c'est pour une roue de charrette, revenez demain. Si c'est pour autre chose, parlez vite."),
          E("C'est pour ceci. La boussole de ma mentore."),
          C("La boussole de Maëlys ! C'est moi qui ai serti le verre, l'an dernier.", 'surprise'),
          C("L'aiguille est morte : il faut la réaimanter. Trouvez-moi une pierre d'aimant et je vous la répare en deux minutes."),
        ],
        fx: ['flag:met_coline', 'flag:coline_besoin', 'log:Coline peut réparer la boussole avec une pierre d\'aimant.', 'quest'],
      };
      if (flag('mill_running')) return { lines: [C("Ce bruit, là-bas, vers la rivière… c'est la roue du moulin ! Je le reconnaîtrais entre mille.", 'joie'), C("Mon père serait fier de vous. Et un peu jaloux.")] };
      if (flag('boussole_ok')) return { lines: [C("Elle tient le coup, ma boussole ? Évidemment qu'elle tient le coup.", 'joie')] };
      return { lines: [C("Alors, cette pierre d'aimant ? Mara, l'herboriste, en a toujours une dans sa poche.")] };
    },
    topics: [
      { id: 'reparer', label: "J'ai une pierre d'aimant", cond: () => has('aimant') && !flag('boussole_ok'), anim: 'work', lines: () => [C("Donnez. … Frotter dans un sens, jamais dans l'autre… Voilà.", 'joie'), C("Mais… regardez l'aiguille. Elle ne montre pas le nord. Elle montre votre atlas.", 'surprise'), C("Maëlys m'avait dit que cette boussole « suit les chemins, pas les étoiles ». Je croyais qu'elle plaisantait."), E("Avec elle, on ne plaisante jamais complètement.")], fx: ['take:aimant', 'take:boussole_brisee', 'give:boussole', 'flag:boussole_ok', 'log:Coline a réparé la boussole de Maëlys.', 'quest', 'save', 'memory:boussole'] },
      { id: 'theodore', label: 'Et Théodore ?', lines: () => [C("Le garde ? Pas méchant. Il a seulement peur que quelqu'un d'autre se perde dans le Bois."), C("Montrez-lui que vous savez où vous allez. Il n'y a que ça qui le rassure.")] },
      { id: 'atelier', label: 'Votre atelier', lines: () => [C("Charrettes, serrures, gonds, horloges. Et des boussoles qui ne montrent pas le nord, maintenant."), C("Mon père réparait la roue du moulin. J'étais petite. Je me souviens du bruit… pas du chemin.", 'souci')] },
    ],
  },

  theodore: {
    name: 'Théodore', role: 'Garde du village',
    greet: () => {
      if (flag('theo_ok')) {
        if (flag('chapter_done') && flag('garde_avoue')) return { lines: [T("J'ai tout raconté au conseil, hier soir. Les bornes, l'homme en gris, l'argent."), T("Agathe m'a resservi un verre quand même. Ce village est bien trop gentil.", 'joie')] };
        if (flag('chapter_done')) return { lines: [T("Une route vers le moulin, et le meunier de retour. Je vais finir par devoir te remercier, cartographe.", 'joie')] };
        if (flag('garde_avoue')) return { lines: [T("Tu n'as rien dit à personne. … Merci. Je le dirai moi-même, quand la route sera revenue.", 'souci')] };
        if (flag('anton_found')) return { lines: [T("Tu as retrouvé Anton. Moi, je n'ai pas osé aller plus loin que l'orée.", 'souci'), T("… Merci. Vraiment.")] };
        return { lines: [T("Sois prudent là-dedans. Les ronceux ont poussé près du sentier, ces derniers temps.")] };
      }
      const L: Line[] = [];
      if (!flag('met_theodore')) L.push(T("Halte. Le Bois est fermé. Ordre du conseil… Enfin, mon ordre.", 'colere'), T("Trop de gens y sont entrés et n'ont pas su revenir. Le meunier, le dernier."), E("Justement, je cherche le moulin."), T("Toi et lui. On ne l'a pas revu.", 'souci'));
      if (flag('bornes_solved') && flag('boussole_ok')) {
        L.push(E("J'ai retrouvé la direction de l'ancienne route, et ma boussole fonctionne."), T("Une trace de route ET une boussole qui marche ?", 'surprise'), T("… Bon. Je n'aime pas ça, mais tu sembles savoir où tu vas. Si tu trouves Anton, ramène-le."));
        return { lines: L, fx: ['flag:met_theodore', 'flag:theo_ok', 'log:Théodore ouvre la porte du Bois.', 'quest', 'save'] };
      }
      if (flag('bornes_solved')) L.push(T("Une trace sur un papier ne t'empêchera pas de tourner en rond. Personne n'entre sans une boussole qui fonctionne."));
      else if (flag('boussole_ok')) L.push(T("Une boussole, c'est bien. Mais pour aller où ? Sans direction, tu n'iras nulle part."));
      else if (flag('met_theodore')) L.push(T("Toujours fermé. Reviens avec une direction et une boussole qui marche."));
      else L.push(T("Reviens quand tu sauras où tu vas, et avec de quoi ne pas te perdre."));
      return { lines: L, fx: ['flag:met_theodore', 'flag:theo_condition', 'quest'] };
    },
    topics: [
      { id: 'aveu', label: 'Les bornes, c\'était vous ?', cond: () => flag('ninon_garde') && !flag('garde_avoue'), lines: () => [
        T("…", 'souci'), T("Qui t'a dit ça ? La petite ?", 'surprise'), E("Elle vous a vu. Il y a cinq ans."), T("Cinq ans. Oui. Ça fait cinq ans que je n'arrive plus à passer devant la fontaine.", 'souci'),
        T("Un homme est venu, un automne. Manteau gris, capuche, voix douce. Un insigne en argent sur la poitrine : un œil fermé sur une carte."),
        T("Il a dit que le moulin était « un lieu en danger ». Que si les bornes continuaient de montrer la route, des gens viendraient, et qu'il arriverait malheur au village."),
        T("Il m'a payé. Pas beaucoup. Juste assez pour avoir honte depuis.", 'souci'),
        T("J'ai tourné les trois pierres. Et un matin, plus personne ne se rappelait le chemin du moulin. Pas même moi. Je te jure que je ne savais pas que ça ferait ça.", 'souci'),
        E("C'est pour ça que vous gardiez le Bois fermé."), T("Je ne voulais pas qu'un autre se perde par ma faute. Anton, c'était déjà un de trop."),
        T("Tiens. Il l'a laissé tomber en partant. Je n'ai jamais osé le jeter."),
        E("Je ne dirai rien au village. Mais un jour, il faudra que ce soit vous qui le disiez."), T("Un jour. Quand la route sera revenue."),
      ], fx: ['give:insigne', 'flag:garde_avoue', 'clue:theodore_aveu', 'note:note_insigne', "log:Théodore avoue : un homme en gris l'a payé pour tourner les bornes.", 'quest', 'save'] },
      { id: 'bois', label: 'Pourquoi le Bois est fermé ?', lines: () => [T("Les sentiers changent. On part vers l'est, on ressort au sud. Et il y a les créatures : des ronces qui marchent, des ombres qui chuchotent."), T("J'ai fouillé jusqu'à l'orée pour le meunier. Plus loin, je n'ai pas osé. Voilà. Tu sais tout.", 'souci')] },
    ],
  },

  anton: {
    name: 'Anton', role: 'Meunier',
    greet: () => {
      if (!flag('anton_found')) return {
        lines: [
          An("Qui va là ? … Un enfant. Non, pardon. Un jeune homme. Je n'y vois plus clair, à force de tourner.", 'surprise'),
          E("Vous êtes Anton ? Le meunier ?"),
          An("Je l'étais. Trois semaines que je cherche mon moulin. Je connais chaque pierre de ce bois, et chaque matin les sentiers me ramènent ici.", 'souci'),
          An("Je me souviens de la meule, du bruit de l'eau, de l'odeur de la farine… mais plus du chemin. Comme si on me l'avait retiré de la tête.", 'souci'),
          E("Je connais ça. Pas le moulin… Quelqu'un qui s'efface de votre vie, petit à petit, sans qu'on puisse le retenir.", 'souci'),
          An("Vous aussi, vous cherchez quelqu'un. Ça se voit. Vous regardez les sentiers comme on regarde une porte."),
          An("Si vous allez là-bas, prenez ma clé. La porte grince : il faut la soulever en tournant."),
          An("Et ça : un frottis que j'ai fait sur une pierre brisée, près des vieilles pierres du nord. Je n'y comprends rien. Vous, peut-être."),
        ],
        fx: ['flag:met_anton', 'flag:anton_found', 'give:cle_moulin', 'give:frottis', 'clue:anton_lune', 'log:Anton est retrouvé, perdu dans le Bois. Il confie sa clé.', 'quest', 'save'],
      };
      if (flag('chapter_done')) return { lines: [An("Écoutez-la ! Elle chante ! Trois semaines de silence… et ce matin, j'ai retrouvé le chemin tout seul.", 'joie')] };
      if (flag('mill_running')) return { lines: [An("Elle tourne… elle tourne vraiment !", 'joie')] };
      if (S.zone === 'moulin' && !flag('boss_done')) return { lines: [An("Vous avez ouvert le passage ! Mais regardez… ces ronces autour de la roue. Elles ont poussé en une nuit, le matin où j'ai oublié le chemin.", 'souci'), An("Elles bougent quand on approche. Comme si elles montaient la garde.", 'souci')] };
      if (S.zone === 'moulin') return { lines: [An("Les ronces sont tombées en poussière ! Je reconnais tout : la porte, le bief, les vannes.", 'joie'), An("Allez-y, vous. Moi, j'ai peur qu'en touchant à quelque chose tout s'efface encore.", 'souci')] };
      return { lines: [An("Les pierres du nord… Quand j'étais gamin, on disait qu'il fallait les toucher dans le bon ordre pour que la brume s'écarte.")] };
    },
    topics: [
      { id: 'roue', label: 'La roue du moulin', lines: () => [An("La roue est vieille et lourde. Un filet d'eau ne la fera jamais tourner : il lui faut un coup d'eau."), An("Et le frein, à l'intérieur… Je le serrais toujours en partant. Toujours.")], fx: ['clue:anton_roue'] },
      { id: 'pierres', label: 'Les pierres gravées', cond: () => !flag('stones_solved'), lines: () => [An("Quatre pierres debout, au nord. L'eau, l'oiseau, la clé, la lune. Personne ne se rappelle l'ordre."), An("Il y a d'autres inscriptions dans le Bois, je crois. Sur le vieux pont, à l'est. Et sur la borne de la première clairière.")] },
      { id: 'lettre', label: 'Une lettre pour vous', cond: () => has('lettre') && flag('lettre_registre'), lines: () => [An("Pour moi ? « Famille Verdier, chemin des Saules »… C'était notre rue, quand j'étais petit.", 'surprise'), An("Elle est signée… M. « Anton, si un jour tu oublies le chemin du moulin, ne cherche pas seul. Quelqu'un viendra avec mon atlas. Fais-lui confiance. »"), An("Elle savait. Elle savait que j'allais oublier.", 'souci')], fx: ['take:lettre', 'flag:lettre_livree', 'note:note_lettre', 'log:Mission accomplie : la lettre est arrivée à Anton.', 'quest', 'save'] },
    ],
  },

  paulin: {
    name: 'Paulin', role: 'Garçon du village',
    greet: () => ({ lines: [flag('chapter_done') ? { s: 'paulin', t: "J'ai vu la route ! Bon… d'accord. Ninon avait raison.", m: 'surprise' } : { s: 'paulin', t: "Ninon dit qu'elle voit des chemins invisibles. Moi je vois rien. C'est pas juste.", m: 'colere' }] }),
    topics: [],
  },
  gaspard: {
    name: 'Gaspard', role: 'Pêcheur',
    greet: () => ({ lines: [flag('mill_running') ? (flag('chapter_done') ? { s: 'gaspard', t: "Le moulin chante, les truites dansent, et moi je n'ai toujours rien pris. Mais c'est un beau jour.", m: 'joie' } : { s: 'gaspard', t: "Tu entends ? En amont… On dirait une roue. Les truites l'ont entendue avant moi.", m: 'surprise' }) : { s: 'gaspard', t: "Ça mord pas. Depuis que la rivière a perdu son moulin, même les truites ont l'air de chercher leur chemin." }] }),
    topics: [{ id: 'pont', label: 'Le pont', lines: () => [{ s: 'gaspard', t: "Le pont ? Solide. Mais sous le tablier, côté ouest, y a une vieille boîte coincée depuis toujours. J'ai jamais osé l'ouvrir. Porte malheur, qu'on dit." }] }],
  },
  odile: {
    name: 'Odile', role: 'Maraîchère',
    greet: () => ({ lines: [flag('chapter_done') ? { s: 'odile', t: "La fête des moissons, enfin ! Avec de la farine ! Mes potirons vont finir en tartes, ils l'ont bien mérité.", m: 'joie' } : { s: 'odile', t: ph() === 'matin' ? "Mes potirons poussent, au moins eux. Basile passe le matin par ici, si c'est lui que tu cherches." : "Les légumes, ça ne s'efface pas. On les mange avant." }] }),
    topics: [],
  },
};

/** Répliques de la fête des moissons (le soir, après la fin du prologue). */
export const FETE: Record<string, Line[]> = {
  agathe: [A("Ce soir, c'est la maison qui régale ! Du pain à la vraie farine du moulin, Éloi. Goûtez-moi ça.", 'joie')],
  anton: [An("Ma farine sur la table de tout le village… Je croyais ne jamais revoir ça.", 'joie'), An("Maëlys aurait dû être là. Quand vous la trouverez, dites-lui qu'il y a une place pour elle au moulin.")],
  basile: [B("J'ai distribué les invitations moi-même. Toutes ! Pas une seule lettre perdue !", 'joie')],
  mara: [M("Goûte la tisane. Sauge des brumes, pied-de-loup et une fleur-lanterne. Ça réveille les chemins… et les danseurs.", 'joie')],
  coline: [C("J'ai huilé la roue cet après-midi. Elle tournera cent ans de plus. Bon, vingt. Mais elle tournera.", 'joie')],
  theodore: [T(flag('garde_avoue') ? "Je leur ai tout dit, et ils m'ont quand même gardé une chaise. Allez, cartographe, assieds-toi." : "La porte nord restera ouverte, désormais. Le Bois n'a plus besoin de garde.", 'joie')],
  salome: [Sa("Je ne danse pas. Je note. Quelqu'un doit se souvenir de cette soirée, n'est-ce pas ?", 'joie')],
  ninon: [N("Tu danses ? Moi je danse ! Paulin marche sur les pieds de tout le monde.", 'joie')],
  paulin: [{ s: 'paulin', t: "C'est la meilleure fête de toute ma vie ! C'est aussi la première, mais quand même !", m: 'joie' }],
  gaspard: [{ s: 'gaspard', t: "J'ai pêché trois truites pour la fête. Enfin, deux. Une s'est échappée. Mais elle était énorme.", m: 'joie' }],
  odile: [{ s: 'odile', t: "Tarte aux potirons ! Prenez-en deux, personne ne compte.", m: 'joie' }],
};

export const SPEAKER_NAME: Record<string, string> = { eloi: 'Éloi', narr: '', maelys: 'Maëlys', eloi_jeune: 'Éloi, 11 ans', conservateur: '???', ...Object.fromEntries(Object.entries(DIALOGS).map(([k, v]) => [k, v.name])) };
