/**
 * محرّك الفراغات: أن يُحيي الملف لا أن ينسخه.
 *
 * المتغيّرات في ملفات المكتب هي الفراغات: `( )` و`.....` و`/ / 20` و`____` —
 * و**صفر وسم بصيغة `{}`** في أي ملف فُحص. فالاستيراد الحرفي يُخرج استمارةً
 * ميتة، ولا بدّ من قراءة الفراغ حقلًا واستنتاج اسمه مما قبله.
 *
 * ومعه تنظيف آثار الكتابة اليدوية في Word: التمديد، والصفر بدل النقطة،
 * والفقرات الفارغة التي يُصنع بها فراغ التوقيع. وورقتنا تعيد الصفّ بنفسها
 * فتظهر مهلهلة إن بقيت.
 *
 * **وكل قاعدة هنا تعيد درجة ثقة لا قرارًا ثنائيًا** — فالبرنامج يقترح والموظف
 * يحكم، والقرار عتبةٌ على الدرجة يسهل استبدالها بنموذج لاحقًا (§١٥ من الأساس).
 */
import {
  APPLY_THRESHOLD,
  fieldRef,
  makeField,
  newUuid,
  paragraph,
  run,
  type Confidence,
  type DocField,
  type FieldType,
  type Inline,
  type ParagraphBlock,
  type Suggestion
} from '@shared/doc';

export { APPLY_THRESHOLD };
export type { Confidence, Suggestion };

// ── التنظيف ──────────────────────────────────────────────────────────

const TATWEEL = /ـ+/g;

/**
 * التمديد زخرفةُ Word: `انـــــــــذار` كلمتها «انذار».
 *
 * ومن بحث عن «إنذار» لا يجدها ما بقيت ممدودة — وورقتنا تعيد الصفّ فيظهر
 * المدّ مهلهلًا.
 */
export function stripTatweel(text: string): string {
  return text.replace(TATWEEL, '');
}

/** هل انتهى النصّ بحرف عربي؟ — شرط قاعدة الصفر. */
const ARABIC_LETTER = /[ء-ي]/;

/**
 * «0» بدل النقطة: لوحة المفاتيح العربية تضع الصفر حيث تُراد نقطة.
 *
 * مؤكَّدٌ في ملفين مستقلّين: `وانذاره0` و`الدوام 0`. والشرط ألّا يجاور رقمًا —
 * وإلا أفسدنا عددًا حقيقيًا.
 */
export function fixZeroPeriods(text: string): Suggestion<string>[] {
  const out: Suggestion<string>[] = [];
  const re = /0/g;
  for (const m of text.matchAll(re)) {
    const at = m.index ?? 0;
    const before = text.slice(0, at);
    const after = text.slice(at + 1);
    if (/[\d٠-٩]$/.test(before) || /^[\d٠-٩]/.test(after)) continue;

    const prev = before.replace(/\s+$/, '');
    if (!ARABIC_LETTER.test(prev.slice(-1))) continue;

    const attached = !/\s$/.test(before);
    out.push({
      value: `${before}.${after}`,
      confidence: attached ? 0.9 : /^\s*$/.test(after) ? 0.85 : 0.6,
      reason: attached ? 'صفرٌ ملتصق بآخر كلمة عربية' : 'صفرٌ منفرد بعد كلمة عربية'
    });
  }
  return out;
}

/**
 * ينظّف سطرًا: التمديد، والصفر الواثق، والمسافات المكرّرة.
 *
 * والمسافات الطويلة داخل السطر ليست زخرفًا — بها يفصل الموظف عمودًا عن عمود،
 * فتُترك للترويسة وتُضغط في المتن.
 */
export function cleanLine(text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  let out = text;

  const stripped = stripTatweel(out);
  if (stripped !== out) {
    notes.push('حُذف التمديد');
    out = stripped;
  }

  for (;;) {
    const fix = fixZeroPeriods(out).find((s) => s.confidence >= APPLY_THRESHOLD);
    if (!fix) break;
    out = fix.value;
    notes.push(`«0» ← «.» (${fix.reason})`);
  }

  const squeezed = out.replace(/[ \t]{2,}/g, ' ').trim();
  if (squeezed !== out.trim()) notes.push('ضُغطت المسافات المكرّرة');
  return { text: squeezed, notes };
}

