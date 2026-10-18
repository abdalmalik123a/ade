/**
 * عقد الجسر — باب النماذج (المحادثة ٦، البند ٢٨): النماذج واستيراد المجلّد والترويسات والكليشات والنسخ
 * والأختام والمسودّات وبنك الأسئلة — أنواعها وقنواتها. ويُستورد كلّه من `@shared/api` كما كان.
 */
import type { Letterhead, LetterheadLayout } from './letterhead';
import type { Doc, ListItem, Suggestion } from './doc';
import type { OcrLine } from './paperDoc';
import type { WordCensus, WordScan } from './wordLosses';
import type { TemplateInput, TemplateVariable } from './template';

export type TemplateSummary = {
  id: number;
  code: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  subjectLine: string | null;
  bodyHtml: string;
  letterheadId: number | null;
  printCount: number;
  issuedThisMonth: number;
  variables: string[];
  /** رقم النسخة: يزيد مع كل حفظٍ غيّر شيئًا (FOUNDATION §٣). */
  revision?: number;
};

export type TemplateDetail = Omit<TemplateSummary, 'variables'> & {
  variables: TemplateVariable[];
  /**
   * الوثيقة كتلًا كما حُفظت، خامًا.
   *
   * تُقرأ بـ`templateDoc` لا مباشرةً — فما حُفظ قبل النواة لا يحمله، ويُرحَّل
   * من `bodyHtml` عند القراءة.
   */
  docJson?: string | null;
};

// ── «استورد مجلدي»: الخطّة تُعرض قبل أن تصير ─────────────────────────

/** استمارةٌ مرشَّحة من ملف — أو من استمارة داخل ملفٍ هو مكتبة. */
export type ImportCandidate = {
  id: string;
  file: string;
  formIndex: number;
  formCount: number;
  title: string;
  subjectLine: string | null;
  doc: Doc;
  /** بصمة نصّ الترويسة — بها تُعرف الترويسة المتكرّرة بين الملفات. */
  letterheadKey: string | null;
  letterhead: LetterheadLayout | null;
  notes: string[];
  warnings: string[];
  suggestions: Suggestion<string>[];
  /** ما في ملفّ Word ولا يُنقل إلى الورقة (الموجة ٢) — `shared/wordLosses.ts`. */
  scan?: WordScan;
  /**
   * كم كتلةً من أعلى الورقة رأسُها (`findSheetHead`) — يُفصل ترويسةً حين تُربط البطاقة بالترويسة المشتركة
   * وحده، وإلا بقيت الورقة برأسها كما كانت في Word.
   */
  headCount?: number;
};

export type ImportPlan = {
  /** من مجلّد ملفّات Word (الأصل)، أو من أوراق ملفّ Excel — فتُقال المراجعة بلغته. */
  source?: 'folder' | 'excel';
  candidates: ImportCandidate[];
  sharedLetterhead: { key: string; layout: LetterheadLayout; count: number } | null;
  duplicates: { ids: string[]; confidence: number }[];
  failed: { file: string; error: string }[];
  /** إحصاء المجلّد: ما لا يُنقل بعدد ملفّاته، والخطوط والجداول والصور — بلا أسماءٍ ولا نصوص. */
  census?: WordCensus;
  /** ما في المجلّد ولم يُقرأ (هـ١) بأعداده وأسبابه — يُقال في المراجعة وفي النتيجة (`shared/importSkipped.ts`). */
  skipped?: ImportSkipped;
};

/**
 * ما في المجلّد ولم يُقرأ (هـ١) — فمكتبٌ أرشيفه `.doc` أو مجلّداتٌ فرعية لا يظنّ أنّه نقله كلّه وقد دخل بعضه.
 */
