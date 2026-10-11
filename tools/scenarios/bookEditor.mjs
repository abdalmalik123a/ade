/**
 * سيناريو: محرّر الكتاب (محادثة «محرّر الكتاب» — البنود ٤ و٩ و٣ و١ من IMPROVEMENTS.md).
 *
 * ٤ — على شاشة ١٣٦٦×٧٦٨ (و١٢٨٠×٧٢٠) «اطبع» ظاهرٌ كلّه بلا تمرير وبعدد أوراقه، و«طباعة تجريبية» تحته أصغر ومكتوبٌ عليها أنّها
 *     لا تُحفظ في السجلّ — ولم تعد في أعلى الورقة. وحوار الطبع يقول «اطبع ورقتين» بعدد النسخ.
 * ٩ — اسم صاحب العلاقة المكتوب في المتن يُقترح بضغطة (بجانب خانته وفي «قبل الطبع»)، ويصدر به الكتاب.
 * ٣ — الشطب وأعلى السطر ولون النصّ تُرى في المحرّر وتصل الورقة التي تُطبع وتُحفظ؛ والقائمة بشكل «أ) ب)» تُرى في المحرّر
 *     كما تُطبع، لا «1. 2.»؛ وأرقام الورقة «١ ٢ ٣» من شريطها تقلب علامات الترقيم في المحرّر وفي المطبوعة.
 * ١ — حدّ العمود يُسحب بالفأرة كما في Word: سهما سحبٍ على الحدّ، والعرض يتغيّر ويُحفظ، خطوةً واحدة في التراجع.
 */
import { join } from 'node:path';
import Database from 'better-sqlite3';

