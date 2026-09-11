(()=>{
  const BASE='/trace-enquetes/studio24/';
  const standalone=()=>window.matchMedia('(display-mode: standalone)').matches||window.navigator.standalone===true;
  let deferredInstall=null;

  // Force Studio 24 identity in browser chrome / shortcuts.
  document.documentElement.dataset.pwa='studio24';
  let appName=document.querySelector('meta[name="application-name"]');
  if(!appName){appName=document.createElement('meta');appName.name='application-name';document.head.appendChild(appName)}
  appName.content='Studio 24';
  let appleName=document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if(!appleName){appleName=document.createElement('meta');appleName.name='apple-mobile-web-app-title';document.head.appendChild(appleName)}
  appleName.content='Studio 24';
  ['mobile-web-app-capable','apple-mobile-web-app-capable'].forEach(n=>{let m=document.querySelector(`meta[name="${n}"]`);if(!m){m=document.createElement('meta');m.name=n;document.head.appendChild(m)}m.content='yes'});
  document.querySelectorAll('link[rel="icon"]').forEach(l=>{l.href=BASE+'icon-192.png';l.type='image/png'});
  document.querySelectorAll('link[rel="apple-touch-icon"]').forEach(l=>{l.href=BASE+'icon-192.png'});

  const style=document.createElement('style');
  style.textContent=`
    .install-chip{appearance:none;border:1px solid rgba(216,170,77,.38);background:rgba(7,17,31,.58);color:#e8d39b;border-radius:999px;padding:7px 11px;font:600 11px/1 system-ui,sans-serif;letter-spacing:.02em;display:inline-flex;align-items:center;gap:6px;cursor:pointer;opacity:.78;transition:.2s ease;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
    .install-chip:hover,.install-chip:active{opacity:1;border-color:rgba(216,170,77,.75);transform:translateY(-1px)}
    .install-chip[hidden]{display:none!important}
    .install-chip .install-dot{width:6px;height:6px;border-radius:50%;background:#5bd3ff;box-shadow:0 0 9px rgba(91,211,255,.8)}
    .title-foot{gap:10px;flex-wrap:wrap;justify-content:center}
    @media(max-width:640px){.install-chip{font-size:10px;padding:6px 9px}.title-foot{padding-bottom:calc(8px + env(safe-area-inset-bottom))}}
  `;
  document.head.appendChild(style);

  const mount=()=>{
    const foot=document.querySelector('.title-foot');
    if(!foot||document.getElementById('installStudio24'))return;
    const b=document.createElement('button');
    b.id='installStudio24';b.className='install-chip';b.type='button';
    b.innerHTML='<span class="install-dot"></span><span>Installer</span>';
    b.hidden=standalone();
    b.addEventListener('click',async()=>{
      if(standalone()){b.hidden=true;return}
      if(deferredInstall){
        deferredInstall.prompt();
        try{const choice=await deferredInstall.userChoice;if(choice.outcome==='accepted'){b.hidden=true;if(window.toast)toast('Studio 24 est en cours d’installation')}}catch(e){}
        deferredInstall=null;return;
      }
      const isiOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
      const text=isiOS
        ? '<h2>Installer Studio 24</h2><p>Sur iPhone : touche <b>Partager</b>, puis <b>Sur l’écran d’accueil</b> et valide avec <b>Ajouter</b>.</p>'
        : '<h2>Installer Studio 24</h2><p>Dans Chrome : ouvre le menu <b>⋮</b>, puis choisis <b>Installer l’application</b> ou <b>Ajouter à l’écran d’accueil</b>.</p><p class="muted">Si l’option n’apparaît pas encore, recharge cette page une fois : le nouveau manifeste Studio 24 est en cours de prise en compte.</p>';
      if(window.modal)modal(text);else alert(isiOS?'Partager > Sur l’écran d’accueil > Ajouter':'Menu ⋮ > Installer l’application / Ajouter à l’écran d’accueil');
    });
    foot.appendChild(b);
  };

  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;mount();const b=document.getElementById('installStudio24');if(b)b.hidden=false});
  window.addEventListener('appinstalled',()=>{const b=document.getElementById('installStudio24');if(b)b.hidden=true;if(window.toast)toast('Studio 24 installé')});
  window.addEventListener('load',mount,{once:true});
  mount();
})();
