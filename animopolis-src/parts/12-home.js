
/* =========================================================
   ACCUEIL · PARTIES · OPTIONS · VERSION & MISES À JOUR
   ========================================================= */
const APP_VERSION='__VERSION__',APP_BUILD='__BUILD__';
const homeEl=$('home');
const fmtBuild=b=>/^\d{12}$/.test(b)?`${b.slice(0,8)}-${b.slice(8)}`:b;
const fmtDate=ts=>{if(!ts)return '';const d=new Date(ts);return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' à '+d.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});};
const hasSave=n=>{try{return localStorage.getItem(SLOTKEY(n))!==null;}catch(e){return false;}};
const anySave=()=>{for(let n=1;n<=NSLOTS;n++)if(hasSave(n))return true;return false;};
function slotInfo(n){if(!hasSave(n))return{n,empty:true};const d=n===slot?state:readSlot(n)||freshState();
  const done=CASES.filter(c=>(d.solved[c.id]||[]).filter(Boolean).length===c.steps.length).length,stars=CASES.reduce((a,c)=>a+caseStars(c,d),0);
  const cur=CASES.find(c=>c.id===d.current);return{n,empty:false,done,total:CASES.length,stars,rank:rankOf(stars),date:d.saved,cur:cur&&(d.solved[cur.id]||[]).filter(Boolean).length<cur.steps.length?cur.title:''};}
const slotLine=i=>`${i.done}/${i.total} enquêtes · ${i.stars}★ · ${i.rank}`;

/* ---------- accueil ---------- */
function refreshHome(){
  const info=slotInfo(slot),has=anySave();
  const c=$('hContinue');c.hidden=!has||info.empty;
  if(!c.hidden){c.firstChild.textContent=info.cur||info.done>0?'Reprendre la partie':'Commencer la partie';c.querySelector('small').textContent=`Partie ${slot} · ${slotLine(info)}${info.cur?' · en cours : '+info.cur:''}`;}
  const l=$('hLoad'),sv=$('hSave');
  const used=[1,2,3].filter(hasSave).length;l.disabled=!used;l.querySelector('small').textContent=used?`${used} partie${used>1?'s':''} sauvegardée${used>1?'s':''}`:'Aucune partie sauvegardée';
  sv.disabled=!has||info.empty;sv.querySelector('small').textContent=info.empty?'':'Automatique'+(state.saved?' · dernière : '+fmtDate(state.saved):'');
  $('hNew').classList.toggle('main',!has);
  updateVerUI();
}
function showHome(){closeModal();refreshHome();homeEl.classList.remove('hidden');}
function hideHome(){homeEl.classList.add('hidden');}
function toStart(){if(typeof clearTiles==='function'){clearTiles();for(const k in cardImg)delete cardImg[k];}updateCard();req();
  const cs=curCase();if(cs&&!caseDone(cs)){const t=focusPoint(cs);flyTo(t.x,t.y,Math.max(cam.s,Math.min(1.2,vw/700)),900);}else{const[x,y]=pr(590,590,0);flyTo(x,y-40,Math.max(minS,Math.min(.9,vw/1300)),700);}}
function loadSlot(n){const d=readSlot(n);if(!d){toast('Emplacement vide');return;}setState(d);slot=n;save();hideHome();closeModal();toStart();toast(`Partie ${n} chargée`);}
function startNew(n){setState(freshState());state.seen=true;slot=n;save();hideHome();closeModal();toStart();showHelp();}
function deleteSlot(n){try{localStorage.removeItem(SLOTKEY(n));}catch(e){}
  if(n===slot){const next=[1,2,3].find(hasSave);if(next){setState(readSlot(next));slot=next;try{localStorage.setItem('animopolis-active',String(next));}catch(e){}}else{setState(freshState());}}}

/* ---------- modales ---------- */
function slotsHTML(mode){return [1,2,3].map(n=>{const i=slotInfo(n);
  if(i.empty)return `<div class="slot empty"><div><div class="t">Partie ${n}</div><div class="m">Emplacement vide</div></div><div class="sbtns">${mode==='new'||mode==='copy'?`<button class="go" data-a="${mode}" data-n="${n}">${mode==='copy'?'Copier ici':'Commencer'}</button>`:''}</div></div>`;
  const cur=n===slot?' · partie actuelle':'';
  return `<div class="slot"><div><div class="t">Partie ${n}${cur}</div><div class="m">${slotLine(i)}<br>${fmtDate(i.date)}</div></div><div class="sbtns">${
    mode==='load'?`<button class="go" data-a="load" data-n="${n}">Charger</button><button class="del" data-a="del" data-n="${n}">Supprimer</button>`
    :mode==='new'?`<button class="del" data-a="new" data-n="${n}">Écraser</button>`
    :n===slot?'':`<button class="del" data-a="copy" data-n="${n}">Écraser</button>`}</div></div>`;}).join('');}
