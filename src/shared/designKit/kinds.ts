/**
 * أنواع التصاميم وتخطيطها — ما يطلبه الزبون فعلًا من المكتب.
 *
 * التخطيط **نِسَبٌ من الورقة** والمحور الأفقي من اليسار (كإحداثيات الرسم)،
 * ويُقلب عند بناء العناصر. وهو لا يعرف لونًا ولا خطًّا: يقول «هنا العنوان،
 * وهنا الاسم، وهنا خطّ التوقيع» — والنمط يقرّر كيف يبدو كلٌّ منها.
 *
 * ولكل نوعٍ عيّنةُ قيمٍ عراقية حقيقية الشكل — تُرسم بها اللمحة في المعرض،
 * فيرى المكتب هويةً لا صندوقًا فارغًا. وهي أمثلة، لا بيانات أحد.
 */
import type { CanvasSize } from '../canvas';

/** دورُ النصّ: عليه يختار النمط الخطَّ واللون. */
export type Role =
  | 'org'
  | 'headline'
  | 'intro'
  | 'name'
  | 'body'
  | 'meta'
  | 'label'
  | 'accent'
  | 'big'
  | 'onBand'
  | 'onBandSmall';

/** [يسار، أعلى، عرض، ارتفاع] نِسَبًا. */
export type Rect = [number, number, number, number];

export type TextSlot = {
  text: string;
  at: Rect;
  role: Role;
  /** بالنقاط، قبل أن يضربه النمط. */
  size: number;
  align?: 'center' | 'right' | 'left';
  /** سطرٌ يصغر ليسع — للأسماء والجهات. */
  fit?: boolean;
  dir?: 'rtl' | 'ltr';
};

export type ImageSlot = {
  at: Rect;
  /** حقل الصورة (صورة الطالب)، أو شعار الجهة. */
  ref?: string;
  logo?: boolean;
  fit: 'cover' | 'contain';
  radius?: number;
};

export type Decor =
  | { t: 'band'; at: Rect; edge?: 'bottom' | 'top' }
  | { t: 'rule'; x1: number; x2: number; y: number }
  | { t: 'divider'; cx: number; y: number; w: number }
  | { t: 'photo'; at: Rect }
  | { t: 'panel'; at: Rect }
  | { t: 'seal'; cx: number; cy: number; r: number; faint?: boolean }
  | { t: 'medal'; cx: number; cy: number; r: number; rank: number };

export type Layout = {
  texts: TextSlot[];
  images: ImageSlot[];
  /**
   * باركود الرقم — في الهويّات والبطاقات وحدها (قرار المالك): يُمسح عند باب
   * المدرسة أو المكتبة. ولا باركود في الكتب ولا الأسئلة ولا المعاملات.
   */
  codes?: { at: Rect; ref: string }[];
  decor: Decor[];
  /** منطقة النصّ الرئيسية — الزخرفة المتناثرة لا تدخلها. */
  calm: Rect;
};

export type Family = 'sheet' | 'card';
export type Variant = 'centered' | 'asym';

export type KindSpec = {
  key: string;
  title: string;
  group: string;
  size: CanvasSize;
  bleed: number;
  family: Family;
  layout: (v: Variant) => Layout;
  sample: Record<string, string>;
};

const A4L: CanvasSize = { w: 297, h: 210 };
const A4P: CanvasSize = { w: 210, h: 297 };
const A5P: CanvasSize = { w: 148, h: 210 };
const A6L: CanvasSize = { w: 148, h: 105 };
const CR80L: CanvasSize = { w: 85.6, h: 54 };
const CR80P: CanvasSize = { w: 54, h: 85.6 };
const CARD9x5: CanvasSize = { w: 90, h: 50 };

// ── العيّنة ──────────────────────────────────────────────────────────

