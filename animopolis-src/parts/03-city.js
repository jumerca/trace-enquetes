
const SP=(head,body,fill,hat,pose,prop,flip,extra)=>Object.assign({head,body,fill,hat:hat||'none',pose:pose||'stand',prop:prop||null,flip:!!flip},extra||{});

/* =========================================================
   QUARTIERS
   ========================================================= */
const DISTRICTS=[
  {id:'centre',name:'Le Centre',de:'du Centre',u0:0,v0:0,u1:1180,v1:1180,need:0,sides:[],blocks:[]},
  {id:'port',name:'Le Port',de:'du Port',u0:1180,v0:0,u1:2120,v1:1180,need:2,sides:['v','u'],blocks:[[4,0],[5,0],[4,1],[5,1],[4,2],[5,2]],extra:[[1748,0,1880,1180],[1188,900,1700,1130]]},
  {id:'fete',name:'La Fête foraine',de:'de la Fête foraine',u0:0,v0:1180,u1:1180,v1:2032,need:2,sides:['v','u'],blocks:[[0,4],[1,4],[2,4],[3,4],[0,5],[1,5],[2,5],[3,5],[0,6],[1,6],[2,6],[3,6]]}
];

/* ---------- nouveaux décors ---------- */
const txt=(c,t,x,y,size,col)=>{c.fillStyle=col||INK;c.font=`${size}px "Patrick Hand", cursive`;c.textAlign='center';c.textBaseline='middle';c.fillText(t,x,y);};
function addNotice(u,v,poster){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.4;L(c,x-14,y,x-14,y-40);L(c,x+14,y,x+14,y-40);c.lineWidth=1.1;Rc(c,x-18,y-46,36,28,'#f3eee2');
  Rc(c,x-15,y-43,11,9,WHITE);Rc(c,x+4,y-42,11,12,WHITE);c.lineWidth=.4;for(let k=0;k<3;k++){L(c,x-13,y-41+k*2.5,x-6,y-41+k*2.5);L(c,x+6,y-40+k*3,x+13,y-40+k*3);}
  if(poster){c.lineWidth=1.2;Rc(c,x-9,y-37,18,20,WHITE);txt(c,'PERDU',x,y-33.5,6.5,RED);c.save();c.translate(x,y-21.5);c.scale(.95,.95);drawHead(c,{head:'cat'},1);c.restore();}},{ht:52,hw:22});avoid(u,v,14);}
function addMailbox(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.3;L(c,x,y,x,y-14);c.lineWidth=1;Rc(c,x-6,y-30,12,16,'#e6c14a');c.beginPath();c.arc(x,y-30,6,PI,0);c.fillStyle='#e6c14a';c.fill();c.stroke();Rc(c,x-3.5,y-26,7,1.6,INK);txt(c,'LA POSTE',x,y-19,3.6);},{ht:40,hw:10});avoid(u,v,8);}
function addPhone(u,v,who){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;if(who)drawChar(c,x,y-1,who);Rc(c,x-9,y-42,18,42,null);c.fillStyle='rgba(220,230,228,.35)';c.fillRect(x-9,y-36,18,32);Rc(c,x-10,y-46,20,6,RED);txt(c,'TÉLÉPHONE',x,y-43,3.6,WHITE);L(c,x-9,y-20,x+9,y-20);},{ht:50,hw:12});avoid(u,v,12);}
function addSwing(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.3;L(c,x-16,y,x-12,y-30);L(c,x-8,y,x-12,y-30);L(c,x+16,y,x+12,y-30);L(c,x+8,y,x+12,y-30);L(c,x-12,y-30,x+12,y-30);c.lineWidth=.6;for(const sx of[-5,5]){L(c,x+sx-2,y-30,x+sx-2,y-10);L(c,x+sx+2,y-30,x+sx+2,y-10);Rc(c,x+sx-3,y-10,6,1.6,WHITE);}},{ht:34,hw:20});avoid(u,v,16);}
function addSlide(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;L(c,x-10,y,x-10,y-24);L(c,x-4,y,x-4,y-24);c.lineWidth=.7;for(let k=4;k<24;k+=4)L(c,x-10,y-k,x-4,y-k);c.lineWidth=1.2;c.beginPath();c.moveTo(x-4,y-24);c.quadraticCurveTo(x+6,y-20,x+14,y-2);c.lineTo(x+16,y-3);c.quadraticCurveTo(x+8,y-22,x-4,y-27);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();},{ht:30,hw:20});avoid(u,v,14);}
function addBarrel(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;c.beginPath();c.moveTo(x-6,y-1);c.quadraticCurveTo(x-8,y-8,x-6,y-15);c.lineTo(x+6,y-15);c.quadraticCurveTo(x+8,y-8,x+6,y-1);c.closePath();c.fillStyle='#d8c8a4';c.fill();c.stroke();E(c,x,y-15,6,2.4,'#cdbb92');c.lineWidth=.6;L(c,x-7,y-5,x+7,y-5);L(c,x-7,y-11,x+7,y-11);},{ht:20,hw:9});avoid(u,v,8);}
function addVan(u,v,label){addBoxItem(u-16,v-8,u+16,v+8,34,c=>{const w=[[u-10,v+8],[u+10,v+8]];for(const[pu,pv]of w){const[x,y]=pr(pu,pv,3);E(c,x,y,3.6,3.6,INK);D(c,x,y,1.3,WHITE);}
  drawBox(c,u-16,v-8,3,32,16,18,WHITE,WHITE,'#ebe6da');c.save();faceV(c,u-16,v+8,21);Rc(c,22,3,8,7,'#eef1f0');txt(c,label||'POLICE',12,10,6);c.fillStyle='#3d6fb8';c.fillRect(0,13,32,2);c.restore();const[x,y]=pr(u,v,21);Rc(c,x-3,y-3,6,3,'#3d6fb8');});}
function addTrestleBoat(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;L(c,x-14,y,x-10,y-10);L(c,x-6,y,x-10,y-10);L(c,x+14,y,x+10,y-10);L(c,x+6,y,x+10,y-10);drawBoat(c,x,y-10,1,{len:24,col:'#ebe6da'});c.lineWidth=.6;for(const k of[-8,0,8])L(c,x+k,y-18,x+k+4,y-14);},{ht:36,hw:30});avoid(u,v,22);}
function addLighthouse(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;P(c,[[x-10,y],[x+10,y],[x+6,y-70],[x-6,y-70]],WHITE);c.save();c.beginPath();c.moveTo(x-10,y);c.lineTo(x+10,y);c.lineTo(x+6,y-70);c.lineTo(x-6,y-70);c.closePath();c.clip();for(let k=0;k<4;k++){c.fillStyle=RED;c.fillRect(x-12,y-12-k*18,24,8);}c.restore();P(c,[[x-10,y],[x+10,y],[x+6,y-70],[x-6,y-70]],null);
  Rc(c,x-8,y-74,16,4,WHITE);Rc(c,x-5,y-86,10,12,'#fff3c4');P(c,[[x-7,y-86],[x+7,y-86],[x,y-94]],INK);c.lineWidth=.6;c.setLineDash([2,2]);L(c,x+6,y-80,x+30,y-84);L(c,x-6,y-80,x-30,y-84);c.setLineDash([]);},{ht:100,hw:34});avoid(u,v,14);}
function addGreenhouse(u,v){addBoxItem(u-24,v-12,u+24,v+12,40,c=>{c.globalAlpha=.85;drawBox(c,u-24,v-12,0,48,24,16,'#eef3f2','#eef3f2','#e2ebe9');c.globalAlpha=1;ip(c,[[u-24,v,28],[u+24,v,28],[u+24,v+12,16],[u-24,v+12,16]],'#eef3f2');ip(c,[[u+24,v+12,16],[u+24,v-12,16],[u+24,v,28]],'#e2ebe9');c.lineWidth=.4;for(let k=1;k<6;k++){const a=pr(u-24+k*8,v+12,0),b=pr(u-24+k*8,v+12,16);L(c,a[0],a[1],b[0],b[1]);}});}
function addScarecrow(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.3;L(c,x,y,x,y-30);L(c,x-12,y-24,x+12,y-24);c.lineWidth=1;P(c,[[x-6,y-26],[x+6,y-26],[x+7,y-12],[x-7,y-12]],'#d9cfae');C(c,x,y-31,4.6,'#efe3b0');E(c,x,y-35,7,1.6,'#efe6c8');D(c,-1.6+x,y-31,.6);D(c,1.6+x,y-31,.6);},{ht:42,hw:14});avoid(u,v,10);}
function addClothesline(u,v,sheet){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;L(c,x-22,y,x-22,y-30);L(c,x+22,y+4,x+22,y-26);c.lineWidth=.5;c.beginPath();c.moveTo(x-22,y-28);c.quadraticCurveTo(x,y-22,x+22,y-24);c.stroke();c.lineWidth=.9;
  if(sheet){c.beginPath();c.moveTo(x-14,y-25.5);c.lineTo(x+8,y-24.6);c.lineTo(x+8,y-6);for(let k=0;k<4;k++)c.quadraticCurveTo(x+5-k*5.5,y-9,x+2.5-k*5.5,y-6);c.lineTo(x-14,y-6);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();E(c,x-6,y-19,1.2,1.8,INK);E(c,x,y-19,1.2,1.8,INK);}
  else{Rc(c,x-12,y-25,6,8,WHITE);Rc(c,x+2,y-24,7,10,'#c9c2b2');}},{ht:36,hw:26});avoid(u,v,16);}
function addCaravan(u,v,ax){addBoxItem(u-18,v-9,u+18,v+9,34,c=>{for(const pu of[u-8,u+8]){const[x,y]=pr(pu,v+9,3);E(c,x,y,3.4,3.4,INK);}drawBox(c,u-18,v-9,4,36,18,18,WHITE,WHITE,'#ebe6da');c.save();faceV(c,u-18,v+9,22);Rc(c,4,4,9,7,'#eef1f0');Rc(c,22,3,8,14,'#cfc9bc');c.fillStyle='#c9c2b2';c.fillRect(0,12,36,2);c.restore();});}
function addFoodTruck(u,v,name){addBoxItem(u-20,v-9,u+20,v+9,40,c=>{for(const pu of[u-12,u+12]){const[x,y]=pr(pu,v+9,3);E(c,x,y,3.6,3.6,INK);}drawBox(c,u-20,v-9,4,40,18,22,WHITE,WHITE,'#ebe6da');c.save();faceV(c,u-20,v+9,26);Rc(c,6,6,22,8,'#3a3733');c.save();c.beginPath();c.rect(4,2,26,4);c.fillStyle=WHITE;c.fill();c.clip();stripesIn(c,4,2,30,6,5,2.5,true,RED);c.restore();c.strokeRect(4,2,26,4);txt(c,name,20,18,5.6);c.restore();});}
function addFlag(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;L(c,x,y,x,y-30);P(c,[[x,y-30],[x+10,y-27],[x,y-24]],pick([RED,WHITE,'#e6c14a']));},{ht:34,hw:12});}
/* fête foraine */
function addArch(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.3;for(const s of[-1,1]){Rc(c,x+s*46-5,y-56,10,56,WHITE);c.lineWidth=.5;for(let k=6;k<56;k+=8)L(c,x+s*46-5,y-k,x+s*46+5,y-k);c.lineWidth=1.3;P(c,[[x+s*46-7,y-56],[x+s*46+7,y-56],[x+s*46,y-66]],RED);}
  c.beginPath();c.moveTo(x-46,y-50);c.quadraticCurveTo(x,y-86,x+46,y-50);c.lineTo(x+46,y-38);c.quadraticCurveTo(x,y-72,x-46,y-38);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();
  for(let k=0;k<=12;k++){const t=k/12,bx=x-46+92*t,by=y-50-36*4*t*(1-t)+2;D(c,bx,by-1,1,'#e6c14a');}
  c.save();c.translate(x,y-58);txt(c,'FÊTE FORAINE',0,0,11);c.restore();},{ht:92,hw:56});avoidRect(u-14,v-14,u+14,v+14);}
