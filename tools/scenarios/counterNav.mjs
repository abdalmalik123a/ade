/**
 * سيناريو: اختصارات التنقل Tab وEnter في الشبّاك وحصر Tab داخل الورقة (D117 — S04).
 *
 * يتحقّق من:
 * ١ — اختيار النموذج بالضغط على Enter في حقل البحث، والانتقال إلى «املأ» بـEnter.
 * ٢ — اختيار الزبون من نافذة «هات الزبون» بالضغط على Enter في حقل بحثها مباشرة.
 * ٣ — حصر مفتاح Tab داخل حاوية ورقة الإدخال بحيث يدور من الأخير إلى الأول بلا ضياع التركيز إلى أشرطة التطبيق.
 * ٤ — تدوير Shift+Tab من العنصر الأول إلى العنصر الأخير داخل الورقة.
 * و(D138) بضغطات Tab حقيقية (`Input.dispatchKeyEvent`) لا بحدثٍ من داخل الصفحة: تبلغ «راجع الأوراق» في شريط القرار ولا تخرج من الشاشة —
 * كانت ٤٥ ضغطة تدور بين حقول الورقة وحدها — ثم Enter عليه ← خطوة المراجعة، وفيها تبلغ «اطبع» كذلك.
 * و(D140) قبلها: Enter على «هات الزبون» يفتحها والتركيز في بحثها، فعشر ضغطات Tab وعشر Shift+Tab حقيقية لا تخرج منها — كانت ضغطتان تخرجان
 * إلى الشريط العلوي والسكّة والنافذة باقية — ثم Esc يغلقها ويعود التركيز إلى «هات الزبون».
 */
const TAB = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 };
const ENTER = { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
const ESC = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
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

  // ٥. حصر Tab (D138): الورقة وشريط القرار معًا، بضغطاتٍ حقيقية — ولا خروج إلى السكّة أو الشريط العلوي.
  /** ضغطة Tab (أو Shift+Tab) من خارج الصفحة كما يضغطها الموظف — ويعيد أين صار التركيز. */
  const tab = async (shift = false) => {
    const modifiers = shift ? 8 : 0;
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...TAB, modifiers });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...TAB, modifiers });
    await wait(60);
    return page.eval(`
      const el = document.activeElement;
      return {
        inScreen: Boolean(el && el !== document.body && el.closest('[data-screen="service"]')),
        inForm: Boolean(el && el.closest('[data-fill-form]')),
        inDialog: Boolean(el && el.closest('[role="dialog"]')),
        text: (el?.innerText || el?.getAttribute('aria-label') || el?.tagName || '').trim().slice(0, 40)
      };
    `);
  };
  /** Enter يضغط الزرّ كما يُضغط (keyDown بحرفه لا rawKeyDown). */
  const enter = async () => {
    await page.send('Input.dispatchKeyEvent', { type: 'keyDown', ...ENTER, text: '\r', unmodifiedText: '\r' });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ENTER });
  };

  // (D140) «هات الزبون» بلوحة المفاتيح: Tab يدور فيها ولا يخرج، وEsc يغلقها ويعيد التركيز إلى زرّها.
  await page.eval(`document.querySelector('[data-screen="service"] [data-act="pick-customer"]')?.focus(); return true;`);
  await enter();
  await wait(700);
  const opened = await page.eval(`
    const d = document.querySelector('[role="dialog"]');
    return Boolean(d && d.contains(document.activeElement) && document.activeElement.type === 'search');
  `);
  ok('(D140) Enter على «هات الزبون» يفتحها والتركيز في بحثها', opened);
  const inPicker = [];
  for (let i = 0; i < 10; i++) inPicker.push(await tab());
  for (let i = 0; i < 10; i++) inPicker.push(await tab(true));
  const escaped = inPicker.find((s) => !s.inDialog);
  ok(
    `(D140) ١٠ ضغطات Tab و١٠ Shift+Tab في «هات الزبون» تدور على (${[...new Set(inPicker.map((s) => s.text))].join('، ')}) ولا تخرج منها${escaped ? ` — خرجت إلى «${escaped.text}»` : ''}`,
    opened && !escaped
  );
  await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...ESC });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...ESC });
  await wait(500);
  const afterEsc = await page.eval(`
    const el = document.activeElement;
    return { open: Boolean(document.querySelector('[role="dialog"]')), back: el?.getAttribute('data-act') || el?.tagName || null };
  `);
  ok(`(D140) Esc يغلقها (${afterEsc.open ? 'باقية' : 'أُغلقت'}) ويعود التركيز إلى «هات الزبون» (${afterEsc.back})`, !afterEsc.open && afterEsc.back === 'pick-customer');

  /** ٤٥ ضغطة كتجربة المراجعة — ويعيد ما مرّت به. */
  const walk = async () => {
    const seen = [];
    for (let i = 0; i < 45; i++) seen.push(await tab());
    return seen;
  };
  const focusFirst = () => page.eval(`
    document.querySelector('[data-screen="service"] [data-fill-form] :is(button, input, textarea, select):not([disabled])')?.focus();
    return Boolean(document.activeElement?.closest('[data-fill-form]'));
  `);
  await focusFirst();
  const fill = await walk();
  const review = fill.findIndex((s) => s.text === 'راجع الأوراق');
  const out = fill.find((s) => !s.inScreen);
  ok(`(D138) ٤٥ ضغطة Tab في «املأ» تبلغ «راجع الأوراق» (${review >= 0 ? `الضغطة ${review + 1}` : 'لم تبلغه'}) ولا تخرج من الشاشة${out ? ` — خرجت إلى «${out.text}»` : ''}`, review >= 0 && !out);
  ok('(D138) وبعد «راجع الأوراق» تعود إلى أوّل الورقة', review >= 0 && review + 1 < fill.length && fill[review + 1].inForm);
  await focusFirst();
  const back = await tab(true);
  ok(`(D138) Shift+Tab من أوّل الورقة ← «${back.text}» آخرَ الدورة`, back.text === 'راجع الأوراق');

  // Enter على «راجع الأوراق» يضغطه كما يُضغط الزرّ.
  await enter();
  await wait(800);
  const inReview = await page.eval(`
    return !document.querySelector('[data-fill-form]') && [...document.querySelectorAll('[data-screen="service"] button')].some((b) => b.innerText.trim().startsWith('اطبع'));
  `);
  ok('(D138) Enter على «راجع الأوراق» ← خطوة المراجعة', inReview);
  const rev = await walk();
  const print = rev.findIndex((s) => s.text.startsWith('اطبع'));
  const outRev = rev.find((s) => !s.inScreen);
  ok(`(D138) ٤٥ ضغطة Tab في «راجع» تبلغ «اطبع» (${print >= 0 ? `الضغطة ${print + 1}` : 'لم تبلغه'}) ولا تخرج من الشاشة${outRev ? ` — خرجت إلى «${outRev.text}»` : ''}`, print >= 0 && !outRev);

  return steps;
}
