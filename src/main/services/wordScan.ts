/**
 * كشف ما لا يُنقل من ملف Word (الموجة ٢، «كلفة الانتقال») — والأسماء والجمع في `shared/wordLosses.ts`.
 *
 * يقرأ الملف كما يقرؤه `docxDoc.ts` ويعدّ ما يتركه ذلك القارئ: فكلّ بندٍ هنا مقيسٌ على ما يفعله القارئ لا على
 * ما يظنّه — مربّع النصّ يُعدّ لأنّ القارئ لا يأخذ إلا نصّ المقطع نفسه، والصورة في خليّة جدولٍ لأنّ الخليّة
 * تأخذ فقراتها وحدها، والخطّ لأنّ القارئ لا يقرأ `w:rFonts`. فإن تعلّم القارئ شيئًا منها سقط بنده هنا معه.
 *
 * ويُعدّ معها ما يُعرف به عمل المكاتب للإحصاء: الجداول والصور والقوائم ومقاس الورق والخطوط.
 */
import { strFromU8 } from 'fflate';
import { parseXml, type XNode } from './docxXml';
import type { WordLossKey, WordScan } from '@shared/wordLosses';
import { lightColor } from '@shared/docPmMarks';

const kid = (n: XNode | undefined, name: string) => n?.kids.find((k) => k.name === name);
const has = (n: XNode, name: string): boolean => n.kids.some((k) => k.name === name || has(k, name));
/** خاصّيةٌ مشعولة: موجودةٌ بلا `w:val` أو بقيمةٍ غير «لا». */
const on = (n: XNode | undefined) => n !== undefined && !['0', 'false', 'off', 'none'].includes((n.attrs['w:val'] ?? 'true').toLowerCase());

/** تظليلٌ يُرى: لونٌ غير الأبيض والتلقائي، أو نقشٌ بلون. */
function shaded(shd: XNode | undefined): boolean {
  if (!shd) return false;
  const fill = (shd.attrs['w:fill'] ?? 'auto').toLowerCase();
  const pattern = (shd.attrs['w:val'] ?? 'clear').toLowerCase();
  const color = (shd.attrs['w:color'] ?? 'auto').toLowerCase();
  return !['auto', 'ffffff', ''].includes(fill) || (!['clear', 'nil'].includes(pattern) && !['auto', 'ffffff'].includes(color));
}

/** مقاس الورقة باسمه — بالتسامح نفسه الذي يأخذ به `pageSetupFrom` في القارئ. */
function pageName(sect: XNode | undefined): { name: string | null; landscape: boolean } {
  const sz = kid(sect, 'w:pgSz');
  if (!sz) return { name: null, landscape: false };
  const w = Number(sz.attrs['w:w'] ?? 11906);
  const h = Number(sz.attrs['w:h'] ?? 16838);
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
  const name =
    near(short, 8391, 300) ? 'A5'
    : near(short, 11906, 300) && near(long, 18720, 400) ? 'F4 (فولسكاب)'
    : near(short, 11906, 300) && near(long, 16838, 300) ? 'A4'
    : near(short, 12240, 200) && near(long, 15840, 200) ? 'Letter'
    : near(short, 12240, 200) && near(long, 20160, 300) ? 'Legal'
    : near(short, 16838, 300) && near(long, 23811, 300) ? 'A3'
    : 'أخرى';
  return { name, landscape: (sz.attrs['w:orient'] ?? '') === 'landscape' || w > h };
}

/** بصمة القسم: مقاسه واتجاهه وهوامشه وأعمدته — قسمان بالبصمة نفسها لا يُفقد بينهما شيء. */
function sectionSig(s: XNode): string {
  const attrs = (name: string) => JSON.stringify(kid(s, name)?.attrs ?? {});
  return [attrs('w:pgSz'), attrs('w:pgMar'), attrs('w:cols')].join('|');
}

