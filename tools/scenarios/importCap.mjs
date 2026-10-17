/**
 * سيناريو: سقف الاستيراد (A07 أ، D51) — ملفّ Photoshop رأسه ٣٠٠٠٠×٣٠٠٠٠ يُرفض قبل أن يُفكّ.
 *
 * الملفّ صغيرٌ على القرص (رأسٌ وموردٌ وبضع بايتات) لكنّ رأسه يَعِد بتسعمئة مليون نقطة — وكان فكّه يحجز غيغابايتات فيجمّد
 * البرنامج أو يُسقطه. فيُقال الحدّ بنصّه، ولا تصميم ولا ملفّ في المخزن، ويبقى البرنامج يعمل: تُفتح بعده ورقةٌ في المحرّر.
 * والانتظار بالشرط وحده.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const MESSAGE = 'ملفّ Photoshop أكبر من ٢٥ مليون نقطة (٣٠٠٠٠×٣٠٠٠٠) — صغّره ثم استورده';

/** رأس PSD بمقاسٍ ضخم، ثم أقسامه فارغة — فلا يُقرأ منه إلا الرأس. */
function hugePsd() {
  const head = Buffer.alloc(26);
  head.write('8BPS', 0, 'ascii');
  head.writeUInt16BE(1, 4);
  head.writeUInt16BE(3, 12);
  head.writeUInt32BE(30_000, 14);
  head.writeUInt32BE(30_000, 18);
  head.writeUInt16BE(8, 22);
  head.writeUInt16BE(3, 24);
  return Buffer.concat([head, Buffer.alloc(4), Buffer.alloc(4), Buffer.alloc(12), Buffer.alloc(2)]);
}

export function prepare() {
  const dir = join(process.env.TEMP ?? '.', `diwan-importcap-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'لوحة-ضخمة.psd');
  writeFileSync(file, hugePsd());
  return { DIWAN_TEST_OPEN_FILE: file, DIWAN_TEST_SAVE_DIR: dir };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /** ينتظر الشرط حتى مهلةٍ قصوى — ولا مهلة ثابتة بين الخطوات. */
  const until = async (check, ms = 15_000) => {
    const end = Date.now() + ms;
    for (;;) {
      if (await check()) return true;
      if (Date.now() > end) return false;
      await wait(100);
    }
  };
  const has = (sel) => page.eval(`return Boolean(document.querySelector(${JSON.stringify(sel)}));`);

  await page.goto('designed-documents');
  ok('شاشة التصاميم وزرّ الاستيراد', await until(() => has('button[data-act="import"]')));
  await page.eval(`document.querySelector('button[data-act="import"]').click(); return true;`);

  ok(`الرسالة بنصّها: «${MESSAGE}»`, await until(async () => (await page.text()).includes(MESSAGE)));
  ok('ولا «تالف» ولا إنكليزية', !/تالف|Error|RangeError/.test(await page.text()));
  if (shotsDir) await page.shot(join(shotsDir, 'import-cap.png'));

  const db = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const templates = db.prepare('SELECT COUNT(*) AS n FROM templates').get().n;
  db.close();
  ok('ولا تصميم أُضيف', templates === 0);
  const designs = join(profile, 'data', 'store', 'designs');
  ok('ولا ملفّ في المخزن', !existsSync(designs) || readdirSync(designs).length === 0);

  // والبرنامج يعمل بعدها: ورقةٌ فارغة تُفتح في المحرّر.
  await page.goto('templates-library-drafts');
  ok('والمكتبة تُفتح بعدها', await until(() => has('[data-act="new-blank"]')));
  await page.eval(`document.querySelector('[data-act="new-blank"]').click(); return true;`);
  ok('وورقةٌ فارغة تُفتح في المحرّر', await until(async () => (await page.text()).includes('تعريف النموذج')));
  return steps.join('\n');
}
