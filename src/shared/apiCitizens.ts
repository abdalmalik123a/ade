/**
 * عقد الجسر — باب المواطنين (المحادثة ٦، البند ٢٨): ملفّ المواطن ومستمسكاته واستيراده والماسح — أنواعها
 * وقنواتها. ويُستورد كلّه من `@shared/api` كما كان.
 */
import type { MrzResult } from './mrz';
import type { ImportMap, ImportRow } from './citizenImport';
import { count, toIndic } from './arabic';

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

/** استيراد الزبائن من Excel (الموجة ٢) — `shared/citizenImport.ts` و`services/citizenImport.ts`. */
export type CitizenImportOptions = {
  /** تصنيفٌ لكلّ المستورَدين — ولا يُغيَّر تصنيف ملفٍّ موجود له تصنيف. */
  category?: string | null;
  /** من بالاسم نفسه في السجلّ ولا رقمَ ولا هاتفَ يفرّق بينهما: يُضاف ملفًّا جديدًا لا يُترك. */
  addSimilar?: boolean;
  /** اسم الملف — في سجلّ الأحداث. */
  fileName?: string | null;
};

export type CitizenImportReport = {
  added: number;
  /** ملفّاتٌ موجودة أُكمل فارغها (ولا يُكتب فوق ما فيها). */
  completed: number;
  /** موجودةٌ لا جديد فيها. */
  unchanged: number;
  /** بالاسم نفسه في السجلّ بلا ما يفرّق — تُترك ما لم يُختر `addSimilar`. */
  similar: number;
  noName: number;
  /** مكرّرٌ في الملف نفسه، دُمج في أوّله. */
  repeated: number;
  /** أرقامٌ وطنية بصيغةٍ غير معتادة — تُحفظ كما كُتبت، وتنبيهها في الملف. */
  unusualIds: number;
  /** أوّل عشرين من المتشابهين — ليرى المكتب من يُترك. */
  similarNames: string[];
};

export type ScannerDevice = { id: string; name: string };

export type CitizenStats = {
  activeFiles: number;
  verifiedFiles: number;
  attachments: number;
  ocrAccuracy: number | null;
  issuedThisMonth: number;
};

/** قنوات باب المواطنين في `window.diwan`. */
export type CitizenApis = {
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
    /** استيراد الزبائن من Excel: الخطّة بلا كتابة — تُعرض قبل الاستيراد. */
    importPlan(rows: ImportRow[], opts: CitizenImportOptions): Promise<CitizenImportReport>;
    /** الاستيراد قيدًا واحدًا: الجديد يُضاف، والموجود يُكمل فارغه. */
    import(rows: ImportRow[], opts: CitizenImportOptions): Promise<CitizenImportReport>;
    /** ربط الأعمدة الذي تذكّره المكتب من ملفّاته السابقة. */
    importMap(): Promise<ImportMap>;
    setImportMap(map: ImportMap): Promise<ImportMap>;
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
    exportZip(citizenId: number): Promise<ExportZipResult | null>;
    delete(id: number): Promise<void>;
  };
  scanner: {
    list(): Promise<ScannerDevice[]>;
    /** يمسح صفحةً إلى المخزن ويعيد مسارها — بلا قيدٍ على مواطن. */
    scanImage(dpi: number): Promise<string>;
    ocrAvailable(): Promise<boolean>;
  };
};

export type ExportZipFailure = { docType: string; reason: string };

export type ExportZipResult = {
  path: string;
  total: number;
  count: number;
  failed: ExportZipFailure[];
  message: string;
};

/**
 * صياغة رسالة نتيجة تصدير المستمسكات مع تفصيل المتعذّر وعدم استخدام «تمّ» عند أي فشل (المرحلة A، ٤٫٦).
 * تتبع قواعد دليل الواجهة (UI.md §٣): الرقم هنديٌّ في الجملة كلّها (`toIndic`) والعدد بـ`count()`.
 */
export function formatExportZipMessage(
  total: number,
  exportedCount: number,
  failed: ExportZipFailure[]
): string {
  if (failed.length === 0) {
    return exportedCount === 1
      ? 'صُدّر مستمسك واحد في حزمة'
      : `صُدّرت ${count(exportedCount, 'مستمسك')} في حزمة`;
  }
  const allSameReason = failed.length > 1 && failed.every((f) => f.reason === failed[0]!.reason);
  const failedDetails = allSameReason
    ? `${failed.map((f) => f.docType).join('، ')}${failed[0]!.reason ? ` (${failed[0]!.reason})` : ''}`
    : failed.map((f) => (f.reason ? `${f.docType} (${f.reason})` : f.docType)).join('، ');

  if (exportedCount === 0) {
    return `تعذّر تصدير المستمسكات: ${failedDetails}`;
  }
  return `صُدّرت ${toIndic(exportedCount)} من ${toIndic(total)} — تعذّر: ${failedDetails}`;
}

