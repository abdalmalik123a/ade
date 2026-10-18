/**
 * دقّة الصورة داخل ملفّ PNG (مقطع pHYs) — نُقل من `render.ts` (D80).
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
