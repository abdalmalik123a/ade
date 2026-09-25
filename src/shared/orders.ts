/**
 * الطلبات والجهات — أنواعٌ مشتركة بين العملية الرئيسية والواجهة.
 *
 * **الجهة** زبونٌ دائم: مدرسة، دائرة، شركة. لها شعارٌ ولون وهاتف وعنوان، ولها
 * ترويساتها وتصاميمها وطلباتها. فالمكتب لا يعيد اختيار الشعار في كل مرّة.
 *
 * **الطلب** ما يُطلب اليوم ويُسلَّم لاحقًا. **ولا مبالغ فيه عمدًا**: ديوان أداة
 * إنتاج لا دفتر حسابات (قرار المالك) — والمال مرحلةٌ بعيدة إن جاءت.
 */

export type OrderStatus = 'new' | 'waiting' | 'working' | 'ready' | 'delivered' | 'cancelled';

export type StatusInfo = { key: OrderStatus; label: string; hint: string; next: OrderStatus | null; verb: string };

/** السلسلة بترتيبها — والفعل الذي ينقل إلى التالية كما يقوله الموظف. */
export const STATUSES: StatusInfo[] = [
  { key: 'new', label: 'جديد', hint: 'استُلم ولم يبدأ', next: 'working', verb: 'ابدأ العمل' },
  { key: 'waiting', label: 'بانتظار الزبون', hint: 'تنقص صورٌ أو قائمة أو تأكيد', next: 'working', verb: 'وصل ما ينقص' },
  { key: 'working', label: 'قيد العمل', hint: 'يُصمَّم أو يُطبع', next: 'ready', verb: 'جاهز' },
  { key: 'ready', label: 'جاهز للتسليم', hint: 'مطبوعٌ ينتظر صاحبه', next: 'delivered', verb: 'سُلِّم' },
  { key: 'delivered', label: 'سُلِّم', hint: '', next: null, verb: '' },
  { key: 'cancelled', label: 'أُلغي', hint: '', next: null, verb: '' }
];

export const OPEN_STATUSES: OrderStatus[] = ['new', 'waiting', 'working', 'ready'];

export const statusOf = (key: string): StatusInfo => STATUSES.find((s) => s.key === key) ?? STATUSES[0]!;

export const isOrderStatus = (v: unknown): v is OrderStatus => STATUSES.some((s) => s.key === v);

export type Client = {
  id: number;
  name: string;
  /** مدرسة، دائرة، شركة… يسمّيها المكتب ولا قائمة مفروضة. */
  kind: string | null;
  phone: string | null;
  address: string | null;
  /** لونٌ اختاره المكتب — وبغيره يُستخرج من الشعار. */
  color: string | null;
  notes: string | null;
  /** مسار الشعار في المخزن — شعارٌ مربوطٌ بالجهة. */
  logo: string | null;
  letterheads: number;
  openOrders: number;
};

export type ClientInput = {
  id: number | null;
  name: string;
  kind?: string | null;
  phone?: string | null;
  address?: string | null;
  color?: string | null;
  notes?: string | null;
};

export type Order = {
  id: number;
  clientId: number | null;
  /** اسم الجهة إن كانت، وإلا اسم الزبون الفرد. */
  customer: string;
  clientLogo: string | null;
  phone: string | null;
  title: string;
  quantity: number | null;
  dueDate: string | null;
  status: OrderStatus;
  notes: string | null;
  templateId: number | null;
  templateTitle: string | null;
  batchText: string | null;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
};

export type OrderInput = {
  id: number | null;
  clientId: number | null;
  customer?: string | null;
  phone?: string | null;
  title: string;
  quantity?: number | null;
  dueDate?: string | null;
  status?: OrderStatus;
  notes?: string | null;
  templateId?: number | null;
  batchText?: string | null;
};

export type OrderCounts = { open: number; dueToday: number; overdue: number };

/**
 * قرب الموعد بكلام الموظف: «متأخّر يومين»، «اليوم»، «غدًا»، «بعد ٤ أيام».
 * `today` وسيطٌ لا ساعة النظام — فيُختبر بلا تاريخٍ متحرّك.
 */
export function dueLabel(due: string | null, today: string): { text: string; tone: 'late' | 'today' | 'soon' | 'later' | 'none' } {
  if (!due) return { text: 'بلا موعد', tone: 'none' };
  const d = Math.round((Date.parse(`${due}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (Number.isNaN(d)) return { text: due, tone: 'none' };
  if (d < 0) return { text: d === -1 ? 'متأخّر يومًا' : d === -2 ? 'متأخّر يومين' : `متأخّر ${-d} أيام`, tone: 'late' };
  if (d === 0) return { text: 'اليوم', tone: 'today' };
  if (d === 1) return { text: 'غدًا', tone: 'soon' };
  if (d === 2) return { text: 'بعد غد', tone: 'soon' };
  return { text: `بعد ${d} أيام`, tone: 'later' };
}

/** تاريخ اليوم محليًّا YYYY-MM-DD — لا بالتوقيت العالمي، فالمكتب في بغداد لا في غرينتش. */
export function localToday(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}
