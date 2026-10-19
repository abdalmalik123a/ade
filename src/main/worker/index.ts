/**
 * مدخل العامل المستقلّ (A03، D53) — عمليةٌ ثالثة بـ`utilityProcess` يُقلعها `services/workerHost.ts`.
 *
 * يأخذ الطلب من `process.parentPort`، ويجري عمله من الجدول، ويردّ نتيجةً أو إخفاقًا برسالة الخطأ كما هي (`@shared/worker`).
 * ولا يستورد `electron` ولا `db/` ولا `ipc/` (`tests/structure.test.ts`): القاعدة والمخزن في الرئيسة وحدها.
 * والجدول يُصدَّر فيُنادى في الاختبار بلا Electron — و`parentPort` لا يوجد هناك فلا يُستمع لشيء.
 */
import { readFile } from 'node:fs/promises';
import type { WorkerInput, WorkerJob, WorkerOutput, WorkerReply, WorkerRequest } from '@shared/worker';
import { cutout, detectFace } from '../services/portrait';
import { objectCutout } from '../services/objectCutout';
import { assertPixels, designKind } from '../services/importGuard';
import { readDesign } from '../services/designImport';
import { flattenPsd } from '../services/design/flatten';
import { importTemplateFile } from '../services/import';
import { letterheadImagePath } from '../services/letterheadImage';
import { setNativePsdReader } from '../services/psd';
import { createNativePsdReader, loadNativePsd } from './nativePsd';

const { addon: initialAddon } = loadNativePsd();
if (initialAddon) {
  setNativePsdReader(createNativePsdReader(initialAddon));
}

type Job<J extends WorkerJob> = (input: WorkerInput<J>) => WorkerOutput<J> | Promise<WorkerOutput<J>>;

/**
 * جدول الأعمال: «أنا هنا» (D53)، و«أزل الخلفية» بنموذجيها (D54)، و«استورد تصميمًا» (D56)، وقراءة Word نموذجًا (D57) — تُنادى خدماتها كما هي؛ ومسار النموذج
 * وفحصه وطول البكسلات في الرئيسة قبل الإرسال (`ipc/photos.ts`)، وكذلك حوار الملف وسقف حجمه وخطوط المكتب (`ipc/designs.ts`).
 */
export const JOBS: { [J in WorkerJob]: Job<J> } = {
  ping: () => {
    const { addon, error } = loadNativePsd();
    return {
      pid: process.pid,
      at: Date.now(),
      psd: addon ? addon.psdEngineVersion() : null,
      psdError: addon ? null : error
    };
  },
  crash: () => {
    // بابٌ للاختبار وحده: محذوفٌ من بناء الإصدار.
    if (__DIWAN_TEST_DOORS__) process.exit(1);
    throw new Error('عملٌ غير متاح');
  },
  cutout: async ({ modelPath, facePath, pixels, width, height }) => {
    const [cut, face] = await Promise.all([
      cutout(modelPath, pixels, width, height),
      facePath
        ? detectFace(facePath, pixels, width, height).catch((e: unknown) => {
            console.error('[photos] تعذّر كشف الوجه', e);
            return null;
          })
        : null
    ]);
    return { ...cut, face };
  },
  cutoutObject: ({ modelPath, pixels, width, height }) => objectCutout(modelPath, pixels, width, height),
  readDesign: async ({ path, name, fonts }) => {
    // سقف النقاط قبل الفكّ (D51) — ورسالته تعبر إخفاقًا كما هي.
    const bytes = await readFile(path);
    assertPixels(bytes, designKind(name));
    const imported = readDesign(bytes, name, fonts);
    // Photoshop يأتي بخلفيته ممحوّةً منها العناصر؛ وإن تعذّرت سُطّح هنا كما هو.
    return { imported, flat: imported.source === 'psd' && !imported.images.length ? flattenPsd(bytes) : null };
  },
  readTemplate: async ({ path }) => {
    // الصورة لا تُكتب هنا: تُعطى اسمها في المخزن وتُجمع بايتاتها مرّةً لكلّ اسم، والرئيسة تكتبها.
    const images = new Map<string, Uint8Array>();
    const template = await importTemplateFile(path, (bytes, extension) => {
      const name = letterheadImagePath(bytes, extension);
      // `slice()`: المصفوفة قد تكون نافذةً على مخزنٍ أكبر — وتُنسخ بين العمليّتين بمخزنها كلّه.
      if (!images.has(name)) images.set(name, bytes.slice());
      return name;
    });
    return { template, images: [...images].map(([name, bytes]) => ({ path: name, bytes })) };
  }
};

/** باب اختبار (D55): م.ث يتأخّرها العامل قبل كلّ عملٍ غير «أنا هنا» — فتُرى المهلة والإلغاء بلا صورةٍ ضخمة. */
const SLOW_MS = __DIWAN_TEST_DOORS__ ? Number(process.env['DIWAN_TEST_SLOW_WORKER'] ?? 0) || 0 : 0;

/** يجري الطلب ويعيد جوابه — وما رماه العمل إخفاقٌ برسالته. */
export async function answer(request: WorkerRequest): Promise<WorkerReply> {
  try {
    if (SLOW_MS > 0 && request.job !== 'ping') await new Promise((r) => setTimeout(r, SLOW_MS));
    const job = JOBS[request.job] as Job<WorkerJob> | undefined;
    if (!job) throw new Error(`عملٌ غير معروف: ${String(request.job)}`);
    return { type: 'result', id: request.id, output: await job(request.input as never) };
  } catch (e) {
    return { type: 'failure', id: request.id, message: e instanceof Error ? e.message : String(e) };
  }
}

const port = process.parentPort as typeof process.parentPort | undefined;
port?.on('message', (event) => {
  void answer(event.data as WorkerRequest).then((reply) => port.postMessage(reply));
});
