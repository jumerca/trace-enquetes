
/* =========================================================
   VILLE MOINS RÉGULIÈRE : canal, ponts, rond-point, rue en biais
   ========================================================= */
function addBridge(u,v0,v1,w){addBoxItem(u-w/2,v0,u+w/2,v1,30,c=>{c.strokeStyle=INK;c.lineWidth=1.1;
  drawBox(c,u-w/2,v0,0,w,v1-v0,7,'#efeadf','#e2ddd0','#d6d0c2');
  c.save();faceU(c,u+w/2,v1,7);const L2=v1-v0;c.beginPath();c.moveTo(7,7);c.quadraticCurveTo(L2/2,-3,L2-7,7);c.closePath();c.fillStyle='#cfd8d6';c.fill();c.stroke();c.lineWidth=.4;for(let x=4;x<L2;x+=6)L(c,x,0,x,1.6);c.restore();
  c.save();faceV(c,u-w/2,v1,7);c.lineWidth=.4;for(let x=3;x<w;x+=5)L(c,x,1,x,6);c.restore();
  for(const pu of[u-w/2,u+w/2-3])drawBox(c,pu,v0,7,3,v1-v0,5,'#f3eee2','#ece7dc','#e2ddd0');
  for(const pv of[v0+2,v1-2]){const[x,y]=pr(u+w/2-1.5,pv,12);c.lineWidth=1;L(c,x,y,x,y-14);P(c,[[x-3,y-14],[x+3,y-14],[x+2,y-19],[x-2,y-19]],WHITE);}});}
function addBarge(u,v,len){addBoxItem(u-len/2,v-7,u+len/2,v+7,30,c=>{c.strokeStyle=INK;c.lineWidth=1;
  drawBox(c,u-len/2,v-7,0,len,14,6,'#3a3733','#3a3733','#2b2926');c.save();faceV(c,u-len/2,v+7,6);c.fillStyle='#d9a3a0';c.fillRect(0,1,len,1.4);c.restore();
  drawBox(c,u+len/2-24,v-5,6,18,10,10,WHITE,WHITE,'#ebe6da');c.save();faceV(c,u+len/2-24,v+5,16);for(const x of[3,11])Rc(c,x,2,5,4,'#eef1f0');c.restore();
  for(let k=0;k<3;k++){const[x,y]=pr(u-len/2+8+k*10,v,6);c.lineWidth=.8;Rc(c,x-3,y-4,6,4,'#a8946a');C(c,x,y-6,3,'#e4e8d4');D(c,x+1,y-7,1,RED);}
  {const[x,y]=pr(u+len/2-26,v-4,16);drawChar(c,x,y,SP('frog','shirt','stripes','cap','sit',null,false,{build:'round'}));}
  {const[x,y]=pr(u-len/2+2,v,6);L(c,x,y,x,y-18);P(c,[[x,y-18],[x+8,y-16],[x,y-13]],RED);}});}
function addQuayStairs(u,v,dir){G(u-10,v-6,u+10,v+6,c=>{c.strokeStyle=INK;c.lineWidth=.6;for(let k=0;k<4;k++){const vv=v+dir*k*2.2;gp(c,[[u-8,vv],[u+8,vv],[u+8,vv+dir*2.2],[u-8,vv+dir*2.2]],k%2?'#e2ddd0':'#efeadf');}});}
function addStatue(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;Rc(c,x-9,y-16,18,16,'#d6d0c2');Rc(c,x-11,y-19,22,3,'#e2ddd0');txt(c,'LE FONDATEUR',x,y-8,3.8);
  c.save();c.globalAlpha=1;drawChar(c,x,y-19,SP('lion','coat','grey','top','point','cane',false,{build:'tall',noTail:false}),true);c.restore();
  c.save();c.translate(x-1,y-60);c.lineWidth=.8;E(c,0,0,3.4,1.8,'#cfcac0');C(c,3,-2,1.6,'#cfcac0');c.restore();},{ht:70,hw:20});avoid(u,v,26);}
