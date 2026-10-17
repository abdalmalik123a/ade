/**
 * ESLint (G05، D38): قاعدتا الخطّافات وحدهما على `src/` — لا قواعد أسلوب، ولا فحص أنواع (المحلّل بلا مشروع أنواعٍ فيبقى سريعًا).
 * `rules-of-hooks` خطأٌ يُسقط، و`exhaustive-deps` تحذيرٌ يعدّه `tests/lint.test.ts` بسقفٍ ينقص ولا يزيد.
 *
 *   npm run lint
 */
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
];
