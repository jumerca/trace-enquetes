
/* =========================================================
   RENDU & CAMÉRA
   ========================================================= */
const WB={x0:-2630,y0:-150,x1:2920,y1:2420};
const cv=document.getElementById('map'),ctx=cv.getContext('2d');
let vw=0,vh=0,dpr=1,LOD=1;
const cam={x:0,y:400,s:.5};
let minS=.1,maxS=7,cache=null,cacheKey='',cacheS=.5,needs=false;
const fx={wrong:[],pulse:null};
const NSLOTS=3,SLOTKEY=n=>'animopolis-s'+n;
const freshState=()=>({solved:{},hints:{},wrong:{},part:{},best:{},current:null,seen:false,unlockSeen:{}});
const LEGACY_LEN={chaton:5,gateau:5,lettre:9,collier:15,poisson:5,tresor:10,banque:15,ballon:5,fantome:10,zorbo:15,valise:5,colis:10,recette:15,lili:5,farine:10,couronne:15,ombre:20,vase:5,chapeau:5,phare:8,peche:5,tickets:8,chiot:5,controleur:7,oeufs:5,tartes:8,bouteille:5,volcan:9,epave:15};
const caseLens=()=>Object.fromEntries(CASES.map(c=>[c.id,c.steps.length]));
/* Quand une enquête gagne des étapes : une enquête déjà classée reste classée, une enquête commencée repart de zéro. */
function migrate(d){if(!d||!d.solved)return d;const L=d.caseLen||LEGACY_LEN;
  for(const c of CASES){const old=L[c.id];if(!old||old===c.steps.length)continue;const n=(d.solved[c.id]||[]).filter(Boolean).length;
    if(n>=old)d.solved[c.id]=c.steps.map(()=>true);
    else if(n>0){d.solved[c.id]=[];for(const k of Object.keys(d.hints||{}))if(k.startsWith(c.id+':'))delete d.hints[k];if(d.part)for(const k of Object.keys(d.part))if(k.startsWith(c.id+':'))delete d.part[k];}}
  d.caseLen=caseLens();return d;}
let built=false;
function readSlot(n){try{const d=JSON.parse(localStorage.getItem(SLOTKEY(n))||'null');return built?migrate(d):d;}catch(e){return null;}}
var opts={anim:true};try{Object.assign(opts,JSON.parse(localStorage.getItem('animopolis-opts')||'{}'));}catch(e){}
function saveOpts(){try{localStorage.setItem('animopolis-opts',JSON.stringify(opts));}catch(e){}}
let slot=1;try{slot=+localStorage.getItem('animopolis-active')||1;
  if(!localStorage.getItem(SLOTKEY(1))){const old=localStorage.getItem('animopolis-v3');if(old){localStorage.setItem(SLOTKEY(1),old);try{const o=JSON.parse(old);if(typeof o.anim==='boolean')opts.anim=o.anim;}catch(e){}}}}catch(e){}
let state=Object.assign(freshState(),readSlot(slot)||{});
function setState(d){for(const k of Object.keys(state))delete state[k];Object.assign(state,freshState(),d||{});}
function save(){try{state.saved=Date.now();state.caseLen=caseLens();localStorage.setItem(SLOTKEY(slot),JSON.stringify(state));localStorage.setItem('animopolis-active',String(slot));}catch(e){}}
const caseDone=cs=>(state.solved[cs.id]||[]).filter(Boolean).length===cs.steps.length;
const doneIn=d=>CASES.filter(cs=>cs.dist===d&&caseDone(cs)).length;
const mediumOf=d=>CASES.find(c=>c.dist===d&&c.diff===2&&!c.final);
const started=cs=>(state.solved[cs.id]||[]).some(Boolean);
const unlocked=d=>d===0||(unlocked(d-1)&&(caseDone(mediumOf(d-1))||CASES.some(c=>c.dist===d&&!c.final&&started(c))));
const cluesFound=()=>HARD.filter(id=>caseDone(CASES.find(c=>c.id===id))).length;
function caseOpen(cs){if(started(cs))return true;if(!unlocked(cs.dist))return false;if(cs.final)return cluesFound()===HARD.length;if(cs.diff===1)return true;return CASES.some(c=>c.dist===cs.dist&&!c.final&&c.diff===cs.diff-1&&caseDone(c));}
function hintsUsed(cs,d){d=d||state;let n=0;for(const k in(d.hints||{}))if(k.startsWith(cs.id+':'))n+=+d.hints[k]||0;return n;}
function caseStars(cs,d){d=d||state;if((d.solved[cs.id]||[]).filter(Boolean).length!==cs.steps.length)return 0;const h=hintsUsed(cs,d),w=(d.wrong||{})[cs.id]||0;return h===0&&w<=2?3:h<=2&&w<=6?2:1;}
const starStr=n=>'★'.repeat(n)+'☆'.repeat(3-n);
function addWrong(cs){if(chal){chal.pen+=5;toastNext='+5 secondes';return;}state.wrong=state.wrong||{};state.wrong[cs.id]=(state.wrong[cs.id]||0)+1;save();}
const totalStars=()=>CASES.reduce((a,c)=>a+caseStars(c),0);
const RANKS=[[0,'Apprenti détective'],[10,'Fin limier'],[25,'Inspecteur en herbe'],[45,'Inspecteur chevronné'],[60,'Commissaire'],[75,"Légende d'Animopolis"]];
const rankOf=n=>RANKS.filter(r=>n>=r[0]).pop()[1];
const KEYCHAR={chaton:[1,'Le fugueur'],gateau:[1,'Le voleur de gâteau'],lettre:[0,"L'amoureux"],collier:[1,'Le cambrioleur'],ombre:[1,"L'Ombre"],vase:[null,'La maladroite'],
 poisson:[1,'Le voleur de poisson'],tresor:[1,'La chasseuse de trésor'],banque:[1,'Le braqueur'],chapeau:[0,'La propriétaire'],phare:[null,'Le contrebandier'],
 ballon:[2,'Le héros du jour'],fantome:[2,'Le faux fantôme'],zorbo:[0,'Le magicien endetté'],peche:[null,'Le tricheur'],tickets:[0,'Le resquilleur'],
 valise:[1,'Le distrait'],colis:[0,'Le propriétaire du colis'],recette:[4,'Le commanditaire'],chiot:[1,'Le fugueur'],controleur:[null,'Le faux contrôleur'],
 lili:[1,'Le gourmand'],farine:[1,'Les voleurs de farine'],couronne:[1,'Le bouffon voleur'],oeufs:[0,'La cacheuse d\'œufs'],bouteille:[0,'Le petit explorateur'],volcan:[null,'Le faux volcan'],epave:[1,'Le Baron'],bobo:[1,'Le chat voleur'],tartes:[null,'Le gourmand au miel']};
