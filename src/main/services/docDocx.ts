/**
 * الوثيقة إلى Word بتنسيقها (التدقيق المستقل — قرار المالك).
 *
 * كان تصدير النموذج إلى Word يكتب ظلّه النصّي سطرًا سطرًا: تضيع الجداول والأعمدة
 * والمحاذاة والخطّ العريض، ويخرج نموذجٌ لا يشبه ما في المكتبة. فيُبنى هنا من الوثيقة
 * نفسها كتلةً كتلة: الفقرة بمحاذاتها وحجمها ومسافتها، والجدول بأعمدته وحدوده وصفّ
 * عناوينه المتكرّر، والعمودان جدولًا بلا حدود، والصورة من المخزن، والترقيم بعلاماته
 * نفسها (`marker`)، وفاصل الصفحة ومقاسها وهوامشها.
 *
 * والحقل يُكتب `{الاسم}` مظلَّلًا: يرى المكتب مواضع ما يُملأ، ويُستورد الملف ثانيةً
 * فتعود حقولًا (`tokenInlines`) — Word وسيطٌ لا نهاية.
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Header,
  ImageRun,
  PageBreak,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
  type IBorderOptions,
  type ParagraphChild
} from 'docx';
import type { Align, Block, Doc, DocField, Inline, ListItem, ListStyle, ParagraphBlock } from '@shared/doc';
import { marker } from '@shared/docHtml';
import { defaultAlign, fontStack, visibleSections, type LetterheadBlock, type LetterheadLayout } from '@shared/letterhead';
import { imageMeta } from './imageSize';

/** بكسل الشاشة (٩٦ في الإنش) إلى وحدات Word. */
const halfPoints = (px: number) => Math.round(px * 1.5);
const twipsFromPx = (px: number) => Math.round(px * 15);
const twipsFromMm = (mm: number) => Math.round(mm * 56.7);

const PAGE_MM = { A4: { w: 210, h: 297 }, A5: { w: 148, h: 210 } } as const;
/** متن الكتاب ١٦ بكسلًا (`text-body-md`) = ١٢ نقطة. */
const BODY_PX = 16;

export type DocxOptions = {
  title: string;
  /** فقراتٌ تسبق المتن (الترويسة كما بناها المكتب). */
  before?: Paragraph[];
  /** صورةٌ من المخزن بمسارها النسبيّ — `null` إن غابت فتُترك مكانها. */
  image?: (src: string) => Uint8Array | null;
  /**
   * الكتاب الصادر (`fillDoc`): ما بقي حقلًا لم يُملأ يُكتب فراغًا منقّطًا بطوله كما تطبعه
   * الورقة — لا وسمًا مظلَّلًا كما في تصدير النموذج.
   */
  blanks?: boolean;
  /**
   * ترويسة الكتاب كما تُطبع: حقولها التلقائية محلولةٌ نصوصًا (`resolveLayout`)، والعدد
   * والتاريخ بقيمتيهما إن طُبعا. وإن كانت الترويسة تتكرّر في كل صفحة صارت رأسَ صفحة Word.
   */
  head?: { layout: LetterheadLayout; registry?: { number: string; date: string } };
};

const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 6, color: '000000' };

type Ctx = {
  rtl: boolean;
  image: DocxOptions['image'];
  contentTwips: number;
  numerals: Doc['pageSetup']['numerals'];
  fields: Map<string, DocField>;
  blanks: boolean;
};

const NBSP = String.fromCharCode(0xa0);
/** فراغٌ منقّطٌ بطول ما يُكتب فيه — كفراغ الورقة. */
const blankRun = (chars: number, rtl: boolean, size?: number) =>
  new TextRun({ text: NBSP.repeat(chars), underline: { type: UnderlineType.DOTTED }, rightToLeft: rtl, size });

/**
 * المحاذاة في فقرةٍ من اليمين: قارئ Word في `docxDoc` يقرأ «start» يمينًا و«end» يسارًا —
 * فتُكتب هكذا فيعود الملف بمحاذاته إن استُورد.
 */
function alignment(align: Align, rtl: boolean) {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'justify') return AlignmentType.BOTH;
  if (rtl) return align === 'left' ? AlignmentType.END : AlignmentType.START;
  return align === 'left' ? AlignmentType.LEFT : AlignmentType.RIGHT;
}

