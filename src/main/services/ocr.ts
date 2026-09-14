import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { createWorker, type Worker } from 'tesseract.js';

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

export async function shutdownOcr(): Promise<void> {
  if (worker) {
    await worker.terminate();
    worker = null;
  }
}