function keySpec(cs){const kc=KEYCHAR[cs.id]||[0,''];if(kc[0]===null){const st=cs.steps[cs.steps.length-1];return st.choice[st.ans].s;}return(cs.cast[kc[0]]||cs.cast[0]).s;}
function showBook(){const n=CASES.filter(caseDone).length,st=totalStars(),max=CASES.length*3;
  const ordered=[...CASES].sort((a,b)=>a.dist-b.dist||(a.final?1:0)-(b.final?1:0)||a.diff-b.diff);
  openModal(`<h2>📒 Carnet d'enquêteur</h2><p class="rank">${rankOf(st)}</p>
  <div class="statrow"><div class="stat"><b>${n}/${CASES.length}</b><span>enquêtes classées</span></div><div class="stat"><b class="stars">${st}★</b><span>sur ${max}</span></div><div class="stat"><b>${cluesFound()}/5</b><span>indices de l'Ombre</span></div></div>
  <p class="legend">3 étoiles : sans indice et avec 2 erreurs au plus. Rejoue une enquête depuis les Dossiers pour améliorer ta note.</p>
  <h3>Fiches des affaires</h3><div class="gallery">${ordered.map(cs=>caseDone(cs)?`<div class="mug"><div data-m="${cs.id}"></div><b>${(KEYCHAR[cs.id]||[0,''])[1]}</b>${cs.title}<br><span class="stars">${starStr(caseStars(cs))}</span>${(state.best||{})[cs.id]?`<br>⏱ ${fmtT(state.best[cs.id])} ${medal(cs,state.best[cs.id])}`:''}</div>`:`<div class="mug no"><div class="q">?</div><b>???</b>${caseOpen(cs)?cs.title:'Enquête fermée'}</div>`).join('')}</div>
  <button class="btn" id="okB">Fermer le carnet</button>`,r=>{r.querySelectorAll('[data-m]').forEach(el=>el.appendChild(portrait(keySpec(CASES.find(c=>c.id===el.dataset.m)))));r.querySelector('#okB').onclick=closeModal;});}
function lockReason(cs){if(!unlocked(cs.dist))return 'Ce quartier n\'est pas encore ouvert.';if(cs.final)return `Réunis les 5 indices de l'Ombre (${cluesFound()}/5) en résolvant les enquêtes difficiles.`;if(cs.diff===2)return 'Résous d\'abord une enquête facile de ce quartier.';const m=mediumOf(cs.dist);return `Résous d'abord « ${m.title} ».`;}

function resize(){dpr=Math.min(2,window.devicePixelRatio||1);vw=window.innerWidth;vh=window.innerHeight;cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);minS=Math.min(vw/(WB.x1-WB.x0),vh/(WB.y1-WB.y0))*.95;clampCam();req();}
function clampCam(){cam.s=Math.max(minS,Math.min(maxS,cam.s));const hw=vw/2/cam.s,hh=vh/2/cam.s;
  cam.x=hw*2>=WB.x1-WB.x0?(WB.x0+WB.x1)/2:Math.max(WB.x0+hw,Math.min(WB.x1-hw,cam.x));
  cam.y=hh*2>=WB.y1-WB.y0?(WB.y0+WB.y1)/2:Math.max(WB.y0+hh,Math.min(WB.y1-hh,cam.y));}
function drawLocked(c,D){
  c.strokeStyle=INK;c.lineWidth=1.2;
  ip(c,[[D.u0,D.v1,0],[D.u1,D.v1,0],[D.u1,D.v1,-SLAB],[D.u0,D.v1,-SLAB]],'#d2ccbe');
  ip(c,[[D.u1,D.v1,0],[D.u1,D.v0,0],[D.u1,D.v0,-SLAB],[D.u1,D.v1,-SLAB]],'#c4bdad');
  rectG(c,D.u0,D.v0,D.u1,D.v1,'#e4dfd3');
  c.save();c.beginPath();[[D.u0,D.v0],[D.u1,D.v0],[D.u1,D.v1],[D.u0,D.v1]].map(p=>pr(p[0],p[1],0)).forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.clip();
  c.strokeStyle='#cfc8b8';c.lineWidth=1;for(let x=-2000;x<3000;x+=14){c.beginPath();c.moveTo(x,-200);c.lineTo(x+1600,1400);c.stroke();}c.restore();
  c.setLineDash([6,6]);c.strokeStyle='#a39c8c';
  for(const[i,j]of D.blocks){const k=blk(i,j);rectG(c,k.u0,k.v0,k.u1,k.v1,null);}
  for(const e of(D.extra||[]))rectG(c,e[0],e[1],e[2],e[3],null);c.setLineDash([]);
  const[x,y]=pr((D.u0+D.u1)/2,(D.v0+D.v1)/2,0);
  c.fillStyle=WHITE;c.strokeStyle=INK;c.lineWidth=2;c.beginPath();c.rect(x-150,y-62,300,108);c.fill();c.stroke();
  c.fillStyle=INK;c.textAlign='center';c.textBaseline='middle';c.font='38px "Patrick Hand", cursive';c.fillText('🔒 '+D.name,x,y-30);
  c.font='19px "Patrick Hand", cursive';const di=DISTRICTS.indexOf(D);c.fillText(`Résous « ${mediumOf(di-1).title} »`,x,y+12);
}
function drawWorld(c,view){
  const lock=DISTRICTS.map((d,i)=>!unlocked(i));
  for(const g of groundL){if(lock[g.dist])continue;const b=g.bb;if(b[2]<view[0]||b[0]>view[2]||b[3]<view[1]||b[1]>view[3])continue;c.save();g.d(c);c.restore();}
  DISTRICTS.forEach((D,i)=>{if(lock[i]){c.save();drawLocked(c,D);c.restore();}});
  for(const list of[items,topItems])for(const it of list){if(lock[it.dist])continue;const b=it.bb;if(b[2]<view[0]||b[0]>view[2]||b[3]<view[1]||b[1]>view[3])continue;c.save();it.d(c);c.restore();}
}
function buildCache(){cache=document.createElement('canvas');cache.width=Math.round((WB.x1-WB.x0)*cacheS);cache.height=Math.round((WB.y1-WB.y0)*cacheS);
  const c=cache.getContext('2d');c.setTransform(cacheS,0,0,cacheS,-WB.x0*cacheS,-WB.y0*cacheS);const old=LOD;LOD=1;drawWorld(c,[WB.x0,WB.y0,WB.x1,WB.y1]);LOD=old;cacheKey=DISTRICTS.map((d,i)=>unlocked(i)).join();}
