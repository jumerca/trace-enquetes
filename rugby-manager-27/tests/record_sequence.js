// Enregistre une séquence réelle d'un match de carrière (moteur V2, caméra TV), image par image, puis GIF via ffmpeg.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');const {execSync}=require('child_process');
const FILE='file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html');
const TMP=path.join(__dirname,'captures','frames');fs.rmSync(TMP,{recursive:true,force:true});fs.mkdirSync(TMP,{recursive:true});
(async()=>{
 const b=await chromium.launch();const pg=await b.newPage({viewport:{width:960,height:540}});pg.on('dialog',d=>d.accept());
 await pg.goto(FILE);await pg.waitForTimeout(300);await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');
 await pg.click('[data-action="play"]');await pg.waitForTimeout(300);await pg.click('#m2Go');
 // avance jusqu'à une sortie de mêlée (séquence : mêlée → attaque → plaquage → ruck → relance)
 await pg.evaluate(()=>{const L=RM27_V2.live();L.paused=true;const M=L.M;let n=0;while(n++<20000&&!(M.phase==='scrum'&&M.pd.stage==='engage')){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT)}for(const p of M.P){p.px=p.x;p.py=p.y}RM2R.snapCamera(L.r,M)});
 const frames=+process.argv[2]||150;
 for(let i=0;i<frames;i++){
  await pg.evaluate(()=>{const L=RM27_V2.live(),M=L.M;if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT);RM2R.updateCamera(L.r,M,RM2.DT,1);RM2R.draw(L.r,M,1)});
  await pg.screenshot({path:path.join(TMP,String(i).padStart(4,'0')+'.png')});
 }
 const ev=await pg.evaluate(()=>RM27_V2.live().M.log.slice(-12).map(e=>Math.floor(e.c/60)+"' "+e.s));
 console.log(ev.join('\n'));
 await b.close();
 const gif=path.join(__dirname,'captures','RM27_V2_sequence_match.gif');
 execSync(`ffmpeg -y -loglevel error -framerate 10 -i ${TMP}/%04d.png -vf "fps=10,scale=720:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer:bayer_scale=4" ${gif}`);
 execSync(`ffmpeg -y -loglevel error -framerate 10 -i ${TMP}/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 23 ${path.join(__dirname,'captures','RM27_V2_sequence_match.mp4')}`);
 fs.rmSync(TMP,{recursive:true,force:true});
 console.log('GIF',Math.round(fs.statSync(gif).size/1024),'Ko');
})();
