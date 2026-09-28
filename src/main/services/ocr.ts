import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { createWorker, PSM, type Worker } from 'tesseract.js';
import type { OcrLine as PaperLine } from '@shared/paperDoc';
import type { LinesOcr, OcrLine } from './mrzRead';

/**
 * استخراج النصوص من المستمسكات الممسوحة.
 *
 * بيانات اللغة مضمّنة في resources/tessdata، فيعمل التعرّف مقطوعًا عن
 * الإنترنت — التطبيق «محلي»، ولا يُطلب من المكتب تثبيت شيء.
 */

let worker: Worker | null = null;

function tessdataDir(): string {
  const candidates = [
    join(process.resourcesPath ?? '', 'tessdata'),
    join(app.getAppPath(), 'resources', 'tessdata'),
    join(app.getAppPath(), '..', 'resources', 'tessdata')
  ];
  return candidates.find((p) => existsSync(join(p, 'ara.traineddata.gz'))) ?? candidates[1]!;
}

export function ocrAvailable(): boolean {
  return existsSync(join(tessdataDir(), 'ara.traineddata.gz'));
}

async function getWorker(): Promise<Worker> {
  if (worker) return worker;
  worker = await createWorker(['ara', 'eng'], 1, {
    langPath: tessdataDir(),
    gzip: true,
    cacheMethod: 'none'
  });
  return worker;
}

export type OcrResult = { text: string; confidence: number };

/**
 * يعيد النصّ ونسبة الثقة (0..1).
 * النسبة تُعرض للموظف ليقرّر: تحت 90% يراجع بنفسه قبل الاعتماد.
 */
export async function recognize(imagePath: string): Promise<OcrResult> {
  if (!ocrAvailable()) {
    throw new Error('بيانات التعرّف على النصوص غير مثبّتة مع التطبيق');
  }
  const w = await getWorker();
  const { data } = await w.recognize(imagePath);
  return {
    text: (data.text ?? '').replace(/\s+\n/g, '\n').trim(),
    confidence: Math.max(0, Math.min(1, (data.confidence ?? 0) / 100))
  };
}

// ── صورة الورقة ← كتاب (هـ٨): الأسطر بكلماتها ومواضعها ─────────────────

/**
 * عاملٌ مستقلّ لقراءة الورقة: إعداداته (الدقّة) لا تمسّ قراءة المستمسكات، وقراءةُ
 * مستمسكٍ في أثناء قراءة ورقةٍ لا تنتظر دورها خلفها.
 */
let pageWorker: Worker | null = null;

async function getPageWorker(): Promise<Worker> {
  if (pageWorker) return pageWorker;
  pageWorker = await createWorker(['ara', 'eng'], 1, {
    langPath: tessdataDir(),
    gzip: true,
    cacheMethod: 'none'
  });
  return pageWorker;
}

/**
 * يقرأ صورة ورقةٍ (PNG بعد تقويمها ومحو خطوطها وأختامها) ويعيد كلَّ سطرٍ بكلماته
 * وصناديقها وثقتها — فالكتاب يُبنى من المواضع لا من نصٍّ مسطَّح.
 *
 * `dpi` دقّة الصورة إن عُرفت (الماسح يكتبها، وصورة الهاتف تُقدَّر من عرض A4).
 */
export async function recognizeLayout(png: Uint8Array, dpi: number | null): Promise<PaperLine[]> {
  if (!ocrAvailable()) {
    throw new Error('بيانات التعرّف على النصوص غير مثبّتة مع التطبيق');
  }
  const w = await getPageWorker();
  await w.setParameters({ user_defined_dpi: String(Math.round(dpi && dpi >= 70 ? dpi : 300)) });
  const { data } = await w.recognize(Buffer.from(png), {}, { blocks: true });
  const box = (b: { x0: number; y0: number; x1: number; y1: number }) => ({ x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
  const lines: PaperLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        lines.push({
          conf: Math.round(line.confidence),
          box: box(line.bbox),
          words: line.words.map((word) => ({ text: word.text, conf: Math.round(word.confidence), box: box(word.bbox) }))
        });
      }
    }
  }
  return lines;
}

// ── ظهر البطاقة (تعميق الموجود ٨): الإنكليزيّ وحده، أسطرًا برموزها ومواضعها ─────
let mrzWorker: Worker | null = null;

async function getMrzWorker(): Promise<Worker> {
  if (mrzWorker) return mrzWorker;
  mrzWorker = await createWorker(['eng'], 1, { langPath: tessdataDir(), gzip: true, cacheMethod: 'none' });
  return mrzWorker;
}

/** أسطر صورةٍ برموزها — للقارئ الخاصّ (`mrzRead.ts`). */
export const recognizeLines: LinesOcr = async (png, opts) => {
  if (!ocrAvailable()) throw new Error('بيانات التعرّف على النصوص غير مثبّتة مع التطبيق');
  const w = await getMrzWorker();
  await w.setParameters({
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    tessedit_char_whitelist: opts.whitelist ?? '',
    user_defined_dpi: '300'
  });
  const { data } = await w.recognize(Buffer.from(png), {}, { blocks: true });
  const lines: OcrLine[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        lines.push({
          text: line.text,
          box: line.bbox,
          symbols: line.words.flatMap((word) => word.symbols.map((s) => ({ text: s.text, box: s.bbox })))
        });
      }
    }
  }
  return lines;
};

export async function shutdownOcr(): Promise<void> {
  if (mrzWorker) {
    await mrzWorker.terminate();
    mrzWorker = null;
  }
  if (worker) {
    await worker.terminate();
    worker = null;
  }
  if (pageWorker) {
    await pageWorker.terminate();
    pageWorker = null;
  }
}
