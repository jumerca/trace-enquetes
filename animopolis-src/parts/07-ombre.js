
/* =========================================================
   FIL ROUGE : L'OMBRE
   ========================================================= */
const VELOURS=SP('cat','suit','white','melon',null,null,false,{gloves:true,build:'tall'});
const OMBRE=SP('cat','suit','black','melon',null,null,false,{gloves:true,cape:true,mask:true,build:'tall'});
const HARD=['collier','banque','zorbo','recette','couronne'];
const CLUES={
 collier:{t:"Une carte noire",x:"Dans la poche du Renard Noir : une carte de visite noire frappée d'un œil blanc. Au dos, une seule lettre : « O. »"},
 banque:{t:"Le coffre n°13",x:"L'ours avoue : « On nous a payés pour faire du bruit pendant que quelqu'un vidait le coffre n°13. » Dans le coffre vide : la même carte noire à l'œil blanc."},
 zorbo:{t:"Ombre & Cie",x:"Les dettes de Zorbo avaient été rachetées par une société inconnue : « Ombre & Cie ». Son adresse est une boîte postale… à la Mairie."},
 recette:{t:"Des gants blancs",x:"Croquant n'était qu'un intermédiaire : « Le patron porte toujours des gants blancs et un chapeau melon. Je ne l'ai jamais vu sans masque. »"},
 couronne:{t:"Le rendez-vous",x:"Gigot craque : « La couronne, c'était pour l'Ombre. Elle cache tout son butin dans la forêt. » Le dossier de l'Ombre est complet !"}
};
const INTROS=[null,
 "Les mouettes crient, les bateaux dansent : bienvenue au Port ! On raconte qu'une silhouette en cape noire rôde la nuit sur les quais…",
 "Musique, barbe à papa et manèges : la Fête foraine ouvre ses portes ! Mais derrière les caravanes, quelqu'un semble tirer les ficelles…",
 "Trains, valises et vapeur : voici la Gare et ses entrepôts. Un endroit idéal pour faire disparaître… presque n'importe quoi.",
 "Forêts profondes, village paisible et vieux château : bienvenue sur la Colline. Les secrets les mieux gardés de la ville dorment peut-être ici."];

CASES.push({id:'ombre',dist:0,final:true,title:"Le dossier de l'Ombre",diff:3,card:[700,720],
  intro:"Cinq affaires, cinq indices, une seule signature : un œil blanc sur une carte noire. Quelqu'un de très respecté dirige en secret tous les mauvais coups d'Animopolis. Il est temps de démasquer l'Ombre.",
  cast:[{n:"L'Ombre",r:'cape noire, masque, chapeau melon, gants blancs',s:OMBRE},{n:'Monsieur Velours',r:'le Maire, costume blanc, gants blancs',s:VELOURS},{n:'Inspectrice Léonie',r:'police',s:LEONIE},{n:'Brigadier Toutou',r:'police',s:TOUTOU}],
  steps:[
   {w:1,q:"La ville est en fête : son Maire fait un discours. Trouve-le.",ok:"Monsieur Velours parle sur une estrade près du Rond-point du Fondateur. Joli costume blanc… et des gants blancs."},
   {w:1,q:"Une main gantée de blanc se débarrasse de quelque chose. Où ?",ok:"Sur le quai du canal, le Maire jette une carte noire à l'eau en regardant autour de lui."},
   {w:1,q:"Le Maire quitte son bureau avec un objet qu'il ne quitte jamais.",ok:"Devant la Mairie, il serre contre lui une mallette noire."},
   {w:0,q:"La nuit, une silhouette surveille le Port d'en haut.",ok:"L'Ombre, au pied du phare, observe les bateaux."},
   {w:0,q:"Le contenu du coffre n°13 n'est pas loin. Où l'Ombre le récupère-t-elle ?",ok:"Au Chantier naval, elle sort un sac d'une caisse marquée « 13 »."},
   {w:0,q:"Pour ne pas passer par les rues, rien de tel que l'eau.",ok:"L'Ombre rame dans une barque noire, au fond du bassin."},
   {w:0,q:"Qui a racheté les dettes de Zorbo ? Surprends l'échange.",ok:"Près des autos-tamponneuses, l'Ombre remet un contrat à l'huissier Cranemou."},
   {w:0,q:"À la fête, l'Ombre donne ses ordres. À qui ?",ok:"Derrière les caravanes, à Crocus, le forain, qui baisse la tête."},
   {w:0,q:"À la Gare, l'Ombre met quelque chose à l'abri.",ok:"Elle range sa mallette dans un casier de la consigne."},
   {w:0,q:"Croquant reçoit ses instructions. Où ?",ok:"Au bout du quai, l'Ombre lui tend un billet de train."},
   {w:1,q:"Le soir du banquet, un invité de marque se promène au château.",ok:"Monsieur Velours, en costume blanc, au milieu de la cour… le même soir que le vol."},
   {w:0,q:"L'Ombre cache un nouveau trésor. Où ?",ok:"Dans la forêt, elle creuse au pied d'un grand arbre."},
   {w:null,q:"Trouve le repaire de l'Ombre.",ok:"Dans une clairière, sous une bâche : le butin de toutes les affaires, sacs, bijoux et parchemins !"},
   {w:2,q:"La police trouve un indice près du repaire. Lequel ?",ok:"Un gant blanc, oublié dans l'herbe. Léonie le ramasse avec sa pince."},
   {w:2,q:"D'où vient ce gant ? Léonie enquête en ville.",ok:"Au marché, la mercière reconnaît le gant : elle en vend une seule paire par an… au Maire."},
   {w:1,q:"Quelqu'un se change en cachette en ville.",ok:"Derrière la Chapelle, le Maire enfile une cape noire !"},
   {w:0,q:"Démasquée, l'Ombre tente de fuir. Par où ?",ok:"Par le canal, dans une barque, à toute vitesse."},
   {w:3,q:"La police lui coupe la route. Où ?",ok:"Léonie et Toutou bloquent la sortie du pont, au bout du canal."},
   {w:1,q:"Le masque tombe. Trouve la scène.",ok:"Sur le quai, devant la péniche : l'Ombre retire son masque. C'est bien Monsieur Velours, le Maire !"},
   {w:2,q:"Toute la ville fête la fin de l'affaire. Trouve la fête.",ok:"Devant la Mairie : la Comtesse, la Duchesse, la Baronne et Zorbo applaudissent l'Inspectrice Léonie."}],
  outro:"Le Maire Velours, alias l'Ombre, a rendu tous les trésors. Animopolis a élu une nouvelle maire : l'Inspectrice Léonie. Bravo, détective : toutes les affaires de la ville sont résolues !"});

