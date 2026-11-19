// Décisions du capitaine sur pénalité dans des situations de match typiques.
const {RM2,match}=require('./load_engine');
const cases=[];
function scen(label,{r,y=35,clock,score,tries,rule='ecart3'}){const M=match(7);M.bonusRule=rule;M.clock=clock;M.half=clock>2400?2:1;M.score=score;M.tries=tries;M.st[0].tries=tries[0];RM2.mindset(M);
 const x=RM2.X(M,0,r);const out={};for(let i=0;i<40;i++){const d=RM2.aiPenaltyWhy(M,0,x,y,false);out[d.opt]=(out[d.opt]||0)+1;out.why=d.why}cases.push({situation:label,etat:M.T[0].mind,...out})}
scen('2 m de la ligne, 1 essai pour le bonus (Top 14 : +3 essais)',{r:98,clock:3600,score:[24,10],tries:[3,1]});
scen('2 m de la ligne, début de match',{r:98,clock:600,score:[0,0],tries:[0,0]});
scen('5 m, mené de 2 à la 78e',{r:95,clock:4680,score:[18,20],tries:[2,2]});
scen('40 m face aux poteaux, mené de 5 à la 79e',{r:60,clock:4740,score:[15,20],tries:[2,2]});
scen('35 m, mené de 9 à la 72e (bonus défensif)',{r:65,clock:4320,score:[11,20],tries:[1,2]});
scen('30 m en coin, match nul 50e',{r:70,y:8,clock:3000,score:[10,10],tries:[1,1]});
scen('Propre camp (35 m de son en-but)',{r:35,clock:1500,score:[3,0],tries:[0,0]});
console.log(JSON.stringify(cases,null,1));
