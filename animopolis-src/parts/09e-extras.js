/* =========================================================
   CONTENU APRÈS LES ENQUÊTES
   - une question d'observation / de logique dans chaque enquête facile
   - les ramifications de l'Ombre sur l'île
   - 24 figurines dorées cachées dans la ville (à collectionner)
   ========================================================= */

/* ---------- 1. variété des enquêtes faciles ---------- */
const eqr=mulberry32(60606);
function Q(cid,q,good,bad,ok){const opts=[good,...bad];for(let i=opts.length-1;i>0;i--){const j=Math.floor(eqr()*(i+1));[opts[i],opts[j]]=[opts[j],opts[i]];}
  const cs=CASES.find(c=>c.id===cid);cs.steps.splice(cs.steps.length-1,0,{q,choice:opts.map(t=>CH(t)),ans:opts.indexOf(good),ok});}
function buildEasyQs(){
  Q('chaton',"Un détective se souvient de tout. Dans quel ordre Pompon a-t-il fait ses bêtises ?","Poisson, poursuite, arbre",["Arbre, poisson, poursuite","Poursuite, arbre, poisson","Poisson, arbre, poursuite"],"Poisson volé, chien à ses trousses, puis refuge dans l'arbre : le récit est clair.");
  Q('gateau',"Retrace le trajet du gâteau. Dans quel ordre l'a-t-on vu ?","Pâtisserie, théâtre, lac, banc",["Théâtre, pâtisserie, banc, lac","Lac, théâtre, banc, pâtisserie","Banc, lac, pâtisserie, théâtre"],"De la pâtisserie au banc, en passant par le théâtre et le lac : le gâteau a fait le tour du quartier.");
  Q('poisson',"Combien de chatons Matou nourrit-il sous la barque ?","3",["2","4","5"],"Trois chatons, trois petites bouches affamées : voilà pourquoi Matou a volé.");
  Q('ballon',"Sur quel manège Noisette était-elle quand elle a tenu son ballon ?","Le carrousel",["Les autos-tamponneuses","La grande roue","Le train fantôme"],"Sur le carrousel, comme prévu. Le ballon s'est envolé juste après.");
  Q('valise',"Qu'y avait-il dans la valise de Madame Coâ ?","Des maillots de bain et une bouée",["Un costume et des dossiers","Des livres de comptes","Des bottes de pluie"],"Direction la mer, forcément : maillots de bain et bouée.");
  Q('lili',"Que préparent Lili et Grognon à la fin de l'histoire ?","Une omelette aux champignons",["Une soupe de légumes","Un gâteau au miel","Du pain grillé"],"Une omelette aux champignons, à partager entre amis.");
  Q('vase',"Où a-t-on retrouvé le ballon de foot ?","Dans un buisson",["Sur le toit du musée","Dans la fontaine","Dans un arbre"],"Le ballon dans le buisson, le vase cassé : l'histoire se recoupe.");
  Q('chapeau',"Où le chapeau s'est-il posé avant de tomber à l'eau ?","En haut du mât d'un voilier",["Sur le toit d'un phare","Sur une bouée","Sur la tête d'un goéland"],"Tout en haut d'un mât, avant que la vague ne l'emporte.");
  Q('peche',"Pourquoi personne ne gagnait-il à la pêche aux canards ?","Les canards étaient lestés de plomb",["Le stand était trop loin","Les cannes étaient cassées","Les lots étaient vides"],"Des canards lestés : impossible de les attraper, et le forain revendait les lots.");
  Q('chiot',"Dans quel ordre Biscuit a-t-il fait ses bêtises ?","Pigeons, saucisses, biscuits",["Saucisses, pigeons, biscuits","Biscuits, pigeons, saucisses","Pigeons, biscuits, saucisses"],"Pigeons, saucisses puis biscuits : il a enchaîné les bêtises avant la sieste.");
  Q('oeufs',"Combien d'œufs dorés Mamie Lapin avait-elle cachés ?","5",["3","4","6"],"Cinq œufs, un pour chaque enfant du village.");
  Q('bouteille',"Que contenait la bouteille trouvée par Titou ?","Un vieux message avec un dessin de bateau",["Une pièce d'or","Une clé rouillée","Une plume de perroquet"],"Un vieux message et un dessin de bateau : c'est ce qui les a menés à l'épave.");
}

