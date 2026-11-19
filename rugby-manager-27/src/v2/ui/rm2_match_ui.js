/* Rugby Manager 27 — V2.0 · Pont carrière ↔ moteur et écran de match
 * Tous les matchs du club dirigé (en direct ou simulés) passent par le moteur multi-agents V2.
 * Les rencontres entre clubs IA des autres affiches utilisent le modèle rapide calibré (rm2_quick.js).
 */
'use strict';
(function(){
const RM2=window.RM2,R2D=window.RM2R;
const LIVE_KEY='rm27-v2-live-match';
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
let LIVE=null;

/* ===================== Tactiques : carrière → moteur ===================== */
const STYLE={'Équilibré':{width:.5,forwards:.5,risk:.42,tempo:.5},'Jeu au large':{width:.86,forwards:.3,risk:.6,tempo:.66},
 'Jeu direct':{width:.28,forwards:.86,risk:.3,tempo:.56},'Conservation':{width:.4,forwards:.72,risk:.18,tempo:.34}};
const KICK={'Territoire':{kicking:.62,kickStyle:'auto'},'Conservation':{kicking:.26,kickStyle:'auto'},'Pression aérienne':{kicking:.6,kickStyle:'chandelle'}};
const DEF={'Glissée':{lineSpeed:.55,drift:.78,contest:.45},'Montée agressive':{lineSpeed:.92,drift:.3,contest:.62},'Attentiste':{lineSpeed:.32,drift:.6,contest:.32}};
const PLAY={'Croisée 10–12':'croisée','15 dans la ligne':'arrière intercalé','Leurre puis large':'leurre','Surnombre extérieur':'sautée','Redoublée':'redoublée','Passe sautée':'sautée'};
window.RM2_PRESETS={STYLE,KICK,DEF,PLAY};
function userTactics(){
 const t=state.tactics||{};const adv=(state.rm2&&state.rm2.tactics)||{};
 const out=Object.assign({},RM2.DEFAULT_TACTICS,STYLE[t.style]||STYLE['Équilibré'],KICK[t.kick]||KICK.Territoire,DEF[t.defense]||DEF['Glissée']);
 out.shape=t.shape==='2-4-2'?'2-4-2':'1-3-3-1';
 out.playbook=PLAY[t.playbook]||'auto';
 for(const k of ['width','tempo','kicking','forwards','risk','lineSpeed','contest'])if(Number.isFinite(adv[k]))out[k]=clamp(adv[k],0,1);
 for(const k of ['kickStyle','penalty','lineoutTarget','lineoutPlay','scrumPlan','subs','plan','objective','lineoutCall','scrumCall'])if(adv[k])out[k]=adv[k];
 return out;
}
function aiTactics(id){
 const c=club(id)||{};const h=RM2.hash('style'+id);
 const styles=Object.keys(STYLE),defs=Object.keys(DEF),kicks=Object.keys(KICK);
 const out=Object.assign({},RM2.DEFAULT_TACTICS,STYLE[styles[h%4]],KICK[kicks[(h>>3)%3]],DEF[defs[(h>>6)%3]]);
 out.shape=(h>>9)%3===0?'2-4-2':'1-3-3-1';
 if((c.power||70)>80){out.width=Math.min(1,out.width+.1);out.risk+=.05}
 return out;
}
window.RM2_userTactics=userTactics;window.RM2_aiTactics=aiTactics;

/* ===================== Couleurs ===================== */
function hexLum(h){const n=parseInt(String(h||'#888').replace('#','').padEnd(6,'8').slice(0,6),16);return ((n>>16)&255)*.3+((n>>8)&255)*.59+(n&255)*.11}
function hexDist(a,b){const A=parseInt(a.slice(1),16),B=parseInt(b.slice(1),16);return Math.abs((A>>16)-(B>>16))+Math.abs(((A>>8)&255)-((B>>8)&255))+Math.abs((A&255)-(B&255))}
function normHex(h){h=String(h||'').trim();if(/^#[0-9a-f]{6}$/i.test(h))return h;if(/^#[0-9a-f]{3}$/i.test(h))return '#'+h[1]+h[1]+h[2]+h[2]+h[3]+h[3];return '#888888'}
function kits(home,away){
 let h=normHex(club(home)?.color),a=normHex(club(away)?.color);
 const h2=hexLum(h)>150?'#14213a':'#f4f4f4';let a2=hexLum(a)>150?'#14213a':'#f4f4f4';
 if(hexDist(h,a)<150){a=hexLum(h)>140?'#1b2440':'#f2f2f2';a2=hexLum(a)>140?'#c8102e':'#f2c14e'}
 return [[h,h2],[a,a2]];
}

/* ===================== Construction des équipes ===================== */
function teamConfig(id,isUser){
 const c=club(id);let list=[];try{list=lineup(id)}catch(e){list=[]}
 const players=list.map(p=>{
  const ovr=window.RM2C?RM2C.ovr(p):(Number.isFinite(p.skill)?p.skill:70);
  return {id:p.id,name:p.name,position:p.position,skill:ovr,attrs:window.RM2C?RM2C.attrs(p,ovr):undefined,condition:window.RM2C?RM2C.condition(p.id):1};
 });
 const training=isUser&&window.RM2C?RM2C.trainingBonus(id):{attack:0,defence:0,set:0,kicking:0,fitness:0,cohesion:0};
 // staff : léger bonus par domaine
 try{if(isUser){training.attack+=Math.min(2,staffEffect(id,'Attaque')*.6);training.defence+=Math.min(2,staffEffect(id,'Défense')*.6);training.set+=Math.min(2,staffEffect(id,'Conquête')*.6)}}catch(e){}
 return {name:c.name,short:c.short&&c.short.length<16?c.short:c.name.replace(/^(Stade|Racing|Union|Rugby Club|Section)\s+/i,'').slice(0,16),players,tactics:isUser?userTactics():aiTactics(id),
  training,strength:typeof rmEffectiveStrength==='function'?rmEffectiveStrength(id):c.power,ref:id};
}
function createMatch(f,opts={}){
 const userSide=f.home===state.clubId?0:f.away===state.clubId?1:-1;
 const K=kits(f.home,f.away);
 const cfg={seed:RM2.hash('rm27-v2-'+(state.rmSeason||1)+'-'+f.id),teams:[teamConfig(f.home,userSide===0),teamConfig(f.away,userSide===1)],userTeam:userSide,auto:!!opts.auto||state.rm2?.askPenalty===false};
 cfg.teams[0].color=K[0][0];cfg.teams[0].color2=K[0][1];cfg.teams[1].color=K[1][0];cfg.teams[1].color2=K[1][1];
 const M=RM2.create(cfg);M.fid=f.id;M.league=club(f.home).league;M.home=f.home;M.away=f.away;
 M.bonusRule=['TOP14','PROD2'].includes(M.league)?'ecart3':'quatre';
 M.askSet=state.rm2?.askSetPiece!==false;
 const month=((8+Math.floor(((f.round||1)-1)*9/Math.max(1,league(M.league)?.rounds||26)))%12)+1;
 M.weather=RM2.makeWeather(RM2.hash('meteo'+(state.rmSeason||1)+f.id),month);
 return M;
}
window.RM2_createMatch=createMatch;

/* ===================== Résultat → carrière ===================== */
function resultFrom(M){
 const s=M.st;const sum=k=>s[0][k]+s[1][k];
 return {home:M.score[0],away:M.score[1],homeTries:M.tries[0],awayTries:M.tries[1],
  events:{rucks:sum('rucks'),tackles:sum('tackles'),passes:sum('passes'),kicks:sum('kicks'),lineouts:sum('lineouts'),scrums:sum('scrums'),penalties:sum('penC'),mauls:sum('mauls'),turnovers:sum('turnovers')},
  sim:'RM27-V2-moteur-agents',seed:M.seed,report:{st:[s[0],s[1]],bip:Math.round(M.bip||0)}};
}
function simulateFixtureFull(f){const M=createMatch(f,{auto:true});RM2.runToEnd(M);return {M,result:resultFrom(M)}}
function teamStrength(id){
 try{const xv=lineup(id).slice(0,15);const v=xv.reduce((s,p)=>s+(window.RM2C?RM2C.ovr(p):p.skill||70),0)/Math.max(1,xv.length);return 74+(v-74)*.75}catch(e){return club(id)?.power||70}
}
window.RM2_teamStrength=teamStrength;
/* Remplace la simulation simplifiée V1.x : moteur complet pour le club dirigé, modèle calibré pour les autres. */
window.rmSimpleSimulateFixture=rmSimpleSimulateFixture=function(f){
 if(state.career&&(f.home===state.clubId||f.away===state.clubId)){
  const {M,result}=simulateFixtureFull(f);
  if(window.RM2C)RM2C.afterMatch(M,f,result,true);
  return result;
 }
 const r=RM2.quickResult(RM2.hash('q'+(state.rmSeason||1)+f.id),teamStrength(f.home),teamStrength(f.away));
 if(window.RM2C)RM2C.afterQuick(f,r);
 return r;
};

/* ===================== Écran de match ===================== */
function esc2(v){return typeof esc==='function'?esc(v):String(v)}
function markup(M){
 const h=M.T[0],a=M.T[1];
 return `<div class="m2" id="m2" data-cam="tv">
 <canvas id="m2c" aria-label="Match en direct : 30 joueurs, vue télévisée 2D"></canvas>
 <div class="m2-top">
  <button class="m2-icon" id="m2Back" title="Retour à la carrière" aria-label="Retour à la carrière">←</button>
  <div class="m2-score" role="status" aria-live="polite">
   <span class="m2-team"><i style="background:${h.color}"></i><b>${esc2(h.short)}</b></span>
   <span class="m2-pts"><b id="m2s0">0</b><em>–</em><b id="m2s1">0</b></span>
   <span class="m2-team away"><b>${esc2(a.short)}</b><i style="background:${a.color}"></i></span>
   <span class="m2-clock"><b id="m2clock">00:00</b><small id="m2half">1re MT</small></span>
  </div>
  <span class="m2-phase" id="m2phase">Coup d'envoi</span><span class="m2-phase m2-wx" id="m2wx"></span>
 </div>
 <div class="m2-ticker" id="m2tick"><span>Le match va commencer</span></div>
 <div class="m2-bar" role="toolbar" aria-label="Contrôles du match">
  <button class="m2-play" id="m2Play" aria-label="Lecture / pause">▶</button>
  <div class="m2-speeds" id="m2Speeds">${[1,2,4,8,16].map(n=>`<button data-speed="${n}">×${n}</button>`).join('')}</div>
  <button class="m2-chip" id="m2Digest" title="Accélère automatiquement les temps faibles">Résumé</button>
  <button class="m2-chip" id="m2Next" title="Avancer jusqu'à la prochaine action clé">⏭ Action clé</button>
  <span class="m2-sep"></span>
  <button class="m2-chip" id="m2Cam" title="Changer de caméra (C)">🎥 <span id="m2CamL">TV</span></button>
  <button class="m2-icon" id="m2ZoomOut" aria-label="Dézoomer">−</button><button class="m2-icon" id="m2ZoomIn" aria-label="Zoomer">+</button>
  <span class="m2-sep"></span>
  <button class="m2-chip" data-panel="tactics" id="m2PlanChip">Plan</button>
  <button class="m2-chip" data-panel="stats">Stats</button>
  <button class="m2-chip" data-panel="players">Joueurs</button>
  <button class="m2-chip" data-panel="events">Actions</button>
  <button class="m2-chip" data-panel="options">⋯</button>
 </div>
 <aside class="m2-drawer" id="m2Drawer" hidden><div class="m2-dhead"><b id="m2DTitle">Tactique</b><button class="m2-icon" id="m2DClose" aria-label="Fermer">✕</button></div><div class="m2-dbody" id="m2DBody"></div></aside>
 <div class="m2-modal" id="m2Modal" hidden></div>
 <div class="m2-fps" id="m2fps"></div>
 </div>`;
}
function startMatchV2(f){
 if(!f)return toast('Aucun match disponible');
 if(f.result)return toast('Match déjà joué');
 try{cancelAnimationFrame(animation);animation=null;match=null;rmStopTimer();if(rmSimpleRAF!==null)cancelAnimationFrame(rmSimpleRAF);rmSimpleRAF=null}catch(e){}
 menuOpen=false;rmSimple=null;
 let M=null;
 try{const s=JSON.parse(localStorage.getItem(LIVE_KEY)||'null');if(s&&s.fid===f.id&&s.season===(state.rmSeason||1)&&s.M&&s.M.v===2&&!s.M.done){M=s.M;toast('Match en cours repris là où vous l’aviez laissé')}}catch(e){}
 if(!M)M=createMatch(f);
 if(window.RM2C)RM2C.beforeMatch(M,f);
 const app=document.getElementById('app');app.onclick=null;app.innerHTML=markup(M);
 document.body.classList.add('m2-live');
 const canvas=document.getElementById('m2c');
 const r=R2D.create(canvas,{mode:(typeof uiSettings!=='undefined'&&uiSettings.rm2cam)||'tv'});
 LIVE={M,f,r,speed:Number(uiSettings?.rm2speed)||2,paused:true,acc:0,last:performance.now(),digest:uiSettings?.rm2digest!==false,toKey:false,halfShown:M.half===2,saveT:0,panel:null,lastEvent:0,finished:false};
 R2D.snapCamera(r,M);
 bind();refreshHud(true);loop();
 setTimeout(()=>{if(LIVE&&LIVE.M===M&&!M.done)showIntro()},60);
}
window.RM2_startMatch=startMatchV2;
function persist(){if(!LIVE||LIVE.M.done)return;try{localStorage.setItem(LIVE_KEY,JSON.stringify({fid:LIVE.f.id,season:state.rmSeason||1,M:LIVE.M}))}catch(e){}}
function clearPersist(){try{localStorage.removeItem(LIVE_KEY)}catch(e){}}
window.RM2_persist=persist;

function bind(){
 const $i=id=>document.getElementById(id);
 $i('m2Back').onclick=()=>{persist();leave()};
 $i('m2Play').onclick=()=>togglePause();
 $i('m2Speeds').onclick=e=>{const b=e.target.closest('[data-speed]');if(!b)return;LIVE.speed=+b.dataset.speed;uiSettings.rm2speed=LIVE.speed;saveUiSettings();if(LIVE.paused)togglePause(false);refreshHud(true)};
 $i('m2Digest').onclick=()=>{LIVE.digest=!LIVE.digest;uiSettings.rm2digest=LIVE.digest;saveUiSettings();refreshHud(true)};
 $i('m2Next').onclick=()=>skipToKey();
 $i('m2Cam').onclick=()=>cycleCam();
 $i('m2ZoomIn').onclick=()=>{LIVE.r.zoom=clamp(LIVE.r.zoom*1.2,.55,2.6)};
 $i('m2ZoomOut').onclick=()=>{LIVE.r.zoom=clamp(LIVE.r.zoom/1.2,.55,2.6)};
 $i('m2DClose').onclick=()=>openPanel(null);
 document.querySelectorAll('[data-panel]').forEach(b=>b.onclick=()=>openPanel(LIVE.panel===b.dataset.panel?null:b.dataset.panel));
 const c=$i('m2c');
 c.addEventListener('wheel',e=>{e.preventDefault();LIVE.r.zoom=clamp(LIVE.r.zoom*(e.deltaY<0?1.1:1/1.1),.55,2.6)},{passive:false});
 let pinch=null;
 c.addEventListener('touchstart',e=>{if(e.touches.length===2){pinch={d:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),z:LIVE.r.zoom}}},{passive:true});
 c.addEventListener('touchmove',e=>{if(pinch&&e.touches.length===2){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);LIVE.r.zoom=clamp(pinch.z*d/pinch.d,.55,2.6)}},{passive:true});
 c.addEventListener('touchend',()=>{pinch=null},{passive:true});
 c.addEventListener('dblclick',()=>togglePause());
}
document.addEventListener('keydown',e=>{
 if(!LIVE||!document.getElementById('m2'))return;
 if(e.target.closest&&e.target.closest('input,select,textarea'))return;
 if(e.code==='Space'){e.preventDefault();togglePause()}
 else if(/^Digit[1-5]$/.test(e.code)){LIVE.speed=[1,2,4,8,16][+e.code.slice(5)-1];refreshHud(true)}
 else if(e.key==='c'||e.key==='C')cycleCam();
 else if(e.key==='t'||e.key==='T')openPanel(LIVE.panel==='tactics'?null:'tactics');
 else if(e.key==='Escape')openPanel(null);
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&LIVE&&!LIVE.paused){LIVE.paused=true;persist();refreshHud(true)}});
function cycleCam(){const list=R2D.CAMERAS;const i=list.indexOf(LIVE.r.mode);LIVE.r.mode=list[(i+1)%list.length];LIVE.r.zoom=1;uiSettings.rm2cam=LIVE.r.mode;saveUiSettings();R2D.snapCamera(LIVE.r,LIVE.M);refreshHud(true)}
function togglePause(force){if(!LIVE)return;const M=LIVE.M;if(M.done){finish();return}LIVE.paused=force!=null?force:!LIVE.paused;LIVE.last=performance.now();if(LIVE.paused)persist();refreshHud(true)}
function leave(){
 if(LIVE){cancelAnimationFrame(LIVE.raf);}LIVE=null;document.body.classList.remove('m2-live');
 state.page='calendrier';render();
}
function skipToKey(){
 const M=LIVE.M;if(M.done)return;
 const start=M.evn;let n=0;
 while(!M.done&&!M.pending&&n<6000){RM2.step(M,RM2.DT);n++;
  const e=M.last;if(M.evn>start&&e&&e.imp>=1&&!['call','sub','info','clear'].includes(e.k))break;
  if(M.phase==='half'&&!LIVE.halfShown)break}
 for(const p of M.P){p.px=p.x;p.py=p.y}M.ball.px=M.ball.x;M.ball.py=M.ball.y;
 R2D.snapCamera(LIVE.r,M);refreshHud(true);
}

/* ---------- Boucle temps réel ---------- */
function loop(){
 if(!LIVE||!document.getElementById('m2c'))return;
 const now=performance.now();let dt=Math.min(.1,(now-LIVE.last)/1000);LIVE.last=now;
 const M=LIVE.M;
 if(!LIVE.paused&&!M.done&&!M.pending){
  let sp=LIVE.speed;
  if(LIVE.digest&&!M.live)sp=Math.max(sp,8);// le Résumé ne compresse que les replacements (arrêts de jeu)
  LIVE.cur=LIVE.cur==null?sp:LIVE.cur+(sp-LIVE.cur)*Math.min(1,dt*4);sp=LIVE.cur;
  LIVE.acc+=dt*sp;let n=0;
  while(LIVE.acc>=RM2.DT&&n<40){RM2.step(M,RM2.DT);LIVE.acc-=RM2.DT;n++;if(M.done||M.pending||(M.phase==='half'&&!LIVE.halfShown))break}
  if(n>=40)LIVE.acc=0;
  LIVE.saveT+=dt;if(LIVE.saveT>8){LIVE.saveT=0;persist()}
 }
 const alpha=LIVE.paused||M.pending?1:clamp(LIVE.acc/RM2.DT,0,1);
 R2D.updateCamera(LIVE.r,M,dt*(LIVE.paused?0:Math.min(LIVE.speed,4)),alpha);
 R2D.draw(LIVE.r,M,alpha);
 refreshHud(false);
 if(M.pending&&!LIVE.modalPending){LIVE.modalPending=true;if(M.pending.type==='penalty')showPenalty();else showSetPiece()}
 if(M.phase==='half'&&!LIVE.halfShown){LIVE.halfShown=true;LIVE.paused=true;showHalf()}
 if(M.done&&!LIVE.endShown){LIVE.endShown=true;LIVE.paused=true;showEnd()}
 LIVE.raf=requestAnimationFrame(loop);
}
const PHASE_LABEL={kickoff:'Coup d’envoi',play:'Jeu courant',ruck:'Ruck',maul:'Maul',scrum:'Mêlée',lineout:'Touche',penalty:'Pénalité',goalkick:'Tir au but',try:'Essai !',half:'Mi-temps',end:'Fin du match',dropflight:'Drop'};
let hudCache='';
function refreshHud(force){
 if(!LIVE)return;const M=LIVE.M;const $i=id=>document.getElementById(id);
 const ck=RM2.clockText(M);
 const ph=(M.phase==='play'&&M.ball.st==='air'&&M.ball.kind==='kick')?'Jeu au pied':M.phase==='play'&&M.ball.st==='air'&&M.ball.kind==='pass'?'Passe':PHASE_LABEL[M.phase]||M.phase;
 const poss=M.poss>=0?' · '+M.T[M.poss].short:'';
 const key=M.score.join()+ck+ph+poss+LIVE.paused+LIVE.speed+LIVE.digest+LIVE.r.mode+M.evn;
 if(!force&&key===hudCache)return;hudCache=key;
 $i('m2s0').textContent=M.score[0];$i('m2s1').textContent=M.score[1];
 $i('m2clock').textContent=M.clock>=M.half*2400&&!M.done?(M.half===1?'40:00+':'80:00+'):ck;
 $i('m2half').textContent=M.done?'Terminé':M.half===1?'1re MT':'2e MT';
 $i('m2phase').textContent=ph+(['play','ruck','maul'].includes(M.phase)?poss:'');
 $i('m2Play').textContent=M.done?'✓':LIVE.paused?'▶':'⏸';
 document.querySelectorAll('#m2Speeds [data-speed]').forEach(b=>b.classList.toggle('on',+b.dataset.speed===LIVE.speed));
 $i('m2Digest').classList.toggle('on',LIVE.digest);
 $i('m2CamL').textContent=R2D.CAM[LIVE.r.mode].label;
 const wx=$i('m2wx');if(wx)wx.textContent=weatherText(M,true);
 const pc=$i('m2PlanChip');if(pc&&M.userTeam>=0){const B=M.T[M.userTeam].base||M.T[M.userTeam].tactics;pc.textContent='Plan : '+({auto:'auto',pied:'au pied',equilibre:'équilibré',main:'à la main',vent:'vent'})[B.plan||'auto']}
 const e=[...M.log].reverse().find(x=>x.imp>=1||x.k==='call')||M.last;
 if(e&&e.n!==LIVE.lastEvent){LIVE.lastEvent=e.n;const el=$i('m2tick');el.innerHTML=`<b>${fmtMin(e)}</b><span class="${e.imp>=2?'hot':''}">${esc2(e.s)}</span>`;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
 $i('m2fps').textContent=uiSettings?.rm2fps?LIVE.r.fps+' i/s':'';
 if(LIVE.panel==='stats'&&(force||M.frames%30===0))fillPanel('stats');
}
function fmtMin(e){return Math.floor(e.c/60)+"'"}

/* ---------- Panneaux ---------- */
function openPanel(name){
 if(!LIVE)return;LIVE.panel=name;const d=document.getElementById('m2Drawer');
 document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('on',b.dataset.panel===name));
 if(!name){d.hidden=true;return}
 d.hidden=false;fillPanel(name);
}
function sel(id,label,opts,val){return `<label class="m2-f"><span>${label}</span><select data-t="${id}">${opts.map(([v,l])=>`<option value="${v}" ${String(v)===String(val)?'selected':''}>${l}</option>`).join('')}</select></label>`}
function rng(id,label,val,lo,hi){return `<label class="m2-f"><span>${label}<em>${lo} ↔ ${hi}</em></span><input type="range" min="0" max="100" value="${Math.round(val*100)}" data-r="${id}"></label>`}
function fillPanel(name){
 const M=LIVE.M,u=M.userTeam,body=document.getElementById('m2DBody'),title=document.getElementById('m2DTitle');
 if(name==='tactics'){
  title.textContent='Consignes en direct';
  if(u<0){body.innerHTML='<p>Vous observez ce match.</p>';return}
  const T=M.T[u].tactics,t=state.tactics;
  const B=M.T[u].base||T;const need=RM2.triesForBonus(M,u);
  body.innerHTML=`<div class="m2-plan"><span>Plan de jeu</span><div class="m2-seg">${Object.entries(RM2.PLANS).map(([k,l])=>`<button data-plan="${k}" class="${(B.plan||'auto')===k?'on':''}">${l.replace(' (capitaine)','').replace('Adapté au vent et à la météo','Vent & météo')}</button>`).join('')}</div></div>
  ${sel('objective','Objectif',Object.entries(RM2.OBJECTIVES),B.objective||'auto')}
  <p class="m2-hint">${weatherText(M)} · Bonus offensif : ${need===0?'acquis ✓':`encore ${need} essai${need>1?'s':''}`} · État d’esprit actuel : <b>${({normal:'normal',chase:'course au score',protect:'gestion de l’avance',bonus:'chasse au bonus',bonusdef:'bonus défensif'})[M.T[u].mind]||M.T[u].mind}</b></p>
  <p class="m2-hint">Effet immédiat sur les décisions du 9, du 10, des cellules et de la ligne défensive.</p>
  ${sel('style','Plan offensif',Object.keys(STYLE).map(x=>[x,x]),t.style)}
  ${sel('defense','Défense',Object.keys(DEF).map(x=>[x,x]),t.defense)}
  ${sel('kick','Jeu au pied',Object.keys(KICK).map(x=>[x,x]),t.kick)}
  ${sel('shape','Structure des avants',[['1-3-3-1','1-3-3-1'],['2-4-2','2-4-2']],t.shape)}
  ${sel('playbook','Combinaison des trois-quarts',[['Automatique','Lecture libre'],...Object.keys(PLAY).map(x=>[x,x])],t.playbook)}
  <h4>Réglages fins</h4>
  ${rng('width','Largeur offensive',T.width,'axe','large')}
  ${rng('tempo','Rythme des rucks',T.tempo,'patient','rapide')}
  ${rng('kicking','Volume de jeu au pied',T.kicking,'à la main','au pied')}
  ${rng('forwards','Utilisation des avants',T.forwards,'trois-quarts','avants')}
  ${rng('risk','Prise de risque',T.risk,'sécurité','offloads')}
  ${rng('lineSpeed','Vitesse de montée',T.lineSpeed,'attente','pression')}
  ${rng('contest','Contestation des rucks',T.contest,'replacement','grattage')}
  <h4>Conquête et pénalités</h4>
  ${sel('lineoutTarget','Zone de touche',[['auto','Automatique'],['court','Premier sauteur'],['milieu','Milieu'],['fond','Fond de touche']],T.lineoutTarget)}
  ${sel('lineoutPlay','Après touche',[['auto','Lecture'],['maul','Maul porté'],['off','Ballon au 9']],T.lineoutPlay)}
  ${sel('scrumPlan','Plan de mêlée',[['auto','Automatique'],['stable','Sécuriser'],['pression','Pousser'],['huit','Départ du n°8']],T.scrumPlan)}
  ${sel('penalty','Sur pénalité (si non demandé)',[['auto','Capitaine'],['posts','Poteaux'],['touch','Pénaltouche'],['scrum','Mêlée']],T.penalty)}
  ${sel('kickStyle','Type de jeu au pied',[['auto','Lecture'],['box','Chandelles du 9'],['chandelle','Chandelles'],['5022','Recherche du 50:22']],T.kickStyle)}
  ${sel('subs','Remplacements',[['auto','Automatiques'],['manual','Manuels']],T.subs)}
  ${sel('lineoutCall','Combinaison de touche par défaut',[['auto','Choix du capitaine'],...RM2.LINEOUT_PLAYS.map(p=>[p.id,p.name])],B.lineoutCall||'auto')}
  ${sel('scrumCall','Combinaison de mêlée par défaut',[['auto','Choix du capitaine'],...RM2.SCRUM_PLAYS.map(p=>[p.id,p.name])],B.scrumCall||'auto')}
  <label class="m2-f m2-check"><input type="checkbox" id="m2AskSet" ${state.rm2?.askSetPiece!==false?'checked':''}> Me demander la combinaison à chaque touche et mêlée offensive</label>
  <label class="m2-f m2-check"><input type="checkbox" id="m2AskPen" ${state.rm2?.askPenalty!==false?'checked':''}> Me demander à chaque pénalité</label>`;
  body.querySelectorAll('[data-t]').forEach(s=>s.onchange=()=>{const k=s.dataset.t;
   if(['style','defense','kick','shape','playbook'].includes(k)){state.tactics[k]=s.value;state.rm2=state.rm2||{};state.rm2.tactics=state.rm2.tactics||{};for(const f of ['width','tempo','kicking','forwards','risk','lineSpeed','contest'])delete state.rm2.tactics[f]}
   else{state.rm2=state.rm2||{};state.rm2.tactics=state.rm2.tactics||{};state.rm2.tactics[k]=s.value}
   RM2.setBaseTactics(M,u,userTactics());RM2.say(M,u,'info','Consigne : '+s.options[s.selectedIndex].text,0);save();fillPanel('tactics');refreshHud(true)});
  body.querySelectorAll('[data-r]').forEach(s=>s.onchange=()=>{state.rm2=state.rm2||{};state.rm2.tactics=state.rm2.tactics||{};state.rm2.tactics[s.dataset.r]=+s.value/100;RM2.setBaseTactics(M,u,userTactics());save()});
  body.querySelectorAll('[data-plan]').forEach(b=>b.onclick=()=>{state.rm2=state.rm2||{};state.rm2.tactics=state.rm2.tactics||{};state.rm2.tactics.plan=b.dataset.plan;RM2.setBaseTactics(M,u,userTactics());RM2.say(M,u,'info','Plan de jeu : '+RM2.PLANS[b.dataset.plan],0);save();fillPanel('tactics');refreshHud(true)});
  const as=document.getElementById('m2AskSet');as.onchange=()=>{state.rm2=state.rm2||{};state.rm2.askSetPiece=as.checked;M.askSet=as.checked;save()};
  const ap=document.getElementById('m2AskPen');ap.onchange=()=>{state.rm2=state.rm2||{};state.rm2.askPenalty=ap.checked;M.auto=!ap.checked;save()};
  return;
 }
 if(name==='stats'){title.textContent='Statistiques & analyse';body.innerHTML=statsHtml(M)+analysisHtml(M);return}
 if(name==='events'){title.textContent='Fil du match';body.innerHTML=`<div class="m2-events">${[...M.log].reverse().slice(0,120).map(e=>`<div class="m2-ev ${e.imp>=2?'big':e.imp?'mid':''}"><b>${fmtMin(e)}</b><i style="background:${e.tm>=0?M.T[e.tm].color:'#888'}"></i><span>${esc2(e.s)}</span></div>`).join('')}</div>`;return}
 if(name==='players'){title.textContent='Joueurs & remplacements';body.innerHTML=playersHtml(M);bindPlayers(body);return}
 if(name==='options'){title.textContent='Affichage';
  body.innerHTML=`<label class="m2-f m2-check"><input type="checkbox" id="m2Lab" ${LIVE.r.labels?'checked':''}> Noms des joueurs</label>
  <label class="m2-f m2-check"><input type="checkbox" id="m2Ov" ${LIVE.r.overlay?'checked':''}> Calque tactique (ligne défensive, cellules, annonce)</label>
  <label class="m2-f m2-check"><input type="checkbox" id="m2Fps" ${uiSettings.rm2fps?'checked':''}> Afficher les images/seconde</label>
  <p class="m2-hint">Raccourcis : Espace pause · 1–5 vitesse · C caméra · T tactique · molette / pincement pour zoomer. ×1 = temps réel du jeu ; les arrêts de jeu sont compressés.</p>
  <button class="m2-btn" id="m2Sim">⏩ Simuler la fin du match</button> <button class="m2-btn ghost" id="m2Export">Exporter le match (JSON)</button>`;
  document.getElementById('m2Lab').onchange=e=>{LIVE.r.labels=e.target.checked};
  document.getElementById('m2Ov').onchange=e=>{LIVE.r.overlay=e.target.checked};
  document.getElementById('m2Fps').onchange=e=>{uiSettings.rm2fps=e.target.checked;saveUiSettings()};
  document.getElementById('m2Sim').onclick=()=>{if(!confirm('Simuler la fin de la rencontre avec le moteur complet ? Les pénalités seront décidées par votre capitaine.'))return;const M=LIVE.M;let n=0;while(!M.done&&n++<120000){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT)}LIVE.modalPending=false;closeModal();R2D.snapCamera(LIVE.r,M);refreshHud(true)};
  document.getElementById('m2Export').onclick=()=>{const M=LIVE.M;const blob=new Blob([JSON.stringify({jeu:'Rugby Manager 27 V2.0',equipes:[M.T[0].name,M.T[1].name],score:M.score,essais:M.tries,horloge:RM2.clockText(M),stats:M.st,journal:M.log},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='RM27-V2-match-'+LIVE.f.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500)};
 }
}
function pct(a,b){return a+b?Math.round(a*100/(a+b)):50}
function statsHtml(M){
 const s=M.st,t=M.clock||1;
 const rows=[['Points',M.score[0],M.score[1]],['Essais',M.tries[0],M.tries[1]],['Possession',pct(s[0].poss,s[1].poss)+' %',pct(s[1].poss,s[0].poss)+' %'],['Territoire',pct(s[0].terr,s[1].terr)+' %',pct(s[1].terr,s[0].terr)+' %'],
  ['Mètres gagnés',Math.round(s[0].metres),Math.round(s[1].metres)],['Franchissements',s[0].breaks,s[1].breaks],['Rucks gagnés',`${s[0].rucksWon}/${s[0].rucks}`,`${s[1].rucksWon}/${s[1].rucks}`],
  ['Plaquages réussis',`${s[0].tackles}/${s[0].tackles+s[0].missed}`,`${s[1].tackles}/${s[1].tackles+s[1].missed}`],['Passes',s[0].passes,s[1].passes],['Offloads',s[0].offloads,s[1].offloads],['Jeux au pied',s[0].kicks,s[1].kicks],
  ['Touches gagnées',`${s[0].lineoutsWon}/${s[0].lineouts}`,`${s[1].lineoutsWon}/${s[1].lineouts}`],['Mêlées gagnées',`${s[0].scrumsWon}/${s[0].scrums}`,`${s[1].scrumsWon}/${s[1].scrums}`],['Mauls',s[0].mauls,s[1].mauls],
  ['Pénalités concédées',s[0].penC,s[1].penC],['Ballons perdus',s[0].turnovers,s[1].turnovers],['En-avant',s[0].knock,s[1].knock],['Cartons jaunes',s[0].yc,s[1].yc],['Pénalités / transfo réussies',`${s[0].pen}/${s[0].penA} · ${s[0].conv}/${s[0].convA}`,`${s[1].pen}/${s[1].penA} · ${s[1].conv}/${s[1].convA}`]];
 return `<table class="m2-stats"><thead><tr><th style="color:${M.T[0].color}">${esc2(M.T[0].short)}</th><th></th><th style="color:${M.T[1].color}">${esc2(M.T[1].short)}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r[1]}</td><th>${r[0]}</th><td>${r[2]}</td></tr>`).join('')}</tbody></table>`;
}
function analysisHtml(M){
 const u=M.userTeam<0?0:M.userTeam,o=1-u,s=M.st[u],so=M.st[o],T=M.T[u].tactics,out=[];
 const tk=s.tackles/(Math.max(1,s.tackles+s.missed)),poss=pct(s.poss,so.poss),terr=pct(s.terr,so.terr);
 if(T.lineSpeed>.8){out.push(s.missed>so.missed+4?`Votre défense montante force l’adversaire à jouer vite, mais elle laisse des intervalles : ${s.missed} plaquages manqués et ${so.breaks} franchissements concédés.`:`La montée agressive étouffe l’attaque adverse : ${so.turnovers} ballons perdus par l’adversaire, ${so.breaks} franchissements seulement.`)}
 else if(T.lineSpeed<.4)out.push(so.metres>s.metres*1.2?`La défense attentiste concède du terrain (${Math.round(so.metres)} m adverses) : remonter la ligne réduirait le temps de l’ouvreur adverse.`:`La défense attentiste tient : ${Math.round(tk*100)} % de plaquages réussis.`);
 if(T.kicking>.55)out.push(terr>55?`Le jeu au pied fonctionne : ${terr} % du match dans le camp adverse avec ${s.kicks} coups de pied.`:`Beaucoup de jeu au pied (${s.kicks}) mais seulement ${terr} % de territoire : vos coups de pied sont relancés, privilégiez la touche ou la chandelle disputée.`);
 else if(T.kicking<.35)out.push(poss>55?`La conservation vous donne ${poss} % de possession${s.breaks>so.breaks?' et plus de franchissements':''}.`:`Malgré la consigne de conservation, la possession reste à ${poss} % : les rucks sont contestés (${so.turnovers} récupérations adverses).`);
 if(T.width>.7)out.push(s.breaks>=so.breaks?`Le jeu au large crée ${s.breaks} franchissements.`:`Le jeu au large ne perce pas (${s.breaks} franchissements) : la défense glisse bien, essayez une croisée ou des cellules d’avants pour fixer.`);
 if(T.forwards>.7)out.push(`Les cellules d’avants usent l’adversaire : ${s.rucks} rucks joués, ${Math.round(s.metres)} m gagnés.`);
 if(s.penC>so.penC+3)out.push(`Discipline : ${s.penC} pénalités concédées contre ${so.penC}. Réduire la contestation des rucks limiterait les fautes.`);
 if(s.lineouts>=4&&s.lineoutsWon/s.lineouts<.8)out.push(`Touche en difficulté (${s.lineoutsWon}/${s.lineouts}) : variez la zone de lancer.`);
 if(s.scrums>=3&&s.scrumsWon/s.scrums<.7)out.push(`Mêlée dominée (${s.scrumsWon}/${s.scrums}) : l’option « Sécuriser » ou un remplacement de la première ligne peut aider.`);
 if(!out.length)out.push('Match équilibré : aucune consigne ne pèse encore de façon nette. Les rapports s’enrichissent avec le temps de jeu.');
 return `<div class="m2-analysis"><h4>Pourquoi votre plan fonctionne… ou pas</h4>${out.map(x=>`<p>${esc2(x)}</p>`).join('')}</div>`;
}
function playersHtml(M){
 const u=M.userTeam;if(u<0)return '<p>Vous observez ce match.</p>';
 const on=M.P.filter(p=>p.team===u);
 const bench=M.bench[u];
 return `<p class="m2-hint">Les remplacements prennent effet au prochain arrêt de jeu.</p><table class="m2-pl"><thead><tr><th>N°</th><th>Joueur</th><th>Énergie</th><th>Pl.</th><th>Courses</th><th>m</th><th></th></tr></thead><tbody>${on.map(p=>`<tr class="${p.mode==='bin'?'bin':''}"><td>${p.num}</td><td>${esc2(p.name)}${p.injured?' 🩹':''}${p.mode==='bin'?' 🟨':''}</td><td><span class="m2-en"><i style="width:${Math.round(p.en*100)}%;background:${p.en>.7?'#4fc37b':p.en>.5?'#e5b84a':'#e0584f'}"></i></span></td><td>${p.s.tk}</td><td>${p.s.car}</td><td>${Math.round(p.s.m)}</td><td>${p.mode!=='bin'?`<button class="m2-mini" data-out="${p.i}">Sortir</button>`:''}</td></tr>`).join('')}</tbody></table>
 <h4>Banc (${bench.filter(b=>!b.used).length} disponibles · ${M.subsMade[u]}/8 utilisés)</h4><div class="m2-bench">${bench.map((b,k)=>`<button class="m2-benchp ${b.used?'used':''}" data-in="${k}" ${b.used?'disabled':''}><b>${esc2(b.src.position)}</b> ${esc2(b.src.name)}</button>`).join('')}</div>
 ${(M.subQueue||[]).length?`<p class="m2-hint">En attente : ${(M.subQueue||[]).map(q=>esc2(M.P[q.out].short)+' → '+esc2(M.bench[u][q.inn].src.name)).join(', ')}</p>`:''}`;
}
function bindPlayers(body){
 const M=LIVE.M,u=M.userTeam;let out=null;
 body.querySelectorAll('[data-out]').forEach(b=>b.onclick=()=>{out=+b.dataset.out;body.querySelectorAll('[data-out]').forEach(x=>x.classList.toggle('on',x===b))});
 body.querySelectorAll('[data-in]').forEach(b=>b.onclick=()=>{if(out==null)return toast('Choisissez d’abord le joueur qui sort');
  const k=+b.dataset.in;
  if(!M.live||M.phase==='half'){RM2.substitute(M,u,out,k,'tactique')}else{M.subQueue=M.subQueue||[];M.subQueue.push({out,inn:k});RM2.say(M,u,'info','Remplacement demandé au prochain arrêt de jeu',0)}
  fillPanel('players')});
}

/* ---------- Modales ---------- */
function modal(html){const m=document.getElementById('m2Modal');m.innerHTML=`<div class="m2-dialog">${html}</div>`;m.hidden=false;return m}
function closeModal(){const m=document.getElementById('m2Modal');if(m){m.hidden=true;m.innerHTML=''}}
function showIntro(){
 const M=LIVE.M;if(M.t>1){return}
 const u=M.userTeam;
 modal(`<span class="m2-eyebrow">${esc2(league(M.league)?.name||'Championnat')} · Saison ${state.rmSeason||1}</span><h2>${esc2(M.T[0].name)} – ${esc2(M.T[1].name)}</h2>
 <p>Plan de jeu : <b>${esc2(state.tactics.style)}</b> · défense <b>${esc2(state.tactics.defense)}</b> · jeu au pied <b>${esc2(state.tactics.kick)}</b>.</p>
 <p>${weatherText(M)}.</p>
 <p class="m2-hint">Moteur V2 : 30 joueurs autonomes, ballon physique. ×1 = temps réel ; le mode « Résumé » accélère les temps faibles.</p>
 <div class="m2-actions"><button class="m2-btn" id="m2Go">▶ Coup d’envoi</button><button class="m2-btn ghost" id="m2GoSim">⏩ Simuler le match</button></div>`);
 document.getElementById('m2Go').onclick=()=>{closeModal();togglePause(false)};
 document.getElementById('m2GoSim').onclick=()=>{closeModal();const M=LIVE.M;let n=0;while(!M.done&&n++<150000){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT)}R2D.snapCamera(LIVE.r,M);refreshHud(true)};
}
function showPenalty(){
 const M=LIVE.M,p=M.pending;
 const r=RM2.R(M,p.team,p.x);
 modal(`<span class="m2-eyebrow">Décision du manager · ${RM2.clockText(M)}</span><h2>${p.free?'Coup franc':'Pénalité'} pour ${esc2(M.T[p.team].short)}</h2>
 <p>${esc2(p.reason)} · à ${Math.round(100-r)} m de la ligne adverse, ${Math.round(Math.abs(p.y-35))} m de l’axe. Score ${M.score[0]}–${M.score[1]}.</p>
 ${p.why?`<p class="m2-why">🗣 Le capitaine : « ${esc2(p.why)} »</p>`:''}<div class="m2-choices">${p.options.map(o=>`<button class="m2-choice ${o.id===p.suggest?'sug':''}" data-pen="${o.id}"><b>${esc2(o.label)}</b>${o.p!=null?`<small>Réussite estimée ${Math.round(o.p*100)} %</small>`:''}${o.id===p.suggest?'<small>Conseil du capitaine</small>':''}</button>`).join('')}</div>`);
 document.querySelectorAll('[data-pen]').forEach(b=>b.onclick=()=>{RM2.penaltyChoice(M,b.dataset.pen);LIVE.modalPending=false;closeModal();LIVE.last=performance.now()});
}
function weatherText(M,short){const w=M.weather;if(!w)return '';const ico={clear:'☀',cloudy:'☁',rain:'🌧',wind:'💨'}[w.kind]||'';const u=M.userTeam>=0?M.userTeam:0;const wf=RM2.windFor(M,u);const kmh=Math.round(Math.abs(w.wind)*3.6);
 const dirTxt=kmh<6?'vent faible':(wf>0?'vent dans le dos':'vent de face')+(M.userTeam<0?'':'');return short?`${ico} ${kmh} km/h ${kmh<6?'':wf>0?'↗':'↙'}`:`${ico} ${w.label}, ${kmh} km/h (${dirTxt}${M.userTeam>=0?' pour vous':''})${w.rain?' · ballon glissant':''}`}
window.RM2_weatherText=weatherText;
function showSetPiece(){
 const M=LIVE.M,p=M.pending,type=p.type,list=type==='lineout'?RM2.LINEOUT_PLAYS:RM2.SCRUM_PLAYS;
 const r=RM2.R(M,p.team,p.x);let zone=p.suggest.zone||'avant';
 const draw=()=>{
  const items=list.filter(pl=>type!=='lineout'||pl.zones.includes(zone));
  modal(`<span class="m2-eyebrow">${type==='lineout'?'Touche':'Mêlée'} offensive · ${Math.round(100-r)} m de la ligne · ${RM2.clockText(M)}</span><h2>Choisissez la combinaison</h2>
  ${type==='lineout'?`<div class="m2-seg m2-jump">${[['avant','1er sauteur'],['milieu','2e sauteur'],['fond','3e sauteur']].map(([z,l])=>`<button data-zone="${z}" class="${z===zone?'on':''}">${l}</button>`).join('')}</div>`:''}
  <div class="m2-plays">${items.map(pl=>`<button class="m2-playbtn ${pl.id===p.suggest.id?'sug':''}" data-play="${pl.id}"><b>${list.indexOf(pl)+1}. ${esc2(pl.name)}</b><small>${esc2(pl.desc)}</small>${pl.id===p.suggest.id?'<em>Conseil du capitaine</em>':''}</button>`).join('')}</div>
  <div class="m2-actions"><button class="m2-btn ghost" id="m2SpAuto">Laisser le capitaine décider</button><label class="m2-f m2-check"><input type="checkbox" id="m2SpStop"> Ne plus demander pendant ce match</label></div>`);
  document.querySelectorAll('[data-zone]').forEach(b=>b.onclick=()=>{zone=b.dataset.zone;draw()});
  const done=c=>{if(document.getElementById('m2SpStop')?.checked)M.askSet=false;RM2.setPieceChoice(M,c);LIVE.modalPending=false;closeModal();LIVE.last=performance.now()};
  document.querySelectorAll('[data-play]').forEach(b=>b.onclick=()=>done({id:b.dataset.play,zone}));
  document.getElementById('m2SpAuto').onclick=()=>done(p.suggest);
 };
 draw();
}
function showHalf(){
 const M=LIVE.M;
 modal(`<span class="m2-eyebrow">Mi-temps</span><h2>${esc2(M.T[0].short)} ${M.score[0]} – ${M.score[1]} ${esc2(M.T[1].short)}</h2>${statsHtml(M)}${analysisHtml(M)}
 <div class="m2-actions"><button class="m2-btn" id="m2H2">▶ Seconde période</button><button class="m2-btn ghost" id="m2HT">Ajuster la tactique</button></div>`);
 document.getElementById('m2H2').onclick=()=>{closeModal();togglePause(false)};
 document.getElementById('m2HT').onclick=()=>{closeModal();openPanel('tactics')};
 persist();
}
function playerRating(p){return Math.max(3,Math.min(10,6+p.s.tk*.08-p.s.mt*.2+p.s.m*.012+p.s.br*.5+p.s.tr*.9+p.s.to*.4-p.s.pen*.25+(p.s.pts-5*p.s.tr)*.05))}
window.RM2_rating=playerRating;
function showEnd(){
 const M=LIVE.M;
 const u=M.userTeam<0?0:M.userTeam;
 const all=[...M.P,...M.gone].filter(p=>p.team===u&&p.on>60);
 const best=all.map(p=>({p,r:playerRating(p)})).sort((a,b)=>b.r-a.r).slice(0,5);
 const res=M.score[u]>M.score[1-u]?'Victoire':M.score[u]<M.score[1-u]?'Défaite':'Match nul';
 modal(`<span class="m2-eyebrow">Coup de sifflet final</span><h2>${esc2(M.T[0].short)} ${M.score[0]} – ${M.score[1]} ${esc2(M.T[1].short)}</h2><p><b>${res}</b> · essais ${M.tries[0]}–${M.tries[1]}</p>
 <h4>Meilleurs joueurs</h4><ol class="m2-best">${best.map(x=>`<li>${esc2(x.p.name)} <b>${x.r.toFixed(1)}</b><small>${x.p.s.tk} plaquages · ${Math.round(x.p.s.m)} m${x.p.s.tr?' · '+x.p.s.tr+' essai(s)':''}</small></li>`).join('')}</ol>
 ${analysisHtml(M)}<div class="m2-actions"><button class="m2-btn" id="m2Fin">Enregistrer et continuer →</button><button class="m2-btn ghost" data-panel2="stats">Statistiques</button></div>`);
 document.getElementById('m2Fin').onclick=()=>finish();
 document.querySelector('[data-panel2]').onclick=()=>openPanel('stats');
}
function finish(){
 if(!LIVE)return;const M=LIVE.M,f=LIVE.f;
 if(!LIVE.finished){LIVE.finished=true;commit(M,f)}
 clearPersist();cancelAnimationFrame(LIVE.raf);LIVE=null;document.body.classList.remove('m2-live');
 state.page='accueil';render();
}
function commit(M,f){
 const fx=getFixtures(M.league).find(x=>x.id===f.id);
 if(!fx||fx.result)return;
 const result=resultFrom(M);
 // compatibilité : passe par rmComplete (classement, historique, finances)
 const g={id:f.id,home:f.home,away:f.away,league:M.league,done:false,fast:false,score:[...M.score],tries:[...M.tries],stats:result.events,log:[],minute:80,pendingPenalty:null,paused:true};
 try{rmComplete(g)}catch(e){console.warn(e)}
 if(fx.result){Object.assign(fx.result,{sim:result.sim,seed:result.seed,report:result.report});}
 else fx.result=result;
 if(window.RM2C)RM2C.afterMatch(M,f,fx.result,false);
 save();
}
/* Remplacements demandés en cours de jeu : appliqués au prochain arrêt. */
const subsOrig=RM2.subsCheck;
RM2.subsCheck=function(M,half){
 if(M.subQueue&&M.subQueue.length){for(const q of M.subQueue)RM2.substitute(M,M.userTeam,q.out,q.inn,'tactique');M.subQueue=[]}
 return subsOrig(M,half);
};

/* ===================== Branchement dans le jeu existant ===================== */
window.startSimpleMatch=startSimpleMatch=function(f){return startMatchV2(f)};
window.RM27_V2={start:startMatchV2,simulate:f=>simulateFixtureFull(f),createMatch,quick:(f)=>RM2.quickResult(RM2.hash('q'+f.id),teamStrength(f.home),teamStrength(f.away)),live:()=>LIVE,resultFrom};
})();
