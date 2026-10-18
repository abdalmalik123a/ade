import { readFile } from 'node:fs/promises';
import { extname, basename } from 'node:path';
import { strFromU8 } from 'fflate';
import { reconcileVariables, type TemplateVariable } from '@shared/template';
import { cleanLine } from './blanks';
import { docxToDoc } from './docxDoc';
import { assertSize, unzipWord } from './importGuard';
import { scanWord } from './wordScan';
import type { ImportedTemplate } from '@shared/api';
import { decodeEntities, type ImageSaver, layoutFromHeaderParts, parseParagraphs, layoutFromTable, splitLeadingLetterhead, BODY_START } from './importLayout';
export type { ImageSaver } from './importLayout';

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
 * (والناتج `ImportedTemplate` في `@shared/api`.)
 */

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
  // XML بلا وسمٍ واحد ليس XML: نصٌّ أُعيدت تسميته، لا نموذجٌ بلا <body>.
  if (!/<[A-Za-zء-ي]/.test(xml)) throw new Error('الملف ليس XML — لا وسوم فيه، فليس نموذجًا مصدَّرًا');
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

/** ملفّات Word بصيغةٍ غير `.docx`: لا تُقرأ — تُحفظ `.docx` من Word (هـ١). */
export const OTHER_WORD = new Set(['.doc', '.dot', '.rtf', '.odt', '.docm', '.dotx', '.dotm']);

export async function importTemplateFile(
  path: string,
  saveImage?: ImageSaver
): Promise<ImportedTemplate> {
  const ext = extname(path).toLowerCase();
  const name = basename(path, ext);
  // أكبر من حدّه يُرفض قبل أن يُقرأ، والأرشيف يُفكّ بميزانيته (D51).
  if (ext === '.xml' || ext === '.docx') await assertSize(path, 'word');

  if (ext === '.xml') {
    return xmlToTemplate(await readFile(path, 'utf8'), name);
  }

  if (ext === '.docx') {
    const bytes = new Uint8Array(await readFile(path));
    const files = unzipWord(bytes, 'تعذّر فتح ملف Word — قد يكون تالفًا أو بصيغة .doc القديمة');
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
    // وما في الملف ولا يُنقل إلى الورقة — يُعرض بجانبها ويُجمع في إحصاء المجلّد (الموجة ٢).
    const scan = scanWord(files);
    const warnings: string[] = [
      'استُورد الملف ورقةً واحدة بتنسيقه — ظلّل ما يتغيّر واضغط F4',
      ...formatted.notes
    ];

    // 1) ترويسة صفحة حقيقية إن وُجدت. 2) جدول في رأس المستند. 3) أسطر مكتوبة نصًّا.
    let letterhead = layoutFromHeaderParts(files);
    // ترويسةٌ في رأس صفحة Word لا في المتن: الورقة المنسّقة لا تحملها — فيأخذها «استورد مجلدي» منها.
    const letterheadFromHeader = Boolean(letterhead);
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
      doc: formatted.doc,
      scan,
      letterheadFromHeader,
      docNotes: formatted.notes
    };
  }

  if (OTHER_WORD.has(ext)) {
    throw new Error(`«${basename(path)}» ملف Word بصيغةٍ قديمة (${ext}) — افتحه في Word واحفظه بصيغة .docx («حفظ باسم») ثم استورده`);
  }
  throw new Error(`الملف ليس Word ولا XML (${ext || 'بلا امتداد'}) — يُستورد النموذج من .docx أو .xml`);
}
