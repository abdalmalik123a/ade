/**
 * مضيف العامل المستقلّ (A03، D53) بعمليةٍ مزيّفة: الجواب يصل طلبه بمعرّفه ولو تبدّل الترتيب · السقوط والطلبات معلّقة ← كلٌّ يُرفض
 * بـ«توقّف المعالج — جرّب ثانيةً» ويُقيَّد · الطلب التالي يُقلع عمليةً جديدة · `close()` يقتل ولا يُقلع شيئًا · ولا طلب يبقى معلّقًا.
 */
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import { WORKER_STOPPED, type WorkerReply, type WorkerRequest } from '../src/shared/worker';

const logError = vi.fn();
vi.mock('electron', () => ({ utilityProcess: { fork: () => null } }));
vi.mock('../src/main/errorLog', () => ({ logError }));
const { WorkerHost } = await import('../src/main/services/workerHost');

/** عمليةٌ مزيّفة: تحفظ ما يُرسل إليها، وتردّ بما يُطلب منها، وتخرج حين يُقال لها. */
class FakeProcess extends EventEmitter {
  sent: WorkerRequest[] = [];
  killed = false;
  postMessage(message: WorkerRequest): void {
    this.sent.push(message);
  }
  kill(): boolean {
    this.killed = true;
    queueMicrotask(() => this.emit('exit', 0));
    return true;
  }
  reply(reply: WorkerReply): void {
    this.emit('message', reply);
  }
  crash(): void {
    this.emit('exit', 1);
  }
}

function harness() {
  const spawned: FakeProcess[] = [];
  const host = new WorkerHost(() => {
    const p = new FakeProcess();
    spawned.push(p);
    return p;
  });
  return { host, spawned };
}

/** حال الوعد الآن: «معلّق» إن لم يُحسم بعد تفريغ الطابور. */
async function state(p: Promise<unknown>): Promise<'pending' | 'resolved' | 'rejected'> {
  const pending = Symbol('pending');
  const v = await Promise.race([p.then(() => 'resolved' as const, () => 'rejected' as const), new Promise((r) => setTimeout(() => r(pending), 0))]);
  return v === pending ? 'pending' : (v as 'resolved' | 'rejected');
}

