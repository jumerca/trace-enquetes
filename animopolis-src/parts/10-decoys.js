
/* =========================================================
   QUESTIONS ÉNIGMATIQUES + FAUX SUSPECTS (SOSIES)
   ========================================================= */
const ENIGMES={
 collier:["Tout commence par un bijou qui brille au soleil. Trouve sa propriétaire.",
  "Quelqu'un ne quitte pas le saphir des yeux… mais de très loin.",
  "Pour atteindre l'étage, il faut du matériel. Où le voleur s'équipe-t-il ?",
  "Le coup est lancé. Surprends le voleur en plein travail.",
  "Un cri déchire le calme de la villa. Qui crie ?",
  "Quelqu'un doit prévenir la police. Ce n'est pas la Comtesse…",
  "Le bijou change de mains, à l'abri des regards.",
  "Un bijou volé ne rapporte rien tant qu'il n'est pas vendu. Qui l'achète ?",
  "Les complices se partagent l'argent. Où se retrouvent-ils ?",
  "La police a trouvé une preuve oubliée. Laquelle ?",
  "Le renard ne veut plus être reconnu. Seules sa tête et sa silhouette mince le trahissent encore.",
  "Sous sa nouvelle apparence, il compte quitter la ville en douce.",
  "Le complice, lui, a été repéré. Trouve la course-poursuite.",
  "Le piège se referme sur le renard. Où ?",
  "Le saphir retrouve sa propriétaire. Où ?"],
 banque:["Un lecteur de journal très attentif… à ce qui se passe en face.",
  "Un grand coup se prépare toujours à deux. Trouve la réunion secrète.",
  "Midi sonne. Le coup est lancé.",
  "Pour fuir vite, il faut un chauffeur prêt à démarrer.",
  "La fuite tourne mal. Où ?",
  "Sans voiture, il ne reste que les jambes.",
  "Un costume noir devient encombrant. Où finit-il ?",
  "Le complice ne résiste pas à l'argent facile. Que s'offre-t-il ?",
  "Une part du butin disparaît sous terre.",
  "La victime du braquage a repris ses esprits. Trouve-la.",
  "Quelqu'un a tout vu… et en a gardé la preuve.",
  "Le complice se croit déjà en vacances.",
  "L'ours prend le large.",
  "La mer n'est pas un refuge sûr. Qui arrive ?",
  "Fin de cavale. Trouve les deux bandits."],
 zorbo:["Le spectacle de ce soir est annoncé. Par qui ?",
  "Un magicien s'entraîne loin des regards.",
  "Les ennuis d'argent de Zorbo ont un visage. Lequel ?",
  "Le grand tour a besoin d'un objet. Où Zorbo le trouve-t-il ?",
  "Abracadabra… La disparition a lieu. Où ?",
  "Une disparition a toujours une sortie secrète.",
  "Pour se fondre dans la foule, il faut un nouveau costume.",
  "Où se cacher quand tout le monde regarde le sol ?",
  "Son assistante ne croit pas à la magie. À qui parle-t-elle ?",
  "Un accessoire du magicien a fini dans l'eau.",
  "Le partenaire à grandes oreilles a pris la clé des champs.",
  "Où passer inaperçu ? Là où tout le monde a peur.",
  "Il change de cachette à toute vitesse.",
  "La fuite s'arrête net. Où ?",
  "Le dernier tour de Zorbo : payer ses dettes."],
 recette:["Un secret bien gardé… montré à tout le monde. Trouve sa propriétaire.",
  "Un livreur bien trop curieux arrive avec sa marchandise.",
  "Un appareil photo, des caisses, un secret : que se passe-t-il ?",
  "La photo doit quitter la biscuiterie. Qui la récupère ?",
  "Elle file, et vite.",
  "Le vrai commanditaire attend devant un hôtel.",
  "Croquant pense déjà à partir.",
  "La Baronne comprend qu'on l'a trahie.",
  "L'enquête commence par celui qui devait tout surveiller.",
  "Le faux livreur se débarrasse de son uniforme.",
  "Un travail bien fait mérite salaire.",
  "Le départ approche.",
  "La police n'a pas dit son dernier mot.",
  "Il n'y a plus d'issue… sauf par le haut.",
  "Fin du voyage."],
 couronne:["Une couronne fait briller tous les yeux. Trouve qui la présente.",
  "Le bouffon fait le spectacle devant les visiteurs.",
  "Le banquet se prépare.",
  "Une soupe un peu trop verte…",
  "Le gardien du trésor n'a pas résisté à la soupe.",
  "Le chemin le plus court vers la couronne passe par en haut.",
  "La couronne n'est plus là. Qui s'en aperçoit ?",
  "Le voleur quitte le château.",
  "Un trésor caché au cœur de la forêt.",
  "Le château se réveille enfin.",
  "Le voleur a laissé des traces… palmées.",
  "Le bouffon n'est plus bouffon.",
  "Le voleur avait un complice dans la maison.",
  "La poursuite s'engage dans les champs.",
  "Justice est faite."]
};
for(const id in ENIGMES){const cs=CASES.find(c=>c.id===id);ENIGMES[id].forEach((q,i)=>{if(cs&&cs.steps[i])cs.steps[i].q=q;});}

