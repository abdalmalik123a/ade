import type { Client, ClientInput, Order, OrderCounts, OrderInput, OrderStatus } from './orders';
import type { Letterhead, LetterheadLayout } from './letterhead';
import type { Doc, ListItem, Suggestion } from './doc';
import type { OcrLine } from './paperDoc';
import type { MrzResult } from './mrz';
import type { FormFieldInfo, PdfPlan, Rotation } from './pdfEdit';
import type { PhotoPreset } from './photoPresets';
import type { CustomSuit } from './suits';
import type { PrintRoles } from './printRoles';
import type { RouteKey } from './routes';

/** ملفٌّ فُتح في محرّر PDF: صفحاته بمقاسها ودورانها، وبايتاته لترسمها الواجهة. */
export type PdfOpened = {
  id: string;
  name: string;
  kind: 'pdf' | 'image';
  bytes: Uint8Array;
  /** وأصل صندوق القصّ (`x`، `y`) — به تُحسب مواضع حقول الاستمارة. */
  pages: { width: number; height: number; rotation: Rotation; x?: number; y?: number }[];
  /** مقاس الصورة بالبكسل، ودقّتها إن جاءت من الماسح (فصفحتها بمقاسها الحقيقي). */
  image?: { width: number; height: number; dpi?: number };
  /** حقول الاستمارة إن كان الملف قابلًا للتعبئة — تصير طبقات نصٍّ في مواضعها. */
  fields?: FormFieldInfo[];
};
import type { TemplateInput, TemplateVariable } from './template';

/** عقد الاتصال بين الواجهة والعملية الرئيسية. مصدر الحقيقة الوحيد للأنواع. */

export type OfficeSettings = {
  officeName: string;
  operatorName: string;
  /** الطابعة الافتراضية القديمة — يأخذها كلّ دورٍ لم يُحفظ بعد (`printRoles`). */
  defaultPrinter: string | null;
  /** طابعة كلّ نوع عمل: عادي وملوّن اختياري، ونافذة الطباعة (`shared/printRoles.ts`). */
  printRoles: PrintRoles;
  serialPrefix: string;
  serialYear: number;
  /**
   * تكبير الواجهة كلّها (١ عادي، ١٫١٥ كبير، ١٫٣ أكبر) — صاحب المكتب يعمل ساعاتٍ
   * أمام الشاشة، وكثيرٌ من النصوص ١١–١٢ بكسل. ولا يمسّ ما يُطبع.
   */
  uiScale: number;
  /** أُنهي معالج البداية أو تُخطّي — فلا يظهر ثانيةً. */
  onboarded: boolean;
  /**
   * إزاحة كل طابعة بالملّم — تُقاس من ورقة المعايرة مرّة. `x` موجبٌ يمينًا و`y`
   * موجبٌ نزولًا. وتُطبَّق على الطباعة الورقية وحدها، لا على PDF.
   */
  printOffsets: Record<string, { x: number; y: number }>;
  /**
   * البسملة تفضيلٌ للمكتب (FOUNDATION §٥): كل ترويسةٍ جديدة تبدأ بها أو بدونها.
   * و`null` ما لم يختر المكتب بعد: فأوّل مرّة يشعلها في ترويسةٍ تصير تفضيله، ثم
   * يُشعلها ويُطفئها من الإعدادات.
   */
  basmala: boolean | null;
  /** آخر نسخةٍ احتياطية (ISO) — «آخر نسخة منذ…» ويُذكَّر بها إن طالت. */
  lastBackupAt: string | null;
  /** الشريط الجانبي مثبّت؛ و`false` مخفيٌّ يظهر بتقريب الفأرة من حافّة النافذة (خطة Production، ٣٫٢). */
  sidebarPinned: boolean;
  /** أقسامٌ أخفاها المكتب من الشريط ولوحة الأوامر — والشبّاك والأرشيف والإعدادات لا تُخفى (`shared/sections.ts`). */
  hiddenSections: RouteKey[];
};

export type SidebarCounts = {
  templates: number;
  issuedToday: number;
  /** الطلبات المفتوحة، وما موعده اليوم، والمتأخّر — لشارة الشريط. */
  orders: OrderCounts;
};

