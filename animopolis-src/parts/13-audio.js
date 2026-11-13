
/* =========================================================
   SONS : effets, ambiance et musique, entièrement synthétisés
   avec WebAudio (aucun fichier à télécharger).
   Les fonctions de synthèse prennent (contexte, sortie, instant) pour
   pouvoir aussi être rendues hors ligne dans les tests.
   ========================================================= */
const AU={ctx:null,master:null,sfx:null,mus:null,amb:null,ambG:{},theme:0,want:0,nextT:0,step:0,bar:0,mel:3,rng:mulberry32(9001),inited:false,lastReveal:null,seen:{}};
const noiseBufs=new WeakMap();
function noiseBuf(ctx){let b=noiseBufs.get(ctx);if(!b){const n=Math.floor(ctx.sampleRate*2);b=ctx.createBuffer(1,n,ctx.sampleRate);const d=b.getChannelData(0);let s=1;for(let i=0;i<n;i++){s=(s*16807)%2147483647;d[i]=s/1073741823.5-1;}noiseBufs.set(ctx,b);}return b;}
function tone(ctx,dest,t,f,dur,o){o=o||{};const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=o.type||'sine';osc.frequency.setValueAtTime(f,t);if(o.to)osc.frequency.exponentialRampToValueAtTime(o.to,t+dur);
  const v=o.vol==null?.2:o.vol,a=o.a==null?.006:o.a;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+Math.max(dur,a+.02));
  osc.connect(g);let last=g;if(o.lp){const fl=ctx.createBiquadFilter();fl.type='lowpass';fl.frequency.value=o.lp;g.connect(fl);last=fl;}last.connect(dest);osc.start(t);osc.stop(t+dur+.08);}
function noise(ctx,dest,t,dur,o){o=o||{};const src=ctx.createBufferSource(),g=ctx.createGain(),fl=ctx.createBiquadFilter();src.buffer=noiseBuf(ctx);src.loop=true;fl.type=o.type||'lowpass';fl.frequency.setValueAtTime(o.f||800,t);if(o.to)fl.frequency.exponentialRampToValueAtTime(o.to,t+dur);fl.Q.value=o.q||.7;
  const v=o.vol==null?.1:o.vol,a=o.a==null?.01:o.a;g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+dur);src.connect(fl);fl.connect(g);g.connect(dest);src.start(t,Math.random()*1.5);src.stop(t+dur+.08);}

