
/* =========================================================
   QUARTIER 5 : LA COLLINE (forêt, village, château)
   ========================================================= */
DISTRICTS.push({id:'colline',name:'La Colline',de:'de la Colline',u0:0,v0:2032,u1:2120,v1:2600,need:2,sides:['v','u'],blocks:[[3,7],[4,7],[3,8],[4,8]],extra:[[0,2032,880,2600],[1450,2032,2010,2580],[2032,2032,2120,2600]]});
DISTRICTS[2].sides=[];DISTRICTS[3].sides=['u'];
for(const s of['pig|check','mouse|stripes','bear|check','frog|grey'])RESERVED.add(s);

const ZU=32,ZL=14; // hauteurs du plateau du château
/* ---------- décors ---------- */
function addPine(u,v,k){k=k||R(.85,1.25);addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;E(c,x,y,6*k,3*k,'#d4d6c0');c.lineWidth=1.1;Rc(c,x-1.6*k,y-8*k,3.2*k,8*k,WHITE);
  for(let t=0;t<3;t++){const yb=y-8*k-t*9*k,w=(13-t*3)*k;P(c,[[x-w,yb],[x+w,yb],[x,yb-16*k]],t%2?WHITE:'#eceee2');}},{hw:16*k,ht:48*k});avoid(u,v,8);}
function addMushrooms(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;for(const[dx,dy,s]of[[-5,0,1],[3,2,.8],[8,-1,1.1]]){Rc(c,x+dx-1,y+dy-4*s,2,4*s,WHITE);c.beginPath();c.arc(x+dx,y+dy-4*s,3.4*s,PI,0);c.closePath();c.fillStyle=RED;c.fill();c.stroke();D(c,x+dx-1,y+dy-5.6*s,.5,WHITE);D(c,x+dx+1.2,y+dy-6*s,.5,WHITE);}},{ht:12,hw:14});}
function addOak(u,v,hole,extra){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;E(c,x,y,13,6.5,'#d4d6c0');
  P(c,[[x-9,y],[x-5.4,y-28],[x+5.4,y-28],[x+9,y]],'#efe8d6');c.lineWidth=.5;for(const k of[-5,-1.5,2,5.5])L(c,x+k,y-2,x+k*.6,y-24);c.lineWidth=1.1;
  if(hole){c.beginPath();c.ellipse(x,y-11,5.6,8.6,0,0,TAU);c.fillStyle='#2b2926';c.fill();c.lineWidth=1.4;c.stroke();     // le creux
    c.save();c.beginPath();c.ellipse(x,y-11,5.2,8.2,0,0,TAU);c.clip();if(extra)extra(c,x,y-7);c.restore();
    c.lineWidth=1.1;c.beginPath();c.ellipse(x,y-11,5.6,8.6,0,PI*1.05,PI*1.95);c.stroke();}
  const bl=[[-14,-38,12],[12,-38,12],[0,-50,13],[-20,-28,9],[20,-28,9],[0,-34,11]];c.lineWidth=2.4;for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}c.fillStyle='#f4f5ec';for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}
  c.lineWidth=.6;for(const[dx,dy]of[[-10,-42],[8,-46],[0,-32],[14,-32]]){c.beginPath();c.arc(x+dx,y+dy,2.4,PI*.2,PI*.9);c.stroke();}},{hw:34,ht:68});avoid(u,v,14);}
function addTreeSwing(u,v,who){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;E(c,x-12,y,11,5.5,'#d4d6c0');P(c,[[x-18,y],[x-15,y-34],[x-9,y-34],[x-7,y]],'#efe8d6');
  const bl=[[-22,-46,11],[-4,-54,12],[14,-50,10],[-10,-42,9],[34,-48,9]];c.lineWidth=2.4;for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}c.fillStyle='#f4f5ec';for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}
  c.lineWidth=3;c.strokeStyle=INK;L(c,x-10,y-33,x+32,y-40);c.lineWidth=1.6;c.strokeStyle='#efe8d6';L(c,x-10,y-33,x+32,y-40);c.strokeStyle=INK;   // branche, devant le feuillage
  const sx=x+20,sy=y-14;c.lineWidth=1.3;L(c,sx-7,y-38,sx-7,sy);L(c,sx+7,y-39,sx+7,sy);                                                              // les deux cordes
  if(who)drawChar(c,sx,sy+8,Object.assign({},who,{scale:1.05,noShadow:true,pose:'sit'}));
  c.lineWidth=1.1;Rc(c,sx-9,sy,18,2.8,'#d8c8a4');},{hw:40,ht:72});avoid(u,v,18);}
