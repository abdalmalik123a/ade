/**
 * استيراد التصاميم — Word: المقاس من `w:pgSz` بالـtwip، ومربّعات النصّ والصور بمواضعها بالـEMU (DESIGNS.md ٠٫٩)،
 * وكلّ مربّعٍ بخطّه ولونه وعريضه ومحاذاته وحجمه من ملفّه (S44) — كما يُستورد Photoshop.
 */
import { basename } from 'node:path';
import { strFromU8 } from 'fflate';
import { clampBox, type CanvasSize } from '@shared/canvas';
import { tokenInlines, type Align } from '@shared/doc';
import { BUNDLED_FONTS, cleanFamily, matchFamily, stackOf } from '@shared/fonts';
import { EMU_MM, TWIP_MM, type DesignImport } from './importTypes';
import { unzipWord } from '../importGuard';
import { chain, readP, readR, readStyles, type PProps, type RProps } from '../docxStyles';
import { find, kid, kidsOf, parseXml, val, type XNode } from '../docxXml';
import { mapJc } from '../docxRuns';

// ── Word ─────────────────────────────────────────────────────────────

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&');

const attr = (xml: string, name: string): string | null =>
  new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1] ?? null;

const numAttr = (xml: string, name: string): number | null => {
  const raw = attr(xml, name);
  const n = raw === null ? NaN : Number(raw);
  return Number.isFinite(n) ? n : null;
};

