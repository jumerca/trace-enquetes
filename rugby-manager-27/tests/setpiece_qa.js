// Vérifie dans Chromium : fenêtre de combinaison (touche : sauteur + combinaison ; mêlée), application de la combinaison,
// pénalité avec explication du capitaine, plan de jeu modifié en direct.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');
const OUT=path.join(__dirname,'captures');const rep={};
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1366,height:768}});const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
 await pg.goto('file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html'));await pg.waitForTimeout(300);
 await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');await pg.click('[data-action="play"]');await pg.waitForTimeout(300);await pg.click('#m2Go');
 const until=async(type)=>pg.evaluate(t=>{const L=RM27_V2.live(),M=L.M;L.paused=true;let n=0;while(n++<40000&&!M.done){if(M.pending){if(M.pending.type===t)break;RM2.autoDecide(M)}RM2.step(M,RM2.DT)}for(const p of M.P){p.px=p.x;p.py=p.y}RM2R.snapCamera(L.r,M);L.modalPending=false;L.paused=false;return M.pending?{type:M.pending.type,clock:RM2.clockText(M),suggest:M.pending.suggest}:null},type);
 rep.lineout=await until('lineout');await pg.waitForTimeout(400);
 await pg.screenshot({path:OUT+'/combinaison_touche.jpg',type:'jpeg',quality:82});
 await pg.click('[data-zone="fond"]');await pg.waitForTimeout(100);
 rep.lineoutChoices=await pg.$$eval('[data-play]',b=>b.length);
 await pg.click('[data-play="fond-8"]');await pg.waitForTimeout(100);
 rep.lineoutApplied=await pg.evaluate(()=>{const M=RM27_V2.live().M;return M.pd.call});
 rep.scrum=await until('scrum');await pg.waitForTimeout(400);
 await pg.screenshot({path:OUT+'/combinaison_melee.jpg',type:'jpeg',quality:82});
 rep.scrumChoices=await pg.$$eval('[data-play]',b=>b.length);
 await pg.click('[data-play="8-ferme"]');await pg.waitForTimeout(100);
 rep.scrumApplied=await pg.evaluate(()=>RM27_V2.live().M.pd.call);
 rep.penalty=await until('penalty');await pg.waitForTimeout(400);
 rep.penaltyWhy=await pg.evaluate(()=>RM27_V2.live().M.pending?.why);
 await pg.screenshot({path:OUT+'/penalite_capitaine.jpg',type:'jpeg',quality:82});
 await pg.click('[data-pen]');await pg.waitForTimeout(100);
 await pg.click('[data-panel="tactics"]');await pg.waitForTimeout(150);await pg.click('[data-plan="pied"]');await pg.waitForTimeout(150);
 rep.planApplied=await pg.evaluate(()=>{const M=RM27_V2.live().M,u=M.userTeam;return {base:M.T[u].base.plan,kicking:+M.T[u].tactics.kicking.toFixed(2)}});
 await pg.screenshot({path:OUT+'/plan_de_jeu_direct.jpg',type:'jpeg',quality:82});
 rep.weather=await pg.evaluate(()=>RM27_V2.live().M.weather);
 rep.errors=errs;fs.writeFileSync(path.join(__dirname,'setpiece_qa_report.json'),JSON.stringify(rep,null,1));console.log(JSON.stringify(rep,null,1));await b.close()})();
