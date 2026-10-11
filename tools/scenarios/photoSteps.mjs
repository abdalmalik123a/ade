/**
 * سيناريو: ترقيم أداة الصور (محادثة «الأدوات»، البند ١٨ من IMPROVEMENTS.md).
 *
 * كانت الخطوات قبل فتح الصورة «١ الصورة» ثم «٥ المقاس» ثم «٦ الإخراج» — والثانية إلى الرابعة تظهر بعد الفتح، فيبدو خللًا. فالآن
 * تُرى ١ إلى ٦ من البداية، والثلاث التي تحتاج الصورة (الخلفية والإضاءة والقاط) باهتةٌ بعناوينها وسطرٌ يقول متى تظهر؛ وبعد الفتح
 * الأرقام نفسها، والثلاث بأدواتها.
 */
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-photo-steps-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'customer.jpg');
  copyFileSync(resolve('tests/fixtures/tiny.jpg'), file);
  return { DIWAN_TEST_OPEN_FILE: file };
}

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const read = () =>
    page.eval(`return [...document.querySelectorAll('[data-step]')].filter((s) => s.checkVisibility()).map((s) => ({
      n: Number(s.dataset.step), later: s.hasAttribute('data-step-later'), text: s.innerText.replace(/\\s+/g, ' ').trim() }));`);

  await page.goto('passport-photos');
  await wait(800);
  let list = await read();
  ok(`قبل فتح الصورة: الخطوات ١ إلى ٦ بترتيبها (${list.map((s) => s.n).join('، ')})`, list.map((s) => s.n).join() === '1,2,3,4,5,6');
  ok(
    'والثلاث التي تحتاج الصورة باهتةٌ بعناوينها: الخلفية والإضاءة والقاط',
    list.filter((s) => s.later).map((s) => s.n).join() === '2,3,4' && list[1].text.includes('الخلفية') && list[3].text.includes('القاط')
  );
  ok('وسطرٌ يقول متى تظهر أدواتها', (await page.eval(`return document.querySelector('[data-steps-later]')?.innerText ?? '';`)).includes('بعد فتح الصورة'));
  if (shotsDir) await page.shot(join(shotsDir, 'photo-steps-before.png'));

  await page.eval(`document.querySelector('[data-act="open-photo"]').click(); return true;`);
  await wait(1500);
  list = await read();
  ok(`وبعد فتحها الأرقام نفسها (${list.map((s) => s.n).join('، ')})، ولا باهتٌ ولا سطر انتظار`, list.map((s) => s.n).join() === '1,2,3,4,5,6' && !list.some((s) => s.later) && !(await page.eval(`return Boolean(document.querySelector('[data-steps-later]'));`)));
  // والخلفية تُزال وحدها عند الفتح (MODNet) — فالفحص على الصورة في إطارها لا على زرّها.
  ok('والصورة في إطارها تُعمل عليها الخطوات', await page.eval(`return Boolean(document.querySelector('[data-photo-frame] canvas'));`));
  return steps;
}
