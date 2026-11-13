/* =========================================================
   DEUX NOUVELLES ENQUÊTES DIFFICILES (15 étapes chacune)
   - « Sabotage au feu d'artifice » (Fête foraine)
   - « Les œufs d'or de la Grande Tortue » (Île) : finale de l'île,
     ouverte quand les 3 autres enquêtes de l'île sont classées.
   Elles utilisent les nouveaux corps (salopette, robe, poncho, tutu…)
   pour les personnages nommés.
   ========================================================= */
const DIRO2=DIRO;
const PYRO=SP('hippo','overalls','white','cap',null,null,false,{build:'round'});
const PETARD=SP('pig','overalls','white','glasses',null,null,false,{build:'round'}),PETARD2=SP('pig','coat','white','glasses',null,null,false,{build:'round'}),PETARD3=SP('pig','overalls','white','cap',null,null,false,{build:'round'}),PETARD4=SP('hippo','overalls','white','glasses',null,null,false,{build:'round'});
const OMBRE_SIL=SP('dog','coat','black','none',null,null,false,{build:'tall'});
const DOYENNE=SP('turtle','robe','white','flower',null,null,false,{build:'old'});
const CAPTAUD=SP('hippo','poncho','white','cap',null,null,false,{build:'round'}),CAPTAUD2=SP('hippo','poncho','white','none',null,null,false,{build:'round'}),CAPTAUD3=SP('hippo','robe','white','cap',null,null,false,{build:'round'}),CAPTAUD4=SP('croc','poncho','white','cap',null,null,false,{build:'round'});
const PETARD_SIL=PETARD;

