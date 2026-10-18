/**
 * عقد الجسر — باب الصادر (المحادثة ٦، البند ٢٨): الكتاب وإصداره ومعاملته، وسجلّ التدقيق وسلامة الأرشيف
 * ومؤشّراته — أنواعها وقنواتها. ويُستورد كلّه من `@shared/api` كما كان.
 */
import type { PrintJobResult } from './apiTools';

/** صفّ في سجل الصادر — الأعمدة الثمانية التي يعرضها التصميم. */
export type DocumentRow = {
  id: number;
  serial: string;
  citizenName: string;
  nationalId: string | null;
  docType: string | null;
  destination: string | null;
  issuedTime: string;
  issuedDate: string;
  copies: number;
  /** `issued` أو `void` — والمُبطَل يبقى في الأرشيف برقمه وسببه. */
  status: string;
  voidReason: string | null;
};

/** الكتاب كاملًا — لإعادة الطباعة والتدقيق وفتحه في المحرر من جديد. */
export type DocumentDetail = {
  id: number;
  serial: string;
  templateId: number | null;
  citizenId: number | null;
  citizenName: string;
  nationalId: string | null;
  docType: string | null;
  destination: string | null;
  purpose: string | null;
  valuesJson: string;
  bodyHtml: string;
  copies: number;
  copyKind: string | null;
  gregorianDate: string;
  hijriDate: string | null;
  issuedAt: string;
  operator: string | null;
  sha256: string;
  status: string;
  /** مجموع ما طُبع فعلًا: الإصدار الأول وكل إعادة طباعة. */
  printedCopies: number;
  voidReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
};

/** قيدٌ من سجلّ التدقيق: من فعل ماذا ومتى. */
export type AuditEntry = {
  id: number;
  entity: string;
  entityId: number | null;
  action: string;
  detail: string | null;
  operator: string | null;
  at: string;
  /** رقم الصادر إن كان القيد لكتاب — ليُعرف بلا فتحه. */
  serial: string | null;
};

/**
 * «تحقّق من سلامة الأرشيف»: كل كتابٍ تُعاد بصمته من متنه، وتُعاد السلسلة من أوّلها.
 * فالمتن المعدَّل بعد صدوره يُكشف، والكتاب المحذوف أو المُقحَم يكسر السلسلة.
 */
export type ArchiveCheck = {
  checked: number;
  problems: { id: number | null; serial: string; kind: 'content' | 'chain' | 'gap'; text: string }[];
  /** بصمة آخر السلسلة — من يحتفظ بها يثبت بها أرشيفه كلّه. */
  head: string | null;
};

/**
 * ما ترسله الواجهة لإصدار كتاب. علامات الورقة تُرسل بمواضع محجوزة
 * (رقم الصادر، الرمز، البصمة) تملؤها العملية الرئيسية داخل المعاملة نفسها.
 */
export type IssueInput = {
  sheetHtml: string;
  templateId: number | null;
  citizenId: number | null;
  authorityId: number | null;
  citizenName: string;
  nationalId: string | null;
  docType: string | null;
  destination: string | null;
  purpose: string | null;
  values: Record<string, string>;
  copies: number;
  copyKind: string | null;
  gregorianDate: string;
  hijriDate: string | null;
  operator: string | null;
  printer: string | null;
  /** نافذة ويندوز قبل الطبع — اختارها الموظف ليضبط الورق والجودة («بإعدادات ويندوز»). */
  printDialog?: boolean;
  serialPrefix: string;
  serialYear: number;
  /** الترويسة التي جاء منها — واللقطة محفوظة مع الكتاب، وهذا للسؤال والترتيب. */
  letterheadId: number | null;
  /** معاملة الزبون: خمس أوراق قيدٌ واحد. تُملأ داخل `issueTransaction`. */
  transactionId?: number | null;
  /** أنماط الورقة التي رُسم بها الكتاب — تملؤها العملية الرئيسة لا الواجهة (`render.ts`). */
  style?: SheetStyle | null;
};

/**
 * أنماط الورقة كما تُرسم يوم الإصدار: ملفّ أنماط التطبيق، وصنف `<body>` الذي يرث منه خطّها.
 * تُحفظ مع كلّ كتابٍ يصدر — مرّةً لكلّ بصمة — فيُعاد طبعه كما صدر (خطة Production، ١٫٣).
 */
export type SheetStyle = { css: string; bodyClass: string | null };

/** ورقةٌ في معاملة — ما يخصّها وحدها، وما يشترك فيه الجميع في المعاملة. */
export type TransactionSheet = Pick<
  IssueInput,
  | 'sheetHtml'
  | 'templateId'
  | 'letterheadId'
  | 'authorityId'
  | 'docType'
  | 'destination'
  | 'purpose'
  | 'values'
  | 'copies'
  | 'copyKind'
>;

export type TransactionInput = {
  citizenId: number | null;
  citizenName: string;
  nationalId: string | null;
  operator: string | null;
  printer: string | null;
  serialPrefix: string;
  serialYear: number;
  gregorianDate: string;
  hijriDate: string | null;
  sheets: TransactionSheet[];
  /** أنماط أوراقها — تملؤها العملية الرئيسة (`IssueInput.style`). */
  style?: SheetStyle | null;
};

