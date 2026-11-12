
/* =========================================================
   QUARTIER 4 : LA GARE  +  ENQUÊTE DIFFICILE DE LA FÊTE
   ========================================================= */
DISTRICTS.push({id:'gare',name:'La Gare',de:'de la Gare',u0:1180,v0:1180,u1:2120,v1:2032,need:2,sides:['v','u'],blocks:[[4,4],[5,4],[6,4],[4,6],[5,6],[6,6]],extra:[[1180,1452,2032,1716],[2032,1180,2120,2032]]});
DISTRICTS[1].sides=['u'];DISTRICTS[2].sides=['v'];

/* ---------- décors ---------- */
function addNews(u,v,who){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;if(who)drawChar(c,x,y-4,who);Rc(c,x-16,y-16,32,16,WHITE);c.lineWidth=.5;for(let k=0;k<5;k++)Rc(c,x-14+k*6,y-14,5,7,k%2?'#efeadf':WHITE);c.lineWidth=1;L(c,x-16,y-16,x-16,y-36);L(c,x+16,y-16,x+16,y-36);P(c,[[x-20,y-36],[x+20,y-36],[x+16,y-44],[x-16,y-44]],'#3a3733');txt(c,'JOURNAUX',x,y-40,5.4,WHITE);},{ht:48,hw:22});avoid(u,v,16);}
function addBarrier(u0,u1,v){addBoxItem(u0,v,u1,v+.5,14,c=>{c.strokeStyle=INK;for(let u=u0;u<=u1;u+=14){const[x,y]=pr(u,v,0);c.lineWidth=1.2;L(c,x,y,x,y-10);}const a=pr(u0,v,9),b=pr(u1,v,9);c.lineWidth=3;L(c,a[0],a[1],b[0],b[1]);c.lineWidth=1.6;c.strokeStyle=WHITE;L(c,a[0],a[1],b[0],b[1]);c.strokeStyle=RED;c.setLineDash([4,4]);L(c,a[0],a[1],b[0],b[1]);c.setLineDash([]);c.strokeStyle=INK;});}
function addParcel(u,v,open){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-7,y-10,14,10,'#d8c8a4');L(c,x,y-10,x,y);L(c,x-7,y-5,x+7,y-5);
  if(open){C(c,x,y-16,5,WHITE);D(c,x-3.4,y-21,1.4,INK);D(c,x+3.4,y-21,1.4,INK);L(c,x,y-16,x,y-19);L(c,x,y-16,x+2.4,y-15);txt(c,'DRING !',x,y-30,7,RED);}else txt(c,'?',x,y-17,9);},{ht:36,hw:16});avoid(u,v,10);}
function addContainer(u,v,col,h){addBoxItem(u-22,v-8,u+22,v+8,40,c=>{drawBox(c,u-22,v-8,0,44,16,h||16,col,col,col);c.save();faceV(c,u-22,v+8,h||16);c.lineWidth=.4;for(let k=3;k<44;k+=3.5)L(c,k,1,k,(h||16)-1);c.restore();});}
function addCrane(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.6;L(c,x-10,y,x-4,y-120);L(c,x+10,y,x+4,y-120);c.lineWidth=.6;for(let k=0;k<12;k++){const y1=y-k*10,y2=y-(k+1)*10;L(c,x-10+k*.5,y1,x+4,y2);}c.lineWidth=1.4;L(c,x-30,y-120,x+90,y-120);L(c,x-30,y-112,x+90,y-120);Rc(c,x-34,y-124,14,12,'#3a3733');c.lineWidth=.6;L(c,x+70,y-120,x+70,y-70);Rc(c,x+62,y-70,16,10,'#e6c14a');},{ht:130,hw:100});}
function addSmoke(u,v,z,dark){const[X,Y]=pr(u,v,z);addMover([X-20,Y-70,X+60,Y+10],(c,t)=>{c.strokeStyle='#8f8a7c';c.lineWidth=1;for(let i=0;i<5;i++){const ph=((animOn()?t*.22:0)+i/5)%1;c.globalAlpha=.9*(1-ph*.8);c.beginPath();c.arc(X+ph*30+Math.sin(ph*6+i)*3,Y-ph*52,5+ph*9,0,TAU);c.fillStyle=dark?'#6e685d':'#ffffff';c.fill();c.stroke();}c.globalAlpha=1;});}
function addStage(u,v,extra){addBoxItem(u-30,v-14,u+30,v+14,60,c=>{drawBox(c,u-30,v-14,0,60,28,8,'#d8c8a4','#cdbb92','#bfae84');for(const[pu,pv]of[[u-30,v-14],[u+30,v-14]]){const a=pr(pu,pv,8),b=pr(pu,pv,46);c.lineWidth=1.2;L(c,a[0],a[1],b[0],b[1]);}
  const q=[pr(u-30,v-14,46),pr(u+30,v-14,46),pr(u+30,v-14,38),pr(u-30,v-14,38)];c.beginPath();q.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=RED;c.fill();c.stroke();
  c.save();c.translate(...pr(u-30,v-14,46));c.transform(1,.5,0,1,0,0);txt(c,'LE GRAND ZORBO',30,4,6.4,WHITE);c.restore();if(extra)extra(c);});}
