/**
 * ورقة الأسئلة — رأسٌ ثابتٌ ومتنٌ يُركَّب.
 *
 * ورقة الامتحان ليست كتابًا رسميًا، ولا تُبنى كما يُبنى: لا تُقيَّد في الصادر،
 * ولا رقم لها، ولا كليشة، ولا شبّاك يملؤها لزبون. ولذلك عُزلت عن مكتبة الكتب
 * بالحكم `print-only` لا بالتصنيف.
 *
 * ورأسها **لا يُؤلَّف**. هو نصٌّ ثابتٌ تتغيّر فيه أسماءٌ معدودة: المدرسة والمادة
 * والصف والزمن. فالمدرّس لا يريد أن يبني رأسًا كتلةً كتلة — يريد أن يكتب أسئلة.
 * لذلك تُخزَّن القيم في `meta.head`، وتُولَّد كتلُ الرأس منها في كل مرّة: المصدر
 * هو السجلّ، والكتلُ صورته. وبهذا تُفتح ورقةٌ حُفظت فتعود القيم إلى خاناتها.
 *
 * والمتنُ قائمةُ ترقيمٍ واحدة بثلاثة مستويات — سؤالٌ ففرعٌ ففرعُ فرع. فليست
 * «بفروع» و«بلا فروع» نوعين، بل عمقًا واحدًا يزيد وينقص.
 */
import {
  emptyDoc,
  fieldRef,
  newUuid,
  paragraph,
  reconcileFields,
  run,
  type Block,
  type ColumnsBlock,
  type Dir,
  type Doc,
  type DocField,
  type GroupBlock,
  type ListBlock,
  type ListItem,
  type ParagraphBlock,
  type SpacerBlock
} from './doc';

/** تصنيفُ ورقة الأسئلة في المكتبة — واحدٌ لكل المواد. */
export const EXAM_CATEGORY = 'أسئلة';

/** مستويات الترقيم: سؤالٌ (س1:) ففرعٌ (أ)) ففرعُ فرعٍ (1-). */
export const EXAM_STYLES: ListBlock['styles'] = ['question', 'arabicLetter', 'number'];

/** أعمقُ ما يُسمح به — وثلاثةٌ تكفي كل ورقةٍ رأيناها. */
export const MAX_DEPTH = 3;

export type HeadInput = {
  key: string;
  label: string;
  width: number;
  hint: string;
};

/**
 * متغيّرات الرأس — وهذه كلّها. وما عداها ثابتٌ يبقى ثابتًا.
 *
 * ترتيبها هو ترتيب خاناتها على الشاشة، فما يُكتب أولًا يُقرأ أولًا.
 */
export const HEAD_INPUTS: HeadInput[] = [
  { key: 'المحافظة', label: 'المديرية العامة لتربية', width: 16, hint: 'بغداد / الرصافة الأولى' },
  { key: 'القضاء', label: 'مديرية تربية', width: 16, hint: 'الأعظمية' },
  { key: 'المدرسة', label: 'المدرسة', width: 22, hint: 'ثانوية الرشيد للبنين' },
  { key: 'المادة', label: 'المادة', width: 14, hint: 'الرياضيات' },
  { key: 'الصف', label: 'الصف', width: 14, hint: 'الثالث المتوسط' },
  { key: 'الشعبة', label: 'الشعبة', width: 4, hint: 'أ' },
  { key: 'الزمن', label: 'الزمن', width: 10, hint: 'ساعتان' },
  { key: 'التاريخ', label: 'التاريخ', width: 12, hint: '2026/1/12' },
  { key: 'نوع الامتحان', label: 'نوع الامتحان', width: 14, hint: 'نصف السنة' },
  { key: 'العام الدراسي', label: 'العام الدراسي', width: 12, hint: '2025 - 2026' },
  { key: 'الدور', label: 'الدور', width: 8, hint: 'الأول' },
  { key: 'الملاحظة', label: 'ملاحظةٌ تحت الرأس', width: 44, hint: 'أجب عن خمسة أسئلة فقط' }
];

const BOLD = { bold: true } as const;

export function emptyHead(): Record<string, string> {
  return Object.fromEntries(HEAD_INPUTS.map((i) => [i.key, '']));
}

function spacer(height: number): SpacerBlock {
  return { id: newUuid(), kind: 'spacer', height };
}

/** سطرٌ لا يُطبع إن خلا متغيّره — فلا تبقى خانةٌ منقّطةٌ بلا معنى. */
function whenFilled(on: string, blocks: Block[]): GroupBlock {
  return { id: newUuid(), kind: 'group', mode: 'conditional', on, blocks };
}

function pair(label: string, key: string, patch: Partial<ParagraphBlock> = {}): ParagraphBlock {
  return paragraph([run(`${label}: `, BOLD), fieldRef(key)], patch);
}

