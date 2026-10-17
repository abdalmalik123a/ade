/**
 * مضيف العامل المستقلّ (A03، D53؛ ARCHITECTURE §٢ «العامل المستقلّ») — يُقلع العامل عند أوّل طلب، ويوصل كلّ جوابٍ إلى طلبه بمعرّفه.
 *
 * وإن خرج العامل والطلبات معلّقة: يُرفض كلٌّ بـ«توقّف المعالج — جرّب ثانيةً» ويُقيَّد في سجلّ الأخطاء، ويبقى البرنامج يعمل،
 * والطلب التالي يُقلع عمليةً جديدة. و`close()` يقتله عند إغلاق البرنامج. ودالّة الإقلاع تُعطى للصنف فيُختبر بعمليةٍ مزيّفة
 * (`tests/workerHost.test.ts`). و`utilityProcess.fork` هنا وحده (`tests/structure.test.ts`).
 */
import { join } from 'node:path';
import { utilityProcess } from 'electron';
import { WORKER_STOPPED, type WorkerInput, type WorkerJob, type WorkerOutput, type WorkerReply, type WorkerRequest } from '@shared/worker';
import { logError } from '../errorLog';

/** ما يحتاجه المضيف من عملية العامل. */
export interface WorkerProcess {
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: WorkerRequest): void;
  kill(): boolean;
}

type Pending = { resolve: (output: unknown) => void; reject: (error: Error) => void };

export class WorkerHost {
  readonly #spawn: () => WorkerProcess;
  #proc: WorkerProcess | null = null;
  #nextId = 1;
  /** الطلبات المعلّقة على العملية الحاضرة وحدها — وما كان لعمليةٍ ماتت رُفض معها. */
  readonly #pending = new Map<number, Pending>();

  constructor(spawn: () => WorkerProcess) {
    this.#spawn = spawn;
  }

  /** يجري العمل في العامل — ويُقلعه إن لم يكن قائمًا. */
  run<J extends WorkerJob>(job: J, input: WorkerInput<J>): Promise<WorkerOutput<J>> {
    const id = this.#nextId++;
    // وإقلاعٌ تعذّر يرفض الوعد لا يرمي.
    return new Promise<WorkerOutput<J>>((resolve, reject) => {
      const proc = this.#proc ?? this.#start();
      this.#pending.set(id, { resolve: resolve as (output: unknown) => void, reject });
      proc.postMessage({ id, job, input });
    });
  }

  /** يقتل العامل (عند إغلاق البرنامج) — وما بقي معلّقًا يُرفض، ولا يُقلع شيء. */
  close(): void {
    const proc = this.#proc;
    this.#proc = null;
    proc?.kill();
    this.#rejectAll(WORKER_STOPPED);
  }

  #start(): WorkerProcess {
    const proc = this.#spawn();
    this.#proc = proc;
    proc.on('message', (message) => {
      // جوابٌ من عمليةٍ لم تعد الحاضرة لا يحلّ طلبًا.
      if (this.#proc === proc) this.#settle(message as WorkerReply);
    });
    proc.on('exit', (code) => {
      if (this.#proc !== proc) return;
      this.#proc = null;
      logError('worker', new Error(`خرج المعالج (${code}) وفي انتظاره ${this.#pending.size} طلب`));
      this.#rejectAll(WORKER_STOPPED);
    });
    return proc;
  }

  #settle(reply: WorkerReply): void {
    const entry = this.#pending.get(reply.id);
    if (!entry) return;
    this.#pending.delete(reply.id);
    if (reply.type === 'result') entry.resolve(reply.output);
    else entry.reject(new Error(reply.message));
  }

  #rejectAll(message: string): void {
    const all = [...this.#pending.values()];
    this.#pending.clear();
    for (const entry of all) entry.reject(new Error(message));
  }
}

let host: WorkerHost | null = null;

/** المضيف الواحد للبرنامج — والعامل `out/main/worker.js` بجانب `index.js` (مدخلٌ ثانٍ في `electron.vite.config.ts`). */
export function workerHost(): WorkerHost {
  host ??= new WorkerHost(() => utilityProcess.fork(join(__dirname, 'worker.js'), [], { serviceName: 'Diwan worker' }));
  return host;
}

/** عند إغلاق البرنامج (`before-quit`): يُقتل العامل إن كان قائمًا. */
export function closeWorker(): void {
  host?.close();
}
