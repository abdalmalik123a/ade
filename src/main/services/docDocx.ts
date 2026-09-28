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
  ImageRun,
  PageBreak,
  PageOrientation,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type IBorderOptions,
  type ParagraphChild
} from 'docx';
import type { Align, Block, Doc, Inline, ListItem, ListStyle, ParagraphBlock } from '@shared/doc';
import { marker } from '@shared/docHtml';
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
};

const NO_BORDER: IBorderOptions = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const LINE: IBorderOptions = { style: BorderStyle.SINGLE, size: 6, color: '000000' };

type Ctx = { rtl: boolean; image: DocxOptions['image']; contentTwips: number; numerals: Doc['pageSetup']['numerals'] };

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

function runs(inlines: Inline[], rtl: boolean, sizePx?: number, bold?: boolean): ParagraphChild[] {
  return inlines.map((n) => {
    if (n.kind === 'break') return new TextRun({ break: 1 });
    if (n.kind === 'field') {
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
    children: runs(p.inlines, rtl, p.size)
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
        children: [new TextRun({ text: `${marker(style, i, ctx.numerals)} `, bold: true, rightToLeft: ctx.rtl }), ...runs(it.inlines, ctx.rtl), ...score]
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
    numerals: setup.numerals
  };
  const children = [...(opts.before ?? []), ...blocks(doc.blocks, ctx)];
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
        // الملف لا يكون بلا فقرة — وثيقةٌ فارغة تُفتح صفحةً بيضاء لا ملفًّا تالفًا.
        children: children.length ? children : [new Paragraph('')]
      }
    ]
  });
  return Packer.toBuffer(out);
}
