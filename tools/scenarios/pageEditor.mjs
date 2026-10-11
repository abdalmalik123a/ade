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
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
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

  // ── المصمّم بورقةٍ فارغة — والمحرّر الجديد هو الوحيد ──────────────────
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
  // الحجم بالنقطة كما في Word (د٥): «١٨» نقطة = ٢٤ بكسلًا مخزَّنًا.
  ok('واختير الحجم ١٨ نقطة للكلّ', await choose('[data-act="size"]', '18'));
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
  ok('التظليل عبر فقرتين يُحصى بالحرف', /محدَّد [٠-٩]+ (حرفًا|أحرف)|محدَّد حرف/.test(text));
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
  ok('والفولسكاب ٢١٠×٣٣٠', box.w === 210 && box.sheetH === 330);
  // المقاسات الشائعة في العراق (قرار ٨ ت١: «يشمل الأغلب»)
  for (const [size, w, h] of [['A3', 297, 420], ['A6', 105, 148], ['LT', 216, 279], ['LG', 216, 356]]) {
    await choose('[data-act="page-size"]', size);
    await wait(300);
    box = await paperBox();
    ok(`و${size} ${w}×${h}`, box.w === w && box.sheetH === h);
  }
  await choose('[data-act="page-size"]', 'FS');
  await wait(300);
  await click('[data-margins="custom"]');
  await wait(200);
  ok('و«مخصّصة» تفتح أرقام الجوانب الأربعة', (await page.eval(`return document.querySelectorAll('[data-margin]').length;`)) === 4);

  // ── الترويسة على شريط الورقة: رسمية، أو أسطرٌ في أعلاها، أو بلا ─────
  ok('الطرق الثلاث على الشريط', (await page.eval(`return document.querySelectorAll('[data-head]').length;`)) === 3);
  ok('و«رسمية» معطّلة ولا ترويسة في المكتبة بعد', await page.eval(`return document.querySelector('[data-head="formal"]').disabled;`));
  await click('[data-head="lines"]');
  await wait(300);
  ok('«أسطرٌ في أعلى الورقة» تعرض «خطّ فاصل»', Boolean(await page.eval(`return document.querySelector('[data-act="head-divider"]') !== null;`)));
  await click('[data-act="head-divider"]');
  await wait(400);
  ok(
    'والخطّ تحت أسطر الرأس — بعد الفقرات الثلاث وقبل فاصل الصفحة',
    await page.eval(`
      const kids = [...document.querySelector('[data-page-editor]').children].filter((e) => !e.dataset.pageGap);
      const i = kids.findIndex((e) => e.dataset.rule !== undefined);
      return i === 3 && kids[4]?.dataset.pageBreak !== undefined;
    `)
  );
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-head.png'));

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
  ok('والحجم ١٨ نقطة (٢٤ بكسلًا) على كلّ نصّها', paras.slice(0, 3).every((b) => b.inlines.every((i) => i.kind !== 'run' || i.marks?.size === 24 || b.size === 24)));
  ok('والمائل عبر الفقرتين', paras[0]?.inlines.some((i) => i.kind === 'run' && i.marks?.italic) && paras[1]?.inlines.some((i) => i.kind === 'run' && i.marks?.italic));
  ok('والخانة في الفقرة الثانية وفي الحقول', doc?.fields?.[0]?.label === 'المعلومات' && paras[1]?.inlines.some((i) => i.kind === 'field' && i.ref === doc.fields[0].key));
  ok('وفاصل الصفحة قبل «الصفحة الثانية»', blocks.findIndex((b) => b.kind === 'pageBreak') === blocks.findIndex((b) => b.kind === 'paragraph' && textOf(b) === 'الصفحة الثانية') - 1);
  const ids = [...blocks.map((b) => b.id), ...paras.flatMap((b) => b.inlines.map((i) => i.id))].filter(Boolean);
  ok('والمعرّفات فريدة — لا فقرتان بمعرّفٍ واحد بعد Enter', ids.length === new Set(ids).size && blocks.every((b) => b.id));
  ok('وظلّه النصّي للبحث', (row?.body ?? '').includes('أقرّ أنا الموقّع'));
  ok('ولا نصّ ضاع', runs.map((r) => r.text).join('').includes('وأتحمّل التبعات القانونية'));
  ok('وضبط الورقة محفوظ: فولسكاب بهامشٍ ضيّق', doc?.pageSetup?.size === 'FS' && doc?.pageSetup?.margins?.top === 12);
  ok('والرأس أسطرٌ وتحته خطّه', doc?.pageSetup?.letterheadMode === 'lines' && blocks[3]?.kind === 'rule');

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
  // والعدد بأداة العدّ وأرقامها الهندية (UI.md ٣): «الكتاب في ٣ صفحات».
  ok('وقائمة «قبل الإصدار» تقول العدد نفسه', (await page.text()).includes(`الكتاب في ${String(total).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d])} صفحات`));

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

  // ── التوقيع لا يبدأ صفحةً وحده ─────────────────────────────────────
  // متنٌ بأسطرٍ كاملة (أطول من الخاتمة، وكلٌّ في سطرٍ واحد) حتى يبقى من الصفحة الأولى أقلّ من
  // سطرين، ثم خاتمةٌ بسطرين: لا تسعها الصفحة — فتنزل ومعها آخر فقرةٍ من المتن.
  const BODY = 'يرجى التفضل بالاطلاع واتخاذ ما يلزم بشأن الطلب المقدّم من المذكور';
  await page.eval(`document.querySelector('${ed} [data-page-editor]').focus(); return true;`);
  await page.key('KeyA', { ctrl: true });
  await page.send('Input.insertText', { text: BODY });
  /** ما بقي من متن الورقة الأولى تحت آخر فقرة، بالبكسل. */
  const room = () =>
    page.eval(`
      const root = document.querySelector('${ed} [data-paper]');
      const scale = root.getBoundingClientRect().width / root.offsetWidth || 1;
      const pad = parseFloat(getComputedStyle(root).paddingTop) * scale;
      const sheet = root.querySelector('[data-sheet="1"]').getBoundingClientRect();
      const ps = [...root.querySelectorAll('[data-page-editor] > p')];
      return (sheet.bottom - pad - ps[ps.length - 1].getBoundingClientRect().bottom) / scale;
    `);
  await wait(400);
  for (let i = 0; i < 60 && (await room()) >= 60; i++) {
    await page.key('Enter');
    await page.send('Input.insertText', { text: BODY });
    await wait(120);
  }
  const left = await room();
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'مع التقدير.' });
  await page.key('Enter');
  await page.send('Input.insertText', { text: 'مدير المدرسة' });
  await wait(900);
  const sheetsOf = () =>
    page.eval(`
      const root = document.querySelector('${ed} [data-paper]');
      const sheets = [...root.querySelectorAll('[data-sheet]')].map((s) => s.getBoundingClientRect());
      const ps = [...root.querySelectorAll('[data-page-editor] > p')];
      const on = (p) => sheets.findIndex((s) => p.getBoundingClientRect().top >= s.top && p.getBoundingClientRect().top < s.bottom) + 1;
      return { lastBody: on(ps[ps.length - 3]), sign: on(ps[ps.length - 1]), count: sheets.length };
    `);
  const where = await sheetsOf();
  ok(`بقي من الأولى أقلّ من سطرين (${Math.round(left)} بكسل)`, left > 0 && left < 64);
  ok('والتوقيع في صفحة آخر فقرةٍ من المتن لا وحده', where.sign === 2 && where.lastBody === 2 && where.count === 2);
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-sign.png'));
  for (const f of readdirSync(saveDir)) rmSync(join(saveDir, f));
  await page.eval(`document.querySelector('[data-act="export-pdf"]').click(); return true;`);
  await wait(3500);
  const signPdf = readdirSync(saveDir).filter((f) => f.toLowerCase().endsWith('.pdf'));
  const signPages = signPdf.length === 1 ? (readFileSync(join(saveDir, signPdf[0]), 'latin1').match(/\/Type\s*\/Page(?!s)/g) ?? []).length : 0;
  ok(`وفي الطباعة صفحتان كما على الشاشة (${signPages})`, signPages === 2);

  // ── اللصق من Word: بتنسيقه وجدوله وصورته ──────────────────────────
  // ما يضعه Word في الحافظة: وسوم Office، وتعليقاتٌ شرطية، و`<o:p>`، والصورة ملفٌّ مؤقّت — في المجلّد المؤقّت كما يضعها
  // Word (`%TEMP%\msohtmlclip1\…`)؛ ولا يُقبل غيره منذ و٥.
  const clipDir = join(tmpdir(), `msohtmlclip-diwan-${Date.now()}`);
  mkdirSync(clipDir, { recursive: true });
  copyFileSync(resolve('tests/fixtures/tiny.jpg'), join(clipDir, 'clip_image001.jpg'));
  const picture = pathToFileURL(join(clipDir, 'clip_image001.jpg')).href;
  const WORD_HTML =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta name=Generator content="Microsoft Word 15"><style><!-- p.MsoNormal {margin:0cm;font-size:11.0pt;} --></style></head>` +
    `<body lang=EN-US><!--StartFragment-->` +
    `<p class=MsoNormal align=center dir=RTL style='text-align:center;direction:rtl'><b><span lang=AR-IQ style='font-size:16.0pt;font-family:"Simplified Arabic",serif'>إقرار وتعهد<o:p></o:p></span></b></p>` +
    `<p class=MsoNormal dir=RTL style='text-align:justify;direction:rtl'><span lang=AR-IQ style='font-size:14.0pt'>أتعهد أنا <i>المذكور</i> بالالتزام بما ورد<o:p></o:p></span></p>` +
    `<p class=MsoListParagraphCxSpFirst dir=RTL style='margin-right:36pt;text-indent:-18pt;mso-list:l0 level1 lfo1'><![if !supportLists]><span style='font-family:Symbol'><span style='mso-list:Ignore'>·<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp; </span></span></span><![endif]><span lang=AR-IQ>البند الأول<o:p></o:p></span></p>` +
    `<p class=MsoListParagraphCxSpLast dir=RTL style='margin-right:36pt;text-indent:-18pt;mso-list:l1 level1 lfo2'><![if !supportLists]><span><span style='mso-list:Ignore'>2.<span>&nbsp; </span></span></span><![endif]><span lang=AR-IQ>البند الثاني<o:p></o:p></span></p>` +
    `<table class=MsoTableGrid dir=rtl border=1 cellspacing=0><tr><td><p class=MsoNormal><span lang=AR-IQ>الاسم</span></p></td><td><p class=MsoNormal><span lang=AR-IQ>التوقيع</span></p></td></tr></table>` +
    `<p class=MsoNormal dir=RTL><img width=120 height=40 src="${picture}"><o:p></o:p></p>` +
    `<!--EndFragment--></body></html>`;
  await page.eval(`document.querySelector('${ed} [data-page-editor]').focus(); return true;`);
  await page.key('KeyA', { ctrl: true });
  const paste = (html, text, png) =>
    page.eval(`
      const dt = new DataTransfer();
      ${html ? `dt.setData('text/html', ${JSON.stringify(html)});` : ''}
      ${text ? `dt.setData('text/plain', ${JSON.stringify(text)});` : ''}
      if (${png ? 'true' : 'false'}) {
        const c = document.createElement('canvas');
        c.width = 300; c.height = 80;
        const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 300, 80);
        const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
        dt.items.add(new File([blob], 'shot.png', { type: 'image/png' }));
      }
      const el = document.querySelector('${ed} [data-page-editor]');
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
      return true;
    `);
  await paste(WORD_HTML, 'إقرار وتعهد\nأتعهد أنا المذكور بالالتزام بما ورد');
  await wait(1500);
  const pasted = await page.eval(`
    const ed = document.querySelector('${ed} [data-page-editor]');
    const first = ed.querySelector(':scope > p');
    return {
      text: ed.textContent,
      centered: first?.style.textAlign === 'center',
      bold: Boolean(first?.querySelector('strong, b')),
      size: Math.round(parseFloat(first?.querySelector('[style*="font-size"]')?.style.fontSize ?? '0')),
      font: (ed.querySelector('[style*="font-family"]')?.style.fontFamily ?? ''),
      italic: [...ed.querySelectorAll('em')].some((e) => e.textContent.includes('المذكور')),
      cells: ed.querySelectorAll('table td').length,
      img: ed.querySelector('img')?.getAttribute('src') ?? ''
    };
  `);
  ok('لُصق النصّ بلا بقايا Word', pasted.text.includes('إقرار وتعهد') && pasted.text.includes('بالالتزام') && !/StartFragment|o:p|MsoNormal|supportLists|endif|·/.test(pasted.text));
  ok('ونقطة البند «•» ورقمه كما كُتب', /•\s*البند الأول/.test(pasted.text) && /2\.\s*البند الثاني/.test(pasted.text));
  ok(`والعنوان موسَّطٌ عريضٌ بحجمه (${pasted.size}) وخطّه`, pasted.centered && pasted.bold && pasted.size === 21 && pasted.font.includes('Simplified Arabic'));
  ok('والمائل في موضعه', pasted.italic);
  ok('والجدول بخليّتيه', pasted.cells === 2);
  ok('والصورة نُسخت من ملفّ Word المؤقّت إلى المخزن', pasted.img.startsWith('diwan://store/images/'));
  if (pasted.img.startsWith('diwan://store/images/')) {
    ok('وملفّها في المخزن', readdirSync(join(profile, 'data', 'store', 'images')).includes(pasted.img.split('/').pop()));
  }
  rmSync(clipDir, { recursive: true, force: true });

  // لقطة شاشة وحدها في الحافظة: تُدرج صورةً بمقاسها.
  await paste(null, null, true);
  await wait(1200);
  const shot = await page.eval(`
    const imgs = [...document.querySelectorAll('${ed} [data-page-editor] img')];
    return imgs.map((i) => ({ src: i.getAttribute('src'), w: Math.round(i.getBoundingClientRect().width) }));
  `);
  ok('ولقطة الشاشة تُلصق صورةً محفوظة بعرضها (٣٠٠) — بعد صورة Word لا مكانها', shot.length === 2 && shot.some((s) => s.src.startsWith('diwan://store/images/') && s.w === 300));
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-paste.png'));

  // ── الجدول: ما تصنعه أدواته يُحفظ (الموجة ١، المجموعة ب) ─────────────────
  await click(`${ed} [data-act="insert"]`);
  await wait(400);
  await click('[data-act="ins-table"]');
  await wait(300);
  await click('[data-grid="3-3"]');
  await wait(700);
  /** آخر جدولٍ على الورقة — الذي أُدرج الآن. */
  const T = `[...document.querySelectorAll('${ed} [data-page-editor] table')].at(-1)`;
  /** المؤشّر في خليّةٍ بصفّها وعمودها. */
  const caretIn = (r, c) =>
    page.eval(`
      const p = ${T}.rows[${r}].cells[${c}].querySelector('p');
      document.querySelector('${ed} [data-page-editor]').focus();
      const range = document.createRange();
      range.setStart(p, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    `);
  /** يسحب الفأرة من خليّةٍ إلى أخرى — فتُحدَّد الخلايا بينهما كما يحدّدها الكاتب. */
  const dragCells = async (from, to) => {
    const at = (r, c) => page.eval(`const b = ${T}.rows[${r}].cells[${c}].getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 };`);
    const a = await at(...from);
    const b = await at(...to);
    // مهلةٌ بين الحركات كما تتحرّك يدٌ حقيقية — متلاحقةً بلا مهلة لا يلحق المحرّر ببدء التحديد.
    await page.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 });
    await wait(50);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, button: 'left' });
    await wait(50);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: b.x, y: b.y, button: 'left' });
    await wait(50);
    await page.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
    await wait(300);
  };
  const widths = () => page.eval(`return [...${T}.querySelectorAll('col')].map((c) => Math.round(parseFloat(c.style.width)));`);
  ok('أُدرج جدولٌ ٣×٣ وصفّ عناوينه عريضٌ كما يُطبع', (await page.eval(`return ${T}.rows.length === 3 && ${T}.classList.contains('pm-header');`)));
  await caretIn(0, 1);
  await click('[data-act="col-wider"]');
  await wait(300);
  await click('[data-act="col-add"]');
  await wait(400);
  ok('«أوسع» ثم «عمودٌ يسار هذا» بعرضه: الأوزان ١، ١٫٥، ١٫٥، ١ — لا تُصفَّر', JSON.stringify(await widths()) === JSON.stringify([20, 30, 30, 20]));
  await click('[data-act="table-borders"]');
  await click('[data-act="table-header"]');
  await wait(300);
  ok('وتُخفى حدوده ويُطفأ صفّ عناوينه', await page.eval(`return ${T}.classList.contains('pm-noborder') && !${T}.classList.contains('pm-header');`));
  await dragCells([1, 0], [2, 0]);
  await click('[data-act="merge"]');
  await wait(400);
  ok(
    '«ادمج» رأسيًّا لا يدمج، ويقول لماذا — فالورقة لا تحفظه',
    (await page.eval(`return document.querySelector('${ed} [data-editor-notice]')?.innerText ?? '';`)).includes('الدمج الرأسي') &&
      (await page.eval(`return [...${T}.rows].map((r) => r.cells.length).join(',');`)) === '4,4,4'
  );
  await dragCells([0, 0], [0, 1]);
  await click('[data-act="merge"]');
  await wait(400);
  ok('ودمج خليّتين في الصفّ الواحد يُدمج', await page.eval(`return ${T}.rows[0].cells.length === 3 && ${T}.rows[0].cells[0].colSpan === 2;`));
  await click(`${ed} [data-act="save"]`);
  await wait(1200);
  {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const draft = d.prepare('SELECT values_json AS v FROM drafts ORDER BY id DESC LIMIT 1').get();
    d.close();
    const savedDoc = draft ? JSON.parse(JSON.parse(draft.v).__doc) : null;
    const tables = (savedDoc?.blocks ?? []).filter((b) => b.kind === 'table');
    const t = tables.at(-1);
    ok(
      'والمسودة تحفظ ما صُنع: الأوزان، والحدود المخفيّة، وبلا صفّ عناوين، والدمج الأفقي',
      JSON.stringify(t?.columns) === JSON.stringify([1, 1.5, 1.5, 1]) &&
        t?.borders === false &&
        t?.header === false &&
        t?.rows?.[0]?.cells?.[0]?.colSpan === 2 &&
        t?.rows?.map((r) => r.cells.length).join(',') === '3,4,4'
    );
  }
  if (shotsDir) await page.shot(join(shotsDir, 'page-editor-table.png'));

  return steps.join('\n');
}
