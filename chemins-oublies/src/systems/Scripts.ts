// Ce qui se passe quand Éloi examine ou utilise quelque chose. Chaque script reçoit l'API de la scène.
import type { Api } from './api';
import type { Line } from '../data/dialogues';
import { S, flag, setFlag, has, addClue, addNote, addSecret, addTrace } from '../core/state';
import { rotateBorne, bornesCorrect, DIR_LABEL, touchStone, toggleVanne, millStatus, BORNE_IDS } from './Puzzles';
import { LEVERS } from '../data/objects';
import { touchVeille, toggleMirror, traceBeam } from './Chapter2';

const E = (t: string, m?: Line['m']): Line => ({ s: 'eloi', t, m });
const N = (t: string): Line => ({ s: 'narr', t });

export const SCRIPTS: Record<string, (api: Api) => Promise<void>> = {
  async borne_arrivee(api) {
    await api.anim('inspect', 700);
    await api.say([
      E("Une borne ancienne. Sa flèche montre le nord-est… vers des haies et des champs. Aucune route par là."),
      E("Sur le flanc, une inscription usée : « TROIS-EAUX — UNE LIEUE ».", 'surprise'),
      E("Le moulin ! Il n'est pourtant sur aucune carte. Maëlys est passée par ici, j'en suis sûr. Commençons par l'auberge."),
    ]);
    if (!flag('borne_vue')) { setFlag('borne_vue'); api.quest(); api.save(); await api.fx('memory', 'borne'); }
  },
  async panneau(api) {
    await api.say([N("« ↑ Place du village   ← Champs   → Pont » — Une quatrième flèche a été arrachée. Il reste les clous.")]);
  },
  async notice(api) {
    await api.anim('inspect', 500);
    await api.say([...(flag('chapter_done') ? [N("« Retrouvé : Anton Verdier. » Quelqu'un a ajouté au crayon : « Il sent toujours la farine. »"), N("« FÊTE DES MOISSONS : ce soir, sur la place ! La farine est revenue. »"), N("« Le Bois est rouvert. — Théodore »")] : [N("« DISPARU : Anton Verdier, meunier. Barbe grise, casquette, sent la farine. Récompense. »"), N("« Fête des moissons : reportée faute de farine. »"), N("« LE BOIS EST FERMÉ. — Théodore »")])]);
  },
  async fontaine(api) {
    await api.say([E("L'eau est fraîche et claire. Au fond brillent quelques pièces : des vœux."), E(flag('chapter_done') ? "J'en ajouterais bien une. Pour Maëlys." : "Je fais le vœu de retrouver la route. Et Maëlys.")]);
  },
  async puits(api) { await api.say([E("Un puits profond. Mon écho me répond avec un léger retard, comme s'il réfléchissait.")]); },
  async ruches(api) { await api.say([N("Les abeilles de Mara bourdonnent paisiblement. Mieux vaut ne pas les déranger.")]); },
  async rocher(api) {
    await api.anim('inspect', 600);
    await api.say([E(flag('t_ninon') ? "Le rocher fendu. Ninon avait raison : on dirait vraiment qu'il bâille." : "Un énorme rocher fendu en deux. On dirait une bouche qui bâille."), ...(flag('route_revealed') ? [E("La route passe juste à côté, maintenant. Comme si elle n'était jamais partie.")] : [])]);
  },
  async cache_pont(api) {
    await api.anim('inspect', 900);
    await api.say([E("Une boîte en fer, coincée sous le tablier du pont. Le couvercle résiste… puis cède."), E("Une moitié de page déchirée. L'écriture de Maëlys !", 'surprise')]);
    setFlag('cache_pont'); api.give('page_droite'); addSecret('pont'); api.toast('Secret découvert : la boîte sous le pont', 'secret'); api.sfx('discover');
    api.rebuild(); api.save();
  },
  // ---- Énigme 1 : les bornes
  async borneA(api) { await borne(api, 0); },
  async borneB(api) { await borne(api, 1); },
  async borneC(api) { await borne(api, 2); },
  // ---- intérieurs
  async cheminee(api) { await api.say([N("Un bon feu crépite. Une soupe au thym y mijote doucement.")]); },
  async etabli(api) { await api.anim('inspect', 600); await api.say([N("Des engrenages minuscules, des ressorts, une serrure démontée… et un croquis de boussole, signé « M. »")]); },
  async registre(api) {
    await api.anim('inspect', 600);
    if (has('lettre') && !flag('lettre_registre')) { await api.say([E("Des registres : naissances, rues, moulins… Salomé saurait où chercher le chemin des Saules.")]); return; }
    await api.say([N("Des registres reliés de cuir : naissances, rues, moulins, ponts. Sur un dos, une étiquette : « Lieux oubliés — ne pas prêter »." )]);
  },
  async table_cartes(api) {
    await api.anim('inspect', 700);
    await api.say([N("La carte de 1802 : la place, le pont, la rivière qui remonte vers le nord-est… et trois petits ronds alignés : les bornes. Au bout, un rocher dessiné avec soin.")]);
    if (flag('t_salome')) await api.say([E("Chaque borne regardait la suivante. La dernière regardait le lieu à atteindre…")]);
  },
  async bureau_meunier(api) {
    await api.anim('inspect', 800);
    await api.say([
      N("Le journal du meunier, ouvert à une page cornée :"),
      N("« Vanne de prise : laisse entrer la rivière dans le bief. Vanne de décharge : renvoie l'eau du bief à la rivière. Vanne motrice : lâche l'eau du bief sur la roue. »"),
      N("« La vieille roue est paresseuse. Un filet d'eau ne la décolle pas : il faut un bief plein, lâché d'un seul coup. »"),
    ]);
    addClue('journal_meunier');
    if (!flag('journal_lu')) { setFlag('journal_lu'); api.toast('Nouvel indice : le journal du meunier', 'decouverte'); api.quest(); api.save(); }
    if (flag('chapter_done')) await api.say([E("Et sous le journal, la feuille de Maëlys. Je la connais par cœur, maintenant.")]);
  },
  async meule(api) { await api.say([N(flag('mill_running') ? "La meule tourne, lente et régulière. Une fine poussière blanche danse dans la lumière." : "Une meule de pierre, couverte de poussière. Elle n'a pas tourné depuis des semaines.")]); },
  async frein(api) {
    if (flag('brake_released')) { await api.say([E("Le frein est desserré. Je préfère ne plus y toucher.")]); return; }
    await api.anim('work', 900);
    api.sfx('creak');
    await api.say([N("Un grand levier peint en rouge, bloqué contre l'axe de la roue : le frein."), E("Allez… hop !"), N("Le frein se desserre dans un long grincement. Dehors, la roue frémit à peine.")]);
    setFlag('brake_released'); S.mill.brake = false;
    api.quest(); api.rebuild(); api.save();
  },
  // ---- Bois
  async borne_bois(api) {
    await api.anim('inspect', 700);
    await api.say([N("Une borne couverte de mousse. Sous les lichens, une inscription à demi effacée :"), N("« …l'oiseau ne chante qu'après que l'eau s'est éveillée… »")]);
    if (addClue('frag_borne')) api.toast('Nouvel indice dans l\'atlas', 'decouverte');
  },
  async pont_ruine(api) {
    await api.anim('inspect', 700);
    await api.say([N("Le vieux pont s'est effondré au milieu du ruisseau. Impossible de passer."), N("Sur le pilier, une ligne gravée : « …et la clé se tourne en dernier, toujours. »")]);
    if (addClue('frag_pont')) api.toast('Nouvel indice dans l\'atlas', 'decouverte');
  },
  async stele(api) {
    await api.anim('inspect', 600);
    await api.say([N("Une pierre brisée en deux. Sur le morceau le plus grand, on devine un croissant de lune et quelques mots : « …n'ouvre aucun chemin : elle les cache. »")]);
    if (addClue('anton_lune')) api.toast('Nouvel indice dans l\'atlas', 'decouverte');
  },
  async arbre_grave(api) {
    await api.anim('inspect', 800);
    if (flag('passage_open')) { await api.say([E("Le symbole de l'atlas, gravé dans l'écorce. Il gardait le sentier caché.")]); return; }
    await api.say([E("Un symbole gravé dans l'écorce : un cercle traversé d'une croix… C'est le même que sur la couverture de l'atlas !", 'surprise'), E("Derrière ces ronces, il y a peut-être quelque chose. Si je consultais l'atlas ici ?")]);
    setFlag('arbre_vu');
  },
  async coffre_cache(api) {
    await api.anim('inspect', 700);
    api.sfx('door');
    await api.say([N("Le coffre s'ouvre sans un bruit. À l'intérieur : une moitié de page, pliée avec soin.")]);
    setFlag('coffre_cache_ouvert'); api.give('page_gauche'); api.rebuild(); api.save();
  },
  async coffre_garde(api) {
    if (!S.defeated.includes('enc3')) { await api.say([E("Le ronceux ne me laissera pas approcher tant qu'il est là.")]); return; }
    await api.anim('inspect', 700);
    api.sfx('door');
    await api.say([N("Sous les ronces mortes, le coffre cède. Un anneau de lierre tressé autour d'une pierre verte."), E("Je me sens… plus solide.", 'surprise')]);
    setFlag('coffre_garde_ouvert'); api.give('talisman'); S.maxHp += 1; S.hp = S.maxHp; addSecret('coffre');
    api.toast('Secret découvert : le coffre des ronces (+1 cœur)', 'secret'); api.sfx('discover'); api.rebuild(); api.save();
  },
  async sauge(api) { await plantPick(api, 'sauge', 'Sauge des brumes'); },
  async pied_de_loup(api) { await plantPick(api, 'pied_de_loup', 'Pied-de-loup'); },
  async fleur_lanterne(api) { await plantPick(api, 'fleur_lanterne', 'Fleur-lanterne'); },
  async pierre_eau(api) { await stone(api, 'eau'); },
  async pierre_oiseau(api) { await stone(api, 'oiseau'); },
  async pierre_cle(api) { await stone(api, 'cle'); },
  async pierre_lune(api) { await stone(api, 'lune'); },
  // ================= Chapitre II
  async panneau_landes(api) { await api.say([N("« ← Moulin des Trois-Eaux    ↑ Brumecime » — Sous « Brumecime », quelqu'un a gravé un œil fermé… puis l'a rayé d'un coup de couteau.")]); },
  async echo_1(api) { await echo(api, 1); },
  async echo_2(api) { await echo(api, 2); },
  async echo_3(api) { await echo(api, 3); },
  async veille_saule(api) { await veille(api, 'saule'); },
  async veille_corbeau(api) { await veille(api, 'corbeau'); },
  async veille_cloche(api) { await veille(api, 'cloche'); },
  async veille_lanterne(api) { await veille(api, 'lanterne'); },
  async veille_oeil(api) { await veille(api, 'oeil'); },
  async brasero1(api) { await brasero(api, 0); },
  async brasero2(api) { await brasero(api, 1); },
  async brasero3(api) { await brasero(api, 2); },
  async mouton1(api) { await mouton(api, 1); },
  async mouton2(api) { await mouton(api, 2); },
  async mouton3(api) { await mouton(api, 3); },
  async puits_bru(api) { await api.say([E("Un puits très profond. Tout au fond, l'eau reflète un bout de ciel… et la Tour des Vents, à l'envers.")]); },
  async metier(api) {
    await api.anim('inspect', 700);
    if (has('cle_tour') || flag('tour_ouverte')) { await api.say([E("La tapisserie de Léna : la rue aux saules, la maison bleue. Il manque un petit nœud d'argent, dans le coin.")]); return; }
    if (!flag('met_ysolde')) { await api.say([E("Une tapisserie : une rue bordée de saules, une maison bleue… Ce motif, je l'ai déjà vu quelque part."), E("Au coin, un petit nœud de fil d'argent, plus serré que les autres. Bizarre.")]); return; }
    await api.say([E("« Un souvenir que quelqu'un tisse sans le savoir. » La rue aux saules… et ce nœud d'argent, dans le coin.", 'surprise'), N("Éloi tire doucement sur le fil. Le nœud se défait, se déplie… et prend la forme d'une clé, tissée si serré qu'elle tient comme du métal.")]);
    api.give('cle_tour'); addNote('note_tapisserie'); setFlag('lena_cle');
    await api.say([E("Maëlys… Tu l'as cachée dans le souvenir de quelqu'un d'autre. Dans le chemin des Saules.", 'joie')]);
    api.quest(); api.save();
  },
  async miroirA(api) { await miroir(api, 'miroirA'); },
  async miroirB(api) { await miroir(api, 'miroirB'); },
  async miroirC(api) { await miroir(api, 'miroirC'); },
  async miroirD(api) { await miroir(api, 'miroirD'); },
  async lentille(api) {
    if (!flag('miroirs_solved')) { await api.say([E("Une lentille grande comme une roue de charrette. Elle attend la lumière."), E("Le rayon de la fenêtre… Il faut le lui amener avec les miroirs.")]); return; }
    if (!flag('chapter2_done')) { await api.fx('finale2'); return; }
    await api.say([E("La lentille brille encore. Dans le verre, les chemins des hauts filent tous vers l'est.")]);
  },
  async bureau_maelys(api) {
    await api.anim('inspect', 700);
    if (flag('pupitre_lu')) { await api.say([E("« …crois-le quand il dira qu'il a peur. » Je l'ai lu dix fois.")]); return; }
    setFlag('pupitre_lu');
    await api.say([N("Sur le pupitre, une feuille pliée en quatre. Au dos, un seul mot : « Éloi »."), N("« Si tu lis ceci, c'est que tu as su te perdre sans avoir peur. Je suis fière de toi. »"), N("« Ne crois pas tout ce que dira Silas. Mais crois-le quand il dira qu'il a peur. — M. »"), E("Elle savait que j'arriverais jusqu'ici. Elle a toujours une longueur d'avance.", 'joie')]);
    addNote('note_pupitre'); api.save();
  },
  async brume(api) { await api.say([E("Une brume si épaisse qu'elle repousse la main. Elle a l'air… de m'attendre. Les pierres gravées, autour, y sont sûrement pour quelque chose.")]); },
  // ---- Moulin
  async levier1(api) { await lever(api, 'levier1'); },
  async levier2(api) { await lever(api, 'levier2'); },
  async levier3(api) { await lever(api, 'levier3'); },
  async jauge(api) { await api.say([N(`La jauge plantée dans le bief indique : ${Math.round(S.mill.level * 100)} %.` + (S.mill.level >= 0.92 ? ' Le bief est plein.' : ''))]); },
  async roue(api) {
    if (flag('mill_running')) { await api.say([N("La grande roue tourne, ruisselante. Chaque aube qui plonge fait un bruit de tambour.")]); return; }
    await api.anim('inspect', 600);
    await api.say([N("La grande roue à aubes, couverte de mousse. Immobile."), ...(S.mill.brake ? [N("Un gros sabot de bois la bloque contre l'axe : un frein, commandé depuis l'intérieur.")] : [E("Le frein est desserré. Il lui faut de l'eau, maintenant. Beaucoup d'eau d'un coup.")])]);
  },
  async panneau_brume(api) { await api.say([N("« HAUTES TERRES DE BRUMECIME ». Au-delà, la brume est si épaisse qu'on n'y voit pas sa main."), E("Ce chemin-là attendra. Pour l'instant.")]); },
};

