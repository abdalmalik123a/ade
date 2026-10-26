/**
 * سيناريو: «تشخيص الجهاز» (S34، D186).
 *
 * «الإعدادات ← مشكلة في البرنامج؟ ← افحص الجهاز»: خمسة أسطرٍ بمفاتيحها وعلامتها — مكتبات مايكروسوفت (سليمةٌ على جهاز التطوير، وعليه
 * تعمل «أزل الخلفية» في سيناريوهاتها) والخطوط والطابعات والمساحة بأرقامها والساعة بتاريخ اليوم. ثم تقرير المشكلة (حوار الحفظ في مجلّدٍ مؤقّت)
 * فيه «تشخيص الجهاز» بالأسطر نفسها.
 * وسطر الطابعات **كما يقوله ويندوز** (D192): الافتراضية والمنقطعة من WMI (`Win32_Printer`) — مصدرٌ غير السجلّ الذي يقرؤه البرنامج —
 * و«(طابعة النظام)» بجوار الافتراضية في أدوار الطابعات.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const SAVE = join(process.env.TEMP ?? '.', `diwan-diagnose-${Date.now()}`);
/** طابعات ويندوز كما يراها WMI: الاسم والافتراضية و«دون اتّصال». */
let WINDOWS = [];

export async function prepare() {
  rmSync(SAVE, { recursive: true, force: true });
  mkdirSync(SAVE, { recursive: true });
  const ps = spawnSync(
    'powershell',
    ['-NoProfile', '-Command', '[Console]::OutputEncoding=[Text.Encoding]::UTF8; @(Get-CimInstance Win32_Printer | Select-Object Name,Default,WorkOffline) | ConvertTo-Json -Compress'],
    { encoding: 'utf8', windowsHide: true, timeout: 30_000 }
  );
  try {
    WINDOWS = [JSON.parse(ps.stdout || '[]')].flat();
  } catch {
    WINDOWS = [];
  }
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
  const offline = WINDOWS.filter((p) => p.WorkOffline).map((p) => p.Name);
  const system = WINDOWS.find((p) => p.Default)?.Name ?? null;
  const pr = by.printers ?? { level: '', text: '' };
  ok(
    `والطابعات كما يقول ويندوز (الافتراضية ${system ?? '—'}، ودون اتّصال ${offline.join('، ') || '—'}) ← ${pr.level}: ${pr.text}`,
    !WINDOWS.length
      ? pr.level === 'bad'
      : offline.length
        ? pr.level === 'warn' && offline.every((n) => pr.text.includes(`«${n}»`))
        : system
          ? pr.level === 'ok' && pr.text.includes(`«${system}»`)
          : pr.level === 'warn'
  );
  const marked = await page.eval(`return [...document.querySelectorAll('[data-print-roles] option')].filter((o) => o.textContent.includes('(طابعة النظام)')).map((o) => o.value);`);
  ok(`و«(طابعة النظام)» بجوار الافتراضية في أدوار الطابعات (${[...new Set(marked)].join('، ') || '—'})`, system ? marked.length > 0 && marked.every((v) => v === system) : marked.length === 0);
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