export type ImportSkipped = {
  /** ملفّات Word بصيغةٍ غير `.docx` (`.doc` و`.rtf` وأخواتهما): تُحفظ `.docx` من Word ثم تُستورد. */
  doc: number;
  /** ملفّات Excel: لا تُقرأ من المجلّد — «كتب من ملف Excel» ملفًّا ملفًّا. */
  xls: number;
  /** ما ليس Word ولا Excel (PDF وصور ونصوص) — يبقى كما هو. */
  unsupported: number;
  /** ملفّات `.docx` بعد السقف (`limit`) — لم تُقرأ. */
  overCap: number;
  /** مجلّداتٌ فرعية لم تُفتح: أعمق من الحدّ أو ممنوعٌ فتحها. */
  folders: number;
  limit: number;
};

export type ImportChoices = {
  /** ما قبِله الموظف — وما لم يُذكر لا يُحفظ. */
  accept: string[];
  useSharedLetterhead: boolean;
  sharedName?: string;
  category?: string | null;
  /**
   * ما صحّحه الموظف من أسماء الحقول: ما اقترحه البرنامج وما اختاره هو.
   *
   * وتُحسب في الشاشة لأنها وحدها تملك الاثنين — ثم تُقيَّد، فيتعلّم الكاشف من
   * هذا المكتب. **ولا تُجمع بأثر رجعي.**
   */
  corrections?: { input: string; suggested: string | null; chosen: string }[];
};

export type ImportOutcome = {
  templates: number;
  letterheadId: number | null;
  skipped: number;
};

/** كليشة: عبارةٌ يعيد المكتب استعمالها. */
export type Clip = {
  id: number;
  title: string;
  body: string;
  category: string | null;
  usedAt: string | null;
  /** لمن تُكتب: جهةٌ أعلى أو أدنى أو مساوية — أو لأيٍّ منها (FOUNDATION §٦). */
  direction: Addressing | null;
  revision?: number;
};

/**
 * اتجاه المخاطبة (FOUNDATION §٤): `up` من الأدنى إلى الأعلى («يرجى / الرجاء»)،
 * و`down` من الأعلى إلى الأدنى («تنسب / تزويدنا»)، و`peer` بين المتساويين («إشارة إلى»).
 */
export type Addressing = 'up' | 'down' | 'peer';

// ── النسخ: العودة إلى «نسخة أمس» ─────────────────────────────────────

export type RevisionKind = 'template' | 'letterhead' | 'clip';

/** نسخةٌ سابقة لقطعة — رقمها ووقت حلول ما بعدها محلّها. */
export type Revision = { revision: number; createdAt: string };

/** ما يُبقى من النسخ السابقة لكلّ قطعة — والأقدم يُحذف في معاملة الحفظ نفسها (A10). */
export const REVISIONS_KEEP = 20;

/** ما يُحفظ من كل قطعةٍ في نسخها — ما يُحرَّر، لا ترتيب القائمة ولا عدّاداتها. */
export type RevisionPayloads = {
  template: {
    code: string | null;
    title: string;
    subtitle: string | null;
    category: string | null;
    subjectLine: string | null;
    bodyHtml: string;
    docJson: string | null;
    letterheadId: number | null;
    variables: TemplateVariable[];
  };
  letterhead: { name: string; category: string | null; authorityId: number | null; layout: LetterheadLayout };
  clip: { title: string; body: string; category: string | null; direction: Addressing | null };
};

export type DraftRow = {
  id: number;
  title: string;
  templateId: number | null;
  templateTitle: string | null;
  citizenId: number | null;
  citizenName: string | null;
  valuesJson: string;
  bodyHtml: string | null;
  updatedAt: string;
};

/** ملفٌّ وصل المكتب (المرحلة ٢، ن٨) — بمعرّفه لا بمساره: الواجهة لا ترى المسارات. */
export type InboxFile = {
  id: string;
  name: string;
  kind: 'pdf' | 'image' | 'word';
  source: 'downloads' | 'desktop' | 'documents' | 'whatsapp' | 'flash';
  /** ISO. */
  modified: string;
  size: number;
};

