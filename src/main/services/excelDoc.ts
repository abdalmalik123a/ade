/**
 * Excel ← ورقة (الموجة ٢، «كلفة الانتقال»): كتب المكتب التي صُمّمت في Excel تصير نماذج بتنسيقها.
 *
 * برامج المخاطبات في Excel شائعةٌ بين المدارس والدوائر: ورقةٌ لكلّ كتاب مرسومةٌ بخلايا مدموجة، وشعاراتٌ
 * صورٌ فوق الخلايا، و**ورقة بيانات** تُكتب فيها المدرسة مرّة (اسمها وجنسها ومحافظتها ومديرها وعامها)
 * فتمتلئ بها الكتب كلّها بمعادلات. فتُقرأ هنا كما تُطبع:
 *
 * - **حدود الطباعة** وحدها (`printArea`): وما خارجها تعليماتٌ لمستعمل الملفّ («بعنوان يعني العنوان الوظيفي»).
 * - **الصفّ** جملةٌ واحدة إن تجاورت خلاياه («الى / المديرية العامة لتربية» + اسم المحافظة + «/ قسم…» ثلاث خلايا
 *   تُقرأ سطرًا)، و**أعمدةٌ جنبًا إلى جنب** إن فصل بينها فراغ (رأس الكتاب: الجهة يمينًا والعدد والتاريخ يسارًا)
 *   — وما تلاه من صفوفٍ في الأعمدة نفسها يلحق بها، والشعار بينها عمودٌ وسط.
 * - **الصفوف المحدودة** جدولٌ بأعمدته ودمجه الأفقي؛ والرأسيّ يُفكّ ونصّه في أولاه، كما في Word.
 * - **المعادلة** إلى ورقة البيانات خانةٌ باسم بيانها («اسم المدرسة»، «المحافظة») — فالنموذج الواحد لكلّ مدرسة؛
 *   وما سواها من معادلاتٍ نتيجتُها كما حُسبت.
 * - **الفراغ** في Excel مسافاتٌ لا نقاط: المسافات الطويلة نقاطٌ، فتصير خاناتٍ بأسمائها كفراغات Word.
 * - **الصورة** بموضعها ومقاسها من الخلايا التي فوقها؛ والصفوف الفارغة مسافةٌ بارتفاعها.
 *
 * وما لا يُنقل يُقال في ملاحظات الورقة: تظليل الخلايا، والدمج الرأسي، ومعادلةٌ كُتبت نتيجتها.
 */
import ExcelJS from 'exceljs';
import { basename, extname } from 'node:path';
import {
  emptyDoc,
  newUuid,
  paragraph,
  reconcileFields,
  run,
  type Align,
  type Block,
  type ColumnsBlock,
  type ImageBlock,
  type PageSize,
  type ParagraphBlock,
  type TableBlock,
  type TableCell
} from '@shared/doc';
import type { ImageSaver } from './import';
import { readWorkbook } from './importGuard';
import { type Range, parseRange, type Ctx, type ExcelSheetDoc, inside, colPx, type Row, type Seg, ptPx, cellInlines, alignOf, EMU_PX, type ExcelBook, dataSheetOf, REF, dataFieldsOf, literalsOf } from './excelCells';
export { fieldNameOf, gapsToDots, adoptDataFields, type ExcelSheetDoc, type ExcelBook } from './excelCells';

// ── الورقة ───────────────────────────────────────────────────────────

/** حدود الطباعة — وإلا ما فيه شيءٌ من الورقة. */
function areaOf(ws: ExcelJS.Worksheet): Range | null {
  const declared = ws.pageSetup?.printArea;
  if (declared) {
    const ranges = declared.split(',').map(parseRange).filter((r): r is Range => r !== null);
    if (ranges.length) {
      return {
        top: Math.min(...ranges.map((r) => r.top)),
        left: Math.min(...ranges.map((r) => r.left)),
        bottom: Math.max(...ranges.map((r) => r.bottom)),
        right: Math.max(...ranges.map((r) => r.right))
      };
    }
  }
  const dims = ws.dimensions as unknown as { top: number; left: number; bottom: number; right: number } | undefined;
  return dims && dims.bottom >= dims.top ? { top: dims.top, left: dims.left, bottom: dims.bottom, right: dims.right } : null;
}

const hasBorder = (cell: ExcelJS.Cell) => {
  const b = cell.border ?? {};
  return [b.top, b.bottom, b.left, b.right].filter((s) => s && s.style).length >= 2;
};

