/* RM27 1.5 - Animation broadcast 2D, sans changer la simulation, la gestion ou les sauvegardes.
   World units = rugby pitch metres. The renderer is deterministic apart from time-based
   interpolation; cached scene and no external images or dependencies. */
'use strict';
const RM15={width:1100,height:545,bg:null,camOffset:null,lastFrame:0,frameCount:0,failures:0,quality:'broadcast-2d'};
const rm15Bound=(v,a,b)=>Math.min(b,Math.max(a,v));
const rm15Linear=(a,b,t)=>a+(b-a)*t;
const rm15Ease=t=>{t=rm15Bound(t,0,1);return t*t*(3-2*t)};
const rm15Metric=(p,q)=>Math.hypot(p.x-q.x,p.y-q.y);
const rm15Smooth=(a,b,t)=>({x:rm15Linear(a.x,b.x,t),y:rm15Linear(a.y,b.y,t)});
const rm15Hash=(i,j)=>{let x=(i*2166136261+j*16777619)>>>0;x=Math.imul(x^(x>>>16),2246822519);x=Math.imul(x^(x>>>13),3266489917);return(x^(x>>>16))>>>0};
const rm15Color=(h,amount)=>{const s=String(h||'#38667d').match(/^#([0-9a-f]{6})$/i);if(!s)return'#f1f3ef';const rgb=[0,2,4].map(i=>parseInt(s[1].slice(i,i+2),16));return 'rgb('+rgb.map(v=>rm15Bound(Math.round(v+(amount>0?255-v:v)*amount),0,255)).join(',')+')'};
function rm15Layer(){
 const o=document.createElement('canvas');o.width=RM15.width;o.height=RM15.height;const c=o.getContext('2d');
 const W=RM15.width,H=RM15.height;
 c.fillStyle='#071523';c.fillRect(0,0,W,H);
 // Real stadium geometry: stands in tiers, vomitories, floodlight glow and advertising.
 for(const [start,end,flip] of [[0,82,1],[467,H,-1]]){
  const gr=c.createLinearGradient(0,start,0,end);gr.addColorStop(0,'#071725');gr.addColorStop(.55,'#1d3443');gr.addColorStop(1,'#11202e');c.fillStyle=gr;c.fillRect(0,start,W,end-start);
  for(let row=0;row<5;row++){
   const y=flip>0?12+row*12:H-13-row*12;
   c.fillStyle=(row%2===0?'#51677833':'#07162388');c.fillRect(18,y+6,W-36,2);
   for(let x=20;x<1080;x+=8){if((x>512&&x<572)||x%181<11)continue;
    const h=rm15Hash(x,row),cc=['#d3b894','#e5dece','#799bae','#83a8a0','#b9c2c6','#eac96d','#32566b'][h%7];
    c.fillStyle=cc;c.globalAlpha=.42+(h%15)*.028;c.beginPath();c.ellipse(x+(h%3),y,2,2.55,0,0,Math.PI*2);c.fill();
   }
  }
  c.globalAlpha=1;c.fillStyle='#081b29';c.fillRect(510,start,62,end-start);c.fillStyle='#162f3c';c.fillRect(522,start,37,end-start);
  for(const x of [120,970]){c.fillStyle='#6f8b8b18';c.beginPath();c.ellipse(x,flip>0?0:H,120,80,0,0,Math.PI*2);c.fill()}
 }
 const T=rm14Y(0),B=rm14Y(70),L=rm14X(-10),R=rm14X(110),width=R-L;
 c.fillStyle='#06131e';c.fillRect(48,76,1000,393);
 const turf=c.createLinearGradient(0,T,0,B);turf.addColorStop(0,'#237955');turf.addColorStop(.45,'#166949');turf.addColorStop(1,'#165f45');c.fillStyle=turf;c.fillRect(L,T,width,B-T);
 for(let i=0;i<12;i++){c.fillStyle=i%2?'#051e1414':'#b7edb308';c.fillRect(L+width*i/12,T,width/12,B-T)}
 // 460 fine grass strokes - completely cached, fixed positions at all frame rates.
 for(let k=0;k<750;k++){
  const h=rm15Hash(k,17),x=L+(h%998)/998*width,y=T+((rm15Hash(k,31)%1000)/1000)*(B-T);
  c.fillStyle=k%3===0?'#b5e4c80b':'#001f1511';c.fillRect(x,y,(h%5)*.32+.3,((h>>>4)%4)*.5+.3);
 }
 c.fillStyle='#19664d';c.fillRect(L,T,rm14X(0)-L,B-T);c.fillRect(rm14X(100),T,R-rm14X(100),B-T);
 c.save();c.strokeStyle='#e9f9ecde';c.lineWidth=1.9;c.strokeRect(L,T,width,B-T);
 for(const m of [0,22,50,78,100]){c.lineWidth=m===0||m===100?2.6:1.65;c.beginPath();c.moveTo(rm14X(m),T);c.lineTo(rm14X(m),B);c.stroke()}
 c.lineWidth=1.2;c.setLineDash([6,8]);for(const m of [10,90]){c.beginPath();c.moveTo(rm14X(m),T);c.lineTo(rm14X(m),B);c.stroke()}c.setLineDash([]);
 c.fillStyle='#edf8ebea';for(const x of [5,22,40,60,78,95])for(const y of [5,15,55,65]){c.fillRect(rm14X(x)-1,rm14Y(y)-3,2,6)}
 c.restore();
 c.fillStyle='#f0fff094';c.font='900 22px system-ui';c.textAlign='center';for(const m of [22,50,78])c.fillText(m===50?'50':'22',rm14X(m),T+28);
 for(const goal of [0,100]){const x=rm14X(goal),y=rm14Y(35);
  c.strokeStyle='#06191d96';c.lineWidth=7;c.beginPath();c.moveTo(x+7,y-15);c.lineTo(x+7,y+17);c.stroke();
  c.strokeStyle='#f5e1ab';c.lineWidth=3;c.beginPath();c.moveTo(x,y-15);c.lineTo(x,y+15);c.stroke();
  for(const py of [y-15,y+15]){c.fillStyle='#f5e1ab';c.beginPath();c.arc(x,py,2.8,0,Math.PI*2);c.fill()}
 }
 // Dead ball areas with painted sponsor text rotated along the axis.
 for(const goal of [-5,105]){c.save();c.translate(rm14X(goal),rm14Y(35));c.rotate(goal<0?-Math.PI/2:Math.PI/2);c.fillStyle='#e5f8ee92';c.font='900 27px system-ui';c.textAlign='center';c.fillText('RUGBY 27',0,8);c.restore()}
 // Stadium boundary LED panels and press camera positions.
 for(const y of [77,467]){c.fillStyle='#0a141f';c.fillRect(44,y,1012,9);for(let i=0;i<20;i++){const x=54+i*50;c.fillStyle=i%3===0?'#8ae3bb':'#63abb0';c.fillRect(x,y+3,29,2)}}
 c.fillStyle='#aeb7bd';c.font='700 11px system-ui';c.textAlign='left';c.fillText('RM27  /  LIVE MATCH ENGINE',60,498);
 c.textAlign='right';c.fillText('BROADCAST VIEW  •  2026 / 27',1042,498);
 return o;
}
function rm15Stadium(c){if(!RM15.bg)RM15.bg=rm15Layer();c.drawImage(RM15.bg,0,0)}
function rm15Team(s,g){const co=club(s===0?g.home:g.away);let shirt=co?.color|| (s===0?'#dce8eb':'#cc514d');const away=String(club(g.home)?.color||'').toLowerCase()===String(club(g.away)?.color||'').toLowerCase();if(away&&s===1)shirt='#ef9c41';
 const glow=s===0?'#5ad5e0':'#ffb67e';return {shirt,glow,shorts: s===0?'#f1f4f0':'#152632',trim:s===0?'#f5ffff':'#ffcb82',skin:s===0?'#d3a07d':'#c18c6b'};
}
// Figurines semi-profil animées, vues TV surélevée. Pieds ancrés au terrain ;
// silhouette d'un rugby player debout, articulations différentes course/contact/ruck.
function rm15DrawAthlete(c,p,g,s,i,kit,pose,clock,ballOwned){
 const x=rm14X(p.x),y=rm14Y(p.y),bulk=i<3?1.18:i<8?1.09:i===8?.87:i===14?1.04:1;
 const scale=(g.rmCamera==='follow'?1.06:.71)*bulk;
 const cycle=clock/(140-10*(i%4))+i*2.17+s*1.7;
 const stride=Math.sin(cycle)*rm15Bound(pose.move||0,0,1),run=rm15Bound(pose.move||0,0,1);
 const facing=Math.cos(pose.angle||0)>=0?1:-1;
 const tackling=pose.action==='tackle',down=pose.action==='ruck';
 const crouch=down?12:tackling?7:0;
 const skin=['#e9bf99','#bf8a68','#9c664b','#d7a17b','#b97859'][(s*3+i*7)%5];
 c.save();c.translate(x,y);c.scale(scale,scale);
 if(tackling)c.rotate((facing>0?1:-1)*Math.min(.9,.12+pose.move*.5));
 // Natural ground contact and occlusion. Footprints remain on the pitch.
 c.fillStyle='#001b146b';c.beginPath();c.ellipse(1,1,14,3.6,0,0,Math.PI*2);c.fill();
 const swingA=stride*6.8,swingB=-stride*6.8;
 // Legs and independently moving knees / calves, not rigid parallel lines.
 for(const side of [-1,1]){
  const hip=side*3.1,footSwing=side===1?swingA:swingB;
  const kneeX=hip+footSwing*.62+facing*(1.2+run*1.2);
  const kneeY=-8+crouch*.40+run*Math.abs(footSwing)*.23;
  c.lineCap='round';c.lineJoin='round';c.strokeStyle=kit.shorts;c.lineWidth=5.6;c.beginPath();c.moveTo(hip,-14+crouch*.5);c.lineTo(kneeX,kneeY);c.stroke();
  c.strokeStyle=skin;c.lineWidth=3.0;c.beginPath();c.moveTo(kneeX,kneeY);c.lineTo(hip+footSwing*.85,-2+Math.min(4,Math.abs(footSwing)*.26));c.stroke();
  c.strokeStyle=kit.trim;c.lineWidth=3.6;c.beginPath();c.moveTo(hip+footSwing*.85,-3);c.lineTo(hip+footSwing,-.5);c.stroke();
  c.fillStyle='#14212b';c.beginPath();c.ellipse(hip+footSwing+facing*2,0,4.5,2.7,-.13,0,Math.PI*2);c.fill();
 }
 // Folded lower torso and back mass.
 c.fillStyle=kit.shorts;c.strokeStyle='#0719278c';c.lineWidth=.8;c.beginPath();c.roundRect(-7,-18+crouch*.55,14,8,2);c.fill();c.stroke();
 c.save();c.translate(facing*run*2,-23+crouch);
 c.rotate(facing*(tackling?.26:down?.55:run*.09));
 // Athletic tapered rugby jersey. Arms emerge from actual shoulder joints.
 c.fillStyle=rm15Color(kit.shirt,-.10);c.strokeStyle='#051b2488';c.lineWidth=1.1;
 c.beginPath();c.moveTo(-7.5,4);c.lineTo(-9,-9);c.quadraticCurveTo(0,-16,9,-9);c.lineTo(7.5,4);c.closePath();c.fill();c.stroke();
 c.fillStyle=kit.shirt;c.beginPath();c.moveTo(-6,2);c.lineTo(-7,-8);c.quadraticCurveTo(0,-11,7,-8);c.lineTo(6,2);c.closePath();c.fill();
 // Shoulder seam, sleeves, and alternating club accents.
 c.strokeStyle=kit.trim;c.lineWidth=2;c.beginPath();c.moveTo(-8,-8);c.lineTo(-5,-9);c.moveTo(8,-8);c.lineTo(5,-9);c.stroke();
 c.fillStyle=kit.trim;c.fillRect(-3.4,-5,6.8,7);
 c.fillStyle='#0a1c24';c.textAlign='center';c.textBaseline='middle';c.font='900 7px system-ui';c.fillText(i+1,0,-1.2);
 // Right/left arms: flexed, swing in opposite direction from legs.
 for(const side of [-1,1]){
  const sh=side*8,arm=side===1?-stride:stride;
  const ex=sh+side*(tackling?7:down?7:1.6)+arm*3.6;
  const ey=tackling?-5:down?1:-1+arm*5.3;
  c.strokeStyle=skin;c.lineWidth=3.7;c.beginPath();c.moveTo(sh,-8);c.lineTo(ex,ey);c.lineTo(ex+facing*(tackling?6:2),ey+5);c.stroke();
  c.strokeStyle=kit.shirt;c.lineWidth=5;c.beginPath();c.moveTo(sh,-8);c.lineTo(sh+side*2.7,-3);c.stroke();
 }
 // Neck, jawline, ears, hair and nose; height is readable in broadcast camera.
 c.fillStyle=skin;c.fillRect(-2,-13,4,4);
 c.beginPath();c.ellipse(facing*1,-17,5.4,6.2,.08,0,Math.PI*2);c.fill();
 c.fillStyle=i%3===0?'#493021':'#1c2422';c.beginPath();c.ellipse(facing*.5,-19.8,5.2,3,0,Math.PI,Math.PI*2);c.fill();
 c.fillStyle=skin;c.beginPath();c.ellipse(facing*6,-16.5,1.5,1.8,0,0,Math.PI*2);c.fill();
 c.restore();
 if(ballOwned){c.strokeStyle='#ffe4a1';c.lineWidth=1.9;c.beginPath();c.ellipse(0,-7,15.3,3.6,0,0,Math.PI*2);c.stroke();}
 c.restore();
}

// Défense de ligne d'essai : staggered pillars/guards/backs, not a perfect wall.
const rm15OriginalPosition=rm14Position;
rm14Position=function(g,s,i,ball,poss,phase){
 const p=rm15OriginalPosition(g,s,i,ball,poss,phase),dir=rmDirection(g,poss);
 const remaining=dir>0?100-ball.x:ball.x;
 if(s!==poss&&remaining<22){
  const deep=2.2+(i%4)*1.0+(i>=8?1.3:0);
  p.x=rm15Bound(ball.x+dir*deep,2.5,97.5);
  if(i<5)p.y=rm15Bound(ball.y+(i-2)*3.5,4.2,65.8);
  else if(i<8)p.y=rm15Bound(ball.y+(i-6)*7.1,4.2,65.8);
  else p.y=rm15Bound(7+(i-8)*9.25,4.2,65.8);
 }
 return p;
};
function rm15FrameState(g){
 const view=rm14Setup(g),anim=view.animation,progress=anim?rm14AnimProgress(anim):1;
 const phase=anim?.phase||g.phase;const poss=anim?.poss??g.poss;
 const rawPositions=rm14PositionsAt(g),ball=rm14BallAt(g),p=rm15Bound(progress,0,1);
 let old=anim?.oldBall||g.ball,target=anim?.newBall||g.ball;
 let b={...ball},isFlight=false;
 // Complete passage of play: possession -> catch -> carry -> contact -> ground.
 if(anim&&anim.kind==='pass'&&anim.oldBall&&anim.newBall&&anim.poss===g.poss){
  const dir=rmDirection(g,poss),dy=rm15Bound(target.y-old.y,-15,15);
  const start={...old},receiver={x:rm15Bound(old.x-3.3*dir,3,97),y:rm15Bound(old.y+((dy===0?(poss===0?8:-8):dy)*.78),5,65)};
  if(p<.13){b={...start,h:0}}
  else if(p<.33){const r=rm15Ease((p-.13)/.20);b={...rm15Smooth(start,receiver,r),h:Math.sin(r*Math.PI)*13};isFlight=true}
  else if(p<.75){const r=rm15Ease((p-.33)/.42);b={...rm15Smooth(receiver,target,r),h:0}}
  else{b={...target,h:0}}
 } else if(anim&&anim.kind==='kick'){b={...ball};isFlight=progress<.87}
 // use cloned arrays; never modify simulation or persisted state.
 const positions=rawPositions.map(row=>row.map(t=>({...t})));
 // carrier always corresponds to the real visible oval, preventing floating-ball glitches.
 const attacker=positions[poss];let closest=8,min=999;
 for(let i=8;i<15;i++){const d=rm15Metric(attacker[i],b);if(d<min){min=d;closest=i}}
 let carrierIndex=Number.isInteger(g.matchModel?.carrier?.[poss])?g.matchModel.carrier[poss]:closest;
 if(!Number.isInteger(carrierIndex)||carrierIndex<0||carrierIndex>=15)carrierIndex=closest;
 // If animation just started, keep the nearest attacker to ball. At contact, attach selected carrier.
 if(min>10||p<.5)carrierIndex=closest;
 if(!isFlight){attacker[carrierIndex].x=rm15Bound(b.x,3,97);attacker[carrierIndex].y=rm15Bound(b.y,4,66)}
 // Reposition the closest defender to *near*, not *on top of*, the carrier during contact.
 const defense=positions[1-poss],dir=rmDirection(g,poss);
 let nearest=0,ds=999;
 for(let i=0;i<15;i++){const dist=rm15Metric(defense[i],b);if(dist<ds){nearest=i;ds=dist}}
 if(['Ruck','Maul','Contact','Percée','Turnover','Mêlée'].includes(phase)&&!isFlight){
  const close=p>.5?rm15Ease((p-.5)*2):0;
  const targetPos={x:rm15Bound(b.x+dir*1.8,3,97),y:rm15Bound(b.y+1.5,4,66)};
  defense[nearest]=rm15Smooth(defense[nearest],targetPos,close*.88);
 }
 return {view,anim,progress:p,phase,poss,ball:b,positions,carrierIndex,defenderIndex:nearest,isFlight};
}
function rm15DrawBall(c,b,g,s){
 const lift=s.isFlight?0:19;const dir=rmDirection(g,s.poss);const x=rm14X(b.x)+(s.isFlight?0:dir*7),y=rm14Y(b.y),h=(b.h||0)+lift;
 c.save();c.fillStyle='#071d1777';c.beginPath();c.ellipse(x,y+5,8+Math.max(0,h)*.11,4.5,0,0,Math.PI*2);c.fill();
 c.translate(x,y-h);c.rotate(s.isFlight?(performance.now()/280)%.5:-.25);
 c.fillStyle='#f0dbb2';c.strokeStyle='#3a2828';c.lineWidth=1.1;c.beginPath();c.ellipse(0,0,8.5,5.2,0,0,Math.PI*2);c.fill();c.stroke();
 c.strokeStyle='#72492e';c.lineWidth=1;c.beginPath();c.moveTo(-4,-1);c.lineTo(4,1);c.moveTo(-2,-3);c.lineTo(1,3);c.stroke();c.restore();
}
function rm15PaintAction(c,g,s){
 const {anim,progress:p,ball:b,phase}=s;const x=rm14X(b.x),y=rm14Y(b.y);
 if(anim){
  if(anim.kind==='kick'&&p<.95){c.save();c.strokeStyle='#f5d58aa9';c.lineWidth=2;c.setLineDash([4,9]);c.beginPath();c.moveTo(rm14X(anim.oldBall.x),rm14Y(anim.oldBall.y));c.lineTo(rm14X(anim.newBall.x),rm14Y(anim.newBall.y));c.stroke();c.restore()}
  if(anim.kind==='pass'&&p>.13&&p<.33){c.save();c.strokeStyle='#ffffdba8';c.lineWidth=2;c.beginPath();c.moveTo(rm14X(anim.oldBall.x),rm14Y(anim.oldBall.y));c.lineTo(x,y);c.stroke();c.restore()}
 }
 if(['Contact','Ruck','Maul','Mêlée','Touche','Turnover','Percée','Essai'].includes(phase)){
  c.save();c.globalAlpha=.7+(Math.sin(performance.now()/200)*.08);
  const accent=phase==='Percée'||phase==='Essai'?'#e8d38e':'#b1e2d7';c.strokeStyle=accent;c.lineWidth=2;
  c.beginPath();c.ellipse(x,y,21+3*Math.sin(p*Math.PI),14,0,0,Math.PI*2);c.stroke();
  c.font='800 11px system-ui';c.textAlign='center';c.textBaseline='middle';const text=({'Contact':'PLAQUAGE','Ruck':'RUCK','Maul':'MAUL','Mêlée':'MÊLÉE','Touche':'TOUCHE','Turnover':'BALLON GRATTÉ','Percée':'PERCÉE','Essai':'ESSAI'})[phase];
  const w=Math.max(74,c.measureText(text).width+20),tx=rm15Bound(x-w/2,85,1012-w),ty=rm15Bound(y-55,98,420);
  c.fillStyle='#0a2132db';c.beginPath();c.roundRect(tx,ty,w,22,5);c.fill();c.strokeStyle='#77baada4';c.lineWidth=1;c.stroke();c.fillStyle='#fff7df';c.fillText(text,tx+w/2,ty+11);
  c.restore();
 }
}
function rm15PlayerPose(g,s,index,scene,clock){
 const pos=scene.positions[s][index],to=scene.anim?.to?.[s]?.[index],from=scene.anim?.from?.[s]?.[index];
 const m=from&&to?rm15Metric(from,to):0;
 const dx=from&&to?to.x-from.x:0,dy=from&&to?to.y-from.y:0;
 const attacking=s===scene.poss,isCarrier=attacking&&scene.carrierIndex===index&&!scene.isFlight;
 const isDefender=!attacking&&scene.defenderIndex===index;
 const phase=scene.phase;
 const tackle=isDefender&&['Contact','Ruck','Maul','Mêlée','Turnover'].includes(phase)&&scene.progress>.48;
 const ruck=isCarrier&&['Ruck','Maul','Mêlée'].includes(phase)&&scene.progress>.7;
 const direction=rmDirection(g,s);
 // Face the actual direction of travel; retreating defenders can turn towards the action.
 let angle=Math.atan2(dy,dx);if(Math.abs(dx)+Math.abs(dy)<1)angle=direction>0?0:Math.PI;
 const delta=(direction>0?0:Math.PI);if(!Number.isFinite(angle))angle=delta;
 const action=tackle?'tackle':ruck?'ruck':'run';
 return {angle,move:m>1&&scene.progress<.95?rm15Bound(m/10,.27,1):0,action,downed:ruck,carrier:isCarrier};
}
function rm15MiniMap(c,g,s){
 const left=884,top=107,w=157,h=82;
 c.save();c.fillStyle='#091c2cbf';c.beginPath();c.roundRect(left-5,top-9,w+10,h+18,7);c.fill();
 c.fillStyle='#1a6b50';c.fillRect(left,top,w,h);c.strokeStyle='#c2e6daa6';c.lineWidth=1;c.strokeRect(left,top,w,h);
 for(const m of [0,50,100]){c.beginPath();c.moveTo(left+m/100*w,top);c.lineTo(left+m/100*w,top+h);c.stroke()}
 for(let t=0;t<2;t++){
  const colors=rm15Team(t,g);c.fillStyle=colors.glow;
  for(let i=0;i<15;i++){let p=s.positions[t][i];c.beginPath();c.arc(left+p.x/100*w,top+p.y/70*h,1.5,0,Math.PI*2);c.fill()}
 }
 c.fillStyle='#ffe3a8';c.beginPath();c.arc(left+s.ball.x/100*w,top+s.ball.y/70*h,3.0,0,Math.PI*2);c.fill();
 c.fillStyle='#d7ede8';c.font='700 9px system-ui';c.textAlign='right';c.fillText('RADAR 15 vs 15',left+w,top-12);c.restore();
}
function rm15HUD(c,g,s){
 // Broadcast top strip, status & running game clock.
 c.save();c.fillStyle='#0a1d2fdd';c.beginPath();c.roundRect(68,93,358,32,7);c.fill();
 c.fillStyle='#f7f3e6';c.font='800 12px system-ui';c.textAlign='left';c.textBaseline='middle';
 const phase=String(s.phase||'Jeu');const team=club(s.poss===0?g.home:g.away)?.name||'Équipe';
 c.fillText('●  '+phase.toUpperCase().slice(0,18)+'   ·   '+team.slice(0,20),80,109);
 c.fillStyle='#c7d6ccad';c.font='700 10px system-ui';c.textAlign='right';c.fillText(g.minute.toFixed(1)+"′",413,109);
 c.restore();
}
function rm15DrawScene(g){
 const canvas=document.getElementById('rmcanvas');if(!canvas||!g)return;
 const c=canvas.getContext('2d',{alpha:false});if(!c)return;
 if(canvas.width!==RM15.width||canvas.height!==RM15.height){canvas.width=RM15.width;canvas.height=RM15.height}
 const scene=rm15FrameState(g),clock=performance.now();
 rm15Stadium(c);
 // Subtle depth: lines where defense sits and passing option routes.
 const dir=rmDirection(g,scene.poss);
 if(g.rm15Lines!==false){
  c.save();c.lineWidth=1.25;c.strokeStyle='#eaf7e139';c.setLineDash([3,9]);
  c.beginPath();const backs=scene.positions[scene.poss].slice(9,14);backs.forEach((p,i)=>i?c.lineTo(rm14X(p.x),rm14Y(p.y)):c.moveTo(rm14X(p.x),rm14Y(p.y)));c.stroke();
  c.strokeStyle='#fde3cb31';c.beginPath();const defenders=scene.positions[1-scene.poss].slice(9,14);defenders.forEach((p,i)=>i?c.lineTo(rm14X(p.x),rm14Y(p.y)):c.moveTo(rm14X(p.x),rm14Y(p.y)));c.stroke();c.restore();
 }
 // Paint far-side players before close-side players, in depth order by Y.
 const people=[];for(let t=0;t<2;t++)for(let i=0;i<15;i++)people.push({s:t,i,p:scene.positions[t][i]});
 people.sort((a,b)=>a.p.y-b.p.y);
 for(const {s:t,i,p} of people){const kit=rm15Team(t,g),pose=rm15PlayerPose(g,t,i,scene,clock);
  rm15DrawAthlete(c,p,g,t,i,kit,pose,clock,pose.carrier);
 }
 rm15DrawBall(c,scene.ball,g,scene);rm15PaintAction(c,g,scene);rm15HUD(c,g,scene);
 if(g.rmCamera==='full')rm15MiniMap(c,g,scene);
 if(g.rmCamera==='follow')rm15Follow(g,scene.ball);
 RM15.frameCount++;
}
function rm15Follow(g,b){
 const frame=document.querySelector('.rm13-viewport'),canvas=document.getElementById('rmcanvas');if(!frame||!canvas)return;
 const width=frame.clientWidth;if(width<1)return;
 const mobile=window.innerWidth<=760,zoom=mobile?2.58:window.innerWidth<=1100?1.76:1.64;
 const full=Math.round(width*zoom);
 if(canvas.style.width!==full+'px'){canvas.style.width=full+'px';canvas.style.maxWidth='none';}
 const direction=rmDirection(g,g.poss),lead=rm15Bound(b.x+direction*6,6,94);
 const target=rm15Bound(width*.51-rm14X(lead)/1100*full,width-full,0);
 RM15.camOffset=RM15.camOffset===null?target:rm15Linear(RM15.camOffset,target,.095);
 const clamped=rm15Bound(RM15.camOffset,width-full,0);
 canvas.style.marginLeft=clamped.toFixed(2)+'px';
}
const rm15PreviousStep=rmSimStep;
// Use the same score/physics. The only modification to simulation is its visual request lifecycle.
rmSimStep=function(g){return rm15PreviousStep(g)};
rm14Scene=rm15DrawScene;
rmDrawPitch=rm15DrawScene;
rmLoopAnimation=function(){
 if(!document.getElementById('rmcanvas')||!rmSimple){rmSimpleRAF=null;return}
 const now=performance.now();if(now-RM15.lastFrame>=29){RM15.lastFrame=now;try{rm15DrawScene(rmSimple)}catch(error){RM15.failures++;if(RM15.failures<=2)console.error('RM15 frame',error)}}
 rmSimpleRAF=requestAnimationFrame(rmLoopAnimation);
};
rm13ApplyCamera=function(g){
 if(!g.rmCamera)g.rmCamera='follow';
 const frame=document.querySelector('.rm13-viewport'),canvas=document.getElementById('rmcanvas');if(!frame||!canvas)return;
 if(g.rmCamera==='follow')rm15Follow(g,rm15FrameState(g).ball);
 else{canvas.style.width='100%';canvas.style.maxWidth='none';canvas.style.marginLeft='0px';RM15.camOffset=null;}
 const button=document.getElementById('rm13Camera');if(button)button.textContent=g.rmCamera==='follow'?'▦ Terrain entier':'🎥 Vue TV';
};
const rm15OldAttach=rmAttachSimple;
rmAttachSimple=function(){
 rm15OldAttach();if(rmSimple){rmSimple.rmCamera='follow';rmSimple.rm15Lines=true;}
 const select=document.getElementById('rmSpeed');if(select&&![...select.options].some(o=>o.value==='0.5'))select.insertAdjacentHTML('afterbegin','<option value="0.5">×0,5 · ralenti</option>');
 const tactics=document.querySelector('.rm13-match-strip');if(tactics){const btn=document.createElement('button');btn.className='rm15-toggle';btn.type='button';btn.textContent='⌗ Repères tactiques';btn.onclick=()=>{rmSimple.rm15Lines=!rmSimple.rm15Lines;btn.setAttribute('aria-pressed',String(rmSimple.rm15Lines));rmStore()};tactics.appendChild(btn)}
};
const rm15OldMarkup=rmSimpleMarkup;
rmSimpleMarkup=function(g){
 let html=rm15OldMarkup(g);
 html=html.replace('Match 2D · Vue TV tactique','Match 2D · Broadcast');
 html=html.replace('Vue TV 2D : 30 silhouettes suivies, soutien et lignes défensives, phases de passes, plaquages et rucks illustrés. Le moteur reste une simulation événementielle ; ce rendu ne prétend pas reproduire une physique professionnelle.', 'Broadcast 2D : animation articulée, caméra fluide, phases de passes / course / plaquage, formation et couverture affichées. Résultats fondés sur la simulation tactique.');
 return html;
};
window.RM27_VISUAL_15={version:'1.5-broadcast',renderer:rm15DrawScene,state:rm15FrameState,frame:RM15,view:rm15Follow};
