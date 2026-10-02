/**
 * مجلّدٌ مؤقّتٌ واحد لتشغيل اختبارات الوحدة كلّه (`globalSetup`): ما تبنيه الاختبارات بـ`tmpdir()`
 * يقع فيه، ويُمحى بعد أن تخرج العمّال كلّها — فلا يبقى قاعدةٌ مفتوحة تمسك ملفًّا. وكانت تبقى في TEMP
 * مجلّدًا لكلّ اختبارٍ في كلّ تشغيل حتى بلغت الآلاف.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function setup(): () => Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'diwan-vitest-'));
  // العمّال يُنشَؤون بعد هذا فيرثونه: `tmpdir()` فيهم يقرأ TEMP.
  process.env['TEMP'] = process.env['TMP'] = process.env['TMPDIR'] = root;
  return async () => {
    // عاملٌ لم يخرج بعدُ قد يمسك ملفًّا لحظات: يُعاد المحو. ومجلّدٌ مؤقّتٌ بقي لا يُفشل التشغيل.
    for (let i = 0; i < 20; i++) {
      try {
        rmSync(root, { recursive: true, force: true });
        return;
      } catch {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    console.warn(`لم يُمحَ مجلّد الاختبار المؤقّت: ${root}`);
  };
}
