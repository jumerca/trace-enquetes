
/* =========================================================
   MOTEUR ISOMÉTRIQUE
   Coordonnées du sol (u,v), hauteur z.  Écran : x=u-v, y=(u+v)/2-z
   ========================================================= */
const BLK=240, ST=44, PITCH=284, DEP=40, SLAB=26;
const pr=(u,v,z)=>[u-v,(u+v)/2-(z||0)];
function ip(c,pts,f){P(c,pts.map(p=>pr(p[0],p[1],p[2]||0)),f);}
function drawBox(c,u0,v0,z0,w,d,h,ft,fl,fr){
  ip(c,[[u0,v0+d,z0],[u0+w,v0+d,z0],[u0+w,v0+d,z0+h],[u0,v0+d,z0+h]],fl||WHITE);
  ip(c,[[u0+w,v0+d,z0],[u0+w,v0,z0],[u0+w,v0,z0+h],[u0+w,v0+d,z0+h]],fr||'#ebe6da');
  ip(c,[[u0,v0,z0+h],[u0+w,v0,z0+h],[u0+w,v0+d,z0+h],[u0,v0+d,z0+h]],ft||WHITE);
}
/* faces : repère local (x vers la droite de l'écran, y vers le bas) */
function faceV(c,u0,v,ztop){c.transform(1,.5,0,1,u0-v,(u0+v)/2-ztop);}   // face v=cste, x le long de u
function faceU(c,u,v1,ztop){c.transform(1,-.5,0,1,u-v1,(u+v1)/2-ztop);} // face u=cste, x le long de -v
function groundT(c){c.transform(1,.5,-1,.5,0,0);}                         // dessin à plat sur le sol (u,v)


const items=[], topItems=[], groundL=[], areas=[], avoidC=[], avoidR=[], occupied=[], bld={};
let CURD=0;
function bbBox(u0,v0,u1,v1,ht){return[u0-v1-3,(u0+v0)/2-ht-3,u1-v0+3,(u1+v1)/2+3];}
function G(u0,v0,u1,v1,d){groundL.push({bb:bbBox(u0,v0,u1,v1,0),d,dist:CURD});}
function addBoxItem(u0,v0,u1,v1,ht,d){const it={key:(u0+u1+v0+v1)/2,fp:[u0,v0,u1,v1],box:true,bb:bbBox(u0,v0,u1,v1,ht),d,dist:CURD};items.push(it);return it;}
function addSpr(u,v,d,o){o=o||{};const[x,y]=pr(u,v,o.z||0);const it={key:u+v,fp:[u,v,u,v],box:false,bb:[x-(o.hw||24),y-(o.ht||52),x+(o.hw||24),y+(o.lo||8)],d:c=>d(c,x,y),dist:CURD};(o.top?topItems:items).push(it);return it;}
function addChar(u,v,s,o){occupied.push({u,v});return addSpr(u,v,(c,x,y)=>drawChar(c,x,y,s),Object.assign({ht:(s.prop==='balloon'||s.prop==='umbrella')?66:52},o));}
function avoid(u,v,r){avoidC.push({u,v,r});}
function avoidRect(u0,v0,u1,v1){avoidR.push([u0,v0,u1,v1]);}
function gp(c,pts,f){ip(c,pts.map(p=>[p[0],p[1],0]),f);}
function rectG(c,u0,v0,u1,v1,f){gp(c,[[u0,v0],[u1,v0],[u1,v1],[u0,v1]],f);}
function blk(i,j){const u0=ST+i*PITCH,v0=ST+j*PITCH;return{u0,v0,u1:u0+BLK,v1:v0+BLK,uc:u0+BLK/2,vc:v0+BLK/2};}
function groundText(c,u,v,txt,size){c.save();c.translate(...pr(u,v,0));groundT(c);c.font=`${size||16}px "Patrick Hand", cursive`;c.fillStyle=INK;c.textAlign='left';c.textBaseline='middle';c.fillText(txt,0,0);c.restore();}

/* tri : un objet passe devant une boîte s'il est au-delà d'elle sur u ou v */
function behind(a,b){return a.fp[2]<=b.fp[0]||a.fp[3]<=b.fp[1];}
function sortItems(){
  const n=items.length,adj=Array.from({length:n},()=>[]),indeg=new Int32Array(n);
  const cell=150,grid=new Map();
  items.forEach((it,i)=>{const b=it.bb;for(let gx=Math.floor(b[0]/cell);gx<=Math.floor(b[2]/cell);gx++)for(let gy=Math.floor(b[1]/cell);gy<=Math.floor(b[3]/cell);gy++){const k=gx*100003+gy;let a=grid.get(k);if(!a)grid.set(k,a=[]);a.push(i);}});
  const seen=new Set();
  for(const arr of grid.values())for(let x=0;x<arr.length;x++)for(let y=x+1;y<arr.length;y++){
    const i=arr[x],j=arr[y],A=items[i],B=items[j];if(!A.box&&!B.box)continue;
    const pk=i<j?i*n+j:j*n+i;if(seen.has(pk))continue;seen.add(pk);
    const a=A.bb,b=B.bb;if(a[2]<b[0]||b[2]<a[0]||a[3]<b[1]||b[3]<a[1])continue;
    const ab=behind(A,B),ba=behind(B,A);
    if(ab&&!ba){adj[i].push(j);indeg[j]++;}else if(ba&&!ab){adj[j].push(i);indeg[i]++;}
  }
  const heap=[],K=i=>items[i].key;
  const push=i=>{heap.push(i);let k=heap.length-1;while(k>0){const p=(k-1)>>1;if(K(heap[p])<=K(heap[k]))break;[heap[p],heap[k]]=[heap[k],heap[p]];k=p;}};
  const pop=()=>{const r=heap[0],l=heap.pop();if(heap.length){heap[0]=l;let k=0;for(;;){const a=2*k+1,b=a+1;let m=k;if(a<heap.length&&K(heap[a])<K(heap[m]))m=a;if(b<heap.length&&K(heap[b])<K(heap[m]))m=b;if(m===k)break;[heap[m],heap[k]]=[heap[k],heap[m]];k=m;}}return r;};
  for(let i=0;i<n;i++)if(!indeg[i])push(i);
  const done=new Uint8Array(n),out=[];
  while(out.length<n){
    if(!heap.length){let best=-1;for(let i=0;i<n;i++)if(!done[i]&&(best<0||K(i)<K(best)))best=i;push(best);}
    const i=pop();if(done[i])continue;done[i]=1;out.push(items[i]);
    for(const j of adj[i])if(--indeg[j]===0&&!done[j])push(j);
  }
  items.length=0;items.push(...out);
}

