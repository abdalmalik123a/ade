/**
 * سيناريو: العمل اليومي في المرحلة الثالثة.
 *
 * التذكير والتأنيث (ج٤): دفعةٌ فيها «غسق» — لا يُعرف جنسها من اسمها — تُسأل قبل أن
 * تصدر، ويُحفظ الجواب فلا تُسأل ثانيةً؛ وكتابٌ واحد لاسمٍ مجهول لا يصدر حتى يُحسم.
 * و«ما ينتظرك اليوم» (د٧) عند الإقلاع — مرّةً في اليوم — ومعها «طلبكم جاهز» (د٨).
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = () => new Database(join(profile, 'data', 'diwan.db'), { readonly: true });

  const fill = async (label, value) => {
    await page.eval(`
      const l = [...document.querySelectorAll('[data-screen="service"] label')].find((x) => x.textContent.trim().startsWith(${JSON.stringify(label)}));
      const input = l?.querySelector('input');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(250);
  };

  // حقل الاسم بدوره «اسم»: عليه يدور الدمج (قائمة أسماء — ورقةٌ لكل اسم).
  await page.eval(`
    const run = (text) => ({ kind: 'run', text });
    const ref = (key) => ({ kind: 'field', id: key, ref: key });
    const doc = {
      id: 'daily-doc', schemaVersion: 1, kind: 'flow', issuing: 'registered',
      blocks: [{ id: 'b1', kind: 'paragraph', align: 'right',
        inlines: [run('تؤيد إدارة المدرسة أن '), ref('الطالب|الطالبة'), run(' '), ref('الاسم'), run(' مستمر بالدوام.')] }],
      fields: [{ id: 'f-name', key: 'الاسم', label: 'الاسم', type: 'text', required: true, width: 14, fillMode: 'printed', role: 'name', source: 'fullName' }],
      meta: {}
    };
    await window.diwan.templates.save({
      id: null, code: null, title: 'تأييد دوام طالب', subtitle: null, category: 'تربية', subjectLine: 'م/ تأييد',
      letterheadId: null, bodyHtml: 'تؤيد إدارة المدرسة أن الطالب {الاسم} مستمر بالدوام.',
      variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }], doc
    });
    return true;
  `);
  const open = async () => {
    await page.goto('templates-library-drafts');
    await wait(400);
    await page.goto('service-counter');
    await wait(900);
    await page.clickText('تأييد دوام طالب', 'button');
    await wait(300);
    await page.clickText('املأ (1)');
    await wait(1200);
  };

  // ── الدفعة: المجهول يُسأل قبل أن تصدر ─────────────────────────────────
  await open();
  await page.eval(`
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('قائمة أسماء'));
    label?.querySelector('input[type="checkbox"]')?.click();
    return true;`);
  await wait(400);
  await page.eval(`
    const el = document.querySelector('[data-screen="service"] textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(['زينب علي حسن', 'أحمد كريم جاسم', 'غسق حسن علي'].join('\n'))});
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  await wait(400);
  await page.clickText('راجع الأوراق');
  await wait(1000);
  await page.clickText('أصدر بلا طباعة');
  await wait(900);
  const asked = await page.eval(`return [...document.querySelectorAll('[data-gender-review] [data-gender-name]')].map((e) => e.getAttribute('data-gender-name'));`);
  ok(`قبل أن تصدر: سُئل عن المجهول وحده (${JSON.stringify(asked)})`, JSON.stringify(asked) === JSON.stringify(['غسق حسن علي']));
  ok('ولم يصدر شيءٌ قبل الجواب', (() => {
    const d = db();
    const n = d.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
    d.close();
    return n === 0;
  })());
  ok('و«اعتمد» لا يعمل قبل أن يُحسم كلّه', await page.eval(`return document.querySelector('[data-act="gender-review-done"]').disabled;`));
  await page.eval(`document.querySelector('[data-gender-name="غسق حسن علي"] [data-gender-pick="أنثى"]').click(); return true;`);
  await wait(200);
  await page.eval(`document.querySelector('[data-act="gender-review-done"]').click(); return true;`);
  await wait(2500);
  ok('ثم صدرت الدفعة', (await page.text()).includes('صدرت 3 ورقة لـ3 اسمًا'));
  let d = db();
  const bodies = Object.fromEntries(d.prepare('SELECT citizen_name AS n, body_html AS b FROM documents').all().map((r) => [r.n, r.b]));
  const memory = d.prepare('SELECT name, gender FROM name_genders').all();
  d.close();
  ok('«غسق» طالبةٌ بجواب الموظف، و«أحمد» طالبٌ و«زينب» طالبةٌ بلا سؤال',
    (bodies['غسق حسن علي'] ?? '').includes('الطالبة') && (bodies['أحمد كريم جاسم'] ?? '').includes('الطالب ') && (bodies['زينب علي حسن'] ?? '').includes('الطالبة'));
  ok('وحُفظ الجواب باسمها الأوّل', JSON.stringify(memory) === JSON.stringify([{ name: 'غسق', gender: 'أنثى' }]));

  // ── كتابٌ واحد: «غسق» صارت معروفة، و«نمير» يُسأل عنه ──────────────────
  await open();
  await fill('الاسم', 'غسق كاظم');
  await page.clickText('راجع الأوراق');
  await wait(900);
  ok('«غسق» لا تُسأل ثانيةً — عرفها المكتب', !(await page.eval(`return Boolean(document.querySelector('[data-gender-unsure]'));`)));
  ok('وتُطبع طالبةً', await page.eval(`return document.querySelector('[data-screen="service"] .a4-sheet')?.innerText.includes('الطالبة') ?? false;`));
  await page.eval(`document.querySelector('[data-act="discard"]')?.click(); return true;`);
  await wait(600);

  await open();
  await fill('الاسم', 'نمير علي حسن');
  await page.clickText('راجع الأوراق');
  await wait(900);
  ok('اسمٌ مجهول: يُسأل عنه في الشبّاك', await page.eval(`return Boolean(document.querySelector('[data-gender-unsure]'));`));
  const issueButtons = () => page.eval(`return [...document.querySelectorAll('[data-screen="service"] button')].filter((b) => /أصدر بلا طباعة|اطبع \\d/.test(b.textContent)).map((b) => b.disabled);`);
  ok('ولا يصدر حتى يُحسم', (await issueButtons()).every(Boolean));
  await page.eval(`document.querySelector('[data-gender-unsure] [data-gender-choose="ذكر"]').click(); return true;`);
  await wait(400);
  ok('وضغطةٌ تحسمه', (await issueButtons()).every((x) => !x));
  await page.clickText('أصدر بلا طباعة');
  await wait(2000);
  d = db();
  const learned = d.prepare("SELECT gender FROM name_genders WHERE name = 'نمير'").get();
  d.close();
  ok('وحُفظ جوابه كذلك', learned?.gender === 'ذكر');

  // ── «ما ينتظرك اليوم» عند الإقلاع ───────────────────────────────────
  const today = new Date().toLocaleDateString('en-CA');
  await page.eval(`
    const s = window.diwan.orders.save;
    await s({ id: null, clientId: null, customer: 'مدرسة النور', title: 'هويّات الطلبة', dueDate: ${JSON.stringify(today)} });
    const r = await s({ id: null, clientId: null, customer: 'أبو حسن', title: 'ملصق المحل', phone: '07701234567' });
    await window.diwan.orders.setStatus(r.id, 'ready');
    try { localStorage.removeItem('diwan.todaySeen'); } catch {}
    location.reload();
    return true;`).catch(() => undefined);
  await wait(3000);
  ok('عند الإقلاع: «ما ينتظرك اليوم»', await page.eval(`return Boolean(document.querySelector('[data-today]'));`));
  const panel = await page.eval(`return document.querySelector('[data-today]')?.innerText ?? '';`);
  ok('فيه ما موعده اليوم', panel.includes('1 موعدها اليوم') && panel.includes('هويّات الطلبة'));
  ok('وما جهز ينتظر صاحبه — ومعه رسالته', panel.includes('1 جاهزة تنتظر أصحابها') && panel.includes('انسخ رسالة: طلبكم جاهز'));
  ok('والنسخة الاحتياطية وفي الأرشيف كتب لم تُنسخ', panel.includes('آخر نسخة احتياطية: لم يحدث بعد'));
  await page.eval(`document.querySelector('[data-today] [data-act="copy-ready"]').click(); return true;`);
  await wait(300);
  ok('«انسخ رسالة» تُنسخ', (await page.eval(`return document.querySelector('[data-today] [data-act="copy-ready"]').innerText;`)) === 'نُسخت');
  await page.eval(`document.querySelector('[data-act="today-close"]').click(); return true;`);
  await wait(300);
  ok('و«ابدأ العمل» يغلقها', !(await page.eval(`return Boolean(document.querySelector('[data-today]'));`)));
  await page.eval(`location.reload(); return true;`).catch(() => undefined);
  await wait(3000);
  ok('ولا تعود في اليوم نفسه', !(await page.eval(`return Boolean(document.querySelector('[data-today]'));`)));

  // ── وفي الطلبات نفسها ───────────────────────────────────────────────
  await page.goto('orders-board');
  await wait(900);
  ok('الطلب الجاهز في لوحته: «انسخ رسالة: طلبكم جاهز»', await page.eval(`return Boolean(document.querySelector('[data-order] [data-act="copy-ready"]'));`));

  return steps.join('\n');
}