/* ---------- effets ---------- */
const SFX={
  tap:(c,d,t)=>tone(c,d,t,1500,.05,{type:'triangle',vol:.1,to:1100}),
  pop:(c,d,t)=>tone(c,d,t,420,.1,{vol:.13,to:720}),
  ping:(c,d,t)=>{tone(c,d,t,1318,.28,{vol:.17});tone(c,d,t+.07,1760,.3,{vol:.1});},
  found:(c,d,t)=>{[523,659,784,1047].forEach((f,i)=>tone(c,d,t+i*.075,f,.3,{type:'triangle',vol:.17}));tone(c,d,t+.3,2093,.4,{vol:.05});},
  wrong:(c,d,t)=>{tone(c,d,t,230,.18,{type:'sawtooth',vol:.09,to:140,lp:900});tone(c,d,t+.13,170,.28,{type:'sawtooth',vol:.09,to:100,lp:700});noise(c,d,t,.08,{f:700,vol:.04});},
  hint:(c,d,t)=>{tone(c,d,t,1568,.55,{vol:.12});tone(c,d,t,2349,.45,{vol:.05});tone(c,d,t+.13,1976,.55,{vol:.09});},
  done:(c,d,t,stars)=>{[523,659,784,1047].forEach((f,i)=>tone(c,d,t+i*.12,f,.4,{type:'triangle',vol:.19}));
    [523,659,784,1047].forEach(f=>tone(c,d,t+.5,f,1.1,{vol:.06,a:.04}));
    for(let i=0;i<(stars||3);i++)tone(c,d,t+.8+i*.17,[1568,2093,2637][i],.45,{vol:.1});},
  unlock:(c,d,t)=>{noise(c,d,t,1,{type:'bandpass',f:300,to:3200,q:1.4,vol:.22,a:.15});[587,740,880,1175].forEach((f,i)=>tone(c,d,t+.75+i*.09,f,1,{type:'triangle',vol:.11,a:.02}));},
  chrono:(c,d,t)=>{tone(c,d,t,880,.12,{type:'square',vol:.04,lp:2000});tone(c,d,t+.18,1175,.2,{type:'square',vol:.04,lp:2000});}
};
/* ---------- musique : un thème par quartier ---------- */
const THEMES=[
  {n:'Centre',bpm:104,root:261.63,scale:[0,2,4,7,9],prog:[[0,4,7],[5,9,12],[7,11,14],[0,4,7]],wave:'triangle',bass:'walk'},
  {n:'Port',bpm:84,root:293.66,scale:[0,2,4,7,9],prog:[[0,4,7],[7,11,14],[9,12,16],[5,9,12]],wave:'sine',bass:'long',pad:1},
  {n:'Fête',bpm:118,root:220,scale:[0,2,4,7,9],prog:[[0,4,7],[0,4,7],[5,9,12],[7,11,14]],wave:'square',bass:'oompah',bright:1},
  {n:'Gare',bpm:100,root:164.81,scale:[0,3,5,7,10],prog:[[0,3,7],[0,3,7],[5,8,12],[7,10,14]],wave:'triangle',bass:'walk',chug:1},
  {n:'Colline',bpm:70,root:196,scale:[0,2,4,7,9],prog:[[0,4,7],[9,12,16],[5,9,12],[7,11,14]],wave:'triangle',bass:'long',harp:1,pad:1},
  {n:'Île',bpm:92,root:174.61,scale:[0,2,4,6,7,9,11],prog:[[0,4,7],[2,6,9],[4,7,11],[2,6,9]],wave:'triangle',bass:'walk',marimba:1}
];
const hz=(root,semi)=>root*Math.pow(2,semi/12);
function scheduleStep(ctx,dest,t,th,step,bar,st){const ch=th.prog[bar%th.prog.length],rng=st.rng;
  const bassF=hz(th.root,ch[0])/2;
  if(th.bass==='oompah'){if(step%2===0)tone(ctx,dest,t,step%4===0?bassF:hz(th.root,ch[0]+7)/2,.22,{type:'triangle',vol:.14});}
  else if(th.bass==='long'){if(step===0)tone(ctx,dest,t,bassF,1.4,{vol:.14,a:.03});}
  else if(step===0||step===4)tone(ctx,dest,t,step===0?bassF:hz(th.root,ch[2])/2,.5,{vol:.14});
  if(th.pad&&step===0)ch.forEach(n=>tone(ctx,dest,t,hz(th.root,n),60/th.bpm*7.5,{vol:.028,a:.5}));
  if(th.chug&&step%2===0)noise(ctx,dest,t,.09,{f:380,vol:.05});
  if(step%2===0){const n=ch[(step/2)%3];tone(ctx,dest,t,hz(th.root,n+12),th.harp?.7:.28,{type:th.harp?'sine':th.wave,vol:.045,lp:2400});}
  if(th.harp&&step%2===1)tone(ctx,dest,t,hz(th.root,ch[(step>>1)%3]+19),.5,{vol:.03});
  const p=step%2===0?.62:.3;
  if(rng()<p){const m=st.mel+(rng()<.5?-1:1)*(1+(rng()<.25?1:0));st.mel=Math.max(0,Math.min(th.scale.length+2,m));
    const deg=st.mel,semi=th.scale[deg%th.scale.length]+12*Math.floor(deg/th.scale.length)+12;
    tone(ctx,dest,t,hz(th.root,semi),th.marimba?.18:.4,{type:th.marimba?'triangle':th.wave,vol:th.bright?.05:.065,lp:th.wave==='square'?1800:3200});
    if(th.bright&&rng()<.4)tone(ctx,dest,t+.02,hz(th.root,semi+12),.2,{vol:.03});}
}
/* ---------- moteur ---------- */
const sfxOn=()=>opts.sfx!==false,musOn=()=>opts.music!==false,volOf=()=>opts.vol==null?.8:opts.vol;
function audioInit(){if(AU.ctx)return AU.ctx;try{const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;const ctx=new AC();AU.ctx=ctx;
  AU.master=ctx.createGain();const comp=ctx.createDynamicsCompressor();AU.master.connect(comp);comp.connect(ctx.destination);
  AU.sfx=ctx.createGain();AU.mus=ctx.createGain();AU.amb=ctx.createGain();AU.sfx.connect(AU.master);AU.mus.connect(AU.master);AU.amb.connect(AU.master);
  const lay=(type,f,q,lfoHz,lfoDepth)=>{const src=ctx.createBufferSource(),fl=ctx.createBiquadFilter(),g=ctx.createGain();src.buffer=noiseBuf(ctx);src.loop=true;fl.type=type;fl.frequency.value=f;fl.Q.value=q;g.gain.value=0;src.connect(fl);fl.connect(g);g.connect(AU.amb);src.start();
    if(lfoHz){const o=ctx.createOscillator(),og=ctx.createGain();o.frequency.value=lfoHz;og.gain.value=lfoDepth;o.connect(og);og.connect(g.gain);o.start();}return g;};
  AU.ambG={wave:lay('lowpass',650,.5,.11,.025),wind:lay('bandpass',520,.6,.07,.008),crowd:lay('bandpass',950,1.4,.2,.01),rumble:lay('lowpass',130,.5,0,0)};
  AU.nextT=ctx.currentTime+.2;audioApply(true);setInterval(audioTick,120);setInterval(ambientTick,500);AU.inited=true;}catch(e){AU.ctx=null;}return AU.ctx;}
