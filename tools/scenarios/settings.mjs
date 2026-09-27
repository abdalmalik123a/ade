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
  ok('ورقم الإصدار من الحزمة لا «2.4»', text.includes(`ديوان ${version}`) && !text.includes('ديوان 2.4'));

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
  ok('والاختصارات الثابتة بأزرارها', text.includes('Ctrl+K') && text.includes('شريط الأوامر') && text.includes('«الأوامر» في الشريط العلوي'));
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
  await arabicKey('KeyK', 'ن', 75);
  ok('وCtrl+K تفتح شريط الأوامر', await page.eval(`return Boolean(document.querySelector('input[placeholder^="اكتب أمرًا"]'));`));

  return steps.join('\n');
}
