/**
 * سيناريو: دفعةٌ انقطعت طباعتها تُعرض في الإقلاع ليُستأنف منها.
 *
 * تُرسل دفعةٌ إلى طابعةٍ لا وجود لها — فترفض الورقة الأولى كما ترفض طابعةٌ
 * انطفأت — فيبقى السجلّ على القرص. ثم تُعاد الواجهة كأنها أُقلعت من جديد:
 * أتسأل «توقّفت عند ٠ من ٢»؟ وتجاهلُها يمحو السجلّ.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const out = await page.eval(`
    return await window.diwan.output.printJob({
      label: 'هويات الخامس',
      pages: ['<p>١</p>', '<p>٢</p>'],
      printer: 'طابعة غير موجودة',
      page: { w: 210, h: 297 },
      duplex: false
    });
  `);
  ok('الطابعة رفضت الورقة الأولى فتوقّفت الدفعة', out && out.ok === false && out.sent === 0 && out.total === 2);
  const dir = join(profile, 'print-jobs');
  ok('وبقي سجلّها على القرص', existsSync(dir) && readdirSync(dir).some((f) => f.endsWith('.pages.json')));

  await page.eval(`location.reload(); return true;`);
  await wait(2000);
  const dialog = await page.eval(`return document.querySelector('[data-resume-print]')?.innerText ?? '';`);
  ok('وفي الإقلاع التالي يُسأل: «هويات الخامس» توقّفت عند ٠ من ٢', dialog.includes('هويات الخامس') && dialog.includes('٢'));

  await page.eval(`document.querySelector('[data-resume-print] [data-act="discard-job"]').click(); return true;`);
  await wait(800);
  ok('وتجاهلُها يغلق السؤال ويمحو السجلّ', !(await page.eval(`return Boolean(document.querySelector('[data-resume-print]'));`)) && (await page.eval(`return (await window.diwan.output.pendingJobs()).length;`)) === 0);

  return steps.join('\n');
}
