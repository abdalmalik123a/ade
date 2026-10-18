/**
 * فقرات Word وترويسته: تُقرأ من document.xml، وتُفصل الترويسة المكتوبة نصًّا أو في جدول
 * عن المتن، ويُبنى تخطيطها — نُقل من `import.ts` (D85).
 */
import { type Align, type LetterheadBlock, newId, type LetterheadLayout, emptyLayout, type ColumnCount } from '@shared/letterhead';
import { cleanLine, stripTatweel } from './blanks';
import { strFromU8 } from 'fflate';

export const decodeEntities = (s: string) =>
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

export function parseParagraphs(xml: string): Para[] {
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
export function layoutFromTable(tableXml: string): LetterheadLayout | null {
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
export const BODY_START = /^\s*(إلى|الى|م\s*\/|السيد|السيدة|بعد التحية|تحية طيبة|الموضوع)/;

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
export function splitLeadingLetterhead(
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
export function layoutFromHeaderParts(files: Record<string, Uint8Array>): LetterheadLayout | null {
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
