/**
 * مدخل العامل المستقلّ (A03، D53) — عمليةٌ ثالثة بـ`utilityProcess` يُقلعها `services/workerHost.ts`.
 *
 * يأخذ الطلب من `process.parentPort`، ويجري عمله من الجدول، ويردّ نتيجةً أو إخفاقًا برسالة الخطأ كما هي (`@shared/worker`).
 * ولا يستورد `electron` ولا `db/` ولا `ipc/` (`tests/structure.test.ts`): القاعدة والمخزن في الرئيسة وحدها.
 * والجدول يُصدَّر فيُنادى في الاختبار بلا Electron — و`parentPort` لا يوجد هناك فلا يُستمع لشيء.
 */
import type { WorkerInput, WorkerJob, WorkerOutput, WorkerReply, WorkerRequest } from '@shared/worker';

type Job<J extends WorkerJob> = (input: WorkerInput<J>) => WorkerOutput<J> | Promise<WorkerOutput<J>>;

/** جدول الأعمال — اليوم فارغٌ إلا «أنا هنا» (D53)؛ وأوّل عملٍ حقيقيّ في D54. */
export const JOBS: { [J in WorkerJob]: Job<J> } = {
  ping: () => ({ pid: process.pid, at: Date.now() }),
  crash: () => {
    // بابٌ للاختبار وحده: محذوفٌ من بناء الإصدار.
    if (__DIWAN_TEST_DOORS__) process.exit(1);
    throw new Error('عملٌ غير متاح');
  }
};

/** يجري الطلب ويعيد جوابه — وما رماه العمل إخفاقٌ برسالته. */
export async function answer(request: WorkerRequest): Promise<WorkerReply> {
  try {
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
