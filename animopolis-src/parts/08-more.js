
/* =========================================================
   NOUVELLES ENQUÊTES (5 par quartier)
   ========================================================= */
const GARDIEN_M=SP('dog','coat','grey','cap',null,null,false,{build:'old'});
const KIDR=SP('rabbit','shirt','white','none',null,null,false,{build:'small',scale:.85}),KIDP=SP('pig','shirt','stripes','cap',null,null,false,{build:'small',scale:.85}),KIDM=SP('mouse','shirt','check','none',null,null,false,{build:'small',scale:.85}),KIDC=SP('cat','shirt','white','glasses',null,null,false,{build:'small',scale:.85});
const DAME=SP('elephant','dress','white','straw',null,null,false,{build:'round'}),MEDOR2=SP('dog','shirt','white','none',null,null,false,{build:'normal'});
const GARDPH=SP('owl','coat','white','cap',null,null,false,{build:'old'}),CONTRE=SP('dog','coat','stripes','beret',null,null,false,{build:'slim'}),PECHEUR=SP('frog','coat','grey','straw',null,null,false,{build:'round'});
const FORPECHE=SP('fox','shirt','check','cap',null,null,false,{build:'round'}),PAPA=SP('mouse','suit','white','glasses',null,null,false,{build:'tall'});
const FILOU=SP('duck','coat','check','cap',null,null,false,{build:'small'}),OPER=SP('pig','coat','grey','cap',null,null,false,{build:'round'});
const TROMPE=SP('elephant','dress','check','flower',null,null,false,{build:'old'}),CHIOT=SP('dog','shirt','white','none','run',null,false,{scale:.62,bell:true});
const FAUX=SP('hedgehog','suit','grey','cap',null,null,false,{build:'tall'}),FAUX2=SP('hedgehog','shirt','stripes','cap',null,null,false,{build:'tall'}),VOYA=SP('frog','suit','white','glasses');
const MAMIL=SP('rabbit','dress','check','straw',null,null,false,{build:'old'});
const FERMIERE=SP('pig','dress','white','straw',null,null,false,{build:'round'}),OURSON=SP('bear','shirt','white','none',null,null,false,{build:'small'}),RENARDV=SP('fox','coat','grey','cap',null,null,false,{build:'slim'}),HIBOUV=SP('owl','coat','check','glasses',null,null,false,{build:'old'});
for(const s of['dog|stripes','fox|check','duck|check','hedgehog|grey','hedgehog|stripes','fox|grey','owl|check'])RESERVED.add(s);
const CH=(n,s)=>({n,s});