function req(){if(needs)return;needs=true;requestAnimationFrame(render);}
/* rendu par tuiles : chaque morceau de carte est dessiné une fois puis réutilisé */
let reveal=null,animTimer=0,chal=null;const TILE=256,LEVELS=[.5,1,2,3],MAXT=140,tiles=new Map();let tileKeyAll='',frameN=0,pending=false;
const ukey=()=>DISTRICTS.map((d,i)=>unlocked(i)).join();
function clearTiles(){tiles.clear();cache=null;}
function makeTile(Lv,tx,ty){const c=document.createElement('canvas');c.width=TILE;c.height=TILE;const g=c.getContext('2d');g.fillStyle='#e3ded2';g.fillRect(0,0,TILE,TILE);
  g.setTransform(Lv,0,0,Lv,-tx*TILE,-ty*TILE);const old=LOD;LOD=Lv;drawWorld(g,[tx*TILE/Lv-2,ty*TILE/Lv-2,(tx+1)*TILE/Lv+2,(ty+1)*TILE/Lv+2]);LOD=old;return c;}
function render(){
  needs=false;frameN++;const k0=ukey();if(k0!==tileKeyAll){tileKeyAll=k0;clearTiles();}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#e3ded2';ctx.fillRect(0,0,vw,vh);
  const s=cam.s,ox=vw/2-cam.x*s,oy=vh/2-cam.y*s,p=s*dpr;
  const view=[cam.x-vw/2/s-10,cam.y-vh/2/s-10,cam.x+vw/2/s+10,cam.y+vh/2/s+10];
  if(!cache)buildCache();
  ctx.setTransform(dpr*s,0,0,dpr*s,dpr*ox,dpr*oy);
  if(p<=cacheS*1.05){ctx.drawImage(cache,WB.x0,WB.y0,WB.x1-WB.x0,WB.y1-WB.y0);}
  else if(p>3.3){LOD=p;drawWorld(ctx,view);}
  else{
    ctx.drawImage(cache,WB.x0,WB.y0,WB.x1-WB.x0,WB.y1-WB.y0);
    const Lv=LEVELS.find(l=>l>=p*.92)||3,k=p/Lv;
    const tx0=Math.floor(view[0]*Lv/TILE),tx1=Math.floor(view[2]*Lv/TILE),ty0=Math.floor(view[1]*Lv/TILE),ty1=Math.floor(view[3]*Lv/TILE);
    ctx.setTransform(1,0,0,1,0,0);
    const budget=performance.now()+(ptrs.size||anim?7:24);let missing=0;
    const cx=(tx0+tx1)/2,cy=(ty0+ty1)/2,list=[];for(let ty=ty0;ty<=ty1;ty++)for(let tx=tx0;tx<=tx1;tx++)list.push([tx,ty]);list.sort((a,b)=>Math.hypot(a[0]-cx,a[1]-cy)-Math.hypot(b[0]-cx,b[1]-cy));
    for(const[tx,ty]of list){const key=Lv+':'+tx+':'+ty;let t=tiles.get(key);
      if(!t){if(performance.now()<budget){t={c:makeTile(Lv,tx,ty)};tiles.set(key,t);}else{missing++;continue;}}
      t.f=frameN;const x=Math.floor((tx*TILE/Lv-cam.x)*p+vw*dpr/2),y=Math.floor((ty*TILE/Lv-cam.y)*p+vh*dpr/2),x2=Math.ceil(((tx+1)*TILE/Lv-cam.x)*p+vw*dpr/2),y2=Math.ceil(((ty+1)*TILE/Lv-cam.y)*p+vh*dpr/2);
      ctx.drawImage(t.c,x,y,x2-x,y2-y);}
    if(tiles.size>MAXT){const arr=[...tiles.entries()].sort((a,b)=>a[1].f-b[1].f);for(let i=0;i<tiles.size-MAXT;i++)tiles.delete(arr[i][0]);}
    if(missing&&!pending){pending=true;setTimeout(()=>{pending=false;req();},ptrs.size?40:0);}
    ctx.setTransform(dpr*s,0,0,dpr*s,dpr*ox,dpr*oy);
  }
  {let anyM=false;const tA=animT();for(const m of movers){if(!unlocked(m.dist))continue;const bb=m.bb;if(bb[2]<view[0]||bb[0]>view[2]||bb[3]<view[1]||bb[1]>view[3])continue;anyM=true;ctx.save();m.d(ctx,tA);ctx.restore();}
   if(anyM&&animOn()&&!animTimer&&!document.hidden)animTimer=setTimeout(()=>{animTimer=0;req();},70);}
  if(reveal){const p=(performance.now()-reveal.t0)/2600;if(p>=1)reveal=null;else{const D=DISTRICTS[reveal.d];const[cx,cy]=pr((D.u0+D.u1)/2,(D.v0+D.v1)/2,0);const e=p*p*(3-2*p),Rr=e*Math.hypot(D.u1-D.u0,D.v1-D.v0)*.9;
    ctx.save();ctx.beginPath();ctx.rect(WB.x0,WB.y0,WB.x1-WB.x0,WB.y1-WB.y0);ctx.ellipse(cx,cy,Rr*1.4,Rr*.8,0,0,TAU);ctx.clip('evenodd');ctx.globalAlpha=1-Math.max(0,p-.75)*4;drawLocked(ctx,D);ctx.restore();req();}}
  drawOverlay(ctx,s);
  ctx.setTransform(dpr,0,0,dpr,0,0);drawCards(ctx);
  if(fx.wrong.length||fx.pulse)req();
}
function drawOverlay(c,s){
  const now=performance.now(),cs=curCase();
  if(cs){const st=prog(cs);
    cs.steps.forEach((step,k)=>{if(!st[k]||!step.t)return;(step.ts||[step.t]).forEach((t,i)=>{c.strokeStyle=RED;c.lineWidth=Math.max(2.2/s,1.2);c.beginPath();c.arc(t.x,t.y,t.r,0,TAU);c.stroke();
      if(i===0){const br=Math.max(9/s,5),bx=t.x+t.r*.72,by=t.y-t.r*.72;c.fillStyle=RED;c.beginPath();c.arc(bx,by,br,0,TAU);c.fill();c.fillStyle='#fff';c.font=`${br*1.3}px "Patrick Hand", cursive`;c.textAlign='center';c.textBaseline='middle';c.fillText(String(k+1),bx,by+br*.08);}});});
    {const k0=curStep(cs);if(k0>=0&&cs.steps[k0].ts){const part=partOf(cs,k0);cs.steps[k0].ts.forEach((q,i)=>{if(part[i]){c.strokeStyle=RED;c.lineWidth=Math.max(2.2/s,1.2);c.beginPath();c.arc(q.x,q.y,q.r,0,TAU);c.stroke();}});}}
    const k=curStep(cs);if(k>=0&&state.hints[cs.id+':'+k]&&cs.steps[k].t&&!cs.steps[k].choice){const h=hintCircle(cs,k,state.hints[cs.id+':'+k]);c.setLineDash([10/s,8/s]);c.strokeStyle=RED;c.lineWidth=Math.max(2.5/s,1.4);c.beginPath();c.arc(h.x,h.y,h.r,0,TAU);c.stroke();c.setLineDash([]);}}
  fx.wrong=fx.wrong.filter(w=>now-w.t<700);
  for(const w of fx.wrong){c.globalAlpha=1-(now-w.t)/700;c.strokeStyle=RED;c.lineWidth=3/s;const z=10/s;L(c,w.x-z,w.y-z,w.x+z,w.y+z);L(c,w.x+z,w.y-z,w.x-z,w.y+z);c.globalAlpha=1;}
  if(fx.pulse){const p=(now-fx.pulse.t)/900;if(p>1)fx.pulse=null;else{c.globalAlpha=1-p;c.strokeStyle=RED;c.lineWidth=4/s;c.beginPath();c.arc(fx.pulse.x,fx.pulse.y,fx.pulse.r*(1+p*1.4),0,TAU);c.stroke();c.globalAlpha=1;}}
}
/* ---------- cartes d'enquête épinglées sur la carte ---------- */
const cardImg={};
function cardCanvas(cs){if(cardImg[cs.id])return cardImg[cs.id];const r=2,w=64,h=82;const c=document.createElement('canvas');c.width=w*r;c.height=h*r;const g=c.getContext('2d');g.scale(r,r);
  g.fillStyle='rgba(0,0,0,.18)';g.fillRect(3,4,w-3,h-3);g.fillStyle='#fffdf7';g.strokeStyle=INK;g.lineWidth=1.5;g.fillRect(1,1,w-4,h-5);g.strokeRect(1,1,w-4,h-5);
  g.save();g.beginPath();g.arc(w/2-1.5,29,22,0,TAU);g.fillStyle='#f3efe4';g.fill();g.strokeStyle=RED;g.lineWidth=1.6;g.stroke();g.clip();g.translate(w/2-1.5,62);g.scale(1.65,1.65);drawChar(g,0,0,cs.cast[cs.cast.length>1&&cs.id!=='fantome'&&cs.id!=='ombre'?1:0].s);g.restore();
  g.fillStyle=INK;g.font='9.5px "Patrick Hand", cursive';g.textAlign='center';g.textBaseline='middle';const words=cs.title.split(' ');let l1='',l2='';for(const wd of words){if((l1+' '+wd).trim().length<=12&&!l2)l1=(l1+' '+wd).trim();else l2=(l2+' '+wd).trim();}
  g.fillText(l1,w/2-1.5,58);g.fillText(l2,w/2-1.5,67);g.font='8px sans-serif';g.fillText('★'.repeat(cs.diff)+'☆'.repeat(3-cs.diff),w/2-1.5,74.5);
  cardImg[cs.id]=c;return c;}