/* ---------- éléments animés, redessinés par-dessus les tuiles ---------- */
const movers=[];function addMover(bb,d,fp){const m={bb,d,dist:CURD,fp:fp||null,over:[]};movers.push(m);return m;}
/* Un élément animé est dessiné au-dessus des tuiles : on redessine ensuite ce qui est devant lui (bâtiments, personnages). */
function finalizeMovers(){for(const m of movers){if(!m.fp)continue;const[u0,v0,u1,v1]=m.fp,key=(u0+u1+v0+v1)/2;
  for(const it of items){const b=it.bb;if(b[2]<m.bb[0]||b[0]>m.bb[2]||b[3]<m.bb[1]||b[1]>m.bb[3])continue;
    const front=it.box?(u1<=it.fp[0]||v1<=it.fp[1]):it.key>key+6;if(front&&it.dist===m.dist)m.over.push(it);}}}
const animOn=()=>!(typeof opts!=='undefined'&&opts.anim===false);
const animT=()=>animOn()?performance.now()/1000:0;
/* ---------- objets du décor ---------- */
function addTree(u,v,k){
  k=k||R(.8,1.15);const blobs=[];const n=RI(5,7);
  for(let i=0;i<n;i++){const a=i/n*TAU+R(-.3,.3);blobs.push([Math.cos(a)*7*k,-24*k+Math.sin(a)*6*k,R(6,8)*k]);}
  blobs.push([0,-25*k,8.5*k]);const marks=[];for(let i=0;i<4;i++)marks.push([R(-8,8)*k,R(-30,-18)*k]);
  addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.8;E(c,x,y,7*k,3.5*k,'#dcd6c6');c.lineWidth=1.1;
    P(c,[[x-1.8*k,y],[x-1.2*k,y-15*k],[x+1.2*k,y-15*k],[x+1.8*k,y]],WHITE);
    c.lineWidth=2.4;for(const b of blobs){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}
    c.fillStyle=WHITE;for(const b of blobs){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}
    c.lineWidth=.6;for(const m of marks){c.beginPath();c.arc(x+m[0],y+m[1],2,PI*.2,PI*.9);c.stroke();}},{hw:24*k,ht:42*k});
  avoid(u,v,9);
}
function addPalm(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;c.beginPath();c.moveTo(x-2,y);c.quadraticCurveTo(x-4,y-20,x+2,y-38);c.lineTo(x+4,y-38);c.quadraticCurveTo(x-1,y-20,x+2,y);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();
  for(let k=0;k<7;k++){const a=-PI/2+(k-3)*.45;c.beginPath();c.moveTo(x+3,y-38);c.quadraticCurveTo(x+3+Math.cos(a)*10,y-46+Math.sin(a)*6,x+3+Math.cos(a)*18,y-36+Math.sin(a)*8);c.lineWidth=2.6;c.stroke();c.lineWidth=1.2;c.strokeStyle=WHITE;c.stroke();c.strokeStyle=INK;c.lineWidth=1;}},{ht:56});avoid(u,v,8);}
function addBush(u,v,roses){const blobs=[];for(let i=0;i<4;i++)blobs.push([R(-7,7),R(-7,-3),R(3.5,5)]);
  addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=2;for(const b of blobs){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.stroke();}c.fillStyle=WHITE;for(const b of blobs){c.beginPath();c.arc(x+b[0],y+b[1],b[2],0,TAU);c.fill();}if(roses)for(const b of blobs)D(c,x+b[0],y+b[1]-1,1.2,'#c94a3f');},{ht:16,hw:16});avoid(u,v,8);}
function addLamp(u,v,poster){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.6;L(c,x,y,x,y-38);c.lineWidth=1;P(c,[[x-4,y-38],[x+4,y-38],[x+2.6,y-45],[x-2.6,y-45]],WHITE);L(c,x-3.2,y-46,x+3.2,y-46);
  if(poster){Rc(c,x-6,y-30,12,13,WHITE);c.fillStyle=INK;c.font='5px "Patrick Hand", cursive';c.textAlign='center';c.textBaseline='middle';c.fillText('PERDU',x,y-27.5);c.save();c.translate(x,y-19.5);c.scale(.45,.45);drawHead(c,{head:'cat'},1);c.restore();}},{ht:50,hw:8});avoid(u,v,5);}
function drawBench(c,x,y){c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-13,y-17,26,5,WHITE);L(c,x-13,y-14.5,x+13,y-14.5);L(c,x-11,y-12,x-11,y-9);L(c,x+11,y-12,x+11,y-9);Rc(c,x-14,y-9.2,28,2.6,WHITE);c.lineWidth=1.3;L(c,x-12,y-6.6,x-12,y);L(c,x+12,y-6.6,x+12,y);}
function addBench(u,v,sitter){const it=addSpr(u,v,(c,x,y)=>drawBench(c,x,y),{ht:20,hw:16});it.key-=.5;avoid(u,v,12);
  if(sitter===undefined&&rnd()<.55)addChar(u+.3,v+.3,Object.assign(randomSpec(),{pose:'sit'}));}
