/**
 * اختبارات رسالة تصدير المرفقات وتفصيل المتعذّر (المرحلة A، ٤٫٦).
 */
import { describe, expect, it } from 'vitest';
import { formatExportZipMessage, type ExportZipFailure } from '../src/shared/apiCitizens';

describe('رسالة تصدير المرفقات وتفصيل المتعذّر (٤٫٦)', () => {
  it('النجاح الكامل (all-success): صياغة واضحة دون كلمة «تمّ»', () => {
    const single = formatExportZipMessage(1, 1, []);
    expect(single).toBe('صُدّر مستمسك واحد في حزمة');
    expect(single).not.toMatch(/\bتمّ?\b/);

    const multi = formatExportZipMessage(4, 4, []);
    expect(multi).toBe('صُدّرت 4 مستمسكات في حزمة');
    expect(multi).not.toMatch(/\bتمّ?\b/);
  });

  it('تعذّر ملف واحد (single-failure): يوضّح العدد والملف المتعذّر وسببه ولا يقول «تمّ»', () => {
    const failed: ExportZipFailure[] = [{ docType: 'هويّة الأحوال', reason: 'مفقود من المخزن' }];
    const msg = formatExportZipMessage(4, 3, failed);

    expect(msg).toBe('صُدّرت 3 من 4 — تعذّر: هويّة الأحوال (مفقود من المخزن)');
    expect(msg).not.toMatch(/\bتمّ?\b/);
  });

  it('تعذّر عدّة ملفات (multi-failure): يوضّح العدد وقائمة الملفات المتعذّرة ولا يقول «تمّ»', () => {
    const failed: ExportZipFailure[] = [
      { docType: 'هويّة الأحوال', reason: 'مفقود من المخزن' },
      { docType: 'بطاقة السكن', reason: 'مفقود من المخزن' }
    ];
    const msg = formatExportZipMessage(4, 2, failed);

    expect(msg).toBe('صُدّرت 2 من 4 — تعذّر: هويّة الأحوال، بطاقة السكن (مفقود من المخزن)');
    expect(msg).not.toMatch(/\bتمّ?\b/);
  });

  it('تعذّر جميع الملفات (all-failed): يبيّن فشل التصدير ويسرد الملفات المتعذّرة', () => {
    const failed: ExportZipFailure[] = [
      { docType: 'هويّة الأحوال', reason: 'مفقود من المخزن' },
      { docType: 'بطاقة السكن', reason: 'مفقود من المخزن' },
      { docType: 'شهادة الجنسية', reason: 'مفقود من المخزن' }
    ];
    const msg = formatExportZipMessage(3, 0, failed);

    expect(msg).toBe('تعذّر تصدير المستمسكات: هويّة الأحوال، بطاقة السكن، شهادة الجنسية (مفقود من المخزن)');
    expect(msg).not.toMatch(/\bتمّ?\b/);
  });

  it('اختلاف أسباب التعذّر يُفرد كل سبب في التوضيح', () => {
    const failed: ExportZipFailure[] = [
      { docType: 'هويّة الأحوال', reason: 'مفقود من المخزن' },
      { docType: 'عقد الإيجار', reason: 'تعذّرت قراءة الملف' }
    ];
    const msg = formatExportZipMessage(3, 1, failed);

    expect(msg).toBe('صُدّرت 1 من 3 — تعذّر: هويّة الأحوال، عقد الإيجار (مفقود من المخزن، تعذّرت قراءة الملف)');
    expect(msg).not.toMatch(/\bتمّ?\b/);
  });
});
