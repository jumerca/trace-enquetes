
/* =========================================================
   VARIÉTÉ : étapes « trouver plusieurs objets », « compter »,
   « trouver l'intrus », « déduire le coupable » + l'enquête
   « Le jeu de piste de Bobo » qui les réunit.
   ========================================================= */
const BOBO_CAT=SP('cat','coat','white','none',null,null,false,{build:'slim'}),BOBO_FOX=SP('fox','coat','white','cap',null,null,false,{build:'slim'}),BOBO_DUCK=SP('duck','coat','white','none',null,null,false,{build:'slim'}),BOBO_CROC=SP('croc','coat','white','cap',null,null,false,{build:'slim'});
CASES.push(
 {id:'bobo',dist:2,title:'Le jeu de piste de Bobo',diff:2,
  intro:"Bobo le clown prépare sa grande parade… mais sa trompette d'or a disparu ! Pour la retrouver, il a lancé un jeu de piste plein d'énigmes. Ouvre l'œil, compte, déduis !",
  cast:[{n:'Bobo',r:'clown farceur',s:CLOWN},{n:'Le voleur',r:'un chat, sans chapeau',s:BOBO_CAT}],
  steps:[
   {w:0,q:"Trouve Bobo, qui cherche partout sa trompette d'or.",ok:"Il fait les cent pas devant l'entrée : « Ma trompette ! Qui a vu ma trompette ? »"},
   {q:"Pour la parade, Bobo a gonflé tout un bouquet de ballons. Combien en compte-t-il ?",choice:[CH('4'),CH('5'),CH('6'),CH('7')],ans:2,ok:"Six ballons : le compte est bon. Mais la trompette, elle, manque toujours."},
   {q:"La trompette était ornée de trois étoiles dorées, tombées pendant la fuite du voleur. Retrouve les trois étoiles !",ok:"Trois étoiles, trois indices : le voleur est passé par ici."},
   {q:"Deux témoins se souviennent du voleur :<br>🍦 <i>Le glacier</i> : « Ce n'est ni un oiseau, ni un reptile. »<br>🍭 <i>La vendeuse de barbe à papa</i> : « Il ne portait pas de chapeau. »<br><b>Qui a volé la trompette ?</b>",choice:[CH('Le renard à casquette',BOBO_FOX),CH('Le chat sans chapeau',BOBO_CAT),CH('Le canard',BOBO_DUCK),CH('Le crocodile à casquette',BOBO_CROC)],ans:1,ok:"Ni oiseau ni reptile, et pas de chapeau : c'est le chat !"},
   {q:"Le chat s'est glissé dans la troupe des rayés pour passer inaperçu. Tous portent un maillot rayé… sauf lui. Trouve l'intrus !",ok:"Le voilà, en maillot à pois, qui serre quelque chose sous sa veste !"},
   {q:"Le chat avoue : « Elle est dans l'un de ces trois coffres. Pas dans le rouge. Et le coffre qui la cache est juste à côté du bleu. » Quel coffre ouvres-tu ?",ok:"Le coffre vert ! Les trois étoiles brillent sur la trompette d'or."},
   {w:0,q:"La parade peut commencer. Trouve Bobo, trompette en main.",ok:"Bobo souffle dans sa trompette d'or, sous le chapiteau : le meilleur concert de la fête !"}],
  outro:"Le chat voulait seulement jouer de la trompette. Bobo l'a engagé comme second trompettiste. Enquête classée !"}
);

/* ---------- outils ---------- */
const vr=mulberry32(90210);const vpick=a=>a[Math.floor(vr()*a.length)];
function stepAt(st,u,v,r,z){const[x,y]=pr(u,v,z||0);st.t={x,y:y-14,r:r||22,u,v};avoid(u,v,(r||22)*.8+8);return st;}
function stepMulti(st,pts,r){r=r||16;st.ts=pts.map(([u,v,z])=>{const[x,y]=pr(u,v,z||0);avoid(u,v,r+8);return{x,y:y-12,r};});
  const cx=st.ts.reduce((a,q)=>a+q.x,0)/st.ts.length,cy=st.ts.reduce((a,q)=>a+q.y,0)/st.ts.length;
  st.t={x:cx,y:cy,r:Math.max(...st.ts.map(q=>Math.hypot(q.x-cx,q.y-cy)+q.r))+12};return st;}
