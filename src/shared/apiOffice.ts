/**
 * عقد الجسر — باب المكتب (المحادثة ٦، البند ٢٨): الإعدادات والواجهة والعدّادات والزبائن والطلبات والطابعات،
 * والتنبيهات والبحث الشامل، والنسخ الاحتياطي والتحديث والتفعيل وحزمة المحتوى — أنواعها وقنواتها.
 * ويُستورد كلّه من `@shared/api` كما كان.
 */
import type { Client, ClientInput, Order, OrderCounts, OrderInput, OrderStatus } from './orders';
import type { PrintRoles } from './printRoles';
import type { CounterCardId } from './counterCards';
import type { CitizenSummary } from './apiCitizens';

export type OfficeSettings = {
  officeName: string;
  /** هاتف المكتب وعنوانه — يُطبعان على وصل الاستلام (الموجة ٢). */
  officePhone: string;
  officeAddress: string;
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
  /**
   * إزاحة التاريخ الهجري بالأيام (−٢ إلى +٢): يُحسب بأمّ القرى، وبداية الشهر في العراق بالرؤية —
   * فيُطابقه المكتب يدويًّا. والميلادي هو الأصل لا يُزاح (`shared/dates.ts`).
   */
  hijriOffset: number;
  /**
   * بطاقات الشبّاك الظاهرة بترتيبها (`shared/counterCards.ts`) — يضبطها المكتب من الإعدادات. وحلّت محلّ
   * «الأقسام الظاهرة» و«تثبيت الشريط» حين صارت السكّة خمس وجهاتٍ ظاهرة (المرحلة ٢).
   */
  counterCards: CounterCardId[];
  /**
   * «ملفّ المدارس» (الموجة ٢، بقرار المالك: «بخيارٍ يُفعَّل من الإعدادات… ولا يضاف للجميع»): لكلّ مدرسةٍ في «الجهات»
   * جنسها ومحافظتها ومديرها، وفي الشبّاك «هات المدرسة» يملأ كتبها، والعام الدراسي من التاريخ (`shared/schoolFile.ts`).
   */
  schoolFiles: boolean;
  /**
   * «وصل الاستلام» للطلبات (الموجة ٢) — مطفأٌ في الأصل (قرار المالك: «لا يأخذه أحدٌ عادةً… خيارًا يُفعل ولا يُفعل»): في
   * الطلب خانة «ما تركه الزبون عندنا» و«سجّل واطبع الوصل»، وعلى بطاقته «الوصل» (`shared/receipt.ts`).
   */
  receiptSlip: boolean;
};

export type SidebarCounts = {
  templates: number;
  issuedToday: number;
  /** الطلبات المفتوحة، وما موعده اليوم، والمتأخّر — لشارة الشريط. */
  orders: OrderCounts;
  /** ما سوى الطلبات في رقم «قيد العمل»: المعاملات المعلّقة (المرحلة ٣) — لا المسودّات (د٢). */
  pending: number;
  /** خرج من المكتب عملٌ بعد — كتابٌ أو طباعةٌ أو ملفّ (`ipc/gate.ts`): فلا «؟» في أعلى الصفحات. */
  worked: boolean;
};

/** Electron 44 لم يعد يعطي isDefault/status مباشرة — يُستخرجان من options الخاصة بالنظام. */
export type PrinterInfo = {
  name: string;
  displayName: string;
  description: string;
  isDefault: boolean;
  ready: boolean;
};

/** طلبٌ في «التنبيهات» — ما يُعرض ويُنسخ في رسالته. */
export type AgendaOrder = { id: number; customer: string; title: string; dueDate: string | null; phone: string | null };

/** «التنبيهات» في الشريط العلوي (د٧ — وكانت «ما ينتظرك اليوم» عند الإقلاع). */
export type TodayAgenda = {
  overdue: AgendaOrder[];
  dueToday: AgendaOrder[];
  /** جاهزةٌ تنتظر أصحابها — ومعها «انسخ رسالة: طلبكم جاهز» (د٨). */
  ready: AgendaOrder[];
  drafts: number;
  /** معاملاتٌ عُلّقت في الشبّاك تنتظر صاحبها (قيد العمل). */
  parked: number;
  /** طباعةٌ انقطعت: ما أُرسل من أوراقها ومجموعها. */
  pendingPrints: { id: string; label: string; sent: number; total: number }[];
  lastBackupAt: string | null;
  /** مضى أسبوعٌ بلا نسخة (أو لم تُؤخذ قطّ) وفي الأرشيف كتب. */
  backupDue: boolean;
  /** النسخة التلقائية الأخيرة لم تُؤخذ — ولماذا (فلاشةٌ غير موصولة…). */
  autoBackupError?: string | null;
  /** الملخّص الأسبوعي (الموجة ٢). */
  week: WeekSummary;
};

