/**
 * سيناريو: قاعدةٌ متضرّرة عند الإقلاع لا تُغلق الطريق إلى النسخة الاحتياطية (D100).
 *
 * كان D96 يقول «تعذّر تشغيل ديوان» بنصٍّ إنكليزي ويخرج؛ وقبله كان يُفتح، لكنّ الاسترجاع يسقط لأنّه يبدأ بنسخةٍ متّسقة
 * (`VACUUM INTO`) من القاعدة التالفة. فهنا: زبونان ونسخةٌ احتياطية، ثم بين الإقلاعين يُتلَف فهرسٌ واحد (`citizens`)،
 * ثم يُفتح البرنامج بجواب «افتح لأسترجع نسخةً احتياطية» (`DIWAN_TEST_DAMAGED_DB=open` — حوار النظام لا يُضغط آليًّا):
 * يقرأ بياناته، ويرفض الكتابة على التالف بالعربية، والتفصيل في سجلّ الأخطاء، ثم يسترجع النسخة فتعود القاعدة سليمةً
 * ويبقى الأصل المتضرّر جانبًا كما هو.
 */
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-damaged-${Date.now()}`);
const RESTORE = join(DIR, 'restore.diwan');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** ما يُفحص بين الإقلاعين (والبرنامج مغلق) — يُضمّ إلى خطوات ما بعد الإقلاع الثاني. */
const between = [];

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  return { DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_OPEN_FILE: RESTORE, DIWAN_TEST_DAMAGED_DB: 'open' };
}

/** عمليةٌ قتلت للتوّ ما قبلها قد تمسك ملفًّا لحظات. */
async function retry(label, fn) {
  let last;
  for (let i = 0; i < 30; i++) {
    try {
      return fn();
    } catch (e) {
      last = e;
      await wait(300);
    }
  }
  throw new Error(`${label}: ${last?.message ?? last}`);
}

const check = (file) => {
  const d = new Database(file, { readonly: true });
  try {
    return String(d.pragma('quick_check(1)', { simple: true }));
  } finally {
    d.close();
  }
};
const names = (r) => (Array.isArray(r) ? r : (r.rows ?? [])).map((c) => c.fullName);

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  for (const n of ['زينب علي حسن', 'سالم حسن']) {
    await page.eval(`await window.diwan.citizens.save({ id: null, fullName: ${JSON.stringify(n)}, verified: false }); return true;`);
  }
  const made = await page.eval(`return await window.diwan.backup.create(null);`);
  if (made?.path) copyFileSync(made.path, RESTORE);
  ok('زبونان ونسخةٌ احتياطية قبل التلف', existsSync(RESTORE));
  return steps.join('\n');
}

/** بين الإقلاعين: صفحة فهرسٍ واحدٍ من `citizens` تُكتب بايتاتٍ لا معنى لها — والجدول نفسه سليم. */
export async function betweenRestarts({ profile }) {
  const file = join(profile, 'data', 'diwan.db');
  const { page: pageSize, root } = await retry('فتح القاعدة', () => {
    const d = new Database(file);
    try {
      d.pragma('wal_checkpoint(TRUNCATE)');
      const idx = d.prepare(`SELECT rootpage FROM sqlite_master WHERE type = 'index' AND name = 'ix_citizens_cat'`).get();
      return { page: d.pragma('page_size', { simple: true }), root: idx?.rootpage ?? 0 };
    } finally {
      d.close();
    }
  });
  for (const s of ['-wal', '-shm']) rmSync(file + s, { force: true });
  if (root > 1) {
    const fd = openSync(file, 'r+');
    writeSync(fd, Buffer.alloc(64, 0xff), 0, 64, (root - 1) * pageSize);
    closeSync(fd);
  }
  between.push(`${check(file) !== 'ok' ? '✓' : '✗'} أُتلف فهرس الزبائن وحده: الفحص يجده (صفحة ${root})`);
}

export async function afterRestart(page, { profile }) {
  const steps = [...between];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const data = join(profile, 'data');
  await wait(1200);

  ok('«افتح لأسترجع نسخةً احتياطية»: فُتح البرنامج على قاعدته المتضرّرة', await page.eval(`return Boolean(document.querySelector('[data-screen]'));`));
  const log = join(profile, 'logs', 'diwan-errors.log');
  const logged = existsSync(log) ? readFileSync(log, 'utf8') : '';
  ok('والتفصيل التقنيّ في سجلّ الأخطاء للمطوّر', logged.includes('[dbIntegrity]') && logged.includes('btreeInitPage'));
  const listed = names(await page.eval(`return await window.diwan.citizens.list({});`));
  ok(`وبياناته تُقرأ (${listed.join('، ')})`, listed.includes('زينب علي حسن') && listed.includes('سالم حسن'));
  const refused = await page.eval(
    `try { await window.diwan.citizens.save({ id: null, fullName: 'مدرسة النور', verified: false }); return 'حُفظ'; } catch (e) { return String(e.message); }`
  );
  ok('والكتابة على التالف تُرفض بالعربية وتدلّ على النسخة', refused.includes('قاعدة البيانات تالفة') && refused.includes('نسخةً احتياطية'));

  const restored = await page.eval(
    `try { const p = (await window.diwan.backup.pick())?.path; const r = await window.diwan.backup.restore(p, null); return 'نجح ' + r.summary.citizens; } catch (e) { return 'خطأ: ' + e.message; }`
  );
  ok(`والاسترجاع يمضي على القاعدة المتضرّرة (${restored.slice(0, 60)})`, restored.startsWith('نجح'));
  await wait(4000); // الجواب، ثم إعادة الواجهة
  ok('فعادت قاعدة المكتب سليمة', check(join(data, 'diwan.db')) === 'ok');
  const saved = await page.eval(
    `try { await window.diwan.citizens.save({ id: null, fullName: 'مدرسة النور', verified: false }); return 'حُفظ'; } catch (e) { return String(e.message); }`
  );
  ok('والحفظ يعمل بعدها', saved === 'حُفظ');
  const after = names(await page.eval(`return await window.diwan.citizens.list({});`));
  ok(`وفيها ما في النسخة وما بعدها (${after.join('، ')})`, after.length === 3);

  const aside = readdirSync(data).filter((f) => f.startsWith('before-restore-'));
  const kept = aside.length === 1 ? join(data, aside[0], 'current.db') : '';
  const keptCheck = kept && existsSync(kept) ? check(kept) : 'غائب';
  ok(
    `والأصل المتضرّر جانبًا كما هو، بلا نسخةٍ متّسقة منه (${aside.length ? readdirSync(join(data, aside[0])).join(' ') : 'لا مجلّد'})`,
    keptCheck !== 'ok' && keptCheck !== 'غائب' && !existsSync(join(data, aside[0] ?? '-', 'diwan.db'))
  );
  return steps.join('\n');
}
