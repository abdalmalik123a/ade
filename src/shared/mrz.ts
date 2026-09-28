/**
 * قراءة ظهر البطاقة (هـ٧) — سطور MRZ بمعيار ICAO 9303.
 *
 * البطاقة الوطنية الموحّدة بمقاس ID-1، وظهرها ثلاثة أسطرٍ من ٣٠ حرفًا (TD1): رقم
 * الوثيقة، والرقم الشخصي، والولادة، والجنس، والنفاذ، والاسم بالحروف اللاتينية — ولكلّ
 * حقلٍ رقمُ تحقّق. فلا يُقبل حرفٌ أخطأ فيه القارئ: الرقم الذي لا يطابق تحقّقه يُقال.
 *
 * **ويُتحقَّق ببطاقةٍ حقيقية قبل أن يُعتمد** (قرار المالك): المعيار معروف، أمّا أين
 * يضع العراق الرقم الوطني في الحقول الاختيارية فيُرى على بطاقة.
 */

const VALUE = (c: string): number => {
  if (c === '<') return 0;
  if (c >= '0' && c <= '9') return c.charCodeAt(0) - 48;
  if (c >= 'A' && c <= 'Z') return c.charCodeAt(0) - 55;
  return -1;
};

/** رقم التحقّق: الأوزان ٧ ٣ ١ على التوالي، والمجموع باقي القسمة على ١٠. */
export function checkDigit(s: string): number {
  let sum = 0;
  for (let i = 0; i < s.length; i++) {
    const v = VALUE(s[i]!);
    if (v < 0) return -1;
    sum += v * [7, 3, 1][i % 3]!;
  }
  return sum % 10;
}

const ok = (field: string, digit: string) => /\d/.test(digit) && checkDigit(field) === Number(digit);

/** ‎YYMMDD‎ ← ‎YYYY-MM-DD‎. والقرن: ما جاوز السنة الجارية (+١٠ للنفاذ) فللقرن الماضي. */
function mrzDate(s: string, future: boolean): string | null {
  if (!/^\d{6}$/.test(s)) return null;
  const yy = Number(s.slice(0, 2));
  const now = new Date().getFullYear() % 100;
  const century = future ? (yy <= now + 30 ? 2000 : 1900) : yy <= now ? 2000 : 1900;
  const m = Number(s.slice(2, 4));
  const d = Number(s.slice(4, 6));
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${century + yy}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
}

const clean = (s: string) => s.replace(/</g, ' ').trim().replace(/\s+/g, ' ');

export type MrzResult = {
  format: 'TD1';
  documentCode: string;
  issuer: string;
  documentNumber: string;
  /** الحقل الاختياري الأول — وفيه الرقم الشخصي في كثيرٍ من البطاقات. */
  optional1: string;
  birthDate: string | null;
  sex: 'ذكر' | 'أنثى' | null;
  expiryDate: string | null;
  nationality: string;
  optional2: string;
  surname: string;
  givenNames: string;
  checks: { documentNumber: boolean; birthDate: boolean; expiryDate: boolean; composite: boolean };
  /** كلّ أرقام التحقّق صحيحة — فالقراءة موثوقة. */
  valid: boolean;
};

/** ثلاثة أسطرٍ من ٣٠ حرفًا ← حقولها وتحقّقها. */
export function parseTD1(lines: string[]): MrzResult | null {
  if (lines.length !== 3 || lines.some((l) => l.length !== 30)) return null;
  const [l1, l2, l3] = lines as [string, string, string];
  const docNumber = l1.slice(5, 14);
  const composite = l1.slice(5, 30) + l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const [surname, given = ''] = l3.split('<<');
  const checks = {
    documentNumber: ok(docNumber, l1[14]!),
    birthDate: ok(l2.slice(0, 6), l2[6]!),
    expiryDate: ok(l2.slice(8, 14), l2[14]!),
    composite: ok(composite, l2[29]!)
  };
  return {
    format: 'TD1',
    documentCode: clean(l1.slice(0, 2)),
    issuer: clean(l1.slice(2, 5)),
    documentNumber: clean(docNumber),
    optional1: clean(l1.slice(15, 30)),
    birthDate: mrzDate(l2.slice(0, 6), false),
    sex: l2[7] === 'M' ? 'ذكر' : l2[7] === 'F' ? 'أنثى' : null,
    expiryDate: mrzDate(l2.slice(8, 14), true),
    nationality: clean(l2.slice(15, 18)),
    optional2: clean(l2.slice(18, 29)),
    surname: clean(surname ?? ''),
    givenNames: clean(given),
    checks,
    valid: Object.values(checks).every(Boolean)
  };
}

