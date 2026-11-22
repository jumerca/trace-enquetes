// Service worker — Racing Dynasty. Généré au build : ne pas modifier dist/sw.js à la main.
// Il ne touche jamais au localStorage : les sauvegardes survivent à toutes les mises à jour.
const BUILD = '0.4.0-202611221646';
const CACHE = 'racing-dynasty-' + BUILD;
const ASSETS = ["./","assets/CanvasPool-D-2Jnb-q.js","assets/SharedSystems-8oxagKcw.js","assets/WebGLRenderer-gK_v9Psl.js","assets/WebGPURenderer-Y6iyULZ0.js","assets/bangers-latin-400-normal-CondpPRf.woff2","assets/bangers-latin-400-normal-_pKr8EKx.woff","assets/bangers-latin-ext-400-normal-CE1yv2Kp.woff","assets/bangers-latin-ext-400-normal-CuUygl31.woff2","assets/bangers-vietnamese-400-normal-CqY-T-W0.woff2","assets/bangers-vietnamese-400-normal-_bd9wsER.woff","assets/barlow-condensed-latin-500-normal-BZhxI-S8.woff2","assets/barlow-condensed-latin-500-normal-CgFv4DbK.woff","assets/barlow-condensed-latin-700-normal-B9NQhHK3.woff2","assets/barlow-condensed-latin-700-normal-IaWpoxiT.woff","assets/barlow-condensed-latin-ext-500-normal-8xWaBKho.woff2","assets/barlow-condensed-latin-ext-500-normal-aT87XWLU.woff","assets/barlow-condensed-latin-ext-700-normal-CUij3gnH.woff","assets/barlow-condensed-latin-ext-700-normal-D1u2T3o9.woff2","assets/barlow-condensed-vietnamese-500-normal-BiFOxWMd.woff","assets/barlow-condensed-vietnamese-500-normal-DJF-uNlS.woff2","assets/barlow-condensed-vietnamese-700-normal-6E49mAj2.woff2","assets/barlow-condensed-vietnamese-700-normal-fAytnyZo.woff","assets/browserAll-Gmkhx7sd.js","assets/colorToUniform-C2GHuDhf.js","assets/index-ChuKhARP.css","assets/index-DpDM1HSu.js","assets/webworkerAll-BtJ2rhGt.js","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-192.png","icons/icon-maskable-512.png","manifest.webmanifest","index.html"];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('racing-dynasty-') && k !== CACHE).map((k) => caches.delete(k))))
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