/** نصّ فقرات Word داخل مقطعٍ ما، بلا وسومها. */
function paragraphText(xml: string): string {
  return xml
    .replace(/<w:tab\b[^>]*\/>/g, ' ')
    .replace(/<w:br\b[^>]*\/>/g, '\n')
    .split(/<w:p\b/)
    .map((chunk) => decodeEntities([...chunk.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('')))
    .filter((line) => line.trim())
    .join('\n');
}

// ── شكل النصّ (S44) ──────────────────────────────────────────────────

type TextStyle = { font?: string; color?: string; bold?: boolean; align?: Align; size?: number };

const ARABIC = /[؀-ۿ]/;

/** كلّ فقرات المقطع بترتيبها، في أيّ عمق (مربّع النصّ في `mc:AlternateContent` وأخواته). */
function paragraphsOf(n: XNode, out: XNode[] = []): XNode[] {
  for (const k of n.kids) {
    if (k.name === 'w:p') out.push(k);
    else paragraphsOf(k, out);
  }
  return out;
}

const runText = (r: XNode) => kidsOf(r, 'w:t').map((t) => t.text).join('');

/**
 * قارئ شكل مربّعات النصّ: أنماط المستند مرّةً للملفّ (`readStyles` كقارئ الكتب)، ولكلّ مربّعٍ أوّلُ فقرةٍ فيه وأوّلُ مقطعٍ له نصّ —
 * ما كُتب عليه، ثم نمطه، ثم نمط فقرته، ثم افتراض المستند. والخطّ من `w:rFonts`: `w:cs` للعربيّ (أو `w:hint="cs"`) وإلا `w:ascii`،
 * يُطابَق بـ«خطوط ديوان»، وما لم يُطابَق يبقى خطّ الورقة ويُجمع اسمه في `missing` ليُقال مرّةً.
 */
function styleReader(zip: Record<string, Uint8Array>, families: string[]) {
  const stylesXml = zip['word/styles.xml'] ? strFromU8(zip['word/styles.xml']) : undefined;
  const styles = readStyles(stylesXml);
  // `readStyles` لا يحمل خطوط الافتراض (`w:rFonts` لا يقرؤه `readR`) — فتُقرأ من عقدتها هنا.
  const defaultFonts = stylesXml ? kid(kid(kid(find(parseXml(stylesXml), 'w:docDefaults'), 'w:rPrDefault'), 'w:rPr'), 'w:rFonts') : undefined;
  const missing = new Set<string>();

  function styleOf(anchorXml: string): TextStyle {
    let para: XNode | undefined;
    let run: XNode | undefined;
    for (const p of paragraphsOf(parseXml(anchorXml))) {
      run = kidsOf(p, 'w:r').find((r) => runText(r).trim());
      if (run) {
        para = p;
        break;
      }
    }
    if (!para || !run) return {};
    const ppr = kid(para, 'w:pPr');
    const rpr = kid(run, 'w:rPr');
    const paraStyles = chain(styles, val(kid(ppr, 'w:pStyle')) ?? styles.defaultPara);
    const runStyles = chain(styles, val(kid(rpr, 'w:rStyle')));
    const pp: PProps = Object.assign({}, styles.p, ...paraStyles.map((s) => s.p), readP(ppr));
    const rr: RProps = Object.assign({}, styles.r, ...paraStyles.map((s) => s.r), ...runStyles.map((s) => s.r), readR(rpr));
    const cs = ARABIC.test(runText(run)) || rr.rtl === true;

    const out: TextStyle = {};
    if (cs ? rr.bCs || rr.b : rr.b) out.bold = true;
    if (rr.color) out.color = rr.color;
    const sz = cs ? (rr.szCs ?? rr.sz) : rr.sz;
    if (sz) out.size = sz / 2;
    if (pp.jc !== undefined || pp.bidi !== undefined) out.align = mapJc(pp.jc, pp.bidi ?? false);

    // الخطّ: الأقرب أوّلًا — المقطع، ثم نمطه، ثم نمط فقرته من الأقرب، ثم الافتراض.
    const levels = [kid(rpr, 'w:rFonts'), ...[...runStyles, ...paraStyles].reverse().map((s) => kid(kid(s.node, 'w:rPr'), 'w:rFonts')), defaultFonts];
    for (const f of levels) {
      if (!f) continue;
      const name = cs || f.attrs['w:hint'] === 'cs' ? f.attrs['w:cs'] : f.attrs['w:ascii'];
      if (!name) continue;
      const match = matchFamily(name, families);
      if (match) out.font = stackOf(match);
      else if (cleanFamily(name)) missing.add(cleanFamily(name));
      break;
    }
    return out;
  }

  return { styleOf, missing };
}

/**
 * لوحةٌ من ملف Word.
 *
 * والشهادة في Word ليست فقرات: هي مربّعاتُ نصٍّ وصورٌ **مثبّتةٌ بمواضعها**
 * (`wp:anchor`) فوق خلفية. ولذلك تُقرأ مواضعها لا نصّها وحده — وبغير ذلك تخرج
 * الشهادة كومةَ أسطرٍ في أعلى الورقة.
 *
 * `families`: «خطوط ديوان» — المحزوم وحده إن لم يُعطَ (الاختبار)، وفي البرنامج ما أضافه المكتب معه (كـ`psdDesign`).
 */
export function wordDesign(bytes: Uint8Array, name: string, families: string[] = BUNDLED_FONTS.map((f) => f.family)): DesignImport {
  // يُفكّ بميزانيته (D51).
  const zip = unzipWord(bytes, 'تعذّر فتح ملف Word — قد يكون تالفًا أو مقطوعًا، أو بصيغة .doc القديمة (احفظه .docx)');
  const doc = zip['word/document.xml'];
  const warnings: string[] = [];
  if (!doc) throw new Error('الملف ليس مستند Word — لا مستند فيه');
  const xml = strFromU8(doc);

  // ── المقاس: twips ────────────────────────────────────────────────
  const pgSz = /<w:pgSz\b[^>]*\/?>/.exec(xml)?.[0] ?? '';
  const twW = numAttr(pgSz, 'w:w');
  const twH = numAttr(pgSz, 'w:h');
  const landscape = attr(pgSz, 'w:orient') === 'landscape';
  let size: CanvasSize | null = null;
  if (twW && twH) {
    const w = twW * TWIP_MM;
    const h = twH * TWIP_MM;
    // `w:orient` وصفٌ لا مقاس: الأبعاد نفسها مبدَّلةٌ في بعض الملفات ومستقيمةٌ في غيرها.
    size = landscape && w < h ? { w: h, h: w } : { w, h };
  } else {
    warnings.push('الملف لا يذكر مقاس الصفحة — اختر المقاس');
  }

  // ── العلاقات والصور ──────────────────────────────────────────────
  const relsRaw = zip['word/_rels/document.xml.rels'];
  const rels = new Map<string, string>();
  if (relsRaw) {
    for (const m of strFromU8(relsRaw).matchAll(/<Relationship\b[^>]*\/>/g)) {
      const id = attr(m[0], 'Id');
      const target = attr(m[0], 'Target');
      if (id && target) rels.set(id, target.replace(/^\.?\/?/, '').replace(/^word\//, ''));
    }
  }

  const images: DesignImport['images'] = [];
  const imageIndex = new Map<string, number>();
  const putImage = (rel: string): number | undefined => {
    if (imageIndex.has(rel)) return imageIndex.get(rel);
    const target = rels.get(rel);
    const file = target ? zip[`word/${target}`] : undefined;
    if (!file) return undefined;
    const at = images.length;
    images.push({ name: basename(target!), bytes: file });
    imageIndex.set(rel, at);
    return at;
  };

  // ── العناصر المثبَّتة بمواضعها ───────────────────────────────────
  const elements: DesignImport['elements'] = [];
  const reader = styleReader(zip, families);
  if (size) {
    for (const m of xml.matchAll(/<wp:anchor\b[\s\S]*?<\/wp:anchor>/g)) {
      const anchor = m[0];
      const offsets = [...anchor.matchAll(/<wp:posOffset>(-?\d+)<\/wp:posOffset>/g)].map((o) =>
        Number(o[1])
      );
      const extent = /<wp:extent\b[^>]*\/?>/.exec(anchor)?.[0] ?? '';
      const cx = numAttr(extent, 'cx');
      const cy = numAttr(extent, 'cy');
      if (offsets.length < 2 || !cx || !cy) continue;

      const box = clampBox({
        // المحور الأفقي في Word يُقاس من اليسار، وعندنا من اليمين.
        x: 1 - (offsets[0]! * EMU_MM + cx * EMU_MM) / size.w,
        y: (offsets[1]! * EMU_MM) / size.h,
        w: (cx * EMU_MM) / size.w,
        h: (cy * EMU_MM) / size.h
      });

      const blip = /<a:blip\b[^>]*\/?>/.exec(anchor)?.[0] ?? '';
      const rel = attr(blip, 'r:embed');
      if (rel) {
        const at = putImage(rel);
        if (at !== undefined) elements.push({ box, imageIndex: at });
        continue;
      }

      const text = paragraphText(anchor);
      if (text.trim()) {
        const style = reader.styleOf(anchor);
        elements.push({
          box,
          // و`{الوسم}` في مربّع نصّ Word يصير حقلًا — فما كتبه المكتب في قالبه
          // يبقى متغيّرًا عندنا، ولا يُعاد تعريفه باليد.
          inlines: tokenInlines(text.replace(/\n/g, ' ').trim()),
          ...style,
          // الحجم من `w:sz` إن ذُكر (في المقطع أو نمطه أو الافتراض)؛ وإلا فارتفاعُ الصندوق بالملّم يقارب حجم سطرٍ واحد — تقديرٌ يُعدَّل باليد.
          size: style.size ?? Math.max(8, Math.round(((cy * EMU_MM) / 25.4) * 72 * 0.6))
        });
      }
    }
  }

  if (!elements.length) {
    warnings.push('لا مربّعات نصٍّ ولا صورٍ مثبّتةً بمواضعها — أُدرج نصُّ المستند فقط');
    const text = paragraphText(xml);
    if (text.trim()) {
      elements.push({
        box: clampBox({ x: 0.1, y: 0.35, w: 0.8, h: 0.3 }),
        inlines: tokenInlines(text.split('\n')[0]!)
      });
    }
  }

  if (reader.missing.size) warnings.push(`خطوطٌ في الملفّ ليست في البرنامج: ${[...reader.missing].join('، ')} — أضفها من الخطوط`);

  return { source: 'word', name, size, dpi: null, images, elements, warnings };
}
