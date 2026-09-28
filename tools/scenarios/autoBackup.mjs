/**
 * سيناريو: النسخة التلقائية عند الإغلاق (تعميق الموجود ٢).
 *
 * تُفعَّل مشفّرةً إلى مجلّد (فلاشةٍ مصنوعة)، و«خذها الآن» تكتب القاعدة ومرآة المخزن، والتالية
 * بلا تغييرٍ لا تكتب شيئًا. ثم يُسترجع منها: بكلمتها يُرى ما فيها، ثم تحلّ محلّ البيانات فيعود
 * ما كان قبل آخر تعديل. ثم «فلاشةٌ نُزعت»: تُقال في الإعدادات وفي «ما ينتظرك اليوم». ثم يُغلق
 * البرنامج فتُؤخذ نسخته قبل أن يُغلق.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const USB = join(process.env.TEMP ?? '.', `diwan-usb-${Date.now()}`);
const ROOT = join(USB, 'Diwan-Backup');

export async function prepare() {
  rmSync(USB, { recursive: true, force: true });
  mkdirSync(USB, { recursive: true });
  // حوار المجلّد لا يُضغط آليًّا — فيُعطى المجلّد نفسه للتفعيل والاسترجاع.
  return { DIWAN_TEST_OPEN_DIR: USB };
}

export default async function scenario(page, { profile, shotsDir }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const click = (sel) => page.eval(`document.querySelector(${JSON.stringify(sel)})?.click(); return true;`);
  const citizens = () => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    const names = d.prepare('SELECT full_name AS n FROM citizens ORDER BY id').all().map((r) => r.n);
    d.close();
    return names;
  };
  const snapshots = () => (existsSync(join(ROOT, 'db')) ? readdirSync(join(ROOT, 'db')).filter((f) => f.endsWith('.db.enc')) : []);

  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'قبل النسخة', verified: false }); return true;`);

  // ── التفعيل مشفّرة ────────────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(900);
  ok('«النسخة التلقائية عند الإغلاق» في الإعدادات، غير مفعّلة', await page.eval(`return document.querySelector('[data-auto-backup]')?.dataset.autoBackup === 'off';`));
  await click('[data-auto-encrypt]');
  await wait(200);
  await page.type('[data-auto-password]', 'كلمة-المكتب');
  await page.type('[data-auto-confirm]', 'كلمة-المكتب');
  await click('[data-act="auto-backup-enable"]');
  await wait(900);
  ok('وتُفعَّل إلى المجلّد المختار، مشفّرة', await page.eval(`return document.querySelector('[data-auto-backup]')?.dataset.autoBackup === 'on' && (document.querySelector('[data-auto-dir]')?.innerText ?? '').includes('مشفّرة');`));

  if (shotsDir) {
    await page.eval(`document.querySelector('[data-auto-backup]')?.scrollIntoView(); return true;`);
    await page.shot(join(shotsDir, 'auto-backup-on.png'));
  }

  // ── خذها الآن ─────────────────────────────────────────────────────────
  await click('[data-act="auto-backup-run"]');
  await wait(2500);
  const manifest = existsSync(join(ROOT, 'manifest.json')) ? JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')) : null;
  ok(`«خذها الآن»: القاعدة مشفّرةً في المجلّد (${snapshots().join('، ')})`, manifest?.encrypted === true && snapshots().length === 1);
  const sealed = readFileSync(join(ROOT, 'db', snapshots()[0]));
  ok('ولا يُقرأ منها اسمٌ بلا كلمتها', !sealed.includes(Buffer.from('قبل النسخة')));
  await click('[data-act="auto-backup-run"]');
  await wait(2000);
  ok('والتالية بلا تغيير لا تكتب نسخةً جديدة', snapshots().length === 1 && (await page.eval(`return document.querySelector('[data-backup-note]')?.innerText ?? '';`)).includes('لم تتغيّر'));

  // ── يتغيّر شيء، ثم يُسترجع ما قبله ─────────────────────────────────────
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'بعد النسخة', verified: false }); return true;`);
  ok('على الجهاز الآن ما بعد النسخة', citizens().includes('بعد النسخة'));
  await click('[data-act="mirror-pick"]');
  await wait(900);
  await page.type('[data-restore-password]', 'كلمة-المكتب');
  await click('[data-act="backup-inspect"]');
  await wait(1500);
  const summary = await page.eval(`return document.querySelector('[data-backup-summary]')?.innerText ?? '';`);
  ok(`الاسترجاع من المجلّد: بكلمتها تُرى ما فيها (${summary.slice(0, 40)}…)`, summary.includes('النسخة سليمة') && summary.includes('1 مواطنًا'));
  await click('[data-act="backup-restore"]');
  await wait(3500);
  ok(`وتحلّ محلّ البيانات: عاد ما كان قبل آخر تعديل (${citizens().join('، ')})`, citizens().join() === 'قبل النسخة');

  // ── فلاشةٌ نُزعت ──────────────────────────────────────────────────────
  renameSync(USB, `${USB}-away`);
  await page.goto('office-settings');
  await wait(900);
  await click('[data-act="auto-backup-run"]');
  await wait(1500);
  const status = await page.eval(`return document.querySelector('[data-auto-status]')?.innerText ?? '';`);
  ok(`الفلاشة غير الموصولة تُقال في الإعدادات (${status.slice(0, 50)}…)`, status.includes('لم تُؤخذ الأخيرة') && status.includes('فلاشة'));
  const agenda = await page.eval(`return window.diwan.today.agenda();`);
  ok('وفي «ما ينتظرك اليوم» عند الفتح التالي', Boolean(agenda.autoBackupError?.includes('فلاشة')));
  renameSync(`${USB}-away`, USB);

  // ── الإغلاق يأخذ نسخته ────────────────────────────────────────────────
  const before = snapshots().length;
  await page.eval(`setTimeout(() => window.close(), 50); return true;`);
  let after = before;
  for (let i = 0; i < 40 && after === before; i++) {
    await wait(250);
    after = snapshots().length;
  }
  ok(`والإغلاق يأخذ نسخته قبل أن يُغلق (${before} ← ${after})`, after === before + 1);
  return steps.join('\n');
}
