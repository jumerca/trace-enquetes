// Mises à jour de l'application installée (PWA) : détection, activation et rechargement maîtrisé.
// Une nouvelle version est détectée par le service worker et par version.json (jamais mis en cache).

type Listener = () => void;
const listeners = new Set<Listener>();
let ready = false;

/** Une nouvelle version est prête : l'interface propose de recharger (la partie est sauvegardée avant). */
export function onUpdateReady(l: Listener) {
  listeners.add(l);
  if (ready) l();
  return () => {
    listeners.delete(l);
  };
}

function announce() {
  ready = true;
  for (const l of listeners) l();
}

export function applyUpdate() {
  location.reload();
}

export function initUpdates() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  let reloading = false;
  // première installation : la prise de contrôle n'est pas une mise à jour
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    announce();
  });
  const activate = (w: ServiceWorker | null) => w?.postMessage('skipWaiting');
  navigator.serviceWorker
    .register('./sw.js', { updateViaCache: 'none' })
    .then((reg) => {
      if (reg.waiting) activate(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) activate(w);
        });
      });
      const check = () => {
        fetch('./version.json', { cache: 'no-store' })
          .then((r) => r.json())
          .then((v: { version: string; build: string }) => {
            if (v.version !== __APP_VERSION__ || v.build !== __APP_BUILD__) reg.update().catch(() => undefined);
          })
          .catch(() => undefined);
      };
      check();
      setInterval(check, 15 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) check();
      });
    })
    .catch(() => undefined);
}