export function scanWord(files: Record<string, Uint8Array>): WordScan {
  const losses: Partial<Record<WordLossKey, number>> = {};
  const add = (key: WordLossKey, n = 1) => {
    losses[key] = (losses[key] ?? 0) + n;
  };
  const fonts = new Set<string>();
  const fontsOf = (rFonts: XNode | undefined) => {
    for (const a of ['w:cs', 'w:ascii', 'w:hAnsi']) {
      const f = rFonts?.attrs[a]?.trim();
      if (f) fonts.add(f);
    }
  };
  let tables = 0;
  let images = 0;
  let lists = 0;
  const sections: string[] = [];

  const main = files['word/document.xml'];
  if (!main) return { losses, fonts: [], tables, images, lists, page: null, landscape: false };
  const root = parseXml(strFromU8(main));

  const section = (s: XNode) => {
    sections.push(sectionSig(s));
    if (Number(kid(s, 'w:cols')?.attrs['w:num'] ?? '1') > 1) add('columns');
    if (kid(s, 'w:pgBorders')) add('pageBorder');
  };

  // الشكل في Word الحديث مرّتين: رسمٌ (`mc:Choice`) ونسخةٌ قديمة له (`mc:Fallback`) — يُعدّ الرسم وحده.
  const drawing = (d: XNode, inCell: boolean) => {
    if (has(d, 'wps:txbx') || has(d, 'w:txbxContent')) add('textbox');
    else if (has(d, 'a:blip')) {
      images++;
      if (inCell) add('cellImage');
    } else if (has(d, 'c:chart')) add('chart');
    else if (has(d, 'dgm:relIds')) add('smartArt');
    else add('shape');
  };
  const vml = (p: XNode, inCell: boolean) => {
    if (has(p, 'o:OLEObject')) add('embedded');
    else if (has(p, 'v:textbox')) add('textbox');
    else if (has(p, 'v:imagedata')) {
      images++;
      if (inCell) add('cellImage');
    } else add('shape');
  };

  // اللون والشطب وأعلى السطر وأسفله يقرؤها القارئ (محادثة «محرّر الكتاب») — إلا اللون الفاتح: يُكتب أسود، فالورقة بيضاء.
  const runProps = (r: XNode) => {
    const hex = kid(r, 'w:color')?.attrs['w:val'] ?? 'auto';
    if (/^[0-9a-f]{6}$/i.test(hex) && lightColor(`#${hex}`)) add('color');
    const mark = kid(r, 'w:highlight');
    if ((mark && on(mark)) || shaded(kid(r, 'w:shd'))) add('highlight');
    fontsOf(kid(r, 'w:rFonts'));
  };

  const paraProps = (p: XNode) => {
    const border = kid(p, 'w:pBdr');
    // الحدّ السفلي وحده خطٌّ فاصل يُنقل؛ وما سواه إطارٌ حول الفقرة.
    const framed = border?.kids.some((b) => b.name !== 'w:bottom' && !['nil', 'none'].includes(b.attrs['w:val'] ?? 'none'));
    if (shaded(kid(p, 'w:shd')) || framed) add('paraShading');
    const leaders = kid(p, 'w:tabs')?.kids.some((t) => ['dot', 'hyphen', 'underscore', 'heavy', 'middleDot'].includes(t.attrs['w:leader'] ?? ''));
    if (leaders) add('tabLeader');
    const numId = kid(kid(p, 'w:numPr'), 'w:numId')?.attrs['w:val'];
    if (numId && numId !== '0') lists++;
    const sect = kid(p, 'w:sectPr');
    if (sect) section(sect);
  };

  const walk = (n: XNode, inCell: boolean) => {
    for (const k of n.kids) {
      switch (k.name) {
        case 'mc:Fallback':
          break;
        case 'w:background':
          add('pageBorder');
          break;
        case 'w:tbl':
          tables++;
          if (inCell) add('nestedTable');
          walk(k, inCell);
          break;
        case 'w:tc':
          if (shaded(kid(kid(k, 'w:tcPr'), 'w:shd'))) add('cellShading');
          walk(k, true);
          break;
        case 'w:drawing':
          drawing(k, inCell);
          break;
        case 'w:pict':
        case 'w:object':
          vml(k, inCell);
          break;
        case 'm:oMath':
          add('equation');
          break;
        case 'w:sym':
          add('symbol');
          break;
        case 'w:footnoteReference':
        case 'w:endnoteReference':
          add('footnote');
          break;
        case 'w:commentReference':
          add('comments');
          break;
        case 'w:del':
        case 'w:moveFrom':
          add('trackChanges');
          break;
        case 'w:ins':
        case 'w:moveTo':
          add('trackChanges');
          walk(k, inCell);
          break;
        case 'w:rPr':
          // خصائص المقطع وحدها: `rPr` في `pPr` علامة الفقرة لا نصٌّ يُرى.
          if (n.name === 'w:r') runProps(k);
          break;
        case 'w:pPr':
          paraProps(k);
          break;
        case 'w:sectPr':
          section(k);
          break;
        default:
          walk(k, inCell);
      }
    }
  };
  walk(root, false);

  // آخر قسمٍ ما يأخذه القارئ؛ وما اختلف عنه قبله يُفقد إعداده.
  const last = sections[sections.length - 1];
  const differ = sections.slice(0, -1).filter((s) => s !== last).length;
  if (differ) add('sections', differ);

  const body = kid(kid(root, 'w:document'), 'w:body');
  const page = pageName(kid(body, 'w:sectPr'));
  if (page.name && !['A4', 'A5', 'F4 (فولسكاب)'].includes(page.name)) add('pageSize');

  // رأس الصفحة وتذييلها: القارئ يرسم المتن وحده.
  for (const [path, bytes] of Object.entries(files)) {
    const part = /^word\/(header|footer)\d*\.xml$/.exec(path)?.[1];
    if (!part) continue;
    const xml = strFromU8(bytes);
    const watermark = part === 'header' && /<v:textpath|PowerPlusWaterMarkObject|WordPictureWatermark/.test(xml);
    if (watermark) add('watermark');
    const text = /<w:t(?:\s[^>]*)?>[^<]*\S/.test(xml);
    const picture = !watermark && /<a:blip|<v:imagedata/.test(xml);
    if (text || picture) add(part === 'header' ? 'header' : 'footer');
  }

  // خطّ المتن الافتراضي: من إعدادات المستند ونمط «Normal».
  const styles = files['word/styles.xml'];
  if (styles) {
    const st = parseXml(strFromU8(styles));
    const stylesRoot = kid(st, 'w:styles');
    fontsOf(kid(kid(kid(kid(stylesRoot, 'w:docDefaults'), 'w:rPrDefault'), 'w:rPr'), 'w:rFonts'));
    const normal = stylesRoot?.kids.find((s) => s.name === 'w:style' && s.attrs['w:default'] === '1' && s.attrs['w:type'] === 'paragraph');
    fontsOf(kid(kid(normal, 'w:rPr'), 'w:rFonts'));
  }
  if (fonts.size) add('font', fonts.size);

  return { losses, fonts: [...fonts].sort(), tables, images, lists, page: page.name, landscape: page.landscape };
}
