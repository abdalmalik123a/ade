/**
 * سيناريو: الملخّص الأسبوعي في «التنبيهات» (الموجة ٢).
 *
 * مكتبٌ جديد بساعةٍ من ملفّ: لا ملخّص ولا نقطة. ثم يخرج من المكتب عملٌ حقيقي عبر البرنامج — كتابٌ يُطبع بنسختين، وكتابٌ
 * يُحفظ بلا طباعة لزبونٍ آخر، وورقة صورٍ بأربع نسخ، وطباعةٌ لم تتمّ، وملفّ PDF، وطلبٌ يُسلَّم لمدرسة — فيقول الجرس «هذا
 * الأسبوع»: ثلاثة زبائن وستّ أوراق وملفٌّ واحد، ولا يزيد رقمه، وضغطةٌ تفتح «السجلّ» على هذا الأسبوع. ثم تتقدّم الساعة
 * أسبوعًا: نقطةٌ على الجرس بلا رقم، وما كان «هذا الأسبوع» صار «الأسبوع الماضي»؛ وفتح الجرس يُزيلها، ولا تعود بعد إقلاع.
 * والعدّاد في القاعدة أعدادٌ وحدها: لا اسم ولا محتوى.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-weekly-${Date.now()}`);
const CLOCK = join(DIR, 'now.txt');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CLOCK, new Date().toISOString());
  return { DIWAN_TEST_NOW_FILE: CLOCK, DIWAN_TEST_PRINT_LOG: join(DIR, 'prints.jsonl'), DIWAN_TEST_SAVE_DIR: DIR };
}

const SHEET = (name) => `{ sheetHtml: '<div class="a4-sheet"><p>نؤيد</p></div>', templateId: null, citizenId: null, authorityId: null,
  citizenName: ${JSON.stringify(name)}, nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 2,
  copyKind: null, fee: 0, gregorianDate: '', hijriDate: null, operator: null, printer: 'طابعة الاختبار', serialPrefix: 'م',
  serialYear: 2026, letterheadId: null }`;

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector('${sel}')?.click(); return true;`);
  const has = (sel) => page.eval(`return Boolean(document.querySelector('${sel}'));`);
  const cells = (attr) =>
    page.eval(`return Object.fromEntries([...document.querySelectorAll('[${attr}]')].map((e) => [e.getAttribute('${attr}'), Number(e.textContent.replace(/,/g, ''))]));`);
  const count = () => page.eval(`return Number(document.querySelector('[data-act="notifications"]')?.dataset.count);`);

  await wait(800);
  ok('مكتبٌ جديد: لا نقطة على الجرس', !(await has('[data-week-dot]')));
  await click('[data-act="notifications"]');
  await wait(300);
  ok('ولا ملخّص — لا شيء خرج بعد', (await has('[data-notifications]')) && !(await has('[data-week-summary]')));
  await page.key('Escape');

  // ── عملٌ يخرج من المكتب، عبر البرنامج كما تفعل شاشاته ────────────────
  const done = await page.eval(`
    const out = [];
    const step = async (name, work) => { try { out.push([name, await work()]); } catch (e) { out.push([name, 'خطأ: ' + (e?.message ?? e)]); } };
    await step('كتاب يُطبع بنسختين', () => window.diwan.documents.issue(${SHEET('سالم حسن')}, true).then((r) => r.printed));
    await step('كتاب يُحفظ بلا طباعة', () => window.diwan.documents.issue(${SHEET('زينب كاظم')}, false).then((r) => r.printed));
    await step('ورقة صور بأربع نسخ', () => window.diwan.output.print({ sheetHtml: '<div class="a4-sheet">صور</div>', printer: 'طابعة الاختبار', copies: 4, silent: true }).then((r) => r.ok));
    await step('طباعة لم تتمّ', () => window.diwan.output.print({ sheetHtml: '<div class="a4-sheet">صور</div>', printer: 'معطّلة', copies: 3, silent: true }).then((r) => r.ok));
    await step('ملف PDF', () => window.diwan.output.savePdf({ sheetHtml: '<div class="a4-sheet">ملف</div>', suggestedName: 'ملف-الأسبوع' }).then(Boolean));
    await step('طلب سُلّم', async () => {
      const o = await window.diwan.orders.save({ id: null, clientId: null, customer: 'مدرسة النور', title: 'هويّات الطلبة' });
      return (await window.diwan.orders.setStatus(o.id, 'delivered')).status;
    });
    return out;`);
  ok(`خرج العمل كما يُتوقّع (${done.map(([n, r]) => `${n}: ${r}`).join('، ')})`,
    JSON.stringify(done.map(([, r]) => r)) === JSON.stringify(['ok', 'skipped', true, false, true, 'delivered']));

  await page.goto('orders-board');
  await click('[data-act="notifications"]');
  await wait(400);
  ok('«هذا الأسبوع» في أعلى الجرس', await has('[data-notifications] [data-week-summary]'));
  const now1 = await cells('data-week-this');
  ok(`ثلاثة زبائن وستّ أوراق وملفٌّ واحد (${JSON.stringify(now1)})`, now1.customers === 3 && now1.sheets === 6 && now1.files === 1);
  const last1 = await cells('data-week-last');
  ok('والأسبوع الماضي أصفار', last1.customers === 0 && last1.sheets === 0 && last1.files === 0);
  ok('ولا يزيد رقم الجرس: تذكير النسخة الاحتياطية وحده', (await count()) === 1 && !(await has('[data-week-dot]')));
  if (shotsDir) await page.shot(join(shotsDir, 'weekly-this.png'));
  await click('[data-week-summary]');
  await wait(900);
  const period = await page.eval(`return document.querySelector('[data-period-stats]')?.textContent ?? '';`);
  ok(`وضغطةٌ تفتح «السجلّ» على هذا الأسبوع — بكتابيه (${period})`, period.startsWith('هذا الأسبوع: 2 من الكتب الصادرة'));
  // والمحفوظ بلا طباعة لا نسخة له في «السجلّ» — النسختان للكتاب الذي طُبع وحده (وكانت ٤).
  ok('و«النسخ المطبوعة» فيه ما طُبع فعلًا', period.includes('2 من النسخ المطبوعة'));

  // ── بعد أسبوع ────────────────────────────────────────────────────────
  writeFileSync(CLOCK, new Date(Date.now() + 7 * 864e5).toISOString());
  await page.eval(`location.reload(); return true;`).catch(() => undefined);
  await wait(3000);
  ok('بعد أسبوع: نقطةٌ على الجرس — ملخّص الأسبوع الماضي جاهز', await has('[data-act="notifications"] [data-week-dot]'));
  ok('بلا رقمٍ زائد', (await count()) === 1);
  if (shotsDir) await page.shot(join(shotsDir, 'weekly-dot.png'));
  await click('[data-act="notifications"]');
  await wait(400);
  const now2 = await cells('data-week-this');
  const last2 = await cells('data-week-last');
  ok('وما كان «هذا الأسبوع» صار «الأسبوع الماضي»', last2.customers === 3 && last2.sheets === 6 && last2.files === 1 && now2.sheets === 0);
  ok('وفتح الجرس يُزيل النقطة', !(await has('[data-week-dot]')));
  if (shotsDir) await page.shot(join(shotsDir, 'weekly-last.png'));
  await page.key('Escape');
  await page.eval(`location.reload(); return true;`).catch(() => undefined);
  await wait(3000);
  ok('ولا تعود بعد إقلاع', !(await has('[data-week-dot]')) && (await has('[data-act="notifications"]')));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const columns = db.prepare('PRAGMA table_info(work_days)').all().map((c) => c.name);
  const sums = Object.fromEntries(db.prepare('SELECT kind, SUM(n) AS n FROM work_days GROUP BY kind').all().map((r) => [r.kind, r.n]));
  db.close();
  ok('والعدّاد في القاعدة أعدادٌ وحدها — لا اسم ولا محتوى', columns.join(',') === 'day,kind,n' && sums.sheets === 6 && sums.files === 1);

  return steps.join('\n');
}
