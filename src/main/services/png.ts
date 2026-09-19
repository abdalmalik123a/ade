/**
 * كتابة PNG — لما نولّده نحن: تسطيحُ طبقات Photoshop، وصفحةُ PDF مرسومة.
 *
 * ولا مكتبة: PNG أربعةُ أجزاء وCRC، و`fflate` عندنا أصلًا للضغط. ومكتبةُ صورٍ
 * جديدة تعني تبعيّةً تُراجَع مع كل ترقية، ولا تعطينا إلا هذا.
 *
 * **و`pHYs` يُكتب دائمًا**: الصورة التي نولّدها تحمل دقّتها، فلا يُسأل عنها
 * المكتب مرّةً أخرى حين تُفتح — وهي القاعدة نفسها التي نقرأ بها (§`imageSize.ts`).
 */
import { deflateSync } from 'fflate';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Uint8Array): number {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * يكتب PNG من بكسلات RGBA.
 *
 * ولكل سطرٍ بايتُ مرشِّحٍ صفريّ: لا ترشيح. فالضغط يكفي، والترشيح يزيد الحساب
 * ولا يزيد نفعًا في صورةٍ تُخزَّن مرّة وتُطبع.
 */
export function writePng(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  dpi = 300
): Buffer {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // عمقٌ ثمانيةُ بتّات
  ihdr.writeUInt8(6, 9); // RGBA
  // الضغط والترشيح والتشابك: صفرٌ كلُّها، وهي القيم الوحيدة التي يعرّفها المعيار.

  const phys = Buffer.alloc(9);
  const ppm = Math.round(dpi / 0.0254);
  phys.writeUInt32BE(ppm, 0);
  phys.writeUInt32BE(ppm, 4);
  phys.writeUInt8(1, 8); // الوحدة: المتر

  return Buffer.concat([
    MAGIC,
    chunk('IHDR', ihdr),
    chunk('pHYs', phys),
    chunk('IDAT', deflateSync(raw, { level: 6 })),
    chunk('IEND', new Uint8Array(0))
  ]);
}
