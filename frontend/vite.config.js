// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
    css: false,
  },
  server: {
    allowedHosts: ['wallet-analysis.matbessa.com.br'],
  },
  base: '/', // 👈 CORRETO para Fly.io / Nginx / Produção
});
