/**
 * سيناريو: حاجز الأخطاء في الجذر (مراجعة ٧ ت١، ج٥).
 *
 * كانت حواجز الأخطاء حول الشاشات وحدها: فخطأٌ في رسم الشريط أو السكّة أو حوارٍ فوقها يُبيّض النافذة كلّها بلا كلمة. فصار حاجزٌ
 * حول الواجهة كلّها، بنافذةٍ كاملة وزرّ «أعد تحميل الواجهة» (لا إعادةَ المحاولة بحالتها، فهي تُعيد السقوط).
 *
 * والسقوط الحقيقي في الرسم لا يُصنع من خارج React بلا باب اختبارٍ في الإنتاج؛ فيُوضع الحاجز نفسه في حال السقوط (كما يضعه
 * React عند التقاط خطأ) من حاله الحقيقية في شجرة الواجهة، فيُفحص ما يعرضه وما يفعله زرّه.
 */
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);

  const sidebar = () => page.eval(`return Boolean(document.querySelector('[data-path]'));`);
  ok('الواجهة تعمل: السكّة ظاهرة', await sidebar());
  ok('ولا حاجز ساقط', !(await page.eval(`return Boolean(document.querySelector('[data-error-boundary]'));`)));

  // يُوضع حاجز الجذر الحقيقي في حال السقوط.
  const set = await page.eval(`
    const top = document.getElementById('root')?.firstElementChild;
    const key = top && Object.keys(top).find((k) => k.startsWith('__reactFiber$'));
    let fiber = key ? top[key] : null;
    while (fiber) {
      const inst = fiber.stateNode;
      if (inst && inst.props && inst.props.fullPage === true && typeof inst.setState === 'function') {
        inst.setState({ hasError: true, error: new Error('اختبار الحاجز'), errorInfo: null });
        return true;
      }
      fiber = fiber.return;
    }
    return false;
  `);
  ok('وُجد حاجز الجذر في شجرة الواجهة', set === true);
  await wait(500);

  const fallback = await page.eval(`
    const el = document.querySelector('[data-error-boundary="root"]');
    return el ? { text: el.innerText, full: getComputedStyle(el).position === 'fixed', reload: Boolean(el.querySelector('[data-act="reload-ui"]')) } : null;
  `);
  ok('يملأ النافذة بدل بياضٍ لا يقول شيئًا', Boolean(fallback) && fallback.full);
  ok('بعنوانه ومعه أنّ البيانات سليمة وما يُفعل', Boolean(fallback) && fallback.text.includes('تعذّر عرض ديوان') && fallback.text.includes('بياناتك سليمة') && fallback.text.includes('أعد تحميل الواجهة'));
  ok('وزرّ إعادة التحميل', Boolean(fallback?.reload));

  await page.eval(`document.querySelector('[data-error-boundary="root"] [data-act="reload-ui"]')?.click(); return true;`).catch(() => undefined);
  let back = false;
  for (let i = 0; i < 20 && !back; i++) {
    await wait(500);
    back = await sidebar().catch(() => false);
  }
  ok('والزرّ يعيد الواجهة تعمل', back && !(await page.eval(`return Boolean(document.querySelector('[data-error-boundary]'));`)));
  return steps.join('\n');
}