const NAME = 'زينب علي حسن';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const size = (w, h) => page.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  const ed = '[data-screen="editor"]';
  const PM = `${ed} [data-page-editor]`;
  const click = (selector) => page.eval(`const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true;`);
  const db = (fn) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return fn(d);
    } finally {
      d.close();
    }
  };
  /** «اطبع» و«التجريبية»: أظاهران كاملين في النافذة بلا تمرير، وغير مغطّيين؟ */
  const printBar = () =>
    page.eval(`
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return { inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, top: hit === el || el.contains(hit), h: r.height,
          bg: getComputedStyle(el).backgroundColor,
          text: [...el.childNodes].filter((n) => !n.classList?.contains('material-symbols-outlined')).map((n) => n.textContent).join('').trim() };
      };
      return { issue: box(document.querySelector('${ed} [data-act="issue"]')), trial: box(document.querySelector('${ed} [data-act="print-trial"]')) };
    `);
  /** يظلّل كلمةً على الورقة كما تظلّلها الفأرة. */
  const selectWord = (word) =>
    page.eval(`
      const root = document.querySelector('${PM}');
      root.focus();
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(); n; n = walk.nextNode()) {
        const at = n.data.indexOf(${JSON.stringify(word)});
        if (at < 0) continue;
        const range = document.createRange();
        range.setStart(n, at);
        range.setEnd(n, at + ${word.length});
        const sel = getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
      return false;
    `);
  /** المؤشّر في آخر الورقة. */
  const caretEnd = () =>
    page.eval(`
      const root = document.querySelector('${PM}');
      root.focus();
      const range = document.createRange();
      range.selectNodeContents(root.lastElementChild);
      range.collapse(false);
      const sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    `);
  const choose = (selector, value) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
  const lastDraftDoc = () =>
    db((d) => {
      const row = d.prepare('SELECT values_json AS v FROM drafts ORDER BY id DESC LIMIT 1').get();
      return row ? JSON.parse(JSON.parse(row.v).__doc) : null;
    });

  // ── ٤: «اطبع» ظاهرٌ أبدًا على الشاشة الصغيرة ─────────────────────────────
  await size(1366, 768);
  await page.goto('smart-editor-a4-preview');
  await wait(1200);
  let bar = await printBar();
  ok(`١٣٦٦×٧٦٨: «اطبع» ظاهرٌ كلّه بلا تمرير («${bar.issue?.text}»)`, bar.issue?.inside && bar.issue.top);
  ok(`و«طباعة تجريبية» ظاهرةٌ تحته ومكتوبٌ عليها أنّها لا تُحفظ («${bar.trial?.text}»)`, bar.trial?.inside && bar.trial.top && bar.trial.text.includes('لا تُحفظ في السجلّ'));
  ok(
    'والتجريبية أقلّ بروزًا: أصغر وبلا لون الزرّ الأساسيّ',
    bar.trial.h < bar.issue.h && /rgba\(0, 0, 0, 0\)|transparent/.test(bar.trial.bg) && !/rgba\(0, 0, 0, 0\)|transparent/.test(bar.issue.bg)
  );
  ok(
    'ولا «طباعة تجريبية» في أعلى الورقة — زرٌّ واحدٌ في شريط «اطبع»',
    (await page.eval(`return [...document.querySelectorAll('${ed} button')].filter((b) => b.innerText.includes('طباعة تجريبية')).map((b) => Boolean(b.closest('[data-editor-print]')));`)).join() === 'true'
  );

  // ── ٩: الاسم مكتوبٌ في المتن فيُقترح ─────────────────────────────────────
  await page.eval(`document.querySelector('${PM}').focus(); return true;`);
  await page.send('Input.insertText', { text: `نؤيد لكم بأن السيدة ${NAME} موظفة في دائرتنا منذ عام 2015 ولا تزال مستمرة بالدوام.` });
  await wait(900);
  const hints = await page.eval(`return [...document.querySelectorAll('${ed} [data-owner-hint]')].map((b) => b.innerText.trim());`);
  ok(`اسم صاحب العلاقة يُقترح ممّا كُتب في الكتاب (${hints.join('، ') || 'لا شيء'})`, hints.length === 1 && hints[0] === NAME);
  const inCheck = await page.eval(`return document.querySelector('${ed} [data-checks] [data-act="owner-from-letter"]')?.innerText ?? '';`);
  ok('وفي «قبل الطبع» بجانب ما يمنع', inCheck.includes(NAME));
  bar = await printBar();
  ok(`و«اطبع» يقول إنّ شيئًا يمنع («${bar.issue.text}»)`, bar.issue.text.includes('بعد إكمال ما يمنع'));
  await click(`${ed} [data-owner-hint]`);
  await wait(500);
  ok('ضغطةٌ تكتبه في خانته — لا يُكتب مرّتين', (await page.eval(`return document.querySelector('${ed} [data-editor-owner]')?.value ?? '';`)) === NAME);
  ok('ويختفي الاقتراح وما كان يمنع', !(await page.eval(`return Boolean(document.querySelector('${ed} [data-owner-hint]')) || Boolean(document.querySelector('${ed} [data-checks] [data-check="block"]'));`)));
  bar = await printBar();
  ok(`و«اطبع» بعدد أوراقه كما في الشبّاك («${bar.issue.text}»)`, bar.issue.text === 'اطبع ورقة واحدة');

  await size(1280, 720);
  await wait(500);
  bar = await printBar();
  ok('وعلى ١٢٨٠×٧٢٠ «اطبع» والتجريبية ظاهران كاملين', bar.issue.inside && bar.issue.top && bar.trial.inside && bar.trial.top);
  await size(1366, 768);
  await wait(500);
  if (shotsDir) await page.shot(join(shotsDir, 'book-editor-1366.png'));

  // ── حوار الطبع بعدد الأوراق، ثم الكتاب يصدر بالاسم المقترح ────────────────
  await click(`${ed} [data-act="issue"]`);
  await wait(600);
  const dialogPrint = () => page.eval(`return [...document.querySelectorAll('button')].map((b) => b.innerText.trim()).find((t) => t.startsWith('اطبع ')) ?? '';`);
  ok(`الحوار: «${await dialogPrint()}»`, (await dialogPrint()) === 'اطبع ورقة واحدة');
  await page.eval(`
    const input = [...document.querySelectorAll('label')].find((l) => l.innerText.includes('عدد النسخ'))?.querySelector('input');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '2');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  `);
  await wait(300);
  ok(`وبنسختين: «${await dialogPrint()}»`, (await dialogPrint()) === 'اطبع ورقتين');
  await page.clickText('احفظ بلا طباعة');
  await wait(2500);
  ok('صدر الكتاب', (await page.text()).includes('صدر الكتاب'));
  ok('وقُيّد باسم صاحب العلاقة الذي اقتُرح من المتن', db((d) => d.prepare('SELECT citizen_name AS n FROM documents ORDER BY id DESC LIMIT 1').get()?.n) === NAME);
  await page.clickExact('تم');
  await wait(500);

  // ── ٣: الشطب وأعلى السطر واللون ──────────────────────────────────────────
  await selectWord('موظفة');
  await wait(300);
  await click(`${ed} [data-act="strike"]`);
  await wait(200);
  await selectWord('2015');
  await wait(300);
  await click(`${ed} [data-act="sup"]`);
  await wait(200);
  await selectWord('دائرتنا');
  await wait(300);
  await click(`${ed} [data-act="text-color"]`);
  await wait(300);
  ok('«لون النصّ» يفتح ألوان Word القياسية و«تلقائي»', (await page.eval(`return document.querySelectorAll('${ed} [data-color-menu] [data-color]').length;`)) === 11);
  await click(`${ed} [data-color="#c00000"]`);
  await wait(400);
  const inEditor = await page.eval(`
    const root = document.querySelector('${PM}');
    return { s: root.querySelector('s')?.innerText, sup: root.querySelector('sup')?.innerText, color: root.querySelector('[data-color]')?.innerText, menu: Boolean(document.querySelector('[data-color-menu]')) };
  `);
  ok(`تُرى على الورقة: مشطوب «${inEditor.s}»، وأعلى السطر «${inEditor.sup}»، وملوّن «${inEditor.color}»`, inEditor.s === 'موظفة' && inEditor.sup === '2015' && inEditor.color === 'دائرتنا' && !inEditor.menu);
  const sheet = () => page.eval(`return document.querySelector('${ed} [data-body]')?.innerHTML ?? '';`);
  let printed = await sheet();
  ok('وفي الورقة التي تُطبع كما تُرى', printed.includes('<s>موظفة</s>') && printed.includes('<sup>2015</sup>') && printed.includes('color:#c00000'));

  // ── ٣: القائمة بشكل «أ) ب)» كما تُطبع ─────────────────────────────────────
  await caretEnd();
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'المرفقات الأولى' });
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'المرفقات الثانية' });
  await wait(300);
  await page.eval(`
    const root = document.querySelector('${PM}');
    const ps = [...root.querySelectorAll(':scope > p')];
    const a = ps.at(-2).firstChild, b = ps.at(-1).firstChild;
    const range = document.createRange();
    range.setStart(a, 0);
    range.setEnd(b, b.data.length);
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  `);
  await wait(300);
  await click(`${ed} [data-act="numbers"]`);
  await wait(400);
  // العلامة زخرفةٌ مرسومة (`::before`) لا ترقيم المتصفّح: القائمة بلا `list-style`.
  const markers = () =>
    page.eval(`
      const ps = [...document.querySelectorAll('${PM} p[data-marker]')];
      const drawn = ps.every((p) => !['none', 'normal', ''].includes(getComputedStyle(p, '::before').content) && getComputedStyle(p.closest('ol, ul')).listStyleType === 'none');
      return drawn ? ps.map((p) => p.dataset.marker) : ['لا تُرسم'];
    `);
  ok(`«ترقيم» يُرى كما يُطبع «1-» لا «1.» (${(await markers()).join('، ')})`, (await markers()).join() === '1-,2-');
  ok('وزرّه مضاء والمؤشّر في القائمة', await page.eval(`return document.querySelector('${ed} [data-act="numbers"]').className.includes('bg-secondary-fixed');`));
  await choose(`${ed} [data-act="numerals"]`, 'indic');
  await wait(400);
  ok(`وأرقام الورقة «١ ٢ ٣» من شريطها: «١- ٢-» على الورقة (${(await markers()).join('، ')})`, (await markers()).join() === '١-,٢-');
  ok('وفي الورقة التي تُطبع', (await sheet()).includes('١-') && (await sheet()).includes('٢-'));
  await choose(`${ed} [data-act="list-style"]`, 'arabicLetter');
  await wait(400);
  ok(`و«شكل الترقيم» حروفًا: «أ) ب)» على الورقة (${(await markers()).join('، ')})`, (await markers()).join() === 'أ),ب)');
  printed = await sheet();
  ok('وتُطبع «أ) ب)» نفسها', printed.includes('أ)') && printed.includes('ب)'));

  // ── ١: سحب حدّ العمود بالفأرة ────────────────────────────────────────────
  await caretEnd();
  await click(`${ed} [data-act="insert"]`);
  await wait(400);
  await click('[data-act="ins-table"]');
  await wait(300);
  await click('[data-grid="3-3"]');
  await wait(700);
  const T = `[...document.querySelectorAll('${PM} table')].at(-1)`;
  const widths = () => page.eval(`return [...${T}.querySelectorAll('col')].map((c) => Math.round(parseFloat(c.style.width)));`);
  const depth = () => page.eval(`return Number(document.querySelector('${ed} [data-doc-editor]').dataset.undoDepth);`);
  ok(`أُدرج جدولٌ ٣×٣ بأعمدةٍ متساوية (${(await widths()).join('، ')})`, (await widths()).join() === '33,33,33');
  // الحدّ بين العمود الأوّل (يمينًا) والثاني: الحافّة اليسرى للخليّة الأولى.
  const edge = await page.eval(`const r = ${T}.rows[1].cells[0].getBoundingClientRect(); return { x: r.left + 2, y: r.top + r.height / 2, w: ${T}.getBoundingClientRect().width };`);
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: edge.x + 40, y: edge.y });
  await wait(100);
  ok('الفأرة داخل الخليّة: مؤشّرٌ عاديّ', !(await page.eval(`return document.querySelector('${PM}').classList.contains('pm-col-resize');`)));
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: edge.x, y: edge.y });
  await wait(100);
  ok('وعلى الحدّ بين عمودين: سهما سحب', await page.eval(`return document.querySelector('${PM}').classList.contains('pm-col-resize') && getComputedStyle(${T}.rows[1].cells[0]).cursor === 'col-resize';`));
  const before = await depth();
  await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: edge.x, y: edge.y, button: 'left', clickCount: 1 });
  await wait(60);
  for (const dx of [20, 40, edge.w * 0.15]) {
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: edge.x - dx, y: edge.y, button: 'left' });
    await wait(60);
  }
  const live = await widths();
  await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: edge.x - edge.w * 0.15, y: edge.y, button: 'left', clickCount: 1 });
  await wait(500);
  const after = await widths();
  ok(`السحب يُرى حيًّا وهو يُسحب (${live.join('، ')})`, live[0] > 45 && live[1] < 22 && live[2] === 33);
  ok(`وفي آخره يثبت: الأوّل أعرض بقدر ما ضاق جاره، والثالث كما هو (${after.join('، ')})`, after[0] === 48 && after[1] === 18 && after[2] === 33);
  ok('خطوةً واحدة في التراجع', (await depth()) === before + 1);
  ok('ولم يُحدَّد شيءٌ بالسحب على الحدّ', await page.eval(`return !document.querySelector('${PM} .selectedCell');`));
  await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: edge.x + 60, y: edge.y });

  // ── ويُحفظ كلّه في المسودّة ──────────────────────────────────────────────
  await click(`${ed} [data-act="save"]`);
  await wait(1200);
  const saved = lastDraftDoc();
  const runs = (saved?.blocks ?? []).flatMap((b) => (b.kind === 'paragraph' ? b.inlines : []));
  const table = (saved?.blocks ?? []).filter((b) => b.kind === 'table').at(-1);
  const list = (saved?.blocks ?? []).find((b) => b.kind === 'list');
  ok(
    'المسودّة تحفظ الشطب وأعلى السطر واللون',
    runs.some((r) => r.text === 'موظفة' && r.marks?.strike) && runs.some((r) => r.text === '2015' && r.marks?.script === 'sup') && runs.some((r) => r.text === 'دائرتنا' && r.marks?.color === '#c00000')
  );
  ok(`وشكل القائمة وأرقام الورقة (${JSON.stringify(list?.styles)} · ${saved?.pageSetup?.numerals})`, JSON.stringify(list?.styles) === '["arabicLetter"]' && list.items.length === 2 && saved?.pageSetup?.numerals === 'indic');
  ok(
    `وأوزان الأعمدة بعد السحب، ومجموعها كما كان (${JSON.stringify(table?.columns)})`,
    table?.columns?.length === 3 && table.columns[0] > 1.4 && table.columns[1] < 0.6 && table.columns[2] === 1 && Math.abs(table.columns.reduce((a, b) => a + b, 0) - 3) < 0.02
  );

  await page.send('Emulation.clearDeviceMetricsOverride');
  return steps;
}
