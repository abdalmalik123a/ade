/**
 * المنيو والوصل والفاتورة (DESIGNS.md ٣٫١ — بقرار المالك: «يدخل الوصولات والفواتير لكن الإدخال يكون يدويًّا»): استماراتٌ
 * تُطبع ثم تُملأ بالقلم — أسطرٌ منقّطة بعد كلّ عنوان، وجدولٌ مرقّمٌ فارغ، وعلامةٌ مائية — **بلا حسابٍ ولا حقلٍ يُملأ في
 * البرنامج** إلا اسم المحلّ وعنوانه وهاتفه (هويّة الجهة). والمنيو أصنافه وأسعاره نصوصٌ تُحرَّر في المحرّر.
 */
import { toIndic } from '../../../arabic';
import type { Decor, Layout, TextSlot } from '../types';

/** عنوانٌ يمينًا وسطرٌ منقّطٌ بعده إلى اليسار — بنِسَب الورقة (من اليسار). */
function line(label: string, y: number, right = 0.95, left = 0.05, labelW = 0.24, size = 12): { text: TextSlot; rule: Decor } {
  return {
    text: { text: label, at: [right - labelW, y, labelW, 0.05], role: 'body', size, align: 'right' },
    rule: { t: 'rule', x1: left, x2: right - labelW - 0.01, y: y + 0.042 }
  };
}

export function menu(): Layout {
  const main = [
    ['قوزي على تمّن', '١٥٬٠٠٠'],
    ['دولمة عراقية', '١٢٬٠٠٠'],
    ['كباب مشوي', '١٠٬٠٠٠'],
    ['تكّة دجاج', '٩٬٠٠٠'],
    ['سمك مسكوف', '٢٠٬٠٠٠'],
    ['برياني دجاج', '١١٬٠٠٠']
  ];
  const drinks = [
    ['شاي عراقي', '٥٠٠'],
    ['لبن', '١٬٠٠٠'],
    ['عصير برتقال', '٢٬٥٠٠'],
    ['كنافة', '٤٬٠٠٠']
  ];
  const table = (rows: string[][], at: [number, number, number, number], name: string) => ({
    at,
    name,
    columns: [
      { title: 'الصنف', widthPercent: 72, align: 'right' as const },
      { title: 'السعر', widthPercent: 28, align: 'left' as const }
    ],
    rows: rows.map(([item, price]) => [{ text: item! }, { text: price! }]),
    fontSize: 13,
    stripe: false,
    borders: 'rows' as const,
    hideHeader: true
  });
  return {
    calm: [0.08, 0.14, 0.84, 0.72],
    images: [{ at: [0.42, 0.035, 0.16, 0.09], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.5, cy: 0.08, r: 0.07 },
      { t: 'divider', cx: 0.5, y: 0.272, w: 0.5 },
      { t: 'divider', cx: 0.5, y: 0.6, w: 0.3 }
    ],
    texts: [
      { text: '{الجهة}', at: [0.1, 0.14, 0.8, 0.075], role: 'headline', size: 38, fit: true },
      { text: 'قائمة الطعام', at: [0.2, 0.218, 0.6, 0.035], role: 'intro', size: 14 },
      { text: 'الأطباق الرئيسية', at: [0.1, 0.29, 0.8, 0.04], role: 'accent', size: 18 },
      { text: 'المشروبات والحلويات', at: [0.1, 0.615, 0.8, 0.04], role: 'accent', size: 18 },
      { text: '{العنوان} — {الهاتف}', at: [0.08, 0.875, 0.84, 0.035], role: 'meta', size: 12, fit: true },
      { text: 'الأسعار بالدينار العراقي', at: [0.2, 0.912, 0.6, 0.03], role: 'label', size: 10 }
    ],
    tables: [table(main, [0.1, 0.335, 0.8, 0.255], 'الأطباق الرئيسية'), table(drinks, [0.1, 0.66, 0.8, 0.18], 'المشروبات والحلويات')]
  };
}

