import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative base works for GitHub project Pages.
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // Avoid browser CORS during local development.
      '/oura-api': {
        target: 'https://api.ouraring.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/oura-api/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
});