function addCarousel(u,v,extra){{const[X,Y]=pr(u,v,0);addMover([X-62,Y-110,X+62,Y-40],(c,t)=>{for(let k=0;k<12;k++){D(c,X-55+k*10,Y-53,1.5,(Math.floor(t*2)+k)%2?'#e6c14a':RED);}c.strokeStyle=INK;c.lineWidth=1;const w=Math.sin(t*3)*2;P(c,[[X,Y-104],[X+8,Y-102+w],[X,Y-99]],'#e6c14a');});}addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;E(c,x,y+4,52,24,'#e9e4d8');c.fillStyle='#e9e4d8';c.fillRect(x-52,y-2,104,6);E(c,x,y-2,52,24,WHITE);
  const horses=[];for(let k=0;k<8;k++){const a=k/8*TAU+.3;horses.push([x+Math.cos(a)*38,y-2+Math.sin(a)*17,a]);}horses.sort((a,b)=>a[1]-b[1]);
  Rc(c,x-6,y-58,12,56,WHITE);
  for(const[hx,hy]of horses){c.lineWidth=.9;L(c,hx,hy,hx,y-58+Math.abs(hx-x)*.25);c.lineWidth=1;E(c,hx,hy-12,7,3.4,WHITE);C(c,hx+5,hy-16,2.6,WHITE);L(c,hx-4,hy-9,hx-5,hy-4);L(c,hx+4,hy-9,hx+5,hy-4);}
  if(extra)extra(c,x,y);
  c.beginPath();c.moveTo(x-58,y-58);c.lineTo(x,y-92);c.lineTo(x+58,y-58);c.quadraticCurveTo(x,y-46,x-58,y-58);c.closePath();c.fillStyle=WHITE;c.fill();c.save();c.clip();for(let k=-6;k<=6;k+=2){c.beginPath();c.moveTo(x,y-92);c.lineTo(x+k*10,y-50);c.lineTo(x+(k+1)*10,y-50);c.closePath();c.fillStyle=RED;c.fill();}c.restore();c.stroke();
  c.beginPath();for(let k=0;k<12;k++)c.arc(x-55+k*10,y-56+Math.abs(k-5.5)*-.0,5,0,PI);c.fillStyle=WHITE;c.fill();c.stroke();L(c,x,y-92,x,y-100);P(c,[[x,y-104],[x+7,y-102],[x,y-99]],'#e6c14a');},{ht:108,hw:62,lo:30});avoidRect(u-50,v-50,u+50,v+50);}
const wheelA=()=>animT()*.1;
function addWheel(u,v,owl){const[X,Y]=pr(u,v,0),CY=Y-96,R0=78;
  addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.6;L(c,x-30,y,x,CY);L(c,x+30,y,x,CY);L(c,x-36,y,x+36,y);c.lineWidth=1;Rc(c,x-14,y-10,28,10,WHITE);txt(c,'GRANDE ROUE',x,y-5,5.6);},{ht:190,hw:90});
  addMover([X-90,CY-90,X+90,CY+100],(c,t)=>{const A=wheelA();c.strokeStyle=INK;c.lineWidth=1;C(c,X,CY,R0,null);C(c,X,CY,R0-5,null);
    for(let k=0;k<12;k++){const a=k/12*TAU+A;L(c,X,CY,X+Math.cos(a)*R0,CY+Math.sin(a)*R0);}C(c,X,CY,7,WHITE);
    for(let k=0;k<12;k++){const a=k/12*TAU+A,gx=X+Math.cos(a)*R0,gy=CY+Math.sin(a)*R0;L(c,gx,gy,gx,gy+4);P(c,[[gx-6,gy+4],[gx+6,gy+4],[gx+5,gy+14],[gx-5,gy+14]],k%3?WHITE:'#e9e4d8');
      if(owl&&k===10){c.save();c.translate(gx,gy+12);c.scale(.62,.62);drawHead(c,{head:'owl',hat:'straw'},1);c.restore();}
      else if(k%2===0){c.save();c.translate(gx,gy+12);c.scale(.5,.5);drawHead(c,{head:HEADS[(k*7)%HEADS.length]},1);c.restore();}}});
  avoidRect(u-40,v-30,u+40,v+30);
  return{get x(){return X+Math.cos(10/12*TAU+wheelA())*R0;},get y(){return CY+Math.sin(10/12*TAU+wheelA())*R0+9;},r:20};}
function addCoaster(u0,v0,u1,v1,extra){const pts=[];const n=40;for(let k=0;k<=n;k++){const t=k/n;const u=u0+(u1-u0)*t,v=v0+(v1-v0)*(.5+.5*Math.sin(t*TAU*1.2));const z=26+34*Math.abs(Math.sin(t*PI*2.5))+(t<.2?40*(1-t/.2):0);pts.push([u,v,z]);}
  const it=addBoxItem(u0,Math.min(v0,v1),u1,Math.max(v0,v1),110,c=>{c.strokeStyle=INK;c.lineWidth=.8;for(let k=0;k<=n;k+=2){const[u,v,z]=pts[k];const a=pr(u,v,0),b=pr(u,v,z);L(c,a[0],a[1],b[0],b[1]);L(c,a[0]-4,a[1],b[0],b[1]);}
    for(const off of[0,4]){c.beginPath();pts.forEach(([u,v,z],k)=>{const p=pr(u,v+off,z);k?c.lineTo(...p):c.moveTo(...p);});c.lineWidth=1.6;c.stroke();}
    c.lineWidth=.5;for(let k=0;k<n;k++){const[u,v,z]=pts[k];const a=pr(u,v,z),b=pr(u,v+4,z);L(c,a[0],a[1],b[0],b[1]);}
    for(const k of[9,10]){const[u,v,z]=pts[k];const[x,y]=pr(u,v+2,z);Rc(c,x-7,y-8,14,7,RED);c.save();c.translate(x-2,y-8);c.scale(.6,.6);drawHead(c,{head:HEADS[k]},1);c.restore();}
    if(extra)extra(c,pts);});it.fp=[u0,Math.min(v0,v1),u1,Math.min(v0,v1)+4];it.key=u0+Math.min(v0,v1);return pts;}
function addBumper(u,v,extra){addBoxItem(u-50,v-40,u+50,v+40,30,c=>{c.strokeStyle=INK;c.lineWidth=1.1;drawBox(c,u-50,v-40,0,100,80,4,'#ece7db','#d6d0c2','#c9c2b2');c.lineWidth=.4;c.setLineDash([3,3]);for(let k=-30;k<=30;k+=15){const a=pr(u+k,v-40,4),b=pr(u+k,v+40,4);L(c,a[0],a[1],b[0],b[1]);}c.setLineDash([]);
  const cars=[[-30,-20],[0,-24],[24,6],[-14,18],[30,26]];cars.forEach(([du,dv],k)=>{drawBox(c,u+du-6,v+dv-5,4,12,10,5,k%2?WHITE:'#c9c2b2',k%2?WHITE:'#c9c2b2','#b9b3a6');const[x,y]=pr(u+du,v+dv,9);c.lineWidth=.8;L(c,x,y,x,y-18);if(k!==1){c.save();c.translate(x+1,y-3);drawHead(c,{head:HEADS[(k*3+2)%HEADS.length]},1);c.restore();}});
  if(extra)extra(c);c.lineWidth=1;for(const[pu,pv]of[[u-50,v+40],[u+50,v+40],[u+50,v-40]]){const a=pr(pu,pv,4),b=pr(pu,pv,30);L(c,a[0],a[1],b[0],b[1]);}
  c.save();faceV(c,u-50,v+40,34);Rc(c,30,0,40,9,WHITE);txt(c,'AUTOS-TAMPONNEUSES',50,4.6,5.6);c.restore();});}
function addTent(u,v,extra){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.moveTo(x-70,y);c.lineTo(x-64,y-34);c.lineTo(x+64,y-34);c.lineTo(x+70,y);c.quadraticCurveTo(x,y+16,x-70,y);c.closePath();c.fillStyle=WHITE;c.fill();c.save();c.clip();for(let k=-7;k<7;k+=2){c.fillStyle=RED;c.fillRect(x+k*10,y-40,10,60);}c.restore();c.stroke();
  Rc(c,x-10,y-28,20,30,'#3a3733');c.beginPath();c.moveTo(x-66,y-34);c.lineTo(x,y-100);c.lineTo(x+66,y-34);c.quadraticCurveTo(x,y-20,x-66,y-34);c.closePath();c.fillStyle=WHITE;c.fill();c.save();c.clip();for(let k=-7;k<7;k+=2){c.beginPath();c.moveTo(x,y-100);c.lineTo(x+k*10,y-26);c.lineTo(x+(k+1)*10,y-26);c.closePath();c.fillStyle=RED;c.fill();}c.restore();c.stroke();
  L(c,x,y-100,x,y-114);P(c,[[x,y-118],[x+10,y-115],[x,y-112]],'#e6c14a');Rc(c,x-22,y-50,44,10,WHITE);txt(c,'CIRQUE',x,y-45,8);if(extra)extra(c,x,y);},{ht:122,hw:74,lo:16});avoidRect(u-56,v-56,u+56,v+56);}
function addHedge(u0,v0,u1,v1){addBoxItem(u0,v0,u1,v1,14,c=>{drawBox(c,u0,v0,0,u1-u0,v1-v0,10,'#d4d6c0','#c3c7ad','#b5b99e');});}
function addSwan(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-12,y-8],[x+10,y-8],[x+8,y],[x-10,y]],WHITE);c.beginPath();c.moveTo(x+8,y-8);c.quadraticCurveTo(x+16,y-16,x+12,y-24);c.lineWidth=2.4;c.stroke();c.lineWidth=1.2;c.strokeStyle=WHITE;c.stroke();c.strokeStyle=INK;P(c,[[x+12,y-24],[x+16,y-23],[x+12,y-22]],'#e6c14a');c.save();c.translate(x-2,y-10);c.scale(.7,.7);drawHead(c,{head:pick(HEADS)},1);c.restore();},{ht:30,hw:16});}
function addBalloonSeller(u,v,who){addSpr(u,v,(c,x,y)=>{const bs=[[-8,-50,WHITE],[0,-56,'#e6c14a'],[8,-50,WHITE],[-4,-44,'#c9c2b2'],[5,-42,WHITE]];c.strokeStyle=INK;c.lineWidth=.4;for(const[bx,by]of bs)L(c,x+6,y-16,x+bx+6,y+by+5);c.lineWidth=.9;for(const[bx,by,f]of bs)E(c,x+bx+6,y+by,4.4,5.4,f);drawChar(c,x,y,who);},{ht:66,hw:20});}

/* =========================================================
   PERSONNAGES DES ENQUÊTES
   ========================================================= */
const KIT=SP('cat','shirt','grey','none','stand',null,false,{scale:.78,bell:true});
const PIQ=SP('hedgehog','dress','check','straw',null,null,false,{build:'old'}),GROIN=SP('pig','chef','white','chef',null,null,false,{build:'round'}),LAPIN=SP('rabbit','shirt','stripes',null,null,null,false,{build:'small'});
const MOUST=SP('cat','suit','black',null,null,null,false,{build:'slim'}),TRUFFE=SP('pig','dress','white','flower',null,null,false,{build:'round'}),TROTT=SP('mouse','suit','white','cap','stand','bag');
const MIAOU=SP('cat','dress','dots','bow'),RENARD=SP('fox','coat','black','cap',null,null,false,{build:'slim'}),RENARD2=SP('fox','suit','stripes','top',null,null,false,{build:'slim'}),HULOTTE=SP('owl','suit','grey','beret',null,null,false,{build:'round'}),PATAUD=SP('dog','suit','black',null,null,null,false,{build:'old'}),LEONIE=SP('lion','suit','white','police',null,null,false,{build:'tall'}),BROC=SP('croc','suit','check',null,null,null,false,{build:'round'});
const ECAILLE=SP('croc','coat','white','cap',null,null,false,{build:'round'}),MATOU=SP('cat','shirt','stripes',null,null,null,false,{build:'slim'});
const PLOUF=SP('penguin','coat','black','captain',null,null,false,{build:'old'}),MOUSSE=SP('mouse','shirt','white','bandana',null,null,false,{build:'small'});
const OURS1=SP('bear','coat','grey','glasses',null,null,false,{build:'round'}),OURS2=SP('bear','coat','black','mask',null,null,false,{build:'round'}),OURS3=SP('bear','suit','stripes','top',null,null,false,{build:'round'}),CANARD=SP('duck','coat','black','cap',null,null,false,{build:'slim'}),CANARD2=SP('duck','shirt','dots','straw',null,null,false,{build:'slim'}),TOUTOU=SP('dog','suit','grey','police',null,null,false,{build:'tall'});
const NOIS=SP('mouse','dress','dots','bow','stand','redballoon',false,{scale:.8,build:'small'}),MAMAN=SP('mouse','dress','white','straw'),CLOWN=SP('dog','suit','check','clown',null,null,false,{build:'round'}),DIRO=SP('lion','suit','black','top',null,null,false,{build:'tall'}),FORAIN=SP('croc','shirt','check','cap',null,null,false,{build:'slim'});
const GHOST={head:'ghost'};
const as=(s,o)=>Object.assign({},s,o);

/* =========================================================
   LES ENQUÊTES
   ========================================================= */
