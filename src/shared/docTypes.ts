/**
 * أنواع الوثيقة: المعرّف والحقل والقطع والكتل والصفحة والوثيقة نفسها — نُقلت من `doc.ts` كما هي (A11، D77)،
 * ويعيد `doc.ts` تصديرها كلّها (`export type *`) فلا يتغيّر مستوردٌ.
 */
import type { Calendar } from './dates';
import type { Canvas } from './canvas';
import type { Addressing } from './api';

export type Uuid = string;

/**
 * الاقتراح بدرجته وسببه — لا قرارًا ثنائيًا.
 *
 * كل قاعدة كشف تعيد درجة، والقرار عتبةٌ عليها يسهل استبدالها بنموذج محلّي
 * لاحقًا. والسبب يُعرض للموظف فيقبل على بيّنة (§١٥ من الأساس).
 */
export type Confidence = number;

export type Suggestion<T> = { value: T; confidence: Confidence; reason: string };

export type Dir = 'rtl' | 'ltr';

export type Align = 'right' | 'center' | 'left' | 'justify';

// ── الحقول ───────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'longText'
  | 'date'
  | 'number'
  | 'money'
  | 'choice'
  | 'bool'
  | 'citizen'
  | 'authority';

/** `hand` يطبع فراغًا يملؤه صاحب العلاقة بقلمه — وكثير من الاستمارات كذلك. */
export type FillMode = 'printed' | 'hand';

/** ما يُقيَّد في الأرشيف ولا يجوز أن يبقى مجهولًا. */
export type FieldRole = 'name' | 'nationalId' | 'destination' | 'purpose' | null;

export type DocField = {
  id: Uuid;
  /** المفتاح المستعمل في المتن — فريد داخل الوثيقة. */
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  /**
   * عرض الفراغ بالحروف.
   *
   * الفراغ على الورق الرسمي له طولٌ مقصود، والحقل الفارغ يطبع فراغًا بطوله ولا
   * ينكمش فتتشوّه الورقة.
   */
  width: number;
  fillMode: FillMode;
  role: FieldRole;
  /** اسم حقل في ملف المواطن يملؤه بـF2 — أو عدم. */
  source: string | null;
  choices?: string[];
  hint?: string;
  /** لحقل التاريخ: بأيّ تقويمٍ يُكتب — والغائب ميلادي. */
  calendar?: Calendar;
  /** «المجموع» في استمارةٍ مصوّرة: يُجمع من هذه الحقول وحده ما لم يُكتب بيد (المرحلة ٤). */
  sumOf?: string[];
};

// ── ما داخل الفقرة ───────────────────────────────────────────────────

/**
 * تنسيق المقطع. والمائل والخطّ من المرحلة ١ لخطّة الترقية، والخطّ اسمُ عائلةٍ كما يعرفه Windows والغائب خطّ الورقة؛ والشطب
 * وأعلى السطر وأسفله (`script`) واللون (`#rrggbb`، والغائب أسود) من البند ٣ — ليساوي المحرّر Word (`docPmMarks.ts`).
 */
export type Marks = { bold?: boolean; italic?: boolean; underline?: boolean; size?: number; font?: string; strike?: boolean; script?: 'sup' | 'sub'; color?: string };

export type InlineRun = { kind: 'run'; text: string; marks?: Marks };

/** عقدة الحقل: تشير بمفتاحه، فلا تُكسر بالمسح ولا تُنسخ خطأً. */
export type InlineField = { kind: 'field'; id: Uuid; ref: string };

export type InlineBreak = { kind: 'break' };

export type Inline = InlineRun | InlineField | InlineBreak;

// ── الكتل: تسعة أنواع (`Block` أدناه)، وبهنّ تُعبَّر كل ورقة عراقية رسمية ──────────

type BlockBase = { id: Uuid; dir?: Dir };

export type ParagraphBlock = BlockBase & {
  kind: 'paragraph';
  align: Align;
  /** مسافة بادئة لأول سطر — والكتاب الرسمي يترك ٢ سم. */
  indent?: number;
  spaceAfter?: number;
  /**
   * حجم الفقرة الأساسي بالبكسل، وما في مقاطعها من `marks.size` يغلبه.
   *
   * وبه يأخذ السطر الفارغ ارتفاعه: فراغ التوقيع في Word خمسُ فقرات بحجم ٢٠،
   * ولو رُسمت بحجمٍ أصغر ارتفع التوقيع عن موضعه.
   */
  size?: number;
  /** تباعد الأسطر مضاعفًا لحجم الخطّ — كما يضبطه Word للفقرة. */
  lineHeight?: number;
  inlines: Inline[];
};

export type ListStyle =
  | 'bullet'
  | 'number'
  | 'question'
  | 'arabicLetter'
  | 'ordinal'
  | 'latinNumber'
  | 'latinLetter';

