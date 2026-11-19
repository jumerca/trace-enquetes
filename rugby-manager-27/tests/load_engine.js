// Charge le moteur V2 dans Node (sans DOM) pour les tests headless.
const fs=require('fs'),path=require('path'),vm=require('vm');
const dir=path.join(__dirname,'..','src','v2','engine');
const ctx={console};ctx.globalThis=ctx;vm.createContext(ctx);
for(const f of ['rm2_core.js','rm2_ai.js','rm2_phases.js','rm2_quick.js'])vm.runInContext(fs.readFileSync(path.join(dir,f),'utf8'),ctx,{filename:f});
const RM2=ctx.RM2;
const POS=['PR','HO','PR','LO','LO','BR','BR','BR','SH','FH','WI','CE','CE','WI','FB','HO','PR','PR','LO','BR','SH','FH','CE'];
function team(name,power,tactics={},color='#ddd'){return {name,short:name,color,strength:power,tactics,players:POS.map((pos,k)=>({id:name+'-'+k,name:'J'+(k+1)+' '+name,position:pos,skill:power-6+((k*37)%13)}))}}
function match(seed,a=team('Alpha',78),b=team('Beta',76),opts={}){return RM2.create({seed,teams:[a,b],userTeam:-1,auto:true,...opts})}
module.exports={RM2,team,match};
