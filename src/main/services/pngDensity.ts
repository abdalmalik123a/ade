/**
 * دقّة الصورة داخل ملفّ PNG (مقطع pHYs) — نُقل من `render.ts` (D80) — وداخل JPEG (مقطع APP0/JFIF، S42).
 */

/** جدول CRC لترميز مقاطع PNG. */
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

/**
 * يكتب الدقّة داخل الصورة نفسها (مقطع pHYs).
 *
 * صورة بمقاس 2480×3508 بلا هذا المقطع تُفتح في برامج الطباعة على أنها 96
 * نقطة/إنش فتُطبع بحجم أكبر من A4. الدقّة تُقاس بالمتر في المواصفة:
 * 300 نقطة/إنش = 11811 نقطة/متر.
 */
export function withDensity(png: Buffer, dpi: number): Buffer {
  const perMetre = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(perMetre, 0);
  data.writeUInt32BE(perMetre, 4);
  data[8] = 1; // الوحدة: المتر

  const type = Buffer.from('pHYs', 'ascii');
  let crc = 0xffffffff;
  for (const byte of Buffer.concat([type, data])) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  const chunk = Buffer.alloc(21);
  chunk.writeUInt32BE(9, 0);
  type.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 17);

  // بعد IHDR مباشرةً: ثمانية بايتات توقيع + 25 بايت مقطع IHDR.
  const head = 8 + 25;
  if (png.indexOf('pHYs', head, 'ascii') > 0) return png; // لا يُكرَّر مقطع موجود
  return Buffer.concat([png.subarray(0, head), chunk, png.subarray(head)]);
}

/**
 * يكتب الدقّة داخل JPEG (مقطع APP0/JFIF) كما يكتبها `withDensity` في PNG (S42، L03).
 *
 * JPEG التصميم بـ٣٠٠ نقطة كان يخرج بكثافة ١:١ بلا وحدة، فيفتحه برنامج الطباعة بـ٩٦ ويطبعه أكبر من A4.
 * فإن كان بعد `FFD8` مقطع JFIF تُكتب فيه الوحدة إنشًا والكثافتان (وطوله كما هو)، وإلا يُدرج مقطعٌ معياريّ
 * (١٦ بايتًا، الإصدار 1.01، بلا مصغّرة) بعد `FFD8` مباشرةً. وما بعد المقطع — الصورة نفسها — لا يُمسّ، وما ليس JPEG يعود كما هو.
 */
export function withJpegDensity(jpeg: Buffer, dpi: number): Buffer {
  if (jpeg.length < 4 || jpeg[0] !== 0xff || jpeg[1] !== 0xd8) return jpeg;
  const d = Math.max(1, Math.min(0xffff, Math.round(dpi)));
  if (jpeg.length >= 18 && jpeg[2] === 0xff && jpeg[3] === 0xe0 && jpeg.readUInt16BE(4) >= 16 && jpeg.toString('latin1', 6, 11) === 'JFIF\0') {
    const out = Buffer.from(jpeg);
    out[13] = 1; // الوحدة: الإنش
    out.writeUInt16BE(d, 14);
    out.writeUInt16BE(d, 16);
    return out;
  }
  const app0 = Buffer.from([0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, d >> 8, d & 0xff, d >> 8, d & 0xff, 0x00, 0x00]);
  return Buffer.concat([jpeg.subarray(0, 2), app0, jpeg.subarray(2)]);
}