CASES.push(
 {id:'feu',dist:2,title:"Sabotage au feu d'artifice",diff:3,
  intro:"C'est le grand soir : le plus beau feu d'artifice de l'histoire de la fête ! Mais à quelques heures du spectacle, Gédéon l'artificier découvre que quelqu'un a tripatouillé ses fusées. Qui voudrait gâcher la fête ? Pas de panique : il reste assez de jour pour enquêter.",
  cast:[{n:'Monsieur Crinière',r:'directeur, haut-de-forme et discours interminables',s:DIRO2},{n:'Gédéon',r:"l'artificier, hippopotame en salopette",s:PYRO},{n:'Monsieur Pétard',r:'cochon en salopette, à lunettes',s:PETARD},{n:'Bobo',r:'clown en tutu, roi de la diversion',s:CLOWN},{n:'Inspectrice Léonie',r:'police, pas de temps à perdre',s:LEONIE}],
  steps:[
   {w:0,q:"« Mesdames et messieurs, ce soir, le feu d'artifice du siècle ! » Quelqu'un répète son discours sur une estrade. Où ?",ok:"Monsieur Crinière, haut-de-forme en avant, postillonne de bonheur devant trois spectateurs qui font semblant d'applaudir."},
   {w:1,q:"Derrière la scène, Gédéon astique sa rampe de lancement comme un trésor. Trouve-le.",ok:"« Pas touche, c'est réglé à la seconde ! » Gédéon, salopette taillée sur mesure, surveille sa rampe d'un œil jaloux."},
   {q:"Gédéon se vante : « Mes fusées, alignées comme à la parade ! » Combien en a-t-il posé sur la rampe ?",choice:[CH('4'),CH('5'),CH('6'),CH('7')],ans:2,ok:"Six fusées exactement. Gédéon les compte et les recompte chaque heure."},
   {q:"La nuit tombe. Entre deux caravanes, une silhouette sombre guette les fusées. Ce n'est pas un forain. Trouve-la.",ok:"Une ombre immobile, grande et sans visage dans la nuit : elle observe la rampe, puis disparaît."},
   {q:"Au matin, Gédéon hurle : trois mèches ont été coupées net ! Retrouve-les avant que la foule ne les piétine.",ok:"Trois mèches tranchées, trois fusées muettes. C'est un sabotage, pas un accident."},
   {q:"Dans la poussière de l'allée, des bottes presque neuves ont laissé des traces. Vers où filent-elles ?",ok:"Elles quittent la rampe et descendent vers le lac des cygnes, sans se retourner."},
   {q:"Quatre suspects sont interrogés, un seul d'entre eux ment :<br>🐷 <i>Le cochon en salopette, à lunettes</i> : « C'est le cochon en manteau. »<br>🐷 <i>Le cochon en manteau</i> : « Ce n'est pas moi. »<br>🐷 <i>Le cochon en salopette, à casquette</i> : « C'est le cochon à lunettes en salopette. »<br>🦛 <i>L'hippopotame</i> : « Ce n'est pas le cochon à casquette. »<br><b>Qui est le saboteur ?</b>",choice:[CH('Le cochon en salopette, à casquette',PETARD3),CH('Le cochon en manteau, à lunettes',PETARD2),CH('Le cochon en salopette, à lunettes',PETARD),CH("L'hippopotame en salopette, à lunettes",PETARD4)],ans:2,ok:"Si le coupable est le cochon à lunettes en salopette, seul le premier ment… et tout s'emboîte. C'est Monsieur Pétard, l'éternel rival de Gédéon !"},
   {w:2,q:"Pétard a pris la fuite par le lac… dans un pédalo en forme de cygne ! Trouve ce pirate d'eau douce.",ok:"Il pédale comme un forcené, mais un pédalo-cygne, ça ne dépasse pas la vitesse d'un canard pressé."},
   {q:"Sur la rive, Pétard essaie de se perdre dans la troupe des artificiers : tous portent salopette et casquette… sauf lui. Trouve l'intrus !",ok:"Le voilà ! Même casquette, mais un manteau : il a oublié de se changer. Un détail qui l'a trahi."},
   {w:4,q:"Gédéon court chercher la police. Trouve l'Inspectrice Léonie, qui arrive au pas de course.",ok:"« Où est-il ? » Léonie arrive, sifflet aux lèvres, suivie d'un Gédéon essoufflé."},
   {w:3,q:"Pour retenir le public pendant la réparation, Bobo le clown improvise un numéro. Où ?",ok:"Devant le chapiteau, en tutu, Bobo jongle avec des ballons… dont un qu'il vient de perdre !"},
   {q:"Il faut remplacer les mèches. Gédéon sait où trouver du fil neuf : dans une caisse, près d'une caravane.",ok:"Une caisse de mèches de rechange, bien rangée : le saboteur ne l'avait pas trouvée."},
   {w:4,q:"Léonie a repéré Pétard. Où le cueille-t-elle ?",ok:"En plein milieu de l'allée, sous les yeux des curieux : « Monsieur Pétard, vous êtes en état d'arrestation ! »"},
   {q:"Les nouvelles mèches sont en place. Gédéon approche son briquet, retiens ton souffle : trouve la rampe en action !",ok:"Les étincelles courent le long des mèches neuves, une à une, jusqu'aux fusées."},
   {q:"Le ciel s'illumine ! Où la foule admire-t-elle le plus beau feu d'artifice de l'histoire ?",ok:"Un immense bouquet d'étincelles au-dessus de la fête, tandis que Monsieur Crinière pleure d'émotion."}],
  outro:"Le spectacle a été encore plus beau que prévu. Pétard, lui, ramasse tous les confettis de la fête… jusqu'à la prochaine. Enquête classée !"},
 {id:'tortue',dist:5,title:"Les œufs d'or de la Grande Tortue",diff:3,req:['bouteille','volcan','epave'],
  intro:"Une fois tous les cent ans, la Grande Tortue pond des œufs d'or sur la plage de l'île. Toute l'île veille sur le nid, de Titou le petit guetteur à la Professeure Plume. Mais cette nuit, quelqu'un rôde dans les cocotiers… La grande finale de l'île !",
  cast:[{n:'La Grande Tortue',r:'la doyenne, en robe à fleur',s:DOYENNE},{n:'Titou',r:'chaton à casquette, guetteur officiel',s:TITOU},{n:'Capitaine Pataud',r:'hippopotame en poncho, à casquette',s:CAPTAUD},{n:'Professeure Plume',r:'cane archéologue',s:PLUME},{n:'Inspectrice Léonie',r:'police',s:LEONIE}],
  steps:[
   {w:0,q:"Le jour se lève sur la plage. Trouve la Grande Tortue, gardienne du nid doré depuis cent ans.",ok:"Elle veille, immobile, drapée dans sa robe à fleur : « Cent ans que j'attends cette nuit-là. »"},
   {q:"Le nid scintille au soleil. Combien d'œufs d'or la Grande Tortue a-t-elle pondus ?",choice:[CH('3'),CH('4'),CH('5'),CH('6')],ans:2,ok:"Cinq œufs, bien au chaud dans la paille. Chacun vaut une fortune… et peut-être une convoitise."},
   {w:1,q:"Titou a demandé la garde de nuit. Où monte-t-il la garde, lanterne en main ?",ok:"Au bord de la plage, il écarquille les yeux : « Rien ne bouge ! » Et il bâille."},
   {q:"Vers minuit, une lueur danse entre les cocotiers. Ce n'est pas une luciole. Trouve la lanterne du rôdeur.",ok:"Une petite lanterne posée entre deux palmiers, et une ombre qui s'éloigne dans le noir."},
   {q:"Au matin, le nid est pillé ! Des traces de bottes s'éloignent du nid. Retrouve les trois traces.",ok:"Trois empreintes profondes dans le sable : quelqu'un de lourd, qui portait un fardeau."},
   {q:"Les traces s'arrêtent net, près d'une crique. Qu'est-ce qui attend sur le sable ?",ok:"Une pirogue tirée à sec, avec des brins de paille dans le fond : le voleur est reparti par la mer."},
   {q:"Quatre étrangers sont arrivés sur l'île cette semaine. Qui n'a aucun alibi ?<br>🦛 <i>Hippopotame en poncho, sans casquette</i> : dînait au Café du Lagon, devant tout le monde.<br>🦛 <i>Hippopotame en robe, à casquette</i> : dormait chez Mamie Minette.<br>🐊 <i>Crocodile en poncho, à casquette</i> : aucun alibi… mais les traces de bottes sont trop grandes pour un crocodile.<br>🦛 <i>Hippopotame en poncho, à casquette</i> : « Je me promenais. Seul. »<br><b>Qui a volé les œufs ?</b>",choice:[CH('Le crocodile en poncho, à casquette',CAPTAUD4),CH('Le hippopotame en robe, à casquette',CAPTAUD3),CH('Le hippopotame en poncho, sans casquette',CAPTAUD2),CH('Le hippopotame en poncho, à casquette',CAPTAUD)],ans:3,ok:"Seul, sans alibi, avec les grandes empreintes : c'est le Capitaine Pataud, collectionneur d'œufs rares !"},
   {w:2,q:"Pataud a filé en pirogue avec son sac sur les genoux. Trouve-le, en pleine fuite.",ok:"Il rame comme un fou, le sac d'œufs serré contre lui. Le sac bouge. Hmm."},
   {q:"Pataud a caché son butin dans une grotte au pied du volcan. Trouve la grotte.",ok:"Une grotte éclairée de deux torches, avec une lueur dorée au fond : on a trouvé la cachette."},
   {q:"À l'entrée, un sbire s'est déguisé en tortue pour surveiller. Parmi ces tortues, trouve l'imposteur !",ok:"Celle-ci a des jambes en pantalon rayé qui dépassent de la carapace ! Les vraies tortues n'ont pas de chaussures."},
   {q:"Dans la bagarre, trois œufs ont roulé jusqu'au sable. Retrouve-les avant la marée.",ok:"Trois œufs dorés, intacts, dans les herbes de la plage. Pas une fêlure !"},
   {w:3,q:"La Professeure Plume veut s'assurer qu'ils sont authentiques. Où les examine-t-elle ?",ok:"Devant sa tente, la loupe à l'œil : « Authentiques ! Les plus beaux que j'aie jamais vus ! »"},
   {w:4,q:"Léonie arrive pour arrêter Pataud avant qu'il ne reparte. Où ?",ok:"Au bord de l'eau, juste avant qu'il ne reparte en barque : « Capitaine Pataud, vous êtes en état d'arrestation ! »"},
   {w:1,q:"Titou et la Grande Tortue ramènent les œufs au nid. Trouve-les.",ok:"Les œufs retrouvent leur paille, à l'abri sous les palmiers. Titou ne lâche pas le nid des yeux."},
   {q:"Un craquement ! Les œufs éclosent ! Trouve les petites tortues qui trottinent vers la mer.",ok:"Quatre minuscules tortues courent vers les vagues, sous l'œil attendri de la Grande Tortue. Cent ans d'attente, une minute de bonheur."}],
  outro:"Les bébés tortues ont rejoint l'océan, et le Capitaine Pataud garde désormais la plage… à plein temps. La grande finale de l'île est classée !"}
);

