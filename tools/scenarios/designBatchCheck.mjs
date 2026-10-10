/**
 * سيناريو: فحص الدفعة قبل الطباعة (DESIGNS.md ٣٫٢) — هويّة طالبٍ بقائمةٍ ملصوقة، أحد أسمائها طويلٌ جدًّا: مراجعة الأوراق تقول
 * إنّ «{الاسم}» يصغر دون ٦٠٪ في بطاقةٍ واحدة **وتسمّيها**، والأسماء القصيرة لا تُذكر — قبل أن تخرج الدفعة كلّها.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const LONG = 'عبد الرحمن محمد عبد الكريم عبد الأمير جاسم الموسوي';

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);

  await page.goto('designed-documents');
  await wait(1200);
  await click('button[data-kind="student-id"]');
  await wait(900);
  const list = ['الاسم\tالرقم', 'زينب علي\t101', `${LONG}\t102`, 'سالم حسن\t103'].join('\n');
  await page.type('textarea[data-batch-text]', list);
  await wait(800);
  await click('button[data-act="sheets"]');
  let issues = [];
  for (let i = 0; i < 30 && !issues.length; i++) {
    await wait(400);
    issues = await page.eval(`return [...document.querySelectorAll('[data-sheets] [data-issue]')].map((n) => n.innerText);`);
  }
  const shrunk = issues.find((t) => t.includes('يصغر دون'));
  ok(`مراجعة الأوراق تقول الاسم الذي يصغر كثيرًا (${shrunk ?? issues.length + ' ملاحظة'})`, Boolean(shrunk));
  ok('وتسمّي صاحبه وحده — بطاقةٌ واحدة، والقصيرة لا', Boolean(shrunk?.includes(LONG) && shrunk.includes('١ بطاقة') && !shrunk.includes('زينب علي')));
  ok('ومعه ما كان: بطاقاتٌ بلا صورة', issues.some((t) => t.includes('بلا صورة')));
  return steps.join('\n');
}
