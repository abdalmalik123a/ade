import type { Letterhead, LetterheadLayout } from './letterhead';
import type { TemplateInput, TemplateVariable } from './template';

/** عقد الاتصال بين الواجهة والعملية الرئيسية. مصدر الحقيقة الوحيد للأنواع. */

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
  copies: number;
  fee: number;
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
    get(id: number): Promise<Record<string, unknown> | null>;
  };
  documents: {
    peekSerial(prefix: string, year: number): Promise<string>;
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
