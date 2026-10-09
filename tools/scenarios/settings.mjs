/**
 * سيناريو: شاشة «الإعدادات» والاختصارات بلوحةٍ عربية.
 *
 * الإعدادات شاشةٌ باسمها في الشريط (لا داخل «الترويسات»)، وزرّها في أسفل الشريط
 * بدل «تبديل الحساب أو خروج». فيها المكتب والطابعة والخصوصية والاختصارات ورقم
 * الإصدار من الحزمة. وسنة القيد لا تُحفظ فتثبت. ثم تُضغط الاختصارات ضغطًا حقيقيًّا
 * والمفتاح يصل حرفًا عربيًّا — كما على لوحة المكتب.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;

  // ── الشريط ───────────────────────────────────────────────────────
  let text = await page.text();
  ok('لا «تبديل الحساب» في برنامجٍ بلا حسابات', !text.includes('تبديل الحساب'));
  // رقم الإصدار في تلميح شعار السكّة (المرحلة ٢) وفي «عن البرنامج».
  const logoTitle = await page.eval(`return document.querySelector('[data-act="sidebar-about"]').title;`);
  ok('ورقم الإصدار من الحزمة لا «2.4»', logoTitle.includes(`ديوان ${version}`) && !logoTitle.includes('ديوان 2.4'));

  await page.eval(`document.querySelector('[data-act="open-settings"]').click(); return true;`);
  await wait(700);
  ok('زرّ الإعدادات في أسفل الشريط يفتحها', await page.eval(`return Boolean(document.querySelector('[data-settings]'));`));

  await page.goto('service-counter');
  await wait(400);
  await page.goto('office-settings');
  await wait(700);
  ok('والإعدادات شاشةٌ باسمها في الشريط', await page.eval(`return Boolean(document.querySelector('[data-settings]'));`));
  text = await page.text();
  ok('فيها رقم الإصدار', text.includes(`الإصدار ${version}`));
  ok('وسياسة الخصوصية: البيانات على الجهاز ولا إنترنت', text.includes('البيانات كلّها على هذا الجهاز') && text.includes('لا يتّصل بالإنترنت'));
  ok('ومجلّد البيانات مكتوبٌ بمساره', text.includes(join(profile, 'data')) || text.includes('data'));
  // ما يعرفه الموظف من Windows وWord وحده وF4 (ن١٥) — ولا Ctrl+K ولا F2.
  ok('والاختصارات الثابتة بأزرارها', text.includes('Ctrl+F') && text.includes('Ctrl+Enter') && text.includes('«تحديد الكلّ»') && !text.includes('Ctrl+K') && !text.includes('شريط الأوامر'));
  ok('ولم تبقَ «سنة السجل» خانةً تُحفظ', !text.includes('سنة السجل'));

  await page.goto('header-seal-configuration');
  await wait(600);
  ok('وخرجت إعدادات المكتب من شاشة الترويسات', !(await page.text()).includes('إعدادات المكتب والطباعة'));

  // ── الحفظ ────────────────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(600);
  await page.type('[data-setting="officeName"]', 'مكتب الاختبار');
  await page.eval(`document.querySelector('[data-act="save-settings"]').click(); return true;`);
  await wait(700);
  ok('يُحفظ اسم المكتب', (await page.text()).includes('حُفظت إعدادات المكتب'));
  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const rows = Object.fromEntries(db.prepare('SELECT key, value FROM settings').all().map((r) => [r.key, r.value]));
  db.close();
  ok('في القاعدة', rows.officeName === 'مكتب الاختبار');
  ok('وسنة القيد لا تُحفظ فتثبت عند رأس السنة', !('serialYear' in rows));
  // «لم يُحدَّد» يُمحى مفتاحه لا يُحفظ نصًّا — وإلا قُرئ "null" اسمَ طابعةٍ أو اختيارًا.
  ok('ولا «null» نصًّا في الإعدادات', !Object.values(rows).includes('null'));
  ok('والبسملة لم يخترها المكتب بعد', !('basmala' in rows));

  // ── البسملة تفضيلٌ للمكتب (FOUNDATION §٥) ───────────────────────────
  const setting = (key) => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const r = d.prepare('SELECT value FROM settings WHERE key = ?').get(key);
    d.close();
    return r?.value ?? null;
  };

  // ── إزاحة الهجري: الميلادي هو الأصل، والهجري يُطابَق يدويًّا (قرار ٦ تشرين الأول) ──────
  const hijriPreview = () => page.eval(`return document.querySelector('[data-hijri-preview]')?.innerText ?? '';`);
  const before = await hijriPreview();
  ok('إزاحة التاريخ الهجري في الإعدادات، والأصل «كما هو»', before.includes('هـ') && (await page.eval(`return document.querySelector('[data-hijri="0"]')?.className.includes('bg-primary-container') ?? false;`)));
  await page.eval(`document.querySelector('[data-hijri="1"]').click(); return true;`);
  await wait(500);
  const after = await hijriPreview();
  ok('«+١» تزيح الهجري يومًا في المعاينة — والميلادي كما هو', after !== before && after.split('—')[0] === before.split('—')[0]);
  ok('وتُحفظ فورًا بلا «حفظ»', setting('hijriOffset') === '1');
  await page.eval(`document.querySelector('[data-hijri="0"]').click(); return true;`);
  await wait(400);
  ok('و«كما هو» تعيده', setting('hijriOffset') === '0');
  ok('وخيارها في الإعدادات', (await page.text()).includes('لم يختر المكتب بعد'));
  // أوّل إشعالٍ في ترويسةٍ يصير تفضيل المكتب
  await page.goto('header-seal-configuration');
  await wait(700);
  await page.eval(`document.querySelector('[data-act="basmala"]').click(); return true;`);
  await wait(600);
  ok('أوّل بسملةٍ في ترويسة تصير تفضيل المكتب', setting('basmala') === 'true');
  ok('ويُقال ذلك بجانبها', await page.eval(`return Boolean(document.querySelector('[data-basmala-note]'));`));
  await page.goto('office-settings');
  await wait(700);
  // والترويسة لم تُحفظ فيسأل «اترك بلا حفظ؟» (ج — حماية العمل): التفضيل حُفظ في الإعدادات، والترويسة تُترك.
  await page.eval(`[...document.querySelectorAll('[data-confirm] button')].find((b) => b.textContent.trim() === 'اترك بلا حفظ')?.click(); return true;`);
  await wait(700);
  ok('وتظهر في الإعدادات مشعولة', await page.eval(`return document.querySelector('[data-setting="basmala"]').checked;`));
  await page.eval(`document.querySelector('[data-setting="basmala"]').click(); return true;`);
  await wait(600);
  ok('وتُطفأ منها', setting('basmala') === 'false');
  await page.goto('header-seal-configuration');
  await wait(700);
  await page.eval(`
    const box = document.querySelector('[data-act="basmala"]');
    if (box.checked) box.click();
    box.click();
    return true;`);
  await wait(600);
  ok('وما دام المكتب قد اختار، فإشعالها في ترويسةٍ لا يغيّر اختياره', setting('basmala') === 'false');

  // ── الاختصارات ولوحة المفاتيح عربية ────────────────────────────────
  /** ضغطةٌ حقيقية: موضع المفتاح بالإنجليزية، والحرف الواصل عربي. */
  const arabicKey = async (code, key, vk) => {
    const base = { code, key, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers: 2 };
    await page.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...base });
    await page.send('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    await wait(300);
  };
  await arabicKey('KeyF', 'ب', 70);
  ok('Ctrl+F بلوحةٍ عربية تصل البحث الشامل', await page.eval(`return document.activeElement?.hasAttribute('data-global-search') ?? false;`));
  await page.eval(`document.activeElement?.blur(); return true;`);
  // ولا شريط أوامر: Ctrl+K زال مع الاختصارات التي لا يعرفها الموظف من Windows ولا Word (ن١٥).
  await arabicKey('KeyK', 'ن', 75);
  ok('وCtrl+K لا تفتح شيئًا — والإعدادات تعرض الاختصارات الباقية', !(await page.eval(`return Boolean(document.querySelector('[data-command-palette], input[placeholder^="اكتب أمرًا"]'));`)));

  // ── و٣: القناة تحفظ إعدادات المكتب وحدها — `appVersion` مرتفعةٌ كانت تقفل الإقلاع ──
  const refused = await page.eval(`
    return window.diwan.settings.set({ officeName: 'لا يُكتب', appVersion: '99.0.0' }).then(() => 'حُفظ', (e) => String(e?.message ?? e));
  `);
  ok(`«appVersion» يُرفض بعربية ولا يُكتب منه شيء («${refused.slice(-60)}»)`, refused.includes('ليس من إعدادات المكتب') && setting('appVersion') !== '99.0.0' && setting('officeName') !== 'لا يُكتب');
  const kept = await page.eval(`return window.diwan.settings.set({ hijriOffset: 1 }).then((s) => s.hijriOffset, (e) => 'خطأ: ' + e.message);`);
  ok('وإعدادٌ من المكتب يُحفظ كما كان', kept === 1 && setting('hijriOffset') === '1');

  return steps.join('\n');
}