function addBin(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;P(c,[[x-4.2,y-11],[x+4.2,y-11],[x+3.6,y],[x-3.6,y]],GREY);Rc(c,x-5,y-12.6,10,1.8,WHITE);},{ht:16,hw:8});avoid(u,v,7);}
function addCrate(u,v,h){addBoxItem(u-5,v-5,u+5,v+5,h||10,c=>{drawBox(c,u-5,v-5,0,10,10,h||10,'#efe8d6','#e3dac4','#d6ccb4');c.lineWidth=.5;ip(c,[[u-5,v+5,0],[u+5,v+5,h||10]]);});avoid(u,v,9);}
function addParasol(u,v,str){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;L(c,x,y,x,y-30);c.lineWidth=1;c.save();c.beginPath();c.moveTo(x-15,y-28);c.quadraticCurveTo(x,y-42,x+15,y-28);c.quadraticCurveTo(x,y-24,x-15,y-28);c.closePath();c.fillStyle=WHITE;c.fill();if(str){c.clip();stripesIn(c,x-16,y-44,x+16,y-22,6,3,true,'#c9c2b2');}c.restore();
  c.beginPath();c.moveTo(x-15,y-28);c.quadraticCurveTo(x,y-42,x+15,y-28);c.quadraticCurveTo(x,y-24,x-15,y-28);c.closePath();c.stroke();for(const k of[-8,0,8])L(c,x,y-37,x+k*1.8,y-27);},{ht:46,hw:18});avoid(u,v,8);}
function addTable(u,v){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;L(c,x,y,x,y-8);E(c,x,y-8,7,3,WHITE);D(c,x-2,y-9,.9,WHITE);c.lineWidth=.6;C(c,x+2,y-9.2,1.2,WHITE);},{ht:14,hw:10});avoid(u,v,8);}
function addBike(u,v,d,rider){addSpr(u,v,(c,x,y)=>drawBike(c,x,y,d,rider),{ht:46});avoid(u,v,8);}
function drawBike(c,x,y,d,rider){c.strokeStyle=INK;c.lineWidth=1;C(c,x-8,y-5,5,null);C(c,x+8,y-5,5,null);c.lineWidth=1.1;c.beginPath();c.moveTo(x-8,y-5);c.lineTo(x-2,y-13);c.lineTo(x+5,y-13);c.lineTo(x+8,y-5);c.moveTo(x-2,y-13);c.lineTo(x+1,y-5);c.lineTo(x+5,y-13);c.moveTo(x+d*6,y-13);c.lineTo(x+d*7,y-17);c.stroke();
  if(rider)drawChar(c,x-d*1,y-5,Object.assign({},rider,{pose:'sit'}));}
function addFence(u0,u1,v,gapA,gapB){addBoxItem(u0,v,u1,v+.5,14,c=>{c.strokeStyle=INK;c.lineWidth=.9;
  for(let u=u0;u<=u1;u+=4){if(gapA!==undefined&&u>gapA&&u<gapB)continue;const[x,y]=pr(u,v,0);L(c,x,y,x,y-10);}
  const seg=gapA!==undefined?[[u0,gapA],[gapB,u1]]:[[u0,u1]];for(const[a,b]of seg){for(const z of[3,8]){const p1=pr(a,v,z),p2=pr(b,v,z);L(c,p1[0],p1[1],p2[0],p2[1]);}}});}
function addFountain(u,v){{const[X,Y]=pr(u,v,0);addMover([X-36,Y-60,X+36,Y+10],(c,t)=>{c.fillStyle='rgba(255,255,255,.95)';c.strokeStyle=INK;c.lineWidth=.5;for(let i=0;i<9;i++){const ph=((animOn()?t*.9:0)+i/9)%1,side=i%2?1:-1,x=X+side*(4+ph*17),y=Y-40+(ph*ph*34)-Math.sin(ph*PI)*(8+ (i%3)*3);c.beginPath();c.arc(x,y,1.3,0,TAU);c.fill();c.stroke();}});}addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.2;
  E(c,x,y+4,40,20,'#e9e4d8');c.fillStyle='#e9e4d8';c.fillRect(x-40,y-2,80,6);L(c,x-40,y-2,x-40,y+4);L(c,x+40,y-2,x+40,y+4);E(c,x,y-2,40,20,WHITE);E(c,x,y-2,35,17,'#dfe6e4');
  c.lineWidth=.6;for(let k=0;k<5;k++){c.beginPath();c.arc(x-22+k*11,y-2+(k%2?4:-3),3,PI*1.1,PI*1.9);c.stroke();}
  c.lineWidth=1.1;Rc(c,x-3,y-26,6,24,WHITE);E(c,x,y-27,12,6,WHITE);E(c,x,y-28,9,4,'#dfe6e4');Rc(c,x-1.4,y-38,2.8,10,WHITE);C(c,x,y-39,2,WHITE);
  c.setLineDash([2,2]);c.lineWidth=.8;for(const s of[-1,1]){c.beginPath();c.moveTo(x,y-40);c.quadraticCurveTo(x+s*10,y-48,x+s*14,y-28);c.stroke();c.beginPath();c.moveTo(x+s*11,y-27);c.quadraticCurveTo(x+s*20,y-26,x+s*24,y-8);c.stroke();}c.setLineDash([]);},{hw:44,ht:50,lo:26});
  avoidRect(u-44,v-44,u+44,v+44);}
function addKiosk(u,v,extra){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1.1;E(c,x,y,34,17,WHITE);E(c,x,y-3,34,17,'#efeadf');
  for(const px of[-28,-14,0,14,28]){c.lineWidth=1.4;L(c,x+px,y-3+Math.sqrt(Math.max(0,1-(px/34)**2))*17,x+px,y-44);}
  c.lineWidth=1;P(c,[[x-38,y-44],[x+38,y-44],[x+4,y-66],[x-4,y-66]],WHITE);c.lineWidth=.6;for(let k=-3;k<=3;k++)L(c,x+k*10,y-44,x+k*1.2,y-65);
  c.lineWidth=1;L(c,x,y-66,x,y-72);P(c,[[x,y-76],[x+6,y-74],[x,y-71]],RED);if(extra)extra(c,x,y);},{hw:42,ht:80,lo:20});avoidRect(u-30,v-30,u+30,v+30);}
