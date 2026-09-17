import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import type { DocumentRow, PeriodStats, TemplateDetail } from '@shared/api';
import type { Letterhead } from '@shared/letterhead';
import { htmlToText } from './documents';

/**
 * تصدير النموذج إلى ملف يعيش خارج التطبيق.
 *
 * صيغتان لغرضين مختلفين:
 *  - XML: صيغة المشروع نفسها، تُستورد ثانيةً بلا فقد — وهي «للمستقبل».
 *  - DOCX: للمشاركة والطباعة خارج المكتب. التوليد برمجي وصامت بلا Word.
 */

const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const node = (name: string, value: string | null) =>
  value ? `  <${name}>${esc(value)}</${name}>\n` : '';

export function templateToXml(t: TemplateDetail): string {
  const vars = t.variables
    .map(
      (v) =>
        `    <variable token="${esc(v.token)}" label="${esc(v.label)}" ` +
        `source="${v.source}" required="${v.required ? 'true' : 'false'}"/>\n`
    )
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<template>\n' +
    node('code', t.code) +
    node('title', t.title) +
    node('subtitle', t.subtitle) +
    node('category', t.category) +
    node('subject', t.subjectLine) +
    `  <body>${esc(t.bodyHtml)}</body>\n` +
    (vars ? `  <variables>\n${vars}  </variables>\n` : '') +
    '</template>\n'
  );
}

/** مكتبة كاملة في ملف واحد — لاسترجاعها على جهاز آخر أو بعد إعادة تثبيت. */
export function libraryToXml(templates: TemplateDetail[]): string {
  const inner = templates
    .map((t) =>
      templateToXml(t)
        .replace(/^<\?xml[^\n]*\n/, '')
        .split('\n')
        .map((l) => (l ? `  ${l}` : l))
        .join('\n')
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    `<library exported="${new Date().toISOString()}" count="${templates.length}">\n` +
    inner +
    '</library>\n'
  );
}

/** يفكّ مكتبة مصدَّرة إلى نصوص نماذج مفردة ليُعاد استيراد كلٍّ منها. */
export function splitLibraryXml(xml: string): string[] {
  return [...xml.matchAll(/<template>[\s\S]*?<\/template>/g)].map((m) => m[0]);
}

export async function templateToDocx(
  t: TemplateDetail,
  letterhead: Letterhead | null
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // الترويسة كما بناها المكتب — نصّها فقط، فالصور لا تُنقل إلى Word هنا.
  for (const block of letterhead?.layout.blocks ?? []) {
    if (block.kind === 'text' || block.kind === 'field') {
      children.push(
        new Paragraph({
          alignment:
            block.align === 'center'
              ? AlignmentType.CENTER
              : block.align === 'left'
                ? AlignmentType.LEFT
                : AlignmentType.RIGHT,
          bidirectional: true,
          children: [
            new TextRun({
              text: block.value,
              bold: block.bold,
              size: Math.round(block.size * 1.5),
              rightToLeft: true
            })
          ]
        })
      );
    } else if (block.kind === 'divider') {
      children.push(new Paragraph({ text: '', border: { bottom: { style: 'single', size: 6, color: '000000' } } }));
    } else if (block.kind === 'spacer') {
      children.push(new Paragraph({ text: '' }));
    }
  }

  children.push(new Paragraph({ text: '' }));

  if (t.subjectLine) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        bidirectional: true,
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: `م / ${t.subjectLine}`, bold: true, rightToLeft: true })]
      })
    );
    children.push(new Paragraph({ text: '' }));
  }

  for (const line of t.bodyHtml.split('\n')) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        bidirectional: true,
        spacing: { line: 400 },
        children: [new TextRun({ text: line, rightToLeft: true })]
      })
    );
  }

  const doc = new Document({
    creator: 'ديوان',
    title: t.title,
    styles: { default: { document: { run: { font: 'Amiri', size: 26 } } } },
    sections: [{ properties: {}, children }]
  });

  return Packer.toBuffer(doc);
}

