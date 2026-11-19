/* Rugby Manager 27 — Edition Jouable: conservative event-driven match engine.
 * No CDN, no login, no reliance on old physics engine. Original management data and career unchanged.
 * This is an intentionally simplified tactical illustration, not a continuous physical rugby simulation.
 */
'use strict';
const RM_SIMPLE_KEY='rm27-simple-match-v4';
let rmSimple=null, rmSimpleTimer=null, rmSimpleRAF=null, rmShowFrame=0;
const rmClamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function rmSeed(str){let v=2166136261;for(const c of String(str)){v=Math.imul(v^c.charCodeAt(),16777619)}return v>>>0;}
function rmRand(g){let x=g.rng>>>0;x^=x<<13;x^=x>>>17;x^=x<<5;g.rng=x>>>0;return (g.rng>>>0)/4294967296;}
function rmR(g,a,b){return a+(b-a)*rmRand(g)};
function rmPick(g,arr){return arr[Math.floor(rmRand(g)*arr.length)]};
function rmDirection(g,side=g.poss){return(side===0?1:-1)*(g.minute<40?1:-1)};
function rmAdvanceTime(g,delta){g.minute=Math.min(80,g.minute+delta); if(!g.halftime&&g.minute>=40){g.minute=40;g.halftime=true;g.poss=1-(Number.isInteger(g.kickOffSide)?g.kickOffSide:(rmSeed('jouable-v4-'+g.id)%2));g.ball={x:50,y:35};g.phase='Mi-temps';rmSay(g,'MI-TEMPS — changement de côté',true);g.phaseCount=0;return true;}if(g.minute>=80){g.minute=80;rmComplete(g)}return false;}
function rmSay(g,text,important=false){g.last=text;g.log.unshift({minute:g.minute.toFixed(1),text,important});if(g.log.length>100)g.log.length=100;}
function rmTacticAttack(){
 const style=state.tactics?.style;
 if(style==='Jeu au large'||style==='Au large')return 'Au large';
 if(style==='Jeu direct'||style==='Au ras')return 'Au ras';
 if(style==='Conservation')return 'Au ras';
 if(style==='Territoire'||state.tactics?.kick==='Long')return 'Territoire';
 return 'Équilibré';
}
function rmTacticDefense(){const defense=state.tactics?.defense;return defense==='Attentiste'?'Couverture':['Glissée','Montée agressive','Couverture'].includes(defense)?defense:'Glissée'}
function rmTacticCombo(){const p=state.tactics?.playbook;return ({'Croisée 10–12':'Croisée','15 dans la ligne':'Redoublée','Leurre puis large':'Passe sautée','Surnombre extérieur':'Passe sautée'})[p]||'Automatique'}
// Squad depth is still managed normally; only 15 starters influence on-pitch power.
// Use the same lineup chosen in Career and modest staff bonuses. These are gameplay ratings,
// not statements about the real performance of identifiable players.
function rmEffectiveStrength(id){
 const base=club(id)?.power||70, active=id===state.clubId;
 if(!active)return rmClamp(base,50,96);
 let starters=[];try{starters=lineup(id).slice(0,15)}catch(e){return rmClamp(base,50,96)}
 const average=starters.reduce((sum,p)=>sum+(Number.isFinite(p.skill)?p.skill:attr(p)),0)/Math.max(1,starters.length);
 const staff=rmClamp((staffEffect(id,'Attaque')+staffEffect(id,'Défense')+staffEffect(id,'Conquête'))*.28,0,2.0);
 return rmClamp(Math.round((base+(average-base)*.52+staff)*10)/10,50,96);
}
function rmInit(f){const kickOffSide=rmSeed('jouable-v4-'+f.id)%2;return {id:f.id,home:f.home,away:f.away,league:club(f.home).league,minute:0,halftime:false,kickOffSide,powerBySide:[rmEffectiveStrength(f.home),rmEffectiveStrength(f.away)],score:[0,0],tries:[0,0],poss:kickOffSide,ball:{x:50,y:35},phase:'Renvoi',last:'Coup d’envoi',phaseCount:0,rng:rmSeed('jouable-v4-'+f.id),tactics:{attack:rmTacticAttack(),defense:rmTacticDefense(),combo:rmTacticCombo(),kick:state.tactics?.kick||'Territoire',shape:state.tactics?.shape||'1-3-3-1'},stats:{rucks:0,tackles:0,passes:0,kicks:0,lineouts:0,scrums:0,penalties:0,mauls:0,turnovers:0},log:[],paused:true,speed:1,pendingPenalty:null,done:false,events:0,visuals:null};}
function rmStore(){if(!rmSimple||rmSimple.done)return;try{localStorage.setItem(RM_SIMPLE_KEY,JSON.stringify({...rmSimple,paused:true}))}catch(e){console.warn('Sauvegarde de match',e)}}
function rmClearStore(){try{localStorage.removeItem(RM_SIMPLE_KEY)}catch(e){}}
function rmReadStore(f){try{const a=JSON.parse(localStorage.getItem(RM_SIMPLE_KEY)||'null');if(a?.id===f.id&&a.home===f.home&&a.away===f.away&&!a.done&&a.ball&&Number.isFinite(a.minute)&&a.minute>=0&&a.minute<=80&&Array.isArray(a.score)&&a.score.length===2&&a.score.every(x=>Number.isFinite(x)&&x>=0)&&a.rng&&a.tactics&&a.stats&&Array.isArray(a.log))return {...a,paused:true,kickOffSide:Number.isInteger(a.kickOffSide)?a.kickOffSide:(rmSeed('jouable-v4-'+a.id)%2),powerBySide:Array.isArray(a.powerBySide)&&a.powerBySide.length===2&&a.powerBySide.every(x=>Number.isFinite(x)&&x>=40&&x<=100)?a.powerBySide:[club(a.home).power,club(a.away).power]}}catch(e){}return null;}
function rmFixtureScore(g){return {home:g.score[0],away:g.score[1],homeTries:g.tries[0],awayTries:g.tries[1],events:g.stats,sim:'RM27-jouable-simple-v4',seed:rmSeed('jouable-v4-'+g.id)};}
function rmComplete(g){if(g.done)return;g.done=true;g.pendingPenalty=null;g.paused=true;rmStopTimer();rmSay(g,'FIN DU MATCH — résultat enregistré',true);const f=getFixtures(g.league).find(x=>x.id===g.id);if(!g.fast&&f&&!f.result){const r=rmFixtureScore(g);f.result=r;state.past.push({home:club(g.home).name,away:club(g.away).name,result:r,at:new Date().toISOString()});}if(!g.fast){rmClearStore();save();}}
function rmStopTimer(){if(rmSimpleTimer){clearInterval(rmSimpleTimer);rmSimpleTimer=null}}
function rmGoCareer(){rmStopTimer();cancelAnimationFrame(rmSimpleRAF);rmSimpleRAF=null;rmSimple=null;state.page='accueil';menuOpen=false;render();}
function rmSetBall(g,x,y){g.ball.x=rmClamp(x,1,99);g.ball.y=rmClamp(y,5,65)}
function rmBreak(g,kind,msg,delta=.6){g.phase=kind;g.phaseCount=0;rmSay(g,msg,true);return rmAdvanceTime(g,delta)}
function rmNewPoss(g,side,x=g.ball.x,y=g.ball.y){g.poss=side;rmSetBall(g,x,y);g.phaseCount=0;}
function rmTry(g,side){g.score[side]+=5;g.tries[side]++;const converted=rmRand(g)<rmClamp(.70+((g.powerBySide?.[side]??club(side===0?g.home:g.away).power)-70)*.005,.54,.83);if(converted)g.score[side]+=2;rmSay(g,`ESSAI ${club(side===0?g.home:g.away).name} ! ${converted?'Transformation réussie.':'Transformation manquée.'}`,true);g.phase='Essai';g.phaseCount=0;g.poss=1-side;g.ball={x:50,y:35};rmAdvanceTime(g,.95);}
function rmLineout(g,side,x,y){g.stats.lineouts++;g.phase='Touche';rmNewPoss(g,side,x,y<35?6:64);rmSay(g,`Touche pour ${club(side===0?g.home:g.away).name} — alignement et lancer`,true);rmAdvanceTime(g,rmR(g,.40,.75));}
function rmScrum(g,side){g.stats.scrums++;g.phase='Mêlée';rmNewPoss(g,side);rmSay(g,`Mêlée pour ${club(side===0?g.home:g.away).name} — introduction et sortie du 9`,true);rmAdvanceTime(g,rmR(g,.35,.7));}
function rmPenalty(g,side){g.stats.penalties++;g.phase='Pénalité';g.phaseCount=0;g.poss=side;const userSide=g.home===state.clubId?0:g.away===state.clubId?1:-1;
 if(userSide===side&&!g.fast){g.pendingPenalty={side};g.paused=true;rmStopTimer();rmSay(g,'Pénalité : choisis les 3 points, la touche, la mêlée ou jouer à la main',true);return;}
 rmTakePenalty(g,rmAIPenalty(g,side));}
