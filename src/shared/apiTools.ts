/**
 * عقد الجسر — باب الأدوات (المحادثة ٦، البند ٢٨): الإخراج والطباعة الكبيرة، والملفّات الواصلة ومحرّر PDF،
 * والصور والكاميرا والتصاميم والملفّات — أنواعها وقنواتها. ويُستورد كلّه من `@shared/api` كما كان.
 */
import type { LetterheadLayout } from './letterhead';
import type { Doc } from './doc';
import type { FormFieldInfo, PdfPlan, Rotation } from './pdfEdit';
import type { PhotoPreset } from './photoPresets';
import type { CustomSuit } from './suits';
import type { ImportedTemplate, InboxFile } from './apiTemplates';

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

/** قنوات باب الأدوات في `window.diwan`. */
export type ToolApis = {
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
    savePng300(payload: { sheetHtml: string; suggestedName: string; page?: { w: number; h: number } }): Promise<string | null>;
    /** التصميم صورةً PNG أو JPG أو PNG شفّافة (DESIGNS.md ١٫٨) — بمقاسه بالملّم ودقّته (٩٦ للشاشة، ٣٠٠ للطباعة). */
    saveImage(payload: { sheetHtml: string; suggestedName: string; page: { w: number; h: number }; dpi: number; format: 'png' | 'jpg'; transparent?: boolean }): Promise<string | null>;
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
  /**
   * «الملفّات» في الشبّاك: ما وصل من التنزيلات وسطح المكتب والمستندات وواتساب والفلاشة، وما أُفلت
   * على منطقته — ويُفتح كلٌّ في أداته.
   */
  inbox: {
    list(): Promise<InboxFile[]>;
    /** ملفّاتٌ أُفلتت على منطقة الإفلات — ما يُفتح منها في ديوان. */
    adopt(files: File[]): Promise<InboxFile[]>;
    openPdf(ids: string[]): Promise<{ opened: PdfOpened[]; failed: { name: string; error: string }[] }>;
    importWord(id: string): Promise<ImportedTemplate>;
    /** الصورة إلى مخزن الصور الشخصية — ومسارها فيه. */
    toPhotos(id: string): Promise<string>;
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
  /** صورة المعاملة: فصل الشخص عن خلفيّته على الجهاز، وقوالب المكتب، وقاطه. */
  photos: {
    modelReady(): Promise<boolean>;
    /** صورة الحافظة محفوظةً في المخزن — ومسارها، أو `null` إن لم تكن فيها صورة. */
    clipboardImage(): Promise<string | null>;
    /** الشخص مفصولًا: قناعه (بايتٌ لكلّ بكسل) وألوانه بلا هالة الخلفية — بمقاس ما أُرسل. */
    cutout(input: { pixels: Uint8Array; width: number; height: number }): Promise<{ alpha: Uint8Array; pixels: Uint8Array; ms: number }>;
    /** الشيء مفصولًا (المنتج والشعار في التصاميم، DESIGNS.md ٢٫٣) — بالصيغة نفسها، بنموذج الأشياء. */
    cutoutObject(input: { pixels: Uint8Array; width: number; height: number }): Promise<{ alpha: Uint8Array; pixels: Uint8Array; ms: number }>;
    presets(): Promise<PhotoPreset[]>;
    savePreset(preset: PhotoPreset): Promise<PhotoPreset[]>;
    deletePreset(id: string): Promise<PhotoPreset[]>;
    suits(): Promise<CustomSuit[]>;
    /** «استورد قاطًا»: PNG شفّافة — ويُقال سبب الرفض. `null` إن أُلغي الاختيار. */
    importSuit(): Promise<CustomSuit | null>;
    deleteSuit(id: string): Promise<CustomSuit[]>;
  };
  /** استوديو التصوير: حفظ اللقطة، ومراقبة مجلّد الكاميرا الاحترافية. */
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
    /** يحذف المسوح العابرة (`tmp/…`) حين يُغلق الحوار الذي مسحها — وغيرها يُتجاهل. */
    discardTransient(paths: string[]): Promise<number>;
    pickImage(bucket: string): Promise<string | null>;
    /** صورةٌ أُلصقت محفوظةً في المخزن — ومسارها، أو `null` إن لم تكن صورةً معروفة. */
    storeImage(bytes: Uint8Array): Promise<string | null>;
    /** صورةٌ في نصٍّ لُصق من Word (ملفٌّ مؤقّت) محفوظةً في المخزن، أو `null`. */
    storeImageUrl(url: string): Promise<string | null>;
    /** مجلد صورٍ لدفعة — لكلٍّ اسمُ ملفّه بلا امتداد، وعليه يُطابَق بصفّه. */
    pickImageFolder(bucket: string): Promise<{ name: string; src: string }[] | null>;
    /** قائمةٌ من ملف Excel أو CSV — نصًّا بأعمدةٍ مفصولة بالجدولة، كما لو أُلصقت؛ وللإمساكية PDF أيضًا (بايتاتٍ، ٣٫٤). */
    readSheet(what?: 'imsakiya'): Promise<{ name: string; text: string; rows: number; pdf?: Uint8Array } | null>;
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
