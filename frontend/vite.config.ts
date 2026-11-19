import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api': {
        target: 'https://jcb-smart-cmms-api.onrender.com',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'https://jcb-smart-cmms-api.onrender.com',
        ws: true,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
