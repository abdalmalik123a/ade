/**
 * سيناريو: المدّة التجريبية والتفعيل بلا شبكة (خطة Production، ٦٫٢) على التطبيق الحقيقي.
 *
 * المِقْود يعطي البرنامج (غير المثبّت وحده) مفتاحًا عامًّا للاختبار ومعرّف جهازٍ ثابتًا، وساعةً من ملفٍّ
 * يقدّمها السيناريو. فيُرى: أربعة عشر يومًا يعمل فيها كلّ شيء، ثم يتوقّف الإصدار والطباعة وPDF
 * ويبقى العرض والنسخ الاحتياطي، وإرجاع الساعة لا يعيدها، ومفتاح التمديد يمدّها، ومفتاح جهازٍ آخر
 * يُرفض، والمفتاح الكامل يفعّله ولو بعد سنين.
 */
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(process.env.TEMP ?? '.', `diwan-license-${Date.now()}`);
const CLOCK = join(DIR, 'now.txt');
const { privateKey, publicKey } = generateKeyPairSync('ed25519');

const canonical = (p) => {
  const o = { v: p.v, device: p.device, kind: p.kind, issued: p.issued };
  if (p.until) o.until = p.until;
  if (p.office) o.office = p.office;
  return JSON.stringify(o);
};
const keyFor = (payload) => {
  const body = Buffer.from(canonical(payload), 'utf8').toString('base64url');
  return `DIWAN-${body}.${sign(null, Buffer.from(body, 'utf8'), privateKey).toString('base64url')}`;
};

export async function prepare() {
  rmSync(DIR, { recursive: true, force: true });
  mkdirSync(DIR, { recursive: true });
  writeFileSync(CLOCK, '2026-10-02T10:00:00');
  return {
    DIWAN_TEST_NOW_FILE: CLOCK,
    DIWAN_TEST_MACHINE_ID: 'test-machine-guid-1',
    DIWAN_TEST_LICENSE_PUBKEY: publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    DIWAN_TEST_SAVE_DIR: DIR
  };
}

const SHEET = `{ sheetHtml: '<div class="a4-sheet"><p>نؤيد</p></div>', templateId: null, citizenId: null, authorityId: null, citizenName: 'أحمد',
  nationalId: null, docType: 'تأييد', destination: null, purpose: null, values: {}, copies: 1, copyKind: null, fee: 0,
  gregorianDate: '', hijriDate: null, operator: null, printer: null, serialPrefix: 'م', serialYear: 2026, letterheadId: null }`;

