// انتهى — البديل: لا مقارنة بعد غياب قارئ TS (legacy/src/main/services/psd.ts)، وقياس D105 المكتوب في QUALITY §٨ باقٍ — الأمر D147 — ٢٤ ت١ ٢٠٢٦
/**
 * قياس أداء readPsd بين محرّك Rust الأصلي وبديل TypeScript (A20، D105).
 *
 * تجربةٌ لا سيناريو (لا ✓ ولا ✗):
 * يبني ملف PSD كبيرًا (٤٠٠٠×٣٠٠٠ بـ RLE مضغوط) ويقيس وسيط ٥ قراءات لكلّ محرّك.
 */
import { createRequire } from 'node:module';
import { cpus, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { readPsd, readPsdScript, setNativePsdReader } from '../../src/main/services/psd.ts';
import { createNativePsdReader } from '../../src/main/worker/nativePsd.ts';

const req = createRequire(import.meta.url);

function buildLargeRlePsd(w = 4000, h = 3000) {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4); // version 1
  head.writeUInt16BE(3, 12); // 3 channels (RGB)
  head.writeUInt32BE(h, 14);
  head.writeUInt32BE(w, 18);
  head.writeUInt16BE(8, 22); // 8-bit
  head.writeUInt16BE(3, 24); // RGB color mode

  const color = Buffer.alloc(4);
  const resources = Buffer.alloc(4);
  const layers = Buffer.alloc(16);
  layers.writeUInt32BE(12, 0);
  layers.writeUInt32BE(8, 4);

  const compression = Buffer.alloc(2);
  compression.writeUInt16BE(1); // RLE

  const channels = 3;
  const rows = h * channels;
  const lengths = Buffer.alloc(rows * 2);

  // 4000 بكسل = 31 كتلة تكرار بطول 128 (3968) + كتلة واحدة بطول 32 (32)
  const fullChunks = Math.floor(w / 128);
  const rem = w % 128;
  const rowBytes = fullChunks * 2 + (rem > 0 ? 2 : 0);

  const rowData = [];
  let at = 0;
  for (let c = 0; c < channels; c++) {
    for (let y = 0; y < h; y++) {
      lengths.writeUInt16BE(rowBytes, at);
      at += 2;

      const rowBuf = Buffer.alloc(rowBytes);
      let p = 0;
      const val = (c * 70 + y * 13) % 256;
      for (let i = 0; i < fullChunks; i++) {
        rowBuf[p++] = 0x81; // repeat 128
        rowBuf[p++] = val;
      }
      if (rem > 0) {
        rowBuf[p++] = (1 - rem) & 0xff; // repeat rem
        rowBuf[p++] = val;
      }
      rowData.push(rowBuf);
    }
  }

  return Buffer.concat([head, color, resources, layers, compression, lengths, ...rowData]);
}

const median = (arr) => {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

async function main() {
  const nativePath = resolve('native/diwan-psd/diwan_psd.node');
  const addon = req(nativePath);
  setNativePsdReader(createNativePsdReader(addon));

  console.log('جهاز الفحص:');
  const cpu = cpus()[0]?.model ?? 'غير معروف';
  const memGb = Math.round(totalmem() / (1024 * 1024 * 1024));
  console.log(`  المعالج: ${cpu} (${cpus().length} نواة)`);
  console.log(`  الذاكرة: ${memGb} غ.ب`);
  console.log(`  نظام التشغيل: Windows ${process.arch}`);

  console.log('\nبناء ملف PSD كبير (٤٠٠٠×٣٠٠٠ بـ RLE مضغوط)...');
  const tBuild0 = performance.now();
  const psdBuf = buildLargeRlePsd(4000, 3000);
  const tBuild = Math.round(performance.now() - tBuild0);
  console.log(`  حجم الملف: ${(psdBuf.length / 1024).toFixed(1)} ك.ب (زمن البناء: ${tBuild} م.ث)`);
  console.log('  البكسلات المسطَّحة بعد الفك: 12,000,000 بكسل (48 م.ب RGBA)');

  // إحماء
  console.log('\nإحماء المحرّكين...');
  readPsd(psdBuf);
  readPsdScript(psdBuf);

  const RUNS = 5;

  console.log(`\nقياس محرّك Rust الأصلي (${RUNS} مرّات)...`);
  const rustTimes = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = readPsd(psdBuf);
    const ms = performance.now() - t0;
    if (!res || !res.rgba) throw new Error('فشل readPsd في Rust');
    rustTimes.push(ms);
    console.log(`  تشغيل ${i + 1}: ${ms.toFixed(1)} م.ث`);
  }
  const rustMedian = median(rustTimes);

  console.log(`\nقياس محرّك TypeScript البديل (${RUNS} مرّات)...`);
  const tsTimes = [];
  for (let i = 0; i < RUNS; i++) {
    const t0 = performance.now();
    const res = readPsdScript(psdBuf);
    const ms = performance.now() - t0;
    if (!res || !res.rgba) throw new Error('فشل readPsdScript في TS');
    tsTimes.push(ms);
    console.log(`  تشغيل ${i + 1}: ${ms.toFixed(1)} م.ث`);
  }
  const tsMedian = median(tsTimes);

  const speedup = (tsMedian / rustMedian).toFixed(2);
  console.log('\nالنتائج:');
  console.log(`  وسيط Rust:       ${rustMedian.toFixed(1)} م.ث`);
  console.log(`  وسيط TypeScript: ${tsMedian.toFixed(1)} م.ث`);
  console.log(`  الفارق والسرعة:   محرّك Rust أسرع بنحو ${speedup}x ضعفا (توفير ${(tsMedian - rustMedian).toFixed(1)} م.ث)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
