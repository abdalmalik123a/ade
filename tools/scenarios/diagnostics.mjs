/**
 * سيناريو: «تشخيص الجهاز» (S34، D186).
 *
 * «الإعدادات ← مشكلة في البرنامج؟ ← افحص الجهاز»: خمسة أسطرٍ بمفاتيحها وعلامتها — مكتبات مايكروسوفت (سليمةٌ على جهاز التطوير، وعليه
 * تعمل «أزل الخلفية» في سيناريوهاتها) والخطوط والطابعات والمساحة بأرقامها والساعة بتاريخ اليوم. ثم تقرير المشكلة (حوار الحفظ في مجلّدٍ مؤقّت)
 * فيه «تشخيص الجهاز» بالأسطر نفسها.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SAVE = join(process.env.TEMP ?? '.', `diwan-diagnose-${Date.now()}`);

export async function prepare() {
  rmSync(SAVE, { recursive: true, force: true });
  mkdirSync(SAVE, { recursive: true });
  return { DIWAN_TEST_SAVE_DIR: SAVE };
}

export default async function scenario(page, { shotsDir } = {}) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = async (sel, ms = 600) => {
    await page.eval(`document.querySelector(${JSON.stringify(sel)}).click(); return true;`);
    await wait(ms);
  };
  const rows = () =>
    page.eval(`return [...document.querySelectorAll('[data-diagnostics] [data-diagnose]')].map((li) => ({ key: li.dataset.diagnose, level: li.dataset.level, text: li.lastElementChild.innerText.trim() }));`);

  await page.goto('office-settings');
  await wait(800);
  ok('في «مشكلة في البرنامج؟» زرّ «افحص الجهاز»', await page.eval(`return document.querySelector('[data-support] [data-act="diagnose"]')?.innerText.includes('افحص الجهاز') ?? false;`));
  await click('[data-act="diagnose"]', 2500);
  const list = await rows();
  ok(`خمسة أسطر بمفاتيحها (${list.map((r) => r.key).join(' ')})`, list.map((r) => r.key).join(' ') === 'vc fonts printers disk clock');
  const by = Object.fromEntries(list.map((r) => [r.key, r]));
  ok(`مكتبات مايكروسوفت سليمة على جهاز التطوير (${by.vc?.level})`, by.vc?.level === 'ok');
  ok(`والخطوط بلا مستورد سليمة (${by.fonts?.text ?? '—'})`, by.fonts?.level === 'ok' && by.fonts.text.includes('خطوط ديوان'));
  ok(`والطابعات بسطرٍ وعلامة (${by.printers?.level}: ${by.printers?.text ?? '—'})`, ['ok', 'warn', 'bad'].includes(by.printers?.level) && by.printers.text.length > 5);
  ok(`والمساحة بأرقامها (${by.disk?.text ?? '—'})`, /[٠-٩]+(٫[٠-٩])? غ\.ب/.test(by.disk?.text ?? ''));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`.replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
  ok(`والساعة سليمة بتاريخ اليوم (${by.clock?.text ?? '—'})`, by.clock?.level === 'ok' && by.clock.text.includes(today));
  if (shotsDir) await page.shot(join(shotsDir, 'diagnostics.png'));

  // ── والأسطر نفسها في تقرير المشكلة ─────────────────────────────────
  await click('[data-act="open-problem-report"]');
  await page.typeKeys('[data-field="problem-note"]', 'لا تطبع الطابعة');
  await click('[data-act="save-problem-report"]', 2500);
  const files = existsSync(SAVE) ? readdirSync(SAVE).filter((f) => f.endsWith('.txt')) : [];
  const text = files[0] ? readFileSync(join(SAVE, files[0]), 'utf8') : '';
  ok('حُفظ التقرير', files.length === 1);
  const section = text.split('تشخيص الجهاز:')[1]?.split('ما كتبه الموظف:')[0] ?? '';
  ok('وفيه «تشخيص الجهاز» بأسطره الخمسة', ['مكتبات مايكروسوفت:', 'الخطوط:', 'الطابعات:', 'المساحة:', 'الساعة:'].every((t) => section.includes(t)));
  ok('بالجملة نفسها التي في الشاشة', list.length === 5 && list.every((r) => section.includes(r.text)));
  await page.key('Escape');
  await wait(300);
  return steps.join('\n');
}
