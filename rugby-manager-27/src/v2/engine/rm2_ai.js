/* Rugby Manager 27 — V2.0 · Intelligence collective (jeu courant)
 * Attaque : structure en cellules (1-3-3-1 / 2-4-2), annonces du 9 et du 10, lecture des espaces par le porteur.
 * Défense : ligne coordonnée (marquage dans l'ordre, épaule intérieure), gardes de ruck, couverture du fond,
 * choix du plaqueur par temps d'interception, plaquage à deux, montée selon la consigne (inversée, glissée, attentiste).
 */
'use strict';
(function(root){
const RM2=root.RM2;
const {clamp,hyp}=RM2.util;
const {rnd,rr,chance,gauss,dir,R,X,say}=RM2;

/* ===================== Structure offensive ===================== */
function sideOf(M,t,ay){const pl=M.play&&M.play.team===t?M.play:null;if(pl&&pl.side)return pl.side;return ay<35?1:-1}
function attackSlots(M,t,ax,ay,side){
 const tac=M.T[t].tactics,s=side,openW=s>0?70-ay:ay,shortW=70-openW,k=.8+.45*tac.width;
 const F=[],B={};
 const two=tac.shape==='2-4-2';
 const shortOK=shortW>9;
 if(two){
  if(shortOK){F.push([-Math.min(shortW-4,9),2.5],[-Math.min(shortW-4,9)+2.2,3.6])}else{F.push([3,4],[4.5,5])}
  F.push([5.5,2.5],[7.2,3.8],[11.5,2.8],[13.2,4]);
  F.push([Math.min(openW-5,22*k),2.6],[Math.min(openW-5,22*k)-2.2,3.8]);
 }else{
  F.push(shortOK?[-Math.min(shortW-4,8),2.8]:[2.5,4.5]);
  F.push([5,2.4],[3.6,3.8],[6.6,3.9]);
  F.push([12.5,2.6],[11,3.9],[14,4]);
  F.push([Math.min(openW-5,23*k),2.7]);
 }
 B[10]=[Math.min(openW-4,8.5*k),7];B[12]=[Math.min(openW-3,13.5*k),8.2];B[13]=[Math.min(openW-2.5,19.5*k),9.2];
 B.WO=[Math.max(4,openW-3.5),6.5];B[15]=[Math.min(openW*.62,17*k),12.5];
 B.WS=shortW>13?[-(shortW-3.5),5.5]:[-shortW*.4+openW*.1,22];
 B[9]=[0,1.2];
 return {F,B,openW,shortW};
}
function toWorld(M,t,ax,ay,s,l,dep){return {x:X(M,t,R(M,t,ax)-dep),y:clamp(ay+s*l,1.5,68.5)}}
function assignGreedy(players,slots){
 const res=new Map(),used=new Set(),free=new Set(players.map(p=>p.i));
 const pairs=[];for(const p of players)for(let k=0;k<slots.length;k++)pairs.push([hyp(p.x-slots[k].x,p.y-slots[k].y),p.i,k]);
 pairs.sort((a,b)=>a[0]-b[0]);
 for(const [d,i,k] of pairs){if(!free.has(i)||used.has(k))continue;res.set(i,slots[k]);free.delete(i);used.add(k)}
 return res;
}
RM2.attackShape=function(M,t,ax,ay,exclude){
 const s=sideOf(M,t,ay);const sl=attackSlots(M,t,ax,ay,s);const out=new Map();
 const mates=M.P.filter(p=>p.team===t&&RM2.active(p)&&!exclude.has(p.i));
 const fw=mates.filter(p=>p.num<=8);
 const fSlots=sl.F.map(([l,dep])=>toWorld(M,t,ax,ay,s,l,dep));
 for(const [i,pt] of assignGreedy(fw,fSlots))out.set(i,{...pt,task:'cellule'});
 const wings=mates.filter(p=>p.num===11||p.num===14);
 const wo=toWorld(M,t,ax,ay,s,...sl.B.WO),ws=toWorld(M,t,ax,ay,s,...sl.B.WS);
 if(wings.length===2){const [a,b]=wings;const ab=hyp(a.x-wo.x,a.y-wo.y)+hyp(b.x-ws.x,b.y-ws.y),ba=hyp(b.x-wo.x,b.y-wo.y)+hyp(a.x-ws.x,a.y-ws.y);
  out.set((ab<=ba?a:b).i,{...wo,task:'ailier côté ouvert'});out.set((ab<=ba?b:a).i,{...ws,task:sl.shortW>13?'ailier côté fermé':'couverture'})}
 else if(wings.length===1)out.set(wings[0].i,{...wo,task:'ailier'});
 for(const n of [9,10,12,13,15]){const p=mates.find(q=>q.num===n);if(p&&!out.has(p.i))out.set(p.i,{...toWorld(M,t,ax,ay,s,...sl.B[n]),task:n===15?'arrière':n===10?'ouvreur':'trois-quarts'})}
 // joueurs restants (remplacements hors poste) : cellule la plus proche
 for(const p of mates)if(!out.has(p.i))out.set(p.i,{...toWorld(M,t,ax,ay,s,8,5),task:'soutien'});
 return {slots:out,side:s,openW:sl.openW,shortW:sl.shortW};
};

/* ===================== Structure défensive ===================== */
function matchOrdered(defs,atts){
 // appariement préservant l'ordre latéral (programmation dynamique, coût = écart latéral)
 const n=defs.length,m=atts.length;if(!n||!m)return new Map();
 const INF=1e9,dp=Array.from({length:n+1},()=>new Array(m+1).fill(INF)),ch=Array.from({length:n+1},()=>new Array(m+1).fill(0));
 for(let j=0;j<=m;j++)dp[0][j]=0;
 for(let i=1;i<=n;i++)for(let j=0;j<=m;j++){
  let best=dp[i-1][j]+4,c=0; // défenseur non apparié = surnuméraire
  if(j>0&&dp[i][j-1]<best){best=dp[i][j-1];c=1}// attaquant non couvert
  if(j>0&&dp[i-1][j-1]+Math.abs(defs[i-1].y-atts[j-1].y)*.6<best){best=dp[i-1][j-1]+Math.abs(defs[i-1].y-atts[j-1].y)*.6;c=2}
  dp[i][j]=best;ch[i][j]=c;
 }
 const res=new Map();let i=n,j=m;
 while(i>0&&j>=0){const c=ch[i][j];if(c===2){res.set(defs[i-1].i,atts[j-1]);i--;j--}else if(c===1){j--}else i--;if(j<0)break}
 return res;
}
RM2.defenseShape=function(M,t,ax,ay,info){
 const o=1-t,out=new Map();
 const defs=M.P.filter(p=>p.team===t&&RM2.active(p)&&!info.exclude.has(p.i));
 const atts=M.P.filter(p=>p.team===o&&RM2.active(p)&&p.mode!=='bound'&&p.mode!=='ground'&&!info.attExclude?.has(p.i));
 const tac=M.T[t].tactics;
 const rBall=R(M,t,ax);// repère défensif : ma ligne d'essai = 0
 const offside=info.offside!=null?info.offside:null;
 const attR=R(M,o,ax);
 // 1) couverture du fond : arrière + ailier pendule
 const kickThreat=clamp((60-attR)/40,0,1)*(.6+M.T[o].tactics.kicking*.6);
 const fb=defs.find(p=>p.num===15);const used=new Set();
 if(fb){const depth=14+kickThreat*16;const y=clamp(ay*.45+35*.55,8,62);out.set(fb.i,{x:X(M,t,clamp(rBall-depth,2,99)),y,urg:.62,task:'couverture du fond'});used.add(fb.i)}
 const wingsD=defs.filter(p=>p.num===11||p.num===14);
 if(kickThreat>.35&&wingsD.length===2){const far=wingsD.sort((a,b)=>Math.abs(b.y-ay)-Math.abs(a.y-ay))[0];
  out.set(far.i,{x:X(M,t,clamp(rBall-10-kickThreat*10,2,99)),y:clamp(far.y+(35-far.y)*.25,4,66),urg:.55,task:'pendule'});used.add(far.i)}
 // 2) gardes du ruck
 const nG=info.ruck?2:0;
 if(nG){const cand=defs.filter(p=>!used.has(p.i)).sort((a,b)=>(hyp(a.x-ax,a.y-ay)+(a.num>8?4:0))-(hyp(b.x-ax,b.y-ay)+(b.num>8?4:0)));
  const sides=[1,-1];for(let k=0;k<Math.min(nG,cand.length);k++){const p=cand[k];const lat=(k===0?1.6:-1.6);
   const rr0=offside!=null?offside-.6:rBall-1.5;out.set(p.i,{x:X(M,t,rr0),y:clamp(ay+lat*(ay<35?1:-1),1,69),urg:.85,task:'garde du ruck',guard:true});used.add(p.i)}}
 // 3) ligne : marquage ordonné
 const line=defs.filter(p=>!used.has(p.i));
 const attLine=atts.filter(a=>!info.carrierIdx||a.i!==info.carrierIdx).filter(a=>R(M,o,a.x)>attR-26&&R(M,o,a.x)<attR+8);
 const sortedD=[...line].sort((a,b)=>a.y-b.y),sortedA=[...attLine].sort((a,b)=>a.y-b.y);
 const pairs=matchOrdered(sortedD,sortedA);
 const lineSpeed=tac.lineSpeed,drift=tac.drift;
 const released=info.released;
 const gap=released?(2.0+(1-lineSpeed)*3.2):2.2;
 for(const p of line){
  const a=pairs.get(p.i);let tx,ty,urg;
  if(a){
   const ra=R(M,t,a.x);// position attaquant dans mon repère
   let rt=ra-gap;
   if(!released&&offside!=null)rt=Math.min(rt,offside-.8);
   if(offside!=null&&!released)rt=Math.min(rt,offside-.6);
   rt=Math.max(rt,Math.min(ra-1,rBall-30));
   const inside=Math.sign(ay-a.y)||1;
   ty=a.y+inside*(.9-drift*.5);
   if(released&&Math.abs(a.y-ay)>8)ty+=-inside*drift*1.2;// glissée vers l'extérieur
   tx=X(M,t,clamp(rt,-2,102));
   urg=released?.5+lineSpeed*.48:.5;
   out.set(p.i,{x:tx,y:clamp(ty,.8,69.2),urg,task:'ligne',mark:a.i});
  }else{
   // surnuméraire : se place dans l'intervalle le plus large de la ligne
   const ys=[0,...sortedD.filter(q=>q!==p&&pairs.has(q.i)).map(q=>pairs.get(q.i).y),70].sort((a,b)=>a-b);
   let best=35,bw=-1;for(let k=0;k<ys.length-1;k++){const w=ys[k+1]-ys[k];if(w>bw){bw=w;best=(ys[k]+ys[k+1])/2}}
   let rt=offside!=null&&!released?offside-1.2:rBall-3-(1-lineSpeed)*2;
   out.set(p.i,{x:X(M,t,clamp(rt,-2,102)),y:best,urg:.55,task:'ligne'});
  }
 }
 return out;
};

/* ===================== Choix du plaqueur ===================== */
function interceptTime(d,c){
 let t=hyp(c.x-d.x,c.y-d.y)/Math.max(3,d.vmax*.92);
 for(let k=0;k<2;k++){const px=c.x+c.vx*t*.85,py=c.y+c.vy*t*.85;t=hyp(px-d.x,py-d.y)/Math.max(3,d.vmax*.92)+d.react*.5}
 return t;
}
RM2.pickTacklers=function(M,c){
 const t=1-c.team;const cr=R(M,t,c.x);
 const list=M.P.filter(p=>p.team===t&&RM2.upright(M,p)&&!(M.ruck&&M.ruck.bound&&M.ruck.bound.includes(p.i)))
  .map(p=>{const pr=R(M,t,p.x);const behind=pr>cr+1.5?1:0;return {p,ti:interceptTime(p,c)+behind*.8}})
  .sort((a,b)=>a.ti-b.ti);
 const res=[];if(list[0])res.push(list[0]);if(list[1]&&list[1].ti<list[0].ti+.55&&hyp(list[1].p.x-c.x,list[1].p.y-c.y)<7)res.push(list[1]);
 return res;
};

/* ===================== Passes ===================== */
RM2.passBall=function(M,c,r,kind='passe'){
 const b=M.ball;const d=hyp(r.x-c.x,r.y-c.y);
 const vp=11.5+c.a.pas*.05;let T=clamp(d/vp,.22,1.25);
 let tx=r.x+r.vx*T*.9,ty=r.y+r.vy*T*.9;
 // la passe ne doit jamais être en avant : on vise au plus à hauteur du passeur
 const cr=R(M,c.team,c.x),trr=R(M,c.team,tx);if(trr>cr-.3)tx=X(M,c.team,cr-.3-Math.max(0,(trr-cr))*.15);
 const press=M.P.some(p=>p.team!==c.team&&RM2.upright(M,p)&&hyp(p.x-c.x,p.y-c.y)<2.2);
 const sig=d*.03*(1.35-c.a.pas/100)*(press?1.5:1)*(kind==='sautée'?1.25:1)*(1+(M.weather?.rain||0)*.3);
 const ex=gauss(M)*sig,ey=gauss(M)*sig;
 tx+=ex;ty+=ey;
 RM2.launch(M,c,tx,clamp(ty,-1,71),T,'pass',{tgt:r.i,quality:clamp(1-hyp(ex,ey)/1.6,0,1)});
 b.passer=c.i;b.passKind=kind;
 r.tx=tx;r.ty=ty;r.urg=.95;
 M.st[c.team].passes++;c.s.pa++;
 b.forwardPass=kind!=='offload'&&chance(M,.007+(70-c.a.pas)*.0002);
 RM2.setPose(M,c,'pass',.38);
 M.lastPassAt=M.t;
 return true;
};
/* Offload dans le contact */
RM2.offload=function(M,c){
 const sup=M.P.filter(p=>p.team===c.team&&RM2.upright(M,p)&&p.i!==c.i&&hyp(p.x-c.x,p.y-c.y)<4.5&&R(M,c.team,p.x)<=R(M,c.team,c.x)+.5)
  .sort((a,b)=>hyp(a.x-c.x,a.y-c.y)-hyp(b.x-c.x,b.y-c.y))[0];
 if(!sup)return false;
 RM2.passBall(M,c,sup,'offload');M.st[c.team].offloads++;return true;
};

/* ===================== Lecture du porteur ===================== */
function defendersAhead(M,c,rangeR=12,lat=6){
 const t=c.team,cr=R(M,t,c.x);
 return M.P.filter(p=>p.team!==t&&RM2.upright(M,p)&&R(M,t,p.x)>cr-1&&R(M,t,p.x)<cr+rangeR&&Math.abs(p.y-c.y)<lat);
}
RM2.defendersAhead=defendersAhead;
function bestRunningLine(M,c){
 const t=c.team,cr=R(M,t,c.x);const fw=c.num<=8;
 const defs=M.P.filter(p=>p.team!==t&&RM2.upright(M,p)&&R(M,t,p.x)>cr-2&&R(M,t,p.x)<cr+16);
 let best=c.y,bs=-1e9;
 for(let k=-5;k<=5;k++){const y=clamp(c.y+k*1.6,1.2,68.8);
  const ax=X(M,t,cr+5),ay=y;
  let m=99;for(const d of defs){const dd=hyp(d.x+d.vx*.4-ax,d.y+d.vy*.4-ay);if(dd<m)m=dd}
  const sc=Math.min(m,9)-Math.abs(k)*(fw?.7:.28)-(y<3||y>67?3:0);
  if(sc>bs){bs=sc;best=y}
 }
 return {y:best,space:bs};
}
function supportOptions(M,c){
 const t=c.team,cr=R(M,t,c.x);
 return M.P.filter(p=>p.team===t&&p.i!==c.i&&RM2.upright(M,p)).map(p=>{
  const pr=R(M,t,p.x),d=hyp(p.x-c.x,p.y-c.y);
  if(pr>cr+.2||d<1.8||d>16)return null;
  let m=99;for(const q of M.P)if(q.team!==t&&RM2.upright(M,q)){const e=hyp(q.x-p.x,q.y-p.y);if(e<m)m=e}
  const lane=defendersAhead(M,p,10,4).length;
  return {p,d,space:m,lane,score:Math.min(m,8)-lane*1.5-d*.12};
 }).filter(Boolean).sort((a,b)=>b.score-a.score);
}
RM2.supportOptions=supportOptions;

RM2.carrierThink=function(M,c){
 const t=c.team,cr=R(M,t,c.x),tac=M.T[t].tactics;
 c.carryT=(c.carryT||0);
 const since=M.t-(c.gotBallAt||0);
 // près de la ligne : aplatir
 if(cr>95){RM2.go(c,X(M,t,103),c.y,1);c.task='plonge vers la ligne';return}
 const ahead=defendersAhead(M,c,12,6);
 const near=ahead.reduce((m,d)=>Math.min(m,hyp(d.x-c.x,d.y-c.y)),99);
 const pl=M.play&&M.play.team===t?M.play:null;
 // 1) action prévue par l'annonce
 if(pl&&pl.cur===c.i&&!pl.aborted){
  const step=pl.seq[pl.k+1];
  if(pl.kickBy===c.i){
   if(since>(pl.kickDelay||.45)||near<1.6){RM2.kickFromPlay(M,c,pl.kt);return}
   RM2.go(c,X(M,t,cr-.6),c.y,.35);c.task='se prépare à taper';return;
  }
  if(step!=null){
   const r=M.P[step];const ok=r&&RM2.upright(M,r)&&R(M,t,r.x)<=cr+.4&&hyp(r.x-c.x,r.y-c.y)<18;
   const hold=c.num===9?.12:pl.hold||.55;
   if(ok&&since>hold&&(near<5.5+c.a.vis/40||since>1.05||c.num===9)){
    // lecture : le receveur est-il pris ? sinon, garder le ballon s'il y a un trou
    const rDef=defendersAhead(M,r,6,2.2).length;
    const myLine=bestRunningLine(M,c);
    if(c.num!==9&&myLine.space>6.5&&near>4&&chance(M,.35+c.a.vis/300)){pl.aborted=true;c.task='perce le rideau'}
    else if(rDef>=2&&c.num!==9&&chance(M,.5)){pl.aborted=true}
    else{pl.k++;pl.cur=step;RM2.passBall(M,c,r,pl.kinds?.[pl.k]||'passe');
     if(pl.loop===c.i){c.loopFor=step}
     return}
   }else if(!ok&&since>.9){pl.aborted=true}
  }
 }
 // 2) lecture libre
 const line=bestRunningLine(M,c);
 const breakOut=ahead.length===0||(near>7.8&&line.space>5.2);
 if(breakOut){
  RM2.go(c,X(M,t,cr+12),line.y,1);c.task=ahead.length?'attaque l’intervalle':'percée !';
  if(!c.breakFlag&&ahead.length===0&&cr>30&&M.P.filter(p=>p.team!==t&&RM2.upright(M,p)&&R(M,t,p.x)>cr).length<=2){c.breakFlag=true;M.st[t].breaks++;c.s.br++;
   say(M,t,'break',`Franchissement de ${c.short} ! ${M.T[t].short} est lancé`,1)}
 }else{
  // contact imminent : fixer et transmettre (2 contre 1), sinon prendre le contact
  if(near<3.3&&since>.25){
   const opts=supportOptions(M,c);const o=opts[0];
   const riskK=.08+tac.risk*.22+(c.a.vis-60)/300+(M.T[t].mind==='chase'?.12:0)-(c.num<=8?.08:0);
   if(o&&o.space>2.6&&o.lane<=1&&chance(M,clamp(riskK,.05,.75))){RM2.passBall(M,c,o.p,'passe');c.task='fixe et transmet';return}
  }
  // jeu au pied d'opportunité depuis son camp sous pression
  if([9,10,15,12].includes(c.num)&&cr<30&&near<6&&since>.2&&!c.kickedRecently&&chance(M,.035+tac.kicking*.05)){RM2.kickFromPlay(M,c,'touche');return}
  const straight=c.num<=8?.75:.4;
  RM2.go(c,X(M,t,cr+10),c.y*straight+line.y*(1-straight),.92);c.task=c.num<=8?'charge':'cherche l’espace';
 }
 // sortie en touche évitée
 if(c.y<1.4||c.y>68.6)c.ty=clamp(c.ty,3,67);
};

/* ===================== Réception d'un coup de pied adverse ===================== */
RM2.receiverDecision=function(M,c){
 const t=c.team,cr=R(M,t,c.x),tac=M.T[t].tactics;
 const chasers=M.P.filter(p=>p.team!==t&&RM2.upright(M,p)&&hyp(p.x-c.x,p.y-c.y)<14).length;
 const kickBack=cr<55&&(chasers>=1||cr<30)&&chance(M,clamp(.45+tac.kicking*.4-(M.T[t].mind==='chase'?.25:0),.08,.85));
 if(kickBack&&[9,10,11,12,13,14,15].includes(c.num)){c.plannedKick=M.t+rr(M,.5,1.1);c.task='prépare le renvoi au pied'}
 else c.task='relance';
};

/* ===================== Mise à jour des cibles (jeu courant) ===================== */
RM2.openPlayThink=function(M,dt){
 const b=M.ball,c=RM2.carrier(M);
 let att=c?c.team:(b.st==='air'?b.team:(M.poss>=0?M.poss:b.team));
 if(att!==0&&att!==1)att=0;
 const def=1-att;
 const ax=c?c.x:b.x,ay=c?c.y:b.y;
 const ex=new Set();if(M.tk){ex.add(M.tk.c);for(const d of M.tk.d)ex.add(d)}
 if(c)ex.add(c.i);
 // planification de groupe (recalculée toutes les 0,3 s environ)
 if(!M._shapeAt||M.t-M._shapeAt>.3||M._shapeTeam!==att){
  M._shapeAt=M.t;M._shapeTeam=att;
  const anchor=M.tk?{x:M.P[M.tk.c].x,y:M.P[M.tk.c].y}:{x:ax,y:ay};
  M._aShape=RM2.attackShape(M,att,anchor.x,anchor.y,ex);
  const rdef=R(M,def,anchor.x);
  M._dShape=RM2.defenseShape(M,def,anchor.x,anchor.y,{exclude:ex,ruck:false,offside:null,released:true,carrierIdx:c?c.i:null,attExclude:ex});
 }
 const tacklers=c&&!M.tk?RM2.pickTacklers(M,c):[];
 const ahead0=c?RM2.defendersAhead(M,c,14,9).length:1;
 const tset=new Set(tacklers.map(o=>o.p.i));
 const pl=M.play&&M.play.team===att?M.play:null;
 const inAir=b.st==='air',ballLoose=b.st==='ground'||(inAir&&b.kind==='kick');
 // soutien proche du porteur : 2 joueurs (avants de préférence) se rapprochent pour le ruck
 let supporters=new Set();
 if(c){const cand=M.P.filter(p=>p.team===att&&p.i!==c.i&&RM2.upright(M,p)&&!(pl&&pl.seq.includes(p.i)&&pl.seq.indexOf(p.i)>pl.k)&&p.num!==9)
   .sort((a,b2)=>(hyp(a.x-c.x,a.y-c.y)+(a.num>8?3:0))-(hyp(b2.x-c.x,b2.y-c.y)+(b2.num>8?3:0)));
  for(const p of cand.slice(0,c.breakFlag?3:2))supporters.add(p.i)}
 for(const p of M.P){
  if(!RM2.active(p)||p.mode==='ground'||p.mode==='bound'||p.mode==='contact'||p.mode==='lift')continue;
  if(M.t<p.think)continue;
  p.think=M.t+p.react*(.8+rnd(M)*.5);
  if(c&&p.i===c.i){RM2.carrierThink(M,p);continue}
  if(inAir&&b.kind==='pass'&&b.tgt===p.i){RM2.go(p,b.lx,b.ly,.95);p.task='reçoit';continue}
  if(ballLoose){RM2.looseBallThink(M,p);continue}
  if(p.team===att){
   const sl=M._aShape.slots.get(p.i);
   if(c&&supporters.has(p.i)){
    const cd=dir(M,att),lat=(p.y>c.y?1:-1)*(c.breakFlag?3.5:1.4);
    RM2.go(p,c.x-cd*(c.breakFlag?3:2.2)+c.vx*.4,c.y+lat+c.vy*.4,c.breakFlag?1:.88);p.task='soutien';continue;
   }
   if(pl&&pl.seq.includes(p.i)&&pl.seq.indexOf(p.i)>pl.k&&c){
    // course du receveur annoncé : venir lancé sur le ballon
    const idx=pl.seq.indexOf(p.i);const cr=R(M,att,c.x);
    let ly=sl?sl.y:p.y,dep=idx===pl.k+1?2.6:4.5+(idx-pl.k)*1.3;
    if(pl.var==='croisée'&&idx===pl.k+1&&p.num===12){ly=c.y+pl.side*1.5;dep=1.6}
    if(pl.var==='leurre'&&p.num===12){dep=.6}
    if(pl.var==='redoublée'&&p.i===pl.loopP&&pl.k>=1){const q=M.P[pl.seq[pl.k]];ly=q.y+pl.side*3;dep=2.5}
    if(pl.blindWing===p.i){ly=c.y-pl.side*1.2;dep=1.4}
    if(pl.var==='centres'&&p.num===12){dep=.9}
    if(pl.special&&pl.special[p.i]){const sp=pl.special[p.i];ly=c.y+pl.side*sp.l;dep=sp.dep}
    RM2.go(p,X(M,att,cr-dep+1.5),ly,.9);p.task=pl.var==='leurre'&&p.num===12?'course leurre':'appel de balle';continue;
   }
   if(sl){const rush=c&&c.breakFlag?.95:.62;
    // devant le porteur = hors-jeu : retour immédiat derrière le ballon, en contournant par l'arrière
    const ahead=c?R(M,att,p.x)-R(M,att,c.x):0;
    if(ahead>1){RM2.go(p,X(M,att,R(M,att,c.x)-2.5-Math.min(4,ahead*.3)),p.y+(sl.y-p.y)*.3,.92);p.task='se replace (hors-jeu)'}
    else RM2.go(p,sl.x,sl.y,hyp(sl.x-p.x,sl.y-p.y)>12?.8:rush);
    if(ahead<=1)p.task=sl.task}
  }else{
   if(tset.has(p.i)&&c){
    const o=tacklers.find(z=>z.p.i===p.i);const ti=o.ti;
    RM2.go(p,c.x+c.vx*ti*.85,c.y+c.vy*ti*.85,1);p.task=tacklers[0].p===p?'plaque':'plaquage à deux';continue;
   }
   if(inAir&&b.kind==='pass'){
    // anticipation d'interception : seulement si le défenseur est déjà sur la trajectoire
    const ex2=b.lx,ey2=b.ly;const dl=hyp(p.x-ex2,p.y-ey2);
    if(dl<3.5&&p.a.vis>65&&chance(M,.25)){RM2.go(p,ex2,ey2,1);p.task='lit la passe';continue}
   }
   // repli défensif : si le porteur a franchi, chaque défenseur à portée prend un angle de poursuite
   if(c){const crD=R(M,p.team,c.x),prD=R(M,p.team,p.x),dd=hyp(p.x-c.x,p.y-c.y);
    const broken=c.breakFlag||ahead0===0;
    if(broken&&dd<38&&(prD<crD+6||p.num>=9)){
     const ti=hyp(p.x-c.x,p.y-c.y)/Math.max(4,p.vmax);
     // vise un point entre le porteur et la ligne d'en-but : angle de couverture
     const ix=c.x+c.vx*ti*.9,iy=c.y+c.vy*ti*.9;const lineX=X(M,p.team,Math.max(0,Math.min(crD-2,prD)));
     const tx=prD<crD?(ix*.55+lineX*.45):ix;
     RM2.go(p,tx,iy,1);p.task='repli défensif';continue;
    }}
   const sl=M._dShape.get(p.i);
   if(sl){RM2.go(p,sl.x,sl.y,sl.urg);p.task=sl.task;p.mark=sl.mark??-1}
  }
 }
};

/* ===================== Ballon libre ===================== */
RM2.looseBallThink=function(M,p){
 const b=M.ball;
 const lx=b.st==='air'?(b.lx??b.x):b.x,ly=b.st==='air'?(b.ly??b.y):b.y;
 // les 2 plus proches de chaque équipe vont au ballon, les autres se replacent
 const mine=M.P.filter(q=>q.team===p.team&&RM2.upright(M,q)).sort((a,c)=>hyp(a.x-lx,a.y-ly)/a.vmax-hyp(c.x-lx,c.y-ly)/c.vmax);
 const rank=mine.indexOf(p);
 const kickTeam=b.kind==='kick'?b.team:-1;
 if(rank===0||(rank===1&&hyp(p.x-lx,p.y-ly)<25)){
  // ne pas plonger hors du terrain
  RM2.go(p,lx,clamp(ly,-.5,70.5),1);p.task=p.team===kickTeam?'poursuite':'sous le ballon';return;
 }
 if(p.team===kickTeam){
  // rideau de poursuite : ligne qui monte sur le receveur, hors-jeu respecté
  const kr=R(M,p.team,b.kickX??b.fromX);const pr=R(M,p.team,p.x);
  if(!p.onside){
   // hors-jeu devant le botteur : il s'arrête et attend d'être remis en jeu par un partenaire qui le dépasse
   const passed=M.P.some(q=>q.team===p.team&&q.onside&&RM2.upright(M,q)&&R(M,p.team,q.x)>=pr-.5&&q.i!==p.i);
   if(passed||M.t-(b.t0||0)>2.6)p.onside=true;else{RM2.go(p,p.x-dir(M,p.team)*.6,p.y,.2);p.task='attend d’être remis en jeu';return}
  }
  const tr=R(M,p.team,lx)-6-rank*1.5;const spread=(rank-5)*4.5;
  RM2.go(p,X(M,p.team,tr),clamp(ly+spread,2,68),.88);p.task='rideau';return;
 }
 // équipe receveuse : se replace pour la relance
 const rr0=R(M,p.team,lx);const spread=(rank-6)*5;
 RM2.go(p,X(M,p.team,clamp(rr0+(p.num<=8?4:-2),1,99)),clamp(ly+spread,2,68),p.num<=8?.6:.7);p.task='se replace';
};
})(typeof window!=='undefined'?window:globalThis);