export const SAMPLE: Record<string, string> = {
  الجهة: 'مدرسة الرافدين الابتدائية',
  المدرسة: 'مدرسة الرافدين الابتدائية',
  الدائرة: 'مديرية تربية بغداد / الكرخ الأولى',
  المديرية: 'المديرية العامة لتربية بغداد الكرخ الأولى',
  الاسم: 'زينب علي حسين الموسوي',
  السبب: 'تقديرًا لجهودها المتميّزة وتفانيها في خدمة المسيرة التربوية',
  التاريخ: '١٥ / ٥ / ٢٠٢٦',
  الموقّع: 'أ. سعاد كاظم جواد',
  'صفة الموقّع': 'مديرة المدرسة',
  المرحلة: 'الصف الخامس الابتدائي',
  'العام الدراسي': '٢٠٢٥ – ٢٠٢٦',
  النشاط: 'مسابقة القراءة العربية',
  'تاريخ النشاط': '١٠ / ٣ / ٢٠٢٦',
  الصف: 'الخامس الابتدائي',
  الرقم: '2026-0457',
  العنوان: 'بغداد — المنصور — شارع ١٤ رمضان',
  الهاتف: '0770 123 4567',
  'العنوان الوظيفي': 'مدرّسة لغة عربية',
  الصلاحية: '٣٠ / ٦ / ٢٠٢٧',
  القاعة: '٧',
  المركز: 'إعدادية المنصور للبنين',
  'رقم الجلوس': '10427',
  الشعبة: 'أ',
  المادة: 'الرياضيات',
  المسمى: 'مدير المبيعات',
  البريد: 'info@alrafidain.iq',
  المناسبة: 'حفل تخرّج الدفعة الثانية عشرة',
  اليوم: 'الخميس',
  الوقت: 'العاشرة صباحًا',
  المكان: 'قاعة المدرسة الكبرى',
  الداعي: 'إدارة المدرسة والهيئة التعليمية',
  الأول: 'حسين علي عبد الأمير',
  الثاني: 'مريم أحمد صالح',
  الثالث: 'يوسف كريم جاسم'
};

// ── الشهادات ─────────────────────────────────────────────────────────

function certificate(headline: string, intro: string, reason: string) {
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

function honour(v: Variant): Layout {
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

function invitation(): Layout {
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

// ── البطاقات ─────────────────────────────────────────────────────────

function studentId(): Layout {
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

function staffId(): Layout {
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

function idBack(): Layout {
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

function examCard(): Layout {
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

function label(): Layout {
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

function businessCard(): Layout {
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

// ── القائمة ──────────────────────────────────────────────────────────

export const KINDS: KindSpec[] = [
  {
    key: 'thanks',
    title: 'شكر وتقدير',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate('شكر وتقدير', 'تتقدّم {الجهة} بخالص الشكر والتقدير إلى', '{السبب}'),
    sample: SAMPLE
  },
  {
    key: 'excellence',
    title: 'شهادة تفوّق',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate(
      'شهادة تفوّق',
      'تمنح {الجهة} هذه الشهادة إلى',
      'لتفوّقه في {المرحلة} للعام الدراسي {العام الدراسي}'
    ),
    sample: SAMPLE
  },
  {
    key: 'participation',
    title: 'شهادة مشاركة',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate('شهادة مشاركة', 'تشهد {الجهة} بأنّ', 'قد شارك في {النشاط} المقام بتاريخ {تاريخ النشاط}'),
    sample: SAMPLE
  },
  {
    key: 'graduation',
    title: 'شهادة تخرّج',
    group: 'شهادات',
    size: A4L,
    bleed: 0,
    family: 'sheet',
    layout: certificate('شهادة تخرّج', 'تشهد {الجهة} بأنّ', 'قد أتمّ {المرحلة} بنجاح للعام الدراسي {العام الدراسي}'),
    sample: SAMPLE
  },
  { key: 'honour', title: 'لوحة الشرف', group: 'شهادات', size: A4P, bleed: 0, family: 'sheet', layout: honour, sample: SAMPLE },
  { key: 'student-id', title: 'هويّة طالب', group: 'هويّات', size: CR80L, bleed: 3, family: 'card', layout: studentId, sample: SAMPLE },
  { key: 'staff-id', title: 'هويّة موظف', group: 'هويّات', size: CR80P, bleed: 3, family: 'card', layout: staffId, sample: SAMPLE },
  { key: 'id-back', title: 'ظهر الهويّة', group: 'هويّات', size: CR80L, bleed: 3, family: 'card', layout: idBack, sample: SAMPLE },
  { key: 'exam-card', title: 'البطاقة الامتحانية', group: 'مدرسية', size: A6L, bleed: 3, family: 'card', layout: examCard, sample: SAMPLE },
  { key: 'label', title: 'ملصق دفتر', group: 'مدرسية', size: CARD9x5, bleed: 2, family: 'card', layout: label, sample: SAMPLE },
  { key: 'invitation', title: 'بطاقة دعوة', group: 'مناسبات', size: A5P, bleed: 3, family: 'sheet', layout: invitation, sample: SAMPLE },
  { key: 'business', title: 'بطاقة عمل', group: 'أعمال', size: CARD9x5, bleed: 2, family: 'card', layout: businessCard, sample: SAMPLE }
];

export const kindOf = (key: string): KindSpec | undefined => KINDS.find((k) => k.key === key);
