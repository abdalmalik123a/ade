/**
 * «احفظ أعلى الورقة ترويسةً».
 *
 * أكثر ما يُكتب في Word قطعةٌ واحدة: الرأس أسطرٌ في أول المتن لا ترويسة. فيُستورد
 * كما هو، ثم **إن شاء المكتب** فصل رأسه ترويسةً تُختار لكتبٍ أخرى من الجهة نفسها.
 * والفصل نقلٌ لا تحويل: الكتل تنتقل كما هي، فلا يتزحزح سطرٌ عن موضعه.
 */
import { docText, emptyDoc, reconcileFields, walkBlocks, type Block, type Doc } from './doc';
import { emptyLayout, type LetterheadLayout } from './letterhead';

/** الرأس لا يتجاوز هذا — ما بعده متنٌ مهما شابه الرأس. */
const HEAD_LIMIT = 12;

/** الخطّ الفاصل في كتب Word صورةٌ ممطوطة: عريضةٌ جدًّا وقصيرةٌ جدًّا. */
function isDivider(b: Block): boolean {
  return b.kind === 'image' && Boolean(b.height) && b.height! <= 20 && b.width >= 200;
}

const isEmptyParagraph = (b: Block) =>
  b.kind === 'paragraph' &&
  b.inlines.every((i) => i.kind === 'break' || (i.kind === 'run' && !i.text.trim()));

/** صفٌّ جنبًا إلى جنب: أعمدة، أو جدولٌ مخفيّ الخطوط كما يرتّب Word رأسه. */
const isRow = (b: Block) => b.kind === 'columns' || (b.kind === 'table' && b.borders === false);

function hasField(blocks: Block[]): boolean {
  return walkBlocks(blocks).some(
    (b) =>
      (b.kind === 'paragraph' && b.inlines.some((i) => i.kind === 'field')) ||
      (b.kind === 'table' &&
        b.rows.some((r) => r.cells.some((c) => c.blocks.some((p) => p.inlines.some((i) => i.kind === 'field')))))
  );
}

/**
 * كم كتلةً من أول الورقة هي رأسها؟ وصفرٌ إن لم يُعرف له حدّ.
 *
 * الخطّ الفاصل أوضح حدّ: ما فوقه رأس. وبغيره فالرأس صفوفٌ جنبًا إلى جنب
 * («ادارة … العدد:») وما يليها من أسطر حتى أول سطرٍ فارغ.
 * ورأسٌ فيه متغيّر لا يُفصل: الترويسة لا تُملأ، فيضيع ما يُكتب فيه.
 */
export function findSheetHead(doc: Doc): number {
  const top = doc.blocks.slice(0, HEAD_LIMIT);
  const stop = top.findIndex((b) => b.kind === 'list' || b.kind === 'pageBreak' || b.kind === 'group');
  const scan = stop < 0 ? top : top.slice(0, stop);

  let count = scan.findIndex(isDivider) + 1;
  if (count === 0) {
    const firstRow = scan.findIndex(isRow);
    if (firstRow < 0 || !scan.slice(0, firstRow).every((b) => b.kind === 'paragraph')) return 0;
    count = firstRow;
    while (count < scan.length && isRow(scan[count]!)) count += 1;
    while (count < scan.length && scan[count]!.kind === 'paragraph' && !isEmptyParagraph(scan[count]!))
      count += 1;
  }

  const head = doc.blocks.slice(0, count);
  if (head.every(isEmptyParagraph) || hasField(head)) return 0;
  return count;
}

/** اسمٌ للترويسة من نصّها: «ادارة مدرسة الصحوة الابتدائية للبنين». */
function headName(blocks: Block[]): string {
  // العمود الأول يمين الورقة — وفيه اسم الجهة؛ واليسار عددٌ وتاريخ.
  const pick = blocks.map((b) => (b.kind === 'columns' ? (b.columns[0] ?? []) : [b])).flat();
  const text = docText({ ...emptyDoc(), blocks: pick })
    .replace(/ـ+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.slice(0, 60) || 'ترويسة من ورقة';
}

export type SheetHeadSplit = {
  name: string;
  layout: LetterheadLayout;
  /** الورقة بلا رأسها — وما تحته يبقى في موضعه. */
  doc: Doc;
};

export function splitSheetHead(doc: Doc, count = findSheetHead(doc)): SheetHeadSplit | null {
  if (count <= 0) return null;
  const head = doc.blocks.slice(0, count);
  if (hasField(head)) return null;

  const rest: Doc = {
    ...doc,
    blocks: doc.blocks.slice(count),
    // الورقة تطبع ترويستها الآن — «بلا ترويسة» كان وصف الورقة قبل الفصل.
    pageSetup: { ...doc.pageSetup, letterheadMode: 'print' }
  };
  rest.fields = reconcileFields(rest);

  return {
    name: headName(head),
    layout: { ...emptyLayout(), margins: { ...doc.pageSetup.margins }, divider: false, font: 'plex', sheet: head },
    doc: rest
  };
}
