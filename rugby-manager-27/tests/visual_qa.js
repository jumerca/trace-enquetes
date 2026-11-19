// Contrôle visuel réel dans Chromium : captures de phases de jeu, caméras, trois formats d'écran, i/s mesurées.
// Usage : node tests/visual_qa.js   (après python3 tools/build.py)
const {chromium,devices}=require('playwright');const path=require('path');const fs=require('fs');
const FILE='file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html');
const OUT=path.join(__dirname,'captures');fs.mkdirSync(OUT,{recursive:true});
const report={viewports:[],errors:[]};
async function newCareer(pg){
 await pg.goto(FILE);await pg.waitForTimeout(400);
 await pg.click('[data-main="new"]');await pg.waitForTimeout(250);
 await pg.click('[data-league-filter="TOP14"]');await pg.waitForTimeout(250);
 await pg.click('[data-select="stade-toulousain"]');await pg.waitForTimeout(300);
}
async function runUntil(pg,cond,maxSteps=30000){
 return pg.evaluate(([c,max])=>{const L=RM27_V2.live();const M=L.M;const f=new Function('M','RM2',`return (${c})`);let n=0;
  while(n<max&&!M.done){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT);n++;if(f(M,RM2))break}
  return {n,phase:M.phase,clock:RM2.clockText(M)}},[cond,maxSteps]);
}
async function settle(pg,ms=900){await pg.evaluate(()=>{const L=RM27_V2.live();L.paused=false;L.speed=1;L.digest=false});await pg.waitForTimeout(ms);await pg.evaluate(()=>{RM27_V2.live().paused=true})}
(async()=>{
 const b=await chromium.launch();
 const vps=[{name:'pc_1366',viewport:{width:1366,height:768},deviceScaleFactor:1},{name:'tablette_1024',viewport:{width:1024,height:768},deviceScaleFactor:2,isMobile:true,hasTouch:true},{name:'mobile_852x393',viewport:{width:852,height:393},deviceScaleFactor:3,isMobile:true,hasTouch:true},{name:'mobile_393x852',viewport:{width:393,height:852},deviceScaleFactor:3,isMobile:true,hasTouch:true}];
 for(const vp of vps){
  const ctx=await b.newContext({viewport:vp.viewport,deviceScaleFactor:vp.deviceScaleFactor,isMobile:!!vp.isMobile,hasTouch:!!vp.hasTouch});
  const pg=await ctx.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));pg.on('dialog',d=>d.accept());
  await newCareer(pg);
  await pg.screenshot({path:`${OUT}/${vp.name}_accueil.png`});
  await pg.click('[data-action="play"]');await pg.waitForTimeout(500);
  await pg.screenshot({path:`${OUT}/${vp.name}_intro.png`});
  await pg.click('#m2Go');
  // mesure des images/seconde en jeu, vitesse ×2
  await pg.evaluate(()=>{const L=RM27_V2.live();L.speed=2;L.digest=false});
  await pg.waitForTimeout(1200);
  const fps=await pg.evaluate(()=>new Promise(res=>{let n=0;const t0=performance.now();function f(){n++;if(performance.now()-t0<3000)requestAnimationFrame(f);else res(Math.round(n*1000/(performance.now()-t0)))}requestAnimationFrame(f)}));
  const canvasPx=await pg.evaluate(()=>{const c=document.getElementById('m2c');return {css:[c.clientWidth,c.clientHeight],px:[c.width,c.height]}});
  await pg.evaluate(()=>{RM27_V2.live().paused=true});
  await pg.screenshot({path:`${OUT}/${vp.name}_match_tv.png`});
  const shots=[['ruck',"M.phase==='ruck'&&M.pd.t>1.4"],['melee',"M.phase==='scrum'&&M.pd.stage==='push'"],['touche',"M.phase==='lineout'&&M.pd.stage==='throw'"],['jeu_au_pied',"M.phase==='play'&&M.ball.st==='air'&&M.ball.kind==='kick'&&M.ball.z>4"],['plaquage',"M.tk&&M.t-M.tk.t0>.25"]];
  if(vp.name!=='pc_1366')shots.splice(2,3);
  for(const [name,cond] of shots){const r=await runUntil(pg,cond);await pg.evaluate(()=>{const L=RM27_V2.live();for(const p of L.M.P){p.px=p.x;p.py=p.y}window.RM2R.snapCamera(L.r,L.M)});await settle(pg,name==='plaquage'?0:150);await pg.screenshot({path:`${OUT}/${vp.name}_${name}.png`});report.viewports.push({vp:vp.name,shot:name,...r})}
  for(const cam of ['tactical','full','close']){await pg.evaluate(c=>{const L=RM27_V2.live();L.r.mode=c;L.r.zoom=1;window.RM2R.snapCamera(L.r,L.M)},cam);await pg.waitForTimeout(250);await pg.screenshot({path:`${OUT}/${vp.name}_cam_${cam}.png`})}
  await pg.evaluate(()=>{const L=RM27_V2.live();L.r.mode='tv'});
  await pg.click('[data-panel="stats"]');await pg.waitForTimeout(250);await pg.screenshot({path:`${OUT}/${vp.name}_stats.png`});
  await pg.click('[data-panel="tactics"]');await pg.waitForTimeout(250);await pg.screenshot({path:`${OUT}/${vp.name}_tactique.png`});
  report.viewports.push({vp:vp.name,fps,canvasPx,errors:errs});
  report.errors.push(...errs.map(e=>vp.name+': '+e));
  await ctx.close();
 }
 fs.writeFileSync(path.join(__dirname,'visual_qa_report.json'),JSON.stringify(report,null,1));
 console.log(JSON.stringify(report.viewports.filter(v=>v.fps),null,0));console.log('erreurs JS :',report.errors.length?report.errors:'aucune');
 await b.close();
})();