function bindSlots(root,mode){root.querySelectorAll('[data-a]').forEach(b=>b.onclick=()=>{const n=+b.dataset.n,a=b.dataset.a;
  if(a==='load')loadSlot(n);
  else if(a==='new'){if(hasSave(n)&&!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Confirmer';b.classList.add('go');return;}startNew(n);}
  else if(a==='copy'){if(hasSave(n)&&!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Confirmer';b.classList.add('go');return;}try{const d=Object.assign({},state,{saved:Date.now()});localStorage.setItem(SLOTKEY(n),JSON.stringify(d));}catch(e){}closeModal();refreshHome();toast(`Copie enregistrée dans la partie ${n}`);}
  else if(a==='del'){if(!b.classList.contains('sure')){b.classList.add('sure');b.textContent='Confirmer';return;}deleteSlot(n);refreshHome();openLoad();}});}
function openNew(){openModal(`<h2>Nouvelle partie</h2><p class="legend">Choisis un emplacement. Une partie existante sera effacée.</p>${slotsHTML('new')}`,r=>bindSlots(r,'new'));}
function openLoad(){if(![1,2,3].some(hasSave)){closeModal();return;}openModal(`<h2>Charger une partie</h2>${slotsHTML('load')}`,r=>bindSlots(r,'load'));}
function openSave(){openModal(`<h2>Sauvegarder la partie</h2><p>Ta partie (<b>Partie ${slot}</b>) est <b>sauvegardée automatiquement</b> à chaque étape${state.saved?' — dernière sauvegarde : '+fmtDate(state.saved):''}.</p><p class="legend">Tu peux aussi en garder une copie dans un autre emplacement, par exemple avant d'essayer autre chose.</p>${slotsHTML('copy')}<button class="btn ghost" id="okS">Fermer</button>`,r=>{bindSlots(r,'copy');r.querySelector('#okS').onclick=closeModal;});}
function openOptions(){
  openModal(`<h2>Options</h2>
  <button class="btn ghost" id="oAnim">Animations du décor : ${opts.anim?'activées':'coupées'}</button>
  ${(!standalone)?'<button class="btn ghost" id="oInst">Installer l\'application</button>':''}
  <button class="btn ghost" id="oUpd">Vérifier les mises à jour</button>
  <button class="btn ghost" id="oHelp">Comment jouer ?</button>
  <button class="btn ghost" id="oClr">Recharger le jeu (vider le cache)</button>
  <p class="legend" id="oVer" style="margin-top:12px"></p><button class="btn" id="oOk">Fermer</button>`,r=>{
    const ver=()=>{r.querySelector('#oVer').innerHTML=verText(true);};ver();
    r.querySelector('#oAnim').onclick=e=>{opts.anim=!opts.anim;saveOpts();req();e.target.textContent='Animations du décor : '+(opts.anim?'activées':'coupées');};
    const ib=r.querySelector('#oInst');if(ib)ib.onclick=()=>{closeModal();doInstall();};
    r.querySelector('#oUpd').onclick=async e=>{e.target.textContent='Vérification…';const a=await checkUpdate({});
      e.target.textContent=a===null?'Vérification impossible (hors ligne ?)':a?'Mise à jour disponible — touche pour l\'installer':'Tu as la dernière version ✓';ver();if(a)e.target.onclick=applyUpdate;};
    r.querySelector('#oHelp').onclick=showHelp;
    r.querySelector('#oClr').onclick=()=>applyUpdate();
    r.querySelector('#oOk').onclick=closeModal;});}

/* ---------- version & mises à jour ---------- */
const updState={checked:0,latest:null,avail:false,err:false};
const verText=long=>{let s=`Version ${APP_VERSION} · build ${fmtBuild(APP_BUILD)}`;
  if(updState.avail)s+=` — mise à jour ${updState.latest.version} disponible`;else if(updState.checked&&!updState.err)s+=' — à jour ✓';else if(updState.err)s+=' — vérification impossible';
  if(long&&updState.checked)s+=`<br>Dernière vérification : ${fmtDate(updState.checked)}`;return s;};
function updateVerUI(){$('homeVer').textContent=verText(false).replace(/<br>.*/,'');
  const box=$('homeUpd');if(updState.avail){box.hidden=false;if(!box.dataset.busy)box.innerHTML=`Nouvelle version <b>${updState.latest.version}</b> disponible.<br><button id="homeUpdGo">Mettre à jour maintenant</button>`;const g=$('homeUpdGo');if(g)g.onclick=()=>applyUpdate();}else if(!box.dataset.busy)box.hidden=true;
  $('updBar').hidden=!(updState.avail&&homeEl.classList.contains('hidden'));}
async function checkUpdate(o){o=o||{};
  try{const r=await fetch('version.json?t='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error('http');const j=await r.json();
    updState.latest=j;updState.checked=Date.now();updState.err=false;updState.avail=+j.build>+APP_BUILD;updateVerUI();
    if(updState.avail&&o.auto&&!homeEl.classList.contains('hidden')){const k='animopolis-upd-'+j.build;let tried=false;try{tried=!!sessionStorage.getItem(k);sessionStorage.setItem(k,'1');}catch(e){}if(!tried)applyUpdate();else{$('homeUpd').dataset.busy='';$('homeUpd').innerHTML='La mise à jour ne s\'est pas chargée. Va dans <b>Options › Recharger le jeu</b>.';}}
    return updState.avail;}
  catch(e){updState.checked=Date.now();updState.err=true;updateVerUI();return null;}}
async function applyUpdate(){const box=$('homeUpd');box.hidden=false;box.dataset.busy='1';box.textContent='Mise à jour en cours…';closeModal();homeEl.classList.remove('hidden');
  try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()));}}catch(e){}
  try{if(window.caches){const ks=await caches.keys();await Promise.all(ks.filter(k=>k.startsWith('animopolis-')).map(k=>caches.delete(k)));}}catch(e){}
  location.reload();}
$('updGo').onclick=()=>applyUpdate();
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-updState.checked>45000)checkUpdate({auto:true});});
window.addEventListener('pageshow',e=>{if(e.persisted)checkUpdate({auto:true});});
setInterval(()=>{if(!document.hidden)checkUpdate({auto:true});},10*60*1000);