/** ما خرج من المكتب في مدّة: زبائن من الكتب الصادرة والطلبات المسلّمة، وأوراقٌ طُبعت، وملفّاتٌ حُفظت — بلا مال. */
export type WorkCounts = { customers: number; sheets: number; files: number };

/**
 * الملخّص الأسبوعي في «التنبيهات» — والأسبوع من السبت كما في «السجلّ». و`unseen`: بدأ أسبوعٌ وفي الذي قبله عمل، ولم يُفتح
 * الجرس بعدُ فيه — فنقطةٌ على الجرس بلا رقم.
 */
export type WeekSummary = { from: string; thisWeek: WorkCounts; lastWeek: WorkCounts; unseen: boolean };

export type AutoBackupStatus = {
  dir: string | null;
  keep: number;
  encrypted: boolean;
  /** التشفير يحفظ الكلمة مشفّرةً بحساب ويندوز — فإن لم يتح لم يُعرض. */
  canEncrypt: boolean;
  lastAt: string | null;
  lastError: string | null;
  /** القرص الموصول ليس الذي اعتُمد للنسخ — فلم يُكتب عليه شيء، ويُعتمد بضغطة (مراجعة ٧ ت١). */
  foreign: boolean;
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
  | { status: 'subscribed'; plan: 'monthly' | 'yearly'; daysLeft: number; lastDay: string; office: string | null; issued: string }
  | { status: 'trial'; daysLeft: number; lastDay: string; extended: boolean }
  | { status: 'expired'; lastDay: string; ended: 'trial' | 'subscription' }
  | { status: 'unverified'; reason: 'machine_error'; lastDay?: string }
) & { device: string; phone: string; trialStart: string; unverified?: boolean; deviceWarning?: string; graceDaysLeft?: number };

export type ContentCounts = { templates: number; letterheads: number; clips: number; files: number };
/** ما أُضيف، وما كان موجودًا بمعرّفه فتُرك كما هو. */
export type ContentImportResult = { path: string; added: ContentCounts; existing: Omit<ContentCounts, 'files'>; missing?: { fonts: string[]; images: number } };

/** حزمة مشحونة مع البرنامج في resources/packs ومعروضة للاختيار. */
export type BundledPackInfo = {
  id: string;
  title: string;
  section: string;
  description: string;
  version: string;
  verifiedOn: string;
  counts: ContentCounts;
  sha256: string;
  imported: boolean;
};

/** نسخةٌ من القاعدة في مجلّد النسخة التلقائية — يُختار منها ما يُسترجع. */
export type MirrorSnapshot = { name: string; at: string; bytes: number; appVersion: string | null };

/** البحث الشامل فيما سوى الكتب — والكتب في الأرشيف نفسه بمدّتها. */
export type SearchHits = {
  query: string;
  citizens: CitizenSummary[];
  templates: { id: number; title: string; category: string | null; issuing: string }[];
  attachments: { id: number; citizenId: number; citizenName: string; docType: string; snippet: string }[];
};