function addStall(u,v,name,goods){
  const g=[];for(let i=0;i<6;i++)g.push(R(.85,1.3));
  addBoxItem(u-20,v-8,u+20,v+8,40,c=>{c.strokeStyle=INK;c.lineWidth=1;
    for(const[pu,pv]of[[u-20,v-8],[u+20,v-8]]){const a=pr(pu,pv,0),b=pr(pu,pv,30);L(c,a[0],a[1],b[0],b[1]);}
    drawBox(c,u-20,v-8,0,40,16,10,WHITE,WHITE,'#ebe6da');
    for(let i=0;i<6;i++){const[x,y]=pr(u-16+i*6.5,v-2+(i%2)*4,10);if(goods==='fish'){E(c,x,y-1.5,3.4*g[i],1.4,WHITE);}else if(goods==='veg'){P(c,[[x-1.5,y],[x+1.5,y],[x,y-5]],WHITE);}else C(c,x,y-2,2.4*g[i],goods==='cheese'?'#efe3b0':WHITE);}
    for(const[pu,pv]of[[u-20,v+8],[u+20,v+8]]){const a=pr(pu,pv,0),b=pr(pu,pv,26);c.lineWidth=1;L(c,a[0],a[1],b[0],b[1]);}
    const aw=[[u-22,v-10,32],[u+22,v-10,32],[u+22,v+11,25],[u-22,v+11,25]];
    c.save();c.beginPath();aw.map(p=>pr(...p)).forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=WHITE;c.fill();c.clip();
    for(let k=0;k<8;k+=2){const q=[[u-22+k*5.5,v-10,32],[u-22+(k+1)*5.5,v-10,32],[u-22+(k+1)*5.5,v+11,25],[u-22+k*5.5,v+11,25]].map(p=>pr(...p));c.beginPath();q.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle='#a9a294';c.fill();}
    c.restore();ip(c,aw,null);
    if(name){c.save();faceV(c,u-20,v+8,10);c.font='6.5px "Patrick Hand", cursive';c.fillStyle=INK;c.textAlign='center';c.textBaseline='middle';c.fillText(name,20,5);c.restore();}
  });
  avoidRect(u-24,v-12,u+24,v+12);
}
function drawIsoCar(c,u,v,ax,col,driver,taxi){
  c.strokeStyle=INK;c.lineWidth=1;
  const L2=ax==='u'?[28,14]:[14,28];const u0=u-L2[0]/2,v0=v-L2[1]/2;
  const wh=(pu,pv)=>{const[x,y]=pr(pu,pv,3);E(c,x,y,3.6,3.6,INK);D(c,x,y,1.3,WHITE);};
  if(ax==='u'){wh(u0+6,v0+14);wh(u0+22,v0+14);}else{wh(u0+14,v0+22);wh(u0+14,v0+6);}
  drawBox(c,u0,v0,3,L2[0],L2[1],8,col,col,col===WHITE?'#ebe6da':col);
  const cu=ax==='u'?[u0+7,v0+1,14,12]:[u0+1,v0+7,12,14];
  drawBox(c,cu[0],cu[1],11,cu[2],cu[3],7,col,'#eef1f0','#e2e8e6');
  if(driver){c.save();const[x,y]=ax==='u'?pr(cu[0]+9,cu[1]+cu[3],14):pr(cu[0]+cu[2],cu[1]+5,14);c.translate(x,y);c.scale(.55,.55);drawHead(c,driver,1);c.restore();}
  if(taxi){const[x,y]=pr(u,v,22);Rc(c,x-6,y-3,12,5,WHITE);c.fillStyle=INK;c.font='4.5px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('TAXI',x,y-.4);}
}
function addCar(u,v,ax,o){o=o||{};const col=o.col||pick([WHITE,WHITE,GREY,'#3a3733',LGREY]);const h=ax==='u'?[14,7]:[7,14];return addBoxItem(u-h[0],v-h[1],u+h[0],v+h[1],30,c=>drawIsoCar(c,u,v,ax,col,o.driver,o.taxi));}
function addBus(u,v){addBoxItem(u-34,v-9,u+34,v+9,30,c=>{const[x,y]=pr(u+34,v-9,0);
  for(const pu of[u-22,u+20]){const[a,b]=pr(pu,v+9,3);E(c,a,b,4,4,INK);D(c,a,b,1.4,WHITE);}
  drawBox(c,u-34,v-9,3,68,18,22,WHITE,WHITE,'#ebe6da');
  c.save();faceV(c,u-34,v+9,25);c.lineWidth=.8;for(let k=0;k<7;k++){const wx=4+k*9;c.save();c.beginPath();c.rect(wx,3,7,8);c.fillStyle='#eef1f0';c.fill();c.clip();if(k%2===0){c.translate(wx+3.5,10);c.scale(.5,.5);drawHead(c,{head:HEADS[(k*5)%HEADS.length]},1);}c.restore();c.strokeRect(wx,3,7,8);}
  c.fillStyle=INK;c.font='6px "Patrick Hand", cursive';c.textAlign='left';c.fillText('LIGNE 3',4,18);c.restore();});}
function drawBoat(c,x,y,dir,o){
  c.save();c.translate(x,y);c.scale(dir,1);c.strokeStyle=INK;c.lineWidth=1.1;
  if(o.sail){c.lineWidth=1.3;L(c,0,-6,0,-50);c.lineWidth=1;P(c,[[1.5,-48],[1.5,-11],[24,-11]],WHITE);P(c,[[-1.5,-40],[-1.5,-11],[-15,-11]],WHITE);}
  if(o.who){drawChar(c,o.wx||0,-3,Object.assign({},o.who,{pose:'row',prop:o.oar?'oar':o.who.prop}));}
  const L2=o.len||22;P(c,[[-L2,-10],[L2,-10],[L2-6,2],[-L2+5,2]],o.col||WHITE);c.lineWidth=.6;L(c,-L2+1.5,-6,L2-2,-6);
  c.lineWidth=.7;for(let k=-1;k<=1;k++){c.beginPath();c.moveTo(k*14-5,5);c.quadraticCurveTo(k*14,3,k*14+5,5);c.stroke();}
  c.restore();
}
function addBoat(u,v,dir,o){addSpr(u,v,(c,x,y)=>drawBoat(c,x,y,dir,o),{hw:34,ht:o.sail?56:30});}
function addSwimmer(u,v,head){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=.7;c.beginPath();c.arc(x-5,y,3,PI*1.1,PI*1.9);c.stroke();c.beginPath();c.arc(x+5,y,3,PI*1.1,PI*1.9);c.stroke();c.save();c.translate(x,y-4);drawHead(c,{head},1);c.restore();},{ht:16,hw:12});}

