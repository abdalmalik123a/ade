/**
 * سيناريو: النسخة الاحتياطية واسترجاعها (د١).
 *
 * نسخةٌ مشفّرة من «الإعدادات»، ثم يتغيّر شيءٌ على الجهاز، ثم تُسترجع النسخة: بكلمةٍ
 * خاطئة تُرفض، وبالصحيحة يُرى ما فيها ثم تحلّ محلّ البيانات — وما كان يُنقل جانبًا —
 * وتُعاد الواجهة وتعمل.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import Database from 'better-sqlite3';

const DIR = join(process.env.TEMP ?? '.', `diwan-backup-${Date.now()}`);
const RESTORE = join(DIR, 'restore.diwan');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  // الحفظ يكتب هنا، والفتح يقرأ النسخة المنسوخة باسمٍ ثابت — حوارات النظام لا تُضغط آليًّا.
  return { DIWAN_TEST_SAVE_DIR: DIR, DIWAN_TEST_OPEN_FILE: RESTORE };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const db = () => new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const citizens = () => {
    const d = db();
    const names = d.prepare('SELECT full_name AS n FROM citizens ORDER BY id').all().map((r) => r.n);
    d.close();
    return names;
  };

  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'قبل النسخة', verified: false }); return true;`);

  // ── نسخةٌ مشفّرة ─────────────────────────────────────────────────────
  await page.goto('office-settings');
  await wait(800);
  ok('«آخر نسخة احتياطية» يُذكَّر بها ولم تُؤخذ بعد', (await page.text()).includes('آخر نسخة احتياطية: لم يحدث بعد'));
  await page.eval(`document.querySelector('[data-backup-encrypt]').click(); return true;`);
  await wait(200);
  await page.type('[data-backup-password]', 'سرّ المكتب');
  await page.type('[data-backup-confirm]', 'سرّ المكتب');
  await page.eval(`document.querySelector('[data-act="backup-create"]').click(); return true;`);
  await wait(2500);
  const made = readdirSync(DIR).filter((f) => f.endsWith('.diwan'));
  ok('حُفظت النسخة المشفّرة', made.length === 1);
  const bytes = made.length ? readFileSync(join(DIR, made[0])) : Buffer.alloc(0);
  ok('وهي مشفّرة فعلًا: لا أرشيف مقروءًا ولا اسمٌ فيها', bytes.subarray(0, 8).toString('latin1') === 'DIWANENC' && !bytes.includes(Buffer.from('diwan.db')));
  ok('و«آخر نسخة» صارت اليوم', (await page.text()).includes('آخر نسخة احتياطية: اليوم'));
  let d = db();
  const audit = d.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'backup' AND action = 'create'").get().n;
  d.close();
  ok('وقُيّدت في سجلّ التدقيق', audit === 1);
  if (made.length) copyFileSync(join(DIR, made[0]), RESTORE);

  // ── يتغيّر شيءٌ بعد النسخة ─────────────────────────────────────────────
  await page.eval(`await window.diwan.citizens.save({ id: null, fullName: 'بعد النسخة', verified: false }); return true;`);
  ok('على الجهاز الآن مواطنان', citizens().length === 2);

  // ── الاسترجاع ──────────────────────────────────────────────────────────
  await page.eval(`document.querySelector('[data-act="backup-pick"]').click(); return true;`);
  await wait(800);
  ok('النسخة المشفّرة تُسأل كلمتها', await page.eval(`return Boolean(document.querySelector('[data-restore-password]'));`));
  await page.type('[data-restore-password]', 'كلمة خاطئة');
  await page.eval(`document.querySelector('[data-act="backup-inspect"]').click(); return true;`);
  await wait(1500);
  ok('وبكلمةٍ خاطئة تُرفض', (await page.text()).includes('كلمة المرور خاطئة'));
  await page.type('[data-restore-password]', 'سرّ المكتب');
  await page.eval(`document.querySelector('[data-act="backup-inspect"]').click(); return true;`);
  await wait(1500);
  const summary = await page.eval(`return document.querySelector('[data-backup-summary]')?.innerText ?? '';`);
  ok(`وبالصحيحة يُرى ما فيها قبل الموافقة (${summary.split('\n')[0]})`, summary.includes('النسخة سليمة') && summary.includes('1 مواطنًا'));
  ok('ويُقال إنها تحلّ محلّ البيانات، وما عليه يُنقل جانبًا', summary.includes('تحلّ محلّ بيانات هذا الجهاز كلّها') && summary.includes('لا يُحذف'));
  ok('ومعها وقتها وإصدار البرنامج الذي أخذها', summary.includes('أُخذت') && summary.includes('بالإصدار'));

  await page.eval(`document.querySelector('[data-act="backup-restore"]').click(); return true;`);
  await wait(4000); // الجواب، ثم إعادة الواجهة

  ok('استُرجعت البيانات: ما بعد النسخة غاب، وما قبلها باقٍ', JSON.stringify(citizens()) === JSON.stringify(['قبل النسخة']));
  const aside = readdirSync(join(profile, 'data')).filter((f) => f.startsWith('before-restore-'));
  ok('وما كان على الجهاز نُقل جانبًا لا حُذف', aside.length === 1 && existsSync(join(profile, 'data', aside[0] ?? '-', 'diwan.db')));
  const work = join(profile, 'data', 'restore-work');
  ok('وما فُكّ مؤقّتًا للفحص والاسترجاع مُحي', !existsSync(work) || readdirSync(work).length === 0);
  if (aside.length === 1) {
    const old = new Database(join(profile, 'data', aside[0], 'diwan.db'), { readonly: true });
    const n = old.prepare('SELECT COUNT(*) AS n FROM citizens').get().n;
    old.close();
    ok('وفيه المواطنان كما كانا', n === 2);
  }
  d = db();
  const restored = d.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE entity = 'backup' AND action = 'restore'").get().n;
  d.close();
  ok('وقُيّد الاسترجاع', restored === 1);

  // الواجهة أُعيدت وتعمل على البيانات المسترجعة
  await page.goto('citizens-identity-records');
  await wait(1200);
  const text = await page.text();
  ok('والواجهة تعمل بعد الاسترجاع', text.includes('قبل النسخة') && !text.includes('بعد النسخة'));
  const found = await page.eval(`return (await window.diwan.citizens.list({ query: 'قبل' })).length;`);
  ok('والبحث يعمل على البيانات المسترجعة', found === 1);

  return steps.join('\n');
}
