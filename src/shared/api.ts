import type { Letterhead, LetterheadLayout } from './letterhead';
import type { TemplateInput, TemplateVariable } from './template';

/** عقد الاتصال بين الواجهة والعملية الرئيسية. مصدر الحقيقة الوحيد للأنواع. */

/**
 * مواضع محجوزة داخل علامات الورقة تملؤها العملية الرئيسية وقت الإصدار.
 * الواجهة لا تعرف رقم الصادر النهائي ولا البصمة قبل حجزهما، فترسل الموضع
 * بدل القيمة — فلا يُحرق رقم على كتاب لم يصدر.
 */
export const SERIAL_SLOT = '{{DIWAN_SERIAL}}';
export const QR_SLOT = '{{DIWAN_QR}}';
export const FINGERPRINT_SLOT = '{{DIWAN_FINGERPRINT}}';

export type OfficeSettings = {
  officeName: string;
  operatorName: string;
  defaultPrinter: string | null;
  serialPrefix: string;
  serialYear: number;
};

export type SidebarCounts = {
  templates: number;
  issuedToday: number;
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
  serialPrefix: string;
  serialYear: number;
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

/** مؤشرات مدة زمنية — شاشة البحث والتقارير الدورية. */
export type PeriodStats = {
  issued: number;
  revenue: number;
  citizens: number;
  printedCopies: number;
  byType: { name: string; count: number; revenue: number }[];
  byDay: { day: string; count: number; revenue: number }[];
};

/** مؤشرات اليوم في أعلى شاشة الأرشيف. */
export type ArchiveStats = {
  issuedToday: number;
  issuedYesterday: number;
  revenueToday: number;
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
};

export type TemplateDetail = Omit<TemplateSummary, 'variables'> & {
  variables: TemplateVariable[];
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
  counts: {
    sidebar(): Promise<SidebarCounts>;
  };
  printers: {
    list(): Promise<PrinterInfo[]>;
  };
  archive: {
    stats(): Promise<ArchiveStats>;
    today(): Promise<DocumentRow[]>;
  };
  letterheads: {
    list(): Promise<Letterhead[]>;
    get(id: number): Promise<Letterhead | null>;
    save(input: {
      id: number | null;
      name: string;
      authorityId: number | null;
      layout: LetterheadLayout;
    }): Promise<Letterhead>;
    setDefault(id: number): Promise<void>;
    delete(id: number): Promise<void>;
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
    save(input: CitizenInput): Promise<CitizenDetail>;
    usage(id: number): Promise<number>;
    delete(id: number): Promise<void>;
    exportExcel(id: number): Promise<string | null>;
  };
  attachments: {
    /** يستورد ملفًا من الحاسوب إلى مخزن التطبيق ويقيّده مستمسكًا. */
    importFile(citizenId: number, docType: string): Promise<Attachment | null>;
    scan(citizenId: number, docType: string, dpi: number): Promise<Attachment>;
    rename(id: number, docType: string): Promise<void>;
    ocr(id: number): Promise<{ text: string; confidence: number }>;
    print(id: number): Promise<boolean>;
    copyToClipboard(id: number): Promise<boolean>;
    exportZip(citizenId: number): Promise<{ path: string; count: number } | null>;
    delete(id: number): Promise<void>;
  };
  scanner: {
    list(): Promise<ScannerDevice[]>;
    ocrAvailable(): Promise<boolean>;
  };
  documents: {
    peekSerial(prefix: string, year: number): Promise<string>;
    /** الإصدار: رقم وبصمة ورمز تحقق وقيد في السجل، ثم طباعة وأرشفة PDF. */
    issue(input: IssueInput, print: boolean): Promise<IssueOutcome>;
    get(id: number): Promise<DocumentDetail | null>;
    list(opts?: {
      from?: string | null;
      to?: string | null;
      query?: string;
      limit?: number;
    }): Promise<DocumentRow[]>;
    stats(opts?: { from?: string | null; to?: string | null }): Promise<PeriodStats>;
    /** إعادة طباعة طبق الأصل — تُقيَّد ولا تستهلك رقمًا جديدًا. */
    reprint(ids: number[], copies: number): Promise<{ printed: number; failed: number }>;
    /** تصدير الكتاب PDF إلى مكان يختاره المكتب. */
    exportPdf(id: number): Promise<string | null>;
    /** تقرير المدة جدولًا في Excel — العنوان يظهر في ورقة المؤشرات. */
    exportReport(opts: {
      from?: string | null;
      to?: string | null;
      query?: string;
      title?: string;
    }): Promise<{ path: string; count: number } | null>;
    /** نسخة احتياطية كاملة لقاعدة البيانات ومخزن الملفات. */
    backup(): Promise<{ path: string; bytes: number } | null>;
  };
  templates: {
    list(category?: string | null): Promise<TemplateSummary[]>;
    get(id: number): Promise<TemplateDetail | null>;
    categories(): Promise<{ name: string; count: number }[]>;
    stats(): Promise<TemplateStats>;
    save(input: TemplateInput): Promise<TemplateDetail>;
    usage(id: number): Promise<number>;
    delete(id: number): Promise<void>;
    importFile(): Promise<ImportedTemplate | null>;
    export(id: number): Promise<string | null>;
    exportLibrary(): Promise<{ path: string; count: number } | null>;
    restoreLibrary(): Promise<{ added: number; skipped: number } | null>;
    backup(): Promise<string | null>;
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
    }): Promise<{ ok: boolean; reason?: string }>;
    savePdf(payload: { sheetHtml: string; suggestedName: string }): Promise<string | null>;
    savePng300(payload: { sheetHtml: string; suggestedName: string }): Promise<string | null>;
    saveDocx(payload: {
      sheetHtml: string;
      suggestedName: string;
      title: string;
    }): Promise<string | null>;
  };
  files: {
    pickImage(bucket: string): Promise<string | null>;
    saveAs(payload: {
      data: Uint8Array;
      suggestedName: string;
      filterName: string;
      ext: string;
    }): Promise<string | null>;
    reveal(path: string): Promise<void>;
  };
};