function rmAIPenalty(g,side){const d=rmDirection(g,side),dist=d>0?100-g.ball.x:g.ball.x;const diff=g.score[side]-g.score[1-side];if(dist<44&&(g.minute>63&&diff<0&&diff>=-3||rmRand(g)<.53))return'points';if(dist<32&&rmRand(g)<.73)return'touch';if(dist<12&&rmRand(g)<.25)return'scrum';return rmRand(g)<.67?'touch':'hand';}
function rmTakePenalty(g,option){const askManager=!!g.pendingPenalty;const side=g.pendingPenalty?.side??g.poss;g.pendingPenalty=null;const dir=rmDirection(g,side),dist=dir>0?100-g.ball.x:g.ball.x;
 if(option==='points'){const success=dist<=63&&rmRand(g)<rmClamp(.96-dist*.008,.36,.88);rmSay(g,`Pénalité tentée à ${Math.round(dist)} m : ${success?'3 points !':'à côté !'}`,true);if(success){g.score[side]+=3;g.poss=1-side;g.ball={x:50,y:35};g.phase='Renvoi'}else{rmNewPoss(g,1-side,dir>0?78:22,35);g.phase='Renvoi aux 22 m'}rmAdvanceTime(g,rmR(g,.45,.8));}
 else if(option==='touch'){const progress=rmClamp(rmR(g,19,33),12,Math.max(12,dist-5));rmLineout(g,side,g.ball.x+dir*progress,g.ball.y<35?6:64);}
 else if(option==='scrum'){rmScrum(g,side)}
 else{g.phase='Jeu à la main';g.phaseCount=0;rmSay(g,'Pénalité jouée à la main — les défenseurs reculent de 10 mètres',true);rmAdvanceTime(g,.19)}
 if(askManager&&!g.fast){g.paused=true;rmStore();rmDrawEverything();}}