const cardSlot={};
function layoutCards(){DISTRICTS.forEach((D,d)=>{const list=CASES.filter(c=>c.dist===d).sort((a,b)=>(a.final?1:0)-(b.final?1:0)||a.diff-b.diff);const n=list.length,cols=Math.min(4,Math.ceil(n/2)),rows=Math.ceil(n/cols);
  const[cx,cy]=pr((D.u0+D.u1)/2,(D.v0+D.v1)/2,0);list.forEach((cs,i)=>{const col=i%cols,row=Math.floor(i/cols);cardSlot[cs.id]=[cx+(col-(cols-1)/2)*180,cy+(row-(rows-1)/2)*160];});});}
function cardRects(){const out=[];if(cam.s>1.05)return out;const a=cam.s>.7?1-(cam.s-.7)/.35:1;if(!cardSlot[CASES[0].id])layoutCards();
  const cur=curCase(),busy=cur&&(!caseDone(cur)||chal);
  for(const cs of CASES){if(!unlocked(cs.dist))continue;const[x,y]=cardSlot[cs.id];const sx=(x-cam.x)*cam.s+vw/2,sy=(y-cam.y)*cam.s+vh/2;const isCur=cur&&cs===cur;const k=busy&&!isCur?.78:1;const sc=Math.max(.56,Math.min(.88,cam.s*1.15))*k;
    out.push({cs,x:sx-32*sc,y:sy-90*sc,w:64*sc,h:82*sc,a:a*(busy&&!isCur?.62:1),cur:isCur});}
  out.sort((p,q)=>(p.cur?1:0)-(q.cur?1:0));return out;}
function drawCards(c){for(const r of cardRects()){const open=caseOpen(r.cs);c.globalAlpha=r.a*(open?1:.55);c.drawImage(cardCanvas(r.cs),r.x,r.y,r.w,r.h);
  if(!open){c.globalAlpha=r.a;c.font=`${Math.round(r.w*.42)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText('🔒',r.x+r.w/2,r.y+r.h*.38);}
  if(caseDone(r.cs)){c.save();c.translate(r.x+r.w*.5,r.y+r.h*.38);c.rotate(-.25);c.strokeStyle=RED;c.lineWidth=2.4;c.fillStyle='rgba(255,253,247,.85)';c.beginPath();c.rect(-26,-9,52,18);c.fill();c.stroke();c.fillStyle=RED;c.font='13px "Patrick Hand", cursive';c.textAlign='center';c.textBaseline='middle';c.fillText('CLASSÉE',0,1);c.restore();c.save();c.fillStyle='#d8a21a';c.strokeStyle='#1d1b18';c.lineWidth=2.5;c.font=`${Math.round(r.w*.2)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';const ss=starStr(caseStars(r.cs));c.strokeText(ss,r.x+r.w/2,r.y+r.h*.66);c.fillText(ss,r.x+r.w/2,r.y+r.h*.66);c.restore();}
  else{const n=prog(r.cs).filter(Boolean).length;if(n>0&&open){c.save();c.fillStyle=RED;const pw=r.w*.62,ph=Math.max(11,r.w*.2);c.beginPath();c.roundRect(r.x+r.w*.5-pw/2-1,r.y+r.h*.5-ph/2,pw,ph,ph/2);c.fill();c.fillStyle='#fff';c.font=`${Math.round(ph*.85)}px "Patrick Hand", cursive`;c.textAlign='center';c.textBaseline='middle';c.fillText(n+'/'+r.cs.steps.length,r.x+r.w*.5-1,r.y+r.h*.5+1);c.restore();}}
  if(r.cur&&!caseDone(r.cs)){c.strokeStyle=RED;c.lineWidth=3;c.strokeRect(r.x-3,r.y-3,r.w+2,r.h-1);}
  c.globalAlpha=1;}}
function hintCircle(cs,k,lvl){const t=cs.steps[k].t;const a=k*2.3+cs.id.length;return lvl>=2?{x:t.x+Math.cos(a)*16,y:t.y+Math.sin(a)*12,r:t.r+34}:{x:t.x+Math.cos(a)*70,y:t.y+Math.sin(a)*50,r:170};}
function toWorld(sx,sy){return{x:cam.x+(sx-vw/2)/cam.s,y:cam.y+(sy-vh/2)/cam.s};}
function zoomAt(sx,sy,f){const w=toWorld(sx,sy);cam.s=Math.max(minS,Math.min(maxS,cam.s*f));cam.x=w.x-(sx-vw/2)/cam.s;cam.y=w.y-(sy-vh/2)/cam.s;clampCam();req();}
let anim=null;
function flyTo(x,y,s,ms){const a={x:cam.x,y:cam.y,s:cam.s},t0=performance.now();ms=ms||700;const id={};anim=id;
  const step=()=>{if(anim!==id)return;const p=Math.min(1,(performance.now()-t0)/ms),e=p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2;cam.s=a.s*Math.pow(s/a.s,e);cam.x=a.x+(x-a.x)*e;cam.y=a.y+(y-a.y)*e;clampCam();render();if(p<1)requestAnimationFrame(step);else{anim=null;req();}};requestAnimationFrame(step);}

/* ---------- gestes ---------- */
const ptrs=new Map();let tap=null,pinch=null,vel={x:0,y:0,t:0};
cv.addEventListener('pointerdown',e=>{anim=null;cv.setPointerCapture(e.pointerId);ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1)tap={x:e.clientX,y:e.clientY,t:performance.now(),moved:false};
  else if(ptrs.size===2){tap=null;const[p1,p2]=[...ptrs.values()];pinch={d:Math.hypot(p1.x-p2.x,p1.y-p2.y),s:cam.s,w:toWorld((p1.x+p2.x)/2,(p1.y+p2.y)/2)};}});
cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===1){if(tap&&Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)tap.moved=true;if(!tap||tap.moved){cam.x-=dx/cam.s;cam.y-=dy/cam.s;clampCam();req();const now=performance.now(),dt=Math.max(1,now-vel.t);vel={x:.7*vel.x+.3*dx/dt,y:.7*vel.y+.3*dy/dt,t:now};}}
  else if(ptrs.size===2&&pinch){const[p1,p2]=[...ptrs.values()];const d=Math.hypot(p1.x-p2.x,p1.y-p2.y);const mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2;cam.s=Math.max(minS,Math.min(maxS,pinch.s*d/pinch.d));cam.x=pinch.w.x-(mx-vw/2)/cam.s;cam.y=pinch.w.y-(my-vh/2)/cam.s;clampCam();req();}});
