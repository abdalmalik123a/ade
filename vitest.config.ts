import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // أبواب الاختبار (البند ٢٥) مفتوحةٌ في الاختبار كما في نسخة التطوير.
  define: { __DIWAN_TEST_DOORS__: 'true' },
  // JSX كما تبنيه الواجهة (`jsx: react-jsx` في tsconfig.web) لمكوّنات `tests/ui/` — وإلا طُلب `React` في كلّ ملف.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    // مكوّنات الواجهة وحدها في `tests/ui/` ببيئة jsdom يعلنها كلّ ملفٍّ في رأسه (G03) — والبيئة العامّة `node` كما هي.
    include: ['tests/**/*.test.ts', 'tests/ui/**/*.test.tsx'],
    environment: 'node',
    globalSetup: ['tests/tempRoot.ts']
  }
});