/** Electron 44 لم يعد يعطي isDefault/status مباشرة — يُستخرجان من options الخاصة بالنظام. */
export type PrinterInfo = {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  ready: boolean;
};

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
  fee: number;
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
  fee: number;
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

/** حقلٌ مقترح لعنصرٍ نصّي من اسم طبقته في Photoshop (هـ٤). */
export type FieldSuggestion = {
  elementId: string;
  layer: string;
  /** النصّ النموذجيّ في الطبقة — يبقى قيمةً للمعاينة. */
  sample: string;
  key: string;
  confidence: number;
  reason: string;
};

/** طلبٌ في «ما ينتظرك اليوم» — ما يُعرض ويُنسخ في رسالته. */
export type AgendaOrder = { id: number; customer: string; title: string; dueDate: string | null; phone: string | null };

/** «ما ينتظرك اليوم» عند الإقلاع (د٧). */
export type TodayAgenda = {
  overdue: AgendaOrder[];
  dueToday: AgendaOrder[];
  /** جاهزةٌ تنتظر أصحابها — ومعها «انسخ رسالة: طلبكم جاهز» (د٨). */
  ready: AgendaOrder[];
  drafts: number;
  /** طباعةٌ انقطعت: ما أُرسل من أوراقها ومجموعها. */
  pendingPrints: { id: string; label: string; sent: number; total: number }[];
  lastBackupAt: string | null;
  /** مضى أسبوعٌ بلا نسخة (أو لم تُؤخذ قطّ) وفي الأرشيف كتب. */
  backupDue: boolean;
  /** النسخة التلقائية الأخيرة لم تُؤخذ — ولماذا (فلاشةٌ غير موصولة…). */
  autoBackupError?: string | null;
};

export type AutoBackupStatus = {
  dir: string | null;
  keep: number;
  encrypted: boolean;
  /** التشفير يحفظ الكلمة مشفّرةً بحساب ويندوز — فإن لم يتح لم يُعرض. */
  canEncrypt: boolean;
  lastAt: string | null;
  lastError: string | null;
};

/** ما في النسخة الاحتياطية — يُعرض قبل أن يوافق المكتب على استرجاعها. */
export type BackupSummary = {
  /** `integrity_check` قال «ok». */
  ok: boolean;
  integrity: string;
  documents: number;
  citizens: number;
  templates: number;
  /** ملفّات المخزن: المستمسكات والصور والشعارات ونسخ PDF. */
  files: number;
  /** آخر كتابٍ صدر فيها — إلى أين تصل. */
  lastIssuedAt: string | null;
  /** الإصدار الذي أخذها ووقتها — و`null` لنسخةٍ أُخذت قبل أن يُكتبا فيها (خطة Production، ٤٫٢). */
  appVersion: string | null;
  createdAt: string | null;
  /** من إصدارٍ أحدث من هذا البرنامج: لا تُسترجع حتى يُحدَّث. */
  fromNewer: boolean;
};

/**
 * حال التفعيل على هذا الجهاز (خطة Production، ٦٫٢): مفعَّل مدى الحياة، أو في المدّة التجريبية بأيّامها،
 * أو انتهت — ومعها رمز الجهاز الذي يُرسل إلى المطوّر، ورقمه.
 */
export type LicenseStatus = (
  | { status: 'activated'; office: string | null; issued: string }
  | { status: 'trial'; daysLeft: number; lastDay: string; extended: boolean }
  | { status: 'expired'; lastDay: string }
) & { device: string; phone: string; trialStart: string };

export type ContentCounts = { templates: number; letterheads: number; clips: number; files: number };
/** ما أُضيف، وما كان موجودًا بمعرّفه فتُرك كما هو. */
export type ContentImportResult = { path: string; added: ContentCounts; existing: Omit<ContentCounts, 'files'> };

/** نسخةٌ من القاعدة في مجلّد النسخة التلقائية — يُختار منها ما يُسترجع. */
export type MirrorSnapshot = { name: string; at: string; bytes: number; appVersion: string | null };