/* ---------- bâtiments ---------- */
function makeBuilding(b){
  b.win=[];for(let i=0;i<60;i++){const r=rnd();b.win.push(r<.1?{t:'face',head:pick(HEADS)}:r<.26?{t:'shut'}:r<.36?{t:'balc'}:r<.46?{t:'plant'}:r<.58?{t:'dark'}:{t:'plain'});}
  b.tone=b.tone||pick([WHITE,WHITE,'#f7f4ec','#efeadf']);
  b.roof=b.roof||(rnd()<.45?'gable':'flat');
  b.rh=b.roof==='gable'?(b.front==='v'?(b.v1-b.v0):(b.u1-b.u0))*.42:0;
  b.goods=[];for(let i=0;i<6;i++)b.goods.push(rnd());
  b.rooftop=[];if(b.roof==='flat'&&!b.dome){const n=RI(0,3);for(let i=0;i<n;i++)b.rooftop.push({t:pick(['box','box','sky','tank','umb']),a:R(.15,.75),b:R(.15,.7)});}
  b.chim=b.roof==='gable'&&rnd()<.6;
  if(b.chim&&((Math.floor(b.u0)+Math.floor(b.v0))%3)<2){const um=(b.u0+b.u1)/2,vm=(b.v0+b.v1)/2;if(b.front==='v')addSmoke(b.u0+(b.u1-b.u0)*.7+3,vm-1,b.h+b.rh+10);else addSmoke(um,b.v0+(b.v1-b.v0)*.25+3,b.h+b.rh+10);}
  b.cx=(b.u0+b.u1)/2;b.cv=(b.v0+b.v1)/2;
  if(b.id)bld[b.id]=b;
  addBoxItem(b.u0,b.v0,b.u1,b.v1,b.h+b.rh+(b.dome?60:24)+(b.z||0)+(b.tall||0),c=>drawIsoBuilding(c,b));
  return b;
}
function drawWindow(c,x,y,w,h,f){
  c.lineWidth=.8;
  if(f.t==='balc'){c.lineWidth=.7;L(c,x-2,y+h+4,x+w+2,y+h+4);for(let k=0;k<=3;k++)L(c,x-2+k*(w+4)/3,y+h,x-2+k*(w+4)/3,y+h+4);}
  Rc(c,x,y,w,h,f.t==='dark'?'#5b5750':'#fdfcf8');
  if(f.t==='face'){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();c.translate(x+w/2,y+h-2.6);c.scale(.62,.62);drawHead(c,{head:f.head},1);c.restore();c.strokeRect(x,y,w,h);}
  else{c.lineWidth=.45;L(c,x+w/2,y,x+w/2,y+h);L(c,x,y+h*.45,x+w,y+h*.45);}
  c.lineWidth=.8;
  if(f.t==='shut'){Rc(c,x-3,y,2.8,h,'#a8a296');Rc(c,x+w+.2,y,2.8,h,'#a8a296');}
  if(f.t==='plant'){Rc(c,x-1,y+h-1,w+2,2.6,GREY);C(c,x+2,y+h-2,1.5,WHITE);C(c,x+w-2,y+h-2,1.5,WHITE);}
}
function drawFacade(c,w,h,b,front){
  c.strokeStyle=INK;c.lineJoin='round';
  const gf=Math.min(30,h*.46);
  c.lineWidth=.6;L(c,0,h-gf,w,h-gf);
  if(b.cols&&front){
    c.lineWidth=.9;const n=Math.max(4,Math.floor(w/20));
    for(let k=0;k<n;k++){const px=7+k*(w-14)/(n-1);Rc(c,px-2.6,12,5.2,h-16,WHITE);Rc(c,px-3.6,9.5,7.2,2.5,WHITE);}
    Rc(c,-2,h-3,w+4,3,WHITE);Rc(c,w/2-7,h-24,14,21,'#5b5750');
  }else{
    const y0=7,y1=h-gf-5;const rows=Math.max(0,Math.floor((y1-y0+5)/23));const cols=Math.max(1,Math.floor((w-4)/17));const gx=w/cols;let k=front?0:30;
    for(let r=0;r<rows;r++)for(let q=0;q<cols;q++)drawWindow(c,gx*q+gx/2-4,y0+r*23,8,12,b.villa&&front?{t:'shut'}:b.win[(k++)%b.win.length]);
  }
  c.lineWidth=.9;
  if(!front){if(!b.cols)for(let q=0;q<Math.max(1,Math.floor((w-4)/22));q++)drawWindow(c,(q+.5)*(w/Math.max(1,Math.floor((w-4)/22)))-4,h-gf+7,8,12,{t:'plain'});if(b.sideAd){Rc(c,w/2-14,10,28,16,WHITE);c.fillStyle=INK;c.font='6px "Patrick Hand", cursive';c.textAlign='center';c.textBaseline='middle';c.fillText(b.sideAd,w/2,18);}return;}
  const dw=b.bigDoor?28:10,dh=b.bigDoor?24:19,cx=w/2;
  if(b.cols){}
  else if(b.bigDoor){Rc(c,cx-dw/2,h-dh,dw,dh,'#d6d1c5');c.lineWidth=.45;for(let k=3;k<dh;k+=2.8)L(c,cx-dw/2,h-dh+k,cx+dw/2,h-dh+k);c.lineWidth=.9;}
  else{Rc(c,cx-dw/2,h-dh,dw,dh,'#cfc9bc');L(c,cx,h-dh,cx,h);}
  if(b.villa){for(const s of[-1,1])Rc(c,cx+s*10-1.6,h-26,3.2,26,WHITE);P(c,[[cx-15,h-26],[cx+15,h-26],[cx,h-33]],WHITE);}
  if(b.awn){
    const sw=cx-dw/2-9;
    if(sw>7)for(const sx of[4,cx+dw/2+5]){Rc(c,sx,h-19,sw,14,'#fdfcf8');c.lineWidth=.5;for(let k=0;k<2;k++){const gx=sx+3+k*(sw-6),g=b.goods[k];if(g<.5)C(c,gx,h-8,2,WHITE);else Rc(c,gx-1.2,h-12,2.4,6,WHITE);}c.lineWidth=.9;}
    const ay=h-gf+2;c.save();c.beginPath();c.rect(1,ay,w-2,8);c.fillStyle=WHITE;c.fill();c.clip();stripesIn(c,0,ay,w,ay+9,7,3.5,true,b.awnCol||'#9d978b');c.restore();c.strokeRect(1,ay,w-2,8);
    c.beginPath();for(let x=1;x<w-2;x+=7){c.moveTo(x,ay+8);c.arc(x+3.5,ay+8,3.5,PI,0,true);}c.fillStyle=WHITE;c.fill();c.stroke();
  }else if(!b.cols&&!b.bigDoor&&w>44){for(const sx of[5,w-13])drawWindow(c,sx,h-gf+8,8,12,{t:'plain'});}
  if(b.marquee){Rc(c,3,h-gf-12,w-6,10,'#3a3733');for(let k=6;k<w-5;k+=3.6)D(c,k,h-gf-10.6,.6,'#fff3c4');}
  if(b.cross){const yy=10;Rc(c,cx-6,yy-6,12,12,WHITE);c.fillStyle=RED;c.fillRect(cx-1.4,yy-4.4,2.8,8.8);c.fillRect(cx-4.4,yy-1.4,8.8,2.8);}
  if(b.sign){const fs=b.signSize||(b.cols?9:7.2);c.font=`${fs}px "Patrick Hand", cursive`;c.textAlign='center';c.textBaseline='middle';const tw=c.measureText(b.sign).width;const sy=b.cols?5:b.marquee?h-gf-18:h-gf-4;
    c.lineWidth=.8;Rc(c,cx-tw/2-3,sy-fs*.6,tw+6,fs*1.2,WHITE);c.fillStyle=INK;c.fillText(b.sign,cx,sy+.4);}
  if(b.ladder!==undefined){const lx=b.ladder;Rc(c,lx-6,h-78,12,15,'#2b2926');c.lineWidth=1.2;L(c,lx-5,h,lx-4,h-66);L(c,lx+5,h,lx+4,h-66);c.lineWidth=.8;for(let k=6;k<66;k+=7)L(c,lx-4.6,h-k,lx+4.6,h-k);}
}
function drawIsoBuilding(c,b){
  if(b.z)c.translate(0,-b.z);
  const{u0,v0,u1,v1,h,rh}=b;c.strokeStyle=INK;c.lineJoin='round';c.lineWidth=1.1;
  const side=b.tone===WHITE?'#ece7dc':'#e2dccf';
  const fl=b.front==='v'?b.tone:side, fr=b.front==='u'?b.tone:side;
  if(b.roof==='gable'){if(b.front==='v'){const vm=(v0+v1)/2;ip(c,[[u0,v0,h],[u1,v0,h],[u1,vm,h+rh],[u0,vm,h+rh]],WHITE);}else{const um=(u0+u1)/2;ip(c,[[u0,v0,h],[u0,v1,h],[um,v1,h+rh],[um,v0,h+rh]],WHITE);}}
  ip(c,[[u0,v1,0],[u1,v1,0],[u1,v1,h],[u0,v1,h]],fl);
  c.save();faceV(c,u0,v1,h);drawFacade(c,u1-u0,h,b,b.front==='v');c.restore();
  ip(c,[[u1,v1,0],[u1,v0,0],[u1,v0,h],[u1,v1,h]],fr);
  c.save();faceU(c,u1,v1,h);drawFacade(c,v1-v0,h,b,b.front==='u');c.restore();
  c.lineWidth=1.1;
  if(b.roof==='gable'){
    if(b.front==='v'){const vm=(v0+v1)/2;
      if(b.chim)drawBox(c,u0+(u1-u0)*.7,vm-4,h+rh*.3,6,6,rh*.7+10);
      ip(c,[[u1,v1,h],[u1,v0,h],[u1,vm,h+rh]],fr);
      ip(c,[[u0,v1,h],[u1,v1,h],[u1,vm,h+rh],[u0,vm,h+rh]],WHITE);
      c.lineWidth=.5;for(let k=1;k<4;k++){const f=k/4,vv=v1-(v1-vm)*f,zz=h+rh*f;const a=pr(u0,vv,zz),bb=pr(u1,vv,zz);L(c,a[0],a[1],bb[0],bb[1]);}
    }else{const um=(u0+u1)/2;
      if(b.chim)drawBox(c,um-3,v0+(v1-v0)*.25,h+rh*.3,6,6,rh*.7+10);
      ip(c,[[u0,v1,h],[u1,v1,h],[um,v1,h+rh]],fl);
      ip(c,[[u1,v0,h],[u1,v1,h],[um,v1,h+rh],[um,v0,h+rh]],WHITE);
      c.lineWidth=.5;for(let k=1;k<4;k++){const f=k/4,uu=u1-(u1-um)*f,zz=h+rh*f;const a=pr(uu,v0,zz),bb=pr(uu,v1,zz);L(c,a[0],a[1],bb[0],bb[1]);}
    }
  }else{
    ip(c,[[u0,v0,h],[u1,v0,h],[u1,v1,h],[u0,v1,h]],WHITE);
    c.lineWidth=.5;ip(c,[[u0+2.5,v0+2.5,h],[u1-2.5,v0+2.5,h],[u1-2.5,v1-2.5,h],[u0+2.5,v1-2.5,h]],null);c.lineWidth=1;
    for(const t of b.rooftop){const pu=u0+(u1-u0)*t.a,pv=v0+(v1-v0)*t.b;
      if(t.t==='box')drawBox(c,pu-4,pv-4,h,8,8,6);
      else if(t.t==='sky'){ip(c,[[pu-5,pv-4,h],[pu+5,pv-4,h],[pu+5,pv+4,h],[pu-5,pv+4,h]],'#cfd6d4');}
      else if(t.t==='tank'){const[x,y]=pr(pu,pv,h);Rc(c,x-5,y-14,10,12,WHITE);E(c,x,y-14,5,2.5,WHITE);E(c,x,y-2,5,2.5,null);}
      else{const[x,y]=pr(pu,pv,h);c.lineWidth=1;L(c,x,y,x,y-14);c.beginPath();c.moveTo(x-9,y-13);c.quadraticCurveTo(x,y-22,x+9,y-13);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();}
    }
    if(b.dome){const[x,y]=pr(b.cx,b.cv,h);const r=Math.min(u1-u0,v1-v0)*.42;E(c,x,y,r,r/2,WHITE);c.beginPath();c.ellipse(x,y,r,r*1.05,0,PI,TAU);c.fillStyle=WHITE;c.fill();c.stroke();c.lineWidth=.5;for(const f of[.35,.7]){c.beginPath();c.ellipse(x,y,r*f,r*1.05,0,PI,TAU);c.stroke();}c.lineWidth=1;L(c,x,y-r*1.05,x,y-r*1.05-10);P(c,[[x,y-r*1.05-14],[x+7,y-r*1.05-12],[x,y-r*1.05-9]],RED);}
  }
  if(b.after)b.after(c);
}

