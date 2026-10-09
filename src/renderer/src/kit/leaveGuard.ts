/**
 * «اترك بلا حفظ؟» (ج١) — سجلّ الشاشات التي فيها عملٌ لا تحرسه مسودّةٌ ولا معلّقة.
 *
 * ما يحرسه الحفظ والاستئناف القائمان — مسودّة المحرّر ومسودّة التصاميم (حفظٌ تلقائيّ وعند المغادرة والإغلاق)، والمعاملة المعلّقة في
 * الشبّاك (تُعلَّق عند الإغلاق)، وسجلّ الطباعة والدفعات (يستأنف بعد انقطاع الكهرباء) — **لا يُسجَّل هنا ولا يُسأل
 * عنه** (قرار المالك ٨ ت١). وما سواه — الأسئلة، والترويسة، وجلسة PDF، والمصمّم — تسجّل نفسها بـ`useLeaveGuard`.
 *
 * المخارج: الانتقال في الشريط (`canLeaveAll` من `App.navigate`)، وما يستبدل العمل داخل الشاشة نفسها
 * (`confirmLeave` لشاشتها)، وإغلاق البرنامج (`unsavedLabel` يصل العملية الرئيسة فتسأل بنافذة ويندوز).
 *
 * وهذا الملف بلا React ولا نافذة: يُختبر في الوحدة.
 */
import { ask, type AskOptions } from './ask';

export type LeaveGuard = {
  /** كيف تُسمّى الشاشة في السؤال: «الترويسة». */
  label: string;
  isDirty: () => boolean;
  /** يحفظ ما في الشاشة؛ `true` إن نجح. وغيابه يعني: لا زرّ «احفظ» في السؤال. */
  save?: () => Promise<boolean>;
};

type Asker = <K extends string>(options: AskOptions<K>) => Promise<K>;

const guards = new Set<LeaveGuard>();
const listeners = new Set<(label: string | null) => void>();
let lastLabel: string | null = null;

/** أوّل شاشةٍ فيها عملٌ لم يُحفظ — وهو ما يُقال في نافذة إغلاق البرنامج. */
export function unsavedLabel(): string | null {
  for (const g of guards) if (g.isDirty()) return g.label;
  return null;
}

/** حالة الحفظ تغيّرت: يُبلَّغ من يسمع (العملية الرئيسة) بما تغيّر وحده. */
export function touchGuards(): void {
  const next = unsavedLabel();
  if (next === lastLabel) return;
  lastLabel = next;
  for (const listener of listeners) listener(next);
}

/** من يسمع تغيّر «ما لم يُحفظ». */
export function onUnsavedLabel(listener: (label: string | null) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** تسجيل شاشة، ويعود ما يلغيه عند مغادرتها. */
export function addGuard(guard: LeaveGuard): () => void {
  guards.add(guard);
  touchGuards();
  return () => {
    guards.delete(guard);
    touchGuards();
  };
}

/**
 * يُسأل الموظف عن شاشةٍ واحدة: احفظ · اترك بلا حفظ · ابقَ. `true` يعني أنّ المغادرة مأذونة.
 * وحفظٌ تعثّر (أو رمى) يُبقيه حيث هو — لا يغادر بعملٍ ظنّه محفوظًا.
 */
export async function confirmLeave(guard: LeaveGuard, askUser: Asker = ask): Promise<boolean> {
  if (!guard.isDirty()) return true;
  const choices = [
    { key: 'stay', label: 'ابقَ', tone: 'neutral' as const },
    { key: 'discard', label: 'اترك بلا حفظ', tone: 'danger' as const },
    ...(guard.save ? [{ key: 'save', label: 'احفظ ثم اترك', tone: 'primary' as const }] : [])
  ];
  const answer = await askUser({
    title: `في «${guard.label}» تعديلاتٌ لم تُحفظ`,
    message: 'إن غادرت الآن ضاعت.',
    choices,
    fallback: 'stay'
  });
  if (answer === 'discard') return true;
  if (answer !== 'save' || !guard.save) return false;
  try {
    return await guard.save();
  } catch {
    return false;
  }
}

let leaving: Promise<boolean> | null = null;

/** هل تُغادَر الشاشة الحاضرة؟ يُسأل عن كلّ شاشةٍ فيها عملٌ لم يُحفظ، ويقف عند أوّل «ابقَ». نقرتان معًا سؤالٌ واحد. */
export function canLeaveAll(askUser: Asker = ask): Promise<boolean> {
  if (leaving) return leaving;
  const run = (async () => {
    for (const g of [...guards]) if (!(await confirmLeave(g, askUser))) return false;
    return true;
  })();
  // يُسجَّل قبل أن يُمحى: لو انتهى التشغيل بلا انتظارٍ (لا حرّاس) لبقي وعدٌ منتهٍ يُجيب كلّ نداءٍ لاحق.
  leaving = run;
  void run.finally(() => {
    if (leaving === run) leaving = null;
  });
  return run;
}

/** هل في أيّ شاشةٍ عملٌ لم يُحفظ؟ فلا يتأخّر الانتقال العادي لحظةً بلا داعٍ. */
export function hasUnsaved(): boolean {
  return unsavedLabel() !== null;
}
