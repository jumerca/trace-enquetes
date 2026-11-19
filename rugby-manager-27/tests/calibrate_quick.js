// Compare le modèle rapide (matchs IA) au moteur complet sur les mêmes écarts de niveau.
const {RM2,team,match}=require('./load_engine');
const fs=require('fs');const vm=require('vm');
const n=+process.argv[2]||6;const rows=[];
for(const gap of [0,8]){let e={pts:0,tries:0,wins:0},q={pts:0,tries:0,wins:0};
 for(let s=0;s<n;s++){const M=match(500+s+gap*10,team('A',74+gap/2),team('B',74-gap/2));RM2.runToEnd(M);e.pts+=M.score[0]+M.score[1];e.tries+=M.tries[0]+M.tries[1];e.wins+=M.score[0]>M.score[1]?1:0}
 const Nq=2000;for(let s=0;s<Nq;s++){const r=RM2.quickResult(9000+s,74+gap/2-1.6,74-gap/2);q.pts+=r.home+r.away;q.tries+=r.homeTries+r.awayTries;q.wins+=r.home>r.away?1:0}
 rows.push({ecart:gap,moteur:{points:+(e.pts/n).toFixed(1),essais:+(e.tries/n).toFixed(1),victoiresFavori:+(e.wins/n).toFixed(2)},modeleRapide:{points:+(q.pts/Nq).toFixed(1),essais:+(q.tries/Nq).toFixed(1),victoiresFavori:+(q.wins/Nq).toFixed(2)}})}
console.log(JSON.stringify(rows,null,1));
