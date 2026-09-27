/**
 * الكتاب في المحرّر — ما يُحفظ منه وما يُفحص قبل إصداره، خالصًا بلا شاشة.
 *
 * المحرّر يؤلّف على الورقة نفسها بنموذج الكتل (`Doc`) كما يؤلّف مصمّم النماذج،
 * ويملأ حقوله كما يملؤها الشبّاك. وكان قبله نموذجًا آخر: متنًا نصّيًّا فيه
 * `{وسوم}` وحقولًا في قائمةٍ جانبية (`letterFields`) — والمسودات والكتب التي حُفظت
 * به تُقرأ هنا وتُرحَّل إلى الكتل، فلا يضيع منها سطر.
 */
import { docFromLegacy, docText, normalizeDoc, type Doc, type DocField } from './doc';
import { missingRequired } from './docHtml';
import { formatGregorian } from './dates';
import { normalizeLayout, type LetterheadLayout } from './letterhead';
import { legacyFieldMeta } from './template';
import { isChoiceKey } from './gender';

export type Registry = { number: string; dateGreg: string; dateHijri: string };
export const NO_REGISTRY: Registry = { number: '', dateGreg: '', dateHijri: '' };

export type SavedLetter = {
  doc: Doc;
  values: Record<string, string>;
  registry: Registry;
  layout: LetterheadLayout | null;
  docType: string;
  /** اسم صاحب العلاقة حين لا حقل للاسم على الورقة — للأرشيف وحده. */
  owner: string;
};

/** ما يُحفظ مع المسودة والكتاب الصادر: القيم، وبجانبها الورقة وترويستها بمفاتيح `__`. */
export function letterValues(letter: SavedLetter): Record<string, string> {
  return {
    ...letter.values,
    __doc: JSON.stringify(letter.doc),
    __letterhead: JSON.stringify(letter.layout),
    __registry: JSON.stringify(letter.registry),
    __docType: letter.docType,
    __owner: letter.owner
  };
}

type LegacyField = { token: string; label?: string; value?: string; role?: DocField['role']; source?: string | null };

/**
 * يقرأ ما حُفظ — بالصيغة الجديدة (`__doc`) أو القديمة (متنٌ وحقولٌ جانبية).
 *
 * والقديمة تُرحَّل كتلًا: «م /» سطرٌ في أوّل الورقة، ثم المتن بوسومه حقولًا، ثم
 * اسم الموقّع وصفته، ثم «نسخة منه إلى» — كما كانت تُرسم.
 */
export function readSavedLetter(raw: string | Record<string, unknown>): SavedLetter | null {
  let v: Record<string, unknown>;
  try {
    v = typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : raw;
  } catch {
    return null;
  }
  if (!v || typeof v !== 'object') return null;
  const str = (k: string) => (typeof v[k] === 'string' ? (v[k] as string) : '');
  const json = <T,>(k: string): T | null => {
    try {
      return str(k) ? (JSON.parse(str(k)) as T) : null;
    } catch {
      return null;
    }
  };
  const layoutRaw = json<unknown>('__letterhead');
  const layout = layoutRaw ? normalizeLayout(layoutRaw) : null;

  if (str('__doc')) {
    const values: Record<string, string> = {};
    for (const [k, val] of Object.entries(v)) if (!k.startsWith('__') && typeof val === 'string') values[k] = val;
    const reg = json<Partial<Registry>>('__registry') ?? {};
    return {
      doc: normalizeDoc(json<unknown>('__doc')),
      values,
      registry: { ...NO_REGISTRY, ...reg },
      layout,
      docType: str('__docType'),
      owner: str('__owner')
    };
  }

  // ── الصيغة القديمة ──
  const fields = json<LegacyField[]>('__fields') ?? [];
  const lines: string[] = [];
  if (str('subject')) lines.push(`م / ${str('subject')}`, '');
  lines.push(...str('body').split('\n'));
  if (str('signerName') || str('signerRole')) lines.push('', str('signerName'), str('signerRole'));
  const copies = str('copiesTo').split('\n').map((l) => l.trim()).filter(Boolean);
  if (copies.length) lines.push('', 'نسخة منه إلى :-', ...copies.map((c) => `- ${c}`));
  const doc = docFromLegacy(lines.join('\n'), legacyFieldMeta);
  // الحقول القديمة تحمل أسماءها ومصادرها وأدوارها — تُردّ إليها.
  doc.fields = doc.fields.map((f) => {
    const old = fields.find((o) => o.token === f.key);
    return old ? { ...f, label: old.label || f.label, role: old.role ?? f.role, source: old.source ?? f.source } : f;
  });
  const values: Record<string, string> = {};
  for (const f of fields) if (f.token && f.value) values[f.token] = f.value;
  const name = fields.find((f) => f.role === 'name')?.value ?? '';
  return {
    doc,
    values,
    registry: { number: str('serial'), dateGreg: str('dateGreg'), dateHijri: str('dateHijri') },
    layout,
    docType: str('docType'),
    owner: name
  };
}

/** حقل اسم صاحب العلاقة على الورقة — بدوره، أو بمصدره من السجل. */
export function nameFieldOf(doc: Doc): DocField | null {
  return doc.fields.find((f) => f.role === 'name') ?? doc.fields.find((f) => f.source === 'fullName') ?? null;
}

/**
 * «جرّبها»: قيمٌ وهمية للفارغ وحده — طويلةٌ عمدًا كأطول ما يُكتب، فيظهر الفراغ
 * القصير والسطر الزائد قبل الورق (FOUNDATION §١٠، البند ٤). ولا تُحفظ ولا تُصدر.
 */
