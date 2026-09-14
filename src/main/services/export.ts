import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { TemplateDetail } from '@shared/api';
import type { Letterhead } from '@shared/letterhead';

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