/* rangées de bâtiments au fond d'un îlot : rangée A le long de u (façade vers +v), rangée B le long de v (façade vers +u) */
function townBlock(i,j,A,B,opt){
  opt=opt||{};const k=blk(i,j);
  let u=k.u0+(opt.padA||0);const list=[];
  const all=A.slice();
  for(let n=0;n<all.length||(!opt.noFillA&&k.u1-u>30);n++){
    const sp=all[n]||{};let w=sp.w||RI(42,64);if(u+w>k.u1)w=k.u1-u;if(w<26)break;
    const b=makeBuilding(Object.assign({h:RI(56,96)},sp,{u0:u,v0:k.v0,u1:u+w,v1:k.v0+(sp.dep||DEP),front:'v'}));list.push(b);u+=w+(sp.gap||0);
  }
  if(B){let v=k.v0+DEP+(opt.gapB??26);
    for(let n=0;n<B.length||(!opt.noFillB&&k.v1-v>30);n++){
      const sp=B[n]||{};let d=sp.w||RI(42,60);if(v+d>k.v1)d=k.v1-v;if(d<26)break;
      const b=makeBuilding(Object.assign({h:RI(40,64)},sp,{u0:k.u0,v0:v,u1:k.u0+(sp.dep||DEP-4),v1:v+d,front:'u'}));list.push(b);v+=d+(sp.gap||0);
    }}
  const pu0=k.u0+(B?DEP:0),pv0=k.v0+DEP;
  if(!opt.noLamps){addLamp(k.u1-8,k.v1-8);addLamp(k.u1-8,pv0+20);addLamp(pu0+20,k.v1-8);}
  if(!opt.noTrees){addTree(k.u1-30,k.v1-16);addTree(k.u1-16,(pv0+k.v1)/2);}
  if(!opt.noArea)areas.push({u0:pu0+8,v0:pv0+8,u1:k.u1-8,v1:k.v1-8,n:opt.n??26,dist:CURD});
  return{k,list,pu0,pv0};
}
function park(i,j,name,opt){
  opt=opt||{};const k=blk(i,j);const tufts=[];for(let n=0;n<240;n++)tufts.push([R(k.u0+8,k.u1-8),R(k.v0+8,k.v1-8)]);
  G(k.u0,k.v0,k.u1,k.v1,c=>{c.strokeStyle=INK;c.lineWidth=1;rectG(c,k.u0+4,k.v0+4,k.u1-4,k.v1-4,'#e6e4d0');c.setLineDash([5,4]);c.lineWidth=.8;rectG(c,k.u0+9,k.v0+9,k.u1-9,k.v1-9,null);c.setLineDash([]);
    if(name)groundText(c,k.u0+14,k.v0+16,name,15);
    if(LOD<.6)return;c.strokeStyle='#8f8a7c';c.lineWidth=.6;c.beginPath();for(const[u,v]of tufts){const[x,y]=pr(u,v,0);c.moveTo(x-2,y-3);c.lineTo(x,y);c.lineTo(x+2,y-3.5);}c.stroke();});
  return k;
}
function pathG(pts,wd){G(Math.min(...pts.map(p=>p[0]))-wd,Math.min(...pts.map(p=>p[1]))-wd,Math.max(...pts.map(p=>p[0]))+wd,Math.max(...pts.map(p=>p[1]))+wd,c=>{c.save();groundT(c);c.lineCap='round';c.lineJoin='round';c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1]));c.strokeStyle=INK;c.lineWidth=wd+2;c.stroke();c.strokeStyle='#f6f2e8';c.lineWidth=wd;c.stroke();c.restore();});}
function waterG(u0,v0,u1,v1,seed){const rr=mulberry32(seed||3);const waves=[];const n=Math.round((u1-u0)*(v1-v0)/1600);for(let k=0;k<n;k++)waves.push([u0+rr()*(u1-u0),v0+rr()*(v1-v0)]);
  G(u0,v0,u1,v1,c=>{c.strokeStyle=INK;c.lineWidth=1.2;rectG(c,u0,v0,u1,v1,'#dce4e2');c.lineWidth=.6;for(const[u,v]of waves){const[x,y]=pr(u,v,0);c.beginPath();c.arc(x,y,4,PI*1.15,PI*1.85);c.stroke();}});
  {const gl=[];const m=Math.max(4,Math.round(n/3));for(let k=0;k<m;k++)gl.push([u0+6+rr()*(u1-u0-12),v0+6+rr()*(v1-v0-12),rr()*6.28]);addMover(bbBox(u0,v0,u1,v1,0),(c,t)=>{c.strokeStyle='#ffffff';c.lineWidth=1.2;for(const[u,v,ph]of gl){const a=Math.sin(t*1.3+ph);if(a<.2)continue;const[x,y]=pr(u+Math.sin(t*.4+ph)*3,v,0);c.globalAlpha=(a-.2)*1.1;c.beginPath();c.arc(x,y+1.5,3.4,PI*1.15,PI*1.85);c.stroke();}c.globalAlpha=1;});}}

