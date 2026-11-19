/* Rugby Manager 27 — V2.3 · Monde de jeu
 * Données : dédoublonnage des joueurs, entraîneurs principaux sourcés, contrats datés.
 * Temps : date de jeu (début le 1er juillet 2026), journées datées, matchs joués dans l'ordre,
 * mercato du 1er juillet au 31 août, budget transferts à chaque intersaison.
 * Recrutement : négociation avec le club (indemnité) puis avec le joueur (salaire, prime, durée) avec jauge de satisfaction.
 * Fiches complètes joueurs et staff (notes sur 20). Ergonomie : rien au-dessus du tableau de bord, menu allégé.
 */
'use strict';
(function(){
const C=window.RM2C,W=window.RM2W={};
const H=s=>RM2.hash(String(s));
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const season=()=>Number(state.rmSeason)||1;
const S=()=>C.S();
const fmtM=v=>(Math.round(v*100)/100).toFixed(2).replace('.',',')+' M€';
const fmtK=v=>Math.round(v*1000).toLocaleString('fr-FR')+' k€';

/* =================== 1. Données =================== */
// Effectifs 2026-2027 complétés par recherche web (fichiers src/v2/data/rosters_web_*.json, source par club)
(function addWebRosters(){
 const files=window.RM27_WEB_ROSTERS||[];const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
 const known=new Set(DATA.players.map(p=>norm(p.name)));let added=0;
 for(const f of files)for(const [cid,r] of Object.entries(f)){if(cid==='_meta'||!club(cid))continue;
  for(const pos of ['PR','HO','LO','BR','SH','FH','CE','WI','FB'])for(const name of r[pos]||[]){const k=norm(name);if(known.has(k))continue;known.add(k);
   const p={id:'web-'+cid+'-'+k.replace(/[^a-z0-9]+/g,'-'),clubId:cid,name,position:pos,status:'source',source:r.src,rosterSeason:'2026-2027 — effectif (recherche web, à vérifier)'};
   DATA.players.push(p);(baseRosters[cid]=baseRosters[cid]||[]).push(p);added++}}
 W.webPlayersAdded=added;
})();
// Dédoublonnage : un même joueur ne peut figurer que dans un seul effectif (priorité aux effectifs de l'hémisphère nord 2026-27).
(function dedupe(){
 const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[’']/g,"'").replace(/\s+/g,' ').trim();
 const leagueOf=id=>club(id)?.league;const seen=new Map(),drop=new Set();
 for(const p of DATA.players){const k=norm(p.name);if(!seen.has(k)){seen.set(k,p);continue}
  const q=seen.get(k);const qs=leagueOf(q.clubId)==='SUPER',ps=leagueOf(p.clubId)==='SUPER';
  if(qs&&!ps){drop.add(q.id);seen.set(k,p)}else drop.add(p.id)}
 if(drop.size){for(let i=DATA.players.length-1;i>=0;i--)if(drop.has(DATA.players[i].id))DATA.players.splice(i,1);
  for(const k of Object.keys(baseRosters))baseRosters[k]=baseRosters[k].filter(p=>!drop.has(p.id))}
 W.duplicatesRemoved=[...drop];
})();
// Entraîneurs principaux 2026-2027 (recherche web, résumés de Wikipédia FR/EN — à vérifier auprès des clubs)
const COACHES={'stade-toulousain':'Ugo Mola','rc-toulon':'Franck Azéma','racing-92':'Patrice Collazo','union-bordeaux-b-gles':'Yannick Bru','stade-rochelais':"Ronan O'Gara",
 'montpellier-h-rault-rugby':'Joan Caudullo','stade-fran-ais-paris':'Paul Gustard','section-paloise':'Sébastien Piqueronies','usa-perpignan':'Laurent Labit','rc-vannes':'Jean-Noël Spitzer',
 'aviron-bayonnais':'Gerard Fraser','castres-olympique':'Xavier Sadourny','asm-clermont-auvergne':'Christophe Urios','lou-rugby':'Karim Ghezal',
 'us-montauban':'Sébastien Tillous-Borde','colomiers-rugby':'Florian Nicot','provence-rugby':'Philippe Saint-André','oyonnax-rugby':'Fabien Cibray','valence-romans-dr-me-rugby':'Romain Terrain',
 'ca-brive':'Grégory Patat','su-agen':'Mauricio Reggiardo','fc-grenoble-rugby':'Jérôme Villegas'};
const SRC_T14='https://fr.wikipedia.org/wiki/Championnat_de_France_de_rugby_%C3%A0_XV_2026-2027',SRC_PD2='https://fr.wikipedia.org/wiki/Championnat_de_France_de_rugby_%C3%A0_XV_de_2e_division_2026-2027';
for(const [cid,name] of Object.entries(COACHES)){
 if(!club(cid))continue;
 const has=(DATA.staff||[]).some(s=>s.clubId===cid&&/principal|manager|directeur sportif/i.test(s.role)&&s.name.toLowerCase().includes(name.split(' ').pop().toLowerCase()));
 const sameName=(DATA.staff||[]).some(s=>s.name===name);
 if(has||sameName)continue;
 DATA.staff.push({id:cid+'-coach-2627',clubId:cid,name,role:'Entraîneur principal',source:club(cid).league==='TOP14'?SRC_T14:SRC_PD2,season:'2026-2027',verification:'recherche web, à vérifier'});
}

/* =================== 2. Temps : dates, calendrier, mercato =================== */
const MOIS=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
const JOURS=['dim.','lun.','mar.','mer.','jeu.','ven.','sam.'];
const toD=s=>{const [y,m,d]=s.split('-').map(Number);return new Date(Date.UTC(y,m-1,d))};
const iso=d=>d.toISOString().slice(0,10);
W.fmtDate=(s,long)=>{const d=toD(s);return (long?JOURS[d.getUTCDay()]+' ':'')+d.getUTCDate()+' '+MOIS[d.getUTCMonth()]+' '+d.getUTCFullYear()};
W.seasonStartYear=()=>2025+season();
function roundDate(lid,round){
 const y=W.seasonStartYear();const d=toD(y+'-09-01');while(d.getUTCDay()!==6)d.setUTCDate(d.getUTCDate()+1);// 1er samedi de septembre
 const k=round-1;d.setUTCDate(d.getUTCDate()+7*k+7*Math.floor(k/6)+(k>=14?14:0));// une semaine sans match toutes les 6 journées, trêve de fin d'année
 return iso(d);
}
W.roundDate=roundDate;
W.fixtureDate=f=>roundDate(club(f.home).league,f.round);
W.date=()=>{const r=S();if(!r.date){const lid=club(state.clubId)?.league;const done=lid?getFixtures(lid).filter(f=>f.result):[];r.date=done.length?W.fixtureDate(done[done.length-1]):W.seasonStartYear()+'-07-01'}return r.date};
W.windowOpen=()=>{const d=W.date();const y=W.seasonStartYear();return d>=y+'-07-01'&&d<=y+'-08-31'};
W.windowText=()=>W.windowOpen()?`Mercato ouvert jusqu’au 31 août ${W.seasonStartYear()}`:`Mercato fermé · réouverture le 1er juillet ${W.seasonStartYear()+1} (joueurs libres toujours recrutables)`;
function setDate(d){const r=S();if(!r.date||d>r.date)r.date=d}
// joue / simule tous les matchs (toutes compétitions) datés avant `limit` (inclus si incl), sauf le match exclu
function catchUp(limit,incl,except){
 let n=0;
 for(const l of leagues)for(const f of getFixtures(l.id)){if(f.result||f===except)continue;const d=W.fixtureDate(f);if(d<limit||(incl&&d===limit)){f.result=rmSimpleSimulateFixture(f);if(typeof rmFinSettleFixture==='function')rmFinSettleFixture(f);n++}}
 return n;
}
W.catchUp=catchUp;
// le match du manager : on joue d'abord tout ce qui précède, puis la date avance
const prevStart=startSimpleMatch;
startSimpleMatch=window.startSimpleMatch=function(f){
 if(f&&!f.result){const d=W.fixtureDate(f);catchUp(d,false,f);setDate(d);save()}
 return prevStart(f);
};
// après le match du manager : le reste de la journée est joué
const prevAfter=C.afterMatch;
C.afterMatch=function(M,f,result,headless){prevAfter(M,f,result,headless);const d=W.fixtureDate(f);setDate(d);if(!headless)catchUp(d,true,f)};
// « Simuler » : avance jusqu'au prochain match du club (inclus), dans l'ordre
playRound=function(){
 const f=fixtureForClub(state.clubId);
 if(!f){toast('Saison terminée : passez à la saison suivante');return}
 const d=W.fixtureDate(f);
 if(!confirm(`Simuler la journée ${f.round} (${W.fmtDate(d,true)}) : ${club(f.home).name} – ${club(f.away).name} ?\nTous les matchs jusqu’à cette date sont joués dans l’ordre.`))return;
 catchUp(d,false,f);setDate(d);
 f.result=rmSimpleSimulateFixture(f);if(typeof rmFinSettleFixture==='function')rmFinSettleFixture(f);
 catchUp(d,true,null);
 save();render();toast(`Journée ${f.round} jouée · ${club(f.home).short||club(f.home).name} ${f.result.home}–${f.result.away} ${club(f.away).short||club(f.away).name}`);
};
// intersaison : nouvelle date et nouveau budget transferts
W.transferBase=()=>{const c=club(state.clubId);const base={TOP14:4.5,PREM:3.6,URC:3,SUPER:2.6,PROD2:1.3}[c.league]||2;return Math.round(base*Math.pow((c.power||72)/75,2)*100)/100};
function initBudget(){const r=S();if(r.tbSeason!==season()){const carry=Math.max(0,r.tb||0)*.25+(r.salesSeason||0)*.5;r.tb=Math.round((W.transferBase()+carry)*100)/100;r.tbSeason=season();r.salesSeason=0;C.news(`Budget transferts de la saison : ${fmtM(r.tb)}`,'info')}return r.tb}
W.budget=initBudget;
const prevNew=rmStartNewSeason;
rmStartNewSeason=function(){const n=season();prevNew();if(season()>n){S().date=W.seasonStartYear()+'-07-01';initBudget();save();render()}};

/* =================== 3. Valeurs, contrats, notes =================== */
W.endDate=e=>'30/06/'+(2026+e);
W.startDate=pid=>{const d=S().p[pid];return d&&d.from?d.from:'01/07/'+(2026-((H(pid+'deb')%3)+1))};
W.note20=v=>Math.round(clamp(v,1,99)/99*20*10)/10;
const n20=v=>{const x=W.note20(v);return `<b class="rm2-n20 ${x>=15?'hi':x>=11?'mid':'lo'}">${x.toFixed(1).replace('.',',')}</b>`};
// staff : profil de compétences cohérent avec le poste (évaluation du jeu)
const STAFF_SK=[['lead','Management et leadership'],['tac','Tactique'],['att','Attaque'],['def','Défense'],['set','Conquête (mêlée, touche)'],['kck','Jeu au pied'],['phy','Préparation physique'],['you','Formation des jeunes'],['vid','Analyse vidéo'],['med','Suivi médical']];
W.staffSkills=function(s){const base=staffSkill(s),r=s.role.toLowerCase();const out={};
 for(const [k] of STAFF_SK){let v=base-12+(H(s.id+k)%15);
  if(/principal|manager|direction/.test(r)&&['lead','tac'].includes(k))v+=12;
  if(/attaque|compétences|arri/.test(r)&&['att','kck'].includes(k))v+=14;
  if(/défense/.test(r)&&k==='def')v+=16;if(/avants|mêlée|touche/.test(r)&&k==='set')v+=16;
  if(/physique|performance|réathl|sport/.test(r)&&k==='phy')v+=16;if(/analyse|vidéo|recrutement/.test(r)&&k==='vid')v+=16;
  if(/médecin|kiné/.test(r)&&k==='med')v+=22;if(/espoir|jeunes|formation/.test(r)&&k==='you')v+=16;
  out[k]=clamp(v,20,97)}return out};
W.staffContractEnd=s=>{const c=staffContract(s.id);if(c&&c.until)return c.until;return 1+(H(s.id+'ctr')%100<30?1:H(s.id+'ctr')%100<70?2:3)};

/* =================== 4. Pages =================== */
W.openFiche=(kind,id)=>{S().fiche={kind,id,back:state.page==='fiche'?(S().fiche?.back||'effectif'):state.page};state.page='fiche';save();render();window.scrollTo&&window.scrollTo(0,0)};
C.openFiche=id=>W.openFiche('player',id);
function fichePage(){
 const f=S().fiche||{};const back=`<button class="btn ghost" data-rm2w="back">← Retour</button>`;
 if(f.kind==='staff'){
  const s=(DATA.staff||[]).find(x=>x.id===f.id);if(!s)return '<p>Fiche introuvable.</p>'+back;
  const sk=W.staffSkills(s);const emp=staffEmployer(s.id);const mine=emp===state.clubId;const end=W.staffContractEnd(s);
  const ovr=Math.round(Object.values(sk).reduce((a,b)=>a+b,0)/STAFF_SK.length);
  return `<div class="page-head"><div><span class="eyebrow">FICHE STAFF · ${esc(club(emp)?.name||'Libre')}</span><h1>${esc(s.name)}</h1><p>${esc(s.role)} · note globale ${n20(ovr)} / 20</p></div><div class="page-actions">${back}</div></div>
  <div class="twocol"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">CONTRAT</span><h2>Situation contractuelle</h2></div></div>
  <div class="rm2-kv"><div>Club<b>${esc(club(emp)?.name||'Libre')}</b></div><div>Début<b>01/07/${2026-1-(H(s.id+'d')%2)}</b></div><div>Fin de contrat<b>${W.endDate(end)}</b></div><div>Salaire annuel<b>${typeof moneyK==='function'?moneyK(staffAsk(s)):staffAsk(s)+' k€'}</b></div><div>Indemnité de départ<b>${typeof moneyK==='function'?moneyK(staffBuyout(s)):''}</b></div><div>Source<b>${s.source?`<a href="${esc(s.source)}" target="_blank" rel="noopener">${esc(s.verification||'source')}</a>`:'—'}</b></div></div>
  ${!mine?`<p class="text-muted">Pour recruter ce membre du staff, utilisez la page Staff (négociation et indemnité).</p>`:''}</section>
  <section class="panel"><div class="panel-heading"><div><span class="eyebrow">COMPÉTENCES</span><h2>Notes sur 20</h2></div></div><div class="rm2-attrs">${STAFF_SK.map(([k,l])=>`<div><span>${l}</span>${barN(sk[k])}${n20(sk[k])}</div>`).join('')}</div>
  <p class="text-muted">Évaluations du jeu (fictives), cohérentes avec le poste ; elles déterminent l’effet du staff sur l’entraînement et la préparation.</p></section></div>`;
 }
 const p=findPlayer(f.id)||allPlayers(state.clubId).find(x=>x.id===f.id);if(!p)return '<p>Fiche introuvable.</p>'+back;
 const o=C.ovr(p),a=C.attrs(p,o),d=S().p[p.id]||{},cl=C.clubOf(p.id),mine=cl===state.clubId;
 const end=C.contractEnd(p);
 return `<div class="page-head"><div><span class="eyebrow">FICHE JOUEUR · ${esc(club(cl)?.name||(cl==='__fa'?'Libre':'—'))}</span><h1>${esc(p.name)}</h1><p>${esc(C.POSL[p.position]||p.position)} · ${p.status==='test'?'profil de test':C.age(p)+' ans'} · note ${n20(o)} / 20 · potentiel ${esc(String(potTxt(p)))}</p></div><div class="page-actions">${back}${mine&&p.status!=='test'?`<button class="btn primary" data-rm2="renew" data-id="${esc(p.id)}">Prolonger</button>`:''}${!mine&&cl!=='__retired'&&p.status!=='test'?`<button class="btn primary" data-rm2="buy" data-id="${esc(p.id)}">${cl==='__fa'?'Proposer un contrat':'Faire une offre'}</button>`:''}</div></div>
 <div class="twocol"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">CONTRAT</span><h2>Situation contractuelle</h2></div></div>
 <div class="rm2-kv"><div>Club<b>${esc(club(cl)?.name||(cl==='__fa'?'Joueur libre':'—'))}</b></div><div>Début<b>${W.startDate(p.id)}</b></div><div>Fin de contrat<b>${p.status==='test'?'—':W.endDate(end)}</b></div><div>Salaire annuel<b>${fmtK(C.wage(p))}</b></div><div>Prime à la signature<b>${d.bonus?fmtK(d.bonus):'—'}</b></div><div>Valeur estimée<b>${fmtM(C.value(p))}</b></div><div>Moral<b>${Math.round(C.morale(p.id))} / 100</b></div><div>Condition<b>${Math.round(C.condition(p.id)*100)} %</b></div></div>
 <h3>Saison en cours</h3><div class="rm2-kv"><div>Matchs<b>${d.apps||0}</b></div><div>Minutes<b>${d.min||0}</b></div><div>Essais<b>${d.tr||0}</b></div><div>Points<b>${d.pts||0}</b></div><div>Plaquages<b>${d.tk||0}</b></div><div>Forme<b>${C.form(p.id)?.toFixed(1)||'—'}</b></div></div>
 ${p.source?`<p class="text-muted">Source de l’effectif : <a href="${esc(p.source)}" target="_blank" rel="noopener">${esc(p.rosterSeason||'feuille de match')}</a></p>`:p.status==='espoir'?'<p class="text-muted">Espoir formé au club (identité fictive).</p>':''}</section>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">COMPÉTENCES</span><h2>Notes sur 20</h2></div><span class="tag">Note générale ${n20(o)}</span></div>
 <div class="rm2-attrs">${RM2.ATTRS.map(k=>`<div><span>${RM2.ATTR_LABEL[k]}</span>${barN(a[k])}${n20(a[k])}</div>`).join('')}</div>
 <p class="text-muted">Ces notes sont exactement celles utilisées par le moteur de match.</p></section></div>`;
}
function barN(v){return `<span class="rm2-bar"><i style="width:${clamp(v,0,100)}%;background:${v>=75?'#4fc37b':v>=55?'#e5b84a':'#e0584f'}"></i></span>`}
function potTxt(p){if(p.status==='test')return '—';const pot=C.pot(p);if(C.clubOf(p.id)===state.clubId)return W.note20(pot).toFixed(1).replace('.',',')+' / 20';let an=0;try{an=staffEffect(state.clubId,'Analyse')}catch(e){}const err=Math.max(0,6-an*1.5);const e=Math.round(((H(p.id+'scout')%100)/100-.5)*err*2);return `${W.note20(pot+e-2).toFixed(0)}–${W.note20(pot+e+2).toFixed(0)} / 20`}

/* ---------- Négociation : club puis joueur ---------- */
C.openNeg=function(kind,pid){
 const p=findPlayer(pid)||allPlayers(state.clubId).find(x=>x.id===pid);if(!p)return;
 const cl=C.clubOf(pid),free=!cl||cl==='__fa';
 if(kind==='buy'&&!free&&!W.windowOpen()){toast(W.windowText());return}
 initBudget();
 const ask=Math.round(C.value(p)*(1.05+((H(pid+'ask'+season())%20)/100))*100)/100;
 const wage=Math.round(C.wage(p)*(kind==='buy'?1.12:1.06)*1000)/1000;
 S().neg={kind,pid,stage:kind==='buy'&&!free?'club':'player',ask,fee:Math.round(ask*.85*100)/100,clubRounds:0,clubMsg:'',wageAsk:wage,wage,bonus:Math.round(wage*.25*1000)/1000,years:C.age(p)>30?2:3,role:'rotation',playerRounds:0,playerMsg:'',back:state.page};
 state.page='negociation';save();render();
};
function satisfaction(n,p){
 const age=C.age(p),wish=age>=31?2:age<=24?4:3;
 const prestige=((club(state.clubId)?.power||70)-(club(C.clubOf(p.id))?.power||70))*.8;
 const roleWish=C.ovr(p)>=78?'titulaire':C.ovr(p)>=70?'rotation':'espoir';
 const roleGap={titulaire:0,rotation:1,espoir:2}[n.role]-{titulaire:0,rotation:1,espoir:2}[roleWish];
 let s=55+(n.wage/n.wageAsk-1)*160+(n.bonus/(n.wageAsk*.25)-1)*10-Math.abs(n.years-wish)*6+prestige-(roleGap>0?roleGap*12:0)+(n.kind==='renew'?(C.morale(p.id)-60)*.4:0)-n.playerRounds*4;
 return clamp(Math.round(s),0,100);
}
W.satisfaction=satisfaction;
function negPage(){
 const n=S().neg;if(!n)return '<p>Aucune négociation en cours.</p>';
 const p=findPlayer(n.pid)||allPlayers(state.clubId).find(x=>x.id===n.pid);const cl=C.clubOf(n.pid);
 const tb=initBudget();
 const head=`<div class="page-head"><div><span class="eyebrow">${n.kind==='renew'?'PROLONGATION':'RECRUTEMENT'} · ${W.fmtDate(W.date(),true)}</span><h1>${esc(p.name)}</h1><p>${esc(C.POSL[p.position]||p.position)} · ${C.age(p)} ans · note ${W.note20(C.ovr(p)).toFixed(1).replace('.',',')} / 20 · ${esc(club(cl)?.name||'Joueur libre')} · contrat jusqu’au ${W.endDate(C.contractEnd(p))}</p></div><div class="page-actions"><button class="btn ghost" data-rm2w="neg-cancel">Abandonner</button></div></div>
 <div class="rm2-steps"><span class="${n.stage==='club'?'on':'done'}">1. Accord avec le club</span><span class="${n.stage==='player'?'on':n.stage==='done'?'done':''}">2. Accord avec le joueur</span><span class="${n.stage==='done'?'on':''}">3. Signature</span></div>`;
 if(n.stage==='club'){
  return head+`<section class="panel rm2-negpage"><div class="panel-heading"><div><span class="eyebrow">ÉTAPE 1</span><h2>Négociation avec ${esc(club(cl)?.name||'')}</h2></div><span class="tag">Budget transferts : ${fmtM(tb)}</span></div>
  <p>Le club estime son joueur autour de <b>${fmtM(n.ask)}</b>${C.contractEnd(p)-season()<=0?' (fin de contrat : prix réduit)':''}. Valeur de marché : ${fmtM(C.value(p))}.</p>
  <label class="rm2-field">Indemnité de transfert proposée <input type="number" step="0.05" min="0" id="rm2wFee" value="${n.fee.toFixed(2)}"> M€</label>
  ${n.clubMsg?`<p class="rm2-reply">${n.clubMsg}</p>`:''}
  <div class="rm2-negact"><button class="btn primary" data-rm2w="club-offer">Envoyer l’offre au club</button></div>
  <p class="text-muted">Trois propositions au maximum. Le club peut faire une contre-proposition.</p></section>`;
 }
 if(n.stage==='player'){
  const sat=satisfaction(n,p);
  return head+`<section class="panel rm2-negpage"><div class="panel-heading"><div><span class="eyebrow">ÉTAPE 2</span><h2>Négociation avec ${esc(p.name)} et son agent</h2></div>${n.fee?`<span class="tag">Indemnité acceptée : ${fmtM(n.fee)}</span>`:''}</div>
  <p>Le joueur demande environ <b>${fmtK(n.wageAsk)}</b> par an.</p>
  <div class="rm2-negform">
   <label class="rm2-field">Salaire annuel (k€)<input type="range" min="${Math.round(n.wageAsk*1000*.6)}" max="${Math.round(n.wageAsk*1000*1.6)}" step="5" value="${Math.round(n.wage*1000)}" data-rm2neg="wage"><b id="rm2wWage">${fmtK(n.wage)}</b></label>
   <label class="rm2-field">Prime à la signature (k€)<input type="range" min="0" max="${Math.round(n.wageAsk*1000*.8)}" step="5" value="${Math.round(n.bonus*1000)}" data-rm2neg="bonus"><b id="rm2wBonus">${fmtK(n.bonus)}</b></label>
   <label class="rm2-field">Durée du contrat<select data-rm2neg="years">${[1,2,3,4,5].map(y=>`<option value="${y}" ${y===n.years?'selected':''}>${y} saison${y>1?'s':''} (jusqu’au ${W.endDate(season()+y-(W.windowOpen()||n.kind==='buy'?1:0))})</option>`).join('')}</select></label>
   <label class="rm2-field">Statut promis<select data-rm2neg="role"><option value="titulaire" ${n.role==='titulaire'?'selected':''}>Titulaire</option><option value="rotation" ${n.role==='rotation'?'selected':''}>Joueur de rotation</option><option value="espoir" ${n.role==='espoir'?'selected':''}>Espoir / complément</option></select></label>
  </div>
  <div class="rm2-sat"><span>Satisfaction du joueur</span><span class="rm2-satbar"><i id="rm2wSatBar" style="width:${sat}%;background:${sat>=70?'#4fc37b':sat>=45?'#e5b84a':'#e0584f'}"></i></span><b id="rm2wSat">${sat} %</b></div>
  <p class="text-muted" id="rm2wSatTxt">${satText(sat)}</p>
  ${n.playerMsg?`<p class="rm2-reply">${n.playerMsg}</p>`:''}
  <div class="rm2-negact"><button class="btn primary" data-rm2w="player-offer">Proposer ce contrat</button></div>
  <p class="text-muted">Il signe généralement à partir de 70 % de satisfaction. Trois propositions au maximum ; chaque refus le rend un peu plus exigeant.</p></section>`;
 }
 return head+`<section class="panel"><h2>${n.result||'Négociation terminée'}</h2><div class="rm2-negact"><button class="btn primary" data-rm2w="neg-close">Continuer</button></div></section>`;
}
function satText(s){return s>=85?'Enthousiaste : il est prêt à signer.':s>=70?'Satisfait : l’accord est à portée.':s>=45?'Hésitant : améliorez le salaire, la prime ou le statut.':'Mécontent : l’offre est loin de ses attentes.'}
function clubOffer(){
 const n=S().neg,p=findPlayer(n.pid);const fee=+document.getElementById('rm2wFee').value;const tb=initBudget();
 if(!(fee>=0))return;if(fee>tb){n.clubMsg=`Budget transferts insuffisant (${fmtM(tb)}).`;render();return}
 if(fee>state.budget){n.clubMsg=`Trésorerie insuffisante (${fmtM(state.budget)}).`;render();return}
 n.clubRounds++;n.fee=fee;
 const ratio=fee/n.ask;
 if(ratio>=.97||(ratio>=.9&&(H(n.pid+n.clubRounds)%100)<45)){n.stage='player';n.clubMsg='';C.news(`${club(C.clubOf(n.pid)).name} accepte ${fmtM(fee)} pour ${p.name}`,'info')}
 else if(n.clubRounds>=3||ratio<.55){n.stage='done';n.result=`${club(C.clubOf(n.pid)).name} met fin aux discussions.`}
 else{const counter=Math.round((n.ask*(1-.04*n.clubRounds)+fee)/2*100)/100;n.ask=Math.max(counter,fee);n.clubMsg=`« Offre insuffisante. Nous pourrions accepter ${fmtM(counter)}. » (proposition ${n.clubRounds}/3)`}
 save();render();
}
function playerOffer(){
 const n=S().neg,p=findPlayer(n.pid)||allPlayers(state.clubId).find(x=>x.id===n.pid);
 const sat=satisfaction(n,p);n.playerRounds++;
 const need=70+((H(n.pid+'need'+n.playerRounds)%11)-5);
 if(sat>=need){
  const d=(S().p[n.pid]=S().p[n.pid]||{});
  const startSeason=W.windowOpen()?season():season()+1;
  d.wage=Math.round(n.wage*1000)/1000;d.bonus=Math.round(n.bonus*1000)/1000;d.until=(n.kind==='buy'?season():Math.max(season(),C.contractEnd(p)))+n.years-(n.kind==='buy'?(W.windowOpen()?1:0):0);d.role=n.role;d.mor=clamp(55+sat*.4,10,100);
  if(n.kind==='buy'){const from=C.clubOf(n.pid)||'__fa';d.from='01/07/'+W.seasonStartYear();
   if(n.fee>0){if(typeof rmFinLedger==='function')rmFinLedger('Indemnité de transfert · '+p.name,-n.fee,'transfer','transfer:'+n.pid+':'+season());else state.budget-=n.fee;S().tb=Math.round((S().tb-n.fee)*100)/100}
   state.changes.push({playerId:n.pid,from,to:state.clubId,cost:n.fee});}
  if(n.bonus>0){if(typeof rmFinLedger==='function')rmFinLedger('Prime à la signature · '+p.name,-n.bonus,'transfer','bonus:'+n.pid+':'+season()+':'+n.kind);else state.budget-=n.bonus}
  C.invalidate();n.stage='done';n.result=`${p.name} signe jusqu’au ${W.endDate(d.until)} (${fmtK(d.wage)}/an, prime ${fmtK(d.bonus)}).`;C.news(n.result,'good');
 }else if(n.playerRounds>=3||sat<25){n.stage='done';n.result=`${p.name} refuse et met fin aux discussions.`}
 else{n.playerMsg=`« ${sat<45?'C’est très loin de ce que j’attends.':'On se rapproche, mais ce n’est pas encore suffisant.'} » (proposition ${n.playerRounds}/3)`;n.wageAsk=Math.round(n.wageAsk*1.03*1000)/1000}
 save();render();
}

/* ---------- Calendrier daté ---------- */
calendarPage=function(){
 const c=club(state.clubId),fx=getFixtures(c.league).filter(f=>f.home===c.id||f.away===c.id);const next=fixtureForClub(c.id);
 return `<div class="page-head"><div><span class="eyebrow">CALENDRIER SPORTIF · ${W.seasonStartYear()}-${W.seasonStartYear()+1}</span><h1>Calendrier <span class="dot">&</span> résultats</h1><p>${esc(c.name)} · nous sommes le ${W.fmtDate(W.date(),true)} · ${W.windowText()}</p></div></div>
 <div class="panel"><div class="table-wrap"><table><thead><tr><th>DATE</th><th>J.</th><th>DOMICILE</th><th>SCORE</th><th>EXTÉRIEUR</th><th>STATUT</th><th></th></tr></thead><tbody>${fx.map(f=>{const d=W.fixtureDate(f);const isNext=f===next;
  return `<tr class="${isNext?'rm2-next':''}"><td>${W.fmtDate(d,true)}</td><td class="num-rank">J${String(f.round).padStart(2,'0')}</td><td>${iconCrest(club(f.home),'tiny')} <b>${esc(club(f.home).name)}</b></td><td><strong>${f.result?f.result.home+' – '+f.result.away:'–'}</strong></td><td>${iconCrest(club(f.away),'tiny')} <b>${esc(club(f.away).name)}</b></td><td>${f.result?(((f.home===c.id?f.result.home-f.result.away:f.result.away-f.result.home)>0)?'<span class="rm2-pill xv">Victoire</span>':((f.home===c.id?f.result.home-f.result.away:f.result.away-f.result.home)<0)?'<span class="rm2-pill inj">Défaite</span>':'<span class="rm2-pill">Nul</span>'):isNext?'<span class="rm2-pill y">Prochain match</span>':'À venir'}</td>
  <td>${isNext?`<button class="btn primary" data-action="play">▶ Jouer</button> <button class="btn ghost" data-action="simulate-round">⏩ Simuler</button>`:''}</td></tr>`}).join('')}</tbody></table></div>
 <p class="text-muted">Les rencontres se jouent dans l’ordre des dates ; les autres matchs de chaque journée sont joués automatiquement. Dates fictives : un samedi par semaine à partir de septembre, avec des semaines de repos.</p></div>`;
};

/* ---------- Tableau de bord : rien en haut, date et mercato dans le corps ---------- */
const prevHome=homePage;
homePage=function(){
 let h=prevHome();
 h=h.replace(/<button class="btn ghost" data-action="save">[^<]*<\/button>/,'').replace(/<button class="btn primary" data-action="play"[^>]*>[^<]*<\/button>(?=\s*(<button|<\/div>))/,'');
 h=h.replace(/<div class="page-actions">\s*<\/div>/,'');
 if(state.career){const f=fixtureForClub(state.clubId);
  const info=`<section class="panel rm2-today"><div><span class="eyebrow">AUJOURD’HUI</span><h2>${W.fmtDate(W.date(),true)}</h2><p>${W.windowText()} · budget transferts ${fmtM(initBudget())}</p></div>${f?`<div><span class="eyebrow">PROCHAIN MATCH</span><h2>${W.fmtDate(W.fixtureDate(f),true)}</h2><p>J${f.round} · ${esc(club(f.home).name)} – ${esc(club(f.away).name)}</p></div>`:''}</section>`;
  h=h.replace('<div class="dashboard-hero">',info+'<div class="dashboard-hero">');
  if(f)h=h.replace('<span>JOURNÉE '+f.round+'</span>','<span>JOURNÉE '+f.round+' · '+W.fmtDate(W.fixtureDate(f))+'</span>');
 }
 return h;
};
/* ---------- Menu : sans « Base de données » ni « Choisir un club » ---------- */
const prevSide=sidebar;
sidebar=function(){return prevSide().replace(/<button class="nav-item[^"]*" data-page="base">[\s\S]*?<\/button>/,'').replace(/<button class="nav-item[^"]*" data-page="clubs">[\s\S]*?<\/button>/,'').replace('data-action="clubs"','')};
const prevMenu=mainMenu;
mainMenu=function(){let h=prevMenu();if(state.career)h=h.replace('</div></div><div class="launch-bottom">',`<div class="rm2-saveops"><button class="launch-mini" data-rm2w="export">⇩ Exporter ma carrière</button><button class="launch-mini" data-rm2w="import">↥ Restaurer une carrière</button></div></div></div><div class="launch-bottom">`);return h};
/* ---------- Staff : noms cliquables ---------- */
const prevStaff=staffPage;
staffPage=function(){let h=prevStaff();for(const s of DATA.staff||[]){const e=esc(s.name);h=h.split(`<b>${e}</b>`).join(`<button class="rm2-link" data-rm2w="staff" data-id="${esc(s.id)}">${e}</button>`)}return h};
/* ---------- Marché : mercato et budget ---------- */
const prevTransfers=transfersPage;
transfersPage=function(){return prevTransfers().replace('<section class="panel"><div class="rm2-filters">',`<section class="panel rm2-window ${W.windowOpen()?'open':'closed'}"><b>${W.windowText()}</b><span>Budget transferts : ${fmtM(initBudget())} · Trésorerie : ${fmtM(state.budget)}</span></section><section class="panel"><div class="rm2-filters">`)};
/* ---------- Effectif : contrats datés, noms vers la fiche ---------- */
const prevRoster=rosterPage;
rosterPage=function(){return prevRoster().replace(/>S(\d+)<small>/g,(m,e)=>'>'+W.endDate(+e)+'<small>').replace(/<b class="rm2-warn">fin de saison<\/b>/g,'<b class="rm2-warn">'+W.endDate(season())+'</b>')};

/* ---------- Rendu : pages supplémentaires ---------- */
render=function(){
 if(menuOpen){renderMainMenu();return}
 cancelAnimationFrame(animation);animation=null;match=null;const view=document.getElementById('app');view.onclick=null;
 const pages={accueil:homePage,effectif:rosterPage,tactique:tacticsPage,staff:staffPage,calendrier:calendarPage,championnats:standingsPage,transferts:transfersPage,finance:financePage,base:basePage,clubs:clubsPage,fiche:fichePage,negociation:negPage};
 const label={fiche:'Fiche',negociation:'Négociation'}[state.page];
 const hdr=()=>{let h=header().replace(/<span class="date-pill">[^<]*<\/span>/,'<span class="date-pill">'+(state.career?W.fmtDate(W.date()).toUpperCase():'')+'</span>');return label?h.replace(/<b>undefined<\/b>|<b><\/b>/,'<b>'+label+'</b>'):h};
 view.innerHTML=`<aside class="sidebar">${sidebar()}</aside><div class="main-column">${hdr()}<main class="content">${(pages[state.page]||homePage)()}</main><footer class="foot"></footer></div>`;
 attach();
};

/* ---------- Interactions ---------- */
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-rm2w]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();
 const a=el.dataset.rm2w;
 if(a==='back'){state.page=S().fiche?.back||'effectif';render()}
 else if(a==='staff')W.openFiche('staff',el.dataset.id);
 else if(a==='club-offer')clubOffer();
 else if(a==='player-offer')playerOffer();
 else if(a==='neg-cancel'||a==='neg-close'){const back=S().neg?.back||'transferts';S().neg=null;state.page=back==='negociation'?'transferts':back;save();render()}
 else if(a==='export')exportData();
 else if(a==='import')importCareer();
},true);
document.addEventListener('input',e=>{const t=e.target;if(!t.matches('[data-rm2neg]'))return;const n=S().neg;if(!n)return;const k=t.dataset.rm2neg;
 if(k==='wage')n.wage=+t.value/1000;else if(k==='bonus')n.bonus=+t.value/1000;else if(k==='years')n.years=+t.value;else if(k==='role')n.role=t.value;
 const p=findPlayer(n.pid)||allPlayers(state.clubId).find(x=>x.id===n.pid);const s=satisfaction(n,p);
 const set=(id,v)=>{const x=document.getElementById(id);if(x)x.textContent=v};set('rm2wWage',fmtK(n.wage));set('rm2wBonus',fmtK(n.bonus));set('rm2wSat',s+' %');set('rm2wSatTxt',satText(s));
 const bar=document.getElementById('rm2wSatBar');if(bar){bar.style.width=s+'%';bar.style.background=s>=70?'#4fc37b':s>=45?'#e5b84a':'#e0584f'}},true);
document.addEventListener('change',e=>{if(e.target.matches('select[data-rm2neg]'))e.target.dispatchEvent(new Event('input',{bubbles:true}))},true);
window.RM27_WORLD=W;
})();