CASES.push(
 {id:'vase',dist:0,title:'Le vase brisé',diff:1,card:[1060,150],
  intro:"Au Musée, le plus vieux vase de la ville a été retrouvé en mille morceaux. Le gardien est désespéré, et des enfants jouaient au ballon dans le quartier…",
  cast:[{n:'Monsieur Gardon',r:'gardien du musée',s:GARDIEN_M},{n:'Les enfants',r:'qui jouent au ballon',s:KIDR}],
  steps:[
   {w:0,q:"Trouve le gardien devant les morceaux du vase.",ok:"Devant le Musée, il ramasse les débris en soupirant."},
   {w:null,q:"Un objet a roulé loin du musée. Lequel ?",ok:"Un ballon de foot, coincé dans un buisson."},
   {w:null,q:"Qui joue au ballon dans le quartier ?",ok:"Trois enfants, dans la cour de l'École… mais il en manque un."},
   {w:null,q:"Un enfant se cache. Trouve-le.",ok:"Une petite souris à carreaux, accroupie près du toboggan, l'air coupable."},
   {w:null,q:"Alors, qui a cassé le vase ?",choice:[CH('La lapine',KIDR),CH('Le petit cochon',KIDP),CH('La souris à carreaux',KIDM),CH('Le chaton à lunettes',KIDC)],ans:2,ok:"C'est la petite souris. Elle a tiré trop fort… et elle est allée s'excuser au gardien."}],
  outro:"Le gardien a recollé le vase, et les enfants ont maintenant un vrai terrain de foot. Enquête classée !"},
 {id:'chapeau',dist:1,title:'Le chapeau envolé',diff:1,card:[1820,640],
  intro:"Madame Barrique, élégante éléphante, se promène sur la jetée avec son beau chapeau de paille. Mais aujourd'hui, le vent souffle fort…",
  cast:[{n:'Madame Barrique',r:'éléphante, chapeau de paille',s:DAME}],
  steps:[
   {w:0,q:"Le vent se lève ! Trouve Madame Barrique.",ok:"Sur le ponton, les bras en l'air : son chapeau s'envole !"},
   {w:null,q:"Où est le chapeau maintenant ?",ok:"Il vole au-dessus de la mer, poussé par le vent."},
   {w:null,q:"Il finit par se poser. Où ?",ok:"En haut du mât d'un voilier !"},
   {w:null,q:"Une vague le fait tomber à l'eau. Qui le récupère ?",ok:"Un nageur l'a mis sur sa tête, tout fier."},
   {w:0,q:"Comment le chapeau revient-il à sa propriétaire ?",ok:"Un chien le rapporte en courant sur la plage, sous les applaudissements."}],
  outro:"Madame Barrique a acheté une jolie ficelle pour attacher son chapeau. Enquête classée !"},
 {id:'phare',dist:1,title:'Le phare éteint',diff:2,card:[1600,140],
  intro:"Cette nuit, la lumière du phare s'est éteinte et trois bateaux ont failli s'échouer. Panne… ou sabotage ? Plusieurs personnes rôdaient près de la jetée.",
  cast:[{n:'Monsieur Hiboulet',r:'gardien du phare',s:GARDPH},{n:'Le marin rayé',r:'inconnu au béret',s:CONTRE},{n:'Coassin',r:'pêcheur',s:PECHEUR},{n:'Capitaine Plouf',r:'capitaine',s:PLOUF}],
  steps:[
   {w:0,q:"Trouve le gardien du phare, très inquiet.",ok:"Au bout de la jetée, il lève les bras : la grosse lampe est cassée !"},
   {w:null,q:"Des éclats de verre mènent quelque part. Où ?",ok:"Sur la plage, une traînée d'éclats brillants…"},
   {w:null,q:"Au bout de la traînée, que trouve-t-on ?",ok:"Une barque noire tirée sur le sable, cachée par une bâche."},
   {w:null,q:"La barque a déchargé quelque chose en cachette. Quoi ?",ok:"Des caisses sans étiquette, dissimulées près de la Capitainerie."},
   {w:1,q:"Quelqu'un vend ces caisses. À qui ?",ok:"Le marin rayé les propose au pizzaïolo, devant la Pizzeria."},
   {w:2,q:"Un témoin a entendu du verre se briser. Trouve-le.",ok:"Coassin le pêcheur, au Square des Mouettes, montre le phare du doigt."},
   {w:1,q:"Le suspect se cache avant de repartir. Où ?",ok:"Accroupi derrière des tonneaux, sur le quai du marché."},
   {w:null,q:"Qui a éteint le phare ?",choice:[CH('Le gardien du phare',GARDPH),CH('Le marin rayé',CONTRE),CH('Coassin le pêcheur',PECHEUR),CH('Capitaine Plouf',PLOUF)],ans:1,ok:"Le marin rayé ! Un contrebandier qui voulait débarquer ses caisses dans le noir."}],
  outro:"Le phare brille à nouveau, et le contrebandier a été arrêté au moment de reprendre la mer. Enquête classée !"},
 {id:'peche',dist:2,title:'La pêche truquée',diff:1,card:[470,1500],
  intro:"Au stand de pêche aux canards, personne ne gagne jamais rien. Les enfants pleurent, les parents râlent. Il y a quelque chose de louche…",
  cast:[{n:'Monsieur Goupil',r:'renard forain',s:FORPECHE},{n:'Bobo',r:'clown',s:CLOWN},{n:'Monsieur Souriceau',r:'papa d\'un enfant',s:PAPA},{n:'Monsieur Crinière',r:'directeur',s:DIRO}],
  steps:[
   {w:null,q:"Un enfant pleure : il n'a rien gagné. Trouve-le.",ok:"Près du stand de pêche aux canards, un petit lapin sanglote."},
   {w:null,q:"Les canards en plastique sont trop lourds. Pourquoi ?",ok:"Une caisse de plombs cachée près du stand : ils sont tous lestés !"},
   {w:0,q:"Les lots du stand ne sont jamais donnés. Où sont-ils ?",ok:"Près du Train fantôme, entassés dans une brouette."},
   {w:0,q:"Que deviennent ces lots ?",ok:"Au bord du lac, quelqu'un les revend en douce, à moitié prix."},
   {w:null,q:"Alors, qui triche ?",choice:[CH('Monsieur Goupil',FORPECHE),CH('Bobo le clown',CLOWN),CH('Monsieur Souriceau',PAPA),CH('Monsieur Crinière',DIRO)],ans:0,ok:"Monsieur Goupil, le forain du stand ! Il lestait les canards pour revendre les lots."}],
  outro:"Tous les enfants ont reçu un lot, et Monsieur Goupil tient désormais… le stand de nettoyage. Enquête classée !"},
 {id:'tickets',dist:2,title:'Les tickets envolés',diff:2,card:[790,1320],
  intro:"La boîte de tickets de la grande roue a disparu ! Depuis, un petit canard en manteau à carreaux fait tous les manèges sans jamais payer…",
  cast:[{n:'Filou',r:'canard, manteau à carreaux',s:FILOU},{n:'Monsieur Bougnat',r:'forain de la grande roue',s:OPER},{n:'Bobo',r:'clown',s:CLOWN}],
  steps:[
   {w:1,q:"Le forain découvre que ses tickets ont disparu. Trouve-le.",ok:"Au pied de la grande roue, devant sa boîte vide."},
   {w:0,q:"Filou monte sur un manège sans payer. Lequel ?",ok:"Il grimpe en douce sur le carrousel."},
   {w:0,q:"Il paie un jeu avec les tickets volés. Lequel ?",ok:"Le stand de tir : il tend une poignée de tickets."},
   {w:0,q:"Il s'offre une gourmandise. Laquelle ?",ok:"Des nougats, au stand de confiseries."},
   {w:null,q:"Il sème des tickets en courant. Trouve la piste.",ok:"Une traînée de tickets près des autos-tamponneuses."},
   {w:0,q:"Filou se cache. Où ?",ok:"Au cœur du labyrinthe de haies."},
   {w:2,q:"Qui l'attrape ?",ok:"Bobo le clown, à la sortie du labyrinthe."},
   {w:0,q:"Comment l'histoire se termine-t-elle ?",ok:"Filou rend la boîte de tickets au forain de la grande roue."}],
  outro:"Filou va aider le forain tout l'été. En échange, il aura un tour de grande roue gratuit chaque soir. Enquête classée !"},
 {id:'chiot',dist:3,title:'Le chiot du train',diff:1,card:[1960,1460],
  intro:"Madame Trompe arrive en train avec Biscuit, son chiot à collier rouge. Mais à peine les portes ouvertes, Biscuit file comme une flèche !",
  cast:[{n:'Madame Trompe',r:'vieille éléphante, robe à carreaux',s:TROMPE},{n:'Biscuit',r:'chiot à collier rouge',s:CHIOT}],
  steps:[
   {w:0,q:"Trouve Madame Trompe, qui appelle son chiot.",ok:"Au bout du quai, elle appelle Biscuit de toutes ses forces."},
   {w:1,q:"Biscuit court après quelque chose. Quoi ?",ok:"Des pigeons, sur le parvis de la gare !"},
   {w:1,q:"Son flair l'emmène ailleurs. Où ?",ok:"Aux entrepôts, il renifle une caisse de saucisses."},
   {w:1,q:"Il fait une grosse bêtise. Laquelle ?",ok:"Il chipe un paquet de biscuits devant la biscuiterie."},
   {w:1,q:"Épuisé, où Biscuit fait-il la sieste ?",ok:"Dans la cabine de la vieille locomotive du Square du Rail."}],
  outro:"Madame Trompe a retrouvé Biscuit… et payé les biscuits. Il porte maintenant une laisse. Enquête classée !"},
 {id:'controleur',dist:3,title:'Le faux contrôleur',diff:2,card:[1680,1250],
  intro:"Un hérisson en uniforme gris distribue des amendes aux voyageurs et empoche l'argent. Mais la gare n'a aucun contrôleur hérisson…",
  cast:[{n:'Le contrôleur',r:'hérisson en uniforme gris',s:FAUX},{n:'Monsieur Coâ',r:'voyageur',s:VOYA},{n:'La cheffe de gare',r:'lionne à casquette',s:CHEFG}],
  steps:[
   {w:1,q:"Un voyageur a reçu une drôle d'amende. Trouve-le.",ok:"Devant l'Hôtel Terminus, il montre un papier en se grattant la tête."},
   {w:0,q:"Le faux contrôleur fait encore payer quelqu'un. Où ?",ok:"Près des Objets trouvés, il réclame de l'argent à une famille."},
   {w:2,q:"La vraie cheffe de gare, elle, ne se doute de rien. Où est-elle ?",ok:"Sur le parvis, elle consulte les horaires."},
   {w:null,q:"D'où vient l'uniforme ? Trouve l'indice.",ok:"Aux entrepôts, un vestiaire ouvert : un cintre vide et une étiquette « contrôleur »."},
   {w:0,q:"Le faux contrôleur compte son butin. Où ?",ok:"Dans le Square du Rail, assis à l'écart."},
   {w:0,q:"Il se débarrasse de son uniforme. Où ?",ok:"Derrière la biscuiterie, il fourre l'uniforme gris dans un sac… et il porte maintenant d'autres habits."},
   {w:null,q:"Sous quelle apparence le faux contrôleur se promène-t-il maintenant ?",choice:[CH('Marinière et casquette',FAUX2),CH('Manteau blanc, béret',EPINE),CH('Costume noir, lunettes',SP('hedgehog','suit','black','glasses')),CH('Robe à carreaux',PIQ)],ans:0,ok:"Marinière et casquette ! Léonie l'a arrêté à la sortie de la gare."}],
  outro:"Tous les voyageurs ont été remboursés. Le faux contrôleur trie maintenant les valises perdues. Enquête classée !"},
 {id:'oeufs',dist:4,title:'La chasse aux œufs',diff:1,card:[1100,2260],
  intro:"Mamie Lapin a caché cinq œufs dorés dans toute la Colline pour les enfants du village. Elle a oublié où… À toi de les retrouver !",
  cast:[{n:'Mamie Lapin',r:'vieille lapine, robe à carreaux',s:MAMIL}],
  steps:[
   {w:null,q:"Premier œuf doré : il est près de quelque chose qui tourne avec le vent.",ok:"Au pied du moulin !"},
   {w:null,q:"Deuxième œuf : il se cache entre des grappes.",ok:"Dans les vignes."},
   {w:null,q:"Troisième œuf : il prend un bain… sans se mouiller.",ok:"Sur le bord de la fontaine du village."},
   {w:null,q:"Quatrième œuf : il dort au creux d'un tronc.",ok:"Dans un vieux tronc creux, à l'orée de la forêt."},
   {w:null,q:"Dernier œuf : il attend sur une marche, au pied d'un château.",ok:"Sur l'escalier du château !"}],
  outro:"Les enfants du village ont partagé les cinq œufs… et Mamie Lapin a promis de faire une carte l'an prochain. Enquête classée !"},
 {id:'tartes',dist:4,title:'Les tartes de la ferme',diff:2,card:[1240,2060],
  intro:"Chaque matin, la fermière pose ses tartes au miel sur le rebord de sa fenêtre. Et chaque matin, elles disparaissent. Quatre habitants ont l'air un peu trop gourmands…",
  cast:[{n:'Madame Pâquerette',r:'fermière',s:FERMIERE},{n:'Le Renard gris',r:'suspect',s:RENARDV},{n:"L'Ourson",r:'suspect',s:OURSON},{n:'Grognon',r:'suspect',s:GROGNON},{n:'Lili',r:'suspecte',s:LILI}],
  steps:[
   {w:0,q:"Trouve la fermière devant son rebord de fenêtre vide.",ok:"Devant la Ferme, elle montre le plat vide, furieuse."},
   {w:null,q:"Le voleur a laissé une piste. Laquelle ?",ok:"Des miettes de tarte qui partent vers les champs."},
   {w:null,q:"Un autre indice traîne dans les champs. Lequel ?",ok:"Un pot de miel renversé, près des ruches."},
   {w:null,q:"Des traces dans la boue près de l'étang. De quelles pattes ?",ok:"De petites pattes rondes, avec des griffes… pas des sabots, pas des pattes de renard."},
   {w:null,q:"Un témoin a vu quelque chose tôt ce matin. Trouve-le.",ok:"Un vieux hibou, devant l'église, mime quelqu'un de petit et de rond."},
   {w:1,q:"Le Renard gris a un alibi. Lequel ?",ok:"Il jouait aux cartes à l'auberge depuis l'aube."},
   {w:null,q:"Quelqu'un dort le museau plein de miel. Trouve-le.",ok:"Dans les vignes, roulé en boule, couvert de miel et de miettes."},
   {w:null,q:"Alors, qui a volé les tartes ?",choice:[CH('Le Renard gris',RENARDV),CH("L'Ourson",OURSON),CH('Grognon',GROGNON),CH('Lili',LILI)],ans:1,ok:"L'Ourson ! Il a fini par avouer, avec un grand sourire collant."}],
  outro:"La fermière a appris à l'Ourson à faire ses propres tartes. Il en apporte une chaque dimanche. Enquête classée !"}
);

