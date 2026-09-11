(()=>{
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  let deferredInstall=null;

  const getButton=()=>document.getElementById('installStudio24');
  const showHelp=()=>{
    const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
    const text=isiOS
      ? '<h2>Installer Studio 24</h2><p>Sur iPhone : touche <b>Partager</b>, puis <b>Sur l’écran d’accueil</b> et valide avec <b>Ajouter</b>.</p>'
      : '<h2>Installer Studio 24</h2><p>Dans Chrome : ouvre le menu <b>⋮</b>, puis choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</p>';
    if(window.modal)modal(text);else alert(isiOS?'Partager > Sur l’écran d’accueil > Ajouter':'Menu ⋮ > Installer l’application / Ajouter à l’écran d’accueil');
  };
  const bind=()=>{
    const b=getButton();
    if(!b||b.dataset.bound==='1')return;
    b.dataset.bound='1';
    b.hidden=standalone();
    b.addEventListener('click',async()=>{
      if(standalone()){b.hidden=true;return}
      if(deferredInstall){
        deferredInstall.prompt();
        try{const choice=await deferredInstall.userChoice;if(choice.outcome==='accepted'){b.hidden=true;if(window.toast)toast('Installation de Studio 24 lancée')}}catch(e){}
        deferredInstall=null;
      }else showHelp();
    });
  };

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;bind();const b=getButton();if(b)b.hidden=false});
  window.addEventListener('appinstalled',()=>{const b=getButton();if(b)b.hidden=true;if(window.toast)toast('Studio 24 installé')});
  window.addEventListener('load',bind,{once:true});
  bind();
})();
