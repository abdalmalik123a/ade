import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { JOB_ID, isJobId, printJournal, runJob } from '../src/main/services/printJobs';

const dirs: string[] = [];
const fresh = () => {
  const dir = mkdtempSync(join(tmpdir(), 'diwan-jobs-'));
  dirs.push(dir);
  return dir;
};
afterEach(() => dirs.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true })));

const pages = (n: number) => Array.from({ length: n }, (_, i) => `<p>${i + 1}</p>`);

describe('سجلّ الطباعة الكبيرة', () => {
  it('ورقةً ورقة، ويُمحى السجلّ حين تكتمل', async () => {
    const journal = printJournal(fresh());
    const job = journal.create({ label: 'هويات الخامس', printer: 'P', page: { w: 210, h: 297 }, duplex: false, pages: pages(3) });
    const printed: string[] = [];
    const out = await runJob(journal, job.id, 0, async (p) => (printed.push(...p), { ok: true }));
    expect(out).toEqual({ ok: true, sent: 3, total: 3 });
    expect(printed).toEqual(pages(3));
    expect(journal.pending()).toEqual([]);
  });

  /**
   * انقطاع الكهرباء: تُقتل العملية في الورقة الثالثة — والسجلّ على القرص يقول
   * «أُرسلت ٢ من ٥». وفي الإقلاع التالي يُقرأ من سجلٍّ جديد على المجلّد نفسه.
   */
  it('ينقطع في الثالثة فيبقى «٢ من ٥»، ويُستأنف من الورقة التي يختارها المكتب', async () => {
    const dir = fresh();
    const journal = printJournal(dir);
    const job = journal.create({ label: 'x', printer: 'P', page: { w: 210, h: 297 }, duplex: false, pages: pages(5) });
    let n = 0;
    await expect(
      runJob(journal, job.id, 0, async () => {
        if (++n === 3) throw new Error('انقطعت الكهرباء');
        return { ok: true };
      })
    ).rejects.toThrow();

    const after = printJournal(dir).pending();
    expect(after.map((j) => [j.sent, j.total])).toEqual([[2, 5]]);

    // خرجت ورقةٌ واحدة فعلًا (الثانية ضاعت في ذاكرة الطابعة): يُستأنف من الثانية.
    const printed: string[] = [];
    const out = await runJob(printJournal(dir), job.id, 1, async (p) => (printed.push(...p), { ok: true }));
    expect(out.ok).toBe(true);
    expect(printed).toEqual(['<p>2</p>', '<p>3</p>', '<p>4</p>', '<p>5</p>']);
    expect(printJournal(dir).pending()).toEqual([]);
  });

  it('وكلّ ورقةٍ تُرسل برقمها — فتُقيَّد طبعة كتابها حين تُرسل، ولو بعد استئناف', async () => {
    const journal = printJournal(fresh());
    const job = journal.create({ label: 'x', printer: 'P', page: { w: 210, h: 297 }, duplex: false, pages: pages(3), docIds: [11, 12, 13] });
    const seen: number[] = [];
    await runJob(journal, job.id, 1, async (_p, j, sheet) => (seen.push(j.docIds![sheet]!), { ok: true }));
    expect(seen).toEqual([12, 13]);
  });

  it('على الوجهين: الورقة وجهٌ وظهر معًا، لا يُفصلان', async () => {
    const journal = printJournal(fresh());
    const job = journal.create({ label: 'x', printer: 'P', page: { w: 210, h: 297 }, duplex: true, pages: pages(4) });
    expect(job.total).toBe(2);
    expect(journal.sheetPages(job.id, 1)).toEqual(['<p>3</p>', '<p>4</p>']);
  });

  it('وورقةٌ ترفضها الطابعة توقف الدفعة ويبقى السجلّ', async () => {
    const journal = printJournal(fresh());
    const job = journal.create({ label: 'x', printer: 'P', page: { w: 210, h: 297 }, duplex: false, pages: pages(3) });
    const out = await runJob(journal, job.id, 0, async (p) => (p[0] === '<p>2</p>' ? { ok: false, reason: 'نفد الورق' } : { ok: true }));
    expect(out).toMatchObject({ ok: false, sent: 1, reason: 'نفد الورق' });
    expect(journal.pending()[0]?.sent).toBe(1);
  });
});

describe('معرّف الدفعة وموضع الاستئناف (و٤)', () => {
  it('المعرّف كما يصنعه السجلّ وحده', () => {
    const journal = printJournal(fresh());
    const job = journal.create({ label: 'x', printer: 'P', page: { w: 210, h: 297 }, duplex: false, pages: pages(1) });
    expect(job.id).toMatch(JOB_ID);
    for (const bad of ['../license', '..\license', 'job-1-ab/../../x', 'job-1-AB', 'job--x', '', 7, null, undefined]) expect(isJobId(bad)).toBe(false);
  });

  it('«تجاهل الدفعة» بمعرّفٍ خارج النمط يُرفض ولا يلمس ملفًّا خارج السجلّ', () => {
    const root = fresh();
    const dir = join(root, 'jobs');
    mkdirSync(dir);
    // ملفّ الترخيص بجانب مجلّد السجلّ — كما في مجلّد البيانات.
    writeFileSync(join(root, 'license.json'), '{}');
    const journal = printJournal(dir);
    expect(() => journal.finish('../license')).toThrow('رقم الدفعة غير صالح');
    expect(() => journal.finish('../x')).toThrow('رقم الدفعة غير صالح');
    expect(existsSync(join(root, 'license.json'))).toBe(true);
    expect(journal.get('../license')).toBeNull();
    expect(journal.sheetPages('../license', 0)).toEqual([]);
  });

  it('والاستئناف من موضعٍ ليس عددًا صحيحًا في الدفعة يُرفض — والسجلّ كما هو', async () => {
    const journal = printJournal(fresh());
    const job = journal.create({ label: 'x', printer: 'P', page: { w: 210, h: 297 }, duplex: false, pages: pages(3) });
    journal.markSent(job.id, 2);
    let printed = 0;
    for (const from of [NaN, -1, 1.5, 4]) {
      const out = await runJob(journal, job.id, from, async () => (printed++, { ok: true }));
      expect(out).toMatchObject({ ok: false, reason: 'موضع الاستئناف غير صالح' });
    }
    expect(printed).toBe(0);
    expect(journal.get(job.id)?.sent).toBe(2);
    expect(() => journal.markSent(job.id, NaN)).toThrow('عدد الأوراق المرسلة غير صالح');
    // وموضعٌ صحيح يُستأنف منه كما كان.
    expect(await runJob(journal, job.id, 2, async () => ({ ok: true }))).toEqual({ ok: true, sent: 3, total: 3 });
  });
});
