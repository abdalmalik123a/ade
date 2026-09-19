import { describe, expect, it } from 'vitest';
import { imageMeta } from '../src/main/services/imageSize';

// ── صورٌ تُبنى بايتًا بايتًا، فما يُقاس هو القراءة لا مكتبةٌ أخرى ──────

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  // الـCRC لا يُتحقَّق منه عند القراءة، فأربع بايتات صفرية تكفي.
  return Buffer.concat([length, Buffer.from(type, 'ascii'), data, Buffer.alloc(4)]);
}

function png(width: number, height: number, ppm?: number): Uint8Array {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(6, 9);

  const parts = [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr)];

  if (ppm !== undefined) {
    const phys = Buffer.alloc(9);
    phys.writeUInt32BE(ppm, 0);
    phys.writeUInt32BE(ppm, 4);
    phys.writeUInt8(1, 8); // الوحدة: المتر
    parts.push(chunk('pHYs', phys));
  }

  parts.push(chunk('IDAT', Buffer.alloc(8)), chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

function segment(marker: number, body: Buffer): Buffer {
  const head = Buffer.alloc(4);
  head.writeUInt8(0xff, 0);
  head.writeUInt8(marker, 1);
  head.writeUInt16BE(body.length + 2, 2);
  return Buffer.concat([head, body]);
}

function jpeg(width: number, height: number, density?: { x: number; units: 0 | 1 | 2 }): Uint8Array {
  const parts = [Buffer.from([0xff, 0xd8])];

  if (density) {
    const jfif = Buffer.alloc(14);
    jfif.write('JFIF\0', 0, 'ascii');
    jfif.writeUInt8(1, 5);
    jfif.writeUInt8(1, 6);
    jfif.writeUInt8(density.units, 7);
    jfif.writeUInt16BE(density.x, 8);
    jfif.writeUInt16BE(density.x, 10);
    parts.push(segment(0xe0, jfif));
  }

  const sof = Buffer.alloc(6);
  sof.writeUInt8(8, 0);
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof.writeUInt8(3, 5);
  parts.push(segment(0xc0, sof));
  parts.push(Buffer.from([0xff, 0xda, 0x00, 0x02]), Buffer.from([0xff, 0xd9]));
  return Buffer.concat(parts);
}

/** JPEG بدقّةٍ في EXIF لا في JFIF — وهذا ما يخرج من Photoshop غالبًا. */
function jpegExif(width: number, height: number, dpi: number, unit: 2 | 3): Uint8Array {
  // ترويسة TIFF (٨) + عدد المدخلات (٢) + مدخلتان (٢٤) + مؤشّر التالي (٤) = ٣٨،
  // فموضع الكسر بعدها. وخلطُ الكسر بالمدخلات هو ما يُفسد قراءة EXIF غالبًا.
  const RATIONAL_AT = 38;
  const tiff = Buffer.alloc(RATIONAL_AT + 8);
  tiff.write('MM', 0, 'ascii');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(2, 8); // عدد المدخلات

  // XResolution (0x011a): كسرٌ موضعه إزاحةٌ من ترويسة TIFF
  tiff.writeUInt16BE(0x011a, 10);
  tiff.writeUInt16BE(5, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt32BE(RATIONAL_AT, 18);

  // ResolutionUnit (0x0128): قيمةٌ قصيرة داخل المدخلة نفسها
  tiff.writeUInt16BE(0x0128, 22);
  tiff.writeUInt16BE(3, 24);
  tiff.writeUInt32BE(1, 26);
  tiff.writeUInt16BE(unit, 30);

  tiff.writeUInt32BE(dpi, RATIONAL_AT);
  tiff.writeUInt32BE(1, RATIONAL_AT + 4);

  const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const sof = Buffer.alloc(6);
  sof.writeUInt8(8, 0);
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof.writeUInt8(3, 5);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    segment(0xe1, app1),
    segment(0xc0, sof),
    Buffer.from([0xff, 0xd9])
  ]);
}

describe('المقاس يأتي من الملف لا من تخميننا', () => {
  it('PNG: الأبعاد من `IHDR` والدقّة من `pHYs`', () => {
    // ١١٨١١ بكسل/متر = ٣٠٠ نقطة/إنش — وهي ما تكتبه برامج التصميم.
    const meta = imageMeta(png(1011, 638, 11811))!;
    expect(meta.format).toBe('png');
    expect(meta.width).toBe(1011);
    expect(meta.height).toBe(638);
    expect(meta.dpi).toBe(300);
    // وهوية CR80 تعود ٨٥٫٦ × ٥٤ ملّم كما في المعيار.
    expect(meta.mm!.w).toBeCloseTo(85.6, 1);
    expect(meta.mm!.h).toBeCloseTo(54, 1);
  });

  it('وPNG بلا `pHYs`: الأبعاد تُقرأ والدقّة تبقى مجهولة — فيُسأل المكتب', () => {
    const meta = imageMeta(png(3508, 2480))!;
    expect(meta.width).toBe(3508);
    expect(meta.dpi).toBeNull();
    // ولا يُخترع مقاسٌ بالملّم من دقّةٍ مفترضة.
    expect(meta.mm).toBeNull();
  });

  it('وPNG بوحدةٍ غير المتر لا تُقرأ دقّته — فالنسبة ليست مقياسًا', () => {
    const bytes = Buffer.from(png(100, 100, 11811));
    // بايت الوحدة في `pHYs`: يُبدَّل إلى صفر (نسبةٌ بلا مقياس).
    const at = bytes.indexOf(Buffer.from('pHYs', 'ascii')) + 4 + 8;
    bytes.writeUInt8(0, at);
    expect(imageMeta(bytes)!.dpi).toBeNull();
  });

  it('JPEG: الأبعاد من `SOF0` والدقّة من `JFIF`', () => {
    const meta = imageMeta(jpeg(3508, 2480, { x: 300, units: 1 }))!;
    expect(meta.format).toBe('jpeg');
    expect(meta.width).toBe(3508);
    expect(meta.height).toBe(2480);
    expect(meta.dpi).toBe(300);
    // شهادة A4 أفقي.
    expect(meta.mm!.w).toBeCloseTo(297, 0);
    expect(meta.mm!.h).toBeCloseTo(210, 0);
  });

  it('وJPEG بالسنتيمتر يُحوَّل إلى الإنش', () => {
    expect(imageMeta(jpeg(100, 100, { x: 118, units: 2 }))!.dpi).toBe(300);
  });

  it('وJPEG بنسبةٍ بلا وحدة لا دقّة له', () => {
    expect(imageMeta(jpeg(100, 100, { x: 1, units: 0 }))!.dpi).toBeNull();
  });

  it('وJPEG بدقّةٍ في EXIF وحدها — وهو ما يخرج من Photoshop', () => {
    expect(imageMeta(jpegExif(1011, 638, 300, 2))!.dpi).toBe(300);
    // وحدة ٣ سنتيمتر: ١١٨ نقطة/سم ≈ ٣٠٠ نقطة/إنش.
    expect(imageMeta(jpegExif(100, 100, 118, 3))!.dpi).toBe(300);
  });

  it('وما ليس صورةً نعرفها يُرجع لا شيء — ولا يُخمَّن', () => {
    expect(imageMeta(Buffer.from('ليست صورة', 'utf8'))).toBeNull();
    expect(imageMeta(Buffer.alloc(0))).toBeNull();
    expect(imageMeta(Buffer.from([0x89, 0x50, 0x4e, 0x47]))).toBeNull();
  });
});
