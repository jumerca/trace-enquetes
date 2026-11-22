import { createRoot } from 'react-dom/client';
import '@fontsource/bangers/400.css';
import '@fontsource/barlow-condensed/500.css';
import '@fontsource/barlow-condensed/700.css';
import './styles.css';
import { App } from './ui/App';

createRoot(document.getElementById('root')!).render(<App />);

// Service worker uniquement en production (HTTPS ou localhost).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded && navigator.serviceWorker.controller) {
        reloaded = true;
      }
    });
  });
}