export function receipt(): Layout {
  const rows = [line('استلمنا من السيد / السيدة', 0.4, 0.95, 0.05, 0.32), line('مبلغًا وقدره', 0.5), line('وذلك عن', 0.6), line('', 0.7)];
  const no = line('رقم الوصل', 0.29, 0.95, 0.58, 0.16, 11);
  const date = line('التاريخ', 0.29, 0.46, 0.05, 0.12, 11);
  return {
    calm: [0.05, 0.17, 0.9, 0.76],
    images: [{ at: [0.05, 0.04, 0.12, 0.17], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.11, cy: 0.125, r: 0.085 },
      { t: 'divider', cx: 0.5, y: 0.265, w: 0.3 },
      { t: 'seal', cx: 0.5, cy: 0.58, r: 0.32, faint: true },
      no.rule,
      date.rule,
      ...rows.map((r) => r.rule),
      { t: 'rule', x1: 0.62, x2: 0.95, y: 0.9 },
      { t: 'rule', x1: 0.05, x2: 0.38, y: 0.9 }
    ],
    texts: [
      { text: '{الجهة}', at: [0.4, 0.05, 0.55, 0.065], role: 'org', size: 15, align: 'right', fit: true },
      { text: '{العنوان} — {الهاتف}', at: [0.4, 0.115, 0.55, 0.04], role: 'label', size: 9, align: 'right', fit: true },
      { text: 'وصل قبض', at: [0.3, 0.165, 0.4, 0.09], role: 'headline', size: 28 },
      no.text,
      date.text,
      ...rows.filter((r) => r.text.text).map((r) => r.text),
      { text: 'المستلم', at: [0.62, 0.82, 0.33, 0.05], role: 'meta', size: 12 },
      { text: 'التوقيع والختم', at: [0.05, 0.82, 0.33, 0.05], role: 'meta', size: 12 }
    ]
  };
}

export function invoice(): Layout {
  const no = line('رقم', 0.235, 0.95, 0.55, 0.1, 11);
  const date = line('التاريخ', 0.235, 0.45, 0.05, 0.14, 11);
  const customer = line('اسم الزبون', 0.28, 0.95, 0.05, 0.2, 11);
  const total = line('المجموع الكلّي', 0.81, 0.95, 0.05, 0.26, 12);
  return {
    calm: [0.05, 0.16, 0.9, 0.8],
    images: [{ at: [0.05, 0.03, 0.18, 0.11], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.14, cy: 0.085, r: 0.075 },
      { t: 'divider', cx: 0.5, y: 0.158, w: 0.6 },
      // العلامة المائية تحت الجدول.
      { t: 'seal', cx: 0.5, cy: 0.56, r: 0.3, faint: true },
      no.rule,
      date.rule,
      customer.rule,
      total.rule,
      { t: 'rule', x1: 0.6, x2: 0.95, y: 0.945 },
      { t: 'rule', x1: 0.05, x2: 0.4, y: 0.945 }
    ],
    texts: [
      { text: '{الجهة}', at: [0.3, 0.035, 0.65, 0.06], role: 'org', size: 16, align: 'right', fit: true },
      { text: '{العنوان} — {الهاتف}', at: [0.3, 0.095, 0.65, 0.035], role: 'label', size: 9, align: 'right', fit: true },
      { text: 'فاتورة', at: [0.3, 0.165, 0.4, 0.06], role: 'headline', size: 26 },
      no.text,
      date.text,
      customer.text,
      total.text,
      { text: 'توقيع البائع', at: [0.6, 0.885, 0.35, 0.04], role: 'meta', size: 11 },
      { text: 'توقيع المستلم', at: [0.05, 0.885, 0.35, 0.04], role: 'meta', size: 11 }
    ],
    tables: [
      {
        at: [0.05, 0.33, 0.9, 0.465],
        name: 'المواد',
        columns: [
          { title: 'ت', widthPercent: 8, align: 'center' },
          { title: 'المادة', widthPercent: 44, align: 'right' },
          { title: 'العدد', widthPercent: 14, align: 'center' },
          { title: 'السعر', widthPercent: 17, align: 'center' },
          { title: 'المجموع', widthPercent: 17, align: 'center' }
        ],
        // اثنا عشر سطرًا مرقّمًا فارغًا — تُملأ بالقلم.
        rows: Array.from({ length: 12 }, (_, i) => [{ text: toIndic(i + 1) }, { text: '' }, { text: '' }, { text: '' }, { text: '' }]),
        fontSize: 10,
        stripe: true
      }
    ]
  };
}
