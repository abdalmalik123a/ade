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

/** من نصّ القارئ إلى الحقول — أو عدم إن لم تُوجد سطورٌ ثلاث. */
export function readMrz(text: string): MrzResult | null {
  const lines = findTD1(text);
  return lines ? parseTD1(lines) : null;
}
