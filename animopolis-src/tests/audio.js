// Vérifie la synthèse sonore SANS carte son : chaque effet et chaque thème de musique est rendu
// hors ligne (OfflineAudioContext) et on contrôle qu'il n'est ni muet ni saturé.
//   node tests/audio.js          (ANIMOPOLIS_URL=… pour tester le site publié)
const {chromium}=require('playwright');const path=require('path');
const URL=process.env.ANIMOPOLIS_URL?process.env.ANIMOPOLIS_URL.replace(/\/?$/,'/')+'?nohome':'file://'+path.resolve(__dirname,'../../animopolis/index.html')+'?nohome';
(async()=>{const b=await chromium.launch(),p=await b.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL);await p.waitForTimeout(1500);
  const res=await p.evaluate(async()=>{const A=window.__animopolis,out={sfx:{},music:{}};
    const render=async(secs,fn)=>{const oc=new OfflineAudioContext(1,Math.floor(44100*secs),44100),g=oc.createGain();g.connect(oc.destination);fn(oc,g);const buf=await oc.startRendering(),d=buf.getChannelData(0);let s=0,pk=0;for(const v of d){s+=v*v;if(Math.abs(v)>pk)pk=Math.abs(v);}return{rms:+Math.sqrt(s/d.length).toFixed(4),peak:+pk.toFixed(3)};};
    for(const n of Object.keys(A.SFX))out.sfx[n]=await render(2.4,(c,g)=>A.SFX[n](c,g,.02,3));
    A.THEMES.forEach((th,i)=>{});
    for(let i=0;i<A.THEMES.length;i++){const th=A.THEMES[i];out.music[th.n]=await render(8,(c,g)=>{const st={rng:(()=>{let s=7+i;return()=>{s=(s*16807)%2147483647;return s/2147483647;};})(),mel:3};const dt=60/th.bpm/2;let t=.05,step=0,bar=0;while(t<7.8){A.scheduleStep(c,g,t,th,step,bar,st);t+=dt;step=(step+1)%8;if(step===0)bar++;}});}
    return out;});
  await b.close();let bad=[];
  for(const g of['sfx','music'])for(const[n,r]of Object.entries(res[g])){const ok=r.rms>.002&&r.peak<.95;console.log((ok?'OK ':'KO ')+g+' '+n.padEnd(8)+' rms '+r.rms+' pic '+r.peak);if(!ok)bad.push(n);}
  if(errs.length)console.log('Erreurs :',errs);
  console.log(bad.length||errs.length?'ÉCHEC':'OK');process.exit(bad.length||errs.length?1:0);})();
