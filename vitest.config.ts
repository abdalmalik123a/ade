import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

// ملفّات نموذج ONNX — كلّ اختبارٍ يقرأ نموذجًا من `resources/models` («أزل الخلفية» والوجه): كلّ جلسةٍ بثمانية خيوط (`portrait.ts`)،
// فمعًا ومع عمّال الحزمة ملأت ذاكرة ٨ غيغا وتجاوزت مهلها (G34، D59) — فتجري وحدها بعد الباقي، ملفًّا ملفًّا. وتُعرف من نصّها،
// فيلحق بها كلّ ملفٍّ جديدٍ يقرأ نموذجًا (L63).
const ONNX = readdirSync('tests')
  .filter((name) => name.endsWith('.test.ts') && /resources['"`]?\s*[,/\\]\s*['"`]?models/.test(readFileSync(join('tests', name), 'utf8')))
  .map((name) => `tests/${name}`);

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
    environment: 'node',
    globalSetup: ['tests/tempRoot.ts'],
    // ضعف أبطأ ما قيس في الحزمة لاختبارٍ بلا مهلةٍ صريحة (٦٫٦ ث، D58) مقرَّبًا — حدٌّ أعلى لا انتظار (G34، D59).
    testTimeout: 15_000,
    // و`include` في كلّ مجموعةٍ لا في الجذر: المجموعة تضمّ قائمة الجذر إلى قائمتها ولا تستبدلها.
    projects: [
      // مكوّنات الواجهة وحدها في `tests/ui/` ببيئة jsdom يعلنها كلّ ملفٍّ في رأسه (G03) — والبيئة العامّة `node` كما هي.
      { extends: true, test: { name: 'unit', include: ['tests/**/*.test.ts', 'tests/ui/**/*.test.tsx'], exclude: [...configDefaults.exclude, ...ONNX] } },
      { extends: true, test: { name: 'onnx', include: ONNX, maxWorkers: 1, sequence: { groupOrder: 1 } } }
    ]
  }
});