function up(e){const had=ptrs.has(e.pointerId);ptrs.delete(e.pointerId);if(!had)return;if(ptrs.size<2)pinch=null;
  if(tap&&!tap.moved&&ptrs.size===0&&performance.now()-tap.t<450)onTapScreen(e.clientX,e.clientY);
  else if(ptrs.size===0&&performance.now()-vel.t<80&&Math.hypot(vel.x,vel.y)>.15){let vx=vel.x,vy=vel.y,last=performance.now();const id={};anim=id;const glide=()=>{if(anim!==id)return;const now=performance.now(),dt=now-last;last=now;cam.x-=vx*dt/cam.s;cam.y-=vy*dt/cam.s;clampCam();const f=Math.pow(.993,dt);vx*=f;vy*=f;render();if(Math.hypot(vx,vy)>.02)requestAnimationFrame(glide);else{anim=null;req();}};requestAnimationFrame(glide);}
  vel={x:0,y:0,t:0};tap=null;}
cv.addEventListener('pointerup',up);cv.addEventListener('pointercancel',up);
cv.addEventListener('wheel',e=>{e.preventDefault();zoomAt(e.clientX,e.clientY,Math.exp(-e.deltaY*.0015));},{passive:false});
document.getElementById('zin').onclick=()=>zoomAt(vw/2,vh/2,1.6);
document.getElementById('zout').onclick=()=>zoomAt(vw/2,vh/2,1/1.6);
document.getElementById('zfit').onclick=()=>flyTo((WB.x0+WB.x1)/2,(WB.y0+WB.y1)/2,minS);
window.addEventListener('keydown',e=>{if(e.key==='+'||e.key==='=')zoomAt(vw/2,vh/2,1.4);if(e.key==='-')zoomAt(vw/2,vh/2,1/1.4);});

/* =========================================================
   INTERFACE
   ========================================================= */
const curCase=()=>CASES.find(c=>c.id===state.current)||null;
const prog=cs=>chal&&chal.id===cs.id?chal.solved:(state.solved[cs.id]||[]);
function partOf(cs,k){const key=cs.id+':'+k;const st=chal&&chal.id===cs.id?(chal.part=chal.part||{}):(state.part=state.part||{});return st[key]||(st[key]=[]);}
function curStep(cs){const st=prog(cs);for(let k=0;k<cs.steps.length;k++)if(!st[k])return k;return -1;}
const $=id=>document.getElementById(id);
let toastT=0;function toast(msg){if(toastNext){msg=msg+' ('+toastNext+')';toastNext='';}const t=$('toast');t.textContent=msg;t.classList.add('on');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('on'),1700);}
const stars=n=>'★'.repeat(n)+'☆'.repeat(3-n);
function updateCard(){const cs=curCase();
  if(!cs){$('caseTitle').textContent='Choisis une enquête ▸';$('stepNum').textContent='';$('question').textContent="Touche une carte d'enquête posée sur la ville, ou ouvre les Dossiers.";$('btnHint').disabled=true;return;}
  $('btnHint').disabled=false;const k=curStep(cs);$('caseTitle').textContent=cs.title+' ▸';
  if(k<0){$('stepNum').textContent='Classée ✓';$('question').textContent=cs.outro;}else{$('stepNum').textContent=chal?`⏱ ${fmtT(chalTime())} · ${k+1}/${cs.steps.length}`:`Étape ${k+1}/${cs.steps.length}`;$('question').innerHTML=cs.steps[k].q;const w=cs.steps[k].w;if(w!=null&&cs.cast[w]){const pc=portrait(cs.cast[w].s);pc.className='qwho';pc.title=cs.cast[w].n;$('question').prepend(pc);}
    const st0=cs.steps[k];if(st0.ts){const n=partOf(cs,k).filter(Boolean).length;const bd=document.createElement('span');bd.className='prog';bd.textContent=` — ${n}/${st0.ts.length} trouvés`;$('question').appendChild(bd);}
    const ch=cs.steps[k].choice;if(ch){const lvl=+state.hints[cs.id+':'+k]||0;const wrong=ch.map((o,i)=>i).filter(i=>i!==cs.steps[k].ans);const hide=new Set(wrong.slice(0,lvl));const box=document.createElement('div');box.className='choices';if(!ch[0].s)box.classList.add('txtgrid');ch.forEach((o,i)=>{if(hide.has(i))return;const b=document.createElement('button');b.className='choice';if(o.s){b.appendChild(portrait(o.s));const sp=document.createElement('span');sp.textContent=o.n;b.appendChild(sp);}else{b.classList.add('txt');b.textContent=o.n;}b.onclick=()=>answerChoice(cs,k,i);box.appendChild(b);});
      if(st0.t){const lb=document.createElement('button');lb.className='lookbtn';lb.textContent='🔎 Voir la scène';lb.onclick=()=>{const t=st0.t;flyTo(t.x,t.y,Math.max(cam.s,Math.min(1.6,vw/420)));};$('question').appendChild(lb);}
      $('question').appendChild(box);}}
  $('btnHint').textContent=k>=0&&+state.hints[cs.id+':'+k]>=1?(+state.hints[cs.id+':'+k]>=2?'Indice ✓✓':'Indice +'):'Indice';}
