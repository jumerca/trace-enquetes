/* Rugby Manager 27 — V2.0 · Phases de jeu et règles
 * Jeu courant, plaquage, ruck, maul, mêlée, touche, renvois, pénalités, coups francs, transformations,
 * drops, essais, avantage, en-avant, 50:22, cartons, remplacements et blessures.
 */
'use strict';
(function(root){
const RM2=root.RM2;
const {clamp,hyp}=RM2.util;
const {rnd,rr,chance,gauss,dir,R,X,say}=RM2;
const PH=RM2.PH;
const nm=(M,t)=>M.T[t].short||M.T[t].name;
const byNum=(M,t,n)=>M.P.find(p=>p.team===t&&p.num===n&&RM2.active(p));
const disc=(p)=>1.35-p.a.dis/100;

/* =========================================================
 *  Utilitaires de placement
 * ========================================================= */
function place(M,p,x,y,urg=.6){RM2.go(p,x,y,urg)}
function allArrived(M,idx,tol=1.2){return idx.every(i=>{const p=M.P[i];return !RM2.active(p)||hyp(p.x-p.tx,p.y-p.ty)<tol})}
function unbindAll(M,delay=.35){for(const p of M.P){if(p.mode==='bound'||p.mode==='lift'||p.mode==='contact'){p.mode='run';p.slowUntil=M.t+delay;p.bind=null;p.z=0}}}
RM2.unbindAll=unbindAll;
function goalKicker(M,t){const c=M.P.filter(p=>p.team===t&&RM2.active(p)&&[9,10,12,15].includes(p.num));c.sort((a,b)=>b.a.kck-a.a.kck);return c[0]||M.P.find(p=>p.team===t&&RM2.active(p))}
RM2.goalKicker=goalKicker;
function mindset(M){
 const left=2*RM2.HALF-M.clock;
 for(let t=0;t<2;t++){const diff=M.score[t]-M.score[1-t];
  M.T[t].mind=left<900&&diff<0&&diff>=-14?'chase':left<720&&diff>0&&diff<=10?'protect':left<240&&diff>10?'protect':'normal'}
}
RM2.mindset=mindset;

/* =========================================================
 *  Possession et événements
 * ========================================================= */
RM2.gainPossession=function(M,p,how){
 const prev=M.poss;RM2.holdBall(M,p);p.gotBallAt=M.t;p.breakFlag=false;p.s.car++;
 if(prev!==p.team){
  if(prev===0||prev===1){if(['interception','récupération','grattage','ballon perdu'].includes(how)){M.st[prev].turnovers++;}}
  M.poss=p.team;M.lastPossChange=M.t;M.play=null;M.T[p.team].phaseNo=0;
  if(M.adv&&M.adv.type==='knock'&&M.adv.team===p.team){M.adv.gained=M.t}
  if(how==='interception')say(M,p.team,'turnover',`Interception de ${p.short} !`,1);
 }
 M.st[p.team].carries++;
 p.startR=R(M,p.team,p.x);
 if(M.adv&&M.adv.type==='pen'&&M.adv.team!==p.team){RM2.awardPenalty(M,M.adv.team,M.adv.x,M.adv.y,M.adv.reason,M.adv.by,true);return}
};
function metresGained(M,p){const r=R(M,p.team,p.x),g=Math.max(0,r-(p.startR??r));M.st[p.team].metres+=g;p.s.m+=g;p.startR=r}

/* =========================================================
 *  Jeu courant
 * ========================================================= */
PH.play=function(M,dt){
 M.live=true;RM2.mindset(M);
 const b=M.ball;
 if(M.tk)tackleTick(M,dt);
 if(M.phase!=='play')return;
 RM2.openPlayThink(M,dt);
 const c=RM2.carrier(M);
 // décision de renvoi au pied après réception d'un coup de pied
 if(c&&c.plannedKick&&M.t>=c.plannedKick&&!M.tk){c.plannedKick=0;RM2.kickFromPlay(M,c,chance(M,.55)?'touche':'long');return}
 // contacts : déclenchement du plaquage
 if(c&&!M.tk&&c.mode!=='ground'){
  const tk=M.P.filter(p=>p.team!==c.team&&RM2.upright(M,p)&&hyp(p.x-c.x,p.y-c.y)<1.2);
  if(tk.length)beginTackle(M,c,tk.sort((a,b2)=>hyp(a.x-c.x,a.y-c.y)-hyp(b2.x-c.x,b2.y-c.y)));
 }
 advantageTick(M);
};
RM2.afterMove=function(M,dt){
 if(M.phase==='play'&&M.live)ballEvents(M,dt);
 else if(M.phase==='goalkick'||M.phase==='play')goalFlight(M);
};

function ballEvents(M,dt){
 const b=M.ball;
 if(b.st==='held'){
  const c=M.P[b.owner];
  // essai : porteur dans l'en-but adverse, hors contact
  if(R(M,c.team,c.x)>=100.15&&!M.tk){RM2.scoreTry(M,c);return}
  // en touche
  if((c.y<-.05||c.y>70.05)&&!M.tk){metresGained(M,c);RM2.toTouch(M,1-c.team,c.x,c.y<35?0:70,'Le porteur est poussé en touche');return}
  if(R(M,c.team,c.x)<-.2&&!M.tk){RM2.dropOut(M,1-c.team,'goal','Ballon ramené dans l’en-but')}
  if(c.mode!=='contact')metresGainedTick(M,c);
  return;
 }
 if(b.st==='air'){
  if(b.kind==='goal')return;
  catchCheck(M);
  if(M.ball.st!=='air')return;
 }
 if(b.st==='ground'||(b.st==='air'&&b.z<.6)){
  // touche / ballon mort
  if(b.y<0||b.y>70){touchFromBall(M);return}
  if(b.x<-10||b.x>110){deadBall(M);return}
  if(b.st==='ground')pickupCheck(M);
 }
 if(b.st==='air'&&b.z<=.05&&(b.y<0||b.y>70)){touchFromBall(M);return}
}
function metresGainedTick(M,c){if(!c._mt||M.t-c._mt>.5){c._mt=M.t;const r=R(M,c.team,c.x);if(r>(c.startR??r)+.01){M.st[c.team].metres+=r-c.startR;c.s.m+=r-c.startR;c.startR=r}}}

function catchCheck(M){
 const b=M.ball;
 if(b.z>3.3)return;
 const near=M.P.filter(p=>RM2.upright(M,p)&&!b.tried[p.i]&&hyp(p.x-b.x,p.y-b.y)<(b.kind==='pass'?1.05:1.25));
 if(!near.length)return;
 if(b.kind==='pass'||b.kind==='throw'){
  const r=near.find(p=>p.i===b.tgt)||(M.t-b.t0>b.T*.9?near.find(p=>p.team===b.team):null);
  const opp=near.filter(p=>p.team!==b.team);
  for(const d of opp){b.tried[d.i]=1;
   if(b.z<2.3&&chance(M,clamp(.07+(d.a.vis-65)*.004+(b.quality<.6?.08:0),.02,.22))){
    RM2.gainPossession(M,d,'interception');d.s.to++;RM2.setPose(M,d,'catch',.3);return}}
  if(r){b.tried[r.i]=1;
   const press=M.P.some(q=>q.team!==r.team&&RM2.upright(M,q)&&hyp(q.x-r.x,q.y-r.y)<1.8);
   const pc=clamp(.955+(r.a.hnd-70)*.0025+(b.quality-.7)*.09-(press?.035:0)-(b.passKind==='offload'?.06:0)-(1-r.en)*.05-(M.weather?.rain||0)*.03,.72,.995);
   if(b.forwardPass&&chance(M,.8)){b.forwardPass=false;M.st[b.team].errors++;say(M,b.team,'fwdpass',`Passe en avant de ${M.P[b.passer]?.short||''} : mêlée`,0);RM2.scrum(M,1-b.team,r.x,r.y,null);return}
   if(chance(M,pc)){RM2.gainPossession(M,r,'passe');RM2.setPose(M,r,'catch',.25);r.gotBallAt=M.t;if(M.play&&M.play.team===r.team&&!M.play.seq.includes(r.i)){M.play.aborted=true;M.play.cur=r.i}return}
   knockOn(M,r,'Passe ratée, en-avant de '+r.short);return;
  }
  return;
 }
 // coup de pied : duel aérien éventuel
 const desc=b.vz<0||b.z<1.6;
 if(!desc)return;
 const t0=near.filter(p=>p.team===0),t1=near.filter(p=>p.team===1);
 const score=p=>p.a.aer*.6+p.a.hnd*.25+p.h*20+rr(M,-12,12)-(hyp(p.x-b.x,p.y-b.y)*9);
 const all=[...near].sort((a,c)=>score(c)-score(a));
 const w=all[0];for(const p of near)b.tried[p.i]=1;
 const contested=t0.length&&t1.length;
 const pc=clamp((contested?.62:.9)+(w.a.hnd-70)*.004+(w.a.aer-70)*.003-(M.weather?.rain||0)*.06,.45,.98);
 RM2.setPose(M,w,b.z>2?'leap':'catch',.4);
 if(chance(M,pc)){
  const prevKicker=b.team;RM2.gainPossession(M,w,w.team===prevKicker?'récupération au pied':'réception');
  if(w.team!==prevKicker){
   const wr=R(M,w.team,w.x);
   if(b.onFull&&wr<22&&wr>=0&&b.kt!=='restart'&&chance(M,.38)){say(M,w.team,'mark',`Marque ! ${w.short} réclame le ballon dans ses 22`,1);RM2.awardPenalty(M,w.team,w.x,w.y,'marque',-1,false,true);return}
   if(wr<0){say(M,w.team,'touchdown',`${w.short} aplatit dans son en-but`,0);RM2.dropOut(M,w.team,'22','Ballon aplati dans l’en-but');return}
   RM2.receiverDecision(M,w);
   if(contested)say(M,w.team,'aerial',`${w.short} gagne le duel aérien`,0);
  }else{
   if(R(M,w.team,w.x)>=100){RM2.scoreTry(M,w);return}
   say(M,w.team,'aerial',`Coup de pied récupéré par ${w.short} !`,1);
  }
  return;
 }
 // ballon échappé
 if(chance(M,.55)&&!(w.team===b.team)){knockOn(M,w,`En-avant de ${w.short} sous la chandelle`);return}
 b.vx=-dir(M,w.team)*rr(M,1,3);b.vy=rr(M,-2,2);b.vz=1.2;b.st='air';b.kind='kick';b.kt='loose';b.tried={};b.bounces=1;
}
function knockOn(M,p,text){
 const b=M.ball;M.st[p.team].knock++;M.st[p.team].errors++;p.s.kk=(p.s.kk||0)+1;
 b.st='air';b.kind='kick';b.kt='loose';b.owner=-1;b.tried={[p.i]:1};b.bounces=1;
 const d=dir(M,p.team);b.vx=d*rr(M,1.5,3.5);b.vy=rr(M,-1.5,1.5);b.vz=1.5;b.z=Math.max(.6,b.z);b.x=p.x;b.y=p.y;
 say(M,p.team,'knock',text,0);
 M.adv={type:'knock',team:1-p.team,x:p.x,y:p.y,t0:M.t,by:p.i,reason:'en-avant'};
}
function pickupCheck(M){
 const b=M.ball;
 const near=M.P.filter(p=>RM2.upright(M,p)&&hyp(p.x-b.x,p.y-b.y)<.85).sort((a,c)=>hyp(a.x-b.x,a.y-b.y)-hyp(c.x-b.x,c.y-b.y));
 if(!near.length)return;
 const p=near[0];
 const opp=M.P.some(q=>q.team!==p.team&&RM2.upright(M,q)&&hyp(q.x-b.x,q.y-b.y)<1.6);
 if(R(M,p.team,p.x)<0&&b.team!==p.team){say(M,p.team,'touchdown',`${p.short} aplatit dans son en-but`,0);RM2.dropOut(M,p.team,'22','Ballon aplati dans l’en-but');return}
 if(R(M,p.team,p.x)>=100&&b.team===p.team){RM2.scoreTry(M,p);return}
 if(opp&&chance(M,.45)){
  // ballon disputé au sol : le premier plonge, ruck formé
  RM2.gainPossession(M,p,b.team===p.team?'ramassage':'ballon perdu');p.mode='ground';p.until=M.t+1.2;RM2.setPose(M,p,'dive',.6);
  RM2.startRuck(M,p,[]);return;
 }
 const how=b.team===p.team?'ramassage':(b.kind==='kick'&&b.kt!=='loose'?'réception':'récupération');
 if(chance(M,clamp(.8+(p.a.hnd-70)*.005,.55,.96))){RM2.gainPossession(M,p,how);RM2.setPose(M,p,'pickup',.35);if(p.team!==b.team)RM2.receiverDecision(M,p)}
 else{b.vx=rr(M,-2,2);b.vy=rr(M,-2,2);b.tried={}}
}
function touchFromBall(M){
 const b=M.ball;const last=M.lastTouchTeam;const side=b.y<35?0:70;
 let tx=b.x,throwT=1-last;
 if(b.kind==='kick'&&b.team===last){
  const kr=R(M,last,b.kickX);
  if(b.penTouch){throwT=last;say(M,last,'touch',`Touche trouvée sur pénalité`,0)}
  else if(b.onFull&&kr>=22&&!b.inOwn22){tx=b.kickX;say(M,last,'touch',`Ballon directement en touche : retour au point de frappe`,0)}
  else if(!b.onFull&&b.fromHalf&&R(M,last,b.x)>78){throwT=last;M.st[last].kick5022++;say(M,last,'5022',`50:22 réussi pour ${nm(M,last)} ! Touche conservée`,1)}
  else say(M,last,'touch',`Coup de pied en touche`,0);
 }else say(M,last,'touch',`Ballon en touche`,0);
 RM2.toTouch(M,throwT,tx,side,null);
}
function deadBall(M){
 const b=M.ball,last=M.lastTouchTeam;
 const inGoalOf=b.x<50?(dir(M,0)>0?0:1):(dir(M,0)>0?1:0);// équipe défendant cet en-but
 if(last!==inGoalOf){say(M,inGoalOf,'dead','Ballon mort derrière la ligne : renvoi aux 22 mètres',0);RM2.dropOut(M,inGoalOf,'22')}
 else{RM2.scrum(M,1-inGoalOf,X(M,1-inGoalOf,95),35,'Mêlée à 5 mètres')}
}

/* ---------- Avantage ---------- */
function advantageTick(M){
 const a=M.adv;if(!a)return;
 const c=RM2.carrier(M);
 if(a.type==='knock'){
  if(a.gained&&M.t-a.gained>2.4){const c2=RM2.carrier(M);const g=c2&&c2.team===a.team?R(M,a.team,c2.x)-R(M,a.team,a.x):0;M.adv=null;
   if(g<7&&!(M.phase==='play'&&M.ball.st==='air'&&M.ball.kind==='kick'&&M.ball.team===a.team)){RM2.scrum(M,a.team,a.x,a.y,`Retour à l’en-avant : mêlée ${nm(M,a.team)}`);return}
   say(M,a.team,'adv','Avantage terminé',0);return}
  if(!a.gained&&M.t-a.t0>2.6){M.adv=null;RM2.scrum(M,a.team,a.x,a.y,`Mêlée pour ${nm(M,a.team)} après en-avant`);return}
  if(c&&c.team!==a.team&&M.t-a.t0>.6&&!a.gained){M.adv=null;RM2.scrum(M,a.team,a.x,a.y,`Mêlée pour ${nm(M,a.team)} après en-avant`);return}
  return;
 }
 if(a.type==='pen'){
  if(c&&c.team===a.team){const g=R(M,a.team,c.x)-R(M,a.team,a.x);if(g>10||M.t-a.t0>7){M.adv=null;say(M,a.team,'adv','Avantage acquis, le jeu continue',0)}}
  if(M.t-a.t0>9){M.adv=null}
 }
}

/* =========================================================
 *  Plaquage
 * ========================================================= */
function beginTackle(M,c,ds){
 const t=c.team,d0=ds[0];
 const cs=hyp(c.vx,c.vy),dsp=hyp(d0.vx,d0.vy);
 // angle : le défenseur arrive-t-il de face, de côté ou de dos ?
 const cdx=c.vx/(cs||1),cdy=c.vy/(cs||1);const ux=(d0.x-c.x),uy=(d0.y-c.y),ul=hyp(ux,uy)||1;
 const facing=(cdx*ux+cdy*uy)/ul;// 1 = de face
 const behind=facing<-.3?1:0;
 const tac=M.T[d0.team].tactics;
 let pMiss=.115+(c.a.agi-d0.a.tkl)*.0036+Math.min(.05,(cs-4.5)*.014)+behind*.09+(1-d0.en)*.2-(ds.length>1?.07:0)+(c.mass-d0.mass)*.0012+(tac.lineSpeed>.75?.03:0)-(c.num<=8?.03:0);
 // près de sa ligne, la défense se resserre et plaque plus bas
 if(RM2.R(M,d0.team,d0.x)<10)pMiss-=.05;
 pMiss=clamp(pMiss,.035,.5);
 // plaquage haut / dangereux
 if(chance(M,.011*disc(d0)*(tac.lineSpeed>.75?1.3:1))){
  d0.s.pen++;M.st[d0.team].penC++;
  say(M,d0.team,'foul',`Plaquage haut de ${d0.short} — avantage ${nm(M,t)}`,1);
  if(chance(M,.13))RM2.card(M,d0,'plaquage dangereux');
  M.adv={type:'pen',team:t,x:c.x,y:c.y,t0:M.t,by:d0.i,reason:'plaquage haut'};
 }
 if(chance(M,pMiss)){
  M.st[d0.team].missed++;d0.s.mt++;d0.mode='ground';d0.until=M.t+rr(M,.9,1.4);RM2.setPose(M,d0,'dive',.7);
  c.slowUntil=M.t+(cs>5?.35:.55);RM2.setPose(M,c,'fend',.35);
  if(ds[1]&&hyp(ds[1].x-c.x,ds[1].y-c.y)<1.3){return beginTackle(M,c,[ds[1]])}
  return;
 }
 const tk=ds.filter(p=>hyp(p.x-c.x,p.y-c.y)<1.7).slice(0,2);
 for(const d of tk){M.st[d.team].tackles++;d.s.tk++;d.mode='contact';RM2.setPose(M,d,'tackle',1)}
 const dom=(d0.mass*(dsp+1)*.45+d0.a.tkl*3+(tk.length-1)*140)-(c.mass*(cs+1)*.55+c.a.str*3)+gauss(M)*90;
 c.mode='contact';RM2.setPose(M,c,'tackled',1);
 M.tk={c:c.i,d:tk.map(p=>p.i),t0:M.t,dur:rr(M,.55,.85),dom:dom>55?1:dom<-80?-1:0,offT:rr(M,.18,.4),vx:c.vx*(dom>55?-.15:.42),vy:c.vy*.3,done:false};
 // blessure rare
 if(chance(M,.0035))RM2.injure(M,chance(M,.5)?c:d0);
}
function tackleTick(M,dt){
 const tk=M.tk,c=M.P[tk.c],el=M.t-tk.t0;
 if(!c||RM2.carrier(M)!==c){for(const i of tk.d){const d=M.P[i];if(d.mode==='contact'){d.mode='ground';d.until=M.t+.5}}if(c&&c.mode==='contact'){c.mode='run'}M.tk=null;return}
 // le porteur ralentit, les plaqueurs l'accompagnent au sol
 c.x+=tk.vx*dt*Math.max(0,1-el/tk.dur);c.y+=tk.vy*dt*Math.max(0,1-el/tk.dur);c.vx*=.85;c.vy*=.85;
 for(const i of tk.d){const d=M.P[i];const a=Math.atan2(d.y-c.y,d.x-c.x);d.x=c.x+Math.cos(a)*.62;d.y=c.y+Math.sin(a)*.62;d.vx=c.vx;d.vy=c.vy}
 // offload ou en-avant dans le contact
 if(!tk.offChecked&&el>=tk.offT){tk.offChecked=true;
  const tac=M.T[c.team].tactics;
  const pOff=tk.dom>0?.005:.015+tac.risk*.05+(c.a.hnd-70)*.002+(M.T[c.team].mind==='chase'?.03:0);
  if(chance(M,clamp(pOff,0,.2))&&RM2.offload(M,c)){c.mode='ground';c.until=M.t+1;for(const i of tk.d){const d=M.P[i];d.mode='ground';d.until=M.t+.8}M.tk=null;say(M,c.team,'offload',`Offload de ${c.short} dans le contact !`,0);return}
  if(chance(M,clamp(.018+(70-c.a.hnd)*.0007+(tk.dom>0?.015:0)+(M.weather?.rain||0)*.012,.006,.06))){c.mode='run';c.slowUntil=M.t+.5;for(const i of tk.d){const d=M.P[i];d.mode='ground';d.until=M.t+.7}M.tk=null;knockOn(M,c,`Ballon échappé au contact par ${c.short}`);return}
 }
 if(el>=tk.dur){
  M.tk=null;
  const r=R(M,c.team,c.x);
  metresGained(M,c);
  for(const i of tk.d){const d=M.P[i];d.mode='ground';d.until=M.t+rr(M,.7,1.15);RM2.setPose(M,d,'ground',.5)}
  c.mode='ground';c.until=M.t+rr(M,1.5,2.2);RM2.setPose(M,c,'ground',.5);
  // percussion près de la ligne : le porteur peut s'étirer pour aplatir
  if(r>=97.6&&r<99.6&&tk.dom<=0&&chance(M,.22+(c.a.str-70)*.006)){c.x+=dir(M,c.team)*Math.min(1,100.2-r);M.ball.x=X(M,c.team,100.3);RM2.scoreTry(M,c);return}
  if(r>=99.6){
   const heldP=.12+tk.d.length*.07;
   if(chance(M,heldP)){say(M,c.team,'held',`Tenu en l’air par la défense ! Renvoi de la ligne d’en-but`,1);RM2.dropOut(M,1-c.team,'goal');return}
   RM2.scoreTry(M,c);return;
  }
  M.lastDom=tk.dom;
  RM2.startRuck(M,c,tk.d.map(i=>M.P[i]));
 }
}

/* =========================================================
 *  Ruck
 * ========================================================= */
RM2.startRuck=function(M,c,tacklers){
 const t=c.team,d=dir(M,t);
 M.play=null;
 const ruck={x:c.x,y:clamp(c.y,1,69),att:t,t0:M.t,attB:[],defB:[],jackal:-1,jt:0,cleared:false,released:false,carrier:c.i,
  tacklers:tacklers.map(p=>p.i),sh:-1,dom:M.lastDom||0,pen:null};
 M.lastDom=0;
 const tac=M.T[t].tactics,dtac=M.T[1-t].tactics;
 const base=2.5+(1-tac.tempo)*1.8;
 ruck.ready=base+(ruck.dom>0?1.5:ruck.dom<0?-.5:0)+rr(M,0,1.4)+(M.T[t].mind==='protect'?.8:M.T[t].mind==='chase'?-.6:0);
 // fautes au ruck (hors-jeu, mains au sol, pas de libération) — avantage parfois joué
 if(chance(M,.022*(.8+dtac.contest*.5)*(.6+.4*disc(byNum(M,1-t,7)||c)))){ruck.pen={team:t,at:rr(M,.4,2),reason:chance(M,.5)?'hors-jeu au ruck':'mains dans le ruck'}}
 else if(chance(M,.011)){ruck.pen={team:1-t,at:rr(M,.5,1.8),reason:'joueur scellant le ballon'}}
 M.ruck=ruck;M.phase='ruck';M.pd={t:0};M.live=true;
 const b=M.ball;b.st='ruck';b.owner=-1;b.x=c.x-d*.7;b.y=ruck.y;b.z=.12;b.vx=b.vy=0;
 M.st[t].rucks++;M.T[t].phaseNo++;
 M._shapeAt=0;
};
PH.ruck=function(M,dt){
 M.live=true;RM2.mindset(M);
 const k=M.ruck,t=k.att,o=1-t,d=dir(M,t),el=M.t-k.t0,b=M.ball;
 const bx=b.x,by=b.y;
 // pénalité au ruck
 if(k.pen&&el>=k.pen.at){const p=k.pen;k.pen=null;
  const off=M.P.filter(q=>q.team===1-p.team&&RM2.active(q)).sort((a,c)=>hyp(a.x-bx,a.y-by)-hyp(c.x-bx,c.y-by))[0];
  if(off){off.s.pen++;M.st[off.team].penC++}
  RM2.awardPenalty(M,p.team,bx,by,p.reason,off?off.i:-1);return}
 // demi de mêlée / relayeur
 if(k.sh<0||!RM2.upright(M,M.P[k.sh])||el<.2){
  const nine=byNum(M,t,9);
  if(nine&&RM2.upright(M,nine)&&hyp(nine.x-bx,nine.y-by)<22)k.sh=nine.i;
  else{const alt=M.P.filter(p=>p.team===t&&RM2.upright(M,p)&&!k.attB.includes(p.i)).sort((a,c)=>hyp(a.x-bx,a.y-by)-hyp(c.x-bx,c.y-by))[0];if(alt)k.sh=alt.i}
 }
 // engagement des soutiens offensifs
 const defNear=M.P.filter(p=>p.team===o&&RM2.upright(M,p)&&hyp(p.x-bx,p.y-by)<3).length;
 const need=clamp(1+(defNear>=1?1:0)+(k.jackal>=0?1:0),1,3);
 if(k.attB.length+(k.going?.length||0)<need&&el<2.5){
  const cand=M.P.filter(p=>p.team===t&&RM2.upright(M,p)&&p.i!==k.sh&&p.num!==10&&!k.attB.includes(p.i)&&!(k.going||[]).includes(p.i))
   .sort((a,c)=>(hyp(a.x-bx,a.y-by)+(a.num>8?5:0))-(hyp(c.x-bx,c.y-by)+(c.num>8?5:0)));
  k.going=k.going||[];if(cand[0]&&hyp(cand[0].x-bx,cand[0].y-by)<14)k.going.push(cand[0].i);
 }
 const slots=[[-.95,0],[-1.25,.75],[-1.25,-.75]];
 for(const i of [...(k.going||[])]){const p=M.P[i];if(!RM2.upright(M,p)){k.going=k.going.filter(j=>j!==i);continue}
  const n=k.attB.length;const s=slots[Math.min(n,2)];const sx=bx-d*(-s[0])*-1;
  const tx=bx+d*s[0]+d*.2,ty=by+s[1];
  RM2.go(p,tx,ty,1);p.task='nettoie le ruck';
  if(hyp(p.x-tx,p.y-ty)<.8){p.mode='bound';p.bind='ruck';p.vx=p.vy=0;p.hd=d>0?0:Math.PI;k.attB.push(i);k.going=k.going.filter(j=>j!==i);
   if(k.jackal>=0){const j=M.P[k.jackal];const pClear=clamp(.5+(p.a.str+p.a.brk-j.a.str-j.a.brk)/220+(k.attB.length-1)*.15,.15,.9);
    if(chance(M,pClear)){j.mode='ground';j.until=M.t+1.1;RM2.setPose(M,j,'ground',.6);k.defB=k.defB.filter(x=>x!==j.i);k.jackal=-1;say(M,t,'clear',`${p.short} déblaie le gratteur`,0)}}
  }
 }
 // défense : gratteur ou contre-ruck
 if(k.jackal<0&&!k.noJackal&&el>.25&&el<1.6){
  const dtac=M.T[o].tactics;
  const j=M.P.filter(p=>p.team===o&&RM2.upright(M,p)&&hyp(p.x-bx,p.y-by)<3.2).sort((a,c)=>(hyp(a.x-bx,a.y-by)-a.a.brk/30)-(hyp(c.x-bx,c.y-by)-c.a.brk/30))[0];
  if(j&&k.attB.length<2){
   if(chance(M,clamp(.12+dtac.contest*.32+(j.a.brk-70)/160,.04,.6))){k.jackalGo=j.i;k.noJackal=true}else k.noJackal=true;
  }
 }
 if(k.jackalGo!=null&&k.jackal<0){const j=M.P[k.jackalGo];
  if(!RM2.upright(M,j)||k.attB.length>=2){k.jackalGo=null}
  else{const tx=bx+d*.55,ty=by;RM2.go(j,tx,ty,1);j.task='gratte';
   if(hyp(j.x-tx,j.y-ty)<.7){j.mode='bound';j.bind='jackal';j.hd=d>0?Math.PI:0;k.jackal=j.i;k.defB.push(j.i);k.jt=M.t;k.jackalGo=null}}}
 if(k.jackal>=0){
  const j=M.P[k.jackal];
  if(k.attB.length===0&&M.t-k.jt>.6){// porteur isolé : ballon volé
   k.jackal=-1;j.mode='run';M.st[t].turnovers++;j.s.to++;M.ruck=null;M.phase='play';M.pd={t:0};
   say(M,o,'turnover',`Grattage de ${j.short} ! Ballon récupéré`,1);releaseRuckPlayers(M,k);RM2.gainPossession(M,j,'grattage');return}
  if(M.t-k.jt>1.0){
   k.jackal=-1;const steal=chance(M,.36);
   if(steal){j.mode='run';M.st[t].turnovers++;j.s.to++;M.ruck=null;M.phase='play';M.pd={t:0};say(M,o,'turnover',`Grattage réussi de ${j.short} !`,1);releaseRuckPlayers(M,k);RM2.gainPossession(M,j,'grattage');return}
   const car=M.P[k.carrier];car.s.pen++;M.st[t].penC++;j.s.to++;
   RM2.awardPenalty(M,o,bx,by,'ballon non libéré',car.i);say(M,o,'jackal',`${j.short} obtient la pénalité au sol`,1);return;
  }
 }
 // contre-ruck visuel : un défenseur se lie de l'autre côté
 if(!k.defBound&&el>.6&&k.attB.length>=1){k.defBound=true;
  const q=M.P.filter(p=>p.team===o&&RM2.upright(M,p)&&hyp(p.x-bx,p.y-by)<2.5&&p.num<=8)[0];
  if(q&&chance(M,.5)){k.cr=q.i;k.crY=by+(rnd(M)-.5)*.8}}
 if(k.cr!=null&&k.cr>=0){const q=M.P[k.cr];if(!RM2.upright(M,q)||el>4){k.cr=-1}else{RM2.go(q,bx+d*.95,k.crY,.9);q.task='contre-ruck';if(hyp(q.x-(bx+d*.95),q.y-k.crY)<.7){q.mode='bound';q.bind='ruck';q.vx=q.vy=0;q.hd=d>0?Math.PI:0;k.defB.push(q.i);k.cr=-1}}}
 // placement de tous les autres joueurs
 const ex=new Set([...k.attB,...k.defB,k.carrier,...k.tacklers.filter(i=>M.P[i].mode==='ground')]);
 if(k.sh>=0)ex.add(k.sh);
 if(!M._shapeAt||M.t-M._shapeAt>.3){M._shapeAt=M.t;
  M._aShape=RM2.attackShape(M,t,bx,by,new Set([...ex,...(k.going||[])]));
  const offs=R(M,o,bx)-1.1;// pieds du dernier joueur du ruck côté défense
  M._dShape=RM2.defenseShape(M,o,bx,by,{exclude:new Set([...ex,...(k.jackalGo!=null?[k.jackalGo]:[])]),ruck:true,offside:offs,released:false});
 }
 for(const p of M.P){
  if(!RM2.active(p)||!RM2.upright(M,p)||ex.has(p.i)||(k.going||[]).includes(p.i)||p.i===k.jackalGo)continue;
  if(M.t<p.think)continue;p.think=M.t+p.react*(.8+rnd(M)*.6);
  const sl=p.team===t?M._aShape.slots.get(p.i):M._dShape.get(p.i);
  if(sl){
   // hors-jeu au ruck : retour en urgence derrière la ligne (pieds du dernier joueur), sans traverser le regroupement
   const tm=p.team===t?t:o,rel=R(M,tm,p.x)-R(M,tm,bx);
   if(rel>-.8&&p.team===o){RM2.go(p,X(M,o,R(M,o,bx)-2.2),p.y+(sl.y-p.y)*.25,.95);p.task='revient en jeu'}
   else if(rel>1&&p.team===t){RM2.go(p,X(M,t,R(M,t,bx)-2.5),p.y+(sl.y-p.y)*.3,.9);p.task='se replace (hors-jeu)'}
   else{
    // changement de côté : on contourne le ruck par l'arrière de son camp au lieu de le traverser
    let gx=sl.x,gy=sl.y;
    if(Math.sign(p.y-by)!==Math.sign(sl.y-by)&&Math.abs(p.y-by)<9&&Math.abs(R(M,tm,p.x)-R(M,tm,bx))<4.5){gx=X(M,tm,R(M,tm,bx)-4.5);gy=p.y+(sl.y-p.y)*.5}
    RM2.go(p,gx,gy,sl.urg||(hyp(sl.x-p.x,sl.y-p.y)>10?.85:.6));p.task=sl.task}}
 }
 // le demi de mêlée vient derrière le ballon
 const sh=k.sh>=0?M.P[k.sh]:null;
 if(sh&&RM2.upright(M,sh)){RM2.go(sh,bx-d*.75,by+(by<35?.4:-.4),1);sh.task='demi de mêlée'}
 const ready=sh&&hyp(sh.x-(bx-d*.75),sh.y-by)<1.05&&k.jackal<0&&k.jackalGo==null;
 if((ready&&el>=k.ready)||(el>5.2&&sh&&hyp(sh.x-bx,sh.y-by)<2.5)){releaseRuck(M,k,sh);return}
 if(el>8){M.ruck=null;releaseRuckPlayers(M,k);RM2.scrum(M,o,bx,by,'Ballon injouable : mêlée');}
};
function releaseRuckPlayers(M,k){for(const i of [...k.attB,...k.defB]){const p=M.P[i];if(p.mode==='bound'){p.mode='run';p.slowUntil=M.t+.45;p.bind=null;RM2.setPose(M,p,'rise',.4)}}}
function releaseRuck(M,k,sh){
 releaseRuckPlayers(M,k);M.ruck=null;M.phase='play';M.pd={t:0};
 M.st[k.att].rucksWon++;
 RM2.gainPossession(M,sh,'sortie de ruck');RM2.setPose(M,sh,'pickup',.25);
 M.play=RM2.callPlay(M,k.att,sh,{x:k.x,y:k.y});
}

/* =========================================================
 *  Annonces : choix collectif de l'option de jeu
 * ========================================================= */
RM2.callPlay=function(M,t,sh,at,origin='ruck'){
 const tac=M.T[t].tactics,mind=M.T[t].mind,r=R(M,t,at.x),side=at.y<35?1:-1,openW=side>0?70-at.y:at.y,shortW=70-openW;
 const phaseNo=M.T[t].phaseNo,left=2*RM2.HALF-M.clock,diff=M.score[t]-M.score[1-t];
 const fatigue=M.P.filter(p=>p.team===t&&RM2.active(p)).reduce((s,p)=>s+p.en,0)/15;
 const defOpen=M.P.filter(p=>p.team!==t&&RM2.upright(M,p)&&Math.sign(p.y-at.y)===side&&Math.abs(R(M,t,p.x)-r)<12).length;
 const attOpen=M.P.filter(p=>p.team===t&&RM2.upright(M,p)&&Math.sign(p.y-at.y)===side&&p.num>8).length;
 const W={};
 W.pick=.05+tac.forwards*.07+(r>94?.9:r>88?.25:0)+(mind==='protect'?.12:0);
 W.pod=.3+tac.forwards*.32+(r>84?.14:0)+(mind==='protect'?.12:0)+(origin==='ruck'?0:-.2);
 W.backs=.22+tac.width*.36+(openW>32?.12:0)+(phaseNo>=3?.08:0)+(attOpen>defOpen?.2:0)-(r<22?.12:0)+(mind==='chase'?.12:0)+(origin!=='ruck'?.35:0);
 W.snipe=.025+(sh.num===9?.025:0)+(M.P.filter(p=>p.team!==t&&RM2.upright(M,p)&&hyp(p.x-at.x,p.y-at.y)<3).length===0?.12:0);
 const kickK=tac.kicking*(mind==='chase'?.35:mind==='protect'?1.5:1)*(fatigue<.6?1.3:1);
 W.box=r<48&&origin!=='lineout'?(.06+kickK*.3+(r<22?.4:0))*(sh.num===9?1:.4):0;
 W.kick10=r<60?(.08+kickK*.3+(r<22?.35:0)+(phaseNo>=4?.08:0)):r<85?(.02+tac.risk*.05+kickK*.03):0;
 if(left<300&&diff>=-3&&diff<=0&&r>58&&r<84&&phaseNo>=2)W.drop=.9;else if(r>60&&r<80&&phaseNo>=6)W.drop=.035;else W.drop=0;
 if(mind==='protect'&&left<120&&diff>0){W.kick10+=.6} // fin de match : sortir le ballon
 if(tac.kickStyle==='box'&&W.box)W.box*=1.8;
 let tot=0;for(const k in W)tot+=Math.max(0,W[k]);let x=rnd(M)*tot,kind='pod';for(const k in W){x-=Math.max(0,W[k]);if(x<=0){kind=k;break}}
 const mates=M.P.filter(p=>p.team===t&&RM2.upright(M,p)&&p.i!==sh.i);
 const nearestSide=(list)=>list.filter(p=>Math.sign(p.y-at.y)===side||Math.abs(p.y-at.y)<2).sort((a,b)=>hyp(a.x-at.x,a.y-at.y)-hyp(b.x-at.x,b.y-at.y));
 const pl={team:t,kind,var:'',seq:[sh.i],k:0,cur:sh.i,side,aborted:false,t0:M.t,hold:.5,kinds:[]};
 const fw=nearestSide(mates.filter(p=>p.num<=8&&!['bound','ground'].includes(p.mode)));
 const ten=mates.find(p=>p.num===10)||mates.find(p=>p.num===12)||mates.find(p=>p.num===15);
 if(kind==='pick'){const f=fw[0];if(f)pl.seq.push(f.i);pl.var='pick and go'}
 else if(kind==='pod'){const pod=fw.filter(p=>hyp(p.x-at.x,p.y-at.y)<16);const lead=pod[0];
  if(lead){pl.seq.push(lead.i);const v=rnd(M);
   if(v<.16+tac.risk*.1&&pod[1]){pl.seq.push(pod[1].i);pl.var='passe au contact'}
   else if(v<.32+tac.width*.12&&ten){pl.seq.push(ten.i);pl.var='passe dans le dos';addBacks(M,t,pl,ten,side,mates,tac,r)}
   else pl.var='cellule d’avants'}
  else{kind=pl.kind='backs'}}
 if(pl.kind==='backs'){if(ten){pl.seq.push(ten.i);addBacks(M,t,pl,ten,side,mates,tac,r)}}
 else if(kind==='snipe'){pl.var='départ au ras du 9'}
 else if(kind==='box'){pl.kickBy=sh.i;pl.kt='box';pl.kickDelay=rr(M,.35,.6);pl.var='chandelle du 9'}
 else if(kind==='kick10'){if(ten){pl.seq.push(ten.i);pl.kickBy=ten.i;pl.kickDelay=rr(M,.35,.7);
   pl.kt=r>70?(rnd(M)<.4?'transversale':rnd(M)<.5?'rasant':'par-dessus'):(tac.kickStyle==='5022'||(r>35&&r<50&&chance(M,.25))?'5022':tac.kickStyle==='chandelle'?'chandelle':r<22?'touche':chance(M,.45)?'long':chance(M,.5)?'touche':'chandelle');
   pl.var='jeu au pied du 10'}else{pl.kickBy=sh.i;pl.kt='box'}}
 else if(kind==='drop'){if(ten){pl.seq.push(ten.i);pl.kickBy=ten.i;pl.kt='drop';pl.kickDelay=.5;pl.var='drop'}}
 M.T[t].lastCall=pl.var||kind;
 if(phaseNo<=1||chance(M,.18)||['drop','box','kick10','snipe'].includes(kind))say(M,t,'call',`${nm(M,t)} · temps ${Math.max(1,phaseNo)} : ${annonce(pl)}`,0);
 return pl;
};
function annonce(pl){return ({pick:'pick and go',pod:pl.var,backs:'attaque des trois-quarts'+(pl.var?' ('+pl.var+')':''),snipe:'départ du 9',box:'chandelle du 9',kick10:'jeu au pied ('+pl.kt+')',drop:'tentative de drop'})[pl.kind]||pl.kind}
RM2.addBacks=addBacks;
function addBacks(M,t,pl,ten,side,mates,tac,r){
 const by=n=>mates.find(p=>p.num===n);
 const c12=by(12),c13=by(13),fb=by(15);
 const wings=mates.filter(p=>p.num===11||p.num===14).sort((a,b)=>side*(b.y-a.y));
 const wing=wings[0];
 let v=pl.forceVar||(tac.playbook!=='auto'?tac.playbook:null);
 if(!v){const x=rnd(M);v=x<.34?'ligne':x<.5?'sautée':x<.63?'croisée':x<.76?'redoublée':x<.88?'leurre':'arrière intercalé'}
 pl.var=v;
 const push=p=>{if(p&&!pl.seq.includes(p.i))pl.seq.push(p.i)};
 if(v==='ligne'){push(c12);push(c13);if(tac.width>.45||chance(M,.5))push(wing)}
 else if(v==='sautée'){push(c13);push(wing);pl.kinds[pl.seq.length-1]='sautée'}
 else if(v==='croisée'){push(c12)}
 else if(v==='redoublée'){push(c12);push(ten);pl.loopP=ten.i;push(c13);if(chance(M,.5))push(wing)}
 else if(v==='leurre'){push(fb||c13);push(wing)}
 else if(v==='ailier fermé'){const bw=wings[wings.length-1];if(bw&&bw!==wing){push(bw);pl.blindWing=bw.i}push(c13)}
 else if(v==='centres'){push(c12)}
 else{push(c12);push(fb);push(wing)}
}

/* =========================================================
 *  Jeu au pied
 * ========================================================= */
RM2.kickFromPlay=function(M,c,kt){
 const t=c.team,d=dir(M,t),r0=R(M,t,c.x),k=c.a.kck;
 const fb=M.P.find(p=>p.team!==t&&p.num===15&&RM2.active(p));
 let lr,ly,T,info={kt,inOwn22:r0<22,fromHalf:r0<50};
 const near=c.y<35?0:70,far=70-near,inF=y=>y===0?1:-1;
 if(kt==='drop'){RM2.dropGoal(M,c);return}
 if(kt==='touche'){const dist=26+k*.24+rr(M,-4,4);
  if(r0<22){lr=r0+dist*.9;ly=near===0?-2.5:72.5}else{lr=r0+dist*.85;ly=near===0?rr(M,-1.5,3.5):70-rr(M,-1.5,3.5)}T=2.7}
 else if(kt==='long'){lr=r0+36+k*.12+rr(M,-5,5);ly=fb?(fb.y<35?rr(M,46,60):rr(M,10,24)):rr(M,15,55);T=3.5}
 else if(kt==='box'){lr=r0+rr(M,16,22);ly=clamp(c.y+(c.y<35?-1:1)*rr(M,2,7),5,65);T=4.4}
 else if(kt==='chandelle'){lr=r0+rr(M,20,28);ly=clamp(c.y+rr(M,-6,6),6,64);T=4.4}
 else if(kt==='rasant'){lr=r0+rr(M,7,10);ly=clamp(c.y+rr(M,-4,4),4,66);T=.45;info.zEnd=0}
 else if(kt==='par-dessus'){lr=r0+rr(M,9,13);ly=clamp(c.y+rr(M,-5,5),4,66);T=1.5}
 else if(kt==='transversale'){lr=Math.min(r0+rr(M,8,16),97);ly=c.y<35?rr(M,58,66):rr(M,4,12);T=2.3}
 else if(kt==='5022'){lr=rr(M,80,90);ly=near===0?rr(M,2,6):70-rr(M,2,6);T=2.9;info.fromHalf=r0<50}
 else{lr=r0+30;ly=35;T=3.2}
 const dist=Math.abs(lr-r0);
 const sig=dist*(.035+(90-k)/1100);
 lr+=gauss(M)*sig;ly+=gauss(M)*sig*.8;
 const lx=X(M,t,clamp(lr,r0+3,112));
 RM2.launch(M,c,lx,ly,T,'kick',info);
 if(kt==='rasant'){M.ball.vx=d*rr(M,12,16);M.ball.vz=1.6}
 M.ball.kickX=c.x;M.st[t].kicks++;M.play=null;
 RM2.setPose(M,c,'kick',.5);c.kickedRecently=M.t;
 for(const p of M.P)if(p.team===t)p.onside=R(M,t,p.x)<=r0+.5;
 say(M,t,'kick',`${c.short} ${({touche:'cherche la touche',long:'tape long',box:'tape une chandelle',chandelle:'tape une chandelle',rasant:'glisse un coup de pied rasant',['par-dessus']:'tente le petit par-dessus',transversale:'tente la transversale',['5022']:'vise le 50:22'})[kt]||'joue au pied'}`,0);
};

/* =========================================================
 *  Arrêts de jeu → phases statiques
 * ========================================================= */
function resetPlayers(M){M.tk=null;M.ruck=null;M.play=null;unbindAll(M);for(const p of M.P){p.onside=true;p.breakFlag=false;p.plannedKick=0;p.loopFor=null}}
RM2.toTouch=function(M,throwT,x,side,text){
 if(text)say(M,throwT,'touch',text,0);
 if(RM2.stoppage(M,'touch'))return;
 resetPlayers(M);
 let r=R(M,throwT,x);r=clamp(r,5,95);
 // mi-temps : la touche jouée après une pénalité à la sirène reste jouée (stoppage le gère)
 RM2.lineout(M,throwT,X(M,throwT,r),side);
};
RM2.scrum=function(M,feedT,x,y,text){
 if(text)say(M,feedT,'scrum',text,0);
 if(RM2.stoppage(M,'scrum'))return;
 resetPlayers(M);
 const r=clamp(R(M,feedT,x),5,95);
 M.phase='scrum';M.live=false;M.pd={t:0,stage:'setup',feed:feedT,x:X(M,feedT,r),y:clamp(y,15,55),resets:0};
 M.ball.st='dead';M.ball.owner=-1;
 RM2.deadTime(M,rr(M,24,44));
 RM2.subsCheck(M);
};
RM2.lineout=function(M,throwT,x,side){
 M.phase='lineout';M.live=false;M.pd={t:0,stage:'setup',team:throwT,x,side};M.ball.st='dead';M.ball.owner=-1;
 RM2.deadTime(M,rr(M,12,24));
 RM2.subsCheck(M);
};
RM2.dropOut=function(M,kickT,kind,text){
 if(text)say(M,kickT,'restart',text,0);
 if(RM2.stoppage(M,'dropout'))return;
 resetPlayers(M);
 M.phase='kickoff';M.live=false;M.pd={t:0,stage:'setup',team:kickT,kind:kind==='goal'?'goal':'22'};M.ball.st='dead';
 RM2.deadTime(M,rr(M,12,25));
 say(M,kickT,'restart',kind==='goal'?'Renvoi depuis la ligne d’en-but':'Renvoi aux 22 mètres',0);
};

/* ---------- Coup d'envoi / renvois ---------- */
RM2.setupKickoff=function(M,kT,snap){
 resetPlayers(M);
 M.phase='kickoff';M.live=false;M.pd={t:0,stage:'setup',team:kT,kind:'centre'};M.ball.st='dead';M.ball.owner=-1;
 if(snap){const L=kickoffLayout(M,kT,'centre');for(const s of L){const p=M.P[s.i];p.x=p.tx=s.x;p.y=p.ty=s.y;p.vx=p.vy=0;p.hd=dir(M,p.team)>0?0:Math.PI;p.px=p.x;p.py=p.y}
  M.ball.x=X(M,kT,50);M.ball.y=35;}
};
function kickoffLayout(M,kT,kind){
 const o=1-kT,out=[];const r0=kind==='centre'?50:kind==='22'?22:1;
 const ks=M.pd.kside!=null?M.pd.kside:(M.pd.kside=rnd(M)<.5?1:-1);
 const kick=M.P.find(p=>p.team===kT&&p.num===10&&RM2.active(p))||goalKicker(M,kT);
 M.pd.kicker=kick.i;
 const kt=M.P.filter(p=>p.team===kT&&RM2.active(p)&&p!==kick);
 kt.sort((a,b)=>a.num-b.num);
 kt.forEach((p,k)=>{const fw=p.num<=8;const y=fw?35+ks*(4+k*3.6):35-ks*(4+(k-7)*4.2);out.push({i:p.i,x:X(M,kT,r0-1-(fw?0:1.5)),y:clamp(y,3,67)})});
 out.push({i:kick.i,x:X(M,kT,r0-2.5),y:35+ks*-2});
 const rec=M.P.filter(p=>p.team===o&&RM2.active(p));
 const ro=100-r0;// position du renvoi dans le repère du receveur
 for(const p of rec){let rr0,y;
  if(p.num<=8){rr0=Math.min(ro-11,ro-11-(p.num===4||p.num===5?1:p.num>=6?4:2.5));y=35+ks*(4+((p.num*7)%5)*3.5)*((p.num%2)?1:.6)}
  else if(p.num===15){rr0=Math.max(4,ro-38);y=35}
  else if(p.num===11||p.num===14){rr0=Math.max(6,ro-30);y=p.num===11?14:56}
  else if(p.num===9){rr0=ro-20;y=35+ks*8}
  else{rr0=ro-22-(p.num-10)*1.5;y=35-ks*(p.num-9)*5}
  out.push({i:p.i,x:X(M,o,clamp(rr0,-2,98)),y:clamp(y,3,67)})}
 return out;
}
PH.kickoff=function(M,dt){
 const pd=M.pd;M.live=false;
 if(pd.stage==='setup'){
  if(!pd.layout){pd.layout=kickoffLayout(M,pd.team,pd.kind);pd.ids=pd.layout.map(s=>s.i)}
  for(const s of pd.layout){const p=M.P[s.i];if(RM2.upright(M,p))RM2.go(p,s.x,s.y,hyp(p.x-s.x,p.y-s.y)>12?.7:.45)}
  const kick=M.P[pd.kicker];M.ball.st='held';M.ball.owner=kick.i;
  if(pd.t>2.2&&(allArrived(M,pd.ids,1.8)||pd.t>16)){pd.stage='go';pd.t0=M.t;M.ball.st='dead';M.ball.x=kick.x+dir(M,pd.team)*1.4;M.ball.y=kick.y;M.ball.z=0}
  return;
 }
 if(pd.stage==='go'){
  const kick=M.P[pd.kicker];const d=dir(M,pd.team);
  RM2.go(kick,M.ball.x-d*.3,M.ball.y,.5);
  for(const s of pd.layout){const p=M.P[s.i];if(p.team===pd.team&&p!==kick&&M.t-pd.t0>.6)RM2.go(p,s.x+d*3,s.y,.6)}
  if(M.t-pd.t0>1.1&&hyp(kick.x-M.ball.x,kick.y-M.ball.y)<1.2){
   const r0=R(M,pd.team,M.ball.x);
   let lr,ly,T;
   const long=pd.kind!=='centre'?chance(M,.65):chance(M,.18);
   if(long){lr=r0+rr(M,35,48);ly=rr(M,14,56);T=3.6}else{lr=r0+rr(M,11,16);ly=35+pd.kside*rr(M,10,22);T=3.5}
   lr+=gauss(M)*1.6;ly+=gauss(M)*2;
   RM2.launch(M,{x:M.ball.x,y:M.ball.y,team:pd.team,i:kick.i},X(M,pd.team,lr),clamp(ly,2,68),T,'kick',{kt:'restart'});
   M.ball.kickX=M.ball.x;M.st[pd.team].kicks++;RM2.setPose(M,kick,'kick',.5);
   for(const p of M.P)p.onside=true;
   M.phase='play';M.pd={t:0};M.live=true;M.poss=1-pd.team;M.play=null;
   say(M,pd.team,'kickoff',pd.kind==='centre'?`Coup d’envoi de ${kick.short}`:`Renvoi de ${kick.short}`,0);
  }
 }
};

/* ---------- Mêlée ---------- */
function scrumLayout(M,pd){
 const out=[];const fx=pd.x,fy=pd.y,open=fy<35?1:-1;
 for(let t=0;t<2;t++){const d=dir(M,t);const feedSide=t===pd.feed;
  const rel={1:[-.6,-.78],2:[-.6,0],3:[-.6,.78],4:[-1.55,-.42],5:[-1.55,.42],6:[-1.45,-1.25],7:[-1.45,1.25],8:[-2.55,0]};
  for(const p of M.P.filter(q=>q.team===t&&RM2.active(q))){
   if(p.num<=8){const [dx,dy]=rel[p.num];out.push({i:p.i,x:fx+d*dx,y:fy+dy*d,bind:true})}
   else if(p.num===9){out.push({i:p.i,x:fx+(feedSide?0:d*.6),y:fy+(feedSide?1.4:1.7)*(open>0?-1:1)*(feedSide?1:1)})}
   else{const back=feedSide?-8:-7.6;const L={10:[back,open*6],12:[back-1.5,open*11],13:[back-2.3,open*16.5],15:[back-10,open*7]};
    let pos=L[p.num];if(p.num===11||p.num===14){const wingOpen=(p.num===11)===(open>0?(d>0):(d<0));pos=[back-1.5,0];const y=(Math.abs(p.y-(open>0?70:0))<Math.abs(p.y-(open>0?0:70)))?(open>0?64:6):(open>0?Math.max(fy-14,6):Math.min(fy+14,64));out.push({i:p.i,x:fx+d*pos[0],y});continue}
    out.push({i:p.i,x:fx+d*pos[0],y:clamp(fy+pos[1],3,67)})}
  }}
 return out;
}
PH.scrum=function(M,dt){
 const pd=M.pd,t=pd.feed,o=1-t,d=dir(M,t);M.live=pd.stage==='push'||pd.stage==='out';
 if(pd.stage==='setup'){
  if(!pd.layout){pd.layout=scrumLayout(M,pd);pd.ids=pd.layout.filter(s=>s.bind).map(s=>s.i)}
  for(const s of pd.layout){const p=M.P[s.i];if(!RM2.active(p))continue;if(p.mode==='ground'&&p.until>M.t)continue;
   if(s.bind&&p.mode==='bound')continue;
   if(p.mode!=='run'){p.mode='run'}
   RM2.go(p,s.x,s.y,hyp(p.x-s.x,p.y-s.y)>14?.62:.42);
   if(s.bind&&hyp(p.x-s.x,p.y-s.y)<.35&&pd.t>1.5){p.mode='bound';p.bind='scrum';p.vx=p.vy=0;p.hd=dir(M,p.team)>0?0:Math.PI}}
  const nine=byNum(M,t,9)||goalKicker(M,t);M.ball.st='held';M.ball.owner=nine.i;
  const bound=pd.ids.filter(i=>M.P[i].mode==='bound').length;
  const ready=pd.ids.every(i=>{const p=M.P[i];const s=pd.layout.find(z=>z.i===i);return !RM2.active(p)||p.mode==='bound'||hyp(p.x-s.x,p.y-s.y)<1.0});
  if((bound>=pd.ids.length&&pd.t>3)||(ready&&pd.t>14)||pd.t>40){for(const i of pd.ids){const p=M.P[i];if(!RM2.active(p))continue;p.mode='bound';p.bind='scrum';p.vx=p.vy=0;p.hd=dir(M,p.team)>0?0:Math.PI}
   pd.stage='engage';pd.t0=M.t;say(M,t,'scrum',`Mêlée · introduction ${nm(M,t)}`,0);if(RM2.setPieceCall)RM2.setPieceCall(M,'scrum',t,pd)}
  return;
 }
 const packs=[0,1].map(tm=>M.P.filter(p=>p.team===tm&&p.mode==='bound'&&p.bind==='scrum'));
 if(pd.stage==='engage'&&pd.layout){for(const s of pd.layout){if(!s.bind)continue;const p=M.P[s.i];if(p.mode!=='bound')continue;p.x+=(s.x-p.x)*.25;p.y+=(s.y-p.y)*.25}}
 if(pd.stage==='engage'){
  for(const tm of [0,1])for(const p of packs[tm]){p.pose='scrum';p.poseT=M.t;}
  if(M.t-pd.t0>1.6){
   // décision de l'issue : puissance des 8 avants (première ligne prépondérante)
   const w={1:1.45,2:1.3,3:1.5,4:1.15,5:1.15,6:.55,7:.55,8:.65};
   const pow=tm=>packs[tm].reduce((s,p)=>s+(p.a.str*.55+p.a.set*.45)*(p.mass/110)*(w[p.num]||.5)*(.75+.25*p.en),0)*(1+M.T[tm].training.set*.012)*(M.T[tm].tactics.scrumPlan==='pression'||(tm===t&&pd.call&&pd.call.push)?1.05:1);
   const pa=pow(t),po=pow(o),diff=(pa-po)/Math.max(1,(pa+po)/2);
   pd.diff=diff+gauss(M)*.07;
   const x=rnd(M);
   const pPen=.17+Math.abs(pd.diff)*.9,pReset=pd.resets<2?.12:.04,pFK=.035,pLost=.04-pd.diff*.15;
   pd.outcome=x<pPen?'pen':x<pPen+pReset?'reset':x<pPen+pReset+pFK?'fk':x<pPen+pReset+pFK+clamp(pLost,.01,.1)?'lost':'clean';
   pd.stage='push';pd.t0=M.t;pd.dur=pd.outcome==='reset'?rr(M,1,1.8):rr(M,1.6,2.8);
   const nine=M.P[M.ball.owner];M.ball.st='scrum';M.ball.owner=-1;M.ball.x=pd.x;M.ball.y=pd.y+(pd.y<35?-1:1)*.2;M.ball.z=.1;RM2.setPose(M,nine,'feed',.4);
   M.st[t].scrums++;
  }
  return;
 }
 if(pd.stage==='push'){
  const el=M.t-pd.t0;
  const v=clamp(pd.diff*3.2,-.9,.9)*(pd.outcome==='reset'?.2:1);
  for(const tm of [0,1])for(const p of packs[tm]){p.x+=d*v*dt;p.pose='scrum'}
  pd.x+=d*v*dt;
  // le ballon recule sous les pieds jusqu'au numéro 8
  if(pd.outcome==='clean'||pd.outcome==='lost'){const rb=(pd.outcome==='lost'?-1:1)*Math.min(1,el/pd.dur);M.ball.x=pd.x-d*rb*2.5;M.ball.y=pd.y}
  else M.ball.x=pd.x;
  if(el<pd.dur)return;
  const pdom=pd.diff>=0?t:o;
  if(pd.outcome==='reset'){pd.resets++;unbindAll(M,.2);pd.stage='setup';pd.layout=null;pd.t=0;RM2.deadTime(M,rr(M,25,40));say(M,t,'scrum','Mêlée écroulée, à refaire',0);return}
  if(pd.outcome==='pen'){unbindAll(M,.3);const off=packs[1-pdom][Math.floor(rnd(M)*packs[1-pdom].length)];if(off){off.s.pen++;M.st[off.team].penC++}
   if(pdom===t)M.st[t].scrumsWon++;
   say(M,pdom,'scrum',`Mêlée dominante de ${nm(M,pdom)} : pénalité !`,1);RM2.awardPenalty(M,pdom,pd.x,pd.y,'mêlée',off?off.i:-1);return}
  if(pd.outcome==='fk'){unbindAll(M,.3);RM2.awardPenalty(M,o,pd.x,pd.y,'introduction',-1,false,true);return}
  if(pd.outcome==='lost'){M.st[t].turnovers++;
   unbindAll(M,.25);M.phase='play';M.pd={t:0};const nine=byNum(M,o,9)||goalKicker(M,o);
   say(M,o,'scrum',`Ballon volé en mêlée par ${nm(M,o)} !`,1);
   RM2.gainPossession(M,nine,'mêlée');M.play=RM2.callPlay(M,o,nine,{x:pd.x,y:pd.y},'scrum');return}
  M.st[t].scrumsWon++;
  if(pd.call&&RM2.scrumFollow){const call=pd.call,at={x:pd.x,y:pd.y};unbindAll(M,.25);M.phase='play';M.pd={t:0};M.live=true;RM2.scrumFollow(M,t,call,at);return}
  unbindAll(M,.25);M.phase='play';M.pd={t:0};M.live=true;
  const plan=M.T[t].tactics.scrumPlan;const eight=byNum(M,t,8);
  let ball=byNum(M,t,9)||goalKicker(M,t);
  if((plan==='huit'||(plan==='auto'&&chance(M,.14)))&&eight){ball=eight;say(M,t,'scrum',`Départ du numéro 8 ${eight.short}`,0)}
  M.T[t].phaseNo=0;RM2.gainPossession(M,ball,'mêlée');
  if(ball.num===9){M.play=RM2.callPlay(M,t,ball,{x:pd.x,y:pd.y},'scrum');M.play.hold=.2}
  else{M.play={team:t,kind:'pod',var:'départ du 8',seq:[ball.i],k:0,cur:ball.i,side:1,aborted:false,t0:M.t,kinds:[]}}
 }
};

/* ---------- Touche ---------- */
function lineoutLayout(M,pd){
 const out=[];const T=pd.team,e=pd.side===0?1:-1,ys=pd.side;
 for(let tm=0;tm<2;tm++){const d=dir(M,T);const off=tm===T?-.5:.5;
  const fw=M.P.filter(p=>p.team===tm&&RM2.active(p)&&p.num<=8&&p.num!==2).sort((a,b)=>((a.num===4||a.num===5)?0:a.num===8?1:2)-((b.num===4||b.num===5)?0:b.num===8?1:2));
  // ordre : pilier, 2e ligne (sauteur avant), pilier, 2e ligne (milieu), 3e ligne, n°8 (fond), 3e ligne
  const order=[fw[3],fw[0],fw[4],fw[1],fw[5],fw[2],fw[6]].filter(Boolean);
  order.forEach((p,k)=>out.push({i:p.i,x:pd.x+d*off,y:ys+e*(5.2+k*1.45),line:true,k}));
  const hk=byNum(M,tm,2);if(hk)out.push({i:hk.i,x:tm===T?pd.x:pd.x+d*2.2,y:tm===T?ys-e*.6:ys+e*2.6});
  const nine=byNum(M,tm,9);if(nine)out.push({i:nine.i,x:pd.x+d*(tm===T?-1.8:1.8),y:ys+e*16.5});
  const dd=tm===T?-1:1;const backs=M.P.filter(p=>p.team===tm&&RM2.active(p)&&p.num>9);
  for(const p of backs){const L={10:[10.5,19],12:[11.5,25],13:[12.2,31],15:[22,34]};
   let pos=L[p.num];if(p.num===11||p.num===14){pos=[11.5,Math.abs(p.y-ys)<35?7:62];out.push({i:p.i,x:pd.x+d*dd*12,y:p.num===11?(e>0?Math.min(ys+e*60,64):Math.max(ys+e*60,6)):clamp(ys+e*40,6,64)});continue}
   if(!pos)pos=[12,28];out.push({i:p.i,x:pd.x+d*dd*pos[0],y:clamp(ys+e*pos[1],2,68)})}
 }
 return out;
}
PH.lineout=function(M,dt){
 const pd=M.pd,T=pd.team,O=1-T,d=dir(M,T),e=pd.side===0?1:-1;M.live=pd.stage!=='setup'&&pd.stage!=='call';
 if(pd.stage==='setup'){
  if(!pd.layout){pd.layout=lineoutLayout(M,pd);pd.ids=pd.layout.map(s=>s.i)}
  for(const s of pd.layout){const p=M.P[s.i];if(!RM2.active(p)||(p.mode==='ground'&&p.until>M.t))continue;if(p.mode!=='run')p.mode='run';RM2.go(p,s.x,s.y,hyp(p.x-s.x,p.y-s.y)>14?.62:.42)}
  const hk=byNum(M,T,2)||M.P.find(p=>p.team===T&&RM2.active(p));M.ball.st='held';M.ball.owner=hk.i;
  if((pd.t>3&&allArrived(M,pd.ids,1.4))||pd.t>20){pd.stage='call';pd.t0=M.t;say(M,T,'lineout',`Touche pour ${nm(M,T)}`,0);if(RM2.setPieceCall)RM2.setPieceCall(M,'lineout',T,pd)}
  return;
 }
 const lineT=pd.layout.filter(s=>s.line&&M.P[s.i].team===T).sort((a,b)=>a.k-b.k),lineO=pd.layout.filter(s=>s.line&&M.P[s.i].team===O).sort((a,b)=>a.k-b.k);
 if(pd.stage==='call'){
  if(M.t-pd.t0<(pd.call&&pd.call.quick?.3:.9))return;
  const tac=M.T[T].tactics;let zone=pd.call&&pd.call.zone?pd.call.zone:tac.lineoutTarget==='auto'?(rnd(M)<.42?'avant':rnd(M)<.6?'milieu':'fond'):({court:'avant',milieu:'milieu',fond:'fond',front:'avant',middle:'milieu',back:'fond'}[tac.lineoutTarget]||'milieu');
  const kIdx={avant:1,milieu:3,fond:5}[zone];
  const jumper=M.P[(lineT[kIdx]||lineT[1]||lineT[0]).i];pd.jumper=jumper.i;pd.zone=zone;
  const lifters=[lineT[kIdx-1],lineT[kIdx+1]].filter(Boolean).map(s=>s.i);pd.lifters=lifters;
  // la défense devine la zone
  const dSet=M.P.filter(p=>p.team===O&&p.num<=8).reduce((s,p)=>s+p.a.set,0)/8,aSet=M.P.filter(p=>p.team===T&&p.num<=8).reduce((s,p)=>s+p.a.set,0)/8;
  const guess=chance(M,clamp(.3+(dSet-aSet)/90+M.T[O].training.set*.01,.15,.5));
  const dk=guess?kIdx:[1,3,5].filter(z=>z!==kIdx)[Math.floor(rnd(M)*2)];
  pd.djump=lineO[dk]?lineO[dk].i:-1;pd.guess=guess;
  const hk=M.P[M.ball.owner];
  const notStraight=chance(M,.022+(70-hk.a.set)*.0008);
  pd.notStraight=notStraight;
  jumper.mode='lift';jumper.liftT=M.t;for(const i of lifters){M.P[i].mode='bound';M.P[i].bind='lift'}
  if(pd.djump>=0){const dj=M.P[pd.djump];dj.mode='lift';dj.liftT=M.t+(guess?.05:.25)}
  const tgt={x:jumper.x,y:jumper.y};
  RM2.launch(M,{x:hk.x,y:hk.y,team:T,i:hk.i},tgt.x,tgt.y+(notStraight?0:0),.72,'throw',{tgt:jumper.i,zEnd:3.05});
  RM2.setPose(M,hk,'throw',.5);
  M.st[T].lineouts++;pd.stage='throw';pd.t0=M.t;M.live=true;
  return;
 }
 if(pd.stage==='throw'){
  const b=M.ball;
  for(const s of [...lineT,...lineO]){const p=M.P[s.i];if(p.mode==='run'){p.vx*=.5;p.vy*=.5;RM2.go(p,p.x,p.y,.3)}}
  for(const i of [pd.jumper,pd.djump]){if(i<0)continue;const p=M.P[i];if(p.mode==='lift'){p.z=clamp((M.t-p.liftT)/.55,0,1)*1.6}}
  if(M.t-b.t0<b.T-.02)return;
  const jumper=M.P[pd.jumper];
  if(pd.notStraight){unbindAll(M,.2);for(const p of M.P)p.z=0;say(M,T,'lineout','Lancer pas droit !',0);RM2.scrum(M,O,X(M,T,clamp(R(M,T,pd.x),5,95)),15+0,null);M.pd.y=pd.side===0?15:55;return}
  let won=true;
  if(pd.djump>=0&&pd.guess){const dj=M.P[pd.djump];
   const pa=jumper.a.aer*.55+jumper.a.set*.45+jumper.h*25,po=dj.a.aer*.55+dj.a.set*.45+dj.h*25;won=chance(M,clamp(.62+(pa-po)/90,.3,.88))}
  else won=chance(M,.975);
  unbindAll(M,.15);for(const p of M.P)p.z=0;
  const winner=won?jumper:(pd.djump>=0?M.P[pd.djump]:M.P.find(p=>p.team===O&&p.num===4));
  if(won)M.st[T].lineoutsWon++;else{M.st[T].turnovers++;say(M,O,'lineout',`Touche volée par ${winner.short} !`,1)}
  M.phase='play';M.pd={t:0};M.live=true;
  RM2.gainPossession(M,winner,'touche');RM2.setPose(M,winner,'catch',.4);
  const team=winner.team,r=R(M,team,winner.x);
  if(won&&pd.call&&RM2.lineoutFollow){RM2.lineoutFollow(M,winner,pd.call,{x:winner.x,y:winner.y,e,side:pd.side});return}
  const tac=M.T[team].tactics;
  const maulWish=won&&(tac.lineoutPlay==='maul'||(tac.lineoutPlay==='auto'&&(r>72?chance(M,.6):chance(M,.18))));
  if(maulWish){RM2.startMaul(M,winner);return}
  const nine=byNum(M,team,9);
  if(nine){M.play={team,kind:'backs',var:'sortie de touche',seq:[winner.i,nine.i],k:0,cur:winner.i,side:e,aborted:false,t0:M.t,hold:.15,kinds:[]};
   const pl2=RM2.callPlay(M,team,nine,{x:winner.x,y:winner.y+e*10},'lineout');M.play.seq.push(...pl2.seq.slice(1));M.play.kickBy=pl2.kickBy;M.play.kt=pl2.kt;M.play.kickDelay=pl2.kickDelay;M.play.var=pl2.var||pl2.kind;M.play.loopP=pl2.loopP;M.play.kinds=[,...pl2.kinds]}
 }
};

/* ---------- Maul ---------- */
RM2.startMaul=function(M,c){
 const t=c.team,d=dir(M,t);
 M.phase='maul';M.pd={t:0,carrier:c.i,v:0,stall:0,att:t,x:c.x,y:c.y,next:0,dur:rr(M,5,9)};
 M.st[t].mauls++;M.live=true;
 const x=rnd(M);M.pd.outcome=x<.09?'pen':x<.16?'held':'normal';
 say(M,t,'maul',`Maul porté de ${nm(M,t)}`,0);
 RM2.holdBall(M,c);c.mode='bound';c.bind='maul';
};
PH.maul=function(M,dt){
 const pd=M.pd,t=pd.att,o=1-t,d=dir(M,t),c=M.P[pd.carrier];M.live=true;
 const atts=M.P.filter(p=>p.team===t&&p.num<=8&&RM2.active(p)&&p!==c&&p.num!==2).slice(0,6);
 const defs=M.P.filter(p=>p.team===o&&p.num<=8&&RM2.active(p)).slice(0,6);
 const slotsA=[[-.9,.5],[-.9,-.5],[-1.8,.9],[-1.8,0],[-1.8,-.9],[-2.7,0]],slotsD=[[.9,.5],[.9,-.5],[1.8,.8],[1.8,-.8],[2.7,0],[1.9,0]];
 const cx=c.x,cy=c.y;
 atts.forEach((p,k)=>{const s=slotsA[k];const tx=cx+d*s[0],ty=cy+s[1];if(p.mode==='bound'){p.x=tx;p.y=ty;p.pose='maul'}else{RM2.go(p,tx,ty,1);if(hyp(p.x-tx,p.y-ty)<.6){p.mode='bound';p.bind='maul';p.hd=d>0?0:Math.PI}}});
 defs.forEach((p,k)=>{const s=slotsD[k];const tx=cx+d*s[0],ty=cy+s[1];if(p.mode==='bound'){p.x=tx;p.y=ty;p.pose='maul'}else{RM2.go(p,tx,ty,1);if(hyp(p.x-tx,p.y-ty)<.6){p.mode='bound';p.bind='maul';p.hd=d>0?Math.PI:0}}});
 // autres joueurs
 if(!M._shapeAt||M.t-M._shapeAt>.4){M._shapeAt=M.t;const ex=new Set([c.i,...atts.map(p=>p.i),...defs.map(p=>p.i)]);
  M._aShape=RM2.attackShape(M,t,cx,cy,ex);M._dShape=RM2.defenseShape(M,o,cx,cy,{exclude:ex,ruck:false,offside:R(M,o,cx)-2.5,released:false})}
 for(const p of M.P){if(!RM2.upright(M,p)||p.mode==='bound'||atts.includes(p)||defs.includes(p))continue;const sl=p.team===t?M._aShape.slots.get(p.i):M._dShape.get(p.i);if(sl)RM2.go(p,sl.x,sl.y,.55)}
 const nine=byNum(M,t,9);if(nine&&RM2.upright(M,nine))RM2.go(nine,cx-d*3.2,cy,.8);
 if(M.t>=pd.next){pd.next=M.t+1;
  const ba=atts.filter(p=>p.mode==='bound'),bd=defs.filter(p=>p.mode==='bound');
  const A=ba.reduce((s,p)=>s+p.mass*(p.a.str*.6+p.a.set*.4)/100*(.7+.3*p.en),0)+c.mass*.6;
  const D=bd.reduce((s,p)=>s+p.mass*(p.a.str*.6+p.a.brk*.4)/100*(.7+.3*p.en),0)+1;
  pd.v=clamp(.25+(A-D)/D*1.4+gauss(M)*.25+M.T[t].training.set*.03,-.3,1.5);
  if(pd.v<.2){pd.stall++}else pd.stall=0;
 }
 if(pd.t>1.2){c.x+=d*pd.v*dt;}
 if(R(M,t,c.x)>=100){unbindAll(M,.3);if(pd.outcome==='held'||chance(M,.25)){say(M,t,'held','Maul tenu dans l’en-but : renvoi de la ligne',1);RM2.dropOut(M,o,'goal');return}c.mode='run';RM2.scoreTry(M,c);return}
 if(pd.outcome==='pen'&&pd.t>2.5){unbindAll(M,.3);const off=defs[0];if(off){off.s.pen++;M.st[o].penC++}
  if(R(M,t,c.x)>95&&chance(M,.45)){say(M,t,'pentry',`Maul écroulé illégalement : essai de pénalité !`,2);if(off)RM2.card(M,off,'maul écroulé');RM2.penaltyTry(M,t);return}
  say(M,t,'maul','Maul écroulé par la défense : pénalité',1);RM2.awardPenalty(M,t,c.x,c.y,'maul écroulé',off?off.i:-1);return}
 if(pd.outcome==='held'&&pd.t>3){unbindAll(M,.3);M.st[t].turnovers++;say(M,o,'maul','Maul bloqué : mêlée pour la défense',1);RM2.scrum(M,o,c.x,c.y,null);return}
 if(pd.stall>=2||pd.t>pd.dur){
  unbindAll(M,.35);M.phase='play';M.pd={t:0};
  if(pd.then&&nine&&RM2.upright(M,nine)&&RM2.maulFollow){RM2.gainPossession(M,nine,'sortie de maul');RM2.maulFollow(M,t,nine,pd.then,{x:c.x,y:c.y})}
  else if(nine&&RM2.upright(M,nine)){RM2.gainPossession(M,nine,'sortie de maul');M.play=RM2.callPlay(M,t,nine,{x:c.x,y:c.y},'maul');M.play.hold=.2}
  else RM2.gainPossession(M,c,'maul');
 }
};

/* ---------- Pénalités & coups francs ---------- */
RM2.awardPenalty=function(M,team,x,y,reason,by=-1,fromAdv=false,free=false){
 M.adv=null;
 if(RM2.stoppage(M,'penalty'))return;
 resetPlayers(M);
 M.st[team].penWon=(M.st[team].penWon||0)+1;
 x=X(M,team,clamp(R(M,team,x),2,97));y=clamp(y,5,65);
 M.phase='penalty';M.live=false;M.pd={t:0,team,x,y,reason,free,stage:'decide'};M.ball.st='dead';M.ball.x=x;M.ball.y=y;M.ball.z=0;M.ball.owner=-1;
 say(M,team,free?'freekick':'penalty',`${free?'Coup franc':'Pénalité'} pour ${nm(M,team)} (${reason})`,free?0:1);
 RM2.deadTime(M,rr(M,5,11));
 // discipline : accumulation de fautes dans ses 22 → carton
 if(!free&&by>=0){const off=M.P[by];const r=R(M,1-team,x);
  M.T[1-team].pen22=(M.T[1-team].pen22||0)+(r<25?1:0);
  if(r<12&&chance(M,.08))RM2.card(M,off,'faute volontaire près de la ligne');
  else if(M.T[1-team].pen22>=4&&chance(M,.35)){RM2.card(M,off,'fautes répétées');M.T[1-team].pen22=0}}
 const c=byNum(M,team,9)||goalKicker(M,team);
 // les manageurs humains choisissent l'option
 if(team===M.userTeam&&!M.auto){M.pending={type:'penalty',team,x,y,free,reason,options:RM2.penaltyOptions(M,team,x,y,free),suggest:RM2.aiPenalty(M,team,x,y,free)};}
};
RM2.goalChance=function(M,team,x,y,kicker){
 const goalX=X(M,team,100),dx=Math.abs(goalX-x),dy=Math.abs(y-35);
 const d=hyp(dx,dy),phi=Math.atan2(dy,dx);
 const theta=Math.atan(2.8*Math.cos(phi)/Math.max(1,d))*180/Math.PI;
 const k=kicker?kicker.a.kck:75;
 const sig=3.1+(90-k)*.075;
 const erf=z=>{const t=1/(1+.3275911*Math.abs(z));const y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-z*z);return z>=0?y:-y};
 const range=44+k*.13;
 const pd=1/(1+Math.exp(-(range-d)/3.6));
 return clamp(erf(theta/(sig*Math.SQRT2))*pd,0,.99);
};
RM2.penaltyOptions=function(M,team,x,y,free){
 const r=R(M,team,x);const k=goalKicker(M,team);
 const opts=[];
 if(!free)opts.push({id:'posts',label:'Tenter les 3 points',p:RM2.goalChance(M,team,x,y,k)});
 opts.push({id:'touch',label:free?'Dégager en touche':'Pénaltouche (touche conservée)'});
 opts.push({id:'scrum',label:'Choisir la mêlée'});
 opts.push({id:'tap',label:'Jouer vite à la main'});
 return opts;
};
RM2.aiPenalty=function(M,team,x,y,free){
 const tac=M.T[team].tactics,r=R(M,team,x),left=2*RM2.HALF-M.clock,diff=M.score[team]-M.score[1-team];
 const pg=free?0:RM2.goalChance(M,team,x,y,goalKicker(M,team));
 if(!free&&tac.penalty==='posts'&&pg>.3)return 'posts';
 if(tac.penalty==='touch'&&r>35)return 'touch';
 if(tac.penalty==='scrum'&&r>70)return 'scrum';
 if(!free&&left<180&&diff<0&&diff>=-3&&pg>.25)return 'posts';
 if(left<300&&diff<-3&&r>55)return r>92&&chance(M,.4)?'scrum':'touch';
 if(left<60&&diff>0)return 'touch';
 if(!free&&pg>.72&&chance(M,.82))return 'posts';
 if(!free&&pg>.5&&r<70&&chance(M,.55))return 'posts';
 if(r>93&&chance(M,.25))return 'scrum';
 if(chance(M,.05+tac.tempo*.08))return 'tap';
 if(free&&r<40)return 'touch';
 return 'touch';
};
RM2.autoDecide=function(M){if(!M.pending)return;const p=M.pending;RM2.penaltyChoice(M,p.suggest||'touch')};
RM2.penaltyChoice=function(M,option){
 if(M.phase!=='penalty')return false;
 M.pending=null;M.pd.choice=option;M.pd.stage='exec';M.pd.t=0;
 const t=M.pd.team;
 say(M,t,'choice',({posts:'Le capitaine montre les poteaux',touch:'Le buteur va chercher la touche',scrum:'Le capitaine choisit la mêlée',tap:'Pénalité jouée rapidement à la main'})[option]||option,0);
 if(option==='posts'){RM2.goalKick(M,t,M.pd.x,M.pd.y,'pen');return true}
 if(option==='scrum'){RM2.scrum(M,t,M.pd.x,M.pd.y,null);return true}
 return true;
};
PH.penalty=function(M,dt){
 const pd=M.pd,t=pd.team,o=1-t,d=dir(M,t);M.live=false;
 // tout le monde se replace ; la défense recule de 10 m
 const k=pd.kicker!=null?M.P[pd.kicker]:(byNum(M,t,pd.choice==='tap'?8:10)||goalKicker(M,t));pd.kicker=k.i;
 for(const p of M.P){if(!RM2.upright(M,p))continue;if(M.t<p.think)continue;p.think=M.t+.4;
  if(p===k){RM2.go(p,pd.x-d*.4,pd.y,.6);continue}
  const rr0=R(M,p.team,p.x);
  if(p.team===o){const lim=R(M,o,pd.x)-10.5;RM2.go(p,X(M,o,Math.min(rr0,lim)),p.y+(p.y<pd.y?-0:0),.5)}
  else{RM2.go(p,X(M,t,Math.min(rr0,R(M,t,pd.x)-1)),p.y,.35)}
 }
 if(pd.stage==='decide'){
  if(M.pending)return;
  if(pd.t>1.4){const ch=RM2.aiPenalty(M,t,pd.x,pd.y,pd.free);RM2.penaltyChoice(M,ch)}
  return;
 }
 if(pd.choice==='touch'&&pd.t>2.4&&hyp(k.x-(pd.x-d*.4),k.y-pd.y)<1.5){
  const r0=R(M,t,pd.x),side=pd.y<35?0:70;
  const dist=clamp(22+k.a.kck*.16+rr(M,-5,5),14,42);
  const lr=Math.min(r0+dist,95);
  const miss=chance(M,clamp(.03+(75-k.a.kck)*.003,.01,.12));
  const ly=miss?(side===0?rr(M,3,8):70-rr(M,3,8)):(side===0?-3:73);
  RM2.launch(M,{x:pd.x,y:pd.y,team:t,i:k.i},X(M,t,lr),ly,2.4,'kick',{kt:'touche'});
  M.ball.penTouch=!pd.free;M.ball.kickX=pd.x;M.st[t].kicks++;RM2.setPose(M,k,'kick',.5);
  if(pd.free)M.ball.penTouch=false;
  M.phase='play';M.pd={t:0};M.live=true;M.poss=t;
  for(const p of M.P)p.onside=true;
  return;
 }
 if(pd.choice==='tap'&&pd.t>1.6){
  M.phase='play';M.pd={t:0};M.live=true;RM2.gainPossession(M,k,'pénalité jouée vite');RM2.setPose(M,k,'pickup',.3);
  M.play={team:t,kind:'pod',var:'pénalité jouée vite',seq:[k.i],k:0,cur:k.i,side:1,aborted:false,t0:M.t,kinds:[]};
 }
};
RM2.penaltyTry=function(M,t){
 M.score[t]+=7;M.tries[t]++;M.st[t].tries++;M.st[t].pts+=7;
 say(M,t,'try',`ESSAI DE PÉNALITÉ pour ${nm(M,t)} (7 points)`,2);
 resetPlayers(M);RM2.deadTime(M,rr(M,40,60));
 if(RM2.stoppage(M,'kickoff'))return;
 M.phase='kickoff';M.pd={t:0,stage:'setup',team:1-t,kind:'centre'};
};

/* ---------- Coups de pied au but ---------- */
RM2.goalKick=function(M,t,x,y,kind){
 resetPlayers(M);
 const k=goalKicker(M,t);
 M.phase='goalkick';M.live=false;M.pd={t:0,team:t,x,y,kind,kicker:k.i,stage:'walk'};
 M.ball.st='dead';M.ball.x=x;M.ball.y=y;M.ball.z=0;
 RM2.deadTime(M,kind==='conv'?rr(M,24,40):rr(M,26,42));
};
PH.goalkick=function(M,dt){
 const pd=M.pd,t=pd.team,o=1-t,d=dir(M,t),k=M.P[pd.kicker];M.live=false;
 const goalX=X(M,t,100);
 for(const p of M.P){if(!RM2.upright(M,p)||p===k)continue;if(M.t<p.think)continue;p.think=M.t+.5;
  if(p.team===o&&pd.kind==='conv'){RM2.go(p,goalX+d*rr(M,1,3),clamp(35+(p.num-8)*1.4,22,48),.4)}
  else{const rr0=R(M,p.team,p.x);RM2.go(p,p.x-dir(M,p.team)*(p.team===t?1:0),clamp(p.y,3,67),.25)}}
 if(pd.stage==='walk'){RM2.go(k,pd.x-d*.5,pd.y,.5);if(hyp(k.x-(pd.x-d*.5),k.y-pd.y)<.8&&pd.t>2){pd.stage='place';pd.t0=M.t;RM2.setPose(M,k,'place',1.2)}return}
 if(pd.stage==='place'){RM2.go(k,pd.x-d*4.5,pd.y-1.8,.25);if(M.t-pd.t0>2.2){pd.stage='run';pd.t0=M.t}return}
 if(pd.stage==='run'){RM2.go(k,pd.x-d*.4,pd.y-.2,.55);
  if(hyp(k.x-pd.x,k.y-pd.y)<.9||M.t-pd.t0>2.5){
   const p=RM2.goalChance(M,t,pd.x,pd.y,k);
   const ok=chance(M,p);pd.ok=ok;
   const miss=(rnd(M)<.5?-1:1)*rr(M,3.4,6.5);
   const aimY=ok?35+gauss(M)*1.1:35+miss;
   const dist=Math.abs(goalX-pd.x);const T=clamp(dist/21+.55,1,2.8);
   RM2.launch(M,{x:pd.x,y:pd.y,team:t,i:k.i},goalX+d*.1,clamp(aimY,30.5,39.5)*(ok?1:0)+(ok?0:clamp(aimY,24,46)),T,'goal',{zEnd:ok?rr(M,4.5,9):(dist>40&&chance(M,.4)?1.6:rr(M,4,8))});
   M.ball.goalT=t;M.ball.gk=pd.kind;RM2.setPose(M,k,'kick',.6);pd.stage='flight';pd.t0=M.t;
   if(pd.kind==='conv')M.st[t].convA++;else M.st[t].penA++;
  }
  return;
 }
 if(pd.stage==='flight'){
  const b=M.ball;
  if(M.t-b.t0>=b.T){
   const inPosts=Math.abs(b.y-35)<2.8&&b.z>3;const ok=pd.ok&&inPosts||(!pd.ok&&false);
   pd.stage='done';
   if(pd.ok){M.score[t]+=pd.kind==='conv'?2:3;M.st[t].pts+=pd.kind==='conv'?2:3;k.s.pts+=pd.kind==='conv'?2:3;
    if(pd.kind==='conv')M.st[t].conv++;else M.st[t].pen++;
    say(M,t,pd.kind==='conv'?'conv':'pengoal',pd.kind==='conv'?`Transformation réussie par ${k.short}`:`Pénalité réussie par ${k.short} : 3 points !`,pd.kind==='conv'?1:2)}
   else say(M,t,'miss',pd.kind==='conv'?`Transformation manquée par ${k.short}`:`Pénalité manquée par ${k.short}`,1);
   b.st='dead';
   if(pd.kind==='pen'&&!pd.ok){RM2.dropOut(M,o,'22');return}
   if(RM2.stoppage(M,'kickoff'))return;
   RM2.deadTime(M,rr(M,10,20));
   M.phase='kickoff';M.pd={t:0,stage:'setup',team:o,kind:'centre'};resetPlayers(M);
  }
 }
};
function goalFlight(M){}
RM2.dropGoal=function(M,c){
 const t=c.team,p=RM2.goalChance(M,t,c.x,c.y,c)*.72;const ok=chance(M,p);
 const goalX=X(M,t,100),d=dir(M,t);const dist=Math.abs(goalX-c.x);
 RM2.launch(M,c,goalX+d*.1,ok?35+gauss(M):35+(rnd(M)<.5?-1:1)*rr(M,3.5,7),clamp(dist/20+.5,1,2.6),'goal',{zEnd:ok?rr(M,4,8):rr(M,2,6)});
 M.st[t].dropA++;M.st[t].kicks++;RM2.setPose(M,c,'kick',.5);
 M.phase='dropflight';M.pd={t:0,team:t,ok,kicker:c.i};M.live=true;M.play=null;
 say(M,t,'drop',`${c.short} tente le drop…`,1);
};
PH.dropflight=function(M,dt){
 const pd=M.pd,b=M.ball;M.live=true;
 for(const p of M.P){if(!RM2.upright(M,p))continue;if(M.t>=p.think){p.think=M.t+.3;RM2.go(p,p.x+(b.x-p.x)*.2,p.y+(b.y-p.y)*.15,.5)}}
 if(M.t-b.t0>=b.T){const t=pd.team,k=M.P[pd.kicker];
  if(pd.ok){M.score[t]+=3;M.st[t].pts+=3;M.st[t].drop++;k.s.pts+=3;say(M,t,'dropgoal',`DROP RÉUSSI par ${k.short} !`,2);
   resetPlayers(M);RM2.deadTime(M,rr(M,20,35));if(RM2.stoppage(M,'kickoff'))return;M.phase='kickoff';M.pd={t:0,stage:'setup',team:1-t,kind:'centre'}}
  else{say(M,t,'miss','Drop manqué',1);RM2.dropOut(M,1-t,'22')}
 }
};

/* ---------- Essai ---------- */
RM2.scoreTry=function(M,p){
 const t=p.team;M.adv=null;
 M.score[t]+=5;M.tries[t]++;M.st[t].tries++;M.st[t].pts+=5;p.s.tr++;p.s.pts+=5;
 metresGained(M,p);
 RM2.setPose(M,p,'ground',1.5);p.mode='ground';p.until=M.t+1.6;
 say(M,t,'try',`ESSAI de ${p.name} pour ${M.T[t].name} !`,2);
 M.live=false;M.tk=null;M.ruck=null;M.play=null;
 const gx=X(M,t,100);
 const bx0=M.ball.x;M.ball.st='dead';M.ball.owner=-1;M.ball.x=clamp(Math.abs(bx0-p.x)<2.5?bx0:p.x,Math.min(gx,gx+dir(M,t)*9.5),Math.max(gx,gx+dir(M,t)*9.5));M.ball.y=p.y;M.ball.z=0;
 M.phase='try';M.pd={t:0,team:t,y:clamp(p.y,1,69),scorer:p.i};
 RM2.deadTime(M,rr(M,18,32));
 for(const q of M.P)if(q.mode==='bound'||q.mode==='contact'){q.mode='run'}
};
PH.try=function(M,dt){
 const pd=M.pd,t=pd.team;M.live=false;
 for(const p of M.P){if(!RM2.upright(M,p))continue;if(M.t<p.think)continue;p.think=M.t+.6;
  if(p.team===t){const s=M.P[pd.scorer];RM2.go(p,s.x+(p.x-s.x)*.6,s.y+(p.y-s.y)*.6,.4)}else RM2.go(p,p.x,p.y,.1)}
 if(pd.t>3.2){
  // transformation dans l'axe de l'aplatissement
  const off=Math.abs(pd.y-35);const back=clamp(10+off*.55,10,30);
  RM2.goalKick(M,t,X(M,t,100-back),pd.y,'conv');
 }
};
PH.half=function(M,dt){
 if(M.pd.t<2.5)return;
 M.half=2;M.clock=RM2.HALF;M.deadBudget=0;
 for(const p of M.P){p.mode=p.mode==='bin'?'bin':RM2.active(p)?'run':p.mode;p.z=0}
 RM2.subsCheck(M,true);
 RM2.setupKickoff(M,1-M.kickoffFirst,true);
 say(M,1-M.kickoffFirst,'info','Reprise de la seconde période',1);
};
PH.end=function(){};

/* =========================================================
 *  Cartons, blessures, remplacements
 * ========================================================= */
RM2.card=function(M,p,why){
 if(!p||p.mode==='bin'||p.mode==='off')return;
 p.yc++;M.st[p.team].yc++;
 say(M,p.team,'card',`Carton jaune pour ${p.name} (${why}) — 10 minutes`,2);
 p.mode='bin';p.binUntil=M.clock+600;p.binReady=false;p.x=p.tx=50;p.y=p.ty=-4;
 if(M.ball.owner===p.i){M.ball.st='ground'}
};
RM2.injure=function(M,p){
 if(!p||p.injured)return;p.injured=true;p.en=Math.min(p.en,.55);M.injuries=M.injuries||[];M.injuries.push({id:p.id,team:p.team,name:p.name,clock:Math.round(M.clock)});
 say(M,p.team,'injury',`${p.name} est touché et devra sortir`,1);
};
function subsCheck(M,half){
 const minute=M.clock/60;
 for(let t=0;t<2;t++){
  // retour des joueurs exclus temporairement
  for(const p of M.P)if(p.team===t&&p.mode==='bin'&&M.clock>=p.binUntil){p.mode='run';p.x=50;p.y=-1.5;p.tx=50;p.ty=3;p.px=p.x;p.py=p.y;p.enterAt=M.t;say(M,t,'info',`${p.short} revient sur le terrain`,0)}
  const manual=t===M.userTeam&&!M.auto&&M.T[t].tactics.subs==='manual';
  const injured=M.P.filter(p=>p.team===t&&p.injured&&RM2.active(p));
  for(const p of injured)RM2.autoSub(M,t,p,'blessure');
  if(manual)continue;
  if(minute<46)continue;
  const cand=M.P.filter(p=>p.team===t&&RM2.active(p)&&!p.subbedIn);
  for(const p of cand){
   const front=p.num<=3,fw=p.num<=8;
   const due=front?minute>48+(p.num===2?4:0)+(hash2(p.id)%8):fw?minute>54+(hash2(p.id)%10):p.num===9||p.num===10||p.num>=12?minute>60+(hash2(p.id)%12):99;
   if(due&&(p.en<.82||minute>66)&&M.subsMade[t]<8)RM2.autoSub(M,t,p,'tactique');
  }
 }
}
const hash2=s=>RM2.hash(s);
RM2.subsCheck=subsCheck;
RM2.autoSub=function(M,t,p,why){
 const groups={1:['PR'],3:['PR'],2:['HO'],4:['LO'],5:['LO'],6:['BR','LO'],7:['BR'],8:['BR'],9:['SH'],10:['FH','CE'],11:['WI','FB','CE'],12:['CE','FH'],13:['CE'],14:['WI','FB'],15:['FB','WI']};
 const want=groups[p.num]||[];
 const bench=M.bench[t];let k=bench.findIndex(b=>!b.used&&want.includes(b.src.position));
 if(k<0&&why==='blessure')k=bench.findIndex(b=>!b.used&&(p.num<=8?['PR','HO','LO','BR'].includes(b.src.position):!['PR','HO','LO','BR'].includes(b.src.position)));
 if(k<0)return false;
 return RM2.substitute(M,t,p.i,k,why);
};
RM2.substitute=function(M,t,idx,benchIdx,why='tactique'){
 const p=M.P[idx],b=M.bench[t][benchIdx];
 if(!p||!b||b.used||p.team!==t||p.mode==='bin')return false;
 b.used=true;M.subsMade[t]++;
 const out={...p,s:{...p.s},mode:'off'};out.s.min=Math.round(out.on/60);M.gone.push(out);
 const np=Object.assign(p,{});
 const src=b.src;const role=RM2.ROLE[p.num];
 const overall=Math.max(35,Math.min(97,Number(src.skill)||68));
 np.id=String(src.id);np.name=src.name;np.short=src.name.split(' ').slice(1).join(' ')||src.name;np.pos=src.position;np.ovr=overall;
 {const raw=Object.assign(RM2.deriveAttrs(np.id,overall,role),src.attrs||{});np.a={};for(const k in raw)np.a[k]=Math.round(74+(raw[k]-74)*.55)}np.en=src.condition==null?1:src.condition;np.injured=false;np.yc=0;np.on=0;np.subbedIn=true;
 np.s={min:0,tk:0,mt:0,car:0,m:0,pa:0,br:0,to:0,pts:0,tr:0,pen:0,off:0,kk:0};
 np.skin=RM2.hash(np.id+'skin')%5;np.hair=RM2.hash(np.id+'hair')%6;
 // l'entrant arrive par la ligne de touche, le sortant quitte le terrain
 out.x=p.x;out.y=p.y;out.leaving=true;
 np.x=50;np.y=-1.2;np.px=np.x;np.py=np.y;np.vx=np.vy=0;np.mode='run';np.enterAt=M.t;np.tx=50;np.ty=4;
 say(M,t,'sub',`Remplacement ${M.T[t].short} : ${np.name} remplace ${out.name}${why==='blessure'?' (blessé)':''}`,0);
 return true;
};
})(typeof window!=='undefined'?window:globalThis);