/* ---------- installation (téléphone, tablette, ordinateur) ---------- */
let installEvt=null;
function platform(){const ua=navigator.userAgent||'',touch=(navigator.maxTouchPoints||0)>1;
  const ios=/iphone|ipod/i.test(ua)||/ipad/i.test(ua)||(/Macintosh/i.test(ua)&&touch);
  const android=/android/i.test(ua);const edge=/edg\//i.test(ua),firefox=/firefox|fxios/i.test(ua),samsung=/samsungbrowser/i.test(ua),opera=/opr\//i.test(ua);
  const chrome=/chrome|crios/i.test(ua)&&!edge&&!samsung&&!opera;const safari=/safari/i.test(ua)&&!/chrome|crios|android|fxios|edg\//i.test(ua);
  const mac=/Macintosh/i.test(ua)&&!touch,win=/windows/i.test(ua);
  return{ios,android,edge,firefox,samsung,chrome,safari,mac,win,tablet:/ipad/i.test(ua)||(ios&&touch&&!/iphone/i.test(ua))||(android&&!/mobile/i.test(ua))};}
function installGuides(){const P=platform();const g=[];
  g.push({id:'ios',t:P.tablet&&P.ios?'iPad (Safari)':'iPhone / iPad (Safari)',me:P.ios,s:['Ouvre le jeu dans <b>Safari</b>.','Touche le bouton <b>Partager</b> (le carré avec une flèche vers le haut).','Choisis <b>« Sur l\'écran d\'accueil »</b>, puis <b>Ajouter</b>.']});
  g.push({id:'and',t:'Android (téléphone ou tablette)',me:P.android,s:P.firefox?['Touche le menu <b>⋮</b>.','Choisis <b>« Installer »</b>.']:P.samsung?['Touche le menu <b>☰</b>.','Choisis <b>« Ajouter la page à »</b> puis <b>« Écran d\'accueil »</b>.']:['Dans <b>Chrome</b>, touche le menu <b>⋮</b>.','Choisis <b>« Installer l\'application »</b> (ou « Ajouter à l\'écran d\'accueil »).']});
  g.push({id:'pc',t:'Ordinateur (Chrome, Edge, Opera)',me:!P.ios&&!P.android&&(P.chrome||P.edge||P.opera),s:['Dans la barre d\'adresse, clique sur l\'icône <b>Installer</b> (un écran avec une flèche), à droite.','Sinon : menu <b>⋮</b> › <b>« Enregistrer et partager »</b> › <b>« Installer Animopolis »</b> (Chrome) ou <b>Applications › Installer ce site comme application</b> (Edge).']});
  g.push({id:'mac',t:'Mac (Safari 17 ou plus)',me:P.mac&&P.safari,s:['Menu <b>Fichier</b> › <b>« Ajouter au Dock… »</b>.']});
  g.push({id:'ff',t:'Firefox sur ordinateur',me:P.firefox&&!P.android&&!P.ios,s:['Firefox ne sait pas installer les applications web. Ajoute le jeu à tes <b>favoris</b>, ou utilise Chrome ou Edge.']});
  g.sort((a,b)=>(b.me?1:0)-(a.me?1:0));return g;}