function addCampfire(u,v,pot){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;for(const a of[-.5,.5]){c.save();c.translate(x,y);c.rotate(a);Rc(c,-8,-1.5,16,3,'#a8946a');c.restore();}
  P(c,[[x-5,y-2],[x,y-12],[x+5,y-2]],'#e6c14a');P(c,[[x-2.6,y-2],[x,y-8],[x+2.6,y-2]],RED);
  if(pot){c.lineWidth=1.1;L(c,x-10,y,x-8,y-22);L(c,x+10,y,x+8,y-22);L(c,x-9,y-22,x+9,y-22);c.beginPath();c.moveTo(x-7,y-16);c.quadraticCurveTo(x,y-4,x+7,y-16);c.closePath();c.fillStyle='#3a3733';c.fill();c.stroke();c.lineWidth=.6;L(c,x,y-22,x,y-16);c.strokeStyle='#8f8a7c';for(const dx of[-3,2]){c.beginPath();c.moveTo(x+dx,y-18);c.quadraticCurveTo(x+dx+3,y-24,x+dx,y-30);c.stroke();}}},{ht:34,hw:14});avoid(u,v,12);}
function addCauldron(u,v,z){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-5,y],[x,y-6],[x+5,y]],'#e6c14a');c.beginPath();c.moveTo(x-10,y-14);c.quadraticCurveTo(x-12,y,x,y-2);c.quadraticCurveTo(x+12,y,x+10,y-14);c.closePath();c.fillStyle='#3a3733';c.fill();c.stroke();E(c,x,y-14,10,3,'#b9e0a8');c.strokeStyle='#8f8a7c';c.lineWidth=.6;for(const dx of[-4,3]){c.beginPath();c.moveTo(x+dx,y-17);c.quadraticCurveTo(x+dx+3,y-24,x+dx,y-30);c.stroke();}},{ht:34,hw:14,z});avoid(u,v,12);}
function addHay(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;c.beginPath();c.moveTo(x-16,y);c.quadraticCurveTo(x-18,y-26,x,y-30);c.quadraticCurveTo(x+18,y-26,x+16,y);c.quadraticCurveTo(x,y+5,x-16,y);c.closePath();c.fillStyle='#efe3b0';c.fill();c.stroke();c.lineWidth=.5;for(let k=0;k<9;k++){const a=-1.1+k*.28;c.beginPath();c.moveTo(x+Math.sin(a)*14,y-2);c.lineTo(x+Math.sin(a)*10,y-22);c.stroke();}},{ht:34,hw:20});avoid(u,v,16);}
function addCart(u,v,sacks,who){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;Rc(c,x-16,y-16,32,9,'#d8c8a4');c.lineWidth=.5;for(let k=-12;k<16;k+=6)L(c,x+k,y-16,x+k,y-7);c.lineWidth=1.1;for(const dx of[-10,10]){C(c,x+dx,y-5,5,WHITE);for(let a=0;a<4;a++)L(c,x+dx,y-5,x+dx+Math.cos(a*.8)*5,y-5+Math.sin(a*.8)*5);}L(c,x+16,y-12,x+30,y-8);L(c,x+16,y-9,x+30,y-5);
  for(let k=0;k<sacks;k++){const sx=x-10+k*7,sy=y-20-(k%2)*3;c.beginPath();c.moveTo(sx-3,sy+4);c.quadraticCurveTo(sx-4,sy-3,sx,sy-4);c.quadraticCurveTo(sx+4,sy-3,sx+3,sy+4);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();}
  if(who)drawChar(c,x+30,y,who);},{ht:44,hw:34});avoid(u,v,18);}
function addMill(u,v){{const[X,Y]=pr(u,v,0),hy=Y-62;addMover([X-50,hy-50,X+50,hy+50],(c,t)=>{c.strokeStyle=INK;for(let k=0;k<4;k++){const a=k*PI/2+.5+t*.5,ex=X+Math.cos(a)*44,ey=hy+Math.sin(a)*44;c.lineWidth=1.2;L(c,X,hy,ex,ey);c.lineWidth=.8;const px=-Math.sin(a)*7,py=Math.cos(a)*7;P(c,[[X+Math.cos(a)*12,hy+Math.sin(a)*12],[ex,ey],[ex+px,ey+py],[X+Math.cos(a)*12+px,hy+Math.sin(a)*12+py]],'#f3eee2');}C(c,X,hy,3,WHITE);});}addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;P(c,[[x-16,y],[x+16,y],[x+11,y-60],[x-11,y-60]],WHITE);P(c,[[x-13,y-60],[x+13,y-60],[x,y-78]],'#a8946a');Rc(c,x-5,y-18,10,18,'#cfc9bc');Rc(c,x-3,y-42,6,8,'#fdfcf8');
  txt(c,'MOULIN',x,y-28,5.6);},{ht:112,hw:52});avoidRect(u-20,v-20,u+20,v+20);}
