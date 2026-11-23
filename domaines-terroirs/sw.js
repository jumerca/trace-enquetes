// Service worker — Domaines & Terroirs. Généré au build : ne pas modifier dist/sw.js à la main.
// Il ne touche jamais au IndexedDB : les sauvegardes survivent à toutes les mises à jour.
const BUILD = '0.3.0-202611231058';
const CACHE = 'domaines-terroirs-' + BUILD;
const ASSETS = ["./","assets/CanvasPool-xRISPB-2.js","assets/SharedSystems-ChV1yJnH.js","assets/WebGLRenderer-7jAj1Zsv.js","assets/WebGPURenderer-DWQrvTht.js","assets/browserAll-D0T05O7w.js","assets/colorToUniform-KTpA7KSL.js","assets/index-BNqFkZ0b.css","assets/index-Cx1tE9oM.js","assets/react-DcELUuLK.js","assets/webworkerAll-ZlkUoujZ.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon.svg","manifest.webmanifest","sprites/vehicules-0.png","sprites/vehicules-1.png","sprites/vehicules-2.png","sprites/vehicules.json","sprites/vivants-0.png","sprites/vivants-1.png","sprites/vivants.json","index.html"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('domaines-terroirs-') && k !== CACHE).map((k) => caches.delete(k))))
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
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req).then((resp) => {
      if (resp.ok && resp.type === 'basic') { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return resp;
    })),
  );
});