export default async function scenario(page) {
  const steps = [];
  const ok = (label, value) => steps.push(`${value ? '✓' : '✗'} ${label}`);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const status = () => page.eval(`return await window.diwan.license.status();`);
  const at = async (iso) => {
    writeFileSync(CLOCK, iso);
    await page.eval(`await window.diwan.license.status(); return true;`);
  };
  const tryIssue = () =>
    page.eval(`try { await window.diwan.documents.issue(${SHEET}, false); return 'ok'; } catch (e) { return String(e?.message ?? e); }`);
  const pill = () => page.eval(`return document.querySelector('[data-license-pill]')?.innerText ?? '';`);

  // ── اليوم الأوّل ──────────────────────────────────────────────────
  let s = await status();
  ok(`أوّل تشغيلٍ تبدأ المدّة: ١٤ يومًا (${s.status} ${s.daysLeft ?? ''})`, s.status === 'trial' && s.daysLeft === 14 && s.lastDay === '2026-10-15');
  ok('ورمز الجهاز بصيغته', /^DWN-[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/.test(s.device));
  await page.goto('office-settings');
  await wait(800);
  ok('والشريط العلوي يقول ما بقي', (await pill()).includes('بقي 14 يومًا'));
  ok('و«التفعيل» في الإعدادات برمز هذا الجهاز ورقم المطوّر', (await page.eval(`return document.querySelector('[data-license]')?.innerText ?? '';`)).includes(s.device) && (await page.text()).includes('+964 781 915 4368'));
  ok('وكلّ شيءٍ يعمل في المدّة: يصدر الكتاب', (await tryIssue()) === 'ok');

  // ── بعد أسبوعين ─────────────────────────────────────────────────
  await at('2026-10-16T09:00:00');
  s = await status();
  ok('في اليوم الخامس عشر انتهت المدّة', s.status === 'expired' && s.lastDay === '2026-10-15');
  const refused = await tryIssue();
  ok('فلا يصدر كتاب — ويُقال لماذا وكيف يُفعَّل', refused.includes('انتهت المدّة التجريبية') && refused.includes('التفعيل'));
  const pdf = await page.eval(`try { await window.diwan.output.savePdf({ sheetHtml: '<p>x</p>', suggestedName: 'x' }); return 'ok'; } catch (e) { return String(e?.message ?? e); }`);
  ok('ولا PDF', pdf.includes('انتهت المدّة التجريبية'));
  const listed = await page.eval(`return (await window.diwan.documents.list({ limit: 10 })).length;`);
  const backup = await page.eval(`try { return (await window.diwan.backup.create(null)) ? 'ok' : 'none'; } catch (e) { return String(e?.message ?? e); }`);
  ok('والعرض والنسخ الاحتياطي يعملان — لا تُقفل البيانات', listed === 1 && backup === 'ok' && readdirSync(DIR).some((f) => f.endsWith('.zip')));
  await page.eval(`location.reload(); return true;`);
  await wait(2500);
  ok('والشريط العلوي يقول إنها انتهت', (await pill()).includes('انتهت المدّة التجريبية'));

  // ── إرجاع الساعة لا يعيدها ─────────────────────────────────────────
  await at('2026-10-05T09:00:00');
  ok('وإرجاع ساعة الجهاز لا يعيد المدّة', (await status()).status === 'expired' && (await tryIssue()).includes('انتهت'));
  await at('2026-10-16T09:00:00');

  // ── مفتاح جهازٍ آخر، ثم التمديد ────────────────────────────────────
  const device = (await status()).device;
  const other = keyFor({ v: 1, device: 'DWN-0000-0000-0000-0000', kind: 'full', issued: '2026-10-16' });
  const wrong = await page.eval(`try { await window.diwan.license.activate(${JSON.stringify(other)}); return 'ok'; } catch (e) { return String(e?.message ?? e); }`);
  ok('مفتاحٌ لجهازٍ آخر يُرفض باسم الرمزين', wrong.includes('لجهازٍ آخر') && wrong.includes(device));
  await page.goto('office-settings');
  await wait(800);
  const ext = keyFor({ v: 1, device, kind: 'extend', issued: '2026-10-16', until: '2026-10-31' });
  await page.type('[data-license-key]', ext.replace(/(.{50})/g, '$1\n'));
  await page.eval(`document.querySelector('[data-act="license-activate"]').click(); return true;`);
  await wait(800);
  s = await status();
  ok(`مفتاح التمديد — ولو لُصق بأسطر — يمدّها إلى يومه (${s.status} ${s.daysLeft ?? ''})`, s.status === 'trial' && s.extended && s.lastDay === '2026-10-31' && s.daysLeft === 16);
  ok('فيعود الإصدار', (await tryIssue()) === 'ok');

  // ── المفتاح الكامل ─────────────────────────────────────────────────
  const full = keyFor({ v: 1, device, kind: 'full', issued: '2026-10-20', office: 'مكتب الاختبار' });
  await page.type('[data-license-key]', full);
  await page.eval(`document.querySelector('[data-act="license-activate"]').click(); return true;`);
  await wait(800);
  await at('2031-01-01T09:00:00');
  s = await status();
  ok('والمفتاح الكامل يفعّله مدى الحياة — ولو بعد سنين', s.status === 'activated' && s.office === 'مكتب الاختبار' && (await tryIssue()) === 'ok');
  await page.eval(`location.reload(); return true;`);
  await wait(2500);
  ok('ولا شريط مدّةٍ بعد التفعيل', (await pill()) === '');
  ok('وقُيّد التمديد والتفعيل في سجلّ التدقيق', (await page.eval(`return (await window.diwan.audit.list({ entity: 'license' })).length;`)) === 2);

  rmSync(DIR, { recursive: true, force: true });
  return steps.join('\n');
}