function drawTrunk(c,x,y,open){c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-11,y-12,22,12,'#3a3733');c.fillStyle='#e6c14a';for(const sx of[-6,6])c.fillRect(x+sx-1,y-12,2,12);if(open){P(c,[[x-11,y-12],[x+11,y-12],[x+13,y-22],[x-9,y-22]],'#3a3733');}else Rc(c,x-12,y-15,24,3,'#3a3733');for(let k=0;k<5;k++)D(c,x-8+k*4,y-18,.6,'#e6c14a');}
function drawTrainCar(c,u,v,len,heads,loco){
  const v0=v-7;
  for(const pu of[u+8,u+len-8]){const[x,y]=pr(pu,v0+14,3);E(c,x,y,3.6,3.6,INK);D(c,x,y,1.3,WHITE);}
  drawBox(c,u,v0,3,len,14,22,loco?'#3a3733':'#efeadf',loco?'#3a3733':WHITE,loco?'#2b2926':'#e2ddd0');
  c.save();faceV(c,u,v0+14,25);
  if(loco){Rc(c,len-16,3,12,8,'#eef1f0');txt(c,'BB 63',len/2-6,12,6,WHITE);}
  else{for(let k=0;k<Math.floor(len/12);k++){const wx=3+k*12;if(k===2){Rc(c,wx,3,8,19,'#cfc9bc');continue;}c.save();c.beginPath();c.rect(wx,4,8,8);c.fillStyle='#eef1f0';c.fill();c.clip();if(heads&&heads[k]){c.translate(wx+4,11);c.scale(.55,.55);drawHead(c,{head:heads[k]},1);}c.restore();c.strokeRect(wx,4,8,8);}c.fillStyle='#3d6fb8';c.fillRect(0,15,len,1.6);}
  c.restore();
}
function addTrain(u,v,cars,o){o=o||{};const len=58,gap=3,tot=cars*(len+gap)+50;const heads=[];for(let k=0;k<cars*6;k++)heads.push(rnd()<.6?pick(HEADS):null);
  const it=addBoxItem(u,v-7,u+tot,v+7,40,c=>{c.strokeStyle=INK;c.lineWidth=1;drawTrainCar(c,u,v,46,null,true);for(let k=0;k<cars;k++)drawTrainCar(c,u+50+k*(len+gap),v,len,heads.slice(k*6,k*6+6),false);if(o.after)o.after(c);});return it;}
function drawWagon(c,x,y,who){c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-12,y-12,24,10,'#3a3733');C(c,x-7,y-2,2.6,INK);C(c,x+7,y-2,2.6,INK);c.save();c.translate(x+6,y-8);C(c,0,0,3,WHITE);D(c,-1,-.5,.8,INK);D(c,1,-.5,.8,INK);c.restore();if(who){c.save();c.translate(x-3,y-17);drawHead(c,who,1);c.restore();}}

/* ---------- personnages ---------- */
const ZORBO=SP('owl','suit','black','top','stand','cane',false,{build:'tall'}),ZORBO2=SP('owl','shirt','stripes','straw',null,null,false,{build:'tall'}),BARRIT=SP('elephant','dress','dots','flower',null,null,false,{build:'round'}),HUISS=SP('croc','suit','grey','glasses','stand','letter',false,{build:'slim'});
const COA=SP('frog','dress','check','straw','stand','suitcase',false,{build:'old'}),LARD=SP('pig','suit','black','glasses','stand','suitcase',false,{build:'round'});
const EPINE=SP('hedgehog','coat','white','beret',null,null,false,{scarf:'#3a3733',build:'old'}),EPINETTE=SP('hedgehog','dress','dots','bow','stand',null,false,{scale:.75}),CHEFG=SP('lion','coat','grey','cap'),DEMIN=SP('elephant','shirt','grey','helmet');
const BISCOTTE=SP('pig','dress','black','top',null,null,false,{build:'round'}),LIVREUR=SP('rabbit','suit','grey','cap',null,null,false,{build:'tall'}),LAPNOIR=SP('rabbit','suit','black','glasses',null,null,false,{build:'tall'}),SOURIS=SP('mouse','shirt','check','none',null,null,false,{build:'small'}),CROQ=SP('croc','suit','black','top',null,null,false,{build:'slim'}),GARDIEN=SP('dog','coat','grey','cap',null,null,false,{build:'old'});

