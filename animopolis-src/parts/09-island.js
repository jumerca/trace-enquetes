
/* =========================================================
   QUARTIER 6 : L'ÎLE AUX TORTUES
   ========================================================= */
DISTRICTS.push({id:'ile',name:"L'Île aux Tortues",de:"de l'Île",u0:2120,v0:0,u1:2900,v1:1180,need:1,sides:['v','u'],blocks:[],extra:[[2230,140,2790,1040]]});
DISTRICTS[1].sides=[];
INTROS[5]="Une navette quitte le Port : cap sur l'Île aux Tortues ! Plage, cocotiers, village de cases… et un volcan qui fume un peu trop.";
for(const s of['dog|check','duck|grey','fox|white','croc|stripes'])RESERVED.add(s);

const IU=2510,IV=590;
const inIle=(u,v,ru,rv)=>((u-IU)/ru)**2+((v-IV)/rv)**2<1;
const TITOU=SP('cat','shirt','dots','cap',null,null,false,{build:'small',scale:.85}),MAMIEC=SP('cat','dress','grey','straw',null,null,false,{build:'old'});
const GUIDE=SP('dog','shirt','check','cap',null,null,false,{build:'slim'}),PERLIER=SP('croc','shirt','white','straw',null,null,false,{build:'round'}),MARCH=SP('pig','dress','dots','flower',null,null,false,{build:'round'}),CHEFI=SP('elephant','coat','white','flower',null,null,false,{build:'old'});
const PLUME=SP('duck','coat','grey','glasses',null,null,false,{build:'tall'}),BARON=SP('fox','suit','white','top',null,null,false,{build:'tall',cape:true}),TIKI=SP('frog','shirt','white','flower',null,null,false,{build:'small'}),SBIRE=SP('croc','shirt','stripes','cap',null,null,false,{build:'round'});