/**
 * عنصرُ ترقيم — وبه تُبنى ورقة الأسئلة كلّها.
 *
 * «بفروع» و«بلا فروع» و«الفرع فيه أسئلة» ليست ثلاثة أنواع — هي **عمق**.
 */
export type ListItem = {
  id: Uuid;
  inlines: Inline[];
  /** درجة العنصر. وإن لم تُذكر فمجموع فروعه. */
  score?: number;
  /** الإجابة النموذجية: تُخفى في ورقة الطالب وتظهر في ورقة المصحّح. */
  answer?: Inline[];
  /** فروعه. */
  items?: ListItem[];
  /** «أجب عن ن من فروعه فقط» — فيُحسب المجموع على المطلوب لا على الكل. */
  pick?: number;
};

export type ListBlock = BlockBase & {
  kind: 'list';
  /** نمط كل مستوى؛ والأعمق يأخذ آخر نمط. */
  styles: ListStyle[];
  /** «أجب عن ن أسئلة فقط» على المستوى الأول. */
  pick?: number;
  items: ListItem[];
};

export type TableCell = { id: Uuid; blocks: ParagraphBlock[]; colSpan?: number };

export type TableRow = { id: Uuid; cells: TableCell[] };

export type TableBlock = BlockBase & {
  kind: 'table';
  /** أوزان نسبية لا عرض ثابت — فالورقة تختلف. */
  columns: number[];
  /** صفّ عناوين يتكرّر في الصفحة التالية عند انقسام الجدول. */
  header: boolean;
  /**
   * جدولٌ بلا حدود: كثيرٌ من كتب Word ترتّب رأسها في جدولٍ مخفيّ الخطوط.
   * وغيابه يعني حدودًا — فالجداول القائمة كلّها ذات حدود.
   */
  borders?: boolean;
  rows: TableRow[];
};

export type ImageBlock = BlockBase & {
  kind: 'image';
  /** مسار داخل مخزن التطبيق. */
  src: string;
  width: number;
  /**
   * ارتفاعٌ صريح إن كان للصورة مقاسٌ لا تحدّده نسبتها — كالخطّ الأفقي في
   * كتب Word: صورةٌ صغيرة تُمطّ إلى عرض الصفحة بارتفاع نقطتين.
   */
  height?: number;
  align: Align;
};

export type SpacerBlock = BlockBase & {
  kind: 'spacer';
  height: number;
  /** سطورٌ منقّطة يكتب عليها الطالب — مساحة الإجابة. */
  lines?: boolean;
};

/**
 * عمودان لا يتدفّقان.
 *
 * التدفّق عبر الصفحات ممنوع في الأساس؛ وهذا **كتلة** يوزَّع محتواها على أعمدة
 * جنبًا إلى جنب — وبه الاختيار من متعدد وأسئلة الرياضيات.
 */
export type ColumnsBlock = BlockBase & {
  kind: 'columns';
  columns: Block[][];
  /** الفجوة بينها بالبكسل. */
  gap?: number;
  /**
   * أوزان الأعمدة النسبية — وبغيرها تتساوى.
   *
   * «ادارة ……… العدد:» في Word يقع العدد حيث أوصلته المسافات لا عند الهامش،
   * فيُحفظ موضعه وزنًا لعمودٍ لا عددَ مسافاتٍ يتغيّر بتغيّر الخطّ.
   */
  widths?: number[];
};

export type PageBreakBlock = BlockBase & { kind: 'pageBreak' };

/**
 * الخطّ الفاصل: خطٌّ أفقيّ بعرض المتن — تحت أسطر الترويسة التي تُكتب في أعلى الورقة،
 * كما يرسمه Word حدًّا سفليًّا للفقرة (`w:pBdr`).
 */
export type RuleBlock = BlockBase & { kind: 'rule' };

/**
 * المجموعة: شرطية أو متكررة.
 *
 * «المرفقات» تُلغى إن لم توجد — فهي شرطية لا سطر ثابت. و«نسخة منه إلى» صفوف
 * تتكاثر بعدد الجهات.
 */
export type GroupBlock = BlockBase & {
  kind: 'group';
  mode: 'conditional' | 'repeat';
  /** مفتاح الحقل الذي يقرّر الظهور، أو الذي تتكرّر عليه الصفوف. */
  on: string;
  blocks: Block[];
};

export type Block =
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | ImageBlock
  | SpacerBlock
  | PageBreakBlock
  | RuleBlock
  | ColumnsBlock
  | GroupBlock;

// ── الصفحة ───────────────────────────────────────────────────────────

