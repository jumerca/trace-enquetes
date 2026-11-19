// V2.3 : date et mercato, calendrier daté et ordre des matchs, négociation club puis joueur, fiches /20, staff, doublons, ergonomie.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const OUT=path.join(__dirname,'captures');const rep={checks:{},errors:[]};
const ok=(k,v,detail)=>{rep.checks[k]={ok:!!v,detail};console.log(v?'OK ':'ÉCHEC',k,detail!==undefined?JSON.stringify(detail):'')};
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1366,height:900}});pg.on('pageerror',e=>rep.errors.push(e.message));pg.on('dialog',d=>d.accept());
 const shot=n=>pg.screenshot({path:path.join(OUT,n+'.jpg'),type:'jpeg',quality:80,fullPage:false});
 await pg.goto('file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html'));await pg.waitForTimeout(300);
 await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');await pg.waitForTimeout(200);
 const home=await pg.evaluate(()=>({top:[...document.querySelectorAll('.page-head .page-actions button')].map(b=>b.textContent.trim()),nav:[...document.querySelectorAll('.nav-item')].map(b=>b.textContent.trim()),date:RM2W.date(),open:RM2W.windowOpen(),budget:RM2W.budget()}));
 ok('tableau de bord sans bouton en haut',home.top.filter(t=>/Sauvegarder|Jouer le prochain/.test(t)).length===0,home.top);
 ok('menu sans Base de données ni Choisir un club',!home.nav.some(t=>/Base de données|Choisir un club/.test(t)),home.nav);
 ok('début au 1er juillet 2026, mercato ouvert',home.date==='2026-07-01'&&home.open,{date:home.date,budget:home.budget});
 await shot('v23_tableau_de_bord');
 // doublons : aucun joueur dans deux effectifs
 const dup=await pg.evaluate(()=>{const seen=new Map();let d=[];for(const c of clubs)for(const p of realPlayers(c.id)){const k=p.name.toLowerCase();if(seen.has(k)&&seen.get(k)!==c.id)d.push(p.name);seen.set(k,c.id)}return {doublons:d,retires:RM2W.duplicatesRemoved.length}});
 ok('aucun doublon de joueur entre clubs',dup.doublons.length===0,dup);
 // contrats datés
 const ctr=await pg.evaluate(()=>{const m={};for(const p of realPlayers(state.clubId)){const e=RM2W.endDate(RM2C.contractEnd(p)).slice(-4);m[e]=(m[e]||0)+1}return m});
 ok('fins de contrat datées 2027–2030',Object.keys(ctr).every(y=>+y>=2027&&+y<=2030),ctr);
 await pg.evaluate(()=>{state.page='effectif';render()});await shot('v23_effectif_contrats');
 const rosterDates=await pg.evaluate(()=>(document.querySelector('.rm2-table').textContent.match(/30\/06\/20\d\d/g)||[]).length);ok('dates affichées dans l’effectif',rosterDates>10,rosterDates);
 // fiche joueur /20
 await pg.click('.rm2-table [data-rm2="card"]');await pg.waitForTimeout(150);
 const fiche=await pg.evaluate(()=>({page:state.page,notes:document.querySelectorAll('.rm2-attrs .rm2-n20').length,txt:document.querySelector('.rm2-kv')?.textContent}));
 ok('fiche joueur avec notes /20 et contrat',fiche.page==='fiche'&&fiche.notes===14&&/Fin de contrat30\/06/.test(fiche.txt),fiche);
 await shot('v23_fiche_joueur');
 // staff Toulouse + fiche staff
 await pg.evaluate(()=>{state.page='staff';render()});await pg.waitForTimeout(100);
 const staff=await pg.evaluate(()=>({mola:document.body.textContent.includes('Ugo Mola'),links:document.querySelectorAll('[data-rm2w="staff"]').length}));
 ok('Toulouse a son entraîneur (Ugo Mola)',staff.mola,staff);
 await pg.click('[data-rm2w="staff"]');await pg.waitForTimeout(150);
 const sf=await pg.evaluate(()=>({page:state.page,notes:document.querySelectorAll('.rm2-attrs .rm2-n20').length,h:document.querySelector('h1').textContent}));
 ok('fiche staff avec notes /20',sf.page==='fiche'&&sf.notes===10,sf);await shot('v23_fiche_staff');
 // négociation : club puis joueur
 await pg.evaluate(()=>{state.page='transferts';render()});
 const target=await pg.evaluate(()=>{const p=DATA.players.find(p=>RM2C.clubOf(p.id)&&RM2C.clubOf(p.id)!==state.clubId&&club(RM2C.clubOf(p.id))?.league==='TOP14'&&RM2C.value(p)<1.2);RM2C.openNeg('buy',p.id);return {id:p.id,name:p.name,club:club(RM2C.clubOf(p.id)).name}});
 await pg.waitForTimeout(150);await shot('v23_nego_club');
 let st=await pg.evaluate(()=>RM2C.S().neg.stage);ok('négociation : étape club d’abord',st==='club',st);
 await pg.$eval('#rm2wFee',(el)=>{el.value=(RM2C.S().neg.ask*1.0).toFixed(2)});await pg.click('[data-rm2w="club-offer"]');await pg.waitForTimeout(150);
 st=await pg.evaluate(()=>RM2C.S().neg.stage);ok('accord du club puis étape joueur',st==='player',st);
 const s1=await pg.evaluate(()=>document.getElementById('rm2wSat').textContent);
 await pg.$eval('[data-rm2neg="wage"]',el=>{el.value=el.max;el.dispatchEvent(new Event('input',{bubbles:true}))});
 await pg.$eval('[data-rm2neg="role"]',el=>{el.value='titulaire';el.dispatchEvent(new Event('change',{bubbles:true}))});
 const s2=await pg.evaluate(()=>document.getElementById('rm2wSat').textContent);
 ok('la jauge de satisfaction réagit au salaire',parseInt(s2)>parseInt(s1),{avant:s1,apres:s2});
 await shot('v23_nego_joueur');
 await pg.click('[data-rm2w="player-offer"]');await pg.waitForTimeout(150);
 const done=await pg.evaluate(id=>({stage:RM2C.S().neg?.stage,result:RM2C.S().neg?.result,club:RM2C.clubOf(id)===state.clubId}),target.id);
 ok('transfert signé immédiatement',done.club,done);await shot('v23_nego_signature');
 await pg.click('[data-rm2w="neg-close"]');
 // calendrier daté, match suivant dans l'ordre
 await pg.evaluate(()=>{state.page='calendrier';render()});await shot('v23_calendrier');
 const cal=await pg.evaluate(()=>({dates:(document.querySelector('table').textContent.match(/sam\. \d+ /g)||[]).length,next:document.querySelectorAll('.rm2-next').length}));
 ok('calendrier avec dates et un seul prochain match',cal.dates>=20&&cal.next===1,cal);
 await pg.click('.rm2-next [data-action="simulate-round"]');await pg.waitForTimeout(500);
 const after=await pg.evaluate(()=>{const lid='TOP14';const fx=getFixtures(lid);const r1=fx.filter(f=>f.round===1);return {date:RM2W.date(),round1Done:r1.every(f=>f.result),round2Done:fx.filter(f=>f.round===2).some(f=>f.result),otherLeague:getFixtures('PROD2').filter(f=>f.result).length,window:RM2W.windowOpen()}});
 ok('journée 1 jouée entièrement, pas la suivante, mercato fermé',after.round1Done&&!after.round2Done&&!after.window,after);
 const closed=await pg.evaluate(()=>{const p=DATA.players.find(p=>RM2C.clubOf(p.id)&&RM2C.clubOf(p.id)!==state.clubId);RM2C.openNeg('buy',p.id);return state.page});
 ok('hors mercato, pas de transfert',closed!=='negociation',closed);
 // menu principal : export / restauration
 await pg.evaluate(()=>openMainMenu());await pg.waitForTimeout(100);
 ok('export et restauration dans le menu principal',await pg.$('[data-rm2w="export"]')!==null&&await pg.$('[data-rm2w="import"]')!==null);
 await shot('v23_menu_principal');
 rep.errors=rep.errors;fs.writeFileSync(path.join(__dirname,'world_qa_report.json'),JSON.stringify(rep,null,1));console.log('erreurs JS',rep.errors);await b.close()})();