/* ---------- petits décors ---------- */
/* agrandit les éléments créés par un appel (sprites seulement) autour de leur pied */
function big(k,fn){const n0=items.length,t0=topItems.length;fn();
  for(const[arr,n]of[[items,n0],[topItems,t0]])for(let i=n;i<arr.length;i++){const it=arr[i],[x,y]=pr(it.fp[0],it.fp[1],0),od=it.d,b=it.bb;
    it.d=c=>{c.save();c.translate(x,y);c.scale(k,k);c.translate(-x,-y);od(c);c.restore();};
    it.bb=[x+(b[0]-x)*k,y+(b[1]-y)*k,x+(b[2]-x)*k,y+(b[3]-y)*k];}}

function _addRamp(u,v,n,lit){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;const w=n*9+8;
  c.fillStyle='#a8946a';c.beginPath();c.moveTo(x-w/2,y);c.lineTo(x+w/2,y);c.lineTo(x+w/2-3,y+6);c.lineTo(x-w/2-3,y+6);c.closePath();c.fill();c.stroke();
  for(let i=0;i<n;i++){const rx=x-w/2+8+i*9;Rc(c,rx-2,y-20,4,20,WHITE);P(c,[[rx-2,y-20],[rx+2,y-20],[rx,y-26]],RED);P(c,[[rx-2,y],[rx-4.4,y+2],[rx-2,y-4]],GREY);P(c,[[rx+2,y],[rx+4.4,y+2],[rx+2,y-4]],GREY);
   if(lit){c.strokeStyle=INK;c.lineWidth=.7;c.beginPath();c.moveTo(rx,y);c.quadraticCurveTo(rx+3,y+4,rx+1,y+8);c.stroke();for(const[a,b]of[[-3,-2],[3,-4],[0,-6]])D(c,rx+a,y+8+b,.9,'#e6c14a');}}},{ht:34,hw:n*5+14});}
