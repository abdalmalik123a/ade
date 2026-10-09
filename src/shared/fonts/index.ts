/**
 * «خطوط ديوان» (DESIGNS.md ٣٫٧ و٠٫٧) — سياسةٌ واحدة للبرنامج كلّه: الخطوط المحزومة الحرّة، وما يستورده المكتب (ملفّه في
 * المخزن ببصمته وفهرسه في القاعدة، فينتقل في النسخة الاحتياطية). يختار منها محرّر الكتب والترويسات والتصاميم.
 *
 * **ولا بديلٌ صامت**: خطٌّ تذكره ورقةٌ وليس في المكتبة يُقال باسمه ويُقترح بديله (`suggestFor`) — لا يُرسم بخطٍّ آخر بلا خبر.
 *
 * وهذا الملفّ خالص (نواة التصاميم): بلا React ولا Electron ولا Node — فيُختبر في الوحدة، وتقرؤه الواجهة والعملية الرئيسة.
 */

export type FontCategory = 'naskh' | 'kufi' | 'ruqaa' | 'display' | 'sans';

/** خطٌّ في المكتبة — عائلةٌ بأوزانها. */
export type LibraryFont = {
  family: string;
  /** كيف يُسمّى في القوائم. */
  label: string;
  category: FontCategory;
  source: 'bundled' | 'imported';
  weights: number[];
  /** ترخيص المحزوم — ويُذكر في «الإشعارات القانونية». */
  license?: string;
};

/** وجهٌ مستورد: ملفٌّ واحد بوزنه وميله (العادي والعريض ملفّان). */
export type ImportedFace = {
  id: number;
  family: string;
  weight: number;
  italic: boolean;
  /** مساره في المخزن: `fonts/<بصمة>.ttf`. */
  file: string;
  /** من ملفٍّ اختاره المكتب، أو من خطوط Windows. */
  source: 'file' | 'windows';
  originalName: string;
  createdAt: string;
};

/** ما عاد من استيراد: الوجوه المضافة، وما رُفض باسمه وسببه. */
export type FontImport = { added: ImportedFace[]; errors: { name: string; reason: string }[] };

/** عائلةٌ في خطوط Windows على هذا الجهاز — كما تُعرض للاستيراد بضغطة. */
export type WindowsFont = { family: string; faces: number; arabic: boolean; imported: boolean };

/** جسر الواجهة (`window.diwan.fonts`): المستورد وحده — والمحزوم هنا. */
export type FontsApi = {
  list(): Promise<ImportedFace[]>;
  /** ملفّات TTF أو OTF أو WOFF يختارها المكتب — كلٌّ يُفحص قبل قبوله. */
  importFiles(): Promise<FontImport>;
  /** خطوط Windows على هذا الجهاز بعائلاتها. */
  windows(): Promise<WindowsFont[]>;
  /** عائلةٌ من خطوط Windows بوجوهها كلّها — بضغطة. */
  importWindows(family: string): Promise<FontImport>;
  remove(family: string): Promise<void>;
};

/**
 * المحزومة مع البرنامج (`styles.css`، كلّها OFL) — تُرسم بها الورقة على كلّ جهاز.
 * والترتيب ترتيب القوائم: خطوط الكتب الرسمية أوّلًا.
 */
export const BUNDLED_FONTS: LibraryFont[] = [
  { family: 'Noto Naskh Arabic', label: 'نسخ (Noto Naskh)', category: 'naskh', source: 'bundled', weights: [400, 700], license: 'OFL-1.1' },
  { family: 'Amiri', label: 'أميري — نسخ كلاسيكي', category: 'naskh', source: 'bundled', weights: [400, 700], license: 'OFL-1.1' },
  { family: 'Cairo', label: 'القاهرة — حديث', category: 'sans', source: 'bundled', weights: [400, 700], license: 'OFL-1.1' },
  { family: 'IBM Plex Sans Arabic', label: 'بلكس — خطّ البرنامج', category: 'sans', source: 'bundled', weights: [400, 500, 600, 700], license: 'OFL-1.1' },
  { family: 'Noto Kufi Arabic', label: 'كوفي (Noto Kufi)', category: 'kufi', source: 'bundled', weights: [400, 700], license: 'OFL-1.1' },
  { family: 'Reem Kufi', label: 'ريم كوفي', category: 'kufi', source: 'bundled', weights: [500, 700], license: 'OFL-1.1' },
  { family: 'Aref Ruqaa', label: 'رقعة (عارف)', category: 'ruqaa', source: 'bundled', weights: [400, 700], license: 'OFL-1.1' },
  { family: 'El Messiri', label: 'المسيري', category: 'display', source: 'bundled', weights: [400, 700], license: 'OFL-1.1' },
  { family: 'Lalezar', label: 'لاله زار — عريض', category: 'display', source: 'bundled', weights: [400], license: 'OFL-1.1' }
];

/** مفاتيح خطوط الترويسة قبل المكتبة — تُقرأ بعائلاتها، فلا تُرحَّل ترويسةٌ محفوظة. */
export const LEGACY_FONT_KEYS: Record<string, string> = {
  naskh: 'Noto Naskh Arabic',
  amiri: 'Amiri',
  cairo: 'Cairo',
  plex: 'IBM Plex Sans Arabic'
};

/** عائلة مفتاحٍ قديم — بخاصّيته هو لا بما يرثه الكائن («constructor»). */
export function legacyFamily(key: string): string | undefined {
  return Object.prototype.hasOwnProperty.call(LEGACY_FONT_KEYS, key) ? LEGACY_FONT_KEYS[key] : undefined;
}

