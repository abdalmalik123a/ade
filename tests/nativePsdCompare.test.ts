/**
 * محرّك Rust على المرجع الثابت لكلّ ملفّات PSD (A20 A21، D104 D146 D147):
 * - الأبعاد والدقّة والتنبيهات وبصمة rgba وكلّ قناةٍ (sha256) لكلّ حالةٍ باسمها في `fixtures/psdGolden.json`
 * - بُناة psdBuilder وdesignImport (RGB وCMYK وGrayscale وRLE وخام)
 * - ملف psd-styles.psd
 * - PSB وملفّات مبتورة وحالات الخطأ
 * - قوالب المالك الحقيقية (realPsd / GyanTech): تُقرأ بلا رمي، وخارج المرجع (لا أسماؤها ولا بصماتها في ملفٍّ يُودَع)
 * - ويسقط الاختبار صراحةً إن لم تُحمَّل الإضافة.
 * والمرجع **ناتج قارئ TS** كتبه D146 قبل نقله إلى `legacy/src/main/services/psd.ts` (D147): ثابتٌ لا يُولَّد من Rust،
 * فحالةٌ جديدة تُضاف إليه عمدًا — وما ليس فيه يسقط.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { setNativePsdReader, type PsdImage } from '../src/main/services/psd';
import { createNativePsdReader, loadNativePsd } from '../src/main/worker/nativePsd';
import { layeredPsd } from './psdBuilder';

let nativeReader: ((bytes: Uint8Array) => PsdImage | null) | null = null;

type Print = { width: number; height: number; dpi: number | null; warnings: string[]; rgba: string | null; planes: string[] | null } | null;
const golden: Record<string, Print> = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'psdGolden.json'), 'utf8'));
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const print = (img: PsdImage | null): Print =>
  img && { width: img.width, height: img.height, dpi: img.dpi, warnings: img.warnings, rgba: img.rgba ? sha256(img.rgba) : null, planes: img.planes ? img.planes.map(sha256) : null };

function psdFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? psdFiles(join(dir, e.name)) : e.name.toLowerCase().endsWith('.psd') ? [join(dir, e.name)] : []
  );
}

/** ناتج Rust يطابق بصمة الحالة في المرجع الثابت. */
function expectGolden(bytes: Uint8Array, label: string) {
  if (!nativeReader) throw new Error('محرّك Rust غير مهيّأ');
  expect(Object.hasOwn(golden, label), `${label}: ليس في المرجع الثابت`).toBe(true);
  expect(print(nativeReader(bytes)), `${label}: المرجع الثابت`).toEqual(golden[label]);
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

describe('محرّك Rust على المرجع الثابت (A20 A21، D104 D147)', () => {
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
      expectGolden(buf, 'psdBuilder RGB');
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
      expectGolden(buf, 'psdBuilder CMYK');
    });
  });

  describe('٢ — بُناة designImport (خام و RLE لمختلف الأنماط والألوان)', () => {
    it('RGB خام مع DPI وبدونه', () => {
      expectGolden(buildRawPsd(20, 15, 300, 3, [255, 128, 0]), 'Raw RGB with DPI');
      expectGolden(buildRawPsd(20, 15, undefined, 3, [100, 150, 200]), 'Raw RGB without DPI');
    });

    it('CMYK خام بأربع قنوات', () => {
      expectGolden(buildRawPsd(16, 16, 300, 4, [10, 50, 150, 220]), 'Raw CMYK');
    });

    it('Grayscale خام بقناة واحدة', () => {
      expectGolden(buildRawPsd(16, 16, 300, 1, [175]), 'Raw Grayscale');
    });

    it('RGB بضغط RLE (PackBits)', () => {
      expectGolden(buildRlePsd(30, 20, [10, 20, 30], 3), 'RLE RGB');
    });

    it('CMYK بضغط RLE (PackBits)', () => {
      expectGolden(buildRlePsd(30, 20, [10, 20, 30, 40], 4), 'RLE CMYK');
    });

    it('Grayscale بضغط RLE (PackBits)', () => {
      expectGolden(buildRlePsd(30, 20, [128], 1), 'RLE Grayscale');
    });
  });

  describe('٣ — ملف الملحقات psd-styles.psd', () => {
    it('tests/fixtures/psd-styles.psd', () => {
      const p = join(__dirname, 'fixtures', 'psd-styles.psd');
      expect(existsSync(p), `الملف ${p} غير موجود`).toBe(true);
      const bytes = readFileSync(p);
      expectGolden(bytes, 'psd-styles.psd');
    });
  });

  describe('٤ — الحالات الحدّية وملفّات تالفة أو غير مدعومة', () => {
    it('PSB (الإصدار ٢) يُرفض ويعيد null', () => {
      const psb = Buffer.alloc(40);
      psb.write('8BPS', 0, 'ascii');
      psb.writeUInt16BE(2, 4);
      psb.writeUInt16BE(3, 12);
      psb.writeUInt32BE(100, 14);
      psb.writeUInt32BE(100, 18);
      psb.writeUInt16BE(8, 22);
      psb.writeUInt16BE(3, 24);
      expectGolden(psb, 'PSB version 2');
    });

    it('ملف مبتور أصغر من ٢٦ بايت يعيد null', () => {
      expectGolden(Buffer.from('8BPS'), 'Truncated < 26');
    });

    it('ملف بتوقيع غير 8BPS يعيد null', () => {
      const bad = Buffer.alloc(30);
      bad.write('JPEG', 0, 'ascii');
      expectGolden(bad, 'Invalid magic');
    });

    it('ملف بأبعاد صفرية يعيد null', () => {
      const zero = Buffer.alloc(30);
      zero.write('8BPS', 0, 'ascii');
      zero.writeUInt16BE(1, 4);
      zero.writeUInt32BE(0, 14);
      zero.writeUInt32BE(0, 18);
      expectGolden(zero, 'Zero dimensions');
    });

    it('ملف مبتور بعد الموارد وقبل الطبقات يعيد تحذير "الملف مبتور"', () => {
      const truncated = Buffer.alloc(34);
      truncated.write('8BPS', 0, 'ascii');
      truncated.writeUInt16BE(1, 4);
      truncated.writeUInt16BE(3, 12);
      truncated.writeUInt32BE(10, 14);
      truncated.writeUInt32BE(10, 18);
      truncated.writeUInt16BE(8, 22);
      truncated.writeUInt16BE(3, 24);
      // color length = 0 at 26, resources length = 0 at 30
      expectGolden(truncated, 'Truncated before layers');
    });

    it('عمق غير ٨ بتّات (١٦ بتًّا) يضع تحذير depth ويعيد rgba: null', () => {
      const d16 = buildRawPsd(10, 10, undefined, 3, [10, 20, 30], 16);
      expectGolden(d16, 'Depth 16');
    });

    it('نمط ألوان غير مدعوم (Lab = 9) يضع تحذير mode ويعيد rgba: null', () => {
      const m9 = buildRawPsd(10, 10, undefined, 9, [10, 20, 30]);
      expectGolden(m9, 'Mode 9 (Lab)');
    });

    it('ضغط غير مدعوم (ZIP = 2) يضع تحذير zip ويعيد rgba: null', () => {
      const zip = buildRawPsd(10, 10, undefined, 3, [10, 20, 30], 8, 2);
      expectGolden(zip, 'Compression 2 (ZIP)');
    });

    it('(أ) ملف ٢٨ بايتًا: Rust يعيد null (وكان TS يرمي RangeError — مقبول ومكتوب، وخارج المرجع)', () => {
      const b28 = Buffer.alloc(28);
      b28.write('8BPS', 0, 'ascii');
      b28.writeUInt16BE(1, 4);
      b28.writeUInt16BE(3, 12);
      b28.writeUInt32BE(10, 14);
      b28.writeUInt32BE(10, 18);
      b28.writeUInt16BE(8, 22);
      b28.writeUInt16BE(3, 24);
      expect(nativeReader!(b28)).toBeNull();
    });

    it('(ب) مورد يتخطّى قسمه: الدقّة كما في المرجع', () => {
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
      expectGolden(buf, 'Resource exceeding section');
    });

    it('(ج) صفّ RLE ينتهي ببايت تكرار: فكّ الضغط كما في المرجع', () => {
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
      expectGolden(buf, 'RLE row ending with repeat byte');
    });
  });

  // ملفّات المالك لا تدخل المستودع: يُتخطّى القسم صراحةً حيث يغيب مجلّدها، كـ`realPsd` (ر178، D196) — ومجلّدٌ بلا PSD يسقط كما كان.
  const realDir = process.env.DIWAN_REAL_PSD ?? join(homedir(), 'Downloads', 'Employee Photo Identity Card PSD Template By GyanTech');
  describe.skipIf(!existsSync(realDir))('٥ — قوالب المالك الحقيقية (realPsd / GyanTech)', () => {
    const files = existsSync(realDir) ? psdFiles(realDir) : [];

    it(`Rust يقرأ ملفّات المالك الحقيقية (${files.length} ملفًّا)`, () => {
      expect(files.length, 'مجلّد قوالب المالك الحقيقية غير موجود').toBeGreaterThan(0);
      for (const f of files) {
        const relPath = f.slice(realDir.length + 1);
        // بلا رمي، والصورة المسطَّحة بطول العرض×الطول×٤ أو تنبيهٌ يقول لماذا لم تُقرأ.
        const img = nativeReader!(readFileSync(f));
        expect(img, `${relPath}: لم يُقرأ`).not.toBeNull();
        if (img!.rgba) expect(img!.rgba.length, `${relPath}: طول rgba`).toBe(img!.width * img!.height * 4);
        else expect(img!.warnings.length, `${relPath}: بلا صورةٍ ولا تنبيه`).toBeGreaterThan(0);
      }
    }, 30000);
  });
});
