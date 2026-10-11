/**
 * تخطيط شهادة الدورة، وباج الفعالية، وكرت العمل الحديث، وبطاقة التهنئة.
 */
import type { Layout } from '../types';

export function trainingCert(): Layout {
  return {
    calm: [0.1, 0.18, 0.8, 0.65],
    images: [{ at: [0.44, 0.05, 0.12, 0.14], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.5, cy: 0.12, r: 0.09 },
      { t: 'divider', cx: 0.5, y: 0.57, w: 0.4 },
      { t: 'rule', x1: 0.62, x2: 0.88, y: 0.82 }
    ],
    texts: [
      { text: '{الجهة}', at: [0.15, 0.2, 0.7, 0.045], role: 'org', size: 13, fit: true },
      { text: 'شهادة إتمام دورة تدريبية', at: [0.1, 0.25, 0.8, 0.12], role: 'headline', size: 38 },
      { text: 'يشهد المركز بأن المتدرب/ـة:', at: [0.15, 0.39, 0.7, 0.05], role: 'intro', size: 14 },
      { text: '{الاسم}', at: [0.15, 0.44, 0.7, 0.1], role: 'name', size: 32, fit: true },
      { text: 'قد اجتاز بنجاح الدورة التخصصية في {الدورة}', at: [0.1, 0.58, 0.8, 0.055], role: 'body', size: 14, fit: true },
      { text: 'بواقع {الساعات} وبتقدير {التقدير}', at: [0.15, 0.64, 0.7, 0.05], role: 'accent', size: 13 },
      { text: 'المدرب المشرف: {الموقّع}', at: [0.62, 0.83, 0.26, 0.045], role: 'meta', size: 12 },
      { text: 'التاريخ: {التاريخ}', at: [0.12, 0.83, 0.3, 0.045], role: 'label', size: 11 }
    ]
  };
}

export function eventBadge(): Layout {
  return {
    calm: [0.06, 0.6, 0.88, 0.35],
    images: [
      { at: [0.36, 0.04, 0.28, 0.14], logo: true, fit: 'contain' },
      { at: [0.26, 0.34, 0.48, 0.32], ref: 'الصورة', fit: 'cover', radius: 8 }
    ],
    decor: [
      { t: 'band', at: [0, 0, 1, 0.3], edge: 'bottom' },
      { t: 'photo', at: [0.26, 0.34, 0.48, 0.32] },
      { t: 'band', at: [0, 0.9, 1, 0.1], edge: 'top' }
    ],
    texts: [
      { text: '{الفعالية}', at: [0.06, 0.19, 0.88, 0.07], role: 'onBand', size: 8.5, fit: true },
      { text: '{الاسم}', at: [0.06, 0.67, 0.88, 0.07], role: 'name', size: 12, fit: true },
      { text: '{الصفة}', at: [0.06, 0.74, 0.88, 0.05], role: 'accent', size: 9, fit: true },
      { text: '{الجهة}', at: [0.06, 0.795, 0.88, 0.04], role: 'body', size: 7, fit: true },
      { text: '{التاريخ}', at: [0.06, 0.91, 0.88, 0.05], role: 'onBandSmall', size: 6.5 }
    ],
    codes: [{ at: [0.36, 0.835, 0.28, 0.06], ref: 'الرقم' }]
  };
}

export function modernBusinessCard(): Layout {
  return {
    calm: [0.05, 0.1, 0.7, 0.8],
    images: [{ at: [0.82, 0.12, 0.13, 0.25], logo: true, fit: 'contain' }],
    decor: [
      { t: 'rule', x1: 0.06, x2: 0.94, y: 0.46 },
      { t: 'band', at: [0, 0.91, 1, 0.09], edge: 'top' }
    ],
    texts: [
      { text: '{الاسم}', at: [0.06, 0.14, 0.72, 0.18], role: 'name', size: 13.5, align: 'right', fit: true },
      { text: '{المسمى} — {الجهة}', at: [0.06, 0.31, 0.72, 0.11], role: 'accent', size: 8, align: 'right', fit: true },
      { text: 'هاتف: {الهاتف}', at: [0.26, 0.52, 0.68, 0.1], role: 'body', size: 7.5, align: 'right' },
      { text: 'بريد: {البريد}', at: [0.26, 0.63, 0.68, 0.1], role: 'body', size: 7.5, align: 'right', dir: 'ltr' },
      { text: '{العنوان}', at: [0.26, 0.74, 0.68, 0.1], role: 'body', size: 7, align: 'right', fit: true }
    ],
    codes: [{ at: [0.06, 0.52, 0.18, 0.32], ref: 'الرقم' }]
  };
}

export function greetingCard(): Layout {
  return {
    calm: [0.1, 0.2, 0.8, 0.6],
    images: [{ at: [0.42, 0.06, 0.16, 0.14], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.5, cy: 0.13, r: 0.09 },
      { t: 'divider', cx: 0.5, y: 0.52, w: 0.4 },
      { t: 'rule', x1: 0.1, x2: 0.9, y: 0.82 }
    ],
    texts: [
      { text: '{الجهة}', at: [0.15, 0.22, 0.7, 0.06], role: 'org', size: 13, fit: true },
      { text: 'أجمل التهاني والتبريكات', at: [0.1, 0.29, 0.8, 0.12], role: 'headline', size: 36 },
      { text: 'تتقدّم أسرة {الجهة} بأحرّ التهاني إلى', at: [0.1, 0.43, 0.8, 0.06], role: 'intro', size: 13 },
      { text: '{الاسم}', at: [0.1, 0.49, 0.8, 0.11], role: 'name', size: 30, fit: true },
      { text: 'بمناسبة {المناسبة}', at: [0.1, 0.62, 0.8, 0.08], role: 'accent', size: 18, fit: true },
      { text: 'سائلين المولى دوام التوفيق والنجاح والتألق', at: [0.1, 0.71, 0.8, 0.05], role: 'body', size: 12 },
      { text: 'التاريخ: {التاريخ}', at: [0.1, 0.85, 0.8, 0.05], role: 'meta', size: 11 }
    ]
  };
}
