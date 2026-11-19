/* Rugby Manager 27 — V2.0 · Rendu 2D « vue TV »
 * Projection perspective discrète (caméra en tribune), vue tactique orthogonale (pivotée en portrait),
 * Canvas adapté à la densité de pixels, interpolation entre deux pas de simulation (aucun saut),
 * silhouettes articulées dont la foulée est indexée sur la distance réellement parcourue.
 */
'use strict';
(function(root){
const RM2=root.RM2;
const R2D=root.RM2R={};
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const SKIN=['#f1c9a5','#d9a47c','#b97a52','#8a5a3b','#5e3b26'];
const HAIR=['#2a1d14','#4a3020','#6d4a2b','#151515','#a77b42','#3a3a3a'];
const CAM={tv:{L:44,label:'TV'},close:{L:28,label:'Proche'},wide:{L:72,label:'Large'},full:{L:132,label:'Terrain entier'},tactical:{L:0,label:'Tactique'}};
R2D.CAMERAS=['tv','close','wide','full','tactical'];
R2D.CAM=CAM;

R2D.create=function(canvas,opts={}){
 const r={canvas,ctx:canvas.getContext('2d'),dpr:1,W:0,H:0,mode:opts.mode||'tv',zoom:1,camX:50,camY:35,camL:44,
  labels:opts.labels||false,overlay:opts.overlay||false,lastT:0,fps:0,frames:0,fpsT:0,colors:opts.colors||null};
 R2D.resize(r);
 return r;
};
R2D.resize=function(r){
 const c=r.canvas,rect=c.getBoundingClientRect();
 const dpr=clamp(root.devicePixelRatio||1,1,2.5);
 const W=Math.max(200,Math.round(rect.width)),H=Math.max(150,Math.round(rect.height));
 if(W!==r.W||H!==r.H||dpr!==r.dpr){r.W=W;r.H=H;r.dpr=dpr;c.width=Math.round(W*dpr);c.height=Math.round(H*dpr)}
};

/* ---------- Projection ---------- */
const D=92,HC=38,NEAR=70;
function makeProj(r){
 const W=r.W,H=r.H;
 if(r.mode==='tactical'){
  const portrait=H>W*1.12;
  const s=portrait?Math.min(W/80,H/126)*r.zoom:Math.min(W/126,H/80)*r.zoom;
  const cx=r.camX,cy=r.camY;
  if(portrait)return {s0:s,ortho:true,p:(x,y,z=0)=>({x:W/2+(y-35)*s,y:H/2-(x-cx)*s-z*s*.35,s}),scaleAt:()=>s,portrait};
  return {s0:s,ortho:true,p:(x,y,z=0)=>({x:W/2+(x-cx)*s,y:H/2+(y-cy)*s-z*s*.35,s}),scaleAt:()=>s};
 }
 const gyk=y=>HC/Math.max(8,NEAR+D-y);// hauteur écran par unité de F
 const ext=gyk(72)-gyk(-5);
 const usableTop=H*.1,usableBot=H-Math.min(84,H*.16);
 const fitH=(usableBot-usableTop)/ext;
 let F;
 if(r.mode==='full')F=Math.min(W*(NEAR+D-70)/126,fitH*1.04);
 else{const dzF=NEAR+D-r.camY;F=W*dzF/Math.max(14,r.camL);
  // écran haut (portrait / tablette) : on cadre sur la profondeur pour remplir l'écran
  F=Math.max(F,fitH*.92*(r.mode==='close'?1.45:r.mode==='wide'?.82:1.05)*r.zoom)}
 let Y0=H*.55-gyk(r.camY)*F;
 const top=Y0+gyk(-5)*F,bot=Y0+gyk(72)*F;
 if(bot-top<=usableBot-usableTop)Y0=(usableTop+usableBot)/2-(gyk(-5)+gyk(72))*F/2;
 else{if(top>usableTop)Y0-=top-usableTop;if(Y0+gyk(72)*F<usableBot)Y0+=usableBot-(Y0+gyk(72)*F)}
 return {F,p:(x,y,z=0)=>{const dz=Math.max(8,NEAR+D-y);const s=F/dz;return {x:W/2+(x-r.camX)*s,y:Y0+HC*s-z*s,s}},scaleAt:y=>F/Math.max(8,NEAR+D-y)};
}
R2D.project=(r)=>makeProj(r);

/* ---------- Caméra ---------- */
R2D.updateCamera=function(r,M,dt,alpha=1){
 const b=M.ball;const bx=b.px!=null?b.px+(b.x-b.px)*alpha:b.x,by=b.py!=null?b.py+(b.y-b.py)*alpha:b.y;
 let tx=bx+clamp(b.vx||0,-9,9)*.55,ty=by;
 if(M.phase==='lineout'||M.phase==='scrum'){tx=M.pd.x??bx;ty=M.pd.side!=null?(M.pd.side===0?8:62):(M.pd.y??by)}
 if(M.phase==='goalkick'){tx=(M.pd.x+RM2.X(M,M.pd.team,100))/2;ty=35}
 const m=r.mode;
 let L=(CAM[m]?.L||44)/r.zoom;
 if(m==='full'){tx=50;ty=35}
 if(m==='tactical'){r.camX+=(50-r.camX)*.2;r.camY+=(35-r.camY)*.2;r.zoom=clamp(r.zoom,1,2.2);if(r.zoom>1.01){r.camX=50+(tx-50)*.9*(1-1/r.zoom);r.camY=35+(ty-35)*.9*(1-1/r.zoom)}return}
 // garder le cadre à l'intérieur du stade
 const half=L/2;tx=clamp(tx,-12+half*.7,112-half*.7);
 const k=1-Math.exp(-dt*(m==='close'?3.2:2.4));
 r.camX+=(tx-r.camX)*k;
 const fy=m==='full'?35:clamp(ty*.8+35*.2,4,68);
 r.camY+=(fy-r.camY)*(1-Math.exp(-dt*1.6));
 r.camL+=(L-r.camL)*(1-Math.exp(-dt*3));
};
R2D.snapCamera=function(r,M){r.camX=M.ball.x;r.camY=35;r.camL=(CAM[r.mode]?.L||44)/r.zoom};

/* ---------- Terrain ---------- */
function quad(ctx,P,a,b,c,d){ctx.beginPath();const A=P(...a),B=P(...b),C=P(...c),Dd=P(...d);ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.lineTo(C.x,C.y);ctx.lineTo(Dd.x,Dd.y);ctx.closePath()}
function line(ctx,P,x1,y1,x2,y2,w,dash){const A=P(x1,y1),B=P(x2,y2);ctx.lineWidth=Math.max(1,w*Math.min(A.s,B.s));if(dash)ctx.setLineDash(dash.map(v=>Math.max(2,v*Math.min(A.s,B.s))));ctx.beginPath();ctx.moveTo(A.x,A.y);ctx.lineTo(B.x,B.y);ctx.stroke();if(dash)ctx.setLineDash([])}
function drawPitch(r,M,pr){
 const ctx=r.ctx,P=pr.p,W=r.W,H=r.H;
 // ciel / tribunes
 const g=ctx.createLinearGradient(0,0,0,H*.5);g.addColorStop(0,'#05090e');g.addColorStop(1,'#132332');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 if(!pr.ortho){
  // tribune lointaine
  const t1=P(-40,-9,0),t2=P(140,-9,0),t3=P(140,-9,8),t4=P(-40,-9,8);
  ctx.fillStyle='#1b2734';ctx.beginPath();ctx.moveTo(t1.x,t1.y);ctx.lineTo(t2.x,t2.y);ctx.lineTo(t3.x,t3.y);ctx.lineTo(t4.x,t4.y);ctx.fill();
  crowd(r,P);
  // panneaux publicitaires
  for(let x=-14;x<114;x+=8){const a=P(x,-5,0),b=P(x+7.8,-5,0),c=P(x+7.8,-5,1),d=P(x,-5,1);ctx.fillStyle=(Math.floor(x/8)%2)?'#1d4f7a':'#c8a24a';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.fill();
   if(a.s>6){ctx.fillStyle='rgba(255,255,255,.85)';ctx.font=`700 ${Math.max(7,a.s*.55)|0}px system-ui`;ctx.textAlign='center';ctx.fillText((Math.floor(x/8)%2)?'RM27':'JLG CREATIVE',(a.x+b.x)/2,(a.y+d.y)/2+a.s*.2)}}
 }
 // pelouse : bandes de tonte tous les 5 m
 quad(ctx,P,[-16,-6],[116,-6],[116,76],[-16,76]);ctx.fillStyle='#1f5e34';ctx.fill();
 for(let x=-10;x<110;x+=5){quad(ctx,P,[x,0],[x+5,0],[x+5,70],[x,70]);ctx.fillStyle=(Math.round(x/5)%2)?'#2f7a43':'#2a7140';ctx.fill()}
 // en-buts
 for(const [a,b] of [[-10,0],[100,110]]){quad(ctx,P,[a,0],[b,0],[b,70],[a,70]);ctx.fillStyle='rgba(20,60,40,.25)';ctx.fill()}
 ctx.strokeStyle='rgba(248,252,246,.92)';
 const w=.12;
 line(ctx,P,-10,0,110,0,w);line(ctx,P,-10,70,110,70,w);line(ctx,P,-10,0,-10,70,w);line(ctx,P,110,0,110,70,w);
 line(ctx,P,0,0,0,70,w*1.3);line(ctx,P,100,0,100,70,w*1.3);
 line(ctx,P,22,0,22,70,w);line(ctx,P,78,0,78,70,w);line(ctx,P,50,0,50,70,w);
 for(const x of [40,60])line(ctx,P,x,0,x,70,w,[1.2,1.2]);
 for(const x of [5,95])for(const y of [5,15,25,35,45,55,65])line(ctx,P,x,y-1,x,y+1,w);
 for(const y of [5,15,55,65])for(let x=5;x<100;x+=5){if(x===50)continue;line(ctx,P,x-.9,y,x+.9,y,w)}
 // marques au sol
 if(pr.ortho||P(50,35).s>5){ctx.fillStyle='rgba(248,252,246,.55)';ctx.textAlign='center';
  for(const [x,t] of [[22,'22'],[40,'10'],[50,'50'],[60,'10'],[78,'22']]){const a=P(x+1.6,10);ctx.font=`700 ${Math.max(8,a.s*1.4)|0}px system-ui`;ctx.fillText(t,a.x,a.y)}}
}
function crowd(r,P){
 const ctx=r.ctx;
 if(!r._crowd){const c=document.createElement('canvas');c.width=512;c.height=96;const g=c.getContext('2d');g.fillStyle='#1e2a36';g.fillRect(0,0,512,96);
  let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
  const pal=['#c9d6dc','#8fa3b2','#d5b48e','#4f7792','#b84a4a','#e8e1cf','#5a6b7a'];
  for(let y=4;y<96;y+=6)for(let x=2;x<512;x+=5){g.fillStyle=pal[Math.floor(rnd()*pal.length)];g.globalAlpha=.55+rnd()*.4;g.fillRect(x+rnd()*1.5,y+rnd(),2.6,3.6)}
  r._crowd=c}
 const a=P(-40,-9,1.4),b=P(140,-9,7.6);
 const h=Math.max(4,a.y-b.y);
 ctx.save();ctx.globalAlpha=.9;
 const pat=ctx.createPattern(r._crowd,'repeat');
 ctx.fillStyle=pat;
 const sc=h/96;ctx.translate(a.x,b.y);ctx.scale(sc,sc);ctx.fillRect(0,0,(b.x-a.x)/sc,96);ctx.restore();
}
function drawPosts(r,M,pr,which){
 const ctx=r.ctx,P=pr.p;
 for(const gx of which){
  const L=P(gx,32.2,0),Rr=P(gx,37.8,0);
  const tall=pr.ortho?0:14;
  ctx.strokeStyle='#f4f1e6';
  for(const yy of [32.2,37.8]){const a=P(gx,yy,0),b=P(gx,yy,tall||0);ctx.lineWidth=Math.max(1.5,.16*a.s);
   if(pr.ortho){ctx.fillStyle='#f4f1e6';ctx.beginPath();ctx.arc(a.x,a.y,Math.max(2,.35*a.s),0,7);ctx.fill();continue}
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.fillStyle='#2a6fb0';const pa=P(gx,yy,1.6);ctx.fillRect(a.x-.22*a.s,pa.y,.44*a.s,a.y-pa.y)}
  if(pr.ortho){line(ctx,P,gx,32.2,gx,37.8,.18);continue}
  const c1=P(gx,32.2,3),c2=P(gx,37.8,3);ctx.lineWidth=Math.max(1.5,.14*c1.s);ctx.beginPath();ctx.moveTo(c1.x,c1.y);ctx.lineTo(c2.x,c2.y);ctx.stroke();
 }
}

/* ---------- Joueurs ---------- */
function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=(n>>16)&255,g=(n>>8)&255,b=n&255;r=clamp(Math.round(r*k),0,255);g=clamp(Math.round(g*k),0,255);b=clamp(Math.round(b*k),0,255);return `rgb(${r},${g},${b})`}
function limb(ctx,x1,y1,x2,y2,x3,y3,w,col){ctx.strokeStyle=col;ctx.lineWidth=w;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.lineTo(x3,y3);ctx.stroke()}
function drawAthlete(r,M,p,pos,kit,alpha,hasBall,proj){
 const ctx=r.ctx;const k=pos.s;const h=p.h;
 const sp=Math.hypot(p.vx,p.vy);
 const ortho=proj.ortho;
 // orientation écran
 let fx=Math.cos(p.hd),fy=Math.sin(p.hd);
 if(proj.portrait){const t=fx;fx=fy;fy=-t}
 const face=fx>=0?1:-1;
 const side=Math.abs(fx);
 const X0=pos.x,Y0=pos.y;
 const build=p.num<=3?1.22:p.num<=5?1.05:p.num<=8?1.1:p.num===9?.86:1;
 const shoulderW=.5*build*k*(.55+.45*(1-side));
 const pose=p.pose;
 // ombre
 ctx.fillStyle='rgba(0,0,0,.28)';ctx.beginPath();ctx.ellipse(X0,Y0,.42*k*build,.15*k,0,0,7);ctx.fill();
 if(ortho&&k<9){// vue tactique compacte : pastille orientée
  ctx.fillStyle=kit.main;ctx.beginPath();ctx.arc(X0,Y0,Math.max(5,.6*k),0,7);ctx.fill();ctx.lineWidth=1.2;ctx.strokeStyle=kit.trim;ctx.stroke();
  ctx.strokeStyle=kit.trim;ctx.beginPath();ctx.moveTo(X0,Y0);ctx.lineTo(X0+fx*Math.max(5,.9*k),Y0+fy*Math.max(5,.9*k)*(proj.portrait?1:1));ctx.stroke();
  if(k>3.5){ctx.fillStyle=kit.num;ctx.font=`700 ${Math.max(7,.62*k)|0}px system-ui`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.num,X0,Y0+.5);ctx.textBaseline='alphabetic'}
  if(hasBall){ctx.fillStyle='#f6e7c8';ctx.beginPath();ctx.ellipse(X0+.6*k,Y0-.2*k,Math.max(2,.25*k),Math.max(1.4,.16*k),0,0,7);ctx.fill()}
  return;
 }
 const skin=SKIN[p.skin],hair=HAIR[p.hair];
 const lift=(p.mode==='lift'?(p.z||0):0)+(pose==='leap'?.45:0);
 const base=Y0-lift*k;
 // postures couchées / liées
 if(pose==='ground'||pose==='dive'&&p.mode==='ground'){
  const len=h*.95*k,ang=face>0?0:Math.PI;
  ctx.save();ctx.translate(X0,Y0-.12*k);
  ctx.fillStyle=kit.shorts;ctx.fillRect(face>0?-len*.55:len*.15,-.13*k,len*.4,.26*k);
  limb(ctx,face*-len*.2,0,face*-len*.45,.05*k,face*-len*.6,0,.15*k,kit.socks);
  ctx.fillStyle=kit.main;ctx.beginPath();ctx.ellipse(face*len*.12,0,len*.24,.2*k,0,0,7);ctx.fill();
  ctx.fillStyle=skin;ctx.beginPath();ctx.arc(face*len*.42,-.04*k,.12*k,0,7);ctx.fill();
  ctx.restore();return;
 }
 const crouch=['bind','ruck','scrum','maul','jackal','feed','place','tackle','dive'].includes(pose)||p.mode==='bound';
 const isScrum=pose==='scrum'||p.bind==='scrum';
 let hipH=h*.5,shH=h*.8,lean=0;
 if(crouch){hipH=h*(isScrum?.36:.42);shH=h*(isScrum?.42:.56);lean=isScrum?1.25:pose==='jackal'?.9:1.0}
 else if(pose==='tackle'||pose==='tackled'||pose==='contact'){lean=pose==='tackle'?.8:-.15;hipH=h*.46;shH=h*.72}
 else lean=Math.min(.38,sp/9*.42);
 // foulée indexée sur la distance parcourue
 const ph=p.gait;
 const amp=crouch?.15:sp<.25?0:Math.min(1,.25+sp/8.5);
 const legL=hipH*k;
 const hipX=X0,hipY=base-hipH*k;
 const shX=hipX+face*Math.sin(lean)*(shH-hipH)*k*side+(crouch?face*(shH-hipH)*k*.0:0);
 const shY=base-((shH-hipH)*Math.cos(lean)+hipH)*k;
 const legs=[0,Math.PI].map(o=>{
  const u=Math.sin(ph+o),v=Math.cos(ph+o);
  let fwd=u*amp*.55*h,lft=v>0?v*amp*.22*h:0;
  if(pose==='kick'&&o===0){fwd=.7*h;lft=.55*h}
  if(sp<.25&&!crouch){fwd=(o?-.06:.08)*h;lft=0}
  if(crouch){fwd=(o?-.35:-.15)*h;lft=0}
  const fx2=hipX+face*fwd*k*Math.max(.35,side)+(1-side)*(o?-.09:.09)*k;
  const fy2=base-lft*k+(1-side)*fwd*.12*k*Math.sign(fy||1);
  const kx=(hipX+fx2)/2+face*(.12*h*k*(crouch?1.6:amp+.2))*Math.max(.35,side),ky=(hipY+fy2)/2-(lft*.3)*k;
  return {fx:fx2,fy:fy2,kx,ky,back:o===Math.PI};
 });
 // jambe arrière
 const lb=legs[1],lf=legs[0];
 const depthBack=Math.sign(fy||1)<0;
 const legW=Math.max(1.6,.15*k*build);
 const drawLeg=(L,dim)=>{limb(ctx,hipX,hipY,L.kx,L.ky,L.fx,L.fy,legW,dim?shade(kit.socksHex,.78):kit.socks);
  ctx.strokeStyle=kit.shorts;ctx.lineWidth=legW*1.15;ctx.beginPath();ctx.moveTo(hipX,hipY);ctx.lineTo(hipX+(L.kx-hipX)*.45,hipY+(L.ky-hipY)*.45);ctx.stroke();
  ctx.fillStyle='#161616';ctx.beginPath();ctx.ellipse(L.fx+face*.05*k,L.fy,Math.max(1.6,.13*k),Math.max(1,.06*k),0,0,7);ctx.fill()};
 drawLeg(lb,true);
 // bras arrière
 const armL=(shH-hipH)*k*1.05;
 const swing=crouch?0:Math.sin(ph)*amp*.9;
 const armPose=(which)=>{
  let ax,ay;
  const sgn=which?1:-1;
  if(hasBall&&which===0&&!['pass','kick'].includes(pose)){ax=shX+face*.28*k;ay=shY+armL*.55;return [ax,ay,shX+face*.1*k,shY+armL*.45]}
  if(pose==='catch'||pose==='leap'||p.mode==='lift'||pose==='throw'){return [shX+face*.15*k+sgn*.06*k,shY-armL*.95,shX+face*.1*k,shY-armL*.45]}
  if(pose==='pass'){return [shX+face*armL*.95,shY+armL*.15+sgn*.06*k,shX+face*armL*.5,shY+armL*.1]}
  if(crouch||pose==='tackle'||pose==='dive'){return [shX+face*armL*.9,shY+armL*.35,shX+face*armL*.45,shY+armL*.25]}
  if(pose==='contact'||pose==='tackled'){return [shX+face*.3*k,shY+armL*.6,shX+face*.25*k,shY+armL*.3]}
  const a=sgn*swing;return [shX+face*Math.sin(a)*armL*side,shY+Math.cos(a)*armL*.95,shX+face*Math.sin(a)*armL*.5*side+face*.05*k,shY+armL*.45];
 };
 const armW=Math.max(1.3,.11*k*build);
 const aB=armPose(1);limb(ctx,shX,shY+.04*k,aB[2],aB[3],aB[0],aB[1],armW,shade(kit.skinHex||'#d9a47c',.82));
 // torse (maillot)
 ctx.save();
 ctx.translate((hipX+shX)/2,(hipY+shY)/2);
 const ang=Math.atan2(shY-hipY,shX-hipX)+Math.PI/2;
 ctx.rotate(ang);
 const tl=Math.hypot(shX-hipX,shY-hipY)*1.12,tw=shoulderW;
 ctx.fillStyle=kit.main;
 ctx.beginPath();ctx.moveTo(-tw*.42,tl*.52);ctx.lineTo(tw*.42,tl*.52);ctx.lineTo(tw*.55,-tl*.42);ctx.quadraticCurveTo(0,-tl*.62,-tw*.55,-tl*.42);ctx.closePath();ctx.fill();
 if(kit.pattern===1){ctx.fillStyle=kit.trim;ctx.fillRect(-tw*.5,-tl*.05,tw,tl*.18)}
 else if(kit.pattern===2){ctx.fillStyle=kit.trim;ctx.fillRect(-tw*.12,-tl*.5,tw*.24,tl)}
 else{ctx.fillStyle=kit.trim;ctx.fillRect(-tw*.55,-tl*.44,tw*1.1,tl*.1)}
 if(k>15&&(side<.75||fy<-.3)){ctx.fillStyle=kit.num;ctx.font=`800 ${Math.max(7,tl*.38)|0}px system-ui`;ctx.textAlign='center';ctx.fillText(p.num,0,tl*.18)}
 ctx.restore();
 // jambe avant (devant le torse si de profil)
 drawLeg(lf,false);
 // tête
 const hx=shX+face*Math.sin(lean)*.16*k*side+(crouch?face*.18*k:0),hy=shY-.17*k*(crouch?.4:1);
 const hr=Math.max(2,.12*k);
 ctx.fillStyle=skin;ctx.beginPath();ctx.arc(hx,hy,hr,0,7);ctx.fill();
 ctx.fillStyle=p.num<=5&&p.hair%2===0?kit.trimHex||'#222':hair;ctx.beginPath();ctx.arc(hx-face*hr*.15,hy-hr*.12,hr*1.02,Math.PI*1.05,Math.PI*2.02);ctx.fill();
 // bras avant
 const aF=armPose(0);limb(ctx,shX,shY+.05*k,aF[2],aF[3],aF[0],aF[1],armW,skin);
 if(hasBall){const bx=aF[0]+face*.08*k,by=aF[1]-.04*k;drawBallShape(ctx,bx,by,k,face*.5)}
 // repères
 if(r.labels&&k>7){ctx.font=`600 ${Math.max(9,Math.min(13,k*.55))|0}px system-ui`;ctx.textAlign='center';ctx.fillStyle='rgba(0,0,0,.55)';const t=p.num+' '+p.short;const w=ctx.measureText(t).width+6;ctx.fillRect(X0-w/2,base-h*k-hr*2-15,w,14);ctx.fillStyle='#fff';ctx.fillText(t,X0,base-h*k-hr*2-4)}
}
function drawBallShape(ctx,x,y,k,rot){
 ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.fillStyle='#f4ead2';ctx.beginPath();ctx.ellipse(0,0,Math.max(2.4,.17*k),Math.max(1.6,.105*k),0,0,7);ctx.fill();
 ctx.strokeStyle='#8a5a2b';ctx.lineWidth=Math.max(.6,.025*k);ctx.beginPath();ctx.moveTo(-.1*k,0);ctx.lineTo(.1*k,0);ctx.stroke();ctx.restore();
}
function kitFor(M,t){
 const T=M.T[t];const main=T.color||'#ddd',trim=T.color2||'#111';
 const lum=h=>{const n=parseInt(h.slice(1),16);return ((n>>16)&255)*.3+((n>>8)&255)*.59+(n&255)*.11};
 return {main,trim,trimHex:trim,num:lum(main)>150?'#111':'#fff',shorts:lum(main)>170?'#1c2433':'#f2f2f2',socks:main,socksHex:main,pattern:RM2.hash(T.name)%3,skinHex:'#c9926a'};
}
R2D.kitFor=kitFor;