function rmSimStep(g){if(g.done||g.pendingPenalty)return;g.animFrom={...g.ball};g.animAt=performance.now();g.events++;if(g.events>420){g.minute=80;rmComplete(g);return}if(g.minute>=80){rmComplete(g);return}
 const side=g.poss,dir=rmDirection(g,side),sClub=club(side===0?g.home:g.away),oClub=club(side===0?g.away:g.home);
 const userSide=g.home===state.clubId?0:g.away===state.clubId?1:-1,managed=side===userSide,defending=1-side===userSide;
 const style=managed?g.tactics.attack:'Équilibré',defStyle=defending?g.tactics.defense:'Glissée',comb=managed?g.tactics.combo:'Automatique',kickPlan=managed?(g.tactics.kick||'Territoire'):'Territoire',shape=managed?(g.tactics.shape||'1-3-3-1'):'1-3-3-1';
 const attackSkill=rmClamp((g.powerBySide?.[side]??sClub.power??72)/100,.55,.91),defenceSkill=rmClamp((g.powerBySide?.[1-side]??oClub.power??72)/100,.55,.91);
 const pressure=rmRand(g),dist=dir>0?100-g.ball.x:g.ball.x;
 const opts={wide:style==='Au large',forward:style==='Au ras',kick:style==='Territoire',mixed:style==='Équilibré'};
 // Rugby phases: decisions first, execution second. No artificial offloads across the pitch.
 if(g.phase==='Mi-temps'||g.phase==='Essai'||g.phase==='Renvoi'||g.phase==='Renvoi aux 22 m')g.phase='Attaque';
 if(rmRand(g)<.043){rmPenalty(g,side);rmDrawEverything();return;}
 if(rmRand(g)<.035+(pressure>.89?.035:0)){rmSay(g,'En-avant à la réception : mêlée adverse');rmScrum(g,1-side);rmDrawEverything();return;}
 const kickChance=rmClamp(.13+(opts.kick?.15:0)+(dist>68?.06:0)+(dist<15?-.10:0)+(pressure>.87?.07:0)+(kickPlan==='Conservation'?-.055:0)+(kickPlan==='Pression aérienne'?.035:0),.03,.4);
 if(rmRand(g)<kickChance){g.stats.kicks++;g.phase='Jeu au pied';const oldX=g.ball.x;const gain=rmR(g,14,35),target=rmClamp(oldX+dir*gain,2,98);const covered=rmRand(g)<rmClamp(.63+(defStyle==='Couverture'?.07:0),.4,.85);
 if(rmRand(g)<.52){const newside=1-side;rmSay(g,`Coup de pied d'occupation — sortie en touche après ${Math.round(gain)} m`);rmLineout(g,newside,target,g.ball.y<35?5:65);}
 else if(covered){rmNewPoss(g,1-side,target,rmR(g,17,53));rmSay(g,'Réception du fond de terrain — relance adverse');rmAdvanceTime(g,rmR(g,.33,.58));}
 else{rmSetBall(g,target,rmR(g,20,50));rmSay(g,'Coup de pied à suivre — récupération du poursuivant');rmAdvanceTime(g,rmR(g,.26,.48))}rmDrawEverything();return;}
 let count=1+Math.floor(rmR(g,0,2))+(opts.wide||comb==='Passe sautée'||shape==='2-4-2'?1:0);count=rmClamp(count,1,4);g.stats.passes+=count;
 const passName=comb==='Croisée'?'croisée':comb==='Passe sautée'?'passe sautée':comb==='Redoublée'?'redoublée':comb==='Jeu au ras'?'départ du 8':opts.wide?'jeu au large':opts.forward?'pick and go':'attaque placée';
 const defensiveFactor=(defStyle==='Montée agressive'?.08:0)+(defStyle==='Couverture'?.04:0);
 const breakChance=rmClamp(.05+(attackSkill-defenceSkill)*.22+(opts.wide?.035:0)+(passName==='croisée'?.02:0)-defensiveFactor,.03,.16);
 const lineBreak=rmRand(g)<breakChance;
 const gain=lineBreak?rmR(g,12,29):rmR(g,-1,7)+(opts.forward?1.6:0)+(opts.wide?1.4:0);
 const to=g.ball.x+dir*gain;g.phaseCount++;
 const tackleCount=lineBreak?Math.floor(rmR(g,0,2)):1+(pressure>.74?1:0);
 g.stats.tackles+=tackleCount;
 if((dir===1&&to>=99)||(dir===-1&&to<=1)){rmTry(g,side);rmDrawEverything();return}
 rmSetBall(g,to,rmClamp(g.ball.y+rmR(g,-12,12)+(opts.wide?(rmRand(g)<.5?-3:3):0),6,64));
 g.phase=lineBreak?'Percée':'Temps de jeu';
 if(lineBreak)rmSay(g,`Percée de ${sClub.name} ! ${Math.round(gain)} mètres gagnés.`);
 else if(g.phaseCount%3===0)rmSay(g,`Temps ${g.phaseCount} — ${passName}, ${Math.round(gain)} m`);
 else rmSay(g,`${count} passe${count>1?'s':''} — ${passName} · ${Math.round(gain)} m`);
 const lost=rmRand(g)<rmClamp(.02+(defenceSkill-attackSkill)*.15+(g.phaseCount>6?.018:0),.012,.095);
 const rucked=rmRand(g)<.59+(opts.forward?.09:0);
 if(lost){g.stats.turnovers++;rmNewPoss(g,1-side);rmSay(g,'Ballon contesté — grattage défensif',true);g.phase='Turnover';}
 else if(rucked){g.stats.rucks++;g.phase='Ruck';if(rmRand(g)<.02)rmSay(g,'Ruck sécurisé, sortie du numéro 9');}
 else{g.phase='Libération rapide';}
 if(g.phaseCount>7&&rmRand(g)<.25){rmNewPoss(g,1-side);g.phase='Turnover';rmSay(g,'Ballon récupéré après plusieurs temps de jeu');g.stats.turnovers++;}
 rmAdvanceTime(g,rmR(g,.24,.53));rmDrawEverything();}
