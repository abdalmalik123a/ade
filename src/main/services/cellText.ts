/**
 * نصّ خليّة Excel كما يراه المكتب — قارئٌ واحد للقوائم (`sheetRead.ts`) وللنماذج (`excelDoc.ts`).
 *
 * كان لكلٍّ منهما قارئه، وفي أحدهما `cell.text` من exceljs يكتب التاريخ «Thu Mar 09 2015 …» والمعادلة
 * التي نتيجتها صفر فراغًا ونتيجتها خطأً «[object Object]» (مراجعة ٧ ت١):
 * - **التاريخ** يومًا `yyyy/mm/dd`. وexceljs يقرأ الرقم التسلسلي تاريخَ UTC، فنقرؤه بمكوّنات UTC حتى يطابق ما
 *   يعرضه Excel؛ وإن كان فيه وقتٌ أُضيف `HH:mm`.
 * - **المعادلة** تُقرأ نتيجتها: الصفر «٠» لا فراغ، والتاريخ يومًا، والخطأ (`#N/A` و`#REF!`…) فراغًا لا يُطبع على ورقة.
 * - **الرقم** رقمًا لا «1.0»، بلا ضجيج الفاصلة العائمة (`0.30000000000000004` ← `0.3`).
 */

const p2 = (n: number) => String(n).padStart(2, '0');

/** يومٌ بتقويم Excel — وساعته إن لم تكن منتصف الليل. */
export function dateText(d: Date): string {
  if (Number.isNaN(d.getTime())) return '';
  const day = `${d.getUTCFullYear()}/${p2(d.getUTCMonth() + 1)}/${p2(d.getUTCDate())}`;
  const h = d.getUTCHours();
  const m = d.getUTCMinutes();
  return h || m ? `${day} ${p2(h)}:${p2(m)}` : day;
}

function numberText(v: number, decimals: number | undefined): string {
  if (!Number.isFinite(v)) return '';
  if (Number.isInteger(v)) return String(v);
  if (decimals !== undefined) {
    const k = 10 ** decimals;
    return String(Math.round(v * k) / k);
  }
  return String(Number(v.toPrecision(12)));
}

function valueText(v: unknown, decimals: number | undefined): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return dateText(v);
  if (typeof v === 'number') return numberText(v, decimals);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    // خطأ المعادلة أو الخليّة (#N/A، #REF!…): لا يُطبع على ورقة.
    if ('error' in o) return '';
    // نصٌّ منسَّق: أجزاؤه متّصلة.
    if (Array.isArray(o['richText'])) return (o['richText'] as { text?: string }[]).map((r) => r.text ?? '').join('');
    // معادلة: نتيجتها هي ما يراه المكتب (والصفر صفرٌ لا فراغ).
    if ('result' in o) return valueText(o['result'], decimals);
    // رابط، أو نصٌّ مغلَّف.
    if ('text' in o) return valueText(o['text'], decimals);
  }
  return String(v);
}

/**
 * `decimals`: القوائم تقرّب إلى ثلاث خانات (متوسّطٌ كـ٧٦٫٦٦٦٦٦٦٧ يُرى ٧٦٫٦٦٧)؛
 * والنماذج بلا تقريبٍ إلا ضجيج الفاصلة العائمة.
 */
export function cellText(cell: { value: unknown }, opts: { decimals?: number } = {}): string {
  try {
    return valueText(cell.value, opts.decimals);
  } catch {
    return '';
  }
}