export function sampleValues(fields: DocField[], values: Record<string, string>, today = new Date()): Record<string, string> {
  const out = { ...values };
  for (const f of fields) {
    if (out[f.key]?.trim() || isChoiceKey(f.key)) continue;
    const label = `${f.label} ${f.key}`;
    out[f.key] =
      f.role === 'name' || f.source === 'fullName'
        ? 'عبد الرحمن محمد عبد الكريم حسين الجبوري'
        : f.role === 'nationalId' || /الوطني|الموحد/.test(label)
          ? '199012345678'
          : /تاريخ/.test(label)
            ? formatGregorian(today)
            : /رقم|عدد|هاتف/.test(label)
              ? '٠٧٧٠١٢٣٤٥٦٧'
              : f.role === 'destination'
                ? 'وزارة التربية / المديرية العامة لتربية بغداد الرصافة الأولى'
                : `${f.label} (قيمةٌ تجريبية طويلة)`;
  }
  return out;
}

export type Check = {
  /** `block` يمنع الإصدار، و`warn` يُقال ولا يمنع، و`info` معلومة. */
  level: 'block' | 'warn' | 'info';
  text: string;
  /** زرٌّ يصلحه — الإملاء يفتح لوحته، والجنس يُختار في مكانه. */
  act?: 'spelling' | 'gender';
};

/**
 * قائمة التحقّق قبل الإصدار (FOUNDATION §٤ و§١٠، البند ٨).
 *
 * يمنع ما لا يصدر كتابٌ بدونه: اسم صاحب العلاقة (للأرشيف)، والمتن، والحقل
 * الإلزامي. ويقول ما يستحقّ النظر ولا يمنع: «م /» غائب — فليس كل كتابٍ بموضوع،
 * والمكتب مُنشئٌ لا جهة (§١) — والإملاء، والفارغ الذي سيُطبع فراغًا، وارتفاع
 * الترويسة، وعدد الصفحات.
 */
/**
 * كتابٌ ختم بخاتمته («مع التقدير»، «والاحترام»، «والسلام») ولا سطر بعدها قبل
 * «نسخة منه إلى»: بلا اسم موقّع (FOUNDATION §٤). وكتابٌ بلا خاتمة لا يُحكم عليه —
 * فالعريضة يوقّعها صاحبها، ولا يُخمَّن موقّعٌ من سطرٍ لا يُعرف.
 */
export function lacksSigner(text: string): boolean {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const copies = lines.findIndex((l) => /^نسخة\s+منه/.test(l));
  const body = copies >= 0 ? lines.slice(0, copies) : lines;
  let closing = -1;
  body.forEach((l, i) => {
    if (/(التقدير|الاحترام|والسلام|مع الشكر)\s*[.،]?\s*$/.test(l)) closing = i;
  });
  if (closing < 0) return false;
  return !body.slice(closing + 1).some((l) => l.length > 0);
}

export function letterChecks(input: {
  doc: Doc;
  values: Record<string, string>;
  owner: string;
  spelling: number;
  registryPrinted: boolean;
  number: string;
  /** نسبة ارتفاع الترويسة من الصفحة (٠..١) — أو لا قياس بعد. */
  headRatio: number | null;
  pages: number | null;
  /** اسمٌ لم يُعرف جنسه يقينًا والورقة تُذكّر وتؤنّث — يُسأل قبل الإصدار (ج٤). */
  genderUnsure?: string | null;
}): Check[] {
  const { doc, values } = input;
  const checks: Check[] = [];
  if (!input.owner.trim()) checks.push({ level: 'block', text: 'اسم صاحب العلاقة — يُقيَّد به الكتاب في الأرشيف' });
  if (!docText(doc).trim()) checks.push({ level: 'block', text: 'الورقة فارغة — لا يصدر كتابٌ بلا متن' });
  for (const f of missingRequired(doc, values)) {
    if (!isChoiceKey(f.key)) checks.push({ level: 'block', text: `«${f.label}» إلزاميٌّ وفارغ` });
  }
  if (input.genderUnsure) {
    checks.push({
      level: 'block',
      text: `«${input.genderUnsure}»: ذكرٌ أم أنثى؟ — الورقة تطبع «الطالب» أو «الطالبة» بحسبه، والاسم لا يكفي`,
      act: 'gender'
    });
  }

  const text = docText(doc, values);
  if (!/^\s*(م|الموضوع)\s*[/:]/m.test(text)) checks.push({ level: 'warn', text: 'لا سطر «م /» — أهو كتابٌ بلا موضوع؟' });
  if (lacksSigner(text)) checks.push({ level: 'warn', text: 'لا اسم موقّعٍ بعد الخاتمة — من يوقّع الكتاب؟' });
  if (input.spelling > 0) checks.push({ level: 'warn', text: `${input.spelling} تنبيهًا إملائيًّا في نصّ الكتاب`, act: 'spelling' });
  const empty = doc.fields.filter((f) => !f.required && !isChoiceKey(f.key) && !values[f.key]?.trim());
  if (empty.length) checks.push({ level: 'info', text: `${empty.length} حقلًا فارغًا يُطبع فراغًا منقوطًا يُملأ باليد` });
  if (input.registryPrinted && !input.number.trim()) checks.push({ level: 'info', text: 'العدد فارغ — يُطبع فراغًا تكتبه الجهة' });
  if (input.headRatio !== null) {
    const pct = Math.round(input.headRatio * 100);
    checks.push(
      pct > 35
        ? { level: 'warn', text: `الترويسة تشغل ${pct}٪ من الورقة — قد تدفع المتن إلى صفحةٍ ثانية` }
        : { level: 'info', text: `الترويسة تشغل ${pct}٪ من الورقة` }
    );
  }
  if (input.pages !== null && input.pages > 1) checks.push({ level: 'info', text: `الكتاب في ${input.pages} صفحات` });
  return checks;
}
