
/* =========================================================
   ACTEURS ANIMÉS : voitures qui roulent, passants qui marchent.
   Ils ne sont pas dans les tuiles : on les dessine à chaque image
   par-dessus, puis on redessine (rognés à leur zone) les éléments qui
   se trouvent DEVANT eux (immeubles, personnages…), pour qu'ils passent
   derrière un coin de bâtiment au lieu de flotter par-dessus.
   ========================================================= */
const actors=[];let actorGrid=null;
const arng=mulberry32(424242);const ap=a=>a[Math.floor(arng()*a.length)];
/* voies : [quartier, axe, coordonnée fixe, début, fin] */
const LANES=[];
(function(){const S=[22,306,590,874,1158];
  for(const v of[22,306,874,1158])LANES.push([0,'u',v,34,1146]);
  for(const u of S)LANES.push([0,'v',u,34,1146]);
  for(const v of[22,306,590,874])LANES.push([1,'u',v,1196,1736]);
  for(const u of[1442,1726])LANES.push([1,'v',u,34,868]);
  for(const v of[1442,1726,2010])LANES.push([2,'u',v,34,1146]);
  for(const u of S)LANES.push([2,'v',u,1196,2024]);
  for(const v of[1442,1726,2010])LANES.push([3,'u',v,1196,2024]);
  LANES.push([3,'v',1442,1724,2024],[3,'v',1726,1724,2024],[3,'v',2010,1190,1444]);
  LANES.push([4,'u',2294,890,1444],[4,'u',2578,890,1444],[4,'v',1158,2040,2590],[4,'v',1442,2040,2590]);})();
const AFILL=['white','white','white','grey','stripes','dots','check'],AHAT=['none','none','none','cap','beret','straw','glasses','bow'],ABODY=['coat','shirt','dress','suit','robe','overalls','poncho','puffer'];
function actorSpec(){for(;;){const s={head:ap(HEADS.concat(NEWHEADS)),body:ap(ABODY),fill:ap(AFILL),hat:ap(AHAT),prop:arng()<.25?ap(['bag','umbrella','newspaper','book','baguette','icecream']):null,build:ap(['normal','normal','round','slim','tall','small','old'])};
  if(RESERVED.has(s.head+'|'+s.fill))continue;if(s.head==='rabbit'&&s.hat!=='none'&&s.hat!=='glasses'&&s.hat!=='bow')s.hat='none';
  if((s.head==='sheep'||s.head==='giraffe')&&s.hat!=='none'&&s.hat!=='glasses')s.hat='none';if(s.head==='cat'&&(s.hat==='cap'||s.hat==='bow'))s.hat='none';if(s.build==='small')s.scale=.85;
  if(s.build==='old'&&!s.prop)s.prop='cane';return s;}}
