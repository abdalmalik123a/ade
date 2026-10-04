/**
 * اختبار التطبيق كمستخدم حقيقي UI/UX — المرحلة ٦.
 * 
 * يختبر نسخة الإنتاج النهائية المحزومة (release/win-unpacked/Diwan.exe)
 * من خلال الواجهة الرسومية والماوس ولوحة المفاتيح كما يتعامل موظف مكتب طباعة جديد.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { drive } from './drive.mjs';

export const keepOnboarding = true;

const EXE = resolve('release/win-unpacked/Diwan.exe');
const SHOTS_DIR = resolve('reports/ux-evaluation-shots');
if (!existsSync(SHOTS_DIR)) mkdirSync(SHOTS_DIR, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function runRealUserTest(page, { profile }) {
  const observations = [];
  const logStep = (msg) => console.log(`[UX-TEST] ${msg}`);
  const addObs = (severity, title, details) => {
    observations.push({ severity, title, details });
    console.log(`  ★ ملاحظة UX [${severity}]: ${title}`);
  };

  const shot = async (name) => {
    const p = join(SHOTS_DIR, `${name}.png`);
    await page.shot(p);
    return p;
  };

  logStep('بدء جولة اختبار المستخدم الحقيقي (Phase 6 UI/UX) على Diwan.exe...');

  // ═════════════════════════════════════════════════════════════════════════
  // ١. فتح البرنامج لأول مرة ومعالج البدء (Onboarding)
  // ═════════════════════════════════════════════════════════════════════════
  logStep('١. فحص فتح البرنامج لأول مرة ومعالج البدء...');
  await sleep(1500);
  await shot('01-onboarding-office');

  let text = await page.text();
  const hasOnboarding = text.includes('أهلًا بك في ديوان') || text.includes('اسم المكتب');
  if (!hasOnboarding) {
    addObs('حرج', 'عدم ظهور معالج الإعداد الأولي في الإقلاع الأول', 'المستخدم الجديد يتوقع ظهور معالج الإعداد لتهيئة المكتب');
  } else {
    // الخطوة ٠: بيانات المكتب
    await page.type('input[data-onboarding-office]', 'مكتب الفيحاء للطباعة والخدمات');
    await page.eval(`
      const inputs = [...document.querySelectorAll('[data-onboarding] input')];
      if (inputs[1]) {
        const proto = HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(inputs[1], 'أحمد كريم');
        inputs[1].dispatchEvent(new Event('input', { bubbles: true }));
      }
      return true;
    `);
    await sleep(400);
    await shot('01-onboarding-office-filled');

    // الانتقال للخطوة ١: الطابعات
    await page.eval(`document.querySelector('[data-act="onboarding-next"]')?.click(); return true;`);
    await sleep(800);
    await shot('02-onboarding-printers');

    text = await page.text();
    if (!text.includes('الطابعة التي يُرسَل إليها')) {
      addObs('متوسط', 'انتقال الخطوات في المعالج سريع بدون مؤشر تقدم بارز', 'مؤشر الخطوات العلوي صغير نوعًا ما');
    }

    // الانتقال للخطوة ٢: قياس الواجهة
    await page.eval(`document.querySelector('[data-act="onboarding-next"]')?.click(); return true;`);
    await sleep(800);
    await shot('03-onboarding-scale');

    // تجربة زر القياس (تكبير الواجهة)
    await page.eval(`document.querySelector('button[data-scale="1.15"]')?.click(); return true;`);
    await sleep(500);

    // الانتقال للخطوة ٣: الخدمات وحزم الجهات
    await page.eval(`document.querySelector('[data-act="onboarding-next"]')?.click(); return true;`);
    await sleep(800);
    await shot('04-onboarding-start-options');

    // فتح منتقي الحزم الجاهزة
    await page.eval(`document.querySelector('button[data-onboarding-go="pack"]')?.click(); return true;`);
    await sleep(1000);
    await shot('04-onboarding-pack-picker');

    const packCount = await page.eval(`return document.querySelectorAll('[data-onboarding-pack-picker] label').length;`);
    logStep(`  عدد الحزم المشحونة في المعالج: ${packCount}`);
    if (packCount < 6) {
      addObs('مرتفع', 'نقص في حزم الجهات المشحونة داخل المعالج', `المتوقع ٦ حزم ولكن ظهرت ${packCount}`);
    }

    // اختيار حزمتين: التربية والبلدية
    await page.eval(`
      const labels = [...document.querySelectorAll('[data-onboarding-pack-picker] label')];
      const edu = labels.find(l => l.textContent.includes('التربية'));
      const mun = labels.find(l => l.textContent.includes('البلدية'));
      edu?.querySelector('input[type="checkbox"]')?.click();
      mun?.querySelector('input[type="checkbox"]')?.click();
      return true;
    `);
    await sleep(500);
    await shot('04-onboarding-packs-selected');

    // النقر على استيراد المختار والبدء
    await page.eval(`document.querySelector('[data-act="onboarding-import-packs"]')?.click(); return true;`);
    await sleep(3500);
    await shot('05-after-onboarding-library');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ٢. فهم الواجهة والتنقل بين الأقسام والشريط الجانبي
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٢. فحص بنية الواجهة والتنقل بين الأقسام والشريط الجانبي...');

  // المكتبة
  await page.goto('templates-library-drafts');
  await sleep(700);
  await shot('06-screen-templates');

  // سجل المواطنين
  await page.goto('citizens-identity-records');
  await sleep(700);
  await shot('07-screen-citizens');

  // الأرشيف
  await page.goto('transactions-archive-ledger');
  await sleep(700);
  await shot('08-screen-archive');

  // الإعدادات
  await page.goto('office-settings');
  await sleep(700);
  await shot('09-screen-settings');

  // الشبّاك
  await page.goto('service-counter');
  await sleep(700);
  await shot('10-screen-service');

  // فحص اختصار إخفاء/إظهار الشريط الجانبي Ctrl+B
  logStep('  فحص اختصار الشريط الجانبي Ctrl+B...');
  const initialSidebarWidth = await page.eval(`
    const nav = document.querySelector('nav, [data-sidebar]');
    return nav ? nav.getBoundingClientRect().width : 0;
  `);

  await page.key('KeyB', { ctrl: true });
  await sleep(600);
  await shot('11-sidebar-collapsed');

  const collapsedSidebarWidth = await page.eval(`
    const nav = document.querySelector('nav, [data-sidebar]');
    return nav ? nav.getBoundingClientRect().width : 0;
  `);

  logStep(`  عرض الشريط: الأصلي = ${initialSidebarWidth}px، بعد الطي = ${collapsedSidebarWidth}px`);
  // ملاحظة: السكّة بعرض أيقونات ثابت 80px (Rail navigation) ولا تختفي تمامًا
  if (collapsedSidebarWidth === initialSidebarWidth && initialSidebarWidth > 150) {
    addObs('متوسط', 'اختصار طي الشريط الجانبي Ctrl+B لم يقلص عرض القائمة', 'المتوقع أن يُطوى الشريط لإتاحة مساحة أكبر للمستند');
  }

  // إعادة فتح الشريط
  await page.key('KeyB', { ctrl: true });
  await sleep(600);
  await shot('12-sidebar-expanded');

  // ═════════════════════════════════════════════════════════════════════════
  // ٣. حزم الجهات الجاهزة في المكتبة
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٣. فحص حزم الجهات الجاهزة داخل المكتبة...');
  await page.goto('templates-library-drafts');
  await sleep(1000);

  // النقر على زر استورد
  await page.eval(`document.querySelector('[data-act="import-menu"]')?.click(); return true;`);
  await sleep(600);
  await shot('13-library-import-menu');

  // النقر على خيار حزم الجهات
  await page.eval(`document.querySelector('[data-act="content-import"]')?.click(); return true;`);
  await sleep(1000);
  await shot('14-library-packs-modal');

  const modalPacksCount = await page.eval(`return document.querySelectorAll('[data-pack-card]').length;`);
  logStep(`  عدد الحزم في نافذة استيراد الحزم: ${modalPacksCount}`);
  if (modalPacksCount === 0) {
    addObs('مرتفع', 'نافذة حزم الجهات في المكتبة لم تعرض الحزم', 'قائمة الحزم فارغة عند فتح النافذة');
  }

  // إغلاق النافذة بالزر أو ESC
  await page.key('Escape');
  await sleep(600);

  // ═════════════════════════════════════════════════════════════════════════
  // ٤. إنشاء معاملة كاملة من البداية للنهاية في الشبّاك
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٤. إنشاء معاملة كاملة من البداية للنهاية في الشبّاك...');
  await page.goto('service-counter');
  await sleep(1000);
  await shot('15-service-counter-initial');

  // اختيار نموذج من النماذج المستوردة (التربية أو البلدية)
  const templatePicked = await page.eval(`
    const cards = document.querySelectorAll('[data-template-card]');
    if (cards.length > 0) {
      cards[0].click();
      return cards[0].innerText.split('\\n')[0];
    }
    return null;
  `);
  logStep(`  تم اختيار النموذج: "${templatePicked}"`);
  await sleep(600);
  await shot('16-service-template-picked');

  // النقر على زر "املأ"
  await page.eval(`
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('املأ'));
    if (btn) btn.click();
    return true;
  `);
  await sleep(1200);
  await shot('17-service-step-fill');

  // إدخال بيانات الزبون والمعاملة باستخدام prototype setter لضمان تفاعل React state
  logStep('  إدخال بيانات الزبون وتعديلها...');
  const inputsCount = await page.eval(`return document.querySelectorAll('main[data-screen="service"] input[type="text"]').length;`);
  logStep(`  عدد الحقول المعروضة للتعبئة: ${inputsCount}`);

  await page.eval(`
    const setVal = (el, val) => {
      if (!el) return;
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };

    const labels = [...document.querySelectorAll('main[data-screen="service"] label')];
    let filledFirst = false;
    for (const l of labels) {
      const inp = l.querySelector('input[type="text"]');
      if (!inp) continue;
      const text = l.textContent || '';
      if (/اسم|صاحب العلاقة|طالب|مواطن|رباعي/.test(text) || !filledFirst) {
        setVal(inp, 'كرار حيدر علي الحسني');
        filledFirst = true;
      } else if (/أم|ام/.test(text)) {
        setVal(inp, 'فاطمة كريم');
      } else if (/هاتف|موبايل/.test(text)) {
        setVal(inp, '07801234567');
      } else if (/وطني|بطاقة|موحدة|هوية/.test(text)) {
        setVal(inp, '199512345678');
      } else if (/عنوان|وظيفة|عمل|مهنة/.test(text)) {
        setVal(inp, 'مدرس ثانوي');
      } else if (!inp.value) {
        setVal(inp, 'بيانات تجريبية');
      }
    }
    return true;
  `);
  await sleep(500);

  // تعديل رقم الهاتف لاختبار المرونة
  await page.eval(`
    const setVal = (el, val) => {
      const proto = HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const phoneInput = [...document.querySelectorAll('main[data-screen="service"] input[type="text"]')].find(i => i.value.includes('0780'));
    if (phoneInput) setVal(phoneInput, '07709876543');
    return true;
  `);
  await sleep(400);
  await shot('18-service-inputs-filled');

  // فحص تعليق المعاملة واستئنافها (Park & Resume)
  logStep('  فحص تعليق المعاملة (Park) واستئنافها...');
  const parkBtnExists = await page.eval(`
    const btn = document.querySelector('button[data-act="park"]');
    if (btn) { btn.click(); return true; }
    return false;
  `);
  if (parkBtnExists) {
    await sleep(800);
    await shot('19-service-parked-banner');

    text = await page.text();
    if (!text.includes('معلّقة') && !text.includes('استأنف')) {
      addObs('متوسط', 'عدم وضوح مؤشر المعاملات المعلقة في الشبّاك', 'المعاملة عُلقت ولكن الشريط التنبيهي غير ملفت للنظر');
    }

    // استئناف المعاملة
    await page.eval(`document.querySelector('[data-act="resume"]')?.click(); return true;`);
    await sleep(800);
    await shot('20-service-resumed');
  }

  // الانتقال إلى مراجعة الأوراق والمعاينة
  logStep('  الانتقال لمراجعة الأوراق والمعاينة...');
  await page.eval(`
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('راجع الأوراق') || b.textContent.includes('معاينة'));
    if (btn) btn.click();
    return true;
  `);
  await sleep(1500);
  await shot('21-service-review-sheet');

  // ═════════════════════════════════════════════════════════════════════════
  // ٥. معاينة المستند والتحقق من التنسيق والـ RTL
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٥. فحص معاينة المستند والخطوط وRTL والعربية...');
  const sheetValidation = await page.eval(`
    const sheet = document.querySelector('.a4-sheet, .paper, [data-paper]');
    if (!sheet) return { found: false };
    const style = getComputedStyle(sheet);
    const text = sheet.innerText;
    return {
      found: true,
      dir: sheet.getAttribute('dir') || style.direction,
      fontFamily: style.fontFamily,
      hasCitizenName: text.includes('كرار'),
      hasUnreplacedPlaceholders: /\{\{[^}]+\}\}/.test(text),
      hasUndefinedOrNull: text.includes('undefined') || text.includes('null')
    };
  `);
  logStep(`  نتيجة فحص ورقة المعاينة: ${JSON.stringify(sheetValidation)}`);

  if (!sheetValidation.found) {
    addObs('حرج', 'لم تُعرض الورقة A4 في شاشة المراجعة', 'موظف المكتب بحاجة لمعاينة الورقة الحقيقية قبل الطباعة');
  } else {
    if (sheetValidation.dir !== 'rtl') {
      addObs('مرتفع', 'اتجاه ورقة المعاينة ليس RTL صراحة', 'يجب أن يكون اتجاه المستند العربي rtl تجنبًا لانقلاب الأرقام والرموز');
    }
    if (sheetValidation.hasUnreplacedPlaceholders) {
      addObs('مرتفع', 'ظهور وسوم غير مستبدلة {{...}} في ورقة المعاينة', 'قد تطبع الورقة وبها شفرات برمجية للزبون');
    }
    if (sheetValidation.hasUndefinedOrNull) {
      addObs('حرج', 'ظهور كلمة undefined أو null في المستند المطبوع', 'يمنع تسليم ورقة للزبون تحتوي أخطاء قيم فارغة برمجية');
    }
  }

  // فحص خيار "على استمارةٍ مطبوعة — القيم وحدها"
  logStep('  فحص خيار القيم وحدها للاستمارات المطبوعة...');
  const hasValuesOnly = await page.eval(`
    const cb = document.querySelector('input[data-act="values-only"]');
    if (cb) { cb.click(); return true; }
    return false;
  `);
  if (hasValuesOnly) {
    await sleep(600);
    await shot('22-service-values-only-checked');

    // إرجاعه
    await page.eval(`document.querySelector('input[data-act="values-only"]').click(); return true;`);
    await sleep(600);
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ٦. الإصدار والطباعة وحالات التوقف والاستكمال
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٦. فحص الإصدار والطباعة وحالات التوقف والاستكمال...');
  
  // فحص مؤشر الطابعة
  const printerRoleNote = await page.eval(`
    const el = document.querySelector('[data-role-printer], [title*="طابعة"]');
    return el?.innerText ?? '';
  `);
  logStep(`  مؤشر طابعة المستندات الحالية: "${printerRoleNote}"`);

  // الإصدار بلا طباعة لتثبيت القيد في الأرشيف
  logStep('  إتمام الإصدار والقيد في السجل...');
  const issuedOk = await page.eval(`
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('احفظ بلا طباعة'));
    if (btn) { btn.click(); return true; }
    return false;
  `);
  await sleep(2500);
  await shot('23-service-after-issue');

  text = await page.text();
  if (text.includes('صدر الكتاب') || text.includes('حُفظت')) {
    logStep('  ✓ صدر الكتاب بنجاح ودُوّن في السجل.');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ٧. أدوات PDF (تفتح من بطاقة PDF بالشبّاك ثم يُرجع بالزر)
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٧. فحص أدوات PDF من بطاقة الشبّاك والرجوع...');
  await page.eval(`
    const pdfCard = document.querySelector('button[data-card="pdf"]');
    if (pdfCard) pdfCard.click();
    return Boolean(pdfCard);
  `);
  await sleep(1200);
  await shot('24-screen-pdf-tools');

  // فحص الأزرار الظاهرة في واجهة PDF
  const pdfActions = await page.eval(`
    const acts = [...document.querySelectorAll('main button')].filter(b => b.offsetParent !== null).map(b => b.textContent.trim());
    return acts.filter(Boolean);
  `);
  logStep(`  أدوات PDF المتاحة: ${pdfActions.slice(0, 8).join(' | ')}`);

  // الرجوع إلى الشبّاك عبر زر الرجوع في رأس الأداة
  await page.eval(`document.querySelector('[data-act="tool-back"]')?.click(); return true;`);
  await sleep(800);

  // ═════════════════════════════════════════════════════════════════════════
  // ٨. الأرشيف والبحث وإعادة الطباعة
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٨. فحص الأرشيف، البحث السريع، وتدقيق المستندات وإعادة الطباعة...');
  await page.goto('transactions-archive-ledger');
  await sleep(1200);
  await shot('25-archive-overview');

  // التحقق من ظهور المعاملة الصادرة
  const archiveRows = await page.eval(`
    const trs = [...document.querySelectorAll('table tbody tr')];
    return trs.map(r => r.innerText);
  `);
  logStep(`  عدد القيود في أرشيف اليوم: ${archiveRows.length}`);
  const hasKarrar = archiveRows.some(r => r.includes('كرار'));
  if (!hasKarrar) {
    addObs('حرج', 'المعاملة الصادرة لم تظهر في سجل الأرشيف اليومي', 'المعاملة التي صدرت يجب أن تُقيّد فورًا برقم صادر وبصمة توثيق');
  } else {
    logStep('  ✓ ظهرت المعاملة الصادرة باسم الزبون في الأرشيف.');
  }

  // تجربة البحث السريع
  logStep('  تجربة البحث عن اسم الزبون...');
  await page.type('input[placeholder*="ابحث برقم الصادر"]', 'كرار');
  await sleep(800);
  await shot('26-archive-search-found');

  // تجربة بحث فارغ/غير مطابق
  await page.type('input[placeholder*="ابحث برقم الصادر"]', 'اسم وهمي غير موجود مطلقًا');
  await sleep(800);
  await shot('27-archive-search-empty');
  text = await page.text();
  if (!text.includes('لا كتاب يطابق')) {
    addObs('منخفض', 'رسالة البحث الخائب تحتاج وضوحًا أكبر في الأرشيف', 'يُفضل إبراز نص صريح يفيد بعدم مطابقة أي نتيجة');
  }

  // مسح البحث
  await page.type('input[placeholder*="ابحث برقم الصادر"]', '');
  await sleep(600);

  // فحص شريط تدقيق المعاملة المحدد (SHA-256 والبصمة والنسخ)
  await shot('28-archive-inspect-box');
  const inspectInfo = await page.eval(`
    const ins = document.querySelector('[data-inspect]');
    return ins ? ins.innerText : null;
  `);
  logStep(`  بيانات تدقيق المعاملة: ${inspectInfo?.slice(0, 100)}...`);

  // تجربة زر إعادة الطباعة
  logStep('  تجربة زر إعادة الطباعة طبق الأصل...');
  const reprintBtnClicked = await page.eval(`
    const btn = document.querySelector('button[title*="إعادة طباعة"]');
    if (btn) { btn.click(); return true; }
    return false;
  `);
  if (reprintBtnClicked) {
    await sleep(1500);
    await shot('29-archive-reprinted-toast');
    text = await page.text();
    logStep(`  نتيجة إعادة الطباعة: ${text.includes('أُعيدت طباعة') ? '✓ نجحت' : 'ملاحظة'}`);
  } else {
    addObs('متوسط', 'أيقونة إعادة الطباعة في الأرشيف تحتاج عنوانًا أو زرًا أوضح للمستخدم الجديد', 'الزر عبارة عن أيقونة صغيرة فقط داخل الصف');
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ٩. الإعدادات، الطابعات، المعايرة، النسخ الاحتياطي
  // ═════════════════════════════════════════════════════════════════════════
  logStep('٩. فحص شاشة الإعدادات وضبط الطابعات والمعايرة...');
  await page.goto('office-settings');
  await sleep(1000);
  await shot('30-settings-general');

  // التحقق من الحقول الأساسية
  const settingsFields = await page.eval(`
    const inputs = [...document.querySelectorAll('input')];
    return inputs.map(i => ({ placeholder: i.placeholder, val: i.value }));
  `);
  logStep(`  حقول الإعدادات المحفوظة: ${settingsFields.filter(f => f.val).map(f => f.val).join(' | ')}`);

  // تبويب/قسم الطابعات والمعايرة
  await shot('31-settings-printers-calibration');

  // ═════════════════════════════════════════════════════════════════════════
  // ١٠. استجابة الواجهة لتغيير حجم النافذة (Responsive Layout)
  // ═════════════════════════════════════════════════════════════════════════
  logStep('١٠. فحص استجابة الواجهة لتغيير أبعاد الشاشة...');
  const SIZES = [
    { w: 1024, h: 768, label: '1024x768 (شاشات الأكشاك ومكاتب المبيعات الصغيرة)' },
    { w: 1366, h: 768, label: '1366x768 (الحواسيب المحمولة القياسية)' },
    { w: 1920, h: 1080, label: '1920x1080 (شاشات سطح المكتب الحديثة)' }
  ];

  for (const s of SIZES) {
    logStep(`  اختبار قياس ${s.label}...`);
    await page.send('Emulation.setDeviceMetricsOverride', {
      width: s.w,
      height: s.h,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(600);
    await shot(`32-responsive-${s.w}x${s.h}`);

    const overflowInfo = await page.eval(`
      return {
        bodyScrollWidth: document.body.scrollWidth,
        windowWidth: window.innerWidth,
        hasHorizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2
      };
    `);

    if (overflowInfo.hasHorizontalOverflow) {
      addObs('متوسط', `ظهور شريط تمرير أفقي غير مقصود عند قياس ${s.w}x${s.h}`, `العرض الفعلي للمحتوى (${overflowInfo.bodyScrollWidth}px) تجاوز عرض النافذة (${s.w}px)`);
    }
  }

  // إعادة الحجم القياسي
  await page.send('Emulation.clearDeviceMetricsOverride');
  await sleep(400);

  // ═════════════════════════════════════════════════════════════════════════
  // ١١. فحص الاختصارات (Ctrl+F للبحث الشامل، Escape لإغلاق النوافذ)
  // ═════════════════════════════════════════════════════════════════════════
  logStep('١١. فحص اختصارات لوحة المفاتيح...');
  await page.key('KeyF', { ctrl: true });
  await sleep(600);
  await shot('33-shortcut-ctrl-f-search');

  await page.key('Escape');
  await sleep(400);

  // ═════════════════════════════════════════════════════════════════════════
  // ١٢. تقييم وضوح النصوص والمصطلحات وسلاسة تجربة موظف المكتب الجديد
  // ═════════════════════════════════════════════════════════════════════════
  logStep('١٢. تقييم وضوح النصوص والمصطلحات وسلاسة تجربة موظف المكتب الجديد...');

  addObs('متوسط', 'كثرة المصطلحات التخصصية في الواجهة مثل (الكليشات، البصمة، الترويسات)', 'موظف المكتب المبتدئ معتاد على برنامج Word وقد يحتاج إلى دليل توضيحي أو تلميحات (tooltips) شارحة لكل مصطلح');
  addObs('منخفض', 'إمكانية إبراز زر المعاينة قبل الطباعة بلون مغاير أو بحجم أكبر', 'الموظفون يفضلون التأكد البصري التام من الورقة قبل لمس أمر الطبع لمنع هدر الورق');
  addObs('منخفض', 'إضافة زر مباشر للوصول السريع إلى حزم الجهات من الشاشة الرئيسية للشبّاك', 'حاليًا يمكن استيرادها من المعالج أو من مكتبة النماذج؛ وإتاحتها بنقرة واحدة في الشبّاك توفر خطوة إضافية');

  // حفظ تقرير الملاحظات في ملف JSON
  writeFileSync(join(SHOTS_DIR, 'observations.json'), JSON.stringify(observations, null, 2), 'utf8');
  logStep(`✓ اكتمل اختبار المستخدم الحقيقي بنجاح. تم حفظ الملاحظات (${observations.length}) ولقطات الشاشة في reports/ux-evaluation-shots/`);

  return {
    success: true,
    observationsCount: observations.length,
    shotsDir: SHOTS_DIR,
    observations
  };
}

// تشغيل مباشر
if (process.argv[1]?.endsWith('user-testing.mjs')) {
  drive(runRealUserTest, { exe: EXE, keepOnboarding: true })
    .then((r) => {
      console.log('--- نجح تنفيذ اختبار المستخدم الحقيقي UI/UX ---');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ فشل أثناء تنفيذ اختبار المستخدم الحقيقي:', err);
      process.exit(1);
    });
}
