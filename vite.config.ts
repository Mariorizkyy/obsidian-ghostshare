import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      buffer: 'buffer',
    },
  },
  define: {
    global: 'globalThis',
    'process.env': '{}',
  },
  optimizeDeps: {
    include: ['buffer', 'eciesjs', '@noble/curves', '@noble/hashes'],
    esbuildOptions: {
      define: { global: 'globalThis' },
    },
  },
  build: {
    commonjsOptions: { transformMixedEsModules: true },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
}));
