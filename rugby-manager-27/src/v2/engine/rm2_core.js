/* Rugby Manager 27 — V2.0 Match Engine · Noyau
 * Simulation multi-agents : 30 joueurs autonomes, ballon physique, horloge réglementaire.
 * Coordonnées monde en mètres : x = longueur (lignes d'essai à 0 et 100, en-buts jusqu'à -10 / 110),
 * y = largeur (lignes de touche à 0 et 70). Pas fixe de 0,1 s : le même code tourne en direct et en simulation rapide.
 * L'état du match est un objet JSON pur (sérialisable pour reprise de partie).
 */
'use strict';
(function(root){
const RM2 = root.RM2 = root.RM2 || {};
RM2.VERSION = '2.0.0';
const DT = RM2.DT = 0.1;
const G = 9.81;
const HALF = 2400;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const hyp=(a,b)=>Math.sqrt(a*a+b*b);
RM2.util={clamp,lerp,hyp};

/* ---------- Hasard déterministe (xorshift32) ---------- */
function hash(str){let h=2166136261;str=String(str);for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0||1}
function rnd(M){let x=M.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;M.rng=x>>>0;return M.rng/4294967296}
function rr(M,a,b){return a+(b-a)*rnd(M)}
function chance(M,p){return rnd(M)<p}
function gauss(M){return (rnd(M)+rnd(M)+rnd(M)-1.5)*1.15}
Object.assign(RM2,{hash,rnd,rr,chance,gauss});

/* ---------- Postes et morphologies ---------- */
const ROLE={1:'PR',2:'HO',3:'PR',4:'LO',5:'LO',6:'FL',7:'FL',8:'N8',9:'SH',10:'FH',11:'WG',12:'CE',13:'CE',14:'WG',15:'FB'};
const MASS={PR:119,HO:106,LO:117,FL:106,N8:111,SH:82,FH:88,CE:98,WG:89,FB:91};
const HEIGHT={PR:1.84,HO:1.80,LO:2.00,FL:1.92,N8:1.94,SH:1.74,FH:1.82,CE:1.86,WG:1.83,FB:1.86};
const VMAX={PR:7.3,HO:7.7,LO:7.6,FL:8.1,N8:8.0,SH:8.5,FH:8.5,CE:8.8,WG:9.5,FB:9.2};
const ACC={PR:3.5,HO:3.8,LO:3.5,FL:4.1,N8:4.0,SH:4.8,FH:4.6,CE:4.6,WG:5.0,FB:4.8};
const FWD=n=>n<=8;
RM2.ROLE=ROLE;RM2.MASS=MASS;RM2.HEIGHT=HEIGHT;RM2.isForward=FWD;
/* Profil d'attributs par poste : écart par rapport à la note générale. */
const PROFILE={
 PR:{spd:-18,acc:-12,str:12,hnd:-6,pas:-12,tkl:2,kck:-30,vis:-6,brk:6,set:12,sta:-2,dis:0,agi:-14,aer:-10},
 HO:{spd:-12,acc:-8,str:8,hnd:-2,pas:-6,tkl:4,kck:-28,vis:-2,brk:9,set:12,sta:0,dis:0,agi:-8,aer:-8},
 LO:{spd:-12,acc:-10,str:10,hnd:-4,pas:-8,tkl:4,kck:-28,vis:-4,brk:4,set:12,sta:2,dis:0,agi:-12,aer:14},
 FL:{spd:-4,acc:-2,str:6,hnd:0,pas:-4,tkl:10,kck:-24,vis:0,brk:12,set:4,sta:6,dis:-2,agi:-4,aer:4},
 N8:{spd:-5,acc:-3,str:9,hnd:2,pas:-2,tkl:6,kck:-22,vis:2,brk:8,set:6,sta:4,dis:0,agi:-4,aer:6},
 SH:{spd:4,acc:8,str:-10,hnd:8,pas:12,tkl:-4,kck:4,vis:10,brk:-2,set:-10,sta:6,dis:0,agi:10,aer:-8},
 FH:{spd:2,acc:4,str:-8,hnd:8,pas:10,tkl:-6,kck:14,vis:12,brk:-8,set:-12,sta:2,dis:2,agi:6,aer:-2},
 CE:{spd:4,acc:4,str:4,hnd:4,pas:2,tkl:6,kck:-8,vis:2,brk:-2,set:-14,sta:2,dis:0,agi:4,aer:0},
 WG:{spd:12,acc:9,str:-6,hnd:2,pas:-4,tkl:-4,kck:-6,vis:0,brk:-10,set:-16,sta:0,dis:0,agi:10,aer:6},
 FB:{spd:8,acc:6,str:-4,hnd:6,pas:2,tkl:0,kck:8,vis:8,brk:-8,set:-16,sta:2,dis:0,agi:6,aer:10}
};
RM2.ATTRS=['spd','acc','str','hnd','pas','tkl','kck','vis','brk','set','sta','dis','agi','aer'];
RM2.ATTR_LABEL={spd:'Vitesse',acc:'Accélération',str:'Puissance',hnd:'Prise de balle',pas:'Passe',tkl:'Plaquage',kck:'Jeu au pied',vis:'Lecture du jeu',brk:'Rucks',set:'Conquête',sta:'Endurance',dis:'Discipline',agi:'Appuis',aer:'Jeu aérien'};
function deriveAttrs(id,overall,role){
 const pr=PROFILE[role]||PROFILE.CE,out={};
 for(const k of RM2.ATTRS){const h=hash(id+':'+k);out[k]=clamp(Math.round(overall+pr[k]+((h%15)-7)),25,99)}
 return out;
}
RM2.deriveAttrs=deriveAttrs;

/* ---------- Tactiques moteur (valeurs 0..1) ---------- */
const DEFAULT_TACTICS={width:.5,tempo:.5,kicking:.5,forwards:.5,risk:.45,lineSpeed:.55,drift:.6,contest:.5,
 kickStyle:'auto',penalty:'auto',lineoutTarget:'auto',lineoutPlay:'auto',scrumPlan:'auto',shape:'1-3-3-1',playbook:'auto',subs:'auto'};
RM2.DEFAULT_TACTICS=DEFAULT_TACTICS;

/* ---------- Création du match ---------- */
function makePlayer(M,team,src,num,idx){
 const role=ROLE[num]||'CE';
 const overall=clamp(Number(src.skill)||70,35,97);
 // compression autour de la moyenne : l'écart de niveau pèse, sans rendre le résultat écrit d'avance
 const eff=v=>Math.round(74+(v-74)*.55);
 const raw=Object.assign(deriveAttrs(src.id||('p'+team+num),overall,role),src.attrs||{});
 const a={};for(const k in raw)a[k]=eff(raw[k]);
 const cond=clamp(src.condition==null?1:src.condition,.55,1);
 return {i:idx,team,num,role,id:String(src.id||('p'+team+'-'+num)),name:src.name||('Joueur '+num),short:shortName(src.name||('Joueur '+num)),
  pos:src.position||role,ovr:overall,a,mass:MASS[role]*(.94+(a.str-60)/600),h:HEIGHT[role]*(.98+(hash(src.id+'h')%5)/100),
  vmax:VMAX[role]*(.9+(a.spd-70)/290),acc:ACC[role]*(.9+(a.acc-70)/300),
  x:50,y:35,vx:0,vy:0,hd:0,face:1,tx:50,ty:35,urg:.5,mode:'run',until:0,en:cond,cond0:cond,gait:0,pose:'idle',poseT:0,task:'',
  think:0,react:.16+(1-(a.vis/100))*.22,mark:-1,skin:hash(src.id+'skin')%5,hair:hash(src.id+'hair')%6,
  s:{min:0,tk:0,mt:0,car:0,m:0,pa:0,br:0,to:0,pts:0,tr:0,pen:0,off:0,kk:0},on:0,yc:0,binUntil:0,
  px:50,py:35,poseHold:0,slowUntil:0,z:0,bind:null,startR:0,_mt:0,gotBallAt:0,breakFlag:false,plannedKick:0,loopFor:null,onside:true,
  kickedRecently:0,liftT:0,enterAt:-1,subbedIn:false,injured:false,binReady:false,carryT:0,leaving:false};
}
function shortName(n){const parts=String(n).trim().split(/\s+/);return parts.length>1?parts.slice(1).join(' '):parts[0]}
RM2.create=function(cfg){
 const M={v:2,seed:cfg.seed>>>0||1,rng:(cfg.seed>>>0)||1,t:0,clock:0,half:1,phase:'kickoff',pd:{t:0},live:false,
  deadBudget:0,done:false,userTeam:Number.isInteger(cfg.userTeam)?cfg.userTeam:-1,auto:!!cfg.auto,
  T:[],P:[],bench:[[],[]],gone:[],ball:{st:'dead',owner:-1,x:50,y:35,z:0,vx:0,vy:0,vz:0,team:-1,kind:'',tgt:-1,t0:0,spin:0},
  poss:-1,score:[0,0],tries:[0,0],play:null,ruck:null,tk:null,adv:null,pending:null,kickoffFirst:0,
  st:[newStats(),newStats()],log:[],evn:0,frames:0,seq:0,lastPossChange:0,lastTouchTeam:-1,
  kickOffTeam:0,halfReq:false,subsMade:[0,0],flags:{}};
 for(let t=0;t<2;t++){
  const tc=cfg.teams[t];
  M.T.push({name:tc.name,short:tc.short||tc.name,color:tc.color||(t?'#c81e32':'#f0f0f0'),color2:tc.color2||(t?'#ffffff':'#13213a'),
   tactics:Object.assign({},DEFAULT_TACTICS,tc.tactics||{}),strength:tc.strength||70,training:Object.assign({attack:0,defence:0,set:0,kicking:0,fitness:0,cohesion:0},tc.training||{}),
   mind:'normal',phaseNo:0,lastCall:'',ref:tc.ref||null});
  const list=tc.players.slice(0,15);
  for(let n=1;n<=15;n++){const src=list[n-1]||{name:'Remplaçant '+n,skill:60};M.P.push(makePlayer(M,t,src,n,t*15+n-1))}
  M.bench[t]=tc.players.slice(15,23).map((s,k)=>({src:s,used:false}));
 }
 // Bonus d'entraînement : appliqué aux attributs réellement utilisés par le moteur.
 for(const p of M.P){const tr=M.T[p.team].training;const b=k=>Math.round(clamp(k,-6,8));
  p.a.tkl+=b(tr.defence*.9);p.a.brk+=b(tr.defence*.5+tr.set*.3);p.a.set+=b(tr.set);p.a.kck+=b(tr.kicking);p.a.pas+=b(tr.attack*.6+tr.cohesion*.4);
  p.a.hnd+=b(tr.attack*.5+tr.cohesion*.5);p.a.vis+=b(tr.cohesion*.7);p.a.sta+=b(tr.fitness);p.vmax*=1+tr.fitness*.002}
 M.kickOffTeam=Number.isInteger(cfg.kickoffTeam)?cfg.kickoffTeam:(hash('ko'+cfg.seed)%2);
 M.kickoffFirst=M.kickOffTeam;
 RM2.setupKickoff(M,M.kickOffTeam,true);
 say(M,M.kickOffTeam,'info',`Coup d'envoi donné par ${M.T[M.kickOffTeam].name}`,1);
 return M;
};
function newStats(){return {pts:0,tries:0,conv:0,convA:0,pen:0,penA:0,drop:0,dropA:0,rucks:0,rucksWon:0,tackles:0,missed:0,passes:0,offloads:0,kicks:0,
 lineouts:0,lineoutsWon:0,scrums:0,scrumsWon:0,mauls:0,penC:0,turnovers:0,breaks:0,metres:0,poss:0,terr:0,knock:0,yc:0,carries:0,kick5022:0,errors:0}}

/* ---------- Repères relatifs à l'équipe ---------- */
function dir(M,t){return (t===0?1:-1)*(M.half===1?1:-1)}
function R(M,t,x){return dir(M,t)>0?x:100-x}
function X(M,t,r){return dir(M,t)>0?r:100-r}
Object.assign(RM2,{dir,R,X});
RM2.mates=(M,t)=>M.P.filter(p=>p.team===t&&p.mode!=='off'&&p.mode!=='bin');
RM2.active=p=>p.mode!=='off'&&p.mode!=='bin';
RM2.upright=(M,p)=>p.mode==='run'||p.mode==='carry';
function carrier(M){return M.ball.st==='held'?M.P[M.ball.owner]:null}
RM2.carrier=carrier;
function teamName(M,t){return M.T[t]?.name||'Équipe'}

/* ---------- Journal / commentaire ---------- */
function say(M,team,kind,text,imp=0){
 const e={c:Math.round(M.clock),h:M.half,tm:team,k:kind,s:text,imp,n:++M.evn,score:[M.score[0],M.score[1]]};
 M.log.push(e);if(M.log.length>420)M.log.splice(0,M.log.length-420);
 M.last=e;
}
RM2.say=say;
RM2.clockText=M=>{const s=Math.floor(M.clock),m=Math.floor(s/60);return String(m).padStart(2,'0')+':'+String(s%60).padStart(2,'0')};

/* ---------- Cinématique : accélération, inertie, rotation, fatigue ---------- */
function steer(M,p,dt){
 if(p.mode==='bound'||p.mode==='ground'||p.mode==='contact'||p.mode==='lift'||p.mode==='off'||p.mode==='bin'){
  if(p.mode==='ground'||p.mode==='bound'||p.mode==='lift'){p.vx*=.6;p.vy*=.6;if(Math.abs(p.vx)+Math.abs(p.vy)<.05){p.vx=0;p.vy=0}}
  return;
 }
 const dx=p.tx-p.x,dy=p.ty-p.y,d=hyp(dx,dy);
 const s=hyp(p.vx,p.vy);
 const fat=.8+.2*p.en;
 const vmax=p.vmax*fat*(p.slowUntil>M.t?.62:1);
 let want=d<.25?0:Math.min(clamp(p.urg,0,1)*vmax,Math.sqrt(2*6.5*Math.max(0,d-.2)));
 let hx=s>.05?p.vx/s:Math.cos(p.hd),hy=s>.05?p.vy/s:Math.sin(p.hd);
 let ndx=d>1e-6?dx/d:hx,ndy=d>1e-6?dy/d:hy;
 // rotation limitée : plus on court vite, plus le virage est large
 let ang=Math.atan2(hx*ndy-hy*ndx,hx*ndx+hy*ndy);
 const yaw=(s<1.2?6.5:5.2/(1+.3*s))*dt;
 if(s>2.5&&Math.abs(ang)>1.2)want=Math.min(want,s*.55); // freinage avant un changement de direction marqué
 const turn=clamp(ang,-yaw,yaw);
 let h=Math.atan2(hy,hx)+(s<.35?ang:turn);
 // accélération décroissante avec la vitesse (courbe de sprint réaliste)
 const accNow=p.acc*fat*Math.max(.28,1-s/(vmax*1.05))*1.35;
 const dv=want-s;
 const ns=Math.max(0,s+(dv>0?Math.min(dv,accNow*dt):Math.max(dv,-7.2*dt)));
 p.vx=Math.cos(h)*ns;p.vy=Math.sin(h)*ns;
 if(ns>.35||d>.4){let fd=Math.atan2(ns>.35?p.vy:ndy,ns>.35?p.vx:ndx);let da=Math.atan2(Math.sin(fd-p.hd),Math.cos(fd-p.hd));p.hd+=clamp(da,-5.5*dt,5.5*dt)}
}
function moveAll(M,dt){
 const P=M.P;
 for(const p of P){
  if(!RM2.active(p))continue;
  if(p.mode==='ground'&&M.t>=p.until){p.mode='run';p.pose='rise';p.poseT=M.t}
  steer(M,p,dt);
  const ox=p.x,oy=p.y;
  p.x+=p.vx*dt;p.y+=p.vy*dt;
  p.x=clamp(p.x,-12,112);p.y=clamp(p.y,-6,76);
  const moved=hyp(p.x-ox,p.y-oy),sp=moved/dt;
  p.gait+=moved/(.95+.16*sp)*Math.PI;
  // énergie : coût croissant avec la vitesse, récupération à faible allure
  const load=.00022+.0000042*sp*sp*sp*.55;
  const rec=sp<2.2?.0011*(1-p.en):0;
  p.en=clamp(p.en-load*dt*(1.35-p.a.sta/200)+rec*dt,.25,1);
  p.on+=dt;
 }
 // séparation : personne ne se traverse (hors liaisons de ruck/mêlée/maul) — balayage trié sur x
 const ord=M._ord||(M._ord=P.map((p,k)=>k));
 for(let a=1;a<ord.length;a++){const v=ord[a];let b=a-1;while(b>=0&&P[ord[b]].x>P[v].x){ord[b+1]=ord[b];b--}ord[b+1]=v}
 const tk=M.tk;
 for(let ia=0;ia<ord.length;ia++){const a=P[ord[ia]];if(a.mode==='bound'||a.mode==='lift'||a.mode==='off'||a.mode==='bin')continue;
  for(let jb=ia+1;jb<ord.length;jb++){const b=P[ord[jb]];const dx=b.x-a.x;if(dx>.9)break;
   if(b.mode==='bound'||b.mode==='lift'||b.mode==='off'||b.mode==='bin')continue;
   const dy=b.y-a.y;if(dy>.9||dy<-.9)continue;
   const d=Math.sqrt(dx*dx+dy*dy);const min=(a.mode==='ground'||b.mode==='ground')?.55:.78;
   if(d<min&&d>1e-4){
    if(tk&&((tk.c===a.i&&tk.d.includes(b.i))||(tk.c===b.i&&tk.d.includes(a.i))))continue;
    const push=(min-d)/2,ux=dx/d,uy=dy/d;
    const wa=a.mode==='ground'?0:a.mode==='contact'?.2:1,wb=b.mode==='ground'?0:b.mode==='contact'?.2:1,ws=wa+wb||1;
    a.x-=ux*push*2*wa/ws;a.y-=uy*push*2*wa/ws;b.x+=ux*push*2*wb/ws;b.y+=uy*push*2*wb/ws;
   }else if(d<=1e-4){a.y-=.2;b.y+=.2}
  }}
 // pose d'animation dérivée du mouvement réel
 for(const p of P){if(!RM2.active(p))continue;const sp=hyp(p.vx,p.vy);
  if(M.t-p.poseT<p.poseHold)continue;
  let pose=p.mode==='ground'?'ground':p.mode==='bound'?(p.bind||'bind'):p.mode==='lift'?'lift':p.mode==='contact'?'contact':
   sp>6.3?'sprint':sp>3.2?'run':sp>.9?'jog':'idle';
  if(pose!==p.pose){p.pose=pose;p.poseT=M.t;p.poseHold=0}
 }
}
RM2.setPose=(M,p,pose,hold=.45)=>{p.pose=pose;p.poseT=M.t;p.poseHold=hold};
/* Cible lissée : les petites corrections de placement sont filtrées (pas de piétinement ni de zigzag),
   les actions urgentes (plaquage, réception, porteur, replacement hors-jeu) sont immédiates. */
RM2.go=(p,x,y,urg)=>{x=clamp(x,-11,111);y=clamp(y,-3,73);
 const dx=x-p.tx,dy=y-p.ty,move=Math.sqrt(dx*dx+dy*dy);
 const sp=Math.sqrt(p.vx*p.vx+p.vy*p.vy),near=Math.sqrt((p.x-x)*(p.x-x)+(p.y-y)*(p.y-y));
 if(urg<.9){
  if(near<.9&&sp<1.2&&move<1.4){p.urg=Math.min(p.urg,urg);return}// déjà en place : il reste immobile
  if(move<3){const k=p.task==='ligne'||p.task==='garde du ruck'?.75:.5;x=p.tx+dx*k;y=p.ty+dy*k}
 }
 p.tx=x;p.ty=y;p.urg=urg};

/* ---------- Ballon ---------- */
function holdBall(M,p){const b=M.ball;b.st='held';b.owner=p.i;b.team=p.team;b.x=p.x+Math.cos(p.hd)*.25;b.y=p.y+Math.sin(p.hd)*.25;b.z=1.05;b.vx=p.vx;b.vy=p.vy;b.vz=0;M.lastTouchTeam=p.team}
RM2.holdBall=holdBall;
function launch(M,from,tx,ty,T,kind,extra={}){
 const b=M.ball;const z0=kind==='pass'?1.1:kind==='throw'?2.2:kind==='goal'?0:.55;
 b.st='air';b.kind=kind;b.owner=-1;b.x=from.x;b.y=from.y;b.z=z0;
 const zEnd=extra.zEnd!=null?extra.zEnd:(kind==='pass'?1.0:kind==='throw'?2.9:0);
 b.vx=(tx-from.x)/T;b.vy=(ty-from.y)/T;b.vz=(zEnd-z0+.5*G*T*T)/T;
 b.t0=M.t;b.T=T;b.lx=tx;b.ly=ty;b.fromX=from.x;b.fromY=from.y;b.team=from.team!=null?from.team:b.team;b.by=from.i!=null?from.i:-1;
 b.tgt=extra.tgt!=null?extra.tgt:-1;b.kt=extra.kt||'';b.bounces=0;b.tried={};b.quality=extra.quality!=null?extra.quality:1;b.onFull=true;
 b.kickX=from.x;b.inOwn22=extra.inOwn22||false;b.fromHalf=extra.fromHalf||false;b.spin=(kind==='kick'?(extra.kt==='grubber'?14:9):6);
 M.lastTouchTeam=b.team;
}
RM2.launch=launch;
function ballUpdate(M,dt){
 const b=M.ball;b.px=b.x;b.py=b.y;
 if(b.st==='held'){const p=M.P[b.owner];if(!p){b.st='ground';return}
  const off=p.mode==='ground'?0:.22;b.x=p.x+Math.cos(p.hd)*off;b.y=p.y+Math.sin(p.hd)*off;b.z=p.mode==='ground'?.15:p.mode==='lift'?3.1:1.0;b.vx=p.vx;b.vy=p.vy;return}
 if(b.st==='air'){
  if(b.kind==='kick'&&b.z>1.5&&M.weather&&M.weather.wind)b.vx+=M.weather.wind*.09*dt;
  b.x+=b.vx*dt;b.y+=b.vy*dt;b.vz-=G*dt;b.z+=b.vz*dt;
  if(b.kind==='goal')return;
  if(b.z<=0){b.z=0;
   if(b.kind==='kick'&&b.bounces===0)b.landX=b.x,b.landY=b.y;
   b.onFull=false;
   const sp=hyp(b.vx,b.vy);
   if(Math.abs(b.vz)>1.6&&b.bounces<4){
    // rebond imprévisible du ballon ovale
    const dev=(rnd(M)-.5)*(b.kt==='grubber'?1.1:1.6),k=rr(M,.38,.7);
    const a=Math.atan2(b.vy,b.vx)+dev;b.vx=Math.cos(a)*sp*k;b.vy=Math.sin(a)*sp*k;b.vz=Math.abs(b.vz)*rr(M,.28,.5);b.bounces++;b.z=.01;
    b.st='air';
   }else{b.st='ground';b.vz=0;b.groundAt=M.t}
  }
  return;
 }
 if(b.st==='ground'){b.x+=b.vx*dt;b.y+=b.vy*dt;const f=Math.max(0,1-2.1*dt);b.vx*=f;b.vy*=f;b.z=.12;return}
}

/* ---------- Horloge et temps morts ---------- */
function advanceClock(M,dt){
 if(M.phase==='half'||M.phase==='end')return;
 let add=dt;
 if(!M.live&&M.deadBudget>0){const extra=Math.min(M.deadBudget,dt*9);M.deadBudget-=extra;add+=extra}
 M.clock+=add;
 if(M.live)M.bip=(M.bip||0)+add;
 if(M.live){const c=carrier(M);const t=c?c.team:M.poss;if(t===0||t===1){M.st[t].poss+=add}
  const bx=M.ball.x;const own0=R(M,0,bx);if(own0>50)M.st[0].terr+=add;else M.st[1].terr+=add}
 for(const p of M.P)if(p.mode==='bin'&&M.clock>=p.binUntil)p.binReady=true;
}
RM2.deadTime=(M,sec)=>{M.deadBudget+=Math.max(0,sec)};
/* Arrêt de jeu : renvoie true si la mi-temps / fin de match est sifflée. */
RM2.stoppage=function(M,kind){
 M.live=false;M.tk=null;
 const limit=M.half*HALF;
 if(M.clock>=limit&&!['try','penalty','conversion'].includes(kind)){
  if(M.half===1){RM2.halfTime(M);return true}
  RM2.fullTime(M);return true;
 }
 return false;
};
RM2.halfTime=function(M){
 M.phase='half';M.pd={t:0};M.live=false;M.clock=HALF;M.ball.st='dead';
 say(M,-1,'half',`MI-TEMPS · ${M.T[0].name} ${M.score[0]} – ${M.score[1]} ${M.T[1].name}`,2);
 for(const p of M.P)if(RM2.active(p))p.en=clamp(p.en+.12*(1-p.en)+.05,0,1);
};
RM2.fullTime=function(M){
 M.phase='end';M.pd={t:0};M.done=true;M.live=false;M.ball.st='dead';
 if(M.clock<2*HALF)M.clock=2*HALF;
 say(M,-1,'end',`FIN DU MATCH · ${M.T[0].name} ${M.score[0]} – ${M.score[1]} ${M.T[1].name}`,2);
 for(const p of M.P)p.s.min=Math.round(p.on/60*(M.clock/Math.max(1,M.t)));
};

/* ---------- Boucle principale ---------- */
RM2.step=function(M,dt=DT){
 if(M.done)return;
 if(M.pending)return; // décision du manager attendue (pénalité)
 for(const p of M.P){p.px=p.x;p.py=p.y}
 M.t+=dt;M.pd.t=(M.pd.t||0)+dt;M.frames++;
 advanceClock(M,dt);
 const ph=RM2.PH[M.phase];
 if(ph)ph(M,dt);
 if(M.done)return;
 moveAll(M,dt);
 ballUpdate(M,dt);
 if(RM2.afterMove)RM2.afterMove(M,dt);
 // sécurité : un match ne peut pas durer indéfiniment
 if(M.t>8200&&!M.done){RM2.fullTime(M)}
};
RM2.runToEnd=function(M,maxSteps=200000){let n=0;while(!M.done&&n++<maxSteps){if(M.pending)RM2.autoDecide(M);RM2.step(M,DT)}return M};
RM2.moveAll=moveAll;
RM2.HALF=HALF;
RM2.teamName=teamName;
RM2.PH={};
})(typeof window!=='undefined'?window:globalThis);
