/**
 * مضيف العامل المستقلّ (A03، D53؛ ARCHITECTURE §٢ «العامل المستقلّ») — يُقلع العامل عند أوّل طلب، ويوصل كلّ جوابٍ إلى طلبه بمعرّفه.
 *
 * وإن خرج العامل والطلبات معلّقة: يُرفض كلٌّ بـ«توقّف المعالج — جرّب ثانيةً» ويُقيَّد في سجلّ الأخطاء، ويبقى البرنامج يعمل،
 * والطلب التالي يُقلع عمليةً جديدة. و`close()` يقتله عند إغلاق البرنامج. ودالّة الإقلاع تُعطى للصنف فيُختبر بعمليةٍ مزيّفة
 * (`tests/workerHost.test.ts`). و`utilityProcess.fork` هنا وحده (`tests/structure.test.ts`).
 *
 * و(D54) `runOr`: الطريق القديم في الرئيسة بديلٌ بعد سقوطين متتاليين للعمل نفسه (ر141) · والعامل يُغلق بعد خمولٍ (`IDLE_MS`) فتعود
 * ذاكرة النموذج، ويُقلع عند الطلب التالي.
 * و(D55) لكلّ طلبٍ مهلته (`WORKER_TIMEOUT_MS`): انقضاؤها يقتل العامل ويُرفض الطلب بـ«استغرق أكثر ممّا يُحتمل — أُوقف» · و`cancel(job)`
 * يقتله ويُرفض طلب العمل بـ«أُلغي» · والمعلّق غيرهما بـ«توقّف المعالج». ولا مهلة لما في الرئيسة: لا يُقطع، وهذا سبب العامل.
 */
import { join } from 'node:path';
import { utilityProcess } from 'electron';
import {
  WORKER_CANCELLED,
  WORKER_STOPPED,
  WORKER_TIMED_OUT,
  WORKER_TIMEOUT_MS,
  type WorkerInput,
  type WorkerJob,
  type WorkerOutput,
  type WorkerReply,
  type WorkerRequest
} from '@shared/worker';
import { logError } from '../errorLog';

/** ما يحتاجه المضيف من عملية العامل. */
export interface WorkerProcess {
  on(event: 'message', listener: (message: unknown) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: WorkerRequest): void;
  kill(): boolean;
}

type Pending = { job: WorkerJob; timer: ReturnType<typeof setTimeout>; resolve: (output: unknown) => void; reject: (error: Error) => void };

/** خروج العامل والطلب معلّق — وحده يُعدّ سقوطًا يُرجِع إلى القديم؛ وما رماه العمل نفسه يُرفض كما هو. */
export class WorkerStoppedError extends Error {
  constructor() {
    super(WORKER_STOPPED);
  }
}

/** عملٌ تجاوز مهلته — ليس سقوطًا: ما يطول في العامل يطول في الرئيسة أيضًا. */
export class WorkerTimeoutError extends Error {
  constructor() {
    super(WORKER_TIMED_OUT);
  }
}

/** عملٌ أوقفه المكتب. */
export class WorkerCancelledError extends Error {
  constructor() {
    super(WORKER_CANCELLED);
  }
}

/**
 * مدّة الخمول قبل أن يُغلق العامل (D54): النموذج بعدها يُحمَّل ثانيةً (نحو ٢٫٥ ث لـBiRefNet على الجهاز المرجعي) مقابل ذاكرةٍ
 * يحجزها خاملًا (نحو ٦٤٠ م.ب) — والقياس في الدفتر.
 */
export const IDLE_MS = 60_000;

type Options = { idleMs?: number; timeoutMs?: (job: WorkerJob) => number; onStart?: (host: WorkerHost) => void };

export class WorkerHost {
  readonly #spawn: () => WorkerProcess;
  #proc: WorkerProcess | null = null;
  #nextId = 1;
  /** الطلبات المعلّقة على العملية الحاضرة وحدها — وما كان لعمليةٍ ماتت رُفض معها. */
  readonly #pending = new Map<number, Pending>();
  /** السقوط المتتالي لكلّ عمل — ونجاحه في العامل يصفّره. */
  readonly #falls = new Map<WorkerJob, number>();
  readonly #idleMs: number;
  readonly #timeoutMs: (job: WorkerJob) => number;
  readonly #onStart?: (host: WorkerHost) => void;
  #idle: ReturnType<typeof setTimeout> | null = null;

  constructor(spawn: () => WorkerProcess, { idleMs = IDLE_MS, timeoutMs = (job) => WORKER_TIMEOUT_MS[job], onStart }: Options = {}) {
    this.#spawn = spawn;
    this.#idleMs = idleMs;
    this.#timeoutMs = timeoutMs;
    this.#onStart = onStart;
  }

