import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { unzipSync, strFromU8 } from 'fflate';
import { reconcileVariables, type TemplateVariable } from '@shared/template';
import { stripTatweel, cleanLine } from './blanks';
import { docxToDoc } from './docxDoc';
import type { Doc } from '@shared/doc';
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
  /** الملف ورقةً واحدة بتنسيقه كما رسمه Word (`docxDoc.ts`). */
  doc?: Doc | null;
};

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

/**
 * فقرة Word بما يلزم للترويسة: نصّها ومحاذاتها وثِقلها، وصورتها إن كانت
 * فقرة شعار، والنصّ الخام قبل ضغط المسافات — فالمسافات الطويلة في كتب Word
 * ليست زخرفًا: بها يفصل الموظف يمين الترويسة عن يسارها.
 */
type Para = {
  text: string;
  raw: string;
  align: Align;
  bold: boolean;
  /** معرّف العلاقة للصورة داخل الفقرة (r:embed). */
  imageRel: string | null;
};

/** ملف يُنقل من حزمة Word إلى مخزن التطبيق فيعيد مساره النسبي. */
export type ImageSaver = (bytes: Uint8Array, extension: string) => string | null;

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
      const embed = body.match(/r:(?:embed|id)="([^"]+)"/);
      const raw = decodeEntities(runs.join(''));
      return {
        text: raw.replace(/\s+/g, ' ').trim(),
        raw,
        align: ALIGN_MAP[jc?.[1] ?? ''] ?? 'right',
        bold: /<w:b\s*\/?>/.test(body),
        imageRel: /<w:drawing|<v:imagedata|<w:pict/.test(body) ? (embed?.[1] ?? null) : null
      };
    });
}

function toBlock(para: Para, size: number): LetterheadBlock {
  return {
    id: newId('b'),
    kind: 'text',
    // الترويسة تُنظَّف كما يُنظَّف المتن: `للبنيـــــــن` مدَّها الموظف في Word
    // ليملأ السطر، وورقتنا تعيد الصفّ بنفسها فتخرج مهلهلة إن بقي المدّ.
    value: cleanLine(para.text).text,
    align: para.align,
    size,
    bold: para.bold
  };
}

function imageBlock(path: string, align: Align): LetterheadBlock {
  return { id: newId('b'), kind: 'image', value: path, align, size: 12, bold: false, width: 90 };
}

/**
 * يفصل سطرًا كُتب عمودين بمسافات أو جدولة.
 *
 * أكثر ترويسات Word في الدوائر مكتوبة هكذا: اسم الجهة يمينًا، ثم فراغ طويل،
 * ثم «العدد:» و«التاريخ:» يسارًا — كلّه في فقرة واحدة. فلو أُخذ السطر كما هو
 * لخرجت الترويسة سطرًا واحدًا مشوّهًا.
 */
