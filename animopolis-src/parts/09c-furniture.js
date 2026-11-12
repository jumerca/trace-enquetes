
/* =========================================================
   MOBILIER DE RUE ET DÉCOR D'AMBIANCE
   Lampadaires, poubelles, bancs, jardinières aux coins des îlots ;
   guirlandes à fanions dans la Fête foraine.
   ========================================================= */
function distOf(u,v){return v>=2032?4:u>=2120?5:u>=1180?(v>=1180?3:1):(v>=1180?2:0);}
function addBunting(u0,v0,u1,v1,hgt){const[xa,ya]=pr(u0,v0,0),[xb,yb]=pr(u1,v1,0);const n=Math.max(8,Math.round(Math.hypot(xb-xa,yb-ya)/16));
  addSpr((u0+u1)/2,(v0+v1)/2,(c,x,y)=>{const dx=xb-xa,dy=yb-ya;c.strokeStyle=INK;c.lineWidth=1.4;
    const ax=xa-(xa+xb)/2+x,ay=ya-(ya+yb)/2+y,bx=xb-(xa+xb)/2+x,by=yb-(ya+yb)/2+y;
    L(c,ax,ay,ax,ay-hgt);L(c,bx,by,bx,by-hgt);
    const pt=t=>[ax+(bx-ax)*t,ay+(by-ay)*t-hgt+Math.sin(t*PI)*9];
    c.lineWidth=.8;c.beginPath();for(let i=0;i<=24;i++){const[px,py]=pt(i/24);i?c.lineTo(px,py):c.moveTo(px,py);}c.stroke();
    for(let i=1;i<n;i++){const[px,py]=pt(i/n);const col=i%3===0?RED:i%3===1?WHITE:'#e6c14a';P(c,[[px-3.4,py],[px+3.4,py],[px,py+7.5]],col);}
    D(c,ax,ay-hgt,1.6,'#e6c14a');D(c,bx,by-hgt,1.6,'#e6c14a');},{top:true,ht:hgt+14,hw:Math.abs(xb-xa)/2+8,z:0});}
function buildFurniture(){
  const fr=mulberry32(5150);const rnd2=()=>fr();
  const blocks=[];
  for(let i=0;i<4;i++)for(let j=0;j<4;j++)blocks.push([i,j]);
  for(const d of[1,2,3])for(const b of DISTRICTS[d].blocks)blocks.push(b);
  for(const b of[[3,7],[4,7]])blocks.push(b);
  let nL=0,nB=0,nN=0;
  for(const[i,j]of blocks){const k=blk(i,j),d=distOf(k.uc,k.vc);CURD=d;
    const spots=[[k.u1+7,k.v1+7,'lamp'],[k.u0-7,k.v1+7,'lamp'],[k.u1+7,k.v0+70+rnd2()*100,'bin'],[k.u0+60+rnd2()*110,k.v1+9,'bench']];
    if(d===2&&rnd2()<.8)spots.push([k.u1+8,k.v0+rnd2()*200,'lamp']);
    for(const[u,v,kind]of spots){if(!free(u,v,12))continue;
      if(kind==='lamp'){addLamp(u,v);nL++;}
      else if(kind==='bin'){addBin(u,v);nB++;}
      else{addBench(u,v,false);nN++;}}
    // jardinières devant les immeubles : 1 sur 3
    if(d<=1&&rnd2()<.34){const u=k.u0+30+rnd2()*180,v=k.v0+46;if(free(u,v,10)){addSpr(u,v,(c,x,y)=>{c.strokeStyle=INK;c.lineWidth=1;Rc(c,x-7,y-5,14,5,'#d8c8a4');for(const dx of[-4,0,4])C(c,x+dx,y-8,3,WHITE);for(const dx of[-4,0,4])D(c,x+dx,y-8,.8,'#c94a3f');},{ht:14,hw:10});avoid(u,v,8);}}}
  // guirlandes de la Fête foraine, le long des rues
  CURD=2;
  for(let i=0;i<4;i++){for(const j of[4,5,6]){const k=blk(i,j);
    if(rnd2()<.8)addBunting(k.u0+14,k.v0-8,k.u1-14,k.v0-8,44);
    if(i===0||rnd2()<.35)addBunting(k.u0-8,k.v0+14,k.u0-8,k.v1-14,44);}}
  CURD=0;
}
