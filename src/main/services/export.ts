import { AlignmentType, HeadingLevel, Paragraph, TextRun } from 'docx';
import ExcelJS from 'exceljs';
import type { DocumentRow, PeriodStats, TemplateDetail } from '@shared/api';
import { layoutText, normalizeLayout, visibleSections, type Letterhead } from '@shared/letterhead';
import { docToDocx } from './docDocx';
import { templateDoc } from './templates';

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

export async function templateToDocx(
  t: TemplateDetail,
  letterhead: Letterhead | null,
  image?: (src: string) => Uint8Array | null
): Promise<Buffer> {
  const children: Paragraph[] = [];

  // الترويسة كما بناها المكتب — نصّها فقط، فالصور لا تُنقل إلى Word هنا.
  // الأقسام تُقرأ بالترتيب من اليمين، سطرًا بعد سطر.
  const layout = letterhead ? normalizeLayout(letterhead.layout) : null;
  // رأسٌ من ورقة: نصّه سطرًا سطرًا، كما تُنقل الأقسام.
  for (const line of layout?.sheet?.length ? layoutText(layout).split('\n') : []) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        bidirectional: true,
        children: [new TextRun({ text: line, rightToLeft: true })]
      })
    );
  }
  const headerBlocks = layout && !layout.sheet?.length ? visibleSections(layout).flatMap((s) => s.blocks) : [];
  for (const block of headerBlocks) {
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

  // المتن من الوثيقة نفسها بتنسيقها — لا ظلّها النصّي (التدقيق المستقل): كانت الجداول
  // والأعمدة والمحاذاة تضيع، ويخرج نموذجٌ لا يشبه ما في المكتبة.
  return docToDocx(templateDoc(t), { title: t.title, before: children, image });
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
    { header: 'النسخ', key: 'copies', width: 8 }
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
      copies: r.copies
    });
  }
  ledger.getRow(1).font = { bold: true };

  const byType = wb.addWorksheet('حسب نوع الوثيقة', { views: [{ rightToLeft: true }] });
  byType.columns = [
    { header: 'نوع الوثيقة', key: 'name', width: 34 },
    { header: 'العدد', key: 'count', width: 12 }
  ];
  byType.addRows(input.stats.byType);
  byType.getRow(1).font = { bold: true };

  const byDay = wb.addWorksheet('حسب اليوم', { views: [{ rightToLeft: true }] });
  byDay.columns = [
    { header: 'اليوم', key: 'day', width: 16 },
    { header: 'العدد', key: 'count', width: 12 }
  ];
  byDay.addRows(input.stats.byDay);
  byDay.getRow(1).font = { bold: true };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