function addPillory(u,v,who1,who2){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;Rc(c,x-22,y-3,44,3,'#a8946a');L(c,x-18,y,x-18,y-24);L(c,x+18,y,x+18,y-24);if(who1)drawChar(c,x-9,y,who1);if(who2)drawChar(c,x+9,y,who2);Rc(c,x-22,y-26,44,6,'#d8c8a4');},{ht:44,hw:26});avoid(u,v,16);}
function addVines(u0,v0,u1,v1){for(let v=v0;v<=v1;v+=18){G(u0,v-4,u1,v+4,c=>{c.strokeStyle=INK;c.lineWidth=.6;const a=pr(u0,v,0),b=pr(u1,v,0);L(c,a[0],a[1],b[0],b[1]);});for(let u=u0+6;u<u1;u+=12)addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;L(c,x,y,x,y-8);c.lineWidth=1.4;for(const[dx,dy]of[[-3,-9],[3,-10],[0,-13]]){c.beginPath();c.arc(x+dx,y+dy,3,0,TAU);c.stroke();}c.fillStyle='#e4e8d4';for(const[dx,dy]of[[-3,-9],[3,-10],[0,-13]]){c.beginPath();c.arc(x+dx,y+dy,3,0,TAU);c.fill();}D(c,x+1,y-8,1,'#7a5a8a');},{ht:18,hw:8});}
  avoidRect(u0-4,v0-6,u1+4,v1+6);}
function addTower(u,v,s,h,z){addBoxItem(u-s/2,v-s/2,u+s/2,v+s/2,h+z+40,c=>{drawBox(c,u-s/2,v-s/2,z,s,s,h,WHITE,'#f3eee2','#e2ddd0');c.save();faceV(c,u-s/2,v+s/2,z+h);Rc(c,s/2-2,h*.3,4,8,'#3a3733');Rc(c,s/2-2,h*.65,4,8,'#3a3733');c.restore();
  const tp=[pr(u-s/2,v+s/2,z+h),pr(u+s/2,v+s/2,z+h),pr(u+s/2,v-s/2,z+h)],ap=pr(u,v,z+h+s*1.3);c.lineWidth=1.1;P(c,[tp[0],tp[1],ap],'#9d978b');P(c,[tp[1],tp[2],ap],'#7f796d');c.lineWidth=1;L(c,ap[0],ap[1],ap[0],ap[1]-10);P(c,[[ap[0],ap[1]-10],[ap[0]+8,ap[1]-8],[ap[0],ap[1]-6]],RED);});}
function addWall(u0,v0,u1,v1,h,z){addBoxItem(u0,v0,u1,v1,h+z+8,c=>{drawBox(c,u0,v0,z,u1-u0,v1-v0,h,'#f3eee2','#ece7dc','#e2ddd0');
  const alongU=(u1-u0)>(v1-v0);if(alongU){for(let u=u0;u<u1-4;u+=10)drawBox(c,u,v0,z+h,5,v1-v0,4,'#f3eee2','#ece7dc','#e2ddd0');}else{for(let v=v0;v<v1-4;v+=10)drawBox(c,u0,v,z+h,u1-u0,5,4,'#f3eee2','#ece7dc','#e2ddd0');}
  c.save();if(alongU){faceV(c,u0,v1,z+h);c.lineWidth=.35;for(let y=6;y<h;y+=6)L(c,0,y,u1-u0,y);}else{faceU(c,u1,v1,z+h);c.lineWidth=.35;for(let y=6;y<h;y+=6)L(c,0,y,v1-v0,y);}c.restore();});}
function addBanner(u,v,z){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;L(c,x,y,x,y-30);P(c,[[x,y-30],[x+9,y-30],[x+9,y-16],[x+4.5,y-19],[x,y-16]],RED);D(c,x+4.5,y-25,1.4,'#e6c14a');},{ht:34,hw:12,z});}
function addFootprints(u0,v0,u1,v1,n){G(Math.min(u0,u1)-6,Math.min(v0,v1)-6,Math.max(u0,u1)+6,Math.max(v0,v1)+6,c=>{for(let k=0;k<n;k++){const t=k/(n-1),u=u0+(u1-u0)*t,v=v0+(v1-v0)*t;const[x,y]=pr(u+(k%2?2:-2),v,0);c.fillStyle='#fdfcf8';c.strokeStyle='#8f8a7c';c.lineWidth=.5;c.beginPath();c.ellipse(x,y,2.4,1.2,0,0,TAU);c.fill();c.stroke();}});}

/* ---------- personnages ---------- */
const LILI=SP('rabbit','dress','dots','bow','stand','basket',false,{scale:.82,build:'small'}),GROGNON=SP('pig','coat','check','straw',null,null,false,{build:'round'});
const COCOTTE=SP('duck','dress','white','flower',null,null,false,{build:'round'}),RAPE1=SP('mouse','shirt','stripes','cap',null,null,false,{build:'slim'}),RAPE2=SP('mouse','shirt','stripes','beret',null,null,false,{build:'small'}),BASTIEN=SP('bear','coat','check','cap',null,null,false,{build:'round'}),FERMIER=SP('pig','shirt','white','straw',null,null,false,{build:'old'});
const HERMINE=SP('rabbit','dress','white','crown',null,null,false,{build:'tall'}),GIGOT=SP('frog','suit','stripes','jester',null,null,false,{build:'small'}),GIGOT2=SP('frog','coat','grey','cap',null,null,false,{build:'small'}),LARDON=SP('croc','chef','white','chef',null,null,false,{build:'round'}),BOUBOULE=SP('bear','suit','grey','knight',null,null,false,{build:'round'});

