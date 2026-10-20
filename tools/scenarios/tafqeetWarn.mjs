/**
 * سيناريو: التحقّق من المبلغ الغامض مثل «٢٥.٠٠٠» وتنبيهه في الشبّاك (D119 — S07).
 *
 * يتحقّق من:
 * ١ — فتح نموذج في الشبّاك يحوي حقل مبلغ وحقل تفقيط.
 * ٢ — إدخال مبلغ غامض «25.000» بنقطة وثلاثة أصفار.
 * ٣ — التحقّق من ظهور التنبيه الإرشادي الهادئ تحت الحقل: «المبلغ غامض: إن كان بالآلاف فاكتبه بالفاصلة (25,000) أو صريحًا (25000)».
 * ٤ — تصحيح المبلغ إلى «25,000» والتحقّق من اختفاء التنبيه وظهور التفقيط الصحيح في المعاينة.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ١. تجهيز نموذج وصل إيجار فيه حقل مبلغ
  await page.eval(`
    await window.diwan.templates.save({
      id: null,
      code: null,
      title: 'وصل استلام بدل الإيجار',
      subtitle: 'عقارات',
      category: 'عقود',
      subjectLine: 'م/ وصل بدل إيجار',
      letterheadId: null,
      bodyHtml: 'استلمنا من المستأجر بدل الإيجار البالغ {المبلغ} دينار فقط ({المبلغ_كتابة}).',
      variables: [
        { token: 'المبلغ', label: 'مبلغ الإيجار رقماً', source: 'text', required: true },
        { token: 'المبلغ_كتابة', label: 'مبلغ الإيجار كتابة', source: 'text', required: false }
      ]
    });
    return true;
  `);

  // ٢. فتح الشبّاك واختيار النموذج
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(800);

  // اختيار النموذج
  await page.eval(`
    const input = document.querySelector('[data-screen="service"] input[data-counter-search]');
    if (input) {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'بدل الإيجار');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(500);
  await page.key('Enter');
  await wait(500);
  await page.key('Enter');
  await wait(600);

  // ٣. كتابة مبلغ غامض «25.000» في حقل المبلغ
  await page.eval(`
    const input = document.querySelector('[data-fill-form] input');
    if (input) {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '25.000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(500);

  // التحقّق من ظهور التنبيه الإرشادي
  const hintText = await page.eval(`
    const hint = document.querySelector('[data-field-hint="المبلغ"]');
    return hint?.innerText ?? '';
  `);
  ok('ظهور تنبيه إرشادي عند إدخال مبلغ غامض «25.000»', hintText.includes('المبلغ غامض') && hintText.includes('25,000'));

  // ٤. تصحيح المبلغ إلى «25,000»
  await page.eval(`
    const input = document.querySelector('[data-fill-form] input');
    if (input) {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '25,000');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(600);

  // التحقّق من اختفاء التنبيه
  const correctedHint = await page.eval(`
    const hint = document.querySelector('[data-field-hint="المبلغ"]');
    return hint?.innerText ?? null;
  `);
  ok('اختفاء التنبيه الإرشادي بعد تصحيح المبلغ إلى «25,000»', correctedHint === null);

  // التحقّق من ظهور التفقيط في المعاينة الحية
  const previewText = await page.eval(`
    const preview = document.querySelector('[data-screen="service"] [data-body]');
    return preview?.innerText ?? '';
  `);
  ok('ظهور التفقيط المالي الصحيح بالدينار في المعاينة', previewText.includes('خمسة وعشرون ألف دينار'));

  return steps;
}