function _addFuse(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;c.beginPath();c.moveTo(x-8,y-2);c.quadraticCurveTo(x-4,y-6,x-1,y-3);c.stroke();c.beginPath();c.moveTo(x+3,y-3);c.quadraticCurveTo(x+6,y,x+9,y-4);c.stroke();D(c,x-1,y-3,1,'#3a3733');D(c,x+3,y-3,1,'#3a3733');c.lineWidth=.6;L(c,x+5,y-8,x+7,y-6);L(c,x+8,y-8,x+6,y-6);},{ht:12,hw:12});}
function _addBoots(u,v,n){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.9;for(let i=0;i<n;i++){const bx=x-(n-1)*6+i*12,by=y-2-(i%2)*3;E(c,bx,by,3.6,2.2,'#c9c3b0');E(c,bx+5,by+1,2.8,1.8,'#c9c3b0');}},{ht:12,hw:n*7+4});}
function _addLantern(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-3,y-9,6,9,'#efe6c8');c.beginPath();c.arc(x,y-9,3,PI,0);c.stroke();E(c,x,y-5,6,7,'rgba(230,193,74,.35)');L(c,x-4,y-12,x+4,y-12);},{ht:16,hw:10});}
function _addEgg(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y-4,3.6,4.8,'#e6c14a');E(c,x-1,y-5.6,1,1.4,'#f6e9a8');},{ht:10,hw:8});}
function _addNest(u,v,n){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y-3,19,8,'#c9b58a');c.lineWidth=.5;for(let i=-16;i<=16;i+=4)L(c,x+i,y-3,x+i*.8,y+3);for(let i=0;i<n;i++){const ex=x-10+i*(20/Math.max(1,n-1)),ey=y-6-(i%2)*2;c.lineWidth=1;E(c,ex,ey,3.8,5,'#e6c14a');E(c,ex-1,ey-1.6,1,1.4,'#f6e9a8');}},{ht:18,hw:22});avoid(u,v,16);}
function _addBabyTurtle(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;for(const[dx,dy]of[[-3,0],[3,0]])E(c,x+dx,y+dy,1.4,.8,'#d4d6c0');C(c,x+5,y-2,1.6,'#d4d6c0');D(c,x+5.6,y-2.4,.35);c.beginPath();c.ellipse(x,y-2,4,2.8,0,PI,0);c.closePath();c.fillStyle='#c3c7ad';c.fill();c.stroke();},{ht:8,hw:8});}
function addFakeTurtle(u,v){addSpr(u,v,(c,x,y)=>{c.save();c.translate(x,y);c.scale(1.5,1.5);c.strokeStyle=INK;c.lineWidth=.9;
  /* jambes en pantalon rayé qui dépassent de la carapace, grosses chaussures */
  for(const dx of[-5,3]){Rc(c,x*0+dx,-7,3.4,7,'#f1ede0');c.lineWidth=.5;for(const k of[1.5,3.2,4.9])L(c,dx,-k,dx+3.4,-k);c.lineWidth=.9;E(c,dx+1.7,.2,4,1.8,'#3a3733');}
  /* tête de turtle mal cachée : museau de crocodile sous une casquette */
  C(c,9.5,-10,2.8,'#d4d6c0');D(c,10.6,-10.8,.55);P(c,[[7,-12.4],[12.4,-12.4],[11,-14.4],[7.4,-14.2]],'#3a3733');
  c.beginPath();c.ellipse(0,-9,8.4,5.8,0,PI,0);c.closePath();c.fillStyle='#c3c7ad';c.fill();c.stroke();c.lineWidth=.5;L(c,-4,-9,-2,-14.4);L(c,4,-9,2,-14.4);L(c,-2,-14.4,2,-14.4);
  c.restore();},{ht:34,hw:20});avoid(u,v,12);}