/**
 * الكتاب الصادر إلى Word.
 *
 * ما يُصدَّر هو نصّ الورقة كما خرجت من المحرر — الترويسة والمتن والتوقيع — لا
 * النموذج الفارغ. والتوليد برمجيّ وصامت: لا يُفتح Word ولا أداة خارجية.
 */
export async function sheetToDocx(sheetHtml: string, title: string): Promise<Buffer> {
  const lines = htmlToText(sheetHtml).split('\n');
  const children: Paragraph[] = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      children.push(new Paragraph({ text: '' }));
      continue;
    }
    // سطر الموضوع يتوسّط ويُسطَّر، كما في الورقة.
    const isSubject = line.startsWith('م /');
    children.push(
      new Paragraph({
        alignment: isSubject ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
        bidirectional: true,
        spacing: { line: 360 },
        children: [
          new TextRun({
            text: line,
            bold: isSubject,
            underline: isSubject ? {} : undefined,
            rightToLeft: true
          })
        ]
      })
    );
  }

  const doc = new Document({
    creator: 'ديوان',
    title,
    styles: { default: { document: { run: { font: 'Amiri', size: 26 } } } },
    sections: [{ properties: {}, children }]
  });
  return Packer.toBuffer(doc);
}

/** تقرير المدة: صفحة مؤشرات، وجدول الكتب، وتوزيع حسب نوع الوثيقة وحسب اليوم. */
export async function reportToExcel(input: {
  title: string;
  rows: DocumentRow[];
  stats: PeriodStats;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ديوان';
  wb.created = new Date();

  const summary = wb.addWorksheet('المؤشرات', { views: [{ rightToLeft: true }] });
  summary.columns = [
    { header: 'المؤشر', key: 'k', width: 32 },
    { header: 'القيمة', key: 'v', width: 22 }
  ];
  summary.addRows([
    { k: 'المدة', v: input.title },
    { k: 'الكتب الصادرة', v: input.stats.issued },
    { k: 'الإيراد المالي المستوفى (د.ع)', v: input.stats.revenue },
    { k: 'المواطنون المخدومون', v: input.stats.citizens },
    { k: 'النسخ المطبوعة', v: input.stats.printedCopies }
  ]);
  summary.getRow(1).font = { bold: true };

  const ledger = wb.addWorksheet('سجل الصادر', { views: [{ rightToLeft: true }] });
  ledger.columns = [
    { header: 'رقم الصادر', key: 'serial', width: 18 },
    { header: 'التاريخ', key: 'date', width: 14 },
    { header: 'التوقيت', key: 'time', width: 10 },
    { header: 'المواطن', key: 'name', width: 32 },
    { header: 'الرقم الوطني', key: 'nid', width: 20 },
    { header: 'الوثيقة الرسمية', key: 'type', width: 26 },
    { header: 'الجهة الموجه إليها', key: 'dest', width: 30 },
    { header: 'النسخ', key: 'copies', width: 8 },
    { header: 'الرسوم', key: 'fee', width: 12 }
  ];
  for (const r of input.rows) {
    ledger.addRow({
      serial: r.serial,
      date: r.issuedDate,
      time: r.issuedTime,
      name: r.citizenName,
      nid: r.nationalId ?? '',
      type: r.docType ?? '',
      dest: r.destination ?? '',
      copies: r.copies,
      fee: r.fee
    });
  }
  ledger.getRow(1).font = { bold: true };

  const byType = wb.addWorksheet('حسب نوع الوثيقة', { views: [{ rightToLeft: true }] });
  byType.columns = [
    { header: 'نوع الوثيقة', key: 'name', width: 34 },
    { header: 'العدد', key: 'count', width: 12 },
    { header: 'الإيراد', key: 'revenue', width: 14 }
  ];
  byType.addRows(input.stats.byType);
  byType.getRow(1).font = { bold: true };

  const byDay = wb.addWorksheet('حسب اليوم', { views: [{ rightToLeft: true }] });
  byDay.columns = [
    { header: 'اليوم', key: 'day', width: 16 },
    { header: 'العدد', key: 'count', width: 12 },
    { header: 'الإيراد', key: 'revenue', width: 14 }
  ];
  byDay.addRows(input.stats.byDay);
  byDay.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
