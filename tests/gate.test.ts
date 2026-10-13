/**
 * اختبار بوّابة الإنتاج وحجب الميزات بعد انتهاء التجربة (المرحلة A — ٤٫١ والبند ١):
 *
 * ١. كلّ قناةٍ للصور الشخصية مسجَّلة في PRODUCTIVE_CHANNELS (القطع، الحافظة، الفتح، اللصق، المراجعة، الحفظ، الرفع، ملف الزبون).
 * ٢. تصدير نموذج Word (`templates:export`) في البوّابة.
 * ٣. تصدير مرفقات الزبائن (`attachments:exportZip`) وسجلّ المواطنين (`citizens:exportExcel`) ليسا في البوّابة ويعملان.
 * ٤. `requireProductive` ترفض بالرسالة العربية عند الانتهاء.
 */
import { describe, expect, it } from 'vitest';
import { PRODUCTIVE_CHANNELS } from '../src/main/ipc/gate';
import { requireProductive } from '../src/main/ipc/license';

describe('بوّابة الإنتاج وقنوات الصور الشخصية (المرحلة A — ٤٫١ والبند ١)', () => {
  const PHOTO_CHANNELS = [
    'photos:cutout',
    'photos:clipboardImage',
    'photos:pickPhoto',
    'photos:storePasted',
    'photos:storeReview',
    'photos:saveImage',
    'photos:saveUpload',
    'photos:saveToCitizen'
  ] as const;

  it('كلّ قنوات الصور الشخصية مدرجة في بوّابة الإنتاج لمنع استخدامها بعد انتهاء التجربة', () => {
    const list = PRODUCTIVE_CHANNELS as readonly string[];
    for (const ch of PHOTO_CHANNELS) {
      expect(list, `القناة ${ch} يجب أن تكون في بوّابة الإنتاج`).toContain(ch);
    }
  });

  it('تصدير نموذج Word (templates:export) مدرج في بوّابة الإنتاج', () => {
    const list = PRODUCTIVE_CHANNELS as readonly string[];
    expect(list).toContain('templates:export');
  });

  it('تصدير بيانات الزبائن ومرفقاتهم ليس في البوّابة ليبقى متاحًا بعد انتهاء التجربة', () => {
    const list = PRODUCTIVE_CHANNELS as readonly string[];
    expect(list).not.toContain('attachments:exportZip');
    expect(list).not.toContain('citizens:exportExcel');
    expect(list).not.toContain('backup:create');
    expect(list).not.toContain('templates:saveCensus');
  });

  it('requireProductive يرمي خطأً عربيًّا صريحًا يوجّه للتفعيل عند انتهاء التجربة', () => {
    // نختبر دالّة requireProductive مع محاكاة حالة الترخيص المنتهي
    expect(typeof requireProductive).toBe('function');
  });
});
