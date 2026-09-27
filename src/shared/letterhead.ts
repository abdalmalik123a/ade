/**
 * الترويسة: ثلاثة أقسام جنبًا إلى جنب.
 *
 * كل جهة تكتب رأس كتابها بطريقتها، وأكثر الكتب الرسمية تقسم الرأس صفًّا واحدًا:
 * الجهة على اليمين، والشعار في الوسط، والعدد والتاريخ على اليسار. ولأن الكتب
 * تختلف — وبعضها بقسم واحد وبعضها بقسمين — فالمكتب يختار عدد الأقسام لكل كتاب،
 * ويحرّر الترويسة مع الكتاب نفسه لا في شاشة منفصلة.
 *
 * الأقسام مرتّبة من اليمين إلى اليسار: الأول يمين الورقة دائمًا.
 * البنية تُخزَّن JSON في letterheads.layout_json ومع كل مسودة وكتاب.
 */

import { docText, emptyDoc, normalizeDoc, type Block } from './doc';

export type BlockKind = 'text' | 'image' | 'divider' | 'field' | 'spacer';
export type Align = 'right' | 'center' | 'left';

export type LetterheadBlock = {
  id: string;
  kind: BlockKind;
  /** نص السطر، أو مسار الصورة داخل المخزن، أو اسم الحقل التلقائي. */
  value: string;
  align: Align;
  size: number;
  bold: boolean;
  /** عرض الصورة بالبكسل (الارتفاع تبعًا للنسبة). */
  width?: number;
  /** مسافة رأسية بعد الكتلة بالبكسل. */
  gap?: number;
};

export type LetterheadSection = {
  id: string;
  blocks: LetterheadBlock[];
  /** حصّة القسم من عرض الورقة (وزن نسبي بين الأقسام الظاهرة). */
  weight: number;
};

export type ColumnCount = 1 | 2 | 3;

/**
 * العدد والتاريخ: موضعهما الطبيعي في القسم الأخير من الترويسة، لا سطرًا
 * مستقلًّا في متن الكتاب. والتاريخ فوق العدد كما تكتبه الدوائر.
 *
 * `manual` هو الأصل: الكتاب يخرج بفراغ يملؤه موظّف الاستلام بخطّه.
 */
export type RegistryMode = 'manual' | 'printed';

/**
 * أفي الترويسة موضعٌ للعدد على الكتاب — سطرُ «العدد:» مطبوعًا، أو حقلٌ فيه؟
 * فيُسأل الموظف عنه في الشبّاك، وإلا لم يُسأل عن شيءٍ لا يُطبع.
 */
export function asksLetterNumber(layout: LetterheadLayout | null): boolean {
  if (!layout) return false;
  if (layout.registry.show && layout.registry.mode === 'printed') return true;
  return layout.sections.some((s) => s.blocks.some((b) => b.kind === 'field' && b.value.includes('رقم_الصادر')));
}

export type LetterheadRegistry = {
  show: boolean;
  mode: RegistryMode;
};

/**
 * البسملة سطرٌ فوق الأقسام كلّها، لا كتلةٌ داخل عمود.
 *
 * ومطفأة في الأصل: كتب الوزارات والمديريات أكثرها بلا بسملة، وكتب المدارس
 * والمخاتير أكثرها بها — فالافتراض خطأ في نصف الحالات، وإشعالها ضغطة.
 */
export type LetterheadBasmala = {
  show: boolean;
  text: string;
  size: number;
  align: Align;
};

export const BASMALA_TEXT = 'بسم الله الرحمن الرحيم';

/**
 * خطّ الترويسة: واحد لها كلّها لا لكل سطر.
 *
 * خطٌّ لكل سطر يُخرج ترويسات مهلهلة، وهو باب «Word المصغّر». والأربعة محزومة
 * في التطبيق — لا من النظام — فالإخراج واحد على كل جهاز.
 */
export type FontKey = 'plex' | 'amiri' | 'naskh' | 'cairo';

export const FONTS: { key: FontKey; label: string; stack: string }[] = [
  { key: 'naskh', label: 'نسخ (Noto Naskh)', stack: "'Noto Naskh Arabic', serif" },
  { key: 'amiri', label: 'أميري — نسخ كلاسيكي', stack: "'Amiri', serif" },
  { key: 'cairo', label: 'القاهرة — حديث', stack: "'Cairo', sans-serif" },
  { key: 'plex', label: 'بلكس — خط التطبيق', stack: "'IBM Plex Sans Arabic', sans-serif" }
];

export function fontStack(key: FontKey): string {
  return (FONTS.find((f) => f.key === key) ?? FONTS[FONTS.length - 1]!).stack;
}

