
/* =========================================================
   EFFETS : confettis quand une enquête est classée
   ========================================================= */
const CONF={cv:null,ctx:null,list:[],raf:0};
function confettiBurst(n,fromY){
  if(!animOn())return;
  if(!CONF.cv){const c=document.createElement('canvas');c.id='confetti';c.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:70';document.body.appendChild(c);CONF.cv=c;CONF.ctx=c.getContext('2d');}
  const cv=CONF.cv,dp=Math.min(2,window.devicePixelRatio||1);cv.width=Math.round(innerWidth*dp);cv.height=Math.round(innerHeight*dp);CONF.dp=dp;
  const cols=['#d8352a','#e6c14a','#1d1b18','#fffdf7','#7fb0d6','#7d8f6a'];
  for(let i=0;i<n;i++){const left=i%2===0;CONF.list.push({x:left?-10:innerWidth+10,y:(fromY==null?innerHeight*.55:fromY)+Math.random()*60,vx:(left?1:-1)*(2.5+Math.random()*5.5),vy:-(7+Math.random()*7),r:Math.random()*6.28,vr:(Math.random()-.5)*.4,w:5+Math.random()*5,h:3+Math.random()*4,c:cols[i%cols.length],life:0});}
  if(!CONF.raf)CONF.raf=requestAnimationFrame(confettiStep);
}
function confettiStep(){const ctx=CONF.ctx,dp=CONF.dp;ctx.setTransform(dp,0,0,dp,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
  CONF.list=CONF.list.filter(p=>p.y<innerHeight+30&&p.life<260);
  for(const p of CONF.list){p.life++;p.vy+=.32;p.vx*=.992;p.x+=p.vx;p.y+=p.vy;p.r+=p.vr;ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.strokeStyle='#1d1b18';ctx.lineWidth=.8;ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);ctx.strokeRect(-p.w/2,-p.h/2,p.w,p.h);ctx.restore();}
  CONF.raf=CONF.list.length?requestAnimationFrame(confettiStep):0;if(!CONF.list.length)ctx.clearRect(0,0,innerWidth,innerHeight);}
{const _solve2=solveStep;solveStep=function(cs,k,t){const wasChal=!!(chal&&chal.id===cs.id),r=_solve2.apply(this,arguments),fin=wasChal?!chal:curStep(cs)<0;if(fin)setTimeout(()=>confettiBurst(cs.final?90:46),480);return r;};}
Object.assign(window.__animopolis,{confettiBurst,CONF});