function portrait(spec){const c=document.createElement('canvas');const r=2;c.width=90*r;c.height=100*r;const g=c.getContext('2d');g.setTransform(r,0,0,r,0,0);g.fillStyle='#f3efe4';g.fillRect(0,0,90,100);g.strokeStyle='#d6d0c2';g.lineWidth=1;for(let y=10;y<100;y+=10){g.beginPath();g.moveTo(0,y);g.lineTo(90,y);g.stroke();}
  const sc=spec.scale?2.35/spec.scale*.75:2.35;g.translate(45,95);g.scale(sc,sc);drawChar(g,0,0,Object.assign({},spec,{pose:'stand'}));return c;}
function openModal(html,mount){$('modalBody').innerHTML=html;$('modal').classList.remove('hidden');if(mount)mount($('modalBody'));}
function closeModal(){$('modal').classList.add('hidden');}
$('modal').addEventListener('click',e=>{if(e.target.id==='modal'||e.target.classList.contains('close'))closeModal();});
function castHTML(cs){return `<div class="cast">${cs.cast.map((p,i)=>`<div class="who"><div data-p="${i}"></div><b>${p.n}</b><span>${p.r}</span></div>`).join('')}</div>`;}
function mountCast(root,cs){root.querySelectorAll('[data-p]').forEach(el=>el.appendChild(portrait(cs.cast[+el.dataset.p].s)));}
function showCases(){
  openModal(`<h2>Dossiers</h2><p class="legend">Toute la ville est figée : un même suspect apparaît à plusieurs endroits, à différents moments. Résous des enquêtes pour débloquer de nouveaux quartiers.</p><button class="ombrebtn" id="ombreBtn"><span style="font-size:26px">🕵️</span><span>Le dossier de l'Ombre<br><small>${cluesFound()}/5 indices${caseOpen(CASES.find(c=>c.final))?' · enquête finale ouverte !':''}</small></span></button>${DISTRICTS.map((D,i)=>{const open=unlocked(i);
    return `<h3>${open?'':'🔒 '}${D.name}${open?` <span class="legend">${doneIn(i)}/${CASES.filter(c=>c.dist===i).length} classées</span>`:''}</h3>${open?`<div class="cases">${CASES.filter(c=>c.dist===i&&!c.final).sort((a,b)=>a.diff-b.diff).map(cs=>{const n=(state.solved[cs.id]||[]).filter(Boolean).length;const op=caseOpen(cs);return`<button class="case ${cs.id===state.current?'active':''} ${op?'':'lock'}" data-c="${cs.id}"><div><div class="t">${cs.title}</div><div class="m">${['','Facile','Moyen','Difficile'][cs.diff]} ${stars(cs.diff)} · ${cs.steps.length} étapes</div></div><span class="done">${!op?'🔒':n===cs.steps.length?`<span class="stars">${starStr(caseStars(cs))}</span>`:(cs.id===state.current?'En cours · ':'')+n+'/'+cs.steps.length}</span></button>`;}).join('')}</div>`:`<p class="legend">Résous « ${mediumOf(i-1).title} » pour ouvrir ce quartier.</p>`}`;}).join('')}${curCase()&&!caseDone(curCase())?`<button class="btn ghost" id="quit">Mettre « ${curCase().title} » en pause</button>`:''}<button class="btn ghost" id="howto">Comment jouer ?</button>`,root=>{
    root.querySelector('#ombreBtn').onclick=showClues;root.querySelectorAll('[data-c]').forEach(b=>b.onclick=()=>pickCase(b.dataset.c));root.querySelector('#howto').onclick=showHelp;
    const q=root.querySelector('#quit');if(q)q.onclick=()=>{chal=null;state.current=null;save();updateCard();req();closeModal();toast('Enquête mise en pause : toutes les cartes sont de retour');};});}
function pickCase(id){const cs=CASES.find(c=>c.id===id);if(!caseOpen(cs)){toast(lockReason(cs));return;}const cur=curCase();
  if(cur&&cur.id!==id&&!caseDone(cur)&&started(cur)){openModal(`<h2>Changer d'enquête ?</h2><p>Tu es en pleine enquête : <b>${cur.title}</b>. Ta progression sera gardée et tu pourras la reprendre plus tard.</p><button class="btn" id="sw">Passer à « ${cs.title} »</button><button class="btn ghost" id="st">Rester sur ${cur.title}</button>`,r2=>{r2.querySelector('#sw').onclick=()=>startCase(id);r2.querySelector('#st').onclick=closeModal;});}else startCase(id);}
function focusPoint(cs){const k=Math.max(0,curStep(cs));for(let i=k;i>=0;i--)if(cs.steps[i].t)return cs.steps[i].t;return cs.steps[0].t;}
function startCase(id){chal=null;state.current=id;save();updateCard();req();const cs=curCase();
  openModal(`<h2>${cs.title}</h2><p class="legend">${DISTRICTS[cs.dist].name} · ${stars(cs.diff)}</p><p>${cs.intro}</p><h3>Les personnages</h3>${castHTML(cs)}<button class="btn" id="go">${curStep(cs)<0?'Revoir la carte':'Commencer l\'enquête'}</button>${caseDone(cs)?`<button class="btn ghost" id="chrono">⏱ Défi chrono${(state.best||{})[cs.id]?' — record '+fmtT(state.best[cs.id])+' '+medal(cs,state.best[cs.id]):''}</button>`:''}${(state.solved[cs.id]||[]).some(Boolean)?'<button class="btn ghost" id="reset">Recommencer cette enquête</button>':''}`,root=>{
    const ch=root.querySelector('#chrono');if(ch)ch.onclick=()=>startChal(cs);
    mountCast(root,cs);root.querySelector('#go').onclick=()=>{closeModal();const t=focusPoint(cs);flyTo(t.x,t.y,Math.max(cam.s,Math.min(1.2,vw/700)));};
    const r=root.querySelector('#reset');if(r)r.onclick=()=>{state.solved[cs.id]=[];if(state.wrong)delete state.wrong[cs.id];if(state.part)Object.keys(state.part).forEach(k=>{if(k.startsWith(cs.id+':'))delete state.part[k];});Object.keys(state.hints).forEach(k=>{if(k.startsWith(cs.id+':'))delete state.hints[k];});save();updateCard();req();closeModal();toast('Enquête remise à zéro');};});}
