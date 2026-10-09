/**
 * تخطيط البطاقات: هويّات الطلبة والموظفين وظهرها، وبطاقة الامتحان، والملصق، وكرت العمل.
 */
import type { Layout, TextSlot } from '../types';

// ── البطاقات ─────────────────────────────────────────────────────────

export function studentId(): Layout {
  return {
    calm: [0.32, 0.3, 0.64, 0.55],
    images: [
      { at: [0.852, 0.035, 0.113, 0.18], logo: true, fit: 'contain' },
      { at: [0.05, 0.315, 0.245, 0.53], ref: 'الصورة', fit: 'cover', radius: 6 }
    ],
    decor: [
      { t: 'band', at: [0, 0, 1, 0.25], edge: 'bottom' },
      { t: 'photo', at: [0.05, 0.315, 0.245, 0.53] },
      { t: 'seal', cx: 0.62, cy: 0.6, r: 0.36, faint: true },
      { t: 'band', at: [0, 0.885, 1, 0.115], edge: 'top' }
    ],
    texts: [
      { text: '{المدرسة}', at: [0.16, 0.035, 0.67, 0.11], role: 'onBand', size: 9, fit: true },
      { text: 'هويّة طالب', at: [0.16, 0.14, 0.67, 0.08], role: 'onBandSmall', size: 6.5 },
      { text: '{الاسم}', at: [0.33, 0.31, 0.62, 0.13], role: 'name', size: 11, align: 'right', fit: true },
      { text: 'الصف: {الصف}', at: [0.33, 0.45, 0.62, 0.095], role: 'body', size: 7.5, align: 'right', fit: true },
      { text: 'الرقم: {الرقم}', at: [0.33, 0.545, 0.62, 0.095], role: 'body', size: 7.5, align: 'right' },
      { text: 'العام الدراسي: {العام الدراسي}', at: [0.33, 0.64, 0.62, 0.095], role: 'body', size: 7.5, align: 'right' },
      { text: '{العنوان}', at: [0.05, 0.895, 0.9, 0.095], role: 'onBandSmall', size: 5.5, fit: true }
    ],
    codes: [{ at: [0.55, 0.745, 0.4, 0.12], ref: 'الرقم' }]
  };
}

export function staffId(): Layout {
  return {
    calm: [0.06, 0.68, 0.88, 0.22],
    images: [
      { at: [0.389, 0.035, 0.222, 0.14], logo: true, fit: 'contain' },
      { at: [0.29, 0.345, 0.42, 0.33], ref: 'الصورة', fit: 'cover', radius: 6 }
    ],
    decor: [
      { t: 'band', at: [0, 0, 1, 0.315], edge: 'bottom' },
      { t: 'photo', at: [0.29, 0.345, 0.42, 0.33] },
      { t: 'band', at: [0, 0.915, 1, 0.085], edge: 'top' }
    ],
    texts: [
      { text: '{الدائرة}', at: [0.06, 0.18, 0.88, 0.065], role: 'onBand', size: 8, fit: true },
      { text: 'هويّة موظف', at: [0.06, 0.245, 0.88, 0.05], role: 'onBandSmall', size: 6 },
      { text: '{الاسم}', at: [0.06, 0.685, 0.88, 0.07], role: 'name', size: 11, fit: true },
      { text: '{العنوان الوظيفي}', at: [0.06, 0.752, 0.88, 0.045], role: 'accent', size: 8, fit: true },
      { text: 'الرقم الوظيفي: {الرقم}', at: [0.06, 0.797, 0.88, 0.04], role: 'body', size: 6.5 },
      { text: 'صالحة حتى {الصلاحية}', at: [0.06, 0.922, 0.88, 0.07], role: 'onBandSmall', size: 6 }
    ],
    codes: [{ at: [0.2, 0.843, 0.6, 0.06], ref: 'الرقم' }]
  };
}

export function idBack(): Layout {
  const line = (text: string, y: number): TextSlot => ({
    text,
    at: [0.06, y, 0.88, 0.09],
    role: 'body',
    size: 6.3,
    align: 'right',
    fit: true
  });
  return {
    calm: [0.05, 0.2, 0.9, 0.75],
    images: [],
    decor: [
      { t: 'band', at: [0, 0, 1, 0.18], edge: 'bottom' },
      { t: 'seal', cx: 0.8, cy: 0.72, r: 0.2, faint: true },
      { t: 'rule', x1: 0.06, x2: 0.4, y: 0.84 }
    ],
    texts: [
      { text: '{المدرسة}', at: [0.05, 0.03, 0.9, 0.12], role: 'onBand', size: 8, fit: true },
      line('• هذه الهويّة ملكٌ لـ{المدرسة}، وتُبرز عند الطلب.', 0.24),
      line('• لا تُعار لغير صاحبها، ويُبلَّغ عن فقدانها فورًا.', 0.335),
      line('• من يجدها يُرجى تسليمها إلى المدرسة أو الاتصال بـ{الهاتف}', 0.43),
      { text: 'العنوان: {العنوان}', at: [0.06, 0.55, 0.88, 0.08], role: 'meta', size: 6, align: 'right', fit: true },
      { text: 'توقيع المدير وختم المدرسة', at: [0.06, 0.855, 0.34, 0.07], role: 'label', size: 5.5 }
    ]
  };
}

