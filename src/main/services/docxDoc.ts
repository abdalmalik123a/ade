/**
 * Word ← ورقة: يعيد رسم ملف Word على ورقة البرنامج كما صنعه صاحبه.
 *
 * المكاتب لا تستعمل ترويسة Word ولا تفصل رأس الكتاب عن متنه: الملف عندها قطعةٌ
 * واحدة. فلا يُفصل هنا شيء — الرأس أسطرٌ في أعلى الورقة كما كُتب، بأحجامه
 * وعريضه ومحاذاته، والجداول جداول، والخطّ الفاصل صورةٌ بمقاسها، وهوامش الصفحة
 * من الملف. ثم يظلّل المكتب ما يتغيّر ويضغط F4.
 *
 * **والمقياس ما يرسمه Word نفسه لا ما نظنّه.** تثبّته الملفات المرجعية في
 * `tests/fixtures/`، وقد قيس عليها بتصدير Word الملفَّ PDF.
 *
 * وما لا يُستورد يُقال في الملاحظات ولا يُخمَّن: ترقيمٌ غريب، ومسافةٌ قبل الفقرة.
 */
import { strFromU8 } from 'fflate';
import {
  emptyDoc,
  newUuid,
  paragraph,
  reconcileFields,
  type Align,
  type Block,
  type ColumnsBlock,
  type Doc,
  type Inline,
  type ParagraphBlock,
  type TableBlock,
  type TableCell,
} from '@shared/doc';
import { find, kid, kidsOf, num, parseXml, toggle, val, type XNode } from './docxXml';
import { type Ctx, chain, paraProps, twToMm, type SaveImage, pageSetupFrom, readStyles, readNumbering } from './docxStyles';
import { mapJc, readPieces, sizePx, round1, type Piece, fixZeros, dominantPx, nextStop, charEm, splitGaps, toInlines } from './docxRuns';

/** والقارئ يُصدَّر من هنا كما كان. */
export { parseXml, type XNode } from './docxXml';
export { sizeOfTwips, type SaveImage } from './docxStyles';

// ── المقاسات ─────────────────────────────────────────────────────────

/** ١ بكسل = ١٥ twip عند ٩٦ نقطة/إنش — مقياس الورقة في المعاينة والطباعة معًا. */
const TW_PER_PX = 15;

