// Service worker — Les Chemins Oubliés. Généré au build : ne pas modifier dist/sw.js à la main.
const BUILD = '0.1.0-202611160131';
const CACHE = 'chemins-oublies-' + BUILD;
const ASSETS = ["./","assets/alegreya-latin-400-italic-BXpar-rJ.woff2","assets/alegreya-latin-400-italic-CJvUQvZT.woff","assets/alegreya-latin-400-normal-BLlBRtDv.woff2","assets/alegreya-latin-400-normal-BuQWlRPA.woff","assets/alegreya-latin-700-normal-BS7r-qZs.woff","assets/alegreya-latin-700-normal-Vpz_43wJ.woff2","assets/alegreya-sc-latin-400-normal-eVOwGI7S.woff","assets/alegreya-sc-latin-400-normal-nTGC35F9.woff2","assets/alegreya-sc-latin-700-normal-C1NSl7Ln.woff","assets/alegreya-sc-latin-700-normal-ztAmjLTs.woff2","assets/index-BFmIAmjo.js","assets/index-CTolhwH-.css","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-192.png","icons/icon-maskable-512.png","manifest.webmanifest","index.html"];

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