const CASES=[
 /* ---------------- LE CENTRE ---------------- */
 {id:'chaton',dist:0,title:'Le chaton fugueur',diff:1,card:[150,150],
  intro:"Madame Piquante, la hérissonne au chapeau de paille, a perdu Pompon, son chaton gris à clochette rouge. Pompon adore faire des bêtises…",
  cast:[{n:'Madame Piquante',r:'hérissonne, robe à carreaux',s:PIQ},{n:'Pompon',r:'chaton gris, clochette rouge',s:KIT}],
  steps:[
   {w:0,q:"Madame Piquante affiche un avis de recherche sur un grand panneau. Trouve-la.",ok:"« PERDU : chaton gris, clochette rouge. » Un marchand dit avoir vu Pompon au marché…"},
   {w:1,q:"Pompon a fait une bêtise sur la Place du Marché. Laquelle ?",ok:"Il a chipé un poisson à l'étal du crocodile poissonnier !"},
   {w:1,q:"Avec son poisson, Pompon se fait poursuivre. Par qui ?",ok:"Un gros chien le course dans la Rue du Four !"},
   {w:1,q:"Pour échapper au chien, Pompon s'est réfugié très haut. Où ?",ok:"Dans un arbre du Jardin des Tilleuls ! Le chien aboie en bas."},
   {w:0,q:"Pompon est enfin redescendu. Trouve les retrouvailles.",ok:"Madame Piquante serre Pompon dans ses bras, sur la Place de la Chapelle."}],
  outro:"Pompon a été privé de poisson pendant une semaine. Enfin… presque. Enquête classée !"},
 {id:'gateau',dist:0,title:'Le gâteau envolé',diff:1,card:[420,450],
  intro:"Grand jour : Maître Groin, le pâtissier, présente son gâteau à étages au concours de la ville. Mais un gourmand en marinière rôde…",
  cast:[{n:'Maître Groin',r:'cochon pâtissier',s:GROIN},{n:'Lapinou',r:'lapin en marinière',s:LAPIN}],
  steps:[
   {w:0,q:"Maître Groin sort de sa pâtisserie avec son gâteau. Trouve-le.",ok:"Il porte fièrement son gâteau à étages vers la Place du Théâtre."},
   {w:0,q:"Sur la Place du Théâtre, le gâteau a disparu de la table du concours. Trouve la table.",ok:"Le plat est vide et le jury est sous le choc !"},
   {w:1,q:"Le voleur s'enfuit avec le gâteau. Trouve-le.",ok:"Lapinou court dans le Parc du Lac, le gâteau dans les pattes !"},
   {w:1,q:"En courant, Lapinou a fait tomber un morceau. Qui se régale ?",ok:"Des canards picorent une part de gâteau au bord du lac."},
   {w:1,q:"Où Lapinou finit-il le gâteau ?",ok:"Sur un banc de la Place de la Chapelle, le ventre tout rond."}],
  outro:"Lapinou aidera Maître Groin en cuisine tout l'été. Enquête classée !"},
 {id:'lettre',dist:0,title:"La lettre d'amour",diff:2,card:[760,200],
  intro:"Monsieur Moustache, un chat timide en costume noir, est amoureux de Mademoiselle Truffe. Il lui écrit enfin une lettre… mais rien ne se passe comme prévu.",
  cast:[{n:'Monsieur Moustache',r:'chat en costume noir',s:MOUST},{n:'Mademoiselle Truffe',r:'cochonne à la fleur',s:TRUFFE},{n:'Trottinette',r:'souris factrice',s:TROTT}],
  steps:[
   {w:0,q:"Monsieur Moustache écrit sa lettre à la terrasse d'un café. Trouve-le.",ok:"Au Café Plume, il écrit en rougissant."},
   {w:0,q:"Il poste sa lettre. Où ?",ok:"Dans la boîte aux lettres jaune, près du Barbier."},
   {w:2,q:"Trottinette fait sa tournée à vélo. Trouve-la.",ok:"Elle pédale devant l'École, sa sacoche pleine."},
   {w:2,q:"Patatras ! Trottinette tombe. Où ?",ok:"Devant le Garage : les lettres volent partout."},
   {w:null,q:"La lettre au cœur rouge s'envole… avec quelqu'un. Trouve-la dans le ciel.",ok:"Un pigeon l'a attrapée au vol !"},
   {w:null,q:"Où le pigeon se pose-t-il ?",ok:"Au sommet de la fontaine de la Place du Théâtre, la lettre dans le bec."},
   {w:1,q:"Mademoiselle Truffe trouve la lettre. Où la lit-elle ?",ok:"Sur la Place de la Chapelle, entourée de petits cœurs."},
   {w:1,q:"Elle veut répondre avec un cadeau. Que fait-elle ?",ok:"Elle achète une rose chez la Fleuriste."},
   {w:0,q:"Trouve le rendez-vous des amoureux.",ok:"Sur un banc du Parc du Lac, Monsieur Moustache reçoit sa rose."}],
  outro:"Mariage prévu au printemps. Le pigeon sera garçon d'honneur. Enquête classée !"},
 {id:'collier',dist:0,title:'Le collier de la Comtesse',diff:3,card:[700,130],
  intro:"La Comtesse Miaou possède le plus beau bijou de la ville : le Saphir des Neiges. Le Renard Noir, cambrioleur bien connu, vient d'arriver en ville…",
  cast:[{n:'Comtesse Miaou',r:'chatte, robe à pois',s:MIAOU},{n:'Le Renard Noir',r:'manteau noir, casquette',s:RENARD},{n:'Monsieur Hulotte',r:'hibou au béret',s:HULOTTE},{n:'Pataud',r:'majordome',s:PATAUD},{n:'Inspectrice Léonie',r:'police',s:LEONIE}],
  steps:[
   {w:0,q:"La Comtesse admire son collier dans son jardin. Trouve-la.",ok:"Elle fait briller le saphir au soleil, devant sa villa."},
   {w:1,q:"Quelqu'un l'espionne. Trouve le Renard Noir.",ok:"Caché derrière un arbre du Jardin des Tilleuls, avec des jumelles !"},
   {w:1,q:"Le renard prépare son coup. Que va-t-il acheter ?",ok:"Une échelle, à la Quincaillerie."},
   {w:1,q:"Le cambriolage ! Trouve le renard en pleine action.",ok:"Il grimpe à l'échelle, contre la façade de la villa."},
   {w:0,q:"La Comtesse découvre le vol. Trouve-la.",ok:"Devant sa porte, elle hurle ; son majordome n'a rien vu."},
   {w:3,q:"Le majordome appelle la police. D'où ?",ok:"D'une cabine téléphonique rouge, Rue des Arts."},
   {w:1,q:"Le renard remet le collier à un complice. Où ?",ok:"Dans une ruelle étroite, à côté du Barbier."},
   {w:2,q:"Monsieur Hulotte essaie de vendre le bijou. Où ?",ok:"À la Brocante : le crocodile brocanteur lui tend des billets."},
   {w:2,q:"Hulotte partage l'argent avec le renard. Où ?",ok:"Devant le Cinéma, en faisant semblant de lire l'affiche."},
   {w:4,q:"L'Inspectrice Léonie a trouvé un indice. Lequel ?",ok:"L'échelle, abandonnée dans l'herbe du Jardin des Tilleuls. Elle l'examine à la loupe."},
   {w:1,q:"Le renard change de look. Trouve-le.",ok:"Il sort du magasin Mode Chic en costume rayé et haut-de-forme !"},
   {w:1,q:"Déguisé, le renard veut quitter la ville. Où attend-il ?",ok:"À l'arrêt de bus, valise à la main."},
   {w:2,q:"Hulotte prend la fuite. Trouve-le.",ok:"Il court dans les Jardins familiaux, poursuivi par un policier."},
   {w:1,q:"Où le Renard Noir est-il arrêté ?",ok:"À la Gare routière, au moment de monter dans le car. Léonie l'attendait !"},
   {w:0,q:"La Comtesse récupère son collier. Où ?",ok:"Devant le Commissariat, des mains de l'Inspectrice Léonie."}],
  outro:"Le Renard Noir et Hulotte passeront quelques années à l'ombre. La Comtesse a offert une médaille au majordome… pour la forme. Enquête classée !"},

 /* ---------------- LE PORT ---------------- */
 {id:'poisson',dist:1,title:"Le poisson d'or",diff:1,card:[1260,160],
  intro:"Monsieur Écaille, le crocodile pêcheur, a attrapé un poisson d'or, pêché une fois tous les cent ans. Matou, le chat de gouttière en marinière, a les yeux qui brillent…",
  cast:[{n:'Monsieur Écaille',r:'crocodile pêcheur',s:ECAILLE},{n:'Matou',r:'chat en marinière',s:MATOU}],
  steps:[
   {w:0,q:"Trouve Monsieur Écaille au moment où il pêche le poisson d'or.",ok:"Dans sa barque, au milieu du bassin, il brandit le poisson doré !"},
   {w:1,q:"Le poisson est exposé au Marché aux poissons. Qui le surveille en cachette ?",ok:"Matou, caché derrière des caisses, se lèche les babines."},
   {w:1,q:"Le vol ! Trouve Matou en pleine fuite.",ok:"Il court sur le quai, le poisson d'or dans les pattes."},
   {w:0,q:"Écaille mène l'enquête. Qui interroge-t-il ?",ok:"Au Square des Mouettes, un canard lui montre la direction de la plage."},
   {w:1,q:"Pour qui Matou a-t-il volé ce poisson ?",ok:"Sous une barque retournée sur la plage, il partage le poisson avec trois chatons."}],
  outro:"Écaille a eu pitié : les chatons auront du poisson tous les vendredis. Enquête classée !"},
 {id:'tresor',dist:1,title:'La carte au trésor',diff:2,card:[1560,420],
  intro:"Le capitaine Plouf, vieux manchot de mer, possède la carte au trésor de son arrière-grand-père. Une petite souris à bandana a l'oreille qui traîne…",
  cast:[{n:'Capitaine Plouf',r:'manchot, casquette de capitaine',s:PLOUF},{n:'Mousse Bandana',r:'souris pirate',s:MOUSSE}],
  steps:[
   {w:0,q:"Le capitaine montre sa carte à ses amis. Où ?",ok:"À la terrasse du restaurant Le Homard, la carte grande ouverte."},
   {w:1,q:"Quelqu'un écoute en cachette. Trouve-la.",ok:"Mousse Bandana, cachée derrière un tonneau !"},
   {w:0,q:"Après le repas, le capitaine fait la sieste. Où ?",ok:"Sur un banc du Square des Mouettes. La carte dépasse de sa poche…"},
   {w:1,q:"Mousse Bandana s'enfuit avec la carte. Trouve-la.",ok:"Elle court devant l'Hôtel de la Plage, la carte à la main."},
   {w:1,q:"Elle étudie la carte en cachette. Où ?",ok:"Dans une barque au milieu du bassin."},
   {w:1,q:"Elle s'équipe pour creuser. Où ?",ok:"Elle sort de la Quincaillerie du Port avec une pelle."},
   {w:1,q:"Elle cherche l'île du trésor à la longue-vue. Où ?",ok:"Au pied du phare, au bout de la jetée."},
   {w:0,q:"Le capitaine découvre que sa carte a disparu. Trouve-le.",ok:"Devant la Capitainerie, il bat des ailes de colère."},
   {w:1,q:"Où est le trésor ?",ok:"Sur la plage, à la croix rouge : elle déterre un vieux coffre !"},
   {w:0,q:"Comment l'histoire se termine-t-elle ?",ok:"Plouf et Mousse partagent… une médaille en chocolat, près du marchand de glaces."}],
  outro:"Le coffre ne contenait qu'une médaille en chocolat. Plouf a engagé Mousse comme matelot. Enquête classée !"},
 {id:'banque',dist:1,title:'Le casse de la Banque',diff:3,card:[1560,130],
  intro:"Un ours très malin prépare le casse de la Banque du Port. Il change sans cesse de déguisement, et son complice canard n'est jamais loin…",
  cast:[{n:"L'Ours (1er déguisement)",r:'manteau gris, lunettes',s:OURS1},{n:"L'Ours (2e déguisement)",r:'tout en noir, masqué',s:OURS2},{n:"L'Ours (3e déguisement)",r:'costume rayé, haut-de-forme',s:OURS3},{n:'Le Canard',r:'chauffeur en noir',s:CANARD},{n:'Brigadier Toutou',r:'garde de la banque',s:TOUTOU},{n:'Inspectrice Léonie',r:'police',s:LEONIE}],
  steps:[
   {w:0,q:"L'ours repère la banque en faisant semblant de lire. Trouve-le.",ok:"Sur un banc face à la banque, en manteau gris et lunettes, caché derrière son journal."},
   {w:3,q:"Il retrouve son complice. Où ?",ok:"Au Chantier naval, à côté d'une voiture noire. Le canard montre le plan de la banque."},
   {w:1,q:"Le braquage ! Trouve la banque au moment du vol.",ok:"Le brigadier Toutou est au tapis et l'ours masqué s'enfuit avec un sac de billets."},
   {w:3,q:"Le canard attend au volant. Où ?",ok:"Dans la voiture noire, garée près de la banque, moteur allumé."},
   {w:3,q:"La voiture file trop vite. Que s'est-il passé ?",ok:"Elle a percuté les caisses du Marché aux poissons !"},
   {w:1,q:"Les deux bandits continuent à pied. Trouve-les.",ok:"Ils traversent le Chantier naval en courant, chacun avec un sac."},
   {w:2,q:"L'ours change encore de tenue. Où ?",ok:"Près de la Laverie : en costume rayé, il jette son costume noir à la poubelle."},
   {w:3,q:"Le canard se déguise en touriste et dépense déjà. Où ?",ok:"À la Bijouterie Marine, en chemise à pois et chapeau de paille : il achète une montre en or."},
   {w:2,q:"L'ours cache sa part du butin. Où ?",ok:"Au Square des Mouettes, il enterre son sac au pied d'un arbre."},
   {w:4,q:"Le brigadier Toutou se réveille et donne l'alerte. Trouve-le.",ok:"Devant la Capitainerie, un pansement sur la tête, il raconte tout à l'Inspectrice Léonie."},
   {w:null,q:"Un témoin a tout photographié. Trouve-le.",ok:"Une grenouille photographe, devant l'Hôtel de la Plage, montre son appareil."},
   {w:3,q:"Le canard se croit tranquille. Où est-il ?",ok:"Allongé sur la plage, sa montre en or au poignet."},
   {w:2,q:"L'ours prend la mer. Trouve-le.",ok:"Il rame en douce vers le large."},
   {w:5,q:"Qui le poursuit ?",ok:"Le bateau des gardes-côtes, avec l'Inspectrice Léonie à bord !"},
   {w:null,q:"Où les deux bandits finissent-ils ?",ok:"Dans le fourgon de police, devant la Criée."}],
  outro:"Le butin a été rendu à la banque. Toutou a reçu une médaille… et une bonne poche de glace. Enquête classée !"},

 /* ---------------- LA FÊTE FORAINE ---------------- */
 {id:'ballon',dist:2,title:'Le ballon rouge',diff:1,card:[150,1260],
  intro:"Noisette, une petite souris à nœud, vient d'arriver à la fête foraine avec sa maman. Elle rêve d'un ballon rouge…",
  cast:[{n:'Noisette',r:'petite souris, robe à pois',s:NOIS},{n:'Sa maman',r:'souris au chapeau de paille',s:MAMAN},{n:'Bobo',r:'clown du cirque',s:CLOWN}],
  steps:[
   {w:0,q:"Noisette achète son ballon rouge. Trouve-la.",ok:"Près de l'entrée, chez le vendeur de ballons."},
   {w:0,q:"Elle fait un tour de manège avec son ballon. Lequel ?",ok:"Le carrousel ! Elle est sur un cheval de bois."},
   {w:null,q:"Oh non, le ballon s'est envolé ! Trouve-le dans le ciel.",ok:"Il flotte au-dessus des montagnes russes."},
   {w:0,q:"Noisette a beaucoup de chagrin. Trouve-la.",ok:"Elle pleure près des stands de jeux, consolée par sa maman."},
   {w:2,q:"Qui lui rapporte son ballon ?",ok:"Bobo le clown, devant le chapiteau du cirque !"}],
  outro:"Bobo a offert deux places pour le spectacle du soir. Enquête classée !"},
 {id:'fantome',dist:2,title:'Le fantôme de la fête',diff:2,card:[300,1520],
  intro:"Un fantôme sème la panique à la fête foraine ! Monsieur Crinière, le directeur, est désespéré : les visiteurs s'enfuient… et la caisse se vide.",
  cast:[{n:'Le fantôme',r:'un drap blanc… avec des pieds',s:GHOST},{n:'Monsieur Crinière',r:'directeur, haut-de-forme',s:DIRO},{n:'Crocus',r:'forain à casquette',s:FORAIN}],
  steps:[
   {w:null,q:"Panique à la sortie du Train fantôme ! Trouve la scène.",ok:"Les visiteurs détalent en hurlant."},
   {w:0,q:"Trouve le fantôme.",ok:"Il danse sur le toit du Train fantôme !"},
   {w:0,q:"Le fantôme fait un tour de manège. Lequel ?",ok:"Les montagnes russes : il lève les bras dans le wagon de tête."},
   {w:0,q:"Il sème la pagaille ailleurs. Où ?",ok:"Aux autos-tamponneuses : il fonce dans tout le monde !"},
   {w:0,q:"Le fantôme a perdu quelque chose. Quoi ?",ok:"Une grosse botte, au pied de la grande roue… une botte à griffes de crocodile !"},
   {w:0,q:"Même les fantômes ont faim. Trouve-le.",ok:"Il achète une barbe à papa au stand de confiseries."},
   {w:0,q:"Il se cache pour souffler. Où ?",ok:"Au milieu du labyrinthe de haies."},
   {w:null,q:"Le drap blanc sèche quelque part. Où ?",ok:"Sur un fil à linge, derrière les caravanes des forains."},
   {w:2,q:"Trouve le vrai coupable.",ok:"Crocus le forain compte des billets devant sa caravane, une seule botte au pied !"},
   {w:1,q:"Comment l'affaire se termine-t-elle ?",ok:"Crocus rend l'argent à Monsieur Crinière devant la billetterie."}],
  outro:"Crocus voulait faire fuir les visiteurs vers son propre stand. Il nettoiera les manèges tout l'hiver. Enquête classée !"}
];
function setT(cid,n,u,v,r,z){const[x,y]=pr(u,v,z||0);CASES.find(c=>c.id===cid).steps[n-1].t={x,y:y-14,r,u,v,z:z||0};avoid(u,v,r+30);}
function setTxy(cid,n,x,y,r){CASES.find(c=>c.id===cid).steps[n-1].t={x,y,r};}
const fr=(b,a,o)=>b.front==='v'?[b.u0+(b.u1-b.u0)*a,b.v1+(o??14)]:[b.u1+(o??14),b.v0+(b.v1-b.v0)*a];

