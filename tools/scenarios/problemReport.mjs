/**
 * سيناريو: «أرسل تقرير المشكلة» (البند ٣٢).
 *
 * من «الإعدادات ← مشكلة في البرنامج؟»: يكتب الموظف ما حدث فيُحفظ ملفٌّ واحد (حوار الحفظ في مجلّدٍ مؤقّت بـ`DIWAN_TEST_SAVE_DIR`)
 * فيه ما كتبه والإصدار والتفعيل وآخر سجلّ الأخطاء — بلا اسم مستخدم Windows ولا شيءٍ من سجلّ المكتب — ثم «افتح مجلّده»
 * و«راسل المطوّر على واتساب». ومن شريط الأخطاء: الزرّ يفتح التقرير ومعه نصّ الخطأ. وEscape يغلقه.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SAVE = join(process.env.TEMP ?? '.', `diwan-report-${Date.now()}`);
const MARK = 'خطأٌ تجريبيٌّ لتقرير المشكلة';

export async function prepare() {
  rmSync(SAVE, { recursive: true, force: true });
  mkdirSync(SAVE, { recursive: true });
  return { DIWAN_TEST_SAVE_DIR: SAVE };
}

export default async function scenario(page, { shotsDir } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const version = JSON.parse(readFileSync('package.json', 'utf8')).version;
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);
  const click = async (sel, ms = 600) => {
    await page.eval(`document.querySelector(${JSON.stringify(sel)}).click(); return true;`);
    await wait(ms);
  };
  const reports = () => (existsSync(SAVE) ? readdirSync(SAVE).filter((f) => f.endsWith('.txt')) : []);

  // خطأٌ في الواجهة يُكتب في سجلّ الأخطاء (index.ts: console-message) — فيُرى في التقرير.
  await page.eval(`console.error(${JSON.stringify(MARK)}); return true;`);
  await wait(400);

  // ── من الإعدادات ─────────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(800);
  ok('في الإعدادات بطاقة «مشكلة في البرنامج؟» بزرّها', (await has('[data-support]')) && (await page.text()).includes('مشكلة في البرنامج؟'));
  await click('[data-act="open-problem-report"]');
  ok('«أرسل تقرير المشكلة» يفتح نافذته', await has('[data-problem-report]'));
  ok('وتقول ما فيه وما ليس فيه', (await page.text()).includes('ولا شيء من سجلّ المكتب ولا أسماء الزبائن'));
  await page.typeKeys('[data-field="problem-note"]', 'كنت أطبع كتاب تأييد');
  if (shotsDir) await page.shot(join(shotsDir, 'problem-report.png'));
  await click('[data-act="save-problem-report"]', 1500);
  ok('«احفظ التقرير»: حُفظ، ويقول أرسله بواتساب', (await has('[data-problem-saved]')) && (await page.text()).includes('أرسله إلى المطوّر بواتساب'));
  const files = reports();
  ok(`وفي المجلّد ملفٌّ واحد باسم التقرير والتاريخ (${files[0] ?? '—'})`, files.length === 1 && files[0].startsWith('تقرير مشكلة ديوان '));
  const raw = files[0] ? readFileSync(join(SAVE, files[0])) : Buffer.alloc(0);
  const text = raw.toString('utf8');
  ok('بعلامة UTF-8 وأسطر Windows (يُفتح في المفكّرة عربيًّا)', raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf && text.includes('\r\n'));
  ok('فيه ما كتبه الموظف والإصدار', text.includes('كنت أطبع كتاب تأييد') && text.includes(`الإصدار: ${version}`));
  ok('والتفعيل ورمز الجهاز', /التفعيل: .*رمز الجهاز DWN-/.test(text));
  ok('وخطأ الواجهة من سجلّ الأخطاء', text.includes(MARK));
  const user = process.env.USERNAME ?? '';
  ok('ولا اسم مستخدم Windows في مساراته', !user || !new RegExp(`[\\\\/]Users[\\\\/]${user}[\\\\/]`, 'i').test(text));
  ok('و«افتح مجلّده» و«راسل المطوّر على واتساب» ظاهران', (await has('[data-act="show-problem-report"]')) && (await page.eval(`return document.querySelector('[data-act="whatsapp-developer"]').href;`)).startsWith('https://wa.me/'));
  await page.key('Escape');
  await wait(400);
  ok('وEscape يغلق النافذة', !(await has('[data-problem-report]')));

  // ── من شريط الأخطاء ───────────────────────────────────────────────
  await page.eval(`window.dispatchEvent(new ErrorEvent('error', { message: 'تعذّر حفظ الكتاب — مثال' })); return true;`);
  await wait(500);
  ok('شريط الأخطاء فيه «أرسل تقرير المشكلة»', (await has('[data-error-bar]')) && (await has('[data-act="problem-report"]')));
  await click('[data-act="problem-report"]');
  ok('والزرّ يفتح التقرير ومعه نصّ الخطأ', (await has('[data-problem-report]')) && (await page.eval(`return document.querySelector('[data-field="problem-note"]').value;`)).includes('تعذّر حفظ الكتاب — مثال'));
  ok('ويُغلق شريط الأخطاء خلفه', !(await has('[data-error-bar]')));
  await click('[data-problem-report] button[title="إغلاق"]', 400);
  ok('و✕ يغلقه', !(await has('[data-problem-report]')));

  rmSync(SAVE, { recursive: true, force: true });
  return steps.join('\n');
}
