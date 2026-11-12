/* ---------- les têtes d'animaux ---------- */
const HEADS=['cat','fox','rabbit','bear','mouse','pig','owl','dog','elephant','frog','duck','croc','hedgehog','penguin','lion'];
function drawHead(c,s,d){
  const h=s.head, r=5.2;
  c.lineWidth=1.05;c.strokeStyle=INK;
  let hf=WHITE;
  // oreilles et éléments derrière la tête
  switch(h){
    case 'cat':P(c,[[-4.6,-2],[-4.4,-8.6],[-.8,-4.6]],WHITE);P(c,[[4.6,-2],[4.4,-8.6],[.8,-4.6]],WHITE);break;
    case 'fox':P(c,[[-4.8,-1.5],[-5.3,-10.2],[-.6,-4.4]],WHITE);P(c,[[4.8,-1.5],[5.3,-10.2],[.6,-4.4]],WHITE);D(c,-4.4,-7.4,.9);D(c,4.4,-7.4,.9);break;
    case 'rabbit':E(c,-2.3,-9.2,1.8,5.4,WHITE,-.15);E(c,2.3,-9.2,1.8,5.4,WHITE,.15);break;
    case 'bear':C(c,-4,-4.1,2.2,WHITE);C(c,4,-4.1,2.2,WHITE);break;
    case 'mouse':C(c,-4.7,-4,3.3,WHITE);C(c,4.7,-4,3.3,WHITE);break;
    case 'pig':P(c,[[-4.5,-2.5],[-4.9,-6.9],[-1.5,-4.8]],WHITE);P(c,[[4.5,-2.5],[4.9,-6.9],[1.5,-4.8]],WHITE);break;
    case 'owl':P(c,[[-4.5,-2],[-4.8,-7.8],[-1.8,-4.8]],INK);P(c,[[4.5,-2],[4.8,-7.8],[1.8,-4.8]],INK);break;
    case 'elephant':hf='#d9d4c8';E(c,-5.9,0,3.9,4.9,hf);E(c,5.9,0,3.9,4.9,hf);break;
    case 'croc':hf='#d8d4c6';break;
    case 'penguin':hf=INK;break;
    case 'lion':{c.beginPath();for(let i=0;i<=18;i++){const a=i*TAU/18,rr=i%2?r+3.6:r+1.6;const px=Math.cos(a)*rr,py=Math.sin(a)*rr;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fillStyle='#d9cfae';c.fill();c.stroke();C(c,-3.6,-3.8,1.5,WHITE);C(c,3.6,-3.8,1.5,WHITE);break;}
    case 'hedgehog':{c.beginPath();for(let i=0;i<=14;i++){const a=PI+i*PI/14,rr=i%2?r+3.4:r-.3;const px=Math.cos(a)*rr*1.08,py=Math.sin(a)*rr+.3;i?c.lineTo(px,py):c.moveTo(px,py);}c.closePath();c.fillStyle=INK;c.fill();break;}
  }
  C(c,0,0,r,hf);
  // museaux longs
  if(h==='croc'){P(c,[[d*2.5,-.9],[d*11,.2],[d*11.3,3.4],[d*2.5,3.6]],hf);c.lineWidth=.6;c.beginPath();for(let k=0;k<5;k++){const xx=d*(4+k*1.5);c.moveTo(xx,2.1);c.lineTo(xx+d*.7,3.3);}c.stroke();D(c,d*10.3,.8,.45);C(c,-1.2,-4.8,1.3,hf);C(c,1.6,-4.8,1.3,hf);c.lineWidth=1.05;}
  if(h==='duck'){E(c,d*4.2,1.5,3.4,1.5,'#e8deb8');}
  if(h==='penguin'){c.lineWidth=.6;E(c,0,.6,3.7,3.9,WHITE);c.lineWidth=1.05;}
  // yeux
  if(h==='owl'){C(c,-2,-.8,1.9,WHITE);C(c,2,-.8,1.9,WHITE);D(c,-2+d*.4,-.8,.85);D(c,2+d*.4,-.8,.85);P(c,[[-.8,1],[.8,1],[0,2.9]],INK);}
  else if(h==='frog'){C(c,-2.6,-4.6,2.1,WHITE);C(c,2.6,-4.6,2.1,WHITE);D(c,-2.6,-4.6,.85);D(c,2.6,-4.6,.85);c.beginPath();c.arc(0,.2,3.1,.35,PI-.35);c.stroke();}
  else if(h==='croc'){D(c,-1.2,-4.8,.6);D(c,1.6,-4.8,.6);}
  else{D(c,-1.9+(h==='duck'?d*.8:0),-.8);D(c,1.9+(h==='duck'?d*.8:0),-.8);}
  c.lineWidth=.55;
  switch(h){
    case 'cat':P(c,[[-.7,1],[.7,1],[0,1.8]],INK);L(c,-1.5,1.8,-5.6,1.1);L(c,-1.5,2.4,-5.6,2.9);L(c,1.5,1.8,5.6,1.1);L(c,1.5,2.4,5.6,2.9);break;
    case 'fox':c.beginPath();c.moveTo(-3.4,.6);c.lineTo(0,3.9);c.lineTo(3.4,.6);c.stroke();D(c,0,3.3,.85);break;
    case 'rabbit':D(c,0,1.3,.6);c.fillStyle=WHITE;c.fillRect(-.75,2.2,1.5,1.5);c.strokeRect(-.75,2.2,1.5,1.5);break;
    case 'bear':c.lineWidth=.9;E(c,0,2.1,2.3,1.6,WHITE);D(c,0,1.5,.75);break;
    case 'mouse':D(c,0,1.6,.75);L(c,-1.2,2,-5,1.4);L(c,1.2,2,5,1.4);L(c,-1.2,2.4,-5,3);L(c,1.2,2.4,5,3);break;
    case 'pig':c.lineWidth=.9;E(c,0,1.9,2.2,1.5,WHITE);D(c,-.75,1.9,.45);D(c,.75,1.9,.45);break;
    case 'dog':E(c,0,1.4,1,.75,INK);c.beginPath();c.moveTo(-1.2,2.8);c.quadraticCurveTo(0,3.6,1.2,2.8);c.stroke();c.lineWidth=1;E(c,-5,.6,1.8,3.9,INK,.3);E(c,5,.6,1.8,3.9,INK,-.3);break;
    case 'elephant':c.lineCap='round';c.beginPath();c.moveTo(0,.6);c.quadraticCurveTo(0,6,d*3.2,8.2);c.lineWidth=3.4;c.strokeStyle=INK;c.stroke();c.lineWidth=1.9;c.strokeStyle='#d9d4c8';c.stroke();c.strokeStyle=INK;break;
    case 'hedgehog':D(c,0,1.7,.95);break;
    case 'penguin':c.lineWidth=.6;P(c,[[-1.2,1.2],[1.2,1.2],[0,3.2]],'#e6c14a');break;
    case 'lion':c.lineWidth=.8;E(c,0,2,2.2,1.5,WHITE);D(c,0,1.4,.7);break;
  }
  c.lineWidth=1.05;
  // couvre-chefs
  switch(s.hat){
    case 'top':c.fillStyle=INK;c.fillRect(-3.4,-13.6,6.8,8.8);c.fillRect(-5.5,-5.5,11,1.5);c.fillStyle=WHITE;c.fillRect(-3.4,-7.5,6.8,1);break;
    case 'cap':c.beginPath();c.arc(0,-3.1,5.35,PI,0);c.closePath();c.fillStyle=INK;c.fill();c.fillRect(d>0?0:-7.6,-3.7,7.6,1.5);break;
    case 'beret':E(c,d*.9,-4.9,5.9,2.05,INK,d*.15);D(c,d*.6,-7.2,.9);break;
    case 'bow':P(c,[[2.2,-5.6],[5.2,-7.8],[5.4,-3.8]],INK);P(c,[[2.2,-5.6],[-.6,-8],[-.3,-3.9]],INK);break;
    case 'chef':C(c,-2.6,-9.3,2.8,WHITE);C(c,2.6,-9.3,2.8,WHITE);C(c,0,-11.2,3,WHITE);Rc(c,-3.6,-8.2,7.2,3.4,WHITE);break;
    case 'police':P(c,[[-4.6,-4.3],[4.6,-4.3],[5.8,-9.2],[-5.8,-9.2]],INK);c.fillStyle=INK;c.fillRect(d>0?-1:-6,-4.8,7,1.5);D(c,0,-6.8,.9,WHITE);break;
    case 'straw':E(c,0,-4.8,7.6,1.6,'#efe6c8');E(c,0,-6.4,3.9,2.4,'#efe6c8');c.fillStyle=INK;c.fillRect(-3.8,-5.6,7.6,.9);break;
    case 'mask':c.fillStyle=INK;c.fillRect(-5.3,-2.3,10.6,2.9);D(c,-1.9,-.9,.7,WHITE);D(c,1.9,-.9,.7,WHITE);break;
    case 'flower':for(let k=0;k<5;k++){const a=k*TAU/5;C(c,3.4+Math.cos(a)*1.2,-4.6+Math.sin(a)*1.2,.9,WHITE);}D(c,3.4,-4.6,.6);break;
    case 'captain':Rc(c,-4.6,-9.6,9.2,4.6,WHITE);c.fillStyle=INK;c.fillRect(-4.6,-5.6,9.2,1.2);c.fillRect(d>0?-.5:-6.8,-5.2,7.3,1.4);D(c,0,-7.6,.9,'#e6c14a');break;
    case 'bandana':P(c,[[-5.3,-2.4],[5.3,-2.4],[3.6,-6.6],[-3.6,-6.6]],INK);P(c,[[-d*5,-3.4],[-d*8,-5.4],[-d*7.6,-1.6]],INK);D(c,d*1.9,-.8,1.4,INK);c.lineWidth=.4;L(c,-5,-2.8,5,-.6);c.lineWidth=1.05;break;
    case 'helmet':c.beginPath();c.arc(0,-2.6,5.8,PI,0);c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();L(c,-2,-8,-2,-3);L(c,2,-8,2,-3);break;
    case 'clown':P(c,[[-4.4,-4.2],[4.4,-4.2],[1,-14]],WHITE);c.save();c.beginPath();c.moveTo(-4.4,-4.2);c.lineTo(4.4,-4.2);c.lineTo(1,-14);c.closePath();c.clip();stripesIn(c,-6,-15,6,-4,3,1.4,false,INK);c.restore();C(c,1,-14.6,1.6,WHITE);D(c,0,1.6,1.5,RED);break;
    case 'bandage':Rc(c,-5.2,-4.6,10.4,2.6,WHITE);c.lineWidth=.5;L(c,-2,-4.6,-1,-2);L(c,2,-4.6,1,-2);c.lineWidth=1.05;D(c,4,-6,.8,RED);break;
    case 'melon':c.beginPath();c.arc(0,-4.4,4.5,PI,0);c.closePath();c.fillStyle=INK;c.fill();E(c,0,-4.4,6.6,1.5,INK);c.fillStyle=WHITE;c.fillRect(-4.4,-5.6,8.8,.9);break;
    case 'crown':P(c,[[-4,-4.6],[4,-4.6],[4.6,-10],[2.3,-7],[0,-10.6],[-2.3,-7],[-4.6,-10]],'#e6c14a');D(c,0,-6.4,.8,RED);break;
    case 'jester':c.beginPath();c.moveTo(-4.6,-4);c.quadraticCurveTo(-6,-9,-9.5,-8.6);c.lineTo(-1.5,-6);c.lineTo(1.5,-6);c.lineTo(9.5,-8.6);c.quadraticCurveTo(6,-9,4.6,-4);c.closePath();c.fillStyle=WHITE;c.fill();c.save();c.clip();c.fillStyle=INK;c.fillRect(0,-12,6,9);c.restore();c.stroke();D(c,-9.5,-8.6,1.3,'#e6c14a');D(c,9.5,-8.6,1.3,'#e6c14a');break;
    case 'knight':c.beginPath();c.arc(0,-.6,5.9,PI*.95,PI*2.05);c.lineTo(5.9,2);c.lineTo(-5.9,2);c.closePath();c.fillStyle='#b9b3a6';c.fill();c.stroke();c.fillStyle=INK;c.fillRect(-4,-1.6,8,1.4);P(c,[[0,-6.4],[2,-11],[4.6,-12],[1,-6]],RED);break;
    case 'glasses':c.lineWidth=.7;C(c,-1.9,-.8,1.5);C(c,1.9,-.8,1.5);L(c,-.4,-.8,.4,-.8);break;
  }
  if(s.mask){c.fillStyle=INK;c.fillRect(-5.3,-2.3,10.6,2.9);D(c,-1.9,-.9,.7,WHITE);D(c,1.9,-.9,.7,WHITE);}
}

/* ---------- les poses ---------- */
function POSE(p,d,tt,hip){
  const std=[[[-2,hip],[-2.3,0]],[[2,hip],[2.3,0]]];
  switch(p){
    case 'walk':return{F:[d*5.6,hip-4],B:[-d*5,hip+.5],legs:[[[-1.5,hip],[-4.2,0]],[[1.5,hip],[4,0]]]};
    case 'run':return{F:[d*7.5,tt+4],B:[-d*6.8,tt+9.5],legs:[[[0,hip],[d*4.6,hip+5],[d*4.8,0]],[[0,hip],[-d*3.2,hip+6],[-d*7.8,-2.5]]],lean:true};
    case 'arms_up':return{F:[d*7,tt-6.5],B:[-d*7,tt-6.5],legs:std};
    case 'climb':return{F:[d*5,tt-6],B:[-d*5,tt-3.5],legs:[[[-2,hip],[-2.5,0]],[[2,hip],[4.2,hip+4],[3.6,-5]]]};
    case 'point':case 'give':return{F:[d*10.5,tt+3.5],B:[-d*5.5,hip-1],legs:std};
    case 'sit':return{F:[d*4.5,hip+1.5],B:[-d*4.5,hip+1.5],legs:[[[-2,hip],[-2.4,0]],[[2,hip],[2.4,0]]]};
    case 'dig':return{F:[d*6.5,tt+5],B:[d*2.5,tt+9.5],legs:[[[-2,hip],[-3.6,0]],[[2,hip],[3.6,0]]]};
    case 'carry':return{F:[d*3,tt+7],B:[-d*3,tt+7],legs:std};
    case 'row':return{F:[d*7,tt+7],B:[d*3.5,tt+9],legs:[]};
    case 'crouch':return{F:[d*7.4,hip-.4],B:[-d*7.4,hip-.4],legs:[[[-2,hip],[-8,hip-.6],[-4.4,0]],[[2,hip],[8,hip-.6],[4.4,0]]]};
    case 'hide':return{F:[d*1.8,tt-3],B:[-d*1.8,tt-3],legs:[[[-2,hip],[-8,hip-.6],[-4.4,0]],[[2,hip],[8,hip-.6],[4.4,0]]]};
    case 'ground':return{F:[d*7,hip+1.6],B:[-d*7,hip+1.6],legs:[[[-2,hip],[-6,hip+1.4],[-10,hip+2]],[[2,hip],[6,hip+1.6],[10,hip+2.4]]]};
    case 'lean':return{F:[d*6,hip+2],B:[d*2,hip+3],legs:[[[-2,hip],[-3,0]],[[2,hip],[3,0]]]};
    case 'wave':return{F:[d*7.4,tt-7.5],B:[-d*5.6,hip-1],legs:[[[-2,hip],[-2.3,0]],[[2,hip],[2.3,0]]]};
    case 'think':return{F:[d*1.6,tt-2.4],B:[d*1.4,tt+7],legs:[[[-2,hip],[-2.3,0]],[[2,hip],[2.6,0]]]};
    default:return{F:[d*5.6,hip-1],B:[-d*5.6,hip-1],legs:std};
  }
}

function bodyPath(c,s,tt,hip){
  c.beginPath();
  if(s.body==='dress'){c.moveTo(-3.3,tt+.5);c.quadraticCurveTo(-3.3,tt,-2.5,tt);c.lineTo(2.5,tt);c.quadraticCurveTo(3.3,tt,3.3,tt+.5);c.lineTo(7.2,hip+4.2);c.lineTo(-7.2,hip+4.2);}
  else if(s.body==='suit'||s.body==='shirt'){c.moveTo(-4.3,tt+1.2);c.quadraticCurveTo(-4.3,tt,-3,tt);c.lineTo(3,tt);c.quadraticCurveTo(4.3,tt,4.3,tt+1.2);c.lineTo(4.1,hip);c.lineTo(-4.1,hip);}
  else{c.moveTo(-4.1,tt+1.2);c.quadraticCurveTo(-4.1,tt,-3,tt);c.lineTo(3,tt);c.quadraticCurveTo(4.1,tt,4.1,tt+1.2);c.lineTo(5.7,hip+2.2);c.lineTo(-5.7,hip+2.2);}
  c.closePath();
}

function drawTinyDog(c,x,y,d){
  c.lineWidth=.8;L(c,x-2,y-2,x-2.3,y);L(c,x+2,y-2,x+2.3,y);E(c,x,y-3,3.2,1.8,WHITE);C(c,x+d*3.4,y-5,1.7,WHITE);E(c,x+d*2.6,y-4.6,.7,1.3,INK);L(c,x-d*3,y-3.4,x-d*4.6,y-5.4);D(c,x+d*4,y-5.2,.35);
}

/* ---------- objets tenus ---------- */
function drawProp(c,p,hx,hy,d){
  c.lineWidth=.9;c.strokeStyle=INK;
  switch(p){
    case 'bag':L(c,hx,hy,hx,hy+1);Rc(c,hx-2.3,hy+1,4.6,4.6,GREY);break;
    case 'sack':C(c,hx,hy+4.7,4.3,WHITE);P(c,[[hx-1.2,hy+.2],[hx+1.2,hy+.2],[hx+.9,hy+1.2],[hx-.9,hy+1.2]],WHITE);c.fillStyle=INK;c.font='bold 5px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('€',hx,hy+5);break;
    case 'suitcase':Rc(c,hx-4.2,hy+1.4,8.4,6.6,GREY);c.beginPath();c.moveTo(hx-1.6,hy+1.4);c.lineTo(hx-1.6,hy);c.lineTo(hx+1.6,hy);c.lineTo(hx+1.6,hy+1.4);c.stroke();L(c,hx-4.2,hy+4,hx+4.2,hy+4);break;
    case 'cake':E(c,hx,hy-.6,5.6,1.2,WHITE);Rc(c,hx-4,hy-5.8,8,5,WHITE);Rc(c,hx-2.6,hy-9.4,5.2,3.6,WHITE);L(c,hx-4,hy-3.3,hx+4,hy-3.3);D(c,hx,hy-10.5,1,RED);break;
    case 'plate':E(c,hx,hy-.2,5,1.3,WHITE);D(c,hx-1.5,hy-.4,.35);D(c,hx+1.8,hy-.1,.35);D(c,hx+.4,hy-.5,.3);break;
    case 'necklace':{for(let k=0;k<7;k++){const a=k/6*PI;D(c,hx+d*1.8*Math.sin(a),hy+k*1.05,.55);}P(c,[[hx,hy+7.2],[hx+1.3,hy+8.6],[hx,hy+10.2],[hx-1.3,hy+8.6]],WHITE);break;}
    case 'shovel':c.lineWidth=1.2;L(c,hx-d*3.4,hy-6,hx+d*6,hy+12.5);c.lineWidth=.9;P(c,[[hx+d*4.4,hy+10.2],[hx+d*8.6,hy+11.4],[hx+d*7.6,hy+16.4],[hx+d*3.6,hy+15]],GREY);break;
    case 'balloon':c.lineWidth=.5;L(c,hx,hy,hx+1.4,hy-20);c.lineWidth=.9;E(c,hx+1.4,hy-25,4.2,5.2,WHITE);break;
    case 'umbrella':c.lineWidth=1;L(c,hx,hy,hx,hy-20);c.beginPath();c.arc(hx,hy-20,10.5,PI,0);c.closePath();c.fillStyle=INK;c.fill();break;
    case 'newspaper':Rc(c,hx-2,hy-6.5,5.2,7.4,WHITE);c.lineWidth=.4;for(let k=0;k<4;k++)L(c,hx-1.2,hy-5+k*1.5,hx+2.4,hy-5+k*1.5);break;
    case 'flowers':c.lineWidth=.6;L(c,hx,hy,hx-1.6,hy-6);L(c,hx,hy,hx,hy-7);L(c,hx,hy,hx+1.6,hy-6);c.lineWidth=.7;C(c,hx-1.6,hy-6.8,1.2,WHITE);C(c,hx,hy-8,1.2,WHITE);C(c,hx+1.6,hy-6.8,1.2,WHITE);break;
    case 'icecream':P(c,[[hx-1.5,hy-1.2],[hx+1.5,hy-1.2],[hx,hy+3]],'#e6dcb8');C(c,hx,hy-2.6,1.9,WHITE);break;
    case 'baguette':c.lineCap='round';c.beginPath();c.moveTo(hx-d*2.2,hy+4.5);c.lineTo(hx+d*3.4,hy-8.5);c.lineWidth=3;c.stroke();c.lineWidth=1.6;c.strokeStyle='#e3cf9a';c.stroke();c.strokeStyle=INK;break;
    case 'book':c.fillStyle=INK;c.fillRect(hx-2.2,hy-1,4.6,5.6);break;
    case 'cane':c.lineWidth=1.1;L(c,hx,hy,hx+d*1.2,0);break;
    case 'leash':c.lineWidth=.45;L(c,hx,hy,hx+d*9,-5);drawTinyDog(c,hx+d*11,0,d);break;
    case 'letter':Rc(c,hx-2.6,hy-1.6,5.2,3.6,WHITE);c.beginPath();c.moveTo(hx-2.6,hy-1.6);c.lineTo(hx,hy+.4);c.lineTo(hx+2.6,hy-1.6);c.stroke();break;
    case 'money':Rc(c,hx-3.2,hy-1.4,6.4,3.2,'#e3e8d8');Rc(c,hx-2.4,hy-2.6,6.4,3.2,'#e3e8d8');break;
    case 'clothes':E(c,hx+d*2,hy+1.4,4.8,3.1,INK,.3);L(c,hx+d*2,hy+4,hx+d*3,hy+7.5);break;
    case 'oar':c.lineWidth=1.2;L(c,hx-d*5,hy-7,hx+d*9,hy+14);break;
    case 'camera':Rc(c,hx-2.5,hy-2.5,5,3.6,INK);D(c,hx,hy-.7,1,WHITE);break;
    case 'fish':E(c,hx+d*2,hy+2,4.2,1.7,WHITE);P(c,[[hx-d*2,hy+2],[hx-d*4.4,hy],[hx-d*4.4,hy+4]],WHITE);D(c,hx+d*4.6,hy+1.6,.35);break;
    case 'goldfish':E(c,hx+d*2.4,hy+2,5.4,2.3,'#e6c14a');P(c,[[hx-d*2.8,hy+2],[hx-d*5.6,hy-.6],[hx-d*5.6,hy+4.6]],'#e6c14a');D(c,hx+d*5.8,hy+1.4,.45);break;
    case 'map':Rc(c,hx-4,hy-5,8,6,'#efe6c8');c.lineWidth=.4;c.setLineDash([.8,.8]);L(c,hx-3,hy-2,hx+1,hy-4);c.setLineDash([]);c.strokeStyle=RED;L(c,hx+1.2,hy-3,hx+2.6,hy-1.6);L(c,hx+2.6,hy-3,hx+1.2,hy-1.6);c.strokeStyle=INK;break;
    case 'sheet':E(c,hx+d*2,hy+3,5.2,4,WHITE,.4);c.lineWidth=.4;L(c,hx-1,hy+1,hx+d*5,hy+5);break;
    case 'can':Rc(c,hx-2.2,hy,4.4,6,GREY);D(c,hx,hy+3,1,INK);break;
    case 'ring':c.lineWidth=2.6;c.beginPath();c.ellipse(hx+d*2,hy+3,5,4,0,0,TAU);c.strokeStyle=INK;c.stroke();c.lineWidth=1.6;c.strokeStyle='#f2f0ea';c.stroke();c.strokeStyle=RED;c.setLineDash([2,2.2]);c.stroke();c.setLineDash([]);c.strokeStyle=INK;break;
    case 'trophy':P(c,[[hx-2.6,hy-6],[hx+2.6,hy-6],[hx+1.2,hy-2],[hx-1.2,hy-2]],'#e6c14a');Rc(c,hx-.6,hy-2,1.2,2,'#e6c14a');Rc(c,hx-2,hy,4,1.2,'#e6c14a');break;
    case 'ticket':Rc(c,hx-2.6,hy-1.4,5.2,2.8,'#efe6c8');break;
    case 'binoculars':Rc(c,hx-3.4,hy-4.4,3,4,INK);Rc(c,hx+.4,hy-4.4,3,4,INK);break;
    case 'ladder':c.lineWidth=1.1;L(c,hx-d*14,hy+6,hx+d*12,hy-8);L(c,hx-d*12,hy+9.5,hx+d*14,hy-4.5);c.lineWidth=.7;for(let k=0;k<7;k++){const t=k/6;L(c,hx-d*14+d*26*t,hy+6-14*t,hx-d*12+d*26*t,hy+9.5-14*t);}break;
    case 'magnifier':c.lineWidth=1.3;L(c,hx,hy,hx+d*3,hy-4);c.lineWidth=1;C(c,hx+d*5,hy-7,3,'#eef3f2');break;
    case 'telescope':c.lineWidth=1;P(c,[[hx-d*2,hy+1],[hx+d*12,hy-5],[hx+d*12.6,hy-3],[hx-d*1.4,hy+3]],GREY);break;
    case 'redballoon':c.lineWidth=.5;L(c,hx,hy,hx+1.4,hy-22);c.lineWidth=.9;E(c,hx+1.4,hy-28,5,6.2,RED);P(c,[[hx+.4,hy-21.6],[hx+2.4,hy-21.6],[hx+1.4,hy-23]],RED);break;
    case 'cotton':c.lineWidth=.7;L(c,hx,hy+2,hx,hy-4);C(c,hx,hy-7,3.6,'#f3dbe0');C(c,hx-2,hy-6,2.4,'#f3dbe0');break;
    case 'notepad':Rc(c,hx-2.2,hy-3.4,4.4,5.4,WHITE);c.lineWidth=.35;for(let k=0;k<3;k++)L(c,hx-1.4,hy-2+k*1.3,hx+1.4,hy-2+k*1.3);break;
    case 'basket':c.lineWidth=.9;c.beginPath();c.arc(hx,hy+1,3.6,PI,0);c.stroke();P(c,[[hx-4.6,hy+1],[hx+4.6,hy+1],[hx+3.4,hy+6],[hx-3.4,hy+6]],'#d8c8a4');c.lineWidth=.4;L(c,hx-4,hy+3,hx+4,hy+3);C(c,hx-1.6,hy+.4,1.4,'#efe3b0');C(c,hx+1.6,hy+.2,1.4,WHITE);break;
    case 'trumpet':c.lineWidth=1;P(c,[[hx,hy-1],[hx+d*9,hy-3],[hx+d*11,hy-6],[hx+d*11,hy+1],[hx+d*9,hy-1.6],[hx,hy+.6]],'#e6c14a');break;
    case 'crownp':E(c,hx,hy+.6,5,1.6,RED);P(c,[[hx-3.2,hy],[hx+3.2,hy],[hx+3.8,hy-4.4],[hx+1.8,hy-2.6],[hx,hy-5],[hx-1.8,hy-2.6],[hx-3.8,hy-4.4]],'#e6c14a');break;
    case 'cushion':E(c,hx,hy+.6,5,1.6,RED);break;
    case 'axe':c.lineWidth=1.2;L(c,hx,hy+4,hx+d*3,hy-10);c.lineWidth=.8;P(c,[[hx+d*2,hy-10],[hx+d*6,hy-12],[hx+d*6.4,hy-7],[hx+d*2.8,hy-7]],GREY);break;
    case 'pie':E(c,hx,hy-1,5.6,2,'#d8c8a4');c.lineWidth=.5;L(c,hx-3,hy-1.4,hx+3,hy-1.4);break;
    case 'vial':P(c,[[hx-1.2,hy-5],[hx+1.2,hy-5],[hx+1.8,hy+1],[hx-1.8,hy+1]],'#b9e0a8');Rc(c,hx-.8,hy-6.4,1.6,1.4,'#8f8a7c');break;
    case 'sword':c.lineWidth=1.4;L(c,hx,hy,hx+d*10,hy-12);c.lineWidth=1;L(c,hx-d*1.6,hy-2.4,hx+d*2.4,hy+2);break;
    case 'paint':Rc(c,hx-1.2,hy-1,2.4,3.6,GREY);c.lineWidth=.6;L(c,hx,hy-1,hx+d*1.4,hy-5.5);break;
  }
}

/* ---------- personnage complet ---------- */
const HALO='#fffdf8';let haloP=null;
function haloCtx(c){if(haloP&&haloP.t===c)return haloP.p;const fns=new Map();const p=new Proxy(c,{get(t,k){const v=t[k];if(typeof v==='function'){let f=fns.get(k);if(!f){f=v.bind(t);fns.set(k,f);}return f;}return v;},set(t,k,v){if(k==='fillStyle'||k==='strokeStyle')t[k]=HALO;else if(k==='lineWidth')t[k]=v+2.8;else t[k]=v;return true;}});haloP={t:c,p};return p;}
function drawChar(c,x,y,s,noHalo){
  if(!noHalo&&LOD>.3&&s.head!=='ghost'){const sz=(SIZE[s.head]||1)*(s.scale||1)*((BUILDS[s.build||'normal']||BUILDS.normal).bw>1.2?1.2:1),lay=s.pose==='fallen'||s.pose==='lie';
    c.save();c.fillStyle='rgba(70,58,38,.14)';c.beginPath();c.ellipse(x+(lay?3:0),y+1,(lay?17:9)*sz,(lay?4.5:3.4)*sz,0,0,TAU);c.fill();c.restore();}
  if(!noHalo&&LOD>.45){const h=haloCtx(c);h.save();drawCharIn(h,x,y,s);h.restore();}
  drawCharIn(c,x,y,s);
}
const BIGP=new Set(['letter','money','ticket','bag','necklace','notepad','map','camera','book','newspaper','cake','plate','sack','trophy','pie','basket','vial','goldfish','fish','magnifier','binoculars','cotton','icecream','flowers','clothes','crownp','cushion','can']);
const BUILDS={normal:{bw:1,tk:1,lk:1,hs:1},round:{bw:1.38,tk:1,lk:.8,hs:1,belly:1},slim:{bw:.76,tk:1.06,lk:1.18,hs:.94},tall:{bw:.95,tk:1.14,lk:1.32,hs:1},small:{bw:.98,tk:.78,lk:.72,hs:1.16},old:{bw:1,tk:.94,lk:.9,hs:1,hunch:.24}};
function drawCharIn(c,x,y,s){
  c.save();c.translate(x,y);
  if(s.scale)c.scale(s.scale,s.scale);
  if(s.head==='ghost'){drawGhost(c);c.restore();return;}
  {const sz=SIZE[s.head]||1;if(sz!==1)c.scale(sz,sz);}
  let pose=s.pose||'stand';
  const fallen=pose==='fallen', lying=pose==='lie', sleeping=pose==='sleep';
  if(fallen||lying){c.translate(15,-4);c.rotate(-PI/2);pose=fallen?'arms_up':'stand';}
  if(sleeping)pose='sit';
  const d=s.flip?-1:1,BD=BUILDS[s.build||'normal']||BUILDS.normal;
  c.lineJoin='round';c.lineCap='round';c.strokeStyle=INK;
  const low=pose==='sit'||pose==='row'||pose==='crouch'||pose==='hide'||pose==='ground';
  const tt0=pose==='crouch'||pose==='hide'?-19:pose==='ground'?-16:low?-19:-24, hip0=pose==='crouch'||pose==='hide'?-6:pose==='ground'?-3:low?-8:-11;
  const lkE=low?1:BD.lk,bw=BD.bw,tk=BD.tk,hip=hip0*lkE,tt=hip+(tt0-hip0)*tk;
  const pd=POSE(pose,d,tt0,hip0);
  const M=pt=>[pt[0]+Math.sign(pt[0])*(bw-1)*3.8,hip+(pt[1]-hip0)*tk];
  if(pd.lean){c.transform(1,0,d*-.12,1,0,0);}
  if(pose!=='row'&&!s.noTail)drawTail(c,s.head,d,hip,s);
  c.lineWidth=1.5*(BD.lk<.8?.9:1);
  for(const lg of pd.legs){
    const pts=lg.map(q=>[q[0]*(bw>1.2?1.15:1),q[1]*lkE]);const st=s.body==='dress'?[pts[0][0],pts[0][1]+2]:pts[0];
    c.beginPath();c.moveTo(st[0],st[1]);for(let i=1;i<pts.length;i++)c.lineTo(pts[i][0],pts[i][1]);c.stroke();
    const f=pts[pts.length-1];const lw=c.lineWidth;c.lineWidth=.6;E(c,f[0]+d*.7,f[1]-.5,2,1.15,INK);c.lineWidth=lw;
  }
  const leanK=(pose==='lean'?.5:0)+(BD.hunch||0);
  if(leanK){c.translate(0,hip);c.transform(1,0,-d*leanK,1,0,0);c.translate(0,-hip);}
  if(pose==='run'){c.lineWidth=.5;for(let k=0;k<3;k++)L(c,-d*(9+k),tt+6+k*4,-d*(15+k*2),tt+6+k*4);}
  if(s.cape){c.lineWidth=1;P(c,[[-4.2*bw,tt+.4],[4.2*bw,tt+.4],[8.6*bw,hip+6],[-8.6*bw,hip+6]],'#2b2926');P(c,[[-4.4*bw,tt+1],[-6.6*bw,tt-4.6],[-1.6,tt+.2]],'#2b2926');P(c,[[4.4*bw,tt+1],[6.6*bw,tt-4.6],[1.6,tt+.2]],'#2b2926');}
  if(s.pack){c.lineWidth=1;Rc(c,-d*(3.4+3.8*bw),tt+2,4,9*tk,s.pack);}
  c.save();c.translate(0,hip);c.scale(bw,tk);c.translate(0,-hip0);
  c.lineWidth=1.05;bodyPath(c,s,tt0,hip0);fillWith(c,s.fill||'white',[-8,tt0-1,8,hip0+5]);
  if(BD.belly){c.beginPath();c.ellipse(0,(tt0+hip0)/2+2.4,4.6,4.4,0,0,TAU);fillWith(c,s.fill||'white',[-6,tt0,6,hip0+4]);}
  const dark=s.fill==='black';
  if(s.body==='suit'){P(c,[[0,tt0+.4],[.95,tt0+2],[0,tt0+7.5],[-.95,tt0+2]],dark?WHITE:INK);}
  else if(s.body==='coat'){D(c,0,tt0+5,.5,dark?WHITE:INK);D(c,0,tt0+8.5,.5,dark?WHITE:INK);}
  else if(s.body==='chef'){Rc(c,-3.4,tt0+5,6.8,hip0-tt0-3,WHITE);}
  c.restore();
  const F=M(pd.F),B=M(pd.B),shY=tt+1.6*tk,shX=3.8*bw;
  const slv=s.fill==='black'?INK:s.fill==='grey'?'#a8a296':s.fill==='check'?'#d6d1c5':WHITE;
  for(const[sx,h]of[[-d*shX,B],[d*shX,F]]){c.lineCap='round';c.lineWidth=2.9;c.strokeStyle=INK;L(c,sx,shY,h[0],h[1]);c.lineWidth=1.3;c.strokeStyle=slv;L(c,sx,shY,h[0]-(h[0]-sx)*.15,h[1]-(h[1]-shY)*.15);c.strokeStyle=INK;}
  c.lineWidth=.8;const hr=s.gloves?1.7:.95;C(c,B[0],B[1],hr,WHITE);C(c,F[0],F[1],hr,WHITE);
  c.save();c.translate(BD.hunch?d*2:0,tt-5.1*BD.hs);c.scale(BD.hs,BD.hs);drawHead(c,s,d);c.restore();
  if(s.scarf){c.lineWidth=.8;P(c,[[-3.6*bw,tt-.6],[3.6*bw,tt-.6],[3.2*bw,tt+1.8],[-3.2*bw,tt+1.8]],s.scarf);P(c,[[-d*1.5,tt+1],[-d*.2,tt+1],[-d*.6,tt+7],[-d*2.2,tt+6.6]],s.scarf);}
  if(s.bell){c.lineWidth=.6;L(c,-2.6,tt+.6,2.6,tt+.6);D(c,0,tt+1.8,1.5,RED);}
  if(s.prop){if(BIGP.has(s.prop)){c.save();c.translate(F[0],F[1]);c.scale(1.45,1.45);drawProp(c,s.prop,0,0,d);c.restore();}else drawProp(c,s.prop,F[0],F[1],d);}
  if(pose==='think'){c.strokeStyle=INK;c.lineWidth=.6;C(c,d*7,tt-10,1,WHITE);C(c,d*9.5,tt-14,1.6,WHITE);E(c,d*13,tt-20,4.6,3.2,WHITE);txt(c,'?',d*13,tt-20,5);}
  if(sleeping){c.fillStyle=INK;c.font='7px "Patrick Hand", cursive';c.textAlign='left';c.fillText('z',6,tt-9);c.font='9px "Patrick Hand", cursive';c.fillText('Z',9,tt-14);}
  if(fallen){c.lineWidth=.6;for(const[sx,sy]of[[-7,-33],[6,-35],[0,-38]]){L(c,sx-1.3,sy,sx+1.3,sy);L(c,sx,sy-1.3,sx,sy+1.3);}}
  c.restore();
}


function drawGhost(c){
  c.strokeStyle=INK;c.lineWidth=1.1;c.beginPath();c.moveTo(-8,-1);c.lineTo(-8,-22);c.arc(0,-22,8,PI,0);c.lineTo(8,-1);
  for(let k=0;k<4;k++){c.quadraticCurveTo(6-k*4,-4,4-k*4,-1);}c.closePath();c.fillStyle=WHITE;c.fill();c.stroke();
  E(c,-3,-23,1.6,2.4,INK);E(c,3,-23,1.6,2.4,INK);E(c,0,-17,1.8,2.2,INK);
  c.lineWidth=.8;L(c,-8,-15,-12,-19);L(c,8,-15,12,-19);
}

const SIZE={elephant:1.15,bear:1.12,lion:1.08,croc:1.05,mouse:.88,hedgehog:.9,frog:.92,duck:.95,penguin:.95,rabbit:.97};
function drawTail(c,h,d,hip,s){
  const x=-d*3.4,y=hip+.5;c.strokeStyle=INK;c.lineWidth=1;
  const dark=s.fill==='black'?INK:WHITE;
  switch(h){
    case 'fox':c.beginPath();c.moveTo(x,y-1);c.quadraticCurveTo(x-d*11,y+3,x-d*12,y-8);c.quadraticCurveTo(x-d*6,y-6,x,y-4);c.closePath();c.fillStyle='#d9cfae';c.fill();c.stroke();E(c,x-d*11,y-7,2,2.4,WHITE);break;
    case 'cat':c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-d*9,y+1,x-d*8,y-10);c.lineWidth=2.8;c.stroke();c.lineWidth=1.2;c.strokeStyle=s.fill==='grey'?'#a8a296':dark;c.stroke();c.strokeStyle=INK;break;
    case 'mouse':c.lineWidth=.7;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x-d*8,y+5,x-d*9,y-6,x-d*13,y-2);c.stroke();break;
    case 'pig':c.lineWidth=.8;c.beginPath();c.arc(x-d*2,y-1,1.6,0,PI*1.6);c.stroke();break;
    case 'dog':c.lineWidth=2.4;L(c,x,y,x-d*5,y-6);c.lineWidth=1;c.strokeStyle=WHITE;L(c,x,y,x-d*5,y-6);c.strokeStyle=INK;break;
    case 'lion':c.lineWidth=.9;c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x-d*8,y+4,x-d*9,y-4);c.stroke();C(c,x-d*9,y-5,1.8,'#d9cfae');break;
    case 'rabbit':C(c,x-d*.6,y-1,2,WHITE);break;
    case 'bear':C(c,x-d*.4,y-1,1.5,s.fill==='black'?INK:'#d6d1c5');break;
    case 'croc':P(c,[[x+d*.5,y-3],[x+d*.5,y+3],[x-d*13,y+10]],'#d8d4c6');break;
    case 'elephant':c.lineWidth=.8;L(c,x,y,x-d*4,y+6);E(c,x-d*4.4,y+7,1,1.6,INK);break;
    case 'hedgehog':break;
  }
}
