/**
 * ESLint مع الوحدة (G05، D38): قاعدتا الخطّافات وحدهما (`eslint.config.mjs`) على `src/`.
 *
 * - `rules-of-hooks`: لا خطأ واحد — خطّافٌ في شرطٍ أو حلقة يكسر حال المكوّن ولا يظهر إلا أحيانًا. واسمٌ يبدأ بـ`use` وليس خطّافًا
 *   يُعدّ خرقًا أيضًا (كذا كانت `useAt` و`useCitizen` و`useSchool` قبل D38): فالدالّة العادية لا تُسمّى بـ`use`.
 * - تحذيرات `exhaustive-deps` ومواضع `eslint-disable` لا تزيد على سقفيهما بعددهما يوم كُتب الاختبار — ينقصان ولا يزيدان، كسقوف
 *   `structure`: من أصلح موضعًا خفض السقف هنا في إيداعه.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..');
/** العددان يوم ١٧ ت١ ٢٠٢٦ (D38). */
const MAX_EXHAUSTIVE_DEPS = 44;
const MAX_DISABLES = 43;

function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [join(dir, e.name)] : []
  );
}

describe('ESLint — قاعدتا الخطّافات (G05)', () => {
  it('لا خرق لـrules-of-hooks، وتحذيرات exhaustive-deps ومواضع eslint-disable لا تزيد على سقفيهما', async () => {
    const results = await new ESLint({ cwd: ROOT }).lintFiles(['src']);
    const messages = results.flatMap((r) => r.messages.map((m) => ({ ...m, file: r.filePath.slice(ROOT.length + 1) })));
    expect(messages.filter((m) => m.severity === 2).map((m) => `${m.file}:${m.line} ${m.ruleId} — ${m.message}`)).toEqual([]);

    const deps = messages.filter((m) => m.ruleId === 'react-hooks/exhaustive-deps').length;
    expect(deps, `تحذيرات exhaustive-deps ${deps} والسقف ${MAX_EXHAUSTIVE_DEPS}`).toBeLessThanOrEqual(MAX_EXHAUSTIVE_DEPS);

    const disables = sources(join(ROOT, 'src')).reduce((n, f) => n + (readFileSync(f, 'utf8').match(/eslint-disable/g) ?? []).length, 0);
    expect(disables, `مواضع eslint-disable ${disables} والسقف ${MAX_DISABLES}`).toBeLessThanOrEqual(MAX_DISABLES);
  }, 60_000);
});
