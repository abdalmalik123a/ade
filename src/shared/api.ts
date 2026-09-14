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
};
