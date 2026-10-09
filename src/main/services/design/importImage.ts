/**
 * استيراد التصاميم — الصورة: الأبعاد والدقّة من الملفّ، فإن سكت عن دقّته سُئل المكتب (DESIGNS.md ٠٫٩).
 */
import { imageMeta } from '../imageSize';
import type { DesignImport } from './importTypes';

// ── صورة ─────────────────────────────────────────────────────────────

/** أصورةٌ هي؟ — من توقيع أوّل بايتاتها لا من امتداد اسمها. */
function isImage(bytes: Uint8Array): boolean {
  const b = Buffer.from(bytes.subarray(0, 12));
  return (
    b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) || // PNG
    b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])) || // JPEG
    b.toString('latin1', 0, 4) === 'GIF8' ||
    b.toString('latin1', 0, 2) === 'BM' ||
    (b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') ||
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || // TIFF (II)
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a) // TIFF (MM)
  );
}

export function imageDesign(bytes: Uint8Array, name: string): DesignImport {
  if (!isImage(bytes)) throw new Error('الملف ليس صورةً تُقرأ (PNG أو JPEG أو WebP أو BMP) — قد يكون تالفًا أو أُعيدت تسميته');
  const meta = imageMeta(bytes);
  return {
    source: 'image',
    name,
    size: meta?.mm ?? null,
    dpi: meta?.dpi ?? null,
    images: [{ name, bytes }],
    elements: [],
    warnings: meta?.mm ? [] : ['الصورة لا تذكر دقّتها — اختر المقاس']
  };
}
