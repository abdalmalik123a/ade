/**
 * سيناريو: مفتاح بيانات المكتب ورمز الاسترداد (D237، ر190 §٣).
 *
 * ١) أوّل تشغيل: يُنشأ المفتاح ويُعرض رمز الاسترداد حتى يقرّ المكتب بحفظه — Esc لا يغلقه، و«احفظه ملفًّا» يكتبه،
 *    و«حفظته» يغلقه. والرمز لا يدخل سجلّ الأخطاء ولا تقرير المشكلة، والإعدادات تعرضه بعد تأكيد.
 * ٢) حماية ويندوز لا تفتح المفتاح (كأنّ ويندوز أُعيد تنصيبه): نافذة الرمز قبل البرنامج — والقاعدة لم تُفتح —
 *    رمزٌ خاطئ يُرفض، والصحيح يفتح البيانات، ويُعاد تغليف المفتاح لحماية ويندوز.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** الحوار نفسه ما يُفحص هنا: لا يُقرّ به المِقْود. */
export const keepRecovery = true;

let ENV = {};
let CODE = '';
const PORT = 9223;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export async function prepare() {
  mkdirSync(process.env.DIWAN_TEST_SAVE_DIR, { recursive: true });
  ENV = {};
  return ENV;
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const keysFile = join(profile, 'data', 'keys.json');
  let shown = false;
  for (let i = 0; i < 20 && !shown; i++) {
    await wait(300);
    shown = await page.eval(`return Boolean(document.querySelector('[data-recovery-dialog]'));`);
  }
  CODE = await page.eval(`return document.querySelector('[data-recovery-code]')?.innerText.trim() ?? '';`);
  ok(`أوّل تشغيل: أُنشئ المفتاح وعُرض رمز الاسترداد (${CODE.slice(0, 4)}-…)`, shown && existsSync(keysFile) && /^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/.test(CODE));
  ok('والرمز لا يُحفظ واضحًا في keys.json', !readFileSync(keysFile, 'utf8').includes(CODE.replace(/-/g, '').slice(0, 8)));

  await page.eval(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return true;`);
  await wait(300);
  ok('وEsc لا يغلقه', await page.eval(`return Boolean(document.querySelector('[data-recovery-dialog]'));`));

  await page.eval(`document.querySelector('[data-act="recovery-save"]').click(); return true;`);
  await wait(800);
  const saved = join(process.env.DIWAN_TEST_SAVE_DIR, 'رمز-استرداد-ديوان.txt');
  ok('و«احفظه ملفًّا» يكتبه بشرحه', existsSync(saved) && readFileSync(saved, 'utf8').includes(CODE));

  await page.eval(`document.querySelector('[data-act="recovery-done"]').click(); return true;`);
  await wait(600);
  ok('و«حفظته» يغلقه ويُقيَّد الإقرار', !(await page.eval(`return Boolean(document.querySelector('[data-recovery-dialog]'));`)) && JSON.parse(readFileSync(keysFile, 'utf8')).acknowledged === true);

  const reportPath = await page.eval(`return window.diwan.ui.problemReport('تجربة');`).catch(() => null);
  const report = reportPath && existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : '';
  const logDir = join(profile, 'logs');
  const logs = existsSync(logDir) ? readdirSync(logDir).map((f) => readFileSync(join(logDir, f), 'utf8')).join('\n') : '';
  ok('والرمز ليس في تقرير المشكلة ولا في سجلّ الأخطاء', report.length > 0 && !report.includes(CODE) && !logs.includes(CODE));

  await page.goto('office-settings');
  await wait(900);
  await page.eval(`document.querySelector('[data-act="recovery-show"]').click(); return true;`);
  await wait(400);
  await page.eval(`document.querySelector('[data-confirm] [data-choice="show"]').click(); return true;`);
  await wait(600);
  ok('والإعدادات تعرضه بعد تأكيد', (await page.eval(`return document.querySelector('[data-recovery-shown]')?.innerText.trim() ?? '';`)) === CODE);
  return steps.join('\n');
}

export async function betweenRestarts() {
  ENV.DIWAN_TEST_DPAPI_FAIL = '1';
}

export async function afterRestart(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const keysFile = join(profile, 'data', 'keys.json');
  const before = readFileSync(keysFile, 'utf8');
  const pages = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page');
  ok('حماية ويندوز لا تفتح: نافذة الرمز وحدها قبل البرنامج', pages.length === 1 && (await page.eval(`return Boolean(document.querySelector('[data-unlock]'));`)));

  await page.type('[data-unlock-code]', 'AAAA-BBBB-CCCC-DDDD-EEEE-FFFF');
  await page.eval(`document.querySelector('[data-act="unlock"]').click(); return true;`);
  await wait(1500);
  ok('ورمزٌ خاطئ يُرفض ولا يتغيّر المفتاح', (await page.eval(`return document.querySelector('[data-unlock-error]')?.innerText ?? '';`)).includes('غير صحيح') && readFileSync(keysFile, 'utf8') === before);

  await page.type('[data-unlock-code]', CODE.toLowerCase());
  await page.eval(`document.querySelector('[data-act="unlock"]').click(); return true;`);
  let opened = false;
  for (let i = 0; i < 30 && !opened; i++) {
    await wait(500);
    const list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'page');
    opened = list.some((t) => !String(t.url).includes('mode=unlock'));
  }
  ok('والصحيح (بحروفٍ صغيرة) يفتح البيانات ويُفتح البرنامج', opened);
  ok('ويُعاد تغليف المفتاح لحماية ويندوز الحاليّة', readFileSync(keysFile, 'utf8') !== before);
  return steps.join('\n');
}