async function borne(api: Api, i: number) {
  const names = ['la borne de la place', 'la borne du pont', 'la borne de la colline'];
  if (flag('bornes_solved')) { await api.say([N(`La flèche de ${names[i]} indique le ${DIR_LABEL[S.bornes[i]]}. Elle est à sa place.`)]); return; }
  await api.anim('inspect', 500);
  if (!flag(`borne_vue_${i}`)) {
    setFlag(`borne_vue_${i}`);
    await api.say([N(`Une vieille borne. Son chapeau de pierre porte une flèche gravée, et il tourne sur son axe avec un raclement.`)]);
  }
  for (;;) {
    const r = await api.choose({ s: 'narr', t: `La flèche de ${names[i]} indique : ${DIR_LABEL[S.bornes[i]]}.` }, ['Tourner ↻ (sens horaire)', 'Tourner ↺ (sens inverse)', 'Laisser ainsi']);
    if (r === 2 || r < 0) break;
    rotateBorne(i, r === 0 ? 1 : -1);
    api.sfx('grind');
    api.fx('borne', i);
    await api.wait(260);
    if (bornesCorrect()) { await bornesSolved(api); return; }
  }
  api.save();
}

async function bornesSolved(api: Api) {
  setFlag('bornes_solved');
  api.sfx('discover');
  await api.fx('bornesGlow');
  await api.say([N("Les trois flèches s'alignent. Un frisson court sur les pierres, et l'atlas, dans la sacoche, se met à chauffer.")]);
  await api.anim('atlas', 1400);
  addTrace('route_bornes'); addNote('note_bornes');
  api.toast("Première trace dans l'atlas !", 'decouverte');
  await api.pan(BORNE_IDS.length ? [2860, 595] : [0, 0], 1400, 900);
  await api.say([E("Une ligne d'encre dorée vient d'apparaître : de la place au pont, puis plein nord, puis vers le rocher fendu… et au-delà, plus rien.", 'surprise'), E("La route continue quelque part. Il faut que je passe par le Bois.")]);
  api.quest(); api.save('bornes');
}