CASES.push(
 {id:'zorbo',dist:2,title:'La disparition de Zorbo',diff:3,card:[520,1560],
  intro:"Le Grand Zorbo, hibou magicien, doit présenter ce soir son tour le plus célèbre : la malle qui fait disparaître. Mais Zorbo a des dettes… et il disparaît pour de vrai.",
  cast:[{n:'Le Grand Zorbo',r:'hibou magicien, haut-de-forme',s:ZORBO},{n:'Zorbo déguisé',r:'marinière, chapeau de paille',s:ZORBO2},{n:'Barrit',r:'son assistante éléphante',s:BARRIT},{n:'Maître Cranemou',r:'huissier crocodile',s:HUISS},{n:'Inspectrice Léonie',r:'police',s:LEONIE}],
  steps:[
   {w:0,q:"Zorbo affiche son spectacle près de l'entrée. Trouve-le.",ok:"Il colle une affiche « ZORBO, CE SOIR ! » sur un panneau."},
   {w:0,q:"Il répète un tour de magie. Où ?",ok:"Derrière les caravanes, il fait sortir un lapin de son chapeau."},
   {w:3,q:"Un huissier lui réclame de l'argent. Trouve-les.",ok:"Près des stands de jeux, Maître Cranemou lui tend une facture salée."},
   {w:0,q:"Zorbo achète l'accessoire de son grand tour. Lequel ?",ok:"Une grande malle noire, au stand d'accessoires du coin restauration."},
   {w:2,q:"Le spectacle commence… et Zorbo disparaît ! Trouve la scène.",ok:"Sur l'estrade au bord du lac, la malle est vide et Barrit lève les bras."},
   {w:0,q:"Par où Zorbo s'est-il échappé ?",ok:"Par une bouche d'égout ! Il ressort près des montagnes russes."},
   {w:1,q:"Il se déguise. Où trouve-t-il son nouveau costume ?",ok:"Sur un fil à linge derrière le cirque : une marinière et un chapeau de paille."},
   {w:1,q:"Déguisé, il se cache en hauteur. Où ?",ok:"Dans une nacelle de la grande roue !"},
   {w:2,q:"Barrit a appelé la police. Trouve-les.",ok:"Près du carrousel, Barrit décrit Zorbo à l'Inspectrice Léonie."},
   {w:null,q:"Un objet de Zorbo flotte quelque part. Lequel ?",ok:"Son chapeau haut-de-forme dérive sur le lac des cygnes."},
   {w:null,q:"Le lapin du chapeau s'est enfui. Où est-il ?",ok:"Il gambade près des autos-tamponneuses."},
   {w:1,q:"Zorbo se cache dans un manège sombre. Lequel ?",ok:"Dans un wagonnet du Train fantôme !"},
   {w:1,q:"Il change encore de cachette. Trouve-le en pleine fuite.",ok:"Dans les montagnes russes, il se cramponne au wagon de queue."},
   {w:4,q:"Où Zorbo est-il rattrapé ?",ok:"Au coin restauration : Léonie lui pose la patte sur l'épaule."},
   {w:3,q:"Comment l'histoire se termine-t-elle ?",ok:"Devant le chapiteau, Zorbo rembourse l'huissier avec la recette du spectacle."}],
  outro:"Le tour de la « vraie disparition » est devenu le numéro le plus célèbre de la fête. Zorbo a payé toutes ses dettes. Enquête classée !"},
 {id:'valise',dist:3,title:'La valise échangée',diff:1,card:[1260,1250],
  intro:"Madame Coâ part en vacances à la mer. Monsieur Lard part à une réunion très sérieuse. Leurs valises sont exactement les mêmes…",
  cast:[{n:'Madame Coâ',r:'grenouille, robe à carreaux',s:COA},{n:'Monsieur Lard',r:'cochon en costume noir',s:LARD}],
  steps:[
   {w:0,q:"Madame Coâ achète son billet. Où ?",ok:"Au guichet de la gare."},
   {w:1,q:"Les deux valises se retrouvent côte à côte. Où ?",ok:"Sur un banc du parvis de la gare : deux valises identiques !"},
   {w:0,q:"Madame Coâ repart… avec la mauvaise valise. Trouve-la.",ok:"Sur le quai, elle file vers son train sans se douter de rien."},
   {w:1,q:"Monsieur Lard ouvre sa valise. Que trouve-t-il ?",ok:"Devant l'Hôtel Terminus : des maillots de bain et une bouée !"},
   {w:0,q:"Où les valises sont-elles enfin échangées ?",ok:"Aux Objets trouvés, chacun récupère la sienne en riant."}],
  outro:"Monsieur Lard a fait sa réunion en chemise à fleurs. Tout le monde a adoré. Enquête classée !"},
 {id:'colis',dist:3,title:'Le colis mystère',diff:2,card:[1560,1260],
  intro:"Un colis abandonné fait tic-tac sur le quai de la gare ! Tout le monde s'inquiète. Mais qui l'a laissé là, et que contient-il ?",
  cast:[{n:'Monsieur Épine',r:'hérisson au béret et écharpe',s:EPINE},{n:'Épinette',r:'sa petite-fille',s:EPINETTE},{n:'La cheffe de gare',r:'lionne à casquette',s:CHEFG},{n:'Le démineur',r:'éléphant casqué',s:DEMIN}],
  steps:[
   {w:null,q:"Trouve le colis abandonné sur le quai.",ok:"Un carton avec un point d'interrogation… et un drôle de tic-tac."},
   {w:2,q:"La cheffe de gare donne l'alerte. Trouve-la.",ok:"Sur le quai, elle siffle et fait signe aux voyageurs de partir."},
   {w:null,q:"Les voyageurs sont évacués. Où attendent-ils ?",ok:"Sur le parvis, derrière une barrière rouge et blanche."},
   {w:0,q:"Plus tôt dans la journée : qui avait ce colis sous le bras ?",ok:"Monsieur Épine, au kiosque à journaux."},
   {w:0,q:"Où Monsieur Épine a-t-il pris son café ?",ok:"À la terrasse du Café Le Quai, le colis posé à ses pieds."},
   {w:0,q:"Il court attraper son train. Trouve-le.",ok:"Il fonce au bout du quai… les pattes vides !"},
   {w:3,q:"Le démineur arrive. Trouve-le.",ok:"Il s'avance sur le quai avec sa grande pince."},
   {w:3,q:"Le colis est ouvert en lieu sûr. Que contient-il ?",ok:"Aux entrepôts : un réveil qui sonne ! DRING !"},
   {w:0,q:"Monsieur Épine revient chercher son colis. Où ?",ok:"Aux Objets trouvés, essoufflé."},
   {w:1,q:"Pour qui était ce réveil ?",ok:"Pour Épinette, sa petite-fille, sur un banc du Square du Rail."}],
  outro:"Épinette ne sera plus jamais en retard à l'école. La gare a repris son calme. Enquête classée !"},
 {id:'recette',dist:3,title:'La recette secrète',diff:3,card:[1300,1840],
  intro:"La Baronne Biscotte garde dans un coffre la recette secrète des célèbres biscuits d'Animopolis. Monsieur Croquant, son concurrent, rêverait de la connaître…",
  cast:[{n:'Baronne Biscotte',r:'cochonne, haut-de-forme',s:BISCOTTE},{n:'Le faux livreur',r:'lapin, costume gris',s:LIVREUR},{n:'Le même, sans déguisement',r:'lapin en noir, lunettes',s:LAPNOIR},{n:'La complice',r:'souris à carreaux',s:SOURIS},{n:'Monsieur Croquant',r:'crocodile, haut-de-forme',s:CROQ},{n:'Inspectrice Léonie',r:'police',s:LEONIE}],
  steps:[
   {w:0,q:"La Baronne montre sa recette devant la biscuiterie. Trouve-la.",ok:"Elle brandit fièrement le parchemin devant ses ouvriers."},
   {w:1,q:"Un livreur apporte de la farine. Trouve-le.",ok:"Un lapin en costume gris dépose un sac… il n'a pas l'air d'un vrai livreur."},
   {w:1,q:"Le faux livreur fait quelque chose de louche. Quoi ?",ok:"Caché derrière des caisses, il photographie la recette !"},
   {w:3,q:"Il remet la pellicule à une complice. Où ?",ok:"Entre les conteneurs des entrepôts."},
   {w:3,q:"La complice file avec la pellicule. Trouve-la.",ok:"Elle pédale à toute allure dans le Square du Rail."},
   {w:4,q:"À qui la souris remet-elle la pellicule ?",ok:"À Monsieur Croquant, devant l'Hôtel Terminus."},
   {w:4,q:"Croquant prépare sa fuite. Où ?",ok:"Au guichet de la gare, il achète un billet de train."},
   {w:0,q:"La Baronne découvre le vol. Trouve-la.",ok:"Devant la biscuiterie, elle s'arrache les cheveux… enfin, son chapeau."},
   {w:5,q:"L'Inspectrice Léonie mène l'enquête. Qui interroge-t-elle ?",ok:"Le gardien de la biscuiterie, devant sa guérite."},
   {w:2,q:"Le faux livreur change de tenue. Où ?",ok:"Près des entrepôts, il jette sa casquette de livreur : il est maintenant en costume noir et lunettes."},
   {w:2,q:"Le lapin attend d'être payé. Où ?",ok:"À la terrasse du Café Le Quai, il compte une liasse de billets."},
   {w:4,q:"Croquant monte dans le train. Trouve-le.",ok:"Sur le quai, il grimpe dans une voiture, sa valise à la main."},
   {w:5,q:"Léonie le poursuit. Trouve-la.",ok:"Elle court sur le quai et saute dans le train de justesse !"},
   {w:4,q:"Croquant tente de s'échapper. Par où ?",ok:"Par le toit du train ! Il marche en équilibre sur le wagon."},
   {w:null,q:"Où l'affaire se termine-t-elle ?",ok:"Sur le parvis de la gare : Croquant et le lapin montent dans le fourgon de police."}],
  outro:"La Baronne a récupéré sa recette, et a même inventé un nouveau biscuit : le Croquant-menotte. Enquête classée !"}
);

