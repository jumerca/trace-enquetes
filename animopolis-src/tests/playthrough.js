// Rejoue Animopolis de zéro à la fin : résout toutes les étapes de toutes les enquêtes,
// dans l'ordre d'ouverture, et vérifie quartiers, indices de l'Ombre et enquête finale.
//   npm i playwright            (une fois, hors dépôt)
//   node tests/playthrough.js                       -> teste ../animopolis/index.html
//   ANIMOPOLIS_URL=https://.../animopolis/ node tests/playthrough.js
const {chromium,devices}=require('playwright');
const path=require('path');
const URL=process.env.ANIMOPOLIS_URL?process.env.ANIMOPOLIS_URL.replace(/\/?$/,'/')+'?nohome':'file://'+path.resolve(__dirname,'../../animopolis/index.html')+'?nohome';
(async()=>{
  const b=await chromium.launch(),ctx=await b.newContext({...devices['Pixel 7']}),p=await ctx.newPage();
  const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL);await p.waitForTimeout(1500);await p.click('#ok');
  const res=await p.evaluate(()=>{
    const a=window.__animopolis,order=[];let guard=0;
    const hide=()=>document.getElementById('modal').classList.add('hidden');
    for(;;){
      const cs=CASES.find(c=>caseOpen(c)&&!caseDone(c));if(!cs||++guard>60)break;
      a.state.current=cs.id;order.push(cs.id);
      cs.steps.forEach((s,k)=>{if((a.state.solved[cs.id]||[])[k])return;if(s.choice)answerChoice(cs,k,s.ans);else if(s.ts)s.ts.forEach(q=>a.onTap(q.x,q.y));else a.onTap(s.t.x,s.t.y);});
      hide();
    }
    return{order,districts:DISTRICTS.map((d,i)=>a.unlocked(i)),clues:cluesFound(),finalDone:caseDone(CASES.find(c=>c.final)),
      steps:CASES.reduce((n,c)=>n+c.steps.length,0),cases:CASES.length,notDone:CASES.filter(c=>!caseDone(c)).map(c=>c.id)};
  });
  await b.close();
  const ok=res.districts.every(Boolean)&&res.clues===5&&res.finalDone&&!res.notDone.length&&!errs.length;
  console.log(`${res.cases} enquêtes, ${res.steps} étapes, quartiers ouverts : ${res.districts.filter(Boolean).length}/${res.districts.length}, indices : ${res.clues}/5, finale : ${res.finalDone}`);
  if(errs.length)console.log('Erreurs :',errs);
  console.log(ok?'OK':'ÉCHEC');process.exit(ok?0:1);
})();