CASES.push(
 {id:'lili',dist:4,title:'Le panier de Lili',diff:1,card:[230,2110],
  intro:"Ce matin, la petite Lili part cueillir des champignons dans la grande forêt de la Colline. Son panier est tout neuf… et il sent très bon.",
  cast:[{n:'Lili',r:'petite lapine, robe à pois',s:LILI},{n:'Grognon',r:'sanglier… enfin, cochon des bois',s:GROGNON}],
  steps:[
   {w:0,q:"Lili cueille des champignons. Trouve-la.",ok:"Dans une clairière, elle remplit son panier de champignons rouges."},
   {w:0,q:"Elle fait une pause pour jouer. Où ?",ok:"Sur la balançoire accrochée à un grand arbre, son panier posé dans l'herbe."},
   {w:1,q:"Quelqu'un emporte le panier ! Trouve-le.",ok:"Grognon file à travers bois, le panier sous le bras."},
   {w:1,q:"Que fait Grognon avec les champignons ?",ok:"Devant sa cabane, il les fait mijoter sur un feu de camp."},
   {w:0,q:"Comment l'histoire se termine-t-elle ?",ok:"Au bord de l'étang, Lili et Grognon partagent une grande omelette aux champignons."}],
  outro:"Grognon a promis de demander la prochaine fois. Lili, elle, a trouvé un ami. Enquête classée !"},
 {id:'farine',dist:4,title:'La farine envolée',diff:2,card:[1240,2120],
  intro:"Cocotte, la meunière, livre chaque matin sa farine au village. Mais depuis quelque temps, il manque toujours un sac… Les frères Rapetout, deux souris en marinière, ne sont jamais loin.",
  cast:[{n:'Cocotte',r:'cane meunière, fleur sur la tête',s:COCOTTE},{n:'Rapetout aîné',r:'souris, marinière et casquette',s:RAPE1},{n:'Rapetout cadet',r:'souris, marinière et béret',s:RAPE2},{n:'Bastien',r:'garde champêtre',s:BASTIEN}],
  steps:[
   {w:0,q:"Cocotte remplit ses sacs de farine. Où ?",ok:"Au pied du moulin, au milieu des champs."},
   {w:null,q:"Les sacs partent au village. Trouve la charrette.",ok:"Le fermier pousse la charrette chargée de sacs sur le chemin."},
   {w:1,q:"Les frères Rapetout guettent. Où se cachent-ils ?",ok:"Derrière une meule de foin, dans les vignes."},
   {w:1,q:"Le vol ! Trouve les frères en pleine action.",ok:"Sur la place du village, ils chipent un sac sur la charrette garée."},
   {w:2,q:"Ils s'enfuient avec le sac. Par où ?",ok:"À travers la forêt, en courant à toutes pattes."},
   {w:2,q:"Où cachent-ils le sac ?",ok:"Dans le creux d'un vieux chêne."},
   {w:0,q:"Cocotte s'aperçoit qu'il manque un sac. Où ?",ok:"Devant l'Auberge du Sanglier, elle recompte ses sacs."},
   {w:3,q:"Bastien a trouvé une piste. Laquelle ?",ok:"Des traces de pattes toutes blanches de farine, sur un sentier de la forêt."},
   {w:1,q:"Les frères vendent la farine volée. Où ?",ok:"Au petit stand « Farine pas chère » du village."},
   {w:3,q:"Où les frères sont-ils pris la main dans le sac ?",ok:"Près des vignes, en train de faire des crêpes. Bastien les attendait !"}],
  outro:"Les frères Rapetout aideront Cocotte au moulin pendant un mois. Les crêpes étaient délicieuses. Enquête classée !"},
 {id:'couronne',dist:4,title:'La couronne de la Duchesse',diff:3,card:[1720,2240],
  intro:"Au château de la Colline, la Duchesse Hermine donne un grand banquet pour montrer sa couronne en or. Gigot, le bouffon, rit un peu trop fort…",
  cast:[{n:'Duchesse Hermine',r:'lapine à couronne',s:HERMINE},{n:'Gigot le bouffon',r:'grenouille à grelots',s:GIGOT},{n:'Gigot déguisé',r:'manteau gris, casquette',s:GIGOT2},{n:'Lardon',r:'cuisinier crocodile',s:LARDON},{n:'Sire Bouboule',r:'chevalier ours',s:BOUBOULE},{n:'Bastien',r:'garde champêtre',s:BASTIEN}],
  steps:[
   {w:0,q:"La Duchesse présente sa couronne. Trouve-la.",ok:"Dans la cour du château, elle tient la couronne sur un coussin rouge."},
   {w:1,q:"Gigot amuse les invités. Où ?",ok:"Au pied du château, il jongle devant les visiteurs."},
   {w:3,q:"Le cuisinier prépare le banquet. Trouve-le.",ok:"Lardon sort des cuisines avec une grande tarte."},
   {w:1,q:"Gigot fait quelque chose de louche. Quoi ?",ok:"Il verse une fiole verte dans le chaudron de soupe !"},
   {w:4,q:"Le garde a mangé la soupe. Trouve-le.",ok:"Sire Bouboule ronfle au pied d'une tour."},
   {w:1,q:"Gigot passe à l'action. Trouve-le.",ok:"Il escalade le donjon avec une corde !"},
   {w:0,q:"La Duchesse découvre le vol. Trouve-la.",ok:"Dans la cour, elle montre le coussin vide en hurlant."},
   {w:1,q:"Gigot s'enfuit avec la couronne. Par où ?",ok:"Il dévale l'escalier du château, la couronne à la main."},
   {w:1,q:"Où cache-t-il la couronne ?",ok:"Dans le creux d'un chêne, au fond de la forêt."},
   {w:4,q:"Sire Bouboule se réveille et donne l'alerte. Trouve-le.",ok:"Sur la terrasse du château, il souffle dans sa trompette."},
   {w:5,q:"Bastien suit une piste. Laquelle ?",ok:"Des empreintes de grenouille dans la forêt. Il les examine à la loupe."},
   {w:2,q:"Gigot change de tenue. Trouve-le.",ok:"Devant la cabane du bûcheron, en manteau gris et casquette, une hache à la main."},
   {w:3,q:"Gigot n'agissait pas seul. Trouve son complice.",ok:"Sur la place du village, Lardon lui donne une bourse d'or."},
   {w:4,q:"Le chevalier poursuit le voleur déguisé. Où ?",ok:"Dans les champs près du moulin, épée au clair, derrière Gigot déguisé."},
   {w:0,q:"Comment l'histoire se termine-t-elle ?",ok:"Sur la place du village : Gigot et Lardon au pilori, et la Duchesse a retrouvé sa couronne."}],
  outro:"La Duchesse a pardonné à Gigot à condition qu'il fasse rire le château tous les soirs. Lardon fera la vaisselle jusqu'à Noël. Enquête classée !"}
);