async function stone(api: Api, sym: string) {
  if (flag('stones_solved')) { await api.say([N('La gravure luit doucement, comme une braise.')]); return; }
  if (!S.defeated.includes('enc2')) { await api.say([E("Impossible de me concentrer tant que ces ombres rôdent.")]); return; }
  await api.anim('work', 500);
  const r = touchStone(sym);
  api.fx('stones');
  if (r === 'wrong') {
    api.sfx('wrong');
    await api.say([N(sym === 'lune' ? "La lune s'assombrit. Toutes les gravures s'éteignent, et la brume s'épaissit." : "La gravure grésille, puis toutes les pierres s'éteignent.")]);
    return;
  }
  api.sfx('hum', { pitch: 1 + S.stones.length * 0.25 });
  if (r === 'solved') {
    setFlag('stones_solved');
    api.sfx('discover');
    await api.wait(500);
    await api.fx('mist');
    addNote('note_pierres'); addTrace('route_bois');
    api.toast('La brume se retire vers le nord', 'decouverte');
    await api.say([N("Les trois gravures brillent ensemble. Un long souffle traverse les arbres, et la brume du nord se déchire comme un vieux drap.")]);
    api.rebuild(); api.quest(); api.save('pierres');
    await api.wait(400);
    await api.fx('memory', 'dispute');
  }
}

