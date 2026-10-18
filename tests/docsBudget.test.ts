import { readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ميزانية ما تقرؤه كلّ جلسة (D58): PLAN لوحة حالٍ قصيرة، والدفتر قيود الأوامر الجارية وحدها — وما يُقرأ يُعاد إرساله مع كلّ خطوةٍ بعده.
// والرسالة تقول ما يُفعل؛ فالقديم يُنقل بنصّه ولا يُحذف (CLAUDE.md «لا حذف لأيّ ملف»).
const ROOT = resolve(__dirname, '..');
const PLAN = join(ROOT, 'docs', 'PLAN.md');
const LOG = join(ROOT, 'docs', 'LOG.md');
const KB = 1024;
const PLAN_MAX = 25 * KB;
const LOG_MAX = 100 * KB;
const ENTRY_MAX = 10;

describe('ميزانية الوثائق التي تقرؤها كلّ جلسة', () => {
  it('PLAN لوحة حالٍ قصيرة', () => {
    const size = statSync(PLAN).size;
    expect(size, `docs/PLAN.md ${size} بايت فوق ${PLAN_MAX}: انقل جدول الموجة المكتملة بنصّه إلى docs/legacy/PLAN-<الموجة>.md (وأسطر ✅ المراجَعة كذلك، ر162)، وتفاصيل البنود إلى docs/BACKLOG.md`).toBeLessThanOrEqual(PLAN_MAX);
  });

  it('الدفتر قيود الأوامر الجارية وحدها', () => {
    const size = statSync(LOG).size;
    expect(size, `docs/LOG.md ${size} بايت فوق ${LOG_MAX}: انقل أقدم قيوده بنصّها — إلا قيود ما لم يُراجَع — إلى docs/legacy/LOG-<التالي>.md`).toBeLessThanOrEqual(LOG_MAX);
  });

  it('أحدث قيدٍ عنوانه وعشرة أسطرٍ على الأكثر (قاعدة رأس الدفتر)', () => {
    const lines = readFileSync(LOG, 'utf8').split(/\r?\n/);
    const start = lines.findIndex((l) => l.startsWith('## '));
    expect(start, 'لا قيد في الدفتر: كلّ قيدٍ يبدأ بـ«## »').toBeGreaterThan(-1);
    const next = lines.findIndex((l, i) => i > start && l.startsWith('## '));
    const body = lines.slice(start + 1, next === -1 ? undefined : next).filter((l) => l.trim() !== '');
    expect(body.length, `أحدث قيد («${lines[start].slice(3, 80)}») ${body.length} سطرًا: اختصره إلى ${ENTRY_MAX} — والتفصيل في الأمر أو رسالة الإيداع`).toBeLessThanOrEqual(ENTRY_MAX);
  });
});