/* ---------- foule ---------- */
const BODIES=['coat','coat','dress','suit','shirt'];
const NEWBODIES=['robe','overalls','poncho','tutu','puffer'];const vrng=mulberry32(77031);
const FILLS=['white','white','white','grey','black','stripes','dots','check'];
const HATS=['none','none','none','none','top','cap','beret','bow','straw','flower','glasses'];
const PROPS=[null,null,null,null,'bag','umbrella','newspaper','flowers','icecream','baguette','balloon','book','leash','cane','letter','camera'];
const POSES=['stand','stand','walk','walk','walk','point'];
const RESERVED=new Set(['rabbit|stripes','cat|stripes','cat|dots','cat|grey','cat|black','fox|black','fox|stripes','owl|grey','bear|grey','bear|black','bear|stripes','duck|black','duck|dots','hedgehog|check','mouse|dots','croc|check','pig|chef','owl|black','owl|stripes','elephant|dots','croc|grey','croc|black','frog|check','pig|black','rabbit|grey','rabbit|black','mouse|check','lion|grey']);
function randomSpec(beach){
  for(;;){const s={head:pick(HEADS),body:pick(BODIES),fill:pick(FILLS),hat:pick(HATS),prop:pick(PROPS),pose:pick(POSES),flip:rnd()<.5};
    if(beach){s.body=pick(['shirt','shirt','dress']);s.hat=pick(['none','none','straw','glasses','cap']);s.prop=pick([null,null,'icecream','ring','book','camera']);}
    if(RESERVED.has(s.head+'|'+s.fill))continue;
    if(s.head==='fox'&&s.hat==='cap')continue;if(s.head==='owl'&&s.hat==='beret')continue;if(s.head==='bear'&&s.hat==='top')continue;if(s.head==='cat'&&(s.prop==='flowers'||s.hat==='cap'||s.hat==='bow'))continue;if(s.head==='croc'&&s.hat==='cap')continue;if(s.head==='mouse'&&(s.hat==='cap'||s.hat==='bow'))continue;if(s.head==='pig'&&s.hat==='flower')continue;if(s.head==='lion'&&s.hat==='top')continue;if(s.head==='penguin')s.hat='none';if(s.head==='hedgehog'&&s.hat==='beret')continue;if(rnd()<.14)s.scarf=pick(['#3a3733','#c9c2b2',WHITE]);if(rnd()<.12)s.pack=pick([GREY,'#3a3733']);{const r=rnd();s.build=r<.42?'normal':r<.56?'round':r<.68?'slim':r<.78?'tall':r<.9?'old':'small';}if(s.build==='small'){s.scale=.84;if(s.hat==='top')s.hat='none';}if(s.build==='old'&&rnd()<.6&&!beach)s.prop='cane';
    if(!beach){const r=rnd();if(r<.05)s.pose='wave';else if(r<.09)s.pose='lean';else if(r<.12)s.pose='crouch';else if(r<.15)s.pose='think';else if(r<.18)s.pose='ground';}
    if(s.head==='rabbit'&&s.hat!=='none'&&s.hat!=='glasses'&&s.hat!=='flower'&&s.hat!=='bow')s.hat='none';
    {const a=vrng(),b=vrng(),c2=vrng();                                 // variété : hasard indépendant du reste
     if(a<.2){s.head=NEWHEADS[Math.floor(c2*NEWHEADS.length)];if(s.head==='sheep'&&(s.hat==='top'||s.hat==='bow'||s.hat==='cap'||s.hat==='beret'))s.hat='none';if(s.head==='giraffe'&&(s.hat==='top'||s.hat==='cap'||s.hat==='beret'))s.hat='none';if((s.head==='hippo'||s.head==='turtle')&&s.hat==='top')s.hat='none';if(s.fill==='black'||s.fill==='stripes')s.fill='grey';}
     if(!beach&&b<.3){s.body=NEWBODIES[Math.floor(vrng()*NEWBODIES.length)];if(s.body==='tutu'&&s.pose==='sit')s.body='dress';}}
    return s;}
}
function free(u,v,pad){
  for(const a of avoidC){const du=u-a.u,dv=v-a.v;if(du*du+dv*dv<(a.r+(pad||0))**2)return false;}
  for(const r of avoidR)if(u>r[0]&&u<r[2]&&v>r[1]&&v<r[3])return false;
  for(const o of occupied)if(Math.abs(u-o.u)<8&&Math.abs(v-o.v)<8)return false;
  return true;
}

