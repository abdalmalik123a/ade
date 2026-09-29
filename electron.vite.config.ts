import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // الحزم تبقى خارج حزمة العملية الرئيسية وتُحمَّل من node_modules (`externalizeDeps` —
  // وكان إضافةً مهجورةً في electron-vite 5).
  main: {
    build: { externalizeDeps: true },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  preload: {
    build: { externalizeDeps: true },
    resolve: { alias: { '@shared': resolve('src/shared') } }
  },
  renderer: {
    root: resolve('src/renderer'),
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
});
