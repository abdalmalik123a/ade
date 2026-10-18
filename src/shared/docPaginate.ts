/**
 * توزيع الكتل المقيسة على الصفحات، وخاتمة الورقة (التواقيع) لا تُشطر عن آخر فقرةٍ قبلها — نُقل من `doc.ts` كما هو (A11، D77)،
 * ويعيد `doc.ts` تصدير `paginate` و`keepTogetherFrom` و`Measured` فلا يتغيّر مستوردٌ.
 */
import type { Uuid, Block, ParagraphBlock } from './docTypes';

// ── توزيع الصفحات: بالقياس لا بالتدفّق ───────────────────────────────

export type Measured = {
  id: Uuid;
  /** ارتفاعها المقيس في DOM بالبكسل. */
  height: number;
  /** فاصل صفحة صريح قبلها. */
  breakBefore?: boolean;
};

/**
 * يوزّع كتلًا مقيسة على صفحات.
 *
 * دالّة نقيّة: القياس يجري في DOM والقرار هنا — فيُختبر التوزيع بلا متصفّح.
 * وكتلة أطول من الصفحة تُفرد وحدها بدل أن تدور إلى الأبد.
 */
export function paginate(
  items: Measured[],
  pageHeight: number,
  firstPageHeight = pageHeight
): Uuid[][] {
  if (pageHeight <= 0) return items.length ? [items.map((i) => i.id)] : [];

  const pages: Uuid[][] = [];
  let page: Uuid[] = [];
  let used = 0;
  let limit = firstPageHeight > 0 ? firstPageHeight : pageHeight;

  const flush = () => {
    if (page.length) pages.push(page);
    page = [];
    used = 0;
    limit = pageHeight;
  };

  for (const item of items) {
    if (item.breakBefore && page.length) flush();
    if (used > 0 && used + item.height > limit) flush();
    page.push(item.id);
    used += item.height;
  }
  flush();
  return pages;
}

/**
 * التواقيع لا تبدأ صفحةً وحدها (قرار ٣ تشرين الأول، ن١٩): من أين تبدأ خاتمة الورقة التي
 * لا تُشطر — وإلا -1.
 *
 * الخاتمة ما في آخر الورقة من أسطرٍ قصيرة («مع التقدير»، المنصب والاسم) وصفوفٍ (توقيعان
 * جنبًا إلى جنب) وصورٍ (ختمٌ أو توقيع) — ومعها آخر فقرةٍ من المتن قبلها، فلا ينزل التوقيع
 * إلى صفحةٍ ليس فيها من الكتاب شيء. ويُطبع هذا كتلةً واحدة (`docHtml`)، ويعرضه المحرّر
 * كذلك (`pageFlow`).
 */
export function keepTogetherFrom(blocks: Block[]): number {
  const SHORT = 40;
  const MAX_TAIL = 12;
  const textLength = (b: ParagraphBlock) =>
    b.inlines.reduce((n, i) => n + (i.kind === 'run' ? i.text.trim().length : i.kind === 'field' ? 10 : 0), 0);
  let i = blocks.length;
  let content = false;
  while (i > 0 && blocks.length - i < MAX_TAIL) {
    const b = blocks[i - 1]!;
    if (b.kind === 'paragraph' && textLength(b) <= SHORT) {
      if (textLength(b) > 0) content = true;
    } else if (b.kind === 'columns' || b.kind === 'image') content = true;
    else if (b.kind !== 'spacer') break;
    i -= 1;
  }
  const body = blocks[i - 1];
  if (!content || i === blocks.length || !body || body.kind !== 'paragraph') return -1;
  return i - 1;
}
