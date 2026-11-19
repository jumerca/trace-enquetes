
/* Rugby Manager 27 1.3 : séquences tactiques simulées et représentation continue.
 * 30 joueurs conservés sur le terrain, déplacement interpolé, rucks, conquête, relance,
 * territoire, discipline et coups de pied contextualisés. Pas de physique 30v30.
 */
'use strict';
function rm13Stats(g){g.stats={rucks:0,tackles:0,passes:0,kicks:0,lineouts:0,scrums:0,penalties:0,mauls:0,turnovers:0,...(g.stats||{})};
 for(const k of ['meters','lineBreaks','handlingErrors','setPieceSteals','territory0','territory1','phases'])if(!Number.isFinite(g.stats[k]))g.stats[k]=0;
 if(!Number.isFinite(g.momentum))g.momentum=0;
 if(!g.matchModel)g.matchModel={version:1,carrier:[9,9],ballPath:null,positions:null,from:null,targets:null,phaseStart:0};
}
const rm13OldInit=rmInit;
rmInit=function(f){const g=rm13OldInit(f);rm13Stats(g);return g;};
const rm13OldReadStore=rmReadStore;
rmReadStore=function(f){const g=rm13OldReadStore(f);if(g)rm13Stats(g);return g;};
function rm13Target(g,side,index,pos,poss,phase){
 const dir=rmDirection(g,side),my=side===poss,ball=pos,deep=side===0?0:1;
 let x,y;
 if(phase==='Mêlée'&&index<8){x=ball.x+(my?-dir:dir)*(1+Math.floor(index/3)*1.7);y=ball.y+(index%4-1.5)*2.8;}
 else if(phase==='Touche'&&index<8){x=ball.x+(my?-dir:dir)*(2+Math.floor(index/4)*2);y=ball.y+(index%4)*2.6*(ball.y>35?-1:1);}
 else if(phase==='Ruck'&&index<4){x=ball.x-dir*((my?1:-1)*(index%2)+2);y=ball.y+(index-1.5)*1.6;}
 else if(my){
  if(index<8){const rank=Math.floor(index/3),wing=(index%3)-1;x=ball.x-dir*(3.8+rank*4.0);y=ball.y+wing*(5.2+rank);}
  else if(index===8){x=ball.x-dir*3.7;y=ball.y+2.8;}
  else if(index===9){x=ball.x-dir*10;y=ball.y-3;}
  else if(index===14){x=ball.x-dir*24;y=34;}
  else {const rows={10:[13,9],11:[16,-4],12:[15,17],13:[17,-19]};const pair=rows[index]||[12,0];x=ball.x-dir*pair[0];y=35+pair[1]+(ball.y-35)*.48;}
 }else{
  if(index===14){x=ball.x+dir*26;y=rmClamp(ball.y*.4+20,10,58);}
  else if(index<8){x=ball.x+dir*(5+Math.floor(index/3)*2.5);y=ball.y+(index%4-1.5)*5.6;}
  else {x=ball.x+dir*(6+(index-8)*1.55);y=rmClamp(10+(index-8)*8+(ball.y-35)*.5,3,67);}
 }
 return {x:rmClamp(x,2,98),y:rmClamp(y,3,67)};
}
function rm13BuildTargets(g){
 rm13Stats(g);const model=g.matchModel,old=model.targets||Array.from({length:2},(_,s)=>Array.from({length:15},(_,i)=>rm13Target(g,s,i,g.ball,g.poss,g.phase)));
 model.from=old.map(row=>row.map(p=>({...p})));
 const raw=Array.from({length:2},(_,s)=>Array.from({length:15},(_,i)=>rm13Target(g,s,i,g.ball,g.poss,g.phase)));
 // Les joueurs ne traversent plus la moitié du terrain instantanément lors des changements de possession.
 model.targets=raw.map((team,s)=>team.map((p,i)=>{
  const prev=old[s][i],dx=p.x-prev.x,dy=p.y-prev.y,dist=Math.hypot(dx,dy),limit=i===14?16:12;
  return dist>limit?{x:rmClamp(prev.x+dx/dist*limit,2,98),y:rmClamp(prev.y+dy/dist*limit,3,67)}:p;
 }));
 model.phaseStart=performance.now();
}
function rm13StartPlay(g){rm13Stats(g);g.animFrom={...g.ball};g.animAt=performance.now();const m=g.matchModel;m.ballPath=null;}
function rm13FinishPlay(g){if(g.fast)return;rm13BuildTargets(g);}
function rm13PickSide(g){const side=g.poss,controlled=state.clubId===g.home?0:state.clubId===g.away?1:-1;
 return {side,opp:1-side,managed:side===controlled,defending:1-side===controlled,homeSide:controlled};}