function rmSimpleSimulateFixture(f){const g=rmInit(f);g.fast=true;let n=0;while(!g.done&&n++<460){if(g.pendingPenalty)rmTakePenalty(g,rmAIPenalty(g,g.poss));rmSimStep(g)}return rmFixtureScore(g);}
function startSimpleMatch(f){if(!f)return toast('Aucun match disponible');if(f.result)return toast('Match déjà joué');cancelAnimationFrame(animation);animation=null;match=null;rmStopTimer();if(rmSimpleRAF!==null)cancelAnimationFrame(rmSimpleRAF);rmSimpleRAF=null;menuOpen=false;
 const resume=rmReadStore(f);rmSimple=resume||rmInit(f);rmSimple.paused=true;rmSimple.speed=1;rmSimple.fast=false;rmSimple.visuals=null;
 document.getElementById('app').innerHTML=rmSimpleMarkup(rmSimple);rmAttachSimple();rmDrawEverything();rmLoopAnimation();rmStore();}
function rmSimpleMarkup(g){const h=club(g.home),a=club(g.away),homeColor=h.color||'#f8f8f8',awayColor=a.color||'#e14b55';return `<div class="rmplay" id="rmplay">
<div class="rm-head"><div><div class="rm-eyebrow">RUGBY MANAGER 27 · ÉDITION JOUABLE</div><h1>Match tactique 2D <span class="rm-small">Saison ${Number.isInteger(state.rmSeason)?state.rmSeason:1} · ${esc(league(g.league)?.name||'Championnat')}</span></h1></div><button id="rmBack">← Carrière</button></div>
<div class="rm-score"><div class="rm-team"><i class="rm-kit" style="background:${homeColor}"></i><span>${esc(h.name)}</span></div><div><div class="rm-score-num"><span id="rmh">0</span><span style="color:#607588"> – </span><span id="rma">0</span></div><div class="rm-clock" id="rmt">00:00 · 1re mi-temps</div></div><div class="rm-team away"><span>${esc(a.name)}</span><i class="rm-kit" style="background:${awayColor}"></i></div></div>
<div class="rm-pitch-wrap"><canvas id="rmcanvas" width="1100" height="545" aria-label="Terrain de rugby avec en-buts, poteaux, lignes et 30 joueurs"></canvas><div class="rm-caption"><span class="rm-live" id="rmPhase">🏉 Renvoi</span><span class="rm-explain" id="rmLast">Le match commence</span></div></div>
<div class="rm-actions"><button class="primary" id="rmRun">▶ Jouer</button><button id="rmStep">⏭ Action suivante</button><button id="rmFinish">⏩ Simuler la fin</button><div class="spacer"></div><label class="rm-small" for="rmSpeed">Vitesse <select id="rmSpeed"><option value="1">×1</option><option value="2">×2</option><option value="4">×4</option></select></label><button id="rmExport">Exporter le match</button></div>
<div class="rm-two"><section class="rm-panel"><h2>🧠 Mes consignes (modifiables pendant le match)</h2><div class="rm-tactics"><label>Plan offensif<select id="rmAttack"><option>Équilibré</option><option>Au large</option><option>Au ras</option><option>Territoire</option></select></label><label>Défense<select id="rmDefense"><option>Glissée</option><option>Montée agressive</option><option>Couverture</option></select></label><label>Combinaison<select id="rmCombo"><option>Automatique</option><option>Croisée</option><option>Passe sautée</option><option>Redoublée</option><option>Jeu au ras</option></select></label></div><div class="rm-stats"><div class="rm-stat"><b id="rmrucks">0</b><span>Rucks</span></div><div class="rm-stat"><b id="rmtackles">0</b><span>Plaquages</span></div><div class="rm-stat"><b id="rmpasses">0</b><span>Passes</span></div><div class="rm-stat"><b id="rmkicks">0</b><span>Jeu au pied</span></div></div></section><section class="rm-panel"><h2>🎙️ Direct — événements du match</h2><div class="rm-log" id="rmLog" aria-live="polite"></div></section></div>
<p class="rm-footnote"><strong>Préparation sportive :</strong> force simulée au coup d'envoi ${g.powerBySide?.[0]??club(g.home).power} / 100 – ${g.powerBySide?.[1]??club(g.away).power} / 100. La composition et les responsabilités attribuées au staff influencent légèrement la simulation, sans garantir une victoire. <br class="rm-break">Mode volontairement simplifié : les actions sont simulées par temps de jeu, puis représentées tactiquement. Les mêlées, touches et penalties sont visibles ; ce n'est pas une simulation physique 30 joueurs. Carrière enregistrée localement et exportable depuis le tableau de bord.</p><div id="rmPopup"></div></div>`;}
function rmAttachSimple(){document.getElementById('rmBack').onclick=()=>{rmStore();rmGoCareer()};document.getElementById('rmStep').onclick=()=>{rmSimple.paused=true;rmStopTimer();rmSimStep(rmSimple);rmStore();rmDrawEverything()};document.getElementById('rmRun').onclick=()=>{const g=rmSimple;if(g.done){rmGoCareer();return;}g.paused=!g.paused;if(!g.paused)rmStartTimer();else{rmStopTimer();rmStore()}rmDrawEverything()};document.getElementById('rmFinish').onclick=()=>{const g=rmSimple;if(!g||g.done)return;g.paused=true;rmStopTimer();for(let n=0;n<480&&!g.done;n++){if(g.pendingPenalty)rmTakePenalty(g,rmAIPenalty(g,g.pendingPenalty.side));rmSimStep(g);}rmDrawEverything()};document.getElementById('rmExport').onclick=()=>{const payload=JSON.stringify({match:'Rugby Manager 27 — Édition Jouable',teams:[club(rmSimple.home).name,club(rmSimple.away).name],clock:rmSimple.minute,score:rmSimple.score,stats:rmSimple.stats,log:rmSimple.log},null,2);const blob=new Blob([payload],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='RM27-match-'+rmSimple.id+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)};
for(const [id,key] of [['rmAttack','attack'],['rmDefense','defense'],['rmCombo','combo']]){const el=document.getElementById(id);if(![...el.options].some(x=>x.value===rmSimple.tactics[key]))rmSimple.tactics[key]=el.options[0].value;el.value=rmSimple.tactics[key];el.onchange=()=>{rmSimple.tactics[key]=el.value;rmSay(rmSimple,'Consigne modifiée : '+el.value);rmStore();rmDrawEverything()}}document.getElementById('rmSpeed').onchange=e=>{rmSimple.speed=+e.target.value;if(!rmSimple.paused)rmStartTimer()};}
function rmStartTimer(){rmStopTimer();if(!rmSimple||rmSimple.done)return;rmSimpleTimer=setInterval(()=>{if(!rmSimple||rmSimple.paused||rmSimple.done){rmStopTimer();return;}rmSimStep(rmSimple);rmStore();rmDrawEverything();},820/Math.max(1,rmSimple.speed));rmDrawEverything()}
function rmLoopAnimation(){if(!document.getElementById('rmcanvas')||!rmSimple)return;rmShowFrame++;if(rmShowFrame%3===0)rmDrawPitch(rmSimple);rmSimpleRAF=requestAnimationFrame(rmLoopAnimation)}
function rmDrawEverything(){const g=rmSimple;if(!g||!document.getElementById('rmplay'))return;document.getElementById('rmh').textContent=g.score[0];document.getElementById('rma').textContent=g.score[1];document.getElementById('rmt').textContent=`${String(Math.floor(g.minute)).padStart(2,'0')}:${String(Math.floor((g.minute%1)*60)).padStart(2,'0')} · ${g.minute<40?'1re':'2e'} mi-temps`;
 document.getElementById('rmPhase').textContent=`🏉 ${g.phase} · ${club(g.poss===0?g.home:g.away).name}`;document.getElementById('rmLast').textContent=g.last;document.getElementById('rmRun').textContent=g.done?'← Continuer ma carrière':g.paused?'▶ Jouer':'⏸ Pause';document.getElementById('rmStep').disabled=g.done||!!g.pendingPenalty;document.getElementById('rmFinish').disabled=g.done;
 for(const k of ['rucks','tackles','passes','kicks'])document.getElementById('rm'+k).textContent=g.stats[k];document.getElementById('rmLog').innerHTML=g.log.slice(0,14).map(x=>`<div class="rm-log-row"><b>${x.minute}'</b><span>${esc(x.text)}</span></div>`).join('')||'<div class="rm-small">Coup d’envoi à venir</div>';
 const popup=document.getElementById('rmPopup');if(g.pendingPenalty){popup.innerHTML=`<div class="rm-modal"><div class="rm-dialog"><div class="rm-eyebrow">DÉCISION DU MANAGER</div><h2>Pénalité pour ton équipe</h2><p>Quelle option choisis-tu ? La défense se replace à 10 mètres avant la reprise.</p><div class="rm-choice-grid"><button data-penalty="points">🎯 Tenter les 3 points</button><button data-penalty="touch">↗ Trouver la touche</button><button data-penalty="scrum">⬡ Demander mêlée</button><button data-penalty="hand">▶ Jouer à la main</button></div></div></div>`;popup.querySelectorAll('[data-penalty]').forEach(b=>b.onclick=()=>{rmTakePenalty(g,b.dataset.penalty);rmDrawEverything()});}
 else if(g.done)popup.innerHTML=`<div class="rm-modal"><div class="rm-dialog"><div class="rm-eyebrow">FIN DE RENCONTRE</div><h2>${esc(club(g.home).name)} ${g.score[0]}–${g.score[1]} ${esc(club(g.away).name)}</h2><p>${g.tries[0]} essai(s) à ${g.tries[1]} · ${g.stats.rucks} rucks · ${g.stats.lineouts} touches · ${g.stats.scrums} mêlées</p><p>Le résultat est sauvegardé dans la carrière et intégré au classement.</p><button class="primary rm-final" id="rmContinue">Continuer ma carrière →</button></div></div>`;
 else popup.innerHTML='';document.getElementById('rmContinue')?.addEventListener('click',rmGoCareer);rmDrawPitch(g);}
