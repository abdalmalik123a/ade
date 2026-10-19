/**
 * مقارنة محرّك Rust الأصلي بـ TypeScript على كلّ ملفّات PSD (A20، D104):
 * - الأبعاد والدقّة وrgba بايتًا ببايت وplanes بايتًا ببايت والتنبيهات
 * - بُناة psdBuilder وdesignImport (RGB وCMYK وGrayscale وRLE وخام)
 * - ملف psd-styles.psd
 * - PSB وملفّات مبتورة وحالات الخطأ
 * - قوالب المالك الحقيقية (realPsd / GyanTech)
 * - ويسقط الاختبار صراحةً إن لم تُحمَّل الإضافة.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { readPsdScript, setNativePsdReader, type PsdImage } from '../src/main/services/psd';
import { createNativePsdReader, loadNativePsd } from '../src/main/worker/nativePsd';
import { layeredPsd } from './psdBuilder';

let nativeReader: ((bytes: Uint8Array) => PsdImage | null) | null = null;

function psdFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? psdFiles(join(dir, e.name)) : e.name.toLowerCase().endsWith('.psd') ? [join(dir, e.name)] : []
  );
}

function expectPsdMatch(bytes: Uint8Array, label: string) {
  const script = readPsdScript(bytes);
  if (!nativeReader) throw new Error('محرّك Rust غير مهيّأ');
  const native = nativeReader(bytes);

  if (script === null) {
    expect(native, `${label}: يجب أن يعيد Rust قيمة null كما يعيدها TS`).toBeNull();
    return;
  }

  expect(native, `${label}: ناتج Rust غير فارغ`).not.toBeNull();
  expect(native!.width, `${label}: العرض`).toBe(script.width);
  expect(native!.height, `${label}: الارتفاع`).toBe(script.height);
  expect(native!.dpi, `${label}: الدقّة DPI`).toBe(script.dpi);
  expect(native!.warnings, `${label}: التنبيهات`).toEqual(script.warnings);

  if (script.rgba === null) {
    expect(native!.rgba, `${label}: rgba يجب أن تكون null`).toBeNull();
  } else {
    expect(native!.rgba, `${label}: rgba غير فارغة`).not.toBeNull();
    expect(native!.rgba!.length, `${label}: طول rgba`).toBe(script.rgba.length);
    const diff = Buffer.compare(Buffer.from(native!.rgba!), Buffer.from(script.rgba));
    expect(diff, `${label}: تطابق rgba بايتًا ببايت`).toBe(0);
  }

  if (!script.planes) {
    expect(native!.planes, `${label}: planes غير معرّفة`).toBeUndefined();
  } else {
    expect(native!.planes, `${label}: planes معرّفة`).toBeDefined();
    expect(native!.planes!.length, `${label}: عدد القنوات`).toBe(script.planes.length);
    for (let c = 0; c < script.planes.length; c++) {
      const diff = Buffer.compare(Buffer.from(native!.planes![c]!), Buffer.from(script.planes[c]!));
      expect(diff, `${label}: تطابق القناة ${c} بايتًا ببايت`).toBe(0);
    }
  }
}

/** باني PSD خام لمختلف الصيغ والأعماق (منقول من designImport.test.ts). */
function buildRawPsd(w: number, h: number, dpi?: number, colorMode = 3, channelValues = [10, 20, 30], depth = 8, compressionVal = 0): Uint8Array {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(channelValues.length, 12);
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(depth, 22);
  head.writeUInt16BE(colorMode, 24);

  const color = Buffer.alloc(4);

  let resources = Buffer.alloc(0);
  if (dpi !== undefined) {
    const block = Buffer.alloc(12 + 16);
    block.write('8BIM', 0, 'ascii');
    block.writeUInt16BE(1005, 4);
    block.writeUInt8(0, 6);
    block.writeUInt8(0, 7);
    block.writeUInt32BE(16, 8);
    block.writeUInt32BE(Math.round(dpi * 65536), 12);
    block.writeUInt32BE(Math.round(dpi * 65536), 20);
    resources = block;
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(resources.length);

  const layers = Buffer.alloc(16);
  layers.writeUInt32BE(12, 0);
  layers.writeUInt32BE(8, 4);

  const compression = Buffer.alloc(2);
  compression.writeUInt16BE(compressionVal);
  const px = Buffer.alloc(w * h * channelValues.length);
  for (let c = 0; c < channelValues.length; c++) {
    for (let i = 0; i < w * h; i++) {
      px[c * w * h + i] = channelValues[c]!;
    }
  }

  return Buffer.concat([head, color, length, resources, layers, compression, px]);
}

/** باني PSD مضغوط بـ PackBits / RLE (منقول من designImport.test.ts). */
function buildRlePsd(w: number, h: number, channelValues: number[], colorMode = 3): Uint8Array {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(channelValues.length, 12);
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(colorMode, 24);

  const color = Buffer.alloc(4);
  const resources = Buffer.alloc(4);
  const layers = Buffer.alloc(16);
  layers.writeUInt32BE(12, 0);
  layers.writeUInt32BE(8, 4);

  const compression = Buffer.alloc(2);
  compression.writeUInt16BE(1);

  const rows: Buffer[] = [];
  const lengths = Buffer.alloc(h * channelValues.length * 2);
  let at = 0;
  for (const value of channelValues) {
    for (let y = 0; y < h; y++) {
      const row = Buffer.alloc(w + 2);
      row[0] = 1 - w;
      row[1] = value;
      rows.push(row.subarray(0, 2));
      lengths.writeUInt16BE(2, at);
      at += 2;
    }
  }

  return Buffer.concat([head, color, resources, layers, compression, lengths, ...rows]);
}

describe('مقارنة المحرّكين الأصلي (Rust) و TypeScript على كلّ ملفّات PSD (A20، D104)', () => {
  beforeAll(() => {
    const { addon, error } = loadNativePsd();
    expect(error, `فشل تحميل إضافة Rust: ${error}`).toBeNull();
    expect(addon, 'إضافة Rust غير محمّلة (diwan_psd.node)').not.toBeNull();
    nativeReader = createNativePsdReader(addon!);
    setNativePsdReader(nativeReader);
  });

  describe('١ — ملفّات psdBuilder (طبقات وصورة مسطَّحة)', () => {
    it('RGB layered PSD (RAW composite)', () => {
      const buf = layeredPsd({
        w: 50,
        h: 40,
        dpi: 300,
        composite: (x, y) => [(x * 7) % 256, (y * 9) % 256, ((x + y) * 5) % 256],
        layers: []
      });
      expectPsdMatch(buf, 'psdBuilder RGB');
    });

    it('CMYK layered PSD (RAW composite مقلوب كما يخزّنه Photoshop)', () => {
      const buf = layeredPsd({
        w: 50,
        h: 40,
        cmyk: true,
        dpi: 300,
        composite: (x, y) => [(x * 5) % 256, (y * 7) % 256, 128, 200],
        layers: []
      });
      expectPsdMatch(buf, 'psdBuilder CMYK');
    });
  });

  describe('٢ — بُناة designImport (خام و RLE لمختلف الأنماط والألوان)', () => {
    it('RGB خام مع DPI وبدونه', () => {
      expectPsdMatch(buildRawPsd(20, 15, 300, 3, [255, 128, 0]), 'Raw RGB with DPI');
      expectPsdMatch(buildRawPsd(20, 15, undefined, 3, [100, 150, 200]), 'Raw RGB without DPI');
    });

    it('CMYK خام بأربع قنوات', () => {
      expectPsdMatch(buildRawPsd(16, 16, 300, 4, [10, 50, 150, 220]), 'Raw CMYK');
    });

    it('Grayscale خام بقناة واحدة', () => {
      expectPsdMatch(buildRawPsd(16, 16, 300, 1, [175]), 'Raw Grayscale');
    });

    it('RGB بضغط RLE (PackBits)', () => {
      expectPsdMatch(buildRlePsd(30, 20, [10, 20, 30], 3), 'RLE RGB');
    });

    it('CMYK بضغط RLE (PackBits)', () => {
      expectPsdMatch(buildRlePsd(30, 20, [10, 20, 30, 40], 4), 'RLE CMYK');
    });

    it('Grayscale بضغط RLE (PackBits)', () => {
      expectPsdMatch(buildRlePsd(30, 20, [128], 1), 'RLE Grayscale');
    });
  });

  describe('٣ — ملف الملحقات psd-styles.psd', () => {
    it('tests/fixtures/psd-styles.psd', () => {
      const p = join(__dirname, 'fixtures', 'psd-styles.psd');
      expect(existsSync(p), `الملف ${p} غير موجود`).toBe(true);
      const bytes = readFileSync(p);
      expectPsdMatch(bytes, 'psd-styles.psd');
    });
  });

  describe('٤ — الحالات الحدّية وملفّات تالفة أو غير مدعومة', () => {
    it('PSB (الإصدار ٢) يُرفض ويعيد null في المحرّكين', () => {
      const psb = Buffer.alloc(40);
      psb.write('8BPS', 0, 'ascii');
      psb.writeUInt16BE(2, 4);
      psb.writeUInt16BE(3, 12);
      psb.writeUInt32BE(100, 14);
      psb.writeUInt32BE(100, 18);
      psb.writeUInt16BE(8, 22);
      psb.writeUInt16BE(3, 24);
      expectPsdMatch(psb, 'PSB version 2');
    });

    it('ملف مبتور أصغر من ٢٦ بايت يعيد null في المحرّكين', () => {
      expectPsdMatch(Buffer.from('8BPS'), 'Truncated < 26');
    });

    it('ملف بتوقيع غير 8BPS يعيد null في المحرّكين', () => {
      const bad = Buffer.alloc(30);
      bad.write('JPEG', 0, 'ascii');
      expectPsdMatch(bad, 'Invalid magic');
    });

    it('ملف بأبعاد صفرية يعيد null في المحرّكين', () => {
      const zero = Buffer.alloc(30);
      zero.write('8BPS', 0, 'ascii');
      zero.writeUInt16BE(1, 4);
      zero.writeUInt32BE(0, 14);
      zero.writeUInt32BE(0, 18);
      expectPsdMatch(zero, 'Zero dimensions');
    });

    it('ملف مبتور بعد الموارد وقبل الطبقات يعيد تحذير "الملف مبتور" في المحرّكين', () => {
      const truncated = Buffer.alloc(34);
      truncated.write('8BPS', 0, 'ascii');
      truncated.writeUInt16BE(1, 4);
      truncated.writeUInt16BE(3, 12);
      truncated.writeUInt32BE(10, 14);
      truncated.writeUInt32BE(10, 18);
      truncated.writeUInt16BE(8, 22);
      truncated.writeUInt16BE(3, 24);
      // color length = 0 at 26, resources length = 0 at 30
      expectPsdMatch(truncated, 'Truncated before layers');
    });

    it('عمق غير ٨ بتّات (١٦ بتًّا) يضع تحذير depth ويعيد rgba: null في المحرّكين', () => {
      const d16 = buildRawPsd(10, 10, undefined, 3, [10, 20, 30], 16);
      expectPsdMatch(d16, 'Depth 16');
    });

    it('نمط ألوان غير مدعوم (Lab = 9) يضع تحذير mode ويعيد rgba: null في المحرّكين', () => {
      const m9 = buildRawPsd(10, 10, undefined, 9, [10, 20, 30]);
      expectPsdMatch(m9, 'Mode 9 (Lab)');
    });

    it('ضغط غير مدعوم (ZIP = 2) يضع تحذير zip ويعيد rgba: null في المحرّكين', () => {
      const zip = buildRawPsd(10, 10, undefined, 3, [10, 20, 30], 8, 2);
      expectPsdMatch(zip, 'Compression 2 (ZIP)');
    });

    it('(أ) ملف ٢٨ بايتًا: TS يرمي RangeError و Rust يعيد null (مقبول ومكتوب)', () => {
      const b28 = Buffer.alloc(28);
      b28.write('8BPS', 0, 'ascii');
      b28.writeUInt16BE(1, 4);
      b28.writeUInt16BE(3, 12);
      b28.writeUInt32BE(10, 14);
      b28.writeUInt32BE(10, 18);
      b28.writeUInt16BE(8, 22);
      b28.writeUInt16BE(3, 24);
      expect(() => readPsdScript(b28)).toThrow();
      expect(nativeReader!(b28)).toBeNull();
    });

    it('(ب) مورد يتخطّى قسمه: TS و Rust متطابقان في استخراج الدقّة', () => {
      const head = Buffer.alloc(26);
      head.write('8BPS', 0, 'ascii');
      head.writeUInt16BE(1, 4);
      head.writeUInt16BE(3, 12);
      head.writeUInt32BE(10, 14);
      head.writeUInt32BE(10, 18);
      head.writeUInt16BE(8, 22);
      head.writeUInt16BE(3, 24);

      const color = Buffer.alloc(4);

      const resBlock = Buffer.alloc(12 + 16);
      resBlock.write('8BIM', 0, 'ascii');
      resBlock.writeUInt16BE(1005, 4);
      resBlock.writeUInt8(0, 6);
      resBlock.writeUInt8(0, 7);
      resBlock.writeUInt32BE(16, 8);
      resBlock.writeUInt32BE(Math.round(16 * 65536), 12);
      resBlock.writeUInt32BE(Math.round(16 * 65536), 20);

      const resLen = Buffer.alloc(4);
      resLen.writeUInt32BE(16); // resourcesEnd أصغر من طول كتلة المورد لكن البايتات متوفّرة

      const layers = Buffer.alloc(16);
      layers.writeUInt32BE(12, 0);
      layers.writeUInt32BE(8, 4);

      const compression = Buffer.alloc(2);
      compression.writeUInt16BE(0);
      const px = Buffer.alloc(10 * 10 * 3);

      const buf = Buffer.concat([head, color, resLen, resBlock, layers, compression, px]);
      expectPsdMatch(buf, 'Resource exceeding section');
    });

    it('(ج) صفّ RLE ينتهي ببايت تكرار: TS و Rust متطابقان في فكّ الضغط', () => {
      const head = Buffer.alloc(26);
      head.write('8BPS', 0, 'ascii');
      head.writeUInt16BE(1, 4);
      head.writeUInt16BE(1, 12);
      head.writeUInt32BE(2, 14);
      head.writeUInt32BE(4, 18);
      head.writeUInt16BE(8, 22);
      head.writeUInt16BE(1, 24);

      const color = Buffer.alloc(4);
      const resources = Buffer.alloc(4);
      const layers = Buffer.alloc(16);
      layers.writeUInt32BE(12, 0);
      layers.writeUInt32BE(8, 4);

      const compression = Buffer.alloc(2);
      compression.writeUInt16BE(1);

      const lengths = Buffer.alloc(4);
      lengths.writeUInt16BE(2, 0);
      lengths.writeUInt16BE(1, 2);

      const row0 = Buffer.from([0xfd, 253]);
      const row1 = Buffer.from([0xfd]);
      const trailing = Buffer.from([7, 0, 0, 0]);

      const buf = Buffer.concat([head, color, resources, layers, compression, lengths, row0, row1, trailing]);
      expectPsdMatch(buf, 'RLE row ending with repeat byte');
    });
  });

  describe('٥ — قوالب المالك الحقيقية (realPsd / GyanTech)', () => {
    const realDir = process.env.DIWAN_REAL_PSD ?? join(homedir(), 'Downloads', 'Employee Photo Identity Card PSD Template By GyanTech');
    const files = existsSync(realDir) ? psdFiles(realDir) : [];

    it(`تطابق المحرّكين على ملفّات المالك الحقيقية (${files.length} ملفًّا)`, () => {
      expect(files.length, 'مجلّد قوالب المالك الحقيقية غير موجود').toBeGreaterThan(0);
      for (const f of files) {
        const bytes = readFileSync(f);
        const relPath = f.slice(realDir.length + 1);
        expectPsdMatch(bytes, relPath);
      }
    });
  });
});
