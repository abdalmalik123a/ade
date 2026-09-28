/**
 * سجلُّ الطباعة الكبيرة — لتُستأنف بعد انقطاع الكهرباء.
 *
 * البرنامج لا يعرف ما أخرجته الطابعة فعلًا، لكنّه يعرف ما أرسله إليها: فالدفعة
 * الكبيرة تُرسَل **ورقةً ورقة** (الورقة بوجهيها في الطباعة على الوجهين)، ويُكتب
 * بعد كلّ ورقةٍ في ملفٍّ على القرص كم أُرسل. فإن انقطعت الكهرباء بقي الملفّ، وفي
 * الإقلاع التالي يُسأل المكتب: «توقفت عند ٢٤ من ٤٥» — ويصحّح هو إن خرج أقلّ
 * (ما في ذاكرة الطابعة ضاع) ويستأنف من التي تليها.
 *
 * والأوراق نفسها تُحفظ معه — فالاستئناف يطبع ما رآه المكتب في المراجعة حرفًا
 * بحرف، لا ما يُعاد بناؤه من تصميمٍ ربما تغيّر.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type PrintJob = {
  id: string;
  label: string;
  printer: string;
  page: { w: number; h: number };
  duplex: boolean;
  /** صفحاتٌ في الورقة: ٢ في الطباعة على الوجهين. */
  perSheet: number;
  /** عدد الأوراق. */
  total: number;
  /** ما أُرسل إلى الطابعة من الأوراق. */
  sent: number;
  createdAt: string;
};

export type PrintJournal = {
  create(input: Omit<PrintJob, 'id' | 'sent' | 'createdAt' | 'total' | 'perSheet'> & { pages: string[] }): PrintJob;
  /** صفحات الورقة `sheet` (من ٠). */
  sheetPages(id: string, sheet: number): string[];
  markSent(id: string, sent: number): void;
  finish(id: string): void;
  pending(): PrintJob[];
  get(id: string): PrintJob | null;
};

/** السجلّ في مجلّدٍ واحد: لكلّ دفعةٍ ملفُّ حالٍ صغير يُعاد كتابته، وملفُّ أوراقٍ لا يتغيّر. */
export function printJournal(dir: string): PrintJournal {
  const state = (id: string) => join(dir, `${id}.json`);
  const pagesFile = (id: string) => join(dir, `${id}.pages.json`);
  const read = (id: string): PrintJob | null => {
    try {
      return JSON.parse(readFileSync(state(id), 'utf8')) as PrintJob;
    } catch {
      return null;
    }
  };
  const write = (job: PrintJob) => writeFileSync(state(job.id), JSON.stringify(job));
  // ملفّ الأوراق لا يتغيّر بعد إنشائه: يُقرأ مرّةً للدفعة لا مرّةً لكلّ ورقة — كان يُقرأ
  // ويُفكّ كاملًا مع كلّ ورقةٍ تُطبع (التدقيق المستقل). والقرص يبقى مرجع الاستئناف.
  const pagesCache = new Map<string, string[]>();
  const pagesOf = (id: string): string[] => {
    let pages = pagesCache.get(id);
    if (!pages) {
      pages = JSON.parse(readFileSync(pagesFile(id), 'utf8')) as string[];
      pagesCache.set(id, pages);
    }
    return pages;
  };

  return {
    create({ pages, ...input }) {
      mkdirSync(dir, { recursive: true });
      const perSheet = input.duplex ? 2 : 1;
      const job: PrintJob = {
        ...input,
        id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        perSheet,
        total: Math.ceil(pages.length / perSheet),
        sent: 0,
        createdAt: new Date().toISOString()
      };
      writeFileSync(pagesFile(job.id), JSON.stringify(pages));
      write(job);
      return job;
    },
    sheetPages(id, sheet) {
      const job = read(id);
      if (!job) return [];
      return pagesOf(id).slice(sheet * job.perSheet, (sheet + 1) * job.perSheet);
    },
    markSent(id, sent) {
      const job = read(id);
      if (job) write({ ...job, sent });
    },
    finish(id) {
      pagesCache.delete(id);
      rmSync(state(id), { force: true });
      rmSync(pagesFile(id), { force: true });
    },
    pending() {
      if (!existsSync(dir)) return [];
      return readdirSync(dir)
        .filter((f) => /^job-.*\.json$/.test(f) && !f.endsWith('.pages.json'))
        .map((f) => read(f.replace(/\.json$/, '')))
        .filter((j): j is PrintJob => j !== null && j.sent < j.total)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    get: read
  };
}

/**
 * يرسل الأوراق من `from` (من ٠) ورقةً ورقة، ويقيّد بعد كلٍّ منها. ويقف عند أوّل
 * ورقةٍ رفضتها الطابعة — فيبقى السجلّ ليُستأنف منها.
 */
export async function runJob(
  journal: PrintJournal,
  id: string,
  from: number,
  printOne: (pages: string[], job: PrintJob) => Promise<{ ok: boolean; reason?: string }>,
  onProgress?: (sent: number, total: number) => void
): Promise<{ ok: boolean; sent: number; total: number; reason?: string }> {
  const job = journal.get(id);
  if (!job) return { ok: false, sent: 0, total: 0, reason: 'لا دفعة بهذا الرقم' };
  journal.markSent(id, from);
  for (let sheet = from; sheet < job.total; sheet++) {
    const out = await printOne(journal.sheetPages(id, sheet), job);
    if (!out.ok) return { ok: false, sent: sheet, total: job.total, reason: out.reason };
    journal.markSent(id, sheet + 1);
    onProgress?.(sheet + 1, job.total);
  }
  journal.finish(id);
  return { ok: true, sent: job.total, total: job.total };
}
