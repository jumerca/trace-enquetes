'use strict';
/* =========================================================
   ANIMOPOLIS — jeu d'enquête "cherche et trouve" sur une
   immense carte dessinée en noir et blanc.
   ========================================================= */
const INK='#1d1b18', WHITE='#ffffff', GREY='#b9b3a6', LGREY='#e2ddd0', PAPER='#f3efe4', RED='#d8352a';
const PI=Math.PI, TAU=Math.PI*2;

/* ---------- aléatoire déterministe ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const rnd=mulberry32(20261110);
const R=(a,b)=>a+rnd()*(b-a), RI=(a,b)=>Math.floor(R(a,b+1)), pick=a=>a[Math.floor(rnd()*a.length)];

/* ---------- primitives de dessin ---------- */
function P(c,pts,f){c.beginPath();c.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.closePath();if(f){c.fillStyle=f;c.fill();}c.stroke();}
function E(c,x,y,rx,ry,f,rot){c.beginPath();c.ellipse(x,y,Math.abs(rx),Math.abs(ry),rot||0,0,TAU);if(f){c.fillStyle=f;c.fill();}c.stroke();}
function C(c,x,y,r,f){E(c,x,y,r,r,f);}
function D(c,x,y,r,f){c.beginPath();c.arc(x,y,r||.75,0,TAU);c.fillStyle=f||INK;c.fill();}
function Rc(c,x,y,w,h,f){if(f){c.fillStyle=f;c.fillRect(x,y,w,h);}c.strokeRect(x,y,w,h);}
function L(c,x1,y1,x2,y2){c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
function stripesIn(c,x0,y0,x1,y1,step,thick,vertical,col){c.fillStyle=col||INK;if(vertical){for(let x=x0;x<x1;x+=step)c.fillRect(x,y0,thick,y1-y0);}else{for(let y=y0;y<y1;y+=step)c.fillRect(x0,y,x1-x0,thick);}}

/* motif d'un vêtement (le chemin courant doit être déjà construit) */
function fillWith(c,fill,bb){
  if(fill==='black'){c.fillStyle=INK;c.fill();}
  else if(fill==='grey'){c.fillStyle='#a8a296';c.fill();}
  else{
    c.fillStyle=WHITE;c.fill();
    if(fill==='stripes'||fill==='dots'||fill==='check'){
      c.save();c.clip();c.fillStyle=INK;
      const[x0,y0,x1,y1]=bb;
      if(fill==='stripes')stripesIn(c,x0,y0+.6,x1,y1,2.6,1.15,false);
      else if(fill==='check'){stripesIn(c,x0,y0,x1,y1,3,1,false,'#6e685d');stripesIn(c,x0,y0,x1,y1,3,1,true,'#6e685d');}
      else{for(let y=y0+1.2,k=0;y<y1;y+=2.5,k++)for(let x=x0+(k%2?1.25:0);x<x1;x+=2.5){c.beginPath();c.arc(x,y,.6,0,TAU);c.fill();}}
      c.restore();
    }
  }
  c.stroke();
}

