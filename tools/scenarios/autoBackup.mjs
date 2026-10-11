/**
 * سيناريو: النسخة التلقائية عند الإغلاق (تعميق الموجود ٢).
 *
 * تُفعَّل مشفّرةً إلى مجلّد (فلاشةٍ مصنوعة)، و«خذها الآن» تكتب القاعدة ومرآة المخزن، والتالية
 * بلا تغييرٍ لا تكتب شيئًا. ثم يُسترجع منها: بكلمتها يُرى ما فيها، ثم تحلّ محلّ البيانات فيعود
 * ما كان قبل آخر تعديل. ثم «فلاشةٌ نُزعت»: تُقال في الإعدادات وفي «التنبيهات». ثم يُغلق
 * البرنامج فتُؤخذ نسخته قبل أن يُغلق.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
  // و٦: سبعة أحرف لا تكفي — والعملية الرئيسية تتحقّق أيضًا.
  await page.type('[data-auto-password]', 'سبعة١٢٣');
  await page.type('[data-auto-confirm]', 'سبعة١٢٣');
  await wait(200);
  const shortHint = await page.eval(`return document.querySelector('[data-auto-hint]')?.innerText ?? '';`);
  const shortOff = await page.eval(`return document.querySelector('[data-act="auto-backup-enable"]')?.disabled === true;`);
  ok(`كلمةٌ من سبعة أحرف تُرفض («${shortHint}») والزرّ معطّل`, shortHint.includes('8 أحرفٍ أقلّها') && shortOff);
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
  ok(`الاسترجاع من المجلّد: بكلمتها تُرى ما فيها (${summary.slice(0, 40)}…)`, summary.includes('النسخة سليمة') && summary.includes('مواطن واحد'));
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
  ok('وفي «التنبيهات» عند الفتح التالي', Boolean(agenda.autoBackupError?.includes('فلاشة')));
  renameSync(`${USB}-away`, USB);

  // ── فلاشة زبونٍ دخلت بحرف فلاشة النسخ (مراجعة ٧ ت١) ────────────────────
  // المسار نفسه، والقرص غير قرصنا: لا يُكتب عليه شيء، ويُعتمد بضغطةٍ من المكتب إن كان قرصه الجديد.
  const statusText = () => page.eval(`return document.querySelector('[data-auto-status]')?.innerText ?? '';`);
  const runNow = async () => {
    await page.goto('office-settings');
    await wait(900);
    await click('[data-act="auto-backup-run"]');
    await wait(2200);
  };
  const swapIn = (foreign) => {
    rmSync(`${USB}-other`, { recursive: true, force: true });
    renameSync(USB, `${USB}-other`);
    if (foreign) {
      mkdirSync(USB, { recursive: true });
      writeFileSync(join(USB, 'ملف الزبون.docx'), 'x');
    } else {
      renameSync(`${USB}-mine`, USB);
    }
  };
  renameSync(USB, `${USB}-mine`);
  mkdirSync(USB, { recursive: true });
  writeFileSync(join(USB, 'ملف الزبون.docx'), 'x');
  await runNow();
  const foreignStatus = await statusText();
  ok(`فلاشةٌ غريبة بحرف فلاشة النسخ: تُرفض ويُقال إنّ شيئًا لم يُكتب عليها (${foreignStatus.slice(0, 50)}…)`, foreignStatus.includes('لم يُكتب عليه شيء'));
  ok('ولا مجلّد نسخٍ أُنشئ عليها ولا ملفٌّ كُتب', !existsSync(ROOT) && readdirSync(USB).join() === 'ملف الزبون.docx');
  ok('وزرّ «اعتمد هذه الفلاشة» ظاهر', await page.eval(`return Boolean(document.querySelector('[data-act="auto-backup-adopt"]'));`));
  ok('وتُقال في «التنبيهات»', Boolean((await page.eval(`return window.diwan.today.agenda();`)).autoBackupError?.includes('لم يُكتب')));

  // فلاشتي رجعت: تُقبل بلا اعتمادٍ جديد.
  rmSync(USB, { recursive: true, force: true });
  renameSync(`${USB}-mine`, USB);
  await runNow();
  const mineStatus = await statusText();
  ok(`وفلاشتي إذا رجعت تُقبل بلا اعتماد (${mineStatus.slice(0, 40)}…)`, mineStatus.includes('آخر نسخة تلقائية') && !mineStatus.includes('لم تُؤخذ'));

  // فلاشةٌ جديدة يعتمدها المكتب بنفسه.
  renameSync(USB, `${USB}-mine`);
  mkdirSync(USB, { recursive: true });
  await runNow();
  ok('الفلاشة الجديدة تُرفض أوّلًا', (await statusText()).includes('لم يُكتب عليه شيء'));
  await click('[data-act="auto-backup-adopt"]');
  await wait(3000);
  const adoptedStatus = await statusText();
  ok(`و«اعتمد هذه الفلاشة» تأخذ النسخة إليها (${adoptedStatus.slice(0, 40)}…)`, adoptedStatus.includes('آخر نسخة تلقائية') && existsSync(join(ROOT, 'manifest.json')));
  const newId = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).id;
  rmSync(USB, { recursive: true, force: true });
  renameSync(`${USB}-mine`, USB);
  ok('وهويّتها غير هويّة فلاشتي', typeof newId === 'string' && newId !== JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8')).id);
  // ثم تعود فلاشتي: الآن هي الغريبة — تُعتمد بضغطة فيستمرّ الإغلاق بنسخته.
  await runNow();
  ok('وفلاشتي القديمة صارت غريبةً بعد اعتماد غيرها', (await statusText()).includes('لم يُكتب عليه شيء'));
  await click('[data-act="auto-backup-adopt"]');
  await wait(3000);
  ok('وتُعتمد من جديد بضغطة', (await statusText()).includes('آخر نسخة تلقائية'));

  // ── الإغلاق يأخذ نسخته ────────────────────────────────────────────────
  // شيءٌ جديد قبل الإغلاق: القاعدة التي لم تتغيّر منذ آخر نسخةٍ لا تُكتب مرّةً ثانية.
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'قبل الإغلاق', verified: false }); return true;`);
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
