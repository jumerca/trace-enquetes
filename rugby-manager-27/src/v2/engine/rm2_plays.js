/* Rugby Manager 27 — V2.1 · Combinaisons, plan de jeu, météo et intelligence situationnelle
 * - 15 combinaisons de touche (choix du 1er, 2e ou 3e sauteur) et 15 combinaisons de mêlée.
 * - Plan de jeu global (au pied / équilibré / à la main / adapté au vent et à la météo) modifiable en direct.
 * - Météo : vent (portée des coups de pied), pluie (prise de balle, passes, contacts).
 * - Situations de match : bonus offensif et défensif, gestion du score et du temps, choix des pénalités.
 * - Placement : occupation de la largeur en attaque, structure sur jeu au pied (rideau, couverture, relance).
 */
'use strict';
(function(root){
const RM2=root.RM2;
const {clamp,hyp}=RM2.util;
const {rnd,rr,chance,dir,R,X,say}=RM2;
const nm=(M,t)=>M.T[t].short||M.T[t].name;
const byNum=(M,t,n)=>M.P.find(p=>p.team===t&&p.num===n&&RM2.active(p)&&p.mode!=='ground');

/* =================== Catalogues de combinaisons =================== */
const Z=['avant','milieu','fond'];
RM2.LINEOUT_PLAYS=[
 {id:'maul',name:'Maul porté',zones:['avant','milieu'],after:'maul',desc:'Le pack se lie derrière le sauteur et pousse vers l’en-but.'},
 {id:'maul-ferme',name:'Maul puis 9 côté fermé',zones:['avant','milieu'],after:'maul',then:'blind9',desc:'Le maul fixe la défense, le 9 attaque le côté fermé.'},
 {id:'maul-large',name:'Maul de fixation puis jeu au large',zones:['avant','milieu'],after:'maul',then:'wide',desc:'Maul court pour aspirer les avants adverses, puis ballon aux trois-quarts.'},
 {id:'maul-pick',name:'Maul puis pick and go',zones:['avant','milieu'],after:'maul',then:'pick',desc:'Spécial cinq mètres : maul, puis les avants percutent au ras.'},
 {id:'peel',name:'Enroulement (peel) du n°8',zones:['milieu','fond'],after:'peel',desc:'Le sauteur remet au 8 qui contourne la fin d’alignement.'},
 {id:'tap9-pied',name:'Déviation au 9 et chandelle',zones:['avant','milieu'],after:'tap9',kick:'box',desc:'Ballon dévié directement au 9 qui tape une chandelle disputée.'},
 {id:'top-ligne',name:'Ballon au 9, attaque en ligne',zones:Z,after:'top',backs:'ligne',desc:'Sortie propre, circulation 10-12-13 vers l’aile.'},
 {id:'top-croisee',name:'Croisée 10–12',zones:Z,after:'top',backs:'croisée',desc:'Le 12 rentre contre le sens de la défense.'},
 {id:'top-sautee',name:'Passe sautée vers le 13',zones:['milieu','fond'],after:'top',backs:'sautée',desc:'Le 10 saute le 12 pour attaquer l’extérieur.'},
 {id:'top-redoublee',name:'Redoublée 10–12–10',zones:['milieu','fond'],after:'top',backs:'redoublée',desc:'Le 10 tourne autour du 12 pour créer le surnombre.'},
 {id:'top-arriere',name:'Arrière intercalé',zones:Z,after:'top',backs:'arrière intercalé',desc:'Le 15 s’insère entre les centres.'},
 {id:'top-ailier',name:'Ailier fermé à l’intérieur',zones:Z,after:'top',backs:'ailier fermé',desc:'L’ailier côté fermé surgit dans le dos du 10.'},
 {id:'fond-8',name:'Lancer au fond, charge du n°8',zones:['fond'],after:'top',backs:'charge8',desc:'Lancer long, le 8 percute au milieu de terrain.'},
 {id:'top-pied10',name:'Jeu au pied du 10 dans le dos',zones:Z,after:'top',backs:'kick',kick:'rasant',desc:'Le 10 glisse un coup de pied derrière une défense montée.'},
 {id:'rapide',name:'Lancer rapide au premier, 9 côté fermé',zones:['avant'],after:'quick',desc:'Lancer immédiat avant le placement adverse, le 9 part côté fermé.'}
];
RM2.SCRUM_PLAYS=[
 {id:'classique',name:'Sortie du 9, attaque en ligne',start:'9',backs:'ligne',desc:'Circulation rapide vers l’extérieur.'},
 {id:'8-ouvert',name:'Départ du n°8 côté ouvert',start:'8',side:'open',desc:'Le 8 ramasse et attaque la 1re ligne défensive.'},
 {id:'8-ferme',name:'Départ du n°8 côté fermé',start:'8',side:'blind',desc:'Le 8 part côté fermé avec l’ailier en soutien.'},
 {id:'8-9',name:'Le 8 transmet au 9 côté fermé',start:'8-9',side:'blind',desc:'Le 8 fixe le flanker, le 9 prend l’intervalle.'},
 {id:'9-ferme',name:'Départ du 9 côté fermé avec l’ailier',start:'9',side:'blind',snipe:true,desc:'Le 9 attaque seul le petit côté.'},
 {id:'croisee',name:'Croisée 10–12',start:'9',backs:'croisée',desc:'Le 12 coupe la course intérieure.'},
 {id:'ailier-ferme',name:'Ailier fermé à l’intérieur du 10',start:'9',backs:'ailier fermé',desc:'L’ailier surgit en relais intérieur.'},
 {id:'arriere',name:'Arrière intercalé',start:'9',backs:'arrière intercalé',desc:'Le 15 crée le surnombre au centre.'},
 {id:'sautee',name:'Passe sautée 10 → 13',start:'9',backs:'sautée',desc:'Attaque rapide de l’extérieur.'},
 {id:'redoublee',name:'Redoublée 10–12–10',start:'9',backs:'redoublée',desc:'Le 10 reprend le ballon à l’extérieur du 12.'},
 {id:'leurre',name:'Leurre du 12, ballon au 13',start:'9',backs:'leurre',desc:'Le 12 attire la défense, le ballon passe derrière.'},
 {id:'centres',name:'Charge du 12 au premier temps',start:'9',backs:'centres',desc:'Percussion directe pour gagner la ligne d’avantage.'},
 {id:'pression',name:'Mêlée de pression, puis pick and go',start:'8',push:true,side:'open',desc:'On pousse pour obtenir la pénalité ; sinon le 8 percute.'},
 {id:'chandelle',name:'Chandelle du 9',start:'9',kick:'box',desc:'Jeu au pied disputé pour gagner du terrain.'},
 {id:'pied10',name:'Jeu au pied du 10',start:'9',backs:'kick',kick:'auto',desc:'Transversale près de la ligne, sinon jeu dans le dos.'}
];
RM2.playById=(type,id)=>(type==='lineout'?RM2.LINEOUT_PLAYS:RM2.SCRUM_PLAYS).find(p=>p.id===id);

/* =================== Météo =================== */
RM2.makeWeather=function(seed,month){
 const M={rng:seed>>>0||7};for(let i=0;i<3;i++)rnd(M);
 const winter=[11,12,1,2,3].includes(month);const x=rnd(M);
 let kind=x<(winter?.25:.42)?'clear':x<(winter?.52:.72)?'cloudy':x<(winter?.82:.9)?'rain':'wind';
 const sign=rnd(M)<.5?-1:1;
 const wind=kind==='wind'?rr(M,7,11):kind==='rain'?rr(M,2,7):kind==='cloudy'?rr(M,1,5):rr(M,0,3);
 const rain=kind==='rain'?rr(M,.5,1):0;
 const label={clear:'Ensoleillé',cloudy:'Nuageux',rain:'Pluie',wind:'Vent fort'}[kind];
 return {kind,label,wind:+(sign*wind).toFixed(1),rain:+rain.toFixed(2)};
};
RM2.windFor=(M,t)=>(M.weather?M.weather.wind:0)*dir(M,t);// > 0 : vent dans le dos

/* =================== Plan de jeu effectif =================== */
RM2.PLANS={auto:'Automatique (capitaine)',pied:'Jeu au pied',equilibre:'Équilibré',main:'Jeu à la main',vent:'Adapté au vent et à la météo'};
RM2.OBJECTIVES={auto:'Automatique',bonus:'Aller chercher le bonus offensif',securiser:'Sécuriser le résultat',bonusdef:'Préserver le bonus défensif'};
function triesForBonus(M,t){const o=1-t;return M.bonusRule==='quatre'?Math.max(0,4-M.tries[t]):Math.max(0,3-(M.tries[t]-M.tries[o]))}
RM2.triesForBonus=triesForBonus;
RM2.mindset=function(M){
 const left=2*RM2.HALF-M.clock;
 for(let t=0;t<2;t++){
  const T=M.T[t];if(!T.base)T.base=Object.assign({},T.tactics);
  const diff=M.score[t]-M.score[1-t],obj=T.base.objective||'auto';
  let mind='normal';
  if(left<900&&diff<0&&diff>=-14)mind='chase';
  else if((left<720&&diff>0&&diff<=10)||(left<240&&diff>10))mind='protect';
  const need=triesForBonus(M,t);
  if((obj==='bonus'||obj==='auto')&&need===1&&diff>=-7&&left<1500&&left>0&&!(diff>0&&diff<=3&&left<300))mind='bonus';
  if(obj==='bonus'&&need>=1&&need<=2&&diff>=0)mind='bonus';
  if((obj==='bonusdef'||obj==='auto')&&diff<=-8&&diff>=-10&&left<600)mind='bonusdef';
  if(obj==='securiser'&&diff>0&&left<1500)mind='protect';
  T.mind=mind;
  // consignes effectives = consignes de base + plan + météo + situation
  const b=T.base,eff=Object.assign({},b);
  const plan=b.plan||'auto';const wind=RM2.windFor(M,t),rain=M.weather?.rain||0;
  if(plan==='pied')eff.kicking=Math.max(b.kicking,.78);
  else if(plan==='main'){eff.kicking=Math.min(b.kicking,.18);eff.risk=clamp(b.risk+.1,0,1);eff.width=clamp(b.width+.05,0,1)}
  else if(plan==='equilibre')eff.kicking=.5;
  const windK=plan==='vent'?1:plan==='auto'?.5:0;
  eff.kicking=clamp(eff.kicking+windK*clamp(wind*.06,-.32,.32)+windK*rain*.3,0,1);
  if(windK)eff.width=clamp(eff.width-rain*.15*windK,0,1);
  eff.risk=clamp(eff.risk-rain*.15,0,1);
  if(mind==='chase'){eff.kicking=clamp(eff.kicking-.22,0,1);eff.risk=clamp(eff.risk+.15,0,1);eff.tempo=clamp(eff.tempo+.15,0,1)}
  else if(mind==='protect'){eff.kicking=clamp(eff.kicking+.2,0,1);eff.risk=clamp(eff.risk-.15,0,1);eff.tempo=clamp(eff.tempo-.2,0,1)}
  else if(mind==='bonus'){eff.kicking=clamp(eff.kicking-.2,0,1);eff.risk=clamp(eff.risk+.08,0,1);eff.tempo=clamp(eff.tempo+.1,0,1)}
  T.tactics=eff;
 }
};
RM2.setBaseTactics=function(M,t,tac){M.T[t].base=Object.assign({},M.T[t].base||M.T[t].tactics,tac);RM2.mindset(M)};

/* =================== Pénalités : décision du capitaine =================== */
RM2.aiPenaltyWhy=function(M,team,x,y,free){
 const o=1-team,base=M.T[team].base||M.T[team].tactics,r=R(M,team,x),left=2*RM2.HALF-M.clock,diff=M.score[team]-M.score[o];
 const k=RM2.goalKicker(M,team);const pg=free?0:RM2.goalChance(M,team,x,y,k);
 const mind=M.T[team].mind,need=triesForBonus(M,team);
 const scrumEdge=(M.st[team].scrumsWon/Math.max(1,M.st[team].scrums))-(M.st[o].scrumsWon/Math.max(1,M.st[o].scrums));
 const close=r>=91;// moins de 9 m : la touche ne fait plus gagner de terrain
 const tryOpt=()=>scrumEdge>.05||M.T[team].tactics.forwards>.6||chance(M,.5)?['scrum','Mêlée à cinq mètres : on va chercher l’essai avec le pack']:['tap','Pénalité jouée vite : les avants percutent au ras'];
 const pick=(o2,why)=>({opt:o2,why});
 // consigne du manager, sauf option absurde
 if(base.penalty==='posts'&&!free&&pg>.25)return pick('posts','Consigne : prendre les points');
 if(base.penalty==='touch'&&!close)return pick('touch','Consigne : pénaltouche');
 if(base.penalty==='scrum')return pick('scrum','Consigne : mêlée');
 if(free)return close?pick(...tryOpt()):r<40?pick('touch','Coup franc : dégagement en touche'):pick('tap','Coup franc joué vite');
 // fin de match
 if(left<240){
  if(diff<0&&diff>=-3&&pg>.3)return pick('posts',diff===-3?'Trois points pour égaliser':'Trois points pour passer devant');
  if(diff<-3)return close?pick(...tryOpt()):pick('touch','Il faut un essai : touche près de la ligne');
  if(diff>0&&diff<=4&&pg>.7)return pick('posts','Trois points pour passer à plus de sept');
  if(diff>0)return close?pick('posts','Garder le score : tir au but'):pick('touch','Gagner du terrain et du temps');
 }
 if(mind==='bonus'&&need>0){
  return close?pick(...tryOpt()):r>45?pick('touch',`Il manque ${need} essai${need>1?'s':''} pour le bonus offensif : touche`):pick('touch','Bonus offensif en vue : on garde le ballon');
 }
 if(mind==='bonusdef'&&pg>.35)return pick('posts','Trois points pour revenir à moins de huit (bonus défensif)');
 if(mind==='chase'&&diff<-7)return close?pick(...tryOpt()):pick('touch','Retard important : il faut des essais');
 if(close){
  if(pg>.85&&Math.abs(diff)<=3&&left<1200&&chance(M,.35))return pick('posts','Match serré : on prend les trois points');
  return pick(...tryOpt());
 }
 if(r>=70){if(pg>.72&&(Math.abs(diff)<=3||left<1500)&&chance(M,.55))return pick('posts','Pénalité facile, on prend les points');return pick('touch','Pénaltouche : maul dans les 22 adverses')}
 if(r>=48){if(pg>.6&&chance(M,.75))return pick('posts','À portée du buteur');return pick('touch','Touche pour avancer dans le camp adverse')}
 if(chance(M,.05+base.tempo*.06))return pick('tap','Relance rapide');
 return pick('touch','Dégagement en touche');
};
RM2.aiPenalty=function(M,team,x,y,free){return RM2.aiPenaltyWhy(M,team,x,y,free).opt};
// la suggestion affichée au manager contient l'explication
const oldAward=RM2.awardPenalty;
RM2.awardPenalty=function(M,team,x,y,reason,by,fromAdv,free){
 oldAward.apply(this,arguments);
 if(M.pending&&M.pending.type==='penalty'){const s=RM2.aiPenaltyWhy(M,team,M.pending.x,M.pending.y,M.pending.free);M.pending.suggest=s.opt;M.pending.why=s.why;
  const r=R(M,team,M.pending.x);if(r>=91)M.pending.options=M.pending.options.map(o=>o.id==='touch'?{...o,label:o.label+' (inutile si près)',weak:true}:o)}
};

/* =================== Choix des combinaisons =================== */
RM2.aiSetPiece=function(M,t,type,x,y){
 const r=R(M,t,x),mind=M.T[t].mind,tac=M.T[t].tactics,list=type==='lineout'?RM2.LINEOUT_PLAYS:RM2.SCRUM_PLAYS;
 const w={};
 for(const p of list){let v=1;
  if(type==='lineout'){
   if(p.after==='maul')v=r>78?(p.then==='pick'&&r>92?4:2.4):r>55?.6:.15;
   if(p.after==='tap9')v=r<40?2.2:.3;
   if(p.backs==='kick')v=r<55?1.2:r>75?.9:.4;
   if(p.after==='top')v*=.6+tac.width;
   if(p.id==='rapide')v=.35;
   if(p.id==='peel')v=r>60?1:.5;
  }else{
   if(p.kick==='box')v=r<40?2.4:.15;
   if(p.backs==='kick')v=r<50?1.1:r>78?.8:.3;
   if(p.start==='8'||p.start==='8-9')v=r>80?1.8:.8;
   if(p.push)v=r>80?1.6:.4;
   if(p.backs&&p.backs!=='kick')v*=.5+tac.width;
  }
  if(mind==='bonus'||mind==='chase'){if(p.kick||p.backs==='kick')v*=.25}
  if(mind==='protect'){if(p.kick)v*=2}
  w[p.id]=Math.max(.01,v);
 }
 let tot=0;for(const k in w)tot+=w[k];let q=rnd(M)*tot,id=list[0].id;for(const k in w){q-=w[k];if(q<=0){id=k;break}}
 const play=RM2.playById(type,id);
 let zone=null;if(type==='lineout'){const tz=tac.lineoutTarget;const pref={court:'avant',milieu:'milieu',fond:'fond'}[tz];zone=pref&&play.zones.includes(pref)?pref:play.zones[Math.floor(rnd(M)*play.zones.length)]}
 return {type,id,zone,quick:id==='rapide',push:!!play.push};
};
RM2.setPieceCall=function(M,type,t,pd){
 if(pd.call)return;
 const user=t===M.userTeam&&!M.auto&&M.askSet!==false;
 const preset=(M.T[t].base||M.T[t].tactics)[type==='lineout'?'lineoutCall':'scrumCall'];
 if(!user&&preset&&preset!=='auto'){const play=RM2.playById(type,preset);if(play){pd.call={type,id:preset,zone:type==='lineout'?(play.zones.includes(pd.zonePref)?pd.zonePref:play.zones[0]):null,quick:preset==='rapide',push:!!play.push};announce(M,t,pd.call);return}}
 const ai=RM2.aiSetPiece(M,t,type,pd.x,type==='lineout'?(pd.side===0?5:65):pd.y);
 if(user){M.pending={type,team:t,x:pd.x,y:pd.y,suggest:ai};return}
 pd.call=ai;announce(M,t,ai);
};
function announce(M,t,c){const p=RM2.playById(c.type,c.id);if(!p)return;say(M,t,'call',`${nm(M,t)} · ${c.type==='lineout'?'touche':'mêlée'}${c.zone?' ('+({avant:'1er',milieu:'2e',fond:'3e'}[c.zone])+' sauteur)':''} : ${p.name}`,0)}
RM2.setPieceChoice=function(M,choice){
 const p=M.pending;if(!p||(p.type!=='lineout'&&p.type!=='scrum'))return false;
 M.pending=null;
 const c=choice&&choice.id?choice:p.suggest;
 const play=RM2.playById(p.type,c.id);
 const zone=p.type==='lineout'?(c.zone&&play.zones.includes(c.zone)?c.zone:play.zones[0]):null;
 M.pd.call={type:p.type,id:c.id,zone,quick:c.id==='rapide',push:!!play.push};
 announce(M,p.team,M.pd.call);
 return true;
};
const oldAuto=RM2.autoDecide;
RM2.autoDecide=function(M){if(M.pending&&(M.pending.type==='lineout'||M.pending.type==='scrum')){RM2.setPieceChoice(M,M.pending.suggest);return}return oldAuto(M)};

/* =================== Exécution des combinaisons =================== */
function mates(M,t){return M.P.filter(p=>p.team===t&&RM2.upright(M,p))}
function backsPlay(M,t,first,variant,at,side,pre=[]){
 const ms=mates(M,t).filter(p=>p!==first);
 const ten=ms.find(p=>p.num===10)||ms.find(p=>p.num===12)||ms.find(p=>p.num===15);
 const pl={team:t,kind:'backs',var:variant,seq:[...pre.map(p=>p.i),first.i],k:0,cur:pre.length?pre[0].i:first.i,side,aborted:false,t0:M.t,hold:.15,kinds:[]};
 if(!ten)return pl;
 pl.seq.push(ten.i);
 if(variant==='kick'){pl.kind='kick10';pl.kickBy=ten.i;pl.kickDelay=rr(M,.35,.6);const r=R(M,t,at.x);pl.kt=r>70?(chance(M,.5)?'transversale':'rasant'):(chance(M,.5)?'rasant':'long');pl.var='jeu au pied du 10';return pl}
 if(variant==='charge8'){const e=ms.find(p=>p.num===8);if(e){pl.seq.pop();pl.seq.push(e.i);pl.special={[e.i]:{l:7,dep:1.4}};pl.var='charge du n°8'}return pl}
 pl.forceVar=variant;RM2.addBacks(M,t,pl,ten,side,ms,M.T[t].tactics,R(M,t,at.x));
 return pl;
}
RM2.lineoutFollow=function(M,w,call,at){
 const t=w.team,play=RM2.playById('lineout',call.id),nine=byNum(M,t,9);const open=at.e;// côté ouvert = vers le centre du terrain
 M.T[t].phaseNo=0;
 if(play.after==='maul'){RM2.startMaul(M,w);M.pd.then=play.then||null;if(play.then==='pick'||R(M,t,w.x)>85)M.pd.outcome=M.pd.outcome==='held'&&chance(M,.5)?'normal':M.pd.outcome;return}
 if(!nine){M.play=null;return}
 if(play.after==='peel'){const peel=byNum(M,t,8)||byNum(M,t,6);if(peel&&peel!==w){M.play={team:t,kind:'pod',var:'enroulement',seq:[w.i,peel.i],k:0,cur:w.i,side:open,aborted:false,t0:M.t,hold:.1,kinds:[],special:{[peel.i]:{l:2.5,dep:1.2}}};return}}
 if(play.after==='tap9'){M.play={team:t,kind:'box',var:'déviation et chandelle',seq:[w.i,nine.i],k:0,cur:w.i,side:open,aborted:false,t0:M.t,hold:.05,kinds:[],kickBy:nine.i,kt:'box',kickDelay:.3};return}
 if(play.after==='quick'){M.play={team:t,kind:'snipe',var:'9 côté fermé',seq:[w.i,nine.i],k:0,cur:w.i,side:-open,aborted:false,t0:M.t,hold:.08,kinds:[]};return}
 M.play=backsPlay(M,t,nine,play.backs||'ligne',at,open,[w]);M.play.hold=.12;
};
RM2.maulFollow=function(M,t,nine,then,at){
 const open=at.y<35?1:-1;
 if(then==='blind9'){M.play={team:t,kind:'snipe',var:'9 côté fermé',seq:[nine.i],k:0,cur:nine.i,side:-open,aborted:false,t0:M.t,hold:.1,kinds:[]};return}
 if(then==='pick'){const f=mates(M,t).filter(p=>p.num<=8).sort((a,b)=>hyp(a.x-at.x,a.y-at.y)-hyp(b.x-at.x,b.y-at.y))[0];M.play={team:t,kind:'pick',var:'pick and go',seq:[nine.i].concat(f?[f.i]:[]),k:0,cur:nine.i,side:open,aborted:false,t0:M.t,hold:.12,kinds:[]};return}
 M.play=backsPlay(M,t,nine,'ligne',at,open);
};
RM2.scrumFollow=function(M,t,call,at){
 const play=RM2.playById('scrum',call.id),open=at.y<35?1:-1;const nine=byNum(M,t,9)||RM2.goalKicker(M,t),eight=byNum(M,t,8);
 M.T[t].phaseNo=0;
 const side=play.side==='blind'?-open:open;
 if((play.start==='8'||play.start==='8-9')&&eight){
  RM2.gainPossession(M,eight,'mêlée');
  if(play.start==='8-9'&&nine){M.play={team:t,kind:'snipe',var:play.name,seq:[eight.i,nine.i],k:0,cur:eight.i,side,aborted:false,t0:M.t,hold:.35,kinds:[],special:{[nine.i]:{l:1.5,dep:1}}};return}
  M.play={team:t,kind:'pod',var:play.name,seq:[eight.i],k:0,cur:eight.i,side,aborted:false,t0:M.t,kinds:[]};
  eight.tx=eight.x+dir(M,t)*6;eight.ty=eight.y+side*3;return;
 }
 RM2.gainPossession(M,nine,'mêlée');
 if(play.snipe){M.play={team:t,kind:'snipe',var:play.name,seq:[nine.i],k:0,cur:nine.i,side,aborted:false,t0:M.t,kinds:[]};nine.tx=nine.x+dir(M,t)*5;nine.ty=nine.y+side*4;return}
 if(play.kick==='box'){M.play={team:t,kind:'box',var:play.name,seq:[nine.i],k:0,cur:nine.i,side,aborted:false,t0:M.t,kinds:[],kickBy:nine.i,kt:'box',kickDelay:.45};return}
 M.play=backsPlay(M,t,nine,play.backs||'ligne',at,side);M.play.hold=.18;
};

/* =================== Placement : occupation de la largeur =================== */
// Côté ouvert « collant » : l'équipe ne change de sens que si le point de fixation s'est vraiment déplacé.
function stickySide(M,t,ay){
 const pl=M.play&&M.play.team===t?M.play:null;if(pl&&pl.side)return pl.side;
 M._side=M._side||[null,null];const s=M._side[t];
 const natural=ay<35?1:-1;
 if(!s||Math.abs(ay-s.y)>14||ay<10||ay>60){M._side[t]={s:natural,y:ay};return natural}
 return s.s;
}
RM2.attackShape=function(M,t,ax,ay,exclude){
 const tac=M.T[t].tactics,s=stickySide(M,t,ay),W=s>0?70-ay:ay,SW=70-W;
 const r=R(M,t,ax);
 const out=new Map();
 const ms=M.P.filter(p=>p.team===t&&RM2.active(p)&&!exclude.has(p.i));
 const wf=.75+.5*tac.width;// largeur demandée
 const lat=f=>Math.min(W-3,Math.max(4,W*f*wf));
 const at=(l,dep)=>({x:X(M,t,r-dep),y:clamp(ay+s*l,1.5,68.5)});
 // avants : cellules réparties sur la largeur
 const F=[];const two=tac.shape==='2-4-2';const shortOK=SW>9;
 const pod=(c,n,dep=2.4)=>{F.push([c,dep]);if(n>1)F.push([c-2.2,dep+1.3]);if(n>2)F.push([c+2.2,dep+1.3])};
 if(two){if(shortOK){F.push([-Math.min(SW-4,9),2.6],[-Math.min(SW-4,9)+2.2,3.8])}else{F.push([3,4],[5,5])}pod(Math.max(5,W*.14),2);pod(Math.max(11,W*.34),2);pod(Math.max(16,W*.62),2)}
 else{if(shortOK)F.push([-Math.min(SW-4,8),2.8]);else F.push([3,4.5]);pod(Math.max(5,W*.12),3);pod(Math.max(12,W*.42),3);F.push([Math.max(18,W*.72),2.8])}
 const fw=ms.filter(p=>p.num<=8);
 const fSlots=F.map(([l,d])=>({...at(l,d),task:'cellule'}));
 const used=new Set();
 const pairs=[];for(const p of fw)for(let k=0;k<fSlots.length;k++)pairs.push([hyp(p.x-fSlots[k].x,p.y-fSlots[k].y),p,k]);
 pairs.sort((a,b)=>a[0]-b[0]);for(const [d,p,k] of pairs){if(out.has(p.i)||used.has(k))continue;out.set(p.i,fSlots[k]);used.add(k)}
 // trois-quarts : ligne échelonnée qui couvre le côté ouvert
 const deep=r<35&&RM2.T_kickThreat!==false;
 const B={10:[Math.max(7,lat(.16)),6.2],12:[lat(.3),7.6],13:[lat(.45),8.8],15:deep?[lat(.38),18]:[lat(.6),10],WO:[W-3.5,6.8],WS:SW>13?[-(SW-3.5),5.5]:[-SW*.3+3,22],9:[0,1.2]};
 const wings=ms.filter(p=>p.num===11||p.num===14);
 const wo=at(...B.WO),ws=at(...B.WS);
 if(wings.length===2){const [a,b]=wings;const ab=hyp(a.x-wo.x,a.y-wo.y)+hyp(b.x-ws.x,b.y-ws.y),ba=hyp(b.x-wo.x,b.y-wo.y)+hyp(a.x-ws.x,a.y-ws.y);
  out.set((ab<=ba?a:b).i,{...wo,task:'ailier côté ouvert'});out.set((ab<=ba?b:a).i,{...ws,task:SW>13?'ailier côté fermé':'couverture'})}
 else if(wings.length===1)out.set(wings[0].i,{...wo,task:'ailier'});
 for(const n of [9,10,12,13,15]){const p=ms.find(q=>q.num===n);if(p&&!out.has(p.i))out.set(p.i,{...at(...B[n]),task:n===15?'arrière':n===10?'ouvreur':n===9?'demi de mêlée':'trois-quarts'})}
 for(const p of ms)if(!out.has(p.i))out.set(p.i,{...at(lat(.25),5),task:'soutien'});
 return {slots:out,side:s,openW:W,shortW:SW};
};

/* =================== Placement sur jeu au pied =================== */
RM2.looseBallThink=function(M,p){
 const b=M.ball;
 const lx=b.st==='air'?(b.lx??b.x):b.x,ly=b.st==='air'?(b.ly??b.y):b.y;
 const kickTeam=b.kind==='kick'?b.team:-1;
 const mine=M.P.filter(q=>q.team===p.team&&RM2.upright(M,q)).sort((a,c)=>hyp(a.x-lx,a.y-ly)/a.vmax-hyp(c.x-lx,c.y-ly)/c.vmax);
 const rank=mine.indexOf(p);
 const loose=b.st==='ground'||(b.kt==='loose');
 // ballon au sol ou très proche : les deux plus proches y vont, quelle que soit l'équipe
 if(rank===0||(rank===1&&(loose||hyp(p.x-lx,p.y-ly)<12))){
  if(p.team===kickTeam&&!p.onside){const pr=R(M,p.team,p.x),kr=R(M,p.team,b.kickX??b.fromX);if(pr>kr+1){RM2.go(p,p.x,p.y,.15);p.task='attend d’être remis en jeu';return}}
  RM2.go(p,lx,clamp(ly,-.5,70.5),1);p.task=p.team===kickTeam?'poursuite':'sous le ballon';return;
 }
 const rl=R(M,p.team,lx);
 if(p.team===kickTeam){
  const pr=R(M,p.team,p.x),kr=R(M,p.team,b.kickX??b.fromX);
  if(!p.onside){const passed=M.P.some(q=>q.team===p.team&&q.onside&&RM2.upright(M,q)&&R(M,p.team,q.x)>=pr-.5&&q.i!==p.i);
   if(passed||M.t-(b.t0||0)>2.6)p.onside=true;else{RM2.go(p,p.x-dir(M,p.team)*.5,p.y,.15);p.task='attend d’être remis en jeu';return}}
  // arrière et un ailier restent en couverture pour le renvoi adverse
  if(p.num===15||(p.num===9&&rl>40)){RM2.go(p,X(M,p.team,clamp(Math.min(kr,rl)-12-(p.num===15?14:0),2,95)),clamp(35+(ly-35)*.3,8,62),.55);p.task='couverture du renvoi';return}
  // rideau de poursuite : une ligne espacée sur la largeur, qui monte sur le receveur
  const chasers=mine.filter(q=>q.num!==15&&!(q.num===9&&rl>40)).slice(2);const k=chasers.indexOf(p);const n=Math.max(1,chasers.length);
  const ySpan=Math.min(60,n*6.5);const y0=clamp(ly-ySpan/2,4,66-ySpan);
  RM2.go(p,X(M,p.team,rl-7-Math.abs(k-(n-1)/2)*.8),clamp(y0+(n>1?k*ySpan/(n-1):ySpan/2),3,67),.9);p.task='rideau de poursuite';return;
 }
 // équipe receveuse : couverture du fond, soutien du receveur, ligne de replacement devant le ballon
 if([11,14,15].includes(p.num)&&rank<=4){const side=p.y<ly?-1:1;RM2.go(p,X(M,p.team,clamp(rl-4,1,99)),clamp(ly+side*14,3,67),.85);p.task='couverture du fond';return}
 if(rank===2&&p.num>=9){RM2.go(p,X(M,p.team,clamp(rl-3,1,99)),clamp(ly+(p.y<ly?-6:6),3,67),.85);p.task='soutien du receveur';return}
 const others=mine.slice(3);const k=others.indexOf(p);const n=Math.max(1,others.length);
 const yy=8+(n>1?k*54/(n-1):27);
 RM2.go(p,X(M,p.team,clamp(rl+10+(p.num<=8?5:0),1,96)),yy,p.num<=8?.6:.7);p.task='replacement';
};
})(typeof window!=='undefined'?window:globalThis);
