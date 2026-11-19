/* Rugby Manager 27 — V2.0 · Habillage : accueil JLG Creative, numéro de version, sauvegardes */
'use strict';
(function(){
const V='2.5';
document.title='Rugby Manager 27 — V'+V;
const oldMenu=mainMenu;
mainMenu=function(){
 let h=oldMenu();
 h=h.replace(/ÉDITION JOUABLE 1\.\d · 2026–2027/,'VERSION '+V+' · 2026–2027')
  .replace('© RM27 · Édition jouable · Données en partie estimées','JLG CREATIVE · Rugby Manager 27 · version '+V+' · données de clubs 2026-2027 en partie estimées')
  .replace('<b>Nouvelle carrière</b>','<b>Nouvelle partie</b>').replace('<b>Charger ma carrière</b>','<b>Charger la partie</b>')
  .replace('66 clubs, cinq compétitions, carrière complète, économie de club et matchs 2D continus.','66 clubs, cinq compétitions. Nouveau moteur V2 : trente joueurs autonomes, mêlées, touches, mauls et rucks disputés, entraînement, contrats et intersaisons.');
 h=h.replace('<span class="launch-logo">RM<span>27</span></span>','<span class="launch-logo">RM<span>27</span></span><span class="rm2-studio">JLG CREATIVE</span>');
 return h;
};
const oldSidebar=sidebar;
sidebar=function(){return oldSidebar().replace(/ÉDITION JOUABLE · STABILISÉE 1\.\d/,'VERSION '+V+' · MOTEUR V2')};
const oldRender=render;
render=function(){oldRender();const f=document.querySelector('.foot');if(f)f.textContent='RUGBY MANAGER 27 · VERSION '+V+' · JLG CREATIVE · moteur de match multi-agents V2';};
// sauvegarde : copie horodatée avant chaque changement de saison
if(typeof rmStartNewSeason==='function'){const before=rmStartNewSeason;rmStartNewSeason=function(){try{const k='rugby-manager-27-alpha-v1';const raw=localStorage.getItem(k);if(raw)localStorage.setItem(k+'-saison-'+(state.rmSeason||1),raw)}catch(e){}return before()}}
window.RM27_VERSION=V;
})();
