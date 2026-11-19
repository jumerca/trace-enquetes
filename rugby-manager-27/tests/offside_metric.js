// Mesure le « mélange » des équipes : temps moyen passé par des joueurs du mauvais côté du ballon
// (attaquants devant le porteur/ruck, défenseurs devant la ligne de hors-jeu), et l'agitation (changements de cap inutiles).
const {RM2,team,match}=require('./load_engine');
const N=+process.argv[2]||3;let wrong=0,samples=0,jitter=0,moving=0,slowShuffle=0;
for(let s=0;s<N;s++){const M=match(900+s);const prevH=M.P.map(p=>p.hd);
 while(!M.done){if(M.pending)RM2.autoDecide(M);RM2.step(M,RM2.DT);
  if(M.phase==='ruck'||(M.phase==='play'&&RM2.carrier(M))){const bx=M.phase==='ruck'?M.ball.x:RM2.carrier(M).x;const att=M.phase==='ruck'?M.ruck.att:RM2.carrier(M).team;
   for(const p of M.P){if(!RM2.upright(M,p)||p.mode==='bound')continue;const ahead=RM2.R(M,att,p.x)-RM2.R(M,att,bx);
    if(p.team===att&&ahead>1.5&&!(RM2.carrier(M)===p))wrong++;if(p.team!==att&&M.phase==='ruck'&&ahead<-1.5)wrong++;samples++}}
  M.P.forEach((p,i)=>{const sp=Math.hypot(p.vx,p.vy);if(sp>.6){moving++;const d=Math.abs(Math.atan2(Math.sin(p.hd-prevH[i]),Math.cos(p.hd-prevH[i])));if(d>.35)jitter++}if(sp>.15&&sp<1.2)slowShuffle++;prevH[i]=p.hd});
 }}
console.log(JSON.stringify({hors_position_pct:+(wrong/samples*100).toFixed(2),virages_brusques_pour_mille:+(jitter/moving*1000).toFixed(2),pietinement_pct:+(slowShuffle/(moving+slowShuffle)*100).toFixed(1)}));
