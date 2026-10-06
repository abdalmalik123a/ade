/**
 * عمليات الوثيقة التي يشترك فيها المحرّر ولوحة الحقول — نقيّةً، فتُختبر بلا متصفّح.
 *
 * كل دالّة تأخذ وثيقة وتعيد أخرى ولا تمسّ الأولى. والمفتاح مرجع المتن: تغيير العنوان لا يمسّه،
 * وحذف الحقل يردّه نقاطًا (`unfield` في `doc.ts`) لا يمحو ما كُتب.
 *
 * وكان هنا أيضًا ما يحرّر به المحرّر الأوّل كتله (الانشطار والدمج، وخلايا الجدول، والتراجع بلقطات)؛
 * وحُذف معه (الموجة ١، المجموعة ج): المحرّر الآن ProseMirror يحرّر بأوامره، وجداوله في
 * `docPmTable.ts`.
 */
import { makeField, newUuid, paragraph, run, type Doc, type DocField, type TableBlock, type TableCell } from './doc';

// ── النصّ ← حقل (F4) ────────────────────────────────────────────────

/**
 * الحقل الذي يصنعه تظليل نصٍّ وF4: اسمه النصّ نفسه، ومفتاحه فريدٌ في الوثيقة، وعرضه طول ما كان
 * مكتوبًا — فلا تنكمش الورقة عن شكلها الأوّل. ويصنعه المحرّر واقتراح الخانات (`fieldHints.ts`)
 * بالدالّة نفسها، فلا يختلف اسمٌ بينهما.
 */
export function fieldFromText(doc: Doc, text: string, patch: Partial<DocField> = {}): DocField | null {
  const label = (patch.label ?? text).trim();
  if (!label) return null;
  return makeField({ key: uniqueKey(doc, keyOf(label)), label, width: Math.max(6, text.trim().length), ...patch });
}

const keyOf = (label: string) => label.trim().replace(/\s+/g, '_').replace(/[{}]/g, '') || 'حقل';

function uniqueKey(doc: Doc, base: string): string {
  if (!doc.fields.some((f) => f.key === base)) return base;
  for (let i = 2; i < 200; i++) {
    const candidate = `${base}_${i}`;
    if (!doc.fields.some((f) => f.key === candidate)) return candidate;
  }
  return `${base}_${newUuid().slice(0, 4)}`;
}

// ── لوحة الحقول ──────────────────────────────────────────────────────

export function patchField(doc: Doc, key: string, patch: Partial<DocField>): Doc {
  return {
    ...doc,
    // المفتاح لا يُمسّ من هنا: هو مرجع المتن، وتغييره يقطع الحقل عن مواضعه.
    fields: doc.fields.map((f) => (f.key === key ? { ...f, ...patch, key: f.key } : f))
  };
}

/**
 * يعيد ترتيب الحقول — وهو **نفسه** ترتيب شاشة الإدخال في الشبّاك.
 *
 * وما لم يُذكر يلحق بآخر القائمة، فلا يضيع حقلٌ بسهو.
 */
export function reorderFields(doc: Doc, keys: string[]): Doc {
  const byKey = new Map(doc.fields.map((f) => [f.key, f]));
  const ordered = keys.map((k) => byKey.get(k)).filter(Boolean) as DocField[];
  const rest = doc.fields.filter((f) => !keys.includes(f.key));
  return { ...doc, fields: [...ordered, ...rest] };
}

// ── الجداول ──────────────────────────────────────────────────────────

const cell = (text = ''): TableCell => ({
  id: newUuid(),
  blocks: [paragraph(text ? [run(text)] : [])]
});

/** جدولٌ جديد بصفوفه وأعمدته المتساوية — وصفّ عناوينه يتكرّر بين الصفحات ما لم يُطفأ. */
export function makeTable(rows: number, cols: number, header = true): TableBlock {
  return {
    id: newUuid(),
    kind: 'table',
    columns: Array.from({ length: cols }, () => 1),
    header,
    rows: Array.from({ length: Math.max(1, rows) }, () => ({
      id: newUuid(),
      cells: Array.from({ length: Math.max(1, cols) }, () => cell())
    }))
  };
}