function sheetToDoc(book: ExcelJS.Workbook, ws: ExcelJS.Worksheet, ctx: Omit<Ctx, 'ws' | 'used' | 'notes'>, saveImage?: ImageSaver): ExcelSheetDoc | null {
  const area = areaOf(ws);
  if (!area) return null;
  const c: Ctx = { ...ctx, ws, used: new Map(), notes: new Set() };
  const rtl = Boolean(ws.views?.[0]?.rightToLeft);
  const merges = (ws.model.merges ?? [])
    .map(parseRange)
    .filter((m): m is Range => m !== null && m.bottom >= area.top && m.top <= area.bottom && m.right >= area.left && m.left <= area.right);
  const mergeAt = (r: number, col: number) => merges.find((m) => inside(m, r, col));
  const widthOf = (from: number, to: number) => {
    let px = 0;
    for (let col = from; col <= to; col++) px += ws.getColumn(col).hidden ? 0 : colPx(ws.getColumn(col).width ?? ws.properties.defaultColWidth);
    return px;
  };
  const areaPx = Math.max(1, widthOf(area.left, area.right));
  const defaultRow = ws.properties.defaultRowHeight ?? 15;

  // ── الصفوف بخلاياها ──
  const rows: Row[] = [];
  let shaded = false;
  for (let r = area.top; r <= area.bottom; r++) {
    const xr = ws.getRow(r);
    if (xr.hidden) continue;
    const segs: Seg[] = [];
    for (let col = area.left; col <= area.right; ) {
      const m = mergeAt(r, col);
      const range = m ? { top: m.top, left: Math.max(m.left, area.left), bottom: m.bottom, right: Math.min(m.right, area.right) } : { top: r, left: col, bottom: r, right: col };
      col = range.right + 1;
      if (m && m.top !== r) continue; // امتداد دمجٍ من صفٍّ فوقه
      const cell = ws.getCell(range.top, range.left);
      if (cell.fill && cell.fill.type === 'pattern' && cell.fill.pattern !== 'none') shaded = true;
      const px = Math.round(ptPx(cell.font?.size ?? 11) * 10) / 10;
      const inlines = cellInlines(c, cell, px);
      const text = inlines.map((i) => (i.kind === 'run' ? i.text : 'خانة')).join('').trim();
      const boxed = hasBorder(cell);
      if (!text && !boxed) continue;
      segs.push({ range, inlines, text, align: alignOf(cell.alignment?.horizontal, text), px, bold: Boolean(cell.font?.bold), boxed });
    }
    rows.push({ r, height: ptPx(xr.height ?? defaultRow), segs });
  }
  if (shaded) c.notes.add('تظليل الخلايا لم يُنقل');

  // ── الصور بمواضعها ──
  type Placed = { row: number; colFrom: number; colTo: number; block: ImageBlock };
  const images: Placed[] = [];
  for (const img of ws.getImages()) {
    const tl = img.range.tl as unknown as { nativeRow: number; nativeCol: number; nativeRowOff?: number; nativeColOff?: number };
    const br = img.range.br as unknown as { nativeRow: number; nativeCol: number; nativeRowOff?: number; nativeColOff?: number } | undefined;
    const r0 = tl.nativeRow + 1;
    const c0 = tl.nativeCol + 1;
    if (!inside(area, r0, c0)) continue; // خارج حدود الطباعة: ليس من الكتاب
    const media = book.getImage(Number(img.imageId)) as unknown as { buffer?: Uint8Array; extension?: string } | undefined;
    if (!media?.buffer || !saveImage) {
      c.notes.add('صورةٌ في الورقة لم تُنقل — أعِد إدراجها');
      continue;
    }
    const src = saveImage(new Uint8Array(media.buffer), `.${media.extension ?? 'png'}`);
    if (!src) continue;
    const ext = (img.range as unknown as { ext?: { width: number; height: number } }).ext;
    let w = ext?.width ?? 0;
    let h = ext?.height ?? 0;
    const c1 = br ? br.nativeCol + 1 : c0;
    const r1 = br ? br.nativeRow + 1 : r0;
    if (br) {
      w = widthOf(c0, c1 - 1) - (tl.nativeColOff ?? 0) / EMU_PX + (br.nativeColOff ?? 0) / EMU_PX;
      h = 0;
      for (let r = r0; r < r1; r++) h += ptPx(ws.getRow(r).height ?? defaultRow);
      h += -(tl.nativeRowOff ?? 0) / EMU_PX + (br.nativeRowOff ?? 0) / EMU_PX;
    }
    images.push({ row: r0, colFrom: c0, colTo: Math.max(c0, c1 - (br?.nativeColOff ? 0 : 1)), block: { id: newUuid(), kind: 'image', src, width: Math.max(8, Math.round(w)), ...(h > 0 ? { height: Math.max(1, Math.round(h)) } : {}), align: 'center' } });
  }

  /** موضعٌ أفقيّ بين ٠ و١ من يمين الورقة العربية (العمود الأوّل يمينها) — أو من يسار الإنكليزية. */
  const posOf = (from: number, to: number) => {
    const start = widthOf(area.left, from - 1);
    const center = (start + widthOf(from, to) / 2) / areaPx;
    return rtl ? center : 1 - center;
  };
  const placeAlign = (from: number, to: number, own: Align): Align => {
    if (widthOf(from, to) / areaPx >= 0.7) return own;
    const p = posOf(from, to);
    return p < 0.35 ? 'right' : p > 0.65 ? 'left' : 'center';
  };
  for (const im of images) im.block.align = placeAlign(im.colFrom, im.colTo, 'center');

  // ── الكتل ──
  const blocks: Block[] = [];
  const pending = [...images].sort((a, b) => a.row - b.row);
  // الصورة تُرسم قبل صفٍّ بدأت فوقه — وما بدأ في صفّه نفسه يُترك لما بعده: شعارٌ يبدأ في صفّ رقم الصفحة («1»)
  // ويمتدّ إلى الرأس عمودُ الرأس الأوسط، لا صورةٌ قبله.
  const emitImagesBefore = (r: number) => {
    while (pending.length && pending[0]!.row < r) blocks.push(pending.shift()!.block);
  };
  const paragraphOf = (segs: Seg[], align: Align): ParagraphBlock => {
    const size = segs.reduce((best, s) => (s.text.length > best.len ? { len: s.text.length, px: s.px } : best), { len: -1, px: segs[0]!.px }).px;
    const inlines = segs.flatMap((s, i) => (i ? [run(' '), ...s.inlines] : s.inlines));
    return paragraph(inlines, { align, size });
  };
  const textSegs = (row: Row) => row.segs.filter((s) => s.text);
  const ordered = (segs: Seg[]) => [...segs].sort((a, b) => a.range.left - b.range.left);
  /** خلايا الصفّ يفصل بينها عمودٌ فارغ؟ — فهي أعمدةٌ جنبًا إلى جنب لا جملةٌ واحدة. */
  const apart = (segs: Seg[]) => ordered(segs).some((s, i, all) => i > 0 && s.range.left > all[i - 1]!.range.right + 1);
  const isTable = (row: Row) => row.segs.filter((s) => s.boxed).length >= 2;

  let spacer = 0;
  const flushSpacer = () => {
    if (spacer >= 6) blocks.push({ id: newUuid(), kind: 'spacer', height: Math.round(spacer) });
    spacer = 0;
  };

  for (let i = 0; i < rows.length; ) {
    const row = rows[i]!;
    // ── جدول ──
    if (isTable(row)) {
      flushSpacer();
      emitImagesBefore(row.r);
      const group: Row[] = [];
      while (i < rows.length && isTable(rows[i]!)) group.push(rows[i++]!);
      blocks.push(tableOf(group));
      continue;
    }
    const segs = textSegs(row);
    // ── صفٌّ فارغ: مسافةٌ بارتفاعه ──
    if (!segs.length) {
      spacer += row.height;
      i++;
      continue;
    }
    flushSpacer();
    // ── أعمدةٌ جنبًا إلى جنب: الصفّ ومن يلحق به ──
    if (segs.length > 1 && apart(segs)) {
      const bands = ordered(segs).map((s) => ({ left: s.range.left, right: s.range.right, rows: [] as Seg[][] }));
      const from = row.r;
      let to = row.r;
      const over = (s: Seg) => bands.filter((b) => s.range.left <= b.right && s.range.right >= b.left);
      // يلحق بالأعمدة صفٌّ كلّ خليّةٍ فيه داخل عمودٍ واحدٍ منها — وسطرٌ بعرض الورقة يُنهيها.
      const fits = (r: Row) => {
        const t = textSegs(r);
        return t.length > 0 && !isTable(r) && t.every((s) => over(s).length === 1) && new Set(t.map((s) => over(s)[0])).size === t.length;
      };
      while (i < rows.length && (rows[i] === row || fits(rows[i]!))) {
        const t = textSegs(rows[i]!);
        for (const b of bands) b.rows.push(t.filter((s) => s.range.left <= b.right && s.range.right >= b.left));
        to = rows[i]!.r;
        i++;
      }
      // والشعار بين الأعمدة في صفوفها عمودٌ وسطها — يُؤخذ قبل أن يُرسم ما قبلها.
      const mids = pending.filter((im) => im.row >= from - 2 && im.row <= to && !bands.some((b) => im.colFrom <= b.right && im.colTo >= b.left));
      for (const m of mids) pending.splice(pending.indexOf(m), 1);
      emitImagesBefore(from);
      const columns: { left: number; right: number; blocks: Block[] }[] = bands.map((b) => ({
        left: b.left,
        right: b.right,
        blocks: b.rows.map((segsInRow) => (segsInRow.length ? paragraphOf(segsInRow, segsInRow[0]!.align) : paragraph([])))
      }));
      for (const m of mids) columns.push({ left: m.colFrom, right: m.colTo, blocks: [{ ...m.block, align: 'center' }] });
      columns.sort((a, b) => a.left - b.left);
      if (!rtl) columns.reverse();
      // الفجوات بين الأعمدة تُقسم بينها — فيبقى كلٌّ في موضعه من الورقة.
      const widths = columns.map((col, k) => {
        const prevGap = k > 0 ? Math.max(0, widthOf(columns[k - 1]!.right + 1, col.left - 1)) : widthOf(area.left, col.left - 1);
        const nextGap = k < columns.length - 1 ? Math.max(0, widthOf(col.right + 1, columns[k + 1]!.left - 1)) : widthOf(col.right + 1, area.right);
        return Math.max(1, widthOf(col.left, col.right) + (k > 0 ? prevGap / 2 : prevGap) + (k < columns.length - 1 ? nextGap / 2 : nextGap));
      });
      const block: ColumnsBlock = { id: newUuid(), kind: 'columns', columns: columns.map((col) => col.blocks), widths: widths.map((w) => Math.round((w / areaPx) * 100) / 100) };
      blocks.push(block);
      continue;
    }
    // ── سطرٌ واحد: خلاياه المتجاورة جملةٌ واحدة ──
    emitImagesBefore(row.r);
    const all = ordered(segs);
    const left = all[0]!.range.left;
    const right = all[all.length - 1]!.range.right;
    // جملةٌ من خلايا تتّجه أطرافها إلى وسطها («يسار» يمينها و«يمين» يسارها): وسطٌ.
    const inward = all.length > 1 && all[0]!.align === (rtl ? 'left' : 'right') && all[all.length - 1]!.align === (rtl ? 'right' : 'left');
    blocks.push(paragraphOf(all, placeAlign(left, right, inward ? 'center' : all.length > 1 ? 'right' : all[0]!.align)));
    i++;
  }
  // صفوف الورقة الفارغة بعد الكتاب ليست منه.
  spacer = 0;
  while (pending.length) blocks.push(pending.shift()!.block);

  function tableOf(group: Row[]): TableBlock {
    const left = Math.min(...group.flatMap((g) => g.segs.map((s) => s.range.left)));
    const right = Math.max(...group.flatMap((g) => g.segs.map((s) => s.range.right)));
    const columns: number[] = [];
    for (let col = left; col <= right; col++) columns.push(Math.max(0.1, Math.round((colPx(ws.getColumn(col).width ?? ws.properties.defaultColWidth) / 40) * 100) / 100));
    let split = false;
    const rowsOut = group.map((g) => {
      const cells: TableCell[] = [];
      for (let col = left; col <= right; ) {
        const m = mergeAt(g.r, col);
        const span = m ? Math.min(m.right, right) - Math.max(m.left, left) + 1 : 1;
        const seg = g.segs.find((s) => s.range.left === col && s.range.top === g.r);
        if (m && m.top !== g.r) split = true;
        cells.push({
          id: newUuid(),
          blocks: [seg ? paragraphOf([seg], seg.align) : paragraph([])],
          ...(span > 1 ? { colSpan: span } : {})
        });
        col += span;
      }
      return { id: newUuid(), cells };
    });
    if (split) c.notes.add('الخلايا المدموجة عموديًا فُكّ دمجها — النصّ في أولاها');
    const header = Boolean(group[0]?.segs.length) && group[0]!.segs.filter((s) => s.text).every((s) => s.bold);
    return { id: newUuid(), kind: 'table', columns, header, borders: true, rows: rowsOut };
  }

  if (!blocks.some((b) => b.kind !== 'spacer' && b.kind !== 'image')) return null;

  // ── الصفحة ──
  const doc = emptyDoc();
  const ps = ws.pageSetup ?? {};
  // رموز Excel: 1 Letter · 5 Legal · 8 A3 · 9 A4 · 11 A5 · 14 Folio · 70 A6. وLegal يبقى فولسكاب كما كان.
  const SIZES: Record<number, PageSize> = { 1: 'LT', 8: 'A3', 9: 'A4', 11: 'A5', 5: 'FS', 14: 'FS', 70: 'A6' };
  const inch = (v: number | undefined, fallback: number) => Math.max(5, Math.round(((v ?? fallback) * 25.4) * 10) / 10);
  doc.pageSetup = {
    ...doc.pageSetup,
    size: SIZES[Number(ps.paperSize)] ?? 'A4',
    orientation: ps.orientation === 'landscape' ? 'landscape' : 'portrait',
    margins: {
      top: inch(ps.margins?.top, 0.75),
      bottom: inch(ps.margins?.bottom, 0.75),
      right: inch(ps.margins?.right, 0.7),
      left: inch(ps.margins?.left, 0.7)
    },
    letterheadMode: 'lines'
  };
  doc.blocks = blocks;
  doc.fields = reconcileFields(doc, (key) => c.used.get(key) ?? {});
  return { name: ws.name.trim(), doc, notes: [...c.notes] };
}