/** العائلات العامّة في CSS — ليست خطوطًا تُطلب. */
const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'inherit', 'initial', 'unset']);

/**
 * اسم العائلة نظيفًا: بلا علامات اقتباس ولا ما يكسر CSS (`;` و`{` و`'`…) — فالاسم يُكتب في نمطٍ مضمَّن، واسمٌ من ملفٍّ
 * مستورد أو من Word لا يُوثق به. حروفٌ وأرقامٌ (عربية ولاتينية) ومسافةٌ و`-` و`_` و`.` وحدها، وبحدّ ٦٤ حرفًا.
 */
export function cleanFamily(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .replace(/[^\p{L}\p{N}\p{M} ._-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64)
    .trim();
}

/** أوّل عائلةٍ في قائمة CSS: `'Amiri', serif` ← Amiri. والعامّة وحدها لا عائلة. */
export function familyOf(stack: string | undefined | null): string {
  if (!stack) return '';
  const first = cleanFamily(stack.split(',')[0] ?? '');
  return GENERIC.has(first.toLowerCase()) ? '' : first;
}

/** العائلة نفسها — بلا اعتبارٍ لحالة الحروف («amiri» هي «Amiri»). */
export const sameFamily = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** المحزوم باسمه — بلا اعتبارٍ لحالة الحروف. */
export function bundledFont(family: string): LibraryFont | undefined {
  return BUNDLED_FONTS.find((f) => sameFamily(f.family, family));
}

/** سلسلة CSS للعائلة، واحتياطها العامّ بصنفها — والمستورد ومجهول الصنف «serif» (خطوط الكتب الرسمية نسخية). */
export function stackOf(family: string): string {
  const clean = cleanFamily(family) || BUNDLED_FONTS[0]!.family;
  const generic = ['sans', 'kufi', 'display'].includes(bundledFont(clean)?.category ?? '') ? 'sans-serif' : 'serif';
  return `'${clean}', ${generic}`;
}

/** خطوط Windows الشائعة في كتب المكاتب، وأقرب محزومٍ إليها. */
const NEAREST: [RegExp, string][] = [
  [/^simplified arabic/i, 'Noto Naskh Arabic'],
  [/^(traditional arabic|sakkal majalla|arabic typesetting|times new roman|amiri)/i, 'Amiri'],
  [/^(arial|tahoma|segoe ui|calibri|verdana)/i, 'Cairo'],
  [/(kufi|كوفي)/i, 'Noto Kufi Arabic'],
  [/(ruqaa|ruqa|رقعة|diwani|ديواني|andalus)/i, 'Aref Ruqaa'],
  [/(naskh|نسخ|lotus|mudir|yakout|badr)/i, 'Noto Naskh Arabic']
];

/** بديلٌ يُقترح لخطٍّ غائب — يُقال ولا يُطبَّق وحده. */
export function suggestFor(family: string): string {
  const clean = cleanFamily(family);
  return NEAREST.find(([re]) => re.test(clean))?.[1] ?? BUNDLED_FONTS[0]!.family;
}

/** ما تذكره الورقة ولا تعرفه المكتبة — بأسمائه كما كُتبت، مرّةً لكلّ عائلة. */
export function missingFamilies(used: Iterable<string>, available: Iterable<string>): string[] {
  const have = [...available];
  const out: string[] = [];
  for (const raw of used) {
    const family = cleanFamily(raw);
    if (!family || GENERIC.has(family.toLowerCase())) continue;
    if (have.some((a) => sameFamily(a, family)) || out.some((o) => sameFamily(o, family))) continue;
    out.push(family);
  }
  return out;
}

/** المكتبة كلّها: المحزوم ثم المستورد بعائلاته (وجوهٌ تُجمع أوزانها). */
export function libraryFonts(imported: ImportedFace[]): LibraryFont[] {
  const byFamily = new Map<string, LibraryFont>();
  for (const face of imported) {
    const family = cleanFamily(face.family);
    if (!family || bundledFont(family)) continue;
    const key = family.toLowerCase();
    const entry = byFamily.get(key) ?? { family, label: family, category: 'naskh' as const, source: 'imported' as const, weights: [] };
    if (!entry.weights.includes(face.weight)) entry.weights.push(face.weight);
    entry.weights.sort((a, b) => a - b);
    byFamily.set(key, entry);
  }
  const imports = [...byFamily.values()].sort((a, b) => a.family.localeCompare(b.family));
  return [...BUNDLED_FONTS, ...imports];
}

/** مسار ملفّ خطٍّ في المخزن — بصمةٌ وامتدادٌ معروف، لا غير. */
const FACE_FILE = /^fonts\/[0-9a-f]{16,64}\.(ttf|otf|woff)$/;

/** قواعد `@font-face` للوجوه المستوردة — تُحقن في الواجهة وفي نافذة الإخراج، فتُرسم الورقة بخطّها هنا وهناك. */
export function fontFaceCss(faces: Pick<ImportedFace, 'family' | 'weight' | 'italic' | 'file'>[]): string {
  return faces
    .filter((f) => FACE_FILE.test(f.file) && cleanFamily(f.family))
    .map((f) => {
      const weight = Number.isInteger(f.weight) && f.weight >= 100 && f.weight <= 900 ? f.weight : 400;
      return `@font-face{font-family:'${cleanFamily(f.family)}';src:url('diwan://store/${f.file}');font-weight:${weight};font-style:${f.italic ? 'italic' : 'normal'};font-display:block}`;
    })
    .join('\n');
}
