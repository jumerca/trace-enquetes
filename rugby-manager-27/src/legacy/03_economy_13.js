
/* RM27 1.3 — Économie de carrière : montants entièrement fictifs en millions d'euros.
 * Données persistées avec state, intégration à la simulation et à toutes les sauvegardes.
 */
'use strict';
const rmFinRound = n => Math.round((n + Number.EPSILON) * 1000) / 1000;
const rmFinEuro = n => (Number(n)||0).toLocaleString('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2})+' M€';
function rmFinConfig(){
 const id=club(state.clubId)?.league||'PROD2';
 const tier={TOP14:[28000,5.7,1.45,28],PROD2:[11500,3.2,.9,23],PREM:[20500,4.5,1.28,27],URC:[18500,4.15,1.2,25],SUPER:[21000,4.3,1.24,25]}[id]||[12000,3,1,23];
 return {capacity:Math.round(tier[0]*(0.82+(club(state.clubId)?.power||72)/330)),sponsor:tier[1],operating:tier[2],ticket:tier[3]};
}
function rmFinStart(){
 if(state.finance&&state.finance.clubId===state.clubId&&state.finance.version===1)return state.finance;
 const c=rmFinConfig();const season=Number(state.rmSeason)||1;
 state.finance={version:1,clubId:state.clubId,startedSeason:season,stadium:{capacity:c.capacity},ticketPrice:c.ticket,sponsor:'stable',sponsorSignedSeason:season,facility:{training:0,academy:0},fanBase:.66,marketing:0,entries:[],settled:[],history:[],previous:[],initialCash:rmFinRound(Number(state.budget)||7.5)};
 return state.finance;
}
function rmFinLedger(label,amount,kind,id,extra={}){
 const f=rmFinStart();if(id&&f.entries.some(e=>e.id===id))return false;
 const value=rmFinRound(amount);if(!Number.isFinite(value))return false;
 state.budget=rmFinRound((Number(state.budget)||0)+value);
 f.entries.push({id:id||'tx-'+(f.entries.length+1),season:Number(state.rmSeason)||1,label,amount:value,kind,date:new Date().toISOString(),...extra});
 if(f.entries.length>1200)f.entries=f.entries.slice(-1200);
 return true;
}
function rmFinPlayerPayroll(){
 const actual=allPlayers(state.clubId);return rmFinRound(actual.reduce((total,p)=>{
   const skill=attr(p),starterBonus=skill>=80?.032:0;
   return total+rmClamp(.046+(skill-65)*.0045+starterBonus+(p.status==='test'?-.008:0),.035,.23);
 },0));
}
function rmFinStaffPayroll(){return rmFinRound((state.staffContracts||[]).filter(x=>x.to===state.clubId).reduce((sum,x)=>sum+(Number(x.salary)||0)/1000,0)+currentStaff(state.clubId).length*.055);}
function rmFinSponsorAnnual(){const c=rmFinConfig();const m=rmFinStart().sponsor;return rmFinRound(c.sponsor*({stable:1,performance:.73,community:.89}[m]||1));}
function rmFinFixturesCount(){return Math.max(1,getFixtures(club(state.clubId).league).filter(f=>f.home===state.clubId||f.away===state.clubId).length);}
function rmFinAttendance(f,score){
 const m=rmFinStart();const conf=rmFinConfig(),capacity=m.stadium.capacity;
 const recent=getFixtures(club(state.clubId).league).filter(x=>x.result&&(x.home===state.clubId||x.away===state.clubId)).slice(-6);
 const wins=recent.filter(x=>(x.home===state.clubId?x.result.home-x.result.away:x.result.away-x.result.home)>0).length;
 const strength=(club(f.away)?.power||70);
 const seed=rmSeed('gate13-'+f.id);
 const baseline=.49+.21*m.fanBase+(wins-recent.length*.45)*.017+(strength-70)*.0025+((seed%15)-7)*.008;
 const elasticity=Math.pow(26/m.ticketPrice,.68);
 const campaign=m.marketing>0?.06:0;
 const fill=rmClamp((baseline+campaign)*elasticity,.27,.97);
 return Math.round(capacity*fill);
}
function rmFinSettleFixture(f){
 if(!state.career||!f?.result||(f.home!==state.clubId&&f.away!==state.clubId))return false;
 const fm=rmFinStart(),key=`S${Number(state.rmSeason)||1}:${f.id}`;
 if(fm.settled.includes(key))return false;
 const conf=rmFinConfig(),number=rmFinFixturesCount(),home=f.home===state.clubId;
 const wages=rmFinPlayerPayroll()+rmFinStaffPayroll();
 const fixedCost=conf.operating+fm.facility.training*.085+fm.facility.academy*.06;
 const sponsor=rmFinSponsorAnnual()/number;
 const income=home?rmFinAttendance(f,f.result)*(fm.ticketPrice*.86+8.5)/1e6:0;
 const matchCosts=home?.061+.0000018*rmFinAttendance(f,f.result):.05;
 rmFinLedger('Partenaire principal · journée '+f.round,sponsor,'sponsor',key+':sponsor');
 if(home)rmFinLedger('Billetterie et restauration · journée '+f.round,income,'matchday',key+':gate',{attendance:rmFinAttendance(f,f.result),ticketPrice:fm.ticketPrice});
 rmFinLedger('Masse salariale · journée '+f.round,-wages/number,'wages',key+':payroll');
 rmFinLedger('Exploitation · journée '+f.round,-fixedCost/number,'operations',key+':operations');
 rmFinLedger((home?'Accueil du public':'Déplacement')+' · journée '+f.round,-matchCosts,'logistics',key+':logistics');
 if(home&&fm.marketing>0)fm.marketing=Math.max(0,fm.marketing-1);
 const diff=home?f.result.home-f.result.away:f.result.away-f.result.home;
 fm.fanBase=rmClamp(fm.fanBase+(diff>0?.014:diff<0?-.012:0),.4,.93);
 fm.settled.push(key);return true;
}
function rmFinCloseSeason(archive,closedSeason){
 const f=rmFinStart();const season=closedSeason||Number(state.rmSeason)||1;
 const standings=archive?.standings?.[club(state.clubId).league]||tableFor(club(state.clubId).league),rank=standings.findIndex(x=>x.id===state.clubId)+1,total=standings.length;
 if(f.sponsor==='performance'&&rank>0&&rank<=Math.ceil(total/3))rmFinLedger('Prime partenaire · classement saison '+season,rmFinConfig().sponsor*.55,'bonus',`bonus:${season}`,{season});
 if(f.sponsor==='community'&&f.fanBase>=.72)rmFinLedger('Prime engagement supporters · saison '+season,rmFinConfig().sponsor*.24,'bonus',`bonus:${season}`,{season});
 const current=f.entries.filter(e=>e.season===season),rev=current.filter(e=>e.amount>0).reduce((v,e)=>v+e.amount,0),expense=current.filter(e=>e.amount<0).reduce((v,e)=>v+e.amount,0);
 f.history.push({season,rank,total,revenues:rmFinRound(rev),expenses:rmFinRound(expense),closingCash:rmFinRound(state.budget),entries:current.length});
 f.previous.push({season,clubId:state.clubId,close:rmFinRound(state.budget)});
}
function rmFinRollSeason(){const f=rmFinStart();f.sponsorSignedSeason=Number(state.rmSeason)||1;f.marketing=0;f.fanBase=rmClamp(f.fanBase+.018*f.facility.academy,.4,.93);}
function rmFinOffer(kind){
 const f=rmFinStart(),season=Number(state.rmSeason)||1;
 if(f.sponsorSignedSeason===season&&f.entries.some(e=>e.kind==='sponsor'))return toast('Contrat partenaire verrouillé après la première journée');
 if(!['stable','performance','community'].includes(kind))return;
 f.sponsor=kind;f.sponsorSignedSeason=season;save();render();toast('Partenariat choisi pour la saison');
}
function rmFinPrice(v){const f=rmFinStart(),p=Number(v);if(!Number.isInteger(p)||p<12||p>80)return;f.ticketPrice=p;save();render();}
function rmFinInvest(kind){const f=rmFinStart();
 if(kind==='marketing'){const cost=.14;if(state.budget<cost)return toast('Trésorerie insuffisante');rmFinLedger('Campagne supporters (3 domiciles)',-cost,'investment','marketing:'+Date.now());f.marketing=3;}
 else if(['training','academy'].includes(kind)){
  const level=f.facility[kind];if(level>=3)return toast('Installation déjà au maximum');
  const cost=rmFinRound((kind==='training'?.85:.65)*(1+level*.9));
  if(state.budget<cost+.15)return toast('Trésorerie insuffisante pour cet investissement');
  rmFinLedger((kind==='training'?'Centre d’entraînement':'Académie des jeunes')+' niveau '+(level+1),-cost,'investment','facility:'+kind+':'+(level+1));f.facility[kind]++;
 }else return;
 save();render();toast('Investissement validé et inscrit au livre de comptes');
}
function rmFinForecast(){const f=rmFinStart(),config=rmFinConfig(),fx=getFixtures(club(state.clubId).league).filter(x=>x.home===state.clubId||x.away===state.clubId);
 const remaining=fx.filter(x=>!x.result),home=remaining.filter(x=>x.home===state.clubId).length,total=Math.max(1,fx.length);
 const salaries=rmFinPlayerPayroll()+rmFinStaffPayroll();
 const gateHome=f.stadium.capacity*(.49+.21*f.fanBase)*Math.pow(26/f.ticketPrice,.68)*(f.ticketPrice*.86+8.5)/1e6;
 const rec=remaining.length*rmFinSponsorAnnual()/total+home*gateHome;
 const cost=remaining.length*(salaries+config.operating+f.facility.training*.085+f.facility.academy*.06)/total+remaining.length*.065;
 return {remaining:remaining.length,rev:rmFinRound(rec),cost:rmFinRound(cost),end:rmFinRound(state.budget+rec-cost),wages:salaries};}
financePage=function(){const f=rmFinStart(),fc=rmFinForecast(),config=rmFinConfig(),sponsorship={stable:'Garanti',performance:'Performance',community:'Supporters'},all=f.entries,season=Number(state.rmSeason)||1;
 const current=all.filter(e=>e.season===season),income=current.filter(e=>e.amount>0).reduce((s,e)=>s+e.amount,0),out=current.filter(e=>e.amount<0).reduce((s,e)=>s-e.amount,0);
 const spending=fc.wages,cap=({TOP14:11,PROD2:6.5,PREM:10,URC:9,SUPER:10})[club(state.clubId).league]||7;
 const rows=all.slice(-32).reverse().map(e=>`<tr><td>S${e.season}</td><td>${esc(e.label)}</td><td>${esc(e.kind)}</td><td style="text-align:right;color:${e.amount<0?'#dd817d':'#61d5ae'}">${e.amount>0?'+':''}${rmFinEuro(e.amount)}</td></tr>`).join('');
 return `<div class="page-head"><div><span class="eyebrow">DIRECTION FINANCIÈRE · CARRIÈRE</span><h1>Budget <span class="dot">& décisions.</span></h1><p>Trésorerie, recettes à domicile, sponsoring, salaires et investissements. Tous les chiffres sont fictifs et servent uniquement au gameplay.</p></div></div>
 <div class="metrics">${statTile('TRÉSORERIE',rmFinEuro(state.budget),state.budget<0?'ALERTE : déficit de trésorerie':'Solde disponible',state.budget<0?'red':'gold')}${statTile('RECETTES · SAISON',rmFinEuro(income),'Dont sponsoring / billetterie')}${statTile('DÉPENSES · SAISON',rmFinEuro(out),'Exploitation et salaires')}${statTile('FIN DE SAISON · EST.',rmFinEuro(fc.end),fc.remaining+' rencontres restantes')}</div>
 <div class="rm13-grid"><section class="panel"><div class="panel-heading"><div><span class="eyebrow">RECETTES</span><h2>Billetterie & affluence</h2></div></div><p>Capacité estimée : <b>${f.stadium.capacity.toLocaleString('fr-FR')}</b> places · base supporters ${(f.fanBase*100).toFixed(0)} %.</p><label class="rm13-price">Prix moyen du billet <b>${f.ticketPrice} €</b><input type="range" min="12" max="80" step="1" value="${f.ticketPrice}" data-rm13-price aria-label="Prix moyen de billet"></label><p>Augmenter les tarifs rapporte plus par spectateur, mais réduit l'affluence simulée. Le résultat évolue avec la forme de l'équipe et le club adverse.</p><button class="btn ghost" data-rm13-invest="marketing" ${state.budget<.14?'disabled':''}>📣 Campagne supporters · 0,14 M€</button><small>Augmente l’affluence des trois prochains matchs à domicile.</small></section>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">PARTENAIRES</span><h2>Stratégie sponsoring</h2></div></div><div class="rm13-options">${[['stable','Garanti',config.sponsor],['performance','Prime sportive',config.sponsor*.73],['community','Ancrage local',config.sponsor*.89]].map(([k,n,v])=>`<button class="btn ${f.sponsor===k?'primary':'ghost'}" data-rm13-sponsor="${k}" ${current.some(e=>e.kind==='sponsor')?'disabled':''}>${n}<strong>${rmFinEuro(v)}/an</strong></button>`).join('')}</div><p>Performance : bonus de 55 % du contrat de référence en cas de top ⅓. Supporters : bonus de 24 % si fidélité ≥ 72 %. Garanti : aucun bonus, meilleur fixe.</p></section>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">INFRASTRUCTURES</span><h2>Investir sur le terrain</h2></div></div><div class="rm13-invest-row"><div><b>Centre d'entraînement · ${f.facility.training}/3</b><small>Jusqu'à +1,8 pt de préparation, entretien annuel croissant.</small></div><button class="btn ghost" data-rm13-invest="training" ${f.facility.training>=3?'disabled':''}>${f.facility.training>=3?'Max':rmFinEuro(.85*(1+f.facility.training*.9))}</button></div><div class="rm13-invest-row"><div><b>Académie · ${f.facility.academy}/3</b><small>Développe la base supporters et prépare les saisons suivantes.</small></div><button class="btn ghost" data-rm13-invest="academy" ${f.facility.academy>=3?'disabled':''}>${f.facility.academy>=3?'Max':rmFinEuro(.65*(1+f.facility.academy*.9))}</button></div></section>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">MAÎTRISE DES CHARGES</span><h2>Salaires & prévisions</h2></div></div><div class="rm13-breakdown"><div>Effectif (projection annuelle)<b>${rmFinEuro(rmFinPlayerPayroll())}</b></div><div>Staff (projection annuelle)<b>${rmFinEuro(rmFinStaffPayroll())}</b></div><div>Référence salariale <b>${rmFinEuro(cap)}</b></div><div>Budget salarial / référence<b>${Math.round(spending/cap*100)} %</b></div></div><p>Plafond <b>indicatif de gameplay</b> et non réglementaire ; aucun règlement de ligue n'est simulé. Prévisions hors prochains transferts et imprévus.</p></section></div>
 <section class="panel"><div class="panel-heading"><div><span class="eyebrow">TRAÇABILITÉ</span><h2>Journal de trésorerie</h2></div><span class="tag">${all.length} écritures</span></div><div class="table-wrap"><table><thead><tr><th>Saison</th><th>Opération</th><th>Type</th><th>Montant</th></tr></thead><tbody>${rows||'<tr><td colspan="4">Aucune écriture enregistrée. Le premier match déclenche les versements et charges.</td></tr>'}</tbody></table></div></section>
 ${f.history.length?`<section class="panel"><h2>Bilans des saisons closes</h2><div class="table-wrap"><table><thead><tr><th>Saison</th><th>Recettes</th><th>Dépenses</th><th>Solde final</th></tr></thead><tbody>${f.history.slice().reverse().map(h=>`<tr><td>${h.season}</td><td>${rmFinEuro(h.revenues)}</td><td>${rmFinEuro(h.expenses)}</td><td>${rmFinEuro(h.closingCash)}</td></tr>`).join('')}</tbody></table></div></section>`:''}`;
};
const rm13OldSelectClub=selectClub;
selectClub=function(id){const prev=state.clubId;rm13OldSelectClub(id);if(prev!==id||!state.finance||state.finance.clubId!==id){rmFinStart();save();render();}};
const rm13OldMenuEvent=mainMenuEvent;
mainMenuEvent=function(e){const btn=e.target.closest('[data-main]');if(btn?.dataset.main==='new'){
 // Clear only if confirmed; old handler may abort, so base on new career flag after invocation.
 const had=state.career;rm13OldMenuEvent(e);if(had&&!state.career){state.finance=null;save();}return;
 }return rm13OldMenuEvent(e)};
const rm13OldComplete=rmComplete;
rmComplete=function(g){const notDone=!g.done;rm13OldComplete(g);if(notDone&&!g.fast&&g.done){const fx=getFixtures(g.league).find(x=>x.id===g.id);if(rmFinSettleFixture(fx))save();}};
const rm13OldRound=playRound;
playRound=function(){const lid=state.leagueId,before=new Set(getFixtures(lid).filter(f=>f.result).map(f=>f.id));rm13OldRound();let modified=false;for(const f of getFixtures(lid))if(f.result&&!before.has(f.id)&&rmFinSettleFixture(f))modified=true;if(modified)save();};
const rm13OldNewSeason=rmStartNewSeason;
rmStartNewSeason=function(){const n=Number(state.rmSeason)||1;rm13OldNewSeason();if((Number(state.rmSeason)||1)>n){rmFinCloseSeason(state.rmSeasonHistory?.at(-1),n);rmFinRollSeason();save();render();}};
const rm13OldHome=homePage;
homePage=function(){let html=rm13OldHome();if(state.career){const f=rmFinStart(),forecast=rmFinForecast();html=html.replace('BUDGET SIMULÉ','TRÉSORERIE').replace('Valeur fictive pour tester','Solde réel du jeu');html+=`<section class="panel rm13-home"><div class="panel-heading"><div><span class="eyebrow">TABLEAU FINANCIER</span><h2>Votre direction financière</h2></div><button class="inline-link" data-page="finance">Gérer →</button></div><div class="rm13-breakdown"><div>Trésorerie disponible<b>${rmFinEuro(state.budget)}</b></div><div>Projection fin de saison<b>${rmFinEuro(forecast.end)}</b></div><div>Engagement salarial / an<b>${rmFinEuro(forecast.wages)}</b></div><div>Matchs restants<b>${forecast.remaining}</b></div></div></section>`;}return html;};
function rmFinRecordPriorCharge(label,oldAmount,kind,id){
 const charge=rmFinRound((Number(state.budget)||0)-oldAmount);
 if(charge<-.0001){const f=rmFinStart();if(!f.entries.some(e=>e.id===id)){f.entries.push({id,season:Number(state.rmSeason)||1,label,amount:charge,kind,date:new Date().toISOString()});save();}}
}
const rm13OldRecruit=recruit;
recruit=function(pid){const old=Number(state.budget)||0;const before=state.changes.length;rm13OldRecruit(pid);
 if(state.changes.length>before)rmFinRecordPriorCharge('Indemnité de transfert · '+(findPlayer(pid)?.name||pid),old,'transfer','transfer:'+pid);
};
const rm13OldHireStaff=hireStaff;
hireStaff=function(offer){const old=Number(state.budget)||0,before=state.staffContracts.length;rm13OldHireStaff(offer);
 if(state.staffContracts.length>before)rmFinRecordPriorCharge('Prime et indemnité staff · '+(staffMember(offer.id)?.name||offer.id),old,'staff','staff:'+offer.id+':'+(Number(state.rmSeason)||1));
};
const rm13OldEffective=rmEffectiveStrength;
rmEffectiveStrength=function(id){const p=rm13OldEffective(id);if(id!==state.clubId||!state.career)return p;const f=rmFinStart();return rmClamp(Math.round((p+f.facility.training*.6)*10)/10,50,96);};
document.addEventListener('input',e=>{if(e.target.matches('[data-rm13-price]')){const el=e.target;const f=rmFinStart();f.ticketPrice=Number(el.value);const b=el.closest('label')?.querySelector('b');if(b)b.textContent=el.value+' €';}},true);
document.addEventListener('change',e=>{if(e.target.matches('[data-rm13-price]'))rmFinPrice(Number(e.target.value));},true);
document.addEventListener('click',e=>{const sponsor=e.target.closest('[data-rm13-sponsor]'),invest=e.target.closest('[data-rm13-invest]');if(sponsor||invest){e.preventDefault();e.stopImmediatePropagation();if(sponsor)rmFinOffer(sponsor.dataset.rm13Sponsor);if(invest)rmFinInvest(invest.dataset.rm13Invest);}},true);
window.RM27_FINANCE={start:rmFinStart,forecast:rmFinForecast,settle:rmFinSettleFixture,attendance:rmFinAttendance,close:rmFinCloseSeason};

