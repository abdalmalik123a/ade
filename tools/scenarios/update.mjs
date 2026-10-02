/**
 * سيناريو: التحديث «أ+» و«ما الجديد» (خطة Production، ٧٫١–٧٫٢).
 *
 * أداة المالك تصنع ملفّ تحديثٍ (بمفتاح اختبار، ومثبّتٍ مصنوع) — فيُختار من الإعدادات: يُرى إصداره و«ما
 * الجديد» ويُفكّ مثبّته وتُطابق بصمته (ولا يُشغَّل تحت المِقْود). ثم تُكتب في القاعدة أنّ إصدارًا أقدم فتحها
 * ويُعاد الإقلاع: نسخةٌ قبل الترحيل في `before-update/`، و«ما الجديد» مرّةً، ورقم هذا الإصدار في القاعدة.
 */
import { execFileSync } from 'node:child_process';
import { createPrivateKey, createPublicKey, randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DIR = join(process.env.TEMP ?? '.', `diwan-update-${Date.now()}`);
const UPDATE = join(DIR, 'diwan-9.9.9.diwanupdate');

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  const tool = join(ROOT, 'tools', 'license', 'keygen.mjs');
  const key = join(DIR, 'owner.pem');
  execFileSync(process.execPath, [tool, 'init', '--key', key]);
  writeFileSync(join(DIR, 'diwan-9.9.9-setup.exe'), randomBytes(300_000));
  writeFileSync(join(DIR, 'notes.md'), '- **ورقةٌ جديدة**: تجربة التحديث\n- إصلاحات');
  execFileSync(process.execPath, [tool, 'update', join(DIR, 'diwan-9.9.9-setup.exe'), '--version', '9.9.9', '--notes', join(DIR, 'notes.md'), '--key', key]);
  return {
    DIWAN_TEST_OPEN_FILE: UPDATE,
    DIWAN_TEST_LICENSE_PUBKEY: createPublicKey(createPrivateKey(readFileSync(key, 'utf8'))).export({ type: 'spki', format: 'pem' }).toString(),
    DIWAN_TEST_UPDATE_NO_LAUNCH: '1'
  };
}

export default async function scenario(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const version = await page.eval(`return (await window.diwan.ui.info()).version;`);
  const stamped = () => {
    const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
    try {
      return d.prepare("SELECT value FROM settings WHERE key = 'appVersion'").get()?.value ?? null;
    } finally {
      d.close();
    }
  };
  ok(`القاعدة تحمل رقم الإصدار الذي فتحها (${version})`, stamped() === version);

  await page.goto('office-settings');
  await wait(800);
  await page.eval(`document.querySelector('[data-act="update-pick"]').click(); return true;`);
  await wait(1500);
  const picked = await page.eval(`return document.querySelector('[data-update-picked]')?.innerText ?? '';`);
  ok('ملفّ التحديث يُفحص فيُرى إصداره و«ما الجديد»', picked.includes('9.9.9') && picked.includes('موقّعٌ من المطوّر') && picked.includes('ورقةٌ جديدة'));
  await page.eval(`document.querySelector('[data-act="update-install"]').click(); return true;`);
  await wait(2000);
  const note = await page.eval(`return document.querySelector('[data-update-note]')?.innerText ?? '';`);
  const installer = note.replace(/^جاهز:\s*/, '').trim();
  ok('وبالموافقة يُفكّ المثبّت وتطابق بصمته (ولا يُشغَّل تحت المِقْود)', note.startsWith('جاهز:') && existsSync(installer) && readFileSync(installer).length === 300_000);

  // كأنّ إصدارًا أقدم فتح هذه البيانات: يُكتب في القاعدة، ويُعاد الإقلاع.
  const d = new Database(join(profile, 'data', 'diwan.db'));
  d.prepare("UPDATE settings SET value = '0.0.1' WHERE key = 'appVersion'").run();
  d.close();
  return steps.join('\n');
}

/** الإقلاع التالي بإصدارٍ أحدث من بيانات المكتب. */
export async function afterRestart(page, { profile }) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  await wait(800);
  const snaps = existsSync(join(profile, 'data', 'before-update')) ? readdirSync(join(profile, 'data', 'before-update')) : [];
  ok('أوّل إقلاعٍ بإصدارٍ أحدث يأخذ نسخةً قبل الترحيل', snaps.some((f) => f.startsWith('0.0.1-') && f.endsWith('.db')));
  const dialog = await page.eval(`return document.querySelector('[data-whats-new]')?.innerText ?? '';`);
  ok('ويعرض «ما الجديد» مرّةً', dialog.includes('ما الجديد في ديوان') && dialog.includes('حُدِّث البرنامج من 0.0.1'));
  await page.eval(`document.querySelector('[data-act="whats-new-close"]').click(); return true;`);
  await wait(300);
  const version = await page.eval(`return (await window.diwan.ui.info()).version;`);
  const d = new Database(join(profile, 'data', 'diwan.db'), { readonly: true });
  const stamped = d.prepare("SELECT value FROM settings WHERE key = 'appVersion'").get()?.value;
  d.close();
  ok('ويُكتب في القاعدة رقم هذا الإصدار بعد الترحيل', stamped === version);
  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