/** البحث الشامل فيما سوى الكتب — والكتب في الأرشيف نفسه بمدّتها. */
export type SearchHits = {
  query: string;
  citizens: CitizenSummary[];
  templates: { id: number; title: string; category: string | null; issuing: string }[];
  attachments: { id: number; citizenId: number; citizenName: string; docType: string; snippet: string }[];
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
  fee: number;
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
  | 'fee'
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
  fee: number;
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

export type CitizenSummary = {
  id: number;
  fullName: string;
  nationalId: string | null;
  jobTitle: string | null;
  workplace: string | null;
  category: string | null;
  photoPath: string | null;
  verified: number;
  attachmentCount: number;
  lastIssuedAt: string | null;
};

export type Attachment = {
  id: number;
  citizenId: number;
  docType: string;
  filePath: string;
  fileFormat: string | null;
  dpi: number | null;
  ocrText: string | null;
  ocrAccuracy: number | null;
  scannedAt: string | null;
  sha256: string | null;
};

export type CitizenDocumentRow = {
  id: number;
  serial: string;
  docType: string | null;
  destination: string | null;
  purpose: string | null;
  templateId: number | null;
  copies: number;
  fee: number;
  issuedDate: string;
  status: string;
};

export type CitizenInput = {
  id: number | null;
  fullName: string;
  nationalId: string | null;
  jobTitle: string | null;
  workplace: string | null;
  employeeCode: string | null;
  serviceStatus: string | null;
  birthDate: string | null;
  birthPlace: string | null;
  enrollmentDept: string | null;
  address: string | null;
  housingCardNo: string | null;
  landmark: string | null;
  phone: string | null;
  photoPath: string | null;
  category: string | null;
  notes: string | null;
  verified: boolean;
  // ما تسأل عنه الاستمارات الحكومية (أيلول ٢٠٢٦) — اختياريّةٌ فلا يتغيّر ما يبني الملف بدونها.
  // وتعريفها وعناوينها في `citizenSchema.ts`.
  surname?: string | null;
  motherName?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  education?: string | null;
  email?: string | null;
  governorate?: string | null;
  district?: string | null;
  subdistrict?: string | null;
  nidIssueDate?: string | null;
  nidIssuer?: string | null;
  familyNumber?: string | null;
  civilIdNo?: string | null;
  civilRecord?: string | null;
  civilPage?: string | null;
  passportNo?: string | null;
  rationCardNo?: string | null;
  housingIssuer?: string | null;
};

export type CitizenDetail = Omit<CitizenInput, 'verified'> & {
  id: number;
  verified: boolean;
  attachments: Attachment[];
  documents: CitizenDocumentRow[];
};

export type ScannerDevice = { id: string; name: string };

export type CitizenStats = {
  activeFiles: number;
  verifiedFiles: number;
  attachments: number;
  ocrAccuracy: number | null;
  issuedThisMonth: number;
};

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
};