function buildUrban(){
  CURD=0;
  // ---- canal Saint-Moustache (remplace la rue du milieu)
  const cv0=570,cv1=610;const rr=mulberry32(91);const wv=[];for(let k=0;k<120;k++)wv.push([rr()*1180,cv0+6+rr()*(cv1-cv0-12)]);
  G(0,cv0-4,1180,cv1+4,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,0,cv0-2,1180,cv1+2,'#e2ddd0');rectG(c,0,cv0,1180,cv1,'#d6e0de');c.lineWidth=.6;for(const[u,v]of wv){const[x,y]=pr(u,v,0);c.beginPath();c.arc(x,y,3.4,PI*1.15,PI*1.85);c.stroke();}});
  G(330,cv0-12,560,cv0,c=>groundText(c,330,cv0-6,'Canal Saint-Moustache',13));
  for(const u of[22,306,590,874,1158])addBridge(u,cv0-6,cv1+6,44);
  for(const[u,v,dir]of[[160,cv0,1],[450,cv1,-1],[740,cv0,1],[1020,cv1,-1]])addQuayStairs(u,v,dir);
  for(let u=60;u<1180;u+=70){if([22,306,590,874,1158].some(b=>Math.abs(b-u)<34))continue;addSpr(u,cv1+2,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-2,y-6,4,6,'#3a3733');},{ht:8,hw:4});}
  addBarge(450,590,70);addBoat(760,592,-1,{len:14,who:SP('duck','shirt','dots','straw','row',null,false,{build:'small'}),oar:true});addBoat(1000,588,1,{len:12});
  // ---- rond-point du Fondateur
  const ru=874,rv=874;
  G(ru-46,rv-46,ru+46,rv+46,c=>{c.strokeStyle=INK;const circ=(r,f,dash)=>{const pts=[];for(let a=0;a<TAU;a+=.12)pts.push([ru+Math.cos(a)*r,rv+Math.sin(a)*r,0]);c.setLineDash(dash||[]);ip(c,pts,f);c.setLineDash([]);};
    c.lineWidth=1.1;circ(44,'#f8f6f0');c.lineWidth=.8;circ(32,null,[6,6]);c.lineWidth=1.2;circ(20,'#e3e4cf');c.lineWidth=.5;circ(14,null);
    for(let k=0;k<4;k++){const a=k*PI/2+PI/4;for(let s=-1;s<=1;s+=2){}}
    for(const[du,dv]of[[0,-1],[1,0],[0,1],[-1,0]]){for(let k=-12;k<=12;k+=6){const u=ru+du*50+(dv?k:0),v=rv+dv*50+(du?k:0);gp(c,[[u-(dv?1.6:3),v-(du?1.6:3)],[u+(dv?1.6:3),v-(du?1.6:3)],[u+(dv?1.6:3),v+(du?1.6:3)],[u-(dv?1.6:3),v+(du?1.6:3)]],INK);}}});
  addStatue(ru,rv);for(const a of[.4,1.9,3.5,5.1])addBush(ru+Math.cos(a)*16,rv+Math.sin(a)*16,true);
  addCar(ru+32,rv-12,'v',{driver:randomSpec()});addCar(ru-14,rv+33,'u',{col:GREY});
  G(ru-40,rv+48,ru+60,rv+64,c=>groundText(c,ru-38,rv+56,'Rond-point du Fondateur',11));
  // ---- rue en biais (îlot de l'hôpital)
  const k=blk(2,3),a=[k.u0+44,k.v0+190],b=[k.u1-2,k.v0+70],hw=13;const dl=Math.hypot(b[0]-a[0],b[1]-a[1]),n=[-(b[1]-a[1])/dl*hw,(b[0]-a[0])/dl*hw];
  G(a[0]-20,a[1]-20,b[0]+20,b[1]+20,c=>{c.strokeStyle=INK;c.lineWidth=1.1;gp(c,[[a[0]+n[0],a[1]+n[1]],[b[0]+n[0],b[1]+n[1]],[b[0]-n[0],b[1]-n[1]],[a[0]-n[0],a[1]-n[1]]],'#f8f6f0');
    c.lineWidth=.8;c.setLineDash([7,6]);const p=pr(a[0],a[1],0),q=pr(b[0],b[1],0);L(c,p[0],p[1],q[0],q[1]);c.setLineDash([]);
    {const m=[a[0]+(b[0]-a[0])*.35,a[1]+(b[1]-a[1])*.35];const P1=pr(a[0],a[1],0),P2=pr(b[0],b[1],0);c.save();c.translate(...pr(m[0]+n[0]*1.3,m[1]+n[1]*1.3,0));c.rotate(Math.atan2(P2[1]-P1[1],P2[0]-P1[0]));c.font='11px "Patrick Hand", cursive';c.fillStyle=INK;c.textAlign='center';c.textBaseline='middle';c.fillText('Rue de Biais',0,0);c.restore();}});
  for(let t=0;t<=1;t+=.04)avoid(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,15);
  for(const t of[.2,.5,.8]){const u=a[0]+(b[0]-a[0])*t,v=a[1]+(b[1]-a[1])*t;addLamp(u-n[0]*1.4,v-n[1]*1.4);addTree(u+n[0]*1.8,v+n[1]*1.8,.9);}
  addBike(a[0]+(b[0]-a[0])*.35,a[1]+(b[1]-a[1])*.35,1,SP('rabbit','shirt','check','helmet'));addBike(a[0]+(b[0]-a[0])*.65,a[1]+(b[1]-a[1])*.65,-1,SP('dog','coat','white','cap',null,null,false,{build:'round'}));
  // ---- pont ferroviaire sur le fleuve (Gare)
  CURD=3;
  for(const v of[1492,1546,1600,1656])addBoxItem(2032,v-10,2120,v+10,40,c=>{c.strokeStyle=INK;c.lineWidth=1;drawBox(c,2032,v-10,4,88,20,4,'#9d978b','#8f8a7c','#7f796d');
    c.lineWidth=1.4;for(const dv of[-5,5]){const p=pr(2032,v+dv,8),q=pr(2120,v+dv,8);L(c,p[0],p[1],q[0],q[1]);}
    c.lineWidth=1;for(const dv of[-10,10]){for(let u=2032;u<2120;u+=11){const p=pr(u,v+dv,8),q=pr(u+11,v+dv,22),r=pr(u+11,v+dv,8);L(c,p[0],p[1],q[0],q[1]);L(c,q[0],q[1],r[0],r[1]);}const p=pr(2032,v+dv,22),q=pr(2120,v+dv,22);L(c,p[0],p[1],q[0],q[1]);}
    for(const u of[2052,2100]){const p=pr(u,v+10,4),q=pr(u,v+10,-20);c.lineWidth=2.4;L(c,p[0],p[1],q[0],q[1]);}});
}

function buildBirds(){CURD=0;const rr=mulberry32(123);const B=[];for(let k=0;k<9;k++)B.push([rr()*5000,rr()*2000-100,18+rr()*16,rr()*6]);
  addMover([-1e5,-1e5,1e5,1e5],(c,t)=>{if(!animOn())return;c.strokeStyle=INK;c.lineWidth=1.1;c.lineCap='round';for(const[o,y0,sp,ph]of B){const x=-2700+((o+t*sp)%5000),y=y0+Math.sin(t*.5+ph)*14,f=Math.sin(t*7+ph)*3.4;c.beginPath();c.moveTo(x-5,y-f);c.quadraticCurveTo(x-2,y-1.6,x,y);c.quadraticCurveTo(x+2,y-1.6,x+5,y-f);c.stroke();}});}