export type TransactionResult = {
  transactionId: number;
  /** ملف المواطن الذي رُبطت به — المختار، أو ما دلّ عليه رقمه الوطني، أو لا شيء. */
  citizenId: number | null;
  documents: { id: number; serial: string; sha256: string; sheetHtml: string }[];
};

export type IssueOutcome = {
  id: number;
  serial: string;
  sha256: string;
  /** حال الطباعة: نجحت، أو أُلغيت من حوار النظام، أو لم تُطلب. */
  printed: 'ok' | 'failed' | 'skipped';
  printError?: string;
  /** مسار نسخة PDF المؤرشفة داخل مخزن التطبيق. */
  archivedPath: string | null;
  /** سبب تعذّر الأرشفة، إن تعذّرت — الكتاب مقيَّد على كل حال. */
  archiveError?: string;
};

/** مؤشرات مدة زمنية — سطر أرقام المدّة في الأرشيف، وتقرير Excel. */
export type PeriodStats = {
  issued: number;
  citizens: number;
  printedCopies: number;
  byType: { name: string; count: number }[];
  byDay: { day: string; count: number }[];
};

/** مؤشرات اليوم في أعلى شاشة الأرشيف. */
export type ArchiveStats = {
  issuedToday: number;
  issuedYesterday: number;
  topTemplate: { title: string; count: number; share: number } | null;
};

/** قنوات باب الصادر في `window.diwan`. */
export type ArchiveApis = {
  archive: {
    stats(): Promise<ArchiveStats>;
  };
  documents: {
    /** الإصدار: رقم وبصمة ورمز تحقق وقيد في السجل، ثم طباعة وأرشفة PDF. */
    issue(input: IssueInput, print: boolean): Promise<IssueOutcome>;
    /** معاملة الزبون الواحد: خمس أوراق قيدٌ واحد، ولكلٍّ رقمها وبصمتها. والطباعة بعدها (`printIssued`). */
    issueTransaction(input: TransactionInput): Promise<TransactionResult>;
    /** الدمج: معاملةٌ لكل اسم في القائمة، والدفعة كلّها أو لا شيء. */
    issueBatch(inputs: TransactionInput[]): Promise<TransactionResult[]>;
    /**
     * أوراقٌ صدرت تُطبع على الطابعة المختارة ورقةً ورقة بسجلٍّ يُستأنف (خطة Production، ٢٫٣)، وبأنماطها
     * يوم صدرت. و`mode: 'values'` يطبع القيم وحدها في مواضعها — على استمارةٍ مطبوعةٍ مسبقًا.
     */
    /** و`copies` النسخ (د٣، ١–٩٩): مجموعاتٌ مرتّبة في المهمّة المسجّلة نفسها. */
    printIssued(req: { ids: number[]; printer: string | null; mode?: 'full' | 'values'; label?: string; copies?: number }): Promise<PrintJobResult>;
    /** يربط كتب معاملةٍ بملف مواطنٍ حُفظ بعدها — المتن والبصمة لا يُمسّان. */
    linkCitizen(transactionId: number, citizenId: number): Promise<number>;
    /** «كرّره»: أمِن المحرّر صدر فيعود إليه، أم من الشبّاك فيعود بنماذجه وقيمه؟ */
    repeatSource(
      id: number
    ): Promise<{ kind: 'editor' } | { kind: 'counter'; serial: string; templateIds: number[]; values: Record<string, string> } | null>;
    get(id: number): Promise<DocumentDetail | null>;
    list(opts?: {
      from?: string | null;
      to?: string | null;
      query?: string;
      limit?: number;
    }): Promise<DocumentRow[]>;
    stats(opts?: { from?: string | null; to?: string | null }): Promise<PeriodStats>;
    /** إعادة طباعة طبق الأصل — تُقيَّد ولا تستهلك رقمًا جديدًا، وبأنماط الكتاب يوم صدر. */
    reprint(ids: number[], copies: number, printer: string | null): Promise<{ printed: number; failed: number; voided: number }>;
    /** تصدير الكتاب PDF إلى مكان يختاره المكتب. */
    exportPdf(id: number): Promise<string | null>;
    /** تقرير المدة جدولًا في Excel — العنوان يظهر في ورقة المؤشرات. */
    exportReport(opts: {
      from?: string | null;
      to?: string | null;
      query?: string;
      title?: string;
    }): Promise<{ path: string; count: number } | null>;
    /** إبطال كتابٍ صادر بسببه: يبقى برقمه وبصمته، ولا يُعاد طبعه. */
    void(id: number, reason: string, operator: string | null): Promise<DocumentDetail | null>;
    /** سلسلة البصمات وبصمة كل كتاب من متنه — من أوّل الأرشيف إلى آخره. */
    verify(): Promise<ArchiveCheck>;
  };
  /** سجلّ التدقيق: من أصدر ومن أعاد الطباعة ومن أبطل، ومتى. */
  audit: {
    list(opts?: { entity?: string | null; documentId?: number | null; query?: string; limit?: number }): Promise<AuditEntry[]>;
  };
};
