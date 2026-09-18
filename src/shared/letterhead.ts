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

export type LetterheadRegistry = {
  show: boolean;
  mode: RegistryMode;
};

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

export function emptyLayout(): LetterheadLayout {
  return {
    margins: { ...DEFAULT_MARGINS },
    columns: 1,
    sections: [emptySection(), emptySection(), emptySection()],
    divider: true,
    registry: { show: false, mode: 'manual' }
  };
}

function normalizeRegistry(raw: unknown): LetterheadRegistry {
  if (!raw || typeof raw !== 'object') return { show: false, mode: 'manual' };
  const value = raw as Partial<LetterheadRegistry>;
  return { show: value.show === true, mode: value.mode === 'printed' ? 'printed' : 'manual' };
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
      registry: normalizeRegistry(input.registry)
    };
  }

  if (Array.isArray(input.blocks)) {
    const sections = [
      { id: newId('sec'), blocks: input.blocks, weight: 1 },
      emptySection(),
      emptySection()
    ] as LetterheadLayout['sections'];
    return { margins, columns: 1, sections, divider: true, registry: { show: false, mode: 'manual' } };
  }

  return { ...base, margins };
}

/** الأقسام الظاهرة فعلًا على الورقة. */
export function visibleSections(layout: LetterheadLayout): LetterheadSection[] {
  return layout.sections.slice(0, layout.columns);
}

/** هل في الترويسة ما يُطبع أصلًا؟ */
export function isLayoutEmpty(layout: LetterheadLayout): boolean {
  return !layout.registry.show && visibleSections(layout).every((s) => s.blocks.length === 0);
}

export type Letterhead = {
  id: number;
  name: string;
  authorityId: number | null;
  layout: LetterheadLayout;
  isDefault: boolean;
};

/**
 * الحقول التلقائية التي يجوز وضعها في الترويسة.
 * هذه أسماء يعرفها المحرّك ويملؤها عند الإصدار — وليست بيانات مبرمَجة.
 */
export const HEADER_FIELDS = [
  { token: '{رقم_الصادر}', label: 'رقم الصادر' },
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