describe('مضيف العامل المستقلّ', () => {
  it('لا يُقلع العامل قبل أوّل طلب، ويُقلعه مرّةً لطلبين', () => {
    const { host, spawned } = harness();
    expect(spawned).toHaveLength(0);
    void host.run('ping', null);
    void host.run('ping', null);
    expect(spawned).toHaveLength(1);
    expect(spawned[0]!.sent.map((r) => [r.id, r.job])).toEqual([
      [1, 'ping'],
      [2, 'ping']
    ]);
  });

  it('الجواب يصل طلبه بمعرّفه ولو تبدّل ترتيب الأجوبة', async () => {
    const { host, spawned } = harness();
    const first = host.run('ping', null);
    const second = host.run('ping', null);
    const [a, b] = spawned[0]!.sent;
    spawned[0]!.reply({ type: 'result', id: b!.id, output: { pid: 22, at: 2 } });
    spawned[0]!.reply({ type: 'result', id: a!.id, output: { pid: 11, at: 1 } });
    await expect(first).resolves.toEqual({ pid: 11, at: 1 });
    await expect(second).resolves.toEqual({ pid: 22, at: 2 });
  });

  it('الإخفاق يُرفض برسالة العمل كما هي', async () => {
    const { host, spawned } = harness();
    const run = host.run('ping', null);
    spawned[0]!.reply({ type: 'failure', id: spawned[0]!.sent[0]!.id, message: 'ملفّ Photoshop أكبر من حدّه' });
    await expect(run).rejects.toThrow('ملفّ Photoshop أكبر من حدّه');
  });

  it('السقوط والطلبان معلّقان ← كلاهما يُرفض بالرسالة ويُقيَّد، ولا يبقى طلبٌ معلّق', async () => {
    logError.mockClear();
    const { host, spawned } = harness();
    const one = host.run('ping', null);
    const two = host.run('crash', null);
    spawned[0]!.crash();
    await expect(one).rejects.toThrow(WORKER_STOPPED);
    await expect(two).rejects.toThrow(WORKER_STOPPED);
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError.mock.calls[0]![0]).toBe('worker');
    // وجوابٌ يصل بعدها من العملية الميتة لا يحلّ شيئًا ولا يرمي.
    spawned[0]!.reply({ type: 'result', id: 1, output: { pid: 1, at: 1 } });
  });

  it('الطلب التالي بعد السقوط يُقلع عمليةً جديدة ويُجاب منها', async () => {
    const { host, spawned } = harness();
    const lost = host.run('ping', null);
    spawned[0]!.crash();
    await expect(lost).rejects.toThrow(WORKER_STOPPED);
    const again = host.run('ping', null);
    expect(spawned).toHaveLength(2);
    expect(spawned[0]!.sent).toHaveLength(1);
    spawned[1]!.reply({ type: 'result', id: spawned[1]!.sent[0]!.id, output: { pid: 99, at: 3 } });
    await expect(again).resolves.toEqual({ pid: 99, at: 3 });
  });

  it('جوابٌ من عمليةٍ ماتت لا يحلّ طلبًا على الجديدة ولو وافق معرّفه', async () => {
    const { host, spawned } = harness();
    void host.run('ping', null).catch(() => undefined);
    spawned[0]!.crash();
    const fresh = host.run('ping', null);
    const id = spawned[1]!.sent[0]!.id;
    spawned[0]!.reply({ type: 'result', id, output: { pid: 1, at: 1 } });
    expect(await state(fresh)).toBe('pending');
    spawned[1]!.reply({ type: 'result', id, output: { pid: 2, at: 2 } });
    await expect(fresh).resolves.toEqual({ pid: 2, at: 2 });
  });

  it('close() يقتل العامل ويرفض المعلّق، ولا يُقلع شيئًا ولا يُقيَّد سقوطًا', async () => {
    logError.mockClear();
    const { host, spawned } = harness();
    host.close();
    expect(spawned).toHaveLength(0);
    const run = host.run('ping', null);
    host.close();
    expect(spawned[0]!.killed).toBe(true);
    await expect(run).rejects.toThrow(WORKER_STOPPED);
    await new Promise((r) => setTimeout(r, 0));
    expect(spawned).toHaveLength(1);
    expect(logError).not.toHaveBeenCalled();
  });

  it('runOr: سقوطان متتاليان ← القديم مرّةً وقيدٌ؛ والأوّل يُرفض برسالته', async () => {
    logError.mockClear();
    const { host, spawned } = harness();
    let oldCalls = 0;
    const old = async () => {
      oldCalls++;
      return { pid: 0, at: 0 };
    };
    const first = host.runOr('ping', null, old);
    spawned[0]!.crash();
    await expect(first).rejects.toThrow(WORKER_STOPPED);
    const second = host.runOr('ping', null, old);
    spawned[1]!.crash();
    await expect(second).resolves.toEqual({ pid: 0, at: 0 });
    expect(oldCalls).toBe(1);
    expect(logError.mock.calls.map((c) => c[0])).toEqual(['worker', 'worker', 'worker-fallback']);
  });

  it('runOr: نجاحٌ في العامل يصفّر العدّ، وإخفاق العمل نفسه لا يُعدّ سقوطًا', async () => {
    const { host, spawned } = harness();
    let oldCalls = 0;
    const old = async () => {
      oldCalls++;
      return { pid: 0, at: 0 };
    };
    const reply = (n: number, r: (id: number) => WorkerReply) => spawned[n]!.reply(r(spawned[n]!.sent.at(-1)!.id));
    // سقوطٌ ثم نجاحٌ ثم سقوط: العدّ صُفّر بينهما فلا رجوع.
    const a = host.runOr('ping', null, old);
    spawned[0]!.crash();
    await expect(a).rejects.toThrow(WORKER_STOPPED);
    const b = host.runOr('ping', null, old);
    reply(1, (id) => ({ type: 'result', id, output: { pid: 5, at: 5 } }));
    await expect(b).resolves.toEqual({ pid: 5, at: 5 });
    const c = host.runOr('ping', null, old);
    spawned[1]!.crash();
    await expect(c).rejects.toThrow(WORKER_STOPPED);
    // وإخفاق العمل يُرفض برسالته ولا يُرجِع إلى القديم.
    const d = host.runOr('ping', null, old);
    reply(2, (id) => ({ type: 'failure', id, message: 'نموذج إزالة الخلفية تالف' }));
    await expect(d).rejects.toThrow('نموذج إزالة الخلفية تالف');
    expect(oldCalls).toBe(0);
  });

  it('بعد الخمول يُغلق العامل بلا قيد، والطلب التالي يُقلع عمليةً جديدة', async () => {
    vi.useFakeTimers();
    try {
      logError.mockClear();
      const spawned: FakeProcess[] = [];
      const host = new WorkerHost(
        () => {
          const p = new FakeProcess();
          spawned.push(p);
          return p;
        },
        { idleMs: 1000 }
      );
      const run = host.run('ping', null);
      spawned[0]!.reply({ type: 'result', id: spawned[0]!.sent[0]!.id, output: { pid: 1, at: 1 } });
      await run;
      vi.advanceTimersByTime(999);
      expect(spawned[0]!.killed).toBe(false);
      // طلبٌ قبل انقضاء المدّة يُبقيه ويعيد العدّ.
      const again = host.run('ping', null);
      vi.advanceTimersByTime(5000);
      expect(spawned[0]!.killed).toBe(false);
      spawned[0]!.reply({ type: 'result', id: spawned[0]!.sent[1]!.id, output: { pid: 1, at: 2 } });
      await again;
      vi.advanceTimersByTime(1000);
      expect(spawned[0]!.killed).toBe(true);
      await Promise.resolve();
      expect(logError).not.toHaveBeenCalled();
      void host.run('ping', null);
      expect(spawned).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('إقلاعٌ تعذّر يرفض الطلب ولا يرمي', async () => {
    const host = new WorkerHost(() => {
      throw new Error('تعذّر الإقلاع');
    });
    await expect(host.run('ping', null)).rejects.toThrow('تعذّر الإقلاع');
  });
});
