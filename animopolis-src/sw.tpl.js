/* Animopolis — service worker
   La page du jeu est toujours demandée au réseau en premier : dès qu'une
   nouvelle version est publiée, elle est chargée à l'ouverture suivante.
   Sans réseau, la dernière version gardée en mémoire est utilisée. */
const VERSION='animopolis-__BUILD__';
const CORE=['./','./index.html','./manifest.webmanifest','./icon-192.png','./icon-512.png','./icon-maskable-512.png','./apple-touch-icon.png','./icon.svg','./favicon.ico'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('animopolis-')&&k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('message',e=>{if(e.data==='skipWaiting')self.skipWaiting();});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const url=new URL(r.url);
  if(/\/version\.json$/.test(url.pathname))return; // toujours demandé au réseau
  const page=r.mode==='navigate'||(url.origin===location.origin&&/\/(index\.html)?$/.test(url.pathname));
  if(page){e.respondWith(fetch(r,{cache:'no-cache'}).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put('./index.html',cp));return res;}).catch(()=>caches.match('./index.html')));return;}
  if(url.origin===location.origin){e.respondWith(caches.match(r).then(m=>m||fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp));return res;})));return;}
  if(/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)){e.respondWith(caches.match(r).then(m=>{const net=fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp));return res;}).catch(()=>m);return m||net;}));}
});
