import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 3000,
    // Dev proxy: forward /api/* requests to the Express backend.
    // This avoids CORS issues during local development and means the
    // frontend never hard-codes the backend port.
    proxy: {
      '/auth': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/campaigns': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/health': {
        target: process.env.VITE_API_BASE_URL ?? 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