function convertParagraph(p: XNode, ctx: Ctx): Block[] {
  const { pp, styleR, markR } = paraProps(p, ctx);
  const bidi = pp.bidi ?? false;
  const align = mapJc(pp.jc, bidi);
  const dir = bidi ? undefined : ('ltr' as const);
  const { pieces, images } = readPieces(p, ctx, styleR, align);

  if (pp.before) ctx.notes.add('المسافة قبل الفقرات لا تُستورد — تبقى المسافة بعدها');

  // الترقيم الذي يرسمه Word يُكتب نصًّا في أوّل الفقرة.
  if (pp.numId) {
    const label = ctx.numbering(pp.numId, pp.ilvl ?? 0);
    const first = pieces.find((x) => x.kind === 'chars');
    if (label && first?.kind === 'chars') {
      const proto = first.cells[0]!;
      first.cells.unshift(...[...`${label} `].map((ch) => ({ ...proto, ch })));
    }
  }

  const markPx = sizePx(markR, bidi || Boolean(markR.rtl));
  const spaceAfter = pp.after !== undefined ? round1(pp.after / TW_PER_PX) : undefined;
  const lineHeight =
    pp.line && (pp.lineRule ?? 'auto') === 'auto'
      ? Math.round((pp.line / 240) * 1.15 * 100) / 100
      : undefined;

  const blocks: Block[] = [...images];

  // فاصل الصفحة يشطر الفقرة: ما قبله ورقة وما بعده أخرى.
  const groups: Piece[][] = [[]];
  for (const piece of pieces) {
    if (piece.kind === 'page') groups.push([]);
    else groups[groups.length - 1]!.push(piece);
  }

  groups.forEach((group, gi) => {
    if (gi > 0) blocks.push({ id: newUuid(), kind: 'pageBreak' });
    const allCells = group.flatMap((x) => (x.kind === 'chars' ? x.cells : []));
    fixZeros(allCells, ctx.notes);

    // صورةٌ وحدها في فقرتها لا تحتاج سطرًا فارغًا بعدها.
    if (images.length && !allCells.some((c) => c.ch.trim())) return;

    const basePx = dominantPx(allCells, markPx);

    // الجدولات والمسافات في أوّل السطر موضعُ بدايته: تصير مسافةً بادئة بالملّم.
    let pos = (pp.firstLine ?? 0) - (pp.hanging ?? 0) + (pp.start ?? 0);
    const first = group[0];
    if (first?.kind === 'chars') {
      let i = 0;
      for (; i < first.cells.length; i++) {
        const c = first.cells[i]!;
        if (c.ch === '\t') pos = nextStop(pos, pp.tabs ?? [], ctx.defaultTab);
        else if (c.ch === ' ' || c.ch === ' ') pos += charEm(' ', false) * c.px * TW_PER_PX;
        else break;
      }
      first.cells.splice(0, i);
    }
    const indent = pos > 20 ? twToMm(pos) : undefined;

    const common: Partial<ParagraphBlock> = {
      align,
      ...(dir ? { dir } : {}),
      size: basePx,
      ...(lineHeight ? { lineHeight } : {}),
      ...(spaceAfter ? { spaceAfter } : {})
    };

    // عمودان أو ثلاثة بالمسافات — بشروطها، وللسطر الذي محاذاته البداية وحده.
    const onlyChars = group.length === 1 && first?.kind === 'chars';
    const cuts = onlyChars && align === (bidi ? 'right' : 'left') ? splitGaps(first.cells) : null;
    if (cuts && first?.kind === 'chars') {
      const cells = first.cells;
      const bounds: [number, number][] = [];
      let from = 0;
      for (const [a, b] of cuts) {
        bounds.push([from, a]);
        from = b;
      }
      bounds.push([from, cells.length]);

      // أين أوصلت المسافاتُ كلَّ جزء في Word — ومنه عرض عموده.
      const starts: number[] = [];
      let x = pos;
      let next = 1;
      for (let i = 0; i < cells.length && next < bounds.length; i++) {
        if (i === bounds[next]![0]) {
          starts.push(x);
          next++;
        }
        const c = cells[i]!;
        x = c.ch === '\t' ? nextStop(x, pp.tabs ?? [], ctx.defaultTab) : x + charEm(c.ch, c.bold) * c.px * TW_PER_PX;
      }
      if (starts.length === bounds.length - 1) {
        const edges = [0, ...starts.map((s) => Math.min(s, ctx.contentWidthTw * 0.9)), ctx.contentWidthTw];
        const widths = edges
          .slice(1)
          .map((e, i) => Math.max(0.05, Math.round(((e - edges[i]!) / ctx.contentWidthTw) * 1000) / 1000));

        const columns = bounds.map(([a, b], i) => {
          const part = cells.slice(a, b);
          const inlines = toInlines([{ kind: 'chars', cells: part }], basePx);
          return [
            paragraph(inlines, {
              ...common,
              align: bidi ? 'right' : 'left',
              ...(i === 0 && indent ? { indent } : {})
            })
          ];
        });
        const block: ColumnsBlock = { id: newUuid(), kind: 'columns', columns, widths, gap: 0 };
        blocks.push(block);
        return;
      }
    }

    blocks.push(
      paragraph(toInlines(group, basePx), { ...common, ...(indent ? { indent } : {}) })
    );
  });

  if (pp.ruleBelow) blocks.push({ id: newUuid(), kind: 'rule' });
  return blocks;
}

// ── الجدول ───────────────────────────────────────────────────────────

/** حدودٌ ظاهرة؟ — `nil` و`none` خطوطٌ مخفية، وجدولٌ بلا نمطٍ ولا حدود مخفيّ. */
function tableHasBorders(tbl: XNode, ctx: Ctx): boolean {
  const visible = (borders: XNode | undefined) =>
    borders !== undefined && borders.kids.some((b) => !['nil', 'none'].includes(val(b) ?? 'none'));
  const tblPr = kid(tbl, 'w:tblPr');
  const own = kid(tblPr, 'w:tblBorders');
  if (own) return visible(own);
  const styleId = val(kid(tblPr, 'w:tblStyle'));
  for (const s of chain(ctx.styles, styleId).reverse()) {
    const b = find(s.node, 'w:tblBorders');
    if (b) return visible(b);
  }
  return false;
}

