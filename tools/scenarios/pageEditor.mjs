/**
 * سيناريو: المحرّر الجديد (المرحلة ١ من UPGRADE.md) — الورقة نصٌّ واحد لا كتلٌ منفصلة.
 *
 * شكوى الميدان: «لا نستطيع تحديد النصّ كلّه وتنسيقه». فيُفعَّل المحرّر الجديد من الإعدادات،
 * ويُكتب في المصمّم ثلاث فقرات بلوحة المفاتيح، ثم يُحدَّد الكلّ بـCtrl+A ويُنسَّق مرّةً واحدة —
 * حجمًا وعريضًا وتوسيطًا — ويُظلَّل مدًى يعبر فقرتين فيُمال، ويُصنع حقلٌ بـF4، ويُدرج فاصل
 * صفحة بـCtrl+Enter. ثم يُحفظ النموذج ويُفتَّش في القاعدة: كلّ ما رُئي محفوظ، والمعرّفات فريدة.
 *
 * والصفحات كما تُطبع: شريط الورقة (المقاس والاتجاه والهوامش بدرجاتها)، ثم كتابٌ طويل في محرّر
 * الكتب: لا سطر في هامشٍ ولا في الفجوة بين ورقتين، وعدد صفحاته على الشاشة هو عدد صفحات
 * ملف PDF الذي يخرج من محرّك الطباعة نفسه.
 */
import { mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (selector) =>
    page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      el.click();
      return true;
    `);
  /** يكتب كما تكتب لوحة المفاتيح في المكان الذي فيه المؤشّر. */
  const insert = async (text) => {
    await page.send('Input.insertText', { text });
    await wait(200);
  };
  /** يختار قيمةً من قائمة الأدوات عبر مُعيِّن React. */
  const choose = async (selector, value) => {
    const done = await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    `);
    await wait(300);
    return done;
  };
  /** يظلّل من حرفٍ في فقرة إلى حرفٍ في أخرى — كما يسحب الكاتب الفأرة. */
  const selectAcross = async (fromPara, fromOff, toPara, toOff) => {
    await page.eval(`
      const ps = document.querySelectorAll('[data-page-editor] > p');
      // بعد التنسيق صار النصّ داخل وسوم — فأوّل عقدةٍ نصّيّة لا أوّل ابن.
      const firstText = (p) => document.createTreeWalker(p, NodeFilter.SHOW_TEXT).nextNode();
      const a = firstText(ps[${fromPara}]);
      const b = firstText(ps[${toPara}]);
      const range = document.createRange();
      range.setStart(a, ${fromOff});
      range.setEnd(b, ${toOff});
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    `);
    await wait(300);
  };
  const paraCount = () => page.eval(`return document.querySelectorAll('[data-page-editor] > p').length;`);

  // ── التفعيل من الإعدادات ───────────────────────────────────────────
  await page.eval(`await window.diwan.settings.set({ newEditor: true }); return true;`);
  await page.goto('templates-library-drafts');
  await wait(700);
  await click('[data-act="new-blank"]');
  await wait(1200);
  ok('انفتح المصمّم بالمحرّر الجديد', await page.eval(`return Boolean(document.querySelector('[data-editor="v2"] [data-page-editor]'));`));

  await page.type('input[placeholder^="مثال: تأييد"]', 'إقرار بالمحرّر الجديد');

  // ── الكتابة بلوحة المفاتيح، وEnter فقرةٌ جديدة ─────────────────────
  await page.eval(`document.querySelector('[data-page-editor]').focus(); return true;`);
  await wait(200);
  await insert('أقرّ أنا الموقّع أدناه');
  await page.key('Enter');
  await insert('بأنّ المعلومات صحيحة');
  await page.key('Enter');
  await insert('وأتحمّل التبعات القانونية');
  await wait(400);
  ok('ثلاث فقرات كُتبت بلوحة المفاتيح', (await paraCount()) === 3);

  // ── Ctrl+A ثم تنسيقٌ واحد يعمّ الورقة ──────────────────────────────
  await page.key('KeyA', { ctrl: true });
  await wait(300);
  let text = await page.text();
  ok('Ctrl+A يحدّد الورقة كلّها ويقولها', text.includes('المحدَّد: الورقة كلّها'));
  ok('وزرّ «تحديد الكلّ» مضاء', await page.eval(`return document.querySelector('[data-act="select-all"]')?.className.includes('bg-secondary-fixed');`));
  ok('واختير الحجم ١٨ للكلّ', await choose('[data-act="size"]', '18'));
  await click('[data-act="bold"]');
  await wait(300);
  await click('[data-act="align-center"]');
  await wait(300);
  ok(
    'والفقرات الثلاث توسّطت على الورقة',
    await page.eval(`return [...document.querySelectorAll('[data-page-editor] > p')].every((p) => p.style.textAlign === 'center');`)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-all.png'));

  // ── تظليلٌ يعبر فقرتين، فمائل ──────────────────────────────────────
  await selectAcross(0, 4, 1, 4);
  text = await page.text();
  ok('التظليل عبر فقرتين يُحصى بالحرف', /محدَّد \d+ حرفًا/.test(text));
  await page.key('KeyI', { ctrl: true });
  await wait(300);
  ok('وCtrl+I يميل ما ظُلِّل في الفقرتين معًا', await page.eval(`return document.querySelectorAll('[data-page-editor] > p em').length >= 2;`));

  // ── F4: «المعلومات» في الفقرة الثانية خانةٌ ──────────────────────────
  // «بأنّ المعلومات صحيحة»: «المعلومات» من ٥ إلى ١٥ — والفقرة بعد المائل عقدٌ نصّيّة متعدّدة،
  // فيُبحث عن الكلمة في نصّها.
  await page.eval(`
    const p = document.querySelectorAll('[data-page-editor] > p')[1];
    const walker = document.createTreeWalker(p, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.data.indexOf('المعلومات');
      if (i >= 0) {
        const range = document.createRange();
        range.setStart(node, i);
        range.setEnd(node, i + 'المعلومات'.length);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        return true;
      }
    }
    return false;
  `);
  await wait(300);
  await page.key('F4');
  await wait(500);
  ok('صار المظلَّل خانةً على الورقة', await page.eval(`return document.querySelectorAll('[data-page-editor] [data-field]').length === 1;`));

  // ── Ctrl+Enter فاصل صفحة، وبعده فقرةٌ يُكتب فيها ──────────────────
  await page.eval(`
    const p = document.querySelectorAll('[data-page-editor] > p')[2];
    const range = document.createRange();
    range.selectNodeContents(p);
    range.collapse(false);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  `);
  await wait(300);
  await page.key('Enter', { ctrl: true });
  await wait(300);
  await insert('الصفحة الثانية');
  await wait(400);
  ok('فاصل الصفحة على الورقة', await page.eval(`return document.querySelectorAll('[data-page-editor] [data-page-break]').length === 1;`));

  // ── التراجع خطوةً يعيد ما قبلها ────────────────────────────────────
  await page.key('KeyZ', { ctrl: true });
  await wait(300);
  const afterUndo = await page.eval(`return document.querySelector('[data-page-editor]').textContent;`);
  ok('Ctrl+Z يتراجع عن آخر كتابة', !afterUndo.includes('الصفحة الثانية'));
  await page.key('KeyY', { ctrl: true });
  await wait(300);
  ok('وCtrl+Y يعيدها', (await page.eval(`return document.querySelector('[data-page-editor]').textContent;`)).includes('الصفحة الثانية'));
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-break.png'));

  // ── شريط الورقة ────────────────────────────────────────────────────
  const paperBox = () =>
    page.eval(`
      const p = document.querySelector('[data-paper]');
      const mm = 96 / 25.4;
      return {
        w: Math.round(p.offsetWidth / mm),
        top: Math.round(parseFloat(getComputedStyle(p).paddingTop) / mm),
        sheetH: Math.round(document.querySelector('[data-sheet]').offsetHeight / mm)
      };
    `);
  let box = await paperBox();
  ok('الورقة A4 عمودية بهامشٍ متوسّط', box.w === 210 && box.top === 20 && box.sheetH === 297);
  await click('[data-act="landscape"]');
  await wait(400);
  box = await paperBox();
  ok('«أفقية» تقلبها: عرضها ٢٩٧', box.w === 297 && box.sheetH === 210);
  await click('[data-act="portrait"]');
  await wait(200);
  await click('[data-margins="narrow"]');
  await wait(300);
  ok('«ضيّقة» تجعل الهامش ١٢ ملم', (await paperBox()).top === 12);
  await choose('[data-act="page-size"]', 'FS');
  await wait(300);
  box = await paperBox();
  ok('والفولسكاب بطوله ٣٣٠', box.w === 216 && box.sheetH === 330);
  await click('[data-margins="custom"]');
  await wait(200);
  ok('و«مخصّصة» تفتح أرقام الجوانب الأربعة', (await page.eval(`return document.querySelectorAll('[data-margin]').length;`)) === 4);

  // ── الحفظ ثم القاعدة ───────────────────────────────────────────────
  await page.clickText('حفظ النموذج');
  await wait(1800);
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const row = db.prepare('SELECT doc_json AS docJson, body_html AS body FROM templates').get();
  db.close();
  ok('حُفظ النموذج', Boolean(row));
  const doc = row?.docJson ? JSON.parse(row.docJson) : null;
  const blocks = doc?.blocks ?? [];
  const paras = blocks.filter((b) => b.kind === 'paragraph');
  const runs = paras.flatMap((b) => b.inlines.filter((i) => i.kind === 'run'));
  const textOf = (b) => b.inlines.map((i) => (i.kind === 'run' ? i.text : '')).join('');

  ok('الفقرات الأربع محفوظة', paras.length === 4);
  ok('والتوسيط على الفقرات الثلاث الأولى', paras.slice(0, 3).every((b) => b.align === 'center'));
  ok('والعريض على كلّ نصّها', paras.slice(0, 3).every((b) => b.inlines.every((i) => i.kind !== 'run' || i.marks?.bold)));
  ok('والحجم ١٨ على كلّ نصّها', paras.slice(0, 3).every((b) => b.inlines.every((i) => i.kind !== 'run' || i.marks?.size === 18 || b.size === 18)));
  ok('والمائل عبر الفقرتين', paras[0]?.inlines.some((i) => i.kind === 'run' && i.marks?.italic) && paras[1]?.inlines.some((i) => i.kind === 'run' && i.marks?.italic));
  ok('والخانة في الفقرة الثانية وفي الحقول', doc?.fields?.[0]?.label === 'المعلومات' && paras[1]?.inlines.some((i) => i.kind === 'field' && i.ref === doc.fields[0].key));
  ok('وفاصل الصفحة قبل «الصفحة الثانية»', blocks.findIndex((b) => b.kind === 'pageBreak') === blocks.findIndex((b) => b.kind === 'paragraph' && textOf(b) === 'الصفحة الثانية') - 1);
  const ids = [...blocks.map((b) => b.id), ...paras.flatMap((b) => b.inlines.map((i) => i.id))].filter(Boolean);
  ok('والمعرّفات فريدة — لا فقرتان بمعرّفٍ واحد بعد Enter', ids.length === new Set(ids).size && blocks.every((b) => b.id));
  ok('وظلّه النصّي للبحث', (row?.body ?? '').includes('أقرّ أنا الموقّع'));
  ok('ولا نصّ ضاع', runs.map((r) => r.text).join('').includes('وأتحمّل التبعات القانونية'));
  ok('وضبط الورقة محفوظ: فولسكاب بهامشٍ ضيّق', doc?.pageSetup?.size === 'FS' && doc?.pageSetup?.margins?.top === 12);

  // ── كتابٌ طويل: الصفحات كما تُطبع ─────────────────────────────────
  await page.goto('smart-editor-a4-preview');
  await wait(1200);
  await page.eval(`document.querySelector('[data-view="edit"]')?.click(); return true;`);
  await wait(600);
  const ed = '[data-screen="editor"]';
  ok('محرّر الكتب بالمحرّر الجديد', await page.eval(`return Boolean(document.querySelector('${ed} [data-page-editor]'));`));
  await page.eval(`document.querySelector('${ed} [data-page-editor]').focus(); return true;`);
  await wait(200);
  for (let i = 1; i <= 34; i++) {
    await page.send('Input.insertText', {
      text: `البند ${i}: يلتزم الطرفان بما ورد في هذه الاتفاقية من شروطٍ وأحكام، ولا يجوز لأيٍّ منهما الإخلال بها أو تعديلها إلا باتفاقٍ مكتوب.`
    });
    await page.key('Enter');
  }
  await wait(900);
  const pagesNow = () => page.eval(`return Number(document.querySelector('${ed} [data-page-count]')?.dataset.pageCount ?? 0);`);
  const flowed = await pagesNow();
  ok(`الكتاب الطويل صار صفحاتٍ على الشاشة (${flowed})`, flowed >= 2);

  /** أسطرٌ خارج متن كلّ ورقة — في هامشها أو في الفجوة بين ورقتين. والهامشان متساويان هنا (٢٠). */
  const outside = () =>
    page.eval(`
      const root = document.querySelector('${ed} [data-paper]');
      const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
      const pad = parseFloat(getComputedStyle(root).paddingTop) * scale;
      const sheets = [...root.querySelectorAll('[data-sheet]')].map((s) => s.getBoundingClientRect());
      const r = document.createRange();
      const walker = document.createTreeWalker(root.querySelector('[data-page-editor]'), NodeFilter.SHOW_TEXT);
      let bad = 0;
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        r.selectNodeContents(n);
        for (const rect of r.getClientRects()) {
          if (!rect.height) continue;
          if (!sheets.some((s) => rect.top >= s.top + pad - 1 && rect.bottom <= s.bottom - pad + 1)) bad++;
        }
      }
      return bad;
    `);
  ok('لا سطر في هامشٍ ولا بين ورقتين', (await outside()) === 0);

  // Ctrl+Enter في آخره: صفحةٌ جديدة لما بعده.
  await page.key('Enter', { ctrl: true });
  await page.send('Input.insertText', { text: 'وحُرّرت هذه الاتفاقية من نسختين.' });
  await wait(900);
  const total = await pagesNow();
  ok('وفاصل الصفحة يزيدها صفحة', total === flowed + 1);
  ok('وما بعد الفاصل في أعلى ورقته', (await outside()) === 0);
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-pages.png'));
  ok('وقائمة «قبل الإصدار» تقول العدد نفسه', (await page.text()).includes(`الكتاب في ${total} صفحات`));

  // ── PDF من محرّك الطباعة: عدد صفحاته عدد صفحات الشاشة ─────────────
  const saveDir = process.env.DIWAN_TEST_SAVE_DIR;
  if (saveDir) mkdirSync(saveDir, { recursive: true });
  await page.eval(`document.querySelector('[data-act="export-pdf"]').click(); return true;`);
  await wait(3500);
  const pdfs = saveDir ? readdirSync(saveDir).filter((f) => f.toLowerCase().endsWith('.pdf')) : [];
  ok('حُفظ الكتاب PDF', pdfs.length === 1);
  if (pdfs.length === 1) {
    const raw = readFileSync(join(saveDir, pdfs[0]), 'latin1');
    const printed = (raw.match(/\/Type\s*\/Page(?!s)/g) ?? []).length;
    ok(`وصفحاته في الطباعة (${printed}) كصفحاته على الشاشة (${total})`, printed === total);
  }

  return steps.join('\n');
}