CASES.push(
 {id:'bouteille',dist:5,title:'La bouteille à la mer',diff:1,card:[2330,800],
  intro:"Sur la plage de l'île, le petit Titou trouve une bouteille rejetée par les vagues. Dedans : un vieux message tout délavé, et un dessin de bateau…",
  cast:[{n:'Titou',r:'chaton à casquette',s:TITOU},{n:'Mamie Minette',r:'sa grand-mère',s:MAMIEC}],
  steps:[
   {w:0,q:"Titou trouve la bouteille. Où ?",ok:"Sur la plage, au bord de l'eau : une bouteille avec un papier roulé dedans !"},
   {w:1,q:"Il montre le message à quelqu'un qui sait lire les vieilles cartes.",ok:"Devant sa case, Mamie Minette reconnaît le dessin : c'est l'épave du sud de l'île."},
   {w:0,q:"Pour aller voir l'épave, il leur faut un bateau. Où en trouvent-ils un ?",ok:"Près de la jetée, au loueur de pirogues."},
   {w:0,q:"Trouve-les en route vers l'épave.",ok:"Ils pagaient tous les deux, en pleine mer."},
   {w:0,q:"Que trouvent-ils sur l'épave ?",ok:"Sur le pont du vieux bateau : un coffre plein de coquillages nacrés !"}],
  outro:"Titou a offert le plus beau coquillage à sa mamie. Le message, lui, est accroché au mur de la case. Enquête classée !"},
 {id:'volcan',dist:5,title:'Le volcan qui tousse',diff:2,card:[2440,520],
  intro:"Panique sur l'île : une énorme fumée noire sort du volcan ! Tout le monde court vers les bateaux. Tout le monde… sauf une personne.",
  cast:[{n:'Le chef du village',r:'vieil éléphant à fleur',s:CHEFI},{n:'Le guide',r:'chien, chemise à carreaux',s:GUIDE},{n:'Le pêcheur de perles',r:'crocodile au chapeau de paille',s:PERLIER},{n:'La marchande',r:'cochonne, robe à pois',s:MARCH}],
  steps:[
   {w:null,q:"La fumée noire affole le village. Trouve la panique.",ok:"Sur la place du village, tout le monde montre le volcan du doigt."},
   {w:0,q:"Qui donne l'alerte ?",ok:"Le chef du village frappe le grand gong devant sa case."},
   {w:null,q:"Les habitants s'enfuient. Par où ?",ok:"Ils s'entassent dans les pirogues, sur la plage près de la jetée."},
   {w:null,q:"Quelqu'un marche dans l'autre sens, avec un drôle de chargement.",ok:"Sur le sentier du volcan, une brouette pleine de feuilles mouillées…"},
   {w:null,q:"D'où vient vraiment la fumée ?",ok:"D'un énorme feu de feuilles mouillées, au pied du volcan. Le volcan n'y est pour rien !"},
   {w:null,q:"Pendant ce temps, un endroit du village a été vidé. Lequel ?",ok:"La Perlerie : les paniers de perles sont vides."},
   {w:null,q:"Le voleur a laissé une piste. Où mène-t-elle ?",ok:"Des feuilles mouillées tombées de la brouette, jusqu'à une crique."},
   {w:null,q:"Que cache la crique ?",ok:"Une pirogue chargée de paniers de perles, sous des feuilles de palmier… et quelqu'un accroupi à côté."},
   {w:null,q:"Qui a fait tousser le volcan ?",choice:[CH('Le chef du village',CHEFI),CH('Le guide',GUIDE),CH('Le pêcheur de perles',PERLIER),CH('La marchande',MARCH)],ans:1,ok:"Le guide ! Il voulait vider le village pour voler les perles tranquillement."}],
  outro:"Les perles ont retrouvé leurs paniers, et le guide ramasse désormais les feuilles mortes de toute l'île. Enquête classée !"},
 {id:'epave',dist:5,title:"Le trésor de l'épave",diff:3,card:[2600,980],
  intro:"La Professeure Plume, célèbre archéologue, débarque sur l'île pour fouiller la vieille épave. Mais le Baron Goupil, collectionneur sans scrupules, a jeté l'ancre tout près…",
  cast:[{n:'Professeure Plume',r:'cane archéologue à lunettes',s:PLUME},{n:'Baron Goupil',r:'renard en blanc, cape et haut-de-forme',s:BARON},{n:'Tiki',r:'petite grenouille guide',s:TIKI},{n:'Les sbires',r:'crocodiles en marinière',s:SBIRE},{n:'Inspectrice Léonie',r:'police',s:LEONIE}],
  steps:[
   {w:0,q:"Une archéologue arrive sur l'île. Trouve-la.",ok:"Sur la navette, au bout de la jetée, avec ses caisses de matériel."},
   {w:0,q:"Elle prépare son expédition. Où ?",ok:"À la terrasse du Café du Lagon, penchée sur une vieille carte."},
   {w:1,q:"Quelqu'un l'observe de très haut.",ok:"Le Baron Goupil, sur les pentes du volcan, longue-vue à la main."},
   {w:2,q:"La Professeure a besoin d'un guide. Qui engage-t-elle ?",ok:"Tiki, la petite grenouille, sur la place du village."},
   {w:2,q:"La fouille commence. Trouve-la.",ok:"Près de l'épave, Tiki tient la pirogue pendant que la Professeure plonge."},
   {w:0,q:"Ils remontent quelque chose de lourd. Où le déposent-ils ?",ok:"Sur la plage du sud : un coffre couvert d'algues."},
   {w:3,q:"La nuit, le coffre change de mains.",ok:"Deux crocodiles en marinière l'emportent à travers les cocotiers."},
   {w:3,q:"Où les sbires emmènent-ils le coffre ?",ok:"Sur la plage de l'est, ils le chargent dans un canot."},
   {w:0,q:"Au matin, la Professeure découvre le vol.",ok:"Devant sa tente, les bras au ciel."},
   {w:2,q:"Tiki a l'œil. Que trouve-t-elle ?",ok:"Des traces dans le sable : on a traîné quelque chose de lourd."},
   {w:1,q:"Le Baron ouvre enfin le coffre. Où ?",ok:"Sur le pont de son yacht. Il fait la grimace : de la vieille vaisselle !"},
   {w:0,q:"La Professeure passe à l'abordage.",ok:"En pirogue avec Tiki, elle fonce vers le yacht."},
   {w:4,q:"Les renforts arrivent.",ok:"La vedette de l'Inspectrice Léonie, au nord de l'île."},
   {w:1,q:"Où le Baron est-il arrêté ?",ok:"Sur la plage du nord, avec ses deux sbires."},
   {w:0,q:"Et le trésor, alors ?",ok:"Au village, la Professeure présente la « vieille vaisselle » : elle est en or massif !"}],
  outro:"Le trésor est exposé dans la plus grande case du village. Tiki est devenue l'assistante officielle de la Professeure. Enquête classée !"}
);