/* ---------- décors propres à ces enquêtes ---------- */
const ball=(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;C(c,x,y-3,3,WHITE);D(c,x,y-3,1,INK);D(c,x-1.8,y-4.6,.6,INK);D(c,x+1.8,y-1.6,.6,INK);};
const egg=(c,x,y)=>{c.save();c.fillStyle='rgba(60,50,30,.22)';c.beginPath();c.ellipse(x,y+.4,5.6,2,0,0,TAU);c.fill();c.strokeStyle=INK;c.lineWidth=.9;c.beginPath();c.moveTo(x-6.4,y-.6);for(let k=0;k<7;k++)c.lineTo(x-5+k*1.7,y+(k%2?1.8:-.4));c.stroke();   // paille du nid
  c.lineWidth=1.1;E(c,x,y-5.6,4.6,6,'#e6c14a');c.fillStyle=RED;c.fillRect(x-4.4,y-6,8.8,1.7);c.fillStyle=WHITE;c.beginPath();c.arc(x-1.6,y-8,1.1,0,TAU);c.fill();c.restore();};
function scene(u,v,draw,o){return addSpr(u,v,draw,Object.assign({ht:30,hw:20},o||{}));}
function buildMore(){
  /* ---- Le vase brisé (Centre) */
  CURD=0;
  {const p=placeNear(1045,100);addChar(p[0],p[1],as(GARDIEN_M,{pose:'crouch'}));scene(p[0]+10,p[1]+4,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;for(const[dx,dy,a]of[[-3,0,.4],[3,-1,-.6],[0,2,1.1],[6,1,.2]]){c.save();c.translate(x+dx,y+dy);c.rotate(a);P(c,[[-2,0],[2,0],[1,-3]],'#7fb0d6');c.restore();}},{ht:8});setT('vase',1,p[0]+4,p[1],22);}
  {const k=blk(3,0);const p=placeNear(k.u0+200,k.v0+130);scene(p[0],p[1],(c,x,y)=>{c.strokeStyle=INK;const bl=[[-12,-8,8],[0,-12,9],[12,-8,8],[-6,-4,7],[7,-4,7]];c.lineWidth=2.2;for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}c.fillStyle=WHITE;for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}
    ball(c,x+3,y-10);                                                      // le ballon, pris dans les branches
    c.strokeStyle=INK;c.fillStyle=WHITE;c.lineWidth=2;for(const b of[[-1,-3,5],[9,-3,5]]){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}for(const b of[[-1,-3,5],[9,-3,5]]){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}},{ht:26,hw:22});avoid(p[0],p[1],14);setT('vase',2,p[0],p[1],22);}
  {const k=blk(3,1);const p=placeNear(k.u0+120,k.v0+150);addChar(p[0],p[1],as(KIDR,{pose:'run'}));addChar(p[0]+14,p[1]+4,as(KIDP,{pose:'arms_up'}));addChar(p[0]-12,p[1]+8,as(KIDC,{pose:'point'}));scene(p[0]+6,p[1]+12,(c,x,y)=>ball(c,x,y),{ht:8});setT('vase',3,p[0]+2,p[1]+4,30);}
  {const k=blk(3,1);const p=placeNear(k.u0+210,k.v0+164);addChar(p[0],p[1],as(KIDM,{pose:'hide'}));setT('vase',4,p[0],p[1],20);}
  /* ---- Le chapeau envolé (Port) */
  CURD=1;
  addChar(1880,606,as(DAME,{pose:'arms_up',hat:'none'}));setT('chapeau',1,1880,606,22);
  scene(1990,560,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y,7.6,1.8,'#efe6c8');E(c,x,y-1.8,3.8,2.4,'#efe6c8');c.fillStyle=INK;c.fillRect(x-3.8,y-1.2,7.6,.9);c.lineWidth=.5;for(const k of[0,3,6])L(c,x-16-k,y+2+k,x-10-k,y+1+k);},{top:true,z:60,ht:12});{const[x,y]=pr(1990,560,60);setTxy('chapeau',2,x,y,22);}
  G(1976,552,2004,568,c=>{const[x,y]=pr(1990,560,0);c.save();c.globalAlpha=.28;c.fillStyle=INK;c.beginPath();c.ellipse(x,y,9,3,0,0,TAU);c.fill();c.restore();});
  addSpr(2000,880,(c,x,y)=>{drawBoat(c,x,y,1,{sail:true,len:26});c.strokeStyle=INK;c.lineWidth=1;E(c,x,y-52,7,1.6,'#efe6c8');E(c,x,y-53.6,3.6,2.2,'#efe6c8');},{hw:34,ht:62});{const[x,y]=pr(2000,880,0);setTxy('chapeau',3,x,y-46,22);}
  addSpr(1940,760,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.7;c.beginPath();c.arc(x-5,y,3,PI*1.1,PI*1.9);c.stroke();c.beginPath();c.arc(x+5,y,3,PI*1.1,PI*1.9);c.stroke();c.save();c.translate(x,y-4);drawHead(c,{head:'dog',hat:'straw'},1);c.restore();},{ht:18,hw:14});setT('chapeau',4,1940,760,20);
  {const p=placeNear(1820,700,10);addChar(p[0],p[1],as(MEDOR2,{pose:'run',hat:'straw'}));addChar(p[0]-14,p[1]-4,as(DAME,{pose:'arms_up',hat:'none',flip:true}));setT('chapeau',5,p[0]-6,p[1]-2,24);}
  /* ---- Le phare éteint (Port) */
  addChar(1960,50,as(GARDPH,{pose:'arms_up'}));setT('phare',1,1960,50,22);
  G(1810,80,1870,140,c=>{c.fillStyle='#7fb0d6';c.strokeStyle=INK;c.lineWidth=.4;for(let k=0;k<12;k++){const[x,y]=pr(1860-k*4,90+k*3.4,0);c.beginPath();c.moveTo(x,y);c.lineTo(x+2,y-1.4);c.lineTo(x+1,y+1);c.closePath();c.fill();c.stroke();}});setT('phare',2,1845,102,24);
  addSpr(1784,82,(c,x,y)=>{drawBoat(c,x,y,-1,{len:18,col:'#3a3733'});c.strokeStyle=INK;c.lineWidth=1.1;c.beginPath();c.moveTo(x-19,y-8);c.quadraticCurveTo(x-12,y-22,x-2,y-19);c.quadraticCurveTo(x+9,y-23,x+17,y-9);c.lineTo(x+14,y-3);c.quadraticCurveTo(x,y-1,x-16,y-3);c.closePath();c.fillStyle='#bdb7a6';c.fill();c.stroke();
    c.lineWidth=.6;for(const dx of[-9,-1,7])L(c,x+dx,y-18,x+dx+1.4,y-3);c.lineWidth=.9;for(const dx of[-17,15])L(c,x+dx,y-7,x+dx*1.15,y+1);D(c,x-12,y-5,1,WHITE);D(c,x+11,y-5,1,WHITE);},{hw:26,ht:26});avoid(1784,82,18);setT('phare',3,1784,82,24);
  {const k=blk(4,0);const p=placeNear(k.u0+200,k.v0+150,10);for(const[du,dv]of[[0,0],[10,2],[4,-9]])addCrate(p[0]+du,p[1]+dv,9);scene(p[0]+6,p[1],(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-12,y-14],[x+10,y-16],[x+14,y-4],[x-10,y-2]],'#8f8a7c');},{ht:20,top:true});setT('phare',4,p[0]+5,p[1]-2,24);}
  {const k=blk(5,1);const p=placeNear(1568,388,8);addChar(p[0],p[1],as(CONTRE,{pose:'give',prop:'bag'}));addChar(p[0]+14,p[1]+2,SP('pig','chef','white','chef','stand',null,true));setT('phare',5,p[0]+7,p[1]+1,24);}
  {const p=placeNear(1390,400,8);addChar(p[0],p[1],as(PECHEUR,{pose:'point'}));setT('phare',6,p[0],p[1],22);}
  {const p=placeNear(1660,680,10);addBarrel(p[0]-8,p[1]+6);addBarrel(p[0]+6,p[1]+8);addChar(p[0],p[1],as(CONTRE,{pose:'hide'}));setT('phare',7,p[0],p[1]+2,22);}
  delete CASES.find(c=>c.id==='phare').steps[7].t;
  /* ---- La pêche truquée (Fête) */
  CURD=2;
  {const p=placeNear(470,1560,8);addChar(p[0],p[1],SP('rabbit','shirt','dots','none','hide',null,false,{build:'small',scale:.85}));addSpr(p[0],p[1],(c,x,y)=>{c.fillStyle='#7fb0d6';for(const[dx,dy]of[[-3,-18],[3,-17],[-4,-14]]){c.beginPath();c.arc(x+dx,y+dy,.9,0,TAU);c.fill();}},{top:true,ht:22});setT('peche',1,p[0],p[1],20);}
  {const p=placeNear(372,1600,8);addCrate(p[0],p[1],9);scene(p[0],p[1],(c,x,y)=>{txt(c,'PLOMBS',x,y-14,4.4,WHITE);for(const dx of[-3,0,3])D(c,x+dx,y-17,1.1,'#5b5750');},{top:true,ht:22});setT('peche',2,p[0],p[1],20);}
  {const k=blk(0,5);const p=placeNear(k.u0+60,k.v0+170,8);scene(p[0]+12,p[1],(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-10,y-10],[x+8,y-10],[x+6,y-2],[x-8,y-2]],'#a8946a');C(c,x-10,y-1,2.4,WHITE);for(const[dx,dy]of[[-4,-14],[2,-15],[-1,-19]]){C(c,x+dx,y+dy,3.2,'#d8c8a4');D(c,x+dx-1,y+dy-1,.5);D(c,x+dx+1,y+dy-1,.5);}},{ht:26,hw:16});addChar(p[0],p[1],as(FORPECHE,{pose:'carry',prop:'bag'}));setT('peche',3,p[0]+6,p[1],24);}
  {const k=blk(2,6);const p=placeNear(k.u0+60,k.v1-24,8);addChar(p[0],p[1],as(FORPECHE,{pose:'give',prop:'money'}));addChar(p[0]+14,p[1]+2,SP('cat','dress','white','straw','stand',null,true));scene(p[0]-10,p[1]+2,(c,x,y)=>{for(const dx of[-4,4]){C(c,x+dx,y-4,3,'#d8c8a4');D(c,x+dx-1,y-5,.5);D(c,x+dx+1,y-5,.5);}},{ht:10});setT('peche',4,p[0]+4,p[1],24);}
  delete CASES.find(c=>c.id==='peche').steps[4].t;
  /* ---- Les tickets envolés (Fête) */
  {const k=blk(2,4);const p=placeNear(k.u0+170,k.v0+60,8);addChar(p[0],p[1],as(OPER,{pose:'arms_up'}));scene(p[0]+12,p[1]+2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-5,y-8,10,8,'#d8c8a4');Rc(c,x-5,y-10,10,2,'#2b2926');},{ht:12});setT('tickets',1,p[0]+6,p[1],22);}
  {const p=placeNear(372,1548,8);addChar(p[0],p[1],as(FILOU,{pose:'give',prop:'ticket'}));setT('tickets',3,p[0],p[1],20);}
  {const p=placeNear(530,1374,8);addChar(p[0],p[1],as(FILOU,{pose:'carry',prop:'cotton'}));setT('tickets',4,p[0],p[1],20);}
  {const p=placeNear(1080,1252,8);G(p[0]-20,p[1]-10,p[0]+20,p[1]+10,c=>{for(let k=0;k<8;k++){const[x,y]=pr(p[0]-18+k*5,p[1]-8+k*2.4+(k%2)*3,0);c.save();c.translate(x,y);c.rotate(k*.7);c.strokeStyle=INK;c.lineWidth=.5;Rc(c,-2.4,-1.3,4.8,2.6,'#efe6c8');c.restore();}});setT('tickets',5,p[0],p[1],24);}
  {const k=blk(3,6);const u=k.u0+20+1.5*32,v=k.v0+30+4.5*32;addChar(u,v,as(FILOU,{pose:'crouch'}));setT('tickets',6,u,v,20);}
  {const k=blk(3,6);const p=placeNear(k.u1-16,k.v1-14,6);addChar(p[0],p[1],as(FILOU,{pose:'arms_up'}));addChar(p[0]-14,p[1]-2,as(CLOWN,{pose:'point'}));setT('tickets',7,p[0]-7,p[1]-1,24);}
  {const k=blk(2,4);const p=placeNear(k.u0+186,k.v0+112,8);addChar(p[0],p[1],as(FILOU,{pose:'give',prop:'bag'}));addChar(p[0]+14,p[1]+2,as(OPER,{pose:'stand',flip:true}));setT('tickets',8,p[0]+7,p[1]+1,24);}
  /* ---- Le chiot du train (Gare) */
  CURD=3;
  addChar(1994,1524,as(TROMPE,{pose:'wave'}));setT('chiot',1,1994,1524,22);
  {const k=blk(4,4);const p=placeNear(k.u0+110,k.v0+90,8);addChar(p[0],p[1],as(CHIOT,{pose:'run'}));scene(p[0]+12,p[1]-6,(c,x,y)=>{for(const[dx,dy]of[[0,-14],[10,-20],[-6,-24]]){c.save();c.translate(x+dx,y+dy);c.strokeStyle=INK;c.lineWidth=.8;E(c,0,0,3,1.6,'#cfcac0');c.beginPath();c.moveTo(-1,-1);c.lineTo(-4,-4);c.moveTo(1,-1);c.lineTo(4,-4);c.stroke();c.restore();}},{top:true,ht:30});setT('chiot',2,p[0]+4,p[1]-2,24);}
  {const k=blk(5,6);const p=placeNear(k.u0+150,k.v0+120,8);addCrate(p[0]+10,p[1]-2,9);scene(p[0]+10,p[1]-2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.7;for(let k=0;k<3;k++)E(c,x-4+k*4,y-11,2.4,1,'#d9a3a0');},{top:true,ht:16});addChar(p[0],p[1],as(CHIOT,{pose:'lean'}));setT('chiot',3,p[0]+4,p[1],20);}
  {const k=blk(4,6);const p=placeNear(k.u0+60,k.v0+150,8);addChar(p[0],p[1],as(CHIOT,{pose:'run',prop:'book'}));setT('chiot',4,p[0],p[1],20);}
  {const k=blk(6,6);const[x,y]=pr(k.uc+20,k.v0+48,22);addSpr(k.uc+20,k.v0+56,(c)=>{drawChar(c,x,y+8,as(CHIOT,{pose:'sleep'}));},{top:true,ht:60,hw:30});setTxy('chiot',5,x,y-4,22);}
  /* ---- Le faux contrôleur (Gare) */
  {const k=blk(5,4);const p=placeNear(k.u0+180,k.v0+70,8);addChar(p[0],p[1],as(VOYA,{pose:'think',prop:'letter'}));setT('controleur',1,p[0],p[1],22);}
  {const k=blk(6,4);const p=placeNear(k.u0+130,k.v0+150,8);addChar(p[0],p[1],as(FAUX,{pose:'give',prop:'notepad'}));for(const[du,dv,s]of[[14,2,SP('pig','dress','white','none','stand',null,true)],[24,8,SP('pig','shirt','white','none','stand',null,true,{build:'small',scale:.8})]])addChar(p[0]+du,p[1]+dv,s);setT('controleur',2,p[0]+10,p[1]+3,26);}
  {const k=blk(4,4);const p=placeNear(k.u0+60,k.v0+130,8);addChar(p[0],p[1],as(CHEFG,{pose:'carry',prop:'newspaper'}));setT('controleur',3,p[0],p[1],20);}
  {const k=blk(5,6);const p=placeNear(k.u0+200,k.v0+170,10);scene(p[0],p[1],(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-9,y-30,18,30,'#c9c2b2');Rc(c,x-7,y-28,14,26,'#3a3733');c.lineWidth=.8;L(c,x-4,y-24,x+4,y-24);c.beginPath();c.moveTo(x,y-24);c.lineTo(x-4,y-20);c.lineTo(x+4,y-20);c.closePath();c.stroke();Rc(c,x+9,y-28,6,26,'#c9c2b2');Rc(c,x-6,y-14,12,4,WHITE);txt(c,'CONTRÔLEUR',x,y-12,2.6);},{ht:34,hw:18});avoid(p[0],p[1],12);setT('controleur',4,p[0],p[1],22);}
  {const k=blk(6,6);const p=placeNear(k.u0+60,k.v0+190,8);addChar(p[0],p[1],as(FAUX,{pose:'ground',prop:'money'}));setT('controleur',5,p[0],p[1],20);}
  {const k=blk(4,6);const p=placeNear(k.u1-30,k.v0+190,8);addBin(p[0]+10,p[1]);addChar(p[0],p[1],as(FAUX2,{pose:'give',prop:'clothes'}));setT('controleur',6,p[0]+4,p[1],22);}
  delete CASES.find(c=>c.id==='controleur').steps[6].t;
  /* ---- La chasse aux œufs (Colline) */
  CURD=4;
  {const k4=blk(4,8);const p=placeNear(k4.u0+140,k4.v0+100,6);scene(p[0],p[1],egg,{ht:12});setT('oeufs',1,p[0],p[1],16);}
  {const k3=blk(3,8);const p=[k3.u0+40,k3.v0+142];scene(p[0],p[1],egg,{ht:12});avoid(p[0],p[1],10);setT('oeufs',2,p[0],p[1],16);}
  {const k=blk(4,7);scene(k.u0+150+40,k.v0+150+2,egg,{ht:12,top:true});setT('oeufs',3,k.u0+190,k.v0+152,16);}
  {const p=placeNear(860,2140,8);scene(p[0],p[1],(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;P(c,[[x-9,y],[x-7,y-16],[x+7,y-16],[x+9,y]],'#efe8d6');E(c,x,y-16,7,2.4,'#5b5750');E(c,x,y-9,3,4.4,'#2b2926');egg(c,x,y-6);},{ht:24,hw:12});setT('oeufs',4,p[0],p[1],18);}
  {const[x,y]=pr(1732,2561,7);scene(1732,2562,(c)=>egg(c,x,y),{top:true,ht:20,hw:10});setTxy('oeufs',5,x,y-8,16);}
  /* ---- Les tartes de la ferme (Colline) */
  {const p=placeNear(1215,2090,6);addChar(p[0],p[1],as(FERMIERE,{pose:'arms_up'}));scene(p[0]+12,p[1]+2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;E(c,x,y-2,6,1.8,WHITE);D(c,x-2,y-2.4,.4);D(c,x+1,y-2,.4);},{ht:6});setT('tartes',1,p[0]+4,p[1],22);}
  G(1240,2160,1320,2250,c=>{c.fillStyle='#a8946a';for(let k=0;k<14;k++){const[x,y]=pr(1250+k*5,2170+k*5.6,0);c.fillRect(x+(k%2?2:-2),y,1.6,1.6);}});setT('tartes',2,1280,2210,26);
  {const k4=blk(4,8);const p=placeNear(k4.u0+60,k4.v0+120,8);for(const dx of[-16,-4])scene(p[0]+dx,p[1]-8,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;c.beginPath();c.moveTo(x-6,y);c.quadraticCurveTo(x-8,y-14,x,y-16);c.quadraticCurveTo(x+8,y-14,x+6,y);c.closePath();c.fillStyle='#efe3b0';c.fill();c.stroke();c.lineWidth=.5;for(let k=1;k<4;k++)L(c,x-6,y-k*4,x+6,y-k*4);D(c,x,y-4,1,INK);},{ht:20});
   scene(p[0]+8,p[1],(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;c.save();c.translate(x,y-3);c.rotate(1.3);Rc(c,-3,-4,6,7,'#d8c8a4');c.restore();E(c,x+6,y,6,2,'#e6c14a');},{ht:10});setT('tartes',3,p[0],p[1]-2,26);}
  G(670,2490,720,2530,c=>{c.fillStyle='#5b5750';for(let k=0;k<7;k++){const[x,y]=pr(680+k*6,2500+k*4,0);c.beginPath();c.ellipse(x,y,2.8,1.7,0,0,TAU);c.fill();for(const d of[-1.6,0,1.6])c.fillRect(x+d,y-2.2,.8,.8);}});setT('tartes',4,698,2516,22);
  {const p=placeNear(1027,2090,6);addChar(p[0],p[1],as(HIBOUV,{pose:'wave'}));setT('tartes',5,p[0],p[1],20);}
  {const p=placeNear(960,2200,8);addTable(p[0]+10,p[1]);addChar(p[0],p[1],as(RENARDV,{pose:'sit',prop:'book'}));addChar(p[0]+20,p[1]+1,SP('pig','coat','white','straw','sit',null,true));setT('tartes',6,p[0]+8,p[1],22);}
  {const p=placeNear(1110,2400,10);addChar(p[0],p[1],as(OURSON,{pose:'sleep'}));scene(p[0],p[1],(c,x,y)=>{c.fillStyle='#e6c14a';c.beginPath();c.arc(x+2,y-22,2,0,TAU);c.fill();c.fillRect(x-4,y-14,2,3);},{top:true,ht:30});setT('tartes',7,p[0],p[1],20);}
  delete CASES.find(c=>c.id==='tartes').steps[7].t;
}
