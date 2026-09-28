/**
 * تنبيهٌ خفيف على الرقم الوطني والهاتف (د١٣) — **تنبيهٌ لا منع**.
 *
 * البطاقة الوطنية الموحّدة رقمها ١٢ رقمًا؛ لكنّ هوية الأحوال القديمة وشهادة الجنسية
 * بأرقامٍ غيرها، والموظف أعلم بما بين يديه. فيُقال له ما لاحظه البرنامج بجانب الخانة.
 * والرقم الوطني يُحفظ أرقامًا لاتينية بلا شوائب (`canonicalNationalId`) — قرار المالك بعد
 * التدقيق المستقل: الموحّدة تُكتب لاتينيةً غالبًا، والموظف يحرّر قبل الطباعة.
 *
 * والهاتف العراقي المحمول: ١١ رقمًا تبدأ بـ«07» — أو بـ«+964» بلا الصفر.
 */
import { normalizeFold } from './arabic';

/** الأرقام وحدها — والهندية تُردّ لاتينية (٠١٢ ← 012). */
const digits = (v: string) => normalizeFold(v).replace(/\D/g, '');

/** علاماتٌ لا تُرى: اتجاه النصّ (LRM وRLM والتضمين والعزل) وعلامة ترتيب البايتات — يُلصقها النسخ من الواتساب والمواقع. */
const invisible = (code: number) =>
  code === 0x200e || code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069) || code === 0xfeff;
/** التطويل والتشكيل — تُرى أثرًا صغيرًا، ولا مكان لها في رقم. */
const marks = (code: number) => code === 0x640 || (code >= 0x64b && code <= 0x65f) || code === 0x670;
const isDigit = (ch: string) => /[0-9٠-٩۰-۹]/.test(ch);

/**
 * الرقم الوطني بصورته المحفوظة: أرقامٌ لاتينية وحدها — كما تُكتب البطاقة الموحّدة
 * غالبًا (قرار المالك). الهندية تُردّ لاتينية، والمسافات والشرطات والتطويل والتشكيل
 * والعلامات الخفيّة تُمحى. وما فيه حرفٌ (همزةٌ أو غيرها) لا يُخمَّن: يعود `null`
 * فيُحفظ كما كُتب ويبقى تنبيهه.
 *
 * وبه يُقارن الرقم في كشف التكرار وربط الكتاب بصاحبه: كان «١٩٩٩…» و«1999…» شخصين.
 */
export function canonicalNationalId(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  let out = '';
  for (const ch of v) {
    const code = ch.charCodeAt(0);
    if (isDigit(ch)) out += normalizeFold(ch);
    else if (ch.trim() === '' || ch === '-' || invisible(code) || marks(code)) continue;
    else return null;
  }
  return out || null;
}

/** تنبيه الرقم الوطني — أو عدم إن لم يُلحظ شيء. */
export function nationalIdHint(value: string | null | undefined): string | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  const d = digits(v);
  // كلّ ما سوى الأرقام والفواصل حرفٌ سها — ولو همزةً أو تطويلًا أو حركة: كانت تُطبَّع
  // قبل المقارنة فتُمحى منها، فيمرّ «199912345678ء» سليمًا. والخفيّ وحده يُسكت عنه:
  // لا يراه الموظف، ويُمحى عند الحفظ.
  const stray = [...v].some((ch) => !isDigit(ch) && ch.trim() !== '' && ch !== '-' && !invisible(ch.charCodeAt(0)));
  if (stray) return 'الرقم الوطني أرقامٌ فقط — أفيه حرفٌ سها؟';
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