function audioApply(now){const c=AU.ctx;if(!c)return;const t=c.currentTime,k=now?0:.08;
  AU.master.gain.setTargetAtTime(volOf(),t,k);AU.sfx.gain.setTargetAtTime(sfxOn()?1:0,t,k);AU.amb.gain.setTargetAtTime(sfxOn()?1:0,t,k);AU.mus.gain.setTargetAtTime(musOn()?.5:0,t,k);
  const sb=$('btnSound');if(sb){sb.textContent=(sfxOn()||musOn())&&volOf()>0?'🔊':'🔇';sb.setAttribute('aria-label',sb.textContent==='🔊'?'Couper le son':'Activer le son');}}
function audioUnlock(){const c=audioInit();if(c&&c.state==='suspended')c.resume().catch(()=>{});}
['pointerdown','keydown','touchend'].forEach(ev=>addEventListener(ev,audioUnlock,{passive:true}));
document.addEventListener('visibilitychange',()=>{const c=AU.ctx;if(!c)return;if(document.hidden)c.suspend().catch(()=>{});else c.resume().catch(()=>{});});
function play(name,delay,a1){if(!sfxOn()||volOf()<=0)return;const c=audioInit();if(!c)return;const go=()=>{try{SFX[name](c,AU.sfx,c.currentTime+(delay||0)+.01,a1);}catch(e){}};if(c.state==='running')go();else c.resume().then(go).catch(()=>{});}
/* quartier au centre de la vue */
function viewDistrict(){const u=cam.y+cam.x/2,v=cam.y-cam.x/2;return Math.max(0,Math.min(5,distOf(u,v)));}
function audioTick(){const c=AU.ctx;if(!c||c.state!=='running')return;
  if(AU.nextT<c.currentTime)AU.nextT=c.currentTime+.05;
  AU.want=homeEl&&!homeEl.classList.contains('hidden')?AU.want:viewDistrict();
  while(AU.nextT<c.currentTime+.4){let th=THEMES[AU.theme];if(AU.step===0&&AU.theme!==AU.want){AU.theme=AU.want;th=THEMES[AU.theme];}
    if(musOn())scheduleStep(c,AU.mus,AU.nextT,th,AU.step,AU.bar,AU);
    AU.nextT+=60/th.bpm/2;AU.step=(AU.step+1)%8;if(AU.step===0)AU.bar++;}
  if(!sfxOn())return;const d=AU.want,r=AU.rng(),t=c.currentTime+.02;
  if((d===0||d===4)&&r<.014)chirp(c,AU.amb,t);else if((d===1||d===5)&&r<.007)gull(c,AU.amb,t);else if(d===3&&r<.004)whistle(c,AU.amb,t);else if(d===2&&r<.01)tone(c,AU.amb,t,[1318,1568,1760][Math.floor(AU.rng()*3)],.35,{vol:.03});}