function addBigTurtle(u,v){addSpr(u,v,(c,x,y)=>{c.save();c.translate(x,y);c.scale(1.5,1.5);c.strokeStyle=INK;c.lineWidth=.9;for(const[dx,dy]of[[-7,0],[7,0],[-6,-5],[6,-5]])E(c,dx,dy,2.6,1.4,'#d4d6c0');C(c,9.5,-4,2.6,'#d4d6c0');D(c,10.4,-4.6,.5);c.beginPath();c.ellipse(0,-3,8.4,5.8,0,PI,0);c.closePath();c.fillStyle='#c3c7ad';c.fill();c.stroke();c.lineWidth=.5;L(c,-4,-3,-2,-8.4);L(c,4,-3,2,-8.4);L(c,-2,-8.4,2,-8.4);c.restore();},{ht:22,hw:20});avoid(u,v,12);}
function addCave(u,v){addSpr(u,v,(c,x,y)=>{c.save();c.translate(x,y);c.scale(1.5,1.5);c.strokeStyle=INK;c.lineWidth=1.1;
  c.beginPath();c.moveTo(-38,0);c.quadraticCurveTo(-40,-34,-12,-40);c.quadraticCurveTo(18,-48,34,-22);c.lineTo(38,0);c.closePath();c.fillStyle='#bdb6a4';c.fill();c.stroke();
  c.lineWidth=.5;for(const[a,b,l]of[[-26,-26,10],[-20,-12,12],[22,-30,9],[28,-14,12],[6,-40,8]]){c.beginPath();c.moveTo(a,b);c.quadraticCurveTo(a+2,b+l*.5,a-1,b+l);c.stroke();}
  c.lineWidth=1.1;c.beginPath();c.moveTo(-15,0);c.quadraticCurveTo(-15,-26,0,-26);c.quadraticCurveTo(15,-26,15,0);c.closePath();c.fillStyle='#3a3733';c.fill();c.stroke();
  /* lueur dorée : tas d'œufs dans le fond */
  for(const[a,b]of[[-6,-4],[0,-9],[5,-3],[-1,-3],[8,-8],[-9,-9]]){E(c,a,b,2.2,2.8,'#e6c14a');}
  /* torches de chaque côté */
  for(const sx of[-24,24]){c.lineWidth=1;L(c,sx,0,sx,-18);P(c,[[sx-2.4,-18],[sx+2.4,-18],[sx,-25]],'#e6a23a');}
  /* sacs devant l'entrée */
  E(c,-24,2,5,4,'#cfc4a0');E(c,-17,3,4,3.4,'#cfc4a0');
  c.restore();},{ht:76,hw:62,lo:10});avoid(u,v,34);}
