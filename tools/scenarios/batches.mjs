/**
 * سيناريو: التطوير الخامس — الدفعات والشبّاك والأسئلة.
 *
 * - ربط أعمدة الدفعة بيد المكتب (هـ٥): عنوانٌ لا يُعرف يُربط مرّة فيتذكّره التصميم،
 *   وقائمة ٥٠٠ اسم تُقرأ وتُصفّ.
 * - هويّات الموظفين من السجل (د١٥): يُختار الصنف كلّه فتصير قائمة الدفعة من ملفّاتهم.
 * - الشبّاك بلوحة المفاتيح (د١١): رقم البطاقة يختارها، وEnter تملأ، وEsc تمحو البحث.
 * - الدمج من السجل (د١٢) بلا تكرار، والفقرة المكرّرة في ثلاثة كتب تُقترح عبارةً.
 * - ورقة الدور الثاني من البنك (د٩): الدرجة نفسها، ولا سؤال من الدور الأول.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

const REPEATED = 'نرجو التفضّل بالاطلاع واتخاذ ما يلزم بشأنه مع وافر الشكر والتقدير.';
const STAFF = [
  { fullName: 'زينب علي حسن', nationalId: '199011112222', jobTitle: 'محاسبة' },
  { fullName: 'أحمد كريم جاسم', nationalId: '198822223333', jobTitle: 'مهندس' },
  { fullName: 'سالم محمود جاسم', nationalId: '198533334444', jobTitle: 'سائق' }
];

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const db = () => new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const until = async (fn, tries = 30) => {
    for (let i = 0; i < tries; i++) {
      const v = await fn();
      if (v) return v;
      await wait(300);
    }
    return null;
  };

  // ── البذور: موظفو دائرةٍ في السجل، ونموذجا شبّاك، وبنك فيزياء ───────
  await page.eval(`
    for (const c of ${JSON.stringify(STAFF)}) {
      await window.diwan.citizens.save({ id: null, verified: false, category: 'موظفو الدائرة', ...c });
    }
    await window.diwan.citizens.save({ id: null, verified: false, fullName: 'علي حسين عباس', category: 'زبائن' });

    const run = (text) => ({ kind: 'run', text });
    const ref = (key) => ({ kind: 'field', id: key, ref: key });
    const nameField = { id: 'f-name', key: 'الاسم', label: 'الاسم', type: 'text', required: true, width: 14, fillMode: 'printed', role: 'name', source: 'fullName' };
    const template = (title, lines) => window.diwan.templates.save({
      id: null, code: null, title, subtitle: null, category: 'دوائر', subjectLine: null, letterheadId: null,
      bodyHtml: lines.join(' '), variables: [{ token: 'الاسم', label: 'الاسم', source: 'citizen', required: true }],
      doc: {
        id: title, schemaVersion: 1, kind: 'flow', issuing: 'registered',
        blocks: lines.map((l, i) => ({ id: 'b' + i, kind: 'paragraph', align: 'right',
          inlines: l === '@' ? [run('نؤيد أن السيد/ة '), ref('الاسم'), run(' منتسبٌ إلى دائرتنا.')] : [run(l)] })),
        fields: [nameField], meta: {}
      }
    });
    await template('إفادة عمل', ['@', ${JSON.stringify(REPEATED)}]);
    await template('تأييد سكن', ['@']);

    const q = (text, score) => ({ id: text, inlines: [run(text)], score });
    const where = { subject: 'الفيزياء', grade: 'الثالث المتوسط' };
    await window.diwan.bank.save({ item: q('عرّف الكثافة', 10), ...where });
    const used = await window.diwan.bank.save({ item: q('عرّف الضغط', 10), ...where });
    await window.diwan.bank.used(used.id);
    await window.diwan.bank.save({ item: q('عرّف الضغط الجوي', 10), ...where });
    await window.diwan.bank.save({ item: q('علّل: تطفو السفن على الماء', 20), ...where });
    return true;
  `);

  // ── هـ٥: ربط الأعمدة بيد المكتب، ويتذكّره التصميم ───────────────────
  await page.goto('designed-documents');
  await wait(1500);
  await click('button[data-kind="staff-id"]');
  await wait(900);
  await page.type('input[data-title]', 'هوية موظفي الدائرة');
  await click('button[data-act="save"]');
  await wait(1500);
  const list = ['المنتسب\tالرقم', 'زينب علي حسن\t501', 'أحمد كريم جاسم\t502', 'سالم محمود جاسم\t503'].join('\n');
  await page.type('textarea[data-batch-text]', list);
  await wait(600);
  ok('عنوانٌ لا يُعرف يُقال إنه تُرك', (await page.text()).includes('فتُرك: المنتسب'));
  await click('button[data-act="batch-map"]');
  await wait(300);
  const mapped = await page.eval(`
    const s = document.querySelector('[data-batch-map] select[data-batch-column="المنتسب"]');
    if (!s) return false;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'الاسم');
    s.dispatchEvent(new Event('change', { bubbles: true }));
    return true;`);
  await wait(900);
  ok('ويُربط بيد المكتب بالحقل «الاسم»', mapped && !(await page.text()).includes('فتُرك: المنتسب'));
  ok(
    'فيُرسم أوّل اسمٍ على التصميم',
    (await page.eval(`return document.querySelector('[data-design]')?.innerText ?? '';`)).includes('زينب علي حسن')
  );
  const meta = (() => {
    const d = db();
    const row = d.prepare("SELECT doc_json AS j FROM templates WHERE title = 'هوية موظفي الدائرة'").get();
    d.close();
    return row ? JSON.parse(row.j).meta ?? {} : {};
  })();
  ok(`والربط محفوظٌ مع التصميم (${JSON.stringify(meta.batchMap)})`, Object.values(meta.batchMap ?? {}).includes('الاسم'));

  await page.goto('templates-library-drafts');
  await wait(600);
  await page.goto('designed-documents');
  await wait(900);
  await page.eval(`
    const el = [...document.querySelectorAll('button[data-saved]')].find((b) => b.parentElement?.textContent.includes('هوية موظفي الدائرة'));
    el?.click();
    return true;`);
  await wait(1200);
  await page.type('textarea[data-batch-text]', list);
  await wait(700);
  ok(
    'وقائمة السنة القادمة تُربط وحدها حين يُفتح التصميم',
    !(await page.text()).includes('فتُرك: المنتسب') &&
      (await page.eval(`return document.querySelector('[data-design]')?.innerText ?? '';`)).includes('زينب علي حسن')
  );

  // خمسمئة بطاقة: تُقرأ فورًا وتُصفّ في أوراقها.
  const big = ['المنتسب\tالرقم', ...Array.from({ length: 500 }, (_, i) => `موظف رقم ${i + 1}\t${9000 + i}`)].join('\n');
  let t0 = Date.now();
  await page.type('textarea[data-batch-text]', big);
  const bigSummary = await until(() =>
    page.eval(`const s = document.querySelector('[data-batch-summary]')?.innerText ?? ''; return s.includes('٥٠٠') ? s : null;`)
  );
  const parseMs = Date.now() - t0;
  ok(`وخمسمئة اسمٍ تُقرأ (${parseMs}ms): ${bigSummary?.replace(/\s+/g, ' ')}`, Boolean(bigSummary));
  t0 = Date.now();
  await click('button[data-act="sheets"]');
  const sheetsSummary = await until(
    () => page.eval(`return document.querySelector('[data-sheets] [data-sheets-summary]')?.innerText ?? null;`),
    100
  );
  const sheetsMs = Date.now() - t0;
  ok(`وتُراجع أوراقها قبل الطباعة (${sheetsMs}ms): ${sheetsSummary}`, Boolean(sheetsSummary?.includes('٥٠٠ بطاقة')));
  ok('في أقلّ من عشر ثوانٍ', sheetsMs < 10000);
  await page.eval(`document.querySelector('[data-sheets] button[title="رجوع (Esc)"]')?.click(); return true;`);
  await wait(500);

  // ── د١٥: هويّات الموظفين من السجل ─────────────────────────────────
  await click('button[data-act="batch-registry"]');
  await wait(800);
  ok('«من السجل» يفتح اختيار الموظفين', await page.eval(`return Boolean(document.querySelector('[data-citizen-picker]'));`));
  await page.clickText('موظفو الدائرة', '[data-citizen-picker] button');
  await wait(600);
  const shown = await page.eval(`return [...document.querySelectorAll('[data-picker-row]')].map((r) => r.dataset.pickerRow);`);
  ok(`والصنف يحصرهم (${shown.length})`, shown.length === 3 && !shown.includes('علي حسين عباس'));
  await click('[data-act="picker-all"]');
  await wait(200);
  await click('[data-act="picker-confirm"]');
  const batchText = await until(() =>
    page.eval(`const v = document.querySelector('textarea[data-batch-text]')?.value ?? ''; return v.includes('سالم محمود جاسم') ? v : null;`)
  );
  ok('فتصير قائمة الدفعة من ملفّاتهم', Boolean(batchText) && STAFF.every((s) => batchText.includes(s.fullName)));
  ok('بوظائفهم وأرقامهم لا بأسمائهم وحدها', Boolean(batchText?.includes('محاسبة') && batchText.includes('199011112222')));
  ok(
    'ثلاثة أسماء',
    (await page.eval(`return document.querySelector('[data-batch-summary]')?.innerText ?? '';`)).includes('٣')
  );
  if (shotsDir) await page.shot(join(shotsDir, 'batch-registry.png'));

  // ── د١١: الشبّاك بلوحة المفاتيح ────────────────────────────────────
  await page.goto('templates-library-drafts');
  await wait(600);
  await page.goto('service-counter');
  await wait(1000);
  const cards = await page.eval(`
    return [...document.querySelectorAll('[data-card-key]')].map((e) => ({ n: e.dataset.cardKey, title: e.closest('button')?.innerText ?? '' }));`);
  ok(`البطاقات بأرقامها (${cards.length})`, cards.length >= 2 && cards[0].n === '1');
  const target = cards.find((c) => c.title.includes('إفادة عمل'));
  await page.key(`Digit${target?.n ?? 1}`);
  await wait(300);
  ok('ورقمها يختارها', (await page.text()).includes('املأ (1)'));
  await page.key(`Digit${target?.n ?? 1}`);
  await wait(300);
  ok('ويُعيده فيُلغيها', !(await page.text()).includes('املأ (1)'));

  await page.type('input[data-counter-search]', 'تاييد');
  await wait(400);
  const filtered = await page.eval(`return [...document.querySelectorAll('[data-card-key]')].map((e) => e.closest('button')?.innerText ?? '');`);
  ok('والبحث متساهلٌ مع الهمزة: «تاييد» تجد «تأييد سكن»', filtered.length === 1 && filtered[0].includes('تأييد سكن'));
  await page.key('Escape');
  await wait(400);
  ok('وEsc تمحو البحث', (await page.eval(`return document.querySelectorAll('[data-card-key]').length;`)) === cards.length);

  const again = await page.eval(`
    return [...document.querySelectorAll('[data-card-key]')].find((e) => e.closest('button')?.innerText.includes('إفادة عمل'))?.dataset.cardKey ?? '1';`);
  await page.key(`Digit${again}`);
  await wait(300);
  await page.key('Enter');
  await wait(1200);
  ok('وEnter تملأ', (await page.text()).includes('قائمة أسماء'));

  // ── د١٢: الدمج من السجل، بلا تكرار ─────────────────────────────────
  await page.eval(`
    const label = [...document.querySelectorAll('label')].find((l) => l.textContent.includes('قائمة أسماء'));
    label?.querySelector('input[type="checkbox"]')?.click();
    return true;`);
  await wait(400);
  await page.eval(`
    const el = document.querySelector('[data-screen="service"] textarea');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'زينب علي حسن');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  await wait(300);
  await click('[data-act="merge-registry"]');
  await wait(800);
  await page.clickText('موظفو الدائرة', '[data-citizen-picker] button');
  await wait(600);
  await click('[data-act="picker-all"]');
  await wait(200);
  await click('[data-act="picker-confirm"]');
  const names = await until(() =>
    page.eval(`const v = document.querySelector('[data-screen="service"] textarea')?.value ?? ''; return v.includes('سالم') ? v.split('\\n') : null;`)
  );
  ok(`الدمج من السجل: الصنف كلّه، ومن كان في القائمة لا يُكرَّر (${JSON.stringify(names)})`, names?.length === 3 && new Set(names).size === 3);

  await page.clickText('راجع الأوراق');
  await wait(1200);
  await page.clickText('أصدر بلا طباعة');
  await wait(2500);
  const issued = (() => {
    const d = db();
    const n = d.prepare('SELECT COUNT(*) AS n FROM documents').get().n;
    d.close();
    return n;
  })();
  ok(`وصدرت ثلاثة كتب، لكلّ اسمٍ كتابه (${issued})`, issued === 3);

  // ── د١٢: الفقرة المكرّرة تُقترح عبارةً بعد صدور الكتاب ─────────────
  await page.goto('templates-library-drafts');
  await wait(1000);
  await page.eval(`
    const btn = [...document.querySelectorAll('button')].find((b) => {
      if (!b.textContent.includes('فتح في المحرر')) return false;
      let el = b;
      for (let i = 0; i < 8 && el; i++, el = el.parentElement) if (el.innerText?.includes('إفادة عمل')) return true;
      return false;
    });
    btn?.click();
    return true;`);
  await wait(1500);
  const filled = await page.eval(`
    const l = [...document.querySelectorAll('[data-screen="editor"] label')].find((x) => x.textContent.trim().startsWith('الاسم'));
    const box = l?.closest('div.flex-col') ?? l?.parentElement;
    const input = l?.querySelector('input, textarea') ?? box?.querySelector('input, textarea');
    if (!input) return false;
    const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, 'علي حسين عباس');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  await wait(400);
  await click('[data-act="issue"]');
  await wait(700);
  await page.clickText('إصدار وقيد بلا طباعة');
  const suggestion = await until(() => page.eval(`return document.querySelector('[data-repeated-clip]')?.innerText ?? null;`), 20);
  ok(`بعد الإصدار: الفقرة التي تكرّرت في الكتب تُقترح عبارةً (${filled ? 'مُلئ الاسم' : 'لم يُملأ الاسم'})`, Boolean(suggestion?.includes('نرجو التفضّل بالاطلاع')));
  if (shotsDir) await page.shot(join(shotsDir, 'repeated-clip.png'));
  await click('[data-act="repeated-save"]');
  await wait(800);
  const clip = (() => {
    const d = db();
    const rows = d.prepare('SELECT body FROM clips').all();
    d.close();
    return rows;
  })();
  ok('وتُحفظ بنقرة في العبارات', clip.some((c) => c.body.includes('نرجو التفضّل بالاطلاع')));
  ok('ولا تُقترح ثانيةً بعد حفظها', !(await page.eval(`return Boolean(document.querySelector('[data-repeated-clip]'));`)));
  await page.clickExact('تم');
  await wait(500);

  // ── د٩: ورقة الدور الثاني من البنك ─────────────────────────────────
  await page.goto('exam-papers');
  await wait(800);
  await page.type('input[data-head="المادة"]', 'الفيزياء');
  await page.type('input[data-head="الصف"]', 'الثالث المتوسط');
  await page.eval(`
    const el = document.querySelector('textarea[data-question-text]');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, 'عرّف الكثافة');
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const s = document.querySelector('input[title="درجة السؤال"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(s, '10');
    s.dispatchEvent(new Event('input', { bubbles: true }));
    return true;`);
  await wait(400);
  await click('[data-act="second-round"]');
  await wait(900);
  const round2 = await page.eval(`return [...document.querySelectorAll('textarea[data-question-text]')].map((t) => t.value);`);
  ok(
    `الدور الثاني: سؤالٌ بدرجته من البنك، لا من الدور الأول، والأقلّ استعمالًا (${JSON.stringify(round2)})`,
    JSON.stringify(round2) === JSON.stringify(['عرّف الضغط الجوي'])
  );
  ok('ورأسها «الدور الثاني»', (await page.eval(`return document.querySelector('input[data-head="الدور"]')?.value ?? '';`)) === 'الثاني');
  const bankUse = (() => {
    const d = db();
    const r = d.prepare("SELECT use_count AS n FROM question_bank WHERE text LIKE 'عرّف الضغط الجوي%'").get();
    d.close();
    return r?.n;
  })();
  ok('ويُحسب استعماله في البنك', bankUse === 1);

  return steps.join('\n');
}