/* ---------- 2. l'Ombre sur l'île ---------- */
const RAMIF={
 epave:{t:"Une carte noire sur le Baron",x:"Dans la poche du Baron Goupil : une carte de visite noire à l'œil blanc, avec la lettre « O ». Lui aussi travaillait pour l'Ombre."},
 tortue:{t:"« Ombre & Cie, livraison à l'Île »",x:"Dans le poncho du Capitaine Pataud : un bon de livraison « Ombre & Cie — œufs d'or, livraison à l'Île », frappé d'un œil blanc. L'Ombre a des alliés jusque sur les îles."}
};
function linkIleOmbre(){
  const ep=CASES.find(c=>c.id==='epave'),to=CASES.find(c=>c.id==='tortue');
  ep.outro+=" Dans la poche du Baron, pourtant : une carte noire à l'œil blanc…";
  to.outro+=" Dans son poncho : un bon de livraison « Ombre & Cie ». L'Ombre a des alliés jusque sur l'île !";
  to.intro+=" Sur la plage, quelqu'un a laissé tomber un petit carré de papier noir.";
}

/* ---------- 3. les figurines dorées ---------- */
const FIGS=[
 {d:0,n:'Le Maire',s:SP('bear','suit','white','top')},{d:0,n:'La Libraire',s:SP('owl','dress','white','glasses')},{d:0,n:'Le Facteur',s:SP('dog','coat','grey','cap',null,'letter')},{d:0,n:'Le Boulanger',s:SP('pig','chef','white','chef',null,'baguette')},
 {d:1,n:'Le Capitaine',s:SP('croc','coat','white','captain')},{d:1,n:'La Pêcheuse',s:SP('duck','poncho','white','straw',null,'fish')},{d:1,n:'Le Matelot',s:SP('penguin','shirt','stripes','bandana')},{d:1,n:'Le Gardien du phare',s:SP('owl','coat','grey','helmet')},
 {d:2,n:'Le Clown',s:SP('frog','tutu','check','clown')},{d:2,n:'Le Dompteur',s:SP('lion','suit','black','top')},{d:2,n:'La Funambule',s:SP('mouse','tutu','white','flower')},{d:2,n:'Le Cracheur de feu',s:SP('dog','overalls','white','helmet')},
 {d:3,n:'Le Chef de gare',s:SP('elephant','suit','white','police')},{d:3,n:'Le Contrôleur',s:SP('rabbit','coat','grey','glasses')},{d:3,n:'Le Mécano',s:SP('hedgehog','overalls','white','cap')},{d:3,n:'La Voyageuse',s:SP('giraffe','dress','dots','none',null,'suitcase')},
 {d:4,n:'Le Chevalier',s:SP('bear','coat','grey','knight',null,'sword')},{d:4,n:'La Reine',s:SP('cat','robe','white','crown')},{d:4,n:'Le Bûcheron',s:SP('hippo','poncho','check','cap',null,'axe')},{d:4,n:'Le Bouffon',s:SP('fox','shirt','stripes','jester')},
 {d:5,n:'Le Pirate',s:SP('croc','shirt','stripes','bandana')},{d:5,n:'Tiki la guide',s:SP('frog','shirt','white','flower')},{d:5,n:'La Tortue sage',s:SP('turtle','robe','white','flower')},{d:5,n:'Le Plongeur',s:SP('duck','puffer','white','helmet')}
];
FIGS.forEach((f,i)=>{f.id='fig'+i;});
function drawFig(c,x,y,f,t){
  c.save();c.strokeStyle=INK;c.lineWidth=1;
  /* socle doré */
  P(c,[[x-7,y],[x+7,y],[x+6,y-4],[x-6,y-4]],'#e6c14a');Rc(c,x-6,y-4,12,0,null);
  /* petit personnage */
  drawChar(c,x,y-4,Object.assign({},f.s,{scale:.52,pose:'stand',noShadow:true}),true);
  /* éclat doré qui scintille */
  const k=.5+.5*Math.sin(t*3+f.d*1.7+f.n.length),r=2.2+2.6*k;c.lineWidth=.8;
  c.beginPath();for(let i=0;i<8;i++){const a=i*PI/4,rr=i%2?r*.45:r;c.lineTo(x+9+Math.cos(a)*rr,y-24+Math.sin(a)*rr);}c.closePath();c.fillStyle='#fff3b0';c.fill();c.stroke();
  c.restore();}
const FIGPOS={};
function buildFigurines(){
  const rr=mulberry32(5150);
  for(const f of FIGS){const zone=areas.filter(a=>a.dist===f.d);if(!zone.length)continue;CURD=f.d;
    for(let tr=0;tr<200;tr++){const a=zone[Math.floor(rr()*zone.length)],u=a.u0+rr()*(a.u1-a.u0),v=a.v0+rr()*(a.v1-a.v0);
      if(a.ok&&!a.ok(u,v))continue;if(!free(u,v,10))continue;
      const[x,y]=pr(u,v,0);FIGPOS[f.id]={x,y:y-10,u,v};avoid(u,v,16);
      addMover([x-16,y-46,x+20,y+6],(c,t)=>{if(state.figs&&state.figs[f.id])return;drawFig(c,x,y,f,t);},[u,v,u,v]);break;}}
}
