import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { reconcileVariables, type TemplateVariable } from '@shared/template';
import {
  emptyLayout,
  newId,
  type Align,
  type ColumnCount,
  type LetterheadBlock,
  type LetterheadLayout
} from '@shared/letterhead';

/**
 * استيراد نموذج من ملف — داخل التطبيق، بلا Word ولا أداة خارجية.
 *
 * .docx حزمة مضغوطة فيها word/document.xml؛ نفكّها ونقرأ الفقرات.
 * .xml نتعامل معه بصيغتنا إن وُجدت وسومها، وإلا نستخرج نصّه.
 *
 * والترويسة تُستخرج أيضًا. أكثر الكتب التي تُكتب في Word تحمل ترويسة، لكنها
 * نادرًا ما تكون «ترويسة صفحة» بالمعنى التقني: الموظف يكتبها نصًّا في أول
 * المستند، أو يضعها في جدول من خليتين أو ثلاث. فلو قرأنا رأس الصفحة وحده
 * لضاعت ترويسة أكثر الملفات — ولذلك نقرأ الاثنين.
 */

export type ImportedTemplate = {
  title: string;
  subtitle: string | null;
  category: string | null;
  code: string | null;
  subjectLine: string | null;
  body: string;
  warnings: string[];
  /** ترويسة استُخرجت من الملف — يقرّر المكتب حفظها أو تركها. */
  letterhead: LetterheadLayout | null;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/** فقرة Word بما يلزم للترويسة: نصّها ومحاذاتها وثِقلها. */
type Para = { text: string; align: Align; bold: boolean };

const ALIGN_MAP: Record<string, Align> = {
  right: 'right',
  center: 'center',
  left: 'left',
  both: 'right',
  start: 'right',
  end: 'left'
};

function parseParagraphs(xml: string): Para[] {
  return xml
    .split(/<w:p[\s>]/)
    .slice(1)
    .map((chunk) => {
      const body = chunk.split('</w:p>')[0] ?? chunk;
      const withBreaks = body.replace(/<w:br\s*\/?>/g, ' ').replace(/<w:tab\s*\/?>/g, '\t');
      const runs = [...withBreaks.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(
        (m) => m[1] ?? ''
      );
      const jc = body.match(/<w:jc[^>]*w:val="([^"]+)"/);
      return {
        text: decodeEntities(runs.join('')).trim(),
        align: ALIGN_MAP[jc?.[1] ?? ''] ?? 'right',
        bold: /<w:b\s*\/?>/.test(body)
      };
    });
}

function toBlock(para: Para, size: number): LetterheadBlock {
  return {
    id: newId('b'),
    kind: 'text',
    value: para.text,
    align: para.align,
    size,
    bold: para.bold
  };
}

/** يبني ترويسة من فقرات موزَّعة على أقسام حسب المحاذاة. */
function layoutFromGroups(groups: Para[][]): LetterheadLayout | null {
  const used = groups.filter((g) => g.length > 0);
  if (used.length === 0) return null;

  const layout = emptyLayout();
  layout.columns = Math.min(used.length, 3) as ColumnCount;
  used.slice(0, 3).forEach((group, i) => {
    layout.sections[i]!.blocks = group.map((para, j) => toBlock(para, j === 0 ? 15 : 13));
  });
  return layout;
}

/** خلايا الصفّ الأول من جدول في رأس المستند: خليّة لكل قسم. */
function layoutFromTable(tableXml: string): LetterheadLayout | null {
  const firstRow = tableXml.match(/<w:tr[\s>][\s\S]*?<\/w:tr>/);
  if (!firstRow) return null;
  const cells = [...firstRow[0].matchAll(/<w:tc[\s>]([\s\S]*?)<\/w:tc>/g)].map((m) => m[1] ?? '');
  if (cells.length < 2) return null;

  const groups = cells
    .slice(0, 3)
    .map((cell, i) =>
      parseParagraphs(cell)
        .filter((para) => para.text)
        .map((para) => ({
          ...para,
          // خلايا الجدول قد تكون بلا محاذاة صريحة؛ الموضع يحسمها.
          align: para.align === 'right' && i > 0 ? (i === cells.length - 1 ? 'left' : 'center') : para.align
        }))
    );

  return layoutFromGroups(groups);
}

/** سطر يبدأ به متن الكتاب — عنده تنتهي الترويسة قطعًا. */
const BODY_START = /^\s*(إلى|الى|م\s*\/|السيد|السيدة|بعد التحية|تحية طيبة|الموضوع)/;

/**
 * يفصل ترويسةً مكتوبةً نصًّا في أول المستند عن متنه.
 *
 * الشروط متشدّدة عمدًا: أسطر قصيرة، قليلة، قبل أول فراغ أو أول سطر من المتن،
 * ويبقى بعدها متن حقيقي. فخطأُ اقتطاع سطر من المتن أسوأ من ترك ترويسة.
 */
function splitLeadingLetterhead(paras: Para[]): { letterhead: LetterheadLayout | null; rest: Para[] } {
  const head: Para[] = [];
  let i = 0;
  for (; i < paras.length && head.length < 8; i++) {
    const para = paras[i]!;
    if (!para.text) {
      i++; // الفقرة الفارغة فاصل الترويسة عن المتن
      break;
    }
    if (BODY_START.test(para.text)) break;
    if (para.text.length > 70) break;
    head.push(para);
  }

  const rest = paras.slice(i);
  const remaining = rest.filter((x) => x.text).length;
  if (head.length < 2 || remaining < 2) return { letterhead: null, rest: paras };

  const groups: Para[][] = [[], [], []];
  for (const para of head) {
    const at = para.align === 'right' ? 0 : para.align === 'center' ? 1 : 2;
    groups[at]!.push(para);
  }

  // كل الأسطر بمحاذاة واحدة → قسم واحد بعرض الورقة.
  const layout = groups.filter((g) => g.length).length === 1
    ? layoutFromGroups([head])
    : layoutFromGroups(groups);

  return { letterhead: layout, rest };
}

/** ترويسة الصفحة الحقيقية (word/headerN.xml) إن وُجدت وكان فيها نصّ. */
function layoutFromHeaderParts(files: Record<string, Uint8Array>): LetterheadLayout | null {
  const names = Object.keys(files)
    .filter((n) => /^word\/header\d*\.xml$/.test(n))
    .sort();

  for (const name of names) {
    const xml = strFromU8(files[name]!);
    const table = xml.match(/<w:tbl[\s>][\s\S]*?<\/w:tbl>/);
    const fromTable = table ? layoutFromTable(table[0]) : null;
    if (fromTable) return fromTable;

    const paras = parseParagraphs(xml).filter((para) => para.text);
    if (paras.length === 0) continue;

    const groups: Para[][] = [[], [], []];
    for (const para of paras) {
      const at = para.align === 'right' ? 0 : para.align === 'center' ? 1 : 2;
      groups[at]!.push(para);
    }
    const layout = groups.filter((g) => g.length).length === 1
      ? layoutFromGroups([paras])
      : layoutFromGroups(groups);
    if (layout) return layout;
  }
  return null;
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
    warnings,
    letterhead: null
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

    const xml = strFromU8(doc);
    const warnings: string[] = ['الصور والتنسيق لا تُستورد — النصّ والترويسة فقط'];

    // 1) ترويسة صفحة حقيقية إن وُجدت. 2) جدول في رأس المستند. 3) أسطر مكتوبة نصًّا.
    let letterhead = layoutFromHeaderParts(files);
    let paras = parseParagraphs(xml);

    if (!letterhead) {
      const leadingTable = xml.match(/<w:body[^>]*>\s*(<w:tbl[\s>][\s\S]*?<\/w:tbl>)/);
      if (leadingTable) {
        letterhead = layoutFromTable(leadingTable[1]!);
        if (letterhead) {
          // فقرات الجدول ليست من المتن، فتُسقط منه.
          const after = xml.slice(xml.indexOf(leadingTable[1]!) + leadingTable[1]!.length);
          paras = parseParagraphs(after);
        }
      }
    }

    if (!letterhead) {
      const split = splitLeadingLetterhead(paras);
      letterhead = split.letterhead;
      paras = split.rest;
    }

    if (letterhead) warnings.push('استُخرجت ترويسة من الملف — راجعها قبل الحفظ');

    const lines = paras.map((para) => para.text);
    const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text && !letterhead) throw new Error('مستند Word فارغ من النصّ');

    // أول سطر غير فارغ عنوانٌ مرشَّح، والباقي متن — يصحّحه المكتب قبل الحفظ.
    const firstIdx = lines.findIndex((l) => l.trim());
    const title = (lines[firstIdx] ?? name).trim().slice(0, 120);
    const body = lines.slice(firstIdx + 1).join('\n').trim() || text;

    const subject = lines.find((l) => /^\s*م\s*\//.test(l));
    if (subject) warnings.push('استُنتج سطر الموضوع من نصّ المستند');

    return {
      title,
      subtitle: null,
      category: null,
      code: null,
      subjectLine: subject ? subject.replace(/^\s*م\s*\/\s*/, '').trim() : null,
      body,
      warnings,
      letterhead
    };
  }

  throw new Error('الصيغ المدعومة: .docx و .xml');
}