// ── الفراغات ─────────────────────────────────────────────────────────

export type BlankKind = 'paren' | 'dots' | 'date' | 'underline';

export type DetectedBlank = {
  kind: BlankKind;
  start: number;
  end: number;
  raw: string;
  /** عرض الفراغ بالحروف — من طول ما كتبه الموظف، فلا ينكمش على الورق. */
  width: number;
  type: FieldType;
};

/** الفراغ الذي يكتبه الموظف بأشكاله الأربعة. */
const PATTERNS: { kind: BlankKind; re: RegExp; type: FieldType }[] = [
  // التاريخ قبل غيره: `/ / 20` فيه شرطتان لا يلتقطهما سواه.
  { kind: 'date', re: /\/[ \t]*\/[ \t]*(?:20|٢٠)?[\d٠-٩]{0,2}/g, type: 'date' },
  { kind: 'paren', re: /\([ \t ]*\)/g, type: 'text' },
  { kind: 'dots', re: /[.…]{3,}/g, type: 'text' },
  { kind: 'underline', re: /_{3,}/g, type: 'text' }
];

const MIN_WIDTH = 6;
const PAREN_WIDTH = 12;

/** يقرأ فراغات السطر مرتّبةً، ويُسقط المتداخل منها. */
export function detectBlanks(line: string): DetectedBlank[] {
  const found: DetectedBlank[] = [];

  for (const p of PATTERNS) {
    for (const m of line.matchAll(p.re)) {
      const start = m.index ?? 0;
      const raw = m[0];
      const inner = p.kind === 'paren' ? raw.length - 2 : raw.length;
      found.push({
        kind: p.kind,
        start,
        end: start + raw.length,
        raw,
        width:
          p.kind === 'paren'
            ? Math.max(PAREN_WIDTH, inner)
            : p.kind === 'date'
              ? 12
              : Math.max(MIN_WIDTH, raw.length),
        type: p.type
      });
    }
  }

  found.sort((a, b) => a.start - b.start);
  const out: DetectedBlank[] = [];
  let at = -1;
  for (const b of found) {
    if (b.start < at) continue;
    out.push(b);
    at = b.end;
  }
  return out;
}

// ── اسم الحقل يُستنتج مما قبله ───────────────────────────────────────

const PERSON_NOUNS = ['تلميذ', 'طالب', 'موظف', 'مواطن', 'مدرس', 'معلم', 'المدعو', 'السيد'];
const DROP_WORDS = ['في', 'من', 'على', 'الى', 'إلى', 'عن', 'لدى', 'مع', 'الرقم', 'رقم'];