  /** يجري العمل في العامل — ويُقلعه إن لم يكن قائمًا. */
  run<J extends WorkerJob>(job: J, input: WorkerInput<J>): Promise<WorkerOutput<J>> {
    this.#stopIdle();
    const id = this.#nextId++;
    // وإقلاعٌ تعذّر يرفض الوعد لا يرمي.
    return new Promise<WorkerOutput<J>>((resolve, reject) => {
      const proc = this.#proc ?? this.#start();
      const timer = setTimeout(() => this.#expire(id), this.#timeoutMs(job));
      timer.unref?.();
      this.#pending.set(id, { job, timer, resolve: resolve as (output: unknown) => void, reject });
      proc.postMessage({ id, job, input });
    });
  }

  /**
   * يجري العمل في العامل، والطريق القديم في الرئيسة بديلٌ (ر141): بعد سقوطين متتاليين لهذا العمل يجري `old()` ويُقيَّد،
   * ونجاحٌ في العامل يصفّر العدّ. والسقوط الأوّل يُرفض برسالته («جرّب ثانيةً»)، وما رماه العمل نفسه يُرفض كما هو.
   */
  async runOr<J extends WorkerJob>(job: J, input: WorkerInput<J>, old: () => Promise<WorkerOutput<J>>): Promise<WorkerOutput<J>> {
    try {
      const output = await this.run(job, input);
      this.#falls.delete(job);
      return output;
    } catch (e) {
      if (!(e instanceof WorkerStoppedError)) throw e;
      const falls = (this.#falls.get(job) ?? 0) + 1;
      this.#falls.set(job, falls);
      if (falls < 2) throw e;
      logError('worker-fallback', new Error(`«${job}» في العملية الرئيسة بعد ${falls} سقوطٍ متتالٍ في العامل`));
      return old();
    }
  }

  /** «ألغِ» (D55): إن كان لهذا العمل طلبٌ معلّق قُتل العامل ورُفض بـ«أُلغي» — وإلا لا شيء. */
  cancel(job: WorkerJob): boolean {
    if (![...this.#pending.values()].some((p) => p.job === job)) return false;
    this.#abort((p) => (p.job === job ? new WorkerCancelledError() : null));
    return true;
  }

  /** يقتل العامل (عند إغلاق البرنامج) — وما بقي معلّقًا يُرفض، ولا يُقلع شيء. */
  close(): void {
    this.#abort(() => null);
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
      this.#stopIdle();
      logError('worker', new Error(`خرج المعالج (${code}) وفي انتظاره ${this.#pending.size} طلب`));
      this.#rejectAll(() => null);
    });
    this.#onStart?.(this);
    return proc;
  }

  /** انقضت مهلة الطلب: يُقتل العامل ويُقيَّد، ويُرفض هذا بـ«أُوقف» وغيره بـ«توقّف المعالج». */
  #expire(id: number): void {
    const entry = this.#pending.get(id);
    if (!entry) return;
    logError('worker-timeout', new Error(`«${entry.job}» تجاوز مهلته (${this.#timeoutMs(entry.job)} م.ث) فأُوقف المعالج`));
    this.#abort((p) => (p === entry ? new WorkerTimeoutError() : null));
  }

  /** يقتل العملية الحاضرة بلا قيد سقوط، ويرفض كلّ معلّق: بما يقوله `why` له، وإلا بـ«توقّف المعالج». */
  #abort(why: (entry: Pending) => Error | null): void {
    this.#stopIdle();
    const proc = this.#proc;
    this.#proc = null;
    proc?.kill();
    this.#rejectAll(why);
  }

  /** لا طلب معلّق: يُغلق العامل بعد الخمول فتعود ذاكرته — بلا قيد، فليس سقوطًا. */
  #startIdle(): void {
    this.#stopIdle();
    this.#idle = setTimeout(() => {
      this.#idle = null;
      if (this.#pending.size) return;
      const proc = this.#proc;
      this.#proc = null;
      proc?.kill();
    }, this.#idleMs);
    this.#idle.unref?.();
  }

  #stopIdle(): void {
    if (this.#idle) clearTimeout(this.#idle);
    this.#idle = null;
  }

  #settle(reply: WorkerReply): void {
    const entry = this.#pending.get(reply.id);
    if (!entry) return;
    this.#pending.delete(reply.id);
    clearTimeout(entry.timer);
    if (reply.type === 'result') entry.resolve(reply.output);
    else entry.reject(new Error(reply.message));
    if (!this.#pending.size) this.#startIdle();
  }

  #rejectAll(why: (entry: Pending) => Error | null): void {
    const all = [...this.#pending.values()];
    this.#pending.clear();
    for (const entry of all) {
      clearTimeout(entry.timer);
      entry.reject(why(entry) ?? new WorkerStoppedError());
    }
  }
}

let host: WorkerHost | null = null;

/** باب اختبار (D55): مهلةٌ واحدة تغلب كلّ مهلة — فتُرى المهلة في سيناريو بلا انتظار دقيقة. */
const TEST_TIMEOUT_MS = __DIWAN_TEST_DOORS__ ? Number(process.env['DIWAN_TEST_WORKER_TIMEOUT'] ?? 0) || 0 : 0;

/** المضيف الواحد للبرنامج — والعامل `out/main/worker.js` بجانب `index.js` (مدخلٌ ثانٍ في `electron.vite.config.ts`). */
export function workerHost(): WorkerHost {
  // والعامل يرث بيئة الرئيسة (الافتراضي في `fork`)، ومنها باب التأخير `DIWAN_TEST_SLOW_WORKER`.
  host ??= new WorkerHost(
    () => utilityProcess.fork(join(__dirname, 'worker.js'), [], { serviceName: 'Diwan worker' }),
    {
      timeoutMs: (job) => TEST_TIMEOUT_MS || WORKER_TIMEOUT_MS[job],
      onStart: (h) => {
        void h.run('ping', null).then((res) => {
          if (!res.psd) {
            logError('native', new Error(res.psdError || 'تعذّر تحميل إضافة Rust (diwan-psd)'));
          }
        }).catch(() => {});
      }
    }
  );
  return host;
}

/** عند إغلاق البرنامج (`before-quit`): يُقتل العامل إن كان قائمًا. */
export function closeWorker(): void {
  host?.close();
}
