/**
 * سيناريو: تظليل صفّ العناوين ومحاذاة الخليّة عموديًّا في جداول المحرّر (S12).
 *
 * يفتح مصمّم النماذج، ويُدرج جدولًا ٣×٣، ويتحقّق من وجود أزرار تظليل صفّ العناوين
 * ومحاذاة الخلايا عموديًّا، ويختبر تظليل الرأس باللون الخفيف، ومحاذاة الخلية إلى الوسط والأسفل والأعلى.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const click = async (selector) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('not found: ' + ${JSON.stringify(selector)});
      el.click();
      return true;
    `);
    await wait(400);
  };

  // ١. فتح مصمّم النماذج وإنشاء نموذج فارغ
  await page.goto('templates-library-drafts');
  await wait(700);
  await click('[data-act="new-blank"]');
  await wait(1200);

  // ٢. إدراج جدول ٣×٣
  await click('[data-act="insert"]');
  await wait(300);
  await click('[data-act="ins-table"]');
  await wait(300);
  await click('[data-grid="3-3"]');
  await wait(800);

  const T = `[...document.querySelectorAll('[data-page-editor] table')].at(-1)`;
  ok('أُدرج جدول ٣×٣ في محرّر النموذج', await page.eval(`return Boolean(${T} && ${T}.rows.length === 3);`));

  // ٣. التحقّق من ظهور أزرار الجدول الجديدة
  ok(
    'ظهرت أزرار تظليل صفّ العناوين والمحاذاة العمودية في شريط التنسيق',
    Boolean(
      (await page.eval(`return Boolean(document.querySelector('[data-act="table-header-shading"]'));`)) &&
        (await page.eval(`return Boolean(document.querySelector('[data-act="cell-valign-middle"]'));`)) &&
        (await page.eval(`return Boolean(document.querySelector('[data-act="cell-valign-bottom"]'));`)) &&
        (await page.eval(`return Boolean(document.querySelector('[data-act="cell-valign-top"]'));`))
    )
  );

  // ٤. وضع المؤشر داخل الخلية الأولى
  const caretIn = (r, c) =>
    page.eval(`
      const p = ${T}.rows[${r}].cells[${c}].querySelector('p');
      const ed = document.querySelector('[data-page-editor]');
      if (ed) ed.focus();
      const range = document.createRange();
      range.setStart(p, 0);
      range.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    `);

  await caretIn(0, 0);
  await wait(300);

  // ٥. تفعيل تظليل صفّ العناوين
  await click('[data-act="table-header-shading"]');
  await wait(400);

  const hasShadingClass = await page.eval(`return ${T}.classList.contains('pm-header-shading');`);
  const cellBg = await page.eval(`return window.getComputedStyle(${T}.rows[0].cells[0]).backgroundColor;`);
  ok('تفعيل تظليل صفّ العناوين يظلّل الصفّ الأول بلون خفيف (rgb(241, 245, 249))', hasShadingClass && cellBg.includes('241, 245, 249'));

  // ٦. إطفاء تظليل صفّ العناوين
  await click('[data-act="table-header-shading"]');
  await wait(400);
  const noShading = await page.eval(`return !${T}.classList.contains('pm-header-shading');`);
  ok('إطفاء تظليل صفّ العناوين يزيل التظليل', noShading);

  // إعادة تشغيل التظليل
  await click('[data-act="table-header-shading"]');
  await wait(400);

  // ٧. الانتقال للخلية (1, 1) وضبط المحاذاة العمودية إلى الوسط (middle)
  await caretIn(1, 1);
  await wait(300);
  await click('[data-act="cell-valign-middle"]');
  await wait(400);

  const vAlignMiddle = await page.eval(`return ${T}.rows[1].cells[1].getAttribute('data-valign') === 'middle' || ${T}.rows[1].cells[1].style.verticalAlign === 'middle';`);
  ok('محاذاة الخلية عموديًّا إلى الوسط تضبط vertical-align: middle', vAlignMiddle);

  // ٨. ضبط المحاذاة العمودية إلى الأسفل (bottom)
  await click('[data-act="cell-valign-bottom"]');
  await wait(400);
  const vAlignBottom = await page.eval(`return ${T}.rows[1].cells[1].getAttribute('data-valign') === 'bottom' || ${T}.rows[1].cells[1].style.verticalAlign === 'bottom';`);
  ok('محاذاة الخلية عموديًّا إلى الأسفل تضبط vertical-align: bottom', vAlignBottom);

  // ٩. إعادة المحاذاة العمودية إلى الأعلى (top)
  await click('[data-act="cell-valign-top"]');
  await wait(400);
  const vAlignTop = await page.eval(`return ${T}.rows[1].cells[1].getAttribute('data-valign') === 'top' || ${T}.rows[1].cells[1].style.verticalAlign === 'top';`);
  ok('محاذاة الخلية عموديًّا إلى الأعلى تضبط vertical-align: top', vAlignTop);

  return steps.join('\n');
}
