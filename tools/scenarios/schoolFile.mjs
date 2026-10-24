/**
 * سيناريو: «ملفّ المدارس» (الموجة ٢، بقرار المالك: خيارٌ يُفعَّل من الإعدادات لا للجميع).
 *
 * مكتبٌ يخدم مدارس: يُفعّل الخيار، ويكتب لمدرسةٍ ملفّها في «الجهات» (جنسها ومحافظتها ومديرها) مرّة، ثم في الشبّاك
 * «هات المدرسة» يملأ كتابها من حزمة «مخاطبات المدارس الرسمية» — والعام الدراسي يُكتب وحده من التاريخ، وتبديل المدرسة
 * يبدّل قيمها، وكتابة اسمها تقترحها فتملأ ملفّها. وبالخيار مطفأً لا زرّ ولا ملفّ.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };
  /** قيمة خانةٍ في ورقة التعبئة بعنوانها. */
  const field = (label) =>
    page.eval(`
      const l = [...document.querySelectorAll('label')].find((x) => x.querySelector('span')?.textContent.trim() === ${JSON.stringify(label)});
      return l?.querySelector('input[type="text"]')?.value ?? null;
    `);
  const type = (label, value) =>
    page.eval(`
      const l = [...document.querySelectorAll('label')].find((x) => x.querySelector('span')?.textContent.trim() === ${JSON.stringify(label)});
      const input = l?.querySelector('input[type="text"]');
      if (!input) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
  const now = new Date();
  const from = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  // ── الحزمة: كتب المدارس بخاناتها ───────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(800);
  await click('[data-act="content-import"]');
  await wait(600);
  await click('[data-act="import-bundled-school-letters"]');
  await wait(2500);
  await page.key('Escape');
  await wait(400);

  // ── الخيار مطفأٌ في الأصل: لا زرّ في الشبّاك ───────────────────────
  const openLetter = async (title) => {
    await page.goto('service-counter');
    await wait(900);
    // البطاقة تُختار مرّة: ضغطةٌ ثانية على مختارةٍ تُلغيها.
    const found = await page.eval(`
      const card = [...document.querySelectorAll('[data-template-card]')].find((c) => c.querySelector('.font-headline-sm')?.textContent?.trim() === ${JSON.stringify(title)});
      if (!card) return false;
      if (!card.className.includes('border-cyan')) card.click();
      return true;
    `);
    await wait(400);
    await page.clickText('املأ');
    await wait(1200);
    return found;
  };
  ok('«صرف مكافأة لجنة الحانوت» في الشبّاك', await openLetter('صرف مكافأة لجنة الحانوت'));
  ok('والخيار مطفأٌ في الأصل: لا «هات المدرسة» ولا عامٌ يُكتب وحده', !(await page.eval(`return Boolean(document.querySelector('[data-act="pick-school"]'));`)) && !(await field('العام الدراسي')));
  await page.clickText('رجوع');
  await wait(400);

  // ── الإعدادات: يُفعَّل ─────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(900);
  ok('في الإعدادات «ملفّ المدارس»', await page.eval(`return Boolean(document.querySelector('[data-school-files-setting] [data-setting="schoolFiles"]'));`));
  await click('[data-setting="schoolFiles"]');
  await wait(600);
  ok('ويُحفظ لحظة يُعلَّم', (await page.eval(`return (await window.diwan.settings.get()).schoolFiles;`)) === true);

  // ── «الجهات»: ملفّ المدرسة ─────────────────────────────────────────
  await page.goto('clients-directory');
  await wait(800);
  await click('[data-act="new-client"]');
  await wait(300);
  await page.type('input[data-client-name]', 'مدرسة النور الابتدائية');
  ok('ملفّ المدرسة لا يظهر لجهةٍ بلا نوع', !(await page.eval(`return Boolean(document.querySelector('[data-school-file]'));`)));
  // شريحة النوع في ملفّ الجهة نفسه — وفي الشبّاك المخفيّ أزرارٌ فيها «المدرسة» من الحزمة.
  await page.eval(`[...document.querySelectorAll('[data-client-file] button')].find((b) => b.textContent.trim() === 'مدرسة')?.click(); return true;`);
  await wait(300);
  ok('ويظهر للمدرسة', await page.eval(`return Boolean(document.querySelector('[data-school-file]'));`));
  await click('[data-school-gender-chip="المختلطة"]');
  await page.type('input[data-school-governorate]', 'بغداد الكرخ الأولى');
  await page.type('input[data-school-principal]', 'سالم حسن');
  await click('[data-act="save-client"]');
  await wait(800);
  const saved = db((d) => d.prepare('SELECT name, kind, school_gender AS g, governorate AS gov, principal AS p FROM authorities').get());
  ok('ويُحفظ ملفّها: جنسها ومحافظتها ومديرها', saved?.kind === 'مدرسة' && saved?.g === 'المختلطة' && saved?.gov === 'بغداد الكرخ الأولى' && saved?.p === 'سالم حسن');
  if (shotsDir) await page.shot(join(shotsDir, 'school-file.png'));
  await page.eval(`await window.diwan.clients.save({ id: null, name: 'مدرسة الأمل', kind: 'مدرسة', governorate: 'بابل' }); return true;`);

  // ── الشبّاك: العام من التاريخ، و«هات المدرسة» ──────────────────────
  await openLetter('صرف مكافأة لجنة الحانوت');
  ok(`والعام الدراسي كُتب وحده من التاريخ (${from} / ${from + 1})`, (await field('العام الدراسي')) === `${from} /` && (await field('العام الدراسي 2')) === String(from + 1));
  ok('و«هات المدرسة» بجانب «هات الزبون»', await page.eval(`return Boolean(document.querySelector('[data-act="pick-school"]'));`));
  await click('[data-act="pick-school"]');
  await wait(400);
  ok('وفيه مدارس «الجهات» بملفّاتها', (await page.eval(`return document.querySelector('[data-school-picker]')?.innerText ?? '';`)).includes('المختلطة · بغداد الكرخ الأولى · سالم حسن'));
  await page.eval(`[...document.querySelectorAll('[data-school-pick]')].find((b) => b.innerText.includes('مدرسة النور'))?.click(); return true;`);
  await wait(400);
  ok('فيملأ اسم المدرسة وجنسها ومحافظتها ومديرها', (await field('اسم المدرسة')) === 'مدرسة النور الابتدائية' && (await field('جنس المدرسة')) === 'المختلطة' && (await field('المحافظة')) === 'بغداد الكرخ الأولى' && (await field('اسم مدير المدرسة')) === 'سالم حسن');

  // تبديل المدرسة يبدّل قيمها — ومديرٌ لا تعرفه الثانية يُمحى.
  await click('[data-act="pick-school"]');
  await wait(400);
  await page.eval(`[...document.querySelectorAll('[data-school-pick]')].find((b) => b.innerText.includes('مدرسة الأمل'))?.click(); return true;`);
  await wait(400);
  ok('وتبديل المدرسة يبدّل قيمها ولا يُبقي مدير الأولى', (await field('اسم المدرسة')) === 'مدرسة الأمل' && (await field('المحافظة')) === 'بابل' && (await field('اسم مدير المدرسة')) === '');

  // وكتابة اسمها كما في «الجهات» تملأ ملفّها.
  await type('اسم المدرسة', 'مدرسة النور الابتدائية');
  await wait(400);
  ok('واسمها مكتوبًا كما في «الجهات» يملأ ملفّها', (await field('اسم مدير المدرسة')) === 'سالم حسن' && (await field('المحافظة')) === 'بغداد الكرخ الأولى');

  await page.clickText('راجع الأوراق');
  await wait(1200);
  const sheet = await page.eval(`return document.querySelector('.a4-sheet')?.innerText ?? '';`);
  ok('والورقة بالمدرسة وجنسها ومحافظتها ومديرها وعامها', ['مدرسة النور الابتدائية', 'المختلطة', 'لتربية بغداد الكرخ الأولى', 'سالم حسن', String(from + 1)].every((s) => sheet.includes(s)));
  if (shotsDir) await page.shot(join(shotsDir, 'school-counter.png'));

  return steps.join('\n');
}
