/**
 * استيراد التصاميم — المقاس والمواضع من الملف لا من تخميننا.
 *
 * عند المكتب آلافُ التصاميم: شهاداتٌ في Word، وهوياتٌ في Photoshop، وملصقاتٌ
 * PDF، وصورٌ جاهزة. وهذه المسارات الأربعة تُدخلها كلّها — وكلٌّ منها يحمل مقاسه
 * بوحدةٍ أخرى، فتُقرأ ولا تُخمَّن:
 *
 * | المصدر | الوحدة | أين |
 * |---|---|---|
 * | Word | twip (١٤٤٠/إنش) | `w:sectPr > w:pgSz`، والمواضع EMU (٩١٤٤٠٠/إنش) |
 * | Photoshop | بكسل + DPI | ترويسة PSD، و`ResolutionInfo` (المورد ١٠٠٥) |
 * | PDF | نقطة (٧٢/إنش) | `MediaBox` في صفحة المستند |
 * | صورة | بكسل + DPI | `pHYs` أو EXIF (§`imageSize.ts`) |
 *
 * **ولا يُبنى تصميمٌ بمقاسٍ مخمَّن**: ما سكت ملفُّه عن مقاسه يعود بـ`size: null`
 * فيُسأل المكتب.
 *
 * (DESIGNS.md ٠٫٩: كلّ مصدرٍ في ملفّه بـ`design/import*` — Word وPhotoshop وPDF والصورة، والأنواع — وهنا الباب الواحد،
 * ومدخلٌ ثابت يعيد تصدير ما كان مصدَّرًا، فلم يتغيّر مستوردٌ واحد.)
 */
import { extname } from 'node:path';
import { BLEED_MM, barcodeElement, emptyCanvas, imageElement, textElement, type Canvas, type CanvasElement, type CanvasSize } from '@shared/canvas';
import type { FieldSuggestion } from '@shared/api';
import { POINT_MM, type DesignImport } from './design/importTypes';
import { wordDesign } from './design/importWord';
import { psdDesign } from './design/importPsd';
import { pdfDesign } from './design/importPdf';
import { imageDesign } from './design/importImage';
export { TWIP_MM, EMU_MM, POINT_MM } from './design/importTypes';
export type { DesignSource, DesignImport } from './design/importTypes';
export { wordDesign } from './design/importWord';
export { psdDesign } from './design/importPsd';
export { pdfSize, pdfDesign } from './design/importPdf';
export { imageDesign } from './design/importImage';

// ── الباب الواحد ─────────────────────────────────────────────────────

/** `fonts`: «خطوط ديوان» يطابقها استيراد Photoshop (DESIGNS.md ١٫٥) وWord (S44). */
export function readDesign(bytes: Uint8Array, name: string, fonts?: string[]): DesignImport {
  switch (extname(name).toLowerCase()) {
    case '.docx':
      return wordDesign(bytes, name, fonts);
    case '.psd':
      return psdDesign(bytes, name, fonts);
    case '.pdf':
      return pdfDesign(bytes, name);
    default:
      return imageDesign(bytes, name);
  }
}

/**
 * الحقول المقترحة من أسماء الطبقات، بمعرّفات عناصرها في اللوحة (هـ٤) — تُعرض ليقبلها
 * المكتب أو يرفضها. وكلّ عنصرٍ مستورد صار عنصرًا واحدًا في اللوحة بترتيبه.
 */
export function layerSuggestions(imported: DesignImport, canvas: Canvas | null): FieldSuggestion[] {
  if (!canvas || canvas.elements.length !== imported.elements.length) return [];
  return imported.elements.flatMap((el, i) => {
    const target = canvas.elements[i];
    if (!el.suggest || !target || target.kind !== 'text') return [];
    const sample = (el.inlines ?? [])
      .map((n) => (n.kind === 'run' ? n.text : n.kind === 'break' ? ' ' : ''))
      .join('')
      .trim();
    return [{ elementId: target.id, layer: el.layerName ?? '', sample, key: el.suggest.value, confidence: el.suggest.confidence, reason: el.suggest.reason }];
  });
}

