
/* Rugby Manager 27 V0.24 — Rugby IQ / Continuité : autonome */
'use strict';
const DATA = window.RM27_DATA;
const $ = (q,base=document)=>base.querySelector(q);
const $$=(q,base=document)=>Array.from(base.querySelectorAll(q));
const esc = v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const short = v=>v.length>21 ? v.slice(0,19)+'…':v;
const POS=['PR','HO','PR','LO','LO','BR','BR','BR','SH','FH','WI','CE','CE','WI','FB'];
const LABEL={PR:'Pilier',HO:'Talonneur',LO:'2e ligne',BR:'3e ligne',SH:'Demi de mêlée',FH:'Ouvreur',CE:'Centre',WI:'Ailier',FB:'Arrière'};
const FORM=['Mêlée','Touche','Maul','Ruck','Passe','Plaquage'];
const clubs=DATA.clubs, leagues=DATA.leagues;
const club=id=>clubs.find(c=>c.id===id), league=id=>leagues.find(c=>c.id===id);
const baseRosters={};DATA.players.forEach(p=>(baseRosters[p.clubId]??=[]).push(p));
const seeded=(s)=>{let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0};
const attr=(p,key='overall')=>{const h=seeded(p.id+'-'+key);const c=club(p.clubId);return Math.min(94,Math.round((c?.power||70)-10+(h%22) + (p.status==='test'?-5:0)))};
let state={clubId:'ca-brive',leagueId:'PROD2',page:'accueil',career:false,fixtures:{},tactics:{style:'Équilibré',defense:'Glissée',kick:'Territoire',shape:'1-3-3-1',playbook:'Automatique'},budget:7.5,changes:[],notes:[],imported:[],past:[],formations:{},staffContracts:[],staffAssignments:{},staffOffer:null,staffLedger:[]};
let match=null, canvas=null, ctx=null, animation=null, lastFrame=0;
const storageKey='rugby-manager-27-alpha-v1';
const uiSettingsKey='rm27-matchday-v012';
const defaultUiSettings={tempo:1.5,theme:'forest',names:false,lines:false,pods:false,labels:false,cameraMode:'tv'};
let uiSettings={...defaultUiSettings};try{uiSettings={...uiSettings,...JSON.parse(localStorage.getItem(uiSettingsKey)||'{}')}}catch(e){}
let menuOpen=true,optionsOpen=false,installEvent=null;
function saveUiSettings(){try{localStorage.setItem(uiSettingsKey,JSON.stringify(uiSettings))}catch(e){}applyTheme()}
function applyTheme(){document.body.dataset.theme=uiSettings.theme||'forest'}
applyTheme();
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvent=e;const b=document.getElementById('mainInstall');if(b)b.textContent='Installer l’application ↗'});
window.addEventListener('appinstalled',()=>{installEvent=null;toast('Application installée sur cet appareil')});
if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))navigator.serviceWorker.register('./sw.js').catch(()=>{});
function installApplication(){
 if(installEvent){const e=installEvent;installEvent=null;e.prompt();return}
 const el=document.createElement('div');el.className='install-help';el.innerHTML='<div class="install-card"><h2>Installer Rugby Manager 27</h2><p>Pour installer le jeu comme une application, ouvre la version PWA depuis une adresse <b>HTTPS</b>. Un fichier HTML ouvert depuis les téléchargements ne peut pas déclencher l’installation PWA.</p><p><b>Android / Chrome :</b> menu ⋮ → Ajouter à l’écran d’accueil → Installer, lorsque cette option est proposée.</p><p><b>Ordinateur :</b> utilise l’icône Installer dans la barre d’adresse, si le navigateur la propose.</p><button class="btn primary" id="dismissInstall">Compris</button></div>';document.body.appendChild(el);el.querySelector('button').onclick=()=>el.remove();el.onclick=e=>{if(e.target===el)el.remove()};
}
function mainMenu(){
 const existing=state.career;
 return `<div class="launch-screen"><div class="launch-top"><span class="launch-logo">RM<span>27</span></span><span class="version-note">ÉDITION JOUABLE 1.4 · 2026–2027</span></div>
 <div class="launch-layout"><div class="launch-intro"><span class="launch-overline">SIMULATION DE RUGBY À XV</span><h1>Le rugby.<br><em>À tes commandes.</em></h1><p>66 clubs, cinq compétitions, carrière complète, économie de club et matchs 2D continus. Lance une carrière, joue tes rencontres et sauvegarde ta progression.</p><div class="launch-lines"><span>Top 14 / Pro D2</span><span>PREM / URC / Super Rugby</span></div></div>
 <div class="launch-card"><span class="eyebrow">MENU PRINCIPAL</span>
 <button class="launch-action emphasis" data-main="new"><span>01</span><b>Nouvelle carrière</b><i>→</i></button>
 <button class="launch-action" data-main="load" ${!existing?'disabled title="Aucune carrière sauvegardée"':''}><span>02</span><b>Charger ma carrière</b><i>→</i></button>
 <button class="launch-action" data-main="options"><span>03</span><b>Options & paramètres</b><i>↗</i></button>
 <button id="mainInstall" class="launch-action" data-main="install"><span>04</span><b>Installer l’application</b><i>↗</i></button>
 ${existing?`<small class="launch-save">Sauvegarde détectée : ${esc(club(state.clubId)?.name||'Carrière existante')}</small>`:'<small class="launch-save">Commence une carrière pour enregistrer tes progrès.</small>'}
 </div></div><div class="launch-bottom">© RM27 · Édition jouable · Données en partie estimées</div>
 ${optionsOpen?`<div class="options-shade"><div class="options-dialog"><button class="opt-close" data-main="close-options">✕</button><span class="eyebrow">PRÉFÉRENCES</span><h2>Options & paramètres</h2><label>Vitesse du ×1 <strong id="tempoLabel">${uiSettings.tempo.toFixed(2).replace('.',',')} s simulées / s réelle</strong><input id="tempoSetting" type="range" min="0.75" max="3" step="0.25" value="${uiSettings.tempo}"></label><small>À 1,5, un match intégral dure théoriquement près de 53 minutes. Tu peux accélérer quand tu veux.</small><label>Palette graphique <select id="themeSetting"><option value="forest" ${uiSettings.theme==='forest'?'selected':''}>Émeraude & graphite</option><option value="slate" ${uiSettings.theme==='slate'?'selected':''}>Bleu ardoise</option><option value="light" ${uiSettings.theme==='light'?'selected':''}>Clair & sauge</option></select></label><button class="btn primary full" data-main="close-options">Enregistrer les préférences</button></div></div>`:''}</div>`;
}
function mainMenuEvent(e){const btn=e.target.closest('[data-main]');if(!btn)return;const action=btn.dataset.main;
 if(action==='new'){if(state.career&&!confirm('Créer une nouvelle carrière ? La sauvegarde précédente sera remplacée après sélection du club. Exporte-la d’abord si tu veux la conserver.'))return;
  rmClearStore();const old=state;state={...old,clubId:'ca-brive',leagueId:'PROD2',page:'clubs',career:false,fixtures:{},budget:7.5,changes:[],notes:[],imported:[],past:[],formations:{},staffContracts:[],staffAssignments:{},staffOffer:null,staffLedger:[],rmSeason:1,rmSeasonHistory:[]};ensureFixtures();menuOpen=false;render();return;}
 if(action==='load'){if(!load()){toast('Aucune carrière enregistrée');return;}ensureFixtures();menuOpen=false;render();return;}
 if(action==='options'){optionsOpen=true;render();return;}
 if(action==='close-options'){optionsOpen=false;saveUiSettings();render();return;}
 if(action==='install'){installApplication();return;}
}
function renderMainMenu(){cancelAnimationFrame(animation);animation=null;match=null;const v=$('#app');v.innerHTML=mainMenu();v.onclick=mainMenuEvent;
 const t=$('#tempoSetting');if(t)t.oninput=e=>{uiSettings.tempo=Number(e.target.value);$('#tempoLabel').textContent=uiSettings.tempo.toFixed(2).replace('.',',')+' s simulées / s réelle';saveUiSettings()};
 const c=$('#themeSetting');if(c)c.onchange=e=>{uiSettings.theme=e.target.value;saveUiSettings()};}
function openMainMenu(){menuOpen=true;optionsOpen=false;render()}

function save(show=false){
 try{
  const data=JSON.stringify({...state,match:null});
  // Two persistent snapshots; recover from an interrupted/corrupt primary write.
  const old=localStorage.getItem(storageKey);
  if(old){try{const prior=JSON.parse(old);if(prior&&typeof prior==='object'&&club(prior.clubId))localStorage.setItem(storageKey+'-backup',old);}catch(e){}}
  localStorage.setItem(storageKey,data);
  const verify=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(!verify||verify.clubId!==state.clubId)throw Error('Vérification de l’écriture échouée');
  if(show)toast('Carrière enregistrée et vérifiée sur cet appareil');
  return true;
 }catch(e){toast('Sauvegarde impossible : '+e.message+' — exporte ta carrière');return false;}
}
function load(){try{let s=null;for(const key of [storageKey,storageKey+'-backup']){try{const x=JSON.parse(localStorage.getItem(key)||'null');if(x&&club(x.clubId)&&x.fixtures&&typeof x.fixtures==='object'){s=x;break}}catch(e){}}if(s){state={...state,...s};state.tactics={style:'Équilibré',defense:'Glissée',kick:'Territoire',shape:'1-3-3-1',playbook:'Automatique',...(s.tactics||{})};state.staffContracts=Array.isArray(s.staffContracts)?s.staffContracts:[];state.staffAssignments=s.staffAssignments&&typeof s.staffAssignments==='object'?s.staffAssignments:{};state.staffLedger=Array.isArray(s.staffLedger)?s.staffLedger:[];state.staffOffer=null;state.page='accueil';return true}}catch(e){console.warn(e)}return false}
function toast(msg){const el=$('#toast');el.textContent=msg;el.classList.add('active');clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('active'),3400)}
function realPlayers(id){return [...(baseRosters[id]||[]),...state.imported.filter(p=>p.clubId===id)].filter(p=>!state.changes.find(c=>c.playerId===p.id&&c.from===id));}
function allPlayers(id){const purchased=state.changes.filter(c=>c.to===id).map(c=>findPlayer(c.playerId)).filter(Boolean);const real=[...realPlayers(id),...purchased];const occupied=new Set();const placeholders=[];
  const needed={PR:5,HO:3,LO:4,BR:6,SH:3,FH:3,CE:4,WI:4,FB:2};
  for(const [pos,count] of Object.entries(needed)){let n=real.filter(p=>p.position===pos).length;for(let i=n;i<count;i++){placeholders.push({id:`test-${id}-${pos}-${i+1}`,clubId:id,name:`Joueur test ${pos}-${String(i+1).padStart(2,'0')}`,position:pos,status:'test',rosterSeason:'Simulé, identité non vérifiée'});}}
  return [...real,...placeholders];}
function findPlayer(id){return DATA.players.find(p=>p.id===id)||state.imported.find(p=>p.id===id)}
function lineup(id){
 const available=allPlayers(id),used=new Set(),team=[];
 const overrides=id===state.clubId?(state.formations?.[id]||{}):{};
 const reserved=new Set(Object.values(overrides));
 for(const [idx,pos] of POS.entries()){
   const selected=available.find(p=>p.id===overrides[idx]&&p.position===pos&&!used.has(p.id));
   const target=selected||available.find(p=>p.position===pos&&!used.has(p.id)&&!reserved.has(p.id))||available.find(p=>p.position===pos&&!used.has(p.id))||available.find(p=>!used.has(p.id));
   if(!target)throw Error('Groupe insuffisant pour '+id);
   used.add(target.id);team.push({...target,number:idx+1,skill:attr(target),fatigue:100});
 }
 const benches=['HO','PR','PR','LO','BR','SH','FH','CE'];let number=16;
 for(const pos of benches){const target=available.find(p=>p.position===pos&&!used.has(p.id))||available.find(p=>!used.has(p.id));if(target){used.add(target.id);team.push({...target,number:number++,skill:attr(target),fatigue:100});}}
 return team;
}
function setLineupSlot(index,playerId){
 const i=Number(index),p=allPlayers(state.clubId).find(p=>p.id===playerId);
 if(!Number.isInteger(i)||i<0||i>14||!p||p.position!==POS[i]){toast('Ce joueur ne peut pas occuper ce poste');return;}
 const formation=state.formations[state.clubId]||{};
 for(const k of Object.keys(formation))if(formation[k]===playerId)delete formation[k];
 formation[i]=playerId;state.formations[state.clubId]=formation;save();render();toast('Composition mise à jour');
}
function seededFixtures(ids,requestedRounds,leagueId){const padded=ids.map(c=>c.id);if(padded.length%2)padded.push(null);const rounds=[];let rot=[...padded];
 for(let r=0;r<rot.length-1;r++){const games=[];for(let i=0;i<rot.length/2;i++){const a=rot[i],b=rot[rot.length-1-i];if(a&&b)games.push({home:(r+i)%2?b:a,away:(r+i)%2?a:b})}rounds.push(games);rot=[rot[0],rot.at(-1),...rot.slice(1,-1)];}
 const duplicate=rounds.map(r=>r.map(g=>({home:g.away,away:g.home})));
 let total=[...rounds,...duplicate];if(requestedRounds<total.length)total=total.slice(0,requestedRounds);
 else if(requestedRounds>total.length){let extra=0;while(total.length<requestedRounds){const src=rounds[extra%rounds.length];total.push(src.map(g=>extra%2?g:{home:g.away,away:g.home}));extra++;}}
 return total.map((r,i)=>r.map((g,j)=>({...g,id:`${leagueId}-${i}-${j}`,round:i+1,result:null}))).flat();
}
function ensureFixtures(){for(const l of leagues){if(!state.fixtures[l.id])state.fixtures[l.id]=seededFixtures(clubs.filter(c=>c.league===l.id),l.rounds,l.id)}}
function getFixtures(lid){ensureFixtures();return state.fixtures[lid]}
function tableFor(lid){const t={};clubs.filter(c=>c.league===lid).forEach(c=>t[c.id]={id:c.id,p:0,w:0,d:0,l:0,for:0,against:0,pts:0,tries:0});
 for(const f of getFixtures(lid)){if(!f.result)continue;const a=t[f.home],b=t[f.away],r=f.result;a.p++;b.p++;a.for+=r.home;b.for+=r.away;a.against+=r.away;b.against+=r.home;a.tries+=r.homeTries;b.tries+=r.awayTries;
 if(r.home>r.away){a.w++;b.l++;a.pts+=4;if(r.home-r.away<=7)b.pts++}else if(r.home<r.away){b.w++;a.l++;b.pts+=4;if(r.away-r.home<=7)a.pts++}else{a.d++;b.d++;a.pts+=2;b.pts+=2}
 if(lid==='TOP14'||lid==='PROD2'){if(r.homeTries-r.awayTries>=3)a.pts++;if(r.awayTries-r.homeTries>=3)b.pts++}else{if(r.homeTries>=4)a.pts++;if(r.awayTries>=4)b.pts++;}}
 return Object.values(t).sort((a,b)=>b.pts-a.pts||((b.for-b.against)-(a.for-a.against))||(b.for-a.for));}
function fixtureForClub(id){const c=club(id);return getFixtures(c.league).find(f=>!f.result&&(f.home===id||f.away===id))}
function statsFor(id){let done=getFixtures(club(id).league).filter(f=>f.result&&(f.home===id||f.away===id));return done.length}
function unit(v){return typeof v==='number'?v.toFixed(1).replace('.',','):v}
function selectClub(id){if(match){toast('Termine le match avant de changer de club');return}state.clubId=id;state.leagueId=club(id).league;state.career=true;state.page='accueil';save();render()}
function chooseLeague(id){state.leagueId=id;state.page='championnats';save();render()}
function sidebar(){return `<div class="brand"><span class="brand-mark">R<span>27</span></span><div><strong>RUGBY MANAGER</strong><small>ÉDITION JOUABLE · STABILISÉE 1.3</small></div></div>
<div class="side-label">MON CLUB</div><div class="current-club" data-action="clubs"><span class="mini-crest" style="--c:${club(state.clubId).color}">${club(state.clubId).name.slice(0,2).toUpperCase()}</span><div><b>${esc(club(state.clubId).name)}</b><small>${esc(league(club(state.clubId).league).name)}</small></div><span class="chevron">⌄</span></div>
<div class="side-label">CARRIÈRE</div>${[
['accueil','house','Tableau de bord'],['effectif','users','Effectif et composition'],['tactique','network','Tactique & entraînement'],['staff','users','Staff réel 2026-27'],['calendrier','calendar','Calendrier & matchs'],['championnats','trophy','Championnats'],['transferts','arrow-left-right','Marché des transferts'],['finance','wallet','Finances'],['base','database','Base de données'],['clubs','shield','Choisir un club']].map(([id,icon,label])=>`<button class="nav-item ${state.page===id?'selected':''}" data-page="${id}"><span class="nav-icon">${({house:'⌂',users:'♙',network:'◇',calendar:'▦',trophy:'♛','arrow-left-right':'⇄',wallet:'◈',database:'▤',shield:'⬡'})[icon]}</span>${label}</button>`).join('')}
<div class="side-bottom"><button class="subtle-btn home-menu-btn" data-action="main-menu">⌂ Menu principal</button><div class="save-status"><span class="status-dot"></span> Sauvegarde locale</div><button class="subtle-btn" data-action="save">◉ Sauvegarder</button></div>`}
function header(){const cl=club(state.clubId);const playerCt=realPlayers(state.clubId).length;return `<header class="topbar"><div class="breadcrumb">RUGBY MANAGER <span>›</span> <b>${esc(({'accueil':'Accueil','effectif':'Effectif','tactique':'Tactiques','staff':'Staff','calendrier':'Calendrier','championnats':'Compétitions','transferts':'Mercato','finance':'Finances','base':'Données','clubs':'Clubs'})[state.page])}</b></div><div class="header-tools"><span class="top-date">SAISON ${esc(Number(state.rmSeason)>1?`FICTIVE ${2025+state.rmSeason}-${2026+state.rmSeason}`:league(state.leagueId).season)}</span><span class="date-pill">${Number(state.rmSeason)>1?`SAISON ${state.rmSeason}`:"16 OCT 2026"}</span><button class="top-round" data-action="main-menu" title="Ouvrir le menu principal" aria-label="Ouvrir le menu principal">⌂</button><button class="top-round" data-action="save" title="Sauvegarder">⤓</button></div></header>`}
function iconCrest(c,size=''){return `<span class="crest ${size}" style="--c:${esc(c.color)}">${esc(c.name.replace(/\b(rugby|club|stade|rc|fc|us|union|the|de|et|hérault)\b/gi,'').trim().split(' ').slice(0,2).map(v=>v[0]).join('').toUpperCase().slice(0,3)||c.name.slice(0,2).toUpperCase())}</span>`}
function statTile(label,value,sub,accent=''){return `<div class="stat-box"><div class="stat-label">${label}</div><div class="stat-value ${accent}">${value}</div><div class="stat-sub">${sub}</div></div>`}
function homePage(){const c=club(state.clubId),l=league(c.league);const roster=realPlayers(c.id);const sample=c.rosterSeason?.includes('2026 —')||c.rosterSeason?.includes('provisoire');const fixture=fixtureForClub(c.id);const table=tableFor(c.league);const rank=table.findIndex(x=>x.id===c.id)+1;const res=state.fixtures[c.league].filter(f=>f.result&&(f.home===c.id||f.away===c.id)).slice(-3).reverse();
return `<div class="page-head"><div><span class="eyebrow">CARRIÈRE / ${esc(l.name)}</span><h1>Bonjour, Manager<span class="dot">.</span></h1><p>Votre centre de commandement pour la saison ${esc(l.season)}.</p></div><div class="page-actions"><button class="btn ghost" data-action="save">⤓ Sauvegarder</button><button class="btn primary" data-action="play" ${!fixture?'disabled':''}>▶ ${fixture?'Jouer le prochain match':'Saison terminée'}</button></div></div>
<div class="dashboard-hero"><div class="hero-left"><span class="hero-eyebrow">VOTRE PROJET SPORTIF</span><div class="hero-name">${esc(c.name)}</div><div class="hero-city">${esc(c.city)} · ${esc(l.name)}</div><div class="hero-pills"><span>Équipe sélectionnée</span><span>${esc(l.season)}</span></div></div><div class="hero-art"><div class="hero-stripes"></div>${iconCrest(c,'huge')}</div></div>
<div class="metrics">${statTile('POSITION',`${rank}<small>e</small>`,`${table.length} clubs`)}${statTile('JOUEURS SOURCÉS',`${roster.length}<small> joueurs</small>`,sample?'Source saison 2026':'Source(s) renseignée(s)')}${statTile('MATCHS JOUÉS',`${statsFor(c.id)}`,`Sur ${l.rounds} journées`)}${statTile('BUDGET SIMULÉ',`${unit(state.budget)} M€`,'Valeur fictive pour tester','gold')}</div>
<div class="twocol"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">PROCHAINE ÉCHÉANCE</span><h2>${fixture?'Prochain match':'Pas de match programmé'}</h2></div><button class="inline-link" data-page="calendrier">Calendrier ↗</button></div>${fixture?`<div class="fixture-card"><div class="team-block">${iconCrest(club(fixture.home),'lg')}<b>${esc(club(fixture.home).name)}</b><small>DOMICILE</small></div><div class="fixture-center"><span>JOURNÉE ${fixture.round}</span><strong>VS</strong><small>SIMULATION</small></div><div class="team-block">${iconCrest(club(fixture.away),'lg')}<b>${esc(club(fixture.away).name)}</b><small>EXTÉRIEUR</small></div></div><button class="btn primary full" data-action="play">▶ LANCER LE MATCH 2D</button>`:'<div class="empty">La saison simulée est terminée.</div>'}</section>
<section class="panel"><div class="panel-heading"><div><span class="eyebrow">POSITIONNEMENT</span><h2>Tableau de bord sportif</h2></div></div><div class="mini-standing">${table.slice(0,6).map((t,i)=>`<div class="standing-line ${t.id===c.id?'active':''}"><span class="rank">${i+1}</span>${iconCrest(club(t.id),'tiny')}<b>${esc(club(t.id).name)}</b><span>${t.p} MJ</span><strong>${t.pts} PTS</strong></div>`).join('')}</div><button class="inline-link footer-link" data-page="championnats">Voir le classement complet →</button></section></div>
<section class="notice ${roster.length===0?'warning':''}"><span>◉</span><div><b>Transparence des données</b><p>${roster.length?`Ce club dispose de <strong>${roster.length} noms sourcés</strong> (${esc(c.rosterSeason)}). Les éventuelles places restantes sont occupées par des profils « Joueur test », sans identité fictive.`:'Effectif officiel non encore intégré. Le jeu génère uniquement des profils explicitement appelés « Joueur test » pour permettre la simulation.'} Les attributs et budgets sont des valeurs de gameplay, pas des chiffres réels.</p></div><button class="inline-link" data-page="base">Détails ↗</button></section>`}
function rosterPage(){const c=club(state.clubId),original=realPlayers(c.id),players=allPlayers(c.id),starters=lineup(c.id);return `<div class="page-head"><div><span class="eyebrow">GESTION SPORTIVE</span><h1>Effectif <span class="dot">&</span> composition</h1><p>${esc(c.name)} · ${original.length} joueurs référencés · ${players.length-original.length} joueurs tests</p></div><div class="page-actions"><button class="btn ghost" data-page="base">+ Importer effectif</button><button class="btn primary" data-action="play">▶ Match 2D</button></div></div><div class="info-banner">${iconCrest(c)}<div><b>${esc(c.name)}</b><p>${esc(c.rosterSeason||'Effectif non vérifié')} · ${original.length} noms intégrés ${c.rosterSource?`· <a target="_blank" rel="noopener" href="${esc(c.rosterSource)}">Consulter la source ↗</a>`:''}</p></div></div><div class="twocol roster-layout"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">GROUPE PROFESSIONNEL</span><h2>Liste des joueurs</h2></div><span class="tag">${players.length} joueurs</span></div><div class="table-wrap"><table><thead><tr><th>JOUEUR</th><th>POSTE</th><th>NOTE*</th><th>DONNÉE</th></tr></thead><tbody>${players.sort((a,b)=>(['PR','HO','LO','BR','SH','FH','CE','WI','FB'].indexOf(a.position)-['PR','HO','LO','BR','SH','FH','CE','WI','FB'].indexOf(b.position))).map(p=>`<tr><td><b>${esc(p.name)}</b></td><td><span class="pos">${esc(p.position)}</span> ${esc(LABEL[p.position])}</td><td class="score-text">${attr(p)}</td><td><span class="quality ${p.status==='test'?'unverified':p.rosterSeason?.startsWith('2026 —')?'old':''}">${p.status==='test'?'TEST':p.rosterSeason?.startsWith('2026 —')?'2026':'SOURCÉ'}</span></td></tr>`).join('')}</tbody></table></div></section><section class="panel"><div class="panel-heading"><div><span class="eyebrow">GROUPE DE 23</span><h2>Composition automatique</h2></div><span class="tag">${starters.length}/23</span></div><div class="lineup-table">${starters.map((p,i)=>`<div class="lineup-row"><span class="number-box">${p.number}</span>${i<15?`<select class="player-select" data-lineup-slot="${i}" aria-label="Poste ${i+1}" title="Choisir le titulaire n° ${i+1}">${players.filter(x=>x.position===POS[i]).map(x=>`<option value="${esc(x.id)}" ${p.id===x.id?'selected':''}>${esc(x.name)}${x.status==='test'?' (test)':''}</option>`).join('')}</select>`:`<span class="lineup-name">${esc(p.name)}</span>`}<span class="pos">${p.position}</span><strong>${p.skill}</strong></div>`).join('')}</div><div class="panel-footnote">* Notes calculées pour le moteur alpha. Elles ne constituent pas des évaluations réelles des joueurs.</div></section></div>`}
function tacticsPage(){const t=state.tactics;return `<div class="page-head"><div><span class="eyebrow">PRÉPARATION TACTIQUE</span><h1>Votre identité de jeu<span class="dot">.</span></h1><p>Les consignes modifient les décisions du porteur, la défense et les choix de jeu au pied.</p></div><button class="btn primary" data-action="play">▶ Tester en match</button></div><div class="threecols">${[['style','STYLE OFFENSIF',['Équilibré','Jeu au large','Jeu direct','Conservation']],['shape','STRUCTURE D’ATTAQUE',['1-3-3-1','2-4-2']],['playbook','ANNONCE OFFENSIVE',PATTERN_OPTIONS],['defense','ORGANISATION DÉFENSIVE',['Glissée','Montée agressive','Attentiste']],['kick','JEU AU PIED',['Territoire','Conservation','Pression aérienne']]].map(([k,label,options])=>`<div class="panel tactic-card"><span class="eyebrow">${label}</span><h2>${esc(t[k])}</h2><p>${k==='style'?'Modifie le nombre de passes et la préférence pour le contact.':k==='shape'?'Répartit les huit avants en groupes de soutien et organise leur placement après chaque phase.':k==='playbook'?'Une consigne au numéro 9 déclenche des circuits 9–10–12–15, des croisées et des leurres avec réactions défensives.':k==='defense'?'Agit sur l’avancée collective de la ligne défensive.':'Oriente les coups de pied tactiques.'}</p><div class="option-list">${options.map(opt=>`<button data-tactic="${k}" data-value="${esc(opt)}" class="choice ${t[k]===opt?'active':''}"><span class="choice-radio"></span>${esc(opt)}</button>`).join('')}</div></div>`).join('')}</div><section class="notice"><span>◇</span><div><b>Simulation alpha — périmètre honnête</b><p>Les cinq consignes ont des effets concrets sur les probabilités de passe, le placement défensif et les coups de pied. Les mêlées et touches restent des modèles simplifiés ; les structures 1-3-3-1 et 2-4-2 changent le replacement et la circulation du ballon, sans reproduire tous les lancements d'une équipe professionnelle.</p></div></section>`}
function standingsPage(){const lid=state.leagueId,l=league(lid),list=tableFor(lid),fi=getFixtures(lid);return `<div class="page-head"><div><span class="eyebrow">MONDE RUGBY</span><h1>Championnats jouables<span class="dot">.</span></h1><p>66 clubs intégrés dans cinq compétitions · calendriers de démonstration, et non officiels.</p></div><div class="page-actions"><span class="tag big">${l.season}</span><button class="btn primary" data-action="simulate-round">⏩ Simuler une journée</button></div></div><div class="league-select">${leagues.map(x=>`<button class="league-tab ${x.id===lid?'active':''}" data-league="${x.id}"><span class="tab-light" style="background:${x.color}"></span>${esc(x.name)} <small>${clubs.filter(c=>c.league===x.id).length}</small></button>`).join('')}</div><div class="panel"><div class="panel-heading"><div><span class="eyebrow">${esc(l.country)} / ${esc(l.season)}</span><h2>Classement — ${esc(l.name)}</h2></div><span class="tag">${l.rounds} journées simulables</span></div><div class="table-wrap"><table class="rank-table"><thead><tr><th>#</th><th>CLUB</th><th>PAYS</th><th>MJ</th><th>G</th><th>N</th><th>P</th><th>DIFF.</th><th>PTS</th><th></th></tr></thead><tbody>${list.map((x,i)=>{const c=club(x.id);return `<tr class="${x.id===state.clubId?'row-current':''}"><td class="num-rank">${i+1}</td><td>${iconCrest(c,'tiny')} <b>${esc(c.name)}</b></td><td>${esc(c.country)}</td><td>${x.p}</td><td>${x.w}</td><td>${x.d}</td><td>${x.l}</td><td>${x.for-x.against>0?'+':''}${x.for-x.against}</td><td><strong class="pts">${x.pts}</strong></td><td><button class="small-action" data-select="${c.id}">${x.id===state.clubId?'DIRIGÉ':'DIRIGER →'}</button></td></tr>`}).join('')}</tbody></table></div></div><div class="notice"><span>▦</span><div><b>Calendriers de démonstration</b><p>Les oppositions sont générées de manière cohérente dans chaque ligue. Les dates officielles et règles précises de phases finales ne sont pas encore chargées. L'URC est une ligue unique avec des provinces des cinq nations ; Super Rugby 2027 comporte dix franchises.</p></div></div>`}
function calendarPage(){const c=club(state.clubId),fx=getFixtures(c.league).filter(f=>f.home===c.id||f.away===c.id);return `<div class="page-head"><div><span class="eyebrow">CALENDRIER SPORTIF</span><h1>Calendrier <span class="dot">&</span> résultats</h1><p>${esc(c.name)} · ${fx.length} rencontres fictivement planifiées, résultats simulés.</p></div><div class="page-actions"><button class="btn ghost" data-action="simulate-round">⏩ Simuler la journée</button><button class="btn primary" data-action="play">▶ Jouer le prochain match</button></div></div><div class="panel"><div class="table-wrap"><table><thead><tr><th>JOURNÉE</th><th>DOMICILE</th><th>SCORE</th><th>EXTÉRIEUR</th><th>STATUT</th><th></th></tr></thead><tbody>${fx.map(f=>`<tr><td class="num-rank">J${String(f.round).padStart(2,'0')}</td><td>${iconCrest(club(f.home),'tiny')} <b>${esc(club(f.home).name)}</b></td><td><strong>${f.result?f.result.home+' – '+f.result.away:'—'}</strong></td><td>${iconCrest(club(f.away),'tiny')} <b>${esc(club(f.away).name)}</b></td><td><span class="quality ${f.result?'':'unverified'}">${f.result?'TERMINÉ':'À JOUER'}</span></td><td>${!f.result?`<button class="small-action" data-match-id="${f.id}">▶ Match</button>`:'<span class="text-muted">✓</span>'}</td></tr>`).join('')}</tbody></table></div></div>`}
function transfersPage(){const own=state.clubId,pool=DATA.players.filter(p=>p.clubId!==own).sort((a,b)=>attr(b)-attr(a)).slice(0,85);return `<div class="page-head"><div><span class="eyebrow">RECRUTEMENT</span><h1>Marché des joueurs<span class="dot">.</span></h1><p>Recherche limitée pour cette alpha : joueurs identifiés dans la base vérifiée.</p></div><span class="tag">${DATA.players.length} profils sourcés</span></div><div class="notice"><span>♢</span><div><b>Négociation provisoire</b><p>Les montants proposés sont des coûts fictifs de gameplay, sans rapport avec les rémunérations ou contrats réels. La version actuelle permet des transferts immédiats entre clubs de la base et actualise les effectifs et le budget du club dirigé.</p></div></div><section class="panel"><div class="panel-heading"><div><span class="eyebrow">CIBLES DISPONIBLES DANS LA BASE</span><h2>Recrutement international</h2></div><span class="tag">Budget test : ${unit(state.budget)} M€</span></div><div class="searchbar"><input type="search" id="transferSearch" placeholder="Chercher un joueur ou un club…" aria-label="Rechercher un joueur"></div><div class="table-wrap"><table><thead><tr><th>JOUEUR</th><th>POSTE</th><th>CLUB SOURCE</th><th>NOTE*</th><th>COÛT TEST</th><th></th></tr></thead><tbody id="transfersRows">${transferRows(pool)}</tbody></table></div></section>`}
function transferCost(p){return Math.round((0.15+(attr(p)-50)/150)*10)/10}
function transferRows(players){return players.map(p=>`<tr><td><b>${esc(p.name)}</b></td><td><span class="pos">${p.position}</span></td><td>${esc(club(p.clubId).name)}</td><td>${attr(p)}</td><td>${unit(transferCost(p))} M€*</td><td><button class="small-action" data-recruit="${p.id}" ${state.budget<transferCost(p)||state.changes.some(c=>c.playerId===p.id)?'disabled':''}>Recruter →</button></td></tr>`).join('')}
// Staff 0.8: source-backed identities; all competence and financial values below are gameplay estimates.
const STAFF_DEPARTMENTS=['Encadrement général','Attaque','Défense','Conquête','Préparation physique','Analyse'];
function staffMember(sid){return (DATA.staff||[]).find(s=>s.id===sid)}
function staffContract(sid){return (state.staffContracts||[]).find(c=>c.staffId===sid)}
function staffEmployer(sid){return staffContract(sid)?.to||staffMember(sid)?.clubId}
function staffSpeciality(role){const x=role.toLowerCase();return /principal|direction|manager/.test(x)?'Encadrement général':/attaque|arri[eè]res|skills|comp[eé]tences/.test(x)?'Attaque':/d[eé]fense/.test(x)?'Défense':/avants|m[eê]l[eé]e|touche/.test(x)?'Conquête':/physique|performance|r[eé]athl[eé]tisation|sport/.test(x)?'Préparation physique':'Analyse'}
function staffSkill(s){return 54+seeded('staff-rating-'+s.id)%35} // 54-88 : fiction de gameplay
function staffAsk(s){return Math.round((95+Math.round(staffSkill(s)*2.6)+(s.role.toLowerCase().includes('principal')?72:0))/5)*5} // milliers € / an fictifs
function staffBuyout(s){return Math.round((24+staffSkill(s)*.32)/5)*5} // milliers € fictifs
function currentStaff(id){return (DATA.staff||[]).filter(s=>staffEmployer(s.id)===id)}
function staffEffect(id,dept){let a=currentStaff(id).filter(s=>[dept,'Encadrement général'].includes((state.staffAssignments||{})[s.id]));return a.reduce((v,s)=>v+Math.max(0,staffSkill(s)-55)/10*((state.staffAssignments||{})[s.id]===dept?1:.35),0)}
function moneyK(n){return Math.round(n).toLocaleString('fr-FR')+' k€'}
function renderStaffPerson(s){const hired=!!staffContract(s.id),assigned=state.staffAssignments?.[s.id]||'',canEdit=staffEmployer(s.id)===state.clubId;
 return `<div class="staff-row rm08-row"><span class="staff-avatar">${esc(s.name.split(' ').map(v=>v[0]).slice(0,2).join(''))}</span><div class="rm08-staff-label"><b>${esc(s.name)}</b><small>${esc(s.role)} · ${hired?'Contrat fictif '+staffContract(s.id).years+' an(s)':'Fonction publiée '+esc(s.season)}</small>${canEdit?`<label class="rm08-assign-label">Responsabilité <select data-staff-assign="${esc(s.id)}"><option value="">Non attribuée</option>${STAFF_DEPARTMENTS.map(d=>`<option ${d===assigned?'selected':''}>${d}</option>`).join('')}</select></label>`:''}</div><a href="${esc(s.source)}" target="_blank" rel="noopener noreferrer">Source ↗</a></div>`;
}
function staffNegotiationUI(){const o=state.staffOffer;if(!o)return '';const s=staffMember(o.id);if(!s)return '';
 const cost=(o.salary+o.bonus+o.buyout)/1000;return `<section class="panel rm08-neg" id="staffNegotiate"><div class="panel-heading"><div><span class="eyebrow">NÉGOCIATION · ${esc(o.status==='counter'?'CONTRE-PROPOSITION':'PROPOSITION')}</span><h2>${esc(s.name)}</h2></div><button class="btn ghost" data-staff-action="cancel">✕ Fermer</button></div><div class="rm08-neg-head"><span class="staff-avatar">${esc(s.name.split(' ').map(v=>v[0]).slice(0,2).join(''))}</span><div><b>${esc(s.role)} · ${esc(club(staffEmployer(s.id))?.name||'Club inconnu')}</b><small>Identité vérifiée et rôle d'origine sourcé. Négociation entièrement simulée.</small><div class="rm08-mood">${esc(o.message||'Proposition initiale à préparer.')} · Tour ${o.round}/4</div></div></div><div class="rm08-neg-fields"><label>Salaire annuel fictif (k€)<input id="staffSalary" type="number" min="60" max="950" step="5" value="${o.salary}"></label><label>Prime de signature (k€)<input id="staffBonus" type="number" min="0" max="450" step="5" value="${o.bonus}"></label><label>Durée (années)<select id="staffYears">${[1,2,3,4].map(n=>`<option value="${n}" ${n===o.years?'selected':''}>${n} an${n>1?'s':''}</option>`).join('')}</select></label><label>Responsabilité<select id="staffDept">${STAFF_DEPARTMENTS.map(d=>`<option ${d===o.department?'selected':''}>${d}</option>`).join('')}</select></label></div><p class="rm08-budget-note">Indemnité fictive au club vendeur : ${moneyK(o.buyout)}. Débit immédiat au recrutement : <b>${unit(cost)} M€</b> (prime + première année + indemnité). Les années suivantes restent des engagements contractuels fictifs.</p><div class="page-actions">${o.status==='counter'?`<button class="btn ghost" data-staff-action="accept-counter">✓ Accepter la contre-proposition</button>`:''}<button class="btn primary" data-staff-action="propose">${o.status==='counter'?'↻ Faire une autre offre':'→ Envoyer l’offre'}</button></div></section>`;
}
function staffPage(){const cl=club(state.clubId),team=currentStaff(cl.id),orig=(DATA.staff||[]).filter(s=>s.clubId===cl.id),pool=(DATA.staff||[]).filter(s=>staffEmployer(s.id)!==cl.id),seasonal=(state.staffContracts||[]).filter(x=>x.to===cl.id);
 const q=state.staffSearch||'';const filtered=pool.filter(s=>!q||s.name.toLowerCase().includes(q.toLowerCase())||s.role.toLowerCase().includes(q.toLowerCase())||club(staffEmployer(s.id))?.name.toLowerCase().includes(q.toLowerCase()));
 const groups={};for(const s of team)(groups[state.staffAssignments?.[s.id]||'À affecter']??=[]).push(s);
 const listing=team.length?Object.entries(groups).map(([role,people])=>`<div class="staff-group"><div class="staff-role">${esc(role)}</div>${people.map(renderStaffPerson).join('')}</div>`).join(''):'<div class="empty">Aucune personne sourcée dans le staff de ce club pour l’instant. Le marché conserve les profils identifiés des autres clubs.</div>';
 return `<div class="page-head"><div><span class="eyebrow">MANAGEMENT · V0.8</span><h1>Staff <span class="dot">& négociations.</span></h1><p>${esc(cl.name)} · contrats et attributs de simulation distincts des fonctions officielles.</p></div><button class="btn ghost" data-page="finance">Finances →</button></div><div class="metrics">${statTile('STAFF ACTUEL',team.length+'','Personnes sourcées présentes')}${statTile('RECRUTEMENTS',seasonal.length+'','Dans cette carrière')}${statTile('ENGAGÉ / AN',moneyK(seasonal.reduce((t,c)=>t+c.salary,0)),'Salaires fictifs futurs')}${statTile('SOLDE TEST',unit(state.budget)+' M€','Budget simulé')}</div><div class="notice"><span>◉</span><div><b>Recrutements de simulation, identités sourcées</b><p>Les noms et fonctions publiées proviennent de sources répertoriées. Les évaluations, agents, offres, indemnités, salaires, contrats et changements de club ne sont PAS des informations réelles. Les staffs rejoignent ton club uniquement dans ta sauvegarde.</p></div></div>${staffNegotiationUI()}<section class="panel staff-panel"><div class="panel-heading"><div><span class="eyebrow">MON CLUB · ORGANIGRAMME</span><h2>${esc(cl.name)}</h2></div><span class="tag">${team.length} membre(s)</span></div><div class="staff-list">${listing}</div></section><section class="panel rm08-market"><div class="panel-heading"><div><span class="eyebrow">MARCHÉ INTERNATIONAL SOURCÉ</span><h2>Rechercher et négocier</h2></div><span class="tag">${pool.length} profils potentiels</span></div><div class="rm08-search"><input id="staffSearch" type="search" placeholder="Rechercher un entraîneur, un analyste, un préparateur…" value="${esc(q)}"><span class="text-muted">Compétences affichées : estimations de gameplay</span></div><div class="table-wrap"><table><thead><tr><th>PROFIL</th><th>FONCTION PUBLIÉE</th><th>CLUB ACTUEL (SIM.)</th><th>NIVEAU*</th><th>SALAIRE CIBLE*</th><th></th></tr></thead><tbody id="staffMarketRows">${staffMarketRows(filtered)}</tbody></table></div><div class="panel-footnote">* Données fictives calculées pour les mécanismes de gestion. Nombre de techniciens vérifiés dans la base : ${(DATA.staff||[]).length}. Les staffs des clubs non documentés restent à importer.</div></section>`;
}
function staffMarketRows(items){return items.slice(0,90).map(s=>`<tr><td><b>${esc(s.name)}</b> <a href="${esc(s.source)}" target="_blank" rel="noopener noreferrer" title="Voir la source officielle">↗</a></td><td>${esc(s.role)}</td><td>${esc(club(staffEmployer(s.id))?.name||'—')}</td><td>${staffSkill(s)}*</td><td>${moneyK(staffAsk(s))}/an*</td><td><button class="small-action" data-staff-candidate="${esc(s.id)}">Négocier →</button></td></tr>`).join('')||'<tr><td colspan="6">Aucun profil correspondant.</td></tr>'}
function beginStaffOffer(id){const s=staffMember(id);if(!s||staffEmployer(id)===state.clubId)return toast('Candidat indisponible');const salary=staffAsk(s),bonus=Math.round(salary*.16/5)*5;state.staffOffer={id,salary:salary-25,bonus,years:2,department:staffSpeciality(s.role),buyout:staffBuyout(s),round:1,status:'draft',message:'Le représentant attend une première proposition'};state.page='staff';save();render();}
function staffOfferInputs(){const o=state.staffOffer;if(!o)return null;const salary=Number($('#staffSalary')?.value),bonus=Number($('#staffBonus')?.value),years=Number($('#staffYears')?.value),department=$('#staffDept')?.value;if(!Number.isInteger(salary)||salary<60||salary>950||salary%5||!Number.isInteger(bonus)||bonus<0||bonus>450||bonus%5||!Number.isInteger(years)||years<1||years>4||!STAFF_DEPARTMENTS.includes(department)){toast('Saisie invalide : salaire et prime par tranches de 5 k€');return null;}return {salary,bonus,years,department};}
function hireStaff(o){const s=staffMember(o.id);if(!s||staffEmployer(s.id)===state.clubId)return toast('Ce membre du staff appartient déjà à ce club');const cost=(o.salary+o.bonus+o.buyout)/1000;if(cost>state.budget)return toast('Budget fictif insuffisant pour finaliser');const from=staffEmployer(s.id),staffId=s.id;state.staffContracts.push({staffId,from,to:state.clubId,salary:o.salary,bonus:o.bonus,buyout:o.buyout,years:o.years,responsibility:o.department,season:'2026-2027',fictive:true});state.staffAssignments[staffId]=o.department;state.staffLedger.push({staffId,kind:'Recrutement',amount:cost,at:'2026-2027'});state.budget=+(state.budget-cost).toFixed(3);state.staffOffer=null;save();render();toast(s.name+' rejoint ton staff (simulation)');}
function negotiateStaff(mode){const o=state.staffOffer;if(!o)return; if(mode==='cancel'){state.staffOffer=null;save();render();return;}if(mode==='accept-counter'){if(o.status!=='counter')return;const dept=$('#staffDept')?.value;if(!STAFF_DEPARTMENTS.includes(dept))return toast('Responsabilité invalide');o.department=dept;return hireStaff(o);}const values=staffOfferInputs();if(!values)return;Object.assign(o,values);const s=staffMember(o.id);if(!s)return;
 if(o.round>4)return toast('La négociation est close');const ask=staffAsk(s),bonusNeed=Math.round(ask*.12/5)*5,loyalty=seeded('loyal-'+s.id)%24;
 const enough=o.salary>=ask+loyalty-11 && o.bonus>=Math.max(0,bonusNeed-20) && o.years>=2;
 if(enough)return hireStaff(o);
 if(o.round>=4){o.status='refused';o.message='La discussion est rompue après quatre propositions';state.staffOffer=null;save();render();return toast('Négociation rompue après quatre offres');}
 o.salary=Math.ceil(Math.max(o.salary+10,ask+loyalty-5)/5)*5;o.bonus=Math.max(o.bonus,bonusNeed);o.years=Math.max(2,o.years);o.round++;o.status='counter';o.message='Contre-proposition : le candidat demande une meilleure rémunération et un engagement suffisant';save();render();toast('Le candidat a fait une contre-proposition');}
