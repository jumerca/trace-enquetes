// Service worker — Les Chemins Oubliés. Généré au build : ne pas modifier dist/sw.js à la main.
const BUILD = '__BUILD__';
const CACHE = 'chemins-oublies-' + BUILD;
const ASSETS = __ASSETS__;

self.addEventListener('install', (e) => {
  // Pas de skipWaiting automatique : le jeu propose l'activation (Options → Rechercher les mises à jour).
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('chemins-oublies-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
  if (e.data === 'build') e.source && e.source.postMessage({ build: BUILD });
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // version.json : toujours le réseau (c'est lui qui annonce les mises à jour).
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  // Le reste : cache d'abord (jeu jouable hors ligne), réseau en secours.
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((resp) => {
      if (resp.ok && resp.type === 'basic') { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return resp;
    }).catch(() => (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))),
  );
});
