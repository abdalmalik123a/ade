/**
 * بطاقات الشبّاك (خطّة الترقية، المرحلة ٢ — قرار ٣ تشرين الأول، ن١): الشبّاك يبدأ بالغرض — «ماذا يريد
 * الزبون؟» — فالأدوات التي كانت أقسامًا في الشريط بطاقاتٌ فيه، بترتيبٍ ثابت يضبطه المكتب من الإعدادات:
 * يُخفي ما لا يقدّمه ويقدّم ما يكثر. ولا ترتيب يتعلّم من الاستعمال: ما يُحفظ مكانه لا يُكتشف.
 *
 * والكتب والمعاملات لا بطاقة لها: هي نماذج المكتبة تحت البطاقات، يُختار منها ويُبحث فيها.
 */
import type { RouteKey } from './routes';
import { normalizeFold } from './arabic';

export type CounterCardId = 'blank' | 'photos' | 'pdf' | 'id-copy' | 'id-sheet' | 'papers' | 'designs' | 'order';

export type CounterCard = {
  id: CounterCardId;
  label: string;
  hint: string;
  icon: string;
  /** كلماتٌ يقولها الزبون فيجدها البحث: «جواز» للصور، «بي دي اف» لـPDF. */
  words: string[];
  /** شاشةٌ تُفتح، أو نافذةٌ في مكانها (استنساخ الهوية). */
  target: { route: RouteKey } | { dialog: 'id-copy' | 'id-sheet' };
};

export const COUNTER_CARDS: readonly CounterCard[] = [
  { id: 'photos', label: 'صور شخصية', hint: 'بالمقاس والخلفية، ونسخٌ على ورقة', icon: 'portrait', words: ['صور', 'صورة', 'شخصية', 'جواز', 'فيزا', 'خلفية'], target: { route: 'photos' } },
  { id: 'id-copy', label: 'استنساخ هوية', hint: 'الوجه والظهر بمقاسه الحقيقي', icon: 'contact_page', words: ['هوية', 'بطاقة', 'استنساخ', 'نسخ', 'وطنية', 'سكن'], target: { dialog: 'id-copy' } },
  { id: 'pdf', label: 'ملفات PDF', hint: 'تعديلٌ وتجهيزٌ للرفع', icon: 'picture_as_pdf', words: ['pdf', 'بي دي اف', 'رفع', 'ضغط', 'دمج', 'تقسيم', 'ملف'], target: { route: 'pdf' } },
  { id: 'blank', label: 'كتابٌ على ورقة فارغة', hint: 'اكتب كما في Word', icon: 'edit_document', words: ['كتاب', 'ورقة', 'فارغة', 'وورد', 'word', 'طباعة'], target: { route: 'editor' } },
  { id: 'id-sheet', label: 'المستمسكات على ورقة', hint: 'الوطنية والسكن، كلٌّ بمقاسه', icon: 'document_scanner', words: ['مستمسكات', 'هويات', 'بطاقات', 'سكن', 'وطنية'], target: { dialog: 'id-sheet' } },
  { id: 'papers', label: 'ورقة أسئلة', hint: 'امتحانٌ بنموذجين', icon: 'quiz', words: ['أسئلة', 'اسئلة', 'امتحان', 'شهري', 'نموذج'], target: { route: 'papers' } },
  { id: 'designs', label: 'شهادات وتصاميم', hint: 'تقدير، هوية طالب، بطاقة', icon: 'workspace_premium', words: ['شهادة', 'شهادات', 'تصميم', 'تقدير', 'هوية طالب', 'بطاقة'], target: { route: 'designs' } },
  { id: 'order', label: 'طلبٌ يُسلَّم لاحقًا', hint: 'يُكتب في قيد العمل بموعده', icon: 'schedule', words: ['طلب', 'لاحقا', 'لاحقًا', 'موعد', 'تسليم'], target: { route: 'orders' } }
];

const IDS = new Set<string>(COUNTER_CARDS.map((c) => c.id));

/** الأقسام التي أخفاها مكتبٌ من الشريط القديم — تُخفى بطاقاتها أوّل مرّة، فلا يعود إليه ما أخفاه. */
const FROM_SECTION: Partial<Record<RouteKey, CounterCardId>> = {
  photos: 'photos',
  pdf: 'pdf',
  papers: 'papers',
  designs: 'designs',
  orders: 'order',
  editor: 'blank'
};

/**
 * البطاقات الظاهرة بترتيبها. المحفوظ كما هو إن صحّ (بلا مجهولٍ ولا مكرَّر)؛ وبغيره الافتراض —
 * إلا ما أخفاه المكتب قسمًا في الإصدار السابق.
 */
export function normalizeCounterCards(raw: unknown, hiddenSections: readonly RouteKey[] = []): CounterCardId[] {
  if (Array.isArray(raw)) {
    const out: CounterCardId[] = [];
    for (const v of raw) if (typeof v === 'string' && IDS.has(v) && !out.includes(v as CounterCardId)) out.push(v as CounterCardId);
    return out;
  }
  const hidden = new Set(hiddenSections.map((k) => FROM_SECTION[k]).filter(Boolean));
  return COUNTER_CARDS.map((c) => c.id).filter((id) => !hidden.has(id));
}

/** البطاقة تطابق ما كتبه الموظف: في اسمها أو كلماتها، مطويًّا (الهمزة والتاء المربوطة). */
export function cardMatches(card: CounterCard, query: string): boolean {
  const q = normalizeFold(query.trim());
  if (!q) return true;
  return [card.label, card.hint, ...card.words].some((w) => normalizeFold(w).includes(q) || q.includes(normalizeFold(w)));
}
