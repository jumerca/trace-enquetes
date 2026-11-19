
/* Rugby Manager 27 — Motion Engine 1.6
 * Choreography uses named ball possession/receptions, continuous carrier trajectories,
 * independently interpolated defenders, two-person tackle and ruck. The logical score engine,
 * recruitment, finance, fixtures and save format stay untouched.
 * Coordinates in rugby pitch metres. Browser API-free output except canvas + requestAnimationFrame.
 */
'use strict';
const RM16={version:'1.6-motion',frames:0,errors:0,passes:0,tackles:0,maxHandoffError:0,
  visibleContacts:0,lastSequence:null, lastAt:0};
const m16C=(n,a,b)=>Math.max(a,Math.min(b,n));
const m16L=(a,b,t)=>a+(b-a)*t;
const m16P=(a,b,t)=>({x:m16L(a.x,b.x,t),y:m16L(a.y,b.y,t)});
const m16D=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const m16Ease=t=>{t=m16C(t,0,1);return t*t*(3-2*t)};
const m16Between=(p,a,b)=>m16Ease((p-a)/Math.max(.00001,b-a));
const m16Point=(x,y)=>({x:m16C(x,2.4,97.6),y:m16C(y,4.8,65.2)});
const m16PlayerPoint=(x,y)=>({x:m16C(x,-5.5,105.5),y:m16C(y,3.7,66.3)});
function m16At(keys,p){let j=0;for(;j<keys.length-2&&keys[j+1].t<p;j++);return m16P(keys[j].point,keys[j+1].point,m16Between(p,keys[j].t,keys[j+1].t))}
function m16Closest(team,point,used=[],start=0,end=15){let k=-1,d=1e10;for(let i=start;i<end;i++){
 if(used.includes(i))continue;let e=m16D(team[i],point);if(e<d){d=e;k=i}}
 return k<0?8:k;
}
function m16Unique(p,dirs,anchor){
 let y=m16C(anchor.y+dirs,5.8,64.2);
 if(Math.abs(y-anchor.y)<3)y=m16C(anchor.y-dirs,5.8,64.2);
 return m16Point(p.x,y);
}
function m16Create(g,a){
 const oldSide=a.prevPoss??a.poss, endSide=g.poss,dir=rmDirection(g,oldSide);
 const start={...a.oldBall},end={...a.newBall};
 const starts=a.from.map(row=>row.map(p=>({...p}))),ends=a.to.map(row=>row.map(p=>({...p})));
 const attack=starts[oldSide];
 const originalCarrier=m16Closest(attack,start,[],7,15);
 const kind=a.kind;
 let current=originalCarrier,used=[current],nodes=[],ballkeys=[{t:0,point:start}],ballFlights=[];
 let location={...start};
 // Narrative is directly tied to actual engine phase transitions. Passes always travel backwards.
 if(kind==='pass'&&oldSide===endSide){
  const total=g.tactics?.attack==='Au large'?3:2;
  for(let pass=0;pass<total;pass++){
   const kickOff=.14+pass*(total===3?.23:.31);
   const catchAt=kickOff+.095;
   const sign=((pass+g.events)%2===0?1:-1);
   const ideal=m16Unique({x:location.x-dir*(2.1+pass*.6),y:location.y},sign*(total===3?9.2:12.8),location);
   let receiver=m16Closest(attack,ideal,used,8,15);
   if(receiver===current)receiver=(current+2)%15;
   const ballStart=m16Point(location.x+dir*1.2,location.y);
   const ballCatch=m16Point(location.x-dir*(2.7+pass*.7),ideal.y);
   ballkeys.push({t:kickOff-.04,point:ballStart},{t:kickOff,point:ballStart},{t:catchAt,point:ballCatch});
   ballFlights.push({from:kickOff,to:catchAt,fromPlayer:current,toPlayer:receiver,fromPoint:ballStart,toPoint:ballCatch});
   nodes.push({index:current,from:location,to:ballStart,start:pass===0?0:catchAt-.10,end:kickOff});
   current=receiver;used.push(current);location=ballCatch;
  }
  nodes.push({index:current,from:location,to:end,start:total===3?.72:.56,end:.88});
  ballkeys.push({t:.84,point:m16P(location,end,.80)},{t:1,point:end});
 }else if(kind==='kick'){
  const origin=m16Point(start.x+dir*2.2,start.y);
  ballkeys=[{t:0,point:start},{t:.19,point:origin},{t:.76,point:end},{t:1,point:end}];
  ballFlights.push({from:.19,to:.88,fromPlayer:originalCarrier,toPlayer:null,fromPoint:origin,toPoint:end,kick:true});
  nodes=[{index:originalCarrier,from:start,to:origin,start:0,end:.22}];
 }else{
  const sprint=kind==='run'||kind==='ruck'||kind==='turnover';
  const touch=m16P(start,end,.57),high=m16P(start,end,.85);
  nodes=[{index:originalCarrier,from:start,to:high,start:0,end:.82}];
  ballkeys=[{t:0,point:start},{t:.57,point:touch},{t:.84,point:high},{t:1,point:end}];
  if(!sprint){nodes[0].end=.72}
 }
 const contact=['ruck','maul','turnover','scrum','lineout'].includes(kind)||['Contact','Ruck','Maul','Mêlée','Turnover'].includes(a.phase);
 const contactAt=contact?.77:kind==='run'?.84:1;
 const contactPoint=ballkeys[ballkeys.length-2].point;
 let defenders=[];
 if(contact){const defenderSide=1-oldSide;const block=starts[defenderSide],first=m16Closest(block,contactPoint,[],0,15);const second=m16Closest(block,contactPoint,[first],0,15);defenders=[first,second];}
 const sequence={start, end,prevPoss:oldSide,newPoss:endSide,dir, kind,originalCarrier,
  finalCarrier:current, ballkeys, ballFlights, nodes, contact,contactAt,defenders,contactPoint,
  starts,ends,created:performance.now(),duration:a.duration,previousPhase:a.phase,
  finished:false};
 RM16.lastSequence={kind,prevPoss:oldSide,newPoss:endSide,flights:ballFlights.length,defenders:defenders.length,phase:a.phase};
 RM16.passes+=ballFlights.filter(f=>!f.kick).length;
 RM16.tackles+=contact?1:0;
 return sequence;
}
// The player formation is recomputed from real pitch lanes, not a 30-man blob around the ball.
const m16OldFormation=rm14Position;
rm14Position=function(g,s,i,ball,poss,phase){
 if(phase==='Mêlée'||phase==='Touche')return m16OldFormation(g,s,i,ball,poss,phase);
 const dir=rmDirection(g,poss),attack=s===poss;
 const bx=ball.x,by=ball.y;
 let dx,py;
 if(attack){
  const f=[[-3,-10],[-4,-4],[-3,4],[-4,11],[-10,-18],[-9,0],[-11,18],[-16,7]];
  const b=[[-3,4],[-10,-12],[-16,-23],[-15,-7],[-18,9],[-18,25],[-30,0]];
  const [xx,yy]=(i<8?f[i]:b[i-8]);dx=xx;
  py=i<8?by+yy:35+yy+(by-35)*.24;
 }else{
  const f=[[5,-25],[6,-18],[5,-11],[6,-4],[5,4],[6,11],[5,18],[6,25]];
  const b=[[9,-27],[10,-19],[11,-10],[10,0],[11,10],[10,19],[25,0]];
  const [xx,yy]=(i<8?f[i]:b[i-8]);dx=xx;
  py=35+yy+(by-35)*.21;
  if(g.tactics?.defense==='Montée agressive')dx-=1.4;
  const remaining=dir>0?100-bx:bx;
  if(remaining<16){
    dx=(i<8?4.8+(i%3)*2.25:9.0+(i%3)*2.5);
  }
 }
 return m16PlayerPoint(bx+dir*dx,py);
};
const m16OrigStart=rm14StartAction;
rm14StartAction=function(g,old,prev){
 m16OrigStart(g,old,prev);
 if(g.fast)return;
 const a=g.rm14?.animation;
 if(a){a.prevPoss=old.poss;g.rm16=m16Create(g,a)}
};
function m16SceneState(g,now=performance.now()){
 const view=rm14Setup(g),a=view.animation;
 if(!a){
  const fallback=rm15FrameState(g);
  return {...fallback,sequence:null,roles:[],flight:null,action:'ATTENTE',angleByPlayer:{},contactPlayers:[]};
 }
 // rm16 is ephemeral, reconstructed on resumed old-version save without touching its save schema.
 if(!g.rm16||g.rm16.created!==a.started&&Math.abs(g.rm16.created-a.started)>100){
  a.prevPoss=a.prevPoss??a.poss;
  g.rm16=m16Create(g,a);
 }
 const seq=g.rm16,t=m16C((now-a.started)/Math.max(a.duration,200),0,1);
 const side=seq.prevPoss,dir=seq.dir;
 const pos=seq.starts.map((team,s)=>team.map((from,i)=>{
  const to=seq.ends[s][i],amount=m16Ease(t);
  return m16P(from,to,amount);
 }));
 let ball=m16At(seq.ballkeys,t),flight=null,active=seq.originalCarrier;
 for(const f of seq.ballFlights){if(t>=f.from&&t<=f.to){flight=f;active=f.fromPlayer;break}if(t>f.to&&f.toPlayer!==null)active=f.toPlayer;}
 let progress=t;
 if(!flight){for(const n of seq.nodes){if(t>=n.start&&t<=n.end){active=n.index;ball=m16P(n.from,n.to,m16Between(t,n.start,n.end));break}}
  }
 // Ball/player synchronization: carrier follows its own travel route, then the ball is in the hands.
 const roles=Array.from({length:2},()=>Array(15).fill('run'));
 for(const n of seq.nodes){if(t>=n.start-.05&&t<=n.end+.05)roles[side][n.index]='carrier'}
 let targetBall={...ball};
 if(flight){const ft=m16Between(t,flight.from,flight.to),h=flight.kick?Math.sin(ft*Math.PI)*71:Math.sin(ft*Math.PI)*16;
  ball={...m16P(flight.fromPoint,flight.toPoint,ft),h};
  roles[side][flight.fromPlayer]='pass';
  if(flight.toPlayer!==null){const recv=pos[side][flight.toPlayer];const catchP=flight.toPoint;
   pos[side][flight.toPlayer]=m16P(recv,catchP,m16Ease(m16C(ft+.15,0,1))*.93);
   roles[side][flight.toPlayer]='catch';
  }
 }else{
  ball={...ball,h:0};
  pos[side][active]=m16Point(ball.x,ball.y);
 }
 // Support triangles (two interior and an exterior runner), moving in relation to the active carrier.
 const supportCandidates=[5,6,7,8,9,10,11,12,13,14].filter(i=>i!==active&&!(flight&&i===flight.toPlayer));
 const assigned=[],lane=ball.y>36?-1:1;
 const supportSlots=[{x:ball.x-dir*5.4,y:ball.y+lane*6.4},
   {x:ball.x-dir*8.2,y:ball.y-lane*6.5},{x:ball.x-dir*11,y:ball.y+lane*14}];
 for(const point of supportSlots){const desired=m16Point(point.x,point.y);const idx=m16Closest(pos[side],desired,[active,...assigned,...seq.defenders],5,15);
  if(assigned.includes(idx))continue;
  assigned.push(idx);pos[side][idx]=m16P(pos[side][idx],desired,m16Ease(t)*.67);
  roles[side][idx]='support';
 }
 // Two independent defenders pursue the carrier and never teleport directly over it.
 const defender=1-side;const line=pos[defender];
 const chaseCandidates=line.map((pt,i)=>({i,d:m16D(pt,ball)})).sort((a,b)=>a.d-b.d);
 const d1=seq.contact?seq.defenders[0]:chaseCandidates[0].i;
 const d2=seq.contact?seq.defenders[1]:chaseCandidates[1].i;
 const contactProgress=seq.contact?m16Between(t,seq.contactAt-.14,seq.contactAt+.12):0;
 if(seq.contact){
  for(let n=0;n<2;n++){
   const i=n===0?d1:d2;if(!Number.isInteger(i))continue;
   const lateral=n===0?2.2:-2.3;
   const target=m16Point(ball.x+dir*(n===0?1.25:2.2),ball.y+lateral);
   const chase=m16Ease(m16C(t/.78,0,1));
   const moving=m16P(line[i],target,chase*.79+contactProgress*.21);
   line[i]=moving;roles[defender][i]=contactProgress>.16?'tackle':'chase';
  }
  if(t>=seq.contactAt){roles[side][active]='ground';if(t>.90){roles[defender][d1]='ground';roles[defender][d2]='tackle';}}
 }
 // Avoid overlaps elsewhere: local pairwise avoidance, with lock on ballcarrier and tacklers.
 for(let s=0;s<2;s++)for(let i=0;i<15;i++)for(let j=i+1;j<15;j++){
  const p=pos[s][i],q=pos[s][j],distance=m16D(p,q),minimum=3.85;
  if(distance>=minimum)continue;
  if(roles[s][i]==='carrier'||roles[s][i]==='ground'||roles[s][j]==='carrier'||roles[s][j]==='ground')continue;
  const vx=(p.x-q.x)/(distance||1)+(distance<.02?.25:0),vy=(p.y-q.y)/(distance||1)+(distance<.02?.25:0),shift=(minimum-distance)*.26;
  p.x=m16C(p.x+vx*shift,-5.5,105.5);p.y=m16C(p.y+vy*shift,3.7,66.3);
  q.x=m16C(q.x-vx*shift,-5.5,105.5);q.y=m16C(q.y-vy*shift,3.7,66.3);
 }
 // Mapped roles ensure the movement and possession animation actually match.
 const action=flight?(flight.kick?'COUP DE PIED':'PASSE EN MOUVEMENT'):
  seq.contact&&contactProgress>.85?'RUCK / BALLON AU SOL':seq.contact&&contactProgress>.22?'PLAQUAGE À DEUX':
  seq.kind==='pass'?'COURSE / SOUTIEN':seq.kind==='kick'?'COURSE / CHASSE':'COURSE ET DÉFENSE';
 return {view,anim:a,progress:t,phase:a.phase,poss:side,positions:pos,carrierIndex:active,
   defenderIndex:d1,ball,isFlight:!!flight,flight,roles,sequence:seq,action,
   contactPlayers:[d1,d2],contactProgress};
}
function m16DrawPlayer(c,p,g,s,i,kit,scene,clock){
 const role=scene.roles?.[s]?.[i]||'run',seq=scene.sequence;
 const from=seq?.starts?.[s]?.[i]||p,to=seq?.ends?.[s]?.[i]||p;
 let angle=Math.atan2(to.y-from.y,to.x-from.x);
 if(!Number.isFinite(angle)||m16D(from,to)<.35)angle=rmDirection(g,s)>0?0:Math.PI;
 let moving=m16C(m16D(from,to)/12,.15,1)*((scene.progress<.96)?1:0);
 if(role==='carrier')moving=Math.max(moving,.74);
 if(role==='chase')moving=Math.max(moving,.84);
 if(role==='ground')moving=0;
 const pose={angle,move:moving,action:role==='tackle'?'tackle':role==='ground'?'ruck':'run',downed:role==='ground',carrier:role==='carrier'};
 // Position-based gait cycle avoids legs waggling whilst the player is planted.
 if(role==='ground'){
  c.save();c.translate(rm14X(p.x),rm14Y(p.y));
  const size=g.rmCamera==='follow'?1.06:.74;
  c.rotate((scene.sequence?.dir||1)>0?.12:-.12);
  c.fillStyle='#05192388';c.beginPath();c.ellipse(0,1,20*size,9*size,0,0,Math.PI*2);c.fill();
  c.scale(size,size);c.rotate(Math.PI/2);
  const body={...pose,move:0,action:'ruck'};
  // Sprite rendered in a low horizontal position; no vertical standing player at the bottom of a ruck.
  c.translate(0,14);rm15DrawAthleteLocal(c,kit,s,i,body,clock);c.restore();return;
 }
 rm15DrawAthlete(c,p,g,s,i,kit,pose,clock,role==='carrier');
 // Contact shoulders angle toward target to visually distinguish it from running.
 if(role==='tackle'){
  const px=rm14X(p.x),py=rm14Y(p.y)-11;
  c.save();c.strokeStyle='#ffe4b9ba';c.lineWidth=2;c.beginPath();c.arc(px,py,11,Math.PI*1.12,Math.PI*1.84);c.stroke();c.restore();
 }
}
function rm15DrawAthleteLocal(c,kit,s,i,pose,clock){
 // Prone compact rugby athlete, drawn horizontally in field space after caller rotation.
 c.fillStyle=kit.shorts;c.strokeStyle='#071821';c.lineWidth=2;
 c.beginPath();c.roundRect(-8,-11,16,13,5);c.fill();c.stroke();
 c.fillStyle=kit.shirt;c.beginPath();c.roundRect(-9,-27,18,19,5);c.fill();c.stroke();
 c.fillStyle=kit.trim;c.font='800 9px system-ui';c.textAlign='center';c.fillText(i+1,0,-15);
 c.strokeStyle=kit.shorts;c.lineWidth=5;c.lineCap='round';c.beginPath();c.moveTo(-5,0);c.lineTo(-9,12);c.moveTo(5,0);c.lineTo(10,11);c.stroke();
 c.strokeStyle='#d6a581';c.lineWidth=4.5;c.beginPath();c.moveTo(-8,-23);c.lineTo(-18,-10);c.moveTo(8,-23);c.lineTo(18,-11);c.stroke();
 c.fillStyle='#c99373';c.beginPath();c.arc(0,-31,6.2,0,Math.PI*2);c.fill();
}
function m16DrawBall(c,scene,g){
 const b=scene.ball,dir=scene.sequence?.dir??rmDirection(g,scene.poss);
 const flying=scene.isFlight;
 const pX=rm14X(b.x)+(flying?0:dir*8),pY=rm14Y(b.y),lift=flying?(b.h||0):scene.action.includes('RUCK')?2:17;
 c.save();c.fillStyle='#0018138b';c.beginPath();c.ellipse(pX,pY+6,9,3.6,0,0,2*Math.PI);c.fill();
 c.translate(pX,pY-lift);c.rotate(flying?.29+scene.progress*3.3:-.25);
 c.fillStyle='#fff1cf';c.strokeStyle='#392a24';c.lineWidth=1.6;c.beginPath();c.ellipse(0,0,8.3,5.1,0,0,2*Math.PI);c.fill();c.stroke();
 c.strokeStyle='#764a37';c.lineWidth=1;c.beginPath();c.moveTo(-3,-3);c.lineTo(3,3);c.stroke();c.restore();
}
function m16DrawHUD(c,g,s){
 // Important: HUD uses the actual micro-action, not the already resolved logical event.
 // The camera moves the pitch canvas, so the overlay must compensate for its offset.
 const canvas=document.getElementById('rmcanvas'),frame=document.querySelector('.rm13-viewport');
 const cssWidth=canvas?.getBoundingClientRect().width||1100,scale=Math.max(.35,cssWidth/1100);
 const offset=-parseFloat(canvas?.style.marginLeft||'0')/scale;
 const viewWidth=(frame?.clientWidth||1100)/scale;
 const x=m16C(offset+11,12,1090- Math.min(350,viewWidth-23));
 const barWidth=Math.max(260,Math.min(350,viewWidth-23)),y=96;
 c.save();c.fillStyle='#0a1e2ef0';c.beginPath();c.roundRect(x,y,barWidth,43,7);c.fill();
 c.fillStyle='#c3f0d7';c.font='800 11px system-ui';c.textAlign='left';c.fillText('LIVE MOTION',x+10,y+15);
 c.fillStyle='#fcf3de';c.font='700 11px system-ui';c.fillText(s.action,x+120,y+15);
 c.fillStyle='#cddbd6';c.font='700 10px system-ui';c.fillText('JOUEUR '+(s.carrierIndex+1)+'    •    '+g.minute.toFixed(1)+'′',x+10,y+31);
 c.fillStyle='#122c36';c.fillRect(x,y+45,barWidth,3);
 c.fillStyle=s.isFlight?'#efc66b':'#89d6b4';c.fillRect(x,y+45,barWidth*s.progress,3);
 c.restore();
}
function m16DrawRoutes(c,s){
 const seq=s.sequence;if(!seq)return;
 c.save();c.lineWidth=1.45;c.setLineDash([6,7]);c.strokeStyle='#d9f4ce50';
 for(const n of seq.nodes){if(s.progress>n.end)continue;
  c.beginPath();c.moveTo(rm14X(n.from.x),rm14Y(n.from.y));c.lineTo(rm14X(n.to.x),rm14Y(n.to.y));c.stroke()}
 if(s.flight){const f=s.flight;c.strokeStyle='#ffe1a1b8';c.lineWidth=2.5;
  c.beginPath();c.moveTo(rm14X(f.fromPoint.x),rm14Y(f.fromPoint.y));c.lineTo(rm14X(f.toPoint.x),rm14Y(f.toPoint.y));c.stroke();}
 c.restore();
}
function m16ContactEffects(c,s){if(!s.sequence?.contact)return;
 const alpha=m16Between(s.progress,s.sequence.contactAt-.16,s.sequence.contactAt+.13);
 if(alpha<=0)return;
 const x=rm14X(s.ball.x),y=rm14Y(s.ball.y);
 c.save();c.globalAlpha=.68*alpha;c.strokeStyle='#f7d395';c.lineWidth=2.5;c.beginPath();c.ellipse(x,y,15+alpha*13,8+alpha*7,-.19,0,2*Math.PI);c.stroke();
 if(s.progress>.88){c.fillStyle='#0a1b22de';c.beginPath();c.roundRect(x-30,y-37,60,20,5);c.fill();c.fillStyle='#fff3d6';c.textAlign='center';c.font='800 10px system-ui';c.fillText('RUCK',x,y-23)}
 c.restore();RM16.visibleContacts++;
}
function m16DrawScene(g){
 const canvas=document.getElementById('rmcanvas');if(!canvas||!g)return;
 const c=canvas.getContext('2d',{alpha:false});if(!c)return;
 if(canvas.width!==1100||canvas.height!==545){canvas.width=1100;canvas.height=545}
 const s=m16SceneState(g),clock=performance.now();
 rm15Stadium(c);m16DrawRoutes(c,s);
 const people=[];for(let t=0;t<2;t++)for(let i=0;i<15;i++)people.push({s:t,i,p:s.positions[t][i]});
 people.sort((a,b)=>a.p.y-b.p.y);
 for(const a of people)m16DrawPlayer(c,a.p,g,a.s,a.i,rm15Team(a.s,g),s,clock);
 m16DrawBall(c,s,g);m16ContactEffects(c,s);m16DrawHUD(c,g,s);
 if(g.rmCamera==='full')rm15MiniMap(c,g,s);
 if(g.rmCamera==='follow')rm15Follow(g,s.ball);
 RM16.frames++;
}
rmDrawPitch=m16DrawScene;
rm14Scene=m16DrawScene;
rmLoopAnimation=function(){
 if(!document.getElementById('rmcanvas')||!rmSimple){rmSimpleRAF=null;return}
 const now=performance.now();if(now-RM16.lastAt>=28){RM16.lastAt=now;
  try{m16DrawScene(rmSimple)}catch(err){RM16.errors++;if(RM16.errors<4)console.error('Motion engine',err)}}
 rmSimpleRAF=requestAnimationFrame(rmLoopAnimation);
};
rm13ApplyCamera=function(g){
 if(!g.rmCamera)g.rmCamera='follow';
 const frame=document.querySelector('.rm13-viewport'),canvas=document.getElementById('rmcanvas');if(!frame||!canvas)return;
 if(g.rmCamera==='follow')rm15Follow(g,m16SceneState(g).ball);
 else{canvas.style.width='100%';canvas.style.marginLeft='0';canvas.style.maxWidth='none';RM15.camOffset=null}
 const btn=document.getElementById('rm13Camera');if(btn)btn.textContent=g.rmCamera==='follow'?'▦ Terrain entier':'🎥 Vue TV';
};
const m16Markup=rmSimpleMarkup;
rmSimpleMarkup=function(g){return m16Markup(g).replace('Match 2D · Broadcast','Match 2D · Motion Engine')
 .replace('BROADCAST','MOTION');};
window.RM27_MOTION_16={state:m16SceneState,renderer:m16DrawScene,stats:RM16,create:m16Create};

