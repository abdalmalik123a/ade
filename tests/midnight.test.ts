/**
 * منتصف الليل (المرحلة ٧ — الحوافّ): «اليوم» يومُ المكتب لا يومُ غرينتش.
 *
 * بغداد متقدّمةٌ على UTC ثلاث ساعات: من منتصف الليل حتى الثالثة يكون تاريخ UTC أمسَ.
 * فكلّ «اليوم» يُحسب بالوقت المحلي — في أسماء الملفّات، وفي القاعدة (`'localtime'`)،
 * وفي الواجهة — وكتابٌ صدر بعد منتصف الليل بنصف ساعة كتابُ اليوم الجديد.
 */
import { describe, expect, it } from 'vitest';
import { freshDb } from './helpers';
import { isoDate } from '../src/shared/dates';
import { issueDocument, listDocuments } from '../src/main/services/documents';
import type { IssueInput } from '../src/shared/api';

const input = (): IssueInput => ({
  sheetHtml: '<div class="a4-sheet"><div>نؤيد أن السيد أحمد عبد الله يعمل لدينا.</div></div>',
  templateId: null,
  citizenId: null,
  authorityId: null,
  citizenName: 'أحمد عبد الله الجبوري',
  nationalId: null,
  docType: 'تأييد',
  destination: null,
  purpose: null,
  values: {},
  copies: 1,
  copyKind: 'نسخة أصلية',
  fee: 0,
  gregorianDate: '',
  hijriDate: '',
  operator: 'مشغّل',
  printer: null,
  serialPrefix: 'م',
  serialYear: 2026,
  letterheadId: null
});

describe('منتصف الليل', () => {
  it('اليوم المحلي لا يوم UTC — بعد منتصف الليل بنصف ساعة', () => {
    const d = new Date(2026, 8, 28, 0, 30); // ٠٠:٣٠ بالوقت المحلي
    expect(isoDate(d)).toBe('2026-09-28');
    // وهذا ما كانت تُسمّى به ملفّات التصدير: يومٌ قبله حيث التوقيت متقدّمٌ على UTC.
    if (d.getTimezoneOffset() < 0) expect(d.toISOString().slice(0, 10)).toBe('2026-09-27');
  });

  it('والقاعدة تحفظ UTC وتقرأ بالمحلي — فالكتاب في يوم المكتب', () => {
    const db = freshDb();
    const { id } = issueDocument(db, input());
    // لحظةٌ بعينها: ٢١:٣٠ UTC — وهي بعد منتصف الليل في كلّ توقيتٍ متقدّمٍ ثلاث ساعات فأكثر.
    const instant = new Date('2026-09-27T21:30:00Z');
    db.prepare('UPDATE documents SET issued_at = ? WHERE id = ?').run('2026-09-27 21:30:00', id);
    const local = isoDate(instant);
    const found = listDocuments(db, { from: local, to: local, limit: 10 });
    expect(found.map((r) => r.id)).toContain(id);
    expect(found[0]!.issuedDate).toBe(local);
  });
});