/**
 * سطور MRZ من نصّ القارئ الضوئي: القارئ يرى «<» ««» أو «K»، ويُدخل مسافات، ويخلط
 * O بـ0 في الأرقام. فتُنظَّف السطور، ويؤخذ ما يشبه السطور الثلاثة، ويُصحَّح ما في
 * مواضع الأرقام — ثم يحكم رقم التحقّق.
 */
export function findTD1(text: string): string[] | null {
  const candidates = text
    .toUpperCase()
    .split(/\r?\n/)
    .map((l) => l.replace(/[«‹]/g, '<').replace(/\s+/g, '').replace(/[^A-Z0-9<]/g, ''))
    .filter((l) => l.length >= 26 && l.length <= 34 && (l.match(/</g) ?? []).length >= 2);
  for (let i = 0; i + 2 < candidates.length; i++) {
    const lines = candidates.slice(i, i + 3).map((l) => (l.length >= 30 ? l.slice(0, 30) : l.padEnd(30, '<')));
    if (!/^[AIC][A-Z<]/.test(lines[0]!)) continue;
    // مواضع الأرقام في السطر الثاني: الولادة وتحقّقها، والنفاذ وتحقّقه، والتحقّق الجامع.
    const digitsAt = [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 29];
    const l2 = lines[1]!.split('');
    for (const p of digitsAt) l2[p] = toDigit(l2[p]!);
    lines[1] = l2.join('');
    return lines;
  }
  return null;
}

const toDigit = (c: string) => ({ O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' })[c] ?? c;
const toLetter = (c: string) => ({ '0': 'O', '1': 'I', '2': 'Z', '5': 'S', '6': 'G', '8': 'B' })[c] ?? c;

/** من نصّ القارئ إلى الحقول — أو عدم إن لم تُوجد سطورٌ ثلاث. */
export function readMrz(text: string): MrzResult | null {
  const lines = findTD1(text);
  return lines ? parseTD1(lines) : null;
}

// ── القارئ الخاصّ (تعميق الموجود ٨) ──────────────────────────────────────
//
// جُرِّب القارئ العامّ على نسخةٍ حقيقية فلم يقرأ السطور: العربيّ على الصفحة كلّها يخلطها،
// والإنكليزيّ يرى «<» حرفَ C أو L أو K ويُسقط بعضها. فالقارئ الخاصّ (`main/services/mrzRead`)
// يجد السطور من الصورة، ويقرؤها رموزًا بمواضعها، ثم هنا: كلّ رمزٍ في خانته من موضعه (الخطّ
// متساوي العرض)، و«<» من شكله، والملتبس (O و0، S و5…) تحسمه أرقام التحقّق.

/** رمزٌ من القارئ بموضعه — و`chevron` إن رآه فحصُ الشكل «<» (بلا ساقٍ يسرى). */
export type MrzSymbol = { text: string; x0: number; x1: number; chevron?: boolean };

/**
 * السطر بخاناته الثلاثين: خانة كلّ رمزٍ من موضعه لا من ترتيبه — فما أسقطه القارئ (وأكثره
 * «<») يبقى «<»، ولا ينزاح ما بعده.
 */
export function slotLine(symbols: MrzSymbol[], left: number, right: number, n = 30): string {
  const pitch = (right - left) / n;
  const slots: string[] = Array(n).fill('<');
  const taken: boolean[] = Array(n).fill(false);
  for (const s of symbols) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(((s.x0 + s.x1) / 2 - left) / pitch)));
    if (taken[i]) continue;
    taken[i] = true;
    const ch = (s.text[0] ?? '<').toUpperCase();
    slots[i] = s.chevron ? '<' : /[A-Z0-9<]/.test(ch) ? ch : '<';
  }
  return slots.join('');
}

