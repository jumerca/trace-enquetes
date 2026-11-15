/* =========================================================
   INTERFACE : figurines à ramasser, succès, pages du Carnet
   (chargé après l'interface principale, il en complète les fonctions)
   ========================================================= */
const figsOf=()=>{if(!state.figs)state.figs={};return state.figs;};
const figCount=()=>FIGS.filter(f=>figsOf()[f.id]).length;
const figDistCount=d=>FIGS.filter(f=>f.d===d&&figsOf()[f.id]).length;

/* ---- ramasser une figurine en la touchant (même pendant une enquête, sans pénalité) ---- */
function tryFig(x,y){
  const slack=Math.min(12,Math.max(0,8/cam.s-6));
  for(const f of FIGS){const p=FIGPOS[f.id];if(!p||figsOf()[f.id]||!unlocked(f.d))continue;
    if(Math.hypot(x-(p.x+4),y-(p.y-14))<=16+slack){
      figsOf()[f.id]=true;save();fx.pulse={x:p.x+4,y:p.y-14,r:16,t:performance.now()};req();
      if(typeof confettiBurst==='function')confettiBurst(18,innerHeight*.45);
      if(typeof play==='function')play('found');
      toast(`🏺 Figurine « ${f.n} » trouvée ! ${figCount()}/${FIGS.length}`);return true;}}
  return false;}
{const _onTap=onTap;onTap=function(x,y){if(tryFig(x,y))return;_onTap(x,y);};}

/* ---- succès ---- */
const ACH=[
 {id:'premier',i:'🔍',t:'Premier dossier',d:'Classe ta première enquête.',ok:()=>CASES.filter(caseDone).length>=1},
 {id:'cinq',i:'📁',t:'Apprenti détective',d:'Classe 5 enquêtes.',ok:()=>CASES.filter(caseDone).length>=5},
 {id:'quinze',i:'🗂️',t:'Enquêteur confirmé',d:'Classe 15 enquêtes.',ok:()=>CASES.filter(caseDone).length>=15},
 {id:'tous',i:'🏆',t:'Détective légendaire',d:'Classe toutes les enquêtes.',ok:()=>CASES.every(caseDone)},
 {id:'quartier',i:'🏙️',t:'Quartier complet',d:'Classe toutes les enquêtes d\'un quartier.',ok:()=>DISTRICTS.some((D,i)=>{const l=CASES.filter(c=>c.dist===i);return l.length&&l.every(caseDone);})},
 {id:'monde',i:'🗺️',t:'Globe-trotter',d:'Ouvre les six quartiers.',ok:()=>DISTRICTS.every((D,i)=>unlocked(i))},
 {id:'etoiles15',i:'⭐',t:'Étoile montante',d:'Réunis 15 étoiles.',ok:()=>totalStars()>=15},
 {id:'etoiles60',i:'🌟',t:'Constellation',d:'Réunis 60 étoiles.',ok:()=>totalStars()>=60},
 {id:'parfait',i:'💎',t:'Sans faute',d:'3 étoiles sur une enquête difficile.',ok:()=>CASES.some(c=>c.diff===3&&caseStars(c)===3)},
 {id:'dix3',i:'🎖️',t:'Perfectionniste',d:'3 étoiles sur 10 enquêtes.',ok:()=>CASES.filter(c=>caseStars(c)===3).length>=10},
 {id:'chrono',i:'⏱️',t:'Contre la montre',d:'Termine une enquête en mode chrono.',ok:()=>Object.keys(state.best||{}).length>=1},
 {id:'feu',i:'🎆',t:'Sauveur de la fête',d:'Résous « Sabotage au feu d\'artifice ».',ok:()=>caseDone(CASES.find(c=>c.id==='feu'))},
 {id:'ile',i:'🐢',t:'Gardien de l\'île',d:'Résous la finale de l\'île.',ok:()=>caseDone(CASES.find(c=>c.id==='tortue'))},
 {id:'ombre',i:'🕵️',t:'L\'Ombre démasquée',d:'Résous le dossier de l\'Ombre.',ok:()=>caseDone(CASES.find(c=>c.final))},
 {id:'fig6',i:'🏺',t:'Chineur',d:'Trouve 6 figurines dorées.',ok:()=>figCount()>=6},
 {id:'fig24',i:'🏛️',t:'Conservateur du musée',d:'Trouve les 24 figurines dorées.',ok:()=>figCount()>=FIGS.length}
];
function achOf(){if(!state.ach)state.ach={};return state.ach;}
let achBusy=false;
function checkAch(){if(achBusy||!built)return;achBusy=true;
  try{const got=achOf(),fresh=[];for(const a of ACH){if(!got[a.id]&&a.ok()){got[a.id]=Date.now();fresh.push(a);}}
    if(fresh.length){try{localStorage.setItem(SLOTKEY(slot),JSON.stringify(Object.assign({},state,{saved:Date.now(),caseLen:caseLens()})));}catch(e){}
      fresh.forEach((a,i)=>setTimeout(()=>{toast(`${a.i} Succès : ${a.t}`);if(typeof play==='function')play('unlock');},1800+i*2300));}}
  catch(e){}finally{achBusy=false;}}
{const _save=save;save=function(){_save();checkAch();};}

/* ---- Carnet : succès et figurines ---- */
{const _book=showBook;
 showBook=function(){_book();const ok=document.getElementById('okB');if(!ok)return;const got=achOf();
  const nA=ACH.filter(a=>got[a.id]).length;
  const html=`<h3>🏅 Succès (${nA}/${ACH.length})</h3><div class="achgrid">${ACH.map(a=>got[a.id]?`<div class="ach"><i>${a.i}</i><div><b>${a.t}</b><span>${a.d}</span></div></div>`:`<div class="ach no"><i>🔒</i><div><b>${a.t}</b><span>${a.d}</span></div></div>`).join('')}</div>
   <h3>🏺 Figurines dorées (${figCount()}/${FIGS.length})</h3><p class="legend">24 petites statues dorées sont cachées dans la ville, quatre par quartier. Touche-les pour les ramasser, même pendant une enquête. ${DISTRICTS.map((D,i)=>unlocked(i)?`${D.name} : ${figDistCount(i)}/${FIGS.filter(f=>f.d===i).length}`:'').filter(Boolean).join(' · ')}</p><div class="figgrid" id="figGrid"></div>`;
  ok.insertAdjacentHTML('beforebegin',html);
  const g=document.getElementById('figGrid');
  FIGS.forEach(f=>{const found=figsOf()[f.id];const d=document.createElement('div');d.className='fig'+(found?'':' no');d.appendChild(portrait(f.s));d.insertAdjacentHTML('beforeend',`<b>${found?f.n:'???'}</b>`);g.appendChild(d);});};
 $('btnBook').onclick=showBook;}

/* ---- Dossier de l'Ombre : ramifications ---- */
{const _cl=showClues;
 showClues=function(){_cl();const fin=document.getElementById('fin')||document.querySelector('#modalBody .legend:last-child');
  const rows=Object.keys(RAMIF).map(id=>{const cs=CASES.find(c=>c.id===id);return caseDone(cs)?`<div class="clue"><b>🏝️ Ramification : ${RAMIF[id].t}</b>${RAMIF[id].x}</div>`:`<div class="clue no"><b>🏝️ Ramification : ???</b>Résous « ${cs.title} ».</div>`;}).join('');
  const body=document.getElementById('modalBody');body.insertAdjacentHTML('beforeend',`<h3>Sur l'île</h3>${rows}`);};
 const ob=document.getElementById('ombreBtn');if(ob)ob.onclick=showClues;}