function placeNear(u,v,r){for(let k=0;k<40;k++){const a=k*2.4,d=k*1.6;const uu=u+Math.cos(a)*d,vv=v+Math.sin(a)*d;if(free(uu,vv,r||6))return[uu,vv];}return[u,v];}
function buildOmbre(){
  const O=as(OMBRE,{}),V=as(VELOURS,{});const S=(n,u,v,r,z)=>setT('ombre',n,u,v,r||24,z);
  // ---- Centre
  CURD=0;
  {const[u,v]=placeNear(914,920);addBoxItem(u-12,v-8,u+12,v+8,40,c=>{drawBox(c,u-12,v-8,0,24,16,6,'#d9a3a0','#c98f8b','#b97f7b');const[x,y]=pr(u,v,6);drawChar(c,x,y,as(V,{pose:'wave'}));});
   for(const[du,dv]of[[-16,-12],[4,-18],[-26,0]])addChar(u+du,v+dv,as(randomSpec(),{pose:'wave',flip:false}));S(1,u,v,24,10);for(let k=0;k<8;k++)avoid(u+6+k*4,v+6+k*4,14);}
  {const[u,v]=[380,563];addChar(u,v,as(V,{pose:'give',flip:false}));addSpr(u+9,v+4,(c,x,y)=>{c.save();c.translate(x,y);c.rotate(.5);Rc(c,-2.6,-1.6,5.2,3.4,INK);D(c,0,0,.8,WHITE);c.restore();},{ht:8});S(2,u,v,22);}
  {const[u,v]=[690,664];addChar(u,v,as(V,{pose:'carry',prop:'suitcase'}));S(3,u,v,22);}
  {const[u,v]=placeNear(234,1056);addChar(u,v,as(V,{pose:'crouch'}));addSpr(u+10,v+4,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y-2,6,3,'#2b2926');},{ht:8});S(16,u,v,22);}
  addBoat(545,592,1,{len:16,col:'#3a3733',who:as(O,{}),oar:true});S(17,545,592,24);
  addChar(300,626,as(LEONIE,{pose:'arms_up'}));addChar(312,630,as(TOUTOU,{pose:'point',flip:true}));S(18,306,628,24);
  addChar(470,620,as(O,{pose:'stand',mask:false,prop:null}));addSpr(478,622,(c,x,y)=>{c.fillStyle=INK;c.fillRect(x-1,y-4,7,2.4);},{ht:6});addChar(484,626,as(LEONIE,{pose:'point',flip:true}));S(19,476,622,24);
  {const[u,v]=placeNear(700,744);addChar(u,v,as(LEONIE,{pose:'arms_up',prop:'trophy'}));for(const[du,dv,s]of[[-14,6,MIAOU],[14,6,HERMINE],[-6,16,BISCOTTE],[8,18,ZORBO]])addChar(u+du,v+dv,as(s,{pose:'arms_up',prop:null}));
   addSpr(u,v,(c,x,y)=>{for(const[dx,dy,col]of[[-12,-50,RED],[10,-54,'#e6c14a'],[0,-60,RED],[18,-44,'#7fb0d6'],[-20,-42,'#e6c14a']]){c.fillStyle=col;c.fillRect(x+dx,y+dy,2,3);}},{top:true,ht:64});S(20,u,v+6,32);avoid(u,v+6,80);}
  {const k=blk(0,1);const[u,v]=placeNear(k.u0+200,k.v0+24);addChar(u,v,as(LEONIE,{pose:'give',prop:'notepad'}));addChar(u+14,v+2,SP('hedgehog','dress','white','flower','think',null,true,{build:'old'}));addSpr(u+6,v-2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;C(c,x+6,y-24,2.2,WHITE);},{top:true,ht:30});S(15,u+7,v+1,24);}
  // ---- Port
  CURD=1;
  addChar(1900,50,as(O,{pose:'stand'}));S(4,1900,50,22);
  {const k=blk(4,2);const[u,v]=placeNear(k.u0+200,k.v0+140);addCrate(u-12,v-6,12);addSpr(u-12,v-6,(c,x,y)=>txt(c,'13',x,y-13,6,WHITE),{top:true,ht:20});addChar(u,v,as(O,{pose:'carry',prop:'sack'}));S(5,u-4,v-2,24);}
  addBoat(1230,1040,1,{len:16,col:'#2b2926',who:as(O,{}),oar:true});S(6,1230,1040,24);
  // ---- Fête
  CURD=2;
  {const k=blk(3,4);const[u,v]=placeNear(k.u0+60,k.v0+190);addChar(u,v,as(O,{pose:'give',prop:'letter'}));addChar(u+14,v+2,as(HUISS,{flip:true}));S(7,u+7,v+1,24);}
  {const k=blk(0,6);const[u,v]=placeNear(k.u0+30,k.v0+100);addChar(u,v,as(O,{pose:'point'}));addChar(u+14,v+4,as(FORAIN,{pose:'stand',flip:true}));S(8,u+7,v+2,24);}
  // ---- Gare
  CURD=3;
  {const k=blk(4,4);const[u,v]=placeNear(k.u0+24,k.v0+90);addSpr(u-12,v-2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-12,y-30,24,30,'#c9c2b2');c.lineWidth=.6;for(let r=0;r<3;r++)for(let q=0;q<3;q++){Rc(c,x-11+q*7.6,y-29+r*9.6,7,9,r===1&&q===2?'#2b2926':'#ece7db');D(c,x-5+q*7.6,y-25+r*9.6,.5);}txt(c,'CONSIGNE',x,y-33,4.6);},{ht:40,hw:16});
   addChar(u,v,as(O,{pose:'give',prop:'suitcase'}));S(9,u-6,v-2,26);}
  addChar(1830,1524,as(O,{pose:'give',prop:'ticket'}));addChar(1844,1526,as(CROQ,{flip:true}));S(10,1837,1525,24);
  // ---- Colline
  CURD=4;
  addChar(1880,2400,as(V,{pose:'stand',prop:'cane'}),{z:ZU});S(11,1880,2400,22,ZU);
  {const[u,v]=placeNear(120,2250,12);addTree(u-10,v-12,1.15);addChar(u+4,v+2,as(O,{pose:'dig',prop:'shovel'}));S(12,u,v,26);}
  {const[u,v]=placeNear(650,2080,14);addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;c.beginPath();c.moveTo(x-22,y);c.lineTo(x-14,y-16);c.lineTo(x+16,y-16);c.lineTo(x+24,y);c.closePath();c.fillStyle='#8f8a7c';c.fill();c.stroke();
     drawProp(c,'sack',x-12,y-4,1);drawProp(c,'crownp',x+2,y-2,1);drawProp(c,'necklace',x+12,y-12,1);Rc(c,x+6,y-6,10,6,'#efe6c8');D(c,x-4,y-1,1.6,'#e6c14a');D(c,x,y,1.4,'#e6c14a');
     c.save();c.translate(x+18,y-22);Rc(c,-5,-3.4,10,6.8,INK);D(c,0,0,1.6,WHITE);D(c,0,0,.7,INK);c.restore();},{ht:32,hw:28});S(13,u,v,28);}
  {const[u,v]=placeNear(560,2060,10);G(u+6,v-4,u+14,v+4,c=>{const[x,y]=pr(u+10,v,0);c.strokeStyle=INK;c.lineWidth=.8;E(c,x,y-1,3,1.6,WHITE);});addChar(u,v,as(LEONIE,{pose:'crouch',prop:'magnifier'}));S(14,u+4,v,24);}
}
