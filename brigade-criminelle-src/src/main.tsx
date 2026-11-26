import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import { initUpdates } from './update';
import { initAudio, sfx } from './audio/audio';

createRoot(document.getElementById('root')!).render(<App />);
window.addEventListener('load', initUpdates);
// le son démarre au premier geste (exigence des navigateurs) ; un léger clic accompagne les boutons
window.addEventListener('pointerdown', (e) => {
  initAudio();
  if ((e.target as HTMLElement)?.closest?.('button')) sfx('click');
}, { capture: true });
