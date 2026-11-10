import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  build: {
    // The 3D viewer chunk (That Open + Three.js + web-ifc) is large by nature; it is
    // lazy-loaded when a project is opened, so the project list stays light.
    chunkSizeWarningLimit: 7000,
  },
  server: {
    // In development the API is reached through the Vite dev server, so the browser
    // sees a single origin and no CORS setup is needed locally.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
