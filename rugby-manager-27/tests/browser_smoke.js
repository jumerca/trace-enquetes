// Parcours réel dans Chromium : menu, nouvelle partie, club, match V2 (direct puis simulation), retour carrière.
const {chromium}=require('playwright');const path=require('path');
const FILE='file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html');
(async()=>{
 const b=await chromium.launch();const errors=[];
 const pg=await b.newPage({viewport:{width:1366,height:768},deviceScaleFactor:1});
 pg.on('pageerror',e=>errors.push('pageerror: '+e.message));pg.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 pg.on('dialog',d=>d.accept());
 await pg.goto(FILE);await pg.waitForTimeout(500);
 await pg.screenshot({path:'tests/captures/01_menu_1366.png'});
 await pg.click('[data-main="new"]');await pg.waitForTimeout(300);
 await pg.click('[data-league-filter="TOP14"]');await pg.waitForTimeout(300);await pg.click('[data-select="stade-toulousain"]');await pg.waitForTimeout(300);
 await pg.screenshot({path:'tests/captures/02_accueil_1366.png'});
 await pg.click('[data-action="play"]');await pg.waitForTimeout(600);
 await pg.click('#m2Go');await pg.waitForTimeout(4000);
 await pg.screenshot({path:'tests/captures/03_match_tv_1366.png'});
 const st=await pg.evaluate(()=>{const L=RM27_V2.live();return {clock:L.M.clock,phase:L.M.phase,score:L.M.score,fps:L.r.fps}});
 console.log('direct',JSON.stringify(st));
 console.log(errors.join('\n')||'aucune erreur JS');
 await b.close();
})();
