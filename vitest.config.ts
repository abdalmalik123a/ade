import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // أبواب الاختبار (البند ٢٥) مفتوحةٌ في الاختبار كما في نسخة التطوير.
  define: { __DIWAN_TEST_DOORS__: 'true' },
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    globalSetup: ['tests/tempRoot.ts']
  }
});
