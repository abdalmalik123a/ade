/**
 * سيناريو: الدمج الرأسيّ لخلايا الجدول في المحرّر (S37 · DC-1 · D129).
 *
 * يفتح مصمّم النماذج، ويُدرج جدولًا ٣×٣، ويحدد خليتين متتاليتين رأسيًّا (0, 0) و(1, 0)،
 * وينقر «ادمج»، ويتحقق من ظهور rowspan="2" في الخلية المدمجة وتكيّف خلايا الصف الثاني،
 * ثم يختبر فكّ الدمج، وإعادة الدمج الرأسي وثباته.
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
  ok('أُدرج جدول ٣×٣ في المحرّر', await page.eval(`return Boolean(${T} && ${T}.rows.length === 3);`));

  // ٣. تحديد الخليتين (0, 0) و (1, 0) رأسيًّا
  await page.eval(`
    const ed = document.querySelector('[data-page-editor]');
    if (ed && typeof ed.__pmSelectCells === 'function') {
      ed.__pmSelectCells(0, 0, 1, 0);
      return true;
    }
    return false;
  `);
  await wait(400);

  const hasMergeBtn = await page.eval(`return Boolean(document.querySelector('[data-act="merge"]'));`);
  ok('زرّ دمج الخلايا ظاهر في شريط التنسيق', hasMergeBtn);

  // ٤. النقر على زر «ادمج»
  await click('[data-act="merge"]');
  await wait(500);

  // ٥. التحقق من ظهور rowspan="2" في الخلية الأولى
  const r0c0Span = await page.eval(`return ${T}.rows[0].cells[0].getAttribute('rowspan') || String(${T}.rows[0].cells[0].rowSpan);`);
  ok('الخلية الأولى أخذت خاصية rowspan="2"', r0c0Span === '2');

  // ٦. التحقق من أن الصف الثاني أصبح خليتين فقط لأن الأولى ممتدة من الصف الأول
  const r1CellsCount = await page.eval(`return ${T}.rows[1].cells.length;`);
  ok('الصف الثاني يحوي خليتين فقط لامتداد الخلية الرأسية فيه', r1CellsCount === 2);

  // ٧. كتابة نص داخل الخلية المدمجة رأسيًّا
  await page.eval(`
    const p = ${T}.rows[0].cells[0].querySelector('p');
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
  await wait(200);
  await page.send('Input.insertText', { text: 'ملاحظات مشتركة' });
  await wait(400);

  const cellText = await page.eval(`return ${T}.rows[0].cells[0].innerText.trim();`);
  ok('كُتب النص داخل الخلية المدمجة رأسيًّا («ملاحظات مشتركة»)', cellText.includes('ملاحظات مشتركة'));

  // ٨. فكّ الدمج عبر زر «افصل الخليّة»
  await click('[data-act="split"]');
  await wait(500);

  const afterSplitSpan = await page.eval(`return ${T}.rows[0].cells[0].getAttribute('rowspan') || '1';`);
  const r1AfterSplit = await page.eval(`return ${T}.rows[1].cells.length;`);
  ok('فكّ الدمج يعيد الخلية إلى صفّ واحد ويعيد خلايا الصف الثاني إلى ٣', afterSplitSpan === '1' && r1AfterSplit === 3);

  // ٩. إعادة الدمج الرأسي مرة أخرى للتأكيد على الثبات
  await page.eval(`
    const ed = document.querySelector('[data-page-editor]');
    ed.__pmSelectCells(0, 0, 1, 0);
    return true;
  `);
  await wait(400);
  await click('[data-act="merge"]');
  await wait(500);

  const reMergedSpan = await page.eval(`return ${T}.rows[0].cells[0].getAttribute('rowspan') || String(${T}.rows[0].cells[0].rowSpan);`);
  ok('إعادة الدمج الرأسي تنجح مجددًا وتُثبت rowspan="2"', reMergedSpan === '2');

  return steps;
}