/**
 * كتلُ الرأس الثابت.
 *
 * عمودان لا يتدفّقان: الجهةُ يمينًا والمادةُ يسارًا، كما تُطبع في كل مدرسة.
 * ثم عنوان الامتحان في الوسط. والثابت فيها — «المديرية العامة لتربية» و«المادة»
 * و«الصف» — نصٌّ لا يُحرَّر؛ ولا يتغيّر إلا ما بعد النقطتين.
 */
export function examHeadBlocks(): Block[] {
  const right: Block[] = [
    paragraph([run('المديرية العامة لتربية ', BOLD), fieldRef('المحافظة')]),
    paragraph([run('مديرية تربية ', BOLD), fieldRef('القضاء')]),
    pair('المدرسة', 'المدرسة')
  ];
  const left: Block[] = [
    pair('المادة', 'المادة', { align: 'left' }),
    pair('الصف', 'الصف', { align: 'left' }),
    whenFilled('الشعبة', [pair('الشعبة', 'الشعبة', { align: 'left' })]),
    pair('الزمن', 'الزمن', { align: 'left' }),
    pair('التاريخ', 'التاريخ', { align: 'left' })
  ];

  const banner: ColumnsBlock = {
    id: newUuid(),
    kind: 'columns',
    dir: 'rtl',
    columns: [right, left],
    gap: 24
  };

  return [
    banner,
    spacer(12),
    paragraph(
      [
        run('أسئلة امتحان ', { bold: true, size: 20 }),
        fieldRef('نوع الامتحان'),
        run(' للعام الدراسي ', { bold: true, size: 20 }),
        fieldRef('العام الدراسي')
      ],
      { align: 'center' }
    ),
    whenFilled('الدور', [paragraph([run('الدور ', BOLD), fieldRef('الدور')], { align: 'center' })]),
    spacer(8),
    whenFilled('الملاحظة', [paragraph([fieldRef('الملاحظة')], { align: 'center' })]),
    spacer(8)
  ];
}

/** وصفُ حقول الرأس — عرضُ الفراغ منه، فلا ينكمش سطرٌ فارغ فتتشوّه الورقة. */
export function headFieldMeta(key: string): Partial<DocField> {
  const input = HEAD_INPUTS.find((i) => i.key === key);
  return input ? { label: input.label, width: input.width, hint: input.hint } : {};
}

export function newQuestion(): ListItem {
  return { id: newUuid(), inlines: [] };
}

export function examList(items: ListItem[] = [newQuestion()], dir: Dir = 'rtl'): ListBlock {
  return { id: newUuid(), kind: 'list', dir, styles: [...EXAM_STYLES], items };
}

/**
 * ورقةٌ كاملة: رأسٌ مولَّدٌ من القيم، ومتنٌ هو قائمة الأسئلة.
 *
 * والحكم `print-only` — فلا تظهر في مكتبة الكتب ولا في الشبّاك، ولا تحرق رقم
 * صادرٍ حين تُطبع ثلاثين نسخة.
 */
export function examDoc(head: Record<string, string>, body: ListBlock): Doc {
  const doc = emptyDoc();
  doc.issuing = 'print-only';
  doc.pageSetup = { ...doc.pageSetup, letterheadMode: 'none' };
  doc.blocks = [...examHeadBlocks(), body];
  doc.meta = {
    title: paperTitle(head),
    subject: head['المادة']?.trim() || undefined,
    category: EXAM_CATEGORY,
    head: { ...head }
  };
  doc.fields = reconcileFields(doc, headFieldMeta);
  return doc;
}

/** عنوانُ الورقة في المكتبة: المادة فالصف فنوع الامتحان — بما وُجد منها. */
export function paperTitle(head: Record<string, string>): string {
  const parts = ['المادة', 'الصف', 'نوع الامتحان']
    .map((k) => head[k]?.trim())
    .filter((v): v is string => Boolean(v));
  return parts.length ? `أسئلة ${parts.join(' — ')}` : 'ورقة أسئلة';
}

/** قائمةُ الأسئلة في ورقةٍ محفوظة — آخرُ كتلةِ ترقيمٍ فيها. */
export function questionsOf(doc: Doc): ListBlock | null {
  for (let i = doc.blocks.length - 1; i >= 0; i--) {
    const b = doc.blocks[i];
    if (b?.kind === 'list') return b;
  }
  return null;
}

/** قيمُ الرأس كما حُفظت، مكمَّلةً بالخانات الفارغة فلا تختفي خانةٌ من الشاشة. */
export function headOf(doc: Doc): Record<string, string> {
  return { ...emptyHead(), ...(doc.meta.head ?? {}) };
}

/** أعمقُ مستوًى بلغته الأسئلة — لمنع فرعٍ رابع. */
export function depthOf(items: ListItem[], depth = 1): number {
  return items.reduce(
    (max, it) => Math.max(max, it.items?.length ? depthOf(it.items, depth + 1) : depth),
    depth
  );
}