async function plantPick(api: Api, item: string, label: string) {
  await api.anim('inspect', 600);
  if (!flag('jardin_accepte')) { await api.say([E(`Une jolie plante. Mara saurait sûrement me dire ce que c'est.`)]); return; }
  setFlag('pick_' + item);
  api.give(item);
  await api.say([E(`${label} ! Mara va être contente.`, 'joie')]);
  api.rebuild(); api.quest(); api.save();
}

async function lever(api: Api, id: string) {
  const L = LEVERS[id];
  if (!flag('boss_done')) { await api.say([N("Des ronces épaisses enserrent le levier. Impossible d'y toucher tant qu'elles sont là.")]); return; }
  if (S.mill.solved) { await api.say([N('La roue tourne. Mieux vaut ne plus toucher aux vannes.')]); return; }
  await api.anim('work', 400);
  const ev = toggleVanne(L.v);
  api.sfx('lever'); api.sfx('splash');
  api.fx('mill');
  const m = S.mill;
  const label = { v1: "La vanne de prise", v2: 'La vanne de décharge', v3: 'La vanne motrice' }[L.v];
  if (ev.wheelKick === 'start') {
    setFlag('mill_running');
    await api.fx('wheelStart');
    await api.say([N("Le bief plein se vide d'un coup sur les aubes. La roue gémit, hésite… puis tourne ! Une fois, deux fois, et elle ne s'arrête plus."), E("Elle tourne !", 'joie')]);
    api.quest(); api.rebuild(); api.save('roue');
    return;
  }
  if (ev.wheelKick === 'weak') {
    await api.fx('wheelWeak');
    await api.say([N(`${label} s'ouvre. ` + (m.brake ? "L'eau frappe la roue, mais le frein la retient : elle ne bouge pas d'un pouce." : m.level < 0.92 ? "La roue frémit… et retombe. Pas assez d'eau d'un coup." : "La roue frémit, mais la décharge emporte la moitié de l'eau. Elle retombe."))]);
    return;
  }
  await api.say([N(`${label} ${m[L.v] ? "s'ouvre" : 'se ferme'}. ${millStatus()}`)]);
}