function assignStaff(id,val){if(staffEmployer(id)!==state.clubId||!STAFF_DEPARTMENTS.includes(val)&&val!=='')return toast('Affectation impossible');if(val)state.staffAssignments[id]=val;else delete state.staffAssignments[id];save();render();toast('Responsabilités du staff actualisées');}
function financePage(){return `<div class="page-head"><div><span class="eyebrow">FINANCES · SIMULATION</span><h1>Économie du club<span class="dot">.</span></h1><p>Écran alpha : le budget ci-dessous est un portefeuille fictif pour tester le recrutement.</p></div></div><div class="metrics">${statTile('BUDGET TEST',unit(state.budget)+' M€','Solde de démonstration')}${statTile('MOUVEMENTS',state.changes.length+'','Transferts simulés')}${statTile('STAFF / AN',moneyK((state.staffContracts||[]).filter(x=>x.to===state.clubId).reduce((a,b)=>a+b.salary,0)),'Engagements fictifs annuels')}${statTile('SALARY CAP','À INTÉGRER','Réglementation non implémentée')}${statTile('RECETTES','À INTÉGRER','Module en développement')}</div><div class="notice warning"><span>!</span><div><b>Attention : pas encore un modèle financier</b><p>Aucun montant ici ne constitue une donnée financière réelle. Les salaires, le salary cap, la trésorerie, la billetterie et les contrats nécessitent un moteur économique distinct et des données documentées.</p></div></div><section class="panel"><div class="panel-heading"><h2>Journal des opérations</h2></div>${state.changes.length?state.changes.map(ch=>`<div class="standing-line">⇄ <b>${esc(findPlayer(ch.playerId)?.name||ch.playerId)}</b><span>${esc(club(ch.from)?.name||'?')} → ${esc(club(ch.to)?.name||'?')}</span><strong>−${unit(ch.cost)} M€</strong></div>`).join(''):'<div class="empty">Aucune opération réalisée.</div>'}${(state.staffContracts||[]).length?`<section class="panel"><div class="panel-heading"><h2>Contrats staff fictifs</h2></div>${state.staffContracts.filter(x=>x.to===state.clubId).map(x=>`<div class="standing-line"><b>${esc(staffMember(x.staffId)?.name||'?')}</b><span>${esc(x.responsibility)} · ${x.years} an(s)</span><strong>${moneyK(x.salary)} / an</strong></div>`).join('')}</section>`:''}` }
function basePage(){const sourceTeams=clubs.filter(c=>baseRosters[c.id]?.length);return `<div class="page-head"><div><span class="eyebrow">BASE DE DONNÉES</span><h1>Sources <span class="dot">&</span> effectifs</h1><p>Aucun nom inventé dans les données sourcées. Les équipes sans roster jouent avec des remplaçants techniques identifiés.</p></div><button class="btn ghost" data-action="export">⇩ Exporter les données</button></div><div class="metrics">${statTile('CLUBS OFFICIELS',clubs.length,'5 championnats jouables')}${statTile('JOUEURS SOURCÉS',DATA.players.length+state.imported.length,'Identités réelles intégrées')}${statTile('CLUBS DOCUMENTÉS',sourceTeams.length+'/'+clubs.length,'Groupes partiels ou complets')}${statTile('SAISON AU 16/10/26','2026 / 2027','Super Rugby : historique 2026')}</div><section class="panel"><div class="panel-heading"><div><span class="eyebrow">MILLÉSIMES ET PROVENANCE</span><h2>État des effectifs importés</h2></div><span class="tag">Vérification humaine requise</span></div><div class="table-wrap"><table><thead><tr><th>CLUB</th><th>COMPÉTITION</th><th>JOUEURS</th><th>RÉFÉRENCE</th><th>SOURCE</th></tr></thead><tbody>${sourceTeams.map(c=>`<tr><td>${iconCrest(c,'tiny')} <b>${esc(c.name)}</b></td><td>${esc(league(c.league).name)}</td><td><strong>${baseRosters[c.id].length}</strong></td><td><span class="quality ${c.rosterSeason.startsWith('2026 —')?'old':''}">${esc(c.rosterSeason)}</span></td><td><a target="_blank" rel="noopener" href="${esc(c.rosterSource)}">Consulter ↗</a></td></tr>`).join('')}</tbody></table></div></section><section class="panel import-panel"><div class="panel-heading"><div><span class="eyebrow">CONTINUITÉ DE CARRIÈRE</span><h2>Exporter et restaurer sa sauvegarde</h2></div></div><p>Export complet de ta partie (matchs, transferts, composition, réglages). Sauvegarde le JSON sur ton ordinateur pour retrouver une carrière dans les prochaines versions.</p><button class="btn ghost" data-action="export">⇩ Exporter ma carrière</button><input type="file" id="careerImport" accept="application/json,.json" aria-label="Importer une sauvegarde de carrière"><button class="btn ghost" data-action="import-career">↥ Restaurer une carrière</button><p class="text-muted">L'import remplace la carrière locale uniquement après confirmation. Conserve toujours une copie de sécurité.</p></section><section class="panel import-panel"><div class="panel-heading"><div><span class="eyebrow">IMPORT PERSONNALISÉ</span><h2>Ajouter des joueurs réels</h2></div></div><p>Charge un JSON de joueurs confirmés. Format : <code>[{"name":"Nom Prénom","clubId":"ca-brive","position":"PR","source":"https://...","rosterSeason":"2026-2027"}]</code>. Un lien de source est obligatoire.</p><input id="importFile" type="file" accept="application/json,.json" aria-label="Importer des joueurs au format JSON"><button class="btn ghost" data-action="import">Importer le fichier sélectionné</button><p class="text-muted">Les ajouts restent locaux à ton navigateur et sont inclus dans la sauvegarde.</p></section>`}
function clubsPage(){return `<div class="page-head"><div><span class="eyebrow">NOUVELLE CARRIÈRE</span><h1>Choisir un club<span class="dot">.</span></h1><p>Tous les clubs sont jouables. Le moteur crée des profils tests là où les effectifs doivent encore être vérifiés.</p></div></div><div class="league-select">${leagues.map(l=>`<button class="league-tab ${state.leagueId===l.id?'active':''}" data-league-filter="${l.id}"><span class="tab-light" style="background:${l.color}"></span>${l.name}</button>`).join('')}</div><div class="club-grid">${clubs.filter(c=>c.league===state.leagueId).map(c=>`<button class="club-tile ${c.id===state.clubId?'current':''}" data-select="${c.id}">${iconCrest(c,'lg')}<b>${esc(c.name)}</b><small>${esc(c.city)}</small><span class="club-roster-info">${baseRosters[c.id]?.length||0} noms vérifiés ${c.rosterSeason?.startsWith('2026 —')?'(2026)':''}</span><span class="club-action">${c.id===state.clubId?'CLUB DIRIGÉ':'PRENDRE LA DIRECTION →'}</span></button>`).join('')}</div>`}
function render(){if(menuOpen){renderMainMenu();return;}cancelAnimationFrame(animation);animation=null;match=null;const view=$('#app');view.onclick=null;view.innerHTML=`<aside class="sidebar">${sidebar()}</aside><div class="main-column">${header()}<main class="content">${({'accueil':homePage,'effectif':rosterPage,'tactique':tacticsPage,'staff':staffPage,'calendrier':calendarPage,'championnats':standingsPage,'transferts':transfersPage,'finance':financePage,'base':basePage,'clubs':clubsPage})[state.page]()}</main><footer class="foot">RUGBY MANAGER 27 · ÉDITION JOUABLE · Mode match 2D tactique simplifié</footer></div>`;attach()}
function attach(){const view=$('#app');view.addEventListener('click',onClick,{once:true});view.querySelectorAll('[data-lineup-slot]').forEach(el=>el.addEventListener('change',e=>setLineupSlot(e.target.dataset.lineupSlot,e.target.value)));const staffSearch=$('#staffSearch');if(staffSearch)staffSearch.addEventListener('input',e=>{state.staffSearch=e.target.value;const q=e.target.value.trim().toLowerCase();$('#staffMarketRows').innerHTML=staffMarketRows((DATA.staff||[]).filter(s=>staffEmployer(s.id)!==state.clubId&&(!q||s.name.toLowerCase().includes(q)||s.role.toLowerCase().includes(q)||club(staffEmployer(s.id))?.name.toLowerCase().includes(q))))});view.querySelectorAll('[data-staff-assign]').forEach(el=>el.addEventListener('change',e=>assignStaff(e.target.dataset.staffAssign,e.target.value)));const search=$('#transferSearch');if(search)search.addEventListener('input',e=>{const query=e.target.value.trim().toLowerCase();const pool=DATA.players.filter(p=>p.clubId!==state.clubId&&!state.changes.some(c=>c.playerId===p.id)).filter(p=>!query||p.name.toLowerCase().includes(query)||club(p.clubId).name.toLowerCase().includes(query));$('#transfersRows').innerHTML=transferRows(pool.slice(0,200))})}
function onClick(e){const el=e.target.closest('[data-action],[data-page],[data-league],[data-select],[data-tactic],[data-match-id],[data-recruit],[data-league-filter],[data-staff-candidate],[data-staff-action]');if(el){if(el.dataset.page){state.page=el.dataset.page;save();render()}else if(el.dataset.league)chooseLeague(el.dataset.league);else if(el.dataset.leagueFilter){state.leagueId=el.dataset.leagueFilter;render()}else if(el.dataset.select)selectClub(el.dataset.select);else if(el.dataset.tactic){state.tactics[el.dataset.tactic]=el.dataset.value;save();render()}else if(el.dataset.matchId)startMatch(getFixtures(club(state.clubId).league).find(f=>f.id===el.dataset.matchId));else if(el.dataset.staffCandidate)beginStaffOffer(el.dataset.staffCandidate);else if(el.dataset.staffAction)negotiateStaff(el.dataset.staffAction);else if(el.dataset.recruit)recruit(el.dataset.recruit);else if(el.dataset.action==='play')startMatch(fixtureForClub(state.clubId));else if(el.dataset.action==='simulate-round')playRound();else if(el.dataset.action==='save')save(true);else if(el.dataset.action==='export')exportData();else if(el.dataset.action==='import')importFile();else if(el.dataset.action==='import-career')importCareer();else if(el.dataset.action==='clubs'){state.page='clubs';render()}else if(el.dataset.action==='main-menu')openMainMenu()}attachClick()}
function attachClick(){if($('#app')){$('#app').removeEventListener('click',onClick);$('#app').addEventListener('click',onClick,{once:true})}}
function recruit(pid){const p=findPlayer(pid);if(!p)return;const cost=transferCost(p);if(state.budget<cost)return toast('Budget de démonstration insuffisant');if(state.changes.some(c=>c.playerId===p.id))return toast('Joueur déjà transféré');if(!confirm(`Transfert de démonstration : ${p.name}\nCoût fictif : ${unit(cost)} M€\nCe n'est PAS une négociation contractuelle réelle. Confirmer ?`))return;state.changes.push({playerId:pid,from:p.clubId,to:state.clubId,cost});state.budget=Math.round((state.budget-cost)*10)/10;save();render();toast('Transfert enregistré dans la carrière (simulation)')}
function exportData(){const f=new Blob([JSON.stringify({metadata:{created:new Date().toISOString(),warning:'Ne pas confondre valeurs simulées et données officielles'},data:DATA,career:state},null,2)],{type:'application/json'});let a=document.createElement('a');a.href=URL.createObjectURL(f);a.download='rugby-manager-27-export.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)}
function importCareer(){
 const input=$('#careerImport'),file=input?.files?.[0];if(!file)return toast('Sélectionner une sauvegarde JSON');
 file.text().then(raw=>{
  if(raw.length>7000000)throw Error('Sauvegarde trop volumineuse');
  const pkg=JSON.parse(raw),candidate=pkg?.career;
  if(!candidate||typeof candidate!=='object'||!club(candidate.clubId)||!league(candidate.leagueId)||!Array.isArray(candidate.changes)||!candidate.fixtures||typeof candidate.fixtures!=='object')throw Error('Format de carrière invalide');
  for(const [lid,fixtures] of Object.entries(candidate.fixtures)){
   if(!league(lid)||!Array.isArray(fixtures)||fixtures.length>700)throw Error('Calendrier invalide');
   for(const f of fixtures){if(!f||typeof f.id!=='string'||!club(f.home)||!club(f.away)||!Number.isInteger(f.round)||f.round<1||f.round>35||((f.result)&&(!Number.isFinite(f.result.home)||!Number.isFinite(f.result.away))))throw Error('Match invalide');}
  }
  if(!confirm('Charger cette carrière ? La sauvegarde locale actuelle sera remplacée. Exportez-la avant de continuer.'))return;
  rmClearStore();state={...state,...candidate,page:'accueil',career:true,staffOffer:null};state.staffContracts=Array.isArray(candidate.staffContracts)?candidate.staffContracts.filter(c=>staffMember(c.staffId)&&club(c.to)&&Number.isFinite(c.salary)&&c.salary>=0):[];state.staffAssignments=candidate.staffAssignments&&typeof candidate.staffAssignments==='object'?candidate.staffAssignments:{};state.staffLedger=Array.isArray(candidate.staffLedger)?candidate.staffLedger:[];ensureFixtures();save();render();toast('Carrière restaurée depuis le fichier');
 }).catch(e=>toast('Import de carrière impossible : '+e.message));
}
function importFile(){const input=$('#importFile'),file=input?.files?.[0];if(!file){toast('Choisis un fichier JSON');return}file.text().then(t=>{const entries=JSON.parse(t);if(!Array.isArray(entries)||entries.length>5000)throw Error('Le fichier doit être un tableau (maximum 5000)');const valid=entries.map((p,i)=>{if(!p||typeof p.name!=='string'||p.name.length<3||!club(p.clubId)||!LABEL[p.position]||!/^https:\/\//.test(p.source||'')||!p.rosterSeason)throw Error('Joueur '+(i+1)+' invalide (nom, clubId, position, source HTTPS, saison obligatoires)');return {name:p.name.slice(0,110),clubId:p.clubId,position:p.position,source:p.source.slice(0,500),rosterSeason:String(p.rosterSeason).slice(0,80),status:'source',id:'import-'+seeded(p.clubId+p.name+p.position)};});const seen=new Set([...DATA.players,...state.imported].map(p=>p.id));state.imported.push(...valid.filter(p=>!seen.has(p.id)));save();render();toast('Import réussi : '+valid.length+' profils analysés')}).catch(e=>toast('Import refusé : '+e.message))}

// MOTEUR DE MATCH : positions réelles (mètres), décisions basées sur l'état, graines déterministes.
// ALPHA 0.2 — moteur déterministe, événements de conquête et choix tactiques par équipe.
const rand=g=>{g.rng^=g.rng<<13;g.rng^=g.rng>>>17;g.rng^=g.rng<<5;return (g.rng>>>0)/4294967296;};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const meters=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const attackDir=t=>t===0?1:-1;
// Repères de calibration (approximations de gameplay, pas des lois sportives).
// Les profils modifient les contacts, la circulation et la couverture — jamais un résultat acquis.
// Référence : bilan Super Rugby Pacific 2026 8,6 essais/match ; URC 2025-26 6,9 ;
// PREM 2025-26 env. 8,6 ; TOP14 phase 2026-27 ~7,2 essais (sources README).
const LEAGUE_PHASE_PROFILE = Object.freeze({
 TOP14:{breakAdjustment:-.019,contactRadius:3.62,ruckSpeed:1.0,passBias:0},
 PROD2:{breakAdjustment:-.029,contactRadius:3.70,ruckSpeed:1.0,passBias:-.015},
 PREM:{breakAdjustment:-.025,contactRadius:3.92,ruckSpeed:1.0,passBias:.02},
 URC:{breakAdjustment:-.135,contactRadius:4.02,ruckSpeed:.99,passBias:0},
 SUPER:{breakAdjustment:-.093,contactRadius:3.89,ruckSpeed:.91,passBias:.035}
});
function phaseProfile(g){return LEAGUE_PHASE_PROFILE[g.home.league]||LEAGUE_PHASE_PROFILE.TOP14;}
const opponentTactics={style:'Équilibré',defense:'Glissée',kick:'Territoire',shape:'1-3-3-1',playbook:'Automatique'};
function gameTactics(g,t){
 const base=g.tacticsBySide[t]||opponentTactics;
 if(t===g.userSide||g.clock<3600)return base;
 const diff=g.score[t]-g.score[1-t],timeLeft=4800-g.clock;
 if(timeLeft>720)return base;
 const style=diff<=-6?'Jeu au large':diff>=5?'Conservation':base.style;
 const kick=diff>=4?'Territoire':diff<=-4?'Conservation':base.kick;
 const defense=diff<=-5?'Montée agressive':diff>=9?'Glissée':base.defense;
 const signature=[style,kick,defense].join('|');
 if(g.aiAdapt?.[t]?.signature===signature)return g.aiAdapt[t].tactic;
 g.aiAdapt=g.aiAdapt||{};
 const tactic={...base,style,kick,defense};g.aiAdapt[t]={signature,tactic};
 return tactic;
}

// V0.27 : arbitrage explicite. Les déclencheurs sont issus de positions, contacts,
// trajectoires et confrontations du moteur ; les probabilités représentent une approximation.
const RM25_PRIORITY = new Set(['try','break','tackle','ruck','interception','referee','lineout','scrum','maul','conversion','score','penalty','kick','miss','turnover','final','card']);
const RM25_LAW = Object.freeze({
 'hors-jeu':'10 / 15','en-avant':'11','obstruction':'9','entrée latérale':'15',
 'conservation au sol':'14 / 15','plaquage dangereux':'9 / 14',
 'mêlée':'19','touche':'18','avantage':'7'
});
function rm25Active(g,p){return p&&!p.sentOff&&!(p.sinBinUntil&&g.clock<p.sinBinUntil)}
function rm25Infringement(g,kind,offenderSide,actor,opts={}){
 const beneficiary=1-offenderSide,reason=opts.reason||kind;
 g.referee??={decisions:[],cards:[],teamFouls:[0,0]};
 g.events.foulsByType??={};g.events.foulsByType[kind]=(g.events.foulsByType[kind]||0)+1;
 g.referee.teamFouls[offenderSide]++;rm25Stat(g,offenderSide,actor,'penalties');
 const decision={kind,reason,law:RM25_LAW[kind]||'loi à préciser',side:offenderSide,beneficiary,
  actorId:actor?.id||null,actor:actor?.name||'Équipe',time:g.clock,x:g.ball.x,y:g.ball.y,
  restart:opts.restart||'penalty'};
 g.referee.decisions.push(decision);
 if(opts.severity&&actor)rm25Card(g,offenderSide,actor,opts.severity,kind);
 if(decision.restart==='scrum'){
  logAction(g,'EN-AVANT — '+decision.actor+' · mêlée pour '+(beneficiary===0?g.home.name:g.away.name),'referee');
  newSetPiece(g,'scrum',beneficiary,g.ball.x,g.ball.y,'Mêlée après '+kind);return decision;
 }
 // La pénalité peut être différée si l'équipe non fautive possède déjà le ballon.
 if(opts.advantage!==false && g.possession===beneficiary && g.mode!=='tackle' && g.mode!=='penalty'){
  if(iq20SetAdvantage(g,beneficiary,reason))return decision;
 }
 addPenalty(g,beneficiary,'FAUTE : '+reason);return decision;
}
function rm25Card(g,side,actor,severity,reason){
 const red=severity>=.93,card=red?'ROUGE':'JAUNE';
 g.referee??={decisions:[],cards:[],teamFouls:[0,0]};
 if(!rm25Active(g,actor))return;
 if(red)actor.sentOff=true;else actor.sinBinUntil=g.clock+600;
 actor.x=-30;actor.y=side===0?8:62;actor.action='sinbin';
 g.referee.cards.push({side,actorId:actor.id,actor:actor.name,card,time:g.clock,reason,until:red?null:g.clock+600});
 g.events.cardsYellow=(g.events.cardsYellow||0)+(red?0:1);
 g.events.cardsRed=(g.events.cardsRed||0)+(red?1:0);
 logAction(g,card+' : '+actor.name+' — '+reason+(red?' · exclusion définitive':' · 10 minutes'),'card');
}
function rm25UpdateDiscipline(g){
 if(!g.referee)return;
 for(let t=0;t<2;t++)for(const p of g.players[t]){
  if(p.sinBinUntil&&g.clock>=p.sinBinUntil){p.sinBinUntil=0;p.x=clamp(g.ball.x-attackDir(t)*12,8,92);p.y=clamp(p.idx*4.3+3,3,67);p.action='return';logAction(g,p.name+' revient après 10 minutes','card');}
 }
}
// Enregistre uniquement les rencontres visionnées : pas de surcharge des saisons simulées.
function rm25Frame(g){
 if(!g.recordingEnabled)return;
 g.replayData??={rolling:[],clips:[],pending:[],nextAt:0,seq:0};
 const r=g.replayData;if(g.clock+0.001<r.nextAt)return;
 r.nextAt=g.clock+.60;
 const snap={clock:+g.clock.toFixed(2),ball:{x:g.ball.x,y:g.ball.y},mode:g.mode,score:g.score.slice(),
  possession:g.possession,carrier:g.carrier,phase:g.phase,players:g.players.map(team=>team.map(p=>[+p.x.toFixed(2),+p.y.toFixed(2),+(p.angle||0).toFixed(2),p.action||'run',!!p.sentOff||!!(p.sinBinUntil&&g.clock<p.sinBinUntil)]))};
 r.rolling.push(snap);if(r.rolling.length>19)r.rolling.shift();
 for(const p of r.pending){p.clip.frames.push(snap);p.left--;}
 r.pending=r.pending.filter(p=>p.left>0);
}
function rm25Highlight(g,e){
 const r=g.replayData;if(!g.recordingEnabled||!r||!RM25_PRIORITY.has(e.type))return;
 // Évite 50 rucks quasiment identiques, favorise les événements déterminants.
 if(['ruck','tackle'].includes(e.type) && r.clips.filter(c=>c.type===e.type).length>=7)return;
 if(['lineout','scrum'].includes(e.type) && r.clips.filter(c=>c.type===e.type).length>=5)return;
 if(r.pending.length>4)return;
 const clip={id:'c'+(++r.seq),type:e.type,text:e.text,time:e.time,clock:g.clock,frames:r.rolling.slice(),event:e};
 r.clips.push(clip);if(r.clips.length>65){const remove=r.clips.findIndex(c=>!['try','card','score','referee','interception'].includes(c.type));r.clips.splice(remove<0?0:remove,1);}
 r.pending.push({clip,left:9});
 e.clipId=clip.id;
}
let rm25Replay=null;
function rm25StartReplay(id){
 if(!match?.replayData)return toast('Aucun ralenti disponible');
 const clips=match.replayData.clips,clip=clips.find(c=>c.id===id)||clips[clips.length-1];
 if(!clip||!clip.frames.length)return toast('Séquence trop courte pour le ralenti');
 rm25Replay={clip,index:0,playing:true,previousPaused:match.paused,last:performance.now()};
 match.paused=true;
 const layer=$('#rm25-replay-overlay');layer.hidden=false;
 $('#rm25-replay-title').textContent=clip.text;
 $('#rm25-replay-time').textContent=clip.time;
 $('#rm25-replay-slider').max=Math.max(0,clip.frames.length-1);
 $('#rm25-replay-slider').value=0;$('#rm25-replay-play').textContent='Ⅱ Pause';
}
function rm25CloseReplay(){if(!rm25Replay)return;const banner=rm25Replay.returnBanner;match.paused=rm25Replay.previousPaused;rm25Replay=null;const layer=$('#rm25-replay-overlay');if(layer)layer.hidden=true;if(banner&&!banner.isConnected){$('.match-layout')?.appendChild(banner);}}
function rm25DrawReplay(){
 if(!rm25Replay||!match)return;
 const r=rm25Replay,clip=r.clip,now=performance.now();
 if(r.playing&&now-r.last>210){r.index=Math.min(clip.frames.length-1,r.index+1);r.last=now;if(r.index>=clip.frames.length-1)r.playing=false;}
 const s=clip.frames[r.index],replayG={...match,clock:s.clock,mode:s.mode,ball:s.ball,score:s.score,
  possession:s.possession,carrier:s.carrier,phase:s.phase,movingBall:null,setPiece:null,contact:null,
  scoreFlash:null,view:{...match.view, cameraMode:match.view.cameraMode==='tactical'?'wide':match.view.cameraMode},
  players:match.players.map((team,t)=>team.map((p,i)=>({...p,x:s.players[t][i][0],y:s.players[t][i][1],angle:s.players[t][i][2],action:s.players[t][i][3]})))};
 drawMatch(replayG);
 $('#rm25-replay-slider').value=r.index;
 $('#rm25-replay-step').textContent=(r.index+1)+' / '+clip.frames.length+' · '+fmtClock(s.clock);
 $('#rm25-replay-play').textContent=r.playing?'Ⅱ Pause':'▶ Lecture';
}
function rm25ReplayControls(action){if(!rm25Replay)return;
 if(action==='close')return rm25CloseReplay();
 if(action==='play'){rm25Replay.playing=!rm25Replay.playing;rm25Replay.last=performance.now();}
 if(action==='back')rm25Replay.index=Math.max(0,rm25Replay.index-1);
 if(action==='forward')rm25Replay.index=Math.min(rm25Replay.clip.frames.length-1,rm25Replay.index+1);
}
function rm25Summary(g){
 const d=g.referee?.decisions||[];const cards=g.referee?.cards||[];
 const clips=g.replayData?.clips||[];
 return `<div class="rm25-report"><h3>Arbitrage et vidéo · V0.27</h3><div class="rm25-minimetrics"><span>Décisions <b>${d.length}</b></span><span>Jaunes <b>${cards.filter(x=>x.card==='JAUNE').length}</b></span><span>Rouges <b>${cards.filter(x=>x.card==='ROUGE').length}</b></span><span>Ralenti(s) <b>${clips.length}</b></span></div><div class="rm25-report-items">${clips.slice().reverse().slice(0,30).map(c=>`<button type="button" data-replay-open="${esc(c.id)}"><b>${esc(c.time)} · ${esc(c.type.toUpperCase())}</b><span>${esc(c.text)}</span><small>▶ Revoir</small></button>`).join('')||'<p>Les extraits sont enregistrés pendant une rencontre visionnée.</p>'}</div><h4>Décisions arbitrales</h4>${d.slice(-15).reverse().map(x=>`<p><b>${esc(fmtClock(x.time))}</b> · ${esc(x.reason)} · loi ${esc(x.law)}</p>`).join('')||'<p>Aucune sanction enregistrée.</p>'}</div>`;
}


// V0.27 — indicateurs strictement tirés des événements joués, aucune statistique tirée au sort.
function rm25MetricsStart(g){
 g.playerStats=g.players.map(team=>Object.fromEntries(team.map(p=>[p.id,{id:p.id,name:p.name,number:p.number,position:p.position,team:p.side,
  passes:0,receives:0,carries:0,metres:0,tries:0,breaks:0,tackles:0,kicks:0,offloads:0,ruckArrivals:0,turnoversWon:0,knockons:0,penalties:0}])));
 g.zoneStats=[{breaks:[0,0,0],rucks:[0,0,0],tries:[0,0,0]},{breaks:[0,0,0],rucks:[0,0,0],tries:[0,0,0]}];
}
function rm25P(g,side,p){if(!g.playerStats||!p)return null;
 if(!g.playerStats[side][p.id])g.playerStats[side][p.id]={id:p.id,name:p.name,number:p.number,position:p.position,team:side,
 passes:0,receives:0,carries:0,metres:0,tries:0,breaks:0,tackles:0,kicks:0,offloads:0,ruckArrivals:0,turnoversWon:0,knockons:0,penalties:0};
 return g.playerStats[side][p.id];}
function rm25Lane(y){return y<23?0:y>47?2:1}
function rm25Stat(g,side,p,key,num=1){const a=rm25P(g,side,p);if(a)a[key]=(a[key]||0)+num;}
function rm25Break(g,side,carrier){rm25Stat(g,side,carrier,'breaks');g.zoneStats[side].breaks[rm25Lane(carrier.y)]++;}
function rm25ReportMetrics(g){
 const cols=['Gauche','Centre','Droite'];
 const zones=cols.map((x,i)=>({name:x,left:g.zoneStats[0].breaks[i],right:g.zoneStats[1].breaks[i],rucks0:g.zoneStats[0].rucks[i],rucks1:g.zoneStats[1].rucks[i]}));
 const totals=t=>Object.values(g.playerStats[t]||{}).filter(p=>p.carries||p.passes||p.tackles||p.tries||p.kicks||p.ruckArrivals).sort((a,b)=>
  (b.tries*8+b.breaks*3+b.tackles*.6+b.passes*.35+b.kicks*.6+b.metres*.06+b.turnoversWon*3)-
  (a.tries*8+a.breaks*3+a.tackles*.6+a.passes*.35+a.kicks*.6+a.metres*.06+a.turnoversWon*3));
 return `<div class="rm25-analysis"><p>Chiffres issus de la simulation, sans notes de performance inventées. Les mètres sont des estimations internes.</p><h4>Franchissements et rucks par couloir</h4>
 <table><thead><tr><th>Couloir</th><th>${esc(g.home.name)}</th><th>${esc(g.away.name)}</th></tr></thead><tbody>${zones.map(z=>`<tr><td>${z.name}</td><td>${z.left} franch. / ${z.rucks0} rucks</td><td>${z.right} franch. / ${z.rucks1} rucks</td></tr>`).join('')}</tbody></table>
 <h4>Points faibles observés</h4><p>${esc(g.home.name)} : ${zones.some(z=>z.right>0)?'débordé davantage '+zones.filter(z=>z.right===Math.max(...zones.map(x=>x.right)))[0].name.toLowerCase():'aucun couloir nettement identifié'}.</p>
 <p>${esc(g.away.name)} : ${zones.some(z=>z.left>0)?'débordé davantage '+zones.filter(z=>z.left===Math.max(...zones.map(x=>x.left)))[0].name.toLowerCase():'aucun couloir nettement identifié'}.</p>
 ${[0,1].map(t=>`<h4>${esc(t===0?g.home.name:g.away.name)} — statistiques individuelles</h4><div class="rm25-player-scroll"><table><thead><tr><th>Joueur</th><th>Ess.</th><th>Franch.</th><th>Pass.</th><th>Plaq.</th><th>Mètres*</th><th>Rucks</th><th>Fautes</th></tr></thead><tbody>${totals(t).map(p=>`<tr><td>${p.number} · ${esc(p.name)}</td><td>${p.tries}</td><td>${p.breaks}</td><td>${p.passes}</td><td>${p.tackles}</td><td>${Math.round(p.metres)}</td><td>${p.ruckArrivals}</td><td>${p.penalties}</td></tr>`).join('')}</tbody></table></div>`).join('')}
 <small>* Mètres estimés par le moteur, non GPS réels.</small></div>`;
}

function makeGame(f){
 const home=lineup(f.home),away=lineup(f.away),userSide=state.clubId===f.home?0:state.clubId===f.away?1:-1;
 const g={id:f.id,fixture:f,home:club(f.home),away:club(f.away),clock:0,score:[0,0],tries:[0,0],possession:0,mode:'kickoff',phase:0,lastAction:'Coup d’envoi',actionTimer:2,rng:seeded('game-v03-'+f.id),eventLog:[],speed:1,paused:false,ended:false,ball:{x:50,y:35},events:{lineoutWins:0,lineoutSteals:0,scrumWins:0,scrumSteals:0,maulMetres:0,passes:0,rucks:0,tackles:0,doubleTackles:0,kicks:0,lineouts:0,conversions:0,penaltyGoals:0,ruckPenalties:0,turnoversWonAtRuck:0,contacts:0,scrums:0,penalties:0,turnovers:0,knockons:0,mauls:0,linebreaks:0,offloads:0,ruckSteals:0,dropAttempts:0,dropGoals:0,passRejections:0,isolatedCarries:0,supportArrivals:0,patternCalls:0,patternCompletions:0,decoyRuns:0,overlaps:0,defensiveReads:0,ruckEntries:0,illegalSideEntries:0,holdingOn:0,highTackles:0,refereeDecisions:0,turnoverPenalties:0},stats:{poss:[0,0],meters:[0,0],phases:[0,0]},players:[home.slice(0,15),away.slice(0,15)],bench:[home.slice(15),away.slice(15)],tactics:JSON.parse(JSON.stringify(state.tactics)),tacticsBySide:[iqTeamStrategy({home:club(f.home),away:club(f.away)},0),iqTeamStrategy({home:club(f.home),away:club(f.away)},1)],userSide,carrier:9,setTimer:3,movingBall:null,substitutions:0,setPiece:null,tackleShield:0,breakaway:0,interventions:[],lastEventType:'kickoff',carryOrigin:50,carrySeconds:0,lastRuckX:50,previousPhase:null,phaseGain:0,attackingMomentum:0,scoreFlash:null,view:{labels:uiSettings.names,lines:uiSettings.lines,pods:uiSettings.pods,zoom:1,focus:false,roles:false,actionCam:false,contacts:true},trails:[],lastCarrierId:null,halfTimeShown:false,contact:null,ruckActors:null,renderTime:0,shapeStats:{podEntries:0,widePasses:0},planDebug:null,attackSequence:null,patternCooldown:0,sequenceCounter:0,decoyBites:{},lastPattern:'Lecture libre',staffMods:[0,0],staffDefenseMods:[0,0],staffConquestMods:[0,0],staffFitnessMods:[0,0],staffAnalysisMods:[0,0],rm26UserOrders:{lineout:'auto',launch:'auto',scrum:'auto',kick:'auto',penalty:'auto'}};
 if(userSide!==-1){g.tacticsBySide[userSide]=g.tactics;g.staffMods[userSide]=clamp(staffEffect(state.clubId,'Attaque')*.007,0,.055);g.staffDefenseMods[userSide]=clamp(staffEffect(state.clubId,'Défense')*.007,0,.055);g.staffConquestMods[userSide]=clamp(staffEffect(state.clubId,'Conquête')*.007,0,.055);g.staffFitnessMods[userSide]=clamp(staffEffect(state.clubId,'Préparation physique')*.007,0,.055);g.staffAnalysisMods[userSide]=clamp(staffEffect(state.clubId,'Analyse')*.007,0,.055);}
 const init=[[23,24],[25,35],[23,46],[27,18],[27,52],[29,22],[29,35],[29,48],[32,35],[34,35],[34,7],[34,25],[34,44],[34,63],[28,35]];
 for(let t=0;t<2;t++)g.players[t]=g.players[t].map((p,i)=>({...p,side:t,idx:i,x:t===0?init[i][0]:100-init[i][0],y:init[i][1],f:100,speed:clamp(4.2+(attr(p,'speed')-65)*0.035,3.2,5.8),angle:t===0?0:Math.PI,action:'set',stride:(i*3)%7,effort:0,stepCycle:(i*1.15)%6.283,angularRate:0,lean:0,previousHeading:t===0?0:Math.PI,jersey:t===0?'home':'away'}));
 g.events.iq24RuckSupport=0;g.events.iq24RuckContest=0;g.events.iq24CollectiveReads=0;g.events.iq22Phases=0;g.events.iq22LinkedPasses=0;g.events.iq22Chains=0;g.events.iq22ReadChanges=0;g.events.iq22Carries=0;g.events.iq22CoverRecoveries=0;g.phasePlan=null;g.events.iqSupportBreaks=0;g.events.iqPressureKicks=0;g.events.iqBackThreeCovers=0;g.events.iqQuickRucks=0;g.events.iqSmartCarries=0;g.events.iqPassLanes=0;g.events.fiftyTwos=0;g.events.advantages=0;g.events.advantagePlayed=0;g.events.advantageCalledBack=0;g.advantage=null;g.ruckReceiver=null;g.events.interceptions=0;g.events.setReleases=0;g.events.ruckExits=0;g.events.tacticalOverloads=0;g.events.offsideAtRuck=0;g.ball={x:33,y:35};g.restartFlight={from:{x:50,y:35},to:{x:33,y:35},duration:g.setTimer,elapsed:0};
 g.referee={decisions:[],cards:[],teamFouls:[0,0]};rm25MetricsStart(g);
 g.events.cardsYellow=0;g.events.cardsRed=0;g.events.obstructions=0;g.events.dangerousTackles=0;
 g.events.foulsByType={};g.recordingEnabled=false;
 return g;
}
function logAction(g,message,type='action'){g.lastAction=message;g.lastEventType=type;const e={time:fmtClock(g.clock),text:message,type,clock:g.clock,side:g.possession,x:g.ball.x,y:g.ball.y};g.eventLog.unshift(e);rm25Highlight(g,e);if(g.eventLog.length>80)g.eventLog.length=80;}
function fmtClock(t){return String(Math.min(80,Math.floor(t/60))).padStart(2,'0')+':'+String(Math.floor(t%60)).padStart(2,'0')}

// V0.21 — Rugby IQ. Coordinates always metres; dir=+1 toward opponent 100m line.
// The ball carrier only throws a backward, reachable ball. Breakaways trigger pursuit support.
const RUGBY_IQ={maxPassLength:17.0,maxBackward:6.8,maxOffload:9.0,minBackward:.25,
                  supportReplan:.42,breakSupportDepth:2.7,defenseRadius:10.8};
// V0.21 — Rugby intelligence. Constraints always expressed in *metres*, not pixels.
// A receiver must be legally behind the ball, physically able to collect it, and not
// obscured by a nearby defensive interceptor. This is a predictive heuristic, not a scripted try.
function iq20Approach(g,side,player,target,seconds=1.25){
 const dx=target.x-player.x,dy=target.y-player.y,dist=Math.hypot(dx,dy);
 const speed=player.speed*(player.f/100*.18+.82);
 return {dist,eta:dist/Math.max(2,speed),can:dist<=speed*seconds+1.4};
}
function iq20LaneRisk(g,from,to,side){
 const dx=to.x-from.x,dy=to.y-from.y,len=Math.hypot(dx,dy)||1;
 let threat=0;
 for(const p of g.players[1-side]){
   const u=clamp(((p.x-from.x)*dx+(p.y-from.y)*dy)/(len*len),0,1);
   const gap=Math.hypot(p.x-(from.x+dx*u),p.y-(from.y+dy*u));
   if(u>.09&&u<.96&&gap<3.0){threat+=(3-gap)/3.0*(p.idx<8?.65:1.0);}
 }
 return threat;
}
function iq20SupportHealth(g,side,carrier){
 const dir=attackDir(side);
 return g.players[side].filter(p=>p.id!==carrier.id&&
  (carrier.x-p.x)*dir>-1.2&&(carrier.x-p.x)*dir<13&&meters(p,carrier)<14).length;
}
function iq20Sweep(g,side,carrier){
 const dir=attackDir(side),def=g.players[1-side];
 const out=def.filter(p=>(p.x-carrier.x)*dir>-14&&Math.abs(p.y-carrier.y)<15)
   .map(p=>({p,eta:iq20Approach(g,1-side,p,{x:carrier.x,y:carrier.y},1).eta}));
 return out.sort((a,b)=>a.eta-b.eta);
}
function iq20SetAdvantage(g,beneficiary,reason,kind='penalty'){
 if(g.advantage)return false;
 g.advantage={team:beneficiary,other:1-beneficiary,reason,kind,x:g.ball.x,y:g.ball.y,
  started:g.clock,initialScore:g.score[beneficiary],initialTerritory:g.ball.x*attackDir(beneficiary)};
 g.events.advantages++;
 logAction(g,'AVANTAGE '+(kind==='scrum'?'MÊLÉE':'PÉNALITÉ')+' — '+reason,'referee');
 return true;
}
function iq20CheckAdvantage(g){
 const a=g.advantage;if(!a||g.ended)return false;
 if(g.score[a.team]>a.initialScore){g.advantage=null;g.events.advantagePlayed++;return false;}
 const progress=(g.ball.x-a.x)*attackDir(a.team),elapsed=g.clock-a.started;
 if(g.possession===a.team&&progress>(a.kind==='scrum'?6:15)&&g.mode!=='ruck'){
  g.advantage=null;g.events.advantagePlayed++;
  logAction(g,'Avantage terminé : bénéfice territorial acquis','referee');return false;
 }
 if(g.possession!==a.team||elapsed>(a.kind==='scrum'?6:9)){
  g.advantage=null;g.events.advantageCalledBack++;
  g.ball={x:a.x,y:a.y};g.movingBall=null;
  if(a.kind==='scrum')newSetPiece(g,'scrum',a.team,a.x,a.y,'Retour à l’en-avant : mêlée');
  else addPenalty(g,a.team,'Retour à l’avantage : '+a.reason);
  return true;
 }
 return false;
}
function iqPassGeometry(g,from,to,offload=false){
 if(!from||!to||from.id===to.id)return false;
 const dir=attackDir(g.possession),back=(from.x-to.x)*dir,lateral=Math.abs(from.y-to.y);
 const dist=meters(from,to),maxDist=offload?RUGBY_IQ.maxOffload:RUGBY_IQ.maxPassLength;
 const limit=offload?4.5:RUGBY_IQ.maxBackward;
 return back>=RUGBY_IQ.minBackward&&back<=limit&&dist<=maxDist&&lateral>=1.7
        &&to.x>=1&&to.x<=99&&to.y>=2&&to.y<=68;
}
function iqNearestSupport(g,carrier){
 return g.players[g.possession].filter(p=>p.id!==carrier.id&&iqPassGeometry(g,carrier,p))
 .sort((a,b)=>meters(a,carrier)-meters(b,carrier));
}
function iqSupportGap(g,team,carrier){
 const own=g.players[team].filter(p=>p.id!==carrier.id);
 return own.reduce((d,p)=>Math.min(d,meters(carrier,p)),99);
}
function iqDefenders(g,carrier,range=10){return g.players[1-g.possession].filter(p=>meters(p,carrier)<range);}
function iqIsolated(g,carrier){return iqNearestSupport(g,carrier).length===0;}
function iqChooseRuckReceiver(g){
 // 9 plays unless the scrum half is engaged, replaced, or unfit; prevents phantom #9.
 const team=g.players[g.possession];
 const nine=team[8];
 if(nine&&!g.ruckActors?.attack?.includes(nine.id)&&meters(nine,g.ball)<7)return 8;
 const backups=team.map((p,i)=>({p,i,d:meters(p,g.ball)}))
   .filter(o=>!g.ruckActors?.attack?.includes(o.p.id)&&o.i>=5&&o.d<10.5)
   .sort((a,b)=>a.d-b.d);
 return backups[0]?.i??8;
}
function iqTeamStrategy(g,team){
 const own=team===0?g.home:g.away,other=team===0?g.away:g.home;
 const style=own.power>=other.power+6?'Jeu au large':own.power<other.power-8?'Conservation':'Équilibré';
 const defense=own.power<other.power-12?'Attentiste':'Glissée';
 return {style,defense,kick:'Territoire',shape:own.power>75?'2-4-2':'1-3-3-1',playbook:'Automatique'};
}
function iqTryOrTackle(g){
 const t=g.possession,h=carrierOf(g);
 const over=(h.x>=98&&t===0)||(h.x<=2&&t===1);
 if(!over)return false;
 const nearest=g.players[1-t].map(p=>({p,d:meters(p,h)})).sort((a,b)=>a.d-b.d)[0];
 if(nearest&&nearest.d<4.15&&g.mode==='play'&&!g.movingBall){
  // On the line, a defender in contact must be beaten before grounding.
  h.x=clamp(h.x,t===0?94:2,t===0?98:6);
  g.ball.x=h.x;g.tackleShield=0;
  beginContact(g,nearest.p);
  return true;
 }
 awardTry(g);return true;
}
function iqDropGoal(g){
 const team=g.possession,h=carrierOf(g),dir=attackDir(team),distance=(team===0?100-h.x:h.x);
 const kicker=g.players[team][9],skill=attr(kicker,'kick');
 const success=rand(g)<clamp(.56-(distance-25)*.014+(skill-70)*.004,.12,.79);
 g.mode='penalty';g.setTimer=5.5;g.movingBall=null;
 g.penaltyFlight={from:{x:h.x,y:h.y},to:{x:team===0?100:0,y:35},elapsed:0,duration:5.5,
   side:team,kicker:kicker.name,success,kind:'drop'};
 g.events.dropAttempts=(g.events.dropAttempts||0)+1;
 g.events.kicks++;g.actionTimer=5.5;
 logAction(g,`Tentative de drop de ${kicker.name} à ${Math.round(distance)} m`,'drop');
}
function iqKickChase(g,dt){
 const landing=g.kickFlight?.to;if(!landing)return;
 for(let side=0;side<2;side++){
   // Only 3-4 likely chasers/retrievers respond. Other players retain their positions.
   const group=g.players[side].map(p=>({p,d:meters(p,landing)}))
      .filter(o=>o.p.idx>=8).sort((a,b)=>a.d-b.d).slice(0,4);
   for(const {p,d} of group){if(d<.7)continue;
     const step=Math.min(d,dt*(p.speed*1.30));
     p.x=clamp(p.x+(landing.x-p.x)/d*step,1,99);
     p.y=clamp(p.y+(landing.y-p.y)/d*step,2,68);
     p.action=side===g.kickFlight.side?'kick-chase':'cover';if(side!==g.kickFlight.side)g.events.iqBackThreeCovers+=.0125;
   }
 }
}
function iqRestart22(g,receiver,reason){
 // Following a failed goal attempt made dead, a 22m drop-out, not centre restart.
 g.attackSequence=null;g.decoyBites={};g.contact=null;g.ruckActors=null;
 g.possession=receiver;g.carrier=14;g.mode='kickoff';g.setTimer=7;
 const x=receiver===0?22:78;
 const landX=clamp(x+attackDir(receiver)*(25+rand(g)*8),12,88);
 g.ball={x:landX,y:35};g.movingBall=null;g.phase=0;g.actionTimer=2;
 g.tackleShield=3.5;g.carryOrigin=landX;g.carrySeconds=0;
 resetPositions(g,landX,35);
 g.restartFlight={from:{x,y:35},to:{x:landX,y:35},duration:7,elapsed:0};
 logAction(g,reason,'restart');
}

// V0.21: explicit transmission at the breakdown and during set-piece exits.
// The ball travels to an actual player; it cannot silently jump to a newly selected carrier.
function iq21BallToReceiver(g,index,kind,from,reason){
 const receiver=g.players[g.possession]?.[index];if(!receiver)return false;
 const distance=meters(from,receiver);
 if(distance>19 || !Number.isFinite(distance))return false;
 g.movingBall={kind,from:{x:from.x,y:from.y},to:{x:receiver.x,y:receiver.y},
  elapsed:0,duration:clamp(.35+distance*.052,.45,1.25),receiver:index,team:g.possession};
 g.mode='play';g.ball={...from};g.tackleShield=kind==='ruck-pickup'?.48:.95;
 g.actionTimer=.32;g.carryOrigin=from.x;g.carrySeconds=0;
 receiver.action='receive';
 if(kind==='ruck-pickup'){g.events.ruckExits++;iq22StartPhase(g,index);}
 if(kind==='set-release'){g.events.setReleases++;iq22StartPhase(g,index);}
 if(reason)logAction(g,reason,'distribution');
 return true;
}
function iq21ReleaseRuck(g){
 const team=g.possession,from={x:g.ball.x,y:g.ball.y},eligible=g.players[team]
  .filter(p=>!g.ruckActors?.attack?.includes(p.id)&&meters(p,from)<10.5)
  .map(p=>({p,d:meters(p,from),preferred:p.idx===8?3:p.idx===9?1.4:0}))
  .sort((a,b)=>(a.d-a.preferred)-(b.d-b.preferred));
 const receiver=eligible[0]?.p;
 if(!receiver){g.setTimer=.55;g.events.delayedRuckExits=(g.events.delayedRuckExits||0)+1;return false;}
 g.ruckReceiver=receiver.idx;
 g.ruckActors=null;
 return iq21BallToReceiver(g,receiver.idx,'ruck-pickup',from,
  'Sortie de ruck : '+receiver.name+' récupère le ballon');
}
function iq21ReleaseSet(g,sp,receiverIdx){
 const from={x:g.ball.x,y:g.ball.y};
 const runner=g.players[g.possession]?.[receiverIdx];
 if(!runner)return false;
 const ok=iq21BallToReceiver(g,receiverIdx,'set-release',from,
  (sp.kind==='lineout'?'Touche : ':'Mêlée : ')+runner.name+' contrôle le ballon');
 if(ok)g.tackleShield=.95;
 return ok;
}
function iq21Intercept(g,flight,progress){
 if(flight.kind!=='pass'||progress<.35||progress>.91)return false;
 const defender=g.players[1-flight.team]
   .filter(p=>rm25Active(g,p)&&p.idx>=5&&(meters(p,g.ball)<2.4||
       (progress>.66&&meters(p,flight.to)<2.75)))
   .sort((a,b)=>meters(a,g.ball)-meters(b,g.ball))[0];
 if(!defender||flight.interceptChecked)return false;
 flight.interceptChecked=true;
 const ability=attr(defender,'anticipation');
 if(rand(g)>.105+(ability-70)*.002)return false;
 g.movingBall=null;g.possession=1-flight.team;g.carrier=defender.idx;
 g.ball={x:defender.x,y:defender.y};g.mode='play';g.attackSequence=null;g.decoyBites={};
 g.events.interceptions++;g.events.turnovers++;rm25Stat(g,1-flight.team,defender,'turnoversWon');
 g.actionTimer=.42;g.tackleShield=1.7;g.carryOrigin=g.ball.x;g.carrySeconds=0;
 defender.action='intercept';logAction(g,'Interception de '+defender.name+' : relance immédiate !','interception');
 return true;
}
function iq21WideOption(g){
 const side=g.possession,holder=carrierOf(g),dir=attackDir(side);
 const options=g.players[side].filter(p=>p.idx>=9&&iqPassGeometry(g,holder,p))
  .map(p=>{const cover=g.players[1-side].filter(d=>Math.abs(d.y-p.y)<8&&
   (d.x-p.x)*dir>-4&&(d.x-p.x)*dir<12).length;
   const friends=g.players[side].filter(a=>a.idx>=8&&Math.abs(a.y-p.y)<11&&
      Math.abs(a.x-p.x)<13).length;
   const lane=iq20LaneRisk(g,holder,p,side);
   const space=g.players[1-side].reduce((b,d)=>Math.min(b,meters(d,p)),50);
   return {p,benefit:friends-cover,space,lane};})
  .filter(x=>x.lane<.75&&x.space>4.0&&x.benefit>=1&&Math.abs(x.p.y-holder.y)>6)
  .sort((a,b)=>(b.benefit-a.benefit)||(b.space-a.space));
 return options[0]||null;
}


// V0.24: shared, position-based reading of the current phase (not a hardwired scoring pattern).
function iq24Read(g, side){
 const own=g.players[side],opp=g.players[1-side],carrier=carrierOf(g);
 const dir=attackDir(side),forward=opp.filter(p=>(p.x-carrier.x)*dir>-2&&
    (p.x-carrier.x)*dir<15&&Math.abs(p.y-carrier.y)<17);
 const backers=own.filter(p=>p.id!==carrier.id&&(carrier.x-p.x)*dir>=-.5&&
   (carrier.x-p.x)*dir<=12&&meters(p,carrier)<14);
 const inner=forward.filter(p=>p.y<carrier.y),outer=forward.filter(p=>p.y>=carrier.y);
 const lanes=[-18,-9,0,9,18].map(offset=>{
  const y=clamp(carrier.y+offset,3,67);
  const defenders=opp.filter(p=>(p.x-carrier.x)*dir>-2&&(p.x-carrier.x)*dir<17&&Math.abs(p.y-y)<5);
  const friends=own.filter(p=>p.id!==carrier.id&&Math.abs(p.y-y)<8&&
   (carrier.x-p.x)*dir>=-1&&(carrier.x-p.x)*dir<15);
  return {y,offset,defenders:defenders.length,attackers:friends.length,
   nearest:opp.reduce((d,p)=>Math.min(d,Math.hypot(p.y-y,Math.max(0,(p.x-carrier.x)*dir-5)*.55)),40),
   free:Math.max(-3,friends.length-defenders.length)};
 }).sort((a,b)=>(b.free-a.free)||(b.nearest-a.nearest));
 return {side,dir,carrier,forward:forward.length,backers:backers.length,
  left:inner.length,right:outer.length,lane:lanes[0],lanes,
  underPressure:forward.some(p=>meters(p,carrier)<5),
  lineBroken:g.breakaway>0};
}
// Assign stable defensive jobs. Defensive movement must not collapse on the ball.
function iq24DefenceAssignments(g){
 const side=1-g.possession,ball=g.ball,def=g.players[side],attack=g.players[g.possession],dir=attackDir(g.possession);
 const stamp=g.possession+'|'+g.phase+'|'+Math.round(ball.y/7)+'|'+Math.round(ball.x/8);
 if(g.iq24DefenceMemo?.stamp===stamp&&g.clock-g.iq24DefenceMemo.at<.9)return g.iq24DefenceMemo.aim;
 const tactical=gameTactics(g,side).defense;
 const aggression=tactical==='Montée agressive'?-1.2:tactical==='Attentiste'?2.0:0;
 const aims={};
 // Guards / pillars cover inner channels, rather than all rushing the carrier.
 for(const p of def){
  const n=p.idx;
  const lane=DEFEND_LANES[n];
  let y=clamp(35+(ball.y-35)*.36+lane,2.5,67.5);
  let depth=n<3?4.0:n<8?6.2:n===8?8:n===14?24:9.0;
  if(n===14){ // Full-back maintains a genuine second line.
   y=clamp(ball.y*.55+35*.45,4,66);
   depth=g.breakaway>0?11:25;
  }
  if(n>=9&&n<=13){
   const candidates=attack.filter(a=>a.idx>=9&&a.idx<=14).map(a=>({a,d:Math.abs(a.y-y)})).sort((x,z)=>x.d-z.d);
   const mark=candidates[0];
   if(mark&&mark.d<19)y=clamp(.62*y+.38*mark.a.y,3,67);
  }
  if(g.breakaway>0&&n!==14){depth=n>=5&&n<=8?5.0:7.5;
   if(n===5||n===7)y=clamp(.52*y+.48*ball.y,2.5,67.5);}
  aims[p.id]={x:clamp(ball.x+dir*(depth+aggression),1,99),y,role:n===14?'cover':n<=2?'guard':n<8?'fold':'line'};
 }
 const holder=carrierOf(g);
 // No more than two immediate tacklers; the rest retain defensive organization.
 const eligible=def.filter(p=>p.idx!==14&&meters(p,holder)<(g.breakaway>0?22:16))
  .map(p=>({p,eta:meters(p,holder)/Math.max(3,p.speed)})).sort((a,b)=>a.eta-b.eta);
 for(let i=0;i<Math.min(2,eligible.length);i++){
  const p=eligible[i].p;
  aims[p.id]={x:clamp(holder.x+dir*(i===0?.3:1.1),1,99),
    y:clamp(holder.y+(i===0?-.3:1.3),2,68),role:'chase'};
 }
 g.iq24DefenceMemo={at:g.clock,stamp,aim:aims};
 return aims;
}
// Support and contest arrive at a ruck based on distance/speed, not on a global dice roll.
function iq24RuckStrength(g){
 const r=g.ruckActors;
 if(!r)return {attack:0,defense:0,margin:0,ratio:0};
 const force=(side,list)=>list.reduce((sum,o)=>{
  const p=g.players[side].find(z=>z.id===o.id);if(!p)return sum;
  const available=Math.max(.15,1-(o.eta||0)/Math.max(1.8,g.setPiece?.duration||g.setTimer+2.5));
  const skill=attr(p,'strength')||p.skill;
  return sum+(p.skill*.68+skill*.32)*(.63+.37*p.f/100)*available;
 },0);
 const attack=force(g.possession,r.arrivalAttack||[]),defense=force(1-g.possession,r.arrivalDefense||[]);
 return {attack,defense,margin:attack-defense,ratio:(defense-attack)/Math.max(110,attack+defense)};
}

function carrierOf(g){return g.players[g.possession][g.carrier]||g.players[g.possession][9]}
function resetPositions(g,x,y){
 // Après un arrêt, replacer les lignes avec une profondeur crédible et éviter les superpositions.
 for(let t=0;t<2;t++){
  const dir=attackDir(t),att=t===g.possession;
  for(const p of g.players[t]){
   const fwd=p.idx<8, half=p.idx===8||p.idx===9, winger=p.idx===10||p.idx===13, back=p.idx===14;
   const stagger=fwd?(p.idx%4)*1.7:half?7:back?23:12;
   p.x=clamp(x+(att?-dir:dir)*(3+stagger),4,96);
   p.y=clamp(35+(p.idx<8?(p.idx-3.5)*6:(p.idx===10?-28:p.idx===13?28:p.idx===11?-13:p.idx===12?13:0)),3,67);
   p.action='set';p.vx=0;p.vy=0;p.lean=0;p.angularRate=0;
  }
 }
}
function changePossession(g,to,msg,forced=true){g.phasePlan=null;g.attackSequence=null;g.decoyBites={};clearContactBodies(g);g.contact=null;g.ruckActors=null;g.possession=to;g.carrier=to===0?8:8;g.phase=0;g.movingBall=null;g.tackleShield=3.5;if(forced)g.events.turnovers++;g.carryOrigin=g.ball.x;g.carrySeconds=0;g.actionTimer=3;g.mode='play';logAction(g,msg,'turnover');}

// V0.27: tactical set-pieces and territorial kicking. Same rules for human and AI.
const RM26_LINEOUT=['auto','court','milieu','fond'];
const RM26_LAUNCH=['auto','maul','large','neuf'];
const RM26_SCRUM=['auto','stable','pression','huit'];
const RM26_KICKS=['auto','territoire','chandelle','rasant','50:22'];
const RM26_PEN=['auto','poteaux','touche','melee'];
function rm26Orders(g,side){
 const human=side===g.userSide,ord=human?(g.rm26UserOrders||{}):{};
 const territory=side===0?g.ball.x:100-g.ball.x;
 const tight=territory>77,nearTouch=g.ball.y<15||g.ball.y>55;
 const lead=g.score[side]-g.score[1-side];
 return {lineout:ord.lineout&&ord.lineout!=='auto'?ord.lineout:nearTouch&&tight?'court':tight?'milieu':'fond',
  launch:ord.launch&&ord.launch!=='auto'?ord.launch:tight?'maul':territory>40?'large':'neuf',
  scrum:ord.scrum&&ord.scrum!=='auto'?ord.scrum:territory>81&&lead<0?'huit':lead>6?'stable':'pression',
  kick:ord.kick&&ord.kick!=='auto'?ord.kick:'auto',
  penalty:ord.penalty&&ord.penalty!=='auto'?ord.penalty:territory>75&&Math.abs(g.ball.y-35)<22?'poteaux':'touche'};
}
// V0.27 : modèles événementiels avec états explicites de conquête et de retombée.
// Les valeurs de pression, de timing et de vitesse sont internes au gameplay ; pas une physique biomécanique certifiée.
function rm27ScrumStep(g,sp,dt){
 if(!sp.scrumDynamics)return;
 const s=sp.scrumDynamics,p=sp.progress,stage=p<.16?'accroupissement':p<.29?'liaison':p<.43?'engagement':p<.54?'introduction':p<.87?'poussée':'sortie';
 s.stage=stage;
 if(p<.54)return;
 const attacking=rm26Pack(g,sp.team),defending=rm26Pack(g,1-sp.team);
 const speed=sp.plan==='pression'?1.13:sp.plan==='stable'?.93:1;
 const pressure=(attacking*speed-defending)/Math.max(600,(attacking+defending)*.5);
 const alignment=1-Math.abs(g.players[sp.team][0].y-g.players[sp.team][2].y)/75;
 s.pressure=clamp(s.pressure+pressure*dt*.52,-.75,.75);
 s.stability=clamp(1-Math.abs(pressure)*.45-(1-alignment)*.08-(sp.plan==='pression'?.07:0),.35,1);
 s.displacement=clamp(s.displacement+Math.max(-.7,Math.min(.7,pressure))*dt*.12,-1.8,1.8);
 if(!s.reported&&p>.72){s.reported=true;
  g.events.rm27ScrumPressure=(g.events.rm27ScrumPressure||0)+Math.round(s.pressure*100)/100;
 }
}
function rm27LineContest(g,sp){
 const attack=sp.team,op=1-attack,j=sp.throwTarget;
 const jumper=g.players[attack][j],opponents=g.players[op].filter(p=>p.idx>=2&&p.idx<=7&&rm25Active(g,p));
 const rival=opponents.sort((a,b)=>Math.abs(a.y-jumper.y)-Math.abs(b.y-jumper.y))[0]||g.players[op][j];
 const supporting=(side,p)=>g.players[side].filter(q=>q.id!==p.id&&q.idx<8&&rm25Active(g,q)&&meters(q,p)<8).length;
 const timing=(p)=>attr(p,'lineout')*.65+p.skill*.35+Math.min(7,supporting(p.side,p)*1.6)-Math.max(0,100-p.f)*.10;
 const thrower=g.players[attack][1],throwQuality=attr(thrower,'pass');
 const pressure=sp.contest==='agressif'?4:0;
 const accuracy=clamp(.93+(throwQuality-73)*.0015-(sp.plan==='fond'?.045:0)-pressure*.003,.84,.975);
 const legal=rand(g)<accuracy;
 const contestScore=(timing(jumper)-timing(rival)-pressure)*.010;
 const result=rand(g)<clamp(.80+contestScore+(g.staffConquestMods?.[attack]||0)-(g.staffConquestMods?.[op]||0),.45,.94);
 return {legal,won:result,jumper,rival,thrower,quality:contestScore};
}
function rm27KickPoint(k,p){
 const t=clamp(p,0,1),bounce=k.bounce&&k.bounceAt<1?k.bounceAt:1;
 const horizontal=t<.70?(t/.70)*.78:.78+(t-.70)/.30*.22;
 const x=k.from.x+(k.to.x-k.from.x)*horizontal,y=k.from.y+(k.to.y-k.from.y)*horizontal;
 const alt=k.bounce&&t>bounce?Math.max(0,Math.sin(Math.PI*(t-bounce)/(1-bounce)))*(k.altitude||90)*.11:
  Math.sin(Math.PI*Math.min(1,t/bounce))*(k.altitude||90);
 return {x,y,altitude:Math.max(0,alt)};
}
function rm27ReceiveKick(g,k){
 const where=k.to,def=1-k.side;
 const rank=side=>g.players[side].filter(p=>rm25Active(g,p)).map(p=>({p,d:meters(p,where),skill:attr(p,'catch')})).sort((a,b)=>a.d-b.d);
 const cover=rank(def),chase=rank(k.side),a=chase[0],d=cover[0];
 const air=k.kind==='chandelle';const bounce=k.bounce===true;
 const effective=q=>q?q.d-Math.min(4,(q.skill-65)*.065):100;
 const contested=Boolean(a&&d&&Math.abs(effective(a)-effective(d))<4.5&&Math.min(a.d,d.d)<8.5);
 const attacker=contested&&rand(g)<clamp(.32+(effective(d)-effective(a))*.06+(air?.05:0),.12,.62);
 const side=attacker?k.side:def,winner=attacker?a:d;
 if(!winner){g.mode='play';return;}
 g.mode='kick-reception';g.possession=side;g.carrier=winner.p.idx;
 g.ball={x:where.x,y:where.y};g.movingBall=null;
 g.tackleShield=contested?.7:1.7;g.setTimer=clamp(winner.d/Math.max(2.5,winner.p.speed),.75,4.5);
 g.actionTimer=g.setTimer;g.carryOrigin=where.x;g.carrySeconds=0;
 g.events.rm26KickCatches=(g.events.rm26KickCatches||0)+1;
 if(attacker)g.events.rm26RecoveredKicks=(g.events.rm26RecoveredKicks||0)+1;
 if(contested)g.events.rm27AerialContests=(g.events.rm27AerialContests||0)+1;
 if(bounce)g.events.rm27Bounces=(g.events.rm27Bounces||0)+1;
 logAction(g,`${contested?'Duel aérien':bounce?'Ballon au rebond':'Réception'} : ${winner.p.name} ${attacker?'récupère pour le botteur':'sécurise le ballon'}`,'kick');
}
function rm26Pack(g,side){
 return g.players[side].slice(0,8).reduce((a,p,i)=>a+(p.skill*.62+(attr(p,'strength')||p.skill)*.38)*(.45+.55*p.f/100)*(i<3?1.25:i<5?.78:.67),0);
}
function rm26SetReport(g,msg){if(g){g.rm26LastChoice=msg;logAction(g,msg,'pattern');}}
function rm26LinePlan(g,team,sp){
 const o=rm26Orders(g,team),zone=o.lineout;
 const targets={court:2,milieu:3,fond:5};
 sp.throwTarget=targets[zone]??3;
 sp.plan=zone;sp.launch=o.launch;
 sp.contest=(rm26Pack(g,1-team)>rm26Pack(g,team)*1.045||zone==='fond')?'agressif':'modere';
 sp.duration+=zone==='fond'?.9:.2;g.setTimer=sp.duration;
 rm26SetReport(g,`Annonce touche ${zone} · ${sp.launch==='maul'?'maul porté':sp.launch==='large'?'sortie au large':'sortie rapide au 9'}`);
}
function rm26ScrumPlan(g,team,sp){
 const order=rm26Orders(g,team);sp.plan=order.scrum;
 sp.pressure=order.scrum==='pression'?1.16:order.scrum==='stable'?.83:1;
 sp.duration+=order.scrum==='pression'?1.2:.3;g.setTimer=sp.duration;
 rm26SetReport(g,`Mêlée : ${order.scrum==='huit'?'départ du numéro 8':order.scrum==='pression'?'poussée dominante':'stabilité et sortie'}`);
}
function rm26KickType(g,side,holder){
 const order=rm26Orders(g,side),dir=attackDir(side),territory=dir===1?holder.x:100-holder.x;
 const defensiveBack=g.players[1-side].filter(p=>p.idx>=10).map(p=>({p,forward:(p.x-holder.x)*dir,lane:Math.abs(p.y-holder.y)}));
 const hasBackCover=defensiveBack.some(a=>a.forward>18&&a.forward<55&&a.lane<21);
 if(order.kick!=='auto')return order.kick;
 const pressure=iqDefenders(g,holder,5).length;
 if(territory>34&&territory<65&&!hasBackCover&&pressure<=1)return 'rasant';
 if(territory<52&&holder.y<21&&pressure<2)return '50:22';
 if(pressure>=1&&territory>30&&defensiveBack.some(a=>a.forward<32))return 'chandelle';
 return 'territoire';
}
function rm26KickTarget(g,side,holder,requested){
 let type=rm26KickType(g,side,holder),dir=attackDir(side),own=dir===1?holder.x:100-holder.x;
 if(type==='50:22'&&(own>=50 || own+((attr(holder,'kick')>82)?59:49)<78))type='territoire';
 const opponents=g.players[1-side].filter(p=>rm25Active(g,p));
 // Aim for genuine space: evaluate zones against the nearest covering defender.
 let options=[];
 const lengths=type==='chandelle'?[18,25,29]:type==='rasant'?[11,16,21]:type==='50:22'?[37,43,49,...(attr(holder,'kick')>82?[55,59]:[])]:[28,38,45,52];
 for(const m of lengths){for(const y of [9,22,35,48,61]){
   const xx=clamp(holder.x+dir*m,3,97);
   const defender=opponents.reduce((v,p)=>Math.min(v,Math.hypot((p.x-xx)*1.05,(p.y-y))),99);
   const lane=Math.abs(y-holder.y);
   const chance=defender+(type==='territoire'?m*.13:0)-(type==='chandelle'?lane*.10:0);
   options.push({x:xx,y,score:chance,m});
 }}
 options.sort((a,b)=>b.score-a.score);
 let target=options[0];
 if(type==='50:22'){
  const candidate=options.filter(o=>((side===0&&holder.x<50&&o.x>=78)||(side===1&&holder.x>50&&o.x<=22))).sort((a,b)=>b.score-a.score)[0];
  if(candidate)target=candidate;
 }
 const reachable=type==='50:22'&&((side===0&&holder.x<50&&target.x>=78)||(side===1&&holder.x>50&&target.x<=22));
 const inTouch=(type==='50:22'&&reachable&&rand(g)<clamp(.66+(attr(holder,'kick')-75)*.008,.4,.86)) || (type==='territoire'&&target.y<15&&rand(g)<.37);
 const landing={x:target.x,y:inTouch?(target.y<35?1:69):target.y};
 const nearest=opponents.reduce((a,p)=>Math.min(a,meters(p,landing)),99);
 return {type,landing,inTouch,award50:type==='50:22'&&reachable&&inTouch,nearest,hold:type==='chandelle'?4.5:type==='rasant'?2.1:type==='50:22'?4.2:3.6,
  bounce:type==='rasant'||type==='50:22'||(type==='territoire'&&rand(g)<.45),contest:type==='chandelle',altitude:type==='chandelle'?130:type==='rasant'?14:97};
}
function rm26ReceiveKick(g,k){
 const def=1-k.side,where=k.to;
 const sort=side=>g.players[side].filter(p=>rm25Active(g,p)).map(p=>({p,d:meters(p,where)})).sort((a,b)=>a.d-b.d);
 const receivers=sort(def),chasers=sort(k.side);
 const first=receivers[0],second=chasers[0];
 const attackCanContest=Boolean(second&&first&&second.d<6.8&&(second.d-first.d<3.8));
 const chance=clamp(.16+(first?.d||20)*.018-(second?.d||20)*.013+(k.kind==='chandelle'?.12:0),.08,.42);
 const winner=attackCanContest&&rand(g)<chance?k.side:def;
 const target=winner===k.side?second:first;
 const p=target?.p;
 g.mode='kick-reception';g.possession=winner;g.carrier=p?.idx??14;
 g.ball={...where};g.movingBall=null;g.tackleShield=1.5;g.setTimer=2.6;g.actionTimer=2.6;g.carryOrigin=where.x;g.carrySeconds=0;
 if(winner===k.side)g.events.rm26RecoveredKicks=(g.events.rm26RecoveredKicks||0)+1;
 g.events.rm26KickCatches=(g.events.rm26KickCatches||0)+1;
 logAction(g,`${winner===k.side?'Poursuite victorieuse':'Réception sous pression'} : ${p?.name||'arrière'} · ${k.kind||'dégagement'}`,'kick');
}
function rm26SetRelease(g,sp){
 // Explicit #8 or 9 departure uses existing ball-to-receiver transmission.
 if(sp.kind==='lineout'&&g.possession===sp.team&&['large','neuf'].includes(sp.launch)){
  const target=sp.launch==='large'?9:8;
  if(iq21ReleaseSet(g,sp,target)){
   g.events.rm26BacklineLaunches=(g.events.rm26BacklineLaunches||0)+1;
   logAction(g,sp.launch==='large'?'Lancement annoncé vers le 10':'Sortie sécurisée vers le 9','lineout');return true;
  }
 }
 if(sp.kind==='scrum'&&sp.plan==='huit'&&g.possession===sp.team){
  g.carrier=7;const eight=g.players[g.possession][7];
  g.ball={x:eight.x,y:eight.y};g.carryOrigin=eight.x;g.actionTimer=.9;
  g.events.rm26EightPicks=(g.events.rm26EightPicks||0)+1;
  logAction(g,`Le numéro 8 ${eight.name} ramasse et part côté fermé`,'scrum');
  return true;
 }
 return false;
}

function newSetPiece(g,kind,team,x,y,msg){
 g.phasePlan=null;
 g.attackSequence=null;g.decoyBites={};g.mode=kind;g.contact=null;g.ruckActors=null;
 g.setTimer=kind==='scrum'?9+rand(g)*5:kind==='lineout'?7+rand(g)*4:kind==='maul'?3+rand(g)*4:3;
 g.setPiece={kind,team,x:clamp(x,5,95),y:clamp(y,3,67),start:g.clock,duration:g.setTimer,elapsed:0,progress:0,advance:0,throwTarget:(seeded(g.id+'-lineout-'+g.events.lineouts)%2===0?3:4),scrumDynamics:kind==='scrum'?{stage:'accroupissement',pressure:0,stability:1,displacement:0,reported:false}:null};
 g.ball={x:clamp(x,5,95),y:clamp(y,3,67)};g.possession=team;
 g.carrier=kind==='lineout'?1:kind==='maul'?7:8;g.actionTimer=1;g.movingBall=null;g.tackleShield=1.8;
 g.phase=0;g.carryOrigin=g.ball.x;g.carrySeconds=0;
 if(kind==='lineout')rm26LinePlan(g,team,g.setPiece);
 if(kind==='scrum')rm26ScrumPlan(g,team,g.setPiece);
 // Positioning is handled by the animated set-piece movement in reposition().
 if(kind==='lineout')g.events.lineouts++;
 if(kind==='scrum')g.events.scrums++;
 if(kind==='maul')g.events.mauls++;
 logAction(g,msg,kind);
}
function restart(g,receiver,reason){
 g.attackSequence=null;g.decoyBites={};g.contact=null;g.ruckActors=null;g.possession=receiver;g.carrier=14;g.mode='kickoff';g.setTimer=10+rand(g)*4;g.ball={x:receiver===0?33:67,y:35};g.movingBall=null;g.phase=0;g.actionTimer=3;g.tackleShield=4;g.carryOrigin=g.ball.x;g.carrySeconds=0;resetPositions(g,g.ball.x,35);
 g.restartFlight={from:{x:50,y:35},to:{x:g.ball.x,y:35},duration:g.setTimer,elapsed:0};
 logAction(g,reason,'restart');
}
function awardTry(g){
 g.phasePlan=null;
 const t=g.possession,scorer=carrierOf(g),zone=clamp(g.ball.y,0,70),kicker=g.players[t][9];
 g.score[t]+=5;g.tries[t]++;rm25Stat(g,t,scorer,'tries');g.zoneStats[t].tries[rm25Lane(zone)]++;
 g.scoreFlash={x:clamp(g.ball.x,1,99),y:zone,at:g.clock,type:'try'};
 logAction(g,`ESSAI ! ${scorer.name} marque pour ${t===0?g.home.name:g.away.name}`,'try');
 const difficult=Math.abs(zone-35)/35,prob=clamp(.78+(kicker.skill-75)*.007-difficult*.18,.43,.91);
 const from={x:t===0?79:21,y:zone},to={x:t===0?100:0,y:35};
 g.mode='conversion';g.setTimer=6.4;g.conversionFlight={side:t,kicker:kicker.name,success:rand(g)<prob,from,to,duration:6.4,elapsed:0};
 g.ball={...from};g.movingBall=null;g.attackSequence=null;g.contact=null;
 logAction(g,`Transformation à suivre — ${kicker.name}`,'conversion');
}
function newRuck(g,defender,alreadyCounted=false){
 g.attackSequence=null;g.decoyBites={};g.phasePlan=null;
 const side=g.possession,spot={x:g.ball.x,y:g.ball.y},opponent=1-side;
 const rank=(team)=>g.players[team]
  .filter(p=>p.idx<8&&p.id!==defender.id&&
    (team!==side||p.id!==carrierOf(g)?.id))
  .map(p=>({p,d:meters(p,spot),eta:meters(p,spot)/Math.max(2.8,p.speed)}))
  .filter(o=>o.d<16)
  .sort((a,b)=>a.eta-b.eta);
 const atk=rank(side).slice(0,3),def=rank(opponent).slice(0,3);
 // One additional arrival may reinforce a weak breakdown, not every forward at once.
 const nearAttack=atk.filter(o=>o.eta<2.3),nearDefense=def.filter(o=>o.eta<2.3);
 g.mode='ruck';g.previousPhase='ruck';
 g.setTimer=clamp(2.15+(nearDefense.length>=2?.55:0)+(nearAttack.length===0?1.1:0)+rand(g)*.88,1.9,4.8)*phaseProfile(g).ruckSpeed;
 g.ruckActors={attack:atk.map(o=>o.p.id),defense:def.map(o=>o.p.id),
  arrivalAttack:atk.map(o=>({id:o.p.id,d:o.d,eta:o.eta})),
  arrivalDefense:def.map(o=>({id:o.p.id,d:o.d,eta:o.eta})),start:g.clock};
 g.events.ruckEntries+=atk.length+def.length;g.zoneStats[side].rucks[rm25Lane(spot.y)]++;for(const o of atk)rm25Stat(g,side,o.p,'ruckArrivals');for(const o of def)rm25Stat(g,opponent,o.p,'ruckArrivals');
 g.events.iq24RuckSupport=(g.events.iq24RuckSupport||0)+nearAttack.length;
 g.events.iq24RuckContest=(g.events.iq24RuckContest||0)+nearDefense.length;
 const delta=Math.max(0,(g.ball.x-g.carryOrigin)*attackDir(side));
 g.phaseGain=delta;g.attackingMomentum=clamp(g.attackingMomentum+(delta>3?1:.2),0,8);
 g.lastRuckX=g.ball.x;g.carryOrigin=g.ball.x;g.carrySeconds=0;
 g.lastTackle={x:g.ball.x,y:g.ball.y,at:g.clock,defenderId:defender.id};
 defender.action='tackle';if(!alreadyCounted)g.events.tackles++;g.events.rucks++;
 g.stats.phases[side]++;g.phase++;g.carrier=8;g.ruckReceiver=null;
 g.ball={x:clamp(g.ball.x,2,98),y:clamp(g.ball.y,2,68)};
 logAction(g,`Ruck phase ${g.phase} : ${nearAttack.length} soutien(s) et ${nearDefense.length} contestataire(s) proches`,'ruck');
}
// V0.7 : annonces collectives. Chaque séquence est une SUITE de passes, jamais un score pré-calculé.
// Les numéros sont indexés de 0 : 8=9, 9=10, 11=12, 12=13, 14=15.
const ATTACK_PATTERNS={
 'Croisée 10–12':{receivers:[9,11,12],decoys:[14]},
 '15 dans la ligne':{receivers:[9,11,14],decoys:[12]},
 'Leurre puis large':{receivers:[9,12,13],decoys:[11,14]},
 'Surnombre extérieur':{receivers:[9,11,14,13],decoys:[12]}
};
const PATTERN_OPTIONS=['Automatique',...Object.keys(ATTACK_PATTERNS)];
function defensivePressure(g,team,p){
 const dir=attackDir(team);
 return g.players[1-team].filter(q=>(q.x-p.x)*dir>-7&&(q.x-p.x)*dir<22&&Math.abs(q.y-p.y)<10).length;
}
function localOverload(g,team,receiver){
 const dir=attackDir(team),yy=receiver.y;
 const attackers=g.players[team].filter(p=>p.idx>=8&&Math.abs(p.y-yy)<13&&Math.abs(p.x-receiver.x)<17).length;
 const defenders=g.players[1-team].filter(p=>Math.abs(p.y-yy)<13&&(p.x-receiver.x)*dir>-7&&(p.x-receiver.x)*dir<18).length;
 return {attackers,defenders,advantage:attackers-defenders};
}
function pickPattern(g,side){
 const desired=gameTactics(g,side).playbook||'Automatique';
 if(ATTACK_PATTERNS[desired])return desired;
 const ball=g.ball,dir=attackDir(side),width=Math.abs(ball.y-35);
 const defenders=g.players[1-side];
 const wings=defenders.filter(p=>p.idx===10||p.idx===13);
 const front=defenders.filter(p=>p.idx>=9&&p.idx<14);
 const crowded=front.filter(p=>Math.abs(p.y-ball.y)<13).length;
 if(width>17)return 'Croisée 10–12';
 if(crowded>=3 && wings.some(p=>Math.abs(p.y-ball.y)>22))return 'Surnombre extérieur';
 if(dir*ball.x>70 || (dir===-1&&ball.x<32))return '15 dans la ligne';
 return ['Leurre puis large','15 dans la ligne','Croisée 10–12'][Math.floor(rand(g)*3)];
}
function callPattern(g,team){
 if(g.mode!=='play'||g.carrier!==8||g.movingBall||g.attackSequence||g.clock<g.patternCooldown)return false;
 const chosen=pickPattern(g,team),cfg=ATTACK_PATTERNS[chosen];
 if(!cfg)return false;
 const p=g.players[team],active=[8,...cfg.receivers];
 if(active.some(i=>!p[i]))return false;
 const id=++g.sequenceCounter;
 g.attackSequence={id,team,name:chosen,receivers:[...cfg.receivers],next:0,decoys:[...cfg.decoys],start:g.clock,expires:g.clock+25};
 g.patternCooldown=g.clock+52;
 g.events.patternCalls++;
 g.events.decoyRuns+=cfg.decoys.length;
 g.decoyBites={};
 // Le défenseur ne « mord » pas toujours : anticipation et style défensif gouvernent la réaction.
 const defense=1-team,press=gameTactics(g,defense).defense;
 for(const dummy of cfg.decoys){
  const attacker=p[dummy];if(!attacker)continue;
  const options=g.players[defense].filter(q=>q.idx>=8&&q.idx<14&&Math.abs(q.y-attacker.y)<21)
   .sort((a,b)=>Math.abs(a.y-attacker.y)-Math.abs(b.y-attacker.y));
  const marker=options[0];if(!marker||g.decoyBites[marker.id]||Math.abs(marker.y-attacker.y)>17)continue;
  const likelihood=clamp((press==='Montée agressive'?.57:press==='Attentiste'?.22:.36)-(attr(marker,'anticipation')-70)*.007-(g.staffAnalysisMods?.[defense]||0),.10,.80);
  if(rand(g)<likelihood)g.decoyBites[marker.id]=dummy;
  else g.events.defensiveReads++;
 }
 g.lastPattern=chosen;
 logAction(g,`Annonce ${chosen} · ${p[8].name} organise la ligne`,'pattern');
 return true;
}
function tryPatternPass(g){
 const seq=g.attackSequence;
 if(!seq||seq.team!==g.possession||g.clock>seq.expires){g.attackSequence=null;g.decoyBites={};return false;}
 const from=seq.next===0?8:seq.receivers[seq.next-1];
 if(g.carrier!==from)return false;
 const next=seq.receivers[seq.next];
 if(next===undefined)return false;
 if(seq.decoys?.length&&g.clock-(seq.started||g.clock)>0){
  const blockers=seq.decoys.map(i=>g.players[g.possession][i]).filter(Boolean);
  const marker=g.players[1-g.possession].find(d=>rm25Active(g,d)&&blockers.some(b=>meters(b,d)<1.15&&Math.abs(b.x-carrierOf(g).x)<4));
  if(marker&&rand(g)<.07){g.events.obstructions++;rm25Infringement(g,'obstruction',g.possession,blockers[0],{advantage:false,reason:'Course de leurre bloquant réellement un défenseur'});g.attackSequence=null;return true;}
 }

 if(!choosePass(g,next)){
  g.attackSequence=null;g.decoyBites={};return false;
 }
 seq.next++;
 return true;
}
function choosePass(g,requestedIdx=null){
 const side=g.possession,players=g.players[side],holder=carrierOf(g),dir=attackDir(side);
 const style=gameTactics(g,side).style;
 const possible=players.filter(p=>rm25Active(g,p)&&iqPassGeometry(g,holder,p,false));
 if(!possible.length){g.events.passRejections++;g.actionTimer=.36;return false;}
 const rate=p=>{
  const length=meters(holder,p),behind=(holder.x-p.x)*dir;
  const nearDefense=g.players[1-side].filter(d=>meters(d,p)<5.2).length;
  const lane=iq20LaneRisk(g,holder,p,side);
  const playmaker=holder.idx===8&&p.idx===9?-3.4:holder.idx===9&&p.idx>=10?-2.2:0;
  const open=localOverload(g,side,p).advantage>0?-1.8:0;
  return length*.31+behind*.6+nearDefense*2.2+lane*4.0+
   (p.idx<8&&style!=='Jeu direct'?.65:0)+playmaker+open+rand(g)*1.2;
 };
 const available=possible.map(p=>({p,val:rate(p),threat:iq20LaneRisk(g,holder,p,side)}))
  .sort((a,b)=>a.val-b.val);
 const forced=requestedIdx!==null;
 const chosen=forced?available.find(o=>o.p.idx===requestedIdx):available[0];
 if(!chosen){g.events.passRejections++;g.actionTimer=.35;return false;}
 const receiver=chosen.p,length=meters(holder,receiver);
 const pressure=iqDefenders(g,holder,3.4).length;
 if(chosen.threat>1.30 || (length>12.8&&pressure>=2)){
  g.events.passRejections++;g.actionTimer=.38;return false;
 }
 // No speculative 20-metre backward distribution after a line break.
 if(g.breakaway>0&&length>11.0){g.events.passRejections++;g.actionTimer=.42;return false;}
 const advantage=localOverload(g,side,receiver);
 if(advantage.attackers>=2&&advantage.advantage>0&&Math.abs(receiver.y-holder.y)>7)g.events.overlaps++;
 const flight={from:{x:holder.x,y:holder.y},to:{x:receiver.x,y:receiver.y},elapsed:0,
  duration:clamp(.21+length*.039,.26,.83),receiver:receiver.idx,team:side,kind:'pass',releaseX:holder.x,
  releaseY:holder.y,backwardMetres:(holder.x-receiver.x)*dir,passLength:length};
 g.movingBall=flight;holder.action='pass';receiver.action='receive';g.events.passes++;rm25Stat(g,side,holder,'passes');
 g.events.iqPassLanes++;
 g.events.maxBackwardPass=Math.max(g.events.maxBackwardPass||0,flight.backwardMetres);
 g.events.maxPassLength=Math.max(g.events.maxPassLength||0,length);
 g.lastPass={id:holder.id,side,at:g.clock};g.carrySeconds=0;
 g.actionTimer=.34+rand(g)*.24;
 if(rand(g)<.32)logAction(g,`${holder.name} transmet à ${receiver.name} — soutien en mouvement`,'pass');
 return true;
}

function chooseKick(g){
 g.attackSequence=null;g.decoyBites={};
 const side=g.possession,holder=carrierOf(g),decision=rm26KickTarget(g,side,holder);
 const successSkill=attr(holder,'kick')||holder.skill;
 // Less skilled players retain territory choices, but have variable execution quality.
 const drift=(rand(g)-.5)*clamp((88-successSkill)*.12,0,4.8);
 const dest={x:decision.landing.x,y:clamp(decision.landing.y+(!decision.inTouch?drift:0),1,69)};
 g.events.kicks++;g.events.rm26KickTypes=g.events.rm26KickTypes||{};
 g.events.rm26KickTypes[decision.type]=(g.events.rm26KickTypes[decision.type]||0)+1;
 rm25Stat(g,side,holder,'kicks');g.events.iqPressureKicks+=(iqDefenders(g,holder,6).length>0?1:0);
 g.kickFlight={from:{x:holder.x,y:holder.y},to:dest,side,elapsed:0,duration:decision.hold,
   inTouch:decision.inTouch,award50:decision.award50,indirect:decision.bounce,kind:decision.type,
   altitude:decision.altitude,bounceAt:decision.bounce?.80:1.01,
   description:`${holder.name} : ${decision.type==='chandelle'?'chandelle disputée':decision.type==='rasant'?'rasant dans le dos':decision.type==='50:22'?'recherche du 50:22':'dégagement territorial'}`};
 g.lastKick={id:holder.id,side,at:g.clock};g.mode='kick-flight';g.setTimer=decision.hold;
 g.movingBall=null;g.ruckReceiver=null;logAction(g,g.kickFlight.description,'kick');
}

function addPenalty(g,beneficiary=g.possession,reason=''){
 if(beneficiary!==g.possession){g.possession=beneficiary;g.carrier=9;g.attackSequence=null;g.decoyBites={};g.ruckActors=null;g.contact=null;g.events.turnoverPenalties++;}
 if(reason)logAction(g,reason,'referee');
 const to=g.possession,dir=attackDir(to),kicker=g.players[to][9],x=g.ball.x;
 const dist=to===0?100-x:x,gained=25+rand(g)*16;
 g.events.penalties++;g.events.refereeDecisions++;g.events.ruckPenalties+=(g.previousPhase==='ruck'?1:0);
 const timeLeft=4800-g.clock,scoreGap=g.score[to]-g.score[1-to];
 const pack=team=>g.players[team].slice(0,8).reduce((v,p)=>v+p.skill*(p.f/100),0);
 const plan=rm26Orders(g,to).penalty;
 const scrumOption=plan==='melee'||(plan==='auto'&&dist<10&&scoreGap<=-5&&pack(to)>pack(1-to)*1.035&&rand(g)<.28);
 if(scrumOption){newSetPiece(g,'scrum',to,x,g.ball.y,'Pénalité : mêlée demandée par le capitaine');return;}
 const attempt=plan==='poteaux'&&dist<60||(plan==='auto'&&dist<52&&rand(g)<(timeLeft<480&&scoreGap<=-5?.34:dist<30?.85:.63));
 if(attempt){
  const success=rand(g)<clamp(.87-(dist-15)*.012+(kicker.skill-75)*.005,.36,.93);
  const from={x:g.ball.x,y:g.ball.y},toPost={x:to===0?100:0,y:35};
  g.mode='penalty';g.setTimer=7;g.penaltyFlight={from,to:toPost,elapsed:0,duration:7,side:to,kicker:kicker.name,success};
  g.actionTimer=7;g.movingBall=null;g.setPiece=null;
  logAction(g,`Tentative de pénalité : ${kicker.name} (${Math.round(dist)} m)`,'penalty');
 }else{
  const landingX=clamp(x+dir*gained,6,94),landingY=g.ball.y<35?1:69;
  g.events.kicks++;g.kickFlight={from:{x,y:g.ball.y},to:{x:landingX,y:landingY},elapsed:0,duration:3.7,side:to,inTouch:true,penaltyTouch:true,description:'Pénaltouche : ballon tapé vers la ligne'};
  g.mode='kick-flight';g.setTimer=3.7;g.movingBall=null;g.actionTimer=3.7;
  logAction(g,`Pénaltouche de ${kicker.name} · lancer conservé après la sortie`,'kick');
 }
}
// Aucune note de poste réelle inventée : la spécialisation porte sur les comportements, pas sur les données personnelles.
function playerRole(p){
 if(p.idx<=2)return 'frontrow'; if(p.idx<=4)return 'lock'; if(p.idx<=7)return 'backrow';
 if(p.idx===8)return 'nine'; if(p.idx===9)return 'ten';
 if(p.idx===10||p.idx===13)return 'wing'; if(p.idx===14)return 'fullback';return 'centre';
}
function roleDecisionBias(p){
 return {frontrow:{pass:-.13,kick:0,contest:.22,wide:-.14},lock:{pass:-.08,kick:0,contest:.13,wide:-.10},backrow:{pass:-.03,kick:.01,contest:.23,wide:-.03},nine:{pass:.32,kick:.07,contest:0,wide:.1},ten:{pass:.20,kick:.13,contest:0,wide:.18},centre:{pass:.13,kick:.02,contest:0,wide:.25},wing:{pass:-.13,kick:.02,contest:0,wide:.27},fullback:{pass:.04,kick:.10,contest:0,wide:.25}}[playerRole(p)];
}
// Une seule source de vérité : le porteur est figé le temps du contact, puis le moteur
// décide de libérer au sol ou de réaliser un offload réel (ballon en vol vers un receveur).
function beginContact(g,first){
 g.phasePlan=null;
 if(g.mode!=='play'||g.movingBall)return false;
 const t=g.possession,h=carrierOf(g),def=g.players[1-t];
 g.attackSequence=null;g.decoyBites={};
 const others=def.filter(p=>p.id!==first.id&&meters(p,h)<5.7)
   .sort((a,b)=>meters(a,h)-meters(b,h));
 const helper=others[0]&&rand(g)<clamp(.42+(attr(others[0],'tackle')-70)*.004,.25,.67)?others[0]:null;
 const tacklers=[first,...(helper?[helper]:[])];
 g.mode='tackle';g.previousPhase='tackle';g.setTimer=helper?1.25:.85;g.events.contacts++;
 g.contact={x:h.x,y:h.y,carrierId:h.id,carrierIndex:h.idx,side:t,
   tacklerIds:tacklers.map(p=>p.id),start:g.clock,duration:g.setTimer,elapsed:0,progress:0,
   offloadCandidate:false,impactVector:{x:clamp(first.vx-h.vx,-9,9),y:clamp(first.vy-h.vy,-9,9)},phase:'approach'};
 g.contact.bodies=createContactBodies(g,h,tacklers);
 const closing= Math.hypot((first.vx||0)-(h.vx||0),(first.vy||0)-(h.vy||0));
 const discipline=(attr(first,'tackle')||70),angle=Math.abs(Math.atan2((first.vy||0)-(h.vy||0),(first.vx||0)-(h.vx||0))-(h.angle||0));
 const dangerousRisk=clamp(.0015+Math.max(0,closing-5.0)*.00075+Math.max(0,65-discipline)*.00012+(angle>2.5?.0008:0),.001,.017);
 if(rand(g)<dangerousRisk){g.contact.illegalTackle={actorId:first.id,side:1-t,severity:clamp(.57+closing*.025+Math.max(0,65-discipline)*.003,.55,.99)};}

 g.ball={x:h.x,y:h.y};
 h.action='ground';h.vx*=.12;h.vy*=.12;
 tacklers.forEach(p=>{p.action='tackle';p.vx*=.16;p.vy*=.16});
 g.lastTackle={x:h.x,y:h.y,at:g.clock,defenderId:first.id};
 g.events.tackles+=tacklers.length;for(const p of tacklers)rm25Stat(g,1-t,p,'tackles');if(helper)g.events.doubleTackles++;
 if(helper&&rand(g)<.16)logAction(g,`Plaquage à deux : ${first.name} et ${helper.name} arrêtent ${h.name}`,'tackle');
 else if(rand(g)<.07)logAction(g,`${first.name} plaque ${h.name}`,'tackle');
 return true;
}

// V0.17 : mini-solveur cinématique d'impact, découplé du moteur de scores.
// Masses relatives et impulsions en unités internes ; ce n'est PAS une biomécanique
// humaine validée ni un solveur rigide 3D. Aucun nouveau tirage RNG.
function contactMass(p){const weights={frontrow:120,lock:113,backrow:101,nine:79,ten:84,centre:94,wing:88,fullback:89};return weights[playerRole(p)]||95;}
function createContactBodies(g,carrier,tacklers){
 const dir=attackDir(g.possession),make=(p,kind,i)=>({id:p.id,x:p.x,y:p.y,
  vx:clamp(p.vx||dir*2.4,-5.2,5.2),vy:clamp(p.vy||0,-3.8,3.8),
  mass:contactMass(p),kind,index:i,angle:p.angle||0,tilt:0,balance:1,
  down:0,impacted:false,brace:0});
 const bodies=[make(carrier,'carrier',0),...tacklers.map((p,i)=>make(p,'tackler',i))];
 // La trajectoire du premier plaqueur doit rencontrer celle du porteur.
 for(let i=1;i<bodies.length;i++){
  const b=bodies[i],dx=bodies[0].x-b.x,dy=bodies[0].y-b.y,d=Math.hypot(dx,dy)||1;
  b.vx=dx/d*(i===1?3.5:2.9);b.vy=dy/d*(i===1?3.5:2.9);
 }
 return {actors:bodies,contacts:0,energy:0,initialX:carrier.x,initialY:carrier.y};
}
function integrateContact(g,dt){
 const k=g.contact,phys=k?.bodies;if(!phys)return;
 const bs=phys.actors,carrier=bs[0],dir=attackDir(k.side);
 let left=Math.min(dt,.7);
 while(left>0.00001){
  const step=Math.min(left,dt>.15?.075:.035);left-=step;
  const progress=k.progress,early=progress<.23,fall=clamp((progress-.43)/.54,0,1);
  for(let i=0;i<bs.length;i++){
   const b=bs[i];
   if(i===0){
    const desired=early?dir*2.6:dir*.28;
    b.vx+=(desired-b.vx)*step*(early?3.1:4.7);
    b.vy*=Math.exp(-2.6*step);
   }else if(!b.impacted){
    const tx=carrier.x,ty=carrier.y+(i===2?1.10:0),dx=tx-b.x,dy=ty-b.y;
    const mag=Math.hypot(dx,dy)||1;
    const force=clamp(mag*3.7,0,3.4);
    b.vx+=(dx/mag*force-b.vx)*Math.min(1,step*4.0);
    b.vy+=(dy/mag*force-b.vy)*Math.min(1,step*4.0);
   }else{
    b.vx*=Math.exp(-6.0*step);b.vy*=Math.exp(-6.0*step);
   }
   b.x=clamp(b.x+b.vx*step,1.4,98.6);
   b.y=clamp(b.y+b.vy*step,1.4,68.6);
  }
  for(let i=1;i<bs.length;i++){
   const b=bs[i],dx=b.x-carrier.x,dy=b.y-carrier.y,dist=Math.hypot(dx,dy)||.00001;
   const reach=i===1?1.52:1.70;
   if(!b.impacted && (dist<reach || progress>(i===1?.30:.48))){
    b.impacted=true;phys.contacts++;
    const nx=dx/dist,ny=dy/dist;
    const closing=Math.max(.7,(carrier.vx-b.vx)*nx+(carrier.vy-b.vy)*ny);
    const impulse=clamp(closing*0.65/(1/carrier.mass+1/b.mass),70,420);
    carrier.vx-=nx*impulse/carrier.mass;carrier.vy-=ny*impulse/carrier.mass;
    b.vx+=nx*impulse/b.mass;b.vy+=ny*impulse/b.mass;
    b.balance=clamp(1-impulse/b.mass*.2,.25,.94);
    carrier.balance=clamp(carrier.balance-impulse/carrier.mass*.23,0,.9);
    b.brace=1;phys.energy+=impulse;
   }
   if(b.impacted){
    // Maintien du contact : distance minimum et contrainte souple de prise.
    const newDx=b.x-carrier.x,newDy=b.y-carrier.y,newDist=Math.hypot(newDx,newDy)||.01;
    const ex=newDx/newDist,ey=newDy/newDist,target=i===1?.82:1.04;
    const displacement=clamp((newDist-target)*.31,-.23,.23);
    b.x=clamp(b.x-ex*displacement,1.4,98.6);
    b.y=clamp(b.y-ey*displacement,1.4,68.6);
    carrier.x=clamp(carrier.x+ex*displacement*.24,1.4,98.6);
    carrier.y=clamp(carrier.y+ey*displacement*.24,1.4,68.6);
    b.brace=Math.max(0,b.brace-step*.55);
   }
  }
  // Une chute ne déplace jamais le porteur de plusieurs mètres instantanément.
  carrier.x=clamp(carrier.x,phys.initialX-2.1,phys.initialX+2.1);
  carrier.y=clamp(carrier.y,phys.initialY-2.1,phys.initialY+2.1);
  carrier.down=fall;carrier.tilt=clamp(fall*(.78+(1-carrier.balance)*.37),0,1.25);
  for(let i=1;i<bs.length;i++){
   const b=bs[i];b.down=clamp((progress-(i===1?.47:.61))/.47,0,1);
   b.tilt=clamp(b.down*(.48+(1-b.balance)*.32),0,1.06);
  }
 }
 for(const b of bs){
  const p=g.players[b.kind==='carrier'?k.side:1-k.side].find(x=>x.id===b.id);
  if(!p)continue;
  p.x=b.x;p.y=b.y;p.vx=b.vx;p.vy=b.vy;
  p.contactPose={tilt:b.tilt,down:b.down,brace:b.brace,phase:k.phase,weight:b.mass,imbalance:1-b.balance};
  p.action=b.kind==='carrier'?'ground':'tackle';
  if(b.kind==='tackler'){
   const dx=carrier.x-b.x,dy=carrier.y-b.y;
   p.angle=Math.atan2(dy,dx);
  }
 }
 k.x=carrier.x;k.y=carrier.y;g.ball={x:carrier.x,y:carrier.y};
}
function clearContactBodies(g){
 const k=g.contact;if(!k?.bodies)return;
 for(const b of k.bodies.actors){
  const p=g.players[b.kind==='carrier'?k.side:1-k.side].find(x=>x.id===b.id);
  if(p){p.contactPose=null;p.vx*=.22;p.vy*=.22;}
 }
}

function resolveContact(g){
 const k=g.contact;if(!k)return;
 clearContactBodies(g);
 if(k.illegalTackle){
  const actor=g.players[k.illegalTackle.side].find(p=>p.id===k.illegalTackle.actorId);
  g.contact=null;g.events.dangerousTackles++;
  rm25Infringement(g,'plaquage dangereux',k.illegalTackle.side,actor,{severity:k.illegalTackle.severity,advantage:false,reason:'Plaquage dangereux simulé : impact à risque'});
  return;
 }
 const t=k.side,old=g.players[t].find(p=>p.id===k.carrierId);
 const nearby=g.players[t].filter(p=>p.id!==k.carrierId&&p.idx>=5&&p.idx<=14&&
   (p.x-k.x)*attackDir(t)<=-RUGBY_IQ.minBackward&&meters(p,k)<RUGBY_IQ.maxOffload&&iqPassGeometry(g,{...old,x:k.x,y:k.y},p,true))
   .sort((a,b)=>meters(a,k)-meters(b,k));
 const offered=nearby[0];
 // Le porteur peut libérer pendant le plaquage, mais pas à 20 mètres ni vers l'avant.
 const tryOffload=offered&&old&&rand(g)<clamp((k.tacklerIds.length===2?.125:.21)+
   (attr(old,'offload')-75)*.0035+(gameTactics(g,t).style==='Jeu au large'?.075:0),.045,.38);
 if(tryOffload){
  g.mode='play';g.carrier=k.carrierIndex;g.contact=null;g.ruckActors=null;
  g.movingBall={from:{x:k.x,y:k.y},to:{x:offered.x,y:offered.y},elapsed:0,
    duration:clamp(.21+meters(offered,k)*.033,.28,.62),receiver:offered.idx,team:t,kind:'offload'};
  g.events.offloads++;g.events.passes++;rm25Stat(g,t,old,'offloads');rm25Stat(g,t,old,'passes');g.actionTimer=.6;g.tackleShield=1.15;
  g.carrySeconds=0;g.carryOrigin=offered.x;
  old.action='offload';offered.action='receive';
  logAction(g,`Offload de ${old.name} au contact pour ${offered.name}`,'offload');
 }else{
  g.ball={x:k.x,y:k.y};g.contact=null;
  newRuck(g,g.players[1-t].find(p=>p.id===k.tacklerIds[0])||g.players[1-t][6],true);
 }
}
function ruckContest(g){
 const r=g.ruckActors;if(!r)return {pressure:0,attackSupport:0,defenseContest:0};
 const balance=iq24RuckStrength(g);
 return {pressure:clamp(balance.ratio*1.25,-.6,.6),
  attackSupport:r.arrivalAttack.filter(o=>o.eta<=3).length,
  defenseContest:r.arrivalDefense.filter(o=>o.eta<=3).length,
  attackForce:balance.attack,defenseForce:balance.defense};
}

// V0.24 — intentions collectives persistantes, sans essai ou passe scriptés.
// 9-10-12-15 n'est qu'une option parmi d'autres : les espaces et le risque priment.
function iq22StartPhase(g,receiver){
 const team=g.possession,dir=attackDir(team),players=g.players[team];
 const available=players.some(p=>p.idx===8&&meters(p,g.ball)<12);
 const width=g.ball.y;
 const shape=gameTactics(g,team).shape;
 let sequence=shape==='2-4-2'?[8,9,11,14]:[8,9,width<15?10:width>55?13:11,14];
 if(receiver!==8)sequence=[receiver,9,11,14];
 const territory=team===0?g.ball.x:100-g.ball.x;
 const read=iq24Read(g,team);
 const canBuild=receiver===8&&territory>20&&territory<88&&read.backers>=1&&rand(g)<(read.lane.free>=1?.14:.065);
 g.phasePlan=canBuild?{team,steps:sequence,cursor:0,started:g.clock,until:g.clock+11,origin:g.ball.x}:null;
 g.events.iq22Phases=(g.events.iq22Phases||0)+1;
 g.attackSequence=null;g.decoyBites={};
}
function iq22PhasePass(g){
 const q=g.phasePlan;if(!q||q.team!==g.possession||g.clock>q.until||g.mode!=='play'||g.movingBall){g.phasePlan=null;return false;}
 const h=carrierOf(g),first=q.steps[q.cursor];
 if(h.idx!==first){g.phasePlan=null;return false;}
 const next=q.steps[q.cursor+1];if(next===undefined){g.phasePlan=null;return false;}
 const target=g.players[q.team][next];if(!target){g.phasePlan=null;return false;}
 const close=iqDefenders(g,h,5.3),dir=attackDir(q.team),space=iq20Sweep(g,q.team,h);
 const lane=iq20LaneRisk(g,h,target,q.team);
 const cover=g.players[1-q.team].filter(p=>meters(p,target)<5.1).length;
 const legal=iqPassGeometry(g,h,target);
 const read=iq24Read(g,q.team);
 const clear=lane<.88&&cover<2&&legal&&read.backers>=1;
 if(!clear){
   g.events.iq22ReadChanges=(g.events.iq22ReadChanges||0)+1;
   // If the scripted channel is closed, the player carries, kicks, or chooses another pass normally.
   g.phasePlan=null;return false;
 }
 // Do not throw a needless pass when a broken line offers free territory.
 if(g.breakaway>0&&close.length===0){g.events.iq22Carries=(g.events.iq22Carries||0)+1;return false;}
 const attackingGap=iq20Sweep(g,q.team,h)[0]?.eta??3.0;
 if(h.idx!==8&&close.length===0&&attackingGap>1.6){g.events.iq22Carries++;return false;}
 if((h.idx===8||close.length||g.phase>0)&&choosePass(g,next)){
  q.cursor++;
  g.events.iq22LinkedPasses=(g.events.iq22LinkedPasses||0)+1;
  if(q.cursor>=2)g.events.iq22Chains=(g.events.iq22Chains||0)+1;
  return true;
 }
 return false;
}
function iq22DefenseScreen(g,team,carrier){
 // On the far side of the tackle line, a covering defender must remain visible.
 const dir=attackDir(team),def=g.players[1-team];
 const pool=def.filter(p=>p.idx>=6&&p.idx!==8).map(p=>({p,
  eta:iq20Approach(g,1-team,p,{x:carrier.x+dir*1.2,y:carrier.y},1).eta,
  gap:Math.abs(p.y-carrier.y)})).sort((a,b)=>a.eta-b.eta);
 return pool.slice(0,3);
}
function onDecision(g){
 const side=g.possession,h=carrierOf(g),tactic=gameTactics(g,side),dir=attackDir(side);
 const territory=dir===1?h.x:100-h.x,distToGoal=100-territory;
 const opponents=iqDefenders(g,h,11),nearest=opponents.reduce((m,p)=>Math.min(m,meters(h,p)),99);
 const candidates=iqNearestSupport(g,h);
 if(g.phasePlan&&iq22PhasePass(g))return;
 const timeLeft=4800-g.clock,lead=g.score[side]-g.score[1-side];
 const local=localOverload(g,side,h),support=iq20SupportHealth(g,side,h);
 const reading=iq24Read(g,side);
 g.events.iq24CollectiveReads++;
 g.iq24LastRead={width:Math.round(reading.lane.y),advantage:reading.lane.free,backers:reading.backers};
 const breaker=g.breakaway>0,nearPosts=Math.abs(h.y-35)<22;
 const role=playerRole(h);
 if(breaker&&nearest>5.0){h.action='carry';g.actionTimer=.52;g.events.iqSmartCarries++;return;}
 if(breaker&&!candidates.length){h.action='carry';g.actionTimer=.42;g.events.isolatedCarries++;return;}
 if(distToGoal<34&&distToGoal>10&&nearPosts&&role==='ten'&&timeLeft<920&&lead<=0&&lead>=-3&&rand(g)<.10){iqDropGoal(g);return;}
 if(g.attackSequence&&tryPatternPass(g))return;
 const openWing=iq21WideOption(g);
 if(openWing && reading.lane.free>=0 && (nearest<8.5||(!breaker&&local.advantage>0)) && rand(g)<.28){
   if(choosePass(g,openWing.p.idx)){g.events.tacticalOverloads++;return;}
 }
 if(!g.attackSequence&&h.idx===8&&g.clock>=g.patternCooldown){
  const wanted=tactic.playbook&&tactic.playbook!=='Automatique';
  if(rand(g)<(wanted?.58:.15)&&callPattern(g,side)&&tryPatternPass(g))return;
 }
 const late=timeLeft<560;
 const kicking=role==='nine'||role==='ten'||role==='fullback';
 const defensiveTrap=opponents.filter(p=>meters(p,h)<6.3).length;
 const emergency=territory<25 && (defensiveTrap>=1||support===0);
 const tacticalKick=territory<47&&defensiveTrap>1;
 const protectLead=late&&lead>=4&&territory<57;
 const kickPreference=tactic.kick==='Conservation'?.46:tactic.kick==='Pression aérienne'?1.24:1;
 const kickProbability=kicking?(emergency?.21:tacticalKick?.11:protectLead?.13:.012)*kickPreference:0;
 if(rand(g)<kickProbability){chooseKick(g);return;}
 const style=tactic.style,stylePass=style==='Jeu au large'?.31:style==='Jeu direct'?.10:style==='Conservation'?.21:.18;
 const markerClose=nearest<4.7,spaceAhead=nearest>9.0;
 const passIntent=stylePass+(role==='nine'?.16:role==='ten'?.08:role==='centre'?.04:0)+
  (markerClose?.10:0)+(local.advantage>0?.055:0)-(breaker?.16:0);
 const sensiblePass=candidates.length>0&&!(spaceAhead&&breaker)&&rand(g)<clamp(passIntent,.08,.77);
 if(sensiblePass&&choosePass(g))return;
 if(nearest<3.2&&g.tackleShield<=0){
  const tackler=opponents.sort((a,b)=>meters(a,h)-meters(b,h))[0];
  if(tackler){beginContact(g,tackler);return;}
 }
 h.action='carry';g.events.iqSmartCarries++;g.actionTimer=spaceAhead?.67:.34;
}

function resolveSet(g){
 const sp=g.setPiece;if(!sp)return;
 const t=sp.team,op=1-t;
 if(sp.kind==='lineout'){
  const c=rm27LineContest(g,sp);
  if(!c.legal){g.events.rm26BadThrows=(g.events.rm26BadThrows||0)+1;
   rm25Infringement(g,'lancer pas droit',t,c.thrower,{restart:'scrum',advantage:false,reason:'Lancer en touche dévié de son couloir'});return;}
  g.possession=c.won?t:op;g.carrier=c.won?c.jumper.idx:c.rival.idx;
  if(c.won)g.events.lineoutWins++;else{g.events.lineoutSteals++;g.events.rm26LineSteals=(g.events.rm26LineSteals||0)+1;}
  g.events.rm27LineContests=(g.events.rm27LineContests||0)+1;
  logAction(g,c.won?`${c.jumper.name} gagne le duel de touche ${sp.plan}`:`${c.rival.name} vole le lancer ${sp.plan}`,'lineout');
  if(c.won&&sp.launch==='maul'){
   newSetPiece(g,'maul',t,sp.x,sp.y<35?clamp(sp.y+12,4,66):clamp(sp.y-12,4,66),'Maul porté sur combinaison annoncée');return;
  }
 }else if(sp.kind==='scrum'){
  const s=sp.scrumDynamics||{pressure:0,stability:1,displacement:0};
  // Excessive pressure with low stability triggers a real observable collapse decision.
  const unstable=s.stability<.48&&Math.abs(s.pressure)>.25;
  if(unstable){
   const offender=s.pressure>=0?t:op;
   g.events.rm27ScrumInstability=(g.events.rm27ScrumInstability||0)+1;
   rm25Infringement(g,'mêlée',offender,g.players[offender][0],{advantage:false,reason:'Mêlée effondrée sous une poussée instable'});return;
  }
  const diff=(rm26Pack(g,t)-rm26Pack(g,op))/620;
  const won=rand(g)<clamp(.80+diff*.18+s.pressure*.085+(g.staffConquestMods?.[t]||0)-(g.staffConquestMods?.[op]||0),.48,.94);
  g.possession=won?t:op;g.carrier=8;
  if(won)g.events.scrumWins++;else{g.events.scrumSteals++;g.events.rm26ScrumSteals=(g.events.rm26ScrumSteals||0)+1;}
  if(s.pressure>.12)g.events.rm26DominantScrums=(g.events.rm26DominantScrums||0)+1;
  logAction(g,`${won?'Conquête sécurisée':'Ballon gagné contre introduction'} · poussée ${s.pressure>0?'dominante':s.pressure<-.1?'sous pression':'équilibrée'} (${s.displacement.toFixed(1)} m)`,'scrum');
 }else if(sp.kind==='maul'){
  const attacking=rm26Pack(g,t),defending=rm26Pack(g,op);
  const ratio=(attacking-defending)/Math.max(350,attacking+defending);
  const retained=rand(g)<clamp(.88+ratio*.35+(g.staffConquestMods?.[t]||0)-(g.staffConquestMods?.[op]||0),.62,.97);
  g.possession=retained?t:op;
  g.events.maulMetres+=Math.round(sp.advance*10)/10;
  g.stats.meters[t]+=sp.advance;
  g.carrier=7;
  logAction(g,retained?`Maul : ${sp.advance.toFixed(1)} m gagnés, ballon ressort`:`Maul contesté, ballon rendu à l'adversaire`,'maul');
 }
 g.mode='play';g.setPiece=null;g.carryOrigin=g.ball.x;g.carrySeconds=0;g.tackleShield=2.3;g.actionTimer=.7;
 if(!rm26SetRelease(g,sp)){
  if(sp.kind==='scrum')iq21ReleaseSet(g,sp,8);
  else if(sp.kind==='lineout')iq21ReleaseSet(g,sp,sp.throwTarget);
  else if(sp.kind==='maul')iq21ReleaseSet(g,sp,7);
 }
 if((g.ball.x>=98&&g.possession===0)||(g.ball.x<=2&&g.possession===1))awardTry(g);
}

// V0.6 : organisation spatiale des 30 agents, distincte de la résolution des événements.
// Les pods 1-3-3-1 et 2-4-2 sont des regroupements tactiques simplifiés.
// Tous les points de placement sont en mètres (non en pixels).
const ATTACK_BACK_LANES={8:-3,9:3,10:-31,11:-16,12:16,13:31,14:0};
const DEFEND_LANES=[-5,0,5,-12,12,-23,0,23,-8,8,-32,-17,17,32,0];
function podGroups(shape){return shape==='2-4-2'?[[0,5],[1,2,3,4],[6,7]]:[[0],[1,2,3],[4,5,6],[7]];}
function attackPlan(g,side){
 const tactic=gameTactics(g,side),shape=tactic.shape==='2-4-2'?'2-4-2':'1-3-3-1';
 const groups=podGroups(shape),phase=Math.max(0,g.phase||0),active=phase%groups.length;
 const nearSideline=g.ball.y<16?1:g.ball.y>54?-1:0;
 const lanes=shape==='2-4-2'?[-20,0,20]:[-26,-9,10,27];
 const offset=(g.ball.y-35)*.22;
 const flip=phase%2===0?1:-1;
 const assigned=new Map();
 groups.forEach((group,i)=>{
  const lane=clamp(35+offset+lanes[i]*flip+nearSideline*2.2,6,64);
  group.forEach((idx,j)=>assigned.set(idx,{group:i,lane:clamp(lane+(j-(group.length-1)/2)*3.15,3,67),active:i===active,depth:3.6+(i===active?0:3)+Math.abs(i-active)*.8+(j%2)*.8}));
 });
 return {shape,groups,active,assigned,flip,lanes};
}
function targetPosition(g,side,p,plan){
 const t=g.possession,dir=attackDir(t),ball=g.ball;
 const attacking=side===t,stationary=['scrum','lineout','maul'].includes(g.mode);
 if(stationary) return null;
 if(g.mode==='tackle'&&g.contact){
  const k=g.contact,isHolder=attacking&&p.id===k.carrierId,tackling=!attacking&&k.tacklerIds.includes(p.id);
  if(isHolder)return {x:k.x,y:k.y,action:'ground'};
  if(tackling){const i=k.tacklerIds.indexOf(p.id);return {x:clamp(k.x+dir*(i===0?-.65:.35),2,98),y:clamp(k.y+(i===0?-1:1.1),2,68),action:'tackle'};}
  if(attacking&&p.idx<8&&meters(p,k)<14)return {x:clamp(k.x-dir*(2.3+(p.idx%3)),2,98),y:clamp(k.y+((p.idx%3)-1)*2.5,2,68),action:'support'};
 }
 if(g.mode==='ruck'){
  if(attacking&&p.idx===8&&!g.ruckActors?.attack?.includes(p.id)) return {x:clamp(ball.x-dir*2.15,2,98),y:clamp(ball.y+1.0,2,68),action:'ready'};
  const engaged=attacking?g.ruckActors?.attack:g.ruckActors?.defense;
  if(engaged?.includes(p.id)){
   const i=engaged.indexOf(p.id);
   return {x:clamp(ball.x+(attacking?-dir:dir)*(.8+i*.70),2,98),y:clamp(ball.y+(i-(engaged.length-1)/2)*2.0,2,68),action:'ruck'};
  }
 }
 if(attacking){
  // Une passe est jouée vers un point d'interception; le receveur l'attend ou
  // ajuste sa course, plutôt que de partir loin et provoquer une réception fantôme.
  if(g.movingBall?.team===side&&g.movingBall.receiver===p.idx){
    const dest=g.movingBall.to;
    return {x:clamp(dest.x,1,99),y:clamp(dest.y,2,68),action:'receive'};
  }
  if(g.movingBall?.team===side&&p.idx===g.carrier){
    return {x:clamp(p.x+dir*.4,1,99),y:p.y,action:'support'};
  }
  if(p.idx===g.carrier){
   if(g.movingBall&&['ruck-pickup','set-release'].includes(g.movingBall.kind))return {x:p.x,y:p.y,action:'receive'};
   if(g.mode==='kick-reception')return {x:ball.x,y:ball.y,action:'receive'};
   const pace=p.speed*(g.breakaway>0?1.48:1.04);
   const lane=bestAttackingGap(g,side,p);
   const front=g.players[1-side].filter(q=>(q.x-p.x)*dir>0&&(q.x-p.x)*dir<13&&Math.abs(q.y-p.y)<8);
   const traffic=front.length?(front.length>2?.76:.86):1;
   const y=clamp(p.y+clamp(lane-p.y,-3.0,3.0)*.22,2,68);
   return {x:clamp(p.x+dir*pace*.55*traffic,1,99),y,action:'carry',carrier:true};
  }
  // Chaque destinataire se propose AVANT la passe, avec de la profondeur et une largeur contrôlées.
  const planned=g.phasePlan;
  if(g.mode==='play'&&planned?.team===side&&planned.steps.includes(p.idx)){
   const order=planned.steps.indexOf(p.idx)-planned.cursor;
   if(order===1&&p.idx>=9){
    const sign=ball.y>39?-1:1;
    const width=order===1?5.5:order===2?11.5:17.2;
    const y=clamp(ball.y+sign*width,3,67);
    const depth=order===1?4.3:order===2?8.0:11.2;
    return {x:clamp(ball.x-dir*depth,2,98),y,action:'receive'};
   }
  }
  // Les soutiens se placent DERRIÈRE le ballon, prêts pour une passe légale.
  const support=g.supportAssignments?.[p.id];
  const scripted=g.attackSequence?.team===side && g.attackSequence?.receivers?.includes(p.idx);
  if(support&&!scripted&&g.mode==='play'){
   return {x:support.x,y:support.y,action:support.kind,pod:p.idx<8?plan.assigned.get(p.idx)?.group:-1};
  }
  // Non-engaged forwards occupy different pods instead of congregating at the ruck.
  if(p.idx<8){
   const pod=plan.assigned.get(p.idx),depth=pod?.depth||5;
   return {x:clamp(ball.x-dir*depth,2,98),y:pod.lane,action:pod.active?'pod':'support',pod:pod.group};
  }
  const lane=ATTACK_BACK_LANES[p.idx]??0;
  const style=gameTactics(g,side).style,width=style==='Jeu au large'?1.07:style==='Jeu direct'?.82:1;
  const rel=clamp(35+(ball.y-35)*.16+lane*width,3,67);
  let depth=p.idx===8?2.2:p.idx===9?7.0:p.idx===14?23:p.idx===10||p.idx===13?12.3:10.5;
  let laneY=rel,move='support';
  const seq=g.attackSequence;
  if(seq&&seq.team===side&&g.clock<=seq.expires){
   const next=seq.receivers[seq.next];
   if(seq.name==='15 dans la ligne'&&p.idx===14){depth=10.8;laneY=clamp(ball.y+17,3,67);}
   if(seq.name==='Croisée 10–12'&&p.idx===11){depth=9;laneY=clamp(ball.y+4,3,67);}
   if(seq.name==='Croisée 10–12'&&p.idx===12){depth=12;laneY=clamp(ball.y-11,3,67);}
   if(seq.name==='Surnombre extérieur'&&p.idx===14){depth=11;laneY=clamp(ball.y+19,3,67);}
   if(seq.name==='Leurre puis large'&&p.idx===12){depth=9;laneY=clamp(ball.y+15,3,67);}
   if(seq.decoys.includes(p.idx)){
    depth=3.6;laneY=clamp(ball.y+(p.idx%2?8:-9),3,67);move='decoy';
   }
   if(p.idx===next){move='receive';depth=clamp(depth-1.6,3.7,19);laneY=clamp(laneY+(laneY-ball.y>0?1.6:-1.6),3,67);}
  }
  return {x:clamp(ball.x-dir*depth,2,98),y:laneY,action:move==='support'&&p.idx===14?'cover':move};
 }
 // Les tâches défensives sont partagées par l'équipe, pas recalculées individuellement pour chasser le ballon.
 if(g.mode==='play'&&!g.movingBall){
  const job=iq24DefenceAssignments(g)[p.id];
  if(job&&(p.idx===14||p.idx===5||p.idx===7))return {x:job.x,y:job.y,action:job.role==='chase'?'tackle-chase':job.role};
 }
 // Défense en étages : gardes de ruck, 1er rideau, extérieur, arrière de couverture.
 const tactic=gameTactics(g,side),press=tactic.defense==='Montée agressive'?-1.8:tactic.defense==='Attentiste'?2.5:0;
 const lane=DEFEND_LANES[p.idx];
 let rel=clamp(35+(ball.y-35)*.27+lane,2.2,67.8);
 // Coulissement coordonné : les arrières défensifs surveillent les receveurs
 // de leur côté sans abandonner la ligne sur chaque feinte du porteur.
 if(g.mode==='play'&&p.idx>=9&&p.idx<=13){
  let closest=null,minLane=15;
  for(let i=9;i<15;i++){const attacker=g.players[t][i],distance=Math.abs(attacker.y-rel);if(distance<minLane){closest=attacker;minLane=distance;}}
  if(closest)rel=clamp(rel*.69+closest.y*.31,2.2,67.8);
 }
 const xDepth=p.idx<=2?5.4:p.idx<=4?7.8:p.idx<=7?9.5:p.idx===8?11:p.idx===9?12.5:p.idx===14?29:15;
 let x=clamp(ball.x+dir*(xDepth+press),2,98);
 if(g.breakaway>0&&p.idx!==14){x=clamp(x+dir*6,2,98);if(p.idx===5||p.idx===7)rel=clamp((rel+ball.y)/2,2,68);}
 if(p.idx===14){
   const screen=g.breakaway>0?iq22DefenseScreen(g,t,carrierOf(g)):[];
   const target=screen[0]?.p;
   x=clamp(ball.x+dir*((g.breakaway>0?12:24)+press),2,98);
   rel=clamp((ball.y*(g.breakaway>0?.80:.52)+35*(g.breakaway>0?.20:.48)),3,67);
   if(g.breakaway>0&&target?.id===p.id)g.events.iq22CoverRecoveries=(g.events.iq22CoverRecoveries||0)+.05;
  }
 const dummyIndex=g.decoyBites?.[p.id],seq=g.attackSequence;
 if(seq&&seq.team===t&&dummyIndex!==undefined&&g.clock<seq.expires&&['play','tackle'].includes(g.mode)){
  const runner=g.players[t][dummyIndex];
  if(runner){rel=clamp(rel*.48+runner.y*.52,2,68);x=clamp(x-dir*1.6,2,98);}
 }
 const chaseIndex=(g.chasingDefenders||[]).indexOf(p.id);
 if(g.mode==='play'&&!g.movingBall&&chaseIndex!==-1&&p.idx!==14){
  const carrier=carrierOf(g),distance=meters(p,carrier);
  if(distance<(g.breakaway>0?31:19)){
   x=clamp(carrier.x+dir*(chaseIndex===0?1.0:1.65),1,99);
   rel=clamp(carrier.y+(chaseIndex===0?-.6:1.35),2,68);
   return {x,y:rel,action:'tackle-chase',chase:true};
  }
 }
 const shared=(g.mode==='play'&&!g.movingBall)?iq24DefenceAssignments(g)[p.id]:null;
 if(shared){x=clamp(x*.81+shared.x*.19,2,98);rel=clamp(rel*.79+shared.y*.21,2,68);}
 return {x,y:rel,action:p.idx===14?'cover':p.idx<3?'guard':p.idx<8?'press':'defend'};
}
function formationSpacing(g){
 const t=g.possession,back=g.players[t].filter(p=>p.idx>=9&&p.idx<=14);
 const def=g.players[1-t].filter(p=>p.idx<14);
 const spread=xs=>Math.max(...xs.map(p=>p.y))-Math.min(...xs.map(p=>p.y));
 return {attack:spread(back),defense:spread(def),activePod:attackPlan(g,t).active};
}
function avoidPlayerOverlap(g,dt){
 // Stabilise les déplacements hors regroupement sans déplacer le ballon ou défaire les packs.
 if(!['play','kick-reception'].includes(g.mode))return;
 for(let side=0;side<2;side++){
  const team=g.players[side];
  for(let i=0;i<team.length;i++)for(let j=i+1;j<team.length;j++){
   const a=team[i],b=team[j];
   if(side===g.possession&&(a.idx===g.carrier||b.idx===g.carrier))continue;
   let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
   if(d>2.9)continue;
   if(d<.01){const phase=(i*7+j*11)%9;dx=Math.cos(phase);dy=Math.sin(phase);d=1;}
   const push=clamp((2.9-d)*.25,0,Math.min(.38,dt*1.35));
   const px=dx/d*push,py=dy/d*push;
   a.x=clamp(a.x-px,1,99);a.y=clamp(a.y-py,1,69);
   b.x=clamp(b.x+px,1,99);b.y=clamp(b.y+py,1,69);
  }
 }
}
// V0.13 — Coordination sans ballon : choix de soutiens à partir de la position,
// de l'angle de course, de la possession et de la répartition réelle des défenseurs.
// Mémoriser les rôles pendant plusieurs secondes évite les changements incessants de couloir.
function planSupportRunners(g,team){
 if(g.mode!=='play'||g.contact)return {};
 if(g.movingBall)return g.supportAssignments||{};
 const holder=carrierOf(g);if(!holder)return {};
 const dir=attackDir(team),enemies=g.players[1-team];
 const signature=team+'|'+holder.id+'|'+g.phase;
 const memo=g.supportMemo;
 const reevaluate=!(memo&&memo.signature===signature&&g.clock-memo.at<RUGBY_IQ.supportReplan);
 let assigned=memo?.assigned||[];
 if(reevaluate){
  const candidates=g.players[team].filter(p=>p.id!==holder.id);
  const rated=candidates.map(p=>{
   const distance=meters(p,holder),back=(holder.x-p.x)*dir;
   const catchUp=back>0?back/Math.max(2.8,p.speed*.98):Math.abs(back)/Math.max(2.8,p.speed);
   const candidateBias=p.idx===8?-2.6:p.idx===14?-.8:p.idx<5?2.5:0;
   const beyond=back<-.1?8:0;
   return {p,rating:catchUp*3.7+distance*.40+candidateBias+beyond};
  }).sort((a,b)=>a.rating-b.rating||a.p.idx-b.p.idx);
  const keep=memo?.signature===signature?memo.assigned:[];
  const chosen=(keep||[]).filter(id=>rated.some(o=>o.p.id===id)).slice(0,4);
  for(const item of rated)if(chosen.length<4&&!chosen.includes(item.p.id))chosen.push(item.p.id);
  assigned=chosen;
  g.supportMemo={signature,assigned,at:g.clock};
 }
 const roles={},lanes=[-3.8,3.8,-8.6,8.6];
 const depths=g.breakaway>0?[2.0,2.8,4.2,5.0]:[2.5,3.2,4.5,5.5];
 const ahead=g.breakaway>0?1.4:0.55;
 const predict={x:clamp(holder.x+dir*ahead,1,99),y:holder.y};
 for(let i=0;i<assigned.length;i++){
  const p=g.players[team].find(p=>p.id===assigned[i]);if(!p)continue;
  const boundary=predict.y>57||predict.y<13;
  const lane=boundary?lanes[i]*(predict.y>35&&lanes[i]>0?-.4:predict.y<35&&lanes[i]<0?-.4:1):lanes[i];
  let y=clamp(predict.y+lane,3,67);
  const traffic=enemies.filter(q=>Math.abs(q.y-y)<4.2&&(q.x-holder.x)*dir>-1&&(q.x-holder.x)*dir<12).length;
  const depth=depths[i]+(traffic>2?1:0);
  const back=(holder.x-p.x)*dir;
  const goal={x:clamp(predict.x-dir*depth,1,99),y};
  roles[p.id]={...goal,rank:i,chase:back>6,
   kind:back>7?'chase-support':i===0?'inside-support':i===1?'outside-support':'trail-support'};
 }
 if(g.breakaway>0){g.events.iqSupportBreaks+=.01;}
 return roles;
}

function reposition(g,dt){
 if(g.mode==='kickoff'||g.mode==='penalty')return;
 const t=g.possession,dir=attackDir(t),ball=g.ball;
 const stationary=['scrum','lineout','maul'].includes(g.mode);
 const target=stationary?(g.setPiece||ball):ball;
 const plan=attackPlan(g,t);
 g.planDebug={shape:plan.shape,active:plan.active,groups:plan.groups};
 g.supportAssignments=planSupportRunners(g,t);
 g.chasingDefenders=[];
 if(g.mode==='play'&&!g.movingBall){
  const holder=carrierOf(g),opp=g.players[1-t];
  const available=opp.filter(p=>meters(p,holder)<(g.breakaway>0?32:19))
   .sort((a,b)=>meters(a,holder)-meters(b,holder));
  const aggressive=gameTactics(g,1-t).defense==='Montée agressive';
  g.chasingDefenders=available.slice(0,aggressive?4:3).map(p=>p.id);
 }
 for(let side=0;side<2;side++)for(const p of g.players[side]){
  if(!rm25Active(g,p)){p.x=-30;p.y=side===0?8:62;continue;}
  if(g.mode==='tackle' && g.contact?.bodies?.actors.some(a=>a.id===p.id))continue;
  let goal;
  if(stationary){
   const sp=g.setPiece||{start:g.clock,duration:1,team:t,progress:0,advance:0},q=sp.progress||0;
   const engage=Math.sin(clamp(q,0,1)*Math.PI),teamDir=side===sp.team?dir:-dir;
   if(g.mode==='scrum'){
    // Trois premières lignes, deux deuxièmes lignes et trois troisièmes lignes.
    // Packs opposés et verrouillés, avec appuis distincts et poussée progressive.
    const rows=[[1.16,-3.2],[1.16,0],[1.16,3.2],[3.18,-1.7],[3.18,1.7],[4.9,-3.0],[4.9,0],[4.9,3.0]];
    const r=rows[p.idx];
    goal=p.idx<8?{x:target.x-teamDir*(r[0]-.44*engage),y:target.y+r[1],action:'scrum'}:
      {x:target.x-teamDir*(p.idx===8?8:p.idx===9?13:22),y:clamp(target.y+(p.idx-11)*5.2,3,67),action:p.idx===8?'ready':'set'};
   }else if(g.mode==='lineout'){
    const inward=target.y<35?1:-1,depth=[7,0,10.5,14,17.5,15.5,21.5,25];
    const at=target.y+inward*depth[p.idx];
    const jumper=sp.throwTarget??3;
    if(p.idx<8){
     const activeJump=p.idx===jumper;
     const lifter=p.idx===jumper-1||p.idx===jumper+1;
     goal={x:target.x+teamDir*(2.35+(activeJump?.4:0)),y:clamp(lifter?target.y+inward*(depth[jumper]+(p.idx<jumper?-2.5:2.5)):at,2,68),action:activeJump?'jump':lifter?'lift':p.idx===1?'throw':'lineout'};
    }else goal={x:target.x-teamDir*(p.idx===8?6:16),y:clamp(35+(p.idx-11)*5.8,3,67),action:'ready'};
   }else {
    const anchor=clamp(sp.x+attackDir(sp.team)*(sp.advance||0),2,98);
    const circle=[[-1.6,-1.9],[-.4,1.8],[.4,-1.2],[-2.2,1.2],[1.8,1.4],[-3.4,-.2],[2.7,-1.5],[-1.3,2.8]];
    const r=circle[p.idx];
    goal=p.idx<8?{x:anchor-teamDir*r[0],y:clamp(target.y+r[1],2,68),action:'maul'}:
      {x:anchor-teamDir*(p.idx===8?6:15),y:clamp(target.y+(p.idx-11)*6,2,68),action:'support'};
   }
  }else goal=targetPosition(g,side,p,plan);
  if(!goal)continue;
  const x=clamp(goal.x,1,99),y=clamp(goal.y,1,69);
  p.action=goal.action;p.pod=goal.pod??-1;
  const dx=x-p.x,dy=y-p.y,len=Math.hypot(dx,dy)||1;
  const sprint=clamp(p.speed*(.80+p.f/380)*(g.mode==='ruck'?.91:1)*(goal.carrier&&g.breakaway>0?1.17:1),2.6,8.7);
  const stop=['tackle','ground','ruck','scrum','lineout','lift','jump','maul'].includes(p.action);
  const desire=stop?Math.min(sprint,stationary&&g.setPiece?.progress<.65?5.7:3.1):goal.chase?Math.min(9.3,sprint*1.62):sprint;
  const vx=dx/len*Math.min(desire,len/Math.max(.05,dt)),vy=dy/len*Math.min(desire,len/Math.max(.05,dt));
  // Inertie corporelle : décélération avant un changement de direction brusque.
  const targetHeading=len>.3?Math.atan2(dy,dx):(p.angle||0);
  const previousHeading=p.angle??targetHeading;
  const turn=Math.atan2(Math.sin(targetHeading-previousHeading),Math.cos(targetHeading-previousHeading));
  const turnLimit=dt*(p.idx<5?2.65:p.idx<8?3.15:4.25);
  const turning=clamp(turn,-turnLimit,turnLimit);
  p.angle=previousHeading+turning;
  p.angularRate=dt>0?turning/dt:0;
  const turnPenalty=stop?1:clamp(1-Math.abs(turn)*.18,.64,1);
  const easing=clamp(dt*(stop?7.3:4.6)*turnPenalty,0,1);
  p.vx=(p.vx||0)+(vx-(p.vx||0))*easing;p.vy=(p.vy||0)+(vy-(p.vy||0))*easing;
  const mx=clamp(p.vx*dt,-Math.abs(dx),Math.abs(dx)),my=clamp(p.vy*dt,-Math.abs(dy),Math.abs(dy));
  p.x=clamp(p.x+mx,0,100);p.y=clamp(p.y+my,0,70);
  const amount=Math.hypot(mx,my);
  // Temps de pose du pied déterminé par les mètres parcourus, pas par les images affichées.
  p.stepCycle=(p.stepCycle||0)+amount*(p.idx<8?2.1:2.6);
  p.lean=(p.lean||0)+(clamp(-p.angularRate*.13,-.27,.27)-(p.lean||0))*clamp(dt*5.2,0,1);
  if(stationary&&p.idx<8){p.angle=side===g.setPiece.team?(attackDir(side)===1?0:Math.PI):(attackDir(side)===1?0:Math.PI);}
  else if(amount>.018&&stop)p.angle=Math.atan2(my,mx);
  p.stride=(p.stride+amount*.9)%6.28;p.effort=amount/Math.max(.01,dt);
  p.f=Math.max(26,p.f-dt*(amount>.03?.00155:.0006)*(1-(g.staffFitnessMods?.[side]||0)*2));
 }
 // Separation limited to noncontact phases, preserving the geometry of set pieces.
 if(['play','kick-reception'].includes(g.mode))for(let side=0;side<2;side++)for(let i=0;i<15;i++)for(let j=i+1;j<15;j++){
  const a=g.players[side][i],b=g.players[side][j],dd=meters(a,b);
  if(dd<1.65){const nx=dd>.01?(a.x-b.x)/dd:(i%2?1:-1),ny=dd>.01?(a.y-b.y)/dd:(j%2?1:-1);
   const separation=(1.65-dd)*.25;a.x=clamp(a.x+nx*separation,0,100);a.y=clamp(a.y+ny*separation,0,70);
   b.x=clamp(b.x-nx*separation,0,100);b.y=clamp(b.y-ny*separation,0,70);
  }
 }
}
function bestAttackingGap(g,t,p){
 const defenders=g.players[1-t],left=clamp(p.y-9,3,67),right=clamp(p.y+9,3,67);
 const options=[left,(left+p.y)/2,p.y,(right+p.y)/2,right];
 let target=p.y,best=-100;
 for(const yy of options){
  const nearest=defenders.filter(q=>(q.x-p.x)*attackDir(t)>-3).reduce((m,q)=>Math.min(m,Math.abs(q.y-yy)),40);
  const quality=nearest-Math.abs(yy-p.y)*.23;
  if(quality>best){best=quality;target=yy;}
 }
 return target;
}
function gameStep(g,dt){
 rm25UpdateDiscipline(g);rm25Frame(g);
 if(g.ended)return;
 dt=clamp(dt,0,.7);g.clock+=dt*({'conversion':0,'penalty':.8,'kick-flight':1.1,'lineout':.9,'scrum':.9,'maul':2.3,'tackle':2.1,'ruck':2.52,'kickoff':2.2}[g.mode]??2.73);
 if(iq20CheckAdvantage(g))return;
 if(g.clock>=4800){g.clock=4800;g.ended=true;logAction(g,'Fin du match · score final','final');return;}
 if(g.clock>=2400&&!g.halfTimeShown){g.halfTimeShown=true;logAction(g,'Mi-temps : reprise de la deuxième période','restart');}
 g.stats.poss[g.possession]+=dt;
 g.tackleShield=Math.max(0,g.tackleShield-dt);g.breakaway=Math.max(0,g.breakaway-dt);
 if(['kickoff','kick-reception','kick-flight','lineout','scrum','maul','ruck','penalty','conversion','tackle'].includes(g.mode)){
  if(g.mode==='kick-flight'&&g.kickFlight){iqKickChase(g,dt);g.kickFlight.elapsed=Math.min(g.kickFlight.duration,g.kickFlight.elapsed+dt);const f=g.kickFlight,p=f.elapsed/f.duration;g.ball=rm27KickPoint(f,p);}
  if(g.mode==='conversion'&&g.conversionFlight)g.conversionFlight.elapsed=Math.min(g.conversionFlight.duration,g.conversionFlight.elapsed+dt);
  if(g.mode==='penalty'&&g.penaltyFlight)g.penaltyFlight.elapsed=Math.min(g.penaltyFlight.duration,g.penaltyFlight.elapsed+dt);
  if(g.mode==='kickoff'&&g.restartFlight)g.restartFlight.elapsed=Math.min(g.restartFlight.duration,g.restartFlight.elapsed+dt);
  if(g.mode==='tackle'&&g.contact){g.contact.elapsed=Math.min(g.contact.duration,g.contact.elapsed+dt);g.contact.progress=clamp(g.contact.elapsed/Math.max(.01,g.contact.duration),0,1);g.contact.phase=g.contact.progress<.23?'approche':g.contact.progress<.58?'impact':'sol';}
  if(g.mode==='tackle'&&g.contact)integrateContact(g,dt);
  if(g.setPiece){
   const sp=g.setPiece;
   sp.elapsed=Math.min(sp.duration,sp.elapsed+dt);
   sp.progress=clamp(sp.elapsed/Math.max(0.01,sp.duration),0,1);
   if(g.mode==='scrum')rm27ScrumStep(g,sp,dt);
   if(g.mode==='maul'){
    const a=g.players[sp.team].slice(0,8).reduce((v,p)=>v+p.skill*(p.f/100),0);
    const d=g.players[1-sp.team].slice(0,8).reduce((v,p)=>v+p.skill*(p.f/100),0);
    const force=clamp((a-d)/Math.max(600,a+d),-.24,.24);
    // Poussée collective avec résistance : maul parfois stoppé, sans déplacement instantané.
    const step=dt*clamp(.21+force*1.3,.0,.46);
    sp.advance+=step;g.ball.x=clamp(sp.x+attackDir(sp.team)*sp.advance,2,99);
   }
  }
  if(g.mode!=='kickoff'&&g.mode!=='penalty'&&g.mode!=='conversion'&&g.mode!=='kick-flight')reposition(g,dt);
  g.setTimer-=dt;
  if(g.setTimer<=0){const old=g.mode;
   if(old==='conversion'&&g.conversionFlight){
    const f=g.conversionFlight;g.conversionFlight=null;
    if(f.success){g.score[f.side]+=2;g.events.conversions++;logAction(g,`Transformation réussie — ${f.kicker}`,'conversion');}
    else logAction(g,`Transformation manquée — ${f.kicker}`,'conversion');
    restart(g,1-f.side,'Renvoi après l’essai');
   }else if(old==='penalty'&&g.penaltyFlight){
    const k=g.penaltyFlight;g.penaltyFlight=null;
    if(k.success){g.score[k.side]+=3;if(k.kind==='drop')g.events.dropGoals++;else g.events.penaltyGoals++;g.scoreFlash={x:k.to.x,y:k.to.y,at:g.clock,type:'penalty'};logAction(g,`${k.kind==='drop'?'Drop':'Pénalité'} réussi — ${k.kicker}`,'score');}
    else logAction(g,`${k.kind==='drop'?'Drop':'Pénalité'} manqué — ${k.kicker}`,'miss');
    if(k.success)restart(g,1-k.side,'Renvoi après les points');
    else iqRestart22(g,1-k.side,'Renvoi aux 22 mètres après tir manqué');
   }else if(old==='kick-flight'&&g.kickFlight){
    const k=g.kickFlight;g.kickFlight=null;
    if(k.inTouch){if(k.penaltyTouch)newSetPiece(g,'lineout',k.side,k.to.x,k.to.y<35?1:69,'Pénaltouche : lancer conservé');else if(k.award50){g.events.fiftyTwos++;newSetPiece(g,'lineout',k.side,k.to.x,k.to.y<35?1:69,'50:22 ! Lancer conservé pour le botteur');}else newSetPiece(g,'lineout',1-k.side,k.to.x,k.to.y<35?1:69,'Touche trouvée · lancer adverse');}
    else{rm27ReceiveKick(g,k);}
   }else if(['lineout','scrum','maul'].includes(old))resolveSet(g);
   else if(old==='tackle')resolveContact(g);
   else if(old==='ruck'){
    const defense=gameTactics(g,1-g.possession).defense;
    const dir=attackDir(g.possession);
    const rogue=g.players[1-g.possession].filter(p=>!g.ruckActors?.defense?.includes(p.id)
      &&Math.abs(p.y-g.ball.y)<8&&(p.x-g.ball.x)*dir<1.5);
    if(rogue.length && rand(g)<.045){
     g.events.offsideAtRuck++;
     rm25Infringement(g,'hors-jeu',1-g.possession,rogue[0],{reason:'Hors-jeu devant le dernier pied du ruck'});
    }
    const contest=ruckContest(g);
    const pressure=contest.pressure;
    const attackingPenalty=contest.defenseContest>0 && rand(g)<clamp(.011+Math.max(0,pressure)*.048,0,.045);
    const defendingPenalty=rand(g)<clamp(.022+Math.max(0,-pressure)*.02+(defense==='Montée agressive'?.008:0),.012,.048);
    if(attackingPenalty){
      g.events.holdingOn++;
      rm25Infringement(g,'conservation au sol',g.possession,g.players[g.possession][g.carrier],{advantage:false,reason:'Ballon non libéré sous contest légal'});
    }else if(defendingPenalty){
      g.events.illegalSideEntries++;
      const def=g.players[1-g.possession].filter(p=>g.ruckActors?.defense?.includes(p.id));
      rm25Infringement(g,'entrée latérale',1-g.possession,def[0],{reason:'Entrée illégale dans le ruck depuis le côté'});
      if(g.advantage){if(!iq21ReleaseRuck(g)){g.mode='ruck';g.setTimer=.55;}}
    }else if(contest.defenseContest>0 && rand(g)<clamp(.020+pressure*.080,.002,.090)){
      g.events.ruckSteals++;g.events.turnoversWonAtRuck++;
      changePossession(g,1-g.possession,'Grattage légal : ballon récupéré');
    }else{
      if(iq21ReleaseRuck(g)){g.events.iqQuickRucks++;}
      else{g.mode='ruck';g.setTimer=.55;}
      if(rand(g)<.28)logAction(g,'Libération rapide du ruck','ruck');
    }
   }else{
    g.mode='play';g.carryOrigin=g.ball.x;g.carrySeconds=0;
    g.actionTimer=.5;g.tackleShield=1.7;
    if(old==='kickoff'){g.restartFlight=null;logAction(g,'Renvoi réceptionné · jeu lancé','restart');}
   }
  }
  return;
 }
 const t=g.possession,dir=attackDir(t),def=g.players[1-t];
 if(g.movingBall){
   const b=g.movingBall;b.elapsed+=dt;const receivingPlayer=g.players[b.team]?.[b.receiver];if(receivingPlayer&&b.kind==='pass'){/* release point immutable; pass in-flight cannot follow the receiver */}const ratio=Math.min(1,b.elapsed/b.duration);
   g.ball.x=b.from.x+(b.to.x-b.from.x)*ratio;
   g.ball.y=b.from.y+(b.to.y-b.from.y)*ratio;
   if(iq21Intercept(g,b,ratio)){reposition(g,dt);return;}
   if(ratio>=1){
    g.carrier=b.receiver;g.movingBall=null;g.tackleShield=.65;rm25Stat(g,b.team,g.players[b.team][b.receiver],'receives');rm25Stat(g,b.team,g.players[b.team][b.receiver],'carries');
    if(receivingPlayer){
      const separation=meters(receivingPlayer,b.to);
      if(b.kind==='pass'&&separation>5.2){g.events.knockons++;rm25Stat(g,t,receivingPlayer,'knockons');rm25Infringement(g,'en-avant',t,receivingPlayer,{restart:'scrum',reason:'Réception manquée après transmission'});return;}
      g.ball.x=receivingPlayer.x;g.ball.y=receivingPlayer.y;
    }
    if(g.attackSequence&&g.attackSequence.team===t&&g.attackSequence.next>=g.attackSequence.receivers.length&&b.receiver===g.attackSequence.receivers.at(-1)){
     g.events.patternCompletions++;logAction(g,`Combinaison ${g.attackSequence.name} aboutie · continuité du jeu`,'pattern');
     g.attackSequence=null;g.decoyBites={};g.tackleShield=1.05;
    }
    const receiver=carrierOf(g),pressure=def.some(p=>meters(p,receiver)<3.5);
    if(rand(g)<(pressure?.061:.020)){
     g.events.knockons++;rm25Stat(g,t,receiver,'knockons');
     rm25Infringement(g,'en-avant',t,receiver,{restart:'scrum',reason:'Ballon échappé à la réception'});return;
    }
    if(rand(g)<clamp(.048+(localOverload(g,t,receiver).advantage>0?.034:0),.065,.16)){g.breakaway=2.3;g.events.linebreaks++;rm25Break(g,t,receiver);logAction(g,`${receiver.name} attaque l'intervalle !`,'break');}
   }
 }
 reposition(g,dt);
 if(!g.movingBall){
  const h=carrierOf(g);g.ball={x:h.x,y:h.y};
  const nearest=def.reduce((best,p)=>{const d=meters(p,h);return d<best.d?{p,d}:best;},{p:null,d:999});
  if((h.x>=98&&t===0)||(h.x<=2&&t===1)){awardTry(g);return;}
  if(nearest.d<phaseProfile(g).contactRadius&&g.tackleShield<=0){
   if(rand(g)<.023){
    g.events.knockons++;rm25Stat(g,t,h,'knockons');
    rm25Infringement(g,'en-avant',t,h,{restart:'scrum',reason:'Ballon perdu vers l’avant au contact'});return;
   }
   if((h.y<5||h.y>65)&&rand(g)<.19){
    newSetPiece(g,'lineout',1-t,h.x,h.y<35?1:69,`${h.name} poussé en touche · lancer adverse`);return;
   }
   const physical=(h.skill-(nearest.p?.skill||70));
   const edge=localOverload(g,t,h);
   const protection=defensivePressure(g,t,h);
   const advantage=clamp(edge.advantage,-2,2);
   const cover=iq22DefenseScreen(g,t,h);
   const lastLine=cover.filter(o=>o.eta<3.1&&o.gap<11).length;
   const linebreakChance=clamp(.235+phaseProfile(g).breakAdjustment+(g.staffMods?.[t]||0)-(g.staffDefenseMods?.[1-t]||0)+physical*.004+(g.breakaway>0?.075:0)+Math.max(0,advantage)*.019-Math.max(0,protection-3)*.010-lastLine*.012-(100-(nearest.p?.f||100))*.0006,.11,.61);
   if(rand(g)<linebreakChance){
    const burst=1.3+rand(g)*2.1;
    h.x=clamp(h.x+dir*burst,1,99);g.ball.x=h.x;g.stats.meters[t]+=burst;
    g.events.linebreaks++;rm25Break(g,t,h);g.breakaway=1.8;g.tackleShield=.18;
    logAction(g,`${h.name} franchit ! Les soutiens accélèrent dans son dos`,'break');
    // No statistical offload unless a real offload flight is generated.
   }else{
    beginContact(g,nearest.p);return;
   }
  }
  if((g.ball.x>=98.5&&t===0)||(g.ball.x<=1.5&&t===1)){awardTry(g);return;}
  g.carrySeconds+=dt;
  const gained=(h.x-g.carryOrigin)*dir;
  if((g.carrySeconds>4.4&&gained>10)||(g.carrySeconds>5.9&&gained>3)){
   if(nearest.d<phaseProfile(g).contactRadius+1.1){beginContact(g,nearest.p);return;}
   // Les joueurs non plaqués peuvent conserver le ballon et trouver une solution.
   g.actionTimer=Math.min(g.actionTimer,.20);g.carrySeconds=2.0;
  }
  g.actionTimer-=dt;if(g.actionTimer<=0)onDecision(g);
  const runMetres=Math.max(0,dt*(h.speed*.53));g.stats.meters[t]+=runMetres;rm25Stat(g,t,h,'metres',runMetres);
 }
}
function playFast(f){if(window.RM27_USE_SIMPLE!==false)return rmSimpleSimulateFixture(f);const g=makeGame(f);let steps=0;while(!g.ended&&steps++<12500)gameStep(g,.5);if(!g.ended)g.ended=true;
 return {home:g.score[0],away:g.score[1],homeTries:g.tries[0],awayTries:g.tries[1],events:g.events,sim:'conquest-kicking-v027',seed:seeded('game-v03-'+f.id)};}
function completeGame(g){const r={home:g.score[0],away:g.score[1],homeTries:g.tries[0],awayTries:g.tries[1],events:g.events,sim:'conquest-kicking-v027',seed:seeded('game-v03-'+g.id)};const fx=getFixtures(g.home.league).find(f=>f.id===g.id);if(fx&&!fx.result)fx.result=r;state.past.push({home:g.home.name,away:g.away.name,result:r,at:new Date().toISOString()});save();}

function finishMatch(){if(!match)return;completeGame(match);match=null;state.page='accueil';render();toast('Résultat et classement enregistrés')}
function playRound(){const lid=state.leagueId,fx=getFixtures(lid),first=fx.find(f=>!f.result);if(!first){toast('Tous les matchs de cette ligue sont terminés');return}const round=first.round;const pending=fx.filter(x=>x.round===round&&!x.result);if(!confirm(`Simuler automatiquement les ${pending.length} matchs restant de la journée ${round} de ${league(lid).name} ?\nLe résultat de votre club sera simulé s’il participe à cette journée et n’a pas encore joué.`))return;for(const f of pending)f.result=playFast(f);save();render();toast(`Journée ${round} simulée, classement actualisé`)}
function matchPage(g){return `<div class="match-shell v017-broadcast">
<header class="broadcast-header"><div class="broadcast-brand"><span>RUGBY MANAGER 27</span><b>Match en direct</b></div><div class="broadcast-score"><div class="score-team">${iconCrest(g.home,'lg')}<b>${esc(g.home.name)}</b></div><strong class="live-score"><span id="score0">0</span><span class="separator">—</span><span id="score1">0</span></strong><div class="score-team away"><b>${esc(g.away.name)}</b>${iconCrest(g.away,'lg')}</div></div><div class="broadcast-clock"><b id="clock">00:00</b><small id="phase">RENVOI</small></div><button class="broadcast-back" data-match-action="quit" aria-label="Quitter le match">← Quitter</button></header>
<div class="match-grid"><section class="pitch-section"><div class="match-camera-bar" role="group" aria-label="Réglages de la caméra de match">
<label for="matchCamera">◉ CAMÉRA <select id="matchCamera" aria-label="Choisir la vue du match"><option value="tv">TV — près de l'action</option><option value="close">Rapprochée — contacts</option><option value="ball">Suivi du ballon</option><option value="wide">Grand angle</option><option value="tactical">Tactique — terrain entier</option></select></label><span class="cam-separator" aria-hidden="true"></span><button type="button" id="cameraMinus" title="Éloigner la caméra" aria-label="Dézoomer">−</button><span id="cameraZoomLabel">100 %</span><button type="button" id="cameraPlus" title="Rapprocher la caméra" aria-label="Zoomer">+</button><button type="button" id="cameraReset" title="Réinitialiser le zoom" aria-label="Réinitialiser le zoom" style="font-size:13px">↺</button><span class="cam-note" id="cameraNote">Caméra TV : joueurs plus proches, suivi doux</span><button type="button" class="cam-full" data-match-action="fullscreen" aria-label="Afficher le terrain en plein écran">⛶ Plein écran</button></div><div class="pitch-container" id="pitchContainer"><button type="button" class="exit-fullscreen" id="exitFullScreen" title="Réduire" aria-label="Quitter le plein écran">✕ Réduire</button><div class="fullscreen-camera-tools" role="group" aria-label="Contrôler la caméra en plein écran"><button type="button" data-match-action="camera-cycle" title="Changer de caméra" id="cameraFullTitle">◉ TV</button><button type="button" data-match-action="camera-zoom-minus" aria-label="Dézoomer">−</button><button type="button" data-match-action="camera-zoom-plus" aria-label="Zoomer">+</button></div><canvas id="pitch" width="1280" height="720" aria-label="Terrain, trente joueurs, phases de rugby en 2D"></canvas><div id="rm25-replay-overlay" class="rm25-replay-overlay" hidden><div class="rm25-replay-top"><b>RALENTI · <span id="rm25-replay-time">00:00</span></b><button data-replay-control="close">✕ Retour au direct</button></div><div id="rm25-replay-title" class="rm25-replay-title">Action enregistrée</div><div class="rm25-replay-bottom"><button data-replay-control="back">◀</button><button id="rm25-replay-play" data-replay-control="play">Ⅱ Pause</button><button data-replay-control="forward">▶</button><input id="rm25-replay-slider" type="range" min="0" max="0" value="0" aria-label="Position du ralenti"><span id="rm25-replay-step">1 / 1</span></div></div><div class="broadcast-phase"><small>PHASE EN COURS</small><strong id="phasePill">RENVOI</strong><span id="phaseSequence">Séquence 1</span></div></div>
<div class="broadcast-ticker"><b id="tickClock">00:00</b><span class="event-indicator">●</span><span id="eventLabel">Coup d’envoi</span></div>
<div class="match-controls"><div class="control-primary"><button class="icon-control" data-match-action="pause" id="pauseControl">Ⅱ Pause</button><div class="speed-set">${[1,2,4,8].map(n=>`<button class="speed-btn ${n===1?'active':''}" data-speed="${n}">×${n}</button>`).join('')}</div></div><div class="control-secondary"><button class="cam-btn" data-match-action="panel-tactics">⚙ Tactiques</button><button class="cam-btn" data-match-action="panel-sub">Remplacements</button><button class="cam-btn" data-match-action="panel-stats">Statistiques</button><button class="cam-btn" data-match-action="panel-analytics">◫ Analyse</button><button class="cam-btn rm25-video-button" data-match-action="panel-video">▶ Replays</button><button class="cam-btn options-btn" data-match-action="panel-options" title="Affichage">☷ Options</button></div></div>
<div class="broadcast-extra" id="broadcastExtra" hidden><button class="cam-btn" data-match-action="fullscreen">⛶ Plein écran</button><button class="cam-btn" data-match-action="toggle-labels" id="labelsBtn">Noms</button><button class="cam-btn" data-match-action="toggle-lines" id="linesBtn">Trajectoires</button><button class="cam-btn" data-match-action="toggle-pods" id="podsBtn">Pods</button><button class="cam-btn" data-match-action="panel-events">Actions</button><button class="icon-control simulate" data-match-action="fast">Terminer »</button></div>
</section><div class="broadcast-screen" id="broadcastScrim" data-match-action="panel-close"></div><aside class="match-aside" id="matchSidePanel"><div class="drawer-top"><b id="drawerTitle">COACHING EN DIRECT</b><button type="button" data-match-action="panel-close" aria-label="Fermer le panneau">✕</button></div><section class="panel coaching-panel"><div class="panel-heading"><div><span class="eyebrow">DÉCISIONS</span><h2>Coaching en direct</h2></div></div><div class="game-tact"><label>Approche <select id="liveStyle"><option>Équilibré</option><option>Jeu au large</option><option>Jeu direct</option><option>Conservation</option></select></label><label>Structure <select id="liveShape"><option>1-3-3-1</option><option>2-4-2</option></select></label><label>Combinaison <select id="livePlaybook">${PATTERN_OPTIONS.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Défense <select id="liveDefense"><option>Glissée</option><option>Montée agressive</option><option>Attentiste</option></select></label><label>Jeu au pied <select id="liveKick"><option>Territoire</option><option>Conservation</option><option>Pression aérienne</option></select></label><fieldset class="rm26-orders"><legend>Conquête & jeu au pied</legend>
<label>Zone de touche <select id="rm26Line"><option value="auto">Automatique</option><option value="court">Premier sauteur</option><option value="milieu">Milieu</option><option value="fond">Fond de touche</option></select></label>
<label>Après touche <select id="rm26Launch"><option value="auto">Lecture libre</option><option value="maul">Maul porté</option><option value="large">Lancement au large</option><option value="neuf">Sortie au 9</option></select></label>
<label>Plan de mêlée <select id="rm26Scrum"><option value="auto">Automatique</option><option value="stable">Sécuriser</option><option value="pression">Poussée offensive</option><option value="huit">Départ du n°8</option></select></label>
<label>Type de jeu au pied <select id="rm26Kick"><option value="auto">Lecture du terrain</option><option value="territoire">Dégagement territorial</option><option value="chandelle">Chandelle</option><option value="rasant">Rasant dans le dos</option><option value="50:22">Recherche 50:22</option></select></label>
<label>Sur pénalité <select id="rm26Penalty"><option value="auto">Décision du capitaine</option><option value="poteaux">Tirer aux poteaux</option><option value="touche">Pénaltouche</option><option value="melee">Mêlée</option></select></label>
<small>Consignes appliquées lors de la prochaine phase ; l'adversaire décide aussi selon son territoire et le score.</small></fieldset><details class="sub-panel"><summary>Effectuer un remplacement</summary><label>Sortie <select id="subOut">${(g.players[g.userSide]||[]).map(p=>`<option value="${p.idx}">${p.number} · ${esc(p.name)} (${p.position})</option>`).join('')}</select></label><label>Entrée <select id="subIn">${(g.bench[g.userSide]||[]).map(p=>`<option value="${esc(p.id)}">${p.number} · ${esc(p.name)} (${p.position})</option>`).join('')}</select></label><button class="btn ghost full" data-match-action="sub">Confirmer le remplacement</button></details></div></section>
<details class="panel detail-panel"><summary>Statistiques du match</summary><div class="match-stats"><div><span>Cartons jaune / rouge</span><b id="rm25cardsstat">0 / 0</b></div><div><span>Fautes motivées</span><b id="rm25foulsstat">0</b></div><div><span>Possession</span><b id="posstat">50% / 50%</b></div><div><span>Structure / POD</span><b id="shapestat">1-3-3-1</b></div><div><span>Rideau</span><b id="defspreadstat">—</b></div><div><span>Essais</span><b id="trystat">0 / 0</b></div><div><span>Rucks</span><b id="ruckstat">0</b></div><div><span>Sorties jouées / conquêtes libérées</span><b id="exitstat">0 / 0</b></div><div><span>Interceptions / surnombres lus</span><b id="iqstat">0 / 0</b></div><div><span>Contacts / récupérations</span><b id="contactstat">0 / 0</b></div><div><span>Combinaisons</span><b id="patternstat">0 / 0</b></div><div><span>Leurres / surnombres</span><b id="decoyoverlapstat">0 / 0</b></div><div><span>Dernière combinaison</span><b id="lastpatternstat">Libre</b></div><div><span>Plaquages / à deux</span><b id="tacklestat">0 / 0</b></div><div><span>Offloads</span><b id="offloadstat">0</b></div><div><span>Passes</span><b id="passstat">0</b></div><div><span>Passe max en arrière</span><b id="backpassstat">0 m</b></div><div><span>Drops</span><b id="dropstat">0 / 0</b></div><div><span>Coups de pied</span><b id="kickstat">0</b></div><div><span>Pieds (territoire / chandelles / rasants / 50:22)</span><b id="rm26-kick-stats">—</b></div><div><span>Conquête (mêlées dominantes / départs du 8 / touches volées)</span><b id="rm26-set-stats">—</b></div><div><span>Ballons hauts récupérés / lancements arrières</span><b id="rm26-recover-stats">0</b></div><div><span>Pénalités</span><b id="penstat">0</b></div><div><span>Mêlées</span><b id="scrumstat">0</b></div><div><span>Touches</span><b id="linestat">0</b></div><div><span>Conquête</span><b id="setpieceStat">0 / 0</b></div><div><span>Turnovers</span><b id="turnstat">0</b></div><div><span>Franchissements</span><b id="breakstat">0</b></div><div><span>Avantages joués / rappelés</span><b id="advstat">0 / 0</b></div><div><span>50:22 réussis</span><b id="fiftytwostat">0</b></div><div><span>Passes écartées (risque)</span><b id="riskpassstat">0</b></div><div><span>Mètres</span><b id="meterstat">0 / 0</b></div></div></details>
<details class="panel detail-panel"><summary>Performances & analyse tactique</summary><div id="rm25-performance-report" class="rm25-report">Analyse des actions en cours…</div></details>
<details class="panel detail-panel"><summary>Vidéo & décisions</summary><div id="rm25-replay-report" class="rm25-report"><p>Les actions seront enregistrées pendant le match.</p></div></details>
<details class="panel detail-panel"><summary>Fil des actions</summary><div class="event-list" id="matchLog"><p>Rencontre prête.</p></div></details>
</aside></div></div>`}

const CAMERA_TIPS={tv:'Vue TV : proche de l’action, suivi doux',close:'Vue rapprochée : contacts et porteur',ball:'Suivi ballon : caméra centrée sur le ballon',wide:'Grand angle : voir les soutiens et la défense',tactical:'Vue tactique : tout le terrain visible'};
function updateCameraHud(){if(!match)return;const z=$('#cameraZoomLabel'),n=$('#cameraNote');if(z)z.textContent=Math.round(match.view.zoom*100)+' %';if(n)n.textContent=CAMERA_TIPS[match.view.cameraMode]||CAMERA_TIPS.tv;const fs=$('#cameraFullTitle');if(fs)fs.textContent='◉ '+({tv:'TV',close:'Proche',ball:'Ballon',wide:'Large',tactical:'Tactique'}[match.view.cameraMode]||'TV');}
function startMatch(f){if(window.RM27_USE_SIMPLE!==false)return startSimpleMatch(f);if(!f)return toast('Aucune rencontre à jouer');if(f.result)return toast('Rencontre déjà jouée');cancelAnimationFrame(animation);const view=$('#app');match=makeGame(f);match.recordingEnabled=true;match.replayData={rolling:[],clips:[],pending:[],nextAt:0,seq:0};rm25Replay=null;match.view.lines=false;match.view.pods=false;match.view.labels=false;match.view.zoom=1.0;match.view.cameraMode=uiSettings.cameraMode||'tv';match.view.cinematic=false;view.innerHTML=`<div class="match-layout">${matchPage(match)}</div>`;canvas=$('#pitch');ctx=canvas.getContext('2d');
 const cameraInput=$('#matchCamera'); cameraInput.value=match.view.cameraMode;
 cameraInput.onchange=e=>{match.view.cameraMode=e.target.value;uiSettings.cameraMode=e.target.value;saveUiSettings();updateCameraHud();};
 $('#cameraMinus').onclick=()=>{match.view.zoom=clamp(Math.round((match.view.zoom-.15)*100)/100,.7,1.6);updateCameraHud();};
 $('#cameraPlus').onclick=()=>{match.view.zoom=clamp(Math.round((match.view.zoom+.15)*100)/100,.7,1.6);updateCameraHud();};
 $('#cameraReset').onclick=()=>{match.view.zoom=1;updateCameraHud();};
 updateCameraHud();$('#liveStyle').value=match.tactics.style;$('#liveShape').value=match.tactics.shape||'1-3-3-1';$('#livePlaybook').value=match.tactics.playbook||'Automatique';$('#liveDefense').value=match.tactics.defense;$('#liveKick').value=match.tactics.kick;for(const [button,enabled] of [['labelsBtn',match.view.labels],['linesBtn',match.view.lines],['podsBtn',match.view.pods]])$('#'+button)?.classList.toggle('active',enabled);for(const [id,k] of [['liveStyle','style'],['liveShape','shape'],['livePlaybook','playbook'],['liveDefense','defense'],['liveKick','kick']])$('#'+id).addEventListener('change',e=>{match.tactics[k]=e.target.value;logAction(match,'Consigne modifiée : '+e.target.value)});for(const [id,key] of [['rm26Line','lineout'],['rm26Launch','launch'],['rm26Scrum','scrum'],['rm26Kick','kick'],['rm26Penalty','penalty']]){
 const el=$('#'+id);if(el){el.value=match.rm26UserOrders?.[key]||'auto';el.addEventListener('change',()=>{
  match.rm26UserOrders[key]=el.value;logAction(match,'Consigne conquête : '+el.selectedOptions[0].text,'pattern');
 });}}
 view.onclick=e=>{const rb=e.target.closest('[data-replay-open]');if(rb){rm25StartReplay(rb.dataset.replayOpen);return;}
 const ctrl=e.target.closest('[data-replay-control]');if(ctrl){rm25ReplayControls(ctrl.dataset.replayControl);return;}
 const b=e.target.closest('[data-match-action],[data-speed]');if(!b)return;if(b.dataset.speed){match.speed=+b.dataset.speed;$$('.speed-btn').forEach(x=>x.classList.toggle('active',x===b))}else if(b.dataset.matchAction==='camera-cycle'){const all=['tv','close','ball','wide','tactical'];match.view.cameraMode=all[(all.indexOf(match.view.cameraMode)+1)%all.length];uiSettings.cameraMode=match.view.cameraMode;saveUiSettings();const ci=$('#matchCamera');if(ci)ci.value=match.view.cameraMode;updateCameraHud();}else if(b.dataset.matchAction==='camera-zoom-plus'){match.view.zoom=clamp(Math.round((match.view.zoom+.15)*100)/100,.7,1.6);updateCameraHud();}else if(b.dataset.matchAction==='camera-zoom-minus'){match.view.zoom=clamp(Math.round((match.view.zoom-.15)*100)/100,.7,1.6);updateCameraHud();}else if(b.dataset.matchAction==='panel-options'){const e=$('#broadcastExtra');e.hidden=!e.hidden;}else if(['panel-tactics','panel-sub','panel-stats','panel-analytics','panel-events','panel-video','panel-close'].includes(b.dataset.matchAction)){const panel=$('#matchSidePanel'),scrim=$('#broadcastScrim'),typ=b.dataset.matchAction;const opening=typ!=='panel-close'&&(!panel.classList.contains('open')||panel.dataset.open!==typ);panel.classList.toggle('open',opening);scrim.classList.toggle('open',opening);panel.dataset.open=opening?typ:'';const details=panel.querySelectorAll('details');if(opening){details.forEach(el=>el.open=false);if(typ==='panel-sub')details[0]&&(details[0].open=true);if(typ==='panel-stats')details[1]&&(details[1].open=true);if(typ==='panel-analytics')details[2]&&(details[2].open=true);if(typ==='panel-video')details[3]&&(details[3].open=true);if(typ==='panel-events')details[4]&&(details[4].open=true);$('#drawerTitle').textContent=({'panel-tactics':'TACTIQUES ET COACHING','panel-sub':'REMPLACEMENTS','panel-stats':'STATISTIQUES DU MATCH','panel-analytics':'PERFORMANCES & ZONES','panel-video':'VIDÉO & ARBITRAGE','panel-events':'FIL DES ACTIONS'})[typ];}}else if(b.dataset.matchAction==='fullscreen'){const container=$('#pitchContainer');if(document.fullscreenElement){document.exitFullscreen?.()}else container?.requestFullscreen?.().then(()=>{screen.orientation?.lock?.('landscape').catch(()=>{})}).catch(()=>toast('Plein écran non disponible sur ce navigateur'))}else if(b.dataset.matchAction==='toggle-labels'){match.view.labels=!match.view.labels;b.classList.toggle('active',match.view.labels)}else if(b.dataset.matchAction==='toggle-lines'){match.view.lines=!match.view.lines;b.classList.toggle('active',match.view.lines)}else if(b.dataset.matchAction==='toggle-pods'){match.view.pods=!match.view.pods;b.classList.toggle('active',match.view.pods)}else if(b.dataset.matchAction==='visual-mode'){match.view.cinematic=match.view.cinematic===false?true:false;b.classList.toggle('active',match.view.cinematic);b.textContent=match.view.cinematic?'2D ÉPURÉE':'2D CLASSIQUE';}else if(b.dataset.matchAction==='toggle-zoom'){match.view.zoom=match.view.zoom===1?1.6:match.view.zoom===1.6?2.25:1;b.classList.toggle('active',match.view.zoom>1);b.textContent=match.view.zoom===1?'ZOOM +':match.view.zoom===1.6?'ZOOM ++':'VUE GLOBALE'}else if(b.dataset.matchAction==='pause'){match.paused=!match.paused;b.textContent=match.paused?'▶ REPRENDRE':'Ⅱ PAUSE';}else if(b.dataset.matchAction==='fast'){let n=0;while(!match.ended&&n++<18000)gameStep(match,0.5);syncMatch();if(match.ended)finalScreen()}else if(b.dataset.matchAction==='quit'){if(confirm('Quitter ce match sans enregistrer le résultat ?')){match=null;state.page='accueil';view.onclick=null;render()}}else if(b.dataset.matchAction==='sub')substitution(match)};
 const exitFull=$('#exitFullScreen');if(exitFull)exitFull.onclick=()=>document.exitFullscreen?.();
 if(match.userSide===-1){view.querySelectorAll('.game-tact select,.game-tact button').forEach(el=>el.disabled=true);$('.game-tact').insertAdjacentHTML('afterbegin','<p class="notice">Observation neutre : consignes réservées au club dirigé.</p>');}if($('#subOut')&&match.userSide!==-1){$('#subOut').addEventListener('change',()=>refreshSubOptions(match));refreshSubOptions(match)}
 $('#rm25-replay-slider').addEventListener('input',e=>{if(rm25Replay){rm25Replay.index=+e.target.value;rm25Replay.playing=false;}});
 lastFrame=performance.now();drawMatch(match);animation=requestAnimationFrame(frame);}
function refreshSubOptions(g){
 const out=$('#subOut'),into=$('#subIn');if(!out||!into)return;
 const old=g.players[g.userSide][Number(out.value)];if(!old)return;
 const compatible=g.bench[g.userSide].filter(p=>p.position===old.position||(['LO','BR'].includes(p.position)&&['LO','BR'].includes(old.position)));
 into.innerHTML=compatible.map(p=>`<option value="${esc(p.id)}">${p.number} · ${esc(p.name)} (${p.position})</option>`).join('');
 const button=$('[data-match-action="sub"]');if(button)button.disabled=compatible.length===0;
}
function substitution(g){
 if(g.ended)return;
 const team=g.userSide,bench=g.bench[team];
 const outgoing=Number($('#subOut')?.value),incomingId=$('#subIn')?.value;
 const idx=bench.findIndex(p=>p.id===incomingId),old=g.players[team][outgoing];
 if(!old||idx<0)return toast('Choisir deux joueurs valides');
 const next=bench[idx];
 if(old.position!==next.position && !(['LO','BR'].includes(old.position)&&['LO','BR'].includes(next.position))){toast('Postes incompatibles : '+LABEL[old.position]+' / '+LABEL[next.position]);return;}
 bench.splice(idx,1);
 g.players[team][outgoing]={...next,number:old.number,side:team,idx:outgoing,x:old.x,y:old.y,f:100,speed:clamp(4.2+(attr(next,'speed')-65)*.035,3.2,5.8),angle:old.angle};
 g.substitutions++;g.interventions.push({kind:'sub',team,out:old.id,in:next.id,time:g.clock});
 logAction(g,`Remplacement : ${next.name} à la place de ${old.name}`,'substitution');
 const out=$('#subOut'),into=$('#subIn');if(out){out.innerHTML=g.players[team].map(p=>`<option value="${p.idx}">${p.number} · ${esc(p.name)} (${p.position})</option>`).join('');}
 if(into)refreshSubOptions(g);
 syncMatch();toast('Remplacement effectué');
}
function frame(time){if(!match)return;if(rm25Replay){lastFrame=time;rm25DrawReplay();animation=requestAnimationFrame(frame);return;}const elapsed=Math.min(0.08,(time-lastFrame)/1000);lastFrame=time;if(!match.paused&&!match.ended){const gameElapsed=elapsed*(uiSettings.tempo/2.75)*match.speed;let dt=gameElapsed;while(dt>0){const step=Math.min(0.35,dt);gameStep(match,step);dt-=step;if(match.ended)break}}drawMatch(match);if(Math.floor(time/135)!==Math.floor((time-elapsed*1000)/135))syncMatch();if(match.ended){finalScreen();return}animation=requestAnimationFrame(frame)}
function parseColor(c){
 let x=(c||'#276b74').replace('#','');if(x.length===3)x=x.split('').map(v=>v+v).join('');
 return [0,2,4].map(i=>parseInt(x.slice(i,i+2),16)||0);
}
function rgb(c,a=1){const v=parseColor(c);return `rgba(${v[0]},${v[1]},${v[2]},${a})`;}
function alternativeKit(g,side){
 const colors=[g.home.color,g.away.color].map(parseColor);
 const diff=Math.hypot(...colors[0].map((x,i)=>x-colors[1][i]));
 // Repli extérieur crème si les deux couleurs paraissent proches sur une pelouse sombre.
 // Contraste de lecture, et non prétention à reproduire une tenue officielle.
 const luminance=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
 if(side===1&&(diff<135||(luminance(colors[0])<100&&luminance(colors[1])<135)))return '#f4ead8';
 return side===0?g.home.color:g.away.color;
}
function roundedRectPath(c,x,y,w,h,r){
 r=Math.max(0,Math.min(r,w/2,h/2));c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();
}
function strokeLimb(c,skin,pts,width){c.strokeStyle='#071921c0';c.lineCap='round';c.lineJoin='round';c.lineWidth=width+2;c.beginPath();c.moveTo(pts[0],pts[1]);for(let i=2;i<pts.length;i+=2)c.lineTo(pts[i],pts[i+1]);c.stroke();c.strokeStyle=skin;c.lineWidth=width;c.stroke();}
// Silhouette 2D en plongée avec animation articulée, ombres, tenue et morphologie par poste.
// Animation esthétique (pas de prétention biomécanique) : jambes, coudes, mains et centre de masse.
// V0.17 : géométrie humaine articulée 2D.
// Jambe d'appui, projection de genou, mouvement opposé des bras, rotations
// de la cage thoracique, geste de plaquage et passage au sol. Animation
// cinématique légère en Canvas ; ni simulation biomécanique ni capture de mouvement.
function drawPlayerLegacy(c,p,x,y,kit,active,labels,scale=1,g=null){
 const role=playerRole(p),t=g?.clock||0;
 const size={frontrow:1.30,lock:1.17,backrow:1.13,nine:.89,ten:.96,centre:1.05,wing:.96,fullback:.98}[role]||1;
 const raw=p.action||'run';
 const impact=g?.contact;
 const carryingImpact=impact&&impact.carrierId===p.id;
 const tacklingImpact=impact&&impact.tacklerIds?.includes(p.id);
 const impactP=(carryingImpact||tacklingImpact)?clamp(impact.progress||0,0,1):0;
 const lastTackle=g?.lastTackle?.defenderId===p.id&&t-g.lastTackle.at<1.2;
 const recentPass=g?.lastPass?.id===p.id&&g?.lastPass?.side===p.side&&t-g.lastPass.at<.6;
 const recentKick=g?.lastKick?.id===p.id&&g?.lastKick?.side===p.side&&t-g.lastKick.at<.8;
 const sp=g?.setPiece;
 let phase=carryingImpact?'carried-contact':tacklingImpact?'tackler':lastTackle?'tackler':recentPass?'pass':recentKick?'kick':raw;
 const isRuck=g?.mode==='ruck'&&g?.ruckActors&&(g.ruckActors.attack.includes(p.id)||g.ruckActors.defense.includes(p.id));
 if(isRuck)phase='ruck';
 const engaged=['ruck','maul','scrum','lineout','lift','jump','tackler','carried-contact','ground','tackle'].includes(phase);
 const stride=p.stepCycle||0,velocity=clamp((p.effort||0)/6.3,0,1);
 const cycle=Math.sin(stride),other=-cycle;
 const planted=velocity<.15;
 const simulatedPose=(carryingImpact||tacklingImpact)?p.contactPose:null;
 const impactSink=simulatedPose?simulatedPose.down:(carryingImpact?clamp((impactP-.24)/.58,0,1):tacklingImpact?clamp((impactP-.42)/.48,0,1):0);
 const jointCompression=phase==='scrum'?.40:phase==='maul'?.28:phase==='ruck'?.42:impactSink*.65+(simulatedPose?.brace||0)*.13;
 const breathing=Math.sin(t*2.1+p.idx)*.45;
 const jump=phase==='jump'&&sp?Math.sin(Math.PI*clamp((sp.progress-.17)/.72,0,1))*31:0;
 const trunkTurn=clamp((p.angularRate||0)*.095,-.27,.27);
 const groundAngle=simulatedPose?(simulatedPose.tilt||0):(carryingImpact?impactSink*.97:tacklingImpact?impactSink*.53:phase==='ground'?.62:0);
 const posture=phase==='scrum'?-.31:phase==='ruck'?-.24:phase==='maul'?-.20:phase==='lift'?.08:0;
 const skin=['#d99c79','#f1c5a1','#af785b','#c78a62','#ae7151'][p.idx%5];
 const hair=['#162129','#3c3027','#17181a','#594338'][p.idx%4];
 const shadowY=6+jump,wide=size*scale;
 c.save();c.translate(x,y-jump);
 // Ombre projetée, glissant moins pour les joueurs au sol.
 c.fillStyle='rgba(0,15,17,.34)';c.beginPath();c.ellipse(1,shadowY,20*wide,7.6*wide,.06,0,Math.PI*2);c.fill();
 if(active){c.save();c.strokeStyle='rgba(255,218,122,.94)';c.lineWidth=2.6;c.shadowColor='#f7c45c';c.shadowBlur=7;c.beginPath();c.ellipse(0,0,21*wide,14*wide,0,0,Math.PI*2);c.stroke();c.restore();}
 c.rotate((p.angle||0)+posture+groundAngle);
 c.transform(1,trunkTurn*.67,0,1,0,0);
 c.scale(scale*size*(1-impactSink*.12),scale*size*(1+jointCompression*.10));
 const lean=clamp((p.lean||0),-.24,.24);
 const torsoLift=-(jointCompression*5);
 const hipX=-8-impactSink*7,neckX=8-impactSink*4;
 // Segments à articulation (épaule-coude-main / hanche-genou-cheville).
 function limb(ax,ay,bx,by,cx,cy,radius,col,highlight){
  c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='rgba(4,17,21,.83)';c.lineWidth=radius+2.0;
  c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(cx,cy);c.stroke();
  c.strokeStyle=col;c.lineWidth=radius;
  c.beginPath();c.moveTo(ax,ay);c.lineTo(bx,by);c.lineTo(cx,cy);c.stroke();
  c.fillStyle=highlight||col;c.beginPath();c.arc(bx,by,radius*.43,0,Math.PI*2);c.fill();
 }
 // Arrière de la silhouette : les jambes sont dessinées AVANT le torse.
 for(const side of [-1,1]){
  const swing=side===-1?cycle:other;
  const plantedFoot=swing<-.03;
  const up=plantedFoot?.2:clamp((swing+.15),0,1)*3*velocity;
  const pace=(role==='frontrow'?7.8:role==='wing'?12.3:10.4)*velocity;
  const turnLean=lean*2;
  let ankleX=hipX-16-swing*pace-(jointCompression*5);
  let ankleY=side*5.1+swing*2.1+turnLean;
  if(phase==='kick'&&side===1)ankleX=17;
  if(phase==='scrum'||phase==='maul'||phase==='ruck'){ankleX=hipX-13;ankleY=side*7.4;}
  if(impactSink){ankleX-=7*impactSink;ankleY+=side*2.8*impactSink;}
  let kneeX=(hipX+ankleX)/2+2.8+Math.max(0,swing)*3.1*velocity;
  let kneeY=(side*4.8+ankleY)/2+side*1.9;
  limb(hipX,side*4.2,kneeX,kneeY,ankleX,ankleY,5.1,skin,'#e4ad89');
  c.strokeStyle=kit;c.lineWidth=4;c.beginPath();c.moveTo(kneeX+(ankleX-kneeX)*.15,kneeY);c.lineTo(ankleX,ankleY);c.stroke();
  c.save();c.translate(ankleX,ankleY-up);c.rotate(.04+swing*.07);
  c.fillStyle='#08151b';c.beginPath();c.ellipse(-3.8,0,6.6,3.25,0,0,Math.PI*2);c.fill();
  c.fillStyle='#d9e7e9';c.fillRect(-8,1.7,7,1);c.restore();
 }
 // Bassin et short, dont la largeur diffère selon le poste.
 c.fillStyle=kit;c.strokeStyle='#082025';c.lineWidth=1.6;c.beginPath();c.roundRect(hipX-5,-8.4,13,16.8,3.9);c.fill();c.stroke();
 // Torse articulé : clavicules et taille orientées différemment au contact.
 const shoulderX=neckX-1.4,torsoW=role==='frontrow'?12.1:role==='lock'?9.2:10.1;
 const shoulderDy=lean*6;
 const jersey=c.createLinearGradient(-12,-torsoW,12,torsoW);
 jersey.addColorStop(0,'#ffffff70');jersey.addColorStop(.18,kit);jersey.addColorStop(.70,kit);jersey.addColorStop(1,'#152f3877');
 c.fillStyle=jersey;c.strokeStyle='#09232c';c.lineWidth=1.45;
 c.beginPath();c.moveTo(hipX-1,-7);c.quadraticCurveTo(0,-torsoW,shoulderX,-torsoW+shoulderDy);
 c.quadraticCurveTo(shoulderX+5,0,shoulderX,torsoW+shoulderDy);
 c.quadraticCurveTo(0,torsoW,hipX-1,7);c.closePath();c.fill();c.stroke();
 c.strokeStyle='rgba(250,255,251,.57)';c.lineWidth=1.4;c.beginPath();c.moveTo(shoulderX-2,-torsoW+3);c.lineTo(shoulderX-1,torsoW-3);c.stroke();
 // Les bras suivent la foulée ou l'action. Les plaqueurs referment les mains
 // autour du porteur ; le porteur protège puis libère le ballon.
 for(const side of [-1,1]){
  const swing=side===-1?other:cycle;
  const sy=side*torsoW*.87+shoulderDy;
  let ex=5+swing*velocity*3.3,ey=sy+side*5.6;
  let hx=ex+5,hy=ey+side*1.2;
  if(phase==='tackler'||phase==='tackle'){
   ex=11+impactP*5+(simulatedPose?.brace||0)*2;ey=side*(8.5-3.2*impactP);hx=18+impactP*4.8+(simulatedPose?.brace||0)*2;hy=side*(6.9-4.2*impactP);
  }else if(phase==='carried-contact'||phase==='ground'){
   ex=5-impactSink*7;ey=side*10;hx=8-impactSink*9;hy=side*(6+impactSink*5);
  }else if(phase==='pass'||phase==='offload'){
   ex=11;ey=side*7.9;hx=18;hy=side*4.5;
  }else if(phase==='kick'){
   ex=side<0?13:0;ey=side*9.4;hx=side<0?19:3;hy=side*10;
  }else if(phase==='ruck'||phase==='scrum'||phase==='maul'){
   ex=12;ey=side*10;hx=15+Math.sin(t*3.5+p.idx)*1.4;hy=side*5.1;
  }else if(phase==='lift'||phase==='jump'){
   ex=11;ey=side*9.5;hx=22;hy=side*2.7;
  }else if(phase==='throw'){
   ex=10;ey=side*6;hx=21;hy=side*2;
  }else if(phase==='inside-support'||phase==='wide-support'){
   ex=7+swing*velocity*3.1;ey=sy+side*5;hx=ex+5;hy=ey+side*2;
  }
  limb(shoulderX-1,sy,ex,ey,hx,hy,4.55,skin,'#eec29a');
  c.fillStyle=skin;c.beginPath();c.arc(hx,hy,2.8,0,Math.PI*2);c.fill();
 }
 // Cou, visage et ligne de cheveux. La tête reste orientée avec le déplacement.
 c.fillStyle=skin;c.beginPath();c.roundRect(neckX-2.3,-3.7,6.1,7.4,2);c.fill();
 c.fillStyle=skin;c.strokeStyle='#253037';c.lineWidth=1;
 c.beginPath();c.ellipse(neckX+6.1,0,6.6,5.4,0,0,6.283);c.fill();c.stroke();
 c.fillStyle=hair;c.beginPath();c.ellipse(neckX+8.2,-1.8,3.5,4.2,0,0,6.283);c.fill();
 c.strokeStyle='rgba(16,31,36,.50)';c.lineWidth=.65;
 c.beginPath();c.moveTo(neckX+9.2,-1.3);c.lineTo(neckX+9.4,1.2);c.stroke();
 // Dos et numéro assez contrastés pour les vues tactiques éloignées.
 c.fillStyle='#061923bf';c.beginPath();c.roundRect(-5.4,-5.4,10.5,10.8,2.7);c.fill();
 c.fillStyle='#ffffff';c.textAlign='center';c.textBaseline='middle';c.font='900 8.3px system-ui';c.fillText(p.number,-.35,.55);
 c.restore();
 if(g?.view?.roles){c.save();c.fillStyle='#e5f0db';c.font='bold 9px system-ui';c.textAlign='center';c.fillText(({frontrow:'1re L',lock:'2e L',backrow:'3e L',nine:'9',ten:'10',centre:'CENTRE',wing:'AILIER',fullback:'ARRIÈRE'})[role],x,y+30*scale);c.restore();}
 if(labels){c.save();c.font='700 10px system-ui';const n=p.name.split(' ').slice(-1)[0],name=n.length>14?n.slice(0,12)+'…':n;
  const tw=Math.min(115,c.measureText(name).width+13),xx=x-tw/2,yy=y-38*scale-jump;
  c.fillStyle='#061823e8';c.beginPath();c.roundRect(xx,yy,tw,17,4);c.fill();c.strokeStyle=rgb(kit,.95);c.lineWidth=1;c.stroke();c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(name,x,yy+9);c.restore();}
}

// V0.21 — sprites 2D dessinés en Canvas, sans atlases volumétriques.

/* V0.24 — rugby 2D clair et optimisé. Continuité collective et réception réaliste. */
function drawPlayerSprite(c,p,x,y,kit,active,labels,scale=1,g=null){
 // 2D broadcast-style rugby player: upright, readable, realistic proportions.
 const role=playerRole(p),bulk=role==='frontrow'?1.14:role==='lock'?1.08:role==='backrow'?1.05:role==='nine'?.87:role==='wing'?.91:1;
 const sz=clamp(scale,.88,1.55),now=g?.clock||0;
 const inContact=g?.contact&&(g.contact.carrierId===p.id||g.contact.tacklerIds?.includes(p.id));
 const isRuck=g?.mode==='ruck'&&g.ruckActors&&(g.ruckActors.attack.includes(p.id)||g.ruckActors.defense.includes(p.id));
 const isScrum=g?.mode==='scrum'&&p.idx<8,isMaul=g?.mode==='maul'&&p.idx<8;
 const kicking=g?.lastKick?.id===p.id&&now-g.lastKick.at<.8;
 const passing=g?.lastPass?.id===p.id&&now-g.lastPass.at<.5;
 const jump=(g?.mode==='lineout'&&p.action==='jump'&&g?.setPiece)?Math.sin(clamp((g.setPiece.progress-.12)/.82,0,1)*Math.PI)*10:0;
 const effort=clamp((p.effort||0)/7,0,1),step=Math.sin(p.stepCycle||0)*effort;
 const crouch=isScrum?.42:isRuck?.40:isMaul?.22:inContact?.35:0;
 const sideFacing=Math.cos(p.angle||0)>=0?1:-1;
 const skin=['#e3b18e','#be8969','#8d5b42','#d5a482','#ac7456'][(p.idx+p.side*3)%5];
 const dark=kit.replace('#','');const r=parseInt(dark.slice(0,2),16)||0,gg=parseInt(dark.slice(2,4),16)||0,bb=parseInt(dark.slice(4,6),16)||0;
 const light=r*.213+gg*.715+bb*.072>145;
 c.save();c.translate(x,y);c.scale(sz,sz);
 // Feet anchor to the calculated on-field player coordinates.
 c.fillStyle='rgba(8,28,17,.25)';c.beginPath();c.ellipse(0,1,9*bulk,3.4,0,0,6.283);c.fill();
 if(active){c.strokeStyle='#f6ce69';c.lineWidth=2;c.beginPath();c.ellipse(0,0,12.5,5.0,0,0,6.283);c.stroke();}
 c.translate(0,-jump);
 const hip=-9+crouch*5,shoulder=-22+crouch*9,head=shoulder-7;
 // Legs: two independent running strides, shorts, socks and boots.
 for(const side of [-1,1]){
  const k=step*side*3.7,fy=side*3.0*bulk;
  c.lineCap='round';c.strokeStyle=skin;c.lineWidth=3.5*bulk;
  c.beginPath();c.moveTo(side*3.0*bulk,hip+2);c.lineTo(side*3.9*bulk+k*.55,-4+k*.5);c.stroke();
  c.strokeStyle='#efefeb';c.lineWidth=3.2*bulk;
  c.beginPath();c.moveTo(side*3.9*bulk+k*.55,-4+k*.5);c.lineTo(side*4.1*bulk+k,0+k*.35);c.stroke();
  c.strokeStyle='#142322';c.lineWidth=3.3;c.beginPath();c.moveTo(side*4.1*bulk+k,0+k*.35);c.lineTo(side*4.1*bulk+k+sideFacing*2.5,1+k*.35);c.stroke();
 }
 c.fillStyle=light?'#1f3333':'#e9eae5';c.strokeStyle='rgba(6,23,22,.65)';c.lineWidth=.8;
 c.beginPath();c.roundRect(-5.3*bulk,hip-3,10.6*bulk,7.2,1.8);c.fill();c.stroke();
 // Rugby jersey, slightly tapered at the waist; no shoulder pads.
 c.fillStyle=kit;c.beginPath();c.moveTo(-4.7*bulk,hip-3);c.lineTo(4.7*bulk,hip-3);
 c.lineTo(6*bulk,shoulder+3);c.quadraticCurveTo(0,shoulder-2,-6*bulk,shoulder+3);c.closePath();c.fill();c.stroke();
 // Natural arms move opposite to the legs, stay short and unarmored.
 for(const side of [-1,1]){
  const shx=side*5.4*bulk,armMove=step*side*-2.2;
  let ex=shx+side*2.7,ey=shoulder+9+armMove;
  if(passing){ex=side*(8.2+2*bulk);ey=shoulder+1;}
  if(inContact||isScrum||isRuck){ex=side*7.7*bulk;ey=shoulder+4;}
  c.strokeStyle=kit;c.lineWidth=3.9*bulk;c.beginPath();c.moveTo(shx,shoulder+3);c.lineTo(ex,ey);c.stroke();
  c.strokeStyle=skin;c.lineWidth=2.6;c.beginPath();c.moveTo(ex,ey);c.lineTo(ex+side*1.2,ey+4);c.stroke();
 }
 // Collar, back number, bare head and short hair.
 c.fillStyle='rgba(255,255,255,.6)';c.fillRect(-2.8,shoulder+3,5.6,1.3);
 c.textAlign='center';c.textBaseline='middle';c.font='900 8px system-ui';c.fillStyle=light?'#192d2e':'#fcfdf7';
 c.fillText(String(p.number||p.idx+1),0,hip-7+crouch*1.5);
 c.fillStyle=skin;c.strokeStyle='#3a3029';c.lineWidth=.65;c.beginPath();c.ellipse(0,head,4.25*bulk,4.7,0,0,6.283);c.fill();c.stroke();
 c.fillStyle=['#3a2c24','#2b241d','#654832'][(p.idx+p.side)%3];c.beginPath();c.ellipse(0,head-2.25,4.15*bulk,2.05,0,0,6.283);c.fill();
 if(kicking){c.strokeStyle='#1b2525';c.lineWidth=2.7;c.beginPath();c.moveTo(0,hip);c.lineTo(sideFacing*9.5,-3);c.stroke();}
 c.restore();
 if(labels&&(active||g?.view?.zoom>=1.28)){
  const name=(p.name||'').trim().split(' ').slice(-1)[0].slice(0,14);
  c.save();c.font='700 11px system-ui';const width=Math.max(37,c.measureText(name).width+12);
  c.fillStyle='#0d2428eb';c.beginPath();c.roundRect(x-width/2,y-44*sz-jump,width,16,5);c.fill();
  c.fillStyle='#fff';c.textAlign='center';c.textBaseline='middle';c.fillText(name,x,y-36*sz-jump);c.restore();
 }
}
function drawMatch(g){
 if(!ctx||!canvas)return;
 const c=ctx,w=canvas.width,h=canvas.height,outer=28;
 const left=28,right=w-28,top=24,bottom=h-27;
 const W=right-left,H=bottom-top;
 // V0.24: real-time camera modes, independent from the deterministic sports engine.
 const mode=g.view?.cameraMode||'tv';
 const multiplier=clamp(Number(g.view?.zoom)||1,.7,1.6);
 const presets={
  tactical:[1,1],             // whole playing surface (100 x 70 units)
  wide:[1.34,1.10],           // collective shape and off-ball support
  tv:[2.05,1.44],             // default: significantly closer to play
  close:[2.95,2.08],          // tackles, passes, rucks and contact
  ball:[2.3,1.64]            // centered on ball with anticipation during kicks
 };
 const preset=presets[mode]||presets.tv;
 let targetZoomX=clamp(preset[0]*multiplier,.8,4.4);
 let targetZoomY=clamp(preset[1]*multiplier,.8,3.1);
 const inKick=['kick-flight','kickoff','conversion','penalty'].includes(g.mode);
 if(inKick&&mode!=='tactical'){
   // Widen when the ball is travelling: visible chase, reception and posts.
   targetZoomX=Math.min(targetZoomX,mode==='close'?2.25:1.73);
   targetZoomY=Math.min(targetZoomY,mode==='close'?1.64:1.23);
 }
 if(['scrum','lineout','maul'].includes(g.mode)&&mode==='tv'){
   targetZoomX=Math.min(2.38,targetZoomX*1.10);targetZoomY=Math.min(1.68,targetZoomY*1.08);
 }
 const followBallX=Number.isFinite(g.ball.x)?g.ball.x:50;
 const followBallY=Number.isFinite(g.ball.y)?g.ball.y:35;
 let focusX=followBallX,focusY=followBallY;
 if(mode==='wide'||mode==='tv'){
   // More room in the direction of attack, showing the defense and the next receiver.
   focusX+=attackDir(g.possession)*(mode==='wide'?5:4);
   const ballSide=g.players?.[g.possession]||[];
   const around=ballSide.filter(p=>Math.abs(p.x-followBallX)<19&&Math.abs(p.y-followBallY)<23);
   if(around.length){const avgY=around.reduce((sum,p)=>sum+p.y,0)/around.length;focusY=focusY*.81+avgY*.19;}
 }
 if(mode==='close'){
   const carrier=g.players?.[g.possession]?.[g.carrier];
   if(!g.movingBall&&g.mode==='play'&&carrier){focusX=followBallX*.70+carrier.x*.30;focusY=followBallY*.70+carrier.y*.30;}
 }
 if(inKick&&(g.kickFlight||g.restartFlight||g.penaltyFlight||g.conversionFlight)){
   const flight=g.kickFlight||g.restartFlight||g.penaltyFlight||g.conversionFlight;
   if(flight?.to){const ratio=clamp(flight.elapsed/Math.max(.1,flight.duration),0,1);const lookAhead=.24+.42*ratio;
     focusX=followBallX*(1-lookAhead)+flight.to.x*lookAhead;
     focusY=followBallY*(1-lookAhead)+flight.to.y*lookAhead;}
 }
 if(mode==='tactical'){focusX=50;focusY=35;}
 const halfX=50/targetZoomX,halfY=35/targetZoomY;
 const targetX=halfX>=50?50:clamp(focusX,halfX,100-halfX);
 const targetY=halfY>=35?35:clamp(focusY,halfY,70-halfY);
 if(!g.cameraEase){
   g.cameraEase={x:targetX,y:targetY,zoomX:targetZoomX,zoomY:targetZoomY,mode};
 }
 g.cameraEase.mode=mode;
 const cameraLerp=(mode==='tactical' ? .19 : mode==='ball' ? .16 : .105);
 g.cameraEase.x+=(targetX-g.cameraEase.x)*cameraLerp;
 g.cameraEase.y+=(targetY-g.cameraEase.y)*cameraLerp;
 g.cameraEase.zoomX+=(targetZoomX-g.cameraEase.zoomX)*.105;
 g.cameraEase.zoomY+=(targetZoomY-g.cameraEase.zoomY)*.105;
 const zoomX=g.cameraEase.zoomX,zoomY=g.cameraEase.zoomY;
 const fc=g.cameraEase.x,fy=g.cameraEase.y;
 const X=m=>left+((m-fc)*zoomX+50)/100*W;
 const Y=m=>top+((m-fy)*zoomY+35)/70*H;
 const focus=zoomX/2.05;
 c.clearRect(0,0,w,h);
 // Flat broadcast pitch: restrained natural colors and regulation markings.
 c.fillStyle='#10231c';c.fillRect(0,0,w,h);
 c.fillStyle='#18372b';c.fillRect(0,0,w,top);c.fillRect(0,bottom,w,h-bottom);
 c.fillStyle='#457a42';c.fillRect(left,top,W,H);
 for(let i=0;i<10;i++){c.fillStyle=i%2?'rgba(234,246,196,.023)':'rgba(15,63,22,.035)';c.fillRect(left+i*W/10,top,W/10,H);}
 // The field is deliberately uncluttered: no animated advertisements or textures.
 c.strokeStyle='#f3f5eddd';c.lineWidth=2.0;c.beginPath();c.moveTo(left,top);c.lineTo(right,top);c.moveTo(left,bottom);c.lineTo(right,bottom);c.stroke();
 function verticalLine(m,alpha=1,dashed=[]){c.save();c.globalAlpha=alpha;c.setLineDash(dashed);c.beginPath();c.moveTo(X(m),top);c.lineTo(X(m),bottom);c.stroke();c.restore();}
 for(const m of [0,22,50,78,100])if(X(m)>=left&&X(m)<=right)verticalLine(m,m===50?1:.90);
 for(const m of [10,90])if(X(m)>=left&&X(m)<=right)verticalLine(m,.6,[7,10]);
 c.lineWidth=1.4;for(const m of [5,15,35,65,85,95])if(X(m)>=left&&X(m)<=right)verticalLine(m,.27,[4,17]);
 c.strokeStyle='#f9fcf4';c.lineWidth=1.5;
 for(const xx of [10,50,90])for(const yy of [5,35,65]){
   c.beginPath();c.moveTo(X(xx)-4,Y(yy));c.lineTo(X(xx)+4,Y(yy));c.stroke();
 }
 c.textAlign='center';c.textBaseline='middle';c.font='bold 21px system-ui';c.fillStyle='rgba(255,255,255,.24)';
 for(const m of [22,78]){c.save();c.translate(X(m),Y(63));c.rotate(-Math.PI/2);c.fillText('22',0,0);c.restore();}
 for(const m of [0,100]){
   c.strokeStyle='#f8f9f0';c.lineWidth=3;c.beginPath();c.moveTo(X(m),Y(30));c.lineTo(X(m),Y(40));c.stroke();
 }
 // Couche de dessin écrêtée : le zoom ne déborde pas sur les tribunes.
 c.save();c.beginPath();c.rect(left-42,top-2,W+84,H+4);c.clip();
 // Vue tactique : montrer les couloirs de la défense et les pods sans altérer le calcul.
 if(g.view?.pods && ['play','ruck','tackle'].includes(g.mode)){
  const team=g.possession,plan=attackPlan(g,team),direction=attackDir(team);
  const colors=['#c7e4f1','#f8c76e','#d6b7fa','#91dfbd'];
  for(const [i,group] of plan.groups.entries()){
   const pts=group.map(n=>g.players[team][n]).filter(Boolean);
   if(!pts.length)continue;
   const mx=pts.reduce((sum,p)=>sum+p.x,0)/pts.length;
   const my=pts.reduce((sum,p)=>sum+p.y,0)/pts.length;
   c.save();c.globalAlpha=i===plan.active?.92:.4;c.strokeStyle=colors[i%4];c.lineWidth=i===plan.active?2.5:1.35;
   c.setLineDash(i===plan.active?[]:[5,7]);c.beginPath();
   c.ellipse(X(mx),Y(my),Math.max(18,pts.length*12),Math.max(19,pts.length*10),0,0,Math.PI*2);c.stroke();c.setLineDash([]);
   c.fillStyle=colors[i%4];c.font='900 11px system-ui';c.textAlign='center';c.fillText(`POD ${i+1}`,X(mx),Y(my)-27);
   if(i===plan.active){c.beginPath();c.moveTo(X(mx)+direction*28,Y(my));c.lineTo(X(mx)+direction*56,Y(my));c.stroke();}
   c.restore();
  }
  // Defensive line is a curve through the players, not an invented static stripe.
  const defenders=g.players[1-team].filter(p=>p.idx!==14).slice().sort((a,b)=>a.y-b.y);
  c.save();c.strokeStyle='#ffa95bb8';c.lineWidth=2;c.setLineDash([7,6]);c.beginPath();
  for(const [i,p] of defenders.entries()){if(i===0)c.moveTo(X(p.x),Y(p.y));else c.lineTo(X(p.x),Y(p.y));}
  c.stroke();c.setLineDash([]);c.restore();
 }
 if(g.view?.lines){
  const t=g.possession,dir=attackDir(t);
  c.setLineDash([9,9]);c.strokeStyle='#ffa951c9';c.lineWidth=2;
  const defAvg=g.players[1-t].filter(p=>p.idx!==14).reduce((sum,p)=>sum+p.x,0)/14;
  c.beginPath();c.moveTo(X(defAvg),top);c.lineTo(X(defAvg),bottom);c.stroke();
  c.strokeStyle='#b3eeffc2';const offAvg=g.players[t].filter(p=>p.idx!==14).reduce((sum,p)=>sum+p.x,0)/14;
  c.beginPath();c.moveTo(X(offAvg),top);c.lineTo(X(offAvg),bottom);c.stroke();c.setLineDash([]);
  // Dessiner les trajectoires réellement demandées aux soutiens, sans faux fléchages.
  if(g.mode==='play' && g.supportAssignments){
   c.save();c.setLineDash([5,6]);c.strokeStyle='rgba(211,255,223,.62)';c.lineWidth=2;
   for(const p of g.players[t]){
    const goal=g.supportAssignments[p.id];if(!goal)continue;
    c.beginPath();c.moveTo(X(p.x),Y(p.y));
    c.quadraticCurveTo(X((p.x+goal.x)/2),Y((p.y+goal.y)/2-1.6),X(goal.x),Y(goal.y));c.stroke();
   }
   c.restore();
  }
 }
 // Visualisation des combinaisons fondée sur les courses et leurs cibles réelles.
 if(g.view?.lines&&g.attackSequence&&g.attackSequence.team===g.possession){
  const seq=g.attackSequence,attack=g.players[g.possession],dir=attackDir(g.possession);
  c.save();c.lineWidth=2.8;c.lineCap='round';
  const order=[g.carrier,...seq.receivers.slice(seq.next)];
  for(let i=0;i<order.length-1;i++){
   const from=attack[order[i]],to=attack[order[i+1]];
   if(!from||!to)continue;
   c.strokeStyle=i===0?'#e7f9a9c9':'#ddf7ff78';c.setLineDash([7,6]);c.beginPath();c.moveTo(X(from.x),Y(from.y));c.lineTo(X(to.x),Y(to.y));c.stroke();
  }
  for(const idx of seq.decoys){
   const dummy=attack[idx];if(!dummy)continue;
   c.strokeStyle='#ffda8799';c.setLineDash([4,5]);c.beginPath();c.moveTo(X(dummy.x),Y(dummy.y));c.lineTo(X(clamp(dummy.x+dir*11,1,99)),Y(dummy.y));c.stroke();
   c.font='900 10px system-ui';c.fillStyle='#fff0bb';c.textAlign='left';c.fillText('LEURRE',X(dummy.x)+5,Y(dummy.y)-13);
  }
  c.restore();
 }
 if(g.kickFx&&g.clock-g.kickFx.at<35){
  const k=g.kickFx,v=clamp((g.clock-k.at)/35,0,1);
  c.save();c.setLineDash([8,7]);c.lineWidth=2.8;c.strokeStyle=`rgba(255,224,136,${(.75*(1-v)).toFixed(2)})`;
  c.beginPath();c.moveTo(X(k.from.x),Y(k.from.y));c.quadraticCurveTo((X(k.from.x)+X(k.to.x))/2,Y(Math.min(k.from.y,k.to.y)-15),X(k.to.x),Y(k.to.y));c.stroke();c.restore();
 }

 // Contact, ruck and set-piece players are shown with distinct body poses.
 // No halos, motion streaks, lines or floating rings covering the pitch.
 // Ordonnancement : joueur porteur dessiné en dernier.
 const all=[...g.players[0],...g.players[1]];
 all.sort((a,b)=>(a.side===g.possession&&a.idx===g.carrier?1:0)-(b.side===g.possession&&b.idx===g.carrier?1:0));
 for(const p of all){
  const active=p.side===g.possession&&p.idx===g.carrier&&!g.movingBall;
  drawPlayerSprite(c,p,X(p.x),Y(p.y),alternativeKit(g,p.side),active,Boolean(g.view?.labels),Math.min(1.9,Math.max(.88,.76+zoomX*.32)),g);
 }
 // Ombres d'impact et gestes déterminés par les vrais protagonistes du contact.
 // Pas de traits reliant artificiellement le ballon à tous les joueurs.
 if(false&&g.view?.contacts!==false&&g.contact){
  const k=g.contact,age=clamp(k.progress||0,0,1),px=X(k.x),py=Y(k.y);
  c.save();c.globalAlpha=(1-Math.abs(age-.45)*1.75)*.48;
  for(let i=0;i<5;i++){
   const theta=i*Math.PI*.4+k.carrierIndex*.3,d=8+age*29;
   c.strokeStyle=i%2?'#d8e7ce':'#cbdcba';c.lineWidth=1.2;
   c.beginPath();c.moveTo(px+Math.cos(theta)*d*.6,py+Math.sin(theta)*d*.55);
   c.lineTo(px+Math.cos(theta)*d,py+Math.sin(theta)*d*.8);c.stroke();
  }c.restore();
 }
 const carrierPlayer=carrierOf(g),ballShift=!g.movingBall&&g.mode==='play'?{x:Math.cos(carrierPlayer.angle||0)*9-Math.sin(carrierPlayer.angle||0)*6,y:Math.sin(carrierPlayer.angle||0)*9+Math.cos(carrierPlayer.angle||0)*6}:{x:0,y:0};
 let ballX=X(g.ball.x)+ballShift.x,ballY=Y(g.ball.y)+ballShift.y;
 if(g.mode==='conversion'&&g.conversionFlight){
  const f=g.conversionFlight,p=clamp((f.elapsed/f.duration-.18)/.78,0,1);ballX=X(f.from.x+(f.to.x-f.from.x)*p);ballY=Y(f.from.y+(f.to.y-f.from.y)*p)-Math.sin(Math.PI*p)*75;
 }else if(g.mode==='penalty'&&g.penaltyFlight){
  const f=g.penaltyFlight,p=clamp(f.elapsed/f.duration,0,1),departure=clamp((p-.20)/.75,0,1);
  ballX=X(f.from.x+(f.to.x-f.from.x)*departure);ballY=Y(f.from.y+(f.to.y-f.from.y)*departure)-Math.sin(Math.PI*departure)*110;
  c.save();c.strokeStyle='#f4f6eac2';c.lineWidth=2;c.setLineDash([6,6]);c.beginPath();c.moveTo(X(f.from.x),Y(f.from.y));c.lineTo(X(f.to.x),Y(f.to.y));c.stroke();c.restore();
 }else if(g.mode==='kick-flight'&&g.kickFlight){
  const f=g.kickFlight,p=clamp(f.elapsed/f.duration,0,1);ballX=X(g.ball.x);ballY=Y(g.ball.y)-(g.ball.altitude||0);
  c.save();c.strokeStyle='#c5eee3aa';c.lineWidth=2;c.setLineDash([4,7]);c.beginPath();c.moveTo(X(f.from.x),Y(f.from.y));c.lineTo(X(f.to.x),Y(f.to.y));c.stroke();c.restore();
 }else if(g.mode==='kickoff'&&g.restartFlight){
  const f=g.restartFlight,p=clamp(f.elapsed/f.duration,0,1);ballX=X(f.from.x+(f.to.x-f.from.x)*p);ballY=Y(f.from.y+(f.to.y-f.from.y)*p)-Math.sin(Math.PI*p)*115;
 }else if(g.mode==='lineout'&&g.setPiece){
  const sp=g.setPiece,throwPct=clamp((sp.progress-.20)/.65,0,1),inward=sp.y<35?1:-1;
  const targetY=clamp(sp.y+inward*([7,0,10.5,14,17.5,15.5,21.5,25][sp.throwTarget]||14),2,68);
  ballX=X(sp.x);ballY=Y(sp.y+(targetY-sp.y)*throwPct)-Math.sin(throwPct*Math.PI)*43;
 }else if(g.movingBall){const b=g.movingBall,pct=clamp(b.elapsed/b.duration,0,1);ballY-=Math.sin(Math.PI*pct)*(b.kind==='offload'?12:18);}
 
 c.save();c.shadowBlur=2;c.shadowColor='#223b2a';c.fillStyle='#f3dfad';c.strokeStyle='#3e3324';c.lineWidth=1.2;
 c.translate(ballX,ballY);c.rotate(g.movingBall?-.45:.3);c.beginPath();c.ellipse(0,0,5,3.1,0,0,Math.PI*2);c.fill();c.stroke();c.restore();
 if(g.scoreFlash&&g.clock-g.scoreFlash.at<44){
  const ttl=1-clamp((g.clock-g.scoreFlash.at)/44,0,1);
  c.save();c.globalAlpha=ttl;c.fillStyle='#f8cf6c';c.beginPath();c.arc(X(g.scoreFlash.x),Y(g.scoreFlash.y),30+(1-ttl)*42,0,Math.PI*2);c.strokeStyle='#ffd36e';c.lineWidth=5;c.stroke();
  c.font='900 44px system-ui';c.textAlign='center';c.shadowColor='#091522';c.shadowBlur=16;c.fillStyle='#fff6da';c.fillText(g.scoreFlash.type==='try'?'ESSAI !':'+3 POINTS',X(g.scoreFlash.x),Y(g.scoreFlash.y)-45);c.restore();
 }
 c.restore();
 // Action Cam retirée : elle masquait la surface de jeu, vue unique prioritaire.

}
function syncMatch(){if(!match)return;$('#score0').textContent=match.score[0];$('#score1').textContent=match.score[1];$('#clock').textContent=fmtClock(match.clock);$('#phasePill').textContent=match.mode==='conversion'?'TRANSFORMATION':match.mode==='kick-flight'?(match.kickFlight?.penaltyTouch?'PÉNALTOUCHE':match.kickFlight?.award50?'50:22':'DÉGAGEMENT'):match.mode==='penalty'?(match.penaltyFlight?.kind==='drop'?'DROP':'TIR AU BUT'):match.mode==='kickoff'?'RENVOI':match.mode==='lineout'?'TOUCHE':match.mode==='scrum'?'MÊLÉE · '+(match.setPiece?.scrumDynamics?.stage||'FORMATION').toUpperCase():match.mode==='maul'?'MAUL':match.mode==='ruck'?'RUCK':match.mode==='tackle'?'PLAQUAGE':'JEU';$('#phase').textContent=({'tackle':'PLAQUAGE','ruck':'RUCK','lineout':'TOUCHE','scrum':'MÊLÉE','maul':'MAUL','kickoff':'RENVOI','kick-reception':'RÉCEPTION','penalty':'PÉNALITÉ'})[match.mode]||'JEU COURANT';$('#eventLabel').textContent=match.lastAction;const tc=$('#tickClock');if(tc)tc.textContent=fmtClock(match.clock);const sc=$('#phaseSequence');if(sc)sc.textContent='Phase '+Math.max(1,match.phase+1)+(match.phasePlan?' · collectif':'');$('#tacklestat').textContent=match.events.tackles+' / '+match.events.doubleTackles;$('#offloadstat').textContent=match.events.offloads;$('#contactstat').textContent=match.events.contacts+' / '+match.events.turnoversWonAtRuck;const spacing=formationSpacing(match);$('#shapestat').textContent=gameTactics(match,match.possession).shape+' · '+(spacing.activePod+1)+'/'+podGroups(gameTactics(match,match.possession).shape).length;$('#defspreadstat').textContent=Math.round(spacing.defense)+' m';
 const p=match.stats.poss;$('#posstat').textContent=Math.round(100*p[0]/(p[0]+p[1]||1))+'% / '+Math.round(100*p[1]/(p[0]+p[1]||1))+'%';$('#trystat').textContent=match.tries.join(' / ');$('#ruckstat').textContent=match.events.rucks;$('#exitstat').textContent=match.events.ruckExits+' / '+match.events.setReleases;$('#iqstat').textContent=match.events.interceptions+' / '+match.events.tacticalOverloads;$('#patternstat').textContent=match.events.patternCalls+' / '+match.events.patternCompletions+' · '+(match.events.iq22LinkedPasses||0)+' transmissions liées';$('#decoyoverlapstat').textContent=match.events.decoyRuns+' / '+match.events.overlaps;$('#lastpatternstat').textContent=match.lastPattern;$('#passstat').textContent=match.events.passes;$('#backpassstat').textContent=(match.events.maxBackwardPass||0).toFixed(1)+' m';$('#dropstat').textContent=(match.events.dropGoals||0)+' / '+(match.events.dropAttempts||0);$('#kickstat').textContent=match.events.kicks;const kc=match.events.rm26KickTypes||{};const kst=$('#rm26-kick-stats');if(kst)kst.textContent=[kc.territoire||0,kc.chandelle||0,kc.rasant||0,kc['50:22']||0].join(' / ');const sst=$('#rm26-set-stats');if(sst)sst.textContent=[match.events.rm26DominantScrums||0,match.events.rm26EightPicks||0,match.events.rm26LineSteals||0].join(' / ');const rst=$('#rm26-recover-stats');if(rst)rst.textContent=(match.events.rm26RecoveredKicks||0)+' / '+(match.events.rm26BacklineLaunches||0);$('#penstat').textContent=match.events.penalties;$('#scrumstat').textContent=match.events.scrums;$('#linestat').textContent=match.events.lineouts;$('#setpieceStat').textContent=match.events.scrumWins+' / '+match.events.lineoutWins;$('#turnstat').textContent=match.events.turnovers;$('#breakstat').textContent=match.events.linebreaks;$('#advstat').textContent=match.events.advantagePlayed+' / '+match.events.advantageCalledBack;$('#fiftytwostat').textContent=match.events.fiftyTwos;$('#riskpassstat').textContent=match.events.passRejections;$('#meterstat').textContent=match.stats.meters.map(x=>Math.round(x)).join(' / ');$('#rm25cardsstat').textContent=(match.events.cardsYellow||0)+' / '+(match.events.cardsRed||0);
 $('#rm25foulsstat').textContent=match.referee?.decisions.length||0;
 const perf=$('#rm25-performance-report');if(perf&&(!match._rm25StatsAt||match.clock-match._rm25StatsAt>5)){perf.innerHTML=rm25ReportMetrics(match);match._rm25StatsAt=match.clock;}
 const videoBox=$('#rm25-replay-report');if(videoBox&&match.replayData?.clips.length!==match._rm25LastCount){videoBox.innerHTML=rm25Summary(match);match._rm25LastCount=match.replayData?.clips.length;}
 $('#matchLog').innerHTML=match.eventLog.slice(0,13).map(e=>`<div><span>${e.time}</span><p>${esc(e.text)}</p>${e.clipId?`<button class="rm25-inline-video" data-replay-open="${esc(e.clipId)}">▶ Revoir</button>`:''}</div>`).join('')}
function finalScreen(){if(!match||match.saved)return;match.saved=true;cancelAnimationFrame(animation);completeGame(match);syncMatch();const m=match;const banner=document.createElement('div');banner.className='final-overlay';banner.innerHTML=`<div class="final-dialog"><span class="eyebrow">RENCONTRE TERMINÉE</span><h2>Score final</h2><div class="final-score">${m.score[0]} <span>—</span> ${m.score[1]}</div><div class="final-clubs">${esc(m.home.name)} · ${esc(m.away.name)}</div><p>${m.tries[0]} essai(s) à ${m.tries[1]} · ${m.events.rucks} rucks · ${m.events.contacts} contacts · ${m.events.lineouts} touches</p><button class="btn ghost full" id="rm25-final-replay">▶ Revoir les moments forts</button><button class="btn primary full" id="backToHome">Continuer ma carrière →</button></div>`;$('.match-layout').appendChild(banner);$('#rm25-final-replay').onclick=()=>{rm25StartReplay(match.replayData?.clips.slice().reverse().find(c=>c.type==='try')?.id||match.replayData?.clips.at(-1)?.id);if(rm25Replay){rm25Replay.returnBanner=banner;banner.remove();animation=requestAnimationFrame(frame);}};$('#backToHome').onclick=()=>{match=null;state.page='accueil';render();toast('Résultat sauvegardé — classement recalculé')};}
window.RM27_V027={orders:rm26Orders,pack:rm26Pack,kick:rm26KickTarget,contest:rm27LineContest,ball:rm27KickPoint,receive:rm27ReceiveKick};
window.RM27_V024={read:iq24Read,defence:iq24DefenceAssignments,ruckStrength:iq24RuckStrength};
window.RM27_TEST={rm25ReportMetrics,rm25Infringement,rm25Card,rm25Active,rm25Frame,rm25Summary,iq22StartPhase,iq22PhasePass,iq22DefenseScreen,iq21WideOption,iq21ReleaseRuck,iq21ReleaseSet,iq21Intercept,iq21BallToReceiver,DATA,tableFor,seededFixtures,makeGame,gameStep,playFast,rm26Orders,rm26Pack,rm26KickTarget,rm26ReceiveKick,rm27ScrumStep,rm27LineContest,rm27KickPoint,rm27ReceiveKick,addPenalty,chooseKick,allPlayers,attackPlan,targetPosition,formationSpacing,newSetPiece,resolveSet,reposition,planSupportRunners,iqTryOrTackle,choosePass,onDecision,iqPassGeometry,iqNearestSupport,iqDropGoal,sourceCount:()=>DATA.players.length};
load();ensureFixtures();render();