function insertAfter(cid,ref,st){const cs=CASES.find(c=>c.id===cid);cs.steps.splice(cs.steps.indexOf(ref)+1,0,st);return st;}
function findSpot(u,v,hw,hh){for(let k=0;k<90;k++){const a=k*2.4,d=k*3.2,uu=u+Math.cos(a)*d,vv=v+Math.sin(a)*d;let ok=true;
  for(let du=-hw;du<=hw&&ok;du+=8)for(let dv=-hh;dv<=hh;dv+=8)if(!free(uu+du,vv+dv,2)){ok=false;}
  if(ok){avoidRect(uu-hw-8,vv-hh-8,uu+hw+8,vv+hh+8);return[uu,vv];}}return[u,v];}
const HATHEADS=['cat','dog','pig','mouse','frog','duck','bear','fox','lion','croc','owl'];
/* petit groupe de personnages presque identiques dont un seul diffère */
function oddGroup(u,v,n,common,odd,exclude,sp){sp=sp||12;const heads=HATHEADS.filter(h=>!(exclude||[]).includes(h));const idx=1+Math.floor(vr()*(n-2));const pts=[];
  for(let i=0;i<n;i++){const row=i%2,col=Math.floor(i/2),c=col-(n/2-1)/2;pts.push([u+c*sp+row*(sp/2+18),v-c*sp-row*(sp/2)+row*18]);}
  pts.forEach(([pu,pv],i)=>{const base={head:vpick(heads),body:'shirt',fill:'white',hat:'none',prop:null,pose:'stand',flip:vr()<.5,build:vpick(['normal','normal','round','slim'])};
    addChar(pu,pv,Object.assign(base,i===idx?odd:common));});
  return pts[idx];}
function drawStar(c,x,y,r){c.strokeStyle=INK;c.lineWidth=1;c.beginPath();for(let i=0;i<10;i++){const a=-PI/2+i*PI/5,rr=i%2?r*.45:r;c[i?'lineTo':'moveTo'](x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fillStyle='#e6c14a';c.fill();c.stroke();}
function addStarSpr(u,v){addSpr(u,v,(c,x,y)=>drawStar(c,x,y-9,8),{ht:16,hw:10});}
function addBiscuit(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;C(c,x,y-4,4.6,'#e3cf9a');for(const[dx,dy]of[[-1.6,-5.4],[1.4,-3],[-.4,-2.4]])D(c,x+dx,y+dy,.6);c.fillStyle='#f3efe4';c.beginPath();c.arc(x+3.6,y-6.6,1.8,0,TAU);c.fill();},{ht:12,hw:8});}
function addTicketSpr(u,v){addSpr(u,v,(c,x,y)=>{c.save();c.translate(x,y-3);c.rotate(-.5);c.strokeStyle=INK;c.lineWidth=1;Rc(c,-6,-3.4,12,6.8,'#efe6c8');D(c,-6,0,1.2,'#e9e4d8');D(c,6,0,1.2,'#e9e4d8');c.lineWidth=.4;L(c,-3,-3.4,-3,3.4);c.restore();},{ht:12,hw:10});}
function addPaw(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y-2,4.6,2.8,WHITE);for(const dx of[-4.6,-1.6,1.6,4.6])E(c,x+dx*1.1,y-6.2-(Math.abs(dx)>3?-.6:0),1.5,1.2,WHITE);},{ht:12,hw:12});}
function chestSpr(c,x,y,lid){c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-9,y-10,18,10,'#a8946a');c.beginPath();c.moveTo(x-9,y-10);c.quadraticCurveTo(x,y-18,x+9,y-10);c.fillStyle=lid;c.fill();c.stroke();Rc(c,x-1.4,y-9,2.8,5,'#e6c14a');}
function bubble(c,x,y,t){c.fillStyle=INK;c.font='9px "Patrick Hand", cursive';c.textAlign='center';c.textBaseline='middle';c.fillText(t,x,y);}