/** قنوات باب المكتب في `window.diwan`. */
export type OfficeApis = {
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
    /** «أرسل تقرير المشكلة» (البند ٣٢): يُحفظ التقرير حيث يختار الموظف — ومساره، أو `null` إن أُلغي الحفظ. */
    problemReport(note: string): Promise<string | null>;
    /** يُري آخر تقريرٍ حُفظ في مجلّده — ليُرسل بواتساب. */
    showProblemReport(): Promise<void>;
    /** خطأٌ في العملية الرئيسة خارج القنوات — يُقال في شريط الأخطاء (المرحلة ٧). */
    onError(listener: (message: string) => void): () => void;
    /**
     * البرنامج يُغلق (خطة Production، ١٫٥): تُفرغ الواجهة ما لم يُحفظ ثم تقول `closeReady` — وإن
     * كانت نسخةٌ تلقائية (`backup`) قيل ذلك في الواجهة، فلا تُترك نافذةً معلّقة.
     */
    onClosing(listener: (info: { backup: boolean }) => void): () => void;
    /** الواجهة أفرغت ما لم يُحفظ: يمضي الإغلاق. وإن لم تقلها مضى بعد مهلة. */
    closeReady(): void;
    /** إغلاق النافذة كزرّ الإغلاق: على مرحلتيه (`window.close()` يُوجَّه إليه). */
    requestClose(): void;
    /**
     * اسم الشاشة التي فيها عملٌ لم يُحفظ ولا تحرسه مسودّةٌ (`null` إن لم يبقَ): فيسأل إغلاق البرنامج بنافذة ويندوز
     * «ابقَ أم أغلق بلا حفظ؟» قبل أن يبدأ (ج١).
     */
    setUnsaved(label: string | null): void;
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
  /** البحث الشامل فيما سوى الكتب: المواطنون والنماذج ونصّ المستمسكات. */
  search: {
    others(query: string): Promise<SearchHits>;
  };
  /** بطاقة التعبئة للمواقع الحكومية (هـ٦) — نافذةٌ صغيرة فوق المتصفّح. */
  fillCard: {
    open(citizenId: number): Promise<void>;
  };
  /** «التنبيهات» (د٧). */
  today: {
    agenda(): Promise<TodayAgenda>;
    /** فُتح الجرس: ملخّص الأسبوع رُئي — فلا نقطة عليه حتى الأسبوع القادم. */
    weekSeen(): Promise<void>;
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
    /** يرضى المكتب بالقرص الموصول الآن قرصَ النسخ بعد أن رُفض لأنّه غير الذي اعتُمد. */
    autoAdopt(): Promise<AutoBackupStatus>;
    /** الاسترجاع من مجلّد النسخة التلقائية — كالحزمة: يُفحص، ثم يُرى، ثم يُوافق عليه. */
    mirrorPick(): Promise<{ path: string; encrypted: boolean; lastAt: string | null; snapshots: MirrorSnapshot[] } | null>;
    /** `snapshot`: نسخة القاعدة المختارة من المجلّد — وبلا اختيارٍ آخرها. */
    mirrorInspect(path: string, password?: string | null, snapshot?: string | null): Promise<BackupSummary>;
    mirrorRestore(path: string, password?: string | null, snapshot?: string | null): Promise<{ summary: BackupSummary; aside: string }>;
  };
  /** التحديث «أ+»: ملفٌّ موقّعٌ من المطوّر — يُفحص ويُرى «ما الجديد» ثم يُثبَّت. ولا تحديث من الإنترنت. */
  update: {
    pick(): Promise<{ path: string; version: string; notes: string; size: number; issued: string; current: string } | null>;
    install(path: string): Promise<{ installer: string; launched: boolean }>;
    /** رُحّلت البيانات من إصدارٍ أقدم في هذا الإقلاع: «ما الجديد» بين الإصدارين — وإلا `null`. */
    whatsNew(): Promise<{ from: string; to: string } | null>;
  };
  /** التفعيل بلا شبكة: الحال، ومفتاحٌ يُلصق — كاملٌ أو تمديد — لهذا الجهاز وحده. */
  license: {
    status(fresh?: boolean): Promise<LicenseStatus>;
    activate(key: string): Promise<LicenseStatus>;
  };
  /**
   * حزمة المحتوى (خطة Production، ٤٫٣): النماذج والترويسات والكليشات وصورها — بلا بيانات الناس —
   * تُصدَّر ملفًّا وتُستورد في مكتبٍ آخر. والمكرّر يُعرف بمعرّفه فلا يُضاف ثانيةً.
   */
  content: {
    export(designs?: number[]): Promise<(ContentCounts & { path: string; leftOut?: { fonts: string[]; elements: string[] } }) | null>;
    import(): Promise<ContentImportResult | null>;
    bundled(): Promise<BundledPackInfo[]>;
    importBundled(id: string): Promise<ContentImportResult | null>;
  };
};
