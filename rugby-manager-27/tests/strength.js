// Vérifie que la force des équipes influence les résultats sans les rendre certains.
const {RM2,team,match}=require('./load_engine');
const n=+process.argv[2]||8;let w=0,d=0,pts=[0,0],tries=[0,0];
for(let s=100;s<100+n;s++){const M=match(s,team('Fort',+process.argv[3]||80),team('Faible',+process.argv[4]||72));RM2.runToEnd(M);
 if(M.score[0]>M.score[1])w++;else if(M.score[0]===M.score[1])d++;pts[0]+=M.score[0];pts[1]+=M.score[1];tries[0]+=M.tries[0];tries[1]+=M.tries[1];
 console.log(s,M.score.join('-'),M.tries.join('-'))}
console.log('Victoires du fort',w,'/',n,'nuls',d,'points moy',pts.map(x=>(x/n).toFixed(1)),'essais',tries.map(x=>(x/n).toFixed(1)));
