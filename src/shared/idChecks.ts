/**
 * تنبيهٌ خفيف على الرقم الوطني والهاتف (د١٣) — **تنبيهٌ لا منع**.
 *
 * البطاقة الوطنية الموحّدة رقمها ١٢ رقمًا؛ لكنّ هوية الأحوال القديمة وشهادة الجنسية
 * بأرقامٍ غيرها، والموظف أعلم بما بين يديه. فيُقال له ما لاحظه البرنامج بجانب الخانة،
 * ويُحفظ ما كتبه كما كتبه.
 *
 * والهاتف العراقي المحمول: ١١ رقمًا تبدأ بـ«07» — أو بـ«+964» بلا الصفر.
 */
import { normalizeFold } from './arabic';

/** الأرقام وحدها — والهندية تُردّ لاتينية (٠١٢ ← 012). */
const digits = (v: string) => normalizeFold(v).replace(/\D/g, '');

/** تنبيه الرقم الوطني — أو عدم إن لم يُلحظ شيء. */
export function nationalIdHint(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const d = digits(v);
  if (d.length !== normalizeFold(v).replace(/[\s-]/g, '').length) return 'الرقم الوطني أرقامٌ فقط — أفيه حرفٌ سها؟';
  if (d.length !== 12) return `الرقم الوطني الموحّد ١٢ رقمًا، وهذا ${d.length} — إن لم تكن هويةً قديمة فراجِعه`;
  return null;
}

/** الهاتف بصيغته المحلية «07XXXXXXXXX» إن عُرف — لا يُغيَّر ما كُتب، يُقترح. */
export function normalizePhone(value: string): string | null {
  let d = digits(value);
  if (d.startsWith('00964')) d = d.slice(5);
  else if (d.startsWith('964')) d = d.slice(3);
  if (d.length === 10 && d.startsWith('7')) d = `0${d}`;
  return /^07\d{9}$/.test(d) ? d : null;
}

/** تنبيه الهاتف — أو عدم. */
export function phoneHint(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (normalizePhone(v)) return null;
  // الهاتف الأرضي في بغداد «01…» وفي المحافظات بأرقامها — لا يُنبَّه عليه إن طال.
  const d = digits(v);
  if (/^0[1-6]\d{6,}$/.test(d)) return null;
  return 'رقم المحمول العراقي ١١ رقمًا يبدأ بـ07 — أو +964 بلا الصفر';
}

/** رقم المحمول بصيغة الواتساب الدولية (+964…) — لرسالة «طلبكم جاهز». */
export function internationalPhone(value: string): string | null {
  const local = normalizePhone(value);
  return local ? `+964${local.slice(1)}` : null;
}