export function canvasFromImport(
  imported: DesignImport,
  stored: string[],
  fallback?: CanvasSize
): Canvas | null {
  const size = imported.size ?? fallback;
  if (!size) return null;

  // ما صغُر يُقصّ: الهوية والدعوة تُطبع على ورقةٍ ثم تُقصّ، فالنزف أصلٌ فيها.
  // والحكمُ بالمقاس لا بالمصدر — فهويةٌ من Photoshop كهويةٍ من صورة.
  const bleed = size.w < 120 ? BLEED_MM : 0;
  const canvas = emptyCanvas(size, bleed);

  // صورةٌ واحدة لا موضع لها = خلفية. وما كان له موضعٌ فعنصرٌ فوقها.
  const backgroundAt = imported.elements.some((el) => el.imageIndex === 0) ? -1 : 0;
  if (stored[0] && backgroundAt === 0) {
    canvas.background = imported.dpi
      ? { kind: 'image', src: stored[0], dpi: imported.dpi }
      : { kind: 'image', src: stored[0] };
  }

  canvas.elements = imported.elements.flatMap<CanvasElement>((el, i) => {
    if (el.kind === 'barcode' || el.symbology) {
      return [
        barcodeElement({
          box: el.box,
          symbology: el.symbology ?? 'qr',
          ref: el.ref ?? 'الرقم',
          z: i + 1
        })
      ];
    }
    if (el.kind === 'image' || el.imageIndex !== undefined || el.ref?.includes('صورة')) {
      const src = el.imageIndex !== undefined ? stored[el.imageIndex] : '';
      return [
        imageElement({
          box: el.box,
          src: src ?? '',
          ref: el.ref,
          fit: el.fit === 'cover' ? 'cover' : 'contain',
          radius: el.radius,
          ...(el.shape && { shape: el.shape }),
          ...(el.frameFrac && { frame: { color: el.frameFrac.color, width: Math.round(el.frameFrac.width * canvas.size.h * 100) / 100 } }),
          ...(el.opacity !== undefined && { opacity: el.opacity }),
          ...(el.group && { group: el.group }),
          z: i + 1
        })
      ];
    }
    // النسبة تصير نقاطًا بمقاس الورقة الذي عُرف — من الملف أو من اختيار المكتب.
    const size = el.sizeFrac ? Math.round(((el.sizeFrac * canvas.size.h) / POINT_MM) * 100) / 100 : (el.size ?? 14);
    /** طولٌ نسبةً من الارتفاع ← نقاط (مؤثّرات Photoshop، ٢٫١). */
    const pt = (frac: number) => Math.round(((frac * canvas.size.h) / POINT_MM) * 100) / 100;
    return [
      textElement({
        box: el.box,
        inlines: el.inlines ?? [],
        size,
        ...(el.color && { color: el.color }),
        ...(el.align && { align: el.align }),
        ...(el.dir && { dir: el.dir }),
        ...(el.font && { font: el.font }),
        ...(el.bold && { bold: true }),
        ...(el.italic && { italic: true }),
        ...(el.letterSpacing && { letterSpacing: el.letterSpacing }),
        ...(el.lineHeight && { lineHeight: el.lineHeight }),
        ...(el.vAlign && { vAlign: el.vAlign }),
        ...(el.fit === 'shrink' && { fit: 'shrink' as const }),
        ...(el.shadowFrac && { shadow: { color: el.shadowFrac.color, dx: pt(el.shadowFrac.dx), dy: pt(el.shadowFrac.dy), blur: pt(el.shadowFrac.blur) } }),
        ...(el.outlineFrac && { outline: { color: el.outlineFrac.color, width: pt(el.outlineFrac.width) } }),
        ...(el.gradient && { gradient: el.gradient }),
        ...(el.arc && { arc: el.arc }),
        ...(el.opacity !== undefined && { opacity: el.opacity }),
        ...(el.group && { group: el.group }),
        z: i + 1
      })
    ];
  });

  return canvas;
}
