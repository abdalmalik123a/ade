/**
 * سيناريو: ورقة الأسئلة بالوجهين وترقيم «الصفحة ١ من ٢» (S14 · D130).
 *
 * يفتح «الأسئلة»، ويملأ بيانات الرأس الثابت، ويفعّل خيار «طباعة بوجهين»
 * ويضيف أسئلة كافية للانقسام إلى صفحتين، ثم يتحقق من:
 * ١. انقسام الورقة إلى وجهين (صفحتين A4).
 * ٢. ظهور ترقيم «الصفحة ١ من ٢» في تذييل الوجه الأول مع عبارة «اقلب الصفحة / يُتبع».
 * ٣. ظهور ترقيم «الصفحة ٢ من ٢» في تذييل الوجه الثاني مع عنوان المتابعة «تابع أسئلة...».
 * ٤. أزرار تبديل العرض (الوجه الأول، الوجه الثاني، الصفحات المتتابعة) وتجاوب المعاينة معها.
 */
import { join } from 'node:path';

export default async function scenario(page, { shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const head = (key, value) => page.type(`input[data-head="${key}"]`, value);

  const question = async (n, text) => {
    const ok = await page.eval(`
      const boxes = [...document.querySelectorAll('textarea[data-question-text]')];
      const el = boxes[${n}];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(text)});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return ok;
  };

  const score = async (n, value) => {
    const ok = await page.eval(`
      const boxes = [...document.querySelectorAll('input[title="درجة السؤال"]')];
      const el = boxes[${n}];
      if (!el) return false;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, ${JSON.stringify(String(value))});
      el.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    `);
    await wait(200);
    return ok;
  };

  const click = async (selector) => {
    await page.eval(`
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) throw new Error('not found: ' + ${JSON.stringify(selector)});
      el.click();
      return true;
    `);
    await wait(400);
  };

  // ١. الانتقال إلى شاشة الأسئلة
  await page.goto('exam-papers');
  await wait(700);

  // ٢. ملء الرأس
  await head('المحافظة', 'بغداد / الرصافة الأولى');
  await head('المدرسة', 'ثانوية المتميزين');
  await head('المادة', 'الفيزياء');
  await head('الصف', 'السادس العلمي');
  await head('نوع الامتحان', 'النهائي');
  await wait(400);

  // في البداية: ورقة واحدة فقط
  const singleSheetCount = await page.eval(`return document.querySelectorAll('[data-sheet-page]').length;`);
  ok('البداية ورقة صفحة واحدة', singleSheetCount === 1);

  // خيار «طباعة بوجهين» موجود
  const hasDuplexOption = await page.eval(`return Boolean(document.querySelector('input[data-act="duplex"]'));`);
  ok('خيار «طباعة بوجهين» متاح في شريط المعاينة', hasDuplexOption);

  // ٣. تفعيل خيار «طباعة بوجهين» وإضافة سؤال ثانٍ
  await click('input[data-act="duplex"]');
  await wait(400);

  await page.clickText('أضف سؤالًا');
  await wait(400);

  await score(0, 50);
  await question(0, 'السؤال الأول: اشرح ظاهرة الحث الكهرومغناطيسي.');

  await score(1, 50);
  await question(1, 'السؤال الثاني: ما هي تطبيقات الخلايا الكهروضوئية؟');
  await wait(500);

  // ٤. التحقق من ظهور الوجهين
  const sheetPages = await page.eval(`return document.querySelectorAll('[data-sheet-page]').length;`);
  ok('المعاينة تعرض وجهين (صفحتين)', sheetPages === 2);

  const page1Footer = await page.eval(`return document.querySelector('[data-paper-page-footer="1"]')?.innerText ?? '';`);
  ok('تذييل الوجه الأول يحتوي «الصفحة ١ من ٢»', page1Footer.includes('الصفحة ١ من ٢'));
  ok('تذييل الوجه الأول يحتوي «اقلب الصفحة / يُتبع»', page1Footer.includes('اقلب الصفحة / يُتبع'));

  const page2Header = await page.eval(`return document.querySelector('[data-paper-page-header="2"]')?.innerText ?? '';`);
  ok('رأس الوجه الثاني يحتوي عنوان المتابعة («الفيزياء — النهائي — الوجه الثاني»)', page2Header.includes('الفيزياء') && page2Header.includes('الوجه الثاني'));

  const page2Footer = await page.eval(`return document.querySelector('[data-paper-page-footer="2"]')?.innerText ?? '';`);
  ok('تذييل الوجه الثاني يحتوي «الصفحة ٢ من ٢»', page2Footer.includes('الصفحة ٢ من ٢'));

  // ٥. التحقق من أزرار تبديل المعاينة (الوجه الأول، الوجه الثاني، الصفحات المتتابعة)
  const hasPagesView = await page.eval(`return Boolean(document.querySelector('[data-pages-view]'));`);
  ok('أزرار تبديل عرض الصفحات ظاهرة في الشريط', hasPagesView);

  // تبديل إلى «الوجه الأول»
  await click('button[data-page-view="1"]');
  await wait(300);
  const onlyP1 = await page.eval(`
    const p1 = Boolean(document.querySelector('[data-sheet-page="1"]'));
    const p2 = Boolean(document.querySelector('[data-sheet-page="2"]'));
    return p1 && !p2;
  `);
  ok('اختيار «الوجه الأول» يُظهر الصفحة الأولى وحدها', onlyP1);

  // تبديل إلى «الوجه الثاني»
  await click('button[data-page-view="2"]');
  await wait(300);
  const onlyP2 = await page.eval(`
    const p1 = Boolean(document.querySelector('[data-sheet-page="1"]'));
    const p2 = Boolean(document.querySelector('[data-sheet-page="2"]'));
    return !p1 && p2;
  `);
  ok('اختيار «الوجه الثاني» يُظهر الصفحة الثانية وحدها', onlyP2);

  // إعادة العرض إلى «الصفحات المتتابعة»
  await click('button[data-page-view="all"]');
  await wait(300);
  const bothPages = await page.eval(`
    const p1 = Boolean(document.querySelector('[data-sheet-page="1"]'));
    const p2 = Boolean(document.querySelector('[data-sheet-page="2"]'));
    return p1 && p2;
  `);
  ok('اختيار «الصفحات المتتابعة» يعيد عرض الوجهين معًا', bothPages);

  if (shotsDir) await page.shot(join(shotsDir, 'exam-duplex.png'));

  return steps;
}
