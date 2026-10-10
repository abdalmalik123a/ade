/**
 * الإمساكية (DESIGNS.md ٣٫٤، ومثال المالك «إمساكية بغداد»): قوسٌ وشعارٌ في الأعلى، والعنوان وسطر السنة ومدينة التوقيت، ثم
 * جدولٌ كبيرٌ بأيّام رمضان الثلاثين والجمعة مميّزة، ودعاء الإفطار، واسم الجهة الراعية وعنوانها وهاتفها — فالإمساكية تُطبع
 * إعلانًا لمحلٍّ أو مسجدٍ أو مكتب.
 *
 * والأيّام هنا لرمضان ١٤٤٨ (عيّنةٌ ثابتة للمعرض واللقطات)، **والأوقات فارغة**: تُستورد من الجدول الرسمي في المحرّر، ويُبنى
 * الجدول برمضان القادم حين يُفتح (`freshImsakiya`).
 */
import { IMSAKIYA_TABLE, IMSAKIYA_YEAR, NO_TIMES, imsakiyaGrid, yearLine } from '../../imsakiya';
import type { ImsakiyaSettings } from '../../model/types';
import type { Layout } from '../types';

/** رمضان ١٤٤٨ بأمّ القرى: الإثنين ٨ شباط ٢٠٢٧. */
export const SAMPLE_RAMADAN: ImsakiyaSettings = { start: '2027-02-08', calendar: 'both', digits: 'indic', fridays: true };

export function imsakiya(): Layout {
  const grid = imsakiyaGrid(NO_TIMES, SAMPLE_RAMADAN, 30);
  return {
    calm: [0.05, 0.11, 0.9, 0.87],
    images: [{ at: [0.45, 0.028, 0.1, 0.066], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.5, cy: 0.062, r: 0.045 },
      { t: 'divider', cx: 0.5, y: 0.868, w: 0.4 }
    ],
    texts: [
      { text: 'إمساكية شهر رمضان المبارك', at: [0.14, 0.122, 0.72, 0.052], role: 'headline', size: 28, fit: true },
      { text: yearLine(SAMPLE_RAMADAN), at: [0.25, 0.172, 0.5, 0.028], role: 'accent', size: 15, name: IMSAKIYA_YEAR },
      { text: 'حسب توقيت مدينة {المدينة}', at: [0.2, 0.2, 0.6, 0.024], role: 'label', size: 10 },
      { text: 'دعاء الإفطار: اللهمّ لك صمتُ، وعلى رزقك أفطرتُ', at: [0.1, 0.876, 0.8, 0.028], role: 'intro', size: 11, fit: true },
      { text: '{الجهة}', at: [0.1, 0.907, 0.8, 0.036], role: 'org', size: 16, fit: true },
      { text: '{العنوان} — {الهاتف}', at: [0.1, 0.945, 0.8, 0.024], role: 'meta', size: 10, fit: true }
    ],
    tables: [
      {
        // داخل إطار النمط (الإسلاميّ أعرضها) — لا فوقه.
        at: [0.1, 0.232, 0.8, 0.62],
        name: IMSAKIYA_TABLE,
        columns: grid.columns.map((c) => ({ title: c.title, widthPercent: c.widthPercent, align: 'center' as const })),
        rows: grid.rows.map((r) => r.map((c) => ({ text: c.text }))),
        fontSize: 10,
        dense: true,
        stripe: true,
        marked: grid.fridays,
        imsakiya: SAMPLE_RAMADAN
      }
    ]
  };
}