export function examCard(): Layout {
  return {
    calm: [0.28, 0.35, 0.68, 0.4],
    images: [
      { at: [0.865, 0.03, 0.1, 0.14], logo: true, fit: 'contain' },
      { at: [0.05, 0.37, 0.2, 0.39], ref: 'الصورة', fit: 'cover', radius: 4 }
    ],
    decor: [
      { t: 'band', at: [0, 0, 1, 0.2], edge: 'bottom' },
      { t: 'photo', at: [0.05, 0.37, 0.2, 0.39] },
      { t: 'panel', at: [0.05, 0.795, 0.9, 0.15] }
    ],
    texts: [
      { text: '{المديرية}', at: [0.15, 0.025, 0.7, 0.07], role: 'onBandSmall', size: 8, fit: true },
      { text: '{الجهة}', at: [0.15, 0.095, 0.7, 0.085], role: 'onBand', size: 11, fit: true },
      { text: 'البطاقة الامتحانية', at: [0.2, 0.225, 0.6, 0.11], role: 'headline', size: 19 },
      { text: 'الاسم: {الاسم}', at: [0.29, 0.37, 0.66, 0.085], role: 'name', size: 12, align: 'right', fit: true },
      { text: 'الصف: {الصف}', at: [0.29, 0.465, 0.66, 0.07], role: 'body', size: 10, align: 'right', fit: true },
      { text: 'القاعة: {القاعة}', at: [0.29, 0.535, 0.66, 0.07], role: 'body', size: 10, align: 'right' },
      { text: 'المركز الامتحاني: {المركز}', at: [0.29, 0.605, 0.66, 0.07], role: 'body', size: 10, align: 'right', fit: true },
      { text: 'العام الدراسي {العام الدراسي}', at: [0.29, 0.68, 0.66, 0.07], role: 'label', size: 9, align: 'right' },
      { text: 'رقم الجلوس', at: [0.6, 0.81, 0.33, 0.12], role: 'meta', size: 11, align: 'right' },
      { text: '{رقم الجلوس}', at: [0.08, 0.8, 0.5, 0.14], role: 'big', size: 24, align: 'left', fit: true, dir: 'ltr' }
    ]
  };
}

export function label(): Layout {
  return {
    calm: [0.05, 0.3, 0.9, 0.66],
    images: [],
    decor: [
      { t: 'band', at: [0, 0, 1, 0.26], edge: 'bottom' },
      { t: 'rule', x1: 0.06, x2: 0.94, y: 0.5 },
      { t: 'rule', x1: 0.06, x2: 0.94, y: 0.685 },
      { t: 'rule', x1: 0.06, x2: 0.94, y: 0.87 }
    ],
    texts: [
      { text: '{المدرسة}', at: [0.05, 0.045, 0.9, 0.17], role: 'onBand', size: 8.5, fit: true },
      { text: '{الاسم}', at: [0.06, 0.3, 0.88, 0.19], role: 'name', size: 13, align: 'right', fit: true },
      { text: 'الصف: {الصف}', at: [0.52, 0.52, 0.42, 0.16], role: 'body', size: 9.5, align: 'right', fit: true },
      { text: 'الشعبة: {الشعبة}', at: [0.06, 0.52, 0.42, 0.16], role: 'body', size: 9.5, align: 'right' },
      { text: 'المادة: {المادة}', at: [0.06, 0.705, 0.88, 0.16], role: 'body', size: 10, align: 'right', fit: true }
    ]
  };
}

export function businessCard(): Layout {
  return {
    calm: [0.05, 0.1, 0.72, 0.8],
    images: [{ at: [0.8, 0.1, 0.14, 0.25], logo: true, fit: 'contain' }],
    decor: [
      { t: 'divider', cx: 0.64, y: 0.45, w: 0.58 },
      { t: 'band', at: [0, 0.9, 1, 0.1], edge: 'top' }
    ],
    texts: [
      { text: '{الاسم}', at: [0.06, 0.12, 0.7, 0.17], role: 'name', size: 13, align: 'right', fit: true },
      { text: '{المسمى}', at: [0.06, 0.29, 0.7, 0.11], role: 'accent', size: 8, align: 'right', fit: true },
      { text: 'هاتف: {الهاتف}', at: [0.06, 0.52, 0.88, 0.1], role: 'body', size: 7.5, align: 'right' },
      { text: '{البريد}', at: [0.06, 0.62, 0.88, 0.1], role: 'body', size: 7.5, align: 'right', dir: 'ltr' },
      { text: '{العنوان}', at: [0.06, 0.72, 0.88, 0.1], role: 'body', size: 7.5, align: 'right', fit: true }
    ]
  };
}