function addHut(u,v,w,sign,id){return makeBuilding({id,u0:u,v0:v,u1:u+w,v1:v+36,h:30,front:'v',roof:'gable',tone:'#e9dcc0',sign,signSize:6,chim:false});}
function addTurtle(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;for(const[dx,dy]of[[-7,0],[7,0],[-6,-5],[6,-5]])E(c,x+dx,y+dy,2.6,1.4,'#d4d6c0');C(c,x+9,y-4,2.6,'#d4d6c0');D(c,x+10,y-4.6,.5);c.beginPath();c.ellipse(x,y-3,8,5.4,0,PI,0);c.closePath();c.fillStyle='#c3c7ad';c.fill();c.stroke();c.lineWidth=.5;L(c,x-4,y-3,x-2,y-8);L(c,x+4,y-3,x+2,y-8);L(c,x-2,y-8,x+2,y-8);},{ht:14,hw:14});avoid(u,v,10);}
function addTotem(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;for(let k=0;k<3;k++){const yy=y-k*13;Rc(c,x-6,yy-13,12,13,k%2?'#d8c8a4':'#c9b58a');D(c,x-2.4,yy-9,1.1);D(c,x+2.4,yy-9,1.1);L(c,x-3,yy-4,x+3,yy-4);}P(c,[[x-10,y-39],[x+10,y-39],[x+6,y-44],[x-6,y-44]],RED);},{ht:48,hw:12});avoid(u,v,8);}
function drawChest(c,x,y,open,fill){c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-8,y-9,16,9,'#a8946a');if(open){P(c,[[x-8,y-9],[x+8,y-9],[x+10,y-17],[x-6,y-17]],'#8a7650');for(const dx of[-4,0,4])D(c,x+dx,y-10,1.6,fill||'#e6c14a');}else{c.beginPath();c.moveTo(x-8,y-9);c.quadraticCurveTo(x,y-15,x+8,y-9);c.fillStyle='#a8946a';c.fill();c.stroke();}D(c,x,y-5,1,'#e6c14a');}
function buildIle(){
  CURD=5;const D=DISTRICTS[5];
  districtGround(D,[],[],'#dce4e2');waterG(2120,0,2900,1180,71);
  const ell=(ru,rv)=>{const p=[];for(let a=0;a<TAU;a+=.1)p.push([IU+Math.cos(a)*ru*(1+.05*Math.sin(a*5)),IV+Math.sin(a)*rv*(1+.04*Math.cos(a*7)),0]);return p;};
  const sand=ell(300,470),grass=ell(215,375);const rr=mulberry32(8);const dots=[];for(let n=0;n<500;n++){const a=rr()*TAU,r=.74+rr()*.24;dots.push([IU+Math.cos(a)*300*r,IV+Math.sin(a)*470*r]);}
  G(2200,110,2820,1070,c=>{c.strokeStyle=INK;c.lineWidth=1.2;ip(c,sand,'#efe7cf');c.fillStyle='#b8ad8f';if(LOD>.6)for(const[u,v]of dots){const[x,y]=pr(u,v,0);c.fillRect(x,y,.8,.8);}c.lineWidth=1;ip(c,grass,'#e3e4cf');});
  pathG([[2250,600],[2400,600],[2470,480],[2440,400]],12);pathG([[2400,600],[2520,640],[2650,860]],10);
  G(2140,592,2250,608,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,2140,592,2250,608,'#e9dcc0');c.lineWidth=.4;for(let u=2146;u<2250;u+=6){const p=pr(u,592,0),q=pr(u,608,0);L(c,p[0],p[1],q[0],q[1]);}});
  labelG(2300,760,"Île aux Tortues",16);
  // volcan
  const VU=2400,VV=300;
  addSpr(VU,VV,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.3;c.beginPath();c.moveTo(x-120,y+10);c.quadraticCurveTo(x-60,y-40,x-26,y-140);c.lineTo(x-12,y-132);c.lineTo(x,y-142);c.lineTo(x+12,y-131);c.lineTo(x+26,y-140);c.quadraticCurveTo(x+60,y-40,x+120,y+10);c.quadraticCurveTo(x,y+34,x-120,y+10);c.closePath();c.fillStyle='#d9d3c5';c.fill();c.stroke();
    c.lineWidth=.6;for(const[dx,dy,l]of[[-50,-30,40],[-20,-70,36],[30,-50,44],[60,-10,30],[-70,0,24],[10,-100,26]]){c.beginPath();c.moveTo(x+dx,y+dy);c.quadraticCurveTo(x+dx+6,y+dy+l*.5,x+dx-4,y+dy+l);c.stroke();}
    P(c,[[x-12,y-132],[x,y-142],[x+12,y-131],[x+4,y-118],[x-6,y-120]],RED);},{ht:150,hw:124,lo:36});
  avoidRect(VU-90,VV-90,VU+70,VV+70);addSmoke(VU,VV,146,true);
  // village
  const hChef=addHut(2470,520,50,'Chef','hchef'),hPerl=addHut(2526,520,54,'Perlerie','hperl'),hCafe=addHut(2586,520,58,'Café du Lagon','hcafe'),hMam=addHut(2650,520,44,'','hmam');
  addTotem(2462,600);addTotem(2700,600);
  for(const[u,v]of[[2280,360],[2300,820],[2420,960],[2600,1010],[2740,760],[2760,420],[2620,200],[2470,170],[2340,520],[2560,800],[2690,300]])addPalm(u,v);
  for(const[u,v]of[[2290,700],[2700,960],[2560,180]])addTurtle(u,v);
  addBoat(2135,640,1,{len:30,col:WHITE});
  /* ---- La bouteille à la mer */
  addChar(2302,880,as(TITOU,{pose:'crouch'}));addSpr(2292,886,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;c.save();c.translate(x,y-3);c.rotate(-.5);Rc(c,-6,-2.6,10,5.2,'#cfe3dd');Rc(c,4,-1.4,4,2.8,'#cfe3dd');Rc(c,-3,-1.4,5,2.8,'#efe6c8');c.restore();},{ht:10});setT('bouteille',1,2298,882,22);
  {const p=fr(hMam,.5,14);addChar(p[0]-6,p[1],as(TITOU,{pose:'give',prop:'map'}));addChar(p[0]+8,p[1]+2,as(MAMIEC,{pose:'think',flip:true}));setT('bouteille',2,p[0]+1,p[1]+1,22);}
  addSpr(2262,636,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;L(c,x,y,x,y-30);c.lineWidth=1;Rc(c,x-14,y-40,28,10,WHITE);txt(c,'PIROGUES',x,y-35,5.4);drawBoat(c,x+22,y+6,1,{len:14});},{ht:44,hw:36});avoid(2262,636,14);
  addChar(2280,646,SP('dog','shirt','white','straw','give',null,true,{build:'round'}));addChar(2268,650,as(TITOU,{pose:'arms_up'}));addChar(2256,652,as(MAMIEC,{pose:'give',prop:'money'}));setT('bouteille',3,2268,648,26);
  addBoat(2440,1100,1,{len:18,who:as(MAMIEC,{}),oar:true});addSpr(2440,1100,(c,x,y)=>drawChar(c,x+9,y-3,as(TITOU,{pose:'row'})),{top:true,ht:30});setT('bouteille',4,2440,1100,24);
  addSpr(2590,1130,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;c.save();c.translate(x,y);c.rotate(-.16);P(c,[[-40,-16],[40,-16],[30,4],[-28,4]],'#a8946a');c.lineWidth=.5;for(let k=-36;k<36;k+=6)L(c,k,-16,k+2,3);E(c,-14,-6,4,3,'#2b2926');E(c,12,-4,3,2.4,'#2b2926');c.lineWidth=1.4;L(c,-6,-16,-2,-58);L(c,-12,-44,8,-48);c.lineWidth=1;P(c,[[-2,-56],[14,-50],[-1,-44]],'#d9d3c5');drawChest(c,18,-16,true,'#f3dbe0');drawChar(c,2,-16,as(TITOU,{pose:'arms_up'}));c.restore();
    c.lineWidth=.7;for(const k of[-30,0,30]){c.beginPath();c.moveTo(x+k-6,y+8);c.quadraticCurveTo(x+k,y+5,x+k+6,y+8);c.stroke();}},{ht:66,hw:46});setT('bouteille',5,2590,1124,28);
  /* ---- Le volcan qui tousse */
  for(const[du,dv,s]of[[0,0,SP('rabbit','dress','white','flower','point')],[14,6,SP('mouse','shirt','white','straw','arms_up')],[-12,10,SP('hedgehog','coat','white','none','point')],[26,-2,as(MARCH,{pose:'arms_up'})]])addChar(2540+du,600+dv,s);setT('volcan',1,2548,604,30);
  {const p=fr(hChef,.5,14);addSpr(p[0]+16,p[1],(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;L(c,x-9,y,x-9,y-28);L(c,x+9,y,x+9,y-28);L(c,x-11,y-28,x+11,y-28);c.lineWidth=1;L(c,x,y-28,x,y-22);C(c,x,y-14,8,'#e6c14a');C(c,x,y-14,3,null);},{ht:32,hw:12});addChar(p[0],p[1],as(CHEFI,{pose:'give',prop:'cane'}));setT('volcan',2,p[0]+8,p[1],24);}
  for(const[du,dv]of[[0,0],[20,10]]){addBoat(2200+du,500+dv,-1,{len:16,who:randomSpec(true)});addChar(2252+du,486+dv,as(randomSpec(),{pose:'run',flip:true}));}setT('volcan',3,2232,498,40);
  addChar(2452,470,as(GUIDE,{pose:'give'}));addSpr(2440,464,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-10,y-12],[x+8,y-12],[x+5,y-3],[x-7,y-3]],'#a8946a');C(c,x-8,y-2,2.6,WHITE);for(const[dx,dy]of[[-4,-15],[2,-16],[-1,-19]])E(c,x+dx,y+dy,4,2.2,'#7d8f6a');},{ht:24,hw:14});setT('volcan',4,2446,468,24);
  addSpr(2446,392,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;for(const[dx,dy]of[[-8,0],[0,-3],[8,0],[-4,-7],[4,-7]])E(c,x+dx,y+dy-3,6,3,'#7d8f6a');P(c,[[x-4,y-10],[x,y-20],[x+4,y-10]],'#e6c14a');P(c,[[x-2,y-10],[x,y-16],[x+2,y-10]],RED);},{ht:26,hw:16});avoid(2446,392,14);addSmoke(2446,392,22,true);setT('volcan',5,2446,390,24);
  {const p=fr(hPerl,.5,12);for(const dx of[-9,9])addSpr(p[0]+dx,p[1]+4,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-5,y-7],[x+5,y-7],[x+4,y],[x-4,y]],'#d8c8a4');E(c,x,y-7,5,1.8,'#3a3733');},{ht:10});setT('volcan',6,p[0],p[1]+2,22);}
  G(2560,700,2700,900,c=>{c.fillStyle='#7d8f6a';c.strokeStyle=INK;c.lineWidth=.4;for(let k=0;k<9;k++){const[x,y]=pr(2572+k*12,716+k*18,0);c.beginPath();c.ellipse(x,y,3,1.6,k,0,TAU);c.fill();c.stroke();}});setT('volcan',7,2620,790,26);
  addSpr(2716,930,(c,x,y)=>{drawBoat(c,x,y,1,{len:18});c.strokeStyle=INK;c.lineWidth=1;for(const dx of[-8,2])P(c,[[x+dx-4,y-16],[x+dx+4,y-16],[x+dx+3,y-10],[x+dx-3,y-10]],'#d8c8a4');for(const[dx,r]of[[-10,-.5],[2,.3],[10,-.2]]){c.save();c.translate(x+dx,y-17);c.rotate(r);E(c,0,0,9,2.6,'#7d8f6a');c.restore();}},{ht:26,hw:26});addChar(2700,922,as(GUIDE,{pose:'hide'}));avoid(2716,930,16);setT('volcan',8,2710,926,26);
  /* ---- Le trésor de l'épave */
  addSpr(2132,588,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;drawChar(c,x-2,y-10,as(PLUME,{pose:'wave'}));for(const dx of[10,18])Rc(c,x+dx,y-18,7,7,'#d8c8a4');P(c,[[x-30,y-10],[x+30,y-10],[x+24,y+3],[x-25,y+3]],WHITE);Rc(c,x-28,y-22,14,12,WHITE);txt(c,'NAVETTE',x+4,y-4,5);},{ht:50,hw:34});setT('epave',1,2132,582,26);
  {const p=fr(hCafe,.5,16);addTable(p[0]+10,p[1]);addParasol(p[0]+10,p[1]-4,true);addChar(p[0],p[1],as(PLUME,{pose:'sit',prop:'map'}));setT('epave',2,p[0]+4,p[1],22);}
  {const[x,y]=pr(VU,VV,0);addSpr(VU,VV+1,(c)=>{c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.ellipse(x+44,y-57,13,5,0,0,TAU);c.fillStyle='#c9c2b2';c.fill();c.stroke();c.beginPath();c.ellipse(x+40,y-60,6,3,0,PI,TAU);c.fillStyle='#bdb6a5';c.fill();c.stroke();drawChar(c,x+44,y-59,as(BARON,{pose:'point',prop:'telescope',noShadow:true}));},{top:true,ht:150,hw:120});setTxy('epave',3,x+44,y-76,24);}
  addChar(2606,676,as(PLUME,{pose:'give',prop:'money'}));addChar(2620,678,as(TIKI,{pose:'arms_up',flip:true}));setT('epave',4,2613,677,24);
  addBoat(2690,1110,-1,{len:16,who:as(TIKI,{})});addSwimmer(2668,1124,'duck');addSpr(2668,1124,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;L(c,x+5,y-6,x+7,y-14);for(const[dx,dy]of[[-8,-12],[-11,-18]])C(c,x+dx,y+dy,1.6,null);},{top:true,ht:22});setT('epave',5,2680,1114,28);
  addChar(2510,1010,as(PLUME,{pose:'give'}));addChar(2538,1012,as(TIKI,{pose:'give',flip:true}));addSpr(2524,1014,(c,x,y)=>{drawChest(c,x,y,false);c.strokeStyle='#7d8f6a';c.lineWidth=1.2;L(c,x-6,y-12,x-9,y-2);L(c,x+3,y-13,x+6,y-4);},{ht:18});setT('epave',6,2524,1010,26);
  addChar(2678,716,as(SBIRE,{pose:'walk'}));addChar(2702,720,as(SBIRE,{pose:'walk',hat:'beret'}));addSpr(2690,720,(c,x,y)=>drawChest(c,x,y-12,false),{top:true,ht:28});setT('epave',7,2690,716,26);
  addBoat(2818,650,1,{len:16});addChar(2776,640,as(SBIRE,{pose:'give'}));addChar(2784,654,as(SBIRE,{pose:'give',hat:'beret'}));addSpr(2818,650,(c,x,y)=>drawChest(c,x,y-9,false),{top:true,ht:22});setT('epave',8,2798,646,30);
  addSpr(2440,830,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;P(c,[[x-18,y],[x,y-26],[x+18,y]],'#d9d3c5');P(c,[[x-5,y],[x,y-14],[x+5,y]],'#3a3733');L(c,x,y-26,x,y-30);},{ht:34,hw:20});avoid(2440,830,14);addChar(2462,838,as(PLUME,{pose:'arms_up'}));setT('epave',9,2454,834,26);
  G(2530,892,2630,932,c=>{c.strokeStyle='#8f8a7c';c.lineWidth=1.4;for(const d of[-4,4]){const a=pr(2534,914+d,0),b=pr(2612,914+d,0);L(c,a[0],a[1],b[0],b[1]);}
    c.lineWidth=.6;for(let k=0;k<9;k++){const a=pr(2540+k*8.5,910,0),b=pr(2540+k*8.5,918,0);L(c,a[0],a[1],b[0],b[1]);}
    const[x,y]=pr(2620,914,0);c.beginPath();c.ellipse(x,y,12,5,0,0,TAU);c.fillStyle='rgba(140,128,100,.35)';c.fill();c.strokeStyle='#8f8a7c';c.stroke();});addChar(2552,926,as(TIKI,{pose:'crouch'}));setT('epave',10,2574,914,28);
  addSpr(2850,430,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;drawChar(c,x-6,y-12,as(BARON,{pose:'arms_up'}));drawChest(c,x+10,y-12,true,'#d6d1c5');P(c,[[x-46,y-12],[x+46,y-12],[x+34,y+4],[x-38,y+4]],WHITE);Rc(c,x-40,y-28,22,16,WHITE);for(const dx of[-36,-28])Rc(c,x+dx,y-24,5,5,'#eef1f0');L(c,x+30,y-12,x+30,y-50);P(c,[[x+30,y-50],[x+42,y-46],[x+30,y-42]],RED);c.fillStyle=INK;c.fillRect(x-44,y-8,86,1.6);c.lineWidth=.7;for(const k of[-30,0,30]){c.beginPath();c.moveTo(x+k-6,y+8);c.quadraticCurveTo(x+k,y+5,x+k+6,y+8);c.stroke();}},{ht:60,hw:50});setT('epave',11,2852,424,28);
  addBoat(2830,560,1,{len:18,who:as(PLUME,{}),oar:true});addSpr(2830,560,(c,x,y)=>drawChar(c,x-9,y-3,as(TIKI,{pose:'row'})),{top:true,ht:30});setT('epave',12,2830,560,24);
  addBoat(2800,190,-1,{len:30,col:WHITE,who:LEONIE});addSpr(2800,190,(c,x,y)=>txt(c,'POLICE',x,y-2,5),{top:true,ht:10});setT('epave',13,2800,190,28);
  addChar(2500,172,as(BARON,{pose:'arms_up'}));addChar(2514,176,as(SBIRE,{pose:'arms_up'}));addChar(2526,170,as(SBIRE,{pose:'arms_up',hat:'beret'}));addChar(2486,180,as(LEONIE,{pose:'point'}));setT('epave',14,2506,174,30);
  addSpr(2530,700,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-18,y-11,36,11,RED);for(const dx of[-10,0,10])E(c,x+dx,y-13,4,1.6,'#e6c14a');C(c,x,y-18,2.4,'#e6c14a');},{ht:24,hw:20});addChar(2504,700,as(PLUME,{pose:'point'}));for(const[du,dv]of[[-24,-14],[-8,-20],[12,-22],[30,-14]])addChar(2530+du,700+dv,as(randomSpec(),{pose:'arms_up'}));setT('epave',15,2524,700,32);for(let k=0;k<6;k++)avoid(2520+k*6,712+k*6,16);
  /* ---- habitants */
  areas.push({u0:2300,v0:230,u1:2720,v1:960,n:34,dist:5,ok:(u,v)=>inIle(u,v,205,360)});
  areas.push({u0:2215,v0:130,u1:2805,v1:1050,n:40,dist:5,beach:true,ok:(u,v)=>inIle(u,v,285,450)&&!inIle(u,v,225,385)});
  for(let n=0;n<14;n++){const u=R(2215,2805),v=R(130,1050);if(!inIle(u,v,280,445)||inIle(u,v,225,385)||!free(u,v,14))continue;addParasol(u,v,rnd()<.5);}
  for(let n=0;n<12;n++){const u=R(2130,2890),v=R(20,1160);if(inIle(u,v,330,500)||!free(u,v,30))continue;addSwimmer(u,v,pick(HEADS));}
}
