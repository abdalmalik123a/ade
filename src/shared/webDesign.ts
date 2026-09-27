/**
 * محرك التصميم الهجين (HTML5 + CSS3 + Inline SVG).
 *
 * يتيح للذكاء الاصطناعي (Gemini / Claude / ChatGPT) كتابة تصاميم كاملة بـ HTML/CSS/SVG
 * مع الحفاظ على الدقة 100%، ويقوم بدمج الأنماط (CSS Stylesheets) ورسومات الفيكتور (SVG Defs)
 * لمنع أي تشوه بصري أو فقدان للتفاصيل والزخارف.
 */
import { run } from './doc';
import { colorsInstruction, type DesignColors } from './designRecipe';
import {
  emptyCanvas,
  pxToMm,
  svgElement,
  htmlElement,
  imageElement,
  textElement,
  type Box,
  type Canvas,
  type CanvasElement,
  type CanvasSize,
  type Background
} from './canvas';

export type ParsedWebDesign = {
  canvas: Canvas;
  title: string;
};

/** أبعاد قياسية بالملم */
const DEFAULT_SIZE: CanvasSize = { w: 297, h: 210 }; // A4 landscape

/** تنظيف الأكواد المستلمة من علامات الماركداون */
export function cleanHtmlInput(raw: string): string {
  let cleaned = raw.trim();
  // إزالة وسوم ماركداون ```html ... ``` إن وجدت
  cleaned = cleaned.replace(/^```(?:html|xml)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');
  return cleaned.trim();
}

/** استخراج قيمة خاصية CSS من نص style */
export function extractCssProp(style: string, prop: string): string | null {
  const regex = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i');
  const match = style.match(regex);
  return match ? match[1]!.trim() : null;
}

/** تحويل قيمة بُعد CSS إلى نسبة (0..1) من المقاس الكلي بالملم */
export function parseDimension(val: string | null, totalMm: number): number | null {
  if (!val) return null;
  val = val.trim().toLowerCase();

  // نسبة مئوية
  if (val.endsWith('%')) {
    const p = parseFloat(val);
    return Number.isFinite(p) ? p / 100 : null;
  }
  // ملليمتر
  if (val.endsWith('mm')) {
    const mm = parseFloat(val);
    return Number.isFinite(mm) && totalMm > 0 ? mm / totalMm : null;
  }
  // سنتيمتر
  if (val.endsWith('cm')) {
    const cm = parseFloat(val);
    return Number.isFinite(cm) && totalMm > 0 ? (cm * 10) / totalMm : null;
  }
  // إنش
  if (val.endsWith('in')) {
    const inch = parseFloat(val);
    return Number.isFinite(inch) && totalMm > 0 ? (inch * 25.4) / totalMm : null;
  }
  // بكسل (على أساس 96 DPI)
  if (val.endsWith('px')) {
    const px = parseFloat(val);
    const mm = pxToMm(px, 96);
    return Number.isFinite(mm) && totalMm > 0 ? mm / totalMm : null;
  }
  // رقم مجرد بدون وحدة (يُعتبر بكسل أو نسبة إن كان بين 0 و 1)
  const num = parseFloat(val);
  if (!Number.isFinite(num)) return null;
  if (num > 0 && num <= 1) return num;
  return pxToMm(num, 96) / totalMm;
}

/** استخراج مقاس لوحة التصميم من الوسم الحاوي أو كتل النمط CSS */
export function parseArtboardSize(html: string): CanvasSize {
  // 1. فحص سمات width و height في الوسم الأول المباشر
  const firstTagMatch = html.match(/<([a-z0-9]+)[^>]*style=(?:"([^"]*)"|'([^']*)')[^>]*>/i);
  if (firstTagMatch) {
    const style = firstTagMatch[2] ?? firstTagMatch[3] ?? '';
    const wVal = extractCssProp(style, 'width');
    const hVal = extractCssProp(style, 'height');

    let w = 0;
    let h = 0;

    if (wVal) {
      if (wVal.endsWith('mm')) w = parseFloat(wVal);
      else if (wVal.endsWith('cm')) w = parseFloat(wVal) * 10;
      else if (wVal.endsWith('in')) w = parseFloat(wVal) * 25.4;
      else if (wVal.endsWith('px')) w = pxToMm(parseFloat(wVal), 96);
    }

    if (hVal) {
      if (hVal.endsWith('mm')) h = parseFloat(hVal);
      else if (hVal.endsWith('cm')) h = parseFloat(hVal) * 10;
      else if (hVal.endsWith('in')) h = parseFloat(hVal) * 25.4;
      else if (hVal.endsWith('px')) h = pxToMm(parseFloat(hVal), 96);
    }

    if (w > 10 && h > 10) {
      return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
    }
  }

  // 2. فحص في كتل style المضمنة
  const styleBlockMatch = html.match(/(?:\.certificate-[a-z0-9_-]+|\.certificate-canvas|\.canvas|\.artboard|\.diwan-artboard)\s*\{([^}]*)\}/i);
  if (styleBlockMatch) {
    const s = styleBlockMatch[1]!;
    const wVal = extractCssProp(s, 'width');
    const hVal = extractCssProp(s, 'height');

    let w = 297;
    let h = 210;

    if (wVal) {
      if (wVal.endsWith('mm')) w = parseFloat(wVal);
      else if (wVal.endsWith('cm')) w = parseFloat(wVal) * 10;
      else if (wVal.endsWith('in')) w = parseFloat(wVal) * 25.4;
      else if (wVal.endsWith('px')) {
        const px = parseFloat(wVal);
        if (Math.abs(px - 1122.5) < 40 || Math.abs(px - 1188) < 40) w = 297;
        else if (Math.abs(px - 793.7) < 40 || Math.abs(px - 840) < 40) w = 210;
        else w = pxToMm(px, 96);
      }
    }

    if (hVal) {
      if (hVal.endsWith('mm')) h = parseFloat(hVal);
      else if (hVal.endsWith('cm')) h = parseFloat(hVal) * 10;
      else if (hVal.endsWith('in')) h = parseFloat(hVal) * 25.4;
      else if (hVal.endsWith('px')) {
        const px = parseFloat(hVal);
        if (Math.abs(px - 793.7) < 40 || Math.abs(px - 840) < 40) h = 210;
        else if (Math.abs(px - 1122.5) < 40 || Math.abs(px - 1188) < 40) h = 297;
        else h = pxToMm(px, 96);
      }
    }

    if (w > 10 && h > 10) {
      return { w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
    }
  }

  // 3. فحص وسم data-size
  if (html.includes('id-card')) return { w: 85.6, h: 54 };
  if (html.includes('a5-landscape')) return { w: 210, h: 148 };
  if (html.includes('a5-portrait')) return { w: 148, h: 210 };
  if (html.includes('a4-portrait')) return { w: 210, h: 297 };
  if (html.includes('a3-portrait')) return { w: 297, h: 420 };

  return DEFAULT_SIZE;
}

/** استخراج خلفية اللوحة */
export function parseArtboardBackground(html: string): Background {
  // فحص النمط المباشر
  const match = html.match(/style=(?:"([^"]*)"|'([^']*)')/i);
  if (match) {
    const style = match[1] ?? match[2] ?? '';
    const bg = extractCssProp(style, 'background') || extractCssProp(style, 'background-image') || extractCssProp(style, 'background-color');
    if (bg) {
      if (bg.includes('gradient') || bg.includes('url') || bg.includes('radial') || bg.includes('linear')) {
        return { kind: 'css', style: bg };
      }
      if (bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl')) {
        return { kind: 'color', color: bg };
      }
      return { kind: 'css', style: bg };
    }
  }

  // فحص النمط في كتل style
  const bgRule = html.match(/(?:\.certificate-[a-z0-9_-]+|\.canvas|\.artboard|\.diwan-artboard)\s*\{[^}]*?background(?:-image|-color)?\s*:\s*([^;]+)/i);
  if (bgRule) {
    const bg = bgRule[1]!.trim();
    if (bg.includes('gradient') || bg.includes('radial') || bg.includes('linear')) {
      return { kind: 'css', style: bg };
    }
    if (bg.startsWith('#') || bg.startsWith('rgb') || bg.startsWith('hsl')) {
      return { kind: 'color', color: bg };
    }
    return { kind: 'css', style: bg };
  }

  return { kind: 'none' };
}

/** استخراج عنوان التصميم */
export function parseArtboardTitle(html: string): string {
  // فحص data-title
  const dataTitle = html.match(/data-title=["']([^"']+)["']/i);
  if (dataTitle) return dataTitle[1]!.trim();

  // فحص وسم title
  const titleTag = html.match(/<title>([^<]+)<\/title>/i);
  if (titleTag) return titleTag[1]!.trim();

  // فحص فئة العنوان الرئيسي
  const mainTitleClass = html.match(/class=["'][^"']*main-title[^"']*["'][^>]*>([^<]+)</i);
  if (mainTitleClass) return mainTitleClass[1]!.trim();

  // فحص أول h1
  const h1Tag = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Tag) return h1Tag[1]!.trim();

  return 'تصميم ديوان جديد';
}

/** استخراج حجم الخط بالنقاط (pt) */
export function parseFontSizePt(val: string | null): number {
  if (!val) return 16;
  val = val.trim().toLowerCase();
  if (val.endsWith('pt')) return parseFloat(val) || 16;
  if (val.endsWith('px')) {
    const px = parseFloat(val) || 20;
    return Math.round((px * 72) / 96);
  }
  if (val.endsWith('rem') || val.endsWith('em')) {
    const em = parseFloat(val) || 1;
    return Math.round(em * 16);
  }
  const n = parseFloat(val);
  return Number.isFinite(n) ? Math.round(n) : 16;
}

/** إزالة وسوم HTML لاستخراج النص البسيط */
export function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * استخراج النصوص القابلة للتعديل من كود الـ HTML لعرضها في لوحة التحكم للتعديل السريع.
 */
export function extractEditableTexts(html: string): { original: string; label: string }[] {
  const results: { original: string; label: string }[] = [];
  const seen = new Set<string>();

  // استخراج النصوص داخل وسوم العناوين والفقرات والبطاقات
  const textTagRegex = /<(h[1-6]|p|div|span)\b([^>]*)>([^<]{2,150})<\/\1>/gi;
  for (const m of html.matchAll(textTagRegex)) {
    const tagName = m[1]!.toLowerCase();
    const attrs = m[2]!;
    const text = m[3]!.trim();

    if (!text || seen.has(text) || text.length < 2) continue;
    // تخطي النصوص الخاصة بالأكواد أو الأرقام المجردة
    if (/^[\d.,\s#%-]+$/.test(text)) continue;

    let label = 'نص';
    if (attrs.includes('title') || tagName.startsWith('h')) label = 'العنوان';
    else if (attrs.includes('awardee') || attrs.includes('name') || text.includes('عبد') || text.includes('أحمد') || text.includes('محمد')) label = 'اسم المكرم / المستلم';
    else if (attrs.includes('bismillah') || text.includes('بسم الله')) label = 'البسملة';
    else if (attrs.includes('date') || text.includes('تاريخ')) label = 'التاريخ';
    else if (attrs.includes('signature') || text.includes('مدير') || text.includes('توقيع')) label = 'التوقيع';
    else if (text.length > 30) label = 'نص التقدير والوصف';

    seen.add(text);
    results.push({ original: text, label });
  }

  return results;
}

/**
 * تحليل كود HTML5/CSS/SVG وتحويله إلى Canvas بطبقات عالية الدقة.
 */
export function parseWebDesign(rawInput: string): ParsedWebDesign {
  const html = cleanHtmlInput(rawInput);
  const size = parseArtboardSize(html);
  const background = parseArtboardBackground(html);
  const title = parseArtboardTitle(html);

  const canvas = emptyCanvas(size);
  canvas.background = background;

  // فحص ما إذا كان المدخل تصميماً مركباً كاملاً (يحتوي على style أو وسم html/body أو تصميم ويب غني)
  const hasStyleTag = /<style\b/i.test(html);
  const hasDocTypeOrBody = /<!DOCTYPE|<html|<body/i.test(html);
  const hasComplexLayout =
    html.includes('certificate-') ||
    html.includes('class="canvas"') ||
    html.includes('class="artboard"') ||
    html.includes('frame-') ||
    html.includes('corner-') ||
    html.includes('bleed-');

  // إذا كان المدخل تصميماً مركباً كاملاً (مثل مخرجات Gemini / ChatGPT الفاخرة):
  // نحافظ على كافة أنماط CSS وتعاريف الـ SVG بنسبة 100% داخل طبقة لوحة الويب الفاخرة
  if (hasStyleTag || hasDocTypeOrBody || hasComplexLayout) {
    // 1. استخراج كافة كتل <style>
    const styleMatches = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)];
    const rawStyles = styleMatches.map((m) => m[1]).join('\n');

    // تنظيف القواعد التي تؤثر على جسم الصفحة العام وضبط الحاوية لتملأ اللوحة بدقة تامة
    const cleanStyles = rawStyles
      .replace(/\b(?:html\s*,\s*body|html|body)\b\s*\{[^}]*\}/gi, '')
      .replace(
        /(\.certificate-[a-z0-9_-]+|\.certificate-canvas|\.canvas|\.artboard|\.diwan-artboard)\s*\{([^}]*)\}/gi,
        (_m, cls, content) => {
          return `${cls} { ${content}; width: 100% !important; height: 100% !important; position: absolute !important; inset: 0 !important; margin: 0 !important; box-sizing: border-box !important; }`;
        }
      );

    // 2. استخراج محتوى اللوحة (من داخل body إن وجد، أو كامل العناصر بعد عزل الـ style)
    let bodyContent = html;
    const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      bodyContent = bodyMatch[1]!.trim();
    } else {
      bodyContent = bodyContent.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').trim();
    }

    // تجميع الكود المدمج المتكامل ليعرض بدقة 100% مثل المتصفح
    const combinedHtml = `
<style>
${cleanStyles}
.diwan-web-artboard-host {
  width: 100% !important;
  height: 100% !important;
  position: absolute !important;
  inset: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}
</style>
<div class="diwan-web-artboard-host">
${bodyContent}
</div>
    `.trim();

    canvas.elements = [
      htmlElement({
        name: `لوحة التصميم الفاخرة (${title})`,
        box: { x: 0, y: 0, w: 1, h: 1 },
        html: combinedHtml,
        content: title,
        z: 1,
        locked: false
      })
    ];

    return { canvas, title };
  }

  // وإلا إذا كان كود مجزأ بدون style يحوي عناصر مباشرة مع وسوم data-layer أو عناصر مباشرة:
  let contentHtml = html;
  const artboardTagMatch = html.match(/<div[^>]*?(?:width:\s*[0-9]+|diwan-artboard|artboard)[^>]*>/i);
  if (artboardTagMatch) {
    const startIdx = html.indexOf(artboardTagMatch[0]) + artboardTagMatch[0].length;
    const lastCloseIdx = html.lastIndexOf('</div>');
    if (lastCloseIdx > startIdx) {
      contentHtml = html.slice(startIdx, lastCloseIdx);
    }
  }

  const elementRegex = /<(h[1-6]|p|svg|img|div)\b([^>]*)>([\s\S]*?)<\/\1>|<(img)\b([^>]*)\/?>/gi;
  const matches = [...contentHtml.matchAll(elementRegex)];

  let zCounter = 1;
  const elements: CanvasElement[] = [];

  for (const match of matches) {
    const fullTag = match[0];
    const tagName = (match[1] || match[4] || 'div').toLowerCase();
    const attrStr = match[2] || match[5] || '';
    const innerContent = (match[3] ?? '').trim();

    // فحص data-layer
    const layerNameMatch = attrStr.match(/data-layer=["']([^"']*)["']/i);
    const explicitName = layerNameMatch ? layerNameMatch[1] : undefined;

    // استخراج style
    const styleMatch = attrStr.match(/style=(?:"([^"]*)"|'([^']*)')/i);
    const style = styleMatch ? (styleMatch[1] ?? styleMatch[2] ?? '') : '';

    // حساب الإحداثيات (x, y, w, h)
    const topVal = extractCssProp(style, 'top');
    const bottomVal = extractCssProp(style, 'bottom');
    const rightVal = extractCssProp(style, 'right');
    const leftVal = extractCssProp(style, 'left');
    const widthVal = extractCssProp(style, 'width');
    const heightVal = extractCssProp(style, 'height');

    let w = parseDimension(widthVal, size.w) ?? 0.8;
    let h = parseDimension(heightVal, size.h) ?? (tagName.startsWith('h') ? 0.1 : 0.12);

    w = Math.min(1, Math.max(0.02, w));
    h = Math.min(1, Math.max(0.02, h));

    // حساب x (موضع البدء من اليمين في ديوان)
    let x = 0.1;
    if (rightVal) {
      const r = parseDimension(rightVal, size.w);
      if (r !== null) x = r;
    } else if (leftVal) {
      const l = parseDimension(leftVal, size.w);
      if (l !== null) x = Math.max(0, 1 - l - w);
    } else {
      x = Math.max(0, (1 - w) / 2);
    }

    // حساب y
    let y = 0.1;
    if (topVal) {
      const t = parseDimension(topVal, size.h);
      if (t !== null) y = t;
    } else if (bottomVal) {
      const b = parseDimension(bottomVal, size.h);
      if (b !== null) y = Math.max(0, 1 - b - h);
    } else {
      y = Math.min(0.85, 0.08 + (zCounter - 1) * 0.14);
    }

    const box: Box = { x, y, w, h };

    let name = explicitName?.trim();
    if (!name) {
      if (fullTag.includes('<svg') || tagName === 'svg') {
        if (fullTag.toLowerCase().includes('quran') || fullTag.includes('مصحف')) name = 'المصحف الشريف';
        else if (fullTag.toLowerCase().includes('trophy') || fullTag.includes('كأس')) name = 'كأس التفوق';
        else if (fullTag.toLowerCase().includes('border') || fullTag.includes('frame') || fullTag.includes('إطار')) name = 'إطار وزخرفة';
        else name = 'رسمة فيكتور SVG';
      } else if (tagName === 'img') {
        name = 'صورة';
      } else if (tagName.startsWith('h')) {
        const text = stripHtmlTags(innerContent || fullTag);
        name = `عنوان: ${text.slice(0, 20)}`;
      } else {
        const text = stripHtmlTags(innerContent || fullTag);
        name = text ? `نص: ${text.slice(0, 20)}` : `عنصر ${zCounter}`;
      }
    }

    // 1. عنصر SVG
    if (tagName === 'svg' || innerContent.includes('<svg') || fullTag.includes('<svg')) {
      const svgMatch = fullTag.match(/<svg[\s\S]*?<\/svg>/i);
      const rawSvg = svgMatch ? svgMatch[0] : innerContent;
      elements.push(
        svgElement({
          name,
          box,
          svg: rawSvg,
          z: zCounter++
        })
      );
      continue;
    }

    // 2. عنصر صورة <img>
    if (tagName === 'img' || fullTag.includes('<img')) {
      const srcMatch = fullTag.match(/src=["']([^"']*)["']/i);
      const src = srcMatch ? srcMatch[1]! : '';
      elements.push(
        imageElement({
          name,
          box,
          src,
          z: zCounter++
        })
      );
      continue;
    }

    // 3. عنصر نص عادي (h1..h6, p, أو حاوية نصية بدون وسوم معقدة)
    const isTextTag = tagName.startsWith('h') || tagName === 'p' || (!innerContent.includes('<div') && !innerContent.includes('<table'));
    if (isTextTag) {
      const text = stripHtmlTags(innerContent);
      if (text) {
        const color = extractCssProp(style, 'color') || '#1e293b';
        const fontSize = parseFontSizePt(extractCssProp(style, 'font-size'));
        const fontFamily = extractCssProp(style, 'font-family')?.replace(/['"]/g, '') || 'Cairo';
        const textAlignRaw = extractCssProp(style, 'text-align');
        const align = textAlignRaw === 'left' ? 'left' : textAlignRaw === 'right' ? 'right' : 'center';
        const fontWeight = extractCssProp(style, 'font-weight');
        const bold = fontWeight === 'bold' || fontWeight === '700' || fontWeight === '800' || tagName.startsWith('h');

        elements.push(
          textElement({
            name,
            box,
            inlines: [run(text)],
            size: fontSize,
            color,
            font: fontFamily,
            bold,
            align,
            z: zCounter++
          })
        );
        continue;
      }
    }

    // 4. عنصر ويب HTML غني
    elements.push(
      htmlElement({
        name,
        box,
        html: innerContent || fullTag,
        content: stripHtmlTags(innerContent),
        z: zCounter++
      })
    );
  }

  canvas.elements = elements;
  return { canvas, title };
}

/**
 * توليد توجيه احترافي للذكاء الاصطناعي (Gemini / Claude / ChatGPT)
 * لإنتاج تصاميم HTML5 + CSS3 + SVG متوافقة بنظام الطبقات.
 */
export function generateWebAiPrompt(userDescription: string, colors: DesignColors = {}): string {
  const prompt = `
أنت مصمم جرافيك ومطور ويب عالمي محترف.
المطلوب: تصميم وثيقة / شهادة فاخرة متكاملة باستخدام (HTML5 + CSS3 + Inline SVG).

المواصفات المطلوبة للتصميم:
«${userDescription || 'شهادة حفظ قرآن كريم رسمية مع رسمة المصحف الشريف وزخارف إسلامية'}»

${colorsInstruction(colors)}

القواعد الإلزامية لمحرر ديوان:
1. أنشئ كود HTML5 كامل ونظيف يحتوي على:
   - كتلة <style> تحتوي على كافة الألوان والتدرجات والخطوط والتأثيرات (Shadows, Gradients).
   - حاوية التصميم الرئيسية (.certificate-container أو diwan-artboard) بمقاس قياسي A4 (297mm × 210mm أو 1122px × 793px).
   - إطارات هندسية (Borders & Corners) بلون الإبراز، متطابقة ورائعة.
   - رسومات فكتور نقية Inline SVG للرموز (مثل: المصحف الشريف، الكأس، درع التكريم، الختم).
   - يمكن تمييز الطبقات بالسمة data-layer="اسم الطبقة" ونصوص واضحة بخطوط عربية جميلة (Amiri, Cairo, Traditional Arabic) للعناوين والبسملة والاسم والتاريخ والتوقيع.

2. اجعل التصميم مبهراً وفخماً جداً ودقيقاً من الناحية الهندسية مع تباين عالي للألوان.
3. أعطني كود الـ HTML كاملاً مباشرة داخل كتلة كود، بدون أي كلام زائد أو مقدمات لأتمكن من نسخه ولصقه فوراً في برنامج ديوان.
`.trim();

  return prompt;
}
