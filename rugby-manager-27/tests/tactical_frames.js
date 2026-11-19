// Captures en vue tactique (calque activé) à intervalle régulier pour inspecter les placements.
const {chromium}=require('playwright');const path=require('path');
const OUT=process.argv[2];const N=+process.argv[3]||24;const EVERY=+process.argv[4]||15;const SKIP=+process.argv[5]||600;
(async()=>{const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1100,height:700}});pg.on('dialog',d=>d.accept());
 await pg.goto('file://'+path.join(__dirname,'..','dist','Rugby_Manager_27_V2_0.html'));await pg.waitForTimeout(300);
 await pg.click('[data-main="new"]');await pg.click('[data-league-filter="TOP14"]');await pg.click('[data-select="stade-toulousain"]');await pg.click('[data-action="play"]');await pg.waitForTimeout(300);await pg.click('#m2Go');
 await pg.evaluate(s=>{const L=RM27_V2.live();L.paused=true;L.r.mode='tactical';L.r.overlay=true;L.r.labels=false;const M=L.M;for(let i=0;i<s;i++){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT)}},SKIP);
 for(let i=0;i<N;i++){const info=await pg.evaluate(e=>{const L=RM27_V2.live(),M=L.M;for(let k=0;k<e;k++){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT)}RM2R.updateCamera(L.r,M,.1,1);RM2R.draw(L.r,M,1);const c=RM2.carrier(M);
   const ctx=L.r.ctx;ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText(RM2.clockText(M)+' '+M.phase+' '+(M.play?M.play.kind+'/'+M.play.var:'')+' poss '+M.poss+(c?' porteur '+c.num:''),10,690);return ''},EVERY);
  await pg.screenshot({path:path.join(OUT,String(i).padStart(3,'0')+'.png')})}
 await b.close()})();
