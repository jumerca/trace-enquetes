const {RM2,match}=require('./load_engine');
const n=+process.argv[2]||4,seed0=+process.argv[3]||1;
const keys=['pts','tries','rucks','tackles','missed','passes','kicks','lineouts','scrums','mauls','penC','turnovers','breaks','offloads','knock','yc','metres'];
const tot={};let bip=0;
for(let s=seed0;s<seed0+n;s++){
 const t0=Date.now();const M=match(s);let live=0,steps=0;
 while(!M.done&&steps<120000){RM2.step(M,RM2.DT);steps++;if(M.live)live+=RM2.DT}
 const row={seed:s,ms:Date.now()-t0,score:M.score.join('-'),tries:M.tries.join('-'),clock:Math.round(M.clock/60),bip:(live/60).toFixed(1),steps};
 for(const k of keys){const v=M.st[0][k]+M.st[1][k];row[k]=Math.round(v);tot[k]=(tot[k]||0)+v}
 bip+=live/60;console.log(JSON.stringify(row));
}
const avg={};for(const k of keys)avg[k]=+(tot[k]/n).toFixed(1);avg.bip=+(bip/n).toFixed(1);console.log('MOYENNE',JSON.stringify(avg));