function buildVariety(){
  const O={};['chaton','gateau','poisson','ballon','chiot','lettre','tresor','fantome','farine','tickets'].forEach(id=>{O[id]=CASES.find(c=>c.id===id).steps.slice();});
  const TXT=(arr)=>arr.map(n=>CH(String(n)));

  /* ---- Le chaton fugueur : 3 autres affiches à retrouver (plusieurs objets) */
  CURD=0;
  {const pts=[[396,196],[140,796],[430,798]].map(([u,v])=>{const p=placeNear(u,v,8);addLamp(p[0],p[1],true);return[p[0],p[1],10];});
   insertAfter('chaton',O.chaton[0],stepMulti({q:"Madame Piquante a collé trois autres affiches « PERDU » sur des lampadaires du quartier. Retrouve-les toutes !",ok:"Trois affiches de plus : tout le quartier cherche Pompon. Un marchand croit l'avoir vu du côté du marché…"},pts,15));}
  /* ---- Le gâteau envolé : compter les canards */
  {const st=O.gateau[3];delete st.w;st.q="Des canards se régalent des miettes de gâteau, au bord du lac. Combien sont-ils ?";st.choice=TXT([2,3,4,5]);st.ans=2;st.ok="Quatre canards bien rassasiés… et Lapinou file finir son gâteau ailleurs.";}
  /* ---- Les tickets envolés : une piste de 3 tickets */
  CURD=2;
  {const st=O.tickets[4];const pts=[[472,1352],[900,1236],[500,1690]].map(([u,v])=>{const p=placeNear(u,v,8);addTicketSpr(p[0],p[1]);return[p[0],p[1],0];});
   delete st.w;st.q="Filou sème des tickets en courant. Retrouve les trois tickets tombés sur son chemin !";st.ok="Une piste de tickets : du carrousel aux autos-tamponneuses, puis jusqu'aux stands de jeux. Le labyrinthe n'est plus très loin…";stepMulti(st,pts,16);delete st.t.u;}
  /* ---- Le fantôme de la fête : l'intrus qui n'a pas peur */
  {const k05=blk(0,5);const p=findSpot(k05.u0+150,k05.v0+130,52,40);const odd=oddGroup(p[0],p[1],8,{pose:'run',body:'shirt',fill:'white'},as(FORAIN,{pose:'stand',hat:'cap'}),['croc'],17);
   insertAfter('fantome',O.fantome[0],stepAt({q:"À la sortie du Train fantôme, tout le monde s'enfuit en courant… tous, sauf un spectateur bien calme. Trouve l'intrus !",ok:"Un crocodile à casquette, tout sourire, reste planté là : pas du tout effrayé… étrange pour quelqu'un qui vient de croiser un fantôme !"},odd[0],odd[1],17));}
  /* ---- La pêche… non : Le jeu de piste de Bobo */
  {const k4=blk(0,4),k5=blk(1,5),k6=blk(1,6),B=CASES.find(c=>c.id==='bobo').steps;
   // 1 · Bobo à l'entrée
   {const p=placeNear(k4.u0+120,k4.v0+190,8);addChar(p[0],p[1],as(CLOWN,{pose:'think'}));addSpr(p[0],p[1],(c,x,y)=>bubble(c,x+16,y-52,'MA TROMPETTE ?'),{top:true,ht:60});stepAt(B[0],p[0],p[1],24);}
   // 2 · le bouquet de ballons (6)
   {const p=placeNear(k5.u0+200,k5.v0+190,10);addChar(p[0],p[1],as(CLOWN,{pose:'carry'}));
    addSpr(p[0],p[1],(c,x,y)=>{const cols=[WHITE,'#e6c14a',RED,'#c9c2b2',WHITE,'#7fb0d6'];const pos=[[-14,-52],[-4,-60],[8,-56],[16,-48],[-9,-44],[3,-46]];c.strokeStyle=INK;c.lineWidth=.4;pos.forEach(([dx,dy])=>L(c,x+4,y-16,x+dx,y+dy+6));c.lineWidth=.9;pos.forEach(([dx,dy],i)=>E(c,x+dx,y+dy,4.6,5.6,cols[i]));},{top:true,ht:70,hw:26});stepAt(B[1],p[0],p[1],26);}
   // 3 · trois étoiles dorées
   {const spots=[[k5.u0+60,k5.v0+112],[blk(2,4).u0+200,blk(2,4).v0+170],[blk(3,5).u0+110,blk(3,5).v0+200]].map(([u,v])=>{const p=placeNear(u,v,8);addStarSpr(p[0],p[1]);return[p[0],p[1],8];});stepMulti(B[2],spots,15);}
   // 5 · l'intrus à pois parmi des rayés
   {const p=findSpot(k5.u0+120,k5.v0+150,46,36);const odd=oddGroup(p[0],p[1],8,{fill:'stripes',body:'shirt',hat:'none'},{head:'cat',fill:'dots',body:'shirt',hat:'none'},['cat'],14);stepAt(B[4],odd[0],odd[1],17);}
   // 6 · trois coffres (rouge, vert, bleu) — le bon : le vert
   {const p=findSpot(k6.u0+70,k6.v0+150,34,16);const lids=[RED,'#7d8f6a','#7fb0d6'];
    lids.forEach((lid,i)=>addSpr(p[0]+(i-1)*22,p[1]-(i-1)*22,(c,x,y)=>chestSpr(c,x,y,lid),{ht:20,hw:12}));
    stepAt(B[5],p[0],p[1],16);}
   // 7 · Bobo et sa trompette sous le chapiteau
   {const p=placeNear(k6.uc+60,k6.v0+120,10);addChar(p[0],p[1],as(CLOWN,{pose:'point',prop:'trumpet'}));addSpr(p[0],p[1],(c,x,y)=>{c.fillStyle=INK;c.font='11px "Patrick Hand", cursive';c.textAlign='center';c.fillText('♪ ♫',x+22,y-40);},{top:true,ht:50});stepAt(B[6],p[0],p[1],24);}
  }
  /* ---- Le ballon rouge : compter les ballons du vendeur */
  {const st=insertAfter('ballon',O.ballon[0],{q:"Chez le vendeur, un gros bouquet de ballons attend les enfants. Combien de ballons tient-il, sans compter le ballon rouge de Noisette ?",choice:TXT([3,4,5,6]),ans:2,ok:"Cinq ballons : assez pour tous les enfants de la fête."});st.t=Object.assign({},O.ballon[0].t);avoid(214,1290,70);}
  /* ---- Le chiot du train : trois biscuits tombés */
  CURD=3;
  {const k=blk(4,4);const pts=[[k.u0+150,k.v0+120],[k.u0+205,k.v0+185],[k.u0+105,k.v0+222]].map(([u,v])=>{const p=placeNear(u,v,8);addBiscuit(p[0],p[1]);return[p[0],p[1],0];});
   insertAfter('chiot',O.chiot[1],stepMulti({q:"Biscuit dévale le parvis en laissant tomber des biscuits. Retrouve les trois biscuits tombés !",ok:"Une petite piste de miettes… qui file droit vers les entrepôts."},pts,15));}
  /* ---- La lettre d'amour : compter les cœurs */
  CURD=0;
  {const st=insertAfter('lettre',O.lettre[6],{q:"Mademoiselle Truffe rougit en lisant la lettre. Combien de petits cœurs flottent autour d'elle ?",choice:TXT([2,3,4,5]),ans:1,ok:"Trois cœurs : elle a tout compris, et la réponse sera « oui » !"});st.t=Object.assign({},O.lettre[6].t);}
  /* ---- Le poisson d'or : un curieux sans casquette parmi les marins */
  CURD=1;
  {const k=blk(5,2);const sp=findSpot(k.u0+110,k.v0+170,40,36);addStall(sp[0],sp[1]-26,"Poisson d'or",'fish');
   const odd=oddGroup(sp[0],sp[1]+16,7,{hat:'cap',body:'coat',fill:'white'},as(MATOU,{hat:'none'}),['cat','fox','owl','rabbit'],13);
   insertAfter('poisson',O.poisson[0],stepAt({q:"Tous les curieux admirent le poisson d'or sur son étal, avec la même casquette de marin… tous sauf un seul. Trouve l'intrus !",ok:"Matou, le chat de gouttière, n'a pas de casquette : il ne regarde pas le poisson, mais la sortie du marché…"},odd[0],odd[1],17));}
  /* ---- La carte au trésor : qui écoute ? (déduction) */
  {const M=(h,hat)=>SP(h,'shirt','white',hat,null,null,false,{build:'small'});
   insertAfter('tresor',O.tresor[0],{q:"Quelqu'un a écouté le capitaine en cachette. Voici ce que disent deux témoins :<br>🍽️ <i>Le serveur</i> : « Je n'ai pas vu son visage, mais elle avait de petites oreilles rondes. »<br>⚓ <i>Le capitaine</i> : « Elle portait un bandana sur la tête. »<br><b>Qui est l'espionne ?</b>",
     choice:[CH('Souris à bandana',M('mouse','bandana')),CH('Souris à casquette',M('mouse','cap')),CH('Chat à bandana',M('cat','bandana')),CH('Cane à bandana',M('duck','bandana'))],ans:0,ok:"Oreilles rondes et bandana : c'est Mousse Bandana, la petite souris pirate !"});}
  /* ---- La farine envolée : trois grosses empreintes */
  CURD=4;
  {const st=O.farine[7];const pts=[[621,2152],[655,2157.5],[689,2163]].map(([u,v])=>{addPaw(u,v);return[u,v,0];});
   st.q="Bastien a repéré des traces blanches de farine sur le sentier. Retrouve les trois grosses empreintes !";st.ok="Trois empreintes toutes blanches : elles filent tout droit vers les vignes…";stepMulti(st,pts,15);delete st.t.u;}
}