/**
 * يحسم الملتبس في الحقلين اللذين يقبلان حرفًا أو رقمًا: رقم الوثيقة والحقل الاختياري.
 *
 * كان بحثًا في صور الحقل كلّها بتبديل الملتبس (O و0، I و1…) حتى يطابق رقم التحقّق — فوجد
 * لرمزٍ أسقطه القارئ صورةً تطابق مصادفةً في كلّ مرّة تقريبًا (رقم التحقّق عُشريّ، والصور مئات)
 * فقال عن قراءةٍ خاطئة إنّها «تحقّقت». فالآن صورةٌ واحدة من شكل البطاقة العراقية كما قُرئت
 * حقيقيةً (٢٨ أيلول ٢٠٢٦): رقم الوثيقة حرفٌ وثمانية أرقام، والحقل الاختياري الرقم الشخصي
 * (١٢ رقمًا) ثمّ «<». تُعتمد إن طابقت هي ولم تطابق القراءة — وغيرها يبقى كما قُرئ.
 */
export function solveTD1(lines: string[]): string[] {
  const [l1, l2, l3] = lines as [string, string, string];
  const iraqi = l1.slice(2, 5) === 'IRQ';
  const docCheck = toDigit(l1[14]!);
  const pick = (read: string, shaped: string, good: (v: string) => boolean) => (!good(read) && iraqi && good(shaped) ? shaped : read);
  const docRead = l1.slice(5, 14);
  const doc = pick(docRead, toLetter(docRead[0]!) + [...docRead.slice(1)].map(toDigit).join(''), (v) => ok(v, docCheck));
  const rest = l2.slice(0, 7) + l2.slice(8, 15) + l2.slice(18, 29);
  const optRead = l1.slice(15, 30);
  const opt = pick(optRead, [...optRead].map((c, i) => (i < 12 ? toDigit(c) : c)).join(''), (v) => ok(doc + docCheck + v + rest, l2[29]!));
  return [l1.slice(0, 5) + doc + docCheck + opt, l2, l3];
}

/**
 * سطورٌ ثلاث من رموز القارئ ← السطور بخاناتها، مصحَّحةً بما يعرفه المعيار: خاناتٌ لا تكون
 * إلّا أرقامًا (التواريخ وأرقام التحقّق)، وأخرى لا تكون إلّا حروفًا (نوع الوثيقة والدولة
 * والجنس والجنسية والأسماء)، والملتبس في غيرها تحسمه أرقام التحقّق.
 */
export function settleTD1(raw: { symbols: MrzSymbol[]; left: number; right: number }[]): string[] | null {
  if (raw.length < 3) return null;
  const lines = raw.slice(0, 3).map((r) => slotLine(r.symbols, r.left, r.right));
  lines[0] = [...lines[0]!].map((c, p) => (p < 5 ? toLetter(c) : c)).join('');
  if (!/^[AIC][A-Z<]/.test(lines[0]!)) return null;
  const l2 = lines[1]!.split('');
  for (const p of [0, 1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 29]) l2[p] = toDigit(l2[p]!);
  for (const p of [7, 15, 16, 17]) l2[p] = toLetter(l2[p]!);
  lines[1] = l2.join('');
  lines[2] = [...lines[2]!].map(toLetter).join('');
  return solveTD1(lines);
}

/** سطورٌ ثلاث من رموز القارئ ← الحقول بتحقّقها. */
export function readMrzSymbols(raw: { symbols: MrzSymbol[]; left: number; right: number }[]): MrzResult | null {
  const lines = settleTD1(raw);
  return lines ? parseTD1(lines) : null;
}