function runs(inlines: Inline[], rtl: boolean, ctx: Ctx, sizePx?: number, bold?: boolean): ParagraphChild[] {
  return inlines.map((n) => {
    if (n.kind === 'break') return new TextRun({ break: 1 });
    if (n.kind === 'field') {
      if (ctx.blanks) return blankRun(ctx.fields.get(n.ref)?.width ?? 14, rtl, sizePx ? halfPoints(sizePx) : undefined);
      return new TextRun({ text: `{${n.ref}}`, rightToLeft: rtl, highlight: 'yellow', bold, size: sizePx ? halfPoints(sizePx) : undefined });
    }
    const size = n.marks?.size ?? sizePx;
    return new TextRun({
      text: n.text,
      rightToLeft: rtl,
      bold: bold || n.marks?.bold,
      underline: n.marks?.underline ? {} : undefined,
      size: size ? halfPoints(size) : undefined
    });
  });
}

function paragraph(p: ParagraphBlock, ctx: Ctx): Paragraph {
  const rtl = p.dir ? p.dir === 'rtl' : ctx.rtl;
  return new Paragraph({
    bidirectional: rtl,
    alignment: alignment(p.align, rtl),
    indent: p.indent ? { firstLine: twipsFromMm(p.indent) } : undefined,
    spacing: {
      after: p.spaceAfter ? twipsFromPx(p.spaceAfter) : undefined,
      line: p.lineHeight ? Math.round(240 * p.lineHeight) : undefined
    },
    children: runs(p.inlines, rtl, ctx, p.size)
  });
}

function items(list: ListItem[], styles: ListStyle[], depth: number, ctx: Ctx): Paragraph[] {
  const style = styles[Math.min(depth, styles.length - 1)] ?? 'bullet';
  const num = (n: number) => (ctx.numerals === 'indic' ? String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!) : String(n));
  const out: Paragraph[] = [];
  list.forEach((it, i) => {
    const score = typeof it.score === 'number' ? [new TextRun({ text: `  (${num(it.score)} درجة)`, bold: true, rightToLeft: ctx.rtl })] : [];
    out.push(
      new Paragraph({
        bidirectional: ctx.rtl,
        alignment: alignment('right', ctx.rtl),
        indent: depth ? { start: 360 * depth } : undefined,
        children: [new TextRun({ text: `${marker(style, i, ctx.numerals)} `, bold: true, rightToLeft: ctx.rtl }), ...runs(it.inlines, ctx.rtl, ctx), ...score]
      })
    );
    if (it.pick && it.items?.length) {
      out.push(
        new Paragraph({
          bidirectional: ctx.rtl,
          alignment: alignment('right', ctx.rtl),
          indent: { start: 360 * (depth + 1) },
          children: [new TextRun({ text: `أجب عن ${num(it.pick)} فقط:`, bold: true, rightToLeft: ctx.rtl })]
        })
      );
    }
    if (it.items?.length) out.push(...items(it.items, styles, depth + 1, ctx));
  });
  return out;
}

/** جدولٌ بأعمدته — وفي الكتاب العربي يُقرأ من اليمين: أوّل خانةٍ أقصاها يمينًا. */
function table(
  rows: { cells: { blocks: (Paragraph | Table)[]; span?: number }[]; header?: boolean }[],
  weights: number[],
  borders: boolean,
  ctx: Ctx
): Table {
  const sum = weights.reduce((a, b) => a + b, 0) || 1;
  const widths = weights.map((w) => Math.round((w / sum) * ctx.contentTwips));
  const b = borders ? LINE : NO_BORDER;
  return new Table({
    width: { size: ctx.contentTwips, type: WidthType.DXA },
    columnWidths: widths,
    visuallyRightToLeft: ctx.rtl,
    borders: { top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b },
    rows: rows.map(
      (r) =>
        new TableRow({
          tableHeader: r.header,
          cantSplit: true,
          children: r.cells.map(
            (c) =>
              new TableCell({
                columnSpan: c.span && c.span > 1 ? c.span : undefined,
                // الخليّة لا تكون بلا فقرة في Word — وإلا رفض فتح الملف.
                children: c.blocks.length ? c.blocks : [new Paragraph('')]
              })
          )
        })
    )
  });
}

