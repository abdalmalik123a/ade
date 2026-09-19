/**
 * مقاس الصورة ودقّتها — من الملف لا من تخميننا.
 *
 * هذا أول موضعٍ تنكسر فيه برامج التصميم: تُفتح خلفيةٌ فتُفترض ٩٦ نقطة/إنش،
 * فتخرج شهادةٌ ممطوطة أو هويةٌ بنصف مقاسها. والملف يحمل الجواب:
 *
 * - **PNG**: `IHDR` للأبعاد، و`pHYs` للدقّة (بكسل/متر — فتُضرب بـ٠٫٠٢٥٤).
 * - **JPEG**: `SOFn` للأبعاد، و`APP0/JFIF` أو `APP1/EXIF` للدقّة.
 *
 * وإن غابت الدقّة **لم تُخمَّن**: يُرجَع `dpi: null`، ويُسأل المكتب عن المقاس.
 * فصمتُ الملف ليس إذنًا بالافتراض.
 */
import { readFile } from 'node:fs/promises';

export type ImageMeta = {
  /** بالبكسل. */
  width: number;
  height: number;
  /** نقطة/إنش، أو `null` إن لم يقلها الملف. */
  dpi: number | null;
  format: 'png' | 'jpeg';
  /** المقاس بالملّم — `null` ما دامت الدقّة مجهولة. */
  mm: { w: number; h: number } | null;
};

const PPM_TO_DPI = 0.0254;

/** دقّةٌ مألوفة تُقرَّب إليها القراءة — فـ٢٩٩٫٩٩ هي ٣٠٠. */
function tidyDpi(dpi: number): number {
  const known = [72, 96, 150, 200, 300, 600, 1200];
  const near = known.find((k) => Math.abs(dpi - k) < 1);
  return near ?? Math.round(dpi * 100) / 100;
}

function millimetres(width: number, height: number, dpi: number | null) {
  if (!dpi || dpi <= 0) return null;
  return { w: (width / dpi) * 25.4, h: (height / dpi) * 25.4 };
}

// ── PNG ──────────────────────────────────────────────────────────────

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPng(buf: Buffer): ImageMeta | null {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_MAGIC)) return null;

  let width = 0;
  let height = 0;
  let dpi: number | null = null;

  // مشيٌ على الأجزاء: الطول ثم النوع ثم البيانات ثم CRC.
  let at = 8;
  while (at + 8 <= buf.length) {
    const length = buf.readUInt32BE(at);
    const type = buf.toString('ascii', at + 4, at + 8);
    const data = at + 8;
    if (data + length > buf.length) break;

    if (type === 'IHDR' && length >= 8) {
      width = buf.readUInt32BE(data);
      height = buf.readUInt32BE(data + 4);
    } else if (type === 'pHYs' && length >= 9) {
      // الوحدة ١ تعني المتر؛ وغيرها نسبةٌ بلا مقياس فلا تُقرأ دقّة.
      if (buf.readUInt8(data + 8) === 1) {
        const ppm = buf.readUInt32BE(data);
        if (ppm > 0) dpi = tidyDpi(ppm * PPM_TO_DPI);
      }
    } else if (type === 'IDAT' || type === 'IEND') {
      break; // الدقّة تسبق البيانات دائمًا، فلا حاجة إلى قراءة الصورة كلّها.
    }

    at = data + length + 4;
  }

  if (!width || !height) return null;
  return { width, height, dpi, format: 'png', mm: millimetres(width, height, dpi) };
}

// ── JPEG ─────────────────────────────────────────────────────────────

/** علاماتٌ تحمل الأبعاد — وما عداها من SOF محجوزٌ أو جدول. */
const SOF = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function readExifDpi(buf: Buffer, start: number, length: number): number | null {
  // APP1 = "Exif\0\0" ثم ترويسة TIFF.
  if (buf.toString('ascii', start, start + 4) !== 'Exif') return null;
  const tiff = start + 6;
  if (tiff + 8 > start + length) return null;

  const order = buf.toString('ascii', tiff, tiff + 2);
  const le = order === 'II';
  if (!le && order !== 'MM') return null;
  const u16 = (at: number) => (le ? buf.readUInt16LE(at) : buf.readUInt16BE(at));
  const u32 = (at: number) => (le ? buf.readUInt32LE(at) : buf.readUInt32BE(at));

  const ifd = tiff + u32(tiff + 4);
  if (ifd + 2 > buf.length) return null;
  const count = u16(ifd);

  let xRes: number | null = null;
  let unit: number | null = null;
  for (let i = 0; i < count; i++) {
    const entry = ifd + 2 + i * 12;
    if (entry + 12 > buf.length) break;
    const tag = u16(entry);
    if (tag === 0x011a) {
      // XResolution: كسرٌ من عددين، موضعُه إزاحةٌ من ترويسة TIFF.
      const at = tiff + u32(entry + 8);
      if (at + 8 <= buf.length) {
        const den = u32(at + 4);
        if (den) xRes = u32(at) / den;
      }
    } else if (tag === 0x0128) {
      unit = u16(entry + 8);
    }
  }

  if (!xRes || xRes <= 0) return null;
  if (unit === 3) return tidyDpi(xRes * 2.54); // سنتيمتر
  return tidyDpi(xRes);
}

function readJpeg(buf: Buffer): ImageMeta | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;

  let width = 0;
  let height = 0;
  let dpi: number | null = null;

  let at = 2;
  while (at + 4 <= buf.length) {
    if (buf.readUInt8(at) !== 0xff) {
      at++;
      continue;
    }
    const marker = buf.readUInt8(at + 1);
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2;
      continue;
    }
    if (marker === 0xda || marker === 0xd9) break; // بداية البيانات: ما بعدها صورة.

    const length = buf.readUInt16BE(at + 2);
    const data = at + 4;

    if (SOF.has(marker) && data + 5 <= buf.length) {
      height = buf.readUInt16BE(data + 1);
      width = buf.readUInt16BE(data + 3);
    } else if (marker === 0xe0 && buf.toString('ascii', data, data + 4) === 'JFIF') {
      const units = buf.readUInt8(data + 7);
      const x = buf.readUInt16BE(data + 8);
      if (x > 0) {
        if (units === 1) dpi = tidyDpi(x);
        else if (units === 2) dpi = tidyDpi(x * 2.54);
      }
    } else if (marker === 0xe1 && dpi === null) {
      dpi = readExifDpi(buf, data, length);
    }

    at = data + length - 2;
  }

  if (!width || !height) return null;
  return { width, height, dpi, format: 'jpeg', mm: millimetres(width, height, dpi) };
}

/** يقرأ مقاس صورةٍ ودقّتها من بايتاتها — أو `null` إن لم تكن صورةً نعرفها. */
export function imageMeta(bytes: Uint8Array): ImageMeta | null {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return readPng(buf) ?? readJpeg(buf);
}

export async function imageMetaOf(path: string): Promise<ImageMeta | null> {
  return imageMeta(await readFile(path));
}