function addBurst(u,v,z,r){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.9;for(let i=0;i<14;i++){const a=i/14*TAU,r0=r*.25,r1=r*(i%2?.7:1);c.beginPath();c.moveTo(x+Math.cos(a)*r0,y+Math.sin(a)*r0);c.lineTo(x+Math.cos(a)*r1,y+Math.sin(a)*r1);c.stroke();D(c,x+Math.cos(a)*(r1+3),y+Math.sin(a)*(r1+3),1.1,i%2?'#e6c14a':RED);}D(c,x,y,2,'#e6c14a');},{z,top:true,ht:r*2+10,hw:r+10,lo:r+10});}
function addCrateFuses(u,v){addCrate(u,v,12);addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;for(let k=0;k<3;k++){c.beginPath();c.ellipse(x-5+k*5,y-17,3,1.8,0,0,TAU);c.fillStyle=k%2?RED:'#3a3733';c.fill();c.stroke();}},{top:true,ht:24,hw:16});}
function _addPodium(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-18,y],[x+18,y],[x+18,y-8],[x-18,y-8]],'#c9b58a');P(c,[[x-18,y-8],[x+18,y-8],[x+12,y-14],[x-12,y-14]],'#d8c8a4');c.lineWidth=.5;for(let k=-14;k<18;k+=8)L(c,x+k,y,x+k,y-8);Rc(c,x-3,y-14,6,3,RED);},{ht:18,hw:22});avoid(u,v,18);}
function addSwanBoat(u,v,sp){addSpr(u,v,(c,x,y)=>{c.save();c.translate(x,y);c.scale(1.5,1.5);c.strokeStyle=INK;
  /* sillage */
  c.lineWidth=.6;for(const[k,w]of[[0,22],[1,30],[2,38]]){c.beginPath();c.moveTo(-14-k*6,2+k*2);c.quadraticCurveTo(-22-k*6-w/4,5+k*2,-30-k*8,3+k*2);c.stroke();}
  c.lineWidth=1;E(c,0,-3,15,6.4,WHITE);
  /* queue et aile */
  c.beginPath();c.moveTo(-13,-6);c.quadraticCurveTo(-21,-11,-16,-16);c.lineTo(-10,-8);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();
  c.beginPath();c.ellipse(-2,-4,8,3.4,-.15,0,TAU);c.fillStyle='#efefea';c.fill();c.stroke();
  /* cou et tête de cygne */
  c.beginPath();c.moveTo(9,-8);c.quadraticCurveTo(18,-12,15,-24);c.quadraticCurveTo(15,-30,20,-28);c.lineWidth=2;c.stroke();c.lineWidth=1;
  C(c,20,-28,2.6,WHITE);P(c,[[22.2,-28.4],[27,-27],[22.2,-26]],'#e6a23a');D(c,19.4,-29,.55);
  /* le passager pédale */
  drawChar(c,-3,-2,Object.assign({},sp,{pose:'sit',noShadow:true}));
  /* petit nom sur la coque */
  c.lineWidth=.5;txt(c,'PÉDALO',6,-1,3.6);
  c.restore();},{ht:74,hw:42});avoid(u,v,24);}
function addPirogue(u,v,sp,withSack){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.moveTo(x-26,y-5);c.quadraticCurveTo(x,y+8,x+26,y-5);c.lineTo(x+22,y-8);c.lineTo(x-22,y-8);c.closePath();c.fillStyle='#a8946a';c.fill();c.stroke();if(sp)drawChar(c,x,y-3,sp);if(withSack){c.lineWidth=1;E(c,x+10,y-12,6,6,'#cfc4a0');L(c,x+7,y-17,x+13,y-17);}},{ht:56,hw:32});avoid(u,v,18);}