const bare = (w: string) => w.replace(/^(?:لل|بال|كال|وال|فال|ال|ل|ب|ك|و|ف)/, '');
const words = (s: string) =>
  s
    .replace(/[:؛،.…()_\-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

export function keyFromLabel(label: string): string {
  return stripTatweel(label).trim().replace(/\s+/g, '_').replace(/[{}]/g, '') || 'حقل';
}

/**
 * اسم الحقل من الكلام الذي قبله: «للتلميذ ( )» ← اسم التلميذ.
 *
 * والقواعد مرتّبة بثقتها، وأوثقها النقطتان: «الاسم: ......» لا تحتمل غير
 * «الاسم». وما دونها اجتهادٌ يراجعه الموظف.
 */
export function suggestFieldName(before: string): Suggestion<string> {
  const text = stripTatweel(before).replace(/\s+/g, ' ').trimEnd();

  // ١) «الاسم: .......» — العنوان معلنٌ بنقطتيه.
  const colon = text.match(/([^\s:؛،][^:؛،]{0,30}?)\s*[:：]\s*$/);
  if (colon) {
    return { value: colon[1]!.trim(), confidence: 0.95, reason: 'عنوانٌ منتهٍ بنقطتين' };
  }

  const ws = words(text);
  const last = ws[ws.length - 1] ?? '';
  const prev = ws[ws.length - 2] ?? '';

  // ٢) «الوثيقة المرقمة ( )» ← رقم الوثيقة.
  if (/^المرقم(?:ة)?$/.test(last) && prev) {
    // وتبقى الكلمة بأداتها: «رقم الوثيقة» عنوانٌ مفهوم، و«رقم وثيقة» مبتور.
    return { value: `رقم ${prev}`, confidence: 0.9, reason: '«المرقم» تسبقها الوثيقة' };
  }

  // ٣) «للتلميذ ( )» ← اسم التلميذ.
  const noun = bare(last);
  if (PERSON_NOUNS.some((n) => noun.startsWith(n) || noun === n)) {
    return { value: `اسم ${noun.startsWith('ال') ? noun : `ال${noun}`}`, confidence: 0.85, reason: 'اسمُ شخص' };
  }

  // ٤) «في الصف ......» ← الصف: تُسقط أداة الجرّ ويبقى المضاف إليه.
  if (DROP_WORDS.includes(last) && prev) {
    return { value: prev, confidence: 0.6, reason: 'كلمةٌ قبل أداة الجرّ' };
  }
  // وتُترك الكلمة كما كُتبت: «الصف» عنوانٌ مفهوم، و«صف» مبتورة.
  if (last) {
    return { value: last, confidence: 0.55, reason: 'آخر كلمة قبل الفراغ' };
  }

  return { value: 'حقل', confidence: 0.2, reason: 'لا كلام قبله' };
}

// ── الفقرة بحقولها ───────────────────────────────────────────────────

export type BuiltField = { field: DocField; suggestion: Suggestion<string> };

/**
 * يربط الحقل المستنتَج بسجل المواطنين حين يعرفه.
 *
 * المحرّك عرف أنّ «للتلميذ ( )» اسمُ شخص — فلا يُهدر ما عرفه: يُوسم الحقل
 * بدوره ومصدره، فيملؤه F2 ويُقيَّد في الأرشيف باسم صاحبه. وبغيره تبقى الورقة
 * مجهولة الصاحب مهما مُلئت.
 */
function citizenLink(guess: Suggestion<string>): Partial<DocField> {
  if (guess.reason === 'اسمُ شخص') return { source: 'fullName', role: 'name' };
  if (/^(?:الرقم الوطني|رقم البطاقة|البطاقة الموحدة)/.test(guess.value)) {
    return { source: 'nationalId', role: 'nationalId' };
  }
  return {};
}

/**
 * يبني فقرةً من سطر: النصّ أجزاءً، والفراغات عقدَ حقول.
 *
 * و`seen` يمنع تكرار المفتاح في الوثيقة الواحدة — ومفتاحان متشابهان يفسدان
 * الحقن، فيملأ أحدهما مكان الآخر.
 */
export function paragraphFromLine(
  line: string,
  seen: Map<string, number>
): { block: ParagraphBlock; fields: BuiltField[] } {
  const blanks = detectBlanks(line);
  if (blanks.length === 0) {
    return { block: paragraph(line ? [run(line)] : []), fields: [] };
  }

  const inlines: Inline[] = [];
  const fields: BuiltField[] = [];
  let at = 0;

  for (const blank of blanks) {
    const before = line.slice(at, blank.start);
    if (before) inlines.push(run(before));

    const guess =
      blank.kind === 'date'
        ? { value: 'التاريخ', confidence: 0.95, reason: 'صيغة `/ / 20`' }
        : suggestFieldName(line.slice(0, blank.start));

    const base = keyFromLabel(guess.value);
    const nth = (seen.get(base) ?? 0) + 1;
    seen.set(base, nth);
    const key = nth === 1 ? base : `${base}_${nth}`;

    inlines.push(fieldRef(key));
    fields.push({
      field: makeField({
        key,
        label: nth === 1 ? guess.value : `${guess.value} (${nth})`,
        type: blank.type,
        width: blank.width,
        // الفراغ في الاستمارة يُملأ بالقلم بعد الطباعة ما لم يقل المكتب غير ذلك.
        fillMode: 'hand',
        ...citizenLink(guess)
      }),
      suggestion: guess
    });

    at = blank.end;
  }

  const rest = line.slice(at);
  if (rest) inlines.push(run(rest));
  return { block: paragraph(inlines), fields };
}

// ── الفقرات الفارغة: الفراغ مصنوعٌ بها ───────────────────────────────

/** ارتفاع سطر Word التقريبي بالبكسل — الفقرة الفارغة تساويه. */
export const EMPTY_LINE_PX = 18;

export type LineBlock =
  | { kind: 'text'; text: string }
  | { kind: 'spacer'; lines: number };

/**
 * يضغط الفقرات الفارغة المتتالية في مسافة رأسية واحدة.
 *
 * فراغ التوقيع في ورقة المكتب خمسُ فقرات فارغة، وورقتنا تعيد الصفّ — فلو
 * بقيت فقراتٍ انكسر الترتيب. وفقرةٌ فارغة واحدة تبقى سطرًا كما كانت.
 */
export function collapseEmpties(lines: string[]): LineBlock[] {
  const out: LineBlock[] = [];
  let empty = 0;

  const flush = () => {
    if (empty === 0) return;
    if (empty === 1) out.push({ kind: 'text', text: '' });
    else out.push({ kind: 'spacer', lines: empty });
    empty = 0;
  };

  for (const line of lines) {
    if (line.trim() === '') {
      empty += 1;
      continue;
    }
    flush();
    out.push({ kind: 'text', text: line });
  }
  flush();
  return out;
}

// ── وصل الجملة المقطوعة: اقتراحٌ لا حكم ──────────────────────────────

const ENDERS = /[.:؛!؟]\s*$/;

/**
 * الجملة التي قطعتها فقرةٌ فارغة — أثرُ الصفّ في Word لا إرادةُ الكاتب.
 *
 * ولا تُوصل آليًّا: قد تكون فقرتين مقصودتين. فتُعرض على الموظف في المراجعة.
 */
export function suggestJoins(lines: string[]): Suggestion<[number, number]>[] {
  const out: Suggestion<[number, number]>[] = [];
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]!.trim();
    if (!a || ENDERS.test(a) || a.length < 40) continue;

    let j = i + 1;
    while (j < lines.length && lines[j]!.trim() === '') j++;
    const b = lines[j]?.trim();
    if (!b || /^(?:إلى|الى|م\s*\/|الموضوع|تحية)/.test(b)) continue;

    out.push({
      value: [i, j],
      confidence: j === i + 1 ? 0.65 : 0.55,
      reason: 'سطرٌ طويل لم ينتهِ بعلامة، ويليه تتمّته'
    });
  }
  return out;
}