export type ImportedTemplate = {
  title: string;
  subtitle: string | null;
  category: string | null;
  code: string | null;
  subjectLine: string | null;
  body: string;
  warnings: string[];
  /** ترويسة استُخرجت من الملف — يقرّر المكتب حفظها أو تركها. */
  letterhead: LetterheadLayout | null;
  /**
   * الملف ورقةً واحدة بتنسيقه كما رسمه Word — رأسه ومتنه وجداوله وهوامشه.
   *
   * وحين يوجد يُفتح المصمّم عليه قطعةً واحدة، ولا تُعرض الترويسة المستخرجة:
   * المكاتب لا تفصل رأس الكتاب عن متنه. (`.xml` لا يحمله.)
   */
  doc?: Doc | null;
  /** ما في ملفّ Word ولا يُنقل إلى الورقة — يُعرض بجانبها (الموجة ٢). */
  scan?: WordScan;
  /** الترويسة من رأس صفحة Word لا من المتن — فالورقة المنسّقة لا تحملها. */
  letterheadFromHeader?: boolean;
  /** ملاحظات قارئ الورقة المنسّقة وحده (لا تنظيف النصّ). */
  docNotes?: string[];
};

export type TemplateStats = {
  activeTemplates: number;
  drafts: number;
  issuedThisMonth: number;
};

export type Seal = {
  id: number;
  name: string;
  kind: string | null;
  imagePath: string | null;
  authorityId: number | null;
};

/** سؤالٌ في البنك — عقدةُ القائمة نفسها، ومادّتها وصفّها. */
export type BankQuestion = {
  id: number;
  subject: string | null;
  grade: string | null;
  item: ListItem;
  text: string;
  score: number | null;
  useCount: number;
  createdAt: string;
};