// ================= Chapitre II : fonctions
async function echo(api: Api, n: number) {
  if (flag('echo_' + n)) { await api.say([E("L'herbe argentée s'est tue. La voix a dit ce qu'elle avait à dire.")]); return; }
  if (await api.fx('engaged')) { await api.say([E("Impossible d'écouter quoi que ce soit avec ces ombres autour de moi !", 'souci')]); return; }
  await api.anim('atlas', 1100);
  if (!flag('echos_vus')) { setFlag('echos_vus'); await api.say([N("L'atlas tremble entre les mains d'Éloi. Ses pages se couvrent de givre… et la lande se met à parler.")]); addNote('note_echos'); }
  setFlag('echo_' + n);
  await api.fx('memory', 'echo' + n);
  api.rebuild(); api.quest(); api.save('echo');
}

async function veille(api: Api, sym: string) {
  if (flag('veilles_solved')) { await api.say([N(sym === 'oeil' ? "L'œil fermé reste éteint, et c'est très bien ainsi." : 'La pierre veille. Son signe luit doucement dans la brume.')]); return; }
  await api.anim('work', 450);
  const r = touchVeille(sym);
  await api.fx('veilles');
  if (r === 'trap') { api.sfx('wrong'); await api.say([N("L'œil fermé s'entrouvre… La brume gronde sur la tourbière, et toutes les pierres s'éteignent.")]); return; }
  if (r === 'wrong') { api.sfx('wrong'); await api.say([N('Le signe grésille, puis toutes les pierres s\'éteignent. Ce n\'était pas le bon ordre.')]); return; }
  api.sfx('hum', { pitch: 1 + (S.counters.veille ?? 0) * 0.2 });
  if (r === 'solved') {
    setFlag('veilles_solved');
    api.sfx('discover');
    await api.wait(400);
    await api.fx('mistCauseway');
    addTrace('route_landes');
    api.toast('La brume quitte la chaussée', 'decouverte');
    await api.say([N("Les quatre pierres s'allument ensemble. Un long souffle passe sur la tourbière : la brume se retire de la chaussée de planches… et se ramasse au loin, au nord-est, comme une bête qu'on dérange.")]);
    api.rebuild(); api.quest(); api.save('veilles');
  }
}

async function brasero(api: Api, i: number) {
  const r = await api.fx('brasero', i);
  if (r === true) return;
  if (r === false) { await api.say([E("Les braises sont encore trop chaudes pour reprendre. Un autre !")]); return; }
  await api.say([E(flag('devoreur_done') ? "Le brasero refroidit. La brume ne reviendra pas de sitôt." : "Un vieux brasero de pierre, rempli de mousse sèche. Il n'attend qu'une étincelle.")]);
}

async function mouton(api: Api, n: number) {
  await api.say([N("Un mouton égaré, la laine pleine de bruyère. Il bêle, regarde Éloi… et trotte vers la bergerie.")]);
  setFlag('mouton' + n);
  api.sfx('quest');
  api.rebuild(); api.quest(); api.save();
}

async function miroir(api: Api, id: string) {
  if (flag('miroirs_solved')) { await api.say([E("Le miroir renvoie la lumière là où il faut. Je n'y touche plus.")]); return; }
  toggleMirror(id);
  api.sfx('lever');
  await api.fx('mirrors');
  if (traceBeam().lit) {
    setFlag('miroirs_solved');
    api.sfx('discover');
    await api.wait(500);
    api.rebuild();
    await api.fx('finale2');
  }
}