function chirp(c,dest,t){const f=2300+Math.random()*1300;for(let i=0;i<2+Math.floor(Math.random()*3);i++)tone(c,dest,t+i*.085,f+i*120,.07,{vol:.05,to:f*1.25});}
function gull(c,dest,t){tone(c,dest,t,1900,.5,{type:'sawtooth',vol:.025,to:1100,lp:2600,a:.05});tone(c,dest,t+.35,1700,.45,{type:'sawtooth',vol:.02,to:1000,lp:2400,a:.05});}
function whistle(c,dest,t){tone(c,dest,t,440,.8,{type:'square',vol:.018,lp:1500,a:.05});tone(c,dest,t,554,.8,{type:'square',vol:.014,lp:1500,a:.05});}
function ambientTick(){const c=AU.ctx;if(!c||c.state!=='running')return;const d=AU.want,k=Math.max(.15,Math.min(1,(cam.s-.3)/.9)),t=c.currentTime;
  const T={wave:0,wind:.012,crowd:0,rumble:0};
  if(d===1||d===5){T.wave=.12;T.wind=.02;}else if(d===0){T.crowd=.05;}else if(d===2){T.crowd=.085;}else if(d===3){T.rumble=.08;T.crowd=.02;}else if(d===4){T.wind=.05;}
  for(const n in AU.ambG)AU.ambG[n].gain.setTargetAtTime(T[n]*k,t,.9);}
/* ---------- branchements sur le jeu ---------- */
{const _wrong=addWrong;addWrong=function(cs){const r=_wrong.apply(this,arguments);play('wrong');return r;};
 const _solve=solveStep;solveStep=function(cs,k,t){const wasChal=!!(chal&&chal.id===cs.id),r=_solve.apply(this,arguments),fin=wasChal?!chal:curStep(cs)<0;if(fin)play('done',.2,wasChal?3:(caseStars(cs)||3));else play('found');return r;};
 const _toast=toast;toast=function(msg){if(/trouvés !$/.test(msg||''))play('ping');return _toast.apply(this,arguments);};
 const _open=openModal;openModal=function(){const r=_open.apply(this,arguments);play('pop');return r;};
 const _start=startChal;startChal=function(){play('chrono');return _start.apply(this,arguments);};
 document.addEventListener('click',e=>{const b=e.target.closest&&e.target.closest('button');if(!b||b.classList.contains('choice')||b.id==='btnSound')return;play(b.id==='btnHint'?'hint':'tap');},true);
 setInterval(()=>{if(reveal&&reveal!==AU.lastReveal){AU.lastReveal=reveal;play('unlock');}},150);
 $('btnSound').onclick=()=>{const on=(sfxOn()||musOn())&&volOf()>0;opts.sfx=!on;opts.music=!on;if(!on&&volOf()<=0)opts.vol=.8;saveOpts();audioInit();audioApply();if(!on)play('pop');};}
Object.assign(window.__animopolis,{AU,SFX,THEMES,scheduleStep,tone,noise,play,audioInit,audioApply,viewDistrict});