function splitColumns(raw: string): { right: string; left: string } | null {
  // المسافات في أول السطر وآخره إزاحةٌ لا فاصل — والفاصل ما وقع بين كلمتين.
  const line = raw.replace(/^[^\S\n]+|[^\S\n]+$/g, '');
  const gap = line.match(/[^\S\n]{6,}|\t+/);
  if (!gap || gap.index === undefined) return null;
  const right = line.slice(0, gap.index).replace(/\s+/g, ' ').trim();
  const left = line.slice(gap.index + gap[0].length).replace(/\s+/g, ' ').trim();
  if (!right || !left) return null;
  return { right, left };
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
 * الشروط متشدّدة عمدًا: أسطر قصيرة، قليلة، قبل أول سطر من المتن، ويبقى بعدها
 * متن حقيقي. فخطأُ اقتطاع سطر من المتن أسوأ من ترك ترويسة.
 *
 * والفقرات الفارغة في أول المستند تُتخطّى ولا تُنهي الجمع: أكثر ملفات Word
 * تبدأ بسطر فارغ أو سطرين قبل الترويسة، وفارغةٌ واحدة بين سطر الجهة وشعارها
 * أمرٌ معتاد — فإنهاء الجمع عندها كان يُضيّع الترويسة كلّها.
 */
function splitLeadingLetterhead(
  paras: Para[],
  saveImage?: ImageSaver,
  resolveImage?: (rel: string) => { bytes: Uint8Array; ext: string } | null
): { letterhead: LetterheadLayout | null; rest: Para[] } {
  const head: Para[] = [];
  let i = 0;

  // تخطّي الفراغ الذي يسبق الترويسة
  while (i < paras.length && !paras[i]!.text && !paras[i]!.imageRel) i++;

  for (; i < paras.length && head.length < 10; i++) {
    const para = paras[i]!;

    /**
     * الفقرة الفارغة تنهي الترويسة — إلا أن يليها شعار.
     *
     * الشعار يُوضع عادةً تحت اسم الجهة بفراغ بينهما، فلو أنهينا عنده لضاع.
     * ولو تجاوزنا كل فراغ لابتلعت الترويسةُ أسطرَ المتن القصيرة بعده.
     */
    if (!para.text && !para.imageRel) {
      const next = paras.slice(i + 1, i + 3).find((x) => x.text || x.imageRel);
      if (!next || !next.imageRel) {
        i++;
        break;
      }
      continue;
    }

    if (BODY_START.test(para.text)) break;
    if (para.text.length > 70) break;
    head.push(para);
  }

  const rest = paras.slice(i);
  const remaining = rest.filter((x) => x.text).length;
  const content = head.filter((x) => x.text || x.imageRel);
  if (content.length < 2 || remaining < 2) return { letterhead: null, rest: paras };

  const right: Para[] = [];
  const left: Para[] = [];
  const middle: Para[] = [];
  let images: { para: Para; column: 'right' | 'middle' }[] = [];

  for (const para of head) {
    if (para.imageRel) {
      images.push({ para, column: 'middle' });
      continue;
    }
    const columns = splitColumns(para.raw);
    if (columns) {
      right.push({ ...para, text: columns.right, align: 'right' });
      left.push({ ...para, text: columns.left, align: 'left' });
      continue;
    }
    const at = para.align === 'center' ? middle : para.align === 'left' ? left : right;
    at.push(para);
  }

  // الشعار يلحق بالقسم الذي فيه اسم الجهة ما لم يكن هناك قسم وسط.
  const imageBlocks: LetterheadBlock[] = [];
  if (saveImage && resolveImage) {
    for (const { para } of images) {
      const file = para.imageRel ? resolveImage(para.imageRel) : null;
      if (!file) continue;
      const stored = saveImage(file.bytes, file.ext);
      if (stored) imageBlocks.push(imageBlock(stored, 'center'));
    }
  }
  images = [];

  const toBlocks = (list: Para[]) => list.map((para, j) => toBlock(para, j === 0 ? 15 : 13));
  const rightBlocks = [...toBlocks(right), ...(middle.length === 0 ? imageBlocks : [])];
  const middleBlocks = [...toBlocks(middle), ...(middle.length > 0 ? imageBlocks : [])];
  const leftBlocks = toBlocks(left);

  const columns = [rightBlocks, middleBlocks, leftBlocks].filter((b) => b.length > 0);
  if (columns.length === 0) return { letterhead: null, rest: paras };

  const layout = emptyLayout();
  layout.columns = Math.min(columns.length, 3) as ColumnCount;
  columns.slice(0, 3).forEach((blocks, at) => {
    layout.sections[at]!.blocks = blocks;
  });

  // العدد والتاريخ يُنتزعان من القسم الأخير إلى حقلَي السجل — وإلا بقيا نصًّا
  // ميّتًا لا يعرف البرنامج أين يطبع فيه رقم الصادر.
  const lastAt = layout.columns - 1;
  const last = layout.sections[lastAt]!;
  const found = takeRegistryLines(last.blocks);
  if (found.taken) {
    last.blocks = found.blocks;
    // والأصل فراغ: هكذا كُتبا في الملف ليملأهما موظّف الاستلام بخطّه.
    layout.registry = { show: true, mode: 'manual' };
    // ويبقى القسم الأخير ولو خلا من الكتل — فهو موضعهما على الورقة، وتقليل
    // الأقسام يدفعهما إلى عمود اسم الجهة فتنقلب الترويسة.
  }

  return { letterhead: layout, rest };
}

const REGISTRY_SERIAL = /^\s*(?:العدد|الرقم)\s*[:：]?\s*$/;
const REGISTRY_DATE = /^\s*(?:التاريخ|تاريخ)\s*[:：]?\s*(?:[\/\s\d٠-٩.]*)$/;

/**
 * ينتزع سطرَي «العدد:» و«التاريخ:» من كتل القسم.
 *
 * الموظف يكتبهما نصًّا في يسار الترويسة ويتركهما فراغًا، وللبرنامج نموذجٌ
 * لهما يطبع الفراغ نفسه ويعرف أين يحلّ رقم الصادر إن أراده مطبوعًا.
 */
function takeRegistryLines(blocks: LetterheadBlock[]): {
  blocks: LetterheadBlock[];
  taken: boolean;
} {
  const kept = blocks.filter((b) => {
    if (b.kind !== 'text') return true;
    const text = stripTatweel(b.value);
    return !(REGISTRY_SERIAL.test(text) || REGISTRY_DATE.test(text));
  });
  return { blocks: kept, taken: kept.length !== blocks.length };
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

export async function importTemplateFile(
  path: string,
  saveImage?: ImageSaver
): Promise<ImportedTemplate> {
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
    /**
     * الورقة كما صنعها Word — قطعةً واحدة بتنسيقها.
     *
     * والترويسة تُستخرج بعدها كما كانت: «استورد مجلدي» يحتاجها ليكتشف رأسًا
     * يتكرّر في مئات الملفات. أما الملف الواحد فيُفتح على ورقته كاملة.
     */
    // الصورة الواحدة تُطلب مرّتين — للورقة وللترويسة — فتُنقل إلى المخزن مرّة.
    const saved = new Map<Uint8Array, string | null>();
    if (saveImage) {
      const store = saveImage;
      saveImage = (bytes, ext) => {
        if (!saved.has(bytes)) saved.set(bytes, store(bytes, ext));
        return saved.get(bytes)!;
      };
    }
    const formatted = docxToDoc(files, saveImage);
    const warnings: string[] = [
      'استُورد الملف ورقةً واحدة بتنسيقه — ظلّل ما يتغيّر واضغط F4',
      ...formatted.notes
    ];

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
      // خريطة العلاقات: rId → word/media/image1.gif
      const rels = files['word/_rels/document.xml.rels'];
      const targets = new Map<string, string>();
      if (rels) {
        for (const m of strFromU8(rels).matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
          targets.set(m[1]!, m[2]!.replace(/^\/?word\//, '').replace(/^\.\.\//, ''));
        }
      }
      const resolveImage = (rel: string) => {
        const target = targets.get(rel);
        const bytes = target ? files[`word/${target}`] : undefined;
        if (!bytes) return null;
        const dot = target!.lastIndexOf('.');
        return { bytes, ext: dot > 0 ? target!.slice(dot) : '.png' };
      };

      const split = splitLeadingLetterhead(paras, saveImage, resolveImage);
      letterhead = split.letterhead;
      paras = split.rest;
    }

    if (letterhead) warnings.push('استُخرجت ترويسة من الملف — راجعها قبل الحفظ');

    const lines = paras.map((para) => para.text);
    const text = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!text && !letterhead) throw new Error('مستند Word فارغ من النصّ');

    const subject = lines.find((l) => /^\s*م\s*\//.test(l));
    const subjectLine = subject
      ? cleanLine(subject.replace(/^\s*م\s*\/\s*/, '')).text || null
      : null;
    if (subject) warnings.push('استُنتج سطر الموضوع من نصّ المستند');

    // سطر الموضوع يُرفع من المتن: الورقة تطبعه بنفسها، وإبقاؤه يكرّره.
    const bodyLines = lines.filter((l) => l !== subject);

    /**
     * العنوان: عنوانُ المستند إن كان له عنوان، وإلا فسطر الموضوع، وإلا اسم الملف.
     *
     * وعنوان المستند سطرٌ قصير بلا نقطة في آخره ولا مخاطبة في أوّله — أما
     * «نؤيد لكم بأن السيد فلانًا...» فجملةٌ من المتن، واتّخاذها عنوانًا كان
     * يقتطعها منه.
     */
    const firstIdx = bodyLines.findIndex((l) => l.trim());
    const firstLine = (bodyLines[firstIdx] ?? '').trim();
    const looksLikeHeading =
      firstLine.length > 0 &&
      firstLine.length <= 60 &&
      !/[.!؟]$/.test(firstLine) &&
      !BODY_START.test(firstLine);
    const titleFromBody = looksLikeHeading ? firstLine : null;
    const title = cleanLine(titleFromBody ?? subjectLine ?? name).text.slice(0, 120);
    const kept = titleFromBody ? bodyLines.slice(firstIdx + 1) : bodyLines;
    const rawBody = kept.join('\n').trim() || bodyLines.join('\n').trim();

    /**
     * تنظيف آثار الكتابة اليدوية في Word: التمديد، و«0» بدل النقطة.
     *
     * والفراغات تبقى كما كتبها الموظف — هي متغيّرات الورقة، وتحويلها حقولًا
     * يجري في شاشة المراجعة حيث يحكم هو لا المحرّك.
     */
    const cleanNotes = new Set<string>();
    const body = rawBody
      .split('\n')
      .map((line) => {
        if (!line.trim()) return line;
        const done = cleanLine(line);
        for (const n of done.notes) cleanNotes.add(n);
        return done.text;
      })
      .join('\n');
    for (const note of cleanNotes) warnings.push(note);

    return {
      title,
      subtitle: null,
      category: null,
      code: null,
      subjectLine,
      body,
      warnings,
      letterhead,
      doc: formatted.doc
    };
  }

  throw new Error('الصيغ المدعومة: .docx و .xml');
}
