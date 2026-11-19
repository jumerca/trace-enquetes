
/* Rugby Manager 27 — Édition Jouable 1.4
   Représentation TV tactique 2D. Aucun changement au calcul des scores / finances.
   30 identités graphiques persistantes, placement sans empilement, animations
   de passes/pied/contact, caméra de suivi et lisibilité téléphone.
 */
'use strict';
const RM14_W=1100, RM14_H=545;
const rm14X=x=>75+(x+10)*7.85, rm14Y=y=>84+y*5.45;
const rm14Ease=t=>t*t*(3-2*t);
const rm14Now=()=>performance.now();
const rm14Dist=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const rm14Lerp=(a,b,t)=>a+(b-a)*t;
function rm14Mix(a,b,t){return{x:rm14Lerp(a.x,b.x,t),y:rm14Lerp(a.y,b.y,t)}}
function rm14ClampPoint(p){return{x:rmClamp(p.x,2,98),y:rmClamp(p.y,3,67)}}
function rm14SeedPoint(g,s,i){return rm14Position(g,s,i,g.ball,g.poss,g.phase)}
function rm14Position(g,s,i,ball,poss,phase){
 const attack=s===poss,dir=rmDirection(g,poss),by=ball.y,bx=ball.x;
 // Organisation type 1-3-3-1 / couverture 14+1. Les 3/4 restent en éventail.
 // Répartition près des en-buts, y compris lorsque 30 joueurs tiennent dans les 22 m.
 let dx=0,dy=0;
 if(phase==='Mêlée'&&i<8){
   dx=(attack?-1:1)*(1.6+(i%3)*1.65);dy=[-6,-3,0,3,6,-4,0,4][i];
 }else if(phase==='Touche'&&i<8){
   dx=(attack?-1:1)*(2.0+Math.floor(i/4)*2.5);dy=(by<35?1:-1)*([1,4,7,10,13,16,19,22][i]);
 }else if(attack){
   const forwards=[[-3,-13],[-4,-8],[-7,-3],[-3,3],[-6,8],[-8,-17],[-10,1],[-10,14]];
   const backs=[[-3,3],[-10,-11],[-18,-25],[-15,-5],[-19,8],[-17,26],[-34,0]];
   [dx,dy]=i<8?forwards[i]:backs[i-8];
   if(i>=9)dy=35+dy+(.28*(by-35))-by;
   // En attaque large, la ligne se déploie dans la direction de la touche libre.
   if(g.tactics?.attack==='Au large'&&i>=9&&i<=13)dy*=1.16;
 }else{
   const pack=[[5,-20],[5,-13],[4,-6],[4,1],[5,8],[6,15],[7,22],[8,-27]];
   const backs=[[9,-4],[11,-25],[13,-12],[12,1],[15,14],[14,27],[28,0]];
   [dx,dy]=i<8?pack[i]:backs[i-8];
   // Défense collective : couvre la largeur, sans 15 joueurs au même endroit.
   dy=35+dy+(by-35)*.20-by;
   const remaining=dir>0?100-bx:bx;
   if(remaining<18){
    // Dans les 22 m, 15 défenseurs repliés le long de l'en-but.
    // Chaque couloir possède une place propre, y compris sous forte pression.
    dx=Math.min(remaining-1,2.8+((i%3)*1.7));
    dy=(4.7+i*4.3)-by;
   }
   if(g.tactics?.defense==='Montée agressive')dx=Math.max(3,dx-2);
 }
 // Déport : on préserve une défense en avant du ballon même proche de la ligne.
 // Un joueur trop près de la touche s'étale en profondeur au lieu de se superposer.
 const x=rmClamp(bx+dir*dx,2.5,97.5);
 const rawY=by+dy+(by<16?Math.max(0,16-by)*.27:by>54?-Math.max(0,by-54)*.27:0);
 const y=rmClamp(rawY,4,66);
 return{x,y};
}
function rm14Spread(pts){
 // Relaxation de la formation, pas de joueurs identiques au même point, tout en
 // respectant les lignes de défense / le couloir latéral.
 for(let k=0;k<8;k++){
  for(let s=0;s<2;s++)for(let i=0;i<15;i++){
   const p=pts[s][i];
   for(let j=i+1;j<15;j++){
    const q=pts[s][j];let dx=p.x-q.x,dy=p.y-q.y;
    let d=Math.hypot(dx,dy);
    const minD=(i<8&&j<8)?3.3:3.6;
    if(d<minD){if(d<.01){dx=((i*13+j*3)%7-3)*.23+.2;dy=((i*5+j*7)%7-3)*.3+.3;d=Math.hypot(dx,dy)}
     const push=(minD-d)/Math.max(.01,d)*.52;
     p.x=rmClamp(p.x+dx*push,2.7,97.3);p.y=rmClamp(p.y+dy*push,3.5,66.5);
     q.x=rmClamp(q.x-dx*push,2.7,97.3);q.y=rmClamp(q.y-dy*push,3.5,66.5);
    }
   }
  }
 }
 return pts;
}
function rm14Targets(g){return rm14Spread(Array.from({length:2},(_,s)=>Array.from({length:15},(_,i)=>rm14SeedPoint(g,s,i))))}
function rm14Setup(g){
 if(!g.rm14){g.rm14={positions:rm14Targets(g),animation:null,ball:{...g.ball},cam:null};}
 if(!Array.isArray(g.rm14.positions)||g.rm14.positions.length!==2||g.rm14.positions.some(x=>!Array.isArray(x)||x.length!==15)){
  g.rm14.positions=rm14Targets(g);g.rm14.animation=null;
 }
 return g.rm14;
}
function rm14AnimProgress(a){if(!a)return 1;return rmClamp((rm14Now()-a.started)/Math.max(100,a.duration),0,1)}
function rm14PositionsAt(g){
 const v=rm14Setup(g),a=v.animation;
 if(!a)return v.positions;
 const t=rm14Ease(rm14AnimProgress(a));
 return a.from.map((row,s)=>row.map((p,i)=>rm14Mix(p,a.to[s][i],t)));
}
function rm14BallAt(g){
 const v=rm14Setup(g),a=v.animation;if(!a)return{x:g.ball.x,y:g.ball.y,h:0,trail:[]};
 const t=rm14AnimProgress(a),b=a.oldBall,e=a.newBall;
 if(t>=1)return{x:e.x,y:e.y,h:0,trail:[]};
 // Toute animation a une trajectoire déterminée à l'entrée de la séquence.
 // Passe : une distribution en relais. Coup de pied : parabole lisible.
 if(a.kind==='kick'){
  const tt=rm14Ease(t);
  return{x:rm14Lerp(b.x,e.x,tt),y:rm14Lerp(b.y,e.y,tt),h:Math.sin(t*Math.PI)*54,trail:[]};
 }
 if(a.kind==='pass'){
  const way=a.way,sections=way.length-1,index=Math.min(sections-1,Math.floor(t*sections));
  const st=rm14Ease(t*sections-index),p=rm14Mix(way[index],way[index+1],st);
  return{x:p.x,y:p.y,h:Math.sin(st*Math.PI)*13,trail:[]};
 }
 return{x:rm14Lerp(b.x,e.x,rm14Ease(t)),y:rm14Lerp(b.y,e.y,rm14Ease(t)),h:Math.sin(t*Math.PI)*6,trail:[]};
}
function rm14StartAction(g,old,prev){
 if(g.fast)return;
 const v=rm14Setup(g);
 const prior=prev||rm14PositionsAt(g),desired=rm14Targets(g),kicking=(g.stats?.kicks||0)>(old.kicks||0),phase=g.phase;
 const action= kicking?'kick':phase==='Mêlée'?'scrum':phase==='Touche'?'lineout':phase==='Ruck'?'ruck':phase==='Maul'?'maul':phase==='Turnover'?'turnover':(g.stats?.passes||0)>(old.passes||0)?'pass':'run';
 const duration=rm14Duration(g.speed);
 const atMost= action==='kick'?17:action==='scrum'||action==='lineout'?11:15;
 const to=desired.map((row,s)=>row.map((p,i)=>{
  const src=prior[s][i],dx=p.x-src.x,dy=p.y-src.y,d=Math.hypot(dx,dy);
  return d>atMost?rm14ClampPoint({x:src.x+dx/d*atMost,y:src.y+dy/d*atMost}):p;
 }));
 // Conserver un espace vital entre joueurs même lorsque la possession bascule.
 rm14Spread(to);
 const dir=rmDirection(g,old.poss),by=old.ball.y,ex=g.ball.x,ey=g.ball.y;
 let way=[{...old.ball},{...g.ball}];
 if(action==='pass'&&old.poss===g.poss){
  const count=Math.min(3,Math.max(2,Math.floor(((g.stats?.passes||0)-(old.passes||0))/1.8)+1));
  way=[{...old.ball}];
  for(let j=1;j<count;j++){
   const u=j/count;
   way.push({x:rmClamp(rm14Lerp(old.ball.x,ex,u)-dir*Math.sin(Math.PI*u)*4,2,98),
             y:rmClamp(rm14Lerp(by,ey,u)+Math.sin(Math.PI*2*u)*(4+(j%2)*3),4,66)});
  }
  way.push({x:ex,y:ey});
 }
 const start=rm14Now();
 v.positions=to;v.ball={...g.ball};
 v.animation={started:start,duration,oldBall:{...old.ball},newBall:{...g.ball},kind:action,from:prior,to,way,phase,poss:g.poss};
}
function rm14Duration(speed){return 2350/Math.max(1,Number(speed)||1)**.84}
// Le moteur 1.3 décide des résultats, la 1.4 prépare le mouvement à partir de ces décisions.
const rm14OriginalStep=rmSimStep;
rmSimStep=function(g){
 if(g.done||g.pendingPenalty)return rm14OriginalStep(g);
 const old={ball:{...g.ball},poss:g.poss,passes:g.stats?.passes||0,kicks:g.stats?.kicks||0};
 // Si on réclame une autre action avant la fin du mouvement précédent,
 // l'état logique précédent est déjà arrivé à destination. On évite ainsi
 // des joueurs bloqués cinquante mètres derrière le ballon.
 const vis=g.fast?null:rm14Setup(g);
 const pre=g.fast?null:(vis.animation&&rm14AnimProgress(vis.animation)<.83?vis.positions:rm14PositionsAt(g)).map(row=>row.map(p=>({...p})));
 const result=rm14OriginalStep(g);
 if(!g.fast)rm14StartAction(g,old,pre);
 return result;
};
// L'accélération conserve la distinction entre suivi visuel et simulation instantanée.
rmStartTimer=function(){
 rmStopTimer();if(!rmSimple||rmSimple.done)return;
 const tick=()=>{if(!rmSimple||rmSimple.paused||rmSimple.done){rmStopTimer();return}rmSimStep(rmSimple);rmStore();rmDrawEverything();};
 rmSimpleTimer=setInterval(tick,rm14Duration(rmSimple.speed)+90);
 rmDrawEverything();
};
function rm14Color(raw){
 let color=String(raw||'#e5edf3');if(!/^#[a-fA-F0-9]{6}$/.test(color))color='#e5edf3';return color;
}
function rm14Player(ctx,p,side,index,teamColor,carrier,dir,moving,t,follow){
 const x=rm14X(p.x),y=rm14Y(p.y);
 const speed=Math.sin(t/130+index*1.8+side*1.2),stride=speed*moving;
 const a=side===0?'#71e7ff':'#ffb578';
 const base=rm14Color(teamColor);
 ctx.save();ctx.translate(x,y);ctx.rotate(dir>0?Math.PI/2:-Math.PI/2);
 // ombre indépendante et chaussures animées; corps orienté dans l'axe du terrain.
 ctx.fillStyle='#04180e78';ctx.beginPath();ctx.ellipse(2,5,11,15,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#202a2f';ctx.lineWidth=4.4;ctx.lineCap='round';
 ctx.beginPath();ctx.moveTo(-4,4);ctx.lineTo(-4+stride*2.2,13);ctx.moveTo(4,4);ctx.lineTo(4-stride*2.2,13);ctx.stroke();
 ctx.fillStyle='#f9fcff';ctx.beginPath();ctx.ellipse(-4+stride*2.2,14,2.7,3.6,0,0,Math.PI*2);ctx.ellipse(4-stride*2.2,14,2.7,3.6,0,0,Math.PI*2);ctx.fill();
 // bras et maillot bipartite, épaules, col, manches, numéro visible au zoom.
 ctx.strokeStyle='#d6a889';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-8,-6);ctx.lineTo(-12-stride,2);ctx.moveTo(8,-6);ctx.lineTo(12+stride,2);ctx.stroke();
 ctx.fillStyle=base;ctx.strokeStyle=a;ctx.lineWidth=2;
 ctx.beginPath();ctx.moveTo(-8,-10);ctx.quadraticCurveTo(-12,-2,-9,7);ctx.quadraticCurveTo(0,12,9,7);ctx.quadraticCurveTo(12,-2,8,-10);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.strokeStyle=side===0?'#55d7f7':'#fdb47a';ctx.lineWidth=3.1;ctx.beginPath();ctx.moveTo(-7,-5);ctx.lineTo(7,-5);ctx.stroke();
 ctx.fillStyle=side===0?'#55d7f7':'#fdb47a';ctx.fillRect(-8,-9,3,7);ctx.fillRect(5,-9,3,7);
 ctx.fillStyle='#dfa97f';ctx.beginPath();ctx.arc(0,-12,5.0,0,Math.PI*2);ctx.fill();
 ctx.fillStyle='#19242b';ctx.beginPath();ctx.arc(0,-14.5,5,Math.PI*1.13,Math.PI*1.98);ctx.lineTo(4,-12);ctx.closePath();ctx.fill();
 ctx.rotate(dir>0?-Math.PI/2:Math.PI/2);
 if(follow||carrier){ctx.font='800 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.strokeStyle='#0b1521';ctx.lineWidth=2.4;ctx.strokeText(String(index+1),0,0);ctx.fillStyle='#fff';ctx.fillText(String(index+1),0,0)}
 if(carrier){ctx.strokeStyle='#f6d66c';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();}
 ctx.restore();
}
function rm14Stadium(ctx,W,H){
 ctx.fillStyle='#0b1824';ctx.fillRect(0,0,W,H);
 // Tribunes avec profondeur, marches, tunnel et public non aléatoire à chaque frame.
 const bands=[[6,78],[468,72]];
 for(const [y,h] of bands){
  const grad=ctx.createLinearGradient(0,y,0,y+h);grad.addColorStop(0,'#142534');grad.addColorStop(.5,'#30445a');grad.addColorStop(1,'#0b1825');ctx.fillStyle=grad;ctx.fillRect(18,y,W-36,h);
  for(let row=0;row<4;row++){
   const yy=y+10+row*13;
   for(let c=0;c<105;c++){
    const xx=30+c*10;if((c+row*9)%43===0)continue;
    const z=(c*37+row*17)%23;ctx.fillStyle=['#8db0af','#d2b49d','#dce8ec','#416779','#a18471','#d4b761'][z%6];
    ctx.beginPath();ctx.arc(xx,yy,2.25,0,Math.PI*2);ctx.fill();
   }
  }
  ctx.fillStyle='#071420';ctx.fillRect(520,y,56,h);ctx.fillStyle='#192e3b';ctx.fillRect(531,y,34,h);
 }
 // Bandes publicitaires au ras du terrain.
 for(const y of [78,466]){
  ctx.fillStyle='#08131a';ctx.fillRect(36,y,W-72,8);
  ctx.fillStyle='#57c6b5';for(let j=0;j<19;j++){ctx.fillRect(58+j*54,y+2,26,2)}
 }
}
function rm14Pitch(ctx){
 const L=rm14X(-10),R=rm14X(110),T=rm14Y(0),B=rm14Y(70);
 const turf=ctx.createLinearGradient(0,T,0,B);turf.addColorStop(0,'#1b6750');turf.addColorStop(.5,'#1c8256');turf.addColorStop(1,'#13563f');
 ctx.fillStyle=turf;ctx.fillRect(L,T,R-L,B-T);
 for(let k=0;k<12;k++){ctx.fillStyle=k%2===0?'#ffffff0d':'#001c100a';ctx.fillRect(L+k*(R-L)/12,T,(R-L)/12,B-T)}
 ctx.fillStyle='#0c745f';ctx.fillRect(L,T,rm14X(0)-L,B-T);ctx.fillRect(rm14X(100),T,R-rm14X(100),B-T);
 ctx.strokeStyle='#eff7eac9';ctx.lineWidth=2;ctx.strokeRect(L,T,R-L,B-T);
 for(const m of [0,22,50,78,100]){ctx.lineWidth=m===0||m===100?2.7:1.7;ctx.strokeStyle='#e4fff1ce';ctx.beginPath();ctx.moveTo(rm14X(m),T);ctx.lineTo(rm14X(m),B);ctx.stroke()}
 ctx.setLineDash([6,8]);ctx.lineWidth=1.3;for(const m of [10,90]){ctx.beginPath();ctx.moveTo(rm14X(m),T);ctx.lineTo(rm14X(m),B);ctx.stroke()}ctx.setLineDash([]);
 ctx.fillStyle='#eafef4c4';for(const x of [5,22,40,60,78,95])for(const y of [5,15,55,65])ctx.fillRect(rm14X(x)-1.2,rm14Y(y)-3.8,2.4,7.6);
 // Peinture d'en-but, logos fictifs et marquages côté télévision.
 ctx.save();ctx.textAlign='center';ctx.fillStyle='#f0fff483';ctx.font='800 24px system-ui';
 ctx.translate(rm14X(-5),rm14Y(35));ctx.rotate(-Math.PI/2);ctx.fillText('RUGBY 27',0,0);ctx.restore();
 ctx.save();ctx.textAlign='center';ctx.fillStyle='#f0fff483';ctx.font='800 24px system-ui';
 ctx.translate(rm14X(105),rm14Y(35));ctx.rotate(Math.PI/2);ctx.fillText('RUGBY 27',0,0);ctx.restore();
 ctx.fillStyle='#f7fff9ba';ctx.font='800 18px system-ui';ctx.textAlign='center';for(const m of [22,50,78])ctx.fillText(m===50?'50':'22',rm14X(m),T+24);
 // Poteaux et ombres : repères d'en-but sans masquer les actions.
 for(const m of [0,100]){
  const x=rm14X(m),y=rm14Y(35);ctx.strokeStyle='#091b2188';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+3,y-24);ctx.lineTo(x+3,y+24);ctx.stroke();
  ctx.strokeStyle='#f5e1ad';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-19);ctx.lineTo(x,y+19);ctx.moveTo(x-5,y-19);ctx.lineTo(x+5,y-19);ctx.moveTo(x-5,y+19);ctx.lineTo(x+5,y+19);ctx.stroke();
 }
 for(const [x,y] of [[-10,0],[-10,70],[110,0],[110,70]]){
  ctx.strokeStyle='#ebf4f6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rm14X(x),rm14Y(y));ctx.lineTo(rm14X(x),rm14Y(y)-9);ctx.stroke();
  ctx.fillStyle='#eacb57';ctx.beginPath();ctx.moveTo(rm14X(x),rm14Y(y)-9);ctx.lineTo(rm14X(x)+8,rm14Y(y)-5);ctx.lineTo(rm14X(x),rm14Y(y)-3);ctx.fill();
 }
}
function rm14PhaseOverlay(ctx,g,progress,ball){
 const phase=g.phase;
 const x=rm14X(ball.x),y=rm14Y(ball.y);
 ctx.save();
 if(['Ruck','Maul','Mêlée','Touche','Turnover'].includes(phase)){
  const text=phase==='Mêlée'?'MÊLÉE':phase==='Touche'?'TOUCHE':phase==='Turnover'?'BALLON RÉCUPÉRÉ':phase.toUpperCase();
  const alpha=progress<.8?.75:Math.max(.1,(1-progress)*3);
  ctx.globalAlpha=alpha;ctx.fillStyle='#0a1d2ddc';ctx.strokeStyle='#a0e0d0aa';ctx.lineWidth=1;
  const w=ctx.measureText(text).width+36,cy=rmClamp(y-39,116,433);
  ctx.beginPath();ctx.roundRect(x-w/2,cy-19,w,25,6);ctx.fill();ctx.stroke();
  ctx.fillStyle='#f4fff4';ctx.font='700 12px system-ui';ctx.textAlign='center';ctx.fillText(text,x,cy-2);
  if(phase==='Ruck'||phase==='Maul'){ctx.strokeStyle='#f3d77aa9';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,25+4*Math.sin(progress*Math.PI),0,Math.PI*2);ctx.stroke()}
 }
 ctx.restore();
}
function rm14DrawBall(ctx,p){
 const x=rm14X(p.x),y=rm14Y(p.y);
 ctx.save();ctx.fillStyle='#02130b70';ctx.beginPath();ctx.ellipse(x,y+5,8+Math.max(0,p.h)*.05,4,0,0,Math.PI*2);ctx.fill();
 ctx.translate(x,y-p.h);ctx.rotate(-.24);ctx.fillStyle='#f5e7c5';ctx.strokeStyle='#3b2722';ctx.lineWidth=1.2;ctx.beginPath();ctx.ellipse(0,0,8.5,5.2,0,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.strokeStyle='#633a2b';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-3,-2);ctx.lineTo(3,2);ctx.stroke();ctx.restore();
}
function rm14DrawBallRoute(ctx,g,p,progress){
 const a=rm14Setup(g).animation;if(!a||progress>=1||progress<.04)return;
 ctx.save();ctx.strokeStyle=a.kind==='kick'?'#ffe2a8aa':'#ecfefa83';ctx.lineWidth=a.kind==='kick'?2.5:1.9;ctx.setLineDash(a.kind==='kick'?[7,10]:[4,8]);ctx.beginPath();
 const points=a.kind==='pass'?a.way:[a.oldBall,{x:rm14Lerp(a.oldBall.x,a.newBall.x,.5),y:rm14Lerp(a.oldBall.y,a.newBall.y,.5)-5},a.newBall];
 points.forEach((v,i)=>i?ctx.lineTo(rm14X(v.x),rm14Y(v.y)):ctx.moveTo(rm14X(v.x),rm14Y(v.y)));
 ctx.stroke();ctx.setLineDash([]);ctx.restore();
}
function rm14Scene(g){
 const canvas=document.getElementById('rmcanvas');if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 if(canvas.width!==RM14_W||canvas.height!==RM14_H){canvas.width=RM14_W;canvas.height=RM14_H}
 const v=rm14Setup(g),a=v.animation,progress=rm14AnimProgress(a),p=rm14BallAt(g),positions=rm14PositionsAt(g),time=rm14Now();
 ctx.clearRect(0,0,RM14_W,RM14_H);rm14Stadium(ctx,RM14_W,RM14_H);rm14Pitch(ctx);
 // Un couloir d'attaque très subtil, direction de déplacement non ambiguë.
 const direction=rmDirection(g,g.poss);
 ctx.fillStyle='#daffe33d';ctx.font='600 13px system-ui';ctx.textAlign='right';
 ctx.fillText(direction>0?'ATTAQUE →':'← ATTAQUE',rm14X(97),rm14Y(67.2));
 // La bonne équipe doit être au-dessus lorsqu'il existe un duel rapproché.
 for(const s of [1-g.poss,g.poss]){
  const c=club(s===0?g.home:g.away),color=c?.color|| (s===0?'#d6ecf0':'#cf594b');
  const dir=rmDirection(g,s),carrier=g.matchModel?.carrier?.[s]??9;
  for(let i=0;i<15;i++){
   const pos=positions[s][i];
   const source=a?.from?.[s]?.[i]||pos;
   const target=a?.to?.[s]?.[i]||pos;
   const moving=a&&progress<1&&rm14Dist(source,target)>1.5?1:0;
   const nearBall=rm14Dist(pos,p)<13;
   rm14Player(ctx,pos,s,i,color,s===g.poss&&i===carrier&&nearBall,dir,moving,time,g.rmCamera==='follow'&&nearBall);
  }
 }
 rm14DrawBallRoute(ctx,g,p,progress);rm14DrawBall(ctx,p);rm14PhaseOverlay(ctx,g,progress,p);
 // Petit repère du ballon conservé dans les moments de contact dense.
 ctx.strokeStyle='#ffeab082';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(rm14X(p.x),rm14Y(p.y),16,0,Math.PI*2);ctx.stroke();
 ctx.fillStyle='#d4e9ea';ctx.font='700 12px system-ui';ctx.textAlign='left';
 ctx.fillText(`${club(g.home).name}  ·  ${club(g.away).name}`,76,527);
 ctx.fillStyle='#93d5c5';ctx.textAlign='right';ctx.fillText('2D TV · formation / possession / continuité',1035,527);
 if(g.rmCamera==='follow')rm14FollowCamera(g,p);
}
function rm14FollowCamera(g,ball){
 const viewport=document.querySelector('.rm13-viewport'),canvas=document.getElementById('rmcanvas');if(!viewport||!canvas)return;
 if(g.rmCamera!=='follow')return;
 const isMobile=window.innerWidth<=760, width=viewport.clientWidth;
 const zoom=isMobile?2.32:1.56,total=width*zoom;
 if(!Number.isFinite(total)||total<=0)return;
 if(canvas.style.width!==Math.round(total)+'px'){canvas.style.width=Math.round(total)+'px';canvas.style.maxWidth='none'}
 // Anticipation d'environ 5m en attaque; amène le soutien dans la même scène.
 const dir=rmDirection(g,g.poss),focus=rm14X(rmClamp(ball.x+dir*4,6,94))/RM14_W*total;
 const offset=Math.round(rmClamp(width*.52-focus,width-total,0));
 canvas.style.marginLeft=offset+'px';
}
const rm14OldApplyCamera=rm13ApplyCamera;
rm13ApplyCamera=function(g){
 if(!g.rmCamera)g.rmCamera=window.innerWidth<=760?'follow':'full';
 const viewport=document.querySelector('.rm13-viewport'),canvas=document.getElementById('rmcanvas');
 if(!viewport||!canvas)return;
 if(g.rmCamera==='follow'){rm14FollowCamera(g,rm14BallAt(g));}
 else {canvas.style.width='100%';canvas.style.maxWidth='none';canvas.style.marginLeft='0px';}
 const btn=document.getElementById('rm13Camera');if(btn)btn.textContent=g.rmCamera==='follow'?'▦ Voir tout le terrain':'🎥 Suivre l’action';
};
// En permanence 30 fps plafonnés, aucune animation 2D n'est dépendante du nombre de calculs de score.
rmDrawPitch=rm14Scene;
rmLoopAnimation=function(){
 if(!document.getElementById('rmcanvas')||!rmSimple){rmSimpleRAF=null;return;}
 const now=rm14Now();if(!window.rm14LastFrame||now-window.rm14LastFrame>=30){window.rm14LastFrame=now;rm14Scene(rmSimple)}
 rmSimpleRAF=requestAnimationFrame(rmLoopAnimation);
};
const rm14OldMatchMarkup=rmSimpleMarkup;
rmSimpleMarkup=function(g){
 let html=rm14OldMatchMarkup(g);
 html=html.replace('Match 2D · continuité','Match 2D · Vue TV tactique');
 html=html.replace('Moteur de phases tactiques avec soutien, conquête, grattages, territoire et mouvements continus de 30 joueurs entre les décisions ; pas de simulation biomécanique ni de physique individuelle.',
 'Vue TV 2D : 30 silhouettes suivies, soutien et lignes défensives, phases de passes, plaquages et rucks illustrés. Le moteur reste une simulation événementielle ; ce rendu ne prétend pas reproduire une physique professionnelle.');
 return html;
};
window.RM27_VISUAL_14={version:'1.4-tv',draw:rm14Scene,target:rm14Targets,positions:rm14PositionsAt,ball:rm14BallAt,step:rmSimStep};