function rmDrawPitch(g){const c=document.getElementById('rmcanvas');if(!c||!g)return;const xctx=c.getContext('2d');if(!xctx)return;const W=c.width,H=c.height;
 const X=v=>75+(v+10)*7.85,Y=v=>84+v*5.45;const col0=club(g.home)?.color||'#eeeeee',col1=club(g.away)?.color||'#d12435';
 xctx.clearRect(0,0,W,H);xctx.fillStyle='#0c1b23';xctx.fillRect(0,0,W,H);
 // Stands and minimal spectators (static, no excessive particles)
 for(const [sy,dy] of [[8,0],[480,0]]){xctx.fillStyle='#213040';xctx.fillRect(40,sy,W-80,54);for(let row=0;row<3;row++){for(let i=0;i<112;i++){const seed=(i*13+row*17)%9;xctx.fillStyle=['#afc4ba','#7f8e9c','#d3bca3','#4a7183'][seed%4];xctx.fillRect(54+i*8.6,sy+10+row*13,3.5,5)}}}
 const py=Y(0),bh=70*5.45,left=X(-10),right=X(110);xctx.fillStyle='#267346';xctx.fillRect(left,py,right-left,bh);for(let q=0;q<12;q++){xctx.fillStyle=q%2===0?'#ffffff09':'#00000006';xctx.fillRect(left+q*((right-left)/12),py,(right-left)/12,bh)}
 xctx.fillStyle='#1a8b6e';xctx.fillRect(left,py,X(0)-left,bh);xctx.fillRect(X(100),py,right-X(100),bh);
 xctx.strokeStyle='#f3fbf4';xctx.lineWidth=2;xctx.strokeRect(left,py,right-left,bh);
 for(const px of [0,22,50,78,100]){xctx.lineWidth=px===0||px===100?3:2;xctx.beginPath();xctx.moveTo(X(px),py);xctx.lineTo(X(px),py+bh);xctx.stroke()}
 xctx.setLineDash([9,8]);xctx.lineWidth=1.4;xctx.beginPath();for(const px of [10,90]){xctx.moveTo(X(px),py);xctx.lineTo(X(px),py+bh)}xctx.stroke();xctx.setLineDash([]);
 for(const pyM of [5,15,55,65]){for(const pxM of [5,22,40,60,78,95]){xctx.fillStyle='#f2fcf2';xctx.fillRect(X(pxM)-1.2,Y(pyM)-4,2.4,8)}}
 xctx.font='11px system-ui';xctx.fillStyle='#f0f9f6b7';xctx.textAlign='center';for(const [xx,l] of [[0,'EN-BUT'],[22,'22'],[50,'50'],[78,'22'],[100,'EN-BUT']])xctx.fillText(l,X(xx),py-8);
 for(const px2 of [0,100]){xctx.lineWidth=3;xctx.strokeStyle='#fae7ad';xctx.beginPath();xctx.moveTo(X(px2),Y(31));xctx.lineTo(X(px2),Y(39));xctx.stroke();}
 // Vue continue : positions persistantes, interpolation, porteur repéré et lignes de défense.
 const homeColor=col0,awayColor=col1;
 rm13DrawPlayers(g,xctx,X,Y,homeColor,awayColor);
 // field scoreboard and legend
 xctx.textAlign='left';xctx.textBaseline='alphabetic';xctx.fillStyle='#ffffffdd';xctx.font='bold 12px system-ui';xctx.fillText('● '+club(g.home).name+'    ● '+club(g.away).name,73,521);
 xctx.font='11px system-ui';xctx.fillStyle='#a9c5b6';xctx.textAlign='right';xctx.fillText('Mouvements continus · 15 contre 15',1056,521);}