/* ---------- Image complète ---------- */
R2D.draw=function(r,M,alpha){
 R2D.resize(r);
 const ctx=r.ctx;ctx.setTransform(r.dpr,0,0,r.dpr,0,0);ctx.imageSmoothingEnabled=true;
 const pr=makeProj(r);
 drawPitch(r,M,pr);
 const lerp=(a,b)=>a+(b-a)*alpha;
 const kits=[kitFor(M,0),kitFor(M,1)];
 if(r.overlay)drawOverlay(r,M,pr,alpha);
 const list=[];
 for(const p of M.P){if(p.mode==='off'||p.mode==='bin')continue;const x=p.enterAt>=0&&M.t-p.enterAt<.15?p.x:lerp(p.px??p.x,p.x),y=p.enterAt>=0&&M.t-p.enterAt<.15?p.y:lerp(p.py??p.y,p.y);list.push({p,x,y})}
 // poteaux lointains d'abord, puis tri par profondeur
 drawPosts(r,M,pr,[0,100].filter(()=>false));
 const b=M.ball;
 const bx=b.px!=null?lerp(b.px,b.x):b.x,by=b.py!=null?lerp(b.py,b.y):b.y,bz=b.z||0;
 const holder=b.st==='held'?b.owner:-1;
 list.sort((a,c)=>pr.portrait?(c.x-a.x)*(RM2.dir?1:1):a.y-c.y);
 // poteaux : dessinés à leur profondeur (milieu)
 let postsDrawn=false;
 const ballItem={ball:true,y:by};
 const items=[...list];
 // ombre du ballon
 if(b.st!=='held'){const s=pr.p(bx,by,0);ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(s.x,s.y,Math.max(1.5,.16*s.s),Math.max(1,.06*s.s),0,0,7);ctx.fill()}
 let ballDrawn=false;
 for(const it of items){
  if(!postsDrawn&&!pr.portrait&&it.y>35){drawPosts(r,M,pr,[0,100]);postsDrawn=true}
  if(!ballDrawn&&b.st!=='held'&&!pr.portrait&&it.y>by){drawBall(r,pr,bx,by,bz,M);ballDrawn=true}
  const s=pr.p(it.x,it.y,0);
  if(s.x<-60||s.x>r.W+60||s.y<-80||s.y>r.H+80)continue;
  const p=it.p;
  // halo du porteur
  if(p.i===holder){ctx.strokeStyle='rgba(255,226,120,.9)';ctx.lineWidth=Math.max(1.2,.06*s.s);ctx.beginPath();ctx.ellipse(s.x,s.y,.62*s.s,.24*s.s*(pr.ortho?2.4:1),0,0,7);ctx.stroke()}
  drawAthlete(r,M,p,s,kits[p.team],alpha,p.i===holder,pr);
 }
 if(!postsDrawn)drawPosts(r,M,pr,[0,100]);
 if(!ballDrawn&&b.st!=='held')drawBall(r,pr,bx,by,bz,M);
 // indicateur hors champ du ballon
 const bs=pr.p(bx,by,bz);
 if(bs.x<8||bs.x>r.W-8){ctx.fillStyle='rgba(255,226,120,.95)';const x=bs.x<8?10:r.W-10;ctx.beginPath();ctx.moveTo(x,clamp(bs.y,20,r.H-20));ctx.lineTo(x+(bs.x<8?12:-12),clamp(bs.y,20,r.H-20)-7);ctx.lineTo(x+(bs.x<8?12:-12),clamp(bs.y,20,r.H-20)+7);ctx.fill()}
 // FPS
 const now=performance.now();r.frames++;if(now-r.fpsT>1000){r.fps=Math.round(r.frames*1000/(now-r.fpsT));r.frames=0;r.fpsT=now}
};
function drawBall(r,pr,x,y,z,M){const s=pr.p(x,y,z);const spin=(M.t*(M.ball.spin||6))%(Math.PI*2);drawBallShape(r.ctx,s.x,s.y,Math.max(s.s,6),M.ball.st==='air'?spin:0)}
function drawOverlay(r,M,pr,alpha){
 const ctx=r.ctx;
 // ligne défensive et cellules offensives
 const c=RM2.carrier(M);const att=c?c.team:M.poss;if(att!==0&&att!==1)return;
 const defs=M.P.filter(p=>p.team!==att&&p.task==='ligne'||p.team!==att&&p.task==='garde du ruck').sort((a,b)=>a.y-b.y);
 if(defs.length>1){ctx.strokeStyle='rgba(255,90,90,.75)';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();defs.forEach((p,k)=>{const s=pr.p(p.x,p.y);k?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.stroke();ctx.setLineDash([])}
 const pl=M.play&&M.play.team===att?M.play:null;
 if(pl){ctx.strokeStyle='rgba(120,210,255,.8)';ctx.lineWidth=2;ctx.beginPath();pl.seq.forEach((i,k)=>{const p=M.P[i];const s=pr.p(p.x,p.y);k?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y)});ctx.stroke()}
 for(const p of M.P){if(p.team!==att||p.task!=='cellule')continue;const s=pr.p(p.x,p.y);ctx.fillStyle='rgba(120,210,255,.35)';ctx.beginPath();ctx.arc(s.x,s.y,Math.max(4,.8*s.s),0,7);ctx.fill()}
}
})(typeof window!=='undefined'?window:globalThis);
