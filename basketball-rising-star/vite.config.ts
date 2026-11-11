import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : le jeu peut être servi depuis n'importe quel sous-dossier HTTPS (GitHub Pages, Vercel, Netlify).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', target: 'es2020', sourcemap: false, chunkSizeWarningLimit: 900 },
  test: { environment: 'node', globals: true, include: ['tests/**/*.test.ts'], testTimeout: 120000 },
});