/* ---------- construction ---------- */
function buildColline(){
  CURD=4;const D=DISTRICTS[4];
  districtGround(D,[[2294,880,1450],[2578,880,1450]],[[1158,2032,2600],[1442,2032,2600]]);
  // forêt
  G(0,2032,880,2600,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,0,2032,880,2600,'#e3e4cf');});
  const fl=mulberry32(41);const tufts=[];for(let n=0;n<700;n++)tufts.push([fl()*880,2032+fl()*568]);
  G(0,2032,880,2600,c=>{if(LOD<.6)return;c.strokeStyle='#8f8a7c';c.lineWidth=.6;c.beginPath();for(const[u,v]of tufts){const[x,y]=pr(u,v,0);c.moveTo(x-2,y-3);c.lineTo(x,y);c.lineTo(x+2,y-3.5);}c.stroke();});
  pathG([[880,2150],[640,2160],[520,2260],[300,2300],[120,2420],[20,2560]],14);pathG([[520,2260],[600,2420],[700,2560]],12);
  labelG(20,2050,'Forêt de la Colline');
  const pu=600,pv=2470,pru=70,prv=44;G(pu-pru,pv-prv,pu+pru,pv+prv,c=>{c.strokeStyle=INK;c.lineWidth=1.2;const pts=[];for(let a=0;a<TAU;a+=.15)pts.push([pu+Math.cos(a)*pru,pv+Math.sin(a)*prv,0]);ip(c,pts,'#dce4e2');});
  const inPond=(u,v,m)=>((u-pu)/(pru+m))**2+((v-pv)/(prv+m))**2<1;
  // cabanes
  const cab1=makeBuilding({u0:90,v0:2360,u1:160,v1:2400,h:40,front:'v',roof:'gable',tone:'#e9dcc0',sign:'Grognon',chim:true});
  const cab2=makeBuilding({u0:40,v0:2080,u1:100,v1:2116,h:38,front:'v',roof:'gable',tone:'#e9dcc0',sign:'Bûcheron'});
  // Lili 1 : la clairière
  for(const[du,dv]of[[-14,8],[16,6],[8,20]])addMushrooms(300+du,2130+dv);addChar(300,2134,as(LILI,{pose:'crouch'}));setT('lili',1,300,2134,24);
  // Lili 2 : la balançoire
  addTreeSwing(420,2060,as(LILI,{pose:'sit',prop:null}));avoid(420,2060,40);addSpr(412,2078,(c,x,y)=>drawProp(c,'basket',x,y-6,1),{ht:12});{const[x,y]=pr(420,2060,0);setTxy('lili',2,x+20,y-38,26);}
  // Lili 3
  addChar(560,2300,as(GROGNON,{pose:'run',prop:'basket'}));setT('lili',3,560,2300,22);
  // Lili 4
  addCampfire(cab1.cx+10,cab1.v1+20,true);addChar(cab1.cx-8,cab1.v1+18,as(GROGNON,{pose:'give'}));setT('lili',4,cab1.cx,cab1.v1+18,26);
  // Lili 5 : pique-nique
  addSpr(500,2490,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-16,y-10,32,4,'#d8c8a4');L(c,x-12,y-6,x-12,y);L(c,x+12,y-6,x+12,y);E(c,x,y-11,7,2,WHITE);E(c,x,y-12,5,1.4,'#efe3b0');},{ht:16,hw:20});
  addChar(488,2486,as(LILI,{pose:'sit',prop:null}));addChar(512,2488,as(GROGNON,{pose:'sit',flip:true}));setT('lili',5,500,2488,24);
  // farine 5, 6, 8
  addChar(700,2330,as(RAPE1,{pose:'run',prop:'sack'}));addChar(714,2338,as(RAPE2,{pose:'run'}));setT('farine',5,707,2334,24);
  addOak(260,2240,true,(c,x,y)=>{c.save();c.translate(x,y-4);c.scale(1.2,1.2);drawProp(c,'sack',0,-5,1);c.restore();});addChar(292,2250,as(RAPE2,{pose:'give',flip:true}));{const[x,y]=pr(260,2240,0);setTxy('farine',6,x,y-12,24);}
  addFootprints(610,2150,700,2165,9);addChar(720,2170,as(BASTIEN,{pose:'point',prop:'magnifier',flip:true}));setT('farine',8,690,2162,28);
  // couronne 9, 11, 12
  addOak(800,2470,true,(c,x,y)=>{c.save();c.translate(x,y-4);c.scale(1.6,1.6);drawProp(c,'crownp',0,2,1);c.restore();});addChar(832,2480,as(GIGOT,{pose:'give',flip:true}));{const[x,y]=pr(800,2470,0);setTxy('couronne',9,x,y-12,24);}
  addFootprints(420,2400,500,2430,8);addChar(408,2394,as(BASTIEN,{pose:'lean',prop:'magnifier'}));setT('couronne',11,440,2410,28);
  addClothesline(cab2.cx+30,cab2.v1+26,false);addChar(cab2.cx,cab2.v1+16,as(GIGOT2,{pose:'stand',prop:'axe'}));setT('couronne',12,cab2.cx,cab2.v1+16,22);
  // arbres de la forêt (en évitant de cacher les scènes)
  const tg=CASES.filter(c=>c.dist===4).flatMap(c=>c.steps.map(s=>s.t)).filter(Boolean);for(const[u,v]of[[120,2250],[650,2080],[560,2060],[698,2516],[690,2506],[706,2526]]){const[x,y]=pr(u,v,0);tg.push({x,y:y-14});avoid(u,v,22);}
  const hides=(u,v)=>{const[x,y]=pr(u,v,0);return tg.some(t=>Math.abs(x-t.x)<34&&y>t.y-10&&y<t.y+70);};
  for(let n=0;n<420;n++){const u=R(10,870),v=R(2044,2590);if(inPond(u,v,8)||!free(u,v,10)||hides(u,v))continue;const pk=rnd();pk<.45?addPine(u,v):pk<.9?addTree(u,v,R(.9,1.3)):addMushrooms(u,v);}
  areas.push({u0:20,v0:2050,u1:860,v1:2580,n:30,dist:4,ok:(u,v)=>!inPond(u,v,6)});

  // village
  for(const[i,j]of[[3,7],[4,7]])blockGround(i,j);
  {const t=townBlock(3,7,[{id:'auberge',w:96,sign:'Auberge du Sanglier',roof:'gable',tone:'#e9dcc0',h:62,awn:true,awnCol:'#a8946a',signSize:6.4},{id:'eglise',w:70,sign:'Église',roof:'gable',h:60},{}],null,{n:20});
   const a=bld.auberge,e=bld.eglise,k=t.k;e.after=c=>{drawBox(c,e.u1-22,e.v0+6,e.h,16,16,44);const[x,y]=pr(e.u1-14,e.v0+14,e.h+44);P(c,[[x-12,y+4],[x,y-34],[x+12,y+4]],WHITE);L(c,x,y-34,x,y-42);L(c,x-3,y-39,x+3,y-39);};
   {const p=fr(a,.3,16);addCart(p[0]+10,p[1]+10,3,null);addChar(p[0]-14,p[1]+4,as(COCOTTE,{pose:'arms_up'}));setT('farine',7,p[0]-4,p[1]+6,28);}
   addStall(k.u0+150,k.v0+120,'Farine pas chère','cheese');addChar(k.u0+144,k.v0+106,as(RAPE1,{pose:'give',prop:'money'}));addChar(k.u0+158,k.v0+108,as(RAPE2,{pose:'carry',prop:'sack'}));setT('farine',9,k.u0+150,k.v0+114,28);
   addPillory(k.u0+70,k.v0+170,as(GIGOT,{pose:'stand'}),as(LARDON,{pose:'stand'}));addChar(k.u0+100,k.v0+176,as(HERMINE,{pose:'arms_up'}));setT('couronne',15,k.u0+82,k.v0+172,30);}
  {const t=townBlock(4,7,[{w:100,sign:'Ferme',roof:'gable',bigDoor:true,tone:'#e9d3cf',h:58},{w:60,roof:'gable',h:52,tone:'#e9dcc0'},{}],null,{n:18});
   const k=t.k;addFountain(k.u0+150,k.v0+150);
   addCart(k.u0+60,k.v0+110,2,null);addChar(k.u0+40,k.v0+116,as(RAPE1,{pose:'carry',prop:'sack'}));addChar(k.u0+52,k.v0+124,as(RAPE2,{pose:'point'}));setT('farine',4,k.u0+52,k.v0+116,28);
   addChar(k.u0+190,k.v0+70,as(LARDON,{pose:'give',prop:'money'}));addChar(k.u0+204,k.v0+72,as(GIGOT2,{flip:true}));setT('couronne',13,k.u0+197,k.v0+71,24);}
  // champs, vignes, moulin
  {const k3=blk(3,8),k4=blk(4,8);G(k3.u0,k3.v0,k4.u1,k4.v1,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,k3.u0,k3.v0,k3.u1,k3.v1,'#ebe6cf');rectG(c,k4.u0,k4.v0,k4.u1,k4.v1,'#efe8c8');c.strokeStyle='#cfc49e';c.lineWidth=.6;for(let u=k4.u0+10;u<k4.u1;u+=10){const a=pr(u,k4.v0+4,0),b=pr(u,k4.v1-4,0);L(c,a[0],a[1],b[0],b[1]);}});
   labelG(k3.u0+10,k3.v0+14,'Vignes');addVines(k3.u0+20,k3.v0+40,k3.u1-30,k3.v0+130);
   addHay(k3.u0+60,k3.v0+176);addChar(k3.u0+80,k3.v0+176,as(RAPE1,{pose:'hide'}));addChar(k3.u0+86,k3.v0+188,as(RAPE2,{pose:'crouch',flip:true}));setT('farine',3,k3.u0+78,k3.v0+180,26);
   addCampfire(k3.u0+170,k3.v0+190,false);addChar(k3.u0+160,k3.v0+186,as(RAPE1,{pose:'arms_up',prop:'pie'}));addChar(k3.u0+182,k3.v0+186,as(RAPE2,{pose:'arms_up'}));addChar(k3.u0+170,k3.v0+206,as(BASTIEN,{pose:'point'}));setT('farine',10,k3.u0+170,k3.v0+194,30);
   
   addMill(k4.u0+120,k4.v0+80);addChar(k4.u0+140,k4.v0+204,as(GIGOT2,{pose:'run',prop:'axe'}));addChar(k4.u0+120,k4.v0+208,as(BOUBOULE,{pose:'run',prop:'sword'}));setT('couronne',14,k4.u0+130,k4.v0+206,28);addChar(k4.u0+150,k4.v0+110,as(COCOTTE,{pose:'carry',prop:'sack'}));setT('farine',1,k4.u0+150,k4.v0+110,24);
   for(const[du,dv]of[[40,170],[200,180],[60,60]])addHay(k4.u0+du,k4.v0+dv);addScarecrow(k4.u0+200,k4.v0+60);
   addCart(k4.u0+120,2294,4,as(FERMIER,{pose:'walk'}));setT('farine',2,k4.u0+132,2294,30);
   areas.push({u0:k3.u0+10,v0:k3.v0+150,u1:k4.u1-10,v1:k4.v1-10,n:14,dist:4});}

  // château sur sa butte
  const L0=[1470,2044,1990,2570],U0=[1520,2090,1940,2500];
  G(L0[0],L0[1],L0[2],L0[3],c=>{c.strokeStyle=INK;c.lineWidth=1.1;
    drawBox(c,L0[0],L0[1],0,L0[2]-L0[0],L0[3]-L0[1],ZL,'#e3e4cf','#d4d6c0','#c3c7ad');
    drawBox(c,U0[0],U0[1],ZL,U0[2]-U0[0],U0[3]-U0[1],ZU-ZL,'#efeadf','#e2ddd0','#d6d0c2');
    c.strokeStyle='#d6cfbf';c.lineWidth=.5;for(let u=U0[0]+20;u<U0[2];u+=20){const a=pr(u,U0[1],ZU),b=pr(u,U0[3],ZU);L(c,a[0],a[1],b[0],b[1]);}for(let v=U0[1]+20;v<U0[3];v+=20){const a=pr(U0[0],v,ZU),b=pr(U0[2],v,ZU);L(c,a[0],a[1],b[0],b[1]);}
    c.strokeStyle=INK;for(let k=0;k<4;k++){const z=ZL+k*(ZU-ZL)/4,v=U0[3]+k*0;ip(c,[[1712,U0[3]+16-k*4,z],[1752,U0[3]+16-k*4,z],[1752,U0[3]+16-k*4,z+4.5],[1712,U0[3]+16-k*4,z+4.5]],'#f3eee2');}
    for(let k=0;k<4;k++){const z=k*ZL/4;ip(c,[[1712,L0[3]-k*4,z],[1752,L0[3]-k*4,z],[1752,L0[3]-k*4,z+3.5],[1712,L0[3]-k*4,z+3.5]],'#f3eee2');}});
  G(1480,2060,1700,2080,c=>groundText(c,1480,2060,'Château de la Colline',15));
  addWall(U0[0],U0[1],U0[2],U0[1]+10,22,ZU);addWall(U0[0],U0[1]+10,U0[0]+10,U0[3]-30,22,ZU);
  addTower(U0[0],U0[1],30,48,ZU);addTower(U0[2],U0[1],30,48,ZU);addTower(U0[0],U0[3]-30,30,48,ZU);
  addTower(1700,U0[3]-6,20,30,ZU);addTower(1764,U0[3]-6,20,30,ZU);
  const don=makeBuilding({id:'donjon',u0:1650,v0:2110,u1:1740,v1:2170,h:84,front:'v',roof:'flat',tone:WHITE,z:ZU,cols:false});
  don.rooftop=[];don.after=c=>{for(let u=don.u0;u<don.u1-4;u+=10)drawBox(c,u,don.v1-5,don.h,5,5,5);const[x,y]=pr(don.u0+60,don.v1,0);c.strokeStyle=INK;c.lineWidth=.8;L(c,x,y-don.h+2,x,y-8);drawChar(c,x,y-36,as(GIGOT,{pose:'climb',prop:null}));};
  {const[x,y]=pr(don.u0+60,don.v1,0);setTxy('couronne',6,x,y-36-ZU-14,22);}
  const cui=makeBuilding({id:'cuisine',u0:1850,v0:2104,u1:1932,v1:2150,h:36,front:'v',roof:'gable',tone:'#efeadf',z:ZU,sign:'Cuisines',chim:true});
  for(const[u,v]of[[1600,2260],[1820,2420],[1880,2300]])addBanner(u,v,ZU);
  // scènes du château
  addChar(1600,2300,as(HERMINE,{pose:'carry',prop:'crownp'}),{z:ZU});addChar(1616,2306,SP('dog','suit','white','none','arms_up',null,true),{z:ZU});setT('couronne',1,1606,2302,24,ZU);
  addChar(1850,2546,as(GIGOT,{pose:'arms_up'}),{z:ZL});addSpr(1850,2546,(c,x,y)=>{for(const[dx,dy]of[[-8,-40],[0,-46],[8,-40]])C(c,x+dx,y+dy,2,RED);},{top:true,ht:52,z:ZL});setT('couronne',2,1850,2546,24,ZL);
  {const p=fr(cui,.5,14);addChar(p[0],p[1],as(LARDON,{pose:'carry',prop:'pie'}),{z:ZU});setT('couronne',3,p[0],p[1],22,ZU);}
  addCauldron(1800,2250,ZU);addChar(1784,2254,as(GIGOT,{pose:'give',prop:'vial'}),{z:ZU});setT('couronne',4,1792,2252,24,ZU);
  addChar(1562,2150,as(BOUBOULE,{pose:'sleep'}),{z:ZU});setT('couronne',5,1562,2150,22,ZU);
  addChar(1680,2420,as(HERMINE,{pose:'arms_up',prop:null}),{z:ZU});addSpr(1694,2424,(c,x,y)=>drawProp(c,'cushion',x,y-10,1),{ht:14,z:ZU});setT('couronne',7,1686,2422,22,ZU);
  addChar(1732,2548,as(GIGOT,{pose:'run',prop:'crownp'}),{z:ZL});setT('couronne',8,1732,2548,22,ZL);
  addChar(1580,2546,as(BOUBOULE,{pose:'stand',prop:'trumpet'}),{z:ZL});setT('couronne',10,1580,2546,22,ZL);
  for(let n=0;n<26;n++){const u=R(1540,1930),v=R(2180,2490);if(!free(u,v,4))continue;addChar(u,v,randomSpec(),{z:ZU});}
  for(let n=0;n<10;n++){const u=R(1480,1980),v=R(2510,2566);if(!free(u,v,4))continue;addChar(u,v,randomSpec(),{z:ZL});}
  for(let n=0;n<14;n++){const u=R(1460,2010),v=R(2034,2600);if(u>1475&&u<1985&&v<2565)continue;if(!free(u,v,10))continue;addPine(u,v);}
  waterG(2032,2032,2120,2600,61);
}