window.RM27_SIMPLE_DEBUG={get:()=>rmSimple,step:()=>{if(rmSimple)rmSimStep(rmSimple)},penalty:()=>{if(rmSimple){rmPenalty(rmSimple,rmSimple.home===state.clubId?0:1);rmDrawEverything()}},fast:f=>rmSimpleSimulateFixture(f),resume:f=>startSimpleMatch(f)};

// Version stabilisée : suspension lorsque le navigateur quitte l'onglet.
document.addEventListener('visibilitychange',()=>{if(document.hidden&&rmSimple&&!rmSimple.done){rmSimple.paused=true;rmStopTimer();rmStore();}});
// La carrière peut enchaîner les saisons sans toucher aux effectifs ni aux recrutements.
function rmCanStartNewSeason(){return state.career&&getFixtures(club(state.clubId).league).length>0&&getFixtures(club(state.clubId).league).every(f=>!!f.result)}
function rmStartNewSeason(){
 if(!rmCanStartNewSeason())return toast('Termine ton championnat avant de passer à la saison suivante');
 if(!confirm('Passer à la saison suivante ? Les résultats seront archivés et le nouveau calendrier sera créé. Les effectifs, contrats, transferts, staff et budget seront conservés. Pense à exporter ta carrière.'))return;
 const previous=Number.isInteger(state.rmSeason)&&state.rmSeason>0?state.rmSeason:1;
 // Simuler les matchs non disputés des autres ligues; la saison clôturée a des classements complets.
 for(const l of leagues){for(const f of getFixtures(l.id))if(!f.result)f.result=rmSimpleSimulateFixture(f)}
 const standings={};const results={};
 for(const l of leagues){standings[l.id]=tableFor(l.id).map(t=>({...t}));results[l.id]=getFixtures(l.id).map(f=>({id:f.id,home:f.home,away:f.away,round:f.round,result:f.result}));}
 state.rmSeasonHistory=Array.isArray(state.rmSeasonHistory)?state.rmSeasonHistory:[];
 state.rmSeasonHistory.push({season:previous,closedAt:new Date().toISOString(),controlledClub:state.clubId,standings,results,past:[...state.past]});
 state.rmSeason=previous+1;
 state.fixtures={};
 for(const l of leagues){const arr=clubs.filter(c=>c.league===l.id).sort((a,b)=>rmSeed('RM27-S'+state.rmSeason+'-'+a.id)-rmSeed('RM27-S'+state.rmSeason+'-'+b.id));state.fixtures[l.id]=seededFixtures(arr,l.rounds,l.id).map(f=>({...f,id:'S'+state.rmSeason+'-'+f.id}));}
 state.past=[];rmClearStore();
 save();render();toast('Nouvelle saison commencée · gestion et effectifs conservés');
}
function rmArchivePanel(){
 const history=Array.isArray(state.rmSeasonHistory)?state.rmSeasonHistory:[];
 if(!history.length)return '';
 return `<section class="panel" id="rmSeasonArchives"><div class="panel-heading"><div><span class="eyebrow">CONTINUITÉ DE CARRIÈRE</span><h2>Palmarès & saisons archivées</h2></div><span class="tag">${history.length} saison(s)</span></div><div class="table-wrap"><table><thead><tr><th>Saison</th><th>Club dirigé</th><th>Position finale</th><th>Champion de votre ligue</th></tr></thead><tbody>${history.slice().reverse().map(h=>{
 const controlled=club(h.controlledClub),lid=controlled?.league||state.leagueId,list=h.standings?.[lid]||[],rank=list.findIndex(t=>t.id===h.controlledClub)+1,winner=list[0];
 return `<tr><td>${Number(h.season)||1}</td><td>${esc(controlled?.name||'Club non disponible')}</td><td>${rank?rank+' / '+list.length:'—'}</td><td>${esc(club(winner?.id)?.name||'—')}</td></tr>`;
 }).join('')}</tbody></table></div><p class="text-muted">Championnats archivés, résultats complets conservés dans l'export JSON. Les saisons suivantes sont fictives.</p></section>`;
}
const rmHomeBefore=homePage;
homePage=function(){
 let content=rmHomeBefore();const season=Number.isInteger(state.rmSeason)&&state.rmSeason>0?state.rmSeason:1;
 if(season>1){const begin=2025+season;content=content.replace('Votre centre de commandement pour la saison 2026-2027.',`Votre centre de commandement pour la saison fictive ${begin}-${begin+1}. Effectifs de référence 2026-2027 conservés.`).replace('<span class="eyebrow">CARRIÈRE /','<span class="eyebrow">SAISON '+season+' · CARRIÈRE /');}
 if(rmCanStartNewSeason())content=content.replace('<div class="page-actions">','<div class="page-actions"><button class="btn primary" data-rm-next-season="1">↻ Nouvelle saison →</button>');
 content+=rmArchivePanel();return content;
};
document.addEventListener('click',event=>{const btn=event.target.closest('[data-rm-next-season]');if(btn){event.preventDefault();event.stopImmediatePropagation();rmStartNewSeason();}},true);
window.RM27_EDITION_STABLE={version:'1.4',canStartNewSeason:rmCanStartNewSeason,startNewSeason:rmStartNewSeason};
