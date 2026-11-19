// Tests automatiques du moteur V2 (Node, sans navigateur).
// Usage : node tests/engine_tests.js [nombreDeMatchs] [graineDeDépart] > rapport.json
const {RM2,team,match}=require('./load_engine');
const N=+process.argv[2]||6,S0=+process.argv[3]||11;
const styles=[{},{width:.9,forwards:.25,risk:.6},{width:.25,forwards:.9,kicking:.3},{kicking:.85},{lineSpeed:.95,contest:.7},{lineSpeed:.3}];
const out={matches:[],checks:{},totals:{}};
let teleports=0,teleportSamples=[],ballDetached=0,forwardPasses=0,passes=0,swarms=0,maxBound=0,scoreMismatch=0,clockBad=0,overlaps=0,ticks=0;
const phaseTime={};
for(let s=S0;s<S0+N;s++){
 const A=team('Alpha',74+(s%5)*2,styles[s%styles.length]),B=team('Beta',78-(s%4)*2,styles[(s+3)%styles.length]);
 const M=match(s,A,B);
 const t0=Date.now();let prevHalf=1;
 const origPass=RM2.passBall;
 RM2.passBall=function(M2,c,r,k){const cr=RM2.R(M2,c.team,c.x);const res=origPass.apply(this,arguments);passes++;if(M2.ball.st==='air'&&RM2.R(M2,c.team,M2.ball.lx)>cr+.35)forwardPasses++;return res};
 while(!M.done){
  const before=M.P.map(p=>({x:p.x,y:p.y,mode:p.mode,id:p.id,enter:p.enterAt}));
  const half=M.half;
  RM2.step(M,RM2.DT);ticks++;
  phaseTime[M.phase]=(phaseTime[M.phase]||0)+RM2.DT;
  if(M.half!==half||M.phase==='half')continue;
  M.P.forEach((p,i)=>{const b=before[i];if(p.mode==='off'||p.mode==='bin'||b.mode==='bin'||p.id!==b.id||p.enterAt>=M.t-RM2.DT*1.5)return;
   const d=Math.hypot(p.x-b.x,p.y-b.y);const lim=p.vmax*RM2.DT*1.25+.62;
   if(d>lim){teleports++;if(teleportSamples.length<12)teleportSamples.push({seed:s,clock:Math.round(M.clock),phase:M.phase,num:p.num,mode:p.mode,d:+d.toFixed(2)})}});
  if(M.ball.st==='held'){const o=M.P[M.ball.owner];if(Math.hypot(o.x-M.ball.x,o.y-M.ball.y)>.6)ballDetached++}
  if(M.phase==='ruck'&&M.ruck){const bx=M.ball.x,by=M.ball.y;const near=M.P.filter(p=>p.mode!=='bin'&&Math.hypot(p.x-bx,p.y-by)<3).length;if(near>10)swarms++;
   const bound=M.P.filter(p=>p.mode==='bound').length;if(bound>maxBound)maxBound=bound}
  if(M.frames%5===0){for(let i=0;i<30;i++)for(let j=i+1;j<30;j++){const a=M.P[i],b=M.P[j];if(a.mode!=='run'||b.mode!=='run')continue;if(Math.hypot(a.x-b.x,a.y-b.y)<.35)overlaps++}}
 }
 RM2.passBall=origPass;
 const st=M.st;const calc=t=>st[t].tries*5+st[t].conv*2+st[t].pen*3+st[t].drop*3;
 for(const t of [0,1]){const pt=M.log.filter(e=>e.k==='pentry'&&e.tm===t).length;if(calc(t)+pt*2!==M.score[t])scoreMismatch++}
 if(M.clock<4800||M.half!==2)clockBad++;
 const sum=k=>st[0][k]+st[1][k];
 const row={seed:s,teams:[A.strength,B.strength],score:M.score.join('-'),tries:M.tries.join('-'),clockMin:+(M.clock/60).toFixed(1),bipMin:+((M.bip||0)/60).toFixed(1),ms:Date.now()-t0};
 for(const k of ['rucks','tackles','missed','passes','offloads','kicks','lineouts','scrums','mauls','penC','turnovers','breaks','knock','yc','kick5022'])row[k]=sum(k);
 row.points=M.score[0]+M.score[1];row.triesTotal=M.tries[0]+M.tries[1];
 out.matches.push(row);
}
const keys=Object.keys(out.matches[0]).filter(k=>typeof out.matches[0][k]==='number'&&k!=='seed');
for(const k of keys){const v=out.matches.map(m=>m[k]);const mean=v.reduce((a,b)=>a+b,0)/v.length;const sd=Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length);out.totals[k]={mean:+mean.toFixed(1),sd:+sd.toFixed(1),min:Math.min(...v),max:Math.max(...v)}}
out.checks={ticks,teleports,teleportSamples,ballDetachedTicks:ballDetached,forwardPassLaunches:forwardPasses,passesChecked:passes,ruckSwarms:swarms,maxBoundInRuck:maxBound,overlapSamples:overlaps,scoreMismatch,clockBad};
out.phaseShare=Object.fromEntries(Object.entries(phaseTime).map(([k,v])=>[k,+(v/Object.values(phaseTime).reduce((a,b)=>a+b,0)*100).toFixed(1)]));
console.log(JSON.stringify(out,null,1));