/* ---------- construction ---------- */
function buildZorbo(){
  CURD=2;const B=(i,j)=>blk(i,j);
  {const k=B(0,4);const nu=k.u0+196,nv=k.v0+176;addSpr(nu,nv,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.4;L(c,x-14,y,x-14,y-40);L(c,x+14,y,x+14,y-40);c.lineWidth=1.1;Rc(c,x-18,y-46,36,28,'#f3eee2');Rc(c,x-13,y-44,26,24,'#3a3733');txt(c,'ZORBO',x,y-38,7,'#e6c14a');txt(c,'CE SOIR !',x,y-25,5.6,WHITE);c.save();c.translate(x,y-31);c.scale(.6,.6);drawHead(c,{head:'owl',hat:'top'},1);c.restore();},{ht:52,hw:22});avoid(nu,nv,14);
   addChar(nu+16,nv+4,as(ZORBO,{pose:'give',prop:null,flip:true}));setT('zorbo',1,nu+8,nv,26,6);}
  {const k=B(0,6);const u=k.u0+196,v=k.v0+184;addChar(u,v,as(ZORBO,{pose:'arms_up',prop:null}));addSpr(u,v,(c,x,y)=>{c.save();c.translate(x+7,y-38);Rc(c,-3,-5,6,6,INK);drawHead(c,{head:'rabbit'},1);c.restore();},{top:true,ht:50});addChar(u+16,v+6,SP('pig','shirt','white','none','arms_up',null,true,{scale:.8}));setT('zorbo',2,u+6,v+2,24);}
  {const k=B(1,5);const u=k.u0+196,v=k.v0+176;addChar(u,v,as(ZORBO,{pose:'arms_up',prop:null}));addChar(u+14,v+4,as(HUISS,{pose:'give',flip:true}));setT('zorbo',3,u+7,v+2,24);}
  {const k=B(3,5);const u=k.u0+196,v=k.v0+116;addStall(u,v,'Accessoires','cheese');addChar(u-4,v-14,SP('frog','shirt','dots','cap'));addChar(u+22,v+16,as(ZORBO,{pose:'carry',prop:null}));addSpr(u+22,v+16,(c,x,y)=>drawTrunk(c,x+12,y,false),{ht:24,hw:26});setT('zorbo',4,u+22,v+14,26);
   addChar(k.u0+60,k.v0+196,as(ZORBO2,{pose:'arms_up'}));addChar(k.u0+46,k.v0+200,as(LEONIE,{pose:'give'}));setT('zorbo',14,k.u0+53,k.v0+198,24);}
  {const k=B(2,6);const u=k.u0+170,v=k.v1-30;addStage(u,v,c=>{const[x,y]=pr(u,v,8);drawTrunk(c,x,y,true);drawChar(c,x-16,y+2,as(BARRIT,{pose:'arms_up'}));});
   setT('zorbo',5,u-6,v,30,10);
   for(const[du,dv]of[[-14,22],[2,26],[18,24],[-30,20],[30,28]])addChar(u+du,v+dv,as(randomSpec(),{pose:'arms_up',flip:rnd()<.5}));
   const hu=k.u0+70,hv=k.v0+70;addSpr(hu,hv,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y-1,9,3,'#3a3733');Rc(c,x-5,y-12,10,11,'#3a3733');c.lineWidth=.6;for(const s of[-1,1]){c.beginPath();c.arc(x+s*12,y+1,4,PI*1.1,PI*1.9);c.stroke();}},{ht:16,hw:18});setT('zorbo',10,hu,hv,22);}
  {const k=B(2,5);const u=k.u0+60,v=k.v0+196;G(u-12,v-8,u+12,v+8,c=>{c.save();c.translate(...pr(u,v,0));c.scale(1,.5);C(c,0,0,11,'#2b2926');c.lineWidth=1.6;c.beginPath();c.arc(0,0,11,0,TAU);c.stroke();c.restore();});
   addSpr(u,v+1,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;Rc(c,x-3.4,y-14,6.8,8,INK);c.fillStyle=WHITE;c.fillRect(x-3.4,y-9.4,6.8,1.2);E(c,x,y-14,6,1.8,INK);c.save();c.translate(x+16,y+2);c.rotate(.3);E(c,0,0,9,3,'#8f8a7c');c.restore();},{top:true,ht:20,hw:16});
   addChar(u+2,v+9,as(ZORBO,{pose:'arms_up',noShadow:true}));setT('zorbo',6,u+1,v+3,24);}
  {const k=B(1,6);const u=k.u0+50,v=k.v0+190;addClothesline(u,v,'zorbo');addChar(u+20,v+14,as(ZORBO,{pose:'think'}));setT('zorbo',7,u,v+2,28);
   addChar(k.uc+44,k.v0+124,as(ZORBO2,{pose:'give',prop:'money'}));addChar(k.uc+58,k.v0+126,as(HUISS,{pose:'carry',prop:'money',flip:true}));setT('zorbo',15,k.uc+51,k.v0+125,24);}
  {const k=B(1,4);addChar(k.u0+54,k.v0+194,as(BARRIT,{pose:'point'}));addChar(k.u0+68,k.v0+196,as(LEONIE,{pose:'carry',prop:'notepad',flip:true}));setT('zorbo',9,k.u0+61,k.v0+195,24);}
  {const k=B(3,4);const u=k.u0+180,v=k.v0+176;addSpr(u,v,(c,x,y)=>{drawChar(c,x,y,SP('rabbit','shirt','white','none','run',null,false,{scale:.85}),true);},{ht:30});setT('zorbo',11,u,v,20);}
  {const b=bld.tfan;const p=fr(b,.25,22);addSpr(p[0],p[1],(c,x,y)=>drawWagon(c,x,y,{head:'owl',hat:'straw'}),{ht:34,hw:16});setT('zorbo',12,p[0],p[1]+4,22);}
}
function buildGare(){
  CURD=3;const D3=DISTRICTS[3];
  districtGround(D3,[[1442,1180,2032],[1726,1180,2032],[2010,1180,2032]],[[1442,1716,2032],[1726,1716,2032],[2010,1180,1452],[2010,1716,2032]]);
  for(const[i,j]of[[4,4],[5,4],[6,4],[4,6],[5,6]])blockGround(i,j);
  waterG(2032,1180,2120,2032,51);addBoat(2076,1500,1,{len:30,col:'#3a3733'});addBoat(2080,1860,-1,{len:22});
  // faisceau de voies
  const TR=[1492,1546,1600,1656];
  G(1180,1452,2032,1716,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,1180,1452,2032,1716,'#e2ddd0');
    rectG(c,1180,1456,2032,1480,'#ece7db');rectG(c,1180,1506,2032,1534,'#ece7db');
    c.lineWidth=.8;c.setLineDash([6,4]);for(const v of[1476,1510]){const a=pr(1180,v,0),b=pr(2032,v,0);L(c,a[0],a[1],b[0],b[1]);}c.setLineDash([]);
    for(const v of TR){c.lineWidth=.6;for(let u=1182;u<2032;u+=7)gp(c,[[u,v-8],[u+3,v-8],[u+3,v+8],[u,v+8]],'#cfc6b2');c.lineWidth=1.4;for(const dv of[-5,5]){const a=pr(1180,v+dv,0),b=pr(2032,v+dv,0);L(c,a[0],a[1],b[0],b[1]);}}});
  labelG(1190,1470,'Quai 1',12);labelG(1190,1522,'Quai 2',12);
  addTrain(1300,TR[0],5,{after:c=>{const[x,y]=pr(1590,TR[0]-2,25);drawChar(c,x,y,as(CROQ,{pose:'arms_up',prop:null}));}});
  {const[x,y]=pr(1590,TR[0]-2,25);setTxy('recette',14,x,y-14,22);}
  for(let k=0;k<7;k++)addContainer(1240+k*100,TR[2],pick(['#c9c2b2','#3a3733','#d9a3a0','#b9c4c9']),16);
  addTrain(1720,TR[3],0);
  areas.push({u0:1190,v0:1508,u1:2020,v1:1532,n:30,dist:3});areas.push({u0:1190,v0:1458,u1:2020,v1:1478,n:16,dist:3});
  // quai 2 : scènes
  addChar(1300,1522,as(COA,{pose:'walk'}));setT('valise',3,1300,1522,22);
  addParcel(1520,1520,false);for(const[du,dv]of[[-26,-14],[22,-16],[30,4],[-30,4]])addChar(1520+du,1520+dv,as(randomSpec(),{pose:'arms_up'}));setT('colis',1,1520,1520,28);
  addChar(1448,1524,as(DEMIN,{pose:'point',prop:'magnifier'}));setT('colis',7,1448,1524,22);
  addChar(1900,1522,as(EPINE,{pose:'run'}));setT('colis',6,1900,1522,22);
  addChar(1644,1508,as(CROQ,{pose:'climb',prop:'suitcase'}));setT('recette',12,1644,1508,22);
  addChar(1760,1522,as(LEONIE,{pose:'run'}));setT('recette',13,1760,1522,22);
  addChar(1700,1470,as(CHEFG,{pose:'point',prop:'notepad'}));addSpr(1700,1470,(c,x,y)=>txt(c,'TUUUT !',x+14,y-44,7),{top:true,ht:50});setT('colis',2,1700,1470,24);
  // (4,4) la gare
  {const t=townBlock(4,4,[{id:'gare',w:200,sign:'GARE — GUICHETS',roof:'flat',h:86,tone:WHITE},{}],null,{n:22});
   const g=bld.gare;g.after=c=>{const[x,y]=pr(g.cx,g.cv,g.h);drawBox(c,g.cx-14,g.cv-14,g.h,28,28,40);const[a,b]=pr(g.cx,g.cv+14,g.h+28);C(c,a-7,b+3,8,WHITE);c.lineWidth=1;L(c,a-7,b+3,a-7,b-3);L(c,a-7,b+3,a-3,b+4);};
   {const p=fr(g,.25,14);addChar(p[0],p[1],as(COA,{pose:'give',prop:'ticket'}));setT('valise',1,p[0],p[1],22);}
   {const p=fr(g,.72,14);addChar(p[0],p[1],as(CROQ,{pose:'give',prop:'ticket'}));setT('recette',7,p[0],p[1],22);}
   const k=t.k;
   addBench(k.u0+150,k.v0+120,false);addChar(k.u0+142,k.v0+120.4,as(COA,{pose:'sit',prop:'newspaper'}));addChar(k.u0+158,k.v0+120.4,as(LARD,{pose:'sit',prop:'book',flip:true}));addSpr(k.u0+150,k.v0+124,(c,x,y)=>{drawProp(c,'suitcase',x-4,y-8,1);drawProp(c,'suitcase',x+5,y-8,1);},{ht:12});setT('valise',2,k.u0+150,k.v0+121,24);
   addBarrier(k.u0+30,k.u0+110,k.v0+160);for(let n=0;n<7;n++)addChar(k.u0+36+n*11,k.v0+172+(n%2)*6,randomSpec());setT('colis',3,k.u0+70,k.v0+168,34);
   addVan(k.u1-50,k.v0+70);addChar(k.u1-30,k.v0+80,as(CROQ,{pose:'arms_up',prop:null}));addChar(k.u1-20,k.v0+82,as(LAPNOIR,{pose:'arms_up'}));addChar(k.u1-26,k.v0+96,as(LEONIE,{pose:'point',flip:true}));addChar(k.u1-44,k.v0+96,as(BISCOTTE,{pose:'carry',prop:'map'}));setT('recette',15,k.u1-34,k.v0+84,32);
   for(let n=0;n<3;n++)addCar(k.u0+30+n*34,k.v1-14,'u',{taxi:true,driver:randomSpec()});}
  // (5,4) Hôtel Terminus + kiosque
  {const t=townBlock(5,4,[{id:'terminus',w:110,sign:'Hôtel Terminus',roof:'flat',h:90},{w:56,h:60}],null,{n:20,noFillA:true});
   const h=bld.terminus,k=t.k;
   {const p=fr(h,.22,14);addChar(p[0],p[1],as(LARD,{pose:'arms_up',prop:'ring'}));addSpr(p[0]+12,p[1]+2,(c,x,y)=>{drawProp(c,'suitcase',x,y-8,1);c.strokeStyle=INK;c.lineWidth=.7;Rc(c,x-6,y-14,5,5,'#7fb0d6');Rc(c,x+1,y-15,5,6,'#e6c14a');},{ht:20});setT('valise',4,p[0]+4,p[1],24);}
   {const p=fr(h,.75,14);addChar(p[0],p[1],as(SOURIS,{pose:'give',prop:'camera'}));addChar(p[0]+14,p[1]+2,as(CROQ,{pose:'stand',flip:true}));setT('recette',6,p[0]+7,p[1]+1,24);}
   addNews(k.u0+120,k.v0+150,SP('owl','coat','white','glasses'));addChar(k.u0+136,k.v0+158,as(EPINE,{pose:'carry',prop:null}));addSpr(k.u0+136,k.v0+158,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-4,y-20,9,7,'#d8c8a4');},{top:true,ht:24});setT('colis',4,k.u0+130,k.v0+154,26);}
  // (6,4) Objets trouvés + Café Le Quai
  {const t=townBlock(6,4,[{id:'objets',w:90,sign:'Objets trouvés',roof:'gable',h:60,awn:true},{id:'quai',w:70,sign:'Café Le Quai',awn:true,awnCol:'#c9b58a',roof:'flat'}],null,{n:18});
   const o=bld.objets,q=bld.quai;
   {const p=fr(o,.25,14);addChar(p[0]-6,p[1],as(COA,{pose:'give',prop:'suitcase'}));addChar(p[0]+8,p[1]+2,as(LARD,{pose:'give',flip:true}));setT('valise',5,p[0]+1,p[1]+1,24);}
   {const p=fr(o,.78,14);addChar(p[0],p[1],as(EPINE,{pose:'arms_up'}));setT('colis',9,p[0],p[1],22);}
   addTable(q.u0+12,q.v1+16);addChar(q.u0+4,q.v1+16,as(EPINE,{pose:'sit'}));addParcel(q.u0+18,q.v1+22,false);setT('colis',5,q.u0+10,q.v1+18,24);
   addTable(q.u1-4,q.v1+30);addChar(q.u1-12,q.v1+30,as(LAPNOIR,{pose:'sit',prop:'money'}));addParasol(q.u1-4,q.v1+26,true);setT('recette',11,q.u1-10,q.v1+30,22);}
  // (4,6) Biscuiterie
  {const t=townBlock(4,6,[{id:'usine',w:200,sign:'BISCUITERIE BISCOTTE',roof:'saw',bigDoor:true,h:70,signSize:8},{}],null,{n:16});
   const u=bld.usine,k=t.k;u.after=c=>{drawBox(c,u.u0+20,u.v0+6,u.h,10,10,46);};addSmoke(u.u0+25,u.v0+11,u.h+50);
   {const p=fr(u,.15,16);addChar(p[0],p[1],as(BISCOTTE,{pose:'arms_up',prop:'map'}));addChar(p[0]+14,p[1]+6,SP('mouse','chef','white','chef'));setT('recette',1,p[0]+5,p[1]+2,24);}
   {const p=fr(u,.5,16);addChar(p[0],p[1],as(BISCOTTE,{pose:'arms_up',prop:null}));setT('recette',8,p[0],p[1],22);}
   {const p=fr(u,.82,16);addChar(p[0],p[1],as(LIVREUR,{pose:'carry',prop:'sack'}));setT('recette',2,p[0],p[1],22);}
   for(const[du,dv]of[[0,0],[12,2],[5,-10]])addCrate(k.u0+150+du,k.v0+150+dv);addChar(k.u0+166,k.v0+160,as(LIVREUR,{pose:'crouch',prop:'camera',flip:true}));setT('recette',3,k.u0+160,k.v0+154,24);
   const gu=k.u1-30,gv=k.v0+120;addPhone(gu,gv,null);addChar(gu-14,gv+6,as(GARDIEN,{pose:'stand'}));addChar(gu-28,gv+8,as(LEONIE,{pose:'carry',prop:'notepad'}));setT('recette',9,gu-20,gv+6,26);}
  // (5,6) Entrepôts
  {const t=townBlock(5,6,[{w:110,sign:'Entrepôts',roof:'saw',bigDoor:true,h:60},{w:90,roof:'saw',bigDoor:true,h:56},{}],null,{n:12});
   const k=t.k;addCrane(k.u1-30,t.pv0+20);
   addContainer(k.u0+50,k.v0+130,'#3a3733');addContainer(k.u0+50,k.v0+170,'#c9c2b2');addChar(k.u0+52,k.v0+150,as(LIVREUR,{pose:'give',prop:'camera'}));addChar(k.u0+66,k.v0+152,as(SOURIS,{flip:true}));setT('recette',4,k.u0+59,k.v0+151,24);
   addBin(k.u0+170,k.v0+90);addChar(k.u0+160,k.v0+96,as(LAPNOIR,{pose:'give',prop:null}));addSpr(k.u0+168,k.v0+88,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;c.beginPath();c.arc(x,y-13,4,PI,0);c.closePath();c.fillStyle='#a8a296';c.fill();c.stroke();c.fillStyle='#a8a296';c.fillRect(x,y-13.6,6,1.4);},{top:true,ht:20});setT('recette',10,k.u0+164,k.v0+92,22);
   addVan(k.u0+150,k.v0+190,'DÉMINAGE');addParcel(k.u0+120,k.v0+196,true);addChar(k.u0+108,k.v0+200,as(DEMIN,{pose:'arms_up'}));setT('colis',8,k.u0+116,k.v0+196,26);}
  // (6,6) Square du Rail
  {const k=park(6,6,'Square du Rail');pathG([[k.u0+6,k.vc],[k.u1-6,k.vc]],14);
   addBoxItem(k.uc-30,k.v0+40,k.uc+30,k.v0+56,40,c=>{drawBox(c,k.uc-30,k.v0+40,0,60,16,4,'#d6d0c2');drawTrainCar(c,k.uc-26,k.v0+48,46,null,true);});
   addBike(k.u0+60,k.vc,1,SOURIS);setT('recette',5,k.u0+60,k.vc,24,4);
   addBench(k.u0+170,k.v0+150,false);addChar(k.u0+164,k.v0+150.3,as(EPINE,{pose:'sit'}));addChar(k.u0+176,k.v0+150.4,as(EPINETTE,{pose:'arms_up'}));addParcel(k.u0+170,k.v0+162,true);setT('colis',10,k.u0+170,k.v0+152,26);
   for(let n=0;n<10;n++){const u=R(k.u0+16,k.u1-16),v=R(k.v0+70,k.v1-16);if(Math.abs(v-k.vc)<16||!free(u,v,12))continue;addTree(u,v);}
   areas.push({u0:k.u0+12,v0:k.v0+70,u1:k.u1-12,v1:k.v1-12,n:16,dist:3});}
  cars([[1300,1432,'u'],[1600,1452,'u'],[1880,1432,'u'],[1300,1736,'u'],[1700,1716,'u'],[1432,1300,'v'],[1736,1880,'v'],[1300,2000,'u'],[1900,2020,'u']]);
}
