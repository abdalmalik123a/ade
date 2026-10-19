/**
 * أداة وتجربة قياس التعرّف الضوئي العربي (D110، الموجة ٤).
 *
 * تقارن زمن التعرّف ونسبة الثقة واستهلاك الذاكرة بين المحرّك القائم (Tesseract.js WASM)
 * وبديل ONNX Runtime على وثائق واستمارات ومستمسكات ديوان الحقيقية.
 *
 * التشغيل:
 *   node tools/experiments/ocrBenchmark.mjs
 */
import { cpus, totalmem } from 'node:os';
import { resolve } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { createWorker } from 'tesseract.js';

function getMemoryUsageMb() {
  const mem = process.memoryUsage();
  return {
    rss: Math.round(mem.rss / (1024 * 1024)),
    heapUsed: Math.round(mem.heapUsed / (1024 * 1024))
  };
}

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function benchmarkTesseract(samples, tessdataDir) {
  console.log('\n======================================================');
  console.log('١. قياس المحرّك القائم: Tesseract.js 7.0 (WASM)');
  console.log('======================================================');

  const memBefore = getMemoryUsageMb();
  const t0 = performance.now();
  const worker = await createWorker(['ara', 'eng'], 1, {
    langPath: tessdataDir,
    gzip: true,
    cacheMethod: 'none'
  });
  const initMs = Math.round(performance.now() - t0);
  const memAfterInit = getMemoryUsageMb();

  console.log(`- زمن التهيئة الباردة (تحميل القاموسين ara + eng): ${initMs} م.ث`);
  console.log(`- الذاكرة بعد التهيئة: RSS = ${memAfterInit.rss} م.ب (زيادة ${memAfterInit.rss - memBefore.rss} م.ب)`);

  const results = [];

  try {
    for (const sample of samples) {
      if (!existsSync(sample.path)) {
        console.warn(`[تنبيه] العيّنة غير موجودة: ${sample.path}`);
        continue;
      }
      const fileSizeKb = (statSync(sample.path).size / 1024).toFixed(1);

      // تشغيل متكرر لحساب الوسيط
      const runs = 3;
      const times = [];
      let lastRes = null;

      for (let r = 0; r < runs; r++) {
        const tStart = performance.now();
        const res = await worker.recognize(sample.path);
        times.push(Math.round(performance.now() - tStart));
        lastRes = res;
      }

      const medTime = median(times);
      const conf = Math.round(lastRes.data.confidence ?? 0);
      const text = (lastRes.data.text ?? '').trim();
      const chars = text.length;
      const preview = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 2).join(' | ');

      results.push({
        id: sample.id,
        name: sample.name,
        type: sample.type,
        sizeKb: fileSizeKb,
        timeMs: medTime,
        confidence: conf,
        chars,
        preview
      });

      console.log(`\n• عيّنة [${sample.type}] ${sample.name} (${fileSizeKb} ك.ب):`);
      console.log(`  - زمن القراءة (وسيط ${runs} مرّات): ${medTime} م.ث`);
      console.log(`  - نسبة الثقة المصرّح بها: ${conf}%`);
      console.log(`  - طول النصّ المستخرج: ${chars} حرفًا`);
      console.log(`  - عيّنة من المقروء: "${preview || '—'}"`);
    }
  } finally {
    await worker.terminate();
    console.log('\n- أُغلق عامل Tesseract وتفرّغت موارده.');
  }

  const memFinal = getMemoryUsageMb();
  return { initMs, memAfterInit, memFinal, results };
}

function printOnnxStatus() {
  console.log('\n======================================================');
  console.log('٢. بديل التعرّف بـ ONNX Runtime');
  console.log('======================================================');
  console.log('لا نموذج تعرّفٍ عربيّ في `resources/models/` — يُقاس حين يوافق المالك على نموذجٍ بعينه ويُنزَّل.');
}

async function main() {
  console.log('======================================================');
  console.log('تجربة قياس محرّكات التعرّف الضوئي (OCR Benchmark)');
  console.log('ديوان — الموجة الرابعة «المحرّكات» (D110)');
  console.log('======================================================');

  const cpu = cpus()[0]?.model ?? 'غير معروف';
  const memGb = Math.round(totalmem() / (1024 * 1024 * 1024));
  console.log(`الجهاز المرجعي: ${cpu} (${cpus().length} أنوية) · ${memGb} غيغا رام · Win32 x64`);

  const tessdataDir = resolve('resources/tessdata');
  const samples = [
    { id: 'card-back', type: 'مستمسك', name: 'ظهر البطاقة الوطنية', path: resolve('tests/fixtures/card-back-fake.png') },
    { id: 'ids-form', type: 'مستمسكات', name: 'استمارة مستمسكات متعددة', path: resolve('tests/fixtures/forms/ids.jpg') },
    { id: 'info-form', type: 'استمارة', name: 'استمارة معلومات مواطن', path: resolve('tests/fixtures/forms/info.jpg') },
    { id: 'grad-doc', type: 'وثيقة رسمية', name: 'وثيقة تخرج رسمية', path: resolve('tests/fixtures/forms/graduation.jpg') }
  ];

  await benchmarkTesseract(samples, tessdataDir);
  printOnnxStatus();
}

main().catch((err) => {
  console.error('[خطأ في التجربة]', err);
  process.exit(1);
});