function targetZones(){const z=[];for(const cs of CASES)for(const st of cs.steps){for(const q of(st.ts||[st.t]))if(q)z.push([q.x,q.y,q.r]);}return z;}
function buildActors(){
  for(const[dist,ax,fixed,lo,hi]of LANES){const L=hi-lo;
    const nc=L>700?2:1;
    for(let i=0;i<nc;i++){const side=i%2?1:-1;
      actors.push({kind:'car',dist,ax,fixed:fixed+side*9,lo,hi,L,speed:15+arng()*17,dir:side,phase:arng()*L,col:ap([WHITE,WHITE,GREY,'#3a3733',LGREY]),driver:arng()<.55?actorSpec():null});}
    const nw=Math.max(1,Math.round(L/300));
    for(let i=0;i<nw;i++){const side=arng()<.5?1:-1;
      actors.push({kind:'walk',dist,ax,fixed:fixed+side*19.5,lo,hi,L,speed:6+arng()*6,dir:arng()<.5?1:-1,phase:arng()*L,spec:actorSpec(),off:arng()*4});}}
  /* un passant ou une voiture ne doit jamais passer sur une scène à trouver : on retire ceux dont la route la croise */
  const Z=targetZones();let kept=0;
  for(let i=actors.length-1;i>=0;i--){const a=actors[i];let hit=false;
    for(let s=0;s<a.L&&!hit;s+=10){const p=a.lo+s,u=a.ax==='u'?p:a.fixed,v=a.ax==='u'?a.fixed:p,[x,y]=pr(u,v,0);
      for(const[zx,zy,zr]of Z){if(Math.hypot(x-zx,y-14-zy)<zr+10){hit=true;break;}}}
    if(hit)actors.splice(i,1);else kept++;}
  buildActors.kept=kept;
}
function actorPos(a,t){const s=((a.phase+a.dir*a.speed*t)%a.L+a.L)%a.L,p=a.lo+s;return a.ax==='u'?[p,a.fixed]:[a.fixed,p];}
function buildActorGrid(){actorGrid=new Map();const cell=150;items.forEach((it,i)=>{it.idx=i;const b=it.bb;for(let gx=Math.floor(b[0]/cell);gx<=Math.floor(b[2]/cell);gx++)for(let gy=Math.floor(b[1]/cell);gy<=Math.floor(b[3]/cell);gy++){const k=gx*100003+gy;let a=actorGrid.get(k);if(!a)actorGrid.set(k,a=[]);a.push(it);}});}
function actorCandidates(bb){const cell=150,seen=new Set(),out=[];
  for(let gx=Math.floor(bb[0]/cell);gx<=Math.floor(bb[2]/cell);gx++)for(let gy=Math.floor(bb[1]/cell);gy<=Math.floor(bb[3]/cell);gy++){const a=actorGrid.get(gx*100003+gy);if(!a)continue;
    for(const it of a){if(seen.has(it))continue;seen.add(it);const b=it.bb;if(b[2]<bb[0]||b[0]>bb[2]||b[3]<bb[1]||b[1]>bb[3])continue;out.push(it);}}
  out.sort((p,q)=>p.idx-q.idx);return out;}
const behindFp=(a,b)=>a[2]<=b[0]||a[3]<=b[1];
function actorFront(A,it){if(!A.box&&!it.box)return it.key>A.key;const ab=behindFp(A.fp,it.fp),ba=behindFp(it.fp,A.fp);if(ab&&!ba)return true;if(ba&&!ab)return false;return it.key>A.key;}
const WALKPOSE=['walk','step','walk2','step'];
function drawActors(c,view,t,p){
  if(p<.32||!actors.length)return 0;if(!actorGrid)buildActorGrid();
  const vis=[];
  for(const a of actors){if(!unlocked(a.dist))continue;const[u,v]=actorPos(a,t),[x,y]=pr(u,v,0);if(x<view[0]-60||x>view[2]+60||y<view[1]-70||y>view[3]+30)continue;vis.push({a,u,v,x,y,key:u+v});}
  vis.sort((m,n)=>m.key-n.key);
  const oldLOD=LOD;LOD=Math.max(p,.5);
  for(const m of vis){const a=m.a;let fp,bb,box;
    if(a.kind==='car'){const hu=a.ax==='u'?14:7,hv=a.ax==='u'?7:14;fp=[m.u-hu,m.v-hv,m.u+hu,m.v+hv];bb=bbBox(fp[0],fp[1],fp[2],fp[3],30);box=true;}
    else{fp=[m.u,m.v,m.u,m.v];bb=[m.x-26,m.y-60,m.x+26,m.y+8];box=false;}
    c.save();
    if(a.kind==='car')drawIsoCar(c,m.u,m.v,a.ax,a.col,a.driver);
    else{const fr=Math.floor(t*5+a.off)%4;drawChar(c,m.x,m.y+(fr%2?0:-.7),Object.assign({},a.spec,{pose:WALKPOSE[fr],flip:a.ax==='u'?a.dir<0:a.dir>0}));}
    c.restore();
    const A={fp,box,key:m.key};
    for(const it of actorCandidates(bb)){if(!it.fp||!unlocked(it.dist)||!actorFront(A,it))continue;c.save();c.beginPath();c.rect(bb[0],bb[1],bb[2]-bb[0],bb[3]-bb[1]);c.clip();it.d(c);c.restore();}}
  LOD=oldLOD;return vis.length;}