/** كلّ ورقةٍ تُطبع نموذجًا — وورقة البيانات والمخفيّة والفارغة تُترك ويُقال لماذا. */
export function bookToDocs(book: ExcelJS.Workbook, saveImage?: ImageSaver): ExcelBook {
  const data = dataSheetOf(book);
  const refs = new Set<string>();
  if (data) {
    for (const ws of book.worksheets) {
      ws.eachRow({ includeEmpty: false }, (row) =>
        row.eachCell({ includeEmpty: false }, (cell) => {
          const v = cell.value as { formula?: string } | null;
          if (!v || typeof v !== 'object' || typeof v.formula !== 'string') return;
          for (const m of v.formula.matchAll(REF)) if ((m[1] ?? m[2]) === data) refs.add(`${m[3]}${m[4]}`);
        })
      );
    }
  }
  const fields: Map<string, { key: string; label: string; sample: string }> = data ? dataFieldsOf(book.getWorksheet(data)!, refs) : new Map();
  const literals = literalsOf(fields);
  const sheets: ExcelSheetDoc[] = [];
  const skipped: ExcelBook['skipped'] = [];
  for (const ws of book.worksheets) {
    if (ws.name === data) continue;
    if (ws.state !== 'visible') {
      skipped.push({ name: ws.name.trim(), reason: 'ورقةٌ مخفيّة' });
      continue;
    }
    const sheet = sheetToDoc(book, ws, { data, fields, literals }, saveImage);
    if (sheet) sheets.push(sheet);
    else skipped.push({ name: ws.name.trim(), reason: 'لا نصّ في خلاياها يُطبع — قد يكون كتابها صورةً أو مربّعات نصّ' });
  }
  return { sheets, dataSheet: data?.trim() ?? null, dataFields: [...fields.values()], skipped };
}

/** ملفّ Excel كتبًا — و`.xls` القديم يُقال له ما يُفعل. */
export async function excelToDocs(path: string, saveImage?: ImageSaver): Promise<ExcelBook> {
  if (extname(path).toLowerCase() !== '.xlsx') throw new Error(`«${basename(path)}» ليس ملف Excel بصيغة .xlsx — احفظه بها من Excel`);
  // أكبر من حدّه يُرفض قبل أن تقرأه exceljs (D51).
  const book = await readWorkbook(path, 'تعذّرت قراءة ملف Excel — قد يكون تالفًا، أو بصيغة .xls القديمة (احفظه .xlsx)');
  return bookToDocs(book, saveImage);
}