function showSteps(){const cs=curCase();if(!cs){showCases();return;}const st=prog(cs);const k=curStep(cs);
  openModal(`<h2>${cs.title}</h2><ul class="steps">${cs.steps.map((s,i)=>st[i]?`<li><span class="n">${i+1}</span>${s.q}<span class="ok">${s.ok}</span>${s.t?`<button data-v="${i}">Voir sur la carte</button>`:''}</li>`:i===k?`<li><span class="n" style="background:var(--ink);color:var(--card)">${i+1}</span>${s.q}</li>`:`<li class="lock">Étape ${i+1} — encore secrète</li>`).join('')}</ul>${k<0?`<p class="stamp">Enquête classée</p><p>${cs.outro}</p>`:''}`,root=>{
    root.querySelectorAll('[data-v]').forEach(b=>b.onclick=()=>{const t=cs.steps[+b.dataset.v].t;closeModal();flyTo(t.x,t.y,Math.max(cam.s,Math.min(3.2,Math.min(vw,vh)/(t.r*6))));});});}
function showClues(){const n=cluesFound(),fin=CASES.find(c=>c.final);
  openModal(`<h2>🕵️ Le dossier de l'Ombre</h2><p class="legend">Chaque enquête difficile cache un indice sur l'Ombre, le cerveau de tous les mauvais coups d'Animopolis.</p>${HARD.map((id,i)=>{const cs=CASES.find(c=>c.id===id);return caseDone(cs)?`<div class="clue"><b>Indice ${i+1} : ${CLUES[id].t}</b>${CLUES[id].x}</div>`:`<div class="clue no"><b>Indice ${i+1} : ???</b>${caseOpen(cs)?`Résous « ${cs.title} ».`:`Enquête encore fermée : ${lockReason(cs)}`}</div>`;}).join('')}
  ${caseOpen(fin)?`<button class="btn" id="fin">${caseDone(fin)?'Revoir l\'enquête finale':'Ouvrir l\'enquête finale'}</button>`:`<p class="legend">Réunis les 5 indices (${n}/5) pour ouvrir l'enquête finale.</p>`}`,r=>{const b=r.querySelector('#fin');if(b)b.onclick=()=>startCase('ombre');});}
function showHelp(){openModal(`<h2>Comment jouer</h2>
  <p>🔎 <b>Zoome</b> en pinçant l'écran (ou molette / boutons +/−) et <b>déplace-toi</b> en glissant le doigt.</p>
  <p>🃏 Les <b>cartes d'enquête</b> sont posées sur la ville. Touche-en une pour ouvrir l'enquête. Pendant une enquête, les autres cartes se cachent (les décors restent) : tu peux la mettre en pause depuis les Dossiers.</p>
  <p>🗺️ Le temps est <b>figé</b> : le même suspect apparaît plusieurs fois, à différents moments de l'histoire.</p>
  <p>👆 Quand tu as trouvé la scène qui répond à la question, <b>touche-la</b>. Si c'est juste, elle est entourée en rouge.</p>
  <p>🔓 Dans chaque quartier, les enquêtes s'ouvrent l'une après l'autre : facile, puis moyenne, puis difficile. Résous l'enquête moyenne pour ouvrir le quartier suivant.</p>
  <p>🕵️ Chaque enquête difficile révèle un <b>indice sur l'Ombre</b>. Réunis les 5 pour ouvrir l'enquête finale.</p>
  <p>💡 Bloqué ? Le bouton <b>Indice</b> entoure la zone où chercher. Touche-le une seconde fois pour un cercle plus précis.</p>
  <p>📲 Le bouton <b>Installer</b> ajoute le jeu sur ton écran d'accueil. Les mises à jour arrivent toutes seules.</p>
  <p>⏱ Une enquête classée peut être rejouée en <b>défi chrono</b> (5 secondes de pénalité par erreur, pas d'indice) pour gagner une médaille.</p>
  <p>⭐ Chaque enquête rapporte jusqu'à <b>3 étoiles</b> (sans indice et avec peu d'erreurs). Ton <b>Carnet</b> garde tes étoiles, ton grade et les fiches des affaires classées.</p>
  <p>🖼️ À chaque étape, le <b>portrait</b> de la personne à chercher s'affiche à côté de la question.</p>
  <button class="btn" id="ok">C'est parti !</button>`,root=>root.querySelector('#ok').onclick=closeModal);}
function onTapScreen(sx,sy){
  const rs=cardRects();for(let i=rs.length-1;i>=0;i--){const r=rs[i];if(sx>=r.x&&sx<=r.x+r.w&&sy>=r.y&&sy<=r.y+r.h){pickCase(r.cs.id);return;}}
  const w=toWorld(sx,sy);onTap(w.x,w.y);}
function answerChoice(cs,k,i){if(i===cs.steps[k].ans){const t={x:cam.x,y:cam.y,r:1};solveStep(cs,k,t);}else{addWrong(cs);toast('Non… relis bien tes indices.');const b=document.querySelectorAll('.choice');b.forEach(x=>x.classList.add('shake'));setTimeout(()=>b.forEach(x=>x.classList.remove('shake')),400);}}
function wrongTap(cs,k,x,y){addWrong(cs);fx.wrong.push({x,y,t:performance.now()});req();const w=cs.steps[k].w,who=w!=null&&cs.cast[w]?cs.cast[w].s:null,dc=decoyAt(x,y);
  if(dc&&who&&dc.head===who.head&&dc.dist===cs.dist)toast('Fausse piste ! Regarde bien '+DIFF[dc.diff]+'.');
  else toast(pick(['Rien de suspect ici…','Hmm, pas ici.','Continue de chercher !','Ce n\'est pas ça…']));}
function onTap(x,y){
  const cs=curCase();if(!cs){toast('Touche une carte d\'enquête');return;}
  const k=curStep(cs);if(k<0){toast('Enquête déjà classée !');return;}
  const st=cs.steps[k];
  if(st.choice){toast('Choisis ta réponse dans le cadre en bas');return;}
  const slack=Math.min(12,Math.max(0,8/cam.s-6));
  if(st.ts){const part=partOf(cs,k);let hit=-1;st.ts.forEach((q,i)=>{if(hit<0&&!part[i]&&Math.hypot(x-q.x,y-q.y)<=q.r+slack)hit=i;});
    if(hit<0){if(st.ts.some((q,i)=>part[i]&&Math.hypot(x-q.x,y-q.y)<=q.r+slack)){toast('Déjà trouvé : cherche les autres !');return;}wrongTap(cs,k,x,y);return;}
    part[hit]=true;save();const q=st.ts[hit];fx.pulse={x:q.x,y:q.y,r:q.r,t:performance.now()};req();
    const n=part.filter(Boolean).length;if(n===st.ts.length)solveStep(cs,k,st.t);else{toast(`${n}/${st.ts.length} trouvés !`);updateCard();}return;}
  const t=st.t;
  if(Math.hypot(x-t.x,y-t.y)<=t.r+slack)solveStep(cs,k,t);else wrongTap(cs,k,x,y);
}
let toastNext='';
const fmtT=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
const medal=(cs,s)=>s<=cs.steps.length*10?'🥇':s<=cs.steps.length*20?'🥈':'🥉';
const chalTime=()=>chal?(performance.now()-chal.t0)/1000+chal.pen:0;
function startChal(cs){chal={id:cs.id,solved:[],t0:performance.now(),pen:0};state.current=cs.id;closeModal();updateCard();req();const t=focusPoint(cs);flyTo(t.x,t.y,Math.max(cam.s,Math.min(1.2,vw/700)));toast('Défi chrono : c\'est parti !');}
function chalSolve(cs,k,t){chal.solved[k]=true;fx.pulse={x:t.x,y:t.y,r:t.r,t:performance.now()};req();
  if(curStep(cs)>=0){updateCard();return;}
  const time=chalTime(),pen=chal.pen;chal=null;state.best=state.best||{};const old=state.best[cs.id];const rec=!old||time<old;if(rec)state.best[cs.id]=Math.round(time*10)/10;save();updateCard();req();
  setTimeout(()=>openModal(`<h2>⏱ Défi terminé !</h2><p class="bigstars" style="color:var(--ink)">${fmtT(time)} ${medal(cs,time)}</p><p class="legend" style="text-align:center">${pen?`dont ${pen} s de pénalité · `:''}${rec?(old?'Nouveau record ! (avant : '+fmtT(old)+')':'Premier record !'):'Record à battre : '+fmtT(old)}</p><p class="legend" style="text-align:center">🥇 moins de ${fmtT(cs.steps.length*10)} · 🥈 moins de ${fmtT(cs.steps.length*20)}</p><button class="btn" id="again">Rejouer le défi</button><button class="btn ghost" id="backC">Retour aux dossiers</button>`,r=>{r.querySelector('#again').onclick=()=>startChal(cs);r.querySelector('#backC').onclick=showCases;}),450);}
setInterval(()=>{if(chal){const cs=curCase();if(cs)$('stepNum').textContent=`⏱ ${fmtT(chalTime())} · ${Math.max(0,curStep(cs))+1}/${cs.steps.length}`;}},500);
function solveStep(cs,k,t){if(chal&&chal.id===cs.id){chalSolve(cs,k,t);return;}{
    const before=DISTRICTS.map((d,i)=>unlocked(i)),openBefore=CASES.map(caseOpen);
    (state.solved[cs.id]=state.solved[cs.id]||[])[k]=true;save();fx.pulse={x:t.x,y:t.y,r:t.r,t:performance.now()};req();updateCard();
    const done=curStep(cs)<0;const newD=DISTRICTS.findIndex((d,i)=>unlocked(i)&&!before[i]);const newC=CASES.filter((c,i)=>caseOpen(c)&&!openBefore[i]&&c.dist!==newD);
    const clue=done&&CLUES[cs.id]?`<div class="clue"><b>🕵️ Indice sur l'Ombre ${cluesFound()}/5 : ${CLUES[cs.id].t}</b>${CLUES[cs.id].x}</div>${cluesFound()===5?'<h3>🔓 Le dossier de l\'Ombre est ouvert !</h3><p>L\'enquête finale t\'attend devant la Mairie.</p>':''}`:'';
    setTimeout(()=>openModal(`<h2>Bien vu !</h2><p>${cs.steps[k].ok}</p>${done?`<p class="stamp">Enquête classée</p><p class="bigstars">${starStr(caseStars(cs))}</p><p class="legend" style="text-align:center">${hintsUsed(cs)} indice${hintsUsed(cs)>1?'s':''} · ${(state.wrong||{})[cs.id]||0} erreur${((state.wrong||{})[cs.id]||0)>1?'s':''}${caseStars(cs)<3?' — rejoue-la plus tard pour viser 3 étoiles':' — parfait !'}</p><p>${cs.outro}</p>`:''}${clue}${newC.filter(c=>!c.final).map(c=>`<h3>🔓 Nouvelle enquête : ${c.title}</h3>`).join('')}${newD>=0?`<h3>🔓 Nouveau quartier : ${DISTRICTS[newD].name} !</h3><p>${INTROS[newD]||''}</p>`:''}<button class="btn" id="next">${newD>=0?'Découvrir '+DISTRICTS[newD].name:done?'Retour aux dossiers':'Étape suivante'}</button>`,root=>root.querySelector('#next').onclick=()=>{
      if(newD>=0){closeModal();state.current=null;save();updateCard();const D=DISTRICTS[newD];const[x2,y2]=pr((D.u0+D.u1)/2,(D.v0+D.v1)/2,0);flyTo(x2,y2,Math.max(minS,vw/1500),1100);setTimeout(()=>{reveal={d:newD,t0:performance.now()};req();},1150);}else if(done){showCases();}else closeModal();}),450);
  }
}
$('btnCases').onclick=showCases;$('btnBook').onclick=showBook;$('caseTitle').onclick=()=>curCase()?showSteps():showCases();$('btnSteps').onclick=showSteps;
$('btnCast').onclick=()=>{const cs=curCase();if(!cs){showCases();return;}openModal(`<h2>Personnages</h2><p class="legend">${cs.title}</p>${castHTML(cs)}`,root=>mountCast(root,cs));};
$('btnHint').onclick=()=>{const cs=curCase();if(!cs)return;const k=curStep(cs);if(k<0)return;if(chal){toast('Pas d\'indice pendant un défi chrono !');return;}if(cs.steps[k].choice){const key=cs.id+':'+k;state.hints[key]=Math.min(2,(+state.hints[key]||0)+1);save();updateCard();toast('Indice : une mauvaise réponse a été retirée');return;}const key=cs.id+':'+k;const lvl=Math.min(2,(+state.hints[key]||0)+1);state.hints[key]=lvl;save();const h=hintCircle(cs,k,lvl);flyTo(h.x,h.y,Math.max(minS,Math.min(vw,vh)/(h.r*2.6)));toast(lvl>=2?'Indice 2/2 : c\'est tout près !':'Indice 1/2 : cherche dans le cercle');updateCard();};

/* ---------- démarrage ---------- */
buildCity();built=true;migrate(state);
window.addEventListener('resize',resize);resize();
{const[x,y]=pr(590,590,0);cam.x=x;cam.y=y-40;cam.s=Math.max(minS,Math.min(.9,vw/1300));clampCam();}
updateCard();render();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{clearTiles();for(const k in cardImg)delete cardImg[k];req();});
/* ---------- installation & mises à jour automatiques ---------- */
const standalone=['standalone','minimal-ui','window-controls-overlay','fullscreen'].some(m=>matchMedia(`(display-mode: ${m})`).matches)||navigator.standalone===true;
try{if('serviceWorker'in navigator&&location.protocol==='https:'&&!/claude\.ai|claudeusercontent/.test(location.hostname)){
  const hadCtrl=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then(reg=>{setInterval(()=>reg.update().catch(()=>{}),30*60*1000);}).catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(hadCtrl)toast('Nouvelle version installée ✓');});
}}catch(e){}
window.__animopolis={CASES,cam,onTap,flyTo,render,state,items,DISTRICTS,pr,unlocked};