function convertTable(tbl: XNode, ctx: Ctx): TableBlock {
  const grid = kidsOf(kid(tbl, 'w:tblGrid'), 'w:gridCol').map((g) => num(g.attrs['w:w']) ?? 0);
  const rowsX = kidsOf(tbl, 'w:tr');
  const widest = Math.max(1, ...rowsX.map((r) => kidsOf(r, 'w:tc').length));
  const total = grid.reduce((a, b) => a + b, 0);
  const columns =
    grid.length && total > 0
      ? grid.map((w) => Math.max(0.1, Math.round((w / total) * grid.length * 100) / 100))
      : Array.from({ length: widest }, () => 1);

  const rows = rowsX.map((tr) => ({
    id: newUuid(),
    cells: kidsOf(tr, 'w:tc').map((tc): TableCell => {
      const tcPr = kid(tc, 'w:tcPr');
      const span = num(val(kid(tcPr, 'w:gridSpan'))) ?? 1;
      const vMerge = kid(tcPr, 'w:vMerge');
      // امتدادُ دمجٍ عمودي: الخليّة فارغة، ونصّها في الخليّة التي بدأت الدمج.
      const continued = vMerge !== undefined && val(vMerge) !== 'restart';
      if (continued) ctx.notes.add('الخلايا المدموجة عموديًا فُكّ دمجها — النصّ في أولاها');

      const inlines: Inline[] = [];
      let align: Align = 'right';
      let size: number | undefined;
      if (!continued) {
        const paras: XNode[] = [];
        const walk = (n: XNode) => {
          for (const k of n.kids) {
            if (k.name === 'w:p') paras.push(k);
            else if (k.name !== 'w:tcPr') walk(k);
          }
        };
        walk(tc);
        paras.forEach((p, i) => {
          const blocks = convertParagraph(p, ctx).flatMap((b) =>
            b.kind === 'paragraph'
              ? [b]
              : b.kind === 'columns'
                ? b.columns.flat().filter((x): x is ParagraphBlock => x.kind === 'paragraph')
                : []
          );
          for (const b of blocks) {
            if (i === 0 && size === undefined) {
              align = b.align;
              size = b.size;
            }
            if (inlines.length) inlines.push({ kind: 'break' });
            inlines.push(...b.inlines);
          }
        });
      }
      return {
        id: newUuid(),
        blocks: [paragraph(inlines, { align, ...(size ? { size } : {}) })],
        ...(span > 1 ? { colSpan: span } : {})
      };
    })
  }));

  const header = Boolean(toggle(kid(kid(rowsX[0], 'w:trPr'), 'w:tblHeader')));
  return {
    id: newUuid(),
    kind: 'table',
    columns,
    header,
    borders: tableHasBorders(tbl, ctx),
    rows
  };
}

// ── المستند ──────────────────────────────────────────────────────────

export type DocxResult = { doc: Doc; notes: string[] };

/**
 * يقرأ حزمة Word ويعيدها ورقةً واحدة بتنسيقها.
 *
 * والفراغات («.....» و«(   )» و«/ / 20») تبقى كما كتبها المكتب: تحويلها
 * متغيّرات قرارٌ يتّخذه هو بـF4 على الورقة، لا المحرّك في الخفاء.
 */
export function docxToDoc(files: Record<string, Uint8Array>, saveImage?: SaveImage): DocxResult {
  const main = files['word/document.xml'];
  if (!main) throw new Error('الملف ليس مستند Word صالحًا (لا يحتوي word/document.xml)');
  const body = find(parseXml(strFromU8(main)), 'w:body');
  if (!body) throw new Error('مستند Word بلا متن');

  const notes = new Set<string>();
  const rels = new Map<string, string>();
  const relsFile = files['word/_rels/document.xml.rels'];
  if (relsFile) {
    for (const r of kidsOf(find(parseXml(strFromU8(relsFile)), 'Relationships'), 'Relationship')) {
      if (r.attrs['Id'] && r.attrs['Target']) {
        rels.set(r.attrs['Id'], r.attrs['Target'].replace(/^\/?word\//, '').replace(/^\.\.\//, ''));
      }
    }
  }

  const settings = files['word/settings.xml'] ? parseXml(strFromU8(files['word/settings.xml'])) : undefined;
  const defaultTab = num(val(settings ? find(settings, 'w:defaultTabStop') : undefined)) ?? 720;

  const sect = kid(body, 'w:sectPr') ?? find(body, 'w:sectPr');
  const page = pageSetupFrom(sect);

  const ctx: Ctx = {
    styles: readStyles(files['word/styles.xml'] ? strFromU8(files['word/styles.xml']) : undefined),
    numbering: () => null,
    notes,
    rels,
    files,
    saveImage,
    defaultTab,
    contentWidthTw: page.widthTw,
    contentWidthPx: page.widthTw / TW_PER_PX
  };
  ctx.numbering = readNumbering(
    files['word/numbering.xml'] ? strFromU8(files['word/numbering.xml']) : undefined,
    notes
  );

  const blocks: Block[] = [];
  /** موضع الخطّ الفاصل الذي ختم الفقرة السابقة — إن كان آخر ما أُضيف. */
  let lastRule = -1;
  const walk = (n: XNode) => {
    for (const k of n.kids) {
      if (k.name === 'w:p') {
        const out = convertParagraph(k, ctx);
        const endsRule = out[out.length - 1]?.kind === 'rule';
        // فقراتٌ متتالية بالحدّ نفسه يرسم Word حدّها مرّةً واحدة تحت آخرها.
        if (endsRule && lastRule === blocks.length - 1) blocks.splice(lastRule, 1);
        blocks.push(...out);
        lastRule = endsRule ? blocks.length - 1 : -1;
        continue;
      }
      lastRule = -1;
      if (k.name === 'w:tbl') blocks.push(convertTable(k, ctx));
      else if (k.name === 'w:sdt') walk(kid(k, 'w:sdtContent') ?? k);
    }
  };
  walk(body);

  const doc = emptyDoc();
  doc.pageSetup = page.setup;
  doc.blocks = blocks.length ? blocks : [paragraph([])];
  doc.fields = reconcileFields(doc);
  return { doc, notes: [...notes] };
}