/* =========================================================
   CONSTRUCTION DE LA VILLE
   ========================================================= */
function districtGround(D,streetsU,streetsV,fill){
  G(D.u0,D.v0,D.u1,D.v1,c=>{c.strokeStyle=INK;c.lineWidth=1.2;
    if(D.sides.includes('v'))ip(c,[[D.u0,D.v1,0],[D.u1,D.v1,0],[D.u1,D.v1,-SLAB],[D.u0,D.v1,-SLAB]],'#d9d3c5');
    if(D.sides.includes('u'))ip(c,[[D.u1,D.v1,0],[D.u1,D.v0,0],[D.u1,D.v0,-SLAB],[D.u1,D.v1,-SLAB]],'#c9c2b2');
    rectG(c,D.u0,D.v0,D.u1,D.v1,fill||'#f8f6f0');
    c.lineWidth=.8;c.setLineDash([8,7]);
    for(const[v,a,b]of streetsU){const p=pr(a,v,0),q=pr(b,v,0);L(c,p[0],p[1],q[0],q[1]);}
    for(const[u,a,b]of streetsV){const p=pr(u,a,0),q=pr(u,b,0);L(c,p[0],p[1],q[0],q[1]);}
    c.setLineDash([]);});
}
function blockGround(i,j,fill,noGrid){const k=blk(i,j);G(k.u0,k.v0,k.u1,k.v1,c=>{c.strokeStyle=INK;c.lineWidth=1.1;rectG(c,k.u0,k.v0,k.u1,k.v1,fill||PAPER);
  if(!noGrid){c.strokeStyle='#d6cfbf';c.lineWidth=.5;for(let u=k.u0+20;u<k.u1;u+=20){const p=pr(u,k.v0,0),q=pr(u,k.v1,0);L(c,p[0],p[1],q[0],q[1]);}for(let v=k.v0+20;v<k.v1;v+=20){const p=pr(k.u0,v,0),q=pr(k.u1,v,0);L(c,p[0],p[1],q[0],q[1]);}}});}
function crosswalks(u,v){G(u-34,v-34,u+34,v+34,c=>{for(let k=-16;k<=14;k+=7){gp(c,[[u+k,v-30],[u+k+3.5,v-30],[u+k+3.5,v-24],[u+k,v-24]],INK);gp(c,[[u-30,v+k],[u-24,v+k],[u-24,v+k+3.5],[u-30,v+k+3.5]],INK);}});}
function labelG(u,v,t,s){G(u,v-10,u+160,v+10,c=>groundText(c,u,v,t,s||15));}
function cars(list){for(const[u,v,ax]of list)addCar(u,v,ax,rnd()<.6?{driver:randomSpec()}:{});}

