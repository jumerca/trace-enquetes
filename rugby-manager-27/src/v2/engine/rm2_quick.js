/* Rugby Manager 27 — V2.0 · Modèle rapide des rencontres sans manager humain
 * Utilisé uniquement pour les matchs entre clubs IA des autres affiches (des centaines par saison).
 * Ses distributions sont calibrées sur les sorties du moteur multi-agents (voir tests/calibrate_quick.js).
 */
'use strict';
(function(root){
const RM2=root.RM2;
function poisson(M,l){const L=Math.exp(-l);let k=0,p=1;do{k++;p*=RM2.rnd(M)}while(p>L&&k<40);return k-1}
RM2.QUICK={tryBase:3.1,k:.065,home:1.6,pen:1.55,conv:.72,drop:.05};
RM2.quickResult=function(seed,sHome,sAway,opts={}){
 const Q=RM2.QUICK,M={rng:seed>>>0||1};
 for(let i=0;i<3;i++)RM2.rnd(M);
 const diff=(sHome+Q.home)-sAway;
 const open=Math.exp(RM2.gauss(M)*.22);// match fermé ou ouvert
 const lh=Q.tryBase*Math.exp(Q.k*diff)*open,la=Q.tryBase*Math.exp(-Q.k*diff)*open;
 const th=poisson(M,lh),ta=poisson(M,la);
 const bin=(n,p)=>{let c=0;for(let i=0;i<n;i++)if(RM2.rnd(M)<p)c++;return c};
 const ch=bin(th,Q.conv),ca=bin(ta,Q.conv);
 const ph=poisson(M,Q.pen*Math.exp(.02*diff)/Math.sqrt(open)),pa=poisson(M,Q.pen*Math.exp(-.02*diff)/Math.sqrt(open));
 const dh=poisson(M,Q.drop),da=poisson(M,Q.drop);
 const n=(m,s)=>Math.max(0,Math.round(m+RM2.gauss(M)*s));
 return {home:th*5+ch*2+ph*3+dh*3,away:ta*5+ca*2+pa*3+da*3,homeTries:th,awayTries:ta,
  events:{rucks:n(205,28),tackles:n(270,35),passes:n(300,40),kicks:n(62,9),lineouts:n(22,4),scrums:n(13,3),penalties:n(21,4),mauls:n(7,2),turnovers:n(24,5)},
  sim:'RM27-V2-modele-rapide',seed:seed>>>0};
};
})(typeof window!=='undefined'?window:globalThis);
