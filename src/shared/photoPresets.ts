/**
 * قوالب صورة المعاملة وخلفيّاتها — ودقّة الطباعة الحقيقية لا رقمها وحده.
 *
 * **لا يُدّعى مقاسٌ «رسميّ» بلا مصدر.** القالب الذي له معيارٌ منشور يحمل مصدره (`source`)،
 * وغيره «مقاسٌ شائع» تُسأل الجهة عن اشتراطها. وصاحب المكتب يُنشئ قوالبه بنفسه لما تطلبه
 * جهاتُه — فالقوالب قائمةٌ تتّسع لا جدولٌ مغلق.
 *
 * **والدقّة حقيقية**: الصورة تُرسم بكسلاتٍ بعدد ما يلزم المقاسَ بتلك الدقّة (`pixelSize`)،
 * ثم يُكتب رقمها في الملف (`setJpegDpi`) — فلا صورةٌ صغيرة يُكتب عليها «٦٠٠» فتُطبع ضبابية.
 */

export type PhotoBackground = { kind: 'white' } | { kind: 'lightBlue' } | { kind: 'custom'; color: string };

/** الأبيض أصل الصور الرسمية؛ والأزرق الفاتح لما تطلبه جهةٌ صراحةً. */
export const BACKGROUND_COLORS = { white: '#ffffff', lightBlue: '#dbe8f5' } as const;

export const backgroundColor = (bg: PhotoBackground): string =>
  bg.kind === 'custom' ? bg.color : BACKGROUND_COLORS[bg.kind];

/**
 * دليل الرأس: نسبة ما بين الذقن وقمّة الرأس إلى ارتفاع الصورة، وموضع قمّة الرأس من أعلاها.
 * يُرسم على الإطار ولا يُطبع، ومنه يُقصّ تلقائيًّا.
 */
export type HeadGuide = { min: number; max: number; top: number };

export type PhotoPreset = {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  dpi: number;
  background: PhotoBackground;
  head: HeadGuide | null;
  copies: number;
  /** ملاحظات الجهة أو المكتب. */
  notes: string;
  /** مصدرٌ منشور إن وُجد — وبدونه لا يُسمّى القالب رسميًّا. */
  source: string | null;
  builtin: boolean;
};

/** دليل المكتب لما لا معيار منشورًا له: الرأس نحو ثلثي الصورة، كما يقصّه المكتب عادةً. */
const OFFICE_HEAD: HeadGuide = { min: 0.55, max: 0.68, top: 0.1 };

export const BUILTIN_PRESETS: PhotoPreset[] = [
  {
    id: '35x45',
    name: 'جواز السفر ٣٫٥ × ٤٫٥ سم',
    widthMm: 35,
    heightMm: 45,
    dpi: 600,
    background: { kind: 'white' },
    // ICAO: الوجه من الذقن إلى قمّة الرأس ٧٠–٨٠٪ من ارتفاع الصورة.
    head: { min: 0.7, max: 0.8, top: 0.08 },
    copies: 6,
    notes: 'تأكّد من الجهة: بعض السفارات تطلب مقاسًا آخر',
    source: 'ICAO Doc 9303 (الجزء ٣) — صورة وثيقة السفر ٣٥×٤٥ ملم، والوجه ٧٠–٨٠٪ من ارتفاعها',
    builtin: true
  },
  {
    id: '4x6',
    name: '٤ × ٦ سم',
    widthMm: 40,
    heightMm: 60,
    dpi: 600,
    background: { kind: 'white' },
    head: OFFICE_HEAD,
    copies: 4,
    notes: 'مقاسٌ شائع في المعاملات — تُسأل الجهة عن اشتراطها',
    source: null,
    builtin: true
  },
  {
    id: '3x4',
    name: '٣ × ٤ سم',
    widthMm: 30,
    heightMm: 40,
    dpi: 600,
    background: { kind: 'white' },
    head: OFFICE_HEAD,
    copies: 6,
    notes: 'مقاسٌ شائع — تُسأل الجهة عن اشتراطها',
    source: null,
    builtin: true
  },
  {
    id: '5x5',
    name: '٥ × ٥ سم',
    widthMm: 50,
    heightMm: 50,
    dpi: 600,
    background: { kind: 'white' },
    head: { min: 0.5, max: 0.69, top: 0.1 },
    copies: 4,
    notes: 'مقاسٌ شائع — تُسأل الجهة عن اشتراطها',
    source: null,
    builtin: true
  },
  {
    id: '2x3',
    name: '٢ × ٣ سم',
    widthMm: 20,
    heightMm: 30,
    dpi: 600,
    background: { kind: 'white' },
    head: OFFICE_HEAD,
    copies: 8,
    notes: 'مقاسٌ شائع — تُسأل الجهة عن اشتراطها',
    source: null,
    builtin: true
  }
];

