import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    // In development the API is reached through the Vite dev server, so the browser
    // sees a single origin and no CORS setup is needed locally.
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
});
