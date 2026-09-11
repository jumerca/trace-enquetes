(()=>{
  const BUILD='8-updatefix-1';
  const reloadedKey='studio24-sw-reloaded-'+BUILD;
  if(!('serviceWorker' in navigator)) return;

  const refreshRegistration=async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?build='+BUILD,{scope:'./',updateViaCache:'none'});
      await reg.update();
      if(reg.waiting) reg.waiting.postMessage({type:'SKIP_WAITING'});
    }catch(e){console.warn('Studio24 update check failed',e)}
  };

  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(sessionStorage.getItem(reloadedKey)) return;
    sessionStorage.setItem(reloadedKey,'1');
    location.reload();
  });

  window.addEventListener('pageshow',()=>refreshRegistration(),{once:true});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') refreshRegistration()});
})();