export type ImportPlan = {
  candidates: ImportCandidate[];
  sharedLetterhead: { key: string; layout: LetterheadLayout; count: number } | null;
  duplicates: { ids: string[]; confidence: number }[];
  failed: { file: string; error: string }[];
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

export type DiwanApi = {
  settings: {
    get(): Promise<OfficeSettings>;
    set(patch: Partial<OfficeSettings>): Promise<OfficeSettings>;
  };
  ui: {
    /** يكبّر الواجهة كلّها في مكانها — والطباعة في نافذتها لا تتأثّر. */
    setZoom(factor: number): void;
    /** رقم الإصدار من الحزمة، ومجلّد بيانات المكتب — لـ«الإعدادات» وحول البرنامج. */
    info(): Promise<{ version: string; dataDir: string }>;
    /** النسخ واللصق بحافظة النظام — تعمل والنافذة في الخلف (بطاقة التعبئة فوق المتصفّح). */
    copyText(text: string): Promise<void>;
    pasteText(): Promise<string>;
    /** خطأٌ في العملية الرئيسة خارج القنوات — يُقال في شريط الأخطاء (المرحلة ٧). */
    onError(listener: (message: string) => void): () => void;
    /**
     * البرنامج يُغلق (خطة Production، ١٫٥): تُفرغ الواجهة ما لم يُحفظ ثم تقول `closeReady` — وإن
     * كانت نسخةٌ تلقائية (`backup`) قيل ذلك في الواجهة، فلا تُترك نافذةً معلّقة.
     */
    onClosing(listener: (info: { backup: boolean }) => void): () => void;
    /** الواجهة أفرغت ما لم يُحفظ: يمضي الإغلاق. وإن لم تقلها مضى بعد مهلة. */
    closeReady(): void;
  };
  counts: {
    sidebar(): Promise<SidebarCounts>;
  };
  clients: {
    list(query?: string): Promise<Client[]>;
    save(input: ClientInput): Promise<Client>;
    setLogo(id: number, imagePath: string): Promise<Client>;
    delete(id: number): Promise<void>;
  };
  orders: {
    list(filter?: { status?: 'open' | OrderStatus; clientId?: number; query?: string }): Promise<Order[]>;
    get(id: number): Promise<Order | null>;
    save(input: OrderInput): Promise<Order>;
    setStatus(id: number, status: OrderStatus): Promise<Order>;
    delete(id: number): Promise<void>;
  };
  printers: {
    list(): Promise<PrinterInfo[]>;
  };
  archive: {
    stats(): Promise<ArchiveStats>;
  };
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
  citizens: {
    list(opts?: {
      query?: string;
      category?: string | null;
      limit?: number;
    }): Promise<CitizenSummary[]>;
    categories(): Promise<{ name: string; count: number }[]>;
    stats(): Promise<CitizenStats>;
    get(id: number): Promise<CitizenDetail | null>;
    /** ملفّات عدّة مواطنين بخاناتها — لهويّات الموظفين وقائمة الدمج (د١٥، د١٢). */
    records(ids: number[]): Promise<Omit<CitizenDetail, 'attachments'>[]>;
    save(input: CitizenInput): Promise<CitizenDetail>;
    usage(id: number): Promise<number>;
    delete(id: number): Promise<void>;
    exportExcel(id: number): Promise<string | null>;
  };
  attachments: {
    /** يستورد ملفًا من الحاسوب إلى مخزن التطبيق ويقيّده مستمسكًا. */
    importFile(citizenId: number, docType: string): Promise<Attachment | null>;
    scan(citizenId: number, docType: string, dpi: number): Promise<Attachment>;
    addFromDataUrl(citizenId: number, docType: string, dataUrl: string): Promise<Attachment>;
    rename(id: number, docType: string): Promise<void>;
    ocr(id: number): Promise<{ text: string; confidence: number }>;
    /** ظهر البطاقة بقارئه الخاصّ: السطور الثلاثة كما قُرئت، والحقول بتحقّقها (أو عدمٌ إن لم تُوجد). */
    readMrz(id: number): Promise<{ result: MrzResult | null; lines: string[] }>;
    print(id: number, printer: string | null): Promise<boolean>;
    copyToClipboard(id: number): Promise<boolean>;
    exportZip(citizenId: number): Promise<{ path: string; count: number } | null>;
    delete(id: number): Promise<void>;
  };
  scanner: {
    list(): Promise<ScannerDevice[]>;
    /** يمسح صفحةً إلى المخزن ويعيد مسارها — بلا قيدٍ على مواطن. */
    scanImage(dpi: number): Promise<string>;
    ocrAvailable(): Promise<boolean>;
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
    printIssued(req: { ids: number[]; printer: string | null; mode?: 'full' | 'values'; label?: string }): Promise<PrintJobResult>;
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
  /** البحث الشامل فيما سوى الكتب: المواطنون والنماذج ونصّ المستمسكات. */
  search: {
    others(query: string): Promise<SearchHits>;
  };
  /** بطاقة التعبئة للمواقع الحكومية (هـ٦) — نافذةٌ صغيرة فوق المتصفّح. */
  fillCard: {
    open(citizenId: number): Promise<void>;
  };
  /** «ما ينتظرك اليوم» (د٧). */
  today: {
    agenda(): Promise<TodayAgenda>;
  };
  /** الشبّاك: المعاملات المعلّقة محفوظةً في القاعدة — شكلها في `ServiceScreen` (`Parked`). */
  service: {
    parked(): Promise<unknown[]>;
    setParked(list: unknown[]): Promise<void>;
  };
  /** التذكير والتأنيث: ما أجاب عنه المكتب لأسماءٍ لم يُعرف جنسها (ج٤). */
  gender: {
    learned(): Promise<Record<string, 'ذكر' | 'أنثى'>>;
    learn(answers: { name: string; gender: 'ذكر' | 'أنثى' }[]): Promise<number>;
  };
  /** النسخ الاحتياطي واسترجاعه (د١) — والتشفير بكلمة مرورٍ لا تُحفظ. */
  backup: {
    create(password?: string | null): Promise<{ path: string; bytes: number; encrypted: boolean } | null>;
    pick(): Promise<{ path: string; encrypted: boolean } | null>;
    inspect(path: string, password?: string | null): Promise<BackupSummary>;
    /** يستبدل بيانات المكتب بالنسخة؛ وما كان يُنقل جانبًا إلى `aside`. ثم تُعاد الواجهة. */
    restore(path: string, password?: string | null): Promise<{ summary: BackupSummary; aside: string }>;
    /** النسخة التلقائية عند الإغلاق: مجلّدها وما بقي منها، وحالها آخر مرّة. */
    autoGet(): Promise<AutoBackupStatus>;
    autoPickDir(): Promise<string | null>;
    /** `password`: نصٌّ كلمةٌ جديدة، و`null` بلا تشفير، وغيابه يُبقي ما كان. و`dir: null` يوقفها. */
    autoSet(config: { dir: string | null; keep?: number; password?: string | null }): Promise<AutoBackupStatus>;
    autoRun(): Promise<{ dbChanged: boolean; filesCopied: number; bytesCopied: number; snapshots: number; root: string } | null>;
    /** الاسترجاع من مجلّد النسخة التلقائية — كالحزمة: يُفحص، ثم يُرى، ثم يُوافق عليه. */
    mirrorPick(): Promise<{ path: string; encrypted: boolean; lastAt: string | null; snapshots: MirrorSnapshot[] } | null>;
    /** `snapshot`: نسخة القاعدة المختارة من المجلّد — وبلا اختيارٍ آخرها. */
    mirrorInspect(path: string, password?: string | null, snapshot?: string | null): Promise<BackupSummary>;
    mirrorRestore(path: string, password?: string | null, snapshot?: string | null): Promise<{ summary: BackupSummary; aside: string }>;
  };
  /** التفعيل بلا شبكة: الحال، ومفتاحٌ يُلصق — كاملٌ أو تمديد — لهذا الجهاز وحده. */
  license: {
    status(): Promise<LicenseStatus>;
    activate(key: string): Promise<LicenseStatus>;
  };
  /**
   * حزمة المحتوى (خطة Production، ٤٫٣): النماذج والترويسات والكليشات وصورها — بلا بيانات الناس —
   * تُصدَّر ملفًّا وتُستورد في مكتبٍ آخر. والمكرّر يُعرف بمعرّفه فلا يُضاف ثانيةً.
   */
  content: {
    export(): Promise<ContentCounts & { path: string } | null>;
    import(): Promise<ContentImportResult | null>;
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
    save(input: {
      id: number | null;
      templateId: number | null;
      citizenId: number | null;
      title: string;
      values: Record<string, string>;
      bodyHtml: string;
    }): Promise<number>;
    delete(id: number): Promise<void>;
  };
  /** إخراج الورقة: طباعة ومعاينة PDF وصورة عالية الدقة وWord. */
  output: {
    print(payload: {
      sheetHtml: string;
      printer: string | null;
      copies: number;
      silent: boolean;
      /** مقاس الورقة بالملّم — A4 عموديًّا ما لم يُذكر (الشهادة أفقية). */
      page?: { w: number; h: number };
      /** وجهان: وجهٌ ثم ظهره معكوسًا — الطابعة تقلب الورقة. */
      duplex?: boolean;
    }): Promise<{ ok: boolean; reason?: string }>;
    /** ورقة معايرة الطابعة — تُطبع بلا إزاحة لتُقاس بها الإزاحة. */
    printCalibration(printer: string | null): Promise<{ ok: boolean; reason?: string }>;
    savePdf(payload: {
      sheetHtml: string;
      suggestedName: string;
      page?: { w: number; h: number };
    }): Promise<string | null>;
    savePng300(payload: {
      sheetHtml: string;
      suggestedName: string;
      page?: { w: number; h: number };
    }): Promise<string | null>;
    /** الكتاب إلى Word بتنسيقه: وثيقته وقيمه وترويسته (حقولها محلولة — `resolveLayout`). */
    saveDocx(payload: {
      doc: Doc;
      values: Record<string, string>;
      head: { layout: LetterheadLayout; registry?: { number: string; date: string } } | null;
      suggestedName: string;
      title: string;
    }): Promise<string | null>;
    /**
     * دفعةٌ كبيرة ورقةً ورقة بسجلٍّ على القرص — فتُستأنف بعد انقطاع الكهرباء.
     * وبلا طابعةٍ مختارة تُطبع مهمّةً واحدة بحوار النظام، بلا سجلّ.
     */
    printJob(payload: {
      label: string;
      pages: string[];
      printer: string | null;
      page: { w: number; h: number };
      duplex: boolean;
    }): Promise<PrintJobResult>;
    /** دفعاتٌ لم تكتمل — تُعرض عند الإقلاع ليُستأنف منها. */
    pendingJobs(): Promise<PendingPrintJob[]>;
    /** يستأنف من الورقة `from` (من ٠). */
    resumeJob(id: string, from: number): Promise<PrintJobResult>;
    discardJob(id: string): Promise<void>;
    /** تقدّم الدفعة الجارية — ويعيد ما يُلغي الاشتراك. */
    onPrintProgress(listener: (p: { id: string; sent: number; total: number }) => void): () => void;
  };
  /** بنك الأسئلة: سؤالٌ يُحفظ مرّةً ويُدرج في كل ورقةٍ بعدها. */
  bank: {
    save(input: { item: ListItem; subject?: string | null; grade?: string | null }): Promise<BankQuestion>;
    list(filter?: { query?: string; subject?: string | null; grade?: string | null }): Promise<BankQuestion[]>;
    used(id: number): Promise<void>;
    delete(id: number): Promise<void>;
  };
  /** محرّر PDF (خدمات التقديم الإلكتروني): الملفّات تُفتح مصادرَ، والخطّة تُبنى ملفًّا جديدًا. */
  pdf: {
    open(): Promise<{ opened: PdfOpened[]; failed: { name: string; error: string }[] } | null>;
    /** صفحةٌ من الماسح مصدرًا جديدًا — بمقاسها الحقيقي. */
    scan(): Promise<PdfOpened>;
    build(plan: PdfPlan): Promise<Uint8Array>;
    /** صورُ JPEG ملفًّا — كلٌّ صفحةٌ بمقاسها بالنقاط (التصغير لحدّ الرفع). */
    assemble(pages: { jpeg: Uint8Array; width: number; height: number }[]): Promise<Uint8Array>;
    /** صور الملف أصغر ونصّه باقٍ — `images` كم صورةً صُغّرت (صفرٌ: لا صور تُصغَّر فيه). */
    shrinkImages(bytes: Uint8Array, step: { scale: number; quality: number }): Promise<{ bytes: Uint8Array; images: number }>;
    save(bytes: Uint8Array, name: string): Promise<string | null>;
    saveMany(items: { bytes: Uint8Array; name: string }[]): Promise<{ folder: string; files: string[] } | null>;
    saveImages(images: { name: string; bytes: Uint8Array }[]): Promise<{ folder: string; files: string[] } | null>;
    pickLogo(): Promise<string | null>;
    logos(): Promise<string[]>;
    close(ids: string[]): Promise<void>;
  };
  /** استوديو التصوير: حفظ اللقطة، ومراقبة مجلّد الكاميرا الاحترافية. */
  /** صورة المعاملة: فصل الشخص عن خلفيّته على الجهاز، وقوالب المكتب، وقاطه. */
  photos: {
    modelReady(): Promise<boolean>;
    /** صورة الحافظة محفوظةً في المخزن — ومسارها، أو `null` إن لم تكن فيها صورة. */
    clipboardImage(): Promise<string | null>;
    /** الشخص مفصولًا: قناعه (بايتٌ لكلّ بكسل) وألوانه بلا هالة الخلفية — بمقاس ما أُرسل. */
    cutout(input: { pixels: Uint8Array; width: number; height: number }): Promise<{ alpha: Uint8Array; pixels: Uint8Array; ms: number }>;
    presets(): Promise<PhotoPreset[]>;
    savePreset(preset: PhotoPreset): Promise<PhotoPreset[]>;
    deletePreset(id: string): Promise<PhotoPreset[]>;
    suits(): Promise<CustomSuit[]>;
    /** «استورد قاطًا»: PNG شفّافة — ويُقال سبب الرفض. `null` إن أُلغي الاختيار. */
    importSuit(): Promise<CustomSuit | null>;
    deleteSuit(id: string): Promise<CustomSuit[]>;
  };
  camera: {
    /** لقطةٌ مقصوصة (dataURL) تُحفظ في المخزن — ويعود مسارها. */
    store(dataUrl: string): Promise<string>;
    /** يختار مجلّد لقطات الكاميرا ويراقبه — ويعود مساره أو `null`. */
    watchFolder(): Promise<string | null>;
    unwatch(): Promise<void>;
    /** كلّ صورةٍ جديدة في المجلّد المراقَب — ويعيد ما يُلغي الاشتراك. */
    onShot(listener: (shot: { dataUrl: string; file: string }) => void): () => void;
  };
  designs: {
    /**
     * يستورد تصميمًا: صورة أو Word أو Photoshop أو PDF.
     *
     * و`fallback` مقاسٌ يختاره المكتب مسبقًا لما يسكت ملفُّه — وبغيره يعود
     * `canvas: null` ويُسأل.
     */
    import(fallback: { w: number; h: number } | null): Promise<{
      name: string;
      source: 'image' | 'word' | 'psd' | 'pdf';
      size: { w: number; h: number } | null;
      dpi: number | null;
      warnings: string[];
      canvas: unknown | null;
      stored: string[];
      /** الحقول المقترحة من أسماء طبقات Photoshop — يؤكّدها المكتب (هـ٤). */
      fieldSuggestions: FieldSuggestion[];
    } | null>;
  };
  files: {
    pickImage(bucket: string): Promise<string | null>;
    /** مجلد صورٍ لدفعة — لكلٍّ اسمُ ملفّه بلا امتداد، وعليه يُطابَق بصفّه. */
    pickImageFolder(bucket: string): Promise<{ name: string; src: string }[] | null>;
    /** قائمةٌ من ملف Excel أو CSV — نصًّا بأعمدةٍ مفصولة بالجدولة، كما لو أُلصقت. */
    readSheet(): Promise<{ name: string; text: string; rows: number } | null>;
    /** خلفيةُ لوحة ومقاسُها من الملف — و`dpi: null` يعني: اسأل، لا تخمّن. */
    pickBackground(bucket: string): Promise<{
      src: string;
      meta: {
        width: number;
        height: number;
        dpi: number | null;
        format: 'png' | 'jpeg';
        mm: { w: number; h: number } | null;
      } | null;
    } | null>;
    saveAs(payload: {
      data: Uint8Array;
      suggestedName: string;
      filterName: string;
      ext: string;
    }): Promise<string | null>;
  };
};

/** ناتج دفعة الطباعة: كم ورقةً أُرسلت من كم، ولماذا توقّفت إن توقّفت. */
export type PrintJobResult = {
  ok: boolean;
  sent: number;
  total: number;
  reason?: string;
  /** أسُجّلت لتُستأنف؟ لا — حين لا طابعة مختارة. */
  journaled: boolean;
  id?: string;
};

export type PendingPrintJob = {
  id: string;
  label: string;
  printer: string;
  total: number;
  sent: number;
  createdAt: string;
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
