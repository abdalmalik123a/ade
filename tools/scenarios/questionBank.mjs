/**
 * سيناريو: بنك الأسئلة — يُحفظ سؤالٌ من ورقةٍ ويُدرج في أخرى.
 *
 * سؤالٌ بفرعٍ ودرجة في ورقة الفيزياء يُحفظ في البنك، ثم تُفتح ورقةٌ جديدة
 * فيظهر في بنك مادّتها ويُدرج بفرعه ودرجته — ويُعدَّل في الورقة الجديدة فلا
 * يتغيّر ما في البنك، ويُحسب استعماله.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const setText = async (n, text) => {
    await page.eval(`
      const el = [...document.querySelectorAll('textarea[data-question-text]')][${n}];
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
  };
  const texts = () => page.eval(`return [...document.querySelectorAll('textarea[data-question-text]')].map((t) => t.value);`);
  const bankRows = () => page.eval(`return [...document.querySelectorAll('[data-bank-item]')].map((li) => li.innerText);`);

  await page.goto('exam-papers');
  await wait(700);
  await page.type('input[data-head="المادة"]', 'الفيزياء');
  await page.type('input[data-head="الصف"]', 'الثالث المتوسط');

  await setText(0, 'عرّف ما يأتي:');
  await page.eval(`document.querySelector('button[title="أضف فرعًا"]').click(); return true;`);
  await wait(300);
  await setText(1, 'الضغط الجوي');
  await page.eval(`
    const el = document.querySelector('input[title="درجة السؤال"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, '15');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(200);

  await page.eval(`document.querySelector('[data-act="bank-save"]').click(); return true;`);
  await wait(600);
  ok('يُحفظ السؤال في البنك باسم مادّته', (await page.text()).includes('حُفظ في بنك الأسئلة — الفيزياء'));

  // ── ورقةٌ جديدة: البنك يعرض مادّتها ─────────────────────────────
  await page.clickText('ورقة جديدة');
  await wait(400);
  await page.type('input[data-head="المادة"]', 'الفيزياء');
  await page.eval(`document.querySelector('[data-act="bank-open"]').click(); return true;`);
  await wait(600);
  let rows = await bankRows();
  ok('وفي الورقة الجديدة يظهر في بنك الفيزياء', rows.length === 1 && rows[0].includes('عرّف ما يأتي') && rows[0].includes('الضغط الجوي'));

  await page.type('input[data-head="المادة"]', 'الكيمياء');
  await wait(600);
  rows = await bankRows();
  ok('ولا يظهر في بنك الكيمياء', rows.length === 0);
  await page.type('input[data-head="المادة"]', 'الفيزياء');
  await wait(600);

  await page.eval(`document.querySelector('[data-act="bank-insert"]').click(); return true;`);
  await wait(500);
  let list = await texts();
  ok('ويُدرج محلّ السؤال الفارغ بفرعه', list.length === 2 && list[0] === 'عرّف ما يأتي:' && list[1] === 'الضغط الجوي');

  // تعديلُه في الورقة لا يمسّ البنك.
  await setText(0, 'عرّف المصطلحات الآتية:');
  await wait(600);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const bank = db.prepare('SELECT text, score, use_count AS used FROM question_bank').all();
  db.close();
  ok('والبنك بقي كما حُفظ، بدرجته ١٥', bank.length === 1 && bank[0].text.startsWith('عرّف ما يأتي:') && bank[0].score === 15);
  ok('وحُسب استعماله مرّة', bank[0]?.used === 1);

  return steps.join('\n');
}
