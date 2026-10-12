import { resolve } from 'node:path';
import { defineConfig } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  // الحزم تبقى خارج حزمة العملية الرئيسية وتُحمَّل من node_modules (`externalizeDeps` —
  // وكان إضافةً مهجورةً في electron-vite 5).
  main: {
    build: { externalizeDeps: true },
    resolve: { alias: { '@shared': resolve('src/shared') } },
    // أبواب الاختبار (البند ٢٥، `src/main/buildFlags.d.ts`): مغلقةٌ محذوفةٌ في بناء الإصدار وحده (`--mode release`).
    define: { __DIWAN_TEST_DOORS__: JSON.stringify(mode !== 'release') }
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
}));
