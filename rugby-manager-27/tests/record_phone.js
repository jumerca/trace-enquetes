// Séquence réelle au format téléphone portrait (393×852), vue TV, autour d'une chandelle du 9.
const {chromium}=require('playwright');const path=require('path');const fs=require('fs');const {execSync}=require('child_process');
const TMP=path.join(__dirname,'captures','frames_phone');fs.rmSync(TMP,{recursive:true,force:true});fs.mkdirSync(TMP,{recursive:true});
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:393,height:852},deviceScaleFactor:2,isMobile:true,hasTouch:true});const pg=await ctx.newPage();pg.on('dialog',d=>d.accept());
 await pg.goto('file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html'));await pg.waitForTimeout(300);
 await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');await pg.click('[data-action="play"]');await pg.waitForTimeout(300);await pg.click('#m2Go');
 await pg.evaluate(()=>{const L=RM27_V2.live();L.paused=true;const M=L.M;let n=0;while(n++<40000&&!(M.play&&M.play.kind==='box'&&M.phase==='play')){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT)}for(const p of M.P){p.px=p.x;p.py=p.y}RM2R.snapCamera(L.r,M)});
 const frames=+process.argv[2]||110;
 for(let i=0;i<frames;i++){await pg.evaluate(()=>{const L=RM27_V2.live(),M=L.M;if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT);RM2R.updateCamera(L.r,M,RM2.DT,1);RM2R.draw(L.r,M,1)});await pg.screenshot({path:path.join(TMP,String(i).padStart(4,'0')+'.png')})}
 await b.close();
 const out=path.join(__dirname,'captures','RM27_V2_1_sequence_telephone');
 execSync(`ffmpeg -y -loglevel error -framerate 10 -i ${TMP}/%04d.png -c:v libx264 -pix_fmt yuv420p -crf 24 ${out}.mp4`);
 execSync(`ffmpeg -y -loglevel error -framerate 10 -i ${TMP}/%04d.png -vf "scale=300:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse" ${out}.gif`);
 execSync(`ffmpeg -y -loglevel error -i ${out}.mp4 -vf "select='not(mod(n\\,12))',scale=240:-1,tile=9x1" -frames:v 1 ${TMP}/../sheet_phone.jpg`);
 fs.rmSync(TMP,{recursive:true,force:true});console.log('ok')})();
