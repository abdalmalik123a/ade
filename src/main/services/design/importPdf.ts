/**
 * استيراد التصاميم — PDF: المقاس من `MediaBox` بالنقطة، والصفحة تُسطَّح صورةً في الواجهة (DESIGNS.md ٠٫٩).
 */
import type { CanvasSize } from '@shared/canvas';
import { POINT_MM, type DesignImport } from './importTypes';

// ── PDF ──────────────────────────────────────────────────────────────

/**
 * مقاسُ صفحة PDF من `MediaBox` بالنقاط.
 *
 * ولا تُفكّ بنيةُ الملف كاملةً: أولُ `MediaBox` هو مقاس الصفحة الأولى في كل
 * ملفٍ رأيناه، وما نريده المقاسُ لا المحتوى — فالصفحة تُرسم خلفيةً.
 */
export function pdfSize(bytes: Uint8Array): CanvasSize | null {
  const head = Buffer.from(bytes).toString('latin1', 0, Math.min(bytes.length, 4 << 20));
  const m = /\/MediaBox\s*\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/.exec(head);
  if (!m) return null;
  const w = (Number(m[3]) - Number(m[1])) * POINT_MM;
  const h = (Number(m[4]) - Number(m[2])) * POINT_MM;
  return w > 0 && h > 0 ? { w, h } : null;
}

export function pdfDesign(bytes: Uint8Array, name: string): DesignImport {
  if (!Buffer.from(bytes.subarray(0, 1024)).toString('latin1').includes('%PDF-')) {
    throw new Error('الملف ليس PDF — قد يكون تالفًا أو أُعيدت تسميته');
  }
  const size = pdfSize(bytes);
  return {
    source: 'pdf',
    name,
    size,
    dpi: null,
    images: [],
    elements: [],
    warnings: size
      ? ['صفحة PDF تُرسم خلفيةً بدقّة الطباعة']
      : ['الملف لا يذكر مقاس صفحته — اختر المقاس']
  };
}
