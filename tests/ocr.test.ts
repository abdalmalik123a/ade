/**
 * اختبارات وحدة لخدمة التعرّف الضوئي ocr.ts (D108، E03):
 * حراسة تهيئة العامل ومنع سباق إنشاء عمال متعدّدين عند استدعاءات متزامنة.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockWorker = {
  terminate: vi.fn(async () => {}),
  recognize: vi.fn(async () => ({ data: { text: 'test', confidence: 95 } })),
  setParameters: vi.fn(async () => {})
};

let createWorkerCalls = 0;
let createWorkerDelay = 30;
let shouldFailOnce = false;

vi.mock('tesseract.js', () => ({
  createWorker: vi.fn(async () => {
    createWorkerCalls++;
    if (createWorkerDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, createWorkerDelay));
    }
    if (shouldFailOnce) {
      shouldFailOnce = false;
      throw new Error('فشل تجريبي في تهيئة العامل');
    }
    return { ...mockWorker };
  }),
  PSM: { SINGLE_BLOCK: 6 }
}));

vi.mock('electron', () => ({
  app: {
    getAppPath: () => '/mock/app'
  }
}));

const { getWorker, getPageWorker, shutdownOcr } = await import('../src/main/services/ocr');

describe('حراسة عمال التعرّف الضوئي (E03)', () => {
  beforeEach(async () => {
    await shutdownOcr();
    createWorkerCalls = 0;
    createWorkerDelay = 30;
    shouldFailOnce = false;
  });

  it('الاستدعاءات المتزامنة لـ getWorker تنشئ عاملاً واحدًا فقط ولا يتكرّر createWorker', async () => {
    const [w1, w2, w3] = await Promise.all([getWorker(), getWorker(), getWorker()]);

    expect(createWorkerCalls).toBe(1);
    expect(w1).toBeDefined();
    expect(w2).toBe(w1);
    expect(w3).toBe(w1);

    // استدعاء لاحق بعد اكتمال التهيئة يعيد العامل نفسه بلا استدعاء جديد
    const w4 = await getWorker();
    expect(createWorkerCalls).toBe(1);
    expect(w4).toBe(w1);
  });

  it('فشل تهيئة العامل يصفّر الوعد ليسمح بالمحاولة التالية', async () => {
    shouldFailOnce = true;
    await expect(getWorker()).rejects.toThrow('فشل تجريبي في تهيئة العامل');
    expect(createWorkerCalls).toBe(1);

    // الاستدعاء التالي ينجح بعد تصفير الوعد
    const w = await getWorker();
    expect(createWorkerCalls).toBe(2);
    expect(w).toBeDefined();
  });

  it('الاستدعاءات المتزامنة لـ getPageWorker تنشئ عاملاً واحدًا فقط', async () => {
    const [pw1, pw2] = await Promise.all([getPageWorker(), getPageWorker()]);

    expect(createWorkerCalls).toBe(1);
    expect(pw1).toBeDefined();
    expect(pw2).toBe(pw1);
  });

  it('shutdownOcr ينهي العمال ويسمح بتهيئة جديدة لاحقًا', async () => {
    const w1 = await getWorker();
    expect(createWorkerCalls).toBe(1);

    await shutdownOcr();
    expect(w1.terminate).toHaveBeenCalled();

    const w2 = await getWorker();
    expect(createWorkerCalls).toBe(2);
    expect(w2).toBeDefined();
  });
});
