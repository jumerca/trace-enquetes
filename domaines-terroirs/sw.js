// Service worker — Domaines & Terroirs. Généré au build : ne pas modifier dist/sw.js à la main.
// Il ne touche jamais au IndexedDB : les sauvegardes survivent à toutes les mises à jour.
const BUILD = '0.3.1-202611231142';
// un cache par adresse d'installation (plusieurs copies du jeu peuvent coexister sur le même site)
const PREFIX = 'domaines-terroirs-' + self.registration.scope + '-';
const CACHE = PREFIX + BUILD;
const ASSETS = ["./","assets/CanvasPool-T2wm7Ydg.js","assets/SharedSystems-CsfZWYFN.js","assets/WebGLRenderer-Bv0s8z1l.js","assets/WebGPURenderer-B2scvip6.js","assets/browserAll-D4BQDnc3.js","assets/colorToUniform-KTpA7KSL.js","assets/index-CDVMcLUz.css","assets/index-CTiv5AMj.js","assets/react-DcELUuLK.js","assets/webworkerAll-CXoWbNs9.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg","manifest.webmanifest","sprites/vehicules-0.png","sprites/vehicules-1.png","sprites/vehicules-2.png","sprites/vehicules.json","sprites/vivants-0.png","sprites/vivants-1.png","sprites/vivants.json","index.html"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => (k.startsWith(PREFIX) || /^domaines-terroirs-\d/.test(k)) && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req)));
    return;
  }
  // Navigation : réseau d'abord (nouvelle version dès qu'en ligne), cache hors ligne.
  if (req.mode === 'navigate') {
    // no-store : jamais de page d'accueil périmée venant du cache HTTP (GitHub Pages la garde 10 min)
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((resp) => {
      if (resp.ok && resp.type === 'basic') { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return resp;
    })),
  );
});
