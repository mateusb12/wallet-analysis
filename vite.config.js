// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js', // path to your setup file
    css: false, // Disable CSS parsing for speed
  },
  base: '/wallet-analysis/',
});