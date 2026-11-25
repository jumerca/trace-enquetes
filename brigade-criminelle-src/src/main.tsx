import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';
import { initUpdates } from './update';

createRoot(document.getElementById('root')!).render(<App />);
window.addEventListener('load', initUpdates);
