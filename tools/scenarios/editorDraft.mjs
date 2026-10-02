/**
 * سيناريو: ما يُكتب في المحرّر لا يضيع بالانتقال ولا بالإغلاق (خطة Production، ١٫٥).
 *
 * مؤقّت الحفظ (أربع ثوانٍ) يُعاد مع كلّ حرف ويُلغى مع الشاشة، فكانت كتابةٌ يتبعها نقرٌ على الشريط
 * فورًا لا تُحفظ (أُعيد إنتاجه ثلاث مرّات). فيُكتب ثم يُنتقل فورًا، ثم يُكتب ويُغلق البرنامج من
 * نافذته — كما يُغلقه الموظف — ويُفتح ثانيةً على الملفّ نفسه.
 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const titles = (page) => page.eval(`return (await window.diwan.drafts.list()).map((d) => d.title);`);

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  await page.goto('smart-editor-a4-preview');
  await page.type('[data-editor-owner]', 'زبون الانتقال الفوري');
  await page.goto('transactions-archive-ledger');
  await sleep(1000);
  ok('كتابةٌ ثم انتقالٌ فوري: حُفظت مسودةً', (await titles(page)).includes('زبون الانتقال الفوري'));

  await page.goto('smart-editor-a4-preview');
  await page.type('[data-editor-owner]', 'زبون الإغلاق الفوري');
  // يُغلق من نافذته كما يُغلقه الموظف — فيمرّ بالإغلاق على مرحلتيه.
  await page.send('Runtime.evaluate', { expression: 'setTimeout(() => window.close(), 50); 1' });
  await sleep(4000);
  return steps.join('\n');
}

export async function afterRestart(page) {
  const list = await titles(page);
  return [
    `${list.includes('زبون الإغلاق الفوري') ? '✓' : '✗'} كتابةٌ ثم إغلاقٌ فوري: حُفظت مسودةً قبل أن يُغلق`,
    `${list.includes('زبون الانتقال الفوري') ? '✓' : '✗'} والمسودة الأولى باقية بعد إعادة الفتح`
  ].join('\n');
}