function blocks(list: Block[], ctx: Ctx): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  for (const b of list) {
    switch (b.kind) {
      case 'paragraph':
        out.push(paragraph(b, ctx));
        break;
      case 'list':
        out.push(...items(b.items, b.styles, 0, ctx));
        break;
      case 'table':
        out.push(
          table(
            b.rows.map((r, i) => ({
              header: b.header && i === 0,
              cells: r.cells.map((c) => ({ blocks: c.blocks.map((p) => paragraph(p, ctx)), span: c.colSpan }))
            })),
            b.columns,
            b.borders !== false,
            ctx
          )
        );
        break;
      case 'columns':
        // عمودان لا يتدفّقان: صفٌّ واحد بلا حدود، وكلّ عمودٍ خليّةٌ بكتله.
        out.push(
          table(
            [{ cells: b.columns.map((col) => ({ blocks: blocks(col, ctx) })) }],
            b.columns.map((_, i) => b.widths?.[i] ?? 1),
            false,
            ctx
          )
        );
        break;
      case 'image': {
        const bytes = b.src ? ctx.image?.(b.src) : null;
        const meta = bytes ? imageMeta(bytes) : null;
        const kind = bytes ? imageKind(bytes) : null;
        if (!bytes || !kind) {
          out.push(new Paragraph(''));
          break;
        }
        const height = b.height ?? (meta ? Math.round((b.width * meta.height) / meta.width) : b.width);
        out.push(
          new Paragraph({
            alignment: b.align === 'justify' ? AlignmentType.CENTER : alignment(b.align, false),
            children: [new ImageRun({ type: kind, data: bytes, transformation: { width: b.width, height } })]
          })
        );
        break;
      }
      case 'spacer': {
        if (b.lines) {
          // مساحة الإجابة: سطورٌ منقّطة كلّ ٢٨ بكسلًا، كما تُطبع.
          const n = Math.max(1, Math.floor(b.height / 28));
          for (let i = 0; i < n; i++) {
            out.push(new Paragraph({ spacing: { before: twipsFromPx(14) }, border: { bottom: { style: BorderStyle.DOTTED, size: 6, color: '888888' } } }));
          }
        } else {
          out.push(new Paragraph({ spacing: { before: twipsFromPx(b.height) } }));
        }
        break;
      }
      case 'pageBreak':
        out.push(new Paragraph({ children: [new PageBreak()] }));
        break;
      case 'group':
        // النموذج يُصدَّر كاملًا: ما يظهر بشرطٍ يظهر، فيراه المكتب ويقرّر.
        out.push(...blocks(b.blocks, ctx));
        break;
    }
  }
  return out;
}

/** نوع الصورة من توقيع بايتاتها — Word يطلبه صراحةً. */
function imageKind(bytes: Uint8Array): 'png' | 'jpg' | 'gif' | 'bmp' | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png';
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg';
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif';
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';
  return null;
}

/** اسم خطّ الترويسة في Word — أوّل ما في رصّته. */
const fontName = (layout: LetterheadLayout) => /'([^']+)'/.exec(fontStack(layout.font))?.[1];

/**
 * الترويسة كما يرسمها `LetterheadView`: البسملة فوق الأقسام، والأقسام أعمدةٌ بلا حدود
 * (الأوّل يمينًا) بأوزانها، والتاريخ فوق العدد في رأس الأخير — بقيمتيهما أو فراغًا منقّطًا —
 * والفاصل تحتها. ورأسٌ من ورقة يُرسم بكتله كما يُرسم المتن.
 */