function showInstallHelp(){const g=installGuides();
  openModal(`<h2>Installer Animopolis</h2><p class="legend">Le jeu s'ouvre alors comme une vraie application, avec son icône, en plein écran, et se met à jour tout seul. Il fonctionne aussi sans Internet.</p>${g.map(x=>`<div class="instbox${x.me?' me':''}"><b>${x.me?'👉 ':''}${x.t}</b><ol>${x.s.map(l=>`<li>${l}</li>`).join('')}</ol></div>`).join('')}<button class="btn" id="okI">Compris</button>`,r=>r.querySelector('#okI').onclick=closeModal);}
async function doInstall(){if(installEvt){const ev=installEvt;installEvt=null;try{ev.prompt();const c=await ev.userChoice;if(c&&c.outcome==='accepted')toast('Installation en cours…');}catch(e){showInstallHelp();}updateInstallUI();}else showInstallHelp();}
function updateInstallUI(){$('hInstall').hidden=standalone;}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEvt=e;updateInstallUI();});
window.addEventListener('appinstalled',()=>{installEvt=null;$('hInstall').hidden=true;toast('Animopolis est installé !');});
$('hInstall').onclick=doInstall;updateInstallUI();

/* ---------- clavier (ordinateur) ---------- */
window.addEventListener('keydown',e=>{if(e.target&&/input|textarea/i.test(e.target.tagName))return;
  if(e.key==='Escape'){if(!$('modal').classList.contains('hidden'))closeModal();else if(homeEl.classList.contains('hidden')&&e.shiftKey)showHome();return;}
  if(!homeEl.classList.contains('hidden')||!$('modal').classList.contains('hidden'))return;
  const st=60/cam.s;if(e.key==='ArrowLeft'){cam.x-=st;clampCam();req();}else if(e.key==='ArrowRight'){cam.x+=st;clampCam();req();}else if(e.key==='ArrowUp'){cam.y-=st;clampCam();req();}else if(e.key==='ArrowDown'){cam.y+=st;clampCam();req();}
  else if(e.key==='h'||e.key==='H'){$('btnHint').click();}else if(e.key==='c'||e.key==='C'){showCases();}else if(e.key==='n'||e.key==='N'){showBook();}});

/* ---------- boutons ---------- */
$('hContinue').onclick=()=>{hideHome();toStart();updateVerUI();};
$('hNew').onclick=()=>{if(!anySave()){startNew(1);}else openNew();};
$('hLoad').onclick=openLoad;
$('hSave').onclick=openSave;
$('hOpts').onclick=openOptions;
$('logoBtn').onclick=showHome;
Object.assign(window.__animopolis,{platform,showInstallHelp,doInstall,showHome,startNew,loadSlot,slotInfo,APP_VERSION,APP_BUILD,checkUpdate,updState});

/* ---------- démarrage ---------- */
if(/[?&]nohome/.test(location.search)){hideHome();if(!state.seen){state.seen=true;save();showHelp();}}
else if(/[?&]continue/.test(location.search)&&anySave()){hideHome();toStart();}
else if(/[?&]book/.test(location.search)&&anySave()){hideHome();toStart();setTimeout(showBook,300);}
else showHome();
checkUpdate({auto:true});
