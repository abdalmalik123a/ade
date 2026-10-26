/**
 * سيناريو: مسح الهويّة عابر — لا يبقى في المخزن ولا يدخل نسخةً احتياطية (مراجعة ٧ ت١).
 *
 * كان كلّ مسحٍ لوجه هويّةٍ يُكتب في `store/attachments/scan-<وقت>.png` (نحو ١١ م.ب) فلا يمسحه أحد، فتنتقل صور
 * هويّات الزبائن إلى النسخ الاحتياطية بلا سجلٍّ يدلّ عليها. فيُمسح الآن في `store/tmp/`، ويُحذف حين يُغلق
 * الحوار، ويُكنس عند الإقلاع. وما يُقيَّد مستمسكًا لزبون (`attachments:scan`) يبقى في `attachments/`.
 */
import { existsSync, readdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PNG = join(HERE, '..', '..', 'tests', 'fixtures', 'card-back-fake.png');

export async function prepare() {
  return { DIWAN_TEST_SCAN_FILE: PNG };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const store = join(profile, 'data', 'store');
  const list = (dir) => (existsSync(join(store, dir)) ? readdirSync(join(store, dir)) : []);
  const click = (selector) => page.eval(`document.querySelector(${JSON.stringify(selector)})?.click(); return true;`);

  // ── 1) الحوار: يمسح عابرًا، ويُحذف حين يُغلق ─────────────────────────────
  await page.goto('service-counter');
  await wait(900);
  await page.eval(`[...document.querySelectorAll('button')].find((b) => b.textContent.includes('استنساخ هوية'))?.click(); return true;`);
  await wait(1200);
  // «استنساخ هوية» يفتح ورقة المستمسكات (S47): الخانة الفارغة تُنقر فيُسأل من أين — والماسح أوّلًا.
  ok('انفتحت ورقة المستمسكات من «استنساخ هوية»', await page.eval(`return Boolean(document.querySelector('[data-id-sheet] [data-sheet-empty][data-face="front"]'));`));
  await click('[data-id-sheet] [data-sheet-empty][data-face="front"]');
  await wait(400);
  await click('[data-act="scan-front"]');
  await wait(2200);
  const scanned = list('tmp');
  ok(`المسح عابر: في tmp لا في attachments (${scanned.join('، ')})`, scanned.length === 1 && !list('attachments').some((f) => f.startsWith('scan-')));
  // والصورة تُعرض من المخزن ما دام الحوار مفتوحًا
  ok('والحوار يعرضها ما دام مفتوحًا', await page.eval(`return [...document.querySelectorAll('img')].some((i) => i.src.includes('/tmp/scan-'));`));
  await click('[data-act="id-sheet-close"]');
  await wait(800);
  ok('وحين يُغلق الحوار يُحذف المسح من المخزن', list('tmp').length === 0);

  // ── 2) مستمسكٌ يُقيَّد لزبون يبقى في attachments كما كان ────────────────────
  const citizenId = await page.eval(`return (await window.diwan.citizens.save({ id: null, fullName: 'زبون المسح', verified: false })).id;`);
  await page.eval(`await window.diwan.attachments.scan(${citizenId}, 'هوية', 300); return true;`);
  const kept = list('attachments').filter((f) => f.startsWith('scan-'));
  ok(`والمستمسك المقيَّد لزبونٍ يبقى في attachments (${kept.join('، ')})`, kept.length === 1);

  // ── 3) مسحٌ لم يُغلق حواره وكتابةٌ انقطعت (انقطاعٌ مفاجئ): يُكنسان عند الإقلاع التالي ───
  await page.eval(`return window.diwan.scanner.scanImage(300);`);
  ok('مسحٌ عابرٌ آخر بلا حوارٍ يحذفه', list('tmp').length === 1);
  const old = join(store, 'attachments', 'قديم.png.part');
  writeFileSync(old, 'x');
  const threeDays = new Date(Date.now() - 3 * 24 * 3600 * 1000);
  utimesSync(old, threeDays, threeDays);
  writeFileSync(join(store, 'attachments', 'جديد.png.part'), 'x');
  return steps.join('\n');
}

/** يُقتل البرنامج فجأةً ثم يُفتح على الملف الشخصي نفسه: الكنس عند الإقلاع. */
export async function afterRestart(page, { profile }) {
  const store = join(profile, 'data', 'store');
  const list = (dir) => (existsSync(join(store, dir)) ? readdirSync(join(store, dir)) : []);
  await new Promise((r) => setTimeout(r, 1500));
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  ok('وعند الإقلاع التالي يُكنس tmp كلّه', list('tmp').length === 0);
  ok('ويُكنس `.part` الأقدم من يوم، ولا يُمسّ الجديد', !list('attachments').includes('قديم.png.part') && list('attachments').includes('جديد.png.part'));
  ok('ولا يُمسّ المستمسك المقيَّد', list('attachments').some((f) => f.startsWith('scan-') && !f.endsWith('.part')));
  return steps.join('\n');
}
