import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { reconcileVariables, type TemplateVariable } from '@shared/template';

/**
 * استيراد نموذج من ملف — داخل التطبيق، بلا Word ولا أداة خارجية.
 *
 * .docx حزمة مضغوطة فيها word/document.xml؛ نفكّها ونقرأ الفقرات.
 * .xml نتعامل معه بصيغتنا إن وُجدت وسومها، وإلا نستخرج نصّه.
 */

export type ImportedTemplate = {
  title: string;
  subtitle: string | null;
  category: string | null;
  code: string | null;
  subjectLine: string | null;
  body: string;
  warnings: string[];
};

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** يحوّل فقرات Word إلى أسطر نصّية، ويحفظ فواصل الأسطر والمسافات. */
function docxToText(xml: string): string {
  const paragraphs = xml.split(/<w:p[\s>]/).slice(1);
  const lines = paragraphs.map((p) => {
    const withBreaks = p.replace(/<w:br\s*\/?>/g, '\n').replace(/<w:tab\s*\/?>/g, '\t');
    const runs = [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1] ?? '');
    return decodeEntities(runs.join(''));
  });
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]!.trim()) : null;
}

/** يحلّل نموذجًا بصيغة المشروع (كما يكتبها التصدير) بمتغيّراته. */
export function parseTemplateXml(xml: string): {
  code: string | null;
  title: string;
  subtitle: string | null;
  category: string | null;
  subjectLine: string | null;
  body: string;
  variables: TemplateVariable[];
} {
  const variables: TemplateVariable[] = [];
  for (const m of xml.matchAll(/<variable\s+([^>]*)\/>/g)) {
    const attrs = m[1] ?? '';
    const attr = (name: string) => {
      const a = attrs.match(new RegExp(`${name}="([^"]*)"`));
      return a ? decodeEntities(a[1]!) : '';
    };
    const token = attr('token');
    if (!token) continue;
    const source = attr('source');
    variables.push({
      token,
      label: attr('label') || token,
      source: (['manual', 'citizen', 'auto'].includes(source)
        ? source
        : 'manual') as TemplateVariable['source'],
      required: attr('required') === 'true'
    });
  }

  const body = tag(xml, 'body') ?? tag(xml, 'متن') ?? '';
  return {
    code: tag(xml, 'code'),
    title: tag(xml, 'title') ?? tag(xml, 'عنوان') ?? '',
    subtitle: tag(xml, 'subtitle'),
    category: tag(xml, 'category') ?? tag(xml, 'تصنيف'),
    subjectLine: tag(xml, 'subject') ?? tag(xml, 'موضوع'),
    body,
    variables: variables.length ? variables : reconcileVariables(body, [])
  };
}

function xmlToTemplate(xml: string, fallbackTitle: string): ImportedTemplate {
  const warnings: string[] = [];
  const body = tag(xml, 'body') ?? tag(xml, 'متن');
  if (!body) {
    warnings.push('لم يُعثر على وسم <body> — استُخرج نصّ الملف كاملًا');
  }
  const stripped = decodeEntities(xml.replace(/<[^>]+>/g, '\n'))
    .replace(/\n{2,}/g, '\n')
    .trim();
  return {
    title: tag(xml, 'title') ?? tag(xml, 'عنوان') ?? fallbackTitle,
    subtitle: tag(xml, 'subtitle') ?? null,
    category: tag(xml, 'category') ?? tag(xml, 'تصنيف') ?? null,
    code: tag(xml, 'code') ?? null,
    subjectLine: tag(xml, 'subject') ?? tag(xml, 'موضوع') ?? null,
    body: body ?? stripped,
    warnings
  };
}

export async function importTemplateFile(path: string): Promise<ImportedTemplate> {
  const ext = extname(path).toLowerCase();
  const name = basename(path, ext);

  if (ext === '.xml') {
    return xmlToTemplate(await readFile(path, 'utf8'), name);
  }

  if (ext === '.docx') {
    const bytes = new Uint8Array(await readFile(path));
    let files: Record<string, Uint8Array>;
    try {
      files = unzipSync(bytes);
    } catch {
      throw new Error('تعذّر فتح ملف Word — قد يكون تالفًا أو بصيغة .doc القديمة');
    }
    const doc = files['word/document.xml'];
    if (!doc) throw new Error('الملف ليس مستند Word صالحًا (لا يحتوي word/document.xml)');

    const text = docxToText(strFromU8(doc));
    if (!text) throw new Error('مستند Word فارغ من النصّ');

    // أول سطر غير فارغ عنوانٌ مرشَّح، والباقي متن — يصحّحه المكتب قبل الحفظ.
    const lines = text.split('\n');
    const firstIdx = lines.findIndex((l) => l.trim());
    const title = (lines[firstIdx] ?? name).trim().slice(0, 120);
    const body = lines.slice(firstIdx + 1).join('\n').trim() || text;

    const warnings = ['الصور والجداول والتنسيق لا تُستورد — النصّ فقط'];
    const subject = lines.find((l) => /^\s*م\s*\//.test(l));
    if (subject) warnings.push('استُنتج سطر الموضوع من نصّ المستند');

    return {
      title,
      subtitle: null,
      category: null,
      code: null,
      subjectLine: subject ? subject.replace(/^\s*م\s*\/\s*/, '').trim() : null,
      body,
      warnings
    };
  }

  throw new Error('الصيغ المدعومة: .docx و .xml');
}
