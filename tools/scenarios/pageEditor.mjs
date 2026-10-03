/**
 * سيناريو: المحرّر الجديد (المرحلة ١ من UPGRADE.md) — الورقة نصٌّ واحد لا كتلٌ منفصلة.
 *
 * شكوى الميدان: «لا نستطيع تحديد النصّ كلّه وتنسيقه». فيُفعَّل المحرّر الجديد من الإعدادات،
 * ويُكتب في المصمّم ثلاث فقرات بلوحة المفاتيح، ثم يُحدَّد الكلّ بـCtrl+A ويُنسَّق مرّةً واحدة —
 * حجمًا وعريضًا وتوسيطًا — ويُظلَّل مدًى يعبر فقرتين فيُمال، ويُصنع حقلٌ بـF4، ويُدرج فاصل
 * صفحة بـCtrl+Enter. ثم يُحفظ النموذج ويُفتَّش في القاعدة: كلّ ما رُئي محفوظ، والمعرّفات فريدة.
 */
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

  return steps.join('\n');
}
