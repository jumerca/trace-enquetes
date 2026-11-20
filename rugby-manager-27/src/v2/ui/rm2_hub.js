/* Rugby Manager 27 — V2.6 · Ergonomie, design et contenu
 * - Tableau de bord repensé (rendez-vous du prochain match, forme, météo, alertes, classement, actualités).
 * - Navigation mobile : barre d'onglets en bas d'écran + panneau « Plus ».
 * - Phases finales par compétition, champion, palmarès ; montée / descente Top 14 ↔ Pro D2.
 * - Classements des marqueurs (essais, points) de chaque compétition.
 */
'use strict';
(function(){
const C=window.RM2C,W=window.RM2W,H=s=>RM2.hash(String(s));
const S=()=>C.S();const season=()=>Number(state.rmSeason)||1;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const nm=id=>club(id)?.name||id;

/* =================== Niveau des clubs (hiérarchie 2026-2027 recalée ; les données d'origine étaient incohérentes) =================== */
const POWER={'stade-toulousain':88,'union-bordeaux-b-gles':86,'stade-rochelais':82,'rc-toulon':82,'racing-92':80,'asm-clermont-auvergne':79,'section-paloise':79,'aviron-bayonnais':79,
 'castres-olympique':78,'stade-fran-ais-paris':78,'montpellier-h-rault-rugby':77,'lou-rugby':76,'usa-perpignan':74,'rc-vannes':72,
 'provence-rugby':72,'ca-brive':71,'fc-grenoble-rugby':71,'oyonnax-rugby':70,'us-montauban':70,'colomiers-rugby':69,'uson-nevers':69,'biarritz-olympique':69,
 'su-agen':68,'as-b-ziers-h-rault':68,'valence-romans-dr-me-rugby':67,'nissa-rugby':67,'soyaux-angoul-me-xv':67,'us-dax':66,'stade-aurillacois':66,'rc-narbonnais':66};
for(const c of clubs)if(POWER[c.id])c.power=POWER[c.id];

/* =================== Compétitions : leagues d'origine, montées / descentes =================== */
const ORIG=Object.fromEntries(clubs.map(c=>[c.id,c.league]));
function applyLeagues(){const m=state.rm2&&state.rm2.leagueOf||{};for(const c of clubs)c.league=m[c.id]||ORIG[c.id]}
window.RM2_applyLeagues=applyLeagues;
// nouvelle carrière : on repart des données d'origine (le state précédent est recopié par l'ancien code)
const prevSelect=selectClub;
selectClub=function(id){if(!state.career){state.rm2=null;applyLeagues();state.fixtures={};ensureFixtures()}return prevSelect(id)};
const prevLoad=load;load=function(){const r=prevLoad.apply(this,arguments);applyLeagues();return r};

/* =================== Classement (hors phases finales) =================== */
tableFor=function(lid){
 const t={};clubs.filter(c=>c.league===lid).forEach(c=>t[c.id]={id:c.id,p:0,w:0,d:0,l:0,for:0,against:0,pts:0,tries:0,form:[]});
 for(const f of getFixtures(lid)){if(!f.result||f.playoff)continue;const a=t[f.home],b=t[f.away],r=f.result;if(!a||!b)continue;
  a.p++;b.p++;a.for+=r.home;b.for+=r.away;a.against+=r.away;b.against+=r.home;a.tries+=r.homeTries;b.tries+=r.awayTries;
  if(r.home>r.away){a.w++;b.l++;a.pts+=4;if(r.home-r.away<=7)b.pts++;a.form.push('V');b.form.push('D')}
  else if(r.home<r.away){b.w++;a.l++;b.pts+=4;if(r.away-r.home<=7)a.pts++;b.form.push('V');a.form.push('D')}
  else{a.d++;b.d++;a.pts+=2;b.pts+=2;a.form.push('N');b.form.push('N')}
  if(lid==='TOP14'||lid==='PROD2'){if(r.homeTries-r.awayTries>=3)a.pts++;if(r.awayTries-r.homeTries>=3)b.pts++}else{if(r.homeTries>=4)a.pts++;if(r.awayTries>=4)b.pts++}}
 return Object.values(t).sort((a,b)=>b.pts-a.pts||((b.for-b.against)-(a.for-a.against))||(b.for-a.for));
};

/* =================== Phases finales =================== */
const FORMAT={TOP14:{q:6,label:'Barrages, demi-finales, finale'},PROD2:{q:6,label:'Barrages, demi-finales, finale'},SUPER:{q:6,label:'Barrages, demi-finales, finale'},PREM:{q:4,label:'Demi-finales, finale'},URC:{q:8,label:'Quarts, demi-finales, finale'}};
const STAGE_LABEL={barrage:'Barrage',quart:'Quart de finale',demi:'Demi-finale',finale:'Finale'};
function regularDone(lid){const fx=getFixtures(lid).filter(f=>!f.playoff);return fx.length&&fx.every(f=>f.result)}
function winnerOf(f){const r=f.result;if(!r)return null;if(r.home!==r.away)return r.home>r.away?f.home:f.away;if(r.homeTries!==r.awayTries)return r.homeTries>r.awayTries?f.home:f.away;return f.home}
function poFix(lid,stage,k,home,away,round){return {id:`PO${season()}-${lid}-${stage}-${k}`,home,away,round,result:null,playoff:true,stage,label:STAGE_LABEL[stage]}}
W.progressPlayoffs=function(){
 let created=false;
 for(const l of leagues){const lid=l.id,fmt=FORMAT[lid];if(!fmt||!regularDone(lid))continue;
  const fx=getFixtures(lid),po=fx.filter(f=>f.playoff),lastRound=Math.max(...fx.filter(f=>!f.playoff).map(f=>f.round));
  const seeds=tableFor(lid).map(t=>t.id);
  const stage=s=>po.filter(f=>f.stage===s);
  const done=s=>stage(s).length&&stage(s).every(f=>f.result);
  if(!po.length){
   if(fmt.q===6){fx.push(poFix(lid,'barrage',0,seeds[2],seeds[5],lastRound+1),poFix(lid,'barrage',1,seeds[3],seeds[4],lastRound+1))}
   else if(fmt.q===8){for(let k=0;k<4;k++)fx.push(poFix(lid,'quart',k,seeds[k],seeds[7-k],lastRound+1))}
   else{fx.push(poFix(lid,'demi',0,seeds[0],seeds[3],lastRound+1),poFix(lid,'demi',1,seeds[1],seeds[2],lastRound+1))}
   created=true;C.news(`${l.name} : début des phases finales (${fmt.label.toLowerCase()})`,'info');continue;
  }
  const rank=id=>seeds.indexOf(id);
  if(fmt.q===6&&done('barrage')&&!stage('demi').length){const w=stage('barrage').map(winnerOf).sort((a,b)=>rank(a)-rank(b));const r=stage('barrage')[0].round+1;
   fx.push(poFix(lid,'demi',0,seeds[0],w[1],r),poFix(lid,'demi',1,seeds[1],w[0],r));created=true}
  if(fmt.q===8&&done('quart')&&!stage('demi').length){const w=stage('quart').map(winnerOf).sort((a,b)=>rank(a)-rank(b));const r=stage('quart')[0].round+1;
   fx.push(poFix(lid,'demi',0,w[0],w[3],r),poFix(lid,'demi',1,w[1],w[2],r));created=true}
  if(done('demi')&&!stage('finale').length){const w=stage('demi').map(winnerOf).sort((a,b)=>rank(a)-rank(b));fx.push(poFix(lid,'finale',0,w[0],w[1],stage('demi')[0].round+1));created=true}
  if(done('finale')){const f=stage('finale')[0];const champ=winnerOf(f);const r=S();r.honours=r.honours||[];
   if(!r.honours.some(h=>h.season===season()&&h.league===lid)){const runner=champ===f.home?f.away:f.home;r.honours.push({season:season(),league:lid,champion:champ,runnerUp:runner,score:`${f.result.home}–${f.result.away}`});
    C.news(`🏆 ${nm(champ)} champion ${l.name} ${W.seasonStartYear()}-${W.seasonStartYear()+1} (${nm(f.home)} ${f.result.home}–${f.result.away} ${nm(f.away)})`,champ===state.clubId?'good':'info')}}
 }
 return created;
};
W.leagueFinished=lid=>{const fx=getFixtures(lid);return regularDone(lid)&&(!FORMAT[lid]||fx.some(f=>f.stage==='finale'&&f.result))};
// toute fin de match peut ouvrir l'étape suivante
const prevCatch=W.catchUp;W.catchUp=function(limit,incl,except){let n=0,guard=0;do{n+=prevCatch(limit,incl,except)}while(W.progressPlayoffs()&&guard++<5);return n};
const prevAfter=C.afterMatch;C.afterMatch=function(M,f,res,headless){prevAfter(M,f,res,headless);recordEngineStats(M);W.progressPlayoffs()};
// « Simuler » : s'il ne reste que des phases finales sans le club, on les fait avancer
const prevRound=playRound;
playRound=function(){
 W.progressPlayoffs();
 if(fixtureForClub(state.clubId))return prevRound();
 const lid=club(state.clubId).league;const next=getFixtures(lid).filter(f=>!f.result).sort((a,b)=>a.round-b.round)[0];
 if(!next){toast(W.leagueFinished(lid)?'Saison terminée : passez à la saison suivante depuis le tableau de bord':'Saison terminée');render();return}
 const d=W.fixtureDate(next);W.catchUp(d,true,null);S().date=d>S().date?d:S().date;save();render();toast(`${next.label||'Journée '+next.round} simulée`);
};
// fin de saison : on termine toutes les phases finales, puis montée / descente avant le nouveau calendrier
const prevNew=rmStartNewSeason;
rmStartNewSeason=function(){
 // toutes les compétitions vont au bout (saisons régulières de longueurs différentes, puis phases finales)
 for(const l of leagues)for(const f of getFixtures(l.id))if(!f.result&&!f.playoff)f.result=rmSimpleSimulateFixture(f);
 W.progressPlayoffs();
 for(let g=0;g<6;g++){for(const l of leagues)for(const f of getFixtures(l.id))if(!f.result&&f.playoff&&!(f.home===state.clubId||f.away===state.clubId))f.result=rmSimpleSimulateFixture(f);if(!W.progressPlayoffs())break}
 const n=season();
 // montée / descente (dernier du Top 14 ↔ champion de Pro D2), appliquée au calendrier suivant
 const t14=tableFor('TOP14'),last=t14[t14.length-1]?.id;const pd2=S().honours?.find(h=>h.season===n&&h.league==='PROD2')?.champion;
 const plan=last&&pd2?{down:last,up:pd2}:null;
 if(plan){const r=S();r.leagueOf=r.leagueOf||{};const before={...r.leagueOf};r.leagueOf[plan.down]='PROD2';r.leagueOf[plan.up]='TOP14';applyLeagues();
  prevNew();
  if(season()===n){r.leagueOf=before;applyLeagues();return}
  C.news(`Montée : ${nm(plan.up)} rejoint le Top 14 · Descente : ${nm(plan.down)} en Pro D2`,plan.up===state.clubId?'good':plan.down===state.clubId?'bad':'info');
  if(state.leagueId&&club(state.clubId))state.leagueId=club(state.clubId).league;save();render();return;
 }
 return prevNew();
};
rmCanStartNewSeason=function(){const lid=club(state.clubId).league;return state.career&&getFixtures(lid).length>0&&getFixtures(lid).filter(f=>!f.playoff).every(f=>f.result)&&W.leagueFinished(lid)};

/* =================== Statistiques individuelles (toutes compétitions) =================== */
function LS(){const r=S();if(!r.ls||r.ls.season!==season())r.ls={season:season(),p:{}};return r.ls}
function addStat(pid,club,tr,pts){if(!pid)return;const ls=LS();const e=ls.p[pid]||(ls.p[pid]={c:club,tr:0,pts:0});e.c=club;e.tr+=tr;e.pts+=pts}
function recordEngineStats(M){if(!M||M._statsRecorded)return;M._statsRecorded=true;const ids=[M.home,M.away];
 for(const p of [...M.P,...(M.gone||[])]){if(p.s&&(p.s.tr||p.s.pts))addStat(p.id,ids[p.team],p.s.tr,p.s.pts)}}
const W_TRY={WI:3,FB:2.2,CE:2,BR:1.3,HO:1,SH:1,FH:.8,LO:.6,PR:.5};
C.afterQuick=function(f,r){
 for(const [cid,tries,pts] of [[f.home,r.homeTries,r.home],[f.away,r.awayTries,r.away]]){
  let xv=[];try{xv=lineup(cid).slice(0,15)}catch(e){continue}
  const kicker=xv.find(p=>p.number===10)||xv[0];let left=pts-tries*5;
  for(let k=0;k<tries;k++){let tot=0;for(const p of xv)tot+=W_TRY[p.position]||1;let x=(H(f.id+cid+k)%10000)/10000*tot,pick=xv[0];for(const p of xv){x-=W_TRY[p.position]||1;if(x<=0){pick=p;break}}addStat(pick.id,cid,1,5)}
  if(left>0&&kicker)addStat(kicker.id,cid,0,left);
 }
};
W.leaders=function(lid,key,n=10){const ls=LS();return Object.entries(ls.p).filter(([pid,e])=>club(e.c)?.league===lid&&e[key]>0).sort((a,b)=>b[1][key]-a[1][key]).slice(0,n).map(([pid,e])=>({p:findPlayer(pid)||{id:pid,name:pid},c:e.c,v:e[key]}))};

/* =================== Pages =================== */
const crest=(id,sz='tiny')=>typeof iconCrest==='function'&&club(id)?iconCrest(club(id),sz):'';
function formBadges(id,lid){const t=tableFor(lid).find(x=>x.id===id);const f=(t?.form||[]).slice(-5);return f.length?f.map(x=>`<i class="rm2-fm ${x==='V'?'w':x==='D'?'l':'d'}">${x}</i>`).join(''):'<small class="text-muted">—</small>'}
function avg20(id){try{const xv=lineup(id).slice(0,15);return xv.reduce((s,p)=>s+W.note20(C.ovr(p)),0)/xv.length}catch(e){return 0}}
homePage=function(){
 const c=club(state.clubId),lid=c.league,l=league(lid),f=fixtureForClub(state.clubId),table=tableFor(lid),rank=table.findIndex(t=>t.id===c.id)+1;
 const b=C.board(),r=S(),mine=realPlayers(c.id);const inj=mine.filter(p=>C.injured(p.id)),exp=mine.filter(p=>p.status!=='test'&&C.contractEnd(p)<=season());
 const canNew=rmCanStartNewSeason();
 let next='';
 if(f){const opp=f.home===c.id?f.away:f.home,home=f.home===c.id;const ot=table.find(t=>t.id===opp),orank=table.findIndex(t=>t.id===opp)+1;
  const wx=RM2.makeWeather(RM2.hash('meteo'+season()+f.id),((8+Math.floor(((f.round||1)-1)*9/Math.max(1,l?.rounds||26)))%12)+1);
  const wico={clear:'☀',cloudy:'☁',rain:'🌧',wind:'💨'}[wx.kind];
  next=`<section class="rm2-hero"><div class="rm2-hero-top"><span class="eyebrow">${f.playoff?'PHASES FINALES · '+esc(f.label||''):'PROCHAIN MATCH · JOURNÉE '+f.round} · ${esc(l.name)}</span><span>${W.fmtDate(W.fixtureDate(f),true)} · ${wico} ${wx.label}</span></div>
  <div class="rm2-versus"><div class="rm2-side">${crest(f.home,'lg')}<b>${esc(nm(f.home))}</b><small>${f.home===c.id?rank:orank}e · ${formBadges(f.home,lid)}</small><small>XV ${avg20(f.home).toFixed(1).replace('.',',')}/20</small></div>
  <div class="rm2-vs"><strong>VS</strong><small>${home?'à domicile':'à l’extérieur'}</small></div>
  <div class="rm2-side">${crest(f.away,'lg')}<b>${esc(nm(f.away))}</b><small>${f.away===c.id?rank:orank}e · ${formBadges(f.away,lid)}</small><small>XV ${avg20(f.away).toFixed(1).replace('.',',')}/20</small></div></div>
  <div class="rm2-hero-act"><button class="btn primary" data-action="play">▶ Jouer le match</button><button class="btn ghost" data-action="simulate-round">⏩ Simuler</button><button class="btn ghost" data-page="effectif">Composition</button><button class="btn ghost" data-page="tactique">Tactique</button></div>
  ${W.windowOpen()?`<p class="rm2-hero-note">${W.windowText()} · budget transferts ${(W.budget()).toFixed(2).replace('.',',')} M€ · <button class="rm2-link" data-page="transferts">aller au marché</button></p>`:''}</section>`;}
 else if(canNew){next=`<section class="rm2-hero"><span class="eyebrow">SAISON TERMINÉE</span><h2>${honourLine(lid)}</h2><p>Vous terminez ${rank}e de ${esc(l.name)}. Le bilan de la direction sera fait à l’intersaison.</p><div class="rm2-hero-act"><button class="btn primary" data-rm-next-season="1">↻ Passer à la saison suivante</button></div></section>`}
 else{next=`<section class="rm2-hero"><span class="eyebrow">PHASES FINALES EN COURS</span><h2>Votre saison est terminée</h2><p>Suivez la fin de la compétition.</p><div class="rm2-hero-act"><button class="btn primary" data-action="simulate-round">⏩ Simuler la suite</button><button class="btn ghost" data-page="championnats">Voir le tableau</button></div></section>`}
 const around=table.slice(Math.max(0,rank-3),Math.max(0,rank-3)+5);
 const upcoming=getFixtures(lid).filter(x=>!x.result&&(x.home===c.id||x.away===c.id)).slice(1,4);
 const myStars=mine.map(p=>({p,fm:C.form(p.id)})).filter(x=>x.fm).sort((a,b)=>b.fm-a.fm).slice(0,3);
 const confCol=b.conf>=60?'#4fc37b':b.conf>=35?'#e5b84a':'#e0584f';
 return `<div class="page-head"><div><span class="eyebrow">${esc(c.name)} · SAISON ${W.seasonStartYear()}-${W.seasonStartYear()+1}</span><h1>Bonjour, Manager<span class="dot">.</span></h1><p>${W.fmtDate(W.date(),true)} · ${rank}e de ${esc(l.name)} · trésorerie ${(+state.budget).toFixed(2).replace('.',',')} M€</p></div></div>
 ${next}
 <div class="rm2-grid">
  <section class="panel"><div class="panel-heading"><div><span class="eyebrow">CLASSEMENT</span><h2>${esc(l.name)}</h2></div><button class="inline-link" data-page="championnats">Complet ↗</button></div>
   <table class="rm2-mini">${around.map(t=>`<tr class="${t.id===c.id?'me':''}"><td>${table.indexOf(t)+1}</td><td>${crest(t.id)} ${esc(club(t.id).short&&club(t.id).short.length<18?club(t.id).short:club(t.id).name)}</td><td>${t.p} MJ</td><td><b>${t.pts}</b></td></tr>`).join('')}</table></section>
  <section class="panel"><div class="panel-heading"><div><span class="eyebrow">DIRECTION</span><h2>${esc(b.obj.label)}</h2></div></div>
   <div class="rm2-conf"><span>Confiance</span><span class="rm2-bar" style="width:140px"><i style="width:${b.conf}%;background:${confCol}"></i></span><b>${Math.round(b.conf)}/100</b></div>
   <p class="text-muted">Prévision des dirigeants : ${b.predicted}e.</p></section>
  <section class="panel"><div class="panel-heading"><div><span class="eyebrow">VESTIAIRE</span><h2>Alertes</h2></div><button class="inline-link" data-page="effectif">Effectif ↗</button></div>
   <ul class="rm2-alertlist">${inj.length?`<li>🩹 ${inj.length} blessé(s) : ${inj.slice(0,3).map(p=>esc(p.name)).join(', ')}</li>`:'<li>✅ Aucun blessé</li>'}${exp.length?`<li>✍ ${exp.length} contrat(s) jusqu’au ${W.endDate(season())}</li>`:''}${r.offers.length?`<li>💶 ${r.offers.length} offre(s) pour vos joueurs</li>`:''}${myStars.length?`<li>⭐ En forme : ${myStars.map(x=>esc(x.p.name)+' ('+x.fm.toFixed(1).replace('.',',')+')').join(', ')}</li>`:''}</ul></section>
  <section class="panel"><div class="panel-heading"><div><span class="eyebrow">À VENIR</span><h2>Calendrier</h2></div><button class="inline-link" data-page="calendrier">Tout voir ↗</button></div>
   <ul class="rm2-uplist">${upcoming.map(x=>`<li><small>${W.fmtDate(W.fixtureDate(x))}</small> ${crest(x.home===c.id?x.away:x.home)} ${x.home===c.id?'reçoit':'à'} <b>${esc(nm(x.home===c.id?x.away:x.home))}</b></li>`).join('')||'<li>Plus de match prévu.</li>'}</ul></section>
  <section class="panel rm2-span2"><div class="panel-heading"><div><span class="eyebrow">ACTUALITÉS</span><h2>Le fil du club</h2></div></div>
   <ul class="rm2-news">${r.news.slice(0,8).map(n=>`<li class="${n.k}"><small>S${n.s}</small> ${esc(n.t)}</li>`).join('')||'<li>Aucune actualité.</li>'}</ul></section>
 </div>`;
};
function honourLine(lid){const h=S().honours?.find(x=>x.season===season()&&x.league===lid);return h?`🏆 ${esc(nm(h.champion))} champion (${h.score} contre ${esc(nm(h.runnerUp))})`:'Saison terminée'}
// Championnats : classement + phases finales + marqueurs + palmarès
const prevStand=standingsPage;
standingsPage=function(){
 let h=prevStand();const lid=state.leagueId;const po=getFixtures(lid).filter(f=>f.playoff);
 const fmt=FORMAT[lid];const t=tableFor(lid);
 const bracket=po.length?`<section class="panel"><div class="panel-heading"><div><span class="eyebrow">PHASES FINALES</span><h2>${esc(fmt.label)}</h2></div></div><div class="rm2-bracket">${['quart','barrage','demi','finale'].map(st=>{const ms=po.filter(f=>f.stage===st);return ms.length?`<div class="rm2-col"><h4>${STAGE_LABEL[st]}${ms.length>1?'s':''}</h4>${ms.map(f=>`<div class="rm2-tie ${f.result?'done':''}"><span class="${winnerOf(f)===f.home?'win':''}">${crest(f.home)} ${esc(nm(f.home))}<b>${f.result?f.result.home:''}</b></span><span class="${winnerOf(f)===f.away?'win':''}">${crest(f.away)} ${esc(nm(f.away))}<b>${f.result?f.result.away:''}</b></span><small>${W.fmtDate(W.fixtureDate(f))}</small></div>`).join('')}</div>`:''}).join('')}</div></section>`
  :fmt?`<section class="panel"><div class="panel-heading"><div><span class="eyebrow">PHASES FINALES</span><h2>${esc(fmt.label)}</h2></div></div><p class="text-muted">Qualifiés : les ${fmt.q} premiers du classement.${lid==='TOP14'?' Le 14e descend en Pro D2.':lid==='PROD2'?' Le champion monte en Top 14.':''}</p><div class="rm2-qual">${t.slice(0,fmt.q).map((x,i)=>`<span>${i+1}. ${crest(x.id)} ${esc(nm(x.id))}</span>`).join('')}</div></section>`:'';
 const lead=(key,title)=>{const L=W.leaders(lid,key);return `<div><h4>${title}</h4><ol class="rm2-lead">${L.map(x=>`<li><button class="rm2-link" data-rm2="card" data-id="${esc(x.p.id)}">${esc(x.p.name)}</button> <small>${esc(nm(x.c))}</small><b>${x.v}</b></li>`).join('')||'<li class="text-muted">Pas encore de match joué.</li>'}</ol></div>`};
 const hon=(S().honours||[]).filter(x=>x.league===lid).slice().reverse();
 const extra=`${bracket}<div class="twocol"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">STATISTIQUES</span><h2>Meilleurs marqueurs</h2></div></div><div class="rm2-leads">${lead('tr','Essais')}${lead('pts','Points')}</div></section>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">HISTOIRE</span><h2>Palmarès de la compétition</h2></div></div>${hon.length?`<table class="rm2-mini">${hon.map(x=>`<tr class="${x.champion===state.clubId?'me':''}"><td>${2025+x.season}-${2026+x.season}</td><td>🏆 ${crest(x.champion)} ${esc(nm(x.champion))}</td><td>${x.score}</td><td><small>${esc(nm(x.runnerUp))}</small></td></tr>`).join('')}</table>`:'<p class="text-muted">Le premier champion sera sacré à la fin de cette saison.</p>'}</section></div>`;
 // forme dans le classement
 h=h.replace(/(<tr[^>]*>\s*<td[^>]*>\d+<\/td>)/g,'$1');
 return h.replace(/<section class="notice">[\s\S]*?<\/section>\s*$/,'')+extra;
};
// calendrier : étiquette des phases finales
const prevCal=calendarPage;calendarPage=function(){let h=prevCal();
 const c=state.clubId,next=fixtureForClub(c);
 const cards=getFixtures(club(c).league).filter(f=>f.home===c||f.away===c).map(f=>{const home=f.home===c,opp=home?f.away:f.home;const r=f.result;const my=r?(home?r.home:r.away):null,th=r?(home?r.away:r.home):null;
  const st=r?(my>th?'w':my<th?'l':'d'):'';
  return `<div class="rm2-calcard ${f===next?'next':''} ${st}"><div><small>${W.fmtDate(W.fixtureDate(f),true)} · ${f.playoff?esc(f.label):'J'+f.round}</small><b>${crest(opp)} ${home?'':'@ '}${esc(nm(opp))}</b></div><div class="rm2-calres">${r?`<strong>${my}–${th}</strong>`:f===next?'<button class="btn primary" data-action="play">▶ Jouer</button>':'<span>'+(home?'Domicile':'Extérieur')+'</span>'}</div></div>`}).join('');
 h=h.replace('<div class="panel"><div class="table-wrap">','<div class="rm2-calcards">'+cards+'</div><div class="panel rm2-caltable"><div class="table-wrap">');for(const f of getFixtures(club(state.clubId).league).filter(f=>f.playoff))h=h.replace(`J${String(f.round).padStart(2,'0')}`,`<span class="rm2-pill y">${esc(f.label)}</span>`);return h};

/* =================== Navigation mobile =================== */
const TABS=[['accueil','⌂','Accueil'],['effectif','♙','Effectif'],['calendrier','▦','Matchs'],['transferts','⇄','Mercato'],['plus','☰','Plus']];
const MORE=[['tactique','◇','Tactique & entraînement'],['championnats','♛','Championnats'],['staff','♙','Staff'],['finance','◈','Finances']];
const prevRender=render;
render=function(){
 applyLeagues();
 if(state.career)try{W.progressPlayoffs()}catch(e){}
 prevRender();
 if(menuOpen||!document.querySelector('.main-column'))return;
 const nav=document.createElement('nav');nav.className='rm2-tabbar';
 nav.innerHTML=TABS.map(([p,i,l])=>`<button class="${state.page===p||(p==='plus'&&MORE.some(m=>m[0]===state.page))?'on':''}" ${p==='plus'?'data-rm2tab="plus"':`data-page="${p}"`}><span>${i}</span>${l}</button>`).join('');
 document.getElementById('app').appendChild(nav);
};
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-rm2tab]');
 if(t){e.preventDefault();e.stopImmediatePropagation();let sh=document.querySelector('.rm2-sheet');if(sh){sh.remove();return}
  sh=document.createElement('div');sh.className='rm2-sheet';sh.innerHTML=`<div class="rm2-sheet-in">${MORE.map(([p,i,l])=>`<button data-page="${p}"><span>${i}</span>${l}</button>`).join('')}<button data-action="save"><span>◉</span>Sauvegarder</button><button data-action="main-menu"><span>⌂</span>Menu principal</button></div>`;
  sh.onclick=ev=>{if(ev.target===sh)sh.remove()};document.getElementById('app').appendChild(sh);return}
 if(e.target.closest('.rm2-sheet [data-page],.rm2-sheet [data-action]'))setTimeout(()=>document.querySelector('.rm2-sheet')?.remove(),0);
},true);

// premier affichage : le menu principal avait été dessiné avant le chargement de la V2
setTimeout(()=>{try{if(menuOpen)renderMainMenu();else render()}catch(e){}},0);
window.RM27_HUB={applyLeagues,FORMAT};
})();
