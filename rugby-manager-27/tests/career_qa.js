// Tests de gestion dans Chromium : migration d'une sauvegarde V1.6 réelle, saisons successives,
// entraînement, négociation, ventes, sauvegarde / rechargement. Usage : node tests/career_qa.js [saisons]
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const V16='file://'+path.join(__dirname,'..','archive','Rugby_Manager_27_V1_6_ORIGINAL.html');
const V2='file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html');
const SEASONS=+process.argv[2]||3;
const rep={steps:[],errors:[]};
const log=(k,v)=>{rep.steps.push({k,...v});console.log(k,JSON.stringify(v))};
(async()=>{
 const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1366,height:768}});
 const pg=await ctx.newPage();pg.on('pageerror',e=>rep.errors.push(e.message));pg.on('dialog',d=>d.accept());
 // 1) carrière créée avec la V1.6 d'origine
 await pg.goto(V16);await pg.waitForTimeout(400);
 await pg.click('[data-main="new"]');await pg.waitForTimeout(200);
 await pg.click('[data-select="ca-brive"]');await pg.waitForTimeout(200);
 await pg.evaluate(()=>{state.leagueId='PROD2';playRound()});await pg.waitForTimeout(200);
 const v16=await pg.evaluate(()=>({club:state.clubId,played:getFixtures('PROD2').filter(f=>f.result).length,budget:state.budget}));
 log('sauvegarde V1.6 créée',v16);
 // 2) ouverture avec la V2.0 : chargement sans perte
 await pg.goto(V2);await pg.waitForTimeout(400);
 await pg.click('[data-main="load"]');await pg.waitForTimeout(300);
 const mig=await pg.evaluate(()=>({club:state.clubId,played:getFixtures('PROD2').filter(f=>f.result).length,budget:state.budget,backup:!!localStorage.getItem('rugby-manager-27-alpha-v1-avant-v2'),rm2:!!state.rm2}));
 log('chargement en V2.0',mig);
 if(mig.club!==v16.club||mig.played!==v16.played)rep.errors.push('migration : données perdues');
 // 3) entraînement + pages de gestion
 for(const page of ['effectif','tactique','transferts','finance','calendrier','championnats','staff','accueil']){await pg.evaluate(p=>{state.page=p;render()},page);await pg.waitForTimeout(80)}
 await pg.evaluate(()=>{state.page='tactique';render()});
 await pg.$eval('[data-rm2train="defence"]',el=>{el.value='3';el.dispatchEvent(new Event('change',{bubbles:true}))});
 await pg.$eval('[data-rm2train="intensity"]',el=>{el.value='1.2';el.dispatchEvent(new Event('change',{bubbles:true}))});
 const tb=await pg.evaluate(()=>RM2C.trainingBonus(state.clubId));log('bonus d’entraînement',tb);
 await pg.screenshot({path:path.join(__dirname,'captures','gestion_tactique_entrainement.png'),fullPage:false});
 // 4) négociation d'un transfert via l'interface
 await pg.evaluate(()=>{state.page='transferts';render()});await pg.waitForTimeout(100);
 await pg.screenshot({path:path.join(__dirname,'captures','gestion_marche.png')});
 const before=await pg.evaluate(()=>realPlayers(state.clubId).length);
 await pg.click('[data-rm2="buy"]');await pg.waitForTimeout(100);
 await pg.screenshot({path:path.join(__dirname,'captures','gestion_negociation.png')});
 await pg.$eval('#rm2Wage',el=>{el.value=(+el.value*1.25).toFixed(3)});
 await pg.$eval('#rm2Fee',el=>{el.value=(+el.value*1.15).toFixed(2)}).catch(()=>{});
 await pg.click('#rm2NegGo');await pg.waitForTimeout(150);
 const neg=await pg.evaluate(()=>({msg:document.getElementById('rm2NegMsg')?.textContent||'accepté',squad:realPlayers(state.clubId).length,budget:state.budget}));
 await pg.evaluate(()=>document.querySelector('.rm2-shade')?.remove());
 log('négociation',{...neg,squadBefore:before});
 // 5) mise en vente d'un joueur
 await pg.evaluate(()=>{const p=realPlayers(state.clubId)[3];RM2C.S().listed[p.id]=state.rmSeason||1;save()});
 // 6) saisons successives
 for(let s=0;s<SEASONS;s++){
  const t0=Date.now();
  const res=await pg.evaluate(()=>{state.leagueId=club(state.clubId).league;let guard=0;while(getFixtures(state.leagueId).some(f=>!f.result)&&guard++<60)playRound();
   const t=tableFor(state.leagueId);const me=t.findIndex(x=>x.id===state.clubId)+1;
   const r=RM2C.S();return {season:state.rmSeason||1,rank:me,played:t.find(x=>x.id===state.clubId).p,budget:+state.budget.toFixed(2),injured:realPlayers(state.clubId).filter(p=>RM2C.injured(p.id)).length,offers:r.offers.length,news:r.news.slice(0,3).map(n=>n.t),board:RM2C.board().conf}});
  log('saison terminée',{...res,secondes:Math.round((Date.now()-t0)/1000)});
  const ag=await pg.evaluate(()=>{const p=realPlayers(state.clubId).find(x=>x.status!=='test');return {id:p.id,age:RM2C.age(p),ovr:RM2C.ovr(p)}});
  await pg.evaluate(()=>rmStartNewSeason());await pg.waitForTimeout(100);
  const nx=await pg.evaluate(id=>{const p=findPlayer(id);return {season:state.rmSeason,age:p?RM2C.age(p):null,ovr:p?RM2C.ovr(p):null,squad:allPlayers(state.clubId).length,real:realPlayers(state.clubId).length,youth:RM2C.S().youth.length,fixtures:getFixtures(club(state.clubId).league).length,history:(state.rmSeasonHistory||[]).length,aiSigned:RM2C.S().aiSigned,objective:RM2C.board().obj.label}},ag.id);
  log('intersaison',{avant:ag,apres:nx});
  if(nx.age!==ag.age+1)rep.errors.push('âge non incrémenté');
 }
 // 7) sauvegarde, rechargement, comparaison
 const snap=await pg.evaluate(()=>{save();return JSON.stringify({c:state.clubId,s:state.rmSeason,b:state.budget,y:state.rm2.youth.length,h:state.rmSeasonHistory.length})});
 await pg.reload();await pg.waitForTimeout(300);await pg.click('[data-main="load"]');await pg.waitForTimeout(300);
 const snap2=await pg.evaluate(()=>JSON.stringify({c:state.clubId,s:state.rmSeason,b:state.budget,y:state.rm2.youth.length,h:state.rmSeasonHistory.length}));
 log('rechargement',{identique:snap===snap2,snap2,taille_ko:await pg.evaluate(()=>Math.round(localStorage.getItem('rugby-manager-27-alpha-v1').length/1024))});
 if(snap!==snap2)rep.errors.push('sauvegarde différente après rechargement');
 await pg.evaluate(()=>{state.page='effectif';render()});await pg.screenshot({path:path.join(__dirname,'captures','gestion_effectif_saison'+(SEASONS+1)+'.png')});
 await pg.evaluate(()=>{state.page='accueil';render()});await pg.screenshot({path:path.join(__dirname,'captures','gestion_accueil_saison'+(SEASONS+1)+'.png'),fullPage:true});
 fs.writeFileSync(path.join(__dirname,'career_qa_report.json'),JSON.stringify(rep,null,1));
 console.log('erreurs :',rep.errors.length?rep.errors:'aucune');
 await b.close();
})();