/** `FS` الفولسكاب (F4): ٢١٠×٣٣٠ ملم — ورق الدوائر والمحاكم الطويل (حجة الإعالة، الاتفاقيات). مقاسه بقرار المالك ٤ تشرين الأول. و`custom` مقاسٌ مخصّص بالأبعاد المليمترية (ر102). */
export type PageSize = 'A4' | 'A5' | 'FS' | 'A3' | 'A6' | 'LT' | 'LG' | 'custom';

export type Orientation = 'portrait' | 'landscape';

/**
 * ما فوق المتن. `print` ترويسةٌ رسمية من المكتبة، و`lines` أسطرٌ تُكتب في أعلى الورقة
 * نفسها (كما يُصنع الرأس في Word) وتحتها خطٌّ فاصل إن شاء، و`none` لا شيء.
 * و`reserve` يترك مكان الترويسة فارغًا — لمن يطبع على ورق الدائرة المطبوع.
 */
export type LetterheadMode = 'print' | 'reserve' | 'lines' | 'none';

export type Numerals = 'arabic' | 'indic';

/**
 * العلامة المائية: نصٌّ مائل («مسودة»، «نسخة») أو شعارٌ باهت خلف المتن.
 *
 * هي من الورقة لا من المتن — فلا تُكتب في الكتل ولا تزاحم الحقول، وتُرسم خلف
 * النصّ في المعاينة والطباعة معًا.
 */
export type Watermark =
  | { kind: 'text'; text: string; opacity?: number }
  | { kind: 'image'; src: string; opacity?: number };

export type PageSetup = {
  size: PageSize;
  orientation: Orientation;
  margins: { top: number; right: number; bottom: number; left: number };
  letterheadMode: LetterheadMode;
  /** تتكرّر الترويسة في كل صفحة، أو في الأولى وحدها. */
  repeatLetterhead: boolean;
  pageNumbers: boolean;
  numerals: Numerals;
  watermark?: Watermark | null;
  /** أبعاد المقاس المخصّص بالمليمتر (العرض والارتفاع في الوضع الرأسي). */
  customSize?: { w: number; h: number };
};

// ── الوثيقة ──────────────────────────────────────────────────────────

/** متدفّقة (كتاب، استمارة، أسئلة) أو لوحة (شهادة، هوية، ملصق). */
export type DocKind = 'flow' | 'canvas';

/**
 * أتُقيَّد في الصادر أم تُطبع فقط؟
 *
 * وهذا المحور الذي يفرّق الأوراق — لا المادة ولا الغرض. فورقة الأسئلة والشهادة
 * والملصق تُطبع بعدد النسخ ولا تحرق رقم صادر.
 */
export type Issuing = 'registered' | 'print-only';

export type Doc = {
  id: Uuid;
  schemaVersion: number;
  kind: DocKind;
  issuing: Issuing;
  pageSetup: PageSetup;
  blocks: Block[];
  /**
   * اللوحة — حين يكون `kind === 'canvas'`.
   *
   * وهي في الوثيقة نفسها لا في صنفٍ ثانٍ، لأن `fields` مشتركة: الحقل في شهادةٍ
   * هو الحقل في كتاب، فالشبّاك والدمج يعملان عليها بلا أن يعرفا أنها لوحة.
   * وبنيتها في `shared/canvas.ts`.
   */
  canvas?: Canvas;
  /** ظهر اللوحة — للبطاقات والهويات ذات الوجهين (Two-Sided Cards & IDs). */
  backCanvas?: Canvas;
  /** ترتيبها هو ترتيب شاشة الإدخال في الشبّاك. */
  fields: DocField[];
  meta: {
    title?: string;
    subject?: string;
    category?: string;
    /**
     * قيم رأسٍ ثابتٍ لا يُؤلَّف — رأس ورقة الأسئلة وحده اليوم.
     *
     * كتلُ الرأس مشتقّةٌ من هذه القيم لا محرَّرةٌ يدويًا، فالمصدر هو السجلّ
     * والكتل صورته. وبه يُفتح ما حُفظ فتعود الحقول إلى خاناتها.
     */
    head?: Record<string, string>;
    /** استمارةٌ مصوّرة (المرحلة ٤): صورة الدائرة خلفيّتها، فالفارغ لا يُرسم عليها فراغًا ثانيًا. */
    form?: boolean;
    /** ورقة الإجابة بالدوائر ومفتاحها — لورقة الأسئلة (`shared/omr.ts`). */
    omr?: { questions: number; choices: number; idDigits: number; key: number[] };
    /** لمن يُكتب الكتاب: جهةٌ أعلى أو أدنى أو مساوية — فتتصدّر كليشاتُ اتجاهه (FOUNDATION §٦). */
    addressing?: Addressing;
    /** ربط أعمدة الدفعة بالحقول يدويًّا — يتذكّره التصميم لقائمة السنة القادمة (هـ٥). */
    batchMap?: Record<string, string | null>;
  };
};
