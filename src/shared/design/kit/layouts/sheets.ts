/**
 * تخطيط الشهادات ولوحة الشرف والدعوة.
 */
import type { Decor, Layout, TextSlot, Variant } from '../types';

// ── الشهادات ─────────────────────────────────────────────────────────

export function certificate(headline: string, intro: string, reason: string) {
  return (v: Variant): Layout => {
    if (v === 'asym') {
      // الحديث: كتلةٌ لونية يسارًا عليها الشعار، والنصّ يمينًا بمحاذاةٍ واحدة.
      const x = 0.4;
      const w = 0.54;
      return {
        calm: [x, 0.08, w, 0.84],
        images: [{ at: [0.07, 0.31, 0.16, 0.225], logo: true, fit: 'contain' }],
        decor: [
          { t: 'seal', cx: 0.15, cy: 0.42, r: 0.17 },
          { t: 'divider', cx: x + w - 0.05, y: 0.345, w: 0.1 },
          { t: 'rule', x1: 0.66, x2: 0.94, y: 0.8 }
        ],
        texts: [
          { text: '{الجهة}', at: [x, 0.1, w, 0.05], role: 'org', size: 12, align: 'right', fit: true },
          { text: headline, at: [x, 0.16, w, 0.16], role: 'headline', size: 48, align: 'right' },
          { text: intro, at: [x, 0.37, w, 0.055], role: 'intro', size: 15, align: 'right' },
          { text: '{الاسم}', at: [x, 0.43, w, 0.11], role: 'name', size: 36, align: 'right', fit: true },
          { text: reason, at: [x, 0.56, w, 0.13], role: 'body', size: 14, align: 'right' },
          { text: '{الموقّع}', at: [0.66, 0.81, 0.28, 0.045], role: 'meta', size: 13, align: 'right' },
          { text: '{صفة الموقّع}', at: [0.66, 0.855, 0.28, 0.04], role: 'label', size: 11, align: 'right' },
          { text: 'التاريخ: {التاريخ}', at: [x, 0.81, 0.22, 0.045], role: 'meta', size: 12, align: 'right' }
        ]
      };
    }
    return {
      calm: [0.12, 0.2, 0.76, 0.56],
      images: [{ at: [0.447, 0.06, 0.106, 0.15], logo: true, fit: 'contain' }],
      decor: [
        { t: 'seal', cx: 0.5, cy: 0.135, r: 0.095 },
        { t: 'divider', cx: 0.5, y: 0.595, w: 0.34 },
        { t: 'rule', x1: 0.64, x2: 0.86, y: 0.8 }
      ],
      texts: [
        { text: '{الجهة}', at: [0.2, 0.225, 0.6, 0.05], role: 'org', size: 13, fit: true },
        { text: headline, at: [0.15, 0.275, 0.7, 0.14], role: 'headline', size: 46 },
        { text: intro, at: [0.15, 0.42, 0.7, 0.055], role: 'intro', size: 15 },
        { text: '{الاسم}', at: [0.18, 0.478, 0.64, 0.105], role: 'name', size: 34, fit: true },
        { text: reason, at: [0.16, 0.615, 0.68, 0.1], role: 'body', size: 14 },
        { text: '{الموقّع}', at: [0.64, 0.81, 0.22, 0.045], role: 'meta', size: 13 },
        { text: '{صفة الموقّع}', at: [0.64, 0.855, 0.22, 0.04], role: 'label', size: 11 },
        { text: 'التاريخ: {التاريخ}', at: [0.14, 0.81, 0.22, 0.045], role: 'meta', size: 12 }
      ]
    };
  };
}

export function honour(v: Variant): Layout {
  const rows = [0.41, 0.56, 0.71];
  const ranks = ['المرتبة الأولى', 'المرتبة الثانية', 'المرتبة الثالثة'];
  const keys = ['{الأول}', '{الثاني}', '{الثالث}'];
  const align = v === 'asym' ? 'right' : 'center';
  return {
    calm: [0.12, 0.17, 0.76, 0.66],
    images: [{ at: [0.42, 0.05, 0.16, 0.113], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.5, cy: 0.106, r: 0.075 },
      { t: 'divider', cx: 0.5, y: 0.355, w: 0.4 },
      ...rows.map((y, i): Decor => ({ t: 'medal', cx: 0.2, cy: y + 0.045, r: 0.045, rank: i + 1 })),
      { t: 'rule', x1: 0.6, x2: 0.86, y: 0.885 }
    ],
    texts: [
      { text: '{الجهة}', at: [0.15, 0.178, 0.7, 0.035], role: 'org', size: 13, fit: true },
      { text: 'لوحة الشرف', at: [0.1, 0.215, 0.8, 0.085], role: 'headline', size: 46 },
      { text: '{المرحلة} — العام الدراسي {العام الدراسي}', at: [0.12, 0.302, 0.76, 0.035], role: 'intro', size: 14 },
      ...rows.flatMap((y, i): TextSlot[] => [
        { text: keys[i]!, at: [0.3, y + 0.01, 0.58, 0.055], role: 'name', size: 26, align, fit: true },
        { text: ranks[i]!, at: [0.3, y + 0.066, 0.58, 0.03], role: 'accent', size: 12, align }
      ]),
      { text: '{الموقّع}', at: [0.6, 0.89, 0.26, 0.03], role: 'meta', size: 12 },
      { text: 'التاريخ: {التاريخ}', at: [0.14, 0.89, 0.26, 0.03], role: 'meta', size: 12 }
    ]
  };
}

export function invitation(): Layout {
  return {
    calm: [0.1, 0.24, 0.8, 0.6],
    images: [{ at: [0.39, 0.07, 0.22, 0.155], logo: true, fit: 'contain' }],
    decor: [
      { t: 'seal', cx: 0.5, cy: 0.148, r: 0.1 },
      { t: 'divider', cx: 0.5, y: 0.545, w: 0.42 }
    ],
    texts: [
      { text: 'دعوة', at: [0.2, 0.245, 0.6, 0.12], role: 'headline', size: 50 },
      { text: 'يتشرّف {الجهة} بدعوتكم لحضور', at: [0.08, 0.375, 0.84, 0.05], role: 'intro', size: 13, fit: true },
      { text: '{المناسبة}', at: [0.08, 0.435, 0.84, 0.09], role: 'name', size: 22, fit: true },
      { text: 'يوم {اليوم} {التاريخ} — {الوقت}', at: [0.08, 0.575, 0.84, 0.045], role: 'body', size: 12, fit: true },
      { text: 'المكان: {المكان}', at: [0.08, 0.625, 0.84, 0.045], role: 'body', size: 12, fit: true },
      { text: 'حضوركم يسعدنا', at: [0.1, 0.715, 0.8, 0.06], role: 'accent', size: 17 },
      { text: '{الداعي}', at: [0.08, 0.8, 0.84, 0.045], role: 'meta', size: 12, fit: true }
    ]
  };
}