function buildCity(){
  const SL=[22,306,590,874,1158];
  /* ======================= LE CENTRE ======================= */
  CURD=0;const D0=DISTRICTS[0];
  districtGround(D0,SL.filter(v=>v!==590).map(v=>[v,0,1180]),SL.map(u=>[u,0,1180]));
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)if(!(i===1&&j===0)&&!(i===1&&j===2))blockGround(i,j);
  for(const u of[306,590,874])for(const v of[306,874])if(!(u===874&&v===874))crosswalks(u,v);

  // (0,0) Rue du Four
  {const t=townBlock(0,0,[{w:58,sign:'Boulangerie',awn:true},{w:48,sign:'Pharmacie',awn:true,cross:true},{id:'mode',w:60,sign:'Mode Chic',awn:true,awnCol:'#c9b58a',roof:'flat'}],[{w:64,sign:'Hôtel des Pins',roof:'flat',h:70},{}]);
   labelG(t.pu0+10,t.k.v1-14,'Rue du Four');
   // chaton 3 : la poursuite
   addChar(170,150,as(KIT,{pose:'run',prop:'fish'}));addChar(140,158,SP('dog','coat','white','none','run'));
   addSpr(140,158,(c,x,y)=>{txt(c,'OUAF !',x+12,y-44,7);},{top:true,ht:50});setT('chaton',3,158,154,30);
   // collier 11 : sortie de Mode Chic
   {const p=fr(bld.mode,.5,14);addChar(p[0],p[1],as(RENARD2,{pose:'walk',prop:'cane'}));setT('collier',11,p[0],p[1],22);}}
  // (1,0) Jardin des Tilleuls
  {const k=park(1,0,'Jardin des Tilleuls');pathG([[k.u0+6,k.vc],[k.u1-6,k.vc]],14);pathG([[k.uc,k.v0+6],[k.uc,k.v1-6]],14);addKiosk(k.uc,k.vc);
   // chaton 4 : dans l'arbre
   const tu=k.u1-30,tv=k.v0+120;
   addSpr(tu,tv,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;E(c,x,y,9,4.5,'#dcd6c6');P(c,[[x-2.4,y],[x-1.6,y-22],[x+1.6,y-22],[x+2.4,y]],WHITE);c.lineWidth=1.4;L(c,x,y-18,x+14,y-28);
     const bl=[[-10,-34,10],[10,-34,10],[0,-44,11],[-14,-24,8],[14,-24,8],[0,-28,10]];c.lineWidth=2.4;for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}c.fillStyle=WHITE;for(const b of bl){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}
     drawChar(c,x+12,y-26,as(KIT,{pose:'sit',scale:.85}));},{ht:62,hw:28});
   addChar(tu+14,tv+14,SP('dog','coat','white','none','arms_up',null,false,{build:'round'}));setT('chaton',4,tu+6,tv+4,32,14);
   // collier 2 : le renard aux jumelles
   const fu=k.u0+30,fv=k.v0+120;addTree(fu-4,fv-10,1.15);addChar(fu+6,fv+2,as(RENARD,{pose:'lean',prop:'binoculars'}));setT('collier',2,fu+4,fv,26);
   // collier 10 : l'échelle abandonnée
   const lu=k.u0+150,lv=k.v0+40;G(lu-24,lv-10,lu+24,lv+10,c=>{c.save();c.translate(...pr(lu,lv,0));groundT(c);c.strokeStyle=INK;c.lineWidth=1.4;L(c,-22,-4,22,-4);L(c,-22,4,22,4);c.lineWidth=.9;for(let x=-20;x<=20;x+=6)L(c,x,-4,x,4);c.restore();});
   addSpr(lu-6,lv+16,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.5;L(c,x-24,y-8,x+20,y+6);L(c,x-21,y-14,x+23,y);c.lineWidth=1;for(let k=0;k<8;k++){const t=k/7;L(c,x-24+44*t,y-8+14*t,x-21+44*t,y-14+14*t);}},{top:true,ht:20,hw:28});avoid(lu-6,lv+16,18);addChar(lu+14,lv+12,as(LEONIE,{pose:'crouch',prop:'magnifier',flip:true}));setT('collier',10,lu+6,lv+6,28);
   for(let n=0;n<16;n++){const u=R(k.u0+20,k.u1-20),v=R(k.v0+20,k.v1-20);if(Math.abs(u-k.uc)<18||Math.abs(v-k.vc)<18||!free(u,v,10))continue;n%3?addTree(u,v):addBush(u,v,true);}
   addBench(k.uc-40,k.vc-14);addBench(k.uc+44,k.vc+22);areas.push({u0:k.u0+14,v0:k.v0+14,u1:k.u1-14,v1:k.v1-14,n:20,dist:0});}
  // (2,0) Villa de la Comtesse + Café Plume
  {const t=townBlock(2,0,[{id:'villa',w:134,h:66,roof:'gable',villa:true,tone:WHITE,gap:12,ladder:118},{id:'cafe',w:58,sign:'Café Plume',awn:true,awnCol:'#c9b58a',roof:'flat'}],null,{n:14});
   const v=bld.villa,cf=bld.cafe;addFence(v.u0,v.u1,v.v1+44,v.cx-10,v.cx+10);for(const bu of[v.u0+50,v.u1-30])addBush(bu,v.v1+36,true);
   // collier 1 : au jardin
   addChar(v.u0+20,v.v1+22,as(MIAOU,{pose:'carry',prop:'necklace'}));setT('collier',1,v.u0+20,v.v1+22,22);
   // collier 5 : découverte du vol
   addChar(v.cx-4,v.v1+14,as(MIAOU,{pose:'arms_up'}));addChar(v.cx+10,v.v1+16,as(PATAUD,{flip:true,pose:'stand'}));setT('collier',5,v.cx+3,v.v1+15,22);
   // collier 4 : l'échelle
   v.after=c=>{const[x,y]=pr(v.u0+118,v.v1,0);drawChar(c,x,y-34,as(RENARD,{pose:'climb',prop:'necklace'}));};
   {const[x,y]=pr(v.u0+118,v.v1,0);setTxy('collier',4,x,y-50,26);}
   avoidRect(v.u0,v.v1,v.u1,v.v1+46);
   // lettre 1 : la terrasse
   const tu=cf.u0+18,tv=cf.v1+18;addTable(tu+10,tv);addTable(cf.u0+44,cf.v1+34);addParasol(cf.u0+44,cf.v1+30,true);
   addChar(tu,tv,as(MOUST,{pose:'sit',prop:'letter'}));setT('lettre',1,tu+4,tv,22);}
  // (3,0) Rue des Arts
  {const t=townBlock(3,0,[{w:56,sign:'Galerie',awn:true},{w:104,sign:'MUSÉE',cols:true,roof:'gable',h:70},{}],[{w:56,h:50},{}],{n:22});
   labelG(t.pu0+10,t.k.v1-14,'Rue des Arts');
   // collier 6 : la cabine
   const pu=t.pu0+60,pv=t.pv0+50;addPhone(pu,pv,as(PATAUD,{pose:'point',prop:'notepad'}));setT('collier',6,pu,pv,24,8);}
  // (0,1) Place du Marché
  {const k=blk(0,1);labelG(k.u0+12,k.v0+14,'Place du Marché');
   const names=[['Fruits','fruit'],['Légumes','veg'],['Fromages','cheese'],['Fleurs','fruit']];let n=0;
   for(const sv of[k.v0+56,k.v0+120,k.v0+184])for(const su of[k.u0+50,k.u0+120,k.u0+190]){
     if(sv===k.v0+56&&su===k.u0+120){addChar(su-6,sv-14,as(ECAILLE,{pose:'arms_up',hat:'none',fill:'grey'}));addStall(su,sv,'Poissons','fish');
       addChar(su+6,sv+18,as(KIT,{pose:'run',prop:'fish'}));setT('chaton',2,su+2,sv+10,26);continue;}
     const[nm,gd]=names[(n++)%4];addChar(su+R(-8,8),sv-14,randomSpec());addStall(su,sv,nm,gd);}
   for(const[du,dv]of[[20,20],[32,22],[22,34]])addCrate(k.u1-du,k.v1-dv);
   areas.push({u0:k.u0+10,v0:k.v0+24,u1:k.u1-10,v1:k.v1-10,n:30,dist:0});}
  // (1,1) Pâtisserie / Poste / Fleuriste
  {const t=townBlock(1,1,[{id:'patisserie',w:62,sign:'Pâtisserie Groin',awn:true,awnCol:'#d9a3a0',signSize:6.5},{id:'poste',w:58,sign:'POSTE',roof:'flat',awn:true,awnCol:'#d6c48a'},{id:'fleur',w:54,sign:'Fleuriste',awn:true}],[{w:56,sign:'Fromagerie',awn:true},{}],{n:22});
   {const p=fr(bld.patisserie,.5,16);addChar(p[0],p[1],as(GROIN,{pose:'carry',prop:'cake'}));setT('gateau',1,p[0],p[1],22);}
   {const p=fr(bld.fleur,.5,14);addChar(p[0]-6,p[1],as(TRUFFE,{pose:'carry',prop:'flowers'}));addChar(p[0]+10,p[1]-2,SP('rabbit','coat','white','straw','give','flowers',true));setT('lettre',8,p[0]+2,p[1],24);}}
  // (2,1) Barbier / ruelle / Brocante / boîte aux lettres
  {const t=townBlock(2,1,[{w:52,sign:'Barbier',awn:true,gap:30,id:'barbier'},{w:58},{w:56,sign:'Bijouterie',awn:true}],[{id:'brocante',w:58,sign:'Brocante',awn:true,h:52},{}],{n:18});
   const b=bld.barbier,br=bld.brocante,k=t.k;
   G(b.u1,k.v0,b.u1+30,k.v0+DEP,c=>{rectG(c,b.u1,k.v0,b.u1+30,k.v0+DEP,'#d9d3c5');});addBin(b.u1+5,k.v0+8);
   addChar(b.u1+7,k.v0+DEP-3,as(RENARD,{pose:'give',prop:'necklace'}));addChar(b.u1+17,k.v0+DEP-1,as(HULOTTE,{flip:true}));setT('collier',7,b.u1+12,k.v0+DEP-2,22);
   addCrate(br.u1+8,br.v0+8);addChar(br.u1+6,br.cv,as(BROC,{pose:'give',prop:'money'}));addChar(br.u1+20,br.cv+6,as(HULOTTE,{pose:'give',prop:'necklace',flip:true}));setT('collier',8,br.u1+13,br.cv+3,24);
   const mu=k.u0+150,mv=k.v0+110;addMailbox(mu,mv);addChar(mu-10,mv+2,as(MOUST,{pose:'give',prop:'letter'}));setT('lettre',2,mu-5,mv,24);}
  // (3,1) École
  {const t=townBlock(3,1,[{w:120,sign:'ÉCOLE',roof:'gable',h:70},{}],[{w:60,sign:'Gymnase',roof:'flat',h:50},{}],{n:20});
   const k=t.k;addSwing(k.u0+170,k.v0+80);addSlide(k.u0+190,k.v0+140);
   const pu=t.pu0+60,pv=t.pv0+50;addBike(pu,pv,1,TROTT);setT('lettre',3,pu,pv,24,4);}
  // (0,2) Place du Théâtre
  {const t=townBlock(0,2,[{w:40},{id:'theatre',w:122,h:84,sign:'THÉÂTRE',cols:true,roof:'flat',dome:true,dep:52},{w:40}],[{w:52,h:50},{}],{n:24,noTrees:true});
   const k=t.k;
   const fu=k.uc+20,fv=k.vc+10;addFountain(fu,fv);
   addSpr(fu,fv+1,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;const by=y-44;E(c,x,by,5,3,'#cfcac0');C(c,x+5,by-4,2.6,'#cfcac0');D(c,x+6,by-4.4,.5);P(c,[[x+7.4,by-4],[x+10,by-3.4],[x+7.4,by-3]],'#e6c14a');c.save();c.translate(x+11,by-2);c.rotate(.3);Rc(c,-3,-2,6,4,WHITE);D(c,0,0,1,RED);c.restore();},{top:true,ht:60});
   setT('lettre',6,fu,fv,22,30);
   // gâteau 2 : la table du concours
   const ju=t.pu0+30,jv=t.pv0+30;addSpr(ju,jv,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-22,y-12,44,12,WHITE);L(c,x-20,y,x-20,y-12);E(c,x-6,y-14,7,2.2,WHITE);c.lineWidth=.7;L(c,x-6,y-12,x-6,y-17);E(c,x-6,y-17,4,1.2,WHITE);txt(c,'CONCOURS',x,y-6,6);},{ht:20,hw:26});
   avoid(ju+6,jv-4,70);addChar(ju+12,jv-12,SP('owl','suit','black','glasses','arms_up',null,false,{build:'old'}));addChar(ju+26,jv-6,SP('elephant','dress','white','none','arms_up',null,true));setT('gateau',2,ju+6,jv-4,28);
   addTree(k.u1-14,k.v1-14);addTree(k.u0+14,k.v1-12);}
  // (1,2) Parc du Lac
  {const k=park(1,2,'Parc du Lac');const cu=k.uc+10,cv=k.vc-20,ru=80,rv=54;
   G(cu-ru,cv-rv,cu+ru,cv+rv,c=>{c.strokeStyle=INK;c.lineWidth=1.3;const pts=[];for(let a=0;a<TAU;a+=.15)pts.push([cu+Math.cos(a)*ru,cv+Math.sin(a)*rv,0]);ip(c,pts,'#dce4e2');c.lineWidth=.6;for(let n=0;n<12;n++){const[x,y]=pr(cu+Math.cos(n*1.9)*ru*.6*((n%3+1)/3),cv+Math.sin(n*1.9)*rv*.6*((n%3+1)/3),0);c.beginPath();c.arc(x,y,4,PI*1.15,PI*1.85);c.stroke();}});
   const inPond=(u,v,m)=>((u-cu)/(ru+m))**2+((v-cv)/(rv+m))**2<1;
   addBoat(cu-20,cv,1,{len:15,who:SP('mouse','shirt','white','straw'),oar:true});
   pathG([[k.u0+6,k.v1-50],[k.u1-6,k.v1-50]],14);
   // gâteau 3 : Lapinou court
   addChar(k.u0+56,k.v1-50,as(LAPIN,{pose:'run',prop:'cake'}));addSpr(k.u0+56,k.v1-50,(c,x,y)=>{for(let n=0;n<6;n++)D(c,x-14-n*6,y+n*2.4,.7);},{ht:6,hw:50});setT('gateau',3,k.u0+56,k.v1-50,24);
   // gâteau 4 : les canards
   const du=cu+ru+4,dv=cv+20;addSpr(du,dv,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-4,y],[x+4,y],[x+4,y-5],[x-4,y-5]],WHITE);c.lineWidth=.6;L(c,x-4,y-2.5,x+4,y-2.5);D(c,x,y-6,1,RED);
     for(const[dx,dy,f]of[[-12,-2,1],[10,4,-1],[-4,8,1],[14,-6,-1]]){c.save();c.translate(x+dx,y+dy);c.scale(f,1);c.lineWidth=1;E(c,0,-3,5,2.6,WHITE);C(c,4,-7,2.2,WHITE);D(c,4.6,-7.4,.4);P(c,[[6,-7],[8.6,-6],[6,-5.6]],'#e6c14a');c.restore();}},{ht:16,hw:20});setT('gateau',4,du,dv,26);
   // lettre 9 : le banc des amoureux
   const bu=k.u0+150,bv=k.v1-58;addBench(bu,bv,false);addChar(bu-5,bv+.3,as(MOUST,{pose:'sit',prop:'flowers'}));addChar(bu+6,bv+.4,as(TRUFFE,{pose:'sit',flip:true}));
   addSpr(bu,bv,(c,x,y)=>{for(const[dx,dy,s]of[[-6,-36,1],[6,-40,.8],[0,-46,.6]]){c.save();c.translate(x+dx,y+dy);c.scale(s,s);c.fillStyle=RED;c.beginPath();c.moveTo(0,2);c.bezierCurveTo(-4,-1,-2,-4,0,-2);c.bezierCurveTo(2,-4,4,-1,0,2);c.fill();c.restore();}},{top:true,ht:50});setT('lettre',9,bu,bv,24);
   for(let n=0;n<10;n++){const u=R(k.u0+16,k.u1-16),v=R(k.v0+16,k.v1-70);if(inPond(u,v,16)||!free(u,v,10))continue;addTree(u,v);}
   areas.push({u0:k.u0+12,v0:k.v0+12,u1:k.u1-12,v1:k.v1-12,n:18,dist:0,ok:(u,v)=>!inPond(u,v,8)});}
  // (2,2) Mairie / Cinéma / arrêt de bus / panneau
  {const t=townBlock(2,2,[{w:96,sign:'MAIRIE',cols:true,roof:'gable',h:74},{id:'cinema',w:64,sign:'CINÉMA',marquee:true,roof:'flat'}],null,{n:20});
   const k=t.k;
   const nu=t.pu0+30,nv=t.pv0+36;addNotice(nu,nv,true);addChar(nu+16,nv+4,as(PIQ,{pose:'give',flip:true}));setT('chaton',1,nu+8,nv,28,6);
   {const p=fr(bld.cinema,.75,12);addChar(p[0]-6,p[1],as(HULOTTE,{pose:'give',prop:'money'}));addChar(p[0]+8,p[1]+2,as(RENARD,{flip:true}));setT('collier',9,p[0]+1,p[1]+1,22);}
   const su=k.u0+190,sv=k.v0+120;addSpr(su,sv,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.3;L(c,x,y,x,y-36);c.lineWidth=1;Rc(c,x-7,y-44,14,9,WHITE);txt(c,'BUS',x,y-39.5,6);},{ht:48,hw:10});
   addChar(su-12,sv,as(RENARD2,{pose:'stand',prop:'suitcase'}));setT('collier',12,su-8,sv,22);
   // lettre 5 : le pigeon dans le ciel
   addSpr(760,420,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y,7,3.4,'#cfcac0');C(c,x+7,y-3,3,'#cfcac0');D(c,x+8,y-3.6,.6);P(c,[[x+9.6,y-3],[x+13,y-2],[x+9.6,y-1.4]],'#e6c14a');
     c.beginPath();c.moveTo(x-2,y-2);c.quadraticCurveTo(x-8,y-14,x-16,y-12);c.quadraticCurveTo(x-8,y-8,x+2,y-1);c.fillStyle=WHITE;c.fill();c.stroke();
     c.beginPath();c.moveTo(x+1,y-2);c.quadraticCurveTo(x+2,y-16,x-4,y-20);c.quadraticCurveTo(x+4,y-10,x+4,y-1);c.fill();c.stroke();
     c.save();c.translate(x+14,y+1);c.rotate(.2);Rc(c,-4,-2.6,8,5.2,WHITE);D(c,0,0,1.3,RED);c.restore();},{top:true,z:130,ht:30,hw:22});
   {const[x,y]=pr(760,420,130);setTxy('lettre',5,x,y-6,24);}}
  // (3,2) Commissariat / Garage / Quincaillerie
  {const t=townBlock(3,2,[{id:'police',w:84,sign:'COMMISSARIAT',roof:'flat',h:74,signSize:6.5},{id:'garage',w:70,sign:'Garage',bigDoor:true,roof:'flat',h:56}],[{id:'quinc',w:60,sign:'Quincaillerie',awn:true,signSize:6.5},{}],{n:20});
   {const p=fr(bld.quinc,.5,14);addChar(p[0],p[1],as(RENARD,{pose:'carry',prop:'ladder'}));setT('collier',3,p[0],p[1],26);}
   {const p=fr(bld.police,.5,16);addChar(p[0]-6,p[1],as(LEONIE,{pose:'give',prop:'necklace'}));addChar(p[0]+8,p[1]+2,as(MIAOU,{pose:'arms_up',flip:true}));setT('collier',15,p[0]+1,p[1]+1,24);}
   {const p=fr(bld.garage,.5,26);addChar(p[0],p[1],as(TROTT,{pose:'fallen',prop:null}));addSpr(p[0]-10,p[1]+6,(c,x,y)=>{c.save();c.translate(x,y);c.rotate(.9);drawBike(c,0,0,1,null);c.restore();},{ht:24});
    addSpr(p[0],p[1]+4,(c,x,y)=>{for(const[dx,dy,a]of[[-16,-6,.3],[14,-2,-.4],[22,-16,.6],[-4,-30,.2],[8,-40,-.5],[-20,-20,.5]]){c.save();c.translate(x+dx,y+dy);c.rotate(a);drawProp(c,'letter',0,0,1);c.restore();}},{top:true,ht:46});setT('lettre',4,p[0],p[1],28);}
   addVan(t.k.u1-30,t.k.v0+170);}
  // (0,3) Place de la Chapelle
  {const t=townBlock(0,3,[{w:46},{id:'chap',w:76,sign:'Chapelle',roof:'gable',h:64,chim:false},{w:48},{}],[{w:50,h:46},{}],{n:20});
   const ch=bld.chap;ch.after=c=>{drawBox(c,ch.u1-22,ch.v0+6,ch.h,16,16,40);const[x,y]=pr(ch.u1-14,ch.v0+14,ch.h+40);P(c,[[x-12,y+4],[x,y-34],[x+12,y+4]],WHITE);L(c,x,y-34,x,y-42);L(c,x-3,y-39,x+3,y-39);};
   const k=t.k;
   addChar(t.pu0+40,t.pv0+40,as(PIQ,{pose:'carry'}));addSpr(t.pu0+40,t.pv0+40,(c,x,y)=>{drawChar(c,x+1,y-9,as(KIT,{scale:.55}));for(const[dx,dy]of[[-8,-38],[8,-42]]){c.save();c.translate(x+dx,y+dy);c.fillStyle=RED;c.beginPath();c.moveTo(0,2);c.bezierCurveTo(-4,-1,-2,-4,0,-2);c.bezierCurveTo(2,-4,4,-1,0,2);c.fill();c.restore();}},{top:true,ht:50});setT('chaton',5,t.pu0+40,t.pv0+40,24);
   addBench(t.pu0+130,t.pv0+40,false);addChar(t.pu0+130.3,t.pv0+40.3,as(LAPIN,{pose:'sit',prop:'plate'}));setT('gateau',5,t.pu0+130,t.pv0+40,22);
   addChar(t.pu0+80,t.pv0+110,as(TRUFFE,{pose:'carry',prop:'letter'}));addSpr(t.pu0+80,t.pv0+110,(c,x,y)=>{for(const[dx,dy,s]of[[-8,-36,1],[6,-40,.8],[-2,-46,.6]]){c.save();c.translate(x+dx,y+dy);c.scale(s,s);c.fillStyle=RED;c.beginPath();c.moveTo(0,2);c.bezierCurveTo(-4,-1,-2,-4,0,-2);c.bezierCurveTo(2,-4,4,-1,0,2);c.fill();c.restore();}},{top:true,ht:50});setT('lettre',7,t.pu0+80,t.pv0+110,22);}
  // (1,3) Gare routière
  {const k=blk(1,3);labelG(k.u0+12,k.v0+14,'Gare routière');
   for(const v of[k.v0+60,k.v0+120])addBoxItem(k.u0+20,v-6,k.u0+200,v+6,30,c=>{drawBox(c,k.u0+20,v-6,22,180,12,3);for(let u=k.u0+24;u<k.u0+200;u+=44){const a=pr(u,v+6,0),b=pr(u,v+6,22);c.lineWidth=1.2;L(c,a[0],a[1],b[0],b[1]);}});
   addBus(k.u0+80,k.v0+86);addBus(k.u0+160,k.v0+146);
   addChar(k.u0+190,k.v0+190,as(RENARD2,{pose:'arms_up',prop:null}));addChar(k.u0+176,k.v0+192,as(LEONIE,{pose:'point'}));addSpr(k.u0+196,k.v0+194,(c,x,y)=>drawProp(c,'suitcase',x,y-8,1),{ht:12});setT('collier',14,k.u0+184,k.v0+191,26);
   areas.push({u0:k.u0+10,v0:k.v0+20,u1:k.u1-10,v1:k.v1-10,n:20,dist:0});}
  // (2,3) Hôpital / Pizzeria / Laverie
  townBlock(2,3,[{w:110,sign:'HÔPITAL',cross:true,roof:'flat',h:84},{w:56,sign:'Pizzeria',awn:true,awnCol:'#d9a3a0'},{}],[{w:56,sign:'Laverie',awn:true},{}],{n:22});
  // (3,3) Jardins familiaux
  {const k=park(3,3,'Jardins familiaux','#ece6d2');
   for(let r=0;r<5;r++)G(k.u0+20,k.v0+40+r*36,k.u1-60,k.v0+60+r*36,c=>{c.strokeStyle='#8f8a7c';c.lineWidth=.6;const v0=k.v0+40+r*36;rectG(c,k.u0+20,v0,k.u1-60,v0+20,'#ddd3bd');for(let u=k.u0+26;u<k.u1-60;u+=8){const[x,y]=pr(u,v0+10,0);c.beginPath();c.arc(x,y-2,2.4,0,TAU);c.stroke();}});
   addGreenhouse(k.u1-30,k.v0+50);addScarecrow(k.u0+120,k.v0+110);
   addChar(k.u0+60,k.v0+150,as(HULOTTE,{pose:'run',prop:'money'}));addChar(k.u0+34,k.v0+156,SP('dog','suit','white','police','run'));setT('collier',13,k.u0+48,k.v0+152,28);
   areas.push({u0:k.u0+12,v0:k.v0+12,u1:k.u1-12,v1:k.v1-12,n:14,dist:0});}
  cars([[120,296,'u'],[480,316,'u'],[820,296,'u'],[1000,316,'u'],[300,864,'u'],[640,884,'u'],[1060,864,'u'],[296,160,'v'],[316,440,'v'],[580,240,'v'],[600,760,'v'],[864,500,'v'],[884,1000,'v'],[1148,300,'v'],[1168,780,'v'],[400,1148,'u'],[900,1168,'u']]);

  /* ======================= LE PORT ======================= */
  CURD=1;const D1=DISTRICTS[1];
  districtGround(D1,[[22,1180,1748],[306,1180,1748],[590,1180,1748],[874,1180,1748],[1158,1180,1748]],[[1442,0,874],[1726,0,1180]]);
  for(const[i,j]of[[4,0],[5,0],[5,1],[4,2],[5,2]])blockGround(i,j);
  G(1180,896,1748,1180,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,1180,896,1726,1150,'#e9e4d8');});
  waterG(1196,920,1704,1130,11);
  for(const pu of[1300,1440,1580])G(pu-6,920,pu+6,1040,c=>{c.lineWidth=1;rectG(c,pu-6,920,pu+6,1040,'#e9dcc0');c.lineWidth=.4;for(let v=926;v<1040;v+=6){const p=pr(pu-6,v,0),q=pr(pu+6,v,0);L(c,p[0],p[1],q[0],q[1]);}});
  for(let u=1210;u<1700;u+=48)addSpr(u,908,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-2.5,y-7,5,7,'#3a3733');},{ht:10,hw:4});
  {const rr=mulberry32(5);const dots=[];for(let n=0;n<700;n++)dots.push([1748+rr()*132,rr()*1180]);
   G(1748,0,1880,1180,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,1748,0,1880,1180,'#efe7cf');c.fillStyle='#b8ad8f';if(LOD>.6)for(const[u,v]of dots){const[x,y]=pr(u,v,0);c.fillRect(x,y,.8,.8);}});
   waterG(1880,0,2120,1180,21);
   G(1876,0,1886,1180,c=>{c.strokeStyle=INK;c.lineWidth=.8;c.beginPath();for(let v=0;v<=1180;v+=8){const[x,y]=pr(1880+Math.sin(v*.12)*3,v,0);v?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();});
   G(1860,40,2040,60,c=>{c.lineWidth=1;rectG(c,1860,40,2040,60,'#d9d3c5');});
   G(1850,600,2060,616,c=>{c.lineWidth=1;rectG(c,1850,600,2060,616,'#e9dcc0');c.lineWidth=.4;for(let u=1856;u<2060;u+=6){const p=pr(u,600,0),q=pr(u,616,0);L(c,p[0],p[1],q[0],q[1]);}});
   labelG(1758,20,'Plage des Mouettes');}
  // (4,0) Criée / Capitainerie
  {const t=townBlock(4,0,[{id:'criee',w:96,sign:'CRIÉE',bigDoor:true,roof:'gable',h:56},{id:'capi',w:80,sign:'Capitainerie',roof:'flat',h:70},{}],null,{n:18});
   const cr=bld.criee,ca=bld.capi;
   {const p=fr(ca,.25,14);addChar(p[0],p[1],as(PLOUF,{pose:'arms_up'}));setT('tresor',8,p[0],p[1],22);}
   {const p=fr(ca,.8,16);addChar(p[0]-6,p[1],as(TOUTOU,{hat:'bandage',pose:'point'}));addChar(p[0]+8,p[1]+2,as(LEONIE,{pose:'carry',prop:'notepad',flip:true}));setT('banque',10,p[0]+1,p[1]+1,24);}
   {const p=fr(cr,.3,30);addVan(p[0],p[1]);addChar(p[0]+20,p[1]+6,as(OURS3,{pose:'arms_up'}));addChar(p[0]+30,p[1]+4,as(CANARD2,{pose:'arms_up'}));addChar(p[0]+26,p[1]+18,as(LEONIE,{pose:'point',flip:true}));setT('banque',15,p[0]+14,p[1]+6,32);}}
  // (5,0) Banque du Port
  {const t=townBlock(5,0,[{id:'bijou',w:52,sign:'Bijouterie Marine',awn:true,signSize:5.6},{id:'banque',w:100,sign:'BANQUE',cols:true,roof:'gable',h:72},{}],null,{n:18});
   const b=bld.banque,k=t.k;
   addChar(b.cx-18,b.v1+16,as(TOUTOU,{pose:'fallen'}));addChar(b.cx+16,b.v1+24,as(OURS2,{pose:'run',prop:'sack'}));addSpr(b.cx,b.v1+18,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.7;Rc(c,x,y-2,6,3,'#e3e8d8');Rc(c,x-10,y+6,6,3,'#e3e8d8');},{ht:6});setT('banque',3,b.cx,b.v1+20,30);
   {const p=fr(bld.bijou,.5,14);addChar(p[0],p[1],as(CANARD2,{pose:'carry',prop:'money'}));setT('banque',8,p[0],p[1],22);}
   addBench(b.cx-10,b.v1+86,false);addChar(b.cx-9.7,b.v1+86.3,as(OURS1,{pose:'sit',prop:'newspaper'}));setT('banque',1,b.cx-10,b.v1+86,22);
   const cu=k.u1-36,cv=t.pv0+50;addCar(cu,cv,'v',{col:'#3a3733',driver:CANARD});setT('banque',4,cu,cv,24,10);}
  // (4,1) Square des Mouettes
  {const k=park(4,1,'Square des Mouettes');pathG([[k.u0+6,k.v0+6],[k.u1-6,k.v1-6]],12);
   const tu=k.u0+60,tv=k.vc-30;addTree(tu,tv,1.2);addSpr(tu+12,tv+8,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x,y,8,4,'#3a3733');P(c,[[x+8,y],[x+12,y-6],[x+17,y]],'#8f8a7c');drawProp(c,'sack',x-4,y-10,1);},{ht:16});
   addChar(tu+24,tv+12,as(OURS3,{pose:'dig',prop:'shovel',flip:true}));setT('banque',9,tu+16,tv+10,26);
   addBench(k.u0+150,k.v0+60,false);addChar(k.u0+150.3,k.v0+60.3,as(PLOUF,{pose:'sleep',prop:'map'}));setT('tresor',3,k.u0+150,k.v0+60,22);
   addChar(k.u0+120,k.v0+150,as(ECAILLE,{pose:'stand'}));addChar(k.u0+134,k.v0+152,SP('duck','coat','white','none','point',null,true));setT('poisson',4,k.u0+127,k.v0+151,24);
   for(let n=0;n<10;n++){const u=R(k.u0+16,k.u1-16),v=R(k.v0+16,k.v1-16);if(Math.abs((u-k.u0)-(v-k.v0))<18||!free(u,v,12))continue;n%3?addTree(u,v):addBush(u,v);}
   areas.push({u0:k.u0+12,v0:k.v0+12,u1:k.u1-12,v1:k.v1-12,n:16,dist:1});}
  // (5,1) Laverie / Hôtel / Quincaillerie
  {const t=townBlock(5,1,[{id:'laverie',w:56,sign:'Laverie',awn:true,gap:20},{w:56,sign:'Pizzeria',awn:true,awnCol:'#d9a3a0'},{id:'hotel',w:76,sign:'Hôtel de la Plage',roof:'flat',signSize:6}],[{id:'quincp',w:60,sign:'Quincaillerie',awn:true,signSize:6.5},{}],{n:20});
   const l=bld.laverie,q=bld.quincp;
   addBin(l.u1+8,l.v1+6);addChar(l.u1,l.v1+14,as(OURS3,{pose:'give',prop:'clothes'}));setT('banque',7,l.u1+4,l.v1+10,24);
   {const p=fr(q,.5,14);addChar(p[0],p[1],as(MOUSSE,{pose:'walk',prop:'shovel'}));setT('tresor',6,p[0],p[1],22);}
   {const p=fr(bld.hotel,.3,14);addChar(p[0],p[1],SP('frog','shirt','check','straw','point','camera'));setT('banque',11,p[0],p[1],22);}
   const ru=t.pu0+120,rv=t.pv0+90;addChar(ru,rv,as(MOUSSE,{pose:'run',prop:'map'}));setT('tresor',4,ru,rv,22);}
  // (4,2) Chantier naval
  {const t=townBlock(4,2,[{w:90,sign:'Chantier naval',roof:'flat',bigDoor:true,h:60},{w:90,roof:'flat',bigDoor:true,h:56},{}],null,{n:14});
   const k=t.k;addTrestleBoat(k.u0+60,t.pv0+40);addTrestleBoat(k.u0+170,t.pv0+130);
   addCar(k.u0+150,t.pv0+40,'u',{col:'#3a3733'});addChar(k.u0+136,t.pv0+58,as(OURS1,{pose:'stand'}));addChar(k.u0+150,t.pv0+60,as(CANARD,{pose:'give',prop:'map',flip:true}));setT('banque',2,k.u0+146,t.pv0+50,28);
   addChar(k.u0+60,t.pv0+140,as(OURS2,{pose:'run',prop:'sack'}));addChar(k.u0+80,t.pv0+136,as(CANARD,{pose:'run',prop:'sack'}));setT('banque',6,k.u0+70,t.pv0+138,28);
   addChar(k.u0+200,k.v1-10,as(MATOU,{pose:'run',prop:'goldfish'}));setT('poisson',3,k.u0+200,k.v1-10,22);}
  // (5,2) Marché aux poissons + Le Homard
  {const t=townBlock(5,2,[{id:'homard',w:70,sign:'Le Homard',awn:true,awnCol:'#d9a3a0'},{w:56},{}],null,{n:18,noTrees:true});
   const k=t.k,h=bld.homard;
   addTable(h.u0+16,h.v1+16);addTable(h.u0+44,h.v1+20);addParasol(h.u0+44,h.v1+16,true);
   addChar(h.u0+26,h.v1+16,as(PLOUF,{pose:'carry',prop:'map'}));addChar(h.u0+12,h.v1+22,SP('duck','coat','white','none','sit'));setT('tresor',1,h.u0+22,h.v1+18,24);
   addBarrel(h.u1+10,h.v1+14);addChar(h.u1+18,h.v1+8,as(MOUSSE,{pose:'crouch',flip:true}));setT('tresor',2,h.u1+14,h.v1+11,20);
   for(const[su,sv]of[[k.u0+60,k.v0+140],[k.u0+130,k.v0+140]]){addChar(su-4,sv-14,randomSpec());addStall(su,sv,'Poissons','fish');}
   addCrate(k.u0+170,k.v0+120);addCrate(k.u0+180,k.v0+124);addCrate(k.u0+174,k.v0+112,8);addChar(k.u0+188,k.v0+132,as(MATOU,{pose:'hide',flip:true}));setT('poisson',2,k.u0+182,k.v0+128,22);
   const cu=k.u0+90,cv=k.v0+196;addCar(cu,cv,'u',{col:'#3a3733',driver:CANARD});for(const[a,b]of[[-20,-10],[-26,4],[-14,10]])addCrate(cu+a,cv+b,8);addChar(cu-34,cv-10,as(ECAILLE,{pose:'arms_up',hat:'none',fill:'grey'}));setT('banque',5,cu-12,cv,30,6);}
  // bassin
  addBoat(1360,990,1,{len:18,who:as(ECAILLE,{prop:'goldfish',pose:'arms_up'})});setT('poisson',1,1360,990,24);
  addBoat(1520,1080,-1,{len:18,who:as(MOUSSE,{prop:'map'})});setT('tresor',5,1520,1080,24);
  addBoat(1240,960,-1,{sail:true,len:26});addBoat(1640,960,1,{len:26,col:GREY,who:SP('duck','coat','white','none')});addBoat(1660,1100,-1,{sail:true,len:22,col:'#ebe6da'});
  areas.push({u0:1190,v0:900,u1:1720,v1:914,n:12,dist:1});
  // plage & mer
  {addLighthouse(2030,50);addChar(2004,54,as(MOUSSE,{pose:'carry',prop:'telescope'}));setT('tresor',7,2004,54,22);
   const tu=1800,tv=160;G(tu-14,tv-8,tu+14,tv+8,c=>{c.save();c.translate(...pr(tu,tv,0));c.strokeStyle=RED;c.lineWidth=2.4;L(c,-10,-4,10,4);L(c,10,-4,-10,4);c.restore();});
   addSpr(tu+8,tv+2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;E(c,x-6,y,9,4,'#cbbf9e');Rc(c,x-13,y-9,13,8,'#a8946a');c.beginPath();c.moveTo(x-13,y-9);c.quadraticCurveTo(x-6.5,y-14,x,y-9);c.fillStyle='#a8946a';c.fill();c.stroke();D(c,x-6.5,y-6,1,'#e6c14a');},{ht:18});
   addChar(tu+20,tv+6,as(MOUSSE,{pose:'dig',prop:'shovel',flip:true}));setT('tresor',9,tu+10,tv+4,26);
   addSpr(1790,330,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-12,y-18,24,16,WHITE);c.beginPath();c.arc(x-6,y,3,0,TAU);c.arc(x+6,y,3,0,TAU);c.stroke();P(c,[[x-14,y-28],[x+14,y-28],[x+12,y-18],[x-12,y-18]],'#d9a3a0');txt(c,'GLACES',x,y-11,6);},{ht:36,hw:22});avoid(1790,330,16);
   addChar(1812,346,as(PLOUF,{pose:'give',prop:'trophy'}));addChar(1824,344,as(MOUSSE,{pose:'arms_up',flip:true}));setT('tresor',10,1818,345,24);
   addSpr(1800,820,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;drawChar(c,x-4,y,as(MATOU,{pose:'sit',prop:'goldfish'}));drawChar(c,x+8,y,SP('cat','shirt','white','none','sit',null,false,{scale:.55}));drawChar(c,x+15,y+1,SP('cat','shirt','grey','none','sit',null,true,{scale:.5}));drawChar(c,x-14,y+1,SP('cat','shirt','black','none','sit',null,false,{scale:.5}));
     c.beginPath();c.moveTo(x-28,y-16);c.quadraticCurveTo(x,y-36,x+28,y-16);c.lineTo(x+24,y-12);c.quadraticCurveTo(x,y-26,x-24,y-12);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();L(c,x-26,y-15,x-24,y);L(c,x+26,y-15,x+24,y);},{ht:40,hw:30});avoid(1800,820,22);setT('poisson',5,1800,820,26);
   addChar(1820,560,as(CANARD2,{pose:'lie',prop:null}));addSpr(1812,556,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;C(c,x,y-2,2,'#e6c14a');},{ht:6});G(1806,548,1834,572,c=>{c.strokeStyle=INK;c.lineWidth=.8;gp(c,[[1808,552],[1832,552],[1832,568],[1808,568]],WHITE);});setT('banque',12,1820,560,22,-8);
   for(let n=0;n<22;n++){const u=R(1760,1872),v=R(60,1160);if(!free(u,v,14))continue;addParasol(u,v,rnd()<.5);const tw=u+R(-14,-8),tc=rnd()<.5?WHITE:'#e2d7bb';G(tw-6,v,tw+6,v+16,c=>{c.strokeStyle=INK;c.lineWidth=.8;gp(c,[[tw-5,v+2],[tw+5,v+2],[tw+5,v+16],[tw-5,v+16]],tc);});if(rnd()<.7)addChar(u-8,v+10,as(randomSpec(true),{pose:'lie'}));}
   for(const[u,v]of[[1756,250],[1758,700],[1756,980]])addPalm(u,v);
   for(let n=0;n<18;n++)addSwimmer(R(1900,2000),R(80,1160),pick(HEADS));
   addBoat(2010,720,-1,{len:18,who:OURS3,oar:true});setT('banque',13,2010,720,24);
   addBoat(2080,640,-1,{len:30,col:WHITE,who:LEONIE});addSpr(2080,640,(c,x,y)=>{txt(c,'GARDES-CÔTES',x,y-2,5);},{top:true,ht:10});setT('banque',14,2080,640,28);
   addBoat(2060,200,1,{sail:true,len:28});addBoat(1980,1000,-1,{sail:true,len:22,col:'#ebe6da'});
   areas.push({u0:1758,v0:40,u1:1872,v1:1170,n:50,dist:1,beach:true});}
  cars([[1300,296,'u'],[1600,316,'u'],[1260,580,'u'],[1660,600,'u'],[1350,864,'u'],[1432,200,'v'],[1452,640,'v'],[1716,400,'v'],[1736,820,'v']]);

  /* ======================= LA FÊTE FORAINE ======================= */
  CURD=2;const D2=DISTRICTS[2];
  districtGround(D2,[[1442,0,1180],[1726,0,1180],[2010,0,1180]],SL.map(u=>[u,1180,2032]),'#f3eee2');
  for(const[i,j]of D2.blocks)blockGround(i,j,'#efe8d8',true);
  const rrF=mulberry32(77);const conf=[];for(let n=0;n<900;n++)conf.push([rrF()*1180,1180+rrF()*852,rrF()<.5]);
  G(0,1180,1180,2032,c=>{if(LOD<.6)return;for(const[u,v,r]of conf){const[x,y]=pr(u,v,0);c.fillStyle=r?RED:'#e6c14a';c.fillRect(x,y,1.1,1.1);}});
  const fb=(i,j)=>blk(i,j);
  // (0,4) entrée
  {const k=fb(0,4);labelG(k.u0+12,k.v0+14,'Entrée');addArch(k.uc,k.v0+60);
   addSpr(k.u0+60,k.v0+150,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;drawChar(c,x,y-6,DIRO);Rc(c,x-16,y-14,32,14,WHITE);P(c,[[x-19,y-36],[x+19,y-36],[x+16,y-42],[x-16,y-42]],RED);L(c,x-16,y-14,x-16,y-36);L(c,x+16,y-14,x+16,y-36);txt(c,'BILLETS',x,y-7,6);},{ht:46,hw:22});
   addChar(k.u0+80,k.v0+156,as(FORAIN,{pose:'give',prop:'money',flip:true}));setT('fantome',10,k.u0+68,k.v0+152,26);
   addBalloonSeller(k.u0+170,k.v0+110,SP('goat'==='x'?'lion':'elephant','coat','white','straw'));addChar(k.u0+156,k.v0+114,as(NOIS,{pose:'give',flip:false}));addChar(k.u0+146,k.v0+108,MAMAN);setT('ballon',1,k.u0+160,k.v0+112,26);
   for(let n=0;n<4;n++)addFlag(k.u0+20+n*60,k.v1-12);
   areas.push({u0:k.u0+10,v0:k.v0+20,u1:k.u1-10,v1:k.v1-10,n:28,dist:2});}
  // (1,4) carrousel + confiseries
  {const k=fb(1,4);addCarousel(k.u0+90,k.v0+90,(c,x,y)=>{drawChar(c,x+30,y+6,as(NOIS,{pose:'sit'}));});
   {const[x,y]=pr(k.u0+90,k.v0+90,0);setTxy('ballon',2,x+30,y-10,24);}
   addStall(k.u0+190,k.v0+60,'Barbe à papa','fruit');addChar(k.u0+186,k.v0+46,SP('pig','chef','white','none'));addChar(k.u0+196,k.v0+80,as(GHOST,{}));addSpr(k.u0+196,k.v0+80,(c,x,y)=>drawProp(c,'cotton',x+10,y-16,1),{top:true,ht:30});setT('fantome',6,k.u0+194,k.v0+76,24);
   addStall(k.u0+190,k.v0+170,'Nougats','cheese');
   areas.push({u0:k.u0+10,v0:k.v0+20,u1:k.u1-10,v1:k.v1-10,n:24,dist:2});}
  // (2,4) grande roue
  {const k=fb(2,4);CASES.find(c=>c.id==='zorbo').steps[7].t=addWheel(k.u0+80,k.v0+60,true);
   addSpr(k.u0+150,k.v0+120,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.moveTo(x-6,y);c.lineTo(x+10,y);c.quadraticCurveTo(x+12,y-4,x+6,y-6);c.lineTo(x+4,y-18);c.lineTo(x-4,y-18);c.lineTo(x-6,y);c.closePath();c.fillStyle='#3a3733';c.fill();c.stroke();for(const dx of[8,10.5,13])L(c,x+dx-2,y-1,x+dx,y+2);},{ht:22,hw:14});
   addChar(k.u0+168,k.v0+118,SP('rabbit','coat','white','none','point',null,true));setT('fantome',5,k.u0+154,k.v0+118,24);
   areas.push({u0:k.u0+10,v0:k.v0+20,u1:k.u1-10,v1:k.v1-10,n:22,dist:2});}
  // (3,4) autos-tamponneuses
  {const k=fb(3,4);addBumper(k.u0+100,k.v0+80,c=>{const u=k.u0+100+4,v=k.v0+80-4;drawBox(c,u-6,v-5,4,12,10,5,RED,RED,'#a8322a');const[x,y]=pr(u,v,9);c.lineWidth=.8;L(c,x,y,x,y-18);drawChar(c,x+1,y+6,as(GHOST,{}));});
   {const[x,y]=pr(k.u0+104,k.v0+76,9);setTxy('fantome',4,x,y-14,24);}
   areas.push({u0:k.u0+10,v0:k.v0+130,u1:k.u1-10,v1:k.v1-10,n:16,dist:2});}
  // (0,5) train fantôme
  {const t=townBlock(0,5,[{id:'tfan',w:150,sign:'TRAIN FANTÔME',roof:'flat',h:64,tone:'#d9d3c5',signSize:9},{}],null,{n:16,noTrees:true});
   const b=bld.tfan;b.after=c=>{const[x,y]=pr(b.u0+40,b.cv,b.h);drawChar(c,x,y,as(GHOST,{}));const[sx,sy]=pr(b.u0+110,b.v1,b.h-18);c.save();c.translate(sx,sy);C(c,0,0,8,WHITE);D(c,-3,-1,2,INK);D(c,3,-1,2,INK);c.restore();};
   {const[x,y]=pr(b.u0+40,b.cv,b.h);setTxy('fantome',2,x,y-14,22);}
   {const p=fr(b,.8,18);for(const[du,dv,s]of[[0,0,SP('pig','dress','dots','none','run')],[14,8,SP('frog','coat','white','cap','run')],[-8,14,SP('elephant','shirt','check','none','arms_up')],[20,-4,SP('hedgehog','coat','white','none','run')]])addChar(p[0]+du,p[1]+dv,s);setT('fantome',1,p[0]+6,p[1]+5,30);}}
  // (1,5) stands de jeux
  {const k=fb(1,5);let n=0;for(const[nm,gd]of[['Tir','fruit'],['Pêche aux canards','veg'],['Chamboule-tout','cheese']]){addStall(k.u0+50+n*70,k.v0+60,nm,gd);addChar(k.u0+46+n*70,k.v0+46,randomSpec());n++;}
   addChar(k.u0+120,k.v0+140,as(NOIS,{prop:null,pose:'stand'}));addChar(k.u0+132,k.v0+142,as(MAMAN,{pose:'give',flip:true}));addSpr(k.u0+120,k.v0+140,(c,x,y)=>{c.fillStyle='#7fb0d6';for(const[dx,dy]of[[-3,-20],[3,-19],[-4,-16]]){c.beginPath();c.arc(x+dx,y+dy,.9,0,TAU);c.fill();}},{top:true,ht:24});setT('ballon',4,k.u0+126,k.v0+141,22);
   areas.push({u0:k.u0+10,v0:k.v0+80,u1:k.u1-10,v1:k.v1-10,n:22,dist:2});}
  // (2,5) montagnes russes
  {const k=fb(2,5);const pts=addCoaster(k.u0+10,k.v0+40,k.u1-10,k.v0+110,(c,pts)=>{const[u,v,z]=pts[24];const[x,y]=pr(u,v+2,z);Rc(c,x-7,y-8,14,7,RED);drawChar(c,x,y-4,as(GHOST,{pose:'arms_up'}));{const[u2,v2,z2]=pts[34];const[x2,y2]=pr(u2,v2+2,z2);Rc(c,x2-7,y2-8,14,7,RED);drawChar(c,x2,y2-4,as(ZORBO2,{pose:'arms_up'}));}});
   {const[u2,v2,z2]=pts[34];const[x2,y2]=pr(u2,v2+2,z2);setTxy('zorbo',13,x2,y2-18,22);}
   {const[u,v,z]=pts[24];const[x,y]=pr(u,v+2,z);setTxy('fantome',3,x,y-18,24);}
   {const[u,v,z]=pts[8];const[x,y]=pr(u,v,z+50);addSpr(u,v,(c)=>{c.strokeStyle=INK;c.lineWidth=.6;c.beginPath();c.moveTo(x,y+8);c.quadraticCurveTo(x-4,y+16,x+2,y+22);c.stroke();c.lineWidth=1;E(c,x,y,6,7.4,RED);},{top:true,ht:200,hw:200});setTxy('ballon',3,x,y+4,22);}
   areas.push({u0:k.u0+10,v0:k.v0+140,u1:k.u1-10,v1:k.v1-10,n:18,dist:2});}
  // (3,5) restauration
  {const k=fb(3,5);addFoodTruck(k.u0+50,k.v0+40,'CRÊPES');addFoodTruck(k.u0+130,k.v0+40,'FRITES');addFoodTruck(k.u0+200,k.v0+60,'GLACES');
   for(const[du,dv]of[[60,110],[110,120],[160,110],[80,160],[140,170]]){addTable(k.u0+du,k.v0+dv);addParasol(k.u0+du,k.v0+dv-4,true);}
   areas.push({u0:k.u0+10,v0:k.v0+70,u1:k.u1-10,v1:k.v1-10,n:24,dist:2});}
  // (0,6) caravanes
  {const k=fb(0,6);labelG(k.u0+12,k.v0+14,'Caravanes des forains');for(const[du,dv]of[[50,50],[130,46],[200,70],[60,150]])addCaravan(k.u0+du,k.v0+dv);
   addClothesline(k.u0+150,k.v0+130,true);setT('fantome',8,k.u0+148,k.v0+130,24,6);
   addChar(k.u0+80,k.v0+164,as(FORAIN,{pose:'carry',prop:'money'}));addSpr(k.u0+92,k.v0+168,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;c.beginPath();c.moveTo(x-6,y);c.lineTo(x+10,y);c.quadraticCurveTo(x+12,y-4,x+6,y-6);c.lineTo(x+4,y-18);c.lineTo(x-4,y-18);c.lineTo(x-6,y);c.closePath();c.fillStyle='#3a3733';c.fill();c.stroke();},{ht:22});setT('fantome',9,k.u0+84,k.v0+165,24);
   areas.push({u0:k.u0+10,v0:k.v0+20,u1:k.u1-10,v1:k.v1-10,n:10,dist:2});}
  // (1,6) cirque
  {const k=fb(1,6);addTent(k.uc-10,k.v0+70);addChar(k.u0+150,k.v0+170,as(CLOWN,{pose:'give',prop:'redballoon'}));addChar(k.u0+164,k.v0+172,as(NOIS,{prop:null,pose:'arms_up',flip:true}));setT('ballon',5,k.u0+157,k.v0+171,24);
   areas.push({u0:k.u0+10,v0:k.v0+140,u1:k.u1-10,v1:k.v1-10,n:20,dist:2});}
  // (2,6) lac des cygnes
  {const k=fb(2,6);waterG(k.u0+20,k.v0+20,k.u1-20,k.v1-60,33);for(let n=0;n<6;n++)addSwan(R(k.u0+40,k.u1-40),R(k.v0+40,k.v1-80));labelG(k.u0+20,k.v1-30,'Lac des cygnes');
   areas.push({u0:k.u0+10,v0:k.v1-50,u1:k.u1-10,v1:k.v1-8,n:10,dist:2});}
  // (3,6) labyrinthe
  {const k=fb(3,6);labelG(k.u0+12,k.v0+14,'Labyrinthe');const u0=k.u0+20,v0=k.v0+30,n=6,cs=32;
   const rr=mulberry32(99);for(let a=0;a<=n;a++){for(let b=0;b<n;b++){if(rr()<.62&&!(a===0&&b===0))addHedge(u0+a*cs-2,v0+b*cs,u0+a*cs+2,v0+(b+1)*cs);if(rr()<.62&&!(b===n-1&&a===n))addHedge(u0+b*cs,v0+a*cs-2,u0+(b+1)*cs,v0+a*cs+2);}}
   addChar(u0+3.5*cs,v0+2.5*cs,as(GHOST,{}));setT('fantome',7,u0+3.5*cs,v0+2.5*cs,22);}

  buildZorbo();buildGare();buildColline();buildUrban();buildOmbre();buildMore();buildIle();buildVariety();buildBirds();buildDecoys();buildFurniture();
  /* ---- foule ---- */
  for(const a of areas){CURD=a.dist;let n=0,tries=0;while(n<a.n&&tries<a.n*60){tries++;const u=R(a.u0,a.u1),v=R(a.v0,a.v1);if(a.ok&&!a.ok(u,v))continue;if(!free(u,v,2))continue;addChar(u,v,randomSpec(a.beach));n++;}}
  sortItems();
}
