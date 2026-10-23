/**
 * سيناريو: تباعد الفقرات قبل وبعد في شريط المحرّر (S11).
 *
 * يفتح مصمّم النماذج، ويتحقّق من وجود قائمة تباعد الفقرات `[data-act="paragraph-spacing"]`،
 * ويكتب فقرة، ثم يضبط التباعد إلى ١٢ نقطة ويتحقّق من ظهور `margin-bottom: 12px` على الفقرة،
 * ثم يغيّره إلى ١٨ نقطة، وأخيرًا يعيده إلى ٠ ويتحقّق من اختفاء `margin-bottom` تمامًا.
 * و(D139) قائمة «قبل» بجانب «بعد» بالقيم نفسها ووحدتها «بكسل» في النصّ (كانت «تباعد: ١٢» بلا وحدة): «قبل ١٢» ← `margin-top:12px`،
 * ويبقى بعد الحفظ وإعادة الفتح، وWord المصدَّر من المحفوظ فيه `w:spacing w:before`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { strFromU8, unzipSync } from 'fflate';

/** Word يُحفظ بلا حوار في مجلّد التشغيل (`DIWAN_TEST_SAVE_DIR` من `drive.mjs`) — يُنشأ قبل الإقلاع. */
export async function prepare() {
  mkdirSync(process.env.DIWAN_TEST_SAVE_DIR, { recursive: true });
  return {};
}

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const choose = async (selector, value) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('not found: ' + ${JSON.stringify(selector)});
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, ${JSON.stringify(value)});
      el.dispatchEvent(new Event('change', { bubbles: true }));
    `);
    await wait(350);
  };

  const type = async (text) => {
    await page.send('Input.insertText', { text });
    await wait(300);
  };

  // ١. فتح مصمّم النماذج
  await page.goto('templates-library-drafts');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  await wait(1200);

  ok('انفتح محرّر النموذج وظهرت أداة تباعد الفقرات', await page.eval(`return Boolean(document.querySelector('[data-act="paragraph-spacing"]'));`));

  // ٢. خيارات قائمة تباعد الفقرات تشمل 0، 6، 12، 18
  const options = await page.eval(`return [...document.querySelectorAll('[data-act="paragraph-spacing"] option')].map((o) => o.value);`);
  ok('خيارات تباعد الفقرات تشمل 0 و6 و12 و18', ['0', '6', '12', '18'].every((v) => options.includes(v)));

  // ٣. كتابة نصّ في الفقرة الأولى
  await page.eval(`
    const ed = document.querySelector('[data-page-editor]');
    if (ed) ed.focus();
    return true;
  `);
  await wait(200);
  await type('الفقرة الأولى لاختبار تباعد الفقرات');
  await wait(300);

  // ٤. تباعد الفقرة الافتراضي ليس فيه margin-bottom
  const initialStyle = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('الفقرة تبدأ بلا تباعد (بلا margin-bottom)', !initialStyle.includes('margin-bottom'));

  // ٥. اختيار تباعد 12 نقطة
  await choose('[data-act="paragraph-spacing"]', '12');
  await wait(400);

  const style12 = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('الفقرة تأخذ تباعد 12 بكسل (margin-bottom: 12px)', style12.includes('margin-bottom:12px') || style12.includes('margin-bottom: 12px'));

  // ٦. اختيار تباعد 18 نقطة
  await choose('[data-act="paragraph-spacing"]', '18');
  await wait(400);

  const style18 = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('الفقرة تأخذ تباعد 18 بكسل (margin-bottom: 18px)', style18.includes('margin-bottom:18px') || style18.includes('margin-bottom: 18px'));

  // ٧. إعادة التباعد إلى 0 (إلغاء التباعد)
  await choose('[data-act="paragraph-spacing"]', '0');
  await wait(400);

  const style0 = await page.eval(`return document.querySelector('[data-page-editor] p')?.getAttribute('style') || '';`);
  ok('إعادة التباعد إلى 0 تزيل margin-bottom تمامًا', !style0.includes('margin-bottom'));

  // ٨. (D139) «قبل» بجانب «بعد»: القيم نفسها، والوحدة في النصّ
  const labels = (act) => page.eval(`return [...document.querySelectorAll('[data-act="${act}"] option')].map((o) => ({ v: o.value, t: o.textContent }));`);
  const before = await labels('paragraph-spacing-before');
  const after = await labels('paragraph-spacing');
  const unit = (opts) => opts.filter((o) => o.v !== '0').every((o) => o.t.includes('بكسل'));
  ok(
    `(D139) قائمة «قبل» بـ٠ و٦ و١٢ و١٨، والوحدة ظاهرة فيها وفي «بعد» (${before.map((o) => o.t).join('، ')})`,
    ['0', '6', '12', '18'].every((v) => before.some((o) => o.v === v)) && unit(before) && unit(after) && before[0]?.t.includes('قبل') && after[0]?.t.includes('بعد')
  );

  // ٩. قبل ١٢ وبعد ٦ معًا
  await choose('[data-act="paragraph-spacing-before"]', '12');
  await choose('[data-act="paragraph-spacing"]', '6');
  // والمتصفّح يكتب النمط «margin-top: 12px;» بمسافة: يُقارَن بلا مسافات.
  const pStyle = () => page.eval(`return (document.querySelector('[data-page-editor] p')?.getAttribute('style') || '').replace(/\\s/g, '');`);
  const both = await pStyle();
  ok(`(D139) «قبل ١٢» ← margin-top:12px، و«بعد ٦» بجانبه (${both})`, both.includes('margin-top:12px') && both.includes('margin-bottom:6px'));

  // ١٠. الحفظ: في القاعدة، وفي Word المصدَّر من المحفوظ
  const TITLE = 'نموذج تباعد ما قبل الفقرة';
  await page.type('input[placeholder^="مثال: تأييد"]', TITLE);
  await page.clickText('حفظ النموذج');
  await wait(1500);
  const saved = await page.eval(`
    const t = (await window.diwan.templates.list()).find((x) => x.title === ${JSON.stringify(TITLE)});
    if (!t) return null;
    const d = await window.diwan.templates.doc(t.id);
    const p = d.blocks.find((b) => b.kind === 'paragraph' && b.inlines.length);
    const file = await window.diwan.output.saveDocx({ doc: d, values: {}, head: null, suggestedName: 'تباعد قبل الفقرة', title: ${JSON.stringify(TITLE)} });
    return { spaceBefore: p?.spaceBefore ?? null, spaceAfter: p?.spaceAfter ?? null, file };
  `);
  ok(`(D139) وفي القاعدة بعد الحفظ: ${JSON.stringify({ spaceBefore: saved?.spaceBefore, spaceAfter: saved?.spaceAfter })}`, saved?.spaceBefore === 12 && saved?.spaceAfter === 6);
  const xml = saved?.file ? strFromU8(unzipSync(new Uint8Array(readFileSync(saved.file)))['word/document.xml']) : '';
  const spacing = /<w:spacing[^>]*w:before="(\d+)"[^>]*\/>/.exec(xml);
  ok(`(D139) وWord المصدَّر فيه w:spacing w:before (${spacing ? spacing[0] : 'لا شيء'})`, spacing?.[1] === '180' && /w:after="90"/.test(spacing?.[0] ?? ''));

  // ١١. إعادة الفتح
  if (await page.eval(`return Boolean(document.querySelector('[data-page-editor]'));`)) {
    await page.eval(`document.querySelector('button[title="إغلاق"]')?.click(); return true;`);
    await wait(600);
  }
  await page.goto('templates-library-drafts');
  await wait(800);
  const reopened = await page.eval(`
    // زرّ «تعديل» في بطاقة النموذج: أعلى أصلٍ لا يحوي غير زرٍّ واحد منه هو البطاقة.
    const edit = [...document.querySelectorAll('button[title="تعديل صيغ المتغيرات"]')].find((b) => {
      let card = b;
      while (card.parentElement && card.parentElement.querySelectorAll('button[title="تعديل صيغ المتغيرات"]').length === 1) card = card.parentElement;
      return card.innerText.includes(${JSON.stringify(TITLE)});
    });
    edit?.click();
    return Boolean(edit);
  `);
  await wait(1500);
  const back = await pStyle();
  const shown = await page.eval(`return [document.querySelector('[data-act="paragraph-spacing-before"]')?.value, document.querySelector('[data-act="paragraph-spacing"]')?.value];`);
  ok(
    `(D139) أُعيد فتحه فالفقرة margin-top:12px والقائمتان ${JSON.stringify(shown)}`,
    reopened && back.includes('margin-top:12px') && back.includes('margin-bottom:6px') && shown[0] === '12' && shown[1] === '6'
  );

  return steps.join('\n');
}