// ── الملف الواحد مكتبة: تكرار الترويسة حدٌّ بين استمارة وأخرى ─────────

/**
 * يقسم فقرات الملف استماراتٍ عند تكرار سطر الترويسة.
 *
 * ملفٌ فيه ٣١ استمارة مدرسية ليس فيه فاصل صفحات واحد — الصفحات تُصنع بالفراغ،
 * وحدُّ الاستمارة علامتُه الوحيدة تكرار الترويسة.
 */
export function splitForms(lines: string[], marker: string): [number, number][] {
  const needle = stripTatweel(marker).replace(/\s+/g, ' ').trim();
  if (!needle) return lines.length ? [[0, lines.length]] : [];

  const starts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (stripTatweel(lines[i]!).replace(/\s+/g, ' ').trim().includes(needle)) starts.push(i);
  }
  if (starts.length < 2) return lines.length ? [[0, lines.length]] : [];

  return starts.map((s, i) => [s, starts[i + 1] ?? lines.length] as [number, number]);
}

// ── كشف المكرّر ──────────────────────────────────────────────────────

/** يجرّد النصّ لأجل المقارنة: تمديد ومسافات وفراغات — فالفرق في المنطوق. */
function shingleText(text: string): string {
  return stripTatweel(text)
    .replace(/[.…]{3,}|_{3,}|\([ \t]*\)/g, ' ')
    .replace(/[^ء-ي\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function shingles(text: string, n = 3): Set<string> {
  const ws = shingleText(text).split(' ').filter(Boolean);
  const set = new Set<string>();
  if (ws.length < n) {
    if (ws.length) set.add(ws.join(' '));
    return set;
  }
  for (let i = 0; i + n <= ws.length; i++) set.add(ws.slice(i, i + n).join(' '));
  return set;
}

/** نسبة التشابه (جاكار) بين نصّين — صفر لا يشبه، وواحد متطابق. */
export function similarity(a: string, b: string): number {
  const A = shingles(a);
  const B = shingles(b);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let shared = 0;
  for (const s of A) if (B.has(s)) shared += 1;
  return shared / (A.size + B.size - shared);
}

export const DUPLICATE_THRESHOLD = 0.95;

/**
 * يجمع المتشابهات: `تأييد.doc` و`تأييد2.doc` و`تأييد نهائي.doc` واحدة.
 *
 * فالمئات ليست مئات استمارة — هي ثلاثون نُسخت عشر مرّات، لأن Word لا يفرّق بين
 * الأصل والنسخة. والقرار للموظف: «ثلاثة ملفات متشابهة — أأجعلها نموذجًا واحدًا؟»
 */
export function groupDuplicates<T extends { id: string; text: string }>(
  items: T[],
  threshold = DUPLICATE_THRESHOLD
): { ids: string[]; confidence: Confidence }[] {
  const groups: { ids: string[]; texts: string[]; best: number }[] = [];

  for (const item of items) {
    let placed = false;
    for (const g of groups) {
      const score = Math.max(...g.texts.map((t) => similarity(t, item.text)));
      if (score >= threshold) {
        g.ids.push(item.id);
        g.texts.push(item.text);
        g.best = Math.min(g.best, score);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push({ ids: [item.id], texts: [item.text], best: 1 });
  }

  return groups.filter((g) => g.ids.length > 1).map((g) => ({ ids: g.ids, confidence: g.best }));
}

// ── الوثيقة من فقرات المستند ─────────────────────────────────────────

export type BuiltDoc = {
  blocks: (ParagraphBlock | { id: string; kind: 'spacer'; height: number })[];
  fields: DocField[];
  /** ما فعله المحرّك وما اقترحه — يُعرض في المراجعة، ولا يُطبّق بصمت. */
  notes: string[];
  suggestions: Suggestion<string>[];
};

/**
 * يبني متن الوثيقة من فقرات Word: تنظيفًا، وفراغاتٍ حقولًا، وفراغًا مضغوطًا.
 *
 * والحقول المستنتجة تُعرض بأسمائها ودرجاتها، فيراجعها الموظف قبل الحفظ —
 * البرنامج يقترح وهو يحكم.
 */
export function buildBody(lines: string[]): BuiltDoc {
  const notes: string[] = [];
  const suggestions: Suggestion<string>[] = [];
  const fields: DocField[] = [];
  const seen = new Map<string, number>();

  const cleaned = lines.map((line) => {
    const { text, notes: n } = cleanLine(line);
    notes.push(...n);
    return text;
  });

  const blocks: BuiltDoc['blocks'] = [];
  for (const item of collapseEmpties(cleaned)) {
    if (item.kind === 'spacer') {
      blocks.push({ id: newUuid(), kind: 'spacer', height: item.lines * EMPTY_LINE_PX });
      notes.push(`${item.lines} فقرات فارغة ← مسافة رأسية`);
      continue;
    }
    const built = paragraphFromLine(item.text, seen);
    blocks.push(built.block);
    for (const f of built.fields) {
      fields.push(f.field);
      suggestions.push({ ...f.suggestion, value: `${f.field.key} — ${f.suggestion.value}` });
    }
  }

  return { blocks, fields, notes: [...new Set(notes)], suggestions };
}
