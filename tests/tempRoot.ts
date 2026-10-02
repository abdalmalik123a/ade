/**
 * مجلّدٌ مؤقّتٌ واحد لتشغيل اختبارات الوحدة كلّه (`globalSetup`): ما تبنيه الاختبارات بـ`tmpdir()`
 * يقع فيه، ويُمحى بعد أن تخرج العمّال كلّها — فلا يبقى قاعدةٌ مفتوحة تمسك ملفًّا. وكانت تبقى في TEMP
 * مجلّدًا لكلّ اختبارٍ في كلّ تشغيل حتى بلغت الآلاف.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function setup(): () => void {
  const root = mkdtempSync(join(tmpdir(), 'diwan-vitest-'));
  // العمّال يُنشَؤون بعد هذا فيرثونه: `tmpdir()` فيهم يقرأ TEMP.
  process.env['TEMP'] = process.env['TMP'] = process.env['TMPDIR'] = root;
  return () => rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
