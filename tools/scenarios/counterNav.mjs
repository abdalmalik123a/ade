/**
 * سيناريو: اختصارات التنقل Tab وEnter في الشبّاك وحصر Tab داخل الورقة (D117 — S04).
 *
 * يتحقّق من:
 * ١ — اختيار النموذج بالضغط على Enter في حقل البحث، والانتقال إلى «املأ» بـEnter.
 * ٢ — اختيار الزبون من نافذة «هات الزبون» بالضغط على Enter في حقل بحثها مباشرة.
 * ٣ — حصر مفتاح Tab داخل حاوية ورقة الإدخال بحيث يدور من الأخير إلى الأول بلا ضياع التركيز إلى أشرطة التطبيق.
 * ٤ — تدوير Shift+Tab من العنصر الأول إلى العنصر الأخير داخل الورقة.
 */
export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ١. تجهيز نموذج في المكتبة ومواطن في السجل
  await page.eval(`
    await window.diwan.templates.save({
      id: null,
      code: null,
      title: 'استمارة مباشرة عمل للموظف',
      subtitle: 'دائرة التربية',
      category: 'تربية',
      subjectLine: 'م/ مباشرة عمل',
      letterheadId: null,
      bodyHtml: 'نؤيد مباشرة الموظف {الاسم} في وظيفته اعتبارا من تاريخ انفكاكه.',
      variables: [
        { token: 'الاسم', label: 'اسم الموظف', source: 'fullName', required: true },
        { token: 'الوظيفة', label: 'العنوان الوظيفي', source: 'text', required: false }
      ]
    });
    await window.diwan.citizens.save({
      id: null,
      fullName: 'سالم حسن كاظم',
      gender: 'ذكر',
      verified: false
    });
    return true;
  `);

  // ٢. فتح الشبّاك
  await page.goto('templates-library-drafts');
  await wait(400);
  await page.goto('service-counter');
  await wait(800);

  // ٣. البحث عن النموذج والضغط على Enter لاختياره
  await page.eval(`
    const input = document.querySelector('[data-screen="service"] input[data-counter-search]');
    if (input) {
      input.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'مباشرة');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(600);

  // نضغط Enter في حقل البحث
  await page.eval(`
    const input = document.querySelector('[data-screen="service"] input[data-counter-search]');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  `);
  await wait(600);

  const text = await page.text();
  ok('الضغط على Enter في حقل البحث يختار أول نموذج مطابق', text.includes('املأ (1)'));

  // نضغط Enter ثانية للانتقال إلى «املأ»
  await page.key('Enter');
  await wait(700);

  const stepFill = await page.eval(`
    return Boolean(document.querySelector('[data-screen="service"] [data-fill-form]'));
  `);
  ok('الضغط على Enter بعد الاختيار ينقل إلى خطوة «املأ»', stepFill);

  // ٤. فتح «هات الزبون» والبحث عن سالم ثم الضغط على Enter
  await page.eval(`
    document.querySelector('[data-screen="service"] [data-act="pick-customer"]')?.click();
  `);
  await wait(700);

  await page.eval(`
    const modalInput = document.querySelector('div[role="dialog"] input[type="search"]');
    if (modalInput) {
      modalInput.focus();
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(modalInput, 'سالم');
      modalInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  `);
  await wait(800);

  // نضغط Enter داخل حقل بحث الزبائن
  await page.eval(`
    const modalInput = document.querySelector('div[role="dialog"] input[type="search"]');
    modalInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  `);
  await wait(800);

  const dialogGone = await page.eval(`return !document.querySelector('div[role="dialog"]');`);
  const pageText = await page.text();
  ok('الضغط على Enter في بحث «هات الزبون» يختار أول نتيجة ويملأ بياناته', dialogGone && pageText.includes('استُوردت بيانات المواطن'));

  // ٥. اختبار حصر مفتاح Tab داخل ورقة الإدخال (Focus Trap)
  const trapWorks = await page.eval(`
    const form = document.querySelector('[data-screen="service"] [data-fill-form]');
    if (!form) return false;
    const focusable = Array.from(
      form.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])')
    ).filter((el) => !el.hasAttribute('hidden') && el.style.display !== 'none');
    if (focusable.length < 2) return false;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    // تركيز على آخر عنصر ثم ضغط Tab
    last.focus();
    form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    const cycledToFirst = document.activeElement === first;

    // تركيز على أول عنصر ثم ضغط Shift+Tab
    first.focus();
    form.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    const cycledToLast = document.activeElement === last;

    return cycledToFirst && cycledToLast;
  `);
  ok('الضغط على Tab في آخر عنصر يدور إلى أول عنصر وShift+Tab يعكس ولا يخرج عن الورقة', trapWorks);

  return steps;
}