/** بكسلات الصورة بمقاسها ودقّتها — ما يُرسم فعلًا، لا ما يُكتب في الملف وحده. */
export function pixelSize(p: Pick<PhotoPreset, 'widthMm' | 'heightMm' | 'dpi'>): { w: number; h: number } {
  return { w: Math.round((p.widthMm / 25.4) * p.dpi), h: Math.round((p.heightMm / 25.4) * p.dpi) };
}

/** الدقّة التي تبلغها صورةٌ بعرض `sourceWidthPx` إن مُلئ بها المقاس — للتنبيه على الصغيرة. */
export const effectiveDpi = (sourceWidthPx: number, widthMm: number): number => Math.round((sourceWidthPx / widthMm) * 25.4);

/** قالبٌ يكتبه المكتب بيده — يُقال سبب رفضه لا يُحفظ ناقصًا. */
export function validatePreset(p: PhotoPreset): string | null {
  if (!p.name.trim()) return 'سمِّ القالب';
  if (!(p.widthMm >= 10 && p.widthMm <= 200) || !(p.heightMm >= 10 && p.heightMm <= 200)) return 'المقاس بين ١٠ و٢٠٠ ملم';
  if (!(p.dpi >= 150 && p.dpi <= 1200)) return 'الدقّة بين ١٥٠ و١٢٠٠ نقطة في الإنش';
  if (!(p.copies >= 1 && p.copies <= 200)) return 'عدد النسخ من ١ إلى ٢٠٠';
  if (p.background.kind === 'custom' && !/^#[0-9a-f]{6}$/i.test(p.background.color)) return 'لون الخلفية بصيغة #RRGGBB';
  if (p.head && !(p.head.min > 0.2 && p.head.max <= 0.95 && p.head.min < p.head.max)) return 'دليل الرأس غير معقول';
  return null;
}

/** القوالب المحفوظة من الإعدادات — وما فسد منها يُسقط ولا يُسقط الشاشة. */
export function parsePresets(json: string | null | undefined): PhotoPreset[] {
  try {
    const list = JSON.parse(json ?? '[]') as unknown;
    return Array.isArray(list) ? (list as PhotoPreset[]).filter((p) => p && typeof p.id === 'string' && !validatePreset({ ...p, builtin: false })).map((p) => ({ ...p, builtin: false })) : [];
  } catch {
    return [];
  }
}

// ── الدقّة في ملف JPEG ─────────────────────────────────────────────────

/**
 * يكتب الدقّة في رأس JFIF (APP0): الوحدة إنشًا، والكثافة أفقيًّا ورأسيًّا. والصورة المرسومة
 * بعدد بكسلات المقاس (`pixelSize`) تحمل حينئذٍ رقمها الصادق — فيطبعها أيّ برنامجٍ بمقاسها.
 * وإن غاب رأس JFIF أُدرج بعد بدء الصورة.
 */
export function setJpegDpi(jpeg: Uint8Array, dpi: number): Uint8Array<ArrayBuffer> {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) throw new Error('ليست صورة JPEG');
  const d = Math.max(1, Math.min(65535, Math.round(dpi)));
  const isJfif = jpeg[2] === 0xff && jpeg[3] === 0xe0 && String.fromCharCode(...jpeg.subarray(6, 11)) === 'JFIF\0';
  if (isJfif) {
    const out = Uint8Array.from(jpeg);
    out[13] = 1; // نقاطٌ في الإنش
    out[14] = d >> 8;
    out[15] = d & 0xff;
    out[16] = d >> 8;
    out[17] = d & 0xff;
    return out;
  }
  const app0 = Uint8Array.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00]);
  const out = new Uint8Array(jpeg.length + app0.length);
  out.set(jpeg.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(jpeg.subarray(2), 2 + app0.length);
  return out;
}