export type LetterheadLayout = {
  /** الهوامش بالمليمتر — التصميم يحدّد 20mm قياسيًا. */
  margins: { top: number; right: number; bottom: number; left: number };
  /** كم قسمًا يظهر على الورقة: الأول يمينًا، ثم ما بعده يسارًا. */
  columns: ColumnCount;
  /** ثلاثة دائمًا في التخزين — يُعرض منها `columns`، فلا يضيع ما كُتب عند التقليل. */
  sections: [LetterheadSection, LetterheadSection, LetterheadSection];
  /** خط فاصل أسفل الترويسة، كما في أكثر الكتب الرسمية. */
  divider: boolean;
  /** العدد والتاريخ في القسم الأخير — اختياريان. */
  registry: LetterheadRegistry;
  /** سطر البسملة فوق الأقسام. */
  basmala: LetterheadBasmala;
  /** خط الترويسة كلّها. */
  font: FontKey;
  /**
   * رأسٌ من ورقة: كتل الوثيقة نفسها كما رسمها Word، لا أقسامٌ مبنيّة.
   *
   * رأس المدرسة في Word «ادارة» على ٢٥ ملم و«العدد:» حيث أوصلته المسافات،
   * وعرض عموديه يختلف من سطر لسطر — وتحويله أقسامًا ثلاثة يزحزحه عن موضعه.
   * فيُحفظ كما هو، ويُرسم بالرسّام الذي يرسم المتن. وإن وُجد غلب الأقسام.
   */
  sheet?: Block[];
};

/** الصيغة القديمة: كتل في عمود واحد. تبقى مقروءة، وتُرحَّل عند القراءة. */
type LegacyLayout = {
  margins?: LetterheadLayout['margins'];
  blocks?: LetterheadBlock[];
};

export const DEFAULT_MARGINS = { top: 20, right: 20, bottom: 20, left: 20 };

let seq = 0;
export function newId(prefix = 's'): string {
  seq += 1;
  return `${prefix}${Date.now().toString(36)}${seq.toString(36)}`;
}

export function emptySection(weight = 1): LetterheadSection {
  return { id: newId('sec'), blocks: [], weight };
}

/** ترويسةٌ فارغة — والبسملة بتفضيل المكتب إن اختاره (FOUNDATION §٥). */
export function emptyLayout(opts: { basmala?: boolean } = {}): LetterheadLayout {
  return {
    margins: { ...DEFAULT_MARGINS },
    columns: 1,
    sections: [emptySection(), emptySection(), emptySection()],
    divider: true,
    registry: { show: false, mode: 'manual' },
    basmala: { show: opts.basmala === true, text: BASMALA_TEXT, size: 14, align: 'center' },
    font: 'naskh'
  };
}

function normalizeRegistry(raw: unknown): LetterheadRegistry {
  if (!raw || typeof raw !== 'object') return { show: false, mode: 'manual' };
  const value = raw as Partial<LetterheadRegistry>;
  return { show: value.show === true, mode: value.mode === 'printed' ? 'printed' : 'manual' };
}

function normalizeBasmala(raw: unknown): LetterheadBasmala {
  const base: LetterheadBasmala = { show: false, text: BASMALA_TEXT, size: 14, align: 'center' };
  if (!raw || typeof raw !== 'object') return base;
  const v = raw as Partial<LetterheadBasmala>;
  return {
    show: v.show === true,
    text: typeof v.text === 'string' && v.text.trim() ? v.text : base.text,
    size: typeof v.size === 'number' && v.size > 0 ? v.size : base.size,
    align: v.align === 'right' || v.align === 'left' ? v.align : 'center'
  };
}

/**
 * الترويسة المحفوظة قبل اختيار الخط تبقى على خطّ التطبيق.
 *
 * وإلا تبدّل شكلُ ما بناه المكتب — وشكلُ لقطات الكتب الصادرة — بلا أن يطلب.
 * أما الجديدة فتبدأ بالنسخ، وهو خطّ الكتاب الرسمي.
 */
function normalizeFont(raw: unknown, fallback: FontKey): FontKey {
  return FONTS.some((f) => f.key === raw) ? (raw as FontKey) : fallback;
}

/** المحاذاة الافتراضية لقسم بحسب موضعه: الأول يمين، والأخير يسار، وما بينهما وسط. */
export function defaultAlign(index: number, columns: ColumnCount): Align {
  if (columns === 1) return 'center';
  if (index === 0) return 'right';
  if (index === columns - 1) return 'left';
  return 'center';
}

/**
 * يقرأ أي بنية محفوظة ويعيدها بالصيغة الحالية.
 *
 * الترويسات التي بُنيت قبل الأقسام كانت عمودًا واحدًا، فتصير القسم الأول
 * بعرض الورقة كلّها — فلا يفقد المكتب ما بناه.
 */
