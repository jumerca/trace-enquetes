// V2.6 : saison complète (Top 14) avec phases finales, champion, montée / descente, marqueurs, navigation mobile.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const OUT=path.join(__dirname,'captures');const rep={checks:{},errors:[]};
const ok=(k,v,d)=>{rep.checks[k]={ok:!!v,detail:d};console.log(v?'OK ':'ÉCHEC',k,d!==undefined?JSON.stringify(d):'')};
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1366,height:900}});pg.on('pageerror',e=>rep.errors.push(e.message));pg.on('dialog',d=>d.accept());
 await pg.goto('file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html'));await pg.waitForTimeout(300);
 ok('menu principal à jour (version 2.x)',/VERSION 2\./.test(await pg.evaluate(()=>document.querySelector('.version-note')?.textContent||'')));
 await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');await pg.waitForTimeout(200);
 await pg.screenshot({path:path.join(OUT,'v26_tableau_de_bord.jpg'),type:'jpeg',quality:80});
 const t0=Date.now();
 const reg=await pg.evaluate(()=>{let g=0;while(getFixtures('TOP14').some(f=>!f.playoff&&!f.result)&&g++<40)playRound();
  RM2W.progressPlayoffs();const po=getFixtures('TOP14').filter(f=>f.playoff);return {played:tableFor('TOP14').find(t=>t.id===state.clubId).p,rank:tableFor('TOP14').findIndex(t=>t.id===state.clubId)+1,barrages:po.map(f=>f.stage+':'+f.home+'-'+f.away),date:RM2W.date()}});
 ok('saison régulière jouée et barrages créés',reg.played===26&&reg.barrages.length>=2,{...reg,secondes:Math.round((Date.now()-t0)/1000)});
 await pg.evaluate(()=>{state.page='championnats';state.leagueId='TOP14';render()});await pg.screenshot({path:path.join(OUT,'v26_phases_finales.jpg'),type:'jpeg',quality:80,fullPage:true});
 const lead=await pg.evaluate(()=>({essais:RM2W.leaders('TOP14','tr',3).map(x=>x.p.name+' '+x.v),points:RM2W.leaders('TOP14','pts',3).map(x=>x.p.name+' '+x.v)}));
 ok('classement des marqueurs alimenté',lead.essais.length===3&&lead.points.length===3,lead);
 const po=await pg.evaluate(()=>{let g=0;while(!RM2W.leagueFinished('TOP14')&&g++<12)playRound();const h=RM2C.S().honours||[];return {fini:RM2W.leagueFinished('TOP14'),champions:h.map(x=>x.league+':'+x.champion+' '+x.score),stages:getFixtures('TOP14').filter(f=>f.playoff).map(f=>f.stage),date:RM2W.date()}});
 ok('phases finales jusqu’à la finale, champion sacré',po.fini&&po.champions.some(c=>c.startsWith('TOP14')),po);
 await pg.evaluate(()=>{state.page='championnats';state.leagueId='TOP14';render()});await pg.screenshot({path:path.join(OUT,'v26_finale_palmares.jpg'),type:'jpeg',quality:80,fullPage:true});
 await pg.evaluate(()=>{state.page='accueil';render()});
 ok('bouton saison suivante proposé',await pg.$('[data-rm-next-season]')!==null);
 const nx=await pg.evaluate(()=>{const lastT14=tableFor('TOP14').at(-1).id;rmStartNewSeason();const h=RM2C.S().honours||[];const pd2=h.find(x=>x.league==='PROD2'&&x.season===1)?.champion;
  return {saison:state.rmSeason,descendu:lastT14,ligueDescendu:club(lastT14).league,monte:pd2,ligueMonte:club(pd2)?.league,clubsTop14:clubs.filter(c=>c.league==='TOP14').length,fixturesTop14:getFixtures('TOP14').length,date:RM2W.date(),champions:h.length}});
 ok('montée / descente appliquées à la nouvelle saison',nx.saison===2&&nx.ligueDescendu==='PROD2'&&nx.ligueMonte==='TOP14'&&nx.clubsTop14===14&&nx.fixturesTop14===182,nx);
 // sauvegarde : les compétitions survivent au rechargement
 const persist=await pg.evaluate(()=>{save();return JSON.stringify(RM2C.S().leagueOf)});
 await pg.reload();await pg.waitForTimeout(300);await pg.click('[data-main="load"]');await pg.waitForTimeout(300);
 const after=await pg.evaluate(()=>({map:JSON.stringify(RM2C.S().leagueOf),t14:clubs.filter(c=>c.league==='TOP14').length,s:state.rmSeason}));
 ok('compétitions conservées après rechargement',after.map===persist&&after.t14===14&&after.s===2,after);
 // mobile : barre d'onglets
 await pg.setViewportSize({width:393,height:852});await pg.evaluate(()=>{state.page='accueil';render()});await pg.waitForTimeout(150);
 const mob=await pg.evaluate(()=>({tab:getComputedStyle(document.querySelector('.rm2-tabbar')).display,side:getComputedStyle(document.querySelector('.sidebar')).display,overflow:document.documentElement.scrollWidth>window.innerWidth+2}));
 ok('mobile : onglets en bas, pas de débordement horizontal',mob.tab==='flex'&&mob.side==='none'&&!mob.overflow,mob);
 await pg.screenshot({path:path.join(OUT,'v26_mobile_accueil.jpg'),type:'jpeg',quality:80});
 await pg.click('[data-rm2tab="plus"]');await pg.waitForTimeout(100);await pg.screenshot({path:path.join(OUT,'v26_mobile_plus.jpg'),type:'jpeg',quality:80});
 await pg.click('.rm2-sheet [data-page="championnats"]');await pg.waitForTimeout(150);
 ok('mobile : panneau Plus mène aux pages',await pg.evaluate(()=>state.page)==='championnats');
 for(const p of ['effectif','calendrier','transferts','championnats']){await pg.evaluate(x=>{state.page=x;render()},p);await pg.waitForTimeout(80);const o=await pg.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);if(o)ok('mobile : pas de débordement sur '+p,false)}
 await pg.evaluate(()=>{state.page='calendrier';render()});await pg.screenshot({path:path.join(OUT,'v26_mobile_calendrier.jpg'),type:'jpeg',quality:80});
 console.log('erreurs JS',rep.errors);fs.writeFileSync(path.join(__dirname,'season_qa_report.json'),JSON.stringify(rep,null,1));await b.close()})();