/* ---------- sosies ---------- */
const DECOYS=[];
const SIG=s=>[s.head,s.body,s.fill,s.hat||'none',s.build||'normal'].join('|');
const ALTFILL={black:['grey','check'],grey:['white','check'],stripes:['dots','check'],dots:['stripes','check'],white:['grey','dots'],check:['stripes','grey']};
const ALTHAT=['cap','beret','top','none','straw','glasses','bow'];
const ALTBUILD={normal:['slim','round'],slim:['normal','tall'],round:['normal','tall'],tall:['slim','normal'],small:['normal','slim'],old:['normal','round']};
const ALTBODY={coat:'suit',suit:'coat',shirt:'coat',dress:'coat',chef:'coat'};
const DIFF={hat:'son couvre-chef',fill:'le motif de ses vêtements',build:'sa silhouette',body:'sa tenue'};
function variants(s,n){
  const all=new Set(CASES.flatMap(c=>c.cast.map(p=>SIG(p.s))));const out=[];
  const opts=[['hat',()=>pick(ALTHAT.filter(h=>h!==(s.hat||'none')))],['fill',()=>pick(ALTFILL[s.fill]||['grey'])],['build',()=>pick(ALTBUILD[s.build||'normal'])],['body',()=>ALTBODY[s.body]||'coat']];
  for(let k=0;k<n*6&&out.length<n;k++){const[a,f]=opts[(k+out.length)%opts.length];const v=Object.assign({},s,{[a]:f()});if(v.head==='rabbit'&&(v.hat==='top'||v.hat==='cap'||v.hat==='beret'||v.hat==='straw'))continue;if(all.has(SIG(v))||out.some(o=>SIG(o.s)===SIG(v)))continue;out.push({s:v,diff:a});}
  return out;
}
const SUSPECTS=[[0,RENARD,3],[0,RENARD2,3],[0,HULOTTE,3],[0,MOUST,2],[0,LAPIN,2],
  [1,OURS1,3],[1,OURS2,3],[1,OURS3,3],[1,CANARD,2],[1,CANARD2,2],[1,MATOU,2],[1,MOUSSE,3],
  [2,ZORBO,3],[2,ZORBO2,3],[2,HUISS,2],[2,FORAIN,2],
  [3,LIVREUR,3],[3,LAPNOIR,3],[3,SOURIS,2],[3,CROQ,3],[3,EPINE,2],
  [0,VELOURS,2],[5,GUIDE,2],[5,BARON,2],[5,SBIRE,2],[1,CONTRE,2],[2,FORPECHE,2],[2,FILOU,2],[3,FAUX,2],[3,FAUX2,2],[4,OURSON,2],[1,OMBRE,2],[3,OMBRE,2],[4,GIGOT,3],[4,GIGOT2,3],[4,LARDON,2],[4,RAPE1,2],[4,RAPE2,2]];
const DPOSES=['stand','walk','walk','run','carry','give','crouch','lean','point','think'];
const DPROPS=[null,null,'bag','sack','suitcase','newspaper','money','letter','camera','map','umbrella'];
function buildDecoys(){
  for(const[di,base,n]of SUSPECTS){
    const zone=areas.filter(a=>a.dist===di&&!a.beach);if(!zone.length)continue;
    for(const v of variants(base,n)){
      for(let t=0;t<80;t++){const a=pick(zone),u=R(a.u0,a.u1),w=R(a.v0,a.v1);if(a.ok&&!a.ok(u,w))continue;if(!free(u,w,8))continue;
        CURD=di;const s=Object.assign({},v.s,{pose:pick(DPOSES),prop:pick(DPROPS),flip:rnd()<.5});addChar(u,w,s);
        const[x,y]=pr(u,w,0);DECOYS.push({x,y:y-14,head:base.head,diff:v.diff,dist:di});avoid(u,w,10);break;}
    }
  }
}
function decoyAt(x,y){let best=null,bd=20;for(const d of DECOYS){const dd=Math.hypot(d.x-x,d.y-y);if(dd<bd){bd=dd;best=d;}}return best;}