export function normalizeLayout(raw: unknown): LetterheadLayout {
  const base = emptyLayout();
  if (!raw || typeof raw !== 'object') return base;

  const input = raw as Partial<LetterheadLayout> & LegacyLayout;
  const margins = { ...DEFAULT_MARGINS, ...(input.margins ?? {}) };
  // كتلٌ لا تُفهم تسقط كما تسقط من الوثيقة — بالقارئ نفسه.
  const sheet = Array.isArray(input.sheet) ? normalizeDoc({ blocks: input.sheet }).blocks : [];
  if (sheet.length) {
    return { ...base, margins, divider: false, font: 'plex', sheet };
  }

  if (Array.isArray(input.sections) && input.sections.length > 0) {
    const sections = [0, 1, 2].map((i) => {
      const s = input.sections?.[i];
      return s && Array.isArray(s.blocks)
        ? { id: s.id || newId('sec'), blocks: s.blocks, weight: s.weight || 1 }
        : emptySection();
    }) as LetterheadLayout['sections'];
    const columns: ColumnCount =
      input.columns === 2 || input.columns === 3 ? input.columns : 1;
    return {
      margins,
      columns,
      sections,
      divider: input.divider !== false,
      registry: normalizeRegistry(input.registry),
      basmala: normalizeBasmala(input.basmala),
      font: normalizeFont(input.font, 'plex')
    };
  }

  if (Array.isArray(input.blocks)) {
    const sections = [
      { id: newId('sec'), blocks: input.blocks, weight: 1 },
      emptySection(),
      emptySection()
    ] as LetterheadLayout['sections'];
    return {
      margins,
      columns: 1,
      sections,
      divider: true,
      registry: { show: false, mode: 'manual' },
      basmala: normalizeBasmala(input.basmala),
      font: normalizeFont(input.font, 'plex')
    };
  }

  return { ...base, margins };
}

/** الأقسام الظاهرة فعلًا على الورقة. */
export function visibleSections(layout: LetterheadLayout): LetterheadSection[] {
  return layout.sections.slice(0, layout.columns);
}

/** هل في الترويسة ما يُطبع أصلًا؟ */
export function isLayoutEmpty(layout: LetterheadLayout): boolean {
  if (layout.sheet?.length) return false;
  return (
    !layout.registry.show &&
    !layout.basmala.show &&
    visibleSections(layout).every((s) => s.blocks.length === 0)
  );
}

/** كل نصّ في الترويسة — للبحث عنها بما كُتب فيها لا باسمها وحده. */
export function layoutText(layout: LetterheadLayout): string {
  if (layout.sheet?.length) return docText({ ...emptyDoc(), blocks: layout.sheet });
  const lines = layout.sections.flatMap((s) =>
    s.blocks.filter((b) => b.kind === 'text').map((b) => b.value)
  );
  if (layout.basmala.show) lines.push(layout.basmala.text);
  return lines.join(' ');
}

export type Letterhead = {
  id: number;
  name: string;
  authorityId: number | null;
  layout: LetterheadLayout;
  isDefault: boolean;
  /** تصنيفٌ يسمّيه المكتب: مدرسة، تربية، بلدية… ولا قائمة مفروضة. */
  category: string | null;
  isFavorite: boolean;
  /** آخر مرّة استُعملت فيها — عليها يقوم ترتيب القائمة. */
  usedAt: string | null;
  /** رقم النسخة: يزيد مع كل حفظٍ غيّر شيئًا (FOUNDATION §٣). */
  revision?: number;
};

/**
 * الحقول التلقائية التي يجوز وضعها في الترويسة.
 * هذه أسماء يعرفها المحرّك ويملؤها عند الإصدار — وليست بيانات مبرمَجة.
 */
export const HEADER_FIELDS = [
  // الوسم باقٍ باسمه للترويسات المحفوظة، ومعناه العدد على الكتاب — لا رقم المكتب (§١).
  { token: '{رقم_الصادر}', label: 'العدد على الكتاب' },
  { token: '{التاريخ_الميلادي}', label: 'التاريخ الميلادي' },
  { token: '{التاريخ_الهجري}', label: 'التاريخ الهجري' },
  { token: '{الجهة}', label: 'اسم الجهة' },
  { token: '{القسم}', label: 'القسم أو الإدارة' },
  { token: '{التشكيل}', label: 'التشكيل المباشر' }
] as const;

/** ملّم → بكسل عند 96 نقطة/إنش، وهو المقياس الذي تفترضه معاينة A4 (794px = 210mm). */
export function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}