function headBlocks(head: NonNullable<DocxOptions['head']>, ctx: Ctx): (Paragraph | Table)[] {
  const { layout, registry } = head;
  if (layout.sheet?.length) return blocks(layout.sheet, ctx);
  const font = fontName(layout);
  const text = (value: string, opts: { align: Align; size: number; bold?: boolean; after?: number }) =>
    new Paragraph({
      bidirectional: true,
      alignment: alignment(opts.align, true),
      spacing: opts.after ? { after: twipsFromPx(opts.after) } : undefined,
      children: [new TextRun({ text: value || ' ', bold: opts.bold, size: halfPoints(opts.size), rightToLeft: true, font })]
    });
  const block = (b: LetterheadBlock, fallback: Align): Paragraph => {
    const align = b.align ?? fallback;
    if (b.kind === 'spacer') return new Paragraph({ spacing: { before: twipsFromPx(b.gap ?? 12) } });
    if (b.kind === 'divider') return new Paragraph({ border: { bottom: LINE } });
    if (b.kind === 'image') {
      const bytes = b.value ? ctx.image?.(b.value) : null;
      const kind = bytes ? imageKind(bytes) : null;
      if (!bytes || !kind) return new Paragraph('');
      const meta = imageMeta(bytes);
      const width = b.width ?? 90;
      const height = meta ? Math.round((width * meta.height) / meta.width) : width;
      return new Paragraph({ alignment: alignment(align, false), children: [new ImageRun({ type: kind, data: bytes, transformation: { width, height } })] });
    }
    return text(b.value, { align, size: b.size, bold: b.bold, after: b.gap });
  };
  const registryLine = (label: string, value: string | undefined, bold: boolean) =>
    new Paragraph({
      bidirectional: true,
      alignment: alignment('right', true),
      children: [
        new TextRun({ text: `${label} `, bold: true, size: halfPoints(12), rightToLeft: true, font }),
        value ? new TextRun({ text: value, bold, size: halfPoints(12), rightToLeft: true, font }) : blankRun(16, true, halfPoints(12))
      ]
    });

  const out: (Paragraph | Table)[] = [];
  if (layout.basmala.show) out.push(text(layout.basmala.text, { align: layout.basmala.align, size: layout.basmala.size }));
  const sections = visibleSections(layout);
  const printed = layout.registry.mode === 'printed' ? registry : undefined;
  const cells = sections.map((section, i) => [
    ...(layout.registry.show && i === sections.length - 1
      ? [registryLine('التاريخ:', printed?.date, false), registryLine('العدد:', printed?.number, true)]
      : []),
    ...section.blocks.map((b) => block(b, defaultAlign(i, layout.columns)))
  ]);
  if (cells.length === 1) out.push(...cells[0]!);
  else if (cells.length) out.push(table([{ cells: cells.map((blocks) => ({ blocks })) }], sections.map((s) => s.weight || 1), false, ctx));
  if (layout.divider) out.push(new Paragraph({ border: { bottom: { ...LINE, size: 12 } } }));
  // فراغٌ بين الترويسة المبنيّة والمتن، كما في الورقة (`gapAfter`).
  out.push(new Paragraph({ spacing: { after: twipsFromPx(16) } }));
  return out;
}

export async function docToDocx(doc: Doc, opts: DocxOptions): Promise<Buffer> {
  const setup = doc.pageSetup;
  const size = PAGE_MM[setup.size] ?? PAGE_MM.A4;
  const landscape = setup.orientation === 'landscape';
  const pageW = landscape ? size.h : size.w;
  const m = setup.margins;
  const ctx: Ctx = {
    rtl: true,
    image: opts.image,
    contentTwips: twipsFromMm(pageW - m.left - m.right),
    numerals: setup.numerals,
    fields: new Map(doc.fields.map((f) => [f.key, f])),
    blanks: opts.blanks ?? false
  };
  const head = opts.head ? headBlocks(opts.head, ctx) : [];
  // الترويسة المتكرّرة رأسُ صفحة Word — يعيده في كل صفحة كما تعيدها الطابعة.
  const repeat = setup.repeatLetterhead && head.length > 0;
  const children = [...(opts.before ?? []), ...(repeat ? [] : head), ...blocks(doc.blocks, ctx)];
  const out = new Document({
    creator: 'ديوان',
    title: opts.title,
    styles: { default: { document: { run: { font: 'Amiri', size: halfPoints(BODY_PX), rightToLeft: true } } } },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: twipsFromMm(size.w),
              height: twipsFromMm(size.h),
              orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT
            },
            margin: { top: twipsFromMm(m.top), right: twipsFromMm(m.right), bottom: twipsFromMm(m.bottom), left: twipsFromMm(m.left) }
          }
        },
        headers: repeat ? { default: new Header({ children: head }) } : undefined,
        // الملف لا يكون بلا فقرة — وثيقةٌ فارغة تُفتح صفحةً بيضاء لا ملفًّا تالفًا.
        children: children.length ? children : [new Paragraph('')]
      }
    ]
  });
  return Packer.toBuffer(out);
}