/** قنوات باب النماذج في `window.diwan`. */
export type TemplateApis = {
  letterheads: {
    list(opts?: {
      query?: string;
      category?: string | null;
      favoritesOnly?: boolean;
    }): Promise<Letterhead[]>;
    categories(): Promise<string[]>;
    save(input: {
      id: number | null;
      name: string;
      authorityId: number | null;
      layout: LetterheadLayout;
      category?: string | null;
    }): Promise<Letterhead>;
    duplicate(id: number, name?: string): Promise<Letterhead | null>;
    favorite(id: number, on: boolean): Promise<void>;
    setDefault(id: number): Promise<void>;
    delete(id: number): Promise<void>;
  };
  /** الكليشات — عبارات المكتب تُدرج من قائمة `/`. */
  clips: {
    list(query?: string): Promise<Clip[]>;
    save(input: {
      id: number | null;
      title: string;
      body: string;
      category?: string | null;
      /** غائبٌ = يُخمَّن من أفعال العبارة («يرجى»، «تنسب»، «إشارة إلى»). */
      direction?: Addressing | null;
    }): Promise<Clip>;
    delete(id: number): Promise<void>;
    touch(id: number): Promise<void>;
    /** فقراتٌ تتكرّر حرفيًّا في الكتب الصادرة (ثلاثًا فأكثر) — يُقترح حفظها كليشة (د١٢). */
    repeated(paragraphs: string[]): Promise<{ text: string; count: number }[]>;
  };
  /** النسخ السابقة للنماذج والترويسات والكليشات — للعودة إلى «نسخة أمس». */
  revisions: {
    list(kind: RevisionKind, id: number): Promise<Revision[]>;
    get<K extends RevisionKind>(kind: K, id: number, revision: number): Promise<RevisionPayloads[K] | null>;
  };
  seals: {
    list(): Promise<Seal[]>;
    add(input: { name: string; kind: string; imagePath: string | null }): Promise<Seal>;
    delete(id: number): Promise<void>;
  };
  templates: {
    /** `issuing` يفصل مكتبة الكتب عن أوراق الأسئلة — والأصل الكتب. */
    list(
      category?: string | null,
      issuing?: 'registered' | 'print-only'
    ): Promise<TemplateSummary[]>;
    get(id: number): Promise<TemplateDetail | null>;
    /** التصنيفات بحكم القائمة نفسه — الكتب افتراضًا، كما يُسرد `list`. */
    categories(issuing?: 'registered' | 'print-only'): Promise<{ name: string; count: number }[]>;
    stats(): Promise<TemplateStats>;
    save(input: TemplateInput & { doc?: Doc | null }): Promise<TemplateDetail>;
    /** نسخة مستقلّة من نموذج — الأصل لا يُمسّ، والكود يُترك فارغًا. */
    duplicate(id: number): Promise<TemplateDetail | null>;
    usage(id: number): Promise<number>;
    delete(id: number): Promise<void>;
    doc(id: number): Promise<Doc>;
    importFile(): Promise<ImportedTemplate | null>;
    /** صورة ورقةٍ تُقرأ لتصير كتابًا (هـ٨) — لا تُحفظ في المخزن. */
    pickPaper(): Promise<{ name: string; dataUrl: string; dpi: number | null } | null>;
    /** القارئ المحلي على الورقة بعد تنظيفها: الأسطر بكلماتها ومواضعها. */
    readPaper(png: Uint8Array, dpi: number | null): Promise<OcrLine[]>;
    /** يقرأ مجلدًا ويبني خطّة — ولا يمسّ القاعدة. */
    planFolder(): Promise<ImportPlan | null>;
    /** «كتب من ملف Excel»: كلّ ورقةٍ بطاقة في المراجعة نفسها — ولا يُحفظ شيء قبل القبول. */
    planExcel(): Promise<ImportPlan | null>;
    /**
     * إحصاء آخر مجلّدٍ قُرئ نصًّا في ملفّ يُرسل — أعدادٌ وأسماء خطوطٍ وحدها. يعود بمساره، أو `null` إن أُلغي
     * أو لم يُقرأ مجلّد. (الإحصاء من العملية الرئيسة نفسها، لا ممّا ترسله الواجهة.)
     */
    saveCensus(): Promise<string | null>;
    /** ينفّذ ما قبِله الموظف من الخطّة. */
    applyImport(plan: ImportPlan, choices: ImportChoices): Promise<ImportOutcome>;
    export(id: number): Promise<string | null>;
  };
  /** ما تعلّمه البرنامج من هذا المكتب — عدٌّ لا نموذج، ويُعرض لا يُخفى. */
  learning: {
    stats(): Promise<{
      total: number;
      byKind: { kind: string; count: number }[];
      habits: number;
    }>;
    /** ما اعتاده المكتب لمدخلٍ بعينه — بثقته وسببه، أو عدم. */
    suggest(kind: 'letterheadEdge' | 'category' | 'duplicate' | 'clip', input: string): Promise<Suggestion<string> | null>;
    /** يقيّد تصحيحًا — ولا يقيّد موافقة (ما اختير = ما اقتُرح). */
    record(c: {
      kind: 'letterheadEdge' | 'category' | 'duplicate' | 'clip';
      input: string;
      suggested: string | null;
      chosen: string;
    }): Promise<boolean>;
    /** تصنيف النموذج من عنوانه: من نماذج المكتب المصنَّفة، وما صحّحه. */
    category(title: string): Promise<Suggestion<string> | null>;
    /** ربط أعمدة الدفعة يدويًّا يُحفظ في التصميم (هـ٥). */
    setBatchMap(templateId: number, map: Record<string, string | null>): Promise<void>;
  };
  drafts: {
    list(): Promise<DraftRow[]>;
    /** كتابٌ (`values.__doc`) أو تصميمٌ لم يُحفظ (`values.__design`، DESIGNS.md ٠٫٦) — والجدول واحد. */
    save(input: { id: number | null; templateId: number | null; citizenId: number | null; title: string; values: Record<string, string>; bodyHtml: string }): Promise<number>;
    delete(id: number): Promise<void>;
  };
  /** بنك الأسئلة: سؤالٌ يُحفظ مرّةً ويُدرج في كل ورقةٍ بعدها. */
  bank: {
    save(input: { item: ListItem; subject?: string | null; grade?: string | null }): Promise<BankQuestion>;
    list(filter?: { query?: string; subject?: string | null; grade?: string | null }): Promise<BankQuestion[]>;
    used(id: number): Promise<void>;
    delete(id: number): Promise<void>;
  };
};
