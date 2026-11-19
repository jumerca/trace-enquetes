/* Rugby Manager 27 — V2.0 · Gestion de carrière approfondie
 * Modèle joueur (âge, potentiel, progression, condition, blessures, moral, forme, contrat),
 * entraînement hebdomadaire relié au moteur, marché avec négociation, offres des clubs IA,
 * vieillissement / retraites / centre de formation à chaque saison, objectifs de la direction.
 * Toutes les données nouvelles vivent dans state.rm2 : une ancienne sauvegarde se charge sans perte.
 */
'use strict';
(function(){
const C=window.RM2C={};
const H=s=>RM2.hash(String(s));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const rnd01=s=>(H(s)%10000)/10000;
const season=()=>Number(state.rmSeason)||1;
const FWD=['PR','HO','LO','BR'];
const NEED={PR:5,HO:3,LO:4,BR:6,SH:3,FH:3,CE:4,WI:4,FB:2};
const POSL={PR:'Pilier',HO:'Talonneur',LO:'2e ligne',BR:'3e ligne',SH:'Demi de mêlée',FH:'Ouvreur',CE:'Centre',WI:'Ailier',FB:'Arrière'};
C.POSL=POSL;

/* ---------- État persistant (migration douce) ---------- */
function S(){
 if(!state.rm2||typeof state.rm2!=='object')state.rm2={};
 const r=state.rm2;
 if(!r.v){
  // première ouverture d'une sauvegarde V1.x : copie de secours avant toute écriture V2
  try{const k='rugby-manager-27-alpha-v1';const raw=localStorage.getItem(k);if(raw&&!localStorage.getItem(k+'-avant-v2'))localStorage.setItem(k+'-avant-v2',raw)}catch(e){}
  r.v=1;r.since=season();
 }
 r.p=r.p||{};r.youth=r.youth||[];r.moves=r.moves||[];r.news=r.news||[];r.listed=r.listed||{};r.offers=r.offers||[];
 r.training=r.training||{focus:{attack:1,defence:1,set:1,kicking:1,fitness:1,cohesion:1},intensity:1,week:0};
 r.tactics=r.tactics||{};r.released=r.released||{};if(r.autoRenew==null)r.autoRenew=true;
 if(r.askPenalty==null)r.askPenalty=true;
 return r;
}
C.S=S;
function news(text,kind='info'){const r=S();r.news.unshift({s:season(),t:text,k:kind,at:Date.now()});if(r.news.length>60)r.news.length=60}
C.news=news;

/* ---------- Modèle joueur ---------- */
function D(pid){const r=S();return r.p[pid]||(r.p[pid]={})}
function baseAge(p){if(p.age0)return p.age0;const h=H(p.id+'age');return clamp(19+(h%7)+((h>>3)%7)+((h>>6)%4),19,35)}
C.age=p=>baseAge(p)+(season()-1)-(p.bornSeason?p.bornSeason-1:0);
function baseOvr(p){if(Number.isFinite(p.ovr0))return p.ovr0;try{return attr(p)}catch(e){return 65}}
C.ovr=function(p){if(!p)return 60;const d=S().p[p.id];return clamp(Math.round(baseOvr(p)+(d?.g||0)),35,97)};
C.pot=function(p){if(Number.isFinite(p.pot0))return p.pot0;const a=baseAge(p),h=H(p.id+'pot');const room=a<=21?6+h%9:a<=24?3+h%7:a<=27?h%5:a<=30?h%2:0;return clamp(baseOvr(p)+room,40,97)};
C.condition=pid=>{const d=S().p[pid];return d&&Number.isFinite(d.cond)?d.cond:1};
C.injured=pid=>{const d=S().p[pid];return !!(d&&d.inj>0)};
C.morale=pid=>{const d=S().p[pid];return d&&Number.isFinite(d.mor)?d.mor:65};
C.form=pid=>{const d=S().p[pid];if(!d||!d.rt||!d.rt.length)return null;return d.rt.reduce((a,b)=>a+b,0)/d.rt.length};
C.attrs=function(p,ovr){
 // attributs utilisés par le moteur, avec progression ciblée par l'entraînement
 const role=RM2.ROLE[({PR:1,HO:2,LO:4,BR:7,SH:9,FH:10,CE:12,WI:11,FB:15})[p.position]||12];
 const a=RM2.deriveAttrs(p.id,ovr,role);const d=S().p[p.id];
 if(d&&d.at)for(const k in d.at)a[k]=clamp(a[k]+d.at[k],25,99);
 const m=C.morale(p.id);for(const k of ['hnd','pas','vis','tkl'])a[k]=clamp(a[k]+Math.round((m-65)/18),25,99);
 return a;
};
C.wage=function(p){const d=S().p[p.id];if(d&&Number.isFinite(d.wage))return d.wage;const o=C.ovr(p);return Math.round(clamp(.046+(o-65)*.0045+(o>=80?.032:0)+(p.status==='test'?-.008:0),.03,.26)*1000)/1000};
C.contractEnd=function(p){const d=S().p[p.id];if(d&&Number.isFinite(d.until))return d.until;const h=H(p.id+'ctr')%100;return (S().since||1)+(h<10?0:h<40?1:h<75?2:3)};// fins de contrat surtout en 2028, 2029 et 2030
C.value=function(p){const o=C.ovr(p),a=C.age(p),pot=C.pot(p);const left=Math.max(0,C.contractEnd(p)-season());
 let v=.08+Math.pow(Math.max(0,o-55),1.9)*.0016+Math.max(0,pot-o)*.012*(a<25?1:.3);v*=a>31?.6:a>29?.85:1;v*=left===0?.25:left===1?.7:1;return Math.round(v*100)/100};

/* ---------- Effectifs : club courant de chaque joueur ---------- */
let cache=null;
function invalidate(){cache=null}
C.invalidate=invalidate;
function pool(){return [...DATA.players,...(state.imported||[]),...S().youth]}
function clubMap(){
 const key=(state.changes||[]).length+':'+S().moves.length+':'+S().youth.length+':'+(state.imported||[]).length;
 if(cache&&cache.key===key)return cache;
 const m=new Map();for(const p of pool())m.set(p.id,p.clubId);
 for(const c of state.changes||[])if(m.has(c.playerId)||findPlayerV2(c.playerId))m.set(c.playerId,c.to);
 for(const c of S().moves)m.set(c.id,c.to);
 const byClub=new Map();for(const p of pool()){const cl=m.get(p.id);if(!cl)continue;if(!byClub.has(cl))byClub.set(cl,[]);byClub.get(cl).push(p)}
 cache={key,m,byClub};return cache;
}
C.clubOf=pid=>clubMap().m.get(pid);
function findPlayerV2(id){return DATA.players.find(p=>p.id===id)||(state.imported||[]).find(p=>p.id===id)||S().youth.find(p=>p.id===id)}
findPlayer=function(id){return findPlayerV2(id)};
realPlayers=function(id){return (clubMap().byClub.get(id)||[]).slice()};
allPlayers=function(id){
 const real=realPlayers(id);const placeholders=[];
 for(const [pos,count] of Object.entries(NEED)){const n=real.filter(p=>p.position===pos).length;for(let i=n;i<count;i++)placeholders.push({id:`test-${id}-${pos}-${i+1}`,clubId:id,name:`Joueur test ${pos}-${String(i+1).padStart(2,'0')}`,position:pos,status:'test',rosterSeason:'Simulé, identité non vérifiée'})}
 return [...real,...placeholders];
};
const POSI=['PR','HO','PR','LO','LO','BR','BR','BR','SH','FH','WI','CE','CE','WI','FB'];
lineup=function(id){
 const avail=allPlayers(id).filter(p=>!C.injured(p.id));const all=allPlayers(id);
 const used=new Set(),team=[];
 const ov=id===state.clubId?(state.formations?.[id]||{}):{};
 const reserved=new Set(Object.values(ov));
 const score=p=>C.ovr(p)*(.82+.18*C.condition(p.id))+(p.status==='test'?-6:0);
 const best=(pos,skipRes)=>avail.filter(p=>p.position===pos&&!used.has(p.id)&&!(skipRes&&reserved.has(p.id))).sort((a,b)=>score(b)-score(a))[0];
 for(const [i,pos] of POSI.entries()){
  let t=avail.find(p=>p.id===ov[i]&&p.position===pos&&!used.has(p.id))||best(pos,true)||best(pos,false)||avail.find(p=>!used.has(p.id))||all.find(p=>!used.has(p.id));
  if(!t)throw Error('Groupe insuffisant pour '+id);
  used.add(t.id);team.push({...t,number:i+1,skill:C.ovr(t),fatigue:Math.round(C.condition(t.id)*100)});
 }
 for(const pos of ['HO','PR','PR','LO','BR','SH','FH','CE']){const t=best(pos,false)||avail.find(p=>!used.has(p.id));if(t){used.add(t.id);team.push({...t,number:team.length+1,skill:C.ovr(t),fatigue:Math.round(C.condition(t.id)*100)})}}
 return team;
};
transferCost=function(p){return C.value(p)};
if(typeof rmFinPlayerPayroll==='function'){rmFinPlayerPayroll=function(){return Math.round(realPlayers(state.clubId).reduce((s,p)=>s+C.wage(p),0)*1000)/1000+allPlayers(state.clubId).filter(p=>p.status==='test').length*.03}}

/* ---------- Entraînement ---------- */
const AREAS=[['attack','Attaque placée','pas · hnd · vis'],['defence','Défense','tkl · brk'],['set','Conquête','set · str'],['kicking','Jeu au pied','kck'],['fitness','Physique & vitesse','sta · spd'],['cohesion','Cohésion','vis · hnd']];
C.AREAS=AREAS;
C.trainingBonus=function(id){
 const tr=S().training,f=tr.focus,I=tr.intensity;const tot=Object.values(f).reduce((a,b)=>a+b,0)||6;
 const out={};for(const [k] of AREAS){out[k]=clamp((f[k]/tot*6-1)*2.4*I+(I-1)*.8,-2.5,4)}
 try{out.fitness+=Math.min(1.5,staffEffect(id,'Préparation physique')*.5)}catch(e){}
 return out;
};
function weeklyTraining(){
 const r=S(),tr=r.training,I=tr.intensity;const tot=Object.values(tr.focus).reduce((a,b)=>a+b,0)||6;
 let med=0;try{med=staffEffect(state.clubId,'Préparation physique')}catch(e){}
 const map={attack:['pas','hnd'],defence:['tkl','brk'],set:['set','str'],kicking:['kck'],fitness:['sta','spd'],cohesion:['vis','hnd']};
 const injuredNow=[];
 for(const p of realPlayers(state.clubId)){
  const d=D(p.id);const age=C.age(p),pot=C.pot(p),o=C.ovr(p);
  // récupération / fatigue de la semaine
  d.cond=clamp((Number.isFinite(d.cond)?d.cond:1)+.2+med*.02-(I-1)*.12-.05*I,.5,1);
  if(d.inj>0){d.inj--;if(d.inj===0)news(`${p.name} est rétabli et de nouveau disponible`,'good')}
  // progression : jeunes sous leur potentiel, plus rapide avec temps de jeu et intensité
  const room=pot-o;
  if(room>0){const ageF=age<=21?1:age<=24?.7:age<=27?.35:.1;const mins=clamp((d.wm||0)/80,0,1);
   d.g=(d.g||0)+Math.min(room,.11*ageF*I*(.6+.6*mins));
   d.at=d.at||{};for(const k in map){const share=tr.focus[k]/tot;if(share>.2)for(const a of map[k])d.at[a]=clamp((d.at[a]||0)+.05*share*I*ageF,0,6)}}
  // risque de blessure à l'entraînement
  if(I>1.15&&rnd01(p.id+'tr'+season()+'-'+tr.week)<(I-1.1)*.03){d.inj=1+H(p.id+'trinj'+tr.week)%3;d.injName='blessure à l’entraînement';injuredNow.push(p.name)}
  d.wm=0;
 }
 tr.week++;
 if(injuredNow.length)news(`Entraînement intensif : ${injuredNow.join(', ')} blessé(s)`,'bad');
}
C.weeklyTraining=weeklyTraining;

/* ---------- Après-match ---------- */
C.beforeMatch=function(M,f){S()};
C.afterQuick=function(f,r){};
C.afterMatch=function(M,f,result,headless){
 const r=S();const u=f.home===state.clubId?0:f.away===state.clubId?1:-1;if(u<0)return;
 if(r.lastMatch===f.id+':'+season())return;r.lastMatch=f.id+':'+season();
 const won=M.score[u]>M.score[1-u],lost=M.score[u]<M.score[1-u];
 const seen=new Set();
 for(const p of [...M.P,...(M.gone||[])].filter(q=>q.team===u)){
  if(seen.has(p.id))continue;seen.add(p.id);
  const d=D(p.id);const min=Math.round((p.on||0)/60*(M.clock/Math.max(1,M.t)));
  d.apps=(d.apps||0)+(min>0?1:0);d.min=(d.min||0)+min;d.wm=(d.wm||0)+min;d.tr=(d.tr||0)+p.s.tr;d.pts=(d.pts||0)+p.s.pts;d.tk=(d.tk||0)+p.s.tk;
  d.cond=clamp(.55+.45*(p.en||1),.5,1);
  const rt=window.RM2_rating?RM2_rating(p):6.5;d.rt=[...(d.rt||[]),Math.round(rt*10)/10].slice(-5);
  d.mor=clamp((Number.isFinite(d.mor)?d.mor:65)+(won?5:lost?-4:1)+(min>40?2:0),10,100);
 }
 // joueurs non utilisés : moral en baisse s'ils sont bons
 for(const p of realPlayers(state.clubId)){if(seen.has(p.id))continue;const d=D(p.id);if(C.ovr(p)>=75)d.mor=clamp((d.mor??65)-2,10,100);d.cond=clamp((d.cond??1)+.05,.5,1)}
 for(const inj of M.injuries||[]){if(inj.team!==u)continue;const d=D(inj.id);d.inj=1+H(inj.id+f.id)%5;d.injName=['élongation','entorse de la cheville','commotion (protocole)','contusion','lésion musculaire'][H(inj.id)%5];news(`${inj.name} blessé (${d.injName}) — indisponible ${d.inj} semaine(s)`,'bad')}
 // confiance des dirigeants selon l'attente
 const b=board();const opp=f.home===state.clubId?f.away:f.home;const exp=(window.RM2_teamStrength?RM2_teamStrength(state.clubId)-RM2_teamStrength(opp):0)+(u===0?1.5:-1.5);
 b.conf=clamp(b.conf+(won?2+Math.max(0,-exp)*.4:lost?-2-Math.max(0,exp)*.4:.5),0,100);
 weeklyTraining();
 offersTick();
 invalidate();
};

/* ---------- Direction : objectifs ---------- */
function board(){const r=S();if(!r.board||r.board.season!==season()||r.board.club!==state.clubId){
 const lid=club(state.clubId).league;const ids=clubs.filter(c=>c.league===lid).map(c=>c.id);
 const str=ids.map(id=>[id,window.RM2_teamStrength?RM2_teamStrength(id):club(id).power]).sort((a,b)=>b[1]-a[1]);
 const rank=str.findIndex(x=>x[0]===state.clubId)+1,n=ids.length;
 const obj=rank<=2?{id:'titre',label:'Viser le titre (top 2)',target:2}:rank<=6?{id:'phases',label:'Qualification en phase finale (top 6)',target:6}:rank<=Math.ceil(n*.7)?{id:'milieu',label:'Terminer dans la première moitié',target:Math.ceil(n/2)}:{id:'maintien',label:'Assurer le maintien',target:n-2};
 r.board={season:season(),club:state.clubId,obj,conf:r.board&&r.board.club===state.clubId?clamp(r.board.conf*.6+24,20,90):60,predicted:rank};
}return r.board}
C.board=board;

/* ---------- Marché : offres des clubs IA pour vos joueurs listés ---------- */
function offersTick(){
 const r=S();if(window.RM2W&&!RM2W.windowOpen())return;const mine=realPlayers(state.clubId);
 for(const pid of Object.keys(r.listed)){const p=mine.find(x=>x.id===pid);if(!p){delete r.listed[pid];continue}
  if(r.offers.some(o=>o.pid===pid))continue;
  const roll=rnd01(pid+'off'+season()+'-'+r.training.week);
  if(roll<.4){const buyers=clubs.filter(c=>c.id!==state.clubId&&Math.abs((c.power||70)-C.ovr(p))<12);const b=buyers[H(pid+r.training.week)%Math.max(1,buyers.length)];
   if(b){const fee=Math.round(C.value(p)*(.75+roll)*100)/100;r.offers.push({pid,club:b.id,fee,week:r.training.week});news(`${b.name} propose ${fee.toFixed(2).replace('.',',')} M€ pour ${p.name}`,'offer')}}
 }
 r.offers=r.offers.filter(o=>r.training.week-o.week<=3);
}
function acceptOffer(i){const r=S();const o=r.offers[i];if(!o)return;if(window.RM2W&&!RM2W.windowOpen()){toast(RM2W.windowText());return}r.salesSeason=(r.salesSeason||0)+o.fee;r.tb=(r.tb||0)+o.fee*.5;const p=findPlayerV2(o.pid);if(!p)return;
 state.changes.push({playerId:p.id,from:state.clubId,to:o.club,cost:-o.fee});
 if(typeof rmFinLedger==='function')rmFinLedger('Vente · '+p.name+' → '+club(o.club).name,o.fee,'transfer','sale:'+p.id+':'+season());else state.budget+=o.fee;
 removeFromLineup(p.id);delete r.listed[p.id];r.offers.splice(i,1);news(`${p.name} vendu à ${club(o.club).name} (${o.fee.toFixed(2).replace('.',',')} M€)`,'good');invalidate();save();render();toast('Transfert conclu')}
function removeFromLineup(pid){const f=state.formations?.[state.clubId];if(f)for(const k of Object.keys(f))if(f[k]===pid)delete f[k]}

/* ---------- Négociations ---------- */
function demandWage(p,toUser){const base=C.wage(p);const a=C.age(p);const mor=C.morale(p.id);let k=1.08+(toUser?.06:0)-(mor-65)/400+(a>31?-.1:0);return Math.round(base*k*1000)/1000}
function negotiate(kind,pid){
 const p=findPlayerV2(pid)||allPlayers(state.clubId).find(x=>x.id===pid);if(!p)return;
 const fromClub=C.clubOf(pid);
 const buying=kind==='buy',freeAgent=!fromClub||fromClub==='__fa';
 const val=C.value(p),wageAsk=demandWage(p,buying);
 const prestigeGap=((club(state.clubId)?.power||70)-(club(fromClub)?.power||70));
 const html=`<div class="rm2-neg"><span class="eyebrow">${buying?(freeAgent?'JOUEUR LIBRE':'OFFRE DE TRANSFERT'):'PROLONGATION DE CONTRAT'}</span><h2>${esc(p.name)}</h2>
 <p>${esc(POSL[p.position]||p.position)} · ${C.age(p)} ans · note ${C.ovr(p)} · potentiel estimé ${scoutPot(p)} ${buying&&!freeAgent?`· ${esc(club(fromClub)?.name||'')} (contrat jusqu'à la saison ${C.contractEnd(p)})`:''}</p>
 ${buying&&!freeAgent?`<label>Indemnité proposée (M€) <input type="number" step="0.05" min="0" id="rm2Fee" value="${val.toFixed(2)}"></label><small>Valeur estimée ${val.toFixed(2).replace('.',',')} M€ · trésorerie ${(+state.budget).toFixed(2).replace('.',',')} M€</small>`:''}
 <label>Salaire annuel proposé (M€) <input type="number" step="0.005" min="0.02" id="rm2Wage" value="${wageAsk.toFixed(3)}"></label><small>Exigence du joueur environ ${wageAsk.toFixed(3).replace('.',',')} M€ / an</small>
 <label>Durée <select id="rm2Years">${[1,2,3,4].map(y=>`<option value="${y}" ${y===2?'selected':''}>${y} saison${y>1?'s':''}</option>`).join('')}</select></label>
 <p id="rm2NegMsg" class="rm2-negmsg"></p>
 <div class="rm2-negact"><button class="btn primary" id="rm2NegGo">Proposer</button><button class="btn ghost" id="rm2NegClose">Fermer</button></div></div>`;
 const box=document.createElement('div');box.className='rm2-shade';box.innerHTML=html;document.body.appendChild(box);
 const close=()=>box.remove();box.querySelector('#rm2NegClose').onclick=close;
 let rounds=0;
 box.querySelector('#rm2NegGo').onclick=()=>{
  rounds++;const wage=+box.querySelector('#rm2Wage').value,years=+box.querySelector('#rm2Years').value,fee=buying&&!freeAgent?+box.querySelector('#rm2Fee').value:0;
  const msg=box.querySelector('#rm2NegMsg');
  if(buying&&fee>state.budget){msg.textContent='Trésorerie insuffisante pour cette indemnité.';return}
  const age=C.age(p);const yearsWish=age>30?1:age<25?3:2;
  let s=(wage/wageAsk-1)*9+(buying&&!freeAgent?(fee/val-1)*6:0)+prestigeGap*.05-Math.abs(years-yearsWish)*.25-(rounds-1)*.35+(kind==='renew'?(C.morale(pid)-60)/25:0);
  const pAcc=1/(1+Math.exp(-(s+.3)*2.2));
  const roll=rnd01(pid+':neg:'+rounds+':'+season()+':'+Math.round(wage*1000)+':'+Math.round(fee*100));
  if(roll<pAcc){
   const d=D(pid);d.wage=Math.round(wage*1000)/1000;d.until=season()+years;
   if(buying){if(fee>0){if(typeof rmFinLedger==='function')rmFinLedger('Indemnité de transfert · '+p.name,-fee,'transfer','transfer:'+pid+':'+season());else state.budget-=fee}
    state.changes.push({playerId:pid,from:freeAgent?'__fa':fromClub,to:state.clubId,cost:fee});d.mor=72;news(`${p.name} signe ${years} saison(s) (${wage.toFixed(3).replace('.',',')} M€/an)`,'good')}
   else{d.mor=clamp((d.mor??65)+6,10,100);news(`${p.name} prolonge jusqu'à la saison ${d.until}`,'good')}
   invalidate();save();close();render();toast(buying?'Accord trouvé : transfert signé':'Prolongation signée');return;
  }
  if(rounds>=3||pAcc<.08){msg.textContent=pAcc<.08?'Proposition jugée irrespectueuse : les discussions sont rompues.':'Le joueur met fin aux discussions pour le moment.';box.querySelector('#rm2NegGo').disabled=true;return}
  msg.textContent=`Refus. ${pAcc<.35?'L’écart est important':'On se rapproche'} — tentative ${rounds}/3.`;
 };
}
function scoutPot(p){let an=0;try{an=staffEffect(state.clubId,'Analyse')}catch(e){}const err=Math.max(0,6-an*1.5);const pot=C.pot(p);if(C.clubOf(p.id)===state.clubId)return pot;const e=Math.round(((H(p.id+'scout')%100)/100-.5)*err*2);return `${clamp(pot+e-2,40,97)}–${clamp(pot+e+2,40,99)}`}

/* ---------- Changement de saison ---------- */
const FIRST=['Lucas','Hugo','Théo','Nathan','Louis','Jules','Mathis','Enzo','Tom','Noah','Maxime','Yanis','Baptiste','Antoine','Sacha','Léo','Raphaël','Adam','Paul','Gabriel','Ilan','Mattéo','Romain','Clément'];
const LAST=['Martin','Bernard','Durand','Lefebvre','Moreau','Garcia','Roux','Fournier','Girard','Lambert','Fontaine','Mercier','Bonnet','Blanc','Guerin','Muller','Henry','Roussel','Nicolas','Perrin','Morel','Mathieu','Clement','Gauthier','Robin','Caron'];
function youthName(seed){return FIRST[H(seed+'f')%FIRST.length]+' '+LAST[H(seed+'l')%LAST.length]}
function makeYouth(clubId,pos,quality,seed){
 const id=`espoir-${clubId}-${season()}-${seed}`;
 const p={id,clubId,name:youthName(id),position:pos,status:'espoir',rosterSeason:'Espoir formé au club (identité fictive)',age0:18+H(id)%3,bornSeason:season(),ovr0:clamp(Math.round(quality-10+H(id+'o')%8),40,80),pot0:clamp(Math.round(quality+4+H(id+'p')%12),50,94)};
 S().youth.push(p);D(id).until=season()+3;D(id).wage=.035;return p;
}
C.seasonRollover=function(closedSeason){
 const r=S();const changes=[];
 const lid=club(state.clubId).league;
 // 1) progression / déclin de tous les joueurs suivis
 for(const p of pool()){const cl=C.clubOf(p.id);if(!cl||cl==='__retired')continue;const d=D(p.id);const age=C.age(p);const pot=C.pot(p),o=C.ovr(p);
  const mins=d.min||0;const h=rnd01(p.id+'grow'+season());
  if(age<=27&&pot>o)d.g=(d.g||0)+Math.min(pot-o,(age<=22?2.4:age<=25?1.4:.6)*(.6+h)*(cl===state.clubId?(.7+Math.min(1,mins/900)*.6):1));
  if(age>=31)d.g=(d.g||0)-(age>=34?2.6:age>=32?1.6:.8)*(.5+h);
  d.min=0;d.apps=0;d.tr=0;d.pts=0;d.tk=0;
 }
 const beforeCount=new Map();for(const c of clubs){const m={};for(const p of realPlayers(c.id))m[p.position]=(m[p.position]||0)+1;beforeCount.set(c.id,m)}
 // 2) retraites
 let retired=[];
 for(const p of pool()){const cl=C.clubOf(p.id);if(!cl||cl==='__retired'||cl==='__fa'&&false)continue;const age=C.age(p);
  if(age>=34&&rnd01(p.id+'ret'+season())<(age-33)*.28){r.moves.push({id:p.id,to:'__retired',s:season()});if(cl===state.clubId)retired.push(p.name)}}
 if(retired.length)news(`Fin de carrière : ${retired.join(', ')}`,'info');
 // 3) contrats arrivés à échéance (votre club : départ si non prolongé ; IA : 75 % de prolongations)
 const leaving=[],renewed=[];const med=(()=>{const v=realPlayers(state.clubId).map(p=>C.ovr(p)).sort((a,b)=>a-b);return v[Math.floor(v.length/2)]||65})();const squadMedian=()=>med;
 for(const p of pool()){const cl=C.clubOf(p.id);if(!cl||cl.startsWith('__'))continue;if(C.contractEnd(p)>=season())continue;
  if(cl===state.clubId){
   // le directeur sportif prolonge les joueurs utiles et motivés (option désactivable), les autres partent
   const keep=r.autoRenew!==false&&!r.released?.[p.id]&&C.morale(p.id)>=40&&C.age(p)<=33&&(C.ovr(p)>=squadMedian()-3||C.age(p)<=23);
   if(keep){const d=D(p.id);d.wage=Math.round(C.wage(p)*1.02*1000)/1000;d.until=season()+(C.age(p)>=30?1:2);renewed.push(p.name)}
   else{r.moves.push({id:p.id,to:'__fa',s:season()});leaving.push(p.name);removeFromLineup(p.id)}}
  else if(rnd01(p.id+'renew'+season())<.75){D(p.id).until=season()+1+H(p.id+season())%3}
  else r.moves.push({id:p.id,to:'__fa',s:season()});}
 if(leaving.length)news(`Fins de contrat : ${leaving.join(', ')} quittent le club`,'bad');
 if(renewed.length)news(`Prolongations négociées par le directeur sportif : ${renewed.join(', ')}`,'info');
 invalidate();
 // 4) recrutement des clubs IA : agents libres puis formation
 const fa=pool().filter(p=>C.clubOf(p.id)==='__fa');
 let aiSigned=0;
 for(const c of clubs){if(c.id===state.clubId)continue;const squad=realPlayers(c.id);
  const was=beforeCount.get(c.id)||{};
  for(const [pos,need] of Object.entries(NEED)){let have=squad.filter(p=>p.position===pos).length;
   // on ne remplace que les départs réels (les places « joueur test » restent honnêtement signalées)
   const target=Math.min(need,was[pos]||0);
   while(have<target){const cand=fa.filter(p=>p.position===pos&&C.clubOf(p.id)==='__fa').sort((a,b)=>C.ovr(b)-C.ovr(a)).find(p=>Math.abs(C.ovr(p)-(c.power||70))<14);
    if(cand){r.moves.push({id:cand.id,to:c.id,s:season()});D(cand.id).until=season()+1+H(cand.id+c.id)%3;aiSigned++;invalidate()}
    else makeYouth(c.id,pos,(c.power||70)-6,pos+have);
    have++}}
  if(false)makeYouth(c.id,Object.keys(NEED)[H(c.id+season())%9],(c.power||70)-4,'x');
 }
 // 5) centre de formation du club dirigé
 const acad=(state.finance?.facility?.academy)||0;const nY=1+(acad>=2?1:0);const yq=(club(state.clubId).power||70)-2+acad*2.5;
 const names=[];for(let i=0;i<nY;i++){const pos=Object.keys(NEED)[H(state.clubId+season()+'y'+i)%9];names.push(makeYouth(state.clubId,pos,yq,'u'+i).name)}
 news(`Centre de formation : ${names.join(', ')} intègrent le groupe professionnel`,'good');
 // 6) bilan de la direction
 const hist=state.rmSeasonHistory?.at(-1);const b=r.board;
 if(hist&&b&&b.club===state.clubId){const list=hist.standings?.[lid]||[];const rank=list.findIndex(t=>t.id===state.clubId)+1;
  const ok=rank&&rank<=b.obj.target;b.conf=clamp(b.conf+(ok?18:-22)+(ok&&rank<=2?8:0),0,100);
  r.history=r.history||[];r.history.push({season:closedSeason,club:state.clubId,rank,objective:b.obj.label,met:ok,conf:Math.round(b.conf)});
  news(ok?`Objectif atteint (${rank}e) : la direction vous renouvelle sa confiance`:`Objectif manqué (${rank}e, attendu : ${b.obj.label.toLowerCase()})`,ok?'good':'bad');
  if(!ok&&b.conf<15){r.sacked={season:season(),from:state.clubId};news('La direction met fin à votre mission. Choisissez un nouveau club pour poursuivre votre carrière.','bad')}}
 // historique compact : on garde tous les classements, les résultats détaillés seulement pour les 2 dernières saisons
 const hs=state.rmSeasonHistory||[];hs.forEach((h,i)=>{if(i<hs.length-2){if(h.results){const keep=h.results[lid];h.results=keep?{[lid]:keep.map(f=>({id:f.id,home:f.home,away:f.away,round:f.round,result:f.result?{home:f.result.home,away:f.result.away,homeTries:f.result.homeTries,awayTries:f.result.awayTries}:null}))}:{}}h.past=[]}});
 for(const l of leagues)for(const f of getFixtures(l.id))if(f.result&&f.result.report&&l.id!==lid)delete f.result.report;
 r.offers=[];r.listed={};
 for(const p of realPlayers(state.clubId)){const d=D(p.id);d.cond=1;d.inj=0;d.mor=clamp((d.mor??65)*.6+26,10,100)}
 for(const [k,d] of Object.entries(r.p)){if(d.g!=null)d.g=Math.round(d.g*100)/100;if(!d.g)delete d.g;for(const f of ['min','apps','tr','pts','tk'])if(!d[f])delete d[f];if(!Object.keys(d).length)delete r.p[k]}
 r.aiSigned=aiSigned;invalidate();
};
if(typeof rmStartNewSeason==='function'){const before=rmStartNewSeason;rmStartNewSeason=function(){const n=season();before();if(season()>n){C.seasonRollover(n);board();save();render();if(S().sacked&&S().sacked.season===season()){state.page='clubs';render()}}}}

/* ---------- Pages ---------- */
function bar(v,max=100,col){return `<span class="rm2-bar"><i style="width:${clamp(v/max*100,0,100)}%;background:${col||(v>=75?'#4fc37b':v>=55?'#e5b84a':'#e0584f')}"></i></span>`}
function pill(t,k=''){return `<span class="rm2-pill ${k}">${t}</span>`}
rosterPage=function(){
 const c=club(state.clubId),players=allPlayers(c.id),xv=lineup(c.id);const xvIds=new Set(xv.slice(0,15).map(p=>p.id)),benchIds=new Set(xv.slice(15).map(p=>p.id));
 const order=Object.keys(POSL);const r=S();
 const rows=players.slice().sort((a,b)=>order.indexOf(a.position)-order.indexOf(b.position)||C.ovr(b)-C.ovr(a)).map(p=>{const d=r.p[p.id]||{};const end=C.contractEnd(p),left=end-season();const fm=C.form(p.id);
  return `<tr class="${C.injured(p.id)?'rm2-inj':''}"><td><button class="rm2-link" data-rm2="card" data-id="${esc(p.id)}">${esc(p.name)}</button>${p.status==='espoir'?pill('Espoir','y'):''}${p.status==='test'?pill('Test','t'):''}</td>
  <td><span class="pos">${p.position}</span></td><td>${p.status==='test'?'—':C.age(p)}</td><td class="score-text">${C.ovr(p)}</td><td>${p.status==='test'?'—':scoutPot(p)}</td>
  <td>${bar(Math.round(C.condition(p.id)*100))}</td><td>${bar(C.morale(p.id))}</td><td>${fm?fm.toFixed(1):'—'}</td>
  <td>${xvIds.has(p.id)?pill('XV','xv'):benchIds.has(p.id)?pill('Banc','b'):''}${C.injured(p.id)?pill('🩹 '+d.inj+' sem.','inj'):''}</td>
  <td>${p.status==='test'?'—':`${left<=0?'<b class="rm2-warn">fin de saison</b>':'S'+end}<small> · ${C.wage(p).toFixed(3).replace('.',',')} M€</small>`}</td>
  <td class="rm2-acts">${p.status==='test'?'':`<button class="rm2-mini" data-rm2="renew" data-id="${esc(p.id)}">Prolonger</button><button class="rm2-mini ${r.listed[p.id]?'on':''}" data-rm2="list" data-id="${esc(p.id)}">${r.listed[p.id]?'Listé':'Vendre'}</button>`}</td></tr>`}).join('');
 const slots=POSI.map((pos,i)=>{const cur=xv[i];const opts=players.filter(p=>p.position===pos).sort((a,b)=>C.ovr(b)-C.ovr(a));
  return `<label class="rm2-slot"><span>${i+1}</span><select data-lineup-slot="${i}">${opts.map(p=>`<option value="${esc(p.id)}" ${cur&&cur.id===p.id?'selected':''}>${esc(p.name)} · ${C.ovr(p)}${C.injured(p.id)?' 🩹':''} · ${Math.round(C.condition(p.id)*100)}%</option>`).join('')}</select></label>`}).join('');
 const inj=players.filter(p=>C.injured(p.id)).length,exp=players.filter(p=>p.status!=='test'&&C.contractEnd(p)<=season()).length;
 return `<div class="page-head"><div><span class="eyebrow">GESTION SPORTIVE · SAISON ${season()}</span><h1>Effectif <span class="dot">&</span> composition</h1><p>${esc(c.name)} · ${players.length} joueurs · ${inj} blessé(s) · ${exp} contrat(s) en fin de saison</p></div><div class="page-actions"><button class="btn ghost" data-page="transferts">Marché →</button><button class="btn primary" data-action="play">▶ Jouer le prochain match</button></div></div>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">XV DE DÉPART</span><h2>Composition</h2></div><span class="tag">Les blessés sont écartés automatiquement</span></div><div class="rm2-slots">${slots}</div></section>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">GROUPE PROFESSIONNEL</span><h2>Joueurs, condition et contrats</h2></div></div>
 <div class="table-wrap rm2-table"><table><thead><tr><th>Joueur</th><th>Poste</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Condition</th><th>Moral</th><th>Forme</th><th>Statut</th><th>Contrat</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
 <p class="text-muted">La note évolue avec l’âge, le temps de jeu et l’entraînement. La condition baisse après un match et remonte pendant la semaine. Les potentiels des joueurs adverses sont des estimations (cellule « Analyse » du staff).</p></section>`;
};
function playerCard(pid){
 const p=findPlayerV2(pid)||allPlayers(state.clubId).find(x=>x.id===pid);if(!p)return;
 const o=C.ovr(p),a=C.attrs(p,o);const d=S().p[pid]||{};
 const box=document.createElement('div');box.className='rm2-shade';
 box.innerHTML=`<div class="rm2-neg rm2-card"><span class="eyebrow">${esc(POSL[p.position]||p.position)} · ${esc(club(C.clubOf(pid))?.name||'Libre')}</span><h2>${esc(p.name)}</h2>
 <p>${p.status==='test'?'Profil de test':C.age(p)+' ans'} · note <b>${o}</b> · potentiel ${scoutPot(p)} · valeur ${C.value(p).toFixed(2).replace('.',',')} M€</p>
 <div class="rm2-attrs">${RM2.ATTRS.map(k=>`<div><span>${RM2.ATTR_LABEL[k]}</span>${bar(a[k])}<b>${a[k]}</b></div>`).join('')}</div>
 <p class="text-muted">Saison : ${d.apps||0} match(s), ${d.min||0} min, ${d.tr||0} essai(s), ${d.tk||0} plaquages · forme ${C.form(pid)?.toFixed(1)||'—'} · moral ${Math.round(C.morale(pid))}</p>
 <p class="text-muted">Ces attributs sont exactement ceux utilisés par le moteur de match (vitesse, plaquage, passe, conquête…).</p>
 <div class="rm2-negact"><button class="btn ghost" id="rm2CardClose">Fermer</button></div></div>`;
 document.body.appendChild(box);box.querySelector('#rm2CardClose').onclick=()=>box.remove();box.onclick=e=>{if(e.target===box)box.remove()};
}
C.playerCard=playerCard;
const oldTactics=tacticsPage;
tacticsPage=function(){
 const tr=S().training,b=C.trainingBonus(state.clubId),adv=S().tactics,T=window.RM2_userTactics?RM2_userTactics():RM2.DEFAULT_TACTICS;
 const sl=(k,label,lo,hi)=>`<label class="rm2-range"><span>${label}<em>${lo} ↔ ${hi}</em></span><input type="range" min="0" max="100" value="${Math.round(T[k]*100)}" data-rm2t="${k}"><b>${Math.round(T[k]*100)}</b></label>`;
 return oldTactics()+`<section class="panel rm2-train"><div class="panel-heading"><div><span class="eyebrow">ENTRAÎNEMENT DE LA SEMAINE</span><h2>Plan d’entraînement</h2></div><span class="tag">Semaine ${tr.week+1}</span></div>
 <p class="text-muted">Répartissez les séances. Chaque domaine renforce, pour le prochain match, les attributs indiqués ; les jeunes progressent plus vite. Une forte intensité accélère la progression mais fatigue le groupe et augmente le risque de blessure.</p>
 <div class="rm2-areas">${AREAS.map(([k,l,attrs])=>`<label class="rm2-area"><span><b>${l}</b><small>${attrs}</small></span><input type="range" min="0" max="3" step="1" value="${tr.focus[k]}" data-rm2train="${k}"><em>${['repos','léger','normal','prioritaire'][tr.focus[k]]}</em><i class="${b[k]>=0?'up':'down'}">${b[k]>=0?'+':''}${b[k].toFixed(1)}</i></label>`).join('')}</div>
 <label class="rm2-range"><span>Intensité générale<em>récupération ↔ charge</em></span><input type="range" min="0.6" max="1.4" step="0.1" value="${tr.intensity}" data-rm2train="intensity"><b>${Math.round(tr.intensity*100)} %</b></label>
 </section>
 <section class="panel rm2-adv"><div class="panel-heading"><div><span class="eyebrow">PLAN DE JEU DÉTAILLÉ</span><h2>Réglages fins du moteur</h2></div><button class="btn ghost" data-rm2="reset-tactics">Revenir aux préréglages</button></div>
 <p class="text-muted">Ces curseurs complètent les choix ci-dessus et pilotent directement les décisions visibles sur le terrain : nombre de passes, cellules d’avants, coups de pied, vitesse de montée, grattages.</p>
 <div class="rm2-ranges">${sl('width','Largeur offensive','axe','large')}${sl('tempo','Rythme des rucks','patient','rapide')}${sl('kicking','Jeu au pied','main','pied')}${sl('forwards','Utilisation des avants','trois-quarts','avants')}${sl('risk','Prise de risque','sécurité','offloads')}${sl('lineSpeed','Vitesse de montée défensive','attente','pression')}${sl('contest','Contestation des rucks','replacement','grattage')}</div>
 <div class="rm2-sels">${[['lineoutTarget','Zone de touche',[['auto','Automatique'],['court','Premier sauteur'],['milieu','Milieu'],['fond','Fond']]],['lineoutPlay','Après touche',[['auto','Lecture'],['maul','Maul porté'],['off','Ballon au 9']]],['scrumPlan','Mêlée',[['auto','Automatique'],['stable','Sécuriser'],['pression','Pousser'],['huit','Départ du n°8']]],['penalty','Pénalités',[['auto','Capitaine'],['posts','Poteaux'],['touch','Pénaltouche'],['scrum','Mêlée']]],['kickStyle','Type de jeu au pied',[['auto','Lecture'],['box','Chandelles du 9'],['chandelle','Chandelles'],['5022','50:22']]],['subs','Remplacements',[['auto','Automatiques'],['manual','Manuels']]],['plan','Plan de jeu',Object.entries(RM2.PLANS)],['objective','Objectif de match',Object.entries(RM2.OBJECTIVES)],['lineoutCall','Combinaison de touche par défaut',[['auto','Choix du capitaine'],...RM2.LINEOUT_PLAYS.map(p=>[p.id,p.name])]],['scrumCall','Combinaison de mêlée par défaut',[['auto','Choix du capitaine'],...RM2.SCRUM_PLAYS.map(p=>[p.id,p.name])]]].map(([k,l,o])=>`<label>${l}<select data-rm2ts="${k}">${o.map(([v,t])=>`<option value="${v}" ${(adv[k]||T[k]||'auto')===v?'selected':''}>${t}</option>`).join('')}</select></label>`).join('')}</div><label class="rm2-ask"><input type="checkbox" data-rm2ask ${S().askSetPiece!==false?'checked':''}> En match, me demander la combinaison à chaque touche et mêlée offensive (sinon : combinaison par défaut ou choix du capitaine)</label><p class="text-muted">15 combinaisons de touche (selon le 1er, 2e ou 3e sauteur) et 15 de mêlée. Le plan « Vent & météo » joue davantage au pied vent dans le dos ou sous la pluie ; l’objectif « bonus offensif » pousse le capitaine à jouer les pénalités près de la ligne.</p></section>`;
};
const oldTransfers=transfersPage;
transfersPage=function(){
 const r=S();const q=(r.mq||'').toLowerCase(),pos=r.mpos||'',maxv=Number(r.mmax)||99;
 const list=pool().filter(p=>{const cl=C.clubOf(p.id);return cl&&cl!==state.clubId&&cl!=='__retired'}).filter(p=>(!pos||p.position===pos)&&(!q||p.name.toLowerCase().includes(q)||(club(C.clubOf(p.id))?.name||'').toLowerCase().includes(q))&&C.value(p)<=maxv)
  .sort((a,b)=>C.ovr(b)-C.ovr(a)).slice(0,120);
 const offers=r.offers.map((o,i)=>{const p=findPlayerV2(o.pid);return p?`<div class="rm2-offer"><b>${esc(club(o.club).name)}</b> propose <b>${o.fee.toFixed(2).replace('.',',')} M€</b> pour ${esc(p.name)} <button class="btn primary" data-rm2="accept" data-i="${i}">Accepter</button><button class="btn ghost" data-rm2="refuse" data-i="${i}">Refuser</button></div>`:''}).join('');
 return `<div class="page-head"><div><span class="eyebrow">RECRUTEMENT · SAISON ${season()}</span><h1>Marché des transferts<span class="dot">.</span></h1><p>Trésorerie ${(+state.budget).toFixed(2).replace('.',',')} M€ · masse salariale ${typeof rmFinPlayerPayroll==='function'?rmFinPlayerPayroll().toFixed(2).replace('.',','):'—'} M€ / an</p></div></div>
 ${offers?`<section class="panel"><div class="panel-heading"><div><span class="eyebrow">OFFRES REÇUES</span><h2>Vos joueurs listés</h2></div></div>${offers}</section>`:''}
 <section class="panel"><div class="rm2-filters"><input id="rm2Q" placeholder="Nom ou club" value="${esc(r.mq||'')}"><select id="rm2Pos"><option value="">Tous postes</option>${Object.entries(POSL).map(([k,v])=>`<option value="${k}" ${pos===k?'selected':''}>${v}</option>`).join('')}</select><select id="rm2Max"><option value="99">Toutes valeurs</option>${[.3,.6,1,1.5].map(v=>`<option value="${v}" ${maxv===v?'selected':''}>≤ ${String(v).replace('.',',')} M€</option>`).join('')}</select></div>
 <div class="table-wrap rm2-table"><table><thead><tr><th>Joueur</th><th>Club</th><th>Poste</th><th>Âge</th><th>Note</th><th>Potentiel</th><th>Contrat</th><th>Valeur</th><th></th></tr></thead><tbody>${list.map(p=>{const cl=C.clubOf(p.id);return `<tr><td><button class="rm2-link" data-rm2="card" data-id="${esc(p.id)}">${esc(p.name)}</button>${p.status==='espoir'?pill('Espoir','y'):''}</td><td>${cl==='__fa'?pill('Libre','free'):esc(club(cl)?.name||'')}</td><td>${p.position}</td><td>${C.age(p)}</td><td class="score-text">${C.ovr(p)}</td><td>${scoutPot(p)}</td><td>S${C.contractEnd(p)}</td><td>${cl==='__fa'?'0':C.value(p).toFixed(2).replace('.',',')} M€</td><td><button class="rm2-mini" data-rm2="buy" data-id="${esc(p.id)}">${cl==='__fa'?'Proposer un contrat':'Faire une offre'}</button></td></tr>`}).join('')}</tbody></table></div>
 <p class="text-muted">Les joueurs comparent votre offre, la durée, le prestige du club et leur situation. Trois tentatives maximum par négociation. Les clubs IA recrutent aussi à chaque intersaison.</p></section>`;
};
const oldHome=homePage;
homePage=function(){
 let html=oldHome();if(!state.career)return html;
 const b=board(),r=S();const mine=realPlayers(state.clubId);const inj=mine.filter(p=>C.injured(p.id));const exp=mine.filter(p=>C.contractEnd(p)<=season());
 const confCol=b.conf>=60?'#4fc37b':b.conf>=35?'#e5b84a':'#e0584f';
 html+=`<section class="panel rm2-home"><div class="panel-heading"><div><span class="eyebrow">DIRECTION DU CLUB · SAISON ${season()}</span><h2>${esc(b.obj.label)}</h2></div><span class="tag">Prévision : ${b.predicted}e</span></div>
 <div class="rm2-conf"><span>Confiance des dirigeants</span>${bar(b.conf,100,confCol)}<b>${Math.round(b.conf)} / 100</b></div>
 <div class="rm2-alerts">${inj.length?`<div>🩹 <b>${inj.length}</b> blessé(s) : ${inj.slice(0,4).map(p=>esc(p.name)).join(', ')}</div>`:''}${exp.length?`<div>✍ <b>${exp.length}</b> contrat(s) se terminent cette saison — <button class="rm2-link" data-page="effectif">prolonger</button></div>`:''}${r.offers.length?`<div>💶 <b>${r.offers.length}</b> offre(s) reçue(s) — <button class="rm2-link" data-page="transferts">voir</button></div>`:''}</div>
 <h3>Actualités du club</h3><ul class="rm2-news">${r.news.slice(0,7).map(n=>`<li class="${n.k}"><small>S${n.s}</small> ${esc(n.t)}</li>`).join('')||'<li>Aucune actualité pour le moment.</li>'}</ul></section>`;
 return html;
};

/* ---------- Interactions ---------- */
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-rm2]');if(!el)return;
 e.preventDefault();e.stopImmediatePropagation();
 const a=el.dataset.rm2,id=el.dataset.id;const r=S();
 if(a==='card')(C.openFiche||playerCard)(id);
 else if(a==='renew')(C.openNeg||negotiate)('renew',id);
 else if(a==='buy')(C.openNeg||negotiate)('buy',id);
 else if(a==='list'){if(r.listed[id])delete r.listed[id];else{r.listed[id]=season();toast('Joueur placé sur la liste des transferts : les offres arrivent au fil des journées')}save();render()}
 else if(a==='accept')acceptOffer(+el.dataset.i);
 else if(a==='refuse'){r.offers.splice(+el.dataset.i,1);save();render()}
 else if(a==='reset-tactics'){r.tactics={};save();render();toast('Préréglages tactiques rétablis')}
},true);
document.addEventListener('change',e=>{
 const t=e.target;const r=S();
 if(t.matches('[data-rm2t]')){r.tactics[t.dataset.rm2t]=+t.value/100;save();const b=t.parentElement.querySelector('b');if(b)b.textContent=t.value}
 else if(t.matches('[data-rm2ts]')){r.tactics[t.dataset.rm2ts]=t.value;save()}
 else if(t.matches('[data-rm2ask]')){r.askSetPiece=t.checked;save()}
 else if(t.matches('[data-rm2train]')){const k=t.dataset.rm2train;if(k==='intensity')r.training.intensity=+t.value;else r.training.focus[k]=+t.value;save();render()}
 else if(t.id==='rm2Pos'){r.mpos=t.value;render()}else if(t.id==='rm2Max'){r.mmax=t.value;render()}
},true);
document.addEventListener('input',e=>{const t=e.target;if(t.id==='rm2Q'){S().mq=t.value;clearTimeout(C._q);C._q=setTimeout(()=>{render();const q=document.getElementById('rm2Q');if(q){q.focus();q.setSelectionRange(q.value.length,q.value.length)}},350)}},true);

/* ---------- Simulation de journée : semaines d'entraînement même si le club ne joue pas ---------- */
if(typeof playRound==='function'){const before=playRound;playRound=function(){const lid=state.leagueId;const fx=getFixtures(lid);const first=fx.find(f=>!f.result);before();
 if(first&&!fx.some(f=>f.round===first.round&&!f.result)){const mineInRound=fx.some(f=>f.round===first.round&&(f.home===state.clubId||f.away===state.clubId));if(!mineInRound&&lid===club(state.clubId).league){weeklyTraining();save()}}}}
window.RM27_CAREER_V2=C;
})();
