// Effet de la météo et du plan de jeu sur le match (mêmes graines, conditions différentes).
const {RM2,team,match}=require('./load_engine');
const N=+process.argv[2]||6;const out=[];
const conds=[['Sec, sans vent',{kind:'clear',wind:0,rain:0},'auto'],['Pluie forte',{kind:'rain',wind:0,rain:1},'auto'],['Vent fort, plan « vent »',{kind:'wind',wind:10,rain:0},'vent'],['Sec, plan « jeu au pied »',{kind:'clear',wind:0,rain:0},'pied'],['Sec, plan « jeu à la main »',{kind:'clear',wind:0,rain:0},'main']];
for(const [label,w,plan] of conds){const acc={points:0,essais:0,enAvant:0,jeuxAuPied:0,passes:0,touches:0};
 for(let s=0;s<N;s++){const M=match(700+s,team('A',77,{plan}),team('B',76,{plan}));M.weather=w;RM2.runToEnd(M);
  acc.points+=M.score[0]+M.score[1];acc.essais+=M.tries[0]+M.tries[1];acc.enAvant+=M.st[0].knock+M.st[1].knock;acc.jeuxAuPied+=M.st[0].kicks+M.st[1].kicks;acc.passes+=M.st[0].passes+M.st[1].passes;acc.touches+=M.st[0].lineouts+M.st[1].lineouts}
 for(const k in acc)acc[k]=+(acc[k]/N).toFixed(1);out.push({condition:label,...acc})}
console.log(JSON.stringify(out,null,1));