rmSimStep=function(g){
 if(g.done||g.pendingPenalty)return;rm13StartPlay(g);g.events++;
 if(g.events>460||g.minute>=80){g.minute=80;rmComplete(g);rm13FinishPlay(g);return;}
 const {side,opp,managed,defending}=rm13PickSide(g),dir=rmDirection(g,side),p=club(side===0?g.home:g.away),q=club(side===0?g.away:g.home);
 const style=managed?g.tactics.attack:'Équilibré',defense=defending?g.tactics.defense:'Glissée',combo=managed?g.tactics.combo:'Automatique',kick=managed?g.tactics.kick:'Territoire';
 const fatigue=.99-rmClamp((g.minute-52)*.0018,0,.048),atk=rmClamp((g.powerBySide?.[side]??p.power)/100*fatigue,.50,.97),def=rmClamp((g.powerBySide?.[opp]??q.power)/100*fatigue,.50,.97);
 const dist=dir===1?100-g.ball.x:g.ball.x,random=rmRand(g);
 const m=g.matchModel,wide=style==='Au large',direct=style==='Au ras',territory=style==='Territoire';
 const possessionStart=g.phase==='Renvoi'||g.phase==='Essai'||g.phase==='Mi-temps'||g.phase==='Renvoi aux 22 m';
 if(possessionStart){g.phase='Attaque';g.phaseCount=0;g.momentum=0;}
 // Conquête : pression, maintien ou contest ; même la relance dépend de la réussite.
 if(g.phase==='Mêlée'||g.phase==='Touche'){
  const scrum=g.phase==='Mêlée',steal=rmRand(g)<rmClamp((scrum?.08:.12)+(def-atk)*.17,.025,.23);
  if(steal){g.stats.setPieceSteals++;g.stats.turnovers++;rmNewPoss(g,opp);rmSay(g,`${scrum?'Mêlée':'Touche'} contestée : conquête adverse`,true);g.phase='Turnover';}
  else if(!scrum&&rmRand(g)<.30){g.stats.mauls++;rmSetBall(g,g.ball.x+dir*rmR(g,2,6),g.ball.y);rmSay(g,'Maul porté : progression des avants');g.phase='Maul';}
  else {g.phase='Libération rapide';rmSay(g,scrum?'Sortie propre du 8, lancement du 9':'Ballon sécurisé en touche, lancement du jeu');}
  rmAdvanceTime(g,rmR(g,.16,.31));rm13FinishPlay(g);return;
 }
 // Arbitrage et en-avant : responsabilité partagée, dépendance à la pression.
 if(random<.029){const attackingFault=rmRand(g)<(.25+(defense==='Montée agressive'?-.05:0));rmPenalty(g,attackingFault?opp:side);rm13FinishPlay(g);return;}
 if(random<.052+(g.phaseCount>6?.006:0)){g.stats.handlingErrors++;rmSay(g,'En-avant sous pression : introduction adverse',true);rmScrum(g,opp);rm13FinishPlay(g);return;}
 const score=g.score[side]-g.score[opp],late=g.minute>65;
 if(late&&dist<34&&score<0&&score>=-3&&rmRand(g)<.047){
  g.stats.kicks++;const good=rmRand(g)<rmClamp(.61+(atk-.73)*.25-(dist-20)*.006,.38,.75);
  if(good){g.score[side]+=3;rmSay(g,'DROP RÉUSSI ! Trois points au pied',true);rmNewPoss(g,opp,50,35);g.phase='Renvoi';}else{rmSay(g,'Tentative de drop manquée — renvoi aux 22 m');rmNewPoss(g,opp,dir>0?78:22,35);g.phase='Renvoi aux 22 m';}
  rmAdvanceTime(g,.4);rm13FinishPlay(g);return;
 }
 // Choix du pied : près de sa ligne ou pour forcer un duel aérien / touche.
 const kicking=rmClamp(.115+(territory?.16:0)+(dist>72?.095:0)+(dist<20?-.085:0)+(kick==='Conservation'?-.07:0)+(kick==='Pression aérienne'?.065:0)+(g.phaseCount>=6?.04:0),.035,.43);
 if(rmRand(g)<kicking){
  g.stats.kicks++;const gain=rmR(g,13,34),x=rmClamp(g.ball.x+dir*gain,2,98),y=rmClamp(g.ball.y+rmR(g,-13,13),7,63),type=rmRand(g);
  m.carrier[side]=9;
  if(type<.3){rmSay(g,`Jeu au pied : touche trouvée après ${Math.round(gain)} mètres`);rmLineout(g,opp,x,g.ball.y<35?4:66);}
  else if(type<.74){const covered=rmRand(g)<rmClamp(.68+(defense==='Couverture'?.10:0)+(def-atk)*.12,.45,.87);
   if(covered){rmNewPoss(g,opp,x,y);rmSay(g,'Fond de terrain replacé : réception et contre-attaque');}
   else{rmSetBall(g,x,y);rmSay(g,'Chasse coordonnée : récupération derrière la ligne');}
   g.phase='Jeu au pied';rmAdvanceTime(g,rmR(g,.34,.6));
  }else{rmNewPoss(g,opp,x,y);rmSay(g,'Coup de pied long : relance adverse sous pression');g.phase='Relance';rmAdvanceTime(g,rmR(g,.29,.5));}
  rm13FinishPlay(g);return;
 }
 // Un temps de jeu peut être long : soutien, attaque d'intervalle, ruck et changement d'axe.
 const passes=rmClamp(1+Math.floor(rmR(g,0,2.9))+(wide?1:0)+(combo==='Passe sautée'?1:0),1,5);
 g.stats.passes+=passes;g.stats.phases++;g.phaseCount++;
 const low=rmRand(g),defensePressure=(defense==='Montée agressive'?.04:defense==='Couverture'?.018:0),spacing=(wide?.015:0)+(combo==='Croisée'?.012:0)+(combo==='Redoublée'?.009:0);
 const breaks=rmClamp(.065+(atk-def)*.33+spacing-defensePressure+(g.momentum>2?.009:0),.018,.20);
 const lineBreak=low<breaks;
 const gain=lineBreak?rmR(g,10,22):rmR(g,-2.2,6.4)+(direct?1.0:wide?1.1:0);
 const x=g.ball.x+dir*gain, y=rmClamp(g.ball.y+rmR(g,-9,9)+(wide?(rmRand(g)>.5?4:-4):0),5,65);
 const name=combo==='Croisée'?'croisée 10–12':combo==='Redoublée'?'redoublée':combo==='Passe sautée'?'passe sautée':direct?'départ au près':wide?'séquence vers l’aile':'jeu en continuité';
 m.carrier[side]=rmPick(g,direct?[0,5,6,7,8]:wide?[10,11,12,13]:[6,8,9,10,11,12]);m.ballPath=passes>=2?{curve:rmR(g,-8,8),passes}:null;
 g.stats.tackles+=lineBreak?Math.floor(rmR(g,0,2)):1+(rmRand(g)<.38?1:0);
 g.stats.meters+=Math.max(0,gain);if(lineBreak)g.stats.lineBreaks++;
 if((dir===1&&x>=99)||(dir===-1&&x<=1)){rmTry(g,side);rm13FinishPlay(g);return;}
 rmSetBall(g,x,y);
 if(lineBreak){g.momentum=rmClamp(g.momentum+1.4,-3,5);g.phase='Percée';rmSay(g,`FRANCHISSEMENT ! ${p.name}, ${Math.round(gain)} m en ${name}`,true);}
 else{g.momentum=rmClamp(g.momentum+(gain>3?.35:-.2),-3,5);g.phase='Contact';rmSay(g,`${g.phaseCount}e temps · ${name} · ${gain>=0?'+':''}${Math.round(gain)} m`);}
 const contest=rmClamp(.042+(def-atk)*.19+(g.phaseCount>7?.03:0)+(defense==='Montée agressive'?.018:0)+(gain<0?.02:0),.015,.155);
 if(rmRand(g)<contest){g.stats.turnovers++;rmNewPoss(g,opp);g.phase='Turnover';rmSay(g,'Contre-ruck : ballon récupéré par la défense',true);g.momentum=0;}
 else if(rmRand(g)<.79){g.stats.rucks++;g.phase='Ruck';if(g.phaseCount%3===0)rmSay(g,'Soutien au sol — sortie rapide du demi de mêlée');}
 else{g.phase='Libération rapide';}
 // Les temps de jeu sont bornés; repli/replacement défensif mais aucune possession magique.
 if(g.phaseCount>9&&g.phase==='Ruck'&&rmRand(g)<.26){g.stats.turnovers++;rmNewPoss(g,opp);g.phase='Turnover';rmSay(g,'Grattage au neuvième temps, récupération défensive');}
 rmAdvanceTime(g,rmR(g,.26,.54));rm13FinishPlay(g);
};
function rm13DrawPlayers(g,ctx,X,Y,col0,col1){
 rm13Stats(g);const model=g.matchModel;
 if(!model.targets)rm13BuildTargets(g);
 const duration=rmClamp(800/Math.max(1,g.speed||1),180,850),time=rmClamp((performance.now()-model.phaseStart)/duration,0,1),t=time*time*(3-2*time);
 function getPos(s,i){const a=model.from?.[s]?.[i]||model.targets[s][i],b=model.targets[s][i];return{x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};}
 const carrier=model.carrier[g.poss]??9;
 // Lignes défensives et appuis espacés : lisibilité tactique plutôt que 30 marqueurs téléportés.
 for(let s=0;s<2;s++){
  ctx.save();ctx.strokeStyle=s===0?'#a6d0ee55':'#f8b8a855';ctx.lineWidth=1.4;ctx.setLineDash([4,8]);ctx.beginPath();
  for(let k=0;k<6;k++){const po=getPos(s,9+k);if(k===0)ctx.moveTo(X(po.x),Y(po.y));else ctx.lineTo(X(po.x),Y(po.y));}ctx.stroke();ctx.restore();
 }
 for(let s=0;s<2;s++)for(let i=0;i<15;i++){
  const po=getPos(s,i),px=X(po.x),py=Y(po.y),forward=rmDirection(g,s),active=s===g.poss&&i===carrier;
  ctx.save();ctx.translate(px,py);ctx.rotate(forward>0?0:Math.PI);
  // petite silhouette vue du dessus : tronc, épaules, bras, jambes, numéro
  ctx.fillStyle='#09131a';ctx.beginPath();ctx.ellipse(0,0,9.3,12,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#111827';ctx.lineWidth=3.4;const stride=Math.sin(performance.now()/150+i*1.3)*2.2*t;
  ctx.beginPath();ctx.moveTo(-2,-3);ctx.lineTo(-5+stride,9);ctx.moveTo(2,-3);ctx.lineTo(5-stride,9);ctx.stroke();
  ctx.fillStyle=s===0?col0:col1;ctx.beginPath();ctx.ellipse(0,-2,8.5,9.5,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#f3f4f7';ctx.lineWidth=1.4;ctx.stroke();ctx.fillStyle='#17212d';ctx.beginPath();ctx.arc(0,-9,3.4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#0f1520';ctx.font='bold 9px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.rotate(forward>0?0:-Math.PI);ctx.fillText(i+1,0,-1);
  if(active){ctx.strokeStyle='#ffde76';ctx.lineWidth=2.3;ctx.beginPath();ctx.arc(0,-2,13,0,Math.PI*2);ctx.stroke();}
  ctx.restore();
 }
 // Ballon suivi : support par la ligne, ellipse sur le porteur.
 const ballFrom=g.animFrom||g.ball;
 let bx=ballFrom.x+(g.ball.x-ballFrom.x)*t,by=ballFrom.y+(g.ball.y-ballFrom.y)*t;
 if(model.ballPath){by+=Math.sin(t*Math.PI)*(model.ballPath.curve||0)*.55;}
 ctx.save();ctx.translate(X(bx),Y(by));ctx.fillStyle='#fff5d7';ctx.shadowColor='#f9c66e';ctx.shadowBlur=11;
 ctx.beginPath();ctx.ellipse(0,0,7.8,4.6,-.25,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#332b24';ctx.lineWidth=1.2;ctx.stroke();ctx.restore();
}
// Vue d'ensemble plus informative : territoire, franchissements, grattages et mètre parcouru.
const rm13OldMarkup=rmSimpleMarkup;
rmSimpleMarkup=function(g){rm13Stats(g);let html=rm13OldMarkup(g);
 html=html.replace('Match tactique 2D','Match 2D · continuité');
 html=html.replace('<canvas id="rmcanvas" width="1100" height="545" aria-label="Terrain de rugby avec en-buts, poteaux, lignes et 30 joueurs"></canvas>', '<div class="rm13-viewport"><canvas id="rmcanvas" width="1100" height="545" aria-label="Terrain de rugby avec en-buts, poteaux, lignes et 30 joueurs"></canvas></div>');
 html=html.replace('<div class="rm-actions">','<div class="rm-actions"><button id="rm13Camera" type="button">🔍 Vue TV</button>');
 html=html.replace('<div class="rm-two">','<div class="rm13-match-strip"><span>⚡ Franchissements <b id="rm13break">0</b></span><span>⇄ Turnovers <b id="rm13turn">0</b></span><span>↗ Mètres gagnés <b id="rm13meters">0</b></span><span>⚑ Pénalités <b id="rm13pen">0</b></span><span>🏉 Mêlées / touches <b id="rm13set">0 / 0</b></span></div><div class="rm-two">');
 html=html.replace('Mode volontairement simplifié : les actions sont simulées par temps de jeu, puis représentées tactiquement.', 'Moteur de phases tactiques avec soutien, conquête, grattages, territoire et mouvements continus de 30 joueurs entre les décisions ; pas de simulation biomécanique ni de physique individuelle.');
 return html;
};
function rm13ApplyCamera(g){
 const el=document.getElementById('rmcanvas'),frame=document.querySelector('.rm13-viewport');if(!el||!frame)return;
 const isMobile=window.innerWidth<=760;
 if(!g.rmCamera)g.rmCamera=isMobile?'follow':'full';
 const zoomed=g.rmCamera==='follow',w=frame.clientWidth;
 if(!w)return;
 const canvasWidth=zoomed?w*(isMobile?2.25:1.52):w;
 el.style.width=Math.round(canvasWidth)+'px';el.style.maxWidth='none';
 const xPx=75+(g.ball.x+10)*7.85;
 const pos=xPx/1100*canvasWidth;
 const offset=zoomed?rmClamp(w/2-pos,w-canvasWidth,0):0;
 el.style.marginLeft=Math.round(offset)+'px';
 const btn=document.getElementById('rm13Camera');if(btn)btn.textContent=zoomed?'▦ Terrain entier':'🔍 Vue TV';
}
const rm13OldAttach=rmAttachSimple;
rmAttachSimple=function(){rm13OldAttach();const b=document.getElementById('rm13Camera');if(b)b.onclick=()=>{rmSimple.rmCamera=rmSimple.rmCamera==='follow'?'full':'follow';rm13ApplyCamera(rmSimple);rmStore();};};
const rm13OldDraw=rmDrawEverything;
rmDrawEverything=function(){rm13OldDraw();const g=rmSimple;if(!g||!document.getElementById('rmplay'))return;rm13ApplyCamera(g);
 const values={rm13break:g.stats.lineBreaks||0,rm13turn:g.stats.turnovers||0,rm13meters:Math.round(g.stats.meters||0),rm13pen:g.stats.penalties||0,rm13set:`${g.stats.scrums||0} / ${g.stats.lineouts||0}`};for(const [key,v] of Object.entries(values)){const el=document.getElementById(key);if(el)el.textContent=v;}
};
window.RM27_MATCH_13={model:'tactical-continuity-1',step:rmSimStep,draw:rm13DrawPlayers,stats:rm13Stats};

