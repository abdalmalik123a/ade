/**
 * أنواع الشبّاك المشتركة بين شاشته وأجزائها (تقسيم الشبّاك بعد ١٫٧٫٠).
 */
import type { Doc } from '@shared/doc';
import type { LetterheadLayout } from '@shared/letterhead';
import type { CitizenInput, TemplateDetail, TemplateSummary, InboxFile } from '@shared/api';
import type { Outcome } from '../../components/OutputBar';
import type { CounterCard } from '@shared/counterCards';
import type { InboxOpen } from '../../components/InboxPanel';

export type Step = 'pick' | 'fill' | 'review';

/** نموذجٌ مختار بتفاصيله ووثيقته وترويسته — يُحمَّل مرّةً عند الانتقال إلى «املأ». */
export type Loaded = {
  summary: TemplateSummary;
  detail: TemplateDetail;
  doc: Doc;
  layout: LetterheadLayout | null;
};

/** «نسخة عن …» (د٤): الكتاب الأصل، و«وأبطل الأصل» بسببه. */
export type RepeatOf = { id: number; serial: string; voidIt: boolean; reason: string };

/** طباعة ما صدر: كم أُرسل من كم، وأجاريةٌ أم توقّفت بسببها (خطة Production، ٢٫٣). */
export type PrintRun = { id?: string; sent: number; total: number; reason?: string; running: boolean };

/**
 * معاملةٌ معلّقة: زبونٌ ذهب ليجلب مستمسكًا، والمكتب يخدم غيره حتى يعود — ولو عاد غدًا:
 * تُحفظ في القاعدة فتبقى بعد إغلاق البرنامج (تعميق الموجود ٥). والنماذج بمعرّفاتها لا
 * بنسخها: تُحمَّل عند الاستئناف بآخر ما عُدّلت عليه.
 */
export type Parked = {
  key: number;
  label: string;
  step: Step;
  picked: number[];
  values: Record<string, string>;
  letterNo: string;
  citizenId: number | null;
  merge: boolean;
  names: string;
  valuesOnly: boolean;
  genderByHand: boolean;
};

/**
 * ما خرج الآن (ن٩): يُقال في شريطٍ بعد الطبع — وأين خرج، وبرقمه في السجلّ — ومنه «أعد الطبع»
 * و«شيءٌ آخر لنفس الزبون» (تعود قيمه إلى ورقة الإدخال للمختار التالي).
 */
export type AfterIssue = {
  outcome: Outcome;
  ids: number[];
  mode: 'full' | 'values';
  label: string;
  /** النسخ كما طُبعت — و«أعد الطبع» يعيدها بها. */
  copies: number;
  customer: { values: Record<string, string>; citizenId: number | null; genderByHand: boolean } | null;
};

/** زبونٌ صدرت له معاملةٌ ولا ملفّ له: يُعرض حفظه بما كُتب له، وتُربط به كتبه. */
export type NewCitizen = { transactionId: number; input: CitizenInput };

export type ServiceScreenProps = {
  onIssued?: () => void;
  /**
   * الشبّاك لا يُهدم حين يُترك: يبقى مركّبًا مخفيًّا فتبقى المعاملة كما تُركت —
   * كان الموظف يذهب إلى «المواطنين» ليتحقّق من رقمٍ فيعود إلى شاشةٍ فارغة.
   * و`active` يقول أهو المعروض: فيُعاد تحميل النماذج عند العودة، ولا يستجيب
   * لاختصاراته وهو مخفيّ.
   */
  active?: boolean;
  /** «كرّره» من الأرشيف: نماذج معاملةٍ صدرت وقيمها — تُفتح نسخةً جديدة للتعديل. */
  repeat?: RepeatRequest | null;
  /** بطاقةٌ تفتح أداةً (الصور، PDF، الأسئلة…) أو نافذة (استنساخ الهوية) — المرحلة ٢. ومعها الزبون
   * الواقف إن عُرف، فتقوله الأداة في رأسها وتحفظ في ملفّه (المرحلة ٥). */
  onOpenTool?: (target: CounterCard['target'], citizenId: number | null) => void;
  /** ملفٌّ من «الملفّات» يُفتح في أداته — ويُرفض بخطأٍ يقوله اللوح. */
  onOpenFile?: (file: InboxFile, as: InboxOpen) => Promise<void>;
  /** «افتح التفعيل» على رسالة انتهاء المدّة (د١٠): الشبّاك لا ينتقل بنفسه، فتُمرَّر من App. */
  onOpenActivation?: () => void;
  /** «استأنف» من قيد العمل: معاملةٌ معلّقة بمفتاحها (المرحلة ٣). */
  resumeRequest?: { key: number; parkedKey: number } | null;
  /** «شيءٌ آخر لنفس الزبون» من أداة: يعود الزبون، وتُملأ حقوله من ملفّه حين يُختار ما يريده. */
  customerRequest?: { key: number; citizenId: number } | null;
  /** إعدادات المكتب كما حفظها غيره (المعالج، الإعدادات) — تغيُّرها يُعيد قراءتها: بطاقات «ابدأ جاهزًا». */
  settingsKey?: unknown;
};

/** «كرّره»: نماذج كتابٍ صدر بقيمه — و`id` الكتاب الأصل، فيُبطَل إن اختار الموظف (د٤). */
export type RepeatRequest = { key: number; id: number; serial: string; templateIds: number[]; values: Record<string, string> };