function addRamp(u,v,n,lit){big(1.45,()=>_addRamp(u,v,n,lit));}
function addFuse(u,v){big(1.9,()=>_addFuse(u,v));}
function addBoots(u,v,n){big(1.7,()=>_addBoots(u,v,n));}
function addLantern(u,v){big(1.8,()=>_addLantern(u,v));}
function addEgg(u,v){big(1.9,()=>_addEgg(u,v));}
function addNest(u,v,n){big(1.5,()=>_addNest(u,v,n));}
function addBabyTurtle(u,v){big(1.9,()=>_addBabyTurtle(u,v));}
function addPodium(u,v){big(1.4,()=>_addPodium(u,v));}
/* ---------- construction ---------- */
function buildNewCases(){
  const T=(cid,n,u,v,r,z)=>{setT(cid,n,u,v,r,z);avoidRect(u-r-22,v-r-16,u+r+22,v+r+16);};
  const spot=(u,v,hw,hh)=>findSpot(u,v,hw,hh);
  const spotI=(u,v,hw,hh,lim)=>{lim=lim||.85;const ok=(p)=>((p[0]-IU)/285)**2+((p[1]-IV)/445)**2<lim;let p=findSpot(u,v,hw,hh);if(ok(p))return p;for(let k=0;k<30;k++){const a=k*2.1,d=40+k*9,q=[u+(IU-u)*.35+Math.cos(a)*d,v+(IV-v)*.35+Math.sin(a)*d];if(!ok(q))continue;p=findSpot(q[0],q[1],hw,hh);if(ok(p))return p;}return p;};
  /* ===== Sabotage au feu d'artifice (Fête foraine) ===== */
  CURD=2;
  {const[u,v]=spot(560,1290,30,22);addPodium(u,v);addChar(u,v-2,as(DIRO2,{pose:'point'}));addChar(u+22,v+10,as(NOIS,{pose:'arms_up'}));addChar(u-22,v+12,as(MAMAN,{}));T('feu',1,u,v-2,26);}
  let RP;{const[u,v]=spot(300,1380,40,24);RP=[u,v];addRamp(u,v,6,false);addChar(u-34,v+10,as(PYRO,{pose:'give'}));T('feu',2,u-14,v+4,36);T('feu',3,u,v,32);}
  {const[u,v]=spot(120,1580,26,18);addChar(u,v,as(OMBRE_SIL,{pose:'hide'}));addChar(u+30,v+4,as(FORAIN,{pose:'think'}));T('feu',4,u,v,24);}
  {const pts=[[-80,46],[6,78],[90,40]].map(([a,b])=>{const p=spot(RP[0]+a,RP[1]+b,10,8);addFuse(p[0],p[1]);return[p[0],p[1],0];});
   stepMulti(CASES.find(c=>c.id==='feu').steps[4],pts,16);}
  {const[u,v]=spot(900,1660,34,18);addBoots(u,v,3);addBoots(u+34,v+14,2);T('feu',6,u+12,v+6,28);}
  {const k=blk(2,6);const lu=k.uc,lv=k.v0+70;addSwanBoat(lu-20,lv,as(PETARD,{pose:'sit',noShadow:true}));addSwanBoat(lu+70,lv+34,as(MAMAN,{pose:'sit',noShadow:true,flip:true}));T('feu',8,lu-20,lv,26);}
  {const[u,v]=spot(760,1850,50,40);avoidRect(u-70,v-60,u+70,v+60);const idx=oddGroup(u,v,6,{body:'overalls',hat:'cap'},{body:'coat',hat:'cap'},['pig','hippo'],14);const st=CASES.find(c=>c.id==='feu').steps[8];st.t={x:pr(idx[0],idx[1],0)[0],y:pr(idx[0],idx[1],0)[1]-14,r:24,u:idx[0],v:idx[1]};avoid(idx[0],idx[1],40);}
  {const[u,v]=spot(960,1330,30,18);addChar(u,v,as(LEONIE,{pose:'run'}));addChar(u-22,v+8,as(PYRO,{pose:'point'}));T('feu',10,u,v,26);}
  {const k=blk(1,6);const u=k.u0+110,v=k.v0+190;addChar(u,v,as(CLOWN,{pose:'give',prop:'redballoon'}));addChar(u+16,v+8,as(NOIS,{pose:'arms_up',flip:true}));addChar(u-16,v+10,as(MAMAN,{}));T('feu',11,u,v,26);}
  {const[u,v]=spot(240,1790,24,16);addCrateFuses(u,v);addCaravan(u+40,v-30);T('feu',12,u,v,22);}
  {const[u,v]=spot(1040,1480,30,20);addChar(u,v,as(LEONIE,{pose:'point'}));addChar(u+18,v+4,as(PETARD,{pose:'arms_up'}));T('feu',13,u+9,v+2,28);}
  {const[u,v]=spot(450,1240,40,20);addRamp(u,v,6,true);addChar(u-38,v+10,as(PYRO,{pose:'give'}));T('feu',14,u,v,32);}
  {const[u,v]=spot(640,1700,50,30);const bs=[[u-14,v-8,70,28],[u+22,v-18,92,34],[u+60,v-6,64,24]];for(const[a,b,z,r]of bs)addBurst(a,b,z,r*1.35);
   for(let i=0;i<5;i++)addChar(u-30+i*16,v+26+(i%2)*6,as(randomSpec(),{pose:i%2?'arms_up':'stand'}));
   const st=CASES.find(c=>c.id==='feu').steps[14];const[x,y]=pr(u+22,v-18,92);st.t={x,y,r:58,u:u+22,v:v-18};avoid(u+22,v-18,50);}

  /* ===== Les œufs d'or de la Grande Tortue (Île) ===== */
  CURD=5;
  {const nu=2290,nv=640;const[u,v]=spotI(nu,nv,26,20);addNest(u,v,5);addChar(u+30,v+4,as(DOYENNE,{pose:'stand'}));T('tortue',1,u+30,v+4,24);T('tortue',2,u,v,24);}
  {const[u,v]=spotI(2420,900,24,16);addChar(u,v,as(TITOU,{pose:'point'}));addLantern(u+14,v+6);T('tortue',3,u,v,22);}
  {const[u,v]=spotI(2330,260,22,18);addPalm(u-14,v);addPalm(u+14,v+6);addLantern(u,v+10);addChar(u+30,v+8,as(OMBRE_SIL,{pose:'hide'}));T('tortue',4,u+4,v+10,24);}
  {const pts=[[2400,960],[2480,1000],[2560,1020]].map(([a,b])=>{const p=spotI(a,b,12,10);addBoots(p[0],p[1],2);return[p[0],p[1],0];});
   stepMulti(CASES.find(c=>c.id==='tortue').steps[4],pts,18);}
  {const[u,v]=spot(2795,700,30,20);addPirogue(u,v,null,false);addBoots(u-34,v+10,3);T('tortue',6,u,v,30);}
  {const[u,v]=spot(2845,440,30,18);addPirogue(u,v,as(CAPTAUD,{pose:'row',noShadow:true}),true);T('tortue',8,u,v,30);}
  let CV;{const gu=2440,gv=250;const[u,v]=spotI(gu+60,gv+20,36,24);CV=[u,v];addCave(u,v);addChar(u-44,v+8,as(SBIRE,{pose:'stand'}));T('tortue',9,u,v,36);}
  {const[u,v]=spotI(2420,760,50,40);avoidRect(u-50,v-40,u+80,v+60);const n=6,odd=2;const pts=[];for(let i=0;i<n;i++){const row=i%2,col=Math.floor(i/2);pts.push([u+col*22+row*8,v+row*22]);}
   pts.forEach(([pu,pv],i)=>{if(i===odd)addFakeTurtle(pu,pv);else addBigTurtle(pu,pv);});
   const[x,y]=pr(pts[odd][0],pts[odd][1],0);CASES.find(c=>c.id==='tortue').steps[9].t={x,y:y-12,r:20,u:pts[odd][0],v:pts[odd][1]};avoid(pts[odd][0],pts[odd][1],30);}
  {const pts=[[-80,120],[4,150],[90,118]].map(([a,b])=>{const p=[CV[0]+a*.8,CV[1]+b*.7];addEgg(p[0],p[1]);return[p[0],p[1],0];});
   stepMulti(CASES.find(c=>c.id==='tortue').steps[10],pts,16);}
  {const[u,v]=spotI(2540,950,30,20);addChar(u,v,as(PLUME,{pose:'give',prop:'magnifier'}));addEgg(u+16,v+6);addEgg(u+24,v+12);T('tortue',12,u,v,24);}
  {const[u,v]=spotI(2560,1100,40,16);addBoat(u+36,v+14,1,{len:18});addChar(u,v,as(LEONIE,{pose:'point'}));addChar(u+16,v+6,as(CAPTAUD,{pose:'arms_up'}));T('tortue',13,u+8,v+4,28);}
  {const[u,v]=spotI(2330,420,26,20);addNest(u,v,5);addChar(u-26,v+8,as(TITOU,{pose:'carry'}));addChar(u+30,v+6,as(DOYENNE,{pose:'give'}));addPalm(u+8,v-24);T('tortue',14,u-6,v+6,28);}
  {const[u,v]=spotI(2350,560,34,24);const pts=[[0,0],[16,10],[34,2],[48,14]];pts.forEach(([a,b])=>addBabyTurtle(u+a,v+b));addChar(u-24,v+6,as(DOYENNE,{pose:'stand'}));
   const st=CASES.find(c=>c.id==='tortue').steps[14];const[x,y]=pr(u+24,v+8,0);st.t={x,y:y-10,r:36,u:u+24,v:v+8};avoid(u+24,v+8,40);}
}
