// Capture comparative V1.6 / V2.0 du même match de carrière (Toulouse), même format d'écran.
const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();
 for(const [name,file] of [['V1_6','archive/Rugby_Manager_27_V1_6_ORIGINAL.html'],['V2_0','dist/Rugby_Manager_27_V2_0.html']]){
  const pg=await b.newPage({viewport:{width:1366,height:768}});pg.on('dialog',d=>d.accept());
  await pg.goto('file://'+path.join(__dirname,'..',file));await pg.waitForTimeout(400);
  await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');await pg.click('[data-action="play"]');await pg.waitForTimeout(500);
  if(name==='V1_6'){await pg.click('#rmRun').catch(()=>{});await pg.waitForTimeout(9000)}
  else{await pg.click('#m2Go');await pg.evaluate(()=>{RM27_V2.live().speed=1});await pg.waitForTimeout(9000)}
  await pg.screenshot({path:path.join(__dirname,'captures','comparaison_'+name+'.png')});await pg.close()}
 await b.close()})();
